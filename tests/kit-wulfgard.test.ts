// Wulfgard's kit (chr_0006_wolfgd) and the equipment kits of his batch-3 report (Rational Farewell, Opus: The Living,
// OBJ Velocitous): the mechanics the kit plan (docs/kit-batches/batch-3/chr_0006_wolfgd.md, § Kit plan and § Kit)
// says must fire, on the example's builds.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const W = "chr_0006_wolfgd";
const P = W + "_";
const F = "chr_0022_bounda";
const example = readScenario(new URL("../examples/wulfgard-fluorite.scenario.json", import.meta.url).pathname);
/** A rotation step; `at` in frames. */
const op = (skill: string, at?: number): RotationAction => ({ operator: W, skill: P + skill, ...(at !== undefined ? { at } : {}) });
const fluorite = (skill: string, at?: number): RotationAction => ({ operator: F, skill: `${F}_${skill}`, ...(at !== undefined ? { at } : {}) });
const weapon = (id: string) => ({ weapon: { id, level: 90, skillLevels: [9, 9, 9] as [number, number, number] } });

/** The example's team with Wulfgard's build changed (alone unless `duo`), no energy at the start unless given. */
const scenario = (b: Partial<Build> = {}, extra: Partial<TimelineScenario> = {}, duo = false): TimelineScenario => ({
  ...example,
  team: example.team.filter((m) => duo || m.operator === W).map((m) => (m.operator === W ? { ...m, ...b } : m)),
  startEnergy: {},
  durationFrames: 40 * 30,
  ...extra,
});
const full = { startEnergy: { [W]: "full" as const } };
const run = (sc: TimelineScenario, rotation: RotationAction[], until = sc.durationFrames, d: GameData = data): TimelineState => {
  const ctx = createContext(d, sc);
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const mine = (s: TimelineState, skill?: string) => s.hits.filter((h) => h.operator === W && (skill === undefined || h.skillId === P + skill));
const castAt = (s: TimelineState, skill: string, n = 0) => s.casts.filter((c) => c.operator === W && c.skill === P + skill)[n]?.frame ?? NaN;
const from = (h: { modifiers: readonly { source: string; zone: string; value: number }[] } | undefined, label: string) => (h?.modifiers ?? []).filter((m) => m.source.includes(label));
const kit = data.kits.operators[W] as OperatorKit;
/** Wulfgard's kit with extra triggers (a reaction already on the enemy at the start of the fight, …). */
const withTriggers = (...triggers: KitTrigger[]): GameData => ({ ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [W]: { ...kit, triggers: [...kit.triggers, ...triggers] } } } });
const forcedAtStart = (status: "combustion" | "electrification"): KitTrigger => ({ id: `test_${status}`, on: { event: "fightStart" }, by: "self", do: [{ kind: "apply", applies: [{ kind: "forcedReaction", status }] }] });
const combusted = withTriggers(forcedAtStart("combustion"));
const electrified = withTriggers(forcedAtStart("electrification"));

describe("Wulfgard's basic attacks", () => {
  it("one hit per projectile at its launch frame; attack4 is the Final Strike with 18 SP and 18 Stagger as the controlled operator", () => {
    const s = run(scenario(), [op("attack1"), op("attack2"), op("attack3"), op("attack4")]);
    for (const [skill, frames] of [["attack1", [7, 14]], ["attack2", [10, 16]], ["attack3", [12, 18, 24]], ["attack4", [23]]] as const) {
      expect(mine(s, skill).map((h) => h.frame - castAt(s, skill))).toEqual(frames);
    }
    const fs = data.kits.operators[W]?.skills.find((k) => k.skillId === P + "attack4")?.hits[0];
    expect(fs?.finalStrike).toBe(true);
    expect(fs?.poiseControlledOnly).toBe(true);
    // SP: regen only, plus attack4's 18 (attacks 1-3 grant atb × 0.5 / 0.333 of 0).
    const at = castAt(s, "attack4") + 23;
    const before = run(scenario(), [op("attack1"), op("attack2"), op("attack3"), op("attack4")], at - 1);
    const after = run(scenario(), [op("attack1"), op("attack2"), op("attack3"), op("attack4")], at);
    expect(after.sp - before.sp).toBeGreaterThan(17.9);
    expect(after.sp - before.sp).toBeLessThan(18.5);
  });

  it("a projectile is the cast's own until it's launched: a battle skill cutting attack3 after its second shot drops the third", () => {
    const s = run(scenario(), [op("attack1"), op("attack2"), op("attack3"), op("normal_skill")]);
    const cut = castAt(s, "normal_skill") - castAt(s, "attack3");
    const shots = mine(s, "attack3").map((h) => h.frame - castAt(s, "attack3"));
    expect(shots).toEqual([12, 18, 24].filter((f) => f <= cut));
  });
});

