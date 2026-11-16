// The tests' buff history helper (tests/helpers/buffs.ts): buffs that ran out before the end are seen, though the final
// state no longer holds them.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { advance, apply, createContext, init } from "@efsim/engine";
import { readScenario } from "../packages/cli/src/simulate.ts";
import { scenarioBuffHistory } from "./helpers/buffs.ts";
import { ROOT } from "./logverdicts.ts";

const data = loadGameData();

describe("buff history", () => {
  it("lists buffs that ended before the fight's end, which the final state doesn't hold", () => {
    const scenario = readScenario(`${ROOT}/examples/perlica-estella.scenario.json`);
    const history = scenarioBuffHistory(data, scenario, 3);
    const ctx = createContext(data, scenario);
    const final = advance(ctx, scenario.rotation.reduce((st, a) => apply(ctx, st, a), init(ctx)), scenario.durationFrames).buffs;
    const ended = history.filter((b) => b.expiresAt <= scenario.durationFrames);
    expect(history.length).toBeGreaterThan(0);
    expect(ended.length).toBeGreaterThan(0);
    for (const b of ended) expect(final.some((x) => x.id === b.id && x.owner === b.owner && x.appliedAt === b.appliedAt)).toBe(false);
  });
});
