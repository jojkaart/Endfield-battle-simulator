// Rule sets, the cues of 2026-11-22 and the objective across starts (engine policy.ts, policysearch.ts, policyguide.ts;
// docs/design/rules.md "Rule sets", "The objective across starts"): a set's rules are read only while its condition
// holds (the same run as the condition written into each rule), its condition counts once in the learnability, flat
// lists are unchanged; the ultimates-ready count, the ultimate gauge and a status's level read the state; the search's
// set moves, Corrosion setups and the split of an edit by a cue give valid lists; the objective is the starts' mean.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import {
  cueCost,
  describeCue,
  describeRule,
  editSets,
  effectiveRules,
  framesOf,
  learnability,
  pairedGain,
  playRules,
  reactionSetupEdits,
  resolveRuleList,
  rulePool,
  setMoveEdits,
  splitEdit,
  startsObjective,
  type PolicyFrameView,
  type RuleList,
  type TimelineScenario,
} from "@efsim/engine";
import { readScenario } from "@efsim/cli";
import { readRuleList } from "../packages/cli/src/rules.ts";

const data = loadGameData();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = readScenario(join(ROOT, "examples/estella-si-akekuri-arcane.scenario.json"));
const zero = readScenario(join(ROOT, "examples/estella-si-akekuri-arcane-zero.scenario.json"));
const typhoeus = readScenario(join(ROOT, "examples/typhoeus-arcane-liino-perlica.scenario.json"));
const team = owner.team.map((b) => b.operator);
const fight = (sc: TimelineScenario, seconds: number): TimelineScenario => ({ ...sc, durationFrames: framesOf(seconds), rotation: [] });
const list = (raw: RuleList) => resolveRuleList(data, team, raw);
const ownerList = list(readRuleList(join(ROOT, "examples/estella-si-akekuri-arcane.rules.json")));

