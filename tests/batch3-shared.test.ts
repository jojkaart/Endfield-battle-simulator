// Batch-3 shared features (docs/kit-batches/batch-3.md): T1 Vulnerable counts
// on the event, T2 triggers on any operator's buff consumed, T3 SP source
// types, T4 weighted random choices, V2 buff layers as values, V3 hit counts
// as values. Each shown with a small hand-made change to Laevatain's kit.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import { advance, apply, applyToEnemy, createContext, init, landingFrames, NO_STATUS, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState, type ValueExpr } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const act = (skill: string, at?: number): RotationAction => ({ operator: op, skill: L + skill, ...(at !== undefined ? { at } : {}) });
const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map((s) => act(s));
const scenario = (rotation: RotationAction[], extra: Partial<TimelineScenario> = {}): TimelineScenario => ({
  team: [build],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation,
  options: { crit: "never" },
  ...extra,
});
/** Laevatain's kit with counting stacks a–e and extra buffs, triggers and skills. */
const withKit = (k: { buffs?: KitBuff[]; triggers?: KitTrigger[]; skills?: KitSkill[] }, d: GameData = data): GameData => ({
  ...d,
  kits: {
    ...d.kits,
    operators: {
      ...d.kits.operators,
      [op]: {
        ...kit,
        stacks: [...kit.stacks, ...["a", "b", "c", "d", "e"].map((id) => ({ id, label: id, max: 999 }))],
        buffs: [...kit.buffs, ...(k.buffs ?? [])],
        triggers: [...kit.triggers, ...(k.triggers ?? [])],
        skills: k.skills ?? kit.skills,
      },
    },
  },
});
const count = (id: string, on: KitTrigger["on"], stack: string, by: KitTrigger["by"] = "anyone", extra: Partial<KitTrigger> = {}): KitTrigger => ({ id, on, by, ...extra, do: [{ kind: "gain", gains: [{ stack, amount: 1 }] }] });
const run = (g: GameData, sc: TimelineScenario, frames = 30 * 10): TimelineState => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const a of sc.rotation) s = apply(ctx, s, a);
  return advance(ctx, s, frames);
};
const stacksOf = (s: TimelineState, operator = op) => s.stacks[operator] ?? {};

