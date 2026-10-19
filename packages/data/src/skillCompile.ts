// Compiles an operator skill's SkillData file, and the projectile, ability
// entity and buff files it reaches, into the plain facts a kit hand-writes
// today (docs/kit-abstractions.md section 1): every damage landing with its
// frame from the skill's start, scale key and SimpleCalcBB factor, decorate
// mask and log event key; inflictions, forced reactions and partial
// consumption next to it; ultimate energy and SP grants; energy blocks; the
// team-energy frame; and the jumps and branches it can't decide.
//
// It reads the action graph without running the game: one enemy, every
// ForEach once, IfElse / Switch conditions decided only when the data
// settles them (a literal comparison, runtime state at its start value,
// "there is a target"), otherwise both sides are kept and labelled in
// `branch`. JumpToAction is reported, never followed. Event handlers (ability
// events, a buff's events) run once at their buff's or entity's start, so
// their frames are lower bounds, labelled in `branch`. Frames are 30 FPS;
// projectile travel isn't in the data, so a projectile's hits use its launch
// frame. Enum codes it relies on (buffEvent, compare, blackboard operations)
// are the ones Endaxis documents; shared reaction buffs (buff_common_*) are
// recognised by name, not followed.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonExact } from "./json.ts";
import { sourceDir } from "./sources.ts";
import { isSkillFileListed, skillFilePath } from "./skillData.ts";
import { isBuffFileListed } from "./buffData.ts";

const FPS = 30;
type Obj = Record<string, unknown>;

/** Decorate-mask bits (DamageAction damageUnits[].damageDecorateMask). */
export const DECORATE_BITS = { basic: 128, battle: 256, ultimate: 512, combo: 8192, finalStrike: 2097152 } as const;
export type ActionKind = "basic" | "battle" | "ultimate" | "combo";
export type InflictionElement = "fire" | "pulse" | "cryst" | "natural";
export type StatusName = "combustion" | "electrification" | "solidification" | "corrosion";

/** SpellInfliction inflictionType → kit element (0 Heat, 1 Electric, 2 Cryo, 3 Nature). */
const INFLICTION: readonly InflictionElement[] = ["fire", "pulse", "cryst", "natural"];
/**
 * ForceSpellStatusAction spellStatusType → status. Assumed to follow the
 * inflictionType order (the batch's only case, Liino's ultimate bomb, is 1 and
 * forces Electrification per its description).
 */
const FORCED_STATUS: readonly StatusName[] = ["combustion", "electrification", "solidification", "corrosion"];
/** Status words in the shared reaction buffs a skill creates to force a reaction (buff_common_fire_fire_burning_triggered). */
const STATUS_WORD: Readonly<Record<string, StatusName>> = { burning: "combustion", conduct: "electrification", frozen: "solidification", corrupt: "corrosion" };

/** A blackboard value as the compiler tracks it: a product of keys × a literal factor (no keys: a literal), with its value when known. */
export interface CompiledValue {
  /** The blackboard keys multiplied (a kit hit's `scale`); empty for a literal. */
  readonly keys: readonly string[];
  /** Per key, the file whose blackboard defines it (the compiled skill's own, unless a child file's key wasn't passed down). */
  readonly origins: readonly string[];
  /** Literal multiplier applied on the way (SimpleCalcBB × / ÷). */
  readonly factor: number;
  /** Its value, when known: the level value (CompileOptions.values) or the file's default for keys, the literal otherwise. */
  readonly value: number | null;
  /** Set when the value is an expression the compiler doesn't reduce to key × factor. */
  readonly expr?: string;
  /** The key is runtime state (SkillData blackboard isDynamic, e.g. a hit counter): its default is its starting value. */
  readonly dynamic?: true;
}

/** Where a fact happens. */
export interface TeamEnergyPart extends Placement {
  readonly ratio: number | null;
}

export interface Placement {
  /** Frame from the compiled skill's start. */
  readonly frame: number;
  /** The SkillData or BuffData file holding the action: battle logs use it as a damage landing's event key. */
  readonly file: string;
  /** Dealt from another file than the skill's own (a projectile, ability entity, buff or cast helper skill). */
  readonly detached: boolean;
  /** Conditions the compiler couldn't decide on the way, outermost first (empty: unconditional). */
  readonly branch: readonly string[];
  /** How the file was reached, e.g. `LaunchProjectile@12 hit → chr_0016_laevat_attack_5_projhit`. */
  readonly via: readonly string[];
}

export interface CompiledLanding extends Placement {
  readonly scale: CompiledValue;
  readonly decorateMask: number;
  readonly kind: ActionKind | null;
  readonly finalStrike: boolean;
  /** damageUnits[].damageType (the element / physical type code). */
  readonly damageType: number;
}

/** What a skill does to the enemy's arts state; `landing` is the landing it goes with (as for CompiledCost), or null. */
export type CompiledEffect = Placement & { landing: number | null } & (
  | { readonly kind: "infliction"; readonly element: InflictionElement; readonly isExtra: boolean }
  | { readonly kind: "forcedReaction"; readonly status: StatusName | null; readonly source: string; readonly level: CompiledValue | null; readonly duration: CompiledValue | null }
  | { readonly kind: "burst"; readonly element: InflictionElement | null; readonly source: string }
  | { readonly kind: "consumeInfliction"; readonly element: InflictionElement | null; readonly layers: CompiledValue | null; readonly tags: readonly number[] }
);

export interface CompiledCost extends Placement {
  /** ObtainCostAction costType: 0 ultimate energy, 1 SP. */
  readonly costType: 0 | 1;
  readonly value: CompiledValue;
  readonly coefficient: number;
  readonly isPercent: boolean;
  /** Index of the landing it goes with (same frame, same file preferred, branch compatible), or null. */
  readonly landing: number | null;
}

export interface EnergyBlock extends Placement {
  /** The buff holding the RefrainObtainUsp, or null when it's on the skill's own timeline. */
  readonly buff: string | null;
  /** Last blocked frame from the skill's start (the buff's end, or the timeline action's end), or null when unbounded. */
  readonly until: number | null;
}

