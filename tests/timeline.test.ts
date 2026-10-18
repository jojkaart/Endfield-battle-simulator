// Timeline engine invariants on real data (Laevatain's kit).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, buffModifiers, computeStats, createContext, earliestStart, EngineError, init, simulate, skillValue, SP, type Build, type EquipmentKit, type GameData, type KitBuff, type KitHit, type KitTrigger, type Modifier, type OperatorKit, type Predicate, type RotationAction, type TimelineScenario, wornEquipment } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const chain: RotationAction[] = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s) => ({ operator: op, skill: L + s }));
const scenario = (rotation: RotationAction[]): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation,
  options: { crit: "never" },
  // Tests that cast her ultimate start with it charged.
  startEnergy: { [op]: "full" },
});

describe("timeline", () => {
  const rotation = [...chain, { operator: op, skill: L + "normal_skill" }, ...chain, ...chain, { operator: op, skill: L + "normal_skill" }];
  const result = simulate(data, scenario(rotation));

  it("total and per-operator damage are the sums of the hits", () => {
    const sum = result.hits.reduce((s, h) => s + h.exact, 0);
    expect(result.total).toBeCloseTo(sum, 6);
    expect(result.perOperator[op]).toBeCloseTo(sum, 6);
  });

  it("each hit lands at its cast's frame plus its kit frame, with the same damage as a single-hit calculation", () => {
    const attack1 = result.hits.filter((h) => h.skillId === L + "attack1");
    expect(attack1.map((h) => h.frame)).toEqual(result.casts.filter((c) => c.skill === L + "attack1").map((c) => c.frame + 6));
    // Non-crit basic attack 1 is the in-game verified 1952.
    expect(attack1.every((h) => h.damage === 1952)).toBe(true);
  });

  it("casts follow each other no sooner than the previous skill's cancel window", () => {
    const frames = result.casts.map((c) => c.frame);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    expect(frames[1]).toBe(10); // attack1's AllowNextSkillAction starts at frame 10
  });

  it("SP stays within 0..max, battle skills wait for SP, and SP gains apply", () => {
    for (const c of result.casts) {
      expect(c.spAfter).toBeGreaterThanOrEqual(0);
      expect(c.spAfter).toBeLessThanOrEqual(SP.max);
    }
    // Two battle skills in a row from 200 SP: the second waits for regeneration.
    const r = simulate(data, scenario([{ operator: op, skill: L + "normal_skill" }, { operator: op, skill: L + "normal_skill" }, { operator: op, skill: L + "normal_skill" }]));
    const [a, b, c] = r.casts;
    expect(a?.spAfter).toBe(100);
    // The first cast's P1 SP return (+20) and regeneration leave less than 100 after the second, so the third waits.
    expect(b?.spAfter).toBeLessThan(100);
    expect((c?.frame ?? 0) - (b?.frame ?? 0)).toBeGreaterThan(SP.pauseAfterSpendFrames);
  });

  it("is deterministic, and a forked state continues exactly like a straight run", () => {
    expect(simulate(data, scenario(rotation)).total).toBe(result.total);
    const ctx = createContext(data, scenario(rotation));
    let s = init(ctx);
    for (const a of rotation.slice(0, 7)) s = apply(ctx, s, a);
    const fork = structuredClone(s);
    let x = s;
    let y = fork;
    for (const a of rotation.slice(7)) {
      x = apply(ctx, x, a);
      y = apply(ctx, y, a);
    }
    x = advance(ctx, x, ctx.scenario.durationFrames);
    y = advance(ctx, y, ctx.scenario.durationFrames);
    expect(y).toEqual(x);
    expect(x.hits.reduce((t, h) => t + h.exact, 0)).toBe(result.total);
  });

  it("illegal actions are errors", () => {
    expect(() => simulate(data, scenario([{ operator: "chr_0004_pelica", skill: "x" }]))).toThrow(EngineError);
    expect(() => simulate(data, scenario([{ operator: op, skill: "chr_0016_laevat_dodge" }]))).toThrow(/kit has no skill/);
    // Plain attacks are replaced during her ultimate, and the enhanced ones need it.
    expect(() => simulate(data, scenario([{ operator: op, skill: L + "ultimate_skill" }, { operator: op, skill: L + "attack1" }]))).toThrow(/isn't available at frame \d+ \({"not":{"buffActive":"twilight"}}\)/);
    expect(() => simulate(data, scenario([{ operator: op, skill: L + "ult_attack1" }]))).toThrow(/isn't available at frame \d+ \({"buffActive":"twilight"}\)/);
    // Her combo needs Combustion or Corrosion on the enemy first.
    expect(() => simulate(data, scenario([{ operator: op, skill: L + "combo_skill" }]))).toThrow(/combo trigger hasn't happened/);
  });
});

describe("timeline: stacks and arts reactions", () => {
  const act = (skill: string): RotationAction => ({ operator: op, skill: L + skill });
  const ult = ["ultimate_skill", "ult_attack1", "ult_attack2", "ult_attack3"].map(act);

  it("a hit that needs stacks only happens with them, and the cast uses them up", () => {
    // Without Melting Flame the battle skill has no empowered hit and forces nothing.
    const plain = simulate(data, scenario([act("normal_skill")]));
    expect(plain.hits.some((h) => h.hitId === "empowered_extra")).toBe(false);
    expect(plain.reactions).toEqual([]);
    // Four battle skills (+1 stack each) make the fifth empowered: its extra hit lands and forces Combustion.
    const five = simulate(data, { ...scenario(Array.from({ length: 5 }, () => act("normal_skill"))), durationFrames: 30 * 120 });
    const extras = five.hits.filter((h) => h.hitId === "empowered_extra");
    expect(extras).toHaveLength(1);
    expect(extras[0]?.frame).toBeGreaterThan(five.casts[4]?.frame ?? Infinity);
    expect(five.reactions.filter((e) => e.kind === "reaction")).toEqual([
      expect.objectContaining({ status: "combustion", level: 1, consumed: null, initialHit: false }),
    ]);
    // Combustion ticks once per second for the skill's `duration` (5 s, ×1.5 from potential 3), as reaction damage that can't crit.
    const ticks = five.hits.filter((h) => h.skillId === "reaction:combustionTick");
    expect(ticks).toHaveLength(build.potential >= 3 ? 7 : 5);
    expect(ticks.every((h) => h.zones.crit === 1)).toBe(true);
  });

  it("ultimate attack 3 inflicts Heat: a second one bursts, a Final Strike absorbs it for Melting Flame", () => {
    const twice = simulate(data, scenario([...ult, act("ult_attack1"), act("ult_attack2"), act("ult_attack3")]));
    expect(twice.reactions.map((e) => e.kind)).toEqual(["burst"]);
    // Ultimate attack 4 is a Final Strike in the data (mask bit 2097152): it absorbs the Heat before the next sequence.
    const absorbed = simulate(data, scenario([...ult, act("ult_attack4"), act("ult_attack1"), act("ult_attack2"), act("ult_attack3")]));
    expect(absorbed.reactions.map((e) => e.kind)).toEqual(["consumed"]);
    const burst = twice.hits.filter((h) => h.skillId === "reaction:burst");
    expect(burst).toHaveLength(1);
    expect(burst[0]?.scaleParts[0]).toEqual({ key: "burst base", value: 1.6 });

    const ctx = createContext(data, scenario([]));
    let s = init(ctx);
    for (const a of [...ult, act("ult_attack4")]) s = apply(ctx, s, a);
    s = advance(ctx, s, ctx.scenario.durationFrames);
    expect(s.reactions).toEqual([expect.objectContaining({ kind: "consumed", element: "fire", stacks: 1 })]);
    expect(s.enemy.infliction).toBeNull();
    expect(s.stacks[op]).toEqual({ melting_flame: 1 });
  });
});

describe("timeline: Zero Sanity's in-game forced Combustion (fixtures/zero-sanity-laevatain-p5.json)", () => {
  const fx = JSON.parse(readFileSync(new URL("../fixtures/zero-sanity-laevatain-p5.json", import.meta.url), "utf8")) as { build: Build };
  const r = simulate(data, {
    team: [fx.build],
    target: { enemy: "eny_0051_rodin", level: 90 },
    durationFrames: 30 * 120,
    rotation: Array.from({ length: 5 }, () => ({ operator: op, skill: L + "normal_skill" })),
    options: { crit: "never" },
  });

  it("the fifth battle skill is empowered (57552) and its Combustion ticks for 2608, 7.5 s at P5", () => {
    expect(r.hits.filter((h) => h.hitId === "empowered_extra").map((h) => h.damage)).toEqual([57552]);
    const ticks = r.hits.filter((h) => h.skillId === "reaction:combustionTick");
    expect(ticks.map((h) => h.damage)).toEqual(Array.from({ length: 7 }, () => 2608));
  });
});

describe("timeline: a reaction applies before the hit that triggers it", () => {
  const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
  const team = fx.team.filter((b) => b.operator === op || b.operator === "chr_0013_aglina");
  const r = simulate(data, {
    team,
    target: { enemy: "eny_0051_rodin", level: 90 },
    durationFrames: 30 * 30,
    rotation: [
      ...["ultimate_skill", "ult_attack1", "ult_attack2", "ult_attack3"].map((s) => ({ operator: op, skill: L + s })),
      { operator: "chr_0013_aglina", skill: "chr_0013_aglina_normal_skill" },
    ],
    options: { crit: "never" },
    startEnergy: { [op]: "full" },
  });

  it("Gilberta's explosion consumes Laevatain's Heat into Corrosion, and its own damage already has the shred", () => {
    const corrosion = r.reactions.find((e) => e.kind === "reaction");
    expect(corrosion).toMatchObject({ operator: "chr_0013_aglina", status: "corrosion", level: 1, consumed: "fire", initialHit: true });
    const explosion = r.hits.find((h) => h.operator === "chr_0013_aglina" && h.frame === corrosion?.frame && !h.skillId.startsWith("reaction"));
    expect(explosion?.modifiers.some((m) => m.source === "Corrosion level 1")).toBe(true);
    const initial = r.hits.find((h) => h.skillId === "reaction:reaction");
    expect(initial?.element).toBe("natural");
    expect(initial?.modifiers.some((m) => m.source === "Corrosion level 1")).toBe(true);
  });
});

describe("timeline: timed buffs from kits", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const buff: KitBuff = {
    id: "test_amp",
    label: "test amp",
    target: "team",
    duration: 2,
    modifiers: [{ zone: "amp", value: { product: ["atk_scale", 2] }, elements: ["fire"] }],
  };
  const withBuffKit = (beforeDamage: boolean): GameData => ({
    ...data,
    kits: {
      ...data.kits,
      operators: {
        ...data.kits.operators,
        [op]: {
          ...kit,
          buffs: [buff],
          skills: kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, buffs: [{ buff: "test_amp", beforeDamage }] })) } : s)),
        },
      },
    },
  });
  const rot = [...chain, { operator: op, skill: L + "attack1", at: 30 * 10 }];

  it("a buff acts on later hits for its duration, with its value from the applying skill", () => {
    const r = simulate(withBuffKit(false), scenario(rot));
    const plain = simulate(data, scenario(rot));
    const v = 2 * skillValue(data, computeStats(data, build), build, L + "attack1", "atk_scale");
    const byIndex = (res: typeof r) => res.hits.filter((h) => !h.skillId.startsWith("reaction"));
    const [a1, a2] = [byIndex(r), byIndex(plain)];
    // attack1 itself: no buff yet (applied after its damage). attack2 (0.33 s later): +v Amp.
    expect(a1[0]?.zones.amp).toBe(a2[0]?.zones.amp);
    expect(a1[1]?.zones.amp).toBeCloseTo((a2[1]?.zones.amp ?? 0) + v, 12);
    // The late attack1 at 10 s: the buff from the first one has expired.
    expect(a1.at(-1)?.zones.amp).toBe(a2.at(-1)?.zones.amp);
  });

  it("beforeDamage makes the buff act on the applying hit too", () => {
    const r = simulate(withBuffKit(true), scenario(rot));
    const plain = simulate(data, scenario(rot));
    expect(r.hits[0]?.zones.amp).toBeGreaterThan(plain.hits[0]?.zones.amp ?? Infinity);
  });
});

