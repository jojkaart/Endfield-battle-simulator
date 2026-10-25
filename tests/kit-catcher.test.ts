// Catcher's kit (chr_0020_meurs) and her equipment kits (wpn_claym_0003 Industry 0.1, wpn_claym_0009 Quencher,
// suit_poise01 Æthertech, suit_criti01 MI Security): the mechanics the kit plan
// (docs/kit-batches/batch-2/chr_0020_meurs.md, § Kit plan and § Kit) says must fire, on the example's build.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, earliestStart, init, type Build, type GameData, type KitBuff, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0020_meurs";
const P = C + "_";
const example = readScenario(new URL("../examples/catcher-counter.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in seconds. */
const op = (skill: string, at?: number): RotationAction => ({ operator: C, skill: P + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const MI = ["body_01", "hand_01", "edc_01", "edc_02"].map((p) => ({ id: `item_equip_t4_suit_criti01_${p}`, artifice: [3, 3, 3] as const }));

/** The example's scenario with Catcher's build changed, the enemy's actions replaced and no energy at the start. */
const scenario = (b: Partial<Build>, enemyActions: TimelineScenario["enemyActions"] = [], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => ({ ...m, ...b })),
  enemyActions,
  startEnergy: {},
  durationFrames: 30 * 30,
  ...extra,
});
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** Enemy actions at times in seconds. */
const attackAt = (...seconds: number[]): TimelineScenario["enemyActions"] => [{ kind: "attack", at: seconds.map((t) => Math.round(t * 30)) }];
const chargeAt = (...seconds: number[]): NonNullable<TimelineScenario["enemyActions"]> => [{ kind: "charge", at: seconds.map((t) => Math.round(t * 30)) }];
const hitsOf = (s: TimelineState, skill: string, hit?: string) => s.hits.filter((h) => h.skillId === skill && (hit === undefined || h.hitId === hit));
const strikes = (s: TimelineState) => hitsOf(s, "buff_chr_0020_meurs_potential_1");

describe("Catcher's battle skill", () => {
  it("not attacked: the jump 45 → 255 holds her 75 frames (exclusive 285), no bash, and the team gets half the energy", () => {
    const s = run(scenario({}), [op("normal_skill"), op("attack1")], 120);
    expect(s.casts.find((c) => c.skill === P + "attack1")?.frame).toBe(75);
    expect(hitsOf(s, P + "normal_skill")).toHaveLength(0);
    // Its cast: 30 returned SP and the team's Protection.
    expect(run(scenario({}), [op("normal_skill")], 1).spReturned).toBeCloseTo(30, 6);
    expect(run(scenario({}), [op("normal_skill")], 1).buffs.filter((b) => b.id === "protection").map((b) => [b.target, b.expiresAt])).toEqual([["team", 60]]);
    const attacked = run(scenario({}, attackAt(1)), [op("normal_skill")], 120);
    expect(hitsOf(attacked, P + "normal_skill", "bash")).toHaveLength(1);
    // Half at the cast, half at frame 60: only the counter path reaches it.
    expect(s.energy[C] ?? 0).toBeGreaterThan(0);
    expect(attacked.energy[C] ?? 0).toBeCloseTo(2 * (s.energy[C] ?? 0), 6);
  });

  it("attacked in frames 0–45: the counter jumps to 60, the bash lands at 83 − 30 with 1 Vulnerable and a P1 strike, she's free at MarkCanInterrupt 129 − 30, and the action ends at 194 − 30", () => {
    const sc = scenario({}, attackAt(1));
    const ctx = createContext(data, sc);
    const at30 = advance(ctx, apply(ctx, init(ctx), op("normal_skill")), 31);
    expect(at30.acting[C]?.skips).toEqual([{ from: 30, to: 60, at: 30, length: 30 }]);
    // Judged after the attack, the next step may start at the counter path's MarkCanInterrupt (129), before its end at 194.
    expect(earliestStart(ctx, at30, op("attack1"))).toEqual({ frame: 99 });
    const s = advance(ctx, at30, 200);
    expect(hitsOf(s, P + "normal_skill", "bash").map((h) => h.frame)).toEqual([53]);
    expect(strikes(s).map((h) => h.frame)).toEqual([53]);
    expect(s.enemy.vulnerable?.stacks).toBe(1);
    expect(s.acting[C]).toBeUndefined();
  });

  it("attacked after frame 45 (the skill has jumped to 255): no counter", () => {
    const s = run(scenario({}, attackAt(1.6)), [op("normal_skill")], 200);
    expect(hitsOf(s, P + "normal_skill")).toHaveLength(0);
  });

  it("P5: the bash returns potential5_atb (10) SP while the combo shield is up; not without it, nor below P5", () => {
    const charge: TimelineScenario["enemyActions"] = [...chargeAt(0.5), ...(attackAt(4) ?? [])];
    const withShield = (b: Partial<Build>) => run(scenario(b, charge), [op("combo_skill", 0.5), op("normal_skill", 3.8)], 160).spReturned;
    const noShield = (b: Partial<Build>) => run(scenario(b, attackAt(4)), [op("normal_skill", 3.8)], 160).spReturned;
    expect(withShield({}) - noShield({})).toBeCloseTo(10, 6);
    expect(withShield({ potential: 4 }) - noShield({ potential: 4 })).toBeCloseTo(0, 6);
  });
});

describe("Catcher's combo, ultimate, talents and P1", () => {
  it("the combo opens on an enemy's skill charge, not before: one asked for earlier waits for the charge", () => {
    const sc = scenario({}, chargeAt(2));
    const ctx = createContext(data, sc);
    // Until 2026-10-25 a combo waited only for hits and delayed actions to open its window (round-two review), so this was
    // an error ("its combo trigger hasn't happened"): the charge is an enemy action.
    expect(earliestStart(ctx, init(ctx), op("combo_skill"))).toEqual({ frame: 60 });
    expect(earliestStart(ctx, init(createContext(data, scenario({}, []))), op("combo_skill"))).toEqual({ error: `${P}combo_skill: its combo trigger hasn't happened (no open window at frame 0)` });
    const s = run(sc, [op("combo_skill", 2)], 120);
    expect(s.casts.find((c) => c.skill === P + "combo_skill")?.frame).toBe(60);
    expect(s.buffs.some((b) => b.id === "combo_shield")).toBe(true);
  });

  it("after waiting for its window, the combo is judged again where it would start (its availability, cooldown and gates)", () => {
    // A combo available only within the first second: waiting for the charge at 2 s moves it past that, which the start
    // must see (until 2026-10-25 the checks before the wait weren't made again).
    const kit = data.kits.operators[C] as OperatorKit;
    const early: KitBuff = { id: "t_early", label: "early", target: "self", duration: 1, modifiers: [] };
    const d: GameData = {
      ...data,
      kits: { ...data.kits, operators: { ...data.kits.operators, [C]: {
        ...kit,
        buffs: [...kit.buffs, early],
        triggers: [...kit.triggers, { id: "t_start", on: { event: "fightStart" }, by: "self", do: [{ kind: "buff", buff: "t_early" }] }],
        skills: kit.skills.map((s) => (s.skillId === P + "combo_skill" ? { ...s, available: { buffActive: "t_early" } } : s)),
      } } },
    };
    const ctx = createContext(d, scenario({}, chargeAt(2)));
    expect(earliestStart(ctx, init(ctx), op("combo_skill"))).toEqual({ error: `${P}combo_skill isn't available at frame 60 ({"buffActive":"t_early"})` });
    // Available all along, it starts at the charge.
    const always = createContext(d, scenario({}, chargeAt(0.5)));
    expect(earliestStart(always, init(always), op("combo_skill"))).toEqual({ frame: 15 });
  });

  it("the ultimate: Weakness on the enemy, a Knock Down stack, shockwaves by talent 2's level, and a P1 strike on every hit", () => {
    const ult = (b: Partial<Build>) => run(scenario(b, [], { startEnergy: { [C]: "full" } }), [op("ultimate_skill")], 200);
    const s = ult({});
    expect(s.buffs.some((b) => b.id === "weakness" && b.target === "enemy")).toBe(true);
    expect(hitsOf(s, P + "ultimate_skill").map((h) => h.hitId)).toEqual(["hit", "hit_2", "hit_3", "shockwave", "shockwave", "shockwave_3"]);
    expect(strikes(s)).toHaveLength(6);
    expect(strikes(ult({ talents: [1, 1] }))).toHaveLength(5);
    expect(strikes(ult({ talents: [1, 0] }))).toHaveLength(3);
    expect(strikes(ult({ potential: 0 }))).toHaveLength(0);
  });

  it("P1's strike is 300 + 5 × DEF, and talent 1 adds rate × ⌊Will / 10⌋ DEF (1.2 at level 2)", () => {
    const sc = scenario({}, [], { startEnergy: { [C]: "full" } });
    const panel = createContext(data, sc).panels.get(C);
    const def = panel?.attrs[3]?.total ?? NaN;
    const will = panel?.attrs[42]?.total ?? NaN;
    const base = (b: Partial<Build>) => strikes(run(scenario(b, [], { startEnergy: { [C]: "full" } }), [op("ultimate_skill")], 60))[0]?.zones.atk ?? NaN;
    expect(base({ talents: [0, 2] })).toBeCloseTo(300 + 5 * def, 4);
    expect(base({})).toBeCloseTo(300 + 5 * (def + 1.2 * Math.floor(will / 10)), 4);
  });
});

describe("Catcher's equipment", () => {
  it("Quencher: ATK + atk_up for 10 s after a Final Strike", () => {
    const s = run(scenario({}), [op("attack1"), op("attack2"), op("attack3"), op("attack4")], 150);
    const final = hitsOf(s, P + "attack4")[0]?.frame ?? NaN;
    expect(s.buffs.filter((b) => b.id === "wpn_claym_0009.atk").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[final, final + 300]]);
  });

  it("Industry 0.1: ATK up after a battle-skill hit (the bash), not after a battle skill without one", () => {
    const industry = { weapon: { id: "wpn_claym_0003", level: 90, skillLevels: [9, 9, 9] } };
    expect(run(scenario(industry), [op("normal_skill")], 120).buffs.some((b) => b.id === "wpn_claym_0003.atk")).toBe(false);
    const s = run(scenario(industry, attackAt(1)), [op("normal_skill")], 120);
    expect(s.buffs.filter((b) => b.id === "wpn_claym_0003.atk").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[53, 53 + 600]]);
  });

  it("Æthertech: one layer per Vulnerable on one refreshed timer (+0.08 Physical DMG each), and +0.16 more at 4 Vulnerable", () => {
    const ctx = createContext(data, example);
    let s = init(ctx);
    for (const a of example.rotation) s = apply(ctx, s, a);
    s = advance(ctx, s, example.durationFrames);
    const layers = s.buffs.filter((b) => b.id === "suit_poise01.dmg");
    expect(layers).toHaveLength(4);
    expect(new Set(layers.map((b) => b.expiresAt)).size).toBe(1);
    expect(s.buffs.filter((b) => b.id === "suit_poise01.dmg2")).toHaveLength(1);
    // The last strike (after the 4th Vulnerable) has 4 layers and the extra bonus over the first (1 layer).
    const st = strikes(s);
    expect((st.at(-1)?.zones.damageBonus ?? NaN) - (st[0]?.zones.damageBonus ?? NaN)).toBeCloseTo(3 * 0.08 + 0.16, 6);
    // beforeDamage: the bash that applies the Vulnerable already has its layer, as its strike does.
    expect(hitsOf(s, P + "normal_skill", "bash")[0]?.zones.damageBonus).toBeCloseTo(st[0]?.zones.damageBonus ?? NaN, 6);
  });

  it("MI Security: with crits, one ATK layer per crit on one timer; at 5 layers Crit Rate +5% until they end", () => {
    const sc = scenario({ gear: MI }, [], { options: { crit: "always" } });
    const chain = [op("attack1"), op("attack2"), op("attack3"), op("attack4"), op("attack1")];
    const s = run(sc, chain, 220);
    expect(s.buffs.filter((b) => b.id === "suit_criti01.atk")).toHaveLength(5);
    expect(s.buffs.some((b) => b.id === "suit_criti01.crit")).toBe(true);
    const later = run(sc, chain, 220 + 6 * 30);
    expect(later.buffs.some((b) => b.id.startsWith("suit_criti01."))).toBe(false);
    // With expected crits no hit counts as one.
    expect(run(scenario({ gear: MI }), chain, 220).buffs.some((b) => b.id.startsWith("suit_criti01."))).toBe(false);
  });
});

