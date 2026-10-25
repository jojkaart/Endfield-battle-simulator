// Camille's kit (chr_0033_camille) and the weapons batch 4 gave her report (Blessing of Lustrous Carmine, Beacon of
// Duty, Golden Age): what the kit plan (docs/kit-batches/batch-4/chr_0033_camille.md, § Kit) says must fire, on the
// example scenario's builds (examples/camille-gilberta.scenario.json; Golden Age on Liino's).
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, earliestStart, init, skillParam, type Build, type LandedHit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData, type LogFixture } from "@efsim/data";
import { checkLog, readLogFixture, readScenario } from "@efsim/cli";

const data = loadGameData();
const C = "chr_0033_camille";
const G = "chr_0013_aglina";
const LI = "chr_0035_liino";
const example = readScenario(new URL("../examples/camille-gilberta.scenario.json", import.meta.url).pathname);
const liinoExample = readScenario(new URL("../examples/liino-laevatain.scenario.json", import.meta.url).pathname);
/** `at` in seconds. */
const cam = (skill: string, at?: number): RotationAction => ({ operator: C, skill: `${C}_${skill}`, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });
const gil = (skill: string, at?: number): RotationAction => ({ operator: G, skill: `${G}_${skill}`, ...(at !== undefined ? { at: Math.round(at * 30) } : {}) });

/** The example with Camille's build changed. */
const scenario = (b: Partial<Build>, extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  ...example,
  team: example.team.map((m) => (m.operator === C ? { ...m, ...b } : m)),
  ...extra,
});
const withWeapon = (id: string, extra: Partial<TimelineScenario> = {}) => scenario({ weapon: { id, level: 90, skillLevels: [9, 9, 9] } }, extra);
const run = (sc: TimelineScenario, rotation: readonly RotationAction[] = sc.rotation, until = sc.durationFrames): TimelineState => {
  const ctx = createContext(data, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, Math.max(s.frame, until));
};
/** The buffs active at the state's frame. */
const active = (s: TimelineState, id: string) => s.buffs.filter((b) => b.id === id && b.cast === undefined && b.appliedAt <= s.frame && b.expiresAt > s.frame);
const hitsOf = (s: TimelineState, skill: string, hitId?: string) => s.hits.filter((h) => h.operator === C && h.skillId === `${C}_${skill}` && (hitId === undefined || h.hitId === hitId));
const castOf = (s: TimelineState, skill: string, op = C) => s.casts.filter((c) => c.operator === op && c.skill === `${op}_${skill}`);
const from = (h: LandedHit | undefined, text: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(text));
const fired = (s: TimelineState, owner: string, trigger: string) =>
  Object.entries(s.triggerState).filter(([k]) => k === `${owner}:${trigger}` || k.startsWith(`${owner}:${trigger}:`)).reduce((n, [, v]) => n + v.count, 0);
/** Camille's battle skill, Gilberta's battle skill (its Nature on the Heat: Corrosion opens the combo), the combo. */
const opener = [cam("normal_skill"), gil("normal_skill", 1), cam("combo_skill")];

