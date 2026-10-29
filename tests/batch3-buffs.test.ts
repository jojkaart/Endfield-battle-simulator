// Batch 3's shared features (docs/kit-batches/batch-3.md): V4 percentage
// attribute buffs, B1 instances with a priority, B2 stackingType 11 across
// wielders, A1–A4 forced statuses and when a hit's applications run, C1
// modifier conditions on the enemy after a hit's applications. Each shown on
// Laevatain's kit with a small hand-made change.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, applyBuff, applyToEnemy, Attr, buffAttr, buffModifiers, computeStats, corrosionShred, createContext, EngineError, init, NO_STATUS, simulate, skillValue, statusModifiers, withBuff, type ActiveBuff, type Build, type GameData, type KitApplication, type KitBuff, type KitHit, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { loadGameData, withGameBuff } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const panel = computeStats(data, build);
const kit = data.kits.operators[op] as OperatorKit;
const scenario = (rotation: RotationAction[]): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation,
  options: { crit: "never" },
});
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
const applying = (applies: KitApplication[]) => withKit({ hit: { applies } });
/** The state just after attack1's hit (frame 6) and its hit. */
const afterAttack1 = (d: GameData) => {
  const ctx = createContext(d, scenario([skill("attack1")]));
  const s = advance(ctx, apply(ctx, init(ctx), skill("attack1")), 7);
  const hit = s.hits.find((h) => h.skillId === L + "attack1");
  if (!hit) throw new Error("attack1 didn't land");
  return { state: s, hit };
};
const onStart = (buff: string): KitTrigger => ({ id: `start_${buff}`, on: { event: "fightStart" }, by: "self", do: [{ kind: "buff", buff }] });

describe("A1: a forced status's strength × the applying skill's scaleKey", () => {
  const scale = () => 1.33;
  it("Electrification's Arts DMG Taken, forced Corrosion's shred and Breach's Physical DMG Taken are scaled; default ×1", () => {
    const electrified = applyToEnemy(NO_STATUS, { kind: "forcedReaction", status: "electrification", scaleKey: "extra_scaling" }, 0, op, 0, scale).state;
    expect(statusModifiers(electrified, 1).map((m) => m.value)).toEqual(Array(4).fill(0.12 * 1.33));
    const plain = applyToEnemy(NO_STATUS, { kind: "forcedReaction", status: "electrification" }, 0, op, 0).state;
    expect(statusModifiers(plain, 1).map((m) => m.value)).toEqual(Array(4).fill(0.12));
    // A reaction's status has no applying skill's scale.
    const heat = applyToEnemy(NO_STATUS, { kind: "infliction", element: "fire" }, 0, op, 0).state;
    expect(statusModifiers(applyToEnemy(heat, { kind: "infliction", element: "pulse" }, 0, op, 0).state, 1)[0]?.value).toBe(0.12);
    const corroded = applyToEnemy(NO_STATUS, { kind: "forcedReaction", status: "corrosion", scaleKey: "extra_scaling" }, 0, op, 0, scale).state;
    expect(statusModifiers(corroded, 30 * 5)[0]?.value).toBeCloseTo(corrosionShred(1, 5000, 0) * 1.33, 9);
    const vulnerable = applyToEnemy(NO_STATUS, { kind: "vulnerable", stacks: 2 }, 0, op, 0).state;
    const breached = applyToEnemy(vulnerable, { kind: "physicalStatus", status: "breach", scaleKey: "extra_scaling" }, 0, op, 0, scale);
    expect(statusModifiers(breached.state, 1)).toMatchObject([{ zone: "damageTaken", element: "physical", value: 0.16 * 1.33 }]);
    // The Breach's own hit isn't scaled.
    expect(breached.events.find((e) => e.kind === "physical")).not.toHaveProperty("multiplier");
    expect(() => applyToEnemy(vulnerable, { kind: "physicalStatus", status: "lift", scaleKey: "extra_scaling" }, 0, op, 0, scale)).toThrow(EngineError);
  });

  it("taken at application from the hit's skill (a kit's forced Electrification with scaleKey)", () => {
    const k = skillValue(data, panel, build, L + "attack1", "atk_scale");
    const { state } = afterAttack1(applying([{ kind: "forcedReaction", status: "electrification", scaleKey: "atk_scale" }]));
    expect(state.enemy.statuses[0]?.damageScale).toEqual({ key: "atk_scale", value: k });
  });
});

