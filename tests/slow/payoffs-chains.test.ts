// The owner's team's basic rotation, found by the chain search (docs/design.md "Payoffs and chains"; the owner,
// 2026-11-15): Akekuri's battle skill inflicts Heat, which opens Arcane's combo; her combo adds another Heat stack;
// Estella's battle skill (Cryo) consumes them into Solidification, which opens both Si's and Estella's combos.
// Arcane's combo adds its window's element only in her WILL mode (WILL above INT): the owner tunes her gear to the most
// INT just below WILL (the example: Intellect 472.44, Will 473.50).
// Slow (minutes): `npm run test:logs`.
import { describe, expect, it } from "vitest";
import { payoffs } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../../packages/cli/src/simulate.ts";

const data = loadGameData();
const { rotation: _r, ...example } = readScenario(new URL("../../examples/estella-si-akekuri-arcane.scenario.json", import.meta.url).pathname);
const AKEKURI_BS = "chr_0019_karin:chr_0019_karin_normal_skill";
const ARCANE_COMBO = "chr_0032_lizhiyan:chr_0032_lizhiyan_combo_skill";
const ESTELLA_BS = "chr_0021_whiten:chr_0021_whiten_normal_skill";
const ESTELLA_COMBO = "chr_0021_whiten:chr_0021_whiten_combo_skill";
const SI_COMBO = "chr_0036_jsspsi:chr_0036_jsspsi_combo_skill";

describe("chains: the owner's basic rotation", () => {
  const report = payoffs(data, example, { ceilings: false, measure: 0, depth: 5 });

  it("finds Akekuri's battle skill → Arcane's combo → Estella's battle skill → Estella's and Si's combos", () => {
    const owner = report.chains.find((c) => {
      const ids = c.steps.map((s) => s.step);
      return ids.length === 5 && ids[0] === AKEKURI_BS && ids[1] === ARCANE_COMBO && ids[2] === ESTELLA_BS && new Set(ids.slice(3)).size === 2 && ids.slice(3).every((x) => x === ESTELLA_COMBO || x === SI_COMBO);
    });
    expect(owner).toBeDefined();
    const steps = owner?.steps ?? [];
    expect(steps[1]?.link).toBe("opens");
    expect(steps[1]?.by?.through).toBe("window chr_0032_lizhiyan");
    // Estella's battle skill sets the rest up: both combo windows and a Solidification of two Heat stacks.
    expect(steps[2]?.link).toBe("sets up");
    expect(steps[2]?.by?.through).toContain("window chr_0021_whiten");
    expect(steps[2]?.by?.through).toContain("window chr_0036_jsspsi");
    expect(steps[2]?.by?.through).toContain("reaction solidification 2 (fire)");
    // Both combos are tied to the window Estella's battle skill opened (step 3).
    for (const s of steps.slice(3)) expect(s).toMatchObject({ link: "opens", by: { index: 2 } });
    expect(owner?.damage).toBeGreaterThan(0);
  });
});
