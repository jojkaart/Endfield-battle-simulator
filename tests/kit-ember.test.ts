// Ember's kit (chr_0009_azrila) and her equipment kits (wpn_claym_0004 Exemplar, wpn_claym_0006 Former Finery,
// wpn_claym_0007 Thunderberge): the mechanics the kit plan (docs/kit-batches/batch-4/chr_0009_azrila.md, § Kit plan
// and § Kit) says must fire, on the example's build (P5, Thunderberge, Æthertech ×4) with Catcher.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, type Build, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0009_azrila";
const P = C + "_";
const CATCHER = "chr_0020_meurs";
const example = readScenario(new URL("../examples/ember-guard.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in seconds. */
const op = (skill: string, at?: number): RotationAction => ({ operator: C, skill: P + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const weapon = (id: string, skillLevels: [number, number, number] = [9, 9, 9]): Partial<Build> => ({ weapon: { id, level: 90, skillLevels } });

/** The example's scenario with Ember's build changed, the enemy's actions replaced and no energy at the start. */
const scenario = (b: Partial<Build>, enemyActions: TimelineScenario["enemyActions"] = [], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === C ? { ...m, ...b } : m)),
  enemyActions,
  startEnergy: {},
  durationFrames: 30 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** Enemy attacks on the controlled operator at frames. */
const attackAtFrames = (...frames: number[]): TimelineScenario["enemyActions"] => [{ kind: "attack", at: frames }];
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === P + skill && (hit === undefined || h.hitId === hit));
const buff = (s: TimelineState, id: string) => s.buffs.filter((b) => b.id === id && b.owner === C);
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.skill === P + skill)[n]?.frame ?? NaN;
const kit = data.kits.operators[C];
/** The Stagger dealt so far (the enemy's poise left counts down). */
const startPoise = (() => {
  const ctx = createContext(data, example);
  return init(ctx).stagger.poise;
})();
const dealt = (s: TimelineState) => startPoise - s.stagger.poise;

describe("Ember's battle skill (Forward March)", () => {
  it("leap at 10 (Heat, no Stagger), slam at 38 (Heat, Knock Down, 10 Stagger) and the team's energy at 38", () => {
    const s = run(scenario({}), [op("normal_skill")], 60);
    expect(hitsOf(s, "normal_skill").map((h) => [h.hitId, h.frame, h.element])).toEqual([
      ["leap", 10, "fire"],
      ["slam", 38, "fire"],
    ]);
    expect(dealt(s)).toBeCloseTo(10, 6);
    // Knock Down on an enemy without Vulnerable only adds a stack.
    expect(s.enemy.vulnerable?.stacks).toBe(1);
    expect(run(scenario({}), [op("normal_skill")], 37).energy[CATCHER] ?? 0).toBe(0);
    expect(s.energy[CATCHER] ?? 0).toBeGreaterThan(0);
  });

  it("the guard: attacked in frames 0–38, the slam deals extrapoise (10) more Stagger (a poise-only landing: no hit, no damage); not when attacked after 38", () => {
    const guarded = run(scenario({}, attackAtFrames(20)), [op("normal_skill")], 60);
    expect(buff(run(scenario({}, attackAtFrames(20)), [op("normal_skill")], 21), "guard_success")).toHaveLength(1);
    expect(dealt(guarded)).toBeCloseTo(20, 6);
    expect(hitsOf(guarded, "normal_skill").map((h) => h.hitId)).toEqual(["leap", "slam"]);
    const late = run(scenario({}, attackAtFrames(45)), [op("normal_skill")], 60);
    expect(dealt(late)).toBeCloseTo(10, 6);
    // The listener ends at frame 38.
    expect(buff(run(scenario({}), [op("normal_skill")], 37), "guard_listen")).toHaveLength(1);
    expect(buff(run(scenario({}), [op("normal_skill")], 39), "guard_listen")).toHaveLength(0);
  });

  it("with dodging on she doesn't dash in frames [0, 38) (noDodge): the slam lands; an attack after 38 is dodged", () => {
    const dodging = (frame: number): TimelineScenario => ({ ...scenario({}, attackAtFrames(frame)), options: { ...example.options, dodge: { chance: 1 } } });
    const guarded = run(dodging(20), [op("normal_skill")], 60);
    expect(guarded.casts.some((c) => c.skill === "dodge")).toBe(false);
    expect(hitsOf(guarded, "normal_skill", "slam")).toHaveLength(1);
    expect(dealt(guarded)).toBeCloseTo(20, 6);
    expect(run(dodging(45), [op("normal_skill")], 60).casts.some((c) => c.skill === "dodge")).toBe(true);
  });

  it("talent 1: Protection (attribute 63, shelterrate + P1's extrashelter) in frames 0–38; P1: a second one for extratime (1.5 s) from the slam", () => {
    const at = (b: Partial<Build>, frame: number) => run(scenario(b), [op("normal_skill")], frame);
    const p = buff(at({}, 1), "protection");
    expect(p).toHaveLength(1);
    expect(kit?.buffs.find((b) => b.id === "protection")?.modifiers.map((m) => m.attr)).toEqual([63]);
    expect(buff(at({}, 39), "protection")).toHaveLength(0);
    expect(buff(at({}, 39), "protection_hit").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[38, 38 + 45]]);
    expect(buff(at({ potential: 0 }, 39), "protection_hit")).toHaveLength(0);
    expect(buff(at({ talents: [0, 2] }, 1), "protection")).toHaveLength(0);
    expect(buff(at({ talents: [0, 2] }, 39), "protection_hit")).toHaveLength(0);
  });
});

