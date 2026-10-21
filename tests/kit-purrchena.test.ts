// Purrchena's kit (chr_0038_purrche) and her weapon's (wpn_sword_0023 Dessert Moment): the mechanics the kit
// plan (docs/kit-batches/batch-3/chr_0038_purrche.md, § Kit plan and § Kit) says must fire, on the example's build.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, type Build, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0038_purrche";
const P = C + "_";
const example = readScenario(new URL("../examples/purrchena-shield.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in seconds. */
const op = (skill: string, at?: number): RotationAction => ({ operator: C, skill: P + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });

/** The example's scenario with Purrchena's build changed, the enemy's actions replaced and no energy at the start. */
const scenario = (b: Partial<Build>, enemyActions: TimelineScenario["enemyActions"] = [], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => ({ ...m, ...b })),
  enemyActions,
  startEnergy: {},
  durationFrames: 30 * 30,
  ...extra,
});
const withSeed = (sc: TimelineScenario, seed: number): TimelineScenario => ({ ...sc, options: { ...sc.options, seed } });
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** Enemy attacks at times in seconds. */
const attackAt = (...seconds: number[]): TimelineScenario["enemyActions"] => [{ kind: "attack", at: seconds.map((t) => Math.round(t * 30)) }];
const castsOf = (s: TimelineState, skill: string) => s.casts.filter((c) => c.skill === P + skill).map((c) => c.frame);
const castAt = (s: TimelineState, skill: string, n = 0) => castsOf(s, skill)[n] ?? NaN;
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === P + skill && (hit === undefined || h.hitId === hit));
const buff = (s: TimelineState, id: string) => s.buffs.filter((b) => b.id === id && b.owner === C);
/** The giftbox's item of the combo cast at `from`, from its hits (the Dessert deals none). */
const itemOf = (s: TimelineState, from: number): string => {
  const h = s.hits.find((x) => x.skillId === P + "combo_skill" && x.frame > from && x.frame <= from + 120);
  return h === undefined ? "dessert" : h.hitId.startsWith("handicraft") ? "handicraft" : h.hitId;
};
/** The first seed whose battle `pick` likes, and what it picked. */
const firstSeed = <T>(make: (seed: number) => TimelineState, pick: (s: TimelineState) => T | undefined): T | undefined => {
  for (let seed = 1; seed <= 60; seed++) {
    const r = pick(make(seed));
    if (r !== undefined) return r;
  }
  return undefined;
};

