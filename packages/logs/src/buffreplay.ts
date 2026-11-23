// The kit-buff replay of a logged fight (owner, 2026-10-22: "our engine
// should not rely on the log data for activating buffs. It should activate
// them based on the events that should trigger them."). The logged casts
// (logcasts.ts: operator, skill, start) are cast again in the engine's
// timeline at their logged frames, their logged landings at the logged
// frames (timeline/drivers.ts replayCast); their hits, the enemy's statuses, SP and
// the kits' triggers then run as in a simulation, and the instances of the
// kit buffs that stand for a game buff (KitBuff.gameBuff) are read off the
// timeline's state. The log check (logcheck.ts) takes their activity instead
// of the log's listing for the buffs the replay decides, and reports where
// the two disagree (leads: a log gap, or a kit trigger that's wrong).

import {
  activeAt, advance, allActions, ENGINE_ASSUMPTIONS, holdWorld, skillCosts, spAt, spCostAt, earliestStart, exclusiveUntil, applyBuff, Attr, setPoise, holdStagger, isStaggered, buffModifiers, computeStats, createContext, kitHitEntries, parseReactionEvent, readingDoesNotApply, refillPoise, skillAvailable, staggerFrames, triggerSkillId, effectiveKit, FPS, init, reaches, replayCast, replayWindowCount,
  type ActiveBuff, type GameData, type KitBuff, type KitTrigger, type LandedHit, type Modifier, type OperatorKit, type Predicate, type ReactionRecord, type SkillType, type TimelineContext, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import { isBuffFileListed, readBuffFile } from "@efsim/data";
import { TARGET_SIDE_ZONES, type LogEffect, type LogFixture, type LogHit } from "./zmdlogs.ts";
import { loggedNames } from "./enginecheck.ts";
import { castTimeStops, distinctCasts, loggedFrames, mergeMs, placeHits, skillStops, withResets, worldMs, type LoggedCast, type Placement, type TimeStop } from "./logcasts.ts";
import { HOLD_BOUND_TOL_MS, notAClock, placeHolds, refreshedIn, RUN_START_MS, statusBounds, statusLanes, tickBounds, type ClockWhy, type HoldBound, type PlacedHolds, type StatusInstance } from "./holds.ts";

/**
 * How sure the replay is of when its buffs start and end. A start is a
 * logged landing's (or a trigger's on one), within REPLAY_EDGE_MS. An end by
 * expiry is less sure the longer the instance lasted: the timeline extends
 * buffs by every time stop in full and doesn't model hit-stop, and the logs
 * disagree with both (4e5e1390085e: Estella's Physical Susceptibility, 9 s,
 * lasts 10.1 s in the log across her ultimate's 1.8 s time stop and 10.0 s
 * without one; Gilberta's weapon buff, 15 s, 16.1 s and 16.15 s), so it gets
 * REPLAY_EXPIRY_SLACK of the instance's life on top. Within that of a change
 * in the replay's count the replay doesn't decide, and the log's listing
 * stands.
 */
export const REPLAY_EDGE_MS = 500;

/** How far (frames) a landing a trigger made may be from a logged hit it is taken for (its trigger's own timing drifts from the log's). */
const NEAR_FRAMES = 16;
export const REPLAY_EXPIRY_SLACK = 0.1;

/** Trigger events a log doesn't let the replay judge: the enemy's own actions. */
const UNJUDGED_EVENTS: ReadonlySet<string> = new Set(["attacked", "perfectDodge", "enemyCharge"]);

/**
 * Why the replay can't judge a trigger (it has no rolls or enemy actions), or null. Crits it has from the log
 * (TimelineScenario.loggedCrits); where a landing's crit isn't logged, the buffs crits apply are undecided for a while
 * (critTriggers, BuffReplay.instances).
 */
function unjudged(t: KitTrigger, kit: OperatorKit): string | null {
  if (UNJUDGED_EVENTS.has(t.on.event)) return `${t.id}: on ${t.on.event}`;
  if (t.chance !== undefined) return `${t.id}: a chance`;
  // Whom a heal reaches when it heals the controlled operator: the log doesn't record who's controlled (the replay takes
  // the last to make a basic attack; 0eef2474a26f: Liino's weapon buff on her heals' targets, Typhoeus and Si in the log,
  // Arcane in the replay).
  if (t.on.event === "heal" && (t.by !== "self" || healsControlled(kit))) return `${t.id}: on heals of the controlled operator, whom the log doesn't name`;
  return null;
}

/** Whether any of a kit's heals (its hits', its triggers') heals the controlled operator. */
function healsControlled(kit: OperatorKit): boolean {
  return kitHitEntries(kit).some((e) => e.hit.heals === "controlled") || kit.triggers.some((t) => allActions(t.do).some((a) => a.kind === "heal" && a.target === "controlled"));
}

/** How close (ratio) the lowest of the hits taken for crits at one moment may be to the highest of the rest. */
const CRIT_APART = 1.4;

/**
 * Crits the log leaves out (LogHit.crit null) that a trigger on crits shows by its own logged hits, per logged hit
 * index. Every development log leaves the crit out of Rossi's ultimate stabs (and of hits during it), yet logs the
 * Seething Blood extra each crit stab fires on a Clawmarked enemy at the stab's very ms (pending/zmdlogs-489c0be3e162.json
 * 94430 ms: one stab of 16604 and one extra; 95000 ms: stabs of 16604, 16604 and 6386 and two extras): at a moment with
 * m such hits (less the logged crits that may have fired them), the m largest of the operator's hits there of the
 * trigger's kinds with no logged crit are crits, when they stand apart from the rest (crit and non-crit values of one
 * key differ by the crit zone, ×1.5 or more: CRIT_APART). Without the inference the replay's main run lands none of the extras and
 * the Wolven Blood layers those crits add.
 */
export function shownCrits(kits: readonly OperatorKit[], fx: LogFixture, placement: Placement): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const index = new Map(fx.hits.map((h, i) => [h, i]));
  for (const k of kits) for (const t of k.triggers) {
    if (t.on.event !== "hit" || t.on.crit !== true || t.by !== "self") continue;
    const kinds = t.on.kinds;
    const keys = new Set(allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits.flatMap((h) => h.events) : [])));
    if (keys.size === 0) continue;
    const byMs = new Map<number, { shown: number; known: number; open: LogHit[] }>();
    const at = (t: number) => byMs.get(t) ?? byMs.set(t, { shown: 0, known: 0, open: [] }).get(t) as { shown: number; known: number; open: LogHit[] };
    for (const h of fx.hits) {
      if (h.operator !== k.operator) continue;
      if (keys.has(h.event)) {
        at(h.t).shown++;
        continue;
      }
      const kind = placement.hits.get(h)?.cast.kind;
      if (!kind || (kinds && !kinds.includes(kind as SkillType))) continue;
      if (h.crit === true) at(h.t).known++;
      else if (h.crit === null) at(h.t).open.push(h);
    }
    for (const g of byMs.values()) {
      const m = g.shown - g.known;
      if (m <= 0 || g.open.length === 0) continue;
      const sorted = [...g.open].sort((a, b) => b.value - a.value);
      const crits = sorted.slice(0, Math.min(m, sorted.length));
      const rest = sorted.slice(crits.length);
      const lowest = crits.at(-1) as LogHit;
      if (rest.length > 0 && lowest.value < CRIT_APART * (rest[0] as LogHit).value) continue;
      for (const h of crits) out.set(index.get(h) as number, true);
    }
  }
  return out;
}

/**
 * The instances of a game buff the log lists as starting at each ms, on an operator's hits (its effects and the
 * boundary's): per start, the entries with that `since` over the kinds of entry (zone and element) among them, the most
 * any one hit lists. Wolven Blood (buff_wpn_sword_0022_layer) is listed once per layer and element (Physical, Heat):
 * two layers from one moment are four entries.
 */
export function listedStarts(fx: LogFixture, operator: string, gameBuff: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const h of fx.hits) {
    if (h.operator !== operator) continue;
    const bySince = new Map<number, LogEffect[]>();
    for (const e of [...h.effects, ...h.boundaryEffects]) {
      if (e.buff !== gameBuff || e.since === undefined || (e.source !== undefined && e.source !== operator)) continue;
      bySince.set(e.since, [...(bySince.get(e.since) ?? []), e]);
    }
    for (const [s, es] of bySince) out.set(s, Math.max(out.get(s) ?? 0, es.length / new Set(es.map((e) => `${e.zone}|${e.element}`)).size));
  }
  return out;
}

/**
 * Crits the log leaves out (LogHit.crit null) that a trigger on crits shows by the layers it adds: a trigger on its
 * operator's crits that adds a layer of a buff the log lists with its start (LogEffect.since) adds one per crit, so n
 * layers listed from a moment are n crits there. 489c (pending/zmdlogs-489c0be3e162.json) lists Rossi's Wolven Blood
 * layers from 54406 ms, then one from 55610 ms with the max-stack final, on a power attack whose crit the log doesn't
 * give (and one from each of her next five crit-less hits); without it the replay reaches 16 layers 3.9 s later. Taken
 * after the logged crits and those `shown` (shownCrits) at the moment: n − those are crits among the rest of the
 * operator's crit-less hits there of the trigger's kinds; all of them when there are as many, else the largest when
 * they stand apart (CRIT_APART). Not a buff the replay can't decide (a chance, an enemy's action). The count can only
 * add crits: at the buff's maximum a new layer replaces one, and the listing can show fewer than were dealt.
 */
export function layerCrits(kits: readonly OperatorKit[], fx: LogFixture, placement: Placement, shown: ReadonlyMap<number, boolean> = new Map()): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const index = new Map(fx.hits.map((h, i) => [h, i]));
  for (const k of kits) for (const t of k.triggers) {
    if (t.on.event !== "hit" || t.on.crit !== true || t.by !== "self" || t.chance !== undefined) continue;
    const first = t.do[0];
    const def = first?.kind === "buff" && !first.if ? k.buffs.find((d) => d.id === first.buff) : undefined;
    if (!def?.gameBuff || undecidedBuff(k, def.id)) continue;
    const kinds = t.on.kinds;
    const starts = listedStarts(fx, k.operator, def.gameBuff);
    if (starts.size === 0) continue;
    const byMs = new Map<number, LogHit[]>();
    for (const h of fx.hits) {
      if (h.operator !== k.operator || !starts.has(h.t)) continue;
      if (kinds) {
        const kind = placement.hits.get(h)?.cast.kind;
        if (!kind || !kinds.includes(kind as SkillType)) continue;
      }
      byMs.set(h.t, [...(byMs.get(h.t) ?? []), h]);
    }
    for (const [ms, hits] of byMs) {
      const crit = (h: LogHit) => h.crit ?? shown.get(index.get(h) as number) ?? out.get(index.get(h) as number) ?? null;
      const m = (starts.get(ms) as number) - hits.filter((h) => crit(h) === true).length;
      const open = hits.filter((h) => crit(h) === null).sort((a, b) => b.value - a.value);
      if (m <= 0 || open.length === 0) continue;
      const crits = open.slice(0, m);
      const rest = open.slice(crits.length);
      if (rest.length > 0 && (crits.at(-1) as LogHit).value < CRIT_APART * (rest[0] as LogHit).value) continue;
      for (const h of crits) out.set(index.get(h) as number, true);
    }
  }
  return out;
}

/** How far either side of a crit-less hit (ms) valueCrits looks for the lowest hit of its group. */
const VALUE_CRIT_NEAR_MS = 1000;

/**
 * Crits the log leaves out (LogHit.crit null) that the hits' own values show: hits of one key, skill and scale differ
 * only by the buffs that change between them and the crit zone (×1.5 or more), so a hit CRIT_APART above the lowest of
 * its group within VALUE_CRIT_NEAR_MS (a logged non-crit or another crit-less hit) is a crit. Not a group whose logged
 * non-crits stand that far apart by themselves, nor a slot that can be kit hits of two scales. 5082ceaffad1 leaves the
 * crit out of all 85 hits of Yvonne's ultimate; their values are two levels ×3.0 apart (34125 and 11375 at 45.6–46.0 s),
 * and MI Security's layers, which each of her crits refreshes, are listed on her to the fight's end: without the crits
 * the replay let them run out 0.05 s before her finisher (49.78 s, ×1.17). Cross-validated on the development logs
 * (half the logged flags hidden, two folds; scripts/probes/crits/value-xval.ts, 2026-11-23): 1132 of 1260 inferred
 * crits right over every operator (0.90; base rate 0.10), 442 of 445 for Rossi, Chen and Yvonne, whose kits have crit
 * triggers; with each hit's value from another hit of its key (negative control) 0.24. Only for an operator whose kit
 * has a trigger on its own crits; added after the logged crits and those shownCrits and layerCrits give.
 */
export function valueCrits(kits: readonly OperatorKit[], fx: LogFixture, placement: Placement, known: ReadonlyMap<number, boolean> = new Map()): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const ops = new Set(kits.filter((k) => k.triggers.some((t) => t.on.event === "hit" && t.on.crit !== undefined && t.by === "self")).map((k) => k.operator));
  const groups = new Map<string, { h: LogHit; i: number; crit: boolean | null }[]>();
  for (const [i, h] of fx.hits.entries()) {
    if (!ops.has(h.operator) || !(h.value > 0)) continue;
    const p = placement.hits.get(h);
    if (!p || p.sameAs) continue;
    const crit = h.crit ?? known.get(i) ?? null;
    if (crit === true) continue;
    // One scale for the slot: a slot that can be hits of two scales isn't a group.
    const scales = new Set(p.hits.map((x) => x.scale.join("+")));
    if (scales.size !== 1) continue;
    const key = `${h.operator}|${h.event}|${p.cast.skillId}|${[...scales][0]}`;
    groups.set(key, [...(groups.get(key) ?? []), { h, i, crit }]);
  }
  const lowest = (g: readonly { h: LogHit; crit: boolean | null }[], h: LogHit, only: (c: boolean | null) => boolean) => {
    const near = g.filter((x) => x.h !== h && only(x.crit) && Math.abs(x.h.t - h.t) <= VALUE_CRIT_NEAR_MS);
    return near.length ? Math.min(...near.map((x) => x.h.value)) : null;
  };
  for (const g of groups.values()) {
    // A group whose logged non-crits stand apart by themselves splits for another reason (a kit hit the slot doesn't
    // tell apart: Purrchena's attack1, 367 and 551 both logged without a crit in 04d401ad257e).
    if (g.some((x) => x.crit === false && x.h.value >= CRIT_APART * (lowest(g, x.h, (c) => c === false) ?? Infinity))) continue;
    for (const { h, i, crit } of g) {
      if (crit !== null) continue;
      const low = lowest(g, h, () => true);
      if (low !== null && h.value >= CRIT_APART * low) out.set(i, true);
    }
  }
  return out;
}

/**
 * The triggers on crits behind one of a kit's buffs: those that apply it on a crit, and those behind a buff a trigger
 * that applies it listens to (to a depth of a few links). Whose hits each listens to (KitTrigger.by).
 */
function critTriggers(kit: OperatorKit, buffId: string, depth = 0): KitTrigger[] {
  if (depth > 4) return [];
  return kit.triggers.flatMap((t) => {
    if (!allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)) return [];
    return [...(t.on.event === "hit" && t.on.crit !== undefined ? [t] : []), ...("buff" in t.on && t.on.buff !== buffId ? critTriggers(kit, t.on.buff, depth + 1) : [])];
  });
}

/**
 * Why the replay can't decide a buff a kit hit applies, or null: the hit lands only on the path a chance jump takes
 * (every frame of it at or after the jump's target), which the replay rolls on its own stream and the log doesn't
 * give. ad7f5ee2c91c: the replay rolled Alesh's Rare Fin at 13.8 s (his logged slam fits the normal one, ×0.85 as all
 * his hits), so his P3 team ATK, which only the Rare Fin's slam applies, stood on 10 s of everyone's hits the log
 * lists it on none of (Arcane's 30 basic attacks ×0.904, Si's ×0.929).
 */
function chancePathBuff(kit: OperatorKit, buffId: string): string | null {
  for (const t of kit.triggers) {
    if (t.chance === undefined) continue;
    for (const a of allActions(t.do)) {
      if (a.kind !== "jump") continue;
      const skill = kit.skills.find((s) => s.skillId === a.skill);
      for (const h of skill?.hits ?? []) {
        if (!(h.buffs ?? []).some((b) => b.buff === buffId)) continue;
        if (h.frames?.length && h.frames.every((f) => f >= a.to)) return `${t.id}: a chance (${h.id} lands only on the path it jumps to)`;
      }
    }
  }
  return null;
}

/**
 * Why the replay can't decide one of a kit's buffs, or null: a trigger that
 * applies it can't be judged, or listens to a buff that can't (to a depth of
 * a few such links).
 */
function undecidedBuff(kit: OperatorKit, buffId: string, depth = 0): string | null {
  if (depth > 4) return null;
  const byChance = chancePathBuff(kit, buffId);
  if (byChance) return byChance;
  for (const t of kit.triggers) {
    if (!allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)) continue;
    const own = unjudged(t, kit);
    if (own) return own;
    if ("buff" in t.on && t.on.buff !== buffId) {
      const via = undecidedBuff(kit, t.on.buff, depth + 1);
      if (via) return `${t.id} via ${via}`;
    }
  }
  return null;
}

export interface BuffReplay {
  /** Game buffs the replay decides, each with the team's kit buffs that stand for it (`operator:kit buff`). */
  readonly decided: ReadonlyMap<string, readonly string[]>;
  /** Game buffs a kit defines and the log lists that the replay can't decide, and why. */
  readonly undecided: ReadonlyMap<string, string>;
  /** Logged casts the engine couldn't cast (its error). */
  readonly failed: readonly { readonly cast: ReplayedCast; readonly error: string }[];
  /**
   * Casts that hit nothing the replay added (missedCasts: an assumption the log can't show): the skill each was made as,
   * its start in ms, and the logged cast that needs it.
   */
  readonly missed: readonly MissedCast[];
  /** Replayed instances of a decided game buff reaching a logged hit's operator (or on the enemy) at it; null near a change (REPLAY_EDGE_MS). */
  instances(hit: Pick<LogHit, "t" | "operator">, gameBuff: string): number | null;
  /** What the replay knows of a logged cast (placed: logcasts.ts), or why it knows nothing. */
  castFacts(cast: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind">): ReplayCastFacts | { readonly unknown: string };
  /** A logged hit's landing in the replay (its damage, modifiers and LandingFacts), or why there is none. */
  landing(hit: LogHit): LandedHit | { readonly unknown: string };
  /**
   * A logged status hit's landing (a burst, reaction, physical status or Combustion tick): the replay's status damage of
   * its operator, kind and element nearest it within NEAR_FRAMES (each landing once), or why there is none.
   */
  statusLanding(hit: LogHit): LandedHit | { readonly unknown: string };
  /**
   * Whether the replay's instances of a kit buff (`owner:id`, every kit buff of the team, KitBuff.gameBuff or not)
   * reaching a logged hit's operator change near the hit (REPLAY_EDGE_MS, and an expiry's REPLAY_EXPIRY_SLACK of its
   * life): its timing could be the replay's, not the game's.
   */
  kitBuffNearChange(hit: Pick<LogHit, "t" | "operator">, kitBuff: string): boolean;
  /**
   * The replay's instances of a kit buff (`owner:id`, not one a cast carries) reaching an operator, as windows in ms
   * (`end` Infinity: never ended; `expired`: it ran out), for the buff timing report (bufftiming.ts). The state is
   * sampled at the logged hits and REPLAY_EDGE_MS either side: an end before it ran out is at the first sample without
   * it. Empty when the replay didn't run.
   */
  kitWindows(kitBuff: string, operator: string): readonly KitWindow[];
  /** Whether the replay's Stagger starts or ends within REPLAY_EDGE_MS of a time (ms). */
  staggerNearChange(t: number): boolean;
  /** Kit buffs (`owner:id`) the replay can't judge, whatever the log lists: a trigger behind them it can't judge (undecidedBuff), and why. */
  readonly unjudgedKitBuffs: ReadonlyMap<string, string>;
  /** Every landing of the replay (its own included: hits the log may not have), for the totals' comparison. */
  readonly hits: readonly LandedHit[];
  /** The replay's status events (reactions, bursts, statuses), and the frames the enemy became Staggered. */
  readonly reactions: readonly ReactionRecord[];
  readonly staggers: readonly number[];
  /** The replay's Stagger windows (frames): where each began and ended (ran out, or ended by a refill or the log's calm hit). */
  readonly staggerSpans: readonly { readonly start: number; readonly end: number }[];
  /**
   * Where the replay held a Stagger the log lists past the engine's own (loggedStaggerSteps; frames): `engineUntil`, the
   * frame the engine's own would have ended, or null where it had none running (it ended earlier, or never began).
   */
  readonly staggerHolds: readonly { readonly frame: number; readonly engineUntil: number | null }[];
  /** Where the log's calm hit (or its bar back up) ended a Stagger the engine's own still had running (frames): `engineUntil`, the frame it would have ended. */
  readonly staggerCuts: readonly { readonly frame: number; readonly engineUntil: number }[];
  /** The frame the replay stopped at, if it couldn't go on (BuffReplay.failed says why). */
  readonly brokenAt: number | null;
  /**
   * Logged casts the replay made against the kit (CastFlag): a skill its kit says isn't available then, or one started
   * inside the operator's running action's uncuttable frames. The replay's state may be wrong from there on.
   */
  readonly castFlags: readonly CastFlag[];
  /** With ReplayOptions.trace: each change of a traced kit buff's instances (start, end moved, gone), step by step. */
  readonly traces: readonly BuffTrace[];
  /** The fight's hidden holds the replay placed (engine assumption hidden-holds, reading `placed`: holds.ts), else null. */
  readonly hiddenHolds: PlacedHolds | null;
  /** With the holds placed: each replayed instance of a kit buff or enemy status, and why it is a clock of them or not (holds.ts ClockWhy; `zmdlogs holds --why`). */
  readonly holdClocks?: readonly ClockWhy[];
  /**
   * The SP each logged cast lacked in the replay (its cost less the team's SP then; drivers.ts replayCast raises it to the
   * cost silently: docs/open-problems.md "Team SP"), for the casts that lacked any.
   */
  readonly spTopUps: readonly { readonly frame: number; readonly operator: string; readonly skillId: string; readonly sp: number }[];
}

/** A logged cast the replay made against its kit (BuffReplay.castFlags). */
export interface CastFlag {
  readonly cast: ReplayedCast;
  /** The skill it was made as. */
  readonly skillId: string;
  /** Its frame in the replay. */
  readonly frame: number;
  /**
   * "forced": its kit says the skill isn't available then (KitSkill.available: a stance holds the slot), and no variant
   * is; "inside": the operator's running action can't be cut yet (its exclusive frames), so the cast ended it early.
   */
  readonly kind: "forced" | "inside";
  readonly why: string;
}

/** One change of a traced kit buff (ReplayOptions.trace) at a step of the replay: frames. */
export interface BuffTrace {
  /** `owner:id` and the recipient-independent instance (its start frame). */
  readonly buff: string;
  readonly appliedAt: number;
  /** The step's frame and what it was (a cast, the log's Stagger steps, or time passing to a sample). */
  readonly frame: number;
  readonly step: string;
  /**
   * Its expiry before and after the step (null: it didn't exist / is gone). The state is sampled after each step, so a
   * buff that ran out between two steps shows gone at the later step's frame with `from` its expiry (`from <= frame`):
   * it ran out then, the step didn't cut it (round 6: `zmdlogs clock` first read such an end as a cut).
   */
  readonly from: number | null;
  readonly to: number | null;
}

/** A cast that hit nothing the replay added (BuffReplay.missed). */
export interface MissedCast {
  readonly operator: string;
  readonly skillId: string;
  /** Its start, in ms. */
  readonly start: number;
  /** The logged cast that needs it: its placed skill and start (ms). */
  readonly need: { readonly skillId: string; readonly start: number };
}

/** One replayed instance of a kit buff at an operator, in ms (BuffReplay.kitWindows). */
export interface KitWindow {
  readonly start: number;
  readonly end: number;
  readonly expired: boolean;
}

/** A fact the replay knows, or why it doesn't (the log check then tries alternatives, labelled with the reason). */
export type Fact<T> = { readonly value: T } | { readonly unknown: string };

/** The kit buffs a cast consumed (ActiveBuff with `cast`: they act on its hits only): their IDs (an ID per instance) and their modifiers on the caster's hits (buffModifiers). */
export interface ConsumedBuffs {
  readonly buffs: readonly string[];
  readonly modifiers: readonly Modifier[];
}

/**
 * What the replay knows of one logged cast: facts the log doesn't list, which the log check reads instead of trying
 * alternatives. A fact the replay's own timing could change (a Link stack or a consumable buff starting, ending or
 * used by another cast within REPLAY_EDGE_MS of the cast, as for the kit buffs it decides) is unknown.
 */
export interface ReplayCastFacts {
  /** Its index in the replay's cast list. */
  readonly index: number;
  /** The Link stacks it used (Cast.link; 0: none). */
  readonly link: Fact<number>;
  /** A combo's window count as the replay had it open (unknown when the replay saw no window: replayCast opens one counting 1). */
  readonly windowCount: Fact<number>;
  /** The kit buffs it consumed (KitBuff.consumedBy: they act on its hits only). */
  readonly consumed: Fact<ConsumedBuffs>;
}

/** The facts of a trigger's hits: of no cast (timeline/actions.ts: a trigger's `hits` action lands hits without one). */
const TRIGGERED: ReplayCastFacts = { index: -1, link: { value: 0 }, windowCount: { unknown: "a trigger's hits, of no cast" }, consumed: { value: { buffs: [], modifiers: [] } } };

/** The game buffs the log lists with values somewhere (effects or boundary effects). */
function listedWithValues(fx: LogFixture): Set<string> {
  return new Set(fx.hits.flatMap((h) => [...h.effects, ...h.boundaryEffects].map((e) => e.buff)));
}

/**
 * The enemy's HP over the fight from the logged damage (TimelineScenario.enemyHp), in steps of 1% of its Max HP; only
 * when the logged damage is its Max HP (a fight against several phases or enemies of the type doesn't say whose HP).
 */
function loggedEnemyHp(data: GameData, fx: LogFixture): TimelineScenario["enemyHp"] {
  const max = data.enemies[fx.enemy.id]?.levels[fx.enemy.level - 1]?.[Attr.MaxHp];
  if (!max || Math.abs(fx.hits.reduce((s, h) => s + h.value, 0) / max - 1) > 1e-3) return undefined;
  const out: { from: number; fraction: number }[] = [];
  let dealt = 0;
  let step = 100;
  for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
    dealt += h.value;
    const fraction = Math.max(0, 1 - dealt / max);
    if (Math.floor(fraction * 100) < step) {
      step = Math.floor(fraction * 100);
      out.push({ from: Math.round((h.t * FPS) / 1000) + 1, fraction });
    }
  }
  return out;
}

