// Writes tests/slow/pending-costs.json: the seconds each pending (and hold-out) log's check took in the last
// `npm run snapshots:update`, read from that run's vitest JSON report. tests/logverdicts.ts `shard()` balances the
// test:logs shards by these times (a log's cost doesn't follow its hit count: 340 hits took 59 s, 1,134 took 21 s);
// a log without a time falls back to its hits. Only times are written, never a verdict: hold-out logs appear by file
// name, as in the verdict snapshot. scripts/snapshots.sh runs it.
//
// Usage: node scripts/pending-costs.ts <vitest-json-report>

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { VitestReport } from "./premerge.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PENDING_COSTS = join(ROOT, "tests", "slow", "pending-costs.json");

/** The hold-out logs' keys in the order their tests count them ("hold-out log N" is the Nth: tests/slow/pending.ts testTitle). */
export function holdoutKeys(root: string = ROOT): string[] {
  const dir = join(root, "fixtures", "holdout");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith("zmdlogs-") && f.endsWith(".json")).sort().map((f) => `holdout/${f}`) : [];
}

/** Each log's check time in seconds (to 0.1), by its key under fixtures/ ("pending/zmdlogs-….json"). */
export function pendingCosts(report: VitestReport, holdouts: readonly string[] = holdoutKeys()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of report.testResults) {
    for (const a of f.assertionResults) {
      const m = /^((?:pending|holdout)\/zmdlogs-[^ ]+\.json|hold-out log (\d+)) checks as its snapshot says$/.exec(a.fullName);
      const key = m?.[2] !== undefined ? holdouts[Number(m[2]) - 1] : m?.[1];
      if (key && typeof a.duration === "number") out[key] = Math.round(a.duration / 100) / 10;
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function main(argv: string[]): number {
  const file = argv[0];
  if (!file || !existsSync(file)) {
    process.stderr.write(`pending-costs: no report at ${file ?? "(none given)"}; tests/slow/pending-costs.json left as it was\n`);
    return 0;
  }
  const costs = pendingCosts(JSON.parse(readFileSync(file, "utf8")) as VitestReport);
  const n = Object.keys(costs).length;
  if (!n) {
    process.stderr.write("pending-costs: the report has no pending log's time; tests/slow/pending-costs.json left as it was\n");
    return 0;
  }
  writeFileSync(PENDING_COSTS, JSON.stringify(costs, null, 1) + "\n");
  const total = Object.values(costs).reduce((s, x) => s + x, 0);
  process.stdout.write(`pending-costs: ${n} logs' check times written (${total.toFixed(0)} s in all)\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