describe("Purrchena's battle skill: the shield", () => {
  it("not attacked: 20 SP back at the cast, the shield and Protection for 3 s; the loop (cast at 49) holds her until the shield drops", () => {
    const s = run(scenario({}), [op("normal_skill"), op("attack1")], 200);
    expect(run(scenario({}), [op("normal_skill")], 1).spReturned).toBeCloseTo(20, 6);
    expect(castAt(s, "normal_skill_loop_1")).toBe(49);
    // The shield ends at 90: the loop jumps to 360, its exclusiveFrame 361 frees her a frame later.
    expect(castAt(s, "attack1")).toBe(91);
    const at1 = run(scenario({}), [op("normal_skill")], 1);
    expect(buff(at1, "shield_up").map((b) => [b.target, b.expiresAt])).toEqual([["self", 90]]);
    expect(buff(at1, "protection").map((b) => [b.target, b.expiresAt])).toEqual([["team", 90]]);
    expect(buff(at1, "counter_ready").map((b) => b.expiresAt)).toEqual([300]);
    // Protection is a buff of that category (attribute 63).
    expect(data.kits.operators[C]?.buffs.find((b) => b.id === "protection")?.modifiers.map((m) => m.attr)).toEqual([63]);
    // The loops are the battle skill's helpers: a rotation can't cast them.
    const ctx = createContext(data, scenario({}));
    expect(earliestStart(ctx, init(ctx), op("normal_skill_loop_1"))).toHaveProperty("error");
  });

  it("the first block (block_1): the shield set to 3 s again plus its 9-frame pause, 20 SP, talent 1's 10 energy and a layer; back to the loop at 23", () => {
    const s = run(scenario({}, attackAt(1)), [op("normal_skill"), op("attack1")], 300);
    expect(castsOf(s, "normal_skill_block_1")).toEqual([30]);
    expect(castsOf(s, "normal_skill_loop_2")).toEqual([53]);
    // The shield from the block: 30 + 90 + 9, then the jump to 360 and a frame.
    expect(castAt(s, "attack1")).toBe(130);
    const after = run(scenario({}, attackAt(1)), [op("normal_skill")], 31);
    expect(buff(after, "shield_up").map((b) => b.expiresAt)).toEqual([129]);
    expect(buff(after, "protection").map((b) => b.expiresAt)).toEqual([129]);
    expect(after.spReturned).toBeCloseTo(40, 6);
    expect(after.energy[C] ?? 0).toBeCloseTo(10 + (run(scenario({}), [op("normal_skill")], 31).energy[C] ?? 0), 6);
    expect(after.stacks[C]?.["sorry_came_late"]).toBe(1);
    // Without talent 1: no energy, no layer.
    const t0 = run(scenario({ talents: [0, 2] }, attackAt(1)), [op("normal_skill")], 31);
    expect(t0.stacks[C]?.["sorry_came_late"] ?? 0).toBe(0);
    expect(t0.energy[C] ?? 0).toBeCloseTo(run(scenario({ talents: [0, 2] }), [op("normal_skill")], 31).energy[C] ?? 0, 6);
  });

  it("later blocks (block_2): the shield paused 11 frames each, no more SP; one layer per battle skill, at most 3", () => {
    const s = run(scenario({}, attackAt(1, 2, 3.5)), [op("normal_skill"), op("attack1")], 400);
    expect(castsOf(s, "normal_skill_block_2")).toEqual([60, 105]);
    // 129 + 11 + 11, and a frame.
    expect(castAt(s, "attack1")).toBe(152);
    // Only the cast's and the first block's 20 each.
    expect(s.spReturned).toBeCloseTo(40, 6);
    expect(s.stacks[C]?.["sorry_came_late"]).toBe(1);
    const many = run(scenario({}, attackAt(1, 11.5, 22, 32.5), { durationFrames: 40 * 30 }), [op("normal_skill"), op("normal_skill", 10.5), op("normal_skill", 21), op("normal_skill", 31.5)]);
    expect(castsOf(many, "normal_skill_block_1")).toHaveLength(4);
    expect(many.stacks[C]?.["sorry_came_late"]).toBe(3);
  });

  it("the counter: only while the change lasts (10 s), from frame 12 and from the loop; a Nature headbutt at 9 with an infliction; it ends the shield", () => {
    const sc = scenario({});
    const ctx = createContext(data, sc);
    expect(earliestStart(ctx, init(ctx), op("normal_skill_counter"))).toHaveProperty("error");
    const cast0 = apply(ctx, init(ctx), op("normal_skill"));
    expect(earliestStart(ctx, cast0, op("normal_skill_counter"))).toEqual({ frame: 12 });
    expect(earliestStart(ctx, advance(ctx, cast0, 100), op("normal_skill"))).toHaveProperty("error");
    const s = run(sc, [op("normal_skill"), op("normal_skill_counter", 2)], 200);
    const cast = castAt(s, "normal_skill_counter");
    expect(cast).toBe(60);
    const h = hitsOf(s, "normal_skill_counter");
    expect(h.map((x) => [x.frame - cast, x.element, x.zones.scale])).toEqual([[9, "natural", 4]]);
    expect(s.enemy.infliction?.element).toBe("natural");
    for (const id of ["shield_up", "protection", "counter_ready"]) expect(buff(s, id)).toHaveLength(0);
    // The battle skill is back.
    expect(earliestStart(ctx, apply(ctx, cast0, op("normal_skill_counter")), op("normal_skill"))).not.toHaveProperty("error");
  });

  it("the ultimate ends the shield and pauses the change for its frames 0–146 (78 frames)", () => {
    const s = run(scenario({}, [], { startEnergy: { [C]: "full" } }), [op("normal_skill"), op("ultimate_skill", 1)], 31);
    expect(buff(s, "shield_up")).toHaveLength(0);
    expect(buff(s, "protection")).toHaveLength(0);
    expect(buff(s, "counter_ready").map((b) => b.expiresAt)).toEqual([300 + 78]);
  });
});

