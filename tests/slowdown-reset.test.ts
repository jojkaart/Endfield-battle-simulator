// A reset (SkillTiming.resets: a global dilation back to scale 1, Arcane's combo at its frame 9) ends the running
// slow-downs of its priority, its own too (engine assumption combo-reset), and a freeze holds Corrosion's end but not
// its ramp (freeze-ramp). timeline/clock.ts cutAtResets, resetSlowdowns, rampRunsOn.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { rampElapsed, type SkillTiming, type TimelineContext, type TimelineState } from "@efsim/engine";
import { cutAtResets, rampRunsOn, shiftEnemy, slowDown } from "../packages/engine/src/timeline/clock.ts";

const data = loadGameData();
const COMBO = -593023102;
const timingOf = (id: string) => data.skills[id]?.timing as SkillTiming;
const SI = "chr_0036_jsspsi_combo_skill";
const ARCANE = "chr_0032_lizhiyan_combo_skill";

const ctxWith = (assume: Record<string, string> = {}) => ({ scenario: { options: { assume }, team: [{ operator: "si" }, { operator: "arc" }] } }) as unknown as TimelineContext;
const corrosion = { status: "corrosion", level: 1, appliedAt: 0, expiresAt: 900, operator: "arc", artsIntensity: 0 };
const state = (): TimelineState =>
  ({
    frame: 0, link: [], scheduled: [], slowdowns: [], enemyFrozenUntil: 0, enemyFrozenBy: {}, energyBlockedUntil: {}, comboWindow: {}, stagger: { until: null }, acting: {}, chainNext: {}, readyAt: {},
    buffs: [{ id: "x", owner: "si", target: "team", appliedAt: 0, expiresAt: 300 }],
    enemy: { vulnerable: null, physical: [], controls: [], infliction: null, statuses: [corrosion] },
  }) as unknown as TimelineState;
const expiry = (st: TimelineState) => st.buffs[0]?.expiresAt;

describe("resets", () => {
  it("the data: Arcane's combo resets the combo priority at its frame 9, its own 18-frame slow-down among them", () => {
    const t = timingOf(ARCANE);
    expect(t.resets).toEqual([{ at: 9, priority: COMBO }]);
    expect(t.slowdowns).toEqual([expect.objectContaining({ from: 0, priority: COMBO })]);
    expect(t.slowdowns[0]?.scales.length).toBe(18);
  });

  it("cutAtResets ends the slow-downs of the reset's priority running at its frame, not others", () => {
    const stops = [
      { start: 0, scales: Array(24).fill(0.01), priority: COMBO },
      { start: 5, scales: Array(10).fill(0), priority: 7 },
      { start: 20, scales: Array(10).fill(0.01), priority: COMBO },
    ];
    const cut = cutAtResets(stops, [{ frame: 12, priority: COMBO }]);
    expect(cut.map((s) => s.scales.length)).toEqual([12, 10, 10]);
  });

  it("Arcane's combo pressed in Si's slow-down ends both at its frame 9: the world is held those frames only", () => {
    const ctx = ctxWith();
    const si = slowDown(ctx, state(), "si", timingOf(SI), 0);
    // Si's alone: its 24 frames hold the world 15.8 frames.
    expect(expiry(si)).toBe(316);
    const both = slowDown(ctx, si, "arc", timingOf(ARCANE), 3);
    // To frame 12 at 0.01 (12 × 0.99), then nothing: the 4 frames Si's would still have taken come back.
    expect(expiry(both)).toBe(312);
    expect(both.slowdowns.map((s) => [s.start, s.scales.length])).toEqual([
      [0, 12],
      [3, 9],
    ]);
    // Corrosion's ramp runs on from frame 12, as the world's clock does.
    const c = both.enemy.statuses[0] as typeof corrosion;
    expect(rampElapsed(c, 40) - rampElapsed(c, 30)).toBe(10);
    expect(40 - rampElapsed(c, 40)).toBe(12);
    // Without the reset: Si's whole slow-down, and Arcane's where it runs lower.
    const none = slowDown(ctxWith({ "combo-reset": "none" }), slowDown(ctxWith({ "combo-reset": "none" }), state(), "si", timingOf(SI), 0), "arc", timingOf(ARCANE), 3);
    expect(expiry(none)).toBe(316);
    expect(none.slowdowns.map((s) => s.scales.length)).toEqual([24, 18]);
  });

  it("a teammate's combo pressed inside Arcane's first 9 frames ends at her frame 9 too, and doesn't hold her (reaches)", () => {
    const ctx = ctxWith();
    const arc = slowDown(ctx, state(), "arc", timingOf(ARCANE), 0);
    expect(arc.resets).toEqual([{ frame: 9, priority: COMBO, by: "arc" }]);
    const both = slowDown(ctx, arc, "si", timingOf(SI), 6);
    // Si's 24 frames cut to 3: the world is held to frame 9 only (9 × 0.99), as with Arcane's alone.
    expect(both.slowdowns.map((s) => [s.start, s.scales.length])).toEqual([
      [0, 9],
      [6, 3],
    ]);
    expect(expiry(both)).toBe(309);
    // The log tools' lists cut it the same (withResets over cutAtResets).
    expect(cutAtResets([{ start: 6, scales: timingOf(SI).slowdowns[0]?.scales ?? [], priority: COMBO }], [{ frame: 9, priority: COMBO }])[0]?.scales.length).toBe(3);
    // Under `resets` (the engine before) Si's runs whole: the world is held 6 + Si's 15.8.
    const before = slowDown(ctxWith({ "combo-reset": "resets" }), slowDown(ctxWith({ "combo-reset": "resets" }), state(), "arc", timingOf(ARCANE), 0), "si", timingOf(SI), 6);
    expect(before.slowdowns.map((s) => s.scales.length)).toEqual([9, 24]);
    expect(expiry(before)).toBeGreaterThan(320);
  });

  it("a reset that has passed cuts nothing: a combo after Arcane's frame 9 runs whole", () => {
    const ctx = ctxWith();
    const later = slowDown(ctx, slowDown(ctx, state(), "arc", timingOf(ARCANE), 0), "si", timingOf(SI), 9);
    expect(later.slowdowns.map((s) => s.scales.length)).toEqual([24]);
    expect(later.resets).toEqual([]);
  });

  it("Arcane's combo alone holds the world 9 frames, not its 18", () => {
    expect(expiry(slowDown(ctxWith(), state(), "arc", timingOf(ARCANE), 0))).toBe(309);
    expect(expiry(slowDown(ctxWith({ "combo-reset": "none" }), state(), "arc", timingOf(ARCANE), 0))).toBe(312);
  });
});

describe("a freeze and Corrosion's ramp", () => {
  it("rampRunsOn keeps the ramp's progress through the freeze; its end is held", () => {
    const st = state();
    const frozen = shiftEnemy(st, 60, 45);
    const kept = rampRunsOn(st, frozen).enemy.statuses[0] as typeof corrosion;
    expect(kept.expiresAt).toBe(945);
    expect(rampElapsed(kept, 90)).toBe(90);
    // The enemy's clock held: the ramp stands still for the freeze.
    expect(rampElapsed(frozen.enemy.statuses[0] as typeof corrosion, 90)).toBe(60);
  });
});