describe("Thermite Tracers (battle skill)", () => {
  it("plain: shots at 6, 16 and 23 (the last inflicts Heat), no additional shot; MarkCanInterrupt frees him at 48", () => {
    const s = run(scenario(), [op("normal_skill"), op("attack1")]);
    const cast = castAt(s, "normal_skill");
    expect(mine(s, "normal_skill").map((h) => [h.hitId, h.frame - cast])).toEqual([["shot1", 6], ["shot2", 16], ["shot3", 23]]);
    const heatAt = (f: number) => run(scenario(), [op("normal_skill")], f).enemy.infliction?.element ?? null;
    expect(heatAt(cast + 22)).toBeNull();
    expect(heatAt(cast + 23)).toBe("fire");
    // MarkCanInterrupt 48 (S1): the step without `at` doesn't wait for the frame-141 shot that the 117 → 247 jump skips.
    expect(castAt(s, "attack1") - cast).toBe(48);
    // Nothing lands later, even without a next action (the jump drops the frame-141 launch).
    const alone = run(scenario(), [op("normal_skill")]);
    expect(mine(alone, "normal_skill").map((h) => h.hitId)).toEqual(["shot1", "shot2", "shot3"]);
  });

  it("on a Combusted enemy: the 31 → 118 jump, the final shot without infliction, the additional shot at real 54 (8.5 × ATK) consumes Combustion after its damage", () => {
    const s = run(scenario(), [op("normal_skill"), op("attack1")], 40 * 30, combusted);
    const cast = castAt(s, "normal_skill");
    const hits = mine(s, "normal_skill");
    expect(hits.map((h) => [h.hitId, h.frame - cast])).toEqual([["shot1", 6], ["shot2", 16], ["shot3_reaction", 23], ["extra_shot", 54]]);
    const extra = hits.find((h) => h.hitId === "extra_shot");
    expect(extra?.scaleParts.map((p) => [p.key, p.value])).toEqual([["atk_scale_plus", expect.closeTo(8.5, 6)]]);
    expect(s.enemy.infliction).toBeNull();
    expect(s.reactions.filter((r) => r.kind === "statusConsumed").map((r) => [r.frame - cast, r.kind === "statusConsumed" ? r.status : null])).toEqual([[54, "combustion"]]);
    expect(s.enemy.statuses.some((x) => x.status === "combustion")).toBe(false);
    // The reaction path skips the mark at 48: he is held until the exclusive frame 159 (real 72).
    expect(castAt(s, "attack1") - cast).toBe(72);
  });

  it("on an Electrified enemy: the additional shot keeps Electrification's Arts DMG Taken (consumed after its damage)", () => {
    const s = run(scenario(), [op("normal_skill")], 40 * 30, electrified);
    const cast = castAt(s, "normal_skill");
    const extra = mine(s, "normal_skill").find((h) => h.hitId === "extra_shot");
    expect(extra?.frame).toBe(cast + 54);
    const shot1 = mine(s, "normal_skill").find((h) => h.hitId === "shot1");
    // The same Arts DMG Taken on the first shot (before the consumption) and on the additional one.
    const taken = (h: typeof extra) => from(h, "Electrification").map((m) => m.value);
    expect(taken(extra).length).toBeGreaterThan(0);
    expect(taken(extra)).toEqual(taken(shot1));
    expect(s.reactions.filter((r) => r.kind === "statusConsumed").map((r) => (r.kind === "statusConsumed" ? r.status : null))).toEqual(["electrification"]);
  });

  it("with both Combustion and Electrification only Combustion is consumed (the data's IfElse)", () => {
    // Both forced at the start of the fight (Combustion 10 s, Electrification 12 s): read before they run out.
    const s = run(scenario(), [op("normal_skill")], 200, withTriggers(forcedAtStart("combustion"), forcedAtStart("electrification")));
    expect(s.reactions.filter((r) => r.kind === "statusConsumed").map((r) => (r.kind === "statusConsumed" ? r.status : null))).toEqual(["combustion"]);
    expect(s.enemy.statuses.map((x) => x.status)).toEqual(["electrification"]);
  });

  it("the reaction gone by the landing: the fail branch (0.81 × ATK, Heat Infliction, no SP)", () => {
    const first = run(scenario(), [], 10, combusted);
    const ends = first.enemy.statuses.find((x) => x.status === "combustion")?.expiresAt ?? NaN;
    // Cast 30 frames before Combustion ends: still there at the cast (jump), gone at real frame 54.
    const s = run(scenario(), [op("normal_skill", ends - 30)], 40 * 30, combusted);
    const cast = castAt(s, "normal_skill");
    const hits = mine(s, "normal_skill");
    expect(hits.map((h) => [h.hitId, h.frame - cast])).toEqual([["shot1", 6], ["shot2", 16], ["shot3_reaction", 23], ["extra_shot_fail", 54]]);
    expect(hits.at(-1)?.scaleParts.map((p) => [p.key, p.value])).toEqual([["atk_scale_plus_fail", expect.closeTo(0.81, 6)]]);
    expect(run(scenario(), [op("normal_skill", ends - 30)], cast + 53, combusted).enemy.infliction).toBeNull();
    expect(run(scenario(), [op("normal_skill", ends - 30)], cast + 54, combusted).enemy.infliction?.element).toBe("fire");
  });

  it("talent 2 returns returnskillpower SP (10 at level 2, 5 at level 1) with the additional shot, P2 another potential_skillpower (10)", () => {
    const at = 54;
    const sp = (b: Partial<Build>, frame: number) => run(scenario(b), [op("normal_skill")], frame, combusted).spReturned;
    expect(sp({}, at) - sp({}, at - 1)).toBeCloseTo(20, 6);
    expect(sp({ talents: [2, 1] }, at) - sp({ talents: [2, 1] }, at - 1)).toBeCloseTo(15, 6);
    expect(sp({ potential: 1 }, at) - sp({ potential: 1 }, at - 1)).toBeCloseTo(10, 6);
    expect(sp({ talents: [2, 0] }, at) - sp({ talents: [2, 0] }, at - 1)).toBe(0);
  });

  it("team energy at frame 23, whichever path", () => {
    const e = (frame: number, d: GameData) => run(scenario({}, {}, true), [op("normal_skill")], frame, d).energy[F] ?? 0;
    expect(e(22, data)).toBe(0);
    expect(e(23, data)).toBeGreaterThan(0);
    expect(e(23, combusted)).toBeCloseTo(e(23, data), 9);
  });

  it("an ultimate cutting the reaction path before the launch (real 54) drops the additional shot and its consumption; after it, the shot lands", () => {
    const sc = scenario({}, full);
    const extra = (cutAt: number) => {
      const s = run(sc, [op("normal_skill"), op("ultimate_skill", cutAt)], 40 * 30, combusted);
      return mine(s, "normal_skill").filter((h) => h.hitId.startsWith("extra")).length;
    };
    expect(extra(40)).toBe(0);
    expect(extra(60)).toBe(1);
  });
});

