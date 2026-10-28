// Running the fight forward: everything scheduled up to a frame, in the order of docs/design.md (advance).

import type { Build } from "../build.ts";
import { decide, evalContext } from "../damage.ts";
import { EngineError } from "../errors.ts";
import type { BattleEvent } from "../events.ts";
import { type ActiveBuff, buffEndedEvent } from "../buffs.ts";
import { expireStatus, nextTick, tickStatus } from "../status.ts";
import type { Cast, PendingEnemyAction, Scheduled, TimelineContext, TimelineState } from "./state.ts";
import { DIVE, DODGE } from "./rules.ts";
import { panelAt, timingOf } from "./context.ts";
import { shiftOperator, slowDown } from "./clock.ts";
import { gainEnergy, gainSp, rebaseCooldowns, refillPoise, spAt } from "./resources.ts";
import { actionFrame, counters } from "./timing.ts";
import { situationAt } from "./situation.ts";
import { runActions, runTriggers } from "./actions.ts";
import { asEvents, draw, landBurst, landHit, recordStatus } from "./landing.ts";
import { castSkill, endCurrentSkill, takeJump } from "./casting.ts";
import { dueBefore, IN_FRAME_RANK, ofCast, schedule, stepOf, unschedule } from "./schedule.ts";
import { teammateAttack } from "./teammates.ts";

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
  if (a.act === "recover") return refillPoise(ctx, state);
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
  // It's in the cast list as the skill "dodge" (no cast event: nothing listens to the perfect-dodge skill's cast). Its SP is
  // natural (it gives ultimate energy when spent), through gainSp as every other grant.
  const gained = gainSp(ended.state, pd.sp, a.frame, "natural");
  const cast: Cast = { frame: a.frame, operator: op, skill: DODGE, spAfter: spAt(gained, a.frame), energyAfter: ended.state.energy[op] ?? 0 };
  let st: TimelineState = rebaseCooldowns(ctx, roll.state, { ...gained, acting: { ...ended.state.acting, [op]: { skill: DODGE, frame: a.frame, cast: ended.state.casts.length } }, casts: [...ended.state.casts, cast] }, a.frame);
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

/** What runs next (nextDue): a scheduled item, or what the state's own times make due. */
type Due =
  | { readonly step: "statusTick" | "buffExpiry"; readonly frame: number }
  | { readonly step: "buffTick"; readonly frame: number; readonly buff: ActiveBuff }
  | { readonly step: "scheduled"; readonly frame: number; readonly item: Scheduled };

/**
 * The first thing due by a frame, in the in-frame order (schedule.ts IN_FRAME, dueBefore): of what's scheduled, and of
 * what the state's own times make due (the enemy's status ticks, buffs' ends and periodic ticks); null when nothing is.
 */
function nextDue(st: TimelineState, frame: number): Due | null {
  let item: Scheduled | null = null;
  for (const x of st.scheduled) if (x.frame <= frame && (!item || dueBefore(x, item))) item = x;
  let due: Due | null = item ? { step: "scheduled", frame: item.frame, item } : null;
  const rank = (d: Due) => IN_FRAME_RANK[d.step === "scheduled" ? stepOf(d.item) : d.step];
  const consider = (d: Due) => {
    if (!due || d.frame < due.frame || (d.frame === due.frame && rank(d) < rank(due))) due = d;
  };
  const tick = nextTick(st.enemy);
  if (tick !== null && tick <= frame) consider({ step: "statusTick", frame: tick });
  const expiry = nextExpiry(st.buffs, frame);
  if (expiry !== null) consider({ step: "buffExpiry", frame: expiry });
  const buffTick = nextBuffTick(st.buffs, frame);
  if (buffTick) consider({ step: "buffTick", frame: buffTick.frame, buff: buffTick.b });
  return due;
}

/**
 * The first frame after `frame` at which anything is due (nextDue's sources: what's scheduled, of every kind; the enemy's
 * status ticks; buffs' ends and periodic ticks), or null: the frames at which a state can change on its own.
 */
export function nextEventAfter(st: TimelineState, frame: number): number | null {
  let next: number | null = null;
  const consider = (f: number | null | undefined) => {
    if (f !== null && f !== undefined && Number.isFinite(f) && f > frame && (next === null || f < next)) next = f;
  };
  for (const x of st.scheduled) consider(x.frame);
  for (const x of st.enemy.statuses) if (x.nextTickAt !== undefined && x.nextTickAt <= x.expiresAt) consider(x.nextTickAt);
  for (const b of st.buffs) {
    consider(b.expiresAt);
    if (b.nextTick !== undefined && b.nextTick <= b.expiresAt) consider(b.nextTick);
  }
  return next;
}