describe("timeline: ultimate energy and combo windows", () => {
  const panel = computeStats(data, build);
  const efficiency = panel.attrs[44]?.total ?? data.attributeDefaults[44] ?? 1;
  const noEnergy = (rotation: RotationAction[]): TimelineScenario => {
    const { startEnergy: _full, ...rest } = scenario(rotation);
    return rest;
  };

  it("an ultimate needs its full cost (after potentials: P4 ×0.85) and uses it up", () => {
    expect(() => simulate(data, noEnergy([{ operator: op, skill: L + "ultimate_skill" }]))).toThrow(/needs 255\.0+\d* ultimate energy/);
    const r = simulate(data, scenario([{ operator: op, skill: L + "ultimate_skill" }]));
    expect(r.casts[0]?.energyAfter).toBe(0);
  });

  it("a battle skill gives 0.065 energy per natural SP; SP returned by skills is spent first and gives none", () => {
    const one = simulate(data, noEnergy([{ operator: op, skill: L + "normal_skill" }]));
    expect(one.casts[0]?.energyAfter).toBeCloseTo(100 * 0.065 * efficiency, 9);
    // The final strike returns 20 SP (atb); the battle skill after it spends those 20 first.
    const after = simulate(data, noEnergy([...chain, { operator: op, skill: L + "normal_skill" }]));
    expect(after.casts.at(-1)?.energyAfter).toBeCloseTo(80 * 0.065 * efficiency, 9);
  });

  it("her ultimate blocks her energy gain for 16 s", () => {
    const r = simulate(data, scenario([{ operator: op, skill: L + "ultimate_skill" }, { operator: op, skill: L + "normal_skill_during_ult" }]));
    expect(r.casts[1]?.energyAfter).toBe(0);
  });

  it("the combo opens 6 s after its trigger and closes when cast", () => {
    const five = Array.from({ length: 5 }, () => ({ operator: op, skill: L + "normal_skill" }));
    const ctx = createContext(data, { ...noEnergy(five), durationFrames: 30 * 120 });
    let s = init(ctx);
    for (const a of five) s = apply(ctx, s, a);
    const combustion = advance(ctx, s, ctx.scenario.durationFrames).reactions.find((e) => e.kind === "reaction");
    if (!combustion) throw new Error("no Combustion");
    s = advance(ctx, s, combustion.frame);
    expect(s.comboWindow[op]).toMatchObject({ from: combustion.frame, until: combustion.frame + 180 });
    // Too late: the window has closed.
    expect(earliestStart(ctx, s, { operator: op, skill: L + "combo_skill", at: combustion.frame + 181 })).toHaveProperty("error");
    const cast = apply(ctx, s, { operator: op, skill: L + "combo_skill" });
    expect(cast.comboWindow[op]).toBeUndefined();
    // Its hit grants 25 energy (one enemy), up to the cap (her ultimate's cost, 255 at P5).
    const landed = advance(ctx, cast, ctx.scenario.durationFrames);
    expect(landed.energy[op]).toBeCloseTo(Math.min(255.00000715255737, (cast.energy[op] ?? 0) + 25 * efficiency), 6);
  });
});

