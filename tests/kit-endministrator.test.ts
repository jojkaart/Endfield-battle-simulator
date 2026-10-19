// The Endministrator's kit (chr_0003_endminf, and chr_0002_endminm as its variant) and the batch-2 equipment
// it owns (Prominent Edge, Tarr 11, Grizzled Edge, Bonekrusha, Armored MSGR): every trigger and buff the kit
// plan (docs/kit-batches/batch-2/chr_0003_endminf.md) says must fire, on the example scenario's team.
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, init, type Build, type GameData, type LandedHit, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const M = "chr_0003_endminf";
const P = M + "_";
const E = "chr_0021_whiten";
const G = "chr_0013_aglina";
const example = readScenario(new URL("../examples/endministrator-crystals.scenario.json", import.meta.url).pathname);
/** Rotation steps; `at` in seconds (RotationAction.at is in frames). */
const step = (operator: string, skill: string, at?: number): RotationAction => ({ operator, skill: operator + "_" + skill, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const m = (skill: string, at?: number) => step(M, skill, at);
const e = (skill: string, at?: number) => step(E, skill, at);
const g = (skill: string) => step(G, skill);

/** The example's team with the Endministrator's build changed. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((x) => (x.operator === M ? { ...x, ...b } : x)),
  ...extra,
});
const run = (sc: TimelineScenario, rotation: readonly RotationAction[], g0: GameData = data, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(g0, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
// Gilberta's ultimate (Nature), Estella's battle skill (Cryo → Solidification), Gilberta's combo (its hit opens the
// Endministrator's window; its Lift adds a Vulnerable stack), then her combo: the enemy is sealed.
const sealed: RotationAction[] = [g("ultimate_skill"), e("normal_skill", 2.1), g("combo_skill"), m("combo_skill")];
const mine = (s: TimelineState) => s.hits.filter((h) => h.operator === M);
const fired = (s: TimelineState, owner: string, trigger: string) => s.triggerState[`${owner}:${trigger}`]?.count ?? 0;
const mod = (h: LandedHit | undefined, source: string) => h?.modifiers.filter((x) => x.source.includes(source)).reduce((t, x) => t + x.value, 0) ?? 0;
const TALENT_2 = "Realspace Stasis";
const TALENT_1 = "Essence Disintegration";
const P2 = "Reflection of Authority";

describe("the Endministrator's kit", () => {
  it("one kit for both IDs: chr_0002_endminm gets its own skill IDs and log keys, the shared game buffs stay", () => {
    const male = data.kits.operators["chr_0002_endminm"] as OperatorKit;
    const female = data.kits.operators[M] as OperatorKit;
    expect(male.skills.map((s) => s.skillId).sort()).toEqual(female.skills.map((s) => s.skillId.replace(P, "chr_0002_endminm_").replace("power_attack2", "power_attack")).sort());
    expect(male.buffs.map((b) => b.gameBuff)).toEqual(female.buffs.map((b) => b.gameBuff));
    const combo = male.skills.find((s) => s.kind === "combo");
    expect(combo?.hits[0]?.events).toContain("chr_0002_endminm_combo_skill");
    expect(JSON.stringify(male)).not.toMatch(/"chr_0003_endminf_/);
    expect(data.kits.operators["chr_9000_endmin"]).toBeUndefined();
    // Talents from the virtual character: talent 1 (index 0) ATK +0.30, talent 2 (index 1) +0.20 Physical DMG taken.
    const s = run(scenario(), [...sealed, m("normal_skill"), m("ultimate_skill")]);
    expect(mod(mine(s).find((h) => h.skillId === P + "combo_skill" && h.hitId === "hit"), TALENT_2)).toBeCloseTo(0.2, 6);
    expect(mod(mine(s).find((h) => h.skillId === P + "ultimate_skill"), TALENT_1)).toBeCloseTo(0.3, 6);
    // The male Endministrator in the example's place lands the same hits for the same damage (only animation tails differ).
    const swap = <T>(x: T): T => JSON.parse(JSON.stringify(x).replaceAll(P, "chr_0002_endminm_").replaceAll(M, "chr_0002_endminm")) as T;
    const male0 = run(swap(example), swap(example.rotation));
    const female0 = run(example, example.rotation);
    const summary = (st: TimelineState, op: string) => st.hits.filter((h) => h.operator === op).map((h) => `${h.skillId.replace(op + "_", "").replace("power_attack2", "power_attack")} ${h.hitId} ${h.damage}`);
    expect(summary(male0, "chr_0002_endminm")).toEqual(summary(female0, M));
  });

  it("the example:her Crush on the sealed enemy, the crystal hit, P1's SP, Grizzled Edge ×1.5, talent 1, P2, P5, Prominent Edge", () => {
    const s = run(example, example.rotation);
    const bs = s.casts.find((c) => c.skill === P + "normal_skill");
    const at = (bs?.frame ?? NaN) + 11;
    const there = mine(s).filter((h) => h.frame === at);
    expect(there.map((h) => `${h.skillId} ${h.hitId}`).sort()).toEqual([`${P}combo_skill shatter`, `${P}normal_skill hit`, "reaction:crush physical:1"].sort());
    // Crush's own DamageAction and the crystal hit see the crystals (talent 2); talent 1 comes after them.
    for (const h of there) expect(mod(h, TALENT_2)).toBeCloseTo(0.2, 6);
    for (const h of there) expect(mod(h, TALENT_1)).toBe(0);
    // The crystal hit: atk_scale_trigger 4.0 of the combo, as a combo-kind hit.
    const shatter = there.find((h) => h.hitId === "shatter");
    expect(shatter?.scaleParts.map((p) => [p.key, p.value])).toEqual([["atk_scale_trigger", 4]]);
    // Grizzled Edge: 1 Vulnerable stack × 0.06 × 1.5 (the crystals were there at the event), on the Crush and its hit.
    expect(fired(s, M, "suit_crush_fracture.on_status_sealed")).toBe(1);
    expect(fired(s, M, "suit_crush_fracture.on_status")).toBe(0);
    for (const h of there) expect(mod(h, "Grizzled Edge")).toBeCloseTo(0.09, 6);
    // P1: 50 returned SP at frame 11, before the Crush consumed the crystals (plus the Final Strike's 20).
    expect(fired(s, M, "p1_sp")).toBe(1);
    expect(s.spReturned).toBeCloseTo(70, 6);
    // Afterwards: talent 1 on her, P2's half on the teammates, the crystals gone.
    expect(mod(mine(s).find((h) => h.skillId === P + "ultimate_skill"), TALENT_1)).toBeCloseTo(0.3, 6);
    expect(mod(s.hits.find((h) => h.operator === E && h.skillId === E + "_combo_skill"), P2)).toBeCloseTo(0.15, 6);
    expect(s.buffs.some((b) => b.id === "originium_crystals")).toBe(false);
    // P5: the battle skill and the ultimate each cut the combo's 15 s cooldown by 2 s.
    const combo = s.casts.find((c) => c.skill === P + "combo_skill")?.frame ?? NaN;
    expect(fired(s, M, "p5_cooldown")).toBe(2);
    expect(s.readyAt[P + "combo_skill"]).toBe(combo + 15 * 30 - 2 * 2 * 30);
    // Prominent Edge: ATK +33.6% from the battle skill's hit on.
    expect(mod(mine(s).find((h) => h.skillId === P + "ultimate_skill"), "Prominent Edge")).toBeCloseTo(0.336, 3);
    expect(mod(mine(s).find((h) => h.skillId === P + "normal_skill"), "Prominent Edge")).toBe(0);
  });

  it("a teammate's Lift consumes the crystals (through its Vulnerable stack): the crystal hit is hers, talent 1 and P2 follow", () => {
    const s = run(example, [...sealed, e("combo_skill", 5.4)], data, 10 * 30);
    const lift = s.reactions.find((r) => r.kind === "physical" && r.operator === E);
    expect(lift).toBeDefined();
    const shatter = mine(s).find((h) => h.hitId === "shatter");
    expect(shatter?.frame).toBe(lift?.frame);
    expect(mod(shatter, TALENT_2)).toBeCloseTo(0.2, 6);
    expect(mod(shatter, TALENT_1)).toBe(0);
    expect(fired(s, M, "crystals_vulnerable")).toBe(1);
    expect(s.buffs.some((b) => b.id === "essence_disintegration" && b.owner === M)).toBe(true);
    expect(s.buffs.some((b) => b.id === "essence_disintegration_team" && b.recipients?.includes(E) && !b.recipients.includes(M))).toBe(true);
  });

  it("a Breach consumes the crystals before its own damage: Breach's hit and the hit applying it get talent 1, not talent 2", () => {
    // Test-only: her attack1 Breaches (Gilberta's Lift left one Vulnerable stack).
    const kit = data.kits.operators[M] as OperatorKit;
    const skills = kit.skills.map((s) => (s.skillId === P + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, applies: [{ kind: "physicalStatus" as const, status: "breach" as const }] })) } : s));
    const g0: GameData = { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [M]: { ...kit, skills } } } };
    const s = run({ ...example, controlled: M }, [...sealed, m("attack1", 5.4)], g0);
    expect(fired(s, M, "crystals_breach")).toBe(1);
    const a1 = mine(s).find((h) => h.skillId === P + "attack1");
    const breach = mine(s).find((h) => h.skillId === "reaction:breach");
    const shatter = mine(s).find((h) => h.hitId === "shatter");
    expect(mod(shatter, TALENT_2)).toBeCloseTo(0.2, 6);
    for (const h of [a1, breach]) {
      expect(mod(h, TALENT_2)).toBe(0);
      expect(mod(h, TALENT_1)).toBeCloseTo(0.3, 6);
    }
  });

  it("the ultimate on the sealed enemy: its hit, the break hit and the crystal hit, then talent 1, P3's 15 energy and the crystals end", () => {
    const s = run(example, [...sealed, m("ultimate_skill")], data, 10 * 30);
    const ult = s.casts.find((c) => c.skill === P + "ultimate_skill")?.frame ?? NaN;
    const hits = mine(s).filter((h) => h.skillId === P + "ultimate_skill");
    expect(hits.map((h) => h.hitId).sort()).toEqual(["break", "hit", "shatter"]);
    for (const h of hits) {
      expect(mod(h, TALENT_2)).toBeCloseTo(0.2, 6);
      expect(mod(h, TALENT_1)).toBe(0);
    }
    // P4: the ultimate's atk_scale and originum_ult_break_scale ×1.2; the crystal hit is the combo's atk_scale_trigger.
    expect(hits.find((h) => h.hitId === "break")?.scaleParts[0]?.value).toBeCloseTo(6 * 1.2, 5);
    expect(hits.find((h) => h.hitId === "shatter")?.scaleParts.map((p) => p.value)).toEqual([4]);
    expect(fired(s, M, "crystals_ultimate")).toBe(1);
    expect(s.energy[M]).toBeCloseTo(15, 6);
    expect(s.buffs.some((b) => b.id === "originium_crystals")).toBe(false);
    expect(s.buffs.some((b) => b.id === "essence_disintegration" && b.appliedAt === ult + 51)).toBe(true);
    // Without crystals the ultimate is one hit and gives no energy.
    const plain = run(example, [m("ultimate_skill")]);
    expect(mine(plain).map((h) => h.hitId)).toEqual(["hit"]);
    expect(plain.energy[M]).toBe(0);
  });

  it("potentials: at P0 no SP, energy, team ATK or cooldown cut; talent 1 unlearned gives no ATK", () => {
    const rotation = [...sealed, m("normal_skill"), e("combo_skill", 6.3), m("ultimate_skill")];
    const p0 = run(scenario({ potential: 0 }), rotation);
    expect(p0.spReturned).toBe(0);
    expect(fired(p0, M, "p5_cooldown")).toBe(0);
    expect(mod(p0.hits.find((h) => h.operator === E && h.skillId === E + "_combo_skill"), P2)).toBe(0);
    const combo = p0.casts.find((c) => c.skill === P + "combo_skill")?.frame ?? NaN;
    expect(p0.readyAt[P + "combo_skill"]).toBe(combo + 15 * 30);
    const noTalent = run(scenario({ talents: [0, 2] }), rotation);
    expect(mine(noTalent).every((h) => mod(h, TALENT_1) === 0)).toBe(true);
  });

  it("Grizzled Edge without crystals: Physical DMG +0.06 per Vulnerable stack consumed", () => {
    // Estella's Lift consumes the crystals first (2 Vulnerable stacks), then her battle skill Crushes at level 2.
    const s = run(example, [...sealed, e("combo_skill", 5.4), m("normal_skill", 6.5)]);
    expect(fired(s, M, "suit_crush_fracture.on_status")).toBe(1);
    expect(fired(s, M, "suit_crush_fracture.on_status_sealed")).toBe(0);
    expect(mod(mine(s).find((h) => h.skillId === "reaction:crush"), "Grizzled Edge")).toBeCloseTo(0.12, 6);
  });

  it("Bonekrusha: a layer per combo, at most 2; the next battle skill uses all of them", () => {
    const gear: Build["gear"] = [
      { id: "item_equip_t4_suit_attri01_body_01", artifice: [3, 3, 3] },
      { id: "item_equip_t4_suit_attri01_hand_01", artifice: [3, 3, 3] },
      { id: "item_equip_t4_suit_attri01_edc_03", artifice: [3, 3, 3] },
    ];
    // Test-only: no combo trigger, so the combo is castable whenever it's off cooldown.
    const kit = data.kits.operators[M] as OperatorKit;
    const g0: GameData = { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [M]: { ...kit, triggers: kit.triggers.filter((t) => t.id !== "combo_window") } } } };
    const solo = (rotation: RotationAction[]) => run({ ...scenario({ gear, potential: 0 }), team: [{ ...(example.team[0] as Build), gear, potential: 0 }], durationFrames: 60 * 30 }, rotation, g0);
    const bonus = (s: TimelineState, i: number) => mod(mine(s).filter((h) => h.skillId === P + "normal_skill")[i], "Bonekrushing Smash");
    const one = solo([m("combo_skill"), m("normal_skill"), m("normal_skill", 12)]);
    expect(bonus(one, 0)).toBeCloseTo(0.3, 6);
    expect(bonus(one, 1)).toBe(0);
    const three = solo([m("combo_skill"), m("combo_skill", 16), m("combo_skill", 32), m("normal_skill")]);
    expect(fired(three, M, "suit_attri01.on_combo")).toBe(3);
    expect(bonus(three, 0)).toBeCloseTo(0.6, 6);
    // Its battle-skill bonus doesn't act on other hits.
    expect(mine(three).filter((h) => h.skillId === P + "combo_skill").every((h) => mod(h, "Bonekrushing Smash") === 0)).toBe(true);
  });

  it("Tarr 11 and Armored MSGR are stat-panel only: their kits have no triggers", () => {
    for (const id of ["wpn_sword_0003", "suit_str01"]) {
      const k = data.kits.equipment[id];
      expect(k).toBeDefined();
      expect(k?.triggers ?? []).toEqual([]);
    }
    const tarr = computeStats(data, { ...(example.team[0] as Build), weapon: { id: "wpn_sword_0003", level: 90, skillLevels: [9, 9] } });
    expect(tarr.atk.flat).toBeCloseTo(33.6, 3);
  });
});
