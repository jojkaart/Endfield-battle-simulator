// Running the fight forward: everything scheduled up to a frame, in the order of docs/design.md (advance).

import type { Build } from "../build.ts";
import { decide, evalContext } from "../damage.ts";
import { EngineError } from "../errors.ts";
import type { BattleEvent } from "../events.ts";
import { type ActiveBuff, buffEndedEvent } from "../buffs.ts";
import { expireStatus, nextTick, tickStatus } from "../status.ts";
import type { Cast, PendingAction, PendingBurst, PendingEnemyAction, PendingEnergy, PendingHit, PendingJump, TimelineContext, TimelineState } from "./state.ts";
import { DIVE, DODGE, SP } from "./rules.ts";
import { panelAt, timingOf } from "./context.ts";
import { shiftOperator, slowDown } from "./clock.ts";
import { gainEnergy, rebaseCooldowns, spAt } from "./resources.ts";
import { actionFrame, counters } from "./timing.ts";
import { situationAt } from "./situation.ts";
import { runActions, runTriggers } from "./actions.ts";
import { asEvents, draw, landBurst, landHit, recordStatus } from "./landing.ts";
import { castSkill, endCurrentSkill, takeJump } from "./casting.ts";
import { ofCast, schedule, unschedule } from "./schedule.ts";

/**
 * The earliest periodic tick of an active buff at or before `frame`. A tick
 * on the buff's end frame happens (before the buff ends): Rossi's 25 s bleed
 * ticking every 1 s from its application logs 26 ticks (zmdlogs-4e5e), as
 * the enemy's statuses tick on their end frame too (status.ts nextTick).
 */
function nextBuffTick(buffs: readonly ActiveBuff[], frame: number): { b: ActiveBuff; frame: number } | null {
  let next: { b: ActiveBuff; frame: number } | null = null;
  for (const b of buffs) {
    const t = b.nextTick;
    if (t !== undefined && t <= frame && t <= b.expiresAt && (next === null || t < next.frame)) next = { b, frame: t };
  }
  return next;
}

/** Whether a buff still has a periodic tick due at or before its end (it ends after that tick). */
function tickDueBeforeEnd(b: ActiveBuff): boolean {
  return b.nextTick !== undefined && b.nextTick <= b.expiresAt;
}

/** Earliest frame at or before `frame` when an active buff ends (one with a tick still due by then waits for it), or null. */
function nextExpiry(buffs: readonly ActiveBuff[], frame: number): number | null {
  let next: number | null = null;
  for (const b of buffs) if (b.expiresAt <= frame && !tickDueBeforeEnd(b) && (next === null || b.expiresAt < next)) next = b.expiresAt;
  return next;
}

/**
 * An enemy action and what it sets off. With dodging on, the controlled
 * operator dashes at an attack on it (not during an ultimate's exclusive
 * frames): perfect with the scenario's chance. A perfect dodge ends its
 * current action, gives SP, slows the world (not cooldowns) while the
 * dodger is exempt, freezes the dodger for its own while, and replaces the
 * attack on it with a perfectDodge event.
 */
