# Holds and placement: 489c's Corrosion, the third pass, the overlapping pairs (2026-11-25)

Task: round 12's accuracy leads on branch worktree-agent-aeaf9c5a2715f8e9d (base 99806d9): 489c's lost plain hits
after ultimates played in turn, the 20 unsettled casts (settleCheck), the 14 overlapping ultimate pairs, then
9a80 / 79cc's bursts, 7e19's ×1.096, d4fb 97.05 s, the "enemy HP unknown" reading. Result: freeze-ramp `statuses`
(e9ffcac; 489c 488 → 632 plain), the third pass and the in-turn extensions tried and dropped (docs/tried/).

## 1. inTurnStart doesn't say why it left a pair overlapping

- **What happened:** for the 14 pinned pairs, `zmdlogs placement --all` and scripts/probes/placement/ult-overlap.ts
  say *that* they overlap and give a quiet-stretch count of their own, but not which of inTurnStart's checks refused
  each move (reach, the moved stop overlapping a third one, logged hits inside it, the start held to an event,
  `fromEvent` / `beforeStop`, no opening landing). I added a temporary stderr print to logcasts.ts inTurn and
  inTurnStart behind an environment variable, ran it, and reverted it. The first run mixed two passes' lines,
  because settleCheck (which the placement view runs) calls inTurn again for its third pass; a scratch script calling
  placeHits alone was needed to get one pass. About half an hour, and the categorisation the open-problems paragraph
  now has (six not quiet, five of 2–4 frames, three resolvable) came from that print.
- **Cause:** inTurn returns a placement only; its decisions aren't kept, unlike holds.ts's pins and conflicts since
  round 12. The probe recomputes part of the logic (its own quiet count, the stops at ≤ 0.05) and drifts from it.
- **Suggestion:** have inTurn return, beside the placement, one record per ultimate it looked at: `{ cast, verdict:
  "moved" | "event" | "beforeStop" | "held" | "no-overlap" | "refused", checks?: { early, reach, reachMs, free,
  quiet, hitsInside }, candidate }` (the fields of my print). ultimateOverlaps attaches each pair's two records, and
  `zmdlogs placement` prints them under each OVERLAP line (`--why`). The probe then reads the records instead of
  recomputing. Fold the record into round 12's backlog point 1 (`casts --why`): both are "which rule decided this
  cast".
- **Why it helps:** every in-turn change (three rounds running) starts with "why didn't this pair move"; one view
  answers it per pair, and a rule extension can be judged from the list before a measure.

## 2. A view's --assume is missing where the question needs it

- **What happened:** `zmdlogs holds` had no `--assume`, so after the measure said 489c moved under freeze-ramp's new
  reading, I couldn't see the placed holds under it without a code change; I added `--assume` to holdsView
  (packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts). replay, hits, totals, clock and check take it;
  holds, ramp, bursts, placement, stops and differences don't (or don't uniformly).
- **Cause:** each view threads `assume` by hand into its logBuffReplay call; nothing makes a new view take it.
- **Suggestion:** one option parser for the log views (`viewOptions(values)` returning `{ assume, from, to,
  operators }`), and every view's logBuffReplay call fed from it; a test that every `zmdlogs` subcommand that
  replays accepts `--assume` (parse the usage lines, run each with `--assume control-immunity=listed` on one
  fixture).
- **Why it helps:** "what does the view show under the other reading" is the step right after every measure; it
  shouldn't need a code edit.

## 3. Measure output per variant doesn't name the changed hits

- **What happened:** measure told me db87 got worse (plain 209 → 208, total −4.5 → −6.0%) and f978 mixed under the
  freeze reading; to see which hits moved I ran `zmdlogs hits <fx>` twice (with and without `--assume`) into files
  and diffed them, three times (db87, f978 for two readings, d9e5 with a source swap for the in-turn patch, which
  needed copying logcasts.ts aside and back).
- **Cause:** measure keeps the verdict snapshots per run (scratch/measure/<run>/log-verdicts-*.json), but nothing
  prints a moved log's per-hit differences; `cli-ab` does it across commits, not across a reading or a patch.
- **Suggestion:** `measure --hits <id>` (or a `moved-hits.txt` per run for the development logs that moved): the hits
  whose verdict or prediction changed, as `zmdlogs hits` lines, old and new. For a patch, cli-ab already has
  `--patch`; documenting `cli-ab HEAD --patch <diff> -- zmdlogs hits <fx>` in docs/design/tests.md "Measuring a
  change" would cover it too.
- **Why it helps:** every worse log needs its reason in the report; this is the first command after each measure.

## 4. A burst isn't a hold clock

- **What happened:** 9a80's 35.05 s burst comes 1.44 s of world time after its infliction where the delay is ~1.0 s;
  the log is quiet 29.66–30.00 s, where one dodge-sized hidden hold would explain it. The placement can't take that
  evidence: bursts aren't among holds.ts's clocks, so the lead stays open (open-problems).
- **Cause:** holds.ts builds bounds from buff runs, enemy statuses, tick series and Corrosion's ramp, not from
  delayed landings; and a burst's source infliction isn't recorded (round 12's backlog point 2).
- **Suggestion:** after backlog point 2 records each burst's source hit, add burst bounds (`kind: "burst"`): the
  logged burst's world-time delay after its logged infliction hit, against the element's burst delay, ± the log's ms
  (STOP_EDGE_MS). Measure it as an accuracy task.
- **Why it helps:** Arcane's late bursts are the largest remaining burst leads, and a hold explains several of them
  only if the placement can see them.

## What worked well

- `--trace-buff status:corrosion` with `--stops` found the cause in one run: the expiry moved +1.50 s "at time to the
  next sample" with no application moved, i.e. a freeze; and `zmdlogs ramp --verbose` gave the step-by-step lag that
  cleared the in-turn stop.
- holds --verbose's "conflicting with" lists named the four agreeing clocks against the one wrong bound.
- `measure --variant` measured two readings against the same code in one run; docs/tried/ made dropping two changes
  cheap and keeps them re-measurable.
