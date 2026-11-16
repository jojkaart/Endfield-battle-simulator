// Si's kit (chr_0036_jsspsi): talent 2's Haste (Unsoiled Brush) comes only when an Inksoul disappears.
// BuffData: talent1_speedup is created only by xianjing_linkline (the Inksoul) when it finishes and by
// xianjing_inkboom (Final Stroke) while the target has Artful Intent; Artful Intent's own end
// (xianjing_inkhurteffect buffEvent 2, the inkmark projectile when no Inksoul is present) creates none.
// ZMDLogs doesn't record the Haste; in-game test 109 checks the no-Inksoul burst.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, FPS, init, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const S = "chr_0036_jsspsi";
const example = readScenario(new URL("../examples/si-laevatain.scenario.json", import.meta.url).pathname);
const scenario: TimelineScenario = { ...example, options: { ...example.options, teammateAttacks: false }, durationFrames: 40 * FPS };
const si = (skill: string): RotationAction => ({ operator: S, skill: `${S}_${skill}` });
/** The state at `until` (default: the whole 40 s; expired buffs are gone from it by then). */
const run = (rotation: readonly RotationAction[], until = scenario.durationFrames): TimelineState => {
  const ctx = createContext(data, scenario);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const burst = (s: TimelineState, id: string) => s.hits.filter((h) => h.operator === S && h.hitId === id);
const fired = (s: TimelineState, trigger: string) => s.triggerState[`${S}:${trigger}`]?.count ?? 0;
/** The rotation's Artful Intent burst (one) and the state at its frame, with the Haste instances active then. */
const atBurst = (rotation: readonly RotationAction[], id: string) => {
  const whole = run(rotation);
  const hits = burst(whole, id);
  expect(hits).toHaveLength(1);
  const frame = hits[0]?.frame ?? NaN;
  const s = run(rotation, frame);
  return { whole, frame, haste: s.buffs.filter((b) => b.owner === S && b.id === "talent_haste" && b.appliedAt <= s.frame && s.frame < b.expiresAt) };
};

describe("Si's talent Haste (Unsoiled Brush)", () => {
  it("no Haste when Artful Intent bursts without an Inksoul (no Initial Stroke)", () => {
    const r = atBurst([si("normal_skill")], "burst_mark");
    expect(burst(r.whole, "burst_inksoul")).toHaveLength(0);
    expect(fired(r.whole, "artful_intent_end")).toBe(1);
    expect(fired(r.whole, "inksoul_haste")).toBe(0);
    expect(r.haste).toEqual([]);
  });

  it("Initial Stroke, then expiry: the Inksoul's end gives the team 30% Haste for 5 s as Artful Intent ends", () => {
    const r = atBurst([si("normal_skill"), si("normal_skill_1")], "burst_inksoul");
    expect(burst(r.whole, "burst_mark")).toHaveLength(0);
    expect(fired(r.whole, "inksoul_haste")).toBe(1);
    expect(r.haste).toHaveLength(1);
    const h = r.haste[0];
    expect(h?.target).toBe("team");
    // The Inksoul's burst lands 13 frames after Artful Intent (and the Inksoul with it) ends.
    expect(h?.appliedAt).toBe(r.frame - 13);
    expect((h?.expiresAt ?? NaN) - (h?.appliedAt ?? NaN)).toBe(5 * FPS);
    expect(h?.attrs?.map((a) => [a.attr, a.value])).toEqual([[92, expect.closeTo(0.3, 6)]]);
  });

  it("Final Stroke: the Haste comes at its frame 12, where it ends Artful Intent", () => {
    const rotation = [si("normal_skill"), si("normal_skill_1"), si("normal_skill_2")];
    const r = atBurst(rotation, "burst_inksoul");
    const fs = r.whole.casts.find((c) => c.operator === S && c.skill === `${S}_normal_skill_2`)?.frame ?? NaN;
    expect(r.haste.map((b) => b.appliedAt)).toEqual([fs + 12]);
  });
});
