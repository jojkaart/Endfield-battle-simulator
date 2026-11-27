// The log check's engine side (owner, 2026-10-25: "if our engine can simulate something, the log [check] should run
// that and compare the result with what the log says"). A logged hit is computed through the engine's own damage path
// at its landing in the replay of the logged casts (engine landingDamage, with the timeline's damageOptions there: kit
// buffs and their layers, Link, statuses, Stagger, the finisher, consumed buffs, the situation), and the log supplies
// only what the engine can't produce: the crit flag, buffs no kit defines (and the hitter's food the log lists), the
// enemy's HP (in the replay), and the outcome of what the replay can't judge (chance and enemy-action triggers, heals of
// the controlled operator). The log's listing of the buffs the engine models verifies the engine's modifiers instead of
// replacing them: where they differ is reported (logDifferences). docs/design/data.md, "The log check's rule".

import {
  ARTS_ELEMENTS, Attr, activeModifiers, corrosionModifier, effectiveKit, readingOf, FPS, kitBuffModifiers, kitHitEntries, landingDamage, linkValue, parseReactionEvent, readingDoesNotApply, roundDamage, SNAPSHOT_ZONES,
  type DamageOptions, type DamageTarget, type GameData, type KitBuff, type KitHit, type LandedHit, type LandingInputs, type Modifier, type SkillType,
} from "@efsim/engine";
import { affixesAsChild } from "@efsim/data";
import { type AbsentLanding, type LogEffect, type LogFixture, type LogHit } from "./zmdlogs.ts";
import type { BuffReplay, Fact, ReplayCastFacts } from "./buffreplay.ts";
import type { Assumption } from "./assumptions.ts";
import { isRecordedBurst, recordedBurst, replayRecord } from "./recordedburst.ts";
import { kindShares, oneSidedLandings, type CountedLanding, type KeyShare, type KindShare, type OneSided } from "./onesided.ts";
import { boundarySubsets, buffFile, isCorrosionBuff, kitStackCaps, logModifiers, teamPanels, withoutOwnFood, type HitCategory, type StackCap } from "./logeffects.ts";

/**
 * The game buffs a battle log lists a kit buff's effects under: its gameBuff, its loggedAs, and the affix buffs those
 * files' Susceptibility and Amp actions create (RawBuffFile.affixes: ZMDLogs names the affix, e.g.
 * buff_common_affixes_vulnerable_natural for Li Zhiyan's talent), or that they stand for as such an action's child
 * buff (affixesAsChild: Ardelia's Arts and Physical Susceptibility children). Without the latter the log's entries
 * counted as buffs no kit defines and were added to the engine's own (4e36, c3c7: Si's hits ×1.28 / 1.56, ×1.24 / 1.48).
 */
export function loggedNames(def: Pick<KitBuff, "gameBuff" | "loggedAs">): string[] {
  const own = [...(def.gameBuff ? [def.gameBuff] : []), ...(def.loggedAs ?? [])];
  return [...new Set([...own, ...own.flatMap((g) => [...(buffFile(g)?.affixes ?? []), ...affixesAsChild(g)])])];
}

/** The team's kit buffs (their own and what they wear) and the game buffs a log lists each under (loggedNames). */
export interface TeamBuffNames {
  /** Kit buff (`owner:id`) → its definition. */
  readonly defs: ReadonlyMap<string, KitBuff>;
  /** Kit buff → the game buffs a log lists it under. */
  readonly ofKitBuff: ReadonlyMap<string, readonly string[]>;
  /** Game buff → the kit buffs a log's entries under it can stand for. */
  readonly byGameBuff: ReadonlyMap<string, readonly string[]>;
}

export function teamBuffNames(data: GameData, fx: Pick<LogFixture, "team">): TeamBuffNames {
  const defs = new Map<string, KitBuff>();
  const ofKitBuff = new Map<string, string[]>();
  const byGameBuff = new Map<string, string[]>();
  for (const b of fx.team) {
    for (const def of effectiveKit(data, b)?.buffs ?? []) {
      const key = `${b.operator}:${def.id}`;
      defs.set(key, def);
      const names = loggedNames(def);
      ofKitBuff.set(key, names);
      for (const g of names) byGameBuff.set(g, [...(byGameBuff.get(g) ?? []), key]);
    }
  }
  return { defs, ofKitBuff, byGameBuff };
}

/**
 * Logged effects of what the timeline models as its own statuses, not as kit buffs: reactions and their statuses
 * (`…_triggered`, `…_triggered_do`: Electrification, Corrosion), physical statuses (`buff_physical_…`: Breach),
 * Stagger (buff_common_poise_break_damage_taken_scale) and Link (buff_common_affixes_combo_trigger).
 */
export const ENGINE_STATUS_BUFF = /_triggered(_do)?$|^buff_physical_|poise_break|^buff_common_affixes_combo_trigger$|_corrupt_do$/;

/** Whether the engine models a logged buff (a team kit buff stands for it, or it is one of the timeline's statuses): its entries then verify the engine, they aren't added. */
export function engineModels(names: TeamBuffNames, buff: string): boolean {
  return names.byGameBuff.has(buff) || ENGINE_STATUS_BUFF.test(buff);
}

/** The effects of a logged hit (inside it, or at its boundary) that the engine doesn't model and the log supplies: buffs no kit defines, not the timeline's statuses, not the hitter's food its panel has. */
export function logOnly(data: GameData, fx: LogFixture, names: TeamBuffNames, hit: LogHit): { effects: LogEffect[]; boundary: LogEffect[] } {
  const h = withoutOwnFood(data, fx, hit);
  const staged = listsGivers(fx);
  const keep = (e: LogEffect) => !engineModels(names, e.buff) || (staged && stageStatus(e));
  const asStage = (effects: readonly LogEffect[]) => effects.filter(keep).flatMap(stageElements);
  return { effects: asStage(h.effects), boundary: asStage(h.boundaryEffects) };
}

/**
 * A stage Electrification's entry as the engine's own Electrification acts: Arts DMG Taken, one entry per Arts element
 * (status.ts statusModifiers). The log lists it without an element; buff_common_pulse_pulse_conduct_triggered_do's
 * damageModifier reaches CheckDamageTypeMask 92 (Heat, Electric, Cryo, Nature), and Physical (mask 129) only where its
 * dynamic `if_contain_physicdamage` is 1, which nothing in the data sets. 207f's physical hits under it read ×0.847
 * (1.33 ÷ 1.57) with it taken for every element, plain without it.
 */
function stageElements(e: LogEffect): LogEffect[] {
  if (e.element !== null && e.element !== undefined) return [e];
  if (!/^buff_common_pulse_pulse_conduct_triggered_do$/.test(e.buff) || e.source != null) return [e];
  return ARTS_ELEMENTS.map((element) => ({ ...e, element }));
}

/**
 * An enemy status the log lists with no giver in a fixture that names the givers (since the 2026-11-16 refresh): the
 * stage's, which no team member applies and the replay can't make, so the log supplies it like a buff no kit defines.
 * The only ones in the development logs are Hard 27's Electrification (Arts DMG Taken +0.24 from ~20 s, renewed about
 * every 20 s: 207fff414d82, 2fd915292bb7, 99fb3c35fda2; every one of their Electrifications, none in a team with an
 * Electric operator), whose Arts hits read ×1.18 without it. Team-applied statuses carry their giver (3,497 of 3,505
 * Electrifications the replay has: docs/open-problems.md, Arts Intensity). Stagger is the replay's own (loggedStaggerSteps).
 */
function stageStatus(e: LogEffect): boolean {
  return (e.source === undefined || e.source === null) && /_triggered_do$|_corrupt_do$/.test(e.buff);
}

/**
 * The stage enemies (an enemy id per stage: `_hdg<n>` is a Hard stage's) whose fights carry a stage-wide effect no kit
 * makes and the fixture doesn't hold as stageFactors yet: Hard 33's slug (eny_0129_slwood_hdg033: its shield and phase
 * factors, buildoffsets.ts OFFSETS_EXPLAINED 6339 and 7b54). The other stage logs are found by what they hold
 * (stageFight).
 */
export const STAGE_ENEMIES: Readonly<Record<string, string>> = {
  eny_0129_slwood_hdg033: "the stage's shield and phase factors (not in the fixtures' stageFactors)",
};

/**
 * Why a fight is a stage fight (a stage-wide effect on every operator's hits, no kit's: backlog after round 16 point
 * 2, the scoreboard's `stage` key), or null: the fixture's stageFactors (8915, c6d8), a stage status the log lists
 * without a giver (Hard 27's Electrification: 207f, 2fd9, 99fb), or a STAGE_ENEMIES enemy.
 */
export function stageFight(fx: LogFixture): string | null {
  if (fx.stageFactors?.length) return "stage factors (the fixture's stageFactors)";
  if (listsGivers(fx) && fx.hits.some((h) => h.effects.some(stageStatus))) return "a stage status (listed without a giver)";
  return STAGE_ENEMIES[fx.enemy.id] ?? null;
}

const giversListed = new WeakMap<LogFixture, boolean>();

/** Whether a fixture's effects name their givers (imports and refreshes since 2026-11-16). */
function listsGivers(fx: LogFixture): boolean {
  let v = giversListed.get(fx);
  if (v === undefined) {
    v = fx.hits.some((h) => h.effects.some((e) => e.source !== undefined && e.source !== null));
    giversListed.set(fx, v);
  }
  return v;
}

/** A reading of a logged hit through the engine's damage path: its damage, and what it takes for granted that the replay doesn't know. */
export interface EngineReading {
  readonly predicted: number;
  readonly assumptions: readonly Assumption[];
}

