# Corrosion's ramp under slow-downs (2026-11-23)

Task: find why the replay holds Corrosion's ramp longer than the game across combo slow-downs (146 over-held
readings), switch the hold bounds to the replay's own stops, trace 458b's Combustion ticks. Branch
worktree-agent-a422d14d2bb4f287c (Arcane's combo reset, freezes and the ramp, bounds on the replay's stops).

## 1. The over-hold count blamed combos for what freezes and logged ms did

- **What happened:** the brief (from the hold-clocks round's probe, scripts/probes/corrosion/rampprobe.ts) said 139 of
  146 over-held readings had "a combo slow-down in the window". The largest bucket (f978, 33 readings) was a freeze:
  Si's Immobilization held the replay's ramp 1.5 s; Laevatain's combo merely sat in the window. a7a7's and 489c's were
  the application's logged ms, not any stop. It took four scratch probes (per-reading stops, an envelope view, cluster
  brackets, pairwise feasibility) and about a third of the session to separate the causes.
- **Cause:** `zmdlogs ramp` shows the step the log and the replay read and the hold the steps allow, but not what in
  the replay held the ramp between the application and the hit: stops, freezes, `status-in-stop`, placed holds are all
  folded into RampStep.world. The probe then attributed by "some stop overlaps the window".
- **Suggestion:** `zmdlogs ramp <fixture> --why`: per reading, the replay's held time split into time stops (each
  stop's share at the lowest scale), freezes (enemyFrozenUntil spans), statuses created in a stop, placed hidden holds;
  RampStep could carry those parts (rampsteps.ts has the frames). And print the pairwise caps
  (scripts/probes/corrosion/ramp-pairs.ts) as a summary line per instance.
- **Why it helps:** the next "why is the ramp off" question starts from the cause instead of from a correlation.

## 2. Readings anchored on the application inherit its logged ms

- **What happened:** every ramp bound runs from `since`, the application's logged ms. Where the applying hit landed
  just before a stop and was logged at its end (a7a7 3.86 s; 489c 49.31 s), every reading of that instance looked
  over-held, and fixing combos could never satisfy them. Only comparing readings against each other (ramp-pairs.ts,
  which never uses `since`) separated them.
- **Cause:** rampBounds builds P(hit) − P(since) bounds only; the application's time is taken as exact.
- **Suggestion:** in rampsteps.ts, add pair bounds between consecutive readings of one instance (P(b) − P(a) from the
  step edges, which don't need `since`), and treat the application bound as softer (or check it against a battle
  skill's cast event + hit frame, as a7a7's 2.31 s event shows).
- **Why it helps:** the hidden-hold placement wouldn't be pulled by a misplaced application, and the view would show
  "the application, not the stops" directly.

## 3. The data compiler dropped the reset silently

- **What happened:** Arcane's combo has a TimeDilationAction back to scale 1 (curve RESETto1) at frame 9.
  skillData.ts `slowdownOf` returned null for it (all scales ≥ 1) and nothing recorded it; `efsim kit` and the compiled
  timing showed only her 18-frame slow-down. I found it only by dumping every dilation's priority and curve from the
  raw SkillData files with a scratch Python script.
- **Cause:** the compiler keeps what the engine models and drops the rest without a trace; the dilations' priority
  tags (which decide how they combine) weren't compiled at all.
