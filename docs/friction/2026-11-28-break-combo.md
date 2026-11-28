# Breaks inside a combo's slow-down; 458b 87.47 s (2026-11-28)

Task: the open points of docs/open-problems.md "The hold at a Stagger break": 458b 87.47 s (Akekuri's combo INSIDE
her ultimate), whether a break inside a combo's slow-down holds and how, a press in a hold; worktree
agent-a49294ec4779c9633 from main at 2f4afbd.

## 1. A skill's raw SkillData fields behind a rule are invisible from the views

- **What happened:** two INSIDE flags in 458b (87.47 and 158.53 s) took an hour to trace to their causes. The 158.53 s
  one was Akekuri's ultimate carrying skillSpecification 0 (every other ultimate has 5), so the engine gave it a plain
  skill's interrupt priority and no ultimate stop flag; the INSIDE line says only "N frame(s) before X lets it start
  (its uncuttable frames …)", and `efsim kit` prints duration, uncuttable frame, windows and slow-downs but not the
  specification, the priority or the cantCastSkill channels that actually gated the 87.47 s combo (the channel
  0–119, not the uncuttable frame 150). I found both by grepping the raw JSON under data/ and reading timing.ts.
- **Cause:** the INSIDE line names the gate generically, and the compiled kit view omits the fields the gates read
  (SkillTiming.specification, priorityOf, channels).
- **Suggestion:** the INSIDE line names the gate that bound (`window from frame 129`, `cantCastSkill channel to frame
  119`, `exclusive frame 55`, `priority 2 < 5`); `efsim kit` prints each skill's specification and priority and its
  channels; and a data check (tests/) that lists skills whose specification disagrees with their kit kind (the
  ultimate with 0 was the only one; Azrila's combo_skill_defend and Seraph's tactic skill have a time stop too).
- **Files:** packages/logs/src/replayrun.ts (castFlag), packages/engine/src/timeline/timing.ts (earliestStart's
  binding gate), packages/cli/src/commands/kit.ts, tests/.
- **Why it helps:** an INSIDE flag is the replay saying "the kit forbids what the log did"; naming the gate sends the
  next agent to the right field at once instead of to the uncuttable frame the line mentions.

## 2. An ultimate's hitless cast event: press or stop's end, decided in two places with two rules

- **What happened:** 458b 84.37 s's event was read as the press (loggedCastStart: no other hit within 500 ms after
  it) while query.ts castEventPlace's own classification called it "inside" and the team's next hits 1.2 s later lay
  inside the stop a press there would make. The placement's unplacedCastStops in logcasts.ts uses the event time as
  the stop's start regardless. Three rules on one question in two files, one of them the other agent's.
- **Cause:** "where in its stop is this event" has no single function; each consumer re-derives it.
- **Suggestion:** one function (castEventPlace's, extended with "a hit inside the stop a start at the event would
  make") that loggedCastStart, unplacedCastStops and the views' EVENT line all read.
- **Files:** packages/logs/src/query.ts, castassembly.ts, logcasts.ts.
- **Why it helps:** the held-back diff of this round (docs/tried/2026-11-28-ult-event-stop-end-held-back.diff) fixes
  one consumer only; the stop list the placement passes use would still start at the event.

## 3. cli-ab's per-hit lines need the right view, found by trial

- **What happened:** to see which 458b hits a change moved I tried `cli-ab -- zmdlogs differences` (aggregate rows
  only), `--kit-buff … --against-lanes` (LAND lines, no lanes), `ends --at` (nothing differed), and finally `hits
  --layers <owner:buff>` gave the per-hit rows; then a scratch script with `replay.stateAt` and `at-commit --run` for
  the layers' timers. About 20 minutes.
- **Cause:** no view lists "the hits whose verdict class moved" between two codes; measure's moved.json lists logs only.
- **Suggestion:** `measure` writes, per moved development log, the hits whose class changed (time, operator, event,
  class before → after) into its run folder (moved-hits.txt), as it already knows both verdict sets.
- **Files:** scripts/measure.ts.
- **Why it helps:** every "why did this log get worse" starts there; it is the first question after every measure.

## What worked well

- `measure --variant` with `--variant-patch`: three readings and a held-back diff measured in two queued runs.
- The `break-place.ts` / `press-in-hold.ts` probes and `zmdlogs worldtime --holds`, `holds --steps`: the 458b tick
  question was answerable in a few commands.
- `node scripts/tried.ts new` for the held-back diff: header skeleton and README line in one step.
