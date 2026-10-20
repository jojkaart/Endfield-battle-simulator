// Batch 4's shared features, group "values and buffs" (docs/kit-batches/batch-4.md,
// Merged gaps): V1 a hit's zone scale, V2 periodic damage with an ATK snapshot,
// B2 a stack cap the applying skill lacks, B3 stackingType 10's shared timer,
// B4 an application's own duration, B5 what a cast-consumed buff reaches, B6 a
// team buff ended for one recipient. Each shown with a small hand-made kit change
// (Laevatain's kit, as batch 3's tests) or a scratch kit file.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  advance, apply, buffModifiers, computeHit, computeStats, createContext, endBuffFor, init, reaches, simulate, withBuff,
  type ActiveBuff, type Build, type GameData, type KitBuff, type KitHit, type KitTrigger, type Modifier, type OperatorKit, type RotationAction, type TimelineScenario,
} from "@efsim/engine";
import { loadGameData, loadKits, withGameBuff } from "@efsim/data";
import { checkLog, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const readBuild = (f: string) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8")) as Build;
const build = readBuild("laevatain-forgeborn.json");
const mate = readBuild("akekuri-frontiers.json");
const L = "chr_0016_laevat_";
const op = build.operator;
const panel = computeStats(data, build);
const kit = data.kits.operators[op] as OperatorKit;
const target = { enemy: "eny_0051_rodin", level: 90 };
const scenario = (rotation: RotationAction[], team: Build[] = [build]): TimelineScenario => ({ team, target, durationFrames: 30 * 60, rotation, options: { crit: "never" } });
const skill = (s: string, at?: number): RotationAction => ({ operator: op, skill: L + s, ...(at !== undefined ? { at } : {}) });
/** Laevatain's kit with her first basic attack's hit changed, and extra buffs, triggers and stacks. */
const withKit = (patch: { hit?: Partial<KitHit>; buffs?: KitBuff[]; triggers?: KitTrigger[]; stacks?: OperatorKit["stacks"] }): GameData => ({
  ...data,
  kits: {
    ...data.kits,
    operators: {
      ...data.kits.operators,
      [op]: {
        ...kit,
        buffs: [...kit.buffs, ...(patch.buffs ?? [])],
        triggers: [...kit.triggers, ...(patch.triggers ?? [])],
        stacks: [...kit.stacks, ...(patch.stacks ?? [])],
        skills: kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, ...patch.hit })) } : s)),
      },
    },
  },
});
const onStart = (buff: string): KitTrigger => ({ id: `start_${buff}`, on: { event: "fightStart" }, by: "self", do: [{ kind: "buff", buff }] });
/** A trigger applying a buff `delay` frames after Laevatain's first basic attack. */
const afterAttack1 = (id: string, buff: string, delay: number, extra: Partial<Extract<KitTrigger["do"][number], { kind: "buff" }>> = {}): KitTrigger => ({
  id, on: { event: "cast", skills: [L + "attack1"] }, by: "self", delay, do: [{ kind: "buff", buff, ...extra }],
});
const triggerHit = (id: string, extra: Partial<KitHit> = {}): KitHit => ({ id, label: id, scale: ["atk_scale"], count: 1, events: [], damageType: "none", element: "fire", ...extra });

/** Kits under a scratch root (operators/, equipment/), loaded with the real loader. */
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
function loadEquipment(...kits: object[]) {
  const root = mkdtempSync(join(tmpdir(), "efsim-batch4-values-"));
  roots.push(root);
  mkdirSync(join(root, "operators"));
  mkdirSync(join(root, "equipment"));
  for (const k of kits) writeFileSync(join(root, "equipment", `${(k as { equipment: string }).equipment}.json`), JSON.stringify(k));
  return loadKits(data, root).equipment;
}
const DREAMS = "wpn_funnel_0013";
const dreams = (patch: Record<string, unknown> = {}, triggers?: unknown[]) => ({
  equipment: DREAMS,
  sources: ["test"],
  buffs: [{ id: `${DREAMS}.taken`, label: "Arts DMG Taken", target: "enemy", gameBuff: "buff_wpn_funnel_0013_valid", duration: "duration", modifiers: [{ zone: "damageTaken", value: "spell_dmg_taken_up", elements: ["fire", "pulse", "cryst", "natural"] }], ...patch }],
  triggers: triggers ?? [{ id: `${DREAMS}.on`, on: { event: "statusConsumed", statuses: ["corrosion"] }, by: "self", skill: `sk_${DREAMS}`, do: [{ kind: "buff", buff: `${DREAMS}.taken` }] }],
});

