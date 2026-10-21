// Compiles an operator skill's SkillData file, and the projectile, ability
// entity and buff files it reaches, into the plain facts a kit hand-writes
// today (docs/kit-abstractions.md section 1): every damage landing with its
// frame from the skill's start, scale key, literal factor (SimpleCalcBB,
// BreakingAttackCalculation's multiplier), element, stagger (poise units),
// damage-unit bonuses, decorate mask and log event key; inflictions, forced
// reactions, physical statuses and partial consumption next to it; ultimate
// energy and SP grants; energy blocks; the team-energy frame; the buffs it
// creates and on whom; and the jumps and branches it can't decide.
//
// It reads the action graph without running the game: one enemy, every
// ForEach once, IfElse / Switch conditions decided only when the data
// settles them (a literal comparison, runtime state at its start value,
// "there is a target"), otherwise every side is kept and labelled in
// `branch` (and in `steps`, which say which alternatives exclude each other
// and, where the compiler can, the condition as a kit predicate). JumpToAction
// is reported, never followed. Event handlers (ability events, a buff's
// events) run once at their buff's or entity's start, so their frames are
// lower bounds, labelled in `branch`. Frames are 30 FPS; projectile travel
// isn't in the data, so a projectile's hits use its launch frame. Enum codes
// it relies on (buffEvent, compare, blackboard operations) are the ones
// Endaxis documents; shared reaction buffs (buff_common_*) are recognised by
// name, not followed.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Element, PhysicalStatus, Predicate, Zone } from "@efsim/engine";
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
 * DamageAction damageUnits[].damageType → element: 0 Physical, 2 Heat, 3
 * Electric, 4 Cryo, 6 Nature, as every kit hit with a log agrees (8 is Fixed
 * DMG, not an element). Other codes don't occur in operator files.
 */
const DAMAGE_ELEMENT: Readonly<Record<number, Element>> = { 0: "physical", 2: "fire", 3: "pulse", 4: "cryst", 6: "natural" };
/**
 * ForceSpellStatusAction spellStatusType → status. Assumed to follow the
 * inflictionType order (the batch's only case, Liino's ultimate bomb, is 1 and
 * forces Electrification per its description).
 */
const FORCED_STATUS: readonly StatusName[] = ["combustion", "electrification", "solidification", "corrosion"];
/** Status words in the shared reaction buffs a skill creates to force a reaction (buff_common_fire_fire_burning_triggered). */
const STATUS_WORD: Readonly<Record<string, StatusName>> = { burning: "combustion", conduct: "electrification", frozen: "solidification", corrupt: "corrosion" };
/** The physical-status actions: AirborneAction is Lift, KnockDownAction Knock Down, CrushAction Crush, FractureAction Breach. */
const PHYSICAL_ACTION: Readonly<Record<string, PhysicalStatus>> = { AirborneAction: "lift", KnockDownAction: "knockdown", CrushAction: "crush", FractureAction: "breach" };
/** The shared buff that adds a Vulnerable stack (CreateBuff count = stacks). */
const VULNERABLE_BUFF = "buff_physical_no_guard";

/** A blackboard value as the compiler tracks it: a product of keys × a literal factor (no keys: a literal), with its value when known. */
export interface CompiledValue {
  /** The blackboard keys multiplied (a kit hit's `scale`); empty for a literal. */
  readonly keys: readonly string[];
  /** Per key, the file whose blackboard defines it (the compiled skill's own, unless a child file's key wasn't passed down). */
  readonly origins: readonly string[];
  /** Literal multiplier applied on the way (SimpleCalcBB × / ÷, BreakingAttackCalculation's multiplier). */
  readonly factor: number;
  /** Its value, when known: the level value (CompileOptions.values) or the file's default for keys, the literal otherwise. */
  readonly value: number | null;
  /** Set when the value is an expression the compiler doesn't reduce to key × factor. */
  readonly expr?: string;
  /** The key is runtime state (SkillData blackboard isDynamic, e.g. a hit counter): its default is its starting value. */
  readonly dynamic?: true;
}

/**
 * One undecided condition on the way to a fact. Facts on different `alt`s
 * of one `site` exclude each other (the sides of an IfElse, the options of a
 * Switch); a gate (a condition among a sequence's actions) has only alt 0.
 */
export interface BranchStep {
  readonly label: string;
  /** The IfElse, Switch or gating condition (the same number every time the walk passes it), or null for what isn't a choice (an event handler, a blocked projectile). */
  readonly site: number | null;
  /** IfElse: 0 the succeed side, 1 the fail side; Switch: the option's index; a gate: 0. */
  readonly alt: number;
  /** The condition as a kit predicate, when the compiler can say it (controlled, a talent's or potential's attached buff); null otherwise. */
  readonly pred: Predicate | null;
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
  /** The same conditions, with what excludes what and their predicates (one per `branch` entry). */
  readonly steps: readonly BranchStep[];
  /** How the file was reached, e.g. `LaunchProjectile@12 hit → chr_0016_laevat_attack_5_projhit`. */
  readonly via: readonly string[];
}

/** Stagger a damage landing deals (its DamageAction's poise unit, damageAttributeType 1). */
export interface CompiledPoise {
  readonly value: CompiledValue;
  /** onlyEnableForMainChar: it counts only while the operator is controlled. */
  readonly controlledOnly: boolean;
}

export interface CompiledLanding extends Placement {
  readonly scale: CompiledValue;
  readonly decorateMask: number;
  readonly kind: ActionKind | null;
  readonly finalStrike: boolean;
  /** damageUnits[].damageType (the element / physical type code). */
  readonly damageType: number;
  /** The damage's element (from damageType), or null for Fixed DMG and unknown codes. */
  readonly element: Element | null;
  /** Its DamageAction's stagger, or null when it deals none. */
  readonly poise: CompiledPoise | null;
  /** Bonuses its damage unit's processors give it (InstantModifyAttribute crit rate, DamageScaleProcessor zones). */
  readonly bonuses: readonly { readonly zone: Zone; readonly value: CompiledValue }[];
}

