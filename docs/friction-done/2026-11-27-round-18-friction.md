# Improvement round 18 itself (2026-11-27)

Task: improvement round 18 over the five open friction reports and round 17's backlog, every file free; this
worktree's branch on main at 5cf680e. Points already in docs/friction/2026-11-27-backlog-after-round-18.md aren't
repeated.

## 1. A hold-out has two key forms, and code that tests the key prefix leaks or miscounts

- **What happened:** writing measure's per-part hold-out counts I found that scripts/measure.ts splitLines names, in
  its "Moved by the whole change, by no part alone" line, any hold-out moved by the whole change and by no part, and
  that splitParts counted every hold-out as moved (so each part measured all of them). Both test `isHoldout(k)`
  (`k.startsWith("holdout/")`) on keys from scripts/accuracy.ts allLogs, which re-keys a hold-out as
  `pending/zmdlogs-<id>.json` (its key before 2026-11-16, so comparisons with old refs pair). The existing test only
  covered a hold-out a part also moved, so it never failed. Fixed in e453ff9 (the group from allLogs), but it took a
  careful read to see, and the same trap waits for every new hold-out line.
- **Cause:** one log has two keys (`holdout/…` from logKeys and the snapshot files, `pending/…` from allLogs), and
  whether a key is a hold-out is decided by its prefix in measure.ts, by its group in accuracy.ts.
- **Suggestion:** allLogs keeps the current key and adds a `pairKey` (the old form) for comparisons only, or exports
  one `isHoldoutKey(key, snapshots)` that both files use; and a test that runs splitLines, compare and
  directionSummary on snapshots whose hold-out moved alone and asserts no hold-out id appears in any line (a blind
  check over every printing function, not per function).
- **Files:** scripts/accuracy.ts (allLogs), scripts/measure.ts (splitLines, splitParts),
  tests/measure.test.ts.
- **Why it helps:** the hold-outs' blindness rests on these prefix tests; a single helper and one test over the
  printing functions make a leak fail a test instead of waiting for a reader.

## 2. friction.ts outcomes misses a carried backlog point when the label isn't the file name

- **What happened:** `node scripts/friction.ts carry … --label "backlog after round 17,"` extended the carried point's
  **From:** line with "backlog after round 17, point 1"; `friction.ts outcomes … --backlog <new>` then filled the
  carried points of the five reports but not round 17's backlog's own point 1 ("- 1 (…): " left empty), because it
  matches From entries by the report's file name. I filled it by hand.
- **Cause:** carry's `--label` (free text, the README's form) and outcomes' matching (a file name) don't agree.
- **Suggestion:** outcomes also matches a From entry by the label carry writes for the backlog given (its title
  "Backlog after improvement round N" → "backlog after round N"), or carry writes the file name when no label is
  given and the README's example drops `--label`.
- **Files:** scripts/friction.ts, tests/friction.test.ts, docs/friction/README.md (step 5).
- **Why it helps:** the paperwork's one manual step goes; a carried backlog point's outcome can't be left blank.

## 3. A script run at an older commit's code can't import a name that commit lacks

- **What happened:** scripts/placement-lines.ts (this tree's file, run in the ref's worktree by cli-ab via
  at-commit.ts outputInTree) had to print records where the code has `castsRecords` and text where it doesn't. A
  named import fails to link at the older commit, so the script reads the export through `import * as logs` and a
  cast; that took a run against 5cf680e to see, and the next script of the kind will hit the same.
- **Cause:** outputInTree runs this tree's script against another tree's packages, and nothing says that its imports
  must be the older commit's names.
- **Suggestion:** one line in scripts/at-commit.ts outputInTree's comment (and docs/design/tests.md where cli-ab is
  described): "a script run so imports by namespace (`import * as logs`) and checks for a name newer than the ref";
  or a tiny helper `optionalExport(module, name)` in scripts/ beside it.
- **Files:** scripts/at-commit.ts, docs/design/tests.md.
- **Why it helps:** the A/B scripts keep working against refs older than the view they use, without a failed run.

## What worked well

- `node scripts/edit.ts` for every multi-line change (32 batches, no miss), and the bash-guard hook refusing a sed
  with backticks before it ran.
- `node scripts/cli-ab.ts 5cf680e --placement` answered "do the new placement records move a slot" for every log in
  two minutes; `npm run measure -- --logs … --variant <file>:<CONST>=…` checked the new --set end to end on three logs.
- The reports' episodes as tests (d774, 40d9, 6339, 1d91, 5082, 107766a): each tool had its first case ready.

## Outcome (round 19)

- 1 (A hold-out has two key forms, and code that tests the key prefix leaks or miscounts): done (662d8e3):
  scripts/accuracy.ts isHoldoutKey (either form, the snapshots' split) and pairKey; tests/holdout-blindness.test.ts
  runs every printer of accuracy.ts and measure.ts on synthetic snapshots whose hold-out moves (alone, beside a
  development log, new, gone) and fails if its id appears; every exported function of the two is classified there (a
  printer it runs, or why it prints no log). It fails with splitLines' round-18 prefix test.
- 2 (friction.ts outcomes misses a carried backlog point when the label isn't the file name): done (ca62ffc):
  carriedFrom matches a backlog by the label carry writes ("backlog after round N") as well as its file name.
- 3 (A script run at an older commit's code can't import a name that commit lacks): done (ca62ffc): at-commit.ts
  outputInTree's comment and docs/design/tests.md: import by namespace and check for a newer name.
