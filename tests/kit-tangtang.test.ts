// Tangtang's kit (chr_0027_tangtang) and the equipment kits of her batch-4 report (Clannibal, Artzy Tyrannical,
// Brigand's Calling): the mechanics the kit plan (docs/kit-batches/batch-4/chr_0027_tangtang.md, § Kit plan and
// § Kit) says must fire, on the example's build (P5, Brigand's Calling, MI Security hand + 3 Bonekrusha).
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type KitSkill, type LandedHit, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const T = "chr_0027_tangtang";
const P = T + "_";
const SI = "chr_0036_jsspsi";
const example = readScenario(new URL("../examples/tangtang-whirlpools.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: T, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const chain = (at?: number) => ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s, i) => op(s, i === 0 ? at : undefined));
const weapon = (id: string) => ({ weapon: { id, level: 90, skillLevels: [9, 9, 9] as [number, number, number] } });

/** The example with Tangtang's build changed. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === T ? { ...m, ...b } : m)),
  ...extra,
});
/** Without talent 1 (Haste near a Whirlpool speeds up her own frames). */
const noHaste = (b: Partial<Build> = {}) => scenario({ talents: [0, 2], ...b });
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames, g: GameData = data): TimelineState => {
  const ctx = createContext(g, { ...sc, rotation });
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === T);
const named = (s: TimelineState, hitId: string) => mine(s).filter((h) => h.hitId === hitId);
/** The frame of attack1's (dive-marked) landing. */
const diveAt = (s: TimelineState, n = 0) => mine(s).filter((h) => h.skillId === P + "attack1")[n]?.frame ?? NaN;
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === T && c.skill === P + skill)[n]?.frame ?? NaN;
const fromSource = (h: LandedHit | undefined, text: string) => (h ? h.modifiers.filter((m) => m.source.includes(text)).map((m) => m.value) : []);
const kit = data.kits.operators[T] as OperatorKit;
/** Tangtang's kit with some of her skills' hits marked as dive landings (decorate bit 1024): rotations can't cast dives yet (batch-1 S10). */
const withDive = (operator: string, skill: string, g: GameData = data): GameData => {
  const k = g.kits.operators[operator] as OperatorKit;
  const skills = k.skills.map((s): KitSkill => (s.skillId === skill ? { ...s, hits: s.hits.map((h) => ({ ...h, dive: true })) } : s));
  return { ...g, kits: { ...g.kits, operators: { ...g.kits.operators, [operator]: { ...k, skills } } } };
};
const diving = withDive(T, P + "attack1");
/** Her kit with a test-only trigger: casting attack1 opens her combo window (stands in for a teammate's Cryo Infliction). */
const opener: GameData = { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [T]: { ...kit, triggers: [...kit.triggers, { id: "test_window", on: { event: "cast", skills: [P + "attack1"] }, by: "self", do: [{ kind: "openCombo" }] }] } } } };
// Battle skill (one Waterspout: its Cryo opens the combo), combo (a Whirlpool), battle skill (two Waterspouts).
const opening: RotationAction[] = [op("normal_skill"), op("combo_skill"), op("normal_skill")];
/** Two Whirlpools: battle skill, combo, and a second combo after the 10 s cooldown (P1). */
const twoPools: RotationAction[] = [...opening.slice(0, 2), op("attack1", 12 * 30), op("combo_skill")];

