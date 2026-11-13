// Damage distributions (docs/design.md "Damage distributions"): the five additive fields of a hit, their sums, the
// random sum of a random landed count, battles combined by the law of total cumulance, Cornish–Fisher percentiles;
// and on the timeline: the mean is the expected-mode total, Ardelia's sheep land a random number of times, the
// bounds hold, and a small Monte Carlo agrees with the distribution.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addMoments,
  combineBattles,
  compoundMoments,
  computeKit,
  computeStats,
  cornishFisher,
  critMoments,
  empiricalPmf,
  hitsMoments,
  mixtureMoments,
  pointMoments,
  simulate,
  simulateDistribution,
  simulateRuns,
  thinPmf,
  Z_95,
  type DamageMoments,
  type LandedHit,
  type TimelineScenario,
} from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { readScenario } from "@efsim/cli";

const data = loadGameData();
const examples = new URL("../examples/", import.meta.url).pathname;
const example = (f: string) => readScenario(join(examples, f));

/** A discrete distribution as (value, probability) pairs. */
type Dist = readonly (readonly [number, number])[];
const twoPoint = (low: number, high: number, p: number): Dist => [[low, 1 - p], [high, p]];
const sumDist = (a: Dist, b: Dist): Dist => a.flatMap(([x, p]) => b.map(([y, q]) => [x + y, p * q] as const));
/** A discrete distribution's five fields, computed directly. */
function direct(d: Dist): DamageMoments {
  const live = d.filter(([, p]) => p > 0);
  const mean = live.reduce((s, [x, p]) => s + p * x, 0);
  return {
    min: Math.min(...live.map(([x]) => x)),
    mean,
    max: Math.max(...live.map(([x]) => x)),
    var: live.reduce((s, [x, p]) => s + p * (x - mean) ** 2, 0),
    m3: live.reduce((s, [x, p]) => s + p * (x - mean) ** 3, 0),
  };
}
const close = (a: DamageMoments, b: DamageMoments, rel = 1e-9) => {
  for (const k of ["min", "mean", "max", "var", "m3"] as const) expect(a[k], k).toBeCloseTo(b[k], Math.max(0, -Math.log10(rel * Math.max(1, Math.abs(b[k])))));
};

describe("a hit's five fields", () => {
  it("a crit-capable hit: min v, max v(1+c), mean v(1+pc), var v²c²p(1−p), m3 v³c³p(1−p)(1−2p)", () => {
    const [v, c, p] = [1000, 0.8, 0.3];
    const m = critMoments(v, v * (1 + c), p);
    expect(m).toEqual({ min: v, max: v * (1 + c), mean: v + p * v * c, var: (v * c) ** 2 * p * (1 - p), m3: (v * c) ** 3 * p * (1 - p) * (1 - 2 * p) });
    close(m, direct(twoPoint(v, v * (1 + c), p)));
    // The mean given is kept (the engine's expected value, to the same double).
    expect(critMoments(v, v * (1 + c), p, 1240.0000001).mean).toBe(1240.0000001);
  });

  it("a hit that can't crit (or always / never does) has all its mass at its value", () => {
    expect(pointMoments(500)).toEqual({ min: 500, mean: 500, max: 500, var: 0, m3: 0 });
    expect(critMoments(500, 900, 0)).toEqual(pointMoments(500));
    expect(critMoments(500, 900, 1)).toEqual(pointMoments(900));
  });

  it("the engine's expected crit hits carry their two values: low (1 + p c) is the expected value, high = low (1 + c)", () => {
    const sc = example("laevatain-solo.scenario.json");
    const build = sc.team[0] as TimelineScenario["team"][number];
    const hits = computeKit(data, build, computeStats(data, build), sc.target);
    const spread = hits.filter((h) => h.critSpread);
    expect(spread.length).toBeGreaterThan(0);
    for (const h of spread) {
      const s = h.critSpread as NonNullable<typeof h.critSpread>;
      const c = s.high / s.low - 1;
      expect(s.low * (1 + s.chance * c)).toBeCloseTo(h.exact, 6);
      expect(h.zones.crit).toBeCloseTo(1 + s.chance * c, 12);
    }
    // never / always crits: no spread.
    expect(computeKit(data, build, computeStats(data, build), sc.target, { crit: "always", staggered: false }).some((h) => h.critSpread)).toBe(false);
  });
});

