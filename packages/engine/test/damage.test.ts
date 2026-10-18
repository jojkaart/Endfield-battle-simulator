// Formula zones and invariants on a small synthetic data set, independent of the game tables.
import { describe, expect, it } from "vitest";
import {
  Attr,
  computeHit,
  computeStats,
  STAGGER_DAMAGE_TAKEN,
  type Build,
  type DamageOptions,
  type GameData,
  type KitHit,
  type KitSkill,
  type Modifier,
  attrModifier,
} from "../src/index.ts";

function gameData(over: { def?: number; fireRes?: number; atkPercent?: number } = {}): GameData {
  return {
    provenance: { sources: [] },
    constants: { atkRateOfMain: 0.005, atkRateOfSub: 0.002, efficiencyOfDEF: 0.01, maxUltimateSp: 100 },
    attributeDefaults: { [Attr.CriticalDamageIncrease]: 0.5 },
    operators: {
      op: {
        id: "op", name: "Op", rarity: 6, element: "fire", profession: 1, weaponType: 1, mainAttr: Attr.Wisd, subAttr: Attr.Str,
        levelRows: [{ breakStage: 0, level: 1, attrs: { 0: 1, [Attr.Atk]: 100, [Attr.Wisd]: 100.9, [Attr.Str]: 50.5, [Attr.CriticalRate]: 0.05 } }],
        skillGroups: { op_skill: "battle" }, attributeNodes: [], talentNodes: [], potentials: [],
      },
    },
    skills: {
      op_skill: { id: "op_skill", fileLoaded: true, timing: { durationFrames: 60, exclusiveFrames: 20, windows: [{ from: 15, to: 30, skills: [] }], channels: [], specification: 3, keepsChain: false, slowdowns: [] }, defaults: { ratio: 1 }, statModifiers: [],
        levels: [{ level: 1, blackboard: { atk_scale: 2 }, coolDown: 0, costType: 1, costValue: 100 }] },
      wpn_stat: { id: "wpn_stat", fileLoaded: true, timing: null, defaults: {}, statModifiers: [{ attr: Attr.Atk, slot: 6, target: 0, key: "atk", literal: 0 }],
        levels: [{ level: 1, blackboard: { atk: over.atkPercent ?? 0.5 }, coolDown: 0, costType: 0, costValue: 0 }] },
    },
    weapons: { wpn: { id: "wpn", name: "Wpn", rarity: 6, weaponType: 1, maxLevel: 1, baseAtk: [100], skills: ["wpn_stat", "wpn_stat", "wpn_stat"] } },
    gear: {}, gearSets: {},
    enemies: { eny: { id: "eny", name: "Eny", levels: [{ 0: 1, [Attr.Def]: over.def ?? 100 }], staticAttrs: {},
      resistance: { physical: 0, fire: over.fireRes ?? 0, pulse: 0, cryst: 0, natural: 0, ether: 0 }, finisherSp: 0, staggerNodes: [] } },
    kits: { operators: {}, equipment: {} },
  };
}

const build: Build = {
  operator: "op", level: 1, promotion: 0, potential: 0,
  skillLevels: { basic: 1, battle: 1, combo: 1, ultimate: 1 },
  weapon: { id: "wpn", level: 1, skillLevels: [1, 1, 1] }, gear: [],
};
const skill: KitSkill = { skillId: "op_skill", label: "Skill", kind: "battle", hits: [] };
const hit: KitHit = { id: "hit", label: "Hit", scale: ["atk_scale", "ratio"], count: 1, events: [], damageType: "battle", element: "fire" };
const never: DamageOptions = { crit: "never", staggered: false, conditions: [] };

function damage(data: GameData, options: DamageOptions = never) {
  return computeHit(data, build, computeStats(data, build), { enemy: "eny", level: 1 }, skill, hit, options);
}

describe("stats", () => {
  it("ATK = (operator + weapon) × (1 + ATK%) × (1 + whole main × 0.005 + whole sub × 0.002)", () => {
    const panel = computeStats(gameData(), build);
    // Three weapon skills of +50% each: 1.5 total.
    expect(panel.atk.percent).toBeCloseTo(1.5);
    expect(panel.atk.mainAttribute).toBe(100);
    expect(panel.atk.secondaryAttribute).toBe(50);
    expect(panel.atk.total).toBeCloseTo(200 * 2.5 * (1 + 0.5 + 0.1));
  });

  it("exact attributes when flooring is off", () => {
    const panel = computeStats(gameData(), build, { floorAttributes: false });
    expect(panel.atk.mainAttribute).toBeCloseTo(100.9);
  });
});

