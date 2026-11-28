// The `EFSIM-DONE <job> pass|fail|killed` last line of a long script (premerge, snapshots), and its run state
// (scratch/runs/<job>.json, node scripts/runstate.ts). Round 10 ported it from scripts/done-line.sh, so no shell
// script keeps the logic.
//
// The verdict is "pass" only when the job's body returned 0 itself: never derived from an exit status after the fact.
// Round 5: a shell killed by a signal ran its EXIT trap with `$?` of the last command that finished, often 0, so
// premerge printed `EFSIM-DONE premerge pass` after a failed test step when the Bash tool's background limit stopped
// it while it waited for the test lock (tests/done-line.test.ts). A signal (TERM, INT, HUP) gives "killed": the
// running children are sent TERM, the line is printed at once, and the process exits with 128 + the signal's number.
// A thrown error gives "fail".
//
// Every command a job runs goes through `run` (asynchronous, so a signal is handled while it runs; a synchronous
// spawn would hold the signal until the child ended, and the child would outlive the job). `onKill(fn)` registers
// what a signal must undo before the line (snapshots: put the files back).
//
// Usage:
//   import { doneJob } from "./done-line.ts";
//   process.exitCode = await doneJob("premerge", "against main", async (run) => (await run(["node", "x.ts"])) === 0 ? 0 : 1);

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { endRun, startRun } from "./runstate.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Runs a command (stdio inherited, cwd the repository by default) as a child the job stops on a signal; its exit status. */
export type Runner = (command: readonly string[], options?: Pick<SpawnOptions, "cwd" | "env" | "stdio" | "signal">) => Promise<number>;

const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 } as const;
/** How long a signal waits for the running children to stop before the cleanups and the line. */
const STOP_WAIT_MS = 5000;
type Sig = keyof typeof SIGNALS;

/** The done line. */
export const doneLine = (job: string, verdict: "pass" | "fail" | "killed") => `EFSIM-DONE ${job} ${verdict}`;

/**
 * Runs a job's body with its run state and done line: "pass" when the body returns 0, "fail" when it returns anything
 * else or throws, "killed" on a signal (then the process exits). Returns the body's exit status (1 when it threw).
 */
export async function doneJob(job: string, note: string | undefined, body: (run: Runner, onKill: (cleanup: () => void) => void) => Promise<number>): Promise<number> {
  const children = new Set<ChildProcess>();
  const cleanups: (() => void)[] = [];
  let finished = false;
  const finish = (verdict: "pass" | "fail" | "killed") => {
    if (finished) return;
    finished = true;
    try {
      endRun(job, verdict);
    } catch {
      // the run state is only for after a restart
    }
    process.stdout.write(doneLine(job, verdict) + "\n");
  };
  let stopping = false;
  const onSignal = (sig: Sig) => {
    if (stopping) return;
    stopping = true;
    // TERM whatever the signal: a background child ignores INT. Then wait for them (a few seconds at most), so the
    // cleanups run after they stopped writing (snapshots puts the files back) and they don't linger as zombies.
    const running = [...children].filter((c) => c.exitCode === null && c.signalCode === null);
    const exited = running.map((c) => new Promise<void>((r) => c.once("exit", () => r())));
    for (const c of running) c.kill("SIGTERM");
    process.stderr.write(`${job}: stopped by ${sig}\n`);
    void Promise.race([Promise.all(exited), new Promise<void>((r) => setTimeout(r, STOP_WAIT_MS))]).then(() => {
      for (const c of cleanups) {
        try {
          c();
        } catch (e) {
          process.stderr.write(`${job}: ${e instanceof Error ? e.message : String(e)}\n`);
        }
      }
      finish("killed");
      process.exit(128 + SIGNALS[sig]);
    });
  };
  for (const sig of Object.keys(SIGNALS) as Sig[]) process.on(sig, onSignal);
  const run: Runner = (command, options = {}) =>
    new Promise<number>((done) => {
      const [cmd, ...args] = command as [string, ...string[]];
      const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", ...options });
      children.add(child);
      child.on("error", (e) => {
        process.stderr.write(`${job}: ${cmd}: ${e.message}\n`);
        children.delete(child);
        done(127);
      });
      child.on("exit", (code) => {
        children.delete(child);
        // Stopping: the body never sees this step end, so it starts nothing more.
        if (!stopping) done(code ?? 1);
      });
    });
  try {
    startRun(job, note);
  } catch {
    // as above
  }
  let status: number;
  try {
    status = await body(run, (cleanup) => cleanups.push(cleanup));
  } catch (e) {
    process.stderr.write(`${job}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    status = 1;
  }
  for (const sig of Object.keys(SIGNALS) as Sig[]) process.off(sig, onSignal);
  finish(status === 0 ? "pass" : "fail");
  return status;
}
