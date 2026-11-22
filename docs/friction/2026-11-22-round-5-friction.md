# Improvement round 5 itself (2026-11-22)

Task: improvement round 5 over the eleven open friction reports and the lead's own merge friction (the lock's queue,
premerge's done line, diagnosis views, merge's related tests and batch mode, docs), behaviour-preserving; the worktree
branch of `agent-a5de9b4043c6bc1e5`, on main at 44ccd34. Points already in
docs/friction/2026-11-22-backlog-after-round-5.md aren't repeated.

## 1. The backlog only grows, and every round re-reads all of it

- **What happened:** round 4's backlog had 25 points; this round did a few and carried 20 unchanged, so round 5's has
  37. Each needed reading, a decision and an outcome line, and two of them (15, 18) had already been done by the
  accuracy branches merged just before the round, which I found only through `git log` and the kit files.
- **Cause:** points enter the backlog from every report, but nothing removes one except an improvement round, and
  an accuracy agent that closes a point has no place to say so.
- **Suggestion:** (a) in docs/friction/README.md: an agent whose branch closes a backlog point adds one line under
  it ("Closed by <branch>, <commit>") in the same branch; (b) a point carried twice without anyone asking for it again
  moves to a "parked" list at the backlog's end (one line each, no full text), revived only when a new report hits it.
- **Why it helps:** the next round reads what is live; parked points stay findable. Cost: one line per closed point.

## 2. Outcome lines are bookkeeping by hand

- **What happened:** 12 reports × 2–6 points needed an "Outcome (round 5)" line each with commits; I wrote them in a
  scratch Python dict and appended them, then a backlog by re-cutting round 4's file with a regex script.
- **Cause:** the format is fixed but no tool knows it.
- **Suggestion:** `node scripts/friction.ts outcomes <report…>` printing an outcome skeleton per `## N.` heading
  ("- N (title): "), and `node scripts/friction.ts carry <backlog> <n,…>` re-numbering the carried points into a new
  backlog with their "From" lines extended.
- **Why it helps:** the round's time goes to the fixes, not the paperwork. Cost: a small script and a test.

## 3. Edits by script make the editor tools refuse the next edit

- **What happened:** after a `python3 -I scratch/patch.py` or a `sed -i` changed a file, the next Write of
  scratch/patch.py itself was refused ("modified since read") and Edit warned on source files; I worked around it
  with a second patch file. Once an inline `python3 -c` with a patch body was refused by the guard, as CLAUDE.md says.
- **Cause:** the tools track reads per file; a shell edit invalidates them.
- **Suggestion:** a line in CLAUDE.md's worktree rules: "a new scratch/patch-<n>.py per batch of replacements (never
  rewrite one a shell command touched)".
- **Why it helps:** saves a retry per batch. No risk.

## What worked well

The reports' episodes were exact enough to implement from (Perlica's premerge guess was right to the line);
`npm run measure` with the new queue-time snapshot let me keep editing while it ran; the free lock this time made
every check fast.
