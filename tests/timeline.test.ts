// Timeline engine invariants on real data (Laevatain's kit).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, computeStats, createContext, earliestStart, EngineError, init, simulate, skillValue, SP, type Build, type GameData, type KitBuff, type OperatorKit, type RotationAction, type TimelineScenario } from "@efsim/engine";
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
    expect(() => simulate(data, scenario([{ operator: op, skill: L + "ultimate_skill" }, { operator: op, skill: L + "attack1" }]))).toThrow(/isn't available during twilight/);
    expect(() => simulate(data, scenario([{ operator: op, skill: L + "ult_attack1" }]))).toThrow(/needs twilight active/);
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
    duration: { literal: 2 },
    modifiers: [{ zone: "amp", value: { key: "atk_scale", scale: 2 }, elements: ["fire"] }],
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
    expect(s.comboWindow[op]).toEqual({ from: combustion.frame, until: combustion.frame + 180 });
    // Too late: the window has closed.
    expect(earliestStart(ctx, s, { operator: op, skill: L + "combo_skill", at: combustion.frame + 181 })).toHaveProperty("error");
    const cast = apply(ctx, s, { operator: op, skill: L + "combo_skill" });
    expect(cast.comboWindow[op]).toBeUndefined();
    // Its hit grants 25 energy (one enemy), up to the cap (her ultimate's cost, 255 at P5).
    const landed = advance(ctx, cast, ctx.scenario.durationFrames);
    expect(landed.energy[op]).toBeCloseTo(Math.min(255.00000715255737, (cast.energy[op] ?? 0) + 25 * efficiency), 6);
  });
});
