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
//                       those commits' changes in: --base HEAD measures the tree's change alone). With none of
//                       --against, --base and --at named and the snapshots at HEAD not the code's own up to the merge
//                       base with main, that merge base's code is measured as --base (round 15: the first measure of a
//                       task compared against stale snapshots); the summary's first line names the reference
//   --against-snapshots compare with the snapshots at HEAD even when they aren't the code's own (no base run)
//   --base <ref>        measure <ref>'s code too, on the same logs, and compare the two measurements (A/B of two
//                       commits' code, whatever their committed snapshots say)
//   --with <operator>   only logs whose team has it (operator id, or part of the id or name; repeatable: any of them)
//   --logs <id,…>       only these logs (ids or unique parts of them; never a hold-out)
//   --several-targets   only the logs whose fixture is marked severalTargets (the several-targets row: 6339, 7b54,
//                       9c6e at round 20), for a change gated on the mark; the final measure stays full (round 20,
//                       the twins report point 2)
//   --changed placement only logs whose placed casts (placeHits) differ between the measured code and the --base /
//                       --against ref's code (seconds per log, then only those are checked); prints, per
//                       development log, the casts that moved (~, paired as packages/logs/src/castpairs.ts does), those
//                       placed only before (-) and only now (+)
//   --assume <id>=<r>   replay under another reading of a kit's or the engine's open assumption (e.g.
//                       control-immunity=bosses; repeatable): the reading's effect against the reference
//   --variant <id>=<r>[,<id>=<r>…]  measure once per --variant (repeatable; each on top of --assume), all of the
//                       same code and against the same reference, in one run and one snapshot: the summary per
//                       variant, files under <out>/variant-<n>/ (separating two readings' effects without chaining
//                       measures, each taking its own snapshot); the same code without any variant is measured too
//                       (round 11), and each variant's summary also says what it moves against that plain tree, the
//                       question an idea on top of the tree asks (--no-plain: skip that run). An entry
//                       <file>:<CONST>=<value> is a --set of that variant alone (its own patched worktree): a
//                       constant's values side by side, `--variant x.ts:WIDE=30 --variant x.ts:WIDE=60`
//   --variant-patch <file>  a --variant whose code is the measured code with this diff applied (repeatable; round 22,
//                       the needed-pairing report point 3: three patch measures on one base queued apart and ran the
//                       base three times): each in a worktree of its own, all against the one base run and beside the
//                       plain tree, in one queue slot. With --set the variant's code has both (on different files);
//                       not with --patch (put both diffs in one file). Each diff is copied at queue time and must apply
//                       to the code measured (--at, else the tree as queued)
//   --set <file>:<CONST>=<value>  measure the code with the constant's one-line declaration (`[export] const CONST
//                       = …;`, exactly one in the file) set to the value (repeatable; round 18, the status-pairing
//                       report point 2: a constant's value took a commit, an edit, a diff and a revert each): a
//                       --patch made from the code measured (with --patch too: both, on different files), kept under
//                       scratch/measure/patches/ for docs/tried/ and named in the summary. Not with --live. The value
//                       is source text, pasted as it is: a string needs its quotes inside the argument,
//                       `--set 'x.ts:MODE="any"'` (round 20, the break-placement report point 4)
//   --split files|commits|hunks  after the whole change against --base (default HEAD: the working tree's change), the
//                       share of each part (round 11: "which change moved this log" took three more measures): files,
//                       each changed file's diff alone on --base (`--group a,b` puts the files under these path
//                       prefixes into one part; repeatable; `--only a,b` instead: those files one part and every
//                       other file one more, two parts for "did these move it"); commits, each commit of --base..the
//                       code against its parent (the working tree's own changes the last); hunks, each diff hunk
//                       alone on --base (round 18, the replay-only report point 1: three rules in one file took a
//                       hand-made reverse patch and a measure each), the hunks whose lines carry one `split:<name>`
//                       marker (a comment) one part, at most MAX_HUNK_PARTS parts (`--only a,b`: the hunks of
//                       those files apart, every other file one part). Files that import a name
//                       another changed file adds go in one part on their own (importLinks: a new export and its
//                       users can't run apart; round 16; hunks: a part that doesn't run alone is named). Each part is
//                       measured only on the logs the whole change moved, so a split costs about one measure of those
//                       per part; per part, of the hold-outs the whole change moved, how many it moves the same way
//                       alone (counts only). Not with --variant, --patch, --set or --live
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
//                       cause of a small worse log ("the holds placed again"). With --variant, also each variant's own
//                       changed hits: against the plain tree (the same code without it), for the logs it moved there
//   --help, -h          this text. The options are checked before the run queues for the lock (the readings against
//                       the registered assumptions too): a typo fails in seconds
//   --live              read the working tree when the run starts (after the queue's wait), not as it was queued
// The hold-outs a run moved also get the replay's decision lines counted by kind on both sides (packages/logs
// decisionsview.ts: SKIP, TAILCUT, TAILKEPT, JUMPDROP, …), their net changes summed per direction: whether a replay
// rule acted there, without a log, an operator or a skill named (round 18, the placement-cases report point 2). The
// reference side is --base's code, else the code that wrote the snapshots, measured for those hold-outs alone. No
// split of the hold-outs' change by cast, skill, operator or rule kind beyond that (docs/design/tests.md "What a
// hold-out output may say"; round 20 declined the moved hold-outs' casts by kind and shift).
// With --variant, the plain tree's own summary against the reference comes first (round 20, the break-placement
// report point 3).
//   --out <dir>         where to write (default scratch/measure/<time>/): log-verdicts.json,
//                       log-verdicts-pending.json, log-verdicts-holdout.json (never diff it by eye), accuracy.md,
//                       summary.txt, moved.json (when it was queued, its code, the development logs it moved and
//                       how many hold-outs)
//
// Each measure is against the committed snapshots, so two changes measured side by side don't see each other: the
// summary's "Moved by an earlier measure too" line names the development logs this run moved that a measure queued in
// the INTERACT_HOURS before it moved too (their moved.json; hold-outs as a count), where the two changes may interact
// (cooldown-clock report point 1: b7b3 better under each alone, mixed under both). Measure one on top of the other.
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
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { allLogs, compare, direction, GROUPS, groupOf, holdoutEntry, isHoldoutKey, operatorNames, pairKey, readSplit, render, snapshotsAt, splitPending, withSeveralTargets, type Entries, type Entry, type Snapshots, type Split } from "./accuracy.ts";
import { atCommit, removeAtCommit, snapshotCommit } from "./at-commit.ts";
import { threwNote } from "./code-errors.ts";
import type { HitRow, HoldUnit, MeasureAnswer, MeasureJob, NegativeCount, PerHit, ShareKind, Shares } from "./measure-worker.ts";
type DecisionCounts = Readonly<Record<string, number>>;
import { endRun, startRun } from "./runstate.ts";
import { runLockedAsync, testLockFile } from "./testlock.ts";
import { printHelp } from "./usage.ts";
import { pairCasts } from "../packages/logs/src/castpairs.ts";
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

let rootSplit: Pick<Split, "holdout"> | undefined;
/** Whether a key in either form is a hold-out's, by this checkout's split (accuracy.ts isHoldoutKey). */
const isHoldout = (key: string) => {
  rootSplit ??= existsSync(join(ROOT, "fixtures/holdout/holdout.json")) ? readSplit() : { holdout: new Set<string>() };
  return isHoldoutKey(key, rootSplit);
};
const idOf = (key: string) => (key.split("/").pop() as string).replace(/\.json$/, "");

/** How far back (hours) a measure looks for earlier measures that moved the same logs (interactLines). */
const INTERACT_HOURS = 12;

/** A measure's moved logs (moved.json; the hold-outs only as a count on disk). */
export interface MovedRecord {
  readonly queued: string;
  readonly code: string;
  readonly moved: readonly string[];
  readonly holdouts: readonly string[];
}

/**
 * The development logs this run moved that a measure queued in the INTERACT_HOURS before it moved too (scratch/measure/
 * <dir>/moved.json), a line per such measure: the two changes, each measured against the snapshots alone, may interact
 * there (cooldown-clock report point 1). Hold-outs as counts only.
 */