const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);

/** A logged cast as the replay casts it. */
export interface ReplayedCast extends LoggedCast {
  /** Its last logged hit, in ms. */
  readonly lastHit: number;
  /** The operator's cast before it keeps its hits to come: the log has them landing after this one started (replayCast keepPrevious). */
  readonly keepPrevious: boolean;
  /** Its landings at their logged frames (replayCast landings): each logged hit of the cast whose kit landing the placement knows. */
  readonly landings: readonly { readonly hitId: string; readonly nth: number; readonly frame: number; readonly ref: string; readonly ms: number }[];
  /**
   * A logged cast event of a skill whose damage the log shows elsewhere, kept only for the slot it stands for: the replay
   * makes it only when the skill can't start there and another of the operator's skills of its kind can (replayedSkill:
   * Si's second battle-skill press under Artful Intent is logged as her battle skill, and is Initial Stroke). Only one
   * that `leadsTo` an inferred cast (castsFromBuffEnds) or is the variant pulling a buff (`as`: pullingPresses) is made
   * so: a press is shown as another skill only where the log shows what that skill leads to (Liino's battle skill at
   * 4187 ms in 0eef2474a26f, during her Vocalist Stance, would be End Stance, but the log keeps the stance's ATK on her
   * team after it).
   */
  readonly slot?: true;
  /** The skill of the inferred cast the press leads to: the press is made as another variant, a step before it. */
  readonly leadsTo?: string;
  /** The variant the press is made as while the slot holds it (pullingPresses: Si's first press after her battle skill is Initial Stroke). */
  readonly as?: string;
  /**
   * A slot cast's variants (skills of its kind, not cast near it) whose own keys the log shows within SLOT_SHOWS_MS
   * after the press: the press is the one of them its kit says the slot holds then (3aa6ab93bad4: Zhuang Fangyi's
   * battle-skill presses during her ultimate, logged as normal_skill, are normal_skill_ult, whose keys follow each).
   */
  readonly shows?: readonly string[];
  /** A slot cast whose first landing would come where the log has no hit by anyone within QUIET_MS (no enemy to hit). */
  readonly unseen?: true;
  /**
   * No cast: the logged end of `whileBuff`'s buff is its expiry, which the replay's clock has later (castsFromBuffEnds:
   * the logged hit's trigger branch rules out the cast that ends it). Made by ending the buff then (it expires at the
   * frame), with no cast event (no battle-skill cast for a trigger by skill type).
   */
  readonly expires?: true;
  /**
   * Inferred from a logged hit of a trigger on this buff's end (castsFromBuffEnds), at `endsAt` ms: cast only while the
   * buff is active and would last past that end by itself (else its expiry is the end: bdf223db8e49's burst at 24321 ms
   * is Artful Intent's own expiry, its mark projectile, not Final Stroke's).
   */
  readonly whileBuff?: { readonly buff: string; readonly endsAt: number; /** Or any of these (exitPresses: the buffs the exit ends). */ readonly or?: readonly string[] };
  /** A basic attack of an operator the log shows isn't controlled then: its own attack beside the controlled one's (controlledFromLog). */
  readonly teammate?: true;
  /**
   * A cast that hit nothing, which the log can't show (missedCasts): added only before a logged cast of its operator that
   * the kit allows only with it, `skill` at `at` ms. Its skill is the step the kit allows at its frame (missedStep).
   */
  readonly missed?: { readonly skill: string; readonly at: number };
  /**
   * A cast before the log began (castsBeforeLog; `start` < 0): none of its hits are in the log, what it left running is
   * (its stance, its ticking buffs). The replay starts with it already made (withCastBeforeLog), not as a step.
   */
  readonly beforeLog?: true;
}

/** How far from a placed cast's start a logged cast event of its skill may be to be that cast (ms). */
export const LOGGED_CAST_MS = 2500;
/** A combo's own cast event comes at most this long of the world's time before its placed start or after its last landing (ms; withLoggedCasts). */
const COMBO_EVENT_MS = 1500;
/** How far after a combo's last landing its own cast event may be, in the world's time (ms; loggedCastMatcher). */
const COMBO_EVENT_AFTER_MS = 1000;

/**
 * The replay's casts with the casts the log records without damage (LogFixture.casts) that it lacks: a logged cast of
 * a kit skill whose damage the log never shows for its operator, with no placed cast of the skill within LOGGED_CAST_MS
 * (40d9a3c1da37: Laevatain's ultimate at 3041 ms, whose damage comes as her enhanced attacks). A skill whose hits the
 * log shows elsewhere isn't added where it doesn't (it may be a variant the kit models otherwise: 0eef2474a26f, Liino's
 * battle skill at 4187 ms, whose only damage is her talent's volley); a placed cast keeps its start (the log's cast
 * event can come before the skill acts: Liino's battle skill at 760 ms, its buffs at 1314 ms). Follow-up-only skills
 * are left to the engine.
 */
/** How soon after a slot press the log must show a variant's own keys for the press to be that variant (ms; withLoggedCasts). */
const SLOT_SHOWS_MS = 3000;

/** How far from a slot press's first landing the log has no hit by anyone for the press to be `unseen` (ms). */
const QUIET_MS = 1000;

/**
 * Where a logged cast of a skill without logged hits of its own starts: an ultimate's cast event can come at its time
 * stop's end (b6aa15281db4: Xaihi's at 31027 ms, after 1.8 s without a hit by anyone; her Amp, at frame 58, is on hits
 * from 31592 ms). When no hit by anyone falls in the stop's length before the event, one falls at it, and no other
 * cast's stop covers half of it (dbaee23b801d: Xaihi's at 7606 ms inside Liino's stop, her Amp not yet on 8501 ms), it
 * started that early.
 */
function loggedCastStart(data: GameData | undefined, lc: { t: number; operator: string; skill: string }, kind: SkillType, hits: readonly LogHit[], stops: readonly TimeStop[]): number {
  if (!data || kind !== "ultimate") return lc.t;
  const stop = data.skills[lc.skill]?.timing?.slowdowns.find((d) => d.from === 0 && Math.min(...d.scales) === 0);
  if (!stop) return lc.t;
  const length = (stop.scales.length * 1000) / FPS;
  const [from, to] = [lc.t - length, lc.t];
  if (hits.some((h) => h.t > from + EDGE_MS && h.t < to - EDGE_MS)) return lc.t;
  // What waited out a time stop lands as it ends: another's hit at the event's own time (b6aa15281db4: Arcane's attack
  // 2 at 31027 ms) says the stop ended there (not the caster's own: d774d0ce7bd3, Zhuang Fangyi's sword at her ultimate),
  // and so does another's hit soon after it (RESUME_MS), which a stop starting at the event would have held: Laevatain's
  // ultimate, logged at its stop's end in every log (the last hit before it 2.0–2.9 s earlier, her stop 2.03 s), the team
  // resuming 83–356 ms after it in 012ae1c80ae6, c83c75d02a85, db8711232de9, e9896c8d02be, f8793bc8aea2, 2b013866dfa3.
  // Without one (e82d45c46040: Xaihi's at 3896 ms after 2315 ms, her Amp not yet on Arcane's hit at 7022 ms) the event is
  // the cast.
  if (!hits.some((h) => h.operator !== lc.operator && h.t >= lc.t - FLUSH_MS && h.t <= lc.t + RESUME_MS)) return lc.t;
  const covering = stops.filter((x) => {
    if (x.operator === lc.operator) return false;
    const [a, b] = [(x.start * 1000) / FPS, ((x.start + x.scales.length) * 1000) / FPS];
    return Math.min(b, to) - Math.max(a, from) >= length / 2;
  });
  if (covering.length === 0) return Math.round(from);
  // Logged at the very end of the stop that covers it (within EDGE_MS), it waited for that stop's end to be logged, as a
  // press during a stop is: it was pressed inside that stop and ran beside it, its own stop overlapping (4d60e7fe92c2:
  // Zhuang Fangyi's at 157421 ms, Liino's stop ending at 157.47 s; her Empyrean basic attacks land from 158379 ms and
  // Liino's song beats at 158.66 and 160.03 s, which a stop of 2.6 s from the event would have held). It starts a frame
  // after the covering stop does, so that one's caster runs on to its own stop's end (clock.ts slowDown).
  const atEnd = covering.find((x) => Math.abs(((x.start + x.scales.length) * 1000) / FPS - lc.t) <= EDGE_MS);
  return atEnd ? Math.max(Math.round(from), Math.round(((atEnd.start + 1) * 1000) / FPS)) : lc.t;
}

/** How close to a window's edges a logged hit may be and still not count as inside it (ms; loggedCastStart). */
const EDGE_MS = 100;
/** How close to a cast event a logged hit is at it (ms; loggedCastStart). */
const FLUSH_MS = 15;
/** How soon after an ultimate's cast event another's hit says the team resumed from its stop (ms; loggedCastStart). */
const RESUME_MS = 500;

/**
 * Whether a placed cast `c` is the logged cast event `lc` of `skill` (withLoggedCasts; loggedCastFates shows the
 * result per event).
 */
function loggedCastMatcher(kits: readonly OperatorKit[], stops: readonly TimeStop[]): (c: ReplayedCast, lc: { t: number; operator: string }, skill: string) => boolean {
  // A placed cast is the logged one within LOGGED_CAST_MS of the world's time: the log's times run on through time stops
  // (a7a7a40c97ed: Arcane's battle skill pressed at 37415 ms, placed from its hits at 40523 ms, 351 ms later across
  // Wulfgard's and her own ultimates' stops).
  // A combo's own event is within COMBO_EVENT_MS of the world's time before its start or COMBO_EVENT_AFTER_MS after its
  // last landing (it lags frame 0 by 0.3–0.7 s; e82d45c46040: Arcane's press at 3896 ms, her combo placed at 6.52 s after two ultimates'
  // stops): one further off is an entity's CastSkill logged under its id, though within LOGGED_CAST_MS of its start
  // (a7a7a40c97ed: Arcane's INT lasers' events at 42128 and 48886 ms, 2.4 s of the world's time after her combo's touch
  // at 37.08 s and before the one at 51.5 s; with Liino's combo stop placed from its end, 2026-11-23, the one at 42128 ms
  // is 1.35 s of the world's time after the touch: after the last landing the window is COMBO_EVENT_AFTER_MS, the
  // event's lag behind frame 0 (0.3–0.7 s) less the touch's frame 15, with the log's batching).
  // Only for a skill a buff's ticks are logged under (KitBuff.ticksLoggedAs): elsewhere such events stay with the cast.
  const ticked = new Set(kits.flatMap((k) => k.buffs.flatMap((d) => (d.ticksLoggedAs !== undefined ? [`${k.operator}|${d.ticksLoggedAs}`] : []))));
  return (c, lc, skill) =>
    c.operator === lc.operator && c.skillId === skill && worldMs(Math.min(c.start, lc.t), Math.max(c.start, lc.t), stops) <= LOGGED_CAST_MS &&
    !(c.kind === "combo" && ticked.has(`${c.operator}|${skill}`) && (worldMs(Math.min(lc.t, c.start), c.start, stops) > COMBO_EVENT_MS || worldMs(c.lastHit, Math.max(lc.t, c.lastHit), stops) > COMBO_EVENT_AFTER_MS));
}

