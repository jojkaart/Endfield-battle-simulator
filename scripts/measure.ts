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
//   --against <ref>     compare with the snapshots committed at <ref> (default: the --at ref, else HEAD); when the code
//                       changed since those snapshots were written, the summary's first line says so (it then mixes
//                       those commits' changes in: --base HEAD measures the tree's change alone)
//   --base <ref>        measure <ref>'s code too, on the same logs, and compare the two measurements (A/B of two
//                       commits' code, whatever their committed snapshots say)
//   --with <operator>   only logs whose team has it (operator id, or part of the id or name; repeatable: any of them)
//   --logs <id,…>       only these logs (ids or unique parts of them; never a hold-out)
//   --changed placement only logs whose placed casts (placeHits) differ between the measured code and the --base /
//                       --against ref's code (seconds per log, then only those are checked); prints, per
//                       development log, the casts placed only before (-) and only now (+)
//   --assume <id>=<r>   replay under another reading of a kit's or the engine's open assumption (e.g.
//                       control-immunity=bosses; repeatable): the reading's effect against the reference
//   --variant <id>=<r>[,<id>=<r>…]  measure once per --variant (repeatable; each on top of --assume), all of the
//                       same code and against the same reference, in one run and one snapshot: the summary per
//                       variant, files under <out>/variant-<n>/ (separating two readings' effects without chaining
//                       measures, each taking its own snapshot); the same code without any variant is measured too
//                       (round 11), and each variant's summary also says what it moves against that plain tree, the
//                       question an idea on top of the tree asks (--no-plain: skip that run)
//   --split files|commits  after the whole change against --base (default HEAD: the working tree's change), the
//                       share of each part (round 11: "which change moved this log" took three more measures): files,
//                       each changed file's diff alone on --base (`--group a,b` puts the files under these path
//                       prefixes into one part; repeatable); commits, each commit of --base..the code against its
//                       parent (the working tree's own changes the last). Each part is measured only on the logs the
//                       whole change moved, so a split costs about one measure of those per part. Not with --variant,
//                       --patch or --live
//   --patch <file>      measure the code with this diff applied on top (git apply; the code at --at, else the tree
//                       as queued): one half of a change, or the old reading of a log tool's rule, without editing
//                       and reverting the tree (round 8). The diff is copied at queue time; with --base HEAD the
//                       patch's own effect. Not with --live
//   --no-negative       skip the negative control (by default the verified logs measured are also checked with
//                       every value ×0.97 and ×1.03, as tests/slow/negative-control.test.ts does, and a count over
//                       its bound is flagged: a reading fitted to the data it is judged on shows at the first
//                       measure, not at premerge; seconds)
// The summary also counts the logs whose listed effects carry no since / source (imported before 2026-11-16; hold-outs
// as a count only): a change that rests on the log's lanes can't move them, so "unchanged" there means untested.
//   --workers <n>       worker threads (default 3, as test:logs)
//   --hits              also list, for each development log whose entry moved, the hits whose verdict changed
//                       (time, operator, event, verdict and logged ÷ primary before and after; the reference's code
//                       is measured for those logs when there is no --base: the code of the commit that wrote the
//                       reference's snapshots, not a later code-only commit, which would be the measured code
//                       itself and show no hit changed): a few per change in the summary, every
//                       one in <out>/hits.txt. Hold-outs never. A log new since the reference (or --base) commit
//                       is measured there on this tree's copy of the fixture. Also, per such log, the placed hidden
//                       holds' units that moved (zmdlogs holds' unit lines: placed, earliest, latest), the commonest
//                       cause of a small worse log ("the holds placed again")
//   --live              read the working tree when the run starts (after the queue's wait), not as it was queued
//   --out <dir>         where to write (default scratch/measure/<time>/): log-verdicts.json,
//                       log-verdicts-pending.json, log-verdicts-holdout.json (never diff it by eye), accuracy.md,
//                       summary.txt
//
// The working tree is measured as it was when the run was queued: a snapshot commit of it (tracked changes and new
// files, scripts/at-commit.ts snapshotCommit; the branch and index untouched) in its own worktree under scratch/at/,
// removed after; so edits during the queue's wait don't reach the run (round 5). Run it in the background (CLAUDE.md
// "Long runs") and keep working.
//
// It takes the test lock as a short job (scripts/testlock.ts: the side lane, beside a long rule search but not beside a
// premerge or test suite), writes its run state to scratch/runs/measure.json and ends with `EFSIM-DONE measure pass`
// (or `fail`; `killed` when a signal stopped it, waiting included). A full run takes the pending suite's check time over the workers
// (about 1.5–2 min on 3 workers when the machine is quiet); `--with` or `--changed` a fraction of it.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { allLogs, compare, direction, GROUPS, groupOf, readSplit, render, snapshotsAt, splitPending, type Entries, type Entry, type Snapshots, type Split } from "./accuracy.ts";
import { atCommit, removeAtCommit, snapshotCommit } from "./at-commit.ts";
import type { HitRow, HoldUnit, MeasureAnswer, MeasureJob, NegativeCount, PerHit, ShareKind, Shares } from "./measure-worker.ts";
import { endRun, startRun } from "./runstate.ts";
import { runLockedAsync, testLockFile } from "./testlock.ts";
import { formatSnapshot } from "../tests/snapshot.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIED = "log-verdicts.json";
const PENDING = "log-verdicts-pending.json";
const HOLDOUT = "log-verdicts-holdout.json";

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

/**
 * `--logs` values matched to keys: each must name exactly one log, and never a hold-out. A part matches the start of
 * an id first ("9c0b" is 9c0b…, not 489c0be3…: the docs name a log by its first four hex digits, as resolveFixture
 * does), and only where no id starts with it anywhere inside one; a part inside a hold-out's id still refuses.
 */