function enemyAct(ctx: TimelineContext, state: TimelineState, a: PendingEnemyAction): TimelineState {
  const events = enemyActionEvents(ctx, state, a);
  const dodge = ctx.scenario.options.dodge;
  const op = state.controlled;
  if (!dodge || !events.some((e) => e.type === "attacked" && e.operator === op)) return runTriggers(ctx, state, events, null);
  // createContext checked that dodging has its settings.
  const pd = ctx.data.constants.perfectDodge;
  if (!pd) throw new EngineError("dodging needs the perfect dodge settings (BattleConstants perfectDodge), which the data doesn't have");
  const cur = state.acting[op];
  if (cur) {
    const t = timingOf(ctx, cur.skill);
    if (t.specification === 5 && a.frame < actionFrame(cur, t.exclusiveFrames)) return runTriggers(ctx, state, events, null);
    // Nor in the air (a dive whose landing is still to come; assumed: no dash in mid-air).
    if (state.scheduled.some((j) => j.kind === "jump" && ofCast(j, op, cur.cast) && j.then !== undefined)) return runTriggers(ctx, state, events, null);
  }
  // No dash at an attack the current skill would counter (a kit's `attacked` trigger that jumps this skill from where its playhead is).
  if (cur && counters(ctx, op, cur, a.frame)) return runTriggers(ctx, state, events, null);
  const roll = draw(ctx, state, "dodge");
  if (roll.value >= dodge.chance) return runTriggers(ctx, roll.state, events, null);
  const ended = endCurrentSkill(roll.state, op, a.frame);
  // It's in the cast list as the skill "dodge" (no cast event: nothing listens to the perfect-dodge skill's cast).
  const sp = Math.min(SP.max, spAt(ended.state, a.frame) + pd.sp);
  const cast: Cast = { frame: a.frame, operator: op, skill: DODGE, spAfter: sp, energyAfter: ended.state.energy[op] ?? 0 };
  let st: TimelineState = rebaseCooldowns(ctx, roll.state, { ...ended.state, sp, frame: Math.max(ended.state.frame, a.frame), acting: { ...ended.state.acting, [op]: { skill: DODGE, frame: a.frame, cast: ended.state.casts.length } }, casts: [...ended.state.casts, cast] }, a.frame);
  st = slowDown(ctx, st, op, { ...timingOf(ctx, DODGE), slowdowns: [{ from: 0, scales: pd.slowdown }] }, a.frame);
  st = shiftOperator(st, op, a.frame, Math.round(pd.dodgerSlowdown.reduce((t, x) => t + (1 - x), 0)));
  const others = events.filter((e) => !(e.type === "attacked" && e.operator === op));
  return runTriggers(ctx, st, [...ended.events, { type: "perfectDodge", frame: a.frame, operator: op }, ...others], null);
}

/** The events an enemy action makes: an attack on each operator it hits, or the start of a charge. */
function enemyActionEvents(ctx: TimelineContext, st: TimelineState, a: PendingEnemyAction): BattleEvent[] {
  if (a.act === "charge") return [{ type: "enemyCharge", frame: a.frame, operator: st.controlled }];
  const targets = a.target === "controlled" ? [st.controlled] : a.target === "team" ? ctx.scenario.team.map((b) => b.operator) : [a.target];
  return targets.map((operator) => ({ type: "attacked", frame: a.frame, operator, element: a.element, controlled: operator === st.controlled }));
}

