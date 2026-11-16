// scripts/bench.ts: alternating timing runs; its argument parsing and report.
import { describe, expect, it } from "vitest";
import { median, parseArgs, report } from "../scripts/bench.ts";

describe("bench", () => {
  it("takes runs, names and commands", () => {
    const { runs, variants } = parseArgs(["-n", "4", "--names", "old,new", "a cmd", "b cmd"]);
    expect(runs).toBe(4);
    expect(variants.map((v) => [v.name, v.command])).toEqual([["old", "a cmd"], ["new", "b cmd"]]);
    expect(parseArgs(["x"]).variants[0]?.name).toBe("A");
    expect(() => parseArgs([])).toThrow(/usage/);
  });

  it("reports medians and the ratio of two variants", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    const text = report([
      { name: "A", command: "a", wall: [1, 2, 3], cpu: [1, 1, 1], failed: 0 },
      { name: "B", command: "b", wall: [2, 4, 6], cpu: [3, 3, 3], failed: 1 },
    ], "1.0", "2.0");
    expect(text).toContain("A: wall 2.00 s");
    expect(text).toContain("1 FAILED");
    expect(text).toContain("B / A: wall ×2.00, CPU ×3.00");
  });
});
