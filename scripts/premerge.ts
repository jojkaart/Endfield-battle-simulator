// The check before a merge (scripts/premerge.sh runs it after its preconditions): every step of `npm run check`, run
// one after another to the end even when one fails, each timed, then a pass/fail table.
//
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
//
// Usage: node scripts/premerge.ts [--only step,step] [--keep-going]   (steps: journal, typecheck, lint, test, logs, tools)
// Exit code 0 only when every step passed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLocked } from "./testlock.ts";

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

function run(command: readonly string[]): number {
  const [cmd, ...args] = command as [string, ...string[]];
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  return r.status ?? 1;
}

function runStep(step: Step, scratch: string): Outcome {
  const start = performance.now();
  const before = load();
  process.stdout.write(`\n=== premerge: ${step.name} (${step.command.join(" ")}), load ${before}\n`);
  let ok: boolean;
  let note = "";
  if (!step.vitest) {
    ok = run(step.command) === 0;
  } else {
    const out = join(scratch, `${step.name}.json`);
    const status = runLocked([...step.command, ...reporters(), "--reporter=json", `--outputFile.json=${out}`], { kind: "premerge", who: "premerge" });
    ok = status === 0;
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
        const again = runLocked(["npx", "vitest", "run", ...(step.vitest.config ? ["--config", step.vitest.config] : []), ...reporters(), ...names], { kind: "premerge", who: "premerge" });
        ok = again === 0;
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

function main(argv: string[]): number {
  const i = argv.indexOf("--only");
  const only = i >= 0 ? new Set((argv[i + 1] ?? "").split(",")) : undefined;
  const steps = only ? STEPS.filter((s) => only.has(s.name)) : STEPS;
  if (only && steps.length !== only.size) throw new Error(`--only takes steps from: ${STEPS.map((s) => s.name).join(", ")}`);
  const keepGoing = argv.includes("--keep-going");
  const scratch = mkdtempSync(join(tmpdir(), "efsim-premerge-"));
  try {
    const outcomes: Outcome[] = [];
    let gateFailed: string | undefined;
    for (const s of steps) {
      if (gateFailed) {
        outcomes.push({ step: s.name, ok: false, seconds: 0, note: `skipped: ${gateFailed} failed (--keep-going runs it anyway)` });
        continue;
      }
      const o = runStep(s, scratch);
      outcomes.push(o);
      if (!o.ok && GATES.has(s.name) && !keepGoing) gateFailed = s.name;
    }
    process.stdout.write(`\npremerge: the check, step by step (load now ${load()}):\n${table(outcomes)}\n`);
    return outcomes.every((o) => o.ok) ? 0 : 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
