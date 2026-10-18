import { describe, expect, it } from "vitest";
import { FPS, frames, framesToSeconds, ratio, seconds, secondsToFrames } from "../src/index.ts";

describe("units", () => {
  it("timelines run at 30 FPS", () => {
    expect(FPS).toBe(30);
  });

  it("converts float32 table seconds to the intended frame", () => {
    // 22 frames = 0.7333… s; tables hold the float32 value.
    expect(secondsToFrames(seconds(Math.fround(22 / 30)))).toBe(22);
    // Perlica's attack1 animation: 166 frames for 5.5333 s (SkillData).
    expect(secondsToFrames(seconds(Math.fround(5.5333333)))).toBe(166);
    expect(secondsToFrames(seconds(0))).toBe(0);
  });

  it("round-trips frames", () => {
    for (const f of [0, 1, 13, 155, 3600]) {
      expect(secondsToFrames(framesToSeconds(frames(f)))).toBe(f);
    }
  });

  it("rejects values that aren't valid in their unit", () => {
    expect(() => frames(1.5)).toThrow(RangeError);
    expect(() => seconds(Number.NaN)).toThrow(RangeError);
    expect(() => ratio(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