describe("timeline: buffs that don't stack across operators", () => {
  it("only the strongest instance of a priority-keyed game buff counts", () => {
    const mk = (owner: string, value: number, stackGroup?: string) => ({
      id: "s", owner, target: "enemy" as const, appliedAt: 0, expiresAt: 100,
      modifiers: [{ zone: "susceptibility" as const, value, element: "fire" as const, source: owner }],
      ...(stackGroup ? { stackGroup } : {}),
    });
    const grouped = buffModifiers([mk("a", 0.3, "g"), mk("b", 0.36, "g")], "a", 10);
    expect(grouped.map((m) => m.value)).toEqual([0.36]);
    const separate = buffModifiers([mk("a", 0.3), mk("b", 0.36)], "a", 10);
    expect(separate.map((m) => m.value)).toEqual([0.3, 0.36]);
  });

  it("the loader takes the stack group from BuffData: Gilberta's Arts Susceptibility stacks (type 0), so it has none", () => {
    const b = data.kits.operators["chr_0013_aglina"]?.buffs.find((x) => x.id === "arts_susceptibility");
    expect(b).toBeDefined();
    expect(b?.stackGroup).toBeUndefined();
  });
});

describe("timeline: kit triggers", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const mark: KitBuff = { id: "test_mark", label: "test mark", target: "self", duration: 3, modifiers: [] };
  const withTriggers = (triggers: KitTrigger[], buffs: KitBuff[] = []): GameData => ({
    ...data,
    kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, buffs: [...kit.buffs, mark, ...buffs], triggers: [...kit.triggers, ...triggers] } } },
  });
  const skill = (s: string) => ({ operator: op, skill: L + s });
  const run = (d: GameData, rotation: RotationAction[], until = 30 * 30, modifiers: Modifier[] = []) => {
    const { startEnergy: _full, ...rest } = scenario(rotation);
    const ctx = createContext(d, { ...rest, options: { ...rest.options, modifiers } });
    let s = init(ctx);
    for (const a of rotation) s = apply(ctx, s, a);
    return { ctx, s: advance(ctx, s, until) };
  };

  it("a cast trigger applies a buff, at most once per cooldown and maxCount times", () => {
    const d = withTriggers([{ id: "t", on: { event: "cast", kinds: ["battle"] }, by: "self", cooldown: 4, maxCount: 2, do: [{ kind: "buff", buff: "test_mark" }] }]);
    const casts = [skill("normal_skill"), { ...skill("normal_skill"), at: 30 * 2 }, { ...skill("normal_skill"), at: 30 * 5 }, { ...skill("normal_skill"), at: 30 * 10 }];
    const { s } = run(d, casts);
    // Cast at 0 fires; at 2 s it's on cooldown; at 5 s it fires again; at 10 s the count is used up.
    expect(s.triggerState[`${op}:t`]).toEqual({ readyAt: (s.casts[2]?.frame ?? NaN) + 120, count: 2 });
  });

  it("a buff ending is an event: here it grants energy and SP", () => {
    const d = withTriggers([
      { id: "a", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "buff", buff: "test_mark" }] },
      { id: "b", on: { event: "buffEnded", buff: "test_mark" }, by: "self", do: [{ kind: "energy", value: 30 }, { kind: "sp", value: 10 }] },
    ]);
    const plain = run(data, [skill("normal_skill")], 30 * 2);
    const at2 = run(d, [skill("normal_skill")], 30 * 2);
    const at4 = run(d, [skill("normal_skill")], 30 * 4);
    expect(at2.s.energy[op]).toBeCloseTo(plain.s.energy[op] ?? 0, 9);
    const efficiency = computeStats(data, build).attrs[44]?.total ?? data.attributeDefaults[44] ?? 1;
    const plain4 = run(data, [skill("normal_skill")], 30 * 4);
    expect(at4.s.energy[op]).toBeCloseTo((plain4.s.energy[op] ?? 0) + 30 * efficiency, 9);
    expect(at4.s.sp).toBeCloseTo(Math.min(SP.max, plain4.s.sp + 10), 9);
  });

  it("a cooldown action cuts a skill's remaining cooldown, not below now", () => {
    const d = withTriggers([{ id: "c", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "cooldown", who: "self", skills: "combo", seconds: -2 }] }]);
    const ctx = createContext(d, { ...scenario([]), durationFrames: 30 * 120 });
    const five = Array.from({ length: 5 }, () => skill("normal_skill"));
    let s = init(ctx);
    for (const a of five) s = apply(ctx, s, a);
    const combustion = advance(ctx, s, ctx.scenario.durationFrames).reactions.find((e) => e.kind === "reaction");
    if (!combustion) throw new Error("no Combustion");
    s = apply(ctx, advance(ctx, s, combustion.frame), skill("combo_skill"));
    const ready = s.readyAt[L + "combo_skill"] ?? 0;
    const after = apply(ctx, s, skill("normal_skill"));
    expect(after.readyAt[L + "combo_skill"]).toBe(Math.max(after.casts.at(-1)?.frame ?? NaN, ready - 60));
  });

  it("each action can have its own if: here only the controlled operator's casts give the buff", () => {
    const d = (p: Predicate) => withTriggers([{ id: "c", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "energy", value: 1 }, { kind: "buff", buff: "test_mark", if: p }] }]);
    const marked = (p: Predicate) => run(d(p), [skill("normal_skill")], 30).s.buffs.some((b) => b.id === "test_mark");
    expect(marked({ controlled: true })).toBe(true);
    expect(marked({ not: { controlled: true } })).toBe(false);
  });

  it("a trigger loop in the kit data is an error, not a hang", () => {
    const d = withTriggers([
      { id: "a", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "buff", buff: "test_mark" }] },
      { id: "loop", on: { event: "buffApplied", buff: "test_mark" }, by: "self", do: [{ kind: "buff", buff: "test_mark" }] },
    ]);
    expect(() => run(d, [skill("normal_skill")])).toThrow(EngineError);
  });

  it("a trigger lands hits as its owner, at frames from the event, with values from its skill", () => {
    const echo: KitHit = { id: "echo", label: "echo", scale: ["atk_scale"], count: 2, frames: [10, 40], events: [], damageType: "none", element: "fire", applies: [{ kind: "infliction", element: "fire" }] };
    const d = withTriggers([{ id: "echo", on: { event: "cast", kinds: ["battle"] }, by: "self", skill: L + "normal_skill", do: [{ kind: "hits", hits: [echo] }] }]);
    const { s } = run(d, [skill("normal_skill")], 30 * 30, [{ zone: "damageBonus", value: 0.5, skillType: "battle", source: "test battle bonus" }]);
    const cast = s.casts[0]?.frame ?? NaN;
    const echoes = s.hits.filter((h) => h.hitId === "echo");
    expect(echoes.map((h) => h.frame)).toEqual([cast + 10, cast + 40]);
    const explosion = s.hits.find((h) => h.hitId === "explosion");
    // Same scale as the explosion, but no battle-skill DMG bonus: a hit of no skill type.
    expect(echoes[0]?.scaleParts).toEqual(explosion?.scaleParts);
    expect(explosion?.modifiers.some((m) => m.source === "test battle bonus")).toBe(true);
    expect(echoes[0]?.modifiers.some((m) => m.source === "test battle bonus")).toBe(false);
    // Its applications are events like any hit's: the second Heat infliction bursts.
    expect(s.reactions.some((e) => e.kind === "burst" && e.frame === cast + 40)).toBe(true);
  });

  it("the loader migrated combo windows and Laevatain's absorption into triggers", () => {
    expect(kit.triggers.map((t) => [t.id, t.on.event, t.by])).toEqual([
      ["final_strike_absorb", "hit", "controlled"],
      ["combo_window", "reaction", "anyone"],
      ["twilight_paused_by_battle_skill", "cast", "self"],
      ["twilight_paused_by_combo", "cast", "self"],
    ]);
  });
});

