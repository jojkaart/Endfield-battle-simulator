// The scheduled list (TimelineState.scheduled): one pass each to shift a clock, end a cast and jump on a cast's
// timeline, for every kind of item alike (docs/design.md "Order within a frame").

import type { Clock, Scheduled, TimelineState } from "./state.ts";

/**
 * The order of what's due at one frame (docs/design.md "Order within a frame"): each step runs once everything before
 * it at that frame (and everything at earlier frames) has, and what it does may add to any step still to come. The
 * enemy's status ticks and buffs' ends and periodic ticks come from their own state (status.ts, buffs); the rest is
 * scheduled (Scheduled, by its kind; a delayed action marked afterHits is the step after hits).
 *
 *  1. burst        Arts Bursts landing (BattleConstants.burstDelayFrames after their infliction)
 *  2. statusTick   ticks of a status already on the enemy (Combustion, Corrosion…)
 *  3. buffExpiry   buffs running out (all that end at the frame at once)
 *  4. action       delayed trigger actions (KitTrigger.delay)
 *  5. energy       team energy a cast gives later (KitSkill.teamEnergy)
 *  6. enemyAction  the enemy's actions (attacks, charges)
 *  7. buffTick     buffs' periodic ticks
 *  8. hit          hits landing
 *  9. afterHits    delayed trigger actions after their frame's hits (KitTrigger.afterHits)
 * 10. jump         jumps and ends on casts' timelines, a dive's next part: what's at the jump's own skill frame happens first
 * 11. auto         teammates' own basic attacks (teammates.ts): once the frame's own casts' effects are in
 *
 * Within a step at one frame: hits (and teammates' attacks) by their operator's ID (an arbitrary order the game's isn't known to follow; it
 * keeps a hit's order apart from the team's order), then everything in the order it was scheduled (`dueBefore`).
 */
export const IN_FRAME = ["burst", "statusTick", "buffExpiry", "action", "energy", "enemyAction", "buffTick", "hit", "afterHits", "jump", "auto"] as const;
export type Step = (typeof IN_FRAME)[number];
export const IN_FRAME_RANK = Object.fromEntries(IN_FRAME.map((s, i) => [s, i])) as Readonly<Record<Step, number>>;

/** A scheduled item's step in a frame (IN_FRAME). */
export function stepOf(x: Scheduled): Step {
  return x.kind === "action" ? (x.afterHits ? "afterHits" : "action") : x.kind;
}

/**
 * Whether a scheduled item runs before another (both due): the earlier frame, else the earlier step (IN_FRAME), else
 * for two hits the lower operator ID; else neither does, and the one scheduled first (earlier in the list) runs first.
 */
export function dueBefore(a: Scheduled, b: Scheduled): boolean {
  if (a.frame !== b.frame) return a.frame < b.frame;
  const ra = IN_FRAME_RANK[stepOf(a)];
  const rb = IN_FRAME_RANK[stepOf(b)];
  if (ra !== rb) return ra < rb;
  // Hits, and teammates' attacks, by their operator's ID (not the team's order).
  return ((a.kind === "hit" && b.kind === "hit") || (a.kind === "auto" && b.kind === "auto")) && a.operator < b.operator;
}

/** A scheduled list's items of one kind, in order. */
export function ofKind<K extends Scheduled["kind"]>(list: readonly Scheduled[], kind: K): Extract<Scheduled, { kind: K }>[] {
  return list.filter((x): x is Extract<Scheduled, { kind: K }> => x.kind === kind);
}

/** Items added at the end of the list (after everything scheduled before them). */
export function schedule(st: TimelineState, items: readonly Scheduled[]): TimelineState {
  return items.length ? { ...st, scheduled: [...st.scheduled, ...items] } : st;
}

/** An item without it. */
export function unschedule(st: TimelineState, item: Scheduled): TimelineState {
  return { ...st, scheduled: st.scheduled.filter((x) => x !== item) };
}

/** Whether an item belongs to an operator's cast (by its index in the cast list). */
export function ofCast(x: Scheduled, operator: string, index: number | undefined): boolean {
  return x.cast !== undefined && x.cast.operator === operator && x.cast.index === index;
}

/** Whether an item runs on an operator's clock. */
export function onOperator(clock: Clock, operator: string): boolean {
  return typeof clock === "object" && clock.operator === operator;
}

/**
 * The frame that decides what happens to an item of a cast when the cast is cut short or jumps: its launch, when it
 * has one (it's the cast's own until then), else its own frame; null when it's detached from the start (it goes on
 * whatever the cast does).
 */
export function castBound(x: Scheduled): number | null {
  return x.launchAt ?? (x.detached ? null : x.frame);
}

/**
 * The items on a clock after `start` happen `n` frames later, a launch to come with them (a slow-down or freeze of
 * that clock: clock.ts); pinned ones stay.
 */
export function shiftClock(list: readonly Scheduled[], on: (c: Clock) => boolean, start: number, n: number): readonly Scheduled[] {
  if (n <= 0) return list;
  let changed = false;
  const out = list.map((x) => {
    if (x.pinned || x.frame <= start || !on(x.clock)) return x;
    changed = true;
    return { ...x, frame: x.frame + n, ...(x.launchAt !== undefined && x.launchAt > start ? { launchAt: x.launchAt + n } : {}) };
  });
  return changed ? out : list;
}

/**
 * An operator's cast ends at `frame` (casting.ts endCurrentSkill): what it still had to do after the frame goes
 * (castBound past it); a jump on its timeline goes even at the frame (it would come after everything else there).
 */
export function cancelCast(list: readonly Scheduled[], operator: string, index: number, frame: number, kept: (x: Scheduled) => boolean = () => false): readonly Scheduled[] {
  return list.filter((x) => kept(x) || !(ofCast(x, operator, index) && (x.kind === "jump" || (x.frame > frame && (castBound(x) ?? -Infinity) > frame))));
}

/**
 * A jump at `at` skips `length` real frames of an operator's cast's timeline (casting.ts takeJump): what's bound to
 * the cast in the skipped frames (castBound) doesn't happen, what's after comes that much sooner (its launch with
 * it); pinned items and what's detached stay.
 */
export function jumpCast(list: readonly Scheduled[], operator: string, index: number, at: number, length: number): readonly Scheduled[] {
  return list.flatMap((x) => {
    if (x.pinned || !ofCast(x, operator, index)) return [x];
    const bound = castBound(x);
    if (bound === null || bound <= at) return [x];
    if (bound < at + length) return [];
    return [{ ...x, frame: x.frame - length, ...(x.launchAt !== undefined ? { launchAt: x.launchAt - length } : {}) }];
  });
}
