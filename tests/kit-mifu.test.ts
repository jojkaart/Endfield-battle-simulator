// Mi Fu's kit (chr_0031_mifu) and her equipment kits (wpn_claym_0017 Amaranthine Tassel; wpn_claym_0019 Long Heritage,
// tested on Si, its natural wielder): the mechanics the kit plan (docs/kit-batches/batch-4/chr_0031_mifu.md, § Kit plan
// and § Kit) says must fire, on the example scenario's builds. No log has her or either weapon: the expected values are
// the data's (SkillPatchTable at skill level 12, weapon skill level 9; PotentialTalentEffectTable).
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, earliestStart, init, skillParam, skillValue, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const M = "chr_0031_mifu";
const P = M + "_";
const D = "chr_0018_dapan";
const S = "chr_0036_jsspsi";
const example = readScenario(new URL("../examples/mifu-dapan.scenario.json", import.meta.url).pathname);
const siExample = readScenario(new URL("../examples/si-laevatain.scenario.json", import.meta.url).pathname);
const mifu = example.team.find((m) => m.operator === M) as Build;
const dapan = example.team.find((m) => m.operator === D) as Build;
const HERITAGE = { id: "wpn_claym_0019", level: 90, skillLevels: [9, 9, 9] };

/** A rotation step of Mi Fu's; `at` in frames. */
const op = (skill: string, at?: number): RotationAction => ({ operator: M, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const dp = (skill: string): RotationAction => ({ operator: D, skill: `${D}_${skill}` });
/** Da Pan's battle skill and ultimate: 3 Vulnerable stacks at the ultimate's cast (frame 43), 4 at its dunk. */
const stacks = [dp("normal_skill"), dp("ultimate_skill")];

/** The example's team (Mi Fu first, so controlled) with Mi Fu changed; or Mi Fu alone. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}, solo = false): TimelineScenario => ({
  ...example,
  team: solo ? [{ ...mifu, ...b }] : [{ ...mifu, ...b }, dapan],
  durationFrames: 40 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const castsOf = (s: TimelineState, skill: string, who = M) => s.casts.filter((c) => c.operator === who && c.skill === (skill.startsWith("chr_") ? skill : P + skill)).map((c) => c.frame);
const castAt = (s: TimelineState, skill: string, n = 0) => castsOf(s, skill)[n] ?? NaN;
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === P + skill && (hit === undefined || h.hitId === hit));
const buffs = (s: TimelineState, id: string) => s.buffs.filter((b) => b.id === id);
const spans = (s: TimelineState, id: string) => buffs(s, id).map((b) => [b.appliedAt, b.expiresAt]);
const fromSource = (h: LandedHit | undefined, text: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(text)).map((m) => m.value);
/** Whether one of the kit's buffs is active at frame f of the rotation's run. */
const activeAt = (sc: TimelineScenario, rotation: readonly RotationAction[], id: string, f: number) => run(sc, rotation, f).buffs.some((b) => b.id === id && b.appliedAt <= f && b.expiresAt > f);
/** A hit's whole multiplier (its scale parts' product). */
const multiplier = (h: LandedHit | undefined) => (h?.scaleParts ?? []).reduce((a, p) => a * p.value, h ? 1 : NaN);
const crushes = (s: TimelineState) => s.reactions.flatMap((r) => (r.kind === "physical" && r.status === "crush" ? [{ frame: r.frame, level: r.level }] : []));
const bb = (skill: string, level = 12) => data.skills[skill]?.levels[level - 1]?.blackboard ?? {};
/** A skill value after potentials (the build's panel), as hits read it. */
const skillValueAt = (potential: number, skill: string, key: string) => {
  const b = { ...mifu, potential };
  return skillValue(data, computeStats(data, b), b, P + skill, key);
};
const kitSkill = (skill: string) => data.kits.operators[M]?.skills.find((k) => k.skillId === P + skill);

/** Combo at 3 stacks (Da Pan's ultimate), then Trail and Mangle (Crush of 3+), then World Splitter. */
const splitterRun = (b: Partial<Build> = {}, until = 400) => run(scenario(b), [...stacks, op("combo_skill"), op("normalskill_2"), op("normalskill_3")], until);

describe("Mi Fu's basic attacks, finisher and dive", () => {
  it("hits at 9 / 9, 16 / 10, 16, 30 / 7, 30; the Final Strike (f30) has poise 25 (controlled only) and 28 SP", () => {
    const s = run(scenario({}, {}, true), ["attack1", "attack2", "attack3", "attack4"].map((x) => op(x)), 300);
    const rel = (skill: string) => hitsOf(s, skill).map((h) => h.frame - castAt(s, skill));
    expect(["attack1", "attack2", "attack3", "attack4"].map(rel)).toEqual([[9], [9, 16], [10, 16, 30], [7, 30]]);
    const a4 = kitSkill("attack4")?.hits ?? [];
    expect(a4.map((h) => [h.finalStrike === true, h.poise, h.poiseControlledOnly === true])).toEqual([[false, undefined, false], [true, "poise", true]]);
    expect([bb(P + "attack4")["poise"], bb(P + "attack4")["atb"]]).toEqual([25, 28]);
  });

  it("the finisher: atk_scale 9.0 × 0.3 / 0.2 / 0.5 at 6, 17, 37, one hit per landing; the dive attack's 1.8 at 2 is a dive", () => {
    expect(kitSkill("powerattack")?.hits.map((h) => [h.frames, h.factor])).toEqual([[[6], 0.3], [[17], 0.2], [[37], 0.5]]);
    expect(bb(P + "powerattack")["atk_scale"]).toBe(9);
    const dive = kitSkill("plunging_attack_end")?.hits[0];
    expect([dive?.frames, dive?.dive]).toEqual([[2], true]);
  });
});

describe("Mi Fu's battle skill states", () => {
  it("Cloudtrapper: 100 SP with 50 returned at the cast, its hit at 7 (1.5 × 1.1 at P5), and Trail and Mangle's state for 15 s", () => {
    const s = run(scenario({}, {}, true), [op("normalskill_1")], 30);
    expect(s.spReturned).toBeCloseTo(50, 6);
    expect(hitsOf(s, "normalskill_1").map((h) => [h.frame, h.scaleParts[0]?.value])).toEqual([[7, expect.closeTo(1.65, 5)]]);
    expect(spans(s, "trail_ready")).toEqual([[0, 15 * 30]]);
  });

  it("only one move is castable at a time: Cloudtrapper without a state, Trail and Mangle in its state, World Splitter in its own", () => {
    const sc = scenario({}, {}, true);
    const ctx = createContext(data, sc);
    const s0 = init(ctx);
    expect(earliestStart(ctx, s0, op("normalskill_1"))).toMatchObject({ frame: 0 });
    expect("error" in earliestStart(ctx, s0, op("normalskill_2"))).toBe(true);
    expect("error" in earliestStart(ctx, s0, op("normalskill_3"))).toBe(true);
    const s1 = advance(ctx, apply(ctx, s0, op("normalskill_1")), 120);
    expect("error" in earliestStart(ctx, s1, op("normalskill_1"))).toBe(true);
    expect("error" in earliestStart(ctx, s1, op("normalskill_3"))).toBe(true);
    expect(earliestStart(ctx, s1, op("normalskill_2"))).toMatchObject({ frame: 120 });
  });

  it("E1, S9b: on Rhodagn (super armor 30) Cloudtrapper takes the heavy path, so Trail and Mangle waits for window 115 (real frame 17); on a light enemy the pull path's window 11", () => {
    expect(data.enemies["eny_0051_rodin"]?.superArmor?.initial).toBe(30);
    const heavy = run(scenario({}, {}, true), [op("normalskill_1"), op("normalskill_2")], 60);
    expect(castAt(heavy, "normalskill_2")).toBe(17);
    const light = scenario({}, { target: { enemy: "eny_0099_slimeml2", level: 1 } }, true);
    expect(data.enemies["eny_0099_slimeml2"]?.superArmor?.initial).toBe(5);
    expect(castAt(run(light, [op("normalskill_1"), op("normalskill_2")], 60), "normalskill_2")).toBe(11);
  });

  it("Trail and Mangle: 0.61 × 1.1 at 3 and 10, then at 24 the Crush and 0.79 × 1.1 with 5 Stagger; the state ends at 24 and team energy comes at 24", () => {
    const s = run(scenario({}, { startEnergy: {} }, true), [op("normalskill_1"), op("normalskill_2")], 17 + 30);
    const t = castAt(s, "normalskill_2");
    expect(hitsOf(s, "normalskill_2").map((h) => [h.hitId, h.frame - t, h.scaleParts[0]?.value])).toEqual([
      ["flurry", 3, expect.closeTo(0.671, 5)], ["flurry", 10, expect.closeTo(0.671, 5)], ["mangle", 24, expect.closeTo(0.869, 5)],
    ]);
    // No Vulnerable on a fresh enemy: the Crush only adds a stack (no crush event), and World Splitter's state doesn't come.
    expect(crushes(s)).toEqual([]);
    expect(s.enemy.vulnerable?.stacks).toBe(1);
    const rot = [op("normalskill_1"), op("normalskill_2")];
    const sc = scenario({}, { startEnergy: {} }, true);
    expect([activeAt(sc, rot, "trail_ready", t + 23), activeAt(sc, rot, "trail_ready", t + 24)]).toEqual([true, false]);
    expect(buffs(s, "splitter_ready")).toEqual([]);
    // Its team energy (50 natural SP × 0.065) at 24, on a cast paid with natural SP (after the combo; after Cloudtrapper its returned 50 pays).
    const nat = [...stacks, op("combo_skill"), op("normalskill_2")];
    const empty = scenario({}, { startEnergy: { [D]: "full" } });
    const tn = castAt(run(empty, nat, 200), "normalskill_2");
    expect((run(empty, nat, tn + 24).energy[M] ?? 0) - (run(empty, nat, tn + 23).energy[M] ?? 0)).toBeCloseTo(50 * 0.065, 6);
  });

  it("with 3+ Vulnerable stacks Trail and Mangle's Crush (level 3) gives World Splitter's state, which ends Trail and Mangle's", () => {
    const rot = [...stacks, op("combo_skill"), op("normalskill_2")];
    const s = run(scenario(), rot, 200);
    const t = castAt(s, "normalskill_2");
    expect(crushes(s)).toEqual([{ frame: t + 24, level: 3 }]);
    expect(hitsOf(s, "normalskill_2").map((h) => h.hitId)).toEqual(["flurry", "flurry", "mangle_splitter"]);
    expect(spans(s, "splitter_ready")).toEqual([[t + 24, t + 24 + 15 * 30]]);
    expect(buffs(s, "trail_ready")).toEqual([]);
    expect(activeAt(scenario(), rot, "trail_ready", t + 23)).toBe(true);
  });

  it("World Splitter: 10 Stagger in two poise-only landings at 23 and 25, its hit at 26 (6.0 × 1.1 × yuanshi_multi 1 × talent 1's 1.2), the state ends at 21", () => {
    const s = splitterRun({}, 400);
    const w = castAt(s, "normalskill_3");
    expect(hitsOf(s, "normalskill_3").map((h) => [h.hitId, h.frame - w])).toEqual([["split", 26]]);
    const split = hitsOf(s, "normalskill_3", "split")[0];
    expect(split?.scaleParts.map((p) => p.value)).toEqual([expect.closeTo(6.6, 5), 1, expect.closeTo(1.2, 6)]);
    const rot = [...stacks, op("combo_skill"), op("normalskill_2"), op("normalskill_3")];
    expect([activeAt(scenario(), rot, "splitter_ready", w + 20), activeAt(scenario(), rot, "splitter_ready", w + 21)]).toEqual([true, false]);
    expect([bb(P + "normalskill_3")["poise"], kitSkill("normalskill_3")?.hits[0]?.frames]).toEqual([5, [23, 25]]);
    const at = (f: number) => run(scenario(), [...stacks, op("combo_skill"), op("normalskill_2"), op("normalskill_3")], f).stagger.poise;
    expect([at(w + 22) - at(w + 23), at(w + 24) - at(w + 25), at(w + 25) - at(w + 26)]).toEqual([5, 5, 0]);
  });

  it("D5: World Splitter's hit takes no Battle Skill DMG bonus (it's Crush DMG); the battle skills' hits do", () => {
    const s = splitterRun({}, 400);
    const split = hitsOf(s, "normalskill_3", "split")[0];
    const mangle = hitsOf(s, "normalskill_2", "mangle_splitter")[0];
    expect(split?.modifiers.some((m) => m.skillType === "battle")).toBe(false);
    expect(mangle?.modifiers.some((m) => m.skillType === "battle")).toBe(true);
    expect(split?.zones.damageBonus).toBeLessThan(mangle?.zones.damageBonus ?? 0);
  });

  it("talent 1 needs Physical Susceptibility or a Stagger: without her combo's Susceptibility ×1; at talent level 1 ×1.1; unlearned ×1", () => {
    // Without the combo: Cloudtrapper gives Trail and Mangle's state; its Crush on 3+ stacks gives World Splitter's.
    const noSusc = run(scenario(), [...stacks, op("normalskill_1"), op("normalskill_2"), op("normalskill_3")], 500);
    expect(multiplier(hitsOf(noSusc, "normalskill_3", "split")[0])).toBeCloseTo(6.6, 5);
    expect(multiplier(splitterRun({ talents: [1, 2] }).hits.find((h) => h.hitId === "split"))).toBeCloseTo(6.6 * 1.1, 5);
    expect(multiplier(splitterRun({ talents: [0, 2] }).hits.find((h) => h.hitId === "split"))).toBeCloseTo(6.6, 5);
  });

  it("the combo and the ultimate give Trail and Mangle's state (at 27 and 102), which ends World Splitter's", () => {
    const rot = [...stacks, op("combo_skill"), op("normalskill_2"), op("ultimate_skill")];
    const s = run(scenario(), rot, 600);
    const c = castAt(s, "combo_skill");
    const u = castAt(s, "ultimate_skill");
    expect([activeAt(scenario(), rot.slice(0, 3), "trail_ready", c + 26), activeAt(scenario(), rot.slice(0, 3), "trail_ready", c + 27)]).toEqual([false, true]);
    expect([activeAt(scenario(), rot, "splitter_ready", u + 101), activeAt(scenario(), rot, "splitter_ready", u + 102)]).toEqual([true, false]);
    expect(spans(s, "trail_ready")).toEqual([[u + 102, u + 102 + 15 * 30]]);
  });

  it("the finisher pauses the active state for its 38 frames", () => {
    const sc = scenario({}, {}, true);
    const ctx = createContext(data, sc);
    let s = advance(ctx, apply(ctx, init(ctx), op("normalskill_1")), 150);
    s = { ...s, stagger: { poise: 0, until: 2000, finisherUsed: false } };
    s = advance(ctx, apply(ctx, s, op("powerattack")), 300);
    expect(castsOf(s, "powerattack")).toEqual([150]);
    expect(spans(s, "trail_ready")).toEqual([[0, 15 * 30 + 38]]);
  });
});

describe("Mi Fu's combo", () => {
  it("its window opens when an enemy reaches 3 Vulnerable stacks (Da Pan's ultimate), not at 2", () => {
    const sc = scenario();
    const ctx = createContext(data, sc);
    const two = advance(ctx, apply(ctx, init(ctx), dp("normal_skill")), 50);
    expect(two.enemy.vulnerable?.stacks).toBe(2);
    expect("error" in earliestStart(ctx, two, op("combo_skill"))).toBe(true);
    const s = run(sc, stacks, 100);
    expect(s.comboWindow[M]?.from).toBe(castsOf(s, `${D}_ultimate_skill`, D)[0]);
  });

  it("hits at 8, 10 (0.68) and 31 (1.15, 10 Stagger, 10 energy); at P1+ 10% Physical Susceptibility for 20 s from 31, already on that hit; 19 s cooldown, 17 s at P1", () => {
    const s = run(scenario({}, { startEnergy: { [D]: "full" } }), [...stacks, op("combo_skill")], 200);
    const c = castAt(s, "combo_skill");
    expect(hitsOf(s, "combo_skill").map((h) => [h.hitId, h.frame - c])).toEqual([["hit", 8], ["hit", 10], ["uppercut", 31]]);
    expect(spans(s, "combo_susceptibility")).toEqual([[c + 31, c + 31 + 20 * 30]]);
    expect(buffs(s, "combo_susceptibility")[0]?.modifiers.map((m) => [m.zone, m.element, m.value])).toEqual([["susceptibility", "physical", expect.closeTo(0.1, 6)]]);
    expect(fromSource(hitsOf(s, "combo_skill", "uppercut")[0], "Combo: Physical Susceptibility")).toEqual([expect.closeTo(0.1, 6)]);
    expect(fromSource(hitsOf(s, "combo_skill", "hit")[1], "Combo: Physical Susceptibility")).toEqual([]);
    const e = (f: number) => run(scenario({}, { startEnergy: { [D]: "full" } }), [...stacks, op("combo_skill")], f).energy[M] ?? 0;
    expect(e(c + 31) - e(c + 30)).toBeCloseTo(10, 6);
    const p0 = run(scenario({ potential: 0 }), [...stacks, op("combo_skill")], 200);
    const c0 = castAt(p0, "combo_skill");
    expect(spans(p0, "combo_susceptibility")).toEqual([[c0 + 31, c0 + 31 + 16 * 30]]);
    expect(buffs(p0, "combo_susceptibility")[0]?.modifiers[0]?.value).toBeCloseTo(0.05, 6);
    expect(data.skills[P + "combo_skill"]?.levels[11]?.coolDown).toBe(19);
    const cd = (potential: number) => skillParam(computeStats(data, { ...mifu, potential }), P + "combo_skill", "cooldown", 19);
    expect([cd(0), cd(1)]).toEqual([19, 17]);
  });

  it("P3: ATK +6% for 20 s at the combo's cast with talent 2's shield, once per 45 s; not below P3 or without talent 2", () => {
    const s = run(scenario(), [...stacks, op("combo_skill")], 100);
    const c = castAt(s, "combo_skill");
    expect(spans(s, "p3_atk")).toEqual([[c, c + 20 * 30]]);
    expect(buffs(s, "p3_atk")[0]?.modifiers.map((m) => [m.zone, m.value])).toEqual([["atk", expect.closeTo(0.06, 6)]]);
    expect(run(scenario({ potential: 2 }), [...stacks, op("combo_skill")], 100).buffs.some((b) => b.id === "p3_atk")).toBe(false);
    expect(run(scenario({ talents: [2, 0] }), [...stacks, op("combo_skill")], 100).buffs.some((b) => b.id === "p3_atk")).toBe(false);
    const trig = data.kits.operators[M]?.triggers.find((t) => t.id === "p3_shield_atk");
    expect(trig?.cooldown).toBe("talent_shield_cd");
    expect([skillValueAt(2, "combo_skill", "talent_shield_cd"), skillValueAt(3, "combo_skill", "talent_shield_cd")]).toEqual([60, 45]);
  });
});

describe("Mi Fu's ultimate", () => {
  it("cost 80 × 0.85 at P4+; a forced Lift and 2.03 at 75, 4.97 with 25 Stagger (P5) at 102", () => {
    const cost = (potential: number) => skillParam(computeStats(data, { ...mifu, potential }), P + "ultimate_skill", "cost", 80);
    expect([cost(3), cost(4)]).toEqual([80, expect.closeTo(68, 4)]);
    expect([bb(P + "ultimate_skill")["poise2"], skillValueAt(5, "ultimate_skill", "poise2")]).toEqual([20, 25]);
    const s = run(scenario({}, {}, true), [op("ultimate_skill")], 200);
    const u = castAt(s, "ultimate_skill");
    expect(hitsOf(s, "ultimate_skill").map((h) => [h.hitId, h.frame - u, h.scaleParts[0]?.value])).toEqual([
      ["lift", 75, expect.closeTo(2.03, 5)], ["slam", 102, expect.closeTo(4.97, 5)],
    ]);
    expect(s.reactions.flatMap((r) => (r.kind === "physical" ? [[r.frame - u, r.status, r.forced]] : []))).toEqual([[75, "lift", true]]);
    expect(data.kits.operators[M]?.skills.find((k) => k.skillId === P + "ultimate_skill")?.hits.map((h) => h.poise)).toEqual([undefined, "poise2"]);
  });
});

describe("Amaranthine Tassel (wpn_claym_0017)", () => {
  const W = bb("sk_wpn_claym_0017", 9);
  it("level 9 values: Arts Intensity 84 for 20 s; Physical DMG 0.252 + 0.084 × stacks for 30 s", () => {
    expect([W["phy_spell_up"], W["duration"], W["phy_dmg_up2"], W["atk_up_mult"], W["duration2"]].map((v) => Math.round((v ?? NaN) * 1000) / 1000)).toEqual([84, 20, 0.252, 0.084, 30]);
  });

  it("the wielder's Physical Susceptibility (her combo) gives Arts Intensity +84 for 20 s at its frame 31", () => {
    const s = run(scenario(), [...stacks, op("combo_skill")], 200);
    const c = castAt(s, "combo_skill");
    expect(spans(s, "wpn_claym_0017.arts_intensity")).toEqual([[c + 31, c + 31 + 20 * 30]]);
    expect(buffs(s, "wpn_claym_0017.arts_intensity")[0]?.modifiers.map((m) => [m.zone, m.value])).toEqual([["artsIntensity", expect.closeTo(84, 4)]]);
  });

  it("a Crush that consumes 3 stacks gives Physical DMG +0.504 for 30 s, already on the Crush's damage and its hit", () => {
    const s = splitterRun({}, 200);
    const t = castAt(s, "normalskill_2") + 24;
    expect(spans(s, "wpn_claym_0017.phys")).toEqual([[t, t + 30 * 30]]);
    expect(fromSource(hitsOf(s, "normalskill_2", "mangle_splitter")[0], "Amaranthine Cleave: Physical DMG")).toEqual([expect.closeTo(0.504, 6)]);
    const crushHit = s.hits.find((h) => h.frame === t && h.skillId.startsWith("reaction:crush"));
    expect(fromSource(crushHit, "Amaranthine Cleave: Physical DMG")).toEqual([expect.closeTo(0.504, 6)]);
  });

  it("a Crush on an enemy without Vulnerable (it only adds a stack) gives nothing; Cloudtrapper's Susceptibility-free path gives no Arts Intensity", () => {
    const s = run(scenario({}, {}, true), [op("normalskill_1"), op("normalskill_2")], 100);
    expect(buffs(s, "wpn_claym_0017.phys")).toEqual([]);
    expect(buffs(s, "wpn_claym_0017.arts_intensity")).toEqual([]);
  });

  it("the tag 1066759270 trigger is the Physical Susceptibility category filter", () => {
    const t = data.kits.equipment["wpn_claym_0017"]?.triggers.find((x) => x.id === "wpn_claym_0017.on_susceptibility");
    expect(t?.on).toEqual({ event: "buffApplied", categories: ["susceptibility"], elements: ["physical"] });
  });
});

describe("Long Heritage (wpn_claym_0019) on Si", () => {
  const W = bb("sk_wpn_claym_0019", 9);
  const si = siExample.team.find((m) => m.operator === S) as Build;
  const siSc = (solo = false): TimelineScenario => ({
    ...siExample,
    team: siExample.team.filter((m) => !solo || m.operator === S).map((m) => (m.operator === S ? { ...si, weapon: HERITAGE } : m)),
    durationFrames: 20 * 30,
  });
  const siOp = (skill: string): RotationAction => ({ operator: S, skill: `${S}_${skill}` });

  it("level 9 values: Cryo DMG 0.168 and team Arts DMG 0.112, both 20 s", () => {
    expect([W["cryst_dmg_up"], W["spell_dmg_up"], W["duration"], W["duration2"]].map((v) => Math.round((v ?? NaN) * 1000) / 1000)).toEqual([0.168, 0.112, 20, 20]);
  });

  it("her battle skill's Cryo Infliction gives her Cryo DMG +0.168 for 20 s, already on the inflicting hit", () => {
    const s = run(siSc(), [siOp("normal_skill")], 60);
    const hit = s.hits.find((h) => h.skillId === `${S}_normal_skill`);
    expect(hit).toBeDefined();
    const at = hit?.frame ?? NaN;
    expect(spans(s, "wpn_claym_0019.cryo")).toEqual([[at, at + 20 * 30]]);
    expect(buffs(s, "wpn_claym_0019.cryo")[0]?.target).toBe("self");
    expect(fromSource(hit, "Secret History: Cryo DMG")).toEqual([expect.closeTo(0.168, 6)]);
  });

  it("her ultimate's team Cryo and Heat Amp reaching Laevatain gives the team Arts DMG +0.112 for 20 s (test 92's reading); alone, it reaches no one else: nothing", () => {
    const s = run(siSc(), [siOp("ultimate_skill")], 200);
    const team = buffs(s, "wpn_claym_0019.team_arts");
    expect(team.map((b) => b.target)).toEqual(["team"]);
    const amp = buffs(s, "ultimate_amp")[0];
    expect(team[0]?.appliedAt).toBe(amp?.appliedAt);
    expect(team[0]?.modifiers.map((m) => [m.zone, m.element, m.value])).toEqual(["fire", "pulse", "cryst", "natural"].map((e) => ["damageBonus", e, expect.closeTo(0.112, 6)]));
    const solo = run(siSc(true), [siOp("ultimate_skill")], 200);
    expect(buffs(solo, "ultimate_amp")).toHaveLength(1);
    expect(buffs(solo, "wpn_claym_0019.team_arts")).toEqual([]);
  });

  it("on Mi Fu (no infliction, no Amp) neither effect fires", () => {
    const s = run(scenario({ weapon: HERITAGE }), [...stacks, op("combo_skill"), op("normalskill_2"), op("normalskill_3"), op("ultimate_skill")], 900);
    expect(s.buffs.filter((b) => b.id.startsWith("wpn_claym_0019"))).toEqual([]);
  });
});
