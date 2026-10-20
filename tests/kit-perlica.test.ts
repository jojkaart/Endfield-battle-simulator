// Perlica's kit (chr_0004_pelica) and the equipment kits of her batch-3 report (Wild Wanderer, Monaihe, Mordvolt
// Insulation): the mechanics the kit plan (docs/kit-batches/batch-3/chr_0004_pelica.md) says must fire, and every
// interim's behaviour, on the example scenario's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, earliestStart, init, type Build, type GameData, type LandedHit, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const K = "chr_0004_pelica";
const P = K + "_";
const E = "chr_0021_whiten";
const example = readScenario(new URL("../examples/perlica-estella.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: K, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const estella = (skill: string, at?: number): RotationAction => ({ operator: E, skill: `${E}_${skill}`, ...(at !== undefined ? { at } : {}) });
const perlica = example.team.find((m) => m.operator === K) as Build;

/** The example's team with Perlica changed, no enemy attacks, 20 s. */
const scenario = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === K ? { ...m, ...b } : m)),
  durationFrames: 20 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames, d: GameData = data): TimelineState => {
  const ctx = createContext(d, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === K);
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === K && c.skill === P + skill)[n]?.frame ?? NaN;
const hitsOf = (s: TimelineState, skill: string) => mine(s).filter((h) => h.skillId === P + skill);
const from = (h: LandedHit | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label));
const chain = ["attack1", "attack2", "attack3", "attack4"].map((a) => op(a));
// Estella's battle skill (Cryo at frame 21), then Perlica's at 1 s: Electrification at her hit (frame 43).
const opening: RotationAction[] = [estella("normal_skill"), op("normal_skill", 30)];

/** Her kit with the battle-skill hit dealing 300 stagger: Rhodagn's 280 stagger HP is gone at once (as the shared stagger tests do). */
const staggering: GameData = (() => {
  const kit = data.kits.operators[K] as OperatorKit;
  const skills = kit.skills.map((s) => (s.skillId === P + "normal_skill" ? { ...s, hits: s.hits.map((h) => ({ ...h, poise: 300 })) } : s));
  return { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [K]: { ...kit, skills } } } };
})();

