// scripts/lead-files.ts (round 13, damage-factors report point 1): the code files of the commits naming a lead, for the
// lead's file split. Pure: a synthetic history.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES, familyCounts, isCode, leadFiles, parseSplit, splitSpans } from "../scripts/lead-files.ts";
import { ROOT } from "./logverdicts.ts";

describe("lead-files", () => {
  it("counts the code files of the commits whose message names each term, most first", () => {
    const log = [
      { commit: "a", message: "0c14: Si's away press", files: ["packages/logs/src/buffreplay.ts", "docs/open-problems.md", "tests/snapshots/log-verdicts.json"] },
      { commit: "b", message: "The check: 0C14's Crush", files: ["packages/logs/src/enginecheck.ts", "packages/logs/src/buffreplay.ts", "tests/buffreplay.test.ts"] },
      { commit: "c", message: "kits: Ember", files: ["packages/data/kits/operators/ember.json", "fixtures/pending/zmdlogs-x.json"] },
    ];
    const got = leadFiles(log, ["0c14", "ember", "nothing"]);
    expect(got.get("0c14")).toEqual({ commits: 2, files: [["packages/logs/src/buffreplay.ts", 2], ["packages/logs/src/enginecheck.ts", 1], ["tests/buffreplay.test.ts", 1]] });
    expect(got.get("ember")?.files).toEqual([["packages/data/kits/operators/ember.json", 1]]);
    expect(got.get("nothing")).toEqual({ commits: 0, files: [] });
    expect(isCode("tests/snapshots/kits.json")).toBe(false);
    expect(isCode("scripts/measure.ts")).toBe(true);
  });

  it("lists every family's files, each of which exists (--family; round 15)", () => {
    for (const [name, files] of Object.entries(FAMILIES)) for (const f of files) expect(existsSync(join(ROOT, f)), `${name}: ${f}`).toBe(true);
    expect(FAMILIES["replay"]).toContain("packages/logs/src/castassembly.ts");
  });

  // Round 19 (the break follow-ups report point 1): a lead whose earlier fixes touched two agents' files is SHARED.
  it("says which agents of a split a lead's files fall to (--split)", () => {
    const split = [parseSplit("a=family:holds"), parseSplit("b=packages/logs/src/logcasts.ts,packages/logs/src/castpairs.ts")];
    expect(split[0]?.files).toContain("packages/logs/src/holds.ts");
    const found = new Map([
      ["break", { files: [["packages/logs/src/holds.ts", 3], ["packages/logs/src/logcasts.ts", 2], ["tests/holds.test.ts", 1]] as [string, number][] }],
      ["slug", { files: [["packages/logs/src/holds.ts", 1]] as [string, number][] }],
    ]);
    const spans = splitSpans(found, split);
    expect(spans.get("break")).toEqual({ agents: [["a", 3], ["b", 2]], shared: true });
    expect(spans.get("slug")).toEqual({ agents: [["a", 1]], shared: false });
    expect(() => parseSplit("a=family:nope")).toThrow(/no family nope/);
  });
});

describe("lead-files by family (round 24)", () => {
  it("counts the commits naming a term per family of the files they touched, other for the rest", () => {
    // The combo-openers report point 3: a "placement lead" was fixed in the replay's makeCast.
    const log = [
      { message: "openers: makeCast takes the window", files: ["packages/logs/src/replayrun.ts", "tests/x.test.ts"] },
      { message: "openers: the INSIDE words", files: ["packages/logs/src/decisionsview.ts", "packages/logs/src/replayrun.ts"] },
      { message: "openers: a script", files: ["scripts/probes/x.ts"] },
      { message: "openers: docs", files: ["docs/x.md"] },
      { message: "something else", files: ["packages/logs/src/logcasts.ts"] },
    ];
    expect(familyCounts(log, "Openers")).toEqual([["replay", 2], ["other", 1], ["views", 1]]);
  });
});