describe("Tangtang's kit: hits and frames", () => {
  it("each hit lands at its data frame after its cast", () => {
    const s = run(noHaste(), chain(), 30 * 8);
    const rel = (skill: string) => mine(s).filter((h) => h.skillId === P + skill).map((h) => h.frame - castAt(s, skill));
    expect(rel("attack1")).toEqual([3]);
    expect(rel("attack2")).toEqual([6, 10]);
    expect(rel("attack3")).toEqual([5, 7, 9, 10, 12, 17, 17, 18, 18]);
    expect(rel("attack4")).toEqual([6, 10, 23]);
    expect(rel("attack5")).toEqual([22]);
    // The finisher needs a Staggered enemy: its frames and factors from the kit (BreakingAttackCalculation 0.3 / 0.7 of atk_scale).
    expect(kit.skills.find((k) => k.skillId === P + "power_attack")?.hits.map((h) => [h.frames, h.factor])).toEqual([[[9], 0.3], [[21], 0.7]]);
    const u = run(noHaste(), [op("ultimate_skill")], 30 * 10);
    expect(named(u, "stare").map((h) => h.frame - castAt(u, "ultimate_skill"))).toEqual([76, 91, 106, 121, 136, 151, 166, 181]);
    expect(named(u, "rogue_wave").map((h) => h.frame - castAt(u, "ultimate_skill"))).toEqual([196]);
    expect(named(u, "early_rogue_wave")).toEqual([]);
  });

  it("everything she deals is Cryo; the Final Strike is attack5's, with 18 Stagger as the controlled operator", () => {
    const s = run(noHaste(), [...chain(), ...opening, op("ultimate_skill")], 30 * 20);
    expect(new Set(mine(s).filter((h) => !h.skillId.startsWith("reaction")).map((h) => h.element))).toEqual(new Set(["cryst"]));
    const a5 = kit.skills.find((k) => k.skillId === P + "attack5")?.hits[0];
    expect([a5?.finalStrike, a5?.poise, a5?.poiseControlledOnly]).toEqual([true, "poise", true]);
  });

  it("the dive attack is 4 ticks of atk_scale (the display's 180% at level 12 is 4 × 0.45), a dive landing each", () => {
    const dive = kit.skills.find((k) => k.skillId === P + "plunging_attack_end")?.hits[0];
    expect([dive?.count, dive?.frames, dive?.dive]).toEqual([4, [3, 5, 7, 9], true]);
    // A rotation's dive (batch-1 S10, tests/batch4-dive.test.ts): the landing 22 frames after the jump, its four ticks after it.
    const s = run(noHaste(), [op("plunging_attack_end")], 30 * 2);
    expect(castAt(s, "plunging_attack_end")).toBe(22);
    expect(mine(s).filter((h) => h.skillId === P + "plunging_attack_end").map((h) => h.frame)).toEqual([25, 27, 29, 31]);
  });

  it("the combo opens on a Cryo Infliction (here her own Waterspout's), not before", () => {
    expect(() => run(noHaste(), [op("combo_skill")], 30 * 3)).toThrow(/combo trigger/);
    const s = run(noHaste(), opening.slice(0, 2), 30 * 4);
    expect(castAt(s, "combo_skill")).toBeGreaterThan(castAt(s, "normal_skill") + 23);
    expect(named(s, "jet")).toHaveLength(1);
  });
});