describe("V1: a hit scales a zone's modifiers (KitHit.zoneScale)", () => {
  const hit = kit.skills.find((s) => s.skillId === L + "attack1")?.hits[0] as KitHit;
  const susc = (value: number, element?: "fire" | "cryst"): Modifier => ({ zone: "susceptibility", value, ...(element ? { element } : {}), source: `susc ${element ?? "all"}` });
  const mods = [susc(0.2), susc(0.1, "fire"), susc(0.3, "cryst"), { zone: "damageBonus" as const, value: 0.4, source: "dmg" }];
  const dmg = (h: KitHit) => computeHit(data, build, panel, target, { skillId: L + "attack1" }, h, { crit: "never", staggered: false, conditions: [], modifiers: mods });

  it("every modifier of the zone that reaches the hit (all-element and its element, anyone's) × the value; others untouched", () => {
    const plain = dmg(hit);
    const scaled = dmg({ ...hit, zoneScale: [{ zone: "susceptibility", value: 1.5 }] });
    // Its element is Heat: the all-element 0.2 and the Heat 0.1 reach it, the Cryo 0.3 doesn't.
    expect(plain.zones.susceptibility).toBeCloseTo(1.3, 9);
    expect(scaled.zones.susceptibility).toBeCloseTo(1 + 1.5 * 0.3, 9);
    expect(scaled.zones.damageBonus).toBeCloseTo(plain.zones.damageBonus, 9);
    expect(scaled.exact / plain.exact).toBeCloseTo((1 + 1.5 * 0.3) / 1.3, 9);
    // Explainable: the scaled modifiers say so.
    expect(scaled.modifiers.filter((m) => m.source.includes("zoneScale")).map((m) => m.value)).toEqual([0.2 * 1.5, 0.1 * 1.5]);
  });

  it("the value is a ValueExpr judged for the hit (Last Rite's {if: talentAtLeast, then: rate, else: 1}); 1 changes nothing", () => {
    const plain = dmg(hit);
    expect(dmg({ ...hit, zoneScale: [{ zone: "susceptibility", value: { if: { potentialAtLeast: 6 }, then: 2, else: 1 } }] }).exact).toBeCloseTo(plain.exact, 9);
    expect(dmg({ ...hit, zoneScale: [{ zone: "susceptibility", value: { if: { potentialAtLeast: 5 }, then: 2, else: 1 } }] }).zones.susceptibility).toBeCloseTo(1.6, 9);
  });

  it("the loader checks its values and refuses a zone named twice or a Fixed DMG hit with one", () => {
    const hits = (h: object) => dreams({}, [{ id: `${DREAMS}.on`, on: { event: "fightStart" }, by: "self", skill: `sk_${DREAMS}`, do: [{ kind: "hits", hits: [{ id: "h", scale: ["lv"], damageType: "none", element: "fire", ...h }] }] }]);
    const t = loadEquipment(hits({ zoneScale: [{ zone: "susceptibility", value: "lv" }] }))[DREAMS]?.triggers[0];
    expect(t?.do[0]).toMatchObject({ kind: "hits", hits: [{ zoneScale: [{ zone: "susceptibility", value: "lv" }] }] });
    expect(() => loadEquipment(hits({ zoneScale: [{ zone: "susceptibility", value: "no_such_key" }] }))).toThrow(/no value no_such_key/);
    expect(() => loadEquipment(hits({ zoneScale: [{ zone: "amp", value: 1 }, { zone: "amp", value: 2 }] }))).toThrow(/a zone twice/);
    expect(() => loadEquipment(hits({ scale: [], fixedDamage: 10, zoneScale: [{ zone: "amp", value: 2 }] }))).toThrow(/Fixed DMG/);
  });
});

