// Yvonne's kit (chr_0017_yvonne) and the equipment kits of her batch-4 report (Navigator, Home Longing, Wedge):
// the mechanics the kit plan (docs/kit-batches/batch-4/chr_0017_yvonne.md) says must fire, on the example
// scenario's builds (examples/yvonne-fluorite.scenario.json).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const Y = "chr_0017_yvonne";
const F = "chr_0022_bounda";
const E = "chr_0021_whiten";
const example = readScenario(new URL("../examples/yvonne-fluorite.scenario.json", import.meta.url).pathname);
const estellaExample = JSON.parse(readFileSync(new URL("../examples/estella-solidification.scenario.json", import.meta.url), "utf8")) as { team: Build[] };
const estella = estellaExample.team.find((b) => b.operator === E) as Build;
const act = (operator: string) => (skill: string, at?: number): RotationAction => ({ operator, skill: skill === "swap" ? "swap" : `${operator}_${skill}`, ...(at !== undefined ? { at } : {}) });
const y = act(Y);
const f = act(F);
const e = act(E);

/** The example's team (Yvonne, Fluorite) with Yvonne's build changed, 40 s, no energy, no rotation of its own. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === Y ? { ...m, ...b } : m)),
  startEnergy: {},
  durationFrames: 40 * 30,
  ...extra,
});
const full = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}) => scenario(b, { startEnergy: { [Y]: "full" }, ...extra });
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === Y && c.skill === `${Y}_${skill}`)[n]?.frame ?? NaN;
const hitsOf = (s: TimelineState, skill: string) => s.hits.filter((h) => h.operator === Y && h.skillId === `${Y}_${skill}`);
const from = (h: LandedHit | undefined, label: string, zone?: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label) && (zone === undefined || m.zone === zone)).map((m) => m.value);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const scale = (h: LandedHit | undefined) => (h?.scaleParts ?? []).reduce((a, p) => a + p.value, 0);
const startError = (sc: TimelineScenario, rotation: readonly RotationAction[], next: RotationAction) => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return earliestStart(ctx, s, next);
};
const myBuff = (s: TimelineState, id: string) => s.buffs.filter((b) => b.owner === Y && b.id === id && b.appliedAt <= s.frame && b.expiresAt > s.frame);
const chain = ["attack1", "attack2", "attack3", "attack4"];
/** Fluorite's battle skill (Nature at its frame 99), then Yvonne's at frame 105: the bomb (frame 140) consumes 1 stack and Solidifies. */
const solidify: RotationAction[] = [f("normal_skill"), y("normal_skill", 105)];
const BOMB = 140;
const FP = "Freezing Point";
const BARRAGE = "Barrage of Technology";
const LAYERS = "Ultimate layers";
const STATE = "Cryoblasting Pistolier";
const END = "end state";
const NAV = "Navigator";