describe("Perlica's kit", () => {
  it("basic attacks: 1, 2 and 3 projectiles at frames 8 / 9, 12 / 16, 19, 22; attack4 one Final Strike at 27 with 15 SP and 15 stagger while controlled", () => {
    const s = run(scenario({}, { startEnergy: {} }), chain);
    const rel = (skill: string) => hitsOf(s, skill).map((h) => h.frame - castAt(s, skill));
    expect([rel("attack1"), rel("attack2"), rel("attack3"), rel("attack4")]).toEqual([[8], [9, 12], [16, 19, 22], [27]]);
    expect(hitsOf(s, "attack4").map((h) => h.scaleParts.length > 0 && h.zones.scale)).toEqual([expect.closeTo(1.27, 6)]);
    // Rhodagn's 280 stagger HP less attack4's 15 (the others have none).
    expect(s.stagger.poise).toBe(280 - 15);
    // The Final Strike opens her combo window (the controlled operator's Final Strike).
    expect(s.comboWindow[K]?.from).toBe(castAt(s, "attack4") + 27);
  });

  it("combo trigger: any controlled operator's Final Strike, e.g. Estella's", () => {
    const sc = scenario({}, { controlled: E });
    const s = run(sc, ["attack1", "attack2", "attack3", "attack4"].map((a) => estella(a)));
    const fs = s.hits.find((h) => h.operator === E && h.skillId === `${E}_attack4`);
    expect(fs).toBeDefined();
    expect(s.comboWindow[K]?.from).toBe(fs?.frame);
  });

  it("battle skill: one hit at frame 13 (4.0), Electric Infliction before it, team energy at 13", () => {
    const s = run(scenario({}, { startEnergy: {} }), [op("normal_skill")]);
    const hit = hitsOf(s, "normal_skill");
    expect(hit.map((h) => [h.frame - castAt(s, "normal_skill"), h.zones.scale])).toEqual([[13, 4]]);
    expect(s.enemy.infliction).toMatchObject({ element: "pulse", stacks: 1 });
    expect(run(scenario({}, { startEnergy: {} }), [op("normal_skill")], 12).energy[K] ?? 0).toBe(0);
    expect(s.energy[K] ?? 0).toBeGreaterThan(0);
  });

  it("battle skill on Cryo: an Electrification reaction at its hit, whose initial hit takes the new status (engine interim, open list A6)", () => {
    const s = run(scenario({}), opening, 60);
    expect(s.reactions.filter((r) => r.kind === "reaction")).toEqual([expect.objectContaining({ frame: 43, operator: K, status: "electrification", consumed: "cryst", level: 1 })]);
    const initial = mine(s).find((h) => h.skillId.startsWith("reaction:"));
    expect(initial?.frame).toBe(43);
    expect(from(initial, "Electrification level 1")).toHaveLength(1);
  });

  it("combo: one projectile at frame 24 (1.8), forcing Electrification I before its own hit: 8.75 s at P1 (5 s below), ×1.33 strength at P4 (×1 below); usp 10 energy", () => {
    const rotation = [...chain, op("combo_skill")];
    const s = run(scenario({}, { startEnergy: {} }), rotation);
    const combo = castAt(s, "combo_skill");
    const hit = hitsOf(s, "combo_skill");
    expect(hit.map((h) => [h.frame - combo, h.zones.scale])).toEqual([[24, expect.closeTo(1.8, 6)]]);
    expect(s.reactions.filter((r) => r.kind === "reaction")).toEqual([expect.objectContaining({ frame: combo + 24, status: "electrification", consumed: null, level: 1, initialHit: false })]);
    // The status on the enemy (no time stop here: the enemy's clock is the battle's).
    const status = (st: TimelineState) => st.enemy.statuses.find((x) => x.status === "electrification");
    const at = (b: Partial<Build>) => run(scenario(b, { startEnergy: {} }), rotation, combo + 25);
    expect(status(at({}))).toMatchObject({ appliedAt: combo + 24, expiresAt: combo + 24 + 263, damageScale: { key: "extra_scaling", value: expect.closeTo(1.33, 6) } });
    expect(status(at({ potential: 3 }))).toMatchObject({ expiresAt: combo + 24 + 263, damageScale: { value: 1 } });
    expect(status(at({ potential: 0 }))).toMatchObject({ expiresAt: combo + 24 + 150 });
    // Its Arts DMG Taken on the combo's own hit: level I × the AI curve × 1.33.
    const taken = (st: TimelineState) => from(hitsOf(st, "combo_skill")[0], "Electrification level 1").map((m) => m.value);
    const plain = taken(at({ potential: 3 }));
    expect(plain).toHaveLength(1);
    expect(taken(at({}))[0]).toBeCloseTo((plain[0] ?? 0) * 1.33, 6);
    // usp 10 at the hit, × her Ultimate Gain Efficiency (the Mordvolt Battery's 1.175).
    const before = run(scenario({}, { startEnergy: {} }), rotation, combo + 23).energy[K] ?? 0;
    const efficiency = computeStats(data, perlica).attrs[44]?.total ?? 1;
    expect(efficiency).toBeCloseTo(1.175, 6);
    expect((s.energy[K] ?? 0) - before).toBeCloseTo(10 * efficiency, 6);
    // Cooldown 19 s at level 12.
    expect((s.readyAt[P + "combo_skill"] ?? 0) - combo).toBe(19 * 30);
  });

  it("combo on a longer Electrification: the forced one replaces it, timer and strength (interim, in-game test 66)", () => {
    // The battle skill's reaction (level I, 12 s), then the combo's forced level I for 8.75 s.
    const rotation = [...opening, ...chain, op("combo_skill")];
    const s = run(scenario({}), rotation, castAt(run(scenario({}), rotation), "combo_skill") + 30);
    const statuses = s.enemy.statuses.filter((x) => x.status === "electrification");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.appliedAt).toBe(castAt(s, "combo_skill") + 24);
  });

  it("ultimate: one hit at frame 58 (10.0) with crit rate +crit (P5 +0.3, 0 below); cost 80, ×0.85 from P2", () => {
    const sc = (b: Partial<Build>) => scenario(b, { startEnergy: { [K]: "full" } });
    const s = run(sc({}), [op("ultimate_skill")]);
    const hit = hitsOf(s, "ultimate_skill");
    expect(hit.map((h) => [h.frame - castAt(s, "ultimate_skill"), h.zones.scale])).toEqual([[58, 10]]);
    expect(from(hit[0], "crit").map((m) => [m.zone, m.value])).toEqual([["critRate", expect.closeTo(0.3, 6)]]);
    const p4 = hitsOf(run(sc({ potential: 4 }), [op("ultimate_skill")]), "ultimate_skill")[0];
    expect(from(p4, "crit").map((m) => m.value)).toEqual([0]);
    expect(init(createContext(data, sc({}))).energy[K]).toBeCloseTo(68, 4);
    expect(init(createContext(data, sc({ potential: 1 }))).energy[K]).toBe(80);
  });

  it("finisher: a hit at frame 35 (9.0) on a Staggered enemy, and no Knock Down (interim: the compiler's deadOption 2 reading, in-game test 67)", () => {
    const sc = scenario({});
    const ctx = createContext(staggering, sc);
    expect(earliestStart(ctx, init(ctx), op("power_attack"))).toHaveProperty("error");
    const s = run(sc, [op("normal_skill"), op("power_attack", 2)], 120, staggering);
    const hit = hitsOf(s, "power_attack");
    expect(hit.map((h) => [h.frame - castAt(s, "power_attack"), h.zones.scale])).toEqual([[35, 9]]);
    expect(from(hit[0], "Finisher")).toHaveLength(1);
    expect(s.reactions.some((r) => r.kind === "physical" || r.kind === "vulnerable")).toBe(false);
  });

  it("talent 1: DMG Dealt +dmg (0.3 at level 2, 0.2 at level 1) against a Staggered enemy only", () => {
    const rotation = [op("normal_skill"), op("attack1", 2)];
    const bonus = (b: Partial<Build>, d: GameData) => from(hitsOf(run(scenario(b), rotation, 120, d), "attack1")[0], "Obliteration Protocol").map((m) => [m.zone, m.value]);
    expect(bonus({}, staggering)).toEqual([["damageBonus", expect.closeTo(0.3, 6)]]);
    expect(bonus({ talents: [1, 1] }, staggering)).toEqual([["damageBonus", expect.closeTo(0.2, 6)]]);
    expect(bonus({ talents: [0, 1] }, staggering)).toEqual([]);
    expect(bonus({}, data)).toEqual([]);
  });

  it("P3: ATK +0.2 per Electrification she applies, up to 2 layers on one timer (5 s), on the applying hit already; reaction and forced both count", () => {
    const rotation = [...opening, ...chain, op("combo_skill")];
    const s = run(scenario({}), rotation, castAt(run(scenario({}), rotation), "combo_skill") + 30);
    const atk = (h: LandedHit | undefined) => from(h, "P3: ATK").map((m) => m.value);
    // The battle skill's hit and the reaction's initial hit: one layer (beforeDamage).
    expect(atk(hitsOf(s, "normal_skill")[0])).toEqual([expect.closeTo(0.2, 6)]);
    expect(atk(mine(s).find((h) => h.skillId.startsWith("reaction:")))).toEqual([expect.closeTo(0.2, 6)]);
    // The combo's forced Electrification adds the second before its own hit.
    expect(atk(hitsOf(s, "combo_skill")[0])).toEqual([expect.closeTo(0.2, 6), expect.closeTo(0.2, 6)]);
    const layers = s.buffs.filter((b) => b.owner === K && b.id === "supervisory_duties");
    expect(layers).toHaveLength(2);
    // Each new layer refreshes the shared timer: both end 5 s after the combo's hit.
    expect(layers.map((b) => b.expiresAt)).toEqual([castAt(s, "combo_skill") + 24 + 150, castAt(s, "combo_skill") + 24 + 150]);
    // Without an Electrification: nothing; below P3: nothing.
    expect(atk(hitsOf(run(scenario({}), [op("normal_skill")]), "normal_skill")[0])).toEqual([]);
    expect(atk(hitsOf(run(scenario({ potential: 2 }), opening), "normal_skill")[0])).toEqual([]);
  });

  it("talent 2's bounce needs a second enemy: one combo hit against one", () => {
    const s = run(scenario({}), [...opening, ...chain, op("combo_skill")]);
    expect(hitsOf(s, "combo_skill")).toHaveLength(1);
  });
});

