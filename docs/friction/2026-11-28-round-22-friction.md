# Improvement round 22 itself (2026-11-28)

Task: improvement round 22 over five open friction reports and round 21's backlog, every file free; this worktree's
branch on main at c81a34f.

## 1. A code edit while snapshots:update waits kills the run

- **What happened:** I queued `npm run snapshots:update` after the last planned code commit, then found a parked
  backlog point a new report had brought back and added `zmdlogs clocks --breaks` (two source files) while it ran.
  snapshots.ts codeKey would have failed the run at its end (the code changed since queued); I stopped it at its
  first of four suites, committed, and queued it again: about 4 minutes lost, and a habit to watch for every round.
- **Cause:** measure and identity fix the code at queue time (a snapshot commit in a worktree of its own), so editing
  goes on; snapshots:update reads the working tree and can only refuse an edited one.
- **Suggestion:** snapshots:update run in a worktree of a snapshot commit as measure does (at-commit.ts
  snapshotCommit), copying the regenerated files back into the tree only for paths the tree hasn't changed since; or,
  cheaper, `--check-early`: compare codeKey after each suite and stop at the first change, not at the end.
- **Files:** scripts/snapshots.ts, scripts/at-commit.ts, docs/design/tests.md.
- **Why it helps:** the round's slowest job stops blocking edits; a failed run costs a minute, not ten.

## 2. One CLI module for thirty subcommands

- **What happened:** every view this round (worldtime --holds / --without / --series / --period / --gap, casts
  --event-lags, hits --targets, statuses --controls, replay --against-starts, screen, which, clocks --breaks) meant
  three edits in packages/cli/src/commands/zmdlogs.ts: the usage string, the shared options object (one namespace:
  a new `--holds` or `--targets` must not mean something else in another subcommand) and a branch in one `run`
  function of 800 lines; `statuses --controls` first went into the single-fixture branch and had to move.
- **Cause:** the CLI's one-module-per-command rule stops at `zmdlogs`, which holds every log view.
- **Suggestion:** packages/cli/src/commands/zmdlogs/ with one module per subcommand (usage lines, options, run), as
  src/commands/ has per command; zmdlogs.ts assembling them and the REPLAYING / NOT_REPLAYING sets from a field of
  each; `zmdlogs which` reading the per-module usage.
- **Files:** packages/cli/src/commands/zmdlogs.ts, packages/cli/src/commands/index.ts, tests/zmdlogs-cli.test.ts.
- **Why it helps:** a new view is one new file; options can't collide across subcommands silently.

## 3. A brief's theme without a source

- **What happened:** the brief listed "a test helper (fakeReplay) that only the full suite reaches" under Measuring;
  none of the five reports nor the backlog mentions it, and grep found only round 16–17's history. I took it as the
  helper's users being reached only by the typecheck and `vitest related` over most of the suite, and made
  lint:changed run them, but couldn't confirm that was the episode meant.
- **Cause:** a lead's own observation goes into a brief without its episode.
- **Suggestion:** docs/friction/README.md's process step 2: each theme a brief adds beyond the reports names its
  episode (a journal file, a commit, a command that failed) in one line, or goes in as a report of the lead's own.
- **Files:** docs/friction/README.md.
- **Why it helps:** the round builds the fix for the friction that happened, not a guess at it.

## 4. friction.ts has no --help

- **What happened:** `node scripts/friction.ts --help` fails with parseArgs' "Unknown option"; the usage is only in the
  file's header comment, which I read to find `carry … none --lists --unpark` and `outcomes … --backlog`.
- **Cause:** measure.ts and identity.ts call usage.ts printHelp; friction.ts doesn't.
- **Suggestion:** printHelp(argv, import.meta.url) at friction.ts's entry, and a test that every scripts/*.ts with a
  usage header answers `--help` (tests/usage.test.ts may hold the list).
- **Files:** scripts/friction.ts, scripts/usage.ts, a test.
- **Why it helps:** the paperwork's commands are a second away, every round.

## What worked well

- measure-worker.ts's job kinds and pool: identity.ts was a new job kind and 120 lines, the hold-outs handled by the
  same key forms (accuracy.ts isHoldoutKey) and tests/holdout-blindness.test.ts taking its printer in two lines.
- The reports' episodes as ready tests again: fc63's array, 9847's 75.90 s tail, 7b54's three replays, 6339's
  freeze, 8f32 without its rank, 8056's Frontiers firings.
- `node scripts/edit.ts` with `<<<<<<< end` blocks: six outcomes appended in one all-or-nothing call.
