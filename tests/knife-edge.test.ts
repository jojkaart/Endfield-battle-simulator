// A mode decided by two attributes on a knife edge gets a warning (stats.ts KNIFE_EDGE_POINTS; open-problems
// "Arcane's Array Arcana on a knife edge").
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { computeStats, type Build } from "@efsim/engine";

const data = loadGameData();
const arcane = (file: string) =>
  (JSON.parse(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8")) as { team: Build[] }).team.find((b) => b.operator === "chr_0032_lizhiyan") as Build;

describe("Arcane's Array Arcana on a knife edge", () => {
  it("warns for 0206's Arcane (Intellect 472.4, Will 473.5): INT's combo cooldown there, WILL's Susceptibility", () => {
    const w = computeStats(data, arcane("multi-target/zmdlogs-0206142f9134.json")).warnings;
    expect(w.some((x) => x.includes("lizhiyan_wisd") && x.includes("472.4") && x.includes("473.5"))).toBe(true);
  });
  it("stays quiet for a clear WILL build (1d91: 430.4 against 765.3)", () => {
    expect(computeStats(data, arcane("pending/zmdlogs-1d9198480e75.json")).warnings.some((x) => x.includes("lizhiyan"))).toBe(false);
  });
});
