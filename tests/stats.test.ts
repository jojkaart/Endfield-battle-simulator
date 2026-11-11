// Stat panel expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clampAttr, computeStats, Attr, skillLevel, skillParam, skillValue, type Build, type SkillData, type StatPanel } from "@efsim/engine";
import { loadGameData, sourceCommit, SOURCES } from "@efsim/data";
import { loadFixtures } from "./fixtures.ts";

const data = loadGameData();
const fixtures = loadFixtures();

function statValue(panel: StatPanel, stat: string): number {
  if (stat.startsWith("atk.")) {
    const key = stat.slice(4) as keyof StatPanel["atk"];
    const v = panel.atk[key];
    if (typeof v !== "number") throw new Error(`unknown stat ${stat}`);
    return v;
  }
  const attr = (Attr as Record<string, number>)[stat];
  if (attr === undefined) throw new Error(`unknown stat ${stat}`);
  return panel.attrs[attr]?.total ?? 0;
}

describe.each(fixtures)("$file", ({ fixture }) => {
  it("was verified against the current data commits", () => {
    // A data update changes these; review the fixture, then update them (design principle 11).
    expect(fixture.provenance.verifiedAgainst).toEqual(Object.fromEntries(SOURCES.map((s) => [s, sourceCommit(s)])));
  });

  const stats = fixture.expected.stats ?? [];
  if (stats.length === 0) return;
  const panel = computeStats(data, fixture.build);
  it.each(stats)("$stat = $expected", ({ stat, expected, display, tolerance }) => {
    const actual = statValue(panel, stat);
    if (display === "floor") expect(Math.floor(actual)).toBe(expected);
    else if (tolerance !== undefined) expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
    else expect(actual).toBe(expected);
  });
});

describe("weapon type", () => {
  it("a weapon of another type is flagged but still simulated", () => {
    const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
    const own = computeStats(data, fixture.build);
    expect(own.warnings).toEqual([]);
    const other = Object.values(data.weapons).find((w) => w.weaponType !== data.operators[fixture.build.operator]?.weaponType);
    if (!other || !fixture.build.weapon) throw new Error("no weapon of another type");
    const panel = computeStats(data, { ...fixture.build, weapon: { ...fixture.build.weapon, id: other.id } });
    expect(panel.warnings).toHaveLength(1);
    expect(panel.atk.total).toBeGreaterThan(0);
  });
});

describe("effects limited to a mode (activeCondition)", () => {
  it("Arcane's talent cuts her combo cooldown by 6 s in INT mode only", () => {
    const will = JSON.parse(readFileSync(new URL("../examples/arcane-will.json", import.meta.url), "utf8")) as Build;
    const fx = JSON.parse(readFileSync(new URL("../fixtures/pending/zmdlogs-d9e59d0fb737.json", import.meta.url), "utf8")) as { team: Build[] };
    const int = fx.team.find((b) => b.operator === "chr_0032_lizhiyan") as Build;
    const id = "chr_0032_lizhiyan_combo_skill";
    const cd = (b: Build) => {
      const p = computeStats(data, b);
      expect((p.attrs[Attr.Wisd]?.total ?? 0) >= (p.attrs[Attr.Will]?.total ?? 0)).toBe(b === int);
      return skillParam(p, id, "cooldown", skillLevel(data.skills[id] as SkillData, b.skillLevels.combo).coolDown);
    };
    const base = (b: Build) => skillLevel(data.skills[id] as SkillData, b.skillLevels.combo).coolDown;
    expect(cd(will)).toBe(base(will));
    expect(cd(int)).toBe(base(int) - 6);
  });
});