describe("Ember's combo (Frontline Support), talent 2 and ultimate", () => {
  it("the combo opens when the controlled operator is attacked; its hit at 26 Knocks Down, deals 10 Stagger and gives energy", () => {
    const sc = scenario({}, attackAtFrames(30));
    const ctx = createContext(data, sc);
    // One asked for earlier waits for the attack that opens it (until 2026-10-25 an error: a combo waited only for hits and delayed actions).
    expect(earliestStart(ctx, init(ctx), op("combo_skill"))).toEqual({ frame: 30 });
    const s = run(sc, [op("combo_skill", 1)], 90);
    expect(castAt(s, "combo_skill")).toBe(30);
    expect(hitsOf(s, "combo_skill").map((h) => [h.frame, h.element])).toEqual([[56, "physical"]]);
    expect(dealt(s)).toBeCloseTo(10, 6);
    expect(s.energy[C] ?? 0).toBeGreaterThan(0);
    // Talent 1's Protection in its clip [0–26], P1's extension from the hit.
    expect(buff(run(sc, [op("combo_skill", 1)], 40), "protection")).toHaveLength(1);
    expect(buff(run(sc, [op("combo_skill", 1)], 57), "protection")).toHaveLength(0);
    expect(buff(run(sc, [op("combo_skill", 1)], 57), "protection_hit").map((b) => b.expiresAt)).toEqual([56 + 45]);
  });

  it("talent 2: an ATK layer (+attack, 9% at level 2) per enemy hit on Ember, up to 3 on one refreshed timer (stackingType 10)", () => {
    expect(kit?.buffs.find((b) => b.id === "ferric_atk")?.sharedTimer).toBe(true);
    const s = run(scenario({}, attackAtFrames(30, 90, 150, 210)), [], 211);
    const layers = buff(s, "ferric_atk");
    expect(layers).toHaveLength(3);
    expect(new Set(layers.map((b) => b.expiresAt))).toEqual(new Set([210 + 210]));
    expect(layers[0]?.modifiers[0]?.value).toBeCloseTo(0.09, 6);
    expect(buff(run(scenario({ talents: [2, 0] }, attackAtFrames(30)), [], 31), "ferric_atk")).toHaveLength(0);
  });

  it("the ultimate at 50: 25 Stagger, the team's shield (a shield-category buff) for 10 s, and at P5 ATK + extraattack (10%) for each holder", () => {
    const ult = (b: Partial<Build>) => run(scenario(b, [], { startEnergy: { [C]: "full" } }), [op("ultimate_skill")], 51);
    const s = ult({});
    expect(hitsOf(s, "ultimate_skill").map((h) => [h.frame, h.element])).toEqual([[50, "fire"]]);
    expect(dealt(s)).toBeCloseTo(25, 6);
    expect(buff(s, "ult_shield").map((b) => [b.target, b.expiresAt, b.categories])).toEqual([["team", 50 + 300, ["shield"]]]);
    const atk = buff(s, "p5_atk");
    expect(atk.map((b) => [b.target, b.expiresAt])).toEqual([["team", 350]]);
    expect(atk[0]?.modifiers[0]?.value).toBeCloseTo(0.1, 6);
    expect(buff(ult({ potential: 4 }), "p5_atk")).toHaveLength(0);
  });
});

