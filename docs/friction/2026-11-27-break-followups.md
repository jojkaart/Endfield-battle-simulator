# The Stagger-break hold's open points (2026-11-27)

Task: the hold at a Stagger break's open points (its position against the breaking hit's logged ms, breaks inside a
combo's slow-down, a `stagger-recovery` refit) and the two hold-outs it moved; branch
worktree-agent-a2188a63d84a8d377.

## 1. The fix the evidence points at lives in a file split off to another agent

- **What happened:** the decisions under `break-hold=none` showed the hold's INSIDE cases (an action held past the
  next press: 3aa6's breaker logged inside its hold, fc63's combo across a break) come from the placement's cast
  starts, which never see the break's hold (logcasts.ts newCastStart / passStops). logcasts.ts was the parallel
  agent's file, so each idea there became a patch, a revert, a `measure --patch` and a docs/tried file (two of them),
  and my own files could only move the replay's hold itself, which measured flat.
- **Cause:** the brief split the files by subsystem guess (engine timeline and holds.ts for me, the placement for the
  other), while the cause of a timing lead can sit in either; the lead could not know before the diagnosis.
- **Suggestion:** a brief that splits by files names, per agent, a "may touch with a note" file list for the shared
  hot spots (logcasts.ts, buffreplay.ts), with the rule that an edit there is one function, committed alone with the
  other agent named in its message, so the merge sees it; or split such leads by question, as CLAUDE.md allows,
  and give the placement to whichever agent's lead needs it first.
- **Files:** CLAUDE.md ("The lead" paragraph: briefs), scripts/lead-files.ts (it could flag a lead whose earlier fixes
  touched files held by two agents).
- **Why it helps:** a measured change goes in as code, not as a diff waiting for another round; risk: merge conflicts
  in a hot file, which one-function commits keep small.

## 2. The replay view's LAND times hide which landings a hold can move

- **What happened:** `zmdlogs replay --stops` showed the break's 14-frame STOP at 128.93 s in 9090 and Arcane's next
  attack 4 landing at 129.03 s on the log's time anyway; it took reading replayCast's `landings` (pinned landings)
  and the INSIDE lines to see that a hold moves only an action's end, unpinned landings and the world's timers.
- **Cause:** a LAND line doesn't say whether the landing is pinned to its logged frame or fell where the kit's frames
  and the stops put it.
- **Suggestion:** mark pinned landings in `zmdlogs replay` (e.g. `[pinned]`, or the kit-time frame beside it), and say
  in docs/design/data.md's replay paragraph what a stop can still move.
- **Files:** packages/logs/src/views.ts (the replay view), docs/design/data.md.
- **Why it helps:** a timing question ("did the hold move this?") is answered from the view, not the engine's code.

## 3. A replay-only reading doesn't reach every consumer of the rule

- **What happened:** `break-hold-place` is read in replayrun.ts, but the enemy's tick bounds (holds.ts tickBounds) are
  called from buffreplay.ts with no options, so under `--assume break-hold-place=ms` (and under `break-hold=none`
  before it) the tick bounds still take the defaults; the assumption's text has to say so.
- **Cause:** the replay's options aren't threaded to helpers that read engine assumptions; each call site decides.
- **Suggestion:** tickBounds (and similar holds.ts helpers) take the replay's `assume` as an argument, passed from
  buffreplay.ts; a test runs one log under each reading of every replay-only assumption and checks the tick bounds
  differ where the reading should move them.
- **Files:** packages/logs/src/holds.ts, packages/logs/src/buffreplay.ts, tests/holds.test.ts.
- **Why it helps:** an assumption's non-default reading means what it says, so a measure of it is a measure of the rule.

## What worked well

- `measure --patch <diff> --base HEAD` on a WIP commit gave a patch's own effect, hold-out aggregates and the moved
  hold-outs' decision counts (the INSIDE −1 under `none` was the lead to the cause).
- `zmdlogs decisions --all --assume <id>=<r>` and `scripts/cli-ab.ts HEAD -- zmdlogs decisions --all` named the
  replay's decisions a reading or a change moves, in minutes.
