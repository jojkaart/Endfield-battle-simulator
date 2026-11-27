# Placement cases from the one-sided rounds (2026-11-27)

Task: the log-only placement and cast-assembly cases the two one-sided rounds left (f879 95.10 s, 5082 45.06 s, 3aa6
125.65 s, Pogranichnik's harasses, 99fb's bleed ticks, Arcane's INT lasers, 9a80 34.94 s), on a worktree branch from
main 107766a, beside an agent on status pairing.

## 1. A placement's "why this slot" isn't printed for a joined landing

- **What happened:** f879's 94.71 s explosion showed in `zmdlogs casts` as `→ normal_skill@87.12 #1 frame 29`, 7.6 s
  after its cast, with no reason. Which of the pass's six join conditions (`elapsed <= span`, `toCome`, `paced`,
  `sameUltimate`, `used`/`sameByValue`, `onTime`) kept it on the old cast took reading 200 lines of placeWith; the same
  for 9a80's 34.94 s slash ("same landing as another enemy's" names the outcome, not that `used` without a value test
  did it). `--choices` prints the rule for new casts only.
- **Cause:** the join branch of placeWith records only the slot; the decision's inputs (elapsed, the slot's due time,
  which condition held) are local variables.
- **Suggestion:** record on PlacedHit a `joinedBy` ("span", "toCome", "paced", "sameUltimate", "sameEnemy") and the
  elapsed world ms against the slot's due ms, and print it with `--choices` on HIT lines whose elapsed exceeds the
  slot's frame by more than CAST_SLACK_MS.
- **Files:** packages/logs/src/logcasts.ts (placeWith, PlacedHit), packages/logs/src/views.ts (the casts view).
- **Why it helps:** the late joins are the placement's most common silent error (three of this round's four cases);
  printing them makes them findable with one `rg 'toCome'` over `casts --all` instead of a code read per case.

## 2. A hold-out-only regression can't be traced, so a data-right change is dropped

- **What happened:** the replay's JUMPDROP leaving out landings launched before the jump (engine drivers.ts) moved no
  development log and cost one hold-out 23 plain. Nothing says which operator or skill, so the change went to
  docs/tried/ unexplained (2026-11-27-jump-launched-landings.diff), the second such diff this week (unknown-crit-slots).
- **Cause:** the hold-out summary gives verdict classes and key kinds, never the operator or the decision kind that
  changed; a decision-level aggregate (how many JUMPDROP / MADE / SKIP lines moved, by kind) would say whether a
  replay rule acted there without naming the log.
- **Suggestion:** measure's hold-out lines also count the replay's decision lines that differ (zmdlogs decisions'
  kinds, counts only: "JUMPDROP −3, MADE +1"), and the skill kind of the casts they're on (battle / combo / …).
- **Files:** scripts/measure.ts, packages/logs/src/decisionsview.ts.
- **Why it helps:** a rule whose only effect is in a hold-out can then be told apart from a knock-on of something
  else, without opening the log; counts by kind keep the hold-out blind.

## 3. Stagger-break holds have no view

- **What happened:** 5082's Yvonne case came down to her own timeline held ~0.5 s at a Stagger break (shots two frames
  apart logged 0.45 s apart). Finding it needed the replay, the stagger view and `zmdlogs holds` side by side, and the
  hidden holds then turned out to be spread over 1.5 s around it (1-frame steps), which only a debug print showed.
- **Cause:** `zmdlogs holds` prints units and placements, not the frames each step holds; nothing lists an operator's
  landings' lateness against its cast's kit frames.
- **Suggestion:** `zmdlogs casts --late` (or a probe): per cast, the max lateness of its landings against its kit
  frames on the replay's own stops, flagged where it exceeds 3 frames; and `holds --steps <from>-<to>` printing the
  per-frame hold steps the replay applies.
- **Files:** packages/logs/src/views.ts, packages/logs/src/holds.ts.
- **Why it helps:** a hold the model lacks (the break dilation the data's enablePoiseBreakTimeDilation suggests) shows
  as one table across logs instead of one log's hand comparison.

## What worked well

- `node scripts/cli-ab.ts HEAD --placement` showed every log a placement rule moved, by operator, in a minute: it
  caught that Zhuang Fangyi's ranges moved with Laevatain's fix, and measure's `--split files` isolated the drivers.ts
  part as the hold-out's loss.
- `efsim gamedata tree <skill>` answered the entity question (the Magma Fragment's own timeline) directly.
