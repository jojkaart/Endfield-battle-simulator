// Alesh's kit (chr_0024_deepfin) and the batch-3 equipment he owns (OBJ Edge of Lightness, Finchaser 3.0): every
// hit, trigger, buff, potential and talent the kit plan (docs/kit-batches/batch-3/chr_0024_deepfin.md) says must act,
// and the interims' behaviour (Shatter opens his combo, A7; the Rare Fin as a chance trigger).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, Attr, computeStats, createContext, evalContext, evaluate, init, type Build, type GameData, type KitBuff, type KitTrigger, type LandedHit, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const A = "chr_0024_deepfin";
const P = A + "_";
const E = "chr_0021_whiten";
const M = "chr_0003_endminf";
const example = readScenario(new URL("../examples/alesh-estella.scenario.json", import.meta.url).pathname);
const alesh = example.team.find((b) => b.operator === A) as Build;
const estella = example.team.find((b) => b.operator === E) as Build;
const endmin = JSON.parse(readFileSync(new URL("../examples/endministrator-p5.json", import.meta.url), "utf8")) as Build;
/** Rotation steps; `at` in seconds (RotationAction.at is in frames). */
const step = (operator: string, skill: string, at?: number): RotationAction => ({ operator, skill: operator + "_" + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const a = (skill: string, at?: number) => step(A, skill, at);
const e = (skill: string, at?: number) => step(E, skill, at);
const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s) => a(s));

/** Alesh alone (his build changed by `b`), or with the given teammates. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}, mates: Build[] = []): TimelineScenario => ({
  ...example,
  team: [{ ...alesh, ...b }, ...mates],
  startEnergy: {},
  options: { ...example.options, crit: "never" },
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], g: GameData = data, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const x of rotation) s = apply(ctx, s, x);
  return advance(ctx, s, until);
};
/** Alesh's kit with test-only counting stacks a–e and extra buffs and triggers. */
const withKit = (k: { buffs?: KitBuff[]; triggers?: KitTrigger[] }, op = A, d: GameData = data): GameData => {
  const kit = d.kits.operators[op] as OperatorKit;
  return {
    ...d,
    kits: {
      ...d.kits,
      operators: {
        ...d.kits.operators,
        [op]: { ...kit, stacks: [...kit.stacks, ...["a", "b", "c", "d", "e"].map((id) => ({ id, label: id, max: 999 }))], buffs: [...kit.buffs, ...(k.buffs ?? [])], triggers: [...kit.triggers, ...(k.triggers ?? [])] },
      },
    },
  };
};
/** Test-only: n Cryo Infliction stacks on the enemy at the start of the fight (applied by Alesh). */
const cryo = (n: number): KitTrigger => ({ id: "test_cryo", on: { event: "fightStart" }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "cryst", stacks: n }] }] });
const count = (id: string, on: KitTrigger["on"], stack: string, by: KitTrigger["by"] = "self"): KitTrigger => ({ id, on, by, do: [{ kind: "gain", gains: [{ stack, amount: 1 }] }] });
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === A);
const castAt = (s: TimelineState, skill: string, operator = A) => s.casts.find((c) => c.operator === operator && c.skill === operator + "_" + skill)?.frame ?? NaN;
const fired = (s: TimelineState, trigger: string, owner = A) => s.triggerState[`${owner}:${trigger}`]?.count ?? 0;
const mod = (h: LandedHit | undefined, source: string) => h?.modifiers.filter((x) => x.source.includes(source)).reduce((t, x) => t + x.value, 0) ?? 0;
const stacksOf = (s: TimelineState, op = A) => s.stacks[op] ?? {};
const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
/** The combo cast on its own (window opened by a test-only trigger at the start), with the battle's seed. */
const comboAlone = (seed: number, b: Partial<Build> = {}, mates: Build[] = [], g: GameData = data) => {
  const open: KitTrigger = { id: "test_open", on: { event: "fightStart" }, by: "self", do: [{ kind: "openCombo" }] };
  return run(scenario(b, { options: { ...example.options, crit: "never", seed } }, mates), [a("combo_skill")], withKit({ triggers: [open] }, A, g), 8 * 30);
};
const rareFin = (s: TimelineState) => mine(s).some((h) => h.hitId === "slam_ex");

