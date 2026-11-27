# Status pairing and two-target fights (2026-11-27)

Task: the logged status hits' pairing with the replay's status landings as a value-based assignment
(BuffReplay.statusLanding), and 9c6e's two targets marked so they leave the development means; beside an agent on
placement cases. Branch: this worktree's, based on main at 107766a.

## 1. Separating a reclassification from a code change in the scoreboard numbers needs scratch scripts

- **What happened:** the brief asked for the 9c6e reclassification reported apart from the accuracy change. The
  snapshots:update summary (and `scripts/accuracy.ts --compare main`) mixes both: development 81.5 → 82.5% plain. To
  get "main's snapshots with 9c6e in its own row" I wrote scratch/reclass.ts (snapshotsAt plus a hand-built split),
  and for the where-the-error-lives shares with and without 9c6e a second one (scratch/reclass2.ts, re-implementing
  sharesAggregate's means, which aren't exported). Two scripts, three runs, for two numbers the journal needs.
- **Cause:** a comparison regroups each side by its own snapshots' marks; nothing applies today's grouping to the
  reference, and the shares aggregate is private to accuracy.ts.
- **Suggestion:** `node scripts/accuracy.ts --compare <ref> --regroup` (the reference's entries grouped by the current
  marks: severalTargets, the split), printing both the regrouped reference and the plain one, so the lines read
  "reclassification: a → b; change: b → c"; export sharesAggregate (or a `--shares` line per group in --compare).
- **Files:** scripts/accuracy.ts.
- **Why it helps:** any future mark (a stage log, another multi-target fixture, a fixture moved between groups) gets its
  own effect in one command, and journals stop quoting scratch sums, which CLAUDE.md forbids anyway.

## 2. Measuring a constant's value takes a commit, an edit, a diff and a revert per value

- **What happened:** to compare the pairing's wide window (30 vs 60 frames) and value fit (1% vs 10%) I had to commit
  work in progress (the new file was untracked, so `git diff` showed nothing), edit the constant with sed, write
  `git diff --output=scratch/x.diff`, check it out again, and repeat per value; then redo one diff after the next
  commit moved its context (the tried diff in docs/tried/ needed a third copy). About ten tool calls for two numbers.
- **Cause:** `measure --variant` takes only assumption readings; a numeric constant has no reading, and `--patch`
  needs a diff file made by hand.
- **Suggestion:** `npm run measure -- --set <file>:<CONST>=<value>` (repeatable, also as a `--variant` entry): measure
  rewrites `export const CONST = …;` in its queued snapshot of the tree (refusing when the pattern isn't found once)
  and keeps the resulting diff under scratch/measure/patches/ for docs/tried/.
- **Files:** scripts/measure.ts, docs/design/tests.md ("Measuring a change").
- **Why it helps:** tuning a window or tolerance (a common shape: NEAR_FRAMES, KILL_EDGE_MS, VALUE_TOLERANCE) becomes one
  call per value with variants in one run, and the tried diff comes for free.

## 3. Waiting for a background job: Monitor's events arrive only between turns

- **What happened:** following CLAUDE.md I armed a Monitor on measure's EFSIM-DONE line, then went on; with nothing
  else to do I re-armed two more by mistake (one per check), and stopped them by hand. What worked was a foreground
  `until grep -q '^EFSIM-DONE measure ' scratch/x.log; do sleep 15; done` with a 10 min timeout: the guard accepts it
  and the call returns with the result.
- **Cause:** CLAUDE.md says "wait with Monitor" without saying that a sub-agent with nothing else to do gets the event
  only when its turn ends, and that the foreground until-loop is allowed (only a bare `sleep` is refused).
- **Suggestion:** one sentence in CLAUDE.md's "Long runs" item (the lead's file): "with nothing else to do meanwhile,
  wait in the foreground: `until grep -q '^EFSIM-DONE <job> ' <log>; do sleep 15; done` (timeout 600000), repeated".
- **Files:** CLAUDE.md (for the lead).
- **Why it helps:** no duplicate monitors, no idle turns polling a log by hand.

## 4. A new scoreboard group touches three files that each decide groups their own way

- **What happened:** the several-targets row needed the group in scripts/accuracy.ts (groupOf by key and split), the
  mark in packages/logs/src/snapshotentry.ts (a describing totals key) and scripts/measure.ts's overlay (whose split
  comes from holdout.json, not from the entries), or measure's summaries and the scoreboard disagreed on 9c6e.
- **Cause:** a log's group is computed from its key and the split file, while the facts that now decide groups live in
  the entries; measure builds its own split.
- **Suggestion:** one `groupOf(key, split, entry)` that reads describing keys from the entry, used by allLogs, measure's
  sharesLines/kindLines and overlay alike (withSeveralTargets is the first step; fold it into groupOf).
- **Files:** scripts/accuracy.ts, scripts/measure.ts.
- **Why it helps:** the next mark (a "without stage fights" row, say) is one line in groupOf.

## What worked well

- `zmdlogs bursts --all` showed every one-sided burst with its value and its neighbour's: the equal-value late pairs
  (and the value fit as the gate) were visible at a glance.
- `measure --variant status-pairing=nearest` with the plain run gave the change's effect both ways in one run, and
  `--hits` named every hit that moved, so "none worse" was checkable.
- `scripts/edit.ts` for fixture and doc edits with backticks.
