#!/usr/bin/env bash
# Kept for old habits: the setup is `node scripts/setup-worktree.ts` now (no `source` needed, no EFSIM_DATA_DIR:
# the loader finds the main checkout's data itself). Running or sourcing this does the same.
node "$(git rev-parse --show-toplevel)/scripts/setup-worktree.ts"
