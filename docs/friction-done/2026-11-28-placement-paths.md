# Placement paths: multiplier bounds, slots cut to a path, hitless ultimate stops (2026-11-28)

Task: the backlog's three placement entries (a cast's slots cut to its path, a value rule on a consumed-scaled
multiplier's bounds, the unplaced ultimate events' stops at ultimateEventRead) and 9c6e's 78.88 s tick pair; branch
worktree-agent-a44e9ee2d8c7368e5 (docs/journal/2026-11-28-10-placement-paths-a-value-rule-on-multiplier-bounds-slots-cut.md).

## 1. A pass's own stops are invisible: 9c6e's phantom stop took a scratch script to find

- **What happened:** 9c6e 78.88 s (the Barrage Array's first tick pair left two slots) looked like the twin-by-time
  rule's stop window. `zmdlogs casts --choices` showed no stop near 78.88 s: its STOP lines are the replay's. Only a
  scratch script printing `passStops(data, fx, placementPasses(...).first)` (not exported until this round) and a
  second one printing each pass's casts showed Liino's ultimate placed again in pass 1 at 76.31 s, a stop
  76.30–78.87 s that pass 2 read and the final placement never has (its ultimate merge applies only after pass 2).
  About half an hour from "the rule is right" to "the input is wrong".
- **Cause:** the placement's passes read stop lists no view prints; the casts view shows the final placement's casts
  and the replay's stops, so a rule reading pass 1's stops can't be checked against what it read.
- **Suggestion:** `zmdlogs casts <fixture> --passes` (or `placement --passes`): per pass, its casts (DISTINCT, with
  the merge that pass used) and the stops the next pass reads (passStops, marking the unplaced events' ones), in the
  CAST / STOP line format, beside the final ones. Meanwhile scripts/probes/placement/pass-stops.ts (this round)
  prints both.
- **Files:** packages/logs/src/views.ts (casts view), packages/logs/src/placementwords.ts, packages/logs/src/logcasts.ts
  (passStops, placementPasses: already exported).
- **Why it helps:** every placement rule that reads `stops` (byTime, castStart, beforeStopStart, joinable) reads pass
  1's; a wrong pass-1 stop then looks like a wrong rule. Cheap: both functions exist.

## 2. placeWith's per-hit decisions depend on their definition order

- **What happened:** the value rule needs the cast the landing would open (choose, joinDelayed, anchorFree) at the
  join decision, but those were defined below the join block in placeWith's per-hit loop (a `const` read before its
  line throws). Moving 35 lines needed a scratch script (Edit can't move a block) and a lazy `openChoice()` so the
  hits that join don't pay for a choice.
- **Cause:** placeWith's loop body is ~250 lines of `const`s in one closure, each rule reading the ones above it; a
  rule that needs a later stage's answer has nowhere to ask.
- **Suggestion:** split the loop body into named stages returning records (twin → join → open), each a function of
  the hit and the pass state, with the opening (choice, late join, jumped start) a memoized record any earlier stage
  may ask, as openChoice now is.
- **Files:** packages/logs/src/logcasts.ts (placeWith).
- **Why it helps:** the next rule that compares "stay" with "open" (the INSIDE leads, the combo windows) is one
  function, not a move; and `--split hunks` gets one hunk per stage. A move: identity check first.

## 3. split-module rewrites another agent's importers

- **What happened:** moving ultimateEventRead out of castassembly.ts (logcasts.ts needed it and castassembly.ts
  imports logcasts.ts) rewrote views.ts's import line, a file the parallel agent owned; I reverted it and added a
  re-export in castassembly.ts by hand.
- **Cause:** split-module always rewrites every importer; it has no "keep the old path" form.
- **Suggestion:** `--reexport` (keep importers as they are; the original module re-exports the moved names), for a
  move made beside another agent's files; the lead drops the re-export after the merge.
- **Files:** scripts/split-module.ts.
- **Why it helps:** a move becomes one agent's change with no edit in a shared file.

## 4. lead-status reads "Diagnosed, not fixed" as fixed

- **What happened:** `node scripts/lead-status.ts 8f32@38.50` said "fixed: every one of 2 mention(s) says so"; the
  paragraph begins "**Diagnosed, not fixed: 8f32 38.50 s**". Same for 9c6e@78.88 ("Still possible: … stays two
  slots" inside a "Fixed:" bullet).
- **Cause:** the FIXED marker matches the word anywhere in the paragraph; a negation or a still-possible clause in a
  fixed bullet isn't read.
- **Suggestion:** "not fixed", "Diagnosed, not fixed" and "Still possible" sentences count as OPEN for the ids they
  name; a bullet that is both says so per sentence.
- **Files:** scripts/lead-status.ts.
- **Why it helps:** the brief's own check would have flagged nothing wrong here, but the next one may trust it.

## What worked well

`cli-ab.ts <ref> --placement --summary` (which logs a rule moves, in a minute, before a measure); `measure --at HEAD
--base <commit>` per commit while editing on; `measure --hits`' landing lines (Alesh's hook → hook_ex said what the
path cut did without opening the log).

## Outcome (round 24)

- 1 (A pass's own stops are invisible: 9c6e's phantom stop took a scratch script to find): done (1f25928): `zmdlogs
  casts <fixture> --passes` (passesview.ts): each pass's CAST and DISTINCT lines and the stops pass 2 read (logcasts.ts
  passStopParts: pass 1's casts' and the unplaced cast events', marked), beside the final placement's own; passStops
  reads passStopParts (identity: the same).
- 2 (placeWith's per-hit decisions depend on their definition order): done but the stages as functions (carried:
  2026-11-28-backlog-after-round-24.md point 2) (0a1efea): the four stages written down at the loop's head (context,
  the running cast, twin or join, open) with stage markers, and the rule that a later stage's answer is asked through a
  memoized function as openChoice is (comments only).
- 3 (split-module rewrites another agent's importers): done (818fb42): `--reexport` leaves every importer as it is;
  the original re-exports the moved names it exported (types apart), with a comment to drop it after the merge.
- 4 (lead-status reads "Diagnosed, not fixed" as fixed): done (818fb42): "not fixed", "Diagnosed, not fixed", "Still
  possible", "still open" read as open; a fixed case with an open part is BOTH, its open sentences printed.
