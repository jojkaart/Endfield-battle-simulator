// The stepping API's drivers: init, apply, a logged cast's replay, simulate, and helpers for the search.

import type { Build } from "../build.ts";
import { evalContext } from "../damage.ts";
import { EngineError } from "../errors.ts";
import type { GameData } from "../model.ts";
import { evaluate } from "../expr.ts";
import { NO_STATUS } from "../status.ts";
import { FPS } from "../units.ts";
import type { Cast, LandedHit, PendingEnemyAction, PendingHit, ReactionRecord, RotationAction, TimelineContext, TimelineScenario, TimelineState } from "./state.ts";
import { SP, TIMELINE_ASSUMPTIONS } from "./rules.ts";
import { createContext, enemyActionsOf, kitSkill, maxPoise, panelAt, skillCosts } from "./context.ts";
import { maxEnergy, spAt, spCostAt } from "./resources.ts";
import { earliestStart, needsWindow, startFrom, windowKey, windowOpen } from "./timing.ts";
import { runTriggers } from "./actions.ts";
import { castSkill, jumpToDive } from "./casting.ts";
import { advance } from "./advance.ts";
import { ofCast, ofKind } from "./schedule.ts";

export function init(ctx: TimelineContext): TimelineState {
  const st = initialState(ctx);
  return runTriggers(ctx, st, [{ type: "fightStart", frame: 0, operator: st.controlled }], null);
}

function initialState(ctx: TimelineContext): TimelineState {
  const controlled = ctx.scenario.controlled ?? (ctx.scenario.team[0] as Build).operator;
  if (!ctx.builds.has(controlled)) throw new EngineError(`controlled operator ${controlled} isn't in the team`);
  return {
    frame: 0,
    rng: {},
    sp: SP.start,
    spReturned: 0,
    energy: Object.fromEntries(ctx.scenario.team.map((b) => {
      const v = ctx.scenario.startEnergy?.[b.operator] ?? 0;
      return [b.operator, v === "full" ? maxEnergy(ctx, b.operator) : Math.min(v, maxEnergy(ctx, b.operator))];
    })),
    energyBlockedUntil: {},
    comboWindow: {},
    spPausedUntil: 0,
    spStops: [],
    controlled,
    acting: {},
    chainNext: {},
    readyAt: {},
    // The enemy's actions, in frame order (attacks before charges at one frame), on its clock.
    scheduled: enemyActionsOf(ctx.scenario).map((a): PendingEnemyAction => ({ kind: "enemyAction", frame: a.frame, clock: "enemy", act: a.kind, target: a.target, element: a.element })),
    slowdowns: [],
    stagger: { poise: maxPoise(ctx), until: null, finisherUsed: false },
    enemyFrozenUntil: 0,
    link: [],
    enemy: NO_STATUS,
    buffs: [],
    triggerState: {},
    stacks: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, startStacks(ctx, b)])),
    casts: [],
    hits: [],
    reactions: [],
  };
}

/** An operator's stacks at the start: the scenario's, else the kit's `initial` (0 when absent), within each stack's maximum. */
function startStacks(ctx: TimelineContext, b: Build): Record<string, number> {
  const panel = panelAt(ctx, b.operator, 0);
  const given = ctx.scenario.startStacks?.[b.operator] ?? {};
  const out: Record<string, number> = {};
  for (const x of ctx.kits.get(b.operator)?.stacks ?? []) {
    const v = given[x.id] ?? (x.initial === undefined ? 0 : evaluate(x.initial, evalContext(ctx.data, b, panel, "", { team: ctx.scenario.team })));
    out[x.id] = Math.max(0, Math.min(x.max, v));
  }
  for (const id of Object.keys(given)) if (!(id in out)) throw new EngineError(`startStacks: ${b.operator} has no stack ${id}`);
  return out;
}

/** Applies one rotation action at its earliest legal frame. Throws if it can't happen. */
export function apply(ctx: TimelineContext, state: TimelineState, action: RotationAction): TimelineState {
  const start = earliestStart(ctx, state, action);
  if ("error" in start) throw new EngineError(`frame ${state.frame}: ${action.operator} ${action.skill}: ${start.error}`);
  const advanced = advance(ctx, state, start.frame);
  if (action.skill === "swap") return { ...advanced, controlled: action.operator };
  const dive = ctx.data.operators[action.operator]?.dive;
  if (dive?.end === action.skill) {
    const j = jumpToDive(ctx, advanced, action.operator, dive, start.frame);
    return runTriggers(ctx, j.state, j.events, null);
  }
  const r = castSkill(ctx, advanced, action.operator, action.skill, start.frame, false);
  return runTriggers(ctx, r.state, r.events, r.origin);
}