export function withLoggedCasts(casts: readonly ReplayedCast[], fx: Pick<LogFixture, "casts" | "hits">, kits: readonly OperatorKit[], data?: GameData, stops: readonly TimeStop[] = []): ReplayedCast[] {
  if (!fx.casts?.length) return [...casts];
  const logged = new Set(fx.hits.map((h) => `${h.operator}|${h.event}`));
  const added: ReplayedCast[] = [];
  const near = loggedCastMatcher(kits, stops);
  for (const lc of fx.casts) {
    const skill = kits.find((k) => k.operator === lc.operator)?.skills.find((x) => x.skillId === lc.skill);
    if (!skill || skill.followUpOnly) continue;
    if (casts.some((c) => near(c, lc, lc.skill))) continue;
    const shownElsewhere = skill.hits.some((h) => h.events.some((e) => logged.has(`${lc.operator}|${e}`)));
    const own = new Set(skill.hits.flatMap((h) => h.events));
    const kit = kits.find((k) => k.operator === lc.operator);
    const shows = shownElsewhere
      ? (kit?.skills ?? [])
          .filter((k) => k.skillId !== lc.skill && k.kind === skill.kind && !k.followUpOnly && !casts.some((c) => near(c, lc, k.skillId)))
          .filter((k) => k.hits.some((h) => h.events.some((e) => !own.has(e) && fx.hits.some((x) => x.operator === lc.operator && x.event === e && x.t >= lc.t && x.t <= lc.t + SLOT_SHOWS_MS))))
          .map((k) => k.skillId)
      : [];
    const landsAt = lc.t + (Math.min(...skill.hits.flatMap((h) => loggedFrames(h) ?? [])) * 1000) / FPS;
    const unseen = shownElsewhere && Number.isFinite(landsAt) && !fx.hits.some((h) => Math.abs(h.t - landsAt) <= QUIET_MS);
    const start = shownElsewhere ? lc.t : loggedCastStart(data, lc, skill.kind, fx.hits, stops);
    added.push({ operator: lc.operator, key: lc.skill, group: lc.skill, skillId: lc.skill, kind: skill.kind, start, lastHit: start, keepPrevious: false, landings: [], ...(shownElsewhere ? { slot: true as const } : {}), ...(shows.length ? { shows } : {}), ...(unseen ? { unseen: true as const } : {}) });
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/** Casts in time order, each keeping its operator's previous cast's hits when the log shows them after it started. */
function ordered(casts: readonly ReplayedCast[]): ReplayedCast[] {
  const previous = new Map<string, ReplayedCast>();
  return [...casts].sort((x, y) => x.start - y.start).map((c) => {
    const prev = previous.get(c.operator);
    const r = { ...c, keepPrevious: prev !== undefined && prev.lastHit > c.start };
    previous.set(c.operator, r);
    return r;
  });
}

/**
 * Casts the log shows only by a buff's end: a logged hit of a trigger on the end of one of its operator's buffs
 * (`buffEnded`), where the kit ends that buff on a cast of a skill (a trigger on the cast with an `endBuff` of it), and no
 * cast of that skill is replayed from its delay plus LOGGED_CAST_MS before the end. Then a cast of the skill at the end
 * less the trigger's delay, made only if the buff is still active then (else its expiry explains the end). Si's Final
 * Stroke: its press isn't in the log's cast events, the Inksoul's burst after Artful Intent's end is (0eef2474a26f at
 * 10030 ms; accuracy plan A2).
 */
/** How much longer than a logged buff end the replay's buff must last for an inferred cast to be what ended it (castsFromBuffEnds). */
const EXPIRY_MARGIN_FRAMES = 6;

/** The buffs a predicate needs active (a `buffActive`, alone or in an `all`). */
function neededBuffs(p: Predicate | undefined): string[] {
  if (!p) return [];
  if ("buffActive" in p) return [p.buffActive];
  if ("all" in p) return p.all.flatMap(neededBuffs);
  return [];
}

/** Whether a branch's condition (`not` a buff active) rules out a skill whose availability needs that buff. */
function excludes(branch: Predicate | undefined, available: Predicate | undefined): boolean {
  const without = branch && "not" in branch ? neededBuffs(branch.not) : [];
  return without.length > 0 && neededBuffs(available).some((b) => without.includes(b));
}

export function castsFromBuffEnds(kits: readonly OperatorKit[], placement: Placement, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  const leads = new Map<number, string>();
  for (const pc of placement.casts) {
    if (!pc.group.startsWith("trigger:")) continue;
    const kit = kits.find((k) => k.operator === pc.operator);
    const t = kit?.triggers.find((x) => `trigger:${x.id}` === pc.group);
    if (!kit || !t || t.on.event !== "buffEnded" || !("buff" in t.on)) continue;
    const buff = t.on.buff;
    // The trigger's actions the logged hits come from: their conditions say which state the buff ended in.
    const ids = new Set([...placement.hits].flatMap(([h, p]) => (p.cast === pc ? p.hits.filter((k) => k.events.length === 0 || k.events.includes(h.event)).map((k) => k.id) : [])));
    const branches = allActions(t.do).filter((a) => a.kind === "hits" && a.hits.some((k) => ids.has(k.id)));
    // The skill the logged hits' Stagger is credited to (LogHit.poise.origin: the cast whose id the hit's skill inherits).
    const origins = new Set([...placement.hits].flatMap(([h, p]) => (p.cast === pc && h.poise?.origin ? [h.poise.origin] : [])));
    for (const e of kit.triggers) {
      if (e.on.event !== "cast" || !e.on.skills?.length || !allActions(e.do).some((a) => a.kind === "endBuff" && a.buff === buff)) continue;
      const skillId = e.on.skills[0] as string;
      const skill = kit.skills.find((x) => x.skillId === skillId);
      if (!skill) continue;
      // A skill castable only with a buff can't have ended it where the logged hits come from the branch without that
      // buff: its expiry did, which the replay's clock has later (Si's Final Stroke needs the Inksoul; the mark's own
      // burst, inkmark_projhit, is Artful Intent's end without one: 0c14fb3ce77d at 66.37 s, 489c0be3e162 at 100.2 s,
      // each made a Final Stroke against its kit and a Yinglung's Edge layer the combo's damage doesn't have;
      // bdf223db8e49 at 24.32 s). The buff ends at the logged end, with no cast.
      // So is a skill the logged hits aren't credited to, where the log says whose they are (LogHit.poise.origin): Si's
      // Final Stroke casts the Inksoul's return inheriting its own cast (origin normal_skill_2, 0eef2474a26f at 10030 ms);
      // the Inksoul returning by itself at Artful Intent's expiry has its own (normal_skill_inkmove_2: c83c75d02a85 at
      // 23.54, 57.26 and 87.89 s, 9555de54bb3d at 53.09 and 85.56 s, each 2–3 s after her last press, where a Final
      // Stroke inferred from the burst gave a Type 50 Yinglung's Edge layer the combo's damage doesn't have).
      if ((branches.length && branches.every((a) => excludes(a.if, skill.available))) || (origins.size > 0 && !origins.has(skillId))) {
        added.push({ operator: pc.operator, key: skillId, group: skillId, skillId, kind: skill.kind, start: pc.start, lastHit: pc.start, keepPrevious: false, landings: [], whileBuff: { buff, endsAt: pc.start }, expires: true });
        break;
      }
      const start = pc.start - ((e.delay ?? 0) * 1000) / FPS;
      if ([...casts, ...added].some((c) => c.operator === pc.operator && e.on.event === "cast" && (e.on.skills ?? []).includes(c.skillId) && c.start <= pc.start && c.start >= start - LOGGED_CAST_MS)) continue;
      added.push({ operator: pc.operator, key: skillId, group: skillId, skillId, kind: skill.kind, start, lastHit: start, keepPrevious: false, landings: [], whileBuff: { buff, endsAt: pc.start } });
      // A slot press of its kind shortly before it is the step that leads to it (Si's Initial Stroke before Final Stroke).
      for (const [i, c] of casts.entries()) {
        if (c.slot && c.operator === pc.operator && c.kind === skill.kind && c.start <= start && c.start >= start - 2 * LOGGED_CAST_MS && !leads.has(i)) leads.set(i, skillId);
      }
      break;
    }
  }
  // In time order, without recomputing the others' keepPrevious: an inferred cast the replay may skip isn't anyone's
  // previous cast (it keeps the running cast's hits itself).
  if (!added.length) return [...casts];
  const all = [...casts.map((c, i) => (leads.has(i) ? { ...c, leadsTo: leads.get(i) as string } : c)), ...added.map((c) => ({ ...c, keepPrevious: true }))].sort((x, y) => x.start - y.start);
  // The operator's next cast before the logged end keeps what the inferred cast has to come (a7a7a40c97ed: Si's attack 2
  // 0.3 s after the Final Stroke that ends her Artful Intent at 56469 ms, its burst the killing hit).
  return all.map((c, i) => {
    const prev = all.slice(0, i).reverse().find((x) => x.operator === c.operator);
    return prev && added.some((a) => a.operator === prev.operator && a.start === prev.start && a.skillId === prev.skillId) && prev.whileBuff && c.start < (prev.whileBuff.endsAt as number) ? { ...c, keepPrevious: true } : c;
  });
}

/**
 * Slot presses that are the variant pulling a buff: a skill castable only while one buff is on and another off (its
 * `available`: all of A, not B) whose cast gives B (a trigger on its cast with a `buff` of it): Si's Initial Stroke,
 * castable under Artful Intent before the Inksoul, which it pulls. The first slot press of its kind after each landed
 * cast whose hits apply A (her battle skill's hit), before the next, is made as that variant (ReplayedCast.as), unless
 * the log shows A ending on a branch without B (the mark's own burst, inkmark_projhit: no Initial Stroke; its one press,
 * 20–34 s after the battle skill, ends Artful Intent and gives no Type 50 Yinglung's Edge layer: 0c14fb3ce77d 81.7,
 * 4e3651100056 37.4). The logs make the first press after her battle skill Initial Stroke: the Inksoul's bursts at
 * Artful Intent's end (inkmove_2) need it, and Type 50 Yinglung's Edge counts it (c83c75d02a85 35.8 and 82.3 s,
 * 0c14fb3ce77d 122.1, e9896c8d02be 53.0; open-problems "Type 50 Yinglung's Edge"). Her later presses under Artful
 * Intent (every ~3.3 s) leave nothing in the log: no hit, no end, her basic chain goes on (in-game test 16), no layer:
 * not made (replayedSkill), as before.
 */
export function pullingPresses(kits: readonly OperatorKit[], placement: Placement, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const marks = new Map<number, string>();
  for (const kit of kits) {
    for (const v of kit.skills) {
      const all = v.available && "all" in v.available ? v.available.all : [];
      const on = all.flatMap((p) => ("buffActive" in p ? [p.buffActive] : []));
      const off = all.flatMap((p) => ("not" in p && "buffActive" in p.not ? [p.not.buffActive] : []));
      const pulled = kit.triggers.filter((t) => t.on.event === "cast" && (t.on.skills ?? []).includes(v.skillId)).flatMap((t) => allActions(t.do).flatMap((a) => (a.kind === "buff" && off.includes(a.buff) ? [a.buff] : [])));
      const [a] = on;
      if (on.length !== 1 || a === undefined || pulled.length === 0) continue;
      const appliers = new Set(kit.skills.filter((s) => s.hits.some((h) => (h.buffs ?? []).some((b) => b.buff === a))).map((s) => s.skillId));
      // A's logged ends on a branch without the pulled buff: a trigger on A's end whose logged hits come only from such branches.
      const noPull: number[] = [];
      for (const pc of placement.casts) {
        const t = kit.triggers.find((x) => pc.operator === kit.operator && `trigger:${x.id}` === pc.group);
        if (!t || t.on.event !== "buffEnded" || !("buff" in t.on) || t.on.buff !== a) continue;
        const ids = new Set([...placement.hits].flatMap(([h, p]) => (p.cast === pc ? p.hits.filter((k) => k.events.length === 0 || k.events.includes(h.event)).map((k) => k.id) : [])));
        const branches = allActions(t.do).filter((x) => x.kind === "hits" && x.hits.some((k) => ids.has(k.id)));
        if (branches.length && branches.every((x) => x.if !== undefined && "not" in x.if && neededBuffs(x.if.not).some((b) => pulled.includes(b)))) noPull.push(pc.start);
      }
      const own = casts.flatMap((c, i) => (c.operator === kit.operator ? [{ c, i }] : []));
      const starts = own.filter(({ c }) => appliers.has(c.skillId) && c.landings.length > 0);
      for (const [k, { c }] of starts.entries()) {
        const next = starts[k + 1]?.c;
        if (noPull.some((t) => t > c.lastHit && t <= (next?.lastHit ?? Infinity))) continue;
        const press = own.find(({ c: x }) => x.slot && x.kind === v.kind && x.start > c.lastHit && x.start < (next?.start ?? Infinity));
        if (press && !marks.has(press.i)) marks.set(press.i, v.skillId);
      }
    }
  }
  return marks.size ? casts.map((c, i) => (marks.has(i) ? { ...c, as: marks.get(i) as string } : c)) : [...casts];
}

/**
 * Exit presses the log doesn't record: a logged cast (with landings) of a skill castable only outside a state (its
 * `available` is `not` P), where the operator's skill of its kind castable only inside it (`available` P: the slot's
 * variant then) ends a buff of that state (a trigger on its cast with an `endBuff`). The game can't cast the logged skill
 * while the variant holds the slot, so the variant was pressed first: an inferred cast of it after the last logged hit
 * that lists that buff's game buffs (loggedNames) before the logged cast (no later than a frame before it), made only while the buff is on and would last past then by itself (whileBuff). Liino's End Stance before a battle
 * skill during Cosmovoice: 4360447193ac lists Cosmovoice's Amp to 62.10 s, not from 62.76 s, and her battle skill's
 * projectiles land from 64.41 s, with no finale (End Stance skips it); 984748cfa662 to 73.13 s, the battle skill's at
 * 75.84 s. The replay made the battle skill inside Cosmovoice and kept its Amp and ATK on everyone (Perlica's hits there
 * ×0.62–0.70 the replay's).
 */
export function exitPresses(kits: readonly OperatorKit[], fx: Pick<LogFixture, "hits">, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const c of casts) {
    if (c.landings.length === 0 || c.kind === null || c.slot) continue;
    const kit = kits.find((k) => k.operator === c.operator);
    const skill = kit?.skills.find((s) => s.skillId === c.skillId);
    const avail = skill?.available;
    if (!kit || !avail || !("not" in avail)) continue;
    const exit = kit.skills.find((s) => s.skillId !== c.skillId && s.kind === c.kind && same(s.available, avail.not));
    if (!exit) continue;
    const ended = kit.triggers.filter((t) => t.on.event === "cast" && (t.on.skills ?? []).includes(exit.skillId)).flatMap((t) => allActions(t.do).flatMap((a) => (a.kind === "endBuff" ? [a.buff] : [])));
    // The last logged hit before the cast that lists one of the ended buffs' game buffs.
    const names = new Set(ended.flatMap((id) => {
      const def = kit.buffs.find((b) => b.id === id);
      return def ? loggedNames(def) : [];
    }));
    const last = fx.hits.filter((h) => h.t < c.start && h.effects.some((e) => names.has(e.buff))).at(-1);
    const [first, ...rest] = ended;
    if (!last || first === undefined) continue;
    const start = Math.min(last.t + 1000 / FPS, c.start - 1000 / FPS);
    if (casts.some((d) => d.operator === c.operator && d.skillId === exit.skillId && d.start >= last.t && d.start <= c.start)) continue;
    added.push({ operator: c.operator, key: exit.skillId, group: exit.skillId, skillId: exit.skillId, kind: exit.kind, start, lastHit: start, keepPrevious: false, landings: [], whileBuff: { buff: first, endsAt: start, or: rest } });
  }
  if (!added.length) return [...casts];
  return [...casts, ...added].sort((x, y) => x.start - y.start);
}

/**
 * Casts the log shows only by a buff they apply (its buff lanes: the hits listing it): a game buff the log lists with
 * values that one trigger of the team applies, on the owner's casts of skills whose damage the log never shows for it
 * (dbaee23b801d: Xaihi's ultimate, no damage, applies her weapon's team ATK, buff_wpn_funnel_0005_atk_up). Each run of
 * the buff's listings (gaps no longer than its duration) without a cast of such a skill within its duration before
 * gets one, its trigger's delay and a frame before the run's first listing (its start is no later; within
 * REPLAY_EDGE_MS of it, the replay doesn't decide the buff). Returns the casts with those added.
 */
export function castsFromBuffLanes(data: GameData, fx: LogFixture, kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): ReplayedCast[] {
  const logged = new Set(fx.hits.map((h) => `${h.operator}|${h.event}`));
  const listed = listedWithValues(fx);
  const appliers = new Map<string, { kit: OperatorKit; t: KitTrigger; def: KitBuff }[]>();
  for (const kit of kits) {
    for (const t of kit.triggers) {
      for (const a of allActions(t.do)) {
        const def = a.kind === "buff" ? kit.buffs.find((b) => b.id === a.buff) : undefined;
        if (def?.gameBuff && listed.has(def.gameBuff)) appliers.set(def.gameBuff, [...(appliers.get(def.gameBuff) ?? []), { kit, t, def }]);
      }
    }
  }
  // A game buff a skill's hit applies too isn't one trigger's (bdf223db8e49: Liino's Vocalist Stance ATK by her battle
  // skill's hit and Cosmovoice's by her ultimate's frame-77 trigger share buff_chr_0035_liino_atkup; the stance's
  // listings made an ultimate at 0 ms).
  for (const kit of kits) for (const e of kitHitEntries(kit)) for (const b of e.hit.buffs ?? []) {
    const def = kit.buffs.find((x) => x.id === b.buff);
    if (def?.gameBuff) appliers.delete(def.gameBuff);
  }
  const added: ReplayedCast[] = [];
  for (const [g, list] of appliers) {
    if (list.length !== 1) continue;
    const { kit, t, def } = list[0] as { kit: OperatorKit; t: KitTrigger; def: KitBuff };
    if (t.on.event !== "cast" || t.by !== "self" || (!t.on.skills?.length && !t.on.kinds?.length)) continue;
    const on = t.on;
    const skill = kit.skills.find((s) => (on.skills?.includes(s.skillId) || on.kinds?.includes(s.kind)) && !s.followUpOnly && !s.hits.some((h) => h.events.some((e) => logged.has(`${kit.operator}|${e}`))));
    const build = fx.team.find((b) => b.operator === kit.operator);
    if (!skill || !build) continue;
    let ms: number;
    try {
      const b = applyBuff(data, build, computeStats(data, build), triggerSkillId(kit.operator, t), def, 0);
      if (!b || !Number.isFinite(b.expiresAt)) continue;
      ms = (b.expiresAt * 1000) / FPS;
    } catch (e) {
      if (!readingDoesNotApply(e)) throw e;
      continue; // its duration needs a fight
    }
    const times = [...new Set(fx.hits.filter((h) => h.effects.some((e) => e.buff === g)).map((h) => h.t))].sort((a, b) => a - b);
    const starts = times.filter((x, i) => i === 0 || x - (times[i - 1] as number) > ms);
    const delayMs = ((t.delay ?? 0) * 1000) / FPS;
    for (const first of starts) {
      const at = first - delayMs - 1000 / FPS;
      const near = (c: ReplayedCast) => c.operator === kit.operator && c.skillId === skill.skillId && c.start <= first && c.start >= first - ms;
      if ([...casts, ...added].some(near)) continue;
      added.push({ operator: kit.operator, key: skill.skillId, group: skill.skillId, skillId: skill.skillId, kind: skill.kind, start: Math.max(0, at), lastHit: Math.max(0, at), keepPrevious: false, landings: [] });
    }
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/**
 * Casts the log shows only by a trigger's hits that need a buff from them: a kit trigger with hits whose condition reads
 * a buff (`buffActive`, or `operatorBuff` of a game buff) that one cast trigger of the team applies, on its owner's casts
 * of one skill. Each logged landing of the trigger's hits with no cast of that skill replayed within the buff's duration
 * before gets one (only for a skill that can run beside its operator's action), INFERRED_LEAD_FRAMES before the event that fired the trigger (the landing less its frame; the log's
 * milliseconds round to either frame). b6aa15281db4: Last
 * Rite's Mirage at 6141 ms (her perfusion's, on a Final Strike) with no battle skill in the log: cast inside her own
 * basic attack, it plays no timeline. Returns the casts with those added.
 */
/** How many frames before the event that fired a trigger an inferred cast comes (castsFromTriggerHits). */
const INFERRED_LEAD_FRAMES = 3;

export function castsFromTriggerHits(data: GameData, fx: LogFixture, kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  const reads = (p: unknown, out: { kit?: string; game?: string }[] = []): { kit?: string; game?: string }[] => {
    if (Array.isArray(p)) for (const x of p) reads(x, out);
    else if (p && typeof p === "object") {
      for (const [k, v] of Object.entries(p)) {
        if (k === "buffActive" && typeof v === "string") out.push({ kit: v });
        else if (k === "operatorBuff" && typeof v === "string") out.push({ game: v });
        else reads(v, out);
      }
    }
    return out;
  };
  for (const kit of kits) {
    for (const t of kit.triggers) {
      const hits = allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits : []));
      if (!hits.length || !t.if) continue;
      for (const need of reads(t.if)) {
        // The buff and the one cast trigger of the team that applies it.
        const appliers = kits.flatMap((k) => k.triggers.flatMap((x) => allActions(x.do).flatMap((a) => {
          const def = a.kind === "buff" ? k.buffs.find((b) => b.id === a.buff) : undefined;
          const match = def && (need.kit ? k === kit && def.id === need.kit : def.gameBuff === need.game);
          const on = x.on;
          return match && on.event === "cast" && x.by === "self" && on.skills?.length ? [{ k, x, def, skills: on.skills }] : [];
        })));
        const skills = new Set(appliers.flatMap((a) => a.skills));
        if (skills.size !== 1) continue;
        const { k, x, def } = appliers[0] as (typeof appliers)[number];
        const skill = k.skills.find((sk) => sk.skillId === [...skills][0] && !sk.followUpOnly);
        const build = fx.team.find((b) => b.operator === k.operator);
        if (!skill || !build) continue;
        // Only a skill that can run beside its operator's action (KitSkill.beside: switchToBuffConfig, no timeline of its
        // own), the casts a log can lack: elsewhere a trigger landing later than the buff's reading lasts is the reading's
        // limit, not a missed cast (b7b3762d5da8: Tangtang's ultimate; a7a7a40c97ed: Arcane's combo; d9e59d0fb737, whose
        // kit leaves Typhoeus's ultimate key off).
        if (!skill.beside) continue;
        let ms: number;
        try {
          const b = applyBuff(data, build, computeStats(data, build), triggerSkillId(k.operator, x), def, 0);
          if (!b || !Number.isFinite(b.expiresAt)) continue;
          ms = (b.expiresAt * 1000) / FPS;
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e;
          continue;
        }
        for (const h of hits) {
          const frame = Math.min(...(h.frames ?? [0]));
          for (const lh of fx.hits.filter((y) => y.operator === kit.operator && h.events.includes(y.event)).sort((a, b) => a.t - b.t)) {
            const at = Math.max(0, lh.t - ((frame + INFERRED_LEAD_FRAMES) * 1000) / FPS);
            const near = (c: ReplayedCast) => c.operator === k.operator && c.skillId === skill.skillId && c.start <= lh.t && c.start >= lh.t - ms;
            if ([...casts, ...added].some(near)) continue;
            added.push({ operator: k.operator, key: skill.skillId, group: skill.skillId, skillId: skill.skillId, kind: skill.kind, start: at, lastHit: at, keepPrevious: false, landings: [] });
          }
        }
      }
    }
  }
  return added.length ? ordered([...casts, ...added]) : [...casts];
}

/**
 * The logged casts (distinctCasts) as the replay casts them, in time order,
 * each with its logged landings: the timeline lands the cast's hits the log
 * shows at their logged frames (the log's time has other casts' time stops
 * and hit-stop in it), the others at their kit frames.
 */
/**
 * Where the log's Stagger bar is back to full between two logged hits (LogHit.poise), in ms: the first hit after it.
 * The bar doesn't recover on its own (refillPoise), so it's a Stagger's end or the enemy's own recovery (Rhodagn 29.5 s
 * into 4e5e1390085e, cutting a Stagger short 33.2 s into 7e19489ae503; a second life's full bar: 3aa6ab93bad4). The
 * replay refills its bar there, so its Stagger follows the log's.
 */
export function loggedRecoveries(fx: Pick<LogFixture, "hits">): number[] {
  const shown = fx.hits.filter((h): h is LogHit & { poise: NonNullable<LogHit["poise"]> } => h.poise !== undefined).sort((a, b) => a.t - b.t);
  const full = Math.max(0, ...shown.map((h) => h.poise.bar + h.poise.dealt));
  const out: number[] = [];
  for (const [i, h] of shown.entries()) {
    const prev = shown[i - 1];
    const before = h.poise.bar + h.poise.dealt;
    // The first logged one too, when it finds the bar full: hits the replay gave Stagger before it didn't leave any
    // (7b54dc249bcd: Camille's and Si's battle skills at 3 s, the slug's bar full at 11418 ms).
    if ((prev ? h.t > prev.t && before > prev.poise.bar + 1 : true) && before >= full - 0.5 && out.at(-1) !== h.t) out.push(h.t);
  }
  return out;
}

/**
 * The log's Stagger bar before each group of logged hits with Stagger (LogHit.poise: the bar after a hit plus what it
 * dealt; hits less than POISE_ORDER_MS apart are one group, their order in the log not theirs: its highest), in ms. The
 * replay sets its bar to it a frame before, so each hit finds the bar the game had: the enemy's own recovery, which
 * some enemies' AI makes, isn't in the timeline (7b54dc249bcd's Woodcraft Slug: 27 → 42 in 1.9 s, never Staggered in
 * 26 s, where a bar that only falls broke twice), nor Stagger from hits the log doesn't show. A full bar is a
 * recovery (loggedRecoveries), a Stagger's end refills it.
 */
export function loggedPoiseBars(fx: Pick<LogFixture, "hits">): { readonly t: number; readonly bar: number; readonly notStaggered: boolean }[] {
  const shown = fx.hits.filter((h): h is LogHit & { poise: NonNullable<LogHit["poise"]> } => h.poise !== undefined).sort((a, b) => a.t - b.t);
  const out: { t: number; bar: number; notStaggered: boolean }[] = [];
  // Not Staggered: the hit lists no Stagger and leaves the bar above 0 (a Stagger the replay has there isn't the game's).
  const calm = (h: LogHit & { poise: NonNullable<LogHit["poise"]> }) => h.poise.bar > 0 && !h.effects.some((e) => /poise_break/.test(e.buff));
  for (const [i, h] of shown.entries()) {
    const prev = shown[i - 1];
    const before = h.poise.bar + h.poise.dealt;
    const last = out.at(-1);
    if (prev && last && h.t - prev.t < POISE_ORDER_MS) {
      last.bar = Math.max(last.bar, before);
      last.notStaggered = last.notStaggered && calm(h);
    } else out.push({ t: h.t, bar: before, notStaggered: calm(h) });
  }
  return out;
}

/**
 * The log's Stagger state at each logged moment (the hits at one ms), for the replay to follow (accuracy plan B1,
 * 2026-11-17): `through` where the hits list Stagger (buff_common_poise_break_damage_taken_scale), the next moment's
 * time when its hits list it too, else their own: the enemy is Staggered through it; `calm` where none of them lists it:
 * the enemy isn't Staggered, the bar the last logged hit before left (`bar`, null before any). The damage confirms the
 * listing where the replay's own Stagger disagrees: over the development logs, 597 hits the log lists as Staggered and
 * the replay didn't are ×1.30 (median) its reading, 214 the other way ×0.77; and no logged hit falls between a hit that
 * breaks the bar and the first that lists Stagger (77–2676 ms later), so a hit without it after a break means the
 * game's Stagger hadn't begun or was over. A log without Stagger listed anywhere says the enemy never was when it lists
 * buffs and Stagger bars (7b54dc249bcd's slug, which the replay Staggered twice); otherwise it says nothing (empty).
 */
export function loggedStaggerSteps(fx: Pick<LogFixture, "hits">): { readonly t: number; readonly through?: number; readonly calm?: { readonly bar: number | null } }[] {
  const staggered = (h: LogHit) => h.effects.some((e) => STAGGER_LISTING.test(e.buff));
  if (!fx.hits.some(staggered) && !(fx.hits.some((h) => h.poise) && fx.hits.some((h) => h.effects.length > 0))) return [];
  const moments = new Map<number, LogHit[]>();
  for (const h of fx.hits) moments.set(h.t, [...(moments.get(h.t) ?? []), h]);
  const times = [...moments.keys()].sort((a, b) => a - b);
  const out: { t: number; through?: number; calm?: { bar: number | null } }[] = [];
  let bar: number | null = null;
  for (const [i, t] of times.entries()) {
    const hs = moments.get(t) as LogHit[];
    const listed = hs.filter(staggered).length;
    const next = times[i + 1];
    if (listed > 0) {
      const on = next !== undefined && (moments.get(next) as LogHit[]).some(staggered);
      out.push({ t, through: on ? (next as number) : t });
    } else out.push({ t, calm: { bar } });
    // The bar after them: the lowest a hit at this moment left (their order in the log isn't theirs).
    if (hs.some((h) => h.poise)) bar = Math.min(...hs.filter((h) => h.poise).map((h) => (h.poise as NonNullable<LogHit["poise"]>).bar));
  }
  return out;
}

const STAGGER_LISTING = /poise_break/;

/** How far apart two logged hits must be for their bars' order to be theirs (ms; loggedPoiseGains). */
const POISE_ORDER_MS = 50;

/** How far apart two basic casts of one operator may be (ms, the first's last hit to the next's start) to be one run of its attacks. */
const RUN_GAP_MS = 1500;

/**
 * Who the log shows controlled, and the basic casts of the others (`teammate`: teammates attack on their own, slower;
 * the owner, 2026-10-26). Every basic-attack hit with Stagger is controlled-only (a Final Strike's: KitHit
 * poiseControlledOnly), so a logged one with Stagger (LogHit.poise) names the controlled operator then; teammates'
 * Final Strikes deal none (4e5e1390085e: Camille's attack 5 at 14516 ms, Gilberta's attack 4 at 13314 ms, while
 * Rossi's at 8.6, 16.2 and 23.4 s each deal 18). Between two such hits of different operators the swap is at the
 * start of the second one's run of basic casts (RUN_GAP_MS apart) that ends with it. Null when no hit names anyone (the
 * replay then makes each basic cast's operator the controlled one, as before).
 */
export function controlledFromLog(placement: Placement, casts: readonly ReplayedCast[]): { readonly first: string; readonly casts: ReplayedCast[] } | null {
  const c = controlSwaps(placement, casts);
  if (!c) return null;
  const controlledAt = (t: number) => c.swaps.filter((x) => x.at <= t).at(-1)?.operator ?? c.first;
  return { first: c.first, casts: casts.map((x) => (x.kind === "basic" && x.operator !== controlledAt(x.start) ? { ...x, teammate: true as const } : x)) };
}

/**
 * The evidence of controlledFromLog: the first operator the log shows controlled (and the hit that shows it), and each
 * swap (at the start of the new operator's run of basic casts ending with the hit that shows it). Null when no hit
 * names anyone. Also read by `zmdlogs control` (query.ts controlSpans).
 */
export function controlSwaps(placement: Placement, casts: readonly ReplayedCast[]): { readonly first: string; readonly firstEvidence: { readonly t: number; readonly event: string }; readonly swaps: readonly { readonly at: number; readonly operator: string; readonly evidence: { readonly t: number; readonly event: string } }[] } | null {
  const ofCast = (c: LoggedCast) => casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= mergeMs(placement, c.skillId));
  const shown = [...placement.hits]
    .filter(([h, p]) => h.poise !== undefined && p.cast.kind === "basic" && p.hits.some((k) => k.poise !== undefined && k.poiseControlledOnly))
    .flatMap(([h, p]) => {
      const cast = ofCast(p.cast);
      return cast ? [{ t: h.t, operator: h.operator, cast, event: h.event }] : [];
    })
    .sort((a, b) => a.t - b.t);
  const first = shown[0];
  if (!first) return null;
  const swaps: { at: number; operator: string; evidence: { t: number; event: string } }[] = [];
  for (const [i, e] of shown.entries()) {
    const prev = shown[i - 1];
    if (!prev || prev.operator === e.operator) continue;
    const own = casts.filter((c) => c.operator === e.operator && c.kind === "basic" && c.start > prev.t && c.start <= e.cast.start).sort((a, b) => b.start - a.start);
    let start = e.cast;
    for (const c of own) if (c !== start && start.start - c.lastHit <= RUN_GAP_MS) start = c;
    swaps.push({ at: start.start, operator: e.operator, evidence: { t: e.t, event: e.event } });
  }
  return { first: first.operator, firstEvidence: { t: first.t, event: first.event }, swaps };
}