/** Where the log's listing of a buff the engine models and the engine's modifiers at the landing differ (a lead: a log gap, or the engine's state or values wrong). */
export interface LogDifference {
  /** What it is about: kit buffs (`owner:id`, joined), "Stagger", or "Link". */
  readonly what: string;
  /** "engine": the engine has it, the log doesn't list it; "log": the reverse; "values": both, with other values. */
  readonly kind: "engine" | "log" | "values";
  /** The engine's and the log's entries (zone element value). */
  readonly engine: readonly string[];
  readonly log: readonly string[];
  /**
   * "values" whose sums per zone agree (one side lists as one entry what the other has as layers: 0.216 against two of
   * 0.108): cosmetic, the damage can't tell them apart (round 8: such a group carried the ratio of whatever else moved).
   */
  readonly sameTotals?: true;
}

/** What the check knows of a logged hit besides its landing: the kit hits its event can be, its cast's kind and facts, and the hit a Combustion tick keeps its attacker side from. */
export interface HitPlace {
  readonly found: readonly (readonly [{ readonly skillId: string }, KitHit])[];
  readonly kind: SkillType | null;
  readonly castFacts: ReplayCastFacts | { readonly unknown: string };
  readonly snapshotOf: LogHit | null;
}

/** The engine's side of a log check: the team's buff names, stack caps and the replay. */
export interface EngineCheck {
  readonly data: GameData;
  readonly fx: LogFixture;
  readonly target: DamageTarget;
  readonly names: TeamBuffNames;
  readonly caps: StackCap;
  readonly replay: BuffReplay;
}

export function engineCheck(data: GameData, fx: LogFixture, replay: BuffReplay): EngineCheck {
  return { data, fx, target: { enemy: fx.enemy.id, level: fx.enemy.level }, names: teamBuffNames(data, fx), caps: kitStackCaps(data, teamPanels(data, fx).panels), replay };
}

/** A logged hit's landing in the replay with the inputs its damage was computed from, or why there is none. */
export function landingOf(c: EngineCheck, hit: LogHit): (LandedHit & { readonly inputs: LandingInputs }) | { readonly unknown: string } {
  const l = parseReactionEvent(hit.event) ? c.replay.statusLanding(hit) : c.replay.landing(hit);
  if ("unknown" in l) return l;
  if (!l.inputs) return { unknown: l.fixed ? "Fixed DMG" : "a landing without its damage inputs" };
  return l as LandedHit & { readonly inputs: LandingInputs };
}

/**
 * The stage's damage factor at a logged moment (ms; LogFixture.stageFactors) as a multiplicative modifier, or none. A
 * stage's shield phases scale every hit by one round factor (8915: ×0.5, ×0.05, ×0.2; c6d8: ×0.1) that no table the
 * project reads has and no buff the log lists marks; with it the check judges the rest of those hits.
 */
export function stageModifiers(fx: Pick<LogFixture, "stageFactors">, t: number): Modifier[] {
  const s = fx.stageFactors?.find((w) => t >= w.from && t < w.to);
  return s ? [{ zone: "multiplicative", value: s.factor - 1, source: `stage factor ×${s.factor}` }] : [];
}

/**
 * A replay landing's damage as the check reads it under the fixture's stage factor at `t` (ms), for a view that prints
 * the replay's own value (round 17, the Arcane stage-factors report point 3: `replay 8915` printed 67014 beside a
 * logged 32458 the check matched plain): " (×0.5 stage: 33507)", or "" outside every stage factor. The views' one
 * place for it: `zmdlogs replay`'s LAND lines and `zmdlogs bursts`' rows (the totals' parts carry it already).
 */
export function stageNote(fx: Pick<LogFixture, "stageFactors">, damage: number, t: number): string {
  // The factor as the fixture has it (1 + (0.2 − 1) printed ×0.19999999999999996 before).
  const w = fx.stageFactors?.find((x) => t >= x.from && t < x.to);
  return w ? ` (×${w.factor} stage: ${Math.round(damage * w.factor)})` : "";
}

const LINK = /^Link \(\d+\)$/;
const isLog = (m: Modifier) => m.source.startsWith("log buff ");
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-3 * Math.max(1, Math.abs(a), Math.abs(b));

/** The hit category a landing's log modifiers are for (decorate masks: logeffects.ts maskReaches). */
function categoryOf(inputs: LandingInputs, hit?: KitHit): HitCategory {
  if (inputs.kind === "status") return inputs.reaction.kind;
  const h = hit ?? inputs.hit;
  return h.reaction?.kind ?? h.damageType;
}

/**
 * The log's entries under some game buffs at a hit, without those an engine modifier of the kit buffs `kept`
 * accounts for (same zone, element and value: a log name several kit buffs share, e.g. one affix for two operators'
 * Susceptibility), as modifiers for the hit's category.
 */
export function loggedEntries(c: Pick<EngineCheck, "names" | "caps">, effects: readonly LogEffect[], gameBuffs: ReadonlySet<string>, kept: readonly Modifier[], category: HitCategory): Modifier[] {
  const pool = [...kept];
  const out: LogEffect[] = [];
  for (const e of effects) {
    if (!gameBuffs.has(e.buff)) continue;
    const i = pool.findIndex((m) => m.zone === e.zone && (m.element ?? null) === (e.element ?? null) && near(m.value, e.value) && m.kitBuff !== undefined && (c.names.ofKitBuff.get(`${m.kitBuff.owner}:${m.kitBuff.id}`) ?? []).includes(e.buff));
    if (i >= 0) pool.splice(i, 1);
    else out.push(e);
  }
  return logModifiers(out, category, c.caps);
}

/** One group of alternatives a reading may take (the first: none), each with its assumption and what it changes. */
export interface Alternative {
  readonly assumption: Assumption | null;
  readonly apply: (o: Reading) => Reading;
}

/** The damage path's arguments of one reading of a landing: the options, the inputs, and possibly another kit hit of the event. */
export interface Reading {
  readonly options: DamageOptions;
  /** Another kit hit of the event in place of the landed one, with the skill its values come from. */
  readonly other?: { readonly skill: { readonly skillId: string }; readonly hit: KitHit };
  readonly inputs: LandingInputs;
}

export const NONE: Alternative = { assumption: null, apply: (o) => o };

/** Above this many combinations of alternatives, each group is tried alone. */
const MAX_COMBINATIONS = 4096;

/**
 * The engine's readings of a logged hit at its landing (landingOf): the primary one first, through the engine's damage
 * path with the timeline's options there, the log's crit, the log-only effects (logOnly) and, for kit buffs the replay
 * can't judge, the log's entries in place of the engine's; then, each labelled, what the replay's own timing or facts
 * leave open (a kit buff or Stagger changing within REPLAY_EDGE_MS, Link, consumed buffs or a combo's count the replay
 * can't say, the event's other kit hits, an unlogged crit, the enemy's side of a condition, Corrosion or a reaction
 * level the replay lacks, log-only buffs at the hit's boundary). Empty without a landing.
 */
export function engineReadings(c: EngineCheck, hit: LogHit, place: HitPlace): { readings: EngineReading[]; primary: number | null; expected?: number; totalsCrit?: TotalsCrit; landing: LandedHit | { readonly unknown: string } } {
  const basis = readingBasis(c, hit, place);
  if ("unknown" in basis.landing) return { readings: [], primary: null, landing: basis.landing };
  const { landing, primary, groups } = basis as ReadingBasis;
  const combos = groups.reduce((n, g) => n * g.length, 1);
  const sets: Alternative[][] = combos <= MAX_COMBINATIONS ? groups.reduce<Alternative[][]>((acc, g) => acc.flatMap((a) => g.map((x) => [...a, x])), [[]]) : [[], ...groups.flatMap((g) => g.slice(1).map((x) => [x]))];
  const readings: EngineReading[] = [];
  let primaryDamage: number | null = null;
  for (const set of sets) {
    const r = set.reduce((o, a) => a.apply(o), primary);
    try {
      const d = landingDamage(c.data, c.target, r.inputs, r.options, r.other);
      const assumptions = set.flatMap((a) => (a.assumption ? [a.assumption] : []));
      if (assumptions.length === 0) primaryDamage ??= roundDamage(d.exact);
      readings.push({ predicted: roundDamage(d.exact), assumptions });
    } catch (e) {
      // A reading where the hit doesn't happen, or a value needs what it doesn't say.
      if (!readingDoesNotApply(e)) throw e;
    }
  }
  // A hit whose crit the log doesn't give: the primary reading at expected crits, for the fight's totals (the readings try
  // both; counting such hits as non-crits biased the totals low: e82d −31%, 0c14 −24%; accuracy plan A3).
  if (hit.crit === null && primaryDamage !== null) {
    // Unless the logged value is one of the two exactly: then it says whether the hit crit (40d9a3c1da37: Si's killing
    // combo finish, 599,622 = ×1.5 the non-crit reading, counted at expected crits as 409,741).
    if (primaryDamage === hit.value) return { readings, primary: primaryDamage, expected: primaryDamage, totalsCrit: "exact", landing };
    // The other crit reading (the primary's own is the replay's read crit under check-crits `replay`); critFromValue
    // is symmetric in its two readings.
    const critOnly = readings.find((r) => r.assumptions.length === 1 && (r.assumptions[0]?.kind === "crit" || r.assumptions[0]?.kind === "noCrit"));
    if (critOnly && critOnly.predicted === hit.value) return { readings, primary: primaryDamage, expected: critOnly.predicted, totalsCrit: "exact", landing };
    // Or near one of the two only (engine assumption totals-crits `read`): the crit the value shows, the reading's own error
    // kept (0c14fb3ce77d: Rossi's first ultimate at 25.2–27.7 s, ×1.032 below the log on every stab for Alesh's
    // unlogged weapon layer, its 27.74 s crit of 326,856 counted at expected crits as 250,328).
    const read = critOnly ? critFromValue(hit.value, primaryDamage, critOnly.predicted, readingOf(c.replay.assume, "totals-crits")) : null;
    if (read !== null) return { readings, primary: primaryDamage, expected: read, totalsCrit: "read", landing };
    try {
      return { readings, primary: primaryDamage, expected: landingDamage(c.data, c.target, primary.inputs, { ...primary.options, crit: "expected" }, primary.other).exact, totalsCrit: "expected", landing };
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
    }
  }
  return { readings, primary: primaryDamage, landing };
}

