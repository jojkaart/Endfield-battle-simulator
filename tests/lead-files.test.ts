// scripts/lead-files.ts (round 13, damage-factors report point 1): the code files of the commits naming a lead, for the
// lead's file split. Pure: a synthetic history.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES, isCode, leadFiles } from "../scripts/lead-files.ts";
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
});
