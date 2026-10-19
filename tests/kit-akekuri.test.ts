// Akekuri's kit (chr_0019_karin) and the equipment batch 2 gave her report (Wave Tide, the lances
// Aggeloslayer and Pathfinder's Beacon, Frontiers, Qingbo, Roving MSGR): what the kit
// (docs/kit-batches/batch-2/chr_0019_karin.md, § Kit) says must fire, on the example scenario's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, Attr, computeStats, createContext, init, type Build, type GearPiece, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const A = "chr_0019_karin";
const LV = "chr_0016_laevat";
const example = readScenario(new URL("../examples/akekuri-laevatain.scenario.json", import.meta.url).pathname);
const K = (skill: string, at?: number): RotationAction => ({ operator: A, skill: `${A}_${skill}`, ...(at !== undefined ? { at } : {}) });
const L = (skill: string, at?: number): RotationAction => ({ operator: LV, skill: `${LV}_${skill}`, ...(at !== undefined ? { at } : {}) });
const akekuri = example.team.find((m) => m.operator === A) as Build;

/** The example's team with Akekuri's build changed. */
const scenario = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === A ? { ...m, ...b } : m)),
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until?: number): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, Math.max(s.frame, until ?? sc.durationFrames));
};
/** The buffs active at the state's frame. */
const active = (s: TimelineState, id: string) => s.buffs.filter((b) => b.id === id && b.cast === undefined && b.appliedAt <= s.frame && b.expiresAt > s.frame);
const gear = (set: string, tier = 4): GearPiece[] => ["hand_01", "body_01", "edc_01", "edc_02"].map((slot) => ({ id: `item_equip_t${tier}_suit_${set}_${slot}`, artifice: [3, 3, 3] }));
const ult = [K("ultimate_skill")];

