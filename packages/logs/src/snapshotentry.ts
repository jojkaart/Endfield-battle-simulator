// What the log verdict snapshots record of a log (tests/snapshots/log-verdicts*.json), computed in one place: the
// verified logs' test (tests/logs.test.ts), the pending suite (tests/slow/pending.ts) and scripts/measure-worker.ts all
// call this, so a measurement can't drift from the snapshots (round 3's own report: the composition lived in three
// places that had to agree byte for byte). The check itself is composed once, in composeCheck, which the hit records
// (hitexport.ts hitRecords: `zmdlogs hits`, `differences`, `groups`) build on too, so a screen in the suite and a view
// over the records read the same reading (backlog after round 13 point 3).

import { withCurveReading, type GameData } from "@efsim/engine";
import type { ReplayOptions } from "./buffreplay.ts";
import { checkLog, engineHits, engineReport, hitPlace, logBuffReplay, verdictCounts, type EngineHits, type HitVerdict, type LogBuffReplay } from "./logcheck.ts";
import { placeHits, type Placement } from "./logcasts.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { engineCheck, readingBasis, stageFight, totalsShares, type EngineCheck, type TotalsComparison, type TotalsShares } from "./enginecheck.ts";

/** One fight's check, composed once (composeCheck): what the snapshots and the hit records both read. */
export interface CheckComposition {
  /** The game data under the readings (withCurveReading: engine assumption combo-curve's stop lists). */
  readonly data: GameData;
  readonly placement: Placement;
  readonly replay: LogBuffReplay;
  readonly byHit: EngineHits;
  readonly verdicts: HitVerdict[];
  /** The engine's check of the fight (enginecheck.ts engineCheck), made on first use. */
  check(): EngineCheck;
  /** A hit's reading basis (enginecheck.ts readingBasis at its place), memoised per hit. */
  basis(hit: LogHit): ReturnType<typeof readingBasis>;
}

/** The check of a fight under `assume`'s readings: placement, replay, the engine's readings and the verdicts. */
export function composeCheck(raw: GameData, fx: LogFixture, opts: Pick<ReplayOptions, "assume"> = {}): CheckComposition {
  // Engine assumption combo-curve: the log tools' stop lists and the replay's timeline on the same resampled curve.
  const data = withCurveReading(raw, opts.assume);
  const placement = placeHits(data, fx, opts.assume);
  const replay = opts.assume && Object.keys(opts.assume).length ? logBuffReplay(data, fx, placement, { assume: opts.assume }) : logBuffReplay(data, fx, placement);
  const byHit = engineHits(data, fx, replay, placement);
  const verdicts = checkLog(data, fx, { replay, engineHits: byHit, placement });
  let c: EngineCheck | undefined;
  const bases = new Map<LogHit, ReturnType<typeof readingBasis>>();
  const check = () => (c ??= engineCheck(data, fx, replay.replay));
  return {
    data,
    placement,
    replay,
    byHit,
    verdicts,
    check,
    basis(hit) {
      let b = bases.get(hit);
      if (!b) bases.set(hit, (b = readingBasis(check(), hit, hitPlace(data, fx, placement, replay, hit))));
      return b;
    },
  };
}

/** The key of a snapshot entry that holds the totals' errors instead of an operator's counts. */
export const SNAPSHOT_TOTALS_KEY = "totals";

/**
 * The totals keys that hold where the total's error lives (TotalsShares, % of the logged total, to 0.1): kept in the
 * snapshots so the scoreboard shows the groups' means, the hold-outs' included, and a merge's diff moves them (fight
 * totals 2 report point 2: they were measure's alone). Not verdicts: scripts/accuracy.ts `direction` leaves them out.
 */
export const SHARE_KEYS = { matched: "share matched", replayOnly: "share replay-only", logOnly: "share log-only" } as const;

/**
 * The totals key of an operator's share of the fight's logged total (%, to 0.1; round 16, the totals-off report point
 * 2: the scoreboard's by-operator mean read as a fight metric while each is the operator's own error, dominated by
 * small totals). It describes, never a verdict (a `share ` key: scripts/accuracy.ts `direction` leaves it out); the
 * scoreboard weights each operator's error by it.
 */
export const operatorShareKey = (operator: string) => `share operator ${operator}`;

/**
 * The totals keys of where an operator's own error lives (%, to 0.1, of its own logged total): its matched landings'
 * error (predicted − logged, signed) and its one-sided landings' (|replay-only| + |log-only|), round 20 (the Liino
 * report point 1: her 8.5% by-operator mean was one-sided landings in one 10 s fight, none of it her kit, which a
 * scratch join of the totals with the snapshots found). They describe, never a verdict (`share ` keys); the
 * scoreboard's by-operator table shows their means.
 */
export const operatorOwnKeys = (operator: string) => ({ matched: `share own matched operator ${operator}`, oneSided: `share own one-sided operator ${operator}` }) as const;