describe("V2: periodic damage keeps its applier's attacker side (takeAtkSnapshot)", () => {
  const ticksOf = (d: GameData, rotation = [skill("attack1", 0)]) => simulate(d, scenario(rotation)).hits.filter((h) => h.skillId === "reaction:combustionTick");
  const dmgUp: KitBuff = { id: "dmg_up", label: "Heat DMG", target: "self", duration: 30, modifiers: [{ zone: "damageBonus", value: 0.5, elements: ["fire"] }] };
  const ampUp: KitBuff = { id: "amp_up", label: "Heat Amp", target: "self", duration: 1, modifiers: [{ zone: "amp", value: 0.4, elements: ["fire"] }] };
  const susc: KitBuff = { id: "susc", label: "Heat Susceptibility", target: "enemy", duration: 30, modifiers: [{ zone: "susceptibility", value: 0.3, elements: ["fire"] }] };
  const combust = { applies: [{ kind: "forcedReaction" as const, status: "combustion" as const }] };

  it("Combustion's ticks keep the DMG bonus and Amp at its application; the enemy's side is read at each tick", () => {
    // attack1 lands at frame 6 and forces Combustion (ticks at 36, 66, 96, …); an Amp that runs out at frame 30,
    // a DMG bonus from frame 45 and a Susceptibility from frame 75.
    const d = withKit({ hit: combust, buffs: [dmgUp, ampUp, susc], triggers: [onStart("amp_up"), afterAttack1("dmg", "dmg_up", 45), afterAttack1("susc", "susc", 75)] });
    const ticks = ticksOf(d);
    expect(ticks.map((h) => h.frame).slice(0, 3)).toEqual([36, 66, 96]);
    const [t1, t2, t3] = ticks as [typeof ticks[0], typeof ticks[0], typeof ticks[0]];
    expect(t1.zones.amp).toBeCloseTo(1.4, 9);
    expect(t2.exact).toBeCloseTo(t1.exact, 6);
    expect(t2.zones.damageBonus).toBeCloseTo(t1.zones.damageBonus, 9);
    expect(t3.exact / t1.exact).toBeCloseTo(1.3, 9);
    // The status holds the snapshot: the Amp that has run out by then is in it.
    const ctx = createContext(d, scenario([skill("attack1", 0)]));
    const s = advance(ctx, apply(ctx, init(ctx), skill("attack1", 0)), 7);
    expect(s.enemy.statuses[0]?.snapshot?.map((m) => [m.zone, m.value])).toEqual([["amp", 0.4]]);
    // The DMG bonus is on at the second tick (it acts on her own hits then), and the Amp is gone.
    const later = advance(ctx, s, 67);
    expect(buffModifiers(later.buffs, op, 66).map((m) => [m.zone, m.value])).toEqual([["damageBonus", 0.5]]);
  });

  it("a buffTick trigger's hit with atkSnapshot keeps the ticking buff's application; without it, each tick's", () => {
    const bleed: KitBuff = { id: "bleed", label: "bleed", target: "self", duration: 5, every: 1, modifiers: [] };
    const atkUp: KitBuff = { id: "atk_up", label: "ATK", target: "self", duration: 30, modifiers: [{ zone: "atk", value: 0.3 }] };
    const tick: KitTrigger = { id: "tick", on: { event: "buffTick", buff: "bleed" }, by: "self", skill: L + "attack1", do: [{ kind: "hits", hits: [triggerHit("snap", { atkSnapshot: true }), triggerHit("live")] }] };
    // The bleed from frame 0 (ticks at 30, 60, …), ATK +30% from frame 45.
    const d = withKit({ buffs: [bleed, atkUp], triggers: [onStart("bleed"), tick, afterAttack1("atk", "atk_up", 45)] });
    const hits = simulate(d, scenario([skill("attack1", 0)])).hits;
    const at = (id: string, frame: number) => hits.find((h) => h.hitId === id && h.frame === frame);
    expect(at("snap", 60)?.exact).toBeCloseTo(at("snap", 30)?.exact ?? NaN, 6);
    expect(at("live", 60)?.zones.atk).toBeGreaterThan(at("live", 30)?.zones.atk ?? Infinity);
    expect(at("snap", 30)?.exact).toBeCloseTo(at("live", 30)?.exact ?? NaN, 6);
  });

  it("the loader takes atkSnapshot on a buffTick trigger's hits only", () => {
    const tickBuff = { id: `${DREAMS}.tick`, label: "tick", target: "self", duration: 5, every: 1, modifiers: [] };
    const on = (event: object, h: object) => ({ ...dreams(), buffs: [...dreams().buffs, tickBuff], triggers: [{ id: `${DREAMS}.t`, on: event, by: "self", skill: `sk_${DREAMS}`, do: [{ kind: "hits", hits: [{ id: "h", scale: ["lv"], damageType: "none", element: "fire", ...h }] }] }] });
    expect(loadEquipment(on({ event: "buffTick", buff: `${DREAMS}.tick` }, { atkSnapshot: true }))[DREAMS]?.triggers[0]?.do[0]).toMatchObject({ hits: [{ atkSnapshot: true }] });
    expect(() => loadEquipment(on({ event: "fightStart" }, { atkSnapshot: true }))).toThrow(/atkSnapshot is for the hits of a buffTick trigger/);
  });

  it("zmdlogs check: 4e5e's three Combustion ticks match with Camille's DMG bonuses at the reaction (the hand-annotated ATK applied)", () => {
    const fx = readLogFixture(new URL("../fixtures/zmdlogs-4e5e1390085e.json", import.meta.url).pathname);
    // The fixture's annotation: Lustrous Carmine's ATK +9.6% (unquantified in the log) acts on every hit from 49418 ms.
    const quantified = {
      ...fx,
      hits: fx.hits.map((h) => (h.unquantified.some((u) => u.buff === "buff_wpn_lance_0015_atkup") ? { ...h, effects: [...h.effects, { buff: "buff_wpn_lance_0015_atkup", zone: "atk" as const, element: null, value: 0.096 }], unquantified: h.unquantified.filter((u) => u.buff !== "buff_wpn_lance_0015_atkup") } : h)),
    };
    const ticks = checkLog(data, quantified).filter((v) => v.hit.event === "buff_common_burning_status");
    expect(ticks.map((v) => [v.hit.t, v.kind])).toEqual([[66004, "match"], [67447, "match"], [68449, "match"]]);
  });
});

