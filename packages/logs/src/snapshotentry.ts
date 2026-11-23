// What the log verdict snapshots record of a log (tests/snapshots/log-verdicts*.json), computed in one place: the
// verified logs' test (tests/logs.test.ts), the pending suite (tests/slow/pending.ts) and scripts/measure-worker.ts all
// call this, so a measurement can't drift from the snapshots (round 3's own report: the composition lived in three
// places that had to agree byte for byte).

import type { GameData } from "@efsim/engine";
import type { ReplayOptions } from "./buffreplay.ts";
import { checkLog, engineHits, engineReport, logBuffReplay, verdictCounts, type EngineHits, type HitVerdict, type LogBuffReplay } from "./logcheck.ts";
import type { LogFixture } from "./zmdlogs.ts";
import { totalsShares, type TotalsShares } from "./enginecheck.ts";

/** The key of a snapshot entry that holds the totals' errors instead of an operator's counts. */
export const SNAPSHOT_TOTALS_KEY = "totals";

export interface SnapshotEntry {
  /** Per operator its verdict counts, and under SNAPSHOT_TOTALS_KEY the totals' errors in % (engineReport errors). */
  readonly entry: Record<string, Record<string, number | null>>;
  readonly counts: ReturnType<typeof verdictCounts>;
  readonly totals: ReturnType<typeof engineReport>["errors"];
  /** The totals' error by where it lives (not in the snapshots: measure's aggregates, `zmdlogs totals --all`). */
  readonly shares: TotalsShares;
  /** What it was computed from, for tests that check more of the same log. */
  readonly replay: LogBuffReplay;
  readonly byHit: EngineHits;
  readonly verdicts: HitVerdict[];
}

/** A log's snapshot entry: the replay of its casts (under `assume`'s readings), the engine's readings, the check's verdicts, their counts and the totals' errors. */
export function snapshotEntry(data: GameData, fx: LogFixture, opts: Pick<ReplayOptions, "assume"> = {}): SnapshotEntry {
  const replay = opts.assume && Object.keys(opts.assume).length ? logBuffReplay(data, fx, undefined, { assume: opts.assume }) : logBuffReplay(data, fx);
  const byHit = engineHits(data, fx, replay);
  const verdicts = checkLog(data, fx, { replay, engineHits: byHit });
  const counts = verdictCounts(fx, verdicts);
  const report = engineReport(data, fx, replay, byHit, verdicts);
  const totals = report.errors;
  return { entry: { ...counts, [SNAPSHOT_TOTALS_KEY]: totals }, counts, totals, shares: totalsShares(fx.hits, report.totals), replay, byHit, verdicts };
}
