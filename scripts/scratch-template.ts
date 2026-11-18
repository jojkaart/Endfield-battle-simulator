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
// Before writing one, check the commands that already answer the usual questions (docs/design/data.md "Questions and
// the command that answers them"): `npm run measure` (a change's accuracy, every log in a minute); the log itself:
// `efsim zmdlogs instances | lanes | control <fixture>`, `census --select … [--near …]` (counts that cite their
// selection), `buffs` (listed id → kit buff), `cadence --operator --event`; the engine's side: `efsim zmdlogs casts |
// replay | stagger <fixture>`, `differences` / `groups --operator <op>`, `hits <fixture…|--all> --json` (per hit:
// engine modifiers, the log's listing and reading, differences; cached per fixture), `efsim kit <operator>` (compiled
// skills and hit frames), `efsim gamedata find <type>`. Their functions are exported (packages/logs/src/query.ts,
// views.ts) for a script that needs more. Times: the log's are ms, the engine's frames (docs/design/data.md "What the
// log records"; its "Common misreadings" box before counting anything).
//
// Logs: `devFixtures()` (every verified and pending development log as a fixture, never a hold-out; `ids: ["0c14"]`,
// `withOperators`), and `loggedSkillInstances(data, fx)` for "the casts of X" (combos from hits, an ultimate's
// repeated events grouped, hitless events apart). fixtures/holdout/ is never opened by hand (docs/accuracy-plan.md,
// "Choosing logs"). The log tooling is @efsim/logs (packages/logs).

import { loadGameData } from "@efsim/data";
import { checkLog, devFixtures, engineHits, logBuffReplay, loggedSkillInstances } from "@efsim/logs";

const data = loadGameData();
const operator = process.argv[2] ?? "chr_0036_jsspsi";

// The development logs with this operator (verified and pending; multi-target logs aren't checked by the engine).
for (const { short, fx } of devFixtures({ withOperators: [operator] })) {
  const replay = logBuffReplay(data, fx);
  const verdicts = checkLog(data, fx, { replay, engineHits: engineHits(data, fx, replay) });
  const mine = verdicts.filter((v) => v.hit.operator === operator);
  const casts = loggedSkillInstances(data, fx, { operator }).filter((i) => i.from === "hits");
  process.stdout.write(`${short}: ${mine.length} hits and ${casts.length} casts of ${data.operators[operator]?.name ?? operator}\n`);
}
