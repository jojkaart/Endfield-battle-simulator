// Measures a change on the log checks without rewriting anything: runs the checks the log verdict snapshots record
// (the verified, pending and hold-out logs, or a selection) on worker threads, writes what the snapshot files and the
// scoreboard would become into a scratch directory, and prints the scoreboard's change and each log's direction
// (better / worse by the fit measure) against the snapshots committed at a ref, as `npm run snapshots:update` does at
// its end. Nothing tracked is written: run it as often as an idea needs, then `npm run snapshots:update` once for the
// final commit.
//
// Logs not measured (with a selection) keep the reference snapshot's entry on both sides, so the comparison shows
// only the measured logs' moves; the scoreboard written is then an estimate (exact when every log is measured).
// Hold-out logs are measured like the others and only ever counted in aggregate: never named, never printed.
//
// Usage: node scripts/measure.ts [options]                         (npm run measure -- [options])
//   --at <ref>          measure that commit's code (a worktree under scratch/at/: scripts/at-commit.ts), not the
//                       working tree; commit work in progress, then `--at HEAD` keeps the working tree editable
//   --against <ref>     compare with the snapshots committed at <ref> (default: the --at ref, else HEAD)
//   --base <ref>        measure <ref>'s code too, on the same logs, and compare the two measurements (A/B of two
//                       commits' code, whatever their committed snapshots say)
//   --with <operator>   only logs whose team has it (operator id, or part of the id or name; repeatable: any of them)
//   --logs <id,…>       only these logs (ids or unique parts of them; never a hold-out)
//   --changed placement only logs whose placed casts (placeHits) differ between the measured code and the --base /
//                       --against ref's code (seconds per log, then only those are checked)
//   --assume <id>=<r>   replay under another reading of a kit's or the engine's open assumption (e.g.
//                       control-immunity=bosses; repeatable): the reading's effect against the reference
//   --workers <n>       worker threads (default 3, as test:logs)
//   --out <dir>         where to write (default scratch/measure/<time>/): log-verdicts.json,
//                       log-verdicts-pending.json, accuracy.md, summary.txt
//
// It takes the test lock as a short job (scripts/testlock.ts: the side lane, beside a long rule search but not beside a
// premerge or test suite), writes its run state to scratch/runs/measure.json and ends with `EFSIM-DONE measure pass`
// (or `fail`; `killed` when a signal stopped it, waiting included). A full run takes the pending suite's check time over the workers
// (about 1.5–2 min on 3 workers when the machine is quiet); `--with` or `--changed` a fraction of it.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { compare, readSplit, render, snapshotsAt, type Entries, type Entry, type Snapshots } from "./accuracy.ts";
import { atCommit } from "./at-commit.ts";
import type { MeasureAnswer, MeasureJob } from "./measure-worker.ts";
import { endRun, startRun } from "./runstate.ts";
import { runLockedAsync, testLockFile } from "./testlock.ts";
import { formatSnapshot } from "../tests/snapshot.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIED = "log-verdicts.json";
const PENDING = "log-verdicts-pending.json";

/** The logs a checkout's verdict snapshots cover, as keys under fixtures/: verified, pending, hold-out. */
export function logKeys(tree: string): string[] {
  const dir = (sub: string) => {
    const d = join(tree, "fixtures", sub);
    if (!existsSync(d)) return [];
    return readdirSync(d)
      .filter((f) => f.startsWith("zmdlogs-") && f.endsWith(".json"))
      .map((f) => (sub ? `${sub}/${f}` : f));
  };
  return [...dir(""), ...dir("pending"), ...dir("holdout")].sort();
}

const isHoldout = (key: string) => key.startsWith("holdout/");
const idOf = (key: string) => (key.split("/").pop() as string).replace(/\.json$/, "");

/** `--logs` values matched to keys: each must name exactly one log, and never a hold-out. */
export function selectLogs(keys: readonly string[], wanted: readonly string[], holdoutIds: ReadonlySet<string>): string[] {
  return wanted.map((w) => {
    const id = w.replace(/\.json$/, "").split("/").pop() as string;
    if ([...holdoutIds].some((h) => h.includes(id)) || keys.some((k) => isHoldout(k) && idOf(k).includes(id))) throw new Error(`--logs ${w}: names a hold-out log (never measured by name: docs/accuracy-plan.md, "Choosing logs"); give more of the id`);
    const hits = keys.filter((k) => idOf(k).includes(id));
    if (hits.length !== 1) throw new Error(`--logs ${w}: ${hits.length ? `${hits.length} logs match (${hits.join(", ")})` : "no development or verified log matches"}`);
    return hits[0] as string;
  });
}