describe("Perlica's equipment kits", () => {
  it("Wild Wanderer: the wielder's Electrification gives the team Physical and Electric DMG +0.224 for 15 s, from the next hit on (interim U3)", () => {
    const s = run(scenario({}), [...opening, op("attack1"), { operator: E, skill: "swap" }, estella("attack1")], 200);
    const ww = (h: LandedHit | undefined) => from(h, "Wild Wanderer").map((m) => [m.element, m.value]);
    expect(ww(hitsOf(s, "normal_skill")[0])).toEqual([]);
    expect(ww(hitsOf(s, "attack1")[0])).toEqual([["pulse", expect.closeTo(0.224, 6)]]);
    // On a teammate too: Estella's Physical attack.
    const e = s.hits.find((h) => h.operator === E && h.skillId === `${E}_attack1`);
    expect(ww(e)).toEqual([["physical", expect.closeTo(0.224, 6)]]);
    const buff = s.buffs.find((b) => b.id === "wpn_funnel_0004.team_dmg");
    expect(buff && { owner: buff.owner, target: buff.target, at: buff.appliedAt, span: buff.expiresAt - buff.appliedAt }).toEqual({ owner: K, target: "team", at: 30 + 13, span: 450 });
  });

  it("Wild Wanderer: her combo's forced Electrification fires it too; a second one refreshes it (one buff in the stack group)", () => {
    const s = run(scenario({}), [...chain, op("combo_skill")], 200);
    const combo = castAt(s, "combo_skill");
    expect(s.buffs.filter((b) => b.id === "wpn_funnel_0004.team_dmg").map((b) => b.appliedAt)).toEqual([combo + 24]);
    const again = run(scenario({}), [...opening, ...chain, op("combo_skill")], 300);
    expect(again.buffs.filter((b) => b.id === "wpn_funnel_0004.team_dmg").map((b) => b.appliedAt)).toEqual([castAt(again, "combo_skill") + 24]);
    // Type-11 stacking with a priority key and one instance: a stack group across wielders (open list B2).
    expect(data.kits.equipment["wpn_funnel_0004"]?.buffs?.[0]?.stackGroup).toBe("buff_wpn_funnel_0004_up");
    // Without Wild Wanderer nothing.
    const monaihe = run(scenario({ weapon: { id: "wpn_funnel_0007", level: 90, skillLevels: [9, 9, 9] } }), [...opening, ...chain, op("combo_skill")], 300);
    expect(monaihe.buffs.some((b) => b.id === "wpn_funnel_0004.team_dmg")).toBe(false);
  });

  it("Monaihe: every effect in the stat panel (Will +124, Arts Intensity +70, Intellect ×1.14); its kit declares nothing", () => {
    const wild = computeStats(data, perlica);
    const mon = computeStats(data, { ...perlica, weapon: { id: "wpn_funnel_0007", level: 90, skillLevels: [9, 9, 9] } });
    expect(mon.attrs[87]?.total).toBe(70);
    expect(wild.attrs[87]?.total).toBe(28);
    expect((mon.attrs[42]?.total ?? 0) - (wild.attrs[42]?.total ?? 0)).toBeCloseTo(124, 6);
    const int = mon.attrs[41];
    expect(int?.total ?? 0).toBeCloseTo(((int?.base ?? 0) + (int?.add ?? 0)) * 1.14, 4);
    const kit = data.kits.equipment["wpn_funnel_0007"];
    expect([kit?.buffs ?? [], kit?.triggers ?? []]).toEqual([[], []]);
  });

  it("Mordvolt Insulation: Intellect +50 in the panel and Arts DMG +0.2 from the start (full HP assumed), not on Physical hits", () => {
    const panel = computeStats(data, perlica);
    expect(panel.attrs[41]?.contributions.filter((c) => c.source.startsWith("Mordvolt Insulation set")).map((c) => c.value)).toEqual([50]);
    const s = run(scenario({}), [op("attack1")]);
    expect(from(hitsOf(s, "attack1")[0], "Mordvolt Insulation").map((m) => [m.zone, m.element, m.value])).toEqual([["damageBonus", "pulse", expect.closeTo(0.2, 6)]]);
    const buff = s.buffs.find((b) => b.id === "suit_wisd01.arts_dmg");
    expect(buff && [buff.appliedAt, buff.expiresAt]).toEqual([0, Infinity]);
    expect(buff?.modifiers.map((m) => m.element)).toEqual(["fire", "pulse", "cryst", "natural"]);
    // Two pieces: no set bonus.
    const two = run(scenario({ gear: perlica.gear.slice(0, 2) }), [op("attack1")]);
    expect(two.buffs.some((b) => b.id === "suit_wisd01.arts_dmg")).toBe(false);
  });
});