export function selectLogs(keys: readonly string[], wanted: readonly string[], holdoutIds: ReadonlySet<string>): string[] {
  const bare = (id: string) => id.replace(/^zmdlogs-/, "");
  return wanted.map((w) => {
    const id = w.replace(/\.json$/, "").split("/").pop() as string;
    if ([...holdoutIds].some((h) => h.includes(id)) || keys.some((k) => isHoldout(k) && idOf(k).includes(id))) throw new Error(`--logs ${w}: names a hold-out log (never measured by name: docs/accuracy-plan.md, "Choosing logs"); give more of the id`);
    const prefixed = keys.filter((k) => bare(idOf(k)).startsWith(bare(id)) || idOf(k).startsWith(id));
    const hits = prefixed.length ? prefixed : keys.filter((k) => idOf(k).includes(id));
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
      hits: { type: "boolean", default: false },
      variant: { type: "string", multiple: true, default: [] },
      negative: { type: "boolean", default: true },
      live: { type: "boolean", default: false },
      snapshot: { type: "string" },
      "snapshot-head": { type: "string" },
      patch: { type: "string" },
      plain: { type: "boolean", default: true },
      split: { type: "string" },
      group: { type: "string", multiple: true, default: [] },
    },
    allowNegative: true,
  });
  if (values.changed !== undefined && values.changed !== "placement") throw new Error("--changed takes placement");
  if (values.split !== undefined) {
    if (values.split !== "files" && values.split !== "commits") throw new Error("--split takes files or commits");
    if (values.variant.length || values.patch !== undefined || values.live) throw new Error("--split measures the code's own parts: not with --variant, --patch or --live");
    if (values.at !== undefined && values.base === undefined) throw new Error("--split with --at needs --base <ref> (the commit the parts are split against)");
    // The working tree's change (the snapshot taken at queue time) against HEAD, unless --base names another commit.
    values.base ??= "HEAD";
  }
  if (values.group.length && values.split !== "files") throw new Error("--group goes with --split files");
  const workers = Number(values.workers);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  const say = (l: string) => process.stdout.write(l + "\n");

  // The code: --at's commit, the snapshot taken when the run was queued (the entry point below), or the tree as it is now;
  // with --patch, that commit with the diff applied in a worktree of its own (removed after).
  if (values.patch !== undefined && values.live) throw new Error("--patch applies to a commit (--at, or the tree as queued): not with --live");
  const at = values.at ?? values.snapshot ?? (values.patch !== undefined ? "HEAD" : undefined);
  const tree = at ? resolve(ROOT, "scratch/at", `${values.at && values.patch === undefined ? "" : "measure-"}${git(["rev-parse", "--short=9", "--verify", `${at}^{commit}`])}${values.patch !== undefined ? `-patch-${process.pid}` : ""}`) : ROOT;
  const ownTree = (values.patch !== undefined || (values.at === undefined && values.snapshot !== undefined)) && !existsSync(tree);
  if (at) atCommit(at, tree, values.patch);
  if (ownTree) {
    // The snapshot's worktree goes when the run ends, a signal included (testlock.ts passes a kill on).
    process.on("exit", () => removeAtCommit(tree));
    for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => process.exit(1));
  }
  const against = values.base ?? values.against ?? values.at ?? values["snapshot-head"] ?? "HEAD";
  const baseTree = values.base ? resolve(ROOT, "scratch/at", git(["rev-parse", "--short=9", "--verify", `${values.base}^{commit}`])) : undefined;
  if (values.base && baseTree) atCommit(values.base, baseTree);
  const assume = parseReadings(values.assume);
  const short = (ref: string) => git(["rev-parse", "--short=9", ref]);
  const snapshot = values.snapshot && !values.at ? values.snapshot : undefined;
  const code = values.at
    ? `the code at ${values.at}`
    : snapshot
      ? snapshot === values["snapshot-head"]
        ? `the code at HEAD (${short(snapshot)}; the tree was clean when queued)`
        : `the working tree as queued (snapshot ${short(snapshot)} on ${short(values["snapshot-head"] ?? "HEAD")})`
      : "the working tree";
  const patched = values.patch !== undefined ? `${code} with ${values.patch} applied` : code;
  const what = `${patched}${values.assume.length ? ` under ${values.assume.join(", ")}` : ""}${values.base ? ` against the code at ${values.base}` : ` against the snapshots at ${against}`}`;
  // The reference's own code (placement-leads report point 3): after a code commit the snapshots at HEAD aren't HEAD's
  // code, so "against the snapshots" mixes those commits' changes into this tree's. Said first, in the summary too.
  const referenceLine = values.base ? [] : referenceNote(against, snapshotWriter(against), short);

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
      const out = new Map<string, { placement: string; casts?: readonly string[] }>();
      await pool(t, keys.map((key) => ({ key, what: "placement" as const, ...(isHoldout(key) ? {} : { hits: true }) })), workers, (a) => {
        if ("error" in a) throw new Error(`placement of ${isHoldout(a.key) ? "a hold-out log" : a.key}: ${a.error}`);
        if ("placement" in a) out.set(a.key, a);
      });
      return out;
    };
    const [now, then] = [await sig(tree), await sig(other)];
    const before = keys.length;
    keys = keys.filter((k) => now.get(k)?.placement !== then.get(k)?.placement);
    say(`measure: ${keys.length} of ${before} logs' placed casts differ from ${values.base ?? against}'s code`);
    for (const l of movedCasts(keys.filter((k) => !isHoldout(k)), new Map([...then].map(([k, v]) => [k, v.casts ?? []])), new Map([...now].map(([k, v]) => [k, v.casts ?? []])))) say(l);
  }
  if (!keys.length) {
    say("measure: no log selected");
    return 0;
  }

  const out = resolve(values.out ?? join(ROOT, "scratch/measure", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)));
  mkdirSync(out, { recursive: true });
  const shown = keys.filter((k) => !isHoldout(k)).length;
  say(`measure: ${what}: ${keys.length} logs (${keys.length - shown} of them hold-outs, counted only), ${workers} workers; writing to ${out}`);
  for (const l of referenceLine) say(`measure: ${l}`);

  const cost = costs(tree, keys);
  const order = [...keys].sort((a, b) => (cost.get(b) as number) - (cost.get(a) as number) || a.localeCompare(b));
  // The logs whose listed effects have no `since` / `source` (imported before 2026-11-16): a change resting on the
  // lanes can't move them, so "unchanged" there means untested (buff-clock report point 5). Hold-outs only counted.
  const untimed = new Set<string>();
  const untimedLine = (): string[] => {
    const hold = [...untimed].filter(isHoldout).length;
    const dev = [...untimed].filter((k) => !isHoldout(k)).sort();
    return untimed.size ? [`Logs whose effects carry no since / source (a change resting on the lanes can't move them): ${hold} of ${keys.filter(isHoldout).length} hold-outs measured${dev.length ? `; ${dev.join(", ")}` : ""}`] : [];
  };
  const perHit = new Map<string, Map<string, PerHit>>();
  const hitRows = new Map<string, Map<string, readonly HitRow[]>>();
  const holdRows = new Map<string, Map<string, readonly HoldUnit[]>>();
  const sharesBy = new Map<string, Map<string, Shares>>();
  // Per tree and readings (`slot`: a --variant's measurements of the same tree apart).
  const measureTree = async (t: string, label: string, which: readonly string[] = order, readings: Readonly<Record<string, string>> = t === tree ? assume : {}, slot = t) => {
    const got = new Map<string, Entry>();
    const fits = perHit.get(slot) ?? new Map<string, PerHit>();
    perHit.set(slot, fits);
    const rows = hitRows.get(slot) ?? new Map<string, readonly HitRow[]>();
    hitRows.set(slot, rows);
    const holds = holdRows.get(slot) ?? new Map<string, readonly HoldUnit[]>();
    holdRows.set(slot, holds);
    const shares = sharesBy.get(slot) ?? new Map<string, Shares>();
    sharesBy.set(slot, shares);
    const start = performance.now();
    // A log new since that commit (an import on this branch): its code reads the measured tree's copy of the fixture.
    const fresh = new Set(t === tree ? [] : which.filter((k) => !existsSync(join(t, "fixtures", k))));
    if (fresh.size) say(`measure: ${label}${fresh.size} log(s) new since that commit, read from the measured tree: ${[...fresh].map((k) => (isHoldout(k) ? "a hold-out log" : k)).join(", ")}`);
    await pool(t, which.map((key) => ({ key, what: "entry" as const, ...(values.hits && !isHoldout(key) ? { hits: true } : {}), ...(fresh.has(key) ? { fixtures: join(tree, "fixtures") } : {}) })), workers, (a) => {
      if ("error" in a && fresh.has(a.key)) {
        // The older code can't read a newer fixture (its schema, say): the log stays "new" on that side.
        say(`measure: ${label}${isHoldout(a.key) ? "a hold-out log" : a.key} not measured (new since that commit and its code can't read it: ${a.error.split("\n")[0]})`);
        return;
      }
      if ("error" in a) throw new Error(`${isHoldout(a.key) ? "a hold-out log" : a.key}: ${a.error}`);
      if (!("entry" in a)) return;
      got.set(a.key, a.entry);
      if (a.untimed) untimed.add(a.key);
      if (a.perHit) fits.set(a.key, a.perHit);
      if (a.hits) rows.set(a.key, a.hits);
      if (a.holds) holds.set(a.key, a.holds);
      if (a.shares) shares.set(a.key, a.shares);
      say(`[${got.size}/${which.length}] ${label}${isHoldout(a.key) ? "a hold-out log" : `${a.key} ${a.seconds.toFixed(1)} s`}`);
    }, readings);
    say(`measure: ${label || "measured "}${got.size} logs in ${((performance.now() - start) / 1000).toFixed(0)} s`);
    return got;
  };
  // The negative control (tests/slow/negative-control.test.ts) on the verified logs measured: a reading fitted to the
  // data it is judged on shows here at the first measure, not at premerge's test:logs (hold-clocks report point 4).
  const negativeLines = async (readings: Readonly<Record<string, string>>, label: string): Promise<string[]> => {
    const verified = keys.filter((k) => !k.includes("/"));
    if (!values.negative || !verified.length) return [];
    const counts = new Map<string, readonly NegativeCount[]>();
    await pool(tree, verified.map((key) => ({ key, what: "negative" as const, factors: NEGATIVE_FACTORS })), workers, (a) => {
      if ("error" in a) throw new Error(`negative control of ${a.key}: ${a.error}`);
      if ("negative" in a) counts.set(a.key, a.negative);
    }, readings);
    say(`measure: ${label}negative control on ${counts.size} verified log(s)`);
    return negativeControl(counts);
  };
  const variants = values.variant.length ? values.variant.map((v) => ({ text: v, readings: { ...assume, ...parseReadings(v.split(",")) } })) : [{ text: "", readings: assume }];
  const entryOf = (s: Snapshots, k: string) => (k.includes("/") ? s.pending[k] : s.verified[k]);
  const reference = snapshotsAt(against);
  let before: Snapshots | undefined;
  // The per-hit reference (mixed logs, --hits): --base's code, else the code that wrote the snapshots at `against`
  // (hold-clocks report point 2: after a code-only commit, HEAD's code is the measured code itself).
  let refTree = baseTree;
  let refLabel = values.base ?? against;
  const allLines: string[] = [];
  // With --variant: the same code under --assume alone, each variant's summary also against it (placement-leads report
  // point 3: a first --variant run compared against the snapshots mixed the tree's own change into each variant's).
  let plain: Snapshots | undefined;
  let whole: Snapshots | undefined;
  for (const [vi, v] of variants.entries()) {
    const label = variants.length > 1 || values.variant.length ? `variant ${vi + 1} (${v.text}): ` : "";
    const dir = variants.length > 1 ? join(out, `variant-${vi + 1}`) : out;
    mkdirSync(dir, { recursive: true });
    const measured = await measureTree(tree, label, order, v.readings, `${tree}#${vi}`);
    before ??= baseTree ? overlay(reference, await measureTree(baseTree, `base ${values.base}: `)) : reference;
    if (values.variant.length && values.plain && !plain) plain = overlay(before, await measureTree(tree, "plain (no variant): ", order, assume, `${tree}#plain`), split);
    const after = overlay(before, measured, split);
    whole ??= after;
    // The mixed logs' per-hit fit on both sides (the reference's code measured for them alone when it wasn't already).
    const mixed = keys.filter((k) => {
      const [a, b] = [entryOf(before as Snapshots, k), entryOf(after, k)];
      return a !== undefined && b !== undefined && direction(a, b) === "mixed";
    });
    // --hits: the development logs whose entry moved, hit by hit.
    const moved = values.hits ? keys.filter((k) => !isHoldout(k) && JSON.stringify(entryOf(before as Snapshots, k)) !== JSON.stringify(entryOf(after, k))) : [];
    if ((mixed.length || moved.length) && !baseTree) {
      if (!refTree) {
        const writer = snapshotWriter(against);
        if (writer.commit !== git(["rev-parse", `${against}^{commit}`])) {
          say(`measure: the snapshots at ${against} were written at ${short(writer.commit)}, and ${writer.changed} code file(s) changed since: the per-hit reference runs ${short(writer.commit)}'s code (--base <ref> for another)`);
          refLabel = short(writer.commit);
        }
        refTree = resolve(ROOT, "scratch/at", short(writer.commit));
        atCommit(writer.commit, refTree);
      }
      const done = perHit.get(refTree) ?? new Map();
      const which = [...new Set([...mixed, ...moved])].filter((k) => !done.has(k));
      if (which.length) {
        say(`measure: ${which.length} log(s) mixed${values.hits ? " or moved (--hits)" : ""}: their per-hit fit at ${refLabel}'s code`);
        await measureTree(refTree, `reference ${refLabel}: `, which);
      }
    }
    const mixedLines = mixedPerHit(mixed, (refTree && perHit.get(refTree)) || new Map(), perHit.get(`${tree}#${vi}`) ?? new Map());
    const hitLines = values.hits ? hitChanges(moved, (refTree && hitRows.get(refTree)) || new Map(), hitRows.get(`${tree}#${vi}`) ?? new Map()) : undefined;
    const holdLines = values.hits ? holdChanges(moved, (refTree && holdRows.get(refTree)) || new Map(), holdRows.get(`${tree}#${vi}`) ?? new Map()) : undefined;
    if (hitLines?.full.length || holdLines?.full.length) writeFileSync(join(dir, "hits.txt"), [...(hitLines?.full ?? []), ...(holdLines?.full.length ? ["", "Hidden holds:", ...holdLines.full] : [])].join("\n") + "\n");

    writeFileSync(join(dir, VERIFIED), formatSnapshot(after.verified as Entries, true));
    const files = splitPending(after.pending);
    writeFileSync(join(dir, PENDING), formatSnapshot(files.pending, true));
    writeFileSync(join(dir, HOLDOUT), formatSnapshot(files.holdout, true));
    writeFileSync(join(dir, "accuracy.md"), render(after));
    const lines = [
      ...(vi === 0 ? referenceLine : []),
      `Accuracy of ${what}${v.text ? `, variant ${vi + 1} under ${v.text}` : ""} (${keys.length} logs measured${keys.length < logKeys(tree).length ? "; the rest as the reference has them" : ""}):`,
      ...compare(before, after),
      ...(plain ? [`Variant ${vi + 1} against the plain tree (the same code${values.assume.length ? ` under ${values.assume.join(", ")}` : ""}, no variant): the variant's own effect`, ...compare(plain, after).map((l) => `  ${l}`)] : []),
      ...mixedLines,
      ...(hitLines ? [...hitLines.summary, ...(hitLines.full.length ? [`  (every changed hit: ${join(dir, "hits.txt")})`] : [])] : []),
      ...(holdLines?.summary ?? []),
      ...sharesLines(sharesBy.get(`${tree}#${vi}`) ?? new Map(), split, baseTree ? sharesBy.get(baseTree) : undefined, baseTree ? `base ${values.base}` : undefined),
      ...kindLines(sharesBy.get(`${tree}#${vi}`) ?? new Map(), split, baseTree ? sharesBy.get(baseTree) : undefined, baseTree ? `base ${values.base}` : undefined),
      ...(await negativeLines(v.readings, label)),
      ...(vi === 0 ? untimedLine() : []),
    ];
    if (keys.length === logKeys(tree).length && !baseTree) {
      const same = [VERIFIED, PENDING, HOLDOUT].every((f) => readFileSync(join(dir, f), "utf8") === readTracked(tree, `tests/snapshots/${f}`));
      lines.push(same ? "The log verdict snapshots would stay as they are (byte for byte)." : "The log verdict snapshots would change: `npm run snapshots:update` before committing.");
    }
    writeFileSync(join(dir, "summary.txt"), lines.join("\n") + "\n");
    allLines.push(...(allLines.length ? [""] : []), ...lines);
  }
  if (values.split !== undefined && baseTree && before && whole) {
    const lines = await splitParts(values.split, { base: values.base as string, baseTree, code: values.at ?? snapshot ?? snapshotCommit(ROOT).commit, groups: values.group, keys: order, before, whole, split, measure: (t, label, which) => measureTree(t, label, which, assume, `${t}#split`) });
    writeFileSync(join(out, "summary.txt"), [...allLines, "", ...lines].join("\n") + "\n");
    allLines.push("", ...lines);
  }
  if (variants.length > 1) writeFileSync(join(out, "summary.txt"), allLines.join("\n") + "\n");
  say("");
  for (const l of allLines) say(l);
  return 0;
}

