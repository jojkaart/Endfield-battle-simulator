// Which checkout this code runs from, and the main checkout when it is a linked git worktree (a sub-agent's under
// .claude/worktrees/). A worktree's data/ submodules are empty, so the loader reads the main checkout's tables, and the
// game-data cache lives there so worktrees with the same inputs share it. No git process is spawned: the worktree's
// `.git` file points at <main>/.git/worktrees/<name>, whose `commondir` points back at <main>/.git.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The root of the checkout this file is in (packages/data/src → the repository root). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The main checkout's root when `root` is a linked git worktree; null in the main checkout (or outside git). */
export function mainCheckoutOf(root: string = REPO_ROOT): string | null {
  try {
    const dotGit = join(root, ".git");
    if (!existsSync(dotGit) || statSync(dotGit).isDirectory()) return null;
    const gitDir = resolve(root, readFileSync(dotGit, "utf8").trim().replace(/^gitdir:\s*/, ""));
    // A submodule's .git file points into the superproject's .git/modules/ and has no commondir.
    const commonFile = join(gitDir, "commondir");
    if (!existsSync(commonFile)) return null;
    const common = resolve(gitDir, readFileSync(commonFile, "utf8").trim());
    const main = dirname(common);
    return main === resolve(root) ? null : main;
  } catch {
    return null;
  }
}
