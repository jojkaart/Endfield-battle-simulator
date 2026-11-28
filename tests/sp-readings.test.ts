// Team SP's open readings (engine assumptions sp-regen and sp-start, docs/design/assumptions.md): how SP regenerates
// around a spend, and what a fight starts with. The default (`pause`, `200`) is timeline.test.ts's.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, SP, spAt, type Build, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const scenario = (assume: Record<string, string>): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90, controlImmune: false },
  durationFrames: 30 * 60,
  rotation: [],
  options: { crit: "never", assume },
});
const battle: RotationAction = { operator: op, skill: L + "normal_skill" };

describe("team SP readings", () => {
  it("sp-start: 200 by default, 300 with `full`", () => {
    const c = createContext(data, scenario({}));
    expect(init(c).sp).toBe(SP.start);
    const full = createContext(data, scenario({ "sp-start": "full" }));
    expect(init(full).sp).toBe(SP.max);
  });

  it("sp-regen `ticks`: 4 SP every 0.5 s from 0.5 s after a spend, none lost to it; `pause`: nothing for 0.5 s, then 8 a second", () => {
    const tick = SP.pauseAfterSpendFrames;
    const per = (SP.perSecond * tick) / 30;
    const cast = (assume: Record<string, string>) => {
      const c = createContext(data, scenario(assume));
      return { c, s: apply(c, init(c), battle) };
    };
    const t = cast({ "sp-regen": "ticks" });
    const p = cast({ "sp-regen": "pause" });
    // The battle skill at frame 0: 100 SP spent from 200 (no other SP before its hits land).
    expect(t.s.frame).toBe(0);
    expect(spAt(t.s, 0)).toBe(100);
    expect(spAt(t.s, tick - 1)).toBe(100);
    expect(spAt(t.s, tick)).toBe(100 + per);
    expect(spAt(t.s, 2 * tick - 1)).toBe(100 + per);
    expect(spAt(t.s, 2 * tick)).toBe(100 + 2 * per);
    // A second later the ticks have given what continuous regeneration without a pause would.
    expect(spAt(t.s, 30 + tick)).toBe(100 + ((30 + tick) * SP.perSecond) / 30);
    // The pause reading: none until the pause ends, then linear, 4 SP behind.
    expect(spAt(p.s, tick)).toBe(100);
    expect(spAt(p.s, 30 + tick)).toBeCloseTo(100 + SP.perSecond, 9);
    // Advanced frame by frame or at once, the same SP.
    let s = t.s;
    for (let f = 1; f <= 40; f++) s = advance(t.c, s, f);
    expect(s.sp).toBe(spAt(t.s, 40));
  });

  it("sp-regen `ticks`: a skill waiting for SP starts at the tick that reaches its cost", () => {
    const c = createContext(data, scenario({ "sp-regen": "ticks" }));
    const s1 = apply(c, init(c), battle);
    const s2 = apply(c, s1, battle);
    // 100 left after the first; the second spends it at once (SP 100 at frame 0's cast: the first's end allows it).
    const third = earliestStart(c, s2, battle);
    if ("error" in third) throw new Error(third.error);
    const needed = 100 - spAt(s2, s2.frame);
    const ticks = Math.ceil(needed / ((SP.perSecond * SP.pauseAfterSpendFrames) / 30));
    expect(spAt(s2, third.frame)).toBeGreaterThanOrEqual(100);
    expect(third.frame).toBeGreaterThanOrEqual(s2.spPausedUntil + (ticks - 1) * SP.pauseAfterSpendFrames);
  });
});