describe("Catcher: what the batch-2 merge added", () => {
  it("a step judged before the attack sees the counter path (jump 10 → 60, MarkCanInterrupt at 129: real 79)", () => {
    const sc = scenario({}, attackAt(10 / 30));
    const ctx = createContext(data, sc);
    const cast = apply(ctx, init(ctx), op("normal_skill"));
    expect(earliestStart(ctx, cast, op("attack1"))).toEqual({ frame: (cast.casts.at(-1)?.frame ?? NaN) + 129 - 50 });
  });

  it("her Protection and Weakness are buffs of those categories (attributes 63, 62)", () => {
    const kit = data.kits.operators[C];
    expect(kit?.buffs.find((b) => b.id === "protection")?.modifiers.map((m) => m.attr)).toEqual([63]);
    expect(kit?.buffs.find((b) => b.id === "weakness")?.modifiers.map((m) => m.attr)).toEqual([62]);
  });
});

describe("Catcher with dodging on", () => {
  it("doesn't dash at an attack her shield counters: the bash lands; an attack outside it is dodged", () => {
    const sc = (seconds: number): TimelineScenario => ({ ...scenario({}, attackAt(seconds)), options: { ...example.options, dodge: { chance: 1 } } });
    const countered = run(sc(10 / 30), [op("normal_skill")], 200);
    expect(hitsOf(countered, P + "normal_skill", "bash")).toHaveLength(1);
    expect(countered.casts.some((c) => c.skill === "dodge")).toBe(false);
    const later = run(sc(4), [op("normal_skill")], 200);
    expect(later.casts.some((c) => c.skill === "dodge")).toBe(true);
  });
});
