// Verifies a commit instead of the working tree, so the next edits can go on while it runs: makes (or reuses) the
// commit's worktree under scratch/at/ (scripts/at-commit.ts) and runs premerge's steps there (scripts/premerge.ts
// --only, under the shared test lock, with its pass/fail table). Commit, start this in the background, keep editing.
//
// Usage: node scripts/verify-at.ts [<ref>] [--steps typecheck,lint,test,logs,journal,tools]
//   default HEAD and typecheck,lint,test. It writes scratch/runs/verify-at.json (scripts/runstate.ts) and ends with
//   `EFSIM-DONE verify-at pass|fail`. The log checks' accuracy: scripts/measure.ts --at <ref>.
//
//        node scripts/verify-at.ts <base> --test <file> [-t <name>]
//   A new test against the code before the change (friction round 7: a verdict test that passed at the base commit
//   too, found only by reading measure's per-hit list): the working tree's copy of the test file is run in <base>'s
//   worktree (restored after) and should FAIL there. Exit 0 when it fails at <base> (the test tells the change
//   apart), 1 when it passes there too, 2 when it can't run there (an import the base lacks: say so, or test through
//   what the base has). Seconds; no lock (one file).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { atCommit } from "./at-commit.ts";
import { endRun, startRun } from "./runstate.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** What a vitest run's output says of a test run at the base: it failed on an assertion, passed, or couldn't load. */
export function baseOutcome(status: number | null, output: string): "fails" | "passes" | "unrunnable" {
  if (/Failed to load|does not provide an export named|Cannot find module|SyntaxError|is not a function|No test files found|No test found/.test(output) && !/AssertionError|expected .* to /.test(output)) return "unrunnable";
  if (status === 0) return /\b0 passed\b|Tests\s+\d+ skipped\s*\(/.test(output) ? "unrunnable" : "passes";
  return "fails";
}

function testAtBase(ref: string, tree: string, file: string, name: string | undefined): number {
  const rel = relative(ROOT, resolve(file));
  if (!existsSync(join(ROOT, rel))) throw new Error(`verify-at: no test file ${rel}`);
  const tracked = spawnSync("git", ["cat-file", "-e", `HEAD:${rel}`], { cwd: tree }).status === 0;
  copyFileSync(join(ROOT, rel), join(tree, rel));
  let r;
  try {
    r = spawnSync("npx", ["vitest", "run", rel, ...(name !== undefined ? ["-t", name] : [])], { cwd: tree, encoding: "utf8", maxBuffer: 64 << 20 });
  } finally {
    if (tracked) spawnSync("git", ["checkout", "--", rel], { cwd: tree });
    else rmSync(join(tree, rel), { force: true });
  }
  const output = `${r.stdout}\n${r.stderr}`;
  const outcome = baseOutcome(r.status, output);
  const tail = output.trim().split("\n").filter((l) => l.trim()).slice(-12).join("\n");
  const what = `${rel}${name !== undefined ? ` -t "${name}"` : ""} at ${ref}`;
  if (outcome === "fails") process.stdout.write(`verify-at: ${what} fails, as it should: the test tells the change apart\n`);
  else if (outcome === "passes") process.stdout.write(`verify-at: ${what} PASSES: the test doesn't tell the change apart (assert what the change moves, e.g. the hits after the one it decides)\n${tail}\n`);
  else process.stdout.write(`verify-at: ${what} can't run there (an import or a test name the base lacks):\n${tail}\n`);
  return outcome === "fails" ? 0 : outcome === "passes" ? 1 : 2;
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { steps: { type: "string", default: "typecheck,lint,test" }, test: { type: "string" }, name: { type: "string", short: "t" } } });
  const ref = positionals[0] ?? "HEAD";
  const short = spawnSync("git", ["rev-parse", "--short=9", "--verify", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" });
  if (short.status !== 0) throw new Error(`verify-at: no commit ${ref}`);
  const tree = join(ROOT, "scratch", "at", short.stdout.trim());
  atCommit(ref, tree);
  if (values.test !== undefined) return testAtBase(ref, tree, values.test, values.name);
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
