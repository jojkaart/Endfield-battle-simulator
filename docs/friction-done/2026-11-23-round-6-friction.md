# Improvement round 6 itself (2026-11-23)

Task: improvement round 6 over the six open friction reports and the lead's list, behaviour-preserving, while another
agent worked in the replay's run() and holds.ts; the worktree branch of `agent-acb88299874495895`, on main at 235d717.
Points already in docs/friction/2026-11-23-backlog-after-round-6.md aren't repeated.

## 1. A 2,500-line buffreplay.ts with an agent inside it blocks small edits

- **What happened:** three of this round's points needed a few lines in the replay (KitWindow's `appliedAt` and
  `replaces`, a both-variants flag, pinned expiries). With the hidden-holds clocks agent refactoring logBuffReplay's
  run() at the same time, any edit there would conflict, so all three went to the backlog, and `zmdlogs clock` was
  built as a consumer that replays each log twice (under `hidden-holds=none` and the default) to get the own clock
  without touching the replay: about 24 s for one kit buff over every development log with Si, two replays per log instead of one.
- **Cause:** the replay's state, its step list, its readings and its outputs (traces, kit windows, flags) are one
  module and one closure; a parallel task in any part of it locks out the rest.
- **Suggestion:** when the hidden-holds clocks agent's replayOnce refactor lands (the backlog's "Taken" section), put
  the replay's outputs (traces, kitWindows, castFlags) in a module of their own (packages/logs/src/replayrecord.ts)
  that run() fills, so a view's new field is an edit there; the lead's briefs then name the module, not the file.
- **Why it helps:** view work and replay-rule work stop excluding each other. Cost: part of a refactor that's
  happening anyway.

## 2. A trace's removal is seen at the next step, and nothing says so

- **What happened:** `zmdlogs clock`'s first output said Si's Amp in e989 was "cut at cast normal_skill" at 42.63 s
  with "its expiry 22.37 s": the trace records a buff's removal at the first step after it ran out (the state is
  sampled after each step), so a buff that expired between two far-apart steps looked cut. One rerun and a fix
  (ran out when `from <= frame`, ended at the expiry).
- **Cause:** `BuffTrace` (buffreplay.ts) documents `frame` as "the step's frame" but not that an expiry between steps
  is reported at the later step's frame.
- **Suggestion:** one doc-comment line on `BuffTrace.to`: "null: gone; a buff that ran out between steps shows gone at
  the next step's frame, with `from` its expiry"; and use `instancesOf` from clockview.ts (exported if needed) in
  `replay --trace-buff`'s TRACE lines so they say "ran out at" too.
- **Why it helps:** the next trace reader doesn't take an expiry for a cut. Cost: a comment and a word in a view.

## 3. `git mv` then a pathspec-less commit dropped the edits

- **What happened:** the outcome sections were appended to the six reports, then `git mv` moved them; a
  `git commit -F scratch/msg.txt` without paths (to take the staged renames and three `git add`ed files) committed the
  renames with the reports' old text. Found from `git status`, fixed with `--amend` and paths.
- **Cause:** `git mv` stages the index's version, not the working tree's edits; CLAUDE.md says to commit by pathspec
  but the exception for staged renames reads as "they need no path".
- **Suggestion:** CLAUDE.md's commit recipe: "a moved file: `git mv` first, edit after, and commit by pathspec of both
  folders (`-- docs/friction docs/friction-done`)".
- **Why it helps:** saves an amend; a reviewer never sees a commit whose message describes text it lacks.

## 4. Promoting another agent's scratch means reading all of it first

- **What happened:** the eleven probes (about 45 KB from four worktrees) had to be read in full before committing
  (the rule for files Claude didn't write, and the check for player names or hold-out numbers), and each run once to
  write the README's "last run": about a fifth of the round.
- **Cause:** the scripts were written for one session, with no header and inputs at fixed scratch paths, and the rule
  to promote them didn't exist yet.
- **Suggestion:** nothing beyond the new rule (scripts/probes/README.md): a probe promoted by its own author in the
  commit that cites it costs its author a header line and nobody else anything.
- **Why it helps:** the next round doesn't do this again.

## What worked well

- `npm run measure -- --logs <id> --hits --against <old ref>` reproduced the new-fixture crash in a minute and checked
  the fix the same way.
- The hold-out split's development list could be edited blind safely: parse checks before and after, and
  tests/accuracy.test.ts's development ∩ hold-out check behind it.
- The reports named their scratch scripts by path, and the worktrees were still on disk.
- `npm run snapshots:update`'s closing lines ("No log's verdicts moved") made the behaviour check one read.

## Outcome (round 7)

- 1 (A 2,500-line buffreplay.ts with an agent inside it blocks small edits): carried (docs/friction/2026-11-23-backlog-after-round-7.md point 6, with the "Taken" replayOnce refactor it waits on: the hidden-holds clocks agent did accuracy work instead and never split run()). Round 7 hit it again: it kept its own buffreplay.ts edits to runBounds and two fields and left KitWindow's chain (point 16) and pinned expiries (17) for that refactor.
- 2 (A trace's removal is seen at the next step, and nothing says so): done (c205e2d): BuffTrace.to's comment says a buff that ran out between steps shows gone at the later step with `from` its expiry; `zmdlogs replay --trace-buff`'s TRACE line then reads "ran out at its expiry … (seen gone at <step>)" at the expiry's time.
- 3 (`git mv` then a pathspec-less commit dropped the edits): done (3c919d3): CLAUDE.md's commit recipe: `git mv` stages the index's text only; move first, edit after, commit by the pathspecs of both folders. This round moved its reports that way.
- 4 (Promoting another agent's scratch means reading all of it first): nothing to do, as the report says (the probes rule in scripts/probes/README.md puts the header on the author).
