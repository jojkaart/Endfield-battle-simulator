// Value, loader and display follow-ups from batch 4's kits (docs/kit-abstractions.md, "Review after batch 4's
// kits" item 2): a buff's main attributes reaching ATK (zone `attribute`), `buffLayers` thresholds as values,
// stack caps from the data for layered stacking types, Solemn Phalanx on its tag, the ATK-per-point lines of
// `efsim calc`, and the `linkGained` event (Thermite Cutter's Link half).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  advance, apply, Attr, atkAttributeBonus, computeHit, computeStats, createContext, eventMatches, evalContext, init, kitBuffModifiers, SNAPSHOT_ZONES, test,
  type BattleEvent, type Build, type KitBuff, type KitHit, type Modifier, type RotationAction, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import { loadGameData, loadKits, withGameBuff } from "@efsim/data";
import { calc, readScenario } from "@efsim/cli";

const data = loadGameData();
const readBuild = (f: string) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8")) as Build;
const target = { enemy: "eny_0051_rodin", level: 90 };
const lifeng = readBuild("lifeng-p5.json");
const LF = "chr_0015_lifeng_";
const lifengPanel = computeStats(data, lifeng);
const options = { crit: "never" as const, staggered: false };
const attack1 = data.kits.operators["chr_0015_lifeng"]?.skills.find((s) => s.skillId === LF + "attack1");
const attack1Hit = attack1?.hits[0] as KitHit;
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until: number): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
/** Equipment kits under a scratch root, loaded with the real loader. */
function loadEquipment(...kits: object[]) {
  const root = mkdtempSync(join(tmpdir(), "efsim-batch4-values2-"));
  roots.push(root);
  mkdirSync(join(root, "operators"));
  mkdirSync(join(root, "equipment"));
  for (const k of kits) writeFileSync(join(root, "equipment", `${(k as { equipment: string }).equipment}.json`), JSON.stringify(k));
  return loadKits(data, root).equipment;
}