/** What a skill does to the enemy's arts and physical state; `landing` is the landing it goes with (as for CompiledCost), or null. */
export type CompiledEffect = Placement & { landing: number | null } & (
  | { readonly kind: "infliction"; readonly element: InflictionElement; readonly isExtra: boolean }
  | {
      readonly kind: "forcedReaction";
      readonly status: StatusName | null;
      readonly source: string;
      readonly level: CompiledValue | null;
      readonly duration: CompiledValue | null;
      /** The created status buff's other assigned keys (extra_scaling, extra_duration, …), by the buff's key. */
      readonly assigned: Readonly<Record<string, CompiledValue>>;
    }
  | { readonly kind: "burst"; readonly element: InflictionElement | null; readonly source: string }
  | { readonly kind: "consumeInfliction"; readonly element: InflictionElement | null; readonly layers: CompiledValue | null; readonly tags: readonly number[] }
  | {
      readonly kind: "physicalStatus";
      readonly status: PhysicalStatus;
      /** forceAirborne / forceKnockDown: it lands without Vulnerable. */
      readonly forced: boolean;
      /** CrushAction damageMultiplier, or null for the others. */
      readonly multiplier: CompiledValue | null;
      readonly isExtra: boolean;
    }
  | { readonly kind: "vulnerable"; readonly stacks: CompiledValue }
);

/** A HealAction: whom it heals and the skill kind its heal tag names, with the landing it goes with (as for CompiledCost). */
export interface CompiledHeal extends Placement {
  /** The controlled operator (a team finder with MainCharacterValidator), the team, the healer, or not known. */
  readonly target: "self" | "controlled" | "team" | "unknown";
  readonly healKind: ActionKind | null;
  readonly landing: number | null;
}

/** HealAction healTags → skill kind (the tags heal triggers check, CheckHealTag). */
const HEAL_TAGS: Readonly<Record<number, ActionKind>> = { [-320297214]: "battle", [-1517158118]: "combo", [-1499119779]: "ultimate" };

/** A DamageAction with stagger and no damage. */
export interface CompiledPoiseLanding extends Placement {
  readonly poise: CompiledPoise;
  readonly landing: number | null;
}

export interface CompiledCost extends Placement {
  /** ObtainCostAction costType: 0 ultimate energy, 1 SP. */
  readonly costType: 0 | 1;
  readonly value: CompiledValue;
  readonly coefficient: number;
  readonly isPercent: boolean;
  /** ObtainCostAction atbOnlyMainChar (SP): granted only while the operator is controlled. */
  readonly controlledOnly: boolean;
  /** It comes before its landing's DamageAction in the same tick (an SP trigger then sees that hit). */
  readonly beforeDamage: boolean;
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
  /** When it's taken as a kit predicate (the conditions on the way here and its own), or null when one of them can't be said or there are none. */
  readonly pred: Predicate | null;
  /** Taken every time (no condition on the way, none of its own). */
  readonly always: boolean;
}

export interface CompiledCast extends Placement {
  readonly skillId: string;
  readonly followed: boolean;
}

/** On whom a created buff goes: the operator, the enemy (a target group of enemies), the context's target (the enemy hit, in a hit or projectile), the team, an aura's members, or not known. */
export type BuffTarget = "self" | "enemy" | "target" | "team" | "aura" | "unknown";

/** A buff the skill creates (CreateBuff or an AuraAction's buffInput), other than the shared buff_common_* ones. */
export interface CompiledBuff extends Placement {
  readonly buff: string;
  readonly target: BuffTarget;
  /** Its duration in seconds (BuffData, with assigned keys), or null when it lasts until ended or isn't known. */
  readonly seconds: number | null;
  /** What it does, in short (damage modifiers, attribute modifiers, susceptibility), from its BuffData; empty when it has none of these. */
  readonly summary: string;
  /**
   * Created in the skill's own timeline by a CreateBuffAction with
   * autoFinishByAction: it ends at its clip's end frame (or with the cast).
   * A kit writes a clip end before the skill's end as the application's
   * `untilFrame`.
   */
  readonly untilFrame?: number;
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
  /** DamageActions that deal only stagger (all their units damageAttributeType 1), each with the landing at its frame it goes with (as for CompiledCost), or null. */
  readonly poiseOnly: readonly CompiledPoiseLanding[];
  readonly heals: readonly CompiledHeal[];
  /** CreateBuff buff_common_obtain_ultimate_sp (the team's energy for the SP spent): where, and its `ratio` of it (1 unassigned, null unknown). */
  readonly teamEnergy: readonly TeamEnergyPart[];
  readonly jumps: readonly CompiledJump[];
  readonly casts: readonly CompiledCast[];
  readonly buffs: readonly CompiledBuff[];
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
  /**
   * Buffs a talent or potential attaches to the operator, with the kit
   * predicate that holds while it's attached ({talentAtLeast: [0, 1]},
   * {potentialAtLeast: 3}): a CheckBuffStackNum on one of them is that
   * predicate.
   */
  readonly attachedBuffs?: ReadonlyMap<string, Predicate>;
  /**
   * Keys of the compiled skill that are 0 unless a talent or potential sets
   * them (Wulfgard's `talent2`), with the predicate under which they're set
   * and the smallest and largest values they're set to: comparing one with 0 is that
   * predicate.
   */
  readonly valueGates?: ReadonlyMap<string, { readonly pred: Predicate; readonly min: number; readonly max: number }>;
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
const not = (p: Predicate | null): Predicate | null => (p === null ? null : "not" in p ? p.not : { not: p });
/** The conjunction of predicates; null when any is unknown. */
export function allOf(ps: readonly (Predicate | null)[]): Predicate | null {
  if (ps.some((p) => p === null)) return null;
  const known = ps as readonly Predicate[];
  return known.length === 1 ? (known[0] as Predicate) : { all: [...known] };
}

/** A verdict negated when `yes` (invertCondition, a NotNextCheckAction before it). */
const negated = (r: Verdict, yes: boolean): Verdict => (yes ? { value: r.value === null ? null : !r.value, label: `not ${r.label}`, pred: not(r.pred) } : r);

type BB = Map<string, CompiledValue>;
/** What a FindTargetAction's target group holds. */
type GroupKind = "enemy" | "team" | "other";

interface Ctx {
  readonly file: string;
  readonly detached: boolean;
  readonly bb: BB;
  readonly steps: readonly BranchStep[];
  readonly via: readonly string[];
  /** Files on the way here (cycle guard). */
  readonly stack: readonly string[];
  /** Target groups found in this file so far (FindTargetAction targetGroupKey). */
  readonly groups: Map<string, GroupKind>;
  /** The buff's life when walking a buff file: RefrainObtainUsp in it blocks for that long. */
  readonly buffSpan?: { readonly buff: string; readonly from: number; readonly to: number | null };
  /** Inside an event handler, which may run any number of times: runtime counters aren't at their start value. */
  readonly repeated?: true;
  /** After a TargetPostProcessorAction ExcludeTarget on the context's target: damage and statuses go to other enemies only (none with one enemy). */
  readonly othersOnly?: true;
  /** In a buff's start event: whom the buff is on (a CreateBuff there on the context's target goes to it). */
  readonly holder?: BuffTarget;
}

interface Sequence {
  readonly actionData?: unknown;
}

interface Verdict {
  readonly value: boolean | null;
  readonly label: string;
  readonly pred: Predicate | null;
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

/** A finder's group: HitBoxFinder factionTarget 1 and the enemy finders are enemies, the team finders and factionTarget 0 the team. */
function groupKind(finder: Obj | null): GroupKind {
  const t = shortType(finder?.["$type"]);
  if (t === "Selector" && finder) {
    const name = String(finder["$type"]).split(",")[0]?.split(".").pop() ?? "";
    if (/^Selector\+(AllEnemyFinder|MainTargetFinder|InFightEnemyFinder|SmartTargetFinder)/.test(name)) return "enemy";
    if (/^Selector\+CharacterTeamFinder/.test(name)) return "team";
    if (/^Selector\+HitBoxFinder/.test(name)) return finder["factionTarget"] === 1 ? "enemy" : finder["factionTarget"] === 0 ? "team" : "other";
  }
  return "other";
}

class Compiler {
  readonly landings: CompiledLanding[] = [];
  readonly effects: CompiledEffect[] = [];
  readonly costs: CompiledCost[] = [];
  readonly blocks: EnergyBlock[] = [];
  readonly poises: CompiledPoiseLanding[] = [];
  readonly heals: CompiledHeal[] = [];
  /** Walk order of costs and landings (by index), to tell an SP grant before its hit's DamageAction from one after. */
  private readonly order = new Map<number, number>();
  private readonly landingOrder = new Map<number, number>();
  private ticket = 0;
  readonly teamEnergy: TeamEnergyPart[] = [];
  readonly jumps: CompiledJump[] = [];
  readonly casts: CompiledCast[] = [];
  readonly buffs: CompiledBuff[] = [];
  readonly notes = new Set<string>();
  readonly files: string[] = [];
  /** The choice actions met, numbered in the order first walked (BranchStep.site). */
  private readonly sites = new WeakMap<object, number>();
  private siteCount = 0;

