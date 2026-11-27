# Zhuang Fangyi's and Liino's mismatches (2026-11-27)

Task: find and fix the recurring causes of Zhuang Fangyi's and Liino's mismatches (accuracy agent, a worktree off main
7e6c12f, merged with 22367af before the final numbers).

## 1. Fallback matches hid a ×3.125 placement error for weeks

- **What happened:** Zhuang Fangyi's attack 4 was placed as attack 2 in all five of her logs (125 hits off by ×3.125),
  but the hits read as "fallback" (counted as matches), so neither the mismatch rate nor the by-operator table showed
  it. Only `zmdlogs groups`' last section ("Casts whose every landing matched only as the event's other kit hit") named
  it. Fixing it moved no mismatch count at all.
- **Cause:** a fallback match takes the log's listing for the reading and also takes the *other kit hit of the key*
  as a fit; the scoreboard counts both as matches. A placement that picks the wrong step of a shared key is invisible
  in every headline number.
- **Suggestion:** count "matched only as the key's other kit hit" (the groups section's cast list) per operator in
  the scoreboard's by-operator table and in `measure`'s summary, as its own column ("wrong step"), and print it first
  in `zmdlogs groups`.
- **Files:** scripts/accuracy.ts, packages/logs/src/groupsview.ts (or wherever `groups` lives), scripts/measure.ts.
- **Why it helps:** a whole class of placement errors becomes a number that moves; cheap (the data is already computed).

## 2. Placement rules' side effects only show in other operators' logs

- **What happened:** three successive rules in logcasts.ts (a time bound on launched entities, a "newer cast with the
  key" cut, the same-ms ordering) each fixed Zhuang Fangyi and broke someone else: Yvonne's combo field and her
  ultimate shots (5082, abfd), Rossi's combo 3 (3f78, 207f). Each round trip was a full `measure` (5–10 min with the
  lock queue) and then hand-diffing `casts --choices` with cli-ab per log.
- **Cause:** no quick way to list every placement decision a change moves across all logs; `zmdlogs decisions` covers
  the replay's decisions, not the placement's CAST choices or joins.
- **Suggestion:** `zmdlogs casts --all --choices --differ <ref>` (or a `scripts/cli-ab.ts --all-fixtures` mode): the
  CAST/HIT lines that differ from another commit's code, per log, then a count per rule (anchor, window, restart, …) and
  per operator. Seconds, no lock.
- **Files:** packages/logs/src/views.ts (castsView), packages/cli/src/commands/zmdlogs.ts, scripts/cli-ab.ts.
- **Why it helps:** a placement rule's false positives are visible before the measure, as `decisions --assume` does
  for replay rules.

## 3. Stage-factor logs dominated the operators' mismatch lists

- **What happened:** of Zhuang Fangyi's 225 mismatches 122 were c6d8's ×0.1 shield phase, of Liino's 227 about 160 were
  c6d8's and 8915's; `groups` and `differences` put them first, and it took a time-bucketed ratio script to see that
  they were one stage factor each. (Main's `stageFactors`, merged mid-task, now handles them.)
- **Cause:** the views had no notion of a fight-wide factor window.
- **Suggestion:** `groups` could print "a fight-wide factor" as its own cause (every operator's hits at one ratio for a
  stretch), as it prints team-wide; with `stageFactors` in, a check that flags such stretches not yet in a fixture.
- **Files:** packages/logs/src/groupsview.ts (the groups view), packages/logs/src/enginecheck.ts.
- **Why it helps:** the real kit causes come first.

## 4. "Linger" was in the kit against the data

- **What happened:** Liino's kit had a 5 s team-ATK linger after her stance; the data's CreateBuffAction for it is
  `isEnable false`. Found only by `gamedata tree` on the parent buff while chasing a log contradiction.
- **Cause:** kit notes cite the buff's own file, not whether the action that creates it is enabled.
- **Suggestion:** `efsim kit-census` (or a kit test) flags a kit buff whose gameBuff is created only by disabled
  actions in the data (`gamedata who <buff>` lists its creators; add their isEnable).
- **Files:** packages/cli/src/commands/kit-census.ts, packages/cli/src/commands/gamedata.ts.
- **Why it helps:** catches a kit modelling a dead effect without a log.

## What worked well

`zmdlogs casts --choices` (the rule that picked each step) found the attack-4 cause in minutes; `holds --why
status:<name>` gave the Electrification gap directly; `measure --base` with the per-log mean per-hit error for mixed
logs made "worse" logs explainable.
