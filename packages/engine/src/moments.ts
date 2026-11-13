// Damage distributions as five additive numbers (docs/design.md "Damage distributions"; the owner, 2026-11-13):
// every random outcome contributes its least and most possible damage, its mean, its variance and its third
// central moment, and for independent outcomes all five add. A fight's totals are their sums; from them the
// standard deviation and approximate 5th / 95th percentiles (Cornish–Fisher with the skew).
//
// Pure arithmetic on plain numbers: no game rule lives here.

import { EngineError } from "./errors.ts";

/** One random outcome's damage (or a sum of independent ones): bounds, mean, variance, third central moment. */
export interface DamageMoments {
  readonly min: number;
  readonly mean: number;
  readonly max: number;
  readonly var: number;
  readonly m3: number;
}

export const NO_DAMAGE: DamageMoments = { min: 0, mean: 0, max: 0, var: 0, m3: 0 };

/** All mass at one value (a hit that can't crit, a rolled hit, Fixed DMG). */
export function pointMoments(v: number): DamageMoments {
  return { min: v, mean: v, max: v, var: 0, m3: 0 };
}

/**
 * A hit that crits with chance `p`: `low` without the crit, `high` with it (v and v(1 + c)). The mean is given (the
 * engine's expected-mode value, v(1 + pc), so the distribution's mean is that total to the same double); var
 * d²p(1 − p) and m3 d³p(1 − p)(1 − 2p) with d = high − low = vc.
 */
export function critMoments(low: number, high: number, p: number, mean = low + p * (high - low)): DamageMoments {
  if (!(p >= 0 && p <= 1)) throw new EngineError(`a crit chance is 0–1, not ${p}`);
  if (p === 0) return pointMoments(low);
  if (p === 1) return pointMoments(high);
  const d = high - low;
  const q = p * (1 - p);
  return { min: Math.min(low, high), mean, max: Math.max(low, high), var: d * d * q, m3: d * d * d * q * (1 - 2 * p) };
}

/** Two independent outcomes' sum: all five add. */
export function addMoments(a: DamageMoments, b: DamageMoments): DamageMoments {
  return { min: a.min + b.min, mean: a.mean + b.mean, max: a.max + b.max, var: a.var + b.var, m3: a.m3 + b.m3 };
}

/** The outcome × k (k ≥ 0): bounds and mean × k, variance × k², third moment × k³. */
export function scaleMoments(m: DamageMoments, k: number): DamageMoments {
  if (!(k >= 0)) throw new EngineError(`scaling a distribution by ${k}`);
  return { min: m.min * k, mean: m.mean * k, max: m.max * k, var: m.var * k * k, m3: m.m3 * k * k * k };
}

/**
 * One of several outcomes picked uniformly at random (a mixture): its raw moments are the average of theirs, so
 * mean μ̄ = avg μᵢ, var = avg(σᵢ² + (μᵢ − μ̄)²), m3 = avg(m3ᵢ + 3σᵢ²(μᵢ − μ̄) + (μᵢ − μ̄)³); bounds the widest.
 */
export function mixtureMoments(list: readonly DamageMoments[]): DamageMoments {
  if (list.length === 0) throw new EngineError("a mixture of no outcomes");
  const n = list.length;
  const mean = list.reduce((s, m) => s + m.mean, 0) / n;
  let v = 0;
  let m3 = 0;
  for (const m of list) {
    const d = m.mean - mean;
    v += m.var + d * d;
    m3 += m.m3 + 3 * m.var * d + d * d * d;
  }
  return { min: Math.min(...list.map((m) => m.min)), mean, max: Math.max(...list.map((m) => m.max)), var: v / n, m3: m3 / n };
}

/** A count's distribution: pmf[k] = P(N = k). */
export type CountPmf = readonly number[];