describe("timeline: equipment kits act for the wearer", () => {
  const W = "wpn_sword_0006";
  const forgeborn: EquipmentKit = {
    id: W,
    stacks: [],
    buffs: [{ id: `${W}.after_ultimate`, label: "after ultimate", target: "self", duration: "duration", modifiers: [{ zone: "damageBonus", value: "normal_atk_up", skillType: "basic" }] }],
    triggers: [{ id: `${W}.on_ultimate`, on: { event: "cast", kinds: ["ultimate"] }, by: "self", skill: "sk_wpn_sword_0006", do: [{ kind: "buff", buff: `${W}.after_ultimate` }] }],
    conditions: [],
  };
  const withKit = (id: string): GameData => ({ ...data, kits: { ...data.kits, equipment: { ...data.kits.equipment, [id]: { ...forgeborn, id } } } });
  const rot = [{ operator: op, skill: L + "ultimate_skill" }, { operator: op, skill: L + "ult_attack1" }];
  const attack = (d: GameData) => simulate(d, scenario(rot)).hits.find((h) => h.skillId === L + "ult_attack1");

  it("a weapon's trigger and buff are its wearer's, with values from the weapon's skill at its level", () => {
    const v = skillValue(data, computeStats(data, build), build, "sk_wpn_sword_0006", "normal_atk_up");
    expect(v).toBeGreaterThan(0);
    expect(attack(withKit(W))?.zones.damageBonus).toBeCloseTo((attack(data)?.zones.damageBonus ?? NaN) + v, 9);
  });

  it("a kit of equipment the operator doesn't wear does nothing", () => {
    expect(attack(withKit("wpn_sword_0001"))?.zones.damageBonus).toBe(attack(data)?.zones.damageBonus);
  });

  it("what a build wears: its weapon, then its active gear sets", () => {
    expect(wornEquipment(data, build)[0]).toBe(W);
    const set = Object.values(data.gearSets).find((s) => s.piecesRequired === 3);
    const pieces = Object.values(data.gear).filter((g) => g.setId === set?.id).slice(0, 3);
    if (!set || pieces.length < 3) throw new Error("no three-piece gear set in the data");
    const worn: Build = { ...build, gear: pieces.map((g) => ({ id: g.id, artifice: [0, 0, 0] as const })) };
    expect(wornEquipment(data, worn)).toEqual([W, set.id]);
  });
});

