// Last Rite's kit (chr_0026_lastrite) and the equipment kits of her batch-4 report (Sundered Prince, Khravengger,
// Phantom Pain): the mechanics the kit plan (docs/kit-batches/batch-4/chr_0026_lastrite.md, § Kit plan and § Kit)
// says must fire, on the example's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const L = "chr_0026_lastrite";
const P = L + "_";
const SI = "chr_0036_jsspsi";
const example = readScenario(new URL("../examples/lastrite-si.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in frames. */
const op = (skill: string, at?: number): RotationAction => ({ operator: L, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const si = (skill: string, at?: number): RotationAction => ({ operator: SI, skill: `${SI}_${skill}`, ...(at !== undefined ? { at } : {}) });
const swap = (operator: string, at?: number): RotationAction => ({ operator, skill: "swap", ...(at !== undefined ? { at } : {}) });
const weapon = (id: string, levels: [number, number, number] = [9, 9, 9]) => ({ weapon: { id, level: 90, skillLevels: levels } });
const siChain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s) => si(s));
const ownChain = ["attack1", "attack2", "attack3", "attack4"].map((s) => op(s));

/** The example's team (Si first, so Si is controlled) with Last Rite's build changed; Last Rite alone with `solo`; no energy at the start unless given. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}, solo = false): TimelineScenario => ({
  ...example,
  team: example.team.filter((m) => !solo || m.operator === L).map((m) => (m.operator === L ? { ...m, ...b } : m)),
  startEnergy: {},
  durationFrames: 40 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames, d: GameData = data): TimelineState => {
  const ctx = createContext(d, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const mine = (s: TimelineState, skill?: string) => s.hits.filter((h) => h.operator === L && (skill === undefined || h.skillId === P + skill));
const castAt = (s: TimelineState, operator: string, skill: string, n = 0) => s.casts.filter((c) => c.operator === operator && c.skill === skill)[n]?.frame ?? NaN;
const ownCast = (s: TimelineState, skill: string, n = 0) => castAt(s, L, P + skill, n);
const finalStrikes = (s: TimelineState, operator: string, skill: string) => s.hits.filter((h) => h.operator === operator && h.skillId === skill).map((h) => h.frame);
const from = (h: { modifiers: readonly { source: string; zone: string; value: number }[] } | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label));
const mirages = (s: TimelineState) => mine(s, "normal_skill").map((h) => [h.hitId, h.frame] as const);
// Three Mirage pairs (three Cryo stacks) from three off-field casts and Si's Final Strikes; then Last Rite controlled.
const casts3 = [op("normal_skill"), ...siChain, op("normal_skill", 100), ...siChain, op("normal_skill", 210), ...siChain];
const third = Math.max(...mirages(run(scenario(), casts3)).map(([, f]) => f));
const stacks3 = [...casts3, swap(L, third + 1)];

describe("Last Rite's basic attacks", () => {
  it("attack1–4 land at their SkillData frames; attack4 is the Final Strike (25 Stagger, 30 SP as the controlled operator)", () => {
    const s = run(scenario({}, {}, true), ownChain);
    for (const [skill, frames] of [["attack1", [12]], ["attack2", [10, 24]], ["attack3", [9, 27]], ["attack4", [21]]] as const) {
      expect(mine(s, skill).map((h) => h.frame - ownCast(s, skill))).toEqual(frames);
    }
    const fs = data.kits.operators[L]?.skills.find((k) => k.skillId === P + "attack4")?.hits[0];
    expect(fs?.finalStrike).toBe(true);
    expect(fs?.poiseControlledOnly).toBe(true);
  });
});

describe("Last Rite's battle skill and Mirages", () => {
  it("off-field (Si controlled): the jump 0 → 300 brings its effects to the cast: returned SP (atb 30 + 5 at P5), her 16 energy, the team's energy and the perfusion", () => {
    const s0 = run(scenario(), [op("normal_skill")], 0);
    expect(ownCast(s0, "normal_skill")).toBe(0);
    expect(s0.spReturned).toBeCloseTo(35, 9);
    expect(s0.energy[L] ?? 0).toBeGreaterThan(15.9);
    // Her energy is only her own 16 (× Ultimate Gain Efficiency): the team's share is blocked by her passive.
    expect(s0.energy[L] ?? 0).toBeLessThan(16 * 1.5);
    // Si gets the team energy for the 65 natural SP spent.
    expect(s0.energy[SI] ?? 0).toBeGreaterThan(65 * 0.065 - 1e-9);
    expect(s0.buffs.filter((b) => b.id === "perfusion").map((b) => [b.target, b.expiresAt])).toEqual([["team", 15 * 30]]);
    // At P4 the returned SP is 30.
    expect(run(scenario({ potential: 4 }), [op("normal_skill")], 0).spReturned).toBeCloseTo(30, 9);
  });

  it("a holder's Final Strike while controlled brings two Mirages 9 frames later (one Cryo stack), once per cast for the whole team; Last Rite's own at +21", () => {
    const twice = [op("normal_skill"), ...siChain, ...siChain];
    const [siFs, siFs2] = finalStrikes(run(scenario(), twice), SI, `${SI}_attack5`);
    const rotation = [...twice, swap(L, (siFs2 ?? NaN) + 1), ...ownChain];
    const s = run(scenario(), rotation);
    // Si's first Final Strike only: it uses the perfusion up for every member (the owner's call, 2026-10-25; b6aa's log
    // has one pair from two holders' Final Strikes), so neither Si's second nor Last Rite's own brings more.
    expect(mirages(s)).toEqual([["mirage_1", (siFs ?? NaN) + 9], ["mirage_2", (siFs ?? NaN) + 9]]);
    expect(s.buffs.some((b) => b.id === "perfusion" && b.expiresAt > (siFs ?? NaN) + 1)).toBe(false);
    expect(siFs2).toBeGreaterThan(siFs ?? NaN);
    expect(mine(s, "normal_skill").every((h) => h.element === "cryst")).toBe(true);
    // Last Rite's own Final Strike, as the first holder to use it.
    const own = run(scenario(), [op("normal_skill"), swap(L, 1), ...ownChain]);
    const ownFs = finalStrikes(own, L, P + "attack4")[0] ?? NaN;
    expect(mirages(own)).toEqual([["mirage_main_1", ownFs + 21], ["mirage_main_2", ownFs + 21]]);
    // One Cryo stack per pair.
    expect(run(scenario(), [op("normal_skill"), ...siChain], (siFs ?? NaN) + 10).enemy.infliction).toMatchObject({ element: "cryst", stacks: 1 });
    // P5: atk_scale (× 1.2) × 0.5.
    const hit = mine(s, "normal_skill")[0];
    expect(hit?.zones.scale).toBeCloseTo(1.92, 4);
    const p4 = mine(run(scenario({ potential: 4 }), [op("normal_skill"), ...siChain]), "normal_skill")[0];
    expect(p4?.zones.scale).toBeCloseTo(1.6, 4);
  });

  it("a new cast gives the perfusion back to a member who used it", () => {
    const s = run(scenario(), [op("normal_skill"), ...siChain, op("normal_skill", 100), ...siChain]);
    const fs = finalStrikes(s, SI, `${SI}_attack5`);
    expect(mirages(s).map(([, f]) => f)).toEqual([fs[0], fs[0], fs[1], fs[1]].map((f) => (f ?? NaN) + 9));
  });

  it("controlled, outside her chain: the timeline path (SP, energy, team energy and perfusion at frame 32; she's held to frame 34)", () => {
    const sc = scenario({}, {}, true);
    expect(run(sc, [op("normal_skill")], 31).spReturned).toBe(0);
    expect(run(sc, [op("normal_skill")], 31).energy[L] ?? 0).toBe(0);
    const at32 = run(sc, [op("normal_skill")], 32);
    expect(at32.spReturned).toBeCloseTo(35, 9);
    expect(at32.energy[L] ?? 0).toBeGreaterThan(15.9);
    expect(at32.buffs.some((b) => b.id === "perfusion")).toBe(true);
    const s = run(sc, [op("normal_skill"), ...ownChain]);
    expect(ownCast(s, "attack1")).toBe(34);
    const fs = finalStrikes(s, L, P + "attack4")[0] ?? NaN;
    expect(mirages(s)).toEqual([["mirage_main_1", fs + 21], ["mirage_main_2", fs + 21]]);
    // Team energy at 32 too, for Si (off-field).
    const duo = (f: number) => run(scenario(), [swap(L), op("normal_skill")], f).energy[SI] ?? 0;
    expect(duo(31)).toBe(0);
    expect(duo(32)).toBeGreaterThan(65 * 0.065 - 1e-9);
  });

  it("inside her own basic attack (before its exclusive frame), the cast runs beside it: the chain isn't delayed, its effects come at the cast", () => {
    const sc = scenario({}, {}, true);
    const plain = run(sc, ownChain);
    const beside = run(sc, [op("attack1"), op("attack2"), op("normal_skill"), op("attack3"), op("attack4")]);
    expect(ownCast(beside, "normal_skill")).toBe(ownCast(beside, "attack2"));
    expect(ownCast(beside, "attack3")).toBe(ownCast(plain, "attack3"));
    expect(ownCast(beside, "attack4")).toBe(ownCast(plain, "attack4"));
    expect(mine(beside, "attack2")).toHaveLength(2);
    const cast = ownCast(beside, "normal_skill");
    const atCast = run(sc, [op("attack1"), op("attack2"), op("normal_skill")], cast);
    expect(atCast.spReturned).toBeCloseTo(35, 9);
    expect(atCast.buffs.some((b) => b.id === "perfusion")).toBe(true);
    // Neither timeline path's effects come later: one SP return and one energy grant per cast.
    const later = run(sc, [op("attack1"), op("attack2"), op("normal_skill")], cast + 400);
    expect(later.energy[L]).toBeCloseTo(atCast.energy[L] ?? NaN, 9);
    const fs = finalStrikes(beside, L, P + "attack4")[0] ?? NaN;
    expect(mirages(beside)).toEqual([["mirage_main_1", fs + 21], ["mirage_main_2", fs + 21]]);
    // The team's energy at the cast, once (Si off-field).
    const duoRotation = [swap(L), op("attack1"), op("attack2"), op("normal_skill")];
    const duoCast = castAt(run(scenario(), duoRotation), L, P + "normal_skill");
    expect(run(scenario(), duoRotation.slice(0, 2), duoCast - 1).energy[SI] ?? 0).toBe(0);
    const atDuoCast = run(scenario(), duoRotation, duoCast).energy[SI] ?? 0;
    expect(atDuoCast).toBeGreaterThan(65 * 0.065 - 1e-9);
    expect(run(scenario(), duoRotation, duoCast + 400).energy[SI] ?? 0).toBeCloseTo(atDuoCast, 9);
  });

  it("P1: +atk_up (20%) DMG on the holder's Final Strike while controlled and +poise (5) Stagger; neither below P1", () => {
    const sc = scenario({}, {}, true);
    const rotation = [op("normal_skill"), ...ownChain];
    const fs = (b: Partial<Build>) => mine(run(scenario(b, {}, true), rotation), "attack4")[0];
    expect(from(fs({}), "Hypothermic Perfusion").map((m) => [m.zone, m.value])).toEqual([["damageBonus", expect.closeTo(0.2, 6)]]);
    // Below P1 potential_1 is 0.
    expect(from(fs({ potential: 0 }), "Hypothermic Perfusion").map((m) => m.value)).toEqual([0]);
    // Not on other hits.
    expect(from(mine(run(sc, rotation), "attack3")[0], "Hypothermic Perfusion")).toEqual([]);
    // The Stagger: at P1 5 more than at P0 (which deals attack4's 25, its other hits' and the Mirages' none).
    const poise = (b: Partial<Build>, r: RotationAction[]) => {
      const s0 = run(scenario(b, {}, true), [], 0).stagger.poise;
      return s0 - run(scenario(b, {}, true), r).stagger.poise;
    };
    expect(poise({}, rotation) - poise({ potential: 0 }, rotation)).toBeCloseTo(5, 6);
  });
});

describe("Last Rite's combo, talents and ultimate", () => {
  it("the combo opens at 3 Cryo stacks; its bonus is atk_scale3 × n and its slash consumes them; energy 40 + 15 × n at frame 13", () => {
    expect(() => run(scenario(), [op("normal_skill"), ...siChain, op("combo_skill", 150)])).toThrow(/combo trigger/);
    const s = run(scenario(), [...stacks3, op("combo_skill")]);
    const cast = ownCast(s, "combo_skill");
    const hits = mine(s, "combo_skill");
    expect(hits.map((h) => [h.hitId, h.frame - cast])).toEqual([["shard", 13], ["bonus", 63], ["slash", 63]]);
    const bonus = hits.find((h) => h.hitId === "bonus");
    // atk_scale3 2.4 × 1.15 (P3) × 3.
    expect(bonus?.zones.scale).toBeCloseTo(2.4 * 1.15 * 3, 4);
    expect(s.enemy.infliction).toBeNull();
    const energy = (f: number) => run(scenario(), [...stacks3, op("combo_skill")], f).energy[L] ?? 0;
    const gain = energy(cast + 13) - energy(cast + 12);
    // 40 + 15 × 3 = 85, × her Ultimate Gain Efficiency (the same factor as her battle skill's 16).
    const before = run(scenario(), [op("normal_skill")], 0).energy[L] ?? 0;
    expect(gain / before).toBeCloseTo(85 / 16, 6);
  });

  it("talent 1: consuming n Cryo stacks gives the enemy Cryo Susceptibility crystal_up × n (0.04 × 3) for 15 s; not unlearned", () => {
    const rotation = [...stacks3, op("combo_skill"), op("ultimate_skill")];
    const s = run(scenario({}, { startEnergy: { [L]: "full" } }), rotation, 800);
    const slash = mine(s, "ultimate_skill")[0];
    // 0.12 × 1.5 (talent 2 at level 2: the whole Cryo Susceptibility × rate).
    expect(from(slash, "Hypothermia").map((m) => [m.zone, m.value])).toEqual([["susceptibility", expect.closeTo(0.12 * 1.5, 6)]]);
    // 15 s from the consumption (without the ultimate's time stop, which holds it).
    const noUlt = run(scenario(), [...stacks3, op("combo_skill")], 800);
    const consumed = ownCast(noUlt, "combo_skill") + 63;
    expect(noUlt.buffs.find((b) => b.id === "talent1_vul")?.expiresAt).toBe(consumed + 15 * 30);
    expect(run(scenario({ talents: [0, 2] }, { startEnergy: { [L]: "full" } }), rotation, 800).buffs.some((b) => b.id === "talent1_vul")).toBe(false);
  });

  it("talent 1 interim (in-game test 81): a Mirage's Cryo that turns another element's infliction into a reaction counts as consuming it", () => {
    const kit = data.kits.operators[L] as OperatorKit;
    const heat: KitTrigger = { id: "test_heat", on: { event: "fightStart" }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "fire" }] }] };
    const withHeat: GameData = { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [L]: { ...kit, triggers: [...kit.triggers, heat] } } } };
    const s = run(scenario({}, {}, true), [op("normal_skill"), ...ownChain], 300, withHeat);
    const fs = finalStrikes(s, L, P + "attack4")[0] ?? NaN;
    expect(s.reactions.some((r) => r.frame === fs + 21 && r.kind !== "burst")).toBe(true);
    expect(s.buffs.find((b) => b.id === "talent1_vul")?.appliedAt).toBe(fs + 21);
  });

  it("ultimate: slashes at 86, 105 (atk_scale) and 134 (atk_scale2); talent 2 scales every Cryo Susceptibility on them × rate (1.5, 1.2 at level 1)", () => {
    const sus = (b: Partial<Build>) => {
      const s = run(scenario(b, { startEnergy: { [L]: "full" } }), [...stacks3, op("combo_skill"), op("ultimate_skill")]);
      const cast = ownCast(s, "ultimate_skill");
      return { frames: mine(s, "ultimate_skill").map((h) => [h.hitId, h.frame - cast]), zone: mine(s, "ultimate_skill").map((h) => h.zones.susceptibility) };
    };
    const full = sus({});
    expect(full.frames).toEqual([["slash", 86], ["slash", 105], ["slash_3", 134]]);
    expect(full.zone.every((z) => Math.abs(z - (1 + 0.12 * 1.5)) < 1e-6)).toBe(true);
    expect(sus({ talents: [2, 1] }).zone.every((z) => Math.abs(z - (1 + 0.12 * 1.2)) < 1e-6)).toBe(true);
    expect(sus({ talents: [2, 0] }).zone.every((z) => Math.abs(z - 1.12) < 1e-6)).toBe(true);
  });

  it("her passive: teammates' battle skills give her no team energy; her own grants pass", () => {
    const s = run(scenario(), [si("normal_skill")], 60);
    expect(s.energy[L] ?? 0).toBe(0);
    expect(s.energy[SI] ?? 0).toBeGreaterThan(0);
  });
});

describe("Last Rite's equipment kits", () => {
  it("Khravengger: the battle skill's Cryo Infliction (her Mirage) gives Cryo DMG +cryst_dmg_up; combo damage on a Cryo-inflicted enemy +cryst_dmg_up2", () => {
    const s = run(scenario(), [...stacks3, op("combo_skill")]);
    const [first, second] = mine(s, "normal_skill");
    // The first Mirage applies the stack; the buff comes after its damage.
    expect(from(first, "Khravengger")).toEqual([]);
    expect(from(second, "Khravengger").map((m) => m.value)).toEqual([expect.closeTo(0.28, 6)]);
    const combo = mine(s, "combo_skill");
    expect(from(combo.find((h) => h.hitId === "shard"), "combo damage")).toEqual([]);
    expect(from(combo.find((h) => h.hitId === "bonus"), "combo damage").map((m) => m.value)).toEqual([expect.closeTo(0.56, 6)]);
  });

  it("Sundered Prince: the wielder's Final Strike while controlled gives ATK +atk_up × multi (×2) for 8 s and its Stagger +poise_up", () => {
    const sp = weapon("wpn_claym_0008");
    const s = run(scenario(sp, {}, true), [...ownChain, op("attack1")], 200);
    expect(from(mine(s, "attack4")[0], "Sundered Prince")).toEqual([]);
    const after = from(mine(s, "attack1")[1], "Sundered Prince");
    expect(after.map((m) => [m.zone, m.value])).toEqual([["atk", expect.closeTo(2 * 0.28, 6)]]);
    expect(s.buffs.find((b) => b.id === "wpn_claym_0008.atk")?.expiresAt).toBe((finalStrikes(s, L, P + "attack4")[0] ?? NaN) + 8 * 30);
    // Stagger: attack4's 25 × (1 + poise_up) / 1 over the same chain with Khravengger (P0: no Mirage Stagger).
    const poise = (b: Partial<Build>) => {
      const sc = scenario({ ...b, potential: 0 }, {}, true);
      return run(sc, [], 0).stagger.poise - run(sc, ownChain).stagger.poise;
    };
    const panel = 1;
    expect(poise(sp) - poise({})).toBeCloseTo((25 * 0.336) / panel, 4);
  });

  it("Phantom Pain (on Catcher): each battle skill or combo cast gives a layer of Physical DMG +phy_dmg_up2, at most 3, each 20 s", () => {
    const C = "chr_0020_meurs";
    const catcher = readScenario(new URL("../examples/catcher-counter.scenario.json", import.meta.url).pathname);
    const { enemyActions: _attacks, ...rest } = catcher;
    const sc: TimelineScenario = { ...rest, team: catcher.team.map((m) => ({ ...m, ...weapon("wpn_claym_0016") })), startEnergy: {}, durationFrames: 60 * 30 };
    const cast = (at: number): RotationAction => ({ operator: C, skill: `${C}_normal_skill`, at });
    const rotation = [cast(0), cast(150), cast(300), cast(450)];
    const last = castAt(run(sc, rotation), C, `${C}_normal_skill`, 3);
    expect(last).toBeLessThan(20 * 30);
    const s = run(sc, rotation, last);
    const layers = s.buffs.filter((b) => b.id === "wpn_claym_0016.phys");
    // The fourth replaces the first.
    expect(layers.map((b) => b.appliedAt)).toEqual([1, 2, 3].map((n) => castAt(s, C, `${C}_normal_skill`, n)));
    expect(layers.every((b) => b.expiresAt - b.appliedAt === 20 * 30)).toBe(true);
    expect(layers.every((b) => Math.abs((b.attrs?.[0]?.value ?? b.modifiers[0]?.value ?? 0) - 0.154) < 1e-6)).toBe(true);
  });
});