describe("Wolven Fury (ultimate), talent 1, P5", () => {
  it("five hits at 46-69; the forced Combustion at 45 gives Scorching Fangs (Heat DMG +0.3) to all five; P5 resets the combo cooldown", () => {
    const s = run(scenario({}, full), [op("ultimate_skill")], 200);
    const cast = castAt(s, "ultimate_skill");
    const hits = mine(s, "ultimate_skill");
    expect(hits.map((h) => h.frame - cast)).toEqual([46, 52, 59, 64, 69]);
    expect(s.reactions.filter((r) => r.kind === "reaction").map((r) => [r.frame - cast, r.kind === "reaction" ? r.status : null])).toEqual([[45, "combustion"]]);
    for (const h of hits) expect(from(h, "Scorching Fangs").map((m) => m.value)).toEqual([expect.closeTo(0.3, 6)]);
    // Fangs lasts `duration` (10 s) from the Combustion.
    const fangs = s.buffs.find((b) => b.owner === W && b.id === "scorching_fangs");
    expect((fangs?.expiresAt ?? NaN) - (fangs?.appliedAt ?? NaN)).toBe(300);
    // Talent 1 at level 1: +0.2; not learned: none.
    expect(from(mine(run(scenario({ talents: [1, 2] }, full), [op("ultimate_skill")]), "ultimate_skill")[0], "Scorching Fangs").map((m) => m.value)).toEqual([expect.closeTo(0.2, 6)]);
    expect(from(mine(run(scenario({ talents: [0, 2] }, full), [op("ultimate_skill")]), "ultimate_skill")[0], "Scorching Fangs")).toEqual([]);
  });

  it("P5: the ultimate resets the combo's cooldown (P4 doesn't)", () => {
    // A plain battle skill's Heat opens the combo; combo, then the ultimate.
    const rotation = [op("normal_skill"), op("combo_skill"), op("ultimate_skill")];
    const p5 = run(scenario({}, full), rotation);
    const p4 = run(scenario({ potential: 4 }, full), rotation);
    expect(p5.readyAt[P + "combo_skill"]).toBe(castAt(p5, "ultimate_skill"));
    expect(p4.readyAt[P + "combo_skill"] ?? 0).toBeGreaterThan(castAt(p4, "ultimate_skill") + 30 * 10);
  });
});