/**
 * The measured fights' totals by where the error lives (TotalsShares: matched scale, replay-only and log-only landings,
 * as % of each fight's logged total), averaged per scoreboard group: the hold-outs' only view of it (never per log).
 * With `before` (a --base measurement) each mean as before → after. `zmdlogs totals --all` gives the development rows.
 */
export function sharesLines(after: ReadonlyMap<string, Shares>, split: Split, before?: ReadonlyMap<string, Shares>, beforeLabel?: string): string[] {
  if (!after.size) return [];
  const agg = (m: ReadonlyMap<string, Shares>, g: string) => {
    const xs = [...m].filter(([k]) => groupOf(k, split) === g).map(([, x]) => x);
    const mean = (f: (x: Shares) => number) => (xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : 0);
    return { n: xs.length, error: mean((x) => Math.abs(x.error)), matched: mean((x) => Math.abs(x.matched)), replayOnly: mean((x) => x.replayOnly), logOnly: mean((x) => -x.logOnly), oneSided: xs.filter((x) => x.replayOnly - x.logOnly > Math.abs(x.matched)).length };
  };
  const out = [`Totals by where the error lives (mean shares of each fight's logged total: |error|, |matched|, replay-only, log-only; one-sided: replay-only + log-only over |matched|; zmdlogs totals --all for the development rows)${before ? `, ${beforeLabel ?? "base"} → measured` : ""}:`];
  for (const g of GROUPS) {
    const a = agg(after, g);
    if (!a.n) continue;
    const b = before ? agg(before, g) : undefined;
    const f = (k: "error" | "matched" | "replayOnly" | "logOnly") => `${b && b.n ? `${b[k].toFixed(1)} → ` : ""}${a[k].toFixed(1)}%`;
    out.push(`  ${g}: ${a.n} fight(s), |error| ${f("error")}, |matched| ${f("matched")}, replay-only ${f("replayOnly")}, log-only ${f("logOnly")}, one-sided ${b && b.n ? `${b.oneSided} → ` : ""}${a.oneSided}`);
  }
  return out;
}

