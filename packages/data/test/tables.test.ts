// Runs against the real game tables in the data/ submodules.
import { describe, expect, it } from "vitest";
import {
  compare,
  loadAttributeDefaults,
  loadBattleConst,
  loadEffects,
  loadEnemies,
  loadGameData,
  loadGear,
  loadGearSets,
  loadGrowth,
  loadOperators,
  loadPotentials,
  loadSkills,
  loadWeaponCurves,
  loadWeapons,
  readSkillFile,
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

  it.each([
    ["CharGrowthTable", loadGrowth],
    ["CharacterPotentialTable", loadPotentials],
    ["PotentialTalentEffectTable", loadEffects],
    ["WeaponBasicTable", loadWeapons],
    ["WeaponUpgradeTemplateTable", loadWeaponCurves],
    ["EquipTable", loadGear],
    ["EquipSuitTable", loadGearSets],
    ["EnemyAttributeTemplateTable", loadEnemies],
    ["AttributeMetaTable", loadAttributeDefaults],
  ] as const)("%s agrees", (_name, load) => {
    const diffs = compare(load("rmxlinux"), load("555me"));
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
  it("refuses tables and skill files not listed for fetching", () => {
    expect(() => readTable("rmxlinux", "GachaPoolTable")).toThrow(/isn't listed in packages\/data\/tables.json/);
    expect(() => readSkillFile("chr_0004_pelica_attack1")).toThrow(/isn't covered by packages\/data\/tables.json/);
  });
});

describe("assembled game data", () => {
  // Values verified 2026-10-18 against Zero Sanity's in-game stat panel
  // (Laevatain, 2026-03-15) and the Talos Wiki; see docs/data-sources.md.
  const data = loadGameData();

  it("Laevatain: Lv90 base stats, attribute nodes, potential 2", () => {
    const op = data.operators["chr_0016_laevat"];
    expect(op?.name).toBe("Laevatain");
    expect(op?.mainAttr).toBe(41);
    expect(op?.subAttr).toBe(39);
    const row = op?.levelRows.find((r) => r.level === 90 && r.breakStage === 4);
    expect(row?.attrs[2]).toBe(318);
    expect(row?.attrs[41]).toBeCloseTo(177.985, 3);
    expect(op?.attributeNodes.map((n) => n.modifiers[0]?.value)).toEqual([10, 15, 15, 20]);
    expect(op?.potentials[1]).toEqual([
      { kind: "attr", modifier: { attr: 41, slot: 5, target: 0, value: 20 } },
      // Stored as a double (0.15), unlike SkillPatchTable's float32 values.
      { kind: "attr", modifier: { attr: 17, slot: 5, target: 0, value: 0.15 } },
    ]);
  });

  it("Forgeborn Scathe: 510 ATK at Lv90, three skills with stat effects", () => {
    const w = data.weapons["wpn_sword_0006"];
    expect(w?.name).toBe("Forgeborn Scathe");
    expect(w?.baseAtk[89]).toBe(510);
    expect(w?.skills).toEqual(["wpn_attr_wisd_high", "wpn_sp_attr_atk_high", "sk_wpn_sword_0006"]);
    expect(data.skills["wpn_attr_wisd_high"]?.statModifiers).toEqual([{ attr: 41, slot: 5, target: 0, key: "wisd", literal: 1231313 }]);
    expect(data.skills["sk_wpn_sword_0006"]?.statModifiers.map((m) => [m.attr, m.key])).toEqual([[51, "fire_dmg_up"]]);
  });

  it("gear: Hot Work Gauntlets lines by artificing level, set name", () => {
    const g = data.gear["item_equip_t4_suit_fire_natr01_hand_02"];
    expect(g?.name).toBe("Hot Work Gauntlets");
    expect(g?.lines.map((l) => [l.attr, l.values[3]])).toEqual([
      [3, 42], [41, 84], [39, 55], [51, 0.2491666666666667], [54, 0.2491666666666667],
    ]);
    expect(data.gearSets["suit_burst01"]?.name).toBe("Tide Surge");
  });

  it("Rhodagn: Lv90 HP, DEF, no resistances", () => {
    const e = data.enemies["eny_0051_rodin"];
    expect(e?.name).toBe("Rhodagn the Bonekrushing Fist");
    expect(e?.levels[89]).toEqual({ 0: 90, 1: 2292909, 2: 4130, 3: 100 });
    expect(e?.resistance.fire).toBe(0);
    expect(e?.staticAttrs[20]).toBe(280);
  });
});
