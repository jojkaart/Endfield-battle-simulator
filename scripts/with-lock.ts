// Runs a long CPU job under the lock premerge's test suites take (scripts/testlock.ts: a queue in arrival order, test
// suites and premerge ahead of jobs that arrived up to 20 min before them), so it queues behind other worktrees'
// suites and heavy jobs instead of running beside them: measurements stay comparable, and nobody's tests time out
// because someone is benchmarking. On stderr: the estimated wait at the start, a heartbeat line every minute while it
// waits, then the elapsed time (wait included) and the load average before and after. On stdout: only the command's
// own output, then a last line `EFSIM-DONE <name> exit <n>` to wait for (`EFSIM-DONE <name> killed` when a signal
// stopped it; name: --name, default with-lock). Wait for your own job's name: a script running several jobs prints
// several such lines.
//
// Wrap each job on its own: a shell script running several jobs holds the lock for the whole batch, so others wait
// for all of it (a warning says so; --batch silences it when that is really meant). Never wrap it in `timeout`: the
// queue's wait counts against the limit; run it in the Bash tool's background mode with its own limit.
//
// Usage: node scripts/with-lock.ts [--kind job|short|tests|premerge] [--exclusive] [--name <job>] [--batch] <command> [args…]
//          e.g. node scripts/with-lock.ts --name rules-a node packages/cli/src/main.ts rules examples/x.scenario.json x.rules.json
//        --kind short    a job of a few minutes at most: runs in the side lane, beside a long job (not beside a premerge,
//                        a test suite or another short job)
//        --exclusive     a timing run (npm run bench): no short job runs beside it
//        node scripts/with-lock.ts --status        the queue now: who holds the lock, who waits, for how long, estimates
// Exit code: the command's.

import { loadavg } from "node:os";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCK_KINDS, queueStatus, runLockedAsync, type LockKind } from "./testlock.ts";

const load = () => loadavg().map((x) => x.toFixed(1)).join(" ");

/** Scripts that take the lock themselves (wrapping them adds nothing), and the batch-script warning for the rest. */
const SELF_LOCKING = new Set(["snapshots.sh", "premerge.sh", "measure.ts"]);

/** A warning when the command is a shell script (a batch of jobs holding the lock throughout), else "". */
export function batchWarning(argv: readonly string[]): string {
  const shell = /^(ba|z)?sh$/.test(basename(argv[0] ?? ""));
  if (shell && argv[1] === "-c") return /;|&&|\|\||\n/.test(argv[2] ?? "") ? `with-lock: an inline batch (${argv[2]}): it holds the lock for all its commands. Wrap each job on its own; --batch if a batch is really meant` : "";
  const runner = shell || basename(argv[0] ?? "") === "node";
  const script = runner ? argv.find((a, i) => i > 0 && !a.startsWith("-")) : argv[0];
  if (!script) return "";
  if (SELF_LOCKING.has(basename(script))) return `with-lock: ${basename(script)} takes the test lock itself; wrapping it adds nothing`;
  if (!/\.(sh|bash)$/.test(script) && !/^(ba|z)?sh$/.test(basename(argv[0] ?? ""))) return "";
  return `with-lock: ${script} is a shell script: it holds the lock for all its jobs, and others wait for the whole batch. Wrap each job on its own (CLAUDE.md "Long runs"); --batch if a batch is really meant`;
}

async function main(argv: string[]): Promise<number> {
  if (argv[0] === "--status") {
    process.stdout.write(queueStatus() + "\n");
    return 0;
  }
  let kind: LockKind = "job";
  let batch = false;
  let exclusive = false;
  let name = "with-lock";
  while (argv[0]?.startsWith("--")) {
    const flag = argv.shift() as string;
    if (flag === "--kind") {
      const k = argv.shift() as LockKind;
      if (!LOCK_KINDS.includes(k)) throw new Error(`--kind takes ${LOCK_KINDS.join(", ")}`);
      kind = k;
    } else if (flag === "--batch") batch = true;
    else if (flag === "--exclusive") exclusive = true;
    else if (flag === "--name") name = argv.shift() ?? name;
    else if (flag === "--") break;
    else throw new Error(`with-lock: unknown option ${flag}`);
  }
  if (!argv.length) {
    process.stderr.write("usage: node scripts/with-lock.ts [--kind job|short|tests|premerge] [--exclusive] [--name <job>] [--batch] <command> [args…] | --status\n");
    return 2;
  }
  const warning = batch ? "" : batchWarning(argv);
  if (warning) process.stderr.write(warning + "\n");
  const start = performance.now();
  const before = load();
  const status = await runLockedAsync(argv, { kind, who: `with-lock ${name}`, cwd: process.cwd(), exclusive, done: name });
  process.stderr.write(`with-lock: ${argv.join(" ")}: exit ${status} after ${((performance.now() - start) / 1000).toFixed(0)} s (load ${before} → ${load()})\n`);
  process.stdout.write(`EFSIM-DONE ${name} exit ${status}\n`);
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main(process.argv.slice(2)).then((c) => (process.exitCode = c));
