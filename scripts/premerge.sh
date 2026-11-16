#!/usr/bin/env bash
# Before merging a branch into main (CLAUDE.md "Branches"): what `npm run
# check` doesn't cover, then the check itself, step by step (scripts/premerge.ts:
# every step runs even after one fails, a table of pass/fail and times at the
# end, a re-run of files that only timed out, a lock so parallel worktrees'
# suites queue). Expect about 15-20 min on this 4-core container (more under
# other agents' load): run it in the background with a limit of 40 min.
#   - the tree is clean (uncommitted work wouldn't be merged, and the check
#     would run on it);
#   - in a worktree, its own packages are linked (scripts/setup-worktree.ts,
#     run here), or the check runs the main checkout's code;
#   - a branch that changes code, kits or examples also adds a journal entry
#     (a file under docs/journal/: CLAUDE.md "Journal and roadmap"); `npm run
#     check` then checks that docs/journal.md is rebuilt from the entries.
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

node scripts/setup-worktree.ts
main="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
if [ "$root" != "$main" ] && [ "$(readlink -f node_modules/@efsim/engine 2>/dev/null)" != "$root/packages/engine" ]; then
  echo "premerge: a worktree without its own packages linked, even after scripts/setup-worktree.ts" >&2
  exit 1
fi

changed="$(git diff --name-only "$(git merge-base "$base" HEAD)" HEAD)"
if echo "$changed" | grep -qE '^(packages/|examples/|schemas/)' && ! echo "$changed" | grep -qE '^docs/journal/[0-9]{4}-'; then
  echo "premerge: the branch changes code, kits or examples but adds no journal entry (npm run journal:new -- \"Title\")" >&2
  exit 1
fi

status=0
node scripts/premerge.ts || status=$?
# The branch's accuracy change (docs/accuracy.md, from the verdict snapshots) for the reviewer.
node scripts/accuracy.ts --compare "$(git merge-base "$base" HEAD)"
if [ "$status" -ne 0 ]; then
  echo "premerge: not ready: a step failed (the table above)" >&2
  exit "$status"
fi
echo "premerge: ready to merge into $base"
