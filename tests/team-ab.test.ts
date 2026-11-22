// scripts/team-ab.ts: the identity check's normalisation and the numbers read from an `efsim rules` run.
import { describe, expect, it } from "vitest";
import { movedTeams, normalized, parseRules } from "../scripts/team-ab.ts";
import { SMOKE_FILES } from "../scripts/smoke.ts";

const sample = `Rules examples/x.rules.json: Akekuri, Si; Estella controlled; 60 s fight; reaction 0.3 s ± 50%; code at 70dc452 with uncommitted changes

Sustained DPS after the opener (expected crits, 2 seeds of the reaction delay): 61,837 (sd 720, 61,117–62,558)
Robustness (sustained DPS): delay 0 (a bot) 62,841; 0.3 s 61,837 (-1.60%); 0.6 s 61,208 (-2.60%)
Shares (seed 1001): Si 44.9%, Estella 40.1%
Reference: the scenario's own rotation on the timeline (60 s): 3,473,974 (57,900 DPS over its 60 s); the rules' first 60 s: 3,710,228 (+6.80%)
`;

describe("team-ab", () => {
  it("reads a rules run's numbers", () => {
    expect(parseRules(sample)).toEqual({ sustained: 61837, sd: 720, bot: 62841, slow: 61208, timeline60: 57900, shares: "Si 44.9%, Estella 40.1%" });
    expect(parseRules("nothing").sustained).toBeNull();
  });

  it("compares two checkouts' outputs without their provenance", () => {
    expect(normalized(sample)).toBe(normalized(sample.replace("code at 70dc452 with uncommitted changes", "code at c83c9e5")));
    expect(normalized(sample)).not.toBe(normalized(sample.replace("61,837", "61,838")));
  });

  it("runs the 32 seeds only for the teams whose fight moved", () => {
    expect(movedTeams(["a-b (zero) one rules seed", "a-b (full) simulate"], ["a-b", "c-d"])).toEqual(["a-b"]);
    expect(movedTeams([], ["a-b"])).toEqual([]);
  });

  it("smoke runs files that exist", () => {
    expect(SMOKE_FILES.length).toBeGreaterThan(3);
  });
});
