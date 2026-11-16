// The lock every worktree's long CPU jobs share (a file in the git common directory, taken with flock): premerge's
// vitest steps, scripts/snapshots.sh, and anything run through scripts/with-lock.ts (measurements, seed tables, long
// `gear --rules` runs). Jobs queue instead of slowing each other past the tests' timeouts or making timings
// incomparable. A command run under the lock gets EFSIM_TEST_LOCK_HELD=1, so a nested one (with-lock around
// snapshots:update) doesn't wait for itself. EFSIM_NO_TEST_LOCK=1 skips the lock; without flock there is none.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The lock file, or undefined when there is no lock to take (off, already held by a parent, no git or flock). */
export function testLockFile(): string | undefined {
  if (process.env.EFSIM_NO_TEST_LOCK === "1" || process.env.EFSIM_TEST_LOCK_HELD === "1") return undefined;
  const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0 || spawnSync("flock", ["--version"]).status !== 0) return undefined;
  return join(r.stdout.trim(), "efsim-tests.lock");
}

/**
 * The command wrapped to run under the lock (`flock <lock> <command>`), saying so when it has to wait; the command as
 * it is when there is no lock to take. `who` names the caller in the waiting line.
 */
export function locked(command: readonly string[], who: string): readonly string[] {
  const lock = testLockFile();
  if (!lock) return command;
  if (spawnSync("flock", ["-n", lock, "true"]).status !== 0) {
    process.stdout.write(`${who}: another worktree's tests or heavy job hold the lock; waiting for it (lock ${lock}; EFSIM_NO_TEST_LOCK=1 skips the wait)\n`);
  }
  return ["flock", lock, ...command];
}

/** The environment for a command run under the lock: nested lock takers inside it don't wait for it. */
export function heldEnv(): NodeJS.ProcessEnv {
  return { ...process.env, EFSIM_TEST_LOCK_HELD: "1" };
}
