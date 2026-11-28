# Engine assumptions: the evidence

Part of the [design](../design.md): the evidence behind each reading of the engine's own open assumptions
(packages/engine/src/assumptions.ts, the simulation's; packages/engine/src/replay-assumptions.ts, the log replay's).
The registry keeps each assumption's question and one sentence per reading; what was measured, on which logs and
when, is here, by id and reading. `efsim assumptions` prints both. The game-data cache doesn't key on this file, so
a measure's numbers or a view's name changed here rebuild nothing (backlog after round 18, point 2).

The form, which `efsim assumptions` reads (packages/cli/src/commands/assumptions.ts assumptionNotes) and
tests/engine-assumptions.test.ts holds to the registry: a `## <id>` heading per assumption; a paragraph of the
question's evidence, if any; then an item per reading that has some (a dash, the reading's id in backticks, a colon
and the evidence), its continuation lines indented two spaces. Every heading names an engine assumption and every
item one of its readings. A reading's evidence goes here, its one sentence in the registry: a change of prose here
needs no team-ab identity run and no cache rebuild.

## control-immunity

An immune enemy's clock runs on; only the freezing operator's own debuffs on it are held (timeline/clock.ts
controlImmune, actions.ts runTriggers).

## buff-in-stop

- `held`: (Laevatain's Twilight, created at her ultimate's frame 0, lasts 15 s after her own stop: every closed
  Twilight window in the logs ends later than 15 s from the press allows; Typhoeus's Hail of Arrows window created
  inside Gilberta's and Arcane's stops, d9e59d0fb737) (2026-11-18)
- `ultimates`: measured 2026-11-18 against held: development plain 50.0 → 49.8%, hold-out 66.1 → 65.9%, 11 development
  logs worse, 3 better

## status-in-stop

