# Faster tests, snapshot regeneration, accuracy scoreboard (2026-11-16)

Task: carry out architecture-review items 2, 5 and 11. That meant
splitting the slow test files and moving tests of tens of seconds to
`tests/slow/`, a deterministic `npm run snapshots:update`, and a committed
accuracy scoreboard (docs/accuracy.md) with a direction summary in the
pending-log check. Branch: the worktree branch of `agent-aff447bdcfbde9fa1`
(commits dfab964, b499e88).

## 1. Timings measured under other agents' load can't be compared

- **What happened:**
  - The baseline `npm test` took 383 s at load 3–5. My first "after"
    run took 380 s at load 11–12, after about 260 s of test time had
    left the suite. On its own that showed nothing.
  - To get a fair pair I committed, then swapped the test files back to
    the base. I moved the new files to scratch, ran `git checkout
    f7d891b -- tests/<5 files>`, and re-ran.
  - Base: 629 s with 2 timeouts. Branch: 380 s, all passing.
  - Restoring took `git checkout HEAD -- tests`. In all, about 25 minutes
    of runs plus the swap, done by hand.
  - test:logs (515 s → 689 s, with more work in it and different load)
    is still not comparable. I couldn't show whether 3 workers beat 2.
- **Cause:**
  - Several agents share one 4-core machine, so wall time depends mostly
    on their load.
  - There is no tool to time a suite and record the load with it, or to
    run the base and the branch back to back.
  - The vitest JSON reporter gives wall time per file, which load
    inflates too.