describe("B2: a stack cap (maxStackCntKey) the applying skill doesn't have", () => {
  const spout: KitBuff = { id: "spout", label: "Arts Susceptibility", target: "enemy", gameBuff: "buff_chr_0027_tangtang_normalskill_spellvulnerable", modifiers: [{ zone: "susceptibility", value: 0.05 }] };
  it("the buff's own blackboard value (Tangtang: cntmax 1), else 0 (no limit); with the key, the applier's value as before", () => {
    expect(withGameBuff("test", spout, false)).toMatchObject({ instances: 1, stackGroup: "buff_chr_0027_tangtang_normalskill_spellvulnerable" });
    expect(withGameBuff("test", { ...spout, gameBuff: "buff_wpn_pistol_0005_valid" }, false)).toMatchObject({ instances: 0, stackGroup: "buff_wpn_pistol_0005_valid" });
    expect(withGameBuff("test", spout).instances).toBe("cntmax");
  });

  it("the loader: Dreams of the Starry Beach's buff with its game buff loads (sk_wpn_funnel_0013 has no max_stack): no limit, one stack group", () => {
    const b = loadEquipment(dreams())[DREAMS]?.buffs[0];
    expect(b).toMatchObject({ instances: 0, stackGroup: "buff_wpn_funnel_0013_valid", gameBuff: "buff_wpn_funnel_0013_valid" });
  });
});

describe("B3: stackingType 10 layers share one refreshed timer", () => {
  it("the loader sets sharedTimer for Ember's talent-2 buff (stackingType 10), as for stackingType 8", () => {
    const ember: KitBuff = { id: "t2", label: "ATK", target: "self", gameBuff: "buff_chr_0009_azrila_talent_2_buff", duration: 7, maxStacks: 3, modifiers: [{ zone: "atk", value: 0.09 }] };
    expect(withGameBuff("test", ember).sharedTimer).toBe(true);
    // A kit's own sharedTimer: false stays.
    expect(withGameBuff("test", { ...ember, sharedTimer: false }).sharedTimer).toBe(false);
    // A layered stackingType-2 buff keeps its own timers.
    expect(withGameBuff("test", { ...ember, gameBuff: "buff_wpn_claym_0004_phy_damage_up" }).sharedTimer).toBeUndefined();
  });
});