/** What the replay made of one of the log's cast events (loggedCastFates; `zmdlogs replay`'s EVENT lines). */
export interface LoggedCastFate {
  readonly t: number;
  readonly operator: string;
  readonly skill: string;
  /**
   * "placed": a placed cast's own event (`cast`: its start and the world time between, ms); "tick": a tick of a buff
   * (KitBuff.ticksLoggedAs) or "press" / "cast": added as a cast of its own (a slot press when the skill's hits show
   * elsewhere); "follow-up": a follow-up-only skill, left to the engine; "unknown": no kit skill of that id.
   */
  readonly fate: "placed" | "tick" | "press" | "cast" | "follow-up" | "unknown";
  readonly cast?: { readonly start: number; readonly world: number };
  readonly buff?: string;
}

/**
 * Each of the log's cast events with what the replay's cast assembly made of it (withLoggedCasts' choice, the same
 * matcher): a placed cast's own, a buff's tick, a press or cast of its own, or nothing. Round 5: Arcane's INT lasers'
 * events were silently taken as her combo's (2.4 s of world time away), found only with a debug print.
 */
export function loggedCastFates(data: GameData, fx: LogFixture, placement: Placement = placeHits(data, fx)): LoggedCastFate[] {
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  const followUps = new Set(kits.flatMap((k) => k.skills.filter((x) => x.followUpOnly).map((x) => `${k.operator}|${x.skillId}`)));
  const placed = replayedCasts(placement, fx).filter((c) => !followUps.has(`${c.operator}|${c.skillId}`));
  const stops = castTimeStops(data, placement.casts);
  const near = loggedCastMatcher(kits, stops);
  return (fx.casts ?? []).map((lc): LoggedCastFate => {
    const base = { t: lc.t, operator: lc.operator, skill: lc.skill };
    const kit = kits.find((k) => k.operator === lc.operator);
    const skill = kit?.skills.find((x) => x.skillId === lc.skill);
    if (!skill) return { ...base, fate: "unknown" };
    if (skill.followUpOnly) return { ...base, fate: "follow-up" };
    const c = placed.find((x) => near(x, lc, lc.skill));
    if (c) return { ...base, fate: "placed", cast: { start: c.start, world: Math.max(0, worldMs(Math.min(c.start, lc.t), Math.max(c.start, lc.t), stops)) } };
    const tick = kit?.buffs.find((d) => d.ticksLoggedAs === lc.skill);
    if (tick) return { ...base, fate: "tick", buff: tick.id };
    const shownElsewhere = skill.hits.some((h) => h.events.some((e) => fx.hits.some((x) => x.operator === lc.operator && x.event === e)));
    return { ...base, fate: shownElsewhere ? "press" : "cast" };
  });
}

/**
 * The time stops of casts the replay makes (a slot press only when made as a variant, `as`), each with whether the
 * placement has the cast from its hits (`placed`: false for one from its cast event or inferred, such as an ultimate
 * placed at its logged stop's end: db8711232de9's Laevatain at 16.60 s, which castTimeStops of the placed casts lacks).
 */
export function replayedCastStops(data: GameData, casts: readonly ReplayedCast[]): (TimeStop & { readonly placed: boolean })[] {
  return withResets(
    casts.flatMap((c) => {
      if (c.slot && c.as === undefined) return [];
      const skillId = c.as ?? c.skillId;
      const { stops, resets } = skillStops(data, skillId, Math.round((c.start * FPS) / 1000), { operator: c.operator, skillId, kind: c.kind });
      return [{ stops: stops.map((s) => ({ ...s, placed: c.landings.length > 0 })), resets }];
    }),
  );
}

/**
 * The casts the replay makes, before control and the casts that hit nothing: the placed casts (not follow-up-only
 * skills), the log's hitless cast events it lacks (withLoggedCasts), and the casts inferred from buff lanes, trigger
 * hits, buff ends and exits (castsFromBuffLanes, castsFromTriggerHits, castsFromBuffEnds, exitPresses), and the presses
 * that pull a buff (pullingPresses).
 */
export function assembleCasts(data: GameData, fx: LogFixture, placement: Placement, kits: readonly OperatorKit[]): ReplayedCast[] {
  if (kits.length === 0) return [];
  const followUps = new Set(kits.flatMap((k) => k.skills.filter((s) => s.followUpOnly).map((s) => `${k.operator}|${s.skillId}`)));
  return castsBeforeLog(kits, fx, placement, exitPresses(kits, fx, pullingPresses(kits, placement, castsFromBuffEnds(kits, placement, castsFromTriggerHits(data, fx, kits, castsFromBuffLanes(data, fx, kits, withLoggedCasts(replayedCasts(placement, fx).filter((c) => !followUps.has(`${c.operator}|${c.skillId}`)), fx, kits, data, castTimeStops(data, placement.casts))))))));
}

/**
 * Casts made before the log began: a buff a cast opens (a trigger on the cast's skill, `delay` frames on, with a `buff`
 * action) whose ticks the log shows by their hits (KitBuff.ticksShownByHits), its first shown tick before any cast of
 * that skill with landings could have opened it. The skill was cast before the log: at the earliest listing of a game
 * buff its hits apply (its `since`, less that hit's frame) when the log lists one from before its start, else at the
 * first shown tick less the trigger's delay (and an interval more without KitBuff.tickOnApply); no later than its last
 * hit's frame before the log (the log has none of them). Not where a cast of the skill (its hits placed, or a logged
 * cast event that isn't the tick's own, at its first hit's ms) could have opened it (c6d80590f5ea: Liino's battle skill
 * logged at 2020 ms, its stance ATK listed from 2497 ms, its projectiles hitting nothing). Liino's Vocalist Stance: 4d60e7fe92c2 lists her stance ATK
 * since -811 ms and its first volley lands at 1354 ms, 791020039384 since -576 ms (1898 ms), 1d9198480e75 lists none
 * of her buffs (1990 ms); the replay made the stance at the volley's cast event instead (the volley's own: an event at
 * its first hit's ms), so its first volley landed nowhere and the stance's projectiles and volley came as its own.
 */
export function castsBeforeLog(kits: readonly OperatorKit[], fx: Pick<LogFixture, "hits">, placement: Placement, casts: readonly ReplayedCast[]): ReplayedCast[] {
  const added: ReplayedCast[] = [];
  for (const kit of kits) {
    for (const def of kit.buffs) {
      if (!def.ticksShownByHits || def.every === undefined) continue;
      const opener = kit.triggers.find((t) => t.on.event === "cast" && t.by === "self" && t.on.skills?.length === 1 && allActions(t.do).some((a) => a.kind === "buff" && a.buff === def.id));
      const ticks = kit.triggers.filter((t) => t.on.event === "buffTick" && "buff" in t.on && t.on.buff === def.id).map((t) => `trigger:${t.id}`);
      const skillId = opener && "skills" in opener.on ? opener.on.skills?.[0] : undefined;
      const skill = kit.skills.find((x) => x.skillId === skillId);
      if (!opener || !skill || ticks.length === 0) continue;
      // Its hits' buffs listed from before the log (`since` < 0): the earliest, less the hit's frame.
      const fromListing = skill.hits.flatMap((h) => (h.buffs ?? []).flatMap((b) => {
        const d = kit.buffs.find((x) => x.id === b.buff);
        const names = new Set(d ? loggedNames(d) : []);
        const frame = Math.min(...(loggedFrames(h) ?? [0]));
        return fx.hits.flatMap((x) => x.effects.flatMap((e) => (names.has(e.buff) && e.since !== undefined && e.since < 0 ? [e.since - (frame * 1000) / FPS] : [])));
      }));
      const lastHit = Math.max(0, ...skill.hits.flatMap((h) => loggedFrames(h) ?? []));
      const before = -((lastHit + 1) * 1000) / FPS;
      let start: number;
      if (fromListing.length) {
        // Not when a cast with hits in the log made it (9090afbacec9: Liino's projectiles at 275 ms, her stance ATK listed
        // since -185 ms).
        start = Math.min(...fromListing, before);
        if (casts.some((c) => c.operator === kit.operator && c.skillId === skill.skillId && c.landings.length > 0 && c.start <= start + LOGGED_CAST_MS)) continue;
      } else {
        const first = placement.casts.filter((c) => c.operator === kit.operator && ticks.includes(c.group)).sort((x, y) => x.start - y.start)[0];
        if (first === undefined || (!def.tickOnApply && typeof def.every !== "number")) continue;
        const shown = first.start;
        // The tick's own landing: a cast event at its first logged hit's ms is the tick's (Liino's volley), not a cast.
        const landsAt = Math.min(...[...placement.hits].filter(([, p]) => p.cast === first).map(([h]) => h.t));
        const delayMs = ((opener.delay ?? 0) * 1000) / FPS;
        // Any cast of the skill that could have opened it (a logged event or placed hits) up to its first shown tick.
        if (casts.some((c) => c.operator === kit.operator && c.skillId === skill.skillId && c.start <= shown - delayMs + LOGGED_CAST_MS && Math.abs(c.start - landsAt) > 1000 / FPS)) continue;
        start = Math.min(shown - delayMs - (def.tickOnApply ? 0 : (def.every as number) * 1000), before);
      }
      added.push({ operator: kit.operator, key: skill.skillId, group: skill.skillId, skillId: skill.skillId, kind: skill.kind, start: Math.round(start), lastHit: Math.round(start), keepPrevious: false, landings: [], beforeLog: true });
    }
  }
  return added.length ? [...added, ...casts] : [...casts];
}

/**
 * The state at the log's start with a cast made before it (ReplayedCast.beforeLog): the cast made at frame 0 of a
 * timeline of its own and run as long as it ran before the log, then what it left of its operator's moved back that
 * much onto `st` (the buffs it made, what it still has to do, its action and cooldowns, its operator's stacks). Its hits
 * until then, the enemy, SP and energy stay `st`'s: the log shows none of them. So are the hits it launched before the
 * log and still on their way: the fight hadn't begun (a7a7a40c97ed: Liino's stance from about -2.2 s, its volley timer
 * from -0.7 s; the volley that tick launched, due at 0.1–0.4 s, isn't in the log, which has its first at 12.58 s, the
 * timer's next tick; a volley launches only while the squad is in a fight).
 */
function withCastBeforeLog(ctx: TimelineContext, st: TimelineState, c: ReplayedCast): TimelineState {
  const n = -frameOf(c.start);
  if (n <= 0) return st;
  const ran = advance(ctx, replayCast(ctx, st, c.operator, c.skillId, 0, {}), n);
  const back = (f: number) => f - n;
  const buffs = ran.buffs.map((b) => (st.buffs.includes(b) ? b : {
    ...b,
    appliedAt: back(b.appliedAt),
    expiresAt: back(b.expiresAt),
    ...(b.nextTick !== undefined ? { nextTick: back(b.nextTick) } : {}),
    ...(b.whileCasting ? { whileCasting: { ...b.whileCasting, until: back(b.whileCasting.until) } } : {}),
  }));
  const scheduled = [...st.scheduled, ...ran.scheduled.filter((x) => !st.scheduled.includes(x) && x.kind !== "hit").map((x) => ({ ...x, frame: back(x.frame), ...(x.launchAt !== undefined ? { launchAt: back(x.launchAt) } : {}) }))];
  const acting = ran.acting[c.operator];
  const moved = (a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, a[k] === v ? v : back(v)]));
  return {
    ...st,
    buffs,
    scheduled,
    casts: [...st.casts, ...ran.casts.slice(st.casts.length).map((x) => ({ ...x, frame: back(x.frame) }))],
    ...(acting ? { acting: { ...st.acting, [c.operator]: { ...acting, frame: back(acting.frame), ...(acting.skips ? { skips: acting.skips.map((k) => ({ ...k, at: back(k.at) })) } : {}) } } } : {}),
    readyAt: moved(st.readyAt, ran.readyAt),
    triggerState: Object.fromEntries(Object.entries(ran.triggerState).map(([k, v]) => [k, st.triggerState[k] === v ? v : { ...v, readyAt: back(v.readyAt) }])),
    stacks: { ...st.stacks, ...(ran.stacks[c.operator] ? { [c.operator]: ran.stacks[c.operator] as Readonly<Record<string, number>> } : {}) },
  };
}

/** How close (ms) to a cast's batched landings' ms (LoggedCast.beforeStop) a logged hit of it is one of them. */
const BATCHED_MS = 50;

/**
 * Where a logged hit landed when the log batched it with an operator's cast's landings at another cast's stop's end
 * (LoggedCast.beforeStop): at that cast's first landing (what the hit set off, its reaction or a trigger's hit, landed
 * with it), else null.
 */
function batchedFrame(casts: readonly ReplayedCast[], h: Pick<LogHit, "t" | "operator">): number | null {
  const c = casts.find((x) => x.operator === h.operator && x.beforeStop !== undefined && Math.abs(h.t - x.beforeStop) <= BATCHED_MS && x.landings.length > 0);
  return c ? Math.min(...c.landings.map((l) => l.frame)) : null;
}

export function replayedCasts(placement: Placement, fx?: Pick<LogFixture, "hits">): ReplayedCast[] {
  const casts = distinctCasts(placement);
  // A landing's reference: its logged hit's index in the fixture (replayCast `ref`: its LandedHit carries it).
  const hitIndex = new Map((fx?.hits ?? [...placement.hits.keys()]).map((h, i) => [h, i]));
  // Its own cast, else the one it merged into (distinctCasts: the same skill placed from another key, within mergeMs).
  const ofCast = (c: LoggedCast): LoggedCast | undefined => (casts.includes(c) ? c : casts.find((d) => d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= mergeMs(placement, c.skillId)));
  const last = new Map<LoggedCast, number>();
  const landings = new Map<LoggedCast, { hitId: string; nth: number; frame: number; ref: string; ms: number }[]>();
  const used = new Map<string, Set<number>>();
  for (const [h, p] of [...placement.hits].sort((a, b) => a[0].t - b[0].t)) {
    const d = ofCast(p.cast);
    if (!d) continue;
    // A delayed hit's damage (KitHit.enemyDelay) lands whatever comes after its cast: it doesn't show the cast going on.
    if (!p.hits.every((k) => k.enemyDelay !== undefined)) last.set(d, Math.max(last.get(d) ?? -Infinity, h.t));
    if (p.frame === undefined || p.cast.skillId !== d.skillId) continue;
    for (const k of p.hits) {
      const frames = loggedFrames(k) ?? [];
      // The n-th landing of the kit hit at the slot's frame not taken yet (several landings may share a frame).
      const key = `${d.operator}|${d.start}|${k.id}`;
      const taken = used.get(key) ?? new Set<number>();
      const nth = frames.findIndex((f, i) => f === p.frame && !taken.has(i));
      if (nth < 0) continue;
      taken.add(nth);
      used.set(key, taken);
      // Batched at another cast's stop's end, it landed at its kit frame before the stop (LoggedCast.beforeStop).
      const at = d.beforeStop !== undefined && Math.abs(h.t - d.beforeStop) <= BATCHED_MS ? frameOf(d.start) + p.frame : frameOf(h.t);
      landings.set(d, [...(landings.get(d) ?? []), { hitId: k.id, nth, frame: at, ref: String(hitIndex.get(h)), ms: h.t }]);
    }
  }
  const out: ReplayedCast[] = [];
  const previous = new Map<string, ReplayedCast>();
  for (const c of casts) {
    const prev = previous.get(c.operator);
    const r: ReplayedCast = { ...c, lastHit: last.get(c) ?? c.start, keepPrevious: prev !== undefined && prev.lastHit > c.start, landings: landings.get(c) ?? [] };
    previous.set(c.operator, r);
    out.push(r);
  }
  return out;
}

/** One replayed instance of a kit buff reaching an operator, in frames; `expired`: it ran out (not ended or replaced early). */
interface Instance {
  readonly start: number;
  readonly end: number;
  readonly expired: boolean;
}

/** A change in a buff's replayed instances at an operator: when, by how many, and how sure (± frames). */
interface Change {
  readonly frame: number;
  readonly delta: number;
  readonly slack: number;
}

/**
 * Replays a logged fight's casts through the timeline (see the file
 * comment). Casts of skills only their own skill casts (KitSkill.followUpOnly)
 * are left to the engine; crits are never rolled (crit-triggered buffs are
 * left to the log: `undecided`). The state is read at every logged hit and
 * REPLAY_EDGE_MS either side of it.
 */
/**
 * The skill the replay casts for a logged cast, or null to skip it. A basic attack: its placed skill when it can start at
 * its frame, else the step the operator's chain points to (TimelineState.chainNext and its alternatives), or any basic
 * attack of the operator, that has the cast's key and can (Typhoeus's hover attacks 1–4 log one key, and which comes
 * next is her kit's state: the placement takes the first, the engine knows the step). A slot cast (ReplayedCast.slot):
 * skipped when its skill can start, else the operator's skill of its kind that can (Si's Initial or Final Stroke for a
 * logged battle skill under Artful Intent; accuracy plan A2), else skipped.
 */
/** How soon before a logged cast its operator's own follow-up cast of a skill with the cast's key is that cast (frames). */
const FOLLOW_UP_FRAMES = 10;

/**
 * The state without the follow-up casts its operators' timelines would make (a trigger's delayed `cast`) up to `until`
 * where a logged cast of the same operator, of a skill with its key, comes within FOLLOW_UP_FRAMES after: the logged cast
 * is that follow-up, a little later (dbaee23b801d: Typhoeus's off-field shot chain at its kit's 22 frames, the log's
 * next shot 2 frames on: the replay made both).
 */
function withoutFollowUps(ctx: TimelineContext, st: TimelineState, casts: readonly ReplayedCast[], until: number): TimelineState {
  const castsKey = (owner: string, trigger: string, key: string) => {
    const kit = ctx.kits.get(owner);
    const hasKey = (skill: string) => (kit?.skills.find((k) => k.skillId === skill)?.hits ?? []).some((h) => h.events.includes(key));
    return (kit?.triggers ?? []).some((t) => t.id === trigger && allActions(t.do).some((a) => a.kind === "cast" && hasKey(a.skill)));
  };
  const replaced = (x: TimelineState["scheduled"][number]) =>
    x.kind === "action" && x.frame <= until &&
    casts.some((c) => !c.slot && c.landings.length > 0 && c.operator === x.owner && frameOf(c.start) >= x.frame && frameOf(c.start) < x.frame + FOLLOW_UP_FRAMES && castsKey(x.owner, x.trigger, c.key));
  return st.scheduled.some(replaced) ? { ...st, scheduled: st.scheduled.filter((x) => !replaced(x)) } : st;
}

/**
 * A logged cast event that is a tick of one of its operator's buffs (KitBuff.ticksLoggedAs) on at `f`, as the state
 * after it, or null when it's a press. Liino's battle-skill events during her Vocalist Stance are its beats (the owner,
 * who plays her; the stance's music_trigger is 3 s, and of the events of one stance only the first has projectiles
 * behind it): no cast, no SP. The tick is the log's (bdf223db8e49 lists one more layer of her weapon's heal ATK on
 * Typhoeus after each event, none between): one the replay has due within half an interval comes at the event (one
 * due earlier waited for it: heldTicks), and the next an interval after it (the replay's own ticks drift from the
 * game's: 1d9198480e75's ran 1.5 s early by 27 s).
 */
function loggedTick(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number): TimelineState | null {
  if (c.landings.length > 0) return null;
  const ids = new Set((ctx.kits.get(c.operator)?.buffs ?? []).filter((d) => d.ticksLoggedAs === c.skillId).map((d) => d.id));
  const b = ids.size ? st.buffs.find((x) => ids.has(x.id) && x.owner === c.operator && x.cast === undefined && x.every !== undefined && activeAt(x, f)) : undefined;
  if (!b || b.every === undefined) return null;
  const every = b.every;
  const due = b.nextTick !== undefined && b.nextTick - f <= every / 2;
  const defs = ctx.kits.get(c.operator)?.buffs ?? [];
  const follows = defs.some((d) => d.id === b.id && d.endFollowsTick);
  const moved = movedTick(b, due ? f : f + every, follows && due);
  const next = { ...st, buffs: withChildren(st.buffs, b, moved, childrenOf(defs, b.id)) };
  return due ? advance(ctx, next, f) : next;
}

