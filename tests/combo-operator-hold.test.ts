// Engine assumption combo-operator-hold (timeline/clock.ts slowDown): a combo's slow-down holds the operators it holds
// a few frames more than its scales say. "<n>f" adds them at every combo, "<n>f-episode" once per run of overlapping
// slow-downs: a combo pressed inside another's adds none of its own (scripts/probes/combo-hold/episodes.ts: a cast across
// two combos pressed together is about as late as across one).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import type { SkillTiming, TimelineContext, TimelineState } from "@efsim/engine";
import { slowDown } from "../packages/engine/src/timeline/clock.ts";

const data = loadGameData();
const SI = data.skills["chr_0036_jsspsi_combo_skill"]?.timing as SkillTiming;
const ctxWith = (assume: Record<string, string>) => ({ scenario: { options: { assume }, team: [{ operator: "si" }, { operator: "arc" }, { operator: "x" }] } }) as unknown as TimelineContext;
const state = (): TimelineState =>
  ({
    frame: 0, link: [], scheduled: [], slowdowns: [], enemyFrozenUntil: 0, enemyFrozenBy: {}, energyBlockedUntil: {}, comboWindow: {}, stagger: { until: null }, acting: { arc: { skill: "a", frame: 1 } }, chainNext: {}, readyAt: {}, triggerState: {},
    buffs: [],
    enemy: { vulnerable: null, physical: [], controls: [], infliction: null, statuses: [] },
  }) as unknown as TimelineState;
// The frame arc's current action started at, as later held: how far her own clock was shifted.
const held = (assume: Record<string, string>, pressedTogether: boolean): number => {
  const ctx = ctxWith(assume);
  let st = slowDown(ctx, state(), "si", SI, 0, "combo");
  if (pressedTogether) st = slowDown(ctx, st, "x", SI, 6, "combo");
  return (st.acting["arc"]?.frame ?? 0) - 1;
};

describe("combo-operator-hold", () => {
  it("none: an operator is held by the combo's scales alone (Si's 24 frames: 15.8)", () => {
    expect(held({}, false)).toBe(16);
  });

  it("4f: four frames more at every combo, twice across two pressed together", () => {
    expect(held({ "combo-operator-hold": "4f" }, false)).toBe(20);
    expect(held({ "combo-operator-hold": "4f" }, true) - held({}, true)).toBe(8);
  });

  it("4f-episode: four frames more once, whether one combo or two pressed together", () => {
    expect(held({ "combo-operator-hold": "4f-episode" }, false)).toBe(20);
    expect(held({ "combo-operator-hold": "4f-episode" }, true) - held({}, true)).toBe(4);
  });
});
