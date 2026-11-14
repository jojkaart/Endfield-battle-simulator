// Rotations as an opener and a loop (owner, 2026-11-14: "complete rotations, not a fixed 60 s window"): an opener
// from the fight's start to a round of ultimate casts, then a loop from that round to the next that can be played
// again and again for as long as the fight lasts (docs/design.md "Opener and loop").

import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import { randomOutcomes, resourcePrices, searchCritMode, searchRotation, type ResourcePrices, type SearchOptions, type SearchResult } from "./search.ts";
import { advance, apply, createContext, earliestStart, init, simulate, type RotationAction, type TimelineContext, type TimelineScenario, type TimelineState } from "./timeline.ts";
import { SP } from "./timeline/rules.ts";
import { maxEnergy } from "./timeline/resources.ts";
import { FPS } from "./units.ts";

export interface LoopOptions extends SearchOptions {
  /** Length of the fight the opener is searched over, in frames (default the scenario's, at least LOOP_OPENER_FRAMES). */
  readonly horizonFrames?: number;
  /** Replays of the loop, after its first play, that make it a loop (default 3: it's played 4 times). */
  readonly repeats?: number;
  /** How far apart the plays' damage per second may be for them to agree, as a fraction of the highest (default LOOP_TOLERANCE). */
  readonly tolerance?: number;
  /** Rounds (repetitions) searched at most before giving up (default LOOP_MAX_REPETITIONS). */
  readonly maxRepetitions?: number;
  /** How much better a new round's plan must be than replaying the last one to replace it (default LOOP_HYSTERESIS). */
  readonly hysteresis?: number;
  /** Plays of the loop in the result's rotation (default repeats + 1; more are exact replays, checked). */
  readonly plays?: number;
  /** Called after each round (progress): where it starts, its length, whether it replayed the last, its closingScore and the best new plan's. */
  readonly onRound?: (round: { readonly start: number; readonly frames: number; readonly replayed: boolean; readonly score: number; readonly best?: number; readonly stops: number; readonly replayFailure?: string }) => void;
}

/** The opener search's fight length when the scenario's is shorter: 60 s, room for the first round of ultimates from zero energy (a search setting). */
export const LOOP_OPENER_FRAMES = 60 * FPS;
/** The longest repetition looked for: 90 s (the owner's team: rounds of 42–59 s, Akekuri's ultimate back after 60–78 s). */
export const LOOP_MAX_FRAMES = 90 * FPS;
/** How far past a repetition's longest end each round's search looks, so that resources aren't worth nothing near its end: 10 s. */
const LOOKAHEAD_FRAMES = 10 * FPS;
/** Rounds searched at most (the first ones still spend what the opener left over). */
export const LOOP_MAX_REPETITIONS = 12;
/**
 * How far apart the loop's plays' damage per second may be and still agree: 3% (the brief, 2026-11-14: "2–3%"). The
 * actions are the same in every play; the damage isn't held to it as a condition: the enemy's Stagger cycle doesn't
 * follow the loop's, so the Staggered bonus falls in a different play each time (laevatain-solo: 33–39k DPS a play),
 * and LoopResult.loop says whether they agreed.
 */
export const LOOP_TOLERANCE = 0.03;
/** A replay of the last round's plan is kept unless a new plan scores this much better (closingScore): 2% (a search setting). */
export const LOOP_HYSTERESIS = 0.02;
/** What a round's plan that leaves its operators' kit stacks different from where it started is scored at (closingScore): × 0.85 (a search setting). */
export const STACK_MISMATCH = 0.85;

/** One repetition: from a cast of the boundary ultimate to its next. */
export interface Repetition {
  /** Where it starts (the boundary ultimate's cast), its length and the damage landed in its frames. */
  readonly start: number;
  readonly frames: number;
  readonly damage: number;
  /** Its actions, `at` from its start (the first: the boundary ultimate at 0). */
  readonly actions: readonly RotationAction[];
  /** Whether it's the round before it played again (exactly), rather than a newly searched plan. */
  readonly replayed: boolean;
}

