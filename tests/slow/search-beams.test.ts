// How far a rotation search can be trusted (review round two, 2026-10-25): a beam search isn't monotone in its width,
// so efsim search runs w/2, w and 2w and keeps the best (searchBeams). These are ratchets: the bounds are what the
// search achieves now, to be tightened (never loosened) as it gets better. Slow (a minute): `npm run test:logs`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FPS, searchBeams, searchRotation, simulate, type Build } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "../../packages/cli/src/simulate.ts";

const data = loadGameData();
const example = (name: string) => {
  const { rotation: _r, ...open } = readScenario(new URL(`../../examples/${name}.scenario.json`, import.meta.url).pathname);
  return open;
};
const fx = JSON.parse(readFileSync(new URL("../../fixtures/zmdlogs-40d9a3c1da37.json", import.meta.url), "utf8")) as { team: Build[] };
const scenarios = {
  // Laevatain and Gilberta (the 40d9 fixture's builds), 20 s.
  duo: {
    team: fx.team.filter((b) => b.operator === "chr_0016_laevat" || b.operator === "chr_0013_aglina"),
    target: { enemy: "eny_0051_rodin", level: 90 },
    durationFrames: 20 * FPS,
    options: { crit: "expected" as const },
  },
  // Si and Laevatain, the first 10 s.
  si: { ...example("si-laevatain"), durationFrames: 10 * FPS },
};

describe("rotation search: beam widths", () => {
  const w = 4;
  const totals = Object.fromEntries(
    Object.entries(scenarios).map(([name, sc]) => [name, Object.fromEntries([w / 2, w, 2 * w, 4 * w].map((b) => [b, searchRotation(data, sc, { beamWidth: b, runs: 0 }).score]))]),
  ) as Record<string, Record<number, number>>;

  it("efsim search's result (the best of w/2, w and 2w) at 2w is at most 1% below the one at w", () => {
    for (const t of Object.values(totals)) {
      const at = (x: number) => Math.max(t[x / 2] as number, t[x] as number, t[2 * x] as number);
      expect(at(2 * w)).toBeGreaterThanOrEqual(0.99 * at(w));
    }
  });

  it("one width alone: 2w at most 2% below w (the gap left: the beam ranks by damage so far)", () => {
    // 2026-10-25: duo 2 / 4 / 8 / 16 → 261,286 / 269,061 / 264,575 (−1.7%) / 268,548; si 10 s 665,777 / 881,348 /
    // 1,109,088 / 1,133,461. Before the swap fix and families, si-laevatain (20 s) fell 4.5% from 24 to 32.
    for (const t of Object.values(totals)) {
      for (const x of [w / 2, w, 2 * w]) expect(t[2 * x] as number).toBeGreaterThanOrEqual(0.98 * (t[x] as number));
    }
  });

  it("searchBeams keeps the best width's rotation and says how far apart the widths are", () => {
    const r = searchBeams(data, scenarios.duo, { beams: [2, 4], runs: 0 });
    expect(r.beams.map((b) => b.beamWidth)).toEqual([2, 4]);
    expect(r.score).toBe(Math.max(...r.beams.map((b) => b.score)));
    expect(r.beams.find((b) => b.beamWidth === r.beamWidth)?.score).toBe(r.score);
    expect(simulate(data, { ...scenarios.duo, rotation: r.rotation }).total).toBe(r.result.total);
    const lo = Math.min(...r.beams.map((b) => b.score));
    expect(r.beamSpread).toBeCloseTo((r.score - lo) / r.score, 12);
  });

  it("a team of four: the search replays, isn't cut by the expansion cap and the states stay few", () => {
    const sc = example("si-laevatain-liino-gilberta");
    const r = searchRotation(data, sc, { beamWidth: 4, runs: 0 });
    expect(new Set(r.rotation.map((a) => a.operator)).size).toBe(4);
    expect(simulate(data, { ...sc, rotation: r.rotation }).total).toBe(r.result.total);
    expect(r.capped).toBe(false);
    expect(r.expanded).toBeLessThan(2000);
  });
});
