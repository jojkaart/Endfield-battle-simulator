// Xaihi's kit (chr_0011_seraph) and the equipment kits of her batch-3 report (Freedom to Proselytize, OBJ Arts
// Identifier, AIC Light): the mechanics the kit plan (docs/kit-batches/batch-3/chr_0011_seraph.md) says must fire,
// on the example scenario's builds.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const X = "chr_0011_seraph";
const S = "chr_0036_jsspsi";
const L = "chr_0016_laevat";
// Kit mechanics on the example's rotation alone: teammates' own attacks off (accuracy plan B0; tests/teammates.test.ts).
const example = ((sc) => ({ ...sc, options: { ...sc.options, teammateAttacks: false } }))(readScenario(new URL("../examples/xaihi-si.scenario.json", import.meta.url).pathname));
const laevatain = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const act = (operator: string) => (skill: string, at?: number): RotationAction => ({ operator, skill: skill === "swap" ? "swap" : `${operator}_${skill}`, ...(at !== undefined ? { at } : {}) });
const op = act(X);
const chain = (who: (skill: string, at?: number) => RotationAction, at?: number): RotationAction[] =>
  ["attack1", "attack2", "attack3", "attack4", "attack5"].map((k, i) => who(k, i === 0 ? at : undefined));

/** The example's team (Xaihi, Si) with Xaihi's build changed, 60 s, no rotation of its own. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === X ? { ...m, ...b } : m)),
  durationFrames: 60 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const castAt = (s: TimelineState, operator: string, skill: string, n = 0) => s.casts.filter((c) => c.operator === operator && c.skill === `${operator}_${skill}`)[n]?.frame ?? NaN;
const hitsOf = (s: TimelineState, operator: string, skill: string) => s.hits.filter((h) => h.operator === operator && h.skillId === `${operator}_${skill}`);
const from = (h: LandedHit | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label)).map((m) => m.value);
const fired = (s: TimelineState, trigger: string, owner = X) =>
  Object.entries(s.triggerState).filter(([k]) => k === `${owner}:${trigger}` || k.startsWith(`${owner}:${trigger}:`)).reduce((n, [, v]) => n + v.count, 0);
const crystal = (s: TimelineState) => s.buffs.find((b) => b.owner === X && b.id === "crystal" && b.expiresAt > s.frame);
const AMP = "Auxiliary Crystal";
const ULT = "Stack Overflow";
const T1 = "Execute Process";
const OBJ = "OBJ Arts Identifier";

describe("Xaihi's kit", () => {
  it("basic attacks: projectile landings at their launch frames (attack4 twice, equal), attack5 one Final Strike at 19", () => {
    const s = run(scenario(), chain(op));
    const frames = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((k) => hitsOf(s, X, k).map((h) => h.frame - castAt(s, X, k)));
    expect(frames).toEqual([[10], [7], [8], [7, 12], [19]]);
    const a4 = hitsOf(s, X, "attack4");
    expect(a4[0]?.damage).toBeCloseTo(a4[1]?.damage ?? NaN, 6);
  });

  it("battle skill: no damage; the crystal (20 s) and the team energy come at frame 37; her ultimate before then cuts both", () => {
    const sc = scenario({}, { startEnergy: {} });
    const before = run(sc, [op("normal_skill")], 36);
    expect(crystal(before)).toBeUndefined();
    expect(before.energy[S] ?? 0).toBe(0);
    const after = run(sc, [op("normal_skill")], 38);
    expect([crystal(after)?.appliedAt, crystal(after)?.expiresAt]).toEqual([37, 37 + 20 * 30]);
    // 100 SP × 0.065 per natural SP, to the whole team.
    expect(after.energy[S]).toBeCloseTo(6.5, 6);
    expect(hitsOf(after, X, "normal_skill")).toEqual([]);
    const cut = run(scenario({}, { startEnergy: { [X]: "full" } }), [op("normal_skill"), op("ultimate_skill", 10)], 60);
    expect(crystal(cut)).toBeUndefined();
    expect(cut.energy[S] ?? 0).toBe(0);
  });

  describe("the example (crystal, combo, ultimate, second crystal)", () => {
    const s = run(example);
    const siFs = hitsOf(s, S, "attack5");

    it("each controlled operator's Final Strike under the crystal is a treatment with Arts Amp 0.20 (0.15 + P1 0.05) on that operator, once per 0.3 s each", () => {
      expect(Object.keys(s.triggerState).filter((k) => k.startsWith(`${X}:crystal_heal:`)).sort()).toEqual([`${X}:crystal_heal:${X}`, `${X}:crystal_heal:${S}`]);
      expect(fired(s, "crystal_heal")).toBe(4);
      // Xaihi's first combo has her own Amp (her Final Strike); Si's first chain has none until her Final Strike.
      expect(from(hitsOf(s, X, "combo_skill")[0], AMP)).toEqual([expect.closeTo(0.2, 6)]);
      expect(from(hitsOf(s, S, "attack1")[0], AMP)).toEqual([]);
      expect(from(hitsOf(s, S, "normal_skill")[0], AMP)).toEqual([expect.closeTo(0.2, 6)]);
      // The Amp counts on every Arts element: one modifier, zone amp.
      expect(hitsOf(s, S, "normal_skill")[0]?.modifiers.find((m) => m.source.includes(AMP))?.zone).toBe("amp");
    });

    it("the second treatment opens the combo window at that Final Strike and uses the crystal up; a Final Strike after it heals no more", () => {
      const fs2 = siFs[0]?.frame ?? NaN;
      expect(castAt(s, X, "combo_skill")).toBe(Math.round(7.7 * 30));
      expect(fired(s, "crystal_used_up")).toBe(2);
      // No crystal between the first combo and the second battle skill: Si's second Final Strike isn't a treatment,
      // her third and fourth (under the second crystal) are, her fifth (crystal used up) isn't.
      expect(siFs).toHaveLength(5);
      expect(fired(s, "crystal_heal", X) - (s.triggerState[`${X}:crystal_heal:${X}`]?.count ?? 0)).toBe(3);
      expect(siFs[1]?.frame).toBeLessThan(castAt(s, X, "normal_skill", 1) + 37);
      expect(s.triggerState[`${X}:crystal_heal:${S}`]?.readyAt).toBe((siFs[3]?.frame ?? NaN) + 9);
      expect(castAt(s, X, "combo_skill", 1)).toBeGreaterThanOrEqual(siFs[3]?.frame ?? NaN);
      expect(fs2).toBeLessThanOrEqual(castAt(s, X, "combo_skill"));
    });

    it("combo: a plain hit on a clean enemy; on a Cryo-inflicted one talent 1's Cryo DMG Taken 0.10 counts on that hit, and its burst lands a second later", () => {
      const [first, second] = hitsOf(s, X, "combo_skill");
      expect([first?.hitId, second?.hitId]).toEqual(["plain", "vs_cryo"]);
      expect(first && first.frame - castAt(s, X, "combo_skill")).toBe(24);
      expect(from(first, T1)).toEqual([]);
      expect(from(second, T1)).toEqual([expect.closeTo(0.1, 6)]);
      const burst = s.reactions.find((r) => r.kind === "burst" && r.operator === X);
      expect(burst?.frame).toBe((second?.frame ?? NaN) + (data.constants.burstDelayFrames?.cryst ?? NaN));
      // The debuff lasts 5 s: Si's Final Strike 96 frames later still has it.
      expect(from(siFs[4], T1)).toEqual([expect.closeTo(0.1, 6)]);
    });

    it("ultimate (P5): team Cryo and Nature Amp atk_up + min(Intellect × wisd_up, wisd_max) = 0.264 + min(INT × 0.00033, 0.396) from frame 58, 12 s", () => {
      const ctx = createContext(data, example);
      const int = ctx.panels.get(X)?.attrs[41]?.total ?? NaN;
      const want = 0.264 + Math.min(int * 0.00033, 0.396);
      const ult = castAt(s, X, "ultimate_skill");
      const under = s.hits.filter((h) => h.frame >= ult + 58 && h.frame < ult + 58 + 12 * 30);
      expect(under.length).toBeGreaterThan(5);
      for (const h of under) expect(from(h, ULT)).toEqual([expect.closeTo(want, 6)]);
      expect(s.hits.filter((h) => h.frame < ult + 58 && from(h, ULT).length > 0)).toEqual([]);
      expect(from(siFs[4], ULT)).toEqual([]);
      // 12 s of world time: alone, from frame 58 to 418 (in the example the combos' global slow-downs stretch it a little).
      const alone = run(scenario({}, { startEnergy: { [X]: "full" } }), [op("ultimate_skill")], 100).buffs.find((b) => b.id === "stack_overflow");
      expect([alone?.appliedAt, alone?.expiresAt, alone?.recipients]).toEqual([58, 58 + 12 * 30, undefined]);
    });

    it("OBJ Arts Identifier: the combo's burst gives the team its buff (no Heat or Electric hit here to show it)", () => {
      expect(fired(s, "wpn_funnel_0014.combo_burst")).toBe(1);
    });
  });

  it("potentials: below P1 the crystal's Amp is 0.15; below P5 the ultimate is 0.24 + min(INT × 0.0003, 0.36); below P2 it costs 80 energy (72 at P2)", () => {
    const rot = [op("normal_skill"), ...chain(op), op("ultimate_skill", 150), ...chain(op, 250)];
    const p0 = run(scenario({ potential: 0 }), rot);
    const atk = hitsOf(p0, X, "attack1")[1];
    expect(from(atk, AMP)).toEqual([expect.closeTo(0.15, 6)]);
    const int = createContext(data, scenario({ potential: 0 })).panels.get(X)?.attrs[41]?.total ?? NaN;
    expect(from(atk, ULT)).toEqual([expect.closeTo(0.24 + Math.min(int * 0.0003, 0.36), 6)]);
    const full = (potential: number) => run(scenario({ potential }, { startEnergy: { [X]: "full" } }), [], 1).energy[X];
    expect([full(1), full(2)]).toEqual([expect.closeTo(80, 4), expect.closeTo(72, 4)]);
  });

  it("talent 1: unlearned, the combo on a Cryo-inflicted enemy is the plain hit; at level 1 Cryo DMG Taken is 0.07", () => {
    const rot = [op("normal_skill"), ...chain(op), ...chain(op), op("combo_skill"), op("normal_skill", 320), ...chain(op), ...chain(op), op("combo_skill")];
    const second = (talents: readonly number[]) => hitsOf(run(scenario({ talents }), rot), X, "combo_skill")[1];
    expect(second([2, 1])?.hitId).toBe("vs_cryo");
    expect(from(second([1, 1]), T1)).toEqual([expect.closeTo(0.07, 6)]);
    expect(second([0, 1])?.hitId).toBe("plain");
  });

  it("interim U3: a second battle skill replaces the crystal and resets its count; interim U2: the count doesn't expire (Final Strikes 12 s apart open the combo)", () => {
    const window = (s: TimelineState) => s.comboWindow[X];
    // One Final Strike, a new crystal, one more: still one treatment short.
    const replaced = run(scenario(), [op("normal_skill"), ...chain(op), op("normal_skill", 200), ...chain(op)], 400);
    expect(fired(replaced, "crystal_heal")).toBe(2);
    expect(window(replaced)).toBeUndefined();
    expect(fired(replaced, "crystal_used_up")).toBe(0);
    const apart = run(scenario(), [op("normal_skill"), ...chain(op), ...chain(op, 121 + 12 * 30)], 121 + 12 * 30 + 140);
    expect(fired(apart, "crystal_used_up")).toBe(1);
  });

  it("the crystal lasts 20 s: a first Final Strike 21 s after the battle skill is no treatment", () => {
    const s = run(scenario(), [op("normal_skill"), ...chain(op, 21 * 30)], 21 * 30 + 140);
    expect(hitsOf(s, X, "attack5")).toHaveLength(1);
    expect(fired(s, "crystal_heal")).toBe(0);
  });
});

describe("Xaihi's equipment kits", () => {
  it("OBJ Arts Identifier: her combo's Arts Burst gives the team Heat and Electric DMG +dmg_up (0.224 at skill level 9) for 15 s; one stack group across wielders", () => {
    const sc = scenario({}, { team: [example.team[0] as Build, laevatain] });
    const lv = act(L);
    const rot = [op("normal_skill"), ...chain(op), ...chain(op), op("combo_skill"), op("normal_skill", 320), ...chain(op), ...chain(op), op("combo_skill"), lv("swap"), ...chain(lv)];
    const s = run(sc, rot);
    const burst = s.reactions.find((r) => r.kind === "burst" && r.operator === X);
    expect(burst).toBeDefined();
    const laev = s.hits.filter((h) => h.operator === L);
    expect(laev.length).toBeGreaterThan(0);
    for (const h of laev) expect(from(h, OBJ)).toEqual(h.frame > (burst?.frame ?? NaN) && h.frame <= (burst?.frame ?? NaN) + 15 * 30 ? [expect.closeTo(0.224, 6)] : []);
    expect(laev.some((h) => from(h, OBJ).length > 0)).toBe(true);
    // Its game buff is stackingType 11 with a priority key and one instance: the loader groups it (batch 3 B2).
    expect(data.kits.equipment.wpn_funnel_0014?.buffs.map((b) => b.stackGroup)).toEqual(["buff_wpn_funnel_0014_up"]);
  });

  it("Freedom to Proselytize and AIC Light declare nothing (operator HP and kills aren't simulated: N2)", () => {
    for (const id of ["wpn_funnel_0012", "suit_wisdwill01"]) {
      const kit = data.kits.equipment[id];
      expect(kit).toBeDefined();
      expect([kit?.buffs.length, kit?.triggers.length]).toEqual([0, 0]);
    }
    const gear = ["body_01", "hand_01", "edc_01"].map((p) => ({ id: `item_equip_t1_suit_wisdwill01_${p}`, artifice: [0, 0, 0] as const }));
    const s = run(scenario({ weapon: { id: "wpn_funnel_0012", level: 90, skillLevels: [9, 9, 9] }, gear }), [op("normal_skill"), ...chain(op)]);
    expect(fired(s, "crystal_heal")).toBe(1);
  });
});