/** The opener and the loop (searchLoop). */
export interface LoopResult {
  /** The ultimate whose casts start and end each repetition. */
  readonly boundary?: { readonly operator: string; readonly skill: string };
  /** Every repetition, in order: the rounds searched, then the loop's further plays (LoopOptions.plays). */
  readonly repetitions: readonly Repetition[];
  /**
   * The loop, when one round's plan played `repeats` more times exactly (the same actions at the same times from its
   * start): its plays are repetitions[first …].
   */
  readonly loop?: {
    /** Its first play's index in `repetitions` (the ones before are the opener's). */
    readonly first: number;
    /** Its plays in `repetitions` (repeats + 1, or LoopOptions.plays). */
    readonly plays: number;
    /** The opener: every action before the loop's first play, `at` from the fight's start; its length and damage. */
    readonly opener: readonly RotationAction[];
    readonly openerFrames: number;
    readonly openerDamage: number;
    /** The loop's actions, `at` from its start (the boundary ultimate at 0). */
    readonly actions: readonly RotationAction[];
    /** Its length, its damage per second over all its plays, and how far apart the plays' damage per second are ((max − min) / max). */
    readonly frames: number;
    readonly dps: number;
    readonly damageApart: number;
    /** Whether the plays' damage per second agree within the tolerance. */
    readonly agrees: boolean;
  };
  /**
   * The opener and every repetition, `at` absolute (replays with simulate), to the start of the repetition after the
   * last; its total damage there (simulate) and DPS.
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

/** (max − min) / max. */
function apart(xs: readonly number[]): number {
  const hi = Math.max(...xs);
  return hi > 0 ? (hi - Math.min(...xs)) / hi : 0;
}

/** Damage landed in [from, to). */
function landedIn(state: TimelineState, from: number, to: number): number {
  let d = 0;
  for (const h of state.hits) if (h.frame >= from && h.frame < to) d += h.exact;
  return d;
}

/** Same kit stacks (every operator's, every kind). */
function sameStacks(a: TimelineState, b: TimelineState): boolean {
  const keys = new Set([...Object.keys(a.stacks), ...Object.keys(b.stacks)]);
  for (const op of keys) {
    const x = a.stacks[op] ?? {};
    const y = b.stacks[op] ?? {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if ((x[k] ?? 0) !== (y[k] ?? 0)) return false;
  }
  return true;
}

/**
 * How well a round from `start` (state `from`, just after the boundary cast) to `end` (just after the next) would do
 * as a loop (docs/design.md "Opener and loop"): its damage per second, where what it takes from the resources it
 * started with is charged — SP it ends with less of as the time SP regeneration takes to make it up, ultimate energy
 * at its probed price (resourcePrices) — and a plan that leaves the kit stacks different (Laevatain's Melting Flame)
 * is scored at STACK_MISMATCH. Plans that leave as much as they found can be played again; plans that spend the
 * opener's leftovers can't, and the damage alone ranks them first.
 */
export function closingScore(team: readonly { readonly operator: string }[], prices: ResourcePrices, from: TimelineState, end: TimelineState, start: number): number {
  const seconds = (end.frame - start) / FPS;
  let damage = landedIn(end, start, end.frame);
  for (const b of team) damage += Math.min(0, (end.energy[b.operator] ?? 0) - (from.energy[b.operator] ?? 0)) * (prices.energy[b.operator] ?? 0);
  const spTime = Math.max(0, from.sp - end.sp) / SP.perSecond;
  return (damage / (seconds + spTime)) * (sameStacks(from, end) ? 1 : STACK_MISMATCH);
}

/**
 * The ultimate the loop is cut at (2026-11-14): the one with the longest recharge in the opener search's rotation.
 * Cast twice or more: the mean time between its casts. Cast once (with full energy at the start, every ultimate is
 * cast at once and few again within the horizon): the time from its last cast to the horizon over the share of its
 * energy back by then (at least 5%). Fewest casts first was the rule before: with full energy that picked an ultimate
 * cast once at 0 and never again within 60 s (Akekuri's), or the fastest when it alone was cast twice (Estella's).
 * Ties: the first the rotation casts.
 */
export function slowestUltimate(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rotation: readonly RotationAction[], horizon: number): { operator: string; skill: string; period: number } | undefined {
  const ctx = createContext(data, { ...scenario, durationFrames: horizon, rotation: [] });
  const end = advance(ctx, rotation.reduce((s, a) => apply(ctx, s, a), init(ctx)), horizon);
  const casts = new Map<string, number[]>();
  for (const a of rotation) if (kindOf(data, a) === "ultimate") casts.set(`${a.operator}\n${a.skill}`, [...(casts.get(`${a.operator}\n${a.skill}`) ?? []), a.at as number]);
  let best: { operator: string; skill: string; period: number } | undefined;
  for (const [key, at] of casts) {
    const [operator, skill] = key.split("\n") as [string, string];
    const last = at.at(-1) as number;
    const share = Math.min(1, (end.energy[operator] ?? 0) / Math.max(1e-9, maxEnergy(ctx, operator)));
    const period = at.length >= 2 ? (last - (at[0] as number)) / (at.length - 1) : (horizon - last) / Math.max(0.05, share);
    if (!best || period > best.period) best = { operator, skill, period };
  }
  return best;
}

/** A loop's actions replayed exactly from a state at `start` (the boundary cast of `actions[0]` included, at `start`), then the next boundary cast at start + frames; the state after it, or why the first action that can't start at its frame can't. */
function replayRound(ctx: TimelineContext, before: TimelineState, actions: readonly RotationAction[], frames: number, start: number): { state: TimelineState; rotation: RotationAction[] } | { failure: string } {
  let s = before;
  const rotation: RotationAction[] = [];
  for (const a of [...actions, { ...(actions[0] as RotationAction), at: frames }]) {
    const at = start + (a.at as number);
    const e = earliestStart(ctx, s, { ...a, at });
    if ("error" in e) return { failure: `${a.skill} at ${a.at}: ${e.error}` };
    if (e.frame !== at) return { failure: `${a.skill} at ${a.at}: ${e.frame - at} frames late` };
    s = apply(ctx, s, { ...a, at });
    rotation.push({ ...a, at });
  }
  return { state: s, rotation };
}

/**
 * The opener and the loop (2026-11-14, closing rounds). The boundary: the ultimate the opener search's rotation casts
 * least among those it casts at least twice (else least; the slowest to recharge sets the loop's length); the opener
 * ends at its first cast. Then round after round from where the last ended, each a choice between the rounds the
 * beam search finds from there to the boundary's next cast (SearchHooks.stopAt: every one it reaches within
 * LOOP_MAX_FRAMES) and the last round's plan replayed exactly, by closingScore (damage per second with what it takes
 * from the resources it found charged), the replay kept unless a new plan beats it by `hysteresis`. A plan played
 * `repeats` more times in a row is the loop; the rounds before it are the opener's. Its further plays (`plays`) are
 * exact replays too. Deterministic; the whole replays with `simulate`.
 */
export function searchLoop(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: LoopOptions = {}): LoopResult {
  const { horizonFrames, repeats = 3, tolerance = LOOP_TOLERANCE, maxRepetitions = LOOP_MAX_REPETITIONS, hysteresis = LOOP_HYSTERESIS, plays: wanted, onRound, ...search } = options;
  if (!Number.isInteger(repeats) || repeats < 1) throw new EngineError(`repeats must be a whole number ≥ 1, not ${repeats}`);
  if (!Number.isInteger(maxRepetitions) || maxRepetitions < repeats + 1) throw new EngineError(`maxRepetitions must be a whole number ≥ repeats + 1 (${repeats + 1}), not ${maxRepetitions}`);
  const plays = wanted ?? repeats + 1;
  if (!Number.isInteger(plays) || plays < 1) throw new EngineError(`plays must be a whole number ≥ 1, not ${plays}`);
  // A loop is the same actions replayed exactly: with random outcomes a play that holds in one battle may not in another.
  const random = randomOutcomes(data, scenario);
  if (random.length > 0 || searchCritMode(data, scenario) !== scenario.options.crit) throw new EngineError(`a loop is searched for fights without random outcomes; this one has ${random.join(", ")}`);
  const horizon = horizonFrames ?? Math.max(scenario.durationFrames, LOOP_OPENER_FRAMES);
  const opener = searchRotation(data, { ...scenario, durationFrames: horizon }, { ...search, runs: 0 });
  const slowest = slowestUltimate(data, scenario, opener.rotation, horizon);
  const result = (rotation: readonly RotationAction[], end: number, repetitions: readonly Repetition[], extra: Partial<LoopResult>): LoopResult => {
    const sim = simulate(data, { ...scenario, durationFrames: end, rotation });
    return { opener, horizonFrames: horizon, repeats, tolerance, repetitions, rotation, frames: end, total: sim.total, dps: end > 0 ? sim.total / (end / FPS) : 0, ...extra };
  };
  if (slowest === undefined) return result(opener.rotation, horizon, [], { reason: "the rotation casts no ultimate" });
  const boundary = { operator: slowest.operator, skill: slowest.skill };
  const { operator: op, skill } = slowest;
  const isBoundary = (a: RotationAction) => a.operator === op && a.skill === skill;
  const prices = resourcePrices(data, { ...scenario, durationFrames: horizon });
  // Rounds: each ends with the next round's boundary cast, which `prefix` keeps as its last action.
  let prefix = opener.rotation.slice(0, opener.rotation.findIndex(isBoundary) + 1);
  const rounds: { start: number; frames: number; actions: RotationAction[]; replayed: boolean }[] = [];
  let streak = 0;
  let reason: string | undefined;
  while (rounds.length < maxRepetitions && streak < repeats) {
    const start = prefix.at(-1)?.at as number;
    const durationFrames = start + LOOP_MAX_FRAMES + LOOKAHEAD_FRAMES;
    const ctx = createContext(data, { ...scenario, durationFrames, rotation: [] });
    const before = prefix.slice(0, -1).reduce((s, a) => apply(ctx, s, a), init(ctx));
    const from = apply(ctx, before, prefix.at(-1) as RotationAction);
    const score = (end: TimelineState) => closingScore(scenario.team, prices, from, end, start);
    const r = searchRotation(data, { ...scenario, durationFrames }, { ...search, runs: 0 }, { prefix, stopAt: isBoundary });
    let best: { rotation: readonly RotationAction[]; score: number } | undefined;
    for (const x of r.stops ?? []) {
      if (x.state.frame - start > LOOP_MAX_FRAMES) continue;
      const s = score(x.state);
      if (!best || s > best.score) best = { rotation: x.rotation, score: s };
    }
    const last = rounds.at(-1);
    const again = last && replayRound(ctx, before, last.actions, last.frames, start);
    const replay = again && "state" in again ? { rotation: [...prefix.slice(0, -1), ...again.rotation], score: score(again.state) } : undefined;
    const chosen = replay && (!best || replay.score >= best.score * (1 - hysteresis)) ? replay : best;
    if (!chosen) {
      reason = `the boundary ultimate isn't cast again within ${LOOP_MAX_FRAMES / FPS} s of ${(start / FPS).toFixed(1)} s`;
      break;
    }
    const end = chosen.rotation.at(-1)?.at as number;
    rounds.push({ start, frames: end - start, actions: chosen.rotation.slice(prefix.length - 1, -1).map((a) => ({ ...a, at: (a.at as number) - start })), replayed: chosen === replay });
    streak = chosen === replay ? streak + 1 : 0;
    prefix = chosen.rotation as RotationAction[];
    onRound?.({ start, frames: end - start, replayed: chosen === replay, score: chosen.score, ...(best ? { best: best.score } : {}), stops: r.stops?.length ?? 0, ...(again && "failure" in again ? { replayFailure: again.failure } : {}) });
  }
  if (streak < repeats && !reason) reason = `no round's plan played ${repeats} more times in a row in ${maxRepetitions} rounds`;
  // The loop's further plays: exact replays (the loop holds, or the result says how far).
  if (streak >= repeats) {
    const last = rounds.at(-1) as (typeof rounds)[number];
    for (let k = repeats + 1; k < plays; k++) {
      const start = prefix.at(-1)?.at as number;
      const ctx = createContext(data, { ...scenario, durationFrames: start + LOOP_MAX_FRAMES + LOOKAHEAD_FRAMES, rotation: [] });
      const before = prefix.slice(0, -1).reduce((s, a) => apply(ctx, s, a), init(ctx));
      const again = replayRound(ctx, before, last.actions, last.frames, start);
      if ("failure" in again) {
        reason = `the loop played ${k} times; play ${k + 1} can't be replayed exactly (${again.failure})`;
        break;
      }
      rounds.push({ ...last, start, replayed: true });
      prefix = [...prefix.slice(0, -1), ...again.rotation];
    }
  }
  // Up to the repetition after the last: its boundary cast starts it and isn't played.
  const end = prefix.at(-1)?.at as number;
  const rotation = prefix.slice(0, -1);
  const sim = simulate(data, { ...scenario, durationFrames: end, rotation });
  const landed = (from: number, to: number) => sim.hits.filter((h) => h.frame >= from && h.frame < to).reduce((a, h) => a + h.exact, 0);
  const repetitions: Repetition[] = rounds.map((c) => ({ ...c, damage: landed(c.start, c.start + c.frames) }));
  if (streak < repeats) return result(rotation, end, repetitions, { boundary, ...(reason ? { reason } : {}) });
  // The loop's plays: the last run of replays and the round they replay.
  let first = repetitions.length - 1;
  while (first > 0 && (repetitions[first] as Repetition).replayed) first--;
  const counted = repetitions.slice(first);
  const c0 = counted[0] as Repetition;
  const loopFrames = counted.reduce((a, c) => a + c.frames, 0);
  const perPlay = counted.map((c) => c.damage / c.frames);
  return result(rotation, end, repetitions, {
    boundary,
    ...(reason ? { reason } : {}),
    loop: {
      first,
      plays: counted.length,
      opener: rotation.filter((a) => (a.at as number) < c0.start),
      openerFrames: c0.start,
      openerDamage: landed(0, c0.start),
      actions: c0.actions,
      frames: c0.frames,
      dps: counted.reduce((a, c) => a + c.damage, 0) / (loopFrames / FPS),
      damageApart: apart(perPlay),
      agrees: apart(perPlay) <= tolerance,
    },
  });
}