/**
 * How the fight's totals count a logged hit's crit (engineReadings, for `zmdlogs totals --by crit` and `hits --json`
 * totalsCrit): "known" the log gives it (the primary reading's own), "exact" the value is one of its two readings,
 * "read" it is near one of them only (engine assumption totals-crits `read`), "expected" neither: expected crits, so
 * the hit's part of a total's error is partly the fight's crit luck (0c14-and-operator-curve report point 1: Rossi's
 * "matched −5.7%" in 0c14 was 108k of two ultimate finals counted at expected crits).
 */
export type TotalsCrit = "known" | "exact" | "read" | "expected";

/**
 * What engineReadings reads a logged hit from: its landing, the primary reading (the engine's modifiers with the log's
 * crit and log-only effects) and the groups of alternatives, in the order the readings try them. `edgeToggles`: the
 * groups of kit buffs changing within REPLAY_EDGE_MS of the hit (the buff timing report, bufftiming.ts, tries its own
 * toggles instead).
 */
export interface ReadingBasis {
  readonly landing: LandedHit & { readonly inputs: LandingInputs };
  readonly primary: Reading;
  readonly groups: readonly Alternative[][];
  readonly edgeToggles: ReadonlySet<readonly Alternative[]>;
  /** The engine's modifiers the primary reading keeps (without the log's, and without kit buffs the replay can't judge). */
  readonly judged: readonly Modifier[];
  readonly category: HitCategory;
  /**
   * The log's reading (`zmdlogs hits`' logReading): the primary reading with every team kit buff as the log lists it
   * at the hit in place of the replay's (loggedEntries over all their logged names); the engine's statuses, Stagger,
   * Link and the finisher kept. Off only in timing (the replay's buff windows): a build or kit value error shows under
   * both. Not read by the check.
   */
  readonly logReading: () => Reading;
}

/** What the primary reading needs besides the replay: the check's names and caps (EngineCheck without its replay, which BuffReplay builds the pairing of before there is one). */
export type CheckSide = Pick<EngineCheck, "data" | "fx" | "names" | "caps">;

export function checkSide(data: GameData, fx: LogFixture): CheckSide {
  return { data, fx, names: teamBuffNames(data, fx), caps: kitStackCaps(data, teamPanels(data, fx).panels) };
}

/**
 * The primary reading's parts of a landing at a logged hit (readingBasis): the engine's modifiers (kit buffs,
 * statuses, Link, the finisher) and the stage's factor at the hit, those of kit buffs the replay can't judge
 * (`unjudgedKitBuffs`) left out, their state the log's instead, with the log-only buffs the hit lists (a Combustion
 * tick's attacker side from `snapshotOf`'s). The status pairing reads a pair's fit with them (BuffReplay.statusLanding:
 * statuspairs.ts statusValueFits) before the check has a replay to ask.
 */
export function primaryParts(c: CheckSide, unjudgedKitBuffs: ReadonlyMap<string, string>, hit: LogHit, inputs: LandingInputs, snapshotOf: LogHit | null = null) {
  const category = categoryOf(inputs);
  const own = logOnly(c.data, c.fx, c.names, hit);
  const snapshotOwn = snapshotOf ? logOnly(c.data, c.fx, c.names, snapshotOf) : null;
  const logMods = (effects: readonly LogEffect[], cat: HitCategory) =>
    snapshotOwn
      ? [...logModifiers(effects, cat, c.caps).filter((m) => !SNAPSHOT_ZONES.has(m.zone)), ...logModifiers(snapshotOwn.effects, cat, c.caps).filter((m) => SNAPSHOT_ZONES.has(m.zone))]
      : logModifiers(effects, cat, c.caps);
  // The engine's modifiers (kit buffs, statuses, Link, the finisher), without kit buffs the replay can't judge: their
  // state is the log's; and the stage's factor at the hit (LogFixture.stageFactors), in every reading.
  const engine = [...(inputs.options.modifiers?.filter((m) => !isLog(m)) ?? []), ...stageModifiers(c.fx, hit.t)];
  const unjudged = (m: Modifier) => m.kitBuff !== undefined && unjudgedKitBuffs.has(`${m.kitBuff.owner}:${m.kitBuff.id}`);
  const judged = engine.filter((m) => !unjudged(m));
  const unjudgedNames = new Set([...unjudgedKitBuffs.keys()].flatMap((k) => c.names.ofKitBuff.get(k) ?? []));
  const withLog = (mods: readonly Modifier[], cat: HitCategory) => [...mods, ...logMods(own.effects, cat), ...loggedEntries(c, withoutOwnFood(c.data, c.fx, hit).effects, unjudgedNames, judged, cat)];
  return { category, own, logMods, engine, judged, unjudgedNames, withLog, modifiers: withLog(judged, category) };
}

