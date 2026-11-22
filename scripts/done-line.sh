# The `EFSIM-DONE <job> pass|fail|killed` last line of a long shell script (sourced: scripts/premerge.sh), and its run
# state (scratch/runs/<job>.json, node scripts/runstate.ts).
#
# The verdict is "pass" only when the script reached `done_pass` itself: never derived from `$?` in an EXIT trap. A
# shell killed by a signal runs its EXIT trap with `$?` of the last command that finished, often 0, so premerge once
# printed `EFSIM-DONE premerge pass` after a failed test step when the Bash tool's background limit stopped it while
# it waited for the test lock (round 5; tests/done-line.test.ts). A signal (TERM, INT, HUP) gives "killed"; any other
# exit, "fail".
#
# A command that may run long goes through `done_run <command…>`: it runs in the background and the shell `wait`s for
# it, so a signal to the shell is handled at once (bash defers a trap until a foreground command ends) and the child
# is stopped too.
#
# Usage (in a script with `set -euo pipefail`):
#   source "$(dirname "$0")/done-line.sh"
#   done_init premerge "against main"
#   status=0
#   done_run node scripts/premerge.ts || status=$?
#   [ "$status" -eq 0 ] || exit "$status"
#   done_pass

_done_job=""
_done_verdict="fail"
_done_child=""

_done_finish() {
  local s=$?
  trap - EXIT
  [ "$_done_verdict" = "pass" ] && [ "$s" -ne 0 ] && _done_verdict="fail"
  node scripts/runstate.ts end "$_done_job" "$_done_verdict" >/dev/null 2>&1 || true
  echo "EFSIM-DONE $_done_job $_done_verdict"
}

_done_signal() {
  local sig="$1" code="$2"
  _done_verdict="killed"
  # TERM whatever the signal: a background child ignores INT.
  if [ -n "$_done_child" ]; then kill -TERM "$_done_child" 2>/dev/null || true; fi
  echo "$_done_job: stopped by SIG$sig" >&2
  exit "$code"
}

# done_init <job> [what]: records the start and sets the traps.
done_init() {
  _done_job="$1"
  node scripts/runstate.ts start "$_done_job" "${2:-}" >/dev/null 2>&1 || true
  trap _done_finish EXIT
  trap '_done_signal TERM 143' TERM
  trap '_done_signal INT 130' INT
  trap '_done_signal HUP 129' HUP
}

# done_run <command…>: runs a command so that a signal to this shell stops it and is handled at once; its exit status.
done_run() {
  local s=0
  "$@" &
  _done_child=$!
  wait "$_done_child" || s=$?
  _done_child=""
  return "$s"
}

# done_pass: the script reached its end with everything passed.
done_pass() {
  _done_verdict="pass"
}
