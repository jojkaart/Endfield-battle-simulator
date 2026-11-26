# The fights outside ±5% (2026-11-26)

Task: the development and earlier-pending fights whose totals are off by more than 5%, split by operator and
landing kind, fixed by mechanisms (base main 36e3bc8, worktree agent-a5914ecf660f08043).

## 1. Where a Link stack (or any cast-scoped buff) went is in no view

- **What happened:** db87's eleven ×1.3000 Laevatain hits pointed at Link (1), but neither `zmdlogs replay`, `casts`
  nor `hits --json` shows which cast took a Link stack, nor that the replay made two casts for one press (a forced
  normal_skill and the placed normal_skill_during_ult at the same frame). I wrote scratch/link.ts (every replay
  landing with a `Link` modifier, the triggers' traces, replay.made) to find that the phantom normal_skill had taken
  it; 9c0b and f879 needed the same script.
- **Cause:** the timeline's `casts[].link` and its `linkGained` events aren't exposed by BuffReplay; MADE lines in
  `zmdlogs replay` only appear for casts made as another skill, so two casts at one logged press look like one.
- **Suggestion:** a `LINK` line in `zmdlogs replay` (gained: by whom, how many, at which frame; used: by which cast,
  n), from the replay's own record (BuffReplay.made could carry `link` from TimelineState.casts), and a MADE line for
  every cast a logged event made beside a placed cast of the same operator at the same frame.
- **Files:** packages/logs/src/buffreplay.ts (MadeCast), packages/logs/src/views.ts (replay lines),
  packages/engine/src/timeline/state.ts (already has `link` on casts).
- **Why it helps:** a ×1.2 / ×1.3 on a battle skill or ultimate is the commonest exact ratio left in Laevatain's and
  Camille's logs; with the line, it's one command instead of a script.

## 2. The by-operator scoreboard reads as a fight metric but isn't

- **What happened:** the brief's operator means (Perlica 17.3%, Liino 17.1% …) looked like a shared cause; they are
  each operator's own total error (scripts/accuracy.ts perOperator), dominated by the four stage logs and by small
  totals where a few replay-only beats are 20–60% (Liino's 0eef +58% on a 9 s fight). It took a jq pass over the
  snapshots' `operator <id>` keys to see it.
- **Cause:** docs/accuracy.md's "By operator" table gives the mean without the share of the fight or a median, and
  has no column that tells a stage log's effect from a kit's.
- **Suggestion:** add to the table the operator's mean share of the fights' logged totals and the mean without the
  stage logs (a `stage: true` flag in holdout.json's development list or the fixture), or weight the mean by the
  operator's logged damage.
- **Files:** scripts/accuracy.ts, fixtures/holdout/holdout.json (a flag only), docs/accuracy.md (generated).
- **Why it helps:** the next brief built on the table won't send an agent after a cause that is four stage logs.

## 3. A cast's slots by time only, and the first landing's slot fixed

- **What happened:** 9c0b's Hunter Pursuit and 7910's Tangtang rogue wave are placed with a logged landing in the
  wrong slot (values ×5–17 off); realignUltimates handles ultimates only and keeps the first landing's slot, so the
  cast's start (and its Link timing) stays wrong. Not built for lack of time.
- **Cause:** logcasts.ts slots landings in turn; the values aren't used.
- **Suggestion:** a realignment for any kind with the first slot free when the landings are fewer than the slots,
  chosen by time and by the ratio of the logged values to the kit hits' scales (the cast start moved with it).
- **Files:** packages/logs/src/logcasts.ts.
- **Why it helps:** removes twin landings (matched far off plus replay-only) and the downstream timing errors.

## What worked well

- `zmdlogs totals --kinds` and `--by crit` pointed at each fight's dominant landing in one call; `hits --json` with
  zones and modifiers made 7910's ×1.099 a one-zone question (the resistance zone, the same +11.35 for every
  operator) in minutes.
- `npm run measure -- --base <ref>` after each WIP commit separated the three changes' effects cleanly.
- `efsim gamedata tree` on buff_common_natural_natural_corrupt_do showed the tick's gate directly.

## Outcome (round 15)

- 1 (Where a Link stack (or any cast-scoped buff) went is in no view): done (84f1322): MadeCast `link` and `linkGained` (buffreplay.ts linkGains: TimelineState.link's new expiries in each cast's step), LINK lines in `zmdlogs replay` and `zmdlogs decisions` (gained in whose step, taken by which cast), and a MADE line for two casts of one operator at one frame (db87 27.13 s, tests/decisions.test.ts)
- 2 (The by-operator scoreboard reads as a fight metric but isn't): carried (2026-11-26-backlog-after-round-15.md point 3)
- 3 (A cast's slots by time only, and the first landing's slot fixed): moved to the backlog's accuracy list ("Slots by value within a cast"): it moves the placement