export function readingBasis(c: EngineCheck, hit: LogHit, place: HitPlace): ReadingBasis | { readonly landing: { readonly unknown: string } } {
  const landing = landingOf(c, hit);
  if ("unknown" in landing) return { landing };
  // A status pair that fits only at the logged hit's frame is read there (BuffReplay.statusInputs).
  const inputs = (parseReactionEvent(hit.event) ? c.replay.statusInputs?.(hit) : null) ?? landing.inputs;
  const op = hit.operator;
  const { category, own, logMods, engine, judged, unjudgedNames, withLog } = primaryParts(c, c.replay.unjudgedKitBuffs, hit, inputs, place.snapshotOf);
  // Where the log doesn't give the crit: the crit the replay read from the log (engine assumption check-crits `replay`:
  // replaycrits.ts, BuffReplay.critSource), else none; the other reading is the assumption.
  const readCrit = hit.crit === null && primaryCritRead(c, hit);
  const crit = hit.crit === null ? (readCrit ? "always" : "never") : hit.crit ? "always" : "never";
  const primary: Reading = { inputs, options: { ...inputs.options, crit, modifiers: withLog(judged, category) } };
  delete (primary.options as { critRoll?: number }).critRoll;

  // The alternatives, by group.
  const groups: Alternative[][] = [];
  const replaceMods = (o: Reading, f: (mods: readonly Modifier[]) => Modifier[]): Reading => ({ ...o, options: { ...o.options, modifiers: f(o.options.modifiers ?? []) } });
  if (hit.crit === null) {
    groups.push([NONE, readCrit
      ? { assumption: { kind: "noCrit", label: `no crit (the replay read a crit: ${c.replay.critSource(hit)})` }, apply: (o) => ({ ...o, options: { ...o.options, crit: "never" } }) }
      : { assumption: { kind: "crit", label: "crit" }, apply: (o) => ({ ...o, options: { ...o.options, crit: "always" } }) }]);
  }
  // Kit buffs the replay isn't sure of at the hit (its instances change within REPLAY_EDGE_MS, or depend on crits the log
  // doesn't give): as the log lists them there (inside the hit, else at its boundary), or off.
  const unsure = [...c.names.defs.keys()].filter((k) => !c.replay.unjudgedKitBuffs.has(k) && c.replay.kitBuffNearChange(hit, k));
  const toggles: Alternative[][] = unsure.flatMap((k): Alternative[][] => {
    const [owner, id] = k.split(":", 2) as [string, string];
    const ofIt = (m: Modifier) => m.kitBuff?.owner === owner && m.kitBuff.id === id;
    const on = judged.some(ofIt);
    const names = new Set(c.names.ofKitBuff.get(k) ?? []);
    const inside = hit.effects.filter((e) => names.has(e.buff));
    const listed = inside.length ? inside : hit.boundaryEffects.filter((e) => names.has(e.buff));
    const why = "the replay isn't sure of it at the hit: it changes within 500 ms, or with crits the log doesn't give";
    const out: Alternative[] = [];
    if (listed.length) out.push({ assumption: { kind: "boundary", label: `${k} as the log lists it (${why})`, buffs: [k] }, apply: (o) => replaceMods(o, (mods) => [...mods.filter((m) => !ofIt(m)), ...loggedEntries(c, listed, names, judged.filter((m) => !ofIt(m)), category)]) });
    if (on) out.push({ assumption: { kind: "boundary", label: `${k} off (${why})`, buffs: [k] }, apply: (o) => replaceMods(o, (mods) => mods.filter((m) => !ofIt(m))) });
    return out.length ? [[NONE, ...out]] : [];
  });
  const edgeToggles = new Set<readonly Alternative[]>(toggles.length <= 4 ? toggles : toggles.length ? [[NONE, ...toggles.flatMap((g) => g.slice(1))]] : []);
  groups.push(...(edgeToggles as Set<Alternative[]>));
  // Stagger starting or ending near the hit.
  if (c.replay.staggerNearChange(hit.t)) {
    groups.push([NONE, { assumption: { kind: "stagger", label: `${inputs.options.staggered ? "not " : ""}Staggered (the replay's Stagger changes within 500 ms of the hit)` }, apply: (o) => ({ ...o, options: { ...o.options, staggered: !o.options.staggered } }) }]);
  }
  // Link stacks the replay can't say.
  const link = castFact(place.castFacts, "link");
  if (inputs.kind === "hit" && (place.kind === "battle" || place.kind === "ultimate") && "unknown" in link) {
    const kind = place.kind;
    groups.push([NONE, ...[0, 1, 2, 3, 4].map((n): Alternative => ({
      assumption: { kind: "link", label: `Link ${n} (the replay can't say: ${link.unknown})`, n },
      apply: (o) => replaceMods(o, (mods) => [...mods.filter((m) => !LINK.test(m.source)), ...(n > 0 ? [{ zone: "multiplicative" as const, value: linkValue(kind, n), source: `Link (${n})` }] : [])]),
    }))]);
  }
  // Buffs the cast consumed, where the replay can't say (another cast near it, layers from before the log): each of the
  // hitter's buffs its cast's kind consumes at 0 up to its maximum layers, valued by the engine (kitBuffModifiers).
  const consumed = castFact(place.castFacts, "consumed");
  const castKind = place.kind;
  if ("unknown" in consumed && inputs.kind === "hit" && castKind) {
    const ofHitter = (effectiveKit(c.data, inputs.build)?.buffs ?? []).filter((b) => b.consumedBy?.includes(castKind));
    for (const def of ofHitter) {
      const mineNow = judged.filter((m) => m.kitBuff?.owner === op && m.kitBuff.id === def.id);
      const layers: { n: number; mods: Modifier[] }[] = [];
      for (let n = 0; n <= 8; n++) {
        let mods: Modifier[];
        try {
          mods = n === 0 ? [] : kitBuffModifiers(c.data, inputs.build, inputs.panel, def.id, n);
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e;
          break; // its values need a fight
        }
        if (n > 0 && (mods.length === 0 || JSON.stringify(mods) === JSON.stringify(layers.at(-1)?.mods))) break; // past its maximum
        layers.push({ n, mods });
      }
      const alts = layers.filter((l) => l.mods.length !== mineNow.length).map((l): Alternative => ({
        assumption: { kind: "unloggedCastBuff", label: `${def.id} ×${l.n} consumed (the replay can't say: ${consumed.unknown})`, buffs: [def.id], n: l.n },
        apply: (o) => replaceMods(o, (mods) => [...mods.filter((m) => !(m.kitBuff?.owner === op && m.kitBuff.id === def.id)), ...l.mods]),
      }));
      if (alts.length) groups.push([NONE, ...alts]);
    }
  }
  if (inputs.kind === "hit") {
    const landed = inputs.hit;
    // The event's other kit hits (a player's timing chooses some: Rossi's perfect combo).
    const others = place.found.filter(([, h]) => h !== landed && h.id !== landed.id);
    if (others.length) groups.push([NONE, ...others.map(([skill, h]): Alternative => ({ assumption: { kind: "kitHit", label: `kit hit ${h.id} (the replay landed ${landed.id})`, buffs: [h.id] }, apply: (o) => ({ ...o, other: { skill, hit: h } }) }))]);
    // The enemy's side of a condition (its inflictions aren't checked against the log's reactions yet): undecided, both ways.
    if (landed.if || landed.extraScale?.length) {
      const free = (o: Reading, assume: boolean): Reading => {
        const strip = (s: DamageOptions["situation"]) => (s ? (({ enemy: _e, ...rest }) => rest)(s) : s);
        return { ...o, options: { ...o.options, situation: strip(o.options.situation) ?? {}, ...(o.options.modifierSituation ? { modifierSituation: strip(o.options.modifierSituation) ?? {} } : {}), assumeUnknown: assume } };
      };
      groups.push([NONE, ...[true, false].map((assume): Alternative => ({ assumption: { kind: "situational", label: `the enemy's side of its conditions taken as ${assume ? "met" : "not met"} (its inflictions aren't checked against the log)` }, apply: (o) => free(o, assume) }))]);
    }
    // A combo's event count the replay can't say.
    const windowCount = castFact(place.castFacts, "windowCount");
    if (JSON.stringify(landed).includes('"eventCount"') && "unknown" in windowCount) {
      groups.push([NONE, ...[1, 2, 3, 4].map((n): Alternative => ({ assumption: { kind: "eventCount", label: `event count ${n} (the replay can't say: ${windowCount.unknown})`, n }, apply: (o) => ({ ...o, options: { ...o.options, situation: { ...o.options.situation, eventCount: n } } }) }))]);
    }
  } else {
    // A reaction's level as the game had it (the replay's arts state isn't checked against the log's reactions yet).
    const level = inputs.reaction.stacks;
    if (inputs.reaction.kind !== "burst") {
      groups.push([NONE, ...[1, 2, 3, 4].filter((n) => n !== level).map((n): Alternative => ({ assumption: { kind: "stacks", label: `level ${n} (the replay's ${level})`, n }, apply: (o) => ({ ...o, inputs: { ...(o.inputs as Extract<LandingInputs, { kind: "status" }>), reaction: { ...inputs.reaction, stacks: n } } }) }))]);
    }
  }
  // Corrosion the log lists (without a value) where the replay has none: levels 1-4 on the log's clock.
  const corrosion = hit.unquantified.find((u) => isCorrosionBuff(u.buff));
  if (corrosion && !engine.some((m) => m.source.startsWith("Corrosion level "))) {
    const ai = c.fx.team.find((b) => b.operator === corrosion.source) ? (teamPanels(c.data, c.fx).panels.get(corrosion.source)?.panel.attrs[87]?.total ?? 0) : 0;
    groups.push([NONE, ...[1, 2, 3, 4].map((n): Alternative => ({ assumption: { kind: "corrosion", label: `Corrosion level ${n} (the replay has none at the hit)`, buffs: [corrosion.buff], n }, apply: (o) => replaceMods(o, (mods) => [...mods, corrosionModifier(n, hit.t - corrosion.since, ai)]) }))]);
  }
  // Log-only buffs starting or ending at the hit (the log can't say whether they applied).
  // (With part of a repeated buff's instances last: several crits at one instant start several layers.)
  const boundary = [...boundarySubsets(own.boundary), ...boundarySubsets(own.boundary, true)].filter((b) => b.label !== null);
  if (boundary.length) groups.push([NONE, ...boundary.map((b): Alternative => ({ assumption: { kind: "boundary", label: b.label as string, buffs: [...new Set(b.effects.map((e) => e.buff))] }, apply: (o) => replaceMods(o, (mods) => [...mods, ...logModifiers(b.effects, category, c.caps)]) }))]);
  // A layered kit buff the replay can't judge, whose layers the log lists as one entry: at each count up to its maximum.
  for (const g of unjudgedLayered(c, hit, unjudgedNames)) {
    const source = `log buff ${g.buff}`;
    groups.push([NONE, ...Array.from({ length: g.max - 1 }, (_, i): Alternative => ({
      assumption: { kind: "layers", label: `${g.buff} ×${i + 2} layers (the log lists one entry whatever its layers; the replay can't judge ${g.kitBuff})`, buffs: [g.buff], n: i + 2 },
      apply: (o) => replaceMods(o, (mods) => mods.map((m) => (m.source === source ? { ...m, value: m.value * (i + 2) } : m))),
    }))]);
  }

  const logReading = (): Reading => {
    const nonKit = judged.filter((m) => m.kitBuff === undefined);
    const allNames = new Set(c.names.byGameBuff.keys());
    return { inputs, options: { ...primary.options, modifiers: [...nonKit, ...logMods(own.effects, category), ...loggedEntries(c, withoutOwnFood(c.data, c.fx, hit).effects, allNames, nonKit, category)] } };
  };
  return { landing, primary, groups, edgeToggles, judged, category, logReading };
}

/**
 * The game buffs at a hit of kit buffs the replay can't judge (their state is the log's: unjudgedKitBuffs) whose layers
 * run on one timer (BuffData stackingType 8, or 10: each new layer refreshes it), which ZMDLogs lists as one entry at
 * one layer's value whatever the layers: each listed once at the hit, with its most layers (the kit's maxStacks, else
 * the file's). Ember's Pay the Ferric Price (stackingType 10, 3 layers): pending/zmdlogs-04d4…'s hits under its one
 * entry read ×1.023 (her build offset), ×1.085 and ×1.147, a layer's steps; 7e19's finisher ×1.046 and ×1.096.
 */
function unjudgedLayered(c: EngineCheck, hit: LogHit, unjudgedNames: ReadonlySet<string>): { readonly buff: string; readonly kitBuff: string; readonly max: number }[] {
  const out: { buff: string; kitBuff: string; max: number }[] = [];
  const counts = new Map<string, number>();
  for (const e of hit.effects) counts.set(`${e.buff}|${e.zone}|${e.element}`, (counts.get(`${e.buff}|${e.zone}|${e.element}`) ?? 0) + 1);
  for (const buff of new Set(hit.effects.map((e) => e.buff))) {
    if (!unjudgedNames.has(buff) || [...counts].some(([k, n]) => k.startsWith(`${buff}|`) && n !== 1)) continue;
    const st = buffFile(buff)?.stacking;
    if (st?.type !== 8 && st?.type !== 10) continue;
    const kitBuff = (c.names.byGameBuff.get(buff) ?? []).find((k) => c.replay.unjudgedKitBuffs.has(k));
    if (kitBuff === undefined) continue;
    const own = c.names.defs.get(kitBuff)?.maxStacks;
    const max = typeof own === "number" ? own : (st.maxStacks ?? (st.maxStackCnt > 1 ? st.maxStackCnt : null));
    if (max !== null && max > 1) out.push({ buff, kitBuff, max });
  }
  return out;
}