describe("timeline: buff lifecycle", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const withKit = (triggers: KitTrigger[], buffs: KitBuff[], who = op): GameData => {
    const k = data.kits.operators[who] as OperatorKit;
    return { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [who]: { ...k, buffs: [...k.buffs, ...buffs], triggers: [...k.triggers, ...triggers] } } } };
  };
  const skill = (s: string) => ({ operator: op, skill: L + s });
  const onBattle = (d: KitTrigger["do"]): KitTrigger => ({ id: "t", on: { event: "cast", kinds: ["battle"] }, by: "self", do: d });
  const amp = (id: string, extra: Partial<KitBuff> = {}): KitBuff => ({ id, label: id, target: "self", duration: 20, modifiers: [{ zone: "amp", value: 0.1 }], ...extra });
  const ampOf = (r: ReturnType<typeof simulate>, hitId: string) => r.hits.filter((h) => h.hitId === hitId).map((h) => Math.round(h.zones.amp * 1000) / 1000);
  const three = [skill("normal_skill"), { ...skill("normal_skill"), at: 30 * 4 }, { ...skill("normal_skill"), at: 30 * 8 }];
  const plain = ampOf(simulate(data, scenario(three)), "explosion");

  it("a layered buff adds a layer per application, each with its own duration, up to its maximum", () => {
    const r = simulate(withKit([onBattle([{ kind: "buff", buff: "layered" }])], [amp("layered", { maxStacks: 2 })]), scenario(three));
    // The explosion lands after the cast's trigger: 1, 2, then still 2 layers (the oldest replaced).
    expect(ampOf(r, "explosion").map((a, i) => Math.round((a - (plain[i] ?? 0)) * 10) / 10)).toEqual([0.1, 0.2, 0.2]);
  });

  it("endBuff can end only the oldest layers", () => {
    const d = withKit([onBattle([{ kind: "buff", buff: "layered" }, { kind: "buff", buff: "layered" }, { kind: "endBuff", buff: "layered", layers: 1 }])], [amp("layered", { maxStacks: 3 })]);
    const r = simulate(d, scenario([skill("normal_skill")]));
    expect(Math.round(((ampOf(r, "explosion")[0] ?? 0) - (plain[0] ?? 0)) * 10) / 10).toBe(0.1);
  });

  it("a buff with 0 s duration isn't applied; one without a duration lasts until ended", () => {
    const zero = simulate(withKit([onBattle([{ kind: "buff", buff: "zero" }])], [amp("zero", { duration: 0 })]), scenario([skill("normal_skill")]));
    expect(ampOf(zero, "explosion")).toEqual([plain[0]]);
    const { duration: _d, ...forever } = amp("forever");
    const r = simulate(withKit([onBattle([{ kind: "buff", buff: "forever" }])], [forever]), scenario([skill("normal_skill"), { ...skill("normal_skill"), at: 30 * 50 }]));
    expect(ampOf(r, "explosion").map((a) => a > (plain[0] ?? Infinity))).toEqual([true, true]);
  });

  it("a buff consumed by the next cast of a kind acts on that cast's hits only", () => {
    const link = amp("link", { consumedBy: ["ultimate"], modifiers: [{ zone: "amp", value: 0.5 }] });
    const d = withKit([onBattle([{ kind: "buff", buff: "link" }])], [link]);
    const rot = [skill("normal_skill"), skill("ultimate_skill"), skill("ult_attack1")];
    const r = simulate(d, { ...scenario(rot), startEnergy: { [op]: "full" } });
    const base = simulate(data, { ...scenario(rot), startEnergy: { [op]: "full" } });
    const ult = (x: typeof r) => x.hits.find((h) => h.skillId === L + "ultimate_skill")?.zones.amp ?? NaN;
    // The ultimate's hit has it; the enhanced attack after it doesn't: the cast used it up.
    expect(ult(r) - ult(base)).toBeCloseTo(0.5, 9);
    const after = (x: typeof r) => x.hits.find((h) => h.skillId === L + "ult_attack1")?.zones.amp;
    expect(after(r)).toBe(after(base));
  });

  it("a team buff with a recipient filter reaches only the members it holds for", () => {
    const g = "chr_0013_aglina";
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
    const team = fx.team.filter((b) => b.operator === op || b.operator === g);
    const others = amp("others", { target: "team", recipients: { not: { isOwner: true } } });
    const d = withKit([onBattle([{ kind: "buff", buff: "others" }])], [others]);
    const rot = [skill("normal_skill"), { operator: g, skill: "chr_0013_aglina_normal_skill" }];
    const sc = { ...scenario(rot), team };
    const [r, base] = [simulate(d, sc), simulate(data, sc)];
    const firstOf = (x: typeof r, who: string) => x.hits.find((h) => h.operator === who && !h.skillId.startsWith("reaction"))?.zones.amp ?? NaN;
    expect(firstOf(r, op)).toBe(firstOf(base, op));
    expect(firstOf(r, g) - firstOf(base, g)).toBeCloseTo(0.1, 9);
  });

  it("periodic ticks drive heals, and a heal trigger buffs the healed teammate only (Liino's weapon pattern)", () => {
    const g = "chr_0013_aglina";
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
    const team = fx.team.filter((b) => b.operator === op || b.operator === g);
    const aura: KitBuff = { id: "aura", label: "aura", target: "self", duration: 3.5, every: 1, tickOnApply: true, modifiers: [] };
    const boost = amp("boost", { target: "team", maxStacks: 4 });
    const d = withKit(
      [
        onBattle([{ kind: "buff", buff: "aura" }]),
        { id: "tick", on: { event: "buffTick", buff: "aura" }, by: "self", do: [{ kind: "heal", target: "team" }] },
        { id: "healed", on: { event: "heal", toOthers: true }, by: "self", do: [{ kind: "buff", buff: "boost", to: "eventSubject" }] },
      ],
      [aura, boost],
    );
    const rot = [skill("normal_skill"), { operator: g, skill: "chr_0013_aglina_normal_skill", at: 30 * 4 }];
    const sc = { ...scenario(rot), team };
    const [r, base] = [simulate(d, sc), simulate(data, sc)];
    const firstOf = (x: typeof r, who: string) => x.hits.find((h) => h.operator === who && !h.skillId.startsWith("reaction"))?.zones.amp ?? NaN;
    // Ticks at 0, 1, 2 and 3 s heal the team; each heal of Gilberta gives her a layer: 4 layers by 4 s.
    expect(firstOf(r, g) - firstOf(base, g)).toBeCloseTo(0.4, 9);
    expect(r.hits.filter((h) => h.operator === op).map((h) => h.zones.amp)).toEqual(base.hits.filter((h) => h.operator === op).map((h) => h.zones.amp));
  });

  it("extendBuff adds to a buff's remaining time", () => {
    const short = amp("short", { duration: 2 });
    const rot = [skill("normal_skill"), { ...skill("normal_skill"), at: 30 * 4 }];
    const plain2 = ampOf(simulate(data, scenario(rot)), "explosion");
    const extra = (d: KitTrigger["do"]) => ampOf(simulate(withKit([{ id: "t", on: { event: "cast", kinds: ["battle"] }, by: "self", maxCount: 1, do: d }], [short]), scenario(rot)), "explosion").map((a, i) => a > (plain2[i] ?? Infinity));
    expect(extra([{ kind: "buff", buff: "short" }])).toEqual([true, false]);
    expect(extra([{ kind: "buff", buff: "short" }, { kind: "extendBuff", buff: "short", seconds: 3 }])).toEqual([true, true]);
  });

  it("an attribute buff that doesn't act on hits is read where the game reads it: Ultimate Gain Efficiency", () => {
    const uge: KitBuff = { id: "uge", label: "uge", target: "self", duration: 20, modifiers: [{ attr: 44, value: 0.5 }] };
    const d = withKit([{ id: "t", on: { event: "cast", kinds: ["basic"] }, by: "self", do: [{ kind: "buff", buff: "uge" }] }], [uge]);
    const rot = [skill("attack1"), skill("normal_skill")];
    const { startEnergy: _f, ...sc } = scenario(rot);
    const efficiency = computeStats(data, build).attrs[44]?.total ?? data.attributeDefaults[44] ?? 1;
    const energy = simulate(d, sc).casts[1]?.energyAfter ?? NaN;
    expect(energy).toBeCloseTo(100 * 0.065 * (efficiency + 0.5), 9);
    expect(kit.buffs.length).toBeGreaterThan(0);
  });
});