/** How many kinds per group kindLines shows. */
const KIND_LINES = 8;

/**
 * The measured fights' one-sided landings by kind (Shares.kinds, packages/logs onesided.ts: where they sit, and where
 * they sit · nature), as the mean % of a fight's logged total per scoreboard group: gross (replay-only + |log-only|),
 * replay-only, log-only, largest gross first. The hold-outs' only view of which landings are one-sided: by kind, never
 * a log, an operator or a key. With `before` each gross as before → after.
 */
export function kindLines(after: ReadonlyMap<string, Shares>, split: Split, before?: ReadonlyMap<string, Shares>, beforeLabel?: string): string[] {
  if (![...after.values()].some((x) => x.kinds)) return [];
  const agg = (m: ReadonlyMap<string, Shares> | undefined, g: string, by: (k: ShareKind) => string) => {
    const xs = [...(m ?? new Map<string, Shares>())].filter(([k, x]) => groupOf(k, split) === g && x.kinds).map(([, x]) => x.kinds as readonly ShareKind[]);
    const out = new Map<string, { replay: number; log: number }>();
    for (const f of xs)
      for (const k of f) {
        const a = out.get(by(k)) ?? { replay: 0, log: 0 };
        out.set(by(k), a);
        a.replay += k.replay / xs.length;
        a.log += k.log / xs.length;
      }
    return { n: xs.length, kinds: out };
  };
  const out = [`One-sided landings by kind (mean % of a fight's logged total: gross = replay-only + |log-only|, then replay-only / log-only; onesided.ts; zmdlogs totals --all --kinds for the development rows)${before ? `, gross ${beforeLabel ?? "base"} → measured` : ""}:`];
  const ways: [string, (k: ShareKind) => string][] = [["where they sit", (k) => k.context], ["where they sit · nature", (k) => `${k.context} · ${k.nature}`]];
  for (const g of GROUPS)
    for (const [name, by] of ways) {
      const a = agg(after, g, by);
      if (!a.n) continue;
      const b = before ? agg(before, g, by) : undefined;
      const ranked = [...a.kinds].sort((x, y) => y[1].replay - y[1].log - (x[1].replay - x[1].log));
      const line = ([k, v]: [string, { replay: number; log: number }]) => {
        const was = b?.n ? b.kinds.get(k) : undefined;
        return `${b?.n ? `${was ? (was.replay - was.log).toFixed(2) : "0.00"} → ` : ""}${(v.replay - v.log).toFixed(2)}% (+${v.replay.toFixed(2)} / ${v.log.toFixed(2)}) ${k}`;
      };
      out.push(`  ${g}, by ${name} (${a.n} fight(s)): ${ranked.slice(0, KIND_LINES).map(line).join("; ")}`);
    }
  return out;
}

