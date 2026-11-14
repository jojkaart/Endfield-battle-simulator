// Rotations as an opener and a loop (owner, 2026-11-14: "complete rotations, not a fixed 60 s window"): an opener
// from the fight's start to a round of ultimate casts, then a loop from that round to the next that can be played
// again and again for as long as the fight lasts (docs/design.md "Opener and loop").

import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import { randomOutcomes, searchCritMode, searchRotation, type SearchHooks, type SearchOptions, type SearchResult } from "./search.ts";
import { advance, apply, createContext, earliestStart, init, simulate, skillAvailable, type RotationAction, type TimelineContext, type TimelineScenario, type TimelineState } from "./timeline.ts";
import { skillCosts } from "./timeline/context.ts";
import { SP } from "./timeline/rules.ts";
import { maxEnergy } from "./timeline/resources.ts";
import { FPS } from "./units.ts";

export interface LoopOptions extends SearchOptions {
  /** Length of the fight the opener is searched over, in frames (default the scenario's, at least LOOP_OPENER_FRAMES; with `sync`, LOOP_SYNC_MAX_FRAMES and 10 s). */
  readonly horizonFrames?: number;
  /** Replays of the loop, after its first play, that make it a loop (default 3: it's played 4 times). */
  readonly repeats?: number;
  /** How far apart the plays' damage per second may be for them to agree, as a fraction of the highest (default LOOP_TOLERANCE). */
  readonly tolerance?: number;
  /** Rounds (repetitions) searched at most before giving up (default LOOP_MAX_REPETITIONS). */
  readonly maxRepetitions?: number;
  /** How much better a new round's plan must be than replaying the last one to replace it (default LOOP_HYSTERESIS). */
  readonly hysteresis?: number;
  /**
   * How far below the best new plan the plans a round chooses between by two plays (itself, then itself again from
   * where it ends) may score (default LOOP_CLOSING_MARGIN; 0: the best plan alone, played once).
   */
  readonly closingMargin?: number;
  /** Whether a round that can't be replayed exactly is also offered with its late actions moved later (default true). */
  readonly shifts?: boolean;
  /**
   * Synchronized burst rounds (2026-11-14): each round runs from a moment every operator's ultimate is ready to the
   * first step after which every one is ready again, each cast at least once in between (leadUltimates,
   * ultimatesUnready), instead of from one cast of the slowest ultimate to its next. The opener runs from the fight's
   * start to the first such moment. Default false.
   */
  readonly sync?: boolean;
  /** Plays of the loop in the result's rotation (default repeats + 1; more are exact replays, checked). */
  readonly plays?: number;
  /** Called after each round (progress): where it starts, its length, whether it replayed the last, its closingScore and the best new plan's. */
  readonly onRound?: (round: { readonly start: number; readonly frames: number; readonly replayed: boolean; readonly shifted: number; readonly score: number; readonly best?: number; readonly stops: number; readonly closes: "exactly" | "shifted" | "no"; readonly closingFailure?: string; readonly replayFailure?: string }) => void;
}

/** The opener search's fight length when the scenario's is shorter: 60 s, room for the first round of ultimates from zero energy (a search setting). */
export const LOOP_OPENER_FRAMES = 60 * FPS;
/** The longest repetition looked for: 90 s (the owner's team: rounds of 42–59 s, Akekuri's ultimate back after 60–78 s). */
export const LOOP_MAX_FRAMES = 90 * FPS;
/**
 * The longest synchronized round looked for (`sync`): 120 s. Every bar must refill after one cast each, and the team's
 * energy comes mostly from the SP it spends: the owner's team from zero energy took 98 s for Si's (2026-11-14).
 */
export const LOOP_SYNC_MAX_FRAMES = 120 * FPS;
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
/** The new plans a round chooses between by two plays (itself and itself again) score within 5% of the best (a search setting). */
export const LOOP_CLOSING_MARGIN = 0.05;
/** How many of a round's best plans are played twice for that. */
const LOOP_CLOSING_CANDIDATES = 8;
/** What a round's plan that leaves its operators' kit stacks different from where it started is scored at (closingScore): × 0.85 (a search setting). */
export const STACK_MISMATCH = 0.85;