/** Processes every pending hit, status tick and buff expiry up to (and including) a frame, in frame order. */
function advanceFrom(ctx: TimelineContext, state: TimelineState, frame: number): TimelineState {
  if (frame < state.frame) throw new EngineError(`can't go back from frame ${state.frame} to ${frame}`);
  let st = state;
  for (;;) {
    // The next scheduled item of each kind due by the frame (triggers can schedule more while this runs): the earliest,
    // the first scheduled among equals; hits at one frame by operator ID.
    let hit: PendingHit | null = null;
    let due: PendingAction | null = null;
    // Delayed actions after their frame's hits (KitTrigger.afterHits).
    let late: PendingAction | null = null;
    let grant: PendingEnergy | null = null;
    let enemyAction: PendingEnemyAction | null = null;
    let burst: PendingBurst | null = null;
    let jump: PendingJump | null = null;
    for (const x of st.scheduled) {
      if (x.frame > frame) continue;
      switch (x.kind) {
        case "hit":
          if (!hit || x.frame < hit.frame || (x.frame === hit.frame && x.operator < hit.operator)) hit = x;
          break;
        case "action":
          if (x.afterHits) {
            if (!late || x.frame < late.frame) late = x;
          } else if (!due || x.frame < due.frame) due = x;
          break;
        case "energy":
          if (!grant || x.frame < grant.frame) grant = x;
          break;
        case "enemyAction":
          if (!enemyAction || x.frame < enemyAction.frame) enemyAction = x;
          break;
        case "burst":
          if (!burst || x.frame < burst.frame) burst = x;
          break;
        case "jump":
          if (!jump || x.frame < jump.frame) jump = x;
          break;
      }
    }
    const tick = nextTick(st.enemy);
    const expiry = nextExpiry(st.buffs, frame);
    const tickDue = tick !== null && tick <= frame ? tick : null;
    const buffTick = nextBuffTick(st.buffs, frame);
    const lateFrame = late?.frame ?? null;
    const runDue = (x: PendingAction) => {
      const t = ctx.kits.get(x.owner)?.triggers.find((y) => y.id === x.trigger);
      if (!t) throw new EngineError(`${x.owner} has no trigger ${x.trigger}`);
      const r = runActions(ctx, unschedule(st, x), t, x.owner, { ...x.event, frame: x.frame }, x.origin);
      return runTriggers(ctx, r.state, r.events, x.origin);
    };
    // At one frame: Arts Bursts landing, ticks of a status already on the enemy, then buffs ending, then delayed trigger actions, energy grants,
    // the enemy's actions, buffs' periodic ticks, then hits, then delayed actions marked afterHits. Each kind waits for everything earlier.
    const first = (x: number | null, ...later: (number | null)[]) => x !== null && later.every((y) => y === null || x <= y);
    const hitFrame = hit ? hit.frame : null;
    const dueFrame = due?.frame ?? null;
    const grantFrame = grant?.frame ?? null;
    const enemyFrame = enemyAction?.frame ?? null;
    // A jump comes after everything else at its frame (what's at its skill frame still happens).
    const jumpFrame = jump?.frame ?? null;
    if (burst && first(burst.frame, tickDue, expiry, dueFrame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame, lateFrame)) {
      st = landBurst(ctx, unschedule(st, burst), burst);
      continue;
    }
    if (first(tickDue, expiry, dueFrame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame, lateFrame)) {
      const tickFrame = tickDue as number;
      const before = st.enemy;
      const t = tickStatus(st.enemy, tickFrame);
      st = recordStatus(ctx, { ...st, enemy: t.state }, t.events, before);
      st = runTriggers(ctx, st, asEvents(t.events, "none"), null);
      continue;
    }
    if (first(expiry, dueFrame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame, lateFrame)) {
      const at = expiry as number;
      // A buff a cast consumed already ended when it was consumed.
      // A buff that keeps instances (KitBuff.instances) ends with its last one.
      // One with its last tick still due at this frame ends after that tick (nextBuffTick).
      const ends = (b: ActiveBuff) => b.expiresAt === at && !tickDueBeforeEnd(b);
      const ended = st.buffs.filter((b) => ends(b) && b.cast === undefined).filter((b, i, all) => b.maxInstances === undefined || (all.findIndex((x) => x.id === b.id && x.owner === b.owner) === i && !st.buffs.some((x) => x.id === b.id && x.owner === b.owner && x.cast === undefined && (x.expiresAt > at || (x.expiresAt === at && !ends(x))))));
      st = { ...st, buffs: st.buffs.filter((b) => !ends(b)) };
      // Run out: nothing left, but what its cast's jumps took from it.
      // Each instance its own event (layers ending together each end).
      st = runTriggers(ctx, st, ended.map((b) => buffEndedEvent([b], at, false)), null);
      continue;
    }
    if (due && first(due.frame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame, lateFrame)) {
      st = runDue(due);
      continue;
    }
    if (grant && first(grant.frame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame, lateFrame)) {
      st = unschedule(st, grant);
      const caster = grant.cast.operator;
      const holds = !grant.if || decide(grant.if, evalContext(ctx.data, ctx.builds.get(caster) as Build, panelAt(ctx, caster, grant.frame), "", situationAt(ctx, caster, st, grant.frame)));
      if (holds) st = gainEnergy(ctx, st, grant.operator, grant.amount, grant.frame);
      continue;
    }
    if (enemyAction && first(enemyAction.frame, buffTick?.frame ?? null, hitFrame, jumpFrame, lateFrame)) {
      st = enemyAct(ctx, unschedule(st, enemyAction), enemyAction);
      continue;
    }
    if (buffTick && first(buffTick.frame, hitFrame, jumpFrame, lateFrame)) {
      const { b, frame: at } = buffTick;
      const every = b.every as number;
      st = { ...st, buffs: st.buffs.map((x) => (x === b ? { ...b, nextTick: at + every } : x)) };
      st = runTriggers(ctx, st, [{ type: "buffTick", frame: at, operator: b.owner, buff: b.id, ...(b.snapshot ? { snapshot: b.snapshot } : {}) }], null);
      continue;
    }
    if (late && (hitFrame === null || late.frame < hitFrame) && (jumpFrame === null || late.frame <= jumpFrame)) {
      st = runDue(late);
      continue;
    }
    if (jump && (hitFrame === null || jump.frame < hitFrame) && (lateFrame === null || jump.frame < lateFrame)) {
      st = unschedule(st, jump);
      // Only while that cast is still the operator's current action.
      if (st.acting[jump.operator]?.cast !== jump.cast.index) continue;
      if (jump.then !== undefined) {
        // A dive's fall or landing (jumpToDive): cast now; after the fall, the landing.
        const r = castSkill(ctx, st, jump.operator, jump.then, jump.frame, false);
        const cast = r.state.acting[jump.operator]?.cast;
        const op = jump.operator;
        const next = jump.landing === undefined || cast === undefined ? r.state : schedule(r.state, [{ kind: "jump", frame: jump.frame + DIVE.fall, clock: { operator: op }, cast: { operator: op, index: cast }, operator: op, from: 0, to: 0, then: jump.landing }]);
        st = runTriggers(ctx, next, r.events, r.origin);
      } else if (jump.end) {
        const r = endCurrentSkill(st, jump.operator, jump.frame);
        st = rebaseCooldowns(ctx, st, { ...r.state, acting: Object.fromEntries(Object.entries(r.state.acting).filter(([k]) => k !== jump.operator)) }, jump.frame);
        st = runTriggers(ctx, st, r.events, null);
      } else {
        const r = takeJump(st, jump);
        st = runTriggers(ctx, rebaseCooldowns(ctx, st, r.state, jump.frame), r.events, null);
      }
      continue;
    }
    if (!hit) break;
    const h = hit;
    st = landHit(ctx, unschedule(st, h), h);
  }
  return {
    ...st,
    sp: spAt(st, frame),
    frame,
    ...(st.spStops.some((p) => p.until <= frame) ? { spStops: st.spStops.filter((p) => p.until > frame) } : {}),
    enemy: expireStatus(st.enemy, frame),
  };
}

