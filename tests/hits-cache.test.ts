// The hit records' cache (packages/logs/src/reports.ts): read from this checkout's scratch/hits-cache/, then from the
// main checkout's and other worktrees' at the same code key (round 9 friction point 4), written only here.

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mainCheckoutOf, REPO_ROOT } from "@efsim/data";
import { cacheReadPaths, oneSidedJson } from "../packages/logs/src/reports.ts";
import type { OneSided } from "../packages/logs/src/onesided.ts";

describe("the hit records' cache", () => {
  it("reads this checkout's entry first, then the same path in the main checkout and its worktrees", () => {
    const own = join(REPO_ROOT, "scratch/hits-cache/abc/zmdlogs-x-123.json");
    const paths = cacheReadPaths(own);
    expect(paths[0]).toBe(own);
    expect(paths.slice(1).every((p) => p.endsWith("/scratch/hits-cache/abc/zmdlogs-x-123.json") && p !== own)).toBe(true);
    const main = mainCheckoutOf(REPO_ROOT);
    if (main) expect(paths).toContain(join(main, "scratch/hits-cache/abc/zmdlogs-x-123.json"));
  });
});

describe("zmdlogs totals --all --json (one-sided report point 1)", () => {
  it("prints every one-sided landing as a JSON line with its fight and group, largest |damage| first, by operator", () => {
    const o = (operator: string, damage: number): OneSided => ({ side: damage > 0 ? "replay" : "log", operator, t: 1000, damage, key: "k", skill: "battle", nature: "kit hit", context: "cast tail", flags: [] });
    const lines = oneSidedJson([{ fight: "0c14", group: "development", oneSided: [o("a", 10), o("b", -30), o("a", 20)] }]).split("\n").map((l) => JSON.parse(l) as { fight: string; group: string; operator: string; damage: number });
    expect(lines.map((l) => l.damage)).toEqual([-30, 20, 10]);
    expect(lines.every((l) => l.fight === "0c14" && l.group === "development")).toBe(true);
    expect(oneSidedJson([{ fight: "0c14", group: "development", oneSided: [o("a", 10), o("b", -30)] }], ["a"]).split("\n")).toHaveLength(1);
  });
});