describe("Ember's equipment", () => {
  it("Exemplar: a Physical DMG layer per battle-skill landing (leap and slam: 2, own timers), which her Physical basics then get", () => {
    // Without Æthertech, whose layers come with the slam's Vulnerable stack.
    const b = { ...weapon("wpn_claym_0004"), gear: [] };
    const s = run(scenario(b), [op("normal_skill"), op("attack1")], 400);
    const layers = buff(s, "wpn_claym_0004.phy");
    expect(layers.map((x) => x.appliedAt)).toEqual([10, 38]);
    const basic = hitsOf(s, "attack1")[0];
    const plain = hitsOf(run(scenario(b), [op("attack1")], 60), "attack1")[0];
    expect((basic?.zones.damageBonus ?? NaN) - (plain?.zones.damageBonus ?? NaN)).toBeCloseTo(2 * (layers[0]?.modifiers[0]?.value ?? NaN), 6);
  });

  it("Former Finery: a heal event when an operator with Protection is attacked (Ember during her battle skill with talent 1), once per cd", () => {
    const b = weapon("wpn_claym_0006");
    const count = (s: TimelineState) => s.triggerState[`${C}:wpn_claym_0006.on_protected_hit`]?.count ?? 0;
    expect(count(run(scenario(b, attackAtFrames(20)), [op("normal_skill")], 60))).toBe(1);
    // Not Protected: no cast, or talent 1 not learned.
    expect(count(run(scenario(b, attackAtFrames(20)), [], 60))).toBe(0);
    expect(count(run(scenario({ ...b, talents: [0, 2] }, attackAtFrames(20)), [op("normal_skill")], 60))).toBe(0);
    // Two Protected hits within the cooldown: one heal.
    expect(count(run(scenario(b, attackAtFrames(5, 25)), [op("normal_skill")], 60))).toBe(1);
  });

  it("Thunderberge: the combo's heal (combo kind) gives the controlled operator its shield for `duration`; shield category from the tag", () => {
    const s = run(scenario({}, attackAtFrames(30)), [op("combo_skill", 1)], 57);
    const shield = buff(s, "wpn_claym_0007.shield");
    expect(shield.map((b) => [b.appliedAt, b.recipients, b.categories])).toEqual([[56, [C], ["shield"]]]);
    expect(shield[0]?.expiresAt).toBe(56 + 450);
    // No heal of the combo kind, no shield: the battle skill heals no one.
    expect(buff(run(scenario({}, attackAtFrames(20)), [op("normal_skill")], 60), "wpn_claym_0007.shield")).toHaveLength(0);
  });
});

describe("Ember's example", () => {
  it("runs: two guarded battle skills, the combo, the ultimate", () => {
    const ctx = createContext(data, example);
    let s = init(ctx);
    for (const a of example.rotation) s = apply(ctx, s, a);
    s = advance(ctx, s, example.durationFrames);
    expect(s.casts.filter((c) => c.skill === P + "normal_skill")).toHaveLength(2);
    expect(s.casts.filter((c) => c.skill === P + "combo_skill")).toHaveLength(1);
    expect(s.casts.filter((c) => c.skill === P + "ultimate_skill")).toHaveLength(1);
  });
});
