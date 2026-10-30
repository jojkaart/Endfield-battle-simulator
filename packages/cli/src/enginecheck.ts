// The log check's engine side (owner, 2026-10-25: "if our engine can simulate something, the log [check] should run
// that and compare the result with what the log says"). A logged hit is computed through the engine's own damage path
// at its landing in the replay of the logged casts (engine landingDamage, with the timeline's damageOptions there: kit
// buffs and their layers, Link, statuses, Stagger, the finisher, consumed buffs, the situation), and the log supplies
// only what the engine can't produce: the crit flag, buffs no kit defines (and the hitter's food the log lists), the
// enemy's HP (in the replay), and the outcome of what the replay can't judge (chance and enemy-action triggers, heals of
// the controlled operator). The log's listing of the buffs the engine models verifies the engine's modifiers instead of
// replacing them: where they differ is reported (logDifferences). docs/design.md, "The log check's rule".

import {
  Attr, activeModifiers, corrosionModifier, effectiveKit, kitBuffModifiers, landingDamage, linkValue, parseReactionEvent, readingDoesNotApply, roundDamage, SNAPSHOT_ZONES,
  type DamageOptions, type DamageTarget, type GameData, type KitBuff, type KitHit, type LandedHit, type LandingInputs, type Modifier, type SkillType,
} from "@efsim/engine";
import type { LogEffect, LogFixture, LogHit } from "@efsim/data";
import type { BuffReplay, Fact, ReplayCastFacts } from "./buffreplay.ts";
import type { Assumption } from "./logcheck.ts";
import { boundarySubsets, buffFile, isCorrosionBuff, kitStackCaps, logModifiers, teamPanels, withoutOwnFood, type HitCategory, type StackCap } from "./logeffects.ts";

/**
 * The game buffs a battle log lists a kit buff's effects under: its gameBuff, its loggedAs, and the affix buffs those
 * files' Susceptibility and Amp actions create (RawBuffFile.affixes: ZMDLogs names the affix, e.g.
 * buff_common_affixes_vulnerable_natural for Li Zhiyan's talent).
 */