describe("Purrchena's blocks with dodging on", () => {
  it("she doesn't dash at an attack a block listener takes (noDodge): the shield blocks it; with no shield up she dashes", () => {
    const dodging = (attacks: TimelineScenario["enemyActions"]): TimelineScenario => ({ ...scenario({}, attacks), options: { ...example.options, dodge: { chance: 1 } } });
    // Attacked at 1 s (normal_skill's listener [0, 50]) and at 4 s (loop_2's after the first block).
    const shielded = run(dodging(attackAt(1, 4)), [op("normal_skill")], 200);
    expect(shielded.casts.some((c) => c.skill === "dodge")).toBe(false);
    expect(castsOf(shielded, "normal_skill_block_1")).toHaveLength(1);
    expect(castsOf(shielded, "normal_skill_block_2")).toHaveLength(1);
    // No shield: the attack is dodged.
    expect(run(dodging(attackAt(1)), [op("attack1")], 60).casts.some((c) => c.skill === "dodge")).toBe(true);
  });
});

describe("Purrchena's combo: the giftbox", () => {
  it("opens on an attack on the controlled operator; unshielded: heal and 10 energy at 61, the item at 62; she can act from MarkCanInterrupt 28", () => {
    const sc = scenario({}, attackAt(1));
    const ctx = createContext(data, sc);
    expect(earliestStart(ctx, init(ctx), op("combo_skill"))).toHaveProperty("error");
    const s = run(sc, [op("combo_skill", 1.5), op("attack1")], 300);
    expect(castAt(s, "attack1") - 45).toBe(28);
    const at = firstSeed((seed) => run(withSeed(sc, seed), [op("combo_skill", 1.5)], 300), (x) => x.hits.find((h) => h.skillId === P + "combo_skill")?.frame);
    expect((at ?? NaN) - 45).toBe(62);
    const energy = (until: number) => run(sc, [op("combo_skill", 1.5)], until).energy[C] ?? 0;
    expect(energy(45 + 61) - energy(45 + 60)).toBeCloseTo(10, 6);
  });

  it("after a block: the jump to 270, the shield paused 40 frames, the item 56 frames after the cast, back to the loop (loop_2) 39 frames after it", () => {
    const sc = scenario({}, attackAt(1));
    const s = run(sc, [op("normal_skill"), op("combo_skill", 1.5), op("attack1")], 300);
    expect(castsOf(s, "normal_skill_loop_2")).toEqual([45 + 39]);
    expect(buff(run(sc, [op("normal_skill"), op("combo_skill", 1.5)], 46), "shield_up").map((b) => b.expiresAt)).toEqual([129 + 40]);
    expect(castAt(s, "attack1")).toBe(129 + 40 + 1);
    const at = firstSeed((seed) => run(withSeed(sc, seed), [op("normal_skill"), op("combo_skill", 1.5)], 300), (x) => x.hits.find((h) => h.skillId === P + "combo_skill")?.frame);
    expect((at ?? NaN) - 45).toBe(56);
  });

  it("with the shield and no block yet: the jump to 210, the shield paused 41 frames, back to loop_1 40 frames after; no block before its frame 221", () => {
    // The window from an attack before the shield.
    const sc = (...attacks: number[]) => scenario({}, attackAt(0.5, ...attacks));
    const rotation = [op("normal_skill", 1), op("combo_skill", 2)];
    const s = run(sc(), [...rotation, op("attack1")], 300);
    expect(castsOf(s, "normal_skill_loop_1")).toEqual([60 + 40]);
    expect(castAt(s, "attack1")).toBe(30 + 90 + 41 + 1);
    const at = firstSeed((seed) => run(withSeed(sc(), seed), rotation, 300), (x) => x.hits.find((h) => h.skillId === P + "combo_skill")?.frame);
    expect((at ?? NaN) - 60).toBe(56);
    // No listener before the combo's frame 221 (11 frames after the cast): an attack then isn't blocked. (Its slow-down nearly
    // stops the enemy then: an attack a world frame after the cast lands 14 frames after it, and is blocked.)
    expect(run(sc(), rotation, 61).stacks[C]?.["combo_unguarded"]).toBe(1);
    expect(run(sc(), rotation, 70).stacks[C]?.["combo_unguarded"]).toBe(1);
    expect(run(sc(), rotation, 71).stacks[C]?.["combo_unguarded"] ?? 0).toBe(0);
    expect(castsOf(run(sc(61 / 30), rotation, 200), "normal_skill_block_1")).toEqual([74]);
  });

  it("the item: Handicraft, Bomb or Yummy Dessert, never the last one again; P3 Handicraft under its own event key; P3 Bomb ×1.2", () => {
    const counts: Record<string, number> = { handicraft: 0, bomb: 0, dessert: 0 };
    let repeats = 0;
    for (let seed = 1; seed <= 20; seed++) {
      // Each attack after the last combo's 22 s cooldown (an attack during it opens no window).
      const sc = withSeed(scenario({}, attackAt(1, 25.5, 50, 74.5), { durationFrames: 85 * 30 }), seed);
      const s = run(sc, [op("combo_skill", 3), op("combo_skill", 27.5), op("combo_skill", 52), op("combo_skill", 77)]);
      const items = castsOf(s, "combo_skill").map((f) => itemOf(s, f));
      expect(items).toHaveLength(4);
      for (let i = 1; i < items.length; i++) if (items[i] === items[i - 1]) repeats++;
      for (const x of items) counts[x] = (counts[x] ?? 0) + 1;
    }
    expect(repeats).toBe(0);
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(12);
    // Handicraft: 4 pulls at 0.25 and the end at 0.5, 0.5 s apart; at P3 under the _potential_3 entity's key.
    const handicraft = (b: Partial<Build>) =>
      firstSeed((seed) => run(withSeed(scenario(b, attackAt(1)), seed), [op("combo_skill", 1.5)], 300), (s) => {
        const h = hitsOf(s, "combo_skill").filter((x) => x.hitId.startsWith("handicraft"));
        return h.length ? h : undefined;
      }) ?? [];
    const p5 = handicraft({});
    expect(p5.map((h) => [h.hitId, h.frame - 45, h.zones.scale])).toEqual([
      ["handicraft_pull_p3", 62, 0.25], ["handicraft_pull_p3", 77, 0.25], ["handicraft_pull_p3", 92, 0.25], ["handicraft_pull_p3", 107, 0.25], ["handicraft_end_p3", 118, 0.5],
    ]);
    expect(new Set(p5.map((h) => h.skillId))).toEqual(new Set([P + "combo_skill"]));
    expect(handicraft({ potential: 2 }).map((h) => h.hitId)).toEqual(["handicraft_pull", "handicraft_pull", "handicraft_pull", "handicraft_pull", "handicraft_end"]);
    const bomb = (b: Partial<Build>) => firstSeed((seed) => run(withSeed(scenario(b, attackAt(1)), seed), [op("combo_skill", 1.5)], 300), (s) => hitsOf(s, "combo_skill", "bomb")[0]?.zones.scale);
    expect(bomb({})).toBeCloseTo(3.6, 5);
    expect(bomb({ potential: 2 })).toBeCloseTo(3, 5);
  });
});

