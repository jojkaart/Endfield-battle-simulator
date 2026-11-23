# Improvement round 7 itself (2026-11-23)

Task: improvement round 7 over the five open friction reports, behaviour-preserving, while another agent worked on
kit and engine accuracy (Combustion tick snapshots, Arcane's weapon layers, castStart); the worktree branch of
`agent-a1f57a20e96c94676`, on main at 8daa9e9. Points already in docs/friction/2026-11-23-backlog-after-round-7.md
aren't repeated.

## 1. "Who else is editing this file" is guesswork

- **What happened:** the brief said another agent works on "castStart" and kit/engine code. castStart turned out to be
  a function in packages/logs/src/logcasts.ts, 80 lines below the stop builders this round meant to move into a module
  of their own; buffreplay.ts's loggedCastStart reads `timing.slowdowns` too. To keep merges clean the round dropped
  the move (and a lint rule that would have needed a disable comment in buffreplay.ts) and wrote a test that counts
  the reads from outside instead. Finding where castStart lived and judging the overlap took a few greps; a wrong
  guess would have cost a merge conflict in the other agent's lines.
- **Cause:** a brief names functions or topics, not files and line ranges, and nothing records which files a running
  agent's branch has touched so far.
- **Suggestion:** the lead's brief for parallel agents lists the files each is expected to edit ("castStart:
  packages/logs/src/logcasts.ts, castStart and placeWith"); or a one-line `node scripts/runstate.ts --touching` that
  lists, per other worktree, the files its branch changed since its base (`git diff --name-only <base>...<branch>`,
  read-only).
- **Why it helps:** a refactor can be sized to what's free instead of shrunk on a guess. Cost: a line per brief, or a
  small read-only script.

## 2. A chained `&& git commit` after a piped typecheck commits anyway

- **What happened:** `npx tsc --noEmit -p . 2>&1 | head -5; npx eslint … && git commit -F scratch/msg.txt -- …`: tsc
  failed, but the pipe's exit status is head's, eslint passed, and the commit ran with the previous commit's message
  file. Found from `git log`, fixed with `--amend` after the code fix.
- **Cause:** `| head` hides a failing exit status; the message file is reused between commits, so a stale one fits.
- **Suggestion:** in CLAUDE.md's commit recipe: "commit in a call of its own, after the checks passed (never `… | head
  && git commit`)"; optionally have the agent write a fresh scratch/msg.txt for each commit.
- **Why it helps:** saves an amend and a commit with a wrong message.

## 3. The heredoc reflex

- **What happened:** twice this round a placeholder `cat > scratch/x <<'EOF'` came out before the Write tool was used
  (both empty, neither refused this time). CLAUDE.md already says never, in its first worktree rule.
- **Cause:** habit; the rule is long and sits among many.
- **Suggestion:** nothing new in CLAUDE.md (more text won't help); the guard's refusal message is outside this repo.
  Recorded so a later round sees it recurs.
- **Why it helps:** no change proposed.

## What worked well

- The reports' suggestions were concrete enough (command names, the scratch scripts they replaced) that each tool
  could be built and checked on the report's own example: 4360's Perlica runs for `holds --why`, db87's Corrosion for
  `measure --hits` modifiers, Arcane's combo for the dilations line.
- `npm run measure` fixing its code at queue time let the round keep editing during every run; the new
  `--variant` and the corrected `--hits` reference were tested by the round's own measurements.
- `scripts/friction.ts outcomes` and `carry` made the paperwork quick (one bug found and fixed in carry).

## Outcome (round 8)

- 1 ("Who else is editing this file" is guesswork): done (19d4905): `node scripts/runstate.ts --touching [base]` lists, per other worktree with work beyond base, the files its branch changed and its uncommitted ones (read-only; hold-out fixtures only as a count); CLAUDE.md asks the lead's brief to name the files each parallel agent is expected to edit.
- 2 (A chained `&& git commit` after a piped typecheck commits anyway): done (19d4905): CLAUDE.md's commit recipe: commit in a call of its own once the checks passed, never chained after them.
- 3 (The heredoc reflex): nothing new, as the report says. It recurred in round 8: one multi-line `python3 -I -c` (a test append) slipped through and ran (the round-8 friction report).
