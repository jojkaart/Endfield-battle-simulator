// Pogranichnik's kit (chr_0029_pograni) and the batch-4 sword kits he owns (wpn_sword_0012 Thermite Cutter,
// wpn_sword_0016 Never Rest, wpn_sword_0017 Glorious Memory, wpn_sword_0021 Grand Vision and its _ink skin,
// wpn_sword_0024 Complexed Industry, wpn_sword_0026 Farsight): the mechanics the kit plan
// (docs/kit-batches/batch-4/chr_0029_pograni.md, § Kit plan and § Kit) says must fire, on the example's team
// (Pogranichnik P5 with Thermite Cutter, Chen Qianyu) and, for the weapons, with their natural wielders.
// fixtures/pending/zmdlogs-7e19489ae503.json checks his hits against a log (29 of 29 match: tests/logs.test.ts once it moves).
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, earliestStart, init, skillValue, type Build, type LandedHit, type RotationAction, type StatPanel, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readBuild, readScenario } from "@efsim/cli";

const data = loadGameData();
const O = "chr_0029_pograni";
const P = O + "_";
const C = "chr_0005_chen";
const D = "chr_0018_dapan";
const example = readScenario(new URL("../examples/pogranichnik-chen.scenario.json", import.meta.url).pathname);
const dapan: Build = {
  operator: D, level: 90, promotion: 4, potential: 5,
  skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 },
  weapon: { id: "wpn_claym_0014", level: 90, skillLevels: [9, 9, 9] }, gear: [],
};
/** A rotation step; `at` in frames. */
const step = (operator: string, skill: string, at?: number): RotationAction => ({ operator, skill: `${operator}_${skill}`, ...(at !== undefined ? { at } : {}) });
const o = (skill: string, at?: number) => step(O, skill, at);
const c = (skill: string, at?: number) => step(C, skill, at);
const d = (skill: string, at?: number) => step(D, skill, at);

/** The example's team (and Da Pan, P5 with Ancient Canal, for three and four stacks) with Pogranichnik's build changed; ultimates charged. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: [...example.team.map((m) => (m.operator === O ? { ...m, ...b } : m)), dapan],
  durationFrames: 40 * 30,
  startEnergy: { [O]: "full", [D]: "full" },
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === P + skill && (hit === undefined || h.hitId === hit));
const castAt = (s: TimelineState, skill: string, n = 0, op = O) => s.casts.filter((x) => x.skill === `${op}_${skill}`)[n]?.frame ?? NaN;
/** Frames of a skill's landings from its (first) cast, with their hit IDs. */
const relHits = (s: TimelineState, skill: string) => hitsOf(s, skill).map((h) => [h.frame - castAt(s, skill), h.hitId]);
/** The values of the modifiers on a hit from a source whose name contains `label`, optionally of one zone. */
const from = (h: LandedHit | undefined, label: string, zone?: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label) && (zone === undefined || m.zone === zone)).map((m) => m.value);
const value = (b: Partial<Build>, skill: string, key: string) => {
  const ctx = createContext(data, scenario(b));
  return skillValue(data, ctx.panels.get(O) as StatPanel, ctx.builds.get(O) as Build, P + skill, key);
};
const fired = (s: TimelineState, owner: string, trigger: string) => s.triggerState[`${owner}:${trigger}`]?.count ?? 0;
/** Frames the combo's world slow-down (its first 22 frames) adds to a buff applied before the combo. */
const HELD = 16;
const MORALE = "Fervent Morale (talents 1 and 2)";
const MORALE_TEAM = "Fervent Morale (talent 2) on the teammate";
const THERMITE = "Thermite Cutter";
/** Follow-up hits (harasses and the Decisive Assault) with their frames. */
/** The example's rotation up to his first chain (before Chen's second battle skill at 14 s). */
const opening = example.rotation.slice(0, 10);
const followUps = (s: TimelineState) => s.hits.filter((h) => h.skillId === P + "ultimate_skill" && h.hitId !== "hit").map((h) => [h.frame, h.hitId]);

// Vulnerable stacks before his Breach: one (Chen's battle skill), two (and her combo's Lift), three (Da Pan's battle skill at P5
// gives two, Chen's combo a third).
const stacks1 = [c("normal_skill")];
const stacks2 = [c("normal_skill"), c("combo_skill")];
const stacks3 = [d("normal_skill"), c("combo_skill")];