describe("Yvonne's kit", () => {
  it("basic attacks: one landing per projectile at its launch frame; attack5 only after attack4 (from its frame 24), at frame 21, a Final Strike with 17 Stagger and 17 SP when controlled", () => {
    const sc = scenario();
    const s = run(sc, [...chain.map((k) => y(k)), y("attack5")]);
    expect([...chain, "attack5"].map((k) => hitsOf(s, k).map((h) => h.frame - castAt(s, k)))).toEqual([[11], [11, 14], [6, 9, 12], [11], [21]]);
    // attack4's TogglableAction window (0-24) needs the talent-1 buff: closed, so attack5 waits for the plain window at 24.
    expect(castAt(s, "attack5") - castAt(s, "attack4")).toBe(24);
    // attack1's window 0-27 lists attack5, but its input mapping (ComboCacheAction) is attack2 only.
    expect(startError(sc, [y("attack1")], y("attack5"))).toHaveProperty("error");
    expect(startError(sc, [], y("attack5"))).toHaveProperty("error");
    // atk_scale 1.26 at level 12; Stagger 17 (controlled only) and SP 17 at the Final Strike.
    const fs = hitsOf(s, "attack5")[0];
    expect(scale(fs)).toBeCloseTo(1.26, 6);
    const before = run(sc, [...chain.map((k) => y(k)), y("attack5")], castAt(s, "attack5") + 20);
    const after = run(sc, [...chain.map((k) => y(k)), y("attack5")], castAt(s, "attack5") + 21);
    expect(before.stagger.poise - after.stagger.poise).toBeCloseTo(17, 6);
    expect(after.sp - before.sp).toBeCloseTo(17 + 8 / 30, 6);
    // Swapped out, attack5 can't be cast (basic attacks need control): the controlled-only parts aren't reachable otherwise.
  });

  it("finisher: the projectile at 8 (0.1) and the hit at 28 (0.9) of atk_scale 9.0", () => {
    const p = data.kits.operators[Y]?.skills.find((x) => x.skillId === `${Y}_power_attack`);
    expect(p?.hits.map((h) => [h.frames, h.factor])).toEqual([[[8], 0.1], [[28], 0.9]]);
  });

  describe("battle skill", () => {
    it("on an enemy without Cryo or Nature Infliction: the bomb at frame 35 deals atk_scale (2.5), applies nothing and gives only the team energy", () => {
      const s = run(scenario(), [y("normal_skill")]);
      const bomb = hitsOf(s, "normal_skill");
      expect(bomb.map((h) => [h.hitId, h.frame])).toEqual([["bomb", 35]]);
      expect(scale(bomb[0])).toBeCloseTo(2.5, 6);
      expect(s.reactions).toEqual([]);
      // 100 SP × 0.065 per natural SP spent, at the bomb (frame 35).
      expect(s.energy[Y]).toBeCloseTo(6.5, 6);
      expect(run(scenario(), [y("normal_skill")], 34).energy[Y] ?? 0).toBe(0);
    });

    it("on Nature Infliction: consumes it, forces Solidification at the consumed level before the damage; atk_scale + atk_scale2 + n × atk_scale_layer, energy usp_base + n × usp_layer", () => {
      const one = run(scenario(), solidify);
      expect(one.reactions.filter((r) => r.operator === Y).map((r) => [r.kind, r.frame, r.kind === "reaction" ? r.level : r.kind === "consumed" ? r.stacks : null])).toEqual([
        ["consumed", BOMB, 1],
        ["reaction", BOMB, 1],
      ]);
      expect(scale(hitsOf(one, "normal_skill")[0])).toBeCloseTo(2.5 + 1.5 + 2.0, 6);
      expect(one.energy[Y]).toBeCloseTo(13 + 10 + 30, 6);
      // Two Nature stacks (Fluorite's battle skill twice): level 2, 2.5 + 1.5 + 4.0, energy 10 + 60.
      const two = run(scenario(), [f("normal_skill"), f("normal_skill", 100), y("normal_skill", 520)]);
      const cast = castAt(two, "normal_skill");
      expect(two.reactions.filter((r) => r.operator === Y && r.kind === "reaction").map((r) => [r.frame - cast, r.kind === "reaction" ? r.level : 0])).toEqual([[35, 2]]);
      expect(scale(hitsOf(two, "normal_skill")[0])).toBeCloseTo(2.5 + 1.5 + 4.0, 6);
      expect(two.energy[Y]).toBeCloseTo(19.5 + 10 + 60, 6);
      // The bomb sees the Solidification it forces: talent 2's doubled Crit DMG (status_up 0.4 + P3 0.2).
      expect(from(hitsOf(one, "normal_skill")[0], FP)).toEqual([expect.closeTo(0.6, 6)]);
    });

    it("P4: 10 SP returned when the bomb hits (one enemy); not below P4", () => {
      const sp = (p: number) => {
        const sc = scenario({ potential: p });
        return run(sc, [y("normal_skill")], 35).sp - run(sc, [y("normal_skill")], 34).sp;
      };
      expect(sp(4) - sp(3)).toBeCloseTo(10, 6);
    });

    it("the bomb is detached: her next action (even the ultimate at frame 10) doesn't drop it", () => {
      const s = run(full(), [y("normal_skill"), y("ultimate_skill", 10)]);
      expect(hitsOf(s, "normal_skill").length).toBe(1);
    });
  });

  describe("talent 1 (Barrage of Technology)", () => {
    it("after her battle skill Solidifies, the next basic attack is attack5 (a chain head), DMG +0.5, opening her combo; other basic attacks can't start", () => {
      const sc = scenario();
      expect(startError(sc, solidify, y("attack1", BOMB + 1))).toHaveProperty("error");
      const s = run(sc, [...solidify, y("attack5", BOMB + 1)]);
      expect(castAt(s, "attack5")).toBe(BOMB + 1);
      const fs = hitsOf(s, "attack5")[0];
      expect(from(fs, BARRAGE, "damageBonus")).toEqual([expect.closeTo(0.5, 6)]);
      // Consumed by that cast: gone after it, and the next attack is attack1 again.
      expect(myBuff(advance(createContext(data, sc), s, s.frame), "barrage")).toEqual([]);
      expect(s.comboWindow[Y]).toBeDefined();
      const next = run(sc, [...solidify, y("attack5", BOMB + 1), y("attack1")]);
      expect(hitsOf(next, "attack1").length).toBe(1);
    });

    it("needs talent 1 and her battle skill's own Solidification: not without the talent, not on a clean enemy", () => {
      expect(startError(scenario({ talents: [0, 2] }), solidify, y("attack5", BOMB + 1))).toHaveProperty("error");
      expect(startError(scenario(), [y("normal_skill")], y("attack5", 36))).toHaveProperty("error");
    });
  });

  it("talent 2 (Freezing Point): Crit DMG +inflict_up (0.3 at P5) on a Cryo-inflicted enemy, +status_up (0.6) on a Solidified one, nothing on a clean one", () => {
    const sc = scenario();
    const clean = run(sc, [y("attack1")]);
    expect(from(hitsOf(clean, "attack1")[0], FP)).toEqual([]);
    // Estella's battle skill on a clean enemy: Cryo Infliction.
    const cryo = run(scenario({}, { team: [...scenario().team.filter((b) => b.operator === Y), estella] }), [e("normal_skill"), y("attack1", 30)], 60);
    expect(cryo.enemy.infliction?.element).toBe("cryst");
    expect(from(hitsOf(cryo, "attack1")[0], FP)).toEqual([expect.closeTo(0.3, 6)]);
    const solid = run(sc, [...solidify, y("attack5", BOMB + 1)]);
    expect(from(hitsOf(solid, "attack5")[0], FP)).toEqual([expect.closeTo(0.6, 6)]);
    // P2 (below P3): 0.4 Solidified.
    expect(from(hitsOf(run(scenario({ potential: 2 }), [...solidify, y("attack5", BOMB + 1)]), "attack5")[0], FP)).toEqual([expect.closeTo(0.4, 6)]);
  });

  describe("combo skill", () => {
    const opened = [...solidify, y("attack5", BOMB + 1), y("combo_skill")];

    it("COMBO TRIGGER: a Final Strike on a Solidified enemy opens it; a Final Strike on a clean one doesn't", () => {
      expect(run(scenario(), opened).casts.some((c) => c.skill === `${Y}_combo_skill`)).toBe(true);
      expect(startError(scenario(), [...chain.map((k) => y(k)), y("attack5")], y("combo_skill"))).toHaveProperty("error");
    });

    it("P1+: ticks at 19, then every 0.5 s (6 in all), the explosion at 124 forcing Solidification level 1 (+2 s); energy usp + usp_extra (10 + 25) at the first tick", () => {
      const s = run(scenario(), opened);
      const c = castAt(s, "combo_skill");
      expect(hitsOf(s, "combo_skill").map((h) => [h.hitId, h.frame - c])).toEqual([
        ["tick1", 19],
        ["ticks_p1", 34],
        ["ticks_p1", 49],
        ["ticks_p1", 64],
        ["ticks_p1", 79],
        ["ticks_p1", 94],
        ["explosion", 124],
      ]);
      const boom = s.reactions.find((r) => r.kind === "reaction" && r.frame === c + 124);
      expect(boom).toMatchObject({ status: "solidification", level: 1, consumed: null });
      const at = (frame: number) => run(scenario(), opened, frame).energy[Y] ?? 0;
      expect(at(c + 19) - at(c + 18)).toBeCloseTo(35, 6);
      expect(at(c + 124) - at(c + 123)).toBeCloseTo(0, 6);
    });

    it("P0: four ticks 0.75 s apart (19, 42, 64, 87), first-tick energy 10 + 10", () => {
      const sc = scenario({ potential: 0 });
      const s = run(sc, opened);
      const c = castAt(s, "combo_skill");
      expect(hitsOf(s, "combo_skill").map((h) => h.frame - c)).toEqual([19, 42, 64, 87, 124]);
      const at = (frame: number) => run(sc, opened, frame).energy[Y] ?? 0;
      expect(at(c + 19) - at(c + 18)).toBeCloseTo(20, 6);
    });
  });

  describe("ultimate", () => {
    const sc = full();
    const ult = [y("ultimate_skill"), y("ult_attack1_1"), y("ult_attack2_1"), y("ult_attack2_2"), y("ult_attack3_1"), y("ult_attack3_2"), y("ult_attack3_2")];
    const s = run(sc, ult);
    const u = castAt(s, "ultimate_skill");
    const state = run(sc, ult.slice(0, 1), u + 62).buffs.find((b) => b.owner === Y && b.id === "ult_state");
    const stateEnd = state?.expiresAt ?? NaN;

    it("the state starts at frame 61 for 7 s: the basic-attack input is the enhanced chain (attack1 can't start), and it blocks energy", () => {
      const st = state;
      expect([(st?.appliedAt ?? NaN) - u, (st?.expiresAt ?? NaN) - (st?.appliedAt ?? NaN)]).toEqual([61, 7 * 30]);
      expect(castAt(s, "ult_attack1_1") - u).toBe(64);
      expect(startError(sc, [y("ultimate_skill")], y("attack1", 70))).toHaveProperty("error");
      expect(startError(sc, [], y("ult_attack1_1"))).toHaveProperty("error");
      expect(st?.blocksEnergy).toBe(true);
    });

    it("enhanced shots: 3, 4, 4, 8, 8 projectiles of atk_scale 0.2; a layer with each launch (not 2_1's 4th nor 2_2's 4th): Crit Rate +0.03 each, Crit DMG +0.06 each from 10 layers; P5 ATK +0.1 and Crit DMG +0.3", () => {
      const shots = ["ult_attack1_1", "ult_attack2_1", "ult_attack2_2", "ult_attack3_1"].map((k) => hitsOf(s, k).length);
      expect(shots).toEqual([3, 4, 4, 8]);
      expect(hitsOf(s, "ult_attack1_1").every((h) => Math.abs(scale(h) - 0.2) < 1e-6)).toBe(true);
      const layers = (h: LandedHit | undefined) => sum(from(h, LAYERS, "critRate"));
      const seq = ["ult_attack1_1", "ult_attack2_1", "ult_attack2_2", "ult_attack3_1"].flatMap((k) => hitsOf(s, k)).map((h) => Math.round(layers(h) / 0.03));
      expect(seq).toEqual([1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10]);
      // Crit DMG +0.6 at 10 layers (from the shot after the 10th layer: the modifier's `if` reads the layers before the shot's own).
      const a31 = hitsOf(s, "ult_attack3_1");
      expect(sum(from(a31[1], LAYERS, "critDamage"))).toBeCloseTo(0.6, 6);
      // The shot that adds the 10th layer has its Crit Rate but not yet the Crit DMG (the engine judges the modifier's
      // `if` before the shot's own beforeDamage layer; the game refreshes the value at the 10th layer: report, section Kit).
      expect(sum(from(a31[0], LAYERS, "critRate"))).toBeCloseTo(0.3, 6);
      expect(sum(from(a31[0], LAYERS, "critDamage"))).toBe(0);
      expect(sum(from(hitsOf(s, "ult_attack2_2")[0], LAYERS, "critDamage"))).toBe(0);
      expect(from(a31[1], STATE, "atk")).toEqual([expect.closeTo(0.1, 6)]);
      expect(from(a31[1], STATE, "critDamage")).toEqual([expect.closeTo(0.3, 6)]);
      const p4 = run(full({ potential: 4 }), ult);
      expect(from(hitsOf(p4, "ult_attack3_1")[1], STATE)).toEqual([]);
    });

    it("the end state (3 s from the state's end): only the enhanced Final Strike starts; its hit at 28 (3.0, a Final Strike) has the layers and P5, then the state, the layers and the cooldown (10 s) end", () => {
      const end = (st: TimelineState) => st.buffs.find((b) => b.owner === Y && b.id === "ult_end");
      expect(startError(sc, ult, y("ult_attack3_2", stateEnd))).toHaveProperty("error");
      expect(startError(sc, ult, y("attack1", stateEnd))).toHaveProperty("error");
      const t = run(sc, [...ult, y("ult_attack_end", stateEnd)]);
      const a = castAt(t, "ult_attack_end");
      const hit = hitsOf(t, "ult_attack_end");
      expect(hit.map((h) => [h.hitId, h.frame - a])).toEqual([["end", 28]]);
      expect(scale(hit[0])).toBeCloseTo(3.0, 6);
      expect(sum(from(hit[0], LAYERS, "critDamage"))).toBeCloseTo(0.6, 6);
      expect(from(hit[0], END, "atk")).toEqual([expect.closeTo(0.1, 6)]);
      const after = run(sc, [...ult, y("ult_attack_end", stateEnd)], a + 30);
      expect(end(run(sc, [...ult, y("ult_attack_end", stateEnd)], a + 28))).toBeDefined();
      expect(end(after)).toBeUndefined();
      expect(myBuff(after, "ult_layers")).toEqual([]);
      expect(after.readyAt[`${Y}_ultimate_skill`]).toBe(a + 29 + 10 * 30);
      // Without the strike, the end state runs out after 3 s and sets the cooldown then.
      expect(end(run(sc, ult, stateEnd + 1))?.expiresAt).toBe(stateEnd + 3 * 30);
      const idle = run(sc, ult, stateEnd + 3 * 30 + 1);
      expect(idle.readyAt[`${Y}_ultimate_skill`]).toBe(stateEnd + 3 * 30 + 10 * 30);
    });

    it("on a Solidified enemy the end strike adds atk_scale_extra (6.0) and then consumes the Solidification, and opens her combo", () => {
      // Fluorite's Nature (frame 219), then Estella's Cryo (frame 251) Solidify the enemy just before the end state.
      const team = full({}, { team: [...sc.team, estella] });
      const rot = [...ult.slice(0, 3), f("normal_skill", 120), e("normal_skill", 230)];
      const t = run(team, [...rot, y("ult_attack_end", stateEnd)]);
      const a = castAt(t, "ult_attack_end");
      const hits = hitsOf(t, "ult_attack_end");
      expect(hits.map((h) => [h.hitId, h.frame - a])).toEqual([["end", 28], ["end_extra", 28]]);
      expect(scale(hits[1])).toBeCloseTo(6.0, 6);
      // The same zones but the scale: the layers, P5 and talent 2 (Solidified: 0.6) act on both.
      expect({ ...hits[1]?.zones, scale: 0 }).toEqual({ ...hits[0]?.zones, scale: 0 });
      expect(from(hits[1], FP)).toEqual([expect.closeTo(0.6, 6)]);
      expect(t.reactions.some((r) => r.kind === "statusConsumed" && r.status === "solidification" && r.frame === a + 28)).toBe(true);
      expect(run(team, [...rot, y("ult_attack_end", stateEnd), y("combo_skill")]).casts.some((c) => c.skill === `${Y}_combo_skill`)).toBe(true);
    });
  });
});