describe("sums, random sums, battles combined", () => {
  const a = twoPoint(100, 180, 0.25);
  const b = twoPoint(40, 100, 0.6);

  it("independent outcomes: all five fields add", () => {
    close(addMoments(direct(a), direct(b)), direct(sumDist(a, b)));
  });

  it("a uniform mixture against its direct moments", () => {
    const mix: Dist = [...a.map(([x, p]) => [x, p / 2] as const), ...b.map(([x, p]) => [x, p / 2] as const)];
    close(mixtureMoments([direct(a), direct(b)]), direct(mix));
  });

  it("a random sum of N iid copies of X (compound formulas) against brute-force enumeration", () => {
    const counts = [0, 1, 1, 2, 3, 3, 3];
    const pmf = empiricalPmf(counts);
    let all: Dist = [];
    pmf.forEach((pn, n) => {
      let s: Dist = [[0, 1]];
      for (let i = 0; i < n; i++) s = sumDist(s, a);
      all = [...all, ...s.map(([x, p]) => [x, p * pn] as const)];
    });
    close(compoundMoments(pmf, direct(a)), direct(all));
  });

  it("thinning: N of `of` places chosen uniformly, `kept` of them happen, against enumeration of the subsets", () => {
    const of = 5;
    const kept = 3;
    const counts = [1, 2, 2, 4];
    const out = Array.from({ length: kept + 1 }, () => 0);
    const subsets = (n: number, from = 0): number[][] => (n === 0 ? [[]] : Array.from({ length: of - from }, (_, i) => from + i).flatMap((i) => subsets(n - 1, i + 1).map((s) => [i, ...s])));
    for (const n of counts) {
      const list = subsets(n);
      for (const s of list) {
        const k = s.filter((i) => i < kept).length;
        out[k] = (out[k] as number) + 1 / counts.length / list.length;
      }
    }
    thinPmf(empiricalPmf(counts), of, kept).forEach((p, k) => expect(p).toBeCloseTo(out[k] as number, 12));
    expect(thinPmf(empiricalPmf(counts), of, of)).toEqual(empiricalPmf(counts));
  });

  it("battles combined (law of total cumulance) equal the equal-weight mixture of the battles' distributions", () => {
    const battles: Dist[] = [sumDist(a, b), sumDist(twoPoint(150, 300, 0.1), b), twoPoint(90, 400, 0.5)];
    const mix: Dist = battles.flatMap((d) => d.map(([x, p]) => [x, p / battles.length] as const));
    close(combineBattles(battles.map(direct)), direct(mix));
  });

  it("Cornish–Fisher: symmetric, μ ± zσ; with skew, z + (z² − 1)γ/6; clamped to the bounds", () => {
    const m = { min: 0, mean: 100, max: 1000, var: 400, m3: 0 };
    expect(cornishFisher(m, Z_95)).toBeCloseTo(100 + 20 * Z_95, 10);
    const skewed = { ...m, m3: 0.6 * 20 ** 3 };
    expect(cornishFisher(skewed, -Z_95)).toBeCloseTo(100 + 20 * (-Z_95 + ((Z_95 ** 2 - 1) * 0.6) / 6), 10);
    expect(cornishFisher({ ...m, min: 90 }, -Z_95)).toBe(90);
  });
});

