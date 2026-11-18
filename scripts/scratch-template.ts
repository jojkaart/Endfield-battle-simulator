// A scratch analysis script to start from. Copy it into scratch/ (git-ignored, ignored by lint and typecheck, kept
// through the session) and run it from the repository root:
//
//   cp scripts/scratch-template.ts scratch/my-question.ts      (or write the file with the Write tool)
//   node scratch/my-question.ts [args]
//
// Under scratch/ the workspace packages resolve by name (@efsim/data, @efsim/engine, @efsim/cli), from this checkout
// (in a worktree after `node scripts/setup-worktree.ts`). The game data loads from the cache in about a second.
//
// Time: the engine runs at FPS = 30 frames a second. A fight length goes through `withSeconds(scenario, s)`, any
// other time through `framesOf(s)` / `secondsOf(f)` (@efsim/engine), never a literal `* 60` or `* 30`.
//
// Long runs: start them with the Bash tool's background mode (never `&`), under the shared lock when they take
// minutes of CPU: `node scripts/with-lock.ts node scratch/x.ts` (one job per wrap), output to a new file per run; end
// with a line `EFSIM-DONE <name> pass` so one Monitor until-loop waits for it.
//
// Before writing one, check the commands that already answer the usual questions: `npm run measure` (a change's
// accuracy, every log in a minute), `efsim zmdlogs casts | replay | stagger <fixture>` (the placement, the replay's
// landings and Stagger windows), `efsim zmdlogs differences` / `groups --operator <op>` (where log and replay
// disagree, an operator's mismatches by cause), `efsim zmdlogs hits --json` (per hit: engine modifiers, the log's
// listing, differences), `efsim gamedata find <type>` (game-data actions by type). Their functions are exported
// (packages/logs/src/views.ts) for a script that needs more. Times: the log's are ms, the engine's frames
// (docs/design/data.md "What the log records").
//
// Logs: list development logs with `logFixtureFiles` or `listLogs` (never a hold-out; fixtures/holdout/ is never
// opened by hand: docs/accuracy-plan.md, "Choosing logs"). Per-hit numbers of the log check: `efsim zmdlogs hits`. The log tooling is @efsim/logs (packages/logs).

import { loadGameData } from "@efsim/data";
import { checkLog, engineHits, listLogs, logBuffReplay, readLogFixture } from "@efsim/logs";

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