describe("A2 and A3: a forced reaction's extra seconds and its level as a value", () => {
  it("extraSeconds lengthens only that application", () => {
    const longer = afterAttack1(applying([{ kind: "forcedReaction", status: "solidification", extraSeconds: 2 }])).state.enemy.statuses[0];
    expect(longer && longer.expiresAt - longer.appliedAt).toBe(Math.round(5.75 * 30) + 60);
    const plain = afterAttack1(applying([{ kind: "forcedReaction", status: "solidification" }])).state.enemy.statuses[0];
    expect(plain && plain.expiresAt - plain.appliedAt).toBe(Math.round(5.75 * 30));
  });

  it("level {consumed: true}: the stacks the preceding consumeInfliction took; none consumed applies nothing", () => {
    const consume: KitApplication[] = [{ kind: "consumeInfliction", elements: ["cryst"] }, { kind: "forcedReaction", status: "solidification", level: { consumed: true } }];
    const s = afterAttack1(applying([{ kind: "infliction", element: "cryst", stacks: 3 }, ...consume])).state;
    expect(s.enemy.statuses).toMatchObject([{ status: "solidification", level: 3 }]);
    expect(s.enemy.infliction).toBeNull();
    expect(afterAttack1(applying(consume)).state.enemy.statuses).toEqual([]);
  });
});

describe("A4: an application after its hit's damage", () => {
  const electrify: KitApplication = { kind: "forcedReaction", status: "electrification" };
  const consume: KitApplication = { kind: "consumeStatus", statuses: ["electrification"] };
  const sees = (h: { modifiers: readonly { source: string }[] }) => h.modifiers.some((m) => m.source === "Electrification level 1");

  it("a consumption marked afterDamage leaves the status to the hit's damage; by default it comes before", () => {
    const late = afterAttack1(applying([electrify, { ...consume, afterDamage: true }]));
    expect(sees(late.hit)).toBe(true);
    expect(late.state.enemy.statuses).toEqual([]);
    expect(late.state.reactions.some((e) => e.kind === "statusConsumed")).toBe(true);
    const early = afterAttack1(applying([electrify, consume]));
    expect(sees(early.hit)).toBe(false);
  });

  it("its if is judged after the damage, on what the applications before it did", () => {
    // Electrified after the damage (which doesn't see it), then consumed by an application whose condition sees that.
    const s = afterAttack1(applying([{ ...electrify, afterDamage: true }, { ...consume, afterDamage: true, if: { enemyStatus: "electrification" } }]));
    expect(sees(s.hit)).toBe(false);
    expect(s.state.enemy.statuses).toEqual([]);
  });
});

describe("C1: a buff modifier's condition on the enemy sees the hit's own applications", () => {
  const marked: KitBuff = { id: "vs_electrified", label: "DMG vs Electrified", target: "self", modifiers: [{ zone: "damageBonus", value: 0.5, if: { enemyStatus: "electrification" } }] };
  const bonus = (applies: KitApplication[]) => afterAttack1(withKit({ hit: { applies }, buffs: [marked], triggers: [onStart(marked.id)] })).hit.zones.damageBonus;
  it("the hit that Electrifies gets the bonus; one that ends it before its damage doesn't", () => {
    const plain = afterAttack1(withKit({ buffs: [marked], triggers: [onStart(marked.id)] })).hit.zones.damageBonus;
    expect(bonus([{ kind: "forcedReaction", status: "electrification" }]) - plain).toBeCloseTo(0.5, 9);
    expect(bonus([{ kind: "forcedReaction", status: "electrification" }, { kind: "consumeStatus", statuses: ["electrification"] }])).toBeCloseTo(plain, 9);
  });
});

