// The scheduled list (TimelineState.scheduled): one pass each to shift a clock, end a cast and jump on a cast's
// timeline, for every kind of item alike (docs/design.md "Order within a frame").

import type { Clock, Scheduled, TimelineState } from "./state.ts";

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
export function cancelCast(list: readonly Scheduled[], operator: string, index: number, frame: number): readonly Scheduled[] {
  return list.filter((x) => !(ofCast(x, operator, index) && (x.kind === "jump" || (x.frame > frame && (castBound(x) ?? -Infinity) > frame))));
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
