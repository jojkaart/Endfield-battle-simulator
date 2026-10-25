// Checks a log fixture: predicts every logged hit that a kit covers from the
// stored build, the logged buff effects and what the replay of the logged
// casts decides (buffreplay.ts; docs/design.md, "What the replay decides"),
// and compares with the real damage.

import {
  allActions,
  applyBuff,
  Attr,
  attrModifier,
  computeHit,
  computeReaction,
  effectiveKit,
  evalContext,
  evaluate,
  FPS,
  hitAvailable,
  kitBuffModifiers,
  kitHitEntries,
  linkValue,
  readingDoesNotApply,
  test,
  triggerSkillId,
  type Build,
  computeStats,
  corrosionModifier,
  corrosionShred,
  DEFAULT_STAT_OPTIONS,
  foodOf,
  parseReactionEvent,
  roundDamage,
  skillValue,
  SNAPSHOT_ZONES,
  STATUS_FRAMES,
  type GameData,
  type HitDamage,
  type KitHit,
  type LandedHit,
  type KitSkill,
  type Modifier,
  type OperatorKit,
  type ReactionKind,
  type Situation,
  type SkillType,
  type StatPanel,
} from "@efsim/engine";
import { isBuffFileListed, readBuffFile, type LogEffect, type LogFixture, type LogHit, type RawBuffFile } from "@efsim/data";
import { assumeValues, valueAssumptions, valueReads } from "./hitvalues.ts";
import { placeHits, type LoggedCast, type Placement } from "./logcasts.ts";
import { atLayers, disagreementRuns, REPLAY_EDGE_MS, REPLAY_EXPIRY_SLACK, replayedHits, replayKitBuffs, type BuffReplay, type ConsumedBuffs, type DisagreementRun, type Fact, type ReplayCastFacts, type ReplayedHits } from "./buffreplay.ts";

/** What a reading of a logged hit takes for granted that the log doesn't say. */
export type AssumptionKind =
  /** The log couldn't tell whether the hit crit. */
  | "crit"
  | "noCrit"
  /** Which buffs starting or ending at the hit applied (boundarySubsets). */
  | "boundary"
  /** Corrosion's level (the log lists Corrosion without a value), where the replay's landing has none (corrosionAt). */
  | "corrosion"
  /** A status hit's stacks. */
  | "stacks"
  /** Which of several kit hits the logged event is. */
  | "kitHit"
  /** A hit's situational parts (KitHit.if, extraScale) taken as met. */
  | "situational"
  /** The count of the event behind a value (eventCounts), where the replay saw no window. */
  | "eventCount"
  /** What a value reads that only a fight knows (hitvalues.ts), where the replay's landing doesn't say. */
  | "value"
  /** Buffs the hit's cast consumes, which the log doesn't list, where the replay can't say (castBuffVariants). */
  | "unloggedCastBuff"
  /** The hitter's own kit buffs, or their crit parts, which the log doesn't list (unloggedOwnBuffs). */
  | "unloggedOwnBuff"
  /** Link stacks on the cast, where the replay can't say (linkVariants). */
  | "link"
  /** An enemy-side team aura the log doesn't list (unloggedEnemyAuras). */
  | "enemyAura"
  /** Layers of a layered buff the log lists once (layerVariants). */
  | "layers"
  /** An unquantified buff valued from a kit (unquantifiedFromKit). */
  | "unquantifiedFromKit"
  /** The log's own buff listing where the kit-buff replay's reading fits nothing (LOG_LISTING). */
  | "logListing";

export interface Assumption {
  readonly kind: AssumptionKind;
  /** How the report names it. */
  readonly label: string;
  /** The buffs (or the kit hit) it is about, if any. */
  readonly buffs?: readonly string[];
  /** Its count (a level, layers, stacks, an event count, Link stacks), if any. */
  readonly n?: number;
}

/** How many readings of a hit gave a damage value, and how many of them were within ±1 of the log. */
export interface Readings {
  readonly tried: number;
  readonly matching: number;
}

/** A match's class: no assumption, assumptions, or only with the log's buff listing (the replay's reading fitting nothing). */
export type MatchClass = "plain" | "assumed" | "fallback";

/** Why a covered hit can't be judged (an unquantified verdict). */
export type UnquantifiedReason =
  /**
   * Under Corrosion, whose level no reading fits but whose least and most shred bracket the damage (corrosionBounds:
   * its ramp isn't modelled for every log yet).
   */
  | "corrosion"
  /** The fight's killing blow: its uncapped value is the log's overkill estimate. */
  | "killingBlow"
  /** Fixed DMG a fight computes. */
  | "fixedDamage"
  /** A status hit of an operator without a kit. */
  | "noKit";

export type HitVerdict =
  | {
      readonly kind: "match";
      readonly hit: LogHit;
      readonly predicted: number;
      /** The assumptions' labels (as the report shows them). */
      readonly assumed: readonly string[];
      readonly assumptions: readonly Assumption[];
      readonly class: MatchClass;
      readonly readings: Readings;
    }
  | { readonly kind: "mismatch"; readonly hit: LogHit; readonly predicted: readonly number[]; readonly ratio: number; readonly readings: Readings }
  | { readonly kind: "uncovered"; readonly hit: LogHit }
  /** A covered hit under an effect the log can't quantify and the engine doesn't model yet (`reason`); not a mismatch. */
  | { readonly kind: "unquantified"; readonly hit: LogHit; readonly predicted: number; readonly reason: UnquantifiedReason; readonly readings: Readings }
  /**
   * A covered hit no reading fits, under buffs the log lists without a value
   * (not Corrosion) that no kit values (unquantifiedFromKit): the prediction
   * lacks them, so the hit is neither verified nor a mismatch the kits are
   * to blame for. A verified fixture has none (docs/design.md, "What a log
   * check verifies").
   */
  | { readonly kind: "unvalued"; readonly hit: LogHit; readonly predicted: number; readonly buffs: readonly string[]; readonly readings: Readings };

/** Every verdict kind, matches split by class: the counts a log check reports and its snapshot pins. */
export type VerdictCount = MatchClass | Exclude<HitVerdict["kind"], "match">;
export const VERDICT_COUNTS: readonly VerdictCount[] = ["plain", "assumed", "fallback", "mismatch", "unvalued", "unquantified", "uncovered"];

/** A verdict's count: a match's class, else its kind. */
export function verdictCount(v: HitVerdict): VerdictCount {
  return v.kind === "match" ? v.class : v.kind;
}

/** Per operator (in team order), how many of its hits got each verdict count. */
export function verdictCounts(fx: LogFixture, verdicts: readonly HitVerdict[]): Record<string, Record<VerdictCount, number>> {
  const out: Record<string, Record<VerdictCount, number>> = {};
  for (const b of fx.team) out[b.operator] = Object.fromEntries(VERDICT_COUNTS.map((k) => [k, 0])) as Record<VerdictCount, number>;
  for (const v of verdicts) {
    const o = (out[v.hit.operator] ??= Object.fromEntries(VERDICT_COUNTS.map((k) => [k, 0])) as Record<VerdictCount, number>);
    o[verdictCount(v)]++;
  }
  return out;
}

const skillTypeCache = new Map<string, SkillType | null>();

/**
 * Logged effects say zone and element but not skill type. A buff's own
 * attribute modifiers do (attribute 17 = basic attack DMG), so the filter
 * comes from its BuffData file when there is one.
 */
function buffSkillType(buffId: string): SkillType | null {
  const cached = skillTypeCache.get(buffId);
  if (cached !== undefined) return cached;
  let result: SkillType | null = null;
  if (isBuffFileListed(buffId)) {
    const types = new Set(
      (readBuffFile(buffId)?.attributeModifiers ?? []).map((m) => attrModifier(m.attr, 0, "")?.skillType).filter((t) => t !== undefined),
    );
    if (types.size === 1) result = [...types][0] as SkillType;
  }
  skillTypeCache.set(buffId, result);
  return result;
}

/** What kind of damage a hit is, for buffs limited to some kinds (BuffData decorate masks). */
export type HitCategory = SkillType | "none" | ReactionKind;

/**
 * Decorate-mask bits whose meaning is established: the skill types (from
 * SkillData DamageActions: basic attacks 128, battle skill 256, ultimate
 * 512, combo 8192) and Arts Burst (33554432: Typhoeus's combo debuff only
 * raises bursts, btl_upload_dbaee23b801d).
 */
const MASK_BITS: Readonly<Record<string, number>> = { basic: 128, battle: 256, ultimate: 512, combo: 8192, burst: 33554432 };
const KNOWN_MASK = Object.values(MASK_BITS).reduce((a, b) => a | b, 0);

const buffCache = new Map<string, RawBuffFile | null>();
function buffFile(buffId: string): RawBuffFile | null {
  if (!buffCache.has(buffId)) buffCache.set(buffId, isBuffFileListed(buffId) ? readBuffFile(buffId) : null);
  return buffCache.get(buffId) ?? null;
}

/** Whether a buff's damage modifiers reach this kind of hit. Masks with unknown bits or other check types aren't filtered. */
function reaches(buffId: string, category: HitCategory | null): boolean {
  const m = buffFile(buffId)?.damageMask;
  if (!m || m.checkType !== 2 || (m.mask & ~KNOWN_MASK) !== 0 || category === null) return true;
  return ((MASK_BITS[category] ?? 0) & m.mask) !== 0;
}

/**
 * Logged instances as the game counts them: a priority-keyed buff
 * (stackingType 1, "effects of the same name don't stack") counts only its
 * strongest instance, and a buff with a literal maximum stack count counts at
 * most that many.
 */
/** A cap the applying skill sets (BuffData useMaxStackCntKey), when the checker can find that skill: null if not. */
export type StackCap = (buffId: string, key: string) => number | null;

/**
 * Caps from the team's sources: the skill that applies a buff is taken to be
 * the source whose ID, without its `sk_` / `passive_` prefix and
 * underscores, starts the buff's ID without `buff_` (passive_equipsuit_spellburst01
 * → buff_equipsuit_spellburst_01_physpellup; sk_wpn_lance_0014 →
 * buff_wpn_lance_0014_damageup).
 */
export function teamStackCaps(panels: readonly StatPanel[]): StackCap {
  const norm = (id: string) => id.replace(/^(sk_|passive_|buff_)/, "").replace(/_/g, "");
  return (buffId, key) => {
    const b = norm(buffId);
    for (const p of panels) for (const [id, bb] of Object.entries(p.sources)) if (b.startsWith(norm(id)) && bb[key] !== undefined) return bb[key] as number;
    return null;
  };
}

/** The skill that applies one of a kit's buffs (a hit's skill or a trigger's source), as kitBuffModifiers finds it. */
function kitBuffSource(kit: OperatorKit, buffId: string): string | undefined {
  return (
    kit.skills.find((s) => s.hits.some((h) => h.buffs?.some((a) => a.buff === buffId)))?.skillId ??
    kit.triggers.filter((t) => allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)).map((t) => triggerSkillId(kit.operator, t))[0]
  );
}

