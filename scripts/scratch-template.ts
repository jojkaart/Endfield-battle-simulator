// A scratch analysis script to start from. Copy it into scratch/ (git-ignored, ignored by lint and typecheck, kept
// through the session) and run it from the repository root:
//
//   cp scripts/scratch-template.ts scratch/my-question.ts      (or write the file with the Write tool)
//   node scratch/my-question.ts [args]
//
// Under scratch/ the workspace packages resolve by name (@efsim/data, @efsim/engine, @efsim/cli), from this checkout
// (in a worktree after `node scripts/setup-worktree.ts`). The game data loads from the cache in about a second.
//
// Logs: list development logs with `logFixtureFiles` or `listLogs` (never a hold-out; fixtures/holdout/ is never
// opened by hand: docs/accuracy-plan.md, "Choosing logs"). Per-hit numbers of the log check: `efsim zmdlogs hits`.

import { loadGameData } from "@efsim/data";
import { checkLog, engineHits, listLogs, logBuffReplay, readLogFixture } from "@efsim/cli";

const data = loadGameData();
const operator = process.argv[2] ?? "chr_0036_jsspsi";

// The development logs with this operator (verified and pending; multi-target logs aren't checked by the engine).
for (const log of listLogs({ withOperators: [operator], dirs: ["verified", "pending"] })) {
  const fx = readLogFixture(log.file);
  const replay = logBuffReplay(data, fx);
  const verdicts = checkLog(data, fx, { replay, engineHits: engineHits(data, fx, replay) });
  const mine = verdicts.filter((v) => v.hit.operator === operator);
  process.stdout.write(`${log.id}: ${mine.length} hits of ${data.operators[operator]?.name ?? operator}\n`);
}