describe("Tangtang's kit: Whirlpools and Waterspouts", () => {
  const layers = (s: TimelineState) => s.buffs.filter((b) => b.owner === T && b.id === "whirlpool" && b.expiresAt > s.frame).length;

  it("the combo leaves a Whirlpool 26 frames after its cast, for 30 s; at most 2: a third replaces the oldest", () => {
    const s = run(noHaste(), opening.slice(0, 2), 30 * 4);
    const w = s.buffs.filter((b) => b.owner === T && b.id === "whirlpool");
    expect(w.map((b) => [b.appliedAt - castAt(s, "combo_skill"), b.expiresAt - b.appliedAt])).toEqual([[26, 30 * 30]]);
    // Three combos 12 s apart (P1: 10 s cooldown; a test-only trigger opens the window) without a battle skill: two layers, the third replacing the oldest.
    const three = run(noHaste(), [...twoPools, op("attack1", 24 * 30), op("combo_skill")], 27 * 30, opener);
    expect(three.casts.filter((c) => c.skill === P + "combo_skill")).toHaveLength(3);
    expect(layers(three)).toBe(2);
    expect(Math.min(...three.buffs.filter((b) => b.id === "whirlpool").map((b) => b.appliedAt))).toBeGreaterThan(12 * 30);
  });

  it("the battle skill makes 1 + n Waterspouts (n Whirlpools, at most 3), 12 ticks each from frame 23, logged as _projhit / _1 / _2, and consumes the Whirlpools", () => {
    const s = run(noHaste(), opening, 30 * 8);
    const [first, second] = [0, 1].map((n) => castAt(s, "normal_skill", n));
    const ticks = [0, 8, 16, 23, 31, 39, 47, 55, 62, 70, 78, 86].map((t) => 23 + t);
    expect([...named(s, "spout1_first"), ...named(s, "spout1")].map((h) => h.frame - (first as number))).toEqual(ticks);
    expect([...named(s, "spout2_first"), ...named(s, "spout2")].map((h) => h.frame - (second as number)).sort((a, b) => a - b)).toEqual(ticks.flatMap((t) => [t, t]));
    expect(layers(s)).toBe(0);
    // Two Whirlpools (two combos, the second after the 10 s cooldown at P1): three Waterspouts, 36 ticks.
    const two = run(noHaste(), [...twoPools, op("normal_skill")], 18 * 30, opener);
    expect([...named(two, "spout3_first"), ...named(two, "spout3")]).toHaveLength(36);
    expect(layers(two)).toBe(0);
    // Each Waterspout tick is the passive's normalskill_atk_scale01: 0.25, ×1.1 at P3 (0.275).
    expect(named(s, "spout1")[0]?.scaleParts).toEqual([{ key: "value", value: expect.closeTo(0.275, 6) }]);
    const p2 = run(noHaste({ potential: 2 }), opening, 30 * 8);
    expect(named(p2, "spout1")[0]?.scaleParts).toEqual([{ key: "value", value: expect.closeTo(0.25, 6) }]);
  });

  it("one Cryo Infliction per cast (the first tick), however many Waterspouts", () => {
    const at = [0, 1].map((n) => castAt(run(noHaste(), opening, 30 * 4), "normal_skill", n)) as [number, number];
    const stacks = (frame: number, rotation = opening) => run(noHaste(), rotation, frame).enemy.infliction;
    expect(stacks(at[0] + 22, opening.slice(0, 1))).toBeNull();
    expect(stacks(at[0] + 23, opening.slice(0, 1))).toMatchObject({ element: "cryst", stacks: 1 });
    expect(stacks(at[0] + 115, opening.slice(0, 1))).toMatchObject({ element: "cryst", stacks: 1 });
    expect(stacks(at[1] + 22)).toMatchObject({ element: "cryst", stacks: 1 });
    // The second cast's 24 ticks add one stack (Cryo on Cryo: an Arts Burst too).
    expect(stacks(at[1] + 23 + 87)).toMatchObject({ element: "cryst", stacks: 2 });
    expect(run(noHaste(), opening, at[1] + 120).reactions.filter((r) => r.kind === "burst" && r.operator === T)).toHaveLength(1);
  });

  it("SP: atb_return per Whirlpool consumed at frame 11 (25 at P1+, 20 at P0), returned SP", () => {
    const gain = (b: Partial<Build>) => {
      const sc = noHaste(b);
      const at = castAt(run(sc, opening, 30 * 5), "normal_skill", 1);
      const before = run(sc, opening, at + 10);
      const after = run(sc, opening, at + 11);
      return [after.sp - before.sp, after.spReturned - before.spReturned];
    };
    const [p5, p5r] = gain({});
    // No regeneration meanwhile (paused 1.5 s after the cast's spending).
    expect(p5).toBeCloseTo(25, 6);
    expect(p5r).toBeCloseTo(25, 6);
    expect(gain({ potential: 0 })[1]).toBeCloseTo(20, 6);
  });

  it("two Waterspouts: Arts Susceptibility 10% at P3+ (5% below) for 15 s from the first tick; three: 15%, replacing it", () => {
    const s = run(noHaste(), opening, 30 * 6);
    const first = named(s, "spout2_first")[0];
    const later = named(s, "spout2").at(-1);
    expect(first?.zones.susceptibility).toBe(1);
    expect(later?.zones.susceptibility).toBeCloseTo(1.1, 6);
    expect(named(run(noHaste(), opening.slice(0, 1), 30 * 5), "spout1").at(-1)?.zones.susceptibility).toBe(1);
    const susc = s.buffs.filter((b) => b.id === "spout_susceptibility_2");
    expect(susc.map((b) => [b.appliedAt - castAt(s, "normal_skill", 1), b.expiresAt - b.appliedAt])).toEqual([[23, 15 * 30]]);
    const p2 = run(noHaste({ potential: 2 }), opening, 30 * 6);
    expect(named(p2, "spout2").at(-1)?.zones.susceptibility).toBeCloseTo(1.05, 6);
    // After the two-Waterspout cast, a three-Waterspout one: 15%, one instance (the 10% one ended).
    const three = run(noHaste(), [op("normal_skill"), op("combo_skill"), op("normal_skill"), op("attack1", 12 * 30), op("combo_skill"), op("attack1", 24 * 30), op("combo_skill"), op("normal_skill")], 29 * 30, opener);
    expect(named(three, "spout3").at(-1)?.zones.susceptibility).toBeCloseTo(1.15, 6);
    expect(three.buffs.filter((b) => b.id.startsWith("spout_susceptibility") && b.expiresAt > three.frame).map((b) => b.id)).toEqual(["spout_susceptibility_3"]);
  });
});

