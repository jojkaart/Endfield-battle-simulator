// Runs a long CPU job under the lock premerge's test suites take (scripts/testlock.ts), so it queues behind other
// worktrees' suites and heavy jobs instead of running beside them: measurements stay comparable, and nobody's tests
// time out because someone is benchmarking. Says when it waits, then the elapsed time (wait included) and the load
// average before and after.
//
// Usage: node scripts/with-lock.ts <command> [args…]
//   e.g. node scripts/with-lock.ts node packages/cli/src/main.ts gear examples/x.scenario.json --rules x.rules.json
// Exit code: the command's.

import { spawnSync } from "node:child_process";
import { loadavg } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { heldEnv, locked } from "./testlock.ts";

const load = () => loadavg().map((x) => x.toFixed(1)).join(" ");

function main(argv: string[]): number {
  if (!argv.length) {
    process.stderr.write("usage: node scripts/with-lock.ts <command> [args…]\n");
    return 2;
  }
  const command = locked(argv, "with-lock");
  const start = performance.now();
  const before = load();
  const [cmd, ...args] = command as [string, ...string[]];
  const r = spawnSync(cmd, args, { stdio: "inherit", env: heldEnv() });
  process.stderr.write(`with-lock: ${argv.join(" ")}: exit ${r.status ?? r.signal} after ${((performance.now() - start) / 1000).toFixed(0)} s (load ${before} → ${load()})\n`);
  return r.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