export function interactLines(out: string, mine: MovedRecord): string[] {
  const root = dirname(out);
  const at = Date.parse(mine.queued);
  const lines: string[] = [];
  for (const d of existsSync(root) ? readdirSync(root) : []) {
    const dir = join(root, d);
    if (dir === out || !existsSync(join(dir, "moved.json"))) continue;
    let other: { queued?: string; code?: string; moved?: string[]; holdouts?: number };
    try {
      other = JSON.parse(readFileSync(join(dir, "moved.json"), "utf8")) as typeof other;
    } catch {
      continue;
    }
    const t = Date.parse(other.queued ?? "");
    if (!Number.isFinite(t) || t > at || at - t > INTERACT_HOURS * 3600_000) continue;
    const shared = (other.moved ?? []).filter((k) => mine.moved.includes(k));
    if (shared.length) lines.push(`  ${d} (queued ${other.queued}, ${other.code ?? "?"}): ${shared.map(idOf).join(", ")}${mine.holdouts.length && other.holdouts ? `; hold-outs moved: ${mine.holdouts.length} here, ${other.holdouts} there` : ""}`);
  }
  return lines.length ? [`Moved by an earlier measure too (queued in the ${INTERACT_HOURS} h before this one; each is against the snapshots alone, so where both change a log they may interact: measure one on top of the other, --patch or --base):`, ...lines] : [];
}

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
  // The several-target logs as the overlaid entries mark them (a measured entry may carry the key or drop it).
  return { verified: Object.fromEntries(verified), pending: Object.fromEntries(pending), split: withSeveralTargets(split, Object.fromEntries(pending)) };
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
/** Whether a log's fixture is marked severalTargets (measure --several-targets). */
const severalTargetsOf = (tree: string, key: string) => (JSON.parse(readFileSync(join(tree, "fixtures", key), "utf8")) as { severalTargets?: unknown }).severalTargets !== undefined;

/**
 * The options, parsed and checked as far as they can be without the code or git (round 13, damage-factors report
 * point 2: a typo or `--help` waited 5 min in the lock's queue before it failed): the entry point calls this before it
 * queues, main again inside the lock. Throws on an unknown option or a bad value.
 */
export function measureOptions(argv: readonly string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      at: { type: "string" },
      against: { type: "string" },
      "against-snapshots": { type: "boolean", default: false },
      base: { type: "string" },
      with: { type: "string", multiple: true, default: [] },
      logs: { type: "string", multiple: true, default: [] },
      "several-targets": { type: "boolean", default: false },
      changed: { type: "string" },
      assume: { type: "string", multiple: true, default: [] },
      workers: { type: "string", default: String(Math.min(3, Math.max(1, cpus().length - 1))) },
      out: { type: "string" },
      hits: { type: "boolean", default: false },
      variant: { type: "string", multiple: true, default: [] },
      "variant-patch": { type: "string", multiple: true, default: [] },
      negative: { type: "boolean", default: true },
      live: { type: "boolean", default: false },
      snapshot: { type: "string" },
      "snapshot-head": { type: "string" },
      queued: { type: "string" },
      patch: { type: "string" },
      plain: { type: "boolean", default: true },
      split: { type: "string" },
      group: { type: "string", multiple: true, default: [] },
      only: { type: "string" },
      set: { type: "string", multiple: true, default: [] },
    },
    allowNegative: true,
  });
  if (values.changed !== undefined && values.changed !== "placement") throw new Error("--changed takes placement");
  // --variant-patch: a variant of its own each (`patch:<file>`, isPatchEntry), after the --variant ones.
  for (const p of values["variant-patch"]) {
    if (!existsSync(resolve(p))) throw new Error(`--variant-patch ${p}: no such file`);
    values.variant.push(`patch:${resolve(p)}`);
  }
  if (values["variant-patch"].length && values.patch !== undefined) throw new Error("--variant-patch goes on the measured code: not with --patch (one diff file with both)");
  if (values["variant-patch"].length && values.live) throw new Error("--variant-patch applies to a commit (--at, or the tree as queued): not with --live");
  const variantSets = values.variant.flatMap((x) => x.split(",")).filter(isSetEntry);
  if (values.split !== undefined) {
    if (values.split !== "files" && values.split !== "commits" && values.split !== "hunks") throw new Error("--split takes files, commits or hunks");
    if (values.variant.length || values.patch !== undefined || values.set.length || values.live) throw new Error("--split measures the code's own parts: not with --variant, --patch, --set or --live");
    if (values.at !== undefined && values.base === undefined) throw new Error("--split with --at needs --base <ref> (the commit the parts are split against)");
    // The working tree's change (the snapshot taken at queue time) against HEAD, unless --base names another commit.
    values.base ??= "HEAD";
  }
  if (values.group.length && values.split !== "files") throw new Error("--group goes with --split files");
  if (values.only !== undefined && values.split !== "files" && values.split !== "hunks") throw new Error("--only goes with --split files or hunks");
  if (values.only !== undefined && values.group.length) throw new Error("--split files: --only or --group, not both");
  const workers = Number(values.workers);
  if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
  if (values.patch !== undefined && values.live) throw new Error("--patch applies to a commit (--at, or the tree as queued): not with --live");
  if ((values.set.length || variantSets.length) && values.live) throw new Error("--set (and a --variant's <file>:<CONST>=<value>) patches a commit (--at, or the tree as queued): not with --live");
  for (const s of [...values.set, ...variantSets]) parseSet(s);
  parseReadings([...values.assume, ...values.variant.flatMap((x) => x.split(",")).filter((x) => !isSetEntry(x) && !isPatchEntry(x))]);
  if (values.patch !== undefined && !existsSync(resolve(values.patch))) throw new Error(`--patch ${values.patch}: no such file`);
  return { values, workers };
}