/** `<id>=<reading>` pairs as readings (--assume, --variant). */
function parseReadings(list: readonly string[]): Record<string, string> {
  return Object.fromEntries(list.map((a) => {
    const [id, reading] = a.split("=");
    if (!id || !reading) throw new Error(`--assume / --variant take <id>=<reading> (got ${a})`);
    return [id, reading];
  }));
}

/**
 * The commit whose code wrote the verdict snapshots `ref` has: the last commit at or before it that changed
 * tests/snapshots/, and how many code files changed from it to `ref` (docs, Markdown and snapshots aside).
 */
function snapshotWriter(ref: string): { readonly commit: string; readonly changed: number } {
  const commit = git(["log", "-1", "--format=%H", ref, "--", "tests/snapshots/"]) || git(["rev-parse", `${ref}^{commit}`]);
  const files = git(["diff", "--name-only", commit, ref]).split("\n").filter((f) => f && !f.startsWith("docs/") && !f.startsWith("tests/snapshots/") && !f.endsWith(".md"));
  return { commit, changed: files.length };
}

/**
 * The summary's first line when the snapshots at `against` weren't written by its own code (snapshotWriter): the
 * comparison then holds every code commit since the snapshots' too, which a reader takes for this tree's change alone.
 */
export function referenceNote(against: string, writer: { readonly commit: string; readonly changed: number }, short: (ref: string) => string = (r) => r.slice(0, 9)): string[] {
  if (!writer.changed) return [];
  return [`Reference: the snapshots at ${against} were written by ${short(writer.commit)}'s code, and ${writer.changed} code file(s) changed since: the comparison holds those changes too. \`--base ${against}\` measures this code against ${against}'s code alone.`];
}

/** Files a split leaves out: they change no measured code (docs, Markdown, the snapshots, tests). */
const NOT_CODE = (f: string) => f.startsWith("docs/") || f.endsWith(".md") || f.startsWith("tests/");

/**
 * --split files: the changed files in parts: each `--group` value (comma-separated path prefixes) one part of the
 * files under them, every other file a part of its own; files that change no measured code (NOT_CODE) left out.
 * Hold-out fixtures are one part, named by their count only.
 */
export function splitGroups(files: readonly string[], groups: readonly string[]): { readonly label: string; readonly files: readonly string[] }[] {
  const code = files.filter((f) => !NOT_CODE(f));
  const prefixes = groups.map((g) => g.split(",").map((p) => p.trim()).filter(Boolean));
  const out: { label: string; files: string[] }[] = prefixes.map((ps) => ({ label: ps.join(", "), files: [] }));
  const hold: string[] = [];
  const alone: { label: string; files: string[] }[] = [];
  for (const f of code) {
    const g = prefixes.findIndex((ps) => ps.some((p) => f === p || f.startsWith(p.endsWith("/") ? p : `${p}/`) || f.startsWith(p)));
    if (g >= 0) (out[g] as { files: string[] }).files.push(f);
    else if (f.startsWith("fixtures/holdout/")) hold.push(f);
    else alone.push({ label: f, files: [f] });
  }
  return [...out.filter((g) => g.files.length), ...alone, ...(hold.length ? [{ label: `fixtures/holdout/ (${hold.length} file(s))`, files: hold }] : [])];
}

/**
 * The lines of a split: per part its compare() against what it starts from, then the logs the whole change moved that
 * no part moved alone, and those a part moved that the whole left as they were (parts that act together); hold-outs
 * as counts only.
 */
