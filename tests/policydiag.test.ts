// Gear on rules (docs/design.md "Rule-based rotations": common random numbers, diagnosis, marginal values, gear on
// rules): delays common per rule onset whatever the other rules, the diagnosis' energy accounting, held ultimates by
// why, marginal values' signs, the sustained-DPS distribution, and efsim gear --rules on a small case.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { activeGearSets, diagnoseRules, playRules, policyDelay, policyDistribution, resolveRuleList, ruleDelayKeys, type Build, type RuleList, type TimelineScenario } from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { readRuleList } from "../packages/cli/src/rules.ts";
import { gearProbes, paired, probePiece, wearing } from "../packages/cli/src/diagnose.ts";
import { gearOnRules, swapProposals } from "../packages/cli/src/gearrules.ts";
import { runRulesJob } from "../packages/cli/src/rulespool.ts";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = readScenario(join(ROOT, "examples/estella-si-akekuri-arcane.scenario.json"));
const team = owner.team.map((b) => b.operator);
const ESTELLA = "chr_0021_whiten";
const AKEKURI = "chr_0019_karin";
const fight = (seconds: number, over: Partial<TimelineScenario> = {}): TimelineScenario => ({ ...owner, durationFrames: seconds * 30, rotation: [], ...over });
const ownerList = resolveRuleList(data, team, readRuleList(join(ROOT, "examples/estella-si-akekuri-arcane.rules.json")));

describe("common random numbers for the reaction delays", () => {
  it("a delay depends only on (seed, rule, onset): a rule keeps its key whatever rules are around it", () => {
    expect(policyDelay(3, 12345, 7)).toBe(policyDelay(3, 12345, 7));
    expect(policyDelay(3, 12345, 7)).not.toBe(policyDelay(3, 12345, 8));
    expect(policyDelay(3, 12345, 7)).not.toBe(policyDelay(4, 12345, 7));
    const extra = { when: { staggered: true }, do: { operator: "Si", cast: "battle" as const } };
    const keys = ruleDelayKeys(ownerList);
    const withExtra = ruleDelayKeys({ ...ownerList, rules: [extra, ...ownerList.rules] });
    expect(withExtra.slice(1)).toEqual(keys);
    // Identical rules get distinct keys (their place among the identical ones).
    const twice = ruleDelayKeys({ opener: [], rules: [extra, extra] });
    expect(twice[0]).not.toBe(twice[1]);
  });

  it("a rule that draws delays but never fires changes nothing for the others (the old shared stream would)", () => {
    // Its cue (not Staggered) comes and goes, drawing a delay at each onset; its press (a finisher) can't start then.
    const never: RuleList["rules"][number] = { when: { not: { staggered: true } }, do: { operator: ESTELLA, cast: "finisher" } };
    const sc = fight(60);
    const a = playRules(data, sc, ownerList, { seed: 4 });
    const b = playRules(data, sc, { ...ownerList, rules: [never, ...ownerList.rules] }, { seed: 4 });
    expect(b.fired[0]).toBe(0);
    expect(b.rotation).toEqual(a.rotation);
    expect(b.sustainedDps).toBe(a.sustainedDps);
  });
});

describe("the diagnosis of a rules run", () => {
  const sc = fight(40);
  const { run, diagnosis } = diagnoseRules(data, sc, ownerList, { seed: 2 });

  it("watches without changing the run", () => {
    expect(run.sustainedDps).toBe(playRules(data, sc, ownerList, { seed: 2 }).sustainedDps);
  });

  it("balances each operator's energy: start + gained = spent + wasted + held at the end", () => {
    for (const o of diagnosis.operators) {
      const e = o.energy;
      expect(e.start + e.gained).toBeCloseTo(e.spent + e.wasted + e.end, 6);
      expect(Object.values(e.bySource).reduce((a, b) => a + b, 0)).toBeCloseTo(e.gained, 6);
      expect(e.gained).toBeGreaterThan(0);
    }
    expect(diagnosis.operators.reduce((a, o) => a + o.share, 0)).toBeCloseTo(1, 9);
    expect(diagnosis.operators.find((o) => o.operator === diagnosis.main)?.share).toBe(Math.max(...diagnosis.operators.map((o) => o.share)));
  });

  it("splits time with an ultimate ready but not cast by why; a list without its rule holds it all fight", () => {
    for (const o of diagnosis.operators) {
      const u = o.ultimate;
      if (!u) continue;
      expect(u.held.reaction + u.held.priority + u.held.condition + u.held.noRule).toBeCloseTo(u.heldSeconds, 9);
      expect(u.held.noRule).toBe(0);
    }
    // Without Akekuri's ultimate rule her ultimate (full at the start) is never cast: ready the whole fight, for lack of a rule.
    const without = { ...ownerList, rules: ownerList.rules.filter((r) => !(Array.isArray(r.do) ? r.do : [r.do]).some((s) => s.operator === AKEKURI && s.cast === "ultimate")) };
    const d = diagnoseRules(data, sc, without, { seed: 2 }).diagnosis.operators.find((o) => o.operator === AKEKURI);
    expect(d?.ultimate?.casts).toBe(0);
    expect(d?.ultimate?.held.noRule).toBeCloseTo(40, 0);
  });

  it("combines runs' crit spread and the delays' spread by the law of total variance", () => {
    const dist = policyDistribution([
      { min: 0, mean: 100, max: 200, var: 16, m3: 0 },
      { min: 0, mean: 110, max: 200, var: 36, m3: 0 },
    ]);
    expect(dist.mean).toBe(105);
    expect(dist.sdDelays).toBeCloseTo(5, 9);
    expect(dist.sdCrits).toBeCloseTo(Math.sqrt(26), 9);
    expect(dist.sd).toBeCloseTo(Math.sqrt(25 + 26), 9);
    expect(dist.p5).toBeLessThan(dist.mean);
    expect(dist.p95).toBeGreaterThan(dist.mean);
    expect(run.sustainedMoments.mean).toBeCloseTo(run.sustainedDps, 6);
    expect(run.sustainedMoments.var).toBeGreaterThan(0);
  });
});

