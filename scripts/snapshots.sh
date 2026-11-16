#!/usr/bin/env bash
# Regenerates every generated baseline from the current code: the snapshots (tests/snapshots/*.json: examples, kits,
# verified and pending log verdicts) and the accuracy scoreboard made from them (docs/accuracy.md). `npm run
# snapshots:update` runs it.
#
# Deterministic: each snapshot is emptied first, so what's written depends only on the code, the kits and the
# fixtures, not on the file's content before. A merge conflict in one of these files is therefore resolved by taking
# either side (or leaving the conflict markers: the file is emptied anyway) and running this; never by hand.
#
# At the end: the files' diff stat, and the scoreboard's change and each log's direction (better / worse by the fit
# measure) against a git ref (HEAD by default; mid-merge, HEAD is the branch merged into).
#
# Usage: scripts/snapshots.sh [ref]     (several minutes: the pending logs' checks run in full)
# In a worktree, link its packages and pass the data first (CLAUDE.md "Worktrees and sub-agents").
set -euo pipefail
ref="${1:-HEAD}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

# Kept to put back if a run fails (a failed test may record nothing: the files would be left empty).
backup="$(mktemp -d)"
cp tests/snapshots/*.json docs/accuracy.md "$backup/" 2>/dev/null || true
cp tests/slow/pending-costs.json "$backup/pending-costs.json.keep" 2>/dev/null || true
restore() {
  echo "snapshots: a run failed; the files are as they were" >&2
  for f in "$backup"/*.json; do cp "$f" tests/snapshots/; done
  [ -f "$backup/accuracy.md" ] && cp "$backup/accuracy.md" docs/
  [ -f "$backup/pending-costs.json.keep" ] && cp "$backup/pending-costs.json.keep" tests/slow/pending-costs.json
}
trap restore ERR
trap 'restore; exit 130' INT TERM

for f in tests/snapshots/*.json; do
  rm -f "$f.lock"
  echo '{}' > "$f"
done

# The test lock premerge takes (scripts/testlock.ts), so parallel worktrees' suites queue instead of timing out.
lock=()
if [ "${EFSIM_NO_TEST_LOCK:-}" != "1" ] && [ "${EFSIM_TEST_LOCK_HELD:-}" != "1" ] && command -v flock >/dev/null; then
  lock=(flock "$(git rev-parse --path-format=absolute --git-common-dir)/efsim-tests.lock")
fi
export EFSIM_TEST_LOCK_HELD=1
# A line per finished file when the output isn't a terminal (a background run), beside vitest's own report.
reporters=(--reporter=default)
[ -t 1 ] || reporters+=(--reporter=./scripts/vitest-progress.ts)
# The pending logs' check times, for balancing the shards (tests/slow/pending-costs.json, scripts/pending-costs.ts).
report="$(mktemp -d)/pending-report.json"

export EFSIM_UPDATE_SNAPSHOTS=1
"${lock[@]}" npx vitest run "${reporters[@]}" tests/examples.test.ts tests/logs.test.ts tests/kits.test.ts
"${lock[@]}" npx vitest run --config vitest.logs.config.ts "${reporters[@]}" --reporter=json "--outputFile.json=$report" tests/slow/logs-pending
unset EFSIM_UPDATE_SNAPSHOTS
node scripts/accuracy.ts --write
node scripts/pending-costs.ts "$report"
trap - ERR INT TERM
rm -rf "$backup"

echo
echo "snapshots: regenerated. Changes against $ref:"
git --no-pager diff --stat "$ref" -- tests/snapshots docs/accuracy.md tests/slow/pending-costs.json || true
node scripts/accuracy.ts --compare "$ref"