export function splitLines(parts: readonly { readonly label: string; readonly from: Snapshots; readonly to: Snapshots }[], before: Snapshots, whole: Snapshots): string[] {
  const out: string[] = [];
  const movedBy = (a: Snapshots, b: Snapshots) => {
    const [x, y] = [allLogs(a), allLogs(b)];
    return new Set([...y].filter(([k, l]) => { const w = x.get(k); return !w || direction(w.entry, l.entry) !== "same"; }).map(([k]) => k));
  };
  const wholeMoved = movedBy(before, whole);
  const anyPart = new Set<string>();
  for (const [i, p] of parts.entries()) {
    const moved = movedBy(p.from, p.to);
    if (!moved.size) {
      out.push(`Part ${i + 1}: ${p.label}: no log's verdicts moved`);
      continue;
    }
    out.push(`Part ${i + 1}: ${p.label}`, ...compare(p.from, p.to).filter((l) => !/: unchanged$/.test(l)).map((l) => `  ${l}`));
    for (const k of moved) anyPart.add(k);
  }
  const name = (ks: readonly string[]) => {
    const hold = ks.filter(isHoldout).length;
    return [...ks.filter((k) => !isHoldout(k)).sort(), ...(hold ? [`${hold} hold-out(s)`] : [])].join(", ");
  };
  const unexplained = [...wholeMoved].filter((k) => !anyPart.has(k));
  const extra = [...anyPart].filter((k) => !wholeMoved.has(k));
  out.push(unexplained.length ? `Moved by the whole change, by no part alone (parts acting together): ${name(unexplained)}` : "Every log the whole change moved, some part moved alone.");
  if (extra.length) out.push(`Moved by a part, not by the whole change (parts cancelling): ${name(extra)}`);
  return out;
}

/** What splitParts needs of the run: the trees, the logs, the whole change's snapshots, and a measure of some logs. */
interface SplitRun {
  readonly base: string;
  readonly baseTree: string;
  /** The measured code's commit (--at, or the snapshot of the working tree taken at queue time). */
  readonly code: string;
  readonly groups: readonly string[];
  readonly keys: readonly string[];
  readonly before: Snapshots;
  readonly whole: Snapshots;
  readonly split: Split;
  readonly measure: (tree: string, label: string, which: readonly string[]) => Promise<Map<string, Entry>>;
}

/**
 * --split: each part of the change measured on the logs the whole change moved (backlog after round 10 point 3; the
 * stats-candidates report point 5): `files`, each part's diff alone on the base (a patched worktree of its own,
 * removed after); `commits`, each commit against its parent (worktrees under scratch/at/<hash>, kept like --base's).
 */
async function splitParts(how: "files" | "commits", r: SplitRun): Promise<string[]> {
  const moved = r.keys.filter((k) => {
    const [a, b] = [allLogs(r.before).get(k), allLogs(r.whole).get(k)];
    return !a || !b || direction(a.entry, b.entry) !== "same";
  });
  const head = `Split by ${how} against ${r.base} (each part measured on the ${moved.length} log(s) the whole change moved; the rest as the base has them):`;
  if (!moved.length) return [head, "  nothing to split: the whole change moved no log's verdicts"];
  const shortRef = (ref: string) => git(["rev-parse", "--short=9", ref]);
  const parts: { label: string; from: Snapshots; to: Snapshots }[] = [];
  const notes: string[] = [];
  if (how === "files") {
    const files = git(["diff", "--name-only", r.base, r.code]).split("\n").filter(Boolean);
    const groups = splitGroups(files, r.groups);
    const left = files.filter(NOT_CODE).length;
    if (!groups.length) return [head, `  nothing to split: no code file changed (${left} doc or test file(s) left out)`];
    const patches = join(ROOT, "scratch/measure/patches");
    mkdirSync(patches, { recursive: true });
    for (const [i, g] of groups.entries()) {
      const diff = join(patches, `split-${process.pid}-${i + 1}.diff`);
      writeFileSync(diff, execFileSync("git", ["diff", "--binary", r.base, r.code, "--", ...g.files], { cwd: ROOT, maxBuffer: 256 << 20 }));
      const dir = resolve(ROOT, "scratch/at", `measure-${shortRef(r.base)}-split${i + 1}-${process.pid}`);
      atCommit(r.base, dir, diff);
      try {
        const got = await r.measure(dir, `part ${i + 1} (${g.label}): `, moved);
        parts.push({ label: `${g.label} alone on ${r.base}`, from: r.before, to: overlay(r.before, got, r.split) });
      } catch (e) {
        // A part that doesn't run alone (it needs another file's change: a new export, say) is named, not fatal.
        notes.push(`  ${g.label}: not measured alone (${(e instanceof Error ? e.message : String(e)).split("\n")[0]}); put it in one part with the files it needs: --group ${[g.label, "<the other files>"].join(",")}`);
      } finally {
        removeAtCommit(dir);
      }
    }
    if (left) notes.push(`  (${left} doc or test file(s) left out: they change no measured code)`);
  } else {
    // First parents only: a merge is one step (the branch it brings in measured as a whole), each against the one before.
    const commits = git(["rev-list", "--reverse", "--first-parent", `${r.base}..${r.code}`]).split("\n").filter(Boolean);
    if (!commits.length) return [head, `  nothing to split: no commit between ${r.base} and the measured code`];
    let from = r.before;
    for (const [i, c] of commits.entries()) {
      const last = i === commits.length - 1;
      const subject = git(["log", "-1", "--format=%s", c]);
      const label = `${shortRef(c)} ${subject.startsWith("a snapshot of the working tree") ? "(the working tree's own changes)" : subject}`;
      let to: Snapshots;
      if (last) to = r.whole;
      else {
        const dir = resolve(ROOT, "scratch/at", shortRef(c));
        atCommit(c, dir);
        to = overlay(r.before, await r.measure(dir, `commit ${i + 1} (${shortRef(c)}): `, moved), r.split);
      }
      parts.push({ label, from, to });
      from = to;
    }
  }
  return [head, ...notes, ...splitLines(parts, r.before, r.whole)];
}

/**
 * The negative control's lines (tests/slow/negative-control.test.ts: every value ×0.97 and ×1.03, chance matches at
 * most MAX_CHANCE_SHARE of the judged hits, at least 1): one per verified log, its counts per factor, `!` over the bound.
 */
