// Makes a checkout run its OWN packages: links node_modules/@efsim/<name> to packages/<name> for every workspace
// package (packages/*/package.json named @efsim/…).
// - In a git worktree (e.g. a sub-agent's under .claude/worktrees/): without its links Node resolves @efsim/* upward
//   to the main checkout's node_modules, and the CLI and rules workers would run the main checkout's code and kits
//   (the CLI refuses to: packages/cli/src/checkout.ts). Dependencies (ajv, vitest, …) still resolve from the main
//   checkout. The game data needs nothing: the loader reads the main checkout's data/ when the worktree's is empty.
// - In the main checkout: a package added since the last `npm install` (packages/logs, 2026-11-16) gets the link
//   npm would make; existing links are left alone.
//
// Usage, from anywhere in the checkout:  node scripts/setup-worktree.ts   (or npm run setup-worktree)
// The vitest configs run it too, so `npm test` in a fresh worktree works without it. Idempotent.

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckoutOf } from "../packages/data/src/checkout.ts";
import { printHelp } from "./usage.ts";

/** The workspace packages under packages/ (directory names), those whose package.json names them @efsim/<dir>. */
export function workspacePackages(root: string): string[] {
  const dir = join(root, "packages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((p) => {
      const pkg = join(dir, p, "package.json");
      return existsSync(pkg) && (JSON.parse(readFileSync(pkg, "utf8")) as { name?: string }).name === `@efsim/${p}`;
    })
    .sort();
}

/** Links the checkout's own packages; returns what it did, for the log. */
export function setupWorktree(root: string = resolve(dirname(fileURLToPath(import.meta.url)), "..")): string {
  const isMain = mainCheckoutOf(root) === null;
  const dir = join(root, "node_modules", "@efsim");
  mkdirSync(dir, { recursive: true });
  const made: string[] = [];
  for (const p of workspacePackages(root)) {
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
    if (current === target || (isMain && current !== null)) continue;
    if (current !== null) rmSync(link);
    symlinkSync(target, link, "dir");
    made.push(p);
  }
  const where = isMain ? "the main checkout" : "this worktree";
  return made.length ? `setup-worktree: linked @efsim/{${made.join(",")}} -> ${join(root, "packages")} (${where})` : `setup-worktree: ${where}: already linked`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (printHelp(process.argv.slice(2, 3), import.meta.url)) process.exit(0);
  process.stderr.write(setupWorktree() + "; the CLI here: npm run -s efsim -- <args> (efsim is not on the PATH)\n");
}
