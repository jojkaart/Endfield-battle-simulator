// Avywenna's kit (chr_0012_avywen) and the equipment batch 3 gave her (wpn_lance_0004 Chimeric Justice,
// wpn_lance_0006 Cohesive Traction, wpn_lance_0013 OBJ Razorhorn): the mechanics the kit plan
// (docs/kit-batches/batch-3/chr_0012_avywen.md) says must fire, on the example scenario's build.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type LandedHit, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const A = "chr_0012_avywen";
const P = A + "_";
const example = readScenario(new URL("../examples/avywenna-thunderlances.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: A, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const chain = (at?: number) => ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s, i) => op(s, i === 0 ? at : undefined));

const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames, g: GameData = data): TimelineState => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** The example with Avywenna's build changed. */
const withBuild = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === A ? { ...m, ...b } : m)),
  ...extra,
});
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === A);
const named = (s: TimelineState, hitId: string) => mine(s).filter((h) => h.skillId === P + "normal_skill" && h.hitId === hitId);
const fromSource = (h: LandedHit | undefined, text: string) => (h ? h.modifiers.filter((m) => m.source.includes(text)).map((m) => m.value) : []);
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === A && c.skill === P + skill)[n]?.frame ?? NaN;

// Ultimate (EX lance, talent-2 Susceptibility), battle skill (recalls it: Electric Infliction), a chain whose Final Strike opens the combo.
const opening: RotationAction[] = [op("ultimate_skill"), op("normal_skill"), ...chain(), op("combo_skill")];
// A second chain and combo once the combo's 12 s cooldown is over, while the EX lance's infliction (20 s) still lasts.
const twoCombos: RotationAction[] = [op("ultimate_skill"), op("normal_skill"), ...chain(), op("combo_skill"), ...chain(16.5 * 30), op("combo_skill")];

describe("Avywenna's kit: hits and frames", () => {
  const s = run(example, [...opening, op("normal_skill")], 30 * 10);

  it("each hit lands at its data frame after its cast", () => {
    const rel = (skill: string, hitId: string, n = 0) => mine(s).filter((h) => h.skillId === P + skill && h.hitId === hitId).map((h) => h.frame - castAt(s, skill, n));
    expect(rel("ultimate_skill", "hit")).toEqual([51]);
    expect(rel("combo_skill", "hit")).toEqual([14]);
    expect(rel("attack5", "hit")).toEqual([24]);
    expect(rel("attack4", "hit_2")).toEqual([18]);
    const first = castAt(s, "normal_skill", 0);
    const second = castAt(s, "normal_skill", 1);
    expect(named(s, "lance_ex").map((h) => h.frame - first)).toEqual([7]);
    expect(named(s, "lance").map((h) => h.frame - second)).toEqual([7, 7, 7]);
    expect(named(s, "hit").map((h) => h.frame)).toEqual([first + 18, second + 18]);
  });

  it("the basic attacks are Physical, the skills Electric", () => {
    expect(new Set(mine(s).filter((h) => h.skillId.includes("attack")).map((h) => h.element))).toEqual(new Set(["physical"]));
    expect(new Set(mine(s).filter((h) => !h.skillId.includes("attack")).map((h) => h.element))).toEqual(new Set(["pulse"]));
  });

  it("the combo window opens on the Final Strike against the Electric enemy, and not on a clean one", () => {
    expect(castAt(s, "combo_skill")).toBeGreaterThan(castAt(s, "attack5"));
    expect(() => run(example, [...chain(), op("combo_skill")], 30 * 10)).toThrow(/combo trigger/);
  });
});

