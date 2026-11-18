# The Finisher gated on every enhanced basic attack (2026-11-18)

Task: generalise in-game test 108's Laevatain-only "no Finisher in Twilight" to every state that enhances or replaces
the controlled operator's basic attack, from the game data (the mechanism, not a list) and the logs, after the owner's
pointer to the Talos Wiki's Stagger article. Branch: the worktree of agent a4a6418613e5cd73c, base 470dbf0.

## 1. No query answers "what happened in each Stagger"

- **What happened:** the question was per Stagger: who is controlled, did they land enhanced attacks in it, did a
  Finisher come, before or after them, was the state running at the Finisher. `zmdlogs census` counts items near a
  point (`--window` around an item's start), and `buff:` items are a lane's start, so neither a Stagger run nor a state
  window can be an interval to look inside. I wrote a scratch script (`staggerRuns`-like run detection, `controlSpans`,
  a kit-key classification, `replay.kitWindows`) and went through three versions: the first missed log keys no kit hit
  names (`attack1_ult_2_abilityrange`), the second counted abfd as "Yvonne in her ultimate, no Finisher" when Si had
  used the Stagger's Finisher before the swap (the script looked only at the state operator's Finisher). About an hour.
  I then added each run's Finisher and enhanced hits to `zmdlogs stagger` (views.ts `staggerView`) so the claim in
  test 108 cites a command anyone can rerun.
- **Cause:** census selections are points; Stagger runs, control spans and buff lanes are intervals, and there is no
  selector for them or an "inside" relation.
- **Suggestion:** in packages/logs/src/query.ts give `Item` an optional end and add selectors `stagger:` (the log's
  Stagger runs, `staggerRuns` start/last) and `control:<op>` (control spans), with `--inside <sel>` (items whose time
  falls inside an interval item of the other selection) next to `--near`; `buff:` items get their lane's end
  (`nextUnlisted`). Then "Finishers inside Staggers inside Laevatain's control" is one census with a rerun line.
- **Why it helps:** most in-game-test questions from the logs are "X during Y" (Stagger, a stance, an ultimate); a
  rerunnable census line is what data.md's "A claim from the logs cites its selection" asks for, and it removes the
  scratch-script errors above. Cost: moderate (selector parsing, interval items in census).

## 2. A skill's group and the game's "mode" aren't visible from the CLI

- **What happened:** the brief guessed at states (Chen, Liino's stance, Arcane's array); the coordinator then said
  the examples were guesses. I found the real ones with raw-JSON surveys of every SkillData/BuffData file for
  `ComboCacheAction`, `ChangeSkillAction`, `SwitchModeAction` (scratch Python, since the worktree guard refuses
  heredocs and inline scripts), then CharGrowthTable's groups. Only afterwards did I see that `efsim gamedata find
  SwitchModeAction` lists exactly those actions with their modeIds: CLAUDE.md names it in one clause, and data.md's
  "Questions and the command that answers them" table has no row for it. The decisive fact (the enhanced chains are
  basic attacks CharGrowthTable puts in the battle skill's or ultimate's group, the Finisher in NormalAttack) is in
  `OperatorData.skillGroups`, but neither `efsim kit` nor `efsim gamedata tree` prints it.
- **Cause:** the question table covers the logs, not the game data; the skill group is used only for skill levels, so
  nothing shows it.
- **Suggestion:** add rows to data.md's question table: "Which files use an action type (and its fields)" →
  `efsim gamedata find <type>`; "Who creates a buff / casts a skill" → `efsim gamedata who <id>`. `efsim kit <op>`
  prints each skill's group (`group ultimate`) and flags an enhanced basic attack (timing.ts `enhancedBasic`'s test).
- **Why it helps:** the next "which operators have X" question is one command, and a brief can quote its output
  instead of guessing. Cost: small.

## 3. team-ab runs every team's 32 seeds when one team moved

- **What happened:** the identity check found the owner's team and Ink Melt identical and Typhoeus's team changed
  (its rules seed), then ran the 32-seed rules at both codes for all three teams: about three times the locked CPU
  time the changed team needed.
- **Cause:** scripts/team-ab.ts loops over `runs`, not over the moved teams, after `moved.length > 0`.
- **Suggestion:** run the 32-seed rules only for the teams in `moved` (and print "unchanged" rows for the rest),
  `--force` for all.
- **Why it helps:** most kit or engine changes reach one team; the job shrinks to a third. Cost: a few lines.

## 4. `earliestStart` with `at` is a lower bound

- **What happened:** my first test asserted that the Finisher's `earliestStart(…, { at: f })` errors inside
  Typhoeus's hover; it returned frame 89 instead (her battle skill holds the input until the idle hover ends, then the
  Finisher may start). The right question was `canStartAt(ctx, state, action, f)`.
- **Cause:** `RotationAction.at` reads as "at", but the gates may move the start later; only the doc comment of
  `canStartAt` says so.
- **Suggestion:** a line in `earliestStart`'s doc comment ("`at` is the earliest frame; to ask whether it starts at
  exactly that frame, canStartAt").
- **Why it helps:** saves a failed test round; no risk.

## What worked well

- `npm run measure` (78 s) settled "does the gate move any log" at once (no log moved: the replay places the logged
  casts, and none of the 14 logged Finishers fell in the replay's state).
- `zmdlogs replay --trace-buff` showed where the replay's Empyrean ended against her logged Empyrean hits; `npm run
  smoke` (109 s) and the Finisher's single gate in `gatesFrom` made the engine change small and safe.
