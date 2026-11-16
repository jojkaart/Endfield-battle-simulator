// The rule tooling around the driver (cli rules.ts, assume.ts; docs/design/rules.md "Rule-based rotations"): comparing two
// lists on common and fresh seeds, the kits' assumption switches (in-game test 109's alternative for Si's Haste), and
// the zero-energy companion scenario the guided search and gear on rules judge by default.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { advance, apply, createContext, init, kitAssumptions, type TimelineScenario } from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { readRuleList, rulesCommand } from "../packages/cli/src/rules.ts";
import { alternatives, holds, parseAssume, underAssume, zeroCompanion } from "../packages/cli/src/assume.ts";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = join(ROOT, "examples/estella-si-akekuri-arcane.scenario.json");
const owner = readScenario(OWNER);
const SI = "chr_0036_jsspsi";

describe("assumption switches", () => {
  it("the kits register test 109's question for Si, with the data's reading as the default", () => {
    const a = kitAssumptions(data).find((x) => x.id === "si-haste-every-end");
    expect(a?.operator).toBe(SI);
    expect(a?.test).toBe("109");
    expect(a?.default).toBe("data");
    expect(Object.keys(a?.readings ?? {})).toEqual(["data", "every-end"]);
    expect(alternatives(data, owner).map((x) => `${x.id}=${x.reading}`)).toEqual(["si-haste-every-end=every-end"]);
    expect(alternatives(data, underAssume(owner, { "si-haste-every-end": "every-end" })).map((x) => x.reading)).toEqual(["data"]);
  });
  it("Artful Intent ending with no Inksoul gives the Haste only under the alternative", () => {
    const hasted = (sc: TimelineScenario) => {
      const ctx = createContext(data, { ...sc, durationFrames: 30 * 30, rotation: [] });
      const st = apply(ctx, init(ctx), { operator: SI, skill: "chr_0036_jsspsi_normal_skill" });
      for (let f = st.frame; f <= 30 * 30; f += 15) if (advance(ctx, st, f).buffs.some((b) => b.id === "talent_haste" && b.owner === SI)) return true;
      return false;
    };
    expect(hasted(owner)).toBe(false);
    expect(hasted(underAssume(owner, parseAssume(data, ["si-haste-every-end=every-end"])))).toBe(true);
  });
  it("refuses unknown assumptions and readings", () => {
    expect(() => parseAssume(data, ["nope=x"])).toThrow(/assumptions: si-haste-every-end/);
    expect(() => parseAssume(data, ["si-haste-every-end=maybe"])).toThrow(/no reading maybe/);
    expect(() => createContext(data, { ...owner, options: { ...owner.options, assume: { nope: "x" } } })).toThrow(/no kit has an assumption nope/);
  });
  it("a verdict holds, flips or is unclear under another reading", () => {
    expect(holds({ gain: 0.03, se: 0.005 }, { gain: 0.02, se: 0.005 })).toBe("holds");
    expect(holds({ gain: 0.03, se: 0.005 }, { gain: -0.03, se: 0.005 })).toBe("flips");
    expect(holds({ gain: 0.03, se: 0.005 }, { gain: 0.001, se: 0.005 })).toBe("unclear");
  });
});

describe("efsim rules --compare and --assumptions", () => {
  it("gives the paired gain on the usual and fresh seeds, and whether it holds under each other reading", async () => {
    const l = readRuleList(join(ROOT, "examples/estella-si-akekuri-arcane.rules.json"));
    const other = { ...l, rules: l.rules.slice(0, -1) };
    const text = await rulesCommand(data, owner, l, "owner", { seconds: 20, seeds: 2, fresh: 2, workers: 1, compare: { list: other, file: "other" }, assumptions: true });
    expect(text).toMatch(/Compared with other/);
    expect(text).toMatch(/seeds 1–2: [+-]\d/);
    expect(text).toMatch(/fresh seeds 1001–1002: [+-]\d/);
    expect(text).toMatch(/test 109's alternative \(every-end: .*\): sustained DPS/);
    expect(text).toMatch(/In short: the comparison (holds|flips|is unclear) under test 109/);
    expect(text.split("\n")[0]).toMatch(/code /);
  });
});

describe("the zero-energy companion", () => {
  it("is the -zero scenario beside a team's example, when there is one", () => {
    expect(zeroCompanion(OWNER)).toBe(join(ROOT, "examples/estella-si-akekuri-arcane-zero.scenario.json"));
    expect(zeroCompanion(join(ROOT, "examples/estella-si-akekuri-arcane-zero.scenario.json"))).toBeUndefined();
    expect(zeroCompanion(join(ROOT, "examples/chen-solo.scenario.json"))).toBeUndefined();
  });
});