  readonly root: string;
  readonly options: CompileOptions;

  constructor(root: string, options: CompileOptions) {
    this.root = root;
    this.options = options;
  }

  private site(a: object): number {
    let n = this.sites.get(a);
    if (n === undefined) {
      n = this.siteCount++;
      this.sites.set(a, n);
    }
    return n;
  }

  private place(ctx: Ctx, frame: number): Placement {
    return { frame, file: ctx.file, detached: ctx.detached, branch: ctx.steps.map((s) => s.label), steps: ctx.steps, via: ctx.via };
  }

  /** The context one undecided condition further in. */
  private sub(ctx: Ctx, label: string, site: number | null = null, alt = 0, pred: Predicate | null = null): Ctx {
    return { ...ctx, steps: [...ctx.steps, { label, site, alt, pred }] };
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
    const ctx: Ctx = { file: this.root, detached: false, bb, steps: [], via: [], stack: [this.root], groups: new Map() };
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
      poiseOnly: this.poises,
      heals: this.heals,
      teamEnergy: this.teamEnergy,
      jumps: this.jumps,
      casts: this.casts,
      buffs: this.buffs,
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
    for (let i = 0; i < this.poises.length; i++) {
      const p = this.poises[i] as CompiledPoiseLanding;
      this.poises[i] = { ...p, landing: find(p) };
    }
    for (let i = 0; i < this.heals.length; i++) {
      const h = this.heals[i] as CompiledHeal;
      this.heals[i] = { ...h, landing: find(h) };
    }
    for (let i = 0; i < this.costs.length; i++) {
      const c = this.costs[i] as CompiledCost;
      const landing = find(c);
      const l = landing === null ? undefined : this.landings[landing];
      // Before the DamageAction of a landing in the same file at the same frame: walked first.
      const beforeDamage = !!l && l.file === c.file && (this.order.get(i) ?? 0) < (this.landingOrder.get(landing as number) ?? 0);
      this.costs[i] = { ...c, landing, beforeDamage };
    }
  }