/**
 * A logged cast replayed (the log checker's kit-buff replay, cli
 * buffreplay.ts): the skill starts at exactly `frame`, where the log places
 * it, without a rotation's checks (cooldowns, combo windows, priorities,
 * energy: the game allowed it). SP below its cost is raised to the cost
 * first, so the team's SP doesn't go negative; a basic attack or a dive
 * makes its operator the controlled one. The rest is a cast as `apply` makes
 * it: its hits, what they do, and the triggers they start.
 */
export function replayCast(ctx: TimelineContext, state: TimelineState, operator: string, skillId: string, frame: number, opts: ReplayCastOptions = {}): TimelineState {
  if (!ctx.builds.has(operator)) throw new EngineError(`${operator} isn't in the team`);
  let advanced = advance(ctx, state, frame);
  const costs = skillCosts(ctx, operator, skillId, frame);
  if (costs.kind === "basic" || costs.timing.specification === 6) advanced = { ...advanced, controlled: operator };
  const cost = spCostAt(ctx, advanced, operator, costs, frame);
  if (advanced.sp < cost) advanced = { ...advanced, sp: cost };
  // A combo the log shows had its window open: one opened by an event the replay didn't see counts 1 (its count isn't logged).
  const skill = kitSkill(ctx, operator, skillId);
  if (costs.kind === "combo" && skill.comboWindow !== false) {
    const key = windowKey(ctx, operator, skillId);
    if (!windowOpen(advanced, operator, key, frame)) advanced = { ...advanced, comboWindow: { ...advanced.comboWindow, [key]: { from: frame, until: frame + 1, count: 1 } } };
  }
  const index = advanced.casts.length;
  const r = castSkill(ctx, advanced, operator, skillId, frame, false, opts.keepPrevious ?? false);
  let st = r.state;
  if (opts.landings?.length) {
    // The cast's own landings of each kit hit, in frame order: the n-th moves to its logged frame.
    const own = new Map<string, PendingHit[]>();
    for (const h of ofKind(st.scheduled, "hit")) if (ofCast(h, operator, index) && !h.trigger && h.skillId === skillId) own.set(h.hitId, [...(own.get(h.hitId) ?? []), h]);
    for (const list of own.values()) list.sort((a, b) => a.frame - b.frame);
    const moved = new Map<PendingHit, { frame: number; ref?: string }>();
    for (const l of opts.landings) {
      const h = own.get(l.hitId)?.[l.nth];
      if (h) moved.set(h, { frame: Math.max(frame, l.frame), ...(l.ref !== undefined ? { ref: l.ref } : {}) });
    }
    // A pinned landing was launched by its logged frame (a detached one's launch, KitHit.launch, is on the kit's timeline, which jumps shorten).
    const pin = (h: PendingHit, m: { frame: number; ref?: string }): PendingHit => ({ ...h, ...m, pinned: true, ...(h.launchAt !== undefined ? { launchAt: Math.min(h.launchAt, m.frame) } : {}) });
    st = { ...st, scheduled: st.scheduled.map((h) => { const m = h.kind === "hit" ? moved.get(h) : undefined; return m && h.kind === "hit" ? pin(h, m) : h; }) };
  }
  return runTriggers(ctx, st, r.events, r.origin);
}

/** How a logged cast is replayed (replayCast). */
export interface ReplayCastOptions {
  /** The operator's current skill keeps its hits still to come (the log shows them landing after this cast started). */
  readonly keepPrevious?: boolean;
  /**
   * Landings at their logged frames: the `nth` landing (0: the first, in frame order) of the cast's kit hit `hitId` lands at `frame`;
   * with `ref`, its LandedHit carries the reference and its facts (LandingFacts).
   */
  readonly landings?: readonly { readonly hitId: string; readonly nth: number; readonly frame: number; readonly ref?: string }[];
}

/** The count of the combo window a replayed combo would use at a frame (the state advanced to it), or null when none is open (replayCast then opens one, counting 1). */
export function replayWindowCount(ctx: TimelineContext, state: TimelineState, operator: string, skillId: string, frame: number): number | null {
  const skill = kitSkill(ctx, operator, skillId);
  if (skill.kind !== "combo" || skill.comboWindow === false) return null;
  const key = windowKey(ctx, operator, skillId);
  return windowOpen(state, operator, key, frame) ? (state.comboWindow[key]?.count ?? 1) : null;
}

export interface TimelineResult {
  readonly total: number;
  /** Total damage per second over the time to the last hit. */
  readonly dps: number;
  readonly lastHitFrame: number;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly casts: readonly Cast[];
  readonly hits: readonly LandedHit[];
  readonly reactions: readonly ReactionRecord[];
  readonly assumptions: readonly string[];
}

