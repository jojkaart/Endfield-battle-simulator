// Ardelia's kit (chr_0025_ardelia) and the equipment kits of her batch-4 report (Opus: Etch Figure, Detonation Unit,
// Oblivion, Chivalric Virtues, Dreams of the Starry Beach): the mechanics the kit plan
// (docs/kit-batches/batch-4/chr_0025_ardelia.md) says must fire, on the example scenario's build and, for the weapons
// that never fire on her, on their natural wielders' examples (Gilberta, Arcane, Xaihi).
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const A = "chr_0025_ardelia";
const G = "chr_0013_aglina";
const L = "chr_0016_laevat";
const X = "chr_0011_seraph";
const S = "chr_0036_jsspsi";
const W = "chr_0032_lizhiyan";
const example = readScenario(new URL("../examples/ardelia-corrosion.scenario.json", import.meta.url).pathname);
const act = (operator: string) => (skill: string, at?: number): RotationAction => ({ operator, skill: skill === "swap" ? "swap" : `${operator}_${skill}`, ...(at !== undefined ? { at } : {}) });
const op = act(A);
const chain = (at?: number): RotationAction[] => ["attack1", "attack2", "attack3", "attack4"].map((k, i) => op(k, i === 0 ? at : undefined));

const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** Ardelia alone (the example's build, changed), 40 s, no starting energy unless given. */
const solo = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => ({ ...m, ...b })),
  startEnergy: {},
  durationFrames: 40 * 30,
  ...extra,
});
const castAt = (s: TimelineState, operator: string, skill: string, n = 0) => s.casts.filter((c) => c.operator === operator && c.skill === `${operator}_${skill}`)[n]?.frame ?? NaN;
const hitsOf = (s: TimelineState, operator: string, skill: string) => s.hits.filter((h) => h.operator === operator && h.skillId === `${operator}_${skill}`);
const from = (h: LandedHit | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label)).map((m) => m.value);
const buffOf = (s: TimelineState, owner: string, id: string) => s.buffs.filter((b) => b.owner === owner && b.id === id);
/** The chain, then the combo its Final Strike opens. */
const opener = [...chain(), op("combo_skill")];
const corrosion = (s: TimelineState) => s.enemy.statuses.find((x) => x.status === "corrosion");