async function main(argv: string[]): Promise<number> {
  const { values, workers } = measureOptions(argv);
  const say = (l: string) => process.stdout.write(l + "\n");

  // --set: a patch of the constants made from the code measured (and --patch's own diff, on other files), kept for docs/tried/.
  const codeRef = values.at ?? values.snapshot ?? "HEAD";
  const userPatch = values.patch;
  const setsPatch = (sets: readonly string[], label: string): string => {
    const diff = combinedPatch(userPatch !== undefined ? readFileSync(resolve(userPatch), "utf8") : "", sets.map(parseSet), (f) => gitShow(codeRef, f));
    const dir = join(ROOT, "scratch/measure/patches");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `set-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${process.pid}-${label}.diff`);
    writeFileSync(file, diff);
    return file;
  };
  // A --variant-patch's diff with the --set constants (combinedPatch: on other files), kept beside them.
  const variantDiff = (file: string, sets: readonly string[], vi: number): string => {
    const diff = combinedPatch(readFileSync(file, "utf8"), sets.map(parseSet), (f) => gitShow(codeRef, f));
    const dir = join(ROOT, "scratch/measure/patches");
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `variant-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${process.pid}-${vi + 1}.diff`);
    writeFileSync(out, diff);
    return out;
  };
  if (values.set.length) values.patch = setsPatch(values.set, "base");
  const patchLabel = [...(userPatch !== undefined ? [userPatch] : []), ...values.set.map((x) => `--set ${x}`)].join(" and ");

  // The code: --at's commit, the snapshot taken when the run was queued (the entry point below), or the tree as it is now;
  // with --patch, that commit with the diff applied in a worktree of its own (removed after).
  const at = values.at ?? values.snapshot ?? (values.patch !== undefined ? "HEAD" : undefined);
  const tree = at ? resolve(ROOT, "scratch/at", `${values.at && values.patch === undefined ? "" : "measure-"}${git(["rev-parse", "--short=9", "--verify", `${at}^{commit}`])}${values.patch !== undefined ? `-patch-${process.pid}` : ""}`) : ROOT;
  const ownTree = (values.patch !== undefined || (values.at === undefined && values.snapshot !== undefined)) && !existsSync(tree);
  if (at) atCommit(at, tree, values.patch);
  if (ownTree) {
    // The snapshot's worktree goes when the run ends, a signal included (testlock.ts passes a kill on).
    process.on("exit", () => removeAtCommit(tree));
    for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => process.exit(1));
  }
  const short = (ref: string) => git(["rev-parse", "--short=9", ref]);
  // No reference named: the merge base with main's code when the snapshots aren't the code's own (defaultReference).
  let defaulted: { readonly base?: string; readonly lines: readonly string[] } | undefined;
  if (values.base === undefined && values.against === undefined && values.at === undefined && !values["against-snapshots"]) {
    const ref = values["snapshot-head"] ?? "HEAD";
    const writer = snapshotWriter(ref);
    defaulted = defaultReference(ref, writer, writer.changed ? mainBase(ref, writer.commit) : null, short);
    if (defaulted.base) values.base = short(defaulted.base);
  }
  const against = values.base ?? values.against ?? values.at ?? values["snapshot-head"] ?? "HEAD";
  const baseTree = values.base ? resolve(ROOT, "scratch/at", git(["rev-parse", "--short=9", "--verify", `${values.base}^{commit}`])) : undefined;
  if (values.base && baseTree) atCommit(values.base, baseTree);
  const assume = parseReadings(values.assume);
  const snapshot = values.snapshot && !values.at ? values.snapshot : undefined;
  const code = values.at
    ? `the code at ${values.at}`
    : snapshot
      ? snapshot === values["snapshot-head"]
        ? `the code at HEAD (${short(snapshot)}; the tree was clean when queued)`
        : `the working tree as queued (snapshot ${short(snapshot)} on ${short(values["snapshot-head"] ?? "HEAD")})`
      : "the working tree";
  const patched = values.patch !== undefined ? `${code} with ${patchLabel} applied` : code;
  const what = `${patched}${values.assume.length ? ` under ${values.assume.join(", ")}` : ""}${values.base ? ` against the code at ${values.base}${defaulted?.base ? " (the merge base with main)" : ""}` : ` against the snapshots at ${against}`}`;
  // The reference's own code (placement-leads report point 3): after a code commit the snapshots at HEAD aren't HEAD's
  // code, so "against the snapshots" mixes those commits' changes into this tree's. Said first, in the summary too.
  const referenceLine = defaulted ? [...defaulted.lines] : values.base ? [] : referenceNote(against, snapshotWriter(against), short);

  // The selection.
  const split = readSplit(readFileSync(join(tree, "fixtures/holdout/holdout.json"), "utf8"));
  let keys = logKeys(tree);
  if (values.logs.length) keys = selectLogs(keys, values.logs.flatMap((x) => x.split(",")).filter(Boolean), split.holdout);
  // --several-targets: the fixtures marked severalTargets (never a hold-out: the mark is read from development fixtures only).
  if (values["several-targets"]) keys = keys.filter((k) => !isHoldout(k) && severalTargetsOf(tree, k));
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
  const decisionsBy = new Map<string, Map<string, DecisionCounts>>();
  // The logs whose replay threw a code error (MeasureAnswer.threw), per slot: a split part's means "not measured alone".
  const threwBy = new Map<string, Map<string, readonly string[]>>();
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
    const decided = decisionsBy.get(slot) ?? new Map<string, DecisionCounts>();
    decisionsBy.set(slot, decided);
    const threw = threwBy.get(slot) ?? new Map<string, readonly string[]>();
    threwBy.set(slot, threw);
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
      // A hold-out's entry as its snapshot holds it (accuracy.ts holdoutEntry: no operator's own split).
      got.set(a.key, isHoldout(a.key) ? holdoutEntry(a.entry) : a.entry);
      if (a.untimed) untimed.add(a.key);
      if (a.perHit) fits.set(a.key, a.perHit);
      if (a.hits) rows.set(a.key, a.hits);
      if (a.holds) holds.set(a.key, a.holds);
      if (a.shares) shares.set(a.key, a.shares);
      if (a.decisions) decided.set(a.key, a.decisions);
      if (a.threw?.length) threw.set(a.key, a.threw);
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
  const variants = values.variant.length ? values.variant.map((v) => ({ text: v, readings: { ...assume, ...parseReadings(v.split(",").filter((x) => !isSetEntry(x) && !isPatchEntry(x))) }, sets: v.split(",").filter(isSetEntry), patch: v.split(",").find(isPatchEntry)?.slice("patch:".length) })) : [{ text: "", readings: assume, sets: [] as string[], patch: undefined }];
  // A variant with --set entries or a --variant-patch: the measured code with them, in a worktree of its own (removed after).
  const variantPatches = new Map<number, string>();
  const variantTree = (sets: readonly string[], vi: number, diff?: string): string => {
    if (!sets.length && diff === undefined) return tree;
    const dir = resolve(ROOT, "scratch/at", `measure-${short(codeRef)}-set${vi + 1}-${process.pid}`);
    const patch = diff === undefined ? setsPatch([...values.set, ...sets], `variant-${vi + 1}`) : variantDiff(diff, [...values.set, ...sets], vi);
    variantPatches.set(vi, patch);
    atCommit(codeRef, dir, patch);
    process.on("exit", () => removeAtCommit(dir));
    return dir;
  };
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
    const measured = await measureTree(variantTree(v.sets, vi, v.patch), label, order, v.readings, `${tree}#${vi}`);
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
    // The moved hold-outs' decisions at the reference (round 18): --base's, the plain tree's for a variant, else the
    // snapshots' writer's code measured for them alone (refTree, as the mixed logs').
    // A variant's against the plain tree (the same code without it), as its own effect; else against the reference.
    const decisionRef = plain ? `${tree}#plain` : baseTree ? baseTree : undefined;
    const fromSnap = plain ?? (before as Snapshots);
    const holdMoved = keys.filter((k) => {
      if (!isHoldout(k)) return false;
      const [a, b] = [entryOf(fromSnap, k), entryOf(after, k)];
      return a !== undefined && b !== undefined && direction(a, b) !== "same";
    });
    if (holdMoved.length && !decisionRef) {
      if (!refTree) {
        const writer = snapshotWriter(against);
        refTree = resolve(ROOT, "scratch/at", short(writer.commit));
        refLabel = short(writer.commit);
        atCommit(writer.commit, refTree);
      }
      const done = decisionsBy.get(refTree) ?? new Map();
      const which = holdMoved.filter((k) => !done.has(k));
      if (which.length) {
        say(`measure: ${which.length} hold-out(s) moved: their replay decisions at ${refLabel}'s code`);
        await measureTree(refTree, `reference ${refLabel}: `, which);
      }
    }
    const decisionRefMap = decisionsBy.get(decisionRef ?? refTree ?? "") ?? new Map<string, DecisionCounts>();
    const holdDecisionLines = decisionLines(holdMoved.map((k) => ({ direction: direction(entryOf(fromSnap, k) as Entry, entryOf(after, k) as Entry), before: decisionRefMap.get(k), after: decisionsBy.get(`${tree}#${vi}`)?.get(k) })), plain ? "against the plain tree" : baseTree ? `against base ${values.base}` : `against ${refLabel}'s code`);
    const mixedLines = mixedPerHit(mixed, (refTree && perHit.get(refTree)) || new Map(), perHit.get(`${tree}#${vi}`) ?? new Map());
    const hitLines = values.hits ? hitChanges(moved, (refTree && hitRows.get(refTree)) || new Map(), hitRows.get(`${tree}#${vi}`) ?? new Map()) : undefined;
    const holdLines = values.hits ? holdChanges(moved, (refTree && holdRows.get(refTree)) || new Map(), holdRows.get(`${tree}#${vi}`) ?? new Map()) : undefined;
    // A variant's own hits (round 13, holds-and-placement report point 3: which hits a reading moved took two `zmdlogs
    // hits` runs and a diff per log): against the plain tree, the same code without the variant, measured beside it.
    const ownMoved = values.hits && plain ? keys.filter((k) => !isHoldout(k) && JSON.stringify(entryOf(plain as Snapshots, k)) !== JSON.stringify(entryOf(after, k))) : [];
    const ownLines = values.hits && plain ? hitChanges(ownMoved, hitRows.get(`${tree}#plain`) ?? new Map(), hitRows.get(`${tree}#${vi}`) ?? new Map()) : undefined;
    if (hitLines?.full.length || holdLines?.full.length || ownLines?.full.length) writeFileSync(join(dir, "hits.txt"), [...(hitLines?.full ?? []), ...(holdLines?.full.length ? ["", "Hidden holds:", ...holdLines.full] : []), ...(ownLines?.full.length ? ["", "Against the plain tree (the variant's own effect):", ...ownLines.full] : [])].join("\n") + "\n");

    writeFileSync(join(dir, VERIFIED), formatSnapshot(after.verified as Entries, true));
    const files = splitPending(after.pending);
    writeFileSync(join(dir, PENDING), formatSnapshot(files.pending, true));
    writeFileSync(join(dir, HOLDOUT), formatSnapshot(files.holdout, true));
    writeFileSync(join(dir, "accuracy.md"), render(after, await operatorNames()));
    const lines = [
      ...(vi === 0 ? referenceLine : []),
      // A code error caught per cast reads as lost landings (round 21): said before the numbers it makes.
      ...((n) => (n ? [`The replay threw a code error, caught per cast, so these numbers are no measurement: ${n}`] : []))(threwNote(threwBy.get(`${tree}#${vi}`) ?? new Map(), keys.length)),
      // The tree's own change first, when variants are measured beside it (round 20: it was measured, not printed).
      ...(vi === 0 && plain ? [`The plain tree (${what}, no variant) against the reference:`, ...compare(before, plain).map((l) => `  ${l}`), ""] : []),
      `Accuracy of ${what}${v.text ? `, variant ${vi + 1} under ${v.text}` : ""} (${keys.length} logs measured${keys.length < logKeys(tree).length ? "; the rest as the reference has them" : ""}):`,
      ...compare(before, after),
      ...(plain ? [`Variant ${vi + 1} against the plain tree (the same code${values.assume.length ? ` under ${values.assume.join(", ")}` : ""}, no variant): the variant's own effect`, ...compare(plain, after).map((l) => `  ${l}`)] : []),
      ...mixedLines,
      ...(hitLines ? [...hitLines.summary, ...(hitLines.full.length ? [`  (every changed hit: ${join(dir, "hits.txt")})`] : [])] : []),
      ...(holdLines?.summary ?? []),
      ...(ownLines ? [`Variant ${vi + 1}'s own hits, against the plain tree:`, ...ownLines.summary.map((l) => `  ${l}`)] : []),
      ...sharesLines(sharesBy.get(`${tree}#${vi}`) ?? new Map(), after.split, baseTree ? sharesBy.get(baseTree) : undefined, baseTree ? `base ${values.base}` : undefined),
      ...kindLines(sharesBy.get(`${tree}#${vi}`) ?? new Map(), after.split, baseTree ? sharesBy.get(baseTree) : undefined, baseTree ? `base ${values.base}` : undefined),
      ...holdDecisionLines,
      ...(await negativeLines(v.readings, label)),
      ...(vi === 0 ? untimedLine() : []),
      ...(values.patch !== undefined && values.set.length && vi === 0 ? [`The --set patch (for docs/tried/): ${values.patch}`] : []),
      ...(variantPatches.has(vi) ? [`Variant ${vi + 1}'s --set patch (for docs/tried/): ${variantPatches.get(vi) as string}`] : []),
    ];
    if (keys.length === logKeys(tree).length && !baseTree) {
      const same = [VERIFIED, PENDING, HOLDOUT].every((f) => readFileSync(join(dir, f), "utf8") === readTracked(tree, `tests/snapshots/${f}`));
      lines.push(same ? "The log verdict snapshots would stay as they are (byte for byte)." : "The log verdict snapshots would change: `npm run snapshots:update` before committing.");
    }
    writeFileSync(join(dir, "summary.txt"), lines.join("\n") + "\n");
    allLines.push(...(allLines.length ? [""] : []), ...lines);
  }
  // This run's moved logs on record, and the earlier measures' that moved the same ones (moved.json; never a hold-out's name).
  if (before && whole) {
    const queued = values.queued ?? new Date().toISOString();
    const movedKeys = keys.filter((k) => JSON.stringify(entryOf(before as Snapshots, k)) !== JSON.stringify(entryOf(whole as Snapshots, k)));
    const record: MovedRecord = { queued, code: what, moved: movedKeys.filter((k) => !isHoldout(k)), holdouts: movedKeys.filter(isHoldout) };
    writeFileSync(join(out, "moved.json"), JSON.stringify({ ...record, holdouts: record.holdouts.length }, null, 1) + "\n");
    // The hold-outs' keys stay in memory only: a count of the shared ones is printed.
    const lines = interactLines(out, record);
    if (lines.length) {
      allLines.push("", ...lines);
      writeFileSync(join(out, "summary.txt"), allLines.join("\n") + "\n");
    }
  }
  if (values.split !== undefined && baseTree && before && whole) {
    const lines = await splitParts(values.split as "files" | "commits" | "hunks", { base: values.base as string, baseTree, code: values.at ?? snapshot ?? snapshotCommit(ROOT).commit, groups: values.group, ...(values.only !== undefined ? { only: values.only } : {}), keys: order, before, whole, split, measure: async (t, label, which) => {
      const got = await measureTree(t, label, which, assume, `${t}#split`);
      // A part whose replay threw (a name only another hunk declares) is no measurement: "not measured alone" (round 21).
      const note = threwNote(threwBy.get(`${t}#split`) ?? new Map(), which.length);
      if (note) throw new Error(note);
      return got;
    } });
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
 * a log, an operator or a key (docs/design/tests.md "What a hold-out output may say"). With `before` each gross as
 * before → after.
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

/**
 * The moved hold-outs' replay decisions (MeasureAnswer.decisions) as net changes per kind, summed per direction (round
 * 18, the placement-cases report point 2: a data-right change cost one hold-out 23 plain and nothing said whether a
 * replay rule acted there): "worse (1): JUMPDROP −3, MADE +1". Kinds and counts only, never a log. Nothing where no
 * hold-out moved; a direction whose hold-outs lack a side says so.
 */
export function decisionLines(moved: readonly { readonly direction: string; readonly before: DecisionCounts | undefined; readonly after: DecisionCounts | undefined }[], against = "against the reference"): string[] {
  if (!moved.length) return [];
  const by = new Map<string, { n: number; missing: number; net: Map<string, number> }>();
  for (const m of moved) {
    const d = by.get(m.direction) ?? { n: 0, missing: 0, net: new Map<string, number>() };
    by.set(m.direction, d);
    d.n++;
    if (!m.before || !m.after) {
      d.missing++;
      continue;
    }
    for (const k of new Set([...Object.keys(m.before), ...Object.keys(m.after)])) d.net.set(k, (d.net.get(k) ?? 0) + (m.after[k] ?? 0) - (m.before[k] ?? 0));
  }
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
  const out = [`The moved hold-outs' replay decisions, ${against} (zmdlogs decisions' kinds: net change per kind, summed per direction; counts only):`];
  for (const [dir, d] of by) {
    const parts = [...d.net].filter(([, n]) => n !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, n]) => `${k} ${signed(n)}`);
    out.push(`  ${dir} (${d.n}): ${parts.length ? parts.join(", ") : "no decision kind's count moved"}${d.missing ? ` (${d.missing} without decisions on a side: that commit's code has none)` : ""}`);
  }
  return out;
}


/** A --set entry: a constant's one-line declaration in a file, set to a value. */
export interface SetEntry {
  readonly file: string;
  readonly name: string;
  readonly value: string;
}

/** Whether a --variant entry is a --set's `<file>:<CONST>=<value>` (not an assumption's `<id>=<reading>`). */
export const isSetEntry = (x: string) => /^[^=:]+:[A-Za-z_$][\w$]*=/.test(x);

/** Whether a --variant entry is a --variant-patch's `patch:<file>` (measureOptions adds them). */
export const isPatchEntry = (x: string) => x.startsWith("patch:");

export function parseSet(x: string): SetEntry {
  const m = /^([^=:]+):([A-Za-z_$][\w$]*)=(.+)$/.exec(x);
  if (!m) throw new Error(`--set takes <file>:<CONST>=<value> (got ${x})`);
  return { file: (m[1] as string).replace(/^\.\//, ""), name: m[2] as string, value: m[3] as string };
}

/** A file's text with the --set entries on it applied (each one-line declaration `[export] const NAME[: T] = …;`, exactly one per name). */
export function applySets(file: string, text: string, sets: readonly SetEntry[]): string {
  const lines = text.split("\n");
  for (const e of sets) {
    const re = new RegExp(`^(\\s*(?:export\\s+)?const\\s+${e.name}\\s*(?::[^=]+)?=\\s*)(.*?)(;\\s*(?://.*)?)$`);
    const at = lines.flatMap((l, i) => (re.test(l) ? [i] : []));
    if (at.length !== 1) throw new Error(`--set ${file}:${e.name}: ${at.length ? `${at.length} one-line declarations of it` : `no one-line declaration \`const ${e.name} = …;\``} in ${file}`);
    const i = at[0] as number;
    const m = re.exec(lines[i] as string) as RegExpExecArray;
    lines[i] = `${m[1]}${e.value}${m[3]}`;
  }
  return lines.join("\n");
}

/** A unified diff of a file whose lines were replaced one for one (applySets): a hunk per run of changes, 3 lines of context. */
export function replacementDiff(file: string, was: string, now: string): string {
  const [a, b] = [was.split("\n"), now.split("\n")];
  // The lines a diff counts: without the empty string after a final newline.
  const n = was.endsWith("\n") ? a.length - 1 : a.length;
  const changed = a.slice(0, n).flatMap((l, i) => (l !== b[i] ? [i] : []));
  if (!changed.length) return "";
  const hunks: [number, number][] = [];
  for (const i of changed) {
    const [from, to] = [Math.max(0, i - 3), Math.min(n, i + 4)];
    const last = hunks.at(-1);
    if (last && from <= last[1]) last[1] = to;
    else hunks.push([from, to]);
  }
  const out = [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`];
  for (const [from, to] of hunks) {
    out.push(`@@ -${from + 1},${to - from} +${from + 1},${to - from} @@`);
    for (let i = from; i < to; i++) out.push(...(a[i] === b[i] ? [` ${a[i]}`] : [`-${a[i]}`, `+${b[i]}`]));
  }
  return out.join("\n") + "\n";
}

/** The files a unified diff changes (its `+++ b/…` lines). */
const diffFiles = (diff: string) => new Set([...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1] as string));

/**
 * --set's patch: `patch` (a --patch's diff, or empty) and the constants set, each file's text read by `show` (the code
 * measured). A constant in a file the --patch changes is refused: set it in the diff itself.
 */
export function combinedPatch(patch: string, sets: readonly SetEntry[], show: (file: string) => string): string {
  const byFile = new Map<string, SetEntry[]>();
  for (const s of sets) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s]);
  const touched = diffFiles(patch);
  let out = patch && !patch.endsWith("\n") ? `${patch}\n` : patch;
  for (const [file, es] of byFile) {
    if (touched.has(file)) throw new Error(`--set ${file}: the --patch changes that file too: set the constant in the diff itself`);
    const text = show(file);
    out += replacementDiff(file, text, applySets(file, text, es));
  }
  return out;
}