/** Runs a recorded rotation: the simplest driver on the stepping API. */
export function simulate(data: GameData, scenario: TimelineScenario): TimelineResult {
  const ctx = createContext(data, scenario);
  let state = init(ctx);
  for (const action of scenario.rotation) state = apply(ctx, state, action);
  state = advance(ctx, state, scenario.durationFrames);
  const perOperator: Record<string, number> = Object.fromEntries(scenario.team.map((b) => [b.operator, 0]));
  let total = 0;
  for (const h of state.hits) {
    perOperator[h.operator] = (perOperator[h.operator] ?? 0) + h.exact;
    total += h.exact;
  }
  const lastHitFrame = state.hits.reduce((m, h) => Math.max(m, h.frame), 0);
  const missingFrames = state.hits.some((h) => {
    const s = data.kits.operators[h.operator]?.skills.find((x) => x.skillId === h.skillId);
    return s !== undefined && !s.hits.find((x) => x.id === h.hitId)?.frames;
  });
  return {
    total,
    dps: lastHitFrame > 0 ? total / (lastHitFrame / FPS) : 0,
    lastHitFrame,
    perOperator,
    casts: state.casts,
    hits: state.hits,
    reactions: state.reactions,
    assumptions: [...TIMELINE_ASSUMPTIONS, ...(missingFrames ? ["Some hits have no frames in their kit and land at the skill's start."] : [])],
  };
}

/** How a rotation's total damage varies over battles with rolled crits. */
export interface RunSpread {
  readonly runs: number;
  /** The first run's seed; run i has seed + i. */
  readonly seed: number;
  readonly totals: readonly number[];
  readonly mean: number;
  /** Standard deviation of the totals (over the runs, not an estimate of the population's). */
  readonly sd: number;
  readonly min: number;
  readonly max: number;
  /** Nearest-rank percentiles of the totals. */
  readonly p5: number;
  readonly p50: number;
  readonly p95: number;
}

/** Runs a recorded rotation `runs` times with rolled crits, each with its own seed, for the spread of its damage. */
export function simulateRuns(data: GameData, scenario: TimelineScenario, runs: number, seed = scenario.options.seed ?? 1): RunSpread {
  if (!Number.isInteger(runs) || runs < 1) throw new EngineError(`runs must be a whole number ≥ 1, not ${runs}`);
  const totals = Array.from({ length: runs }, (_, i) => simulate(data, { ...scenario, options: { ...scenario.options, crit: "rolled", seed: (seed + i) >>> 0 } }).total);
  const mean = totals.reduce((a, b) => a + b, 0) / runs;
  const sorted = [...totals].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(p * runs) - 1)] as number;
  return {
    runs, seed, totals, mean,
    sd: Math.sqrt(totals.reduce((a, t) => a + (t - mean) ** 2, 0) / runs),
    min: sorted[0] as number, max: sorted[runs - 1] as number,
    p5: rank(0.05), p50: rank(0.5), p95: rank(0.95),
  };
}

// --- Helpers for search drivers (rotation search, search.ts) -----------------
//
// startsNow: whether an action can start at the state's own frame, i.e.
// earliestStart(…).frame === state.frame, without judging how much later it
// could start. At a decision point at the state's frame a later start isn't
// a choice, and judging it is most of the search's time (earliestStart
// replays the fight to when the current action ends; a combo waits for a
// window). Exact: earliestStart returns startFrom's frame when it's the
// state's own, and otherwise a later frame or an error; startFrom only ever
// moves the frame later, so a cooldown still running, too little SP, or a
// combo whose window isn't open at the state's frame means later.
export function startsNow(ctx: TimelineContext, state: TimelineState, action: RotationAction): boolean {
  if (action.at !== undefined && action.at > state.frame) return false;
  if (action.skill !== "swap" && ctx.builds.has(action.operator)) {
    let costs;
    try {
      costs = skillCosts(ctx, action.operator, action.skill, state.frame);
    } catch (e) {
      // As startFrom: an action that isn't one of the operator's skills can't start; anything else is a bug.
      if (!(e instanceof EngineError)) throw e;
      return false;
    }
    if ((state.readyAt[action.skill] ?? 0) > state.frame || spAt(state, state.frame) < spCostAt(ctx, state, action.operator, costs, state.frame)) return false;
    const skill = ctx.kits.get(action.operator)?.skills.find((x) => x.skillId === action.skill);
    if (skill && needsWindow(ctx, action.operator, skill) && !windowOpen(advance(ctx, state, state.frame), action.operator, windowKey(ctx, action.operator, action.skill), state.frame)) return false;
  }
  const r = startFrom(ctx, state, action);
  return "frame" in r && r.frame === state.frame;
}
