# The check's targets on 7b54 and a freeze per target (2026-11-28)

Task: the backlog after round 21's accuracy list, first and last items: map the second assignment's target ids onto
the replay's (enginecheck.ts fightTargets, atItsTarget) and make a freeze's run-on (clock.ts rampRunsOn,
statusesRunOn) every target's. Branch worktree-agent-a289fe4aa2df9082f.

## 1. No view compares the assignments of the replay passes

- **What happened:** to see why 7b54's check targets weren't its landings', I wrote scratch/tg.ts: per hit the
  first assignment (BuffReplay.targets.assignment), the second (fightTargets), the landing's targets
  (LandedHit.target, otherTargets) and the verdict. `zmdlogs hits --json` gives only the second assignment and the
  landing, so the cause (the 16.36 s Laevatain attack 2 hit the second pass put on a new slug, every later id
  shifted) wasn't visible from it; `--assume target-statuses=one` gives the first pass but as a separate run whose
  verdicts and drops differ. The script was what showed that a third replay converges (0 of 210 off).
- **Cause:** HitRecord.target carries the check's assignment and the landing's ids, not the assignment the replay was
  made on, and nothing says how many replays a fight took.
- **Suggestion:** HitRecord.target.replay (the target the replay's own assignment put the hit on,
  BuffReplay.targets.assignment) and a `zmdlogs hits --targets` filter printing hits whose check target, replay
  target and landing disagree, with the pass count (TARGET_REPLAYS used) in its header.
- **Files:** packages/logs/src/hitexport.ts, packages/logs/src/views.ts (the hits view), packages/logs/src/logcheck.ts
  (expose the pass count on LogBuffReplay).
- **Why it helps:** a target question is then one command, not a script; a regression of the convergence shows up as
  lines.

## 2. A backlog claim checked only by reading turned out wrong

- **What happened:** the backlog said "no fight read per target has a freeze yet"; a scratch script over the
  replays' reactions (control kind) found three: Si's Immobilization at 6339 4.53 s and 7b54 3.40 and 29.50 s (the
  slug enemy isn't control-immune). Harmless here (no status on any target at them), but the item's plan ("moves
  verdicts there only") rested on it.
- **Cause:** nothing lists a fight's freezes; the claim came from the absence of a known case.
- **Suggestion:** `zmdlogs statuses <fixture> --controls` (or a FREEZE line in `zmdlogs replay`): each control
  reaction with its target, its frozen span and every target's statuses at it.
- **Files:** packages/logs/src/views.ts (statusesView), packages/logs/src/buffreplay.ts (reactions already carry
  target).
- **Why it helps:** "is there a case in the logs" becomes a command, as CLAUDE.md's logs-first rule asks.

## What worked well

`measure --variant <file>:<CONST>=<value>` measured the old numbering and the third replay beside the change in one
run each, with the verdict-neutral result stated plainly ("No log's verdicts moved"); `verify-at --test` confirmed
the new 7b54 test fails at the base; team-ab's identity check settled the engine change in a minute.
