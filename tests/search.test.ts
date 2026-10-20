// Rotation search: found rotations are legal (they replay through simulate) and beat a hand-written one;
// with random outcomes, candidates are ranked over several seeded battles and the result is a distribution.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FPS,
  apply,
  candidateActions,
  createContext,
  init,
  legalActions,
  memoAdvance,
  randomOutcomes,
  resourceValues,
  rotationSpread,
  searchRotation,
  simulate,
  simulateRuns,
  type Build,
  type Candidate,
  type TimelineContext,
  type TimelineScenario,
  type TimelineState,
} from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { formatSimulation, readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = readScenario(new URL("../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const { rotation: handWritten, ...open } = example;
const fx = JSON.parse(readFileSync(new URL("../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
const duo = {
  team: fx.team.filter((b) => b.operator === "chr_0016_laevat" || b.operator === "chr_0013_aglina"),
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 20 * FPS,
  options: { crit: "expected" as const },
};

/** The choices at a state as the search judged them before its shortcut: every candidate in full, then the soonest and the controlled basics. */
function judgedInFull(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const all = candidateActions(ctx, state);
  if (all.length === 0) return [];
  const soonest = Math.min(...all.map((c) => c.frame));
  // The candidates' basic attacks are the controlled operator's next ones.
  const basic = (c: Candidate) => data.kits.operators[c.action.operator]?.skills.find((s) => s.skillId === c.action.skill)?.kind === "basic";
  return all.filter((c) => c.frame === soonest || (c.action.operator === state.controlled && basic(c)));
}

describe("rotation search", () => {
  const found = searchRotation(data, open, { beamWidth: 8 });

  it("finds a rotation that replays to the same result with simulate", () => {
    const replay = simulate(data, { ...open, rotation: found.rotation } as TimelineScenario);
    expect(replay.total).toBe(found.result.total);
    expect(found.rotation.every((a) => a.at !== undefined && a.at <= open.durationFrames)).toBe(true);
  });

  it("is deterministic", () => {
    expect(searchRotation(data, open, { beamWidth: 8 }).result.total).toBe(found.result.total);
  });

  it("beats the hand-written example rotation over the same fight", () => {
    const hand = simulate(data, { ...open, rotation: handWritten });
    expect(found.result.total).toBeGreaterThan(hand.total);
  });

  it("without random outcomes: one battle, no distribution, and the totals the search found before seeds and its speed-ups", () => {
    expect(found.random).toEqual([]);
    expect(found.seeds).toEqual([1]);
    expect(found.spread).toBeUndefined();
    // Pinned 2026-10-20 from the search before seeded battles, memoAdvance and startsNow (a kit change may move them);
    // re-pinned after batch 3's S1 / D1 (MarkCanInterrupt, IfElse jumps), which free Laevatain sooner: 1,079,511.708 → 1,176,753.682, 530 → 529 states.
    expect(found.result.total).toBeCloseTo(1176753.6824, 3);
    expect(found.expanded).toBe(529);
  });

  it("values SP and ultimate energy by what the team's own skills deal per point", () => {
    const v = resourceValues(data, open);
    expect(v.perSp).toBeGreaterThan(0);
    // Laevatain's ultimate deals next to nothing itself (its worth is the enhanced skills it unlocks), so a lone cast prices her energy at about 0.
    expect(v.perEnergy[open.team[0]?.operator ?? ""] ?? 0).toBeGreaterThanOrEqual(0);
    // A search that counts them still finds a legal rotation, ranked by damage.
    const weighted = searchRotation(data, open, { beamWidth: 8, resourceWeight: 0.5 });
    expect(simulate(data, { ...open, rotation: weighted.rotation } as TimelineScenario).total).toBe(weighted.result.total);
  });

  it("works for a team: casts of both operators interleave, all legal", () => {
    const r = searchRotation(data, duo, { beamWidth: 6 });
    expect(new Set(r.rotation.map((a) => a.operator)).size).toBe(2);
    expect(simulate(data, { ...duo, rotation: r.rotation }).total).toBe(r.result.total);
    // Pinned as above.
    expect(r.result.total).toBeCloseTo(DUO_TOTAL, 3);
  });

  it("judges the choices at a state as judging every candidate in full would (startsNow and memoAdvance are exact)", () => {
    for (const scenario of [open, duo]) {
      const r = scenario === open ? found : searchRotation(data, scenario, { beamWidth: 4 });
      const ctx = createContext(data, { ...scenario, rotation: [] });
      let state = init(ctx);
      let compared = 0;
      for (const step of r.rotation) {
        const fast = memoAdvance(() => legalActions(ctx, state));
        const full = judgedInFull(ctx, state);
        expect(fast).toEqual(full);
        // Every choice's child too (states the search judged but didn't keep).
        for (const c of fast.slice(0, 3)) {
          const child = apply(ctx, state, { ...c.action, at: c.frame });
          expect(memoAdvance(() => legalActions(ctx, child))).toEqual(judgedInFull(ctx, child));
          compared++;
        }
        state = apply(ctx, state, step);
      }
      expect(compared).toBeGreaterThan(20);
    }
    // Memoised or not, a battle comes out the same.
    expect(memoAdvance(() => simulate(data, example)).total).toBe(simulate(data, example).total);
  });
});

describe("rotation search with random outcomes", () => {
  const short = { ...open, durationFrames: 12 * FPS };
  const rolled = { ...short, options: { ...short.options, crit: "rolled" as const } };

  it("knows a scenario's random outcomes: rolled crits, a dodge chance with attacks to dodge, kit trigger chances", () => {
    expect(randomOutcomes(data, short)).toEqual([]);
    expect(randomOutcomes(data, rolled)).toEqual(["rolled crits"]);
    const attacks = { ...short, enemyActions: [{ kind: "attack" as const, every: 3 * FPS }] };
    expect(randomOutcomes(data, { ...attacks, options: { ...short.options, dodge: { chance: 0.5 } } })).toEqual(["dodge chance 0.5"]);
    // A sure dodge, or none to make, isn't random.
    expect(randomOutcomes(data, { ...attacks, options: { ...short.options, dodge: { chance: 1 } } })).toEqual([]);
    expect(randomOutcomes(data, { ...short, options: { ...short.options, dodge: { chance: 0.5 } } })).toEqual([]);
    const antal = readScenario(new URL("../examples/antal-focus.scenario.json", import.meta.url).pathname);
    expect(randomOutcomes(data, antal).join()).toMatch(/trigger chance/);
    // simulate says the battle is one of a distribution.
    expect(formatSimulation(data, { ...example, options: { ...example.options, crit: "rolled" } }, false)).toMatch(/Note: random outcomes \(rolled crits\): this is one battle \(seed 1\)/);
    expect(formatSimulation(data, example, false)).not.toMatch(/Note: random outcomes/);
  });

  it("ranks candidates over several seeded battles and reports the found rotation's distribution", () => {
    const r = searchRotation(data, rolled, { beamWidth: 4, seeds: 3, runs: 12 });
    expect(r.random).toEqual(["rolled crits"]);
    expect(r.seeds).toEqual([1, 2, 3]);
    expect(r.rankedBy).toBe("mean");
    // The rotation replays exactly in every seeded battle; the one reported is the scenario's own seed.
    const battle = (seed: number) => simulate(data, { ...rolled, rotation: r.rotation, options: { ...rolled.options, seed } }).total;
    expect(battle(1)).toBe(r.result.total);
    const spread = r.spread;
    if (!spread) throw new Error("no distribution");
    expect(spread.runs).toBe(12);
    expect(spread.illegal).toBe(0);
    expect(spread.totals[0]).toBe(r.result.total);
    // With rolled crits it's simulateRuns' spread.
    expect(spread.totals).toEqual(simulateRuns(data, { ...rolled, rotation: r.rotation }, 12).totals);
    expect(spread.sd).toBeGreaterThan(0);
    expect(spread.min).toBeLessThanOrEqual(spread.p5);
    expect(spread.p95).toBeLessThanOrEqual(spread.max);
    // One seed: the search on the scenario's own battle only.
    const one = searchRotation(data, rolled, { beamWidth: 4, seeds: 1, runs: 0 });
    expect(one.seeds).toEqual([1]);
    expect(one.spread).toBeUndefined();
    // A low percentile ranks by the battles that went worst.
    const safe = searchRotation(data, rolled, { beamWidth: 4, seeds: 3, percentile: 0, runs: 0 });
    expect(safe.rankedBy).toEqual({ percentile: 0 });
    expect(simulate(data, { ...rolled, rotation: safe.rotation }).total).toBe(safe.result.total);
  });

  it("with dodges, every seeded battle plays the same actions (each at its own earliest frame from the step's `at`)", () => {
    const dodgy = { ...short, options: { ...short.options, dodge: { chance: 0.5 } }, enemyActions: [{ kind: "attack" as const, every: 2 * FPS }] };
    const r = searchRotation(data, dodgy, { beamWidth: 4, seeds: 3, runs: 10 });
    expect(r.seeds).toEqual([1, 2, 3]);
    const dodges = r.seeds.map((seed) => simulate(data, { ...dodgy, rotation: r.rotation, options: { ...dodgy.options, seed } }).casts.filter((c) => c.skill === "dodge").length);
    expect(new Set(dodges).size).toBeGreaterThan(1);
    expect(r.spread?.runs).toBe(10);
    // A battle where the rotation can't be played (its dice went otherwise) is counted, not thrown.
    const spread = rotationSpread(data, { ...dodgy, rotation: r.rotation }, 10);
    expect(spread.totals.length + spread.illegal).toBe(10);
  });
});

/** The two-operator search's total at beam 6, pinned with the beam-8 solo one. */
const DUO_TOTAL = 216663.5299;
