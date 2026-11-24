#!/bin/bash
# The file .claude/settings.json's SessionStart hook names; the work is in scripts/session-start.ts (round 10).
exec node "$CLAUDE_PROJECT_DIR/scripts/session-start.ts"