export interface CompiledJump extends Placement {
  readonly destFrame: number;
  /** Its conditionAction, summarised ("always" when empty). */
  readonly condition: string;
}

export interface CompiledCast extends Placement {
  readonly skillId: string;
  readonly followed: boolean;
}

export interface CompiledSkill {
  readonly skillId: string;
  readonly durationFrames: number;
  readonly exclusiveFrames: number;
  readonly landings: readonly CompiledLanding[];
  readonly effects: readonly CompiledEffect[];
  /** ObtainCostAction costType 0. */
  readonly energy: readonly CompiledCost[];
  /** ObtainCostAction costType 1. */
  readonly sp: readonly CompiledCost[];
  readonly energyBlocks: readonly EnergyBlock[];
  /** CreateBuff buff_common_obtain_ultimate_sp (the team's energy for the SP spent): where, and its `ratio` of it (1 unassigned, null unknown). */
  readonly teamEnergy: readonly TeamEnergyPart[];
  readonly jumps: readonly CompiledJump[];
  readonly casts: readonly CompiledCast[];
  /** Assumptions made and things not followed. */
  readonly notes: readonly string[];
  /** Every file read, the skill's own first. */
  readonly files: readonly string[];
}

export interface CompileOptions {
  /**
   * Whether a CastSkill target is compiled as part of this skill (a helper
   * file such as Arcane's `combo_skill_abilityentity_end`) rather than only
   * reported (another of the operator's skills). Default: report only.
   */
  readonly followCast?: (skillId: string) => boolean;
  /**
   * The skill's values at a level (SkillTable blackboard), used where a
   * value decides timing: buff durations, trigger and tick intervals. The
   * file's own defaults are often a placeholder (Liino's ultmusic_duration:
   * 7.5 in the file, 15 at every level). Default: the file's defaults.
   */
  readonly values?: Readonly<Record<string, number>>;
}

const shortType = (t: unknown): string => {
  if (typeof t !== "string") return "";
  const name = t.split(",")[0] ?? "";
  const last = name.split(".").pop() ?? "";
  return last.split("+")[0] ?? last;
};
const isConditionType = (t: unknown): boolean => {
  if (typeof t !== "string") return false;
  const s = shortType(t);
  return t.includes(".Conditions.") || t.includes(".Condition.") || /^(Check|Compare)/.test(s) || s === "Probablity" || s === "OrConditionAction";
};
const toFrame = (seconds: number) => Math.round(seconds * FPS);
/** Whether branch `a` is `b` or encloses it. */
export const prefixOf = (a: readonly string[], b: readonly string[]) => a.length <= b.length && a.every((x, k) => b[k] === x);
const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);

type BB = Map<string, CompiledValue>;

interface Ctx {
  readonly file: string;
  readonly detached: boolean;
  readonly bb: BB;
  readonly branch: readonly string[];
  readonly via: readonly string[];
  /** Files on the way here (cycle guard). */
  readonly stack: readonly string[];
  /** The buff's life when walking a buff file: RefrainObtainUsp in it blocks for that long. */
  readonly buffSpan?: { readonly buff: string; readonly from: number; readonly to: number | null };
  /** Inside an event handler, which may run any number of times: runtime counters aren't at their start value. */
  readonly repeated?: true;
}

interface Sequence {
  readonly actionData?: unknown;
}

function readJson(path: string): Obj {
  return parseJsonExact(readFileSync(path, "utf8")) as Obj;
}

function buffPath(id: string): string {
  return join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
}

let inflictionTagCache: Map<number, InflictionElement> | null = null;
/** Infliction stacks carry a tag per element (BuffData buff_common_energy_shard_attached_<element> applyTags). */
function inflictionTags(): Map<number, InflictionElement> {
  if (inflictionTagCache) return inflictionTagCache;
  const map = new Map<number, InflictionElement>();
  for (const el of INFLICTION) {
    const id = `buff_common_energy_shard_attached_${el}`;
    if (!isBuffFileListed(id) || !existsSync(buffPath(id))) continue;
    for (const t of (readJson(buffPath(id))["applyTags"] ?? []) as Obj[]) if (typeof t["tagId"] === "number") map.set(t["tagId"], el);
  }
  inflictionTagCache = map;
  return map;
}

const LITERAL = (value: number | null): CompiledValue => ({ keys: [], origins: [], factor: 1, value });
const UNKNOWN = (expr: string): CompiledValue => ({ keys: [], origins: [], factor: 1, value: null, expr });
const isLiteral = (v: CompiledValue) => v.keys.length === 0 && !v.expr && v.value !== null;
/** A value conditions may be decided on: a literal, or runtime state still at a known value. */
const isKnown = (v: CompiledValue) => isLiteral(v) || (v.dynamic === true && v.keys.length === 1 && v.factor === 1 && !v.expr && v.value !== null);

function describeValue(v: CompiledValue): string {
  if (v.expr) return v.expr;
  if (v.keys.length === 0) return v.value === null ? "?" : fmt(v.value);
  return [...v.keys, ...(v.factor === 1 ? [] : [fmt(v.factor)])].join(" × ");
}

class Compiler {
  readonly landings: CompiledLanding[] = [];
  readonly effects: CompiledEffect[] = [];
  readonly costs: CompiledCost[] = [];
  readonly blocks: EnergyBlock[] = [];
  readonly teamEnergy: TeamEnergyPart[] = [];
  readonly jumps: CompiledJump[] = [];
  readonly casts: CompiledCast[] = [];
  readonly notes = new Set<string>();
  readonly files: string[] = [];

  readonly root: string;
  readonly options: CompileOptions;

  constructor(root: string, options: CompileOptions) {
    this.root = root;
    this.options = options;
  }

  private place(ctx: Ctx, frame: number, extraBranch: readonly string[] = []): Placement {
    return { frame, file: ctx.file, detached: ctx.detached, branch: [...ctx.branch, ...extraBranch], via: ctx.via };
  }