- `held`: one world clock (2026-11-23, measured against runs with Liino's combo placed from its stop's end:
  development plain 60.0 → 60.1%, hold-out 70.0 → 70.1% (5 better, 0 worse); 9090afbacec9 +9 plain (Perlica's
  Electrification applied inside Liino's combo slow-down, listed to 16 s), fc63a2001251 +4, 3f78ceb15bc3 −2)

## combo-reset

The game keeps one dilation per priority tag (the reset would do nothing under the lowest-scale rule).

- `reaches`: (withResets): 9555de54bb3d at 31.73 s (Xaihi's 27-frame combo slow-down 7 frames after Arcane's start),
  her Imprisonment burst 1.46 s after her cast as with no teammate's combo (81.53 s: 1.48 s; held 1.84 s), and the
  hits after it with her Susceptibility and Gear set bonus as logged; 791020039384 at 4.90 s (Ardelia's), 1d9198480e75
  at 50.30 s (Typhoeus's: Liino's volleys on time, 0.5 s early held) (2026-11-23, measured: development 5 better, 3
  worse, plain 65.7 → 65.8%; hold-outs 1 better, 1 worse)
- `resets`: Arcane's combo holds the world 9 frames, and a combo slow-down running at her frame 9 ends there
  (Corrosion's ramp in 3f78ceb15bc3's and 4a64e58e75ad's openers, Gilberta's, Si's and Arcane's combos: the
  lowest-scale rule holds 0.93 s and 0.91 s where the steps allow 0.73 s and 0.75 s; with the reset 0.72 s and 0.74
  s); one starting after her cast but before her frame 9 runs whole (the engine 2026-11-23, before `reaches`)

## freeze-ramp

- `statuses`: (clock.ts statusesRunOn): Corrosion's ramp runs on (reading `runs`' logs) and its end too,
  zmdlogs-489c0be3e162's from 13.13 s gone by 49.22 s where Si's Immobilization at 43.6 s held the replay's to 49.47
  s, the Vulnerable run, the ramp, Rossi's bleed and the Combustion ticks there asking about 1 s of hidden hold the
  held end left no room for (plain 488 → 632); Combustion's ticks run on, f978430a083a's at 57.80 and 58.80 s across
  Si's Immobilization at 57.6 s (2026-11-25). Against, weakly: db8711232de9's Corrosion still acts at 55.31 s, 0.58 s
  past this reading's end, in a Stagger whose Combustion ticks come every ~1.5 s (an enemy-clock delay the placement
  can't place there). Electrification and Solidification: no log decides them
- `runs`: (the engine until 2026-11-25): the log's ramp steps across Si's Immobilization in f978430a083a at 57.6 s
  allow at most 0.51 s of hold in its 1.5 s, a7a7a40c97ed at 18.1 s 0.68 s, Tangtang's in 791020039384 at 47.8 s about
  0.7 s of 4 s (2026-11-23)

## combustion-snapshot

The enemy's side is read at each tick either way (timeline/advance.ts, the statusTick step).

- `last-tick`: a tick deals with its owner's side as it was at the tick before (pending/zmdlogs-458b03609665.json,
  Wulfgard's Combustions: 85.70 s ×1.3 only, though Akekuri's ATK came at 84.37 s, then 86.69 s with it; 230.62 s with
  Akekuri's potential ATK the tick before lists, gone from its own listing; 232.58 s without) (2026-11-23)

## battle-sub-skills

Link isn't part of it.

## sp-regen

The logs record no SP, only casts, so they bound the team's SP from below: a reading the replay can't afford a
logged cast under is short of SP the game had (BuffReplay.spTopUps; `node scripts/probes/sp/readings.ts`). Neither
reading changes a verdict (the replay raises SP to a logged cast's cost); they move simulated fights. 2026-11-28,
the 65 development logs after Purrchena's counter presses: `pause` 15 logs short, 27 casts, 706 SP; `ticks` 11, 21,
577; a pause of 0.2 s (6 frames) 10, 20, 527; none (continuous, which 666bj's test rules out) 8, 15, 428.
- `pause`: the engine since 2026-11-12 (666bj's test, the native settings' interval as Endaxis reads it).
- `ticks`: as much SP as no pause at each tick; between ticks up to 4 less (0eef's opening press at 3.20 s: 9 SP
  short against 8 with the pause). Keys a search state's ticks' phase (search.ts spPausedUntil), so fewer states
  merge (tests/search-merge.test.ts's pairs: 9 against more than 10).

## sp-start

- `200`: the native settings as Endaxis's notes read them (rules.ts SP); every development log's opening the replay
  can afford but five: 0eef (3.20 s, 8 SP), bdf2 (7.63 s, 2), 79cc (9.10 and 10.73 s, 92: four battle skills in
  11 s, no pause reading pays more than 12 of it), ad7f (9.40 s, 13), 7b54 (11.03 s, 18) (2026-11-28).
- `full`: none of those openings short; with `pause` 5 logs short, 9 casts, 323 SP; with `ticks` 5, 7, 251 (1d91,
  79cc, 9c6e, af7b, f574 mid-fight; scripts/probes/sp/readings.ts). In-game test 113 decides it.

## break-hold

Every damage unit in the data carries enablePoiseBreakTimeDilation (true on all 1514), and no table gives the
dilation's length or curve; a Stagger Node's buff (buff_common_mini_poise_break) has its own 0.5 s layer-1 dilation,
which holds no clock the logs show (86 node crossings: casts and ticks across them on time, median +3 ms).

- `12f`: (the world's, the enemy's, every operator's, the breaker's too), not inside an ultimate's time stop. Measured
  2026-11-27 against none: development plain 82.7 → 82.9%, mean |damage error| 2.9 → 2.9%; earlier pending 81.8 →
  82.0%; hold-outs plain 82.7 → 82.2% (2 worse, about 30 hits plain → assumed), |damage error| 6.3 → 6.3%
- `14f`: the Stagger Node's own dilation holds as much (buff_common_mini_poise_break: 0.5 s, scale 1 → 0.01 at 7% →
  0.1: 0.46 s), within the logs' spread (scripts/probes/stagger/break-hold.ts: the casts' landings and enemy ticks 0.6
  s or more past a break, 26 rows, 0.41–0.61 s but two, median 0.54 s); measured as 12f (hold-outs mismatch 5.4 →
  5.5%); 5082ceaffad1's Yvonne keeps her chain at 45.06 s
- `16f`: measured as 12f but development mean |damage error| 2.9 → 3.1% (c83c75d02a85 1.7 → 6.7%: Si's 55.83 s combo
  keeps its final, a tail cut's threshold), hold-outs 6.3 → 6.5%

## break-hold-place

The log stamps most breaking hits at the hold's start (the next moment 0.45 s or more later), some inside it or at its
end (scripts/probes/stagger/break-place.ts: 9090afbacec9 128.92 s, the clocks 0.32 s late at the break's ms and on
time after, the next moment 0.10 s after it; c4f307cd039a 33.58 s, 0.38 s before and 0.12 s after; 3aa6ab93bad4 145.63
s, the breaker's battle skill pressed 0.10 s after her combo's breaking hit). Read only by the log check's replay
(packages/logs holds.ts breakHoldStarts, replayrun.ts), not by simulations, whose breaks hold at the breaking hit.

- `moments`: (not sooner than 134 ms after the moment before the break: the landings logged there, the replay's
  clock a few frames late, land before it), else it starts at the break's ms; 12 of 71 development breaks move, 3 to
  12 frames (three into an ultimate's stop, so not held: 4d60e7fe92c2 56.30 s, 9a8097fcf351 34.93 s, 4e3651100056
  56.07 s). The default since 2026-11-27 (the break placement round): measured against `ms` (on 2d414f3): development
  plain 84.3% either way (4d60e7fe92c2 +2: its INSIDE at 56.60 s gone; 9090afbacec9 −1 and earlier pending
  d4fb69b036fe −1: hidden holds placed elsewhere, 60.63, 75.28, 156.55 s and 115.09 s), verified and hold-outs
  unchanged; the 134 ms keep 9090's 128.50 s volleys landing (tests/buffreplay-typhoeus.test.ts; without it 9090 −1
  more). The log's evidence (no moment inside a hold) where `ms` contradicts it.
- `ms`: the default until 2026-11-27

## break-held-starts

Read by the placement (packages/logs logcasts.ts heldBreaks, castStart), which takes the run's readings
(placeHits' `assume`). A break's hold stops every clock (break-hold), so a cast that ran through one lands that many
frames later than its frame says; the placement read its start from the landing alone, and the replay then held it
again (fc63a2001251 102.33 s: Typhoeus's battle skill INSIDE her combo's uncuttable frames, the combo's event at 98.42 s
before the 101.11 s break). Whether a press inside a hold waits it out or runs unheld the landings can't tell
(scripts/probes/stagger/press-in-hold.ts: 30 starts inside a hold, 12 of them at its last 55 ms), so a start inside
one stays where it is.

- `unheld`: the default; the break's hold isn't read
- `held`: a break between the start the landing gives and the landing, not inside another operator's combo
  slow-down (4360447193ac 49.14 s, d4fb69b036fe 97.05 s: the next moments 0.13–0.25 s after), moves the start
  that many frames earlier (fc63's combo 99.03 → 98.57 s; 3aa6ab93bad4's Zhuang Fangyi combo 144.83 → 144.47 s under
  break-hold-place `moments`, her breaking hit stamped inside its hold). Measured 2026-11-27 against `unheld` (on
  2d414f3's code with `moments`): development unchanged (fc63 totals only: its INSIDE gone), earlier pending
  d4fb69b036fe +2 plain, one hold-out −6 plain (unquantified +3, fallback +1, mismatch +2; no decision kind's count
  moved), the same in every variant tried (every break, outside every combo, the ms reading)

## hidden-holds

The logs show unlogged world holds on one clock per fight, of about a perfect dodge's 0.512 s (enemy tick series,
never while the enemy is Staggered), and longer pauses. The log check's replay can't see them; this decides whether it
places them from the log's clocks (packages/logs holds.ts) and takes a decided buff's end from the log's listing where
that runs later (holdinputs.ts heldToLoggedEnds). Simulations place dodges themselves (--dodge) and don't read it.

- `placed`: (timeline/clock.ts holdWorld: buffs, the enemy's statuses and debuffs, combo windows; not cooldowns, which
  the perfect dodge's slow-down doesn't hold, nor the operators' own timing, which is the log's), then `log` on top;
  measured against log 2026-11-23: development plain 59.9 → 62.6%, mismatch 16.4 → 15.6%, hold-outs 69.6 → 69.9%
- `log`: (HIDDEN_HOLD_SHARE); measured against none 2026-11-22: all but the hold-outs plain 55.7 → 57.5%, mean |damage
  error| 8.3 → 8.1%; the hold-outs unchanged

## stagger-holds

No dodge is possible then (a Staggered enemy doesn't attack), but the enemy's tick chains inside the log's Stagger
come late by about a fifth of what the combos' stops hold where a combo falls (3.43 s over 15.36 s held, 87 pairs), on
time where none does (30 pairs, 0.02 s): a combo slow-down holds more than its stop list says (docs/open-problems.md
"The enemy's clock"). Read only by the log check's replay (packages/logs holds.ts comboHoldSpans).

## pause-holds

A Staggered enemy doesn't attack, so no dodge holds the world there (stagger-holds); but a whole-game pause the log's
clock runs through holds every timer, the Stagger's own included, however short its life. Read only by the log check's
replay (packages/logs holds.ts withoutGaps, pausedBound).

- `away`: pending/zmdlogs-4d60e7fe92c2.json (eny_0120_klbear_tower015) 117.22–124.45 s, inside the log's Stagger
  115.75–133.34 s: its Stagger lasts 7 s longer than the engine's, and Perlica's Wild Wanderer team buff, Arcane's two
  Solemn Phalanx debuffs on the enemy, Perlica's Qingbo layer and Liino's beats all run 5.5–7 s past their ends across
  it; 5.4 s placed there, 13 clocks spanning it, earliest and latest within 0.4 s. Measured 2026-11-26 against `none`:
  development plain 69.0 → 69.6% (4d60 696 → 806, −4.1 → −1.5%), no other log moved, hold-outs unchanged
- `paused`: (holdinputs.ts runBounds, holds.ts statusBounds), the bound of one that asks past its share laid inside
  the stretch (holds.ts pausedBound: only the pause can hold it that long). pending/zmdlogs-4d60e7fe92c2.json
  27.38–37.00 s, outside any Stagger: Arcane's basic string goes on across it (attack 2 at 26.39 s, attack 3 at 36.83
  s: a pause, no reset), and every clock spanning it runs past its end by most of its length, the team's and the
  enemy's alike: Perlica's Electrification from 21.37 s listed to 37.00 s (5.9 s past the replay's expiry), her
  weapon's team buff 6.6–8.6 s on each holder, Liino's Medicant layers (20 s) listed 30–31 s, Arcane's will_dmg 8.1 s;
  8.4 s placed there. Every other away stretch of the development logs (Si's phases, eny_0125_fdcentur,
  eny_0128_babyents_hdg031: 29 of them) has its clocks run on (asks −2.8 to +3.2 s: 0c14's Jade Vessel enemy_vul 0.8 s
  over a 19.9 s stretch, a9d7's Breach −2.7 s over 24.2 s, 4a64's will_dmg −0.9 s over 22.2 s), so nothing is placed
  there; no basic string goes on to its next step across one (`efsim zmdlogs away --all`). Measured 2026-11-27 against
  `away`: 4d60 plain 822 → 987, mismatch 108 → 54, per-hit |error| 4.97 → 1.71% (Zhuang Fangyi's Sunderblades at
  42.98, 48.74, 52.82 s strike 6, 8, 8 times, as logged; her log-only 0.59M gone), its total −1.2 → +1.7% (her matched
  hits' +8.1% that the log-only hits cancelled now +1.5%), no other log moved, hold-outs unchanged

## enemy-away

Read only by the log check (packages/logs enginecheck.ts fightTotals, enemyAwaySpans: the replay's
TimelineScenario.enemyAway), not by simulations: a stage's boss phase isn't the team's to model.

- `away`: (a boss phase), and the replay's landings there that stand for no logged hit, more than 0.3 s inside it,
  aren't counted in the simulated total, as a fixture's hand-written `absent` landings aren't. The logs' gaps fall
  apart at 6 s (development logs 2026-11-23: 18 of 4–6 s, then 1 of 6–7 s and 30 of 7–46 s, in 8 fights against Si
  (eny_0134_jsspsi, 19 gaps: about 20–24 s, then 13–14 s, a phase each fight) and 4 against eny_0125_fdcentur (7),
  eny_0128_babyents_hdg031 (3) and eny_0120_klbear_tower015 (2)), and the team still presses there
  (pending/zmdlogs-d774d0ce7bd3.json 30.6–54.6 s: Liino's ultimate and battle skills, Arcane's combo; Zhuang Fangyi's
  Empyrean strikes and finale, 0.78M, land there in the replay alone) (2026-11-23)
- `absent`: (TimelineScenario.enemyAway, timeline/landing.ts landHit): a hit landing from the frame after the
  stretch's last logged hit to the frame before the next lands on nothing (no damage, application, Stagger, enemy-side
  buff or hit event); an Arts Burst still lands (its effects come: 4a64's Nature burst at 29.30 s, 0.15 s into its
  stretch, gave Arcane's weapon debuff the log lists from 51.31 s; held back, 4a64 lost 6 plain), only its damage left
  out of the totals; what it gives its own team still comes (d774's Liino: her battle skill at 49.86 s, the enemy away
  30.6–54.6 s, puts her stance's ATK on the team, as the log lists it after; 9c6e's three the same). The log records
  every hit that lands, so the totals leave out every landing no logged hit stands for from the stretch's last logged
  hit's frame (the enemy leaves with it: 4a64's Rossi slash2 at 29.15 s, Si's first life's end, has no Seething Blood
  extra at its ms, every other slash2 has one) to its next. 0c14's Si (pressed at 139.68 s in the stretch
  134.97–152.91 s): no Artful Intent, Cryo or Jade Vessel run in the game, none in the replay now. Measured 2026-11-26
  against `away`: hold-out mean |damage error| 8.4 → 7.5%, development 4a64 better (+2.9 → +1.6%), d774 +7.1 → +4.7%
  (Zhuang Fangyi's strikes 0.2–0.3 s into its stretches, unlogged); a9d7 −1.8 → −2.2% (Chen's ultimate final at 159.33
  s, 0.74 s into its stretch, no longer refreshes her Slashing Edge, which the log lists to 169.40 s: a hidden hold,
  decided 2026-11-26 from the log: the ~0.4M final isn't logged where every other final of hers is, and a landing that
  refreshes the edge deals damage, docs/open-problems.md "The damage factors"), 9c6e −13.1 → −13.2%
- `absent-edge`: Measured 2026-11-26 against `away`: hold-out 8.4 → 7.5% as `absent`, development unchanged, d774's
  strikes 0.23 and 0.27 s into its stretches counted (replay-only, 0.14M)

## kill-gaps

Read only by the log check's replay (packages/logs enginecheck.ts killGaps: the replay's TimelineScenario.enemyAway),
not by simulations.

- `tight`: Measured 2026-11-27 against `absent`: hold-out mean |damage error| 6.3 → 5.4% but one hold-out −13 plain
  (+8 fallback, +3 mismatch: logged hits' landings a few frames before the next logged ms, dropped), development 9c6e
  −1 plain (Arcane's combo boom at the 55.20 s kill, landing a frame after it)
- `absent`: (a life, a phase or one of several targets ended; the log records every landing that lands).
  pending/zmdlogs-9c6e97486a9d.json 63.34–67.64 s: Typhoeus's shot capped at 8,037 of 17,127 (a target killed), then
  her Power Shot's burst (160k) the log doesn't have; pending/zmdlogs-63398339803e.json's slug, capped at 11.31 and
  24.02 s, Camille's battle skill and Laevatain's battle-skill ticks after them unlogged. Measured 2026-11-27 against
  `there`: hold-out mean |damage error| 7.3 → 6.3% (2 better, plain unchanged), development 3.2 → 3.5% (9c6e −14.6 →
  −20.6%, plain 202 → 200; 6339 −10.4 → −14.1%, plain 113 → 114: both fights under-predicted, their log-only −38% and
  −26% the other side's; the landings gone had cancelled part of it)

## status-pairing

The game's bursts and ticks land 0.55–0.85 s later than the replay's about half the time (a stop starting 0–300 ms
after the burst is due holds the game's: scripts/probes/bursts/burst-before-stop.ts, 13 held, 16 not), which the
replay's timing can't decide. Read only by the log check's replay (packages/logs statuspairs.ts pairStatusLandings),
not by simulations.

- `nearest`: (the replay until 2026-11-27): a burst held late leaves both sides one-sided, and
  pending/zmdlogs-c7790d76a4f0.json's logged 9.68 s took the replay's 10.03 s, so 9.27 and 10.08 s stayed unpaired
- `assignment`: the most pairs, then the least frames apart (a landing whose value doesn't fit counts 60 frames more),
  a landing 16–60 frames away only where its value fits the logged one within 1% (under the log's crit flag and the
  fixture's stage factor). Measured 2026-11-27 against `nearest`: development plain 81.5 → 81.6%, hold-out 82.6 →
  82.7%, earlier pending 81.6 → 81.7% with a 30-frame window (14 logs and 3 hold-outs better, 3 mixed: more plain,
  their totals 0.1–0.2 points further; none worse: pending/zmdlogs-c7790d76a4f0.json's 9.27 / 10.08 s bursts both
  paired, Wulfgard's and Laevatain's Combustion ticks a stop held paired with their own); 60 frames then 7 logs and 2
  hold-outs more better, none worse
- `check`: (packages/logs enginecheck.ts primaryParts: the kit buffs the replay can't judge as the logged hit lists
  them, its log-only buffs), with the landing's modifiers or (not a Combustion tick: its snapshot) with the replay's
  modifiers at the logged hit's frame: a burst the replay landed on the other side of a buff's edge than the game's (a
  stop held one and not the other). pending/zmdlogs-1d9198480e75.json 50.47 / 51.02 s (Arcane's Nature burst before
  her combo's Tactical Doubles Susceptibility in the replay, after it in the game: ×1.095),
  pending/zmdlogs-791020039384.json 28.27 / 29.85 s (Arcane's Cryo burst before her ultimate's stop in the replay,
  after it in the game: ×1.368), pending/zmdlogs-a7a7a40c97ed.json 39.27 / 40.87 s (Wulfgard's Heat burst with Liino's
  Medicant ×4 in the replay, an unjudged kit buff the log lists none of at the burst: ×0.838); a pair within 16 frames
  whose value fits only at the logged frame is read there too (b7b3 10.34, c779 9.68, c6d8 10.86 / 47.33 s: Arcane's
  WILL burst line, assumed → plain). Measured 2026-11-27 against `assignment` (with the 90-frame window, its own
  effect: 79cc, c83c, e989, 012a better, abfd, c3c7, f978 mixed): development 9 better, 2 mixed (c779 and f978, a
  total 0.1 point further), af7b worse (a total 0.7 → 0.8%); earlier pending 7 better, 3 mixed; verified b7b3 better;
  hold-outs 3 better, 1 mixed (plain +3, its total moved), none worse

## logged-purges

No kit rule ends them there. Read only by the log check's replay (packages/logs holdinputs.ts loggedPurges,
purgedByLog; enginecheck.ts killPurges).

- `log`: (at least 3 debuffs, a debuff's per-element affixes counted once, from two operators or more, the next logged
  moment within 1.5 s), every enemy-side kit buff, status, infliction, Vulnerable stack and control on ends, and an
  Arts Burst on its way doesn't come. Hard 33's slug, pending/zmdlogs-63398339803e.json at 10.35 s and 29.38 s (Jade
  Vessel, Camille's and Arcane's Susceptibilities, Arcane's weapon lines: the hits after 11.27 s read exactly with the
  log's listing, the replay's 1.40 times the logged; the burst at 29.40 s the log hasn't put Arcane's Solemn Phalanx
  line on every hit after it); no other development log has one. Measured 2026-11-26 against `none`: development plain
  73.8 → 74.3%, mean |damage error| 6.1 → 5.1% (6339 plain 28 → 112 of 140, +40.8 → −8.0%: the over-prediction that
  cancelled Si's low combo-final slots at 11.31 s gone; those and Laevatain's replay-only hit_2 at 21.60 s left),
  every other log, the hold-outs and the earlier pending unchanged
- `log-kills`: (a hit capped at the HP left before the fight's last hit: packages/logs enginecheck.ts killPurges): the
  killed target's debuffs go with it and the hits after it land on another, read as one the team hasn't touched. Hard
  33's Woodcraft Slugs (pending/zmdlogs-7b54dc249bcd.json, pending/zmdlogs-63398339803e.json): eight slugs of 1.2 Max
  HP each under eny_0129_slwood_hdg033, whose debuffs ZMDLogs lists together under the one id. Measured 2026-11-27
  against `log`: only the several-targets row moves (9c6e, 6339, 7b54): plain 40.9 → 54.0%, mismatch 34.9 → 27.6%,
  mean |damage error| 24.5 → 20.0%; 7b54 plain 1 → 65, +40.4 → +15.7%; 9c6e plain 200 → 244, per hit 10.3 → 7.9%,
  total −20.6 → −24.5% (its second target's log-only share no longer cancelled); 6339 plain 114 → 107, −12.6 → −19.8%
  (the slug after its 20.37 s kill had Camille's Susceptibility: Laevatain's 23.04–23.64 s hits ×1.12 low)

## several-targets

Read only by the log check (packages/logs targets.ts, enginecheck.ts fightTargets and fightTotals, killPurges;
replayrun.ts's kill gaps), on the three fixtures marked severalTargets (6339 and 7b54, Hard 33's eight slugs; 9c6e,
Hard 31's two Wanderers), never by simulations or an unmarked log. Measured 2026-11-27 (scratch/measure, the plain
tree against `one` as variants), the several-targets row only, every other row and the hold-outs unchanged.

- `one`: (the check until 2026-11-27): plain 54.1%, mismatch 27.6%, mean |damage error| 20.0% (6339 108 plain,
  −19.7%; 7b54 65, +15.7%; 9c6e 244, −24.5%)
- `targets`: plain 54.1 → 68.5%, mismatch 27.6 → 15.4%; 6339 plain 108 → 115 (Laevatain's 23.04–23.87 s battle skill
  with the Vesperwings the next slug kept across the 20.37 s kill), 7b54 65 → 99 (mismatch 116 → 83: hits on a slug
  without Jade Vessel, which the replay's one enemy had from 3.4 s, and the slugs after the 16.36 s kills), 9c6e 244 →
  314 (mismatch 94 → 33, mean |per-hit error| 7.9 → 3.9%: the second Wanderer without Corrosion and Detonation Unit's
  line). The totals' copies of a landing for its twins on other targets ungated: mean |damage error| 20.0 → 26.3%
  (9c6e −24.5 → +7.4%, 7b54 +15.7 → +61.3%: Si's combo finals the placement paired with slashes, their slots used up
  by the slashes' twins, counted once per slug); gated on the twin's fit (a hit no state fits stays log-only): 6339
  −10.3%, 7b54 +26.8%, 9c6e −11.3%, mean 16.1%
- `targets-once`: the totals as one target: mean |damage error| 20.9% (9c6e −26.1%, 7b54 +26.4%, 6339 −10.3%)
- `targets-gaps-away`: 6339 plain 116, −12.6% against `targets`' 115, −10.3% (Camille's 14.09 s landing on a
  shielded slug, unlogged: with the enemy there it gives the next slug her Vesperwings, as the log lists from 14.089 s,
  and her weapon's Heat DMG, which the log doesn't: a shielded slug takes no infliction); 7b54 and 9c6e unchanged
- `targets-ungated`: (2026-11-27, with the placement's twins on several targets, logcasts.ts placeWith `batch` /
  `later`) every twin on another target counted, fitting or not: the row's mean |damage error| 8.3 → 13.1% (7b54
  −3.3 → +21.5%: its 47.2–48.1 s combo reads ×1.26 high on every slug, so each copy adds the error once more; 9c6e
  −11.3 → +7.4%), plain unchanged; not the default

## target-deaths

Read only by the log check's replay (packages/logs targets.ts targetDeaths, replayrun.ts's death steps, engine
targetDies' TargetDeathOptions), in a fight read per target (several-targets `targets`): 6339 and 7b54 (Hard 33's
slugs), 9c6e (Hard 31's Wanderers); an unmarked log gets the moves' deaths under every reading. Measured 2026-11-27
(scratch/measure, the three readings as variants, against 14fe159, with Laevatain's death_absorb in every run): every
row but several targets unchanged; one hold-out worse under all three alike (|damage error| 5.8 → 5.9%: the one
unmarked log with a logged Vesperwings move, whose death now also runs the team's other death triggers).

- `moves`: (the replay until 2026-11-27, with Laevatain's absorption at the moves' deaths now) the row plain 71.3 →
  71.5%, mean |damage error| 6.3 → 4.2%; 6339 −6.3 → +0.1% (the slugs' Heat absorbed at the 20.37, 24.02, 29.26 and
  31.62 s kills: Camille's moves land on a slug without Heat, no burst at 21.60, 25.57, 33.17 s; Melting Flame 4 at the
  32.24 s battle skill, so the 35.70 s empowered hit lands)
- `kills`: (default) plain 71.6%, mismatch 15.3 → 15.2%, one-sided landings 40.7 → 36.1% of a fight (replay-only 17.8
  → 16.4%, log-only 22.9 → 19.7%), mean |damage error| 4.6%: 7b54 plain 116 → 117, mismatch 82 → 81, per hit closer,
  −1.2 → −2.3% (Laevatain absorbs the 16.36 and 32.94 s kills' Heat: Si's replay-only 30.50 s burst gone, which an
  under-prediction of the log-only twins had offset); 6339 as `moves`. The default: every death runs its triggers, as
  the data has them, where `moves` runs them only where Camille's happen to be logged
- `statuses`: 6339 +0.1 → −5.0% (its 29.26 s Laevatain combo hit, whose kit hit needs Combustion or Corrosion on its
  target, finds none: the 24.03 s Combustion the replay's one enemy kept stood for whatever its slug had; the replay-only
  Combustion ticks at 25.03–28.47 s go), 9c6e plain 314 → 313 (a kill there leaves the other Wanderer's statuses);
  mean 6.2%

## hitless-presses

The press may have done nothing (a variant the slot held, a press the game dropped), or landed without its damage
being logged. Read only by the log check's replay (packages/logs replayrun.ts inferredPress).

- `inferred`: (within 1.5 s), a run of a decided game buff starting there that the replay gives with the press and not
  without it: pending/zmdlogs-0c14fb3ce77d.json, Si's battle skill at 153.99 s (Jade Vessel's enemy_vul from 155.79 s,
  which only her battle skill's Immobilization gives; her Artful Intent then ending at the log's 181.00 s), and
  891566c224f8's Liino at 111.23 s (her stance's ATK listed from 111.65 s, the fight's last 0.3 s). Only with the
  log's own cast event (Alesh's 0c14 combo at about 12.5 s has none: not made). The press's own landings stand for no
  damage (the log would show it): the totals leave them out. Measured 2026-11-26 with enemy-away `absent` against
  `skipped`: 0c14 plain 172 → 293 (Jade Vessel on 160 hits, Rossi's 165.49 s Lift, the Endministrator's Crush at 4
  stacks), hold-out plain 80.3 → 80.6% (one log +12 plain, its hits closer, its total further: 7.5 → 8.4% the hold-out
  mean; as 0c14's −3.4 → +2.7%, the readings that now fit raise the total onto what the replay over-predicts
  elsewhere: 0c14's Rossi, 58 replay-only landings, 0.30M)

## listed-casts

The game may have landed the cast's hits without the log recording them, or the buff came from something no kit
models. Read only by the log check's replay (packages/logs castassembly.ts castsFromHitBuffs).

- `inferred`: (on the path that has it: a chance jump's taken), when exactly one kit hit of the team applies the buff
  (no trigger or other hit), no cast of its skill starts from 2.5 s before to the run, and its operator has no logged
  hit from the cast's start to the hit; its own landings stand for no damage (the totals leave them out).
  pending/zmdlogs-0c14fb3ce77d.json: Alesh's combo at about 12.0 s, its Rare Fin slam's P3 team ATK listed from 13.25
  s and its hook's natural SP the second Thermite Cutter layer from 12.71 s, with no hit or cast event of it

## combo-curve

The compiler samples the guess (packages/data skillData.ts slowdownOf) and keeps the curve's name on the timing; a
reading resamples it for the timeline (createContext) and the log tools' stop lists (timeline/curves.ts
withCurveReading). Simulations read it too.

## combo-operator-hold

Across a combo's stop an operator's own cast runs late by about 140 ms (4.2 frames) a combo, the enemy's ticks by 57
ms (1.7 frames), bursts 181 ms (docs/open-problems.md "The enemy's clock"); the operators' excess sits in the stop's
first half, not after its end nor before its start (scripts/probes/combo-hold/edges.ts). Simulations read it too
(timeline/clock.ts slowDown).

- `3f`: measured 2026-11-26 against `none`: verified plain 78.0 → 77.4%, development 69.0%, hold-out 80.6 → 80.5%,
  earlier pending 67.3 → 66.4%
- `plateau-0.6`: (the world keeps combo-curve's: 0.01 to 40%); about 2.4 frames more on a 24-frame combo, in
  proportion to its length
- `4f-episode`: (2026-11-28) the frames once per episode, at a slow-down that starts while none runs
  (scripts/probes/combo-hold/episodes.ts: a cast across one combo is 212–285 ms late whatever its hold, 291–615 ms;
  across two pressed together about as late; `5f-episode`, `6f-episode` the same with 5 and 6 frames, earlier pending
  83.4% each). Against `none`: verified, development and
  hold-out plain unchanged, earlier pending 84.6 → 83.9% (4bfc −36 against `4f`'s −97; 3aa6 −40). The loss: the
  replay's landings are pinned to the log, and the hold moves what of a cast isn't pinned, Zhuang Fangyi's strike_n
  stack on her clock (3aa6 21.26 and 32.90 s: the strike's `if` fails, and every later strike takes the one before's
  value), while her strike at 21.26 s after Arclight's combo lands where `none` puts it (−10 ms): not every
  operator's cast is held more.

## unlogged-tails

The logs record every landing that lands (enemy-away). Read only by the log check's replay (packages/logs replayrun.ts
tailCuts: ReplayCastOptions.endsAt).

- `cut`: the guards: each of its logged landings its own, not a variant's, when the log has no hit of its operator's
  casts that another cast doesn't hold from there to 1.5 s after its first later landing, that landing is outside the
  away stretches and the fight's last 1.5 s (0.5 s since round 21) with a logged hit of anyone within 1.5 s after
  it, and no decided game buff the replay starts at one of the tail's landings (or the frame after) is listed as a new
  run within 1.5 s
  (the earliest such cast first, the replay made again after each; a run another cast started in the tail's
  time keeps nothing: pending/zmdlogs-d774d0ce7bd3.json, Zhuang Fangyi's Empyrean battle skill at 103.28 s, three
  strikes logged, was kept by a gear set's team ATK from Arcane's ultimate hit at 107.07 s, two frames before a tail
  strike; measured 2026-11-27: d774 plain 388 → 405, +4.9 → −1.4%, no other log's verdicts moved, hold-out unchanged):
  pending/zmdlogs-0c14fb3ce77d.json, Rossi's battle skill at 35.40 s (its two charge hits logged, no Lift at frame 35,
  no wolves, no bleed: the Vulnerable stack the Lift would add isn't there at 53.57 s, where the log has her Lift's
  hit but neither its Lift status nor the follow-up; with it the Endministrator's combo the Lift set off and its
  Essence Disintegration ATK go, and 43.5–60.2 s read plain). Measured 2026-11-26 against `kept`: 0c14 plain 293 → 336
  (its total +2.7 → −3.2%: its hits that now fit were over-predicted with what the tail gave, its Rossi and Si
  under-predicted elsewhere), development plain and verified unchanged (9c6e −13.2 → −13.5%, Liino's combo hit2 at
  48.73 s out of an under-predicted total), earlier pending 67.3 → 67.7%, hold-out plain unchanged, mean |damage
  error| 8.4 → 8.3% (1 better, 2 worse, totals only). Without the listing check and the fight's-end rule the first cut
  lost db87 15 plain (Camille's ultimate, whose gear-set and weapon buffs the log lists after its unlogged hits) and
  2fd9's killing Crush. Since round 21 (2026-11-27; docs/journal/2026-11-27-19-tail-cuts-what-the-shown-hit-guard-stands-for.md)
  the cast's own logged landings are no evidence (its last one, logged a fraction of a ms past its frame's time,
  had passed the "later hit of its operator's casts" test: 143 of 217 kept tails), and what that test stood for is
  read instead: a logged hit no cast holds with a tail landing's event within 16 frames of it (`landed`), a logged
  status hit of its operator whose nearest status landing the tail set off (`status`: c4f3's Pogranichnik battle
  skill at 108.08 s, the Breach logged at 109.01 s), and a cut whose replay loses a logged hit's landing is undone
  (`needed`, replayrun.ts cutTails: 9847's Liino battle skill at 75.44 s, the volley timer it opens at its frame 45
  and the volleys logged from 78.36 s); the fight's end is 0.5 s (0eef's Liino combo hit2 at 8.80 s, the team's hits
  logged to 10.03 s). Measured against fa2c2ad: plain unchanged in every group but several targets 71.6 → 72.1%
  (7b54 +4); mean |damage error| development 1.3 → 1.2% (15 better, 4 worse), verified 1.6 → 1.5% (0eef 2.3 → 1.3%,
  4e5e −3.0 → −3.3%), hold-out 5.9 → 5.9% (4 better, 4 worse, the worse ones basic-attack totals), several targets
  4.6 → 7.6% (6339 +0.1 → −10.4%: Laevatain's 21.60 s finisher hit_2, 10.2% of the fight, no log line). The worse
  ones are under-predicted fights whose unlogged tails had cancelled part of it (db87 −1.5 → −2.2%: Laevatain's
  38.57 s ult_attack2 hit, 38,477, no log line), as at `cut-all`'s adoption
- `cut-all`: (a dodge, a swap, the next attack). pending/zmdlogs-207fff414d82.json 17.42 s: Rossi's not-controlled
  attack 4 (hit_ai, frames 195–213) lands two of its five hits, her next cast 2 s later; 20.72 s the same, under her
  battle skill. Measured 2026-11-26 against `kept`: plain as `cut`; mean |damage error| development 7.0 → 6.9%,
  hold-out 8.4 → 8.3%, earlier 4.0 → 4.0%, 8 development logs' totals closer, 6 further. The default since 2026-11-27,
  measured against `cut`: development mean |damage error| 3.5 → 3.4% (14 better, 6 worse, all six under-predicted
  fights whose unlogged basic tails had cancelled part of it: 5082 −0.2 → −0.7%, db87 −1.2 → −1.5%), replay-only 3.8 →
  3.6%, 207f +1.6 → +0.4%; development plain 81.5% (4a64 209 → 207: two logged attack-4 hits at 16.93 s had matched
  the cut tail's landings 0.30 s later, now Arcane's first attack 4's with its set's Nature DMG), hold-out 6.3% (4
  better, 3 worse), earlier pending 1.4 → 1.3%, verified 4e5e −2.9 → −3.0%

## totals-crits

Read only by the log check's totals (packages/logs enginecheck.ts engineReadings, critFromValue), not by simulations.

- `read`: (a crit's factor is ×1.5 or more, so the value says which), else at expected crits:
  pending/zmdlogs-0c14fb3ce77d.json, Rossi's first ultimate (25.2–27.7 s), ×1.032 below the log on every stab (Alesh's
  weapon layer the replay lacks), 17 of its 28 crit-unknown landings crits by their values (18.5 expected), its two
  finals among them (326,856 and 108,952, counted at expected crits as 250,328 and 83,443). Measured 2026-11-26
  against `expected`: mean |damage error| verified 2.0 → 1.5%, development 7.0 → 6.9%, earlier pending 3.9 → 3.6%
  (0c14 −2.8 → −1.3%, b6aa −5.5 → −2.3%, 99fb −1.9 → −0.3%), hold-out unchanged; plain counts unchanged (a totals rule
  only)

## check-crits

Read only by the log check's readings (packages/logs enginecheck.ts readingBasis), not by simulations: it decides
which of a hit's two crit readings is plain and which is an assumption.

- `replay`: (critSource shown, layers or values: every development log leaves the crit out of Rossi's ultimate stabs,
  whose Seething Blood extras at the stab's ms show it, and Yvonne's ultimate, whose values show it), the other
  reading labelled `no crit`; no crit elsewhere

## enemy-hp

Read only by the log check's replay (packages/logs replayrun.ts loggedEnemyHp), not by simulations: a simulation's
scenario says the HP (TimelineScenario.enemyHp).

- `kill`: (Si, eny_0134_jsspsi: two lives); a fight whose total is the data's Max HP as under max-hp. Development logs
  2026-11-24: Chen's hits in d4fb below half the logged total ×1.16 the reading without Shadowless (89 hits), above it
  ×1.00 (79); Alesh's ultimate ×1.5 exactly where a life's HP was below half in a9d7 (6 of 6), ad7f, 4e36 (2 of 2
  each), 0c14 (2 of 3); a27b (the data's Max HP) fits Shadowless on below half and off above, both sides (in-game test
  69)
- `max-hp`: any other none, and a condition on it never holds (the replay until 2026-11-24)

## trigger-cooldowns

The kit compiler says per trigger from the game's mechanism (KitTrigger.cooldownClock; packages/data kits.ts
cooldownClockOf): a CD timer (AddGlobalCDTimer) or a `…_cd` buff the world's, a timed marker (CreateTimedMarker) raw.
A timed marker's clock isn't decided by a log: with `world` for every trigger no development log moves beyond what the
CD timers move.

- `kit`: the world's for Swordmancer, Mi Fu's P3 shield ATK, Laevatain's Final Strike absorb, Antal's talent heal and
  the gear and weapons whose data has a CD timer or a cooldown buff (suit_spellburst, wpn_claym_0004, _0006, _0007);
  raw for the timed markers (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel's marker and 19 more)
  and the 8 cooldowns the data doesn't show. Measured against `raw`: the same logs move as under `world` (earlier
  pending 04d4, 2fd9 plain 246 → 250, d4fb, de6a better; fc63's totals; two hold-outs' totals worse, both from
  Swordmancer: replay-only 4.9 → 4.8%, log-only unchanged, so the procs it drops are ones the game didn't deal)
- `world`: every slow-down after the trigger fired, and the log replay's placed hidden holds, push its ready frame
  back by the frames they hold the world. Swordmancer's 15 s (suit_phy01, AddGlobalCDTimer): every wearer's Physical
  status with no logged proc came under 15 s of the world's time after the last proc (de6a 51.79 and 137.84 s at 15.01
  and 14.98 s, 18.8 and 20.5 s of log time; d4fb 53.98, 126.13 s; fc63 59.11 s; d4fb 97.05 s at 16.67 s the one
  exception), every proc past it (17.8 s and more): scripts/probes/cooldowns/physuit.ts; Mi Fu's P3 ATK in 2fd9
  (69.1–70.1 s, 3 mismatches plain). Measured 2026-11-24 against raw: development unchanged but fc63's totals, earlier
  pending 4 better (04d4, 2fd9 plain 246 → 250, d4fb, de6a +1.0 → −0.4%), hold-outs 2 worse by their totals
  (aggregates unchanged)

## burst-stops

- `others`: (the engine until 2026-11-24): Arcane's WILL touch at 4.95 s in zmdlogs-b7b3762d5da8 bursts in the replay
  at 5.97 s inside her own ultimate's stop (5.60–7.17 s); the game's burst is at 10.34 s
- `all`: (2026-11-24): a burst on its way when her ultimate's stop begins, or due inside it, comes that much later.
  b7b3's burst then comes after Arcane's and Tangtang's stops, at 10.34 s as logged; over Arcane's 130 logged bursts
  in the development logs, within 150 ms of the replay's 89 → 94, with none near 23 → 20, replay-only 24 → 21
  (scripts/probes/bursts/arcane-bursts.ts); Perlica's and Xaihi's one each better, no operator's worse. Measured
  against `others`: verified b7b3 plain 44 → 47; development 489c, 984748, 9c0b, c779 better, 79cc one plain fewer
  (its 24.23 s burst: Ardelia's combo, placed from its travelling projectile 0.8 s late, holds it); hold-outs 2 better
  (plain +2), 1 other (a status kind's share), none worse; earlier pending b6aa better, 012a 0.6 → 0.7%, c3c7 closer
  per hit
- `ultimates`: no combo slow-down. Measured 2026-11-24 against `others`: hold-outs 4 worse, 1 better; development 6
  better, 4 worse (e82d plain 21 → 11, c6d8 112 → 104, dbae): combo slow-downs do hold bursts

## window-reaction

- `applied`: pending/zmdlogs-fc63a2001251, the touch at 81.47 s after Arcane's Nature onto Perlica's Pulse (Corrosion,
  80.40 s): Typhoeus's power shot at 84.13 s consumed a Nature stack (its burst ×1.303 the replay's,
  enchence_burst_damage_rate 1.3) and Arcane's array burst on nothing. Measured: fc63 plain 511 → 549, mismatch 179 →
  97, but 9a80 plain 227 → 217 and fc63's total 3.4 → 5.3%

## finisher-stagger

- `cast`: (2026-11-24): pending/zmdlogs-7e19489ae503, Ember's finisher hit_2 at 33.15 s, after Chen's ultimate stop,
  ×1.564 the unstaggered reading, which is ×1.43 (her first hit's Staggered parts: the multiplier 0.3 and
  DamageToBrokenUnitIncrease 0.27) × the ×1.096 her first hit at 30.86 s has; the log lists no poise_break buff on it
  (its Stagger ended at 30.86 s) and Chen's ultimate hit at the same ms is plain unstaggered. The one finisher in the
  development logs with a hit after its Stagger's end: the other 38 multi-hit finishers' hits all list the Stagger

## finisher-ultimate

The buff's tags include battle-skill (-1486085048, buff_common_disable_normal_skill's) and dash (-1601691447,
buff_common_disable_dash's) and one no other buff has (-496376350); Typhoeus's hover, which allows her combo and
ultimate, carries the other two.

- `cuts`: (every logged ultimate inside one: pending/zmdlogs-458b03609665.json, Laevatain's at 156.27 s, 20 frames
  before frame 42, and 223.17 s, 3 frames before, no hit_2 logged either time; pending/zmdlogs-d5720d9ceb94.json,
  Rossi's at 121.89 s, placed from its own hits, 17 frames into her finisher, whose window runs to 65: neither the
  frame-15 hit nor hit_2 logged) (2026-11-23)
