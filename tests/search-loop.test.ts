// Opener and loop (searchLoop, efsim search --loop; owner, 2026-11-14): repetitions from a cast of the slowest
// ultimate to its next, each searched afresh from where the last ended; the whole replays with simulate.
import { describe, expect, it } from "vitest";
import { FPS, LOOP_MAX_FRAMES, searchLoop, simulate } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loopCommand, readScenario } from "../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = readScenario(new URL("../examples/laevatain-solo.scenario.json", import.meta.url).pathname);
const { rotation: _r, ...open } = example;
const options = { beamWidth: 4, maxRepetitions: 3, horizonFrames: 30 * FPS };

describe("opener and loop", () => {
  const r = searchLoop(data, open, options);

  it("cuts the fight at the slowest ultimate's casts, each repetition from one to the next", () => {
    expect(r.boundary).toEqual({ operator: "chr_0016_laevat", skill: "chr_0016_laevat_ultimate_skill" });
    expect(r.repetitions.length).toBeGreaterThanOrEqual(2);
    r.repetitions.forEach((c, i) => {
      expect(c.actions[0]).toEqual({ ...r.boundary, at: 0 });
      expect(c.frames).toBeGreaterThan(0);
      expect(c.frames).toBeLessThanOrEqual(LOOP_MAX_FRAMES);
      // The boundary ultimate only at the repetition's start; the next starts where this one ends.
      expect(c.actions.slice(1).some((a) => a.operator === r.boundary?.operator && a.skill === r.boundary?.skill)).toBe(false);
      const next = r.repetitions[i + 1];
      expect(next?.start ?? r.frames).toBe(c.start + c.frames);
    });
  });

  it("replays with simulate: opener and repetitions, their total and each repetition's damage", () => {
    const sim = simulate(data, { ...open, durationFrames: r.frames, rotation: r.rotation });
    expect(sim.total).toBe(r.total);
    for (const c of r.repetitions) {
      expect(c.damage).toBe(sim.hits.filter((h) => h.frame >= c.start && h.frame < c.start + c.frames).reduce((a, h) => a + h.exact, 0));
      // The repetition's actions are the rotation's in its frames.
      expect(r.rotation.filter((a) => (a.at as number) >= c.start && (a.at as number) < c.start + c.frames).map((a) => ({ ...a, at: (a.at as number) - c.start }))).toEqual(c.actions);
    }
    expect(r.dps).toBeCloseTo(r.total / (r.frames / FPS), 6);
  });

  it("says whether the repetitions agree, and why not when they don't; deterministic", () => {
    // Laevatain alone against Rhodagn: the enemy's Stagger cycle doesn't follow her ultimate's, so each repetition's
    // best plan differs (2026-11-14, beam 4: no 3 in a row agree).
    if (r.loop) {
      expect(r.loop.first + r.repeats).toBe(r.repetitions.length);
      expect(r.loop.lengthApart).toBeLessThanOrEqual(r.tolerance);
    } else expect(r.reason).toMatch(/agreed|isn't cast again/);
    expect(searchLoop(data, open, options).total).toBe(r.total);
  });

  it("efsim search --loop prints the repetitions and the total that simulate replays", () => {
    const text = loopCommand(data, { ...example, durationFrames: 30 * FPS }, { beam: 4 });
    expect(text).toMatch(/Each repetition runs from Laevatain's ultimate/);
    expect(text).toMatch(/Opener and all repetitions: [\d,]+ damage in [\d.]+ s/);
  });
});
