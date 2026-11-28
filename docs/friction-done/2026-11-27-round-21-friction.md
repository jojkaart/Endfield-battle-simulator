# Improvement round 21 itself (2026-11-27)

Task: improvement round 21 over five open friction reports and round 20's backlog, every file free; this worktree's
branch on main at 27adacf.

## 1. A behaviour-preserving move has no quick identity check for the replay and the check

- **What happened:** the round moved the landing pairing out of replayKitBuffs, unified keepPrevious across three
  assembly steps and changed the compiler's channel marking. Each needed "is the output the same?": for the compiler
  a scratch sha1 of `JSON.stringify(loadGameData())` run here and through `node scripts/at-commit.ts HEAD --run` (which
  found the token marked 9 more hits than before, the `!detached` filter had to stay); for keepPrevious a scratch
  script over every development log comparing flags (and finding replayedCasts' output unsorted in five logs, so a
  re-sort would have moved them); for the pairing `cli-ab.ts HEAD -- zmdlogs check <fx>` on two logs, a minute each.
  The full answer only came from `snapshots:update` at the end (10 min, and every hold-out aggregate).
- **Cause:** team-ab's identity check covers the engine's simulations and measure covers verdicts, but nothing says
  "the compiled data is the same" or "every log's replay records are the same" in a minute without the lock.
- **Suggestion:** `node scripts/identity.ts --base <ref> [--data] [--replay]`: `--data` hashes the compiled game data
  and kits at both commits (at-commit.ts `--run`), `--replay` hashes each development log's BuffReplay record
  (made, tailCuts, hits' frames and refs, reactions) and its placement at both, printing only the logs that differ;
  the hold-outs as a count of differing logs. Name it in CLAUDE.md's "a module split is a move" line.
- **Files:** a new scripts/identity.ts, scripts/at-commit.ts, CLAUDE.md (the lead's), docs/design/tests.md.
- **Why it helps:** a move is checked as a move in a minute, before the 10-minute snapshots and before anything
  else is built on it; a difference shows per log, not as a moved verdict count.

## 2. A report's suggestion that already exists costs a round's reading

- **What happened:** the statuses-per-target report asked for a per-hit diff of two readings' verdicts; `zmdlogs hits
  --against <id>=<r>` has done that since round 13 and CLAUDE.md names it. The target-statuses report asked for a
  status record view and DEATH lines from the replay's record, both built by the next round. Finding that each was
  there took reading the CLI's usage and the sources before writing anything.
- **Cause:** the views are listed in three places (zmdlogs usage, CLAUDE.md's diagnosis sentence, data.md's question
  table) and a reporting agent searches none of them by its question.
- **Suggestion:** `efsim zmdlogs which "<question words>"`: a ranked match of the question against data.md's
  question table and the usage lines (the table's rows already pair a question with its command), named in the
  friction request ("before suggesting a view, `zmdlogs which`").
- **Files:** packages/cli/src/commands/zmdlogs.ts, docs/design/data.md, docs/friction/README.md (the request).
- **Why it helps:** fewer suggestions for views that exist; a round spends its time on what's missing.

## What worked well

- The bash guard's refusal of a commit with last commit's message in scratch/msg.txt caught a slip at once.
- `node scripts/edit.ts` with `<<<<<<< all` and appended blocks: every multi-file edit in one go, all or nothing.
- The reports' episodes as tests: 9847's 75.44 s tail, abilityEvent 1, 6339 at 19.70 s, 0eef's Medicant.
- snapshots:update's "No log's verdicts moved" line as the round's single proof of behaviour preserved.

## Outcome (round 22)

- 1 (A behaviour-preserving move has no quick identity check for the replay and the check): done (c3ba762):
  `node scripts/identity.ts --base <ref> [--data] [--replay] [--logs ids]`, the compiled data and kits and each log's
  default replay record by part (placement, made, cuts, hits, statuses, stops, holds, failed) at the base and in the
  tree as queued (worktrees of their own, the lock's short lane, about 4 min for every log); the differing parts per
  development log, the hold-outs a count only (tests/holdout-blindness.test.ts runs identityLines). Round 22's own
  code against c81a34f: 0 of 65 development logs, 0 of 13 hold-outs, the data the same. The CLAUDE.md line is in the
  round summary's "For the lead".
- 2 (A report's suggestion that already exists costs a round's reading): done (da6a20b): `efsim zmdlogs which
  "<question>"` (packages/cli/src/which.ts: data.md's question table and the usage, an option line its own entry,
  ranked by shared words weighted by rarity); the friction request asks it first (docs/friction/README.md);
  data.md's table gained `hits --against` and this round's views.