describe("B4: an application's own duration (trigger action buff / BuffApplication duration)", () => {
  const morale: KitBuff = { id: "morale", label: "ATK", target: "self", duration: 20, maxStacks: 2, modifiers: [{ zone: "atk", value: 0.1 }] };
  const layersAt = (d: GameData, frame: number) => {
    const ctx = createContext(d, scenario([skill("attack1", 0)]));
    return advance(ctx, apply(ctx, init(ctx), skill("attack1", 0)), frame).buffs.filter((b) => b.id === "morale").map((b) => [b.appliedAt, b.expiresAt]);
  };

  it("one buff applied for 20 s and for 10 s keeps one layer cap; each layer its own end", () => {
    const d = withKit({ buffs: [morale], triggers: [afterAttack1("long", "morale", 1), afterAttack1("short", "morale", 2, { duration: 10 }), afterAttack1("third", "morale", 3, { duration: 10 })] });
    // At most 2 layers in all: the third replaces the oldest (the 20 s one from frame 1).
    expect(layersAt(d, 4)).toEqual([[2, 2 + 300], [3, 3 + 300]]);
    const two = withKit({ buffs: [morale], triggers: [afterAttack1("long", "morale", 1), afterAttack1("short", "morale", 2, { duration: 10 })] });
    expect(layersAt(two, 4)).toEqual([[1, 1 + 600], [2, 2 + 300]]);
  });

  it("on a hit's buff application too; the loader checks its value", () => {
    const d = withKit({ hit: { buffs: [{ buff: "morale", duration: 5 }] }, buffs: [morale] });
    expect(layersAt(d, 7)).toEqual([[6, 6 + 150]]);
    const dur = (duration: unknown) => dreams({}, [{ id: `${DREAMS}.on`, on: { event: "fightStart" }, by: "self", skill: `sk_${DREAMS}`, do: [{ kind: "buff", buff: `${DREAMS}.taken`, duration }] }]);
    expect(loadEquipment(dur("duration"))[DREAMS]?.triggers[0]?.do[0]).toMatchObject({ kind: "buff", duration: "duration" });
    expect(() => loadEquipment(dur("no_such_key"))).toThrow(/no value no_such_key/);
  });
});

describe("B5: what a cast-consumed buff reaches (consumedScope)", () => {
  const consumed = (scope?: "cast" | "whileCasting"): KitBuff => ({ id: "next_battle", label: "DMG", target: "self", consumedBy: ["battle"], ...(scope ? { consumedScope: scope } : {}), modifiers: [{ zone: "damageBonus", value: 0.5 }] });
  // Hits of a trigger on the battle skill's cast (no cast index), at frames 10 and 60, and 120 and 400: after the skill's end
  // (frame 104: its jump from 37 to 215 skips 178 of its 282 frames).
  const at = (id: string, f: number) => triggerHit(id, { frames: [f] });
  const during: KitTrigger = { id: "during", on: { event: "cast", kinds: ["battle"] }, by: "self", skill: L + "attack1", do: [{ kind: "hits", hits: [at("in", 10), at("mid", 60), at("after", 120), at("late", 400)] }] };
  const bonus = (scope: "cast" | "whileCasting" | undefined, rotation: RotationAction[]) => {
    const hits = simulate(withKit({ buffs: [consumed(scope)], triggers: [onStart("next_battle"), during] }), scenario(rotation)).hits;
    const z = (id: string) => hits.find((h) => h.hitId === id)?.zones.damageBonus ?? NaN;
    const own = hits.find((h) => h.hitId === "explosion")?.zones.damageBonus ?? NaN;
    return { own, in: z("in"), mid: z("mid"), after: z("after"), late: z("late") };
  };

  it("cast (default): the consuming cast's own hits only; whileCasting: also the caster's other hits until the cast ends", () => {
    const cast = bonus(undefined, [skill("normal_skill", 0)]);
    const whileCasting = bonus("whileCasting", [skill("normal_skill", 0)]);
    expect(whileCasting.own).toBeCloseTo(cast.own, 9);
    expect(whileCasting.in - cast.in).toBeCloseTo(0.5, 9);
    expect(whileCasting.mid - cast.mid).toBeCloseTo(0.5, 9);
    expect(whileCasting.after).toBeCloseTo(cast.after, 9);
    expect(whileCasting.late).toBeCloseTo(cast.late, 9);
    expect(bonus("cast", [skill("normal_skill", 0)]).in).toBeCloseTo(cast.in, 9);
  });

  it("a cast cut short ends it for the other hits: a basic attack at frame 37", () => {
    const rotation = [skill("normal_skill", 0), skill("attack1")];
    const cut = bonus("whileCasting", rotation);
    const plain = bonus(undefined, rotation);
    expect(cut.in - plain.in).toBeCloseTo(0.5, 9);
    expect(cut.mid).toBeCloseTo(plain.mid, 9);
  });

  it("the loader defaults it from the data: a buff the game attaches to the cast (CreateBuffAttachingSkill) acts while it runs", () => {
    const scope = (equipment: string, buff: string) => data.kits.equipment[equipment]?.buffs.find((b) => b.id === buff)?.consumedScope;
    // Cohesive Traction and Aspirant attach their cast buff to the skill; Jade Vessel and Bonekrusha check the cast ID.
    expect(scope("wpn_lance_0006", "wpn_lance_0006.pulse")).toBe("whileCasting");
    expect(scope("wpn_sword_0015", "wpn_sword_0015.lift")).toBe("whileCasting");
    expect(scope("suit_attri01", "suit_attri01.smash")).toBeUndefined();
    expect(data.kits.equipment["wpn_claym_0018"]?.buffs.filter((b) => b.consumedBy).map((b) => b.consumedScope)).toEqual([undefined]);
    expect(() => loadEquipment(dreams({ consumedScope: "cast" }))).toThrow(/consumedScope is for a buff a cast consumes/);
  });
});

