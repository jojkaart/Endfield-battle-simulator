// `efsim gear` (packages/cli/src/gear.ts): gear loadouts from the logs, scored on a team's rotation, by coordinate ascent.
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { simulate, type Build } from "@efsim/engine";
import { describeGear, formatGear, gearAscent, gearCandidates, logLoadouts } from "../packages/cli/src/gear.ts";
import { logFixtureFiles } from "../packages/cli/src/logs.ts";
import { readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const root = new URL("..", import.meta.url).pathname;
const fixture = (f: string) => new URL(`../fixtures/pending/${f}`, import.meta.url).pathname;
const E = "item_equip_t4_suit_";

describe("loadouts from the logs", () => {
  it("counts an operator's four pieces per log, by how many of the given teammates the log has", () => {
    // 9090afbacec9 has the whole team (Typhoeus, Arcane, Liino, Perlica); 4d60e7fe92c2 Perlica with Arcane and Liino.
    const files = [fixture("zmdlogs-9090afbacec9.json"), fixture("zmdlogs-4d60e7fe92c2.json")];
    const seen = logLoadouts(files, "chr_0004_pelica", ["chr_0034_typhoea", "chr_0032_lizhiyan", "chr_0035_liino"]);
    expect(seen).toHaveLength(2);
    const whole = seen[0] as (typeof seen)[number];
    expect(whole.gear).toEqual([`${E}pulse_cryst01_body_01`, `${E}pulse_cryst01_edc_02`, `${E}pulse_cryst01_edc_02`, `${E}usp02_hand_02`]);
    expect(whole.byTeammates).toEqual([0, 0, 0, 1]);
    expect((seen[1] as (typeof seen)[number]).byTeammates).toEqual([0, 0, 1, 0]);
  });

  it("leaves the hold-out logs out (they're only measured)", () => {
    const files = logFixtureFiles(root);
    expect(files.some((f) => f.endsWith("zmdlogs-890bcadb4933.json"))).toBe(false);
    expect(files.some((f) => f.endsWith("zmdlogs-9090afbacec9.json"))).toBe(true);
    expect(() => logFixtureFiles(root, ["fixtures/holdout"])).toThrow(/never listed/);
  });
});

describe("the ascent", () => {
  const scenario = readScenario(new URL("../examples/perlica-estella.scenario.json", import.meta.url).pathname);
  const perlica = scenario.team[0] as Build;
  const pulser = [`${E}pulse_cryst01_body_01`, `${E}pulse_cryst01_hand_01`, `${E}pulse_cryst01_edc_02`, `${E}pulse_cryst01_edc_02`];

  it("merges a loadout given twice into one candidate with both sources", () => {
    const c = gearCandidates(data, scenario, { files: [], extra: { candidates: [
      { operator: perlica.operator, gear: pulser, source: "site A" },
      { operator: perlica.operator, gear: [...pulser].reverse(), source: "site B" },
    ] } });
    const mine = c.get(perlica.operator) ?? [];
    expect(mine).toHaveLength(2); // the scenario's own and the merged one
    expect(mine[1]?.sources.map((s) => s.label)).toEqual(["site A", "site B"]);
    expect(() => gearCandidates(data, scenario, { files: [], extra: { candidates: [{ operator: perlica.operator, gear: pulser.slice(0, 3), source: "x" }] } })).toThrow(/four pieces/);
  });

  it("takes each operator's best candidate on the rotation, keeps operators it's told to, and scores each by the replay", () => {
    const c = gearCandidates(data, scenario, { files: [], extra: { candidates: [{ operator: perlica.operator, gear: pulser, source: "site" }] } });
    const r = gearAscent(data, scenario, c, { keep: new Set(["chr_0021_whiten"]) });
    const rows = r.tables.get(perlica.operator) ?? [];
    expect(rows).toHaveLength(2);
    expect(r.tables.has("chr_0021_whiten")).toBe(false);
    // Each row's total is the scenario replayed with that loadout (full artifice), the scenario's own as it is.
    const own = simulate(data, scenario).total;
    expect(r.start).toBe(own);
    const withPulser = simulate(data, { ...scenario, team: scenario.team.map((b, i) => (i === 0 ? { ...b, gear: pulser.map((id) => ({ id, artifice: [3, 3, 3] as const })) } : b)) }).total;
    expect(rows.map((x) => x.total).sort((a, b) => b - a)).toEqual([own, withPulser].sort((a, b) => b - a));
    expect(r.final).toBe(Math.max(own, withPulser));
    expect(rows.every((x) => x.how === "replay")).toBe(true);
    // The last pass changed nothing: each gain is against the chosen loadout, which has 1.
    const chosenKey = (r.chosen.get(perlica.operator) ?? []).slice().sort().join("+");
    expect(rows.find((x) => [...x.candidate.gear].sort().join("+") === chosenKey)?.gain).toBe(1);
    expect(rows.every((x) => x.gain <= 1)).toBe(true);
    expect(r.rotationReplaced).toBe(false);
    expect(r.chosen.get(perlica.operator)?.slice().sort()).toEqual((withPulser > own ? pulser : perlica.gear.map((g) => g.id)).slice().sort());
    expect(formatGear(data, scenario, r)).toContain("Pulser Labs: Disruptor Suit, Gloves, Calibrator ×2");
  });
});

describe("a repaired replay", () => {
  it("moves later or drops the steps a loadout can't play and scores the rest against the current loadout's replay", () => {
    // The owner's team: with this Akekuri loadout a few steps fail (where the default allows 20): Estella's battle skill
    // at 58.5 s finds too little SP before the fight ends (until 2026-11-16, judged on the state before the step, without
    // what came due on the way to its `at`, her finisher at 42.7 s failed first).
    const scenario = readScenario(new URL("../examples/estella-si-akekuri-arcane.scenario.json", import.meta.url).pathname);
    const akekuri = "chr_0019_karin";
    const yinglung = [`${E}atk02_body_02`, `${E}atk02_hand_01`, `${E}atk02_edc_02`, `${E}atb01_edc_01`];
    const swapped = scenario.team.map((b) => (b.operator === akekuri ? { ...b, gear: yinglung.map((id) => ({ id, artifice: [3, 3, 3] as const })) } : b));
    expect(() => simulate(data, { ...scenario, team: swapped })).toThrow(/can.t start before the fight ends/);
    const c = gearCandidates(data, scenario, { files: [], extra: { candidates: [{ operator: akekuri, gear: yinglung, source: "site" }] } });
    const keep = new Set(scenario.team.map((b) => b.operator).filter((op) => op !== akekuri));
    const r = gearAscent(data, scenario, c, { keep, passes: 1 });
    const row = (r.tables.get(akekuri) ?? []).find((x) => x.candidate.sources.some((s) => s.label === "site"));
    expect(row?.how).toBe("repaired");
    const changed = (row?.moved ?? 0) + (row?.dropped ?? 0);
    expect(changed).toBeGreaterThanOrEqual(1);
    expect(changed).toBeLessThanOrEqual(20);
    expect(r.searched).toBe(0);
    // Against the scenario's own replay; it loses here, so the rotation stays the scenario's.
    expect(row?.gain).toBeCloseTo((row?.total ?? 0) / r.start, 12);
    expect(row?.gain).toBeLessThan(1);
    expect(r.rotationRepaired).toBe(0);
    expect(r.rotation).toBe(scenario.rotation);
    expect(formatGear(data, scenario, r)).toMatch(/\((\d+ steps? later)?(, )?(\d+ dropped)?\)/);
  });
});

describe("describeGear", () => {
  it("groups pieces by set and counts duplicates", () => {
    expect(describeGear(data, [`${E}spellburst_body_01`, `${E}spellburst_hand_01`, `${E}spellburst_edc_01`, `${E}spellburst_edc_01`])).toBe("Deep Rampart: Armor, Gauntlets, Comms ×2");
    expect(describeGear(data, ["item_equip_t4_parts_wuling02_body_02", `${E}heal01_hand_03`, `${E}heal01_edc_04`, `${E}heal01_edc_04`])).toBe("LYNX: Gauntlets T1, Aegis Injector ×2 + Rift Trekker Light Armor");
  });
});