  private walkSkillFile(j: Obj, base: number, ctx: Ctx) {
    const group = (j["actionGroupData"] ?? {}) as Obj;
    this.walkTimeline((group["timelineActions"] ?? []) as Obj[], base, ctx);
    for (const e of (group["passiveEventActions"] ?? []) as Obj[]) {
      this.walkSequences(e["actions"], base, base, { ...this.sub(ctx, `on ability event ${String(e["abilityEvent"])}`), repeated: true });
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
    // NotNextCheckAction negates the condition after it.
    let negate = false;
    let here = ctx;
    for (let i = from; i < actions.length; i++) {
      const raw = actions[i] as Obj;
      if (raw["isEnable"] === false) continue;
      if (shortType(raw["$type"]) === "NotNextCheckAction") {
        negate = !negate;
        continue;
      }
      if (isConditionType(raw["$type"])) {
        const r = negated(this.evalCondition(raw, here), negate);
        negate = false;
        this.invalidate(raw, shortType(raw["$type"]), here);
        if (r.value === false) {
          // What only more targets would run (a P1 effect behind "targets ≥ 2"): said, not silently dropped.
          const dropped = actions.slice(i + 1).filter((x) => x["isEnable"] !== false && !isConditionType(x["$type"])).map((x) => shortType(x["$type"]));
          if (shortType(raw["$type"]) === "CheckEntityNum" && dropped.length) this.notes.add(`${here.file}@${start}: ${[...new Set(dropped)].join(", ")} only with more targets (${r.label}): not drafted for one enemy`);
          return;
        }
        if (r.value === null) {
          // The rest runs only if the gate holds: what it writes is known only on that path.
          const site = this.site(raw);
          this.fork(here, [(c) => this.execActions(actions, i + 1, start, end, this.sub(c, `if ${r.label}`, site, 0, r.pred)), () => {}]);
          return;
        }
        continue;
      }
      // A TargetPostProcessorAction excluding the context's target: what follows in the sequence acts on the other enemies only.
      if (shortType(raw["$type"]) === "TargetPostProcessorAction" && ((raw["postProcessorData"] ?? []) as Obj[]).some((p) => String(p["$type"]).includes("ExcludeTarget") && ((p["excludedTargetSettings"] ?? {}) as Obj)["targetSource"] === 0)) {
        here = { ...here, othersOnly: true };
        continue;
      }
      this.exec(raw, start, end, here);
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

  /** Decides a condition when the data settles it (a literal comparison, a target being there); otherwise null, with the condition as a predicate when it can say it. */
  evalCondition(a: Obj, ctx: Ctx): Verdict {
    return negated(this.evalPlain(a, ctx), a["invertCondition"] === true);
  }

  private evalPlain(a: Obj, ctx: Ctx): Verdict {
    const t = shortType(a["$type"]);
    const sym = (code: unknown) => ["<", "≤", ">", "≥", "="][Number(code ?? 0)] ?? `cmp${String(code)}`;
    const cmp = (x: number, y: number, code: number): boolean | null => (code === 0 ? x < y : code === 1 ? x <= y : code === 2 ? x > y : code === 3 ? x >= y : code === 4 ? x === y : null);
    const open = (label: string, pred: Predicate | null = null): Verdict => ({ value: null, label, pred });
    switch (t) {
      case "CompareFloat": {
        const x = this.value(a["valueA"], ctx.bb);
        const y = this.value(a["valueB"], ctx.bb);
        const code = Number(a["compare"] ?? 0);
        const label = `${describeValue(x)} ${sym(code)} ${describeValue(y)}`;
        // Only literals and runtime state: a skill value's default isn't its level value.
        const decidable = (v: CompiledValue) => (ctx.repeated ? isLiteral(v) : isKnown(v));
        if (decidable(x) && decidable(y)) return { value: cmp(x.value as number, y.value as number, code), label: `${label} (${fmt(x.value as number)} vs ${fmt(y.value as number)})`, pred: null };
        return open(label, this.gatePred(x, code, y));
      }
      case "CheckEntityNum": {
        const label = `targets ${sym(a["compareType"])} ${String(a["minNum"] ?? 0)}`;
        // Counts the skill's targets: one enemy in this simulator (not spawned entities or teammates).
        const finder = JSON.stringify(((a["checkTarget"] ?? {}) as Obj)["selectorData"] ?? null);
        if (finder.includes("Spawned") || finder.includes("Team")) return open(label);
        const v = cmp(1, Number(a["minNum"] ?? 0), Number(a["compareType"]));
        if (v !== null) this.notes.add(`CheckEntityNum decided for one enemy (${label} → ${String(v)})`);
        return { value: v, label, pred: null };
      }
      case "CheckObjectTypeMatch": {
        // objectTypeMask 16 is Enemy (Endaxis's AuraTargetType table): the hit target is the enemy.
        const m = Number(a["objectTypeMask"] ?? 0);
        return { value: (m & 16) !== 0 ? true : null, label: `object type ${m}`, pred: null };
      }
      case "CheckSquadInFight":
        return { value: true, label: "in fight", pred: null };
      case "CheckTargetsEqual":
        // Two target groups of one enemy are the same target.
        this.notes.add("CheckTargetsEqual decided true for one enemy");
        return { value: true, label: "same target", pred: null };
      case "OrConditionAction": {
        const parts = ((a["conditionList"] ?? []) as Sequence[]).map((seq) => this.evalSequenceCondition(seq, ctx));
        const label = parts.map((p) => p.label).join(" or ") || "or";
        if (parts.some((p) => p.value === true)) return { value: true, label, pred: null };
        if (parts.length && parts.every((p) => p.value === false)) return { value: false, label, pred: null };
        const undecided = parts.filter((p) => p.value === null);
        const preds = undecided.map((p) => p.pred);
        return open(label, preds.some((p) => p === null) ? null : preds.length === 1 ? (preds[0] as Predicate) : { any: preds as Predicate[] });
      }
      case "CheckMainCharacterCondition":
        return open("controlled", { controlled: true });
      case "Probablity":
        return open(`chance ${describeValue(this.value(a["prob"], ctx.bb))}`);
      case "CheckBuffStackNumAdvanced":
      case "CheckBuffStackNum": {
        const what = this.buffRef(a["buffSettings"] ?? a["buffId"]);
        const v = this.value(a["value"], ctx.bb);
        return open(`stacks(${what}) ${sym(a["compareType"])} ${describeValue(v)}`, this.attachedPred(what, Number(a["compareType"] ?? 0), v));
      }
      case "CheckBuffIdInContextAdvanced": {
        const ids = ((a["buffIdList"] ?? []) as Obj[]).map((x) => String(x["value"]));
        return open(`buff in context(${ids.join("|")})`);
      }
      case "CheckTagMatch":
      case "CheckDamageTag": {
        const q = (a["query"] ?? a) as Obj;
        return open(`${t === "CheckDamageTag" ? "damage tag" : "tag"}(${((q["tags"] ?? []) as Obj[]).map((x) => this.tagName(Number(x["tagId"]))).join("|")})`);
      }
      default:
        return open(this.summary(a));
    }
  }

  /**
   * A stack check on a buff a talent or potential attaches: the attaching
   * predicate when the check asks whether it's there (≥ 1, > 0), its negation
   * when it asks whether it's absent (< 1, ≤ 0, = 0); null otherwise.
   */
  private attachedPred(buff: string, code: number, v: CompiledValue): Predicate | null {
    const p = this.options.attachedBuffs?.get(buff);
    if (!p || !isLiteral(v)) return null;
    const n = v.value as number;
    if ((code === 3 && n > 0 && n <= 1) || (code === 2 && n >= 0 && n < 1)) return p;
    if ((code === 0 && n > 0 && n <= 1) || (code === 1 && n >= 0 && n < 1) || (code === 4 && n === 0)) return { not: p };
    return null;
  }

  /**
   * A comparison of a gate key (CompileOptions.valueGates) with a literal: the
   * gate's predicate when it asks whether the key is set (> 0, ≥ a value up
   * to the smallest it's set to), its negation when it asks whether it isn't
   * (= 0, ≤ 0, < such a value); null otherwise.
   */
  private gatePred(x: CompiledValue, code: number, y: CompiledValue): Predicate | null {
    const key = x.keys.length === 1 && x.factor === 1 && !x.expr && x.origins[0] === this.root ? x.keys[0] : undefined;
    const gate = key === undefined ? undefined : this.options.valueGates?.get(key);
    if (!gate || !isLiteral(y)) return null;
    const n = y.value as number;
    const within = n > 0 && n <= gate.min;
    // Equal to the one value it's ever set to (a flag: potential_2 = 1).
    const isSet = code === 4 && n === gate.min && gate.max === gate.min;
    if ((code === 2 && n === 0) || (code === 3 && within) || isSet) return gate.pred;
    if (((code === 4 || code === 1) && n === 0) || (code === 0 && within)) return { not: gate.pred };
    return null;
  }

  /** A buff filter (buffSettings / buffId) as text: buff IDs, or tags (infliction tags by element). */
  private buffRef(v: unknown): string {
    if (!v || typeof v !== "object") return typeof v === "string" ? v : "?";
    const o = v as Obj;
    if (typeof o["buffId"] === "string") return o["buffId"];
    if (o["useBlackboardKey"] === false && typeof o["value"] === "string") return o["value"];
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
    if (ctx.othersOnly && ["DamageAction", "SpellInfliction", "ForceSpellStatusAction", ...Object.keys(PHYSICAL_ACTION)].includes(t)) {
      this.notes.add(`${ctx.file}@${start}: ${t} on the other enemies only (after ExcludeTarget of the target): left out for one enemy`);
      return;
    }
    switch (t) {
      case "DamageAction":
        return this.damage(a, start, ctx);
      case "SpellInfliction": {
        const el = INFLICTION[Number(a["inflictionType"])];
        if (el) this.effects.push({ ...this.place(ctx, start), landing: null, kind: "infliction", element: el, isExtra: a["isExtra"] === true });
        return;
      }
      case "ForceSpellStatusAction":
        this.effects.push({ ...this.place(ctx, start), landing: null, kind: "forcedReaction", status: FORCED_STATUS[Number(a["spellStatusType"])] ?? null, source: `ForceSpellStatusAction spellStatusType ${String(a["spellStatusType"])}`, level: this.value(a["count"], ctx.bb), duration: null, assigned: {} });
        return;
      case "AirborneAction":
      case "KnockDownAction":
      case "CrushAction":
      case "FractureAction":
        return this.physical(a, t, start, ctx);
      case "FinishBuffAdvanced":
      case "FinishBuffAction":
        return this.finishBuff(a, start, ctx);
      case "ObtainCostAction": {
        const type = Number(a["costType"]);
        if (type !== 0 && type !== 1) return;
        const coef = this.value(a["coefficient"], ctx.bb);
        this.order.set(this.costs.length, this.ticket++);
        this.costs.push({ ...this.place(ctx, start), costType: type, value: this.value(a["costValue"], ctx.bb), coefficient: coef.value ?? 1, isPercent: a["isPercentValue"] === true, controlledOnly: type === 1 && a["atbOnlyMainChar"] === true, beforeDamage: false, landing: null });
        return;
      }
      case "HealAction": {
        const ts = (a["target"] ?? {}) as Obj;
        const selector = ((ts["selectorData"] ?? {}) as Obj);
        const teamFinder = String(((selector["finderData"] ?? {}) as Obj)["$type"] ?? "").includes("CharacterTeamFinder");
        const mainOnly = ((selector["validatorData"] ?? []) as Obj[]).some((v) => String(v["$type"]).includes("MainCharacterValidator"));
        const source = ts["targetSource"];
        const group = source === 2 && typeof ts["targetGroupKey"] === "string" ? ctx.groups.get(ts["targetGroupKey"]) : undefined;
        const target = source === 1 || source === 4 ? "self" : source === 3 && teamFinder ? (mainOnly ? "controlled" : "team") : group === "team" ? "team" : "unknown";
        const tag = (((a["healTags"] ?? {}) as Obj)["predefinedTag"] ?? []) as Obj[];
        this.heals.push({ ...this.place(ctx, start), target, healKind: tag.map((t) => HEAL_TAGS[Number(t["tagId"])]).find((k) => k !== undefined) ?? null, landing: null });
        return;
      }
      case "ObtainUspInNormalSkill": {
        // The team's energy for the SP spent, as buff_common_obtain_ultimate_sp gives it (its handler is this action, `coefficient` its ratio).
        const ratio = this.value(a["coefficient"], ctx.bb);
        this.teamEnergy.push({ ...this.place(ctx, start), ratio: isLiteral(ratio) ? ratio.value : null });
        return;
      }
      case "CreateBuffAction":
        // autoFinishByAction in the skill's own timeline: the buff ends with its clip (frames of an entity's or a buff's timeline aren't the cast's).
        return this.createBuffs((a["buffs"] ?? []) as Obj[], start, ctx, this.buffTarget(a, ctx), `CreateBuff@${start}`, this.value(a["count"], ctx.bb), undefined, a["autoFinishByAction"] === true && ctx.file === this.root && !ctx.buffSpan && !ctx.repeated ? end : undefined);
      case "AuraAction":
        return this.aura(a, start, end, ctx);
      case "CreateGlobalBuffAction":
        this.notes.add(`${ctx.file}@${start}: CreateGlobalBuffAction ${JSON.stringify((a["globalBuffs"] ?? []) as unknown[]).slice(0, 120)} not followed`);
        return;
      case "LaunchProjectile":
        return this.projectile(a, start, ctx);
      case "SpawnAbilityEntity":
        return this.entity(a, start, ctx);
      case "CastSkill":
        return this.castSkill(a, start, ctx);
      case "FindTargetAction":
      case "ContinuousFindTargetAction": {
        const key = a["targetGroupKey"];
        if (typeof key === "string" && key) ctx.groups.set(key, groupKind((((a["selectorData"] ?? {}) as Obj)["finderData"] ?? null) as Obj | null));
        return this.generic(a, t, start, end, ctx);
      }
      case "IfElseAction": {
        const cond = (a["conditionAction"] ?? {}) as Sequence;
        const r = this.evalSequenceCondition(cond, ctx);
        if (r.value === true) this.execSeq(a["succeedActions"] as Sequence, start, end, ctx);
        else if (r.value === false) this.execSeq(a["failActions"] as Sequence, start, end, ctx);
        else {
          const site = this.site(a);
          this.fork(ctx, [
            (c) => this.execSeq(a["succeedActions"] as Sequence, start, end, this.sub(c, `if ${r.label}`, site, 0, r.pred)),
            (c) => this.execSeq(a["failActions"] as Sequence, start, end, this.sub(c, `if not ${r.label}`, site, 1, not(r.pred))),
          ]);
        }
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
          const site = this.site(a);
          const runs = options.map((o, k) => (c: Ctx) => this.execSeq(o["actionData"] as Sequence, start, end, this.sub(c, `switch ${label} = ${String(this.value(o["value"], ctx.bb).value)}`, site, k)));
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
      case "ExecuteIntervalAction":
        return this.ticks(a, t, start, end, ctx);
      case "JumpToAction": {
        const r = this.evalSequenceCondition((a["conditionAction"] ?? {}) as Sequence, ctx);
        if (r.value === false) return;
        const own = ((a["conditionAction"] as Sequence | undefined)?.actionData as unknown[] | undefined)?.length ? r : null;
        // When it's taken, as a kit predicate: the conditions on the way and its own (null when one can't be said).
        const parts = [...ctx.steps.map((s) => s.pred), ...(own && own.value === null ? [own.pred] : [])];
        this.jumps.push({ ...this.place(ctx, start), destFrame: Number(a["destFrame"]), condition: own ? r.label : "always", pred: parts.length ? allOf(parts) : null, always: parts.length === 0 });
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
        for (const m of (a["abilityActionMap"] ?? []) as Obj[]) this.walkSequences(m["actions"], start, end, { ...this.sub(ctx, `on ability event ${String(m["abilityEvent"])}`), repeated: true });
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
          this.execSeq(s as Sequence, start, end, this.sub(ctx, `${t}.${k}`));
          if (this.landings.length > before) this.notes.add(`${ctx.file}@${start}: damage inside ${t}.${k}, timing not interpreted`);
        }
      }
    }
  }

  private evalSequenceCondition(seq: Sequence, ctx: Ctx): Verdict {
    const parts: Verdict[] = [];
    let negate = false;
    for (const x of (seq.actionData ?? []) as Obj[]) {
      if (x["isEnable"] === false) continue;
      if (shortType(x["$type"]) === "NotNextCheckAction") negate = !negate;
      else if (isConditionType(x["$type"])) {
        parts.push(negated(this.evalCondition(x, ctx), negate));
        negate = false;
      }
    }
    if (parts.length === 0) return { value: true, label: "always", pred: null };
    if (parts.some((p) => p.value === false)) return { value: false, label: parts.map((p) => p.label).join(" and "), pred: null };
    const open = parts.filter((p) => p.value === null);
    return { value: open.length ? null : true, label: (open.length ? open : parts).map((p) => p.label).join(" and "), pred: open.length ? allOf(open.map((p) => p.pred)) : null };
  }

  /** A damage unit's stagger: DefiniteValueCalculation value (× valueScale when applyScale); null when it's 0. */
  private poiseOf(u: Obj, ctx: Ctx, where: string): CompiledPoise | null {
    const pc = (u["poiseCalculation"] ?? null) as Obj | null;
    if (!pc) return null;
    if (shortType(pc["$type"]) !== "DefiniteValueCalculation") {
      this.notes.add(`${where}: stagger by ${shortType(pc["$type"])} (not read)`);
      return null;
    }
    let v = this.value(pc["value"], ctx.bb);
    if (pc["applyScale"] === true) v = this.calc(2, v, this.value(pc["valueScale"], ctx.bb));
    // A key that is 0 (not in the level table, file default 0: Antal's battle skill) deals none.
    if (!v.expr && v.value === 0) return null;
    return { value: v, controlledOnly: u["onlyEnableForMainChar"] === true };
  }

  private damage(a: Obj, frame: number, ctx: Ctx) {
    const units = (a["damageUnits"] ?? []) as Obj[];
    const where = `${ctx.file}@${frame}`;
    // damageAttributeType 1 = poise (stagger) damage, shared by the action's HP units.
    const poises = units.filter((u) => u["damageAttributeType"] === 1).map((u) => this.poiseOf(u, ctx, where)).filter((p): p is CompiledPoise => p !== null);
    if (poises.length > 1) this.notes.add(`${where}: ${poises.length} stagger units (the first is used)`);
    const poise = poises[0] ?? null;
    const hp = units.filter((u) => u["damageAttributeType"] === 0);
    const before = this.landings.length;
    for (const u of hp) {
      // The scale is on the unit's atkScale or on an AtkScaleCalculation; the other one is an unused 0.
      const calc = (u["atkCalculation"] ?? null) as Obj | null;
      const fields = [calc && typeof calc["atkScale"] === "object" ? calc["atkScale"] : undefined, u["atkScale"]].filter((x): x is Obj => !!x && typeof x === "object");
      const used = fields.find((f) => f["useBlackboardKey"] === true) ?? fields.find((f) => typeof f["value"] === "number" && f["value"] !== 0) ?? fields[0];
      let scale = this.value(used, ctx.bb);
      const calcType = calc ? shortType(calc["$type"]) : null;
      // An ATK × scale unit with a literal-0 scale deals nothing (Lifeng's attack5 third unit, Mi Fu's ultimate f98).
      if ((calcType === null || calcType === "AtkScaleCalculation") && isLiteral(scale) && scale.value === 0) {
        this.notes.add(`${where}: a damage unit with a literal-0 scale (left out)`);
        continue;
      }
      // A finisher's share of its scale (BreakingAttackCalculation multiplier, e.g. 0.2 and 0.8 of atk_scale).
      if (calcType === "BreakingAttackCalculation") scale = this.calc(2, scale, this.value(calc?.["multiplier"], ctx.bb));
      else if (calc && calcType !== "AtkScaleCalculation") this.notes.add(`${where}: damage by ${calcType} (not ATK × scale)`);
      const mask = typeof u["damageDecorateMask"] === "number" ? u["damageDecorateMask"] : 0;
      const kind = (Object.entries(DECORATE_BITS) as [string, number][]).find(([k, bit]) => k !== "finalStrike" && (mask & bit) !== 0)?.[0] as ActionKind | undefined;
      const damageType = typeof u["damageType"] === "number" ? u["damageType"] : -1;
      this.landingOrder.set(this.landings.length, this.ticket++);
      this.landings.push({
        ...this.place(ctx, frame),
        scale,
        decorateMask: mask,
        kind: kind ?? null,
        finalStrike: Math.floor(mask / DECORATE_BITS.finalStrike) % 2 === 1,
        damageType,
        element: DAMAGE_ELEMENT[damageType] ?? null,
        poise,
        bonuses: this.processors(u, ctx, where),
      });
    }
    // Stagger with no damage (no HP unit, or only literal-0 ones): a poise-only landing.
    if (this.landings.length === before && poise) this.poises.push({ ...this.place(ctx, frame), poise, landing: null });
  }

  /** A damage unit's processors as hit bonuses: InstantModifyAttribute attribute 9 is crit rate; DamageScaleProcessor on the attacker's side NormalCalcZone the DMG bonus zone, ProdCalcZone the multiplicative one. */
  private processors(u: Obj, ctx: Ctx, where: string): { zone: Zone; value: CompiledValue }[] {
    const out: { zone: Zone; value: CompiledValue }[] = [];
    for (const p of (u["damageProcessors"] ?? []) as Obj[]) {
      const t = shortType(p["$type"]);
      if (t === "InstantModifyAttribute") {
        const m = (p["modifier"] ?? {}) as Obj;
        if (m["attributeType"] === 9 && p["modifyTargetSide"] === 0) out.push({ zone: "critRate", value: this.value(m["param"], ctx.bb) });
        else this.notes.add(`${where}: damage processor InstantModifyAttribute attribute ${String(m["attributeType"])} side ${String(p["modifyTargetSide"])} (not read)`);
      } else if (t === "DamageScaleProcessor" && p["side"] === 0 && (p["zoneName"] === "NormalCalcZone" || p["zoneName"] === "ProdCalcZone")) {
        out.push({ zone: p["zoneName"] === "NormalCalcZone" ? "damageBonus" : "multiplicative", value: this.value(p["addition"], ctx.bb) });
      } else this.notes.add(`${where}: damage processor ${this.summary(p)} (not read)`);
    }
    return out;
  }

  /** A physical status action; one with deadOption 2 acts on a dying target only (a death launch or knock-back, per the batch-2 and batch-3 reports) and is only noted. */
  private physical(a: Obj, t: string, frame: number, ctx: Ctx) {
    const status = PHYSICAL_ACTION[t] as PhysicalStatus;
    if (a["deadOption"] === 2) {
      this.notes.add(`${ctx.file}@${frame}: ${t} with deadOption 2 (on a dying target, assumed) not applied`);
      return;
    }
    const forced = a["forceAirborne"] === true || a["forceKnockDown"] === true;
    this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "physicalStatus", status, forced, multiplier: t === "CrushAction" ? this.value(a["damageMultiplier"], ctx.bb) : null, isExtra: a["isExtra"] === true });
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
    const { holder: _holder, ...rest } = ctx;
    return { ...rest, file, detached: true, via: [...ctx.via, `${how} → ${file}`], stack: [...ctx.stack, file], groups: new Map() };
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
      const inner = label === "block" && blockIsAlternative ? this.sub(c, `if ${String(a["projectileId"])} is blocked`) : c;
      this.walkSkillFile(j, frame, { ...inner, bb: this.childBB(file, j, ctx.bb, a["assignBlackboard"] === true, a["assignPairs"]) });
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

  /** On whom a CreateBuff puts its buffs (targetSettings.targetSource: 0 the context's target, 1 and 4 the owner, 2 a target group). */
  private buffTarget(a: Obj, ctx: Ctx): BuffTarget {
    const ts = (a["targetSettings"] ?? {}) as Obj;
    const source = ts["targetSource"];
    if (source === 1 || source === 4) return "self";
    // In a buff's start event, the context's target is the buff's holder.
    if (source === 0) return ctx.holder ?? "target";
    if (source === 2 && typeof ts["targetGroupKey"] === "string") {
      const g = ctx.groups.get(ts["targetGroupKey"]);
      return g === "enemy" ? "enemy" : g === "team" ? "team" : "unknown";
    }
    return "unknown";
  }

  /** An AuraAction: its buffInput buffs go on whoever is inside from its start; actionInAura runs as the enemy enters (at its start), actionWhenExitAura as it leaves (at its end). */
  private aura(a: Obj, start: number, end: number, ctx: Ctx) {
    this.invalidate(a, "AuraAction", ctx);
    const inAura = (a["actionInAura"] ?? null) as Sequence | null;
    if (inAura && Array.isArray(inAura.actionData) && inAura.actionData.length) {
      this.notes.add(`${ctx.file}@${start}: AuraAction actionInAura assumed to run once, at its start (the enemy inside)`);
      this.execSeq(inAura, start, end, ctx);
    }
    this.createBuffs((a["buffInput"] ?? []) as Obj[], start, ctx, "aura", `AuraAction@${start}`, LITERAL(1), end);
    const exit = (a["actionWhenExitAura"] ?? null) as Sequence | null;
    if (exit && Array.isArray(exit.actionData) && exit.actionData.length) this.execSeq(exit, end, end, this.sub(ctx, "when leaving the aura"));
  }

  /**
   * CreateBuff entries (or an aura's buffInput): the shared team-energy,
   * reaction and Vulnerable buffs as facts, any other buff reported with its
   * target and followed into its file. `auraEnd` bounds a buff without a
   * duration of its own.
   */
  private createBuffs(entries: readonly Obj[], frame: number, ctx: Ctx, target: BuffTarget, how: string, count: CompiledValue, auraEnd?: number, untilFrame?: number) {
    const until = untilFrame !== undefined ? { untilFrame } : {};
    for (const entry of entries) {
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
      if (id === VULNERABLE_BUFF) {
        this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "vulnerable", stacks: count });
        continue;
      }
      const reaction = /^buff_common_([a-z]+)_([a-z]+)_(?:([a-z]+)_)?triggered/.exec(id);
      if (reaction && reaction[1] === reaction[2]) {
        const word = reaction[3];
        if (word && STATUS_WORD[word]) {
          const others = Object.fromEntries([...assigned].filter(([k]) => k !== "count" && k !== "duration"));
          this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "forcedReaction", status: STATUS_WORD[word] ?? null, source: id, level: assigned.get("count") ?? null, duration: assigned.get("duration") ?? null, assigned: others });
        } else this.effects.push({ ...this.place(ctx, frame), landing: null, kind: "burst", element: (INFLICTION as readonly string[]).includes(reaction[1] ?? "") ? (reaction[1] as InflictionElement) : null, source: id });
        continue;
      }
      if (id.startsWith("buff_common_")) continue; // shared mechanics (reactions, immunity, …): not the skill's own
      if (!isBuffFileListed(id) || !existsSync(buffPath(id))) {
        this.notes.add(`${ctx.file}@${frame}: buff ${id} ${isBuffFileListed(id) ? "has no BuffData file" : "isn't listed in packages/data/tables.json"}`);
        this.buffs.push({ ...this.place(ctx, frame), buff: id, target, seconds: null, summary: "", ...until });
        continue;
      }
      const c = this.enter(ctx, id, how);
      if (!c) continue;
      const j = readJson(buffPath(id));
      const bb = this.defaults(id, j);
      for (const [k, v] of assigned) bb.set(k, v);
      const span = this.walkBuff(id, j, frame, { ...c, bb }, auraEnd, target);
      this.buffs.push({ ...this.place(ctx, frame), buff: id, target, seconds: span === null ? null : (span - frame) / FPS, summary: this.buffSummary(j, bb), ...until });
    }
  }