describe("Camille's kit", () => {
  const s = run(example);

  it("the battle skill: one Heat hit at frame 12 with its Infliction, the hovering Vesperwings already on it (P3: Heat Susceptibility 0.12), team energy at 12", () => {
    const st = run(example, [cam("normal_skill")], 60);
    const [hit] = hitsOf(st, "normal_skill");
    expect(hit?.frame).toBe(12);
    expect(hit?.element).toBe("fire");
    expect(hit?.zones.susceptibility).toBeCloseTo(1.12, 6);
    expect(st.enemy.infliction?.element).toBe("fire");
    const vw = active(st, "vesperwings");
    expect(vw.map((b) => [b.target, b.appliedAt, b.expiresAt])).toEqual([["enemy", 12, 12 + 60 * 30]]);
    // P0: 0.07 for 45 s.
    const p0 = run(scenario({ potential: 0 }), [cam("normal_skill")], 60);
    expect(hitsOf(p0, "normal_skill")[0]?.zones.susceptibility).toBeCloseTo(1.07, 6);
    expect(active(p0, "vesperwings")[0]?.expiresAt).toBe(12 + 45 * 30);
  });

  it("Gilberta's Corrosion consumes the Heat and opens the combo: hits at 19 / 27 / 47, the explosion (battle-skill DMG, 1.0) 12 frames after hit 3", () => {
    const st = run(example, opener, 400);
    const [combo] = castOf(st, "combo_skill");
    expect(combo).toBeDefined();
    const c = combo?.frame ?? 0;
    expect(hitsOf(st, "combo_skill").map((h) => h.frame - c)).toEqual([19, 27, 47]);
    // P3: ×1.3 on each multiplier.
    expect(hitsOf(st, "combo_skill", "hit_3")[0]?.zones.scale).toBeCloseTo(2.34, 5);
    const boom = st.hits.filter((h) => h.operator === C && h.hitId === "explosion");
    expect(boom.map((h) => [h.frame - c, h.skillId, h.element])).toEqual([[59, `${C}_normal_skill`, "fire"]]);
    expect(boom[0]?.zones.scale).toBeCloseTo(1, 6);
  });

  it("no hovering Vesperwings, no explosion, Link or heal; the combo still hits", () => {
    // The ultimate's Heat (no Vesperwings), then Gilberta's battle skill turns it into Corrosion: the window opens.
    const ctx = createContext(data, example);
    let st = advance(ctx, apply(ctx, apply(ctx, init(ctx), cam("ultimate_skill")), gil("normal_skill", 5)), 400);
    expect(st.comboWindow[C]).toBeDefined();
    st = advance(ctx, apply(ctx, st, cam("combo_skill")), 900);
    expect(castOf(st, "combo_skill")).toHaveLength(1);
    expect(hitsOf(st, "combo_skill")).toHaveLength(3);
    expect(st.link).toHaveLength(0);
    expect(st.hits.filter((h) => h.operator === C && h.hitId === "explosion")).toHaveLength(0);
    expect(fired(st, C, "bloodfount")).toBe(0);
    expect(active(st, "bloodfount")).toHaveLength(0);
  });

  it("talent 1: the combo on the hovering target gives the team one Link stack, which Gilberta's ultimate uses (×1.2); without talent 1, none", () => {
    const st = run(example, [...opener, gil("ultimate_skill", 7)], 900);
    const [ult] = castOf(st, "ultimate_skill", G);
    expect(ult?.link).toBe(1);
    const gHit = st.hits.find((h) => h.operator === G && h.skillId === `${G}_ultimate_skill`);
    expect(gHit?.zones.multiplicative).toBeCloseTo(1.2, 6);
    const noTalent = run(scenario({ talents: [0, 2] }), [...opener, gil("ultimate_skill", 7)], 900);
    expect(castOf(noTalent, "ultimate_skill", G)[0]?.link).toBeUndefined();
  });

  it("talent 1 heals Camille one frame after hit 3; talent 2 gives two Bloodfount layers each (Heat DMG 0.04 per layer for Camille, 0.01 for Gilberta), not on hit 3 itself", () => {
    const st = run(example, opener, 400);
    const c = castOf(st, "combo_skill")[0]?.frame ?? 0;
    const layers = active(st, "bloodfount");
    expect(layers.map((b) => b.appliedAt)).toEqual([c + 48, c + 48]);
    expect(layers[0]?.expiresAt).toBe(c + 48 + 40 * 30);
    expect(layers[0]?.modifiers.map((m) => [m.zone, m.value])).toEqual([["damageBonus", expect.closeTo(0.04, 6)]]);
    const team = active(st, "bloodfount_team");
    expect(team).toHaveLength(2);
    expect(team[0]?.modifiers[0]?.value).toBeCloseTo(0.01, 6);
    expect(from(hitsOf(st, "combo_skill", "hit_3")[0], "Bloodfount Revival")).toHaveLength(0);
    expect(from(st.hits.find((h) => h.operator === C && h.hitId === "explosion"), "Bloodfount Revival").length).toBeGreaterThan(0);
    // P5: atk_up 0.04 + 0.06.
    const p5 = run(scenario({ potential: 5 }), opener, 400);
    expect(active(p5, "bloodfount")[0]?.modifiers[0]?.value).toBeCloseTo(0.1, 6);
    // Without talent 2: no layers.
    expect(active(run(scenario({ talents: [2, 0] }), opener, 400), "bloodfount")).toHaveLength(0);
  });

  it("talent 2 counts a teammate's skill heal too (OnReceiveHeal; T2 toOwner): Liino's battle skill gives Camille layers without her combo", () => {
    const liino = liinoExample.team.find((m) => m.operator === LI) as Build;
    const sc: TimelineScenario = { ...example, team: [example.team.find((m) => m.operator === C) as Build, liino], startEnergy: {} };
    const st = run(sc, [{ operator: LI, skill: `${LI}_normal_skill` }], 30 * 10);
    expect(fired(st, C, "bloodfount")).toBeGreaterThan(0);
    expect(active(st, "bloodfount")).toHaveLength(5);
  });

  it("the ultimate: 7 + 1 + 1 hits, Heat Infliction on the last (frame 120), its SP before that hit's damage; Hunter Pursuit armed at 118 for 15 s", () => {
    const st = run(example, [cam("ultimate_skill")], 200);
    expect(hitsOf(st, "ultimate_skill").map((h) => h.frame)).toEqual([75, 77, 78, 80, 81, 83, 84, 104, 120]);
    expect(st.enemy.infliction?.element).toBe("fire");
    expect(run(example, [cam("ultimate_skill")], 119).enemy.infliction).toBeNull();
    // Lustrous Carmine: the SP at 120 (natural, skill source) gives the team ATK on that hit already.
    expect(from(hitsOf(st, "ultimate_skill", "hit_3")[0], "Flow: Absolver of Guilt (team ATK)").length).toBeGreaterThan(0);
    expect(from(hitsOf(st, "ultimate_skill", "hit_2")[0], "Flow: Absolver of Guilt (team ATK)")).toHaveLength(0);
    expect(active(st, "hunter_state").map((b) => [b.appliedAt, b.expiresAt])).toEqual([[118, 118 + 15 * 30]]);
  });

  it("Hunter Pursuit: only while armed, from the battle-skill button (the battle skill itself isn't castable then), no combo window; it ends the state", () => {
    const ctx = createContext(data, example);
    const fresh = init(ctx);
    expect(earliestStart(ctx, fresh, cam("combo_skill_2"))).toHaveProperty("error");
    let st = apply(ctx, fresh, cam("ultimate_skill"));
    st = advance(ctx, st, 140);
    expect(earliestStart(ctx, st, cam("normal_skill"))).toHaveProperty("error");
    st = apply(ctx, st, cam("combo_skill_2"));
    const [p] = castOf(st, "combo_skill_2");
    expect(p).toBeDefined();
    st = advance(ctx, st, (p?.frame ?? 0) + 120);
    expect(hitsOf(st, "combo_skill_2").map((h) => h.frame - (p?.frame ?? 0))).toEqual([20, 33, 49, 70]);
    expect(hitsOf(st, "combo_skill_2", "hit_4")[0]?.zones.scale).toBeCloseTo(3.2 * 1.3, 5);
    expect(active(st, "hunter_state")).toHaveLength(0);
    expect(earliestStart(ctx, st, cam("combo_skill_2"))).toHaveProperty("error");
    expect(earliestStart(ctx, st, cam("normal_skill"))).not.toHaveProperty("error");
    // A combo for everything else, but it leaves the regular combo's cooldown alone.
    expect(st.readyAt[`${C}_combo_skill`]).toBeUndefined();
  });

  it("Hunter Pursuit's Link and heal need talent 1 only (no Vesperwings); its explosion needs them", () => {
    const st = run(example, [cam("ultimate_skill"), cam("combo_skill_2")], 400);
    const p = castOf(st, "combo_skill_2")[0]?.frame ?? 0;
    expect(st.link).toHaveLength(1);
    expect(active(st, "bloodfount").map((b) => b.appliedAt)).toEqual([p + 71, p + 71]);
    expect(st.hits.filter((h) => h.operator === C && h.hitId === "explosion")).toHaveLength(0);
    const hovering = run(example, [cam("normal_skill"), cam("ultimate_skill"), cam("combo_skill_2")], 500);
    const p2 = castOf(hovering, "combo_skill_2")[0]?.frame ?? 0;
    expect(hovering.hits.filter((h) => h.operator === C && h.hitId === "explosion").map((h) => h.frame - p2)).toEqual([82]);
    expect(run(scenario({ talents: [0, 2] }), [cam("ultimate_skill"), cam("combo_skill_2")], 400).link).toHaveLength(0);
  });

  it("potentials from the data: P3 combo cooldown 16 s (18 below P3); P4 ultimate cost 110.5 (130 at P3)", () => {
    const cd = (p: number) => {
      const st = run(scenario({ potential: p }), opener, 400);
      return (st.readyAt[`${C}_combo_skill`] ?? 0) - (castOf(st, "combo_skill")[0]?.frame ?? 0);
    };
    // The build's 15% combo cooldown reduction (its gear) on 16 s and 18 s.
    expect(cd(3)).toBe(Math.round(16 * 30 * 0.85));
    expect(cd(2)).toBe(Math.round(18 * 30 * 0.85));
    const cost = (p: number) => skillParam(computeStats(data, { ...(example.team.find((m) => m.operator === C) as Build), potential: p }), `${C}_ultimate_skill`, "cost", 130);
    expect(cost(3)).toBeCloseTo(130, 4);
    expect(cost(4)).toBeCloseTo(110.5, 4);
  });

  it("Hunter Pursuit right after the ultimate starts in its window from 125 (it lists the button normal_skill_2, which casts combo_skill_2), not at its exclusive frames (133)", () => {
    const st = run(example, [cam("ultimate_skill"), cam("combo_skill_2")], 300);
    expect(castOf(st, "combo_skill_2")[0]?.frame).toBe(125);
  });

  it("the example: every skill cast, the totals stay as the kit report gives them", () => {
    expect(s.casts.filter((c) => c.operator === C).map((c) => c.skill.replace(`${C}_`, ""))).toEqual([
      "normal_skill", "combo_skill", "ultimate_skill", "combo_skill_2", "attack1", "attack2", "attack3", "attack4", "attack5",
    ]);
    expect(s.hits.filter((h) => h.operator === C && h.hitId === "explosion")).toHaveLength(2);
  });
});