describe("a buff's Strength, Agility, Intellect and Will raise ATK through its attribute bonus (zone `attribute`)", () => {
  const atkWith = (mods: Modifier[]) => computeHit(data, lifeng, lifengPanel, target, { skillId: LF + "attack1" }, attack1Hit, { ...options, modifiers: mods }).zones.atk;
  const line = (attr: number) => lifengPanel.attrs[attr] as NonNullable<(typeof lifengPanel.attrs)[number]>;
  const pct = (attr: number, value: number): Modifier => ({ zone: "attribute", attr, value, percent: true, source: "test" });

  it("All Attributes +22.4% (Mountain Bearer L9) on Lifeng: each attribute's line × 1.224, floored, through main, secondary and her ATK-per-point (talent 1): about +17.4% ATK", () => {
    const a = lifengPanel.atk;
    expect([a.mainAttribute, a.secondaryAttribute, a.attributeBonus]).toEqual([363, 429, expect.closeTo(4.511, 4)]);
    const up = (attr: number) => Math.floor(line(attr).total + 0.224 * (line(attr).base + line(attr).add) * line(attr).multiply);
    // Agility (main) 444, Strength (secondary) 525, Intellect 159 and Will 354 at talent 1's 0.002 ATK per point each.
    expect([Attr.Agi, Attr.Str, Attr.Wisd, Attr.Will].map(up)).toEqual([444, 525, 159, 354]);
    const bonus = 1 + 444 * data.constants.atkRateOfMain + 525 * data.constants.atkRateOfSub + 0.002 * 159 + 0.002 * 354;
    const atk = atkWith([Attr.Str, Attr.Agi, Attr.Wisd, Attr.Will].map((x) => pct(x, 0.224)));
    expect(atk).toBeCloseTo((a.operatorBase + a.weaponBase) * bonus, 2);
    expect(atk / a.total).toBeCloseTo(1.174, 3);
  });

  it("the stat panel's own rule: the same points as a panel line give the same ATK (atkAttributeBonus with extra points)", () => {
    const shifted = atkAttributeBonus(data, lifengPanel, true, (x) => (x === Attr.Str ? 100 : 0));
    expect(shifted.attributeBonus - lifengPanel.atk.attributeBonus).toBeCloseTo(100 * data.constants.atkRateOfSub, 9);
    const atk = atkWith([{ zone: "attribute", attr: Attr.Str, value: 100, source: "flat Strength" }]);
    expect(atk).toBeCloseTo((lifengPanel.atk.operatorBase + lifengPanel.atk.weaponBase) * shifted.attributeBonus, 6);
  });

  it("no attribute modifier: the panel's ATK exactly; an ATK% buff still joins before the bonus, which includes the attributes", () => {
    expect(atkWith([])).toBe(lifengPanel.atk.total);
    const both = atkWith([{ zone: "atk", value: 0.1, source: "atk" }, pct(Attr.Agi, 0.224)]);
    const bonus = atkAttributeBonus(data, lifengPanel, true, (x) => (x === Attr.Agi ? 0.224 * (line(x).base + line(x).add) : 0)).attributeBonus;
    expect(both).toBeCloseTo((lifengPanel.atk.operatorBase + lifengPanel.atk.weaponBase) * 1.1 * bonus, 6);
  });

  it("it is attacker-side (an ATK snapshot keeps it); a modifier naming another attribute is an error", () => {
    expect(SNAPSHOT_ZONES.has("attribute")).toBe(true);
    expect(() => atkWith([{ zone: "attribute", attr: Attr.Def, value: 10, source: "bad" }])).toThrow(/Strength, Agility, Intellect or Will/);
  });

  it("calc's --buff: Mountain Bearer's two buffs as kit-buff modifiers raise attack1's ATK by ×1.35 together", () => {
    const mods = ["wpn_lance_0012.attrs", "wpn_lance_0012.attrs2"].flatMap((b) => kitBuffModifiers(data, lifeng, lifengPanel, b));
    expect(mods.filter((m) => m.zone === "attribute").map((m) => [m.attr, m.percent])).toEqual([39, 40, 41, 42, 39, 40, 41, 42].map((x) => [x, true]));
    expect(atkWith(mods) / lifengPanel.atk.total).toBeCloseTo(1.35, 2);
  });

  it("the timeline: after her battle skill's slam (both All Attributes buffs), her next hits' ATK is ×1.35; before it, the panel's", () => {
    const example = readScenario(new URL("../examples/lifeng-solo.scenario.json", import.meta.url).pathname);
    const s = run(example, [{ operator: "chr_0015_lifeng", skill: LF + "normal_skill" }, { operator: "chr_0015_lifeng", skill: LF + "attack1" }], 30 * 6);
    const ns = s.hits.filter((h) => h.skillId === LF + "normal_skill");
    expect(ns[0]?.zones.atk).toBe(lifengPanel.atk.total);
    const a1 = s.hits.find((h) => h.skillId === LF + "attack1");
    expect((a1?.zones.atk ?? 0) / lifengPanel.atk.total).toBeCloseTo(1.35, 2);
    expect(a1?.modifiers.filter((m) => m.zone === "attribute")).toHaveLength(8);
  });
});

