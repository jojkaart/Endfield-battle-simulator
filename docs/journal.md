# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 172 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-27: Placement cases: entity landings by their span, presses in away stretches, used-up casts by value

**Goal:** the placement and cast-assembly cases the two one-sided rounds left (docs/open-problems.md "Log-only
landings", "Replay-only landings"): f879 95.10 s, 5082 45.06 s, 3aa6 125.65 s, Pogranichnik's harasses, 99fb's bleed
ticks, Arcane's INT lasers, 9a80 34.94 s; beside an agent on status pairing (buffreplay.ts theirs).

**Done** (docs/open-problems.md "The placement cases the one-sided rounds left"; tests/placement-cases.test.ts):
- **An ability entity's landings are due within the slots' span** (logcasts.ts onEntityClock): a key's next landing
  joined the open cast while it had slots to come within the skill's whole duration (9.4 s for Laevatain's battle
  skill). An entity's landings (`launch`; no flight, buff timeline, enemy delay or random count; not a buff's key) come
  at their own frames whatever the cast does. f879: the 94.71 s Magma Fragment explosion had been the 87.12 s cast's
  first tick (that cast's ticks unlogged; their radius, 2.5 against the explosion's 3, is one possible reason), so the 95.94 s empowered hit made a
  battle skill at 92.48 s, before her final strike's Heat absorption at 92.49 s; now one cast at 93.98 s with 4 Melting
  Flame, and the 162,889 lands. Also 6339 31.62 s, Zhuang Fangyi's attack 2 / 4 ranges in 3aa6 and 4bfc. Rossi's
  combo afterhits (a buff's timeline, 9a80 29.20 s) are left out: measured first without that, 9a80 lost 64 plain.
- **A slot press whose first landing is due in an away stretch is `unseen`** (castassembly.ts, awayWindows), **made as
  the button's variant the kit holds** (replayrun.ts replayedSkill): 3aa6 125.65 s, Zhuang Fangyi's Empyrean battle
  skill 0.08 s after the last hit before a 14 s gap; its Sunderblade is the 145.74 s cast's ninth, the 148.68 s final
  of 9 lands.
- **A second landing at a used-up cast's last ms isn't the same landing on a second enemy when both are non-crits in
  the ratio of slot 0's multiplier to its slot's** (logcasts.ts nextByValue): 9a80 34.94 s, Si's final (349,888) and
  her next combo's first slash (28,396); the 36.10 s final now on its slot. First by the values' ratio alone: 9c6e (two
  targets under one id, their values ×1.3+ apart by their own debuffs) lost 36 plain while its total went −20.6 →
  −0.9%, the second target's landings made as casts of their own: the wrong mechanism.
- A press made in an away stretch takes what a cast takes: 7b54's Si at 24.81 s (21.06–26.98 s without a hit, the
  slug) is made as Initial Stroke and takes the team's Link stack her 29.00 s cast had (7b54 +40.3 → +40.4%).

**Scoreboard** (`npm run snapshots:update`): development plain 81.5 → 81.7%, mismatch 6.3%, mean |damage error| 3.4%,
as other kit hit 96 → 93, |matched| 2.4 → 2.3%, replay-only 3.6 → 3.3%, log-only 3.1 → 2.9%; earlier pending plain
81.6 → 81.7%, log-only 0.9 → 0.7%, as other kit hit 58 → 50; hold-out and verified unchanged. Better: f879 (plain
793 → 821, mismatch 15 → 6, per hit 1.86 → 0.62%; total 0 → +1.5%: the missing 162,889 had cancelled over-predictions),
6339 (−14.1 → −12.6%), 9a80 (277 → 279), 3aa6 (413 → 416, per hit 3.56 → 2.70%), 4bfc (856 → 861). Worse: 7b54 +40.3 →
+40.4% (below). Log tools only: no simulation reads them, no team-ab.

**Decisions:** the entity rule as "no toCome" rather than a new bound: the slots' span plus CAST_SLACK_MS is the bound
the pass already has for every other landing. The away test beside the ±1 s quiet test, not instead of it.

**Dead ends:** the replay's JUMPDROP leaving out landings launched before the jump (engine drivers.ts; f879's ticks
dropped her empowered jump): no development log moved, one hold-out −23 plain, dropped
(docs/tried/2026-11-27-jump-launched-landings.diff). Yvonne's chain window held by the hidden holds: they sit spread
over 1.5 s mostly before her cast (3 of 15 frames), not built.

