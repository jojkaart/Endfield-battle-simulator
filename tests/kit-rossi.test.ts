// Rossi's kit (chr_0028_wulfa) and the equipment kits she owns in batch 4 (Rapid Ascent, Eminent Repute,
// White Night Nova, Lupine Scarlet): every trigger, buff and interim the kit plan
// (docs/kit-batches/batch-4/chr_0028_wulfa.md, its Kit section) says must act, on the example scenario's team
// (Rossi P5 with Gilberta) and, for the weapons, their natural wielders' examples.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type CritMode, type GameData, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const R = "chr_0028_wulfa";
const P = R + "_";
const G = "chr_0013_aglina";
const example = readScenario(new URL("../examples/rossi-gilberta.scenario.json", import.meta.url).pathname);
/** Rotation steps; `at` in frames. */
const r = (skill: string, at?: number): RotationAction => ({ operator: R, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const g = (skill: string, at?: number): RotationAction => ({ operator: G, skill: `${G}_${skill}`, ...(at !== undefined ? { at } : {}) });

/** The example's team with Rossi's build changed; crits never by default (deterministic numbers). */
const scenario = (b: Partial<Build> = {}, crit: CritMode = "never", extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === R ? { ...m, ...b } : m)),
  options: { ...example.options, crit },
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], until = sc.durationFrames, d: GameData = data): TimelineState => {
  const ctx = createContext(d, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const mine = (s: TimelineState, skill?: string) => s.hits.filter((h) => h.operator === R && (skill === undefined || h.skillId === P + skill));
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === R && c.skill === P + skill)[n]?.frame ?? NaN;
const mod = (h: LandedHit | undefined, source: string, zone?: string) =>
  h?.modifiers.filter((x) => x.source.includes(source) && (zone === undefined || x.zone === zone)).reduce((t, x) => t + x.value, 0) ?? 0;
const fired = (s: TimelineState, trigger: string, owner = R) => s.triggerState[`${owner}:${trigger}`]?.count ?? 0;
/** A hit's multiplier: its scale keys times its factor. */
const scale = (h: LandedHit | undefined) => h?.scaleParts.reduce((t, p) => t * p.value, 1) ?? NaN;
const SKILL_HITS = new Set(["charge", "lift", "wolf_1", "wolf_2", "wolf_3", "wolf_4"]);
/** The enemy's stagger HP set low (Rhodagn has 280), so one poise hit Staggers it. */
const lowPoise = (poise: number): GameData => {
  const e = data.enemies["eny_0051_rodin"];
  if (!e) throw new Error("no Rhodagn");
  return { ...data, enemies: { ...data.enemies, eny_0051_rodin: { ...e, staticAttrs: { ...e.staticAttrs, 20: poise } } } };
};
const COMBO_CD = 14 * 30;
// Gilberta's battle skill inflicts Nature at its explosion; Rossi's battle skill Lifts (her first Vulnerable stack) before
// it lands: the infliction on a Vulnerable enemy opens her combo window.
const opener: RotationAction[] = [g("normal_skill"), r("normal_skill", 60)];
const CLAWMARK = "Razor Clawmark";

describe("Rossi's basic attacks and finisher", () => {
  it("attack2 and attack3 land twice at half atk_scale, attack4 (controlled) five times at 0.2, the Final Strike gives 21 SP and 18 Stagger", () => {
    const s = run(scenario(), [r("attack1"), r("attack2"), r("attack3"), r("attack4"), r("attack5")]);
    const frames = (skill: string) => mine(s, skill).map((h) => h.frame - castAt(s, skill));
    expect(frames("attack1")).toEqual([8]);
    expect(frames("attack2")).toEqual([5, 9]);
    expect(frames("attack3")).toEqual([4, 12]);
    expect(frames("attack4")).toEqual([6, 8, 13, 15, 23]);
    expect(frames("attack5")).toEqual([15]);
    expect(mine(s, "attack2").map(scale)).toEqual([expect.closeTo(0.355, 6), expect.closeTo(0.355, 6)]);
    expect(mine(s, "attack4").every((h) => mine(s, "attack4")[0]?.exact === h.exact)).toBe(true);
    // The not-controlled path (jump 0 → 189, × 0.5) isn't played: basic attacks need the controlled operator.
    expect(mine(s, "attack4").map((h) => h.hitId)).toEqual(["hit", "hit", "hit", "hit", "hit"]);
    const before = run(scenario(), [r("attack1"), r("attack2"), r("attack3"), r("attack4")], castAt(s, "attack5") + 14);
    const after = run(scenario(), [r("attack1"), r("attack2"), r("attack3"), r("attack4"), r("attack5")], castAt(s, "attack5") + 16);
    expect(after.sp - before.sp).toBeCloseTo(21 + 2 * (8 / 30), 6);
    expect(before.stagger.poise - after.stagger.poise).toBe(18);
  });

  it("finisher on a Staggered enemy: atk_scale 9 × 0.1 at 6 and 15, × 0.8 at 36", () => {
    const s = run(scenario(), [r("normal_skill"), r("power_attack")], 40 * 30, lowPoise(5));
    expect(mine(s, "power_attack").map((h) => [h.frame - castAt(s, "power_attack"), scale(h)])).toEqual([
      [6, expect.closeTo(0.9, 6)],
      [15, expect.closeTo(0.9, 6)],
      [36, expect.closeTo(7.2, 6)],
    ]);
  });
});

describe("Rossi's battle skill and talent 1", () => {
  it("on an enemy without Vulnerable: two charges and the Lift (its first Vulnerable stack), no Wolven Ambrage; team energy at frame 35", () => {
    const s = run(scenario(), [r("normal_skill")], 300);
    const cast = castAt(s, "normal_skill");
    expect(mine(s, "normal_skill").map((h) => [h.hitId, h.frame - cast])).toEqual([["charge", 16], ["charge", 22], ["lift", 35]]);
    expect(s.enemy.vulnerable?.stacks).toBe(1);
    expect(s.buffs.some((b) => b.id === "razor_clawmark")).toBe(false);
    const energy = (until: number) => run(scenario({}, "never", { startEnergy: {} }), [r("normal_skill")], cast + until).energy[G] ?? 0;
    expect(energy(34)).toBe(0);
    expect(energy(36)).toBeGreaterThan(0);
  });

  it("on a Vulnerable enemy: four Heat projectiles at frame 52 (jump 37 → 215, launch 230); the first gives 10 energy, P1's 10 returned SP and Razor Clawmark", () => {
    const s = run(scenario(), [r("normal_skill"), r("normal_skill")]);
    const cast = castAt(s, "normal_skill", 1);
    const second = mine(s, "normal_skill").filter((h) => h.frame >= cast && SKILL_HITS.has(h.hitId));
    expect(second.map((h) => [h.hitId, h.frame - cast, h.element])).toEqual([
      ["charge", 16, "physical"],
      ["charge", 22, "physical"],
      ["lift", 35, "physical"],
      ["wolf_1", 52, "fire"],
      ["wolf_2", 52, "fire"],
      ["wolf_3", 52, "fire"],
      ["wolf_4", 52, "fire"],
    ]);
    // atk_scale_3 2.88 × 1.15 (P1) × 0.25 each.
    expect(scale(second.find((h) => h.hitId === "wolf_2"))).toBeCloseTo(2.88 * 1.15 * 0.25, 5);
    const at = (until: number, b: Partial<Build> = {}) => run(scenario(b, "never", { startEnergy: {} }), [r("normal_skill"), r("normal_skill")], until);
    const justBefore = at(cast + 51);
    const justAfter = at(cast + 53);
    // P1: atb_return 10, returned (gives no energy when spent); usp_2 10 energy (× Ultimate Gain Efficiency).
    expect(justAfter.spReturned - justBefore.spReturned).toBeCloseTo(10, 6);
    expect((justAfter.energy[R] ?? 0) - (justBefore.energy[R] ?? 0)).toBeGreaterThan(9.99);
    const p0 = at(cast + 53, { potential: 0 });
    expect(p0.spReturned - at(cast + 51, { potential: 0 }).spReturned).toBe(0);
    expect(justAfter.buffs.some((b) => b.id === "razor_clawmark")).toBe(true);
    expect(justBefore.buffs.some((b) => b.id === "razor_clawmark")).toBe(false);
  });

  it("Razor Clawmark: 0.30 × ATK per second from the application for 25 s (26 ticks: the last on its end frame, as logged, without its own DMG Taken), its ATK from the application (atkSnapshot); Physical and Heat DMG Taken +12%", () => {
    const s = run(scenario(), [r("normal_skill"), r("normal_skill")]);
    const applied = mine(s).find((h) => h.hitId === "wolf_1")?.frame ?? NaN;
    const ticks = mine(s).filter((h) => h.hitId === "bleed");
    expect(ticks.map((h) => h.frame - applied)).toEqual(Array.from({ length: 26 }, (_, i) => i * 30));
    expect(ticks[0]?.scaleParts[0]).toEqual({ key: "atk_scale_bleed", value: expect.closeTo(0.3, 6) });
    expect(new Set(ticks.slice(0, 25).map((h) => h.exact)).size).toBe(1);
    // On the projectiles themselves (applied before their damage): physical and Heat both.
    const wolf = mine(s).find((h) => h.hitId === "wolf_2");
    expect(mod(wolf, CLAWMARK, "damageTaken")).toBeCloseTo(0.12, 6);
    expect(mod(ticks[1], CLAWMARK, "damageTaken")).toBeCloseTo(0.12, 6);
    // The end-frame tick: the buff ends after it and before the frame's damage (zmdlogs-4e5e t=39556: no bleed DMG Taken on it).
    expect(mod(ticks[25], CLAWMARK, "damageTaken")).toBe(0);
    // Without talent 1 nothing is applied.
    const t0 = run(scenario({ talents: [0, 2] }), [r("normal_skill"), r("normal_skill")]);
    expect(mine(t0).some((h) => h.hitId === "bleed")).toBe(false);
    expect(t0.buffs.some((b) => b.id === "razor_clawmark")).toBe(false);
  });

  it("the bleed tick keeps the ATK of its application: a Lupine Scarlet layer gained after it doesn't change the ticks, but does the next hit", () => {
    const s = run(scenario({}, "always"), [r("normal_skill"), r("normal_skill"), r("attack1"), r("attack2")]);
    const ticks = mine(s).filter((h) => h.hitId === "bleed");
    expect(ticks.length).toBeGreaterThan(3);
    expect(mod(ticks[0], "Wolven Blood")).toBeCloseTo(mod(ticks[3], "Wolven Blood"), 9);
    const lastAttack = mine(s, "attack2").at(-1);
    expect(mod(lastAttack, "Wolven Blood")).toBeGreaterThan(mod(ticks[0], "Wolven Blood"));
  });
});

describe("Rossi's talent 2 (Seething Blood)", () => {
  it("a battle-skill, combo or ultimate crit on a Clawmarked enemy adds 0.32 × ATK of Heat DMG (talent 2 level 2, P3 +0.08), no skill type", () => {
    const s = run(scenario({}, "always"), [r("normal_skill"), r("normal_skill"), r("attack1")]);
    const extras = mine(s).filter((h) => h.hitId === "extra");
    const wolves = mine(s).filter((h) => h.hitId.startsWith("wolf_"));
    // One per projectile (the first applies Razor Clawmark before its damage); basic attacks and bleed ticks add none.
    expect(extras.map((h) => h.frame)).toEqual(wolves.map((h) => h.frame));
    expect(extras[0]?.element).toBe("fire");
    expect(extras[0]?.scaleParts[0]).toEqual({ key: "bleed_critical_damage_scale", value: expect.closeTo(0.32, 6) });
    // Below P3: 0.24; without crits: none; without talent 2: none.
    expect(mine(run(scenario({ potential: 2 }, "always"), [r("normal_skill"), r("normal_skill")])).find((h) => h.hitId === "extra")?.scaleParts[0]?.value).toBeCloseTo(0.24, 6);
    expect(mine(run(scenario(), [r("normal_skill"), r("normal_skill")])).some((h) => h.hitId === "extra")).toBe(false);
    expect(mine(run(scenario({ talents: [2, 0] }, "always"), [r("normal_skill"), r("normal_skill")])).some((h) => h.hitId === "extra")).toBe(false);
  });
});

describe("Rossi's combo: two sequences", () => {
  it("opens on an Arts Infliction added to a Vulnerable enemy; sequence 1: hits at 13 and 24 (× 0.35, 10 energy), three afterhits at 33, 37, 41 (× 0.1)", () => {
    const s = run(scenario(), [...opener, r("combo_2_skill")]);
    const cast = castAt(s, "combo_2_skill");
    expect(cast).toBeGreaterThan(castAt(s, "normal_skill"));
    expect(mine(s, "combo_2_skill").map((h) => [h.hitId, h.frame - cast, scale(h)])).toEqual([
      ["hit", 13, expect.closeTo(1.5 * 1.15 * 0.35, 6)],
      ["hit_2", 24, expect.closeTo(1.5 * 1.15 * 0.35, 6)],
      ["ticks", 33, expect.closeTo(1.5 * 1.15 * 0.1, 6)],
      ["ticks", 37, expect.closeTo(1.5 * 1.15 * 0.1, 6)],
      ["ticks", 41, expect.closeTo(1.5 * 1.15 * 0.1, 6)],
    ]);
    // Without the opener's infliction the window never opens.
    expect(() => run(scenario(), [r("normal_skill"), r("combo_2_skill")])).toThrow(/combo trigger/);
  });

  it("sequence 2 in its own window from frame 37 (late path: the hit at 15 after the jump 0 → 212): consumes the Nature stacks for (3.45 + 2.07 × stacks) × ATK, Lifts, and gives Crit Rate +25% / Crit DMG +50% for 15 s", () => {
    const s = run(scenario(), [...opener, r("combo_2_skill"), r("combo_3_skill"), r("attack1")]);
    const c2 = castAt(s, "combo_2_skill");
    const c3 = castAt(s, "combo_3_skill");
    expect(c3 - c2).toBe(37);
    const hit = mine(s, "combo_3_skill");
    expect(hit.map((h) => [h.hitId, h.frame - c3])).toEqual([["late", 15]]);
    const consumed = s.reactions.filter((e) => e.kind === "consumed" && e.operator === R);
    expect(consumed).toHaveLength(1);
    expect(s.enemy.infliction).toBeNull();
    expect(consumed[0]?.kind === "consumed" ? consumed[0].stacks : NaN).toBe(1);
    expect(scale(hit[0])).toBeCloseTo(3.0 * 1.15 + 1.8 * 1.15 * 1, 5);
    expect(s.reactions.some((e) => e.kind === "physical" && e.status === "lift" && e.frame === hit[0]?.frame)).toBe(true);
    // Its crit buff on later hits, 15 s from the cast.
    const later = mine(s, "attack1")[0];
    expect(mod(later, "Crit Rate and Crit DMG", "critRate")).toBeCloseTo(0.25, 6);
    expect(mod(later, "Crit Rate and Crit DMG", "critDamage")).toBeCloseTo(0.5, 6);
    const late = mine(run(scenario(), [...opener, r("combo_2_skill"), r("combo_3_skill"), r("attack1", c3 + 15 * 30 + 1)]), "attack1")[0];
    expect(mod(late, "Crit Rate and Crit DMG")).toBe(0);
  });

  it("perfect timing (sequence 2 inside the ring, 52 frames after sequence 1): the hit at 29 and one more Vulnerable stack", () => {
    const base = run(scenario(), [...opener, r("combo_2_skill")]);
    const c2 = castAt(base, "combo_2_skill");
    const until = c2 + 300;
    const perfect = run(scenario(), [...opener, r("combo_2_skill"), r("combo_3_skill", c2 + 52)], until);
    const c3 = castAt(perfect, "combo_3_skill");
    expect(c3).toBe(c2 + 52);
    expect(mine(perfect, "combo_3_skill").map((h) => [h.hitId, h.frame - c3])).toEqual([["perfect", 29]]);
    const late = run(scenario(), [...opener, r("combo_2_skill"), r("combo_3_skill")], until);
    expect(late.enemy.vulnerable?.stacks).toBe(2);
    expect(perfect.enemy.vulnerable?.stacks).toBe(3);
    // The ring is open time_succeed (0.4 s): frames 52–63 of sequence 1.
    const path = (at: number) => mine(run(scenario(), [...opener, r("combo_2_skill"), r("combo_3_skill", c2 + at)], until), "combo_3_skill").map((h) => h.hitId);
    expect(path(63)).toEqual(["perfect"]);
    expect(path(64)).toEqual(["late"]);
    expect(path(51)).toEqual(["late"]);
  });

  it("cooldown: sequence 2 starts sequence 1's full 14 s from its cast; skipped, the full cooldown starts when the 6 s window ends (setFraction)", () => {
    const both = run(scenario(), [...opener, r("combo_2_skill"), r("combo_3_skill")]);
    expect(both.readyAt[P + "combo_2_skill"]).toBe(castAt(both, "combo_3_skill") + COMBO_CD);
    const one = run(scenario(), [...opener, r("combo_2_skill")]);
    expect(fired(one, "seq2_timeout")).toBe(1);
    expect(fired(both, "seq2_timeout")).toBe(0);
    expect(one.readyAt[P + "combo_2_skill"]).toBe(castAt(one, "combo_2_skill") + 37 + 6 * 30 + COMBO_CD);
    // Sequence 1 isn't castable while the slot holds sequence 2; sequence 2 not without its window.
    expect(() => run(scenario(), [...opener, r("combo_2_skill"), r("combo_2_skill")], 40 * 30)).toThrow();
    expect(() => run(scenario(), [r("normal_skill"), r("combo_3_skill")])).toThrow(/combo trigger/);
  });

  it("a finisher during the window pauses it (interim: + 65 frames at the finisher's cast)", () => {
    const d = lowPoise(5);
    const plain = run(scenario(), [...opener, r("combo_2_skill")], 40 * 30, d);
    const paused = run(scenario(), [...opener, r("combo_2_skill"), r("power_attack")], 40 * 30, d);
    expect(castAt(paused, "power_attack")).toBeLessThan(castAt(paused, "combo_2_skill") + 37 + 6 * 30);
    expect(fired(paused, "seq2_finisher_pause")).toBe(1);
    expect((paused.readyAt[P + "combo_2_skill"] ?? 0) - (plain.readyAt[P + "combo_2_skill"] ?? 0)).toBe(65);
  });
});

describe("Rossi's ultimate", () => {
  const sc = (b: Partial<Build> = {}, crit: CritMode = "never", extra: Partial<TimelineScenario> = {}) => scenario(b, crit, { startEnergy: { [R]: "full" }, ...extra });

  it("25 Heat stabs (63–111), slashes at 122 and 131; the second inflicts Heat; P5 × 1.1 on all", () => {
    const s = run(sc(), [r("ultimate_skill")]);
    const cast = castAt(s, "ultimate_skill");
    const hits = mine(s, "ultimate_skill");
    expect(hits.filter((h) => h.hitId === "stab").map((h) => h.frame - cast)).toEqual([63, 65, 66, 69, 71, 74, 75, 77, 78, 80, 83, 84, 87, 88, 90, 92, 94, 96, 97, 99, 102, 103, 106, 108, 111]);
    expect(hits.filter((h) => h.hitId !== "stab").map((h) => [h.hitId, h.frame - cast])).toEqual([["slash1", 122], ["slash2", 131]]);
    expect(hits.every((h) => h.element === "fire")).toBe(true);
    expect(run(sc(), [r("ultimate_skill")], cast + 130).enemy.infliction).toBeNull();
    expect(run(sc(), [r("ultimate_skill")], cast + 132).enemy.infliction?.element).toBe("fire");
    const p4 = run(sc({ potential: 4 }), [r("ultimate_skill")]);
    const slash = (st: TimelineState) => mine(st, "ultimate_skill").find((h) => h.hitId === "slash2")?.exact ?? NaN;
    expect(slash(s) / slash(p4)).toBeCloseTo(1.1, 6);
  });

  it("Crit DMG +0.6 on its own hits from frame 58 (+0.3 at P5), ending with the cast; P4 cost × 0.85", () => {
    const s = run(sc(), [r("ultimate_skill"), r("attack1")]);
    const stab = mine(s, "ultimate_skill")[0];
    expect(mod(stab, "Razorclaw Ambuscade: Crit DMG", "critDamage")).toBeCloseTo(0.9, 6);
    expect(mod(mine(run(sc({ potential: 4 }), [r("ultimate_skill")]), "ultimate_skill")[0], "Razorclaw Ambuscade: Crit DMG")).toBeCloseTo(0.6, 6);
    expect(mod(mine(s, "attack1")[0], "Razorclaw Ambuscade")).toBe(0);
    expect(s.buffs.some((b) => b.id === "ult_crit_damage")).toBe(false);
    const cost = (p: number) => run(sc({ potential: p }), [], 1).energy[R] ?? 0;
    expect(cost(4) / cost(3)).toBeCloseTo(0.85, 6);
  });

  it("stops an elite enemy's clock for 3.1 s from frame 57 (enemyRank, displayType 1), not a boss", () => {
    const control = (s: TimelineState) => s.reactions.filter((e) => e.kind === "control" && e.operator === R);
    const boss = run(sc(), [r("ultimate_skill")]);
    expect(control(boss)).toEqual([]);
    const elite = run(sc({}, "never", { target: { enemy: "eny_0104_hsrogue2", level: 90 } }), [r("ultimate_skill")]);
    expect(data.enemies["eny_0104_hsrogue2"]?.rank).toBe(1);
    expect(control(elite).map((e) => [e.frame - castAt(elite, "ultimate_skill"), e.kind === "control" ? [e.status, e.frames, e.freezes] : null])).toEqual([[57, ["rossi_ultimate_stop", 93, true]]]);
  });
});

describe("Rossi's equipment kits", () => {
  it("Lupine Scarlet: each crit adds a layer of Physical and Heat DMG +0.028 (no expiry); at 16, +0.672 for 20 s, whose end removes the layers", () => {
    const chain = [r("attack1"), r("attack2"), r("attack3"), r("attack4"), r("attack5")];
    const s = run(scenario({}, "always"), [...chain, ...chain], 15 * 30);
    const layers = (st: TimelineState) => st.buffs.filter((b) => b.id === "wpn_sword_0022.layer").length;
    expect(layers(s)).toBe(16);
    const hits = mine(s);
    // The second hit carries the first's layer (its Physical part, attribute 50; the Heat part is attribute 51).
    expect(mod(hits[1], "Wolven Blood")).toBeCloseTo(0.028, 6);
    expect(mod(hits[0], "Wolven Blood")).toBe(0);
    const final = s.buffs.find((b) => b.id === "wpn_sword_0022.final");
    expect(final?.expiresAt).toBe((final?.appliedAt ?? NaN) + 20 * 30);
    const at16 = hits.findIndex((h) => mod(h, "Wolven Blood at max stacks") > 0);
    expect(mod(hits[at16], "Wolven Blood at max stacks")).toBeCloseTo(0.672, 6);
    expect(mod(hits[at16], "Wolven Blood") - 0.672).toBeCloseTo(16 * 0.028, 6);
    // After the final's end: no layers (until the next crit).
    const ended = run(scenario({}, "always"), [...chain, ...chain], (final?.expiresAt ?? 0) + 1);
    expect(layers(ended)).toBe(0);
    expect(ended.buffs.some((b) => b.id === "wpn_sword_0022.final")).toBe(false);
    // No crits, no layers.
    expect(layers(run(scenario(), chain))).toBe(0);
  });

  it("Rapid Ascent: battle-skill and ultimate Physical DMG +0.42; DMG +0.98 against a Staggered enemy on every hit (interim: the data's reading)", () => {
    const ra = { weapon: { id: "wpn_sword_0011", level: 90, skillLevels: [9, 9, 9] } };
    const s = run(scenario(ra), [r("attack1"), r("normal_skill"), r("normal_skill")]);
    const label = "Rapid Ascent";
    expect(mod(mine(s, "normal_skill").find((h) => h.hitId === "charge"), label)).toBeCloseTo(0.42, 6);
    expect(mod(mine(s, "normal_skill").find((h) => h.hitId === "wolf_2"), label)).toBe(0);
    expect(mod(mine(s, "attack1")[0], label)).toBe(0);
    const staggered = run(scenario(ra), [r("normal_skill"), r("attack1")], 40 * 30, lowPoise(5));
    expect(mod(mine(staggered, "attack1")[0], label)).toBeCloseTo(0.98, 6);
  });

  it("Eminent Repute on the Endministrator: her Crush (Vulnerable consumed) gives her ATK +(0.14 + 0.07 × stacks) and the others half", () => {
    const M = "chr_0003_endminf";
    const ex = readScenario(new URL("../examples/endministrator-crystals.scenario.json", import.meta.url).pathname);
    const er = { ...ex, team: ex.team.map((m) => (m.operator === M ? { ...m, weapon: { id: "wpn_sword_0013", level: 90, skillLevels: [9, 9, 9] } } : m)) };
    const ctx = createContext(data, er);
    let s = init(ctx);
    for (const a of er.rotation) s = apply(ctx, s, a);
    s = advance(ctx, s, er.durationFrames);
    const crush = s.reactions.find((e) => e.kind === "physical" && e.status === "crush" && e.operator === M);
    expect(crush).toBeDefined();
    const level = crush?.kind === "physical" ? crush.level : NaN;
    const after = (op: string) => s.hits.find((h) => h.operator === op && h.frame > (crush?.frame ?? Infinity));
    const own = mod(after(M), "Eminent Repute", "atk");
    expect(own).toBeCloseTo(0.14 + 0.07 * level, 6);
    expect(mod(after("chr_0021_whiten"), "Eminent Repute", "atk")).toBeCloseTo(own / 2, 6);
  });

  it("White Night Nova on Laevatain: her Combustion gives Arts DMG +0.336 and Arts Intensity +70 for 15 s", () => {
    const L = "chr_0016_laevat";
    const ex = readScenario(new URL("../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
    const wnn = { ...ex, team: ex.team.map((m) => ({ ...m, weapon: { id: "wpn_sword_0014", level: 90, skillLevels: [9, 9, 9] } })) };
    const ctx = createContext(data, wnn);
    let s = init(ctx);
    for (const a of wnn.rotation) s = apply(ctx, s, a);
    s = advance(ctx, s, wnn.durationFrames);
    const combustion = s.reactions.find((e) => e.kind === "reaction" && e.status === "combustion" && e.operator === L);
    expect(combustion).toBeDefined();
    const at = combustion?.frame ?? NaN;
    const next = s.hits.find((h) => h.operator === L && h.frame > at && h.element === "fire");
    expect(mod(next, "White Night Nova", "damageBonus")).toBeCloseTo(0.336, 6);
    expect(fired(s, "wpn_sword_0014.on_reaction", L)).toBeGreaterThan(0);
    expect(mod(next, "White Night Nova", "artsIntensity")).toBeCloseTo(70, 6);
    const before = s.hits.find((h) => h.operator === L && h.frame < at);
    expect(mod(before, "White Night Nova", "damageBonus")).toBe(0);
  });
});