/**
 * Caps of layered buffs whose applying skill the ID prefix doesn't find
 * (batch 4 L2: buff_equipsuit_critsuitatk_01 comes from
 * passive_equipsuit_critsuit_01, buff_equipsuit_poisedmg_01_damagebuff from
 * passive_equipsuit_poisebreak_01): after the prefix rule (teamStackCaps,
 * whose answers stand), the kit buff that stands for the game buff
 * (KitBuff.gameBuff) in a team member's kit, what it wears included: its
 * maximum layers (or kept instances) valued from the skill that applies it
 * in the kit. Null when neither knows.
 */
export function kitStackCaps(data: GameData, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>): StackCap {
  const byPrefix = teamStackCaps([...panels.values()].map((m) => m.panel));
  const cache = new Map<string, number | null>();
  const fromKits = (buffId: string): number | null => {
    for (const { build, panel } of panels.values()) {
      const kit = effectiveKit(data, build);
      for (const def of kit?.buffs ?? []) {
        if (def.gameBuff !== buffId || !kit) continue;
        const source = kitBuffSource(kit, def.id);
        if (!source) continue;
        try {
          const b = applyBuff(data, build, panel, source, def, 0);
          const cap = b?.maxLayers ?? (b?.maxInstances ? b.maxInstances : undefined);
          if (cap !== undefined) return cap;
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e; // its values need a fight
        }
      }
    }
    return null;
  };
  return (buffId, key) => {
    const prefix = byPrefix(buffId, key);
    if (prefix !== null) return prefix;
    if (!cache.has(buffId)) cache.set(buffId, fromKits(buffId));
    return cache.get(buffId) ?? null;
  };
}

