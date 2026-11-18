# Improvement round 2 itself (2026-11-16)

Task: improvement round 2: the larger restructures of the architecture review (CLI one module per command, engine
core vs planning, the log tooling as a package, design.md split by subsystem) and the open friction points, all
behaviour-preserving. The worktree branch of `agent-a289a68940cb0cd80`, on `claude/beautiful-rubin-rpg8vp` at 1de265e.
Points already in docs/friction/2026-11-16-backlog-after-round-2.md aren't repeated.

## 1. A verification run blocks all editing, because tests run on the working tree

- **What happened:**
  - After each restructure I ran `npm test` (3 min) and a CLI comparison against 1de265e (4–6 min) in the
    background. Both read the working tree, so I couldn't start the next item's edits until they finished: moving
    files or rewriting imports mid-run would have broken or changed the run.
  - Five items × about 8 minutes of waiting, plus the snapshot regeneration (7 min) and premerge: well over half an
    hour spent waiting with only scratch-file drafting to do.
- **Cause:** the only checkout of the branch is the one being edited. `scripts/at-commit.ts` (round 2) makes a
  worktree of any commit, but nothing runs the verification there.
- **Suggestion:** `node scripts/verify-at.ts [<ref>] [-- <steps>]`: commits are cheap, so verify a commit, not the
  tree. It makes (or reuses) the at-commit worktree of `<ref>` (default HEAD), runs the chosen steps there (typecheck,
  lint, npm test, a CLI comparison, snapshots:update in check mode) under the shared lock, writes progress to a file,
  and prints a pass/fail table like premerge's. CLAUDE.md: "commit, then verify the commit in the background while
  you go on editing".
- **Why it helps:** verification overlaps the next piece of work instead of serialising with it. Cost: a short
  script on top of at-commit.ts and premerge.ts; one more worktree's disk.

## 2. Prose citations of doc sections can't be checked or moved mechanically

- **What happened:**
  - Code comments, schemas and docs cite design sections as `docs/design.md "Payoffs and chains"`: 131 files. To
    split design.md I wrote a rewrite script with three passes: the quote on the same line, after a comma or
    parenthesis, and after a comment line break (`docs/design.md\n * "Skill timing"`). JSON schemas escape the quotes
    (`\"`), which needed a fourth, hand-made pass. About 25 minutes.
  - Some citations name bold paragraph labels, not headings ("Kits and the game data", "What a log check verifies"),
    so the script had to search labels too. One citation in a kit note names nothing that exists.
  - Moving the log tooling meant the same for paths: `packages/cli/src/logcheck.ts` appears in kit notes, schemas,
    batch docs and tests' dynamic imports; tsc only caught the imports.
- **Cause:** citations are free text. The new link check (scripts/check-links.ts) only sees Markdown links.
- **Suggestion:**
  - Extend scripts/check-links.ts to code comments and JSON strings: every `docs/….md` mention must name an existing
    file, every `docs/….md "Quoted"` a heading or bold label in it, and every `packages/…/*.ts` mention an existing
    file. Run it in the existing test.
  - Prefer anchors in new citations (`docs/design/search.md#payoffs-and-chains`), which the check resolves exactly.
- **Why it helps:** the next move (a file renamed, a doc split) is a red test listing what to fix, not a hand-written
  migration script. Cost: the check gets a bit slower (all tracked text files).

## 3. A before/after CLI comparison had to be written from scratch

- **What happened:** to show each restructure kept the CLI's output, I wrote scratch/cli-compare.ts: 48 invocations
  (every command, usage errors, bad options) run by the old checkout and the new, comparing stdout, stderr and the exit
  code. The first version reported ten false differences (timings in "Payoff table: 2.5 s", the "code at <hash>"
  provenance line, and my own path normalisation replacing every "." in the usage text). About 20 minutes.
- **Cause:** no committed harness for "same CLI behaviour"; the snapshot tests pin results, not the CLI's text, its
  errors or its exit codes.
