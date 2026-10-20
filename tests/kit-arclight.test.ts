// Arclight's kit (chr_0007_ikut) and the equipment batch 3 gave her (wpn_sword_0015 Aspirant, wpn_sword_0018 Twelve Questions):
// the mechanics the kit plan (docs/kit-batches/batch-3/chr_0007_ikut.md) says must fire, and the interims' behaviour.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const A = "chr_0007_ikut";
const P = A + "_";
const N = "chr_0023_antal";
const example = readScenario(new URL("../examples/arclight-solo.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: A, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const ULT = op("ultimate_skill");
/** After the ultimate's explosion (cast frame 117): the enemy has its forced Electrification. */
const AFTER_EXPLOSION = 120;

const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** The example with Arclight's build changed. */
const withArclight = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === A ? { ...m, ...b } : m)),
  ...extra,
});
const mine = (s: TimelineState, skill: string) => s.hits.filter((h) => h.operator === A && h.skillId === P + skill);
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === A && c.skill === P + skill)[n]?.frame ?? NaN;
const from = (h: LandedHit | undefined, text: string) => (h ? h.modifiers.filter((m) => m.source.includes(text)) : []);
const fired = (s: TimelineState, trigger: string) => s.triggerState[`${A}:${trigger}`]?.count ?? 0;
const intellect = (sc: TimelineScenario) => createContext(data, sc).panels.get(A)?.attrs[41]?.total ?? NaN;