/** The checks of --set (and a --variant's sets) on the working tree, before the run queues: each declaration found once. */
export function setsProblem(values: { readonly set: readonly string[]; readonly variant: readonly string[] }, root = ROOT): string | null {
  for (const x of [...values.set, ...values.variant.flatMap((v) => v.split(",")).filter(isSetEntry)]) {
    try {
      const e = parseSet(x);
      const path = join(root, e.file);
      if (!existsSync(path)) return `measure: --set ${x}: no file ${e.file}`;
      applySets(e.file, readFileSync(path, "utf8"), [e]);
    } catch (err) {
      return `measure: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return null;
}

/** One hunk of a unified diff: its file, the file's header lines, the hunk's text, its `split:<name>` marker, a label. */
export interface DiffHunk {
  readonly file: string;
  readonly header: string;
  readonly text: string;
  readonly marker?: string;
  readonly label: string;
}

/**
 * A unified diff's hunks (`git diff` output): per file its header (diff --git … +++ b/…) and each `@@` hunk; a file
 * section with no hunk (binary, a mode change) is one hunk of its own. A hunk's marker is the first `split:<name>` on
 * one of its changed lines (a comment the author puts there: the hunks of one rule measured as one part).
 */
export function diffHunks(diff: string): DiffHunk[] {
  const out: DiffHunk[] = [];
  const sections = diff.split(/^(?=diff --git )/m).filter((x) => x.startsWith("diff --git "));
  for (const sec of sections) {
    const lines = sec.replace(/\n$/, "").split("\n");
    const file = /^diff --git a\/(.+?) b\//.exec(lines[0] as string)?.[1] ?? "?";
    const first = lines.findIndex((l) => l.startsWith("@@"));
    if (first < 0) {
      out.push({ file, header: lines.join("\n"), text: "", label: file });
      continue;
    }
    const header = lines.slice(0, first).join("\n");
    let cur: string[] = [];
    const flush = () => {
      if (!cur.length) return;
      const marker = cur.slice(1).find((l) => /^[-+]/.test(l) && /\bsplit:[\w.-]+/.test(l))?.match(/\bsplit:([\w.-]+)/)?.[1];
      const at = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(cur[0] as string)?.[1] ?? "?";
      out.push({ file, header, text: cur.join("\n"), ...(marker ? { marker } : {}), label: `${file}:${at}` });
      cur = [];
    };
    for (const l of lines.slice(first)) {
      if (l.startsWith("@@")) flush();
      cur.push(l);
    }
    flush();
  }
  return out;
}

/** The most parts --split hunks measures (each about one measure of the moved logs): more needs markers or --only. */
export const MAX_HUNK_PARTS = 24;

/**
 * --split hunks' parts: the hunks of one marker together, every other hunk alone; with `only` (comma-separated path
 * prefixes) only those files' hunks apart, every other file's together as "the rest". Hold-out fixtures are one part,
 * named by their count. Each part's patch: its files' headers with their hunks.
 */
export function hunkParts(hunks: readonly DiffHunk[], only?: string): { readonly label: string; readonly patch: string }[] {
  const ps = only?.split(",").map((p) => p.trim()).filter(Boolean);
  const apart = (f: string) => !ps || ps.some((p) => f === p || f.startsWith(p));
  const parts = new Map<string, { label: string; hunks: DiffHunk[] }>();
  const add = (key: string, label: string, h: DiffHunk) => {
    const p = parts.get(key) ?? { label, hunks: [] };
    p.hunks.push(h);
    parts.set(key, p);
  };
  for (const h of hunks) {
    if (h.file.startsWith("fixtures/holdout/")) add("holdout", "", h);
    else if (!apart(h.file)) add("rest", "", h);
    else if (h.marker) add(`marker:${h.marker}`, `split:${h.marker}`, h);
    else add(`hunk:${h.label}`, h.label, h);
  }
  const holdFiles = new Set(parts.get("holdout")?.hunks.map((h) => h.file) ?? []).size;
  const restFiles = new Set(parts.get("rest")?.hunks.map((h) => h.file) ?? []).size;
  if (parts.has("holdout")) (parts.get("holdout") as { label: string }).label = `fixtures/holdout/ (${holdFiles} file(s))`;
  if (parts.has("rest")) (parts.get("rest") as { label: string }).label = `the rest (${restFiles} file(s))`;
  const patchOf = (hs: readonly DiffHunk[]) => {
    const byFile = new Map<string, DiffHunk[]>();
    for (const h of hs) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);
    return [...byFile.values()].map((fh) => [(fh[0] as DiffHunk).header, ...fh.map((h) => h.text).filter(Boolean)].join("\n")).join("\n") + "\n";
  };
  const out = [...parts.values()].map((p) => ({ label: p.label, patch: patchOf(p.hunks) }));
  if (out.length > MAX_HUNK_PARTS) throw new Error(`--split hunks: ${out.length} parts, over ${MAX_HUNK_PARTS} (each about a measure of the moved logs): mark the hunks of one rule with a \`split:<name>\` comment, or name the files with --only`);
  return out;
}

/** `<id>=<reading>` pairs as readings (--assume, --variant). */
/**
 * The readings of --assume and --variant checked against the kits' and the engine's registered assumptions (a
 * misspelt id or reading fails here, before the queue, not after it). Loads the game data: seconds.
 */
export async function readingsProblem(values: { readonly assume: readonly string[]; readonly variant: readonly string[] }): Promise<string | null> {
  const list = [...values.assume, ...values.variant.flatMap((x) => x.split(",")).filter((x) => !isSetEntry(x) && !isPatchEntry(x))];
  if (!list.length) return null;
  const [{ loadGameData }, { allAssumptions }] = await Promise.all([import("@efsim/data"), import("@efsim/engine")]);
  const known = allAssumptions(loadGameData());
  for (const [id, reading] of list.map((x) => Object.entries(parseReadings([x]))[0] as [string, string])) {
    const a = known.find((x) => x.id === id);
    if (!a) return `measure: no assumption ${id} (the kits' and the engine's: ${known.map((x) => x.id).join(", ")})`;
    if (!(reading in a.readings)) return `measure: ${id} has no reading ${reading} (${Object.keys(a.readings).join(", ")})`;
  }
  return null;
}

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
  return { commit, changed: codeFilesChanged(commit, ref) };
}

