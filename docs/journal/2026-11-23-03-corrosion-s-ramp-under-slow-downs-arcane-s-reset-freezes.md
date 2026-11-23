## 2026-11-23: Corrosion's ramp under slow-downs: Arcane's reset, freezes

**Goal:** the hold clocks' open direction (docs/journal/2026-11-23-02-hold-clocks-enemy-statuses-and-corrosion-s-ramp.md):
146 of 3,553 ramp readings show the game's Corrosion ramp ahead of the replay's, 139 with a combo slow-down in the
window. Which slow-downs over-hold it, and why; then the hold bounds on the replay's own stops; then 458b's Wulfgard
Combustion ticks.

**Found (open-problems "The buff clock", What over-holds it):** four causes, not one combo rule.
- **Freezes** (f978's 33 readings, the largest bucket, and 7910): the replay's freeze held Corrosion's ramp its whole
  length; the log's steps run on (Si's Immobilization in f978 at 57.6 s: ≤ 0.51 s held of 1.5 s; a7a7 18.1 s ≤ 0.68 s;
  Tangtang's stare in 7910 47.8 s about 0.7 s of 4 s). The probe had counted Laevatain's combo in f978's window.
- **Arcane's combo resets the combo slow-down:** its SkillData has a layer-0 TimeDilationAction back to scale 1 (curve
  RESETto1) at frame 9, in the same priority tag as every combo's dilation (−593023102). Under the lowest-scale rule it
  would do nothing; the game keeps one dilation per priority, so it ends her own 0.6 s slow-down at frame 9 and a
  teammate's running then. 3f78's opener (an application the battle-skill event confirms): steps allow 0.61–0.73 s by
  3.0 s, lowest scale 0.92 s, with the reset 0.72 s; 4a64 likewise.
- **The application's logged ms** (a7a7 3.87 and 20.53 s, 489c 49.31 s): readings ahead of real time since `since`.
  a7a7: Arcane's battle-skill event (2.31 s) puts its hit at 2.98 s, before Liino's combo stop, logged at the stop's
  end (3.86 s); the placement starts the cast through the stop, so the replay applies Corrosion 0.9 s late.
- **Left:** Rossi's combo_3 (two dilations at frame 0 in different priorities) in 3f78 / 4a64, ~0.15–0.2 s; Zhuang
  Fangyi's ultimate placed from its event in 4d60 (0.17 s).

**Done:**
- Data: each compiled slow-down's `priority`, SkillTiming.resets (skillData.ts). Engine: `combo-reset` (default
  `resets`): a reset ends the running slow-downs of its priority, its own too, and gives each clock back what they would
  still have taken (clock.ts `cutAtResets`, `resetSlowdowns`; the shift functions take negative frames, floored after
  the reset). `freeze-ramp` (default `runs`): a freeze holds Corrosion's end, not its ramp (`rampRunsOn`).
  tests/slowdown-reset.test.ts.
- Logs: every stop list is cut at the resets among its casts (logcasts.ts `skillStops`, `withResets`); the hold bounds
  use the replay's own casts' stops (buffreplay.ts `replayedCastStops`, which `replayTimeStops` now calls). Probes
  corrosion/ramp-pairs.ts (pairs of readings cap the model's hold between them, independent of `since`) and
  freezeramp.ts.

**Scoreboard** (`npm run snapshots:update` against 6921b3f): development plain 64.4 → 64.6%, mismatch 15.2 → 15.1%,
|damage| 9.3%; hold-outs 73.5 → 73.7%, 6.4%, 10.8% (5 better, 4 worse); earlier pending 57.3 → 57.5%, 18.4 → 18.2%,
8.0 → 7.9%; verified 77.7 → 77.9%, 1.9 → 1.8%. Better: f978 (444 → 469), a7a7 (351 → 376, mismatch 71 → 45), 3f78
(53 → 63), 4a64 (150 → 156, mismatch 2 → 0), 9c6e, 891566, 7910, 9a80, c83c, b6aa, 2fd9, 99fb, 0eef, b7b3. Worse
(knock-ons of the hidden holds placed again, small): 4d60 −4 plain (Zhuang Fangyi's strikes at 151.7–152.4 s land
0.15–0.3 s off the log's), 79cc −4 (a Corrosion step ahead at 50.1–53.6 s, ×0.987: after Arcane's cut combo the log
asks a dodge-sized hidden hold the bounds now place elsewhere), 9090 −3, 1d91 −1, af7b −1, d9e5 damage −0.1 pt; mixed
00ae (−9 plain, a mismatch fewer), 489c, 9c0b, fc63, 1cd1. Measured apart: freeze-ramp alone 3 better, 0 worse
(hold-outs 73.5 → 74.0%, 2 better, 0 worse); the reset alone, the stop lists uncut, mixed (hold-outs 73.4%, 4 worse);
cutting the lists then 2 better, 0 worse on the hold-outs; the bounds on the replay's stops alone: 2 better, 1 mixed.

**After merging main** (d9b1d2d: Wolven Blood's crits, instance buffs' runs as clocks; `snapshots:update` against
main's snapshots): development plain 64.9 → 65.2%, mismatch 15.0 → 14.8%, |damage| 8.8 → 8.9%; earlier pending 57.7 →
57.9%, 18.4 → 18.2%, 8.3%; 489c 546 → 573 (mismatch 38 → 31, damage −1.8 → −0.7%). One combination regression:
5082 damage −2.1 → −8.2% (plain 227 → 224): with the bounds on the replay's own stops (Yvonne's ultimate at its stop,
not at its 38.16 s event) and main's instance-buff clocks, a 0.77 s hidden-hold unit moves from 38.14 to 36.77 s
(now placed within 0.1 s), and at Yvonne's ultimate finisher (49.78 s, two hits of 0.6 and 1.2 M) and Arcane's hits
at 50.51 s the replay lacks a ×1.17–1.18 the log has, matching a second layer of Arcane's weapon Arts DMG Taken (listed
×2); not traced further. statusLanes takes main's 200 ms refresh rule too (no verdict moves).

**Teams** (team-ab against 6921b3f, seeds 1001–1032; both teams have Arcane, whose combo now holds the world 9
frames): Estella's sustained DPS +0.10% full / −0.13% zero (60 s timeline +4.92% / −1.61%: one rotation's casts moved),
Typhoeus's +0.34% / −0.04% (as a bot at zero energy +4.40%; 60 s timeline −0.26% / −0.01%). Sustained numbers within
their seed spread; the owner's rules need no re-search for this. Examples snapshot moved accordingly.

**Decisions:** the reset in the engine, not a per-log fix: the data carries it, and only a replacing dilation makes
it mean anything. One priority tag per dilation recorded for every slow-down (the reset names its priority). The
views and bounds cut at resets whatever the `combo-reset` reading (they have no scenario). Lead 3 (458b) looked at,
not fixed (open-problems "Ink Melt logs").

**Dead ends:** per-cluster brackets of the hold across a stop from the ramp (a step is 1 s wide: brackets of ±1 s,
uninformative); the readings with the application as one end (they mix in the application's logged-ms errors: the
pairwise test without it separates them).
