// Before merging a branch into main (CLAUDE.md "Branches"): what `npm run check` doesn't cover, then the check itself,
// step by step. Expect about 15-20 min on this 4-core container, more under other agents' load and the test lock's
// queue: run it in the background with a limit of 2 h (the queue's wait counts against the limit). Round 10 moved
// scripts/premerge.sh's preconditions and done line here; the .sh is a one-line call of this file.
//
// First the preconditions (each failure ends the run, "fail"):
//   - the tree is clean (uncommitted work wouldn't be merged, and the check would run on it); hold-out paths only as
//     a count;
//   - in a worktree, its own packages are linked (scripts/setup-worktree.ts, run here), or the check runs the main
//     checkout's code;
//   - a branch that changes code, kits or examples also adds a journal entry (a file under docs/journal/: CLAUDE.md
//     "Journal and roadmap"); the journal step then checks that docs/journal.md is rebuilt from the entries.
// Then every step of `npm run check`, one after another to the end even when one fails, each timed, then a pass/fail
// table, then the branch's accuracy change (scripts/accuracy.ts --compare <merge base>) for the reviewer:
// - A vitest step whose only failures are timeouts ("Test timed out", "Hook timed out") re-runs just those files once,
//   alone. If they pass, the step passes and the table says "timeouts under load, passed on re-run" with the files:
//   on a machine shared with other agents, a 60 s test can take twice that without anything being wrong.
// - The two vitest steps take a lock shared by every worktree of the repository (scripts/testlock.ts: a queue in which
//   premerge goes ahead of measurement jobs), so parallel agents' suites and heavy jobs (scripts/with-lock.ts) queue
//   instead of slowing each other past the timeouts. EFSIM_NO_TEST_LOCK=1 skips it.
// - When typecheck or lint fails, the long steps after them are skipped (the table says so): a branch that doesn't
//   type-check or lint isn't ready whatever the tests say, and they take most of the run. --keep-going runs them anyway.
// - Each step prints its elapsed time and the load average before and after; a vitest step whose output isn't a
//   terminal also prints a line per finished file (scripts/vitest-progress.ts).
// The last line is `EFSIM-DONE premerge pass`, `fail` or `killed` (a signal, e.g. the Bash tool's background limit,
// stopped it: not a verdict), whatever the outcome: wait for that. "pass" only when every step passed
// (scripts/done-line.ts). Its run state: scratch/runs/premerge.json (node scripts/runstate.ts).
//
// Usage: node scripts/premerge.ts [base] [--keep-going]   (base: main by default; scripts/premerge.sh does the same)
//        node scripts/premerge.ts --only step,step [--keep-going]   just those steps (journal, typecheck, lint, test,
//                                                                   logs, tools): no preconditions, no accuracy
//                                                                   compare; its line `EFSIM-DONE premerge-only …`
// Exit code 0 only when every precondition and step passed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckoutOf } from "../packages/data/src/checkout.ts";
import { doneJob, type Runner } from "./done-line.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface Step {
  readonly name: string;
  readonly command: readonly string[];
  /** A vitest run: its JSON report tells timeouts from other failures. The config file, if not the default. */
  readonly vitest?: { readonly config?: string };
}

export const STEPS: readonly Step[] = [
  { name: "journal", command: ["node", "scripts/journal.ts", "--check"] },
  { name: "typecheck", command: ["npx", "tsc", "--noEmit"] },
  { name: "lint", command: ["npx", "eslint", "."] },
  { name: "test", command: ["npx", "vitest", "run"], vitest: {} },
  { name: "logs", command: ["npx", "vitest", "run", "--config", "vitest.logs.config.ts"], vitest: { config: "vitest.logs.config.ts" } },
  { name: "tools", command: ["npm", "run", "--silent", "test:tools"] },
];