function castFact<K extends "link" | "windowCount" | "consumed">(facts: ReplayCastFacts | { readonly unknown: string }, key: K): ReplayCastFacts[K] | { readonly unknown: string } {
  return "unknown" in facts ? facts : (facts[key] as Fact<never> as ReplayCastFacts[K]);
}

/**
 * Instances per zone and value of some entries (`zone value` → count): the most of any one element (a buff's modifier
 * the kit writes for several elements is one instance; the log lists such a buff once per element, or once without
 * one); a buff the log lists once whatever its layers (BuffData stackingType 8) counts once.
 */
function instancesOf(entries: readonly { zone: string; element?: string | null; value: number; once?: boolean }[]): Map<string, { zone: string; value: number; n: number }> {
  const per = new Map<string, Map<string, number>>();
  const values: { zone: string; value: number; key: string }[] = [];
  for (const e of entries) {
    let v = values.find((x) => x.zone === e.zone && near(x.value, e.value));
    if (!v) values.push((v = { zone: e.zone, value: e.value, key: `${e.zone} ${+e.value.toFixed(6)}` }));
    const m = per.get(v.key) ?? new Map<string, number>();
    m.set(e.element ?? "", e.once ? 1 : (m.get(e.element ?? "") ?? 0) + 1);
    per.set(v.key, m);
  }
  return new Map(values.map((v) => [v.key, { zone: v.zone, value: v.value, n: Math.max(...(per.get(v.key) as Map<string, number>).values()) }]));
}

/**
 * Where the log's listing and the engine's modifiers at a hit's landing differ (LogDifference): per group of kit buffs
 * sharing a logged name, the engine's entries (its modifiers of those kit buffs acting at the landing: their conditions
 * judged as the pipeline judges them) against the log's entries under their names inside the hit, as instances per
 * zone and value (instancesOf); Stagger (the engine's against the log's buff_common_poise_break_damage_taken_scale).
 * Kit buffs the replay can't judge aren't compared (the log decides them), nor crit zones (ZMDLogs lists none).
 */
export function logDifferences(c: EngineCheck, hit: LogHit, landing: LandedHit & { readonly inputs: LandingInputs }): LogDifference[] {
  const out: LogDifference[] = [];
  const { inputs } = landing;
  const engine = activeModifiers(c.data, inputs.build, inputs.panel, inputs.options).filter((m) => m.kitBuff && !isLog(m) && !c.replay.unjudgedKitBuffs.has(`${m.kitBuff.owner}:${m.kitBuff.id}`));
  // Groups: kit buffs linked by a shared logged name.
  const groups: Set<string>[] = [];
  const keyOf = (m: Modifier) => `${m.kitBuff?.owner}:${m.kitBuff?.id}`;
  const add = (k: string) => {
    const names = c.names.ofKitBuff.get(k) ?? [];
    if (!names.length) return;
    const linked = groups.filter((g) => [...g].some((x) => (c.names.ofKitBuff.get(x) ?? []).some((n) => names.includes(n))));
    const merged = new Set([k, ...linked.flatMap((g) => [...g])]);
    for (const g of linked) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  };
  for (const k of new Set(engine.map(keyOf))) add(k);
  const listedKits = new Set(hit.effects.flatMap((e) => (c.names.byGameBuff.get(e.buff) ?? []).filter((k) => !c.replay.unjudgedKitBuffs.has(k))));
  for (const k of listedKits) if (!groups.some((g) => g.has(k))) add(k);
  for (const g of groups) {
    const names = new Set([...g].flatMap((k) => c.names.ofKitBuff.get(k) ?? []));
    const once = [...names].some((n) => buffFile(n)?.stacking.type === 8);
    const mine = engine.filter((m) => g.has(keyOf(m)) && m.zone !== "attribute" && m.zone !== "critRate" && m.zone !== "critDamage").map((m) => ({ ...m, once }));
    const logged = hit.effects.filter((e) => names.has(e.buff)).map((e) => ({ ...e, once }));
    const [ei, li] = [instancesOf(mine), instancesOf(logged)];
    const keys = [...new Set([...ei.keys(), ...li.keys()])];
    const engineOnly: string[] = [];
    const logOnlyHere: string[] = [];
    for (const k of keys) {
      const [a, b] = [ei.get(k)?.n ?? 0, li.get(k)?.n ?? 0];
      if (a > b) engineOnly.push(`${k}${a - b > 1 ? ` ×${a - b}` : ""}`);
      if (b > a) logOnlyHere.push(`${k}${b - a > 1 ? ` ×${b - a}` : ""}`);
    }
    if (!engineOnly.length && !logOnlyHere.length) continue;
    const kind = !mine.length ? "log" : !logged.length ? "engine" : "values";
    const totals = (m: ReadonlyMap<string, { zone: string; value: number; n: number }>) => {
      const t = new Map<string, number>();
      for (const x of m.values()) t.set(x.zone, (t.get(x.zone) ?? 0) + x.value * x.n);
      return t;
    };
    const [et, lt] = [totals(ei), totals(li)];
    const same = kind === "values" && [...new Set([...et.keys(), ...lt.keys()])].every((z) => Math.abs((et.get(z) ?? 0) - (lt.get(z) ?? 0)) < 1e-6);
    out.push({ what: [...g].sort().join(" + "), kind, engine: engineOnly, log: logOnlyHere, ...(same ? { sameTotals: true as const } : {}) });
  }
  const loggedStagger = hit.effects.some((e) => /poise_break/.test(e.buff));
  const engineStagger = landing.inputs.options.staggered;
  if (loggedStagger !== engineStagger) out.push({ what: "Stagger", kind: engineStagger ? "engine" : "log", engine: engineStagger ? ["Staggered"] : [], log: loggedStagger ? ["buff_common_poise_break_damage_taken_scale"] : [] });
  return out;
}

/** Totals of a fight: damage (all, per operator, per kind) and counts, as the log has them or as the replay simulates them. */
export interface FightTotals {
  readonly damage: number;
  readonly perOperator: Readonly<Record<string, number>>;
  /** By kind: basic, battle, combo, ultimate, status (bursts, reactions, physical statuses, Combustion), none (no skill type). */
  readonly perKind: Readonly<Record<string, number>>;
  readonly hits: number;
  /** Status hits (bursts, reactions, physical statuses, Combustion ticks). */
  readonly statusHits: number;
  /** Hits that crit, of those whose crit is known. */
  readonly critShare: number;
  /** Hits under Stagger (the log's listing; the replay's Stagger). */
  readonly staggeredHits: number;
  /** The last hit's time (ms). */
  readonly lastHitMs: number;
  /**
   * In a fight that ends in a kill: when the damage reached the enemy's HP (ms): the log's last hit, the replay's
   * landing that brought its running total there (null if it never did by the log's kill).
   */
  readonly killMs: number | null;
}

/** Each comparison of the log's totals with the simulation's: the log's value, the simulation's, and the error (simulated / logged − 1). */
export interface TotalsComparison {
  readonly logged: FightTotals;
  readonly simulated: FightTotals;
  /** The fixture's absent landings (LogFixture.absent) the totals left out, and those the replay had none for. */
  readonly absent: { readonly leftOut: number; readonly unmatched: readonly AbsentLanding[] };
  /**
   * The stretches the log has no hit in for ENEMY_AWAY_MS or more (ms; none under enemy-away `counted`), and how many
   * replay landings standing for no logged hit the totals left out inside them.
   */
  readonly away: { readonly windows: readonly { readonly from: number; readonly to: number }[]; readonly leftOut: number };
  /**
   * Per recorded burst (Si's Artful Intent), what its operator's simulated total moved by in `simulated.perOperator`
   * (recordedBurstShifts): its teammates' share of the record taken as logged, not as replayed. The team's total and
   * the kinds keep the replay's burst.
   */
  readonly recordedShifts: readonly RecordedShift[];
  /**
   * The simulated total's parts: each landing it counted with the damage it counted (`logged`: the logged hit it stands
   * for, absent for a replay-only landing), in frame order (`zmdlogs totals`: a total can move while every logged hit
   * gets closer, by its replay-only side: 458b's Laevatain, two replay-only finisher landings).
   */
  readonly parts: readonly TotalPart[];
  /** Every replay-only landing and log-only hit of the parts, classified by kind (onesided.ts: `zmdlogs totals --kinds`). */
  readonly oneSided: readonly OneSided[];
  /**
   * How the fight's kill was found (round 17, the exposed-totals report point 2: 207f's ×5.7600 Max HP read as a −6.9%
   * over-prediction of Rossi's ultimate final for a while): the log's total is the data's Max HP (`max-hp`), its last
   * hit capped (`capped`: its uncapped value above it), its last life's (`lives`), a stage-scaled Max HP
   * (`stage-scaled`), or no kill (`none`); and the data's Max HP at the enemy's level (null: not in the data).
   */
  readonly kill: { readonly kind: KillKind; readonly maxHp: number | null };
}

/** How a fight's kill was found (TotalsComparison.kill). */
export type KillKind = "max-hp" | "capped" | "lives" | "stage-scaled" | "none";

/** One landing the simulated total counted (TotalsComparison.parts). */
export interface TotalPart {
  readonly operator: string;
  readonly skillId: string;
  readonly hitId: string;
  readonly frame: number;
  readonly damage: number;
  readonly logged?: LogHit;
}

