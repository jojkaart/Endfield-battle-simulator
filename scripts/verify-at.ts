// Verifies a commit instead of the working tree, so the next edits can go on while it runs: makes (or reuses) the
// commit's worktree under scratch/at/ (scripts/at-commit.ts) and runs premerge's steps there (scripts/premerge.ts
// --only, under the shared test lock, with its pass/fail table). Commit, start this in the background, keep editing.
//
// Usage: node scripts/verify-at.ts [<ref>] [--steps typecheck,lint,test,logs,journal,tools]
//   default HEAD and typecheck,lint,test. It writes scratch/runs/verify-at.json (scripts/runstate.ts) and ends with
//   `EFSIM-DONE verify-at pass|fail`. The log checks' accuracy: scripts/measure.ts --at <ref>.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { atCommit } from "./at-commit.ts";
import { endRun, startRun } from "./runstate.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { steps: { type: "string", default: "typecheck,lint,test" } } });
  const ref = positionals[0] ?? "HEAD";
  const short = spawnSync("git", ["rev-parse", "--short=9", "--verify", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" });
  if (short.status !== 0) throw new Error(`verify-at: no commit ${ref}`);
  const tree = join(ROOT, "scratch", "at", short.stdout.trim());
  atCommit(ref, tree);
  if (!existsSync(join(tree, "scripts/premerge.ts"))) throw new Error(`verify-at: ${ref} has no scripts/premerge.ts`);
  startRun("verify-at", `${ref} (${short.stdout.trim()}): ${values.steps}`);
  process.stdout.write(`verify-at: ${ref} (${short.stdout.trim()}) in ${tree}: ${values.steps}\n`);
  const r = spawnSync(process.execPath, [join(tree, "scripts/premerge.ts"), "--only", values.steps], { cwd: tree, stdio: "inherit" });
  const ok = r.status === 0;
  endRun("verify-at", ok ? "pass" : "fail");
  process.stdout.write(`EFSIM-DONE verify-at ${ok ? "pass" : "fail"}\n`);
  return ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