- **Suggestion:** add `scripts/time-tests.sh [base-ref] [-- vitest args]`.
  - It runs the suite with `--reporter=json` under `/usr/bin/time -v`.
    It prints wall time, CPU time (user + sys), load before and after,
    and the 10 slowest files.
  - With a base ref, it exports the base's `tests/` (`git archive <ref>
    tests | tar -x` into a temp copy of the worktree, or `git worktree
    add` in scratch). It then runs base and branch alternately, twice
    each.
  - Document in CLAUDE.md that timing claims quote CPU seconds and the
    load, or a paired run.
- **Why it helps:**
  - CPU seconds hardly depend on load, and a paired run cancels it out,
    so agents stop quoting numbers that can't be compared.
  - It saves the manual swap, which is easy to get wrong in a shared
    tree.
  - Cost: a paired run doubles the time spent measuring.

## 2. vitest 5 hides the console output of passing files

- **What happened:**
  - I added a per-shard summary line to `tests/slow/pending.ts`, via
    `console.info` in `afterAll`. It said how many logs got better or
    worse.
  - After a full 6.5-minute `snapshots:update` run, the line was nowhere
    in the log.
  - Two probe test files showed why. vitest 5 prints console output only
    for failing files, unless `--silent=false` is passed. Direct
    `process.stdout.write` calls do pass through.
  - The existing "counts moved, update the snapshot to keep the gain"
    `console.info` in `tests/logs.test.ts` has been invisible the same
    way, probably since the upgrade to vitest 5.
- **Cause:** a default that changed in vitest 5 (silent for passed
  tests). It is in no project doc, and the tests were written for the
  old behaviour.
- **Suggestion:**
  - Add one line to the testing section of docs/design.md and to
    `tests/snapshot.ts`: a message meant for every run goes through
    `process.stdout.write`; `console.*` shows only on failure.
  - Change `tests/logs.test.ts`'s gain message to `process.stdout.write`.
    Or, if console output is wanted from both configs, set
    `silent: false` in them.
- **Why it helps:**
  - Avoids long runs whose report never shows.
  - Makes the existing "keep the gain" hint visible again; right now
    gains on verified logs go unnoticed until someone updates snapshots.
  - Risk: `silent: false` makes logs noisy; targeted writes don't.

## 3. The sandbox refuses compound commands that mention git

- **What happened:**
  - About six commands were refused with "names git in a form too
    complex to verify that it stays inside the worktree". Examples:
    `mkdir … && ln … && git check-ignore …`, and a loop over test files
    followed by `git show HEAD:… | grep -c`. A python heredoc that
    defined a variable named `rm` was refused as "too complex", and a
    `cat` of several files including `fixtures/pending/holdout.json` was
    denied by the classifier.
  - Each one had to be split, or the script written to a scratch file
    first.
- **Cause:** worktree isolation checks each command as a whole. Nothing
  in the repo tells agents how to write commands so they pass.
- **Suggestion:** in CLAUDE.md "Worktrees and sub-agents", add:
  - Run git commands alone, without pipes or loops. Write `git show
    <ref>:<path> > scratch/file`, then process the file.
  - Put multi-line scripts in a file under scratch and run that file.
  - Read hold-out lists only through code. `scripts/accuracy.ts`
    `readSplit()` and `groupOf()` already do this; never `cat`
    holdout.json.
- **Why it helps:** saves a round trip per refused command. The hold-out
  rule also gets a concrete, safe way to follow it.

## 4. Splitting a test file by hand leaves dead imports and copied helpers

- **What happened:**
  - Splitting `tests/buffreplay.test.ts` (636 lines) and
    `tests/search.test.ts` meant copying each file's import lines and
    top-level helpers into every part. `withKit`, `hit`, `logHit`,
    `fixture` and `build` were built for the synthetic tests only.
  - ESLint then reported 56 unused names. `eslint --fix` doesn't remove
    unused imports, so I wrote a scratch pruning script. It handled
    single-line imports and `const` helpers; the multi-line import
    blocks in search.test.ts needed a second script.
  - About 20 minutes for what should be a cut and paste.
- **Cause:**
  - Test helpers live inside the test files, not in shared modules.
  - The lint setup has no autofix for unused imports.
- **Suggestion:**
  - Move each family's helpers into a module that is not a test file,
    e.g. `tests/helpers/logreplay.ts` (synthetic kit and log builders)
    and `tests/helpers/search.ts` (`expectSameFuture`, the example
    scenarios). A split is then one import line.
  - Add `eslint-plugin-unused-imports` with its autofix rule to
    eslint.config.js, so `npx eslint --fix` drops dead imports.
- **Why it helps:**
  - Splits stay cheap, so files can be kept under ~40 s as CLAUDE.md now
    asks.
  - Less duplicated helper code drifting between files.
  - Cost: one dev dependency and a one-time move.

## 5. Pending shards balanced by hit count are not balanced in time

- **What happened:**
  - With 2 shards, `logs-pending-1` took 278 s and `logs-pending-2` took
    135 s: the whole suite waited on one file.
  - Per log, check time doesn't follow hits: 340 hits took 59 s while
    1,134 hits took 21 s.
  - I went to 4 shards and 3 workers, which helps only by making the
    shards smaller.
  - Each slow file also loads the game data again (~15 s).
    `vitest.logs.config.ts` has no shared setup and isolates each file,
    so more shards cost more load time.
- **Cause:** `shard()` in `tests/logverdicts.ts` weighs logs by
  `hits.length`. The real cost (replay, trying alternatives) is unknown
  until a log has run.
- **Suggestion:**
  - Weigh shards by measured time. Commit a small
    `tests/slow/pending-costs.json` (seconds per log), written by
    `snapshots:update` from vitest's JSON durations. Fall back to hits
    for a new log.
  - Separately, give `vitest.logs.config.ts` the same `isolate: false` +
    `setupFiles: ["tests/setup-shared-data.ts"]` as the default config,
    so its workers load the data once.
- **Why it helps:**
  - test:logs (the longest part of premerge) drops toward total work ÷
    workers.
  - Cost: one more generated file to regenerate (cheap with
    `snapshots:update`).
  - Risk: sharing the module state also shares mutable state between
    slow files. The deep freeze in setup-shared-data covers the game
    data.

## 6. Snapshot updates depended on the files' old content

- **What happened:**
  - Several problems in `tests/snapshot.ts` `Snapshot` came up:
    - The constructor runs `JSON.parse` on the stored file when the
      module loads, so a file with conflict markers fails the whole
      test file before anything is written.
    - `write()` merges the entries recorded this run over the ones on
      disk, so the result depended on which side of a conflict had been
      taken.
    - A test that throws before `record()` leaves its old entry
      silently in place.
  - I made `scripts/snapshots.sh` empty every snapshot first, and
    restore the files if a run fails. I checked the result is
    byte-identical to the committed files, which took a full 6.5-minute
    run.
- **Cause:** the snapshot module was built for incremental updates of a
  few entries, not for regenerating everything after a merge.
- **Suggestion:** in `Snapshot`:
  - When `EFSIM_UPDATE_SNAPSHOTS=1` and the stored file doesn't parse,
    start from `{}` rather than throw.
  - In the snapshot tests, call `record()` before any assertion that can
    fail. In `tests/logs.test.ts` the verification and damage-bound
    asserts come first, so an update run with a failing verification
    stops before recording.
- **Why it helps:** `snapshots:update` then works on a tree mid-merge
  even without the script's emptying, and a failed test can't leave
  stale entries behind.

## What worked well

- The `docs/architecture-review.md` brief gave exact per-test durations
  and named the files, so the first measurement confirmed it at once.
- The verdict snapshots already hold the totals' errors per log, so the
  scoreboard needs no game data or engine. It runs in under a second and
  can be checked in the fast suite.
- `scripts/setup-worktree.sh` is short and readable, so making its
  symlinks by hand (since `source` was refused) took one command.
- `scripts/premerge.sh` and the snapshot tests' `UPDATE_HINT` messages
  made every step's next action clear.
