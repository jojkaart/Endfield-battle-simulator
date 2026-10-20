// Fluorite's kit (chr_0022_bounda) and the equipment kits of her batch-2 report (Howling Guard, Long Road,
// Aburrey's Legacy, Xiranflow): the mechanics the kit plan (docs/kit-batches/batch-2/chr_0022_bounda.md) says
// must fire, on the example scenario's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const F = "chr_0022_bounda";
const P = F + "_";
const G = "chr_0013_aglina";
const example = readScenario(new URL("../examples/fluorite-gilberta.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: F, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const gilberta = (skill: string, at?: number): RotationAction => ({ operator: G, skill: `${G}_${skill}`, ...(at !== undefined ? { at } : {}) });

/** The example's team with Fluorite changed, without the enemy's attacks unless given. */
const scenario = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => {
  const { enemyActions: _attacks, ...rest } = example;
  return { ...rest, team: example.team.map((m) => (m.operator === F ? { ...m, ...b } : m)), durationFrames: 40 * 30, ...extra };
};
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames, d: GameData = data): TimelineState => {
  const ctx = createContext(d, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === F);
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === F && c.skill === P + skill)[n]?.frame ?? NaN;
const from = (h: { modifiers: readonly { source: string; zone: string; value: number }[] }, label: string) => h.modifiers.filter((m) => m.source.includes(label));

describe("Fluorite's kit", () => {
  it("battle skill: the kick at frame 10 sticks the explosive and Slows 3.1 s; the explosion at frame 99 (Nature, P3 Slow 6 s); a step without `at` waits for the kick", () => {
    const s = run(scenario({}), [op("normal_skill"), op("attack1")]);
    const cast = castAt(s, "normal_skill");
    // attack1 waits for the cast's exclusive frame (34), not only for the kick.
    expect(castAt(s, "attack1") - cast).toBe(34);
    const slows = s.reactions.filter((r) => r.kind === "control");
    expect(slows.map((r) => [r.frame - cast, r.kind === "control" ? r.frames : 0])).toEqual([[10, 93], [99, 180]]);
    const explosion = mine(s).filter((h) => h.skillId === P + "normal_skill");
    expect(explosion.map((h) => [h.hitId, h.frame - cast])).toEqual([["explosion", 99]]);
    expect(run(scenario({}), [op("normal_skill")], 98).enemy.infliction).toBeNull();
    expect(run(scenario({}), [op("normal_skill")], 100).enemy.infliction?.element).toBe("natural");
    // Below P3 the explosion doesn't Slow.
    const p2 = run(scenario({ potential: 2 }), [op("normal_skill")]);
    expect(p2.reactions.filter((r) => r.kind === "control")).toHaveLength(1);
  });

  it("battle skill then ultimate: the ultimate waits for the kick (awaited), its first shot detonates the explosive (×1.3), and the frame-99 explosion doesn't happen", () => {
    const sc = scenario({}, { startEnergy: { [F]: "full" } });
    const s = run(sc, [op("normal_skill"), op("ultimate_skill")]);
    const cast = castAt(s, "normal_skill");
    expect(castAt(s, "ultimate_skill") - cast).toBe(10);
    const shot1 = mine(s).find((h) => h.hitId === "shot1");
    const explosions = mine(s).filter((h) => h.skillId === P + "normal_skill");
    expect(explosions.map((h) => [h.hitId, h.frame])).toEqual([["enhanced_explosion", shot1?.frame]]);
    expect(explosions[0]?.zones.multiplicative).toBeCloseTo(1.3, 6);
    // The same explosion undetonated is ×1.
    const plain = mine(run(sc, [op("normal_skill")])).find((h) => h.hitId === "explosion");
    expect(plain?.zones.multiplicative).toBe(1);
    // Without the explosive the ultimate detonates nothing.
    expect(mine(run(sc, [op("ultimate_skill")])).some((h) => h.skillId === P + "normal_skill")).toBe(false);
  });

  it("the battle skill's team energy comes at the explosion (cast frame 99), even when her next action cuts the skill short", () => {
    const sc = scenario({}, { startEnergy: {} });
    const at = (rotation: RotationAction[], frame: number) => run(sc, rotation, frame).energy[F] ?? 0;
    expect(at([op("normal_skill")], 98)).toBe(0);
    // 100 SP × 0.065 per natural SP spent, × Ultimate Gain Efficiency.
    const whole = at([op("normal_skill")], 100);
    expect(whole).toBeGreaterThan(0);
    expect(at([op("normal_skill"), op("attack1")], 120)).toBeCloseTo(whole, 9);
  });

  it("talent 1: DMG +dmg_up (0.2) against a Slowed enemy only", () => {
    const sc = scenario({});
    const slowed = mine(run(sc, [op("normal_skill"), op("attack1")])).find((h) => h.skillId === P + "attack1");
    expect(from(slowed ?? { modifiers: [] }, "Love the Stab and Twist").map((m) => [m.zone, m.value])).toEqual([["damageBonus", expect.closeTo(0.2, 6)]]);
    const free = mine(run(sc, [op("attack1")])).find((h) => h.skillId === P + "attack1");
    expect(from(free ?? { modifiers: [] }, "Love the Stab and Twist")).toEqual([]);
    const unlearned = mine(run(scenario({ talents: [0, 2] }), [op("normal_skill"), op("attack1")])).find((h) => h.skillId === P + "attack1");
    expect(from(unlearned ?? { modifiers: [] }, "Love the Stab and Twist")).toEqual([]);
  });

  it("talent 2: an Arts attack on her gives ATK +atk_up (0.2) for 10 s with a chance (0.3 at P5, 0.2 below P2), rolled per seed; a Physical one doesn't", () => {
    const attacks = (element: "natural" | "physical"): Partial<TimelineScenario> => ({ enemyActions: [{ kind: "attack", at: [30], element }] });
    const atk = (b: Partial<Build>, element: "natural" | "physical", at: number, seed = 1) => {
      const sc = scenario(b, attacks(element));
      return from(mine(run({ ...sc, options: { ...sc.options, seed } }, [op("attack1", at)])).find((h) => h.skillId === P + "attack1") ?? { modifiers: [] }, "Unpredictable").map((m) => m.value);
    };
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
    const procs = (b: Partial<Build>) => seeds.filter((seed) => atk(b, "natural", 40, seed).length > 0).length / seeds.length;
    const lucky = seeds.find((seed) => atk({}, "natural", 40, seed).length > 0) as number;
    expect(atk({}, "natural", 40, lucky)).toEqual([expect.closeTo(0.2, 6)]);
    expect(procs({})).toBeGreaterThan(0.15);
    expect(procs({})).toBeLessThan(0.45);
    expect(procs({ potential: 1 })).toBeLessThan(procs({}) + 0.15);
    expect(seeds.some((seed) => atk({}, "physical", 40, seed).length > 0)).toBe(false);
    // 10 s from the attack at 1 s: gone by 11 s.
    expect(atk({}, "natural", 11 * 30, lucky)).toEqual([]);
  });

  it("combo: opened by 2 Nature stacks, inflicts the window's element; P5 cuts its cooldown 1 s per Cryo / Nature infliction, at most once a second", () => {
    const rotation = [gilberta("normal_skill"), op("normal_skill", 90), op("combo_skill"), op("normal_skill", 400)];
    const p5 = run(scenario({}), rotation);
    const p4 = run(scenario({ potential: 4 }), rotation);
    const combo = castAt(p5, "combo_skill");
    expect(combo).toBe(castAt(p4, "combo_skill"));
    const hit = mine(p5).find((h) => h.skillId === P + "combo_skill");
    // Its burst lands a second later (the burst buff's first tick).
    const delay = data.constants.burstDelayFrames?.natural ?? 0;
    expect(delay).toBe(30);
    expect(p5.reactions.some((r) => r.kind === "burst" && r.element === "natural" && r.frame === (hit?.frame ?? NaN) + delay)).toBe(true);
    // The explosion that opens the window cuts nothing (the combo isn't on cooldown yet), and the combo's own Nature
    // 15 frames later falls in P5's 1 s; the second battle skill's explosion cuts 1 s.
    expect((p4.readyAt[P + "combo_skill"] ?? 0) - (p5.readyAt[P + "combo_skill"] ?? 0)).toBe(30);
  });

  it("ultimate: the 4th shot adds the Nature Infliction already on the enemy at 2 stacks, not at 1", () => {
    const sc = scenario({}, { startEnergy: { [F]: "full" } });
    const inflicted = (s: TimelineState) => {
      const shot4 = mine(s).find((h) => h.hitId === "shot4");
      // A burst lands a second after its infliction.
      return s.reactions.filter((r) => r.kind === "burst" && r.operator === F && r.frame === (shot4?.frame ?? NaN) + (data.constants.burstDelayFrames?.natural ?? 0)).length;
    };
    // Gilberta's explosion (frame 164) and the detonation make 2 stacks before shot 4.
    expect(inflicted(run(sc, [gilberta("normal_skill"), op("normal_skill", 90), op("ultimate_skill")]))).toBe(1);
    expect(inflicted(run(sc, [op("normal_skill"), op("ultimate_skill")]))).toBe(0);
  });

  it("attack4_1: attack3's later window (24-30) gives the late Final Strike", () => {
    const s = run(scenario({}), [op("attack1"), op("attack2"), op("attack3"), op("attack4_1")]);
    expect(castAt(s, "attack4_1") - castAt(s, "attack3")).toBe(24);
    expect(mine(s).filter((h) => h.skillId === P + "attack4_1").map((h) => h.frame - castAt(s, "attack4_1"))).toEqual([26]);
  });
});

describe("Fluorite's equipment kits", () => {
  it("Howling Guard: battle-skill hits give ATK +atk_up; Aburrey's Legacy: one ATK buff per skill type cast", () => {
    const s = run(scenario({}, { startEnergy: { [F]: "full" } }), [op("normal_skill"), op("attack1"), op("ultimate_skill", 150)]);
    const hit = mine(s).find((h) => h.hitId === "shot2");
    expect(from(hit ?? { modifiers: [] }, "Howling Guard").map((m) => m.value)).toEqual([expect.closeTo(0.336, 6)]);
    expect(from(hit ?? { modifiers: [] }, "Aburrey").map((m) => m.value)).toEqual([expect.closeTo(0.05, 6), expect.closeTo(0.05, 6)]);
    const before = mine(s).find((h) => h.skillId === P + "attack1");
    expect(from(before ?? { modifiers: [] }, "Howling Guard")).toEqual([]);
  });

  it("Long Road: the wielder's combo cast gives ATK +atk_up, on the combo's own hit", () => {
    const longRoad = { weapon: { id: "wpn_pistol_0003", level: 90, skillLevels: [9, 9, 9] } };
    const s = run(scenario(longRoad), [gilberta("normal_skill"), op("normal_skill", 90), op("combo_skill")]);
    const hit = mine(s).find((h) => h.skillId === P + "combo_skill");
    expect(from(hit ?? { modifiers: [] }, "Long Road")).toHaveLength(1);
  });

  it("Xiranflow: consuming a level-2 Corrosion gives 2 layers of Electric and Nature DMG", () => {
    // No kit consumes Electrification or Corrosion yet: give Fluorite's attack1 a forced level-2 Corrosion and attack2 its consumption.
    const kit = data.kits.operators[F];
    if (!kit) throw new Error("no kit");
    const patched: GameData = {
      ...data,
      kits: {
        ...data.kits,
        operators: {
          ...data.kits.operators,
          [F]: {
            ...kit,
            skills: kit.skills.map((s) =>
              s.skillId === P + "attack1"
                ? { ...s, hits: s.hits.map((h) => ({ ...h, applies: [{ kind: "forcedReaction" as const, status: "corrosion" as const, level: 2 }] })) }
                : s.skillId === P + "attack2"
                  ? { ...s, hits: s.hits.map((h) => ({ ...h, applies: [{ kind: "consumeStatus" as const, statuses: ["corrosion" as const] }] })) }
                  : s,
            ),
          },
        },
      },
    };
    const gear = ["body_02", "edc_02", "hand_02"].map((p) => ({ id: `item_equip_t4_suit_expend_spell01_${p}`, artifice: [3, 3, 3] as const }));
    const s = run(scenario({ gear }), [op("attack1"), op("attack2"), op("attack3")], 40 * 30, patched);
    const hit = mine(s).find((h) => h.skillId === P + "attack3");
    expect(from(hit ?? { modifiers: [] }, "Xiranflow").map((m) => m.value)).toEqual([expect.closeTo(0.15, 6), expect.closeTo(0.15, 6)]);
  });
});
