// The engine's own open readings (packages/engine/src/timeline/assumptions.ts), switched like the kits' assumptions
// through TimelineOptions.assume: unique IDs, the defaults are the engine's rules, and each other reading does what it
// says.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, allAssumptions, createContext, ENGINE_ASSUMPTIONS, engineReading, init, kitAssumptions, TEAMMATE_PAUSE_FRAMES, type Build, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { parseAssume } from "../packages/cli/src/assume.ts";

const data = loadGameData();
const read = (f: string) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8")) as Build;
const laevatain = read("laevatain-forgeborn.json");
const gilberta = read("gilberta-usp02.json");
const G = gilberta.operator;

const scenario = (assume?: Record<string, string>): TimelineScenario => ({
  team: [laevatain, gilberta],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 20,
  rotation: [],
  options: { crit: "never", teammateAttacks: true, ...(assume ? { assume } : {}) },
  controlled: laevatain.operator,
});

/** The first pause between two of the teammate's chains (frames). */
function firstPause(sc: TimelineScenario): number {
  const ctx = createContext(data, sc);
  const casts = advance(ctx, init(ctx), sc.durationFrames).casts.filter((c) => c.operator === G && c.teammate);
  const head = casts.findIndex((c, i) => i > 0 && c.skill === `${G}_attack1`);
  return (casts[head]?.frame ?? 0) - (casts[head - 1]?.frame ?? 0);
}

describe("the engine's assumptions", () => {
  it("have IDs no kit assumption uses, and defaults among their readings", () => {
    const ids = allAssumptions(data).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(kitAssumptions(data).length + ENGINE_ASSUMPTIONS.length).toBe(ids.length);
    for (const a of ENGINE_ASSUMPTIONS) expect(Object.keys(a.readings)).toContain(a.default);
  });

  it("run under their defaults unless a scenario chooses", () => {
    expect(engineReading(scenario(), "teammate-pause")).toBe("6.5s");
    expect(engineReading(scenario({ "teammate-pause": "3.5s" }), "teammate-pause")).toBe("3.5s");
    expect(firstPause(scenario())).toBe(firstPause(scenario({ "teammate-pause": "6.5s" })));
  });

  it("teammate-pause=3.5s pauses the teammate for the old 3.5 s instead of 6.5 s", () => {
    const now = firstPause(scenario());
    const old = firstPause(scenario({ "teammate-pause": "3.5s" }));
    expect(now).toBeGreaterThanOrEqual(TEAMMATE_PAUSE_FRAMES);
    expect(old).toBeGreaterThanOrEqual(105);
    expect(now - old).toBe(TEAMMATE_PAUSE_FRAMES - 105);
  });

  it("are refused when unknown, and taken by --assume", () => {
    expect(() => createContext(data, scenario({ "no-such-thing": "x" }))).toThrow(/no kit or engine rule has an assumption no-such-thing/);
    expect(() => createContext(data, scenario({ "control-immunity": "sometimes" }))).toThrow(/has no reading sometimes/);
    expect(parseAssume(data, ["control-immunity=bosses"])).toEqual({ "control-immunity": "bosses" });
  });
});