function countedInstances(effects: readonly LogEffect[], cap: StackCap = () => null): LogEffect[] {
  const groups = new Map<string, LogEffect[]>();
  for (const e of effects) {
    // Strongest-only buffs of different files with one stacking key are one buff (BuffData stackingKey).
    const st = buffFile(e.buff)?.stacking;
    const k = `${st?.type === 1 && st.key ? `key:${st.key}` : e.buff}|${e.zone}|${e.element}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const out: LogEffect[] = [];
  for (const g of groups.values()) {
    const stacking = buffFile((g[0] as LogEffect).buff)?.stacking;
    const sorted = [...g].sort((a, b) => b.value - a.value);
    const keyed = stacking?.maxStacksKey ? cap((g[0] as LogEffect).buff, stacking.maxStacksKey) : null;
    const limit = stacking?.type === 1 ? 1 : (stacking?.maxStacks ?? keyed ?? sorted.length);
    out.push(...sorted.slice(0, limit));
  }
  return out;
}

export function logModifiers(effects: readonly LogEffect[], category: HitCategory | null = null, cap?: StackCap): Modifier[] {
  return countedInstances(effects.filter((e) => reaches(e.buff, category)), cap).map((e) => {
    const skillType = buffSkillType(e.buff);
    return {
      zone: e.zone,
      value: e.value,
      ...(e.element ? { element: e.element } : {}),
      ...(skillType ? { skillType } : {}),
      source: `log buff ${e.buff}`,
    };
  });
}

/** Every kit hit a logged event key could be (a key can stand for several hits, e.g. two hits of one attack). */
function findHits(data: GameData, build: Build, event: string): [{ skillId: string }, KitHit][] {
  // A poise-only landing (KitHit.poiseOnly) has no logged damage.
  return kitHitEntries(effectiveKit(data, build)).filter((e) => !e.hit.poiseOnly && e.hit.events.includes(event)).map((e) => [{ skillId: e.skillId }, e.hit]);
}

/** Above this many boundary buffs (64 subsets), only none or all are tried. A burst that triggers its wearer's weapon and gear-set buffs has six (fixtures/zmdlogs-dbaee23b801d.json t=8391). */
const MAX_BOUNDARY_SUBSET = 6;

/** Effects with repeats of the same buff, zone, element and value kept once. */
function collapseRepeats(effects: readonly LogEffect[]): LogEffect[] {
  const seen = new Set<string>();
  return effects.filter((e) => {
    const k = `${e.buff}|${e.zone}|${e.element}|${e.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Above this many combinations of instance counts of repeated boundary buffs, only one buff at a time takes a count between none and all. */
const MAX_BOUNDARY_COUNTS = 64;

/**
 * Subsets of the buffs starting or ending at the hit (grouped by buff, since
 * a buff's effects go together). A buff listed twice with the same effects
 * may be one instance ending as its refresh starts (zmdlogs-b7b3762d5da8
 * t=5688: the Vulnerable susceptibilities), so each subset with such repeats
 * is also tried with them counted once.
 *
 * With `repeats`, instead the readings where a buff listed several times
 * (n instances: its most repeated zone and element) has 1 up to n - 1 of
 * them (its first k effects of each zone and element), in every
 * combination with the other buffs' counts (above MAX_BOUNDARY_COUNTS, one
 * buff at a time, the others none or all): several crits at one instant
 * start several layers, and each hit there sees a different count
 * (fixtures/zmdlogs-4e5e1390085e.json t=13314: three Lupine Scarlet
 * layers, two hits used two of them).
 * Readings that give effects an earlier one gave are left out.
 */
export function boundarySubsets(effects: readonly LogEffect[], repeats = false): { effects: LogEffect[]; label: string | null }[] {
  const buffs = [...new Set(effects.map((e) => e.buff))];
  if (buffs.length === 0) return repeats ? [] : [{ effects: [], label: null }];
  const pick = (chosen: string[]) => {
    const picked = effects.filter((e) => chosen.includes(e.buff));
    const label = chosen.length === 0 ? null : chosen.length === buffs.length ? "boundary buffs applied" : `boundary buffs applied: ${chosen.join(", ")}`;
    const once = collapseRepeats(picked);
    return once.length < picked.length ? [{ effects: picked, label }, { effects: once, label: `${label} (refreshed instances once)` }] : [{ effects: picked, label }];
  };
  const subsets = buffs.length > MAX_BOUNDARY_SUBSET ? [...pick([]), ...pick(buffs)] : Array.from({ length: 1 << buffs.length }, (_, mask) => pick(buffs.filter((_, i) => mask & (1 << i)))).flat();
  if (!repeats) return subsets;
  if (buffs.length > MAX_BOUNDARY_SUBSET) return [];
  const key = (e: LogEffect) => `${e.zone}|${e.element}`;
  const instances = buffs.map((b) => {
    const n = new Map<string, number>();
    for (const e of effects) if (e.buff === b) n.set(key(e), (n.get(key(e)) ?? 0) + 1);
    return Math.max(...n.values());
  });
  if (instances.every((n) => n <= 1)) return [];
  // Count vectors: each buff 0..n instances, at least one strictly between.
  let vectors: number[][] = [[]];
  for (const n of instances) vectors = vectors.flatMap((v) => Array.from({ length: n + 1 }, (_, k) => [...v, k]));
  const between = (v: number[]) => v.filter((k, i) => k > 0 && k < (instances[i] as number)).length;
  const total = instances.reduce((p, n) => p * (n + 1), 1);
  vectors = vectors.filter((v) => between(v) >= 1 && (total <= MAX_BOUNDARY_COUNTS || between(v) === 1));
  const sig = (es: readonly LogEffect[]) => JSON.stringify(es.map((e) => [e.buff, e.zone, e.element, e.value]).sort());
  const seen = new Set(subsets.map((s) => sig(s.effects)));
  const out: { effects: LogEffect[]; label: string | null }[] = [];
  for (const v of vectors) {
    const taken = new Map<string, number>();
    const picked = effects.filter((e) => {
      const i = buffs.indexOf(e.buff);
      const k = `${e.buff}|${key(e)}`;
      const n = taken.get(k) ?? 0;
      taken.set(k, n + 1);
      return n < (v[i] as number);
    });
    const s = sig(picked);
    if (seen.has(s)) continue;
    seen.add(s);
    const parts = buffs.flatMap((b, i) => ((v[i] as number) === 0 ? [] : (v[i] as number) === instances[i] ? [b] : [`${b} ×${v[i]} of ${instances[i]}`]));
    out.push({ effects: picked, label: `boundary buffs applied: ${parts.join(", ")}` });
  }
  return out;
}

/**
 * Corrosion's resistance shred, which the log lists without a value: from a
 * Nature burst (natural_natural_corrupt_do) or a Nature reaction onto another
 * infliction (natural_<element>_triggered; newer logs name the reaction
 * buff_common_natural_triggered, without the consumed element: reactioncheck.ts).
 * Both modify attributes 94–98.
 */
export function isCorrosionBuff(buff: string): boolean {
  return buff === "buff_common_natural_natural_corrupt_do" || /^buff_common_natural(_(fire|pulse|cryst))?_triggered$/.test(buff);
}

/**
 * The fight's killing blow: its last logged hit, when the log gives it an
 * uncapped damage above its value. Its value is the HP that was left, and
 * its uncapped damage the log's overkill estimate
 * (fixtures/zmdlogs-4e5e1390085e.json 69142 ms: 39523 logged, 261745
 * "uncapped", ×13 the prediction), so it can't be judged.
 */
function killingBlows(fx: LogFixture): ReadonlySet<LogHit> {
  const last = Math.max(...fx.hits.map((h) => h.t));
  return new Set(fx.hits.filter((h) => h.t === last && h.uncapped !== undefined && h.uncapped > h.value));
}

interface Candidate {
  readonly assumed: readonly Assumption[];
  /** Logged effects taken as active; they become modifiers per hit category (logModifiers). */
  readonly effects: readonly LogEffect[];
  /** Modelled extras, e.g. Corrosion. */
  readonly extra: readonly Modifier[];
  readonly crit: boolean;
  readonly stacks: number;
}

/** Corrosion at a hit as the replay's landing has it (its level, and the engine's shred then), or why the replay can't say. */
type CorrosionFact = Fact<{ readonly level: number; readonly modifier: Modifier }>;

/**
 * Corrosion's level at a logged hit, which the log lists without a value: the level of the Corrosion the engine's
 * damage of the hit's landing in the replay had (LandedHit.modifiers), no assumption. Unknown where the replay has no
 * landing, or has no Corrosion there (its Nature inflictions aren't checked against the log yet): levels 1-4 are tried.
 */
function corrosionAt(landing: LandedHit | Undecided | null): CorrosionFact {
  if (!landing) return { unknown: "a status hit" };
  if ("unknown" in landing) return landing;
  const m = landing.modifiers.find((x) => x.zone === "ignoreResistance" && x.source.startsWith("Corrosion level "));
  if (!m) return { unknown: "the replay has no Corrosion at the hit" };
  return { value: { level: Number(m.source.slice("Corrosion level ".length)), modifier: m } };
}

/** Every combination of what the log leaves open for a hit (with `repeats`, the boundary readings with part of a repeated buff's instances: boundarySubsets). */
function candidates(hit: LogHit, panels: ReadonlyMap<string, { panel: StatPanel }>, stackOptions: readonly number[], repeats = false, corrosionFact: CorrosionFact = { unknown: "no replay" }): Candidate[] {
  const out: Candidate[] = [];
  const corrosion = hit.unquantified.find((u) => isCorrosionBuff(u.buff));
  const known = corrosion && "value" in corrosionFact ? corrosionFact.value : null;
  const corrosionLevels = known ? [known.level] : corrosion ? [1, 2, 3, 4] : [0];
  for (const boundary of boundarySubsets(hit.boundaryEffects, repeats)) {
    const effects = [...hit.effects, ...boundary.effects];
    for (const level of corrosionLevels) {
      const extra: Modifier[] = [];
      const assumed: Assumption[] = boundary.label ? [{ kind: "boundary", label: boundary.label, buffs: [...new Set(boundary.effects.map((e) => e.buff))] }] : [];
      if (corrosion && level > 0) {
        const applierAi = panels.get(corrosion.source)?.panel.attrs[87]?.total ?? 0;
        // The replay's: the engine's shred at the landing (its ramp from the replay's application, the applier's talent cap:
        // corrosionCapScale). Tried levels ramp from the log's start of it, without the cap (as before 2026-10-25).
        if (known) extra.push(known.modifier);
        else extra.push(corrosionModifier(level, hit.t - corrosion.since, applierAi));
        if (!known) assumed.push({ kind: "corrosion", label: `Corrosion level ${level} (the replay can't say: ${(corrosionFact as Undecided).unknown})`, buffs: [corrosion.buff], n: level });
      }
      for (const crit of hit.crit === null ? [false, true] : [hit.crit]) {
        for (const stacks of stackOptions) {
          out.push({
            assumed: [
              ...assumed,
              ...(hit.crit === null ? [crit ? { kind: "crit" as const, label: "crit" } : { kind: "noCrit" as const, label: "no crit" }] : []),
              ...(stackOptions.length > 1 ? [{ kind: "stacks" as const, label: `${stacks} stack(s)`, n: stacks }] : []),
            ],
            effects,
            extra,
            crit,
            stacks,
          });
        }
      }
    }
  }
  return out;
}

/**
 * The most and least resistance Corrosion can shred (corrosionShred): level 1 as applied, and level 4 at its cap (the
 * applier's talent cap included: corrosionCapScale), at the applier's Arts Intensity.
 */
function corrosionRange(data: GameData, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>, source: string): { low: number; high: number } {
  const ai = panels.get(source)?.panel.attrs[87]?.total ?? 0;
  return { low: corrosionShred(1, 0, ai), high: corrosionShred(4, Infinity, ai, corrosionCapScale(data, panels, source)) };
}

/** How the applier's kit raises Corrosion's cap (OperatorKit.statusTweaks capScale, as the timeline judges it; Arcane's talent 2), 1 without one. */
export function corrosionCapScale(data: GameData, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>, source: string): number {
  const member = panels.get(source);
  const tweak = member ? data.kits.operators[member.build.operator]?.statusTweaks?.find((t) => t.status === "corrosion") : undefined;
  if (!member || tweak?.capScale === undefined) return 1;
  return evaluate(tweak.capScale, evalContext(data, member.build, member.panel, tweak.skill ?? "", {}));
}

/**
 * For a hit under Corrosion that no level fits: each reading (boundary buffs, crit, stacks) with the least and the
 * most shred Corrosion can give (corrosionRange), paired. The log's time may be off for Corrosion's ramp (time
 * stops), so a hit whose damage lies between a pair's (±1) may be under a level and time the check doesn't find;
 * one outside every pair can't be Corrosion's doing.
 */
function corrosionBounds(data: GameData, hit: LogHit, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>, stackOptions: readonly number[], repeats: boolean): { low: Candidate; high: Candidate }[] {
  const corrosion = hit.unquantified.find((u) => isCorrosionBuff(u.buff));
  if (!corrosion) return [];
  const range = corrosionRange(data, panels, corrosion.source);
  const out: { low: Candidate; high: Candidate }[] = [];
  for (const boundary of boundarySubsets(hit.boundaryEffects, repeats)) {
    const effects = [...hit.effects, ...boundary.effects];
    for (const crit of hit.crit === null ? [false, true] : [hit.crit]) {
      for (const stacks of stackOptions) {
        const at = (shred: number): Candidate => ({ assumed: [], effects, extra: [{ zone: "ignoreResistance", value: shred, source: "Corrosion bound" }], crit, stacks });
        out.push({ low: at(range.low), high: at(range.high) });
      }
    }
  }
  return out;
}

/**
 * ZMDLogs doesn't log the buffs a cast consumes and then carries on its own
 * hits (KitBuff.consumedBy: Jade Vessel's buff_wpn_claym_0018_normal_skill_comboimbue_atk,
 * Type 50 Yinglung's buff_equipsuit_atk_02_addcombodamage_buff), so for a
 * hit of a kind such buffs act on, every combination of them is tried: each
 * absent or with 1 up to its maximum layers. The first option is none.
 */
function unloggedCastBuffs(data: GameData, build: Build, panel: StatPanel, kind: SkillType | "none", why: string): { label: string | null; buffs: string[]; modifiers: Modifier[] }[] {
  const defs = (effectiveKit(data, build)?.buffs ?? []).filter((b) => kind !== "none" && b.consumedBy?.includes(kind));
  let out: { label: string | null; buffs: string[]; modifiers: Modifier[] }[] = [{ label: null, buffs: [], modifiers: [] }];
  for (const def of defs) {
    const layers: { n: number; modifiers: Modifier[]; total: number }[] = [];
    for (let n = 1; n <= 8; n++) {
      const modifiers = kitBuffModifiers(data, build, panel, def.id, n);
      const total = modifiers.reduce((sum, m) => sum + m.value, 0);
      // Past its maximum, more layers change nothing.
      if (modifiers.length === 0 || (layers.length && total === (layers.at(-1) as { total: number }).total)) break;
      layers.push({ n, modifiers, total });
    }
    out = out.flatMap((o) => [o, ...layers.map((l) => ({ label: [o.label, `${def.id}${l.n > 1 ? ` ×${l.n}` : ""}`].filter((x) => x).join(", "), buffs: [...o.buffs, def.id], modifiers: [...o.modifiers, ...l.modifiers] }))]);
  }
  return out.map((o) => (o.label ? { ...o, label: `unlogged ${o.label} (the replay can't say: ${why})` } : o));
}

/**
 * The buffs a hit's cast consumed and carries on its hits, which ZMDLogs doesn't list: the replay's (ReplayCastFacts
 * consumed: the kit buffs the cast found and used up, with their modifiers as the timeline applies them), no assumption.
 * Where the replay can't say, every combination of the hitter's own such buffs is tried (unloggedCastBuffs).
 */
function castBuffVariants(data: GameData, build: Build, panel: StatPanel, kind: SkillType | "none", consumed: Fact<ConsumedBuffs>): { label: string | null; buffs: string[]; modifiers: readonly Modifier[] }[] {
  if ("value" in consumed) return [{ label: null, buffs: [], modifiers: consumed.value.modifiers }];
  return unloggedCastBuffs(data, build, panel, kind, consumed.unknown);
}

/**
 * The counts of the event behind a hit's values (ValueExpr eventCount: a combo's window count, Si's combo) to read it
 * at: the replay's window count for its cast, no assumption; where the replay can't say (a window it didn't see open,
 * a trigger's hits), 1-4, each with why. A hit whose values don't read it: one reading.
 */
export function eventCounts(h: KitHit, windowCount: Fact<number>): { eventCount: number | undefined; why: string | null }[] {
  if (!JSON.stringify(h).includes('"eventCount"')) return [{ eventCount: undefined, why: null }];
  if ("value" in windowCount) return [{ eventCount: windowCount.value, why: null }];
  return [1, 2, 3, 4].map((n) => ({ eventCount: n, why: windowCount.unknown }));
}

/** Whether a kit hit is a finisher's (SkillData skillSpecification 8), as the timeline judges it: a skill's own hit, not a trigger's. */
function isFinisher(data: GameData, build: Build, skillId: string, hit: KitHit): boolean {
  return data.skills[skillId]?.timing?.specification === 8 && (effectiveKit(data, build)?.skills ?? []).some((s) => s.skillId === skillId && s.hits.includes(hit));
}

/** The finisher multiplier (the enemy's BreakingAttackDamageTakenScalar, attribute 27) as the timeline applies it; ZMDLogs doesn't list it. */
function finisherModifier(data: GameData, enemy: string): Modifier {
  const attr = Attr.BreakingAttackDamageTakenScalar;
  const v = data.enemies[enemy]?.staticAttrs[attr] ?? data.attributeDefaults[attr] ?? 1;
  return { zone: "multiplicative", value: v - 1, source: "Finisher" };
}

/** An assumption about a whole hit the log leaves open: what it adds and how the report names it. */
export interface Variant {
  /** Its assumptions' labels, joined (null: none). */
  readonly label: string | null;
  readonly assumptions: readonly Assumption[];
  readonly modifiers: readonly Modifier[];
  /** Layer counts of layered buffs the log lists once, by buff. */
  readonly layers: ReadonlyMap<string, number>;
}

const NO_VARIANT: Variant = { label: null, assumptions: [], modifiers: [], layers: new Map() };

/** A variant of one assumption. */
function variant(a: Assumption, modifiers: readonly Modifier[], layers: ReadonlyMap<string, number> = new Map()): Variant {
  return { label: a.label, assumptions: [a], modifiers, layers };
}

/** Every pair of a variant of each list, the first of each first. */
function combine(a: readonly Variant[], b: readonly Variant[]): Variant[] {
  return a.flatMap((x) =>
    b.map((y) => ({
      label: [x.label, y.label].filter((l) => l).join(", ") || null,
      assumptions: [...x.assumptions, ...y.assumptions],
      modifiers: [...x.modifiers, ...y.modifiers],
      layers: new Map([...x.layers, ...y.layers]),
    })),
  );
}

/**
 * Enemy-side team auras a kit writes on an enemy buff, which ZMDLogs doesn't
 * list: a kit buff on the enemy whose game buff the log never names, with a
 * modifier whose value is a talent's. The Endministrator's talent 2
 * (buff_chr_0003_endminf_talent_0, an aura on the team: Physical DMG Taken
 * +dmg against enemies carrying her crystals) is written on her
 * `originium_crystals`; in 7e19489ae503 every hit on the sealed enemy is
 * ×1.2 of the prediction without it. The log doesn't say when the crystals
 * are on, so each is tried absent first, then present, as cast-consumed
 * buffs are.
 */
export function unloggedEnemyAuras(data: GameData, fx: LogFixture, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>): Variant[] {
  const listed = new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects, ...h.unquantified].map((e) => e.buff)));
  let out: Variant[] = [NO_VARIANT];
  for (const { build, panel } of panels.values()) {
    for (const def of effectiveKit(data, build)?.buffs ?? []) {
      if (def.target !== "enemy" || (def.gameBuff !== undefined && listed.has(def.gameBuff))) continue;
      if (!def.modifiers.some((m) => typeof m.value === "object" && "talent" in m.value)) continue;
      if (!kitBuffSource(effectiveKit(data, build) as OperatorKit, def.id)) continue; // nothing in the kit applies it
      let modifiers: Modifier[];
      try {
        modifiers = kitBuffModifiers(data, build, panel, def.id, 1);
      } catch (e) {
        if (!readingDoesNotApply(e)) throw e;
        continue; // its values need a fight
      }
      if (modifiers.length > 0) out = combine(out, [NO_VARIANT, variant({ kind: "enemyAura", label: `unlogged enemy buff ${def.id} (${build.operator})`, buffs: [def.id] }, modifiers)]);
    }
  }
  return out;
}

