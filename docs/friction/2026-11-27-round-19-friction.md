# Improvement round 19 itself (2026-11-27)

Task: improvement round 19 over the five open friction reports and round 18's backlog, every file free; this
worktree's branch on main at 1c5942a. Points already in docs/friction/2026-11-27-backlog-after-round-19.md aren't
repeated.

## 1. A background test run reads the tree as it goes, so editing meanwhile fails files at random

- **What happened:** I started the default suite in the background (`npx vitest run --reporter=./scripts/vitest-progress.ts`,
  about 7 min) after an engine change, as CLAUDE.md suggests, and kept editing. tests/decisions.test.ts failed: vitest
  loaded it while I was adding an import of a function I had not yet exported. I had to tell that failure from a
  real one (a second, real failure was in the same file: a message my change had altered), re-run the file, and could
  not trust the other 183 passes for the files I had touched after they ran.
- **Cause:** measure, team-ab and snapshots fix the code when queued (at-commit.ts snapshotCommit), but a plain
  background vitest run reads the working tree file by file as its workers reach them; nothing says so, and the
  "keep editing meanwhile" habit from measure carries over.
- **Suggestion:** a `node scripts/test-at.ts [-- <vitest args>]` (or a `--snapshot` flag of scripts/verify-at.ts with
  no ref) that runs the suite in a snapshotCommit worktree of the tree as it is now, with the progress reporter and an
  EFSIM-DONE line; and one clause in CLAUDE.md's background-run sentence: "a plain `npx vitest run` reads the tree as
  it goes: don't edit meanwhile, or run it at a snapshot".
- **Files:** scripts/verify-at.ts (or a new scripts/test-at.ts), scripts/at-commit.ts (snapshotCommit), CLAUDE.md (the
  lead's), docs/design/tests.md.
- **Why it helps:** a long suite and editing go on together, as with measure; a failure is the code's, not the race's.

## 2. friction.ts carry can park a point but not bring one back or close one

- **What happened:** two parked entries came back this round (round 16's recorded Stagger start, hit by the
  break-hold report; round 14's log context, hit by the break reports and closed). `carry --lists --park 1` printed
  the Parked section with both still in it; I removed them by hand with an edits file and wrote the accuracy entry
  for the first myself. The README's step 4 says a new report brings a parked point back, but no option does it.
- **Cause:** `--park` and `--drop` act on the backlog's points and its accuracy list; the Parked section's own entries
  are copied as they are.
- **Suggestion:** `--unpark <text>` (repeatable): drop the parked entry whose line matches, and print its full text
  (from the backlog file it names) on stderr for the new backlog's point or accuracy entry; the README's step 5 names
  it.
- **Files:** scripts/friction.ts (carryLists), tests/friction.test.ts, docs/friction/README.md.
- **Why it helps:** the paperwork's last hand edit goes, and a returning point keeps its original text.

## 3. "Is this a replayed fight?" has no flag of its own in the engine

- **What happened:** the follow-ups view needed each triggered landing's firing recorded, but only in the log check's
  replay (a record, so simulations and the search stay byte for byte the same). The engine has no "replay" flag: I
  read the code to find what marks a replayed fight and gated the record on `ctx.loggedCrits`, as landing.ts does for
  `facts` and `inputs`; a run that replays without logged crits would silently lose the record.
- **Cause:** record-only fields piggyback on TimelineContext.loggedCrits (or keepInputs) as the marker of a replay.
- **Suggestion:** a `TimelineContext.records: boolean` (set by createContext from TimelineScenario.loggedCrits or a new
  `record` option) that every record-only field reads (`facts`, `inputs`, `fired`), with a line in
  docs/design/timeline.md listing the record-only fields; planning/search.ts's KeyRules already makes each new field
  say it's a record.
- **Files:** packages/engine/src/timeline/state.ts, context.ts, landing.ts, actions.ts, docs/design/timeline.md.
- **Why it helps:** the next replay-only record is one condition everyone knows, not a proxy found by reading.

## What worked well

- planning/search.ts's KeyRules refusing a PendingHit field nobody classified (it named `fired` at compile time).
- `node scripts/team-ab.ts --base <ref>`: an identity answer for an engine change in about 3 minutes, twice.
- The reports' own episodes as tests: each new tool had its case (tickBounds, splitLines, e989, d4fb, 6339, 5082).
- `node scripts/edit.ts` for every multi-line change, and the bash-guard hook catching a sed with backticks.