/**
 * The totals key of an operator's hits that matched only as their event's other kit hit (a match whose reading took
 * another kit hit of the key: a `kitHit` assumption), present where there are any (round 17, the Zhuang Fangyi and
 * Liino report point 1: her attack 4 placed as attack 2 in five logs, 125 hits ×3.125 off, all "fallback" matches, so
 * no headline number moved). It describes, never a verdict (scripts/accuracy.ts isDescribingKey); the scoreboard's
 * by-operator table and measure's comparison count it.
 */
export const otherHitKey = (operator: string) => `other-hit operator ${operator}`;

/** The totals key of a stage fight (enginecheck.ts stageFight; 1, present only there): the scoreboard's by-operator mean without them. */
export const STAGE_KEY = "stage";

/**
 * The totals key of a fight against several enemies under one id (the fixture's severalTargets; 1, present only
 * there): the scoreboard's own group for it (scripts/accuracy.ts), out of the development and earlier-pending means.
 */
export const SEVERAL_TARGETS_KEY = "several targets";

/** Per operator, its hits that matched only as their event's other kit hit (otherHitKey), the operators with none left out. */
export function otherKitHitCounts(verdicts: readonly HitVerdict[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of verdicts) if (v.kind === "match" && v.assumptions.some((a) => a.kind === "kitHit")) out[v.hit.operator] = (out[v.hit.operator] ?? 0) + 1;
  return out;
}

export interface SnapshotEntry {
  /** Per operator its verdict counts, and under SNAPSHOT_TOTALS_KEY the totals' errors in % (engineReport errors) and the shares (SHARE_KEYS). */
  readonly entry: Record<string, Record<string, number | null>>;
  readonly counts: ReturnType<typeof verdictCounts>;
  /** engineReport's errors and, under SHARE_KEYS, where the error lives. */
  readonly totals: ReturnType<typeof engineReport>["errors"];
  /** The totals' error by where it lives (not in the snapshots: measure's aggregates, `zmdlogs totals --all`). */
  readonly shares: TotalsShares;
  /** The totals' one-sided landings (TotalsComparison.oneSided: `zmdlogs totals --all --json`), not in the snapshots. */
  readonly oneSided: TotalsComparison["oneSided"];
  /** What it was computed from, for tests that check more of the same log. */
  readonly replay: LogBuffReplay;
  readonly byHit: EngineHits;
  readonly verdicts: HitVerdict[];
}

/** A log's snapshot entry: the replay of its casts (under `assume`'s readings), the engine's readings, the check's verdicts, their counts and the totals' errors. */
export function snapshotEntry(raw: GameData, fx: LogFixture, opts: Pick<ReplayOptions, "assume"> = {}): SnapshotEntry {
  const { data, replay, byHit, verdicts } = composeCheck(raw, fx, opts);
  const counts = verdictCounts(fx, verdicts);
  const report = engineReport(data, fx, replay, byHit, verdicts);
  const shares = totalsShares(fx.hits, report.totals);
  const r1 = (x: number) => Math.round(x * 10) / 10 + 0; // + 0: no -0 in the snapshots
  const logged = report.totals.logged;
  const operatorShares = Object.fromEntries(Object.keys(logged.perOperator).map((op) => [operatorShareKey(op), logged.damage ? r1((100 * (logged.perOperator[op] ?? 0)) / logged.damage) : null]));
  const otherHits = Object.fromEntries(Object.entries(otherKitHitCounts(verdicts)).map(([op, n]) => [otherHitKey(op), n]));
  // An operator's own split, from the fight's (TotalsShares.perOperator, % of the fight's logged total) over its own total.
  const own = Object.fromEntries(
    shares.perOperator.flatMap((p) => {
      const mine = logged.perOperator[p.operator] ?? 0;
      if (!(mine > 0) || !logged.damage) return [];
      const k = operatorOwnKeys(p.operator);
      const of = (x: number) => r1((x * logged.damage) / mine);
      return [
        [k.matched, of(p.matched)],
        [k.oneSided, of(Math.abs(p.replayOnly) + Math.abs(p.logOnly))],
      ];
    }),
  );
  const totals = { ...report.errors, [SHARE_KEYS.matched]: r1(shares.matched), [SHARE_KEYS.replayOnly]: r1(shares.replayOnly), [SHARE_KEYS.logOnly]: r1(shares.logOnly), ...operatorShares, ...own, ...otherHits, ...(stageFight(fx) !== null ? { [STAGE_KEY]: 1 } : {}), ...(fx.severalTargets ? { [SEVERAL_TARGETS_KEY]: 1 } : {}) };
  return { entry: { ...counts, [SNAPSHOT_TOTALS_KEY]: totals }, counts, totals, shares, oneSided: report.totals.oneSided, replay, byHit, verdicts };
}
