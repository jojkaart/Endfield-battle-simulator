# Improvement round 20 itself (2026-11-27)

Task: improvement round 20 over the seven open friction reports and round 19's backlog, every file free; this
worktree's branch on main at aec0e3f. Points already in docs/friction/2026-11-27-backlog-after-round-20.md (point 2:
snapshots:update reads the tree while it runs, which kept this round to docs for its ten minutes) aren't repeated.

## 1. `--unpark` leaves the parked paragraph's own number list stale

- **What happened:** `node scripts/friction.ts carry … --lists --unpark "smoke and snapshots read the tree"` dropped
  round 6's entry 14 from the Parked section, but its paragraph still read "Round 6's points 1–10, 12 and 14 (full
  text in …)". I fixed the line by hand in the script that assembled the new backlog (a string replace), and only
  noticed it by reading the output.
- **Cause:** the paragraph's number list is prose written by an earlier round; withoutParked (scripts/friction.ts)
  removes entries and an intro left with none, not a number inside an intro that keeps others.
- **Suggestion:** in withoutParked, when an unparked entry's number `n` appears in its intro's "points …" list, drop it
  there too (a list of `a–b`, `a, b and c` forms: remove `n`, or split a range around it, `1–10, 12 and 14` → `1–10
  and 12`); else print a warning on stderr naming the intro line to fix.
- **Files:** scripts/friction.ts (withoutParked), tests/friction.test.ts.
- **Why it helps:** the parked list's intros stay true without a hand edit; small.

## 2. An `end` block in an edits file needs its `>>>>>>>` though the header suggests it is optional

- **What happened:** an edits file of eight `@@@ <path>` / `<<<<<<< end` appends (the outcomes) without `>>>>>>>`
  lines failed with "line 11: "@@@ …" inside the block opened at line 2"; nothing was written (all or nothing worked),
  and I added the closers with a scratch script.
- **Cause:** scripts/edit.ts's header says an `end` block's `=======` may be left out, which reads as if the block
  needs no closer either; the parser treats a `@@@` line inside an open block as an error.
- **Suggestion:** let a `@@@` line (and the end of the file) close an open `<<<<<<< end` block, or say in the header's
  `end` sentence that it still ends with `>>>>>>>`.
- **Files:** scripts/edit.ts (parseEdits and its header), tests/edit-guard.test.ts.
- **Why it helps:** the commonest batch (one append per report at the end of a round) is written in one go.

## What worked well

- tests/holdout-blindness.test.ts refusing an unclassified export of measure.ts: a new printer had to say why it
  prints no key before the suite passed (though the lead then removed that one: a split by cast kind is a mechanism
  class, which the test can't see; docs/design/tests.md now says so).
- `npm run snapshots:update`'s "keys added only … ×294" line: the describing keys' check was one line to read.
- `node scripts/team-ab.ts --base <ref>`'s identity check, `measure --several-targets` and `verify-at --snapshot`
  (this round's own) each answered in a minute or two.
- `friction.ts outcomes … --backlog` filling the "done but … (carried …)" lines from the new backlog's From lines.

## Outcome (round 21)

- 1 (`--unpark` leaves the parked paragraph's own number list stale): done (9ba1d99): friction.ts withoutNumbers drops
  the unparked numbers from the intro's "points …" list (a range split around one), or warns naming the intro.
- 2 (An `end` block in an edits file needs its `>>>>>>>` though the header suggests it is optional): done (9ba1d99):
  the next `@@@` line or the file's end closes an `end` block (its trailing blank lines dropped); the header says so.
