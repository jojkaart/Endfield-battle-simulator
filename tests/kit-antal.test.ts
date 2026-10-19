// Antal's kit (chr_0023_antal) and the equipment batch 2 gave him (wpn_funnel_0001, wpn_funnel_0003, suit_pulse_cryst01):
// the mechanics the kit plan (docs/kit-batches/batch-2/chr_0023_antal.md) says must fire, on the example scenario's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const A = "chr_0023_antal";
const P = A + "_";
const G = "chr_0013_aglina";
const L = "chr_0016_laevat";
const example = readScenario(new URL("../examples/antal-focus.scenario.json", import.meta.url).pathname);
const op = (skill: string, at?: number): RotationAction => ({ operator: A, skill: P + skill, ...(at !== undefined ? { at } : {}) });

const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
/** The example with Antal's build changed. */
const withAntal = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === A ? { ...m, ...b } : m)),
  ...extra,
});
/** Antal alone, no enemy attacks. */
const solo = (b: Partial<Build>): TimelineScenario => ({ ...withAntal(b), team: (withAntal(b).team.filter((m) => m.operator === A)), enemyActions: [], durationFrames: 60 * 30 });
const fromSource = (h: LandedHit, text: string) => h.modifiers.filter((m) => m.source.includes(text));
const fired = (s: TimelineState, trigger: string) =>
  Object.entries(s.triggerState).filter(([k]) => k === `${A}:${trigger}` || k.startsWith(`${A}:${trigger}:`)).reduce((n, [, v]) => n + v.count, 0);
const chain = ["attack1", "attack2", "attack3", "attack4"].map((s) => op(s));

describe("Antal's kit", () => {
  const s = run(example);
  const mine = s.hits.filter((h) => h.operator === A);

  it("Focus: the battle-skill hit already has its Electric and Heat Susceptibility (rate 0.10)", () => {
    const sc = solo({ potential: 0 });
    const hit = run(sc, [op("normal_skill")]).hits.find((h) => h.skillId === P + "normal_skill");
    expect(hit?.zones.susceptibility).toBeCloseTo(1.1, 6);
  });

  it("the combo repeats what opened its window: a Lift after Gilberta's forced Lift, a Nature burst after her Nature explosion", () => {
    const combos = s.casts.filter((c) => c.operator === A && c.skill === P + "combo_skill");
    expect(combos).toHaveLength(2);
    const lift = s.reactions.filter((r) => r.kind === "physical" && r.operator === A);
    expect(lift).toEqual([expect.objectContaining({ status: "lift", forced: false })]);
    expect(s.reactions.filter((r) => r.kind === "burst" && r.operator === A)).toEqual([expect.objectContaining({ element: "natural" })]);
    // Exactly one of the two applications acts: no infliction from the Lift-opened combo, no physical status from the other.
    expect(s.reactions.filter((r) => r.operator === A && (r.kind === "inflicted" || r.kind === "reaction"))).toHaveLength(0);
  });

  it("Overclocked Moment: Laevatain's Heat hits under it have Amp 0.22 at P1 and up (0.20 × 1.1), 0.20 at P0", () => {
    const amp = (st: TimelineState) => [...new Set(st.hits.filter((h) => h.operator === L && h.zones.amp > 1).map((h) => h.zones.amp.toFixed(6)))];
    expect(amp(s)).toEqual(["1.220000"]);
    expect(amp(run(withAntal({ potential: 0 })))).toEqual(["1.200000"]);
  });

  it("P5: Focus held 20 s adds 0.04 Susceptibility until the next battle skill; below P5 nothing", () => {
    const rotation = [op("normal_skill"), ...chain.map((a, i) => (i === 0 ? { ...a, at: 22 * 30 } : a)), op("normal_skill", 30 * 30), op("attack1")];
    const susc = (st: TimelineState) => st.hits.filter((h) => h.operator === A && h.skillId !== P + "normal_skill").map((h) => Number(h.zones.susceptibility.toFixed(6)));
    const p5 = susc(run(solo({}), rotation));
    // attack1–4 after 22 s (five landings), then attack1 after the re-cast: back to the plain Focus.
    expect(p5).toEqual([1.14, 1.14, 1.14, 1.14, 1.14, 1.14, 1.1]);
    expect(new Set(susc(run(solo({ potential: 4 }), rotation)))).toEqual(new Set([1.1]));
  });

  it("talent 1 heals each Amped operator after a skill hit, once per 30 s each; talent 2 on Physical enemy attacks only", () => {
    expect(Object.keys(s.triggerState).filter((k) => k.startsWith(`${A}:talent1_heal:`)).sort()).toEqual([`${A}:talent1_heal:${G}`, `${A}:talent1_heal:${L}`, `${A}:talent1_heal:${A}`]);
    expect(fired(s, "talent1_heal")).toBe(3);
    expect(fired(s, "talent2_heal")).toBeGreaterThan(0);
    const heat = run({ ...example, enemyActions: example.enemyActions?.map((a) => ({ ...a, element: "fire" as const })) ?? [] });
    expect(fired(heat, "talent2_heal")).toBe(0);
    const unlearned = run(withAntal({ talents: [0, 0] }));
    expect(fired(unlearned, "talent1_heal") + fired(unlearned, "talent2_heal")).toBe(0);
  });

  it("Fluorescent Roc: ATK +33.6% after the battle-skill hit, not on that hit", () => {
    const battle = mine.find((h) => h.skillId === P + "normal_skill");
    expect(battle && fromSource(battle, "Fluorescent Roc")).toEqual([]);
    const combo = mine.find((h) => h.skillId === P + "combo_skill");
    expect(combo && fromSource(combo, "Fluorescent Roc").map((m) => m.value)).toEqual([expect.closeTo(0.336, 6)]);
  });

  it("Hypernova Auto: ATK +42% from the start (full HP assumed)", () => {
    const st = run(solo({ weapon: { id: "wpn_funnel_0001", level: 90, skillLevels: [9, 9, 9] } }), [op("normal_skill")]);
    const hit = st.hits.find((h) => h.skillId === P + "normal_skill");
    expect(hit && fromSource(hit, "Hypernova Auto").map((m) => m.value)).toEqual([expect.closeTo(0.42, 6)]);
  });
});