export function negativeControl(counts: ReadonlyMap<string, readonly NegativeCount[]>): string[] {
  const bound = (judged: number) => Math.max(1, Math.ceil(judged * NEGATIVE_MAX_SHARE));
  const over: string[] = [];
  const lines = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([k, cs]) => {
    const parts = cs.map((c) => {
      const bad = c.matches > bound(c.judged);
      if (bad) over.push(`${k} ×${c.factor}`);
      return `×${c.factor} ${c.matches}${bad ? " !" : ""}`;
    });
    return `  ${k}: ${parts.join(", ")} of ${cs[0]?.judged ?? 0} judged (bound ${bound(cs[0]?.judged ?? 0)})`;
  });
  return [`Negative control (verified logs, every value ×${NEGATIVE_FACTORS.join(" / ×")}: chance matches, at most ${100 * NEGATIVE_MAX_SHARE}% of the judged hits; test:logs fails over it): ${over.length ? `over the bound: ${over.join(", ")}` : "within the bound"}`, ...lines];
}

/** tests/slow/negative-control.test.ts FACTORS and MAX_CHANCE_SHARE. */
const NEGATIVE_FACTORS = [0.97, 1.03];
const NEGATIVE_MAX_SHARE = 0.01;

/**
 * The mixed logs (a fit measure better, another worse) by their mean |per-hit error| (logged ÷ the primary reading − 1,
 * every hit with one), before and after: closer or further. Hold-outs only as counts.
 */
export function mixedPerHit(mixed: readonly string[], before: ReadonlyMap<string, PerHit>, after: ReadonlyMap<string, PerHit>): string[] {
  if (!mixed.length) return [];
  const pct = (x: number) => `${(100 * x).toFixed(2)}%`;
  const out = ["Mixed logs by the mean |per-hit error| (logged ÷ the primary reading − 1, over every hit with one; not in the snapshots):"];
  const hold = { closer: 0, further: 0, same: 0 };
  for (const k of mixed) {
    const [a, b] = [before.get(k), after.get(k)];
    if (!a || !b) {
      if (!isHoldout(k)) out.push(`  ${k}: per-hit fit not measured`);
      continue;
    }
    const way = b.meanAbs < a.meanAbs - 1e-6 ? "closer" : b.meanAbs > a.meanAbs + 1e-6 ? "further" : "same";
    if (isHoldout(k)) hold[way]++;
    else out.push(`  ${k}: ${pct(a.meanAbs)} → ${pct(b.meanAbs)} over ${b.n} hits (${way})`);
  }
  if (hold.closer + hold.further + hold.same) out.push(`  hold-out: ${hold.closer} closer, ${hold.further} further, ${hold.same} the same`);
  return out;
}

/**
 * --changed placement: per development log whose placement changed, the casts only the reference's code places (-)
 * and only the measured code's (+), at most `limit` each (a cast whose hits alone moved shows in neither: the
 * signature covers each hit's cast and frame).
 */
export function movedCasts(logs: readonly string[], before: ReadonlyMap<string, readonly string[]>, after: ReadonlyMap<string, readonly string[]>, limit = 8): string[] {
  const out: string[] = [];
  for (const k of logs) {
    const [a, b] = [new Set(before.get(k) ?? []), new Set(after.get(k) ?? [])];
    const gone = [...a].filter((c) => !b.has(c));
    const added = [...b].filter((c) => !a.has(c));
    out.push(`  ${k}: ${gone.length || added.length ? `${gone.length} cast(s) only before, ${added.length} only now` : "the same casts; some hits moved between them"}`);
    for (const [sign, cs] of [["-", gone], ["+", added]] as const) {
      for (const c of cs.slice(0, limit)) out.push(`    ${sign} ${c}`);
      if (cs.length > limit) out.push(`    ${sign} … ${cs.length - limit} more`);
    }
  }
  return out;
}

/**
 * measure --hits: per development log whose entry moved, the hits whose verdict changed (time, operator, event,
 * verdict and logged ÷ primary before and after), counted by change in the summary (a few examples each) and listed
 * in full for hits.txt. Hold-outs are never passed in.
 */
export function hitChanges(logs: readonly string[], before: ReadonlyMap<string, readonly HitRow[]>, after: ReadonlyMap<string, readonly HitRow[]>, examples = 5): { summary: string[]; full: string[] } {
  const summary = [`Hits whose verdict changed (--hits; development logs whose entry moved)${logs.length ? ":" : ": none (no development log's entry moved)"}`];
  const full: string[] = [];
  const ratio = (r: number | null) => (r === null ? "-" : `×${r.toFixed(3)}`);
  for (const k of logs) {
    const [a, b] = [before.get(k), after.get(k)];
    if (!a || !b || a.length !== b.length) {
      summary.push(`  ${k}: per-hit verdicts not comparable (${!a || !b ? "not measured on both sides" : "the fixture's hits differ"})`);
      continue;
    }
    const changed = b.flatMap((h, i) => (h[3] !== (a[i] as HitRow)[3] ? [{ was: a[i] as HitRow, now: h }] : []));
    if (!changed.length) {
      summary.push(`  ${k}: no hit's verdict changed (only values within a verdict, e.g. the totals)`);
      continue;
    }
    const kinds = new Map<string, typeof changed>();
    for (const c of changed) {
      const kind = `${c.was[3]} → ${c.now[3]}`;
      kinds.set(kind, [...(kinds.get(kind) ?? []), c]);
    }
    summary.push(`  ${k}: ${changed.length} hits: ${[...kinds].sort((x, y) => y[1].length - x[1].length).map(([kind, cs]) => `${kind} ${cs.length}`).join(", ")}`);
    const line = (c: (typeof changed)[number]) => `${(c.now[0] / 1000).toFixed(2)} s ${c.now[1]} ${c.now[2]}: ${c.was[3]} ${ratio(c.was[4])} → ${c.now[3]} ${ratio(c.now[4])}${modifierChange(c.was[5], c.now[5])}`;
    for (const [, cs] of kinds) for (const c of cs.slice(0, examples)) summary.push(`    ${line(c)}`);
    full.push(`${k}:`, ...changed.map((c) => `  ${line(c)}`));
  }
  return { summary, full };
}

/**
 * measure --hits: per development log whose entry moved, the placed hidden holds' units before and after (paired by
 * their place in the total: the k-th 0.512 s of hold), those whose placement moved by more than `tolMs`, a few per log
 * in the summary and every one in hits.txt; units gone or new where the total changed. Logs whose commit places no
 * holds on either side are left out.
 */