  /** A `{useBlackboardKey, blackboardKey, value}` field read against the blackboard. */
  value(field: unknown, bb: BB): CompiledValue {
    if (typeof field !== "object" || field === null) return LITERAL(typeof field === "number" ? field : null);
    const f = field as Obj;
    if (f["useBlackboardKey"] === true && typeof f["blackboardKey"] === "string") {
      const key = f["blackboardKey"];
      // A key the file doesn't declare (an entity's EntityBB_ state set elsewhere, e.g. Arcane's mode) stays unknown.
      return bb.get(key) ?? UNKNOWN(`$${key}`);
    }
    return LITERAL(typeof f["value"] === "number" ? f["value"] : null);
  }

  /** Blackboard arithmetic (Endaxis-documented operation codes: 0 assign, 1 add, 2 multiply, 3 divide). */
  calc(op: number, a: CompiledValue, b: CompiledValue, repeated = false): CompiledValue {
    const lit = isLiteral;
    // Counting on runtime state (hit_index += 1) gives a literal; a skill value's default isn't its level value.
    // Counting on runtime state (hit_index += 1, atk_scale_total += atk_scale) starts from its known value; a skill value's default isn't its level value.
    const state = (v: CompiledValue) => (!repeated && v.dynamic === true && isKnown(v) ? LITERAL(v.value) : v);
    if (op === 1 && (state(a) !== a || state(b) !== b)) return this.calc(op, state(a), state(b), repeated);
    if (lit(a) && lit(b)) {
      const x = a.value as number;
      const y = b.value as number;
      if (op === 1) return LITERAL(x + y);
      if (op === 2) return LITERAL(x * y);
      if (op === 3) return LITERAL(y === 0 ? null : x / y);
    }
    const scaled = (v: CompiledValue, f: number): CompiledValue => ({ ...v, factor: v.factor * f, value: v.value === null ? null : v.value * f });
    if (op === 1 && lit(b) && b.value === 0) return a;
    if (op === 1 && lit(a) && a.value === 0) return b;
    if (op === 2 && !a.expr && lit(b)) return scaled(a, b.value as number);
    if (op === 2 && !b.expr && lit(a)) return scaled(b, a.value as number);
    if (op === 2 && !a.expr && !b.expr) return { keys: [...a.keys, ...b.keys], origins: [...a.origins, ...b.origins], factor: a.factor * b.factor, value: a.value === null || b.value === null ? null : a.value * b.value };
    if (op === 3 && !a.expr && lit(b) && b.value !== 0) return scaled(a, 1 / (b.value as number));
    const sym = ["=", "+", "×", "÷", "floor", "ceil", "round"][op] ?? `op${op}`;
    return UNKNOWN(`(${describeValue(a)} ${sym} ${describeValue(b)})`);
  }

  /**
   * The defaults of a file's blackboard as keys of that file, with their
   * default values (runtime state marked dynamic).
   */
  defaults(file: string, j: Obj): BB {
    const bb: BB = new Map();
    for (const b of (j["blackboard"] ?? []) as Obj[]) {
      const key = b["key"];
      if (typeof key !== "string") continue;
      const v = typeof b["valueDouble"] === "number" ? b["valueDouble"] : null;
      bb.set(key, { keys: [key], origins: [file], factor: 1, value: v, ...(b["isDynamic"] === true ? { dynamic: true as const } : {}) });
    }
    return bb;
  }

  run(): CompiledSkill | null {
    if (!isSkillFileListed(this.root) || !existsSync(skillFilePath(this.root))) return null;
    const j = readJson(skillFilePath(this.root));
    this.files.push(this.root);
    const bb = this.defaults(this.root, j);
    for (const [k, v] of Object.entries(this.options.values ?? {})) {
      const d = bb.get(k);
      // A value the level table has is a skill value, not runtime state.
      bb.set(k, { keys: [k], origins: [d?.origins[0] ?? this.root], factor: 1, value: v });
    }
    const ctx: Ctx = { file: this.root, detached: false, bb, branch: [], via: [], stack: [this.root] };
    this.walkSkillFile(j, 0, ctx);
    this.attach();
    return {
      skillId: this.root,
      durationFrames: typeof j["durationFrame"] === "number" ? j["durationFrame"] : 0,
      exclusiveFrames: typeof j["exclusiveFrame"] === "number" ? j["exclusiveFrame"] : 0,
      landings: this.landings,
      effects: this.effects,
      energy: this.costs.filter((c) => c.costType === 0),
      sp: this.costs.filter((c) => c.costType === 1),
      energyBlocks: this.blocks,
      teamEnergy: this.teamEnergy,
      jumps: this.jumps,
      casts: this.casts,
      notes: [...this.notes],
      files: this.files,
    };
  }

  /** Links effects and costs to the landing in the same file at the same frame whose branch they're inside. */
  private attach() {
    const find = (p: Placement): number | null => {
      // Same file first, then any file at that frame (a combo's energy on its own timeline, its damage in the projectile);
      // inside the landing's branch first, else a landing on a branch inside the effect's (the effect happens either way).
      for (const sameFile of [true, false]) {
        const here = (l: CompiledLanding) => l.frame === p.frame && (!sameFile || l.file === p.file);
        let i = this.landings.findIndex((l) => here(l) && prefixOf(l.branch, p.branch));
        if (i < 0) i = this.landings.findIndex((l) => here(l) && prefixOf(p.branch, l.branch));
        if (i >= 0) return i;
      }
      return null;
    };
    for (const e of this.effects) e.landing = find(e);
    for (let i = 0; i < this.costs.length; i++) {
      const c = this.costs[i] as CompiledCost;
      this.costs[i] = { ...c, landing: find(c) };
    }
  }

  private walkSkillFile(j: Obj, base: number, ctx: Ctx) {
    const group = (j["actionGroupData"] ?? {}) as Obj;
    this.walkTimeline((group["timelineActions"] ?? []) as Obj[], base, ctx);
    for (const e of (group["passiveEventActions"] ?? []) as Obj[]) {
      this.walkSequences(e["actions"], base, base, { ...ctx, repeated: true, branch: [...ctx.branch, `on ability event ${String(e["abilityEvent"])}`] });
    }
  }