describe("Ardelia's kit", () => {
  it("basic attacks: projectile landings at their launch frames, Mr. Dolly's Final Strike at 24 with 18 SP", () => {
    const s = run(solo(), chain());
    const frames = ["attack1", "attack2", "attack3", "attack4"].map((k) => hitsOf(s, A, k).map((h) => h.frame - castAt(s, A, k)));
    expect(frames).toEqual([[6], [8, 10], [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39], [24]]);
    expect(hitsOf(s, A, "attack4")[0]?.zones.scale).toBeCloseTo(1.24, 6);
    // attack4's atb 18 when the Dolly hits (SP regenerates 8/s besides).
    const a4 = castAt(s, A, "attack4") + 24;
    const before = run(solo(), chain(), a4 - 1).sp;
    expect(run(solo(), chain(), a4).sp - before).toBeCloseTo(18 + 8 / 30, 6);
  });

  it("attack4 cut before its Dolly hits (a battle skill at once) loses the Final Strike: the kill_sheep clip ends with the action", () => {
    // Without `at`, the step waits for attack4's own hit; at frame 78 (attack4's frame 2) it cuts it.
    const s = run(solo(), [...chain(), op("normal_skill")]);
    expect(castAt(s, A, "normal_skill")).toBe(castAt(s, A, "attack4") + 24);
    const cut = run(solo(), [...chain(), op("normal_skill", 78)]);
    expect(castAt(cut, A, "normal_skill")).toBeLessThan(castAt(cut, A, "attack4") + 24);
    expect(hitsOf(cut, A, "attack4")).toEqual([]);
    expect(cut.comboWindow[A]).toBeUndefined();
  });

  it("combo window: her Final Strike on a clean enemy opens it; on a Nature-inflicted enemy (Gilberta's explosion) it doesn't", () => {
    const s = run(solo(), chain());
    expect(s.comboWindow[A]?.from).toBe(castAt(s, A, "attack4") + 24);
    const gilberta = readScenario(new URL("../examples/gilberta-gravity-field.scenario.json", import.meta.url).pathname).team.find((m) => m.operator === G) as Build;
    const duo = solo({}, { team: [...solo().team, gilberta] });
    const g = act(G);
    const rotation = [g("normal_skill"), ...chain(4 * 30)];
    const inflicted = run(duo, rotation);
    const fs = hitsOf(inflicted, A, "attack4")[0]?.frame ?? NaN;
    expect(run(duo, rotation, fs).enemy.infliction?.element).toBe("natural");
    expect(inflicted.comboWindow[A]).toBeUndefined();
  });

  it("combo: projectile at 20 (atk_scale 1.0, 10 energy), bomb at 72 (2.5) under its own forced Corrosion (7 s), no Link", () => {
    const s = run(solo(), opener, 300);
    const c = castAt(s, A, "combo_skill");
    const [projhit, bomb] = hitsOf(s, A, "combo_skill");
    expect([projhit?.hitId, projhit && projhit.frame - c, projhit?.zones.scale]).toEqual(["projhit", 20, 1]);
    expect([bomb?.hitId, bomb && bomb.frame - c, bomb?.zones.scale]).toEqual(["bomb", 72, 2.5]);
    expect(s.energy[A]).toBeCloseTo(10, 6);
    const forced = s.reactions.find((r) => r.kind === "reaction" && r.status === "corrosion");
    expect(forced).toEqual(expect.objectContaining({ frame: c + 72, operator: A, level: 1, consumed: null }));
    // The bomb's DamageAction comes after its CreateBuff: it has the Corrosion's initial shred, the projectile doesn't.
    expect(bomb?.zones.resistance).toBeGreaterThan(1);
    expect(projhit?.zones.resistance).toBe(1);
    expect(corrosion(s)).toEqual(expect.objectContaining({ appliedAt: c + 72, expiresAt: c + 72 + 7 * 30 }));
    expect(s.link).toEqual([]);
    expect(s.readyAt[`${A}_combo_skill`]).toBe(c + 17 * 30);
  });

  it("P5: both combo hits ×1.2, Corrosion 11 s, cooldown 15 s", () => {
    const s = run(solo({ potential: 5 }), opener, 400);
    const c = castAt(s, A, "combo_skill");
    expect(hitsOf(s, A, "combo_skill").map((h) => Number(h.zones.scale.toFixed(6)))).toEqual([1.2, 3]);
    expect(corrosion(s)?.expiresAt).toBe(c + 72 + 11 * 30);
    expect(s.readyAt[`${A}_combo_skill`]).toBe(c + 15 * 30);
  });

  it("battle skill on a clean enemy: one ram at 32 (3.2, poise 10), team energy at 32, no talent-2 recast; next battle skill from 52, attack1 from 47", () => {
    const sc = solo();
    const s = run(sc, [op("normal_skill")]);
    expect(hitsOf(s, A, "normal_skill").map((h) => [h.hitId, h.frame, Number(h.zones.scale.toFixed(6))])).toEqual([["ram", 32, 3.2]]);
    expect(run(sc, [op("normal_skill")], 31).energy[A] ?? 0).toBe(0);
    expect(run(sc, [op("normal_skill")], 32).energy[A]).toBeCloseTo(6.5, 6);
    expect(s.buffs.filter((b) => b.owner === A)).toEqual([]);
    // Talent 2's jump 33 → 189 needs a second Corroded enemy: not taken (batch-4 D1), so the cast is free at MarkCanInterrupt 52.
    const two = run(sc, [op("normal_skill"), op("normal_skill")]);
    expect(castAt(two, A, "normal_skill", 1)).toBe(52);
    expect(hitsOf(two, A, "normal_skill").map((h) => h.frame)).toEqual([32, 52 + 32]);
    const next = run(sc, [op("normal_skill"), op("attack1")]);
    expect(castAt(next, A, "attack1")).toBe(47);
  });

  describe("battle skill on her combo's Corrosion (the example)", () => {
    const s = run(example);
    const ram = hitsOf(s, A, "normal_skill")[0];
    const later = hitsOf(s, A, "normal_skill")[1];

    it("consumes the Corrosion; that ram already has Arts Susceptibility 0.20 (P0) and Dreams' Arts DMG Taken 0.28, and no shred", () => {
      expect(ram?.hitId).toBe("ram_corroded");
      expect(s.reactions.filter((r) => r.kind === "statusConsumed")).toEqual([expect.objectContaining({ frame: ram?.frame, operator: A, status: "corrosion" })]);
      expect(from(ram, "Dolly Rush: Arts Susceptibility")).toEqual([expect.closeTo(0.2, 6)]);
      expect(from(ram, "Tidal Murmurs")).toEqual([expect.closeTo(0.28, 6)]);
      expect(ram?.zones.resistance).toBe(1);
      expect(ram?.zones.susceptibility).toBeCloseTo(1.2, 6);
    });

    it("the debuffs last 30 s (Susceptibility, both kinds) and 25 s (Dreams) of the enemy's time, on later hits; the later plain ram adds no new ones", () => {
      const at = ram?.frame ?? NaN;
      // The ultimate cast at the ram's frame stops time 80 frames: the enemy's debuffs wait meanwhile.
      expect(castAt(s, A, "ultimate_skill")).toBe(at);
      const stop = 80;
      for (const id of ["arts_susceptibility", "physical_susceptibility"]) expect(buffOf(s, A, id).map((b) => [b.appliedAt, b.expiresAt])).toEqual([[at, at + 30 * 30 + stop]]);
      expect(buffOf(s, A, "physical_susceptibility")[0]?.modifiers.map((m) => [m.zone, m.element, Number(m.value.toFixed(6))])).toEqual([["susceptibility", "physical", 0.2]]);
      expect(buffOf(s, A, "wpn_funnel_0013.arts_taken").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[at, at + 25 * 30 + stop]]);
      expect(later?.hitId).toBe("ram");
      expect(from(later, "Tidal Murmurs")).toEqual([expect.closeTo(0.28, 6)]);
    });

    it("P1 and up: Susceptibility 0.28", () => {
      const p1 = run({ ...example, team: example.team.map((m) => ({ ...m, potential: 1 })) });
      expect(hitsOf(p1, A, "normal_skill")[0]?.zones.susceptibility).toBeCloseTo(1.28, 6);
    });
  });

  it("ultimate below P3: 11 hits every 9 frames from 81 (the per-enemy cap), the jump 171 → 201 brings the end 30 frames sooner", () => {
    const s = run(solo({}, { startEnergy: { [A]: "full" } }), [op("ultimate_skill"), op("attack1")]);
    expect(hitsOf(s, A, "ultimate_skill").map((h) => h.frame)).toEqual([81, 90, 99, 108, 117, 126, 135, 144, 153, 162, 171]);
    expect(hitsOf(s, A, "ultimate_skill")[0]?.zones.scale).toBeCloseTo(1.65, 6);
    expect(castAt(s, A, "attack1")).toBe(223 - 30);
  });

  it("P3: 14 hits to 198 and the full channel; P4: cost 76.5", () => {
    const s = run(solo({ potential: 3 }, { startEnergy: { [A]: "full" } }), [op("ultimate_skill"), op("attack1")]);
    expect(hitsOf(s, A, "ultimate_skill").map((h) => h.frame)).toEqual([81, 90, 99, 108, 117, 126, 135, 144, 153, 162, 171, 180, 189, 198]);
    expect(castAt(s, A, "attack1")).toBe(223);
    const energy = (p: number) => init(createContext(data, solo({ potential: p }, { startEnergy: { [A]: "full" } }))).energy[A];
    expect(energy(3)).toBeCloseTo(90, 4);
    expect(energy(4)).toBeCloseTo(76.5, 4);
  });
});

