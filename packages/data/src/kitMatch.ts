// A kit's skills against the compiled SkillData (skillCompile.ts): which
// compiled landings each kit hit stands for, and where the kit's values
// differ from the data's. One compile per operator skill, with the options
// kit-draft uses (talents' and potentials' attached buffs and value gates,
// timing values at the skill's highest level), shared by kit-draft, the
// loader and the tests.

import type { Effect, Element, KitHit, Predicate, SkillData } from "@efsim/engine";
import { compileSkill, formatCompiledValue, prefixOf, type CompiledEffect, type CompiledLanding, type CompiledPoiseLanding, type CompiledSkill, type CompiledValue } from "./skillCompile.ts";

/** What compiling an operator's skill reads of the loaded data. */
export interface CompileData {
  readonly skills: Readonly<Record<string, SkillData>>;
  readonly operators: Readonly<
    Record<
      string,
      {
        readonly skillGroups: Readonly<Record<string, string>>;
        readonly talentNodes?: readonly { readonly index: number; readonly level: number; readonly effects: readonly Effect[] }[];
        readonly potentials?: readonly (readonly Effect[])[];
      }
    >
  >;
}

type Operator = CompileData["operators"][string];

/** Buffs the operator's talents and potentials attach, with the predicate that holds while each is attached (the lowest talent level or potential). */
export function attachedBuffs(op: Operator | undefined): Map<string, Predicate> {
  const out = new Map<string, Predicate>();
  if (!op) return out;
  for (const n of [...(op.talentNodes ?? [])].sort((a, b) => a.level - b.level)) for (const e of n.effects) if (e.kind === "buff" && !out.has(e.buffId)) out.set(e.buffId, { talentAtLeast: [n.index, n.level] });
  (op.potentials ?? []).forEach((effects, i) => {
    for (const e of effects) if (e.kind === "buff" && !out.has(e.buffId)) out.set(e.buffId, { potentialAtLeast: i + 1 });
  });
  return out;
}

/**
 * A skill's keys that are 0 at every level and only set (op set, > 0) by one
 * talent's levels or by potentials, with the predicate under which they're
 * set: Wulfgard's talent2, Alesh's exist_talent_1. A key another source also
 * changes (Avywenna's talent0_usp, which P1 adds to) isn't a gate.
 */
export function valueGates(op: Operator | undefined, skill: SkillData | undefined, values: Readonly<Record<string, number>> | undefined): Map<string, { pred: Predicate; min: number; max: number }> {
  const out = new Map<string, { pred: Predicate; min: number; max: number }>();
  if (!op || !skill) return out;
  type Source = { pred: Predicate; source: string; level: number; op: string; value: number };
  const byKey = new Map<string, Source[]>();
  const add = (key: string, s: Source) => byKey.set(key, [...(byKey.get(key) ?? []), s]);
  for (const n of op.talentNodes ?? []) for (const e of n.effects) if (e.kind === "skillValue" && e.skillId === skill.id) add(e.key, { pred: { talentAtLeast: [n.index, n.level] }, source: `talent ${n.index}`, level: n.level, op: e.op, value: e.value });
  (op.potentials ?? []).forEach((effects, i) => {
    for (const e of effects) if (e.kind === "skillValue" && e.skillId === skill.id) add(e.key, { pred: { potentialAtLeast: i + 1 }, source: "potential", level: i + 1, op: e.op, value: e.value });
  });
  for (const [key, sources] of byKey) {
    const base = [values?.[key], skill.defaults[key], ...skill.levels.map((l) => l.blackboard[key])].filter((x): x is number => x !== undefined);
    if (base.some((x) => x !== 0) || new Set(sources.map((s) => s.source)).size !== 1 || sources.some((s) => s.op !== "set" || !(s.value > 0))) continue;
    const first = [...sources].sort((a, b) => a.level - b.level)[0] as Source;
    out.set(key, { pred: first.pred, min: Math.min(...sources.map((s) => s.value)), max: Math.max(...sources.map((s) => s.value)) });
  }
  return out;
}