/**
 * ZMDLogs lists a layered buff (BuffData stackingType 8, layers on one
 * timer) once, with one layer's value, however many layers it has: Chen's
 * buff_chr_0005_chen_talent_0_1 in 7e19489ae503 is one 0.08 entry while
 * her ultimate slashes rise a layer (+3.5%) each. Such a buff listed once
 * at a hit is tried at 1 up to its maximum layers (its literal maxStackCnt,
 * or the cap the applying skill sets: kitStackCaps), 1 first, as unlogged
 * cast buffs are. A cap nobody's skill sets falls back to the literal
 * maxStackCnt the file writes beside its key (batch 4 L2).
 */
export function layerVariants(hit: LogHit, cap: StackCap = () => null, decided: ReadonlySet<string> = new Set()): Variant[] {
  const all = [...hit.effects, ...hit.boundaryEffects];
  const counts = new Map<string, number>();
  for (const e of all) counts.set(`${e.buff}|${e.zone}|${e.element}`, (counts.get(`${e.buff}|${e.zone}|${e.element}`) ?? 0) + 1);
  let out: Variant[] = [NO_VARIANT];
  for (const buff of new Set(all.map((e) => e.buff))) {
    const st = buffFile(buff)?.stacking;
    // A buff the kit-buff replay decides comes with its layers already (buffreplay.ts replayedHits).
    if (decided.has(buff)) continue;
    if (st?.type !== 8 || [...counts].some(([k, n]) => k.startsWith(`${buff}|`) && n !== 1)) continue;
    const max = st.maxStacks ?? (st.maxStacksKey ? (cap(buff, st.maxStacksKey) ?? (st.maxStackCnt > 1 ? st.maxStackCnt : null)) : null);
    if (max === null || max <= 1) continue;
    const layers = Array.from({ length: max - 1 }, (_, i): Variant => variant({ kind: "layers", label: `${buff} ×${i + 2} layers`, buffs: [buff], n: i + 2 }, [], new Map([[buff, i + 2]])));
    out = combine(out, [NO_VARIANT, ...layers]);
  }
  return out;
}

/** The hit with each listed-once layered buff's effects at the variant's layer count. */
function withLayers(hit: LogHit, layers: ReadonlyMap<string, number>): LogHit {
  if (layers.size === 0) return hit;
  const scale = (e: LogEffect): LogEffect => {
    const n = layers.get(e.buff);
    return n === undefined ? e : { ...e, value: e.value * n };
  };
  return { ...hit, effects: hit.effects.map(scale), boundaryEffects: hit.boundaryEffects.map(scale) };
}

/**
 * The logged hit a Combustion tick keeps its attacker side from (effects.ts
 * SNAPSHOT_ZONES): the latest Heat reaction's initial hit by the tick's
 * operator within a Combustion's duration before it, or null (a forced
 * Combustion has no initial hit: the tick's own effects are used).
 */
function combustionSource(fx: LogFixture, tick: LogHit): LogHit | null {
  const ms = ((STATUS_FRAMES.combustion[0] as number) / FPS) * 1000;
  let found: LogHit | null = null;
  for (const h of fx.hits) {
    const r = parseReactionEvent(h.event);
    if (h.operator === tick.operator && r?.kind === "reaction" && r.element === "fire" && h.t <= tick.t && tick.t - h.t <= ms && (!found || h.t >= found.t)) found = h;
  }
  return found;
}

/** One way an unlogged buff may stand at a hit: its modifiers then. */
export interface BuffOption {
  readonly label: string;
  readonly buff: string;
  readonly layers: number;
  readonly modifiers: readonly Modifier[];
}

/** Zones a crit decides: ZMDLogs lists no effect in them (no fixture has one). */
const CRIT_ZONES = new Set(["critRate", "critDamage"]);

const signature = (mods: readonly Modifier[]) => JSON.stringify(mods.map(({ source: _s, ...m }) => m).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

/**
 * What ZMDLogs never lists of an operator's own kit buffs (its own and what
 * it wears; batch 4 L3): the crit-zone part of every buff (no fixture has a
 * crit entry), and all of a buff whose game buff the log never names (an
 * `endsWithCast` one included). Each buff's options: 1 up to its maximum
 * layers and, where a modifier's condition is one only a fight decides,
 * each such branch alone. Crit Rate is left out (the check knows whether a
 * hit crit), and so are buffs a cast consumes (unloggedCastBuffs), on the
 * enemy, or Link.
 */
export function unloggedOwnBuffs(data: GameData, fx: LogFixture, build: Build, panel: StatPanel): BuffOption[][] {
  const kit = effectiveKit(data, build);
  if (!kit) return [];
  const listed = new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects, ...h.unquantified].map((e) => e.buff)));
  const out: BuffOption[][] = [];
  for (const def of kit.buffs) {
    // A buff without modifiers (a timer: Lifeng's p5_timer, whose tick interval is 0 below P5) can't change a hit.
    if (def.target === "enemy" || def.consumedBy || def.link || def.modifiers.length === 0) continue;
    const source = kitBuffSource(kit, def.id);
    if (!source) continue;
    const critOnly = !def.gameBuff || listed.has(def.gameBuff);
    let max: number;
    try {
      max = applyBuff(data, build, panel, source, def, 0)?.maxLayers ?? 1;
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
      continue; // its values need a fight
    }
    const options: BuffOption[] = [];
    const seen = new Set<string>();
    for (let n = 1; n <= Math.min(max, 12); n++) {
      // A condition is decided when the build decides it, and the buff's own layers (n here) whatever the others' are.
      const judge = (when: NonNullable<Modifier["when"]>, others: number) => {
        const layers = (id: string) => (id === def.id ? n : others);
        try {
          return test(when, evalContext(data, build, panel, source, { team: fx.team, buffLayers: layers, buffActive: (id) => layers(id) > 0 }));
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e;
          return undefined; // it reads what only a fight knows
        }
      };
      const decided = (m: Modifier): boolean | undefined => {
        if (!m.when) return true;
        const [none, many] = [judge(m.when, 0), judge(m.when, 99)];
        return none === many ? none : undefined;
      };
      let mods: Modifier[];
      try {
        mods = kitBuffModifiers(data, build, panel, def.id, n);
      } catch (e) {
        if (!readingDoesNotApply(e)) throw e;
        break; // its values need a fight
      }
      mods = mods.filter((m) => m.zone !== "critRate" && (!critOnly || CRIT_ZONES.has(m.zone)) && decided(m) !== false);
      const strip = ({ when: _w, ...m }: Modifier): Modifier => m;
      const sure = mods.filter((m) => decided(m) === true).map(strip);
      const branches = [...new Set(mods.filter((m) => decided(m) === undefined).map((m) => JSON.stringify(m.when)))];
      const sets = branches.length === 0 ? [{ mods: sure, branch: null as number | null }] : branches.map((b, i) => ({ mods: [...sure, ...mods.filter((m) => JSON.stringify(m.when) === b).map(strip)], branch: i + 1 }));
      for (const s of sets) {
        const k = signature(s.mods);
        if (s.mods.length === 0 || seen.has(k)) continue;
        seen.add(k);
        options.push({ label: `unlogged own ${def.id}${n > 1 ? ` ×${n}` : ""}${s.branch !== null ? ` (branch ${s.branch})` : ""}${critOnly ? " crit part" : ""}`, buff: def.id, layers: n, modifiers: s.mods });
      }
    }
    if (options.length) out.push(options);
  }
  return out;
}

/** Above this many combinations of unlogged own buffs at a hit, each buff is tried alone. */
const MAX_OWN_COMBINATIONS = 64;

/** The unlogged own buffs' variants at one logged hit: none first, then their combinations, keeping only what can act on the hit (its element; crit parts on hits that may crit). */
export function ownBuffVariants(options: readonly BuffOption[][], hit: LogHit): Variant[] {
  const fits = (m: Modifier) => (m.element === undefined || m.element === hit.element) && !(hit.crit === false && CRIT_ZONES.has(m.zone));
  const perBuff = options
    .map((list) => {
      const seen = new Set<string>();
      return list.flatMap((o) => {
        const modifiers = o.modifiers.filter(fits);
        const k = signature(modifiers);
        if (modifiers.length === 0 || seen.has(k)) return [];
        seen.add(k);
        return [variant({ kind: "unloggedOwnBuff", label: o.label, buffs: [o.buff], n: o.layers }, modifiers)];
      });
    })
    .filter((l) => l.length > 0);
  const combinations = perBuff.reduce((n, l) => n * (l.length + 1), 1);
  if (combinations > MAX_OWN_COMBINATIONS) return [NO_VARIANT, ...perBuff.flat()];
  return perBuff.reduce<Variant[]>((acc, l) => combine(acc, [NO_VARIANT, ...l]), [NO_VARIANT]);
}

/** The replay doesn't know a fact about a logged hit (BuffReplay castFacts / landing): why, for the labels of the alternatives tried instead. */
export interface Undecided {
  readonly unknown: string;
}

/** The facts the replay has of a logged hit's cast, or why it has none (no replay: `zmdlogs check --log-buffs`). */
function castFactsOf(replay: LogBuffReplay | null, cast: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind"> | undefined): ReplayCastFacts | Undecided {
  if (!replay) return { unknown: "no replay" };
  if (!cast) return { unknown: "a hit the placement doesn't place" };
  return replay.replay.castFacts(cast);
}

/** One fact of a cast's (castFactsOf), or why the replay doesn't know it. */
function castFact<K extends "link" | "windowCount" | "consumed">(facts: ReplayCastFacts | Undecided, key: K): ReplayCastFacts[K] {
  return "unknown" in facts ? facts : facts[key];
}

/** Link's multiplier on a battle skill's or ultimate's hits at `n` stacks. */
const linkModifier = (kind: "battle" | "ultimate", n: number): Modifier => ({ zone: "multiplicative", value: linkValue(kind, n), source: `Link (${n})` });

