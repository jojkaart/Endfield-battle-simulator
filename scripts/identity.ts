// Is a behaviour-preserving move a move? (Round 22, round 21's own report point 1: a compiler change was checked by a
// scratch sha1 of loadGameData at two commits, a keepPrevious unification by a scratch script over every log, a pairing
// move by cli-ab on two logs; the full answer came from the 10-minute snapshots:update.) The compiled game data and
// kits, and each log's default replay record (the placement, the casts made, the tail cuts, the landings with their
// frames, refs and damage, the status record, the applied slow-downs, the hidden holds, what failed), hashed at the
// working tree as it is now and at --base, both in worktrees of their own; it prints the parts that differ per
// development log, and the hold-outs as a count of logs that differ (never which, nor which part).
//
//   node scripts/identity.ts --base <ref> [--data] [--replay] [--logs <id,…>] [--workers n]
//
// --data: the compiled data only (seconds); --replay: the logs only; neither: both. --logs: these development logs
// only (no hold-out then). Under the test lock as a short job (beside a rule search, not beside a premerge or a test
// suite), ending with `EFSIM-DONE identity same|differ|fail` on stdout; exit 0 when every hash is the same, 1 when one
// differs. A difference is a lead, not a verdict: snapshots:update still decides what moved.

import { existsSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isHoldoutKey, readSplit } from "./accuracy.ts";
import { atCommit, removeAtCommit, snapshotCommit } from "./at-commit.ts";
import { logKeys, pool } from "./measure.ts";
import type { MeasureAnswer, MeasureJob } from "./measure-worker.ts";
import { runLockedAsync, testLockFile } from "./testlock.ts";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The parts of two sides' hashes that differ (a part one side lacks counts as differing). */
export function differingParts(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
}

/**
 * The report: the data's verdict, then each development log whose parts differ (its key, the parts), the hold-outs as a
 * count only, and the totals. `holdout`: whether a key is a hold-out's.
 */
export function identityLines(base: string, sides: { readonly before: ReadonlyMap<string, Readonly<Record<string, string>>>; readonly after: ReadonlyMap<string, Readonly<Record<string, string>>> }, holdout: (key: string) => boolean): { readonly lines: string[]; readonly same: boolean } {
  const lines: string[] = [];
  let same = true;
  const data = [sides.before.get("data"), sides.after.get("data")];
  if (data[0] || data[1]) {
    const d = data[0] && data[1] && differingParts(data[0], data[1]).length === 0;
    if (!d) same = false;
    lines.push(`compiled data and kits: ${d ? "the same" : "DIFFER"} (a sha1 of loadGameData() at ${base} and in the tree)`);
  }
  const keys = [...new Set([...sides.before.keys(), ...sides.after.keys()])].filter((k) => k !== "data").sort();
  if (keys.length) {
    const differ = keys.filter((k) => {
      const [x, y] = [sides.before.get(k), sides.after.get(k)];
      return !x || !y || differingParts(x, y).length > 0;
    });
    const held = differ.filter(holdout);
    for (const k of differ.filter((x) => !holdout(x))) {
      const [x, y] = [sides.before.get(k), sides.after.get(k)];
      lines.push(`  ${k}: ${!x ? "only in the tree" : !y ? `only at ${base}` : differingParts(x, y).join(", ")}`);
    }
    if (differ.length) same = false;
    const nHold = keys.filter(holdout).length;
    lines.unshift(`replay records: ${differ.length - held.length} of ${keys.length - nHold} development log(s) differ${nHold ? `; hold-outs: ${held.length} of ${nHold} differ (a count only)` : ""}${differ.length - held.length ? " (the parts below)" : ""}`);
  }
  return { lines, same };
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      base: { type: "string" },
      data: { type: "boolean", default: false },
      replay: { type: "boolean", default: false },
      logs: { type: "string", multiple: true, default: [] },
      workers: { type: "string", default: String(Math.min(3, Math.max(1, cpus().length - 1))) },
      tree: { type: "string" },
    },
  });
  if (!values.base) throw new Error("identity: --base <ref> (the commit the tree should behave as)");
  const workers = Number(values.workers);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const [wantData, wantReplay] = values.data || values.replay ? [values.data, values.replay] : [true, true];
  // Both sides in worktrees of their own: the base, and the tree as it was when queued (--tree: its snapshot commit).
  const sideDir = (tag: string) => resolve(ROOT, "scratch/at", `identity-${tag}-${process.pid}`);
  const [baseDir, treeDir] = [sideDir("base"), sideDir("tree")];
  atCommit(values.base, baseDir);
  atCommit(values.tree ?? "HEAD", treeDir);
  process.on("exit", () => {
    for (const d of [baseDir, treeDir]) if (existsSync(d)) removeAtCommit(d);
  });
  const split = readSplit();
  const holdout = (k: string) => isHoldoutKey(k, split);
  const wanted = values.logs.flatMap((x) => x.split(",")).filter(Boolean);
  const keys = wantReplay ? logKeys(treeDir).filter((k) => !wanted.length || (!holdout(k) && wanted.some((w) => k.includes(w)))) : [];
  if (wanted.length && !keys.length) throw new Error(`identity: --logs ${wanted.join(",")}: no development log of these ids`);
  const jobs: MeasureJob[] = [...(wantData ? [{ key: "data", what: "data" as const }] : []), ...keys.map((key) => ({ key, what: "identity" as const }))];
  const run = async (dir: string, label: string) => {
    const got = new Map<string, Readonly<Record<string, string>>>();
    await pool(dir, jobs, workers, (a: MeasureAnswer) => {
      if ("error" in a) got.set(a.key, { error: a.error.split("\n")[0] as string });
      else if ("identity" in a) got.set(a.key, a.identity);
    });
    process.stderr.write(`identity: ${label}: ${got.size} item(s) hashed\n`);
    return got;
  };
  const before = await run(baseDir, `at ${values.base}`);
  const after = await run(treeDir, "the tree");
  const { lines, same } = identityLines(values.base, { before, after }, holdout);
  process.stdout.write([...lines, same ? "Everything hashed is the same: a move." : "Something differs: not a move (or a change the snapshots then say moved nothing)."].join("\n") + "\n");
  return same ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (printHelp(argv, import.meta.url)) process.exit(0);
  if (testLockFile() && !argv.includes("--tree")) {
    // The tree fixed now (at-commit.ts snapshotCommit), then this script again under the lock (a short job).
    const snap = snapshotCommit(ROOT);
    process.stderr.write(`identity: the tree is fixed at queue time (${snap.dirty ? `a snapshot, ${snap.commit.slice(0, 9)}` : `HEAD ${snap.head.slice(0, 9)}`}): keep editing while it waits\n`);
    void runLockedAsync([process.execPath, fileURLToPath(import.meta.url), ...argv, "--tree", snap.commit.slice(0, 12)], { kind: "short", who: "identity", done: "identity" }).then((c) => (process.exitCode = c));
  } else {
    main(argv).then(
      (code) => {
        process.stdout.write(`EFSIM-DONE identity ${code === 0 ? "same" : "differ"}\n`);
        process.exitCode = code;
      },
      (e: unknown) => {
        process.stderr.write(`identity: ${e instanceof Error ? e.message : String(e)}\n`);
        process.stdout.write("EFSIM-DONE identity fail\n");
        process.exitCode = 2;
      },
    );
  }
}