describe("Pogranichnik's skills", () => {
  it("basic attacks: 1 / 2 / 2 / 6 / 1 landings at their SkillData frames; attack 5 is the Final Strike (poise 18 and SP 20 only when controlled); attacks 1–4 grant no SP", () => {
    const s = run(scenario(), ["attack1", "attack2", "attack3", "attack4", "attack5"].map((x) => o(x)), 200);
    expect(["attack1", "attack2", "attack3", "attack4", "attack5"].map((x) => hitsOf(s, x).map((h) => h.frame - castAt(s, x)))).toEqual([[8], [7, 14], [9, 15], [3, 5, 7, 11, 13, 15], [16]]);
    expect(hitsOf(s, "attack1").map((h) => h.zones.scale)).toEqual([expect.closeTo(0.52, 6)]);
    const a5 = data.kits.operators[O]?.skills.find((k) => k.skillId === P + "attack5")?.hits[0];
    expect([a5?.poise, a5?.poiseControlledOnly, a5?.finalStrike]).toEqual(["poise", true, true]);
    expect([value({}, "attack5", "poise"), value({}, "attack5", "atb"), value({}, "attack1", "atb")]).toEqual([18, 20, 0]);
  });

  it("finisher: atk_scale (9.0) × 0.1, 0.1, 0.8 at 7, 14, 25; dive attack: one hit at 3 (castable with batch-1 S10)", () => {
    const kit = data.kits.operators[O];
    expect(kit?.skills.find((k) => k.skillId === P + "power_attack")?.hits.map((h) => [h.frames, h.factor])).toEqual([[[7, 14], 0.1], [[25], 0.8]]);
    expect(kit?.skills.find((k) => k.skillId === P + "plunging_attack_end")?.hits.map((h) => [h.frames, h.scale])).toEqual([[[3], ["atk_scale"]]]);
    expect(value({}, "power_attack", "atk_scale")).toBeCloseTo(9, 6);
  });

  it("battle skill: hits at 28 and 38 (atk_scale 1.92, atk_scale2 2.38); the second Breaches; team energy at 38", () => {
    const sc = scenario({}, { startEnergy: {} });
    const s = run(sc, [...stacks2, o("normal_skill")], 300);
    expect(relHits(s, "normal_skill")).toEqual([[28, "hit"], [38, "hit_2"]]);
    expect(hitsOf(s, "normal_skill").map((h) => h.zones.scale)).toEqual([expect.closeTo(1.92, 6), expect.closeTo(2.38, 6)]);
    const breach = s.reactions.filter((r) => r.kind === "physical" && r.status === "breach");
    expect(breach.map((r) => [r.frame - castAt(s, "normal_skill"), r.kind === "physical" ? r.level : NaN])).toEqual([[38, 2]]);
    const cast = castAt(s, "normal_skill");
    // Chen's skills already gave him some (spent SP); his own battle skill's share comes at 38.
    const energy = (f: number) => run(sc, [...stacks2, o("normal_skill")], cast + f).energy[O] ?? NaN;
    expect(energy(37)).toBeCloseTo(energy(30), 6);
    expect(energy(38)).toBeGreaterThan(energy(37));
  });

  it("battle-skill SP by the stacks its Breach consumed: atb1–atb4 = 5 / 15 / 25 / 35 (L12) at frame 38, none on an enemy without stacks (Vulnerable only, no Breach)", () => {
    // The battle skill pauses SP regeneration (1.5 s after spending), so the SP across frame 38 is its grant.
    const grant = (before: RotationAction[]) => {
      const cast = castAt(run(scenario(), [...before, o("normal_skill")], 400), "normal_skill");
      return run(scenario(), [...before, o("normal_skill")], cast + 38).sp - run(scenario(), [...before, o("normal_skill")], cast + 37).sp;
    };
    expect(grant([])).toBeCloseTo(0, 6);
    expect(grant(stacks1)).toBeCloseTo(5, 6);
    expect(grant(stacks2)).toBeCloseTo(15, 6);
    expect(grant(stacks3)).toBeCloseTo(25, 6);
    const fresh = run(scenario(), [o("normal_skill")], 100);
    expect(fresh.reactions.filter((r) => r.kind === "physical")).toEqual([]);
    expect(fresh.enemy.vulnerable?.stacks).toBe(1);
    expect(fresh.comboWindow[O]).toBeUndefined();
    expect([1, 2, 3, 4].map((n) => value({}, "normal_skill", `atb${n}`))).toEqual([5, 15, 25, 35]);
    expect([1, 2, 3, 4].map((n) => value({ skillLevels: { basic: 12, battle: 9, combo: 12, ultimate: 12 } }, "normal_skill", `atb${n}`))).toEqual([5, 10, 20, 30]);
  });

  it("combo: opened by anyone's Crush or Breach; slashes by the stacks it consumed: 1 → one, 2 → two, 3 → three (atk_scale3), 4 → three with atk_scale4", () => {
    const paths = [
      run(scenario(), [...stacks1, o("normal_skill"), o("combo_skill")], 400),
      run(scenario(), [...stacks2, o("normal_skill"), o("combo_skill")], 400),
      run(scenario(), [...stacks3, o("normal_skill"), o("combo_skill")], 500),
      // Da Pan: battle skill (2 stacks), ultimate (forced Lift and Knock Down: 4), combo (his Crush consumes all four).
      run(scenario(), [d("normal_skill"), d("ultimate_skill"), d("combo_skill"), o("combo_skill")], 600),
    ];
    expect(paths.map((s) => relHits(s, "combo_skill"))).toEqual([
      [[23, "hit"]],
      [[23, "hit"], [37, "hit_2"]],
      [[23, "hit"], [37, "hit_2"], [61, "hit_4"]],
      [[23, "hit"], [37, "hit_2"], [61, "hit_3"]],
    ]);
    expect(paths.map((s) => hitsOf(s, "combo_skill").map((h) => Number(h.zones.scale.toFixed(2))))).toEqual([[0.95], [0.95, 1.22], [0.95, 1.22, 1.49], [0.95, 1.22, 2.97]]);
    // The count buffs (game code's buff_…_combo_skill_count1–4) end at the cast; a window without a Crush or Breach never opens.
    expect(paths.every((s) => !s.buffs.some((b) => b.owner === O && b.id.startsWith("combo_count")))).toBe(true);
    const lift = run(scenario(), stacks2, 100);
    expect(lift.comboWindow[O]).toBeUndefined();
  });

  it("combo: usp 10 energy; SP atb_n × atb_ratio per slash (P5 1.2) into talent 1's bank; cooldown 17 s, 15 s at P5", () => {
    const s = run(scenario(), [...stacks2, o("normal_skill"), o("combo_skill")], 400);
    // Bank: the Breach's 15, then 5 × 1.2 and 7 × 1.2 from the slashes.
    expect(s.stacks[O]?.["sp_banked"]).toBeCloseTo(15 + 6 + 8.4, 4);
    const p4 = run(scenario({ potential: 4 }), [...stacks2, o("normal_skill"), o("combo_skill")], 400);
    expect(p4.stacks[O]?.["sp_banked"]).toBeCloseTo(15 + 5 + 7, 4);
    expect([value({}, "combo_skill", "atb_ratio"), value({ potential: 4 }, "combo_skill", "atb_ratio")]).toEqual([expect.closeTo(1.2, 6), 1]);
    const ready = (b: Partial<Build>) => {
      const st = run(scenario(b), [...stacks2, o("normal_skill"), o("combo_skill")], 300);
      return (st.readyAt[P + "combo_skill"] ?? NaN) - castAt(st, "combo_skill");
    };
    expect(ready({})).toBe(15 * 30);
    expect(ready({ potential: 4 })).toBe(17 * 30);
    const kit = data.kits.operators[O]?.skills.find((k) => k.skillId === P + "combo_skill");
    expect(kit?.hits[0]?.energy).toBe("usp");
    expect(value({}, "combo_skill", "usp")).toBe(10);
  });

  it("combo timing per path (S11): MarkCanInterrupt 80 / 280 / 450 and ends 191 / 391 / 545; attack 1 from the path's window (+72 / +72 / +46 / +32)", () => {
    const t = data.skills[P + "combo_skill"]?.timing;
    expect([t?.interruptibleFrom, t?.ends, t?.exclusiveFrames]).toEqual([[80, 280, 450], [191, 391, 545], 649]);
    const next = (before: RotationAction[], until: number) => {
      const s = run(scenario(), [...before, o("combo_skill"), o("attack1")], until);
      return castAt(s, "attack1") - castAt(s, "combo_skill");
    };
    expect(next([...stacks1, o("normal_skill")], 400)).toBe(32);
    expect(next([...stacks2, o("normal_skill")], 400)).toBe(46);
    expect(next([...stacks3, o("normal_skill")], 500)).toBe(72);
    expect(next([d("normal_skill"), d("ultimate_skill"), d("combo_skill")], 600)).toBe(72);
  });

  it("ultimate: the rush at 76 (atk_scale_rush 3.0, poise 10); the banner from frame 77 for 30 s with 5 Steel Oath points; cost 90 × P4 0.85", () => {
    const s = run(scenario(), [o("ultimate_skill")], 300);
    const cast = castAt(s, "ultimate_skill");
    expect(hitsOf(s, "ultimate_skill").map((h) => [h.hitId, h.zones.scale])).toEqual([["hit", expect.closeTo(3, 6)]]);
    expect(value({}, "ultimate_skill", "poise_rush")).toBe(10);
    const banner = s.buffs.find((b) => b.id === "banner");
    expect(banner && banner.expiresAt - banner.appliedAt).toBe(30 * 30);
    expect(s.stacks[O]?.["steel_oath"]).toBe(5);
    // Frame 77 of the cast, after the time stop: the state starts with the rush landed.
    expect((banner?.appliedAt ?? NaN) - (hitsOf(s, "ultimate_skill")[0]?.frame ?? NaN)).toBe(1);
    expect(run(scenario(), [o("ultimate_skill")], cast + 1).stacks[O]?.["steel_oath"] ?? 0).toBe(0);
    const cost = (b: Partial<Build>) => {
      const ctx = createContext(data, scenario(b, { startEnergy: {} }));
      const r = earliestStart(ctx, init(ctx), o("ultimate_skill"));
      return "error" in r ? Number(/needs ([\d.]+)/.exec(r.error)?.[1]) : NaN;
    };
    expect(cost({})).toBeCloseTo(76.5, 4);
    expect(cost({ potential: 3 })).toBeCloseTo(90, 4);
  });
});