/**
 * Link stacks on a battle-skill or ultimate hit, which ZMDLogs doesn't list: the stacks its cast used in the replay
 * of the logged casts (Cast.link: the timeline's Link sources, B1), no assumption. Where the replay can't say (`facts`
 * undecided: a cast it couldn't make, or no replay), none and 1–4 are tried, labelled with why.
 */
export function linkVariants(kind: SkillType | null, link: Fact<number>): Variant[] {
  if (kind !== "battle" && kind !== "ultimate") return [NO_VARIANT];
  if ("value" in link) return link.value > 0 ? [{ ...NO_VARIANT, modifiers: [linkModifier(kind, link.value)] }] : [NO_VARIANT];
  return [NO_VARIANT, ...[1, 2, 3, 4].map((n): Variant => variant({ kind: "link", label: `Link ${n} (the replay can't say: ${link.unknown})`, n }, [linkModifier(kind, n)]))];
}

/** Most layers of an unquantified buff tried from a kit. */
const MAX_KIT_LAYERS = 16;

/**
 * An unquantified buff (the log, or a hand annotation, says it acts but not
 * how much) valued from its source's kit: the kit buff, among the source's
 * own and what it wears, that stands for the game buff (KitBuff.gameBuff),
 * with its modifiers at the source's build, 1 up to its maximum layers.
 * Null when no kit buff stands for it (or its values need a fight).
 */
export function unquantifiedFromKit(data: GameData, panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>, u: LogHit["unquantified"][number]): Variant[] | null {
  const member = panels.get(u.source);
  const kit = member ? effectiveKit(data, member.build) : undefined;
  if (!member || !kit) return null;
  for (const def of kit.buffs) {
    if (def.gameBuff !== u.buff) continue;
    const source = kitBuffSource(kit, def.id);
    if (!source) continue;
    const out: Variant[] = [];
    const seen = new Set<string>();
    try {
      const max = applyBuff(data, member.build, member.panel, source, def, 0)?.maxLayers ?? 1;
      for (let n = 1; n <= Math.min(max, MAX_KIT_LAYERS); n++) {
        const modifiers = kitBuffModifiers(data, member.build, member.panel, def.id, n);
        const k = signature(modifiers);
        if (modifiers.length === 0 || seen.has(k)) continue;
        seen.add(k);
        out.push(variant({ kind: "unquantifiedFromKit", label: `unquantified ${u.buff} from kit ${def.id}${n > 1 ? ` ×${n}` : ""}`, buffs: [u.buff, def.id], n }, modifiers));
      }
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
      continue; // its values need a fight
    }
    if (out.length) return out;
  }
  return null;
}

/**
 * Food buffs in a log check. Logs don't record a build's food (Build.food),
 * so a fixture's food is set by hand (with a provenance note). Its lines are
 * in the member's panel for its duration from the fight's start (the panel
 * without it afterwards: `at`); a food buff the log does list on a hit
 * (percentage foods: 40d9's Bottled Duskberry Juice, b7b3's Jakub's Legacy)
 * is dropped from the hit's effects when it is the hitter's food
 * (withoutOwnFood), so setting the food doesn't count it twice. Those two
 * fixtures leave food out: the log already lists it.
 */
export function teamPanels(data: GameData, fx: LogFixture): {
  readonly panels: ReadonlyMap<string, { readonly build: Build; readonly panel: StatPanel }>;
  /** A member's build and panel at a hit's time (ms). */
  readonly at: (operator: string, t: number) => { readonly build: Build; readonly panel: StatPanel } | undefined;
} {
  const panels = new Map(fx.team.map((b) => [b.operator, { build: b, panel: computeStats(data, b) }]));
  const ends = new Map(fx.team.flatMap((b) => {
    const food = foodOf(data, b);
    return food ? [[b.operator, { ms: food.duration * 1000, member: { build: b, panel: computeStats(data, b, { ...DEFAULT_STAT_OPTIONS, withoutFood: true }) } }] as const] : [];
  }));
  return {
    panels,
    at: (operator, t) => {
      const end = ends.get(operator);
      return end && t >= end.ms ? end.member : panels.get(operator);
    },
  };
}

/** A hit without the logged effects that are its hitter's food buffs, which the hitter's panel has (teamPanels). */
export function withoutOwnFood(data: GameData, fx: LogFixture, hit: LogHit): LogHit {
  const build = fx.team.find((b) => b.operator === hit.operator);
  const food = build ? foodOf(data, build) : null;
  if (!food || hit.t >= food.duration * 1000) return hit;
  const own = new Set(food.buffs.map((b) => b.buffId));
  const keep = (e: LogEffect) => !own.has(e.buff);
  if (hit.effects.every(keep) && hit.boundaryEffects.every(keep)) return hit;
  return { ...hit, effects: hit.effects.filter(keep), boundaryEffects: hit.boundaryEffects.filter(keep) };
}

/** The kit-buff replay of a logged fight (buffreplay.ts) and what it makes of the logged hits. */
export interface LogBuffReplay {
  readonly replay: BuffReplay;
  readonly replayed: ReplayedHits;
  readonly runs: readonly DisagreementRun[];
}

export function logBuffReplay(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx)): LogBuffReplay {
  const replay = replayKitBuffs(data, fx, placement);
  const replayed = replayedHits(fx, replay);
  return { replay, replayed, runs: disagreementRuns(fx, replayed) };
}

const NO_LAYERS: ReadonlyMap<string, number> = new Map();

/** The assumption a match carries when only the log's own buff listing fits it, not the kit-buff replay's. */
export const LOG_LISTING = "the log's buff listing";

export interface CheckLogOptions {
  /**
   * Whose word decides the kit buffs (those a kit defines with a game buff the log lists): the kit-buff replay's
   * (default: the engine's triggers on the logged casts, buffreplay.ts), or the log's own listing (as before 2026-10-22).
   */
  readonly buffs?: "replay" | "log";
  /** A replay already made for this fixture (logBuffReplay). */
  readonly replay?: LogBuffReplay;
}

