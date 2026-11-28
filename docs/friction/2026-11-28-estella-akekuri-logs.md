# Estella and Akekuri logs: screening, import, two fixes (2026-11-28)

Task: find and import more ZMDLogs development logs for the owner's team's Estella and Akekuri, run their first
checks and build fits, and fix what they decide for the two kits (branch worktree-agent-a651e91d7f794688a).

## 1. Screening a candidate costs a hand-written script per question

- **What happened:** the profile → export → detail → import chain has no tool before `zmdlogs import`. I wrote five
  scratch scripts to screen 14 candidates: a fetcher with the 4 s gap (curl, since the importer's `fetchBattle` isn't
  exposed as a CLI step), an export summary (stage, boss, parser, every operator's level, potential and weapon skill
  levels, plus whether `refuseHoldout` refuses it), a detail summary (targets by `targetCharacterKey`, each operator's
  share), a check of whether the stage and the enemy variant are in the pinned data (towers 21–24 aren't; I found it
  by grepping DungeonTable), and whether each operator has a kit (Minghe doesn't). Each is a question the importer
  answers only by failing later, or not at all (it imported nothing wrong, but a tower-24 log would have gone in with
  an unknown enemy).
- **Cause:** the import procedure lives in docs/accuracy-plan.md "Choosing logs" as rules, with no command that
  applies them; `zmdlogs import` takes one id and checks only the hold-out list.
- **Suggestion:** an `efsim zmdlogs screen <battle id…> [--detail]` that fetches each export (and with `--detail` the
  detail, into the raw cache) at the documented gap and prints one line per battle with the rules' verdicts: parser ≥
  v59, every operator level 90 (else which), a kit for every operator, the stage in DungeonTable and the enemy in the
  data, single target (from the detail), a hold-out or an existing fixture (yes / no only), the account's count among
  development logs (a count, never the id). Its output stays on the terminal (account ids never printed).
- **Files:** packages/cli/src/commands/zmdlogs.ts, packages/logs/src/zmdlogs.ts (fetchBattle, a screen function),
  packages/logs/src/logs.ts (refuseHoldout, stageEnemyLevel), docs/data-sources.md (the ZMDLogs section).
- **Why it helps:** every import round redoes this by hand (2026-11-08, 11-13, today); the rules become checks, and a
  log on a stage the data lacks is refused before its detail's minute of download.

## 2. A replay that stops on an undecidable kit condition looks like a bad log

- **What happened:** 8f32's first check said 37 of Estella's 63 hits were log-listing fallbacks and the fight −56.8%,
  with the reason buried under "casts the replay couldn't make: … the replay stops at 44833 ms: a kit condition can't
  be decided here: {"enemyRank":[1]}". It took a grep of the engine (expr.ts, situation.ts) and the data loader to find
  that the enemy variant simply had no rank (no display entry of its own).
- **Cause:** a missing enemy fact (rank) only surfaces when a kit asks for it, as a replay stop, far from the data.
- **Suggestion:** `zmdlogs import` (and `efsim find` on an enemy) say which enemy facts are missing for the target
  (rank, stagger nodes, display name = id), and the check's first lines put "the replay stopped at t s: <why>" above
  the per-operator verdicts when it stops.
- **Files:** packages/logs/src/logs.ts (importBattle's notes), packages/logs/src/logcheck.ts (the report's head),
  packages/cli/src/enemyview.ts.
- **Why it helps:** the stop is the first thing to fix in a new log; today it reads as many unrelated fallbacks.

## 3. Counting a buff's applications per cast needs its `since` values, which no view prints

- **What happened:** to see that 8056's first ultimate made one SP grant where the replay made three, I wrote scripts
  printing every distinct `since` of a game buff from a source (`effects[].since`), then one pairing the replay's
  trigger firings (`ReplayOptions.trace` `trigger:`) with them and the replay's SP (`stateAt`, `spAt`), now
  scripts/probes/sp/spcap.ts. `replay --kit-buff … --against-lanes` pairs chain starts only, so a refreshed or layered
  buff (Positive Feedback's shared timer) or a per-application listing (Thermite, OBJ Edge) didn't show the count.
- **Cause:** the lane views group by run; "how many times did the log apply it, against the replay's firings" isn't a
  view.
- **Suggestion:** `zmdlogs replay --trace-trigger <spec> --against-starts <game buff>`: each firing beside the nearest
  logged `since` of the buff it makes (±400 ms), unpaired ones on both sides, with the replay's SP at each (for SP
  triggers).
- **Files:** packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts, scripts/probes/sp/spcap.ts (replaced).
- **Why it helps:** every "the kit's trigger fires more / less than the log" lead (Thermite, Frontiers, Edge) starts
  with this count.

## What worked well

- `fit-build` named the level-80 builds in seconds and agreed across two logs of one account.
- `holdout-split.ts add-development` and the importer's `refuseHoldout` kept the hold-outs out of the screening
  without my ever seeing one.
- `measure --split commits` told apart the rank fix and the kit change in one run; `team-ab`'s identity check settled
  the team numbers in a minute.
- `zmdlogs hits --json` with `counterfactuals` showed the ×1.262 combo's missing buffs directly.