/** The ids of a kit's buffs that are children of `parent` (KitBuff.childOf). */
function childrenOf(defs: readonly KitBuff[], parent: string): Set<string> {
  return new Set(defs.filter((d) => d.childOf === parent).map((d) => d.id));
}

/** The buffs with `b` replaced by `moved`, and the instances of its children (`children`) that ended with it moved to its new end. */
function withChildren(buffs: readonly ActiveBuff[], b: ActiveBuff, moved: ActiveBuff, children: ReadonlySet<string>): ActiveBuff[] {
  return buffs.map((x) => (x === b ? moved : children.has(x.id) && x.owner === b.owner && x.cast === undefined && x.expiresAt === b.expiresAt ? { ...x, expiresAt: moved.expiresAt } : x));
}

/**
 * A buff with its next tick at `to`; with `endFollows` (KitBuff.endFollowsTick: one game timer gives both, Arcane's
 * Imprisonment) its end moves as far as a due tick does (not past a tick it has already had).
 */
function movedTick(b: ActiveBuff, to: number, endFollows: boolean): ActiveBuff {
  const from = b.nextTick;
  if (!endFollows || from === undefined || from > b.expiresAt || !Number.isFinite(b.expiresAt)) return { ...b, nextTick: to };
  return { ...b, nextTick: to, expiresAt: b.expiresAt + (to - from) };
}

/** The frames of the logged cast events that may be ticks of a buff (KitBuff.ticksLoggedAs), per `owner|buff`. */
function loggedTickFrames(kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const k of kits) for (const d of k.buffs) {
    if (d.ticksLoggedAs === undefined) continue;
    const frames = casts.filter((c) => c.operator === k.operator && c.skillId === d.ticksLoggedAs && c.landings.length === 0).map((c) => frameOf(c.start));
    if (frames.length) out.set(`${k.operator}|${d.id}`, frames);
  }
  return out;
}

/**
 * The frames at which a buff's ticks fired a trigger's hits the log shows, per `owner|buff` (buffs with
 * KitBuff.ticksShownByHits): each placed cast of a trigger on the buff's ticks (`buffTick`), its start (its first logged
 * landing less the landing's frame). Liino's volleys: her
 * volley timer ticks every 10 s of her stance's clock, which runs slower than the replay's world time (1.0–11.7 s logged
 * between volleys without a time stop; 9090afbacec9's 10.1–11.2 s with the stops taken out), so the replay's ticks drift
 * a second or more early by the second volley.
 */
function loggedTickLandings(kits: readonly OperatorKit[], placement: Placement): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const k of kits) for (const t of k.triggers) {
    if (t.on.event !== "buffTick" || !("buff" in t.on)) continue;
    const buff = t.on.buff;
    if (!k.buffs.some((d) => d.id === buff && d.ticksShownByHits)) continue;
    const key = `${k.operator}|${buff}`;
    const frames = placement.casts.filter((c) => c.operator === k.operator && c.group === `trigger:${t.id}`).map((c) => frameOf(c.start));
    if (frames.length) out.set(key, [...(out.get(key) ?? []), ...frames].sort((a, b) => a - b));
  }
  return out;
}

/** The logged moments of buffs' ticks: cast events (loggedTickFrames) and the starts of landings ticks fired (loggedTickLandings). */
interface TickEvents {
  readonly events: ReadonlyMap<string, readonly number[]>;
  readonly landings: ReadonlyMap<string, readonly number[]>;
  /** The `owner|buff` keys whose end follows their tick (KitBuff.endFollowsTick), each with its children's ids (KitBuff.childOf). */
  readonly endFollows?: ReadonlyMap<string, ReadonlySet<string>>;
}

/** The `owner|buff` keys of the buffs whose end follows their tick (KitBuff.endFollowsTick), with their children's ids. */
function endFollowsTick(kits: readonly OperatorKit[]): Map<string, Set<string>> {
  return new Map(kits.flatMap((k) => k.buffs.filter((d) => d.endFollowsTick).map((d) => [`${k.operator}|${d.id}`, childrenOf(k.buffs, d.id)] as const)));
}

/**
 * A tick the replay has due waits for a logged event of it up to half an interval later, and at least this many frames:
 * the replay's holds across time stops differ from the game's by up to ~0.7 s (btl_upload_a7a7a40c97ed: Arcane's INT
 * lasers at 48.89 s, 0.69 s after the replay's due tick, across Liino's and Si's ultimates; their interval is 41 frames).
 */
const TICK_HOLD_FRAMES = 30;

/**
 * The state with each tick due by `frame` that comes less than half an interval (TICK_HOLD_FRAMES at least) before a logged event of it (loggedTickFrames) held to that event (loggedTick).
 * With `landings` (loggedTickLandings): also a tick due less than half an interval after a logged landing's start between
 * the state's frame and `frame` brought to it (no later than the state's frame), as loggedTick does at a cast event. A
 * buff whose ticks its hits show has its end on the same clock: it moves with the tick (Liino's Cosmovoice song, 10 beats
 * on a clock of their own: 4d60e7fe92c2's second Cosmovoice, its beats 1.36 s apart, ran on to two replay-only beats
 * past its ninth logged one).
 */
function heldTicks(st: TimelineState, frame: number, ticks: TickEvents): TimelineState {
  const { events, landings } = ticks;
  if (events.size === 0 && landings.size === 0) return st;
  let changed = false;
  const moves: { b: ActiveBuff; moved: ActiveBuff; children: ReadonlySet<string> }[] = [];
  const buffs0 = st.buffs.map((b) => {
    const key = `${b.owner}|${b.id}`;
    const [n, every] = [b.nextTick, b.every];
    if (n === undefined || every === undefined || b.cast !== undefined) return b;
    const shown = landings.get(key);
    const early = shown?.find((x) => x <= frame && x >= st.frame && x < n && n - x <= every / 2);
    const children = ticks.endFollows?.get(key);
    const move = (to: number) => {
      changed = true;
      const moved = movedTick(b, to, children !== undefined || shown !== undefined);
      if (children?.size) moves.push({ b, moved, children });
      return moved;
    };
    if (early !== undefined) return move(Math.max(early, st.frame));
    // The longer hold (TICK_HOLD_FRAMES) is for ticks logged as cast events (ticksLoggedAs); a tick its hits show
    // (ticksShownByHits) waits at most half an interval, or a short-interval buff's tick takes the next one's hit
    // (Rossi's bleed in 489c0be3e162).
    const held = (events.get(key) ?? []).filter((x) => x - n <= Math.max(every / 2, TICK_HOLD_FRAMES));
    const frames = [...held, ...(shown ?? []).filter((x) => x - n <= every / 2)];
    if (!frames.length || n > frame) return b;
    const e = frames.filter((x) => x > n).sort((x, y) => x - y)[0];
    if (e === undefined) return b;
    return move(e);
  });
  if (!changed) return st;
  let buffs = buffs0;
  for (const { b, moved, children } of moves) buffs = withChildren(buffs.map((x) => (x === moved ? b : x)), b, moved, children);
  return { ...st, buffs };
}

/** One run of a listed game buff (one source, start and holder): its last listed hit (loggedLaneEnds), ms. */
export interface LoggedLaneEnd {
  readonly buff: string;
  readonly source: string;
  readonly since: number;
  /** The operator whose hits list it, or "enemy" for a debuff (an enemy-side zone: TARGET_SIDE_ZONES). */
  readonly holder: string;
  readonly lastListed: number;
  /**
   * Another run of it (same source and holder) starts inside this one and this one isn't listed past it (by more than
   * REFRESH_OVERLAP_MS): the log shows a refresh. Runs listed side by side are two instances (a stackingType 1 buff:
   * 4360447193ac, Perlica's Arts DMG Taken from 92.24 s listed with the one from 104.92 s to 108.27 s).
   */
  readonly refreshed: boolean;
}

/**
 * Where the log's listing of each buff ends (hidden-holds `log`): every run of every listed game buff, by `buff|source`,
 * and the logged hits in time order with what each lists (`buff|source`), on its hitter or on the enemy.
 */
export interface LoggedLaneEnds {
  readonly runs: ReadonlyMap<string, readonly LoggedLaneEnd[]>;
  readonly hits: readonly { readonly t: number; readonly operator: string; readonly listed: ReadonlySet<string> }[];
  /** Each instance's end by the log once decided (loggedEndOf; null: the log doesn't decide it), by `owner|id|appliedAt`. */
  readonly decided: Map<string, { readonly end: number } | null>;
}

/** The log's runs of its listed buffs and what each hit lists (LoggedLaneEnds), nothing decided yet. */
export function loggedLaneEnds(fx: Pick<LogFixture, "hits">): LoggedLaneEnds {
  const runs = new Map<string, { buff: string; source: string; since: number; holder: string; lastListed: number }>();
  const hits = [...fx.hits].sort((a, b) => a.t - b.t).map((h) => ({ t: h.t, operator: h.operator, listed: new Set([...h.effects, ...h.boundaryEffects].flatMap((e) => (e.source === undefined ? [] : [`${e.buff}|${e.source}`]))) }));
  for (const h of fx.hits) {
    // A boundary effect at the lane's start says nothing of its end; one at its end is the end itself.
    for (const e of [...h.effects, ...h.boundaryEffects.filter((x) => x.since !== h.t)]) {
      if (e.since === undefined || e.source === undefined) continue;
      const holder = TARGET_SIDE_ZONES.has(e.zone) ? "enemy" : h.operator;
      const key = `${e.buff}|${e.source}|${e.since}|${holder}`;
      const run = runs.get(key);
      if (!run) runs.set(key, { buff: e.buff, source: e.source, since: e.since, holder, lastListed: h.t });
      else if (h.t > run.lastListed) runs.set(key, { ...run, lastListed: h.t });
    }
  }
  const all = [...runs.values()];
  const out = new Map<string, LoggedLaneEnd[]>();
  for (const r of all) {
    const refreshed = refreshedIn(r, all, (a, b) => a.buff === b.buff && a.source === b.source && a.holder === b.holder);
    const key = `${r.buff}|${r.source}`;
    out.set(key, [...(out.get(key) ?? []), { ...r, refreshed }]);
  }
  return { runs: out, hits, decided: new Map() };
}

/**
 * How much of a buff's own life (frames from its application to its expiry) the hidden holds may add (hidden-holds
 * `log`). An interim bound from the development logs (scratch measurement, 2026-11-22, docs/open-problems.md "The buff
 * clock"): Si's 12 s Amp runs at most 3.8 s past its world time (489c), Forgeborn's 20 s at most 7.8 s (9c0b, ten seconds
 * with no hit); a run longer than this is a refresh the replay missed or a kit's error, which the check should show.
 */
export const HIDDEN_HOLD_SHARE = 0.4;

/** Ms of a frame. */
function msOfFrame(f: number): number {
  return (f * 1000) / FPS;
}

/**
 * The enemy's status instances in a replay (holds.ts StatusInstance), from its status events (an application starts
 * one and replaces the one before; statusConsumed ends one early) and its states after each step (the instance's last
 * expiry there, which the stops moved).
 */
function statusInstances(checkpoints: readonly TimelineState[], reactions: readonly ReactionRecord[], brokenAt: number | null): StatusInstance[] {
  const applied = reactions.flatMap((r) => (r.kind === "reaction" || (r.kind === "physical" && r.status === "breach") ? [{ status: r.status as string, operator: r.operator, frame: r.frame }] : []));
  const out: StatusInstance[] = [];
  for (const [i, a] of applied.entries()) {
    const next = applied.slice(i + 1).find((b) => b.status === a.status)?.frame ?? Infinity;
    const consumed = reactions.some((r) => r.kind === "statusConsumed" && r.status === a.status && r.frame >= a.frame && r.frame < next);
    let last: number | null = null;
    for (const cp of checkpoints) {
      if (cp.frame < a.frame || cp.frame >= next) continue;
      const on = [...cp.enemy.statuses, ...cp.enemy.physical].find((x) => x.status === a.status && x.operator === a.operator);
      if (on) last = on.expiresAt;
    }
    if (last === null) continue;
    const expired = !consumed && last <= next && (brokenAt === null || last < brokenAt) && Number.isFinite(last);
    out.push({ status: a.status, operator: a.operator, start: a.frame, end: Math.min(last, next), expired });
  }
  return out;
}

/** The enemy statuses some kit of the team consumes (a `consumeStatus` application: every status where it names none). */
function consumedStatuses(kits: readonly OperatorKit[]): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) for (const y of x) walk(y);
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (o.kind === "consumeStatus") for (const s of (o.statuses as string[] | undefined) ?? ["electrification", "corrosion", "solidification", "combustion"]) out.add(s);
      for (const v of Object.values(o)) walk(v);
    }
  };
  walk(kits);
  return out;
}

/**
 * The bounds the replay's buffs give the hidden holds (holds.ts; hidden-holds `placed`): each instance that ran out in
 * the replay without them (a timed kit buff with one game buff run per instance, as loggedEndOf takes them), against
 * the log's run of it from its application (±RUN_START_MS, not refreshed) on the same holder: its last listed hit (the
 * holds from its application to there at least its lateness over the replay's expiry, in world time: the placed stops
 * after the expiry hold it too once it lasts) and the next hit of the holder without it (at most). Not a run that ends more than 0.4 s before the replay's expiry (a refresh or cut the replay
 * doesn't make: not a clock) or past HIDDEN_HOLD_SHARE of its life.
 */
function runBounds(kitInstances: ReadonlyMap<string, readonly { start: number; end: number; expired: boolean }[]>, defs: ReadonlyMap<string, KitBuff>, ends: LoggedLaneEnds, stops: readonly TimeStop[], why?: ClockWhy[]): HoldBound[] {
  const out: HoldBound[] = [];
  const seen = new Set<string>();
  const sec = (ms: number) => (ms / 1000).toFixed(2);
  for (const [key, list] of kitInstances) {
    const [kitKey, op] = key.split("|") as [string, string];
    const def = defs.get(kitKey);
    if (!def) continue;
    const owner = kitKey.slice(0, kitKey.indexOf(":"));
    const holder = def.target === "enemy" ? "enemy" : op;
    // `zmdlogs holds --why`: each instance with the rule that made it a clock or not (ClockWhy); the bounds as before.
    const note = (x: Omit<ClockWhy, "clock" | "holder">) => why?.push({ clock: kitKey, holder, ...x });
    const skip = notAClock(def, { every: true });
    if (skip) {
      note({ instance: null, verdict: `not a clock: the kit buff has \`${skip}\` (its end isn't its own timer's, or the log merges its instances)` });
      continue;
    }
    for (const w of list) {
      const instance = { start: w.start, end: w.end, expired: w.expired };
      if (!w.expired || !Number.isFinite(w.end)) {
        note({ instance, verdict: "didn't run out in the replay (a step ended or replaced it, or it was on at the end)" });
        continue;
      }
      const [S, E] = [msOfFrame(w.start), msOfFrame(w.end)];
      for (const g of loggedNames(def)) {
        const k = `${g}|${owner}`;
        let near = 0;
        for (const r of ends.runs.get(k) ?? []) {
          if (r.holder !== holder || r.since < S - RUN_START_MS || r.since > S + RUN_START_MS) continue;
          near++;
          const run = { name: g, since: r.since, lastListed: r.lastListed };
          const v = (verdict: string, ask?: number) => note({ instance, run, verdict, ...(ask !== undefined ? { ask } : {}) });
          if (r.refreshed) {
            v("refreshed in the log (another run starts inside it and it isn't listed past that: holds.ts refreshedIn)");
            continue;
          }
          // Instances (KitBuff.instances): a reapplication may refresh the log's run without a new start (Arcane's
          // will_dmg in 489c: runs from 12.0 and 14.6 s both listed to 49.4 s, over the replay's 25 s instances), so only
          // a run the log shows apart from the reapplications inside it (runApart), and only the run that starts nearest the
          // instance (489c: the run from 14.63 s isn't the 12.03 s instance's).
          if (def.instances !== undefined && !runApart(list, w, r, ends.runs.get(k) ?? [])) {
            v("an instance buff's run the log doesn't show apart from the reapplications inside it (runApart)");
            continue;
          }
          if (def.instances !== undefined && !nearestRun(r, S, ends.runs.get(k) ?? [])) {
            v("another run on its holder starts nearer the application (nearestRun)");
            continue;
          }
          const id = `${k}|${r.since}|${holder}|${w.start}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const off = ends.hits.find((h) => h.t > r.lastListed && (holder === "enemy" || h.operator === holder) && !h.listed.has(k));
          // Past its expiry, the placed stops then hold it too (a stop after E didn't hold the instance that ended at E).
          const late = (t: number) => (t >= E ? worldMs(E, t, stops) : t - E);
          const [lo, hi] = [late(r.lastListed), off === undefined ? Infinity : late(off.t)];
          if (hi < -2 * HOLD_BOUND_TOL_MS) {
            v(`ends ${sec(-hi)} s before the replay's expiry (a refresh or cut the replay doesn't make: not a clock)`);
            continue;
          }
          if (lo > HIDDEN_HOLD_SHARE * (E - S)) {
            v(`asks ${sec(lo)} s, over HIDDEN_HOLD_SHARE (${HIDDEN_HOLD_SHARE}) of its life (a refresh the replay missed, or a kit's error)`, lo / 1000);
            continue;
          }
          // An instance buff's run later than INSTANCE_LATE_MS: a refresh in place is likelier than holds.
          if (def.instances !== undefined && lo > INSTANCE_LATE_MS) {
            v(`an instance buff's run ${sec(lo)} s late, over INSTANCE_LATE_MS (a refresh in place is likelier than holds)`, lo / 1000);
            continue;
          }
          const tag = `run ${g}|${owner} on ${holder} ${Math.round(S)}→${r.lastListed}${off ? `–${off.t}` : "–end"} ms over ${Math.round(E)}`;
          if (lo > -HOLD_BOUND_TOL_MS) out.push({ a: Math.round(S), b: r.lastListed, min: lo - HOLD_BOUND_TOL_MS, max: Infinity, kind: "run", tag, ex: lo / 1000 });
          if (off) out.push({ a: Math.round(S), b: off.t, min: -Infinity, max: hi + HOLD_BOUND_TOL_MS, kind: "run", tag, ex: hi / 1000 });
          v(lo > -HOLD_BOUND_TOL_MS || off ? `bound: ${tag}` : "no bound (listed only before its expiry, and no later hit of its holder without it)", lo / 1000);
        }
        if (near === 0) {
          const runs = (ends.runs.get(k) ?? []).filter((r) => r.holder === holder);
          const nearest = runs.length ? Math.min(...runs.map((r) => Math.abs(r.since - S))) : null;
          note({ instance, verdict: nearest === null ? `the log lists no run of ${g} from its owner on ${holder}` : `no run of ${g} on ${holder} starts within ${RUN_START_MS / 1000} s of the application (the nearest ${sec(nearest)} s away)` });
        }
      }
    }
  }
  return out;
}

/** How far apart (ms) the ends of two overlapping runs must be to show them as two instances (runApart). */
const APART_MS = 1000;

/**
 * How late (ms, world time past the replay's expiry) an instance buff's run may be and still be a clock: about two
 * perfect dodges. Arcane's will_dmg / will_atk runs, refreshed in place with their start kept, ask 2–8 s (b6aa15281db4
 * from 2.1 s, 4d60e7fe92c2 from 10.8 s: 7.7 s); Perlica's Arts DMG Taken in 4360447193ac 0.74 s. An interim bound.
 */
const INSTANCE_LATE_MS = 1000;

/**
 * Whether the log shows a run `r` of an instance buff as an instance of its own: each of the replay's applications
 * (`list`) after `w` and inside the run has a run of its own in the log, some run overlaps `r` (a lone run may be one
 * the game refreshed in place: b6aa15281db4, Arcane's will_atk from 2.1 s listed to 31.8 s), and every run overlapping it ends at
 * least APART_MS from it (two runs ending together: a reapplication that refreshed both; 9c0bb09daff2, Arcane's will_dmg
 * from 31.5 and 34.3 s both listed to 70.2 s). 4360447193ac: Perlica's Arts DMG Taken from 92.24 s ends at 108.27 s
 * beside the one from 104.92 s, listed to 119.2 s.
 */
function runApart(list: readonly { start: number }[], w: { start: number }, r: LoggedLaneEnd, runs: readonly LoggedLaneEnd[]): boolean {
  const on = runs.filter((o) => o !== r && o.holder === r.holder);
  const later = list.filter((x) => x.start > w.start && msOfFrame(x.start) <= r.lastListed);
  if (!later.every((x) => on.some((o) => Math.abs(o.since - msOfFrame(x.start)) <= RUN_START_MS))) return false;
  const overlaps = (o: LoggedLaneEnd) => o.since <= r.lastListed && r.since <= o.lastListed;
  return on.some(overlaps) && on.every((o) => !overlaps(o) || Math.abs(o.lastListed - r.lastListed) >= APART_MS);
}

/** Whether `r` is the run on its holder whose start is nearest `S` (ms): the one an instance applied at S stands for. */
function nearestRun(r: LoggedLaneEnd, S: number, runs: readonly LoggedLaneEnd[]): boolean {
  return runs.every((o) => o === r || o.holder !== r.holder || Math.abs(o.since - S) >= Math.abs(r.since - S));
}

/**
 * The state with each buff due to expire by `frame` kept on while the log still lists it (engine assumption
 * hidden-holds, reading `log`): the world held it in ways no logged cast shows (perfect dodges: a 0.512 s world
 * slow-down each, the dodger exempt; docs/open-problems.md "The buff clock"). Only a timed buff of a kit with one game
 * buff run per instance: not consumed, ended with a cast, layered, ticking, or on a clock the replay already takes from
 * the log (ticksShownByHits, ticksLoggedAs, endFollowsTick). The run must have started within RUN_START_MS of the
 * instance's application, be listed past its own expiry on a holder the instance reaches, not be refreshed in the log,
 * and end within HIDDEN_HOLD_SHARE of the instance's life past it. Its end (loggedEndOf) is a frame after the last
 * listed hit before any hit past the expiry that doesn't list it on a holder the instance reaches (one instance stands
 * for every holder's run: where one holder's ends first, its hits' damage follows that end: btl_upload_b6aa15281db4 at
 * 43.9 s). The instance is kept a step at a time (to the step's frame and one more), never past that end: the log's
 * time already holds every stop up to it, which a single extension would have the replay's later stops hold again (and
 * where they hold it past the end anyway, it ends there).
 */