describe("Tangtang's kit: talents", () => {
  it("talent 1: the team gets Haste (attribute 92, ratio_speed 0.2) for the Whirlpool's 30 s + 3 s; the consumption cuts it to 3 s; unlearned, none", () => {
    const at = castAt(run(scenario(), opening, 30 * 4), "normal_skill", 1);
    const s = run(scenario(), opening, at + 20);
    const haste = s.buffs.filter((b) => b.owner === T && (b.id === "haste" || b.id === "haste_tail"));
    expect(haste.map((b) => b.id)).toEqual(["haste_tail"]);
    expect(haste[0]?.attrs).toEqual([{ attr: 92, value: expect.closeTo(0.2, 6) }]);
    expect((haste[0]?.expiresAt ?? NaN) - (haste[0]?.appliedAt ?? NaN)).toBe(3 * 30);
    expect(haste[0]?.appliedAt).toBeGreaterThan(at);
    // Before the battle skill: 33 s.
    const held = run(scenario(), opening.slice(0, 2), 30 * 4).buffs.filter((b) => b.id === "haste");
    expect(held.map((b) => b.expiresAt - b.appliedAt)).toEqual([33 * 30]);
    expect(run(noHaste(), opening, 30 * 3).buffs.some((b) => b.id === "haste" || b.id === "haste_tail")).toBe(false);
  });

  it("OLDEN STARE: the enemy Immobilized for 4 s from frame 76 (a freeze)", () => {
    const s = run(noHaste(), [op("ultimate_skill")], 30 * 8);
    const ctl = s.reactions.filter((r) => r.kind === "control" && r.operator === T);
    expect(ctl.map((r) => (r.kind === "control" ? [r.frame - castAt(s, "ultimate_skill"), r.status, r.frames, r.freezes] : null))).toEqual([[76, "immobilization", 120, true]]);
  });

  it("a dive by the controlled operator inside the stare ends it: no more DoT ticks or plain wave, the early wave 5 frames later at atk_scale_3", () => {
    const rotation = [op("ultimate_skill"), op("attack1", 5 * 30)];
    const s = run(noHaste(), rotation, 30 * 12, diving);
    const dive = diveAt(s);
    expect(named(s, "stare").every((h) => h.frame <= dive)).toBe(true);
    expect(named(s, "stare").length).toBeLessThan(8);
    expect(named(s, "rogue_wave")).toEqual([]);
    const early = named(s, "early_rogue_wave");
    expect(early.map((h) => h.frame - dive)).toEqual([5]);
    // 8.05 / 0.46 at P5: the logged ratio to a DoT tick on the same effects (b7b3: 193,830 at 15558 ms).
    expect((early[0]?.exact ?? NaN) / (named(s, "stare")[0]?.exact ?? NaN)).toBeCloseTo(8.05 / 0.46, 3);
    // Once: the dive's later landings (this attack has one) and later dives do nothing.
    const twice = run(noHaste(), [op("ultimate_skill"), op("attack1", 5 * 30), op("attack1", 5.5 * 30)], 30 * 12, diving);
    expect(named(twice, "early_rogue_wave")).toHaveLength(1);
  });

  it("a rotation's own dive (batch-1 S10) inside the stare sets off the early wave 5 frames after its landing", () => {
    const s = run(noHaste(), [op("ultimate_skill"), op("plunging_attack_end", 5 * 30)], 30 * 12);
    const landing = mine(s).find((h) => h.skillId === P + "plunging_attack_end")?.frame ?? NaN;
    expect(Number.isFinite(landing)).toBe(true);
    expect(named(s, "early_rogue_wave").map((h) => h.frame - landing)).toEqual([5]);
    expect(named(s, "rogue_wave")).toEqual([]);
  });

  it("a dive before the stare or after its rogue wave does nothing; without the dive the plain wave lands", () => {
    const before = run(noHaste(), [op("attack1"), op("ultimate_skill")], 30 * 12, diving);
    expect(named(before, "early_rogue_wave")).toEqual([]);
    expect(named(before, "stare")).toHaveLength(8);
    expect(named(before, "rogue_wave")).toHaveLength(1);
    const after = run(noHaste(), [op("ultimate_skill"), op("attack1", 9 * 30)], 30 * 14, diving);
    expect(named(after, "rogue_wave")).toHaveLength(1);
    expect(named(after, "early_rogue_wave")).toEqual([]);
  });

  it("anyone's dive as the controlled operator counts (b7b3: Arcane's)", () => {
    const sc = scenario({ talents: [0, 2] }, { team: [...example.team, readScenario(new URL("../examples/xaihi-si.scenario.json", import.meta.url).pathname).team.find((m) => m.operator === SI) as Build] });
    const g = withDive(SI, `${SI}_attack1`);
    const s = run(sc, [op("ultimate_skill"), { operator: SI, skill: "swap", at: 5 * 30 }, { operator: SI, skill: `${SI}_attack1` }], 30 * 12, g);
    expect(named(s, "early_rogue_wave")).toHaveLength(1);
  });

  it("talent 2 (Riot Bringer): the dive also makes 1 + n Waterspouts 18 frames later, Battle Skill DMG with dmg_up_water_ult (1.4 at P5), consuming the Whirlpools; unlearned, only the early wave", () => {
    const rotation = [...opening.slice(0, 2), op("ultimate_skill"), op("attack1", 7 * 30)];
    const s = run(noHaste(), rotation, 30 * 14, diving);
    const dive = diveAt(s);
    const riot = [...named(s, "riot_spout2_first"), ...named(s, "riot_spout2")];
    expect(riot).toHaveLength(24);
    expect(Math.min(...riot.map((h) => h.frame)) - dive).toBe(18);
    expect(riot.every((h) => h.skillId === P + "ultimate_skill")).toBe(true);
    expect(fromSource(riot[0], "dmg_up_water_ult")).toEqual([expect.closeTo(1.4, 6)]);
    expect(s.buffs.some((b) => b.id === "whirlpool" && b.expiresAt > s.frame)).toBe(false);
    // The first tick inflicts Cryo and applies the two-Waterspout Susceptibility.
    // (the opening battle skill's stack is still there: one more, and no more from the other 23 ticks)
    const stacks = (frame: number) => run(noHaste(), rotation, frame, diving).enemy.infliction?.stacks ?? 0;
    expect([stacks(dive + 17), stacks(dive + 18), stacks(dive + 18 + 87)]).toEqual([1, 2, 2]);
    expect(s.buffs.some((b) => b.id === "spout_susceptibility_2" && b.appliedAt === dive + 18)).toBe(true);
    // P4: talent 2's 0.6 alone.
    const p4 = run(noHaste({ potential: 4 }), rotation, 30 * 14, diving);
    expect(fromSource(named(p4, "riot_spout2")[0], "dmg_up_water_ult")).toEqual([expect.closeTo(0.6, 6)]);
    const off = run(noHaste({ talents: [0, 0] }), rotation, 30 * 14, diving);
    expect(named(off, "early_rogue_wave")).toHaveLength(1);
    expect(off.hits.some((h) => h.hitId.startsWith("riot_"))).toBe(false);
    expect(off.buffs.some((b) => b.id === "whirlpool" && b.expiresAt > off.frame)).toBe(true);
  });
});