describe("Alesh's kit: basic attacks, finisher, data", () => {
  it("the basic chain: one hit each at 7 / 5 / 13 / 15, attack5 two at 18 and 19 (Final Strike, then 19 SP); all Physical", () => {
    const s = run(scenario(), chain, data, 12 * 30);
    for (const [skill, frames] of [["attack1", [7]], ["attack2", [5]], ["attack3", [13]], ["attack4", [15]], ["attack5", [18, 19]]] as const) {
      const at = castAt(s, skill);
      expect(mine(s).filter((h) => h.skillId === P + skill).map((h) => h.frame - at)).toEqual(frames);
    }
    expect(mine(s).every((h) => h.element === "physical")).toBe(true);
    const kit = data.kits.operators[A] as OperatorKit;
    const a5 = kit.skills.find((x) => x.skillId === P + "attack5")?.hits ?? [];
    expect(a5.map((h) => [h.id, h.finalStrike ?? false, h.poiseControlledOnly ?? false])).toEqual([["hit", true, true], ["hit_2", false, false]]);
    // Only attack5's second hit returns SP (atb 19; attacks 1–4 have atb 0): natural, of source type 1, which Edge of Lightness ignores.
    const g = withKit({ triggers: [count("sp1", { event: "sp", sourceTypes: [1] }, "a"), count("sp_any", { event: "sp" }, "b")] });
    const n = stacksOf(run(scenario(), chain, g, 12 * 30));
    expect(n).toMatchObject({ a: 1, b: 1 });
  });

  it("the finisher's two hits (atk_scale1 1.8, atk_scale2 7.2, multiplier 1.0) and the dive attack are on the kit", () => {
    const kit = data.kits.operators[A] as OperatorKit;
    const fin = kit.skills.find((x) => x.skillId === P + "power_attack")?.hits ?? [];
    expect(fin.map((h) => [h.scale, h.frames, h.factor ?? 1])).toEqual([[["atk_scale1"], [13], 1], [["atk_scale2"], [47], 1]]);
    expect(kit.skills.map((x) => x.skillId.replace(P, "")).sort()).toEqual(["attack1", "attack2", "attack3", "attack4", "attack5", "combo_skill", "normal_skill", "plunging_attack_end", "power_attack", "ultimate_skill"]);
  });
});

describe("Alesh's battle skill: consume Cryo, Solidify at that level, SP by stacks", () => {
  // Advance to just after the battle skill's frame 27 (cast at 0) and read the SP, the reactions and the hit.
  const bs = (n: number, b: Partial<Build> = {}) => run(scenario(b), [a("normal_skill")], n ? withKit({ triggers: [cryo(n)] }) : data, 30);

  it("on 1–4 Cryo stacks: consumes them all, forced Solidification of that level, atb_n (+10 at P1) natural SP; with none: no SP, no Solidification", () => {
    const base = bs(0);
    const hit = mine(base).find((h) => h.skillId === P + "normal_skill");
    expect(hit?.frame).toBe(27);
    expect(hit?.scaleParts.map((p) => p.key)).toEqual(["atk_scale"]);
    expect(hit?.scaleParts[0]?.value).toBeCloseTo(4.5, 6);
    expect(base.reactions.some((r) => r.kind === "reaction")).toBe(false);
    for (const [n, atb] of [[1, 15], [2, 25], [3, 35], [4, 45]] as const) {
      const s = bs(n);
      expect(s.reactions.filter((r) => r.kind === "consumed").map((r) => (r.kind === "consumed" ? [r.frame, r.element, r.stacks] : null))).toEqual([[27, "cryst", n]]);
      expect(s.reactions.filter((r) => r.kind === "reaction").map((r) => (r.kind === "reaction" ? [r.frame, r.status, r.level, r.consumed, r.initialHit] : null))).toEqual([[27, "solidification", n, null, false]]);
      expect(s.enemy.infliction).toBeNull();
      // P5 (P1's +10) against P0.
      expect(s.sp - base.sp).toBeCloseTo(atb + 10, 6);
      expect(bs(n, { potential: 0 }).sp - bs(0, { potential: 0 }).sp).toBeCloseTo(atb, 6);
    }
    // Natural SP: no part of it returned.
    expect(bs(4).spReturned).toBe(0);
  });

  it("the consumption and the Solidification come after the hit's damage (data order: DamageAction, then ForceSpellStatusAction)", () => {
    // A test-only modifier that acts only on a Solidified enemy: the battle skill's own hit doesn't see it.
    const g = withKit({
      buffs: [{ id: "test_solid", label: "test", target: "self", modifiers: [{ zone: "damageBonus", value: 1, if: { enemyStatus: "solidification" } }] }],
      triggers: [cryo(2), { id: "test_solid_on", on: { event: "fightStart" }, by: "self", do: [{ kind: "buff", buff: "test_solid" }] }],
    });
    const s = run(scenario(), [a("normal_skill"), ...chain], g, 6 * 30);
    expect(mod(mine(s).find((h) => h.skillId === P + "normal_skill"), "test")).toBe(0);
    expect(mod(mine(s).find((h) => h.skillId === P + "attack1"), "test")).toBe(1);
  });

  it("team energy at frame 27; talent 1: his own Solidification gives usp + usp_self (4 + 8), then a 3 s lockout", () => {
    const s = bs(2);
    const s0 = bs(0);
    expect(fired(s, "talent1_self")).toBe(1);
    expect(fired(s0, "talent1_self")).toBe(0);
    // Ultimate energy: the battle skill's team share (same for both) plus 12 from the talent (Ultimate Gain Efficiency 100%).
    expect((s.energy[A] ?? 0) - (s0.energy[A] ?? 0)).toBeCloseTo(12, 6);
    expect(s.buffs.some((b) => b.id === "talent1_icd" && b.expiresAt === 27 + 90)).toBe(true);
    // Below talent 1: nothing.
    const noTalent = run(scenario({ talents: [0, 0] }), [a("normal_skill")], withKit({ triggers: [cryo(2)] }), 30);
    expect(fired(noTalent, "talent1_self")).toBe(0);
  });
});

