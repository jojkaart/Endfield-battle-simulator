# Journal entries as files, one-screen roadmap (2026-11-16)

Task: move the journal to one file per entry, with a script that builds
docs/journal.md and a check that it is up to date; archive and trim so the
session-start reading drops; cut the roadmap to one screen; update CLAUDE.md
(architecture review item 6). Branch: `worktree-agent-a218ef42be09604d5`.

## 1. premerge fails on test timeouts under load, and then skips the rest of the check

- **What happened:** `scripts/premerge.sh` failed twice on a docs-and-scripts
  change that touches no engine code. Run 1 (604 s): `tests/search-loop.test.ts`
  "efsim search --loop --sync says how rounds are cut…" hit `Error: Test timed
  out in 60000ms`. Run 2 (497 s): the same test, plus two
  `tests/buffreplay.test.ts` tests ("Hot Work's Nature DMG, made by a
  Corrosion…"). Load average was 13–15 because other agents were running suites
  at the same time. On their own, both files passed (search-loop 14/14;
  buffreplay 49/49 with `--testTimeout=300000`). `npm run check` chains its
  steps with `&&`, so after `npm test` failed, `test:logs` and `test:tools`
  never ran. I had to run them by hand (85/85, 8/8) to learn whether anything
  else was wrong. This cost about 30 minutes of wall time, and I still could
  not report "premerge passed".
- **Cause:** a fixed 60 s `testTimeout` (vitest.config.ts) on tests that take
  30–52 s on an idle machine. Several worktrees run 4-worker suites on one
  machine with no coordination. And the check is a single fail-fast chain, so
  one flaky timeout hides the result of every later step.
- **Suggestion:**
  - Move the CLI loop test and the slowest buffreplay cases to `tests/slow`
    (review item 2), or give them a per-test timeout of 180 s.
  - In premerge.sh, run the check steps one by one, finish all of them, and
    print a pass/fail table at the end. Exit non-zero if any step failed.
  - If only timeouts failed, have premerge re-run just those files once
    (`vitest run <files>`) and report "timed out under load, passed on re-run".
  - Optionally, a shared lock (e.g. `flock /tmp/efsim-test.lock`) around
    `npm test` in premerge, so parallel agents queue instead of slowing each
    other past the timeout.
- **Why it helps:** an agent gets a trustworthy verdict in one run instead of
  re-running a 10-minute suite and judging timeouts by hand. The lock trades
  some waiting for runs that finish reliably.

## 2. Worktree setup and the sandbox's command checks don't fit together

- **What happened:**
  - CLAUDE.md says to run `source scripts/setup-worktree.sh` first. The
    worktree isolation refused it ("runs a string through source, which can't
    be verified"). I copied the script by hand: `ln -sfn` the three
    `node_modules/@efsim/*` links and `EFSIM_DATA_DIR=…/data` on every test
    command.
  - The same check refused other commands:
    - a compound shell command that built a scratch file with a heredoc;
    - a `python3 - <<EOF` in-place edit of `scripts/premerge.sh` and
      `scripts/journal.ts` ("too complex to verify that it stays inside the
      worktree");
    - `git clone … sim` with a relative target.
  - Each needed a rewrite: separate commands, absolute paths, the Edit tool.
    About eight wasted attempts in all.
- **Cause:** worktree setup depends on `source` (it exports `EFSIM_DATA_DIR`
  into the caller's shell). The sandbox can't check what a sourced script does,
  or a long compound command, and no doc says which command shapes it accepts.
- **Suggestion:**
  - Review item 7: make worktrees work without `source`. The data loader
    falls back to the main checkout's `data/` when the worktree's is empty, and
    a vitest `resolve.alias` sends `@efsim/*` to the worktree's packages.
  - Until then, split the script: `scripts/setup-worktree.sh` as a plain
    executable that only makes the links, and the data dir found by the
    loader, not by an environment variable.
  - Add a line to CLAUDE.md "Worktrees and sub-agents": use absolute paths,
    one command per call, and the Edit tool for multi-line edits.
- **Why it helps:** removes a setup step that fails silently or gets refused,
  and the trial and error over command shapes. Low risk: the fallback only
  applies when the worktree has no data.

## 3. The built journal files still conflict between parallel branches

- **What happened:** to test the merge path, I made two new-style branches in a
  throwaway clone, each adding one entry. The entry files merged cleanly, but
  `docs/journal.md` and `docs/journal/README.md` conflicted: both are built and
  committed, and each branch rebuilds them. The fix is one command
  (`npm run journal && git add docs/journal.md docs/journal/README.md`), now in
  CLAUDE.md. Even so, every parallel merge still stops on a conflict.
- **Cause:** the task asks for a committed docs/journal.md plus a check that it
  is current. So every branch must rebuild it, and two rebuilds always differ
  at the top. Git has no built-in "regenerate" merge strategy, and a custom
  merge driver needs local git config, which the repository can't carry.
- **Suggestion:** pick one of these:
  - (a) Stop committing the two built files. Gitignore them, build them in the
    session-start hook (`.claude/hooks/session-start.sh`) and in
    `setup-worktree.sh`, and drop `journal:check`.
  - (b) Keep them, and add a `scripts/merge.sh <branch>` for the coordinator:
    it runs `git merge`, then `npm run journal` (or `journal:adopt -- --from
    MERGE_HEAD` if the branch still uses the old format), then
    `git add` on the two files.
- **Why it helps:** (a) removes the conflict entirely, at the cost of the
  journal not showing on GitHub until built. (b) keeps the files and makes
  resolution automatic.

## 4. Docs cite the journal by line number

- **What happened:** `docs/kit-review/chr_0020_meurs.md` cited "docs/journal.md
  (around lines 1108–1112)" and "around line 1045". Those lines had already
  drifted to other entries before my change. I had to grep the quoted phrases
  ("Catcher's P1 strike", "Pending 04d401ad257e Catcher") to find the right
  entries, then repointed the citations to the entry files.
- **Cause:** the journal used to be one file that grew at the top, so every
  line number in it went stale with the next entry.
- **Suggestion:** cite entries by file
  (`docs/journal/2026-10-22-02-food-buffs-as-a-build-option.md`) or by date and
  title, never by line. Add that as one sentence to CLAUDE.md "Journal and
  roadmap" and to the kit-review brief.
- **Why it helps:** entry files never move, so citations stay valid. No cost.

## What worked well

- **The old journal's regular headings.** Every entry started with
  `## YYYY-MM-DD…: Title`, there were no duplicate headings and no code fences,
  so splitting it was mechanical, and a script could check the conversion was
  exact.
- **The architecture review.** It measured the reading sizes and counted the
  conflicts per file, so the target and the reason were clear from the start.
- **A scratchpad clone.** A throwaway local clone made it easy to rehearse real
  merges (clean, conflicted, `--from MERGE_HEAD`, two new-style branches)
  without touching the worktree. This testing found the bug fixed in
  `7f55160`: when adopt read a conflicted journal.md, it glued one side's last
  entry to the other side's text.
- **Node runs `.ts` directly.** The script is typed, typechecked through its
  test, and needs no build step.

## Outcome (round 1)

1. Premerge timeouts and fail-fast: **done** (scripts/premerge.ts: every step, a table, timeout re-runs, a shared test lock). Moving the slowest tests: **backlog** with the measured list.
2. Worktree setup and command shapes: **done** (setup without `source` landed before this round; CLAUDE.md command shapes).
3. Built journal files conflicting: **done**, option (b): `npm run merge -- <branch>` (scripts/merge.ts) merges, adopts old-style entries from MERGE_HEAD, rebuilds docs/journal.md and its index, and commits; tested in a throwaway repository (tests/merge.test.ts).
4. Citing the journal by line: **done** (CLAUDE.md "Journal and roadmap": cite an entry by its file).
