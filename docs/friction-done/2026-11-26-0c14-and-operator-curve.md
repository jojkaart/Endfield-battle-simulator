# 0c14 and the operator curve (2026-11-26)

Task: 0c14's Rossi and Si under-prediction, an operators-only combo curve, the unlogged tails' cuts across logs,
Alesh's eventless combo, 207f, Snowshine's ×0.9624, and (if time) splitting buffreplay.ts; branch
worktree-agent-a732e41da13b26399.

## 1. The totals' "matched −5.7%" mixed the model's error with one fight's crit luck, and no view split them

- **What happened:** `zmdlogs totals 0c14` said Rossi's matched landings were −5.7%; `zmdlogs hits --json` gave no
  per-hit number the totals had used (its `predicted` is the non-crit primary for crit-unknown hits, `graded.predicted`
  the verdict's, matched by the log's listing), so sums over it gave ×0.444 and ×1.000 for the same hits. I wrote
  scratch/parts.ts (now scripts/probes/totals/parts.ts) on `engineReport(...).totals.parts` and `engineHits`'
  `expected` to see that 108k of the 186k came from two ultimate finals counted at expected crits. About 40 minutes.
- **Cause:** fightTotals takes `expected ?? primary` per hit, but neither the totals view nor the hits export says
  which a hit got (exact, crit-only, read from the value, expected).
- **Suggestion:** `zmdlogs totals <fixture> --by crit` (the matched parts per crit kind: known, read, expected, with
  the expected share's signed sum), and a `totalsPredicted` plus `totalsRead` field in `zmdlogs hits --json`
  (hitexport.ts) beside `predicted`.
- **Files:** packages/logs/src/views.ts (totalsView), packages/logs/src/hitexport.ts, packages/logs/src/enginecheck.ts.
- **Why it helps:** the first question about a total ("is this the model or the dice?") becomes one command; the
  probe goes away.

## 2. Paths that share keys: no view says which path a cast took against its values

- **What happened:** Rossi's attack 4 under a teammate (×2.5, 25 hits in 2fd9 classed "assumed") and Alesh's Rare Fin
  combos (×1.5–1.6 in 0c14, 4e36, a9d7) were the same mistake, the placement taking the first path's hit of a shared
  key; each showed only as an operator's odd ratio, found by sorting `hits --json` by logged ÷ predicted and reading
  the kit's `jumps` by hand.
- **Cause:** the placement matches hits by frames, the replay's "contradicted jump" rule (drivers.ts) silently drops
  the jump the pinned landings contradict, and nothing reports a dropped jump or a cast whose landings read as
  another path's hit ("assumed" by "the event's other kit hit").
- **Suggestion:** a `JUMPDROP` line in `zmdlogs replay` (the cast, the jump dropped, the pinned landing that
  contradicted it), and in `zmdlogs groups` a row per cast whose landings all match only by "other kit hit".
- **Files:** packages/engine/src/timeline/drivers.ts (record the dropped jumps on the state or the result),
  packages/logs/src/views.ts, packages/logs/src/buffreplay.ts (BuffReplay field).
- **Why it helps:** the next shared-key path mistake (a chance jump, a stance) is one grep of the replay instead of a
  ratio hunt; it would have shown both today's in a minute.

## 3. A changed engine file recomputes every log's hits cache, and `hits --all` runs in the foreground

- **What happened:** `zmdlogs hits --all --operator Rossi --event attack4 --json` after one edit to drivers.ts hit the
  Bash tool's 2-minute limit (moved to the background), and a full `hits --all --json` took about 10 minutes. Both
  were for questions over one operator.
- **Cause:** the cache key is the code, so any engine edit invalidates every fixture, and `--operator` filters after
  computing every log.
- **Suggestion:** with `--operator`, compute only the fixtures whose team has the operator (devFixtures
  withOperators) before the cache lookup; print an estimate ("74 logs uncached, ~8 min: run it in the background")
  when more than a few are uncached.
- **Files:** packages/logs/src/hitsworker.ts, packages/cli/src/commands/zmdlogs.ts (hits).
- **Why it helps:** per-operator questions after an engine change take seconds per relevant log, not minutes for all.

## 4. A measure with --split files re-measures every part on every moved log

- **What happened:** the combined measure with `--split files --base 81c3e91` took about 35 minutes (five parts,
  each on the logs the whole change moved), while I only needed to know which of two files moved 9c6e.
- **Cause:** `--split` has no way to name the part(s) of interest.
- **Suggestion:** `--split files --only <path>` (measure that file's diff alone and the rest as one part).
- **Files:** scripts/measure.ts.
- **Why it helps:** a two-file attribution costs two parts, not five.

## What worked well

- `measure --variant` with five readings in one run: the operator curves' verdict in one queue slot.
- The assumptions registry made the totals' crit rule a reading with its numbers, not a silent change.
- `zmdlogs control` answered "who was controlled at 154 s" at once; `zmdlogs differences --what` found Alesh's
  weapon layer in one call.
- scripts/edit.ts for doc edits with backticks, and the bash guard's refusal messages saying the safe form.

## Outcome (round 14)

- 1 (The totals' "matched −5.7%" mixed the model's error with one fight's crit luck, and no view split them): done (ef86905): `zmdlogs totals <fixture> --by crit` (the matched parts per operator by TotalsCrit: known, exact, read, expected, each kind's error and share of the fight) and `hits --json` `totalsPredicted` / `totalsCrit` (enginecheck.ts engineReadings records how the totals took the crit); 0c14's Rossi: 8 landings at expected crits −22.9%, −0.3% of the fight
- 2 (Paths that share keys: no view says which path a cast took against its values): the JUMPDROP half done (e0cec23: drivers.ts replayCast tells a `dropped` callback, record only, team-ab identity unchanged; `zmdlogs replay` and `decisions` print each dropped jump with the logged landings that contradicted it, 489c's Rossi sequence 2 at 18.77 s); the groups row carried (2026-11-26-backlog-after-round-14.md point 2)
- 3 (A changed engine file recomputes every log's hits cache, and `hits --all` runs in the foreground): done (ef86905): with `--operator`, `hits` and `differences` read only the logs whose team has one (reports.ts withOperatorsOnly), and a run with more than 8 logs to check says how long (about 8 s a log per worker) and to run it in the background
- 4 (A measure with --split files re-measures every part on every moved log): done (7d612b5): `measure --split files --only a,b`: those files one part, every other file one more