describe("Alesh's combo: its triggers, two paths, the Rare Fin chance, P3", () => {
  it("opens on a Shatter (interim, A7: in-game test 63), not on his own consumption of Cryo; the example's combo follows Estella's Shatter", () => {
    const s = run(example, example.rotation);
    const shatter = s.reactions.find((r) => r.kind === "shatter");
    expect(shatter).toBeDefined();
    expect(fired(s, "combo_on_shatter")).toBe(1);
    expect(fired(s, "combo_on_consumed")).toBe(0);
    expect(castAt(s, "combo_skill")).toBeGreaterThanOrEqual(shatter?.frame ?? Infinity);
    // His battle skill consumed two Cryo stacks and Solidified: no window from that alone.
    const alone = run(scenario(), [a("normal_skill")], withKit({ triggers: [cryo(2)] }), 60);
    expect(alone.comboWindow[A]).toBeUndefined();
  });

  it("opens on an Arts Reaction consumed by a hit (statusConsumed)", () => {
    const take: KitTrigger = { id: "test_take", on: { event: "cast", skills: [P + "attack1"] }, by: "self", do: [{ kind: "apply", applies: [{ kind: "consumeStatus" }] }] };
    const s = run(scenario(), [a("normal_skill"), a("attack1")], withKit({ triggers: [cryo(1), take] }), 3 * 30);
    expect(fired(s, "combo_on_consumed")).toBe(1);
    expect(s.comboWindow[A]).toBeDefined();
  });

  it("opens when the Endministrator's Originium Crystals are consumed, not when they run out; talent 1 gives usp (4) when she applies them", () => {
    // Her combo opens on a teammate's combo damage; here a test-only trigger opens it at the start.
    const open: KitTrigger = { id: "test_open", on: { event: "fightStart" }, by: "self", do: [{ kind: "openCombo" }] };
    const g = withKit({ triggers: [open] }, M);
    const m = (skill: string, at?: number) => step(M, skill, at);
    const sc = scenario({}, {}, [endmin]);
    // Crystals put on, then left to run out (5 s).
    const expired = run(sc, [m("combo_skill")], g, 10 * 30);
    expect(expired.casts.some((c) => c.skill === M + "_combo_skill")).toBe(true);
    expect(fired(expired, "talent1_team_crystals")).toBe(1);
    expect(expired.energy[A] ?? 0).toBeCloseTo(4, 6);
    expect(fired(expired, "combo_on_crystals")).toBe(0);
    expect(expired.comboWindow[A]).toBeUndefined();
    // Crystals put on, then her battle skill consumes them (its Vulnerable stack: crystals_vulnerable).
    const consumed = run(sc, [m("combo_skill"), m("normal_skill")], g, 4 * 30);
    expect(fired(consumed, "crystals_vulnerable", M)).toBe(1);
    expect(fired(consumed, "combo_on_crystals")).toBe(1);
    expect(consumed.comboWindow[A]).toBeDefined();
  });

  it("the normal path: hook 0.75 at 22 (15 natural SP of source 3), slam 2.25 at 38 (10 energy, 10 stagger); 64 → 120", () => {
    const seed = seeds.find((x) => !rareFin(comboAlone(x))) as number;
    const s = comboAlone(seed);
    const at = castAt(s, "combo_skill");
    expect(mine(s).map((h) => [h.hitId, h.frame - at, h.scaleParts[0]?.value])).toEqual([["hook", 22, 0.75], ["slam", 38, 2.25]]);
    expect(s.energy[A] ?? 0).toBeCloseTo(10, 6);
    const g = withKit({ triggers: [count("sp3", { event: "sp", sourceTypes: [3], natural: true }, "a"), count("sp0", { event: "sp", sourceTypes: [0] }, "b")] });
    const n = stacksOf(comboAlone(seed, {}, [], g));
    expect(n.a).toBe(1);
    expect(n.b ?? 0).toBe(0);
  });

  it("the Rare Fin path (10 → 65): 1.2 at 77, 3.6 at 93 (55 frames skipped: 22 and 38 after the cast), +10 SP of source 0, P3's team ATK +15% for 10 s; the chance is min(0.1 + INT × prob_add / rate, 0.1 + prob_max)", () => {
    const lucky = seeds.filter((x) => rareFin(comboAlone(x)));
    // About 17% at his Intellect (140.8 × 0.0005 + 0.1).
    expect(lucky.length).toBeGreaterThan(0);
    expect(lucky.length).toBeLessThan(seeds.length / 2);
    const s = comboAlone(lucky[0] as number, {}, [estella]);
    const at = castAt(s, "combo_skill");
    expect(mine(s).map((h) => [h.hitId, h.frame - at])).toEqual([["hook_ex", 22], ["slam_ex", 38]]);
    expect(mine(s).map((h) => h.scaleParts[0]?.value ?? 0).map((v) => Math.round(v * 100) / 100)).toEqual([1.2, 3.6]);
    const p3 = s.buffs.find((b) => b.id === "p3_atk");
    expect(p3?.appliedAt).toBe(at + 38);
    expect(p3?.expiresAt).toBe(at + 38 + 300);
    expect(p3?.modifiers.map((m) => m.zone)).toEqual(["atk"]);
    expect(p3?.modifiers[0]?.value).toBeCloseTo(0.15, 6);
    // Below P3: no team ATK.
    const p2 = comboAlone(lucky[0] as number, { potential: 2 }, [estella]);
    expect(rareFin(p2)).toBe(true);
    expect(p2.buffs.some((b) => b.id === "p3_atk")).toBe(false);
    // The Rare Fin path's SP: atb 15 (source 3) and atb_sp 10 (source 0).
    const g = withKit({ triggers: [count("sp3", { event: "sp", sourceTypes: [3] }, "a"), count("sp0", { event: "sp", sourceTypes: [0], natural: true }, "b")] });
    expect(stacksOf(comboAlone(lucky[0] as number, {}, [], g))).toMatchObject({ a: 1, b: 1 });
    // The chance: talent 2 (Veteran Angler) at level 2 sets prob_add 0.005, prob_max 0.3, rate 10; Intellect read continuously.
    const kit = data.kits.operators[A] as OperatorKit;
    const t = kit.triggers.find((x) => x.id === "rare_fin");
    const panel = computeStats(data, alesh);
    const wisd = panel.attrs[Attr.Wisd]?.total ?? 0;
    expect(evaluate(t?.chance ?? 0, evalContext(data, alesh, panel, P + "combo_skill"))).toBeCloseTo(Math.min(0.1 + (wisd * 0.005) / 10, 0.4), 6);
    const noTalent = { ...alesh, talents: [2, 0] };
    expect(evaluate(t?.chance ?? 0, evalContext(data, noTalent, computeStats(data, noTalent), P + "combo_skill"))).toBeCloseTo(0.1, 6);
  });
});

