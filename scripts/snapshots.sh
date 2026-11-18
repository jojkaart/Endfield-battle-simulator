#!/usr/bin/env bash
# Regenerates every generated baseline from the current code: the snapshots (tests/snapshots/*.json: examples, kits,
# verified and pending log verdicts) and the accuracy scoreboard made from them (docs/accuracy.md). `npm run
# snapshots:update` runs it. To measure a change without rewriting anything, use scripts/measure.ts (npm run measure).
#
# Deterministic: each snapshot is emptied first, so what's written depends only on the code, the kits and the
# fixtures, not on the file's content before. A merge conflict in one of these files is therefore resolved by taking
# either side (or leaving the conflict markers: the file is emptied anyway) and running this; never by hand.
#
# At the end: the files' diff stat, and the scoreboard's change and each log's direction (better / worse by the fit
# measure) against a git ref (HEAD by default; mid-merge, HEAD is the branch merged into); then one line
# `EFSIM-DONE snapshots pass` (or `fail`) to wait for. Its run state is in scratch/runs/snapshots.json
# (node scripts/runstate.ts).
#
# Usage: scripts/snapshots.sh [--costs] [ref]     (several minutes: the pending logs' checks run in full)
#   --costs   also rewrite tests/slow/pending-costs.json (the pending logs' check times that balance the test:logs
#             shards): machine- and load-dependent, so only when rebalancing, on a quiet machine
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"

# The test lock premerge takes (scripts/testlock.ts: a queue, with a heartbeat line while waiting): the whole run
# holds it once, so parallel worktrees' suites queue instead of timing out.
if [ "${EFSIM_NO_TEST_LOCK:-}" != "1" ] && [ "${EFSIM_TEST_LOCK_HELD:-}" != "1" ]; then
  exec node scripts/testlock.ts --kind tests --who snapshots -- "$0" "$@"
fi
export EFSIM_TEST_LOCK_HELD=1

costs=0
if [ "${1:-}" = "--costs" ]; then
  costs=1
  shift
fi
ref="${1:-HEAD}"
node scripts/runstate.ts start snapshots "against $ref"

# Kept to put back if a run fails (a failed test may record nothing: the files would be left empty).
backup="$(mktemp -d)"
cp tests/snapshots/*.json docs/accuracy.md "$backup/" 2>/dev/null || true
restore() {
  echo "snapshots: a run failed; the files are as they were" >&2
  for f in "$backup"/*.json; do cp "$f" tests/snapshots/; done
  [ -f "$backup/accuracy.md" ] && cp "$backup/accuracy.md" docs/
  node scripts/runstate.ts end snapshots fail || true
  echo "EFSIM-DONE snapshots fail"
}
trap restore ERR
trap 'restore; exit 130' INT TERM

for f in tests/snapshots/*.json; do
  rm -f "$f.lock"
  echo '{}' > "$f"
done

# A line per finished file when the output isn't a terminal (a background run), beside vitest's own report.
reporters=(--reporter=default)
[ -t 1 ] || reporters+=(--reporter=./scripts/vitest-progress.ts)
# With --costs: the pending logs' check times, for balancing the shards (scripts/pending-costs.ts).
pending=("${reporters[@]}")
report="$(mktemp -d)/pending-report.json"
[ "$costs" = 1 ] && pending+=(--reporter=json "--outputFile.json=$report")

export EFSIM_UPDATE_SNAPSHOTS=1
npx vitest run "${reporters[@]}" tests/examples.test.ts tests/logs.test.ts tests/kits.test.ts
npx vitest run --config vitest.logs.config.ts "${pending[@]}" tests/slow/logs-pending
unset EFSIM_UPDATE_SNAPSHOTS
node scripts/accuracy.ts --write
[ "$costs" = 1 ] && node scripts/pending-costs.ts "$report"
trap - ERR INT TERM
rm -rf "$backup"

echo
echo "snapshots: regenerated. Changes against $ref:"
git --no-pager diff --stat "$ref" -- tests/snapshots docs/accuracy.md tests/slow/pending-costs.json || true
node scripts/accuracy.ts --compare "$ref"
node scripts/runstate.ts end snapshots pass
echo "EFSIM-DONE snapshots pass"
