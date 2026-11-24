// scripts/fetch-data.ts (round 10: from fetch-data.sh): the sparse patterns and the "every file there" check.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { globMatches, patternsOf } from "../scripts/fetch-data.ts";

const dir = mkdtempSync(join(tmpdir(), "efsim-fetch-data-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("fetch-data", () => {
  it("makes a pattern per table and per JSON glob, from the submodule's root", () => {
    const t = { tables: ["SkillPatchTable", "CharacterTable"], json: { SkillData: ["wpn_*"], BuffData: ["buff_common_*"] } };
    expect(patternsOf(t, "TableCfg", "Json")).toEqual({
      files: ["/TableCfg/SkillPatchTable.json", "/TableCfg/CharacterTable.json"],
      globs: ["/Json/SkillData/wpn_*.json", "/Json/BuffData/buff_common_*.json"],
    });
    expect(patternsOf(t, "tableCfg").globs).toEqual([]);
  });

  it("matches a glob's last part against the files of its folder", () => {
    mkdirSync(join(dir, "Json", "SkillData"), { recursive: true });
    writeFileSync(join(dir, "Json", "SkillData", "wpn_sword_01.json"), "{}");
    expect(globMatches(dir, "/Json/SkillData/wpn_*.json")).toBe(true);
    expect(globMatches(dir, "/Json/SkillData/chr_*.json")).toBe(false);
    expect(globMatches(dir, "/Json/BuffData/buff_*.json")).toBe(false);
    // A dot in the name is literal.
    expect(globMatches(dir, "/Json/SkillData/wpn_sword_01xjson")).toBe(false);
  });
});
