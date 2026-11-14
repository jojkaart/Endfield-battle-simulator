// Opener and loop (searchLoop, efsim search --loop; owner, 2026-11-14): rounds from a cast of the slowest ultimate to
// its next, each the best closing plan from where the last ended or the last one replayed exactly, until one plays
// `repeats` more times; the whole replays with simulate.
import { describe, expect, it } from "vitest";
import { FPS, LOOP_MAX_FRAMES, SP, closingScore, createContext, init, apply, resourcePrices, searchLoop, searchRotation, simulate, type RotationAction } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loopCommand, readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = readScenario(new URL("../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const { rotation: _r, ...open } = example;
const options = { beamWidth: 6, plays: 5 };
const LAEV = "chr_0016_laevat";
const ULT = "chr_0016_laevat_ultimate_skill";

describe("opener and loop", () => {
  const r = searchLoop(data, open, options);

  it("cuts the fight at the slowest ultimate's casts, each round from one to the next", () => {
    expect(r.boundary).toEqual({ operator: LAEV, skill: ULT });
    expect(r.repetitions.length).toBeGreaterThanOrEqual(2);
    r.repetitions.forEach((c, i) => {
      expect(c.actions[0]).toEqual({ ...r.boundary, at: 0 });
      expect(c.frames).toBeGreaterThan(0);
      expect(c.frames).toBeLessThanOrEqual(LOOP_MAX_FRAMES);
      // The boundary ultimate only at the round's start; the next starts where this one ends.
      expect(c.actions.slice(1).some((a) => a.operator === r.boundary?.operator && a.skill === r.boundary?.skill)).toBe(false);
      expect(r.repetitions[i + 1]?.start ?? r.frames).toBe(c.start + c.frames);
      // A replayed round plays the round before it exactly.
      if (c.replayed) expect(c.actions).toEqual(r.repetitions[i - 1]?.actions);
    });
  });

  it("replays with simulate: opener and rounds, their total and each round's damage", () => {
    const sim = simulate(data, { ...open, durationFrames: r.frames, rotation: r.rotation });
    expect(sim.total).toBe(r.total);
    for (const c of r.repetitions) {
      expect(c.damage).toBe(sim.hits.filter((h) => h.frame >= c.start && h.frame < c.start + c.frames).reduce((a, h) => a + h.exact, 0));
      expect(r.rotation.filter((a) => (a.at as number) >= c.start && (a.at as number) < c.start + c.frames).map((a) => ({ ...a, at: (a.at as number) - c.start }))).toEqual(c.actions);
    }
    expect(r.dps).toBeCloseTo(r.total / (r.frames / FPS), 6);
  });

  it("finds a loop for Laevatain alone: one plan played 5 times exactly, after an opener", () => {
    // 2026-11-14, beam 6: the first rounds still spend the opener's SP (200 at the start) and change her Melting Flame
    // stacks; then a plan that leaves both as it found them repeats. Its plays' damage differs by the enemy's Stagger.
    const l = r.loop;
    expect(l, r.reason).toBeDefined();
    if (!l) return;
    expect(l.plays).toBe(5);
    expect(l.first + l.plays).toBe(r.repetitions.length);
    const plays = r.repetitions.slice(l.first);
    expect(plays.slice(1).every((c) => c.replayed)).toBe(true);
    for (const c of plays) {
      expect(c.actions).toEqual(l.actions);
      expect(c.frames).toBe(l.frames);
    }
    expect(l.openerFrames).toBe(plays[0]?.start);
    expect(l.opener).toEqual(r.rotation.filter((a) => (a.at as number) < l.openerFrames));
    expect(l.dps).toBeCloseTo(plays.reduce((a, c) => a + c.damage, 0) / ((l.frames * l.plays) / FPS), 6);
    expect(l.agrees).toBe(l.damageApart <= r.tolerance);
  });

  it("efsim search --loop prints the rounds, the loop and the total that simulate replays (the same again: deterministic)", () => {
    const text = loopCommand(data, example, { beam: 6, loops: 5 });
    expect(text).toMatch(/Each round runs from Laevatain's ultimate/);
    expect(text).toMatch(/Loop: rounds \d+–\d+ play the same actions at the same times/);
    expect(text).toContain(`Opener and 5 plays of the loop: ${Math.round(r.total).toLocaleString("en-US")} damage in ${(r.frames / FPS).toFixed(1)} s`);
  });
});

describe("closing rounds", () => {
  it("SearchHooks.stopAt ends a rotation at the chosen step and returns it with its state", () => {
    const s = { ...open, durationFrames: 20 * FPS };
    const r = searchRotation(data, s, { beamWidth: 3, runs: 0 }, { stopAt: (a) => a.skill === ULT });
    expect(r.stops?.length).toBeGreaterThan(0);
    for (const x of r.stops ?? []) {
      expect(x.rotation.at(-1)?.skill).toBe(ULT);
      expect(x.rotation.slice(0, -1).some((a) => a.skill === ULT)).toBe(false);
      expect(x.state.frame).toBe(x.rotation.at(-1)?.at);
    }
    // Without the hook: no stops.
    expect(searchRotation(data, s, { beamWidth: 3, runs: 0 }).stops).toBeUndefined();
  });

  it("closingScore charges the SP a round takes from what it found as the time regeneration needs to make it up", () => {
    const s = { ...open, durationFrames: 30 * FPS };
    const ctx = createContext(data, { ...s, rotation: [] });
    const from = init(ctx);
    const rotation: RotationAction[] = [{ operator: LAEV, skill: "chr_0016_laevat_normal_skill" }];
    const end = rotation.reduce((st, a) => apply(ctx, st, a), from);
    const later = { ...end, frame: end.frame + 60 };
    const prices = resourcePrices(data, s);
    const damage = later.hits.filter((h) => h.frame >= 0 && h.frame < later.frame).reduce((a, h) => a + h.exact, 0);
    const spent = from.sp - later.sp;
    expect(spent).toBeGreaterThan(0);
    expect(closingScore(s.team, prices, from, later, 0)).toBeCloseTo(damage / (later.frame / FPS + spent / SP.perSecond), 6);
  });

  it("refuses a fight with random outcomes", () => {
    expect(() => searchLoop(data, { ...open, options: { ...open.options, crit: "rolled" } }, options)).toThrow(/random outcomes/);
  });
});