**Left:** 5082's Yvonne (her timeline held ~0.5 s at her combo's Stagger break, 44.43 s; a break dilation the data
names, enablePoiseBreakTimeDilation, with no length), Arcane's INT lasers (the log's batched ms), Pogranichnik's
harasses (the entity's own 0.4 s slow-downs and teleport, not modelled), 99fb's bleed after Rossi's ultimate (the
statuses' side).

## 2026-11-27: Replay-only landings: kill gaps, basic tails, tails kept by another cast's buff, finals by value

**Goal:** the replay-only side of the fight totals (docs/accuracy.md "Where the total's error lives": development 4.5%,
hold-outs 4.0% of a fight's logged total): landings the replay makes that the log never shows, sorted by kind, operator
and skill over every development and earlier-pending log, the recurring causes fixed by mechanisms from the data or
the logs. Known leads: 207f's Rossi attack-4 tail, d774's Zhuang Fangyi battle skill at 103.28 s, 4bfc.

**Done** (docs/open-problems.md "Replay-only landings"):
- **A logged kill's gap** (engine assumption `kill-gaps`, default `absent`; enginecheck.ts killGaps, replayrun.ts): a
  hit capped at the HP left before the fight's last hit is a kill (a life, a phase, one of several targets), and until
  the next logged hit the replay's enemy is away, 0.15 s inside both ends (KILL_EDGE_MS). 9c6e 63.34–67.64 s
  (Typhoeus's 160k burst), the slug's caps in 6339.
- **Basic attacks' tails cut** (`unlogged-tails` `cut-all`, the new default): 207f's Rossi attack 4 hit_ai (two of
  five logged, twice).
- **A tail is kept only by a buff run its own landings start** (tailCuts): d774's battle skill at 103.28 s had been
  kept by a gear set's team ATK from Arcane's ultimate hit 2 frames before a tail strike.
- **Si's combo final placed by value** (logcasts.ts nominalScales: the multipliers of a value expression over event
  counts 1–4): 6339's logged final at 11.31 s now on the final's slot.
- **Typhoeus's burst across stops the pass misplaced** (logcasts.ts joinDelayed, stackedHeldMs): fc63 43.58 / 87.81 s
  no longer open shots the log doesn't have (also the log-only round's fc63 87.87 s case).
- tests/replay-only.test.ts (five tests).

**Scoreboard** (`npm run snapshots:update` after merging main at 5637d06; `measure --base 5637d06` for this branch
alone): development plain 81.5% (unchanged), mismatch 6.3%, mean |damage error| 3.2 → 3.4%, replay-only 4.5 → 3.6%;
hold-out plain 82.6%, mismatch 5.5 → 5.4%, mean |damage error| 7.1 → 6.3%, replay-only 4.0 → 2.9%; earlier pending
plain 81.5 → 81.6%, 1.6 → 1.3%; verified unchanged but 4e5e −2.9 → −3.0%. Better: d774 (plain 392 → 409, +5.8 →
−0.6%), fc63 (513 → 523, 3.6 → 3.2%), 207f (+1.6 → +0.4%), 7b54, 012a, and 15 development logs closer in total. Worse:
9c6e (−13.9 → −20.6%, plain 202 → 200: its two capped kill bursts at 79.85 s, whose readings mean nothing, plain →
assumed) and 6339 (−8.0 → −14.1%, plain 112 → 114, per hit 30.4 → 21.5%): both under-predicted fights whose log-only
side (−38%, −26%) the removed landings had cancelled; 5082, db87, 9090, 4360, a9d7, 9847 by 0.1–0.5 points (unlogged
basic tails gone from under-predicted fights); 4a64 −2 plain (two logged attack-4 hits that had matched the cut tail's
landings 0.30 s later). No simulation reads any of it (log check only): no team-ab.

**Decisions:** the kill gap's 0.15 s edges because without them one hold-out lost 13 plain (logged landings a few
frames off the next logged ms) for a better total (`tight`, 5.4%); `cut-all` because a basic attack is cut by the same
unlogged inputs a skill is, and the measure (14 closer, 6 further, all six under-predicted) is the earlier one's with
the totals since read right. The final's value range kept though its total effect is negative in 6339 and one hold-out:
the per-hit error and the verdicts improve, the total had been right by a replay-only final cancelling a second copy.

**Dead ends:** a value of unknown crit fitting a slot up to ×3 above it (9a80's final at 36.10 s): +1 plain, one
hold-out's total 0.5 points of the mean worse, docs/tried/2026-11-27-unknown-crit-slots.diff; logged gaps of 2.5–6 s as
away (no rule from length alone: 21 of 119 have replay-only landings, mostly small).

**Left:** the slug's unlogged hits (6339's hit_2 at 21.60 s, 7b54's Laevatain combo and overlapping Si combos: a shield
no log lists), 9c6e's second target, 9a80's final; the log-only round's placement cases f879 95.10, 5082 45.06, 3aa6
125.65 s, Pogranichnik's harasses, 99fb's bleed ticks, Arcane's INT lasers (not reached).

## 2026-11-27: Log-only landings: Typhoeus's Signs, Zhuang Fangyi's Sunderblades