describe("Frag Grenade·β (combo)", () => {
  it("opened by an Arts Infliction (anyone's); the grenade at 12 inflicts Heat, gives usp energy and its Stagger; Heat on Heat bursts", () => {
    const s = run(scenario(), [op("normal_skill"), op("combo_skill")]);
    const cast = castAt(s, "combo_skill");
    // The window opens with the final shot's Heat (frame 23); the combo may cut the battle skill there.
    expect(cast).toBe(castAt(s, "normal_skill") + 23);
    expect(mine(s, "combo_skill").map((h) => [h.hitId, h.frame - cast])).toEqual([["grenade", 12]]);
    const delay = data.constants.burstDelayFrames?.fire ?? 0;
    expect(s.reactions.some((r) => r.kind === "burst" && r.element === "fire" && r.frame === cast + 12 + delay)).toBe(true);
    // Fluorite's Nature opens it too.
    const duo = run(scenario({}, {}, true), [fluorite("normal_skill"), op("combo_skill")]);
    expect(castAt(duo, "combo_skill")).toBeGreaterThan(0);
  });

  it("P3: the additional shot refreshes Scorching Fangs and gives teammates 0.5 of it (0.15); not below P3, not without Fangs", () => {
    const sc = (b: Partial<Build>) => scenario(b, full, true);
    const rotation = [op("ultimate_skill"), op("normal_skill")];
    const s = run(sc({}), rotation, 300);
    const cast = castAt(s, "normal_skill");
    const fangs = s.buffs.filter((b) => b.owner === W && b.id === "scorching_fangs").map((b) => b.appliedAt - cast);
    expect(fangs).toEqual([54]);
    const team = s.buffs.filter((b) => b.owner === W && b.id === "scorching_fangs_team");
    expect(team.map((b) => [b.appliedAt - cast, b.recipients])).toEqual([[54, [F]]]);
    expect(team[0]?.modifiers.map((m) => m.value)).toEqual([expect.closeTo(0.15, 6)]);
    expect(run(sc({ potential: 2 }), rotation, 300).buffs.some((b) => b.id === "scorching_fangs_team")).toBe(false);
    // Combusted by something else and no Fangs yet (talent 1 not learned): nothing.
    expect(run(sc({ talents: [0, 2] }), rotation, 300).buffs.some((b) => b.id === "scorching_fangs_team")).toBe(false);
  });
});

