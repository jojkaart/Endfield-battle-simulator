# Interrupted casts: a channel's end (2026-11-27)

Task: the placement of a cast its operator's next press interrupts (abfd 64.10 s, the tail-cut round's open part):
survey the logs for hits logged after their operator's next cast started, and implement what the data and logs decide;
worktree branch of agent-a95e7da3ed781c88d, base main at 5b08218 (round 22, beside the statuses-per-target agent).

## 1. A hunk split part that throws reads as a −100% regression, not "not measured alone"

- **What happened:** `npm run measure -- --at HEAD --base 5b08218 --split hunks` on a rule whose definition and use
  sat in different hunks. For logcasts.ts the summary said "not measured alone (… pastChannel is not defined)", but for
  drivers.ts the hunk using `turned` / `pastChannel` without the hunk defining them was measured as "Part 3": every
  moved log at plain 0, damage −100%, the hold-outs' counts included. Reading it as a real result would have sent the
  round the wrong way; the marker fix and a second 10-minute measure followed.
- **Cause:** the "not measured alone" check catches a part whose first log throws at load time; a ReferenceError inside
  the replay (caught per log, so the log reads as having no landings) passes as a measurement.
- **Suggestion:** in scripts/measure.ts's split runner, treat a part whose replay threw (or whose every moved log lost
  every landing) as "not measured alone", naming the error, as it already does for the first case; and in the queue
  check, warn when a hunk's added lines name an identifier that only another hunk of the change declares.
