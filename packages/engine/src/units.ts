// Units used across the engine. Branded types keep frames, seconds and
// ratios from being mixed up by accident (design principle 8).

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Whole game frames. Skill timelines run at {@link FPS}. */
export type Frames = Brand<number, "Frames">;
/** Seconds, as used by cooldowns, buff durations and table values. */
export type Seconds = Brand<number, "Seconds">;
/** A fraction, e.g. 0.2 for +20%. Percentages are converted on load. */
export type Ratio = Brand<number, "Ratio">;

/**
 * Frame rate of skill timelines. Verified 2026-10-18: all 626 animation
 * actions in the `chr_*` SkillData files convert at exactly 30 frames per
 * second (docs/data-sources.md#frame-rate).
 */
export const FPS = 30;

export function frames(n: number): Frames {
  if (!Number.isInteger(n)) throw new RangeError(`frames must be a whole number, got ${n}`);
  return n as Frames;
}

export function seconds(n: number): Seconds {
  if (!Number.isFinite(n)) throw new RangeError(`seconds must be finite, got ${n}`);
  return n as Seconds;
}

export function ratio(n: number): Ratio {
  if (!Number.isFinite(n)) throw new RangeError(`ratio must be finite, got ${n}`);
  return n as Ratio;
}

/**
 * Converts a duration in seconds to whole frames, rounding to the nearest
 * frame. Table values are float32 (e.g. 0.733 s is stored as
 * 0.7329999804496765), so exact multiples of a frame land slightly off and
 * must round, not truncate. Whether the game itself rounds or truncates
 * durations that aren't whole frames is not verified yet.
 */
export function secondsToFrames(s: Seconds): Frames {
  return frames(Math.round(s * FPS));
}

export function framesToSeconds(f: Frames): Seconds {
  return seconds(f / FPS);
}