/** How many code files differ between two commits (docs, Markdown and snapshots aside). */
function codeFilesChanged(from: string, to: string): number {
  return git(["diff", "--name-only", from, to]).split("\n").filter((f) => f && !f.startsWith("docs/") && !f.startsWith("tests/snapshots/") && !f.endsWith(".md")).length;
}

/** The merge base of `ref` and main, with how many code files changed from the snapshots' writer to it; null without a main. */
function mainBase(ref: string, writer: string): { readonly commit: string; readonly changedFromWriter: number } | null {
  const r = spawnSync("git", ["merge-base", ref, "main"], { cwd: ROOT, encoding: "utf8" });
  const commit = r.status === 0 ? r.stdout.trim() : "";
  return commit ? { commit, changedFromWriter: codeFilesChanged(writer, commit) } : null;
}

/**
 * The reference of a measure that names none (no --base, --against, --at; alesh-rare-fin report point 1: the first
 * measure of a task, against snapshots 51 code files older than main's code, mixed main's unmeasured merges into the
 * task's change, and only a second measure with --base gave the change alone). The snapshots at `against` when its own
 * code wrote them, or when they are the code's own at the merge base with main (the branch's commits are then the change
 * measured); otherwise the merge base's code, measured as --base (a base run: the measure's CPU doubles, the price of a
 * first measure that means what it says). `--against-snapshots` keeps the snapshots (referenceNote then says so).
 */