describe("Avywenna's kit: Thunderlances", () => {
  it("one returning hit per lance on the field: 1 EX after the ultimate, 3 after a combo, 6 after two; a second recall finds none", () => {
    const one = run(example, [...opening, op("normal_skill"), op("normal_skill")], 30 * 20);
    expect(named(one, "lance_ex")).toHaveLength(1);
    expect(named(one, "lance")).toHaveLength(3);
    // The third battle skill (within the second's window) comes after the recall.
    expect(one.casts.filter((c) => c.skill === P + "normal_skill")).toHaveLength(3);
    const two = run(example, [...twoCombos, op("normal_skill")], 30 * 25);
    expect(named(two, "lance").map((h) => h.frame - castAt(two, "normal_skill", 1))).toEqual([7, 7, 7, 7, 7, 7]);
    expect(two.buffs.some((b) => b.owner === A && (b.id === "thunderlance" || b.id === "thunderlance_ex"))).toBe(false);
  });

  it("lances live 50 s at P2 and up, 30 s below: the example's battle skill at 50 s finds the second combo's three only at P2+", () => {
    const p5 = run(example);
    const late = castAt(p5, "normal_skill", 2);
    expect(late).toBe(50 * 30);
    expect(named(p5, "lance").filter((h) => h.frame > late)).toHaveLength(3);
    const p1 = run(withBuild({ potential: 1 }));
    expect(named(p1, "lance").filter((h) => h.frame > late)).toHaveLength(0);
    const spans = (st: TimelineState) => [...new Set(st.buffs.filter((b) => b.owner === A && b.id === "thunderlance").map((b) => b.expiresAt - b.appliedAt))];
    // The second combo's lances; the first combo's last 10 frames longer: the engine stretches the caster's own buffs over
    // the second combo's slow-down (its first 0.5 s at 1–94% speed).
    expect(spans(run(example, twoCombos, 30 * 25))).toEqual([50 * 30 + 10, 50 * 30]);
    expect(spans(run(withBuild({ potential: 1 }), twoCombos, 30 * 25))).toEqual([30 * 30 + 10, 30 * 30]);
  });

  it("returning EX lances inflict Electric once however many land together (the 0.3 s check)", () => {
    const kit = data.kits.operators[A] as OperatorKit;
    // Two EX lances from one ultimate (a hand-made change), recalled together.
    const g: GameData = {
      ...data,
      kits: { ...data.kits, operators: { ...data.kits.operators, [A]: { ...kit, triggers: kit.triggers.map((t) => (t.id === "ult_lance" ? { ...t, do: [{ kind: "buff", buff: "thunderlance_ex", layers: 2 }] } : t)) } } },
    };
    const s = run(example, [op("ultimate_skill"), op("normal_skill")], 30 * 4, g);
    expect(named(s, "lance_ex")).toHaveLength(2);
    expect(s.enemy.infliction).toMatchObject({ element: "pulse", stacks: 1 });
    // Plain lances inflict nothing: after the combo's three return, still the EX lance's one stack.
    const plain = run(example, [...opening, op("normal_skill")], 30 * 10);
    expect(named(plain, "lance")).toHaveLength(3);
    expect(plain.enemy.infliction).toMatchObject({ element: "pulse", stacks: 1 });
  });
});

describe("Avywenna's kit: talents and potentials", () => {
  /** Energy gained from the battle skill's frame 6 to frame 8 (the returning lances' hits at 7). */
  const lanceEnergy = (b: Partial<Build>) => {
    const sc = withBuild(b);
    const rotation = [op("ultimate_skill"), op("normal_skill")];
    const at = castAt(run(sc, rotation, 30 * 3), "normal_skill");
    return (run(sc, rotation, at + 8).energy[A] ?? 0) - (run(sc, rotation, at + 6).energy[A] ?? 0);
  };

  it("talent 1: talent0_usp energy per returning lance hit, 6 at P1 and up, 4 at P0; nothing with the talent unlearned (even at P1)", () => {
    expect(lanceEnergy({})).toBeCloseTo(6, 6);
    expect(lanceEnergy({ potential: 0 })).toBeCloseTo(4, 6);
    expect(lanceEnergy({ talents: [0, 2] })).toBe(0);
    // The combo and ultimate hits too.
    const s = run(example, opening, 30 * 7);
    const combo = castAt(s, "combo_skill");
    expect((run(example, opening, combo + 15).energy[A] ?? 0) - (run(example, opening, combo + 13).energy[A] ?? 0)).toBeCloseTo(6, 6);
  });

  it("no usp from the combo: with talent 1 unlearned its hit gives nothing", () => {
    const sc = withBuild({ talents: [0, 2] });
    const s = run(sc, opening, 30 * 7);
    const combo = castAt(s, "combo_skill");
    expect((run(sc, opening, combo + 15).energy[A] ?? 0) - (run(sc, opening, combo + 13).energy[A] ?? 0)).toBe(0);
  });

  it("talent 2: the ultimate's own hit already has Electric Susceptibility 0.10 (10 s); unlearned, none", () => {
    const s = run(example, [op("ultimate_skill")], 30 * 3);
    expect(mine(s).find((h) => h.skillId === P + "ultimate_skill")?.zones.susceptibility).toBeCloseTo(1.1, 6);
    const span = s.buffs.filter((b) => b.id === "tactful_approach").map((b) => b.expiresAt - b.appliedAt);
    expect(span).toEqual([10 * 30]);
    const off = run(withBuild({ talents: [2, 0] }), [op("ultimate_skill")], 30 * 3);
    expect(mine(off).find((h) => h.skillId === P + "ultimate_skill")?.zones.susceptibility).toBe(1);
    expect(off.buffs.some((b) => b.id === "tactful_approach")).toBe(false);
  });

  it("P5: returning lances ×1.15 against an Electric Susceptible enemy, the battle skill's own hit not; without Susceptibility no change", () => {
    const rotation = [op("ultimate_skill"), op("normal_skill")];
    const ratio = (b: Partial<Build>, hitId: string) => {
      const p5 = named(run(withBuild(b), rotation, 30 * 4), hitId)[0];
      const p4 = named(run(withBuild({ ...b, potential: 4 }), rotation, 30 * 4), hitId)[0];
      return (p5?.exact ?? NaN) / (p4?.exact ?? NaN);
    };
    expect(ratio({}, "lance_ex")).toBeCloseTo(1.15, 5);
    expect(ratio({}, "hit")).toBeCloseTo(1, 9);
    expect(ratio({ talents: [2, 0] }, "lance_ex")).toBeCloseTo(1, 9);
  });
});

