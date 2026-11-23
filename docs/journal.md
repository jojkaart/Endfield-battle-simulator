# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 125 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-23: Wolven Blood's crits from its listed layers; Gilberta's tower-boss stacks from an instance buff's clock

**Goal:** two leads from docs/journal/2026-11-23-02-hold-clocks-enemy-statuses-and-corrosion-s-ramp.md: Rossi's Wolven
Blood starting late where the log gives her hits no crit (489c's 16th layer at 55.61 s, the replay's at 59.5 s), and
Gilberta's Vulnerable stacks outliving 20 s on the tower bosses (4360 116.0 s, 9847 126.1 s; 9847 310 → 300 from the
ramp cap).

**Done (open-problems "The buff clock" Wolven Blood bullet, "Gilberta's Susceptibility"):**
- buffreplay.ts `layerCrits`: a trigger on its operator's crits that adds a layer of a buff the log lists with its start
  adds one per crit, so n layers listed from a moment (`listedStarts`: entries with that `since` over the entry kinds)
  are n crits there, after the logged and shownCrits ones: all the crit-less hits there when as many, else the largest
  standing apart ×1.4 (CRIT_APART, shared with shownCrits). Cross-validation with every flag of the operator hidden
  (development logs; Rossi, Chen's and Yvonne's crit sets too): 956 of 973 right (0.98, base rate 0.64); the listed
  starts moved to random moments of her hits (negative control): 0.63. Both in tests/buffreplay-fixtures.test.ts on 489c.
- loggedLaneEnds: a run is refreshed only when it stops being listed within 200 ms of the other's start (runs listed side
  by side are two instances). runBounds: an instance buff's run (KitBuff.instances, excluded before) is a clock where the
  log shows it apart (`runApart`: each replay application inside it has its own run, some run overlaps it, none ends
  within 1 s of it), it is the run nearest the instance (`nearestRun`), and it is at most 1 s late (INSTANCE_LATE_MS).
  4360: Perlica's Arts DMG Taken from 92.24 s, 0.74 s late, places a hold that keeps the 90.87 s stacks: Gilberta's
  116.0 s Susceptibility reads 0.39 (3 stacks), Avywenna's ultimate under it plain.
