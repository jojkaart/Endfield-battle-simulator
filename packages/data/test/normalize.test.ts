import { describe, expect, it } from "vitest";
import { DataError, normalizeBattleConst, normalizeOperators, normalizeSkills } from "../src/index.ts";

// Tiny inputs in each source's format, shaped like the real tables.
const rmxSkill = {
  chr_x_normal_skill: {
    SkillPatchDataBundle: [
      { skillId: "chr_x_normal_skill", level: 1, coolDown: 0.0, costType: 1, costValue: 100.0, maxChargeTime: 1,
        blackboard: [{ key: "atk_scale", value: 1.7799999713897705, valueStr: "" }, { key: "poise", value: 10.0, valueStr: "" }] },
      { skillId: "chr_x_normal_skill", level: 2, coolDown: 0.0, costType: 1, costValue: 100.0, maxChargeTime: 1,
        blackboard: [{ key: "atk_scale", value: 1.9600000381469727, valueStr: "" }] },
    ],
  },
};
const me555Skill = {
  chr_x_normal_skill: {
    SkillPatchDataBundle: [
      { skillId: "chr_x_normal_skill", level: "1", coolDown: "0", costType: "1", costValue: "100", maxChargeTime: "1",
        blackboard: [{ key: "atk_scale", value: 1.78, valueStr: "" }, { key: "poise", value: "10", valueStr: "" }] },
      { skillId: "chr_x_normal_skill", level: "2", coolDown: "0", costType: "1", costValue: "100", maxChargeTime: "1",
        blackboard: [{ key: "atk_scale", value: 1.96, valueStr: "" }] },
    ],
  },
};

describe("normalizeSkills", () => {
  it("reads both source formats", () => {
    const rmx = normalizeSkills(rmxSkill, "rmxlinux");
    const me = normalizeSkills(me555Skill, "555me");
    expect(rmx["chr_x_normal_skill"]?.levels[0]).toEqual({
      level: 1, coolDown: 0, costType: 1, costValue: 100, maxChargeTime: 1,
      blackboard: { atk_scale: 1.7799999713897705, poise: 10 },
    });
    expect(me["chr_x_normal_skill"]?.levels[0]?.blackboard).toEqual({ atk_scale: 1.78, poise: 10 });
  });

  it("rejects string numbers from rmxlinux", () => {
    expect(() => normalizeSkills(me555Skill, "rmxlinux")).toThrow(DataError);
  });

  it("accepts a repeated blackboard key with the same value", () => {
    const repeat = structuredClone(rmxSkill);
    repeat.chr_x_normal_skill.SkillPatchDataBundle[0]?.blackboard.push({ key: "poise", value: 10, valueStr: "" });
    expect(normalizeSkills(repeat, "rmxlinux")["chr_x_normal_skill"]?.levels[0]?.blackboard["poise"]).toBe(10);
  });

  it("rejects levels out of order, conflicting keys and mismatched IDs", () => {
    const swapped = { chr_x_normal_skill: { SkillPatchDataBundle: [...rmxSkill.chr_x_normal_skill.SkillPatchDataBundle].reverse() } };
    expect(() => normalizeSkills(swapped, "rmxlinux")).toThrow(/out of order/);
    const dup = structuredClone(rmxSkill);
    dup.chr_x_normal_skill.SkillPatchDataBundle[0]?.blackboard.push({ key: "poise", value: 1, valueStr: "" });
    expect(() => normalizeSkills(dup, "rmxlinux")).toThrow(/conflicting blackboard key poise: 10 and 1/);
    expect(() => normalizeSkills({ other: rmxSkill.chr_x_normal_skill }, "rmxlinux")).toThrow(/under key other/);
  });
});

describe("normalizeBattleConst", () => {
  const keys = ["atkRateOfMain", "atkRateOfSub", "charDmgResistMinValue", "charResistanceMaxValue",
    "commonResistanceMaxValue", "efficiencyOfAGI", "efficiencyOfDEF", "efficiencyOfSTR", "efficiencyOfWISD",
    "enemyOHKCoefficient", "healerEfficiencyOfWILL", "maxUltimateSp", "poiseBreakDamageLevelModifier",
    "recoverEfficiencyOfWILL"];
  const full = Object.fromEntries(keys.map((k) => [k, 1]));

  it("fails on unknown or missing keys", () => {
    expect(normalizeBattleConst(full, "rmxlinux").maxUltimateSp).toBe(1);
    expect(() => normalizeBattleConst({ ...full, newConst: 2 }, "rmxlinux")).toThrow(/unknown keys newConst/);
    const { maxUltimateSp: _, ...missing } = full;
    expect(() => normalizeBattleConst(missing, "rmxlinux")).toThrow(/missing field "maxUltimateSp"/);
  });
});

describe("normalizeOperators", () => {
  it("reads level rows with numeric attribute types", () => {
    const raw = {
      chr_x: {
        charId: "chr_x", rarity: "6", profession: "8", weaponType: "1", charTypeId: "Fire", mainAttrType: "41", subAttrType: "39",
        attributes: [{ breakStage: "0", Attribute: { attrs: [{ attrType: "0", attrValue: "1" }, { attrType: "39", attrValue: 13.6082474226804 }] } }],
      },
    };
    expect(normalizeOperators(raw, "555me")["chr_x"]).toEqual({
      charId: "chr_x", rarity: 6, profession: 8, weaponType: 1, element: "Fire", mainAttrType: 41, subAttrType: 39,
      levelRows: [{ breakStage: 0, attrs: { 0: 1, 39: 13.6082474226804 } }],
    });
  });
});