describe("Camille's logs", () => {
  const fixture = (id: string) => readLogFixture(new URL(`../fixtures/zmdlogs-${id}.json`, import.meta.url).pathname);
  const kinds = (fx: LogFixture) => {
    const out: Record<string, number> = {};
    for (const v of checkLog(data, fx).filter((x) => x.hit.operator === C)) out[v.kind] = (out[v.kind] ?? 0) + 1;
    return out;
  };

  it("40d9: all 6 of Camille's hits match; Gilberta's ultimate after her combo carries one Link stack", () => {
    const fx = fixture("40d9a3c1da37");
    expect(kinds(fx)).toEqual({ match: 6 });
    // The replay has her combo's stack, but Si's ultimate 86 ms from Gilberta's could take it: there Link is tried (tests/batch4-logs.test.ts).
    // (The fallback's readings: the engine's reading there has a Corrosion the log doesn't list, tests/batch4-logs.test.ts.)
    const g = checkLog(data, fx, { engine: false }).filter((v) => v.hit.t === 12951 && v.hit.operator === G);
    expect(g.map((v) => (v.kind === "match" ? v.assumed : v.kind))).toEqual([["Link 1 (the replay can't say: Link stacks change within 500 ms of the cast)"]]);
  });

  it("4e5e: all 85 match, Lustrous Carmine's ATK after 49418 ms (which the log stops listing) from the kit-buff replay or written in as a logged effect", () => {
    const fx = fixture("4e5e1390085e");
    expect(kinds(fx)).toEqual({ match: 85 });
    const atk = { buff: "buff_wpn_lance_0015_atkup", zone: "atk" as const, element: null, value: 0.096 };
    const quantified = { ...fx, hits: fx.hits.map((h) => (h.t >= 49418 && !h.effects.some((e) => e.buff === atk.buff) ? { ...h, effects: [...h.effects, atk] } : h)) };
    expect(kinds(quantified)).toEqual({ match: 85 });
  });
});

