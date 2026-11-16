// What the engine records for analyses without changing any number: a landing's cast (LandedHit.cast), a buff's maker
// (ActiveBuff.createdBy), a landing's inputs on request (TimelineScenario.keepInputs) and recomputeHit on them; and
// that the search's state key ignores these records.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { advance, apply, createContext, init, recomputeHit, simulate, stateKey, type TimelineState } from "@efsim/engine";
import { readScenario } from "../packages/cli/src/simulate.ts";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();
const scenario = readScenario(`${ROOT}/examples/perlica-estella.scenario.json`);

describe("engine records", () => {
  it("keepInputs keeps every damaging landing's inputs and changes no number", () => {
    const plain = simulate(data, scenario);
    const kept = simulate(data, { ...scenario, keepInputs: true });
    expect(kept.total).toBe(plain.total);
    expect(kept.hits.map((h) => h.exact)).toEqual(plain.hits.map((h) => h.exact));
    expect(plain.hits.every((h) => h.inputs === undefined)).toBe(true);
    expect(kept.hits.filter((h) => !h.fixed).every((h) => h.inputs !== undefined)).toBe(true);
  });

  it("recomputeHit gives the same damage with the same modifiers, and another without one", () => {
    const kept = simulate(data, { ...scenario, keepInputs: true });
    const target = scenario.target;
    for (const h of kept.hits.filter((x) => x.inputs)) expect(recomputeHit(data, target, h, (m) => m).exact).toBeCloseTo(h.exact, 9);
    const buffed = kept.hits.find((h) => h.modifiers.some((m) => m.kitBuff && m.zone === "damageBonus"));
    expect(buffed).toBeDefined();
    const without = recomputeHit(data, target, buffed as (typeof kept.hits)[number], (mods) => mods.filter((m) => !(m.kitBuff && m.zone === "damageBonus")));
    expect(without.exact).toBeLessThan((buffed as (typeof kept.hits)[number]).exact);
    expect(() => recomputeHit(data, target, simulate(data, scenario).hits[0] as (typeof kept.hits)[number], (m) => m)).toThrow(/keepInputs/);
  });

  it("each cast's landings name it, and buffs name the skill that made them", () => {
    const r = simulate(data, scenario);
    const withCast = r.hits.filter((h) => h.cast !== undefined);
    expect(withCast.length).toBeGreaterThan(0);
    for (const h of withCast) expect(r.casts[h.cast as number]?.operator).toBe(h.operator);
    const ctx = createContext(data, scenario);
    let st: TimelineState = init(ctx);
    const seen = new Set<string>();
    for (const a of scenario.rotation) {
      st = apply(ctx, st, a);
      for (const b of advance(ctx, st, st.frame + 30).buffs) if (b.createdBy) seen.add(b.createdBy.skill);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it("the search's state key leaves out who applied an infliction and who made a buff", () => {
    const ctx = createContext(data, scenario);
    const applied = scenario.rotation.reduce((s, a) => apply(ctx, s, a), init(ctx));
    const st = advance(ctx, applied, applied.frame + 30);
    const stripped: TimelineState = {
      ...st,
      enemy: st.enemy.infliction ? { ...st.enemy, infliction: { element: st.enemy.infliction.element, stacks: st.enemy.infliction.stacks, expiresAt: st.enemy.infliction.expiresAt } } : st.enemy,
      buffs: st.buffs.map(({ createdBy: _, ...b }) => b),
    };
    expect(stateKey(ctx, stripped)).toBe(stateKey(ctx, st));
  });
});
