// Zhuang Fangyi's kit (chr_0030_zhuangfy) and the equipment kits of her batch-4 report (Lone Barge, Flickers in the
// Mist, Junction Point, Suffering's End): the mechanics the kit plan (docs/kit-batches/batch-4/chr_0030_zhuangfy.md)
// says must fire, on the example scenario's build; the Nature weapons on Arcane, a natural wielder.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apply, advance, createContext, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const Z = "chr_0030_zhuangfy";
const P = Z + "_";
const PERLICA = "chr_0004_pelica";
const ANTAL = "chr_0023_antal";
const ARCANE = "chr_0032_lizhiyan";
const L = "chr_0016_laevat";
const example = readScenario(new URL("../examples/zhuangfy-solo.scenario.json", import.meta.url).pathname);
const arcaneSolo = readScenario(new URL("../examples/arcane-will-solo.scenario.json", import.meta.url).pathname);
const json = (name: string) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8")) as Build;
const zfy = example.team[0] as Build;
/** A rotation step; `at` in seconds. */
const act = (operator: string) => (skill: string, at?: number): RotationAction => ({ operator, skill: `${operator}_${skill}`, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const z = act(Z);
const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((k) => z(k));
const empChain = ["attack1_ult", "attack2_ult", "attack3_ult"].map((k) => z(k));
const weapon = (id: string): Build["weapon"] => ({ id, level: 90, skillLevels: [9, 9, 9] });
const kitSkill = (skill: string) => data.kits.operators[Z]?.skills.find((x) => x.skillId === P + skill);

/** Zhuang Fangyi alone (the example's build changed: by default P0, no gear), 60 s, no enemy attacks, no crits. */
const solo = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: [{ ...zfy, potential: 0, gear: [], ...b }],
  durationFrames: 60 * 30,
  enemyActions: [],
  options: { ...example.options, crit: "never" },
  ...extra,
});
/** With teammates after her (she's the controlled one). */
const withTeam = (b: Partial<Build>, team: readonly Build[], extra: Partial<TimelineScenario> = {}): TimelineScenario => {
  const sc = solo(b, extra);
  return { ...sc, team: [...sc.team, ...team] };
};
const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, Math.max(until, s.frame));
};
const castsOf = (s: TimelineState, skill: string, operator = Z) => s.casts.filter((c) => c.operator === operator && c.skill === `${operator}_${skill}`).map((c) => c.frame);
const hitsOf = (s: TimelineState, skill: string, operator = Z) => s.hits.filter((h) => h.operator === operator && h.skillId === `${operator}_${skill}`);
/** Hits of a skill per cast (landings between one cast and the next of the same skill). */
const perCast = (s: TimelineState, skill: string): LandedHit[][] => {
  const casts = castsOf(s, skill);
  return casts.map((c, i) => hitsOf(s, skill).filter((h) => h.frame >= c && h.frame < (casts[i + 1] ?? Infinity)));
};
const from = (h: LandedHit | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label)).map((m) => m.value);
/** Active instances (layers) of a buff at the state's frame. */
const active = (s: TimelineState, id: string, owner = Z) => s.buffs.filter((b) => b.owner === owner && b.id === id && b.appliedAt <= s.frame && b.expiresAt > s.frame);
const round = (x: number) => Number(x.toFixed(6));

// Level-12 values (SkillPatchTable, the report's "Table values"): battle skill atk_scale 0.45, atk_up_per_conduct 0.09,
// final_rate 6; Empyrean battle skill 0.81 / 0.18; combo 3.6, Empyrean combo 5.4, cooldown 17 s; P1 × 1.15 on both battle skills.
const BS = { scale: 0.45, perLevel: 0.09, final: 6 };
const BSU = { scale: 0.81, perLevel: 0.18 };
const COMBO_CD = 17 * 30;