describe("Ardelia's arts units on their wielders", () => {
  it("Dreams of the Starry Beach: nothing without a Corrosion consumed", () => {
    const s = run(solo(), [op("normal_skill"), ...chain()]);
    expect(s.triggerState[`${A}:wpn_funnel_0013.corrosion_consumed`]).toBeUndefined();
    expect(s.hits.filter((h) => from(h, "Tidal Murmurs").length > 0)).toEqual([]);
  });

  it("Oblivion: Arts DMG +0.336 for 15 s from her combo's cast, +0.672 from her ultimate's (L9), the two separate", () => {
    const oblivion = { weapon: { id: "wpn_funnel_0009", level: 90, skillLevels: [9, 9, 9] as [number, number, number] } };
    const s = run(solo(oblivion, { startEnergy: { [A]: "full" } }), [...opener, op("ultimate_skill")]);
    const c = castAt(s, A, "combo_skill");
    expect(from(hitsOf(s, A, "attack4")[0], "Twilight")).toEqual([]);
    expect(hitsOf(s, A, "combo_skill").map((h) => from(h, "Twilight: Humiliation (combo)"))).toEqual([[expect.closeTo(0.336, 6)], [expect.closeTo(0.336, 6)]]);
    expect(buffOf(run(solo(oblivion), opener, c + 1), A, "wpn_funnel_0009.combo").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[c, c + 15 * 30]]);
    const ult = hitsOf(s, A, "ultimate_skill")[0];
    expect(from(ult, "Twilight: Humiliation (ultimate)")).toEqual([expect.closeTo(0.672, 6)]);
    expect(from(ult, "Twilight: Humiliation (combo)")).toEqual([expect.closeTo(0.336, 6)]);
  });

  it("Opus: Etch Figure on Gilberta: her battle skill's Nature Infliction gives Laevatain (not her) Arts DMG +0.196 for 15 s (one enemy, L9)", () => {
    // Laevatain's hits from Gilberta's battle skill on: teammates' own attacks off (accuracy plan B0), or hers come before it.
    const read = readScenario(new URL("../examples/gilberta-gravity-field.scenario.json", import.meta.url).pathname);
    const sc = { ...read, options: { ...read.options, teammateAttacks: false } };
    const worn: TimelineScenario = { ...sc, team: sc.team.map((m) => (m.operator === G ? { ...m, weapon: { id: "wpn_funnel_0006", level: 90, skillLevels: [9, 9, 9] } } : m)), startEnergy: {}, controlled: G };
    const g = act(G);
    const l = act(L);
    // Gilberta's battle skill (explosion at 108), then Laevatain's basic attacks (Combustion ticks keep their applier's side from the reaction: V2).
    const s = run(worn, [g("normal_skill"), l("swap", 4), l("attack1"), l("attack2")], 300);
    const explosion = hitsOf(s, G, "normal_skill").find((h) => h.hitId === "explosion");
    expect(explosion?.frame).toBe(108);
    const buff = s.buffs.find((b) => b.owner === G && b.id === "wpn_funnel_0006.arts_dmg");
    expect(buff && [buff.appliedAt, buff.expiresAt - buff.appliedAt, buff.recipients]).toEqual([108, 15 * 30, [L]]);
    const lae = s.hits.filter((h) => h.operator === L && h.skillId.includes("attack"));
    expect(lae.length).toBeGreaterThan(0);
    for (const h of lae) expect(from(h, "Tillite Etchings")).toEqual([expect.closeTo(0.196, 6)]);
    for (const h of s.hits.filter((x) => x.operator === G)) expect(from(h, "Tillite Etchings")).toEqual([]);
    // Ardelia's own battle skill inflicts nothing: never on her.
    const own = run(solo({ weapon: { id: "wpn_funnel_0006", level: 90, skillLevels: [9, 9, 9] } }), [op("normal_skill")]);
    expect(own.triggerState[`${A}:wpn_funnel_0006.nature`]).toBeUndefined();
  });

  it("Detonation Unit on Arcane: each of her Arts Bursts gives the enemy Arts DMG Taken +0.252 for 15 s (L9), from the burst on", () => {
    const sc = readScenario(new URL("../examples/arcane-will-solo.scenario.json", import.meta.url).pathname);
    const worn = { ...sc, team: sc.team.map((m) => ({ ...m, weapon: { id: "wpn_funnel_0008", level: 90, skillLevels: [9, 9, 9] as [number, number, number] } })) };
    const s = run(worn);
    const bursts = s.reactions.filter((r) => r.kind === "burst" && r.operator === W);
    expect(bursts.length).toBeGreaterThan(0);
    const first = bursts[0]?.frame ?? NaN;
    expect(s.hits.filter((h) => h.operator === W && h.frame < first && from(h, "Imposing Champion").length > 0)).toEqual([]);
    const after = s.hits.filter((h) => h.operator === W && h.frame > first && h.frame < first + 15 * 30 && h.element !== "physical");
    expect(after.length).toBeGreaterThan(0);
    for (const h of after) expect(from(h, "Imposing Champion")).toEqual([expect.closeTo(0.252, 6)]);
    // Ardelia never bursts.
    expect(run(solo({ weapon: { id: "wpn_funnel_0008", level: 90, skillLevels: [9, 9, 9] } }), opener).triggerState[`${A}:wpn_funnel_0008.burst`]).toBeUndefined();
  });

  it("Chivalric Virtues on Xaihi: her crystal's treatment (a battle-skill heal) gives the team ATK +0.252 for 15 s (L9), from after that hit", () => {
    const sc = readScenario(new URL("../examples/xaihi-si.scenario.json", import.meta.url).pathname);
    const worn: TimelineScenario = { ...sc, team: sc.team.map((m) => (m.operator === X ? { ...m, weapon: { id: "wpn_funnel_0010", level: 90, skillLevels: [9, 9, 9] } } : m)) };
    const s = run(worn);
    expect(s.triggerState[`${X}:wpn_funnel_0010.heal`]?.count).toBeGreaterThan(0);
    // The first treatment: Xaihi's own Final Strike under the crystal.
    const fs = hitsOf(s, X, "attack5")[0];
    const f = fs?.frame ?? NaN;
    expect(from(fs, "Blight Fervor")).toEqual([]);
    expect(s.hits.filter((h) => h.frame < f && from(h, "Blight Fervor").length > 0)).toEqual([]);
    const window = s.hits.filter((h) => h.frame > f && h.frame < f + 15 * 30);
    expect(window.filter((h) => h.operator === S).length).toBeGreaterThan(0);
    for (const h of window) expect(from(h, "Blight Fervor")).toEqual([expect.closeTo(0.252, 6)]);
    // Ardelia's Shadows heal untagged (and aren't simulated): never on her.
    const own = run(solo({ weapon: { id: "wpn_funnel_0010", level: 90, skillLevels: [9, 9, 9] } }), [op("normal_skill"), ...chain()]);
    expect(own.triggerState[`${A}:wpn_funnel_0010.heal`]).toBeUndefined();
  });
});
