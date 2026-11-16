// The accuracy scoreboard (docs/accuracy.md, scripts/accuracy.ts): it says what the committed log verdict snapshots
// give, so a change to a verdict can't land without its accuracy change in the scoreboard's diff; and the fit measure
// that tells a better log from a worse one.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { direction, directionSummary, groupOf, readSnapshots, readSplit, render, ROOT, SCOREBOARD, type Entry, type Snapshots } from "../scripts/accuracy.ts";

describe("accuracy scoreboard", () => {
  it("is what the log verdict snapshots give (after a snapshot change: npm run accuracy, or npm run snapshots:update)", () => {
    expect(readFileSync(join(ROOT, SCOREBOARD), "utf8")).toBe(render(readSnapshots()));
  });

  it("puts every pending log in one group: development, hold-out, or imported before the split", () => {
    const split = readSplit();
    expect([...split.development].filter((id) => split.holdout.has(id))).toEqual([]);
    expect(groupOf("zmdlogs-x.json", split)).toBe("verified");
    const [d] = split.development;
    const [h] = split.holdout;
    expect(groupOf(`pending/${d}.json`, split)).toBe("development");
    expect(groupOf(`holdout/${h}.json`, split)).toBe("holdout");
    expect(groupOf(`pending/${h}.json`, split)).toBe("holdout");
    expect(groupOf("pending/zmdlogs-none.json", split)).toBe("earlier");
  });

  it("keeps the hold-out logs apart: fixtures/holdout/ holds exactly them, no other directory holds one (by file name only)", () => {
    const split = readSplit();
    const names = (d: string) => readdirSync(join(ROOT, d)).filter((f) => f.startsWith("zmdlogs-")).map((f) => f.replace(/\.json$/, ""));
    expect(names("fixtures/holdout").sort()).toEqual([...split.holdout].sort());
    for (const d of ["fixtures", "fixtures/pending", "fixtures/multi-target"]) expect(names(d).filter((id) => split.holdout.has(id)), d).toEqual([]);
  });
});

describe("the fit measure (direction)", () => {
  const counts = (plain: number, mismatch: number, assumed = 0) => ({ plain, assumed, fallback: 0, mismatch, unvalued: 0, unquantified: 0, uncovered: 0 });
  const log = (plain: number, mismatch: number, damage: number | null, assumed = 0): Entry => ({ op: counts(plain, mismatch, assumed), totals: { damage } });

  it("better: more plain matches, fewer mismatches or a smaller |total damage error|, and none of them worse", () => {
    expect(direction(log(10, 5, -8), log(12, 3, -8))).toBe("better");
    expect(direction(log(10, 5, -8), log(10, 5, 6))).toBe("better");
    expect(direction(log(10, 5, -8), log(10, 5, -8.1))).toBe("worse");
    expect(direction(log(10, 5, 2), log(9, 5, 1))).toBe("mixed");
    expect(direction(log(10, 5, 2, 1), log(10, 5, 2, 2))).toBe("other");
    expect(direction(log(10, 5, 2), log(10, 5, 2))).toBe("same");
    expect(direction(log(10, 5, 2), log(10, 5, null))).toBe("worse");
  });

  it("counts hold-out logs only by group, and names the others", () => {
    const split = { development: new Set(["zmdlogs-d"]), holdout: new Set(["zmdlogs-h"]) };
    const at = (d: number, h: number): Snapshots => ({ verified: {}, pending: { "pending/zmdlogs-d.json": log(d, 0, 1), "pending/zmdlogs-h.json": log(h, 0, 1) }, split });
    const lines = directionSummary(at(1, 1), at(2, 0));
    expect(lines.some((l) => l.includes("zmdlogs-d") && l.includes("better"))).toBe(true);
    expect(lines.some((l) => l.includes("zmdlogs-h"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Hold-out") && l.includes("0 better, 1 worse"))).toBe(true);
    expect(directionSummary(at(1, 1), at(1, 1))).toEqual(["No log's verdicts moved."]);
    // A hold-out moved to fixtures/holdout/ is the same log as under pending/ at an older ref.
    const moved: Snapshots = { verified: {}, pending: { "pending/zmdlogs-d.json": log(1, 0, 1), "holdout/zmdlogs-h.json": log(1, 0, 1) }, split };
    expect(directionSummary(at(1, 1), moved)).toEqual(["No log's verdicts moved."]);
  });
});