describe("the Shieldguard Banner", () => {
  it("the example: harasses 9 frames after Chen's Lift, his Breach and each combo slash; the Decisive Assault 25 frames after Chen's later Lift; none for her Vulnerable-only Lift", () => {
    const s = run(example, example.rotation, example.durationFrames);
    const lifts = s.reactions.filter((r) => r.kind === "physical" && r.status === "lift").map((r) => r.frame);
    const breach = s.reactions.find((r) => r.kind === "physical" && r.status === "breach")?.frame ?? NaN;
    const slashes = hitsOf(s, "combo_skill").map((h) => h.frame);
    expect(followUps(s)).toEqual([
      [(lifts[0] ?? NaN) + 9, "harass"],
      [breach + 9, "harass"],
      [(slashes[0] ?? NaN) + 9, "harass"],
      [(slashes[1] ?? NaN) + 9, "harass"],
      [(lifts[1] ?? NaN) + 25, "decisive_assault"],
    ]);
    expect(s.stacks[O]?.["steel_oath"]).toBe(0);
    const harass = hitsOf(s, "ultimate_skill", "harass")[0];
    const assault = hitsOf(s, "ultimate_skill", "decisive_assault")[0];
    expect([harass?.zones.scale, assault?.zones.scale]).toEqual([expect.closeTo(1, 6), expect.closeTo(4.5, 6)]);
    expect([value({}, "ultimate_skill", "poise_final"), value({}, "ultimate_skill", "atb_trigger"), value({}, "ultimate_skill", "atb_final")]).toEqual([15, 10, 40]);
    // Chen's second battle skill (at 14 s) finds no Vulnerable stack (the Breach took both): it only adds one.
    expect(s.reactions.filter((r) => r.kind === "physical").map((r) => (r.kind === "physical" ? r.status : ""))).toEqual(["lift", "breach", "lift"]);
  });

  it("nothing without the banner, nothing after its 30 s, at most one follow-up per 0.1 s (the marker)", () => {
    const none = run(scenario(), [...stacks2, o("normal_skill"), o("combo_skill")], 400);
    expect(followUps(none)).toEqual([]);
    // The ultimate first, then Chen's Lifts more than 30 s later.
    const late = run(scenario({}, { durationFrames: 60 * 30 }), [o("ultimate_skill"), c("normal_skill", 33 * 30), c("combo_skill")], 60 * 30);
    expect(late.reactions.some((r) => r.kind === "physical" && r.status === "lift")).toBe(true);
    expect(followUps(late)).toEqual([]);
    const marker = data.kits.operators[O]?.buffs.find((b) => b.id === "soldier_marker");
    expect(marker?.duration).toBe(0.1);
  });

  it("follow-up SP: natural, skill-sourced (atbSourceType 3, from the files the ultimate reaches: D2) and before the hit's damage", () => {
    const sp = data.skills[P + "ultimate_skill"];
    expect([sp?.spKinds["atb_trigger"], sp?.spSources["atb_trigger"], sp?.spKinds["atb_final"], sp?.spSources["atb_final"]]).toEqual(["natural", 3, "natural", 3]);
    const s = run(example, example.rotation, example.durationFrames);
    // The first harass (from Chen's Lift) is his first skill-SP grant: Thermite Cutter's first layer is on it.
    const first = hitsOf(s, "ultimate_skill", "harass")[0];
    expect(from(first, THERMITE)).toEqual([expect.closeTo(0.14, 6)]);
  });
});