describe("Arclight's kit", () => {
  it("ultimate: the dash at 61 inflicts Electric; after the explosion at 117 the infliction is consumed and Electrification forced at its level", () => {
    const s = run(example, [ULT], 200);
    const ult = mine(s, "ultimate_skill");
    expect(ult.map((h) => [h.hitId, h.frame, h.element])).toEqual([["dash", 61, "pulse"], ["explosion", 117, "pulse"]]);
    // The forced Electrification comes after the explosion's damage (afterDamage): the explosion has no Arts DMG Taken from it.
    expect(ult[1]?.zones.damageTaken).toBe(1);
    expect(run(example, [ULT], 62).enemy.infliction).toEqual(expect.objectContaining({ element: "pulse", stacks: 1 }));
    expect(s.reactions.filter((r) => r.operator === A).map((r) => [r.kind, r.frame, "stacks" in r ? r.stacks : "level" in r ? r.level : null])).toEqual([
      ["consumed", 117, 1],
      ["reaction", 117, 1],
    ]);
    expect(s.enemy.infliction).toBeNull();
    expect(s.enemy.statuses.map((x) => [x.status, x.level])).toEqual([["electrification", 1]]);
  });

  it("ultimate: two Electric stacks (Antal's combo repeats the dash's infliction on his Focus) force Electrification II", () => {
    const antal: Build = { operator: N, level: 90, promotion: 4, potential: 5, skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 }, weapon: { id: "wpn_funnel_0003", level: 90, skillLevels: [9, 9, 9] }, gear: [] };
    const s = run({ ...example, team: [...example.team, antal] }, [{ operator: N, skill: N + "_normal_skill" }, op("ultimate_skill", 30), { operator: N, skill: N + "_combo_skill" }], 400);
    expect(s.reactions.filter((r) => r.operator === A && (r.kind === "consumed" || r.kind === "reaction")).map((r) => [r.kind, "stacks" in r ? r.stacks : "level" in r ? r.level : null])).toEqual([
      ["consumed", 2],
      ["reaction", 2],
    ]);
  });

  it("ultimate on a Heat-inflicted enemy: the dash's Electric reacts (Electrification), so the explosion finds no Electric Infliction and forces nothing", () => {
    // Akekuri's battle skill inflicts Heat at its frame 20.
    const K = "chr_0019_karin";
    const ake = readScenario(new URL("../examples/akekuri-laevatain.scenario.json", import.meta.url).pathname).team.find((m) => m.operator === K);
    if (!ake) throw new Error("no Akekuri build");
    const s = run({ ...example, team: [...example.team, ake] }, [{ operator: K, skill: K + "_normal_skill" }, op("ultimate_skill", 30)], 300);
    const mineR = s.reactions.filter((r) => r.operator === A);
    expect(mineR.map((r) => [r.kind, r.frame, "status" in r ? r.status : null, "consumed" in r ? r.consumed : null])).toEqual([["reaction", 30 + 61, "electrification", "fire"]]);
  });

  it("ultimate cost: 76.5 at P4+ (90 × 0.85), 90 below", () => {
    const full = (pot: number) => run(withArclight({ potential: pot }), [], 1).energy[A] ?? NaN;
    expect(full(5)).toBeCloseTo(76.5, 4);
    expect(full(3)).toBeCloseTo(90, 4);
  });

  it("battle skill without Electrification at the cast: slashes at 19 and 24, nothing at 136; team energy at frame 24", () => {
    const sc = withArclight({}, { startEnergy: {} });
    const s = run(sc, [op("normal_skill")], 300);
    expect(mine(s, "normal_skill").map((h) => [h.hitId, h.frame, h.element])).toEqual([["slash1", 19, "physical"], ["slash2", 24, "physical"]]);
    const energy = (f: number) => run(sc, [op("normal_skill")], f).energy[A] ?? 0;
    expect(energy(23)).toBe(0);
    // 100 SP spent × 0.065.
    expect(energy(24)).toBeCloseTo(6.5, 6);
  });

  it("battle skill with Electrification at the cast: the frame-4 jump to 96, slashes at cast 20 and 26, the Electric extra attack at 44 with Electrification's Arts DMG Taken, then the consumption", () => {
    const s = run(withArclight({}, { startEnergy: { [A]: "full" } }), [ULT, op("normal_skill", AFTER_EXPLOSION)], 400);
    const cast = castAt(s, "normal_skill");
    const hits = mine(s, "normal_skill");
    expect(hits.map((h) => [h.hitId, h.frame - cast, h.element])).toEqual([["slash1_e", 20, "physical"], ["slash2_e", 26, "physical"], ["extra", 44, "pulse"]]);
    // atk_scale2 4.05 at level 12; Electrification I: Arts DMG Taken +12% (consumed after the damage: FinishBuffAdvanced follows the DamageAction).
    const extra = hits[2];
    expect(extra?.zones.scale).toBeCloseTo(4.05, 6);
    expect(from(extra, "Electrification").map((m) => [m.zone, m.value])).toEqual([["damageTaken", expect.closeTo(0.12, 6)]]);
    expect(s.reactions.filter((r) => r.kind === "statusConsumed").map((r) => [r.operator, r.frame - cast])).toEqual([[A, 44]]);
    expect(s.enemy.statuses).toEqual([]);
  });

  it("the Electrification variant's team energy comes at frame 136 (cast frame 44), not at 24", () => {
    const sc = withArclight({}, { startEnergy: { [A]: "full" } });
    const rotation = [ULT, op("normal_skill", AFTER_EXPLOSION)];
    const energy = (f: number) => run(sc, rotation, f).energy[A] ?? 0;
    const cast = castAt(run(sc, rotation, 200), "normal_skill");
    // The ultimate spent all; the combo isn't cast here.
    expect(energy(cast + 43)).toBe(0);
    expect(energy(cast + 44)).toBeCloseTo(6.5, 6);
  });

  it("battle skill: Electrification gone between the cast and frame 136 gives the third Physical slash (poise2), no extra attack", () => {
    const s0 = run(example, [ULT], 200);
    const ends = s0.enemy.statuses[0]?.expiresAt ?? NaN;
    const s = run(withArclight({}, { startEnergy: { [A]: "full" } }), [ULT, op("normal_skill", ends - 30)], ends + 200);
    const cast = castAt(s, "normal_skill");
    expect(cast).toBe(ends - 30);
    expect(mine(s, "normal_skill").map((h) => [h.hitId, h.frame - cast, h.element])).toEqual([["slash1_e", 20, "physical"], ["slash2_e", 26, "physical"], ["third", 44, "physical"]]);
    expect(s.reactions.some((r) => r.kind === "statusConsumed")).toBe(false);
  });

  it("the extra attack returns atb SP (40, P1: +10): 50 at P5, 40 at P0", () => {
    const gain = (pot: number) => {
      const sc = withArclight({ potential: pot }, { startEnergy: { [A]: "full" } });
      const rotation = [ULT, op("normal_skill", AFTER_EXPLOSION)];
      const cast = castAt(run(sc, rotation, 200), "normal_skill");
      // SP regeneration is paused 1.5 s after the battle skill's cost, so the step is the extra attack's SP alone.
      return (run(sc, rotation, cast + 44).sp ?? 0) - (run(sc, rotation, cast + 43).sp ?? 0);
    };
    expect(gain(5)).toBeCloseTo(50, 6);
    expect(gain(0)).toBeCloseTo(40, 6);
  });

  it("combo: opened by the ultimate's forced Electrification; three Physical slashes at 17, 21, 25, the first with usp 5", () => {
    const s = run(example);
    expect(castAt(s, "combo_skill")).toBe(117);
    expect(mine(s, "combo_skill").map((h) => [h.hitId, h.frame - 117, h.element])).toEqual([["hit1", 17, "physical"], ["hit2", 21, "physical"], ["hit2", 25, "physical"]]);
    expect(run(example, example.rotation.slice(0, 2), 117 + 17).energy[A]).toBeCloseTo(5, 6);
  });

  it("combo: the extra attack's consumption opens the window when the combo is ready, and is ignored during its 3 s cooldown (T5 interim, in-game test 60)", () => {
    const sc = withArclight({}, { startEnergy: { [A]: "full" } });
    // No combo: the window from the forced Electrification is refreshed by the consumption.
    const ready = run(sc, [ULT, op("normal_skill", AFTER_EXPLOSION)], 400);
    const consumed = ready.reactions.find((r) => r.kind === "statusConsumed")?.frame ?? NaN;
    expect(ready.comboWindow[A]?.from).toBe(consumed);
    // The example: combo at 117, its cooldown runs past the consumption (frame 188): no window afterwards.
    const s = run(example);
    const at = s.reactions.find((r) => r.kind === "statusConsumed")?.frame ?? NaN;
    expect(at).toBe(188);
    expect(fired(s, "combo_on_consumed")).toBe(1);
    expect(s.comboWindow[A]).toBeUndefined();
  });

  it("talent 1: the counter gains on each extra attack; at P5 the second completes it: the team buff (Intellect × pulse_up, 15 s) acts on that hit, the counter resets", () => {
    const sc = withArclight({}, { startEnergy: { [A]: "full" }, startStacks: { [A]: { wildland_count: 1 } } });
    const s = run(sc, [ULT, op("normal_skill", AFTER_EXPLOSION)], 400);
    const extra = mine(s, "normal_skill").find((h) => h.hitId === "extra");
    // pulse_up 0.0008 (talent 1 level 2) × 1.3 (P3), × her Intellect (Twelve Questions raises it).
    const bonus = 0.0008 * 1.3 * intellect(sc);
    expect(from(extra, "Wildland Trekker").map((m) => [m.zone, m.value])).toEqual([["damageBonus", expect.closeTo(bonus, 6)]]);
    const buff = s.buffs.find((b) => b.id === "wildland_trekker");
    expect(buff && [buff.appliedAt, buff.expiresAt - buff.appliedAt, buff.target]).toEqual([extra?.frame, 450, "team"]);
    expect(s.stacks[A]?.wildland_count).toBe(0);
    // From 0: one layer, no buff.
    const first = run(withArclight({}, { startEnergy: { [A]: "full" } }), [ULT, op("normal_skill", AFTER_EXPLOSION)], 400);
    expect(first.stacks[A]?.wildland_count).toBe(1);
    expect(first.buffs.some((b) => b.id === "wildland_trekker")).toBe(false);
  });

  it("talent 1 below P5 needs 3 extra attacks; unlearned, nothing counts", () => {
    const at = (b: Partial<Build>, start: number) => run(withArclight(b, { startEnergy: { [A]: "full" }, startStacks: { [A]: { wildland_count: start } } }), [ULT, op("normal_skill", AFTER_EXPLOSION)], 400);
    const two = at({ potential: 4 }, 1);
    expect([two.stacks[A]?.wildland_count, two.buffs.some((b) => b.id === "wildland_trekker")]).toEqual([2, false]);
    const three = at({ potential: 4 }, 2);
    expect([three.stacks[A]?.wildland_count, three.buffs.some((b) => b.id === "wildland_trekker")]).toEqual([0, true]);
    const p0 = at({ potential: 0 }, 2);
    const extra = mine(p0, "normal_skill").find((h) => h.hitId === "extra");
    // P3's ×1.3 is missing below P3.
    expect(from(extra, "Wildland Trekker")[0]?.value).toBeCloseTo(0.0008 * intellect(withArclight({ potential: 0 })), 6);
    const unlearned = at({ talents: [0, 0] }, 1);
    expect([unlearned.stacks[A]?.wildland_count, unlearned.buffs.some((b) => b.id === "wildland_trekker")]).toEqual([1, false]);
  });

  it("talent 1's counter never expires (B4 interim, in-game test 65): still 1 twenty seconds after the extra attack", () => {
    const s = run(withArclight({}, { startEnergy: { [A]: "full" } }), [ULT, op("normal_skill", AFTER_EXPLOSION)], 900);
    expect(s.stacks[A]?.wildland_count).toBe(1);
  });

  it("basic attack 5: the Final Strike with atb SP and stagger poise as the controlled operator", () => {
    const s = run(example);
    const a5 = mine(s, "attack5");
    expect(a5.map((h) => [h.hitId, h.frame - castAt(s, "attack5"), h.zones.scale])).toEqual([["hit", 12, expect.closeTo(1.07, 6)]]);
  });
});

