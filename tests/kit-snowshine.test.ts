// Snowshine's kit (chr_0014_aurora) and her equipment kits (wpn_claym_0011 Seeker of Dark Lung, wpn_claym_0012
// Finishing Call): the mechanics the kit plan (docs/kit-batches/batch-3/chr_0014_aurora.md, § Kit plan and § Kit) says
// must fire, on the example's build, and the interims' behaviour.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, type Build, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0014_aurora";
const P = C + "_";
const example = readScenario(new URL("../examples/snowshine-counter.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in seconds. */
const op = (skill: string, at?: number): RotationAction => ({ operator: C, skill: P + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });

/** The example's scenario with Snowshine's build changed, the enemy's actions replaced and no energy at the start. */
const scenario = (b: Partial<Build>, enemyActions: TimelineScenario["enemyActions"] = [], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => ({ ...m, ...b })),
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
/** Enemy attacks at times in seconds. */
const attackAt = (...seconds: number[]): TimelineScenario["enemyActions"] => [{ kind: "attack", at: seconds.map((t) => Math.round(t * 30)) }];
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === skill && (hit === undefined || h.hitId === hit));
const full = { startEnergy: { [C]: "full" as const } };

describe("Snowshine's battle skill (Saturated Defense)", () => {
  it("not attacked: 30 SP back and the team's Protection at the cast, no bash, free at MarkCanInterrupt 67, over at 106", () => {
    const sc = scenario({});
    const ctx = createContext(data, sc);
    const cast = apply(ctx, init(ctx), op("normal_skill", 0.5));
    // Without a time the next step waits for the skill's own hits; the bash lies past the end at 106 on this path.
    expect(earliestStart(ctx, cast, op("attack1"))).toEqual({ frame: 15 + 67 });
    expect(earliestStart(ctx, cast, op("normal_skill"))).toEqual({ frame: 15 + 67 });
    const at1 = advance(ctx, cast, 16);
    expect(at1.spReturned).toBeCloseTo(30, 6);
    expect(at1.buffs.filter((b) => b.id === "protection").map((b) => [b.target, b.appliedAt, b.expiresAt])).toEqual([["team", 15, 15 + 66]]);
    const s = advance(ctx, cast, 200);
    expect(hitsOf(s, P + "normal_skill")).toHaveLength(0);
    expect(s.buffs.some((b) => b.id === "protection_counter")).toBe(false);
    expect(advance(ctx, cast, 15 + 106).acting[C]).toBeUndefined();
    // In-game test 61's alternative: shields pressed back to back, each as soon as it's taken.
    const shields = run(sc, [op("normal_skill"), op("normal_skill")], 120).casts.map((c) => c.frame);
    expect(shields).toEqual([0, 67]);
  });

  it("attacked in frames 0–51: the counter jumps to 107, the bash lands 18 frames later with a Cryo infliction, she's free at 145", () => {
    const sc = scenario({}, attackAt(1));
    const ctx = createContext(data, sc);
    const at31 = advance(ctx, apply(ctx, init(ctx), op("normal_skill", 0.5)), 31);
    expect(at31.acting[C]?.skips).toEqual([{ from: 15, to: 107, at: 30, length: 92 }]);
    expect(earliestStart(ctx, at31, op("attack1"))).toEqual({ frame: 30 + 145 - 107 });
    expect(at31.buffs.filter((b) => b.id === "protection_counter").map((b) => [b.target, b.appliedAt, b.expiresAt])).toEqual([["team", 30, 30 + 33]]);
    const s = advance(ctx, at31, 200);
    const bash = hitsOf(s, P + "normal_skill", "bash");
    expect(bash.map((h) => [h.frame, h.element])).toEqual([[30 + 18, "cryst"]]);
    expect(s.enemy.infliction?.element).toBe("cryst");
  });

  it("a step judged before the attack sees the counter path", () => {
    const sc = scenario({}, attackAt(1));
    const ctx = createContext(data, sc);
    expect(earliestStart(ctx, apply(ctx, init(ctx), op("normal_skill", 0.5)), op("attack1"))).toEqual({ frame: 30 + 145 - 107 });
  });

  it("attacked after frame 51: no counter", () => {
    const s = run(scenario({}, attackAt(0.5 + 52 / 30)), [op("normal_skill", 0.5)], 200);
    expect(hitsOf(s, P + "normal_skill")).toHaveLength(0);
  });

  it("the counter path gives the second team-energy half and talent 2's talent_2_sup (6 / 10), × Ultimate Gain Efficiency", () => {
    const energy = (b: Partial<Build>, attacked: boolean) => run(scenario(b, attacked ? attackAt(1) : []), [op("normal_skill", 0.5)], 150).energy[C] ?? 0;
    const plain = energy({}, false);
    expect(plain).toBeGreaterThan(0);
    // talent_2_sup grants differ by 4 between levels 1 and 2, 6 between 0 and 1: the shares 10 : 6.
    const t0 = energy({ talents: [2, 0] }, true);
    const t1 = energy({ talents: [2, 1] }, true);
    const t2 = energy({ talents: [2, 2] }, true);
    expect(t0).toBeCloseTo(2 * plain, 6);
    expect((t2 - t0) / (t1 - t0)).toBeCloseTo(10 / 6, 6);
    expect(energy({}, true)).toBeCloseTo(t2, 6);
  });

  it("P5: the bash returns potential_5_atb (10) SP; not below P5", () => {
    const sp = (b: Partial<Build>) => run(scenario(b, attackAt(1)), [op("normal_skill", 0.5)], 60).spReturned;
    expect(sp({})).toBeCloseTo(40, 6);
    expect(sp({ potential: 4 })).toBeCloseTo(30, 6);
  });

  it("with dodging on, she doesn't dash at an attack her shield counters (E3); one outside it is dodged", () => {
    const sc = (seconds: number): TimelineScenario => ({ ...scenario({}, attackAt(seconds)), options: { ...example.options, dodge: { chance: 1 } } });
    const countered = run(sc(1), [op("normal_skill", 0.5)], 200);
    expect(hitsOf(countered, P + "normal_skill", "bash")).toHaveLength(1);
    expect(countered.casts.some((c) => c.skill === "dodge")).toBe(false);
    const later = run(sc(4), [op("normal_skill", 0.5)], 200);
    expect(later.casts.some((c) => c.skill === "dodge")).toBe(true);
  });

  it("her Protections are Protection-category buffs (attribute 63, taken_dmg 0.9)", () => {
    const kit = data.kits.operators[C];
    for (const id of ["protection", "protection_counter"]) {
      expect(kit?.buffs.find((b) => b.id === id)?.modifiers.map((m) => [m.attr, m.value])).toEqual([[63, { key: "taken_dmg", skill: P + "normal_skill" }]]);
    }
  });
});

describe("Snowshine's basic attacks", () => {
  it("are Physical (damageType 0) while she is Cryo; attack 3's second hit is the Final Strike with 25 SP", () => {
    const s = run(scenario({}), [op("attack1"), op("attack2"), op("attack3")], 200);
    expect(s.hits.map((h) => [h.skillId.slice(P.length), h.hitId, h.element])).toEqual([
      ["attack1", "hit", "physical"],
      ["attack2", "hit", "physical"],
      ["attack3", "hit", "physical"],
      ["attack3", "hit_2", "physical"],
    ]);
    const a3 = hitsOf(s, P + "attack3");
    expect((a3[1]?.exact ?? NaN) / (a3[0]?.exact ?? NaN)).toBeCloseTo(0.6 / 0.4, 6);
  });
});

describe("Snowshine's combo (interim trigger: any attack on the controlled operator)", () => {
  it("isn't available without an enemy attack", () => {
    const ctx = createContext(data, scenario({}));
    expect(earliestStart(ctx, init(ctx), op("combo_skill"))).toEqual({ error: `${P}combo_skill: its combo trigger hasn't happened (no open window at frame 0)` });
  });

  it("opens on an attack on her as the controlled operator; usp (10) energy at frame 12, no damage, no Link (her combo has no ComboAction)", () => {
    const sc = scenario({}, attackAt(1));
    const s = run(sc, [op("combo_skill", 1)], 60);
    expect(s.casts.find((c) => c.skill === P + "combo_skill")?.frame).toBe(30);
    expect(hitsOf(s, P + "combo_skill")).toHaveLength(0);
    expect(s.link).toHaveLength(0);
    const before = run(sc, [op("combo_skill", 1)], 30 + 11).energy[C] ?? 0;
    const after = run(sc, [op("combo_skill", 1)], 30 + 12).energy[C] ?? 0;
    expect(before).toBe(0);
    // 10 × Seeker's Ultimate Gain Efficiency (137.1%).
    expect(after).toBeGreaterThan(10);
    expect(after).toBeCloseTo(10 * (createContext(data, sc).panels.get(C)?.attrs[44]?.total ?? NaN), 1);
  });
});

describe("Snowshine's ultimate (Frigid Snowfield)", () => {
  const ult = (b: Partial<Build>, until = 300) => run(scenario(b, [], full), [op("ultimate_skill")], until);

  it("the slam at 62, then the Snow Zone's ten ticks every 0.5 s from 81 (atk_scale_loop 0.65 against atk_scale 4.5)", () => {
    const s = ult({});
    const start = s.casts.find((c) => c.skill === P + "ultimate_skill")?.frame ?? NaN;
    const hits = hitsOf(s, P + "ultimate_skill");
    expect(hits.map((h) => h.hitId)).toEqual(["hit", ...Array<string>(3).fill("snow_zone"), "snow_zone_solidify", ...Array<string>(6).fill("snow_zone")]);
    expect(hits.every((h) => h.element === "cryst")).toBe(true);
    // The time stop moves the detached ticks with the slam; spacing 15 frames.
    const ticks = hits.slice(1).map((h) => h.frame);
    expect(ticks.slice(1).map((f, i) => f - (ticks[i] ?? NaN))).toEqual(Array<number>(9).fill(15));
    expect((ticks[0] ?? NaN) - (hits[0]?.frame ?? NaN)).toBe(81 - 62);
    expect(start).toBeLessThan(hits[0]?.frame ?? NaN);
    expect((hits[1]?.exact ?? NaN) / (hits[0]?.exact ?? NaN)).toBeCloseTo(0.65 / 4.5, 4);
  });

  it("forcibly Solidifies the enemy at the 4th tick; P3 adds extra_duration (2 s) to that application only", () => {
    const solid = (b: Partial<Build>) => ult(b, 130).enemy.statuses.filter((x) => x.status === "solidification").map((x) => [x.level, x.expiresAt - x.appliedAt]);
    const tick = hitsOf(ult({}), P + "ultimate_skill", "snow_zone_solidify")[0]?.frame;
    expect(ult({}, 130).enemy.statuses.find((x) => x.status === "solidification")?.appliedAt).toBe(tick);
    expect(solid({ potential: 2 })).toEqual([[1, Math.round(5.75 * 30)]]);
    expect(solid({})).toEqual([[1, Math.round(5.75 * 30) + 60]]);
  });

  it("the bash's Cryo infliction doesn't get P3's extra seconds (a Solidification from a reaction keeps its table time)", () => {
    // Two counters: the second bash's Cryo bursts on the first (no reaction), so nothing else applies Solidification.
    const s = run(scenario({}, attackAt(1, 6)), [op("normal_skill", 0.5), op("normal_skill", 5.5)], 300);
    expect(s.enemy.statuses.some((x) => x.status === "solidification")).toBe(false);
  });
});

describe("Snowshine's equipment", () => {
  it("Seeker of Dark Lung: an ATK +atk_up (16.8%) layer per Arts Burst of the wielder, 30 s each, before the burst's damage; at most 3", () => {
    const s = run(scenario({}, attackAt(1, 6)), [op("normal_skill", 0.5), op("normal_skill", 5.5), op("attack1")], 400);
    const burst = s.reactions.find((r) => r.kind === "burst");
    expect(burst).toBeDefined();
    const layers = s.buffs.filter((b) => b.id === "wpn_claym_0011.atk_up");
    expect(layers.map((b) => b.expiresAt - b.appliedAt)).toEqual([900]);
    const atk = (h: { readonly zones: { readonly atk: number } } | undefined) => h?.zones.atk ?? NaN;
    const bashes = hitsOf(s, P + "normal_skill", "bash");
    const a1 = hitsOf(s, P + "attack1")[0];
    // The first bash has no layer; the attack after the burst has one (ATK × (1 + 0.168) over the base part).
    expect(atk(a1)).toBeGreaterThan(atk(bashes[0]));
    // beforeDamage: the burst itself already counts its layer, as the attack after it does.
    expect(atk(s.hits.find((h) => h.hitId.startsWith("cryst:")))).toBeCloseTo(atk(a1), 6);
    expect(atk(bashes[1])).toBeCloseTo(atk(bashes[0]), 6);
    const kit = data.kits.equipment["wpn_claym_0011"];
    expect(kit?.triggers.map((t) => [t.on.event, t.beforeDamage, t.cooldown])).toEqual([["burst", true, "cd"]]);
    // Four bursts in a row leave three layers.
    const many = run(scenario({}, attackAt(1, 6, 11, 16.5, 25.5), { durationFrames: 40 * 30 }), [0.5, 5.5, 10.5, 16, 25].map((t) => op("normal_skill", t)), 30 * 30);
    expect(many.reactions.filter((r) => r.kind === "burst").length).toBeGreaterThanOrEqual(4);
    expect(many.buffs.filter((b) => b.id === "wpn_claym_0011.atk_up" && b.expiresAt > 30 * 30)).toHaveLength(3);
  });

  it("Finishing Call: stat lines only (its combo-heal bonus acts on heal amounts, which aren't simulated)", () => {
    const kit = data.kits.equipment["wpn_claym_0012"];
    expect(kit?.buffs ?? []).toEqual([]);
    expect(kit?.triggers ?? []).toEqual([]);
    const finishing = { weapon: { id: "wpn_claym_0012", level: 90, skillLevels: [9, 9, 9] as [number, number, number] } };
    expect(run(scenario(finishing, attackAt(1)), [op("normal_skill", 0.5)], 200).hits).toHaveLength(1);
  });
});
