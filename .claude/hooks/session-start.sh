#!/bin/bash
# Cloud sessions: fetch the game tables the tests read and install npm
# dependencies, so typecheck, lint and tests run straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
./scripts/fetch-data.sh
npm install --no-audit --no-fund