describe("buffLayers thresholds are values (Zhuang Fangyi's free_sword_limit)", () => {
  const zfy = readBuild("zhuangfy-p5.json");
  const zPanel = computeStats(data, zfy);
  const NS = "chr_0030_zhuangfy_normal_skill";
  const at = (n: number) => test({ buffLayers: "sunderblade", below: "free_sword_limit" }, evalContext(data, zfy, zPanel, NS, { buffLayers: () => n }));

  it("below free_sword_limit (3): 2 Sunderblades pass, 3 don't; a literal still works", () => {
    expect([at(2), at(3)]).toEqual([true, false]);
    expect(test({ buffLayers: "sunderblade", atLeast: 1, below: 3 }, evalContext(data, zfy, zPanel, NS, { buffLayers: () => 2 }))).toBe(true);
  });

  it("her kit names the key in both battle skills' Sunderblade conditions", () => {
    const kit = data.kits.operators["chr_0030_zhuangfy"];
    for (const id of ["bs_swords", "bsu_swords"]) expect(JSON.stringify(kit?.triggers.find((t) => t.id === id)?.do)).toContain('"below":"free_sword_limit"');
  });

  it("the loader checks the key against the predicate's skill", () => {
    const kit = (below: unknown) => ({
      equipment: "wpn_funnel_0020",
      sources: ["test"],
      buffs: [{ id: "wpn_funnel_0020.x", label: "x", target: "self", duration: 1, modifiers: [{ zone: "atk", value: 0.1 }] }],
      triggers: [{ id: "wpn_funnel_0020.t", on: { event: "fightStart" }, by: "self", skill: "sk_wpn_funnel_0020", do: [{ kind: "buff", buff: "wpn_funnel_0020.x", if: { buffLayers: "wpn_funnel_0020.x", below } }] }],
    });
    expect(loadEquipment(kit("duration"))["wpn_funnel_0020"]).toBeDefined();
    expect(() => loadEquipment(kit("no_such_key"))).toThrow(/no_such_key/);
  });
});

describe("stack caps from the data for layered stacking types (2, 11, 8, 10)", () => {
  const buff = (gameBuff: string, extra: Partial<KitBuff> = {}): KitBuff => ({ id: "b", label: "b", target: "self", gameBuff, modifiers: [{ zone: "atk", value: 0.1 }], ...extra });

  it("a literal maxStackCnt without a key: Suffering's End's 4 (stackingType 11); a kit's own cap must agree", () => {
    expect(withGameBuff("t", buff("buff_wpn_funnel_0020_intensityup")).maxStacks).toBe(4);
    expect(withGameBuff("t", buff("buff_wpn_funnel_0020_intensityup", { maxStacks: 4 })).maxStacks).toBe(4);
    expect(() => withGameBuff("t", buff("buff_wpn_funnel_0020_intensityup", { maxStacks: 3 }))).toThrow(/keeps 4 layers/);
  });

  it("a maxStackCntKey the applying skill lacks: the buff's own value (Camille's talent 2: 5 over the literal 3); with the key, the kit names it", () => {
    expect(withGameBuff("t", buff("buff_chr_0033_camille_talent1_atkup"), false).maxStacks).toBe(5);
    expect(() => withGameBuff("t", buff("buff_chr_0033_camille_talent1_atkup", { maxStacks: 3 }), false)).toThrow(/keeps 5 layers/);
    expect(withGameBuff("t", buff("buff_chr_0033_camille_talent1_atkup")).maxStacks).toBeUndefined();
  });

  it("not for refreshed (stackingType 4) buffs; shared-timer types get their timer with the data's cap (Ember: 3, type 10)", () => {
    expect(withGameBuff("t", buff("buff_chr_0028_wulfa_normal_bleed")).maxStacks).toBeUndefined();
    expect(withGameBuff("t", buff("buff_chr_0009_azrila_talent_2_buff"))).toMatchObject({ maxStacks: 3, sharedTimer: true });
  });

  it("the loaded kits without hand-written caps: Suffering's End 4, Camille's Bloodfount (hers and the team's) 5", () => {
    expect(data.kits.equipment["wpn_funnel_0020"]?.buffs.find((b) => b.id === "wpn_funnel_0020.layer")?.maxStacks).toBe(4);
    const camille = data.kits.operators["chr_0033_camille"];
    expect(["bloodfount", "bloodfount_team"].map((id) => camille?.buffs.find((b) => b.id === id)?.maxStacks)).toEqual([5, 5]);
  });
});