describe("Blessing of Lustrous Carmine (wpn_lance_0015)", () => {
  it("the battle skill's Heat Infliction gives the team Heat DMG +9.6% (L4) for 20 s, already on the inflicting hit", () => {
    const st = run(example, [cam("normal_skill")], 60);
    const hit = hitsOf(st, "normal_skill")[0];
    expect(from(hit, "Flow: Absolver of Guilt (team Heat DMG)").map((m) => m.value)).toEqual([expect.closeTo(0.096, 6)]);
    expect(active(st, "wpn_lance_0015.heat").map((b) => [b.target, b.expiresAt])).toEqual([["team", 12 + 20 * 30]]);
  });

  it("the combo's natural SP (before hit 3's damage) gives the team ATK +9.6% for 20 s, on hit 3 itself; basic attacks' SP doesn't", () => {
    const st = run(example, opener, 400);
    expect(from(hitsOf(st, "combo_skill", "hit_2")[0], "Flow: Absolver of Guilt (team ATK)")).toHaveLength(0);
    expect(from(hitsOf(st, "combo_skill", "hit_3")[0], "Flow: Absolver of Guilt (team ATK)").map((m) => m.value)).toEqual([expect.closeTo(0.096, 6)]);
    const chain = run(example, ["attack1", "attack2", "attack3", "attack4", "attack5"].map((x) => cam(x)), 300);
    expect(chain.buffs.some((b) => b.id === "wpn_lance_0015.atk")).toBe(false);
  });
});

