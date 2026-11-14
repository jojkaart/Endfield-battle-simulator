// Rotations as an opener and a loop (owner, 2026-11-14: "complete rotations, not a fixed 60 s window"): an opener
// from the fight's start to a round of ultimate casts, then a loop from that round to the next that can be played
// again and again for as long as the fight lasts (docs/design.md "Opener and loop").

import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import { searchRotation, type SearchOptions, type SearchResult } from "./search.ts";
import { simulate, type RotationAction, type TimelineScenario } from "./timeline.ts";
import { FPS } from "./units.ts";

export interface LoopOptions extends SearchOptions {
  /** Length of the fight the opener is searched over, in frames (default the scenario's, at least LOOP_OPENER_FRAMES). */
  readonly horizonFrames?: number;
  /** Repetitions that must agree for a loop (default 3). */
  readonly repeats?: number;
  /** Most the agreeing repetitions' lengths may differ, as a fraction of the longest (default LOOP_TOLERANCE). */
  readonly tolerance?: number;
  /** Repetitions searched at most before giving up (default LOOP_MAX_REPETITIONS). */
  readonly maxRepetitions?: number;
}

/** The opener search's fight length when the scenario's is shorter: 60 s, room for the first round of ultimates from zero energy (a search setting). */
export const LOOP_OPENER_FRAMES = 60 * FPS;
/** The longest repetition looked for: 60 s. */
export const LOOP_MAX_FRAMES = 60 * FPS;
/** How far past a repetition's longest end each repetition's search looks, so that its end isn't where it spends everything: 10 s. */
const LOOKAHEAD_FRAMES = 10 * FPS;
/** Repetitions searched at most (the first ones still spend what the opener left over). */
export const LOOP_MAX_REPETITIONS = 6;
/**
 * How far apart the agreeing repetitions' lengths may be by default: 1% (the owner's brief, 2026-11-14: "within
 * ~1%"). Their damage isn't held to it: the enemy's Stagger cycle doesn't follow the loop's, so a finisher and the
 * Staggered bonus fall in a different repetition each time (laevatain-solo: one repetition of three had the
 * finisher, 292k of 1.58M); the loop's DPS is the repetitions' mean, and LoopResult.loop.damageApart says how far
 * apart they were.
 */
export const LOOP_TOLERANCE = 0.01;

/** One repetition: from a cast of the boundary ultimate to its next. */
export interface Repetition {
  /** Where it starts (the boundary ultimate's cast), its length and the damage landed in its frames. */
  readonly start: number;
  readonly frames: number;
  readonly damage: number;
  /** Its actions, `at` from its start (the first: the boundary ultimate at 0). */
  readonly actions: readonly RotationAction[];
}

/** The opener and the loop (searchLoop). */
export interface LoopResult {
  /** The ultimate whose casts start and end each repetition. */
  readonly boundary?: { readonly operator: string; readonly skill: string };
  /** Every repetition searched, in order. */
  readonly repetitions: readonly Repetition[];
  /**
   * The loop: the last `repeats` repetitions, when they agree (`exact`: the same actions at the same times; else the
   * same skills in the same order with lengths within the tolerance).
   */
  readonly loop?: {
    /** Its first repetition's index in `repetitions` (the ones before are the opener's). */
    readonly first: number;
    readonly exact: boolean;
    /** The opener: every action before the loop's first repetition, `at` from the fight's start; its length and damage. */
    readonly opener: readonly RotationAction[];
    readonly openerFrames: number;
    readonly openerDamage: number;
    /** The loop's actions (its first repetition's), `at` from the loop's start. */
    readonly actions: readonly RotationAction[];
    /** The repetitions' mean length, damage per second, and how far apart their lengths and damage per second are ((max − min) / max). */
    readonly frames: number;
    readonly dps: number;
    readonly lengthApart: number;
    readonly damageApart: number;
  };
  /**
   * The opener and every repetition searched, `at` absolute (replays with simulate), to the start of the repetition
   * after the last; its total damage there (simulate) and DPS.
   */
  readonly rotation: readonly RotationAction[];
  readonly frames: number;
  readonly total: number;
  readonly dps: number;
  /** The opener search over the horizon. */
  readonly opener: SearchResult;
  readonly horizonFrames: number;
  readonly repeats: number;
  readonly tolerance: number;
  /** Why there's no loop, when there isn't. */
  readonly reason?: string;
}

/** A rotation action's kind in its operator's kit. */
function kindOf(data: GameData, a: RotationAction): string | undefined {
  return data.kits.operators[a.operator]?.skills.find((s) => s.skillId === a.skill)?.kind;
}

/** Whether two repetitions play the same actions at the same times. */
function sameActions(a: readonly RotationAction[], b: readonly RotationAction[]): boolean {
  return a.length === b.length && a.every((x, i) => x.operator === b[i]?.operator && x.skill === b[i]?.skill && x.at === b[i]?.at);
}

/** A repetition's skills in order (every action but basic attacks), as text. */
function skillOrder(data: GameData, a: readonly RotationAction[]): string {
  return a.filter((x) => kindOf(data, x) !== "basic").map((x) => `${x.operator}:${x.skill}`).join(",");
}

/** (max − min) / max. */
function apart(xs: readonly number[]): number {
  const hi = Math.max(...xs);
  return hi > 0 ? (hi - Math.min(...xs)) / hi : 0;
}

