// Rotation search: found rotations are legal (they replay through simulate) and beat a hand-written one;
// with random outcomes, candidates are ranked over several seeded battles and the result is a distribution.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FPS,
  advance,
  apply,
  candidateActions,
  committedDamage,
  createContext,
  init,
  legalActions,
  memoised,
  randomOutcomes,
  rotationSpread,
  searchRotation,
  simulate,
  simulateRuns,
  stateKey,
  stateKeyer,
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

/** The choices at a state as the search judged them before its shortcut: every candidate in full, then the soonest, the controlled basics and the asides. */
function judgedInFull(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const all = candidateActions(ctx, state);
  if (all.length === 0) return [];
  // The controlled operator's dive and the swaps are always choices and don't count for what's soonest (tests/batch4-dive.test.ts;
  // a swap nearly always can start at the state's frame: counted, it hid every skill that could start a few frames later).
  const aside = (c: Candidate) => c.action.skill === "swap" || (c.action.operator === state.controlled && c.action.skill === data.operators[c.action.operator]?.dive?.end);
  const soonest = Math.min(...all.filter((c) => !aside(c)).map((c) => c.frame));
  // The candidates' basic attacks are the controlled operator's next ones.
  const basic = (c: Candidate) => data.kits.operators[c.action.operator]?.skills.find((s) => s.skillId === c.action.skill)?.kind === "basic";
  return all.filter((c) => c.frame === soonest || (c.action.operator === state.controlled && basic(c)) || aside(c));
}

