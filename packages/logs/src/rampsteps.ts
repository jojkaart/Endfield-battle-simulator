// Corrosion's ramp read from the logged hits (docs/open-problems.md "The buff clock"): each hit under the log's
// Corrosion, read at every step of the replay's Corrosion (its level, applier's Arts Intensity, cap and carried shred:
// reactions.ts corrosionShred), fits the logged value (±1) at some steps only; those say how much of the enemy's world
// time had passed since the log's application. Against the replay's own world time there (its Corrosion's ramp, which
// every stop the replay makes holds) with its placed hidden holds taken out, that is how much hidden hold the log's clock
// had there (holds.ts placeHolds, kind "ramp"). `efsim zmdlogs ramp <fixture>` shows the reading.

import { corrosionShred, FPS, landingDamage, rampElapsed, readingDoesNotApply, roundDamage, type ActiveStatus } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { readingBasis, type EngineCheck, type HitPlace, type Reading } from "./enginecheck.ts";
import { isCorrosionBuff } from "./logeffects.ts";
import type { HoldBound } from "./holds.ts";

/** One logged hit's reading of Corrosion's ramp. Steps count whole seconds of the status's own (world) time. */
export interface RampStep {
  readonly hit: LogHit;
  /** The log's Corrosion (the replay's in a log that lists none): its application (ms) and applier. */
  readonly since: number;
  readonly source: string;
  readonly level: number;
  /** The replay's step at the landing (its world time since its application, held by its stops and holds). */
  readonly replayStep: number;
  /** The steps whose shred fits the logged value (±1), lowest and highest (a run of steps); `capped`: the highest is the cap's first (every later step reads the same). */
  readonly low: number;
  readonly high: number;
  readonly capped: boolean;
  /** Which reading fitted: the replay's buffs (primary) or the log's listing of the team's kit buffs (log). */
  readonly reading: "primary" | "log";
  /**
   * The replay's world time from the log's application to the hit without its placed hidden holds (ms): its Corrosion's
   * own time at the landing (every stop the replay makes held it, the ultimates it places from their events only among
   * them, which the placement's stops don't have: db87's Laevatain at 16.60 s), its hidden holds since added back, and
   * the log's application's lead over the replay's.
   */
  readonly world: number;
}

/** Steps tried at most (Corrosion's cap comes at 10 s and less). */
const MAX_STEPS = 30;

/**
 * How many steps the log's may be from the replay's (the replay already has the other clocks' holds). The ramp is read
 * from the damage the check then judges, so a reading may only move the clock a step: with 3, the negative control
 * (tests/slow/negative-control.test.ts) found 34 chance matches of 167 in bdf2 at ×0.97 (the scaled values read as a
 * younger ramp, and the holds placed for it); with 1, none, and no development log's verdicts move (2026-11-23).
 */
const MAX_STEP_LAG = 1;

/** How far the replay's application of its Corrosion may be from the log's and still be the same instance (ms). */
const SAME_APPLICATION_MS = 500;

/** The Corrosion at a landing whose shred the reading has (its modifier and the status), or null. */
function corrosionOf(r: Reading, enemy: readonly ActiveStatus[]): { readonly index: number; readonly status: ActiveStatus } | null {
  const mods = r.options.modifiers ?? [];
  const index = mods.findIndex((m) => m.zone === "ignoreResistance" && m.source.startsWith("Corrosion level "));
  const status = enemy.find((x) => x.status === "corrosion");
  return index >= 0 && status ? { index, status } : null;
}

/**
 * Each logged hit's reading of Corrosion's ramp (RampStep): kit and status hits with a logged crit under the log's
 * Corrosion, whose landing in the replay has a Corrosion from the same applier applied within SAME_APPLICATION_MS of the
 * log's (the replay's status events: `applications`, frames), and some run of steps that fits (the primary reading
 * first, else the log's reading of the team's kit buffs). Hits no step fits are left out (something else is off there).
 * A log that lists no Corrosion anywhere (older exports: db87) takes the replay's Corrosion and its application.
 */