describe("timeline: values and resources", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const withKit = (patch: Partial<OperatorKit>): GameData => ({ ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, ...patch } } } });
  const skill = (s: string) => ({ operator: op, skill: L + s });
  const noEnergy = (rotation: RotationAction[]): TimelineScenario => {
    const { startEnergy: _f, ...rest } = scenario(rotation);
    return rest;
  };
  const stepTo = (d: GameData, sc: TimelineScenario, frame: number) => {
    const ctx = createContext(d, sc);
    let s = init(ctx);
    for (const a of sc.rotation) s = apply(ctx, s, a);
    return advance(ctx, s, frame);
  };

  it("eventCount is the triggering event's count: here 2 Heat stacks inflicted give 2 Melting Flame", () => {
    const d = withKit({
      triggers: [
        ...kit.triggers,
        { id: "inflict", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "apply", applies: [{ kind: "infliction", element: "fire", stacks: 2 }] }] },
        { id: "count", on: { event: "inflictionApplied", elements: ["fire"] }, by: "self", do: [{ kind: "gain", gains: [{ stack: "melting_flame", amount: { eventCount: true } }] }] },
      ],
    });
    // Before the explosion (frame 22) adds its own.
    expect(stepTo(d, noEnergy([skill("normal_skill")]), 5).stacks[op]?.["melting_flame"]).toBe(2);
  });

  it("a combo window keeps the count of the event that opened it", () => {
    const five = Array.from({ length: 5 }, () => skill("normal_skill"));
    const ctx = createContext(data, { ...noEnergy(five), durationFrames: 30 * 120 });
    let s = init(ctx);
    for (const a of five) s = apply(ctx, s, a);
    const combustion = advance(ctx, s, ctx.scenario.durationFrames).reactions.find((e) => e.kind === "reaction");
    if (combustion?.kind !== "reaction") throw new Error("no Combustion");
    expect(advance(ctx, s, combustion.frame).comboWindow[op]?.count).toBe(combustion.level);
  });

  it("starting stacks: the scenario's, within the stack's maximum; unknown stacks are errors", () => {
    expect(stepTo(data, { ...noEnergy([]), startStacks: { [op]: { melting_flame: 3 } } }, 0).stacks[op]?.["melting_flame"]).toBe(3);
    expect(stepTo(data, { ...noEnergy([]), startStacks: { [op]: { melting_flame: 9 } } }, 0).stacks[op]?.["melting_flame"]).toBe(4);
    expect(() => stepTo(data, { ...noEnergy([]), startStacks: { [op]: { arrows: 1 } } }, 0)).toThrow(/no stack arrows/);
    const d = withKit({ stacks: kit.stacks.map((x) => ({ ...x, initial: 2 })) });
    expect(stepTo(d, noEnergy([]), 0).stacks[op]?.["melting_flame"]).toBe(2);
  });

  it("a hit that names its SP returns it when it lands, instead of the skill's atb on its first hit", () => {
    const plain = stepTo(data, noEnergy(chain), 30 * 3).sp;
    const d = withKit({ skills: kit.skills.map((s) => (s.skillId === L + "attack5" ? { ...s, hits: s.hits.map((h) => ({ ...h, sp: 5 })) } : s)) });
    const hits = kit.skills.find((s) => s.skillId === L + "attack5")?.hits.reduce((n, h) => n + h.count, 0) ?? 0;
    // attack5's atb is 20; here each of its landings returns 5 instead.
    expect(stepTo(d, noEnergy(chain), 30 * 3).sp).toBeCloseTo(plain - 20 + 5 * hits, 6);
  });

  it("energy grants: a fraction of the maximum, past a block, without efficiency; clearing energy", () => {
    const grant = (d: KitTrigger["do"]) =>
      stepTo(withKit({ triggers: [...kit.triggers, { id: "g", on: { event: "cast", kinds: ["basic"] }, by: "self", maxCount: 1, do: d }] }), noEnergy([skill("attack1")]), 1).energy[op] ?? NaN;
    expect(grant([{ kind: "energy", value: 0.5, percentOfMax: true, ignoreEfficiency: true }])).toBeCloseTo(255 * 0.5, 3);
    expect(grant([{ kind: "energy", value: 10, ignoreEfficiency: true }, { kind: "clearEnergy" }])).toBe(0);
    // Her ultimate blocks energy for 16 s; ignoreBlock gets through.
    const blocked = (opts: { ignoreBlock?: boolean }) =>
      stepTo(withKit({ triggers: [...kit.triggers, { id: "g", on: { event: "cast", kinds: ["basic"] }, by: "self", maxCount: 1, do: [{ kind: "energy", value: 10, ignoreEfficiency: true, ...opts }] }] }), scenario([skill("ultimate_skill"), skill("ult_attack1")]), 30 * 3).energy[op] ?? NaN;
    expect(blocked({})).toBe(0);
    expect(blocked({ ignoreBlock: true })).toBe(10);
  });

  it("a battle skill's team energy can come at its data frame instead of the cast", () => {
    const d = withKit({ skills: kit.skills.map((s) => (s.skillId === L + "normal_skill" ? { ...s, teamEnergyFrame: 29 } : s)) });
    const efficiency = computeStats(data, build).attrs[44]?.total ?? data.attributeDefaults[44] ?? 1;
    expect(stepTo(d, noEnergy([skill("normal_skill")]), 28).energy[op]).toBe(0);
    expect(stepTo(d, noEnergy([skill("normal_skill")]), 29).energy[op]).toBeCloseTo(100 * 0.065 * efficiency, 9);
  });
});

