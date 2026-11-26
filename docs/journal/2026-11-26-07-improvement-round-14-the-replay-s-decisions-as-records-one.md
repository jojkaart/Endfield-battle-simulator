## 2026-11-26: Improvement round 14: the replay's decisions as records, one composition each, the buffreplay.ts split

**Goal:** the five open friction reports (round 13's backlog, round 13's own report, the 0c14-and-operator-curve,
away-and-presses and combo-hold reports), every file free this round, so the buffreplay.ts split and the backlog points
held back for the replay, the engine and the check could be done. No verdict may move.

**Done** (docs/friction-done/2026-11-26-round-14.md; the backlog: docs/friction/2026-11-26-backlog-after-round-14.md):
- **buffreplay.ts in six modules**, a move only (80253f4): castassembly.ts, replayrun.ts, holdinputs.ts,
  replaycrits.ts, replayedhits.ts; buffreplay.ts keeps replayKitBuffs and BuffReplay. The 130 statements checked
  against the original by AST; prose citations follow the names.
- **The replay's decisions as records**: BuffReplay.made; `efsim zmdlogs decisions <fixture…|--all> --assume <id>=<r>`
  (the SKIP, TAILCUT, FAILED, MISSED, INFER, MADE, JUMPDROP, FORCED, INSIDE, CUTS lines two readings differ in); the
  EVENT line from the replay's own record (8915 111.23 s: the inferred press); JUMPDROP from drivers.ts replayCast's
  `dropped` callback; `zmdlogs hits --against <id>=<r>`.
- **One composition each**: composeCheck (snapshotEntry and hitRecords), replaykeys.ts (the strings the snapshots'
  kinds group by), a burst's recorded infliction (StatusEvent `inflictedAt`) for `zmdlogs bursts` and `clocks --clock
  burst`, logBuffReplay refusing data not under its combo-curve reading.
- Smaller: `totals --by crit` and `hits --json` totalsPredicted / totalsCrit; `hits --operator` reads only the logs with
  the operator, with a time estimate; `measure --split files --only`; logBuffReplay's options object and
  scripts/typecheck-scratch.ts; per-command CLI options; "Chen" for Chen Qianyu; `friction.ts check` and its test.

**Scoreboard** (`npm run snapshots:update`): "No log's verdicts moved"; development plain 69.0%, mismatch 11.4%, mean
|damage error| 6.9%; hold-out 80.8%, 5.6%, 8.4% (unchanged). The split alone: `measure --base 0b094c3`, no log moved.
Engine record changes: team-ab's identity check against 0b094c3 twice, every team's fight the same.

**Decisions:** six modules, not the backlog's four (the crits and the hit readings have no caller in the run); the
fight's lives not unified (lastLifeKilled's and loggedEnemyHp's rules differ, so one function moves verdicts: the
accuracy list); the log context's signature change carried, its failure mode made an error first; CLAUDE.md not edited
(a sub-agent's brief can't authorize it): its views sentence is the lead's.

**Problems:** the first guard run showed `zmdlogs decisions --assume combo-curve=…` had replayed the defaults on the
reading's data, the bug class the guard is for; "Chen" matched Purrchena too until the name's word starts came first.
