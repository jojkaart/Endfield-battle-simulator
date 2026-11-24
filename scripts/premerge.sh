#!/usr/bin/env bash
# The entry point kept for habits and briefs: all of premerge is scripts/premerge.ts (round 10). `exec`, so a signal
# (the Bash tool's background limit) reaches node itself and its `EFSIM-DONE premerge killed` line.
exec node "$(dirname "$0")/premerge.ts" "$@"