describe("Alesh's ultimate", () => {
  it("9.8 × ATK Cryo at 90 with a Cryo Infliction and 20 stagger; 25 natural SP of source 3 (no kills)", () => {
    const g = withKit({ triggers: [count("sp3", { event: "sp", sourceTypes: [3], natural: true }, "a")] });
    const s = run(scenario({}, { startEnergy: { [A]: "full" } }), [a("ultimate_skill")], g, 4 * 30);
    const h = mine(s).find((x) => x.skillId === P + "ultimate_skill");
    expect(h?.frame).toBe(90);
    expect(h?.element).toBe("cryst");
    expect(h?.scaleParts.map((p) => p.key)).toEqual(["atk_scale"]);
    expect(h?.scaleParts[0]?.value).toBeCloseTo(9.8, 6);
    expect([s.enemy.infliction?.element, s.enemy.infliction?.stacks]).toEqual(["cryst", 1]);
    expect(stacksOf(s).a).toBe(1);
    expect(run(scenario(), [], data, 4 * 30).stagger.poise - s.stagger.poise).toBeCloseTo(20, 6);
  });

  it("P5: ×atk_up 1.5 on an enemy below half HP (the scenario's enemy HP), not above it nor below P5", () => {
    const ult = (b: Partial<Build>, fraction: number) =>
      mine(run(scenario(b, { enemyHp: [{ from: 0, fraction }], startEnergy: { [A]: "full" } }), [a("ultimate_skill")], data, 4 * 30)).find((x) => x.skillId === P + "ultimate_skill");
    const parts = (h: LandedHit | undefined) => h?.scaleParts.map((p) => Math.round(p.value * 1000) / 1000);
    expect(parts(ult({}, 0.4))).toEqual([9.8, 1.5]);
    expect(parts(ult({}, 0.6))).toEqual([9.8]);
    expect(parts(ult({ potential: 4 }, 0.4))).toEqual([9.8]);
    expect((ult({}, 0.4)?.damage ?? 0) / (ult({}, 0.6)?.damage ?? 1)).toBeCloseTo(1.5, 3);
  });
});