// Memoised advance (memoised): `advance` is a pure function of (context,
// state, frame) and states are never changed in place, so with a context
// from `memoised` a repeated call with the same state object and frame
// returns the first call's result. The rotation search needs it: judging
// each candidate action from one state advances that state to the same
// frames many times over (earliestStart's search for when the current
// action ends, combo windows, finishers). The cache is the one piece of
// mutable state the engine keeps, and it lives on the context the search
// makes (TimelineContext.advanceMemo), not in the module: other contexts
// and other callers never see it.

/** Processes every pending hit, status tick and buff expiry up to (and including) a frame, in frame order (advanceFrom; memoised with a context from `memoised`). */
export function advance(ctx: TimelineContext, state: TimelineState, frame: number): TimelineState {
  const memo = ctx.advanceMemo;
  if (!memo) return advanceFrom(ctx, state, frame);
  let byFrame = memo.get(state);
  if (!byFrame) memo.set(state, (byFrame = new Map()));
  let r = byFrame.get(frame);
  if (!r) byFrame.set(frame, (r = advanceFrom(ctx, state, frame)));
  return r;
}

/** The context with `advance` memoised per state object and frame (the cache lives as long as this context and its states). */
export function memoised(ctx: TimelineContext): TimelineContext {
  return ctx.advanceMemo ? ctx : { ...ctx, advanceMemo: new WeakMap() };
}