/** The part of vitest's JSON report read here. */
export interface VitestReport {
  readonly testResults: readonly {
    readonly name: string;
    readonly status: string;
    readonly message?: string;
    readonly startTime?: number;
    readonly endTime?: number;
    readonly assertionResults: readonly { readonly status: string; readonly fullName: string; readonly failureMessages: readonly string[]; readonly duration?: number | null }[];
  }[];
}

const TIMEOUT = /\b(Test|Hook) timed out in \d+ms/;

/**
 * The files to re-run when every failure in a report is a timeout; null when any failure is something else (or the
 * report shows no failure at all, e.g. vitest itself failed before running).
 */
export function timeoutOnlyFiles(report: VitestReport): string[] | null {
  const files = new Set<string>();
  for (const f of report.testResults) {
    const failed = f.assertionResults.filter((a) => a.status === "failed");
    if (f.status !== "failed" && !failed.length) continue;
    if (!failed.length) {
      // A file-level failure (an import error, a failing hook outside any test): a timeout only if it says so.
      if (!TIMEOUT.test(f.message ?? "")) return null;
    } else if (!failed.every((a) => a.failureMessages.length > 0 && a.failureMessages.every((m) => TIMEOUT.test(m)))) return null;
    files.add(f.name);
  }
  return files.size ? [...files] : null;
}

/** The slowest files and single tests of a report, for spotting tests to split or move to tests/slow/. */
export function slowest(report: VitestReport, root: string, n = 8): string {
  const files = report.testResults.map((f) => ({ name: relative(root, f.name), s: ((f.endTime ?? 0) - (f.startTime ?? 0)) / 1000 })).sort((a, b) => b.s - a.s).slice(0, n);
  const tests = report.testResults
    .flatMap((f) => f.assertionResults.map((a) => ({ name: `${relative(root, f.name)} > ${a.fullName}`, s: (a.duration ?? 0) / 1000 })))
    .sort((a, b) => b.s - a.s)
    .slice(0, n);
  return [`slowest files: ${files.map((f) => `${f.name} ${f.s.toFixed(0)} s`).join(", ")}`, `slowest tests: ${tests.map((t) => `${t.name} ${t.s.toFixed(0)} s`).join("; ")}`].join("\n");
}

/** CLAUDE.md's limits for the default suite: a file over FILE_LIMIT seconds gets split, a test over TEST_LIMIT moves to tests/slow/. */
export const FILE_LIMIT = 40;
export const TEST_LIMIT = 30;

/** The default suite's files and tests over the limits (a warning line, or "" when none; times grow under load). */
export function overLimits(report: VitestReport, root: string): string {
  const files = report.testResults.filter((f) => ((f.endTime ?? 0) - (f.startTime ?? 0)) / 1000 > FILE_LIMIT).map((f) => relative(root, f.name));
  const tests = report.testResults.flatMap((f) => f.assertionResults.filter((a) => (a.duration ?? 0) / 1000 > TEST_LIMIT).map((a) => `${relative(root, f.name)} > ${a.fullName}`));
  if (!files.length && !tests.length) return "";
  return `over the limits at load ${load()} (CLAUDE.md "Correctness": split a file over ${FILE_LIMIT} s, move a test over ${TEST_LIMIT} s to tests/slow/; check on a quiet machine first): ${[...files, ...tests].join("; ")}`;
}

export interface Outcome {
  readonly step: string;
  readonly ok: boolean;
  readonly seconds: number;
  readonly note: string;
}

const load = () => loadavg().map((x) => x.toFixed(1)).join(" ");

/** The steps whose failure skips the rest (unless --keep-going): seconds to run, and they make the tests' verdict moot. */
export const GATES: ReadonlySet<string> = new Set(["typecheck", "lint"]);

/** vitest's reporters for a step: the default one, and a line per finished file when the output isn't a terminal. */
const reporters = () => ["--reporter=default", ...(process.stdout.isTTY ? [] : ["--reporter=./scripts/vitest-progress.ts"])];