describe("rule sets", () => {
  const corrosionUp = { statusLevel: { status: "corrosion", atLeast: 4 } } as const;
  const withSet: RuleList = list({
    opener: [{ operator: "Si", cast: "battle" }],
    sets: [{ name: "setup", when: { not: corrosionUp } }],
    rules: [
      { when: { ultimate: "Si" }, do: { operator: "Si", cast: "ultimate" } },
      { when: { infliction: { element: "heat", atLeast: 2 } }, do: { operator: "Arcane", cast: "battle" }, set: "setup" },
      { when: { sp: { atLeast: 100 } }, do: { operator: "Akekuri", cast: "battle" }, set: "setup" },
      { when: { combo: "Arcane" }, do: { operator: "Arcane", cast: "combo" } },
    ],
  });

  it("reads a set's rules only while its condition holds: the same run as the condition written into each rule", () => {
    const inline: RuleList = { ...withSet, sets: undefined, rules: withSet.rules.map(({ set, ...r }) => (set ? { ...r, when: { all: [{ not: corrosionUp }, r.when] } } : r)) } as RuleList;
    const a = playRules(data, fight(owner, 40), withSet, { seed: 3 });
    const b = playRules(data, fight(owner, 40), list(inline), { seed: 3 });
    expect(a.rotation).toEqual(b.rotation);
    expect(a.fired).toEqual(b.fired);
    expect(a.fired[1]).toBeGreaterThan(0);
    expect(effectiveRules(withSet).rules[1]?.when).toEqual({ all: [{ not: corrosionUp }, { infliction: { element: "heat", atLeast: 2 } }] });
  });

  it("counts a set's condition once, however many rules it has; a flat list is unchanged", () => {
    const l = learnability(withSet);
    const flat = learnability({ ...withSet, sets: undefined, rules: withSet.rules.map(({ set: _s, ...r }) => r) });
    expect(l.cueCost).toBe(flat.cueCost + cueCost({ not: corrosionUp }).cost);
    expect(effectiveRules(ownerList)).toBe(ownerList);
    expect(describeRule(data, withSet.rules[1] as never, withSet.sets)).toMatch(/^\[setup: while the enemy hasn't Corrosion at level 4 or more\] When/);
  });

  it("refuses a rule naming a set the list doesn't define, and two sets of one name", () => {
    expect(() => list({ opener: [], rules: [{ when: { combo: "Si" }, do: { operator: "Si", cast: "combo" }, set: "x" }] })).toThrow(/set x/);
    expect(() => list({ opener: [], sets: [{ name: "a", when: { staggered: true } }, { name: "a", when: { staggered: false } }], rules: [] })).toThrow(/name of its own/);
  });

  it("the search's set moves give lists the team can play", () => {
    const pool = rulePool(data, team, owner.controlled as string);
    let rng = 7;
    const r = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
    let l = ownerList;
    for (let i = 0; i < 30; i++) {
      l = list(editSets(r, pool, l));
      const used = new Set(l.rules.flatMap((x) => (x.set ? [x.set] : [])));
      expect((l.sets ?? []).every((s) => used.has(s.name))).toBe(true);
    }
    for (const c of setMoveEdits(data, withSet)) list(c.list);
  });
});

describe("setups and splits in the guided search", () => {
  it("proposes a Corrosion setup set for Arcane with a non-Nature inflicter (Akekuri's Heat, Perlica's Electric)", () => {
    const own = reactionSetupEdits(data, ownerList).filter((c) => c.target?.multiplier === "status:corrosion");
    expect(own.some((c) => /Akekuri's battle skill/.test(c.text) && /Arcane's battle skill/.test(c.text))).toBe(true);
    for (const c of own) {
      const l = list(c.list);
      expect(l.sets?.find((s) => s.name === "corrosion setup")?.when).toEqual({ statusLevel: { status: "corrosion", below: 4 } });
    }
    const tTeam = typhoeus.team.map((b) => b.operator);
    const tList = resolveRuleList(data, tTeam, readRuleList(join(ROOT, "examples/typhoeus-arcane-liino-perlica.rules.json")));
    const t = reactionSetupEdits(data, tList).filter((c) => c.target?.multiplier === "status:corrosion");
    expect(t.some((c) => /Perlica's battle skill/.test(c.text))).toBe(true);
    // The variant holding the list's own Arcane battle skills for the "up" set.
    expect(t.some((c) => c.list.rules.some((r) => r.set === "corrosion up"))).toBe(true);
  });

  it("splits an in-place edit into the edited rule while a cue holds and the old one while it doesn't", () => {
    const edited: RuleList = { ...ownerList, rules: ownerList.rules.map((r, i) => (i === 1 ? { ...r, when: { all: [r.when, { staggered: true }] } } : r)) };
    const cue = { ultimates: { atLeast: 2 } } as const;
    const s = splitEdit(ownerList, edited, cue, "opening") as RuleList;
    expect(s.rules).toHaveLength(ownerList.rules.length + 1);
    expect(s.rules[1]?.set).toBe("opening");
    expect(s.rules[2]).toEqual({ ...ownerList.rules[1], set: "not opening" });
    expect(s.sets).toEqual([{ name: "opening", when: cue }, { name: "not opening", when: { not: cue } }]);
    list(s);
    expect(splitEdit(ownerList, { ...ownerList, rules: ownerList.rules.slice(1) }, cue, "x")).toBeNull();
  });
});

describe("the cues of 2026-11-22", () => {
  const watch = (sc: TimelineScenario, cues: readonly Parameters<PolicyFrameView["cueHolds"]>[0][], at: number) => {
    let seen: boolean[] = [];
    playRules(data, fight(sc, 2), { opener: [], rules: [] }, { observer: { frame: (v) => (v.frame === at ? (seen = cues.map((c) => v.cueHolds(c))) : undefined) } });
    return seen;
  };
  it("counts the ultimates ready and reads the gauge: all four full at a full-energy start, none from zero", () => {
    const cues = [{ ultimates: { atLeast: 4 } }, { ultimates: { below: 1 } }, { energy: { operator: "chr_0036_jsspsi", atLeast: 100 } }, { energy: { operator: "chr_0036_jsspsi", below: 1 } }] as const;
    expect(watch(owner, cues, 0)).toEqual([true, false, true, false]);
    expect(watch(zero, cues, 0)).toEqual([false, true, false, true]);
    expect(describeCue(data, { ultimates: { atLeast: 2 } })).toBe("2 or more ultimates are ready");
    expect(describeCue(data, { energy: { operator: "chr_0036_jsspsi", below: 50 } })).toBe("Si's ultimate gauge is below 50% full");
  });
  it("reads a status's level, 0 while it isn't on, and ranks the new cues", () => {
    expect(watch(owner, [{ statusLevel: { status: "corrosion", below: 1 } }, { statusLevel: { status: "corrosion", atLeast: 1 } }], 0)).toEqual([true, false]);
    expect(cueCost({ statusLevel: { status: "corrosion", atLeast: 4 } }).rank).toBe(3);
    expect(cueCost({ ultimates: { atLeast: 2 } }).rank).toBe(4);
    expect(cueCost({ energy: { operator: "x", atLeast: 50 } }).rank).toBe(5);
    expect(() => list({ opener: [], rules: [{ when: { ultimates: { atLeast: 1.5 } }, do: { operator: "Si", cast: "combo" } }] })).toThrow(/whole number/);
  });
});

describe("the objective across starts", () => {
  it("is the starts' mean per seed, so a paired gain over it weighs each start by its DPS", () => {
    expect(startsObjective([[10, 20, 30], [30, 40]])).toEqual([20, 30]);
    expect(startsObjective([[10], [30]], [3, 1])).toEqual([15]);
    expect(() => startsObjective([])).toThrow();
    // +10% on one start, −10% on the other at the same level: no gain over both.
    const a = [startsObjective([[100, 100], [100, 100]]), startsObjective([[110, 111], [90, 89]])];
    expect(pairedGain(a[0] as number[], a[1] as number[]).gain).toBeCloseTo(0, 10);
  });
});