/** One recorded burst's move in its operator's simulated total (TotalsComparison.recordedShifts). */
export interface RecordedShift {
  readonly operator: string;
  /** The logged burst's time (ms). */
  readonly t: number;
  /** rate × (teammates' logged hits in the log's record − their landings in the replay's record). */
  readonly amount: number;
}

/**
 * A recorded burst (Si's Artful Intent: Fixed DMG of rate × every hit on the target while it lasted) in the replay
 * carries every teammate's replay error into its operator's total (489c, 9a80: Rossi's replayed hits short of the
 * log's). For the per-operator totals its operator is charged only for its own share: the teammates' share of its
 * record is the log's (the log's window as the hit's verdict reads it, its reading nearest the logged burst:
 * recordedburst.ts), its own the replay's. Not for a capped (killing) burst, nor where the replay's record can't be
 * told from its landings (replayRecord).
 */
function recordedBurstShifts(c: EngineCheck, counted: ReadonlySet<LandedHit>): RecordedShift[] {
  const { data, fx } = c;
  const team = teamPanels(data, fx);
  const out: RecordedShift[] = [];
  for (const b of fx.team) {
    const kit = effectiveKit(data, b);
    const events = new Set(kit ? kitHitEntries(kit).filter((e) => isRecordedBurst(e.hit)).flatMap((e) => e.hit.events) : []);
    for (const h of fx.hits) {
      if (h.operator !== b.operator || !events.has(h.event) || h.uncapped !== undefined) continue;
      const l = c.replay.landing(h);
      const member = team.at(h.operator, h.t);
      if ("unknown" in l || !counted.has(l) || !member) continue;
      const burst = recordedBurst(data, fx, member, h);
      if ("unknown" in burst) continue;
      const reading = [...burst.readings].sort((x, y) => Math.abs(x.predicted - h.value) - Math.abs(y.predicted - h.value))[0];
      const start = c.replay.landing(burst.start);
      if (!reading || "unknown" in start) continue;
      const replayed = replayRecord(c.replay.hits, l, burst.rate, start.frame);
      if (!replayed) continue;
      let amount = 0;
      for (const op of new Set([...Object.keys(reading.byOperator), ...Object.keys(replayed)])) if (op !== h.operator) amount += burst.rate * ((reading.byOperator[op] ?? 0) - (replayed[op] ?? 0));
      out.push({ operator: h.operator, t: h.t, amount });
    }
  }
  return out;
}

/** How near its `t` an absent landing (LogFixture.absent) is looked for. */
const ABSENT_MS = 1000;

/** The kind a logged hit or a replay landing counts under (FightTotals.perKind). */
function kindOf(data: GameData, fx: LogFixture, operator: string, skillId: string, event?: string): string {
  if (event ? parseReactionEvent(event) : skillId.startsWith("reaction:")) return "status";
  const build = fx.team.find((b) => b.operator === operator);
  const kit = build ? effectiveKit(data, build) : undefined;
  if (event) {
    const s = kit?.skills.find((x) => x.hits.some((h) => h.events.includes(event)));
    if (s) return s.hits.find((h) => h.events.includes(event))?.damageType ?? s.kind;
    const t = kit?.triggers.flatMap((tr) => tr.do).find((a) => a.kind === "hits" && a.hits.some((h) => h.events.includes(event)));
    return t && t.kind === "hits" ? (t.hits.find((h) => h.events.includes(event))?.damageType ?? "none") : "uncovered";
  }
  const s = kit?.skills.find((x) => x.skillId === skillId);
  return s?.kind ?? "none";
}

/**
 * The fight's totals as the log has them and as the simulation of the logged casts has them (the replay's landings,
 * its own too: hits the log doesn't show count, logged hits it doesn't land don't): each landing matched to a logged
 * hit at the engine's primary reading (its crit and log-only effects: engineReadings), the others at the replay's own
 * damage with expected crits.
 */
export function fightTotals(c: EngineCheck, primary: ReadonlyMap<LogHit, { readonly landing: LandedHit; readonly predicted: number }>): TotalsComparison {
  const { data, fx } = c;
  const add = (o: Record<string, number>, k: string, v: number) => (o[k] = (o[k] ?? 0) + v);
  const logged = { damage: 0, perOperator: {} as Record<string, number>, perKind: {} as Record<string, number>, hits: 0, statusHits: 0, crits: 0, known: 0, staggered: 0, last: 0 };
  for (const h of fx.hits) {
    logged.damage += h.value;
    add(logged.perOperator, h.operator, h.value);
    add(logged.perKind, kindOf(data, fx, h.operator, "", h.event), h.value);
    logged.hits++;
    if (parseReactionEvent(h.event)) logged.statusHits++;
    if (h.crit !== null) {
      logged.known++;
      if (h.crit) logged.crits++;
    }
    if (h.effects.some((e) => /poise_break/.test(e.buff))) logged.staggered++;
    logged.last = Math.max(logged.last, h.t);
  }
  const sim = { damage: 0, perOperator: {} as Record<string, number>, perKind: {} as Record<string, number>, hits: 0, statusHits: 0, crits: 0, known: 0, staggered: 0, last: 0 };
  const matched = new Map([...primary].map(([h, p]) => [p.landing, { hit: h, predicted: p.predicted }]));
  // Landings of logged hits without a reading (Fixed DMG: Si's Artful Intent burst) are still that hit's: a hit the log
  // capped at the enemy's remaining HP caps the landing's damage too (bdf223db8e49's killing burst, 284,900 of 530,319).
  const cappedHit = new Map<LandedHit, LogHit>();
  for (const h of fx.hits) {
    if (h.uncapped === undefined || primary.has(h)) continue;
    const l = c.replay.landing(h);
    if (!("unknown" in l)) cappedHit.set(l, h);
  }
  // The other landings of logged hits without a reading (Si's bursts, Fixed DMG) count at the replay's own damage, as
  // that hit's part (TotalPart.logged): 0c14's burst at 40.33 s was a replay-only landing beside a log-only hit.
  const fixedHit = new Map<LandedHit, LogHit>();
  for (const h of fx.hits) {
    if (primary.has(h) || h.uncapped !== undefined) continue;
    const l = c.replay.landing(h);
    if (!("unknown" in l) && l.fixed && !matched.has(l)) fixedHit.set(l, h);
  }
  // The log's damage ends at its last hit, the kill's too when the fight ends in one (the log's total is the enemy's
  // HP): the replay's damage is summed to that moment as well, past its own HP if it gets there sooner, so both totals
  // and each operator's cover the same span (b7b3: capping the replay at Rhodagn's 2.29M stopped it at 17.0 s, 1 s
  // before the log's kill, and put Arcane's last second on the log's side only). When the replay reaches the HP is
  // the time to kill (killMs).
  const end = (fx.hits.reduce((m, h) => Math.max(m, h.t), 0) * 30) / 1000 + 1;
  const hp = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  // A kill: the log's total is the data's HP, or its last hit is capped at the enemy's remaining HP (the stages scale
  // the data's HP: tower016 ×5.5, tower015 ×7.6, Si's phases ×2; 4360's four returning lances after the kill counted,
  // +6.5% of the fight, while the last hit was capped), the log's total then being the HP.
  const lastCapped = fx.hits.some((h) => h.t === logged.last && h.uncapped !== undefined && h.uncapped > h.value);
  const killKind: KillKind = hp !== undefined && hp > 0 && Math.abs(logged.damage - hp) <= 0.005 * hp ? "max-hp" : lastCapped ? "capped" : lastLifeKilled(data, fx) ? "lives" : stageScaledKill(data, fx) ? "stage-scaled" : "none";
  const kill = killKind === "max-hp" ? (hp as number) : killKind !== "none" ? logged.damage : null;
  let simKill: number | null = null;
  // Landings the log can't have (the fixture's `absent`, judged by hand): each the nearest of its operator's skill and hit.
  const absent = new Set<LandedHit>();
  const unmatched: AbsentLanding[] = [];
  for (const a of fx.absent ?? []) {
    const near = c.replay.hits
      .filter((l) => !absent.has(l) && l.operator === a.operator && l.skillId === a.skillId && l.hitId === a.hitId && Math.abs((l.frame * 1000) / 30 - a.t) <= ABSENT_MS)
      .sort((x, y) => Math.abs((x.frame * 1000) / 30 - a.t) - Math.abs((y.frame * 1000) / 30 - a.t))[0];
    if (near) absent.add(near);
    else unmatched.push(a);
  }
  // A fight that ends in a kill: its last logged hits are capped at the enemy's remaining HP, whether or not the log
  // gives the uncapped value (a27b's killing Crush, 161,507 of a predicted 332,879).
  const killing = new Set(kill === null ? [] : fx.hits.filter((h) => h.t === logged.last));
  const away = awayLeftOutOfTotals(readingOf(c.replay.assume, "enemy-away")) ? awayWindows(fx) : [];
  // Under `absent` up to the stretch's ends, as the replay's enemy is away (enemyAwaySpans): a landing there no logged
  // hit stands for is one the replay didn't hold back (an Arts Burst, a status's tick: 4a64's Nature burst at 29.30 s).
  const awayEdge = readingOf(c.replay.assume, "enemy-away") === "absent" ? 0 : AWAY_EDGE_MS;
  const isAway = (frame: number) =>
    away.some((w) => (awayEdge === 0 ? frame > Math.round((w.from * 30) / 1000) && frame < Math.round((w.to * 30) / 1000) : (frame * 1000) / 30 > w.from + awayEdge && (frame * 1000) / 30 < w.to - awayEdge));
  // With the replay's enemy away too (enemy-away `absent`), the frames the enemy leaves at: each stretch's first hit's.
  const leaving = new Set(readingOf(c.replay.assume, "enemy-away") === "absent" ? away.map((w) => Math.round((w.from * 30) / 1000)) : []);
  let awayLeftOut = 0;
  // The killing blow's frame: the log's, or the replay's landing of a killing hit if sooner (4360: the battle skill's
  // twelve returning lances land in one frame at 119.20 s, the log's eight before the kill end at 119.235 s).
  const killFrame = Math.min(
    Math.round((logged.last * 30) / 1000),
    ...[...killing].flatMap((h) => {
      const l = c.replay.landing(h);
      return "unknown" in l ? [] : [l.frame];
    }),
  );
  const counted = new Set<LandedHit>();
  const parts: TotalPart[] = [];
  const countedLandings: CountedLanding[] = [];
  const uncounted = new Map<LandedHit, string>();
  for (const l of [...c.replay.hits].sort((a, b) => a.frame - b.frame)) {
    const m = matched.get(l);
    const capped = cappedHit.get(l);
    // A landing of a logged hit counts wherever the replay put it; others only up to the log's end (a27b: the
    // killing blow landed 65 ms after the log's).
    if ((l.frame > end && !m && !capped) || absent.has(l)) {
      uncounted.set(l, absent.has(l) ? "absent" : "past the log's end");
      continue;
    }
    // A press the log shows no hit of, made from its listing (BuffReplay.inferred): its own landings dealt nothing.
    if (!m && !capped && l.cast !== undefined && c.replay.inferred.has(l.cast)) {
      uncounted.set(l, "absent");
      continue;
    }
    if (!m && !capped && isAway(l.frame)) {
      awayLeftOut++;
      uncounted.set(l, "away");
      continue;
    }
    // The enemy leaves with an away stretch's first logged hit (its last before the stretch): a landing no logged hit
    // stands for at that hit's frame found no one, as one after a kill (pending/zmdlogs-4a64e58e75ad.json 29.15 s, Si's
    // first life's end: Rossi's ultimate slash2, whose Seething Blood extra at the slash's ms every other slash2 has).
    if (!m && !capped && !fixedHit.has(l) && leaving.has(l.frame)) {
      awayLeftOut++;
      uncounted.set(l, "away");
      continue;
    }
    // A fight that ends in a kill has no HP left for a landing no logged hit stands for at the killing blow's frame or
    // after it (4360447193ac: Avywenna's four returning lances at the kill's 119.20 s, 0.29M, 6.5% of the fight).
    if (kill !== null && !m && !capped && !fixedHit.has(l) && l.frame >= killFrame) {
      uncounted.set(l, "after the kill");
      continue;
    }
    let damage: number;
    if (m) damage = Math.min(m.predicted, m.hit.uncapped !== undefined || killing.has(m.hit) ? m.hit.value : Infinity);
    else if (l.inputs) damage = landingDamage(data, c.target, l.inputs, { ...l.inputs.options, crit: "expected", modifiers: [...(l.inputs.options.modifiers ?? []), ...stageModifiers(fx, (l.frame * 1000) / 30)] }).exact;
    else damage = l.exact;
    if (capped) damage = Math.min(damage, capped.value);
    counted.add(l);
    const of = m?.hit ?? capped ?? fixedHit.get(l);
    parts.push({ operator: l.operator, skillId: l.skillId, hitId: l.hitId, frame: l.frame, damage, ...(of ? { logged: of } : {}) });
    countedLandings.push({ landing: l, damage, ...(of ? { logged: of } : {}) });
    sim.damage += damage;
    if (kill !== null && simKill === null && sim.damage >= kill) simKill = (l.frame * 1000) / 30;
    add(sim.perOperator, l.operator, damage);
    add(sim.perKind, l.skillId.startsWith("reaction:") ? "status" : l.inputs?.kind === "hit" ? l.inputs.hit.damageType : kindOf(data, fx, l.operator, l.skillId), damage);
    sim.hits++;
    if (l.skillId.startsWith("reaction:")) sim.statusHits++;
    if (m && m.hit.crit !== null) {
      sim.known++;
      if (m.hit.crit) sim.crits++;
    }
    if (l.inputs?.options.staggered) sim.staggered++;
    if (l.frame <= end) sim.last = Math.max(sim.last, (l.frame * 1000) / 30);
  }
  const recordedShifts = recordedBurstShifts(c, counted);
  for (const s of recordedShifts) add(sim.perOperator, s.operator, s.amount);
  const totals = (x: typeof logged, killMs: number | null): FightTotals => ({
    damage: x.damage, perOperator: x.perOperator, perKind: x.perKind, hits: x.hits, statusHits: x.statusHits, critShare: x.known ? x.crits / x.known : 0, staggeredHits: x.staggered, lastHitMs: x.last, killMs,
  });
  const oneSided = oneSidedLandings(data, fx, c.replay, countedLandings, away, uncounted, killGaps(fx));
  return { logged: totals(logged, kill !== null ? logged.last : null), simulated: totals(sim, simKill), absent: { leftOut: absent.size, unmatched }, away: { windows: away, leftOut: awayLeftOut }, recordedShifts, parts, oneSided, kill: { kind: killKind, maxHp: hp !== undefined && hp > 0 ? hp : null } };
}