describe("Tangtang's kit: potentials", () => {
  const ratio = (rotation: RotationAction[], hitId: string, a: number, b: number) => {
    const x = named(run(noHaste({ potential: a }), rotation, 30 * 12), hitId)[0];
    const y = named(run(noHaste({ potential: b }), rotation, 30 * 12), hitId)[0];
    return (x?.exact ?? NaN) / (y?.exact ?? NaN);
  };

  it("P1: the combo ×1.2; P3: the battle skill's shot and Waterspouts ×1.1; P5: the ultimate ×1.15", () => {
    expect(ratio(opening.slice(0, 2), "jet", 1, 0)).toBeCloseTo(1.2, 5);
    expect(ratio(opening.slice(0, 1), "shot", 3, 2)).toBeCloseTo(1.1, 5);
    expect(ratio(opening.slice(0, 1), "spout1", 3, 2)).toBeCloseTo(1.1, 5);
    expect(ratio([op("ultimate_skill")], "stare", 5, 4)).toBeCloseTo(1.15, 5);
    expect(ratio([op("ultimate_skill")], "rogue_wave", 5, 4)).toBeCloseTo(1.15, 5);
  });
});

describe("Brigand's Calling (wpn_pistol_0011) on Tangtang", () => {
  it("her battle skill's Cryo Infliction gives Cryo DMG +0.56 for 20 s, from the inflicting tick on (before its damage)", () => {
    const s = run(noHaste(), opening.slice(0, 1), 30 * 5);
    expect(fromSource(named(s, "spout1_first")[0], "Brigand's Bane: Cryo DMG")).toEqual([expect.closeTo(0.56, 6)]);
    const buff = s.buffs.find((b) => b.id === "wpn_pistol_0011.cryo_up");
    expect((buff?.expiresAt ?? NaN) - (buff?.appliedAt ?? NaN)).toBe(20 * 30);
    // Basic attacks inflict nothing: no buff.
    expect(run(noHaste(), chain(), 30 * 5).buffs.some((b) => b.id === "wpn_pistol_0011.cryo_up")).toBe(false);
  });

  it("her battle skill's Arts Susceptibility gives the enemy Arts DMG Taken +0.168 for 20 s; one Waterspout (no Susceptibility) gives none", () => {
    const s = run(noHaste(), opening, 30 * 6);
    expect(fromSource(named(s, "spout2").at(-1), "Brigand's Bane: Arts DMG Taken")).toEqual([expect.closeTo(0.168, 6)]);
    const one = run(noHaste(), opening.slice(0, 1), 30 * 5);
    expect(one.buffs.some((b) => b.id === "wpn_pistol_0011.arts_taken")).toBe(false);
  });
});

