// State files of long runs (scripts/snapshots.sh, premerge, scripts/measure.ts), so that after a container restart
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

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const s: RunState = { job, started: new Date().toISOString(), code: codeId(), pid, boot: boot(), ...(note ? { note } : {}) };
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

function main(argv: string[]): number {
  const [cmd, job, ...rest] = argv;
  if (cmd === "start" && job) startRun(job, rest.join(" ") || undefined, process.ppid);
  else if (cmd === "end" && job && rest[0]) endRun(job, rest[0]);
  else if (cmd === undefined) process.stdout.write(describeRuns().join("\n") + "\n");
  else {
    process.stderr.write("usage: node scripts/runstate.ts [start <job> [note…] | end <job> <result>]\n");
    return 2;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