describe("Twelve Questions (wpn_sword_0018)", () => {
  it("ATK +atk_up for 20 s after the wielder consumes an Arts Reaction (her extra attack); not on the hit that consumes it, nor after consuming an infliction", () => {
    const s = run(example);
    const extra = mine(s, "normal_skill").find((h) => h.hitId === "extra");
    expect(from(extra, "Twelve Questions")).toEqual([]);
    const after = s.hits.filter((h) => h.operator === A && h.frame > (extra?.frame ?? Infinity));
    expect(after.length).toBeGreaterThan(0);
    for (const h of after) expect(from(h, "Twelve Questions").map((m) => [m.zone, m.value])).toEqual([["atk", expect.closeTo(0.21, 6)]]);
    const buff = s.buffs.find((b) => b.id === "wpn_sword_0018.atk_up") ?? run(example, example.rotation, 300).buffs.find((b) => b.id === "wpn_sword_0018.atk_up");
    expect(buff && [buff.appliedAt, buff.expiresAt - buff.appliedAt]).toEqual([extra?.frame, 600]);
    // The ultimate consumes an Electric Infliction, not a reaction.
    expect(fired(run(example, [ULT], 200), "wpn_sword_0018.consume")).toBe(0);
  });
});

describe("Aspirant (wpn_sword_0015) on other wielders", () => {
  it("a Lift by the wielder adds a layer (30 s); the wielder's next ultimate uses all layers for its hits (Physical DMG +phy_dmg_up each)", () => {
    // Estella (a polearm: the engine flags the mismatch but simulates it) Lifts with her combo; her ultimate is Physical.
    const sc = readScenario(new URL("../examples/endministrator-crystals.scenario.json", import.meta.url).pathname);
    const E = "chr_0021_whiten";
    const worn: TimelineScenario = { ...sc, startEnergy: { ...sc.startEnergy, [E]: "full" }, team: sc.team.map((m) => (m.operator === E ? { ...m, weapon: { id: "wpn_sword_0015", level: 90, skillLevels: [9, 9, 9] } } : m)) };
    const rotation = [...sc.rotation.slice(0, 6), { operator: E, skill: E + "_ultimate_skill" }];
    const lift = run(worn, rotation).reactions.find((r) => r.kind === "physical" && r.status === "lift" && r.operator === E);
    expect(lift).toBeDefined();
    const before = run(worn, rotation.slice(0, 6), (lift?.frame ?? 0) + 1);
    expect(before.buffs.filter((b) => b.id === "wpn_sword_0015.lift").map((b) => [b.appliedAt, b.expiresAt - b.appliedAt])).toEqual([[lift?.frame, 900]]);
    const s = run(worn, rotation);
    const ult = s.hits.filter((h) => h.operator === E && h.skillId === E + "_ultimate_skill");
    expect(ult.length).toBeGreaterThan(0);
    for (const h of ult) expect(from(h, "Aspirant").map((m) => [m.zone, m.value])).toEqual([["damageBonus", expect.closeTo(0.336, 6)]]);
    expect(s.buffs.some((b) => b.id === "wpn_sword_0015.lift")).toBe(false);
    // Without its ultimate the layer is still there afterwards.
    expect(run(worn, rotation.slice(0, 6)).buffs.some((b) => b.id === "wpn_sword_0015.lift")).toBe(true);
  });

  it("on Arclight (no Lift) only the stat panel acts: her ultimate gets Ultimate DMG, no layer", () => {
    const sc = withArclight({ weapon: { id: "wpn_sword_0015", level: 90, skillLevels: [9, 9, 9] } });
    const s = run(sc);
    expect(s.buffs.some((b) => b.id === "wpn_sword_0015.lift")).toBe(false);
    expect(fired(s, "wpn_sword_0015.on_lift")).toBe(0);
    const ult = mine(s, "ultimate_skill");
    const battle = mine(s, "normal_skill");
    expect(ult[0]?.zones.damageBonus).toBeGreaterThan(1);
    expect(battle.find((h) => h.element === "pulse")?.zones.damageBonus ?? 1).toBe(1);
  });
});
