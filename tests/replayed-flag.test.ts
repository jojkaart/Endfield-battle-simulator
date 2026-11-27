// A replayed fight's one flag (TimelineContext.replayed; round 20, round 19's own report point 3): the record-only
// fields (LandedHit.facts, inputs) read it, not TimelineScenario.loggedCrits as a stand-in, so a replay without logged
// crits keeps them, and a simulation has none of them.
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const example = readScenario(new URL("../examples/snowshine-counter.scenario.json", import.meta.url).pathname);

const run = (sc: TimelineScenario): TimelineState => {
  const ctx = createContext(data, sc);
  let st = init(ctx);
  for (const a of sc.rotation) st = apply(ctx, st, a);
  return advance(ctx, st, sc.durationFrames);
};

describe("TimelineContext.replayed", () => {
  it("is set by loggedCrits or `replayed`, never for a simulation", () => {
    expect(createContext(data, example).replayed).toBeUndefined();
    expect(createContext(data, { ...example, replayed: true }).replayed).toBe(true);
    expect(createContext(data, { ...example, loggedCrits: [] }).replayed).toBe(true);
    expect(createContext(data, { ...example, replayed: true }).keepInputs).toBe(true);
  });

  it("gives a replay's landings their records without logged crits, and a simulation's none", () => {
    const plain = run(example);
    const replayed = run({ ...example, replayed: true });
    expect(plain.hits.length).toBeGreaterThan(0);
    expect(plain.hits.some((h) => h.facts !== undefined || h.inputs !== undefined)).toBe(false);
    expect(replayed.hits.some((h) => h.facts !== undefined)).toBe(true);
    expect(replayed.hits.every((h) => h.inputs !== undefined)).toBe(true);
    // The damage is the same: the flag only records.
    expect(replayed.hits.map((h) => h.damage)).toEqual(plain.hits.map((h) => h.damage));
  });
});
