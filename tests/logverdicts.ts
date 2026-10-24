// Log verdict snapshots (tests/logs.test.ts, tests/slow/logs-pending.test.ts): per fixture and operator, the counts
// of each verdict of `zmdlogs check` (VERDICT_COUNTS: matches split into plain, assumed and log-listing fallback;
// mismatch, unvalued, unquantified, uncovered). A regression baseline like the example snapshot, not values with
// provenance (docs/design.md principle 11).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VERDICT_COUNTS, type VerdictCount } from "@efsim/cli";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The log fixtures in a directory under fixtures/ ("" for fixtures/ itself), as paths relative to fixtures/. */
export function logFixtures(sub: string): string[] {
  return readdirSync(join(ROOT, "fixtures", sub))
    .filter((f) => f.startsWith("zmdlogs-") && f.endsWith(".json"))
    .sort()
    .map((f) => (sub ? `${sub}/${f}` : f));
}

/**
 * Shard `i` of `n` of log fixtures, balanced by hit count (the largest first, each to the lightest shard), so slow
 * checks spread over test files that run in parallel.
 */
export function shard(files: readonly string[], n: number, i: number): string[] {
  const hits = new Map(files.map((f) => [f, (JSON.parse(readFileSync(join(ROOT, "fixtures", f), "utf8")) as { hits: unknown[] }).hits.length]));
  const shards = Array.from({ length: n }, () => ({ load: 0, files: [] as string[] }));
  for (const f of [...files].sort((a, b) => (hits.get(b) as number) - (hits.get(a) as number) || a.localeCompare(b))) {
    const s = shards.reduce((m, x) => (x.load < m.load ? x : m));
    s.files.push(f);
    s.load += hits.get(f) as number;
  }
  return (shards[i] as { files: string[] }).files.sort();
}

export type Counts =Readonly<Record<VerdictCount, number>>;
export type FixtureCounts = Readonly<Record<string, Counts>>;

const total = (c: Counts | undefined, ...keys: VerdictCount[]) => keys.reduce((s, k) => s + (c?.[k] ?? 0), 0);

/**
 * Where a verified fixture's counts fall behind its snapshot: per operator, fewer plain matches, fewer plain and
 * assumed together, fewer matches in all, or more log-listing fallbacks. Moves the other way pass (the snapshot
 * should then be updated, so the gain is kept: `improvements`).
 */
export function regressions(now: FixtureCounts, stored: FixtureCounts): string[] {
  const out: string[] = [];
  for (const [op, was] of Object.entries(stored)) {
    const is = now[op];
    const fell = (what: string, a: number, b: number) => a < b && out.push(`${op}: ${what} ${b} → ${a}`);
    fell("plain matches", total(is, "plain"), total(was, "plain"));
    fell("plain + assumed matches", total(is, "plain", "assumed"), total(was, "plain", "assumed"));
    fell("matches", total(is, "plain", "assumed", "fallback"), total(was, "plain", "assumed", "fallback"));
    if (total(is, "fallback") > total(was, "fallback")) out.push(`${op}: log-listing fallback matches ${total(was, "fallback")} → ${total(is, "fallback")}`);
  }
  for (const op of Object.keys(now)) if (!(op in stored)) out.push(`${op}: not in the snapshot`);
  return out;
}

/** Every count that differs from the snapshot, as `op count a → b`. */
export function changes(now: FixtureCounts, stored: FixtureCounts): string[] {
  const out: string[] = [];
  for (const op of new Set([...Object.keys(stored), ...Object.keys(now)])) {
    for (const k of VERDICT_COUNTS) if (total(stored[op], k) !== total(now[op], k)) out.push(`${op} ${k} ${total(stored[op], k)} → ${total(now[op], k)}`);
  }
  return out;
}