describe("timeline: skills", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const withKit = (patch: Partial<OperatorKit>): GameData => ({ ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, ...patch } } } });
  const skill = (s: string) => ({ operator: op, skill: L + s });
  const run = (d: GameData, sc: TimelineScenario, frame: number) => {
    const ctx = createContext(d, sc);
    let s = init(ctx);
    for (const a of sc.rotation) s = apply(ctx, s, a);
    return advance(ctx, s, frame);
  };
  const state: KitBuff = { id: "state", label: "state", target: "self", duration: 5, modifiers: [] };

  it("a hitless skill changes state at a frame through a delayed trigger on its own cast", () => {
    const d = withKit({
      buffs: [...kit.buffs, state],
      skills: kit.skills.map((s) => (s.skillId === L + "normal_skill" ? { ...s, hits: [] } : s)),
      triggers: [...kit.triggers, { id: "at10", on: { event: "cast", skills: [L + "normal_skill"] }, by: "self", delay: 10, do: [{ kind: "buff", buff: "state" }] }],
    });
    const before = run(d, scenario([skill("normal_skill")]), 9);
    expect(before.buffs.some((b) => b.id === "state")).toBe(false);
    expect(before.hits).toEqual([]);
    expect(run(d, scenario([skill("normal_skill")]), 10).buffs.find((b) => b.id === "state")?.appliedAt).toBe(10);
  });

  it("skills in a cooldown group put each other on cooldown", () => {
    const grouped = withKit({ skills: kit.skills.map((s) => (s.skillId === L + "normal_skill" || s.skillId === L + "combo_skill" ? { ...s, cooldownGroup: "g" } : s)) });
    const plain = run(data, scenario([skill("normal_skill")]), 1);
    const s = run(grouped, scenario([skill("normal_skill")]), 1);
    expect(plain.readyAt[L + "combo_skill"]).toBeUndefined();
    expect(s.readyAt[L + "combo_skill"]).toBeGreaterThan(0);
  });

  it("a skill that takes control makes its caster the controlled operator", () => {
    const g = "chr_0013_aglina";
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
    const team = fx.team.filter((b) => b.operator === op || b.operator === g);
    const sc: TimelineScenario = { ...scenario([skill("ultimate_skill")]), team, controlled: g };
    expect(run(data, sc, 1).controlled).toBe(g);
    const d = withKit({ skills: kit.skills.map((s) => (s.skillId === L + "ultimate_skill" ? { ...s, takesControl: true } : s)) });
    expect(run(d, sc, 1).controlled).toBe(op);
  });

  it("a buff can block its owner's energy gain while it lasts", () => {
    const d = withKit({ buffs: [...kit.buffs, { ...state, blocksEnergy: true }], triggers: [...kit.triggers, { id: "b", on: { event: "cast", kinds: ["basic"] }, by: "self", do: [{ kind: "buff", buff: "state" }] }] });
    const { startEnergy: _f, ...sc } = scenario([skill("attack1"), skill("normal_skill"), { ...skill("normal_skill"), at: 30 * 8 }]);
    const r = simulate(d, sc);
    expect(r.casts[1]?.energyAfter).toBe(0);
    expect(r.casts[2]?.energyAfter).toBeGreaterThan(0);
  });
});

describe("timeline: when the next action may start (SkillData windows, priorities, exclusive time)", () => {
  const skill = (s: string, at?: number): RotationAction => ({ operator: op, skill: L + s, ...(at !== undefined ? { at } : {}) });
  const after = (rotation: RotationAction[]) => {
    const ctx = createContext(data, { ...scenario(rotation), startEnergy: { [op]: "full" } });
    let s = init(ctx);
    for (const a of rotation) s = apply(ctx, s, a);
    return { ctx, s };
  };
  const start = (rotation: RotationAction[], next: RotationAction) => {
    const { ctx, s } = after(rotation);
    return earliestStart(ctx, s, next);
  };

  it("a chain step starts in the previous step's window that lists it, and only there", () => {
    // attack1: window 10–33 lists attack2.
    expect(start([skill("attack1")], skill("attack2"))).toEqual({ frame: 10 });
    expect(start([skill("attack1")], skill("attack3"))).toHaveProperty("error");
    expect(start([skill("attack1")], skill("attack2", 40))).toHaveProperty("error");
    expect(data.kits.operators[op]?.skills.find((s) => s.skillId === L + "attack2")?.chainStep).toBe(true);
  });

  it("an attack input in the chain's window is the chain's step, so attack1 again waits for the window to close", () => {
    expect(start([skill("attack1")], skill("attack1"))).toEqual({ frame: 34 });
  });

  it("an unlisted skill of the same or lower priority waits for the exclusive time", () => {
    // attack5: exclusive 42, its window lists only attack1; the battle skill outranks it but waits for its own hits (23, 26)…
    const { s } = after(chain);
    const a5 = s.casts.at(-1)?.frame ?? NaN;
    expect(start(chain, skill("normal_skill"))).toEqual({ frame: a5 + 26 });
    // …and a battle skill after a battle skill waits for its exclusive time (117).
    const bs = after([skill("normal_skill")]).s.casts.at(-1)?.frame ?? NaN;
    expect(start([skill("normal_skill")], skill("normal_skill"))).toEqual({ frame: bs + 117 });
  });

  it("a higher-priority skill given a time interrupts, cancelling the current skill's hits still to land", () => {
    // The ultimate (priority 7) at frame 5 of the battle skill: the explosion (frame 22) and its burn never land.
    const r = simulate(data, { ...scenario([skill("normal_skill"), skill("ultimate_skill", 5)]), startEnergy: { [op]: "full" } });
    expect(r.casts.map((c) => c.frame)).toEqual([0, 5]);
    expect(r.hits.filter((h) => h.skillId === L + "normal_skill")).toEqual([]);
  });

  it("swapping doesn't wait for the current action, except during a channel that forbids switching", () => {
    const g = "chr_0013_aglina";
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
    const team = fx.team.filter((b) => b.operator === op || b.operator === g);
    const swapAfter = (first: RotationAction, controlled: string) => {
      const ctx = createContext(data, { ...scenario([first]), team, controlled });
      const s = apply(ctx, init(ctx), first);
      return earliestStart(ctx, s, { operator: controlled === op ? g : op, skill: "swap" });
    };
    expect(swapAfter(skill("attack1"), op)).toEqual({ frame: 0 });
    // Gilberta's battle skill: ChannelingCastingAction frames 0–111 with cantSwitchPosition.
    expect(swapAfter({ operator: g, skill: "chr_0013_aglina_normal_skill" }, g)).toEqual({ frame: 111 });
  });
});

describe("timeline: follow-up casts", () => {
  it("a skill can cast another by itself, without control or cost: an off-field follow-up", () => {
    const kit = data.kits.operators[op] as OperatorKit;
    const g = "chr_0013_aglina";
    const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
    const team = fx.team.filter((b) => b.operator === op || b.operator === g);
    const d: GameData = {
      ...data,
      kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, triggers: [...kit.triggers, { id: "follow", on: { event: "cast", skills: [L + "normal_skill"] }, by: "self", delay: 30, do: [{ kind: "cast", skill: L + "attack1" }] }] } } },
    };
    // Gilberta is controlled; Laevatain's battle skill casts her attack1 1 s later, which a recorded basic attack couldn't do off-field.
    const { startEnergy: _f, ...sc } = scenario([{ operator: op, skill: L + "normal_skill" }]);
    const r = simulate(d, { ...sc, team, controlled: g });
    expect(r.casts.map((c) => [c.frame, c.skill])).toEqual([[0, L + "normal_skill"], [30, L + "attack1"]]);
    expect(r.hits.some((h) => h.skillId === L + "attack1" && h.frame === 36)).toBe(true);
    // Free: no SP spent (the explosion at frame 22 returned 20).
    expect(r.casts[1]?.spAfter).toBe((r.casts[0]?.spAfter ?? NaN) + 20);
  });
});

