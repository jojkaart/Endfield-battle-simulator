// A replay's clock as time stops (round 22, the barrage-array report point 1): the slow-downs its timeline applied
// (BuffReplay.appliedStops: casts' stops, the breaks' holds) and the hidden holds it placed (BuffReplay.hiddenHolds), in
// the log tools' TimeStop shape, so world time between two log moments can take out what held a clock: every stop, or
// every stop but one operator's own (an operator's own stop doesn't hold her clock), with the hidden holds on top or not.
// `zmdlogs worldtime --applied / --holds / --without` and `--series` read it; until round 22 each such question was a
// scratch script turning AppliedStop (operator `string | null`) and PlacedHolds.holds into TimeStops by hand.

import { FPS } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import { worldMs, type TimeStop } from "./logcasts.ts";

const msOf = (frames: number) => (frames * 1000) / FPS;

/** What a replay's clock takes out (replayClockStops): `without` an operator's own stops left in (her clock). */
export interface ClockOptions {
  /** The operator whose own stops stay in (a stop cast by her doesn't hold her clock): id. */
  readonly without?: string;
}

/**
 * The slow-downs a replay's timeline applied as TimeStops (frames; `operator` the caster it doesn't hold, "" for one that
 * holds everyone: a break's hold), without `opts.without`'s own.
 */
export function replayClockStops(replay: Pick<BuffReplay, "appliedStops">, opts: ClockOptions = {}): TimeStop[] {
  return replay.appliedStops
    .filter((st) => opts.without === undefined || st.operator !== opts.without)
    .map((st) => ({ start: st.start, scales: st.scales, operator: st.operator ?? "", skillId: st.operator === null ? "hold" : st.ultimate ? "ultimate" : "slow-down", kind: st.ultimate ? "ultimate" : null }));
}

/** The hidden holds a replay placed (frames: at `frame`, `frames` of world hold), none without them. */
export function replayHolds(replay: Pick<BuffReplay, "hiddenHolds">): readonly { readonly frame: number; readonly frames: number }[] {
  return replay.hiddenHolds?.holds ?? [];
}

/** The hidden holds' ms between two log moments (ms): every hold whose frame is in [from, to). */
export function holdsMs(holds: readonly { readonly frame: number; readonly frames: number }[], from: number, to: number): number {
  const [a, b] = [Math.round((from * FPS) / 1000), Math.round((to * FPS) / 1000)];
  return msOf(holds.filter((h) => h.frame >= a && h.frame < b).reduce((n, h) => n + h.frames, 0));
}

/**
 * The world's time between two log moments (ms) with `stops` out (worldMs: overlapping stops once, at the lowest scale)
 * and, given, the hidden holds out on top: the engine adds a hold to whatever stop runs then (timeline/clock.ts
 * holdWorld shifts every world clock by its frames), so a hold inside a stop counts in full.
 */
export function heldWorldMs(from: number, to: number, stops: readonly TimeStop[], holds: readonly { readonly frame: number; readonly frames: number }[] = []): number {
  return worldMs(from, to, stops) - holdsMs(holds, from, to);
}