- **Suggestion:** commit it as `scripts/cli-compare.ts <ref>` on top of at-commit.ts, with the invocation list in a
  JSON file next to it and the normalisations built in (timings `\d+(\.\d+)? s`, the provenance line, absolute paths).
  Mention it in CLAUDE.md for CLI refactors.
- **Why it helps:** the next CLI or package refactor proves "same behaviour" with one command. Cost: small.

## 4. A plain `git commit` after `git mv` took the staged renames into an unrelated commit

- **What happened:** I moved the three friction reports with `git mv` (which stages), then committed
  tests/slow/pending-costs.json with `git add <file>` and `git commit -F msg`. The commit also carried the three
  renames. I had to `git reset --soft HEAD~1`, unstage, and commit again.
- **Cause:** CLAUDE.md and the brief say "explicit paths", which agents read as `git add <paths>`; `git mv`,
  `git rm` and `git add -u` stage on their own.
- **Suggestion:** one line in CLAUDE.md "Worktrees and sub-agents": commit with a pathspec (`git commit -F msg --
  <paths>`), or check `git diff --cached --stat` first, when anything was staged by `git mv` / `git rm`.
- **Why it helps:** no mixed commits, which matter when a lead merges or reverts by item. No cost.

## 5. Hold-out names reach the screen through ordinary searches and test output

- **What happened:**
  - A repository-wide `grep -rl` for an old module path listed fixtures/holdout/README.md among the hits (I didn't
    open or edit it).
  - `npm run snapshots:update`'s output lists every pending test by name, the hold-out logs' included
    (`✓ holdout/zmdlogs-….json`); a plain `tail` of the log shows them. I switched to grepping the summary lines only.
- **Cause:** the hold-out rule ("never open, list or grep fixtures/holdout/") depends on every agent remembering to
  exclude it from every command; nothing excludes it by default.
- **Suggestion:**
  - A `.ignore` file at the root with `fixtures/holdout/` (ripgrep and the Grep tool honour it), and a note in
    CLAUDE.md that `grep -r` needs `--exclude-dir=holdout`.
  - The pending suite names hold-out tests by a counter (`hold-out log 7`) instead of the file, as its summary already
    counts them only.
- **Why it helps:** the rule holds without vigilance. Cost: small; check that tests/slow/pending.ts's snapshot keys
  stay as they are (only the test titles change).

## What worked well

- `npm run snapshots:update` and `node scripts/accuracy.ts --compare`: "nothing moved" was one command and one line
  per group.
- `scripts/at-commit.ts` (written in this round): the old CLI beside the new for every comparison, no setup.
- ESLint `no-restricted-imports` made each boundary (core ⇄ planning, data → core) a rule that fails at once; a
  temporary file importing across a boundary confirmed it in seconds.
- The vitest alias and setup-worktree made a new workspace package work in tests and the CLI with two small edits.
- tsc caught every import the moves broke, including dynamic `await import(…)` paths in tests.

## Outcome (round 3)

1. **Verification blocks editing:** done. `node scripts/verify-at.ts [<ref>] [--steps …]` runs premerge's steps in the
   commit's worktree under scratch/at/ (0f93b4a); `scripts/measure.ts --at <ref>` does the same for the log checks'
   accuracy (2743847). CLAUDE.md names both.
2. **Prose citations unchecked:** not done; carried over (backlog after round 3, point 7).
3. **No CLI before/after harness:** not done; carried over (point 8). The log-check side of "same behaviour" is now
   `npm run measure` ("would stay as they are, byte for byte").
4. **`git mv` staged into another commit:** done. CLAUDE.md "Worktrees and sub-agents": commit by pathspec
   (`git commit -F msg -- <paths>`) because `git mv` / `git rm` stage on their own (0bb1a1a).
5. **Hold-out names on screen:** done. `.ignore` lists fixtures/holdout/ (ripgrep and tools on it skip it; CLAUDE.md
   says `grep -r` needs `--exclude-dir=holdout`), and the pending suite titles hold-out tests "hold-out log N"
   (snapshot keys unchanged; pending-costs.ts maps the counter back) (3696e4e).
