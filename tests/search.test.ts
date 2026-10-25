// Rotation search: found rotations are legal (they replay through simulate) and beat a hand-written one;
// with random outcomes, candidates are ranked over several seeded battles and the result is a distribution.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FPS,
  advance,
  apply,
  candidateActions,
  createContext,
  init,
  legalActions,
  memoised,
  randomOutcomes,
  resourceValues,
  rotationSpread,
  searchRotation,
  simulate,
  simulateRuns,
  stateKey,
  type Build,
  type Candidate,
  type RotationAction,
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
  // The controlled operator's dive is always a choice and doesn't count for what's soonest (tests/batch4-dive.test.ts).
  const dive = (c: Candidate) => c.action.operator === state.controlled && c.action.skill === data.operators[c.action.operator]?.dive?.end;
  const soonest = Math.min(...all.filter((c) => !dive(c)).map((c) => c.frame));
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
    // re-pinned after batch 3's S1 / D1 (MarkCanInterrupt, IfElse jumps), which free Laevatain sooner: 1,079,511.708 → 1,176,753.682, 530 → 529 states; then after batch 4's Link correction (a combo
    // gives no Link by itself): 1,070,547.094, 538 states; then with dives among the choices (batch-1 S10): 1,161,308.759,
    // 524 states (the found rotation has no dive; the dive children changed which states the beam kept).
    expect(found.result.total).toBeCloseTo(1161308.759, 3);
    expect(found.expanded).toBe(524);
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

  it("judges the choices at a state as judging every candidate in full would (startsNow and a memoised advance are exact)", () => {
    for (const scenario of [open, duo]) {
      const r = scenario === open ? found : searchRotation(data, scenario, { beamWidth: 4 });
      const ctx = createContext(data, { ...scenario, rotation: [] });
      const fastCtx = memoised(ctx);
      let state = init(ctx);
      let compared = 0;
      for (const step of r.rotation) {
        const fast = legalActions(fastCtx, state);
        const full = judgedInFull(ctx, state);
        expect(fast).toEqual(full);
        // Every choice's child too (states the search judged but didn't keep).
        for (const c of fast.slice(0, 3)) {
          const child = apply(ctx, state, { ...c.action, at: c.frame });
          expect(legalActions(fastCtx, child)).toEqual(judgedInFull(ctx, child));
          compared++;
        }
        state = apply(ctx, state, step);
      }
      expect(compared).toBeGreaterThan(20);
    }
    // Memoised or not, a battle comes out the same; the cache is the memoised context's only.
    const m = memoised(createContext(data, example));
    expect(memoised(m)).toBe(m);
    expect(createContext(data, example).advanceMemo).toBeUndefined();
    let s = init(m);
    for (const a of example.rotation) s = apply(m, s, a);
    s = advance(m, s, example.durationFrames);
    expect(s.hits.reduce((t, h) => t + h.exact, 0)).toBe(simulate(data, example).total);
  });

  it("merges only states that are equal in everything that comes next (stateKey)", () => {
    const ctx = createContext(data, { ...example, rotation: [] });
    const s = advance(ctx, apply(ctx, init(ctx), handWritten[0] as RotationAction), 30);
    const buff = { id: "test", owner: s.controlled, target: "self" as const, appliedAt: 0, expiresAt: 300, modifiers: [] };
    const differ = (a: TimelineState, b: TimelineState) => expect(stateKey(a)).not.toBe(stateKey(b));
    // What the key sampled by hand before left these out: a buff's layers and when they were applied, the enemy's stagger
    // and freeze, a pending hit's snapshot, a delayed action's event.
    differ({ ...s, buffs: [buff] }, { ...s, buffs: [buff, buff] });
    differ({ ...s, buffs: [buff] }, { ...s, buffs: [{ ...buff, appliedAt: 10 }] });
    differ(s, { ...s, stagger: { ...s.stagger, poise: s.stagger.poise - 1 } });
    differ(s, { ...s, enemyFrozenUntil: 99 });
    const hit = { kind: "hit" as const, frame: 99, clock: { operator: s.controlled }, operator: s.controlled, skillId: "x", hitId: "y", sp: 0 };
    differ({ ...s, scheduled: [hit] }, { ...s, scheduled: [{ ...hit, snapshot: [{ zone: "atk" as const, value: 0.1, source: "test" }] }] });
    // The order a path built a record in doesn't matter; Infinity isn't null.
    expect(stateKey({ ...s, readyAt: { a: 1, b: 2 } })).toBe(stateKey({ ...s, readyAt: { b: 2, a: 1 } }));
    const { id, ...rest } = buff;
    expect(stateKey({ ...s, buffs: [buff] })).toBe(stateKey({ ...s, buffs: [{ ...rest, id }] }));
    differ({ ...s, buffs: [{ ...buff, expiresAt: Infinity }] }, { ...s, buffs: [{ ...buff, expiresAt: Number.NaN }] });
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
    // A weighted random choice among a trigger's actions is random too (Purrchena's giftbox and Prezzies).
    const purrchena = readScenario(new URL("../examples/purrchena-shield.scenario.json", import.meta.url).pathname);
    expect(randomOutcomes(data, purrchena).some((x) => x.startsWith("trigger chance (Purrchena:"))).toBe(true);
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

/**
 * The two-operator search's total at beam 6, pinned with the beam-8 solo one (216,663.530 before dives; its rotation
 * now has 19). Re-pinned 2026-10-24 when stateKey became exhaustive (269,470.931 → 264,948.959, 685 → 680 states):
 * the old key left out a pending hit's controlledAtCast, so it merged states whose hits judge `controlled`
 * differently; the beam keeps other states now (the old rotation is still legal; the beam doesn't reach it).
 */
const DUO_TOTAL = 264948.9594;
