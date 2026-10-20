// Chen Qianyu's kit (chr_0005_chen) and her equipment kits (wpn_sword_0005 Sundering Steel, wpn_sword_0007
// Fortmaker): the mechanics the kit plan (docs/kit-batches/batch-3/chr_0005_chen.md, § Kit plan and § Kit)
// says must fire, on the example's build (P5, Sundering Steel, Swordmancer ×4).
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, earliestStart, init, skillValue, type Build, type RotationAction, type StatPanel, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0005_chen";
const P = C + "_";
const example = readScenario(new URL("../examples/chen-solo.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in seconds. */
const op = (skill: string, at?: number): RotationAction => ({ operator: C, skill: P + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });

/** The example's scenario with Chen's build changed and full enemy HP unless given. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => {
  const { enemyHp: _hp, ...rest } = example;
  return { ...rest, team: example.team.map((m) => ({ ...m, ...b })), durationFrames: 40 * 30, ...extra };
};
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === P + skill && (hit === undefined || h.hitId === hit));
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.skill === P + skill)[n]?.frame ?? NaN;
/** Frames of a skill's landings from its (first) cast. */
const relFrames = (s: TimelineState, skill: string) => hitsOf(s, skill).map((h) => h.frame - castAt(s, skill));
/** The modifiers on a hit from a kit buff, by its label. */
const from = (h: { modifiers: readonly { source: string; zone: string; value: number }[] } | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label));
/** Stagger dealt so far (the bar falls from its maximum). */
const staggerDealt = (sc: TimelineScenario, s: TimelineState) => init(createContext(data, sc)).stagger.poise - s.stagger.poise;
const value = (b: Partial<Build>, skillId: string, key: string) => {
  const ctx = createContext(data, scenario(b));
  return skillValue(data, ctx.panels.get(C) as StatPanel, ctx.builds.get(C) as Build, skillId, key);
};
const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((a) => op(a));

describe("Chen's skills", () => {
  it("basic attacks: landings 2 / 1 / 2 / 2 at their SkillData frames; attack 5 is the Final Strike with 16 Stagger (1.6 × the battle skill's 10) and 18 SP", () => {
    const sc = scenario();
    const s = run(sc, chain, 150);
    expect(["attack1", "attack2", "attack3", "attack4", "attack5"].map((a) => relFrames(s, a))).toEqual([[8, 11], [7], [9, 12], [4, 10], [16]]);
    expect(hitsOf(s, "attack5")[0]?.zones.scale).toBeCloseTo(0.9, 6);
    const battle = staggerDealt(sc, run(sc, [op("normal_skill")], 60));
    expect(staggerDealt(sc, s) / battle).toBeCloseTo(1.6, 6);
    // SP regenerates 8/s; attack 5's landing adds its atb (18): compare the frame before and after it.
    const at = hitsOf(s, "attack5")[0]?.frame ?? NaN;
    expect(run(sc, chain, at + 1).sp - run(sc, chain, at - 1).sp).toBeCloseTo(18 + (2 * 8) / 30, 4);
  });

  it("the finisher: two hits of atk_scale × 0.2 and × 0.8 at frames 5 and 29", () => {
    const fin = data.kits.operators[C]?.skills.find((k) => k.skillId === P + "power_attack");
    expect(fin?.hits.map((h) => [h.frames, h.factor, h.scale])).toEqual([[[5], 0.2, ["atk_scale"]], [[29], 0.8, ["atk_scale"]]]);
  });

  it("battle skill: one hit at 13 (atk_scale 3.8 × P3 1.1); on a fresh enemy its Lift only adds a Vulnerable stack, which opens her combo window; team energy at 13", () => {
    const sc = scenario();
    const ctx = createContext(data, sc);
    expect(earliestStart(ctx, init(ctx), op("combo_skill"))).toEqual({ error: `${P}combo_skill: its combo trigger hasn't happened (no open window at frame 0)` });
    const s = run(sc, [op("normal_skill")], 60);
    expect(relFrames(s, "normal_skill")).toEqual([13]);
    expect(hitsOf(s, "normal_skill")[0]?.zones.scale).toBeCloseTo(4.18, 6);
    expect(hitsOf(run(scenario({ potential: 2 }), [op("normal_skill")], 60), "normal_skill")[0]?.zones.scale).toBeCloseTo(3.8, 6);
    expect(s.enemy.vulnerable?.stacks).toBe(1);
    expect(s.reactions.filter((r) => r.kind === "physical")).toHaveLength(0);
    expect(s.comboWindow[C]?.from).toBe(13);
    const noEnergy = scenario({}, { startEnergy: {} });
    expect(run(noEnergy, [op("normal_skill")], 12).energy[C] ?? 0).toBe(0);
    expect(run(noEnergy, [op("normal_skill")], 14).energy[C] ?? 0).toBeGreaterThan(0);
  });

  it("combo: one hit at 17 (no Stagger) with a real Lift on the Vulnerable enemy and usp 10 × Ultimate Gain Efficiency; cooldown 12 s at P5, 15 s below", () => {
    const sc = scenario({}, { startEnergy: {} });
    const s = run(sc, [op("normal_skill"), op("combo_skill")], 120);
    expect(relFrames(s, "combo_skill")).toEqual([17]);
    expect(hitsOf(s, "combo_skill")[0]?.zones.scale).toBeCloseTo(2.97, 6);
    expect(s.enemy.vulnerable?.stacks).toBe(2);
    expect(s.reactions.filter((r) => r.kind === "physical" && r.status === "lift")).toHaveLength(1);
    expect(s.hits.filter((h) => h.skillId === "reaction:lift")).toHaveLength(1);
    // No poise unit on the combo's DamageAction (its Lift and Swordmancer's hit stagger on their own).
    expect(data.kits.operators[C]?.skills.find((k) => k.skillId === P + "combo_skill")?.hits.map((h) => h.poise)).toEqual([undefined]);
    const battle = run(sc, [op("normal_skill")], 120);
    const uge = createContext(data, sc).panels.get(C)?.attrs[44]?.total ?? NaN;
    expect((s.energy[C] ?? NaN) - (battle.energy[C] ?? NaN)).toBeCloseTo(10 * uge, 4);
    // Interim (row 10, in-game test 64): a stack on an already Vulnerable enemy opens the window too, once the combo is off cooldown.
    const again = run(scenario(), [op("normal_skill"), op("combo_skill"), op("normal_skill", 13)], 13 * 30 + 14);
    const stack3 = again.reactions.find((r) => r.kind === "vulnerable" && r.stacks === 3);
    expect(stack3 && stack3.kind === "vulnerable" ? stack3.before : NaN).toBe(2);
    expect(again.comboWindow[C]?.from).toBe(stack3?.frame);
    // Off cooldown 12 s after the cast at P5 (15 s at level 12, P5 −3 s), 15 s below.
    const ready = (b: Partial<Build>) => {
      const st = run(scenario(b), [op("normal_skill"), op("combo_skill")], 30);
      return (st.readyAt[P + "combo_skill"] ?? NaN) - castAt(st, "combo_skill");
    };
    expect(ready({})).toBe(12 * 30);
    expect(ready({ potential: 4 })).toBe(15 * 30);
  });

  it("ultimate: six slashes at 58–80 and the final slash at 103 (atk_scale2 × P3 1.1); Stagger 15 + 20 (3.5 × the battle skill's); cost 70 × P4 0.85", () => {
    const sc = scenario();
    const s = run(sc, [op("ultimate_skill")], 150);
    expect(relFrames(s, "ultimate_skill")).toEqual([58, 63, 68, 72, 76, 80, 103]);
    expect(hitsOf(s, "ultimate_skill").map((h) => h.hitId)).toEqual(["slash1", "slash", "slash", "slash", "slash", "slash", "final"]);
    expect(hitsOf(s, "ultimate_skill", "slash1")[0]?.zones.scale).toBeCloseTo(0.891, 6);
    expect(staggerDealt(sc, s) / staggerDealt(sc, run(sc, [op("normal_skill")], 60))).toBeCloseTo(3.5, 6);
    // Only the first slash staggers.
    const first = run(sc, [op("ultimate_skill")], 59);
    expect(staggerDealt(sc, first) / staggerDealt(sc, s)).toBeCloseTo(15 / 35, 6);
    const final = (b: Partial<Build>) => hitsOf(run(scenario(b), [op("ultimate_skill")], 150), "ultimate_skill", "final")[0]?.zones.scale ?? NaN;
    // P5 sets potential5 = 1, which adds phy_up (0) to atk_scale2: no change.
    expect(value({}, P + "ultimate_skill", "potential5")).toBe(1);
    expect(value({ potential: 4 }, P + "ultimate_skill", "potential5")).toBe(0);
    expect(value({}, P + "ultimate_skill", "phy_up")).toBe(0);
    expect(final({})).toBeCloseTo(10.23 * 1.1, 5);
    expect(final({ potential: 2 })).toBeCloseTo(10.23, 5);
    const cost = (b: Partial<Build>) => {
      const ctx = createContext(data, scenario(b, { startEnergy: {} }));
      const r = earliestStart(ctx, init(ctx), op("ultimate_skill"));
      return "error" in r ? Number(/needs ([\d.]+)/.exec(r.error)?.[1]) : NaN;
    };
    expect(cost({})).toBeCloseTo(59.5, 4);
    expect(cost({ potential: 3 })).toBeCloseTo(70, 4);
  });
});

describe("Chen's talents and potentials", () => {
  it("Slashing Edge: one ATK layer (+0.08 at talent level 2) after each battle-skill, combo and ultimate landing, at most 5, on one timer 10 s after the latest", () => {
    const s = run(scenario(), [op("normal_skill"), op("combo_skill"), op("ultimate_skill")], 400);
    // The battle skill's own hit comes before its layer.
    expect(from(hitsOf(s, "normal_skill")[0], "Slashing Edge")).toHaveLength(0);
    expect(from(hitsOf(s, "combo_skill")[0], "Slashing Edge").map((m) => m.value)).toEqual([expect.closeTo(0.08, 6)]);
    expect(hitsOf(s, "ultimate_skill").map((h) => from(h, "Slashing Edge").length)).toEqual([2, 3, 4, 5, 5, 5, 5]);
    const last = hitsOf(s, "ultimate_skill").at(-1)?.frame ?? NaN;
    const edge = s.buffs.filter((b) => b.id === "slashing_edge");
    expect(edge).toHaveLength(5);
    expect([...new Set(edge.map((b) => b.expiresAt))]).toEqual([last + 300]);
    expect(run(scenario(), [op("normal_skill"), op("combo_skill"), op("ultimate_skill")], last + 301).buffs.filter((b) => b.id === "slashing_edge")).toHaveLength(0);
    // Basic attacks don't add layers; talent level 1 gives 0.04, level 0 nothing.
    expect(run(scenario(), chain, 200).buffs.filter((b) => b.id === "slashing_edge")).toHaveLength(0);
    const combo = (t: [number, number]) => from(hitsOf(run(scenario({ talents: t }), [op("normal_skill"), op("combo_skill")], 100), "combo_skill")[0], "Slashing Edge").map((m) => m.value);
    expect(combo([1, 2])).toEqual([expect.closeTo(0.04, 6)]);
    expect(combo([0, 2])).toEqual([]);
  });

  it("P1 Shadowless: DMG +0.2 only while the scenario has the enemy below half HP; not below P1", () => {
    const bonus = (b: Partial<Build>, hp?: TimelineScenario["enemyHp"]) =>
      from(hitsOf(run(scenario(b, hp ? { enemyHp: hp } : {}), [op("normal_skill")], 60), "normal_skill")[0], "Shadowless").map((m) => [m.zone, m.value]);
    expect(bonus({})).toEqual([]);
    expect(bonus({}, [{ from: 0, fraction: 0.5 }])).toEqual([]);
    expect(bonus({}, [{ from: 0, fraction: 0.45 }])).toEqual([["damageBonus", expect.closeTo(0.2, 6)]]);
    expect(bonus({ potential: 0 }, [{ from: 0, fraction: 0.45 }])).toEqual([]);
    // From the time the scenario says, judged per hit.
    const s = run(scenario({}, { enemyHp: [{ from: 200, fraction: 0.3 }] }), [op("normal_skill"), op("normal_skill", 8)], 400);
    expect(hitsOf(s, "normal_skill").map((h) => from(h, "Shadowless").length)).toEqual([0, 1]);
  });

  it("talent 2 (an interrupted charge's Stagger) isn't modelled: enemy charges aren't a state (E1, deferred)", () => {
    expect(data.kits.operators[C]?.triggers.map((t) => t.id)).toEqual(["combo_window", "slashing_edge", "shadowless"]);
  });

  it("the example: below half HP from 15 s, the second battle skill has P1, two Sundering Steel layers and no talent layer", () => {
    const ctx = createContext(data, example);
    let s = init(ctx);
    for (const a of example.rotation) s = apply(ctx, s, a);
    s = advance(ctx, s, example.durationFrames);
    const [first, second] = hitsOf(s, "normal_skill");
    expect(from(first, "Shadowless")).toHaveLength(0);
    expect(from(second, "Shadowless")).toHaveLength(1);
    expect(from(second, "Sundering Steel")).toHaveLength(2);
    expect(from(second, "Slashing Edge")).toHaveLength(0);
    expect(s.hits.filter((h) => h.skillId === "passive_equipsuit_physuit_01").map((h) => h.frame)).toEqual(hitsOf(s, "combo_skill").map((h) => h.frame));
  });
});

describe("Chen's equipment", () => {
  it("Sundering Steel: ATK + atk_up2 (21% at skill level 9) for 20 s per physical status she applies, on the hit that applies it; not for a Vulnerable-only Lift", () => {
    const s = run(scenario(), [op("normal_skill"), op("combo_skill")], 100);
    expect(from(hitsOf(s, "normal_skill")[0], "Sundering Steel")).toHaveLength(0);
    const combo = hitsOf(s, "combo_skill")[0];
    expect(from(combo, "Sundering Steel").map((m) => [m.zone, m.value])).toEqual([["atk", expect.closeTo(0.21, 6)]]);
    expect(s.buffs.filter((b) => b.id === "wpn_sword_0005.atk").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[combo?.frame, (combo?.frame ?? NaN) + 600]]);
  });

  it("Sundering Steel: at most 2 layers, each on its own timer, a third replaces the oldest; the marker is 0.1 s (the level table's key is \"cd \")", () => {
    // Battle skill (Vulnerable only), combo (Lift: layer 1), battle skill after the combo's cooldown (Lift: layer 2), combo (layer 3 replaces the first).
    const s = run(scenario(), [op("normal_skill"), op("combo_skill"), op("normal_skill", 13), op("combo_skill")], 900);
    const [, second] = hitsOf(s, "normal_skill");
    const [, combo2] = hitsOf(s, "combo_skill");
    expect(from(second, "Sundering Steel")).toHaveLength(2);
    expect(from(combo2, "Sundering Steel")).toHaveLength(2);
    const steel = s.buffs.filter((b) => b.id === "wpn_sword_0005.atk");
    expect(steel.map((b) => b.appliedAt)).toEqual([second?.frame, combo2?.frame]);
    // Each its own expiry (the second combo's time dilation holds the older one's).
    expect(new Set(steel.map((b) => b.expiresAt)).size).toBe(2);
    expect(value({}, "sk_wpn_sword_0005", "cd")).toBeCloseTo(0.1, 6);
  });

  it("Fortmaker: ATK +14% and Arts Intensity +70 on the stat panel at skill level 9; no triggers", () => {
    const build: Build = { ...(example.team[0] as Build), weapon: { id: "wpn_sword_0007", level: 90, skillLevels: [9, 9, 9] } };
    const panel = computeStats(data, build);
    const fort = (attr: number) => (panel.attrs[attr]?.contributions ?? []).filter((c) => c.source.includes("sk_wpn_sword_0007")).map((c) => c.value);
    expect(fort(87)).toEqual([expect.closeTo(70, 6)]);
    expect(fort(2)).toEqual([expect.closeTo(0.14, 6)]);
    expect(data.kits.equipment["wpn_sword_0007"]?.triggers ?? []).toEqual([]);
  });
});