/** The empirical distribution of observed counts (each observation equally likely). */
export function empiricalPmf(counts: readonly number[]): CountPmf {
  if (counts.length === 0) throw new EngineError("an empirical count distribution needs at least one count");
  for (const c of counts) if (!Number.isInteger(c) || c < 0) throw new EngineError(`a count is a whole number ≥ 0, not ${c}`);
  const out = Array.from({ length: Math.max(...counts) + 1 }, () => 0);
  for (const c of counts) out[c] = (out[c] as number) + 1 / counts.length;
  return out;
}

/** C(n, k) as a double (small n). */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * N landings chosen uniformly from `of` places, of which only `kept` happen (a cast cut short): the number that
 * happen, N', is hypergeometric given N: P(N' = k | N = n) = C(kept, k) C(of − kept, n − k) / C(of, n).
 */
export function thinPmf(pmf: CountPmf, of: number, kept: number): CountPmf {
  if (!(Number.isInteger(of) && Number.isInteger(kept) && kept >= 0 && kept <= of)) throw new EngineError(`thinning ${of} places to ${kept}`);
  if (pmf.length - 1 > of) throw new EngineError(`a count of ${pmf.length - 1} of ${of} places`);
  if (kept === of) return pmf;
  const out = Array.from({ length: kept + 1 }, () => 0);
  pmf.forEach((p, n) => {
    if (p === 0) return;
    const all = choose(of, n);
    for (let k = 0; k <= Math.min(n, kept); k++) out[k] = (out[k] as number) + (p * choose(kept, k) * choose(of - kept, n - k)) / all;
  });
  return out;
}

/** A count distribution's mean, variance, third central moment (κ3) and least and greatest possible counts. */
export function countCumulants(pmf: CountPmf): { readonly mean: number; readonly var: number; readonly k3: number; readonly min: number; readonly max: number } {
  const mean = pmf.reduce((s, p, k) => s + p * k, 0);
  const v = pmf.reduce((s, p, k) => s + p * (k - mean) ** 2, 0);
  const k3 = pmf.reduce((s, p, k) => s + p * (k - mean) ** 3, 0);
  const support = pmf.flatMap((p, k) => (p > 0 ? [k] : []));
  return { mean, var: v, k3, min: Math.min(...support), max: Math.max(...support) };
}

/**
 * A random sum of N independent copies of X, N independent of them (a compound distribution), by its cumulants:
 * mean E[N]κ1, var E[N]κ2 + Var[N]κ1², m3 E[N]κ3 + 3Var[N]κ1κ2 + κ3(N)κ1³ (κ: X's mean, variance, third central
 * moment); bounds minN·minX and maxN·maxX (X ≥ 0).
 */
export function compoundMoments(pmf: CountPmf, x: DamageMoments): DamageMoments {
  const n = countCumulants(pmf);
  return {
    min: n.min * x.min,
    mean: n.mean * x.mean,
    max: n.max * x.max,
    var: n.mean * x.var + n.var * x.mean * x.mean,
    m3: n.mean * x.m3 + 3 * n.var * x.mean * x.var + n.k3 * x.mean ** 3,
  };
}

/**
 * Battles that differ by outcomes that change what happens later (dodges, a trigger's chance, crit-triggered
 * effects), each with its own distribution, equally likely: the fight's distribution by the law of total cumulance,
 * over the battles B: mean E[μ_B]; var E[σ²_B] + Var[μ_B]; m3 E[m3_B] + 3 Cov(μ_B, σ²_B) + κ3(μ_B) (population
 * moments over the K battles). Bounds: the least and greatest of the battles' (bounds over the battles seen).
 */
