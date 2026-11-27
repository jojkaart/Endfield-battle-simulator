// The hit records' cache (packages/logs/src/reports.ts): read from this checkout's scratch/hits-cache/, then from the
// main checkout's and other worktrees' at the same code key (round 9 friction point 4), written only here.

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mainCheckoutOf, REPO_ROOT } from "@efsim/data";
import { cacheReadPaths, oneSidedJson, skipFights } from "../packages/logs/src/reports.ts";
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

  it("gives each line its share of the fight's logged total and the fight's own facts (round 18)", () => {
    const o = (damage: number): OneSided => ({ side: damage > 0 ? "replay" : "log", operator: "a", t: 1000, damage, key: "k", skill: "battle", nature: "kit hit", context: "cast tail", flags: [] });
    const [line] = oneSidedJson([{ fight: "9c6e", group: "targets", oneSided: [o(-2500)], logged: 100000, fightError: -12.34567, severalTargets: true }]).split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(line).toMatchObject({ fight: "9c6e", group: "targets", damage: -2500, share: -2.5, logged: 100000, fightError: -12.346, severalTargets: true });
    expect(line).not.toHaveProperty("stage");
  });
});

describe("zmdlogs totals --skip (round 18, the log-only report point 1)", () => {
  const f = (id: string, stage = false, severalTargets = false) => ({ file: `/x/fixtures/pending/zmdlogs-${id}.json`, stage, severalTargets });
  const fights = [f("9c6e97486a9d", false, true), f("6339aaaa0000", true), f("0c14fb3ce77d")];
  it("leaves out fights by id, stage and several targets", () => {
    expect(skipFights(fights, ["9c6e,stage"]).kept.map((x) => x.file)).toEqual([fights[2]?.file]);
    expect(skipFights(fights, ["several"]).skipped).toHaveLength(1);
    expect(skipFights(fights, []).kept).toHaveLength(3);
  });
  it("refuses an id no fight has", () => {
    expect(() => skipFights(fights, ["beef"])).toThrow(/no selected fight/);
  });
});
