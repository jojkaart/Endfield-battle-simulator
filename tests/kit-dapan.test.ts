// Da Pan's kit (chr_0018_dapan) and his equipment kits (wpn_claym_0014 Ancient Canal, wpn_claym_0015 OBJ Heavy Burden):
// the mechanics the kit plan (docs/kit-batches/batch-3/chr_0018_dapan.md, § Kit plan and § Kit) says must fire.
// No log has him: the expected values are the data's (SkillPatchTable at skill level 12, weapon skill level 9).
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const D = "chr_0018_dapan";
const P = D + "_";
const CANAL = { id: "wpn_claym_0014", level: 90, skillLevels: [9, 9, 9] };
const BURDEN = { id: "wpn_claym_0015", level: 90, skillLevels: [9, 9, 9] };
const dapan: Build = {
  operator: D, level: 90, promotion: 4, potential: 5,
  skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 },
  weapon: CANAL, gear: [],
};
/** Da Pan alone (P5, Ancient Canal, no gear) against Rhodagn, ultimate charged, no enemy actions. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  team: [{ ...dapan, ...b }],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 60 * 30,
  rotation: [],
  options: { crit: "expected" },
  startEnergy: { [D]: "full" },
  ...extra,
});
const op = (skill: string, at?: number): RotationAction => ({ operator: D, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.skill === P + skill)[n]?.frame ?? NaN;
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === skill && (hit === undefined || h.hitId === hit));
const fromSource = (h: LandedHit | undefined, text: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(text)).map((m) => m.value);
const physical = (s: TimelineState) => s.reactions.flatMap((r) => (r.kind === "physical" ? [{ frame: r.frame, status: r.status, level: r.level, forced: r.forced }] : []));
const vulnerable = (s: TimelineState) => s.reactions.flatMap((r) => (r.kind === "vulnerable" ? [[r.frame, r.before, r.stacks]] : []));
/** Battle skill (P5: 2 stacks on a fresh enemy), ultimate (forced Lift and Knock Down: 4), combo. */
const opener = [op("normal_skill"), op("ultimate_skill"), op("combo_skill")];

describe("Da Pan's basic attacks and finisher", () => {
  it("hits at 13 / 7 / 10 + 23 / 32 frames into each attack; the Final Strike has poise 20 (controlled only) and 21 SP", () => {
    const s = run(scenario(), ["attack1", "attack2", "attack3", "attack4"].map((x) => op(x)), 200);
    const rel = (skill: string) => hitsOf(s, P + skill).map((h) => h.frame - castAt(s, skill));
    expect(["attack1", "attack2", "attack3", "attack4"].map(rel)).toEqual([[13], [7], [10, 23], [32]]);
    const kit = data.kits.operators[D];
    const a4 = kit?.skills.find((k) => k.skillId === P + "attack4")?.hits[0];
    expect([a4?.poise, a4?.poiseControlledOnly, a4?.finalStrike]).toEqual(["poise", true, true]);
    expect(data.skills[P + "attack4"]?.levels.at(-1)?.blackboard["atb"]).toBe(21);
  });

  it("the finisher's two BreakingAttackCalculation hits: atk_scale × 0.4 at 16 and × 0.6 at 35", () => {
    const fin = data.kits.operators[D]?.skills.find((k) => k.skillId === P + "power_attack");
    expect(fin?.hits.map((h) => [h.frames, h.factor])).toEqual([[[16], 0.4], [[35], 0.6]]);
  });
});

describe("Da Pan's battle skill", () => {
  it("two hits at 8 and 43; at P5 on a fresh enemy the Lift only adds a stack and P5 adds one more: 2 stacks, no Lift", () => {
    const s = run(scenario(), [op("normal_skill")], 120);
    expect(hitsOf(s, P + "normal_skill").map((h) => [h.hitId, h.frame])).toEqual([["charge", 8], ["flip", 43]]);
    expect(vulnerable(s)).toEqual([[43, 0, 1], [43, 1, 2]]);
    expect(physical(s)).toEqual([]);
    expect(s.buffs.filter((b) => b.id === "p5_interval").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[43, 43 + 45 * 30]]);
  });

  it("P5's extra stack once per 45 s: a second battle skill Lifts (level 1) and adds one stack; below P5 never", () => {
    const s = run(scenario(), [op("normal_skill"), op("normal_skill")], 200);
    const second = castAt(s, "normal_skill", 1) + 43;
    expect(physical(s)).toEqual([{ frame: second, status: "lift", level: 1, forced: false }]);
    expect(s.enemy.vulnerable?.stacks).toBe(3);
    const p4 = run(scenario({ potential: 4 }), [op("normal_skill")], 120);
    expect(vulnerable(p4)).toEqual([[43, 0, 1]]);
    expect(p4.buffs.some((b) => b.id === "p5_interval")).toBe(false);
  });

  it("the team's energy from its SP comes at frame 43 (buff_common_obtain_ultimate_sp), not at the cast", () => {
    const sc = scenario({}, { startEnergy: {} });
    expect(run(sc, [op("normal_skill")], 42).energy[D] ?? 0).toBe(0);
    expect(run(sc, [op("normal_skill")], 44).energy[D] ?? 0).toBeGreaterThan(0);
  });
});