/** A stretch with no logged hit at least this long is the enemy out of reach (engine assumption enemy-away). */
export const ENEMY_AWAY_MS = 6000;
/** How far inside such a stretch a replay landing must be to be left out (a hit at its edge may be a logged one's twin). */
const AWAY_EDGE_MS = 300;

/** The fight's stretches between consecutive logged hits of ENEMY_AWAY_MS or more (ms). */
export function awayWindows(fx: Pick<LogFixture, "hits">): { readonly from: number; readonly to: number }[] {
  const ts = [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
  const out: { from: number; to: number }[] = [];
  for (let i = 1; i < ts.length; i++) if ((ts[i] as number) - (ts[i - 1] as number) >= ENEMY_AWAY_MS) out.push({ from: ts[i - 1] as number, to: ts[i] as number });
  return out;
}

/**
 * The stretches after a logged kill (ms): from a logged ms with a hit capped at the HP left (`uncapped` above its value)
 * before the fight's last hit to the next logged hit, however short (engine assumption kill-gaps). The enemy (a life, a
 * phase, one of several targets) is gone there, and the log records every landing that lands, so a landing in between
 * found no one: pending/zmdlogs-9c6e97486a9d.json 63.34–67.64 s (Typhoeus's shot capped at 8,037 of 17,127, then 14
 * landings of hers in the replay alone, her Power Shot's 160k burst among them), pending/zmdlogs-63398339803e.json's
 * slug (capped at 10.35, 11.31, 24.02 s: Si's burst mark and Laevatain's battle-skill ticks after them, unlogged).
 */
export function killGaps(fx: LogFixture): { readonly from: number; readonly to: number }[] {
  const ts = [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
  const last = ts.at(-1);
  const caps = new Set(fx.hits.filter((h) => h.uncapped !== undefined && h.uncapped !== null && h.uncapped > h.value && h.t !== last).map((h) => h.t));
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i + 1 < ts.length; i++) if (caps.has(ts[i] as number)) out.push({ from: ts[i] as number, to: ts[i + 1] as number });
  return out;
}

/**
 * The frames after each logged kill (killGaps) of a fight against several targets under one id (the fixture's
 * severalTargets), where the replay's one enemy sheds the team's debuffs (engine assumption logged-purges, reading
 * `log-kills`; holdinputs.ts purgedByLog): the killed target's debuffs go with it, and the hits after it land on
 * another, read as one the team hasn't touched. Hard 33's Woodcraft Slugs (pending/zmdlogs-7b54dc249bcd.json,
 * pending/zmdlogs-63398339803e.json): ZMDLogs lists the debuffs of every slug under the one id, so the listing can't
 * say which a hit's slug had; 7b54's hits after its kills at 16.36, 19.59, 32.94 s read ×1.10–1.45 low with the
 * replay's debuffs on. A target that had been hit before (6339 after 20.37 s: Jade Vessel on the next slug) reads
 * low by what it had.
 */
export function killPurges(fx: LogFixture): number[] {
  if (!fx.severalTargets) return [];
  return [...new Set(killGaps(fx).map((k) => Math.round((k.from * FPS) / 1000) + 1))];
}

/**
 * Where the replay's enemy is out of reach (TimelineScenario.enemyAway, frames), under engine assumption enemy-away:
 * `absent`, each away stretch from the frame after its last logged hit to the frame before the next (the log records
 * every hit that lands, so an unlogged landing there found no one: pending/zmdlogs-0c14fb3ce77d.json, Si's battle skill
 * pressed at 139.68 s in the stretch 134.97–152.91 s made no Artful Intent, no Cryo and no Jade Vessel run in the game);
 * `absent-edge`, AWAY_EDGE_MS inside both ends, as the totals leave landings out; else none.
 */
export function enemyAwaySpans(fx: LogFixture, reading: string | undefined): { readonly from: number; readonly to: number }[] {
  if (reading !== "absent" && reading !== "absent-edge") return [];
  const edge = reading === "absent" ? 0 : AWAY_EDGE_MS;
  return awayWindows(fx).flatMap((w) => {
    const from = Math.max(Math.round(((w.from + edge) * 30) / 1000), Math.round((w.from * 30) / 1000) + 1);
    const to = Math.min(Math.round(((w.to - edge) * 30) / 1000), Math.round((w.to * 30) / 1000) - 1);
    return to >= from ? [{ from, to }] : [];
  });
}

/**
 * Whether a fight of several lives (an enemy that goes away as the damage reaches a multiple of its Max HP: Si,
 * eny_0134_jsspsi) ends in a kill its last hit's cap doesn't show: the damage after the last such stretch is one Max HP
 * (within 0.5%). pending/zmdlogs-4a64e58e75ad.json: 1.074 Max HP dealt before 29.15 s, exactly 1.000 after it, its last
 * hit (Rossi's ultimate slash2, without the Seething Blood extra every other slash2 has at its ms) carrying no uncapped
 * value.
 */
export function lastLifeKilled(data: GameData, fx: LogFixture): boolean {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  if (!max) return false;
  const total = fx.hits.reduce((s, h) => s + h.value, 0);
  let dealt = 0;
  let lastLife = -1;
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  let i = 0;
  for (const w of awayWindows(fx)) {
    while (i < hits.length && (hits[i] as LogHit).t <= w.from) dealt += (hits[i++] as LogHit).value;
    // A life's end: the damage so far a whole number of Max HPs or up to 10% more (the hits that land as it goes).
    const lives = Math.floor(dealt / max + 1e-3);
    if (lives >= 1 && dealt - lives * max < 0.1 * max) lastLife = dealt;
  }
  return lastLife >= 0 && Math.abs(total - lastLife - max) <= 0.005 * max;
}

/** How near (× the logged total) the total must be to a stage-scaled Max HP for stageScaledKill: the hits' rounding (458b: 1.3e-5). */
const STAGE_KILL_NEAR = 2e-5;

/**
 * Whether a fight ends in a kill its last hit's cap doesn't show: its logged total is the data's Max HP times a stage
 * factor of two decimals (tower015 ×7.60, tower016 ×5.50, tower019 ×5.10, hdg016 ×5.85, hdg027 ×5.28 and ×5.76), to
 * within the hits' rounding. Every development fight with a capped last hit at one life sits within 1.3e-5 of its
 * total from such a multiple; two carry no uncapped value: pending/zmdlogs-207fff414d82.json (×5.7600, Rossi's
 * ultimate final 1,134,403 against a predicted 1,218,124) and pending/zmdlogs-5082ceaffad1.json (×7.6000, Yvonne's
 * last charged shot). A fight not ending in one lands that near a multiple by chance about once in 50 (the window is
 * 4e-5 of the total wide, the multiples 0.01 × Max HP apart).
 */
export function stageScaledKill(data: GameData, fx: LogFixture): boolean {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  if (!max || fx.hits.length === 0) return false;
  const total = fx.hits.reduce((s, h) => s + h.value, 0);
  const factor = Math.round((total / max) * 100) / 100;
  return factor >= 1 && Math.abs(total - factor * max) <= STAGE_KILL_NEAR * total;
}

/** Whether a reading of engine assumption enemy-away leaves the away stretches' landings out of the totals. */
export function awayLeftOutOfTotals(reading: string | undefined): boolean {
  return reading === "away" || reading === "absent" || reading === "absent-edge";
}

/** How near (×, either way) the nearer of a crit-unknown hit's two readings must be for its value to say whether it crit (critFromValue). */
const CRIT_READ_NEAR = 1.08;

/**
 * Whether a crit-unknown hit crit, read from its value (engine assumption totals-crits `read`): its non-crit or its crit
 * reading, whichever is within CRIT_READ_NEAR of the value while the other isn't; null under `expected`, or when
 * neither or both are (the totals then take expected crits). A crit's factor is ×1.5 or more, so the two bands never
 * meet; a value the readings both miss says nothing.
 */
function critFromValue(value: number, nonCrit: number, crit: number, reading: string | undefined): number | null {
  if (reading !== "read" || !(value > 0) || !(nonCrit > 0) || !(crit > 0)) return null;
  const near = (x: number) => Math.abs(Math.log(value / x)) <= Math.log(CRIT_READ_NEAR);
  if (near(nonCrit) === near(crit)) return null;
  return near(crit) ? crit : nonCrit;
}

/**
 * Whether the primary reading of a hit whose crit the log doesn't give takes a crit (engine assumption check-crits):
 * under `replay`, where the replay read one from the log (BuffReplay.critSource shown, layers or values; those
 * inferences only add crits), else not.
 */
export function primaryCritRead(c: EngineCheck, hit: LogHit): boolean {
  if (hit.crit !== null || readingOf(c.replay.assume, "check-crits") !== "replay") return false;
  const source = c.replay.critSource(hit);
  return source === "shown" || source === "layers" || source === "values";
}

/**
 * A fight's total error split by where it lives, each as a share of the logged total (%): `matched`, the landings
 * standing for logged hits (predicted − their logged values); `replayOnly`, landings no logged hit stands for;
 * `logOnly` (≤ 0), logged hits the total has no landing for. The team's error is their sum; an operator's adds
 * `shifts` (recorded bursts' teammate shares, TotalsComparison.recordedShifts). `zmdlogs totals --all`'s rows and
 * measure's aggregates: most large errors are one-sided landings, not matched scale (2026-11-23).
 */
export interface TotalsShares {
  readonly logged: number;
  readonly error: number;
  readonly matched: number;
  readonly replayOnly: number;
  readonly logOnly: number;
  /** Replay-only landings the totals left out where the enemy was away (enemy-away), and the away stretches' seconds. */
  readonly awayLeftOut: number;
  readonly awaySeconds: number;
  readonly perOperator: readonly { readonly operator: string; readonly matched: number; readonly replayOnly: number; readonly logOnly: number; readonly shifts: number }[];
  /** The replay-only and log-only shares by kind (onesided.ts kindShares: context, nature, skill kind): measure's hold-out aggregates read only these. */
  readonly kinds: readonly KindShare[];
  /** The same by operator and key (development views only: `zmdlogs totals --kinds`). */
  readonly keys: readonly KeyShare[];
}

/** TotalsShares of one fight's totals (`hits` the fixture's logged hits). */
export function totalsShares(hits: readonly LogHit[], t: TotalsComparison): TotalsShares {
  const L = t.logged.damage;
  const pct = (x: number) => (L === 0 ? 0 : (100 * x) / L);
  const ops = new Map<string, { matched: number; replayOnly: number; logOnly: number; shifts: number }>();
  const op = (o: string) => ops.get(o) ?? (ops.set(o, { matched: 0, replayOnly: 0, logOnly: 0, shifts: 0 }), ops.get(o) as { matched: number; replayOnly: number; logOnly: number; shifts: number });
  const counted = new Set<LogHit>();
  for (const p of t.parts) {
    if (p.logged) {
      // A logged hit is one part's at most (fightTotals maps landings to hits one to one); guard anyway, so the shares add up.
      op(p.operator).matched += p.damage - (counted.has(p.logged) ? 0 : p.logged.value);
      counted.add(p.logged);
    } else op(p.operator).replayOnly += p.damage;
  }
  for (const h of hits) if (!counted.has(h)) op(h.operator).logOnly -= h.value;
  for (const s of t.recordedShifts) op(s.operator).shifts += s.amount;
  const sum = (k: "matched" | "replayOnly" | "logOnly") => [...ops.values()].reduce((a, x) => a + x[k], 0);
  return {
    logged: L,
    error: pct(t.simulated.damage - L),
    matched: pct(sum("matched")),
    replayOnly: pct(sum("replayOnly")),
    logOnly: pct(sum("logOnly")),
    awayLeftOut: t.away.leftOut,
    awaySeconds: t.away.windows.reduce((a, w) => a + (w.to - w.from) / 1000, 0),
    perOperator: [...ops].map(([operator, x]) => ({ operator, matched: pct(x.matched), replayOnly: pct(x.replayOnly), logOnly: pct(x.logOnly), shifts: pct(x.shifts) })).sort((a, b) => Math.abs(b.matched + b.replayOnly + b.logOnly + b.shifts) - Math.abs(a.matched + a.replayOnly + a.logOnly + a.shifts)),
    ...kindShares(t.oneSided, L),
  };
}

/** A totals comparison as rounded percentage errors (simulated / logged − 1, to 0.1 %), for the report and the verdict snapshots. */
export function totalsErrors(t: TotalsComparison): Record<string, number | null> {
  const pct = (sim: number, log: number) => (log === 0 ? (sim === 0 ? 0 : null) : Math.round((sim / log - 1) * 1000) / 10);
  const out: Record<string, number | null> = { damage: pct(t.simulated.damage, t.logged.damage) };
  for (const op of Object.keys(t.logged.perOperator)) out[`operator ${op}`] = pct(t.simulated.perOperator[op] ?? 0, t.logged.perOperator[op] ?? 0);
  for (const k of [...new Set([...Object.keys(t.logged.perKind), ...Object.keys(t.simulated.perKind)])].sort()) out[`kind ${k}`] = pct(t.simulated.perKind[k] ?? 0, t.logged.perKind[k] ?? 0);
  out["hits"] = pct(t.simulated.hits, t.logged.hits);
  out["status hits"] = pct(t.simulated.statusHits, t.logged.statusHits);
  out["staggered hits"] = pct(t.simulated.staggeredHits, t.logged.staggeredHits);
  out["last hit"] = pct(t.simulated.lastHitMs, t.logged.lastHitMs);
  if (t.logged.killMs !== null) out["time to kill"] = t.simulated.killMs !== null ? pct(t.simulated.killMs, t.logged.killMs) : null;
  out["crit share (points)"] = Math.round((t.simulated.critShare - t.logged.critShare) * 1000) / 10;
  return out;
}