describe("Purrchena's ultimate: the Prezzies", () => {
  const ult = (b: Partial<Build>, seed: number, rotation: RotationAction[] = [op("ultimate_skill")], enemy: TimelineScenario["enemyActions"] = [], until = 400) =>
    run(withSeed(scenario(b, enemy, { startEnergy: { [C]: "full" } }), seed), rotation, until);
  const prezzies = (s: TimelineState) => hitsOf(s, "ultimate_skill").filter((x) => x.hitId !== "handicraft_pull");

  it("three Prezzies 70 frames after the cast (the jump 67 → 135); at most one Handicraft; Ambassador's Special adds a layer of Arts Susceptibility before its damage", () => {
    let ambassadors = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = ult({}, seed);
      const cast = castAt(s, "ultimate_skill");
      const h = prezzies(s);
      expect(h.map((x) => x.hitId === "handicraft_end" ? x.frame - 56 : x.frame).map((f) => f - cast)).toEqual([70, 70, 70]);
      expect(h.filter((x) => x.hitId === "handicraft_end").length).toBeLessThanOrEqual(1);
      const amb = h.filter((x) => x.hitId === "ambassador").length;
      ambassadors += amb;
      expect(ult({}, seed, undefined, [], cast + 71).buffs.filter((b) => b.id === "arts_susceptibility" && b.target === "enemy")).toHaveLength(amb);
    }
    // P5's chance 0.3 per Prezzie: 36 expected of 120.
    expect(ambassadors).toBeGreaterThan(20);
    expect(ambassadors).toBeLessThan(55);
    const amb = firstSeed((seed) => ult({}, seed), (s) => hitsOf(s, "ultimate_skill", "ambassador")[0]);
    expect(amb?.element).toBe("physical");
    expect(amb?.zones.scale).toBeCloseTo(7.2, 5);
  });

  it("talent 1's layers raise the chance by 0.1 each, and the ultimate uses them all", () => {
    let withLayers = 0;
    let without = 0;
    const rotation = [op("normal_skill"), op("normal_skill_counter", 4), op("normal_skill", 5.5), op("normal_skill_counter", 9), op("normal_skill", 10.5), op("ultimate_skill", 16)];
    for (let seed = 1; seed <= 40; seed++) {
      const layered = ult({}, seed, rotation, attackAt(1, 6, 11), 900);
      expect(castsOf(layered, "normal_skill_block_1")).toHaveLength(3);
      expect(layered.stacks[C]?.["sorry_came_late"] ?? 0).toBe(0);
      withLayers += hitsOf(layered, "ultimate_skill", "ambassador").length;
      without += hitsOf(ult({ potential: 0 }, seed), "ultimate_skill", "ambassador").length;
    }
    // 0.3 + 3 × 0.1 = 0.6 (72 of 120 expected) vs P0's 0.2 (24).
    expect(withLayers).toBeGreaterThan(55);
    expect(without).toBeLessThan(40);
  });
});

describe("Dessert Moment", () => {
  it("a combo heal gives every healed operator Arts Intensity and Arts DMG for 20 s: the counter's Nature hit +0.098", () => {
    const sc = scenario({}, attackAt(1));
    const s = run(sc, [op("combo_skill", 1.5), op("normal_skill", 4), op("normal_skill_counter", 4.5)], 300);
    expect(s.buffs.filter((b) => b.id === "wpn_sword_0023.intensity").map((b) => [b.target, b.appliedAt])).toEqual([["team", 45 + 61]]);
    expect(s.buffs.filter((b) => b.id === "wpn_sword_0023.arts_dmg").map((b) => b.expiresAt - b.appliedAt)).toEqual([600]);
    const h = hitsOf(s, "normal_skill_counter")[0];
    expect(h?.modifiers.filter((m) => m.source.includes("Dessert Moment")).map((m) => [m.zone, m.value])).toEqual([
      ["artsIntensity", 14],
      ["damageBonus", expect.closeTo(0.098, 6)],
    ]);
  });
});
