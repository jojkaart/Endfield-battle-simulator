// Estella's kit (chr_0021_whiten) and Valiant's (wpn_lance_0010): the mechanics the kit plan
// (docs/kit-batches/batch-1/chr_0021_whiten.md, pass 3) says must fire, on the example scenario's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const E = "chr_0021_whiten";
const P = E + "_";
const G = "chr_0013_aglina";
const example = readScenario(new URL("../examples/estella-solidification.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: E, skill: P + skill, ...(at !== undefined ? { at } : {}) });

/**
 * The example's team with Estella changed; no gear on her, and Gilberta's talent 1 (Messenger's Song, +Ultimate Gain
 * Efficiency for the team) off, so energy grants are unscaled (Ultimate Gain Efficiency 1).
 */
const scenario = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === E ? { ...m, gear: [], ...b } : m.operator === G ? { ...m, talents: [0, ...(m.talents ?? [1, 1]).slice(1)] } : m)),
  durationFrames: 30 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
// Gilberta's battle skill inflicts Nature; Estella's at frame 111 adds Cryo: Solidification at its hit (frame 132).
const opening: RotationAction[] = [{ operator: G, skill: "chr_0013_aglina_normal_skill" }, op("normal_skill", 111)];
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === E);

describe("Estella's kit", () => {
  it("a combo on a Solidified enemy: one combo hit, one Lift, one Shatter, one Valiant hit and 10 energy, under her own Susceptibility", () => {
    const sc = scenario({ potential: 0 });
    const before = run(sc, [...opening, op("combo_skill")], 150);
    const s = run(sc, [...opening, op("combo_skill")], 160);
    const combo = s.casts.find((c) => c.skill === P + "combo_skill");
    const at = (combo?.frame ?? NaN) + 19;
    const there = mine(s).filter((h) => h.frame === at);
    expect(there.map((h) => `${h.skillId} ${h.hitId}`).sort()).toEqual(
      [`${P}combo_skill solidified`, "reaction:lift physical:1", "reaction:shatter physical:1", "sk_wpn_lance_0010 hit"].sort(),
    );
    expect(there.every((h) => Math.abs(h.zones.susceptibility - 1.15) < 1e-6)).toBe(true);
    expect((s.energy[E] ?? 0) - (before.energy[E] ?? 0)).toBeCloseTo(10, 6);
    expect(s.reactions.filter((r) => r.kind === "shatter")).toHaveLength(1);
  });

  it("a combo after Solidification ran out lands the other branch: Lift and Valiant, no Shatter, no Susceptibility; the ultimate then doesn't Lift", () => {
    const s = run(scenario({}, { startEnergy: { [E]: "full" } }), [...opening, op("combo_skill", 132 + 176), op("ultimate_skill")]);
    expect(mine(s).filter((h) => h.skillId === P + "combo_skill").map((h) => h.hitId)).toEqual(["not_solidified"]);
    expect(s.reactions.some((r) => r.kind === "shatter")).toBe(false);
    expect(s.reactions.filter((r) => r.kind === "physical").length).toBe(1);
    expect(mine(s).filter((h) => h.skillId === "sk_wpn_lance_0010")).toHaveLength(1);
    expect(mine(s).every((h) => h.zones.susceptibility === 1)).toBe(true);
  });

  it("the ultimate Lifts an enemy under Physical Susceptibility; the Susceptibility lasts 9 s from P1 and 6 s below, plus her own ultimate's time stop", () => {
    const rotation = [...opening, op("combo_skill"), op("ultimate_skill")];
    const p5 = run(scenario({}, { startEnergy: { [E]: "full" } }), rotation, 260);
    const ult = p5.casts.find((c) => c.skill === P + "ultimate_skill")?.frame ?? NaN;
    expect(mine(p5).filter((h) => h.frame === ult + 54).map((h) => h.skillId).sort()).toEqual([P + "ultimate_skill", "reaction:lift", "sk_wpn_lance_0010"].sort());
    const span = (s: TimelineState) => s.buffs.filter((b) => b.id === "physical_susceptibility").map((b) => b.expiresAt - b.appliedAt);
    // The engine freezes the caster's own buffs during her 54-frame time stop (in-game test 18).
    expect(span(p5)).toEqual([9 * 30 + 54]);
    expect(span(run(scenario({ potential: 0 }, { startEnergy: { [E]: "full" } }), rotation, 260))).toEqual([6 * 30 + 54]);
  });

  it("talent 1: a Shatter gives the stack; the next battle skill returns 15 SP at frame 21 and uses it", () => {
    const s = run(scenario({}), [...opening, op("combo_skill"), op("normal_skill")]);
    expect(s.spReturned).toBe(15);
    expect(s.stacks[E]?.commiseration).toBe(0);
    const unlearned = run(scenario({ talents: [0, 2] }), [...opening, op("combo_skill"), op("normal_skill")]);
    expect(unlearned.spReturned).toBe(0);
  });

  it("talent 1: a battle skill cut short before frame 21 returns no SP and keeps the stack", () => {
    const sc = scenario({}, { startEnergy: { [E]: "full" }, startStacks: { [E]: { commiseration: 1 } } });
    const whole = run(sc, [op("normal_skill")]);
    expect(whole.spReturned).toBe(15);
    expect(whole.stacks[E]?.commiseration).toBe(0);
    const cut = run(sc, [op("normal_skill"), op("ultimate_skill", 10)]);
    expect(cut.spReturned).toBe(0);
    expect(cut.stacks[E]?.commiseration).toBe(1);
    expect(mine(cut).some((h) => h.skillId === P + "normal_skill")).toBe(false);
  });

  it("P5: 5 energy on a Solidification", () => {
    const at = (b: Partial<Build>) => run(scenario(b), opening, 140).energy[E] ?? 0;
    expect(at({}) - at({ potential: 4 })).toBeCloseTo(5, 6);
  });
});