describe("Cohesive Traction (wpn_lance_0006)", () => {
  const traction = (h: LandedHit | undefined) => fromSource(h, "Concentric Circles");

  it("a combo gives the next battle skill Electric DMG +0.28 on all its hits, the returning lances included; then it's used up", () => {
    const s = run(example, [...opening, op("normal_skill"), op("normal_skill")], 30 * 20);
    const [first, second, third] = [0, 1, 2].map((n) => mine(s).filter((h) => h.skillId === P + "normal_skill" && h.frame >= castAt(s, "normal_skill", n) && h.frame < (castAt(s, "normal_skill", n + 1) || Infinity)));
    expect(first?.flatMap(traction)).toEqual([]);
    expect(second?.map((h) => traction(h))).toEqual([[0.28], [0.28], [0.28], [0.28]].map((x) => x.map((v) => expect.closeTo(v, 6))));
    expect(third?.flatMap(traction)).toEqual([]);
  });

  it("a second combo within 30 s adds no layer (the buff's 30 s adding cooldown)", () => {
    const s = run(example, [...twoCombos, op("normal_skill")], 30 * 25);
    const own = named(s, "hit")[1];
    expect(traction(own)).toEqual([expect.closeTo(0.28, 6)]);
  });
});

describe("Chimeric Justice (wpn_lance_0004) and OBJ Razorhorn (wpn_lance_0013) on Estella", () => {
  const E = "chr_0021_whiten";
  const sc = readScenario(new URL("../examples/estella-solidification.scenario.json", import.meta.url).pathname);
  const wielding = (weapon: string): TimelineScenario => ({ ...sc, team: sc.team.map((m) => (m.operator === E ? { ...m, weapon: { id: weapon, level: 90, skillLevels: [9, 9, 9] } } : m)) });
  const hers = (s: TimelineState) => s.hits.filter((h) => h.operator === E);

  it("Chimeric Justice: ATK +42% for 15 s when she adds Vulnerable to an enemy with none (her combo's Lift), not at 1 → 2 (her ultimate's)", () => {
    const s = run(wielding("wpn_lance_0004"));
    const vuln = s.reactions.filter((r) => r.kind === "vulnerable" && r.operator === E);
    expect(vuln.map((r) => (r.kind === "vulnerable" ? r.before : NaN))).toEqual([0, 1]);
    expect(s.triggerState[`${E}:wpn_lance_0004.first_vulnerable`]?.count).toBe(1);
    const after = hers(s).filter((h) => h.frame > (vuln[0]?.frame ?? Infinity));
    expect(after.length).toBeGreaterThan(0);
    expect(fromSource(after.at(-1), "Cemented Fury")).toEqual([expect.closeTo(0.42, 6)]);
    expect(hers(s).filter((h) => h.frame < (vuln[0]?.frame ?? 0)).flatMap((h) => fromSource(h, "Cemented Fury"))).toEqual([]);
  });

  it("Chimeric Justice on Avywenna does nothing: she applies no Vulnerable", () => {
    const s = run(withBuild({ weapon: { id: "wpn_lance_0004", level: 90, skillLevels: [9, 9, 9] } }));
    expect(s.triggerState[`${A}:wpn_lance_0004.first_vulnerable`]).toBeUndefined();
  });

  it("OBJ Razorhorn: DMG +22.4% against the Solidified enemy, on the hit that Solidifies too (C1); ATK +33.6% from her Shatter on", () => {
    const s = run(wielding("wpn_lance_0013"));
    const solid = s.reactions.find((r) => r.kind === "reaction" && r.status === "solidification" && r.operator === E);
    const shatter = s.reactions.find((r) => r.kind === "shatter" && r.operator === E);
    expect(solid && shatter).toBeTruthy();
    const dmg = (h: LandedHit) => fromSource(h, "Conquest of Icy Peaks (DMG");
    // Before the Solidification (Gilberta's Nature only): no bonus; the Solidifying battle-skill hit has it.
    expect(hers(s).filter((h) => h.frame < (solid?.frame ?? 0)).flatMap(dmg)).toEqual([]);
    const solidifying = hers(s).find((h) => h.frame === solid?.frame && h.skillId === "chr_0021_whiten_normal_skill");
    expect(solidifying && dmg(solidifying)).toEqual([expect.closeTo(0.224, 6)]);
    const atk = (h: LandedHit) => fromSource(h, "Conquest of Icy Peaks (ATK");
    expect(hers(s).filter((h) => h.frame < (shatter?.frame ?? 0)).flatMap(atk)).toEqual([]);
    expect(atk(hers(s).at(-1) as LandedHit)).toEqual([expect.closeTo(0.336, 6)]);
  });
});