export function checkLog(data: GameData, fx: LogFixture, opts: CheckLogOptions = {}): HitVerdict[] {
  const team = teamPanels(data, fx);
  const panels = team.panels;
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  const caps = kitStackCaps(data, panels);
  const auras = unloggedEnemyAuras(data, fx, panels);
  const finisher = finisherModifier(data, fx.enemy.id);
  const placement = placeHits(data, fx);
  // The hits as the replay decides their kit buffs; with `buffs: "log"`, as logged.
  const replay = opts.buffs === "log" ? null : (opts.replay ?? logBuffReplay(data, fx, placement));
  const replayed = replay?.replayed ?? null;
  const asReplayed = (h: LogHit) => replayed?.hits.get(h) ?? h;
  const noneDecided: ReadonlySet<string> = new Set();
  const killing = killingBlows(fx);
  const ownBuffs = new Map([...panels].map(([op, m]) => [op, unloggedOwnBuffs(data, fx, m.build, m.panel)]));
  const fromKits = new Map<string, Variant[] | null>();
  const valued = (u: LogHit["unquantified"][number]) => {
    const k = `${u.source}|${u.buff}`;
    if (!fromKits.has(k)) fromKits.set(k, unquantifiedFromKit(data, panels, u));
    return fromKits.get(k) ?? null;
  };
  return fx.hits.map((logged): HitVerdict => {
    const hit = asReplayed(logged);
    // The buffs the replay sets at the hit (decidedAt) and those it gives layers (layersAt): their layers aren't tried.
    const layersHere = replayed?.layersAt.get(logged) ?? NO_LAYERS;
    const decided = layersHere.size ? new Set([...(replayed?.decidedAt.get(logged) ?? []), ...layersHere.keys()]) : (replayed?.decidedAt.get(logged) ?? noneDecided);
    const member = team.at(hit.operator, hit.t);
    const reaction = parseReactionEvent(hit.event);
    const found = reaction || !member ? [] : findHits(data, member.build, hit.event);
    if (!member || (found.length === 0 && !reaction)) return { kind: "uncovered", hit: logged };
    const actual = hit.uncapped ?? hit.value;
    const stackOptions = reaction && reaction.kind !== "burst" ? [1, 2, 3, 4] : [1];
    // A Combustion tick's attacker side is its application's (takeAtkSnapshot; fixtures/zmdlogs-4e5e1390085e.json 66004–68449 ms).
    const applied = reaction?.kind === "combustionTick" ? combustionSource(fx, logged) : null;
    const predicted: number[] = [];
    // What the log never lists (batch 4 L3): the operator's own unlogged buffs and crit parts, and Link on a battle skill's or
    // ultimate's hits (the replay's, or tried where it can't say), each tried after every reading without them.
    const kit = effectiveKit(data, member.build);
    const placed = placement.hits.get(logged);
    const kind = placed ? placed.cast.kind : (kit?.skills.find((s) => found.some(([f]) => f.skillId === s.skillId))?.kind ?? null);
    const castFacts = castFactsOf(replay, placed?.cast);
    const link = linkVariants(kind, castFact(castFacts, "link"));
    const stackMax = (id: string) => kit?.stacks.find((x) => x.id === id)?.max ?? 4;
    // The hit's landing in the replay: its kit hit, and the facts its values read there (BuffReplay.landing).
    const landedHit = reaction ? null : replay ? replay.replay.landing(logged) : { unknown: "no replay" };
    const landedHits = landedHit && !("unknown" in landedHit) ? found.filter(([s, h]) => h.id === landedHit.hitId && s.skillId === landedHit.skillId) : [];
    const landing = landedHit && !("unknown" in landedHit) && landedHit.facts && landedHits.length ? { facts: landedHit.facts } : null;
    const landingWhy = landedHit && "unknown" in landedHit ? landedHit.unknown : "a landing the kit hits don't name";
    const corrosionHere = corrosionAt(landedHit);
    /**
     * Every reading of one version of the hit (the replay's, or the log's): the first that matches (its assumptions), and
     * how many readings gave a value and how many of them matched (all are tried, so a match's strength shows).
     */
    const search = (version: LogHit, decided: ReadonlySet<string>, snapshotOf: LogHit | null): { first: { predicted: number; assumptions: Assumption[] } | null; tried: number; matching: number; corrosionBracket: () => boolean } => {
      let first: { predicted: number; assumptions: Assumption[] } | null = null;
      let tried = 0;
      let matching = 0;
      // The hit as read: without logged effects that are the hitter's food buffs (its panel has them).
      const hit = withoutOwnFood(data, fx, version);
      const snapshotFrom = snapshotOf ? withoutOwnFood(data, fx, snapshotOf) : null;
      const unloggedOwn = reaction ? [NO_VARIANT] : combine(ownBuffVariants(ownBuffs.get(hit.operator) ?? [], hit), link);
      // Unquantified buffs a kit values (unquantifiedFromKit), each absent first; not one the hit also lists with values (those stand for it).
      const listedHere = new Set([...hit.effects, ...hit.boundaryEffects].map((e) => e.buff));
      const quantified = hit.unquantified
        .filter((u) => !isCorrosionBuff(u.buff) && !listedHere.has(u.buff))
        .map(valued)
        .filter((v): v is Variant[] => v !== null)
        .reduce<Variant[]>((acc, v) => combine(acc, [NO_VARIANT, ...v]), [NO_VARIANT]);
      // Whole-hit assumptions (enemy auras the log doesn't list, layers of a buff it lists once), the plain reading first:
      // a hit that matches without them keeps matching as before; so do readings with part of a repeated boundary buff's instances, after all others.
      const variants = combine(quantified, combine(unloggedOwn, combine(auras, layerVariants(hit, caps, decided))));
      type Options = (category: HitCategory) => { crit: "always" | "never"; staggered: boolean; conditions: never[]; modifiers: Modifier[] };
      type Reading = { assumptions: Assumption[]; r: { exact: number } };
      /** One reading of a kit hit with its situation, cast buffs and finisher; null when it doesn't apply (the hit is ruled out, or a value needs what the situation doesn't say). */
      const reading = (s: { skillId: string }, h: KitHit, options: Options, mods: readonly Modifier[], situation: Situation, assume: boolean): HitDamage | null => {
        try {
          const base = options(h.reaction?.kind ?? h.damageType);
          const own = isFinisher(data, member.build, s.skillId, h) ? [finisher] : [];
          return computeHit(data, member.build, member.panel, target, s, h, { ...base, modifiers: [...base.modifiers, ...mods, ...own], situation, assumeUnknown: assume });
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e;
          return null;
        }
      };
      /**
       * The readings from the hit's landing in the replay, for the kit hit it landed: the situation its values and
       * conditions read there on its operator's side (LandingFacts: own stacks, own buff layers, who was controlled,
       * Link), no assumption. The enemy's side (its inflictions and Vulnerable, the stacks a hit consumed) isn't taken
       * from the replay yet (its inflictions aren't checked against the log's reactions: 0eef / dbae Typhoeus' bursts
       * consume an infliction the replay doesn't have): what values read of it is tried, labelled. Conditions the
       * situation leaves open are read both ways (assumed). Null without a landing, or when no reading applies: the
       * tried readings then. The placement's other kit hits for the event are tried as before (the landed one can be
       * wrong where a player's timing chooses: Rossi's perfect combo in 4e5e).
       */
      const fromLanding = (c: Candidate, options: Options): Reading[] | null => {
        if (!landing) return null;
        const facts = landing.facts;
        const out: Reading[] = [];
        const enemyWhy = "the enemy's side isn't taken from the replay";
        for (const [s, h] of landedHits) {
          const reads = valueReads(h);
          for (const unlogged of castBuffVariants(data, member.build, member.panel, h.damageType, castFact(castFacts, "consumed"))) {
            for (const { eventCount, why } of eventCounts(h, castFact(castFacts, "windowCount"))) {
              for (const va of [{ assumption: null, label: null }, ...valueAssumptions({ ...reads, stacks: [] }, stackMax)]) {
                const situation: Situation = {
                  team: fx.team, stacks: facts.stacks, castLink: facts.castLink, controlled: facts.controlled, staggered: facts.staggered, enemyHp: facts.enemyHp,
                  buffActive: (id) => (facts.buffLayers[id] ?? 0) > 0, buffLayers: (id) => facts.buffLayers[id] ?? 0, ...(eventCount !== undefined ? { eventCount } : {}),
                };
                const kh = va.assumption ? assumeValues(h, va.assumption, true) : h;
                const [no, yes] = [reading(s, kh, options, unlogged.modifiers, situation, false), kh.extraScale?.length || kh.if ? reading(s, kh, options, unlogged.modifiers, situation, true) : null];
                const assumptions: Assumption[] = [
                  ...(why !== null ? [{ kind: "eventCount" as const, label: `event count ${eventCount} (the replay can't say: ${why})`, n: eventCount as number }] : []),
                  ...(va.label !== null ? [{ kind: "value" as const, label: `${va.label} (${enemyWhy})` }] : []),
                  ...(unlogged.label !== null ? [{ kind: "unloggedCastBuff" as const, label: unlogged.label, buffs: unlogged.buffs }] : []),
                ];
                const undecided: Assumption = { kind: "situational", label: `situational parts assumed (the landing's situation doesn't decide them: ${enemyWhy})` };
                if (no && (!yes || yes.exact === no.exact)) out.push({ assumptions, r: no });
                else {
                  if (no) out.push({ assumptions, r: no });
                  if (yes) out.push({ assumptions: [undecided, ...assumptions], r: yes });
                }
              }
            }
          }
        }
        if (!out.length) return null;
        // The event's other kit hits, as the placement has them (the landed one first).
        const landedIds = new Set(landedHits.map(([, h]) => h));
        const others = found.filter(([, h]) => !landedIds.has(h));
        return [...out, ...triedReadings(c, options, others, `the replay landed ${landedHits.map(([, h]) => h.id).join(", ")}`)];
      };
      /** What the hit's landing in the replay doesn't say, tried: which kit hit, its situational parts, the values that read a fight's state. */
      const triedReadings = (c: Candidate, options: Options, hits: readonly [{ skillId: string }, KitHit][] = found, whyHit?: string): Reading[] => {
        const why = whyHit ?? (landing ? "its values need more than the landing's facts" : landingWhy);
        return hits
          .filter(([s, h]) => hitAvailable(data, member.build, member.panel, s.skillId, h, { team: fx.team }))
          .flatMap(([s, h]) =>
            // A hit whose conditions or extra scale depend on what the log doesn't record (inflictions, stacks): try both outcomes;
            // one whose values read the count of the event behind it (Si's combo): try counts 1-4; buffs its cast would carry unlogged: try them.
            // A finisher takes the enemy's finisher multiplier, as in the timeline.
            castBuffVariants(data, member.build, member.panel, h.damageType, castFact(castFacts, "consumed")).flatMap((unlogged) =>
              (h.extraScale?.length || h.if ? [false, true] : [false]).flatMap((assume) =>
                eventCounts(h, castFact(castFacts, "windowCount")).flatMap(({ eventCount, why: countWhy }) =>
                  // Values that read what only a fight knows (consumed stacks, own stacks, the enemy's stacks: L4, L6): over their range.
                  [{ assumption: null, label: null }, ...valueAssumptions(valueReads(h), stackMax)].flatMap((va) => {
                    const situation = { team: fx.team, ...(eventCount !== undefined ? { eventCount } : {}) };
                    const r = reading(s, va.assumption ? assumeValues(h, va.assumption, true) : h, options, unlogged.modifiers, situation, assume);
                    if (!r) return []; // the hit doesn't happen under this assumption, or a value needs what it doesn't say
                    const assumptions: Assumption[] = [
                      ...(found.length > 1 || whyHit ? [{ kind: "kitHit" as const, label: `kit hit ${h.id} (the replay can't say: ${why})`, buffs: [h.id] }] : []),
                      ...(assume ? [{ kind: "situational" as const, label: `situational parts assumed (the replay can't say: ${why})` }] : []),
                      ...(countWhy !== null ? [{ kind: "eventCount" as const, label: `event count ${eventCount} (the replay can't say: ${countWhy})`, n: eventCount as number }] : []),
                      ...(va.label !== null ? [{ kind: "value" as const, label: `${va.label} (the replay can't say: ${why})` }] : []),
                      ...(unlogged.label !== null ? [{ kind: "unloggedCastBuff" as const, label: unlogged.label, buffs: unlogged.buffs }] : []),
                    ];
                    return [{ assumptions, r }];
                  }),
                ),
              ),
            ),
          );
      };
      /** The readings of one candidate under one variant: each with what it assumes beyond them, and its damage. */
      const readingsOf = (c: Candidate, variant: Variant): { assumptions: Assumption[]; r: { exact: number } }[] => {
        const loggedMods = (category: HitCategory) =>
          snapshotFrom
            ? [...logModifiers(c.effects, category, caps).filter((m) => !SNAPSHOT_ZONES.has(m.zone)), ...logModifiers(snapshotFrom.effects, category, caps).filter((m) => SNAPSHOT_ZONES.has(m.zone))]
            : logModifiers(c.effects, category, caps);
        const options = (category: HitCategory) => ({
          crit: c.crit ? ("always" as const) : ("never" as const), staggered: false, conditions: [], modifiers: [...loggedMods(category), ...c.extra, ...variant.modifiers],
        });
        const results: { assumptions: Assumption[]; r: { exact: number } }[] = reaction
          ? [{ assumptions: [], r: computeReaction(data, member.build, member.panel, target, { ...reaction, stacks: c.stacks }, options(reaction.kind)) }]
          : (fromLanding(c, options) ?? triedReadings(c, options));
        return results;
      };
      const all = [false, true].flatMap((repeats) => variants.map((variant) => ({ repeats, variant })));
      for (const { repeats, variant } of all) {
        for (const c of candidates(withLayers(hit, variant.layers), panels, stackOptions, repeats, corrosionHere)) {
          for (const { assumptions, r } of readingsOf(c, variant)) {
            const p = roundDamage(r.exact);
            tried++;
            if (Math.abs(p - actual) <= 1) {
              matching++;
              first ??= { predicted: p, assumptions: [...c.assumed, ...assumptions, ...variant.assumptions] };
            } else if (first === null) predicted.push(p);
          }
        }
      }
      // Under Corrosion that no level fits: whether some reading's damage with the least and the most shred brackets the log's.
      const corrosionBracket = (): boolean => {
        for (const { repeats, variant } of all) {
          for (const { low, high } of corrosionBounds(data, withLayers(hit, variant.layers), panels, stackOptions, repeats)) {
            const [lo, hi] = [readingsOf(low, variant), readingsOf(high, variant)];
            for (let i = 0; i < lo.length; i++) {
              const [a, b] = [roundDamage((lo[i] as { r: { exact: number } }).r.exact), roundDamage((hi[i] as { r: { exact: number } }).r.exact)];
              if (actual >= Math.min(a, b) - 1 && actual <= Math.max(a, b) + 1) return true;
            }
          }
        }
        return false;
      };
      return { first, tried, matching, corrosionBracket };
    };
    const match = (first: { predicted: number; assumptions: Assumption[] }, readings: Readings): HitVerdict => {
      const fallback = first.assumptions.some((a) => a.kind === "logListing");
      return {
        kind: "match", hit: logged, predicted: first.predicted, assumed: first.assumptions.map((a) => a.label), assumptions: first.assumptions,
        class: fallback ? "fallback" : first.assumptions.length > 0 ? "assumed" : "plain", readings,
      };
    };
    const byReplay = search(hit, decided, applied ? asReplayed(applied) : null);
    if (byReplay.first) return match(byReplay.first, { tried: byReplay.tried, matching: byReplay.matching });
    let readings: Readings = { tried: byReplay.tried, matching: 0 };
    let byLog: ReturnType<typeof search> | null = null;
    // The log's listing where the replay changed the hit, when the replay's reading fits no reading: reported, so the
    // disagreements it settles show (formatBuffReplay).
    const setHere = replayed?.decidedAt.get(logged) ?? noneDecided;
    if (setHere.size > 0) {
      // The log's listing, with the layers the replay gives a buff both have on (not tried: layerVariants).
      byLog = search(atLayers(logged, layersHere), new Set(layersHere.keys()), applied);
      readings = { tried: byReplay.tried + byLog.tried, matching: byLog.matching };
      if (byLog.first) {
        const buffs = [...setHere].sort();
        return match({ ...byLog.first, assumptions: [...byLog.first.assumptions, { kind: "logListing", label: `${LOG_LISTING} (replay: ${buffs.join(", ")})`, buffs }] }, readings);
      }
    }
    const nearest = predicted[0] ?? 0;
    // The killing blow's value is the HP left and its uncapped damage the log's overkill estimate: it can't be judged.
    if (killing.has(logged)) return { kind: "unquantified", hit: logged, predicted: nearest, reason: "killingBlow", readings };
    // Buffs the log lists without a value (not Corrosion) that no kit values: the prediction lacks them. Not a match, and
    // not a mismatch the kits are to blame for either (an unvalued verdict: a verified fixture has none).
    const listedHere = new Set([...hit.effects, ...hit.boundaryEffects].map((e) => e.buff));
    const unvalued = [...new Set(hit.unquantified.filter((u) => !isCorrosionBuff(u.buff) && !listedHere.has(u.buff) && valued(u) === null).map((u) => u.buff))];
    if (unvalued.length > 0) return { kind: "unvalued", hit: logged, predicted: nearest, buffs: unvalued, readings };
    // Corrosion's ramp doesn't fit every log yet (time dilation may pause its ticks; talents change its cap and
    // duration): a hit under Corrosion that matches no level counts as under an unmodelled effect, not a mismatch, when
    // its damage lies between a reading's with the least and the most shred Corrosion can give (corrosionBounds); outside
    // every such range Corrosion can't explain it, and it is a mismatch. Only Corrosion: any other unquantified buff is
    // valued from a kit (a mismatch if no reading fits) or unvalued.
    if (hit.unquantified.some((u) => isCorrosionBuff(u.buff)) && (byReplay.corrosionBracket() || byLog?.corrosionBracket())) {
      return { kind: "unquantified", hit: logged, predicted: nearest, reason: "corrosion", readings };
    }
    // Fixed DMG that a fight computes (Si's recorded damage) can't be judged from one logged hit.
    if (found.some(([, h]) => h.fixedDamage !== undefined)) return { kind: "unquantified", hit: logged, predicted: nearest, reason: "fixedDamage", readings };
    // A status hit by an operator without a kit: its talents and potentials (which can change its statuses) aren't modelled.
    if (reaction && !data.kits.operators[hit.operator]) return { kind: "unquantified", hit: logged, predicted: nearest, reason: "noKit", readings };
    return { kind: "mismatch", hit: logged, predicted: [...new Set(predicted)].slice(0, 6), ratio: actual / (predicted[0] ?? 1), readings };
  });
}


