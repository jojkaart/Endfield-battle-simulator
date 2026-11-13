// A scenario's total damage as a distribution (docs/design.md "Damage distributions"; the owner, 2026-11-13):
// mean, variance and third central moment from battles' five additive fields (moments.ts), the true bounds from two
// deterministic battles, and approximate 5th / 95th percentiles by Cornish–Fisher.
//
// Two parts, kept apart so either can be replaced: fightMoments (mean, var, m3: one exact battle, or K seeded
// battles combined when outcomes change what happens later) and damageBounds (min and max).

import type { CritMode } from "./damage.ts";
import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import { combineBattles, cornishFisher, type DamageMoments, Z_95 } from "./moments.ts";
import { critTriggers, randomOutcomes } from "./search.ts";
import { simulate } from "./timeline/drivers.ts";
import type { TimelineScenario } from "./timeline/state.ts";

/** Seeded battles a distribution plays when outcomes change what happens later (DistributionOptions.battles). */
export const DEFAULT_DISTRIBUTION_BATTLES = 8;

export interface DistributionOptions {
  /** Seeded battles when the fight has outcomes that change what happens later (default 8): seeds seed, seed + 1, … */
  readonly battles?: number;
}

/**
 * A scenario's total damage as a distribution. `mean`, `var`, `m3` are the fight's (moments.ts); `min` / `max` its
 * bounds: the total with no hit critting and every random landed count at its fewest, and with every hit critting
 * (every crit-triggered effect firing as early as it can) and the most landings. That they bound the fight assumes
 * crit-triggered effects only raise damage. `p5` / `p95`: Cornish–Fisher estimates (moments.ts cornishFisher).
 */
export interface DamageDistribution extends DamageMoments {
  readonly sd: number;
  /** m3 / sd³ (0 without spread). */
  readonly skew: number;
  readonly p5: number;
  readonly p95: number;
  /** The crit mode the battles were played in: the scenario's, or `distribution` for expected crits with crit-triggered effects. */
  readonly crit: CritMode;
  /** What makes battles differ (search.ts randomOutcomes in that mode); empty: one battle gives the distribution exactly. */
  readonly random: readonly string[];
  /** Battles the mean, var and m3 are over (1: exact), from seed `seed`; `illegal`: of them, those the rotation can't be played in (left out). */
  readonly battles: number;
  readonly seed: number;
  readonly illegal: number;
  /** The mean's standard error from playing K battles rather than all (0 for one exact battle): their means' sample sd / √K. */
  readonly meanError: number;
  /**
   * Battles the bounds are over: 1 when only crits and landed counts are random (the true bounds); with dodges or
   * trigger chances, the never / always battles of each seed (the least and greatest over the battles seen).
   */
  readonly boundsOver: number;
  /** Set when a bound battle couldn't be played (its rotation isn't legal there): the bounds are then the battles' own (moments.ts sums of per-hit bounds), and this says so. */
  readonly boundsNote?: string;
}

/** The crit mode a scenario's distribution plays its battles in: `distribution` for expected crits with crit-triggered effects in the team, else its own. */
export function distributionCritMode(data: GameData, scenario: Omit<TimelineScenario, "rotation">): CritMode {
  const crit = scenario.options.crit;
  return (crit === "expected" || crit === "distribution") && critTriggers(data, scenario).length > 0 ? "distribution" : crit === "distribution" ? "expected" : crit;
}

/** One battle with seed `seed`, or null when the rotation can't be played in it. */
function battle(data: GameData, scenario: TimelineScenario, options: Partial<TimelineScenario["options"]>, seed: number): DamageMoments | null {
  try {
    return simulate(data, { ...scenario, options: { ...scenario.options, ...options, seed: seed >>> 0 } }).moments;
  } catch (e) {
    if (!(e instanceof EngineError)) throw e;
    return null;
  }
}

/**
 * The fight's mean, variance and third moment: with nothing random that changes what happens later, one battle
 * (exact); else `battles` seeded battles in the crit mode `crit`, combined by the law of total cumulance
 * (moments.ts combineBattles). The part a later estimate (the expected state of crit-triggered buffs, one battle)
 * would replace.
 */
export function fightMoments(data: GameData, scenario: TimelineScenario, crit: CritMode, random: readonly string[], battles: number): { readonly moments: DamageMoments; readonly battles: number; readonly illegal: number; readonly meanError: number } {
  const seed = scenario.options.seed ?? 1;
  const k = random.length ? battles : 1;
  const list = Array.from({ length: k }, (_, i) => battle(data, scenario, { crit }, seed + i)).filter((m): m is DamageMoments => m !== null);
  if (list.length === 0) throw new EngineError(`the rotation isn't legal in any of ${k} battles (seeds ${seed}–${seed + k - 1})`);
  const n = list.length;
  const mean = list.reduce((s, m) => s + m.mean, 0) / n;
  // The standard error of the battles' mean: the sample variance of their means over n.
  const meanError = n > 1 ? Math.sqrt(list.reduce((s, m) => s + (m.mean - mean) ** 2, 0) / (n - 1) / n) : 0;
  return { moments: combineBattles(list), battles: k, illegal: k - n, meanError };
}

/**
 * The fight's bounds: the battle with crits `never` and the fewest landings, and the one with crits `always` and the
 * most (TimelineOptions.landedCounts); with dodges or trigger chances, of each of the `battles` seeds. Null when one
 * of them can't be played.
 */
export function damageBounds(data: GameData, scenario: TimelineScenario, battles: number): { readonly min: number; readonly max: number; readonly over: number } | null {
  const seed = scenario.options.seed ?? 1;
  // What's random besides crits (dodges, trigger chances): randomOutcomes with crits that are never random.
  const others = randomOutcomes(data, { ...scenario, options: { ...scenario.options, crit: "never" } });
  const k = others.length ? battles : 1;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < k; i++) {
    const low = battle(data, scenario, { crit: "never", landedCounts: "least" }, seed + i);
    const high = battle(data, scenario, { crit: "always", landedCounts: "most" }, seed + i);
    if (!low || !high) return null;
    min = Math.min(min, low.mean);
    max = Math.max(max, high.mean);
  }
  return { min, max, over: k };
}

/** A scenario's total damage as a distribution (DamageDistribution). */
export function simulateDistribution(data: GameData, scenario: TimelineScenario, options: DistributionOptions = {}): DamageDistribution {
  const battles = options.battles ?? DEFAULT_DISTRIBUTION_BATTLES;
  if (!Number.isInteger(battles) || battles < 1) throw new EngineError(`battles must be a whole number ≥ 1, not ${battles}`);
  const crit = distributionCritMode(data, scenario);
  const played = { ...scenario, options: { ...scenario.options, crit } };
  const random = randomOutcomes(data, played);
  const fight = fightMoments(data, played, crit, random, battles);
  const bounds = damageBounds(data, scenario, battles);
  const m: DamageMoments = bounds ? { ...fight.moments, min: bounds.min, max: bounds.max } : fight.moments;
  const sd = Math.sqrt(Math.max(0, m.var));
  return {
    ...m,
    sd,
    skew: sd > 0 ? m.m3 / sd ** 3 : 0,
    p5: cornishFisher(m, -Z_95),
    p95: cornishFisher(m, Z_95),
    crit,
    random,
    battles: fight.battles,
    seed: scenario.options.seed ?? 1,
    illegal: fight.illegal,
    meanError: fight.meanError,
    boundsOver: bounds?.over ?? fight.battles,
    ...(bounds ? {} : { boundsNote: "a bound battle (no crits / every crit) can't play the rotation: the bounds are the battles' own sums of per-hit bounds" }),
  };
}