describe("V4: percentage attribute buffs", () => {
  const def = panel.attrs[Attr.Def];
  if (!def) throw new Error("no DEF line");
  const ofLine = (v: number) => v * (def.base + def.add) * def.multiply;
  const buff = (value: number, percent: boolean): KitBuff => ({ id: `def_${value}_${percent}`, label: "DEF", target: "self", modifiers: [{ attr: Attr.Def, value, ...(percent ? { percent: true } : {}) }] });
  const active = (b: KitBuff) => applyBuff(data, build, panel, L + "attack1", b, 0) as ActiveBuff;

  it("adds value × (base + Σ add) of the panel line, summed with other percentages, not compounded", () => {
    expect(buffAttr([active(buff(0.5, true))], op, 1, Attr.Def, def)).toBeCloseTo(ofLine(0.5), 9);
    expect(buffAttr([active(buff(0.5, true)), active({ ...buff(0.2, true), id: "other" })], op, 1, Attr.Def, def)).toBeCloseTo(ofLine(0.7), 9);
    expect(buffAttr([active(buff(30, false))], op, 1, Attr.Def, def)).toBe(30);
    expect(() => buffAttr([active(buff(0.5, true))], op, 1, Attr.Def)).toThrow(EngineError);
    expect(() => active({ ...buff(0.5, true), modifiers: [{ attr: Attr.PhysicalDamageIncrease, value: 0.5, percent: true }] })).toThrow(EngineError);
  });

  it("read by {attr} values: a hit on DEF (KitHit.base)", () => {
    const b = buff(0.5, true);
    const hit = (buffs: KitBuff[]) => afterAttack1(withKit({ hit: { base: { attr: Attr.Def } }, buffs, triggers: buffs.map((x) => onStart(x.id)) })).hit.zones.atk;
    expect(hit([])).toBeCloseTo(def.total, 9);
    expect(hit([b])).toBeCloseTo(def.total + ofLine(0.5), 9);
  });

  it("the loader takes it from formulaItem 6 (OBJ Heavy Burden's DEF +def_up), and a kit's percent must agree", () => {
    const heavy: KitBuff = { id: "wpn_claym_0015.def", label: "DEF", target: "self", gameBuff: "buff_wpn_claym_0015", modifiers: [{ attr: Attr.Def, value: "def_up" }] };
    expect(withGameBuff("test", heavy).modifiers[0]?.percent).toBe(true);
    expect(() => withGameBuff("test", { ...heavy, modifiers: [{ attr: Attr.Def, value: "def_up", percent: false }] })).toThrow(/percent is true/);
  });
});

