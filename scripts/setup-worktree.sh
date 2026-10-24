#!/usr/bin/env bash
# Makes a git worktree (e.g. a sub-agent's under .claude/worktrees/) run its
# OWN code against the main checkout's game data. Without this, Node
# resolves @efsim/* upward to the main checkout's node_modules (so checks run
# the main checkout's kits, not the worktree's), and data/ is empty because
# submodules aren't checked out in worktrees.
#
# Usage, from the worktree root:  source scripts/setup-worktree.sh
# Sourced: no `set -e` here, which would stay on in the caller's shell (any later failing command would end it).
efsim_setup_worktree() {
  local root main p
  root="$(git rev-parse --show-toplevel)" || return 1
  main="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" || return 1
  if [ "$root" = "$main" ]; then
    echo "setup-worktree: this is the main checkout; nothing to do" >&2
    return 0
  fi
  mkdir -p "$root/node_modules/@efsim" || return 1
  for p in cli data engine; do ln -sfn "$root/packages/$p" "$root/node_modules/@efsim/$p" || return 1; done
  # Dependencies (ajv, vitest, …) still resolve from the main checkout's node_modules.
  export EFSIM_DATA_DIR="$main/data"
  echo "setup-worktree: @efsim/* -> $root/packages, EFSIM_DATA_DIR=$EFSIM_DATA_DIR" >&2
}
efsim_setup_worktree