describe("Pogranichnik's talents", () => {
  it("talent 2: the teammate who triggers a follow-up gets Fervent Morale for 10 s (5 s at talent level 1), at most 3; none without talent 2 (or talent 1)", () => {
    const s = run(example, opening, 300);
    const chen = s.buffs.filter((b) => b.id === "fervent_morale_team");
    // 10 s, held 16 frames longer by his combo's world slow-down (buff timers run on the world's clock).
    expect(chen.map((b) => [b.expiresAt - b.appliedAt, b.recipients ?? null])).toEqual([[300 + HELD, [C]]]);
    const proc = s.hits.find((h) => h.operator === C && h.skillId === "passive_equipsuit_physuit_01");
    expect(from(proc, MORALE_TEAM, "atk")).toEqual([expect.closeTo(0.08, 6)]);
    expect(from(proc, MORALE_TEAM).length).toBe(2);
    const lvl1 = run(scenario({ talents: [2, 1] }), opening.slice(0, 5), 200).buffs.filter((b) => b.id === "fervent_morale_team");
    expect(lvl1.map((b) => b.expiresAt - b.appliedAt)).toEqual([150 + HELD]);
    // Without talent 2 only talent 1's own layer (20 s) is left; without talent 1 nothing (Morale's values are talent 1's).
    expect(run(scenario({ talents: [2, 0] }), opening, 300).buffs.filter((b) => b.id.startsWith("fervent_morale")).map((b) => [b.id, b.expiresAt - b.appliedAt])).toEqual([["fervent_morale", 600]]);
    expect(run(scenario({ talents: [0, 2] }), opening, 300).buffs.filter((b) => b.id.startsWith("fervent_morale"))).toEqual([]);
    expect(data.kits.operators[O]?.buffs.find((b) => b.id === "fervent_morale_team")?.maxStacks).toBe(3);
  });

  it("talents 1 and 2 on him: one Fervent Morale buff (ATK +0.08, Arts Intensity +8 per layer), 10 s from his own follow-ups, 20 s from every 60 SP his skills recover (P3; 80 below)", () => {
    const s = run(example, opening, 300);
    const layers = s.buffs.filter((b) => b.id === "fervent_morale").map((b) => [b.appliedAt, b.expiresAt - b.appliedAt]);
    // Breach (141), the two slashes (164, 178): talent 2's 10 s; the bank crosses 60 at the last harass (187): 20 s.
    const breach = s.reactions.find((r) => r.kind === "physical" && r.status === "breach")?.frame ?? NaN;
    const slashes = hitsOf(s, "combo_skill").map((h) => h.frame);
    expect(layers).toEqual([[breach, 300 + HELD], [slashes[0], 300], [slashes[1], 300], [(slashes[1] ?? NaN) + 9, 600]]);
    const a1 = hitsOf(s, "attack1")[0];
    expect(from(a1, MORALE, "atk")).toEqual([0.08, 0.08, 0.08, 0.08].map((x) => expect.closeTo(x, 6)));
    expect(from(a1, MORALE, "artsIntensity")).toEqual([8, 8, 8, 8].map((x) => expect.closeTo(x, 6)));
    // The bank: 10 (harass) + 15 (Breach) + 10 + 6 + 10 + 8.4 + 10 = 69.4 at 187, less 60.
    expect(s.stacks[O]?.["sp_banked"]).toBeCloseTo(9.4, 4);
    // Below P3 the threshold is 80: no talent-1 layer by then.
    const p2 = run(scenario({ potential: 2 }), opening, 300);
    expect(p2.buffs.filter((b) => b.id === "fervent_morale").map((b) => b.expiresAt - b.appliedAt)).toEqual([300 + HELD, 300, 300]);
    // atb_ratio is 1 below P5: 10 + 15 + 10 + 5 + 10 + 7 + 10.
    expect(p2.stacks[O]?.["sp_banked"]).toBeCloseTo(67, 4);
  });

  it("one cap for both sources: 5 layers at P3+, 3 below (B4: talent 2's applications carry their own duration)", () => {
    // Banner, Da Pan's battle skill and ultimate (his Knock Down: a harass for him), the Breach on 4 stacks, the 4-stack combo:
    // his own follow-ups give 4 talent-2 layers, the bank two talent-1 layers.
    const rot = [o("ultimate_skill"), d("normal_skill"), d("ultimate_skill"), o("normal_skill"), o("combo_skill")];
    const max = (b: Partial<Build>) => {
      const s = run(scenario(b), rot, 900);
      return Math.max(...s.hits.filter((h) => h.operator === O).map((h) => from(h, MORALE, "atk").length));
    };
    expect(max({})).toBe(5);
    expect(max({ potential: 2 })).toBe(3);
  });

  it("P1's returned SP needs two enemies hit (CheckEntityNum ≥ 2): not written, the fight has one", () => {
    expect(value({}, "normal_skill", "has_potential1")).toBe(1);
    expect(JSON.stringify(data.kits.operators[O])).not.toMatch(/atb_return/);
  });
});