describe("Pulser Labs (suit_pulse_cryst01) on other wearers", () => {
  const pulser: Build["gear"] = ["hand_01", "body_01", "edc_01"].map((p) => ({ id: `item_equip_t4_suit_pulse_cryst01_${p}`, artifice: [3, 3, 3] as const }));

  it("Estella's Solidification gives her Cryo DMG +50% for 10 s", () => {
    const sc = readScenario(new URL("../examples/estella-solidification.scenario.json", import.meta.url).pathname);
    const E = "chr_0021_whiten";
    const worn = { ...sc, team: sc.team.map((m) => (m.operator === E ? { ...m, gear: pulser } : m)) };
    // Her battle skill (at 3.7 s) Solidifies the Nature-inflicted enemy at its hit; her only Cryo hit is that one, so look at the buff.
    const st = run(worn, sc.rotation.slice(0, 2), 150);
    const solid = st.reactions.find((r) => r.kind === "reaction" && r.status === "solidification" && r.operator === E);
    expect(solid).toBeDefined();
    const buff = st.buffs.find((b) => b.owner === E && b.id === "suit_pulse_cryst01.cryo_dmg");
    expect(buff && { at: buff.appliedAt, span: buff.expiresAt - buff.appliedAt }).toEqual({ at: solid?.frame, span: 300 });
    expect(buff?.modifiers.map((m) => [m.zone, m.element, m.value])).toEqual([["damageBonus", "cryst", 0.5]]);
    expect(st.buffs.some((b) => b.id === "suit_pulse_cryst01.electric_dmg")).toBe(false);
  });

  it("Liino's forced Electrification gives her Electric DMG +50%", () => {
    const sc = readScenario(new URL("../examples/liino-laevatain.scenario.json", import.meta.url).pathname);
    const Li = "chr_0035_liino";
    const st = run({ ...sc, team: sc.team.map((m) => (m.operator === Li ? { ...m, gear: pulser } : m)) });
    const elec = st.reactions.find((r) => r.kind === "reaction" && r.status === "electrification" && r.operator === Li);
    expect(elec).toBeDefined();
    const after = st.hits.filter((h) => h.operator === Li && h.element === "pulse" && h.frame > (elec?.frame ?? Infinity) && h.frame <= (elec?.frame ?? 0) + 300);
    expect(after.length).toBeGreaterThan(0);
    for (const h of after) expect(fromSource(h, "Pulser Labs: Electric DMG up").map((m) => m.value)).toEqual([0.5]);
  });
});