describe("rotation search", () => {
  const found = searchRotation(data, open, { beamWidth: 8 });

  it("finds a rotation that replays to the same result with simulate", () => {
    const replay = simulate(data, { ...open, rotation: found.rotation } as TimelineScenario);
    expect(replay.total).toBe(found.result.total);
    expect(found.rotation.every((a) => a.at !== undefined && a.at <= open.durationFrames)).toBe(true);
  });

  it("says when the expansion cap cut it short", () => {
    expect(found.capped).toBe(false);
    const cut = searchRotation(data, open, { beamWidth: 8, maxExpansions: 20 });
    expect(cut.capped).toBe(true);
    expect(cut.expanded).toBeGreaterThanOrEqual(20);
    // Counted: what the beam compared, merged as equivalent, and cut.
    expect(found.counts.compared).toBeGreaterThan(found.counts.merged + found.counts.pruned);
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
    // 524 states (the found rotation has no dive; the dive children changed which states the beam kept); 523 states
    // since the key leaves out deadlines already past (2026-10-25: one more merge, same rotation and total).
    expect(found.result.total).toBeCloseTo(1161308.759, 3);
    expect(found.expanded).toBe(523);
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

  it("in a team, offers the soonest action other than a swap or dive, not only what starts at the state's frame", () => {
    // Review round two (5): a swap can nearly always start at the state's frame, which made every action that couldn't
    // start right then no choice; skills then started only where a basic attack or swap did.
    const si = readScenario(new URL("../examples/si-laevatain.scenario.json", import.meta.url).pathname);
    const ctx = createContext(data, { ...si, rotation: [] });
    const fastCtx = memoised(ctx);
    const dive = (c: Candidate) => c.action.skill === data.operators[c.action.operator]?.dive?.end;
    let state = init(ctx);
    let later = 0;
    for (const step of si.rotation) {
      const all = candidateActions(ctx, state).filter((c) => c.action.skill !== "swap" && !dive(c));
      const soonest = Math.min(...all.map((c) => c.frame));
      const choices = legalActions(fastCtx, state);
      for (const c of all.filter((x) => x.frame === soonest)) expect(choices).toContainEqual(c);
      if (all.some((c) => c.frame === soonest && c.frame > state.frame)) later++;
      state = apply(ctx, state, step);
    }
    // States whose soonest action starts after the state's own frame (4 of the 14; before the fix the search offered
    // none of those actions there: a swap could start at the state's frame).
    expect(later).toBeGreaterThanOrEqual(4);
  });

  it("merges only states that are equal in everything that comes next (stateKey)", () => {
    const ctx = createContext(data, { ...example, rotation: [] });
    const s = advance(ctx, apply(ctx, init(ctx), handWritten[0] as RotationAction), 30);
    const buff = { id: "test", owner: s.controlled, target: "self" as const, appliedAt: 0, expiresAt: 300, modifiers: [] };
    const differ = (a: TimelineState, b: TimelineState) => expect(stateKey(ctx, a)).not.toBe(stateKey(ctx, b));
    // What the key sampled by hand before left these out: a buff's layers and when they were applied, the enemy's stagger
    // and freeze, a pending hit's snapshot, a delayed action's event.
    differ({ ...s, buffs: [buff] }, { ...s, buffs: [buff, buff] });
    differ({ ...s, buffs: [buff] }, { ...s, buffs: [{ ...buff, appliedAt: 10 }] });
    differ(s, { ...s, stagger: { ...s.stagger, poise: s.stagger.poise - 1 } });
    differ(s, { ...s, enemyFrozenUntil: 99 });
    const hit = { kind: "hit" as const, frame: 99, clock: { operator: s.controlled }, operator: s.controlled, skillId: "x", hitId: "y", sp: 0 };
    differ({ ...s, scheduled: [hit] }, { ...s, scheduled: [{ ...hit, snapshot: [{ zone: "atk" as const, value: 0.1, source: "test" }] }] });
    // The order a path built a record in doesn't matter; Infinity isn't null.
    expect(stateKey(ctx, { ...s, readyAt: { a: 100, b: 200 } })).toBe(stateKey(ctx, { ...s, readyAt: { b: 200, a: 100 } }));
    const { id, ...rest } = buff;
    expect(stateKey(ctx, { ...s, buffs: [buff] })).toBe(stateKey(ctx, { ...s, buffs: [{ ...rest, id }] }));
    differ({ ...s, buffs: [{ ...buff, expiresAt: Infinity }] }, { ...s, buffs: [{ ...buff, expiresAt: Number.NaN }] });
  });

  it("leaves out deadlines already past: states that differ only in them have one key and the same future", () => {
    const si = readScenario(new URL("../examples/si-laevatain.scenario.json", import.meta.url).pathname);
    const ctx = memoised(createContext(data, { ...si, rotation: [] }));
    let s = init(ctx);
    for (const a of si.rotation.slice(0, 7)) s = apply(ctx, s, a);
    const f = s.frame;
    const [si0, lae] = si.team.map((b) => b.operator) as [string, string];
    const uncounted = ctx.kits.get(si0)?.triggers.find((t) => t.maxCount === undefined && (s.triggerState[`${si0}:${t.id}`]?.readyAt ?? 0) <= f)?.id;
    expect(uncounted).toBeDefined();
    // Each read only as "later than the frame now" (search.ts KeyEnv): any value at or before the frame is none.
    const dead: TimelineState = {
      ...s,
      readyAt: { ...s.readyAt, [`${lae}_combo_skill`]: Math.min(s.readyAt[`${lae}_combo_skill`] ?? 0, f - 3), unknown_skill: f },
      energyBlockedUntil: { ...s.energyBlockedUntil, [si0]: Math.min(s.energyBlockedUntil[si0] ?? 0, f - 1) },
      spPausedUntil: s.spPausedUntil > f ? s.spPausedUntil : f - 2,
      // A trigger without a count limit, ready again: when it last fired and how often aren't read.
      triggerState: { ...s.triggerState, [`${si0}:${uncounted}`]: { readyAt: f - 1, count: 9 } },
      link: [...s.link, f - 10],
      enemyFrozenUntil: s.enemyFrozenUntil > f ? s.enemyFrozenUntil : f - 4,
      stagger: s.stagger.until === null ? { ...s.stagger, finisherUsed: !s.stagger.finisherUsed } : s.stagger,
      slowdowns: [...s.slowdowns, { start: f - 40, scales: [0, 0, 0], exempt: si0 }],
      comboWindow: { ...s.comboWindow, ...(s.comboWindow[lae] && s.comboWindow[lae].until >= f ? {} : { [lae]: { from: f - 60, until: f - 1, count: 2 } }) },
      chainNext: { ...s.chainNext, ...(s.chainNext[si0] && s.chainNext[si0].until >= f ? {} : { [si0]: { skill: `${si0}_attack2`, from: f - 20, until: f - 1 } }) },
    };
    expect(stateKey(ctx, dead)).toBe(stateKey(ctx, s));
    expect(stateKey(ctx, dead)).not.toBe(stateKey(ctx, { ...dead, link: [...s.link, f + 10] }));
    expectSameFuture(ctx, s, dead, 40);
  });

  it("merges states with the same future only (pairs a small beam meets, followed for the rest of the fight)", () => {
    let pairs = 0;
    for (const name of ["si-laevatain", "laevatain-solo"]) {
      const sc = readScenario(new URL(`../examples/${name}.scenario.json`, import.meta.url).pathname);
      const ctx = memoised(createContext(data, { ...sc, rotation: [] }));
      const key = stateKeyer(ctx);
      // What the key compared before (2026-10-24: every field in full, cast indices as they are) tells pairs only the new key merges.
      const raw = (x: TimelineState) => JSON.stringify({ ...x, hits: [], reactions: [] });
      // A beam by depth (choices made), not by time: paths of one length that meet.
      let frontier = [init(ctx)];
      for (let depth = 0; depth < 40 && frontier.length; depth++) {
        const byKey = new Map<string, TimelineState>();
        for (const x of frontier) {
          for (const c of legalActions(ctx, x)) {
            const child = apply(ctx, x, { ...c.action, at: c.frame });
            const k = key(child);
            const seen = byKey.get(k);
            if (!seen) byKey.set(k, child);
            else if (raw(seen) !== raw(child) && pairs < 40) {
              pairs++;
              expectSameFuture(ctx, seen, child, 40);
            }
          }
        }
        frontier = [...byKey.values()].sort((x, y) => committedDamage(ctx, y) - committedDamage(ctx, x)).slice(0, 16);
      }
    }
    expect(pairs).toBeGreaterThan(10);
  });
});

/** Two states play on the same: the same choices (actions and frames), the same damage to come and keys, whichever choices are taken. */
function expectSameFuture(ctx: TimelineContext, a0: TimelineState, b0: TimelineState, steps: number): void {
  const key = stateKeyer(ctx);
  let a = a0;
  let b = b0;
  for (let i = 0; i < steps; i++) {
    const ca = legalActions(ctx, a);
    expect(legalActions(ctx, b)).toEqual(ca);
    const c = ca[(i * 7) % Math.max(1, ca.length)];
    if (!c) break;
    const step = { ...c.action, at: c.frame };
    const a1 = apply(ctx, a, step);
    const b1 = apply(ctx, b, step);
    const gain = (x: TimelineState, y: TimelineState) => committedDamage(ctx, y) - committedDamage(ctx, x);
    expect(gain(b, b1)).toBeCloseTo(gain(a, a1), 6);
    expect(key(b1)).toBe(key(a1));
    a = a1;
    b = b1;
  }
}

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
 * Re-pinned 2026-10-25 (review round two): offering the actions that start a few frames after a state (a swap no
 * longer counts for what's soonest) gave 247,209.285, a rotation of more choices that the beam of 6 kept less of;
 * keeping one state per family (prune: the swapped variants of one state filled half the beam) 269,470.931, which
 * by chance is the old key's total; the key's dead deadlines on their own move neither.
 */
const DUO_TOTAL = 269470.9311;
