// What both vitest configs share: tests import this checkout's own @efsim packages, also in a git worktree.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setupWorktree } from "./scripts/setup-worktree.ts";

const root = dirname(fileURLToPath(import.meta.url));

// Test files and the packages they import resolve @efsim/* to this checkout through the alias. Code that Node runs
// outside vitest (the CLI tests' `node packages/cli/src/main.ts`, rules worker threads) resolves through
// node_modules/@efsim, which in a worktree must link here too: setupWorktree makes those links (a no-op in the main
// checkout and once they exist).
setupWorktree(root);

export const efsimAlias = [
  { find: /^@efsim\/engine\/core$/, replacement: resolve(root, "packages/engine/src/core.ts") },
  { find: /^@efsim\/(cli|data|engine)$/, replacement: resolve(root, "packages/$1/src/index.ts") },
];
