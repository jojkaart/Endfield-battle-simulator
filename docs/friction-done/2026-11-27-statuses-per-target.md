# Statuses per target (2026-11-27)

Task: build the design of docs/design/data.md "Statuses per target" for the several-targets row (6339, 7b54, 9c6e):
a second replay with each landing on its target, the engine's enemy statuses per target, the DEATH lines from the
replay's record and a view of its status record per target (branch of the accuracy agent on main at 5b08218, beside
the interrupted-casts agent). Result: replay assumption target-statuses `per-target`, `zmdlogs statuses`.

## 1. Code that reads `TimelineState.enemy` as "the enemy" is spread over both packages, with no list of it

- **What happened:** the per-target state keeps the current target's statuses in `enemy` and the others in
  `targets.others`. The first measure looked right, but 9c6e's Corrosion ramp came out ×1.19 high on hits at 30.19 s:
  the hidden holds (clock.ts shiftEnemy, via holdWorld) shifted only `st.enemy`, so a swapped-out target's Corrosion
  missed every hold. Finding that took a `zmdlogs replay --trace-buff status:corrosion` under both readings; then a
  grep for `\.enemy\b` over packages/engine and packages/logs turned up three more readers that treat `enemy` as the
  only one (holdinputs.ts statusInstances, which the holds are placed from; replayrecord.ts enemyStatuses, the status
  traces; the freeze in actions.ts). One measure (6 min with the lock's queue) per reader found late.
- **Cause:** the enemy side is one field read directly everywhere (51 sites in timeline/ alone); nothing says which
  of them mean "the target this hit lands on" and which mean "the world's enemy state" (holds, stops, records).
- **Suggestion:** an accessor pair in the engine (`timeline/targets.ts` has `everyTarget` and `targetEnemy` now): a
  lint rule (or a test grepping packages/logs) that refuses `.enemy.statuses` / `.enemy.physical` /
  `.enemy.infliction` outside landing.ts, status.ts and situation.ts, so a reader picks `everyTarget(st)` (records,
  holds) or `st.enemy` (the landing's target) on purpose; docs/design/timeline.md's new paragraph lists the rule.
- **Files:** eslint.config.js (or a test under tests/), packages/engine/src/timeline/targets.ts, docs/design/timeline.md.
- **Why it helps:** the next per-target state (the Stagger per target, a shielded slug's state) can't silently stay
  one; the cost is a few explicit call sites.

## 2. The check's per-target assignment numbers targets its own way, the replay's ids are another pass's

- **What happened:** the second replay's target ids come from the first pass's assignment, but fightTargets ran
  assignTargets again on the second replay, which numbered the targets afresh: on 9c6e T1 and T2 swapped, and every
  hit was read at the other target's statuses (plain 314 → 302 until found by diffing `zmdlogs hits --json` verdicts
  under both readings with jq). Two fixes measured (hold each hit to its first-pass target; read each candidate at its
  own statuses by id), one more measure each.
- **Cause:** a target id has no identity outside one assignment run: `TargetAssignment` is keyed by `LogHit`, its ids
  are positions in its own creation order, and nothing ties them to the replay's.
- **Suggestion:** give BuffReplay a `targetIds` note (the assignment the replay was made with, as now in
  `BuffReplay.targets`) and have `zmdlogs hits --json` print both the check's target and the landing's
  (`LandedHit.target`), flagging where they differ; a test that the second assignment keeps the first's ids on the
  three fixtures (most hits).
- **Files:** packages/logs/src/hitexport.ts, packages/logs/src/enginecheck.ts, tests/target-statuses.test.ts.
- **Why it helps:** an id mismatch shows in one view instead of as a verdict count that moved.

## 3. No per-hit diff of two readings' verdicts

- **What happened:** to see which hits a reading moved, I dumped `zmdlogs hits <fixture> --json` twice (stripping its
  first, non-JSON line with `tail -n +2`), turned both into TSV with jq and diffed them, four times over the task.
- **Cause:** `zmdlogs decisions --assume` diffs the replay's decisions and `hits --against <id>=<r>` the hits' zones
  of one reading, but nothing lists the verdict and prediction changes per hit between the default and a reading.
- **Suggestion:** `efsim zmdlogs hits <fixture> --verdicts-against <id>=<r>`: one line per logged hit whose verdict,
  class or prediction differs, both sides, with its target; and `--json` without the header line (or the header on
  stderr) so jq reads the file as it is.
- **Files:** packages/logs/src/hitexport.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** a reading's effect per hit in one command; measure's per-log counts say only where to look.

## What worked well

- measure's `--several-targets` with `--variant` and `--set` (the `fixed` alternative as a constant): each idea in
  under ten minutes, against the plain tree.
- The engine's replay-only scenario fields (loggedCrits as the model): `landingTargets` went in the same way, and
  team-ab's identity check confirmed the simulations untouched at once.
- The previous agent's design note and friction report named exactly the missing pieces (DEATH lines, the status view).

## Outcome (round 21)

- 1 (Code that reads `TimelineState.enemy` as "the enemy" is spread over both packages, with no list of it): done
  (72abb23) as a test, not a lint rule: tests/enemy-readers.test.ts lists every read of `.enemy.statuses` / `physical`
  / `infliction` / `vulnerable` in the packages with what it means; docs/design/timeline.md names it. The freeze's
  readers (clock.ts) read the current target only: on the backlog's accuracy list.
- 2 (The check's per-target assignment numbers targets its own way, the replay's ids are another pass's): done
  (5cef03e): HitRecord.target.landing (the landing's targets), `≠ landing T<m>` on `zmdlogs hits` lines,
  hitexport.ts targetMismatches, a test on 6339 (none) and 9c6e (one). 7b54 has 147 of 210: on the backlog's accuracy
  list (the second assignment's ids mapped onto the replay's moves verdicts).
- 3 (No per-hit diff of two readings' verdicts): done (5cef03e): it existed as `zmdlogs hits <fixture> --against
  <id>=<r>` (CLAUDE.md names it; both sides' class and primary reading, the modifiers only one has, a count per
  change); its lines now name the target on each side. `--json` writes only JSON to stdout: the line before it was
  the progress on stderr (`2>/dev/null`).
