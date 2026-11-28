// State files of long runs (scripts/snapshots.ts, premerge, scripts/measure.ts), so that after a container restart
// (which kills background jobs and their monitors without a word) an agent sees at once which run was in flight, for
// which code, and whether it finished: scratch/runs/<job>.json, one per job, rewritten by each run.
//
// The code is named by the commit and a hash of the uncommitted changes (tracked diff and untracked files' names), so
// a result can be matched to the code now on disk. Commit work in progress before a long run, and the commit alone
// names it.
//
// Usage: node scripts/runstate.ts                       every job's last run: started, code, finished / interrupted
//        node scripts/runstate.ts start <job> [note…]   (the scripts call these)
//        node scripts/runstate.ts end <job> <result>
//        node scripts/runstate.ts --where [base]      where this worktree stands, in one call (round 24, round 23's own
//                                                report point 2: a status check was a tail per log, a git call each):
//                                                its branch and HEAD, the commits beyond base (main by default), the
//                                                uncommitted files (hold-outs as a count), each job's last run with
//                                                the last lines of the file its output went to (recorded at its start
//                                                where stdout was a file) and its EFSIM-DONE line, and how many other
//                                                worktrees have work (--touching names their files)
//        node scripts/runstate.ts --touching [base]   per other worktree (agents' .claude/worktrees/…, not scratch/at/),
//                                                the files its branch changed since its merge base with base (main
//                                                by default) and its uncommitted ones: what a parallel agent is in
//                                                (read-only; round 8: a refactor shrunk on a guess). Hold-out
//                                                fixtures only as a count.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { printHelp } from "./usage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RUNS_DIR = join(ROOT, "scratch", "runs");

export interface RunState {
  readonly job: string;
  readonly started: string;
  /** The commit, and "+<hash>" of the uncommitted changes when there are any. */
  readonly code: string;
  readonly pid: number;
  readonly boot: string;
  readonly note?: string;
  readonly finished?: string;
  readonly result?: string;
  /** The file its stdout went to, where that was a regular file (a background run's redirect): `--where` tails it. */
  readonly out?: string;
}

/** The regular file a file descriptor of this process writes to (Linux /proc), else undefined (a pipe, a terminal). */
function fdFile(fd: number): string | undefined {
  try {
    const target = readlinkSync(`/proc/self/fd/${fd}`);
    return target.startsWith("/") && existsSync(target) && statSync(target).isFile() ? target : undefined;
  } catch {
    return undefined;
  }
}

const git = (args: readonly string[]) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 }).stdout ?? "";
const boot = () => (existsSync("/proc/sys/kernel/random/boot_id") ? readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() : "");

/** The code on disk: the commit's short hash, plus a hash of the uncommitted changes when there are any. */
export function codeId(): string {
  const head = git(["rev-parse", "--short=9", "HEAD"]).trim();
  const diff = git(["diff", "HEAD", "--binary"]) + git(["ls-files", "--others", "--exclude-standard"]);
  return diff ? `${head}+${createHash("sha1").update(diff).digest("hex").slice(0, 8)}` : head;
}

const fileOf = (job: string) => join(RUNS_DIR, `${job.replace(/[^\w.-]/g, "_")}.json`);

export function startRun(job: string, note?: string, pid = process.pid): RunState {
  mkdirSync(RUNS_DIR, { recursive: true });
  const out = fdFile(1);
  const s: RunState = { job, started: new Date().toISOString(), code: codeId(), pid, boot: boot(), ...(note ? { note } : {}), ...(out ? { out } : {}) };
  writeFileSync(fileOf(job), JSON.stringify(s, null, 1) + "\n");
  return s;
}

export function endRun(job: string, result: string): void {
  const file = fileOf(job);
  const s = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as RunState) : { job, started: "?", code: "?", pid: 0, boot: "" };
  writeFileSync(file, JSON.stringify({ ...s, finished: new Date().toISOString(), result }, null, 1) + "\n");
}