export function defaultReference(against: string, writer: { readonly commit: string; readonly changed: number }, base: { readonly commit: string; readonly changedFromWriter: number } | null, short: (ref: string) => string = (r) => r.slice(0, 9)): { readonly base?: string; readonly lines: readonly string[] } {
  if (!writer.changed) return { lines: [] };
  if (!base) return { lines: referenceNote(against, writer, short) };
  if (!base.changedFromWriter) return { lines: [`Reference: the snapshots at ${against} are the code's own at the merge base with main (${short(base.commit)}; written by ${short(writer.commit)}): the comparison is this branch's change.`] };
  return { base: base.commit, lines: [`Reference: the snapshots at ${against} were written by ${short(writer.commit)}'s code, and ${base.changedFromWriter} code file(s) changed from it to the merge base with main: that commit's code (${short(base.commit)}) is measured as --base, so the comparison is this branch's and tree's change alone (--against-snapshots compares with the snapshots instead).`] };
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
 * Hold-out fixtures are one part, named by their count only. With `only` (--only a,b: comma-separated path prefixes),
 * two parts: the files under them and every other code file (0c14-and-operator-curve report point 4: which of two files
 * moved 9c6e took five parts, 35 minutes).
 */
export function splitGroups(files: readonly string[], groups: readonly string[], only?: string, links: readonly (readonly string[])[] = []): { readonly label: string; readonly files: readonly string[] }[] {
  const code = files.filter((f) => !NOT_CODE(f));
  if (only !== undefined) {
    const ps = only.split(",").map((p) => p.trim()).filter(Boolean);
    const named = code.filter((f) => ps.some((p) => f === p || f.startsWith(p)));
    const rest = code.filter((f) => !named.includes(f));
    if (!named.length) throw new Error(`--only ${only}: no changed code file under it (changed: ${code.filter((f) => !f.startsWith("fixtures/holdout/")).join(", ") || "none"})`);
    const restLabel = rest.some((f) => f.startsWith("fixtures/holdout/")) ? `the rest (${rest.filter((f) => !f.startsWith("fixtures/holdout/")).length} file(s), hold-out fixtures among them)` : `the rest (${rest.length} file(s))`;
    return [{ label: ps.join(", "), files: named }, ...(rest.length ? [{ label: restLabel, files: rest }] : [])];
  }
  const prefixes = groups.map((g) => g.split(",").map((p) => p.trim()).filter(Boolean));
  const out: { label: string; files: string[] }[] = prefixes.map((ps) => ({ label: ps.join(", "), files: [] }));
  const hold: string[] = [];
  const alone: { label: string; files: string[] }[] = [];
  // Files linked by a new export (importLinks), none of them under a --group: one part, its files named.
  const linked = new Map<string, { label: string; files: string[] }>();
  for (const f of code) {
    const g = prefixes.findIndex((ps) => ps.some((p) => f === p || f.startsWith(p.endsWith("/") ? p : `${p}/`) || f.startsWith(p)));
    if (g >= 0) (out[g] as { files: string[] }).files.push(f);
    else if (f.startsWith("fixtures/holdout/")) hold.push(f);
    else {
      const link = links.find((l) => l.includes(f));
      if (!link) {
        alone.push({ label: f, files: [f] });
        continue;
      }
      const key = link.join("|");
      const part = linked.get(key) ?? { label: "", files: [] };
      part.files.push(f);
      linked.set(key, part);
      if (part.files.length === 1) alone.push(part);
    }
  }
  for (const part of linked.values()) part.label = part.files.length > 1 ? `${part.files.join(" + ")} (linked by a new export)` : (part.files[0] as string);
  return [...out.filter((g) => g.files.length), ...alone, ...(hold.length ? [{ label: `fixtures/holdout/ (${hold.length} file(s))`, files: hold }] : [])];
}

/** The names a TypeScript text exports by declaration (export function / const / class / interface / type / enum), and from `export { … }`. */
export function exportedNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1] as string);
  for (const m of text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) for (const n of (m[1] as string).split(",")) {
    const name = n.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, "").trim();
    if (name) out.add(name);
  }
  return out;
}

/** A TypeScript text's named imports: each with the module specifier it comes from. */
export function importedNames(text: string): { readonly from: string; readonly names: readonly string[] }[] {
  return [...text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/gm)].map((m) => ({
    from: m[2] as string,
    names: (m[1] as string).split(",").map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim() ?? "").filter(Boolean),
  }));
}

/**
 * The changed TypeScript files that can't be measured apart (round 16, the slots-and-paths report point 3: a new
 * export in paths.ts used by drivers.ts, timeline.ts and castassembly.ts made three parts "not measured alone", and
 * the `--group` the message named a second run): a file importing a name another changed file adds (exported at the
 * code, not at the base) is linked to it, through a relative import or a package's (`@efsim/<pkg>`: any changed file
 * under packages/<pkg>/src/ adding it). The linked sets, each of two or more files, sorted.
 */