describe("timeline: stack requirements", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const mf = (st: { stacks: Record<string, Record<string, number>> }) => st.stacks[op]?.["melting_flame"];
  const withRequire = (r: KitHit["requires"]): GameData => ({
    ...data,
    kits: {
      ...data.kits,
      operators: {
        ...data.kits.operators,
        [op]: { ...kit, skills: kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, ...(r ? { requires: r } : {}) })) } : s)) },
      },
    },
  });
  const run = (d: GameData, start: number, frame: number) => {
    const ctx = createContext(d, { ...scenario([{ operator: op, skill: L + "attack1" }]), startStacks: { [op]: { melting_flame: start } } });
    let s = init(ctx);
    s = apply(ctx, s, { operator: op, skill: L + "attack1" });
    return advance(ctx, s, frame);
  };

  it("a requirement can be a range, use up part of a stack, at the cast or at the hit", () => {
    // attack1's hit lands at frame 6.
    expect(mf(run(withRequire({ stack: "melting_flame", atLeast: 2, consume: 1 }), 3, 1))).toBe(2);
    expect(mf(run(withRequire({ stack: "melting_flame", atLeast: 2, consume: 1, consumeAt: "hit" }), 3, 5))).toBe(3);
    expect(mf(run(withRequire({ stack: "melting_flame", atLeast: 2, consume: 1, consumeAt: "hit" }), 3, 6))).toBe(2);
    expect(mf(run(withRequire({ stack: "melting_flame", atLeast: 2, consume: true }), 3, 1))).toBe(0);
    // below: the hit happens only with fewer stacks.
    expect(run(withRequire({ stack: "melting_flame", below: 1 }), 3, 10).hits.filter((h) => h.skillId === L + "attack1")).toEqual([]);
    expect(run(withRequire({ stack: "melting_flame", below: 1 }), 0, 10).hits.filter((h) => h.skillId === L + "attack1").length).toBe(1);
  });
});

describe("timeline: arts state for kits", () => {
  const kit = data.kits.operators[op] as OperatorKit;
  const withKit = (patch: Partial<OperatorKit>): GameData => ({ ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, ...patch } } } });
  const run = (d: GameData, rotation: RotationAction[], frame: number, startStacks?: Record<string, number>) => {
    const ctx = createContext(d, { ...scenario(rotation), ...(startStacks ? { startStacks: { [op]: startStacks } } : {}) });
    let s = init(ctx);
    for (const a of rotation) s = apply(ctx, s, a);
    return advance(ctx, s, frame);
  };

  it("a hit computed as a burst is a burst for triggers", () => {
    const d = withKit({
      skills: kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, reaction: { kind: "burst" as const, element: "fire" as const } })) } : s)),
      triggers: [...kit.triggers, { id: "b", on: { event: "burst", elements: ["fire"] }, by: "self", do: [{ kind: "gain", gains: [{ stack: "melting_flame", amount: 1 }] }] }],
    });
    expect(run(d, [{ operator: op, skill: L + "attack1" }], 10).stacks[op]?.["melting_flame"]).toBe(1);
    // Its damage is the hit's own: no second burst hit.
    expect(run(d, [{ operator: op, skill: L + "attack1" }], 10).hits.filter((h) => h.skillId.startsWith("reaction")).length).toBe(0);
  });

  it("absorption up to the room left in a stack (Laevatain's talent at 3 of 4 Melting Flame)", () => {
    const room = { sum: [4, { product: [-1, { stackCount: "melting_flame" }] }] };
    const d = withKit({
      triggers: [
        { id: "heat", on: { event: "cast", kinds: ["basic"] }, by: "self", maxCount: 1, do: [{ kind: "apply", applies: [{ kind: "infliction", element: "fire", stacks: 3 }] }] },
        { id: "absorb", on: { event: "cast", kinds: ["battle"] }, by: "self", do: [{ kind: "apply", applies: [{ kind: "consumeInfliction", elements: ["fire"], stacks: room }] }] },
      ],
    });
    const s = run(d, [{ operator: op, skill: L + "attack1" }, { operator: op, skill: L + "normal_skill" }], 20, { melting_flame: 3 });
    expect(s.enemy.infliction).toMatchObject({ element: "fire", stacks: 2 });
  });
});

describe("timeline: an ultimate's time stop", () => {
  const g = "chr_0013_aglina";
  const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
  const team = fx.team.filter((b) => b.operator === op || b.operator === g);
  const runTo = (rotation: RotationAction[], frame: number) => {
    const ctx = createContext(data, { ...scenario(rotation), team, controlled: g, startEnergy: { [op]: "full", [g]: "full" } });
    let s = init(ctx);
    for (const a of rotation) s = apply(ctx, s, a);
    return { ctx, s, end: advance(ctx, s, frame) };
  };

  it("freezes everyone but the caster for its frames (Laevatain's: 0–61): others' hits on the way land later, the caster's don't", () => {
    const gil = { operator: g, skill: "chr_0013_aglina_normal_skill" };
    const ult = { operator: op, skill: L + "ultimate_skill", at: 10 };
    const plain = runTo([gil], 30 * 20).end.hits.filter((h) => h.operator === g).map((h) => h.frame);
    const stopped = runTo([gil, ult], 30 * 20).end.hits.filter((h) => h.operator === g).map((h) => h.frame);
    expect(stopped).toEqual(plain.map((f) => (f > 10 ? f + 61 : f)));
  });

  it("freezes the world's timers and SP regen, but not cooldowns", () => {
    const gil = { operator: g, skill: "chr_0013_aglina_normal_skill" };
    const before = runTo([gil], 10).end;
    const { s } = runTo([gil, { operator: op, skill: L + "ultimate_skill", at: 10 }], 10);
    expect(s.readyAt["chr_0013_aglina_normal_skill"]).toBe(before.readyAt["chr_0013_aglina_normal_skill"]);
    expect(s.spPausedUntil).toBe(Math.max(before.spPausedUntil, 10) + 61);
    expect(s.slowdowns).toEqual([{ start: 10, scales: Array.from({ length: 61 }, () => 0), exempt: op }]);
  });

  it("overlapping stops cost only what the new one adds", () => {
    // Gilberta's ultimate (0–52) right after Laevatain's (0–61): during the overlap Gilberta is frozen already; Laevatain loses Gilberta's 52 frames.
    const both = runTo([{ operator: op, skill: L + "ultimate_skill" }, { operator: g, skill: "chr_0013_aglina_ultimate_skill", at: 0 }], 0).s;
    expect(both.slowdowns.map((x) => [x.start, x.scales.length, x.exempt])).toEqual([[0, 61, op], [0, 52, g]]);
    expect(both.spPausedUntil).toBe(61);
  });
});
