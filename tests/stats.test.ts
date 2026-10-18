// Stat panel expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeStats, Attr, skillLevel, skillParam, skillValue, type Build, type SkillData, type StatPanel } from "@efsim/engine";
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
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-d9e59d0fb737.json", import.meta.url), "utf8")) as { team: Build[] };
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
