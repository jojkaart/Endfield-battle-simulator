#!/usr/bin/env bash
# Makes a git worktree (e.g. a sub-agent's under .claude/worktrees/) run its
# OWN code against the main checkout's game data. Without this, Node
# resolves @efsim/* upward to the main checkout's node_modules (so checks run
# the main checkout's kits, not the worktree's), and data/ is empty because
# submodules aren't checked out in worktrees.
#
# Usage, from the worktree root:  source scripts/setup-worktree.sh
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
main="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
if [ "$root" = "$main" ]; then
  echo "setup-worktree: this is the main checkout; nothing to do" >&2
else
  mkdir -p "$root/node_modules/@efsim"
  for p in cli data engine; do ln -sfn "$root/packages/$p" "$root/node_modules/@efsim/$p"; done
  # Dependencies (ajv, vitest, …) still resolve from the main checkout's node_modules.
  export EFSIM_DATA_DIR="$main/data"
  echo "setup-worktree: @efsim/* -> $root/packages, EFSIM_DATA_DIR=$EFSIM_DATA_DIR" >&2
fi