describe("Solemn Phalanx reads Arts Susceptibility by its one tag (1427729990), as Junction Point reads its four", () => {
  const triggers = data.kits.equipment["wpn_funnel_0016"]?.triggers ?? [];
  const susc = (elements: readonly ("physical" | "fire" | "pulse" | "cryst" | "natural" | "ether")[]): BattleEvent => ({
    type: "buffApplied", frame: 0, operator: "x", buff: "s", categories: ["susceptibility"], reach: { susceptibility: elements }, fromKind: "battle",
  });

  it("both Susceptibility triggers: an Arts (or all-element) Susceptibility, not a Physical one", () => {
    for (const id of ["wpn_funnel_0016.int_susceptibility", "wpn_funnel_0016.will_susceptibility"]) {
      const on = triggers.find((t) => t.id === id)?.on;
      expect(on).toMatchObject({ event: "buffApplied", categories: ["susceptibility"], elements: ["fire", "pulse", "cryst", "natural"] });
      if (!on) continue;
      expect([susc(["fire"]), susc(["physical"]), susc(["physical", "fire", "pulse", "cryst", "natural", "ether"])].map((e) => eventMatches(on, e, "x", {}))).toEqual([true, false, true]);
    }
  });
});

describe("efsim calc shows ATK per attribute point (76–79) as its own lines", () => {
  const opts = { target, crit: "never" as const, staggered: false, verbose: false };

  it("Lifeng's talent 1: Intellect and Will at 0.002 each, with their source; the bonus adds up", () => {
    const text = calc(data, lifeng, opts);
    expect(text).toContain("attribute bonus 4.5110 = 3.6730 (1 + Agi 363 × 0.0050 + Str 429 × 0.0020)");
    expect(text).toMatch(/\+ 0\.2600 = AtkIncreaseFactorFromWisd \(78\) 0\.0020 × Wisd 130 \[talent 1 level 2/);
    expect(text).toMatch(/\+ 0\.5780 = AtkIncreaseFactorFromWill \(79\) 0\.0020 × Will 289 \[talent 1 level 2/);
    expect(lifengPanel.atk.perPoint.map((p) => [p.factorAttr, p.attr, p.points])).toEqual([[78, 41, 130], [79, 42, 289]]);
  });

  it("an operator without them: no such lines", () => {
    expect(calc(data, readBuild("laevatain-forgeborn.json"), opts)).not.toContain("attribute bonus");
  });
});

describe("linkGained: a Link stack given to the team (Thermite Cutter's Link half)", () => {
  const pog = readBuild("pogranichnik-p5.json");
  const L = "chr_0015_lifeng";
  const op = (skill: string): RotationAction => ({ operator: L, skill: LF + skill });
  // Battle skill (Susceptibility), a chain whose Final Strike opens her combo, the combo (Link at its frame 19).
  const rotation = [op("normal_skill"), op("attack1"), op("attack2"), op("attack3"), op("attack5"), op("combo_skill")];
  const scenario = (team: Build[]): TimelineScenario => ({ team, target, durationFrames: 30 * 20, rotation, options: { crit: "never" } });

  it("Lifeng's combo gives Link; Pogranichnik (a sword wielder with Thermite Cutter) gains it, and the team gains ATK +atk_up2 at that frame", () => {
    const s = run(scenario([lifeng, pog]), rotation, 30 * 20);
    const combo = s.casts.find((c) => c.skill === LF + "combo_skill")?.frame ?? NaN;
    const thermite = s.buffs.filter((b) => b.id === "wpn_sword_0012.team_atk" && b.owner === "chr_0029_pograni");
    expect(thermite.map((b) => b.appliedAt)).toEqual([combo + 19]);
    expect(thermite[0]?.modifiers.map((m) => [m.zone, m.value])).toEqual([["atk", expect.closeTo(0.14, 6)]]);
  });

  it("the event names each team member who gains it (`by` is the one who gains: self for the wielder); none without a link action", () => {
    const ev = (operator: string): BattleEvent => ({ type: "linkGained", frame: 0, operator, from: L, count: 1 });
    expect(eventMatches({ event: "linkGained" }, ev("chr_0029_pograni"), "chr_0029_pograni", {})).toBe(true);
    expect(eventMatches({ event: "linkGained" }, { type: "fightStart", frame: 0, operator: L }, "chr_0029_pograni", {})).toBe(false);
    const solo = run(scenario([pog]), [], 30 * 5);
    expect(solo.buffs.some((b) => b.id === "wpn_sword_0012.team_atk")).toBe(false);
  });
});