function running(s: RunState): boolean {
  if (s.boot !== boot()) return false;
  try {
    process.kill(s.pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** A line per job's last run. */
export function describeRuns(now = codeId()): string[] {
  if (!existsSync(RUNS_DIR)) return ["no run recorded (scratch/runs/ is empty)"];
  return readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const s = JSON.parse(readFileSync(join(RUNS_DIR, f), "utf8")) as RunState;
      const state = s.finished ? `finished ${s.finished} (${s.result})` : running(s) ? "still running" : "interrupted: its process is gone (a container restart?); run it again";
      return `${s.job}: started ${s.started} at code ${s.code}${s.code === now ? " (the code now)" : `; the code now is ${now}`}${s.note ? `, ${s.note}` : ""}: ${state}`;
    });
}

/** A run's output file's last lines that aren't progress (`[n/m] …`), and its EFSIM-DONE line where it has one. */
export function tailOf(text: string, n = 3): { readonly last: readonly string[]; readonly done: string | null } {
  const lines = text.split("\n").filter((l) => l.trim() && !/^\[\d+\/\d+\]/.test(l));
  const done = lines.findLast((l) => /^EFSIM-DONE /.test(l)) ?? null;
  return { last: lines.filter((l) => !/^EFSIM-DONE /.test(l)).slice(-n), done };
}

/** `--where`: branch, HEAD, commits beyond `base`, uncommitted files, each run's state and tail, other worktrees with work. */
export function where(base = "main"): string[] {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const head = git(["rev-parse", "--short=9", "HEAD"]).trim();
  const mb = git(["merge-base", base, "HEAD"]).trim();
  const ahead = mb ? git(["log", "--oneline", "--no-decorate", `${mb}..HEAD`]).split("\n").filter(Boolean) : [];
  const dirty = git(["status", "--porcelain", "--untracked-files=normal"]).split("\n").filter(Boolean).map((l) => l.slice(3));
  const out = [`${branch} at ${head}: ${ahead.length} commit(s) beyond ${base}${mb ? ` (merge base ${mb.slice(0, 9)})` : ""}`, ...ahead.slice(0, 8).map((l) => `  ${l}`), ...(ahead.length > 8 ? [`  … ${ahead.length - 8} more`] : [])];
  out.push(dirty.length ? `uncommitted: ${dirty.length} path(s)` : "uncommitted: none", ...shown(dirty).slice(0, 12).map((p) => `  ${p}`));
  out.push("runs (scratch/runs/):", ...describeRuns().map((l) => `  ${l}`));
  if (existsSync(RUNS_DIR)) {
    for (const f of readdirSync(RUNS_DIR).filter((x) => x.endsWith(".json")).sort()) {
      const s = JSON.parse(readFileSync(join(RUNS_DIR, f), "utf8")) as RunState;
      if (!s.out || !existsSync(s.out)) continue;
      const t = tailOf(readFileSync(s.out, "utf8"));
      out.push(`  ${s.job}'s output ${s.out}: ${t.done ?? "no EFSIM-DONE line yet"}`, ...t.last.map((l) => `    ${l.slice(0, 200)}`));
    }
  }
  const others = touching(base).filter((l) => !l.startsWith(" "));
  out.push(`other worktrees: ${others.join("; ")} (--touching names their files)`);
  return out;
}

/** Paths to print, a hold-out fixture's only as a count (CLAUDE.md, hold-out logs). */
function shown(paths: readonly string[]): string[] {
  const hidden = paths.filter((p) => p.startsWith("fixtures/holdout/")).length;
  return [...paths.filter((p) => !p.startsWith("fixtures/holdout/")), ...(hidden ? [`(${hidden} file(s) under fixtures/holdout/, not named)`] : [])];
}

/** Per other worktree: its branch, the files it changed since its merge base with `base`, and its uncommitted ones. */
export function touching(base = "main", here = ROOT): string[] {
  const list = git(["worktree", "list", "--porcelain"]).split("\n\n").filter(Boolean);
  const out: string[] = [];
  let idle = 0;
  for (const block of list) {
    const dir = /^worktree (.+)$/m.exec(block)?.[1];
    const head = /^HEAD (\w+)$/m.exec(block)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? "(detached)";
    if (!dir || !head || resolve(dir) === resolve(here) || dir.includes("/scratch/at/")) continue;
    const mb = git(["merge-base", base, head]).trim();
    const committed = mb ? git(["diff", "--name-only", mb, head]).split("\n").filter(Boolean) : [];
    const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).stdout?.split("\n").filter(Boolean).map((l) => l.slice(3)) ?? [];
    if (!committed.length && !dirty.length) {
      idle++;
      continue;
    }
    out.push(`${dir} (${branch} at ${head.slice(0, 9)}): ${committed.length} file(s) changed since ${base}${dirty.length ? `, ${dirty.length} uncommitted` : ""}`);
    for (const f of shown(committed)) out.push(`  ${f}`);
    for (const f of shown(dirty)) out.push(`  ${f} (uncommitted)`);
  }
  return [...out, `${out.length ? "and " : ""}${idle} other worktree(s) with nothing beyond ${base}`];
}

function main(argv: string[]): number {
  const [cmd, job, ...rest] = argv;
  if (cmd === "--where") {
    process.stdout.write(where(job).join("\n") + "\n");
    return 0;
  }
  if (cmd === "--touching") {
    process.stdout.write(touching(job).join("\n") + "\n");
    return 0;
  }
  if (cmd === "start" && job) startRun(job, rest.join(" ") || undefined, process.ppid);
  else if (cmd === "end" && job && rest[0]) endRun(job, rest[0]);
  else if (cmd === undefined) process.stdout.write(describeRuns().join("\n") + "\n");
  else {
    process.stderr.write("usage: node scripts/runstate.ts [start <job> [note…] | end <job> <result> | --where [base] | --touching [base]]\n");
    return 2;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  process.exitCode = main(process.argv.slice(2));
}