**Goal:** the log-only side of the fight totals (development 3.2% of a fight's logged total, hold-outs 5.1%): the
landings the log shows that the replay never makes, sorted by kind, operator and skill, fixed by mechanisms; beside
an agent on the replay-only side (placement and cast-assembly files theirs).

**Found** (docs/open-problems.md "Log-only landings"): two thirds of the development log-only mean is 9c6e (−37.8%,
two targets under one enemy id) and 6339 (−25.6%, the slug); the other 54 fights −1.0% each, spread. By cause: a
counted resource one short (fixed below); bursts and Combustion ticks 0.55–0.85 s later in the game than in the
replay, held there by a stop starting 0–300 ms after the replay's burst about half the time, both ways at the same
offsets (scripts/probes/bursts/burst-before-stop.ts: 13 held, 16 not, 11 unclear): the replay's precision, no rule;
placement and cast-assembly choices (fc63 87.87 s, f879 95.10 s, 5082 45.06 s, 9a80 34.94 s, 3aa6 125.65 s,
Pogranichnik's harasses, 99fb's bleed ticks); Arcane's INT lasers started from the logged combo event (8915, 00ae,
a7a7). The hold-outs' largest log-only kind is physical statuses the replay never deals (2.08%); every development
one but 5 of 335 has a landing, so it is not reachable from these logs.

**Done:**
- **Typhoeus's burst Signs by source** (kit assumption `typhoeus-sign-cooldown`, default `by-source`):
  passitive_enemy_listennaturalspellbrust makes arrow_energy_buffer_1 or _3 by a tag only her files use, two identical
  buffers each with its own 0.2 s adding cooldown. 1d91: Arcane's burst at 11.79 s and hers at 11.90 s both give a
  Sign, so her 28.68 s combo has the 8 it needs (7 under `shared`, the old kit), four Hunting Arrows, and the 4th shot
  at 39.72 s is a Power Shot with its 40.03 s burst, as logged. Every other Typhoeus log has 8 Signs at each combo under
  both readings, but dbae (7, its fight-start Signs), fc63 101.87 s (a burst placed 0.48 s early) and 9c6e.
- **Zhuang Fangyi's 3 s Sunderblade floor** (trigger bs_floor; engine `extendBuff` `atLeast`): both battle skills'
  frames 0–3 set every Sunderblade with less than 3 s left to 3 s (SetAbilityEntityDuration, batch-4 G6). d774 68.21 s:
  the 29.57 s blade, 1.15 s left at the 64.72 s cast, strikes in the next one: 7 strikes and the 97,192 final, exact.
- tests/kit-zhuangfy.test.ts, tests/buffreplay-typhoeus.test.ts; tests/logcasts.test.ts's d774 bound under `away`
  8 → 9% (the three hits now landed).

**Scoreboard** (`npm run snapshots:update`): development plain 81.4 → 81.5%, mismatch 6.3%, mean |damage error| 3.1 →
3.2%, one-sided fights 25 → 24, log-only 3.2%; earlier pending plain 81.4 → 81.5%, mismatch 7.6 → 7.5%, 1.6%, within 5%
22 → 21; verified and hold-out unchanged. Mixed: 1d91 (plain 352 → 354, mismatch 194 → 193, per hit 3.97 → 3.86%,
total +0.3 → +2.6%) and d774 (388 → 392, 13 → 10, per hit 2.98 → 2.78%, +4.9 → +5.8%): in both the log-only hits had
cancelled over-predictions elsewhere (d774's 103.28 s Empyrean cast, open). Typhoeus's row: median |damage error|
1.4 → 0.8%; Zhuang Fangyi's plain 86.7 → 87.0%, mismatch 3.7 → 3.4%.
team-ab against 896bb86: Estella, Si, Akekuri, Arcane unchanged (both energies); Typhoeus's team sustained full −0.38%,
zero +0.44% (within one sd), its zero bot −4.0%.
**The bot's −4.0% is the Sign reading's, and a correct consequence** (`efsim rules … --seeds 1 --assume
typhoeus-sign-cooldown=shared` gives the base's 58,952 exactly; no Zhuang Fangyi in the team, so not the floor): the bot
(reaction 0) is one deterministic 300 s run. Its presses are identical to 137.17 s; there Arcane's Nature burst at
136.43 s and Typhoeus's at 136.57 s both give a Sign, her 8th one shot sooner, so her combo window opens and rule 3
casts the combo at 137.17 s instead of after her 3rd shot at 137.43 s (one shot fewer, Perlica's ultimate 0.26 s
sooner). The run then drifts: damage is the same to 120 s, −3.7% in 120–180 s, unchanged 180–240 s, −14% in 240–300 s,
where Liino's ultimate at 276.97 s no longer comes before the fight's end (Liino −21%, Typhoeus −3.6%). The same pair
at 75.87 / 76.00 s changes nothing (her Signs were already at 8). The bot choosing differently there is the mechanism
(the rule list casts the combo as soon as it opens); the −4% is one path's fight-end luck, not the reading's value: the
32-seed means move +0.44 / −0.38%, within one sd (scratch/bot.ts, not kept: a single-run trace).

**Decisions:** `by-source` the default: the one log that decides between the readings decides for it, and nothing in
the data says the tag is the enemy's. The floor as a kit trigger on the cast at frame 0, the data's own clip.

**Left / not done:** the status landings' pairing (nearest in time order, 16 frames) as an assignment by value
(buffreplay.ts, neither agent's file this round); Arcane's INT lasers' start; the placement cases above (the other
agent's).

## 2026-11-27: Improvement round 17: numbers that move, questions across logs, one cause per line

**Goal:** improvement round 17 over the five open friction reports (Arcane's stage factors, round 16's own, away
statuses, exposed totals, Zhuang Fangyi and Liino) and round 16's backlog; every file the round's
(docs/friction-done/2026-11-27-round-17.md has the details).

**Done:**
- **Numbers that move:** two describing snapshot keys, `other-hit operator <id>` (hits matched only as their event's
  other kit hit: the class that hid Zhuang Fangyi's attack 4) and `stage` (enginecheck.ts stageFight); the
  scoreboard's by-operator table names each operator ("chr_0032_lizhiyan (Arcane)"), with "As other kit hit" (per
  group too: development 100, hold-outs 19) and "Without stage fights"; `zmdlogs groups` prints the count and casts
  first, and mismatches inside a fight-wide factor stretch apart.
- **Across logs:** `node scripts/cli-ab.ts <ref> --placement` (every log's CAST/HIT lines that differ, by rule and
  operator, 12 s); `efsim zmdlogs away` (31 stretches: 2 pause, 11 runs on, 4 mixed, 14 no clock); BATCH in `zmdlogs
  decisions` (20 in 10 logs); `zmdlogs offsets --all` ends with the factor stretches no fixture holds (14 in 8 logs).
- **One cause, one line:** `totals`' total ÷ Max HP and kill kind; `hits --against-hit`; stageNote in `replay` and
  `bursts`; the CAST line's `[paths: …]`; holds' WIDE units; `--kit-buff` by an owner's name; kit-census's dead kit
  buffs; groups' log-only buffs.
- **Paperwork and helpers:** `friction.ts carry --lists [--park] [--drop]` (this backlog made with it), "done but
  <part>" outcomes, tests/helpers/replay.ts fakeReplay, packages/logs/src/labels.ts; tests/logcasts.test.ts split (56 s
  → 29 + 33 s).

**Checks:** `npm run snapshots:update`: "No log's verdicts moved", "keys added only in 45 log(s) … other-hit operator
<id> ×58, stage ×8"; docs/accuracy.md's old columns identical row by row. team-ab against 44a72be (an engine reading's
description changed): unchanged.

**Decisions:** the names come from the game data's cache (the snapshots stay the scoreboard's only numbers);
`isDescribingKey` holds every kind that isn't a verdict, and a hold-out's moved key is printed by kind (a lone `share
operator` key named its id before). The away probe is deleted, the view cited in its place; the stage probe stays
(the docs cite its numbers). The verdict of an away stretch is "pause" when most clocks ask half its length, "runs on"
when every one asks under a quarter.