describe("Akekuri's kit", () => {
  it("the ultimate: three flares give 26 / 27 / 27 natural SP at frames 59 / 86 / 119, each a P1 layer on one shared 10 s timer and a Frontiers refresh", () => {
    // Natural (atbGainMethod 0): it gives the team ultimate energy when spent, so none of it is returned SP.
    const at = [58, 59, 86, 119].map((f) => run(example, ult, f));
    expect(at.map((s) => s.spReturned)).toEqual([0, 0, 0, 0]);
    const sp = at.map((s) => s.sp);
    // Each flare's SP, plus the regeneration between them.
    const steps = sp.slice(1).map((x, i) => x - (sp[i] ?? 0));
    expect(Math.floor(steps[0] ?? 0)).toBe(26);
    expect(steps[1]).toBeGreaterThanOrEqual(27);
    expect(steps[2]).toBeGreaterThanOrEqual(27);
    const at119 = run(example, ult, 119);
    const layers = active(at119, "positive_feedback");
    expect(layers.map((b) => b.expiresAt)).toEqual([419, 419, 419]);
    const frontiers = active(at119, "suit_atb01.dmg");
    expect(frontiers.map((b) => [b.target, b.appliedAt, b.expiresAt])).toEqual([["team", 119, 569]]);
    expect(frontiers[0]?.modifiers.map((m) => [m.zone, m.value])).toEqual([["damageBonus", expect.closeTo(0.16, 6)]]);
    expect(active(run(example, ult, 418), "positive_feedback")).toHaveLength(3);
    expect(active(run(example, ult, 419), "positive_feedback")).toHaveLength(0);
  });

  it("P3 and talent 2: a teammate's battle skill during the ultimate has ATK +10% and uses its Link stack (+30%)", () => {
    const rotation = [...ult, L("normal_skill", 2.5)];
    const explosion = (s: TimelineState) => s.hits.find((h) => h.operator === LV && h.hitId === "explosion");
    const p5 = run(example, rotation, 120);
    expect(explosion(p5)?.zones.multiplicative).toBeCloseTo(1.3, 6);
    expect(active(p5, "zone_link")).toHaveLength(0);
    const p2 = run(scenario({ potential: 2 }), rotation, 120);
    expect(active(p2, "squad_atk")).toHaveLength(0);
    expect((explosion(p5)?.zones.atk ?? 0) / (explosion(p2)?.zones.atk ?? 1)).toBeGreaterThan(1.05);
    const noTalent2 = run(scenario({ talents: [2, 0] }), rotation, 120);
    expect(explosion(noTalent2)?.zones.multiplicative).toBe(1);
    expect(noTalent2.buffs.some((b) => b.id.startsWith("zone_"))).toBe(false);
  });

  it("P3 and the Link holder end with the ultimate (frame 233, or when a basic attack cuts it at 129); at P5 the Link lasts 5 s more, within its own 10 s", () => {
    const whole = run(example, ult, 232);
    expect(active(whole, "squad_atk").map((b) => b.target)).toEqual(["team"]);
    const after = run(example, ult, 233);
    expect(active(after, "squad_atk")).toHaveLength(0);
    expect(active(after, "zone_tail").map((b) => b.expiresAt)).toEqual([383]);
    // The Link's own 10 s from frame 1 runs out first (in-game test: does it cap the tail?).
    expect(active(run(example, ult, 300), "zone_link")).toHaveLength(1);
    expect(active(run(example, ult, 301), "zone_link")).toHaveLength(0);
    const cut = [...ult, K("attack1")];
    const c = run(example, cut, 129);
    expect(c.casts.at(-1)?.frame).toBe(129);
    expect(active(c, "squad_atk")).toHaveLength(0);
    expect(active(c, "zone_tail").map((b) => b.expiresAt)).toEqual([279]);
    expect(active(run(example, cut, 278), "zone_link")).toHaveLength(1);
    expect(active(run(example, cut, 279), "zone_link")).toHaveLength(0);
    expect(active(run(scenario({ potential: 4 }), cut, 129), "zone_link")).toHaveLength(0);
  });

  it("her own battle skill that cuts the ultimate uses the Link (+30%) before the Link ends with the ultimate", () => {
    for (const potential of [5, 4]) {
      const s = run(scenario({ potential }), [...ult, K("normal_skill")], 160);
      expect(s.hits.find((h) => h.skillId === `${A}_normal_skill`)?.zones.multiplicative).toBeCloseTo(1.3, 6);
      expect(active(s, "zone_link")).toHaveLength(0);
    }
  });

  it("P5: a teammate's battle skill 4 s after the ultimate was cut short still uses the Link; at P4 it doesn't", () => {
    const rotation = [...ult, K("attack1"), L("normal_skill", 8)];
    const link = (s: TimelineState) => s.hits.find((h) => h.operator === LV && h.hitId === "explosion")?.zones.multiplicative;
    expect(link(run(example, rotation, 300))).toBeCloseTo(1.3, 6);
    expect(link(run(scenario({ potential: 4 }), rotation, 300))).toBe(1);
  });

  it("the example's combo: opened by the Stagger Node, SP 7.5 × min(1 + INT × 0.0015, 1.75) per thrust, 10 energy, two P1 layers, Wave Tide ATK, cooldown 9 s × 0.85", () => {
    const s = run(example, example.rotation);
    const combo = s.casts.find((c) => c.skill === `${A}_combo_skill`)?.frame ?? NaN;
    const before = run(example, example.rotation.slice(0, -1), combo);
    // Opened at the node (half of Rhodagn's 280), not by a full stagger.
    expect(before.comboWindow[A]).toBeDefined();
    expect(before.stagger.until).toBeNull();
    expect(before.stagger.poise).toBeGreaterThan(0);
    expect(before.stagger.poise).toBeLessThanOrEqual(140);
    const wisd = computeStats(data, akekuri).attrs[Attr.Wisd]?.total ?? 0;
    expect(wisd).toBeGreaterThan(500);
    const thrust = 7.5 * Math.min(1 + wisd * 0.0015, 1.75);
    const at = (f: number) => run(example, example.rotation, combo + f);
    // Natural SP (atbGainMethod 0): the step at each thrust (regeneration is paused here).
    for (const f of [22, 31]) expect(at(f).sp - at(f - 1).sp).toBeCloseTo(thrust, 6);
    expect(at(31).spReturned).toBe(at(0).spReturned);
    const after = at(31);
    expect(active(after, "positive_feedback").map((b) => b.expiresAt)).toEqual([combo + 331, combo + 331]);
    expect(active(after, "wpn_sword_0009.atk").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[combo, combo + 600]]);
    expect(active(after, "wpn_sword_0009.atk")[0]?.modifiers[0]?.value).toBeCloseTo(0.336, 6);
    const efficiency = computeStats(data, akekuri).attrs[44]?.total ?? 1;
    expect((after.energy[A] ?? 0) - (at(0).energy[A] ?? 0)).toBeCloseTo(10 * efficiency, 6);
    expect((s.readyAt[`${A}_combo_skill`] ?? NaN) - combo).toBe(230); // 9 s × 0.85 = 229.5 frames
  });

  it("a full stagger opens the combo too (Ram: 60 stagger HP, no Stagger Nodes)", () => {
    const sc = scenario({}, { target: { enemy: "eny_0021_agmelee", level: 90 } });
    const chain = [K("attack1"), K("attack2"), K("attack3"), K("attack4")];
    const rotation = [K("normal_skill"), ...chain, ...chain, ...chain];
    const s = run(sc, rotation, run(sc, rotation, 0).frame + 30);
    expect(s.stagger.until).not.toBeNull();
    expect(s.comboWindow[A]).toBeDefined();
    const combo = run(sc, [...rotation, K("combo_skill")], 0);
    expect(combo.casts.at(-1)?.skill).toBe(`${A}_combo_skill`);
  });

  it("P0 with no talents: 80 SP from the ultimate, nothing else", () => {
    const s = run(scenario({ potential: 0, talents: [0, 0] }), ult, 240);
    // 80 natural SP: none returned, all of it on top of what the team regenerates.
    expect(s.spReturned).toBe(0);
    const base = run(scenario({ potential: 0, talents: [0, 0] }), [], 240).sp;
    expect(s.sp - base).toBeCloseTo(Math.min(80, 300 - base), 0);
    expect(s.buffs.filter((b) => b.owner === A && !b.id.startsWith("suit_atb01")).map((b) => b.id)).toEqual([]);
  });

  it("talent 1 unlearned: the combo's SP is atb (7.5) per thrust", () => {
    const sc = scenario({ talents: [0, 1] });
    const s = run(sc, example.rotation);
    const combo = s.casts.find((c) => c.skill === `${A}_combo_skill`)?.frame ?? NaN;
    expect(run(sc, example.rotation, combo + 22).sp - run(sc, example.rotation, combo + 21).sp).toBeCloseTo(7.5, 6);
  });
});