describe("on the timeline", () => {
  it("without crit triggers, dodges or chances the mean is the expected-mode total to the same double, from one battle", () => {
    for (const f of ["laevatain-solo.scenario.json", "si-laevatain.scenario.json", "camille-gilberta.scenario.json"]) {
      const sc = example(f);
      const r = simulate(data, sc);
      const d = simulateDistribution(data, sc);
      expect(d.mean, f).toBe(r.total);
      expect(d.battles, f).toBe(1);
      expect(d.random, f).toEqual([]);
      // The battle's variance is the sum of its hits' (each hit's crit independent).
      const perHit = r.hits.reduce((s, h) => s + (h.critSpread ? (h.critSpread.high - h.critSpread.low) ** 2 * h.critSpread.chance * (1 - h.critSpread.chance) : 0), 0);
      expect(r.moments.var / perHit, f).toBeCloseTo(1, 9);
      expect(d.min).toBeLessThanOrEqual(d.p5);
      expect(d.p5).toBeLessThan(d.mean);
      expect(d.mean).toBeLessThan(d.p95);
      expect(d.p95).toBeLessThanOrEqual(d.max);
    }
  });

  const A = "chr_0025_ardelia";
  const ULT = "chr_0025_ardelia_ultimate_skill";
  const ardelia = example("ardelia-corrosion.scenario.json");
  const sheep = (r: { hits: readonly LandedHit[] }) => r.hits.filter((h) => h.operator === A && h.skillId === ULT && h.hitId === "sheep");
  const below = [2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9];

  it("Ardelia's sheep below P3: 11 planned landings, each × E[N] / 11 at expected crits, one random sum in the distribution", () => {
    const r = simulate(data, ardelia);
    const s = sheep(r);
    expect(s).toHaveLength(11);
    const en = below.reduce((a, b) => a + b, 0) / below.length;
    for (const h of s) {
      expect(h.landed).toMatchObject({ of: 11, counts: below });
      expect(h.landed?.scale).toBeCloseTo(en / 11, 12);
    }
    // The upper bound's battle lands the most observed (9), the first nine, at full damage.
    const most = sheep(simulate(data, { ...ardelia, options: { ...ardelia.options, landedCounts: "most" } }));
    expect(most).toHaveLength(9);
    expect(most.every((h) => h.landed === undefined)).toBe(true);
    expect(most[0]?.exact).toBeCloseTo((s[0]?.exact as number) / (s[0]?.landed?.scale as number), 6);
    // The cast's sheep as a random sum: the distribution's variance is more than the hits' own crits give.
    const crits = hitsMoments(r.hits.map(({ landed: _l, ...h }) => h));
    expect(r.moments.var).toBeGreaterThan(crits.var);
    expect(r.moments.mean).toBe(r.total);
  });

  it("from P3 the counts are fromPotential's, out of 14 landings", () => {
    const p3 = { ...ardelia, team: ardelia.team.map((b) => ({ ...b, potential: 3 })) };
    const s = sheep(simulate(data, p3));
    expect(s).toHaveLength(14);
    expect(s[0]?.landed).toMatchObject({ of: 14, counts: [4, 8, 8, 9, 10, 10, 11] });
  });

  it("rolled crits draw the count (stream landed) and land that many of the planned landings; least / most land the fewest / most", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = sheep(simulate(data, { ...ardelia, options: { ...ardelia.options, crit: "rolled", seed } }));
      expect(below).toContain(s.length);
      for (const h of s) expect(h.landed).toBeUndefined();
      seen.add(s.length);
    }
    expect(seen.size).toBeGreaterThan(3);
    expect(sheep(simulate(data, { ...ardelia, options: { ...ardelia.options, landedCounts: "least" } }))).toHaveLength(2);
  });

  it("the bounds: no crits and fewest landings ≤ the mean ≤ every crit and most landings (crit-trigger teams too)", () => {
    for (const [f, crit] of [["yvonne-fluorite.scenario.json", "expected"], ["rossi-gilberta.scenario.json", "expected"], ["ardelia-corrosion.scenario.json", "expected"]] as const) {
      const sc0 = example(f);
      const sc = { ...sc0, options: { ...sc0.options, crit } };
      const d = simulateDistribution(data, sc, { battles: 2 });
      expect(d.min, f).toBeLessThanOrEqual(d.mean);
      expect(d.mean, f).toBeLessThanOrEqual(d.max);
      expect(d.boundsNote, f).toBeUndefined();
      if (f !== "ardelia-corrosion.scenario.json") {
        expect(d.crit, f).toBe("distribution");
        expect(d.battles, f).toBe(2);
      }
    }
  });

  it("Monte Carlo (rolled crits) agrees with the distribution: mean within sampling error, sd within 15%, every total within the bounds", () => {
    const runs = 120;
    for (const f of ["ardelia-corrosion.scenario.json", "laevatain-solo.scenario.json"]) {
      const sc = example(f);
      const d = simulateDistribution(data, sc);
      const r = simulateRuns(data, sc, runs);
      expect(Math.abs(r.mean - d.mean), f).toBeLessThan(4 * (r.sd / Math.sqrt(runs)));
      expect(r.sd / d.sd, f).toBeGreaterThan(0.85);
      expect(r.sd / d.sd, f).toBeLessThan(1.15);
      for (const t of r.totals) {
        expect(t, f).toBeGreaterThanOrEqual(d.min - 1e-6);
        expect(t, f).toBeLessThanOrEqual(d.max + 1e-6);
      }
    }
  });
});