describe("Yvonne's equipment kits", () => {
  it("Navigator: her own Solidification gives the doubled buff (Cryo / Nature DMG 0.196, Crit Rate 0.112 at skill level 9) on the bomb itself; a teammate's the plain one; the two don't add", () => {
    const own = hitsOf(run(scenario(), solidify), "normal_skill")[0];
    expect(from(own, NAV, "damageBonus")).toEqual([expect.closeTo(0.196, 6)]);
    expect(from(own, NAV, "critRate")).toEqual([expect.closeTo(0.112, 6)]);
    // Estella's battle skill Solidifies Fluorite's Nature (frame 126): the plain copy (0.098). A chain on the Solidified enemy
    // opens Yvonne's combo, whose explosion Solidifies again (her own): with both copies active only the doubled one counts.
    const team = scenario({}, { team: [...scenario().team, estella] });
    const rot = [f("normal_skill"), e("normal_skill", 105), y("attack1", 127), y("attack2"), y("attack3"), y("attack4"), y("attack5"), y("combo_skill"), y("attack1", 360)];
    const s = run(team, rot);
    expect(s.reactions.some((r) => r.kind === "reaction" && r.operator === E && r.status === "solidification")).toBe(true);
    const [first, second] = hitsOf(s, "attack1");
    expect(from(first, NAV, "damageBonus")).toEqual([expect.closeTo(0.098, 6)]);
    expect(from(first, NAV, "critRate")).toEqual([expect.closeTo(0.056, 6)]);
    const at = run(team, rot, second?.frame ?? NaN);
    expect([myBuff(at, "wpn_pistol_0005.valid").length, myBuff(at, "wpn_pistol_0005.valid_own").length]).toEqual([1, 1]);
    expect(from(second, NAV, "damageBonus")).toEqual([expect.closeTo(0.196, 6)]);
    expect(from(second, NAV, "critRate")).toEqual([expect.closeTo(0.112, 6)]);
  });

  it("Home Longing: her combo gives Cryo / Nature battle-skill DMG +dmg_up (0.224 at skill 9) for 20 s; not on other hits, not before a combo", () => {
    const hl = { weapon: { id: "wpn_pistol_0007", level: 90, skillLevels: [9, 9, 9] } };
    const s = run(scenario(hl), [...solidify, y("attack5", BOMB + 1), y("combo_skill"), y("normal_skill", 400)]);
    const bombs = hitsOf(s, "normal_skill");
    expect(from(bombs[0], "Home Longing")).toEqual([]);
    expect(from(bombs[1], "Home Longing")).toEqual([expect.closeTo(0.224, 6)]);
    expect(from(hitsOf(s, "combo_skill").at(-1), "Home Longing")).toEqual([]);
    // Interim (the data; in-game test 80): the battle skill doesn't consume it, it lasts its 20 s.
    const c = castAt(s, "combo_skill");
    const later = run(scenario(hl), [...solidify, y("attack5", BOMB + 1), y("combo_skill"), y("normal_skill", 400)], (bombs[1]?.frame ?? NaN) + 1);
    expect(myBuff(later, "wpn_pistol_0007.valid").map((b) => b.expiresAt - c)).toEqual([20 * 30]);
  });

  it("Wedge: a battle-skill cast gives Arts DMG +spell_dmg_up2 (0.224) for 15 s; its Arts Reaction another +spell_dmg_up3 (0.448), on the bomb itself", () => {
    const w = { weapon: { id: "wpn_pistol_0008", level: 90, skillLevels: [9, 9, 9] } };
    const plain = hitsOf(run(scenario(w), [y("normal_skill")]), "normal_skill")[0];
    expect(from(plain, "Wedge").sort()).toEqual([expect.closeTo(0.224, 6)]);
    const solid = hitsOf(run(scenario(w), solidify), "normal_skill")[0];
    expect(from(solid, "Wedge").sort((a, b) => a - b)).toEqual([expect.closeTo(0.224, 6), expect.closeTo(0.448, 6)]);
  });
});