describe("Akekuri's equipment", () => {
  it("Qingbo: a combo gives a layer of battle, combo and ultimate DMG +20% (up to two, 15 s each); its combo cooldown is × 0.85 too", () => {
    const sc = scenario({ gear: gear("combo_cd01") });
    const s = run(sc, example.rotation);
    const combo = s.casts.find((c) => c.skill === `${A}_combo_skill`)?.frame ?? NaN;
    const layer = active(run(sc, example.rotation, combo + 1), "suit_combo_cd01.spellup");
    expect(layer.map((b) => [b.appliedAt, b.expiresAt, b.maxLayers])).toEqual([[combo, combo + 450, 2]]);
    expect(layer[0]?.modifiers.map((m) => [m.zone, m.skillType, m.value])).toEqual(
      ["battle", "combo", "ultimate"].map((k) => ["damageBonus", k, expect.closeTo(0.2, 6)]),
    );
    expect((s.readyAt[`${A}_combo_skill`] ?? NaN) - combo).toBe(230); // 9 s × 0.85 = 229.5 frames
    const plain = run(scenario({ gear: [] }), example.rotation);
    const plainCombo = plain.casts.find((c) => c.skill === `${A}_combo_skill`)?.frame ?? NaN;
    expect((plain.readyAt[`${A}_combo_skill`] ?? NaN) - plainCombo).toBe(9 * 30);
  });

  it("Frontiers: SP from basic attacks (the Final Strike's) doesn't count, only skills'", () => {
    const s = run(example, [K("attack1"), K("attack2"), K("attack3"), K("attack4")], 200);
    // The Final Strike's SP is natural (atbGainMethod 0, atbSourceType 1), not a skill's: no Frontiers.
    expect(s.spReturned).toBe(0);
    expect(s.buffs.filter((b) => b.id === "suit_atb01.dmg")).toHaveLength(0);
  });

  it("Roving MSGR: Physical DMG +20% from the start (HP above 80%: always, N1)", () => {
    const buff = active(run(scenario({ gear: gear("agi01", 2) }), [], 10), "suit_agi01.phydmg");
    expect(buff.map((b) => [b.appliedAt, b.expiresAt])).toEqual([[0, Infinity]]);
    expect(buff[0]?.modifiers.map((m) => [m.zone, m.element, m.value])).toEqual([["damageBonus", "physical", expect.closeTo(0.2, 6)]]);
  });

  // No batch-2 operator uses lances: spot-checked on Estella (chr_0021_whiten), whose kit exists.
  const estella = readScenario(new URL("../examples/estella-solidification.scenario.json", import.meta.url).pathname);
  const E = "chr_0021_whiten";
  const withLance = (id: string): TimelineScenario => ({
    ...estella,
    team: estella.team.map((m) => (m.operator === E ? { ...m, weapon: { id, level: 90, skillLevels: [9, 9, 9] } } : m)),
  });
  const estellaBattle = [{ operator: "chr_0013_aglina", skill: "chr_0013_aglina_normal_skill" }, { operator: E, skill: `${E}_normal_skill`, at: 3.7 }];

  it("Aggeloslayer: the wielder's battle-skill hit gives ATK +33.6% for 20 s", () => {
    const s = run(withLance("wpn_lance_0008"), estellaBattle, 200);
    const hit = s.hits.find((h) => h.operator === E && h.skillId === `${E}_normal_skill`)?.frame ?? NaN;
    const buff = active(s, "wpn_lance_0008.atk");
    expect(buff.map((b) => [b.owner, b.appliedAt, b.expiresAt])).toEqual([[E, hit, hit + 600]]);
    expect(buff[0]?.modifiers[0]?.value).toBeCloseTo(0.336, 6);
    expect(active(run(withLance("wpn_lance_0008"), estellaBattle.slice(0, 1), 100), "wpn_lance_0008.atk")).toHaveLength(0);
  });

  it("Pathfinder's Beacon: ATK +42% from the start (HP above 80%: always, N1)", () => {
    const buff = active(run(withLance("wpn_lance_0003"), [], 10), "wpn_lance_0003.atk");
    expect(buff.map((b) => [b.owner, b.appliedAt, b.expiresAt])).toEqual([[E, 0, Infinity]]);
    expect(buff[0]?.modifiers[0]?.value).toBeCloseTo(0.42, 6);
  });
});