describe("damage zones", () => {
  it("DEF 0 takes full damage; DEF 100 halves it", () => {
    expect(damage(gameData({ def: 0 })).zones.defense).toBe(1);
    expect(damage(gameData({ def: 100 })).zones.defense).toBeCloseTo(0.5);
  });

  it("resistance points reduce damage linearly", () => {
    expect(damage(gameData({ fireRes: 20 })).zones.resistance).toBeCloseTo(0.8);
  });

  it("crit modes: never 1, always 1 + crit DMG, expected 1 + rate × crit DMG", () => {
    const data = gameData();
    expect(damage(data, never).zones.crit).toBe(1);
    expect(damage(data, { ...never, crit: "always" }).zones.crit).toBe(1.5);
    expect(damage(data, { ...never, crit: "expected" }).zones.crit).toBeCloseTo(1.025);
  });

  it("stagger multiplies separately", () => {
    expect(damage(gameData(), { ...never, staggered: true }).zones.stagger).toBe(STAGGER_DAMAGE_TAKEN);
  });

  it("damage is the product of the zones, rounded to the nearest whole number", () => {
    const d = damage(gameData());
    const z = d.zones;
    expect(d.exact).toBeCloseTo(
      z.atk * z.scale * z.damageBonus * z.crit * z.amp * z.susceptibility * z.damageTaken * z.multiplicative * z.stagger * z.defense * z.resistance,
    );
    expect(d.damage).toBe(Math.round(d.exact));
    expect(d.scaleParts).toEqual([{ key: "atk_scale", value: 2 }, { key: "ratio", value: 1 }]);
  });

  it("more ATK never lowers damage; more DEF never raises it", () => {
    let last = 0;
    for (const pct of [0, 0.1, 0.5, 1, 3]) {
      const d = damage(gameData({ atkPercent: pct })).exact;
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    let prev = Number.POSITIVE_INFINITY;
    for (const def of [0, 1, 50, 100, 500]) {
      const d = damage(gameData({ def })).exact;
      expect(d).toBeLessThanOrEqual(prev);
      prev = d;
    }
  });
});

describe("modifiers", () => {
  const m = (zone: Modifier["zone"], value: number, extra: Partial<Modifier> = {}): Modifier => ({ zone, value, source: "test", ...extra });

  it("ATK% joins the panel's ATK% before the attribute bonus; other zones combine as documented", () => {
    const data = gameData();
    const base = damage(data);
    const d = damage(data, {
      ...never,
      modifiers: [m("atk", 0.5), m("damageBonus", 1), m("amp", 0.2), m("susceptibility", 0.1), m("damageTaken", 0.3),
        m("multiplicative", 0.1), m("multiplicative", 0.2), m("ignoreResistance", 10)],
    });
    expect(d.zones.atk).toBeCloseTo(200 * 3 * 1.6);
    expect(d.zones.damageBonus).toBeCloseTo(base.zones.damageBonus + 1);
    expect(d.zones.amp).toBeCloseTo(1.2);
    expect(d.zones.susceptibility).toBeCloseTo(1.1);
    expect(d.zones.damageTaken).toBeCloseTo(1.3);
    expect(d.zones.multiplicative).toBeCloseTo(1.1 * 1.2);
    expect(d.zones.resistance).toBeCloseTo(1.1);
  });

  it("element, skill type and staggered filters", () => {
    const data = gameData();
    const base = damage(data).zones.damageBonus;
    const filtered = [m("damageBonus", 1, { element: "cryst" }), m("damageBonus", 2, { skillType: "basic" }), m("damageBonus", 4, { staggeredOnly: true }),
      m("damageBonus", 8, { element: "fire", skillType: "battle" })];
    expect(damage(data, { ...never, modifiers: filtered }).zones.damageBonus).toBeCloseTo(base + 8);
    expect(damage(data, { ...never, staggered: true, modifiers: filtered }).zones.damageBonus).toBeCloseTo(base + 12);
  });

  it("stat panel attributes map to the same zones", () => {
    expect(attrModifier(Attr.FireDamageIncrease, 0.3, "x")).toEqual({ zone: "damageBonus", element: "fire", value: 0.3, source: "x" });
    expect(attrModifier(Attr.NormalAttackDamageIncrease, 0.15, "x")).toEqual({ zone: "damageBonus", skillType: "basic", value: 0.15, source: "x" });
    expect(attrModifier(Attr.NaturalVulnerableDmgIncrease, 0.1, "x")?.zone).toBe("susceptibility");
    expect(attrModifier(Attr.EtherEnhancedDmgIncrease, 0.1, "x")).toMatchObject({ zone: "amp", element: "ether" });
    expect(attrModifier(Attr.Wisd, 100, "x")).toBeNull();
  });
});