describe("Pogranichnik's equipment", () => {
  it("Thermite Cutter: a team ATK layer (+0.14 at L9) for 20 s per natural skill-SP grant (battle-skill trigger, slashes, harasses, the Assault), 2 at most, each its own timer; not from Final Strike SP (atbSourceType 1)", () => {
    const s = run(scenario(), [...stacks2, o("normal_skill"), o("combo_skill")], 400);
    const [hit, hit2] = hitsOf(s, "normal_skill");
    // The Breach's SP comes before hit 2's damage (the ObtainCostAction precedes the DamageAction).
    expect([from(hit, THERMITE).length, from(hit2, THERMITE)]).toEqual([0, [expect.closeTo(0.14, 6)]]);
    const layers = s.buffs.filter((b) => b.id === "wpn_sword_0012.team_atk");
    const slashes = hitsOf(s, "combo_skill").map((h) => h.frame);
    expect(layers.map((b) => [b.appliedAt, b.expiresAt - b.appliedAt])).toEqual([[slashes[0], 600], [slashes[1], 600]]);
    expect(from(hitsOf(s, "combo_skill")[0], THERMITE).length).toBe(2);
    // A chain's Final Strike (20 SP, source 1) adds none.
    const chain = run(scenario(), ["attack1", "attack2", "attack3", "attack4", "attack5"].map((x) => o(x)), 300);
    expect(chain.buffs.filter((b) => b.id === "wpn_sword_0012.team_atk")).toEqual([]);
    // The Link half (abilityEvent 9 on buff_common_affixes_combo_trigger: Link the wielder receives) is the linkGained trigger (tests/batch4-values2.test.ts).
    expect(data.kits.equipment["wpn_sword_0012"]?.triggers.map((t) => t.id)).toEqual(["wpn_sword_0012.skill_sp", "wpn_sword_0012.link"]);
  });

  it("Never Rest: per skill-SP grant, Physical DMG +0.14 on the wielder and +0.07 on the others (L9) for 30 s, 5 layers at most, once per 0.1 s", () => {
    const sc = scenario({ weapon: { id: "wpn_sword_0016", level: 90, skillLevels: [9, 9, 9] } });
    const s = run(sc, [...stacks2, o("normal_skill"), o("combo_skill"), c("normal_skill", 400)], 500);
    const self = s.buffs.filter((b) => b.id === "wpn_sword_0016.self");
    const team = s.buffs.filter((b) => b.id === "wpn_sword_0016.team");
    // 30 s each (the combo's world slow-down holds the first a few frames longer).
    expect(self.map((b) => b.expiresAt - b.appliedAt).every((x) => x >= 900 && x < 930)).toBe(true);
    expect(self.length).toBe(3);
    expect(team.length).toBe(3);
    const chen = s.hits.find((h) => h.operator === C && h.frame > 400);
    expect(from(chen, "Never Rest")).toEqual([0.07, 0.07, 0.07].map((x) => expect.closeTo(x, 6)));
    const mine = s.hits.filter((h) => h.operator === O).at(-1);
    expect(from(mine, "Never Rest")).toEqual([0.14, 0.14, 0.14].map((x) => expect.closeTo(x, 6)));
    expect(data.kits.equipment["wpn_sword_0016"]?.buffs.map((b) => b.maxStacks)).toEqual(["max_stack", "max_stack"]);
    // On the stat panel: Physical DMG + phy_dmg_up (0.448 at L9).
    const panel = computeStats(data, sc.team[0] as Build);
    expect((panel.attrs[50]?.contributions ?? []).filter((x) => x.source.includes("sk_wpn_sword_0016")).map((x) => x.value)).toEqual([expect.closeTo(0.448, 6)]);
  });

  it("Glorious Memory on Chen: a layer per Vulnerability her skills apply (0.5 s apart), each +0.336 DMG (L9) on her next ultimate, all used up by it; acting while that cast runs (B5)", () => {
    const sc = scenario({}, { team: [readBuild(new URL("../examples/chen-p5.json", import.meta.url).pathname)].map((b) => ({ ...b, weapon: { id: "wpn_sword_0017", level: 90, skillLevels: [9, 9, 9] } })), startEnergy: { [C]: "full" } });
    const s = run(sc, [c("normal_skill"), c("combo_skill"), c("ultimate_skill")], 600);
    const ults = s.hits.filter((h) => h.skillId === C + "_ultimate_skill");
    const firstCast = s.casts.filter((x) => x.skill === C + "_ultimate_skill")[0]?.frame ?? NaN;
    const first = ults.filter((h) => h.frame < firstCast + 200);
    expect(first.every((h) => from(h, "Glorious Memory", "damageBonus").reduce((a, b) => a + b, 0) > 0)).toBe(true);
    // Two layers (battle skill, combo), each 0.336 on her Physical hits (the other four elements' lines don't reach them).
    expect(from(first[0], "Glorious Memory", "damageBonus")).toEqual([0.336, 0.336].map((x) => expect.closeTo(x, 6)));
    expect(s.buffs.filter((b) => b.id === "wpn_sword_0017.ready")).toEqual([]);
    const buff = data.kits.equipment["wpn_sword_0017"]?.buffs[0];
    expect([buff?.consumedBy, buff?.consumedScope]).toEqual([["ultimate"], "whileCasting"]);
  });

  it("Grand Vision on the Endministrator (7e19 t=33734's build, L5): her crystals ready +0.648 Physical DMG for her next battle skill, on its hit, its Crush and the crystal hit (B5), not on the ultimate after; the _ink skin is the same kit", () => {
    const em = readScenario(new URL("../examples/endministrator-crystals.scenario.json", import.meta.url).pathname);
    const M = "chr_0003_endminf", E = "chr_0021_whiten", G = "chr_0013_aglina";
    const withWeapon = (id: string): TimelineScenario => ({ ...em, team: em.team.map((b) => (b.operator === M ? { ...b, weapon: { id, level: 90, skillLevels: [9, 9, 5] } } : b)) });
    const rot = [step(G, "ultimate_skill"), step(E, "normal_skill", 63), step(G, "combo_skill"), step(M, "combo_skill"), step(M, "normal_skill"), step(M, "ultimate_skill")];
    for (const id of ["wpn_sword_0021", "wpn_sword_0021_ink"]) {
      const s = run(withWeapon(id), rot, 900);
      const gv = (skill: string, hit?: string) => from(s.hits.find((h) => h.skillId === skill && (hit === undefined || h.hitId === hit)), "Grand Vision", "damageBonus");
      expect(gv(M + "_normal_skill")).toEqual([expect.closeTo(0.648, 6)]);
      expect(gv("reaction:crush")).toEqual([expect.closeTo(0.648, 6)]);
      expect(gv(M + "_combo_skill", "shatter")).toEqual([expect.closeTo(0.648, 6)]);
      expect(gv(M + "_combo_skill", "hit")).toEqual([]);
      expect(gv(M + "_ultimate_skill")).toEqual([]);
    }
  });

  it("Grand Vision's Solidification half: a wielder whose hit forms Solidification (Estella, as a test of the trigger: not her weapon type) gets +1.008 (L9) on her next ultimate", () => {
    const em = readScenario(new URL("../examples/endministrator-crystals.scenario.json", import.meta.url).pathname);
    const E = "chr_0021_whiten", G = "chr_0013_aglina";
    const sc: TimelineScenario = { ...em, startEnergy: { ...em.startEnergy, [E]: "full" }, team: em.team.map((b) => (b.operator === E ? { ...b, weapon: { id: "wpn_sword_0021", level: 90, skillLevels: [9, 9, 9] } } : b)) };
    const s = run(sc, [step(G, "ultimate_skill"), step(E, "normal_skill", 63), step(E, "ultimate_skill")], 600);
    expect(s.reactions.filter((r) => r.kind === "reaction").map((r) => (r.kind === "reaction" ? [r.status, r.operator] : []))).toEqual([["solidification", E]]);
    expect(from(s.hits.find((h) => h.skillId === E + "_ultimate_skill"), "Grand Vision", "damageBonus")).toEqual([expect.closeTo(1.008, 6)]);
    expect(from(s.hits.find((h) => h.skillId === E + "_normal_skill"), "Grand Vision")).toEqual([]);
  });

  it("Complexed Industry: the wielder's combo applying Electric gives Arts Intensity +42 and Electric DMG +0.224 (L9) for 15 s, on that hit (Antal, as a test of the trigger)", () => {
    const A = "chr_0023_antal", PE = "chr_0004_pelica";
    const ant = readBuild(new URL("../examples/antal-p5-roc.json", import.meta.url).pathname);
    const per = readBuild(new URL("../examples/perlica-p5.json", import.meta.url).pathname);
    const sc: TimelineScenario = { team: [{ ...ant, weapon: { id: "wpn_sword_0024", level: 90, skillLevels: [9, 9, 9] } }, per], target: { enemy: "eny_0051_rodin", level: 90 }, durationFrames: 900, rotation: [], options: { crit: "expected" } };
    const s = run(sc, [step(A, "normal_skill"), step(PE, "normal_skill", 60), step(A, "combo_skill")], 200);
    const combo = s.hits.find((h) => h.skillId === A + "_combo_skill");
    expect(from(combo, "Complexed Industry").sort()).toEqual([expect.closeTo(0.224, 6), expect.closeTo(42, 6)]);
    expect(from(s.hits.find((h) => h.skillId === A + "_normal_skill"), "Complexed Industry")).toEqual([]);
    const buffs = s.buffs.filter((b) => b.id.startsWith("wpn_sword_0024"));
    expect(buffs.map((b) => [b.id, b.expiresAt - b.appliedAt])).toEqual([["wpn_sword_0024.intensity", 450], ["wpn_sword_0024.electric", 450]]);
  });

  it("Farsight: Dream Striving on the team from the fight's start for 20 s (DMG +0.14, Arts Intensity +28, DEF +8.4% at L9), then the team heal (an event)", () => {
    const sc = scenario({ weapon: { id: "wpn_sword_0026", level: 90, skillLevels: [9, 9, 9] } });
    const s = run(sc, [c("normal_skill")], 700);
    const chen = s.hits.find((h) => h.skillId === C + "_normal_skill");
    expect(from(chen, "Dream Striving", "damageBonus")).toEqual([expect.closeTo(0.14, 6)]);
    expect(from(chen, "Dream Striving", "artsIntensity")).toEqual([expect.closeTo(28, 6)]);
    expect(fired(s, O, "wpn_sword_0026.heal")).toBe(1);
    expect(s.buffs.some((b) => b.id === "wpn_sword_0026.dream")).toBe(false);
    const def = data.kits.equipment["wpn_sword_0026"]?.buffs[0]?.modifiers.find((m) => m.attr === 3);
    expect(def?.percent).toBe(true);
  });
});
