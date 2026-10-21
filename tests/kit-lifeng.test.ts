// Lifeng's kit (chr_0015_lifeng) and the equipment batch 4 gave her (wpn_lance_0009 Opero 77, wpn_lance_0011 JET,
// wpn_lance_0012 Mountain Bearer): the mechanics the kit plan (docs/kit-batches/batch-4/chr_0015_lifeng.md, § Kit plan
// and § Kit) says must fire, on the example's build (P5, Mountain Bearer, Swordmancer ×4). No log has Lifeng.
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const L = "chr_0015_lifeng";
const P = L + "_";
const example = readScenario(new URL("../examples/lifeng-solo.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in seconds. */
const op = (skill: string, at?: number): RotationAction => ({ operator: L, skill: P + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const chain = (at?: number) => ["attack1", "attack2", "attack3", "attack5"].map((a, i) => op(a, i === 0 ? at : undefined));
const weapon = (id: string) => ({ id, level: 90, skillLevels: [9, 9, 9] });

/** The example's scenario with Lifeng's build changed. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => ({ ...m, ...b })),
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === P + skill && (hit === undefined || h.hitId === hit));
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === L && c.skill === P + skill)[n]?.frame ?? NaN;
const relFrames = (s: TimelineState, skill: string, n = 0) => hitsOf(s, skill).map((h) => h.frame - castAt(s, skill, n));
/** Talent 2's hits (trigger subduer_of_evil). */
const talentHits = (s: TimelineState, hit?: string) => s.hits.filter((h) => h.operator === L && h.skillId === `${L}.subduer_of_evil` && (hit === undefined || h.hitId === hit));
const from = (h: LandedHit | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label)).map((m) => m.value);
const staggerDealt = (sc: TimelineScenario, s: TimelineState) => init(createContext(data, sc)).stagger.poise - s.stagger.poise;

// Battle skill on the fresh enemy (Susceptibility), a chain whose Final Strike opens the combo, combo (Link), ultimate.
const opening: RotationAction[] = [op("normal_skill"), ...chain(), op("combo_skill"), op("ultimate_skill")];

describe("Lifeng's kit: hits and frames", () => {
  const s = run(example, opening, 30 * 14);

  it("each hit lands at its SkillData frame after its cast; the ultimate's three from the entity spawned at 58", () => {
    expect(relFrames(s, "normal_skill")).toEqual([7, 20, 54]);
    expect(hitsOf(s, "normal_skill").map((h) => h.hitId)).toEqual(["hit", "hit", "slam"]);
    expect(relFrames(s, "attack1")).toEqual([9, 17]);
    expect(relFrames(s, "attack5")).toEqual([13, 24]);
    expect(relFrames(s, "combo_skill")).toEqual([19, 48]);
    expect(relFrames(s, "ultimate_skill")).toEqual([64, 124, 179]);
    expect(hitsOf(s, "ultimate_skill").map((h) => h.hitId)).toEqual(["slam", "slam_2", "link_hit"]);
  });

  it("every hit is Physical; attack5's literal-0 unit isn't a hit; scales at L12", () => {
    expect(new Set(s.hits.filter((h) => h.operator === L).map((h) => h.element))).toEqual(new Set(["physical"]));
    expect(hitsOf(s, "attack5").map((h) => h.zones.scale)).toEqual([expect.closeTo(0.39, 6), expect.closeTo(1.13, 6)]);
    expect(hitsOf(s, "normal_skill", "slam")[0]?.zones.scale).toBeCloseTo(2.68, 6);
    expect(hitsOf(s, "ultimate_skill").map((h) => h.zones.scale)).toEqual([4, 4, 6].map((v) => expect.closeTo(v, 6)));
  });

  it("the combo window opens on a Final Strike against the Susceptible enemy, and not on a clean one", () => {
    expect(castAt(s, "combo_skill")).toBeGreaterThan(castAt(s, "attack5"));
    expect(() => run(example, [...chain(), op("combo_skill")], 30 * 8)).toThrow(/combo trigger/);
  });

  it("P4: the ultimate costs 90 × 0.85 = 76.5 energy (90 below P4)", () => {
    expect(run(example, [], 1).energy[L]).toBeCloseTo(76.5, 4);
    expect(run(scenario({ potential: 3 }), [], 1).energy[L]).toBeCloseTo(90, 4);
  });
});

describe("Lifeng's kit: Turbid Avatar's Physical Susceptibility", () => {
  const susc = (h: LandedHit | undefined) => h?.zones.susceptibility ?? NaN;

  it("on an enemy without Vulnerable, before the slam's own damage: ×1.17 at P1+ (0.12 + 0.05), ×1.12 at P0; the swings before it have none", () => {
    const p5 = run(example, [op("normal_skill")], 30 * 3);
    expect(hitsOf(p5, "normal_skill", "hit").map(susc)).toEqual([1, 1]);
    expect(susc(hitsOf(p5, "normal_skill", "slam")[0])).toBeCloseTo(1.17, 6);
    const p0 = run(scenario({ potential: 0 }), [op("normal_skill")], 30 * 3);
    expect(susc(hitsOf(p0, "normal_skill", "slam")[0])).toBeCloseTo(1.12, 6);
    const buff = p5.buffs.find((b) => b.id === "physical_susceptibility");
    expect(buff && buff.expiresAt - buff.appliedAt).toBe(12 * 30);
  });

  it("P1: also on an enemy with at most 2 Vulnerable stacks (applied again by the second slam at 1 stack); P0 not", () => {
    const rotation = [op("normal_skill"), op("normal_skill")];
    const second = (b: Partial<Build>) => {
      const s = run(scenario(b), rotation, 30 * 6);
      const slam = hitsOf(s, "normal_skill", "slam")[1];
      const buff = s.buffs.filter((x) => x.id === "physical_susceptibility").at(-1);
      return { slam: slam?.frame, appliedAt: buff?.appliedAt };
    };
    const p1 = second({ potential: 1 });
    expect(p1.appliedAt).toBe(p1.slam);
    const p0 = second({ potential: 0 });
    expect(p0.appliedAt).not.toBe(p0.slam);
  });

  it("P1: not on an enemy with 3 or more stacks (the example's later slams)", () => {
    const s = run(example);
    const slams = hitsOf(s, "normal_skill", "slam");
    expect(slams).toHaveLength(3);
    // The first slam's Susceptibility still covers the second (12 s), the third has none.
    expect(slams.map(susc)).toEqual([expect.closeTo(1.17, 6), expect.closeTo(1.17, 6), 1]);
    expect(s.reactions.filter((r) => r.kind === "vulnerable").map((r) => (r.kind === "vulnerable" ? r.before : NaN))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("Lifeng's kit: Link and the ultimate's third hit", () => {
  it("her combo gives one Link stack at its frame 19 that lasts 20 s (the ComboAction's duration)", () => {
    const rotation = [op("normal_skill"), ...chain(), op("combo_skill")];
    const s0 = run(example, rotation, 30 * 5);
    const combo = castAt(s0, "combo_skill");
    expect(run(example, rotation, combo + 18).link).toEqual([]);
    expect(run(example, rotation, combo + 20).link).toEqual([combo + 19 + 20 * 30]);
  });

  it("the ultimate after it uses the Link: ×1.20 on its hits, and its third hit lands", () => {
    const s = run(example, opening, 30 * 14);
    expect(hitsOf(s, "ultimate_skill").map((h) => from(h, "Link"))).toEqual([[0.2], [0.2], [0.2]].map((x) => x.map((v) => expect.closeTo(v, 6))));
    expect(s.link).toEqual([]);
  });

  it("without a Link, two hits only (castLink); the battle skill after the combo takes the Link instead (×1.30)", () => {
    const alone = run(example, [op("ultimate_skill")], 30 * 10);
    expect(hitsOf(alone, "ultimate_skill").map((h) => h.hitId)).toEqual(["slam", "slam_2"]);
    const battleFirst = run(example, [op("normal_skill"), ...chain(), op("combo_skill"), op("normal_skill"), op("ultimate_skill")], 30 * 20);
    expect(hitsOf(battleFirst, "normal_skill").slice(3).map((h) => from(h, "Link"))).toEqual([[0.3], [0.3], [0.3]].map((x) => x.map((v) => expect.closeTo(v, 6))));
    expect(hitsOf(battleFirst, "ultimate_skill").map((h) => h.hitId)).toEqual(["slam", "slam_2"]);
  });

  it("the Link lasts 20 s: an ultimate a second before it runs out has its third hit, one just after has not (test 78's question)", () => {
    const rotation = [op("normal_skill"), ...chain(), op("combo_skill")];
    const combo = castAt(run(example, rotation, 30 * 5), "combo_skill");
    const late = run(example, [...rotation, { ...op("ultimate_skill"), at: combo + 19 + 20 * 30 + 1 }], combo + 30 * 30);
    expect(hitsOf(late, "ultimate_skill").map((h) => h.hitId)).toEqual(["slam", "slam_2"]);
    const inTime = run(example, [...rotation, { ...op("ultimate_skill"), at: combo + 19 + 20 * 30 - 30 }], combo + 30 * 30);
    expect(hitsOf(inTime, "ultimate_skill").map((h) => h.hitId)).toEqual(["slam", "slam_2", "link_hit"]);
  });
});

describe("Lifeng's kit: talents and potentials", () => {
  it("talent 2: one Physical hit of atk_scale_talent2 (1.0 at level 2) per real Knock Down, none on the Vulnerable-only first slam; none unlearned", () => {
    const s = run(example, opening, 30 * 14);
    const kd = s.reactions.filter((r) => r.kind === "physical" && r.status === "knockdown").map((r) => r.frame);
    expect(kd).toEqual(hitsOf(s, "ultimate_skill").slice(0, 2).map((h) => h.frame));
    expect(talentHits(s).map((h) => h.frame)).toEqual(kd);
    expect(talentHits(s).map((h) => [h.element, h.zones.scale])).toEqual([["physical", expect.closeTo(1, 6)], ["physical", expect.closeTo(1, 6)]]);
    // No Link and no skill-type bonus on it: a trigger hit of no cast, damageType none.
    expect(talentHits(s).flatMap((h) => from(h, "Link"))).toEqual([]);
    const lvl1 = run(scenario({ talents: [2, 1] }), opening, 30 * 14);
    expect(talentHits(lvl1).map((h) => h.zones.scale)).toEqual([0.5, 0.5].map((v) => expect.closeTo(v, 6)));
    expect(talentHits(run(scenario({ talents: [2, 0] }), opening, 30 * 14))).toEqual([]);
  });

  it("P5: the first Knock Down after 15 s deals 1.0 + 2.5 × ATK and 5 Stagger in one hit, then the 15 s charge restarts", () => {
    const s = run(example);
    const p5 = talentHits(s, "hit_p5");
    expect(p5).toHaveLength(1);
    expect(p5[0]?.frame).toBeGreaterThan(15 * 30);
    expect(p5[0]?.zones.scale).toBeCloseTo(3.5, 6);
    expect(talentHits(s, "hit").every((h) => h.frame < 15 * 30)).toBe(true);
    const timer = s.buffs.filter((b) => b.id === "p5_timer").at(-1);
    expect(timer?.appliedAt).toBe(p5[0]?.frame);
    // Its 5 Stagger: the P5 hit vs the plain one at the same Knock Down (P4).
    const at = p5[0]?.frame ?? NaN;
    const sc4 = scenario({ potential: 4 });
    // The rotation up to the third battle skill, whose slam makes the P5 hit: everything else the same at P4.
    const third = example.rotation.map((a, i) => (a.skill === P + "normal_skill" ? i : -1)).filter((i) => i >= 0)[2] ?? NaN;
    const upTo = example.rotation.slice(0, third + 1);
    const dealt = (sc: TimelineScenario) => staggerDealt(sc, run(sc, upTo, at + 1));
    // Stagger is scaled alike for every landing (the enemy's PoiseDamageTakenScalar): compare with the first slam's 10.
    const slam = staggerDealt(example, run(example, [op("normal_skill")], 60));
    expect((dealt(example) - dealt(sc4)) / slam).toBeCloseTo(5 / 10, 6);
    expect(talentHits(run(sc4), "hit_p5")).toEqual([]);
  });

  it("talent 1 is in the stat panel (attached skill, D4): unlearned, ATK is lower", () => {
    const build = example.team[0] as Build;
    const learned = computeStats(data, build).atk.total;
    const unlearned = computeStats(data, { ...build, talents: [0, 2] }).atk.total;
    expect(learned / unlearned).toBeGreaterThan(1.1);
  });
});

describe("Mountain Bearer (wpn_lance_0012) on Lifeng", () => {
  it("DMG +56% against a Vulnerable enemy, on the hit that adds the first stack too; not before", () => {
    const s = run(example, [op("normal_skill")], 30 * 3);
    expect(hitsOf(s, "normal_skill", "hit").flatMap((h) => from(h, "Weight of Mountain"))).toEqual([]);
    expect(from(hitsOf(s, "normal_skill", "slam")[0], "Weight of Mountain")).toEqual([expect.closeTo(0.56, 6)]);
  });

  it("her battle skill's Vulnerable and Physical Susceptibility give All Attributes +22.4% each for 15 s; the ultimate's Knock Downs don't", () => {
    const s = run(example, [op("normal_skill")], 30 * 3);
    const slam = hitsOf(s, "normal_skill", "slam")[0]?.frame ?? NaN;
    for (const id of ["wpn_lance_0012.attrs", "wpn_lance_0012.attrs2"]) {
      const b = s.buffs.find((x) => x.id === id);
      expect([b?.appliedAt, b && b.expiresAt - b.appliedAt]).toEqual([slam, 15 * 30]);
      expect(b?.attrs?.map((a) => [a.attr, a.value, a.percent])).toEqual([39, 40, 41, 42].map((a) => [a, expect.closeTo(0.224, 6), true]));
    }
    const ult = run(example, [op("ultimate_skill")], 30 * 8);
    expect(ult.buffs.some((b) => b.id.startsWith("wpn_lance_0012.attrs"))).toBe(false);
  });

  it("the Physical Susceptibility trigger reads the tag filter: a battle skill's Susceptibility at P1 with 1 stack fires it again", () => {
    const s = run(example, [op("normal_skill"), op("normal_skill")], 30 * 6);
    const slams = hitsOf(s, "normal_skill", "slam").map((h) => h.frame);
    expect(s.buffs.filter((b) => b.id === "wpn_lance_0012.attrs2").at(-1)?.appliedAt).toBe(slams[1]);
  });
});

describe("Opero 77 (wpn_lance_0009) and JET (wpn_lance_0011)", () => {
  it("Opero 77: flat ATK +33.6 at skill level 9, in the panel", () => {
    const p = computeStats(data, { ...(example.team[0] as Build), weapon: weapon("wpn_lance_0009") });
    expect(p.atk.flat).toBeCloseTo(33.6, 4);
  });

  it("JET on Lifeng: the buffs come with her battle skill and combo but don't touch her Physical hits", () => {
    const s = run(scenario({ weapon: weapon("wpn_lance_0011") }), opening, 30 * 14);
    expect(s.buffs.find((b) => b.id === "wpn_lance_0011.battle")?.appliedAt).toBe(castAt(s, "normal_skill"));
    expect(s.buffs.find((b) => b.id === "wpn_lance_0011.combo")?.appliedAt).toBe(castAt(s, "combo_skill"));
    expect(s.hits.filter((h) => h.operator === L).flatMap((h) => from(h, "JET"))).toEqual([]);
  });

  it("JET on Avywenna (Electric): Arts DMG +33.6% on her battle skill's own hits, and +33.6% more after her combo (two buffs)", () => {
    const A = "chr_0012_avywen";
    const sc = readScenario(new URL("../examples/avywenna-thunderlances.scenario.json", import.meta.url).pathname);
    const jet: TimelineScenario = { ...sc, team: sc.team.map((m) => (m.operator === A ? { ...m, weapon: weapon("wpn_lance_0011") } : m)) };
    const av = (skill: string, at?: number): RotationAction => ({ operator: A, skill: `${A}_${skill}`, ...(at !== undefined ? { at } : {}) });
    const s = run(jet, [av("ultimate_skill"), av("normal_skill"), ...["attack1", "attack2", "attack3", "attack4", "attack5"].map((x) => av(x)), av("combo_skill"), av("normal_skill")], 30 * 12);
    const hers = s.hits.filter((h) => h.operator === A);
    const first = hers.find((h) => h.skillId === `${A}_normal_skill`);
    expect(from(first, "JET")).toEqual([expect.closeTo(0.336, 6)]);
    const lastBattle = hers.filter((h) => h.skillId === `${A}_normal_skill`).at(-1);
    expect(from(lastBattle, "JET").sort()).toEqual([expect.closeTo(0.336, 6), expect.closeTo(0.336, 6)]);
    const span = (id: string) => {
      const b = s.buffs.find((x) => x.id === id);
      return b && b.expiresAt - b.appliedAt;
    };
    expect([span("wpn_lance_0011.battle"), span("wpn_lance_0011.combo")]).toEqual([15 * 30, 15 * 30]);
  });
});