describe("Wulfgard's equipment kits", () => {
  it("Rational Farewell: ATK +atk_up (0.448) when his combo forms Combustion (on the combo's own hit) or a Heat burst (from the burst on)", () => {
    // Fluorite's Nature, then his combo: Combustion.
    const s = run(scenario({}, {}, true), [fluorite("normal_skill"), op("combo_skill")]);
    const combo = mine(s, "combo_skill")[0];
    expect(s.reactions.some((r) => r.kind === "reaction" && r.status === "combustion" && r.operator === W)).toBe(true);
    expect(from(combo, "Rational Farewell").map((m) => m.value)).toEqual([expect.closeTo(0.448, 6)]);
    // Heat on Heat: the burst a second later gives it, not the grenade itself.
    const b = run(scenario(), [op("normal_skill"), op("combo_skill"), op("attack1", 0)]);
    const grenade = mine(b, "combo_skill")[0];
    expect(from(grenade, "Rational Farewell")).toEqual([]);
    const after = mine(b).filter((h) => h.frame > (grenade?.frame ?? 0) + (data.constants.burstDelayFrames?.fire ?? 0));
    expect(after.length).toBeGreaterThan(0);
    for (const h of after) expect(from(h, "Rational Farewell")).toHaveLength(1);
    // His ultimate's forced Combustion isn't a combo's.
    const ult = run(scenario({}, full), [op("ultimate_skill"), op("attack1")]);
    expect(mine(ult).some((h) => from(h, "Rational Farewell").length > 0)).toBe(false);
  });

  it("Opus: The Living: ATK +atk_up (0.21) per reaction he applies, up to max_stack (2) layers", () => {
    const opus = weapon("wpn_pistol_0006");
    const s = run(scenario(opus, full), [op("ultimate_skill"), op("attack1")]);
    const a1 = mine(s, "attack1")[0];
    expect(from(a1, "Opus").map((m) => m.value)).toEqual([expect.closeTo(0.21, 6)]);
    // Ultimate (forced Combustion) and then a combo forming Combustion on Fluorite's Nature: two layers; never more.
    const two = run(scenario(opus, full, true), [op("ultimate_skill"), fluorite("normal_skill"), op("combo_skill"), op("attack1")]);
    expect(from(mine(two, "attack1")[0], "Opus").map((m) => m.value)).toEqual([expect.closeTo(0.21, 6), expect.closeTo(0.21, 6)]);
  });

  it("OBJ Velocitous: consuming infliction stacks gives Nature DMG +nature_dmg_up_mult (0.14) × the stacks", () => {
    const velocitous = weapon("wpn_pistol_0012");
    // Fluorite's Nature (1 stack), then his combo's Heat forms Combustion and consumes it.
    const s = run(scenario(velocitous, {}, true), [fluorite("normal_skill"), op("combo_skill")], 300);
    // The Combustion consumes Fluorite's one Nature stack.
    expect(s.reactions.filter((r) => r.kind === "reaction" && r.operator === W).map((r) => (r.kind === "reaction" ? [r.status, r.consumed, r.level] : null))).toEqual([["combustion", "natural", 1]]);
    const buff = s.buffs.find((b) => b.owner === W && b.id === "wpn_pistol_0012.nature");
    expect(buff?.modifiers.map((m) => m.value)).toEqual([expect.closeTo(0.14, 6)]);
    // Two Nature stacks on the enemy at the start of the fight, then a plain battle skill's Heat: two consumed, 0.28.
    const nature: KitTrigger = { id: "test_nature", on: { event: "fightStart" }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "natural" }, { kind: "infliction", element: "natural" }] }] };
    const two = run(scenario(velocitous), [op("normal_skill")], 100, withTriggers(nature));
    const reaction = two.reactions.find((r) => r.kind === "reaction" && r.operator === W);
    expect(reaction?.kind === "reaction" ? reaction.level : null).toBe(2);
    expect(two.buffs.find((b) => b.owner === W && b.id === "wpn_pistol_0012.nature")?.modifiers.map((m) => m.value)).toEqual([expect.closeTo(0.28, 6)]);
  });
});