/** Snapshots with the measured entries put in place of the reference's (a hold-out under its current key only). */
export function overlay(base: Snapshots, measured: ReadonlyMap<string, Entry>, split = base.split): Snapshots {
  const verified = new Map(Object.entries(base.verified));
  const pending = new Map(Object.entries(base.pending));
  for (const [k, e] of measured) {
    if (!k.includes("/")) verified.set(k, e);
    else {
      if (isHoldout(k)) pending.delete(k.replace(/^holdout\//, "pending/"));
      pending.set(k, e);
    }
  }
  return { verified: Object.fromEntries(verified), pending: Object.fromEntries(pending), split };
}

/** Runs jobs on worker threads loading `tree`'s code; each answer to `done` as it comes. */
async function pool(tree: string, jobs: readonly MeasureJob[], workers: number, done: (a: MeasureAnswer) => void, assume: Readonly<Record<string, string>> = {}): Promise<void> {
  const queue = [...jobs];
  const url = new URL("./measure-worker.ts", import.meta.url);
  await Promise.all(
    Array.from({ length: Math.min(workers, queue.length) }, () => {
      const w = new Worker(url, { workerData: { tree, assume } });
      return new Promise<void>((res, rej) => {
        const next = () => {
          const job = queue.shift();
          if (job) w.postMessage(job);
          else void w.terminate().then(() => res());
        };
        w.on("message", (m: MeasureAnswer | { ready: true }) => {
          try {
            if (!("ready" in m)) done(m);
          } catch (e) {
            queue.length = 0;
            void w.terminate();
            rej(e);
            return;
          }
          next();
        });
        w.on("error", rej);
      });
    }),
  );
}

/** The cost of checking a log, for the largest-first order: its time in the last balanced run, else its hit count. */
function costs(tree: string, keys: readonly string[]): Map<string, number> {
  const file = join(tree, "tests/slow/pending-costs.json");
  const measured = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, number>) : {};
  return new Map(keys.map((k) => [k, measured[k] ?? (JSON.parse(readFileSync(join(tree, "fixtures", k), "utf8")) as { hits: unknown[] }).hits.length / 20]));
}

/** The teams of the logs (operator ids), read from the fixtures themselves. */
const teamOf = (tree: string, key: string) => (JSON.parse(readFileSync(join(tree, "fixtures", key), "utf8")) as { team: { operator: string }[] }).team.map((b) => b.operator);

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      at: { type: "string" },
      against: { type: "string" },
      base: { type: "string" },
      with: { type: "string", multiple: true, default: [] },
      logs: { type: "string", multiple: true, default: [] },
      changed: { type: "string" },
      assume: { type: "string", multiple: true, default: [] },
      workers: { type: "string", default: String(Math.min(3, Math.max(1, cpus().length - 1))) },
      out: { type: "string" },
    },
  });
  if (values.changed !== undefined && values.changed !== "placement") throw new Error("--changed takes placement");
  const workers = Number(values.workers);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const say = (l: string) => process.stdout.write(l + "\n");

  const tree = values.at ? resolve(ROOT, "scratch/at", git(["rev-parse", "--short=9", "--verify", `${values.at}^{commit}`])) : ROOT;
  if (values.at) atCommit(values.at, tree);
  const against = values.base ?? values.against ?? values.at ?? "HEAD";
  const baseTree = values.base ? resolve(ROOT, "scratch/at", git(["rev-parse", "--short=9", "--verify", `${values.base}^{commit}`])) : undefined;
  if (values.base && baseTree) atCommit(values.base, baseTree);
  const assume = Object.fromEntries(values.assume.map((a) => {
    const [id, reading] = a.split("=");
    if (!id || !reading) throw new Error("--assume takes <id>=<reading>");
    return [id, reading];
  }));
  const what = `${values.at ? `the code at ${values.at}` : "the working tree"}${values.assume.length ? ` under ${values.assume.join(", ")}` : ""}${values.base ? ` against the code at ${values.base}` : ` against the snapshots at ${against}`}`;

  // The selection.
  const split = readSplit(readFileSync(join(tree, "fixtures/holdout/holdout.json"), "utf8"));
  let keys = logKeys(tree);
  if (values.logs.length) keys = selectLogs(keys, values.logs.flatMap((x) => x.split(",")).filter(Boolean), split.holdout);
  if (values.with.length) {
    const { loadGameData } = await import("@efsim/data");
    const ops = loadGameData().operators as Record<string, { name?: string }>;
    const matches = (op: string) => values.with.some((w) => op === w || op.includes(w) || (ops[op]?.name ?? "").toLowerCase().includes(w.toLowerCase()));
    keys = keys.filter((k) => teamOf(tree, k).some(matches));
  }
  if (values.changed === "placement") {
    const other = baseTree ?? resolve(ROOT, "scratch/at", git(["rev-parse", "--short=9", "--verify", `${against}^{commit}`]));
    if (!baseTree) atCommit(against, other);
    const sig = async (t: string) => {
      const out = new Map<string, string>();
      await pool(t, keys.map((key) => ({ key, what: "placement" as const })), workers, (a) => {
        if ("error" in a) throw new Error(`placement of ${isHoldout(a.key) ? "a hold-out log" : a.key}: ${a.error}`);
        if ("placement" in a) out.set(a.key, a.placement);
      });
      return out;
    };
    const [now, then] = [await sig(tree), await sig(other)];
    const before = keys.length;
    keys = keys.filter((k) => now.get(k) !== then.get(k));
    say(`measure: ${keys.length} of ${before} logs' placed casts differ from ${values.base ?? against}'s code`);
  }
  if (!keys.length) {
    say("measure: no log selected");
    return 0;
  }

  const out = resolve(values.out ?? join(ROOT, "scratch/measure", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)));
  mkdirSync(out, { recursive: true });
  const shown = keys.filter((k) => !isHoldout(k)).length;
  say(`measure: ${what}: ${keys.length} logs (${keys.length - shown} of them hold-outs, counted only), ${workers} workers; writing to ${out}`);

  const cost = costs(tree, keys);
  const order = [...keys].sort((a, b) => (cost.get(b) as number) - (cost.get(a) as number) || a.localeCompare(b));
  const measureTree = async (t: string, label: string) => {
    const got = new Map<string, Entry>();
    const start = performance.now();
    await pool(t, order.map((key) => ({ key, what: "entry" as const })), workers, (a) => {
      if ("error" in a) throw new Error(`${isHoldout(a.key) ? "a hold-out log" : a.key}: ${a.error}`);
      if (!("entry" in a)) return;
      got.set(a.key, a.entry);
      say(`[${got.size}/${keys.length}] ${label}${isHoldout(a.key) ? "a hold-out log" : `${a.key} ${a.seconds.toFixed(1)} s`}`);
    }, t === tree ? assume : {});
    say(`measure: ${label || "measured "}${got.size} logs in ${((performance.now() - start) / 1000).toFixed(0)} s`);
    return got;
  };
  const measured = await measureTree(tree, "");
  const reference = snapshotsAt(against);
  const before = baseTree ? overlay(reference, await measureTree(baseTree, `base ${values.base}: `)) : reference;
  const after = overlay(before, measured, split);

  writeFileSync(join(out, VERIFIED), formatSnapshot(after.verified as Entries, true));
  writeFileSync(join(out, PENDING), formatSnapshot(after.pending as Entries, true));
  writeFileSync(join(out, "accuracy.md"), render(after));
  const lines = [`Accuracy of ${what} (${keys.length} logs measured${keys.length < logKeys(tree).length ? "; the rest as the reference has them" : ""}):`, ...compare(before, after)];
  if (keys.length === logKeys(tree).length && !baseTree) {
    const same = [VERIFIED, PENDING].every((f) => readFileSync(join(out, f), "utf8") === readTracked(tree, `tests/snapshots/${f}`));
    lines.push(same ? "The log verdict snapshots would stay as they are (byte for byte)." : "The log verdict snapshots would change: `npm run snapshots:update` before committing.");
  }
  writeFileSync(join(out, "summary.txt"), lines.join("\n") + "\n");
  say("");
  for (const l of lines) say(l);
  return 0;
}

const readTracked = (tree: string, rel: string) => (existsSync(join(tree, rel)) ? readFileSync(join(tree, rel), "utf8") : "");

function git(args: readonly string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (testLockFile()) {
    // Under the test lock as a job (a queue: premerges and test suites go first), then this script again inside it.
    // A short job: the side lane, beside a long rule search, never beside a premerge or test suite (testlock.ts).
    void runLockedAsync([process.execPath, fileURLToPath(import.meta.url), ...argv], { kind: "short", who: "measure", done: "measure" }).then((c) => (process.exitCode = c));
  } else {
    startRun("measure", argv.join(" "));
    main(argv).then(
      (code) => {
        endRun("measure", code === 0 ? "pass" : "fail");
        process.stdout.write(`EFSIM-DONE measure ${code === 0 ? "pass" : "fail"}\n`);
        process.exitCode = code;
      },
      (e: unknown) => {
        process.stderr.write(`measure: ${e instanceof Error ? e.message : String(e)}\n`);
        endRun("measure", "fail");
        process.stdout.write("EFSIM-DONE measure fail\n");
        process.exitCode = 1;
      },
    );
  }
}