/**
 * Why a log check doesn't verify its fixture (none: it does; docs/design.md, "What a log check verifies"): a
 * mismatch or an unvalued hit, or an operator with a kit and hits the check can judge (covered, and not unmodelled
 * for a reason other than Corrosion) without one plain or assumed match. A log-listing fallback match isn't a
 * mismatch, but it shows the damage with the log's buffs, not the replay's: it doesn't verify an operator alone.
 */
export function verificationProblems(data: GameData, fx: LogFixture, verdicts: readonly HitVerdict[]): string[] {
  const out: string[] = [];
  const name = (op: string) => data.operators[op]?.name ?? op;
  for (const b of fx.team) {
    if (!data.kits.operators[b.operator]) continue;
    const mine = verdicts.filter((v) => v.hit.operator === b.operator);
    const judged = mine.filter((v) => v.kind !== "uncovered" && !(v.kind === "unquantified" && v.reason !== "corrosion"));
    if (judged.length > 0 && !mine.some((v) => v.kind === "match" && v.class !== "fallback")) {
      const n = verdictCounts(fx, mine)[b.operator] as Record<VerdictCount, number>;
      out.push(`${name(b.operator)}: no plain or assumed match among ${judged.length} judged hits (${n.fallback} log-listing fallback, ${n.unquantified} unmodelled)`);
    }
  }
  for (const v of verdicts) {
    if (v.kind === "mismatch") out.push(`${name(v.hit.operator)} t=${v.hit.t} ${v.hit.event}: mismatch, logged ${v.hit.uncapped ?? v.hit.value}, predicted ${v.predicted.join("/")}`);
    if (v.kind === "unvalued") out.push(`${name(v.hit.operator)} t=${v.hit.t} ${v.hit.event}: under ${v.buffs.join(", ")}, which no kit values`);
  }
  return out;
}

export function formatLogCheck(data: GameData, fx: LogFixture, verdicts: readonly HitVerdict[], replay?: LogBuffReplay): string {
  const problems = verificationProblems(data, fx, verdicts);
  const out: string[] = [
    `${fx.id}: ${fx.provenance.url}`,
    problems.length === 0
      ? "Verified: no mismatch or unvalued hit, and every operator with a kit has a plain or assumed match."
      : `Not verified (docs/design.md, "What a log check verifies"): ${problems.length} reason(s), e.g.\n${problems.slice(0, 5).map((p) => `  ${p}`).join("\n")}`,
  ];
  for (const build of fx.team) {
    const mine = verdicts.filter((v) => v.hit.operator === build.operator);
    const n = verdictCounts(fx, mine)[build.operator] as Record<VerdictCount, number>;
    const name = data.operators[build.operator]?.name ?? build.operator;
    const damage = mine.reduce((s, v) => s + v.hit.value, 0);
    const covered = mine.filter((v) => v.kind !== "uncovered").reduce((s, v) => s + v.hit.value, 0);
    const matches = n.plain + n.assumed + n.fallback;
    out.push(
      "",
      `${name} (${build.operator}): ${mine.length} hits, ${matches} match (${n.plain} plain, ${n.assumed} assumed, ${n.fallback} log-listing fallback), ` +
        `${n.mismatch} mismatch, ${n.unvalued} under unvalued buffs, ${n.unquantified} under unmodelled effects, ${n.uncovered} not covered by a kit` +
        ` (${damage ? Math.round((covered / damage) * 100) : 0}% of its damage covered)`,
    );
    const strength = matchStrength(mine);
    if (strength) out.push(`  ${strength}`);
    const assumptions = new Map<string, number>();
    for (const v of mine) if (v.kind === "match") for (const a of v.assumed) assumptions.set(a, (assumptions.get(a) ?? 0) + 1);
    if (assumptions.size) out.push(`  matched assuming: ${[...assumptions].map(([a, k]) => `${a} ×${k}`).join(", ")}`);
    for (const v of mine) {
      if (v.kind !== "mismatch") continue;
      out.push(`  MISMATCH t=${v.hit.t} ${v.hit.event}: logged ${v.hit.uncapped ?? v.hit.value}, predicted ${v.predicted.join(" / ")} (ratio ${v.ratio.toFixed(4)})`);
    }
    const unvalued = new Map<string, number>();
    for (const v of mine) if (v.kind === "unvalued") for (const b of v.buffs) unvalued.set(b, (unvalued.get(b) ?? 0) + 1);
    for (const [b, k] of [...unvalued].sort()) out.push(`  UNVALUED: ${k} hit(s) under ${b}, which the log lists without a value and no kit values`);
    const unmodelled = new Map<string, number>();
    for (const v of mine) if (v.kind === "unquantified") unmodelled.set(v.reason, (unmodelled.get(v.reason) ?? 0) + 1);
    if (unmodelled.size) out.push(`  unmodelled: ${[...unmodelled].sort().map(([r, k]) => `${UNQUANTIFIED_REASONS[r as UnquantifiedReason]} ×${k}`).join(", ")}`);
    const uncovered = new Map<string, number>();
    for (const v of mine) if (v.kind === "uncovered") uncovered.set(v.hit.event, (uncovered.get(v.hit.event) ?? 0) + 1);
    for (const [event, k] of [...uncovered].sort()) out.push(`  not covered: ${event} ×${k}`);
  }
  if (replay) out.push("", ...formatBuffReplay(data, replay, verdicts));
  return out.join("\n");
}

const UNQUANTIFIED_REASONS: Readonly<Record<UnquantifiedReason, string>> = {
  corrosion: "Corrosion within its range but at no level that fits",
  killingBlow: "the killing blow",
  fixedDamage: "Fixed DMG a fight computes",
  noKit: "a status hit of an operator without a kit",
};

/** Below this share of plain matches, an operator's matches are flagged as mostly assumed (docs/design.md, "What a log check verifies"). */
export const MOSTLY_ASSUMED = 0.5;

/** How strong an operator's matches are, or null without one: readings per match, and a flag when most are assumed or fallback. */
export function matchStrength(verdicts: readonly HitVerdict[]): string | null {
  const matches = verdicts.filter((v): v is Extract<HitVerdict, { kind: "match" }> => v.kind === "match");
  if (matches.length === 0) return null;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor((s.length - 1) / 2)] as number;
  };
  const tried = matches.map((m) => m.readings.tried);
  const lone = matches.filter((m) => m.readings.matching === 1 && m.readings.tried >= 100).length;
  const plain = matches.filter((m) => m.class === "plain").length;
  const fallback = matches.filter((m) => m.class === "fallback").length;
  const flag = fallback * 2 > matches.length ? " — FLAG: mostly log-listing fallback" : plain < matches.length * MOSTLY_ASSUMED ? " — FLAG: mostly assumed" : "";
  return `strength: readings per match median ${median(tried)} tried (max ${Math.max(...tried)}), ${median(matches.map((m) => m.readings.matching))} matching; ${lone} matched by the only fitting reading of ≥100${flag}`;
}

const seconds = (ms: number) => (ms / 1000).toFixed(1);