**Left** (docs/friction/2026-11-27-backlog-after-round-17.md): a layered buff's per-layer clock; the recorded Stagger
start parked; on the accuracy list the element mask of log-only buffs and the 14 factor stretches (7b54's slug first).
CLAUDE.md lines for the lead in the round's summary.

## 2026-11-27: Exposed totals: stage Electrification, kills, Rossi's combo 3

**Goal:** the fight totals that rose once the attack-4 round read hits right (207f +5.5%, 3aa6, d774, 9847, a9d7),
split by operator and landing kind and fixed by mechanisms; 3f78's Rossi combo 3 at 50.55 s, made inside combo 2's
uncuttable frames (docs/journal/2026-11-27-01-zhuang-fangyi-s-attack-4-and-liino-s-silent-stance-ends.md).

**Done:**
- **Hard 27's stage Electrification is Arts DMG Taken only** (enginecheck.ts logOnly, stageElements): the log lists it
  without an element and the check added it to every hit; buff_common_pulse_pulse_conduct_triggered_do reaches
  CheckDamageTypeMask 92 (Arts), physical only with `if_contain_physicdamage` = 1, which nothing in the data sets. 207f's
  physical hits 21–36 s (Rossi's attacks, combos, bleeds, Gilberta's set) read ×0.847 = 1.33 ÷ 1.57 with it, plain now.
- **A kill from a stage-scaled total** (enginecheck.ts stageScaledKill): 207f's logged total is 5.7600 × the data's Max
  HP, its last hit without an `uncapped` value; every capped single-life kill in the development logs sits within 1.3e-5
  of a two-decimal multiple (scripts/probes/totals/stage-kills.ts), 5082 (×7.6000) is the other uncapped one. The totals cap
  the killing hits (Rossi's ultimate final: 1,134,403, predicted 1,218,124), loggedEnemyHp reads the HP, and the check
  leaves a killing hit unjudged where it reads above its value (logcheck.ts killingBlows `capOnly`).
- **Rossi's combo 3 on its jumped path** (logcasts.ts jumpedFirst): placed by its perfect hit (frame 29) it started at
  49.59 s, 13 frames before combo 2's window (frame 37); its late hit (227, 15 after the jump 0 → 212) puts it at
  50.05 s, where the perfect-timing ring (combo 2's frame 52) isn't on yet, so the kit's own condition jumps. No INSIDE,
  no JUMPDROP, no extra Vulnerable: Gilberta's 58.90 s ultimate Susceptibility 0.39, the log's. The rule takes the
  twin's slot only where the skipped path's start is before the operator's previous cast lets the skill start.
- tests/logcasts.test.ts (three tests).

**Scoreboard** (`npm run snapshots:update` after merging main at 0b68614, the away stretches; `measure --base 0b68614`
for this branch alone): development plain 81.0 → 81.4%, mismatch 6.4 → 6.3%, mean |damage error| 3.3 → 3.1%, within 5%
27 → 28; hold-out unchanged (82.6%, 5.5%, 7.1%); earlier pending unchanged (81.4%, 7.6%, 1.6%;
abfd mismatch 2 → 1). Better: 207f (plain 269 → 308, mismatch 16 → 3, +5.5 → +1.6%), 3f78 (plain 114 → 151, 0.9 →
0.2%); 5082 adds a time to kill. No log worse. Rossi's row: plain 74.2 → 76.6%, mismatch 5.1 → 4.6%, mean |damage
error| 1.8 → 1.3%. No engine or kit rule changed (log tools only): no team-ab.

**Decisions:** the stage kill by the total, not a list of stage factors: the factors differ per stage and per version
(hdg027 ×5.28 in 2fd9 / 99fb, ×5.76 in 207f), the grid is what they share. The combo-3 rule asks the kit's windows,
not the Stagger: every logged combo-3 hit has Stagger 5 (poise_f), perfect ones too.

**Dead ends:** the Stagger value as the path's evidence (above); d774's +4.9% (Zhuang Fangyi's first Empyrean battle
skill at 103.28 s: 3 strikes, no final, in the log; neither blades, an attack's cut nor half a life's HP explain it:
docs/open-problems.md "The totals that rose once hits read right").

**Left:** d774 103.28 s; 3f78's team-wide ×1.017 after 50.55 s (Corrosion's ramp late in the replay: the enemy's
clock); a9d7's Chen −3.0% (spread, Pogranichnik's team buffs on her combo); 207f's Rossi attack 4 hit_ai tail (+1.3%).

## 2026-11-27: Away stretches: a whole-game pause holds every timer, a boss phase none

**Goal:** three leads on the enemy's clock: do enemy statuses run on, pause or something else while the enemy is away
(4d60 43–60 s, Zhuang Fangyi's Sunderblades); Liino's stance ending before its last beat (4d60 66–73 s); 8915's
Corrosion step and Hot Work end early after two combos pressed together (7.07–8.90 s).

**Done:**
- **Every away stretch of the development logs read by its clocks** (scripts/probes/away/away-clocks.ts: the hold
  placement's clocks listed on both sides of each stretch, their asks, the basic strings across it). 31 stretches in
  11 logs. 4d60's two are whole-game pauses: Arcane's string goes on across both (attack 2 → attack 3 after 9.6 and
  7.2 s) and every clock spanning them, the enemy's statuses and the team's buffs alike, runs past its end by most of
  the stretch. The other 29 (Si's phases, eny_0125_fdcentur, eny_0128_babyents_hdg031) run on: asks −2.8 to +3.2 s,
  no string goes on. No difference between enemy statuses and team buffs in either kind, and no enemy-kind rule (4d60's
  enemy is in 16 other logs with no away stretch): the pauses are the player's.
- **Engine assumption `pause-holds`, new default `paused`** (holdinputs.ts runBounds, holds.ts statusBounds,
  pausedBound, gapsWithin): a clock's run across an away stretch may ask the stretch's length past HIDDEN_HOLD_SHARE of
  its life, and a bound asking past its share is laid inside the stretch, so the least total sits in the pause (8.4 s
  in 27.67–36.46 s), not spread over 21–46 s as the bare relaxation placed it. Perlica's Electrification is then on for
  Zhuang Fangyi's 37.00 s combo, and her battle skills strike 6, 8, 8 times as logged. Liino's stance is held by the same
  pause and runs to her 73.37 s event: lead 2 was this pause too. tests/holds.test.ts, tests/replayrecord.test.ts.
- **8915's lead at the log's grain:** the game's first Corrosion step comes ≥ 0.15 s before the stop list allows (0.08 s
  from the battle skill's cast event: its hit sits in a batch), later steps 0.00–0.08 s, Hot Work's end ≥ 0.05 s.
  Pressed-together combos elsewhere don't hold less: 16 clocks across two combos within 0.3 s run late as single ones
  (+347 ms median, Σ residual ÷ Σ held 0.82 against 0.86; scripts/probes/combo-hold/combo-pairs.ts). Not built.

**Scoreboard** (`npm run snapshots:update`): development plain 80.0 → 81.0%, mismatch 6.8 → 6.4%, mean |damage error|
3.3%; hold-out, verified and earlier pending unchanged. Only 4d60 moved (mixed): plain 822 → 987, mismatch 108 → 54,
per-hit |error| 4.97 → 1.71%, total −1.2 → +1.7% (Zhuang Fangyi's matched +8.1% had cancelled her 0.59M of log-only
blade hits; now +1.5% with none). The log check's replay only: no simulation reads `pause-holds`, so no team-ab.

**Decisions:** the clocks decide a pause, not the enemy or a flag: a pause holds what spans it, a phase holds nothing,
and the placement places only what the clocks ask, so the Si phases need no exception. The bound past its share goes
into the stretch because nothing else can hold a clock that long; within its share a bound stays as it was (the 117 s
pause was already placed there by 13 clocks).

**Left** (docs/open-problems.md "Away stretches: a pause or a phase", "Zhuang Fangyi's and Liino's mismatches"):
4d60 69.35–69.84 s, Zhuang Fangyi's Xiranflow layers held 3.0 s by the stops in 43–69 s where the game holds them
0.6–1.2 s (exposed by the pause: the 43.17 s consumption now takes level 2); her 73.37 s combo with the stance's ATK
one frame too long; 8915's step (the two combos' placement, the batch's application time).

## 2026-11-27: Zhuang Fangyi's attack 4 and Liino's silent stance ends

**Goal:** Zhuang Fangyi's (65.4% plain, 16.2% mismatch, 86% of her fights' damage) and Liino's (15.5% mismatch,
share-weighted |error| 15.1%) recurring mismatches, with mechanisms from the data or the logs.

**Done:**
- **Zhuang Fangyi's attack 4 was placed as attack 2 in every log of hers** (125 hits ×3.125, all "fallback", so no
  headline number showed it; `zmdlogs groups`' cast list did). Attack 4 spawns attack 2's range entity, one key for
  both. logcasts.ts choose: a skill's own start from its other keys anchors one cast only (attack 2's from its
  travelling swords, 0.7 s late, had taken every range hit within 1.5 s); at one logged ms the keys of one group are
  placed first (attack 3's swords then say the step); a step through an unlogged basic step by both windows' sum (her
  attack 3's swords missing); a landing on its way isn't an older cast's once a newer cast with its key started and it's
  overdue by its frame (3aa6 106.11 s). Tried and dropped on the way: a time bound on every launched entity's next
  landing (f879 +30 plain, but Yvonne's combo field in 5082, held 5 s, split: +7%) and the newer-cast cut without the
  overdue test (Yvonne's ultimate shots).
- **Liino's Vocalist linger removed:** its CreateBuffAction is disabled in the data (`gamedata tree
  buff_chr_0035_liino_normalskill_buff_atkup`); 9847, 0eef and 4d60 read without one.
- **An unlogged End Stance from her beats** (castassembly.ts silentExits): no log has her basic attacks inside a run of
  beats; after the last logged beat and the landings of her casts since, before a basic attack (9847 28.83 s).
  tests/logcasts-chains.test.ts, tests/kit-liino.test.ts.

**Scoreboard** (merged main at 22367af, the stage factors; `measure --base 22367af` for this branch alone):
development plain 79.2 → 80.0%, mismatch 6.9 → 6.8%, mean |damage error| 3.1 → 3.3%; hold-out plain 82.2 → 82.6%,
mismatch 5.6 → 5.5%, 7.1%; earlier pending plain 80.6 → 81.4%, 7.7 → 7.6%, 1.5 → 1.6%. By operator (against 22367af):
Zhuang Fangyi plain 71.4 → 79.2%, mismatch 8.3 → 7.1%, mean |damage error| 2.1%, median 1.7 → 1.0%; Liino plain 80.1 →
82.8%, mismatch 4.7%, mean 10.1 → 9.9%, share-weighted 9.0 → 8.7%. Better: 4bfc 821 → 856, 4d60 806
→ 822, 9847 304 → 413 (per hit 4.7 → 2.3%), 3aa6 402 → 413, c6d8 467 → 507, 8915, 1cd1, f879, two hold-outs. The
totals that rose (207f +1.2 → +5.5%, 3aa6, d774, 9847) are hits now read right exposing over-predictions elsewhere (per
hit closer in every one: 207f 8.3 → 3.3%). Worse: 3f78 147 → 114 plain (Rossi's combo 3 now the log's, by its
Stagger origin, made inside combo 2's frames; its perfect path's Vulnerable gives Gilberta's 58.90 s ultimate one stack
more than the log's 0.39), 9090 −1, 4d60's 66–71 s (−16 inside the +16: the stance runs out before its last beat,
which the linger had covered). team-ab (Typhoeus's team, the linger): sustained DPS −0.15% full, −0.11% zero.

**Left** (docs/open-problems.md "Zhuang Fangyi's and Liino's mismatches (2026-11-27)"): 4d60 43–60 s, Zhuang Fangyi's
Sunderblades (Electrification lost across the enemy-away stretch 27.4–37.0 s); Liino's stance on the beats' clock; her
Medicant layers on Arcane in 1d91; Rossi's combo 3 Vulnerable; 8915's clock lead (not looked at).

## 2026-11-26: Arcane's mismatches: a stage's damage factor from the fixture

**Goal:** the by-operator table's largest pool of mismatches, chr_0032_lizhiyan (5688 hits in 40 fights, 12.3%
mismatch, share-weighted |damage error| 13.0%), grouped by cause and fixed. The brief called her Akekuri; the numbers
and the file are Arcane's (Akekuri is chr_0019_karin: 202 hits in 2 fights, no mismatch), so Arcane was the work.

**Done:**
- **Grouped** (`zmdlogs groups --operator Arcane`): 697 mismatches, 492 of them 8915's (292) and c6d8's (200), the two
  stage logs whose every hit sits at one round factor. scripts/probes/stage/stage-factors.ts (runs of hits at one
  team-wide logged ÷ reading over every log): 8915 ×0.500 to 37.71 s (228 of 261), ×0.050 at 38.45–39.72 s (15 of 15),
  ×0.200 at 41.01–85.93 s (274 of 285), all four operators; c6d8 ×0.100 from 15.75 s to the boss's Stagger break at
  75.59 s (334 of 413). Nothing else in any development log is a round factor (the other runs are buffs: 1d91, fc63,
  4d60, 7b54's slug).
- **A fixture's `stageFactors`** (zmdlogs.ts StageFactor, schemas/log-fixture.schema.json; hand-written windows with
  their evidence, as buildOverrides are): enginecheck.ts `stageModifiers` puts the factor into the multiplicative zone of
  every reading of a hit logged in the window (readingBasis), of the log-listing readings (logcheck.ts) and of the
  replay-only landings in the fight's totals; the `replay` view's LAND lines show the staged damage beside the replay's
  own. tests/stage-factors.test.ts. c6d8's OFFSETS_EXPLAINED entry (Perlica ×0.1) dropped: no offset left.
- Arcane's mismatches 697 → 233.

**Scoreboard** (`npm run snapshots:update`): development plain 76.2 → 79.2%, mismatch 10.2 → 6.9%, mean |damage
error| 4.9 → 3.1%; earlier pending plain 77.7 → 80.6%, mismatch 11.3 → 7.7%, 3.4 → 1.5%; verified and hold-out
unchanged (no fixture there has the field). Better: 8915 (plain 157 → 651, mismatch 614 → 67, +62.3 → +6.8%), c6d8
(125 → 467, 436 → 14, +43.9 → +0.5%); no log worse. Arcane's row: plain 77.8 → 85.1%, mismatch 12.3 → 4.1%,
mean |damage error| 9.2 → 4.2%, share-weighted 13.0 → 2.8%. No kit or engine rule changed: no team-ab.

**Decisions:** a fixture field, not a rule the check infers: the factor comes from the hits' values, which the check
grades, so it is written once, reviewable, from all operators' hits at once and at round values (×0.5, ×0.05, ×0.2,
×0.1), and never fitted per hit or per operator. Hold-outs get none (they aren't opened); their stage logs, if any,
stay uncheckable, which keeps their row honest. A window runs to the next window's first hit; c6d8's ends at the
break (roadmap-details had "the Abyss boss's ×0.1 until its Stagger"). Not simulated: no data gives the shields.

**Left** (docs/open-problems.md "Arcane's mismatches after the stage factors"): 1d91's ×0.965 / ×0.929 / ×0.894
steps (Liino's lane: her buffs unlisted there), fc63's Corrosion 89–110 s (`window-reaction`, test 33), 7b54's slug,
9c6e's two targets; new in 8915 now that it reads: a Corrosion ramp step and Hot Work's Nature end 0.1–0.3 s earlier
in the game than in the replay after Liino's and Si's combos pressed together (7.07–8.90 s).

## 2026-11-26: Improvement round 16: views per moment, neighbours, base rates and records

**Goal:** improvement round 16 over the five open friction reports (Arcane's Doubles end, her WILL lines, a stop's
batched landings, round 15's own, slots and paths by value) and round 15's backlog; every file the round's
(docs/friction-done/2026-11-26-round-16.md has the details).

**Done:**
- **Per moment:** `efsim zmdlogs ends <fixture> [--at s]` (endsview.ts): the runs ending at a logged moment and those
  going on, a purge's shape and loggedPurges' reading, the moment spacing; `zmdlogs lanes` prints the spacing and the
  cast events within it beside each end; a batched ms's Stagger bars on `replay` / `casts` lines and a BATCH line
  where the replay's order differs (c4f3 7.05 s: Estella's first Lift lands before her ultimate in the replay, after
  it by the bars: on the backlog's accuracy list).
- **Neighbours and base rates:** `zmdlogs hits --same-listing <s>` (the nearest hits with the very same listing and
  their verdicts) and `--listed <regex>` (the entries' sources, sinces, values); `zmdlogs boundaries` (per kit buff and
  side, how its boundary hits read); open-problems' header asks a listing candidate to name its neighbour.
- **By value:** `zmdlogs clock` pairs an instance with the run of its own value (BuffTrace.values), a refreshed run
  across its start included (e82d's first Doubles instance now on its 0.1794 run from 3.98 s, not the talent's 0.197).
- **Records:** `replay --trace-stack owner:stack`; `replay --kit-buff … --against-lanes`; BOTHPATHS decisions (engine
  drivers.ts `keptSkipped`, record only; none in the development logs now).
- **Smaller:** the Stagger bar's direction documented; `gamedata tree` prints stackingType readings
  (docs/game-data-format.md "stackingType readings"); bash-guard says a refused chain ran nothing, `--check-file`;
  `measure --split files` puts a new export and its users in one part; `fit-build --pairs` (04d4's Snowshine: no
  single change, 26 pairs, 7 distinct ATK values: undecidable by the logs).
- **The by-operator share:** `share operator <id>` per fight, a describing snapshot key (the brief allowed one), and
  the scoreboard's by-operator table's median, share-weighted |error| and mean share (Liino: mean 16.7%, median 5.7%);
  snapshots.ts prints "keys added only".

**Checks:** team-ab against 33c3248 after the engine record: unchanged. `npm run snapshots:update`: "No log's verdicts
moved", "keys added only in 74 log(s) … share operator <id> ×294"; docs/accuracy.md's existing numbers the same.

**Decisions:** a new view where a question spans buffs or sides (ends, boundaries), a flag on an existing one where it
is one fact more (the grain on lanes, bars on LAND lines). The clock keeps its old rule where no value matches or none
was traced. The Snowshine probe stays: open-problems cites its count on two nodes, which the view's "build as read"
doesn't reproduce. BATCH stays out of `decisions` (its records are the replay's, the bars the fixture's): the backlog.

**Left** (docs/friction/2026-11-26-backlog-after-round-16.md): the recorded Stagger start (carried once), the stage
logs' flag in the scoreboard, BATCH counted in `decisions`; the log context parked. CLAUDE.md lines for the lead in the
round's summary.

## 2026-11-26: What ends Arcane's Doubles Susceptibility: the slug's purges, e82d's second touch

**Goal:** the lead from docs/journal/2026-11-26-12-arcane-s-will-lines-and-chen-s-late-wolven-blood-final.md: Arcane's
combo Susceptibility (`doubles_susceptibility`) gone before Si's combo final in e82d (8.93–9.12 s) and 6339 (29.38 s),
which the replay keeps; find what ends it in the data, check it on every Arcane log, implement, measure.

**Done:**
- **Every run of it, every Arcane log** (scripts/probes/kits/arcane-doubles-runs.ts): in WILL each run ends at its
  seal's tick, 6.1–7.6 s of world time, but four. **6339's two and 7b54's at 47.48 s aren't Arcane's:** every team
  debuff on Hard 33's slug ends at the same logged moment (Jade Vessel, Camille's Susceptibility, Arcane's weapon
  lines), and in 6339 every hit after 11.27 s read exactly with the log's listing, the replay's 1.40 times the logged.
- **Engine assumption `logged-purges`** (default `log`; packages/logs holdinputs.ts loggedPurges, purgedByLog, wired in
  buffreplay.ts): a logged moment after which none of the team's runs on the enemy listed there is listed again, at
  least 3 debuffs (a debuff's per-element affixes once) from two operators, the next moment within 1.5 s: the replay
  ends every enemy-side kit buff, status, infliction, Vulnerable stack and control there, and drops an Arts Burst on
  its way (6339's replay-only burst at 29.40 s had put Arcane's Solemn Phalanx line on every later hit). Only 6339's two
  moments qualify among the development logs. Scoreboard: development plain 73.8 → 74.3%, mean |damage error| 6.1 →
  5.1%; 6339 plain 28 → 112 of 140, +40.8 → −8.0%; verified, hold-out and earlier pending unchanged.
  tests/logged-purges.test.ts.
- **e82d is the only second touch inside a running seal in any log** (multi-target included;
  arcane-second-touch.ts): only the Doubles Susceptibility goes, the first run's listing ending where the second's
  begins. Ruled out: Si's Immobilization (seals applied while she holds the enemy run their full length:
  arcane-doubles-immobilization.ts), Si's Initial Stroke (0eef inside a run), Rhodagn's Stagger node (bar 225), the
  seal's early end by abilityEvent 8 / 1403 / 1601 (it casts abilityentity_end, logged as a combo cast; none),
  its tick. Open: the second application refreshing the first instance, which ends with the first seal at the second
  touch's InterruptAction (87 ms before the last inside listing: the log's batching), or Arcane's passive's
  TagQueryListener. Not implemented: one hit in one log.

**Decisions:** a log-read stage event, not a kit rule: no data names the slug's phases, and the purge's evidence is the
log's own listing (as the logged Stagger steps are). Statuses and inflictions go too (the burst decided it: without
them 6339 kept 35 mismatches). The affix pair counts once because 3aa6 at 25.42 s (Arcane's pair and Perlica's
Electrification) read as a purge otherwise and lost 26 plain (earlier pending). The −8.0% isn't worse than +40.8%: the
over-prediction had cancelled Si's low combo-final slots at 11.31 s (the slug's HP cap). No team-ab: no kit or
engine rule simulations read changed.

**Left:** e82d −8.9% (a log with a second touch inside an Imprisonment decides it); 7b54's partial ends (16.48,
19.59, 47.48 s: other debuffs listed on); 6339's Laevatain hits 14.6–19.2 s (the replay ×1.28) and Si's combo final
slots at 11.31 s.