describe("Alesh's talent 1 on teammates' Solidification, one lockout for all", () => {
  it("a teammate's Solidification gives usp (4); his own right after it gives nothing (shared 3 s marker)", () => {
    // Estella's battle skill adds Cryo to Nature: Solidification by her. A test-only Nature infliction at the start.
    const nature: KitTrigger = { id: "test_nature", on: { event: "fightStart" }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "natural" }] }] };
    const sc = scenario({}, {}, [estella]);
    const s = run(sc, [e("normal_skill")], withKit({ triggers: [nature] }), 3 * 30);
    const solid = s.reactions.find((r) => r.kind === "reaction" && r.status === "solidification");
    expect(solid?.operator).toBe(E);
    expect(fired(s, "talent1_team_solidification")).toBe(1);
    // usp (4) over Estella's battle skill's team energy alone.
    expect((s.energy[A] ?? 0) - (run(sc, [e("normal_skill")], data, 3 * 30).energy[A] ?? 0)).toBeCloseTo(4, 6);
    // Then his own Solidification within 3 s (a test-only Cryo stack at his battle skill's cast, which it consumes): the shared marker blocks it.
    const cryoAtCast: KitTrigger = { id: "test_cryo_cast", on: { event: "cast", skills: [P + "normal_skill"] }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "cryst" }] }] };
    const both = run(sc, [e("normal_skill"), a("normal_skill", 1.2)], withKit({ triggers: [nature, cryoAtCast] }), 5 * 30);
    expect(fired(both, "talent1_team_solidification")).toBe(1);
    expect(both.reactions.filter((r) => r.kind === "reaction" && r.status === "solidification").map((r) => r.operator)).toEqual([E, A]);
    expect(fired(both, "talent1_self")).toBe(0);
  });
});