- **Files:** scripts/measure.ts (the split parts' runner and summary), docs/design/tests.md "Measuring a change".
- **Why it helps:** a split's parts are trusted per line ("this part alone: 3 worse"); one bogus part costs a
  measure and can mislead a lead reading only the summary.

## 2. A split measured with `--at HEAD` took hunks committed after it was queued

- **What happened:** the first measure was queued at 9b61aee (`--at HEAD`); I then committed the drivers.ts change
  (341a5d8) while it waited. The whole-change lines were 9b61aee's, but the hunk split listed a `split:channel-turn`
  part and the drivers.ts hunk, i.e. the newer commit's diff.
- **Cause:** the split's diff is computed when the split starts, from HEAD or the tree then, not from the code fixed
  at queue time.
- **Suggestion:** compute the split's diff from the queued snapshot (the same ref the whole change was measured at),
  and print that ref on the "Split by hunks against …" line.
- **Files:** scripts/measure.ts.
- **Why it helps:** CLAUDE.md tells agents to keep editing while a measure waits; the split must then measure what
  the whole change measured.

## 3. keepPrevious is computed in three places, each with its own "previous cast"

- **What happened:** fc63 94.79 s and c779 70.73 s lost a logged landing because castassembly.ts `ordered` took the
  cast just before (a hitless cast made from a log event, which the replay skips) as the previous one, while
  `castsFromBuffEnds` already says "an inferred cast the replay may skip isn't anyone's previous cast" and
  `replayedCasts` computes it a third way. Finding which of the three set the flag for a given cast took a read of all
  three and of drivers.ts / casting.ts (`keepPrevious` → "uncast" → endCurrentSkill).
- **Cause:** the rule "which cast's hits does this one keep" has no single home; each assembly step recomputes it.
- **Suggestion:** one `keepsPrevious(casts)` in castassembly.ts (the latest earlier cast of the operator with a logged
  landing, the rule `ordered` now has), called by all three, and a `keepPrevious` reason on ReplayedCast that `zmdlogs
  replay` can print on the CUTS line (which today still says "cuts" where the hits are kept: replayrun.ts castFlag).
- **Files:** packages/logs/src/castassembly.ts, packages/logs/src/replayrun.ts (castFlag).
- **Why it helps:** the next "a landing cut by the next cast" lead is one function to read and one line to print.

## 4. The kit compiler can't tell a tick's own landings from what the tick creates

- **What happened:** marking a capped channel's ticks with its end (skillCompile.ts `ticks`) by "landings added
  while the body ran" also marked Rossi's combo afterhits, a buff the tick creates whose own ticks land at frames
  33–41, with an end of 25; drivers.ts then dropped them as past their channel (9a80 280 → 206 plain, 0c14 −54).
  The 9a80 test in tests/placement-cases.test.ts caught it only in a later run.
- **Cause:** landings carry their file and branch but not the control-flow action they sit under, and ctx doesn't
  name the channel; "created during the body" is the only handle.
- **Suggestion:** a `channel?: { start, end, perTarget }` on the compiler's Ctx set by `ticks`, cleared where a
  sequence leaves the skill's own timeline (a created buff, a spawned entity, a projectile), and copied onto each
  landing at creation.
- **Files:** packages/data/src/skillCompile.ts.
- **Why it helps:** facts about where a landing sits (a channel, a loop) stay exact without a post-hoc filter
  (`!detached && frame <= end`, which only happens to hold).

## 5. The casts view's words live in another agent's file

- **What happened:** the placement's new record (LoggedCast.pastChannel) needs a line in `zmdlogs casts --choices`;
  its formatting sits in views.ts castsRecords, a file of the parallel agent, so the decision line became a held-back
  diff (docs/tried/2026-11-27-channel-decision-line.diff).
- **Cause:** views.ts holds every view's text, so any placement rule's record touches it.
- **Suggestion:** the casts view's per-record words (joinWords, choiceWords, twinWords, a future pastChannel) moved to
  a module beside logcasts.ts (`placementwords.ts`), which a placement round owns.
- **Files:** packages/logs/src/views.ts, a new packages/logs/src/placementwords.ts.
- **Why it helps:** a placement rule and its decision line land in one commit, with no held-back diff for the lead.

## What worked well

- `node scripts/cli-ab.ts 5b08218 --placement`: every log's placement against the base in a minute, the casts that
  moved and by which rule; it turned three bad iterations into three quick fixes without a measure each.
- `zmdlogs casts --choices`' `[joined: …]` lines named the faulty join (to come, 1.81 s, slot due at 0.20 s) at once.
- `efsim gamedata tree <skill>` showed the ChannelingAction (frames 5–40, maxCountPerTarget 6) that decided the case.

## Outcome (round 21)

- 1 (A hunk split part that throws reads as a −100% regression, not "not measured alone"): done (9ba1d99): the
  worker sends the replay's code errors (scripts/code-errors.ts: a ReferenceError or TypeError caught per cast;
  MeasureAnswer.threw), a split part with any is "not measured alone" naming the error, the whole measure says so
  before its numbers; at queue time `--split hunks` names a hunk using a name only another hunk declares
  (measure.ts crossHunkNames).
- 2 (A split measured with `--at HEAD` took hunks committed after it was queued): done (9ba1d99): `--at`, `--base`,
  `--against` pinned to commits at queue time (measure.ts pinRefs; a `--split` without `--base` gets HEAD's), the
  "Split by … against <base>, the code at <code>" line names both.
- 3 (keepPrevious is computed in three places, each with its own "previous cast"): done (22debb5): castassembly.ts
  keptPrevious / isPreviousCast, the one rule withKeptPrevious (was `ordered`), replayedCasts and missedCasts call,
  with ReplayedCast.keepPreviousWhy (castsFromBuffEnds says why too); the CUTS line of a cast that keeps its previous
  cast's hits says it keeps them. Every development log's flags the same (10458 casts; replayedCasts keeps the
  placement's order: five logs' casts aren't in start order there).
- 4 (The kit compiler can't tell a tick's own landings from what the tick creates): done (2fdc4e6): skillCompile.ts
  Ctx.channel, a token per channel cleared by enter(), kept per landing; the compiled data is byte for byte the same.
  Without the old `!detached` the token would also mark 9 kit hits of channels inside a detached file: on the
  backlog's accuracy list.
- 5 (The casts view's words live in another agent's file): done (7052a47): packages/logs/src/placementwords.ts
  (lateJoin, twinWords, joinWords, choiceWords, inTurnWords, pathsWords, pastChannelWords), a move.