  private walkTimeline(timeline: readonly Obj[], base: number, ctx: Ctx) {
    const sorted = timeline.map((ta, i) => ({ ta, i })).sort((a, b) => Number(a.ta["_startFrame"]) - Number(b.ta["_startFrame"]) || a.i - b.i);
    for (const { ta } of sorted) {
      const start = base + Number(ta["_startFrame"]);
      const end = ta["_endFrame"] === undefined ? start : base + Number(ta["_endFrame"]);
      this.execSeq(ta["_sequenceActionData"] as Sequence, start, end, ctx);
    }
  }

  private walkSequences(seqs: unknown, start: number, end: number, ctx: Ctx) {
    if (Array.isArray(seqs)) for (const s of seqs) this.execSeq(s as Sequence, start, end, ctx);
    else if (seqs && typeof seqs === "object") this.execSeq(seqs as Sequence, start, end, ctx);
  }

  /** A sequence's actions in order; a condition among them gates the rest. */
  private execSeq(seq: Sequence | undefined, start: number, end: number, ctx: Ctx) {
    if (!seq || !Array.isArray(seq.actionData)) return;
    this.execActions(seq.actionData as Obj[], 0, start, end, ctx);
  }

  private execActions(actions: readonly Obj[], from: number, start: number, end: number, ctx: Ctx) {
    for (let i = from; i < actions.length; i++) {
      const raw = actions[i] as Obj;
      if (raw["isEnable"] === false) continue;
      if (isConditionType(raw["$type"])) {
        const r = this.evalCondition(raw, ctx);
        this.invalidate(raw, shortType(raw["$type"]), ctx);
        if (r.value === false) return;
        if (r.value === null) {
          // The rest runs only if the gate holds: what it writes is known only on that path.
          this.fork(ctx, [(c) => this.execActions(actions, i + 1, start, end, { ...c, branch: [...c.branch, `if ${r.label}`] }), () => {}]);
          return;
        }
        continue;
      }
      this.exec(raw, start, end, ctx);
    }
  }

  /**
   * Runs alternatives (undecided branches) each on its own copy of the
   * blackboard; afterwards a key keeps a value only if every alternative
   * left it the same.
   */
  private fork(ctx: Ctx, alternatives: readonly ((c: Ctx) => void)[]) {
    const results = alternatives.map((run) => {
      const bb: BB = new Map(ctx.bb);
      run({ ...ctx, bb });
      return bb;
    });
    for (const k of new Set(results.flatMap((m) => [...m.keys()]))) {
      const vs = results.map((m) => m.get(k));
      const same = vs.every((v) => JSON.stringify(v) === JSON.stringify(vs[0]));
      ctx.bb.set(k, same && vs[0] ? vs[0] : UNKNOWN(`$${k}?`));
    }
  }

  /** Decides a condition when the data settles it (a literal comparison, a target being there); otherwise null. */
  evalCondition(a: Obj, ctx: Ctx): { value: boolean | null; label: string } {
    const r = this.evalPlain(a, ctx);
    if (a["invertCondition"] !== true) return r;
    return { value: r.value === null ? null : !r.value, label: `not ${r.label}` };
  }

  private evalPlain(a: Obj, ctx: Ctx): { value: boolean | null; label: string } {
    const t = shortType(a["$type"]);
    const sym = (code: unknown) => ["<", "≤", ">", "≥", "="][Number(code ?? 0)] ?? `cmp${String(code)}`;
    const cmp = (x: number, y: number, code: number): boolean | null => (code === 0 ? x < y : code === 1 ? x <= y : code === 2 ? x > y : code === 3 ? x >= y : code === 4 ? x === y : null);
    switch (t) {
      case "CompareFloat": {
        const x = this.value(a["valueA"], ctx.bb);
        const y = this.value(a["valueB"], ctx.bb);
        const code = Number(a["compare"] ?? 0);
        const label = `${describeValue(x)} ${sym(code)} ${describeValue(y)}`;
        // Only literals and runtime state: a skill value's default isn't its level value.
        const decidable = (v: CompiledValue) => (ctx.repeated ? isLiteral(v) : isKnown(v));
        if (decidable(x) && decidable(y)) return { value: cmp(x.value as number, y.value as number, code), label: `${label} (${fmt(x.value as number)} vs ${fmt(y.value as number)})` };
        return { value: null, label };
      }
      case "CheckEntityNum": {
        const label = `targets ${sym(a["compareType"])} ${String(a["minNum"] ?? 0)}`;
        // Counts the skill's targets: one enemy in this simulator (not spawned entities or teammates).
        const finder = JSON.stringify(((a["checkTarget"] ?? {}) as Obj)["selectorData"] ?? null);
        if (finder.includes("Spawned") || finder.includes("Team")) return { value: null, label };
        const v = cmp(1, Number(a["minNum"] ?? 0), Number(a["compareType"]));
        if (v !== null) this.notes.add(`CheckEntityNum decided for one enemy (${label} → ${String(v)})`);
        return { value: v, label };
      }
      case "CheckObjectTypeMatch": {
        // objectTypeMask 16 is Enemy (Endaxis's AuraTargetType table): the hit target is the enemy.
        const m = Number(a["objectTypeMask"] ?? 0);
        return { value: (m & 16) !== 0 ? true : null, label: `object type ${m}` };
      }
      case "CheckSquadInFight":
        return { value: true, label: "in fight" };
      case "CheckTargetsEqual":
        // Two target groups of one enemy are the same target.
        this.notes.add("CheckTargetsEqual decided true for one enemy");
        return { value: true, label: "same target" };
      case "OrConditionAction": {
        const parts = ((a["conditionList"] ?? []) as Sequence[]).map((seq) => this.evalSequenceCondition(seq, ctx));
        const label = parts.map((p) => p.label).join(" or ") || "or";
        if (parts.some((p) => p.value === true)) return { value: true, label };
        return { value: parts.length && parts.every((p) => p.value === false) ? false : null, label };
      }
      case "CheckMainCharacterCondition":
        return { value: null, label: "controlled" };
      case "Probablity":
        return { value: null, label: `chance ${describeValue(this.value(a["prob"], ctx.bb))}` };
      case "CheckBuffStackNumAdvanced":
      case "CheckBuffStackNum": {
        const what = this.buffRef(a["buffSettings"] ?? a["buffId"]);
        return { value: null, label: `stacks(${what}) ${sym(a["compareType"])} ${describeValue(this.value(a["value"], ctx.bb))}` };
      }
      case "CheckBuffIdInContextAdvanced": {
        const ids = ((a["buffIdList"] ?? []) as Obj[]).map((x) => describeValue(this.value(x, ctx.bb)) === "?" ? String(x["value"]) : String(x["value"]));
        return { value: null, label: `buff in context(${ids.join("|")})` };
      }
      case "CheckTagMatch":
      case "CheckDamageTag": {
        const q = (a["query"] ?? a) as Obj;
        return { value: null, label: `${t === "CheckDamageTag" ? "damage tag" : "tag"}(${((q["tags"] ?? []) as Obj[]).map((x) => this.tagName(Number(x["tagId"]))).join("|")})` };
      }
      default:
        return { value: null, label: this.summary(a) };
    }
  }