describe("Da Pan's ultimate", () => {
  it("a forced Lift at the cast, six flurry hits at 42–61 and the dunk at 80 with a forced Knock Down: 2 Vulnerable stacks", () => {
    const s = run(scenario(), [op("ultimate_skill")], 200);
    const u = castAt(s, "ultimate_skill");
    expect(hitsOf(s, P + "ultimate_skill").map((h) => [h.hitId, h.frame - u])).toEqual([
      ...[42, 46, 50, 54, 58, 61].map((f) => ["flurry", f]),
      ["dunk", 80],
    ]);
    expect(physical(s)).toEqual([
      { frame: u, status: "lift", level: 1, forced: true },
      { frame: u + 80, status: "knockdown", level: 1, forced: true },
    ]);
    expect(s.enemy.vulnerable?.stacks).toBe(2);
  });

  it("talent 2: one Prep Ingredients layer at the dunk, 20 s + 10 s (P2) with max talent_1_stack 2 + 1; none without the talent", () => {
    const s = run(scenario(), [op("ultimate_skill")], 200);
    const u = castAt(s, "ultimate_skill");
    expect(s.buffs.filter((b) => b.id === "prep_ingredients").map((b) => [b.appliedAt, b.expiresAt, b.maxLayers])).toEqual([[u + 80, u + 80 + 30 * 30, 3]]);
    const p1 = run(scenario({ potential: 1 }), [op("ultimate_skill")], 200);
    expect(p1.buffs.filter((b) => b.id === "prep_ingredients").map((b) => [b.expiresAt - b.appliedAt, b.maxLayers])).toEqual([[20 * 30, 2]]);
    expect(run(scenario({ talents: [2, 0] }), [op("ultimate_skill")], 200).buffs.some((b) => b.id === "prep_ingredients")).toBe(false);
  });
});

describe("Da Pan's combo", () => {
  it("its window opens when an enemy reaches 4 Vulnerable stacks (here the ultimate's Knock Down), not before", () => {
    const sc = scenario();
    const ctx = createContext(data, sc);
    const two = advance(ctx, apply(ctx, init(ctx), op("normal_skill")), 60);
    expect(earliestStart(ctx, two, op("combo_skill"))).toEqual({ error: `${P}combo_skill: its combo trigger hasn't happened (no open window at frame 60)` });
    const s = run(sc, opener.slice(0, 2), 400);
    expect(s.comboWindow[D]?.from).toBe(castAt(s, "ultimate_skill") + 80);
  });

  it("interim (in-game test 64): a stack added at 4, the count staying 4, opens the window again", () => {
    // Battle skill and ultimate: 4 stacks and a window; no combo; 8 s later a battle skill Lifts and adds a stack at the cap.
    const s = run(scenario(), [op("normal_skill"), op("ultimate_skill"), op("normal_skill", 600)], 800);
    const flip = castAt(s, "normal_skill", 1) + 43;
    expect(vulnerable(s).at(-1)).toEqual([flip, 4, 4]);
    expect(s.comboWindow[D]?.from).toBe(flip);
  });

  it("Crush at level 4 × crush_multi 1.2 on the combo's frame 23, consuming every stack", () => {
    const s = run(scenario(), opener, 600);
    const c = castAt(s, "combo_skill");
    expect(hitsOf(s, P + "combo_skill").map((h) => h.frame - c)).toEqual([23]);
    expect(s.reactions.filter((r) => r.kind === "physical" && r.status === "crush")).toEqual([expect.objectContaining({ frame: c + 23, level: 4, multiplier: expect.closeTo(1.2, 6) })]);
    expect(s.enemy.vulnerable).toBeNull();
  });

  it("talent 1: one Reduce and Thicken layer (+0.06) per stack the Crush consumes, on one 10 s timer, already on the combo hit and the Crush", () => {
    const s = run(scenario(), opener, 300);
    const at = castAt(s, "combo_skill") + 23;
    const layers = s.buffs.filter((b) => b.id === "reduce_and_thicken");
    expect(layers.map((b) => [b.appliedAt, b.expiresAt])).toEqual(Array.from({ length: 4 }, () => [at, at + 300]));
    const combo = hitsOf(s, P + "combo_skill")[0];
    const crush = hitsOf(s, "reaction:crush")[0];
    for (const h of [combo, crush]) expect(fromSource(h, "Reduce and Thicken")).toEqual(Array.from({ length: 4 }, () => expect.closeTo(0.06, 6)));
    // Talent 1 at level 1: 0.04 a layer; not learned: none.
    const t1 = run(scenario({ talents: [1, 2] }), opener, 300);
    expect(fromSource(hitsOf(t1, P + "combo_skill")[0], "Reduce and Thicken")).toEqual(Array.from({ length: 4 }, () => expect.closeTo(0.04, 6)));
    expect(run(scenario({ talents: [0, 2] }), opener, 300).buffs.some((b) => b.id === "reduce_and_thicken")).toBe(false);
  });

  it("Prep Ingredients cuts the combo's cooldown by 40% of its 19 s when the combo hits, and loses a layer", () => {
    const s = run(scenario(), opener, 600);
    const c = castAt(s, "combo_skill");
    expect(s.readyAt[P + "combo_skill"]).toBe(c + 19 * 30 - Math.round(0.4 * 19 * 30));
    expect(s.buffs.some((b) => b.id === "prep_ingredients")).toBe(false);
    const none = run(scenario({ talents: [2, 0] }), opener, 600);
    expect(none.readyAt[P + "combo_skill"]).toBe(castAt(none, "combo_skill") + 19 * 30);
  });

  it("P1 (a kill by the ultimate) isn't modelled: no buff from it", () => {
    const s = run(scenario(), opener, 600);
    expect(s.buffs.some((b) => b.id.includes("potential_1"))).toBe(false);
    expect(s.hits.every((h) => fromSource(h, "potential_1").length === 0)).toBe(true);
  });
});

