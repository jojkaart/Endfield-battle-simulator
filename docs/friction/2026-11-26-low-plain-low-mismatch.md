# Low plain, low mismatch: Rossi's and Chen's assumed matches (2026-11-26)

Task: find why most of Rossi's (and Chen's, Yvonne's, Lifeng's, Pogranichnik's, the male Endministrator's) hits match
only under an assumption or the log-listing fallback, and make the readings with a mechanism the default. Base main
36e3bc8, this worktree's branch.

## 1. No view groups an operator's matches by what they assume

- **What happened:** `zmdlogs groups` sorts mismatches, `differences` sorts listing-vs-replay disagreements, and `hits
  --json` carries no assumption labels or kinds at all (HitRecord has `class` but not `assumptions`). The question
  "what do Rossi's 1109 non-plain matches assume" needed a scratch script over composeCheck
  (scripts/probes/assumed/kinds.ts), about ten minutes to write and two to run per operator; `zmdlogs check`'s
  "matched assuming" line has the labels but per fixture, unsorted and unfolded (numbers in labels make each unique).
- **Cause:** the verdict's assumptions are dropped at the export (hitexport.ts) and no view reads them.
- **Suggestion:** add `assumptions: { kind, label }[]` to HitRecord (hits --json), and a `zmdlogs assumed --operator
  <op> [fixture…|--all]` view printing what kinds.ts prints (by kind, kind set, event × kind, folded label), with
  `--verbose <kind set>` listing the hits. Then delete the probe.
- **Files:** packages/logs/src/hitexport.ts, packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** the first step of any "low plain" lead is one command, cached like `hits`.

## 2. The primary reading ignored the replay's own crit inference

- **What happened:** the replay reads crits the log leaves out (replaycrits.ts shownCrits / layerCrits / valueCrits,
  cross-validated at 0.90) and lands them, yet enginecheck.ts readingBasis set `crit = hit.crit === null ? "never"`,
  so 418 of Rossi's matches were "assumed: crit" though the replay knew. Found only by noticing `critSource` /
  `replayCrit` in `hits --json` beside the verdict.
- **Cause:** two modules decide the same fact (a hit's crit) independently; the check's readings never asked the
  replay. Now fixed (engine assumption `check-crits`), but the pattern may repeat for other facts the replay infers
  (Corrosion's level, event counts, Link) where the check still enumerates alternatives as assumptions.
- **Suggestion:** a short list in docs/design (the log check's page) of every fact the replay decides and whether the
  check's primary reading takes it; a test that each one listed as "taken" is.
- **Files:** docs/design/ (the log check's page), packages/logs/src/enginecheck.ts.
- **Why it helps:** the next "assumed but the replay knew" is a table lookup, not a hunt.

## 3. A measured regression through the hidden-hold placement is hard to read

- **What happened:** the status-crit fix moved c4f3 −20 plain; `measure --hits` showed the hits and that hidden-hold
  units 10–21 moved by 30 s, but not which clock moved them. Tracing it went through `zmdlogs clock --kit-buff`, whose
  replay ("own", "first") isn't the check's ("check none" for instances the check's replay had), so its start times
  (68.50 s) disagreed with the check's modifiers on the same hits.
- **Cause:** the placement's evidence (which clocks bound which unit) isn't in measure's hold lines, and the clock view
  reports a different replay than the one the check reads without saying which instance is which.
- **Suggestion:** in measure's "Hidden holds" lines, name for each moved unit the clock (kit buff or status) whose
  bound moved most; in `zmdlogs clock`, print the check's instance start beside "first".
- **Files:** scripts/measure.ts, packages/logs/src/clockview.ts, packages/logs/src/holds.ts.
- **Why it helps:** a cascade through the placement reads in one step instead of three views.

## 4. Several Monitor waits for one background job

- **What happened:** I started a second Monitor on the same EFSIM-DONE line several times by mistake while the first
  was still running, then had to stop them one by one; a vitest `related` run through `| tail` printed nothing until
  it ended, so a "has output" wait never fired early.
- **Cause:** the background Bash task already notifies on exit; a Monitor on top is only needed for the EFSIM-DONE
  line, and piping a test run into tail hides progress.
- **Suggestion:** CLAUDE.md's long-runs paragraph: "the background task's own completion notice is enough for a plain
  command; Monitor only for a job whose stdout is redirected to a log with an EFSIM-DONE line; never `| tail` a
  background test run (write it to a file with --reporter=./scripts/vitest-progress.ts)".
- **Files:** CLAUDE.md (the lead's).
- **Why it helps:** fewer duplicate notifications and stray tasks.

## What worked well

- `measure --variant check-crits=none` split two changes' effects in one run, with the plain tree's numbers beside.
- `differences --what … --hits` showed the Wolven Blood layer gap growing by one at each Lift crit: the mechanism
  read straight off the listing.
- Registering a check reading in ENGINE_ASSUMPTIONS made the A/B and the test (`check-crits=none`) free.
