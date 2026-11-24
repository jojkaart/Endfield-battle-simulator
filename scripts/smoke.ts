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

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLockedAsync } from "./testlock.ts";

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
  let status = await runLockedAsync(["npx", "vitest", "run", ...reporters, ...SMOKE_FILES], { kind: "short", who: "smoke", done: "smoke" });
  if (full && status === 0) status = await runLockedAsync(["npx", "vitest", "run", "--config", "vitest.logs.config.ts", ...reporters, ...SMOKE_SLOW], { kind: "short", who: "smoke", done: "smoke" });
  process.stdout.write(`smoke: ${status === 0 ? "passed" : "FAILED"} in ${((performance.now() - start) / 1000).toFixed(0)} s${status === 0 ? "; premerge (node scripts/premerge.ts) before merging" : ": a timing change? see each failure (kit tests pin expiries; examples: efsim repair)"}\n`);
  process.stdout.write(`EFSIM-DONE smoke ${status === 0 ? "pass" : "fail"}\n`);
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main(process.argv.slice(2)).then((c) => (process.exitCode = c));