describe("Zhuang Fangyi: basic attacks, finisher, the Empyrean attacks", () => {
  const s = run(solo(), chain);
  const rel = (skill: string) => hitsOf(s, skill).map((h) => h.frame - (castsOf(s, skill)[0] ?? NaN));

  it("each landing once, at the data's frames (kit-draft's distance and VFX alternatives are one hit)", () => {
    expect(["attack1", "attack2", "attack3", "attack4", "attack5"].map(rel)).toEqual([[6, 8], [2, 2, 15, 24, 27, 30], [14, 14, 16, 16], [11, 20, 23, 26], [20]]);
    expect(hitsOf(s, "attack5").map((h) => round(h.zones.scale))).toEqual([1.08]);
    // The finisher (castable on a Staggered enemy): BreakingAttackCalculation × 0.1 at 11 and × 0.9 at 40; in the Empyrean too (U6).
    expect(kitSkill("power_attack")?.hits.map((h) => [h.frames, h.factor])).toEqual([[[11], 0.1], [[40], 0.9]]);
    expect(kitSkill("power_attack")?.available).toBeUndefined();
  });

  it("attack5 and attack3_ult are Final Strikes, with SP and stagger only while controlled; the Empyrean attacks hit once each", () => {
    for (const k of ["attack5", "attack3_ult"]) {
      const h = kitSkill(k)?.hits[0];
      expect([h?.finalStrike, h?.sp, h?.poiseControlledOnly]).toEqual([true, { if: { controlled: true }, then: "atb" }, true]);
    }
    expect(["attack1_ult", "attack2_ult", "attack3_ult"].map((k) => kitSkill(k)?.hits.map((h) => [h.frames, h.launch]))).toEqual([[[[15], 12]], [[[13], 10]], [[[33], 3]]]);
  });

  it("the Empyrean attacks are castable only in the state, the normal ones only outside it", () => {
    const ctx = createContext(data, solo());
    expect(() => apply(ctx, init(ctx), z("attack1_ult"))).toThrow(/isn't available/);
    const ctx2 = createContext(data, solo({}, { startEnergy: { [Z]: 1000 } }));
    const st = apply(ctx2, init(ctx2), z("ultimate_skill"));
    expect(() => apply(ctx2, st, z("attack1"))).toThrow(/isn't available/);
    const e = run(solo({}, { startEnergy: { [Z]: 1000 } }), [z("ultimate_skill"), ...empChain]);
    expect(hitsOf(e, "attack3_ult").map((h) => round(h.zones.scale))).toEqual([3]);
  });
});

describe("Zhuang Fangyi: battle skill (Sunderblades and Thunder Strikes)", () => {
  const casts = (b: Partial<Build>, at: readonly number[]) => run(solo(b), at.map((t) => z("normal_skill", t)));

  it("strikes per cast with no Electrification: 1, 2, 3, 3 (P1+: 2, 3, 3, 3), the f6 Sunderblades striking at once (U1, in-game test 87)", () => {
    const counts = (p: number) => perCast(casts({ potential: p }, [0, 5, 10, 15]), "normal_skill").map((h) => h.length);
    expect(counts(0)).toEqual([1, 2, 3, 3]);
    expect(counts(1)).toEqual([2, 3, 3, 3]);
  });

  it("strike frames from the trigger interval 0.3 − N/90 s from frame 13 (rounded up), damage 3 frames after each trigger, 6 after the last", () => {
    const s = casts({}, [0, 5, 10]);
    const rel = perCast(s, "normal_skill").map((hs, i) => hs.map((h) => h.frame - (castsOf(s, "normal_skill")[i] ?? NaN)));
    expect(rel).toEqual([[28], [25, 36], [24, 32, 43]]);
    // Nine Sunderblades: 8 strikes 6 frames apart from 22, the last at 73 (the kit's hits for N = 9).
    const nine = kitSkill("normal_skill")?.hits.filter((h) => h.id.endsWith("_9")).map((h) => h.frames);
    expect(nine).toEqual([[22, 28, 34, 40, 46, 52, 58, 64], [73]]);
  });

  it("strikes deal atk_scale + atk_up_per_conduct × level (×1.15 at P1), the last × final_rate with the stagger; usp_extra energy each", () => {
    const [one, two] = perCast(casts({}, [0, 5]), "normal_skill");
    expect(one?.map((h) => [h.hitId, round(h.zones.scale)])).toEqual([["final_1", BS.scale * BS.final]]);
    expect(two?.map((h) => [h.hitId, round(h.zones.scale)])).toEqual([["strike_2", BS.scale], ["final_2", BS.scale * BS.final]]);
    const p1 = perCast(casts({ potential: 1 }, [0]), "normal_skill")[0];
    expect(p1?.map((h) => round(h.zones.scale))).toEqual([round(BS.scale * 1.15), round(BS.scale * 1.15 * BS.final)]);
    expect(kitSkill("normal_skill")?.hits.find((h) => h.id === "final_2")?.poise).toBe("poise");
    // Energy: usp_extra (6) per strike, plus the team energy for the 100 SP (0.065 per natural SP).
    const st = run(solo({}, { startEnergy: {} }), [z("normal_skill")], 60);
    expect(round(st.energy[Z] ?? NaN)).toBe(round(6 + 100 * 0.065));
  });

  it("Sunderblades last sword_duration each (36 s; 46 s at P3); at most remain_sword_limit (9)", () => {
    // P0: casts at 0, 10, 20 s make one each (fewer than 3 out); at 50 s the 0 s and 10 s ones are gone (each its own timer; a shared,
    // refreshed one would leave 3: in-game test 87). P2 / P3 (P1's extra blade at 0 s): at 40 s the two 0 s blades are gone at 36 s, not at 46 s.
    const last = (p: number, t: number) => perCast(casts({ potential: p }, [0, 10, 20, t]), "normal_skill")[3]?.length;
    expect(last(0, 50)).toBe(2);
    expect([last(2, 40), last(3, 40)]).toEqual([2, 3]);
    const b = active(run(solo(), [z("normal_skill")], 10), "sunderblade")[0];
    expect(b && b.expiresAt - b.appliedAt).toBe(36 * 30);
    expect(kitSkill("normal_skill")?.hits.filter((h) => h.id.startsWith("final_")).length).toBe(9);
  });

  it("a new battle skill ends the previous one's strikes (its first frames reset the count)", () => {
    // The free Empyrean cast (3 Sunderblades: strikes at 27, 33, the last at 44), recast at its frame 30 (its window): the old last strike is gone.
    const s = run(solo({}, { startEnergy: { [Z]: 1000 } }), [z("ultimate_skill"), z("normal_skill_ult")]);
    const c = castsOf(s, "normal_skill_ult")[0] ?? NaN;
    const again = run(solo({}, { startEnergy: { [Z]: 1000 } }), [z("ultimate_skill"), z("normal_skill_ult"), { ...z("normal_skill_ult"), at: c + 30 }]);
    expect(hitsOf(again, "normal_skill_ult").map((h) => [h.frame - c, h.hitId])).toEqual([[27, "strike_3"], [33, "strike_3"], [57, "strike_3"], [63, "strike_3"], [74, "final_3"]]);
  });
});

describe("Zhuang Fangyi: combo, consuming Electrification", () => {
  // Perlica's battle skill inflicts Electric; Zhuang Fangyi's Final Strike opens her combo, which consumes it and forces Electrification.
  const rotation = (n: number): RotationAction[] => [...Array.from({ length: n }, () => act(PERLICA)("normal_skill")), ...chain, z("combo_skill"), z("normal_skill")];
  const sc = (b: Partial<Build> = {}) => withTeam(b, [json("perlica-p5.json")], { startEnergy: {} });

  it("the combo consumes the Electric Infliction and forces Electrification of that level; energy usp + usp_extra × stacks", () => {
    const s = run(sc(), rotation(1));
    const c = castsOf(s, "combo_skill")[0] ?? NaN;
    const r = s.reactions.filter((x) => x.operator === Z && x.frame === c + 24);
    expect(r.map((x) => [x.kind, "level" in x ? x.level : "stacks" in x ? x.stacks : null])).toEqual([["consumed", 1], ["reaction", 1]]);
    expect(hitsOf(s, "combo_skill").map((h) => round(h.zones.scale))).toEqual([3.6]);
    const k = kitSkill("combo_skill")?.hits[0];
    expect(k?.energy).toEqual({ sum: ["usp", { product: ["usp_extra", { consumed: true }] }] });
  });

  it("forced on an Electrified enemy: the level is stacks + 1 (at most 4)", () => {
    const level = kitSkill("combo_skill")?.hits[0]?.applies?.find((a) => a.kind === "forcedReaction");
    expect(level).toEqual({ kind: "forcedReaction", status: "electrification", level: { if: { consumedAtLeast: 1 }, then: { min: [4, { sum: [{ consumed: true }, { if: { enemyStatus: "electrification" }, then: 1, else: 0 }] }] }, else: 0 } });
  });

  it("the battle skill consumes it: min(level + 1, 3) Sunderblades (no free one), + atk_up_per_conduct × level on every strike", () => {
    const s = run(sc(), rotation(1));
    const strikes = perCast(s, "normal_skill")[0] ?? [];
    expect(strikes.map((h) => round(h.zones.scale))).toEqual([round(BS.scale + BS.perLevel), round((BS.scale + BS.perLevel) * BS.final)]);
    expect(s.reactions.some((x) => x.operator === Z && x.kind === "statusConsumed" && x.frame === (castsOf(s, "normal_skill")[0] ?? NaN) + 6)).toBe(true);
  });

  it("P3: atb_return (10 SP) back after a consumption", () => {
    const sp = (p: number) => {
      const c = castsOf(run(sc({ potential: p }), rotation(1)), "normal_skill")[0] ?? NaN;
      return run(sc({ potential: p }), rotation(1), c + 10).sp;
    };
    expect(round(sp(3) - sp(2))).toBe(10);
  });
});

describe("Zhuang Fangyi: ultimate (Empyrean of Truth)", () => {
  const full = (b: Partial<Build> = {}) => solo(b, { startEnergy: { [Z]: 1000 } });
  const loop = [z("ultimate_skill"), z("normal_skill_ult"), ...empChain, z("combo_skill_ult")];
  const s = run(full(), loop);
  const ult = castsOf(s, "ultimate_skill")[0] ?? NaN;

  it("the state starts at frame 78 for `duration` (25 s) and blocks energy; the Empyrean skills replace the battle skill and combo", () => {
    const st = run(full(), [z("ultimate_skill")], 100);
    const b = active(st, "empyrean")[0];
    expect([b?.appliedAt, b && b.expiresAt - b.appliedAt]).toEqual([78, 25 * 30]);
    expect(b?.attrs?.map((a) => [a.attr, a.value])).toBeDefined();
    const ctx = createContext(data, full());
    const inState = apply(ctx, init(ctx), z("ultimate_skill"));
    expect(() => apply(ctx, inState, z("normal_skill"))).toThrow(/isn't available/);
    // No energy in the state (strikes, team energy): 240 − 240 at P0.
    expect(s.energy[Z] ?? NaN).toBe(0);
  });

  it("the first battle skill in it is free (no SP spent) and makes 3 Sunderblades (4 with P1's unused one), then ult_free ends", () => {
    const c = s.casts.find((x) => x.skill === P + "normal_skill_ult");
    const before = run(full(), [z("ultimate_skill")], c?.frame ?? NaN).sp;
    expect(round(c?.spAfter ?? NaN)).toBe(round(before));
    expect(perCast(s, "normal_skill_ult")[0]?.length).toBe(3);
    expect(perCast(run(full({ potential: 1 }), loop.slice(0, 2)), "normal_skill_ult")[0]?.length).toBe(4);
    const at = (f: number) => active(run(full(), loop.slice(0, 2), (c?.frame ?? NaN) + f), "ult_free").length;
    expect([at(4), at(6)]).toEqual([1, 0]);
  });

  it("Empyrean strikes: N−1 at 27 + 6k, the last × final_rate at 6N + 26 with an Electric Infliction (the combo consumes it)", () => {
    const c = castsOf(s, "normal_skill_ult")[0] ?? NaN;
    const hs = perCast(s, "normal_skill_ult")[0] ?? [];
    expect(hs.map((h) => h.frame - c)).toEqual([27, 33, 44]);
    expect(hs.map((h) => round(h.zones.scale))).toEqual([BSU.scale, BSU.scale, round(BSU.scale * BS.final)]);
    const finals = kitSkill("normal_skill_ult")?.hits.filter((h) => h.id.startsWith("final_")) ?? [];
    expect(finals.map((h) => h.frames?.[0])).toEqual([32, 38, 44, 50, 56, 62, 68, 74, 80]);
    expect(finals.every((h) => JSON.stringify(h.applies) === JSON.stringify([{ kind: "infliction", element: "pulse" }]))).toBe(true);
  });

  it("its chain's Final Strike opens the combo; the combo's cooldown runs 5 times as fast in the state (attribute 93: 1 + combo_cd_rate 4, U4)", () => {
    const combo = castsOf(s, "combo_skill_ult")[0] ?? NaN;
    expect(combo).toBe((castsOf(s, "attack3_ult")[0] ?? NaN) + 33);
    expect(s.readyAt[P + "combo_skill_ult"]).toBe(combo + COMBO_CD / 5);
    // One cooldown for both (inheritOriginSkillCdProgress); outside the state at rate 1.
    expect(s.readyAt[P + "combo_skill"]).toBe(combo + COMBO_CD / 5);
  });

  it("the Empyrean combo: 5.4 × ATK, the consumption and the forced Electrification, no energy", () => {
    expect(hitsOf(s, "combo_skill_ult").map((h) => round(h.zones.scale))).toEqual([5.4]);
    const c = castsOf(s, "combo_skill_ult")[0] ?? NaN;
    expect(s.reactions.filter((r) => r.operator === Z && r.frame === c + 24).map((r) => [r.kind, "stacks" in r ? r.stacks : "level" in r ? r.level : null])).toEqual([["consumed", 1], ["reaction", 1]]);
    expect(kitSkill("combo_skill_ult")?.hits[0]?.energy).toBeUndefined();
  });

  it("at its end: the exit skill (followUpOnly, 20 frames) and the ultimate's cooldown set to 15 s", () => {
    const plain = run(full(), [z("ultimate_skill")]);
    const end = 78 + 25 * 30;
    expect(castsOf(plain, "ultimate_skill_end")).toEqual([end]);
    expect(plain.readyAt[P + "ultimate_skill"]).toBe(end + 15 * 30);
    expect(kitSkill("ultimate_skill_end")?.followUpOnly).toBe(true);
    expect(data.skills[P + "ultimate_skill_end"]?.timing?.exclusiveFrames).toBe(20);
    // A combo's slow-down in the state holds its timer (engine rule, in-game test 18): the end comes later than 25 s.
    expect((castsOf(s, "ultimate_skill_end")[0] ?? NaN) - ult).toBeGreaterThan(end);
  });

  it("P5: 15 Electric RES ignored in the state only", () => {
    const res = (p: number) => {
      const st = run(full({ potential: p }), [z("normal_skill"), z("ultimate_skill", 3), z("normal_skill_ult")]);
      return [round(hitsOf(st, "normal_skill")[0]?.zones.resistance ?? NaN), round(hitsOf(st, "normal_skill_ult")[0]?.zones.resistance ?? NaN)];
    };
    const [p4, p5] = [res(4), res(5)];
    expect(p5[0]).toBe(p4[0]);
    expect(round((p5[1] ?? NaN) - (p4[1] ?? NaN))).toBe(0.15);
  });
});

describe("Zhuang Fangyi: the example scenario (P5, Lone Barge)", () => {
  const s = run(example);

  it("Sunderblades 2, 3, then 6 (+3 free), 8 (+2 from the combo's level-1 Electrification), 9 (the cap: the oldest replaced)", () => {
    expect(perCast(s, "normal_skill").map((h) => h.length)).toEqual([2, 3]);
    expect(perCast(s, "normal_skill_ult").map((h) => h.length)).toEqual([6, 8, 9]);
  });

  it("three combos in one Empyrean (the 5× cooldown), each after an Empyrean Final Strike on the battle skill's Electric Infliction", () => {
    expect(castsOf(s, "combo_skill_ult").length).toBe(3);
    expect(castsOf(s, "ultimate_skill_end").length).toBe(1);
  });
});

describe("Zhuang Fangyi: talents and potentials", () => {
  it("talent 1: Electric Amp base_rate from frame 6, + enhance_rate per strike before its damage, reset by the next cast (U5, in-game test 89)", () => {
    const amps = (talents: [number, number]) => perCast(run(solo({ talents }), [0, 5, 10].map((t) => z("normal_skill", t))), "normal_skill").map((hs) => hs.map((h) => round(h.zones.amp)));
    expect(amps([2, 2])).toEqual([[1.2], [1.2, 1.22], [1.2, 1.22, 1.24]]);
    expect(amps([1, 2])).toEqual([[1.1], [1.1, 1.11], [1.1, 1.11, 1.12]]);
    expect(amps([0, 2])).toEqual([[1], [1, 1], [1, 1, 1]]);
  });

  it("P2: Battle Skill DMG +15% on the strikes (stat panel)", () => {
    const hit = (p: number) => hitsOf(run(solo({ potential: p }), [z("normal_skill")]), "normal_skill")[0];
    expect(from(hit(2), "NormalSkillDamageIncrease").map(round)).toEqual([0.15]);
    expect(from(hit(1), "NormalSkillDamageIncrease")).toEqual([]);
  });
});

describe("Lone Barge (wpn_funnel_0015)", () => {
  const lone = { weapon: weapon("wpn_funnel_0015") };

  it("after an ultimate cast: Battle Skill Electric DMG + pulse_dmg_up3 for duration2 (25 s from the cast)", () => {
    const st = run(solo(lone, { startEnergy: { [Z]: 1000 } }), [z("ultimate_skill"), z("normal_skill_ult"), ...empChain], 200);
    const b = active(st, "wpn_funnel_0015.ultimate")[0];
    expect([b?.appliedAt, b && b.expiresAt - b.appliedAt]).toEqual([0, 25 * 30]);
    expect(from(hitsOf(st, "normal_skill_ult")[0], "Lone Barge").map(round)).toEqual([1.12]);
    expect(from(hitsOf(st, "attack1_ult")[0], "Lone Barge")).toEqual([]);
    // The exit skill at the state's end (skill type 3, kind basic in the kit) isn't an ultimate cast: no new buff then.
    const after = run(solo(lone, { startEnergy: { [Z]: 1000 } }), [z("ultimate_skill")], 78 + 25 * 30 + 30);
    expect(castsOf(after, "ultimate_skill_end").length).toBe(1);
    expect(active(after, "wpn_funnel_0015.ultimate")).toEqual([]);
  });

  it("a battle skill consuming a reaction: + pulse_dmg_up2 per layer (2 at most, 20 s each), on that cast's strikes too", () => {
    const s = run(withTeam(lone, [json("perlica-p5.json")], { startEnergy: {} }), [act(PERLICA)("normal_skill"), ...chain, z("combo_skill"), z("normal_skill")]);
    const strikes = perCast(s, "normal_skill")[0] ?? [];
    expect(strikes.length).toBe(2);
    for (const h of strikes) expect(from(h, "Lone Barge").map(round)).toEqual([0.56]);
    // Her own battle skill without a consumption: nothing.
    expect(from(hitsOf(run(solo(lone), [z("normal_skill")]), "normal_skill")[0], "Lone Barge")).toEqual([]);
  });
});

describe("Flickers in the Mist (wpn_funnel_0017)", () => {
  const flickers = { weapon: weapon("wpn_funnel_0017") };

  it("on her: one layer per battle skill (talent 1's Amp), none per strike (the growth isn't a gained Amp)", () => {
    const s = run(solo(flickers), [z("normal_skill", 0), z("normal_skill", 5)], 10 * 30);
    expect(active(s, "wpn_funnel_0017.layer").length).toBe(2);
    expect(from(perCast(s, "normal_skill")[1]?.at(-1), "Flickers in the Mist").map(round)).toEqual([0.154, 0.154]);
    // Without talent 1: no Amp, no layer.
    expect(active(run(solo({ ...flickers, talents: [0, 2] }), [z("normal_skill")], 60), "wpn_funnel_0017.layer").length).toBe(0);
  });

  it("an Electric Amp from a teammate counts (Antal's ultimate)", () => {
    const sc = withTeam({ ...flickers, talents: [0, 2] }, [json("antal-p5-roc.json")], { startEnergy: { [ANTAL]: 1000 } });
    const s = run(sc, [act(ANTAL)("ultimate_skill")], 5 * 30);
    expect(active(s, "wpn_funnel_0017.layer").length).toBe(1);
  });
});

describe("Junction Point (wpn_funnel_0018) on Arcane", () => {
  const sc = { ...arcaneSolo, team: [...arcaneSolo.team.map((m) => (m.operator === ARCANE ? { ...m, weapon: weapon("wpn_funnel_0018") } : m)), json("laevatain-forgeborn.json")] };
  const s = run(sc, sc.rotation.slice(0, 2), 3 * 30);

  it("her combo's Susceptibility and Inflictions: ATK + atk_up for her, + atk_up2 for the others, in layers (2 at most)", () => {
    const own = active(s, "wpn_funnel_0018.atk", ARCANE);
    expect(own.length).toBe(2);
    expect(own[0]?.modifiers.map((m) => round(m.value))).toEqual([0.168]);
    const team = active(s, "wpn_funnel_0018.team_atk", ARCANE);
    expect(team[0]?.modifiers.map((m) => round(m.value))).toEqual([0.042]);
    expect(team[0]?.recipients).toEqual([L]);
  });
});

describe("Suffering's End (wpn_funnel_0020) on Arcane", () => {
  const sc = { ...arcaneSolo, team: arcaneSolo.team.map((m) => (m.operator === ARCANE ? { ...m, weapon: weapon("wpn_funnel_0020") } : m)) };
  const s = run(sc, sc.rotation, 10 * 30);

  it("each Arts Burst she applies: Nature DMG + nature_dmg_up for duration, a layer each; the extra only at 4", () => {
    const bursts = s.reactions.filter((r) => r.operator === ARCANE && r.kind === "burst").map((r) => r.frame);
    expect(bursts.length).toBe(3);
    expect(active(s, "wpn_funnel_0020.layer", ARCANE).map((b) => b.appliedAt)).toEqual(bursts);
    expect(active(s, "wpn_funnel_0020.max", ARCANE)).toEqual([]);
  });
});