/**
 * The opener and the loop (2026-11-14). The opener: the search's rotation over the horizon up to the first cast of
 * the boundary ultimate, the one the rotation casts least (the slowest to recharge sets the loop's length). Then
 * repetition after repetition, each searched afresh: the beam search from the rotation so far (its prefix) over the
 * longest repetition and LOOKAHEAD_FRAMES more, cut at the boundary ultimate's next cast. A plan that depends only on
 * where it starts repeats once the starts repeat: the loop is the last `repeats` repetitions once they agree
 * (`exact` when they play the same actions at the same times, else the same skills in the same order with lengths
 * within `tolerance`). The earlier repetitions are the opener's (they still spend what the opener left over).
 * Deterministic; the rotation of opener and repetitions replays with `simulate`.
 */
export function searchLoop(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: LoopOptions = {}): LoopResult {
  const { horizonFrames, repeats = 3, tolerance = LOOP_TOLERANCE, maxRepetitions = LOOP_MAX_REPETITIONS, ...search } = options;
  if (!Number.isInteger(repeats) || repeats < 2) throw new EngineError(`repeats must be a whole number ≥ 2, not ${repeats}`);
  if (!Number.isInteger(maxRepetitions) || maxRepetitions < repeats) throw new EngineError(`maxRepetitions must be a whole number ≥ repeats (${repeats}), not ${maxRepetitions}`);
  const horizon = horizonFrames ?? Math.max(scenario.durationFrames, LOOP_OPENER_FRAMES);
  const opener = searchRotation(data, { ...scenario, durationFrames: horizon }, { ...search, runs: 0 });
  const casts = new Map<string, number>();
  for (const a of opener.rotation) if (kindOf(data, a) === "ultimate") casts.set(`${a.operator}\n${a.skill}`, (casts.get(`${a.operator}\n${a.skill}`) ?? 0) + 1);
  // The slowest ultimate; ties: the first the rotation casts (a stable sort of a Map in insertion order).
  const slowest = [...casts.entries()].sort((x, y) => x[1] - y[1])[0]?.[0];
  const finish = (rotation: readonly RotationAction[], end: number, repetitions: readonly Repetition[], extra: Partial<LoopResult>): LoopResult => {
    const sim = simulate(data, { ...scenario, durationFrames: end, rotation });
    return { opener, horizonFrames: horizon, repeats, tolerance, repetitions, rotation, frames: end, total: sim.total, dps: end > 0 ? sim.total / (end / FPS) : 0, ...extra };
  };
  if (slowest === undefined) return finish(opener.rotation, horizon, [], { reason: "the rotation casts no ultimate" });
  const [op, skill] = slowest.split("\n") as [string, string];
  const boundary = { operator: op, skill };
  const isBoundary = (a: RotationAction) => a.operator === op && a.skill === skill;
  const first = opener.rotation.findIndex(isBoundary);
  let prefix = opener.rotation.slice(0, first + 1);
  let start = opener.rotation[first]?.at as number;
  const cuts: { start: number; frames: number; actions: RotationAction[] }[] = [];
  let reason: string | undefined;
  let found: { first: number; exact: boolean } | undefined;
  while (cuts.length < maxRepetitions) {
    const r = searchRotation(data, { ...scenario, durationFrames: start + LOOP_MAX_FRAMES + LOOKAHEAD_FRAMES }, { ...search, runs: 0 }, { prefix });
    const j = r.rotation.findIndex((a, i) => i >= prefix.length && isBoundary(a));
    const end = r.rotation[j]?.at;
    if (end === undefined || end - start > LOOP_MAX_FRAMES) {
      reason = `the boundary ultimate isn't cast again within ${LOOP_MAX_FRAMES / FPS} s of ${(start / FPS).toFixed(1)} s`;
      break;
    }
    cuts.push({ start, frames: end - start, actions: r.rotation.slice(prefix.length - 1, j).map((a) => ({ ...a, at: (a.at as number) - start })) });
    prefix = r.rotation.slice(0, j + 1);
    start = end;
    if (cuts.length >= repeats) {
      const last = cuts.slice(-repeats);
      const head = last[0] as (typeof cuts)[number];
      const exact = last.every((c) => sameActions(c.actions, head.actions));
      const alike = last.every((c) => skillOrder(data, c.actions) === skillOrder(data, head.actions)) && apart(last.map((c) => c.frames)) <= tolerance;
      if (exact || alike) {
        found = { first: cuts.length - repeats, exact };
        break;
      }
    }
  }
  if (!found && !reason) reason = `no ${repeats} repetitions in a row agreed in ${maxRepetitions}`;
  // Up to the repetition after the last: its boundary cast starts it and isn't played.
  const end = start;
  const rotation = prefix.slice(0, -1);
  const sim = simulate(data, { ...scenario, durationFrames: end, rotation });
  const landed = (from: number, to: number) => sim.hits.filter((h) => h.frame >= from && h.frame < to).reduce((a, h) => a + h.exact, 0);
  const repetitions: Repetition[] = cuts.map((c) => ({ ...c, damage: landed(c.start, c.start + c.frames) }));
  if (!found) return finish(rotation, end, repetitions, { boundary, ...(reason ? { reason } : {}) });
  const counted = repetitions.slice(found.first);
  const c0 = counted[0] as Repetition;
  const loopFrames = counted.reduce((a, c) => a + c.frames, 0);
  return finish(rotation, end, repetitions, {
    boundary,
    loop: {
      first: found.first,
      exact: found.exact,
      opener: rotation.filter((a) => (a.at as number) < c0.start),
      openerFrames: c0.start,
      openerDamage: landed(0, c0.start),
      actions: c0.actions,
      frames: loopFrames / counted.length,
      dps: counted.reduce((a, c) => a + c.damage, 0) / (loopFrames / FPS),
      lengthApart: apart(counted.map((c) => c.frames)),
      damageApart: apart(counted.map((c) => c.damage / c.frames)),
    },
  });
}
