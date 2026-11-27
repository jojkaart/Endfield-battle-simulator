// The assumption readers' run check (tests/assumption-readers.test.ts, tests/slow/assumption-readers-logs.test.ts):
// a log's whole check (snapshotEntry) under every assumption given explicitly at its default, its reads traced.
import { allAssumptions, traceReadings, type GameData, type ReadingRead } from "@efsim/engine";
import { devFixtures, snapshotEntry } from "@efsim/logs";

/**
 * The assumptions read at their defaults (a reader not handed the run's `assume`) when `fixture`'s whole check runs
 * under every assumption given at its default reading (the default run, so every default path is taken), and the
 * count of reads.
 */
export function defaultedReads(data: GameData, fixture: string): { readonly defaulted: readonly string[]; readonly reads: number } {
  const fx = (devFixtures({ ids: [fixture] })[0] as { fx: Parameters<typeof snapshotEntry>[1] }).fx;
  const every = Object.fromEntries(allAssumptions(data).map((a) => [a.id, a.default]));
  const reads: ReadingRead[] = [];
  traceReadings((r) => reads.push(r), () => snapshotEntry(data, fx, { assume: every }));
  return { defaulted: [...new Set(reads.filter((r) => !r.given).map((r) => r.id))], reads: reads.length };
}