/** The kit-buff replay's part of the check's report: what it decides, what it can't, and where it and the log disagree. */
export function formatBuffReplay(data: GameData, r: LogBuffReplay, verdicts: readonly HitVerdict[] = []): string[] {
  const name = (op: string) => data.operators[op]?.name ?? op;
  const out = [`Kit buffs from the replay of the logged casts: ${r.replay.decided.size} decided by kit triggers (near a change in the replay, within ${REPLAY_EDGE_MS} ms and ${REPLAY_EXPIRY_SLACK * 100}% of an expiring instance's life, the log's listing stands):`];
  for (const [g, defs] of [...r.replay.decided].sort()) out.push(`  ${g}: ${defs.join(", ")}`);
  for (const [g, why] of [...r.replay.undecided].sort()) out.push(`  as the log lists it: ${g} (${why})`);
  if (r.replay.failed.length) {
    out.push(`  casts the replay couldn't make: ${r.replay.failed.length}`);
    for (const f of r.replay.failed.slice(0, 5)) out.push(`    ${f.cast.operator} ${f.cast.skillId} at ${f.cast.start} ms: ${f.error}`);
  }
  if (r.runs.length === 0) {
    out.push("  The replay and the log agree at every logged hit where the replay decides.");
    return out;
  }
  out.push("  Where the replay and the log disagree (leads: a log gap, or a kit trigger that's wrong), and which the damage fits:");
  const disputed = new Set(r.replayed.disagreements.map((d) => `${d.buff}|${d.operator}|${d.t}`));
  const byHit = new Map(verdicts.map((v) => [v.hit, v]));
  for (const x of r.runs) {
    const what = x.on === "replay" ? "replay on, log doesn't list it" : x.on === "log" ? "log lists it, replay off" : `instances (log/replay) ${(x.counts ?? []).join(", ")}`;
    const span = x.from === x.to ? `at ${seconds(x.from)} s` : `${seconds(x.from)}–${seconds(x.to)} s`;
    // The run's hits: a match without the log's listing fits the replay; one only with it, the log.
    const fits = { replay: 0, log: 0, neither: 0 };
    for (const [h, judged] of r.replayed.judgedAt) {
      if (h.operator !== x.operator || h.t < x.from || h.t > x.to || !judged.has(x.buff) || !disputed.has(`${x.buff}|${h.operator}|${h.t}`)) continue;
      const v = byHit.get(h);
      if (v?.kind === "match") fits[v.class === "fallback" ? "log" : "replay"]++;
      // A hit no reading fits (mismatch), or one under effects the check can't value (unvalued, unmodelled), fits neither.
      else if (v && v.kind !== "uncovered") fits.neither++;
    }
    const fit = verdicts.length ? ` (fit the replay ${fits.replay}, the log ${fits.log}, neither ${fits.neither})` : "";
    out.push(`    ${x.buff} on ${name(x.operator)}: ${what}, ${x.hits} hit(s) ${span}${fit}`);
  }
  return out;
}

export interface ImpliedScale {
  readonly event: string;
  readonly unquantified: readonly string[];
  readonly t: number;
  readonly crit: boolean | null;
  readonly value: number;
  /** The multiplier this hit must have had, assuming each skill type's damage bonus. */
  readonly bySkillType: Readonly<Record<SkillType, number>>;
}

/**
 * For writing kits: the skill multiplier each logged hit of an operator
 * implies, given the build and the logged buffs (logged damage ÷ damage at
 * multiplier 1). Matching these to SkillPatchTable values tells which key a
 * projectile or ability entity uses.
 */
export function impliedScales(data: GameData, fx: LogFixture, operator: string): ImpliedScale[] {
  const build = fx.team.find((b) => b.operator === operator);
  if (!build) throw new Error(`${operator} isn't in ${fx.id}`);
  const team = teamPanels(data, fx);
  const anySkill = Object.keys(data.operators[operator]?.skillGroups ?? {})[0];
  if (!anySkill) throw new Error(`${operator} has no skills`);
  const skill: KitSkill = { skillId: anySkill, label: "", kind: "basic", hits: [] };
  return fx.hits
    .filter((h) => h.operator === operator && h.element !== null)
    .map((logged) => {
      const h = withoutOwnFood(data, fx, logged);
      const panel = team.at(operator, h.t)?.panel as StatPanel;
      const bySkillType = {} as Record<SkillType, number>;
      for (const type of ["basic", "battle", "combo", "ultimate"] as const) {
        const hit: KitHit = { id: "x", label: "", scale: [], count: 1, events: [], damageType: type, element: h.element ?? "physical" };
        const unit = computeHit(data, build, panel, { enemy: fx.enemy.id, level: fx.enemy.level }, skill, hit, {
          crit: h.crit ? "always" : "never",
          staggered: false,
          conditions: [],
          modifiers: logModifiers(h.effects, type),
        }).exact;
        bySkillType[type] = (h.uncapped ?? h.value) / unit;
      }
      return { event: h.event, unquantified: h.unquantified.map((u) => u.buff), t: h.t, crit: h.crit, value: h.uncapped ?? h.value, bySkillType };
    });
}

export interface ScaleMatch {
  readonly event: string;
  readonly hits: number;
  readonly matches: readonly { readonly skillId: string; readonly keys: readonly string[]; readonly damageType: SkillType; readonly corrosion: number; readonly agree: number }[];
}

/**
 * For writing kits: which of the operator's skill values (one key, or a
 * product of two) explain each logged event's damage, per skill type and
 * Corrosion level. `agree` counts the event's hits that value reproduces
 * within ±1.
 */
export function findScales(data: GameData, fx: LogFixture, operator: string): ScaleMatch[] {
  const build = fx.team.find((b) => b.operator === operator);
  const op = data.operators[operator];
  if (!build || !op) throw new Error(`${operator} isn't in ${fx.id}`);
  const team = teamPanels(data, fx);
  const panel = team.panels.get(operator)?.panel as StatPanel;
  const panels = team.panels;
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  const values: { skillId: string; key: string; value: number }[] = [];
  for (const skillId of Object.keys(op.skillGroups)) {
    const skill = data.skills[skillId];
    if (!skill) continue;
    const level = skill.levels[build.skillLevels[op.skillGroups[skillId] as SkillType] - 1];
    for (const [key, value] of Object.entries({ ...skill.defaults, ...(level?.blackboard ?? {}) })) {
      if (value > 0 && value < 100) values.push({ skillId, key, value: skillValue(data, panel, build, skillId, key) });
    }
  }
  const byEvent = new Map<string, LogHit[]>();
  for (const logged of fx.hits) {
    const h = withoutOwnFood(data, fx, logged);
    if (h.operator === operator && h.element && !parseReactionEvent(h.event)) byEvent.set(h.event, [...(byEvent.get(h.event) ?? []), h]);
  }
  const out: ScaleMatch[] = [];
  for (const [event, hits] of [...byEvent].sort()) {
    const tally = new Map<string, { skillId: string; keys: string[]; damageType: SkillType; corrosion: number; agree: number }>();
    for (const hit of hits) {
      for (const damageType of ["basic", "battle", "combo", "ultimate"] as const) {
        const kitHit: KitHit = { id: "x", label: "", scale: [], count: 1, events: [], damageType, element: hit.element ?? "physical" };
        for (const c of candidates(hit, panels, [1])) {
          const unit = computeHit(data, build, team.at(operator, hit.t)?.panel ?? panel, target, { skillId: values[0]?.skillId ?? "" }, kitHit, {
            crit: c.crit ? "always" : "never", staggered: false, conditions: [], modifiers: [...logModifiers(c.effects, damageType), ...c.extra],
          }).exact;
          const need = (hit.uncapped ?? hit.value) / unit;
          const corrosion = c.assumed.find((a) => a.kind === "corrosion")?.n ?? 0;
          const consider = (skillId: string, keys: string[], v: number) => {
            if (Math.abs(Math.round(unit * v) - (hit.uncapped ?? hit.value)) > 1) return;
            const id = `${skillId}|${keys.join("*")}|${damageType}|${corrosion}`;
            const t = tally.get(id) ?? { skillId, keys, damageType, corrosion, agree: 0 };
            t.agree++;
            tally.set(id, t);
          };
          for (const a of values) {
            consider(a.skillId, [a.key], a.value);
            if (Math.abs(a.value - need) / need > 0.5) continue;
            for (const b of values) if (b.skillId === a.skillId && b.key !== a.key && b.key > a.key) consider(a.skillId, [a.key, b.key], a.value * b.value);
          }
        }
      }
    }
    out.push({ event, hits: hits.length, matches: [...tally.values()].sort((x, y) => y.agree - x.agree).slice(0, 8) });
  }
  return out;
}

/** A logged hit as the simulation of the logged casts has it (simulateLog). */
export interface SimulatedHit {
  readonly hit: LogHit;
  /** Its landing's damage in the replay (crit as logged, the log's effects no kit models added), or why there is none. */
  readonly simulated: number | { readonly unknown: string };
}

/** Logged effects the timeline models itself (its statuses: reactions, physical statuses, Stagger), which the simulation doesn't add. */
const ENGINE_STATUS_BUFF = /_triggered(_do)?$|^buff_physical_|poise_break/;

/**
 * The end point of the log check (docs/review-2026-10.md 3.2): the logged casts simulated on the timeline and each
 * logged hit compared with its landing's damage. From the log only the crits (TimelineScenario.loggedCrits), the
 * enemy's HP (as the replay has it) and the effects no kit models (a buff no team kit stands for, not one of the
 * timeline's own statuses, not the hitter's food: added to the landing, TimelineScenario.loggedModifiers); everything
 * else (kit buffs, Link, stacks, Corrosion, consumed buffs) is the engine's. Hits the replay doesn't land have no value.
 */
export function simulateLog(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx)): SimulatedHit[] {
  const kitBuffs = new Set(fx.team.flatMap((b) => (effectiveKit(data, b)?.buffs ?? []).flatMap((x) => (x.gameBuff ? [x.gameBuff] : []))));
  const caps = kitStackCaps(data, teamPanels(data, fx).panels);
  const loggedModifiers = (h: LogHit) => logModifiers(withoutOwnFood(data, fx, h).effects.filter((e) => !kitBuffs.has(e.buff) && !ENGINE_STATUS_BUFF.test(e.buff)), null, caps);
  const replay = replayKitBuffs(data, fx, placement, { loggedModifiers });
  return fx.hits.map((hit) => {
    const l = replay.landing(hit);
    return { hit, simulated: "unknown" in l ? l : l.damage };
  });
}

/** The simulation's report: per operator, the logged hits it lands, how many within ±1, and the median ratio of logged to simulated damage. */
export function formatSimulatedLog(data: GameData, fx: LogFixture, hits: readonly SimulatedHit[]): string {
  const out = [`${fx.id}: the logged casts simulated (crits, the enemy's HP and effects no kit models from the log; the rest the engine's)`];
  for (const b of fx.team) {
    const mine = hits.filter((x) => x.hit.operator === b.operator);
    const landed = mine.filter((x): x is SimulatedHit & { simulated: number } => typeof x.simulated === "number");
    const within = landed.filter((x) => Math.abs(x.simulated - (x.hit.uncapped ?? x.hit.value)) <= 1).length;
    const ratios = landed.map((x) => (x.hit.uncapped ?? x.hit.value) / Math.max(1, x.simulated)).sort((p, q) => p - q);
    const median = ratios.length ? (ratios[Math.floor((ratios.length - 1) / 2)] as number).toFixed(4) : "-";
    out.push(`  ${data.operators[b.operator]?.name ?? b.operator}: ${mine.length} hits, ${landed.length} landed, ${within} within ±1, median logged/simulated ${median}`);
  }
  return out.join("\n");
}