describe("value sources beyond the operator's skills", () => {
  it("talent-attached skills and buffs, and weapon skills, are readable at the build's levels", () => {
    const will = JSON.parse(readFileSync(new URL("../examples/arcane-will.json", import.meta.url), "utf8")) as Build;
    const p = computeStats(data, will);
    // Arcane's talent 1 attaches chr_0032_lizhiyan_talent1 (duration 10 s at every level).
    expect(skillValue(data, p, will, "chr_0032_lizhiyan_talent1", "duration")).toBe(10);
    const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
    const lp = computeStats(data, fixture.build);
    // Laevatain's talent 1 attaches buff_chr_0016_laevat_passive with ignore_fire_resist.
    expect(skillValue(data, lp, fixture.build, "buff_chr_0016_laevat_passive", "ignore_fire_resist")).toBeLessThan(0);
    // Her weapon's skills, at the build's weapon skill levels.
    const wSkill = data.weapons[fixture.build.weapon?.id ?? ""]?.skills[2] as string;
    expect(Object.keys(lp.sources)).toContain(wSkill);
    expect(() => skillValue(data, lp, fixture.build, "nope", "x")).toThrow(/isn't one of/);
  });
});

describe("reaction level coefficients from the panel (round-two review)", () => {
  it("CharacterTable's attributes 25 and 49 are 1 + (Lv − 1) / 392 and / 196 at the operator's level", () => {
    const [first] = loadFixtures();
    if (!first) throw new Error("no fixtures");
    for (const level of [80, 85, 90]) {
      const panel = computeStats(data, { ...first.fixture.build, level });
      expect(panel.attrs[Attr.PhysicalInflictionDamageScalar]?.total).toBeCloseTo(1 + (level - 1) / 392, 12);
      expect(panel.attrs[Attr.IgniteDamageScalar]?.total).toBeCloseTo(1 + (level - 1) / 196, 12);
    }
  });
});

describe("attribute limits from AttributeMetaTable (round-two review)", () => {
  it("loads Haste's 0.1–1.3 and the floors, and holds a value within them", () => {
    expect(data.attributeLimits[Attr.KeywordSpeedUpScalar]).toEqual({ min: 0.1, max: 1.3 });
    expect(data.attributeLimits[Attr.PoiseDamageOutputScalar]).toEqual({ min: 0 });
    expect(data.attributeLimits[Attr.CriticalRate]).toBeUndefined();
    expect([0, 1, 2].map((v) => clampAttr(data, Attr.KeywordSpeedUpScalar, v))).toEqual([0.1, 1, 1.3]);
    expect(clampAttr(data, Attr.CriticalRate, 1.5)).toBe(1.5);
  });
});

describe("weapons below their maximum (the owner: Arcane builds keep a weapon skill low on purpose)", () => {
  // Logs with sub-max weapons: d774 (Liino's [9, 6, 4] at level 80), a7a7 ([9, 8, 4]), 1d91 ([9, 4, 4]).
  const will = JSON.parse(readFileSync(new URL("../examples/arcane-will.json", import.meta.url), "utf8")) as Build;
  const at = (skillLevels: [number, number, number], level = 90): Build => ({ ...will, weapon: { id: "wpn_funnel_0016", level, skillLevels } });
  const wisd = (b: Build) => computeStats(data, b).attrs[Attr.Wisd]?.total ?? NaN;

  it("a stat skill gives its own level's value", () => {
    // wpn_attr_wisd_high: Intellect +20, +36, … +156 at levels 1–9 (SkillPatchTable), no Intellect % in this build.
    const table = (data.skills["wpn_attr_wisd_high"] as SkillData).levels.map((l) => l.blackboard["wisd"] as number);
    for (let l = 1; l <= 9; l++) expect(wisd(at([l, 9, 5])) - wisd(at([1, 9, 5]))).toBeCloseTo((table[l - 1] as number) - (table[0] as number), 6);
    // Arcane's mode follows the panel: this WILL build stays WILL at every level of her Intellect skill.
    for (const l of [1, 9]) expect(computeStats(data, at([l, 9, 5])).attrs[Attr.Will]?.total ?? 0).toBeGreaterThan(wisd(at([l, 9, 5])));
  });

  it("the unique skill's values come from its level, and the weapon's base ATK from the weapon's level", () => {
    const value = (b: Build) => skillValue(data, computeStats(data, b), b, "sk_wpn_funnel_0016", "atk_up");
    const levels = (data.skills["sk_wpn_funnel_0016"] as SkillData).levels;
    expect(value(at([9, 9, 1]))).toBe(levels[0]?.blackboard["atk_up"]);
    expect(value(at([9, 9, 4]))).toBe(levels[3]?.blackboard["atk_up"]);
    expect(value(at([9, 9, 4]))).toBeLessThan(value(at([9, 9, 9])));
    const base = (lv: number) => computeStats(data, at([9, 9, 5], lv)).atk.weaponBase;
    expect(base(80)).toBe(data.weapons["wpn_funnel_0016"]?.baseAtk[79]);
    expect(base(80)).toBeLessThan(base(90));
  });
});