/** One repetition: from a cast of the boundary ultimate to its next (with `sync`: from a moment every ultimate is ready to the next). */
export interface Repetition {
  /** Where it starts (the boundary ultimate's cast; with `sync`, the step after which every ultimate was ready), its length and the damage landed in its frames. */
  readonly start: number;
  readonly frames: number;
  readonly damage: number;
  /**
   * Its actions, `at` from its start (the first: the boundary ultimate at 0; with `sync`, the last is the step after
   * which every ultimate is ready again, at `frames`).
   */
  readonly actions: readonly RotationAction[];
  /** Whether it's the round before it played again (exactly), rather than a newly searched plan. */
  readonly replayed: boolean;
  /** When it's the round before it played with late actions moved later (LoopOptions.shifts): by how many frames it ended later. */
  readonly shifted?: number;
  /** Ultimate energy lost to full bars in its frames, and the part lost while held (EnergyLost). */
  readonly energyLost: EnergyLost;
}

/** The opener and the loop (searchLoop). */
export interface LoopResult {
  /** The ultimate whose casts start and end each repetition (not with `sync`). */
  readonly boundary?: { readonly operator: string; readonly skill: string };
  /** With `sync`: per operator, the ultimates whose readiness starts and ends each repetition (leadUltimates), and its full bar. */
  readonly ultimates?: readonly { readonly operator: string; readonly skills: readonly string[]; readonly bar: number }[];
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
    /** Ultimate energy lost to full bars, a play on average (Repetition.energyLost). */
    readonly energyLost: EnergyLost;
  };
  /**
   * The opener and every repetition, `at` absolute (replays with simulate), to the start of the repetition after the
   * last; its total damage there (simulate) and DPS.
   */
  readonly rotation: readonly RotationAction[];
  readonly frames: number;
  readonly total: number;
  readonly dps: number;
  /** The opener search over the horizon (with `sync`: to the first moment every ultimate is ready; none when they are at the start). */
  readonly opener?: SearchResult;
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
 * as a loop (docs/design.md "Opener and loop"): its damage per second, with what it takes from the resources it found
 * charged as the time their regeneration needs to make it up — SP at SP.perSecond, each operator's ultimate energy at
 * `energyPerSecond` (energyRates) — the longest of them (they come back side by side), and × STACK_MISMATCH for a
 * plan that leaves the kit stacks different (Laevatain's Melting Flame). A surplus isn't credited: in a loop played
 * on, it caps and is lost. Plans that leave as much as they found can be played again; plans that spend the opener's
 * leftovers can't, and their damage alone ranks them first.
 */
export function closingScore(energyPerSecond: Readonly<Record<string, number>>, from: TimelineState, end: TimelineState, start: number): number {
  const seconds = (end.frame - start) / FPS;
  let extra = Math.max(0, from.sp - end.sp) / SP.perSecond;
  for (const [op, rate] of Object.entries(energyPerSecond)) if (rate > 0) extra = Math.max(extra, Math.max(0, (from.energy[op] ?? 0) - (end.energy[op] ?? 0)) / rate);
  return (landedIn(end, start, end.frame) / (seconds + extra)) * (sameStacks(from, end) ? 1 : STACK_MISMATCH);
}

/**
 * Per operator whose ultimate the rotation casts: the energy its bar gains per second, its full bar over its
 * ultimate's recharge (ultimatePeriods; the slowest of its ultimates).
 */
export function energyRates(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rotation: readonly RotationAction[], horizon: number): Record<string, number> {
  const ctx = createContext(data, { ...scenario, durationFrames: horizon, rotation: [] });
  const out: Record<string, number> = {};
  for (const p of ultimatePeriods(data, scenario, rotation, horizon)) out[p.operator] = Math.min(out[p.operator] ?? Infinity, maxEnergy(ctx, p.operator) / (p.period / FPS));
  return out;
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
  let best: { operator: string; skill: string; period: number } | undefined;
  for (const p of ultimatePeriods(data, scenario, rotation, horizon)) if (!best || p.period > best.period) best = p;
  return best;
}

/** Each ultimate the rotation casts, with its recharge in frames as slowestUltimate estimates it, in the order first cast. */
export function ultimatePeriods(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rotation: readonly RotationAction[], horizon: number): { operator: string; skill: string; period: number }[] {
  const ctx = createContext(data, { ...scenario, durationFrames: horizon, rotation: [] });
  const end = advance(ctx, rotation.reduce((s, a) => apply(ctx, s, a), init(ctx)), horizon);
  const casts = new Map<string, number[]>();
  for (const a of rotation) if (kindOf(data, a) === "ultimate") casts.set(`${a.operator}\n${a.skill}`, [...(casts.get(`${a.operator}\n${a.skill}`) ?? []), a.at as number]);
  return [...casts].map(([key, at]) => {
    const [operator, skill] = key.split("\n") as [string, string];
    const last = at.at(-1) as number;
    const share = Math.min(1, (end.energy[operator] ?? 0) / Math.max(1e-9, maxEnergy(ctx, operator)));
    return { operator, skill, period: at.length >= 2 ? (last - (at[0] as number)) / (at.length - 1) : (horizon - last) / Math.max(0.05, share) };
  });
}


/** How long an action of a round played again may wait for the energy or SP it needs, moved later: 20 s (a search setting), in steps of 10 frames. */
const LOOP_WAIT_FRAMES = 20 * FPS;
const WAIT_STEP = 10;

/**
 * A round's plays (`at` from its start; with a boundary ultimate, its actions and then the next boundary cast)
 * replayed from a state at `start`: exactly, or with `shift`, each action that can't start at its frame as soon as it
 * can (waiting for energy or SP it lacks) and everything after it that much later (so what follows keeps its
 * spacing); then `ends` judges the state after the last (why it can't end a round, or nothing). The state after it and
 * how much later it ended (0: exact), or why the first action that can't start (at its frame) can't.
 */
function replayRound(ctx: TimelineContext, before: TimelineState, plays: readonly RotationAction[], start: number, shift = false, ends?: (s: TimelineState) => string | undefined): { state: TimelineState; rotation: RotationAction[]; shifted: number } | { failure: string } {
  let s = before;
  let shifted = 0;
  const rotation: RotationAction[] = [];
  for (const planned of plays) {
    let a = planned;
    const at = start + (a.at as number) + shifted;
    let e = earliestStart(ctx, s, { ...a, at });
    if (shift && "error" in e && kindOf(ctx.data, a) === "basic") {
      // Moved later, a basic attack whose chain step isn't there: the step that is (a finisher on an enemy not Staggered: dropped).
      if (ctx.data.skills[a.skill]?.timing?.specification === 8) continue;
      for (const sk of ctx.data.kits.operators[a.operator]?.skills ?? []) {
        if (sk.kind !== "basic" || ctx.data.skills[sk.skillId]?.timing?.specification === 8) continue;
        const alt = earliestStart(ctx, s, { operator: a.operator, skill: sk.skillId, at });
        if (!("error" in alt) && ("error" in e || alt.frame < e.frame)) {
          e = alt;
          a = { ...a, skill: sk.skillId };
        }
      }
    }
    // Moved later, an action that can't start yet (energy or SP it lacks, a combo window still to open) waits, up to LOOP_WAIT_FRAMES.
    for (let wait = WAIT_STEP; shift && "error" in e && wait <= LOOP_WAIT_FRAMES; wait += WAIT_STEP) {
      const later = earliestStart(ctx, s, { ...a, at: at + wait });
      if (!("error" in later)) e = later;
    }
    // Moved later, a combo whose window doesn't open within the wait is dropped (a player casts it when it's there).
    if (shift && "error" in e && kindOf(ctx.data, a) === "combo") continue;
    if ("error" in e) return { failure: `${a.skill} at ${a.at}: ${e.error}` };
    if (e.frame !== at && !shift) return { failure: `${a.skill} at ${a.at}: ${e.frame - at} frames late` };
    shifted += e.frame - at;
    s = apply(ctx, s, { ...a, at: e.frame });
    rotation.push({ ...a, at: e.frame });
  }
  const unready = ends?.(s);
  if (unready !== undefined) return { failure: unready };
  return { state: s, rotation, shifted };
}

/**
 * Per operator with an ultimate, the ultimates that lead its sequence (2026-11-14, sync rounds): castable from a
 * rotation (not a follow-up), costing energy, and available at the fight's start, before any buff. Arcane's sequence 2
 * (castable only while her Gloompurge Arcana lasts, paid by its energy grant) isn't one; her Gloompurger Array is.
 */
export function leadUltimates(ctx: TimelineContext): Map<string, string[]> {
  const s0 = init(ctx);
  const out = new Map<string, string[]>();
  for (const b of ctx.scenario.team) {
    const skills = (ctx.kits.get(b.operator)?.skills ?? []).filter((k) => k.kind === "ultimate" && !k.followUpOnly && skillCosts(ctx, b.operator, k.skillId, 0).energyCost > 0 && skillAvailable(ctx, s0, b.operator, k.skillId, 0));
    if (skills.length > 0) out.set(b.operator, skills.map((k) => k.skillId));
  }
  return out;
}

/**
 * Why an operator's ultimate isn't castable at the state's frame as far as its own state goes — on cooldown, short of
 * energy, not available (Arcane's array or Gloompurge Arcana still up) — or undefined when it is. Whether the operator
 * is free to act then isn't asked: a ready ultimate is held for when it is.
 */
function ultimateUnready(ctx: TimelineContext, state: TimelineState, operator: string, skill: string): string | undefined {
  const cooldown = Math.ceil(state.readyAt[skill] ?? 0);
  if (cooldown > state.frame) return `${skill} on cooldown until frame ${cooldown}`;
  const cost = skillCosts(ctx, operator, skill, 0).energyCost; // energy costs don't change with time
  const energy = state.energy[operator] ?? 0;
  if (energy < cost - 1e-9) return `${skill} needs ${Number(cost.toFixed(1))} energy, ${energy.toFixed(1)}`;
  if (!skillAvailable(ctx, state, operator, skill, state.frame)) return `${skill} isn't available`;
  return undefined;
}

/** Why not every operator's ultimate is ready at the state's frame (one of each operator's lead ultimates: ultimateUnready), or undefined when they all are. */
export function ultimatesUnready(ctx: TimelineContext, leads: ReadonlyMap<string, readonly string[]>, state: TimelineState): string | undefined {
  for (const [op, skills] of leads) {
    const why = skills.map((k) => ultimateUnready(ctx, state, op, k));
    if (why.every((w) => w !== undefined)) return `not every ultimate is ready at frame ${state.frame}: ${why[0]}`;
  }
  return undefined;
}

/** Whether the actions cast a lead ultimate of every operator. */
function castsEach(leads: ReadonlyMap<string, readonly string[]>, actions: readonly RotationAction[]): boolean {
  for (const [op, skills] of leads) if (!actions.some((a) => a.operator === op && skills.includes(a.skill))) return false;
  return true;
}

/**
 * The opener and the loop (2026-11-14, closing rounds; docs/design.md "Opener and loop"). Rounds are cut at a boundary:
 * by default the ultimate with the longest recharge in the opener search's rotation (slowestUltimate), each round from
 * one of its casts to the next, the opener to its first; with `sync`, the moments every operator's ultimate is ready
 * (ultimatesUnready), each round from one to the first step after which every one is ready again, having been cast at
 * least once (faster ultimates held for the slowest, as players do for a burst window), the opener to the first. Then
 * round after round from where the last ended, by closingScore (damage per second with what it takes from the
 * resources it found charged as recharge time): a new plan from the beam search to the round's end
 * (SearchHooks.stopAt), of those within `closingMargin` of the best the one that does best over two plays (itself,
 * then itself again from its end); the last round replayed exactly, kept unless a new plan beats it by `hysteresis`;
 * or, when it can't be, the last round moved later (`shifts`). A plan replayed `repeats` times in a row is the loop;
 * the rounds before it are the opener's. Its further plays (`plays`) are exact replays too. Deterministic; the whole
 * replays with `simulate`.
 */
export function searchLoop(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: LoopOptions = {}): LoopResult {
  const { horizonFrames, repeats = 3, tolerance = LOOP_TOLERANCE, maxRepetitions = LOOP_MAX_REPETITIONS, hysteresis = LOOP_HYSTERESIS, shifts = true, closingMargin = LOOP_CLOSING_MARGIN, sync = false, plays: wanted, onRound, ...search } = options;
  if (!Number.isInteger(repeats) || repeats < 1) throw new EngineError(`repeats must be a whole number ≥ 1, not ${repeats}`);
  if (!Number.isInteger(maxRepetitions) || maxRepetitions < repeats + 1) throw new EngineError(`maxRepetitions must be a whole number ≥ repeats + 1 (${repeats + 1}), not ${maxRepetitions}`);
  const plays = wanted ?? repeats + 1;
  if (!Number.isInteger(plays) || plays < 1) throw new EngineError(`plays must be a whole number ≥ 1, not ${plays}`);
  // A loop is the same actions replayed exactly: with random outcomes a play that holds in one battle may not in another.
  const random = randomOutcomes(data, scenario);
  if (random.length > 0 || searchCritMode(data, scenario) !== scenario.options.crit) throw new EngineError(`a loop is searched for fights without random outcomes; this one has ${random.join(", ")}`);
  const maxFrames = sync ? LOOP_SYNC_MAX_FRAMES : LOOP_MAX_FRAMES;
  let opener: SearchResult | undefined;
  let horizon = 0;
  const result = (rotation: readonly RotationAction[], end: number, repetitions: readonly Repetition[], extra: Partial<LoopResult>): LoopResult => {
    const sim = simulate(data, { ...scenario, durationFrames: end, rotation });
    return { ...(opener ? { opener } : {}), horizonFrames: horizon, repeats, tolerance, repetitions, rotation, frames: end, total: sim.total, dps: end > 0 ? sim.total / (end / FPS) : 0, ...extra };
  };

  // The boundary. `replays`: how many of the rotation's last actions a round plays again (the boundary cast its
  // predecessor ended with, which starts it; with `sync` none: a round starts after the step that ended the last).
  // `stopAt`: where a round from the rotation so far (`prefix`) ends; `ends`: why a replayed round can't end one.
  let prefix: RotationAction[];
  let rates: Record<string, number> = {};
  let replays: 0 | 1;
  let stopAt: (prefix: readonly RotationAction[], ctx: TimelineContext) => NonNullable<SearchHooks["stopAt"]>;
  let allow: ((prefix: readonly RotationAction[]) => SearchHooks["allow"]) | undefined;
  let ends: (ctx: TimelineContext) => ((s: TimelineState) => string | undefined) | undefined;
  let cut: Partial<LoopResult>;
  if (sync) {
    horizon = horizonFrames ?? maxFrames + LOOKAHEAD_FRAMES;
    const octx = createContext(data, { ...scenario, durationFrames: horizon, rotation: [] });
    const leads = leadUltimates(octx);
    if (leads.size === 0) return result([], 0, [], { reason: "no operator has an ultimate" });
    cut = { ultimates: [...leads].map(([operator, skills]) => ({ operator, skills, bar: maxEnergy(octx, operator) })) };
    replays = 0;
    // Energy is full at both ends of a round (every ultimate ready): closingScore charges none, only SP.
    stopAt = (before, ctx) => (_step, state, rotation) => castsEach(leads, rotation.slice(before.length)) && ultimatesUnready(ctx, leads, state) === undefined;
    // Each lead ultimate once a round, then held: a beam ranked by damage casts an ultimate the moment it's ready, and
    // its lines would rarely meet a moment every one is (si-laevatain: no round found at all).
    const isLead = (a: RotationAction) => leads.get(a.operator)?.includes(a.skill) ?? false;
    allow = (before) => (action, rotation) => !isLead(action) || !rotation.slice(before.length).some((a) => a.operator === action.operator && isLead(a));
    ends = (ctx) => (s) => ultimatesUnready(ctx, leads, s);
    if (ultimatesUnready(octx, leads, init(octx)) === undefined) prefix = [];
    else {
      // The opener: to the first moment every ultimate is ready, the stop with the most damage landed a second.
      // No lead ultimate in it (the build-up): cast, it would have to be back before the slowest is ready.
      opener = searchRotation(data, { ...scenario, durationFrames: horizon }, { ...search, runs: 0 }, { stopAt: (_step, state) => ultimatesUnready(octx, leads, state) === undefined, allow: (action) => !isLead(action) });
      let best: { rotation: readonly RotationAction[]; dps: number } | undefined;
      for (const x of opener.stops ?? []) {
        if (x.state.frame > maxFrames) continue;
        const dps = landedIn(x.state, 0, x.state.frame) / Math.max(1, x.state.frame);
        if (!best || dps > best.dps) best = { rotation: x.rotation, dps };
      }
      if (!best) return result(opener.rotation, horizon, [], { ...cut, reason: `not every ultimate is ready within ${maxFrames / FPS} s of the fight's start` });
      prefix = [...best.rotation];
    }
  } else {
    horizon = horizonFrames ?? Math.max(scenario.durationFrames, LOOP_OPENER_FRAMES);
    opener = searchRotation(data, { ...scenario, durationFrames: horizon }, { ...search, runs: 0 });
    const slowest = slowestUltimate(data, scenario, opener.rotation, horizon);
    if (slowest === undefined) return result(opener.rotation, horizon, [], { reason: "the rotation casts no ultimate" });
    const { operator: op, skill } = slowest;
    cut = { boundary: { operator: op, skill } };
    const isBoundary = (a: RotationAction) => a.operator === op && a.skill === skill;
    rates = energyRates(data, scenario, opener.rotation, horizon);
    replays = 1;
    stopAt = () => (step) => isBoundary(step);
    ends = () => undefined;
    // Rounds: each ends with the next round's boundary cast, which `prefix` keeps as its last action.
    prefix = opener.rotation.slice(0, opener.rotation.findIndex(isBoundary) + 1);
  }
  /** A round's plays: its actions, then (with a boundary ultimate) the next boundary cast. */
  const playsOf = (actions: readonly RotationAction[], frames: number): readonly RotationAction[] => (replays ? [...actions, { ...(actions[0] as RotationAction), at: frames }] : actions);
  const startOf = (rotation: readonly RotationAction[]) => (rotation.at(-1)?.at as number | undefined) ?? 0;
  const kept = (rotation: readonly RotationAction[]) => rotation.slice(0, rotation.length - replays);
  const rel = (a: RotationAction, start: number): RotationAction => ({ ...a, at: (a.at as number) - start });

  const rounds: { start: number; frames: number; actions: RotationAction[]; replayed: boolean; shifted?: number }[] = [];
  let streak = 0;
  let reason: string | undefined;
  while (rounds.length < maxRepetitions && streak < repeats) {
    const start = startOf(prefix);
    const durationFrames = start + maxFrames + LOOKAHEAD_FRAMES;
    const ctx = createContext(data, { ...scenario, durationFrames, rotation: [] });
    // `before`: where a replay of a round starts (before the boundary cast that starts it); `from`: where the round starts.
    const before = kept(prefix).reduce((s, a) => apply(ctx, s, a), init(ctx));
    const from = replays ? apply(ctx, before, prefix.at(-1) as RotationAction) : before;
    const score = (end: TimelineState) => closingScore(rates, from, end, start);
    const allowed = allow?.(prefix);
    const r = searchRotation(data, { ...scenario, durationFrames }, { ...search, runs: 0 }, { prefix, stopAt: stopAt(prefix, ctx), hitsFrom: start, ...(allowed ? { allow: allowed } : {}) });
    // Stable sort: ties keep the order the search found them in.
    const ranked = (r.stops ?? []).filter((x) => x.state.frame - start <= maxFrames).map((x) => ({ rotation: x.rotation, score: score(x.state) })).sort((x, y) => y.score - x.score);
    let best: { rotation: readonly RotationAction[]; score: number } | undefined = ranked[0];
    // Of the best plans (within `closingMargin` of the best), the one that does best over two plays: itself and itself
    // again from where it ends (exactly, or with late actions moved later); one whose second play can't be played isn't
    // taken. A plan tuned to where it starts rarely survives its own end; one that does tends to repeat.
    let closes = 0;
    let closingFailure: string | undefined;
    if (best && closingMargin > 0) {
      const long = createContext(data, { ...scenario, durationFrames: start + 2 * maxFrames + LOOKAHEAD_FRAMES, rotation: [] });
      const at0 = kept(prefix).reduce((s, a) => apply(long, s, a), init(long));
      let two: { c: (typeof ranked)[number]; score: number; shifted: number } | undefined;
      // Plans that differ only in their basic attacks mostly fail alike: one of each set of skills at their frames.
      const tried = new Set<string>();
      for (const c of ranked) {
        if (c.score < (ranked[0] as (typeof ranked)[number]).score * (1 - closingMargin) || tried.size >= LOOP_CLOSING_CANDIDATES) break;
        // The round as played (from the boundary cast that starts it, with a boundary ultimate), ending where the next starts.
        const plan = c.rotation.slice(prefix.length - replays);
        const skills = plan.filter((a) => kindOf(data, a) !== "basic").map((a) => `${a.skill}@${a.at}`).join(",");
        if (tried.has(skills)) continue;
        tried.add(skills);
        const end = plan.at(-1)?.at as number;
        const atEnd = kept(plan).reduce((s, a) => apply(long, s, a), at0);
        const fromEnd = replays ? apply(long, atEnd, plan.at(-1) as RotationAction) : atEnd;
        const again = replayRound(long, atEnd, playsOf(kept(plan).map((a) => rel(a, start)), end - start), end, shifts, ends(long));
        if (!("state" in again)) {
          closingFailure ??= again.failure;
          continue;
        }
        const second = closingScore(rates, fromEnd, again.state, end);
        const both = (c.score + second) / 2;
        if (!two || both > two.score) two = { c, score: both, shifted: again.shifted };
      }
      if (two) {
        closes = two.shifted === 0 ? 1 : 2;
        best = two.c;
      }
    }
    const last = rounds.at(-1);
    const exact = last && replayRound(ctx, before, playsOf(last.actions, last.frames), start, false, ends(ctx));
    // Not exactly: the last plan with its late actions (and what follows) moved later, a plan of its own that may then repeat.
    const again = exact && "failure" in exact && shifts ? replayRound(ctx, before, playsOf(last.actions, last.frames), start, true, ends(ctx)) : exact;
    const replay = again && "state" in again ? { rotation: [...kept(prefix), ...again.rotation], score: score(again.state) } : undefined;
    const chosen = replay && (!best || replay.score >= best.score * (1 - hysteresis)) ? replay : best;
    if (!chosen) {
      reason = sync ? `no round from ${(start / FPS).toFixed(1)} s casts every ultimate and has every one ready again within ${maxFrames / FPS} s` : `the boundary ultimate isn't cast again within ${maxFrames / FPS} s of ${(start / FPS).toFixed(1)} s`;
      break;
    }
    const end = startOf(chosen.rotation);
    const replayed = chosen === replay && again !== undefined && "state" in again && again.shifted === 0;
    const shifted = chosen === replay && again !== undefined && "state" in again && again.shifted > 0 ? again.shifted : 0;
    rounds.push({ start, frames: end - start, actions: kept(chosen.rotation.slice(prefix.length - replays)).map((a) => rel(a, start)), replayed, ...(shifted ? { shifted } : {}) });
    streak = replayed ? streak + 1 : 0;
    prefix = [...chosen.rotation];
    onRound?.({ start, frames: end - start, replayed, shifted, score: chosen.score, ...(best ? { best: best.score } : {}), stops: r.stops?.length ?? 0, ...(closes === 0 && closingFailure ? { closingFailure } : {}), closes: chosen === best ? (closes === 1 ? "exactly" : closes === 2 ? "shifted" : "no") : "no", ...(exact && "failure" in exact ? { replayFailure: exact.failure } : {}) });
  }
  if (streak < repeats && !reason) reason = `no round's plan played ${repeats} more times in a row in ${maxRepetitions} rounds`;
  // The loop's further plays: exact replays (the loop holds, or the result says how far).
  if (streak >= repeats) {
    const last = rounds.at(-1) as (typeof rounds)[number];
    for (let k = repeats + 1; k < plays; k++) {
      const start = startOf(prefix);
      const ctx = createContext(data, { ...scenario, durationFrames: start + maxFrames + LOOKAHEAD_FRAMES, rotation: [] });
      const before = kept(prefix).reduce((s, a) => apply(ctx, s, a), init(ctx));
      const again = replayRound(ctx, before, playsOf(last.actions, last.frames), start, false, ends(ctx));
      if ("failure" in again) {
        reason = `the loop played ${k} times; play ${k + 1} can't be replayed exactly (${again.failure})`;
        break;
      }
      rounds.push({ ...last, start, replayed: true });
      prefix = [...kept(prefix), ...again.rotation];
    }
  }
  // Up to the repetition after the last: with a boundary ultimate its cast starts it and isn't played.
  const end = startOf(prefix);
  const rotation = kept(prefix);
  const sim = simulate(data, { ...scenario, durationFrames: end, rotation });
  const landed = (from: number, to: number) => sim.hits.filter((h) => h.frame >= from && h.frame < to).reduce((a, h) => a + h.exact, 0);
  const lost = energyLostIn(data, scenario, rotation, [...rounds.map((c) => c.start), end]);
  const repetitions: Repetition[] = rounds.map((c, i) => ({ ...c, damage: landed(c.start, c.start + c.frames), energyLost: lost[i] ?? { lost: {}, held: {} } }));
  if (streak < repeats) return result(rotation, end, repetitions, { ...cut, ...(reason ? { reason } : {}) });
  // The loop's plays: the last run of replays and the round they replay.
  let first = repetitions.length - 1;
  while (first > 0 && (repetitions[first] as Repetition).replayed) first--;
  const counted = repetitions.slice(first);
  const c0 = counted[0] as Repetition;
  const loopFrames = counted.reduce((a, c) => a + c.frames, 0);
  const perPlay = counted.map((c) => c.damage / c.frames);
  return result(rotation, end, repetitions, {
    ...cut,
    ...(reason ? { reason } : {}),
    loop: {
      first,
      plays: counted.length,
      // Every action before the loop's first play (one may share its first frame).
      opener: rotation.slice(0, rotation.length - counted.reduce((a, c) => a + c.actions.length, 0)),
      openerFrames: c0.start,
      openerDamage: landed(0, c0.start),
      actions: c0.actions,
      frames: c0.frames,
      dps: counted.reduce((a, c) => a + c.damage, 0) / (loopFrames / FPS),
      damageApart: apart(perPlay),
      agrees: apart(perPlay) <= tolerance,
      energyLost: meanLost(counted.map((c) => c.energyLost)),
    },
  });
}

/** Ultimate energy lost to full bars (TimelineState.energyOverflow), per operator (those that lost none left out). */
export interface EnergyLost {
  /** All of it. */
  readonly lost: Readonly<Record<string, number>>;
  /**
   * The part lost while one of the operator's lead ultimates was ready (leadUltimates): held, not cast. The rest is
   * lost to a grant that crosses the cap, or within a sequence (Arcane's Gloompurge Arcana: its full grant on a bar
   * not yet empty).
   */
  readonly held: Readonly<Record<string, number>>;
}

/**
 * Per stretch between consecutive frames of `bounds`: the ultimate energy each operator lost to a full bar in it
 * (EnergyLost), the rotation replayed with the actions before each bound in the stretch before it. A step's loss counts
 * as held when the operator's lead ultimate was ready at the state before it (stepped action by action: a loss within
 * a step that started below the cap isn't held).
 */
export function energyLostIn(data: GameData, scenario: Omit<TimelineScenario, "rotation">, rotation: readonly RotationAction[], bounds: readonly number[]): EnergyLost[] {
  const ctx = createContext(data, { ...scenario, durationFrames: Math.max(0, ...bounds), rotation: [] });
  const leads = leadUltimates(ctx);
  const out = bounds.slice(1).map(() => ({ lost: {} as Record<string, number>, held: {} as Record<string, number> }));
  let s = init(ctx);
  let k = -1; // the stretch now: before bounds[0], none
  const step = (next: TimelineState) => {
    const into = out[k];
    if (into) {
      for (const [op, v] of Object.entries(next.energyOverflow)) {
        const d = v - (s.energyOverflow[op] ?? 0);
        if (d <= 1e-9) continue;
        into.lost[op] = (into.lost[op] ?? 0) + d;
        if ((leads.get(op) ?? []).some((skill) => ultimateUnready(ctx, s, op, skill) === undefined)) into.held[op] = (into.held[op] ?? 0) + d;
      }
    }
    s = next;
  };
  let i = 0;
  for (const b of bounds) {
    while (i < rotation.length && ((rotation[i] as RotationAction).at as number) < b) step(apply(ctx, s, rotation[i++] as RotationAction));
    step(advance(ctx, s, Math.max(s.frame, b)));
    k++;
  }
  return out;
}

/** The mean of the plays' EnergyLost, per operator. */
function meanLost(plays: readonly EnergyLost[]): EnergyLost {
  const lost: Record<string, number> = {};
  const held: Record<string, number> = {};
  for (const p of plays) {
    for (const [op, v] of Object.entries(p.lost)) lost[op] = (lost[op] ?? 0) + v / plays.length;
    for (const [op, v] of Object.entries(p.held)) held[op] = (held[op] ?? 0) + v / plays.length;
  }
  return { lost, held };
}