describe("Da Pan's equipment", () => {
  it("Ancient Canal: Physical DMG +0.14 × stacks consumed (0.56 after a 4-stack Crush) for 20 s, on the combo hit and its Crush", () => {
    const s = run(scenario(), opener, 600);
    const at = castAt(s, "combo_skill") + 23;
    expect(s.buffs.filter((b) => b.id === "wpn_claym_0014.phys").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[at, at + 600]]);
    for (const h of [hitsOf(s, P + "combo_skill")[0], hitsOf(s, "reaction:crush")[0]]) expect(fromSource(h, "Lands of Yore")).toEqual([expect.closeTo(0.56, 6)]);
  });

  it("Ancient Canal's buff keeps instances (stackingType 1, priority key, maxStackCnt 2): the loader gives it instances 2, no maxStacks", () => {
    const b = data.kits.equipment["wpn_claym_0014"]?.buffs.find((x) => x.id === "wpn_claym_0014.phys");
    expect([b?.instances, b?.maxStacks]).toEqual([2, undefined]);
  });

  it("OBJ Heavy Burden: DEF +50.4% of the panel line for 15 s when the wielder Knocks Down (the dunk)", () => {
    const s = run(scenario({ weapon: BURDEN }), [op("ultimate_skill")], 200);
    const at = castAt(s, "ultimate_skill") + 80;
    expect(s.buffs.filter((b) => b.id === "wpn_claym_0015.def").map((b) => [b.appliedAt, b.expiresAt, b.attrs])).toEqual([[at, at + 450, [{ attr: 3, value: expect.closeTo(0.504, 6), percent: true }]]]);
    // A Lift isn't a Knock Down: the battle skill alone gives nothing.
    expect(run(scenario({ weapon: BURDEN }), [op("normal_skill"), op("normal_skill")], 200).buffs.some((b) => b.id === "wpn_claym_0015.def")).toBe(false);
  });

  it("OBJ Heavy Burden on Catcher: her ultimate's Weakness gives the DEF buff (its Knock Down refreshes it), and her P1 strikes gain 5 × 0.504 × her DEF line", () => {
    const C = "chr_0020_meurs";
    const catcher: Build = { operator: C, level: 90, promotion: 4, potential: 5, skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 }, weapon: BURDEN, gear: [] };
    const sc: TimelineScenario = { ...scenario(), team: [catcher], startEnergy: { [C]: "full" }, enemyActions: [{ kind: "attack", at: [30] }] };
    // The battle skill's counter bash (a strike without the buff, and 1 Vulnerable), then the ultimate.
    const ctx = createContext(data, sc);
    const s0 = apply(ctx, apply(ctx, init(ctx), { operator: C, skill: C + "_normal_skill" }), { operator: C, skill: C + "_ultimate_skill", at: 300 });
    const weakness = 300 + 46;
    const knockdown = 300 + 85;
    expect(advance(ctx, s0, weakness + 1).buffs.filter((b) => b.id === "wpn_claym_0015.def").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[weakness, weakness + 450]]);
    const s = advance(ctx, s0, 600);
    expect(s.buffs.filter((b) => b.id === "wpn_claym_0015.def").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[knockdown, knockdown + 450]]);
    expect([s.triggerState[`${C}:wpn_claym_0015.on_weakness`]?.count, s.triggerState[`${C}:wpn_claym_0015.on_knockdown`]?.count]).toEqual([1, 1]);
    const strikes = hitsOf(s, "buff_chr_0020_meurs_potential_1");
    const before = strikes.find((h) => h.frame < weakness)?.zones.atk ?? NaN;
    // The strike of the hit that applies the Weakness already has it.
    const after = strikes.filter((h) => h.frame >= weakness).map((h) => h.zones.atk);
    const def = ctx.panels.get(C)?.attrs[3];
    const gain = 5 * 0.504 * ((def?.base ?? NaN) + (def?.add ?? NaN)) * (def?.multiply ?? NaN);
    expect(after).toHaveLength(6);
    for (const a of after) expect(a - before).toBeCloseTo(gain, 3);
  });
});