/** A command under the shared test lock (scripts/testlock.ts as a child: a signal to premerge stops it and releases its ticket). */
export const locked = (command: readonly string[]): string[] => ["node", "scripts/testlock.ts", "--kind", "premerge", "--who", "premerge", "--", ...command];

async function runStep(step: Step, scratch: string, run: Runner): Promise<Outcome> {
  const start = performance.now();
  const before = load();
  process.stdout.write(`\n=== premerge: ${step.name} (${step.command.join(" ")}), load ${before}\n`);
  let ok: boolean;
  let note = "";
  if (!step.vitest) {
    ok = (await run(step.command)) === 0;
  } else {
    const out = join(scratch, `${step.name}.json`);
    ok = (await run(locked([...step.command, ...reporters(), "--reporter=json", `--outputFile.json=${out}`]))) === 0;
    if (existsSync(out)) {
      const report = JSON.parse(readFileSync(out, "utf8")) as VitestReport;
      process.stdout.write(`\npremerge: ${step.name}: ${slowest(report, ROOT)}\n`);
      const over = step.name === "test" ? overLimits(report, ROOT) : "";
      if (over) process.stdout.write(`premerge: ${step.name}: ${over}\n`);
    }
    if (!ok && existsSync(out)) {
      const files = timeoutOnlyFiles(JSON.parse(readFileSync(out, "utf8")) as VitestReport);
      if (files) {
        const names = files.map((f) => relative(ROOT, f));
        process.stdout.write(`\npremerge: ${step.name}: only timeouts failed (${names.join(", ")}); re-running those files alone\n`);
        const rerun = performance.now();
        ok = (await run(locked(["npx", "vitest", "run", ...(step.vitest.config ? ["--config", step.vitest.config] : []), ...reporters(), ...names]))) === 0;
        const s = ((performance.now() - rerun) / 1000).toFixed(0);
        note = ok ? `timeouts under load, passed on re-run (${s} s): ${names.join(", ")}` : `timed out, and failed again alone: ${names.join(", ")}`;
      }
    }
  }
  const seconds = (performance.now() - start) / 1000;
  process.stdout.write(`=== premerge: ${step.name} ${ok ? "passed" : "FAILED"} in ${seconds.toFixed(0)} s (load ${before} → ${load()})\n`);
  return { step: step.name, ok, seconds, note };
}

export function table(outcomes: readonly Outcome[]): string {
  const w = Math.max(...outcomes.map((o) => o.step.length), 4);
  const lines = outcomes.map((o) => `  ${o.step.padEnd(w)}  ${o.ok ? "pass" : o.note.startsWith("skipped") ? "skip" : "FAIL"}  ${o.seconds.toFixed(0).padStart(5)} s${o.note ? `  ${o.note}` : ""}`);
  const total = outcomes.reduce((s, o) => s + o.seconds, 0);
  return [`  ${"step".padEnd(w)}  ok    time`, ...lines, `  ${"all".padEnd(w)}  ${outcomes.every((o) => o.ok) ? "pass" : "FAIL"}  ${total.toFixed(0).padStart(5)} s`].join("\n");
}

