// The tests an engine timing change usually breaks, in under two minutes: between a change's own tests (`npx vitest
// related`, which can't tell timing-sensitive tests: everything imports the engine) and premerge (15–20 min). Round 4,
// after a one-line Stagger change passed its tests and measure, then failed five tests far away in premerge (loop
// searches, the owner's rules check, frame-pinned kit tests), and buff-in-stop broke 20 tests in 13 files.
//
// What it runs: every kit test (tests/kit-*: buff expiries and hit frames pinned against the kit), the loop and beam
// searches (an exact repeat or a pinned total), the owner's team rules check (policy-stepping: a seed's run), the
// timeline and world-clock tests, batch 4's timing tests and the examples' snapshot (a timeline that stops playing:
// `efsim repair`). --full adds the slow loop-search CLI test (tens of seconds more).
//
// Usage: npm run smoke [-- --full]          (node scripts/smoke.ts; a short job under the test lock: scripts/testlock.ts)
// Last line: `EFSIM-DONE smoke pass|fail`.
//
// The code is fixed when it is queued (round 20, round 6's parked point 14, brought back by round 19's own report
// point 1): a snapshot commit of the working tree (scripts/at-commit.ts snapshotCommit) in its own worktree under
// scratch/at/, where the tests run when the lock comes, so edits meanwhile don't reach them. A clean tree runs at HEAD's.

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { atCommit, removeAtCommit, snapshotCommit } from "./at-commit.ts";
import { runLockedAsync } from "./testlock.ts";
import { printHelp } from "./usage.ts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const SMOKE_FILES = [
  "tests/kit-",
  "tests/search-loop.test.ts",
  "tests/search.test.ts",
  "tests/policy-stepping.test.ts",
  "tests/timeline.test.ts",
  "tests/world-clock-hits.test.ts",
  "tests/batch4-timing.test.ts",
  "tests/examples.test.ts",
] as const;
export const SMOKE_SLOW = ["tests/slow/search-loop-cli.test.ts"] as const;

async function main(argv: string[]): Promise<number> {
  const full = argv.includes("--full");
  const reporters = process.stdout.isTTY ? [] : ["--reporter=default", "--reporter=./scripts/vitest-progress.ts"];
  const start = performance.now();
  const snap = snapshotCommit(ROOT);
  const cwd = join(ROOT, "scratch", "at", snap.commit.slice(0, 9));
  atCommit(snap.commit, cwd);
  process.stdout.write(`smoke: the code is fixed at queue time (${snap.dirty ? `a snapshot ${snap.commit.slice(0, 9)} of the working tree` : `HEAD ${snap.commit.slice(0, 9)}, the tree clean`}, in ${cwd}): keep editing while it waits\n`);
  let status = await runLockedAsync(["npx", "vitest", "run", ...reporters, ...SMOKE_FILES], { kind: "short", who: "smoke", done: "smoke", cwd });
  if (full && status === 0) status = await runLockedAsync(["npx", "vitest", "run", "--config", "vitest.logs.config.ts", ...reporters, ...SMOKE_SLOW], { kind: "short", who: "smoke", done: "smoke", cwd });
  // A snapshot's own worktree goes after the run (as measure's); HEAD's stays for the next one.
  if (snap.dirty) removeAtCommit(cwd);
  process.stdout.write(`smoke: ${status === 0 ? "passed" : "FAILED"} in ${((performance.now() - start) / 1000).toFixed(0)} s${status === 0 ? "; premerge (node scripts/premerge.ts) before merging" : ": a timing change? see each failure (kit tests pin expiries; examples: efsim repair)"}\n`);
  process.stdout.write(`EFSIM-DONE smoke ${status === 0 ? "pass" : "fail"}\n`);
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  void main(process.argv.slice(2)).then((c) => (process.exitCode = c));
}