  /** A buff filter (buffSettings / buffId) as text: buff IDs, or tags (infliction tags by element). */
  private buffRef(v: unknown): string {
    if (!v || typeof v !== "object") return "?";
    const o = v as Obj;
    if (typeof o["buffId"] === "string") return o["buffId"];
    const ids = Array.isArray(o["buffIdList"]) ? (o["buffIdList"] as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const tags = (((o["tagQuery"] ?? {}) as Obj)["tags"] ?? []) as Obj[];
    return [...ids, ...tags.map((x) => this.tagName(Number(x["tagId"])))].join("|") || "?";
  }

  private tagName(id: number): string {
    const el = inflictionTags().get(id);
    return el ? `${el} infliction` : `tag ${id}`;
  }

  /** A short label for an action: its type and scalar fields. */
  summary(a: Obj): string {
    const t = shortType(a["$type"]);
    const parts: string[] = [];
    for (const [k, v] of Object.entries(a)) {
      if (["$type", "isEnable", "priorityLevel", "priorityOffset", "serverActionIndex"].includes(k)) continue;
      if (typeof v === "number" || typeof v === "string") parts.push(`${k}=${v}`);
      else if (v && typeof v === "object" && "useBlackboardKey" in (v as Obj)) {
        const d = describeValue(this.value(v, new Map()));
        if (d !== "0" && d !== "?") parts.push(`${k}=${(v as Obj)["useBlackboardKey"] ? `$${String((v as Obj)["blackboardKey"])}` : d}`);
      } else if (v && typeof v === "object" && Array.isArray((v as Obj)["buffIdList"])) parts.push(`${k}=${JSON.stringify((v as Obj)["buffIdList"])}`);
      else if (Array.isArray(v) && v.every((x) => typeof x === "string")) parts.push(`${k}=${v.join("|")}`);
    }
    return parts.length ? `${t}(${parts.join(", ")})` : t;
  }

  private exec(a: Obj, start: number, end: number, ctx: Ctx) {
    const t = shortType(a["$type"]);
    switch (t) {
      case "DamageAction":
        return this.damage(a, start, ctx);
      case "SpellInfliction": {
        const el = INFLICTION[Number(a["inflictionType"])];
        if (el) this.effects.push({ ...this.place(ctx, start), landing: null, kind: "infliction", element: el, isExtra: a["isExtra"] === true });
        return;
      }
      case "ForceSpellStatusAction":
        this.effects.push({ ...this.place(ctx, start), landing: null, kind: "forcedReaction", status: FORCED_STATUS[Number(a["spellStatusType"])] ?? null, source: `ForceSpellStatusAction spellStatusType ${String(a["spellStatusType"])}`, level: this.value(a["count"], ctx.bb), duration: null });
        return;
      case "FinishBuffAdvanced":
      case "FinishBuffAction":
        return this.finishBuff(a, start, ctx);
      case "ObtainCostAction": {
        const type = Number(a["costType"]);
        if (type !== 0 && type !== 1) return;
        const coef = this.value(a["coefficient"], ctx.bb);
        this.costs.push({ ...this.place(ctx, start), costType: type, value: this.value(a["costValue"], ctx.bb), coefficient: coef.value ?? 1, isPercent: a["isPercentValue"] === true, landing: null });
        return;
      }
      case "CreateBuffAction":
        return this.createBuff(a, start, ctx);
      case "CreateGlobalBuffAction":
        this.notes.add(`${ctx.file}@${start}: CreateGlobalBuffAction ${JSON.stringify((a["globalBuffs"] ?? []) as unknown[]).slice(0, 120)} not followed`);
        return;
      case "LaunchProjectile":
        return this.projectile(a, start, ctx);
      case "SpawnAbilityEntity":
        return this.entity(a, start, ctx);
      case "CastSkill":
        return this.castSkill(a, start, ctx);
      case "IfElseAction": {
        const cond = (a["conditionAction"] ?? {}) as Sequence;
        const r = this.evalSequenceCondition(cond, ctx);
        if (r.value === true) this.execSeq(a["succeedActions"] as Sequence, start, end, ctx);
        else if (r.value === false) this.execSeq(a["failActions"] as Sequence, start, end, ctx);
        else
          this.fork(ctx, [
            (c) => this.execSeq(a["succeedActions"] as Sequence, start, end, { ...c, branch: [...c.branch, `if ${r.label}`] }),
            (c) => this.execSeq(a["failActions"] as Sequence, start, end, { ...c, branch: [...c.branch, `if not ${r.label}`] }),
          ]);
        return;
      }
      case "SwitchAction": {
        const choice = this.value(a["choice"], ctx.bb);
        const known = ctx.repeated ? isLiteral(choice) : isKnown(choice);
        const label = describeValue(choice);
        const options = (a["options"] ?? []) as Obj[];
        if (known) {
          for (const o of options) if (this.value(o["value"], ctx.bb).value === choice.value) this.execSeq(o["actionData"] as Sequence, start, end, ctx);
        } else {
          const runs = options.map((o) => (c: Ctx) => this.execSeq(o["actionData"] as Sequence, start, end, { ...c, branch: [...c.branch, `switch ${label} = ${String(this.value(o["value"], ctx.bb).value)}`] }));
          this.fork(ctx, [...runs, () => {}]);
        }
        if (known) this.notes.add(`${ctx.file}@${start}: Switch on ${String((a["choice"] as Obj)["blackboardKey"] ?? "literal")} = ${String(choice.value)} (from the data's own values)`);
        return;
      }
      case "ForEachAction":
        // One enemy: every ForEach body runs once.
        this.execSeq(a["action"] as Sequence, start, end, ctx);
        return;
      case "DoOnceAction":
        this.execSeq(a["sequenceActionData"] as Sequence, start, end, ctx);
        return;
      case "ChannelingAction":
      case "ChannelingActionV2":
      case "TickIntervalAction":
        return this.ticks(a, t, start, end, ctx);
      case "JumpToAction": {
        const r = this.evalSequenceCondition((a["conditionAction"] ?? {}) as Sequence, ctx);
        this.jumps.push({ ...this.place(ctx, start), destFrame: Number(a["destFrame"]), condition: ((a["conditionAction"] as Sequence | undefined)?.actionData as unknown[] | undefined)?.length ? r.label : "always" });
        return;
      }
      case "SimpleCalcBBAction": {
        if (typeof a["key"] !== "string") return;
        ctx.bb.set(a["key"], this.calc(Number(a["operation"]), this.value(a["value1"], ctx.bb), this.value(a["value2"], ctx.bb), ctx.repeated));
        return;
      }
      case "ModifyDynamicBlackboard": {
        if (typeof a["key"] !== "string") return;
        const key = a["key"];
        const v = this.value(a["value"], ctx.bb);
        if (a["directValue"] !== true) ctx.bb.set(key, UNKNOWN(this.summary(a)));
        else ctx.bb.set(key, Number(a["operation"] ?? 0) === 0 ? v : this.calc(Number(a["operation"]), ctx.bb.get(key) ?? UNKNOWN(`$${key}`), v, ctx.repeated));
        return;
      }
      case "RefrainObtainUsp":
        if (ctx.buffSpan) this.blocks.push({ ...this.place(ctx, ctx.buffSpan.from), buff: ctx.buffSpan.buff, until: ctx.buffSpan.to });
        else this.blocks.push({ ...this.place(ctx, start), buff: null, until: end });
        return;
      case "EventListenerAction":
        for (const m of (a["abilityActionMap"] ?? []) as Obj[]) this.walkSequences(m["actions"], start, end, { ...ctx, repeated: true, branch: [...ctx.branch, `on ability event ${String(m["abilityEvent"])}`] });
        return;
      default:
        return this.generic(a, t, start, end, ctx);
    }
  }

  /** A blackboard key an action not modelled here writes (a stored distance, a buff's value, a random number) becomes unknown. */
  private invalidate(a: Obj, t: string, ctx: Ctx) {
    if (t === "DebugPrintAction") return;
    for (const f of ["key", "bbKey", "storeKey", "desiredKey", "targetBlackboardKey", "saveKey", "blackboardKey"]) {
      const k = a[f];
      if (typeof k === "string" && k) ctx.bb.set(k, UNKNOWN(`${t}→${k}`));
    }
  }

  /** Any other action holding sequences: walked, labelled with where they sit. */
  private generic(a: Obj, t: string, start: number, end: number, ctx: Ctx) {
    this.invalidate(a, t, ctx);
    for (const [k, v] of Object.entries(a)) {
      const seqs = Array.isArray(v) ? v : [v];
      for (const s of seqs) {
        if (s && typeof s === "object" && Array.isArray((s as Obj)["actionData"])) {
          const before = this.landings.length;
          this.execSeq(s as Sequence, start, end, { ...ctx, branch: [...ctx.branch, `${t}.${k}`] });
          if (this.landings.length > before) this.notes.add(`${ctx.file}@${start}: damage inside ${t}.${k}, timing not interpreted`);
        }
      }
    }
  }

  private evalSequenceCondition(seq: Sequence, ctx: Ctx): { value: boolean | null; label: string } {
    const parts = ((seq.actionData ?? []) as Obj[]).filter((x) => x["isEnable"] !== false && isConditionType(x["$type"])).map((x) => this.evalCondition(x, ctx));
    if (parts.length === 0) return { value: true, label: "always" };
    if (parts.some((p) => p.value === false)) return { value: false, label: parts.map((p) => p.label).join(" and ") };
    const open = parts.filter((p) => p.value === null);
    return { value: open.length ? null : true, label: (open.length ? open : parts).map((p) => p.label).join(" and ") };
  }

  private damage(a: Obj, frame: number, ctx: Ctx) {
    for (const u of (a["damageUnits"] ?? []) as Obj[]) {
      if (u["damageAttributeType"] !== 0) continue; // 1 = poise (stagger) damage
      // The scale is on the unit's atkScale or on an AtkScaleCalculation; the other one is an unused 0.
      const calc = (u["atkCalculation"] ?? null) as Obj | null;
      const fields = [calc && typeof calc["atkScale"] === "object" ? calc["atkScale"] : undefined, u["atkScale"]].filter((x): x is Obj => !!x && typeof x === "object");
      const used = fields.find((f) => f["useBlackboardKey"] === true) ?? fields.find((f) => typeof f["value"] === "number" && f["value"] !== 0) ?? fields[0];
      const scale = this.value(used, ctx.bb);
      if (calc && shortType(calc["$type"]) !== "AtkScaleCalculation") this.notes.add(`${ctx.file}@${frame}: damage by ${shortType(calc["$type"])} (not ATK × scale)`);
      const mask = typeof u["damageDecorateMask"] === "number" ? u["damageDecorateMask"] : 0;
      const kind = (Object.entries(DECORATE_BITS) as [string, number][]).find(([k, bit]) => k !== "finalStrike" && (mask & bit) !== 0)?.[0] as ActionKind | undefined;
      this.landings.push({
        ...this.place(ctx, frame),
        scale,
        decorateMask: mask,
        kind: kind ?? null,
        finalStrike: Math.floor(mask / DECORATE_BITS.finalStrike) % 2 === 1,
        damageType: typeof u["damageType"] === "number" ? u["damageType"] : -1,
      });
    }
  }

  private finishBuff(a: Obj, frame: number, ctx: Ctx) {
    const settings = (a["buffSettings"] ?? {}) as Obj;
    const tags = (((settings["tagQuery"] ?? {}) as Obj)["tags"] ?? []) as Obj[];
    const ids = tags.map((x) => Number(x["tagId"])).filter((x) => Number.isFinite(x));
    const els = ids.map((id) => inflictionTags().get(id)).filter((x): x is InflictionElement => !!x);
    if (Number(settings["checkType"]) !== 1 || els.length === 0) return;
    const all = a["finishAll"] === true;
    this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "consumeInfliction", element: els[0] ?? null, layers: all ? null : this.value(a["finishLayerCnt"], ctx.bb), tags: ids });
  }

  /** The child blackboard for a projectile, entity or cast skill: its own defaults, then what the parent passes. */
  private childBB(file: string, j: Obj, parent: BB, inherit: boolean, pairs: unknown): BB {
    const bb = this.defaults(file, j);
    if (inherit) for (const [k, v] of parent) bb.set(k, v);
    for (const p of (Array.isArray(pairs) ? pairs : []) as Obj[]) {
      if (typeof p["targetKey"] !== "string") continue;
      bb.set(p["targetKey"], p["useDirectValue"] === true ? LITERAL(Number(p["numericValue"])) : (typeof p["inputValueKey"] === "string" ? parent.get(p["inputValueKey"]) : undefined) ?? UNKNOWN(`$${String(p["inputValueKey"])}`));
    }
    return bb;
  }

  private enter(ctx: Ctx, file: string, how: string): Ctx | null {
    if (ctx.stack.includes(file) || ctx.stack.length > 12) {
      this.notes.add(`${how} → ${file}: not followed again (cycle)`);
      return null;
    }
    if (!this.files.includes(file)) this.files.push(file);
    return { ...ctx, file, detached: true, via: [...ctx.via, `${how} → ${file}`], stack: [...ctx.stack, file] };
  }

  private skillFile(file: string, how: string): Obj | null {
    if (!isSkillFileListed(file)) {
      this.notes.add(`${how} → ${file}: SkillData file not listed in packages/data/tables.json`);
      return null;
    }
    if (!existsSync(skillFilePath(file))) {
      this.notes.add(`${how} → ${file}: no such SkillData file`);
      return null;
    }
    return readJson(skillFilePath(file));
  }

  private projectile(a: Obj, frame: number, ctx: Ctx) {
    const routes: [string, string, string][] = [
      ["castSkillOnHit", "projectileSkillId", "hit"],
      ["castSkillOnReach", "skillIdOnReach", "reach"],
      ["castSkillOnFinish", "skillIdOnFinish", "finish"],
      ["castSkillOnLaunch", "skillIdOnLaunch", "launch"],
      ["castSkillOnBlock", "skillIdOnBlock", "block"],
    ];
    const has = (flag: string, field: string) => a[flag] === true && typeof a[field] === "string" && a[field] !== "";
    // A projectile that also casts on hit casts its block skill only when something blocks it; one that casts only on block (Liino's notes) deals its damage that way.
    const blockIsAlternative = has("castSkillOnHit", "projectileSkillId");
    for (const [flag, field, label] of routes) {
      if (!has(flag, field)) continue;
      const file = a[field] as string;
      const how = `LaunchProjectile@${frame} ${label}`;
      const j = this.skillFile(file, how);
      if (!j) continue;
      const c = this.enter(ctx, file, how);
      if (!c) continue;
      const branch = label === "block" && blockIsAlternative ? [...c.branch, `if ${String(a["projectileId"])} is blocked`] : c.branch;
      this.walkSkillFile(j, frame, { ...c, branch, bb: this.childBB(file, j, ctx.bb, a["assignBlackboard"] === true, a["assignPairs"]) });
    }
  }

  private entity(a: Obj, frame: number, ctx: Ctx) {
    const file = a["abilityEntitySkillId"];
    if (typeof file !== "string" || !file) return;
    const how = `SpawnAbilityEntity@${frame} ${String(a["abilityEntityId"])}`;
    const j = this.skillFile(file, how);
    if (!j) return;
    const c = this.enter(ctx, file, how);
    if (!c) return;
    this.walkSkillFile(j, frame, { ...c, bb: this.childBB(file, j, ctx.bb, a["assignBlackboard"] === true || a["assignEntityBlackboard"] === true, a["assignPairs"]) });
  }

  private castSkill(a: Obj, frame: number, ctx: Ctx) {
    const sid = (a["skillId"] ?? {}) as Obj;
    const file = sid["useBlackboardKey"] === true ? null : sid["value"];
    if (typeof file !== "string") {
      this.notes.add(`${ctx.file}@${frame}: CastSkill of a skill named in the blackboard (not followed)`);
      return;
    }
    const follow = file !== this.root && (this.options.followCast?.(file) ?? false);
    this.casts.push({ ...this.place(ctx, frame), skillId: file, followed: follow });
    if (!follow) return;
    const how = `CastSkill@${frame}`;
    const j = this.skillFile(file, how);
    if (!j) return;
    const c = this.enter(ctx, file, how);
    if (!c) return;
    this.walkSkillFile(j, frame, { ...c, bb: this.childBB(file, j, ctx.bb, false, []) });
  }

  private createBuff(a: Obj, frame: number, ctx: Ctx) {
    for (const entry of (a["buffs"] ?? []) as Obj[]) {
      const id = entry["buffId"];
      if (entry["readIdFromBlackboard"] === true || typeof id !== "string") {
        this.notes.add(`${ctx.file}@${frame}: CreateBuff of a buff named in the blackboard (not followed)`);
        continue;
      }
      const assigned: BB = new Map();
      if (entry["assignBlackboard"] === true) {
        for (const it of (entry["assignItems"] ?? []) as Obj[]) {
          if (typeof it["targetKey"] !== "string") continue;
          assigned.set(it["targetKey"], it["useDirectValue"] === true ? LITERAL(Number(it["numericValue"])) : (typeof it["inputValueKey"] === "string" ? ctx.bb.get(it["inputValueKey"]) : undefined) ?? UNKNOWN(`$${String(it["inputValueKey"])}`));
        }
      }
      if (id === "buff_common_obtain_ultimate_sp") {
        const ratio = assigned.get("ratio");
        this.teamEnergy.push({ ...this.place(ctx, frame), ratio: ratio === undefined ? 1 : isLiteral(ratio) ? ratio.value : null });
        continue;
      }
      const reaction = /^buff_common_([a-z]+)_([a-z]+)_(?:([a-z]+)_)?triggered/.exec(id);
      if (reaction && reaction[1] === reaction[2]) {
        const word = reaction[3];
        if (word && STATUS_WORD[word]) this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "forcedReaction", status: STATUS_WORD[word] ?? null, source: id, level: assigned.get("count") ?? null, duration: assigned.get("duration") ?? null });
        else this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "burst", element: (INFLICTION as readonly string[]).includes(reaction[1] ?? "") ? (reaction[1] as InflictionElement) : null, source: id });
        continue;
      }
      if (id.startsWith("buff_common_")) continue; // shared mechanics (reactions, immunity, …): not the skill's own
      if (!isBuffFileListed(id) || !existsSync(buffPath(id))) {
        this.notes.add(`${ctx.file}@${frame}: buff ${id} ${isBuffFileListed(id) ? "has no BuffData file" : "isn't listed in packages/data/tables.json"}`);
        continue;
      }
      const c = this.enter(ctx, id, `CreateBuff@${frame}`);
      if (!c) continue;
      const j = readJson(buffPath(id));
      const bb = this.defaults(id, j);
      for (const [k, v] of assigned) bb.set(k, v);
      this.walkBuff(id, j, frame, { ...c, bb });
    }
  }

  private walkBuff(id: string, j: Obj, from: number, ctx: Ctx) {
    const dur = this.value(j["duration"], ctx.bb);
    const seconds = dur.value !== null && !dur.expr && dur.value > 0 ? dur.value : null;
    const to = seconds === null ? null : from + toFrame(seconds);
    const c: Ctx = { ...ctx, buffSpan: { buff: id, from, to } };
    this.walkTimeline((j["timelineActions"] ?? []) as Obj[], from, c);
    for (const e of (j["buffEventAction"] ?? []) as Obj[]) {
      const ev = Number(e["buffEvent"]);
      // BuffData buffEvent codes (Endaxis's table): 0 start, 1 trigger, 2 finish, 3 enable, 5 during enable, 10 finished early.
      if (ev === 0 || ev === 3 || ev === 5) this.walkSequences(e["actions"], from, to ?? from, c);
      else if (ev === 1) {
        const interval = this.value(j["triggerInterval"], c.bb).value ?? 0;
        const max = this.value(j["maxTriggerCnt"], c.bb).value ?? 0;
        if (interval <= 0) {
          this.walkSequences(e["actions"], from, from, { ...c, branch: [...c.branch, `on ${id} trigger (no interval)`] });
          continue;
        }
        const first = j["waitFirstTriggerInterval"] === true ? 1 : 0;
        let n = 0;
        for (let k = first; ; k++) {
          const f = from + toFrame(k * interval);
          if ((to !== null && f > to) || (max > 0 && n >= max) || n >= 200) break;
          if (to === null && max <= 0 && n >= 1) {
            this.notes.add(`${id}: triggers every ${fmt(interval)} s until it ends (only the first is listed)`);
            break;
          }
          this.walkSequences(e["actions"], f, f, c);
          n++;
        }
      } else if (ev === 2) {
        if (to !== null) this.walkSequences(e["actions"], to, to, c);
        else this.walkSequences(e["actions"], from, from, { ...c, branch: [...c.branch, `when ${id} ends`] });
      } else this.walkSequences(e["actions"], from, from, { ...c, repeated: true, branch: [...c.branch, `on ${id} event ${ev}`] });
    }
    for (const e of (j["abilityEventAction"] ?? []) as Obj[]) this.walkSequences(e["actions"], from, from, { ...c, repeated: true, branch: [...c.branch, `on ability event ${String(e["abilityEvent"])}`] });
    for (const e of (j["igniteEventAction"] ?? []) as Obj[]) this.walkSequences(e["actions"], from, from, { ...c, repeated: true, branch: [...c.branch, `on ignite ${String(e["igniteType"])}`] });
  }

  private ticks(a: Obj, t: string, start: number, end: number, ctx: Ctx) {
    const read = (f: unknown) => this.value(f, ctx.bb).value ?? 0;
    // A channel ticks every triggerInterval but hits one target at most every targetTriggerInterval: one enemy sees the slower.
    const interval =
      t === "TickIntervalAction"
        ? read(a["useTickIntervalBlackboardKey"] === true ? { useBlackboardKey: true, blackboardKey: a["tickIntervalBlackboardKey"] } : a["tickInterval"])
        : Math.max(read(a["triggerInterval"]), read(a["targetTriggerInterval"]));
    const body = (a["actionOnTick"] ?? a["action"]) as Sequence | undefined;
    const perTarget = typeof a["maxCountPerTarget"] === "number" && a["maxCountPerTarget"] > 0 ? a["maxCountPerTarget"] : Infinity;
    const before = this.landings.length;
    let n = 0;
    for (let k = 0; n < perTarget && n < 600; k++) {
      const f = start + (interval > 0 ? toFrame(k * interval) : k);
      if (f > end || (k > 0 && interval <= 0 && a["executeEachFrame"] !== true)) break;
      this.execSeq(body, f, f, ctx);
      n++;
    }
    if (this.landings.length > before) this.notes.add(`${ctx.file}@${start}: ${t} ticks from frame ${start} every ${fmt(interval)} s to ${end}${Number.isFinite(perTarget) ? `, at most ${perTarget} per target` : ""} (first tick assumed at the start)`);
  }
}

/** Compiles one skill (a SkillData ID); null when the game has no file for it. */
export function compileSkill(skillId: string, options: CompileOptions = {}): CompiledSkill | null {
  return new Compiler(skillId, options).run();
}

/** A compiled value as text: `key`, `key × 0.5`, a literal, or the expression. */
export function formatCompiledValue(v: CompiledValue): string {
  return describeValue(v);
}
