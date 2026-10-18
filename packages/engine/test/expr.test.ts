// Predicates and value expressions on a synthetic context.
import { describe, expect, it } from "vitest";
import { evaluate, NO_STATUS, predicateRefs, test, valueKeys, type EvalContext, type GameData, type StatPanel } from "../src/index.ts";

const panel = { attrs: { 41: { total: 300 }, 42: { total: 200 } } } as unknown as StatPanel;
const data = { operators: { a: { element: "fire", profession: 2 }, b: { element: "cryst", profession: 4 } }, attributeDefaults: {} } as unknown as GameData;
const values: Record<string, number> = { "s1.k": 2, "s1.cap": 5, "s2.k": 10 };
const base: EvalContext = {
  data,
  build: { operator: "a", level: 90, promotion: 4, potential: 3, skillLevels: { basic: 1, battle: 1, combo: 1, ultimate: 1 }, weapon: { id: "w", level: 1, skillLevels: [1, 1, 1] }, gear: [] },
  panel,
  skillId: "s1",
  skillValue: (s, k) => {
    const v = values[`${s}.${k}`];
    if (v === undefined) throw new Error(`${s}.${k}`);
    return v;
  },
};

describe("predicates", () => {
  it("compare attributes and potentials, and combine", () => {
    expect(test({ attrAtLeast: [41, 42] }, base)).toBe(true);
    expect(test({ not: { attrAtLeast: [41, 42] } }, base)).toBe(false);
    expect(test({ all: [{ potentialAtLeast: 3 }, { potentialAtLeast: 4 }] }, base)).toBe(false);
    expect(test({ any: [{ potentialAtLeast: 3 }, { potentialAtLeast: 4 }] }, base)).toBe(true);
  });

  it("are unknown when the context lacks the information, and known once it has it", () => {
    expect(test({ enemyInfliction: "natural" }, base)).toBeUndefined();
    expect(test({ any: [{ enemyInfliction: "natural" }, { potentialAtLeast: 9 }] }, base)).toBeUndefined();
    expect(test({ all: [{ enemyInfliction: "natural" }, { potentialAtLeast: 9 }] }, base)).toBe(false);
    const enemy = { ...NO_STATUS, infliction: { element: "natural" as const, stacks: 2, expiresAt: 600 } };
    expect(test({ enemyInfliction: "natural", minStacks: 2 }, { ...base, enemy })).toBe(true);
    expect(test({ enemyStatus: "corrosion" }, { ...base, enemy })).toBe(false);
    expect(test({ teamSlotElement: { slot: 1, element: "cryst" } }, { ...base, team: [base.build, { ...base.build, operator: "b" }] })).toBe(true);
    expect(test({ stack: "x", atLeast: 1, below: 4 }, { ...base, stacks: { x: 3 } })).toBe(true);
    expect(test({ consumedAtLeast: 1 }, { ...base, consumed: 0 })).toBe(false);
  });

  it("know who is controlled, what the enemy carries, and the operator's element and profession", () => {
    expect(test({ controlled: true }, base)).toBeUndefined();
    expect(test({ controlled: true }, { ...base, controlled: "a" })).toBe(true);
    expect(test({ controlled: true }, { ...base, controlled: "b" })).toBe(false);
    const enemyModifiers = [{ zone: "susceptibility" as const, value: 0.1, element: "physical" as const, source: "x" }, { zone: "damageTaken" as const, value: 0.1, source: "y" }];
    expect(test({ enemyModifier: { zone: "susceptibility", element: "physical" } }, { ...base, enemyModifiers })).toBe(true);
    expect(test({ enemyModifier: { zone: "susceptibility", element: "fire" } }, { ...base, enemyModifiers })).toBe(false);
    // An all-element modifier reaches every element.
    expect(test({ enemyModifier: { zone: "damageTaken", element: "fire" } }, { ...base, enemyModifiers })).toBe(true);
    expect(test({ operatorElement: ["fire", "pulse"] }, base)).toBe(true);
    expect(test({ operatorProfession: [4] }, base)).toBe(false);
  });

  it("judge a team buff's recipient against its owner, and a trigger's event operator", () => {
    const recipient: EvalContext = { ...base, build: { ...base.build, operator: "b" }, owner: "a" };
    expect(test({ isOwner: true }, recipient)).toBe(false);
    expect(test({ isOwner: true }, base)).toBe(true);
    expect(test({ sameElementAsOwner: true }, recipient)).toBe(false);
    expect(test({ eventOperator: { operatorElement: ["cryst"] } }, base)).toBeUndefined();
    expect(test({ eventOperator: { operatorElement: ["cryst"] } }, { ...base, eventOperator: recipient })).toBe(true);
  });
});

describe("values", () => {
  it("are literals, skill keys, sums, products, min/max, attributes and conditionals", () => {
    expect(evaluate(0.5, base)).toBe(0.5);
    expect(evaluate("k", base)).toBe(2);
    expect(evaluate({ key: "k", skill: "s2" }, base)).toBe(10);
    expect(evaluate({ sum: ["k", { key: "k", skill: "s2" }] }, base)).toBe(12);
    // Liino-style: min(Will × k, cap)
    expect(evaluate({ min: [{ product: [{ attr: 42 }, "k"] }, "cap"] }, base)).toBe(5);
    expect(evaluate({ if: { potentialAtLeast: 2 }, then: "k", else: 0 }, base)).toBe(2);
    expect(evaluate({ product: ["k", { consumed: true }] }, { ...base, consumed: 3 })).toBe(6);
    expect(() => evaluate({ consumed: true }, base)).toThrow();
  });

  it("list the keys and refs they need, for the loader to check", () => {
    expect(valueKeys({ sum: ["k", { key: "k", skill: "s2" }, 1] }, "s1")).toEqual([{ skill: "s1", key: "k" }, { skill: "s2", key: "k" }]);
    expect(predicateRefs({ all: [{ stack: "x" }, { not: { buffActive: "b" } }] })).toEqual({ stacks: ["x"], buffs: ["b"] });
  });
});