export function combineBattles(list: readonly DamageMoments[]): DamageMoments {
  if (list.length === 0) throw new EngineError("no battles to combine");
  if (list.length === 1) return list[0] as DamageMoments;
  const k = list.length;
  const mean = list.reduce((s, m) => s + m.mean, 0) / k;
  const avgVar = list.reduce((s, m) => s + m.var, 0) / k;
  let varOfMeans = 0;
  let cov = 0;
  let k3OfMeans = 0;
  let avgM3 = 0;
  for (const m of list) {
    const d = m.mean - mean;
    varOfMeans += d * d;
    cov += d * (m.var - avgVar);
    k3OfMeans += d * d * d;
    avgM3 += m.m3;
  }
  return {
    min: Math.min(...list.map((m) => m.min)),
    mean,
    max: Math.max(...list.map((m) => m.max)),
    var: avgVar + varOfMeans / k,
    m3: avgM3 / k + (3 * cov) / k + k3OfMeans / k,
  };
}

/** What a landed hit's distribution reads (timeline LandedHit: HitDamage.critSpread, LandedHit.landed). */
export interface MomentsHit {
  readonly operator: string;
  readonly skillId: string;
  readonly hitId: string;
  readonly exact: number;
  readonly critSpread?: { readonly chance: number; readonly low: number; readonly high: number };
  readonly landed?: { readonly cast: number; readonly of: number; readonly counts: readonly number[]; readonly scale: number };
}

/** One landed hit's distribution: its two crit outcomes (critSpread) with its value as the mean, else all at its value. */
export function hitMoments(h: MomentsHit): DamageMoments {
  return h.critSpread ? critMoments(h.critSpread.low, h.critSpread.high, h.critSpread.chance, h.exact) : pointMoments(h.exact);
}

/**
 * A battle's landed hits' distribution: the sum of each hit's (independent crits), but a cast's landings of a hit with
 * a random landed count (LandedHit.landed), which are one random sum: N' of copies of X, X the uniform mixture of
 * those landings' distributions without the E[N] / L factor (one landing picked at random), N' the observed counts
 * thinned to the landings that happened (thinPmf: L' of the cast's L planned, when it was cut short). Its mean is
 * the landings' damage as landed (Σ of their values with the factor), the same number the total adds.
 */
export function hitsMoments(hits: readonly MomentsHit[]): DamageMoments {
  let out = NO_DAMAGE;
  const groups = new Map<string, MomentsHit[]>();
  for (const h of hits) {
    if (!h.landed) {
      out = addMoments(out, hitMoments(h));
      continue;
    }
    const key = `${h.operator}|${h.skillId}|${h.hitId}|${h.landed.cast}`;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  for (const [key, list] of groups) {
    const { of, counts, scale } = (list[0] as MomentsHit & { landed: NonNullable<MomentsHit["landed"]> }).landed;
    if (list.length > of) throw new EngineError(`${key}: ${list.length} landings of ${of} planned`);
    const mean = list.reduce((s, h) => s + h.exact, 0);
    // No landing expected (every observed count 0): nothing lands.
    if (scale === 0) continue;
    const x = mixtureMoments(list.map((h) => scaleMoments(hitMoments(h), 1 / scale)));
    out = addMoments(out, { ...compoundMoments(thinPmf(empiricalPmf(counts), of, list.length), x), mean });
  }
  return out;
}

/** The standard normal's 95th percentile, Φ⁻¹(0.95). */
export const Z_95 = 1.6448536269514722;

/**
 * A percentile by the Cornish–Fisher expansion to the skew's term: x_p ≈ μ + σ (z + (z² − 1) γ₁ / 6), z = Φ⁻¹(p),
 * γ₁ = m3 / σ³. The kurtosis term needs the fourth cumulant, which isn't tracked: the error grows with the
 * distribution's tails (fine for sums of many hits). Kept within [min, max].
 */
export function cornishFisher(m: DamageMoments, z: number): number {
  const sd = Math.sqrt(Math.max(0, m.var));
  if (sd === 0) return m.mean;
  const skew = m.m3 / sd ** 3;
  const x = m.mean + sd * (z + ((z * z - 1) * skew) / 6);
  return Math.min(m.max, Math.max(m.min, x));
}