describe("B1: instances of a buff with a priority (stackingType 1, priority key)", () => {
  const mk = (value: number, appliedAt: number, maxInstances: number): ActiveBuff => ({
    id: "p", owner: op, target: "self", appliedAt, expiresAt: appliedAt + 600, stackGroup: "g", maxInstances, priority: value,
    modifiers: [{ zone: "damageBonus", value, element: "physical", source: "p" }],
  });
  const values = (buffs: readonly ActiveBuff[]) => buffs.map((b) => b.modifiers[0]?.value);

  it("a weaker reapplication is kept beside a stronger one, which alone acts; at the limit the weakest goes", () => {
    const two = withBuff(withBuff([], mk(0.56, 0, 2)), mk(0.14, 10, 2));
    expect(values(two)).toEqual([0.56, 0.14]);
    expect(buffModifiers(two, op, 20).map((m) => m.value)).toEqual([0.56]);
    // A third: the weakest, oldest first, goes (the stronger stays).
    const three = withBuff(two, mk(0.14, 20, 2));
    expect(three.map((b) => [b.modifiers[0]?.value, b.appliedAt])).toEqual([[0.56, 0], [0.14, 20]]);
    // One instance: a weaker one isn't applied, an equal one replaces it.
    const one = withBuff([], mk(0.56, 0, 1));
    expect(withBuff(one, mk(0.14, 10, 1))).toEqual(one);
    expect(withBuff(one, mk(0.56, 10, 1)).map((b) => b.appliedAt)).toEqual([10]);
    // 0: no limit.
    expect(withBuff(withBuff(withBuff([], mk(0.1, 0, 0)), mk(0.2, 1, 0)), mk(0.3, 2, 0))).toHaveLength(3);
  });

  it("a stack group's highest-priority instance acts whole: not the strongest value of each modifier, nor their sum", () => {
    const two = (priority: number, a: number, b: number, appliedAt: number): ActiveBuff => ({
      id: "p", owner: op, target: "self", appliedAt, expiresAt: appliedAt + 600, stackGroup: "g", priority,
      modifiers: [{ zone: "damageBonus", value: a, source: "p" }, { zone: "attribute", attr: Attr.Str, value: b, source: "p" }],
    });
    const acts = (buffs: ActiveBuff[]) => buffModifiers(buffs, op, 20).map((m) => [m.zone, m.value]);
    // A: priority 0.5, DMG +0.5 and Strength +10; B: priority 0.2, DMG +0.2 and Strength +40. B's values sum to more
    // (the rule until 2026-10-26 would have kept it) and its Strength is higher (the per-modifier rule before 2026-10-25
    // would have mixed the two); the game keeps A, by its priority.
    expect(acts([two(0.5, 0.5, 10, 0), two(0.2, 0.2, 40, 10)])).toEqual([["damageBonus", 0.5], ["attribute", 10]]);
    // Equal priority: the latest applied.
    expect(acts([two(0.5, 0.5, 10, 0), two(0.5, 0.1, 40, 10)])).toEqual([["damageBonus", 0.1], ["attribute", 40]]);
    // At an instance limit the lowest priority goes, whatever its values.
    const limited = (priority: number, a: number, appliedAt: number) => ({ ...two(priority, a, 0, appliedAt), maxInstances: 1 });
    expect(withBuff([limited(0.5, 0.1, 0)], limited(0.2, 0.9, 10)).map((b) => b.priority)).toEqual([0.5]);
  });

  it("on the timeline: each instance keeps its own timer, and the buff ends with its last one", () => {
    const amp = { if: { buffActive: "inst" }, then: 0.1, else: 0.3 } as const;
    const inst: KitBuff = { id: "inst", label: "inst", target: "self", duration: 5, instances: 2, stackGroup: "inst", priority: { from: "kit", value: amp }, modifiers: [{ zone: "amp", value: amp }] };
    const triggers: KitTrigger[] = [
      { id: "give", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "buff", buff: "inst" }] },
      { id: "ended", on: { event: "buffEnded", buff: "inst" }, by: "self", do: [{ kind: "gain", gains: [{ stack: "ended", amount: 1 }] }] },
    ];
    // Casts at 0 and 4 s: the first instance (+0.3) runs to 5 s, the second (+0.1) to 9 s.
    const casts = [skill("normal_skill", 0), skill("normal_skill", 30 * 4)];
    const amps = (d: GameData) => simulate(d, scenario(casts)).hits.filter((h) => h.hitId === "explosion").map((h) => h.zones.amp);
    const plain = amps(data);
    const stacks = [{ id: "ended", label: "ended", max: 9 }];
    const added = (d: GameData) => amps(d).map((a, i) => Math.round((a - (plain[i] ?? 0)) * 100) / 100);
    expect(added(withKit({ buffs: [inst], triggers, stacks }))).toEqual([0.3, 0.3]);
    // Without instances a reapplication replaces: the weaker one at 4 s ends the stronger.
    const { instances: _i, ...replacing } = inst;
    expect(added(withKit({ buffs: [replacing], triggers, stacks }))).toEqual([0.3, 0.1]);
    const ctx = createContext(withKit({ buffs: [inst], triggers, stacks }), scenario(casts));
    let s = init(ctx);
    for (const a of casts) s = apply(ctx, s, a);
    // At 6 s the stronger has run out and the weaker acts on its own timer.
    const at6 = advance(ctx, s, 30 * 6);
    expect(buffModifiers(at6.buffs.filter((b) => b.id === "inst"), op, 30 * 6).map((m) => m.value)).toEqual([0.1]);
    expect(at6.stacks[op]?.["ended"] ?? 0).toBe(0);
    expect(advance(ctx, at6, 30 * 30).stacks[op]?.["ended"]).toBe(1);
  });

  it("the loader keeps maxStackCnt instances (0: no limit) and refuses maxStacks beside them", () => {
    const canal: KitBuff = { id: "c", label: "c", target: "self", gameBuff: "buff_wpn_claym_0014_pdi_up", duration: "duration", modifiers: [{ attr: Attr.PhysicalDamageIncrease, value: "phy_dmg_up_mult" }] };
    expect(withGameBuff("test", canal)).toMatchObject({ instances: 2, stackGroup: "buff_wpn_claym_0014_pdi_up" });
    expect(() => withGameBuff("test", { ...canal, maxStacks: 2 })).toThrow(/drop maxStacks/);
    expect(data.kits.equipment["suit_crush_fracture"]?.buffs.find((b) => b.id === "suit_crush_fracture.phys")).toMatchObject({ instances: 0 });
  });
});

