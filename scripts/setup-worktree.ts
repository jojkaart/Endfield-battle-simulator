// Makes a git worktree (e.g. a sub-agent's under .claude/worktrees/) run its OWN packages: links
// node_modules/@efsim/{cli,data,engine} to the worktree's packages/. Without them Node resolves @efsim/* upward to
// the main checkout's node_modules, and the CLI and rules workers would run the main checkout's code and kits (the
// CLI refuses to: packages/cli/src/checkout.ts). Dependencies (ajv, vitest, …) still resolve from the main checkout.
// The game data needs nothing: the loader reads the main checkout's data/ when the worktree's is empty.
//
// Usage, from anywhere in the worktree:  node scripts/setup-worktree.ts   (or npm run setup-worktree)
// The vitest configs run it too, so `npm test` in a fresh worktree works without it. Idempotent.

import { lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckoutOf } from "../packages/data/src/checkout.ts";

const PACKAGES = ["cli", "data", "engine"] as const;

/** Links the checkout's own packages when it is a linked worktree; returns what it did, for the log. */
export function setupWorktree(root: string = resolve(dirname(fileURLToPath(import.meta.url)), "..")): string {
  const main = mainCheckoutOf(root);
  if (main === null) return "setup-worktree: this is the main checkout; nothing to do";
  const dir = join(root, "node_modules", "@efsim");
  mkdirSync(dir, { recursive: true });
  const made: string[] = [];
  for (const p of PACKAGES) {
    const link = join(dir, p);
    const target = join(root, "packages", p);
    let current: string | null;
    try {
      const s = lstatSync(link);
      if (!s.isSymbolicLink()) throw new Error(`setup-worktree: ${link} is not a link; move it away and run again`);
      current = resolve(dir, readlinkSync(link));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      current = null;
    }
    if (current === target) continue;
    if (current !== null) rmSync(link);
    symlinkSync(target, link, "dir");
    made.push(p);
  }
  return made.length ? `setup-worktree: linked @efsim/{${made.join(",")}} -> ${join(root, "packages")}` : "setup-worktree: already linked";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stderr.write(setupWorktree() + "\n");
}