function heldToLoggedEnds(st: TimelineState, frame: number, ends: LoggedLaneEnds, defs: ReadonlyMap<string, KitBuff>): TimelineState {
  if (ends.runs.size === 0) return st;
  let changed = false;
  const buffs = st.buffs.map((b) => {
    if (b.cast !== undefined || !Number.isFinite(b.expiresAt) || b.expiresAt <= st.frame) return b;
    if (b.expiresAt > frame) {
      // Kept on by the log, then held past its end by a stop the replay places longer than the game's: the log's end.
      const kept = ends.decided.get(`${b.owner}|${b.id}|${b.appliedAt}`);
      if (!kept || frame < kept.end) return b;
      changed = true;
      return { ...b, expiresAt: Math.max(kept.end, st.frame + 1) };
    }
    const kept = loggedEndOf(b, ends, defs);
    if (kept === null || kept.end <= b.expiresAt) return b;
    changed = true;
    return { ...b, expiresAt: Math.min(kept.end, frame + 1) };
  });
  return changed ? { ...st, buffs } : st;
}

/**
 * The frame an instance ends at by the log (heldToLoggedEnds), or null where the log doesn't decide it; fixed per
 * instance at its own first expiry (LoggedLaneEnds.decided), so the steps that keep it don't move it.
 */
function loggedEndOf(b: ActiveBuff, ends: LoggedLaneEnds, defs: ReadonlyMap<string, KitBuff>): { readonly end: number } | null {
  const key = `${b.owner}|${b.id}|${b.appliedAt}`;
  const known = ends.decided.get(key);
  if (known !== undefined) return known;
  const decide = (end: number | null) => {
    const v = end === null ? null : { end };
    ends.decided.set(key, v);
    return v;
  };
  if (b.every !== undefined || b.maxLayers !== undefined || b.maxInstances !== undefined) return decide(null);
  const def = defs.get(`${b.owner}:${b.id}`);
  if (!def || notAClock(def) !== null) return decide(null);
  // The run began with this instance (within RUN_START_MS of its application), not a later one the replay missed.
  const [from, latest, until] = [((b.appliedAt * 1000) / FPS) - RUN_START_MS, ((b.appliedAt * 1000) / FPS) + RUN_START_MS, (b.expiresAt * 1000) / FPS];
  const names = loggedNames(def);
  const holds = (holder: string) => (def.target === "enemy" ? holder === "enemy" : holder !== "enemy" && reaches(b, holder));
  const lasts: number[] = [];
  for (const g of names) {
    for (const r of ends.runs.get(`${g}|${b.owner}`) ?? []) {
      if (r.refreshed || r.since < from || r.since > latest || r.since >= until || r.lastListed <= until || !holds(r.holder)) continue;
      lasts.push(r.lastListed);
    }
  }
  // The first hit after the expiry on a holder it reaches that lists none of its game buffs from its owner.
  const keys = names.map((g) => `${g}|${b.owner}`);
  const off = lasts.length ? ends.hits.find((h) => h.t > until && (def.target === "enemy" || holds(h.operator)) && !keys.some((k) => h.listed.has(k))) : undefined;
  const before = lasts.filter((t) => off === undefined || t < off.t);
  if (before.length === 0) return decide(null);
  const end = frameOf(Math.max(...before)) + 1;
  return decide(end - b.expiresAt > HIDDEN_HOLD_SHARE * (b.expiresAt - b.appliedAt) ? null : end);
}

/**
 * An `expires` step: the operator's active instance of its buff (whileBuff) set to expire at the frame, when it would
 * outlast the logged end by more than EXPIRY_MARGIN_FRAMES (else its own expiry is the end); the next advance ends it.
 */
function expiredAt(st: TimelineState, c: ReplayedCast, f: number): TimelineState {
  const w = c.whileBuff;
  if (!w) return st;
  const end = Math.round((w.endsAt * FPS) / 1000) + EXPIRY_MARGIN_FRAMES;
  const hit = (b: ActiveBuff) => b.id === w.buff && b.owner === c.operator && activeAt(b, f) && b.expiresAt > end;
  return st.buffs.some(hit) ? { ...st, buffs: st.buffs.map((b) => (hit(b) ? { ...b, expiresAt: f } : b)) } : st;
}

function replayedSkill(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number): string | null {
  const startsBy = (skill: string) => {
    const r = earliestStart(ctx, st, { operator: c.operator, skill });
    return !("error" in r) && r.frame <= f + 1;
  };
  const kit = ctx.kits.get(c.operator);
  const w = c.whileBuff;
  if (w && !st.buffs.some((b) => (b.id === w.buff || (w.or ?? []).includes(b.id)) && b.owner === c.operator && activeAt(b, f) && b.expiresAt > Math.round((w.endsAt * FPS) / 1000) + EXPIRY_MARGIN_FRAMES)) return null;
  if (c.slot) {
    // Which skill the slot holds, not whether it can start this frame (Si presses during her combo in 0eef): available at all
    // by its kit's state then (earliestStart alone waits for that state: 3f78ceb15bc3's press at 19708 ms, in her
    // ultimate, read as her battle skill after Artful Intent's end, so Initial Stroke wasn't made and the Inksoul's burst
    // at 22689 ms took the mark's branch).
    const available = (skill: string) => skillAvailable(ctx, st, c.operator, skill, f) && !("error" in earliestStart(ctx, st, { operator: c.operator, skill }));
    // The variant pulling a buff (pullingPresses): made as it while the slot holds it.
    if (c.as) return available(c.as) ? c.as : null;
    // A press the log shows as a variant by its own keys: the variant the kit says the slot holds then.
    if (!c.leadsTo && c.shows?.length) return skillAvailable(ctx, st, c.operator, c.skillId, f) ? null : (c.shows.find((s) => skillAvailable(ctx, st, c.operator, s, f)) ?? null);
    // A press whose hits had no one to land on (`unseen`) is its own skill while the slot holds it (d774d0ce7bd3: Liino's
    // battle skill at 49863 ms, with no enemy from 30.6 to 54.6 s; its stance's ATK is on the team from then to 115.9 s).
    // Else a press the log shows nothing of isn't made: the slot held a variant (her stance's presses every ~3 s, under
    // which the stance and its volleys go on), or the press did nothing (dbaee23b801d: Arcane's at 2706 ms, while
    // Typhoeus's hits land).
    if (!c.leadsTo) return c.unseen && skillAvailable(ctx, st, c.operator, c.skillId, f) && startsBy(c.skillId) ? c.skillId : null;
    // A step before the inferred cast, never that cast again (the inferred one is timed by the log's buff end:
    // e9896c8d02be's press at 67244 ms, under the Inksoul, isn't the Final Stroke whose burst comes at 69192 ms).
    if (available(c.skillId)) return null;
    return kit?.skills.find((k) => k.skillId !== c.skillId && k.skillId !== c.leadsTo && k.kind === c.kind && !k.followUpOnly && available(k.skillId))?.skillId ?? null;
  }
  // A skill of a slot that holds one of two variants with the same keys (Typhoeus's combo while hovering, her hovering
  // combo otherwise): the one its kit says is available then.
  if (c.kind !== "basic") {
    if (skillAvailable(ctx, st, c.operator, c.skillId, f)) return c.skillId;
    const keys = new Set((kit?.skills.find((k) => k.skillId === c.skillId)?.hits ?? []).flatMap((h) => h.events));
    const variant = kit?.skills.find((k) => k.skillId !== c.skillId && k.kind === c.kind && !k.followUpOnly && k.hits.some((h) => h.events.some((e) => keys.has(e))) && skillAvailable(ctx, st, c.operator, k.skillId, f));
    return variant?.skillId ?? c.skillId;
  }
  if (startsBy(c.skillId)) return c.skillId;
  const hasKey = (skill: string) => (kit?.skills.find((k) => k.skillId === skill)?.hits ?? []).some((h) => h.events.includes(c.key));
  // The chain's next steps first, then any basic attack of the operator with the key (steps gated by the kit's own
  // state, Typhoeus's ABATK attempts: her hover attacks aren't a chain of windows).
  const chain = st.chainNext[c.operator];
  const steps = [...(chain ? [chain, ...(chain.alternatives ?? [])].filter((x) => x.until >= f).map((x) => x.skill) : []), ...(kit?.skills.filter((k) => k.kind === "basic").map((k) => k.skillId) ?? [])];
  for (const skill of steps) if (skill !== c.skillId && hasKey(skill) && startsBy(skill)) return skill;
  // None can start by the logged frame by the kit's timing (the log's casts come a few frames sooner than its windows:
  // 9090afbacec9's shots at 91455 and 92002 ms, 16 frames apart, where shot 2's window for shot 3 opens at 18): the one
  // the kit's state allows then (its `available`: the attempt index), not the placed one, whose index is the placement's
  // guess (the placed shot 1 there made the next logged shot the 5th, which ended her hover before the logged 5th).
  if (!skillAvailable(ctx, st, c.operator, c.skillId, f)) for (const skill of steps) if (skill !== c.skillId && hasKey(skill) && skillAvailable(ctx, st, c.operator, skill, f)) return skill;
  return c.skillId;
}

/**
 * The step a cast that hit nothing is (ReplayedCast.missed): the operator's next basic-attack step the kit allows at the
 * frame by its state and timing (the chain's next steps first, then any of its basic attacks in kit order; not a
 * finisher or a dive, which aren't the attack input's repeats), only while it's the controlled operator (holding the
 * attack input). Null: none.
 */
function missedStep(ctx: TimelineContext, st: TimelineState, operator: string, f: number): string | null {
  if (st.controlled !== operator) return null;
  const chain = st.chainNext[operator];
  const basic = attackSteps(ctx, operator);
  const steps = [...(chain ? [chain, ...(chain.alternatives ?? [])].filter((x) => x.until >= f).map((x) => x.skill) : []), ...basic].filter((x) => basic.includes(x));
  for (const skill of steps) {
    if (!skillAvailable(ctx, st, operator, skill, f)) continue;
    const r = earliestStart(ctx, st, { operator, skill });
    if (!("error" in r) && r.frame <= f + 1) return skill;
  }
  return null;
}

/** An operator's basic attacks the attack input repeats: not a finisher (skillSpecification 8) or a dive (6), nor a follow-up. */
function attackSteps(ctx: TimelineContext, operator: string): string[] {
  return (ctx.kits.get(operator)?.skills ?? []).filter((k) => k.kind === "basic" && !k.followUpOnly && ![6, 8].includes(ctx.data.skills[k.skillId]?.timing?.specification ?? 0)).map((k) => k.skillId);
}

/**
 * Whether the kit allows none of a logged basic attack's skills (its placed one and the operator's others with its key)
 * at its frame in the replay (the state there): its `available` isn't met (Typhoeus's floating shots need her hover and
 * their attempt index). Only a cast the log shows by its own hits.
 */
function unmet(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number): boolean {
  if (c.missed || c.slot || c.kind !== "basic" || c.landings.length === 0) return false;
  const kit = ctx.kits.get(c.operator);
  const skills = [c.skillId, ...(kit?.skills ?? []).filter((k) => k.kind === "basic" && k.hits.some((h) => h.events.includes(c.key))).map((k) => k.skillId)];
  return skills.every((s) => !skillAvailable(ctx, st, c.operator, s, f));
}

/** The most casts that hit nothing added before one logged cast (Typhoeus's hover takes at most 4 shots before the 5th, which ends it). */
const MISSED_MAX = 4;

/** How many times missedCasts looks again for a shot's first frame from a later state (a stop held the earlier one). */
const FIRST_TRIES = 3;

/** The most logged casts the replay adds casts that hit nothing before (missedCasts), per fight. */
const MISSED_ROUNDS = 12;

/** One replay's casts as made and its steps, for missedCasts. */
interface MissedSearch {
  readonly ctx: TimelineContext;
  readonly made: readonly { readonly c: ReplayedCast; readonly f: number; readonly post: TimelineState }[];
  readonly steps: readonly { readonly frame: number; readonly cast: ReplayedCast | null }[];
}

/**
 * Casts that hit nothing (ReplayedCast.missed), which no log shows (ZMDLogs lists hits; a shot that hits nothing leaves no
 * entry: the owner, who plays Typhoeus, 2026-11-15: holding attack while she hovers, she keeps shooting when the shots
 * hit nothing), added before a logged cast the kit allows none of its skills for (unmet): the fewest of the operator's
 * basic-attack steps (missedStep) after its previous cast that make the kit allow it, each at the earliest frame that
 * still does, the latest first; none when no number up to MISSED_MAX does (9090afbacec9: Typhoeus's shot at 57615 ms,
 * no hit by anyone from 57.9 to 60.6 s, a shot at 60630 ms that needs her hover, which idles out 1.9 s after a shot). Each
 * candidate is judged by making the casts from the previous one's state to the need's frame (`make`: the replay's own
 * cast making, the others' casts in between included).
 */