describe("B2: stackingType 11 across wielders", () => {
  it("one instance with a priority key is a stack group (strongest across owners); layered type 11 stays per owner", () => {
    expect(data.kits.equipment["wpn_claym_0018"]?.buffs.find((b) => b.id === "wpn_claym_0018.enemy_vul")?.stackGroup).toBe("buff_wpn_claym_0018_enemyvul");
    const arts: KitBuff = { id: "a", label: "a", target: "team", gameBuff: "buff_wpn_funnel_0014_up", modifiers: [{ zone: "damageBonus", value: 0.1 }] };
    expect(withGameBuff("test", arts).stackGroup).toBe("buff_wpn_funnel_0014_up");
    expect(withGameBuff("test", { ...arts, gameBuff: "buff_wpn_lance_0014_damageup" }).stackGroup).toBeUndefined();
    const copy = (owner: string, value: number): ActiveBuff => ({ id: "a", owner, target: "team", appliedAt: 0, expiresAt: 100, stackGroup: "buff_wpn_funnel_0014_up", modifiers: [{ zone: "damageBonus", value, source: owner }] });
    expect(buffModifiers([copy("x", 0.1), copy("y", 0.16)], op, 10).map((m) => m.value)).toEqual([0.16]);
  });
});

describe("stackingType 2 with one literal layer across appliers", () => {
  it("a buff on others is one group (two Eternal Xiranite wearers' team DMG is one +0.16 in 9555de54bb3d); a self buff stays as it is", () => {
    expect(data.kits.equipment["suit_usp02"]?.buffs.find((b) => b.id === "suit_usp02.team_dmg")?.stackGroup).toBe("buff_equipsuit_usp_02_AddAttack");
    const self: KitBuff = { id: "s", label: "s", target: "self", gameBuff: "buff_equipsuit_usp_02_AddAttack", modifiers: [{ zone: "damageBonus", value: 0.16 }] };
    expect(withGameBuff("test", self).stackGroup).toBeUndefined();
    // A max_stack layer count stays per owner (Qingbo's spellup lists two layers from one wearer).
    expect(data.kits.equipment["suit_combo_cd01"]?.buffs.find((b) => b.id === "suit_combo_cd01.spellup")?.stackGroup).toBeUndefined();
  });
});
