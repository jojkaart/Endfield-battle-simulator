// The assumption readers' run check (tests/assumption-readers.test.ts, tests/slow/assumption-readers-logs.test.ts):
// a log's whole check (snapshotEntry) under every assumption given explicitly at its default, its reads traced.
import { allAssumptions, traceReadings, type GameData, type ReadingRead } from "@efsim/engine";
import { devFixtures, snapshotEntry } from "@efsim/logs";

/**
 * Where a read was made: the first stack frame that isn't the tracer's or readingOf's own (assumptions.ts, this file),
 * as `path:line (function)` from the repository root (round 20, the break-placement report point 1: the failing check
 * said only which ids were defaulted, and a hand-made stack trace found checkLog placing the hits again itself).
 */
export function readSite(stack: string | undefined): string {
  const frames = (stack ?? "").split("\n").slice(1).map((l) => l.trim());
  const own = (l: string) => /tests\/helpers\/readings\.ts|packages\/engine\/src\/assumptions\.ts|node:internal/.test(l);
  const f = frames.find((l) => l.startsWith("at ") && !own(l));
  if (!f) return "an unknown caller";
  const m = /^at (?:(\S+) \()?(?:file:\/\/)?(.*?):(\d+):\d+\)?$/.exec(f);
  if (!m) return f.replace(/^at /, "");
  const path = (m[2] as string).replace(/^.*?\/(packages|tests|scripts)\//, "$1/");
  return `${path}:${m[3]}${m[1] ? ` (${m[1]})` : ""}`;
}

/**
 * The assumptions read at their defaults (a reader not handed the run's `assume`) when `fixture`'s whole check runs
 * under every assumption given at its default reading (the default run, so every default path is taken), each as
 * `id ← where` (readSite: the first read's caller), and the count of reads.
 */
export function defaultedReads(data: GameData, fixture: string): { readonly defaulted: readonly string[]; readonly reads: number } {
  const fx = (devFixtures({ ids: [fixture] })[0] as { fx: Parameters<typeof snapshotEntry>[1] }).fx;
  const every = Object.fromEntries(allAssumptions(data).map((a) => [a.id, a.default]));
  const reads: ReadingRead[] = [];
  const where = new Map<string, string>();
  traceReadings((r) => {
    reads.push(r);
    if (!r.given && !where.has(r.id)) where.set(r.id, readSite(new Error().stack));
  }, () => snapshotEntry(data, fx, { assume: every }));
  return { defaulted: [...where].map(([id, at]) => `${id} ← ${at}`), reads: reads.length };
}
