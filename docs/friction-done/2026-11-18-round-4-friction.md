# Improvement round 4 itself (2026-11-18)

Task: improvement round 4 from the twelve open friction reports and round 3's backlog (a query layer over the logs,
names and mappings, replay flags, repair / smoke / team-ab, the lock's short lane, the hold-out snapshot split, docs),
behaviour-preserving. The worktree branch of `agent-af618e5e31a250d49`, on `claude/beautiful-rubin-rpg8vp` at c83c9e5.
Points already in docs/friction/2026-11-18-backlog-after-round-4.md aren't repeated.

## 1. A measure reads the working tree while it runs, so editing during one is a gamble

- **What happened:** `npm run measure` takes a minute or two, and its worker threads import the working tree's
  packages when they start. Twice I applied a patch to packages/logs/src/buffreplay.ts while a measure of the previous
  commit was running; the result ("byte for byte") was probably of the old code, but nothing says which code the
  workers loaded, so I re-ran it after each such overlap (three extra minutes each), and had to plan edits around runs.
- **Cause:** measure (and the hits cache, test runs) read the live tree; the run records no code identity. `--at HEAD`
  avoids it but needs a commit and an at-commit tree each time.
- **Suggestion:** measure computes `hitsCodeKey()` (packages/logs/src/reports.ts: the game-data key and every engine
  and log source) at the start and again at the end, prints it in summary.txt, and warns "the code changed during the
  run: re-run" when they differ. Optionally `--snapshot`: copy packages/ to scratch/measure/<time>/tree first and
  measure that.
- **Why it helps:** a result is tied to a code version; editing while measuring becomes safe. Cost: a hash of ~200
  files, milliseconds.

## 2. No command lists the open assumptions and their readings

- **What happened:** to exercise measure's new "mixed logs" lines I needed a reading that moves verdicts; the ids
  and readings are in the kits and packages/engine/src/timeline/assumptions.ts, and `efsim rules --help` names only an
  example. I wrote scratch/assume.ts around `allAssumptions(data)` to list them (si-haste-every-end, control-immunity,
  buff-in-stop, battle-sub-skills, teammate-pause, stagger-recovery, combo-window-count, stagger-freeze).
- **Cause:** `--assume` is taken by five commands but nothing prints what it accepts.
- **Suggestion:** `efsim assumptions` (or `efsim kit --assumptions`): every kit and engine assumption with its readings,
  the default, the in-game test it waits on and the kit or module that registers it; `--assume` errors already list
  the ids, so they could print the readings too.
- **Why it helps:** "measure under the other reading" is the routine check for an open question; one lookup.

## 3. `grep -r` over tests/ names the hold-out snapshot file

- **What happened:** a `grep -rln … tests/` to find the callers of a function listed
  tests/snapshots/log-verdicts-holdout.json among the matches (its name only, no content). `.ignore` keeps ripgrep
  (the Grep tool) out of it, but plain `grep -r` doesn't read `.ignore`.
- **Cause:** CLAUDE.md says `grep -r` needs `--exclude-dir=holdout` for fixtures/, but the snapshot file isn't under
  such a directory.
- **Suggestion:** move the file into a directory of its own (tests/snapshots/holdout/log-verdicts.json, `.ignore`
  that directory) so the existing `--exclude-dir=holdout` rule covers it, and say in CLAUDE.md "searches: the Grep
  tool (ripgrep honours .ignore); plain grep -r always with --exclude-dir=holdout".
- **Why it helps:** one exclusion rule for everything hold-out. Cost: three paths in accuracy.ts, measure.ts and
  tests/slow/pending.ts.

## 4. The worktree guard switched from accepting heredocs to refusing them mid-session

- **What happened:** for the first third of the session, heredoc commit messages and `python3 - <<EOF` patches ran;
  then the same shapes (and a `sed … && npx vitest … && git commit` chain) were refused as "too complex to verify".
  Each refusal cost a retry through the Write tool. CLAUDE.md already warns about this; I followed it from then on.
- **Cause:** the guard judges the whole command text, unpredictably.
- **Suggestion:** nothing new beyond CLAUDE.md's rule, but the rule could lead with the commit recipe that always
  works: "commit messages: write scratch/msg.txt with the Write tool, `git commit -F scratch/msg.txt -- <paths>`".
- **Why it helps:** the most frequent multi-line need (a commit message) has a fixed form from the first commit.

## What worked well

- The reports named functions, files and episodes precisely: most fixes started from a known function
  (`controlledFromLog`, `replayedSkill`, gear.ts' private repair) and the agent's own scratch prototype described in
  the report.
- `npm run measure` (byte for byte in a minute) and `scripts/at-commit.ts` made each refactor of the replay and the
  check safe to land on its own; team-ab reused at-commit in an hour.
- `tests/views.test.ts` and `tests/hitexport.test.ts` gave a ready pattern for testing views on a real development
  log without naming a hold-out.

## Outcome (round 5)

2026-11-22, improvement round 5 (docs/friction-done/2026-11-22-round-5.md); what's left is in docs/friction/2026-11-22-backlog-after-round-5.md.

- 1 (a measure reads the working tree while it runs): done (d98b497), more than suggested: measure fixes the code when it is queued (scripts/at-commit.ts `snapshotCommit`: a commit of the working tree made with a temporary index, measured in its own worktree, removed after) and says which code it measured; `--live` keeps the old behaviour.
- 2 (no command lists the open assumptions): done (c9247da): `efsim assumptions [<re>]`, every kit and engine assumption with its question, readings, default and in-game test.
- 3 (`grep -r` names the hold-out snapshot file): done the cheap way (c9247da): CLAUDE.md's rule is now `grep -r --exclude-dir=holdout --exclude='*holdout*'`; moving the file into a directory of its own (three paths in accuracy.ts, measure.ts and tests/slow/pending.ts, and snapshots.sh's glob) was judged not worth the risk to the hold-out handling.
- 4 (the worktree guard and heredocs): done (c9247da): CLAUDE.md's first worktree rule now gives the commit recipe that always works (write scratch/msg.txt with the Write tool, `git commit -F scratch/msg.txt -- <paths>`).