export function holdChanges(logs: readonly string[], before: ReadonlyMap<string, readonly HoldUnit[]>, after: ReadonlyMap<string, readonly HoldUnit[]>, examples = 3, tolMs = 50): { summary: string[]; full: string[] } {
  const s = (ms: number) => (ms / 1000).toFixed(2);
  const unit = (u: HoldUnit) => `${s(u.mid)} (${s(u.early)}–${s(u.late)})`;
  const summary: string[] = [];
  const full: string[] = [];
  for (const k of logs) {
    const [a, b] = [before.get(k), after.get(k)];
    if (!a && !b) continue;
    if (!a || !b) {
      summary.push(`  ${k}: hidden holds placed on one side only (${a ? "before" : "now"}: ${(a ?? b ?? []).length} units)`);
      continue;
    }
    const moved: string[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const [x, y] = [a[i], b[i]];
      if (x && y && Math.abs(x.mid - y.mid) <= tolMs && Math.abs(x.early - y.early) <= tolMs && Math.abs(x.late - y.late) <= tolMs) continue;
      moved.push(`unit ${i + 1}: ${x ? unit(x) : "-"} → ${y ? unit(y) : "-"} s`);
    }
    const head = `  ${k}: hidden holds ${a.length} → ${b.length} units (${s(a.length * 512)} → ${s(b.length * 512)} s), ${moved.length ? `${moved.length} placed elsewhere or new or gone` : "placed as before"}`;
    summary.push(head, ...moved.slice(0, examples).map((m) => `    ${m}`), ...(moved.length > examples ? [`    … ${moved.length - examples} more (hits.txt)`] : []));
    if (moved.length) full.push(`${k}:`, ...moved.map((m) => `  ${m}`));
  }
  return { summary: summary.length ? ["Hidden holds of the logs whose entry moved (--hits; zmdlogs holds' units: placed (earliest–latest), s):", ...summary] : [], full };
}

/**
 * What changed in a hit's primary reading's modifiers (HitRow's sixth part: "<kit buff or source> <zone> <value>"): the
 * ones gone (−), new (+) and moved in value (a → b), as " [modifiers: …]"; empty when either side lacks them or none moved.
 */
export function modifierChange(was: readonly string[] | undefined, now: readonly string[] | undefined): string {
  if (!was || !now) return "";
  const split = (m: string) => {
    const i = m.lastIndexOf(" ");
    return [m.slice(0, i), m.slice(i + 1)] as const;
  };
  const [a, b] = [new Map(was.map(split)), new Map(now.map(split))];
  const parts = [
    ...[...a].filter(([k]) => !b.has(k)).map(([k, v]) => `−${k} ${v}`),
    ...[...b].filter(([k]) => !a.has(k)).map(([k, v]) => `+${k} ${v}`),
    ...[...b].filter(([k, v]) => a.has(k) && a.get(k) !== v).map(([k, v]) => `${k} ${a.get(k) as string} → ${v}`),
  ];
  return parts.length ? ` [modifiers: ${parts.join("; ")}]` : "";
}

const readTracked =(tree: string, rel: string) => (existsSync(join(tree, rel)) ? readFileSync(join(tree, rel), "utf8") : "");

function git(args: readonly string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

/**
 * A `--patch` without `--at` goes on top of the tree as queued, which holds the working tree's changes: a diff that is
 * one of those changes doesn't apply there (physical-statuses report point 1: a split of one batch's effect failed so
 * after waiting in the queue). Refused before queueing, with the form that measures it alone; null when fine.
 */
export function patchProblem(argv: readonly string[], root = ROOT): string | null {
  const pi = argv.indexOf("--patch");
  const file = pi >= 0 ? argv[pi + 1] : undefined;
  if (file === undefined || argv.some((a) => a === "--at" || a.startsWith("--at="))) return null;
  const check = (reverse: boolean) => spawnSync("git", ["apply", "--check", ...(reverse ? ["--reverse"] : []), resolve(file)], { cwd: root, encoding: "utf8" }).status === 0;
  if (check(false)) return null;
  if (check(true))
    return `measure: --patch ${file} is already in the working tree (it applies in reverse): without --at the patch goes on top of the tree as queued, which has it. To measure it alone: --at <the commit before it> --patch ${file} (that code plus only this diff)`;
  return `measure: --patch ${file} doesn't apply to the working tree (git apply --check): without --at it goes on top of the tree as queued; name the commit it was made against with --at <ref>`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (testLockFile()) {
    // Under the test lock as a job (a queue: premerges and test suites go first), then this script again inside it.
    // A short job: the side lane, beside a long rule search, never beside a premerge or test suite (testlock.ts).
    // The code is fixed now, at queue time (round 5: agents idled through 10-60 min waits because the run would read
    // the tree when its turn came): a commit of the working tree (at-commit.ts snapshotCommit), measured in its own
    // worktree under scratch/at/ and removed after. --at names a commit itself; --live reads the tree at the start.
    const own = argv.some((a) => a === "--at" || a.startsWith("--at=") || a === "--live" || a === "--snapshot" || a.startsWith("--snapshot="));
    const problem = own ? null : patchProblem(argv);
    if (problem) {
      process.stderr.write(problem + "\n");
      process.stdout.write("EFSIM-DONE measure fail\n");
      process.exit(2);
    }
    const args = [...argv];
    // A --patch file as it is now (edits during the wait don't reach the run), under scratch/measure/patches/.
    const pi = args.findIndex((a) => a === "--patch");
    if (pi >= 0 && args[pi + 1] !== undefined) {
      const dir = join(ROOT, "scratch/measure/patches");
      mkdirSync(dir, { recursive: true });
      const copy = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${process.pid}.diff`);
      writeFileSync(copy, readFileSync(resolve(args[pi + 1] as string)));
      args[pi + 1] = copy;
    }
    if (!own) {
      const snap = snapshotCommit(ROOT);
      args.push("--snapshot", snap.commit.slice(0, 12), "--snapshot-head", snap.head.slice(0, 12));
      process.stderr.write(`measure: the code is fixed at queue time (${snap.dirty ? `a snapshot of the working tree, ${snap.commit.slice(0, 9)}` : `HEAD ${snap.head.slice(0, 9)}, the tree is clean`}): keep editing while it waits (--live reads the tree when the run starts)\n`);
    }
    void runLockedAsync([process.execPath, fileURLToPath(import.meta.url), ...args], { kind: "short", who: "measure", done: "measure" }).then((c) => (process.exitCode = c));
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
