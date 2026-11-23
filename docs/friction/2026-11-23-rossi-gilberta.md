# Wolven Blood's crits and Gilberta's tower-boss stacks (2026-11-23)

Task: infer Rossi's unlogged crits from Wolven Blood's listed layers, and find why Gilberta's Vulnerable stacks outlive
20 s on the tower bosses (4360, 9847). Branch of this worktree, base main at 6921b3f.

## 1. Every change to a hold bound moves the whole placement, and no view says which bound moved what

- **What happened:** allowing instance buffs' runs as hold clocks fixed 4360, but took 489c from 517 to 475 plain and
  9555 from 261 to 246; a crit inference with no hold change at all (layerCrits) took 4a64 from 150 to 140, through the
  Wolven Blood runs' bounds moving Arcane's Corrosion step at 16.8 s. Each time I diffed `zmdlogs holds --verbose` at two
  commits by hand (`scripts/at-commit.ts`, two runs, `diff <(grep bound: …)`), then `zmdlogs hits --json` at both and a
  scratch Python diff of the modifiers, to find which new bound did it. Four measure rounds (≈5 min each with the
  reference) went to this; 4d60 placed 11 s of holds from one bad bound before I saw it.
- **Cause:** the placement is global (least total, greedy drops), so a bound anywhere moves holds everywhere; the views
  show one commit's bounds and placement, never the difference, and nothing ties a moved verdict to the hold that moved.
- **Suggestion:** `efsim zmdlogs holds <fixture> --base <ref>`: the bounds added, removed and dropped against another
  commit's code, and each unit's placement before and after; and in `measure --hits`, for a hit whose verdict moved, the
  kit buffs whose modifier changed at it (the `hitdiff` I wrote: scratch/hitdiff.py, landing modifiers by source).
- **Why it helps:** "which bound moved this log" becomes one command instead of four; a bad clock (4d60's 7.7 s ask)
  shows as one line.

## 2. A hold clock's eligibility is spread over three places with different refresh rules

- **What happened:** Perlica's run in 4360 was dropped by `refreshed` in buffreplay.ts loggedLaneEnds, then by
  `def.instances !== undefined` in runBounds; holds.ts statusLanes has its own copy of the refresh rule (left alone: another
  agent's file). I found the second filter only with a temporary `console.error` in runBounds.
- **Cause:** runBounds' long filter line and loggedLaneEnds' `refreshed` are silent; `zmdlogs holds --verbose` lists
  kept and dropped bounds, not the runs never considered.
- **Suggestion:** `zmdlogs holds --why <buff>`: for each instance of a kit buff, the run it was paired with and the rule
  that skipped it (refreshed, instances, layered, not expired, too late). One refresh rule shared by buffreplay.ts and
  holds.ts.
- **Why it helps:** the next "why isn't this run a clock" is answered without editing source.

## 3. A test asserting a verdict class can pass at the base commit

- **What happened:** my first lead-2 test asserted Gilberta's ultimate hit at 116.0 s is plain; it was plain at 6921b3f
  too (the hit doesn't read its own Susceptibility). Only the measure's per-hit list showed nothing changed there; the
  Susceptibility's effect is on the hits after it.
- **Cause:** nothing in the workflow runs a new test against the base commit.
- **Suggestion:** a helper `node scripts/verify-at.ts <base> --tests <file> -t <name>` (or a line in tests.md) that
  runs the new test at the base and expects it to fail.
- **Why it helps:** catches non-discriminating tests before review.

## 4. The kit-buff window counts are fuzzy near changes

- **What happened:** to compare the replay's Wolven Blood layer count with the log's per hit I used `kitWindows`, sampled
  at hits ±500 ms, so counts at a crit's own ms were off by one either way; `BuffReplay.instances` returns null (crit
  dependent) for most of Rossi's hits. Telling "a layer missing" from "sampling" took reading `zmdlogs replay` line by
  line.
- **Suggestion:** a view `zmdlogs layers <fixture> --kit-buff owner:id`: per logged hit, the log's listed layer count
  and the replay's at the landing's frame (before and after it).
- **Why it helps:** layered buffs (Wolven Blood, MI Security, Yinglung's Edge) are a recurring lead.

## What worked well

- The log's `since` on every listed layer made the crit inference exact and testable; `devFixtures` and placeHits made
  the hidden-flag cross-validation a 40-line script.
- `measure --against <ref> --hits` with the per-hit list, and `zmdlogs worldtime` / `clock --kit-buff` for the windows.
- `scripts/at-commit.ts` for running the CLI at another commit side by side.