/** Runs everything due up to (and including) a frame, in order (nextDue). */
function advanceFrom(ctx: TimelineContext, state: TimelineState, frame: number): TimelineState {
  if (frame < state.frame) throw new EngineError(`can't go back from frame ${state.frame} to ${frame}`);
  let st = state;
  for (let due = nextDue(st, frame); due; due = nextDue(st, frame)) {
    const at = due.frame;
    switch (due.step) {
      case "statusTick": {
        const before = st.enemy;
        const t = tickStatus(st.enemy, at);
        st = recordStatus(ctx, { ...st, enemy: t.state }, t.events, before);
        st = runTriggers(ctx, st, asEvents(t.events, "none"), null);
        break;
      }
      case "buffExpiry": {
        // A buff a cast consumed already ended when it was consumed.
        // A buff that keeps instances (KitBuff.instances) ends with its last one.
        // One with its last tick still due at this frame ends after that tick (nextBuffTick).
        const ends = (b: ActiveBuff) => b.expiresAt === at && !tickDueBeforeEnd(b);
        const ended = st.buffs.filter((b) => ends(b) && b.cast === undefined).filter((b, i, all) => b.maxInstances === undefined || (all.findIndex((x) => x.id === b.id && x.owner === b.owner) === i && !st.buffs.some((x) => x.id === b.id && x.owner === b.owner && x.cast === undefined && (x.expiresAt > at || (x.expiresAt === at && !ends(x))))));
        st = { ...st, buffs: st.buffs.filter((b) => !ends(b)) };
        // Run out: nothing left, but what its cast's jumps took from it.
        // Each instance its own event (layers ending together each end).
        st = runTriggers(ctx, st, ended.map((b) => buffEndedEvent([b], at, false)), null);
        break;
      }
      case "buffTick": {
        const b = due.buff;
        const every = b.every as number;
        st = { ...st, buffs: st.buffs.map((x) => (x === b ? { ...b, nextTick: at + every } : x)) };
        st = runTriggers(ctx, st, [{ type: "buffTick", frame: at, operator: b.owner, buff: b.id, ...(b.snapshot ? { snapshot: b.snapshot } : {}) }], null);
        break;
      }
      case "scheduled":
        st = runScheduled(ctx, unschedule(st, due.item), due.item);
        break;
    }
  }
  return {
    ...st,
    sp: spAt(st, frame),
    frame,
    ...(st.spStops.some((p) => p.until <= frame) ? { spStops: st.spStops.filter((p) => p.until > frame) } : {}),
    enemy: expireStatus(st.enemy, frame),
  };
}

/** Runs a scheduled item at its frame (the state without it). */
function runScheduled(ctx: TimelineContext, st: TimelineState, x: Scheduled): TimelineState {
  switch (x.kind) {
    case "burst":
      return landBurst(ctx, st, x);
    case "action": {
      const t = ctx.kits.get(x.owner)?.triggers.find((y) => y.id === x.trigger);
      if (!t) throw new EngineError(`${x.owner} has no trigger ${x.trigger}`);
      const r = runActions(ctx, st, t, x.owner, { ...x.event, frame: x.frame }, x.origin);
      return runTriggers(ctx, r.state, r.events, x.origin);
    }
    case "energy": {
      const caster = x.cast.operator;
      const holds = !x.if || decide(x.if, evalContext(ctx.data, ctx.builds.get(caster) as Build, panelAt(ctx, caster, x.frame), "", situationAt(ctx, caster, st, x.frame)));
      return holds ? gainEnergy(ctx, st, x.operator, x.amount, x.frame) : st;
    }
    case "enemyAction":
      return enemyAct(ctx, st, x);
    case "auto":
      return teammateAttack(ctx, st, x);
    case "hit":
      return landHit(ctx, st, x);
    case "jump": {
      // Only while that cast is still the operator's current action.
      if (st.acting[x.operator]?.cast !== x.cast.index) return st;
      if (x.then !== undefined) {
        // A dive's fall or landing (jumpToDive): cast now; after the fall, the landing.
        const r = castSkill(ctx, st, x.operator, x.then, x.frame, false);
        const cast = r.state.acting[x.operator]?.cast;
        const op = x.operator;
        const next = x.landing === undefined || cast === undefined ? r.state : schedule(r.state, [{ kind: "jump", frame: x.frame + DIVE.fall, clock: { operator: op }, cast: { operator: op, index: cast }, operator: op, from: 0, to: 0, then: x.landing }]);
        return runTriggers(ctx, next, r.events, r.origin);
      }
      if (x.end) {
        const r = endCurrentSkill(st, x.operator, x.frame);
        const ended = rebaseCooldowns(ctx, st, { ...r.state, acting: Object.fromEntries(Object.entries(r.state.acting).filter(([k]) => k !== x.operator)) }, x.frame);
        return runTriggers(ctx, ended, r.events, null);
      }
      const r = takeJump(st, x);
      return runTriggers(ctx, rebaseCooldowns(ctx, st, r.state, x.frame), r.events, null);
    }
  }
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

/** The context with `advance` (and the search's committed damage) memoised per state object and frame (the caches live as long as this context and its states). */
export function memoised(ctx: TimelineContext): TimelineContext {
  return ctx.advanceMemo ? ctx : { ...ctx, advanceMemo: new WeakMap(), committedMemo: new WeakMap() };
}
