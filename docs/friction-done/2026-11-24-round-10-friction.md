# Improvement round 10 itself (2026-11-24)

Task: improvement round 10 over the five open friction reports plus the lead's item (no shell programming left),
tools only, beside an accuracy agent in the kits, fixtures, snapshots and engine kit code; the worktree branch of
`agent-a9c0fc45be23403f8`, on main at a4f6ddb. Points already in docs/friction/2026-11-24-backlog-after-round-10.md
aren't repeated.

## 1. A killed child reads as alive: zombies under the container's init

- **What happened:** the ported done-line test ("a signal stops the running step") failed: `process.kill(pid, 0)` on
  the step's pid still succeeded 200 ms after the job exited. A scratch script reading /proc/<pid>/status showed
  `State: Z (zombie)`, `PPid: 1`, gone only after about a second: the job had sent TERM and exited at once, and the
  container's PID 1 reaps orphans slowly. One debug script and a re-design (about 15 minutes); the shell version had
  passed the same test by luck of timing.
- **Cause:** a job that exits right after signalling its children leaves them to init; nothing in the repository says
  that this container's init is slow to reap, and `kill(pid, 0)` can't tell a zombie from a running process.
- **Suggestion:** done here (scripts/done-line.ts waits up to 5 s for its children before its cleanups and line, so it
  reaps them itself); for any future test of "the child is gone", read /proc/<pid>/status's State (Z counts as gone)
  rather than `kill(pid, 0)`, a line in docs/design/tests.md's test notes.
- **Why it helps:** the next signal-handling test doesn't fail on a timing it doesn't control.

## 2. Outcome lines name backlog numbers before the backlog exists

- **What happened:** I wrote the five "Outcome (round 10)" sections with "carried (backlog point n)" first, then
  decided which old points park (two after their second carry) and assembled the backlog; every number after the
  first shifted, and eight references needed a second edits file.
- **Cause:** `node scripts/friction.ts outcomes` prints skeletons that know nothing of the next backlog, and
  docs/friction/README.md's process lists the outcomes before the backlog.
- **Suggestion:** say in the README's step 2 "write the new backlog first (friction.ts carry, then the new points), then
  the outcomes"; or give `friction.ts outcomes` a `--backlog <new file>` that fills "carried (<file> point n)" for each
  point whose number appears in a **From:** line of that file.
- **Why it helps:** one pass over the outcomes instead of two, and no wrong cross-reference left behind.

## 3. A change to packages/logs re-runs most of the suite in `vitest related`

- **What happened:** `npx vitest related --run` on cli.ts, command.ts, reports.ts and hitexport.ts took 270 s (88 of
  145 files): every log test imports reports.ts or hitexport.ts through @efsim/logs' index, so a views-only change
  "touches" all of them.
- **Cause:** `related` follows imports, and the logs package's index re-exports the views beside the check's core.
- **Suggestion:** for a views-only change, the cheaper list is the test files naming the changed function (`rg -l
  '<name>' tests packages/*/test`); a line in CLAUDE.md's "While working" sentence ("a change to a view or report:
  the tests naming it, then related once before premerge").
- **Why it helps:** minutes per iteration on the logs package's views.

## 4. edit.ts's append marker mistyped, found only by the edit's absence

- **What happened:** I wrote `<<<<<<<` and `end` on two lines instead of `<<<<<<< end`; edit.ts would have taken
  "end" as an old text and refused (not found), but I caught it reading the file and patched the edits file with a
  one-line `node -e`.
- **Suggestion:** edit.ts: a block whose old text is exactly `end` (or `all`) is refused with "did you mean `<<<<<<<
  end`?".
- **Why it helps:** the marker's one easy typo gets its fix in the message.

## What worked well

- scripts/edit.ts for every edit with backticks (docs, usage text, tests): about forty edits files, no shell text
  damage; the bash guard as a hook let the one-line forms through and nothing else was needed.
- The reports named the episode each fix would have shortened (Snowshine's paths, Empyrean's block [14], 0c14 at
  30 s, d774's pinned total), so each change was tried on its episode at once.
- The round's own `npm run snapshots:update` doubled as the ported script's real-world test.

## Outcome (round 11)

- 1 (A killed child reads as alive: zombies under the container's init): done (016d623): docs/design/tests.md, "A
  test that a child is gone" reads /proc/<pid>/status's State (Z counts as gone).
- 2 (Outcome lines name backlog numbers before the backlog exists): done (016d623): `node scripts/friction.ts
  outcomes <reports…> --round <n> --backlog <new backlog>` fills in "carried (<backlog> point k)" from the new
  backlog's From lines (this round's outcomes came from it), and docs/friction/README.md's step 5 orders the
  paperwork: the backlog first.
- 3 (A change to packages/logs re-runs most of the suite in `vitest related`): done (016d623): CLAUDE.md's "While
  working" sentence: for a view or report, the test files naming the changed function first (`rg -l '<name>'
  tests`), `related` once before premerge.
- 4 (edit.ts's append marker mistyped, found only by the edit's absence): done (48f6676): a block whose old text is
  `end` or `all` is refused with "did you mean `<<<<<<< end`"; an end block without `=======` says the form (this
  round's first edits file hit exactly that).
