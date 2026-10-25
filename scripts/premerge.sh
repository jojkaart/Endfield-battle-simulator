#!/usr/bin/env bash
# Before merging a branch into main (CLAUDE.md "Branches"): what `npm run
# check` doesn't cover, then the check itself.
#   - the tree is clean (uncommitted work wouldn't be merged, and the check
#     would run on it);
#   - in a worktree, its own packages are linked (scripts/setup-worktree.sh),
#     or the check runs the main checkout's code;
#   - a branch that changes code, kits or examples also adds a journal entry
#     (docs/journal.md: CLAUDE.md "Journal and roadmap").
# Usage: scripts/premerge.sh [base]   (base: main by default)
set -euo pipefail
base="${1:-main}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ -n "$(git status --porcelain)" ]; then
  echo "premerge: the tree has uncommitted changes:" >&2
  git status --short >&2
  exit 1
fi

main="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
if [ "$root" != "$main" ] && [ "$(readlink -f node_modules/@efsim/engine 2>/dev/null)" != "$root/packages/engine" ]; then
  echo "premerge: a worktree without its own packages linked; run: source scripts/setup-worktree.sh" >&2
  exit 1
fi

changed="$(git diff --name-only "$(git merge-base "$base" HEAD)" HEAD)"
if echo "$changed" | grep -qE '^(packages/|examples/|schemas/)' && ! echo "$changed" | grep -qx 'docs/journal.md'; then
  echo "premerge: the branch changes code, kits or examples but not docs/journal.md (add an entry)" >&2
  exit 1
fi

npm run check
echo "premerge: ready to merge into $base"