export function importLinks(files: readonly { readonly path: string; readonly text: string; readonly baseText: string | null }[]): string[][] {
  const ts = files.filter((f) => f.path.endsWith(".ts"));
  const added = new Map(ts.map((f) => {
    const before = f.baseText === null ? new Set<string>() : exportedNames(f.baseText);
    return [f.path, new Set([...exportedNames(f.text)].filter((n) => !before.has(n)))] as const;
  }));
  const parent = new Map(ts.map((f) => [f.path, f.path]));
  const find = (x: string): string => {
    const p = parent.get(x) as string;
    return p === x ? x : find(p);
  };
  const unite = (a: string, b: string) => parent.set(find(a), find(b));
  for (const f of ts) {
    for (const imp of importedNames(f.text)) {
      const pkg = /^@efsim\/([a-z]+)/.exec(imp.from)?.[1];
      const targets = imp.from.startsWith(".") ? ts.filter((t) => t.path === resolve("/", dirname(f.path), imp.from).slice(1)) : pkg ? ts.filter((t) => t.path.startsWith(`packages/${pkg}/src/`)) : [];
      for (const t of targets) if (t.path !== f.path && imp.names.some((n) => added.get(t.path)?.has(n))) unite(f.path, t.path);
    }
  }
  const sets = new Map<string, string[]>();
  for (const f of ts) sets.set(find(f.path), [...(sets.get(find(f.path)) ?? []), f.path]);
  return [...sets.values()].filter((s) => s.length > 1).map((s) => s.sort());
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
  // allLogs keys a hold-out as under pending/ (its key before 2026-11-16): its group says it is one (round 18: by the key
  // alone, a hold-out moved by the whole change and by no part was named among the logs "by no part alone").
  const held = new Set([...allLogs(before), ...allLogs(whole), ...parts.flatMap((p) => [...allLogs(p.to)])].filter(([, l]) => l.group === "holdout").map(([k]) => k));
  const isHeld = (k: string) => isHoldout(k) || isHoldoutKey(k, before.split) || isHoldoutKey(k, whole.split) || held.has(k);
  // The hold-outs the whole change moved, by direction: per part, how many it moves the same way alone (counts only,
  // round 18, the replay-only report point 1: "the hold-out the whole change made worse is this part's" is a count).
  const dirOf = (a: Snapshots, b: Snapshots, k: string) => {
    const [x, y] = [allLogs(a).get(k), allLogs(b).get(k)];
    return x && y ? direction(x.entry, y.entry) : "new";
  };
  const heldWhole = [...wholeMoved].filter(isHeld).map((k) => [k, dirOf(before, whole, k)] as const);
  const heldLine = (p: { readonly from: Snapshots; readonly to: Snapshots }): string[] => {
    if (!heldWhole.length) return [];
    const by = new Map<string, { n: number; same: number }>();
    for (const [k, d] of heldWhole) {
      const x = by.get(d) ?? { n: 0, same: 0 };
      by.set(d, x);
      x.n++;
      if (dirOf(p.from, p.to, k) === d) x.same++;
    }
    return [`  of the hold-outs the whole change moved: ${[...by].map(([d, x]) => `${d} ${x.n} (this part alone: ${x.same} ${d})`).join(", ")}`];
  };
  for (const [i, p] of parts.entries()) {
    const moved = movedBy(p.from, p.to);
    if (!moved.size) {
      out.push(`Part ${i + 1}: ${p.label}: no log's verdicts moved`);
      continue;
    }
    out.push(`Part ${i + 1}: ${p.label}`, ...compare(p.from, p.to).filter((l) => !/: unchanged$/.test(l)).map((l) => `  ${l}`), ...heldLine(p));
    for (const k of moved) anyPart.add(k);
  }
  const name = (ks: readonly string[]) => {
    const hold = ks.filter(isHeld).length;
    return [...ks.filter((k) => !isHeld(k)).sort(), ...(hold ? [`${hold} hold-out(s)`] : [])].join(", ");
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
  readonly only?: string;
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
async function splitParts(how: "files" | "commits" | "hunks", r: SplitRun): Promise<string[]> {
  // allLogs keys a hold-out as under pending/ (round 18: by its holdout/ key every hold-out counted as moved).
  const moved = r.keys.filter((k) => {
    const lk = pairKey(k);
    const [a, b] = [allLogs(r.before).get(lk), allLogs(r.whole).get(lk)];
    return !a || !b || direction(a.entry, b.entry) !== "same";
  });
  const shortRef = (ref: string) => git(["rev-parse", "--short=9", ref]);
  // The refs as the queue pinned them (pinRefs): the split's diff is the whole change's, whatever was committed since.
  const head = `Split by ${how} against ${shortRef(r.base)}, the code at ${shortRef(r.code)} (each part measured on the ${moved.length} log(s) the whole change moved; the rest as the base has them):`;
  if (!moved.length) return [head, "  nothing to split: the whole change moved no log's verdicts"];
  const parts: { label: string; from: Snapshots; to: Snapshots }[] = [];
  const notes: string[] = [];
  if (how === "files") {
    const files = git(["diff", "--name-only", r.base, r.code]).split("\n").filter(Boolean);
    // A file and the changed files whose new exports it imports: one part (importLinks).
    const show = (ref: string, f: string) => {
      try {
        return execFileSync("git", ["show", `${ref}:${f}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
      } catch {
        return null;
      }
    };
    const links = r.only !== undefined ? [] : importLinks(files.filter((f) => f.endsWith(".ts") && !NOT_CODE(f)).map((f) => ({ path: f, text: show(r.code, f) ?? "", baseText: show(r.base, f) })));
    const groups = splitGroups(files, r.groups, r.only, links);
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
  } else if (how === "hunks") {
    const files = git(["diff", "--name-only", r.base, r.code]).split("\n").filter(Boolean);
    const code = files.filter((f) => !NOT_CODE(f));
    const left = files.length - code.length;
    if (!code.length) return [head, `  nothing to split: no code file changed (${left} doc or test file(s) left out)`];
    const diff = execFileSync("git", ["diff", "--binary", r.base, r.code, "--", ...code], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 });
    const groups = hunkParts(diffHunks(diff), r.only);
    const patches = join(ROOT, "scratch/measure/patches");
    mkdirSync(patches, { recursive: true });
    for (const [i, g] of groups.entries()) {
      const file = join(patches, `split-${process.pid}-hunk${i + 1}.diff`);
      writeFileSync(file, g.patch);
      const dir = resolve(ROOT, "scratch/at", `measure-${shortRef(r.base)}-hunk${i + 1}-${process.pid}`);
      try {
        atCommit(r.base, dir, file);
        const got = await r.measure(dir, `part ${i + 1} (${g.label}): `, moved);
        parts.push({ label: `${g.label} alone on ${r.base}`, from: r.before, to: overlay(r.before, got, r.split) });
      } catch (e) {
        // A hunk that doesn't apply or run alone (another hunk's context, a new export) is named, not fatal.
        notes.push(`  ${g.label}: not measured alone (${(e instanceof Error ? e.message : String(e)).split("\n")[0]}); mark it and the hunks it needs with one \`split:<name>\` comment`);
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
  // The worker's signatures ("12.34 s <operator> <skill>", measure-worker.ts placementOf) as casts, paired as the
  // library pairs placements (packages/logs/src/castpairs.ts: the casts that stay first, then the moved by nearest).
  const parse = (sig: string) => {
    const m = /^(-?[\d.]+) s (\S+) (\S+)$/.exec(sig);
    return { sig, operator: m?.[2] ?? sig, skillId: m?.[3] ?? "", start: m ? Number(m[1]) * 1000 : NaN };
  };
  for (const k of logs) {
    const p = pairCasts((before.get(k) ?? []).map(parse), (after.get(k) ?? []).map(parse));
    const changed = p.moved.length + p.gone.length + p.added.length;
    out.push(`  ${k}: ${changed ? `${p.moved.length} cast(s) moved, ${p.gone.length} only before, ${p.added.length} only now` : "the same casts; some hits moved between them"}`);
    const moved = p.moved.map(([a, b]) => `${a.sig} → ${(b.start / 1000).toFixed(2)} s`);
    for (const [sign, cs] of [["~", moved], ["-", p.gone.map((c) => c.sig)], ["+", p.added.map((c) => c.sig)]] as const) {
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
      moved.push(`unit ${i + 1}: ${x ? unit(x) : "-"} → ${y ? unit(y) : "-"} s${pinChange(x, y)}`);
    }
    const head = `  ${k}: hidden holds ${a.length} → ${b.length} units (${s(a.length * 512)} → ${s(b.length * 512)} s), ${moved.length ? `${moved.length} placed elsewhere or new or gone` : "placed as before"}`;
    summary.push(head, ...moved.slice(0, examples).map((m) => `    ${m}`), ...(moved.length > examples ? [`    … ${moved.length - examples} more (hits.txt)`] : []));
    if (moved.length) full.push(`${k}:`, ...moved.map((m) => `  ${m}`));
  }
  return { summary: summary.length ? ["Hidden holds of the logs whose entry moved (--hits; zmdlogs holds' units: placed (earliest–latest), s; the bounds that set a moved unit's earliest or latest, where they changed: holds --verbose's pins):", ...summary] : [], full };
}

/**
 * The clocks behind a moved hold unit (round 15, low-plain-low-mismatch report point 3: c4f3's units 10–21 moved 30 s
 * and no line said which clock moved them): per side (earliest, latest), the bounds pinning it now that didn't before
 * and those that no longer do (HoldUnit.earlyBy / lateBy; nothing where either side's code lacks them or they agree).
 */
export function pinChange(x: HoldUnit | undefined, y: HoldUnit | undefined): string {
  const side = (name: string, was: readonly string[] | undefined, now: readonly string[] | undefined): string[] => {
    if (!was || !now) return [];
    const [added, gone] = [now.filter((t) => !was.includes(t)), was.filter((t) => !now.includes(t))];
    return added.length || gone.length ? [`${name} ${[...added.map((t) => `+${t}`), ...gone.map((t) => `−${t}`)].join(", ")}`] : [];
  };
  const parts = [...side("earliest held back by", x?.earlyBy, y?.earlyBy), ...side("latest forced by", x?.lateBy, y?.lateBy)];
  return parts.length ? `; ${parts.join("; ")}` : "";
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

/** A file's text at a commit (untrimmed). */
function gitShow(ref: string, file: string): string {
  return execFileSync("git", ["show", `${ref}:${file}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
}

/**
 * A `--patch` without `--at` goes on top of the tree as queued, which holds the working tree's changes: a diff that is
 * one of those changes doesn't apply there (physical-statuses report point 1: a split of one batch's effect failed so
 * after waiting in the queue). Refused before queueing, with the form that measures it alone; null when fine.
 */
export function patchProblem(argv: readonly string[], root = ROOT): string | null {
  if (argv.some((a) => a === "--at" || a.startsWith("--at="))) return null;
  // --patch and each --variant-patch (round 22): every diff goes on top of the tree as queued.
  const files = argv.flatMap((a, i) => ((a === "--patch" || a === "--variant-patch") && argv[i + 1] !== undefined ? [[a, argv[i + 1] as string] as const] : []));
  for (const [flag, file] of files) {
    const check = (reverse: boolean) => spawnSync("git", ["apply", "--check", ...(reverse ? ["--reverse"] : []), resolve(file)], { cwd: root, encoding: "utf8" }).status === 0;
    if (check(false)) continue;
    if (check(true))
      return `measure: ${flag} ${file} is already in the working tree (it applies in reverse): without --at the patch goes on top of the tree as queued, which has it. To measure it alone: --at <the commit before it> ${flag} ${file} (that code plus only this diff)`;
    return `measure: ${flag} ${file} doesn't apply to the working tree (git apply --check): without --at it goes on top of the tree as queued; name the commit it was made against with --at <ref>`;
  }
  return null;
}

/**
 * The refs a queued run names (--at, --base, --against), pinned to their commits at queue time (round 21, the
 * interrupted-casts report point 2: `--at HEAD --split hunks` measured the whole change at the queued HEAD but split a
 * commit made during the wait). A --split without --base gets HEAD's commit as its base. A ref that doesn't resolve is
 * left as it is (main says so). Returns the new argv and a line per pinned ref.
 */
export function pinRefs(argv: readonly string[], resolveRef: (ref: string) => string | null): { argv: string[]; said: string[] } {
  const out = [...argv];
  const said: string[] = [];
  for (const name of ["at", "base", "against"]) {
    for (let i = 0; i < out.length; i++) {
      const a = out[i] as string;
      const eq = a.startsWith(`--${name}=`);
      if (a !== `--${name}` && !eq) continue;
      const ref = eq ? a.slice(name.length + 3) : out[i + 1];
      if (ref === undefined) continue;
      const commit = resolveRef(ref);
      if (!commit || commit.startsWith(ref)) continue;
      if (eq) out[i] = `--${name}=${commit}`;
      else out[i + 1] = commit;
      said.push(`--${name} ${ref} is ${commit.slice(0, 9)}`);
    }
  }
  if (out.some((a) => a === "--split" || a.startsWith("--split=")) && !out.some((a) => a === "--base" || a.startsWith("--base="))) {
    const head = resolveRef("HEAD");
    if (head) {
      out.push("--base", head);
      said.push(`--split's base HEAD is ${head.slice(0, 9)}`);
    }
  }
  return { argv: out, said };
}

/** A TypeScript name a line declares (const, let, var, function, class, interface, type, enum). */
const DECLARED = /\b(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;

/**
 * --split hunks, at queue time (round 21, the interrupted-casts report point 1): the parts whose added lines use a name
 * that only another part's added lines declare (not the base's text of the files touched), so the part can't run
 * alone. One line per such part: mark the hunks with one `split:<name>` comment.
 */
export function crossHunkNames(parts: readonly { readonly label: string; readonly patch: string }[], baseText: (file: string) => string): string[] {
  const added = (patch: string) => patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
  const filesOf = (patch: string) => [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1] as string);
  const info = parts.map((p) => {
    const lines = added(p.patch).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    const declares = new Set(lines.flatMap((l) => [...l.matchAll(DECLARED)].map((m) => m[1] as string)));
    // Identifiers outside strings and comments, roughly: a line's text before a `//`, string literals dropped.
    const uses = new Set(lines.flatMap((l) => [...l.replace(/\/\/.*$/, "").replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "").matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g)].map((m) => m[0])));
    return { label: p.label, declares, uses, files: filesOf(p.patch) };
  });
  const out: string[] = [];
  const base = new Map<string, string>();
  const known = (file: string, name: string) => {
    if (!base.has(file)) base.set(file, baseText(file));
    return new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(base.get(file) as string);
  };
  for (const p of info) {
    const missing = new Map<string, string>();
    for (const n of p.uses) {
      if (p.declares.has(n)) continue;
      const other = info.find((q) => q !== p && q.declares.has(n));
      if (!other || p.files.some((f) => known(f, n)) || other.files.some((f) => known(f, n))) continue;
      missing.set(n, other.label);
    }
    if (missing.size) out.push(`  ${p.label} uses ${[...missing].map(([n, o]) => `${n} (declared in ${o})`).join(", ")}: it can't run alone; mark it and those hunks with one \`split:<name>\` comment`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  // The options before anything else: --help prints the header's usage, a bad option fails in a second, not after the
  // queue's wait (round 13). Inside the lock (no lock file) main parses them again.
  if (printHelp(argv, import.meta.url)) process.exit(0);
  let problem: string | null = null;
  try {
    measureOptions(argv);
  } catch (e) {
    problem = `measure: ${e instanceof Error ? e.message : String(e)} (npm run measure -- --help for the options)`;
  }
  if (!problem && testLockFile()) problem = setsProblem(measureOptions(argv).values) ?? (await readingsProblem(measureOptions(argv).values));
  if (problem) {
    process.stderr.write(problem + "\n");
    process.stdout.write("EFSIM-DONE measure fail\n");
    process.exit(2);
  }
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
    const resolveRef = (ref: string) => {
      const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" });
      return r.status === 0 ? r.stdout.trim() : null;
    };
    // The refs as they are now (pinRefs): a commit made during the wait doesn't reach the run, its split included.
    const pinned = pinRefs(argv, resolveRef);
    if (pinned.said.length) process.stderr.write(`measure: pinned at queue time: ${pinned.said.join(", ")}\n`);
    const args = pinned.argv;
    // A --patch file (and each --variant-patch, round 22) as it is now (edits during the wait don't reach the run),
    // under scratch/measure/patches/, named after the original.
    args.forEach((a, pi) => {
      if ((a !== "--patch" && a !== "--variant-patch") || args[pi + 1] === undefined) return;
      const dir = join(ROOT, "scratch/measure/patches");
      mkdirSync(dir, { recursive: true });
      const original = args[pi + 1] as string;
      const copy = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${process.pid}-${pi}-${basename(original)}`);
      writeFileSync(copy, readFileSync(resolve(original)));
      args[pi + 1] = copy;
    });
    args.push("--queued", new Date().toISOString());
    if (!own) {
      const snap = snapshotCommit(ROOT);
      args.push("--snapshot", snap.commit.slice(0, 12), "--snapshot-head", snap.head.slice(0, 12));
      process.stderr.write(`measure: the code is fixed at queue time (${snap.dirty ? `a snapshot of the working tree, ${snap.commit.slice(0, 9)}` : `HEAD ${snap.head.slice(0, 9)}, the tree is clean`}): keep editing while it waits (--live reads the tree when the run starts)\n`);
    }
    // --split hunks: a part that can't run alone, said now rather than as a "not measured alone" after the wait.
    const opt = (name: string) => {
      const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
      return i < 0 ? undefined : (args[i] as string).includes("=") ? (args[i] as string).split("=").slice(1).join("=") : args[i + 1];
    };
    if (opt("split") === "hunks") {
      const [base, code] = [opt("base"), opt("at") ?? opt("snapshot")];
      if (base && code) {
        try {
          const files = git(["diff", "--name-only", base, code]).split("\n").filter((f) => f && !NOT_CODE(f));
          const parts = hunkParts(diffHunks(execFileSync("git", ["diff", base, code, "--", ...files], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 })), opt("only"));
          const show = (f: string) => spawnSync("git", ["show", `${base}:${f}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }).stdout ?? "";
          const warn = crossHunkNames(parts.filter((p) => !p.label.startsWith("fixtures/holdout/")), show);
          if (warn.length) process.stderr.write(`measure: --split hunks: parts that use a name only another part declares (measured anyway; each will read "not measured alone"):\n${warn.join("\n")}\n`);
        } catch (e) {
          process.stderr.write(`measure: --split hunks: the parts weren't checked at queue time (${e instanceof Error ? e.message.split("\n")[0] : String(e)})\n`);
        }
      }
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