describe("marginal values", () => {
  const probes = gearProbes(data);
  const piece = (attr: string) => {
    const p = probes.find((x) => x.label.startsWith(attr));
    if (!p) throw new Error(`no probe ${attr}`);
    return p;
  };
  const sc = fight(30);
  const play = (s: Omit<TimelineScenario, "rotation">, extra: Record<string, ReturnType<typeof probePiece>> = {}) =>
    [1, 2].map((seed) => runRulesJob(data, { scenario: { ...s, options: { ...s.options, seed } }, list: ownerList, options: { seed }, probes: extra }).sustainedDps);
  const base = play(sc);

  it("offers the gear tables' lines at their sizes, plus reference steps", () => {
    const ue = piece("Ultimate Gain Efficiency");
    expect(ue.value).toBeGreaterThan(0.13);
    expect(ue.value).toBeLessThan(0.34);
    expect(probes.some((p) => p.reference && p.label.startsWith("ATK +10%"))).toBe(true);
    expect(probes.some((p) => p.label.startsWith("Heal"))).toBe(false);
  });

  it("more of a damage stat on the main damage dealers raises team DPS; a stat nothing reads changes nothing", () => {
    for (const label of ["main attribute +", "Crit Rate"]) {
      const p = piece(label);
      const id = `probe:${p.key}`;
      const m = paired(base, play(wearing(sc, ESTELLA, [id]), { [id]: probePiece(p) }));
      expect(m.gain).toBeGreaterThan(0);
    }
    // Heal output isn't a probe; a line for an attribute none of Estella's damage reads (Agility) is worth nothing.
    const agi = probes.find((p) => p.label.startsWith("Agility"));
    if (agi) {
      const id = `probe:${agi.key}`;
      expect(paired(base, play(wearing(sc, ESTELLA, [id]), { [id]: probePiece(agi) })).gain).toBe(0);
    }
  });
});

describe("efsim gear --rules", () => {
  it("proposes swaps that keep the active sets", () => {
    const est = owner.team.find((b) => b.operator === ESTELLA) as Build;
    const mv = new Map(gearProbes(data).map((p) => [p.key, { operator: ESTELLA, probe: p, gain: p.label.startsWith("main attribute") ? 0.01 : 0, se: 0, seeds: 1 }]));
    const props = swapProposals(data, est, mv, 5);
    expect(props.length).toBeGreaterThan(0);
    const sets = activeGearSets(data, est).map((s) => s.set.id);
    for (const p of props) {
      expect(p.predicted).toBeGreaterThan(0);
      const after = activeGearSets(data, { ...est, gear: p.gear.map((id) => ({ id, artifice: [3, 3, 3] as const })) }).map((s) => s.set.id);
      for (const s of sets) expect(after).toContain(s);
    }
  });

  it("scores loadouts by playing the list on common seeds and takes a change only beyond the noise", async () => {
    const keep = new Set(team.filter((op) => op !== ESTELLA));
    const logs = ["item_equip_t4_suit_atk02_body_01", "item_equip_t4_suit_atk02_edc_01", "item_equip_t4_suit_atk02_hand_02", "item_equip_t4_suit_heal01_edc_03"];
    const candidates = new Map([[ESTELLA, [{ operator: ESTELLA, gear: logs, sources: [{ kind: "file" as const, label: "test" }] }]]]);
    const r = await gearOnRules(data, fight(20), ownerList, candidates, { keep, seeds: 2, marginalSeeds: 1, operators: [ESTELLA], seconds: 20, workers: 1, passes: 1, generated: 2, sets: 0, noAfter: true });
    const rows = r.tables.get(ESTELLA) ?? [];
    expect(rows.some((x) => x.sources.includes("test"))).toBe(true);
    expect(rows.some((x) => x.sources.some((s) => s.startsWith("swap:")))).toBe(true);
    expect(rows.find((x) => x.sources.includes("current"))?.gain).toBe(0);
    for (const c of r.changes) expect(c.gain).toBeGreaterThan(2 * c.se);
    expect(r.final.length).toBe(2);
    expect([...r.tables.keys()]).toEqual([ESTELLA]);
  });
});
