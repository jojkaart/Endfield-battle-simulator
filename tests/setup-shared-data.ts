// The test files share one loaded GameData per worker (vitest.config.ts: isolate false, so loadGameData's cache
// outlives a file: loading takes ~15 s and ran once per file before, 80% of the suite's time). Freezing it makes a
// test or engine path that writes into the shared data throw instead of leaking into the files that run after it.
import { loadGameData } from "@efsim/data";

function deepFreeze(value: unknown, seen: Set<object>): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const v of Object.values(value)) deepFreeze(v, seen);
  Object.freeze(value);
}

const data = loadGameData();
if (!Object.isFrozen(data)) deepFreeze(data, new Set());