- **Suggestion:** a compile-time list of game actions the compiler saw but didn't model, per skill (`efsim gamedata
  unmodelled <skill>` or a line in `efsim kit`), starting with TimeDilationAction at other layers and priorities.
  The slow-downs now carry `priority` and SkillTiming.resets; `efsim kit` could print both.
- **Why it helps:** "the data says something the engine ignores" shows up before a week of hypothesis tests.

## 4. Four stop-list builders, each needing the same rule

- **What happened:** the reset had to be applied in the engine (clock.ts) and in castTimeStops, unplacedCastStops,
  replayTimeStops and the hold bounds. Measured with the engine alone it looked mixed (hold-outs 4 worse): the bounds
  counted Arcane's stop whole while the engine cut it. Only after cutting every list was it clean.
- **Cause:** each consumer builds its TimeStop list from `data.skills[..].timing.slowdowns` itself; there was no
  shared builder.
- **Suggestion:** keep logcasts.ts `skillStops` + `withResets` as the one builder (now used by castTimeStops and
  replayedCastStops) and route bufftiming.ts, views.ts and unplacedCastStops through it; a lint rule or a test that
  `timing.slowdowns` is read only in skillStops and the engine.
- **Why it helps:** a later rule about stops (priorities, a caster not held by another's combo) lands everywhere at
  once, and an engine-only measurement isn't misleading.

## 5. The engine's clock can only add held frames

- **What happened:** cutting a running slow-down short means giving frames back. slowDown shifts everything after a
  slow-down's start once, so a cut needed negative shifts through shiftWorld, shiftEnemy (Corrosion's appliedAt and
  rampHeld), shiftBuff, shiftClock and shiftOperator, each guarded `n <= 0`, plus a floor so nothing moves before the
  reset; a first attempt floored Corrosion's appliedAt (a reference, not an event) and was a frame off.
- **Cause:** the clocks are moved by scattered `later(f)` closures, not one mapping; whether a field is an event time
  (floor it) or a reference (don't) is implicit.
- **Suggestion:** one `ClockShift` value (start, n) with `event(f)` and `reference(f)`, used by every shift function,
  and a comment at each state field saying which it is.
- **Why it helps:** the next change of a slow-down after it began (an interrupted ultimate, a cancelled combo) is a
  few lines.

## 6. Chained measures and the queue snapshot

- **What happened:** I chained `measure --assume A; measure --assume B` in one background call and had to wait
  before editing tracked files until the second one had taken its snapshot (it snapshots when it starts, not when the
  chain starts).
- **Suggestion:** `measure --assume A --assume-alt B …` (or `--variants a,b`) measuring several readings of the same
  snapshot in one run.
- **Why it helps:** separating two changes' effects is the commonest A/B; one call, one snapshot, no waiting.

## What worked well

`zmdlogs ramp` (the step readings were the evidence), `measure --assume` and `--base` for each change apart, the
probes folder (rampprobe.ts reproduced the brief's numbers at once), team-ab's identity check then seed table.

## Outcome (round 7)

- 1 (The over-hold count blamed combos for what freezes and logged ms did): done (36920c0): `zmdlogs ramp <fixture> --held` splits each reading's held time (the replay's application to the landing, less its Corrosion's own time) into each time stop's share (the replay's stops, at their lowest scale per frame), the placed hidden holds and the rest, and shows the log's application beside the replay's where they differ (RampStep.replay carries the parts). Freezes no longer hold the ramp (9152361), so they have no column. The pairwise caps summary (ramp-pairs.ts) isn't in it: it belongs with point 2's pair bounds.
- 2 (Readings anchored on the application inherit its logged ms): not friction work: in docs/friction/2026-11-23-backlog-after-round-7.md's accuracy list (pair bounds between readings, a softer application bound: changes the placement).
- 3 (The data compiler dropped the reset silently): done (9bb4bbd): readSkillFile records every UltimateTimeAction / TimeDilationAction with its layer, priority and curve and what it made of it (slow-down, reset, "dropped: <why>"), outside the compiled data; `efsim kit` prints a "time dilations" line per skill and `efsim gamedata dilations [<re>] [--dropped]` lists them over every compiled skill (today 204 switched off, 49 on layer 1, no unknown curve).
- 4 (Four stop-list builders, each needing the same rule): done (f3257f3, a6778f0): skillStops + withResets stay the one builder; tests/stops-source.test.ts counts every read of SkillTiming.slowdowns / resets in packages/logs (a new one fails with what to do); the views (casts, bufftiming) take the replay's stops; castTimeStops' comment says which list for what. Routing the placement's unplaced events through withResets was measured and dropped (1cd1 182 → 177, open-problems). A lint rule would have needed comments in buffreplay.ts, which another agent was editing; the test does the same from outside.
- 5 (The engine's clock can only add held frames): carried (backlog point 8 with hold-clocks 3b: both are the engine's clock fields, edited by another agent this round).
- 6 (Chained measures and the queue snapshot): done (a6778f0): `npm run measure -- --variant <id>=<r>[,…]` (repeatable) measures several readings of one snapshot in one run, a summary per variant, files under variant-<n>/.