const compiledCache = new WeakMap<object, Map<string, CompiledSkill | null>>();

/**
 * An operator's skill compiled as kit-draft and the loader read it: its own
 * helper casts followed (not the operator's other skills), timing values at
 * its highest level, the talents' and potentials' attached buffs and value
 * gates as predicates. Null when its SkillData file isn't fetched. Cached per
 * loaded data.
 */
export function compileOperatorSkill(data: CompileData, operator: string, skillId: string): CompiledSkill | null {
  let cache = compiledCache.get(data.skills);
  if (!cache) compiledCache.set(data.skills, (cache = new Map()));
  const key = `${operator} ${skillId}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const op = data.operators[operator];
  const top = new Set(Object.keys(op?.skillGroups ?? {}));
  const skill = data.skills[skillId];
  const values = skill?.levels.at(-1)?.blackboard;
  const c = compileSkill(skillId, { followCast: (s) => !top.has(s), attachedBuffs: attachedBuffs(op), valueGates: valueGates(op, skill, values), ...(values ? { values } : {}) });
  cache.set(key, c);
  return c;
}

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

/** A value as a kit ValueExpr: a key, key × literal, a product of keys, or a literal; null when it's an expression. Literals are rounded to 6 places (the data's are float32: 0.300000012). */
export function valueExpr(v: CompiledValue, coefficient = 1): unknown {
  if (v.expr) return null;
  const factor = round(v.factor * coefficient);
  if (v.keys.length === 0) return v.value === null ? null : round(v.value * coefficient);
  const terms: unknown[] = [...v.keys, ...(factor === 1 ? [] : [factor])];
  return terms.length === 1 ? terms[0] : { product: terms };
}

/** A compiled value as a kit writes it (valueExpr), or its expression's text. */
const asKitValue = (v: CompiledValue): unknown => v.expr ?? valueExpr(v);

/**
 * Stagger-only DamageActions (CompiledSkill.poiseOnly): one is folded into
 * the landing it goes with when that landing deals no stagger of its own
 * and the only extra condition is none or "controlled" (then
 * poiseControlledOnly, as CheckMainCharacterCondition gates it); the others
 * stay stagger-only landings (`rest`: kit-draft's poise-only hits).
 */
export function foldPoise(c: CompiledSkill): { skill: CompiledSkill; rest: CompiledPoiseLanding[] } {
  const landings = [...c.landings];
  const rest: CompiledPoiseLanding[] = [];
  for (const p of c.poiseOnly) {
    const l = p.landing === null ? undefined : landings[p.landing];
    const extra = l && prefixOf(l.branch, p.branch) ? p.steps.slice(l.steps.length) : null;
    const controlledGate = extra?.length === 1 && JSON.stringify(extra[0]?.pred) === JSON.stringify({ controlled: true });
    if (l && p.landing !== null && l.file === p.file && l.frame === p.frame && !l.poise && extra && (extra.length === 0 || controlledGate)) {
      landings[p.landing] = { ...l, poise: { value: p.poise.value, controlledOnly: p.poise.controlledOnly || controlledGate } };
    } else rest.push(p);
  }
  return { skill: { ...c, landings }, rest };
}

// ---------------------------------------------------------------------------
// Matching a kit skill's hits to the compiled landings.

/** What the matcher reads of a kit hit (a loaded KitHit). */
export type MatchHit = Pick<KitHit, "id" | "scale" | "scaleValue" | "events" | "frames" | "count" | "factor" | "element" | "poise" | "poiseControlledOnly" | "poiseOnly" | "finalStrike" | "reaction" | "energy" | "applies">;

/** What the matcher reads of a kit skill. */
export interface MatchSkill {
  readonly skillId: string;
  readonly hits: readonly MatchHit[];
  readonly teamEnergy?: readonly { readonly frame: number; readonly ratio: number }[];
  readonly energyBlockSeconds?: number;
}

/** The compiled landings a kit hit stands for. */
export interface HitMatch {
  /** Damage landings (by its first scale key, its events, on one branch path covering its frames), stagger-only landings for a poise-only hit; empty for a reaction hit or none found. */
  readonly landings: readonly CompiledLanding[];
  readonly poiseLandings: readonly CompiledPoiseLanding[];
  /** Whether every kit frame was found on one branch path. */
  readonly onPath: boolean;
  /**
   * For a hit without frames: its candidate landings (by key and events) are
   * one branch path that no other hit of the skill takes landings of, so its
   * landings are all of them.
   */
  readonly whole: boolean;
}

/** The undecided-branch paths through a skill: each distinct branch of a landing, with the landings on it (those whose branch encloses it). */
function paths(ls: readonly CompiledLanding[]): CompiledLanding[][] {
  const branches = [...new Map(ls.map((l) => [JSON.stringify(l.branch), l.branch])).values()];
  return branches.map((b) => ls.filter((l) => prefixOf(l.branch, b)));
}

/** Whether every kit frame (a multiset) is among the path's frames. */
function covers(path: readonly CompiledLanding[], want: readonly number[]): boolean {
  const have = new Map<number, number>();
  for (const l of path) have.set(l.frame, (have.get(l.frame) ?? 0) + 1);
  for (const f of want) {
    const n = have.get(f) ?? 0;
    if (n === 0) return false;
    have.set(f, n - 1);
  }
  return true;
}

const frames = (ls: readonly { frame: number }[]) => ls.map((l) => l.frame).sort((a, b) => a - b);
const keysText = (ls: readonly CompiledLanding[]) => [...new Set(ls.map((l) => (l.scale.expr ? l.scale.expr : [...l.scale.keys].sort().join(" × "))))].join(" | ");
type KitApplication = NonNullable<KitHit["applies"]>[number];
const physicalText = (status: string, forced: boolean | undefined) => `${status === "event" ? "physical event" : status}${forced ? " (forced)" : ""}`;
const kitAppText = (a: KitApplication) =>
  a.kind === "infliction" ? `infliction ${a.element}` : a.kind === "forcedReaction" ? `forced ${a.status}` : a.kind === "consumeInfliction" ? `consume ${(a.elements ?? []).join("+")}` : a.kind === "physicalStatus" ? physicalText(a.status, a.forced) : a.kind === "vulnerable" ? "vulnerable" : null;
const dataAppText = (e: CompiledEffect) =>
  e.kind === "infliction" ? `infliction ${e.element}` : e.kind === "forcedReaction" ? `forced ${e.status ?? "?"}` : e.kind === "consumeInfliction" ? `consume ${e.element ?? "?"}` : e.kind === "physicalStatus" ? physicalText(e.status, e.forced) : e.kind === "vulnerable" ? "vulnerable" : null;
/** A kit ValueExpr with its literals rounded as valueExpr rounds them. */
const roundedValue = (v: unknown): unknown => (typeof v === "number" ? round(v) : Array.isArray(v) ? v.map(roundedValue) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, roundedValue(x)])) : v);
const valueText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
/** The first plain value key a ValueExpr names (a string anywhere in it), if any. */
function firstValueKey(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(firstValueKey).find((k) => k !== undefined);
  if (v && typeof v === "object") return Object.values(v).map(firstValueKey).find((k) => k !== undefined);
  return undefined;
}
/** A grant the kit gives only in a situation (`{if, then}`, no `else`): its value, which the data has on a branch of its own. */
const grantText = (v: unknown) => (v !== null && typeof v === "object" && "then" in v && !("else" in v) ? valueText(v.then) : valueText(v));
/** The first two undecided conditions on the way, for a readable line. */
const branchText = (b: readonly string[] | undefined) => (b?.length ? ` (${b.slice(0, 2).join(", ")}${b.length > 2 ? ", …" : ""})` : "");

/** Team energy parts as kit-draft reads them: unconditional ones, the first alone when they add up to more than the whole. */
export function dataTeamEnergy(c: CompiledSkill): { frame: number; ratio: number }[] {
  const team = c.teamEnergy.filter((t) => t.branch.length === 0).map((t) => ({ frame: t.frame, ratio: t.ratio ?? 1 }));
  return team.reduce((x, t) => x + t.ratio, 0) > 1 + 1e-9 ? team.slice(0, 1).map((t) => ({ ...t, ratio: 1 })) : team;
}

/** The energy block as kit-draft reads it: the last frame of the unconditional, bounded blocks, in seconds (3 places), or null. */
export function dataEnergyBlock(c: CompiledSkill): number | null {
  const blocks = c.energyBlocks.filter((b) => b.branch.length === 0 && b.until !== null);
  return blocks.length ? round(Math.max(...blocks.map((b) => b.until as number)) / 30, 3) : null;
}

/**
 * Each kit hit is matched to the compiled landings scaled by its first key
 * (and logged under one of its events); its frames must be on one branch path.
 * A poise-only hit (scale []) is matched to the stagger-only DamageActions
 * that go with no landing (foldPoise) by frame. Energy goes by frame,
 * applications by frame across the skill's hits. `kitBlock`: the energy block
 * the kit gives the skill (its energyBlockSeconds, or an energy-blocking buff
 * its own cast trigger applies), in seconds.
 * Returns each disagreement as a line, and what each hit was matched to.
 */
export function matchSkill(compiled: CompiledSkill, s: MatchSkill, kitBlock: number | null): { disagreements: string[]; hits: Map<string, HitMatch>; folded: CompiledSkill } {
  const out: string[] = [];
  const matches = new Map<string, HitMatch>();
  const none: HitMatch = { landings: [], poiseLandings: [], onPath: false, whole: false };
  const { skill: c, rest: poiseRest } = foldPoise(compiled);
  const where = s.skillId;
  const block = dataEnergyBlock(c);
  const kitBlockR = kitBlock === null ? null : round(kitBlock, 3);
  if (block !== kitBlockR) out.push(`${where} energyBlockSeconds: kit ${kitBlockR ?? "-"}, data ${block ?? "-"}`);
  // All at the cast when none.
  const partsText = (parts: readonly { frame: number; ratio: number }[]) => (parts.length ? parts : [{ frame: 0, ratio: 1 }]).map((t) => `${t.ratio}@${t.frame}`).join(", ");
  const team = dataTeamEnergy(c);
  if (partsText(team) !== partsText(s.teamEnergy ?? [])) out.push(`${where} teamEnergy: kit ${partsText(s.teamEnergy ?? [])}, data ${partsText(team)}`);
  const claimed = new Set<CompiledLanding>();
  const kitApps = new Map<number, Set<string>>();
  for (const h of s.hits) {
    const tag = `${where}/${h.id}`;
    for (const f of h.frames ?? []) for (const a of h.applies ?? []) {
      const t = kitAppText(a);
      if (t) kitApps.set(f, new Set([...(kitApps.get(f) ?? []), t]));
    }
    if (h.energy !== undefined) {
      const dataE = c.energy.filter((e) => (h.frames ?? []).includes(e.frame)).map((e) => formatCompiledValue(e.value));
      if (!dataE.includes(grantText(h.energy))) out.push(`${tag} energy: kit ${valueText(h.energy)} at [${(h.frames ?? []).join(", ")}], data ${c.energy.map((e) => `${formatCompiledValue(e.value)}@${e.frame}${branchText(e.branch)}`).join(", ") || "none"}`);
    }
    if (h.poiseOnly) {
      const here = poiseRest.filter((p) => !h.events.length || h.events.includes(p.file));
      const want = h.frames ?? [];
      const have = new Map<number, number>();
      for (const p of here) have.set(p.frame, (have.get(p.frame) ?? 0) + 1);
      const covered = want.every((f) => {
        const n = have.get(f) ?? 0;
        have.set(f, n - 1);
        return n > 0;
      });
      if (!h.frames || !covered) out.push(`${tag} frames: kit ${h.frames ? `[${want.join(", ")}]` : `none (count ${valueText(h.count)})`}, data stagger-only [${frames(here).join(", ")}]`);
      const at = here.filter((p) => want.includes(p.frame));
      matches.set(h.id, { landings: [], poiseLandings: at, onPath: !!h.frames && covered, whole: false });
      if (at.length) {
        const kitPoise = h.poise === undefined ? "-" : JSON.stringify(roundedValue(h.poise));
        const dataPoise = [...new Set(at.map((p) => JSON.stringify(asKitValue(p.poise.value))))];
        if (!dataPoise.includes(kitPoise)) out.push(`${tag} poise: kit ${kitPoise}, data ${dataPoise.join(" | ")}`);
        const ctl = [...new Set(at.map((p) => p.poise.controlledOnly))];
        if (!ctl.includes(h.poiseControlledOnly ?? false)) out.push(`${tag} poiseControlledOnly: kit ${String(h.poiseControlledOnly ?? false)}, data ${ctl.join(" | ")}`);
      }
      continue;
    }
    if (h.reaction) {
      // Damage computed as a reaction: the data creates the reaction's buff (no DamageAction of its own).
      const found = c.effects.filter((e) => (e.kind === "burst" || e.kind === "forcedReaction") && (h.frames ?? []).includes(e.frame));
      if (!found.length) out.push(`${tag}: kit ${h.reaction.kind} at [${(h.frames ?? []).join(", ")}], data none there (${c.effects.filter((e) => e.kind === "burst").map((e) => e.frame).join(", ") || "no bursts"})`);
      matches.set(h.id, none);
      continue;
    }
    // A hit whose multiplier is all scaleValue (Si's combo final hit) is matched by the first value key it names.
    const key = (h.scale[0] ?? firstValueKey(h.scaleValue)) as string;
    const byKey = c.landings.filter((l) => l.scale.keys.includes(key) || (l.scale.expr ?? "").includes(key));
    if (byKey.length === 0) {
      out.push(`${tag}: no landing scaled by ${key} (data: ${keysText(c.landings) || "no landings"})`);
      matches.set(h.id, none);
      continue;
    }
    const byEvent = h.events.length ? byKey.filter((l) => h.events.includes(l.file)) : byKey;
    if (byEvent.length === 0) out.push(`${tag} events: kit [${h.events.join(", ")}], data [${[...new Set(byKey.map((l) => l.file))].join(", ")}]`);
    const cand = byEvent.length ? byEvent : byKey;
    const kitKeys = [...h.scale].sort().join(" × ");
    if (!cand.some((l) => !l.scale.expr && [...l.scale.keys].sort().join(" × ") === kitKeys)) out.push(`${tag} scale: kit ${[...h.scale, ...(h.scaleValue !== undefined ? [valueText(h.scaleValue)] : [])].join(" × ")}, data ${keysText(cand)}`);
    const kitFactor = round(h.factor ?? 1);
    const factors = [...new Set(cand.map((l) => round(l.scale.factor)))];
    if (!factors.includes(kitFactor)) out.push(`${tag} factor: kit ${kitFactor}, data ${factors.join(" | ")}`);
    const all = paths(cand);
    const want = h.frames ?? [];
    const path = all.find((p) => covers(p, want));
    const best = path ?? [...all].sort((a, b) => b.length - a.length)[0] ?? [];
    if (!h.frames) out.push(`${tag} frames: kit none (count ${valueText(h.count)}), data [${frames(best).join(", ")}]${branchText(best[0]?.branch)}`);
    else if (!path) out.push(`${tag} frames: kit [${want.join(", ")}], data [${frames(best).join(", ")}]${branchText(best[0]?.branch)}`);
    const at = (best.length ? best : cand).filter((l) => !h.frames || h.frames.includes(l.frame));
    for (const l of at) claimed.add(l);
    matches.set(h.id, { landings: at, poiseLandings: [], onPath: !!h.frames && !!path, whole: !h.frames && byEvent.length > 0 && all.length === 1 });
    if (h.frames && path && typeof h.count === "number" && at.length > h.count) out.push(`${tag} count: kit ${h.count}, data ${at.length} landings at its frames (${[...new Set(at.map((l) => l.file))].join(", ")})`);
    // Element and stagger of the landings the kit hit stands for (a landing without one: Fixed DMG, no poise unit).
    const els = [...new Set(at.map((l) => l.element).filter((x) => x !== null))];
    if (els.length && !els.includes(h.element)) out.push(`${tag} element: kit ${h.element}, data ${els.join(" | ")}`);
    if (h.frames && path) {
      const kitPoise = h.poise === undefined ? "-" : JSON.stringify(roundedValue(h.poise));
      const dataPoise = [...new Set(at.map((l) => (l.poise ? JSON.stringify(asKitValue(l.poise.value)) : "-")))];
      if (!dataPoise.includes(kitPoise)) out.push(`${tag} poise: kit ${kitPoise}, data ${dataPoise.join(" | ")}`);
      const ctl = [...new Set(at.map((l) => l.poise?.controlledOnly ?? false))];
      if (h.poise !== undefined && !ctl.includes(h.poiseControlledOnly ?? false)) out.push(`${tag} poiseControlledOnly: kit ${String(h.poiseControlledOnly ?? false)}, data ${ctl.join(" | ")}`);
    }
    const fs = at.map((l) => l.finalStrike);
    if (h.finalStrike && fs.includes(false)) out.push(`${tag} finalStrike: kit all ${valueText(h.count)} landings, data only at [${at.filter((l) => l.finalStrike).map((l) => l.frame).join(", ")}]`);
    if (!h.finalStrike && fs.includes(true)) out.push(`${tag} finalStrike: kit none, data at [${at.filter((l) => l.finalStrike).map((l) => l.frame).join(", ")}]`);
  }
  // Applications by frame: what the kit applies must be in the data there; what the data applies unconditionally must be in the kit.
  const dataFrames = new Set([...kitApps.keys(), ...c.effects.filter((e) => e.branch.length === 0 && dataAppText(e)).map((e) => e.frame)]);
  for (const f of [...dataFrames].sort((a, b) => a - b)) {
    const kitSet = kitApps.get(f) ?? new Set<string>();
    const here = c.effects.filter((e) => e.frame === f && dataAppText(e));
    const any = new Set(here.map((e) => dataAppText(e) as string));
    const always = new Set(here.filter((e) => e.branch.length === 0).map((e) => dataAppText(e) as string));
    const onlyKit = [...kitSet].filter((x) => !any.has(x));
    const onlyData = [...always].filter((x) => !kitSet.has(x));
    const cond = [...any].filter((x) => !always.has(x) && !kitSet.has(x));
    if (onlyKit.length || onlyData.length || cond.length) out.push(`${where} applies at ${f}: kit [${[...kitSet].join(", ")}], data [${[...always].join(", ")}]${cond.length ? `, conditionally [${cond.join(", ")}]` : ""}`);
  }
  // Landings no kit hit accounts for: unconditional ones, and ones on the branch of a landing a kit hit has.
  const onPath = (l: CompiledLanding) => l.branch.length === 0 || [...claimed].some((x) => JSON.stringify(x.branch) === JSON.stringify(l.branch));
  const missed = c.landings.filter((l) => !claimed.has(l) && onPath(l));
  const byFile = new Map<string, CompiledLanding[]>();
  for (const l of missed) byFile.set(`${l.file} ${keysText([l])}`, [...(byFile.get(`${l.file} ${keysText([l])}`) ?? []), l]);
  for (const [k, ls] of byFile) out.push(`${where}: data lands ${k} at [${frames(ls).join(", ")}], no kit hit`);
  // A hit without frames takes its landings only when no other hit takes any of them.
  for (const [id, m] of matches) {
    if (!m.whole) continue;
    const mine = new Set(m.landings);
    if ([...matches].some(([other, x]) => other !== id && x.landings.some((l) => mine.has(l)))) matches.set(id, { ...m, whole: false });
  }
  return { disagreements: out, hits: matches, folded: c };
}

/** The value all items give, when they give one and the same (by its JSON); undefined when they differ or there are none. */
function same<T>(items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  const first = JSON.stringify(items[0]);
  return items.every((x) => JSON.stringify(x) === first) ? items[0] : undefined;
}

/** The hit fields the loader compares with the compiled data (and fills in where a kit leaves them out); a kit hit's `dataOverride` names the ones it differs in on purpose. */
export const DATA_FIELDS = ["frames", "count", "events", "scale", "factor", "element", "poise", "poiseControlledOnly", "finalStrike", "detached", "launch", "energy", "sp", "spBeforeDamage"] as const;
export type DataField = (typeof DATA_FIELDS)[number];

/** What the data says of a kit hit, field by field, where its landings agree (HitMatch). */
export interface HitFacts {
  /** The landings' frames, for a hit without frames whose landings are a whole branch path (HitMatch.whole). */
  readonly frames?: readonly number[];
  /** The file all its landings are in. */
  readonly events?: readonly string[];
  readonly factor?: number;
  readonly element?: Element;
  /** Their stagger as a kit value, or null when none of them staggers. */
  readonly poise?: unknown;
  readonly poiseControlledOnly?: boolean;
  /** Dealt from another file than the skill's own. */
  readonly detached?: boolean;
  /** Ultimate energy each landing grants (one unconditional ObtainCostAction costType 0 going with it, a kit value); null when none does. */
  readonly energy?: unknown;
}

/**
 * The facts of a hit's landings (HitMatch.landings, from matchSkill on the
 * folded skill): each field only when every landing says the same. A hit
 * with frames needs them on one branch path (HitMatch.onPath).
 */
export function hitFacts(folded: CompiledSkill, m: HitMatch | undefined): HitFacts {
  if (!m || !(m.onPath || m.whole) || !m.landings.length) return {};
  const ls = m.landings;
  const out: { -readonly [K in keyof HitFacts]: HitFacts[K] } = {};
  if (m.whole) out.frames = frames(ls);
  const file = same(ls.map((l) => l.file));
  if (file !== undefined) out.events = [file];
  const factor = same(ls.map((l) => round(l.scale.factor)));
  if (factor !== undefined) out.factor = factor;
  const element = same(ls.map((l) => l.element));
  if (element) out.element = element;
  const poise = same(ls.map((l) => (l.poise ? valueExpr(l.poise.value) : null)));
  if (poise !== undefined) out.poise = poise;
  const ctl = same(ls.map((l) => l.poise?.controlledOnly ?? false));
  if (ctl !== undefined) out.poiseControlledOnly = ctl;
  const detached = same(ls.map((l) => l.detached));
  if (detached !== undefined) out.detached = detached;
  // Energy: one grant going with each landing, with no condition of its own.
  const grants = ls.map((l) => {
    const i = folded.landings.indexOf(l);
    const here = folded.energy.filter((e) => e.landing === i);
    if (here.length === 0) return null;
    const e = here[0] as (typeof here)[number];
    if (here.length > 1 || e.isPercent || e.controlledOnly || e.steps.length !== l.steps.length) return undefined;
    return valueExpr(e.value, e.coefficient) ?? undefined;
  });
  if (!grants.includes(undefined)) {
    const energy = same(grants);
    if (energy !== undefined) out.energy = energy;
  }
  return out;
}

/** The energy block a kit gives a skill: its energyBlockSeconds, or the duration of an energy-blocking buff its own cast trigger applies (Laevatain's show_weapon). */
export function kitEnergyBlock(
  skill: { readonly skillId: string; readonly energyBlockSeconds?: number },
  triggers: readonly { readonly on: { readonly event: string; readonly skills?: readonly string[] }; readonly do: readonly { readonly kind: string; readonly buff?: string }[] }[],
  buffs: readonly { readonly id: string; readonly blocksEnergy?: boolean; readonly duration?: unknown }[],
): number | null {
  if (skill.energyBlockSeconds !== undefined) return skill.energyBlockSeconds;
  const castBuffs = triggers.filter((t) => t.on.event === "cast" && t.on.skills?.includes(skill.skillId)).flatMap((t) => t.do.flatMap((a) => (a.kind === "buff" && a.buff !== undefined ? [a.buff] : [])));
  const b = buffs.find((x) => x.blocksEnergy && castBuffs.includes(x.id) && typeof x.duration === "number");
  return b ? (b.duration as number) : null;
}