export function rampSteps(c: EngineCheck, fx: Pick<LogFixture, "hits">, place: (hit: LogHit) => HitPlace, held: (from: number, to: number) => number, applications: readonly { readonly operator: string; readonly frame: number; readonly status: string }[]): RampStep[] {
  const out: RampStep[] = [];
  // Older logs list no Corrosion at all (db87): the replay's own application stands for the log's there.
  const listsCorrosion = fx.hits.some((h) => h.unquantified.some((u) => isCorrosionBuff(u.buff)));
  for (const hit of fx.hits) {
    if (hit.crit === null) continue;
    const logged = hit.unquantified.find((u) => isCorrosionBuff(u.buff) && u.since !== undefined && u.source !== undefined);
    if (listsCorrosion && (!logged || logged.since === undefined || logged.source === undefined)) continue;
    const basis = readingBasis(c, hit, place(hit));
    if ("unknown" in basis.landing) continue;
    const b = basis as Exclude<typeof basis, { readonly landing: { readonly unknown: string } }>;
    const enemy = b.landing.facts?.enemy.statuses ?? [];
    const found = corrosionOf(b.primary, enemy);
    if (!found || (logged && found.status.operator !== logged.source)) continue;
    const frame = b.landing.frame;
    const applied = applications.filter((a) => a.status === "corrosion" && a.operator === found.status.operator && a.frame <= frame).at(-1);
    if (!applied) continue;
    // The log's application where it lists one (the replay's within SAME_APPLICATION_MS of it), else the replay's.
    const since = logged?.since ?? Math.round((applied.frame * 1000) / FPS);
    if (Math.abs((applied.frame * 1000) / FPS - since) > SAME_APPLICATION_MS) continue;
    const s = found.status;
    const shred = (k: number) => corrosionShred(s.level, k * 1000, s.artsIntensity, s.capScale ?? 1, s.damageScale?.value ?? 1, s.carried ?? 0);
    const values: number[] = [];
    for (let k = 0; k <= MAX_STEPS; k++) {
      const v = shred(k);
      if (k > 0 && Math.abs(v - (values[k - 1] as number)) < 1e-9) break;
      values.push(v);
    }
    const actual = hit.uncapped ?? hit.value;
    const fits = (r: Reading): number[] => {
      const at = corrosionOf(r, enemy);
      if (!at) return [];
      const ks: number[] = [];
      for (const [k, v] of values.entries()) {
        const mods = (r.options.modifiers ?? []).map((m, i) => (i === at.index ? { ...m, value: v } : m));
        try {
          if (Math.abs(roundDamage(landingDamage(c.data, c.target, r.inputs, { ...r.options, modifiers: mods }, r.other).exact) - actual) <= 1) ks.push(k);
        } catch (e) {
          if (!readingDoesNotApply(e)) throw e;
          return [];
        }
      }
      return ks;
    };
    let reading: "primary" | "log" = "primary";
    let ks = fits(b.primary);
    if (ks.length === 0) {
      reading = "log";
      ks = fits(b.logReading());
    }
    if (ks.length === 0) continue;
    const [low, high] = [Math.min(...ks), Math.max(...ks)];
    // A run of steps only (two apart fitting and the one between not: a coincidence of other parts).
    if (high - low + 1 !== ks.length) continue;
    const elapsed = (rampElapsed(s, frame) * 1000) / FPS;
    const replayStep = Math.min(values.length - 1, Math.floor(Math.max(0, elapsed) / 1000));
    // Far from the replay's own step: a coincidence of other parts (a seal's finisher reading step 2 of 10), not the ramp.
    if (low > replayStep + MAX_STEP_LAG || high < replayStep - MAX_STEP_LAG) continue;
    const appliedMs = (applied.frame * 1000) / FPS;
    const world = elapsed + held(appliedMs, (frame * 1000) / FPS) + (appliedMs - since);
    out.push({ hit, since, source: s.operator, level: s.level, replayStep, low, high, capped: high === values.length - 1, reading, world });
  }
  return out.sort((x, y) => x.hit.t - y.hit.t);
}

/** How far a step's edge may be from the log's ms (the frame grid, a frame either side), ms. */
const RAMP_TOL_MS = 70;

/**
 * The hidden holds' bounds from the ramp's readings (RampStep): the log's world time since its application, its steps
 * `low`…`high` (whole seconds), is the replay's world time (`world`) less the hidden holds between, so P(hit) − P(since) lies in
 * (world − (high + 1) s, world − low s], open above where `high` is the cap's step. Per Corrosion instance and run of
 * steps, its first and last hits (the edges of a step are what bound it; the hits between repeat them).
 */
export function rampBounds(steps: readonly RampStep[]): HoldBound[] {
  const groups = new Map<string, RampStep[]>();
  for (const s of steps) {
    const k = `${s.source}|${s.since}|${s.low}|${s.high}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const out: HoldBound[] = [];
  for (const list of groups.values()) {
    for (const s of new Set([list[0] as RampStep, list.at(-1) as RampStep])) {
      const min = s.capped ? -Infinity : s.world - (s.high + 1) * 1000 - RAMP_TOL_MS;
      const max = s.world - s.low * 1000 + RAMP_TOL_MS;
      if (s.hit.t <= s.since) continue;
      const tag = `ramp corrosion|${s.source} ${s.since}→${s.hit.t} ms steps ${s.low}${s.high !== s.low ? `–${s.high}` : ""}${s.capped ? "+" : ""} (replay ${s.replayStep})`;
      // What it asks: the least hold where that is above none, the most where that is below none (the replay's ramp behind the log's).
      out.push({ a: s.since, b: s.hit.t, min, max, kind: "ramp", tag, ex: (min > 0 ? min : max < 0 ? max : 0) / 1000 });
    }
  }
  return out;
}
