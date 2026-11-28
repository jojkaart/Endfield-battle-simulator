// Engine assumption combo-overlap (timeline/clock.ts slowDown): a combo's slow-down doesn't hold an operator whose own
// combo's slow-down runs as it starts. Two combos pressed together: the first caster's clock runs on through the
// second's slow-down (the log's cast events put her start where her landing gives it unheld: scripts/probes/combo-hold/
// overlap-events.ts), while a third operator is held by both, the lowest scale counting.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import type { SkillTiming, TimelineContext, TimelineState } from "@efsim/engine";
import { slowDown } from "../packages/engine/src/timeline/clock.ts";

const data = loadGameData();
const SI = data.skills["chr_0036_jsspsi_combo_skill"]?.timing as SkillTiming;
const ctxWith = (assume: Record<string, string>) => ({ scenario: { options: { assume }, team: [{ operator: "si" }, { operator: "arc" }, { operator: "x" }] } }) as unknown as TimelineContext;
const state = (): TimelineState =>
  ({
    frame: 0, link: [], scheduled: [], slowdowns: [], enemyFrozenUntil: 0, enemyFrozenBy: {}, energyBlockedUntil: {}, comboWindow: {}, stagger: { until: null }, chainNext: {}, readyAt: {}, triggerState: {},
    acting: { arc: { skill: "a", frame: 1 }, si: { skill: "chr_0036_jsspsi_combo_skill", frame: 0 } },
    buffs: [],
    enemy: { vulnerable: null, physical: [], controls: [], infliction: null, statuses: [] },
  }) as unknown as TimelineState;
// How far each operator's current action was shifted: si's combo at 0, x's combo at `second` (none: null).
const shifts = (assume: Record<string, string>, second: number | null, kind: "combo" | "battle" = "combo") => {
  const ctx = ctxWith(assume);
  let st = slowDown(ctx, state(), "si", SI, 0, "combo");
  if (second !== null) st = slowDown(ctx, st, "x", SI, second, kind);
  return { si: (st.acting["si"]?.frame ?? 0) - 0, arc: (st.acting["arc"]?.frame ?? 0) - 1 };
};

describe("combo-overlap", () => {
  it("own (the default): a combo pressed inside si's slow-down doesn't hold si", () => {
    expect(shifts({}, 6).si).toBe(0);
  });

  it("lowest: it holds si as any operator, from where her own no longer covers it", () => {
    expect(shifts({ "combo-overlap": "lowest" }, 6).si).toBeGreaterThan(10);
  });

  it("a combo pressed after si's slow-down ended holds her either way", () => {
    expect(shifts({}, SI.slowdowns[0]!.scales.length + 1).si).toBe(16);
  });

  it("a third operator is held by both slow-downs, the lowest scale counting, under either reading", () => {
    expect(shifts({}, 6).arc).toBe(shifts({ "combo-overlap": "lowest" }, 6).arc);
    expect(shifts({}, 6).arc).toBeGreaterThan(shifts({}, null).arc);
  });
});