/** Every step (or those of `only`), the gates skipping the rest on failure unless keepGoing; the table; 0 when all passed. */
async function runSteps(steps: readonly Step[], keepGoing: boolean, run: Runner): Promise<number> {
  const scratch = mkdtempSync(join(tmpdir(), "efsim-premerge-"));
  try {
    const outcomes: Outcome[] = [];
    let gateFailed: string | undefined;
    for (const s of steps) {
      if (gateFailed) {
        outcomes.push({ step: s.name, ok: false, seconds: 0, note: `skipped: ${gateFailed} failed (--keep-going runs it anyway)` });
        continue;
      }
      const o = await runStep(s, scratch, run);
      outcomes.push(o);
      if (!o.ok && GATES.has(s.name) && !keepGoing) gateFailed = s.name;
    }
    process.stdout.write(`\npremerge: the check, step by step (load now ${load()}):\n${table(outcomes)}\n`);
    return outcomes.every((o) => o.ok) ? 0 : 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const git = (args: readonly string[]) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout;
};

/** Code, kits or examples changed, but no journal entry added: the branch isn't ready (CLAUDE.md "Journal and roadmap"). */
export function missingJournal(changed: readonly string[]): boolean {
  return changed.some((f) => /^(packages|examples|schemas)\//.test(f)) && !changed.some((f) => /^docs\/journal\/\d{4}-/.test(f));
}

/** The uncommitted changes, for the refusal: named, but a hold-out fixture's only as a count (CLAUDE.md, hold-out logs). */
function dirtyTree(): string | undefined {
  if (!git(["status", "--porcelain"]).trim()) return undefined;
  const shown = git(["status", "--short", "--", ".", ":!fixtures/holdout"]).trimEnd();
  const held = git(["status", "--porcelain", "--", "fixtures/holdout"]).split("\n").filter(Boolean).length;
  return ["premerge: the tree has uncommitted changes:", ...(shown ? [shown] : []), ...(held ? [`  and ${held} file(s) under fixtures/holdout/ (not named)`] : [])].join("\n");
}

/** The preconditions, the steps and the accuracy compare: premerge's exit status. */
async function premerge(base: string, keepGoing: boolean, run: Runner): Promise<number> {
  const fail = (message: string) => {
    process.stderr.write(message + "\n");
    return 1;
  };
  const dirty = dirtyTree();
  if (dirty) return fail(dirty);
  if ((await run(["node", "scripts/setup-worktree.ts"])) !== 0) return fail("premerge: scripts/setup-worktree.ts failed");
  if (mainCheckoutOf(ROOT) !== null) {
    let linked: string | undefined;
    try {
      linked = realpathSync(join(ROOT, "node_modules", "@efsim", "engine"));
    } catch {
      linked = undefined;
    }
    if (linked !== realpathSync(join(ROOT, "packages", "engine"))) return fail("premerge: a worktree without its own packages linked, even after scripts/setup-worktree.ts");
  }
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  if (missingJournal(git(["diff", "--name-only", mergeBase, "HEAD"]).split("\n").filter(Boolean))) {
    return fail('premerge: the branch changes code, kits or examples but adds no journal entry (npm run journal:new -- "Title")');
  }
  const status = await runSteps(STEPS, keepGoing, run);
  // The branch's accuracy change (docs/accuracy.md, from the verdict snapshots) for the reviewer.
  await run(["node", "scripts/accuracy.ts", "--compare", mergeBase]);
  if (status !== 0) return fail("premerge: not ready: a step failed (the table above)");
  process.stdout.write(`premerge: ready to merge into ${base}\n`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const keepGoing = argv.includes("--keep-going");
  const i = argv.indexOf("--only");
  if (i >= 0) {
    const only = new Set((argv[i + 1] ?? "").split(","));
    const steps = STEPS.filter((s) => only.has(s.name));
    if (steps.length !== only.size) throw new Error(`--only takes steps from: ${STEPS.map((s) => s.name).join(", ")}`);
    return doneJob("premerge-only", argv.join(" "), (run) => runSteps(steps, keepGoing, run));
  }
  const positional = argv.filter((a) => !a.startsWith("--"));
  const unknown = argv.filter((a) => a.startsWith("--") && a !== "--keep-going");
  if (unknown.length || positional.length > 1) {
    process.stderr.write("usage: node scripts/premerge.ts [base] [--keep-going] | --only step,step [--keep-going]\n");
    return 2;
  }
  const base = positional[0] ?? "main";
  return doneJob("premerge", `against ${base}`, (run) => premerge(base, keepGoing, run));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main(process.argv.slice(2)).then((c) => (process.exitCode = c));