describe("OBJ Edge of Lightness (wpn_sword_0019)", () => {
  const edge: Partial<Build> = { weapon: { id: "wpn_sword_0019", level: 90, skillLevels: [9, 9, 9] } };
  const layers = (s: TimelineState) => s.buffs.filter((b) => b.id === "wpn_sword_0019.dmg").length;

  it("a layer per SP grant of source type 3 (battle skill, combo hook, ultimate), none for attack5's (type 1); team Heat and Electric DMG +8.4% each, 20 s, max 3", () => {
    expect(layers(run(scenario(edge), chain, data, 12 * 30))).toBe(0);
    const s = run(scenario(edge, { startEnergy: { [A]: "full" } }, [estella]), [a("ultimate_skill"), a("normal_skill")], withKit({ triggers: [cryo(1)] }), 8 * 30);
    expect(layers(s)).toBe(2);
    const b = s.buffs.find((x) => x.id === "wpn_sword_0019.dmg");
    expect(b?.target).toBe("team");
    expect(b?.expiresAt).toBe((b?.appliedAt ?? 0) + 600);
    expect(b?.modifiers.map((m) => [m.zone, m.element, Math.round(m.value * 1000) / 1000])).toEqual([["damageBonus", "fire", 0.084], ["damageBonus", "pulse", 0.084]]);
    // A battle skill without Cryo grants no SP: no layer.
    expect(layers(run(scenario(edge), [a("normal_skill")], data, 2 * 30))).toBe(0);
  });

  it("the Rare Fin's atb_sp (type 0) adds none: one layer for its hook only", () => {
    const lucky = seeds.find((x) => rareFin(comboAlone(x, edge))) as number;
    expect(layers(comboAlone(lucky, edge))).toBe(1);
  });

  it("layers are timed separately and capped at 3", () => {
    const g = withKit({ triggers: [cryo(1), { id: "test_more", on: { event: "cast", kinds: ["basic"] }, by: "self", skill: P + "normal_skill", do: [{ kind: "sp", value: "atb_1" }] }] });
    const s = run(scenario(edge, { startEnergy: { [A]: "full" } }), [a("ultimate_skill"), a("normal_skill"), ...chain], g, 12 * 30);
    const mineLayers = s.buffs.filter((b) => b.id === "wpn_sword_0019.dmg");
    expect(mineLayers.length).toBe(3);
    expect(new Set(mineLayers.map((b) => b.expiresAt)).size).toBe(3);
  });
});

describe("Finchaser 3.0 (wpn_sword_0020)", () => {
  it("his battle skill's Solidification puts Cryo DMG Taken +19.6% on the enemy for 15 s, after that hit's damage; the next Cryo hit takes it", () => {
    const s = run(scenario({}, { startEnergy: { [A]: "full" } }), [a("normal_skill"), a("ultimate_skill", 2)], withKit({ triggers: [cryo(1)] }), 8 * 30);
    expect(fired(s, "wpn_sword_0020.solidified")).toBe(1);
    const debuff = run(scenario(), [a("normal_skill")], withKit({ triggers: [cryo(1)] }), 2 * 30).buffs.find((b) => b.id === "wpn_sword_0020.cryo_taken");
    expect(debuff?.appliedAt).toBe(27);
    expect(debuff?.expiresAt).toBe(27 + 450);
    // The ultimate's time stop (frames 0–77) holds the enemy's clock: the debuff lasts that much longer.
    expect(s.buffs.find((b) => b.id === "wpn_sword_0020.cryo_taken")?.expiresAt).toBe(27 + 450 + 77);
    expect(mod(mine(s).find((h) => h.skillId === P + "normal_skill"), "Fin Chaser")).toBe(0);
    expect(mod(mine(s).find((h) => h.skillId === P + "ultimate_skill"), "Fin Chaser")).toBeCloseTo(0.196, 3);
  });

  it("not from a teammate's Solidification", () => {
    const nature: KitTrigger = { id: "test_nature", on: { event: "fightStart" }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "natural" }] }] };
    const s = run(scenario({}, {}, [estella]), [e("normal_skill")], withKit({ triggers: [nature] }), 3 * 30);
    expect(s.reactions.some((r) => r.kind === "reaction" && r.status === "solidification")).toBe(true);
    expect(fired(s, "wpn_sword_0020.solidified")).toBe(0);
  });
});