describe("Beacon of Duty (wpn_lance_0007) on Camille", () => {
  it("the battle skill's Heat Infliction: the wielder's Physical and Heat DMG +22.4% (L9, 20 s); its Heat Susceptibility (the Vesperwings): the team's +11.2% (30 s); both on the hit itself", () => {
    const st = run(withWeapon("wpn_lance_0007"), [cam("normal_skill")], 60);
    const hit = hitsOf(st, "normal_skill")[0];
    expect(from(hit, "Beacon of Duty: Physical and Heat DMG (Heat Infliction)").map((m) => m.value)).toEqual([expect.closeTo(0.224, 6)]);
    expect(from(hit, "Beacon of Duty: team Physical and Heat DMG (Heat Susceptibility)").map((m) => m.value)).toEqual([expect.closeTo(0.112, 6)]);
    expect(active(st, "wpn_lance_0007.infliction").map((b) => [b.target, b.expiresAt])).toEqual([["self", 12 + 20 * 30]]);
    expect(active(st, "wpn_lance_0007.susceptibility").map((b) => [b.target, b.expiresAt])).toEqual([["team", 12 + 30 * 30]]);
  });

  it("a basic attack's Heat doesn't count (battle, combo, ultimate only); the ultimate's Heat does", () => {
    const chain = run(withWeapon("wpn_lance_0007"), ["attack1", "attack2", "attack3", "attack4", "attack5"].map((x) => cam(x)), 300);
    expect(chain.buffs.some((b) => b.id.startsWith("wpn_lance_0007"))).toBe(false);
    const ult = run(withWeapon("wpn_lance_0007"), [cam("ultimate_skill")], 200);
    expect(active(ult, "wpn_lance_0007.infliction")).toHaveLength(1);
    expect(active(ult, "wpn_lance_0007.susceptibility")).toHaveLength(0);
  });
});

describe("Golden Age (wpn_lance_0016)", () => {
  it("on Camille: her combo hits give her Treatment Efficiency (no damage effect); her combo heals only herself, so no team Arts DMG", () => {
    const st = run(withWeapon("wpn_lance_0016"), opener, 400);
    expect(active(st, "wpn_lance_0016.heal")).toHaveLength(1);
    expect(st.buffs.some((b) => b.id === "wpn_lance_0016.arts")).toBe(false);
  });

  it("on Liino: her combo heals the controlled Laevatain, which gives the team Arts DMG +14% (L9) for 20 s", () => {
    const sc: TimelineScenario = {
      ...liinoExample,
      team: liinoExample.team.map((m) => (m.operator === LI ? { ...m, weapon: { id: "wpn_lance_0016", level: 90, skillLevels: [9, 9, 9] } } : m)),
    };
    const st = run(sc);
    const arts = st.buffs.filter((b) => b.id === "wpn_lance_0016.arts");
    expect(arts.length).toBeGreaterThan(0);
    expect(arts[0]?.target).toBe("team");
    expect(arts[0]?.modifiers.map((m) => m.value)).toEqual([0.14, 0.14, 0.14, 0.14].map((v) => expect.closeTo(v, 6)));
  });
});
