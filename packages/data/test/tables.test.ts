// Runs against the real game tables in the data/ submodules.
import { describe, expect, it } from "vitest";
import {
  compare,
  loadBattleConst,
  loadOperators,
  loadSkills,
  readTable,
  sourceCommit,
  SOURCES,
} from "../src/index.ts";

describe("cross-check between the two data sources", () => {
  // Design: the tables the engine uses must agree exactly between
  // rmxlinux and 555me (docs/design.md#fixtures-and-tests).
  it("BattleConst agrees", () => {
    expect(compare(loadBattleConst("rmxlinux"), loadBattleConst("555me"))).toEqual([]);
  });

  it("SkillPatchTable agrees", () => {
    const diffs = compare(loadSkills("rmxlinux"), loadSkills("555me"));
    expect(diffs.slice(0, 20)).toEqual([]);
  });

  it("CharacterTable agrees", () => {
    const diffs = compare(loadOperators("rmxlinux"), loadOperators("555me"));
    expect(diffs.slice(0, 20)).toEqual([]);
  });
});

describe("spot checks against values verified elsewhere", () => {
  // docs/data-sources.md, "Spot-check results" and "Consensus" (2026-10-18).
  const skills = loadSkills("rmxlinux");
  const constants = loadBattleConst("rmxlinux");

  it("Perlica battle skill multiplier is 178% at rank 1 and 400% at rank 12", () => {
    const levels = skills["chr_0004_pelica_normal_skill"]?.levels;
    expect(levels?.length).toBe(12);
    expect(levels?.[0]?.blackboard["atk_scale"]).toBe(Math.fround(1.78));
    expect(levels?.[11]?.blackboard["atk_scale"]).toBe(4);
    expect(levels?.[0]?.costType).toBe(1);
    expect(levels?.[0]?.costValue).toBe(100);
  });

  it("ATK attribute rates and DEF efficiency are 0.5%, 0.2% and 0.01", () => {
    expect(constants.atkRateOfMain).toBe(Math.fround(0.005));
    expect(constants.atkRateOfSub).toBe(Math.fround(0.002));
    expect(constants.efficiencyOfDEF).toBe(Math.fround(0.01));
    expect(constants.maxUltimateSp).toBe(100);
  });
});

describe("provenance", () => {
  it("reads each source's commit", () => {
    for (const source of SOURCES) expect(sourceCommit(source)).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("table list", () => {
  it("refuses tables not listed for fetching", () => {
    expect(() => readTable("rmxlinux", "WeaponBasicTable")).toThrow(/isn't listed in packages\/data\/tables.json/);
  });
});