function missedCasts(r: MissedSearch, need: { c: ReplayedCast; f: number }, make: (st: TimelineState, c: ReplayedCast, f: number) => { st: TimelineState; skillId: string | null }, hold: (st: TimelineState, frame: number) => TimelineState, hits: readonly Pick<LogHit, "t" | "operator" | "event">[]): ReplayedCast[] {
  const { ctx } = r;
  const op = need.c.operator;
  const prev = r.made.filter((m) => m.c.operator === op && m.f < need.f).at(-1);
  if (!prev) return [];
  const [i, j] = [r.steps.findIndex((s) => s.cast === prev.c), r.steps.findIndex((s) => s.cast === need.c)];
  if (i < 0 || j < 0) return [];
  const between = r.steps.slice(i + 1, j).flatMap((s) => (s.cast ? [{ frame: s.frame, cast: s.cast }] : []));
  const shot = (t: number): ReplayedCast => {
    const start = (t * 1000) / FPS;
    return { operator: op, key: "", group: "", skillId: need.c.skillId, kind: "basic", start, lastHit: start, keepPrevious: prev.c.lastHit > start, landings: [], missed: { skill: need.c.skillId, at: need.c.start } };
  };
  /** The casts from the previous one's state with these shots, to `until`: the skills the shots were made as (null: not every shot was), and the state then. */
  const tried = new Map<string, { skills: string[] | null; st: TimelineState }>();
  const trial = (times: readonly number[], until: number): { skills: string[] | null; st: TimelineState } => {
    const key = `${times.join(",")}|${until}`;
    const known = tried.get(key);
    if (known) return known;
    const r = trialOf(times, until);
    tried.set(key, r);
    return r;
  };
  const trialOf = (times: readonly number[], until: number): { skills: string[] | null; st: TimelineState } => {
    const events = [...between.filter((x) => x.frame <= until).map((x) => ({ ...x, missed: false })), ...times.filter((t) => t <= until).map((t) => ({ frame: t, cast: shot(t), missed: true }))].sort((a, b) => a.frame - b.frame || Number(a.missed) - Number(b.missed));
    let st = prev.post;
    const skills: string[] = [];
    for (const e of events) {
      st = hold(st, Math.max(e.frame, st.frame));
      try {
        const m = make(st, e.cast, Math.max(e.frame, st.frame));
        if (e.missed && m.skillId === null) return { skills: null, st };
        if (e.missed) skills.push(m.skillId as string);
        st = m.st;
      } catch (err) {
        if (e.missed) return { skills: null, st };
        if (!(err instanceof Error)) throw err;
      }
    }
    return { skills, st: advance(ctx, hold(st, Math.max(until, st.frame)), Math.max(until, st.frame)) };
  };
  const ok = (times: readonly number[]) => {
    const t = trial(times, need.f);
    return t.skills !== null && !unmet(ctx, t.st, need.c, need.f);
  };
  /** The skill a shot at `t` after `times` is made as, or null. */
  const madeAs = (times: readonly number[], t: number) => trial([...times, t], t).skills?.at(-1) ?? null;
  /**
   * The first frame after `times` a shot can start (the earliest start from the state after them, of a step the kit
   * allows), and its step. Where none can start there, again from the state there: a time stop cast in between holds
   * the earliest start the state before it gave (dbaee23b801d: Typhoeus's battle skill at 0.85 s, then Li Zhiyan's
   * ultimate stop from 0.93 to 2.50 s; her first shot can't start at 1.7 s, the end of her battle skill's action).
   */
  const first = (times: readonly number[]): { t: number; skill: string } | null => {
    let from = (times.at(-1) ?? prev.f) + 1;
    for (let tries = 0; tries < FIRST_TRIES && from < need.f; tries++) {
      const st = trial(times, from).st;
      const at = from;
      const starts = attackSteps(ctx, op).flatMap((skill) => {
        if (!skillAvailable(ctx, st, op, skill, at)) return [];
        const e = earliestStart(ctx, st, { operator: op, skill });
        return "error" in e || e.frame >= need.f ? [] : [e.frame];
      });
      const sorted = [...new Set(starts)].sort((a, b) => a - b);
      for (const t of sorted) {
        const skill = madeAs(times, t);
        if (skill !== null) return { t, skill };
      }
      if (sorted.length === 0) return null;
      from = Math.max(from, (sorted[0] as number) + 1);
    }
    return null;
  };
  /**
   * The last frame before the need a shot after `times` can start as the same step as at its first (the operator's state
   * ends it: Typhoeus's hover, after which the attack input is her grounded attack 1).
   */
  const last = (times: readonly number[], from: { t: number; skill: string }): number => {
    const same = (t: number) => madeAs(times, t) === from.skill;
    let [lo, hi] = [from.t, need.f - 1];
    if (same(hi)) return hi;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (same(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // Only where the log shows no hit of the need's key from the first frame another attack could start: one there is a cast
  // the placement put elsewhere, not one that hit nothing (fc63a2001251: the shot at 95138 ms, whose cast the placement
  // started at 93999 ms from the burst before it).
  const opening = first([]);
  if (!opening || hits.some((h) => h.operator === op && h.event === need.c.key && frameOf(h.t) >= opening.t && frameOf(h.t) < need.f)) return [];
  // The fewest: each shot as late as it can be (the longest reach), until the need is met.
  const times: number[] = [];
  for (let k = 1; k <= MISSED_MAX; k++) {
    const a = k === 1 ? opening : first(times);
    if (a === null) return [];
    times.push(last(times, a));
    if (!ok(times)) continue;
    // The earliest that still meet it: the latest shot first, each as early as it can be with the later ones where they are.
    for (let n = times.length - 1; n >= 0; n--) {
      let [lo, hi] = [first(times.slice(0, n))?.t ?? (times[n] as number), times[n] as number];
      const at = (t: number) => times.map((x, m) => (m === n ? t : x));
      if (ok(at(lo))) hi = lo;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (ok(at(mid))) hi = mid;
        else lo = mid;
      }
      times[n] = hi;
    }
    return times.map(shot);
  }
  return [];
}

export interface ReplayOptions {
  /**
   * Modifiers a logged hit's landing takes on top of the timeline's (TimelineScenario.loggedModifiers): the log's effects
   * no kit models, for the simulation of the logged casts (logcheck.ts simulateLog). Absent: the kits' alone.
   */
  readonly loggedModifiers?: (hit: LogHit) => readonly Modifier[];
  /**
   * Arts reaction levels the log shows where the replay's differ (TimelineScenario.loggedReactionLevels: logcheck.ts
   * loggedReactionLevels finds them), at the replay's own landings of those reactions. Absent: the replay's own.
   */
  readonly reactionLevels?: TimelineScenario["loggedReactionLevels"];
  /**
   * Readings of open assumptions to replay under (TimelineOptions.assume): the kits' and the engine's own
   * (timeline/assumptions.ts, e.g. control-immunity), for measuring a reading on the logs. Absent: the defaults.
   */
  readonly assume?: Readonly<Record<string, string>>;
  /** Kit buffs (`owner:id`) whose instances' expiries to trace step by step (BuffReplay.traces; `zmdlogs replay --trace-buff`). */
  readonly trace?: readonly string[];
  /**
   * More bounds on the hidden holds (hidden-holds `placed`/`holds`), beside the replay's own clocks: clocks only a reading
   * of the hits' damage shows (logcheck.ts logBuffReplay: Corrosion's ramp steps, holds.ts rampBounds).
   */
  readonly holdBounds?: readonly HoldBound[];
}

/** Whether a logged cast made as `skillId` at `f` goes against the kit (BuffReplay.castFlags), the state advanced to `f`. */
function castFlag(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, skillId: string, f: number): CastFlag | undefined {
  if (c.missed || c.slot || c.kind === "basic") return undefined;
  if (!skillAvailable(ctx, st, c.operator, skillId, f)) {
    const own = [...new Set(st.buffs.filter((b) => b.owner === c.operator && activeAt(b, f)).map((b) => b.id))];
    return { cast: c, skillId, frame: f, kind: "forced", why: `its kit makes it unavailable then (the operator's own buffs: ${own.join(", ") || "none"})` };
  }
  const cur = st.acting[c.operator];
  if (!cur || cur.auto || cur.skill === skillId) return undefined;
  const until = exclusiveUntil(ctx, st, c.operator);
  if (until <= f + 1) return undefined;
  const r = earliestStart(ctx, st, { operator: c.operator, skill: skillId });
  if ("error" in r || r.frame <= f + 1) return undefined;
  return { cast: c, skillId, frame: f, kind: "inside", why: `${r.frame - f} frame(s) before ${cur.skill} lets it start (its uncuttable frames: the kit allows it from ${((r.frame * 1000) / FPS / 1000).toFixed(2)} s)` };
}

/** A step of the replay in words, for a trace (BuffTrace.step). */
function stepWords(s: { cast: ReplayedCast | null; recover: boolean; bar?: number; through?: number; endBar?: number | null }): string {
  if (s.cast) return `cast ${s.cast.skillId}`;
  if (s.recover) return "the log's Stagger recovery";
  if (s.endBar !== undefined) return "the log's calm hit";
  if (s.bar !== undefined) return "the log's Stagger bar";
  if (s.through !== undefined) return "the log's Stagger listing";
  return "time to the next sample (pauses, stops, holds)";
}

export function replayKitBuffs(data: GameData, fx: LogFixture, placement: Placement, opts: ReplayOptions = {}): BuffReplay {
  const listed = listedWithValues(fx);
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  const decided = new Map<string, string[]>();
  const undecided = new Map<string, string>();
  for (const kit of kits) {
    for (const def of kit.buffs) {
      if (!def.gameBuff || !listed.has(def.gameBuff) || def.consumedBy || def.link) continue;
      const why = undecidedBuff(kit, def.id);
      if (why) undecided.set(def.gameBuff, `${kit.operator} ${why}`);
      else decided.set(def.gameBuff, [...(decided.get(def.gameBuff) ?? []), `${kit.operator}:${def.id}`]);
    }
  }
  for (const g of undecided.keys()) decided.delete(g);
  // Every kit buff the replay can't judge, listed or not (the log check takes those from the log: logcheck.ts). Not an
  // operator's whose buffs the log never lists, its weapon's and gear's included: such a log doesn't record that
  // operator's buffs, so their absence says nothing (1d91: Liino's lance ATK layers on her heals' targets, ×1.15 on
  // Typhoeus's hits with 4 layers, and her stance ATK, all missing from the log).
  const unjudgedKitBuffs = new Map<string, string>();
  const allListed = new Set(fx.hits.flatMap((h) => h.effects.map((e) => e.buff)));
  for (const kit of kits) for (const def of kit.buffs) {
    if (!kit.buffs.some((d) => d.gameBuff !== undefined && allListed.has(d.gameBuff))) continue;
    const why = undecidedBuff(kit, def.id);
    if (why) unjudgedKitBuffs.set(`${kit.operator}:${def.id}`, why);
  }
  const failed: { cast: ReplayedCast; error: string }[] = [];
  const edge = frameOf(REPLAY_EDGE_MS);
  const team = fx.team.map((b) => b.operator);
  // What the replay knows of each cast and logged landing (the log check reads them: castFacts, landing).
  const facts = new Map<ReplayedCast, ReplayCastFacts>();
  const failedCasts = new Set<ReplayedCast>();
  const landed = new Map<string, LandedHit>();
  const kitIds = [...decided].flatMap(([g, defs]) => defs.map((d) => ({ g, owner: d.split(":", 2)[0] as string, id: d.split(":", 2)[1] as string })));
  // Game buffs a trigger on crits is behind (critTriggers): where a landing's crit isn't logged, the replay bounds them.
  const critDependent = new Set(kitIds.filter(({ owner, id }) => critTriggers(kits.find((k) => k.operator === owner) as OperatorKit, id).length > 0).map((x) => x.g));
  const assembled = assembleCasts(data, fx, placement, kits);
  const control = controlledFromLog(placement, assembled);
  const recoveries = loggedRecoveries(fx).map(frameOf);
  // The bar is set a frame before its hit, so the hit sees the bar the log has before it.
  const poiseBars = loggedPoiseBars(fx).map((g) => ({ frame: Math.max(0, frameOf(g.t) - 1), bar: g.bar, calm: g.notStaggered }));
  // The log's Stagger state, likewise a frame before its hits (loggedStaggerSteps): Staggered through the next listed
  // moment, or not Staggered (where no moment of that frame lists it, and no hit there breaks the bar: the breaking hit
  // itself lists none).
  const staggerSteps = loggedStaggerSteps(fx);
  const listedFrames = new Set(staggerSteps.filter((x) => x.through !== undefined).map((x) => frameOf(x.t)));
  const breakFrames = new Set(fx.hits.filter((h) => h.poise?.bar === 0).map((h) => frameOf(h.t)));
  const staggerState = staggerSteps.flatMap((x): { frame: number; through?: number; endBar?: number | null }[] => {
    const frame = Math.max(0, frameOf(x.t) - 1);
    if (x.through !== undefined) return [{ frame, through: frameOf(x.through) + 1 }];
    const f = frameOf(x.t);
    return x.calm && !listedFrames.has(f) && !breakFrames.has(f) ? [{ frame, endBar: x.calm.bar }] : [];
  });
  const logged = control?.casts ?? assembled;
  // With the casts that hit nothing the log needs (missedCasts), added below.
  let casts: readonly ReplayedCast[] = logged;
  // Engine assumption hidden-holds: with `log`, the buffs the log lists past their expiry run on to its end (heldToLoggedEnds).
  const holdsReading = opts.assume?.["hidden-holds"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "hidden-holds")?.default;
  const hiddenHolds = holdsReading === "log" || holdsReading === "placed";
  // With `placed` (and `holds`, the placed holds alone), the world holds placed once for every timer (holds.ts), from a first replay without them.
  const placing = holdsReading === "placed" || holdsReading === "holds";
  let worldHolds: readonly { readonly frame: number; readonly frames: number }[] = [];
  let placedHolds: PlacedHolds | null = null;
  // Why each replayed instance is or isn't a clock of the placement (BuffReplay.holdClocks).
  const holdClocks: ClockWhy[] = [];
  const noEnds = (): LoggedLaneEnds => ({ runs: new Map(), hits: [], decided: new Map() });
  // Placing, the first replay keeps no buff to the log's end: its expiries are the clocks' (runBounds).
  let laneEnds: LoggedLaneEnds = hiddenHolds && !placing ? loggedLaneEnds(fx) : noEnds();
  const clockEnds: LoggedLaneEnds = placing ? loggedLaneEnds(fx) : laneEnds;
  const kitDefs = new Map(kits.flatMap((k) => k.buffs.map((d) => [`${k.operator}:${d.id}`, d] as const)));
  const held = (st: TimelineState, frame: number) => heldToLoggedEnds(heldTicks(st, frame, tickEvents), frame, laneEnds, kitDefs);
  const tickEvents: TickEvents = { events: loggedTickFrames(kits, logged), landings: loggedTickLandings(kits, placement), endFollows: endFollowsTick(kits) };
  const shownByHits = shownCrits(kits, fx, placement);
  const byLayers = new Map([...shownByHits, ...layerCrits(kits, fx, placement, shownByHits)]);
  const shown = new Map([...byLayers, ...valueCrits(kits, fx, placement, byLayers)]);
  const sampleFrames = [...new Set(fx.hits.flatMap((h) => [frameOf(h.t) - edge, frameOf(h.t), frameOf(h.t) + edge]))].filter((f) => f >= 0).sort((a, b) => a - b);
  type Made = { c: ReplayedCast; f: number; skillId: string; pre: TimelineState; post: TimelineState; index: number; link: number; windowCount: number | null; consumed: ConsumedBuffs };
  /** A logged cast the kit allows none of its skills for at its frame in the replay (missedCasts), and the state before it. */
  type Need = { c: ReplayedCast; f: number };
  /**
   * One cast made at `f` (the state not yet advanced to it): the state after it, the skill it was made as (null: none,
   * a tick or a press the slot doesn't make), the state before it and the combo window count it found.
   */
  const makeCast = (ctx: TimelineContext, st0: TimelineState, c: ReplayedCast, f: number, list: readonly ReplayedCast[]) => {
    let st = advance(ctx, withoutFollowUps(ctx, st0, list, f), f);
    const windowCount = c.kind === "combo" ? replayWindowCount(ctx, st, c.operator, c.skillId, f) : null;
    const pre = st;
    const tick = c.missed ? null : loggedTick(ctx, st, c, f);
    if (tick) return { st: tick, skillId: null, pre, windowCount };
    if (c.expires) return { st: expiredAt(st, c, f), skillId: null, pre, windowCount };
    const skillId = c.missed ? missedStep(ctx, st, c.operator, f) : replayedSkill(ctx, st, c, f);
    if (skillId === null) return { st, skillId, pre, windowCount };
    const flag = castFlag(ctx, st, c, skillId, f);
    // A slot cast the log shows only by its press (Si's Initial Stroke during her combo) keeps the running cast's hits.
    st = replayCast(ctx, st, c.operator, skillId, f, { keepPrevious: c.keepPrevious || c.slot === true, landings: c.landings, ...(c.teammate ? { teammate: true } : {}), ...(c.missed ? { missed: true } : {}) });
    return { st, skillId, pre, windowCount, ...(flag ? { flag } : {}) };
  };
  /**
   * One replay of the logged casts. Landings whose crit the log gives crit as it says (TimelineScenario.loggedCrits);
   * the others as `crit` says: never for the replay the check reads, always for the bound on the buffs a trigger on crits
   * is behind (critDependent: where the two disagree, the replay doesn't decide them).
   */
  const run = (crit: "never" | "always", list: readonly ReplayedCast[] = casts) => {
    // Per game buff and operator: its instances (summed over the kit buffs standing for it: theirs don't overlap at one recipient).
    const instances = new Map<string, Instance[]>();
    // Every kit buff's instances per recipient (`owner:id|operator`), and the Stagger windows (frames).
    const kitInstances = new Map<string, Instance[]>();
    const staggerWindows: Instance[] = [];
    // Where the log's Stagger outlasted the engine's own (loggedStaggerSteps): the frame the engine's would have ended
    // (null: the engine had none running) and the frame the hold reached; the until a hold last set, to tell them apart.
    const staggerHolds: { frame: number; engineUntil: number | null }[] = [];
    const staggerCuts: { frame: number; engineUntil: number }[] = [];
    const cut = () => {
      if (isStaggered(st, st.frame) && st.stagger.until !== heldUntil) staggerCuts.push({ frame: st.frame, engineUntil: st.stagger.until as number });
    };
    let heldUntil: number | null = null;
    let brokenAt: number | null = null;
    const firstBasic = control ? { operator: control.first } : list.find((c) => c.kind === "basic");
    const enemyHp = loggedEnemyHp(data, fx);
    const scenario: TimelineScenario = {
      team: fx.team,
      target: { enemy: fx.enemy.id, level: fx.enemy.level },
      durationFrames: (sampleFrames.at(-1) ?? 0) + 1,
      rotation: [],
      options: { crit, ...(opts.assume && Object.keys(opts.assume).length ? { assume: opts.assume } : {}) },
      ...(firstBasic ? { controlled: firstBasic.operator } : {}),
      ...(enemyHp?.length ? { enemyHp } : {}),
      // Each with its logged hit's index: a pinned landing (replayCast landings `ref`) takes its own hit's crit.
      // Crits the log leaves out but a trigger on crits shows by its logged hits (shownCrits), by the layers it adds
      // (layerCrits) or the hits' values show (valueCrits) count as logged.
      loggedCrits: fx.hits.flatMap((h, i) => {
        const crit = h.crit ?? shown.get(i) ?? null;
        return crit === null ? [] : [{ operator: h.operator, event: h.event, frame: frameOf(h.t), crit, ref: String(i) }];
      }),
      ...(opts.loggedModifiers ? { loggedModifiers: fx.hits.flatMap((h) => {
        const modifiers = (opts.loggedModifiers as NonNullable<ReplayOptions["loggedModifiers"]>)(h);
        return modifiers.length ? [{ operator: h.operator, event: h.event, frame: frameOf(h.t), modifiers }] : [];
      }) } : {}),
      ...(opts.reactionLevels?.length ? { loggedReactionLevels: opts.reactionLevels } : {}),
    };
    const ctx = createContext(data, scenario);
    let st: TimelineState = init(ctx);
    for (const c of list) if (c.beforeLog) st = withCastBeforeLog(ctx, st, c);
    // The instances seen at the last sample, by identity (kit buff, owner, start, recipients, and which of several at one start).
    const open = new Map<string, { key: string; owner: string; id: string; start: number; expiresAt: number }>();
    const close = (key: string, start: number, end: number, expired: boolean) => instances.set(key, [...(instances.get(key) ?? []), { start, end, expired }]);
    const openKit = new Map<string, { key: string; start: number; expiresAt: number }>();
    const closeKit = (key: string, start: number, end: number, expired: boolean) => kitInstances.set(key, [...(kitInstances.get(key) ?? []), { start, end, expired }]);
    let staggerOpen: { start: number; until: number } | null = null;
    const sample = (frame: number) => {
      const seen = new Map<string, { key: string; owner: string; id: string; start: number; expiresAt: number }>();
      for (const { g, owner, id } of kitIds) {
        const live = st.buffs.filter((b: ActiveBuff) => b.id === id && b.owner === owner && b.cast === undefined && activeAt(b, frame));
        for (const op of team) {
          const counted = new Map<string, number>();
          for (const b of live) {
            if (!reaches(b, op)) continue;
            const base = `${g}|${op}#${owner}|${id}|${b.appliedAt}|${b.recipients?.join(",") ?? ""}`;
            const n = counted.get(base) ?? 0;
            counted.set(base, n + 1);
            seen.set(`${base}|${n}`, { key: `${g}|${op}`, owner, id, start: b.appliedAt, expiresAt: b.expiresAt });
          }
        }
      }
      // Every kit buff (KitBuff.gameBuff or not), by identity as above.
      const seenKit = new Map<string, { key: string; start: number; expiresAt: number }>();
      for (const b of st.buffs) {
        if (b.cast !== undefined || !activeAt(b, frame)) continue;
        for (const op of team) {
          if (!reaches(b, op)) continue;
          const base = `${b.owner}:${b.id}|${op}#${b.appliedAt}|${b.recipients?.join(",") ?? ""}`;
          let n = 0;
          while (seenKit.has(`${base}|${n}`)) n++;
          seenKit.set(`${base}|${n}`, { key: `${b.owner}:${b.id}|${op}`, start: b.appliedAt, expiresAt: b.expiresAt });
        }
      }
      for (const [k, rec] of openKit) if (!seenKit.has(k)) closeKit(rec.key, rec.start, rec.expiresAt <= frame ? rec.expiresAt : frame, rec.expiresAt <= frame);
      openKit.clear();
      for (const [k, v] of seenKit) openKit.set(k, v);
      // The Stagger window (TimelineState.stagger: until when the enemy is Staggered).
      // One window while it lasts: a time stop or freeze moving its end keeps it (its new end); it closes where it ran
      // out or was ended (a refill, the log's calm hit), and a Stagger after that is a new one.
      // (A Stagger that began after the last sample's ended is a new one: its end less its length is past that end; a
      // stop between the samples only moved the running one's.)
      const until = st.stagger.until !== null && st.stagger.until > frame ? st.stagger.until : null;
      if (staggerOpen && (until === null || (staggerOpen.until <= frame && until - staggerFrames(ctx) >= staggerOpen.until))) {
        staggerWindows.push({ start: staggerOpen.start, end: Math.min(staggerOpen.until, frame), expired: staggerOpen.until <= frame });
        staggerOpen = null;
      }
      if (until !== null && staggerOpen) staggerOpen.until = until;
      if (until !== null && !staggerOpen) staggerOpen = { start: Math.max(0, until - staggerFrames(ctx)), until };
      for (const [k, rec] of open) {
        if (seen.has(k)) continue;
        // Gone: it ran out, or ended early (used up, or replaced by a new instance at its start: the replacement's start is its end).
        const expired = rec.expiresAt <= frame;
        const replacement = [...seen.values()].filter((x) => x.key === rec.key && x.owner === rec.owner && x.id === rec.id && x.start > rec.start && x.start <= frame).map((x) => x.start);
        close(rec.key, rec.start, expired ? rec.expiresAt : replacement.length ? Math.max(...replacement) : frame, expired);
      }
      open.clear();
      for (const [k, v] of seen) open.set(k, v);
    };
    // Casts and samples in frame order; a cast before a sample at its frame (its frame-0 hits land first); the log's
    // Stagger recoveries before both (the bar is full for that frame's hits), and its bar a frame before its hits.
    // At one frame: the log's Stagger end before its bar (the bar is the hit's), and its Stagger after it.
    // A hidden hold (worldHolds) before the casts at its frame: what's due after it is held.
    type Step = { frame: number; cast: ReplayedCast | null; recover: boolean; bar?: number; calm?: boolean; through?: number; endBar?: number | null; hold?: number };
    const rank = (s: Step) => (s.recover ? 0 : s.hold !== undefined ? 1 : s.cast ? 2 : s.endBar !== undefined ? 3 : s.bar !== undefined ? 4 : s.through !== undefined ? 5 : 6);
    const steps: Step[] = [
      ...recoveries.map((frame) => ({ frame, cast: null as ReplayedCast | null, recover: true })),
      ...worldHolds.map((h) => ({ frame: h.frame, cast: null as ReplayedCast | null, recover: false, hold: h.frames })),
      ...poiseBars.map((g) => ({ frame: g.frame, cast: null as ReplayedCast | null, recover: false, bar: g.bar, calm: g.calm })),
      ...staggerState.map((g) => ({ ...g, cast: null as ReplayedCast | null, recover: false })),
      ...list.filter((c) => !c.beforeLog).map((c) => ({ frame: Math.max(0, frameOf(c.start)), cast: c as ReplayedCast | null, recover: false })),
      ...sampleFrames.map((frame) => ({ frame, cast: null as ReplayedCast | null, recover: false })),
    ].sort((a, b) => a.frame - b.frame || rank(a) - rank(b));
    // The state after each step, for the facts' check at REPLAY_EDGE_MS either side of a cast (stateAt).
    const checkpoints: TimelineState[] = [st];
    const made: Made[] = [];
    const needs: Need[] = [];
    const castErrors: { cast: ReplayedCast; error: string }[] = [];
    const flags: CastFlag[] = [];
    const traces: BuffTrace[] = [];
    const traced = new Set(opts.trace ?? []);
    let tracedNow = new Map<string, number>();
    let prevStep: Step | null = null;
    const trace = (s: Step) => {
      const now = new Map<string, number>();
      for (const b of st.buffs) if (b.cast === undefined && traced.has(`${b.owner}:${b.id}`)) now.set(`${b.owner}:${b.id}|${b.appliedAt}`, b.expiresAt);
      for (const [k, to] of now) if (tracedNow.get(k) !== to) traces.push({ buff: k.split("|")[0] as string, appliedAt: Number(k.split("|")[1]), frame: st.frame, step: stepWords(s), from: tracedNow.get(k) ?? null, to });
      for (const [k, from] of tracedNow) if (!now.has(k)) traces.push({ buff: k.split("|")[0] as string, appliedAt: Number(k.split("|")[1]), frame: st.frame, step: stepWords(s), from, to: null });
      tracedNow = now;
    };
    for (const s of steps) {
      // The state after the step before this one: its changes are that step's.
      if (traced.size && prevStep) trace(prevStep);
      prevStep = s;
      st = held(st, Math.max(s.frame, st.frame));
      if (checkpoints.at(-1) !== st) checkpoints.push(st);
      if (s.cast) {
        const c = s.cast;
        try {
          const f = Math.max(s.frame, st.frame);
          const r = makeCast(ctx, st, c, f, list);
          if (crit === "never" && unmet(ctx, r.pre, c, f)) needs.push({ c, f });
          if ("flag" in r && r.flag) flags.push(r.flag);
          st = r.st;
          if (r.skillId === null) continue;
          const skillId = r.skillId;
          const index = st.casts.findLastIndex((x) => x.frame === f && x.operator === c.operator && x.skill === skillId);
          const carried = st.buffs.filter((b) => b.cast === index && b.id !== "link");
          const consumed: ConsumedBuffs = { buffs: carried.map((b) => b.id).sort(), modifiers: buffModifiers(carried, c.operator, f, index) };
          made.push({ c, f, skillId, pre: r.pre, post: st, index, link: st.casts[index]?.link ?? 0, windowCount: r.windowCount, consumed });
        } catch (e) {
          castErrors.push({ cast: c, error: e instanceof Error ? e.message : String(e) });
        }
        continue;
      }
      try {
        st = advance(ctx, withoutFollowUps(ctx, st, list, Math.max(s.frame, st.frame)), Math.max(s.frame, st.frame));
        if (s.recover) {
          st = refillPoise(ctx, st);
          continue;
        }
        if (s.hold !== undefined) {
          st = holdWorld(st, st.frame, s.hold);
          continue;
        }
        if (s.bar !== undefined) {
          if (s.calm === true) cut();
          st = setPoise(ctx, st, s.bar, s.calm === true);
          continue;
        }
        if (s.through !== undefined) {
          const running = isStaggered(st, st.frame);
          const until = st.stagger.until;
          if ((!running || (until as number) < s.through) && until !== heldUntil) staggerHolds.push({ frame: st.frame, engineUntil: running ? until : null });
          st = holdStagger(st, st.frame, s.through);
          if (st.stagger.until !== until) heldUntil = st.stagger.until;
          continue;
        }
        if (s.endBar !== undefined) {
          cut();
          if (isStaggered(st, st.frame)) st = setPoise(ctx, st, s.endBar ?? Infinity, true);
          continue;
        }
      } catch (e) {
        // The timeline can't go on (a hit it can't land from what the replay knows): it decides nothing from here.
        brokenAt = s.frame;
        castErrors.push({ cast: list.filter((c) => frameOf(c.start) <= s.frame).at(-1) as ReplayedCast, error: `the replay stops at ${Math.round((s.frame * 1000) / FPS)} ms: ${e instanceof Error ? e.message : String(e)}` });
        break;
      }
      sample(s.frame);
    }
    if (traced.size && prevStep) trace(prevStep);
    for (const rec of open.values()) close(rec.key, rec.start, brokenAt ?? rec.expiresAt, brokenAt === null && Number.isFinite(rec.expiresAt));
    for (const rec of openKit.values()) closeKit(rec.key, rec.start, brokenAt ?? rec.expiresAt, brokenAt === null && Number.isFinite(rec.expiresAt));
    const lastStagger = staggerOpen as { start: number; until: number } | null;
    if (lastStagger) staggerWindows.push({ start: lastStagger.start, end: brokenAt ?? lastStagger.until, expired: brokenAt === null });
    if (checkpoints.at(-1) !== st) checkpoints.push(st);
    return { ctx, st, instances, brokenAt, made, needs, steps, checkpoints, castErrors, flags, traces, changes: countChanges(instances, edge), kitInstances, kitChanges: countChanges(kitInstances, edge), staggerWindows, staggerHolds, staggerCuts };
  };
  let main = kits.length > 0 ? run("never") : null;
  if (main && placing) {
    // The holds from the replay without them (its buffs' expiries against the log's runs, the enemy's ticks), then the replay with them.
    // On the replay's own casts' stops (replayedCastStops): the placed casts' miss an ultimate placed from its cast event.
    const stops = replayedCastStops(data, assembled);
    const statuses = statusBounds(statusInstances(main.checkpoints, main.st.reactions, main.brokenAt), statusLanes(fx), stops, consumedStatuses(kits), HIDDEN_HOLD_SHARE, holdClocks);
    placedHolds = placeHolds([...runBounds(main.kitInstances, kitDefs, clockEnds, stops, holdClocks), ...statuses, ...tickBounds(fx, stops), ...(opts.holdBounds ?? [])], {
      end: Math.max(0, ...fx.hits.map((h) => h.t)),
      still: main.staggerWindows.map((w) => [msOfFrame(w.start), msOfFrame(Number.isFinite(w.end) ? w.end : frameOf(Math.max(0, ...fx.hits.map((h) => h.t))))] as const),
    });
    worldHolds = placedHolds.holds;
    if (hiddenHolds) laneEnds = loggedLaneEnds(fx);
    if (worldHolds.length || hiddenHolds) main = run("never");
  }
  // Casts that hit nothing before logged casts the kit allows only after them (missedCasts): the earliest need first, the
  // replay made again with its casts, until no need is left that such casts meet.
  const tried = new Set<ReplayedCast>();
  for (let added = 0; main && added < MISSED_ROUNDS; ) {
    const r = main;
    const need = r.needs.find((n) => !tried.has(n.c));
    if (!need) break;
    tried.add(need.c);
    const shots = missedCasts(r, need, (st, c, f) => makeCast(r.ctx, st, c, f, [...casts, c]), held, fx.hits);
    if (!shots.length) continue;
    casts = [...casts, ...shots].sort((a, b) => a.start - b.start);
    main = run("never");
    added++;
  }
  // The bound for buffs a trigger on crits is behind: only needed where some landing's crit isn't logged.
  // …and for every kit buff a trigger on crits is behind (BuffReplay.kitBuffNearChange: the log check's engine readings).
  const anyCritTrigger = kits.some((k) => k.triggers.some((t) => t.on.event === "hit" && t.on.crit !== undefined));
  const bound = main && (critDependent.size > 0 || anyCritTrigger) && main.st.hits.some((h) => h.loggedCrit === null) ? run("always") : null;
  const brokenAt = main ? (bound?.brokenAt !== null && bound?.brokenAt !== undefined ? Math.min(main.brokenAt ?? Infinity, bound.brokenAt) : main.brokenAt) : null;
  if (main) {
    const { ctx, st, made, checkpoints } = main;
    for (const e of main.castErrors) {
      failed.push(e);
      if (!e.error.startsWith("the replay stops")) failedCasts.add(e.cast);
    }
    for (const h of st.hits) if (h.ref !== undefined) landed.set(h.ref, h);
    // Landings a trigger made (not pinned): each logged hit without a pinned landing takes the nearest of its operator's
    // with its event, within NEAR_FRAMES, in time order (each landing once).
    const eventsOf = new Map(kits.flatMap((k) => kitHitEntries(k).map((e) => [`${k.operator}|${e.skillId}|${e.hit.id}`, e.hit.events] as const)));
    const free = st.hits.filter((h) => h.ref === undefined && h.facts);
    const taken = new Set<LandedHit>();
    for (const [i, h] of [...fx.hits.entries()].sort((a, b) => a[1].t - b[1].t)) {
      if (landed.has(String(i))) continue;
      const f = batchedFrame(casts, h) ?? frameOf(h.t);
      let best: LandedHit | null = null;
      for (const x of free) {
        if (taken.has(x) || x.operator !== h.operator || Math.abs(x.frame - f) > NEAR_FRAMES || !eventsOf.get(`${x.operator}|${x.skillId}|${x.hitId}`)?.includes(h.event)) continue;
        if (!best || Math.abs(x.frame - f) < Math.abs(best.frame - f)) best = x;
      }
      if (best) {
        taken.add(best);
        landed.set(String(i), best);
      }
    }
    /** The replay's state at a frame: its latest step at or before it, advanced (pure). */
    const stateAt = (frame: number): TimelineState => {
      let cp = checkpoints[0] as TimelineState;
      for (const x of checkpoints) if (x.frame <= frame) cp = x;
      return cp.frame === frame ? cp : advance(ctx, cp, frame);
    };
    const linkLive = (x: TimelineState, op: string, frame: number) =>
      x.link.filter((e) => e > frame).length + x.buffs.filter((b) => b.link && b.cast === undefined && reaches(b, op) && activeAt(b, frame)).length;
    const consumable = (x: TimelineState, op: string, kind: SkillType | "none", frame: number) =>
      kind === "none" ? [] : x.buffs.filter((b) => b.cast === undefined && b.consumedBy?.includes(kind) && reaches(b, op) && activeAt(b, frame)).map((b) => b.id).sort();
    /** Whether a cast of this kind consumes a buff of the operator's (own or worn) without a duration (KitBuff.duration absent). */
    const preLogLayers = (op: string, kind: SkillType | "none") =>
      kind !== "none" && kits.some((k) => k.operator === op && k.buffs.some((b) => b.consumedBy?.includes(kind) && b.duration === undefined));
    for (const m of made) {
      const kind = m.c.kind ?? "none";
      const [a, b] = [Math.max(0, m.f - edge), m.f + edge];
      let link: Fact<number> = { value: m.link };
      let consumed: Fact<ConsumedBuffs> = { value: m.consumed };
      if (main.brokenAt !== null && b >= main.brokenAt) [link, consumed] = [{ unknown: "after the replay stopped" }, { unknown: "after the replay stopped" }];
      else {
        // What the cast found is the same REPLAY_EDGE_MS either side of it on the timeline without it (its own time
        // stop would hold back a teammate's delayed grant: 4e5e1390085e, Camille's Link 23 ms after Rossi's ultimate),
        // and no other cast that would use the same uses it meanwhile.
        const [before, after] = [stateAt(a), advance(ctx, m.pre, b)];
        const others = made.filter((o) => o !== m && Math.abs(o.f - m.f) <= edge);
        if (kind === "battle" || kind === "ultimate") {
          const live = [linkLive(before, m.c.operator, a), linkLive(m.pre, m.c.operator, m.f), linkLive(after, m.c.operator, b)].map((n) => Math.min(4, n));
          const rival = others.some((o) => o.c.kind === "battle" || o.c.kind === "ultimate");
          if (live.some((n) => n !== m.link) || (rival && m.link > 0)) link = { unknown: `Link stacks change within ${REPLAY_EDGE_MS} ms of the cast` };
        }
        const ids = JSON.stringify(m.consumed.buffs);
        const sameAround = [consumable(before, m.c.operator, kind, a), consumable(after, m.c.operator, kind, b)].every((x) => JSON.stringify(x) === ids);
        if (!sameAround || (m.consumed.buffs.length > 0 && others.some((o) => o.c.kind === m.c.kind))) consumed = { unknown: `buffs a cast consumes change within ${REPLAY_EDGE_MS} ms of it` };
        // Layers without a duration that the operator's first such cast consumes may come from casts before the log's start
        // (fixtures/zmdlogs-b7b3762d5da8.json: Si's first combo carries three Yinglung's Edge layers, the logged battle skills
        // before it two).
        else if (preLogLayers(m.c.operator, kind) && !made.some((o) => o.f < m.f && o.c.operator === m.c.operator && o.c.kind === m.c.kind)) {
          consumed = { unknown: "layers without a duration casts before the log may have built" };
        }
      }
      facts.set(m.c, { index: m.index, link, consumed, windowCount: m.windowCount !== null ? { value: m.windowCount } : { unknown: "a combo window the replay didn't see open" } });
    }
  }
  const hitIndex = new Map(fx.hits.map((h, i) => [h, i]));
  const broken = (ms: number) => brokenAt !== null && frameOf(ms) >= brokenAt - edge;
  const replayedCast = (c: Pick<LoggedCast, "operator" | "skillId" | "start">) => casts.find((d) => !d.missed && d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= 1000);
  const castFacts = (c: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind">): ReplayCastFacts | { unknown: string } => {
    if (kits.length === 0) return { unknown: "no kit to replay" };
    // A trigger's hits (a placed group of kind null) belong to no cast in the timeline: no Link, no consumed buffs.
    if (c.kind === null) return TRIGGERED;
    const d = replayedCast(c);
    if (!d) return { unknown: "a cast the replay doesn't make" };
    if (failedCasts.has(d)) return { unknown: "a cast the replay couldn't make" };
    if (broken(d.start)) return { unknown: "after the replay stopped" };
    return facts.get(d) ?? { unknown: "a cast the replay didn't reach" };
  };
  /** A run's instances of a game buff at an operator at a frame, or null near one of its changes. */
  const countIn = (r: NonNullable<typeof main>, key: string, f: number): number | null => {
    if ((r.changes.get(key) ?? []).some((c) => Math.abs(c.frame - f) <= c.slack)) return null;
    return (r.instances.get(key) ?? []).filter((i) => i.start <= f && f < i.end).length;
  };
  // Status landings matched to the log's status hits: per logged hit, its operator's status damage of its kind and element nearest it.
  const statusLanded = new Map<LogHit, LandedHit>();
  if (main) {
    const free = main.st.hits.filter((h) => h.skillId.startsWith("reaction:"));
    const taken = new Set<LandedHit>();
    for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
      const r = parseReactionEvent(h.event);
      if (!r) continue;
      const f = batchedFrame(casts, h) ?? frameOf(h.t);
      let best: LandedHit | null = null;
      for (const x of free) {
        if (taken.has(x) || x.operator !== h.operator || x.skillId !== `reaction:${r.kind}` || x.element !== r.element || Math.abs(x.frame - f) > NEAR_FRAMES) continue;
        if (!best || Math.abs(x.frame - f) < Math.abs(best.frame - f)) best = x;
      }
      if (best) {
        taken.add(best);
        statusLanded.set(h, best);
      }
    }
  }
  const nearIn = (changes: ReadonlyMap<string, readonly Change[]>, key: string, f: number) => (changes.get(key) ?? []).some((c) => Math.abs(c.frame - f) <= c.slack);
  return {
    decided,
    undecided,
    failed,
    unjudgedKitBuffs,
    missed: (main?.made ?? []).flatMap((m) => (m.c.missed ? [{ operator: m.c.operator, skillId: m.skillId, start: m.c.start, need: { skillId: m.c.missed.skill, start: m.c.missed.at } }] : [])),
    hits: main?.st.hits ?? [],
    reactions: main?.st.reactions ?? [],
    staggers: main ? main.staggerWindows.map((w) => w.start) : [],
    staggerSpans: main ? main.staggerWindows.map((w) => ({ start: w.start, end: w.end })) : [],
    staggerHolds: main?.staggerHolds ?? [],
    staggerCuts: main?.staggerCuts ?? [],
    castFlags: main?.flags ?? [],
    traces: main?.traces ?? [],
    hiddenHolds: placedHolds,
    holdClocks,
    spTopUps: main ? main.made.flatMap((m) => {
      const lack = spCostAt(main.ctx, m.pre, m.c.operator, skillCosts(main.ctx, m.c.operator, m.skillId, m.f), m.f) - spAt(m.pre, m.f);
      return lack > 1e-6 ? [{ frame: m.f, operator: m.c.operator, skillId: m.skillId, sp: lack }] : [];
    }) : [],
    brokenAt,
    statusLanding(hit) {
      const found = statusLanded.get(hit);
      if (found) return found;
      if (kits.length === 0) return { unknown: "no kit to replay" };
      if (broken(hit.t)) return { unknown: "after the replay stopped" };
      return { unknown: "a status the replay didn't deal near the logged hit" };
    },
    kitBuffNearChange(hit, kitBuff) {
      if (!main) return false;
      const f = frameOf(hit.t);
      const key = `${kitBuff}|${hit.operator}`;
      if (nearIn(main.kitChanges, key, f)) return true;
      // Where the landings whose crit the log doesn't give matter (the replay with them critting has other instances), it isn't sure either.
      if (!bound) return false;
      const count = (r: NonNullable<typeof main>) => (r.kitInstances.get(key) ?? []).filter((i) => i.start <= f && f < i.end).length;
      return nearIn(bound.kitChanges, key, f) || count(bound) !== count(main);
    },
    kitWindows(kitBuff, operator) {
      const ms = (f: number) => (Number.isFinite(f) ? (f * 1000) / FPS : f);
      return (main?.kitInstances.get(`${kitBuff}|${operator}`) ?? []).map((i) => ({ start: ms(i.start), end: ms(i.end), expired: i.expired })).sort((x, y) => x.start - y.start);
    },
    staggerNearChange(t) {
      if (!main) return false;
      const f = frameOf(t);
      return main.staggerWindows.some((w) => Math.abs(w.start - f) <= edge || (Number.isFinite(w.end) && Math.abs(w.end - f) <= edge));
    },
    instances(hit, gameBuff) {
      if (!decided.has(gameBuff) || !main) return null;
      const f = frameOf(hit.t);
      if (brokenAt !== null && f >= brokenAt - edge) return null;
      const key = `${gameBuff}|${hit.operator}`;
      const n = countIn(main, key, f);
      // A buff a trigger on crits is behind: decided only where the landings whose crit the log doesn't give don't matter.
      if (n !== null && bound && critDependent.has(gameBuff) && countIn(bound, key, f) !== n) return null;
      return n;
    },
    castFacts,
    landing(hit) {
      const found = landed.get(String(hitIndex.get(hit)));
      if (found) return found;
      if (kits.length === 0) return { unknown: "no kit to replay" };
      if (broken(hit.t)) return { unknown: "after the replay stopped" };
      const p = placement.hits.get(hit);
      if (!p) return { unknown: "a hit the placement doesn't place" };
      const shared = p.sameAs ? landed.get(String(hitIndex.get(p.sameAs))) : undefined;
      if (shared) return shared;
      const c = castFacts(p.cast);
      if ("unknown" in c) return c;
      if (p.frame === undefined) return { unknown: "a landing whose order the kit doesn't give" };
      return { unknown: "a landing the replay didn't land" };
    },
  };
}

/** The changes in each key's count: starts and ends at one frame net out (a refresh), each with its slack (REPLAY_EDGE_MS, and an expiry's share of its life). */
function countChanges(instances: ReadonlyMap<string, readonly Instance[]>, edge: number): Map<string, Change[]> {
  const changes = new Map<string, Change[]>();
  for (const [key, list] of instances) {
    const at = new Map<number, { delta: number; slack: number }>();
    const add = (frame: number, delta: number, slack: number) => {
      const cur = at.get(frame) ?? { delta: 0, slack: 0 };
      at.set(frame, { delta: cur.delta + delta, slack: Math.max(cur.slack, slack) });
    };
    for (const i of list) {
      add(i.start, 1, edge);
      if (Number.isFinite(i.end)) add(i.end, -1, edge + (i.expired ? Math.round(REPLAY_EXPIRY_SLACK * (i.end - i.start)) : 0));
    }
    changes.set(key, [...at].filter(([, c]) => c.delta !== 0).map(([frame, c]) => ({ frame, ...c })).sort((a, b) => a.frame - b.frame));
  }
  return changes;
}

/** Where the replay and the log disagree about a kit buff at a logged hit: one has it on and the other off, or both on with other instance counts. */
export interface BuffDisagreement {
  readonly buff: string;
  readonly operator: string;
  readonly t: number;
  /** Instances the log lists at the hit (inside it, not at its boundary; an unquantified listing counts as one). */
  readonly log: number;
  readonly replay: number;
}

const layeredCache = new Map<string, boolean>();
/** Whether ZMDLogs lists a buff once whatever its layers (BuffData stackingType 8: layers on one timer). */
export function listedOnce(buff: string): boolean {
  if (!layeredCache.has(buff)) layeredCache.set(buff, isBuffFileListed(buff) && readBuffFile(buff)?.stacking.type === 8);
  return layeredCache.get(buff) as boolean;
}

/** One instance's logged effects of a buff: per zone and element, the strongest value at that listing. */
function oneInstance(effects: readonly LogEffect[]): LogEffect[] {
  const best = new Map<string, LogEffect>();
  for (const e of effects) {
    const k = `${e.zone}|${e.element}`;
    const cur = best.get(k);
    if (!cur || e.value > cur.value) best.set(k, e);
  }
  return [...best.values()];
}

/** Instances of a buff a logged listing has: its most repeated zone and element. */
function listedInstances(effects: readonly LogEffect[]): number {
  const n = new Map<string, number>();
  for (const e of effects) n.set(`${e.zone}|${e.element}`, (n.get(`${e.zone}|${e.element}`) ?? 0) + 1);
  return Math.max(0, ...n.values());
}

/** A logged hit with some buffs' entries (each listed once) at a number of layers. */
export function atLayers(hit: LogHit, layers: ReadonlyMap<string, number>): LogHit {
  if (layers.size === 0) return hit;
  const scale = (e: LogEffect): LogEffect => {
    const n = layers.get(e.buff);
    return n === undefined ? e : { ...e, value: e.value * n };
  };
  return { ...hit, effects: hit.effects.map(scale), boundaryEffects: hit.boundaryEffects.map(scale) };
}

/** The logged hits as the replay decides their kit buffs (replayedHits), with the disagreements found. */
export interface ReplayedHits {
  /** Each logged hit with its decided buffs' effects as the replay has them; a hit the replay doesn't change is itself. */
  readonly hits: ReadonlyMap<LogHit, LogHit>;
  /** Per hit, the game buffs whose entries the replay set (added or took away). */
  readonly decidedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /** Per hit, the game buffs the replay judged there (it decides them: not near one of its changes). */
  readonly judgedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /**
   * Per hit, the layers the replay gives a buff the log lists once whatever its layers (stackingType 8) and both have
   * on: the hit's entries are at that many layers (in `hits`, and for the log's listing too: logcheck.ts).
   */
  readonly layersAt: ReadonlyMap<LogHit, ReadonlyMap<string, number>>;
  readonly disagreements: readonly BuffDisagreement[];
}

/**
 * Each logged hit with the replay's activity of its decided buffs in place of
 * the log's listing, where the replay is sure (BuffReplay.instances): a buff
 * the replay has off loses its entries (effects, boundary effects,
 * unquantified); one it has on that the log lists inside the hit keeps the
 * log's entries (their instances and values: the log's gaps are buffs it
 * stops listing, not miscounted layers; a different count is reported); one
 * it has on that the log doesn't list, or lists only at the hit's boundary
 * or without values, gets the replay's instances, with the values the log
 * gives the buff elsewhere (one instance's, from the nearest hit of the same
 * operator that lists it, else of anyone's; a buff the log lists once
 * whatever its layers, stackingType 8, as one entry at the layers' total).
 * Near a change, the log's listing stands.
 */
export function replayedHits(fx: LogFixture, replay: BuffReplay): ReplayedHits {
  const listings = new Map<string, { t: number; operator: string; effects: LogEffect[] }[]>();
  for (const h of fx.hits) {
    for (const buff of new Set([...h.effects, ...h.boundaryEffects].map((e) => e.buff))) {
      if (!replay.decided.has(buff)) continue;
      const inside = h.effects.filter((e) => e.buff === buff);
      const effects = inside.length ? inside : h.boundaryEffects.filter((e) => e.buff === buff);
      listings.set(buff, [...(listings.get(buff) ?? []), { t: h.t, operator: h.operator, effects }]);
    }
  }
  const template = (buff: string, hit: LogHit): LogEffect[] => {
    let best: { d: number; effects: LogEffect[] } | null = null;
    for (const l of listings.get(buff) ?? []) {
      // The same operator's listings first (a buff's values may differ by recipient), then the nearest in time.
      const d = Math.abs(l.t - hit.t) + (l.operator === hit.operator ? 0 : 1e9);
      if (!best || d < best.d) best = { d, effects: l.effects };
    }
    return best ? oneInstance(best.effects) : [];
  };
  const hits = new Map<LogHit, LogHit>();
  const decidedAt = new Map<LogHit, Set<string>>();
  const judgedAt = new Map<LogHit, Set<string>>();
  const layersAt = new Map<LogHit, Map<string, number>>();
  const disagreements: BuffDisagreement[] = [];
  for (const hit of fx.hits) {
    const judged = new Set<string>();
    const set = new Set<string>();
    const layers = new Map<string, number>();
    const added: LogEffect[] = [];
    for (const buff of replay.decided.keys()) {
      const n = replay.instances(hit, buff);
      if (n === null) continue;
      judged.add(buff);
      const inside = hit.effects.filter((e) => e.buff === buff);
      const atBoundary = hit.boundaryEffects.some((e) => e.buff === buff);
      const logged = inside.length ? listedInstances(inside) : hit.unquantified.some((u) => u.buff === buff) ? 1 : 0;
      // The log's boundary listing says nothing either way.
      if (!(inside.length === 0 && atBoundary && logged === 0)) {
        const count = !listedOnce(buff) && logged > 0 && n > 0 && logged !== n;
        if ((logged > 0) !== (n > 0) || count) disagreements.push({ buff, operator: hit.operator, t: hit.t, log: logged, replay: n });
      }
      // The log's entries stand; a buff the log lists once whatever its layers (stackingType 8) at the replay's layers.
      if (n > 0 && inside.length) {
        if (listedOnce(buff) && n > 1 && listedInstances(inside) === 1) layers.set(buff, n);
        continue;
      }
      if (n === 0 && !inside.length && !atBoundary && !hit.unquantified.some((u) => u.buff === buff)) continue; // nothing to change
      set.add(buff);
      if (n === 0) continue;
      const one = inside.length ? oneInstance(inside) : template(buff, hit);
      if (listedOnce(buff)) added.push(...one.map((e) => ({ ...e, value: e.value * n })));
      else for (let i = 0; i < n; i++) added.push(...one);
    }
    if (judged.size) judgedAt.set(hit, judged);
    if (layers.size) layersAt.set(hit, layers);
    const layered = atLayers(hit, layers);
    if (set.size === 0) {
      hits.set(hit, layered);
      continue;
    }
    decidedAt.set(hit, set);
    hits.set(hit, {
      ...layered,
      effects: [...layered.effects.filter((e) => !set.has(e.buff)), ...added],
      boundaryEffects: layered.boundaryEffects.filter((e) => !set.has(e.buff)),
      unquantified: layered.unquantified.filter((u) => !set.has(u.buff)),
    });
  }
  return { hits, decidedAt, judgedAt, layersAt, disagreements };
}

/** A run of disagreeing hits of one buff and operator, one way. */
export interface DisagreementRun {
  readonly buff: string;
  readonly operator: string;
  /** "replay": the replay has it on, the log doesn't list it; "log": the reverse; "count": both on, with other instance counts. */
  readonly on: "replay" | "log" | "count";
  readonly from: number;
  readonly to: number;
  readonly hits: number;
  /** For "count": the instance counts seen (log / replay). */
  readonly counts?: readonly string[];
}

/** Disagreements grouped into runs: consecutive judged hits of an operator that disagree the same way. */
export function disagreementRuns(fx: LogFixture, r: ReplayedHits): DisagreementRun[] {
  const byHit = new Map<LogHit, Map<string, BuffDisagreement>>();
  const hitOf = new Map<string, LogHit[]>();
  for (const h of fx.hits) hitOf.set(`${h.operator}|${h.t}`, [...(hitOf.get(`${h.operator}|${h.t}`) ?? []), h]);
  for (const d of r.disagreements) for (const h of hitOf.get(`${d.operator}|${d.t}`) ?? []) byHit.set(h, new Map([...(byHit.get(h) ?? []), [d.buff, d]]));
  const out: DisagreementRun[] = [];
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  const buffs = [...new Set(r.disagreements.map((d) => d.buff))].sort();
  for (const buff of buffs) {
    for (const operator of fx.team.map((b) => b.operator)) {
      let cur: { on: DisagreementRun["on"]; from: number; to: number; hits: number; counts: Set<string> } | null = null;
      const flush = () => {
        if (cur) out.push({ buff, operator, on: cur.on, from: cur.from, to: cur.to, hits: cur.hits, ...(cur.on === "count" ? { counts: [...cur.counts] } : {}) });
      };
      for (const h of sorted) {
        if (h.operator !== operator || !r.judgedAt.get(h)?.has(buff)) continue;
        const d = byHit.get(h)?.get(buff);
        const on: DisagreementRun["on"] | null = d ? (d.log > 0 && d.replay > 0 ? "count" : d.replay > 0 ? "replay" : "log") : null;
        if (cur && on === cur.on) {
          cur.to = h.t;
          cur.hits++;
          if (d) cur.counts.add(`${d.log}/${d.replay}`);
          continue;
        }
        flush();
        cur = on && d ? { on, from: h.t, to: h.t, hits: 1, counts: new Set([`${d.log}/${d.replay}`]) } : null;
      }
      flush();
    }
  }
  return out;
}