  /** What a buff does, in short: its damage modifiers, attribute modifiers and susceptibility (VulnerableAction) rates. */
  private buffSummary(j: Obj, bb: BB): string {
    const parts: string[] = [];
    for (const m of ((j["attributeModifier"] ?? {}) as Obj)["attributeModifiers"] as Obj[] | undefined ?? []) parts.push(`attribute ${String(m["attributeType"])} ${describeValue(this.value(m["param"], bb))}`);
    for (const d of (j["damageModifier"] ?? []) as Obj[]) {
      for (const p of (d["damageProcessors"] ?? []) as Obj[]) {
        if (shortType(p["$type"]) === "DamageScaleProcessor") parts.push(`${p["side"] === 1 ? "taken" : "dealt"} ${String(p["zoneName"])} ${describeValue(this.value(p["addition"], bb))}`);
        else if (shortType(p["$type"]) === "InstantModifyAttribute") {
          const m = (p["modifier"] ?? {}) as Obj;
          parts.push(`${p["modifyTargetSide"] === 1 ? "taken" : "dealt"} attribute ${String(m["attributeType"])} ${describeValue(this.value(m["param"], bb))}`);
        }
      }
    }
    const vul: string[] = [];
    const find = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(find);
      else if (o && typeof o === "object") {
        const x = o as Obj;
        if (shortType(x["$type"]) === "VulnerableAction" && x["isEnable"] !== false) vul.push(`susceptibility ${describeValue(this.value(x["rate"], bb))}`);
        Object.values(x).forEach(find);
      }
    };
    find(j["buffEventAction"]);
    return [...parts, ...new Set(vul)].join(", ");
  }

  /** Walks a buff file from `from`; returns its end frame (null when it lasts until ended). */
  private walkBuff(id: string, j: Obj, from: number, ctx: Ctx, auraEnd?: number, holder?: BuffTarget): number | null {
    const dur = this.value(j["duration"], ctx.bb);
    const seconds = dur.value !== null && !dur.expr && dur.value > 0 ? dur.value : null;
    const to = seconds === null ? (auraEnd ?? null) : from + toFrame(seconds);
    const c: Ctx = { ...ctx, buffSpan: { buff: id, from, to } };
    this.walkTimeline((j["timelineActions"] ?? []) as Obj[], from, c);
    for (const e of (j["buffEventAction"] ?? []) as Obj[]) {
      const ev = Number(e["buffEvent"]);
      // BuffData buffEvent codes (Endaxis's table): 0 start, 1 trigger, 2 finish, 3 enable, 5 during enable, 10 finished early.
      if (ev === 0 || ev === 3 || ev === 5) this.walkSequences(e["actions"], from, to ?? from, holder && holder !== "unknown" ? { ...c, holder } : c);
      else if (ev === 1) {
        const interval = this.value(j["triggerInterval"], c.bb).value ?? 0;
        const max = this.value(j["maxTriggerCnt"], c.bb).value ?? 0;
        if (interval <= 0) {
          this.walkSequences(e["actions"], from, from, this.sub(c, `on ${id} trigger (no interval)`));
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
        else this.walkSequences(e["actions"], from, from, this.sub(c, `when ${id} ends`));
      } else this.walkSequences(e["actions"], from, from, { ...this.sub(c, `on ${id} event ${ev}`), repeated: true });
    }
    for (const e of (j["abilityEventAction"] ?? []) as Obj[]) this.walkSequences(e["actions"], from, from, { ...this.sub(c, `on ability event ${String(e["abilityEvent"])}`), repeated: true });
    for (const e of (j["igniteEventAction"] ?? []) as Obj[]) this.walkSequences(e["actions"], from, from, { ...this.sub(c, `on ignite ${String(e["igniteType"])}`), repeated: true });
    return to;
  }

  private ticks(a: Obj, t: string, start: number, end: number, ctx: Ctx) {
    const read = (f: unknown) => this.value(f, ctx.bb).value ?? 0;
    // A channel ticks every triggerInterval but hits one target at most every targetTriggerInterval: one enemy sees the slower.
    const interval =
      t === "TickIntervalAction"
        ? read(a["useTickIntervalBlackboardKey"] === true ? { useBlackboardKey: true, blackboardKey: a["tickIntervalBlackboardKey"] } : a["tickInterval"])
        : t === "ExecuteIntervalAction"
          ? read(a["executeInterval"])
          : Math.max(read(a["triggerInterval"]), read(a["targetTriggerInterval"]));
    const body = (a["actionOnTick"] ?? a["actionOnExecuting"] ?? a["action"]) as Sequence | undefined;
    const perTarget = typeof a["maxCountPerTarget"] === "number" && a["maxCountPerTarget"] > 0 ? a["maxCountPerTarget"] : Infinity;
    const before = this.landings.length;
    let n = 0;
    for (let k = 0; n < perTarget && n < 600; k++) {
      const f = start + (interval > 0 ? toFrame(k * interval) : k);
      // A TickIntervalAction counts its ticks on unrounded time (Tangtang's dive: 4 ticks, not 5).
      const past = t === "TickIntervalAction" && interval > 0 ? k * interval * FPS > end - start + 1e-6 : f > end;
      if (past || (k > 0 && interval <= 0 && a["executeEachFrame"] !== true)) break;
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