export function loggedNames(def: Pick<KitBuff, "gameBuff" | "loggedAs">): string[] {
  const own = [...(def.gameBuff ? [def.gameBuff] : []), ...(def.loggedAs ?? [])];
  return [...new Set([...own, ...own.flatMap((g) => buffFile(g)?.affixes ?? [])])];
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
  const keep = (e: LogEffect) => !engineModels(names, e.buff);
  return { effects: h.effects.filter(keep), boundary: h.boundaryEffects.filter(keep) };
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
function loggedEntries(c: EngineCheck, effects: readonly LogEffect[], gameBuffs: ReadonlySet<string>, kept: readonly Modifier[], category: HitCategory): Modifier[] {
  const pool = [...kept];
  const out: LogEffect[] = [];
  for (const e of effects) {
    if (!gameBuffs.has(e.buff)) continue;
    const i = pool.findIndex((m) => m.zone === e.zone && (m.element ?? null) === (e.element ?? null) && near(m.value, e.value));
    if (i >= 0) pool.splice(i, 1);
    else out.push(e);
  }
  return logModifiers(out, category, c.caps);
}

/** One group of alternatives a reading may take (the first: none), each with its assumption and what it changes. */
interface Alternative {
  readonly assumption: Assumption | null;
  readonly apply: (o: Reading) => Reading;
}

interface Reading {
  readonly options: DamageOptions;
  /** Another kit hit of the event in place of the landed one, with the skill its values come from. */
  readonly other?: { readonly skill: { readonly skillId: string }; readonly hit: KitHit };
  readonly inputs: LandingInputs;
}

const NONE: Alternative = { assumption: null, apply: (o) => o };

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
export function engineReadings(c: EngineCheck, hit: LogHit, place: HitPlace): { readings: EngineReading[]; primary: number | null; expected?: number; landing: LandedHit | { readonly unknown: string } } {
  const landing = landingOf(c, hit);
  if ("unknown" in landing) return { readings: [], primary: null, landing };
  const inputs = landing.inputs;
  const op = hit.operator;
  const category = categoryOf(inputs);
  const own = logOnly(c.data, c.fx, c.names, hit);
  const snapshotOwn = place.snapshotOf ? logOnly(c.data, c.fx, c.names, place.snapshotOf) : null;
  const logMods = (effects: readonly LogEffect[], cat: HitCategory) =>
    snapshotOwn
      ? [...logModifiers(effects, cat, c.caps).filter((m) => !SNAPSHOT_ZONES.has(m.zone)), ...logModifiers(snapshotOwn.effects, cat, c.caps).filter((m) => SNAPSHOT_ZONES.has(m.zone))]
      : logModifiers(effects, cat, c.caps);
  // The engine's modifiers (kit buffs, statuses, Link, the finisher), without kit buffs the replay can't judge: their state is the log's.
  const engine = inputs.options.modifiers?.filter((m) => !isLog(m)) ?? [];
  const unjudged = (m: Modifier) => m.kitBuff !== undefined && c.replay.unjudgedKitBuffs.has(`${m.kitBuff.owner}:${m.kitBuff.id}`);
  const judged = engine.filter((m) => !unjudged(m));
  const unjudgedNames = new Set([...c.replay.unjudgedKitBuffs.keys()].flatMap((k) => c.names.ofKitBuff.get(k) ?? []));
  const withLog = (mods: readonly Modifier[], cat: HitCategory) => [...mods, ...logMods(own.effects, cat), ...loggedEntries(c, withoutOwnFood(c.data, c.fx, hit).effects, unjudgedNames, judged, cat)];
  const crit = hit.crit === null ? "never" : hit.crit ? "always" : "never";
  const primary: Reading = { inputs, options: { ...inputs.options, crit, modifiers: withLog(judged, category) } };
  delete (primary.options as { critRoll?: number }).critRoll;

  // The alternatives, by group.
  const groups: Alternative[][] = [];
  const replaceMods = (o: Reading, f: (mods: readonly Modifier[]) => Modifier[]): Reading => ({ ...o, options: { ...o.options, modifiers: f(o.options.modifiers ?? []) } });
  if (hit.crit === null) groups.push([NONE, { assumption: { kind: "crit", label: "crit" }, apply: (o) => ({ ...o, options: { ...o.options, crit: "always" } }) }]);
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
  if (toggles.length) groups.push(...(toggles.length <= 4 ? toggles : [[NONE, ...toggles.flatMap((g) => g.slice(1))]]));
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
    try {
      return { readings, primary: primaryDamage, expected: landingDamage(c.data, c.target, primary.inputs, { ...primary.options, crit: "expected" }, primary.other).exact, landing };
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
    }
  }
  return { readings, primary: primaryDamage, landing };
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
    out.push({ what: [...g].sort().join(" + "), kind, engine: engineOnly, log: logOnlyHere });
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
}

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
  // The log's damage ends at its last hit, the kill's too when the fight ends in one (the log's total is the enemy's
  // HP): the replay's damage is summed to that moment as well, past its own HP if it gets there sooner, so both totals
  // and each operator's cover the same span (b7b3: capping the replay at Rhodagn's 2.29M stopped it at 17.0 s, 1 s
  // before the log's kill, and put Arcane's last second on the log's side only). When the replay reaches the HP is
  // the time to kill (killMs).
  const end = (fx.hits.reduce((m, h) => Math.max(m, h.t), 0) * 30) / 1000 + 1;
  const hp = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  const kill = hp !== undefined && hp > 0 && Math.abs(logged.damage - hp) <= 0.005 * hp ? hp : null;
  let simKill: number | null = null;
  for (const l of [...c.replay.hits].sort((a, b) => a.frame - b.frame)) {
    if (l.frame > end) continue;
    const m = matched.get(l);
    let damage: number;
    if (m) damage = Math.min(m.predicted, m.hit.uncapped !== undefined ? m.hit.value : Infinity);
    else if (l.inputs) damage = landingDamage(data, c.target, l.inputs, { ...l.inputs.options, crit: "expected" }).exact;
    else damage = l.exact;
    const capped = cappedHit.get(l);
    if (capped) damage = Math.min(damage, capped.value);
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
    sim.last = Math.max(sim.last, (l.frame * 1000) / 30);
  }
  const totals = (x: typeof logged, killMs: number | null): FightTotals => ({
    damage: x.damage, perOperator: x.perOperator, perKind: x.perKind, hits: x.hits, statusHits: x.statusHits, critShare: x.known ? x.crits / x.known : 0, staggeredHits: x.staggered, lastHitMs: x.last, killMs,
  });
  return { logged: totals(logged, kill !== null ? logged.last : null), simulated: totals(sim, simKill) };
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