describe("Artzy Tyrannical (wpn_pistol_0010) on Tangtang", () => {
  const withCrit = (crit: "always" | "never") => ({ ...noHaste(weapon("wpn_pistol_0010")), options: { ...example.options, crit } });

  it("a crit with a battle skill or combo hit: a layer of Cryo DMG +0.392 (30 s each, at most 3, at most one per 0.1 s); basic attacks' crits don't count", () => {
    const s = run(withCrit("always"), opening, 30 * 6);
    const layers = s.buffs.filter((b) => b.id === "wpn_pistol_0010.cryo_up");
    expect(layers).toHaveLength(3);
    expect(layers.every((b) => b.expiresAt - b.appliedAt === 30 * 30)).toBe(true);
    expect(fromSource(named(s, "spout2").at(-1), "Artzy")).toEqual([0.392, 0.392, 0.392].map((v) => expect.closeTo(v, 6)));
    const a = run(withCrit("always"), chain(), 30 * 6);
    expect(a.buffs.some((b) => b.id === "wpn_pistol_0010.cryo_up")).toBe(false);
    const none = run(withCrit("never"), opening, 30 * 6);
    expect(none.buffs.some((b) => b.id === "wpn_pistol_0010.cryo_up")).toBe(false);
  });
});

describe("Clannibal (wpn_pistol_0009) on Wulfgard", () => {
  const W = "chr_0006_wolfgd";
  const wsc = readScenario(new URL("../examples/wulfgard-fluorite.scenario.json", import.meta.url).pathname);
  const wielding: TimelineScenario = { ...wsc, team: wsc.team.map((m) => (m.operator === W ? { ...m, ...weapon("wpn_pistol_0009") } : m)) };

  it("his consumption of Combustion gives the enemy Heat DMG Taken +0.28 for 15 s, once per 25 s", () => {
    const all = run(wielding, wsc.rotation);
    const consumed = all.reactions.filter((r) => r.kind === "statusConsumed" && r.operator === W);
    expect(consumed.length).toBeGreaterThan(0);
    const at = consumed[0]?.frame as number;
    // The rotation's actions up to the consumption, then 5 s on (the buffs are still there to read).
    const s = run(wielding, wsc.rotation.slice(0, all.casts.filter((c) => c.frame <= at).length), at + 5 * 30);
    const taken = s.buffs.filter((b) => b.id === "wpn_pistol_0009.taken_fire");
    expect(taken.length).toBeGreaterThan(0);
    expect(taken.map((b) => b.expiresAt - b.appliedAt)).toEqual(taken.map(() => 15 * 30));
    expect(taken.map((b) => b.appliedAt)).toEqual([at]);
    const after = all.hits.filter((h) => h.operator === W && h.element === "fire" && h.frame > (taken[0]?.appliedAt ?? Infinity) && h.frame < (taken[0]?.expiresAt ?? 0));
    expect(after.length).toBeGreaterThan(0);
    expect(fromSource(after[0], "Vicious Purge: Heat DMG Taken")).toEqual([expect.closeTo(0.28, 6)]);
    const cd = s.buffs.filter((b) => b.id === "wpn_pistol_0009.cd");
    expect(cd.map((b) => b.expiresAt - b.appliedAt)).toEqual(cd.map(() => 25 * 30));
  });

  it("on Tangtang it does nothing: she consumes no reaction", () => {
    const s = run(noHaste(weapon("wpn_pistol_0009")), [...opening, op("ultimate_skill")], 30 * 12);
    expect(s.buffs.some((b) => b.id.startsWith("wpn_pistol_0009."))).toBe(false);
  });
});
