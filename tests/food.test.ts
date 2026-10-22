// Food buffs (Build.food): the loader (UseItemTable + BuffData), their lines
// in the stat panel, their duration in the timeline, and the log checker
// with a food set by hand (logs don't record food).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Attr, computeKit, computeStats, createContext, DEFAULT_STAT_OPTIONS, foodOf, lineValue, panelAt, simulate, Slot, type Build, type FoodData, type GameData, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { compare, loadGameData, loadUseItems } from "@efsim/data";
import { calc, checkLog, find, readLogFixture, readScenario, type CalcOptions, type HitVerdict } from "@efsim/cli";

const data = loadGameData();
const ROOT = new URL("..", import.meta.url).pathname;
const readBuild = (file: string) => JSON.parse(readFileSync(join(ROOT, file), "utf8")) as Build;
const STEW = "item_corp3_animal_1";
const DUSKBERRY = "item_inn_drink_10";
const JAKUB = "item_agrange_1_erhound_1_sp_1_1";

describe("loader", () => {
  it("UseItemTable agrees between the two sources", () => {
    expect(compare(loadUseItems("rmxlinux"), loadUseItems("555me")).slice(0, 20)).toEqual([]);
  });

  it("loads the 36 food buffs, each 300 s", () => {
    const foods = Object.values(data.foods ?? {});
    expect(foods).toHaveLength(36);
    expect(new Set(foods.map((f) => f.duration))).toEqual(new Set([300]));
  });

  it("Ginseng Meat Stew: ATK +180 flat (formulaItem 7) and Crit Rate +11.44%, from the item's blackboard", () => {
    expect(data.foods?.[STEW]).toEqual({
      id: STEW,
      name: "Ginseng Meat Stew",
      duration: 300,
      buffs: [
        { buffId: "buff_common_atk_buff_potion_2", modifiers: [{ attr: Attr.Atk, slot: Slot.Flat, target: 0, value: 180 }] },
        { buffId: "buff_common_ctr_buff_potion_1", modifiers: [{ attr: Attr.CriticalRate, slot: Slot.AddUnverified, target: 0, value: 0.11443877220153809 }] },
      ],
    });
  });

  it("percentage foods: the ATK% the logs list (40d9 Bottled Duskberry Juice 0.293469, b7b3 Jakub's Legacy 0.27)", () => {
    const atk = (id: string) => data.foods?.[id]?.buffs.map((b) => [b.buffId, b.modifiers.map((m) => [m.attr, m.slot, m.value])]);
    expect(data.foods?.[DUSKBERRY]?.name).toBe("Bottled Duskberry Juice");
    expect(atk(DUSKBERRY)).toEqual([["buff_common_atk_buff_potion_1", [[Attr.Atk, Slot.Percent, 0.2934693992137909]]]]);
    expect(data.foods?.[JAKUB]?.name).toBe("Jakub's Legacy");
    expect(atk(JAKUB)).toEqual([["buff_common_atk_buff_potion_1", [[Attr.Atk, Slot.Percent, 0.27000001072883606]]]]);
  });

  it("items used for an instant effect (heals, ultimate energy) aren't foods, and say why", () => {
    expect(data.foods?.["item_corp4_spc"]).toBeUndefined();
    expect(data.notFoods?.["item_corp4_spc"]).toMatch(/isn't a food buff.*buff_common_ultsp_potion_1/);
    expect(data.notFoods?.["item_corp2_animal_1"]).toMatch(/buff_common_heal_potion_2, buff_common_dispel_potion/);
  });
});

describe("stat panel", () => {
  const endmin = readBuild("examples/endministrator-p5.json");
  const plain = computeStats(data, endmin);
  const stew = computeStats(data, { ...endmin, food: STEW });

  it("the stew's 180 ATK is in the flat slot: ATK = [(operator + weapon) × (1 + ATK%) + flat] × attribute bonus", () => {
    expect(plain.atk.flat).toBe(0);
    expect(stew.atk.flat).toBe(180);
    const a = stew.atk;
    expect(a.total).toBeCloseTo(((a.operatorBase + a.weaponBase) * (1 + a.percent) + 180) * a.attributeBonus, 9);
    expect(stew.atk.total - plain.atk.total).toBeCloseTo(180 * plain.atk.attributeBonus, 9);
    expect(stew.attrs[Attr.Atk]?.contributions).toContainEqual({ source: "food Ginseng Meat Stew (buff_common_atk_buff_potion_2)", slot: Slot.Flat, value: 180 });
    expect((stew.attrs[Attr.CriticalRate]?.total ?? 0) - (plain.attrs[Attr.CriticalRate]?.total ?? 0)).toBeCloseTo(0.11443877220153809, 12);
    expect(stew.food).toEqual({ id: STEW, name: "Ginseng Meat Stew", duration: 300 });
  });

  it("a percentage food joins the ATK% sum; an attribute food raises the attribute bonus", () => {
    const juice = computeStats(data, { ...endmin, food: DUSKBERRY });
    expect(juice.atk.percent - plain.atk.percent).toBeCloseTo(0.2934693992137909, 12);
    const tea = computeStats(data, { ...endmin, food: "item_inn_drink_5" }); // Pear Blossom Tea: all four attributes +27
    expect(tea.atk.mainAttribute - plain.atk.mainAttribute).toBe(27);
    expect(tea.atk.secondaryAttribute - plain.atk.secondaryAttribute).toBe(27);
  });

  it("withoutFood leaves it out (the panel after it ends)", () => {
    expect(computeStats(data, { ...endmin, food: STEW }, { ...DEFAULT_STAT_OPTIONS, withoutFood: true })).toEqual(plain);
  });

  it("an unknown item, or one that isn't a food buff, is an error", () => {
    expect(() => computeStats(data, { ...endmin, food: "item_nope" })).toThrow(/food item_nope is unknown/);
    expect(() => computeStats(data, { ...endmin, food: "item_corp4_spc" })).toThrow(/isn't a food buff/);
  });

  it("DEF +x% (formulaItem 1, formula unknown) is left out of DEF and refused where a kit reads DEF", () => {
    // Seeker's Kohl: Crit Rate +13.8% and DEF −2.68% in formula item 1.
    const kohl = computeStats(data, { ...endmin, food: "item_inn_drink_6" });
    const def = kohl.attrs[Attr.Def];
    expect(def?.total).toBe(plain.attrs[Attr.Def]?.total);
    expect(def?.unmodelled).toEqual([{ source: "food Seeker's Kohl (buff_common_def_buff_potion_3)", slot: 1, value: -0.026767347007989883 }]);
    expect(() => lineValue(def as NonNullable<typeof def>, kohl.operator)).toThrow(/formula item 1/);
    // The Endministrator's kit doesn't read DEF: her hits are computed; Catcher's P1 strike is DEF-based, so a fight with it refuses.
    expect(computeKit(data, { ...endmin, food: "item_inn_drink_6" }, kohl, { enemy: "eny_0051_rodin", level: 90 }).length).toBeGreaterThan(0);
    const counter = readScenario(join(ROOT, "examples/catcher-counter.scenario.json"));
    expect(simulate(data, counter).total).toBeGreaterThan(0);
    const fed = { ...counter, team: counter.team.map((b) => ({ ...b, food: "item_inn_drink_6" })) };
    expect(() => simulate(data, fed)).toThrow(/Def has a part whose formula isn't known/);
  });

  it("efsim calc names the food and its lines; efsim find finds foods by name", () => {
    const options: CalcOptions = { target: { enemy: "eny_0051_rodin", level: 90 }, crit: "never", staggered: false, conditions: [], verbose: true };
    const text = calc(data, { ...endmin, food: STEW }, options);
    expect(text).toContain("180 flat]");
    expect(text).toContain("Food: Ginseng Meat Stew (item_corp3_animal_1), the fight's first 300 s: Atk +180 flat; CriticalRate +11.4%");
    expect(text).toContain("food Ginseng Meat Stew (buff_common_ctr_buff_potion_1) 11.4%");
    expect(find(data, "meat stew")).toMatch(/food\s+item_corp3_animal_1\s+Ginseng Meat Stew/);
    expect(find(data, "food").split("\n").filter((l) => l.startsWith("food "))).toHaveLength(36);
  });
});

describe("timeline", () => {
  const build = readBuild("examples/laevatain-forgeborn.json");
  const L = "chr_0016_laevat_";
  const chain: RotationAction[] = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s) => ({ operator: build.operator, skill: L + s }));
  const scenario = (b: Build): TimelineScenario => ({ team: [b], target: { enemy: "eny_0051_rodin", level: 90 }, durationFrames: 30 * 20, rotation: [...chain, ...chain], options: { crit: "never" } });

  it("the panel has the food from the fight's start until its duration ends", () => {
    const ctx = createContext(data, scenario({ ...build, food: STEW }));
    expect(panelAt(ctx, build.operator, 0).atk.flat).toBe(180);
    expect(panelAt(ctx, build.operator, 300 * 30 - 1).atk.flat).toBe(180);
    expect(panelAt(ctx, build.operator, 300 * 30).atk.flat).toBe(0);
  });

  it("hits before the food ends count it, hits after don't", () => {
    // The stew with a 2 s duration, so the end falls inside a short rotation.
    const stew = data.foods?.[STEW] as FoodData;
    const short: GameData = { ...data, foods: { ...data.foods, [STEW]: { ...stew, duration: 2 } } };
    const plain = simulate(data, scenario(build)).hits;
    const fed = simulate(short, scenario({ ...build, food: STEW })).hits;
    expect(fed.map((h) => h.frame)).toEqual(plain.map((h) => h.frame));
    const before = fed.filter((h) => h.frame < 60);
    const after = fed.filter((h) => h.frame >= 60);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    const panel = computeStats(data, build);
    const ratio = (panel.atk.total + 180 * panel.atk.attributeBonus) / panel.atk.total;
    fed.forEach((h, i) => expect(h.exact / (plain[i]?.exact ?? 0)).toBeCloseTo(h.frame < 60 ? ratio : 1, 9));
  });
});

describe("log checker", () => {
  const fixture = (file: string) => readLogFixture(join(ROOT, "fixtures", file));
  const tally = (verdicts: readonly HitVerdict[], operator: string) => {
    const mine = verdicts.filter((v) => v.hit.operator === operator);
    return `${mine.filter((v) => v.kind === "match").length}/${mine.length}`;
  };

  it("7e19: the Endministrator's food, set by hand, makes all 34 of her hits match (none without)", () => {
    const fx = fixture("pending/zmdlogs-7e19489ae503.json");
    const op = "chr_0003_endminf";
    expect(fx.team.find((b) => b.operator === op)?.food).toBe(STEW);
    expect(fx.hits.some((h) => h.effects.some((e) => e.buff === "buff_common_atk_buff_potion_2"))).toBe(false);
    const mine = { ...fx, hits: fx.hits.filter((h) => h.operator === op) };
    expect(tally(checkLog(data, mine), op)).toBe("34/34");
    const unfed = { ...mine, team: mine.team.map((b): Build => (b.operator === op ? (({ food: _food, ...rest }) => rest)(b) : b)) };
    expect(tally(checkLog(data, unfed), op)).toBe("0/34");
  });

  it("e82d: Si's food, set by hand: 21 of her 22 hits match", () => {
    const fx = fixture("pending/zmdlogs-e82d45c46040.json");
    const op = "chr_0036_jsspsi";
    expect(fx.team.find((b) => b.operator === op)?.food).toBe(STEW);
    expect(tally(checkLog(data, { ...fx, hits: fx.hits.filter((h) => h.operator === op) }), op)).toBe("21/22");
  });

  it.each([
    ["zmdlogs-40d9a3c1da37.json", DUSKBERRY],
    ["zmdlogs-b7b3762d5da8.json", JAKUB],
  ])("%s: a food the log lists isn't counted twice when the build also sets it", (file, food) => {
    const fx = fixture(file);
    const eaters = new Set(fx.hits.filter((h) => h.effects.some((e) => e.buff === "buff_common_atk_buff_potion_1")).map((h) => h.operator));
    expect(eaters.size).toBeGreaterThan(0);
    const fed = { ...fx, team: fx.team.map((b) => (eaters.has(b.operator) ? { ...b, food } : b)) };
    expect(foodOf(data, fed.team.find((b) => eaters.has(b.operator)) as Build)?.id).toBe(food);
    const kinds = (vs: readonly HitVerdict[]) => vs.map((v) => v.kind);
    expect(kinds(checkLog(data, fed))).toEqual(kinds(checkLog(data, fx)));
  });
});
