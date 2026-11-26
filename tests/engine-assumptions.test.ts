// The engine's own open readings (packages/engine/src/timeline/assumptions.ts), switched like the kits' assumptions
// through TimelineOptions.assume: unique IDs, the defaults are the engine's rules, and each other reading does what it
// says.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, allAssumptions, apply, COMBO_CURVE, COMBO_CURVES, createContext, curveScales, ENGINE_ASSUMPTIONS, engineReading, init, kitAssumptions, TEAMMATE_PAUSE_FRAMES, withCurveReading, type Build, type TimelineScenario } from "@efsim/engine";
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

  it("battle-sub-skills=main-only: Si's Initial and Final Stroke give no Yinglung's Edge layer; her battle skill does", () => {
    const si = read("si-jade-vessel.json");
    const edges = (assume?: Record<string, string>) => {
      const sc: TimelineScenario = {
        team: [si],
        target: { enemy: "eny_0051_rodin", level: 90 },
        durationFrames: 30 * 12,
        rotation: ["normal_skill", "normal_skill_1", "normal_skill_2"].map((s) => ({ operator: si.operator, skill: `${si.operator}_${s}` })),
        options: { crit: "never", ...(assume ? { assume } : {}) },
        controlled: si.operator,
      };
      const ctx = createContext(data, sc);
      const end = advance(ctx, sc.rotation.reduce((st, a) => apply(ctx, st, a), init(ctx)), sc.durationFrames);
      expect(end.casts.map((c) => c.skill.replace(`${si.operator}_`, ""))).toEqual(["normal_skill", "normal_skill_1", "normal_skill_2"]);
      return end.buffs.filter((b) => b.id === "suit_atk02.edge").length;
    };
    expect(edges()).toBe(3);
    expect(edges({ "battle-sub-skills": "main-only" })).toBe(1);
  });

  it("are refused when unknown, and taken by --assume", () => {
    expect(() => createContext(data, scenario({ "no-such-thing": "x" }))).toThrow(/no kit or engine rule has an assumption no-such-thing/);
    expect(() => createContext(data, scenario({ "control-immunity": "sometimes" }))).toThrow(/has no reading sometimes/);
    expect(parseAssume(data, ["control-immunity=bosses"])).toEqual({ "control-immunity": "bosses" });
  });
});

describe("combo-curve: the ComboSkill slow-down's guessed curve as a reading (timeline/curves.ts)", () => {
  const combo = "chr_0032_lizhiyan_combo_skill";
  const slowdown = (d: typeof data) => d.skills[combo]?.timing?.slowdowns.find((x) => x.curve === COMBO_CURVE);
  it("the compiler keeps the curve's name and samples the guess; the default reading is the data itself", () => {
    const s = slowdown(data);
    expect(s).toBeDefined();
    expect(s?.scales).toEqual(curveScales(COMBO_CURVES["guess"] as (t: number) => number, s?.scales.length ?? 0));
    expect(withCurveReading(data, {})).toBe(data);
    expect(withCurveReading(data, { "combo-curve": "guess" })).toBe(data);
  });

  it("another reading resamples every ComboSkill slow-down (memoised, idempotent) and leaves the rest", () => {
    const flat = withCurveReading(data, { "combo-curve": "flat" });
    expect(flat).not.toBe(data);
    expect(withCurveReading(data, { "combo-curve": "flat" })).toBe(flat);
    expect(withCurveReading(flat, { "combo-curve": "flat" })).toBe(flat);
    expect(withCurveReading(flat, {})).toBe(data);
    expect(new Set(slowdown(flat)?.scales)).toEqual(new Set([0.01]));
    expect(slowdown(flat)?.scales.length).toBe(slowdown(data)?.scales.length);
    const ult = "chr_0032_lizhiyan_ultimate_skill";
    expect(flat.skills[ult]).toBe(data.skills[ult]);
  });
});