describe("B6: a team buff ended for one recipient (endBuff to: eventSubject)", () => {
  const team = [op, mate.operator];
  const buff: ActiveBuff = { id: "team", owner: op, target: "team", appliedAt: 0, expiresAt: 600, modifiers: [{ zone: "damageBonus", value: 0.2, source: "team" }] };

  it("it stops reaching that member only; it ends when it reaches no one; a reapplication reaches everyone again", () => {
    const a = endBuffFor([buff], "team", op, 10, mate.operator, team);
    expect(a.ended).toBe(false);
    expect(a.buffs.map((b) => [reaches(b, op), reaches(b, mate.operator)])).toEqual([[true, false]]);
    expect(buffModifiers(a.buffs, mate.operator, 20)).toEqual([]);
    expect(endBuffFor(a.buffs, "team", op, 10, mate.operator, team).buffs).toEqual(a.buffs);
    const b = endBuffFor(a.buffs, "team", op, 20, op, team);
    expect(b).toMatchObject({ ended: true, buffs: [], remaining: 580 });
    expect(withBuff(a.buffs, { ...buff, appliedAt: 30 }).map((x) => [x.appliedAt, reaches(x, mate.operator)])).toEqual([[30, true]]);
  });

  it("on the timeline: each member's own cast uses it up for itself; its buffEnded comes when the last does", () => {
    const def: KitBuff = { id: "team", label: "team DMG", target: "team", duration: 30, modifiers: [{ zone: "damageBonus", value: 0.2 }] };
    const triggers: KitTrigger[] = [
      onStart("team"),
      { id: "use", on: { event: "cast" }, by: "anyone", do: [{ kind: "endBuff", buff: "team", to: "eventSubject" }] },
      { id: "ended", on: { event: "buffEnded", buff: "team" }, by: "self", do: [{ kind: "gain", gains: [{ stack: "ended", amount: 1 }] }] },
    ];
    const d = withKit({ buffs: [def], triggers, stacks: [{ id: "ended", label: "ended", max: 9 }] });
    const ctx = createContext(d, { ...scenario([], [build, mate]), controlled: mate.operator });
    let s = apply(ctx, init(ctx), { operator: mate.operator, skill: "chr_0019_karin_attack1", at: 0 });
    s = advance(ctx, s, 20);
    expect([op, mate.operator].map((o) => buffModifiers(s.buffs, o, 20).filter((m) => m.source.includes("team DMG")).length)).toEqual([1, 0]);
    expect(s.stacks[op]?.["ended"] ?? 0).toBe(0);
    s = advance(ctx, apply(ctx, s, { operator: op, skill: L + "normal_skill", at: 30 }), 40);
    expect(s.buffs.filter((b) => b.id === "team")).toEqual([]);
    expect(s.stacks[op]?.["ended"]).toBe(1);
  });

  it("the loader: only a team buff, and not with layers", () => {
    const end = (extra: object, target = "enemy") => dreams({ target }, [{ id: `${DREAMS}.on`, on: { event: "fightStart" }, by: "self", skill: `sk_${DREAMS}`, do: [{ kind: "endBuff", buff: `${DREAMS}.taken`, to: "eventSubject", ...extra }] }]);
    expect(() => loadEquipment(end({}))).toThrow(/ends for the event's subject, so it must target the team/);
    expect(() => loadEquipment(end({ layers: 1 }, "team"))).toThrow(/not layers/);
    expect(loadEquipment(end({}, "team"))[DREAMS]?.triggers[0]?.do[0]).toMatchObject({ kind: "endBuff", to: "eventSubject" });
  });
});