- Scoreboard (`npm run snapshots:update`): development plain 64.4 → 64.9%, mismatch 15.2 → 15.0%, mean |damage error|
  9.3 → 8.8%, within 5% 16 → 17; hold-outs unchanged; earlier pending 57.3 → 57.7%, 18.4%, 8.0 → 8.3% (0c14); all but the
  hold-outs 61.9 → 62.3%, 16.1 → 15.9%, 8.1 → 7.9%. Rossi 39.8 → 41.8% plain. Development 11 better (489c 517 → 546,
  mismatch 57 → 38; 207f 106 → 121; 5082 damage −18.1 → −2.1%), 3 worse: 4a64 (150 → 140: the Wolven Blood runs moved
  the placed holds, Corrosion read a step ahead at 16.8 s and Gilberta's Pursuit lost at 28.3 s), 9847 (one mismatch,
  Gilberta's attack 3 at 140.3 s, the moved holds), 9a80 (damage 0.5 → 1.4%); 0c14's total +16.4 → +26.1% (Rossi's own
  −10.8 → +1.6%, Si's +14.1 → +21.9%: her replay-only Artful Intent burst records Rossi's larger damage). No engine or kit
  change: the simulated fights are the same (team-ab not run).

**Decisions:** the crit count only adds crits (at 16 layers a new one replaces one; the listing undercounts there). An
ambiguous moment is left alone unless the largest stand apart: the hit's own verdict tries both crits anyway, what matters
is the count. Instance buffs as clocks only with the log's evidence that the run is an instance of its own: Arcane's
will_dmg / will_atk runs keep their start through refreshes (489c, 9c0b: overlapping runs end together; b6aa, 4d60:
lone runs 2–8 s late; 4d60 placed 11 s of holds before the 1 s cap). holds.ts statusLanes keeps the old refresh rule
(another agent's file).

**Dead ends:** instance buffs allowed wholesale (489c plain 517 → 475: Arcane's refreshed runs asked 2.6 s of holds);
the per-buff independence test (9c0b's will_dmg passed it); without the nearest-run rule 489c's 12.0 s instance paired
with the 14.6 s run.

**Left:** 9847 126.1 s (0.30 against 0.36): no listed clock asks the 0.73 s more before the ultimate; Gilberta's listed
Susceptibility as a Vulnerable-count clock (a holds.ts bound builder). 489c's final 1.1 s late from two bleed ticks the
replay lands off the log's (ticksShownByHits), d572's one layer short from ~8 s with every crit logged.

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

## 2026-11-23: Improvement round 6: a kit buff's clock, probes, the split

**Goal:** the sixth friction round (docs/friction/README.md) over the six open reports (round 5's backlog and its own
report, the buff clock, Artful Intent, hidden holds, the four smaller leads) and the lead's list, behaviour-preserving;
on main at 235d717. Summary: docs/friction-done/2026-11-23-round-6.md.

**Done:**
- `efsim zmdlogs clock --kit-buff owner:id [fixture…]` (packages/logs/src/clockview.ts): per instance the first
  expiry, the expiry on the replay's own clock (`hidden-holds=none`, before any shortening step), how it ended there
  and in the check's replay, the log's run and the lateness in real and world time; four agents had scripted it.
- scripts/probes/<topic>/ with an index and a rule (a scratch script a doc cites moves there in that commit); eleven
  cited probes promoted from other worktrees' scratch and run at this code; open-problems points at them.
- `node scripts/holdout-split.ts add-development <fixture>` (the development array's text alone, the parse checked,
  nothing of the hold-out list shown); 207f registered.
- World-time views (worldtime, lanes --world, cadence) on the stops of the replay's casts (query.ts `replayTimeStops`:
  db87's Laevatain ultimate placed from its cast event was missing); `measure` reads a log new since the reference
  commit from the measured tree; `zmdlogs hits --assume`; census `origin:<re>`.
- `operatorId(data, "Arcane")` (@efsim/data), `efsim find --operators`, devFixtures by name.
- The backlog: closed-by lines and a parked list (docs/friction/README.md), scripts/friction.ts `outcomes` / `carry`;
  round 5's points 1–21 parked; docs/friction/2026-11-23-backlog-after-round-6.md has 20 live points.

**Scoreboard** (`npm run snapshots:update`: no log's verdicts moved; only the groups): development 31 → 32 fights,
plain 63.2 → 62.5%, mismatch 15.4 → 15.6%, |damage| 9.1 → 9.4%; earlier pending 24 → 23 fights, 56.1 → 56.9%,
18.8 → 18.7%, 8.4 → 8.0%; verified, hold-outs and all but the hold-outs unchanged.

**Decisions:** the split edited as text, not re-serialised (a whole-file rewrite would put hold-out ids in the
diff). `zmdlogs clock` as a consumer of the replay's traces under two readings, so nothing in logBuffReplay moved
while the hidden-holds clocks agent works in it; its run() refactor, the enemy-status trace view and the Corrosion
reader left to that agent (the backlog's "Taken" section). Probes not typechecked or linted: they age, and the
README's "last run" column says when one was last seen working. Points carried through two rounds without a new
report parked rather than re-read.

**Left:** the backlog's 20 points (`zmdlogs clock` from casts and over every buff, the kit windows' instance chain,
pinned expiries, origin columns, the hold-out field count, round 5's carried views); friction report
docs/friction/2026-11-23-round-6-friction.md.

## 2026-11-23: Hold clocks: enemy statuses and Corrosion's ramp

**Goal:** more clocks for the hidden holds (docs/journal/2026-11-23-01-hidden-holds-placed-once-for-every-timer.md):
the enemy's listed statuses and Corrosion's ramp steps; Rossi's Wolven Blood clock; the last merge's combination
regressions (458b, bdf2, a7a7); d774's Sunderblade count.

**Done (open-problems "The buff clock", More clocks):**
- holds.ts `statusBounds` / `statusLanes`: each Electrification, Corrosion and Breach the replay without holds let run
  out, against the log's run of it (the enemy's side of every hit lists them, any element); from below only for a
  status a team kit consumes. The placed holds alone didn't cover d774 (0.26 s placed where its Electrification asks
  0.84 s); now 0.83 s: the first Sunderblade strike plain (12127), all eight strikes one for one with the log's.
- rampsteps.ts + `efsim zmdlogs ramp <fixture>`: each hit under Corrosion read at every step of the replay's Corrosion
  (the steps whose damage fits ±1), against the replay's own world time there; logcheck.ts `logBuffReplay` places the
  holds again with these bounds (ReplayOptions.holdBounds). db87 plain 166 → 206, mismatch 59 → 18.
- Engine: a running Corrosion's ramp stands still inside a stop (status.ts `rampElapsed`, ActiveStatus.rampHeld); it
  used to be set back by the rest of the stop at the stop's start (4d60 73.65 s: 2.6 s younger, 14.4 against 22.5).
- Scoreboard (`npm run snapshots:update`): development plain 63.2 → 65.1%, mismatch 15.4 → 15.0%, mean |damage
  error| 9.1 → 9.0%; hold-outs 70.3 → 73.5%, 6.4%, 10.8% (3 better, 0 worse, 2 mixed); earlier pending 56.1 → 56.5%,
  18.8 → 18.6%, 8.4%; verified 77.1 → 77.7% (matched 97.8 → 99.1%); all but the hold-outs 60.6 → 61.9%, 16.4 → 16.1%,
  8.1%; with round 6's groups (207f a development log) development 62.5 → 64.4%, 15.6 → 15.2%, 9.4 → 9.3%,
  earlier pending 56.9 → 57.3%. Development 13 better (5082 plain 150 → 219, mismatch 36 → 6; 7910 255 → 318; db87; f978 394 → 444), 3 worse:
  9847 (310 → 300: the ramp caps the holds Gilberta's Vulnerable run asked for, below), 4d60 (697 → 696: Liino's
  ultimate hits at 83.3–83.6 s a step behind the log's ramp, one frame of hold), fc63 (508 → 504: Arcane's 0.12 Susceptibility held past the log's end at 18.85–19.07 s by a hold the new clocks moved earlier); d572
  908 → 918, mismatch 26 → 17; d774 348 → 365, mismatch 38 → 24, its over-predicted total +24.8 → +27.2% (the
  Electrification it now keeps).
- Teams (team-ab against 235d717, seeds 1001–1032): Estella's sustained +0.00% full / +0.01% zero, as a bot +0.08%,
  her zero-energy 60 s timeline +0.07%; Typhoeus's unchanged (60 s timeline +0.00%). Five example snapshots moved
  ≤ 0.13% (Corrosion read inside stops).

**Found:** Wolven Blood has no clock of its own (no time-scale flags in its BuffData; its runs last 19.5–20.8 s of
world time); its misfits are its 16th layer, on hits the log gives no crit (489c 55.61 s; the replay reaches 16 at
59.5 s). The ramp says 9847's Gilberta Vulnerable stacks outliving 20 s aren't hidden holds (it allows ≤ 0.94 s there).
The other direction is common: 146 of 3,553 ramp readings need a hold below zero, 139 with a combo slow-down in the
window (f978, 3f78, 9c6e, a7a7, 4d60): the replay holds the ramp longer than the game across some combos. a7a7 (lead
3) is one; 458b's regression is Wulfgard's Combustion ticks, not traced; bdf2 156 → 157.

**Decisions:** a status's last listing within two frames (70 ms), not a buff run's 200 ms: no holder's hits bracket
it, and a consumed status's last listing is the consuming hit. Ramp bounds against the replay's own world time (its
Corrosion at the landing, its placed holds added back), not the placement's stops: those miss ultimates placed from
their events (db87's Laevatain, 4d60's Zhuang Fangyi), and a first version double-counted 1.5 s in db87. The run()
closure stays: the ramp pass composes outside it (one more replayKitBuffs with `holdBounds`).

**Dead ends:** reading the ramp only from the log's listed Corrosion: db87's log lists none (the replay's application
stands in). A ramp reading far from the replay's step (Arcane's seal finisher at step 2 of 10): a coincidence, now
skipped beyond one step: the ramp is read from the damage the check judges, and with three steps the
negative control found 34 chance matches of 167 in bdf2 at ×0.97 (none with one; the logs' verdicts the same).

**Left:** test 111; the combo slow-downs that over-hold the ramp; crits a buff's listed layers show (Wolven Blood); the
replay's own stops for every view and bound (friction report docs/friction/2026-11-23-hold-clocks.md).

## 2026-11-23: Si's strokes from the log: Initial Stroke at the first press, the burst's origin

**Goal:** the brief after the Yinglung's Edge hypotheses (2026-11-22): what each of Si's logged presses is and when
Artful Intent ends, then whether N2 (her first press counts for the set) follows; and whether anything in the logs or
the data marks leaving combat (N1).

**Done:** the bursts' `poise.origin` tells how each Artful Intent ended: `normal_skill_2` Final Stroke (26), the
Inksoul returning by itself at expiry `normal_skill_inkmove_2` (22), the mark's burst (`inkmark_projhit`, 26: no
Inksoul, ended at its one press 20–34 s after the hit). Initial Stroke is the first press after the battle skill; her
other presses under Artful Intent (269 of her 276 hitless events, every ~3.3 s) do nothing the log shows. Built in the
replay (2a9a267): castsFromBuffEnds infers Final Stroke only from a burst credited to it (or to nothing); pullingPresses
makes the first press Initial Stroke (ReplayedCast.as) unless the mark's burst ends that Artful Intent; the kit's
initial_stroke trigger detached (the Inksoul comes from the entity spawned at frame 0). The engine's Edge score 54 / 4 /
10 → 61 / 2 / 5 of 68 (N2 follows from the strokes). Scoreboard: development plain 59.9 → 60.1%, mismatch 16.4 →
16.2%, mean |damage error| 9.2 → 9.3%; earlier pending 53.1 → 53.2%; verified and hold-out unchanged; c83c mismatches
31 → 0, 9555 11 → 1; 7b54 damage 48.2 → 49.0% (a combo out of the Edge test, an Initial Stroke layer more). Team
numbers unchanged (team-ab against 6b117c1: every team's own fight identical), so the owner's rules need no re-search. The detached Initial Stroke broke
examples/ink-melt-zero (its second Initial Stroke at 6.67 s, after one cut by her combo at 3.8 s, now finds the
Inksoul up): that step dropped by hand (`repair --write` dropped 80 steps instead), total 2,844,498 → 2,853,256. c83c,
e989 and 0c14's mean |damage error| +0.1–0.3 points with the layers their combos imply.

**Decisions:** Final Stroke's layer stays counted as the kit has it: no log tells (always past the cap or before the
same combo). N1 not built: the set's buffs handle no battle exit in the data (ability event 7 only in six buffs, Si's
normal_skill_check among them), the layer is the caster detector's child buff but the wearer's own layers go too; the
two clear cases are the boss Si's half-HP pause (3f78, 4a64), 7b54's is ambiguous (Jade Vessel or Camille's hitless
press). Test 106 (e) now asks about that phase change.

**Dead ends / found:** a Stagger bar back to full after a pause marks nothing (every ~5 s pause refills it). 0c14
166.7 and its ×0.288 burst: a battle skill at 157.42 s whose hit the log lacks restarted the record (0.17 × the hits
from 158.76 s = the logged 90,026). Why Artful Intent without Initial Stroke lasts until a press, and what the later
presses are, stay open.

## 2026-11-23: Hidden holds placed once for every timer

**Goal:** the buff clock's next step (docs/journal/2026-11-22-03-the-buff-clock-unlogged-world-holds-keep-buffs-past-their.md):
estimate where each fight's unlogged world holds fall from every clock the log shows, hold every timer there once, and
see whether the holds, read as perfect dodges, explain the Team SP shortfall.

**Done (open-problems "The buff clock", "Placed"):**
- packages/logs holds.ts: one hidden clock P per fight. Bounds: each buff that ran out in a first replay without holds
  against the log's run of it (lateness at its last listed hit, at most by the next hit without it, in world time past
  the expiry), the enemy's tick series as chains (Combustion, Rossi's bleed, Typhoeus's combo field, Aurora's
  ultimate); P rises no faster than real time and not in the Stagger. Difference constraints, a conflicting bound
  dropped; the least total hold, midway between the earliest and latest placement. `efsim zmdlogs holds <fixture>`.
- The replay holds the world's clock there (engine timeline/clock.ts `holdWorld`: buffs, the enemy's statuses and
  debuffs, combo windows; not cooldowns, SP or the operators' timing), then keeps listed buffs to the log's end.
  Engine assumption `hidden-holds`, new default `placed` (`holds`: the holds alone). BuffReplay.spTopUps: the SP
  replayCast raises at each cast.
- Scoreboard (`log` → `placed`): development plain 59.9 → 62.8%, mismatch 16.4 → 15.6%, mean |damage error| 9.2 → 9.1%,
  within 5% 14 → 16; hold-outs 69.6 → 69.9%, 6.7 → 6.6%, 11.0% unchanged (2 better, 1 worse); earlier pending 53.1 →
  54.0%; verified 75.6 → 77.4%; all but the hold-outs 57.5 → 59.6%, 18.8 → 18.3%, 8.1 → 8.0%, within 5% 31 → 34.
  Development 12 better, 2 worse (a27b, ad7f: damage only), 11 mixed; worse elsewhere d572, 0c14 (Wolven Blood layers
  held to max stacks early; d572's Corrosion ramp a step behind), de6a (a 4% buff held 0.1 s past a hit). Team-ab
  against 6b117c1: every team's fight the same.
- How well determined: 108.6 s of holds in 5,899 s of the 60 logs (1.8%), 211 units of 0.512 s, 50 placed within 1 s,
  92 within 3 s, every one spanned by a kept clock (median 3).
- SP: the holds as dodges (185, 1,295 SP) cover 87 of the 1,766 SP the replay lacks: the shortfall is where the clocks
  place nothing (04d4, 6339, db87, 79cc). Not the gap; no evidence for or against the dodge reading.
- The dodger's own 0.315 s (the data's layer 1): pairs of runs on one window, owner controlled or not, ratio median 1.12
  (62 pairs), not 0.62: no sign of a dodger's clock on its buffs.

**Decisions:** the world's clock alone: holding the operators' clocks too (slowDown, nobody exempt) moved kit-timed
landings off the log's (bdf2 lost a Nature burst to one frame of hold; verified damage error 1.9 → 3.2%). The midpoint
rather than one extreme: it's feasible and splits the uncertainty. The log's ends stay on top: they are facts, the holds
an estimate.

**Dead ends:** bounds from the run's end less the expiry in real time: holds then carried b6aa's Xaihi debuff 2.8 s past
the log's end (the stops after its old expiry held it again); world time past the expiry fixed it. The first pass kept
buffs to the log's end (its `log` ends were on) and so saw no lateness at all. A cap of world time per span dropped
489c's Si's Amp (3 s of holds inside three overlapping ultimates' stops).

**Left:** test 111; Corrosion's listed ramp levels and Wolven Blood's layers as clocks; pauses (12 units in hitless
spans) and overlapping ultimates' stops, which a dodge can't be; Gilberta's tower-boss Vulnerable stacks and Arcane's
seal unchanged by the holds.

## 2026-11-23: Four smaller leads: d774's strikes, db87's ramp, the food logs' openers, Hard 27's resistance

**Goal:** four leads with a stated next check in docs/open-problems.md: d774's Sunderblade strikes ×1.39, db87's
Corrosion ramp across overlapping stops (rule T3), 3f78 / 4a64 "−36.5% after food", Hard 27's ×1.1125.

**Found:**
- **d774:** the first strike's ×1.3858 is exactly a consumed level-1 Electrification (conductCnt 1 and one more layer
  each of Lone Barge's consume DMG and Xiranflow): the log lists Perlica's 8.75 s Electrification for 9.61 s of world
  time, to the battle skill that takes it; the replay's had expired. A hidden hold on an enemy status (the buff
  clock's open half), not a strike zone. Strikes 2–4's ×1.342 were Amp marks: the replay struck three times before
  Liino's combo stop where the log struck once.
- **Liino's combo was placed 0.6 s late in every log:** its hit 1 (frame 9, the world at 0.01) is logged where its
  own slow-down ends (hit 2 follows by a median 0.23 s, not 0.8 s; no teammate's hit in the second before it). Fixed
  in the placement (logcasts.ts `ownStopLoggedFrame`, docs/design/data.md "What the log records").
- With the stop moved, a status applied inside it lost its hold (9090's Electrification ended at 15.3 s, listed to
  16 s): the engine held buffs created in a stop (buff-in-stop) but not enemy statuses. Engine assumption
  `status-in-stop`, default `held` (clock.ts `holdNewStatuses`), `runs` the old rule.
- **db87 (T3):** the lowest scale stays. Read as resistance steps on every hit, the log's ramp runs behind the
  replay's by a growing 0.1–0.45 s (19 s) to 0.57–0.72 s (25 s); a sum would add 0.5 s at once and 0.6 s more at
  22.0–22.9 s (three combo slow-downs), past what the hits allow. A hidden hold (Si's Amp +2.49 s there).
- **3f78 / 4a64:** totals now −6.1 / +7.6% (earlier rounds). The first windows' "no level fits" ×1.013 is Corrosion's
  ramp one step ahead in the log: the replay holds it 0.2–0.3 s too long across Gilberta's, Si's and Arcane's opener
  combos (Si and Arcane pressed in Gilberta's stop). Not fixed; next check in open-problems.
- **Hard 27:** a second player's log on the stage (v59, game 1.6; imported as fixtures/pending/zmdlogs-207fff414d82.json,
  first check 0 plain of 342, −12.4%): physical ×1.112 from the first hit, Cryo and Nature ×0.890. The enemy has
  resistance 11 for every element the logs have; the table (the base template's) says physical 20, others 0. Enemy
  fact `LOGGED_RESISTANCES` (enemyFacts.ts). Then Ember (weapon level 80) and Snowshine (weapon level 20) fitted by
  `zmdlogs fit-build`, as buildOverrides.

**Scoreboard** (`npm run snapshots:update`): development plain 59.9 → 60.1%, mismatch 16.4 → 16.3%, |damage| 9.2%;
hold-out 69.6 → 70.1%, 6.7 → 6.5%, 11.0 → 10.9% (5 better, 0 worse); earlier pending (the new log among them: 24
fights) 53.1 → 54.9%, 23.3 → 19.0%, |damage| 8.1 → 8.4% (207f's −18.8% joins the mean; 2fd9 −22.9 → −19.5%, 99fb
−10.9 → −7.5%); verified 75.6 → 75.9%. Better: 2fd9 (plain 0 → 161), 99fb (0 → 155), 4360, 7910, 9c6e, fc63, 4bfc,
1d91, 00ae, 0eef, bdf2. Worse: a7a7 (386 → 351: its first Liino combo at the fight's start now ends before the
Corrosion of 3.86 s, so Si's combo stop alone holds the ramp 0.53 s where the log allows 0.42), 4d60 (−6), 3f78 (−2,
status-in-stop), 9090, 9847 and c6d8 (−1 each; knock-ons of Liino's moved stops); mixed d774 (+13 plain, mismatches
59 → 39, its over-predicted total +22.6 → +24.6%), 9a80, c3c7. Teams (team-ab against 6b117c1, seeds 1001–1032,
status-in-stop held): Estella's sustained DPS +0.08% full / −0.00% zero, Typhoeus's +0.05% / +0.04%, Typhoeus's 60 s
timeline −0.30% (full energy), the rest unchanged. Also: a7a7's INT lasers' event at 42128 ms, now 1.35 s of world
time after Arcane's combo touch, had become her combo's own event; after a combo's last landing the window is 1 s
(buffreplay.ts COMBO_EVENT_AFTER_MS; no verdict moved).

**Decisions:** the placement rule only for frozen frames (scale ≤ 0.05): counting every frame below 1 moved 4e5e, db87
and others' casts. `status-in-stop` held by default for one world clock with buff-in-stop, measured better on both
groups. The resistance is the logs' (two players, two game versions), not a per-log factor. The new fixture is a
development log in fixtures/pending; it counts as "earlier pending" until holdout.json's development list (which
agents don't open) has it.

**Left:** d774's strike count before her ultimate (the log's world holds 0.83 s, Liino's slow-down 0.61 s); the
enemy statuses' hidden holds (the buff clock); the food logs' opener; what sets Hard 27's 11 (its born buffs have no
BuffData file); Purrchena's level 1 in 99fb. Friction report docs/friction/2026-11-23-smaller-leads.md.

## 2026-11-22: The buff clock: unlogged world holds keep buffs past their end

**Goal:** what holds operators' buffs past their modelled end in some windows (Laevatain's Forgeborn and Scorching
Heart, Rossi's Wolven Blood, Gilberta's Vulnerable stacks, Liino's beats; three agents found it the same day).

**Done (open-problems "The buff clock"):** every listed run of a kit-modelled game buff over the 77 development logs
with run starts (6,991 runs): its world length (placed stops out) against the data's duration and the replay's expiry,
with what each window holds. 724 clean single runs run a median +0.49 s long, over almost every team's buffs, not
Laevatain's alone. Hypotheses scored against the table, a hidden-clock solver and the enemy's tick series:
- a listing lag: **wrong**, the damage sides with the listing past the replay's expiry (802 hits against 92);
- one hidden clock per fight: **fits**, 152 of 1,378 runs conflict (341 with the excesses shuffled), the enemy's 588
  tick pairs fit the same clock (28 dropped), and the 8 runs a tick series covers end where it says (±0.3 s);
- perfect dodges (0.512 s world slow-down each by the data, unlogged): **fits** what can be tested: the ticks' unexplained
  holds cluster at +0.42–0.56 s and come 34 times in 378 pairs outside Stagger, once in 92 inside it (a Staggered enemy
  doesn't attack); 9c0b's ten hitless seconds hold ~7.5 s, a pause;
- per-holder clocks (hit-stops, animations), overlapping stops held for their sum, a clock rate, a constant per
  ultimate or combo, the game timer pausing: **wrong** (Si's Amp ends at one ms on every holder; exact where no other
  ultimate falls inside; free ticks run at 1.000 between holds).

**Implemented:** engine assumption `hidden-holds` (default `log`, `none` the old replay; read only by the log check's
replay, buffreplay.ts `heldToLoggedEnds`): a timed kit buff whose single run the log lists past the replay's expiry is
kept on a step at a time to a frame after its last listed hit, before any holder's hit without it, within 40% of its
life. First tries extended once at the expiry: the replay's later stops then held it again past the log's end (b6aa's
Xaihi debuff to 46.9 s against 43.8), and the max over holders' runs gave Si a teammate's later end; both fixed.
Scoreboard: all but the hold-outs plain 55.7 → 57.5%, mismatch 18.8% unchanged, mean |damage error| 8.3 → 8.1%, within
5% 33 → 31 (c83c, fc63 over-predict already); development 57.8 → 59.9%, 16.5 → 16.4%, 9.8 → 9.2%; hold-out unchanged
(69.6%, 6.7%, 11.0%); development logs 14 better, 1 worse (4a64, plain 130 → 128: two Arcane hits at 16.9 s now carry a Hot Work Nature DMG instance the log doesn't list, a knock-on of another buff kept, not traced),
9 mixed (per-hit error closer in 15 of the 16 mixed logs over both groups). Simulations unchanged (team-ab against 0ab4b03: every team's fight the same; they dodge with
`--dodge`).

**Decision:** the replay takes the buff's end from the log, as it takes the Stagger windows and the bleed's ticks: it
can't place the dodges, and the damage agrees with the log. Not a kit change (no buff's duration moved).

**Left:** in-game test 111 (perfect dodges counted during Si's Amp); the holds placed once for every timer (enemy
statuses, unlisted buffs, the dodges' SP for "Team SP"); the dodger's own 0.315 s; runs ending before the replay's
expiry (~7%); Liino's beats running fast (the other direction). The hold-outs' aggregate doesn't move, so
it isn't confirmed there.

## 2026-11-22: Improvement round 5: the lock's queue, premerge's done line, diagnosis views

Goal: improvement round 5 (docs/friction/README.md, step 2) over the eleven open reports (round 4's backlog and
report, the finisher gate, the eight 2026-11-22 accuracy branches) and the lead's own friction from merging their
batch. Summary and outcomes: docs/friction-done/2026-11-22-round-5.md; what's left:
docs/friction/2026-11-22-backlog-after-round-5.md.

Done:
- premerge's last line comes from scripts/done-line.sh: "pass" only from its own end, "killed" from a signal trap.
  The false pass was bash's: a shell killed by a signal runs its EXIT trap with `$?` of the last finished command
  (0). Long steps now run in the background and are waited for, so the trap runs at once (bash defers traps during a
  foreground command) and stops them; tests/done-line.test.ts.
- The test lock: fair shares between worktrees (a worktree's n-th waiting job counts as arriving n × 20 min later),
  the estimated wait plus run against the 2 h background limit on the first waiting line, a kill in the queue named
  on the DONE line. measure and team-ab fix their code at queue time with a snapshot commit of the working tree
  (temporary index, own worktree, removed after): agents keep editing while they wait. team-ab's identity check runs
  in the short lane, its 32 seeds only for the moved teams.
- `npm run merge -- <branch>…`: a batch with one snapshots run, then `vitest related` on the code both sides changed.
- Views: `zmdlogs worldtime`, `lanes --world`, `measure --hits` and moved casts under `--changed placement`, the
  replay's EVENT lines (`loggedCastFates`, the same matcher as withLoggedCasts), fallback matches in `groups`,
  `verdictReading` in `hits --json`, `efsim assumptions`, skill groups and applications in `efsim kit`.
- Docs: batched timestamps, how the placement picks among groups sharing a key, misreadings, limits; `.prettierignore`.

Decisions: no hard one-job-per-agent cap (fair shares get the same without idling the machine); no more jobs in the
side lane (timeouts and incomparable measurements; the snapshot makes the wait free instead); `hits --json` fields
added, not renamed (scripts read `predicted`); the hold-out snapshot file stays where it is (a grep exclusion instead
of moving a file three scripts and the snapshots glob name); a replay-only buff-duration option and the `beside`
exemption for `launch` are behaviour changes, left to accuracy tasks.

Checked: `npm run measure -- --hits` at the views commit, every log byte for byte; team-ab against HEAD unchanged.

## 2026-11-22: Yinglung's Edge stack counts: hypotheses against 68 combos

**Goal:** the owner's brief: list deterministic causes for the Type 50 Yinglung's Edge count diverging from the
logs (about a third of combos, both ways), score each against every wearer combo in the development logs, iterate
on the misfits, implement a winner.

**Done:** the set's data (`gamedata tree` on its four buffs: an aura's detector on every member, a layer to the
wearer on that member's battle-skill cast, cap 3, no duration, the wearer's combo takes all). Per combo the layers
the damage implies (both readings' DMG-bonus gap in 0.2 units; Jade Vessel's 0.3–0.7 separates as it isn't a
multiple of 0.2): 68 Si and Bounda combos decided, the rest left out with named non-Edge causes. Thirteen first
hypotheses and two new ones scored (open-problems.md "Type 50 Yinglung's Edge", the table): the engine 52 exact /
4 first-combo lower bound / 12 wrong; every logged cast 58 / 0 / 10; without Si's hitless presses 55 / 4 / 9;
expiries, own-only, teammates-only, ultimates, any wearer's combo clearing, first-hit timing all worse. The
misfits suggested two new causes: **N2** Si's first press after her battle skill counts (Initial Stroke under
Artful Intent) and her other periodic presses don't; **N1** layers are lost over a pause with no hit (3f78 and 4a64
after ~20 s, 7b54 after 5.9 s; abfd keeps them over 4.9 s): together 64 / 1 / 3.

**Replay fix (buffreplay.ts):** a Final Stroke inferred from the mark's own burst (the kit's no-Inksoul branch,
where Final Stroke can't be cast) is now an expiry (an `expires` step, no cast): 0c14 81.7 and 489c 107.6 3 → 2;
the engine 54 / 4 / 10. Scoreboard (`npm run snapshots:update`): verified and hold-out unchanged, development plain
52.0%, earlier pending 48.9 → 49.0% plain; 489c mismatches 120 → 113, 0c14 plain 123 → 133; no log worse. Tried and reverted: making Laevatain's Twilight battle skill once where the replay makes it
twice (the `normal_skill` event and the placed `normal_skill_during_ult`, db87 41.2 3 → 2, plain 114 → 126): the
same static rule broke Purrchena's battle skill and counter (04d4); the replay's state has to decide.

**Decisions:** N1 and N2 not built into the engine: N1 needs "leaving battle", which the log doesn't record and the
simulator's fights don't have (test 106 (e) asks the owner); N2 in the replay means making every press under
Artful Intent the stroke the slot holds, and the replay's Artful Intent outlasts the game's (its Inksoul-burst
Final Strokes 2–3 s after the last press fit the expiry better), so it waits on that. Estella's five single-hit
combos don't decide anything (her Razorhorn ATK was fitted on the same hits).

**Left:** c779's moved layer, 0c14 166.7 (two layers and Jade Vessel short); the replay's stroke reading (Final
Stroke only with a press just before the burst; Initial Stroke at the first press). In-game test 106 now asks only
(e) a pause / leaving combat and (d) whether Final Stroke gives a stack.