describe("T1: the vulnerable event's counts before and after", () => {
  it("carries the stacks before it; at the cap of 4 the count doesn't rise", () => {
    let s = NO_STATUS;
    const before: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = applyToEnemy(s, { kind: "vulnerable" }, i * 30, "a", 0);
      s = r.state;
      for (const e of r.events) if (e.kind === "vulnerable") before.push(e.before);
    }
    expect(before).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it("fromNone and rising filter it: six stacks, one from none, four rising, two at the cap", () => {
    // Each basic attack's cast adds one Vulnerable stack.
    const vuln: KitTrigger = { id: "vuln", on: { event: "cast", kinds: ["basic"] }, by: "self", do: [{ kind: "apply", applies: [{ kind: "vulnerable" }] }] };
    const g = withKit({
      triggers: [
        vuln,
        count("fromNone", { event: "vulnerable", fromNone: true }, "a"),
        count("fromSome", { event: "vulnerable", fromNone: false }, "b"),
        count("rising", { event: "vulnerable", rising: true }, "c"),
        count("atCap", { event: "vulnerable", rising: false }, "d"),
        count("all", { event: "vulnerable" }, "e"),
      ],
    });
    const n = stacksOf(run(g, scenario([...chain, act("attack1")])));
    expect(n).toMatchObject({ a: 1, b: 5, c: 4, d: 2, e: 6 });
  });

  it("an application of two stacks on a clean enemy is from none (Chimeric Justice), which `not enemyVulnerable 2` misses", () => {
    const two: KitTrigger = { id: "two", on: { event: "cast", skills: [L + "attack1"] }, by: "self", do: [{ kind: "apply", applies: [{ kind: "vulnerable", stacks: 2 }] }] };
    const g = withKit({
      triggers: [two, count("fromNone", { event: "vulnerable", fromNone: true }, "a"), count("interim", { event: "vulnerable" }, "b", "anyone", { if: { not: { enemyVulnerable: 2 } } })],
    });
    expect(stacksOf(run(g, scenario([act("attack1")])))).toMatchObject({ a: 1 });
    expect(stacksOf(run(g, scenario([act("attack1")]))).b ?? 0).toBe(0);
  });
});

describe("T2: a trigger on a buff ending, by game buff, whoever owns it", () => {
  const crystals: KitBuff = { id: "crystals", label: "crystals", target: "enemy", duration: 2, modifiers: [], gameBuff: "buff_common_originum_frozen" };
  const put: KitTrigger = { id: "put", on: { event: "cast", skills: [L + "attack1"] }, by: "self", do: [{ kind: "buff", buff: "crystals" }] };
  const take: KitTrigger = { id: "take", on: { event: "cast", skills: [L + "attack2"] }, by: "self", do: [{ kind: "endBuff", buff: "crystals" }] };
  const listeners = (by: KitTrigger["by"]): KitTrigger[] => [
    count("consumed", { event: "buffEnded", gameBuffs: ["buff_common_originum_frozen"], consumed: true }, "a", by),
    count("expired", { event: "buffEnded", gameBuffs: ["buff_common_originum_frozen"], consumed: false }, "b", by),
    count("ended", { event: "buffEnded", gameBuffs: ["buff_common_originum_frozen"] }, "c", by),
  ];

  it("consumed: an endBuff before it runs out; not its expiry", () => {
    const consumed = stacksOf(run(withKit({ buffs: [crystals], triggers: [put, take, ...listeners("self")] }), scenario([act("attack1"), act("attack2")])));
    expect(consumed).toMatchObject({ a: 1, c: 1 });
    expect(consumed.b ?? 0).toBe(0);
    const expired = stacksOf(run(withKit({ buffs: [crystals], triggers: [put, ...listeners("self")] }), scenario([act("attack1")])));
    expect(expired).toMatchObject({ b: 1, c: 1 });
    expect(expired.a ?? 0).toBe(0);
  });

  it("a cast consuming the buff consumes it", () => {
    const boost: KitBuff = { id: "boost", label: "boost", target: "self", duration: 30, consumedBy: ["battle"], modifiers: [], gameBuff: "buff_common_originum_frozen" };
    const give: KitTrigger = { id: "give", on: { event: "cast", skills: [L + "attack1"] }, by: "self", do: [{ kind: "buff", buff: "boost" }] };
    const n = stacksOf(run(withKit({ buffs: [boost], triggers: [give, ...listeners("self")] }), scenario([act("attack1"), act("normal_skill")])));
    expect(n).toMatchObject({ a: 1, c: 1 });
  });

  it("`by` is the buff's owner: a teammate's trigger hears Laevatain's crystals consumed, her own `teammate` trigger doesn't", () => {
    const mate = JSON.parse(readFileSync(new URL("../examples/endministrator-p5.json", import.meta.url), "utf8")) as Build;
    const mateKit = data.kits.operators[mate.operator] as OperatorKit;
    const g0 = withKit({ buffs: [crystals], triggers: [put, take, ...listeners("teammate")] });
    const g: GameData = {
      ...g0,
      kits: {
        ...g0.kits,
        operators: { ...g0.kits.operators, [mate.operator]: { ...mateKit, stacks: [...mateKit.stacks, { id: "a", label: "a", max: 9 }, { id: "b", label: "b", max: 9 }, { id: "c", label: "c", max: 9 }], triggers: [...mateKit.triggers, ...listeners("teammate")] } },
      },
    };
    const s = run(g, { ...scenario([act("attack1"), act("attack2")]), team: [build, mate] });
    expect(stacksOf(s, mate.operator)).toMatchObject({ a: 1, c: 1 });
    expect(stacksOf(s).a ?? 0).toBe(0);
  });
});

describe("T3: the SP event's source type", () => {
  it("is read per key from SkillData (Alesh's combo: atb 3, its Rare Fin's atb_sp 0)", () => {
    expect(data.skills["chr_0024_deepfin_combo_skill"]?.spSources).toEqual({ atb_sp: 0, atb: 3 });
    expect(data.skills[L + "attack5"]?.spSources).toEqual({ atb: 1 });
    expect(data.skills[L + "normal_skill"]?.spSources).toEqual({ atb: 3 });
  });

  it("sourceTypes filters on it: a basic attack's atb is 1, a skill's 3, a literal grant has none", () => {
    const skillSp: KitTrigger = { id: "skillSp", on: { event: "cast", skills: [L + "attack1"] }, by: "self", skill: L + "normal_skill", do: [{ kind: "sp", value: "atb" }] };
    const plainSp: KitTrigger = { id: "plainSp", on: { event: "cast", skills: [L + "attack2"] }, by: "self", do: [{ kind: "sp", value: 10 }] };
    const g = withKit({ triggers: [skillSp, plainSp, count("basic", { event: "sp", sourceTypes: [1] }, "a"), count("skill", { event: "sp", sourceTypes: [3] }, "b"), count("any", { event: "sp" }, "c")] });
    const n = stacksOf(run(g, scenario(chain)));
    // attack5's own atb (1); the trigger's normal_skill atb (3); the literal 10 counts only without a filter.
    expect(n.a).toBe(1);
    expect(n.b).toBe(1);
    expect(n.c ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("a finisher's SP is of source type 0", () => {
    const finisherSkill: KitSkill = { skillId: L + "power_attack", label: "Finisher", kind: "basic", hits: [{ id: "hit", label: "Finisher", scale: ["atk_scale"], count: 1, frames: [10], events: [], damageType: "basic", element: "fire" }] };
    // attack1 deals 300 stagger: Rhodagn's 280 stagger HP is gone, so the finisher is allowed.
    const skills = [...kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: s.hits.map((h) => ({ ...h, poise: 300 })) } : s)), finisherSkill];
    const g = withKit({ skills, triggers: [count("finisher", { event: "sp", sourceTypes: [0] }, "a")] });
    expect(stacksOf(run(g, scenario([act("attack1"), act("power_attack", 40)]), 80)).a).toBe(1);
  });
});

describe("T4: a weighted random choice", () => {
  const attacked = (n: number) => [{ kind: "attack" as const, at: Array.from({ length: n }, (_, i) => 10 + 2 * i) }];
  const choose = (options: { weight: ValueExpr; stack: string }[]): KitTrigger => ({
    id: "pick", on: { event: "attacked" }, by: "self",
    do: [{ kind: "choose", options: options.map((o) => ({ weight: o.weight, do: [{ kind: "gain", gains: [{ stack: o.stack, amount: 1 }] }] })) }],
  });

  it("picks one option per run with probability weight / Σ weights; weight 0 never; the same seed the same picks", () => {
    const g = withKit({ triggers: [choose([{ weight: 1, stack: "a" }, { weight: 3, stack: "b" }, { weight: 0, stack: "c" }])] });
    const sc = { ...scenario([]), enemyActions: attacked(400), options: { crit: "never" as const, seed: 7 } };
    const n = stacksOf(run(g, sc, 900));
    expect((n.a ?? 0) + (n.b ?? 0)).toBe(400);
    expect(n.c ?? 0).toBe(0);
    // 300 expected; sd √(400 · 0.75 · 0.25) ≈ 8.7.
    expect(Math.abs((n.b ?? 0) - 300)).toBeLessThan(40);
    expect(stacksOf(run(g, sc, 900))).toEqual(n);
    expect(stacksOf(run(g, { ...sc, options: { crit: "never", seed: 8 } }, 900))).not.toEqual(n);
  });

  it("weights are judged when it runs: one that excludes the last pick never repeats it (Purrchena's giftbox)", () => {
    // Each option counts itself and remembers itself in stack d (1: a was last, 0: b was).
    const last = (mine: string) => [{ kind: "gain" as const, gains: [{ stack: mine, amount: 1 }, { stack: "d", amount: mine === "a" ? 1 : -1 }] }];
    const t: KitTrigger = {
      id: "giftbox", on: { event: "attacked" }, by: "self",
      do: [{ kind: "choose", options: [
        { weight: { if: { stack: "d", atLeast: 1 }, then: 0, else: 1 }, do: last("a") },
        { weight: { if: { stack: "d", atLeast: 1 }, then: 1, else: 0 }, do: last("b") },
      ] }],
    };
    const n = stacksOf(run(withKit({ triggers: [t] }), { ...scenario([]), enemyActions: attacked(41) }, 200));
    // Strict alternation from a: 21 a, 20 b.
    expect(n).toMatchObject({ a: 21, b: 20 });
  });

  it("an option's hits land as the trigger's, through nested choices; all weights 0 run nothing", () => {
    const h = (kit.skills.find((s) => s.skillId === L + "attack1") as KitSkill).hits[0] as KitHit;
    const hit: KitHit = { ...h, id: "gift", damageType: "none", frames: [3] };
    const t: KitTrigger = {
      id: "nested", on: { event: "cast", skills: [L + "attack1"] }, by: "self", skill: L + "attack1",
      do: [
        { kind: "choose", options: [{ weight: 0, do: [{ kind: "gain", gains: [{ stack: "a", amount: 1 }] }] }, { weight: 0, do: [{ kind: "gain", gains: [{ stack: "a", amount: 1 }] }] }] },
        { kind: "choose", options: [
          { weight: 0, do: [{ kind: "gain", gains: [{ stack: "b", amount: 1 }] }] },
          { weight: 2, do: [{ kind: "gain", gains: [{ stack: "c", amount: 1 }] }, { kind: "choose", options: [{ weight: 1, do: [{ kind: "hits", hits: [hit] }] }, { weight: 0, do: [] }] }] },
        ] },
      ],
    };
    const s = run(withKit({ triggers: [t] }), scenario([act("attack1")]), 60);
    expect(stacksOf(s)).toMatchObject({ c: 1 });
    expect(stacksOf(s).a ?? 0).toBe(0);
    expect(stacksOf(s).b ?? 0).toBe(0);
    const gift = s.hits.filter((x) => x.hitId === "gift");
    expect(gift.map((x) => x.frame)).toEqual([3]);
  });
});

describe("V2: an own buff's layers as a value and a condition", () => {
  const lance: KitBuff = { id: "lance", label: "lance", target: "self", duration: 30, maxStacks: 3, modifiers: [] };
  const mark: KitBuff = { id: "mark", label: "mark", target: "self", duration: 30, modifiers: [] };
  const add: KitTrigger = { id: "add", on: { event: "cast", kinds: ["basic"] }, by: "self", do: [{ kind: "buff", buff: "lance" }] };

  it("counts active layers (a plain buff 1 or 0), as a value and in `buffLayers` conditions", () => {
    const read: KitTrigger = {
      id: "read", on: { event: "cast", skills: [L + "attack5"] }, by: "self",
      do: [
        { kind: "gain", gains: [{ stack: "a", amount: { buffLayers: "lance" } }, { stack: "b", amount: { buffLayers: "mark" } }] },
        { kind: "gain", gains: [{ stack: "c", amount: 1 }], if: { buffLayers: "lance", atLeast: 3 } },
        { kind: "gain", gains: [{ stack: "d", amount: 1 }], if: { buffLayers: "lance", below: 3 } },
      ],
    };
    // Five basic casts, a layer each (at most 3); on attack5's cast `add` runs before `read` (kit order).
    const n = stacksOf(run(withKit({ buffs: [lance, mark], triggers: [add, read] }), scenario(chain)));
    expect(n).toMatchObject({ a: 3, c: 1 });
    expect(n.b ?? 0).toBe(0);
    expect(n.d ?? 0).toBe(0);
  });
});

describe("V3: a hit count that's a value", () => {
  const h = (kit.skills.find((s) => s.skillId === L + "attack1") as KitSkill).hits[0] as KitHit;
  const stackKit = (hits: KitHit[]): GameData => {
    const skills = kit.skills.map((s) => (s.skillId === L + "attack1" ? { ...s, hits: [...s.hits, ...hits] } : s));
    const g = withKit({ skills });
    const k = g.kits.operators[op] as OperatorKit;
    return { ...g, kits: { ...g.kits, operators: { ...g.kits.operators, [op]: { ...k, stacks: [...k.stacks, { id: "lances", label: "lances", max: 15 }] } } } };
  };

  it("is judged at the cast, before `requires` uses the stack up; landings past `frames` come `framesEvery` apart, each its own hit", () => {
    const lances: KitHit = { ...h, id: "lances", count: { stackCount: "lances" }, frames: [10], framesEvery: 4, requires: { stack: "lances", atLeast: 1, consume: true } };
    const g = stackKit([lances]);
    const k = g.kits.operators[op] as OperatorKit;
    const g2: GameData = { ...g, kits: { ...g.kits, operators: { ...g.kits.operators, [op]: { ...k, triggers: [...k.triggers, count("hits", { event: "hit", skills: [L + "attack1"] }, "a", "self")] } } } };
    const s = run(g2, { ...scenario([act("attack1")]), startStacks: { [op]: { lances: 3 } } }, 60);
    expect(s.hits.filter((x) => x.hitId === "lances").map((x) => x.frame)).toEqual([10, 14, 18]);
    expect(stacksOf(s).lances).toBe(0);
    // attack1's own hit and three lances.
    expect(stacksOf(s).a).toBe(4);
  });

  it("0 lands nothing; a triggered hit's count is judged when its action runs", () => {
    const none: KitHit = { ...h, id: "none", count: { stackCount: "lances" }, frames: [10] };
    const s = run(stackKit([none]), scenario([act("attack1")]), 60);
    expect(s.hits.some((x) => x.hitId === "none")).toBe(false);
    const fire: KitTrigger = { id: "fire", on: { event: "cast", skills: [L + "attack1"] }, by: "self", skill: L + "attack1", do: [{ kind: "hits", hits: [{ ...h, id: "shot", damageType: "none", count: { stackCount: "lances" }, frames: [2, 5] }] }] };
    const g = stackKit([]);
    const k = g.kits.operators[op] as OperatorKit;
    const g2: GameData = { ...g, kits: { ...g.kits, operators: { ...g.kits.operators, [op]: { ...k, triggers: [...k.triggers, fire] } } } };
    const shots = run(g2, { ...scenario([act("attack1")]), startStacks: { [op]: { lances: 3 } } }, 60).hits.filter((x) => x.hitId === "shot");
    // Two frames given, the third landing repeats the last.
    expect(shots.map((x) => x.frame)).toEqual([2, 5, 5]);
  });

  it("landingFrames: the listed frames, then the last one plus framesEvery per landing", () => {
    expect(landingFrames({ id: "x", frames: [10], framesEvery: 5 }, 3)).toEqual([10, 15, 20]);
    expect(landingFrames({ id: "x", frames: [1, 4] }, 4)).toEqual([1, 4, 4, 4]);
    expect(landingFrames({ id: "x", framesEvery: 6 }, 3)).toEqual([0, 6, 12]);
    expect(landingFrames({ id: "x", frames: [1, 4] }, 0)).toEqual([]);
    expect(() => landingFrames({ id: "x" }, 1.5)).toThrow(/whole number/);
  });
});

describe("kit schema: the batch-3 fields", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(JSON.parse(readFileSync(new URL("../schemas/kit.schema.json", import.meta.url), "utf8")) as object);
  const validate = ajv.getSchema("https://github.com/jojkaart/Endfield-battle-simulator/schemas/kit.schema.json");
  const kitWith = (hit: object, triggers: object[]) => ({ operator: "x", sources: ["test"], skills: [{ skillId: "s", label: "s", damageType: "basic", hits: [{ id: "h", scale: [], ...hit }] }], triggers });

  it("accepts the new filters, the choose action, buffLayers and value counts; rejects a fractional literal count", () => {
    const triggers = [
      { id: "t1", on: { event: "vulnerable", fromNone: true, rising: true }, by: "self", do: [{ kind: "openCombo" }] },
      { id: "t2", on: { event: "buffEnded", gameBuffs: ["buff_common_originum_frozen"], consumed: true }, by: "anyone", do: [{ kind: "openCombo" }] },
      { id: "t3", on: { event: "sp", sourceTypes: [3] }, by: "self", if: { buffLayers: "b", atLeast: 1 }, do: [{ kind: "choose", options: [{ weight: { buffLayers: "b" }, do: [{ kind: "openCombo" }] }, { weight: 1, do: [{ kind: "choose", options: [{ weight: 1, do: [] }, { weight: 0, do: [] }] }] }] }] },
    ];
    expect(validate?.(kitWith({ count: { buffLayers: "b" }, frames: [3], framesEvery: 2 }, triggers)), JSON.stringify(validate?.errors)).toBe(true);
    expect(validate?.(kitWith({ count: 2, frames: [3, 4] }, []))).toBe(true);
    expect(validate?.(kitWith({ count: 1.5 }, []))).toBe(false);
    expect(validate?.(kitWith({}, [{ id: "t", on: { event: "attacked" }, by: "self", do: [{ kind: "choose", options: [{ weight: 1, do: [] }] }] }]))).toBe(false);
  });
});
