# Open problems

One entry per accuracy problem not yet explained: what the logs show, what
is **ruled out** (with the evidence), what is **still possible** (every
candidate not yet tested or not yet excluded, however unlikely), and the
**next check**. A problem leaves this file only when its cause is found,
or when it's settled as out of scope (with the reason). Diagnosis reports
(the agents', and our own) update it: each names what it ruled out *and*
what it left standing; a candidate goes from "still possible" to "ruled
out" only with evidence. The accuracy plan says what was done; this file
says what isn't known.

A stated cause cites the check that showed it (a command, a script, a
count); without one it goes under "still possible" (round 3: a guess
written as a finding sent a Stagger diagnosis the wrong way). The first
steps of a diagnosis, before hunting a mechanism: `efsim zmdlogs groups
--operator <op>` (the operator's mismatches split into team-wide, no
landing and own, by skill and by what the log and the replay disagree on)
and `efsim zmdlogs differences` (does the damage side with the log's
listing or with the replay, per thing they disagree on); then `zmdlogs
casts`, `replay`, `stagger` for the fight itself, and `npm run measure`
for each idea (docs/design/tests.md "Measuring a change"). An operator off
by one factor on most hits: `efsim zmdlogs fit-build <fixture> --operator
<op>` first (attribute nodes, weapon level, food), so a build offset
doesn't hide a kit error; its fit goes into the fixture's
`buildOverrides`. Which operators those are, over every development log:
`efsim zmdlogs offsets --all` (a tight median of logged ÷ primary off by
3% or more; the log suites fail on one nothing accounts for). A fix tried
and dropped keeps its diff in [docs/tried/](tried/README.md), named here
with its measure, so it can be measured again later.

Operators are named here by display name; their ids (an internal name:
Arcane is `chr_0032_lizhiyan`, Gilberta `chr_0013_aglina`) come from `efsim
find --operators`, or `operatorId(data, "Arcane")` (@efsim/data) in a
script; `devFixtures({ withOperators })` takes names too.

Started 2026-11-11 (the owner: keeping a record of what hasn't been ruled
out is necessary, not only of what has). Hold-out logs aren't debugged, so
none appear here.

## Low plain, low mismatch: Rossi, Chen Qianyu, Yvonne, Lifeng, Pogranichnik, the Endministrator (2026-11-26)

**Shows:** at 36e3bc8 Rossi 51.9% plain (2305 hits), Chen 30.2% (810), Yvonne 31.9% (323), Lifeng 43.5% (260),
Pogranichnik 44.1% (649), the male Endministrator 52.6% (310), each with a mismatch share under 8%: most of their hits
match only under an assumption or by the log-listing fallback. Grouped by what the first fitting reading assumes
(`efsim zmdlogs assumed --operator <op>`, round 15, from that round's probe: the check's own composition, per kind,
kind set, event and label).

**Found and fixed:**
1. **The crit the replay already read (Rossi, Yvonne).** 418 of Rossi's 1109 non-plain matches and 150 of Yvonne's
   assumed only `crit`: the log leaves the crit out of every ultimate stab of Rossi's (and Yvonne's ultimate), the
   check's primary reading took none, and the crit reading was the assumption; yet the replay had read those crits
   from the log (replaycrits.ts: a Seething Blood extra at the stab's ms, the Wolven Blood layers its crits add, the
   hits' values; `hits --json` critSource `shown` 200, `layers` 205 of them). Engine assumption `check-crits`, new
   default `replay`: the primary reading takes the replay's read crit and the other reading is `no crit`
   (enginecheck.ts readingBasis, primaryCritRead). Rossi plain 1196 → 1610 alone; 9 of her hits now need `no crit`
   (the read crit wrong there). The totals are unchanged by it (critFromValue is symmetric in its two readings).
2. **A status's damage that crits counts as a crit (Chen, Rossi; Lupine Scarlet and MI Security).** Chen's Wolven Blood
   layers in a9d7, one per crit, gain one at each of her Lift hits that crit (12.04, 25.86, 40.46, 61.52 s), none at
   the Lifts that don't (23.91, 38.76 s); the replay counted kit hits only and fell a layer further behind at each,
   ×1.013 → ×1.044 under the log by 69 s on every one of her hits (a9d7 Chen plain 0 of 186). Rossi in d572: two
   layers at 5.50 s from her combo's crit and its Lift's. The game's abilityEvent 44 (the wielder deals Critical DMG,
   its damage mask disabled) is the trigger of both Lupine Scarlet and MI Security. A status event's battle event now
   carries its damage's crit (engine landing.ts recordStatus `crits`, asEvents), and a trigger on crits with no filter
   a status's damage fails (kinds without `none`, skills, Final Strike, decorations, `reaction: false`) fires on it
   (events.ts statusCritMatches); a replayed status's hit takes its logged crit (eventDamage, reactionEventKeys).
   Seething Blood and the Wolf Pistol's crit trigger (kinds battle / combo) don't see it.

**Measured** (`measure --variant check-crits=none`, against 36e3bc8's snapshots; the status crits alone): development
plain 69.7 → 70.1%, hold-out 81.0 → 81.2%, earlier pending 70.2 → 70.7% (mean |damage error| 3.5 → 3.4%); a9d7 plain
101 → 177, 0c14 493 → 509, d572 925 → 952, 2fd9, 99fb, 4e5e better; c4f3 worse (243 → 223, −2.5 → −2.9%): Chen's
second Wolven Blood final ends at 104.5 s in the replay against the log's 99.1 s, and with the layers now counted right
the hidden-hold placement, which reads that run as a clock, moves its units 10–21 (111.6 → 80.9 s and on), so the third
final and Pogranichnik's hits at 116–146 s read ×1.04 off. `check-crits` on top: development 70.1 → 71.8%, hold-out
81.2 → 82.1%, earlier 70.7 → 72.9% (docs/accuracy.md: Rossi 73.2%, Yvonne 71.2%, Chen 38.8%, Pogranichnik 41.9%
for c4f3, Lifeng and the Endministrator unchanged).

**Only the check's tolerance (left as they are):** a buff starting or ending at the hit's ms (`boundary buffs
applied`, 80 of Rossi's: the log's resolution); a kit buff changing within 500 ms of the hit, read as listed or off
(the replay's edge); Link stacks the replay can't say (4e5e's 27 ultimate stabs); a crit the log doesn't give and no
inference reads (57 of Rossi's).

**Still possible (not fixed):**
- **Pogranichnik's SP-driven team buffs (Chen, Lifeng, Pogranichnik, the Endministrator: a9d7, c4f3, d4fb, de6a).**
  Worked 2026-11-26 (round 6 of the fights, "slots by value"): neither buff reads the team's SP. **Thermite Cutter is
  right in the replay:** its `other values` (245 of Pogranichnik's hits in the four logs) are the log's listing, once
  per application (7 at d4fb 92.0 s), where the replay's two layers read the hits' values (d4fb 61.76 s plain with
  2 × 0.09, the log listing one); d4fb's 60–72 s ×1.0195 on the Endministrator is his gear set's
  `suit_crush_fracture.phys` (0.24 in the replay, 0.27 listed: the Vulnerable stacks a Crush or Breach consumed, and
  whether the enemy was Susceptible), not Thermite. **Fervent Morale's bank was double-fed:** his combo jumps from
  frame 0 to 200 / 400 / 600 by the Vulnerable stacks consumed (4 / 3 / 2 / 1), the placement gives the slashes the
  4-stack path's frames 23, 37, 61 by kit order, and the replay landed them there besides the jumped-to path's own
  (six slashes, both paths' SP into the bank: a9d7 48.9 and 141.2 s, d4fb 46.5 s, c4f3 13.7 s). Now a logged landing
  in a taken jump's skipped part goes to its hit's landing on the jumped-to path (engine paths.ts
  `takenPathLandings`, drivers.ts replayCast), and the path is the values' where they decide (castassembly.ts
  `valuePaths`, replayCast `kitJumps`; PATH lines in `zmdlogs decisions`): the third slash ×3.13 the first is the
  4-stack path's 2.97, ×1.36–1.85 the 3-stack path's 1.49 (25 combos, all as the values say). c4f3's first Fervent
  Morale 15.97 → 34.03 s (the log's 34.04 s Breach), d4fb's 194.43 s layer (none in the log) gone, 174.50 s (log
  174.03 s). A Breach now takes its applier's Arts Intensity after its hit's before-damage triggers (timeline
  landing.ts: the data's SP before its FractureAction, so the bank's layer counts). Pogranichnik plain 41.9 → 52.1%,
  Chen 38.8 → 43.0% (docs/accuracy.md). **Still open:** d4fb 86.67 s (the bank reaches 80 at a harass 0.3 s later in
  the replay: its Breach and hit ×1.074 without the layer); c4f3 13.07 s's Breach consumed three stacks in the replay, four in the game (its combo's
  path says so; the battle skill's SP is atb3 where the game's was atb4); the harasses' layers on whom (c4f3 68.83 s
  on Pogranichnik in the log, the replay's at 71.17 s twice); a9d7 197.07 s (a layer the log lists from 205.06 s).
  de6a 26–61 s ×1.004 on every Pogranichnik hit and the ×1.003 on the Endministrator's d4fb fallbacks: a small
  factor not traced.
- **Estella's set and Susceptibility on Chen in c4f3** (`log only`, 29 and 16 hits, ×1.15–1.33): the replay lacks them.
- **Rossi's `unlogged own combo_crit`** (108 fallbacks with the listing): her combo's crit buff on hits where the
  engine reading also misses a Wolven Blood layer or a teammate's buff; not grouped further.
- **Chen's Wolven Blood final's end** (c4f3 99.1 s in the log, 104.5 s in the replay): a clock question, the buff's
  run of 20 s over the hidden holds.

## Misprediction statistics: candidates across the logs (2026-11-24)

**Shows:** one statistical pass over every development log's hits and one-sided landings
([analysis/2026-11-24-misprediction-stats.md](analysis/2026-11-24-misprediction-stats.md); tables from
scripts/probes/stats/build.ts, every number from analyze.py). Stage logs aside, the off hits' error (|logged − primary
reading|, 5.0% of the logged damage) is: one kit buff the replay has wrong at the hit, the log's listing right, 20.4%;
matched only through an alternative or the listing with alternatives 30.2%; Corrosion unquantified 8.5%; fight-wide
factors 2.3%; unexplained 35.1%, nearly all in fight-operators already open below. The top 20 of 216 fight-operators
carry 61%.

**Found and fixed:** Zhuang Fangyi's Empyrean combo logged under the base combo's key (4.3% of the error, 21 hits in
four logs, all ×1.500 = atk_scale 5.4 / 3.6, `poise.origin` combo_skill_ult on every one): the kit's Empyrean combo hit
now carries the base key (c9cf9a3; 4d60, 3aa6, 4bfc and a hold-out better, d774's total +3.8 → +7.2%: the strikes it
hid).

**Found and fixed (2026-11-24, the candidates worked; [analysis](analysis/2026-11-24-misprediction-stats.md#follow-up-the-candidates-worked-2026-11-24)):**
- **Candidate 3, the weapon "ready" buffs: a double count, not a consumption.** The consuming cast's hits list the
  attached buff that carries the modifier (`buff_wpn_sword_0021_valid`, `buff_wpn_sword_0017_valid`), never the kit
  buff's gameBuff (`_exist`, no modifier), so the check added the log's entry beside the kit buff: 59 hits in 0c14,
  7e19, d4fb, a27b read with the bonus twice (×0.75–0.92), and fit with it once (`cf` readings equal to the unit). The
  kit buffs name their attached buff in `loggedAs` (also Aspirant's `_pdi_up`, Cohesive Traction's `skill_pulse01`, no
  log yet, and Yvonne's P5 child `potential_5_new` on her ultimate states: 5082's 72 hits, the "Yvonne's ultimate
  state" item). The screen (scripts/probes/stats/doublecount.py: a kit buff and an unmapped log buff with one zone and
  value at one hit) found no other pair.
- **Chen's d4fb readings: her P1 (Shadowless) below half HP, which the replay never had.** The replay knew the enemy's
  HP only when the logged total was the data's Max HP; the stages scale it (tower015 ×7.6). Now a kill's logged total
  is the HP, in lives split at away stretches (Si: two lives; engine assumption `enemy-hp`, `kill`; `max-hp` the old
  reading). d4fb Chen below half ×1.16 (89 hits), above ×1.00 (79); a27b (Max HP) fits P1 off above and on below:
  in-game test 69 decided from the logs. d4fb +9.6 → +0.5%, c4f3 plain 214 → 242.
- **The ×1.5 band: Alesh's ultimate is his P5 below half HP** (atk_up 1.5, the kit's `enemyHpBelow`), the same HP:
  a9d7 6 of 6, ad7f and 4e36 2 of 2, 0c14 2 of 3 (its 18.39 s hit ×1.34 at 92% HP, open). **Ardelia's basic attacks**
  were placements: attacks 1 and 2 share one key, and after her attack 3 and combo the placement took an older attack
  1's window to attack 2 (logcasts.ts `choose`: among basic steps the latest cast says the step).
- **Si's ultimate Amp in 9c0b** (the analysis's largest one-buff item): her ultimate at 7.02 s, before the log's
  first hit, wasn't made for want of energy the log can't show; made now (ReplayedCast.beforeHits). Every unseen
  ultimate made regardless was worse (tried: docs/tried/2026-11-24-unseen-ultimates-without-energy.diff).

**Ruled out (as broad causes):** the log's crit flags (flipping one fits 32 of 7,565 off hits; hold-outs 6 of 624); any
generic hit feature predicting the error across fights (a tree fitted on the development logs explains R² 0.007 of the
earlier ones', 0.039 the other way; slow-downs, placed holds, the landing's dt, parser version, import date, fight
length, enemy and team members don't concentrate beyond the fights themselves); the one-sided twin window (pairs 1.5–3
s apart 0.35% of a fight).

**Still possible / next checks (largest first):**
- **One buff's state at the hit** (20.4%; the hold-outs' largest class, 34.0%): ~140 kit buffs, none above 2.0%; the
  largest worked 2026-11-24 (below, "The kit buff leads"): one fixed (Zhuang Fangyi's Lone Barge, the Empyrean's end),
  the rest not kit values but the replay's bursts, clocks, placements and an unsimulated HP. `zmdlogs differences
  --all --what <buff>` and `python3 -I scripts/probes/stats/onebuff.py <buff>` per buff.

**The kit buff leads (2026-11-24; tables rebuilt at c6f1874 with build.ts, per buff scripts/probes/stats/onebuff.py;
shares of the off error at that code):**
- **Fixed: Zhuang Fangyi's Lone Barge ultimate buff** (1.0%, 4bfc 27 hits and 4d60 9, ×0.849): the log's
  `ultimate_skill` cast events 30–35 s after an ultimate's (4bfc 92.68 and 179.51 s, 4d60 106.47 s, d774 135.57 s)
  are the Empyrean's end (ult_end casts ultimate_skill_end), not casts: no time stop follows (her hits go on through
  the 78 frames), her next hits are her plain forms, and Lone Barge's ultimate buff isn't listed after them (4 of 4;
  the 9 real casts all list it; scripts/probes/kits/zhuangfy-empyrean-end.ts). The replay made each a press: a
  78-frame stop, Lone Barge's buff for 25 s more, the Empyrean's end on its own clock (4d60's 6 s after the log's).
  The empyrean buff ticks once at its end, logged as the ultimate (`every`, `ticksLoggedAs`, `endFollowsTick`).
  4bfc plain 795 → 819, mismatch 29 → 15 (per hit closer, total 0.3 → −0.8%); a hold-out better; **4d60 worse** (707 →
  696, −1.8 → −4.1%): the fake stop held Arcane's Solemn Phalanx runs (98.5→131.7 s), Perlica's weapon (115.8→143 s)
  and a Sunderblade's timer 2.6 s, which the game holds 3.6–6.1 s by something unlogged (`zmdlogs holds 4d60`: those
  bounds dropped; the replay's Stagger window 114.30–133.37 s takes no holds; the enemy away 117.22–124.45 s): open.
  **2026-11-25 (the remaining leads):** not the Empyrean's clock (below: its end is on time in every log); the runs
  asking 3.6–6.1 s all span the enemy-away stretch 117.22–124.45 s, but Perlica's weapon asks 6.6–8.6 s in its
  21.4 s run too (a refresh the replay misses: no clean clock) and no ultimate pair overlaps there (scratch
  ult-overlap probe). Still possible: a boss-phase pause of the operators' timers while the enemy is away (no log
  with an away stretch has been checked for it: d774's 24 s away window at 30.6–54.6 s is the test), Arcane's Will
  burst runs refreshed by a burst the replay doesn't make.
  **2026-11-26 (the enemy's clock): a pause of the operators' timers while the enemy is away is ruled out**, in both
  logs: Xiranflow's layers (buff_equipsuit_expend_spelldamage, each layer its own 25 s) on Zhuang Fangyi run on time
  across the away windows: 4d60's layer from 108.12 s is listed to 135.90 s and gone by 137.88 s (24.38–26.36 s of
  world time across 117.22–124.45 s: 0–2.0 s of hold, not the 7.2 s gap), d774's from 29.59 s to 56.21 s, gone by
  56.79 s (26.62–27.20 s of world time across the 24 s away window). Its layers aren't one of the placement's clocks
  (`maxStacks`), so `zmdlogs holds` doesn't show them; `zmdlogs lanes <fx> --buff expend`, `zmdlogs worldtime`. What
  asks 3.6–6.1 s in 4d60 is Perlica's weapon and Arcane's Will burst runs: a refresh the replay misses, still open.
  **Fixed 2026-11-26 (bursts and cooldowns): not a refresh, a whole-game pause in a Stagger.** The ruling-out above
  doesn't hold for 4d60: Xiranflow's 108.12 s layers can't show a pause, a later consumption replaces them (3 layers at
  most; Zhuang Fangyi consumes again at 124.94 and 137.49 s, and the layer is gone by 137.88 s); and the counts above
  took Zhuang Fangyi's Empyrean end at 106.47 s as a 78-frame stop (query.ts replayTimeStops still does: 28 frames of
  it inside the window), so its world time is 25.3–26.7 s. d774's away window (Si's phase) does run on: Perlica's
  weapon from 17.05 s is unlisted at 54.59 s. In 4d60 (eny_0120_klbear_tower015) every clock across 117.22–124.45 s
  runs about 6–7 s long: the log's Stagger 115.75–133.34 s (the engine's own 12 s; `zmdlogs stagger`), Perlica's Wild
  Wanderer (15 s; 21.3 s of world time to its end), her Qingbo layer (15 s; listed through 18.8 s of world time with no
  combo of hers to refresh it), Arcane's two Solemn Phalanx debuffs on the enemy (5.5–5.8 s past the replay's, whose
  other runs end 1.4–2.6 s before it), Liino's beats (10.5 s between two, else 2.7–4.3 s). The placement couldn't
  place it: the Stagger was a still span. Engine assumption `pause-holds`, new default `away` (holds.ts withoutGaps:
  the away stretches cut out of the Stagger's still span): 5.4 s placed in 117.50–124.18 s, 13 clocks spanning each
  unit, earliest and latest within 0.4 s; 4d60 plain 696 → 806, −4.1 → −1.5%, no other log moved, hold-outs
  unchanged. Also on the way: the replay's Stagger window record took its start as its end less the Stagger's length,
  so a Stagger the log's listing holds read 10 s early (d4fb 97.26 → 86.50 s, 41.41 → 30.70 s), and the placement
  took that as still (replayrecord.ts: no earlier than the last sample; c4f3 −3.0 → −2.5%, c6d8 plain 112 → 125).
  The hold placement's stop list (buffreplay.ts, before replayedCastStops) leaves out an event the replay read as a
  tick since 2026-11-24 (placement leads); query.ts replayTimeStops (the views' world time) still counts it.
  **4bfc 179.51 s (2026-11-24, the lead's question): Empyrean's end, not a cast**, but the replay makes a cast there
  (stop 179.50–182.10 s) because its empyrean buff has already ended: Arclight's attack chain runs unbroken through
  that stop (179.50, 179.93, 180.17, 180.57 s), Zhuang Fangyi's _ult forms are logged to 179.17 s and her plain
  finisher after. **Fixed 2026-11-25: a frame boundary, not the clock.** The replay's Empyrean ended at 179.50 s
  (frame 5385), the event's own frame; d774's at 135.20 s was held 0.37 s to its event at 135.57 s (heldTicks), which
  ends it on the event's frame too. The advance to that frame ticks and ends the buff before loggedTick looks, so the
  replay made a real ultimate (a 78-frame stop) at both. holdinputs.ts endedWithTick reads an event on its buff's end
  frame as the last tick (4bfc plain 819 → 820, d774 374 → 379, nothing else moved; tests/slow/log-cases.test.ts).
  **Ruled out: ExtendBuffAction as a pause.** Each Empyrean action holds ult_base over its first 17–35 frames; as a
  pause of its timer, 4bfc's third Empyrean (about 685 frames of actions) would last 47 s of world time, the log's
  26.65 s (`zmdlogs worldtime 4bfc… 144.37 179.51`, less 1.02 s of placed holds): it can only hold an end that falls
  inside an action's window (the kit's G4 reading, at most 35 frames), which no log's end tells apart.
- **Ruled out: Arcane's Susceptibility layers** (1.5%): 170k of the 194k is one hit, e82d 9.12 s (Si's combo, crit
  unlogged, a fallback) that fits two ways (the crit with Arcane's Susceptibility the log's way, or the verdict's reading: the crit with
  suit_atk02.edge ×2 and wpn_claym_0018.combo_ready unlogged); the rest is 24 hits over 16 fights at start / end boundaries.
- **Ruled out: "Arcane's weapon Arts DMG Taken ×0.80"** (1.2%): it is Detonation Unit's (wpn_funnel_0008, Arcane's weapon in 9c6e,
  7910, 1cd1, 5082, d774), not Solemn Phalanx's, and 147k of the 153k is 9c6e at 27–28 and 90–95 s: two targets in a single-target fixture (the
  second target lacks the debuff). A multi-target import.
- **Arcane's Will burst buff (Solemn Phalanx, 0.9%): not the weapon, her bursts.** Every listed run of
  buff_wpn_funnel_0016_will_atk starts at a logged Arcane burst's ms (90 of 91 at +0 ms;
  scripts/probes/kits/arcane-will-burst.ts), as the kit has it. Of her 130 logged bursts, 87 land within 150 ms in the
  replay, 19 at 0.15–0.55 s, 24 with no landing near. The buff's error is where the replay bursts and the game
  doesn't: after her WILL touch (b7b3 5.97 s, c83c 65.10 s: fire onto fire, the log credits Wulfgard alone; 9a80
  30.50 s) and her ultimate's infliction (fc63 40.80 and 85.13 s), or the game's burst seconds later (b7b3 10.34, 9a80
  35.05, c779 9.68 s).
  **Fixed 2026-11-24 (the cooldown-clock round): her own ultimate's stop holds her burst** (engine assumption
  `burst-stops`, reading `all`; `others` the old). b7b3: the touch at 4.95 s, her ultimate's stop 5.60–7.17 s; the
  replay burst at 5.97 s inside it, the game at 10.34 s after hers and Tangtang's. Her own combo slow-down still
  doesn't hold it (0eef: the touch comes after its reset at frame 9). Over her 130 logged bursts (the new
  scripts/probes/bursts/arcane-bursts.ts): within 150 ms 89 → 94, none near 23 → 20, replay-only 24 → 21; Perlica's and
  Xaihi's one each better, no operator's worse; b7b3 plain 44 → 47, 489c, 984748, 9c0b, c779 better, hold-outs 2
  better. **Ruled out:** the ultimates' stops alone (no combo slow-down holds a burst): 79cc's 24.23 s burst fits it,
  but e82d, c6d8, d774, dbae and four hold-outs worse. **Left:** 79cc 24.23 s (Ardelia's combo placed 0.8 s late from
  its travelling projectile holds the replay's; her combo's own event at 23.03 s would end the slow-down before the
  touch); 9a80 35.05 s (`zmdlogs bursts`: 1.44 s of world time after her array at 29.09 s, 0.44 s more than the
  delay with every stop held: what starts it later is open); fc63 40.80 / 85.13 s (her ultimate's WILL stack on an
  element the replay's enemy has and the game's doesn't: Typhoeus's Nature consumption before it, not her clock);
  c83c 65.10 s (fire onto fire after her touch, the log credits Wulfgard alone). In-game test 33 isn't needed for these:
  the element question decides none of them.
  **2026-11-25 (the remaining leads):** **fc63 40.80 s fixed: ultimates in turn, not Typhoeus.** Gilberta's ultimate
  (hit frame 60 at 43.58 s) was placed at 41.58 s over Perlica's (41.77 s); the log has no hit by anyone in
  39.94–41.73 s, Typhoeus's Barrage Array ticks at its frame 65 (38.17 s) and next at frame 75 (41.73 s), and her shot's
  burst (39.94 s, 10 enemy frames) and Arcane's array burst come after the second stop (43.58, 44.63 s): the two stops
  played one after the other, Gilberta's from 39.92 s (logcasts.ts inTurn; Ultimates pressed together, below). The
  44.63 s burst now pairs (−430 ms). **fc63 85.13 s: the touch's element, not Typhoeus.** The replay's enemy had Pulse
  at 84.13 s because Arcane's touch at 81.47 s applied the Corrosion opener's consumed element (`--trace-buff
  status:infliction`); the game's had Nature: Typhoeus's power shot at that ms consumed it (its burst at 87.81 s reads
  ×1.169 the replay's and the shot itself ×0.897, so ×1.303 = enchence_burst_damage_rate 1.3 on the burst) and Arcane's
  array found none left (no burst). So the touch applied Nature here, the opener's applied element (Arcane's own
  battle skill onto Perlica's Pulse at 80.40 s): the reading round 5 ruled out on b74c, a multi-target log. Measured
  as the touch's element for every reaction opener (scratch patch, eventSourceOf: the reaction's element instead of
  the consumed one): see "Arcane's WILL combo touch" below. **Ruled out for the late bursts: Imprisonment's
  slow-down of the enemy's clock** (SealAction, the curve 0.3 → 0.2 → 1 over its `duration`, default 1 s: about 0.42 s
  of the enemy's time): 45 of the 50 bursts the bursts view gives a logged touch within 1.6 s as cause come 0.97–1.12 s of world
  time after it, on time. 9a80 35.05 s: the replay's burst is due just as Gilberta's ultimate stop starts (30.50 s);
  0.44 s more delay, from whatever source, puts it after Rossi's ultimate stop, the log's 35.05 s; open
  (2026-11-25: the log has no hit by anyone in 29.66–30.00 s, before Gilberta's combo slow-down, where one hidden hold
  of a dodge's 0.4–0.5 s would carry the burst into her ultimate's stop and past Rossi's; the placement puts none
  there, and a burst isn't one of its clocks: a burst's world-time delay from its infliction's logged hit as a hold
  bound would decide it; 2026-11-26: not sound, the placed holds don't hold bursts and bursts run late with the
  combos between, as every clock does: "The enemy's clock" below). 79cc 24.23 s:
  the log's burst comes 1.01 s after the touch with no hold at all, so Ardelia's combo slow-down (its event at 23.03 s
  with Arcane's) didn't hold it: a combo pressed before Arcane's frame-9 reset (23.02 s placed) would be cut by it;
  a frame either way; open.
- **Gilberta's weapon Arts DMG (1.2%): a clock, not the kit's 15 s.** 150k of 159k is 4a64's first instance: listed
  to 29.15 s (16.5 s of world time), the replay's ends at 28.23 s; an instance buff, so not one of the hidden holds'
  clocks (`zmdlogs holds 4a64 --why wpn_funnel_0011`: runApart). Rossi's (24.53 s, 57 frames) and Gilberta's (24.90 s,
  52 frames) ultimate stops overlap 1.53 s in the placement; held one after the other they give the 1.5 s. Elsewhere
  the 15 s fits (4360 4 of 4 within 0.35 s, 00ae, 207f); fc63 12.37 s runs 18.6 s with no stop, which the placed holds
  take (check 30.70 s against the logged 30.99 s). Still possible: ultimates pressed together play their stops in turn.
- **Typhoeus's Hovering ATK (0.7%): two placements.** The 5th shot's burst (9090 ×4, bdf2, fc63 16.00 and 47.16 s,
  00ae 30.02 s; the open item under "Typhoeus, Arcane, Liino, Perlica") and her combo's last arrows at a floating start
  (fc63 37.61, 58.99, 81.81 s, 9c6e 27.75 s): the log's battle-skill press comes 0.14–0.18 s before the replay's
  start, made inside her combo's uncuttable frames (the kit allows it 0.2–0.7 s later); press → first arrow over 36
  presses 85–334 ms (one across a stop), about 105 or 215 ms (scripts/probes/kits/typhoeus-press.ts): a buffered press, at the log's batched ms.
- **Next on the list, not kit values:** Xaihi's Auxiliary Crystal Amp (c3c7 56.13 s, 59 hits: no listed run; it needs
  the treated operator at Max HP, which the engine doesn't simulate: the N2 interim); Laevatain's Scorching Heart
  (f879 112.55 s, c83c 70.06 s: a refresh on reaching 4 Melting Flame that the replay lacks; f879's battle skill at
  93–97 s is placed off its logged hits); Si's ultimate Amp (1–6 hits a fight at its start or end); Liino's stance
  (its own sections below).
- **Zhuang Fangyi's Sunderblades, left:** d774 104.18 s, the Empyrean's free battle skill: 3 logged hits, no final,
  where the replay plays 8 and the final (300k replay-only); 4d60 125.40 s: the replay's 8 against the log's 9 since
  the fix above (a Sunderblade's 36 s ran out without the fake stop: the same unlogged holds). **d774 104.18 s
  (2026-11-25): not the Empyrean's clock; the team's hits thin out.** After the third strike (104.50 s) nobody but
  her hits until Arcane's ultimate at 107.08 s (her attacks at 105.02, 107.18, 108.68 s, 1.5–2 s apart; Perlica and
  Liino none from 103.9 to 109.8 s), as at 30.63 s, where her series stops at three as the enemy leaves for 24 s.
  Truncated series elsewhere resume after a stop (4bfc 168.24 s: five, then the last three and the final after
  Perlica's ultimate). Still possible: the enemy out of the Sunderblades' reach (a boss's move: positional, not
  simulated), an end of the strike entity the data doesn't show.
- **Ultimates pressed together play their stops in turn (2026-11-25, logcasts.ts inTurn).** Of the 27 pairs of
  different operators' ultimates whose placed stops overlapped (scripts/probes/placement/ult-overlap.ts), 12 had a
  stretch with no logged hit by anyone of about the first one's stop length right before it (fc63 1.66 s for 1.73 s,
  00ae 1.74 / 1.73, 4a64 1.97 / 1.93, d774 1.61 / 1.67, …): the first stop was there, and its landing after its own
  stop (Gilberta's frame 60, Arcane's ultimate_skill2 frame 58) was held by the second's. 489c: Arcane's attack 4
  split by a 1.84 s gap at 25.94–27.78 s; fc63: Typhoeus's Barrage Array ticks once between the two stops. A pass
  after the placement moves an ultimate placed from its landing's frame to where its landing's world frames put it
  through the other's stop (heldStart), or, logged at that stop's end, to the latest start the log leaves quiet; only
  where no logged hit falls inside the moved stop, by no more than the stops it overlapped, in time order against the
  stops as moved (one of a pair moves). Development plain 67.9 → 68.1%, hold-out 78.5 → 78.7% (none worse); 00ae 607
  → 687, 9090 995 → 1027 (a shot that hit nothing no longer needed: Arcane's stop holds Typhoeus's hover), 1d91,
  7910, c4f3 better. **Worse:** 489c plain 591 → 488 (its total −1.9 → −0.3%): the hidden holds re-placed (units at
  37.73 / 50.75 s gone, the Corrosion ramp's bounds dropped as conflicting; Si's, Arcane's and Gilberta's Corrosion
  readings fail from 46 s on), not the moved stop itself; 40d9 two plain hits assumed (Link and Gilberta's weapon
  within 500 ms of the moved cast); 3f78's total −4.8 → −5.6%. **Left:** 15 overlapping pairs, mostly chains of three
  stops (d774 Liino, Arcane, Perlica at 118–123 s) or pairs whose first is anchored to its cast event (Liino's, Si's,
  Tangtang's); 489c's hold placement. **489c's holds, the mechanism found (round 12, `cli-ab 4188729^ --patch <view
  diff> --holds 489c`, holds --verbose's pins and conflicts):** the in-turn stop holds the replay's Corrosion by Li
  Zhiyan 2.07 s more of world time (its expiry 47167 → 49233 ms), so its status bound turns from a hold of 1.19–1.84 s
  over 13.1–48.8 s into at most 0.19 s over 13.1–49.2 s (the log's Corrosion ends at 48.81–49.22 s); the ramp readings
  asking 0.3–0.4 s there now conflict with it and with the bleed ticks 41667⇒47127, and the placement drops them.
  Ruled out: the units moving by themselves (each unit's pins name the bounds). **Found and fixed 2026-11-25 (holds and
  placement round): the Corrosion's end, held by Si's freeze.** The in-turn stop is right by the ramp itself: the log's
  steps lag the replay's by a steady 0.31–0.41 s from step 3 (17.7 s) to step 12 (33.0 s), across both stops in turn
  (25.94–27.91 s: the log's ramp gained under 0.41 s in 1.97 s, Gilberta's stop there); overlapped, the replay's would
  have run 1.6 s ahead. The odd clock out was the status bound: Si's Immobilization at 43.62 s held the replay's
  Corrosion's end 1.5 s (`--trace-buff status:corrosion`: expiry 47.17 → 48.67 s with no application moved, the
  ramp already capped), against four clocks that agree on about 1 s of hidden hold over 13–49 s (the Vulnerable run
  from 12.03 s ≥ 0.35 s by 27.8 s, the ramp ≥ 0.35–0.40 s by 19 s, the bleed and Combustion ticks 36.5–38.0 s
  0.42–0.55 s, the bleed 45.66–47.13 s ≥ 0.03 s). With a freeze holding neither Corrosion's ramp (since 2026-11-23)
  nor its end, the status bound asks 1.06–1.71 s and every early ramp bound is kept (`zmdlogs holds 489c --assume
  freeze-ramp=runs --verbose` for the old). Combustion's ticks run on through a freeze too (f978's at 57.80 and
  58.80 s, across Si's Immobilization at 57.6 s, land plain): engine assumption `freeze-ramp`, new default
  `statuses` (clock.ts statusesRunOn: none of the four Arts reaction statuses held; the operators' debuffs still
  are). Measured: development plain 68.1 → 69.0%, hold-out 78.7 → 79.0% (1 better, 0 worse); 489c plain 488 → 632
  (above the 591 before the in-turn move), mismatch 45 → 14. **Worse: db87** (plain 209 → 208, damage −4.5 →
  −6.0%): its Corrosion (unlisted, read from the damage) still acts at 54.75 and 55.31 s, 0.58 s past this reading's
  end; the same window's Combustion ticks come every ~1.5 s (50.67, 52.17, 53.75 s) inside a Stagger, where the
  placement places no hold (holds.ts `still`), an enemy-clock delay of about 0.6 s nobody explains yet. A
  Corrosion-only reading (its end and ramp, the other statuses held) measured the same on 489c and db87 but not on
  f978's ticks. Still possible: Electrification and Solidification held after all (no log decides them); db87's
  Stagger-time delay. The holds per stretch (round 12's backlog point 5) weren't needed for this.
  **2026-11-26: the delay is the combos'** (below, "The enemy's clock"): each of db87's four Combustion tick pairs in
  47.4–53.7 s spans one combo stop and comes 0.09–0.21 s late (0.59 s in all); no Stagger, enemy action or
  Imprisonment does it. Not fixed: holds allowed at the combos' stops in a Stagger (`stagger-holds` `combos`) move
  db87 −6.0 → −5.9% only (the least total takes the 0.44 s from holds placed earlier), and no clock bounds the
  Corrosion past the replay's end (db87 lists none; its ramp steps read only hits the replay's Corrosion reaches).
- **The placement's 20 unsettled casts (round 12's settleCheck; 2026-11-25): a third pass doesn't settle them.** One
  more pass 2 from the in-turn placement's stops, then the in-turn rule again (docs/tried/2026-11-25-third-placement-pass.diff):
  12 settle, but 4a64's, 7910's and 9090's oscillate (a fourth pass moves them back: Rossi 21.23 ↔ 24.55 s, Arcane
  43.33 ↔ 46.06 s and 59.03 ↔ 61.62 s) and bring new overlapping ultimate pairs (14 → 15). Development plain 68.1 →
  67.8% (9090 1027 → 985, 4a64 166 → 156, fc63 511 → 521). Pass 2's rules read stops pass 2 itself moves; iterating
  swaps two placements instead of converging. Still possible: a pass that moves a cast only where the log's quiet
  stretches favour the new start.
- **The 14 overlapping ultimate pairs (2026-11-25): what the log says per pair** (inTurnStart's checks, per pair):
  six have logged hits inside the stop the earlier one would take in turn (04d4 Snowshine / Ember at 46.9 s, 4a64
  Si / Rossi at 67.1 s, 7910 Ardelia / Liino at 55.1 s, the earlier anchored to its event too, 9c6e Liino / Arcane,
  a7a7 Si / Liino, d774 Arcane / Perlica): not in turn by the log, or landings batched there. Five are 2–4 frames
  (04d4 135.9 s, 4a64 Arcane / Gilberta at 62.0 s and Si / Gilberta at 23.1 s, 3f78 Si / Rossi, d9e5 Typhoeus /
  Gilberta): the log's ms. The other three (3f78's chain Rossi / Gilberta, b6aa Arcane / Si, d9e5's chain Gilberta /
  Arcane) resolve with
  two extensions of the rule (a moved stop allowed 3 frames into a third one's, and the reach counting a teammate's
  combo slow-down: docs/tried/2026-11-25-in-turn-chains.diff), but the logs get worse: d9e5 plain 86 → 50 (Gilberta's
  ultimate 3.6 s earlier, before the fight's first logged hit), b6aa mixed. The pinned list stays as it is.
- **Liino's ultimate windows: fixed 2026-11-24 (placement).** Her Pyrotechnics (frame 76, `detached`) fly 0.1–0.8 s
  of the world's time before they land (dbae: the first song beat, frame 77, at 8.26 s with the cast event, the
  projectiles at 8.61 s), so a cast placed from them came late, its stop over teammates' logged hits and its Amp
  (frame 77) after hits the log has under it. The log's ultimate event sits at an edge of the stop: at its end for
  most operators (no hit by anyone for the stop's length before it: Si 26 of 35, Liino 13 of 21, Laevatain 11 of 16;
  scripts/probes/placement/ult-events.ts), at the press for others (Liino's 1d91, 8915, 9847; Ardelia's af7b, 7910;
  Cosmovoice ATK's listed `since` equals the event where the log has one: scripts/probes/placement/liino-amp.ts).
  logcasts.ts eventStopStart: an ultimate whose first landing is on its way (`detached` or a random landed count) and
  whose landing's frame puts its stop over a teammate's logged hit starts from such an event. 1cd1 −7.5 → −3.5%,
  af7b plain 588 → 599, 1d91, 9c6e (Ardelia's ×1.5 attack 3s under the Amp), 5082 (Ardelia's sheep). Left: 9c6e's
  total (−13.1%, two targets) and 9090's Electrification at 64.40 s (Perlica's run 0.1 s short after the stop moved,
  a knife edge). **2026-11-24: a kit field for a travelling landing** (KitHit.travels, the compiler from the data's
  LaunchProjectile: packages/data skillData.ts projectileSkills). It reproduces the event rule for every projectile
  ultimate (Liino, Ardelia, Fluorite), with or without the contradiction check, but not for the ability entities the
  rule also takes: Tangtang's stare (b7b3 plain 47 → 45 from its frame, its 10.34 s burst off) and Arclight's dash
  (3aa6 +1 plain from its frame). So the rule stays, with the field: a travelling first landing always from its event,
  another detached one only under the check (the same placements as before; tried:
  docs/tried/2026-11-24-travelling-landings-only.diff). **2026-11-25: the data has no movement for them.** Neither
  entity's SkillData (chr_0027_tangtang_ultimate_skill_1: ContinuousFindTargetAction in an 8 m cylinder,
  ChannelingAction at 0.5 s per target; chr_0007_ikut_ultimate_skill_abentity: FindTarget, Damage, Interrupt) has a
  LaunchProjectile or a move, and the AbilityEntity definitions aren't in the data sources; marking both `travels`
  (measured, scratch patch to kits.ts) moves no log: the contradiction check already places them from their events.
  So no field; the check stays for Si's slashes.
- **7e19's Chen ×1.15: her food, fixed 2026-11-24** (fixture buildOverrides: Ginseng Meat Stew, fit-build 17 of 19,
  the ultimate's lower ratio included). Ruled out first: P1 (the fight starts at the data's Max HP, her hits ×1.15
  from 5.4 s at 99.9% HP; a27b, the same enemy, fits P1 off above half, d4fb switches it on at 0.499 of the HP; P1's
  +0.2 DMG would be ×1.185 on her basic attacks, not ×1.152; the log lists P1 on every hit of hers in every log, the
  buff and not its condition), a listing difference (only Pogranichnik's team ATK `values`, plain elsewhere). The
  Endministrator has the same stew by hand in this fight, d9e5's whole team against the same enemy. Ember and
  Pogranichnik fit as exported.
- **7e19's Ember −21.5%: fixed 2026-11-24, every finisher hit deals as on a Staggered enemy** (engine assumption
  `finisher-stagger`, reading `cast`), as the Stagger a finisher needs to be cast: 7e19 −4.9 → −1.1%, both hits ×1.096
  now (tests/slow/log-cases.test.ts). The only development finisher with a hit after its Stagger's end (the other 38
  multi-hit finishers list the Stagger on every hit: `zmdlogs hits --all --json`, power_attack events); Chen's ultimate
  hit at the same ms is plain unstaggered, so it is the finisher's, not a longer Stagger. 6339 37.5 → 40.8%: its
  finisher's hit_2 at 21.60 s is replay-only (the log has none; Hard 33's slug, below). Left: the ×1.096 (Pogranichnik's
  team ATK layers listed as `values`?). Before: her finisher's second hit at 33.15 s ×1.564, 117k of her 128k: ×1.43 is the Staggered
  parts (multiplicative 0.3 and DamageToBrokenUnitIncrease 0.27) the first hit at 30.86 s has, times the ×1.096 her
  hits from 25.8 s share (Pogranichnik's team ATK as `values`?). The log's Stagger ends at 30.86 s (no
  poise_break buff on the 33.15 s hit) and the replay's at 33.13 s. **Still possible:** a finisher's hits all deal
  with the Stagger its first hit had (04d4's pairs, 0.6 s apart and both Staggered, can't tell); the ×1.096 a team
  ATK layer count. **Next:** the other logs' Finisher second hits after a Stagger's end (`zmdlogs hits --all --event
  power_attack`). **2026-11-25: not Pogranichnik's layers.** The log lists 7–9 instances of buff_wpn_sword_0012_atk_up
  (stackingType 11, max_stack 2 at every level: SkillPatchTable) on everyone's hits from 25 s; the replay gives two,
  and Chen's ultimate hits and the Endministrator's attacks under the same nine-instance listing match plain (`zmdlogs
  hits 7e19… --json`): two act. The ×1.096 is Ember's own, on four hits of three kinds (knockdown, combo, both
  finisher hits) from 28.60 s; her 25.81 s knockdown (×1.182) is her weapon's layers (another reading fits it).
  **2026-11-26: the check and her talent's layers** ("The damage factors" above). Before: still possible: her gear set (suit_poise01: the replay's +0.08 ×4 and +0.16 the log never lists, its
  poisedmg_01_attackbuff listed only on the finisher), Pogranichnik's talent 1 at two layers from 28.60 s.
- **Trigger cooldowns: the clock from the data (2026-11-24, the cooldown-clock round; KitTrigger.cooldownClock, engine
  assumption `trigger-cooldowns` `kit`).** The game has two mechanisms (cooldownTimers in packages/data skillData.ts):
  a CD timer (AddGlobalCDTimer / CheckGlobalCDTimerAction, named by a buff ID; or a `…_cd` buff whose duration the key
  sets) and a timed marker (CreateTimedMarker / CheckTimedMarkerCondition). The compiler matches a trigger's cooldown
  key (or literal seconds) to them: CD timers and cooldown buffs on the world's clock (Swordmancer, Mi Fu's P3 shield
  ATK, Antal's talent heal, wpn_claym_0004 / 0006 / 0007, suit_spellburst; Laevatain's Final Strike absorb by hand: its
  passive_teammate_cd buff isn't reachable from the trigger), timed markers on raw time (Glorious Memory's 0.5 s
  layers, Sundering Steel's, Xaihi's crystal and 19 more; 8 whose mechanism the trigger's sources don't reach stay raw
  too: the Endministrators' P5, Xaihi's crystal count, Estella's and Fluorite's P5, Typhoeus's two, wpn_lance_0006,
  wpn_sword_0010; tests/cooldown-clock.test.ts). Measured: the same as `world` for every trigger (earlier
  pending 04d4, 2fd9, d4fb, de6a better). **The two hold-outs' worse totals are Swordmancer's** (a measure with only
  its trigger on the world's clock moves both; Laevatain's alone moves no log): their verdicts don't move, replay-only
  4.9 → 4.8% and log-only 4.9% unchanged, so the procs it drops are ones the game didn't deal and the totals are low
  for other reasons. The four kit tests that failed under `world` are timed markers (stay raw) but for chen-solo,
  whose second combo's Swordmancer proc the ultimate's stop between now holds (tests/kit-chen.test.ts). **Not decided
  by a log:** a timed marker's clock (no development log moves with `world` for them) and a BuffData addingCooldown's
  (Typhoeus's arrow buffers 0.2 s, wpn_lance_0006 30 s; raw). Before: the largest "no cast" one-sided kind is Swordmancer's proc (191k replay-only over 10 landings; de6a 51.80,
  137.83 s). Every wearer's Physical status with no logged proc came under 15 s of the world's time since the last proc
  (de6a 15.01 and 14.98 s, at 18.8 and 20.5 s of log time; d4fb 11.85, 14.16 s; fc63 14.28 s), every proc past it
  (17.8 s and more); one exception, d4fb 97.05 s at 16.67 s (scripts/probes/cooldowns/physuit.ts, `zmdlogs
  worldtime`). Mi Fu's P3 ATK in 2fd9 fits the same. Skill cooldowns stay on raw time (test 18). `world` for every
  trigger: earlier pending 4 better, development 1, two hold-outs' totals worse, and four kit tests' fights change
  (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel's layers, chen-solo): not every trigger cooldown
  is a CD timer, so not the default (done above). **Left:** the d4fb exception (97.05 s at 16.67 s of world time) an
  unlogged hold the placement doesn't place? **2026-11-25:** the same kind of Lift (Chen's combo) as the procs at
  78.34 and 106.13 s, no chance on the trigger, no gap over 1.2 s in the log between 78.3 and 97.1 s and no placed
  hold there, no ultimate pair in turn; 1.67 s of hold would be needed. Open, the only exception of 30.
  **2026-11-25 (`--trace-trigger suit_phy01.proc`):** the replay's cooldown is ready at 94.87 s (78.33 s + 15 s + the
  three combo slow-downs between, 46 frames), so 2.18 s more world time is needed by 97.05 s; the Lift is logged
  there (buff_physical_airborne at 97.05 s), so the status was applied. **Ruled out:** a Stagger holding the cooldown
  (86.50–109.93 s is Staggered: held, the 106.13 s proc couldn't come either); an unplaced cast's stop (the log has no
  cast event there; Lifeng's only slow-down is at 96.93 s). Open.
  **2026-11-26:** also ruled out: one cooldown shared by the set's wearers (Chen Qianyu and Lifeng both wear it in
  d4fb; Chen's proc at 196.89 s comes 7.5 s after Lifeng's at 189.37 s); a cooldown restarted by every Physical status
  in it, proc or not (106.13 s procs 9 s after the 97.05 s Lift). The combos' extra hold ("The enemy's clock", below)
  gives at most 0.2 s a combo, 0.6–0.8 s over the three between 78.33 and 97.05 s, not 2.18 s. Open.
  **2026-11-26 (bursts and cooldowns):** the "Staggered 86.50–109.93 s" above was the replay's window record, not
  its state: the log's Stagger begins at 97.05 s, **the Lift itself is the breaking hit** (bar 3.56 → 0, the next
  hit lists Stagger), and the replay's enemy isn't Staggered before 97.26 s (its hits there plain); the record read
  its start as its end less the Stagger's length (fixed, above). Across every wearer (scripts/probes/cooldowns/lifts.ts,
  each status with the cooldown clear): no other breaking Lift with the cooldown clear; 0c14's 182.30 s Crush breaks
  the bar and procs (a Crush isn't a control). So "a Lift that breaks the bar applies no status (the break's own
  control replaces it) though its damage is dealt" fits, on one case. The other combo-Lift misses are cascades:
  3.37 s (the fight's first, no proc before, bar 296: unexplained; the replay's proc there takes 9.38 s's, which the
  game made) and 126.13 s (14.16 s of world time after 106.13 s, which the replay misses because of 97.05 s). No
  listed buff tells the procs from the misses (Vulnerable, Fracture, Stagger alike). Not built: one case each.
- **0c14 (−4.9%), 4e36 (+2.2%), de6a:** not placements. 0c14: Rossi's ultimate stabs −2.5% of the total (crits
  unlogged: "Rossi" below), Si's log-only inkmove_2 at 181.42 s −1.5%, the Endministrator's Crush ×2.2 −1.6% (the
  last two one cause, found 2026-11-26: "The damage factors" below). 4e36:
  small replay-only basic-attack tails (Si's attack4, Ardelia's attack3 projectiles) and +1.6% matched. de6a: the
  Swordmancer procs (above, fixed) and Pogranichnik's combo hit_3 / ultimate harass replay-only against his log-only
  combo hits at 132–134 s (a placement of his combo: open).
- **The damage factors (2026-11-26, damage-factors round; largest first).**
  - **Crush ×2.2 (0c14) and ×1.90 (2fd9): one cause, not Crush.** Every development Crush hit (`zmdlogs hits --kind
    crush`: 0c14 133.1 and 182.3 s, 2fd9 22.3, 47.9 and the killing 70.0 s, 7e19 33.7 s) reads exactly with the data's
    multiplier (CRUSH 300–750% by the Vulnerable stacks consumed), the physical level coefficient and Arts Intensity:
    **ruled out** the formula, its stack scaling and its modifiers. Both misses were stacks: Rossi's perfect combo
    (combo_3 frame 29) consumes an infliction for a Lift **and** one more Vulnerable stack, so one infliction the
    replay lacks costs the Crusher two stacks. 2fd9's was fixed by round 4 (Snowshine's counter bash supplies the
    infliction at 14.56 s: 22.3 and 47.9 s now plain at 4 stacks). 0c14 182.30 s: the replay consumes 2, the log 4
    (172,059 = the log's listing read at 7.5, exactly); the missing infliction is Si's Cryo from a battle-skill press
    at 153.99 s the log shows no hit of, which the replay skips because it made her 139.68 s press inside the away
    stretch (134.97–152.91 s) as her battle skill, whose Artful Intent then ran on to 162.10 s (so the 153.99 s press
    read as Initial Stroke). The game's away press landed nothing: no Artful Intent burst at its end (the replay's
    163.13 s burst_mark is replay-only), no Jade Vessel on the 152.9–154.2 s hits (×0.92 with it); and the 153.99 s
    press was her battle skill: Jade Vessel's enemy_vul (only its Immobilization gives it) is listed from 155.79 s,
    the next logged hit after its landing, and its Artful Intent ends at the log's 181.00 s with the inkmove_2 burst at
    181.42 s. With both presses so (then hard-coded as a measurement): Rossi's 165.49 s Lift, the crystal shatter
    and the Endministrator's Essence Disintegration team ATK (165.49–186.28 s) appear, the Crush and Si's 167 s combo
    slashes read plain; 0c14 plain 172 → 293. **Built in general (2026-11-26, away and presses; the diff deleted):**
    (1) the replay's enemy is away in the away stretches (engine assumption enemy-away `absent`, the default:
    TimelineScenario.enemyAway, timeline/landing.ts): a hit landing there applies nothing to the enemy (no damage,
    application, Stagger, enemy-side buff or hit event; an Arts Burst still lands, its effects coming: 4a64's Nature
    burst at 29.30 s, unlogged, gives Arcane's weapon debuff the log lists from 51.31 s; held back it cost 6 plain),
    while what it gives its own team still comes: d774's Liino presses her battle skill at 49.86 and 53.20 s inside its stretch and the log lists her
    stance's ATK on the team after it (9c6e's three presses at 15.3–21.4 s the same), so the operators' own buffs from
    such a hit apply. (2) A hitless press is made from the listing (`hitless-presses` `inferred`, the default:
    replayrun.ts inferredPress): only with the log's own cast event, a slot press the enemy was there for, its skill
    able to start, the log's first hit after its landing within 1.5 s listing a new run of a decided game buff, and
    the replay with the press giving that buff's kit buff there and without it not; the press after it is then the
    variant it pulls (pullingPresses: Initial Stroke), and its own landings aren't counted (the log would show them).
    Across the development logs it makes two presses: 0c14's Si at 153.99 s and 891566c224f8's Liino at 111.23 s
    (her stance's ATK from 111.65 s). Alesh's 12.5 s combo ("0c14" below) has no cast event: not made so (made from the listing since, listed-casts). With
    both, 0c14 plain 172 → 293 as hard-coded, its total −3.4 → +2.7%: the hits that now fit raise it onto what the
    replay over-predicts elsewhere (Rossi's 58 replay-only landings, 0.30M). **Found (2026-11-26, combo hold and
    replay): most of those 58 were one cast's tail.** Rossi's battle skill at 35.40 s lands its two charge hits (35.94,
    36.06 s, logged) and then nothing the log has: no Lift at frame 35 (36.57 s), no wolves (37.13 s), none of the 16
    bleed ticks they start (to 52.83 s), and no Endministrator combo shatter (36.57 s) that Lift sets off, while Si's
    attack4 hits around them are logged (the enemy there). Without that Lift the Vulnerable stack it adds is missing,
    so her 52.04 s battle skill takes no follow-up: the log has its Lift's hit (53.55 s, exactly the replay's value
    once the first cast ends) but neither the Lift status nor the wolves. Built as engine assumption `unlogged-tails`
    `cut` (the new default; replayrun.ts tailCuts, ReplayCastOptions.endsAt): a battle skill, combo or ultimate whose
    landings after its last logged one are none of them in the log ends there; not where the log has a hit of its
    operator's casts no other cast holds in that span (a follow-up's, a tick's, a variant's: 3f78's Rossi combo_2
    whose combo_3 the log has), where a decided game buff the tail starts is listed as a new run (db87's Camille
    ultimate: her gear set's and weapon's buffs on Laevatain after its unlogged hits), in an away stretch or in the
    fight's last 1.5 s (2fd9's killing Crush); the earliest first, the replay made again after each. 0c14 plain 293 →
    336 (43.5–60.2 s plain: the Endministrator's Essence Disintegration ATK and Razor Clawmark no longer there), the
    replay-only landings 58 → 14 (0.30M → 0.07M); its total +2.7 → −3.2%: its Rossi landings that stand for logged
    hits are ×0.943 (−5.7%) and Si's ×0.964 below the log, which the tail had covered. **Next:** 0c14's Rossi and Si
    under-prediction (−5.7%, −3.6% on matched landings). **Found (2026-11-26, 0c14 and the operator curve; "0c14"
    below):** half of Rossi's was the totals counting crit-unknown hits at expected crits (`totals-crits` `read`), 18k
    her attack 4 on the controlled path while a teammate (paths.ts pathLandings), the rest Alesh's unlogged
    12.5 s combo (her weapon's second layer, her P3) and a Stagger at its breaking hit: the team −3.2 → −1.3%.
    **The tail rule's cuts across the logs (2026-11-26; scripts/probes/tails/cuts.ts):** 16 cuts in the development
    logs, 7 dropping a landing the `kept` replay has; none against the log. 0c14's Rossi (the rule's case) and Alesh's
    60.17 s slam_ex (her combo on the Rare Fin path, "0c14" below; gone since the path is the listing's, 2026-11-26); 4bfc's Arclight combos at 44.27 and 48.23 s (the
    placement made one combo's three hits two casts: the cut drops the first's extra hit2s); 9c6e's Liino combo at
    48.53 s (two enemies: her 47.72 s hit 1 on both, the second taken for hit 2, the 48.49 s hit 2 for a new combo's
    hit 1, whose hit 2 the cut drops; the total −13.2 → −13.5% only lost a landing that stood for nothing; a placement
    rule taking a landing at its cast's previous one's ms as a second enemy's, its next slot 3 frames or more later
    and no other's stop ending there, fixed the combo and broke 40d9's Si, whose combo slashes the log batches at one
    ms, Si −23%: dropped); de6a's Pogranichnik combo hit_3 (its hit_2 0.3 s later than his other combos' and the log
    has no hit by anyone from 29.73 to 32.05 s: the enemy out of reach; its −0.4 → −0.8% total a replay-only landing
    gone). The other 9 move nothing (the kept replay lands no more). **Still possible:** a cut where the placement's
    split of one cast into two hides the tail (4bfc: right by luck), so a cast split view first. Also fixed on the way: a recorded burst
    whose record's applier isn't logged (recordedburst.ts: the latest logged applier more than twice the buff's life
    before the burst) is unread, not read over 73 s of every hit (0c14's 181.42 s burst had shifted Si +0.18M).
  - **04d4 Catcher ×0.470: his weapon at level 3** (fixed: fixture buildOverrides). fit-build threw on him (his P1
    hits scale with DEF and a DEF food's % is in an unknown formula slot: such candidates are now unscored): weapon
    level 3 alone fits 188 of 248, 160 of 167 clean. 04d4 plain 185 → 376, mismatch 833 → 616, per-hit 17.9 → 6.5%
    (its total +2.1 → −3.0%: the over-prediction had hidden a deficit; Snowshine's ×0.962 is one part). Not checked
    against the weapon's skill levels (3, 2, 3): the breakthrough table isn't in the data sources.
  - **04d4 Snowshine ×0.9624: still open, narrowed.** (2026-11-26, combo hold and replay: **ruled out** her
    operator level, potential, weapon skill levels 1 and 2 and each pairing of them, scratch scan on computeStats: levels
    74 and 75 bracket it at ×0.9596 and ×0.9656, P0–P3 ×0.988, the weapon's skill 1 at levels 1–3 ×0.971–0.990 in steps
    of 0.0096, none of 336 pairings within 0.001; one gear piece fewer moves 2.5–16.6%, so a piece's variant line, its
    artifice or a node subset are what's left.) The ratio is one constant on every hit kind, reactions included
    (0.9621–0.9629 at damage bonuses 1.00, 1.16, 1.22, no ATK buffs on her), so it's ATK; exactly her attribute bonus
    3.325 → 3.200 (Str −25 or Will −62.5) with base ATK unchanged. **Ruled out:** a weapon level, an attribute-node
    count, or both (scratch scan of every pair: nearest nodes 3 + weapon 84 ×0.9606, nodes 2 + weapon 88 ×0.9646);
    her nodes give Str 10, 15, 15 (and 20 at promotion 4), so no count drops 25. fit-build's two-input fits (a level
    and a food, 86 of 148 clean) are coincidences of that kind. **Still possible:** a gear line (one piece's variant:
    her gauntlets' Str 43, an edc's Will 41), Former Finery's skill-1 level (Will 68 at level 4), her potential's Will
    (+20 at P4), a subset of nodes (the engine takes the first n). (2026-11-26: her nodes are 1, 3, 5, 7 at Str 10,
    15, 15, 20, break stages 1–4; nodes 5 and 7 need favorability 300 (fc63, 0c14's Si), so at promotion 3 two nodes,
    1 and 3, give ×0.9774 of the ×0.9624; the rest, ×0.9846, is attribute bonus −0.05: Str −10 or Will −25, which no
    node gives alone. Still a gear line or the weapon's skill 1 with the two nodes: fit-build's pairs next.)
    (2026-11-26, bursts and cooldowns: **the logs can't decide it.** Her nodes' favorability in CharGrowthTable is 60,
    150, 300, 300, so no favorability gives the ×0.9624 alone (two nodes ×0.9774, one ×0.955). On top of the two
    nodes, every single change and every pair of 97 (potential, each weapon skill 1–9, operator and weapon levels,
    each piece swapped for another of the set's eleven or left out; scripts/probes/stats/snowshine-builds.ts): no
    single change within 0.001, 46 pairs within it (her weapon's skill 1 at 5 with one edc fewer ×0.9624, the body
    and an edc swapped ×0.9621, …). One constant on every hit is one number: any of them fits, and the multi-target
    146d is the same build. What no log records (her gear's lines, favorability) is the player's screen, not the
    owner's: leave it as the fixture's offset.)
  - **7e19 Ember ×1.096: half the check, half her talent's layers.** (1) The check dropped her listed Pay the Ferric
    Price (+0.09 ATK, talent 2, on `attacked`, so its state is the log's) as if it were one of Pogranichnik's two
    Thermite Cutter layers (+0.09 ATK each): loggedEntries matches an unjudged buff's entry against any engine
    modifier of the same zone and value. Matched against its own game buff only (adopted by the lead 2026-11-26 in
    enginecheck.ts loggedEntries; the held-back diff deleted), her 25.81 s slam fits
    with Fervent Morale at its boundary (+0.17 ATK%), and the hold-outs go 79.0 → 80.4% plain (3 better, 0 worse).
    (2) Left ×1.0457 at 28.6–30.9 s and ×1.0957 at 33.15 s: one and two more +0.09 ATK layers. Ferric Price stacks to
    3 (stackingType 10, one timer each layer refreshes), and the log lists one entry whatever its layers: 04d4's Ember
    hits under its listing read ×1.023 (her build offset), ×1.085 and ×1.147, steps of exactly one layer
    (`zmdlogs hits 04d4 --operator Ember --json`), 99fb ×1.08. So 7e19's second layer came at about 26.2 s and ran to
    about 33.2 s (the lane's 24.85–31.85 s is the first layer's). **Ruled out** for the ×1.096: Pogranichnik's weapon
    layers (all four operators list the same nine instances, the others plain with two), Fervent Morale (one
    instance on her), her gear set (the replay's Æthertech lines the log doesn't list would lower, not raise, the
    reading). **Built (2026-11-26, away and presses):** the check reads a kit buff the replay can't judge whose
    layers run on one timer (BuffData stackingType 8 or 10) and the log lists once at a hit at each count up to its
    maximum (enginecheck.ts unjudgedLayered, an assumption of kind `layers`): 7e19's 28.6–30.9 s hits fit at 2 layers
    (mismatch 4 → 1), 04d4 mismatch 616 → 614, 99fb 116 → 111; the negative control holds. **Still open:** the
    33.15 s finisher ×1.096: the log lists no run of Ferric Price then (its lane 24.85–31.85 s), so the layer that
    refreshed it past 31.85 s is unlisted, and no listing-based reading reaches it.
  - **Rossi's ultimate ×1.090 (9a80) and ×1.081 (2fd9): fixed earlier.** Every stab of both fits within ±1 now (27 and
    27 hits, `zmdlogs hits 9a80 2fd9 --operator Rossi --event 'ultimate_skill$'`; plain or crit-assumed).
  - **Rossi's slash2 extras: not the bleed clock.** Of the 13 slash2s on an enemy listing her bleed, the 3 without a
    Seething Blood extra (207f 42.85 s, 4a64 29.15, 71.46 s) are each the last logged hit of the fight or of Si's first
    life (no hit by anyone within 3 s; scripts/probes/rossi/slash2.py); the other 10 have theirs at the slash's ms and
    bleed ticks after. The enemy dies or leaves at the slash. Neither fight reads as a kill (no capped last hit), so
    the totals counted the extras; a rule taking every unlogged landing of a fight's last frame was mixed (4a64 +2.9 →
    +2.0%, 207f −2.9 → −3.5%) and too broad (0c14's same-frame extra before another hit's kill is logged).
    **Superseded (2026-11-26, away and presses; the diff deleted):** two general rules cover 4a64's both. Under
    enemy-away `absent` the enemy leaves with an away stretch's last logged hit, so a landing no logged hit stands for
    at that hit's frame or later in the stretch isn't counted (29.15 s, Si's first life's end; with it Arcane's Nature
    burst at 29.30 s, 47k); and a fight of several lives ends in a kill when the damage after its last life's end is
    one Max HP within 0.5% (enginecheck.ts lastLifeKilled: 4a64 1.074 then exactly 1.000; also read by enemy-hp
    `kill`), so the kill rule leaves out the 71.47 s extra. 4a64 +2.9 → +0.7%. Neither touches 0c14's logged extra
    (a matched landing counts). **Still open:** 207f's 42.85 s: a fight's last hit with no kill the log shows (5.760
    × Max HP of hdg027, the other two hdg027 logs' kills 5.280).
  - **a9d7 Chen Qianyu's Slashing Edge to 169.40 s (2026-11-26, combo hold and replay): a hidden hold, not a landing.**
    Her ultimate's six slashes are logged to 158.59 s, the stretch's last hit (away 158.59–166.21 s); its final, a
    ~0.4M hit at 159.33 s in the replay, isn't in the log, while the same ultimate's final is logged at 45.12 and
    235.94 s. The edge (buff_chr_0005_chen_talent_0, abilityEvent 13: a landing that deals damage; 10 s) refreshed by
    the last slash at 158.60 s runs to 169.03 s in the replay with its 0.43 s of placed holds; the log lists it at
    169.07 and 169.40 s and not at 169.87 s. A final that landed would end it at 169.76 s (in range), but a landing
    that refreshes it deals damage and the log records every damage (no zero-value hit in any development log), so
    it didn't land; and the weapon's crit layers (wpn_sword_0022) stay at 22 across the stretch, as they would. A
    hold of 0.37–0.84 s between 158.60 and 169.40 s fits: the placement's unit at 153.30 s may go anywhere in
    151.05–166.84 s, and the edge isn't one of its clocks (a layered buff: "not a clock: the kit buff has maxStacks").
    **Not changed:** the away rule's edge (a hit 0.74 s into the stretch landing would contradict d774's unlogged
    strikes 0.23 and 0.27 s in and the totals' rule). **Still possible:** a layered buff whose every layer the replay
    refreshes at pinned landings as a hold clock (its last layer's start to the log's run end), which would place
    a9d7's unit after 158.60 s; it needs the replay's refreshes to be complete, which a missed refresh breaks.
  - **Rossi's bleed ticks and combo_3's over-hold: not reached past the views.** The bleed's unlanded logged ticks
    (489c 44.66, 45.66, 52.18, 72.81, 102.55 s; d572 64.16, 128.21 s: "a landing whose order the kit doesn't give")
    and combo_2 / combo_3's 0.15–0.2 s over-hold (3f78 5.77–8.43 s: the replay's stops are as listed, combo_3 on its
    perfect path as logged) are the hold placement's and the clock's (holds.ts, timeline/), not a kit value: for
    that code's owner.
  - **Cast tails (item 5): no kit cause among the largest.** `zmdlogs totals --all --kinds`: Typhoeus's floating
    attack bursts (9c6e, two targets; fc63), Laevatain's finisher hit_2 (6339, a stage log), Si's combo final (7b54, a
    stage log; c83c), Zhuang Fangyi's Empyrean strikes (d774: the team's hits thin out); basic attacks 1.33% over 32
    fights in small pieces.
- **Moments of change:** hits with a boundary effect are off at 42.8% against 24.2% (hold-outs 29.9 / 9.0%) in every
  skill kind, yet a boundary kit buff taken the other way fits only 1.8%: a marker of a state change, not its own cause.
- **Drift with time:** off rate 12.5% in the first 10 s, 38% at 120–200 s; per fight higher in the second half in 34 of
  57 (p = 0.18; hold-outs 8 of 11): against the placed holds' running total in long fights next.
- **Fight-wide factors below the screen (checked 2026-11-24): not builds.** `fit-build` fits Liino's clean hits as
  exported in both (7910 14 of 19, af7b 20 of 21), so the screen is right not to flag them: 7910's ×1.143 is on the
  hits where Tangtang's weapon Arts DMG Taken is listed with other values (the open 7910 Tangtang ×1.10, `zmdlogs
  differences 7910 --what wpn_pistol_0011`: 311 hits, median 1.000, upper quartile 1.099); af7b's ×1.161 is her
  ultimate at 59.9–60.6 s, where the log lists Eternal Xiranite's team DMG (+0.16, 19 hits fit with it) and the
  Amp's start (above, Liino's windows).

## The enemy's clock: a combo holds every clock more than its stop list says (2026-11-26)

**Shows:** db87's Combustion ticks in its Stagger (47.39, 49.26, 50.67, 52.17, 53.74 s) run 0.59 s late over 6.4 s
where the placement allows no hold (no dodge while the enemy is Staggered), and its Corrosion (read from the damage)
acts 0.58 s past the replay's end. Each of those tick pairs spans exactly one combo's stop.
**Found: across a combo's stop every clock the logs show runs late**, by about a fifth to a half of what the stop
list says the combo holds; across an ultimate's stop, on time (scripts/probes/combo-hold/):
- the enemy's tick chains (Combustion, Rossi's bleed): inside the log's Stagger, chains with no combo stop 0.02 s
  over 30 pairs, with one 3.43 s over 87 pairs (15.36 s held by the combos: 0.17–0.20 ×, about 50–70 ms a combo);
  outside the Stagger, chains with no pair of a dodge's size, the same (0.24 ×; no stop: −11 ms a pair);
- an operator's own cast across a teammate's combo (its first and last landings, both outside every stop): +263 ms
  median over 112 casts (combo-held median 395 ms; 0.33 ×), +9 ms over 4,629 casts with no stop, −13 ms across an
  ultimate's; Arcane's 9-frame combo (her reset at frame 9) +200 ms too;
- Arts Bursts: the world delay past the burst delay 181 ms median over 45 bursts with combos between (0.40 ×), 14 ms
  over 106 with no stop;
- buff runs (exact single runs): excess = 0.45 × combo-held + 0.04 × ultimate-held + 0.008 × duration (532 runs;
  dodges correlate with combos there, so the upper end).
**Ruled out:**
- **Arcane's Imprisonment slowing the enemy's clock** (SealAction's 0.3 → 0.2 → 1 curve, in-game test 37's Arcane
  part): over its duration (6.6 s, about 2.8 s lost) the ticks after a seal ask none (20 pairs with ≥ 0.3 s of that
  loss: residual − loss median −623 ms); over 1 s (0.42 s lost) the tick right after a seal is on time in 207f
  31.91 s, 489c 46.54 and 74.05 s, a7a7 51.88 s, f978 22.37 s, and the seal windows' lateness (54–385 ms) is the
  combos' at those casts (scripts/probes/combo-hold/seal-ticks.ts). Test 37's Arcane part is decided from the logs:
  no.
- **A Stagger or the enemy's own actions** holding the enemy's statuses: Staggered chains with no combo run on their
  period (above).
- **A longer ComboSkill curve** (the named curve is a guess: skillData.ts NAMED_CURVES): 0.01 for its whole duration
  measured verified plain 78.0 → 73.0%, development 69.0 → 68.0%, hold-out 79.0 → 76.7%; 0.01 to 70% then a ramp,
  verified 75.6%, development 68.6%, hold-out 77.8% (docs/tried/2026-11-26-combo-curve-flat.diff). The Corrosion
  ramps, buff ends and landings the verified logs pin fit the guessed curve: whatever holds the clocks above isn't
  the curve every timer follows.
- **A burst's delay from its infliction as a bound for the hold placement** (9a80 35.05 s): the placed holds don't
  hold bursts (012a 31.91, 458b 174.11, 489c 75.17, 7910 29.85 s: on time with 0.10–0.42 s placed between), and the
  bursts' lateness goes with the combos between (above), not with the holds; 9a80's 0.44 s has Gilberta's combo at
  30.00 s inside it. Not built.
**Registered, not the default:** engine assumption `stagger-holds` (`none` the default; `combos`: inside the replay's
Stagger the holds may rise within a combo's stop, up to half its own hold; `combos-full`: its whole hold; holds.ts
comboHoldSpans, placeHolds `slow`). Measured: `combos` development plain 69.0 → 69.2%, hold-out 79.0 → 79.2% (3 better,
2 worse), earlier pending 64.7%, verified 78.0 → 77.5% (0eef 45 → 41: a hold moved into its replay's Stagger window
puts a Corrosion step off at 7.57 s, the log having no Stagger there); `combos-full` development 69.3%, the rest the
same. db87 −6.0 → −5.9% only. Not the default with a verified log worse.
**Still possible:** the time scale's change at a combo's start or end taking effect a few frames late on the clocks
(about 2 frames a combo for the enemy's ticks, 6 for the operators' landings: no single curve does both); the
combo's camera or cut-in holding the teammates' actions apart from the world's clock; the caster's layer-1
TimeDilationAction (dropped by the compiler) on its targets (Arcane's has the enemy among them: 0.25 s, about
0.17 s lost; most combos have none, and their stops show the same excess).
**2026-11-26 (away and presses): a fixed delay at each stop's edge doesn't explain both.** One constant per combo
fits as well as a share of its hold, on both sides (scripts/probes/combo-hold/edge-casts.ts, edge-ticks.ts): the
operators' casts across combos only (76 within 0.4 s) 140 ms a combo, rms 149 ms, against 0.333 × held, rms 147 ms
(none: 223 ms), the residual not rising with the one combo's hold (169, 196, 84, 263 ms at about 300, 400, 500,
600 ms held); the enemy's tick chains 57 ms a combo (rms 117) against 0.190 × held (rms 112; none 153), Arcane's
9-frame combo (177, 12, 105 ms) as late as Si's 24-frame one (164). So the logs can't tell a per-edge delay from a
share, but one delay on the world's clock is ruled out: it would hold the enemy's ticks and the operators' landings
alike, and they differ by ×2.5 (about 1.7 frames a combo against 4.2; `zmdlogs clocks --all`, round 13, gives the
shares as Σ residual ÷ Σ held: 0.23 tick chains, 0.40 casts, 0.33 bursts). **Still possible:** two delays, the
operators' own clock resuming later than the world's at a combo's end (their animation's cut-in); not built
(`stagger-holds` stays off). **Next check:** whether the operators' excess sits at the combo's end (their first
landing after it late, their last before it on time) against its start, from casts.ts --rows split by where the
stop falls in the cast.
**2026-11-26 (combo hold and replay): neither at its end nor before its start; inside its first half**
(scripts/probes/combo-hold/edges.ts, 301 isolated combo stops, within one placed cast against its first landing):
the landings 0–200 ms before a stop's listed start are on time (39, residual 9–22 ms median), so the hold doesn't
begin early; the teammates' landings come at full density from the listed end on (no frozen frames after it), and
those 0–100 ms after it are already 186 ms late (39), 200–400 ms after 240 ms (51): so it doesn't resume late either;
inside the stop the landings at 0.5–0.6 of it are already 294 ms late (the plateau of the guessed curve is 0.4 of it),
at 0.7–1.0 about 200 ms. Arcane's 9-frame combo the same (176 ms after its end). So the operators' clock is held
about 4–6 frames more than the guessed curve within the stop's first half (a longer or deeper plateau for them),
while the enemy's ticks and the buffs follow the guess (the flat curve measured worse). The teammates' landing
density thins out 5 frames before the listed start (7 for Arcane's combos), but combos open on events (a finisher,
a status), so that dip is the windows' selection, not a hold: the on-time landings there say so. **Built and
measured, not the default:** engine assumption `combo-operator-hold` (timeline/clock.ts slowDown: a combo's
slow-down holds each operator it holds N frames more, their bursts included, the world's clock as its scales):
`3f` verified plain 78.0 → 77.4%, earlier pending 67.3 → 66.4%; `4f` 77.1%, 66.4% (9a80 +4, 9c0b +3, c6d8 +13 plain,
4bfc −92, 3aa6 −33); `6f` 76.4%, 66.3%; development and hold-out within 0.1. A uniform extra hold on every operator
at every combo isn't it. **Also a reading now:** the curve itself (`combo-curve`: `guess`, `flat`, `middle`, round
13's backlog point 4), so a curve for the operators alone could be tried next. **Still possible:** the operators'
own animation pause in a combo's cut-in that only some combos have (4bfc's and 3aa6's Xaihi and Zhuang Fangyi got
worse with it), the caster's layer-1 dilation on its targets.
**2026-11-26 (0c14 and the operator curve): a curve for the operators alone measured worse too.** Engine assumption
`combo-operator-hold`'s curve readings (timeline/clock.ts comboOperatorCurve: the operators a combo holds lose the
frames of their own curve, the world keeps combo-curve's guess, 0.01 to 40% then a ramp to 1 at 93%): `plateau-0.5`
(0.01 to 50%, about 1.2 frames more on a 24-frame combo) verified plain 78.0 → 77.9% (4e5e −1), earlier pending 68.0 →
67.9% (3aa6 −13, 4bfc −3, 9a80 +4, c6d8 +4), development and hold-out plain unchanged; `plateau-0.6` (about 2.4
frames) verified 77.7%; `plateau-0.7` (about 4) 77.6%, development 68.9%; `flat` (the operators at 0.01 for the whole
stop) verified 76.0%, earlier 67.6%, hold-out 80.8 → 80.6%. Arcane's team's 9a80 gains (`plateau-0.5`), 3aa6 (Zhuang
Fangyi, Xaihi) loses more. The engine shifts what comes after a slow-down's start by the frames it takes (clock.ts
slowDown), so a curve and a constant differ only in how the total scales with the combo's length: with the uniform
`3f`/`4f`/`6f` and the share-like curves all worse on the verified logs, **ruled out:** one extra hold of the
operators' clocks at every combo, constant or in proportion. Not pursued further (the brief's stop rule). **Still
possible:** a per-combo cause (the cut-in some combos have, the caster's layer-1 dilation), which a per-operator split
of the `plateau-0.5` hits (that measure's variant-2/hits.txt: 9a80's moved hits are Si's, Arcane's and Rossi's, 3aa6's mostly Zhuang
Fangyi's) would start from.

## Fight totals: what moves them (2026-11-23)

**Shows:** the mean |damage error| of the fight totals had stalled (development 8.7%, hold-out 10.2%, earlier pending
8.1%) while per-hit matching improved. Every development and earlier-pending fight (but 7b54, 6339, 8915, c6d8) split by
`zmdlogs totals` into matched scale (predicted − logged of the landings standing for logged hits), replay-only and
log-only landings, as shares of the logged total (scratch/totals-split.ts, scratch/matched-by-event.ts). Most of the
large errors weren't matched scale: they were landings on one side only.

**Found and fixed** (shares of the fight's logged total):
1. **The enemy away (Si's phases).** Gaps between consecutive logged hits fall apart at 6 s (18 of 4–6 s, 1 of 6–7 s,
   30 of 7–46 s), every long one against a boss with phases: 19 in the 8 fights against Si (eny_0134_jsspsi: one of
   about 20–24 s, then 13–14 s, the team pressing and nothing logged), 7 against eny_0125_fdcentur, 3 against
   eny_0128_babyents_hdg031, 2 against tower015. The replay kept landing there (Zhuang Fangyi's Empyrean strikes and
   finale, Liino's finale, Si's Inksoul bursts, Combustion and bleed ticks): d774 25.9%, 4a64 11.1%, 3f78 9.7%, 0c14
   8.4%, 3aa6 5.6%, a9d7 4.8%, e989 2.6%, 9c6e 2.4%. Engine assumption `enemy-away` (`away`; `counted` the old totals),
   read only by fightTotals. d774 +27.2 → +3.7%, 4a64 +11.4 → +1.4%, e989 +3.3 → +0.7%, 3aa6 +3.0 → −2.1%; worse where
   the landings hid an under-prediction: 3f78 −5.0 → −8.0%, a9d7 −13.9 → −18.5%, 9c6e −10.2 → −12.6%.
2. **The Endministrator's crystal shatters placed as ultimates.** buff_common_originum_frozen is both her ultimate's
   third hit and her crystals' trigger hit; the placement chose the ultimate whenever no ultimate was near, so every
   shatter at a teammate's Lift made an ultimate the log doesn't have (0c14: 7, each at Rossi's Lift's very ms, 19.5% of
   the fight; 7e19: 2, 12.5%). Triggers on physical statuses are now placed from the logged status hits (logcasts.ts
   `statusHits`, a trigger's `firedAt`). 0c14 +26.1 → −3.4%, 7e19 +10.4 → +2.0%.
3. **The male Endministrator read with the female's kit.** d4fb's hits are keyed chr_0002_endminm_* for every skill
   (the import reads the roster's virtual ID as the female's): none had a landing (log-only 36.1%, her ultimates
   replay-only 20.0%). logs.ts `withEndminVariant` reads such a log as the male's kit. Her basic attacks were then
   ×0.804 high: basic level 9, not the assumed 12 (the roster gives no skill levels; a `buildOverrides` may now set
   skill levels). d4fb −8.5 → +10.2% (plain 198 → 368, per-hit 7.4 → 4.9%): a compensating error gone.
4. **Hard 27's Electrification.** 207f, 2fd9 and 99fb list buff_common_pulse_pulse_conduct_triggered_do (Arts DMG Taken
   +0.24) with no giver from ~20 s, renewed about every 20 s; no team member is Electric, and it is the only giver-less
   status in the development logs. The stage's: read from the log (enginecheck.ts `stageStatus`). Rossi's fire hits
   ×1.18 → plain (207f mismatch 79 → 16). 207f −15.0 → −1.2%, 2fd9 −19.1 → −13.1%, 99fb −7.4 → −2.5%.
5. Smaller: a kill leaves no HP for replay-only landings at the killing blow's frame (abfd 3.9 → 3.7%); Si's bursts
   (Fixed DMG, no reading) are now their logged hits' parts in `zmdlogs totals`, not a replay-only landing beside a
   log-only hit (no total moves).

**Ruled out:** that the long gaps are the team idling (presses inside them: d774 30.6–54.6 s Liino's ultimate and battle
skills, Arcane's combo; a9d7 158.6–166.2 s cuts Chen's ultimate before its final hit); a Hard 27 team buff (the
Electrification has no giver in three logs from two players).

**Round 2 (2026-11-24): found and fixed.** The view first: `efsim zmdlogs totals --all` (every development fight's
shares, largest |error| first) and measure's "Totals by where the error lives" (each group's means, the hold-outs'
only view). The hold-outs are one-sided: 12 of 13 have replay-only + log-only over |matched| (replay-only 7.3%, log-only
6.2%, |matched| 2.5%), the development logs 24 of 32 (6.4%, 3.9%, 5.3%).
6. **Build offsets: one factor per operator for the whole fight.** a9d7's "fight-wide factor" was every operator's food
   (Jakub's Legacy, ATK +27%; no log against eny_0134_jsspsi lists food, the other seven have theirs by hand): hits
   ×1.15–1.24 from the first second, different per operator by their ATK%; `zmdlogs fit-build` fits Estella 9 of 10
   clean, Pogranichnik 18 of 20 (fixture `buildOverrides`). A screen over every development log (scratch/op-medians.py
   over `zmdlogs hits --all --json`: per log and operator the median logged ÷ predicted of non-crit hits, and how many
   sit within 1% of it) found six more, each confirmed by fit-build: d9e5 every operator's Ginseng Meat Stew (Liino 24 of
   24, Gilberta 8 of 8), 012a Akekuri attribute nodes 0 (14 of 14 clean), 92b4 Liino weapon level 80 (9 of 9), c3c7
   Xaihi nodes 0 and weapon level 1 (29 of 29), ad7f Alesh nodes 0 and weapon 80 (4 of 5), d4fb Lifeng weapon 82 (4 of
   5). a9d7 −18.5 → −5.0%, d9e5 −11.5 → +0.2%; plain +95, +86, +37, +9, +48, +16, +97.
7. **A kill from a capped last hit** (4360). The data's HP is the stage's ÷5.5 (tower016), ÷7.6 (tower015), ÷2 (Si's
   phases): only the Rodin fights were read as kills. Now a capped last logged hit makes the fight a kill (the log's
   total its HP), and the killing frame is the replay's landing of a killing hit when sooner (4360's twelve returning
   lances land in one frame at 119.20 s; the log has eight up to 119.235 s): 4360 +6.9 → +0.5%. A Fixed DMG landing
   standing for a logged hit still counts there (0eef −4.4 → −20.3% otherwise). Compensating errors exposed: 2fd9
   −13.1 → −15.6% (Mi Fu's mangle splitter and a shatter at the killing Crush's frame, the replay's only), dbae −2.3 →
   −2.6%.
8. **An ultimate's fewer landings by time** (3f78). An ultimate isn't cut: when its landings of a key are fewer than
   its slots they take the slots their world time from the first landing fits best (logcasts.ts `realignUltimates`,
   when better than the turn order by 150 ms in all; not for a random landed count, Ardelia's sheep): Rossi's two
   slashes into the slashes' slots (frames 122 and 131, from 111 and 122). 3f78 −8.0 → −3.4%, 7910 −5.9 → −5.8%.
9. **Typhoeus's 4th shot as her 5th** (fc63, 9090, 1d91, 00ae, af7b, bdf2, 9c6e): an off-field-only hit isn't a
   candidate while the log shows its operator controlled, and a cast with a delayed landing logged already isn't joined
   by an earlier frame's landing ("Typhoeus, Arcane, Liino, Perlica" below, with what it exposed: the 5th shot's burst's
   Hovering ATK). fc63 +7.2 → +6.8%.

**Ruled out (round 2):** a9d7's factor as the enemy's (the other seven fights against the same boss and stage,
dung02_bossrush04_03, have no such factor; the factor differs per operator, as an ATK% food does); Si's combo final in
e82d as a placement (one hit, ×1.30 the primary, the log's listing reading it exactly: a listing difference, Yinglung's
Edge and Jade Vessel against the log's damageTaken entries); an ATK snapshot for Typhoeus's bursts (BuffData
takeAtkSnapshot false).

**Still possible / left (largest first; `zmdlogs totals --all`):**
- **The stage logs** (8915 +62%, 7b54 +49%, c6d8 +42%, 6339 +38%): the stages' shields and phase factors (×0.1–0.7 on
  every hit; "Arcane's mismatches", "Hard 33's slug"), not the totals' to fix.
- **2fd9 −15.6%** (fixed by round 4, item 14: Rossi's perfect combo's Lift and Vulnerable stack on Snowshine's
  counter-bash infliction; both Crushes plain at 4 stacks, "The damage factors" above)**:** Mi Fu's Crush ×1.90 low at 2 Vulnerable stacks (22.3, 47.9 s), while her killing Crush at 3 stacks
  is ×1.02 uncapped: the stack count the replay consumes (4.5 against 7.5 would be ×1.67), or her weapon's and set's
  DMG lines the log doesn't list; not checked further.
- **9c6e −12.6%:** two targets (Typhoeus log-only −31%, replay-only +17%): a multi-target import.
- **d4fb +9.6%:** Chen's ultimate matched +6.0% (28 hits); her hits ×1.11 the replay's elsewhere, 0 clean hits to fit.
  Chen's readings mismatch in most logs (35% overall): a Chen kit question first.
- **e82d −8.9%:** one hit, Si's combo final (above). **1cd1 −7.2%** (Typhoeus matched −7.0%), **7910 −5.8%** (Tangtang
  matched −7.5%, replay-only +6.2%), **db87 −4.5%** (Laevatain −9.0 / +4.9): not looked into.
- **Over:** c83c +7.9% (Si's combo final at 56.73 s replay-only, 384k: the log has no final there), fc63 +6.8% (her
  95.1 and 96.5 s shots plain in the log, power shots with bursts in the replay: the replay's Hunting Arrows after her
  hovering ultimate, **fixed round 3**, item 12; 88.35 s a burst the replay doesn't land).
- **Si's Artful Intent burst paths** as replay-only / log-only twins (c779 60.4 s burst_mark against the log's
  inkmove_2, 4e36 35.9 against inkmark_projhit 36.8 s: **fixed round 3**, item 11; 9a80 36.0 s a combo final 1.1 s off,
  open: below).
- The hold-outs: 9.1 → 9.1% (2 better, 1 mixed); their error is one-sided landings (above), which no round-2 fix but
  the kill and the placement touched.

**Round 3 (2026-11-23, the one-sided landings by kind).** The view first: onesided.ts classifies every replay-only
landing and log-only hit of a fight's totals by where it sits (a twin: an opposite-side landing of its operator within
1.5 s, values within ×1.5 "like" or ×3 "other"; `unread`; `twin uncounted (<why>)`: a landing the totals left out;
then a replay-only landing's cast: `no cast`, `cast unlogged`, `cast tail` / `head` / `gap` against its cast's logged
landings; a log-only hit's: the replay's reason for no landing, for a status whether it was dealt within 5 s, by
another operator, or not at all), its nature (kit hit, trigger hit, Fixed DMG, burst, reaction, tick, physical), its
skill kind and flags (`stop`, `cut`, `next cast`, `end`, `away`). `efsim zmdlogs totals <fx> --kinds` lists a fight's,
`zmdlogs totals --all --kinds` ranks them per group and by operator and key; measure's summary gives each group's
means by kind, the hold-outs' only view (no log, operator or key). Before the fixes (development, earlier pending and
verified but the stage logs and 9c6e, 54 fights: mean gross one-sided 4.70% of a fight): twin like 1.10%, a landing
the replay didn't land 0.89%, cast tail 0.84%, no cast 0.70%; by operator and key: Zhuang Fangyi's Sunderblade strikes
log-only (3aa6 −6.5%, d774 −4.6%, 4d60 −3.8%, 4bfc −1.4%), Si's Artful Intent bursts as twins (c779, 4e36), Typhoeus's
bursts (fc63, 1d91), Rossi's Seething Blood extras without a cast (7 fights). The hold-outs' means: cast tail · kit
hit 2.2%, twin like 2.3%, no cast 2.3% (no cast · Fixed DMG 1.0%: Si's bursts), fight end 2.8%.

**Found and fixed (round 3):**
10. **Zhuang Fangyi's Sunderblade variants unpinned.** strike_N / final_N are slotted by the variant with the most
    landings (strike_9's frames 22, 28 … and final_9 73); another variant's hits were alternatives only where they fell
    on a slot's frame, which an 8-blade cast's (23, 29 …, final 70) never do, so none was pinned and the logged strikes
    took the replay's landings nearest in time: 3aa6 at 83.7–87.5 s matched a strike to final_8 (82,869 for 13,193) and
    left the logged final (124,304) log-only. Now a variant's n-th landing of the key is the slot's n-th turn at its
    own frame (logcasts.ts `Slot.at`, castassembly.ts replayedCasts): the final lands on the logged final, exactly.
    3aa6 −2.1 → −1.6% (plain 380 → 394), 4bfc and d774 closer per hit, 4d60, c6d8.
11. **A trigger's alternative paths as twins.** Si's Artful Intent burst is one landing by one of two hits actions
    (through the Inksoul, inkmove_2; as the mark, inkmark_projhit), the same damage (the record) either way; a log of
    one path didn't take the replay's landing of the other (c779 60.37 s: the log's through an Inksoul the replay
    lacked: its Final Stroke there is FORCED), and the replay's record can end 0.9 s from the game's (4e36). Now a
    trigger's hits actions under complementary conditions share their events (buffreplay.ts `alternativeEvents`: Si's
    burst, Typhoeus's arrow rain sub1 / sub2, Last Rite's phantom), and a recorded burst looks 60 frames either way.
    The hold-outs 9.1 → 8.2% (1 better, 1 mixed; their "no cast · Fixed DMG" 1.0% gone).
12. **Typhoeus's Barrage Array tick as a combo** (fc63). Her combo's field ticks 18 times every 1/3 s while the enemy
    stands in it; across her own ultimate's stop (90.6–92.7 s: not taken out of its own cast's elapsed time) the 18th
    tick at 94.26 s fell out of its cast's reach and was placed as a combo of its own, which the replay cast as the
    hovering combo: its conversion gave three Hunting Arrows, so her 95.1 and 96.5 s shots (plain in the log, 14,064 and
    8,876) were power shots with bursts. Now a detached series takes its next slot when its landing comes within the
    slots' gap of the last one's (logcasts.ts `paced`). fc63 +6.8 → +3.3%; no other log moved.

**Ruled out (round 3):** the hold-outs' log-only physical hits as landings the totals left out (after the kill, away:
no `twin uncounted` among them); for Typhoeus's 5th shot's burst (bdf2, 9090), an ATK or attacker-side snapshot at the
arrow: bdf2's combo tick at the burst's ms (+706 ms) lists Hovering ATK too, while the hover's end varies from before
+524 ms (9090 67.67 s, a combo tick without it) to after +706 ms (bdf2), every one past frame 15 (500 ms): the hover's
end comes on her own clock, later than the data's frame 15 by a varying 0.03–0.2 s (hit-stop on a final strike?).

**Still possible / left (round 3; `zmdlogs totals --all --kinds`):**
- **Cast tails** (development 1.9%, hold-outs 2.3%): many small basic-attack tails (Si's attack 4, Mi Fu's hit_2, Rossi's
  attack 4, Laevatain's ult_attack2: a dodge or a swap the log doesn't show, or a miss) and a few big ones (c83c Si's
  combo final +5.0%, d774 Zhuang Fangyi's Empyrean strikes +4.4%, 7910 Tangtang's rogue wave +2.5%, fc63 Typhoeus's
  first shots' bursts 40.4 and 84.5 s). Within a cast, a logged hit placed in the wrong slot leaves the other slot's
  landing replay-only (scratch/misslot.ts: mean 0.18%, 9a80 6.6% Si's combo final against a slash, 7910 1.1%, a9d7
  0.7%, a27b Mi Fu's attack 3 hit_2 against hit): slots by value as well as time, not built.
- **Zhuang Fangyi's Sunderblade count** (4d60 −10.8% log-only): the replay's casts make 6 and 8 Sunderblades where the
  log shows 8 and 9 (77.8 and 83.8 s), so the logged finals have no slot: her Sunderblade gains (a kit question).
- **The hold-outs' log-only physical status hits** (2.45%, "no landing: a status the replay didn't deal near the logged
  hit"): 2.08% of it none within 5 s (measure's split: no such status by anyone near, so a physical status the replay
  never makes: a Lift, Knock Down, Crush, Breach or Shatter from an infliction or a Vulnerable count it lacks, not a
  timing), 0.45% by another operator (in development 04d4's Ember shatters, which the replay deals as Catcher's,
  1.6%).
- **Rossi's Seething Blood extras** (no cast, 7 fights, 207f 1.9%, 4a64 2.0%): one per crit stab in the replay, fewer in
  the log (207f 41.0–41.5 s): the crits the replay infers for her ultimate (`values`) or the extra's own condition.

**Next check (round 3):** slots by value within a cast (9a80, 7910, a27b), Zhuang Fangyi's Sunderblade gains (4d60),
the hold-outs' physical misses by the new split, an offsets screen as a command and a test (friction 2026-11-24 point
1), Mi Fu's Crush stacks (2fd9).

**Round 4 (2026-11-24, physical statuses, Rossi's extras).** Every development log's log-only physical status hit
(scripts/probes/physical/physmiss.ts: the logged hits at its ms, the replay's status landings within 1.5 s and the enemy there) and every
logged Shatter with whom the log credits (scripts/probes/physical/shatters.ts; 42 Shatters in 6 logs). The development logs' share was
small (none within 5 s 0.08%, by another operator 0.03%): 04d4's Ember Shatters (3.7%), Rossi's Lifts, three
Estella / Chen Qianyu pairs.

**Found and fixed (round 4):**
13. **A Shatter at a later Vulnerable stack is the Vulnerable's.** The log credits Ember with the Shatter at Catcher's
    Knock Down (04d4 52.78, 143.12, 300.02 s: her value, 25,993, about ×6 Catcher's); the BuffData agrees:
    `buff_physical_no_guard` is one instance whose on-stack event creates `buff_physical_handle_cryst_break` from the
    buff's own source, before the Knock Down's own handler. status.ts: the Vulnerable keeps who started it (`by`), a
    stack joining it (a Lift's, a Knock Down's or a direct one) shatters as theirs; a first stack, Crush, Breach as
    the applier's. Checked against the other 39 logged Shatters: none changes (scripts/probes/physical/shatter-credit.ts).
14. **Snowshine's counter bash.** Her battle skill ends at frame 106 unless she is attacked in frames 0–51 (a kit
    trigger's jump to 107, its bash at 125); the replay sees no enemy attack, so six of 04d4's 14 logged bashes were
    dropped by the end (those not kept by a later cast of hers), with the Cryo they inflict, the Solidification they
    cause and four Ember Shatters ("none within 5 s"), and in 2fd9 the infliction Rossi's perfect hit consumes for
    its Lift (14.56 s). drivers.ts `eventJumps`: an end that would drop a pinned landing wasn't reached; the trigger's
    jump past it was taken, at the frame that puts the landing at its kit frame. 04d4 plain 180 → 185 (−1.8 → +2.4%:
    the Shatters were hiding Catcher's ×0.47 build offset, "Catcher's weapon (04d4)"), 2fd9 −15.6 → −3.6% (plain
    188 → 246).
15. **Rossi's extras on borrowed crits.** A pinned landing whose own logged hit has no crit took the crit of another
    logged hit of its event within a frame (207f 41.03 s: a stab of 13,441 took the 38,980 one's crit, fired a
    Seething Blood extra the log hasn't). landing.ts `loggedCritAt`: a pinned landing takes its own hit's crit or
    none. And valueCrits compared raw values across a Stagger's start (207f 41.24 s: 13,441 after 6,714, ×1.3 Stagger
    and Susceptibility +0.54 listed from 41.03 s): now values over their listed effects (buffreplay.ts
    `listedFactor`; scripts/probes/crits/value-xval.ts: 1110 of 1222 inferred crits right, 0.908, before 1132 of 1260,
    0.898; Rossi 327 of 327). Rossi's replay-only extras in 3f78 1.36 → 0.24% of the fight. Totals worse where they hid
    Rossi's matched under-prediction: 3f78 −3.4 → −4.8% (her matched −6.6% over 140 landings), 207f −1.2 → −2.9%,
    489c −1.2 → −1.9%, 99fb −2.5 → −2.9%; better 4a64 +1.4 → +0.1%, 9a80 +1.3 → 0.0%.

**Scoreboard (round 4, `npm run snapshots:update`):** development mean |damage error| 7.2 → 7.3% (the Rossi logs
above), plain 67.1%; hold-out plain 77.5 → 77.6%, 8.2% (2 better, 1 mixed, none worse), replay-only 5.2 → 4.9%,
log-only 5.3 → 4.9%; earlier pending plain 63.0 → 63.6%, 4.8 → 4.3%, within 5% 18 → 19; all but the hold-outs 5.8 →
5.6%.

**Tried and dropped (round 4):** two operators' landings at one logged ms in their casts' order (Estella's combo
before Chen Qianyu's: a9d7 178.98 s, c4f3 7.05 and 157.01 s, her Solidified-target hit ×2.0, her Shatter, his full
Lift): c4f3 plain +26, 3f78 +15, but 4bfc −14 (batched landings at a stop's end the other way), hold-out 4 worse
(tried: docs/tried/2026-11-24-same-ms-cast-order.diff).

**Ruled out (round 4):** the hold-outs' 2.08% (log-only physical, none within 5 s) as a Shatter credit or Snowshine's
counter: the hold-out mean didn't move with either fix (2.08% before and after), so it isn't the development logs'
mechanisms; Rossi's slash2 extras as an extras count limit (19–28 extras before it with or without one) or the
reaction at its ms (logged in fights with and without the extra).

**Still possible / left (round 4):**
- **The hold-outs' log-only physical status hits** (2.08% of a fight, unchanged): a physical status the replay never
  makes, of a kind the development logs barely have; measure can split them by status kind (Lift, Knock Down,
  Crush, Breach, Shatter) as a next step, the kinds the hold-outs' operators apply.
- **Rossi's slash2 extras** (2026-11-26: the fight's or a life's last hit, not the bleed: "The damage factors"
  above) (4a64 29.15, 71.46 s, 207f 42.85 s replay-only): a crit (slash2 ÷ slash1 ×3.0, as where
  both crit) on an enemy listing her bleed, yet no extra in the log, where the other nine slash2 crits have one; in
  all three the bleed's last logged tick is at or before it (4a64 28.61 s and 71.458 s at the hit's ms, 207f 42.83 s)
  and later ticks follow in the nine: the bleed ending as the slash lands (its listing lags), the replay's bleed
  running on (4a64 a replay-only tick at 29.60 s): Rossi's bleed clock, open above.
- **Zhuang Fangyi's Sunderblades in 4d60** (−10.8% log-only before the round): the replay's count is 2 + 1 + 3 = 6 at
  77.0 s (the 48.9 s cast's two from an L1 Electrification, 53.0 s's one, the Empyrean's free three) where the log has
  8; the counts before (12.6, 43.0, 48.7, 52.8 s: 3, 3, 5, 3) all match, so two blades come from something the kit
  lacks between 53 and 77 s with no battle skill of hers logged: the free path's data (`normal_skill_ult` frames
  0–15, a branch the tree printer cuts) is the next read; the 83.8 s cast is 9 in the log (the cap), 8 in the replay.
- **Same-ms order** (above), and a9d7 275.51 s (Estella's Lift and Chen Qianyu's Shatter with no logged cast: the
  fight's end).
- Rossi's Lifts on infliction consumed by her perfect hit where the replay has no infliction (0c14 165.49 s: Si's
  presses at 160.48 and 164.71 s show no hit, their infliction the replay lacks).

**Next check:** measure's physical misses by status kind for the hold-outs; Zhuang Fangyi's Empyrean free path in the
data; Rossi's bleed end against the listing; slots by value within a cast (9a80, 7910, a27b).

**Round 5 (2026-11-26, the fights outside ±5%).** Before: development 8915 +62.3, 7b54 +49.0, 6339 +40.8 (stage
logs), 9c6e −13.5 (two targets), c83c +7.9, 7910 −6.1, db87 −6.0%; earlier pending c6d8 +43.9 (stage), e82d −8.9%.
The by-operator means the brief named (Perlica, Liino, Camille, Wulfgard, Laevatain, Purrchena) are the operators'
own totals (scripts/accuracy.ts perOperator), mostly the stage logs' (Perlica c6d8 +165%, Wulfgard 8915 +93%,
Laevatain and Camille 7b54 / 6339 +59–90%) and small totals with a few one-sided landings (Liino's beats the log
never shows: 1cd1 +23%, af7b +20%, 1d91 +18%, 0eef +58% on a 9 s fight; Purrchena 99fb −43%).

**Found and fixed (round 5):**
16. **A cast event logged as its button's other variant** (db87 −6.0 → −1.2%): "db87: ×1.3 on Laevatain's hits"
    below. The Link stack Camille's combo gives went to a forced normal_skill the replay made from the log's
    `normal_skill` events in Twilight. logcasts.ts `buttonVariants` (two skills of a kind, one castable only without
    a buff the other needs, neither giving it on its cast: not Purrchena's battle skill and the counter it readies),
    castassembly.ts `variantCastOf`, and the placement times the variant from that event.
17. **A tail cut takes its detached landings** (c83c +7.9 → +1.9%): Si's combo final at 56.73 s (374k, an ability
    entity's detached hit) came a frame after her last logged slash; the cut at lastLogged + 1 ran after that frame's
    hits and left detached ones alone, though the rule's premise (none of the tail is in the log) covers them. Now
    the cut is at the last logged landing's frame and drops the cast's later hits, detached ones too (drivers.ts
    replayCast `endsAt`). Hold-out mean 8.4 → 7.4% (4 better, 1 mixed), the largest move of the round.
18. **A carried Corrosion shred above the new one's cap stays** (7910 −6.1 → 0.0%, plain 340 → 456, mismatch 102 →
    15): every hit 51–62 s ×1.099 (Liino's ×1.143: one resistance step, +11.35 points either way) after Ardelia's
    forced level-1 Corrosion at 49.37 s replaced Arcane's level 4; the data's tick adds and clamps only while the shred
    is below the cap (combat-mechanics §3.5), so the carried 25.5 stood where the engine clamped to 14.2.

**Ruled out (round 5):** db87's ×1.3 as the sword buff's value, Laevatain's P1 ratio or a Stagger (the engine's
Stagger is on the 42–46 s ones and the log's ×1.3 is on top); 7910's ×1.099 as Liino's weapon layers (cap 4, test
25) or the Stagger.

**Still possible / left (round 5):**
- **The stage logs** (8915, 7b54, 6339, c6d8): unchanged; 6339's largest one-sided landings are Si's combo final at
  11.30 s (16.5%, at the start of the 11.3–14.6 s gap with no hit by anyone: the slug's number shield?) and
  Laevatain's finisher hit_2 at 21.60 s (14.3%).
- **9c6e** (two targets) and **e82d** −8.9% (Si's combo final ×1.205: the log lists Arcane's weapon WILL lines five
  times, will_dmg ×3 and will_atk ×2 at 0.168, the engine has two; five would be ×1.26: not exact, Arcane's weapon's
  stacking, not looked into further).
- **Slots by value: done (2026-11-26, round 6).** logcasts.ts `realignByValue`: a cast's landings of a key fewer than
  its slots, where the slots' kit multipliers differ by more than ×2 (VALUE_TOLERANCE), take the slots their logged
  values fit under one scale (crits aside), then by world time; only where that leaves fewer landings off their
  slot's value; the first slot moves (and the cast's start with it) only for a key that is the cast's only one, when
  the values or the times of the landings no other cast's stop separates fit better. Six casts in five development
  logs: 9c0b's Hunter Pursuit (hits 2–4: started 0.43 s earlier, its Link before Arcane's ultimate; plain 414 → 423,
  2.9 → 1.1%), db87's Camille ultimate at 10.1 s (hit_2 and hit_3, plain 228 → 234), a27b's Mi Fu attack 3 hit_2,
  00ae's Arcane INT lasers (the last laser and the final), 7910's wave. **7910's wave is the early rogue wave by its
  value** (352,792 = ×17.5 her stares, atk_scale_3 8.05 ÷ 0.46, as b7b3's dive wave; the plain wave's 4.6 gives ×10):
  now matched to the plain wave (predicted 201,595, ×1.75 under), 0.0 → −0.2% in total; no dive is logged near
  54.3 s, so what ended her stare early (a dive whose own hit the log lacks?) is open. Tried: the first slot free
  for every key alone by the time cost moved 7910's stares a slot each (Liino's stops between hold her stares less
  than the stop list says), hence the clean-landings rule. **9c6e's Liino combo on two enemies** (round 5's left
  item): a landing at its cast's last landing's ms whose value is that landing's (within ×1.25) and not the next
  slot's is the same landing on a second enemy (logcasts.ts `sameByValue`): her 47.72 s hit 1 (6368 and 6035) one
  slot, the 48.49 s hit 2 (10,743, ×1.69: hit2's 3.15 ÷ 1.89) the same cast's. 40d9's Si combo slashes, batched at one
  ms, are unchanged (no placement there moved); 7b54's Camille combo at 16.34 s (three hit-2 landings, its 17.04 s
  hit 3 the same cast's) moved too.

## Arts Intensity: what the logs settle and what they leave (2026-11-16)

The owner asked whether the engine's Arts Intensity handling is right (it
carries the Grizzled Edge and Arts Intensity gear advice for Estella).
Every status hit of the 79 development logs (1,424 hits; hold-outs
skipped) was compared with the engine's reading at its landing, with the
source operator's AI from the engine's scale part. Details:
combat-mechanics §3.7.

**Ruled out:**
- A wrong damage coefficient: exact matches at AI 0–287 for bursts (179
  hits) and reaction hits (58), 0–182 for Combustion ticks (182), 0–163
  for Lift (81), 31–209 for Breach (11), 119–180 for Crush (9), 0 and 98.7
  for Shatter (11, Estella); logged ÷ predicted shows no slope against AI
  (within ±0.01 per 100 AI for bursts, reactions, ticks and Lift; ±0.03
  for Shatter). The stat hint has one `{Damage}` value for every kind.
- A wrong strength curve: Electrification exact at AI 0–287.4 (47 of 53
  instances), Breach at 31–209 (9 of 21; the rest below), 2,110 plain
  matches under Corrosion from appliers with AI > 0 (up to 287.4).
- The wrong owner: 81 reactions and bursts whose consumed infliction came
  from an operator with a different AI fit the trigger's AI exactly;
  Shatter takes the shattering operator's AI (a9d7: Estella's Shatters of
  Deepfin's Solidification sit at her Lift's ratio, not ×1.70).
- A missing scaled effect: the stat hint lists only damage, strength and
  Lift / Knock Down Stagger; durations aren't on it.

**Found and fixed:** Breach's own hit saw its own new DMG Taken (×1.29–1.44
too high; no Breach hit had a plain match). Now it sees no Breach: plain
0 → 7, assumed 0 → 4, fallback 17 → 6 (combat-mechanics §4).

**Checked with the logged givers (2026-11-16):** since the refresh every
development fixture's effects but 40d9's and 4e5e's carry their giver
(`source`). Of 3,505 kit hits listing an Electrification where the
replay has one, the log's giver is the replay's applier in 3,497; the 8 others
are all 3aa6 (log Perlica 7, Zhuang Fangyi 1, the replay Arclight).
At an agreeing giver each (level, AI) the replay has gives one logged
strength, but for its level III at AI 0: 0.16 (3aa6, d774) and 0.24
(3aa6) besides 0.20, so the replay's level differs there: probably
§3.7's 6 instances off the curve (levels or appliers). The replay has no
Electrification at 237 hits that list one (4d60 96, 9090 41, 4bfc 37, fc63 26,
00ae 16, others ≤ 7). Breach can't be checked this way: the hit export's
enemy facts list reaction statuses, not physical ones (scratch check,
`hitRecords` landing.enemy).

**Still possible:**
- Pogranichnik's Breach strength: 12 of 21 logged instances carry his AI
  ± one Fervent Morale layer (+8) against the replay's (c4f3, a9d7, de6a,
  10df, d4fb). In c4f3 the battle skill's own SP layer counts for the
  strength (71150: hit lists 2 layers, strength 3) though not for the
  hit's listing; elsewhere the replay has a layer the log doesn't. A layer
  timing (talent bank, expiry) rather than the curve. Next check: the
  strength read after the battle skill's `beforeDamage` SP trigger, against
  each instance.
- Shatter's coefficient itself is checked at two AIs only (0 and 98.7);
  it shares the `{Damage}` value with the kinds checked to 287.
- Lift / Knock Down Stagger × (1 + AI/200): the logs show no Stagger of
  their own (4e5e 12219's one exception open), so nothing to scale.
- Ember's status hits in 04d4 are ×1.0226 at AI 0 and 12 alike (Knock
  Down and Shatter): AI-independent, the ×1.023 her other hits there have
  too (accuracy plan: Ember low in every log, uniformly per build).
- Multi-target logs (10df, 8273) leave their Breach hits as mismatches
  (a9d7's "fight-wide factor" was its team's food: fixed 2026-11-24, "Fight totals").

## Buff timing leads (the buff timing report, 2026-11-15)

**Shows:** `efsim zmdlogs timing` (docs/design/data.md, "The buff timing
report") over the 27 development logs: of 4,487 fallback and mismatch
hits, 1,209 fit one kit buff toggled (at stake 1.80M), 148 only a pair,
3,130 none (19.66M: most misfits aren't timing). Hints, not fixes ("Fits
need a mechanism"). The top runs, by damage at stake (|logged − engine|):

1. **Yvonne's MI Security ATK** (suit_criti01.atk), 5082: absent in the
   engine 45.1–48.7 s (19 hits, 418k; its nearest instance 7 s away), and
   ending 3.1–3.7 s early at 38.1 s (5 hits 41.2–41.8 s, 88k); the log
   lists it at all 24, none against. *Mechanism candidate:* its trigger is
   on Yvonne's crits, and her combo and ultimate hits from 41.2 s have no
   crit flag in the log; the replay counts those as non-crits, so the set
   never re-stacks. Plausibly part of 5082's Yvonne −23% (journal
   2026-11-15).
2. **Si's ultimate Amp**, 9c0b: absent in the engine 13.8–25.4 s on all
   four operators (47 hits, 402k; listed at 47/47; nearest instance
   46.6 s away). *Mechanism candidate:* the log's hitless Si ultimate at
   7.0 s (a cast event): the replay doesn't make it, or its Amp doesn't
   land; Arcane's ultimate lasers at 21 s are ×1.200 low.
3. **Typhoeus's Barrage Array** (Nature Burst DMG Taken), 1d91 and 9c6e:
   "starts early" (7 hits, 80k) and "ends late" (4 hits, 36k) on the same
   windows (1d91 9.8–16.2 s and 51.5–57.5 s): the hits fit without it
   across the engine's whole window, the log lists it at none. No
   mechanism near (its source is the combo's first arrow). **Closed
   2026-11-15: the log check's, not the engine's.** The kit buff had no
   `gameBuff`, so the check counted the logged
   buff_chr_0034_typhoea_combo_enemy_debuff as a log-only buff on top of
   the kit's (Typhoeus's bursts ×1.07 over the log), and toggling the
   kit's off "fitted". The replay's own landings of her bursts under it,
   with it, match the log exactly (1d91 11 of 15, among them the
   11.4–14.4 s hits above; bdf2 4 of 5; fc63 14 of 30; 00ae 7 of 13); the
   log lists it there (the "lists it at 0" above counted the kit's name).
   With the `gameBuff`, 1d91's listed bursts go from 11 mismatches to 12
   plain. Left: 1d91 at 55.5 and 56.7 s fit without it exactly (the log
   stops listing it ~2 s before the engine's end: the boss leaving the
   6 m area?).
4. **Laevatain's Forgeborn Scathe basic DMG** (wpn_sword_0006.valid), 9c0b:
   absent in the engine 32.0–34.8 s (5 hits, 71k), listed at 5/5. NO
   MECHANISM: its trigger is her ultimate cast, and none is within 20 s
   before.
5. **Gilberta's Arts Susceptibility**, 489c, 4360, 9847: 42 hits fit the
   log's values, not the engine's (59k): a value, not timing. No mechanism.
6. **Liino's Vocalist Stance ATK**, af7b: absent in the engine 1.5–53.8 s
   (245 hits, 56k, listed at all); the candidate is her logged hitless
   battle skill at 1.6 s, which the replay doesn't make (af7b's placement,
   "Buffs through stops" below). Ambiguous: vocalist_linger and
   cosmovoice_atk fit the same hits (same values).
7. **Laevatain's Hot Work Heat DMG** (suit_fire_natr01.heat), 79cc and f879:
   ends 2.2–4.8 s early (6 hits, 46k), and absent in f879 107.5–108.6 s (3
   hits, 20k), listed at all. *Mechanism candidate:* its trigger is on
   Combustion (reaction), and her Combustion ticks come at 100.0 and
   106.5 s in the windows: a tick (or a re-application) may refresh it in
   the game, the kit's trigger only the application.
8. **Estella's Physical Susceptibility** (combo), c4f3: ends 2.6–2.7 s early
   at 34.3 s (2 hits, 26k). *Mechanism candidate:* Gilberta's ultimate
   stop starts at 34.5 s and Pogranichnik's combo slow-down ends at 34.4 s,
   at the engine's end: a hold (B11) of another length.
9. **Gilberta's Delivery Guaranteed Arts DMG** (wpn_funnel_0011), 4a64: ends
   2.9–4.4 s early at 23.9 s (14 hits, 23k, listed at all). Three ultimate
   stops (Si, Rossi, Gilberta) run 24.5–26.6 s, 0.6 s after the engine's
   end: a hold candidate if its end really falls inside them (outside the
   report's ±0.5 s, so marked NO MECHANISM).
10. **Liino's Medicant ATK** (wpn_lance_0014.atk), 1d91: "starts early" by
    0–3 s in 11 runs (78 hits, 20k), "ends late" in 8 (44 hits, 12k): each
    engine start is at one of her logged hitless battle-skill events (the
    stance's beats, `ticksLoggedAs`). *Mechanism candidate:* the heal that
    triggers it lands after the beat (its projectile), not at it. The log
    lists none of it (1d91 doesn't list Liino's buffs), so only the damage
    says so.

Also: Si's Amp carried past its end by Combustion's snapshot (db87, c83c,
6 hits; "Ink Melt logs" below); Arcane's Imposing Champion Arts DMG Taken
ending 2.6–3.6 s late in 9c6e (7 hits, 20k, no mechanism); Camille's
Vesperwings Susceptibility absent by the damage in e989 69.2–70.9 s (5
hits, 18k) with the engine's instance 61.7–89.3 s.

**Ruled out:** none of these yet (the report only reads).
**Still possible:** chance fits where two buffs' values fit alike (the
report lists them as "also fits"), and on small hits (±1 above 0.05%:
"coarse"); a run that fits "starts early" and "ends late" on one window
is one buff absent across it (3 above), not two shifts.
**Next check:** 1 (replay the unknown crits' bound), 2 (why the replay
skips the logged ultimate), 7 (whether Hot Work refreshes on ticks).

## Rossi: her bleed, her ultimate's crits and what remains (2026-11-22)

**Shows:** Rossi had 594 mismatches in her 9 development logs (`efsim
zmdlogs groups --operator Rossi`), 402 of them in 2fd9 and 99fb (Hard 27:
every hit, "Hard 27" below); in the others her bleed ticks and Seething
Blood extras led (113 and 144), with 116 hits without a landing.

**Found and fixed:**
1. **The bleed keeps only ATK from its application.** One d572 bleed
   (applied 13751 ms) ticks 1750 → 1595 when Camille's set DMG +0.16 ends
   ((1.80 − 0.16) / 1.80 = ×1/1.0972), 1363 → 844 when Wolven Blood's
   max-stack bonus and its layers end (×1/1.614), then 1287, 1346, 1386,
   1426, 1466 as new layers come; its crits go ×2.0 → ×1.5 as the combo's
   Crit DMG ends; it stays 1595 when Camille's weapon ATK +0.096 ends
   (`zmdlogs hits d572 --operator Rossi --event bleed --json`, listing per
   tick: scratch). So `takeAtkSnapshot` on the bleed keeps ATK (and the
   attributes behind it), not the whole attacker side as Combustion does
   (engine effects.ts ATK_SNAPSHOT_ZONES). measure: 489c, d572, 9a80, 4e5e
   plain up, mismatches down.
2. **A tick at its buff's application doesn't see the buff's own
   modifiers** (`tickOnApply`): every bleed's first tick lacks its +12%
   DMG Taken (d572 13751, 46554, 114924 ms ×1/1.12; 489c 25917, 60612;
   9a80, 4e5e, 2fd9, 99fb alike), as its end-frame tick does (timeline
   PendingHit.firstTickOf).
3. **The bleed's clock is the log's** (`KitBuff.ticksShownByHits`, as
   Liino's volleys). Logged ticks against the unpinned replay's
   (scratch: each logged tick's offset from the nearest replayed one):
   ±0.1 s of jitter tick to tick, and steps of 0.3–0.6 s at other casts'
   time stops and slow-downs (489c 30.6 s after Gilberta's and Rossi's
   overlapping ultimates −368 ms; 52.2 s after three combos +310; 4e5e,
   2fd9, 99fb likewise), a few without a placed stop (489c 37.97 s +420 ms
   by Rossi's attack 5 and Arcane's laser; 55.7 s by her finisher). The
   bleed runs through Rossi's own combo slow-down in the log and in the
   replay alike (2fd9 20.2–22.3 s, 99fb 22.7–25.8 s: ~1 s apart through
   it). No kit timer explains the steps; they follow where the replay
   places others' stops, which it can't know better, so the replay takes
   each tick from its logged one. 489c mismatches 108 → 95 with 1 and 2
   in (measure).
4. **Crits the log leaves out of her ultimate.** Every development log
   gives Rossi's ultimate stabs (and the hits during them) no crit (crit
   null: 489c 54 stabs, d572 54, 4a64 54, 3f78 53, 0c14 64; scratch count
   over the fixtures), so the replay's main run critted none and landed
   none of the Seething Blood extras, which the log has at each crit
   stab's very ms. The replay now counts as crits the largest m of an
   operator's crit-less hits at a moment where a trigger on crits logs m
   hits (replaycrits.ts shownCrits). measure (with 3): development plain
   52.0 → 52.4%, mismatch 18.2 → 17.7%, mean |damage error| 12.6 →
   10.1% (489c −12.6 → −0.7%, 9a80 −14.7 → −0.4%, 3f78 −32.2 → −6.2%,
   4a64 −30.9 → +7.2%); hold-out 1 better, 0 worse (12.1 → 11.7%); 0c14's
   total +8.5 → +10.4% (it over-predicts already: Si and Alesh, "0c14"
   below; its per-hit error closer, 36.1 → 35.3%).

**Ruled out:** the bleed snapshotting its DMG bonus or crit (1 above);
Rossi's own combo slow-down holding the bleed's ticks (3); a kit-side
tick timer for the steps (none fits both the steps and the steady
stretches between them).

**Still possible / open:**
- **Hard 27** (2fd9, 99fb): 402 of the 546 left, the enemy-wide term below.
- **The combo's Crit DMG window** (combo_crit, 15 s): in world time (time
  stops out, castTimeStops) from the combo_3 cast, the game's ends between
  Rossi's last ×2.0 crit and her first ×1.5 one: 489c (16.21, 16.43),
  (14.95, 15.96), (14.13, 14.37) s; 9a80 (16.48, 16.49); d572 (14.78,
  15.45), (14.02, 14.38); the replay's are 14.57 each (scratch: per cast,
  the crit zone each crit hit implies). Longer and shorter than 15 s by up
  to 1.9 s: the stops' placement again, or a hold the replay lacks (489c's
  and 9a80's long ones hold no ultimate of hers, so not her ultimate).
- **Wolven Blood at max stacks** (wpn_sword_0022.final, 20 s): the log's
  runs last 19.5–20.3 s of world time where no ultimate of hers falls
  inside (d572 three runs, 2fd9, 99fb), but 21.9–22.3 s in 489c's first
  (her ultimate overlapping Gilberta's) and 20.55–20.8 s in d572's second
  (her ultimate alone); the replay's are ~19.6 s. Its layers then restart
  ~2.5–3.5 s early in the replay (489c 43.9 s against the log's 46.6 s,
  74.0 against 77.5 s): 489c's ×0.95 / ×1.12 at 47.0–48.8 s and ×0.72–0.78
  at 81.2–84.8 s, d572 66.9 s ×1.48. Candidates: her own buffs held longer
  than her ultimate's 57-frame stop (~1 s in d572), overlapping stops
  holding them for their sum (489c: Gilberta's 1.73 s + hers 1.9 s against
  their union 2.0 s), the stops' placement. 2026-11-22 ("The buff clock"): the sum is ruled out (Si's Amp);
  the runs' length is the fight's hidden holds (perfect dodges), which the replay now takes from the log's
  listing (`hidden-holds`); its layers' restart is still the replay's.
- **Corrosion's ramp in 489c at 30.2–32.5 s**: her stabs rise 16220 →
  16378 → 16536 and the bleed 4781 → 4894 by ~1% a second while the
  engine's Corrosion is already at its level-2 shred (17.12 → 17.6 at
  30.80 s): the ramp later or slower in the game (under the ultimates'
  stops), the bleed ticks at 30.6 and 31.6 s mismatching.
- 0c14: her Combustion ticks ×1.55–1.68 at 28.7–37.6 s, Lifts ×0.61 (58.1
  s), ×1.49 (132.4 s), ×1.60 (179.9 s); not looked into.

**Next check:** the final's and the combo window's runs against every
stop in their windows (which stop's placement or hold moves them), in
489c and d572.

## Rossi's ultimate ×1.090 (9a80) and ×1.081 (2fd9)

**Closed 2026-11-26:** every stab of both logs fits within ±1 (`zmdlogs hits 9a80 2fd9 --operator Rossi --event
'ultimate_skill$'`, 27 and 27 hits). The rest of this entry is the history.

**Shows:** every ultimate hit low by one factor, crits and non-crits alike
(9a80: 16058 logged vs 14727, crits 46567 vs 42708). Matches in 4e5e,
489c, 4a64. **2026-11-22:** 9a80's stabs fit plain at commit 1ab4647
already (non-crit 16058 predicted 16058, `zmdlogs hits 9a80 --operator
Rossi --event 'ultimate_skill$'` there; fixed by an earlier change, not
traced); 2fd9's ×1.081 on non-crits remains, with every hit of that log
(Hard 27, below).

**Ruled out:** the kit's per-hit scale and hit count (SkillData and
SkillPatchTable; 27 per cast, as logged); the crit zone (the crit ratio is
exactly the engine's ×2.9); her potential 5 (4a64, P5, matches); the ult's
crit buff timing (fixed: the slow-down rule); the blackboard's
`atk_scale_crit_fire` (not the ultimate's); seven foods (the six ATK foods
and the stew).

Also ruled out (2026-11-11, round 3): Corrosion in 9a80. The replay's
level 1 (shred 19.31) fits: physical hits at 25.4, 29.2, 31.6 and 32.5 s
match exactly, where a level-2 ramp would be ≥24.8 by 29.2 s; no level or
ramp gives the ×1.09 on fire. Rossi's ×1.33 after 24.97 s is crit-only
(crit zone 1.5 in the replay, 2.0 in the log; non-crits match).

**Still possible:**
- Gilberta's susceptibility (found: buff_common_affixes_vulnerable_spell,
  rate 0.30 × (1 + 0.10 × n), n the enemy's Vulnerable stacks): the
  engine's n is 3 at her ultimate (landing frame 975), the log's 0.42
  means 4 (×1.022 of the ×1.09; ×1.067 remains). Round 4: the 4th stack is
  Rossi's Lift; two misses, either enough: (a) her combo is placed at
  frame 948 where the log implies ~946, so its Lift (frame 977) lands
  after Gilberta's ultimate; (b) at 7.807 s the log has a Lift and her
  combo consumed 1 infliction (48646 / 30023), the replay none (no enemy
  Arts Infliction from 2.04 to 9.46 s: Arcane's touch was element "enemy",
  a no-op without one; fixed 2026-11-12, the touch applies the Cryst her
  window's Corrosion consumed and the replay's Lift consumes 1 there). Her 32.489 s combo hit is the perfect-timing
  variant, consumed 2 in the log, 1 in the replay. Ruled out: the perfect
  hit's own Vulnerable rule (perfect and late predict the same there);
  a stack expiry (none before 34.9 s; the "3 then 2" at 31.60 s is a stale
  snapshot of Gilberta's combo's pre-state). 2026-11-22: the replay
  landed both of combo 3's variants where the log has the perfect hit (the
  late one 14 frames earlier, consuming first; "Gilberta's
  Susceptibility: the engine's Vulnerable count" below); without the late
  one the replay reads 4 stacks at her ultimate.
- Rossi's crit DMG at 22–25 s (found: buff_chr_0028_wulfa_combo_criticalrate,
  combo_3, crit_damage_increase_rate 0.5, 15 s): the replay's ends at
  21.8–22.1 s, the log's zone is still 2.0 at 22.13–24.97 s and 1.5 at
  25.37 s: the game's window ~3 s longer. Ruled out: other Crit DMG
  sources (no food, gear set or weapon line gives it; the ultimate's crit
  buff is 5 s). Round 4: the replay makes it once, at the cast (6.840 s),
  15 s raw, to 21.84 s; the world clock's stops to 22 s add ~0.8 s (two
  of ~0.42 s), all to 25 s ~1.7 s. Also ruled out: a full 15 s refresh
  from combo_3's second CreateBuff (frames 212–215, 13.90 s: it would run
  to ~28.9 s); stops alone; hit-stops as world pauses and a longer combo
  slow-down curve (d572's window matches the replay to 0.12 s with as
  dense hits); Si's ultimate placement (placed at 27.1 s from its hits,
  logged at 25.47 s, 0.5 s after her combo: the press during the combo,
  the ultimate starting at the combo's end; its first hit at 29.20 s is
  the kit's offset from 27.1 s; either way after 25 s). Still possible: a
  stop or freeze only 9a80 has between 6.8 and 25 s; a refresh at frame 212 with another
  timer; the qte_ring state at the cast (frame 0 jumps to 212 without it);
  the evidence itself (22.13 s is unquantified, 24.97 s matches without
  the buff, so the window's end is weaker than ×2.0 suggests). 2fd9 and
  489c lean the same way (0.4–1 s past the replay), noisily.

**Next check:** the enemy's inflictions at 2–9.5 s in 9a80 (the source
of the 7.8 s one); the reaction-level fix (round 4) may change the
consumed counts; every stop and freeze in 9a80 from 6.8 to 25 s against
d572's (where the window matches).

## Arcane's WILL combo touch: which element (in-game test 33)

**Found (round 6, 2026-11-12, implemented):** the touch applies the
element of what opened her window (`element: "window"`: the latest event
her combo trigger saw since the cast began, else the window's opener at
the cast; for a reaction, the infliction it consumed; for a window the
replay didn't see open, the enemy's current one). 9a80 plain 157 → 160,
mismatches 95 → 88, −30.7 → −23.6%; 3f78 plain 34 → 41; 489c, 4a64, e82d
closer; fixtures/ and the hold-out counts unchanged (hold-out mean
|damage| a little lower). Dead ends: the opener at the cast only
(`element: "event"`): 0eef −19.9%, the replay casts her combo before
Si's Cryo hit at the same ms; every event the trigger saw, before the
cast too: 1cd1 10 → 13.9% (a Nature 1.6 s before a cast the replay's
cooldown kept shut) and a hold-out log much worse.

**Shows (before):** the kit took the enemy's current infliction's
element; with none, nothing. The data switches on `EntityBB_consumed_type`.

**Ruled out (round 5, 94 touches in 30 logs):** "nothing when the enemy
has none": in 21 such touches a later consumer (Rossi's combo, whose Lift
needs a consumed infliction) consumes one, at 1.5–1.7× the replay's
consumed-0 value (9a80 7807; 3f78 8763, 50552; 4a64 9904, 57555; 489c
19734; 4f7e 8566, 86309); a fixed Heat (the switch's 0): b74c's next
burst is Cryst; the opener's *applied* element where it was a reaction
(b74c: Nature onto Cryst, then a Cryst burst). No touch has a current
element other than the opener's.

**Still possible:** the enemy's last infliction before the opener
consumed it (indistinguishable from the consumed element); the window's
first opener instead of the latest (no log tells them apart: every touch
with a current infliction has the latest's element); events while the
cooldown keeps the window shut counting before the cast too (only 1cd1,
where the replay's cooldown may be wrong); b74c's Cryst coming from Si's
combo or ultimate instead (the kit says they apply none). Not fixed with
it: e82d's replay landed a third touch the log hasn't (226 frames), which
applied Cryst (Arcane's own total +8 → +47%; gone since 2026-11-13: the
logged combo at 3896 ms is the one placed at 7033 ms, matched in the
world's time across the time stops between, Arcane −2.5%); the multi-target logs
move both ways (b74c +23 → +34%, c516 +131 → +159%, 4f7e −2.7 → +3.4%:
their replay already over-predicts).

**2026-11-25: the applied element in a single-target log.** fc63 81.47 s: after a Corrosion opener (Arcane's Nature
onto Perlica's Pulse at 80.40 s) the game's enemy had Nature, not Pulse, at 84.13 s (Typhoeus's power shot consumed a
Nature stack: its burst ×1.303 the replay's; Arcane's array, same ms, found none). That is the opener's applied
element, the reading round 5 ruled out on b74c, a multi-target log. Registered as engine assumption
`window-reaction` (`consumed` default, `applied`); measured `applied`: see the journal entry of 2026-11-25. Still
possible: the applied element after a reaction (fc63), the consumed one (9a80's touches: worse under `applied`), or
the order of same-ms events (Typhoeus's arrow and Arcane's array at 84.129 s).

**Next check:** in-game test 33 (latest opener against first, and the
consumed element).

**2026-11-26 (bursts and cooldowns): the reaction kind doesn't tell them apart.** 9a80's touches at 2.17 and 24.97 s
follow the same kind of opener as fc63's 81.47 s: Arcane's own battle skill's Nature onto another infliction
(Corrosion; Si's Cryst at 1.83 s, Perlica's Pulse at 80.40 s). Under `applied` 9a80's touch puts Nature where
`consumed` puts Cryst, and Si's combo at 34.94 s then reads its P2 ATK at 0.14 instead of the log's 0.17 (10 hits
plain → mismatch: `zmdlogs hits 9a80 --against window-reaction=applied`); fc63 fits `applied` (Typhoeus's shot
consuming a Nature stack at 84.13 s). The touch's switch (buff_chr_0032_lizhiyan_combo_skill_seal_total, frame 6,
EntityBB_consumed_type) has all four elements, so the Pulse case isn't a default. Still possible: the blackboard set
by the latest infliction event of any kind, not the opener's reaction (fc63's touch lands at the ms of Typhoeus's
first combo arrow, Nature, which the kit applies no infliction with); the game's order of same-ms events. A log
can't show which: test 33's simpler case (an icon) stays.

## Arcane's mismatches as one group (2026-11-18)

**Shows:** Arcane had 908 mismatches of 5,575 hits in the logs the
scoreboard counts (all but the hold-outs), 866 after the two fixes below.
Grouped (scratch: `zmdlogs hits --json` over every log, each Arcane
mismatch against teammates' mismatches within 1.5 s at the same ratio
±1.5%, and the engine's modifiers against the log's listing per hit):

- **Stage logs** (8915 323, c6d8 200, 7b54 28, 6339 6: 557) and the
  fight-wide factor of **d9e5** (15: every operator ×1.12–1.20 from 4.4 s,
  Arcane ×1.116–1.134, Liino ×1.20; the old ×1.7–2.0 is gone): not hers.
- **Team-wide** (another operator's mismatch at the same ratio within
  1.5 s): 143 outside the stage logs (fc63 43, 1d91 26, 9c6e 26, 4d60 23,
  a7a7 9, 7910 9): Stagger windows (×1.3 runs: 1d91 70–72 s, 4d60 80 s),
  Typhoeus's shot count in fc63 (placement), Corrosion levels in 9c6e.
- **Teammates' buffs on her basic-attack strings** (only she attacks then,
  so no teammate shares the ratio), ~110: **ad7f 30** (Alesh's P3 team ATK
  after a Rare Fin the replay rolled; fixed: below), **1d91 ~50** (×0.965,
  ×0.929, ×0.983, ×0.894 steps: the replay's modifiers identical on plain
  and mismatched hits 0.2 s apart, i.e. an ATK layer ending in the game
  earlier; 1d91 doesn't list Liino's buffs: her Medicant layers, "Buff
  timing leads" 10; ×1.208 / ×1.254 at 70–72 s are that times Stagger's
  ×1.3), **af7b 16** (×1.131 at 61.8–63.4 s with Typhoeus and Ardelia
  fallbacks at the same ratio: Ardelia's Susceptibility after 60 s, "Teammates'
  enemy debuffs"), **db87 9** (Camille's talent-1 ATK, listed, absent in the
  engine: ×1.093 on Arcane, ×1.038 on Si), b6aa 9 (×0.98), 5082 2, f978 2.
- **Her lasers without a landing** (70 of 238 logged had none; 29
  mismatches): (a) a second Cluster Strike inside her own Gloompurge
  Arcana stop (players cast it as the strike makes it castable): fixed,
  below; (b) a second strike the replay never makes because an earlier
  final strike made two (fc63 47 s: Typhoeus's 4th shot replayed as her
  5th, "Typhoeus, Arcane, Liino, Perlica"; 9090 51–53 s); (c) a first
  strike the replay lands 2 s early because a teammate's ultimate stop is
  missing in the placement (db87 16.4 s: Laevatain's attack 5, lasers
  logged at 18.98 s after her ultimate, whose stop the placement lacks;
  9c0b 21 s): cast placement across stops, not her kit.
- **INT early-end lasers** (a7a7 23.0–23.5 s and 49.4–50.0 s, landed
  0.4 s and 1.1 s early): explained and pinned 2026-11-22 (below, Fixed
  4). Left: why `seal_again`'s frame 41 comes 0.2–1.1 s later than the
  hit + 41 frames + the world's holds (a7a7 3.86 s: +0.18 s, 20.54 s:
  +1.0 s, 41.19 s: its start logged at 42.13 s, 0.94 s after the hit;
  8915 6.79 s +1.1 s, 31.01 s +1.1 s; 00ae 79.05 s +0.48 s with no stop
  between; 00ae 7.41 s and d9e5 +0.0): not in the data decoded so far
  (the clones' skill `combo_skill_abilityentity_seal`, exclusive to its
  frame 150, would hold it 2–4 s, too long).
- **The combo's explosion and Imprisonment's natural end**: decoded and
  fixed 2026-11-22 (below, Fixed 4). Left: the seal's tick, where nothing
  between holds it, comes 5.4–6.6 s after the touch against 6.0 s (WILL;
  the ends: `efsim zmdlogs census --select 'event:combo_skill_seal_total'
  --operator chr_0032_lizhiyan --near 'cast:combo_skill$' --near-operator
  chr_0032_lizhiyan --window 5000,9500 --list`; the world's time from the
  touch − 4 frames to each end under every placed stop, logcasts.ts
  worldMs: median 6057 ms over 85 natural ends, 16 within ±150 ms of
  6133): 4d60 −0.55 s at 38.4 and
  57.1 s (its Susceptibility lane ends with it, ~6.1 s after its `since`:
  the whole seal ran short), 1d91 / af7b / fc63 +0.3–0.45 s. Ruled out:
  potentials and skill levels (`duration_will` 6, `duration` 4 at every
  level, no potential touches them), abilityEvents 8 / 1403 / 1601 (they
  cast the end but don't shorten the seal, whose child lane ends 0.5 s
  later), the touch's lag behind the seal (since → touch 80–210 ms
  everywhere). Still possible: hit-stops or the enemy's own time scale
  reaching the seal's timer in a way `useTimeDilationDt: false` doesn't
  say; the replay takes the logged end as a fact meanwhile. e9896c8d02be
  at 62.4 s: the combo pressed before her own ultimate (cast event
  62.06 s, Susceptibility since 62.41 s), placed after its stop at
  63.58 s; the logged end at 69.07 s is 6.66 s after the seal (her own
  stop didn't hold the tick) while its Susceptibility is listed to 70.93 s
  (held): with the end moved to the log's, its hits at 70.0–70.9 s turn
  log-listing fallbacks (Arcane, Si: plain 252 → 246).
- Small: 9c6e 51–52.5 s ×0.729 (its second target), cryst bursts without
  a landing (489c, 9a80), 1cd1's touch at 38 s (placement).

**Fixed (2026-11-18):**
1. Her lasers run on the world's clock (the "hits" action's `world`): the
   Cluster Strike lasers and the INT early end's are buff timelines
   (`buff_…_inaura_laser1/2`, `seal_finisher_wisd`), which the game runs on
   the world's time, so her own ultimate's stop holds them. a7a7 Arcane
   mismatches 28 → 19 (the lasers at 55.99–56.47 s now land within 4
   frames), 79cc, c779 +1 plain; scoreboard rows unchanged.
2. A buff only a chance path's hit applies is one the replay can't judge
   (replaycrits.ts `chancePathBuff`): ad7f Arcane 34 → 1 mismatches, Si 80
   → 100 plain, 4e36 plain 117 → 239. Development plain 47.3 → 47.7%,
   mismatch 19.8 → 19.6%; hold-out plain 62.1 → 63.3%, mismatch 7.6 →
   7.7%, mean |damage error| 13.5 → 13.4%.
3. (Tests 51 and 7, 2026-11-18.) Her Corrosion's own hit has Solemn
   Phalanx's INT Arts DMG, which the same infliction creates (abilityEvent
   126 comes before the game resolves the infliction into a reaction; Hot
   Work, on the reaction, stays off it): before-damage triggers on the
   infliction now run ahead of those on the reaction (timeline/landing.ts).
   a7a7 3.86 s and 8915 6.79 / 31.01 / 85.61 s now plain or exactly on the
   stage factor. And her second ultimate's Amp: the cast replaces
   Gloompurge Arcana's Amp with its own, gone by her next basic attack
   (00ae, 8915; was up to 10 s more), kit `int_amp_ult2`. 8915's basics at
   99–104 s ×0.84 → ×0.986 (the residue left).

**Fixed (2026-11-22, Imprisonment's end and the INT lasers):**
4. The seal's natural end isn't its end: the combo sets `trigger_time` =
   duration_final − 0.5 (SimpleCalcBB), and the seal's one tick
   (`triggerInterval trigger_time`, `waitFirstTriggerInterval`,
   `maxTriggerCnt 1`, buffEvent 1) casts `abilityentity_end`, whose
   explosion lands 14 frames later, 0.03 s before the seal and its child
   Susceptibility end. The kit cast it at the seal's end, 0.5 s late
   (kit `imprisonment` `every`, trigger `explosion` on its `buffTick`).
   Where nothing holds it the logged end is 6.0 s after the touch (b6aa
   5972 / 5961 ms, 1d91 5987 ms, 012a 5965 ms), and the Susceptibility's
   logged lane ends 0.5 s after it (4d60, b6aa, 1d91, af7b, fc63).
   abilityEvents 8 / 1403 / 1601 cast the same end when the holder goes
   (docs/game-data-format.md): none mid-fight. The replay takes the logged
   end as a timing fact (`ticksLoggedAs` on the seal, `endFollowsTick`,
   `childOf` for the Susceptibility): its explosions land within 0.1 s of
   the log's in 67 of 77 (was 10), within 0.02 s of the end event + 0.467
   in 82 of 83. Freezes don't hold the seal (`runsThroughFreeze`: b6aa
   19.56 s with Si's freeze inside ends on time, ad7f 3.91 s 0.37 s late
   where the replay had 2.4 s). INT: seal2 (the early end's window) ends
   with the tick (`early_end_window`); a battle-skill hit in the seal's
   last 0.5 s after the tick still casts `seal_again` (seal_listener lasts
   as long as the seal): its 12 s Susceptibility (`post_susceptibility_late`;
   8915 109.94 s, listed to the fight's end) and no lasers (the clones go
   at the end's frame 44). The early end's lasers wait on their own timer
   (`laser_wait`, 41 frames, `ticksLoggedAs`): the log's combo event 0–4
   frames before the first laser is the lasers' start (a7a7 5.41, 22.93,
   48.89 s; 8915 9.24, 33.44 s; 00ae, d9e5); a combo's own event is one
   within 1.5 s of it (castassembly.ts COMBO_EVENT_MS, for skills a buff's
   ticks are logged under), and a due tick waits up to 1 s for one
   (TICK_HOLD_FRAMES). a7a7's lasers at 5.4 and 23.0 s land within 0.06 s
   (were 0.2 and 0.4 s off); at 48.9 s they start at the logged start, the
   log's batches at 49.37–50.01 s (one ms shared with every hit then) can't
   say more (were 1.1 s early). Scoreboard: development plain 52.0 → 52.7%,
   hold-out 67.3 → 68.7% (mismatch 6.7%, mean |damage error| 12.1 →
   11.9%); Arcane's mismatches 863 → 854.

The 8915 share of the stage logs (323) is the stage's own factor on her
hits (test 7: 238 of her 278 hits in its windows within 1% of it, as
Si's and Wulfgard's); after the stage, a ×0.986 on her hits at 92–103 s
and ×0.81–0.84 / ×1.10–1.21 steps at 104–112 s remain (not looked at).

**Ruled out:** her own buffs' timing as a group (`zmdlogs timing`: her
only patterns are funnel_0008 in 9c6e, 7 hits, and int_amp in 8915, a
stage log); her kit values on the matched hits (her plain matches cover
every skill); a freeze holding only the freezer's own debuffs on every
enemy (the experiment, 2026-11-18: 489c plain 367 → 353, b6aa 238 → 220,
7910 −17.6 → −20.5%, hold-out plain 63.3 → 62.9%; ad7f's Imprisonment is
the one case against).

**Still possible:** Imprisonment ended early by the events its buff
listens to (BuffData `buff_…_combo_skill_seal`: abilityEvent 8, 1403 and
1601 cast the explosion before the timer; undecoded), which would explain
4d60's 1 s; Imprisonment (and so the Doubles Susceptibility) not held by
freezes while other debuffs are (ad7f only); the INT lasers' batches being
the log's timestamps rather than the game's timing.

**Next check:** decode abilityEvent 8 / 1403 / 1601 (which event ends
Imprisonment early); then take Imprisonment's end from the log's
natural-end cast in the replay, as the reaction levels are; Alesh's own
×0.85 on every hit in ad7f (his build).

## Hard 27: every physical hit ×1.1125 low (2fd9, 99fb; resistance 11, fixed 2026-11-23)

(Ember is chr_0009_azrila; this entry called her Azrila before 2026-11-12.)

**Shows:** Mi Fu's and Rossi's physical hits from the first one, with no
buffs listed (Mi Fu's attack 3 at 5143 ms: every zone ×1); Mi Fu's World
Splitter residual is the same factor; Ember ×1.044. One player, one
enemy (eny_0124_kltdcap_hdg027), Mi Fu P5 in both.

**Ruled out:** Mi Fu's kit (World Splitter exact in a27b, d5720); seven
foods; defense (×1.1125 needs DEF ≈ 79.8; 80 gives 1.1111); the level
(DEF 100 at every level); other variants of the template (all share it and
its born buffs; no other log hits it with physical or fire); a modifier in
the stage's DungeonTable entry (indie_hard027_s: paramList null); Ember's
×1.044 as an element resistance (no value fits).

**Found:** the enemy (EnemyTable alias of eny_0124_kltdcap, no attribute
modifiers) has physical resistance 20 (zone 0.8) in the data; the hits
need 0.89, resistance 11. Rossi's fire hits (8, weak) are ×0.890, as if
fire were 11 too (the data: 0).

Round 4, other Hard stages: no Hard-stage pattern. Hard 15
(eny_0058_agdisk_hdg015, data resistances 12): fire fits 12 exactly (233
of 234 hits), physical fits no single value and is one operator per log
(Akekuri in 012a, Alesh in 4e36), and its hits are low, not high; R = 11
gives 0 matches there. hdg005 (eny_0033_lbhunt, physical 0): no value
fits; Estella's hits with few effects match at 0. Control: Tower 15
(klbear, physical 20) peaks sharply at 20 (132 of 132 plain in 458b).

Round 5, Ember: not the source. Her kit, potentials (P3 in both),
talents, weapon (wpn_claym_0006) and gear give no team Physical DMG or
susceptibility; the factor starts at 5.1 s (Mi Fu) and 6.0 s (Rossi),
her first hit at 10.3 s; with her in 7e19 the physical hits are 1.0000.
Mi Fu's and Rossi's ratio is 1.1125–1.1130 whatever their other zones.

**Still possible:**
- An enemy-side physical term of eny_0124_kltdcap_hdg027 only (no other
  log has physical hits on it; 1d91's tower016 variant has none).
- Per-log operator factors on Hard 15 and hdg005 (Akekuri's, Alesh's,
  Estella's buffs), untested.
- Ember's own ×1.044: her ATK ~6% high in the engine (×0.9386 after the
  ×1.1125); P2's attributes (+3.8% ATK) don't fit. Aurora ×0.655
  (whatever the zones); Purrchena is level 1 in 99fb (a build input).
- A Hard 27 resistance setting outside the tables we read, or an enemy
  buff giving it (no longer favoured).
- Ember: 1.044 = 1.1125 × 0.9388, her ATK inputs ~6% high (a weapon
  level, nodes) on top of the same term.
- An unlisted team debuff (Physical Susceptibility) or a build input
  common to this player's operators (gear, food: 29 not scanned).
- The two factors (physical ×1.11, all-element ×1.044) being one term in
  different zones.

**Found and fixed (2026-11-23): the enemy's resistance is 11 for every
element the logs have.** A log from another player on the same stage,
parser v59 (game 1.6; the pair is v58, before 1.6), Rossi, Si, Arcane and
Gilberta: fixtures/pending/zmdlogs-207fff414d82.json. Rossi's physical
hits from the first (attack 4 at 4.7 s, no buff) are ×1.112, the same
×1.1125; Si's Cryo and Arcane's and Gilberta's Nature hits are ×0.890
from their first (zone 0.89 for 1.00). Its first check: 0 plain of 342,
damage −12.4%. So not a player's build input, food, a game version or
Ember: the live enemy has resistance 11 where the table (the base
template's, attrTemplateId eny_0124_kltdcap, no attrModifiers) has
physical 20 and 0 for the others. Its two born buffs
(buff_eny_klcommon_mech, buff_eny_0121_klbud_tdcapeye) have no BuffData
file in the data, the likeliest place. Now an enemy fact from the logs
(packages/data/src/enemyFacts.ts `LOGGED_RESISTANCES`: physical, Nature,
Cryo, Heat 11; Electric, which no log has, stays the table's 35).
207f plain 0 → 102. **Builds:** with it Ember's hits are ×0.9389 in
both logs; weapon level 80 alone fits 21 of 21 (2fd9) and 9 of 10 clean
(99fb): a `buildOverrides` in both. Snowshine (chr_0014_aurora) ×0.590:
weapon level 20 fits 14 of 20 clean (its skills [2, 1, 6]): 2fd9's
override. Purrchena (level 1 in 99fb's export, ×2.47) stays: fit-build
doesn't vary an operator's level.

**Still possible:** what sets the 11 (the born buffs; Hard 15's own
template is a uniform 12 and fits). Electric on this enemy (no log).
Snowshine's 6 other clean misfits; Purrchena's level.

**Found (2026-11-23, fight totals):** the stage also Electrifies the enemy (Arts DMG Taken +0.24, no giver, from
~20 s, renewed about every 20 s, in all three logs): read from the log (enginecheck.ts `stageStatus`); Rossi's fire
hits ×1.18 → plain in 207f. Left in 2fd9: Mi Fu's Crush hits ×1.90 low ("Fight totals" above).

**Next check:** a Hard 27 log with Electric hits (Electric 35 or 11).

## Hard 33's slug: debuffs the engine keeps don't act (7b54, 6339)

**Shows:** hits low by the engine's damage-taken and susceptibility
entries, which the log lists but the damage ignores (Jade Vessel's 0.12,
Arcane's 0.096 stacks, the affixes), in windows (7b54 12–20 s; 6339 from
10.5 s); a Laevatain power-attack hit_2 missing (6339; the pair is in
0206 and 3440); Combustion ticks the log doesn't have.

**Ruled out:** the slug's template (DEF 100, resistances 0, no born
buffs, no attribute modifiers); a damage-scaling shield (the number shield
zeroes whole hits); Stagger (the bar isn't empty when the buffs stop
acting); an additive damage-taken reduction (1 + 0.12 − r doesn't fit;
1 + 0.096k does).

Round 5, the slug's data (from extracted BuffData): the number shield
(numshield_hdg033: 1, set to 3 on a signal buff, one less per qualifying
hit) blocks hits through buff_common_eny_numshield (−9999 in the product
zone: a blocked hit deals 0); at 0, numshield_zero ends the shield buffs
by id. Its two FinishBuffAdvanced end numshield_destory (on itself) and
the stage's poison on the team. Every finish names buffs by id; no tag
query. Jade Vessel's enemyvul and Arcane's funnel stacks carry no tags.
Neither log has a zero-value hit or lists a shield or Stagger buff. In
6339 Jade Vessel's entry drops out of the hits' lists at 10913 ms (last
at 10349); in 7b54 it's listed to 35.5 s.

**Ruled out:** the shield (or its end) ending the debuffs, by id or by
tag; Stagger at 10.5 s (6339: bar 22 → 45, rising) or at 12 s (7b54).

**Still possible:**
- Jade Vessel's replacement by priority key (stacking type 11,
  `dmg_taken_up`, max 1) keeping another instance than the engine's.
- The hits' effects lists being sparse in these logs (entries vanish and
  return), so "listed but not acting" reads presence wrongly.
- Shield-blocked hits hidden in a gap (6339: none from 11.3 to 14.6 s).
- A Stagger in 7b54 from ~19–20 s (bar 7 at 19.0 s, no sample to 29.5 s).
- buff_common_mini_poise_break_slwood and numshield_destory carrying an
  effect (the latter unread; the former an interrupt with 4 s
  immobilization, read in round 1).
- Hits zeroed by the shield explaining 6339's missing hit_2 and
  Combustion.

**Next check:** none planned: such logs are to be avoided. If one is
needed, the priority-key replacement of Jade Vessel's buff.

## Liino's battle-skill presses during Vocalist Stance (every Liino log)

**Shows:** a press every 3–4 s, no hits; the stance and its volleys go on.
Replayed as presses: 1d91 +113%, 1cd1 +96%, a7a7 +59% for Liino.

**Ruled out:** replaying them as full battle skills (60 projectiles the
log hasn't); players pressing every 3–4 s (the owner, who plays her,
2026-11-13: a press in the stance is rare); a beat re-opening or
refreshing her volley window (the data: spelllnfliction_check and
_extraattack are clips of the battle skill's own action, frames 45–1691,
created once per cast; the beats, normalskill_music_damage's soundwave
launches, and normalskill_music_tag create neither; extraattack's 10 s
interval is per instance, so only a real cast restarts it); the teammates'
losses when the events were skipped (a7a7 322 → 261 plain) being Liino's:
the recasts drained the team's SP, so Arcane's press at 37415 ms, 3.1 s
before the battle skill placed from its hits at 40523 ms (351 ms later in
the world's time, across two ultimates' stops), couldn't start and wasn't
made; skipped, the SP was there and it was made as a second cast, landing
a Corrosion at 39.4 s the log hasn't. A logged cast now matches a placed
one within 2.5 s of the world's time (worldMs), which also removes e82d's
extra Arcane touch.

**Done (2026-11-13):** they are the stance's beats (the owner): the kit's
vocalist_stance has `ticksLoggedAs` its battle skill, and the replay reads
such an event while its own stance is on as a beat: no cast, no SP; the
beat comes at the event (a tick due within half an interval is held to
it or brought to it; the next comes 3 s on), since bdf2, 0eef, d774 and
4bfc list one more layer of her weapon's heal ATK on teammates after each
event. Liino's damage error: 1d91 +113 → +2%, 1cd1 +96 → +27%, a7a7 +58 →
+2%, 8318 +230 → −7%, 4bfe +121 → +7%, 7910 +31 → −7%; teammates
unchanged but 1d91 (Typhoeus 162 → 152 plain, Arcane 63 → 51, Ardelia
3 → 4).

**Still possible:** 1d91's damage wants one more heal than the beats give:
Arcane's hits fit 2 weapon layers at 5940 ms (a heal near 5.9 s, before
the event at 6255) and 3 from 6797 to 10024 ms (another after it); 1d91
lists none of Liino's buffs, so only the damage tells; the recast reading
gave both (its own tick, then the recast's). A heal at the cast besides
the first beat (the data's unused normal_skill_projhit_health heals the
team) would fit 1d91 but not bdf2's or 0eef's listing (one layer after
the cast). A real End Stance press in a stance is read as a beat (rare,
the owner).

**Next check:** in-game test 103 (a) only (End Stance); 1d91's extra heal
if another log without Liino's buffs listed shows it.

## Liino's stance ATK ends early in 0eef and 1cd1 (the 5 s linger)

**Shows:** the team ATK of Vocalist Stance leaves teammates' hits long
before the stance's 60 s, with no End Stance in the log (no log has one):
0eef at 8739 ms (cast ~760 ms; beats at 760 and 4187 only, her combo at
7570), and the next teammates' hits are ×0.934 of the engine's (it keeps
the stance, or its 5 s linger); 1cd1 at 34388 ms (last beat 34285; her
ultimate events at 37948 and 41265), and from +4.6 s on Typhoeus ×0.917
and Arcane ×0.839 of the engine's, with no Liino ATK listed.

**Ruled out:** players cancelling and recasting the stance for its ATK
(the owner's point, 2026-11-13: no log has an End Stance; the logged
"presses" are beats). The data's linger (`finish_duration` 5 s) doesn't
add to a new stance's ATK, so there's nothing to gain from it.

**Ruled out (also):** her combo ending the stance (its description: it
doesn't cancel the stance, the owner 2026-11-13; the kit resumes it).

**Found (haiku, 2026-11-13):** 1cd1's stance ends at her ultimate (cast
37948 ms, its projectiles 38725–39580 are real damage; the ultimate leaves
no linger), so the ATK going at 37974 fits. But Cosmovoice's ATK and Amp
never show on anyone (no beats either; dbae logs them, same parser), and
teammates' hits are a steady ×0.917 / ×0.838, as without them. Both
endings come in the fight's last seconds: 0eef ends at 10030 ms (ATK gone
1.3 s before), 1cd1 at 42702 ms (4.7 s after). The ATK auras are team-wide
(AuraAction auraType 1, no radius; only her talent's shelter has 5.5–6 m),
so distance isn't it.

**Found (sonnet + check, 2026-11-13):** no end-of-fight effect (last-5 s
mismatch rate 34%, as elsewhere). The real pattern: Cosmovoice's buffs
(team ATK buff_chr_0035_liino_atkup; Amp logged as
buff_common_affixes_enhance_natural / _pulse) are on teammates' hits after
her ultimate in 4bfe, 7b4e, 4bfc, d774, dbae and on none in 1cd1, 1d91,
a7a7, c6d8, d9e5 (19–80 teammates' hits each in the 2.6–15 s after). Not
Vocalist being on at the cast (4bfc: on before, buffs after; 1cd1, a7a7:
on before, none after). The engine gives them in every log.

**Found (sonnet, 2026-11-13): mostly the log's listing.** In a7a7 and
c6d8 teammates' hits after the ultimate match the engine plainly with
Cosmovoice's buffs (a7a7 Arcane 27/29, c6d8 Zhuang Fangyi 20/24): the
damage has them, the listing drops them (and Vocalist's ATK with them at
the cast). 1d91: a standing offset before and after (Arcane ×0.894 /
×0.929), not a loss at the ultimate. d9e5 (the one log of parser v58):
teammates ×1.14 before and after. Only **1cd1** lacks something in the
damage: ×0.917 / ×0.838 from 39036 ms, with Cosmovoice's Amp seemingly in
it (with Amp 7839, without 5217, logged 7187), so about the ATK, though
Arcane's ×0.838 is below what +0.16 ATK alone explains (≥ 0.862).

**Ruled out (also):** her ultimate cut short (she casts only its own
events after it in all 10 logs); who's controlled; potential, skill
levels, weapon, enemy; the beats. The engine stays as it is for a7a7,
c6d8, 1d91.

**Still possible:** for 1cd1 (P5, fight ends 4.7 s later): a real loss of
the ATK (or part of the Amp); its weapon layers (up to 11 on Typhoeus,
see the next entry) changing at the ultimate; for 0eef: Liino down or off
the field (HP and swaps aren't logged); the log dropping Liino's buffs
from the listing when her ultimate replaces Vocalist (a7a7, c6d8, 1cd1,
1d91); whether the 5 s linger
exists (0eef: if End Stance-like, the ATK went at once, against it; no
other log has teammates' hits in the 5 s after a stance's end); why the
engine still has Liino ATK in 1cd1 after 39 s.

**Next check:** 1cd1 together with the weapon-layer entry below (its
Typhoeus carries 11 layers just before); 0eef none planned.

## Liino's weapon: more than 4 layers listed on one teammate (test 25)

**Shows:** buff_wpn_lance_0014_damageup listed up to 11–13 times on one
hit (1cd1's Typhoeus 3–11, a7a7's Arcane up to 10).

**Settled (haiku + check, 2026-11-13): the damage fits the cap of 4,
the listing over-counts.** 18 Liino logs, ~4,500 teammates' hits where the
engine has 4 layers: those listed with 8–12 still match the engine
exactly at the same rate as those listed with 0–4 (e.g. listed 9: 118 of
238; listed 3: 360 of 691); 11 real layers would put them ~20% higher.
Log/engine ratios peak at 1.00, no peak at more layers. The cap is per
recipient, shared by every heal source (per-source caps would show steps
past 4; none). Rises come within 4 s of her heals, expiry 20 s after
(median 19.9 s). The listing errs the other way too: 1d91 lists none and
fits 4; Ardelia lists 1 in 1cd1 and fits 4. (On 2026-11-13 the lead read
1cd1's fallback matches as support for 11 layers: wrong, a coincidence of
the log's other listed buffs.) Other stackingType-11 buffs (wpn_sword_0012,
cap 2) are listed up to 12 times too: a log habit.

**Ruled out:** the listed count in the damage; the buff's own default cap
(2); a cap of 4 per heal source.

**Still possible (not the weapon):** 1cd1's team-wide step at 24.0–24.6 s
(×0.936 → ×0.820 for Ardelia, Arcane, Typhoeus alike) and Typhoeus ×0.820
→ ×0.917 at 39.0 s; the engine giving Typhoeus's ultimate hits no layers
(37974, 41265 ms); c6d8's engine values ×10 off on every hit.

**1d91's Ardelia (2026-11-18): her layers come slower than the engine's.**
118 of her 130 hits mismatch, all with the engine's Liino stance ATK and
4 Medicant layers (the log lists none of Liino's buffs there). Her first
hit (6.0 s, 1 layer) is exact; the ATK% her later hits need with every
other zone the engine's (scratch: logged ÷ reading × the reading's ATK
÷ her panel's): +0.156 to 18 s (stance + 1 layer: the same 5287 at 12.0 and
16.6 s, while the engine goes to 3 and 4 layers), +0.100 at 23–32 s (stance
only: the layer ran out at 20 s), +0.212, +0.268 at 35–49 s, +0.324 (4
layers) from 51 s. Typhoeus fits 4 from 10 s and Arcane from 17 s (both
had more than the engine before), Arcane fewer again at 53–70 s
(×0.965 → ×0.893). So the heals reach the three at different times.

**Ruled out (1d91's Ardelia):** her build (the hit at 6.0 s is exact; the
pattern follows the layers, not a factor).

**Still possible (1d91's Ardelia):** the stance's heal being the
soundwave projectile's area (normal_skill_soundwave_projhit, an AOE
HealAction): teammates out of its reach get no heal and no layer (not
modelled: positions); a heal on a teammate at full HP giving none.

**Next check:** 1cd1's step at 24 s (sonnet); the log check's fallback
should not trust stackingType-11 listings' counts; whether other logs
without Liino's buffs listed show a teammate's layers lagging like
1d91's Ardelia.

## Ardelia's Wooly Party: a random hit count (test 96)

**Shows:** 7 sheep hits in 4e36 and 3 in c3c7 (her only ultimates that
hit in our logs), against the engine's 11 below P3 (14 from P3), which
assumed the 0.3 s per-enemy cap is always reached (until 2026-11-13).

**Done (2026-11-13):** the count below is now the kit's (`landedCount` on
the sheep hit; docs/design/damage.md "Damage distributions"): expected crits deal
each planned landing's damage and Stagger × E[N] / L (6.1 / 11, 8.6 / 14),
the distribution counts a cast's sheep as a random sum, rolled crits draw
the count (stream `landed`) and land that many at random. The example went
from 152,724 to 114,744 (the mean; standard deviation 17,650; 5–95%
≈ 83,975–142,039). Log replays land the sheep the log shows and drop
the cast's other planned landings (2026-11-14, below). Left: the Stagger
at E[N] / L is an expected value of a
threshold effect (Stagger nodes), and every planned landing still fires a
hit event at expected crits (a trigger on her ultimate's hits, from gear or
a teammate, would fire 11 / 14 times, not N).

**Ruled out:** a fixed count: the sheep fly at random, not aimed (the
owner, 2026-11-13), so the count varies cast to cast.

**Counted (2026-11-13):** 21 ultimates in 18 more ZMDLogs battles
(screened from her profile, not imported; IDs in the session's scratch
folder) and our 2 logs, sheep hits on the main target per cast:
- below P3 (engine 11): 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9: mean
  6.1, median 6.5, never 10 or 11 (×0.55 of the engine);
- from P3 (engine 14): 4, 8, 8, 9, 10, 10, 11: mean 8.6 (×0.61).
One more cast (Hard 32, several enemies, potential not exported) hit
nothing. Hits on one enemy are 0.2–0.45 s apart (the 0.3 s cap, roughly),
spread over 2–6 s; towers 15/16 (large bosses) and smaller enemies alike.

**Still possible:** enemy size mattering (too few casts per enemy to
tell); the counts being a small sample (14 and 7 casts).

**Impact:** small. She's a support (the owner): teams run her for her
effects on others, not her own damage. What it can move: the search
valuing her ultimate's damage too high and timing it for that rather than
for her support.

**Next check:** more Ardelia ultimates (logs to import, or the owner's
counts); low priority.

**Her own damage in the log replays (opus, 2026-11-14):** a sonnet
diagnosis found her per-log errors (5082 +204%, af7b +158%, 4e36 +199%,
c3c7 +70%, 9c6e +57%) to be the log check's, not the engine's. Verified
and fixed, three log-check problems and one fixture problem:
- *One ultimate placed as several casts.* The sheep fly at random, so
  they miss their slots' frames; a cast placed from them was superseded by
  any later cast of hers (her combo's misplaced bomb in 5082, an attack 3
  in af7b), and distinctCasts didn't merge casts from one key: 3 casts in
  5082, 4 in af7b, 14 sheep each. Now an ultimate isn't cast again within
  its action (logcasts.ts `sameUltimate`, and distinctCasts merges an
  ultimate's casts from one key).
- *Her combo's bomb split from its projectile across time stops* (5082:
  6.4 s apart across Yvonne's ultimate and her own; 9c6e: two bombs at one
  time, the second at half, another enemy's). Now joinable and choose's
  window count world time, every stop but the cast's own; the placement
  also takes the stops of logged cast events nothing placed is near
  (Yvonne's hitless ultimate). Fixed on the way: 0c14 and 489c Wulfgard's
  combo 2 ticks across a stop (an extra combo each; 489c's combo 3 perfect
  hit is placed as combo 3 again: choose takes the latest cast whose
  windows list the step), 9a80 −23.6 → −17.3%.
- *Every planned sheep landed in the replay* (11 / 14 per cast, the log
  2–11). Now replayCast drops a landedCount hit's planned landings the log
  doesn't show.
- *Build inputs* (fixtures): 4e36's weapon at level 1 with no attribute
  node (her buff-free combo projectile ×0.4075; 128 of 130 hits match,
  none before), c3c7's at 60 with none (143 of 164 non-crit hits exact;
  its logged skill level 7 needs the third breakthrough, at 60, which
  rules out 56 with 2 nodes).
Ardelia's error: 5082 −8.4%, af7b −5.3%, 9c6e +9.8%, 4e36 +0.6%, c3c7
+4.8%, 791 −13.7 → −27.4%, 1cd1 and 1d91 unchanged. Some fights' totals
fall where her extra landings had hidden others' shortfalls: 5082 +6.8 →
−21.5% (Yvonne −4.2 → −22.9%: the extra combo and ultimates had covered
her), 791 −11.3 → −18.4%.

**Ruled out:** Ardelia's second "ultimate" event ~3 s after the first
(5082 +3065 ms, 4e36 +3073, c3c7 +2934, af7b +3417, 9c6e and 791 a third
~3.1 s later) as another cast: no sheep group of its own follows, and the
log repeats ultimate events while one lasts (Liino's every ~3.5 s of
Cosmovoice, 2026-11-12). Not chosen: dropping placed casts without a
logged cast event (fixtures without `casts` can't, and Si's Final Stroke
is never logged).

**Still possible:**
- 791: all 8 of her mismatches are sheep at ×1.407 the engine's reading
  (176,418 logged): a missing multiplier on her ultimate there (its cast
  is placed from the first sheep, 59235 ms, the log's ultimate events are
  at 55120 / 59235 / 62299 ms: an earlier cast whose sheep all missed, or
  buffs timed to the cast), or a debuff.
- Her ultimate's cast placed ~0.4–1.4 s late (2700 ms before the first
  logged sheep, which flies first): its time stop and buffs land late for
  others' hits.
- The build-offset report (`buildOffsets`) missing such cases: ATK buffs
  with flat parts move an operator's ratio from hit to hit (4e36: ×0.34 /
  0.46 / 0.53 at the assumed build), so no 75% sit within ±0.003 of one
  ratio. A robust search would replay each candidate build (~0.7 s each)
  and count exact readings; and the logged weapon skill levels bound the
  weapon's breakthrough, so its level (WeaponBreakThroughTemplateTable's
  skillLevelBounds, not in the loaded data yet). Not done.
- 4e36's remaining 79 log-listing matches: Alesh's weapon ATK layers
  (wpn_sword_0012_atk_up) differ between the replay and the log
  (instances log 1 / replay 2 at 12–19 s), and his potential-3 ATK.

## db87: ×1.3 on Laevatain's hits under her sword buff

**Shows:** the 8 Laevatain hits carrying buff_wpn_sword_0006_valid
(listed 1.2) are ×1.30 of the engine's in both readings of her battle
skill (test 20); her two hits without it match exactly; e989 lists the
buff at 2.1 and fits exactly.

**Ruled out:** her battle skill's multipliers (both readings carry it).

**Found (2026-11-26): not the sword buff, the Link.** All eleven of
db87's normal_skill_during_ult hits are ×1.3000 = Link (1) on a battle
skill (Camille's combos give the team one stack). The log records her four
Twilight presses as `normal_skill` cast events; the replay made each as a
cast of its own besides the placed during-ult cast: a forced normal_skill
(its explosion and ticks replay-only, 3.6% of the fight) that took the
Link stack. Now such an event is the placed cast of its button's other
variant (logcasts.ts `buttonVariants`, castassembly.ts `variantCastOf`;
the placement times the cast from it, so the 27.13 s press comes before
Si's ultimate and takes the stack): db87 −6.0 → −1.2%, plain 208 → 228.
**Left:** 55.31 s extra ×1.435 (×1.3 × 1.104); 9c0b's three during-ult
hits ×1/1.3 (the replay gives them the Link that Arcane's ultimate takes
in the game: Camille's Hunter Pursuit at 12.70 s is placed with its first
logged landing as `hit` where its values say hit_2 to hit_4, so its frame-70
Link comes after Arcane's ultimate press: slots by value); f879's 94.7–96.2 s
dots ×1/1.3 (a Link the game's cast didn't carry, not traced).

## Ink Melt logs (round five): Combustion ticks, a stage factor, Si's late combo buffs

**Shows (sonnet diagnosis, 2026-11-15):** Wulfgard's kit and weapons fit
(implied scales exact); the four new development logs' "0 plain" were
build offsets the export omits (fixed in the fixtures: c83c Si's Jade
Vessel third skill 9 and 0 nodes, c7790 and 8915 Wulfgard weapon 81,
f879 Wulfgard weapon 80, f978 Si 1 node, 8915 Liino weapon 80). Left:
- **Combustion ticks: fixed (2026-11-15).** c7790's Wulfgard ticks
  ×2.2223 = 1.448 × 2.2962/1.4962: the snapshot was taken before the
  `beforeDamage` triggers on the Combustion's own reaction (Hot Work +0.5,
  Scorching Fangs +0.3, Rational Farewell ATK +0.448). Now retaken after
  them (combat-mechanics §3.3); the log check reads the application hit's
  boundary buffs that its ticks list. The reaction's own hit takes the new
  ATK but not the new Heat DMG (7 of 7 hits in c7790 and 4e36; one where
  Hot Work was still active from his ultimate, 22472, keeps it):
  combat-mechanics §3.2. c7790 Wulfgard 6 → 0 mismatches, 56 → 63 plain,
  simulated total +5.9% → +2.2%. Left of the tick problems (none worse):
  - f879: 4 ticks at 71–83 s ×0.83–0.95 (was 10, ×0.83–1.14) and the
    Heat burst at 105.5 s ×0.84.
  - 458b: the re-snapshot pattern (×1.28 / ×1.18 at 88–94 s after a Heat
    infliction on a burning enemy; the tick before's side, fixed 2026-11-23 below), Wulfgard's ticks at 162–164 s ×1.91
    and 227–234 s ×1.49–1.62 (were ×2.33 and ×1.82–1.97).
  - db87: ×1.4353 ticks at 37.5, 47.4, 49.3 s and ×0.7353 at 50.7–53.7 s
    (the ratio's inverse: as if the snapshots of two Combustions were
    swapped), unchanged.
  - 4e36 (not a development log): Wulfgard's first Combustion's ticks
    ×1.1315 (were ×1.84), at 65.5 s ×1.36.
  - c7790: the engine ticks 10 times in 22.5–32.1 s where the log has 7
    (and 3 against 2 at 63.7 s); the log's ticks there are 1.5–2.6 s
    apart.
- **8915's stage** (indie_hard018_s, the Skydrummer's shields that each
  reaction or physical status removes): every operator's hits ×0.5 to
  37.7 s, ×0.05 at 38.5–39.4 s, ×0.2 at 41.0–85.9 s, ×1 from 86.8 s;
  nothing in the log's buffs marks it. Not modelled; the log is mostly
  not checkable until it is. It is all of Arcane's ×1.85 there (in-game
  test 7, 2026-11-18: 238 of her 278 hits in the windows within 1% of the
  factor).
- **c83c Si's combo from ~55 s: now only the Yinglung stack count
  (2026-11-18).** The +21% is gone (consumed buffs end at their cast's
  last hit, 2026-11-14): her combos at 55.6, 82.8 and 98.4 s are ×0.9494,
  ×1.0528, ×0.9518 = exactly one Edge layer (0.2 of DMG 3.95 / 3.79 /
  4.15) fewer, more, fewer than the engine's 2, 2, 3 (scratch edge fit on
  `zmdlogs hits --json`; Jade Vessel's 0.7 and the P2 ATK the engine has
  fit). Her first combo (9.5 s) wants one more too (engine 2). Which casts
  count: "Type 50 Yinglung's Edge" below (2026-11-22: all five fit there
  with her first press after her battle skill counting and her other
  hitless presses not; the engine's replay doesn't make those presses).
- **f978 Ardelia: found (2026-11-18).** Her weapon at level 60 (the third
  breakthrough's cap; c3c7's is at 60 too): `efsim zmdlogs fit-build`
  fits 107 of 139 hits, all 55 clean ones (0 as exported); the earlier
  "no pair fits exactly" read the ATK ratio alone (×0.81663 against
  ×0.8167, inside the hits' rounding). Fixture `buildOverrides`; f978
  plain 258 → 365, mismatches 139 → 2.
- **f879**: Wulfgard's late hits (104–126 s) ×1.06–1.10 with many
  Camille talent-1 stacks listed; Laevatain −8.3% (−9.1% before the
  Combustion snapshot fix) not diagnosed.

**Ruled out:** Wulfgard's kit (scales, frames, extra shot, talent,
potential), his weapons pistol_0004 and 0009, enemy level/DEF, food and a
fight-wide factor for c83c, c7790, f879, f978. For the ticks left: the
buffs a Combustion's own application creates (in the snapshot now).

**458b (2026-11-23): found and fixed (ticks and layers).** Wulfgard's ticks read 1917 (79.33, 82.33 s), 2493 at
85.70 s (the Stagger's ×1.3 only, though Akekuri's ATK, +0.28 as the engine counts it, came at 84.37 s), 3190 at
86.69 and 88.33 s (with it: ×1.2796 = 1.28), 2941 from 89.34 s (×1.18: her potential's +0.10 gone by the 88.33 s
listing); at 230.62 s 3190 though its own listing lacks the +0.10 (the 229.58 s one has it). Each tick deals with the
owner's attacker side as it was at the tick before: the snapshot is taken again at every tick for the next (engine
assumption `combustion-snapshot`, `last-tick`; situation.ts `retakeTickSnapshots`; combat-mechanics §3.3). Across
the 21 Combustion logs 52 ticks plain that weren't, 1 the other way (f978 23.68 s: the replay has no tick near the
log's 22.62 s one, so its tick before is another). Left in 458b: 86.69 s (×1.28, the replay's tick before comes
before Akekuri's ultimate in its timing), 227.60 s (×1.49, a first tick). **458b's damage 6.1 → 7.5% isn't the
ticks:** the snapshots' history puts it at 74bc686 (Si's strokes merged onto the placed holds), all in Laevatain's
total (9.0 → 11.3%; Wulfgard −0.1%); this fix moves 458b 7.8 → 7.9%. **Traced and fixed (2026-11-23, remaining leads):**
74bc686 made her enhanced battle skills at 92.9–94.3 s right (70,033 / 78,522 / 225,834 → the logged 91,043 / 102,079 /
293,585), which took away an under-prediction that had hidden two replay-only landings: her finisher's hit_2 at
156.93 s (225,802) and 223.27 s (281,334), which the log never shows. The replay kept the finisher's hits because her
ultimate (156.27 s, 223.17 s) came inside the finisher's disable-cast buff (frames 0–42), which held every cast. Every
logged ultimate inside a finisher's frames cut it (458b ×2; d572 121.89 s, Rossi's placed from its own hits 17 frames
into hers, whose window runs to 65: neither her frame-15 hit nor hit_2 logged): engine assumption `finisher-ultimate`,
`cuts` (timing.ts afterCantCast; SkillTiming channels' `finisher`). 458b damage 8.0 → 0.8%, d572 4.2 → 2.1%; teams
unchanged. 6339's missing hit_2 (Laevatain at 21.60 s, no own cast before 22.31 s) is something else: open.

**Still possible (ticks left):** which Combustion a logged tick belongs to where two overlap (db87's swapped ratios);
ticks the log drops or the engine adds under time stops (c7790's 7 against 10); 4e36's Wulfgard ticks (×1.1315 with
the application's side, ×0.954 with the tick before's: between); 0c14's and 489c's Rossi ticks, c83c's Laevatain.

**Check improvement:** the build-offset line only reads hits with
`crit === false`; Si's hits there have crit null, so no offset was
reported. Weapon skill levels could be inferred from logged weapon-buff
values (c83c's 0.21). Done in part (2026-11-18): `efsim zmdlogs
fit-build` scores attribute nodes, weapon level and food on every landed
kit hit (crit null tried both ways) by the recomputed reading, foods' DMG
lines too; its fits go into a fixture's `buildOverrides` with the counts
(docs/design/data.md, the log check's rule). Left: the weapon level's
bound from its logged skill levels (WeaponBreakThroughTemplateTable isn't
loaded), weapon skill levels and gear artifice as candidates.

## Akekuri in 012a: Thermite Cutter's team ATK too early, and ×0.89 left

**Shows (haiku, 2026-11-14):** the engine gives wpn_sword_0012.team_atk
(+0.08) from ~14 s to 31 s; the log lists it from 31.08 s (her combo) and
the teammates' damage fits without it before (Laevatain 41 log-listing
fits against 2, Camille 59 against 1, Arcane 24 against 2). Without it her
16–22 s hits go from ×0.851 to ×0.893, like 37–60 s (×0.892): a constant
×0.89 is left on her 35 physical hits.

**Ruled out (for the ×0.89):** weapon level (skill 9 needs 80+), nodes,
potential, gear, Thermite skill 3, her skill levels (1/1/1/9 right), food.

**Still possible:** her weapon's skill 2 at 4 instead of the exported 9
(fits late, less early); the enemy's physical resistance (data 12, ~21
would fit; Tower 15's 20 fits 458b); Thermite's trigger rule (when its
team ATK starts).

**Fixed (sonnet diagnosis, 2026-11-14):** teammates' Link gives no
Thermite layer (Camille's combo in 012a, Lifeng's in 82735 and d4fb); the
kit's Link trigger now counts only Link the wielder grants (`fromSelf`).
012a plain: Laevatain 53 → 90, Arcane 116 → 142, Camille 58 → 117; d4fb:
Chen 30 → 42, Pogranichnik 93 → 129. Test 94 decided. The constant ×0.89
on Akekuri's own physical hits stays open.

**Next check:** Akekuri's ×0.89 (weapon skill 2, the enemy's physical
resistance).

## Type 50 Yinglung's Edge: how many stacks a combo gets (Estella, Si)

**Data (`efsim gamedata tree buff_equipsuit_atk_02`, `_aruadetect`,
`_addcombodamage`):** the wearer's aura puts a detector on every team
member (no stackingSettings: each wearer's aura its own); a member's own
battle-skill cast (ability event 30, CheckSkillType [2]) adds a layer to
the aura's source, the wearer (stackingType 2, max `max_stack` 3,
lifeType 1, no duration); the wearer's combo cast ([6]) turns the layers
into a one-cast +0.2 × layers (CheckSkillCastId) and finishes them all.
`finishWithNextSkillIfNotInherited` is on every CreateBuff in the data
(Estella's batch notes), so it decides nothing. The log never lists the
buff.

**The test (2026-11-22, the hypothesis brief):** for every combo of a
wearer in the development logs (Si in 26 logs, Estella in a27b, ad7f,
a9d7, Chen in 7e19, a9d7, Bounda in abfd), the layers its damage implies:
per combo hit, the DMG bonus the log's own reading lacks (every listed
buff as listed, the unlisted consumed ones out: Edge and Jade Vessel's
next-combo 0.3–0.7, not a multiple of 0.2, so the two separate) and the
same from the replay's reading; a combo is decided when a reading's
median over its hits sits within 0.05 layer of a count (two exact
readings that differ leave it open). Decided: 68 Si and Bounda combos.
Left out with their non-Edge causes: a9d7 (then a factor on every
operator: its team's food, fixed 2026-11-24), 8915 to 86.8 s (the stage's shields), 7b54's split combos,
7e19's Chen (the readings disagree), 4e36 11.6, 9c0b 71.5 (two exact
readings: the replay's ATK buff and one layer, or neither and two), 489c
50.5, a7a7 45.4; Estella's five single-hit combos (the Razorhorn ATK on
that hit was fitted on the same hits: two unknowns, one hit). Each
hypothesis is a rule on the log's casts (`zmdlogs instances`: placed
casts and cast events; Laevatain's event and her during-ultimate hits
one press; Last Rite's battle skill from her phantom's keys), scored
exact / first-combo lower bound (layers from before the log may add) /
wrong, of 68. Scripts: scripts/probes/edge/ (edge-export.ts, edge-score.py);
edge-search.py stayed in that session's scratch.

| Hypothesis | Exact | Lower | Wrong |
|---|---|---|---|
| H0 the engine's replay (base 1ab4647) | 52 | 4 | 12 |
| H1 every logged battle cast and cast event, anyone | 58 | 0 | 10 |
| H2 only casts with a battle-skill hit | 41 | 9 | 18 |
| H3 H1 without Si's hitless presses | 55 | 4 | 9 |
| H4 H3 + every ultimate | 41 | 4 | 23 |
| H5 the wearer's own casts only (not the set text, not the aura) | 6 | 23 | 39 |
| H6 teammates' casts only | 27 | 20 | 21 |
| H7 H3, layers taken at the combo's first hit | 47 | 6 | 15 |
| H8 H3, layers added at the battle skill's first hit | 50 | 8 | 10 |
| H9 H3 with an expiry of 5 / 10 / 15 / 20 / 30 s | 11 / 21 / 28 / 39 / 48 | | |
| H10 H3, the cap keeps the newest | 51 | 6 | 11 |
| H11 H3, any wearer's combo clears everyone's | 47 | 7 | 14 |
| H12 H3, the wearer's ultimate clears | 43 | 9 | 16 |
| H13 H3, a hitless combo event consumes | 51 | 6 | 11 |
| **N1** H3 + layers lost over a pause in the fight (no hit for 5 s / 10 s) | 57 / 56 | 4 | 7 / 8 |
| **N2** H3 + Si's first hitless press within 20 s after her battle-skill hit (her stroke under Artful Intent) | 61 | 1 | 6 |
| **N1 + N2** (5 s) | **64** | 1 | **3** |
| N1 + N2 (10 s) | 63 | 1 | 4 |
| **S** (2026-11-23) H3 + Si's strokes from her bursts: Initial Stroke at her first press after each battle-skill hit unless the burst is the mark's (no Inksoul); Final Stroke where the burst's poise.origin is normal_skill_2 | 62 | 1 | 5 |
| S + N1 (5 s) | **65** | 1 | **2** |
| S, Final Stroke's layer left out | 62 | 1 | 5 |
| S, Initial Stroke at the last press before a Final Stroke | 61 | 2 | 5 |
| S, Initial Stroke also at the press that ends a mark-burst Artful Intent (20–34 s after the hit) | 59 | 1 | 8 |
| **H0 the engine's replay, 2026-11-23** (S built: 2a9a267) | **61** | 2 | **5** |

(N2 with the first two presses, or within 10 s: the same counts; all her
presses within 20 s: 60 / 1 / 7, wrong 9555 92.3 and c83c 55.1.) The
engine's 5 wrong after S: 3f78 46.9 and 4a64 53.8 (N1), 0c14 166.7, c779
43.7, db87 41.2 (Laevatain's battle skill made twice, below); against
base 6b117c1 it gains 0c14 122.1, c83c 55.1, 82.3, 97.9 and 9555 92.3, and
two first combos (c83c 9.0, e989 6.9) become exact.

**Decided by the logs:** anyone's battle skill feeds every wearer (H5, H6
out; abfd: Si's and Bounda's counts from the same casts, ad7f Si's 3 and
3); no expiry inside a fight (H9: c83c 55.1 keeps Laevatain's 18.3 s old
layer, 0c14 59.3 Rossi's 23.9 s old one); one wearer's combo leaves the
other's layers (H11 worse: abfd); casts count at their press, combos take
them at their cast (H7, H8 no better); ultimates don't count (H4); Si's
periodic hitless presses don't count (H1's misses: c83c 55.1 fits 1 with
five of them in the window, 0c14 81.7, 4e36 37.4, c83c 97.9 alike), but
her first press after her battle skill does (N2: c83c 35.8, 82.3, 0c14
122.1, e989 53.0 need it; the press in Artful Intent's 20 s is Initial
Stroke). Pauses: 3f78 (no hit 22.7–43.5 s) and 4a64 (29.2–51.3 s) fit
one layer fewer than a cast before the pause gives, 7b54 (21.1–27.0 s)
two fewer; abfd's 4.9 s pause keeps them (so 5–5.9 s, if it is a time;
leaving battle, which the log doesn't record, is the likelier cause).

**Fixed (2026-11-22), the replay (buffreplay.ts):** (1) castsFromBuffEnds
inferred Si's Final Stroke from every Artful Intent burst the replay's
mark outlasted, also from the mark's own burst (`inkmark_projhit`, the
kit's branch without an Inksoul), where Final Stroke can't be cast (it
needs the Inksoul): a forced Final Stroke and an Edge layer the damage
hasn't (0c14 81.7, 489c 107.6: 3 → 2, the implied count). A skill that
needs a buff the logged hit's branch says was off is no longer inferred;
the logged end is the buff's expiry instead (an `expires` step: it ends
then, with no cast; bdf2's burst at 24.32 s keeps its landing). The
engine's score: 52 / 4 / 12 → 54 / 4 / 10. **Found, not fixed:**
withLoggedCasts makes Laevatain's battle skill in Twilight twice when a
stop holds its hits back (db87: the `normal_skill` event at 27.13 and
40.78 s, the `normal_skill_during_ult` placed from hits at 29.00 and
41.57 s, across Si's ultimate stop and combo slow-down: db87 41.2 has 3,
the damage 2). Merging the press with the placed variant at the press
fixed db87 (41.2 → 2, plain 114 → 126; its 29.43 s hit 65,139 → 84,681,
logged 84,681) but broke Purrchena (04d4 at 5.23 s: there the press is
her battle skill and the placed counter its next step), and the two kits
look alike to a static rule (`not X` / `X`): the replay's state at the
press has to decide (reverted, 69360fd).

**Si's strokes from the log (2026-11-23, built: 2a9a267).** What each
press is and how each Artful Intent ended, from her bursts
(the hits' `poise.origin`, in imports and refreshes since 2026-11-16;
73 bursts in the development and multi-target logs; scratch scripts, not
committed: si-bursts.py, si-after.py, press-where.py, ai-natural.ts,
edge-strokes.py):
- **The burst's origin says the end.** Final Stroke's inkboom casts the
  Inksoul's return inheriting its cast (SkillData normal_skill_2 →
  BuffData xianjing_inkboom → CastSkill normal_skill_inkmove_2,
  inheritSourceSkillCastId): origin `normal_skill_2`, 26 bursts, 6–26 s
  after the battle-skill hit. The Inksoul returning by itself as Artful
  Intent runs out: origin `normal_skill_inkmove_2`, 22 bursts, 20–38 s
  after (on the replay's enemy clock within −1.0 to +0.8 s of its expiry,
  but for 0c14 181.4 and 458b 85.6). The mark's own burst (no Inksoul):
  `inkmark_projhit`, origin `normal_skill` (Artful Intent's own
  LaunchProjectile at its end), 26 bursts.
- **Initial Stroke is the first press after the battle skill.** Of her
  276 hitless battle-button events, 269 fall inside an Artful Intent (the
  other 7 at a log's start or at an edge), every 2.7–14 s (quartiles 3.2 /
  3.4 / 3.9 s, 180 intervals). An Artful Intent with an Inksoul burst has
  its first press 1.6–19.4 s after the hit; scoring Initial Stroke at the
  first press beats the last press before Final Stroke (S rows above:
  e989 53.0 needs the first).
- **Her later presses under Artful Intent do nothing the log shows:** no
  hit, no end (by the kit the second would be Final Stroke and end it),
  her basic chain goes on (test 16), no layer. What they are (strokes the
  game refuses, presses without SP) is open; the replay doesn't make them.
- **A mark-burst Artful Intent ends at its one press.** All 26 have
  exactly one press before the burst, 20.6–33.7 s after the hit, the burst
  0.42–0.58 s after it (13–17 frames: the projectile's own) in 20, up to
  1.16 s in 6; on the replay's clock the press is 1.44 s before to 3.80 s
  after the expiry (4e36 36.8: still recording at 32.92 s, 1.0 s past the
  replay's expiry). So without Initial Stroke Artful Intent lasts until
  that press; the press gives no layer (S with it: 59 / 1 / 8, 0c14 81.7,
  489c 107.6, 4e36 37.4 wrong). The replay ends it at the logged end (an
  `expires` step, as before).
- **Final Stroke's layer:** no log tells (S with and without it: the same
  counts); in each case its layer falls past the cap of 3 or before the
  same combo as another (test 106 (d) stays).

The replay (buffreplay.ts): castsFromBuffEnds infers a cast that ends a
buff only from a logged hit credited to it (poise.origin) or credited to
nothing (fixtures before 2026-11-16); else the end is an expiry.
pullingPresses makes the first slot press after each landed battle skill
Initial Stroke (ReplayedCast.as: the variant castable under Artful Intent
before the Inksoul, whose cast gives the Inksoul), unless the log shows
the mark's burst for that Artful Intent. The kit's initial_stroke trigger
is detached (the Inksoul comes from the entity Initial Stroke spawns at
frame 0: SpawnAbilityEntity, normal_skill_abilityrange frame 8): the
replay's next basic attack cut it before frame 8 (c83c 29.30 s), so its
burst at 57.26 s took the mark's branch. Bursts the replay lands: a7a7
17.22 now (was none), c83c 87.89 at +15 ms (was +415); none lost.
Scoreboard (measure): development plain 59.9 → 60.1%, mismatch 16.4 →
16.2%, mean |damage error| 9.2 → 9.3%; earlier pending 53.1 → 53.2% plain;
verified and hold-out unchanged. c83c mismatches 31 → 0, 9555 11 → 1;
7b54 damage 48.2 → 49.0% (its combo at 46.7 s now has 3 layers, from
Initial Stroke at 33.15 s; that combo is out of the Edge test, its hits'
other zones off by the slug's caps: no truth either way).

**Pauses (N1), 2026-11-23:** every pause of 4.5 s or more in the logs
(scripts/probes/stagger/pause-bars.py: each pause's Stagger bars and listed enemy
debuffs either side): the bar is back to full after every pause of ~5 s or more (abfd
174 → 275 over 4.9 s, 7b54 7 → 55 over 5.9 s, c3c7 128 → 315 over 7.4 s),
so it marks no new enemy. The two clear cases, 3f78 (22.7–43.5 s) and
4a64 (29.2–51.3 s), are the boss Si's (eny_0134) half-HP pause: ~21 s, at
50.3% / 51.8% of the logged damage, most enemy debuffs gone after (2 of
11, 1 of 13 still listed); the same pause in 0c14 (87.4–107.3 s, 51.2%)
and e989 (19.7–43.1 s, 50.9%) fits either way. 7b54's 5.9 s pause (the
slug, 38% dealt) is weak: its 31.4 combo reads 3.00, one layer with Jade
Vessel (on: Si's Immobilization at 29.0 s) or three without, and one of
the casts before it is Camille's hitless press at 19.9 s. 0c14 166.7 is
no pause case: its burst at 181.4 s (×0.288 of the reading, below) fits
0.17 × every hit from 155.79 (exclusive) to 158.76 s (inclusive) onward
(90,026 logged, 90,026 computed), so a battle skill re-made Artful Intent
then (her press at 157.42 s, its hit not in the log): with it and
Initial Stroke at 160.48 s, the combo's 3 layers. **The data has no
battle-exit clear for the set:** none of its four buffs handles leaving
battle (ability event 7; event 6 is entering it: buff_chr_0016_laevat
_potential_1), and no buff field ends a buff out of battle
(`finishOnRepatriate` is false); event 7 is in six buffs only (Laevatain's
P1, three of Typhoeus's, Si's normal_skill_check: exit_fight_delay 2 s,
then Artful Intent ends; her inkhurteffect's own is disabled). The layer
is a child of the caster's detector (aruadetect CreateBuffAction
`asChildBuff`), so a member's layers go with that member's aura buff;
but 3f78 and 4a64 lose the wearer's own too ("others' layers only": 63 /
1 / 4), so not a member leaving the aura. Not built; test 106 (e) asks
about the phase change.

**Left (S + N1: 2 of 68; the engine: 5):** c779 43.7 fits 2 where every
reading gives 3 (64.9 fits now); 0c14 166.7 (the unlogged battle skill
above); 3f78 46.9 and 4a64 53.8 (the phase pause); db87 41.2
(Laevatain's battle skill made twice, above).

**Still possible:** what Si's later presses are; why Artful Intent
without Initial Stroke outlives its clock until a press; whether Final
Stroke counts (test 106 (d)); what the boss Si's phase pause does to the
layers (test 106 (e)); c779's layer.

**Next check:** in-game test 106 (e) and (d); Laevatain's press made once
(db87); a battle skill re-made where a burst's value says its record
restarted (0c14 157.4 s).
## Estella's Razorhorn ATK: on the Shattering hit; Lifts get about half

**Fixed 2026-11-14 (sonnet diagnosis):** wpn_lance_0013's atk_up (+0.336)
is on the Shatter and the combo hits at that moment (a27b 14630 / 44993 /
63630 ms ×1.2446 / ×1.292 / ×1.245, ad7f 12173 ×1.215 = the engine's
without it + 0.336 ATK); its triggers are beforeDamage now. Estella
a27b −9.5 → +2.7% (plain 11 → 16), ad7f −8.3 → +5.0% (18 → 21).

**Still open:** her Lifts at that moment fit half the buff (+0.168: ad7f
×1.105, a27b ×1.124 / 1.136 / 1.124), the full buff overshoots; why (the
Lift's formula, its timing) is open. ad7f 38169's combo fits one Yinglung
stack where the engine has three. Her other weapon in c4f3 (wpn_lance_0004,
ATK +0.42 on the first Vulnerable) triggers at other times than the log
(8.9–23.4 s listed, engine none; from 81 s the reverse). a9d7: all four
operators ×1.15–1.33 low from the first hit (a stage factor).

## OBJ Razorhorn's ATK lasts longer than its 15 s

**Shows:** wpn_lance_0013's atk_up (Estella's weapon) still listed 17.2 s
after its Shatter in a27b (44993 → 62229) and 18.7 s in 69e7 (13030 →
31681), against the data's 15 s at L9; the check says "log lists it,
replay isn't sure".

**Ruled out:** nothing yet.

**Still possible:** a refresh by a later Shatter or other trigger; the
duration read wrong; the listing lagging (stackingType habits, cf. Liino's
weapon).

**Next check:** each listing's start and the Shatters between (small model).

## Freezes on bosses: Si's Immobilization holds her Artful Intent (tests 104, 37)

**Shows (sonnet, 2026-11-13):** Si's Artful Intent ends (the Inksoul
burst: an exact expiry marker) fit only when her Immobilization freezes
the boss: abfd (Rhodagn) residuals 318 / −7 / 174 ms frozen against 1318 /
393 / 1174 immune; c3c7 (Chiliarch) 0 / 4 / 15 against 0 / 971 / 949;
0c14 (eny_0134) 1 / 5 against 834 / 39. Non-bosses fit frozen, as the
engine has. Jade Vessel's 30 s in abfd and c3c7 fits being stretched by
her freeze too. The engine makes every Boss (rank 2) control-immune
(clock.ts controlImmune, from b7b3's Cryo bursts during Tangtang's stare).

**Tried (2026-11-13, reverted):** no Boss immune. Development plain 36.1 →
35.4%, mean |damage error| 22.1 → 21.9%, hold-out unchanged; 4a64 (the
same boss as 0c14) loses Arcane 64 → 32 plain and Si 37 → 25: the whole
enemy clock frozen stretches timers the log says weren't.

**Ruled out:** "bosses ignore freezes" as a property of the enemy (Si
freezes Rhodagn in abfd, while b7b3's Tangtang stare on Rhodagn doesn't
hold Arcane's bursts); freezing the boss's whole clock (4a64).

**Still possible:** the freeze holds some timers and not others (Si's own
Artful Intent and Jade Vessel yes; Arcane's statuses, Corrosion, her
bursts?); Tangtang's stare differing from Si's Immobilization; the control
-immune tag 188749032 (only in Tangtang's and Si's buff files, no enemy
carries it in the data).

**Found (sonnet, 2026-11-13):** in the engine only the enemy-target buffs
matter (statuses, Corrosion, inflictions, Vulnerable, Stagger, enemy
actions: freezing them or not changes no verdict). On 4a64, freezing only
Si's own enemy debuffs (Artful Intent, her weapon's enemy_vul) keeps every
match (Si 37, Arcane 64 plain); freezing Arcane's (will_burst with another
of hers) costs the 64 → 32. The log agrees: her weapon's will_atk is listed
51313–54731 ms only, the frozen engine keeps it to 56.9 s. Si's Artful
Intent ends fit with only it frozen (abfd −318 / +7 / −174; c3c7 0 / −4 /
−15 ms).

**Proposed rule:** a freeze holds the freezing operator's own debuffs on
the enemy (and the enemy's own statuses, which no verdict tells apart),
not other operators' debuffs; bosses not immune.

**Measured (opus, 2026-11-13):** as proposed (no Boss immune, only the
freezer's debuffs held everywhere): development plain 36.1 → 35.9%,
mismatch 19.3 → 19.4%, mean |damage error| 22.1 → 22.3%; hold-out 44.1 →
44.4%, 6.2%, 17.7 → 17.6%. The loss is all on non-bosses, where others'
debuffs held fit better: b6aa (eny_0120 tower) Si 89 → 77 plain (Xaihi's
cryo_fragility under Si's freeze at 37.9–39.4 s, then "as the log lists
it"), 489c (eny_0127) Arcane 132 → 123 and Rossi 125 → 131 mismatches
(Arcane's will_burst under Rossi's freeze at 45.4–46.7 s), 791 (Tangtang's
stare) damage −8.9 → −11.7%. On bosses others' debuffs held is worse: 4a64
Arcane 64 → 32, Si 37 → 25 plain; c3c7 Si 86 → 82. abfd and 0c14 don't tell.

**Implemented:** bosses stay control-immune by default (their clock and
others' debuffs run on), but a freeze holds the freezing operator's own
debuffs on any enemy (actions.ts runTriggers; TimelineState.enemyFrozenBy
counts each operator's overlapping freezes once); non-bosses freeze whole,
as before. Against the branch base: development and hold-out unchanged at
one decimal (36.1 / 19.3 / 22.1%; 44.1 / 6.2 / 17.7%); 0c14 Endministrator
32 → 34 plain, damage +8.7 → +7.9%; abfd −4.5 → −4.4%; b7b3 (Tangtang's
stare on Rhodagn, the old evidence for immunity) unchanged: Arts Bursts run
on their operator's clock now, so it no longer tells.

**Ruled out (this round):** "a freeze holds only the freezer's debuffs" on
every enemy (b6aa, 489c, 791); every debuff held on a boss (4a64, c3c7).

**Still possible:** the boss/non-boss split being something else (the
control-immune tag on some enemies only; the debuff kinds: Arcane's weapon
buff against her kit's); whether a boss's own clock (its statuses,
Corrosion) stops, which no verdict tells apart; Tangtang's stare on a boss
holding her own debuffs (b7b3 doesn't tell).

**Next check:** in-game test 104 (does a boss visibly freeze?) and 37.

**Changed (2026-11-16, test 104 answered by the owner: most bosses freeze,
a few rare ones don't):** an enemy freezes unless it's listed as
control-immune (packages/data/src/enemyFacts.ts), the freezer's own
debuffs held on a listed one as before. Each boss with a freezer in the
logs, checked frozen against immune (Si's own debuffs held under both, so
her Artful Intent ends don't tell them apart):
- Rhodagn (40d9, b7b3, abfd, c7790, e82d): every verdict the same; frozen
  (the default). b7b3: one Tangtang assumed match becomes a fallback.
- Chiliarch (c3c7): frozen holds Ardelia's Arts Susceptibility past where
  the log's hits fit without it (48.3–54.5 s): Ardelia 139 → 122 plain, Si
  120 → 110 (assumed or fallback, no new mismatch). Listed immune.
- The enemy Si, eny_0134 (4a64, 3f78, 0c14, e989): 4a64 frozen holds
  Arcane's will_atk past its logged end (54.7 s; 56.9 s frozen): Arcane 64
  → 32 plain, Si 37 → 25; 3f78 leans frozen (Si 20 → 23); 0c14, e989 don't
  tell. Listed immune.
Scoreboard unchanged in every group (no hold-out moved).

**Still possible (now):** Chiliarch and eny_0134 being frozen after all,
with something else holding teammates' debuffs less than a freeze would
(their evidence is one log each, 4a64 against 3f78 for eny_0134); the tag
being a buff the enemy carries only at times (the data checks the enemy's
buffs for tag 188749032 at each freeze, CheckBuffStackNumAdvanced, so a
boss could be immune in some phases only: 4a64's freezes at 51–53 s
against 3f78's); why an immune enemy still holds the freezer's own debuffs
(no data mechanism found: Artful Intent and Arcane's will_atk have the same
time-dilation flags).

**Found (2026-11-23, ramp slow-downs round):** Corrosion's ramp, which no
verdict could tell apart before, runs on through a freeze on an enemy that
freezes: f978 (Si, 57.6 s: at most 0.51 s of its 1.5 s held), a7a7 (Si,
18.1 s: 0.68 s), 7910 (Tangtang's stare, 47.8 s: about 0.7 s of 4 s), from
the ramp's steps (scripts/probes/corrosion/freezeramp.ts). The engine now
holds Corrosion's end but not its ramp in a freeze (assumption
`freeze-ramp`, default `runs`); its end isn't tested by any log yet.
**2026-11-25:** its end runs on too (489c's Corrosion against Si's freeze at 43.6 s), and Combustion's ticks (f978 at
57.80 and 58.80 s): no Arts reaction status is held by a freeze, the debuffs are (`freeze-ramp` default `statuses`;
"Ultimates pressed together", above, has the evidence and db87's one worse log).

## The buff clock: unlogged world holds keep buffs past their end (2026-11-22; test 111)

**The hold-outs test the lane-based rules now (2026-11-23, refreshed blind):** until then all 13 hold-outs and the
verified 40d9 and 4e5e listed effects without `since` / `source` (imported before 2026-11-16), so every rule below
that reads the log's runs (the hidden holds' run and status clocks, `heldToLoggedEnds`, Wolven Blood's `layerCrits`)
had nothing to read there. `node scripts/holdout-refresh.ts` refreshed the 13 without anyone seeing one (13 ok); 40d9
and 4e5e were refreshed normally (`zmdlogs refresh`, which now keeps an older `unquantified` listing the detail no
longer marks). Same code (main at 636bbc0), the fixtures only: hold-out plain 74.0 → 77.6%, matched 91.7 → 92.1%,
mismatch 6.4 → 6.3%, mean |damage error| 10.8 → 10.6%, within 5% 7 → 8 (5 better, 1 worse, 6 mixed; the worse one
can't be traced: a hold-out). Then `measure --variant` on the refreshed hold-outs against the default `placed`
(77.6%, 6.3%, 10.6%): `none` 70.3%, 6.5%, 10.9% (1 better, 7 worse); `log` 73.0%, 6.5%, 10.7%; `holds` 76.8%, 6.3%,
10.5%. **Confirmed on the hold-outs:** the placed holds with `log` on top beat every other reading there, by about
as much as on the development logs (`none` → `placed`: development 57.8 → 65.4%, hold-out 70.3 → 77.6%). Not
separable: `layerCrits` and `valueCrits` have no assumption reading (`valueCrits` reads values, not lanes, and ran on
the hold-outs before); `layerCrits`' share is inside the refresh's 74.0 → 77.6%.

**Shows:** every run of a listed game buff a team kit stands for, over the 77 development logs whose listings carry the
runs' start and owner (verified, pending, multi-target; 40d9 and 4e5e didn't then): its start as logged (the lane's
`since`), its end bracketed by the last hit that lists it and the next hit of a holder that doesn't (exact at a
boundary hit, or from the raw detail's lane end for the 19 cached), its length in world time (the placed casts' stops
taken out, `worldMs`) against the data's duration, and against the replay's own expiry. 6,991 runs; 724 single runs
(not refreshed in the log, bracket ≤ 1.5 s, a canonical duration, excess −1…8 s; one per log, buff, owner, start and
end) run a median **+0.49 s** of world time past their duration (quartiles +0.03 / +1.35; within ±0.25 s: 23%).
The commonest (scripts/probes/buff-clock/lanes.ts, and table.ts in that session's scratch/bc/):

| buff | owner | D (s) | runs (logs) | world excess: median (p10–p90) | no ultimate inside: median (n) | over the replay: median |
|---|---|---|---|---|---|---|
| equipsuit_usp_02_AddAttack | Gilberta | 15 | 81 (33) | 0.28 (−0.63–1.72) | 0.24 (52) | 0.25 |
| equipsuit_fninflict_01_firedamageadd | Laevatain | 10 | 51 (17) | 0.66 (0.18–3.09) | 0.65 (33) | 0.57 |
| wpn_funnel_0011_valid | Gilberta | 15 | 40 (9) | 0.36 (−0.45–1.84) | 0.37 (27) | 0.51 |
| equipsuit_combosuit_01_adddamage | Camille | 15 | 39 (15) | 0.42 (−0.18–2.43) | 0.42 (23) | 0.48 |
| common_affixes_enhance_crystal (Si's Amp) | Si | 12 | 32 (19) | 0.80 (−0.18–3.60) | −0.04 (4) | 0.82 |
| common_affixes_vulnerable_spell | Gilberta | 5 | 30 (16) | 0.14 (−0.35–1.01) | 0.14 (14) | 0.14 |
| common_affixes_vulnerable_physical | Mi Fu | 20 | 30 (13) | 0.16 (−0.65–3.03) | 0.22 (9) | 0.62 |
| common_affixes_enhance_pulse | Zhuang Fangyi | 5 | 27 (9) | 0.02 (−0.62–0.73) | 0.10 (15) | 0.04 |
| chr_0006_wolfgd_talent_0_effectbuff | Wulfgard | 10 | 23 (9) | 1.20 (0.02–4.56) | 1.20 (17) | 0.56 |
| chr_0034_typhoea_combo_enemy_debuff | Typhoeus | 6 | 21 (7) | 0.36 (0.02–0.96) | 0.32 (16) | 0.37 |
| chr_0004_pelica_potential_3_atkup | Perlica | 5 | 21 (9) | 0.17 (−0.43–1.68) | 0.02 (18) | 0.17 |
| wpn_funnel_0008_magic_damage_taken_up | Arcane | 15 | 15 (8) | 0.75 (−0.03–1.56) | 0.75 (11) | 0.71 |
| wpn_sword_0022_final (Wolven Blood) | Rossi | 20 | 13 (6) | 0.23 (−0.41–0.95) | 0.16 (6) | 0.80 |
| chr_0016_laevat_ignore_fire_resist (Scorching Heart) | Laevatain | 20 | 10 (8) | 0.48 (−0.43–1.48) | 0.48 (7) | 0.47 |

Si's Amp, one ultimate's 12 s buff with nothing that refreshes or extends it (`gamedata tree
buff_chr_0036_jsspsi_atk_buff_2`), is the cleanest probe: its runs end at one ms on every holder (the raw lanes),
whatever each holder's own stops or hits; exactly on time where no other ultimate falls inside (e989 9.5 s −0.12, f978
49.2 s −0.16: its 12 s 10.8 s Staggered), long elsewhere (79cc +0.65, c779 +0.52, c83c +1.41, e49e +1.62, db87 +2.49,
632c +3.60, 489c +3.81; exact ends, over the replay). Over all exact ends, by the ultimates inside: 0 → median 0.34 s,
1 → 0.60, 2 → 1.09, 3+ → 1.83 (but a per-operator constant per ultimate fits no better: 156 → 171 of 440 within 0.3 s).

**Found (what holds them):**
- **The buffs really act there** (not a listing lag): of the hits the log lists a buff on past the replay's expiry (runs
  ≥ 0.4 s past it), the damage fits the log's reading (buff on) at 802, the engine's (off) at 92, both 195, neither 703
  (`zmdlogs hits --all --json`, scripts/probes/buff-clock/dmg.ts).
- **One clock per fight, shared by the buffs and the enemy's ticks.** Hidden holds P(t) (what the placed stops don't
  explain), nondecreasing, one per log: each run asks P(end) − P(start) ≈ its world excess (±0.2 s); difference
  constraints, the conflicting run with the largest excess dropped until feasible (scripts/probes/buff-clock/clock2.ts). Of 1,378 runs,
  one clock per log drops 152 (each run alone, about 106 can't be met at all: ended early); with the runs' excesses
  shuffled among the log's runs, 341. Adding the 588 consecutive pairs of the enemy's 1 s tick series (Combustion,
  Rossi's bleed: each pair's world gap less 1 s, ±0.15 s) costs 6 more runs and drops 28 pairs. The 8 runs a tick
  series covers end where its ticks say: all within 0.3 s (2fd9 Mi Fu's set +0.98 against +0.99).
- **The holds are about a perfect dodge each, and never while the enemy is Staggered.** Tick pairs with no placed stop
  between: median residual 0, and 34 of 378 outside the log's Stagger come +0.31–0.79 s late (most +0.42–0.56 s), 1 of
  92 inside it (scripts/probes/buff-clock/tickstag.ts). A perfect dodge's world slow-down (buff_common_dash_behit_listener,
  TimeDilationAction layer 0, the dodger exempt; the engine's `--dodge` reads it) holds 0.512 s; a Staggered enemy
  doesn't attack, so nothing is dodged. Two series see the same hold at once (489c 36.55→37.97 and 37.43→38.98 s). The
  log records no dodge (no event, and the SP they give, 7 each, is in no log: "Team SP" below runs short).
- 9c0b's ten seconds with no hit by anyone after Laevatain's ultimate hold about 7.5 s (one clock: Forgeborn +6–7.8 s,
  Si's Amp from 9.5 s only +0.8 s): the world all but stood still, as in 4d60's 7.2 s (test 110): a pause the log's
  clock runs through, not dodges.

**Ruled out (each against the table, the clock or the ticks):**
- A listing lag (the log listing a buff after it ended): the damage (802 against 92 above).
- A clock per holder (its own hit-stops, animations, swaps): Si's Amp ends at one ms on all four holders, whose own
  stops in its window differ by up to 2 s; HitStopAction is 0.03–0.05 s a hit and her Amp is exact in e989 and f978
  with her hits in them.
- Overlapping stops holding for their sum (Rossi's candidate): Si's Amp in 4f7e overlaps 2.29 s of stops and ends
  −0.27; 458b 76.6 s none and +1.31.
- A clock rate (excess ∝ length): free tick pairs run at 1.000 between holds; Si's Amp exact in some windows, +3.8 s
  in others of 12 s.
- A constant per ultimate or per combo: fits no better than none (above); Wulfgard's talent buff and Laevatain's set
  buff run long with no ultimate inside.
- The game timer pausing (the log's `timeSource` game_timer): e989's official timer ran 6.9 s more than its timeline,
  so a paused game is out of the log's ms, not in it.

**Fixed (2026-11-22): the replay keeps a buff on while the log lists it** (engine assumption `hidden-holds`, `log`
default, `none` the replay before; holdinputs.ts `heldToLoggedEnds`): a timed kit buff whose single run (from its
application ±3 s, not refreshed in the log) the log lists past the replay's expiry runs on to a frame after its last
listed hit, before any hit of a holder past the expiry that doesn't list it, a step at a time (the replay's later
stops don't hold it past that end), within 40% of its life (the probes' most: Si's Amp 32%, Forgeborn 39%). Measured:
all but the hold-outs plain 55.7 → 57.5%, mismatch 18.8% unchanged, mean |damage error| 8.3 → 8.1% (development 57.8
→ 59.9%, 16.5 → 16.4%, 9.8 → 9.2%), within 5% 33 → 31 (fc63 and c83c, which over-predict already, cross 5%);
hold-outs unchanged; per-hit error closer in 15 of the 16 mixed logs. Simulations don't read it (they dodge with
`--dodge`).

**Placed (2026-11-23): the holds once per fight, for every timer** (engine assumption `hidden-holds`, new default
`placed`; packages/logs holds.ts, `efsim zmdlogs holds <fixture>`). The replay runs once without holds; each of its
buffs that ran out (as `log` takes them) bounds the hidden clock P against the log's run of it: P(last listed hit) −
P(application) at least its lateness over the replay's expiry, P(next hit without it) − P(application) at most, both
±0.2 s and in world time past the expiry (a placed stop after it holds the buff once it lasts: without that, b6aa's
Xaihi debuff ran to 46.6 s against 43.8). The enemy's tick series (Combustion, Rossi's bleed, Typhoeus's combo field,
Aurora's ultimate) bound it per pair and per tick against its chain's first (a tick's jitter doesn't add up along a
chain). P rises no faster than real time and not inside the replay's Stagger. Difference constraints; a bound in a
negative cycle is dropped (the largest ask first, a tick's at half weight). The estimate is the least total hold, midway
between its earliest and latest placement (feasible: the bounds are convex), held on the world's clock a frame at a
time (timeline/clock.ts `holdWorld`: buffs, the enemy's statuses and debuffs, combo windows; not cooldowns, which the
perfect dodge's slow-down doesn't hold by the data, nor SP or the operators' own timing, which is the log's). Then `log`
keeps a listed buff to its listing's end.
- **How well determined** (`zmdlogs holds` shows each log's; the totals: scripts/probes/hidden-holds/determined.ts):
  108.6 s of holds over the 60 logs' 5,899 s (verified, development, earlier pending; 1.8%, 211 dodge-sized units of 0.512 s; per log
  0–9.2 s, c4f3 9.2, fc63 5.9, 0c14 5.7, de6a 5.5, af7b 5.2, 9c0b 3.9, e989 0.2, 3f78 / 5082 / 6339 / 7b54 none). Of
  the units, 50 are placed within 1 s (earliest to latest), 92 within 3 s; every unit is spanned by a kept clock, 56 by
  one only, 155 by two or more (median 3). Bounds kept: 897 buff runs (45 dropped), 1,559 tick bounds (255 dropped,
  most in 489c, fc63, 04d4; in 489c the bleed's ticks inside the Stagger run 0.2–0.3 s fast across the placed stops
  there, which no hold can explain). The least total is a lower bound: a span no clock covers gets none (dodges there are invisible).
- **Measured against `log`** (scoreboard): development plain 59.9 → 62.8%, mismatch 16.4 → 15.6%, mean |damage error|
  9.2 → 9.1%, within 5% 14 → 16; hold-outs 69.6 → 69.9%, 6.7 → 6.6%, 11.0% (2 better, 1 worse); earlier pending 53.1
  → 54.0%, 23.3%, 8.1%; verified 75.6 → 77.4% (matched 95.6 → 98.0%); all but the hold-outs 57.5 → 59.6%, 18.8 →
  18.3%, 8.1 → 8.0%, within 5% 31 → 34. Better: db87 (plain 121 → 166, mismatch 109 → 59), f879 (651 → 772), af7b
  (473 → 560, mismatch 16 → 0), 4bfc (692 → 767, damage −6.8 → −1.4%), 9847, 489c, 00ae. Worse: d572 (921 → 908,
  mismatch 17 → 26: Wolven Blood at max stacks from 30.1 s, a layer held past its end; Corrosion's ramp a step behind at
  68–76 s, held by a hold that its listed levels say didn't hold it), 0c14 (135 → 133, damage 14.5 → 16.3%: Wolven Blood
  again, and Endministrator's P2 talent ATK held past 51.8 s), de6a (73 → 71: Pogranichnik's Never Rest held 0.1 s past
  92.27 s), a27b, ad7f, 4e5e (damage only, ≤0.6 pt); over-predicting logs over-predict more (c83c 6.9 → 8.2%, fc63 5.4
  → 7.2%: more buffs held). Held on the operators' clocks too (slowDown with nobody exempt), the holds moved kit-timed
  landings off the log's: bdf2 lost Typhoeus's Nature burst at 13.14 s to one frame of hold at 12.27 s (verified mean
  |damage error| 1.9 → 3.2%); on the world's clock alone 1.9%. Simulations unchanged (team-ab against 6b117c1: every
  team's fight the same).
- **The dodger's own clock:** the data's dodge holds the world 0.512 s (layer 0, the dodger exempt) and the dodger 0.315 s
  (layer 1, ten frames at 0.06). Pairs of runs in one log with nearly the same window (overlap ≥ 60%), one whose owner
  was controlled through ≥ 60% of it, one whose owner was controlled ≤ 25%: excess ratio median 1.12 (62 pairs, p25 0.71,
  p75 1.98), not the 0.62 a buff on its dodging owner's clock would show; by holder 1.00 (213 pairs: one instance stands
  for every holder). So no sign of the dodger's own time scale on its buffs; the 0.315 s stays the dodger's freeze (its
  actions), as the engine has it. Rossi's Wolven Blood, short against Si's Amp on the same window in 489c (2.3 against
  3.8 s) and held too long in d572 / 0c14, is the one buff that looks like its own clock.
- **Arcane's Imprisonment** (its end from the log, so not a bound): the 37 seals with a hold placed inside run 0.484 s
  from the free seals' median world length, 0.450 s with the placed holds taken out (102 not ended early): barely
  better; the seal's ±0.5 s doesn't follow the clock. **Gilberta's Vulnerable** stacks on the tower bosses (4360 116.0
  s, 9847 126.1 s: listed 0.39 / 0.36, the replay's 0.33 / 0.30): unchanged, the clock places too little in those 20 s
  windows (4360 1.1 s in all, 9847 2.8 s; one clock spans each unit).

**More clocks (2026-11-23, docs/journal/2026-11-23-02-hold-clocks-enemy-statuses-and-corrosion-s-ramp.md):**
- **The enemy's listed statuses** (holds.ts `statusBounds`): each Electrification, Corrosion or Breach the replay
  without holds let run out, against the log's run of it (same applier, from its application ±3 s, not refreshed;
  the enemy's side of every hit lists them, whatever the element): the last listed hit at least its lateness (±70 ms:
  no holder's hits bracket a status), the next hit without it at most, but only for a status no team kit consumes
  (d774's Electrification ends at Zhuang Fangyi's battle skill, not its clock). **d774 fixed:** Perlica's forced
  Electrification (87.22 s, listed to 97.44 s, the replay's out at 96.6 s) asks 0.84 s; placed 0.83 s, the first
  Sunderblade strike at 97.87 s now plain (12127), and all eight strikes land one for one with the log's (lead 4's
  extra strike gone).
- **Corrosion's ramp** (rampsteps.ts, `efsim zmdlogs ramp <fixture>`): every hit under Corrosion read at each step of
  the replay's Corrosion (its level, applier's Arts Intensity, cap, carried shred); the steps whose damage fits the
  logged value (±1; the primary reading, else the log's listing of the kit buffs) give the log's world time since its
  application in whole seconds, against the replay's own world time there (its Corrosion's time at the landing, its
  placed holds added back: the placement's stops lack an ultimate the replay places from its event, db87's Laevatain
  at 16.60 s, which made a first version double-count 1.5 s). logcheck.ts `logBuffReplay` places the holds again with
  these bounds (first and last hit per run of steps), a step from the replay's at most (the ramp is read from the
  damage the check judges: three steps let the negative control's ×0.97 values place holds that fit them, bdf2 34
  chance matches). A log listing no Corrosion (db87) takes the replay's. **db87:**
  190 readings, 3 off the replay's step (was 24 of 186), plain 166 → 206, mismatch 59 → 18.
- **The ramp inside a stop** (engine, timeline/clock.ts shiftEnemy, status.ts `rampElapsed`): a running Corrosion's
  appliedAt moved past a stop at its start, so a hit inside the stop read a ramp younger by the rest of the stop
  (4d60 73.65 s: Arcane's hit inside Zhuang Fangyi's ultimate stop read a level-4 Corrosion 2.6 s younger, 14.4 against
  22.5 shred, logged step 4); now it stands at what it reached until the stop ends (ActiveStatus.rampHeld).
- **What the ramp says against the other clocks:** 9847's tower boss (Gilberta's Corrosion from 126.1 s) allows 0.6–0.94
  s of hold before 134.2 s and the Stagger after, where her Vulnerable spell run asks 1.76 s (dropped): the Vulnerable
  stacks outliving 20 s there are **not** the world's hidden holds (10 hits ×0.975 at 138.5–139.6 s turned mismatch).
- **The other direction is the replay's stops:** across the 28 development logs with Corrosion (3,553 readings:
  scripts/probes/corrosion/rampprobe.ts), the replay's ramp runs behind the log's (needs a
  hold below zero) on 146 readings, 139 of them with a combo slow-down in the window (f978 33, 3f78 26, 9c6e 25, a7a7
  22, 4d60 20, 9a80 8, 4a64 4), against 669 that need a hidden hold:
  the replay holds the ramp longer than the game across some combos (a combo pressed inside another's slow-down: 3f78,
  4a64, a7a7's openers), which no hidden hold can undo. a7a7 (lead 3: Si's combo stop alone holds 0.53 s where the log
  allows 0.42) is one of them: unchanged.
- **What over-holds it (2026-11-23, ramp slow-downs round; scripts/probes/corrosion/ramp-pairs.ts, freezeramp.ts):**
  read per reading against its stops, the 146 aren't one combo rule but four causes:
  - **Freezes, not combos (f978 33, 7910):** the replay's freeze held the ramp its whole length; the log's steps run on
    through it: Si's Immobilization in f978 at 57.6 s allows at most 0.51 s of hold in its 1.5 s, a7a7 at 18.1 s
    0.68 s, Tangtang's stare in 7910 at 47.8 s about 0.7 s of 4 s (the combos the old probe saw in those windows hold
    what they should). **Fixed:** a freeze holds Corrosion's end but not its ramp (engine assumption `freeze-ramp`,
    default `runs`; clock.ts `rampRunsOn`). f978 plain 444 → 469, a7a7 351 → 376 (mismatch 71 → 45), 7910 318 → 323;
    alone: development 64.4 → 64.6%, hold-outs 73.5 → 74.0% (2 better, 0 worse).
  - **Arcane's combo resets the combo slow-down (3f78, 4a64, 9a80, 9c6e, fc63):** her combo's SkillData has, besides
    its 0.6 s ComboSkill dilation, a layer-0 TimeDilationAction back to scale 1 (curve RESETto1, 1 frame) at frame 9,
    in the same priority tag as every combo's (timeDilationPriority −593023102). Under the lowest-scale rule a reset
    does nothing; the game keeps one dilation per priority, so it ends her own slow-down at frame 9 and any teammate's
    combo slow-down running then. 3f78's opener (Corrosion at 1.33 s, whose battle-skill event 0.63 s + 20 frames puts
    the application where it's logged, so the reading is sound): the steps allow 0.61–0.73 s held by 3.0 s; the
    lowest-scale rule 0.92 s, with the reset 0.72 s. **Built:** SkillTiming.resets and each slow-down's `priority`
    (skillData.ts), the engine ends the running slow-downs of that priority at the reset and gives each clock back
    what they would still have taken (clock.ts `cutAtResets`, `resetSlowdowns`: negative shifts), and every stop list
    the views and bounds use is cut the same way (logcasts.ts `skillStops`, `withResets`). Engine assumption
    `combo-reset`, default `resets` (the views cut at resets whatever the reading). 3f78 plain 53 → 63, 4a64 150 →
    156 (mismatch 2 → 0), 9c6e 164 → 169, 9a80 221 → 223. Alone (with the views uncut) it was mixed (hold-outs 73.5
    → 73.4%: the bounds counted her stop whole while the engine cut it); with the views cut, against that: hold-outs
    2 better, 0 worse. **Ruled out (round 7):** cutting the placement's unplaced cast events' stops at resets too
    (and their resets cutting the placed stops): 1cd1 plain 182 → 177, Typhoeus's basics moved by Arcane's combo
    event at 34.70 s, which the replay casts at 35.70 s; an event's time is the press, so its reset is no time to cut
    at (logcasts.ts placeHits says so). A test now keeps the stop lists on skillStops + withResets
    (tests/stops-source.test.ts); `efsim gamedata dilations` lists what the compiler drops (204 switched off, 49 on
    layer 1, no unknown curve). **The reset's reach (round 8 found it, fixed 2026-11-23):** the engine applied a reset
    only to the slow-downs running when the resetting cast started, so a teammate's combo slow-down starting between
    Arcane's combo and her frame 9 ran whole (1d91 at 50.30 s: Typhoeus's, 25 frames; 7910 at 4.90 s: Ardelia's, 24;
    9555 at 31.73 s: Xaihi's, 27), where the log tools' lists cut it (3, 4, 2 frames). **The logs side with the
    lists:** 9555's Imprisonment burst (on the world's clock from Arcane's cast + 11 frames) is logged 1.46 s after her
    cast, as with no teammate's combo (81.53 s: 1.48 s), where the whole slow-down put it 1.84 s after (−382 ms); her
    touch, Xaihi's and Last Rite's hits after it carry her Susceptibility and gear-set bonus at the logged values
    (assumed ×1.07–1.41 → plain); 7910's touch, Tangtang's and Ardelia's hits likewise (×1.18–1.30 → plain), its burst
    −200 → 0 ms; 1d91's Liino volleys 0.5 s late → within 0.08 s, its burst −292 → −25 ms. A reset still to come
    (TimelineState.resets) now cuts a slow-down of its priority that starts before it, which then doesn't hold the
    reset's caster (her frame 9 comes on time): engine assumption `combo-reset`, default `reaches` (`resets` the old
    rule). The lists already cut so (withResets). `replay --stops` over the development and verified logs since: no
    length difference left; one-sided only a skill's own slow-down at its jump's frame beside the frame-0 one (Rossi's
    combo_3 judged late, Pogranichnik's combo, Purrchena's shielded combo: "covered", the same holds), 3f78's Rossi cast
    at 50.13 s (not in the lists), and Liino's ultimate at −2 s in two multi-target logs (7b4e, dd08). Measured: development 5 better (7910 plain 324 → 339, 1d91 336 → 341, c83c
    563 → 569, 489c, db87), 3 worse (8915 −6 plain: the hidden holds placed again move a unit to 90–95 s, where it holds
    a Corrosion the log doesn't list, ×1.015; fc63 +2 mismatch at 107.97–108.33 s, where her Susceptibility now covers
    two hits the log reads without it, among five replay-only Typhoeus combo landings; 6339 damage 35.7 → 37.5%,
    Laevatain's 35.70 s battle skill lost its landing in a log already off by a third); earlier pending 9555 mixed
    (plain 261 → 270, per hit closer); hold-outs 1 better, 1 worse. **Purrchena's combo (round 8: 30 list-only stops in
    04d4 and 99fb, 6 the other way), fixed 2026-11-23:** two causes. (1) Her combo has no hits of its own (the giftbox
    deals its damage), so no landing shows its path, and the lists kept every slow-down (0, 210, 270) for every cast:
    the unshielded casts' phantom 210 and 270 slow-downs 7 and 9 s later. Without a landing the lists now take the path
    with no conditional jump (logcasts.ts pathOf). (2) The engine's shielded path from 210 reached the frame-270
    slow-down, though the combo casts her loop at 250 (a CastSkill of her own skill on the timeline): SkillTiming.recasts
    end a path's slow-downs as an end does (pathSlowdowns), her shield's extension on that path 41 − 13 frames. Left: her
    5 shielded casts (and one of Rossi's combo_3 on its late path, 99fb 39.43 s) carry the path's own slow-down at the
    jump's frame beside the frame-0 one the lists have; it's covered (the frame-0 one runs lower at every frame: 13.2
    frames held either way), so the holds agree. The replay's record kept one per start and priority until then
    (replayrecord.ts), which had hidden these and Rossi's and Pogranichnik's like them.
  - **The application's logged ms (a7a7 3.87 s and 20.53 s, 489c 49.31 s):** readings that put the log's ramp ahead
    of real time since its `since` (a7a7 20.65 s: step 1 at 0.12 s), so the application was earlier than logged.
    a7a7 3.87: Arcane's battle-skill event at 2.31 s puts its hit (frame 20) at 2.98 s, just before Liino's combo
    stop (3.00–3.93 s), and the log has it at 3.86 s, the stop's end (a hit before a stop logged at its end); the
    placement starts the cast from the hit through the stop (castStart, heldStart: 2.56 s, never before the event),
    so the replay's Corrosion comes at 3.86 s and misses the 0.32 s of world time Liino's stop lets through. A pair of
    readings doesn't depend on `since` (ramp-pairs.ts): without it, a7a7, 489c and 9a80 need no hold below zero.
    Not built: castStart taking a battle skill's event over the held start when a stop starts within a few frames
    of event + hit frame.
  - **Left (ramp-pairs.ts, 150 ms a side, readings inside stops left out):** Rossi's combos in 3f78 (combo_2 at
    5.77 s and combo_3 at 7.80 s: 0.87 s held where the pairs allow 0.72 s) and 4a64 (combo_3 at 8.93 s: 0.35 s where
    0.14 s), her combo_3 carrying two dilations at frame 0 (0.4 s in priority −361293424, 0.633 s in the combo
    priority) that the engine takes at the lowest scale (2026-11-23: either alone holds only 1.5–2.2 frames less,
    3f78's excess 167 → 114–135 ms: "3f78 and 4a64", not built); Zhuang Fangyi's ultimate in 4d60 placed from its cast
    event (73.63 s: 2.60 s held, 2.43 s allowed).

**Still possible / open:**
- Where in a window the holds fall: half the units are placed only to 3 s or worse; the least total misses dodges no
  clock sees.
- Which combo slow-downs hold Corrosion's ramp less than the engine: answered in part (above, 2026-11-23: freezes,
  Arcane's reset, the application's logged ms); left Rossi's two-dilation combo_3 (whether one priority outranks the
  other, or the latest replaces the earlier: the data names the tags, not their order; worth 1.5–2.2 frames either
  way, 2026-11-23) and whether one combo's
  dilation replaces another's in general (latest wins) rather than the lowest scale (the logs' steps can't tell them
  apart: the curves differ by tens of ms). Si's hits keep her own cadence while Arcane's combo slow-down runs in
  3f78's opener (2.10–2.73 s): a combo's caster may not be held by another's combo slow-down at all.
- **What else besides dodges** (holds a dodge can't be): 12 units fall in hitless spans of 3 s or more (0c14, 458b, a9d7,
  abfd, b6aa, c4f3, de6a: pauses the log's clock runs through, as 9c0b's and 4d60's); 9c0b's ~7.5 s after Laevatain's
  ultimate is placed only 3.9 s (its Forgeborn and Amp runs conflict, 7 dropped). Holds inside ultimates' stops: 489c's
  Amp asks 3 s more inside 24.7–30.6 s, where three ultimates and a combo overlap (the placed stops leave 3.3 s of world
  time there), against Wolven Blood's 2.3 s over the same span: the stops of overlapping ultimates held longer than the
  lowest-scale union (ruled out as a sum in 4f7e, not as something less). Ticks inside the Stagger running fast across
  placed stops (489c 52–64 s, −0.2 s a pair): stops in the Stagger holding the enemy's ticks less than the engine says.
- The other direction: runs that end before the replay's expiry (about 7%: a refresh or a cut the replay doesn't make,
  or a kit's duration).
- Liino's beats running fast (4d60 1.36 s for 1.5) are the other direction: not a hold.
- Rossi's combo Crit DMG window both longer and shorter than the replay's; Gilberta's 5 s Susceptibility listed
  8.6–12.5 s (beyond 40%: a refresh?); her Vulnerable stacks outliving 20 s by 0.4–1.6 s on the tower bosses: within
  what dodges hold (4360 fixed 2026-11-23: an instance buff's run as a clock; 9847 open, "Gilberta's Susceptibility").

- **Rossi's Wolven Blood is not on a clock of its own** (2026-11-23): the data has no time scale of its own
  (buff_wpn_sword_0022_final and _layer: onlyUseSelfTimeDilation and useTimeDilationDt false, as on Si's Amp); its
  bounded runs last 19.5–20.8 s of world time under the placed casts' stops (d572 four, 2fd9, 99fb, 489c's second),
  489c's first 21.9–22.3 s (the overlapping ultimates above). Its misfits are its start: the 16th layer. 489c's second
  final is listed from 55.61 s, on a power attack the log gives no crit (and Rossi's next five hits none either: crit
  null), so the replay (crit `never` there) reaches 16 layers at 59.5 s; d572's 9.89 / 79.87 s finals start 0.03–0.2 s
  late in the replay. The replay's 0.1–0.2 s overhang at d572 30.0 s is that start. **Fixed 2026-11-23 (layerCrits):**
  the log lists each layer with its start (`since`, one entry per layer and element), so n layers listed from a moment
  are n crits there (abilityEvent 44: one layer per crit, any hit kind, Seething Blood extras and Lifts included); the
  replay counts as crits that many of Rossi's crit-less hits at the moment, after the logged and shownCrits ones (all
  of them when as many, else the largest when they stand apart ×1.4). Every crit flag of the operator hidden, over the
  development logs: 956 of 973 inferred crits right (0.98; base rate 0.64); the listed starts moved to random other
  moments of her hits (the negative control): 0.63, the base rate (scripts/probes/crits/layer-xval.ts; the test on 489c in
  tests/buffreplay-fixtures.test.ts). 489c's final now starts at 56.73 s (the log's 55.61 s; 55.93 s before the hold
  bounds below moved its bleed ticks); the 1.1 s left is two layers from bleed ticks the replay lands off the log's: the
  47.13 s tick at 46.60 s, before the first final's end (46.60 s) clears the layers, and the 52.18 s tick not at all ("a
  landing whose order the kit doesn't give"). Not crits: the bleed's pinning (ticksShownByHits). d572's
  10.10 / 80.00 s finals (log 9.89 / 79.87 s) are one layer short from ~8 s on, with every crit logged and landed: not
  crits; not traced. The count can't see crits at the cap (a layer at 16 replaces one) or on hits the log doesn't list
  (4a64 18.78 s: six layers from a moment with four logged crits and four crit-less projectiles that don't fit crits).

**Next check:** test 111 (perfect dodges during Si's Amp, counted: whether the holds are dodges at all); a battle
skill's hit just before a stop logged at its end (a7a7 3.86 s: castStart from the event); Rossi's combo_3 dilations;
the Stagger's ticks across stops (489c).

## Laevatain's Twilight runs longer than its model (tests 17, 18, 21; 2026-11-22: her buffs' clock, not Twilight's)

**Shows (2026-11-18, replacing the 2026-11-16 brackets):** the 22 Twilight windows of
the 18 Laevatain logs, each bracketed by her last enhanced cast and her first plain cast
after it (the placed casts, `efsim zmdlogs casts`), against the replay's Twilight
(`efsim zmdlogs replay <log> --kit-buff chr_0016_laevat:twilight`), its holds counted
with the kit's duration set long so that an early end doesn't drop the later holds
(scripts in scratch/: twilight2.ts, dneed.ts, holds.ts). The base duration from the press
each closed window needs on top of the holds the engine counts (her battle skills'
pauses, her combos' 1.9 s and slow-downs, others' stops): 458b 80.3 s 17.6–19.6 s,
458b 156.3 s 18.8–19.4, f879 45.4 s 17.1–18.2, f879 97.8 s 18.9–19.6, c83c 42.5 s 20.1–21.6,
e49e 55.2 s 17.6–18.6 (its first combo, logged at 54.86 s, is before the ultimate),
0206 41.7 s 19.2–19.7 (two targets); 9c0b 2.9 s 21.5–23.0 (no hit by anyone for the
first 10 s: left out). The engine since 2026-11-18: 17.03 s (15 s after her own stop,
engine assumption `buff-in-stop`).

**Ruled out:**
- Twilight running through her own stop (15 s from the press, the kit's default until
  2026-11-18): every closed window needs at least 17.1 s.
- Her ultimate placed at its cast event (the stop's end) instead of its press: fixed
  (castassembly.ts `loggedCastStart`, another's hit within 0.5 s after the event); in 6
  windows that had moved the window 2 s later.
- The battle skill's pause at its full 115 frames (no jump skips): f879 45.4 s, 458b
  156.3 s, 0206 and e49e would end after the first plain cast (and test 17's timings
  say the jumps skip).
- A constant on top of 17.03 s, or show_weapon's 16 s as Twilight's length: f879 45.4 s
  allows at most +1.2 s, f879 97.8 s and 0206 need at least +1.8 s, c83c +3.1 s.

**Diagnosed (2026-11-22): the excess isn't Twilight's.** Her weapon's 20 s buff,
Forgeborn Scathe's `buff_wpn_sword_0006_valid` (listed on her hits; created by the same
ultimate, at its stop's end, with none of Twilight's own pauses: no combo channel, no
battle-skill pause), runs past the replay by about as much in the same windows. Each
window's bracket, as the residual over the replay's end with every hold the replay
counts (holds taken from a run with the buff's duration set long; instances' starts, not
the placed casts, so the numbers differ a little from those above; Forgeborn's end
bracketed by its last listed hit and the next hit of hers that doesn't list it, `efsim
zmdlogs lanes <log> --buff sword_0006`; scripts scratch/twl/both.ts, fit.ts, fg.ts):

| window (press) | Twilight's residual | Forgeborn's | Twilight − Forgeborn | her combos, battle skills, others' ultimates |
|---|---|---|---|---|
| 0206 41.7 s | 2.19–2.71 | 0.16–3.31 | −1.12–2.55 | 2, 2, 4 |
| 458b 80.3 s | 0.55–2.54 | 1.09–2.11 | −1.56–1.45 | 2, 1, 1 |
| 458b 156.3 s | 1.77–2.41 | 0.89–1.34 | 0.43–1.52 | 2, 2, 1 |
| c83c 42.5 s | 3.08–4.59 | 1.66–2.80 | 0.28–2.93 | 1, 0, 3 |
| e49e 55.2 s | 0.94–2.01 (its combo pressed before the ultimate, 2.3 s, taken out) | 0.58–1.73 | −0.79–1.43 | 2, 2, 3 |
| f879 45.4 s | 0.05–1.15 | 1.27–2.27 | −2.22–−0.12 | 2, 1, 2 |
| f879 97.8 s | 1.84–2.54 | 1.73–3.07 | −1.23–0.81 | 1, 1, 1 |
| 3440 43.4 s (bracket 4.7 s wide) | 1.32–3.74 | 3.12–5.01 | −3.69–0.62 | 1, 1, 1 |
| 9c0b 2.9 s (no hit for its first 10 s) | 4.45–5.97 | 6.06–7.77 | −3.32–−0.09 | 1, 1, 3 |

Twilight's residual spreads over 0.05–4.6 s; with Forgeborn's taken off, what is left
contains 0 in five of the nine windows and misses it by 0.09–0.43 s in four, both ways
(458b 156.3 and c83c a little long, f879 45.4 and 9c0b a little short), about the
brackets' placement error (±0.3 s). So Twilight's own model (15 s after her stop, her
combos' 1.9 s channel plus slow-down, her battle skill's pause with the jumps skipping)
holds; what runs long is the clock of her buffs in these windows (all of them: Scorching
Heart's natural ends outside Twilight run 0.2–1.5 s past the replay in 8 of 9 lanes,
`efsim zmdlogs raw <log> --buffs ignore_fire_resist`). No change to the kit: a longer
Twilight would put a world-clock effect into one kit. Kit assumption
`laevatain-twilight-clock` (reading `forgeborn`: +1.8 s, the median of Forgeborn's) is
the switch for how much rides on it (Ink Melt: +3.80% ± 1.30 sustained DPS, 32 paired seeds).
Measured as a kit change (Twilight 17 s on every Laevatain log): no verdict moves, the
development and hold-out rows unchanged (the replay takes her enhanced casts from the log).

**Ruled out (2026-11-22), each against the nine brackets:**
- A constant on top of the model: c83c needs ≥3.08, f879 45.4 ≤1.15 (and Twilight 16 s,
  show_weapon's, is +1: misses 0206, 458b 156.3, c83c, f879 97.8, 9c0b).
- Per combo, per battle skill, per other ultimate or combo, and any two of them with a
  constant (scratch/twl/fit.ts, a grid over the coefficients: no 1- or 2-feature model
  fits all eight closed windows); her combo's hold other than 1.9 s (one combo: c83c
  ≥3.08 over the model, two: f879 45.4 ≤1.15).
- Her attacker hit-stops (HitStopAction in ult_attack1–4, the battle skill, the combo:
  2.1–3.1 s per window) at any fixed fraction: 458b 156.3 allows ≤0.80 of them, c83c
  needs ≥1.45.
- A clock rate (residual ∝ window length): f879 45.4 ≤3.9%, c83c ≥10.5%.
- Others' stops longer than their UltimateTimeAction: the hit-free gaps around them
  bound it (c83c's three at most +1.6 s, it needs 3.1; f879 97.8's Camille +0.1, it
  needs 1.8).
- The Stagger (and its 2 s recovery): c83c and f879 45.4 each have one ~14 s Stagger,
  residuals 3.1+ against ≤1.2.
- P5's kill extension (potential_5: +extend_duration per kill in Twilight): c83c is the
  only P5 window and a single enemy with no kill.
- A refresh of Twilight: by a combo to 15 s (458b 156.3 would end 5 s after its
  bracket), by a Scorching Heart (re)start or Melting Flame (no data mechanism: `efsim
  gamedata who buff_chr_0016_laevat_ult_end` names only her combo, potential_5 and
  show_weapon's start; per-start fits disagree, c83c 1.54–2.30 s, 0206 1.10–1.36).
- The window starting later than the press: her own stop's hit-free gaps are 2.14–2.54
  s (2.03 modelled); c83c's press is already the latest its cast event allows.
- An enhanced step after the end (each ult_attack checks ring_start_asset at its frame
  0 for the next step's ComboCacheAction): taking the bracket's low end back one step
  still leaves c83c ≥2.39 against f879 45.4 ≤1.15.

**Still possible (the buff clock, not Twilight's):** holds the replay can't see: perfect
dodges (buff_common_dash_behit_listener: a 0.6 s world TimeDilation, the dodger exempt;
the engine has it in simulations, `--dodge`, but the log doesn't record dodges), world
pauses at a fight's start (9c0b: 10 s with no hit by anyone after her ultimate,
Forgeborn +6–7.8 s), hit-stops holding the hitter's own buffs in part. **2026-11-22,
"The buff clock" above:** every team's buffs run long the same way, on one clock per fight
shared with the enemy's ticks, its holds about a perfect dodge's 0.512 s each and never while
the enemy is Staggered; 9c0b's ten seconds a pause; hit-stops ruled out. The replay now keeps
a listed buff on to the log's end (`hidden-holds`), Forgeborn and Scorching Heart among them;
Twilight's own windows come from her logged casts and are unchanged. Liino's beats and
volleys (below) and Rossi's crit DMG window (9a80) run slow the same way; cooldowns don't
(test 18: 58 combo pairs within their cooldown), so it isn't the log's clock as a whole.
A Twilight-only remainder within ±0.5 s (the four near misses) is not excluded.

**Next check:** the buff clock over every log, not Laevatain's: each listed buff with a
natural end against the replay's (Forgeborn and Scorching Heart here), the excess per
window against the team's dodge SP (perfect dodges give SP) and against the hit-free
gaps.

## Arcane's Array Arcana on a knife edge (0206, b6aa): closed 2026-11-13

**Shows:** 0206's Arcane (Intellect 472.44, Will 473.50) had a 12.15 s
combo gap, INT's 12 s, with WILL's Susceptibility.

**Settled:** 0206 is from game 1.5 (2026-10-04, parser v57), the only
pre-1.6 log of hers; the owner copied its exact loadout in game 1.6:
Intellect 472, Will 473, WILL mode, combo cooldown 18 s. Every game-1.6
WILL gap is 16.9 s or more. The engine (1.6) is right. Possibly a 1.5
bug fixed in 1.6 (the owner). The game does
decide her mode in two places (the skill condition table's lizhiyan_wisd
for the talent's cut and the skill set; her passive buff's CompareDeckAttr
for her skills' branches), but nothing now shows them disagreeing; the
stat-panel warning added for it was removed.

**Still possible (low priority):** a whole-parts tie (b6aa: 431.44 /
431.50) splitting if one check floors; 3f78's and e989's gaps ~1 s under
18 s (no cut source in the data).

## Buffs a cast consumes ended at its planned last hit: closed 2026-11-14

**Shows:** Si's combo final lost Jade Vessel's next-combo DMG and
Yinglung's Edge when it landed after the frame planned at the cast: 0eef
(10 frames late, 179,405 against 379,860 logged), bdf2 (1 frame, ×1.456),
9a80 (her combo stretched by her ultimate: 20 mismatches).

**Settled:** a consumed buff (and Link) acts on every hit of its cast
however late it lands; it ends the frame after the cast's last own hit has
landed (casting.ts settleCastBuffs). The game's attached buff checks the
cast's ID (buff_equipsuit_attrisuitup_02: CheckSkillCastId, 20 s). bdf2's
final is now exact (287,297); 9a80 Si 20 → 14 mismatches; 0eef's final
266,134 (the rest: its unlogged crit and Liino's stance ATK, "Liino's
stance ATK ends early"). Free simulation too: another's stop inside the
caster's own combo slow-down holds its hits more than the world.

**Still possible:** the game's `finishWithNextSkillIfNotInherited` ending
such a buff at the caster's next skill: 9a80's combo hits keep it across
her ultimate (cast during the combo), so not for every next skill.

## Buffs through stops: the log lists them longer than the damage says (Si's Amp, Ardelia's; 2026-11-14)

**Shows (two sonnet diagnoses):** the log lists Si's ultimate Amp 0.5–2.5 s
past the engine's end: db87 to 48.7–49.0 s (engine 45.7–46.6), 458b
(ult 76514) to (96.7, 97.4] s (engine (95.6, 96.3]), 458b (ult 152238)
(173.4, 174.1] (engine (173.2, 173.4]), 489c (ult 87091) past 108.6 s
(engine (107.3, 108.0]). Ardelia in af7b: her weapon's Arts DMG Taken
listed to 63.5 s (engine 56.9), her Susceptibility to 72.1 s (engine
~69.9); 791: her funnel_0016 ATK listed to 62.9 s (engine 59.4).

**Found (opus):** where the damage decides, it fits the engine's end, not
the listing: db87 Arcane's 7 hits 47.3–48.8 s and Camille's 3 hits
46.6–48.7 s fit without the Amp the log lists; 458b Wulfgard's 11 listed
hits fit the engine 3, the log 0; 489c (ult 24447) Rossi's 15 hits
42.6–58.7 s, where the engine has it and the log doesn't, fit the engine
6, the log 0; af7b's Susceptibility 70.5–72.1 s fits the engine 12–15,
the log 0–2. The hold itself is right in db87: the Amp's hits put its end
between 45.7 and 46.6 s (Camille's ultimate hits at 44.7–45.6 s with it,
at 46.6 s without; unheld it would end at 41.5 s), and the engine's 151
frames of stops put it at 46.5 s. So team buffs are held by others'
stops as the engine has it (B11), measured by damage in one log.

**Ruled out:** a longer hold for team buffs (the damage); per-operator
clocks for Si's Amp (the "Amp on Laevatain to 53.7 s" were her Combustion
ticks, which keep the attacker side from their application; Si's and
Laevatain's listings end at the same 49027 ms boundary);
`useTimeDilationDt` as what tells buffs apart (false in 1436 of 1450
BuffData files, Si's atk_buff_2 and funnel_0016's ATK alike); and in db87
not even every slow-down holding for its whole length reaches the listing
(47.2 s against 48.7).

**Still possible:** af7b's Arts DMG Taken at 59.6–63.4 s fits the log
(Liino 19 of 21 hits, Typhoeus 11 of 13), but the replay lacks Liino's
logged ultimates at 59.9 and 64.5 s and makes Ardelia's ultimate four
times (57.6–60.2 s), so its stops aren't the game's: recheck after the
cast placement is fixed (logcasts.ts). 791's ATK at 59.2–62.7 s fits
neither (0 / 0 / 10), and every Susceptibility she applies refreshes it
(funnel_0016 int_susceptibility), so its listed end may be a refresh.
Whether a combo slow-down holds buffs by its lost frames (engine) or its
whole length: under a second each, no log separates it. Why the log lists
a buff 0.5–2.5 s after it stopped acting: unknown (a ZMDLogs lag?). Over every
log (2026-11-22, "The buff clock") the damage sides with the listing past the replay's expiry (802
hits against 92): db87's are the exception, not the rule. The
enemy clock: db87's Combustion ticks are 1024–1025 ms apart with nothing
between, and 90–180 ms further apart than the modelled holds across each
stop (a clock ~2.5% slow against the log's, or holds a little longer).

**Next check:** in-game test 107 (Si's Amp across three ultimates); af7b
after the placement fix.

## Liino's volley doubles in 1d91: closed 2026-11-18

**Shows:** 442 at 1990 ms, 886 (2.007×) at 13713 ms, later 985, 1152.
**Cause: the team's buffs, not the volley.** Once the replay lands the
volleys (the next entry), 1d91's 886s match the engine plainly: from its
second volley on the volley carries Ardelia's Arts Susceptibility (0.28)
and Tidal Murmurs' Arts DMG Taken (0.16), Arcane's WILL Susceptibility
(0.096) and the usp02 set's DMG (0.16), ×1.28 × 1.352 × 1.16 = 2.007 the
first's (`efsim zmdlogs hits --json` on 1d91, t=13713: plain, predicted
886). 1d91 lists none of Liino's buffs and no teammate's on her, which is
why the log looked unbuffed. 4360 (419 → 785) and 9090 (388 → 567) are
the same: the first volley comes before the teammates' debuffs.
**Left:** the first volley (1990 ms) landed nowhere: her stance was cast
before the log began (fixed 2026-11-22: next entry, "stances cast before
the log"). The volley at 51.0 s is ×1.11 the engine's (985 against 886), 62.2
and 64.0 s (1152 = 886 × 1.3) are under the log's Stagger, split in two
by a stop.

## Liino's volleys: a 10 s timer, reaction or not (in-game test 26 from the data and the logs, 2026-11-18)

**Shows:** 9090 logged 10 volleys, the replay 1 (the kit's reading B of
test 26: an Arts Reaction while her listener is up, then 10 s of
cooldown); no reaction hit is logged in the 2 s before the one at 15.2 s,
and its first comes 1.9 s after her cast, before any reaction.
**Cause (the data):** buff spelllnfliction_extraattack (the battle skill's
frame 45) ticks every hit_tigger = atk_trigger (10 s), the first at once
(waitFirstTriggerInterval false), and each tick launches the volley at a
marked enemy within 20 m; the tick's first condition, CheckBuffIdInContext
spelllnfliction_hit (the 2 s mark an Arts Reaction leaves), has
`isEnable false`. `efsim gamedata tree` left disabled actions out as
defaults, so the condition read as live; it now prints `DISABLED`.
**The logs agree:** 103 volleys in 24 Liino logs, 10.0–11.7 s of world
time apart (time stops taken out; `scratch` count over all Liino logs,
logcasts `worldMs`), also with no stop between (1d91 11.29, 4bfe 10.70,
8915 11.67, a7a7 10.02, c6d8 10.70 s); a stance's first comes 1.6–2.4 s
after its first projectile (the kit: 1.9 s), with no reaction needed.
**Fixed:** the kit's volley_window ticks every atk_trigger from frame 45
and fires the volley (kit-liino test). The game's clock for it runs
slower than the replay's world time (mean gap ~10.5 s; her beats drift the
same way, "Liino's battle-skill presses" above), so the replay takes each
tick from its logged volley (`KitBuff.ticksShownByHits`, buffreplay
`loggedTickLandings`): held to one up to 5 s later, brought forward to one
up to 5 s sooner. 9090: Liino's volleys 60 logged, 58 replayed (the first
volley's last two lie after Arcane's combo stop at 2.5 s), her totals
−10.4 → +2.5%.
**Ruled out:** the volley waiting for a beat (but for the 37 at 0 ms,
below, the volleys' offsets from the last logged beat spread evenly over
0.1–3 s); a cooldown from a reaction (9090's first volley comes before any
reaction, and its 15.2 s one has none in the 2 s before).
**Decided (2026-11-22): the events at a volley's first hit are beats.**
30 of 104 volleys have a Liino battle-skill event at their first hit's ms;
every one comes 2.5–6 s after her previous event (3.0–3.5 s most), and her
next event 3 s or more after it, where the volleys without one come 0–2.9 s
after her last event (`scratch` count over every Liino log): a beat due then
is logged at the volley. 10 of 25 of them in logs listing her weapon's heal
ATK have a heal at the event's ms, as 174 of 258 plain beat events do.
Read as no beat (1d91: plain 328 → 331, no other log moved; after the
stances before the log, below) they'd lose those heals; kept as beats.
**Fixed (2026-11-22): stances cast before the log.** 1d91, 7910, 4d60 (and
a7a7, af7b) begin inside a Vocalist Stance: 4d60 lists its ATK since
-811 ms, 7910 since -576 ms, a7a7 -1776, af7b -1444; 1d91 lists none, its
first volley at 1990 ms with the volley's own event. The replay made a
stance at the first event instead, so its first volley landed nowhere and
the stance's projectiles and volley came as its own. Now (buffreplay.ts
`castsBeforeLog`, `withCastBeforeLog`) a stance whose buff's listing starts
before the log, or whose first shown volley no cast could have opened, was
cast before it: its timer and beats run from there, its hits and the
volley launched before the log (the fight hadn't begun) aren't replayed.
Development plain 52.0 → 56.1% with the beats' fixes (scoreboard; 4d60
386 → 677, af7b 105 → 414, 1d91 280 → 328). Liino's damage error: 1d91
+14.8 → +11.6% (the rest: its last Cosmovoice's beats, never logged), 7910
−7.9 → −7.1%, 4d60 −6.4 → +8.5% (two replay-only beats and a finale after
her last logged hit at 170.9 s), a7a7 +7.5 → +0.2%; af7b's teammates (her
stance ATK from the start): Typhoeus −7.8 → −4.6%, Ardelia −6.0 → −2.0%,
Arcane −7.2 → −4.5%, its Liino −5.8 → +10.5% (her volleys now land; two
replay-only ones at 47.1 and 57.7 s where the log has none: her ultimate,
whose Cosmovoice the log lists from 56.50 s, is placed at 57.4 s from its
projectiles, which flew 3.4 s; the 47 s one is due on the kit's 10 s where
her logged volleys came 11.7 and 11.5 s apart, its tick then inside her
combo at 47.97 s, which drops a volley still to launch).
**Still possible:** the game's slower clock: hit-stop or a time scale on
Liino herself (useTimeDilationDt false on the buff), or stops longer than
the engine's; the data's listener end at frame 1691 (54.9 s; the kit ends
it with the stance at 60 s, which no tick falls between).
**Next check:** none for the volley. Rossi's bleed ticks take the same
pinning since 2026-11-22 ("Rossi: her bleed" above).

## Liino's Cosmovoice beats: logged at other moments than the replay's (2026-11-18; 2026-11-22)

**Shows:** of her ultimate's 572 checked hits (in-game test 6, decided:
the values hold, 332 plain, dbae 25 of 25), 21 were beats or finales the
replay landed nowhere, beside beats it landed where the log has none: 4d60
82.6–99.9 s (logged 1.35–1.38 s apart, the replay 1.5 s), 7910 59.0–62.1 s,
9090 (finale logged 79.82 s, the replay's 79.03 s), 8915, 9847 one each.
**Cause (2026-11-22): the beats run on a clock of their own, the finale on
the ultimate's timeline.** The data: buff ultskill_music_damage (frame 77,
vfx_music_duration = ultmusic_duration 15 s, triggerInterval
music_damage_trigger = ultmusic_trigger 1.5 s, first tick at once) launches
a soundwave projectile each tick; the finale (soundwave_02) is launched at
the ultimate's frame 508. The logs: without a time stop between, 4d60's
beats are a steady 1.36 s apart in both its Cosmovoices (`zmdlogs cadence
--operator liino --event ultimate_skill_soundwave`), 4bfc's 1.36–1.59,
7910's 1.38–1.55, c6d8's 1.52, while in the same logs the ultimate's
projectiles (fixed frames) keep the kit's to ±15 ms and Zhuang Fangyi's
Empyrean strikes (6 frames) are 189–230 ms apart (4d60 a mean 195, c6d8
234). The song's clock isn't the log's (4d60's 10 beats took 13.0 s of world
time, the kit 13.5) and differs per log; its volleys' timer runs off it the
same way (4d60 9.0–9.4 s, others 10.3–11.7 s). The finale comes 14.3–14.75 s
of world time after the first beat (4d60, 4bfc, 8915; the kit 14.37 s): the
ultimate's timeline, not the song's.
**Fixed (2026-11-22):** the kit's beats are the song's ticks: kit buff
cosmovoice_song (`every` ultmusic_trigger, `noTickAtEnd`: ten beats, never
an eleventh at its 15 s end, as the logs; End Stance ends it), its first
beat the ultimate's own at frame 77 (trigger ult_song, so the placement
times the ultimate by it), the rest `ticksShownByHits`: the replay takes
each from its logged beat, and the song's end with them (one clock: 4d60's
second Cosmovoice, pinned 1.36 s apart, ran on to two replay-only beats).
The finale is the ultimate's own hit at 508, which the replay pins to its
logged landing (End Stance in Cosmovoice leaves a marker, cosmovoice_cut,
that skips it; a launch frame would have held her combo beside the
ultimate until 508). The placement gives a trigger on casts one cast per
anchor (logcasts.ts `anchorFree`: each later beat had made an `ult_song` of
its own). Simulations keep the frames (kit-liino test) but the song, a buff,
is held by every slow-down, Liino's own combo's too, where the ultimate's
frames weren't (the example liino-laevatain: its beats from 10.6 s 0.6 s
later, −0.05%); d774 agrees (beats 2.85 s apart across her combo and Zhuang
Fangyi's, 1.84 s with both stops taken out). An ultimate logged at the very end of another's
stop that covers it was pressed inside it (buffreplay.ts
`loggedCastStart`): 4d60's Zhuang Fangyi ultimate at 157421 ms, Liino's stop
ending at 157.47 s; her Empyrean attacks land from 158.38 s and Liino's
beats at 158.66 and 160.03 s, which a 2.6 s stop from the event would have
held (her strikes there now match plainly).
**Left:** the replay's own stops still differ from the game's around some
beats (4d60 91.2–95.0 s: a replay beat at 92.73 s before Perlica's ultimate
stop, placed at 92.80 s from its hit, where the log has none until 95.01 s;
9847 139.5–142.0 s); a pinned beat at the same frame as another's hit is
ordered by operator id, not the log's order (9847 60.77 s: Gilberta's
ultimate's Arts Susceptibility on the beat, ×1.5). Where the finale lands
at its logged time, the replay's Cosmovoice has already ended (9090 79.82 s,
8915 104.88 s, 4bfc 76.07 s: ×0.64–0.70 without its Amp): the replay holds
Liino's buffs and her timeline differently across the stops in between.
Beats the log never shows (1d91's last Cosmovoice from 67.5 s, its
projectiles logged; af7b's after 70.5 s; d774's two): an enemy out of reach.
**Ruled out:** the values (test 6); nine beats; the log's ms running at
another rate than the game's (the projectiles keep their frames to ±15 ms in
4d60, whose beats run 9% fast); adopting each log's shown interval for the
next unshown tick (mean |damage error| over the Liino logs 10.44 → 10.41,
plain ±1: af7b's Liino +10.5 → +2.9%, 9847's +10.2 → +15.6%; not kept).
**Still possible:** what sets the song's clock (frame pacing on the
player's device, a time scale on Liino; nothing in the data).

## Si's Artful Intent bursts that fit no reading (6 of 40)

**Shows (2026-11-14, recordedburst.ts):** the log check values each burst
as the build's ink_damage_rate × every logged hit from Si's battle-skill
hit to the record's end (docs/design/data.md, "What a log check verifies").
34 of 40 single-target bursts in non-hold-out logs fit within the per-hit
rounding (most within ±3: 489c 38772 ms 446279 vs 446281, 9555 53088 ms,
db87 45457 ms, e82d 11111 ms, c3c7 100082 ms; abfd's three at rate 0.11,
battle skill 10; 0c14's first two at 0.17, P1 with battle skill 9 — the
diagnosis's "abfd ×0.84" and "0c14 P1" misfits were the skill level).
489c 5961 ms has no battle-skill hit before it (unquantified). Misfits:

- 0c14 181424 ms ×0.288: the window from the battle-skill hit at
  108670 ms is 73 s long; Si's battle skill is cast every ~3 s from
  116 s with no logged hit. **Explained (2026-11-23):** the record ran
  from a battle skill whose hit the log lacks: 0.17 × every hit after
  155.79 s (from 158.76 s) to the burst is 90,026, the logged value; her
  press at 157.42 s, after the boss's 74% pause (open-problems "Type 50
  Yinglung's Edge", Pauses).
- 458b 85571 ms ×1.065: the log has no hit at all in the 3.2 s before the
  burst (a gap in the log?).
- 458b 131439 ms ×0.98 and a7a7 34593 ms ×0.986: a cut 1.2–1.7 s before
  the burst comes closest (458b ±12 against ±9.5 allowed); a combo cast
  (458b, 479 ms before) may stretch the projectile's 14 frames.
- 6339 19914 ms ×0.66 (logged twice): the slug (eny_0129_slwood_hdg033)
  caps hits mid-fight (11308 ms: 117149 and 98788 both "uncapped
  121248"), as if its HP came in phases; a window from ~11.1 s would fit.
- 9a80 38099 ms ×0.9998: the sum is 1115 too high (one reading), with
  rows the log lists two or three times at 35280–35767 ms.

**Ruled out:** the rate (the engine's ink_damage_rate fits 34 bursts at
P0–P5 and battle skill 9–12); a fixed end lag (fits stop 294–393 ms
before the burst in 3f78 61538 ms, 681–869 ms in 458b 23727 ms); only
Si's hits, or no status hits (every exact fit counts all of them).

**Still possible:** for 0c14, a battle-skill hit the log doesn't have
(resetting the record: SkillData normal_skill sets EntityBB_ink_damage to
0 at frame 0); for 6339, the slug's phase change resetting or splitting
the record (BuffData xianjing_inkhurteffect event 1, hp_zero, adds
kill_damage × rate); time dilation stretching the burst's delay past 1 s;
duplicate log rows.

**Next check:** 6339 and 7b54 (the same slug) with a window from each
phase change.

## 0c14: Si, and Rossi's later windows

Found (2026-11-11): Alesh's weapon at level 60 (her buff-free hits
×0.807 exactly), Rossi's food (Kunst Tube; early hits exact).

**Found (2026-11-18): Si's build is two inputs, food and nodes.** Her
hits with the log's listing in place of the replay's (scratch
recomputation on `zmdlogs hits --json`) are ×1.1543 where she has no DMG
from others and ×1.1322 under Alesh's set DMG (+0.16), whatever the ATK
buffs: a ratio that depends on her DMG bonus is an additive DMG, and only
+0.247 with ATK ×0.962 fits both. +0.2465 is Kunst Tube (all-element DMG),
the food Rossi's and the Endministrator's hits fit; ×0.962 is two
attribute nodes of four (nodes 5 and 7 need trust 300, as in 40d9).
`efsim zmdlogs fit-build`: 46 of 191 hits within ±1, all 25 clean ones
(0 as exported); the next best fits 26. Fixture `buildOverrides`; 0c14
mismatches 212 → 23, plain 77 → 123 (the fight's total +7.5 → +8.5%: Si's
hits were the low ones under Rossi's and Alesh's highs). The earlier "a
food alone" was right: it takes both.

**Found (2026-11-18): the step ×1.0965 at 13.25 s** is Alesh's P3 team
ATK (+0.15, buff_chr_0024_deepfin_potential_3, listed since 13254),
which only her combo's Rare Fin slam gives; with her weapon's team ATK
listed since 12707 (Thermite Cutter on natural SP, which her combo's hook
grants) it says Alesh cast a combo at ~12.5 s whose hits the log hasn't
(her combo window opened by the Endministrator's Crystals shattered at
11.2 s). The replay makes no cast there (no logged hit or cast event), so
it lacks the team ATK until Alesh's ultimate (18.4 s) and the P3 ATK until
her next combo (60.6 s): Si's combo hits from 13.25 s and Si's ultimate's
carry them (log-listing fallbacks now).

**Ruled out:** a food alone for Si (residual 0.91–1.15 with the best);
a weapon level or nodes for Rossi (they only lower ATK; she is predicted
low); for Si either alone (two inputs, above).

**Still possible:** Rossi at 22–40, 62–82, 150–195 s: Wolven Blood layer
and max-stack timing (the log lists two entries per layer), Si's ultimate
window, the Endministrator's ATK buff and Razor Clawmark timing (the
engine has Razor Clawmark's 0.12 at 52–60 s, the log doesn't). Si: her
combos' Yinglung's Edge count (82.2 s one layer fewer: fixed 2026-11-22,
a Final Stroke the replay inferred from the mark's own burst; 122.5 s one
more: her press 7.7 s after her battle skill; 167.1 s one more and Jade
Vessel's next-combo bonus the engine hasn't, open: "Type 50 Yinglung's
Edge"). Alesh: ×1.146 at 26 s (the log lists her ATK buff twice, the
engine once), ×1.38–1.44 at 59–60 s, her ultimates ×1.34 and ×1.90.
For the replay: a cast inferred from a buff only it gives (a logged
effect whose `since` no replayed cast explains, like
castsFromBuffEnds for ends): built 2026-11-26 for a press with its own
cast event (`hitless-presses` `inferred`: Si's 153.99 s here); Alesh's
combo has no event, so it stays open (a press made from a listing
alone could invent casts the log doesn't support).

**Found (2026-11-23, fight totals):** the +26.1% was the Endministrator's crystal shatters at Rossi's Lifts placed
as seven ultimates the log doesn't have (19.5% of the fight) and Si's bursts in her two phases ("Fight totals" above):
now −3.4%.

**Found (2026-11-26, damage factors):** the Endministrator's Crush ×2.2 at 182.30 s and Si's log-only inkmove_2 at
181.42 s are one cause, Si's battle-skill presses at 139.68 s (in the away stretch) and 153.99 s ("The damage factors"
under "Misprediction statistics"; built in general 2026-11-26: plain 172 → 293, the total −3.4 → +2.7%).

**Found (2026-11-26, combo hold and replay):** Rossi's 58 replay-only landings (0.30M, the +2.7% total) were
mostly her 35.40 s battle skill's tail (Lift, wolves, 16 bleed ticks, the Endministrator's combo shatter it sets
off) and, from its missing Vulnerable stack, her 52.04 s battle skill's follow-up: engine assumption `unlogged-tails`
`cut` ("The damage factors" under "Misprediction statistics"); plain 293 → 336, replay-only 58 → 14, the total
+2.7 → −3.2% (her matched landings ×0.943, Si's ×0.964). Alesh's eventless 12.5 s combo and the remaining
under-prediction: next.

**Found (2026-11-26, 0c14 and the operator curve): of Rossi's −186k matched, about 87k was the totals' expected
crits, 18k her attack 4 on the wrong path; the rest is Alesh's unlogged combo and one Stagger.**
(scripts/probes/totals/parts.ts, by window and crit kind):
- **Expected crits** (−108k at 25.2–27.7 s, −23k at 160–176 s): her ultimate's stabs log no crit; a crit-unknown hit
  whose value neither reading gives exactly was counted at expected crits, so one fight's crit luck went into the
  total (her first ultimate's two finals, 326,856 and 108,952, both crits, at ×0.766). Her readings there are ×1.032
  below the log on every stab, crit and non-crit alike, so the values say which crit: 17 of its 28 crit-unknown
  landings by their values against 18.5 expected. Engine assumption `totals-crits` `read` (the new default;
  enginecheck.ts critFromValue): the reading the value is within ×1.08 of, the other not. 0c14 −3.2 → −1.3% with the
  rest.
- **Her attack 4 as a teammate** (−18k at 154.1 and 174.3–174.9 s, ×0.40): her kit jumps 0 → 189 to the not-controlled
  path (hit_ai, × 0.5 a hit against the controlled path's × 0.2) when she isn't controlled, and the log shows Si, then
  the Endministrator controlled there; the placement had matched the logged hits to the controlled path's frames
  (the same after the jump) and the replay dropped the jump the pinned landings contradicted. Built in general:
  paths.ts pathLandings (a jump on whether its operator is controlled follows who the log shows
  controlled; the landings go to its path's hit of the same keys). 2fd9 plain 250 → 275 and 99fb 161 → 173 (Rossi
  under Mi Fu), 0c14 +2.
- **Alesh's 12.5 s combo** (×1.032 on everyone's hits at 20.7–43.3 s, Rossi's first ultimate and Si's 30 s combo among
  them; Si ×0.917 at 13.3–20 s): the log lists two layers of her Thermite Cutter team ATK (+0.06 each; since 12.71 and
  20.72 s) where the replay has one (from her ultimate's SP), and her P3 team ATK from 13.25 s. Both come from her
  combo's Rare Fin path (P3 only after slam_ex; the two `since`s 0.55 s apart, hook_ex 77 to slam_ex 93 = 16 frames),
  pressed with Si's combo (12.52 s) and no hit of it logged. **Built (2026-11-26, Alesh's Rare Fin round):** a cast
  made from the listing alone, engine assumption `listed-casts` `inferred` (castassembly.ts castsFromHitBuffs): a
  game buff exactly one kit hit of the team gives (no trigger, no other hit), its run's `since` where no cast of that
  skill could have landed it, gets a cast timed so the hit lands there, its path's chance jump taken, the path's
  earlier hits pinned at their kit frames before it (hook_ex 16 frames before slam_ex: the replay's Thermite layer at
  12.73 s against the log's 12.71 s, inside Si's stop, which would otherwise have held them to 13.3–13.8 s), its
  landings counted for nothing. Made at 12.00 s; `zmdlogs decisions --all --assume listed-casts=none`: the only
  such cast in 61 development logs. Its own effect (measure `--variant listed-casts=none`): 0c14 plain 404 → 493,
  mismatch 17 → 12, total −1.6 → −0.3% (Rossi's first ultimate final now reads exactly: tests/listed-paths.test.ts).
- **The Stagger at 80.48 s** (−30k): Rossi's combo_2 hit and its Lift's airborne hit read ×1.3 (the Stagger) though
  they are the hits that break the bar (3 → 0); the replay's window starts the frame after. "The replay's Stagger
  windows" below: the breaking hit at its ms.
Left after these (with totals-crits `read`): Rossi −1.0% (matched −2.5%), Si −1.5% (shifts included), the team −1.3%.
**Still possible** for the rest: the 80.48 s Stagger (the Alesh combo and her 59.56 s path are built, below).
**Alesh's Rare Fin path from the values (2026-11-26):** her combo's two paths share keys and the placement takes the
normal one's hits (hook 22, slam 38) for every cast; the casts whose values are ×1.5–1.6 that reading are the Rare
Fin path (hook_ex 77, slam_ex 93, after the trigger's chance jump 10 → 65): 0c14 59.56 s (assumed), 4e36 19.87 and
32.32 s (4 mismatches), a9d7 11.68, 39.37, 60.72 s (assumed, fallback).
**Built from the listing, not the values (2026-11-26, Alesh's Rare Fin round):** her P3 team ATK, which only the
Rare Fin slam gives, is listed from exactly that slam's logged ms in every case (0c14 60129, 4e36 20332 and 32919,
a9d7 12520, 39815, 61516; the 12.0 s cast's 13254), so the listing decides the path, a frame's tolerance
(castassembly.ts listedPaths → ReplayedCast.chanceJumps → drivers.ts replayCast `chanceJumps`: the trigger isn't
rolled, a taken jump is scheduled at its frame, the logged landings go to the path's hits of the same keys at the same
frames from the cast's start, chancePathLandings). Not taken where the log lists P3 somewhere but none of its hits in
3 s after the slam does; a run already going is decided by its end (a refresh keeps the `since`: 4e36's 42.96 s slam,
the run since 32.92 s ending at 47.3–47.6 s, not refreshed); a slam the log hasn't is placed from the cast's logged
hook (a9d7 98.88 s). 17 decisions in 3 logs (`zmdlogs decisions --all --operator Alesh`: PATH lines), none against
the values; the rolled Rare Fin landings the log hasn't gone (0c14 122.83 and 199.57 s, a9d7 12–184 s: Alesh's
replay-only 56k → 16k there, her matched −5.6 → −0.7%). P3 itself stays the log's (replaycrits.ts chancePathBuff):
judged by the replay where every cast's path was decided, one hold-out log lost 47 plain and nothing in
development gained (tried: docs/tried/2026-11-26-chance-path-buffs-decided.diff). Measured against ade98a1 (both
rules): 0c14 plain 338 → 493, total −1.3 → −0.3%; 4e36 281 → 368, +2.2 → +0.9%; a9d7 99 → 101, −2.2 → −2.6% (its
replay-only Rare Fin landings gone; its Estella and Chen under-predicted, −5 and −4% matched); hold-out plain
80.8 → 81.0% (1 better, 1 mixed: +4 plain, its total further). **Still possible:** a path the listing can't decide
(an Alesh below P3, a log that doesn't list her buffs: ad7f, P3 never listed, still rolled) by the hits' values.

**Next check:** Rossi's Wolven Blood layers against the log's listing,
window by window (2026-11-22: the max-stack bonus's length is the open
part, "Rossi: her bleed" above).

## 3f78 and 4a64: −36.5% after food

**Shows:** most hits carry buff_common_natural_cryst_triggered; the check
routes them to Corrosion and finds "no level that fits".

**Found (round 4, a sonnet pass correcting round 3's):** the buff *is*
the engine's Corrosion (Nature onto Cryst): its modifiers are on
attributes 94–98, resistance points for Physical, Nature, Cryst, Pulse
and Fire (`def_decrease` is only the blackboard key; its values come from
the wrapper's ReadSkillSettingData "腐蚀每跳减抗"). With the right level
the engine's curve fits exactly: 4a64's first Corrosion (4517 ms, level
1) gives 1.000 ± 1 on Si's, Arcane's and Gilberta's hits at every shred
step from 7.8 to 23.2. The misfits are the replay's level: 4a64's second
Corrosion (52982 ms) is level 1 in the reaction check, level 2 in the
check's replay (hits ×0.95–0.97; at level 1 they fit); 3f78's second
(46994 ms) the other way round.

**Found (2026-11-11, the level fix):** the replay's enemy held other Cryst
stacks than the game's. 4a64 at 52982 ms: level 2 in the replay from a
Cryst stack of Xaihi's battle skill cast at 33.3 s, whose hit the log
never shows; level 1 by the logged reaction hit (16537) and the reaction
check. 3f78 at 46994 ms: level 1 in the replay (at 45458 ms Arcane's
ultimate lands before Xaihi's Cryst, so its "enemy's element"
infliction adds nothing); level 2 in the reaction check (the hit fits 2,
or 1 with a set buff the replay isn't sure of). The replay now takes the
level the log shows (docs/design/data.md, "The log check's rule"): 4a64 plain
68 → 114, unquantified 193 → 131, mismatches 3 → 1; 3f78 plain 30 → 32,
assumed 6 → 25, unquantified 208 → 179, mismatches 8 → 5. Totals: 4a64
−36.5 → −38.7%, 3f78 −36.5 → −35.0% (less shred in 4a64; the
under-prediction is elsewhere).

**Ruled out:** a DEF decrease (round 3's reading: attributes 94–98 aren't
DEF, and a full −15% gives at most ×1.081); a different status from the
engine's Corrosion; the food running out (300 s); the second windows'
Corrosion levels (the log's now).

**Still possible:**
- The replay's inflictions themselves (casts whose hits the log doesn't
  show, same-frame order across operators) still differ from the game's;
  only the reaction levels are taken from the log.
- 3f78's second window, ×1.079 (54–61.6 s): found (round 5): one Will
  ATK instance (funnel_0016 will_atk, made by Arcane's bursts, ~24 s)
  the replay lacks on all 101 hits: its only Arcane burst is at ~20.7 s;
  the log's second, buff_common_cryst_cryst_triggered at 47230 ms
  (credited to her), isn't replayed; its source perhaps her touch's
  element (entry above). The ×1.158 hits: an extra 0.192 that isn't Will
  (candidates: log-only entries in Rossi's window, wpn_sword_0022.final
  0.384, wpn_funnel_0005.atk_up 0.224, suit_usp02.team_dmg 0.16).
  Elsewhere the Will buffs' counts agree (0eef, bdf2, dbae, 4a64, e82d;
  b7b3 has 63 hits with a will_atk the log doesn't list; d9e5 12 the
  other way).
- The first windows (4a64 6.3–18.8 s, 3f78 3–15 s) are still "no level
  fits" in the check (nearest ×1.012–1.014, ×0.987 at 15–17 s in 4a64),
  though their level (1) is the replay's and the round-4 hand fit is
  1.000: the check's reading differs from that fit somewhere.
- ×1.5 on hits at a reaction's own millisecond: found and fixed (round
  5): Hot Work's Nature DMG on the hit that forms the Corrosion. 4a64 at
  52982 ms is ×1.39, not 1.5: open.
- Rossi's combo_2 ×0.94 in 3f78's second window.
- Si's ultimate and Fixed DMG, Rossi's and Si's ultimate hits (×1.4 to
  ×36): not Corrosion. Si's Inksoul burst (Fixed DMG from the fight's hit
  sum) isn't computable; Rossi's Seething Blood extras after null-crit
  stabs need the stab's crit.

**Found (2026-11-23):** the totals are no longer −36.5%: 3f78 −6.1%,
4a64 +7.6% (the scoreboard's snapshots; the earlier rounds' fixes). **The
first windows' ×1.012–1.014 is Corrosion's ramp one step ahead in the
log**, not a level or a Will buff: read as a resistance step (level 1 at
Arcane's Arts Intensity: 1.48 points, ×1.0138), every such hit is exactly
one step past the replay's, every other hit between is plain at the
replay's step (scripts/probes/corrosion/corrosion-lag.ts). The
replay holds the ramp too long across the opener: Corrosion at 1.33 s
(3f78) and 4.52 s (4a64), then Gilberta's combo slow-down and Si's and
Arcane's, both pressed inside Gilberta's (their cast events at its end:
2.23 s, 5.41 s); the replay holds 0.93 s (3f78) and 0.91 s (4a64) at the
lowest scale, the log's steps allow at most 0.73 s and 0.75 s (lag
−0.2…−0.9 s and −0.17…−0.3 s through the window). The other direction
from the hidden holds elsewhere (db87 above). Ruled out for these windows:
the Corrosion level (the hits between steps fit it exactly), a team buff
(Gilberta's, Si's, Arcane's and Rossi's hits move alike, by one shred
step), food.

**Still possible (the first windows):** Si's and Arcane's combos starting
earlier inside Gilberta's stop than their hits place them (a combo pressed
during another's slow-down: the placement doesn't hold a combo by
another's, castStart), so their slow-downs overlap more; a combo's
slow-down not holding the world while another's runs (the lowest-scale rule
is per frame); the slow-down curves' ramps. Rossi's ultimate stabs at
58.8–59.3 s ×2.7 and their Seething Blood extras ×2.1 in 3f78 are Rossi's
crit reading ("Rossi: her bleed…"), not food.

**Found and fixed (2026-11-23, ramp slow-downs round):** Arcane's combo
resets the combo slow-down at its frame 9 (a RESETto1 dilation in the
combo priority: "The buff clock", What over-holds it): the opener holds
0.72 s (3f78) and 0.74 s (4a64), inside what the steps allow. 3f78 plain
53 → 63 (mismatch 5 → 2), 4a64 150 → 156 (2 → 0). Left in these windows:
Rossi's combo_2 and combo_3 (3f78 5.77–8.43 s, 4a64 8.93 s) still hold
about 0.15–0.2 s more than the steps allow.

**Rossi's combo_3's two dilations (2026-11-23, remaining leads): not the
0.15–0.2 s.** One replacing the other changes the hold by 1.5–2.2 frames, not
7: the 19-frame combo-priority one ramps up from its frame 8 (held time: both
at the lowest scale 14.1 frames, the 12-frame one alone 11.9, the combo one
alone 12.5). ramp-pairs (150 ms a side, inside stops dropped): 3f78's excess
167 ms → 114 (the 12-frame alone) or 135 ms (the combo one alone); 4a64 isn't
infeasible there. Only Rossi's combo_3 has two world dilations at one frame
(`efsim gamedata dilations`), so the data can't order the priorities; with one
slot per priority and the higher one counting, only "the combo priority
outranks −361293424" differs from now (the combo one alone), measured on the
Rossi logs: 3f78 damage −5.0 → −5.2%, 489c plain 579 → 571, hold-outs 1
better. Not built. **Next check:** the rest of 3f78's 0.1–0.17 s (Rossi's
combo_2 at 5.77 s pressed inside another's slow-down?); then the Will buffs'
instances in 3f78's second window.

## The slow-down rule's reach (2026-11-11)

**Shows:** "an operator in its own ultimate's stop isn't held by another's
slow-down" fixed 9a80's crit buff and raised plain matches (hold-out +4),
but some totals rose (hold-out mean |damage error| 19.7 → 20.3% at the
time, before the crit fix).

**Evidence so far (round 3):** in 1cd1 and 0c14 every overlap starts
inside the stop (Liino's 77-frame stop with Arcane's and Typhoeus's
slow-downs; the Endministrator's 44-frame stops with Rossi's). 0c14 at
80.5 s: Rossi's airborne (log 34792: old rule 24079, new 31303) and
combo_2 (log 113417: old 78495, new 102043) move toward the log; the
Endministrator's frozen buff (log 26783: old 32873, new 42734) moves
away. 1cd1: Liino's ultimate projectiles fit neither (log 1391: old 1128,
new 1696; her stance buffs may be the cause).

**Ruled out:** the old rule as the only fit (Rossi's 80.5 s hits favour
the new one); "only the ultimate's own action and hits" alone (it reverts
those hits and worsens the ultimate-kind total, −2.0 → −15.6%), though
not excluded as part of the answer.

**Still possible:** (a) every scheduled item of the operator (as now);
(b) only its ultimate's own action and hits (the Endministrator's total
fits it: +24% against +44%); (c) only slow-downs that start inside the
stop: no log separates it from (a) yet; a mix (the Endministrator's
frozen buff on another clock than her hits).

**Next check:** a log where a slow-down starts before an ultimate's stop
and runs into it; the Endministrator's frozen buff's clock in her kit.

## Laevatain's battle-skill multipliers: data and logs against Zero Sanity

**Shows (kit review 2026-11-12, Laevatain F3, F4):** the kit follows Zero
Sanity's in-game table (game ~1.1): the empowered extra hit × extra_scaling,
Twilight's enhanced battle-skill hits 1 and 2 × ratio. The data (1.6) has
× ratio on the extra hit and none on hits 1 and 2; with the data's reading
e989 (P5, game 1.6) goes from 6 mismatches to 0, its extra hit logged at
0.8 of the kit's (1.2 / 1.5).

**Ruled out:** nothing yet.

**Still possible:** a game change since 1.1 (the data and logs are 1.6);
a log or import effect in e989; a P1–P2 difference (db87, P1, still ×1.30
on the Twilight hits with either reading).

**Next check:** in-game test 20; the owner's decision on whether game-1.6
logs outrank Zero Sanity's older in-game values.

## Fight-wide factors in older imports (kit review)

- Da Pan's only log (multi-target 10df): ×1.25 on half his hits and on
  Pogranichnik's in the same fight.
- 04d4: Catcher's weapon at level 3 (fitted 2026-11-26, buildOverrides), Ember ×1.0226 (as
  in 146d); Ember ×1.0444 in Hard 27's pair, none in 7e19.
- c3c7: Xaihi's hits all ×0.337.

**Still possible:** build inputs the export doesn't give (weapon levels,
nodes, food), stage effects. **Next check:** none planned (not screened
logs).

## Team SP: the replay's SP runs short (web review row 2)

**Shows:** with the engine's own SP, the log check's replay can't afford
casts the log made: at first in 28 of 40 logs at the 1.5 s regen pause
(most 2–12 SP short), 22 at 0.5 s, 14 with no pause (1d91 at 4833 ms: 46
SP before a 100 cast). replayCast raises SP silently, so verdicts don't
show it. Since 2026-11-12 the engine pauses 0.5 s and regenerates through
others' time stops and slow-downs: of the 17 development logs, 9 are still
short at some cast, 1193 SP in all (before: 13 logs, 2921 SP). Since
2026-11-13 Liino's beats cost nothing and a logged cast matches a placed
one in the world's time: of the 15 development logs, 8 short at 21 casts,
1038 SP (before: 10 logs, 39 casts, 1673 SP, 116 of it Liino's); in the
Liino logs, Liino's top-ups are gone (a7a7 153 → 0 SP, 8318 111 → 0, 4bfe
126 → 0: teammates' presses no longer starved by her recasts).

**Ruled out:** a 1.5 s pause after every spend (old rule K1). Regen held
during others' time stops and slow-downs (old rule K2: about 1400 SP of the
shortfall, 7 logs). SP for basic-attack hits on which the log shows poise
(the replay's controlled operator already matches the log's).

**Ruled out (2026-11-13, sonnet + check):** teammates' Final Strike SP as
the main gap. In the data most operators' Final Strike SP has no
controlled gate (atbOnlyMainChar false, no branch), and the engine already
grants it to teammates; only Laevatain, Ardelia, Zhuang Fangyi, Antal and
Tangtang gate it (Tangtang's attack5_projhit: the ObtainCostAction inside
an IfElse on CheckMainCharacterCondition, so the kits' `if controlled`
are right though the flag says false). Granting all of it anyway: 10 → 7
of 15 development logs short, 1808 → 1287 SP (counted at each replayed
cast).

**Ruled out (2026-11-13):** Liino's "presses" in Vocalist Stance: her
stance's beats (the owner), replayed as such, no SP.

**Ruled out as the gap (2026-11-23):** perfect dodges where the clocks place
holds. The placed holds ("The buff clock", `placed`), read as dodges (one per
0.512 s, 7 SP each at its time, credit for the casts after it, the cap
ignored: an upper bound), are 185 dodges, 1,295 SP over the 60 logs but the
hold-outs, and cover 87 of the replay's 1,766 SP short at 50 casts
in 16 logs (BuffReplay.spTopUps; scripts/probes/hidden-holds/sp.ts): the shortfall sits where
the clocks place almost nothing (04d4 650 SP with 0.7 s of holds, 6339 236
with none, db87 272 with 1.9 s, 79cc 169 with 1.9 s), and the logs with the
most holds are short of nothing (c4f3, de6a, fc63). Neither evidence for nor
against the dodge reading: dodges no clock sees are possible anywhere.

**Still possible:** perfect dodges no clock sees (7 SP each); teammates' basic attacks the replay doesn't land
(their Final Strikes' SP; the earlier probe granted SP at every logged
Final Strike); Purrchena's block refund (+20 at her counter, about 240
SP, more if repeated blocks count); teammates' Final Strikes give SP too
(alone 1497 SP at 0.5 s; with the others only db87 and 04d4 stay short);
other hitless presses free (Si, Laevatain in db87: dubious); SP at the
start above 200 (0eef short at 3.2 s); a pause shorter than 0.5 s (bdf2 at
3817 ms fails any pause above ~0.2 s with the old regen); a replay
artefact (db87 at 10117 ms charges 200 SP for one press).

**Next check:** teammates' basic attacks the replay doesn't land; then
the pause (test 102).

## Solidification as a freeze (web review row 4)

**Shows:** the data's buff_common_do_frozen stops the enemy's clock
(TimeDilation 0), behind CheckSuperArmor (20, compareType 1); the engine
has no freeze for Solidification (rule A37).

**Ruled out:** a freeze on 4e36's enemy (super armor 30: Combustion ticks
on time through it).

**Still possible:** a freeze on enemies under the gate (super armor 0:
agmelee2, lbhunt); the dilation holding only animation (T10 open).

**Next check:** CheckSuperArmor's compareType direction (other buffs using
it); a log with a Solidified enemy of super armor 0. Also seen: 4f7e at
40603 ms, the engine's Solidification consumed Nature where the log's
was Heat.

## Teammates' enemy debuffs "×4" (7b54, 6339, 4e36, c3c7): 2026-11-14

**Shows (two sonnet diagnoses):** Arcane's Solemn Phalanx will_susc /
will_burst ×4 and her Doubles Susceptibility ×2 (7b54, 6339), Ardelia's
weapon and Arts Susceptibility ×4 (4e36: 143 Si hits at 0.82), Xaihi's
crystal Amp ×4 (c3c7: 86 Si hits at 1/1.18), read as instances the engine
counts where the logs show one.

**Cause found (one of them):** none of these is several instances. The
engine and the log list an elemental modifier once per element (an Arts
Susceptibility or Amp: four; Doubles: Nature and Cryo). The engine applies
one acting instance of each (stackingType 1 with a priority key and
maxStackCnt 0 keeps every instance, only the strongest acts: B6; the logs
list each instance, up to 4, and the damage fits one). The 0.82 in 4e36
(and ×0.838 / 0.850 in c3c7) was the log check, not the engine: Ardelia's
Susceptibilities are child buffs (buff_chr_0025_ardelia_affixes_vulnerable_
spell_child, _physic_child) that the log lists under the common affix
(buff_common_affixes_vulnerable_spell / _physical); the check didn't know
the name, took the log's entries for buffs no kit defines and added them
to the engine's own (1.28 / 1.56 = 0.821). Fixed: the affix of the action
that creates a child buff is one of its logged names (affixesAsChild).
4e36 Si plain 6 → 51, c3c7 Si 86 → 120, 5082 and 1cd1 likewise.

**Ruled out:** several acting instances of funnel_0016, funnel_0013,
funnel_0010, funnel_0008 (the hits listing them ×2–4 match the engine's
one exactly: B6); the engine counting a stack group's instances in the
damage (buffModifiers takes one per group).

**Still possible (separate problems):**
- 7b54 / 6339: the "Hard 33's slug" entry above (7b54 18999 ms: 722 /
  (1.312 × 1.1105) = 496, the log's value, with Jade Vessel's, both
  funnel_0016 debuffs and Doubles not acting).
- c3c7 56.7–80.1 s: the engine gives Si Xaihi's crystal Amp (0.18) that
  the log doesn't list and the damage doesn't show (×0.847, 46 hits): the
  treatment's at-Max-HP condition (HP isn't simulated) or its timing.
- af7b 60–72 s: the log lists Ardelia's Arts Susceptibility (0.28) and the
  damage fits it, 12 s past the engine's (battle skills at 10.5 and
  30.1 s, 30 s each); her ultimate (56.8 s; the event at 60.2 s is its
  repeat, 2026-11-14) creates none in the data. The old double count
  happened to match those 30 hits.
- Hits where the log lists a funnel_0016 or funnel_0008 debuff and the
  engine has none (012a 0 of 35 exact, 3f78, 489c, 9c6e, 7910, d774):
  trigger timing, not stacking.

**Next check:** af7b's Ardelia Susceptibility after 60 s (an unlogged
battle skill?), then c3c7's crystal Amp window.

## Typhoeus, Arcane, Liino, Perlica: what the team's logs leave open (2026-11-15)

From the kit check before simulating the team
([teams/typhoeus-arcane-liino-perlica.md](teams/typhoeus-arcane-liino-perlica.md)).

- **Typhoeus's hover outlasts her logged shots** (narrowed 2026-11-15:
  9090 and dbae explained; 1cd1 and fc63 are placement errors, not missed
  shots). Shows: the log lists Hovering ATK (P1) on hits where the replay's
  hover had idled out (floating_loop, then floating_end) after her last
  logged shot. Ruled out: the loop's data; an idle hover longer than the
  data (in-game test 42). Explained: shots that hit nothing (the owner:
  holding attack, she keeps shooting; ZMDLogs lists only hits). The replay
  now adds them where a logged shot needs them (buffreplay.ts
  `missedCasts`, listed in the check's report as assumed): 9090 one at
  58.7 s (no hit by anyone 57.9–60.6 s; her shot at 60.6 s is then the
  3rd, her combo at 62.6 s the hovering one, the 29 hits 63.7–68.0 s
  replay with Hovering ATK: plain 331 → 346); dbae at 3.8 and 6.6 s
  (plain 22 → 33; the second may be Liino's ultimate stop holding the
  hover instead: her ultimate's placement at 5.7 s is unsure). Also a
  replay bug, not a missed shot: 9090 at 93.9 s, shots 16 frames apart
  against the kit's 18-frame window made the replay keep the placed
  index (shot 1 again), so a logged 4th was replayed as a 5th and ended
  the hover; the step is now the one her attempt index allows.
  **Still open:**
  - Closed 2026-11-18: 1cd1 at 37.5 s, 9090's combo, dbae's battle skill
    (casts placed too late across other operators' time stops). Root: a
    cast's start was its first landing less the landing's frame, with no
    regard for the stops between, so a cast pressed before a teammate's
    ultimate started up to 3 s late (1cd1: combo pressed 34.70 s, its arrows
    at 39.04 s, placed 37.87 s, after the hover had ended). Now (logcasts.ts
    `castStart`, `heldStart`) the start is counted back in the world's time
    when the log's cast event of the skill is nearer that held start than
    the plain one, and not before the event: 1cd1 35.30 s (Typhoeus plain
    42 → 65, mismatches 27 → 4), 9090 60.63 s (after her shot at 60.60 s),
    dbae 0.85 s (its two missed shots kept: `missedCasts` looks for a first
    shot past a stop that holds it). An event of the slot's skill counts
    (the log names her battle skill normal_skill, her hovering ultimate
    ultimate_skill; this also stops `unplacedCastStops` from adding a second
    stop for her ultimate from its event). Ruled out: counting every cast
    back across every stop (development plain 47.3 → 45.9%, verified 71.0 →
    64.9%: a stop placed a little off moves a cast pressed as it ended to
    before it, dbae's Li Zhiyan combo); a combo held by others' combos (bdf2:
    Jsspsi's combo at its event 10.46 s held Corrosion's ramp 0.4 s too
    long; combos pressed together take their turns); events logged at the
    same ms as another operator's time-stopping cast's event (pressed during
    its stop, logged at its end: 5082 at 33.71 s, e82d at 3.90 s, a7a7 at
    45.59 s). Still possible: casts without a cast event (basic attacks,
    older imports) keep the plain start; ultimates' own events come at their
    stop's end, so an ultimate held by another's stop is rarely moved; two
    ultimates whose stops hold each other in the first placement (fc63's
    Aglina and Pelica at 41.6 s, no events) stay where they are.
  - fc63 at 46.8 s (4 hits): no shot is missing (39.94 s and 44.43–45.66 s
    are shots 1–4, 46.82 s the 5th). The replay has one too many: the
    burst at 43.58 s (39.94 s's, held by the stops before everyone's hits
    resume at 43.58 s) became a shot of its own, so 45.66 s was replayed
    as the 5th. Joining an orphan burst to the latest shot (tried) fixes
    the count but moves its Nature consumption to the shot's frame (the
    stops don't hold it in the replay): Typhoeus's totals there −11%, and
    in 9090 −8.5%; not kept. Also tried: a landing can't join a cast
    whose delayed landing was logged before it (fixes fc63 92–98 s, where
    bursts opened casts the next shots joined), but distinctCasts then
    merges the 4th shot (placed as floating_attack5 by its off-field key)
    with the 5th (bdf2 −11%, 00ae −7%): not kept. Root: the 5th shot's
    off-field key is the other shots' key, so the placement anchors a 4th
    shot to the 5th's cast. **Fixed 2026-11-24** (logcasts.ts): a hit that
    happens only off-field (`if: not controlled`) isn't a candidate while the
    log shows its operator controlled (`controlEvidence`: the nearest
    controlled-only Stagger hit is hers; `zmdlogs control`: Typhoeus is
    controlled throughout fc63), and with that the join rule above
    is kept (a cast with a delayed landing of a later frame logged already
    isn't joined by an earlier frame's landing). The 4th and 5th shots now
    plain (×1.538 → ×1.000) in fc63, 9090, 1d91, 00ae, af7b, bdf2; fc63's
    88–94 s shots and bursts pair up (+7.2 → +6.8%). **Exposed:** the 5th
    shot's burst, logged 0.67–0.72 s after its arrow with no stop between
    (fc63 16.00 s, bdf2 16.30 s, 9090 28.26, 120.97, 143.97 s), carries
    Hovering ATK in the log, but the replay's hover ends at the 5th shot's
    frame 15 (0.5 s): those hits plain → assumed ×1.09–1.13 (9090 −0.6 →
    −0.9%, bdf2 −0.1 → −0.7%). Ruled out: an ATK snapshot (the burst's
    BuffData buff_common_natural_natural_triggered_typhoea has
    takeAtkSnapshot false); an attacker-side snapshot at the arrow (2026-11-23,
    scratch/shot5.ts: bdf2's combo tick at the burst's ms, +706 ms, lists
    Hovering ATK too; the end varies from before +524 ms, 9090 67.67 s, to
    after +706 ms, bdf2 15.60 s, always past frame 15: her own clock, e.g.
    hit-stop on the final strike, "Fight totals" round 3). Still possible: floatingmode ends later than
    frame 15 after a controlled 5th shot; the 5th shot's burst isn't the
    10-frame enemy delay of shots 1–4 (0.7 s logged, 0.33 s kit) and reads
    the attacker's side at its arrow. Next: the five bursts' other zones
    (a teammate buff starting between arrow and burst decides between them).
  - 9c6e: two targets in a single-target fixture (two hits per shot, and
    of Li Zhiyan's and Liino's skills). Since 2026-11-18 a landing logged
    at its cast's last landing's time, all of the cast's landings logged,
    is the same landing on another enemy (PlacedHit.sameAs: same cast,
    slot and replay landing), not a second cast: Typhoeus's totals +61.9 →
    −9.8% (the log's plain 114 → 148, mismatches 121 → 130; hers 58 → 67:
    the second enemy's hits read against the first's landing). The totals simulate one enemy (Li Zhiyan +17.3 → −34%). The
    honest fix is importing it as a multi-target fixture. The same rule
    merges same-instant duplicate basic attacks elsewhere (af7b, b6aa,
    00ae, 79cc: totals ±0.2 points).
  - fc63 96.5–98.2 s (10 hits, fit neither), 9090 51.5 s (a delayed burst
    after the 5th shot's hover end), 00ae 30.0 s, 9c6e 52.5 s: not touched
    by the 2026-11-18 placement fix (no stop between those casts and their
    landings; fc63 92–98 s: bursts logged before their shots' projectiles
    still open casts, as before; 2026-11-24 they no longer do). Left in
    fc63 95.1 and 96.5 s: the log's two shots after its ultimate's first two
    are plain (14,064 and 8,876, no burst: no Hunting Arrow left), the
    replay's power shots with bursts (+4.0% of the fight): the replay has
    more arrows after the hovering ultimate than the game (its
    arrow_num_given, or the combo's Sign arrows at 93.10 s); not checked.
- **Typhoeus's smaller misfits seen deciding tests 9, 43, 46 (2026-11-18).** 1cd1
  40.12 s: her burst logged ×1.300 the replay's, whose arrow (39.69 s) consumed no Nature
  Infliction in the replay: an infliction the replay lacks (whose: not checked). d9e5
  11.73 s: the rain of her shot at 10.88 s lands as three ticks at one ms, 0.46 s after
  the replay's (11.07–11.27 s), as if held by her own combo (slow-down 11.17–12.00 s),
  which the engine doesn't let hold her own entities (T7). Both single instances; not
  pursued.
- **9090 (the whole team): Liino −15.0%, Perlica −13.0% in the totals**
  (the simulation of the logged casts). **Narrowed (2026-11-17):** the
  replay follows the log's Stagger: Liino −15.0 → −10.4%, Perlica −13.0 →
  −10.7%, the fight −5.4 → −2.1%. **Liino closed (2026-11-18):** her
  volleys are a 10 s timer (entry "Liino's volleys" above): 58 of 60
  volley hits replayed, Liino −10.4 → +2.5%, her plain 100 → 148.
  Perlica's −9.6% is left: her 130 hits all match (101 plain), so it's
  hits the replay doesn't land or lands differently, not their values.
  **Perlica closed (2026-11-22): not missing hits, her combo's value.**
  The replay lands all 130 (per skill: attack1 20, attack2 34, attack3
  51, attack4 16, combo 7, ultimate 2; no NOLAND, no replay-only
  landing: `zmdlogs replay 9090`). Her 7 combo hits matched only through
  the log-listing fallback, each ×1.500 of the primary reading, so the
  totals (primary readings) were short by them: Pulser Labs' Electric DMG
  +0.5 acts on the hit whose forced Electrification makes it (entry
  "Perlica's combo hits" below). Perlica −9.4 → −2.7%, the fight −1.5 →
  −1.3%, her plain 104 → 110. The −2.7% left is the crits' luck: the
  totals take expected crits, the log has three basic-attack crits and
  one ultimate at ×1.5 (48.63 s; ZMDLogs gives no crit flag on her
  ultimate in any log, 19 of 19 null).
- **Perlica's combo hits ×1.10–1.50 above the engine (2026-11-22,
  fixed).** In 4360, 9090, 9847 and fc63 every combo hit the replay made
  without another DMG bonus was ×1.500 (fc63 ×1.401 = 1.5 × its ×0.934
  ATK), elsewhere ×(1.5 + bonus) / (1 + bonus) (9090 ×1.431 at +0.16,
  9847 ×1.343 at +0.46): an additive +0.5, Pulser Labs' Electric DMG
  (the four logs are her Pulser Labs ones). In 3aa6 and d774 (Wild
  Wanderer, no Pulser Labs) ×1.103 and ×1.142: + 0.192 and + 0.224,
  Wild Wanderer's dmg_up at her logged skill-3 levels 8 and 9. **Cause:**
  both triggers ran after the applying hit's damage, while P3's (the
  same abilityEvent 102 and CheckBuffIdInContext tag 1466867135; Wild
  Wanderer's is event 206 on the same tag) ran before it, and the combo
  creates its forced conduct buff before its DamageAction. Now both are
  `beforeDamage`: of her 59 combo hits in 10 logs 46 are now exactly the
  primary reading (14 before; `zmdlogs hits <log> --operator perlica
  --json`); development plain 52.0 →
  52.1% (with fc63's override below 52.5%). **Ruled out:** a combo
  multiplier (atk_scale and extra_scaling are the data's; the hits with
  the bonus are exact), the Electrification level (the conduct buff's
  value matches the listed one), P-levels (P5 in every log), Qingbo's
  layers (one listed layer is ×3 entries, as the engine), the
  consumption. ZMDLogs lists none of the three (P3, Pulser Labs, Wild
  Wanderer) on that hit: its listing comes before the hit's own
  applications (docs/design/data.md, "Common misreadings"). **Also from
  this:** the reaction's own hit. e82d's Electrification hit (7544 ms,
  the only reaction Electrification in the development logs) got the
  +0.5 too once the trigger moved (Perlica's totals there +14.8 → +64%);
  it fits P3's ATK without Pulser Labs' DMG and without its own
  Electrification (×1.008), so an Electrification's own hit now takes
  its triggers' ATK but not their DMG bonuses, as Combustion's
  (landing.ts `reactionHitSide`), and sees the Electrification before it
  (status.ts OWN_HIT_SEES, ASSUMED on that one hit): e82d Perlica −3.4%.
  **Left:** 4d60's three combos ×1.07–1.08 (the log lists Liino's ATK
  +0.1 there, the replay hasn't: Liino's stance, not Perlica's kit),
  3aa6 147.2 s ×1.065 and 4bfc 154.3 s ×1.093 (teammates' buffs and a
  second Qingbo layer differ there), c6d8 32.3 / 62.9 s ×0.10 (team-wide:
  `zmdlogs groups`, 38 of 47 of her c6d8 mismatches).
- **Perlica in fc63: every hit ×0.934** from the first (4.8 s), before
  any reaction or buff. Her ATK from 30 unbuffed hits is 3,570.8–3,571.5
  against the engine's 3,822.0 (×0.9343), the same on every skill kind
  (basic level 6, battle 6, combo 10, ultimate 9), so it's ATK, not a
  skill level. Ruled out: her weapon at level 80 (its skills allow
  80–90), 2 or 3 attribute nodes, talents at 1 (each tried: worse); the
  enemy (eny_0120 tower015, where 9090, 4bfc and 00ae fit her); **the
  export's empty artifice lists read as 0** (2026-11-18: missing artifice
  only lowers the engine's stats, and the log is the lower; 4360 has the
  same three Pulser Labs pieces at [0, 0, 0] and fits); **the weapon's
  level and skill levels** (not in the log, assumed the highest: a
  search over weapon level 60–90 and skills 1–9 at her logged level 90
  comes no nearer than 3,568.9 and 3,573.9, scratch/fc63atk.ts); her
  hand piece's variant (usp02 hand_01–_04: 4,023–4,139) and its
  artifice. Still possible: an ATK% of 22.6% instead of 31.2% or 54 less
  Wisd from a source the export misreads (the nearest single inputs:
  weapon skill 2 at 7, ×0.939; skill 1 at 5–6, ×0.930 / ×0.946), her
  operator level (the log's 90; at 80 ×0.933). Not a kit lead (her
  other logs fit). **Fitted (2026-11-22): two unlogged inputs together.**
  `efsim zmdlogs fit-build fc63 --operator perlica`: attribute nodes 2
  with Stanza of Memorials at level 86 fit 57 of 81 hits and 20 of 21
  clean ones (×1.0000; as exported 0); 1 node at level 89 comes next
  (×1.0009, 47). Both give her ATK within 0.1%, so the hits can't tell
  them apart. Nodes chr_0004_pelica_5 and _7 (Intellect 15 + 20) need
  favorability 300 (CharGrowthTable), trust no export records, as Si's
  two missing nodes in 0c14. Kept as the fixture's `buildOverrides` (the
  first): fc63 plain 384 → 441, mismatch 242 → 185 hits, Perlica's 81
  hits 0 → 68 matching. **Still possible:** any other input worth
  ×0.934 in ATK (her operator level, a misread ATK% or Intellect line);
  the pair is a fit, not a reading. Her ultimate at 88.0 s (×1.457) is an
  unflagged crit (above).
- **Perlica's misfits elsewhere** (4360, 9847, 4bfc, 3aa6, d774) come in
  runs of ×1.3–1.5 (or their inverse) on basic attacks and ultimates.
  **Ruled out (2026-11-17): the Stagger windows.** **Ruled out
  (2026-11-18): her talent 1 (DMG vs Staggered).** Where the engine gives
  it (CheckPoiseValue = 0: Staggered), 9090's 26 and 4bfc's 22 of her
  hits match plainly; 9847's misfits under it sit beside plain matches
  with the same modifiers (64107, 65735 plain; 65313, 66539 ×0.972–0.973),
  and they're **team-wide**: Gilberta, Avywenna and Liino are ×0.972–0.979
  at 65–74 s and 139–142 s, ×1.40–1.50 at 80.9–81.9 s and ×1.29 at 138 s
  too (zmdlogs hits on 9847; groups: 22 of 26 team-wide). So 9847's runs
  are the enemy's or the fight's (Bigents, tower019, whose Stagger windows
  run 18–20 s: "The replay's Stagger windows" below), not Perlica's kit.
  **Found and fixed (2026-11-18): 4360's ×0.62–0.70 run (62.8–73.5 s) was
  Liino's Cosmovoice.** The log lists its Amp and ATK on the team to
  62.10 s, not from 62.76 s, with no finale, then her battle skill at
  63.57 s (projectiles 64.41 s): she pressed End Stance (unlogged: no log
  has an End Stance event) and recast Vocalist. The kit can't cast her
  battle skill while End Stance holds the slot (the ultimate's
  ChangeSkillAction, frames 77–527), but the replay made it anyway inside
  Cosmovoice and kept the Amp. Now the replay infers the exit press after
  the last listing (castassembly `exitPresses`, made only while the stance
  is on and would last past then): 4360 Perlica plain 104 → 111,
  mismatches 16 → 12, Liino's totals +29 → +5.7%; 9847 the same at 73.1 s
  (its Amp unlisted from 74.44 s, battle skill 75.84 s). 4d60's inferred
  End Stance (Amp unlisted after 98 s, battle skill 101.7 s) is wrong in
  kind, its finale is logged at 99.87 s (the stance ran out), but right in
  effect: the replay's Cosmovoice, 1.5 s behind the log's beats, was
  still on at the battle skill (4d60 mismatch +1, damage −0.4 points).
  Still possible: 4360's 74.6–75.3 s (×1.58–1.72, not Staggered, 3 hits),
  63.3 s (×1.54 now), 59.5 / 61.5 s (×0.97 under talent 1); 3aa6 ×1.16 /
  ×1.60 under talent 1 (2 hits); d774 ×1.29 / ×1.71 (3). Next: 4360's
  74.6 s (what the log lists there that the engine lacks).

## The replay's Stagger windows: the game's last longer than the engine's (2026-11-17)

**Shows:** over the development logs the replay's Stagger ended 0.4–12 s
before the log's (median 3.5 s, 34 windows that ended before the fight
did; the engine's own end, from the replay's holds: BuffReplay
`staggerHolds`), then broke the bar again at the next logged Stagger hit
(the log lists them at bar 0 with Stagger dealt) and ran a full new
window past the log's end. Starts mostly agree (a frame or so); a few
come seconds early or late where the replay's own hits break a bar the
log's don't, or miss the breaking hit (d4fb 92.4 against 97.0 s, c6d8,
a9d7 197 s). Bigents (tower019) windows run 18–20 s of world time
against its 8 s (489c, 9847, 9c0b).
**Settled: the log's listing is right.** Where the two disagreed, the
597 hits the log lists as Staggered and the replay didn't were ×1.30
(median) the replay's reading, the 214 the other way ×0.77. And no
logged hit falls between a hit that breaks the bar and the first that
lists Stagger (77–2676 ms later, median ~0.65 s). So the replay now
follows the listing (replaysteps.ts `loggedStaggerSteps`, engine
`holdStagger`), as it follows the bar: Staggered through each listed
moment to the next listed one, not Staggered at a moment that lists none
(unless a hit there breaks the bar).
**Ruled out as what lengthens the game's:** a ZMDLogs listing lag (the
damage, above); Stagger dealt while Staggered (no relation to the
excess; and the Talos Wiki's Stagger article, 2026-11-18: "While
staggered, Enemies can't receive more stagger", as the engine has it:
resources.ts `dealPoise` deals nothing while `isStaggered`, the 2 s
recovery included; in-game test 108); target hit-stop (HitStopAction affectType 1/2: per-window sums
3–14 s, no relation); Finishers, Lifts and Knock Downs in the window
(none); the modelled stops (no relation, if anything windows with more
of them run short less); the Slow status (SlowAction: Gilberta's
`move_speed_scalar` 0.8, Typhoeus's combo `persistent_slow` 0.6, movement).
**Still possible:** the Stagger lasting longer than PoiseRecTime (a
recovery animation, an AI state; bigents' far longer); enemy-side slows
the engine doesn't model holding its clock (Arcane's combo SealAction, a
0.2–1.0 time-scale curve over 5 s; Rossi's `ult_stopenemy_elite`,
Tangtang's and Aurora's enemy TimeDilationActions); time stops the data
gives no curve for. Windows with Typhoeus (2.5–5.5 s) and Liino run
long, but so do some with neither. The cost of not knowing is small for
the teams: the engine's Stagger 3.5 s longer moves the three simulated
teams' sustained DPS −1.2% (the owner's), +0.7% (Ink Melt), −0.2%
(Typhoeus's), 32 fresh seeds, within the noise.
**Also left:** hits at the breaking hit's own ms the log lists without
Stagger while the engine counts them (~20 over all logs; their damage is
mixed: ×0.77 and ×1.0), so whether a Stagger starts the frame after
the break is open (2026-11-26, scripts/probes/stagger/break-order.ts over every development log: the hit that breaks
the bar reads without the Stagger in 45 of 47, the hits after it at the same ms with it in 10 of 29, among them every
combo hit whose own Lift's airborne hit broke it, a27b 64.14, c4f3 82.65, d4fb 40.68 s, and 0c14's 80.48 s (both its
hits with it, ×1.256 = 1.3 × Alesh's weapon layer the log doesn't list there: −30k of Rossi's total); de6a 122.05 s,
Chen's battle skill and its airborne hit, both without. A rule "the hits after the breaking one at its ms" would get
19 of 29 wrong; a combo's hit after its own Lift breaks the bar, 4 of 4, isn't built on four). And 4e5e's unattributed Stagger (accuracy plan B1's
lead): from 53.2 to 55.4 s the bar falls 68 more than the logged hits
deal, in three steps: 24 at 53.177 s (with Estella's battle skill and
its Cryo-on-Heat reaction, 12 listed), 29.92 at 54.882 s (her combo and
Shatter, 12 listed), 14.04 at 55.403 s (Gilberta's combo, 5 listed);
after that every step matches. The non-whole steps suggest a scaled or
time-based amount (Solidification or Shatter?), not a hit. The replay
takes the bar from the log, so only the engine's own sums miss it.
**Found (test 110 from the logs, 2026-11-18):** the Stagger itself lasts
about 2 s longer. Over 30 windows bracketed within 3 s (bigents, 4d60's
paused one and three the replay broke seconds early aside) the log's end
is a median 2.3 s after the engine's own end (quartiles 1.4–3.9); with 2 s
more on the enemy's clock, a median 0.1 s off, 12 short and 13 long (rms
3.15 → 1.40 s; `staggerRuns(data, fx, { assume })`, the engine's own end
also where the log's calm hit cut it: `BuffReplay.staggerCuts`). The
engine adds it (engine assumption `stagger-recovery`, `2s`): a recovery
after PoiseRecTime that still counts as Staggered. Also ruled out now:
hits extending it (Staggers outlast hitless gaps of 1.8–7 s past the
data's end and end 0.1 s after a hit), the hit rate (r −0.01), Finishers
(r 0.24). A fit: 1.8 s + 1.18 × the ultimates' stops + 0.79 × the combos'.
**Still open:** the spread around the 2 s (sd ~1.4 s, every enemy; the same
scatter as Gilberta's Susceptibility ends, below); whether a freeze holds
it (`stagger-freeze`: rms 1.40 held, 1.42 not); bigents (tower019) 11–14 s
more in 489c, 9847, 9c0b (its own recovery?); 4d60 at 117.2–124.5 s, a
7.2 s gap with no hit from anyone and Akekuri's chain going on after it (a
whole-game pause the log's clock runs through: anything timed across it is
off by 7 s).
**Next check:** a per-enemy recovery for bigents if a team fights it; the
spread against the enemy's actions (not logged).

## Gilberta's Susceptibility: the engine's Vulnerable count (test 12, 2026-11-18)

**Shows:** the listed value is `rate × (1 + 0.1 × Vulnerable stacks)` (0.30–
0.42 at P0/P1); where the engine's differs (4360 0.33 / 0.39, 489c and d572
0.39 / 0.42, 9847 0.30 / 0.36: one or two stacks low when the ultimate
lands), the damage follows the log's value (86 hits against 24). Her
windows' ends scatter −1 to +2 s around the engine's 5 s plus stops (16
bracketed windows, median +0.4 s), the late listed hits' damage with them.
**Found and fixed (2026-11-22), 489c and d572 (3 against 4):** Rossi's
sequence-2 perfect hit landed twice in the replay. The kit's combo_3 jumps
0 → 212 without the qte_ring (the late path, its hit at real frame 15);
the replay read no ring, took the jump, and also landed the logged hit it
pinned as the perfect one (frame 29) 14 frames later. The late hit
consumed the infliction, so the perfect one's Lift and extra Vulnerable
(`consumedAtLeast 1`) didn't happen: +1 where the game gave +2. Every
Lift of Rossi's combo 3 in d572 was 0.46 s before its logged airborne hit.
Now the replay drops a jump that would skip a pinned landing of a hit only
the skipped part has, and the path it jumps to (drivers.ts `replayCast`;
it also ends Rossi's attack 4 landing both its controlled and
uncontrolled hits in 2fd9, and sequence 2 its late hit in 4e5e), and pinned landings of one frame land
in the log's order (9a80 32.49 s: her perfect hit consumed 2 before
Gilberta's ultimate at 32.51 s, now 149,554 as logged); the four ultimates read 4,
as listed (489c 30.02 / 92.31, d572 52.14 / 117.47 s). Of the 21
ultimates whose Susceptibility is listed (11 logs), 18 now agree with the
replay's stack count (a scratch census: her ultimate's listed value
against the replay's latest Vulnerable add before it).
**Open, 4360 and 9847 (0 / 1 against 2 / 3; 4360 fixed 2026-11-23, below):** the stacks outlive 20 s.
4360's 54.97 s ultimate lists 2 stacks 24.4 s after her last Lift (30.60
s), 9847's 126.09 s 2 stacks 24.7 s after its last (101.43 s); 4360's
116.00 s lists 3, so its 70.83 / 90.87 s stacks lasted past 113.40 s
(22.5 s). The world's time between (the logged casts' stops held,
`worldMs`) is 20.40, 21.24 and 21.64 s: 0.4–1.6 s more than the engine
holds. Both fights are the tower bosses (kltdcap_tower016,
bigents_tower019) with Avywenna, Perlica and Liino, where her own 5 s
Susceptibility is listed 8.6 s (4360 54.97 s) and 8.7 / 12.5 s (9847).
**Ruled out:** a teammate's Vulnerable the kits lack (Liino's soundwaves
create buff_physical_no_guard only with buff_chr_0035_liino_chrdung_armorbreak,
which nothing creates; Mi Fu's chrdg_addusp is a dungeon buff; no
ExtendBuff or PauseBuffTime names buff_physical_no_guard or its tag
1075718177, whose only holder is buff_physical_no_guard); another buff
counted by the tag (none applies it); the replay's Stagger (none between
in 9847).
**Found and fixed for 4360 (2026-11-23): the hidden holds, with a clock the
replay had thrown away.** The windows' world time, counted again with
today's placement (`zmdlogs worldtime`): 4360 90.88–113.42 s is 20.41 s
(0.41 s past 20 s), 30.59–54.97 s 18.84 s (no longer open), 9847
101.43–126.09 s 21.24 s (1.24 s past). Inside 4360's, Perlica's Arts DMG
Taken (wpn_funnel_0008, enemy-side, 15 s) from 92.24 s is listed to
108.27 s, 0.74 s of world time past the replay's expiry: a clock asking a
hold there. Two rules had dropped it: loggedLaneEnds called the run
refreshed because another run (from 104.92 s) starts inside it, though the
two are listed side by side to 108.27 s (two instances of a stackingType 1
buff, not a refresh); and runBounds took no instance buff
(KitBuff.instances). Now a run is refreshed only when it stops being
listed within 200 ms of the other's start; an instance buff's run is a
clock where the log shows it apart (every replay application inside it has
its own run, some run overlaps it and none ends within 1 s of it), it is
the run nearest the instance, and it is at most 1 s late (Arcane's
will_dmg / will_atk runs are refreshed in place with their start kept: 489c
12.0 / 14.6 s, 9c0b 31.5 / 34.3 s end together; b6aa's from 2.1 s asks
2.2 s, 4d60's from 10.8 s 7.7 s, which placed 11 s of holds there before the
cap). The hold then placed (4360 0.68 → 1.37 s, a unit at 94.6 s) keeps
the stacks: Gilberta's 116.0 s Susceptibility reads 3 (0.39, as listed;
Avywenna's ultimate at 117.98 s under it was a mismatch, now plain:
tests/buffreplay-fixtures.test.ts). So not an enemy-side clock (the same
bosses' Perlica and Avywenna debuffs run +0.07 to +1.28 s late, the holds'
size), not the stack timer, not the data (no time dilation on
buff_physical_no_guard; its stackingType 8 shared timer is the engine's).
**Still open: 9847 126.1 s** (0.30 against 0.36): the clocks place 0.51 s
in its window (a unit at 103.6 s) and the next unit at 126.13–126.74 s,
just after the ultimate; nothing listed asks the other 0.73 s before 126.09
s. A clock the replay doesn't have yet: the Vulnerable count her listed
Susceptibility shows (rate × (1 + 0.1 × stacks)), read as a bound on the
holds since the last add (P(read) − P(add) ≥ the world time past 20 s, when
the listed count is above the replay's); a bound builder for holds.ts. 9847's
plain count is 300 (as before the ramp cap); its one new mismatch is
Gilberta's attack 3 at 140.30 s (×0.975), from the moved holds.
**Still open:** her 5 s Susceptibility listed 8.6–12.5 s (d572's runs 8.8
s too: not the tower bosses'); holds.ts statusLanes keeps the old
`refreshed` rule for the enemy's statuses (left alone in this branch: the
bound builders there were another agent's).

## Smaller, not yet diagnosed

- 5082 after the hold bounds moved to the replay's own stops (2026-11-23, with main's instance-buff clocks): damage
  −2.1 → −8.2%. **Found and mostly fixed (2026-11-23, ticks and layers):** not Arcane's Arts DMG Taken (the replay has
  both layers, 0.216, on every hit there) and not the moved 0.77 s unit (36.77 or 38.14 s, both inside the instances it
  spans). Arcane's combo reset (engine, same round) made the replay's own clock 0.1–0.2 s shorter for every instance,
  which tipped two buffs over hits: (1) Yvonne's MI Security layers (×1.166 on her finisher at 49.78 s), refreshed by
  her crits: the log gives none of her 85 ultimate hits a crit flag, so the replay let them run out at 49.73 s (49.83 s
  before), though the log lists them on her to the end. Fixed by crits read from the values (buffreplay.ts
  `valueCrits`): 5082 −8.2 → +0.7%. (2) Xaihi's weapon team ATK (`wpn_funnel_0010.atk`, ×1.18 on Arcane's hits from
  50.51 s and Yvonne's power attack at 51.11 s): the instance from 27.37 s is listed on Arcane and Yvonne to 51.1 s,
  1.67 s of world time past its own expiry (49.43 s), over INSTANCE_LATE_MS (1 s), so it isn't a clock; the placed holds
  give it 1.04 s (ends 50.47 s). With the cap at 2 s, 2.17 s of holds fit every clock (none dropped). **Fixed
  (2026-11-23, remaining leads):** a refresh in place needs a reapplication on the holder inside the run, and the 27.37 s
  instance is Xaihi's last: INSTANCE_LATE_MS now applies only where the replay reapplies the buff inside the run (the
  22.53 s instance's runs, 2.9–3.6 s late, still skipped: the 27.37 s one may have refreshed them); otherwise the run is
  a clock up to HIDDEN_HOLD_SHARE (holdinputs.ts runBounds). Arcane's hits from 50.51 s plain; 5082 plain 224 → 247,
  4d60 697 → 703 (Arcane's last will_dmg / will_atk runs from 97.4 / 98.5 s, 2.7–3.0 s late, now clocks: 3.0 s of holds
  in 98.5–131.8 s, which also hold her level-4 Corrosion past the log's end at 102.98 s, 15 hits plain → fallback: a
  Corrosion end read from the hits isn't a bound yet), af7b +2, c3c7 +1; hold-outs plain 77.6 → 77.7% (one mixed).
  **Still possible:** a reapplication the replay doesn't make (an Arcane burst it misses) passing for holds; the cap's
  1 s where a reapplication exists.
- db87 after the ultimate-placement fix (2026-11-18): Laevatain's ultimate now
  starts at 16.60 s (its event at 18.62 s, the last hit 2.19 s before it, the team
  resuming 0.36 s after, her first enhanced cast at 19.01 s, which the old start
  at 18.62 s put inside her 73-frame cast). Plain 152 → 114: Arcane's level-4
  Corrosion shreds 20.9 instead of 17.6 Heat RES at 20.1 s (Camille's hits ×0.973
  low from 19 s), because her stop now overlaps Camille's combo slow-down
  (16.70–17.20 s) and holds the ramp 0.5 s less. **Decided (2026-11-23): the
  lowest scale stays; the 0.5 s is a hidden hold, not the stops' sum.** Read
  from every db87 hit with the replay's Corrosion (the logged value ÷ the
  primary as a resistance step, scripts/probes/corrosion/corrosion-lag.ts), the log's ramp runs behind the replay's by a growing amount:
  0.11–0.45 s at 19.0–19.4 s, 0.26–0.47 s at 20.2–20.4 s, 0.51–0.63 s at
  23.2–23.3 s, 0.57–0.72 s at 24.3–25.4 s. A sum would add Camille's 0.5 s at
  once from 17.2 s and, at 22.0–22.9 s where Si's, Camille's and Laevatain's
  combo slow-downs overlap, 0.60 s more (held 1.32 s summed against 0.72 s at
  the lowest scale: scripts/probes/corrosion/stop-sum.ts): over 0.86 s by 23.3 s, above the
  0.63 s the hits allow. A growth of 0.05–0.37 s over 20.4–23.3 s is what the
  buff clock's hidden holds give (Si's Amp runs +2.49 s long in db87), and
  the buff clock already rules the sum out for buffs (4f7e, 458b). Across the
  Corrosion logs the ramps mostly run 0.1–0.8 s behind the replay's
  (1cd1, 5082, 7910, 79cc, af7b, f879, f978, bdf2, b6aa), with or without an
  overlap. Exceptions run ahead: 3f78 and 4a64's openers (below, "3f78 and
  4a64"). **Fixed 2026-11-23:** the ramp's steps are a clock of the hidden
  holds ("The buff clock", More clocks): db87 plain 166 → 206, mismatch
  59 → 18, 3 of 190 readings off the replay's step. (The world-time views
  `zmdlogs worldtime`, `lanes --world` and `cadence` count the stops of the
  replay's casts since round 6, db87's Laevatain at 16.60 s, placed from its
  cast event, among them.)
- a7a7 after Liino's combo placement (2026-11-23, plain 386 → 351): her
  first combo (hit 1 logged at 3.86 s) now starts at 3.0 s, its stop ending
  before the Corrosion Arcane's battle skill forms (logged at 3.86 s, the
  stop's end), so Si's combo stop (3.97–4.77 s) alone holds the ramp
  0.53 s where the log allows at most 0.42 s; the old placement overlapped
  the two stops (0.30 s): ×1.013 on 35 hits, 5.3–22 s. **Still possible:**
  Si's combo, pressed during Liino's stop (its event at the stop's end),
  started earlier; the Corrosion formed inside Liino's stop (the hit pinned
  at its logged time, the stop's end, not its kit frame). The same knock-on
  of the move in 4d60 (−6 plain), 9847 and c6d8 (−1), not traced.
  **Fixed 2026-11-23 (ticks and layers):** a landing logged at another cast's frozen stop's end whose cast event puts it
  just before the stop (≤ 0.2 s) landed there: the cast starts at its event and that landing, with what it set off
  (its reaction, a trigger's hit), lands at its kit frame (logcasts.ts `beforeStopStart`, LoggedCast.beforeStop;
  castassembly.ts `batchedFrame`). a7a7's Corrosion from 2.97 s: ramp readings off the replay's step 15 → 4. Not 489c's
  49.31 s: there Arcane's event (48.11 s) puts the hit inside Rossi's combo slow-down (48.37–49.00 s), logged 0.31 s
  after it, so the placement's held start (48.21 s) stays; 48 of its 204 readings are off a step. **Diagnosed
  (2026-11-23, remaining leads): 49.31 s is right.** The held start fits it (48.21 s + 20 frames + the 0.42 s Rossi's
  combo_2 slow-down takes = 49.29 s). The readings "ahead" at 49.77–50.00 s are Rossi's combo_2 afterhits, ×1.013 for a
  reason that isn't Corrosion: every Rossi hit from 47.00 s (before this Corrosion) is ×1.013 and the log's reading of
  the kit buffs fits them (her weapon's layers, `wpn_sword_0022.layer`, listed as one more +0.016 than the replay has),
  so they read one shred step too many (dropped as bounds already). The real residual runs the other way: from 55 s the
  log's ramp is a step behind the replay's (0.4–0.6 s more hold asked, 0.12 s placed), its bounds dropped against
  Rossi's bleed tick series 52.18⇒59.72 s (≤ 0.09 s), whose ticks after 55.72 s may be a new application's (a 1.54 s
  gap). One cause found and fixed: the stop lists put a phantom 0.42 s stop at 58.97 s, combo_3's frame-212 slow-down
  on its perfect path, which ends at frame 211 (logcasts.ts pathOf: the stops follow the path the landings show): 489c
  plain 579 → 589, mismatch 31 → 23. **The bleed tick series (2026-11-23, reset-reach round): not a reapplication.**
  Its ticks run 1.00 s apart on both sides of the one 1.54 s gap (54.17 → 55.72 s), and that pair asks +0.54 s of hold
  (±0.15), what Corrosion's ramp asks from 55 s (0.4–0.6 s): two clocks agree on about one dodge-sized hold between
  54.2 and 55.7 s. The chain's other conflict is its first tick (52.18 s), logged inside Rossi's combo_3 slow-down
  (51.90–52.53 s), whose pairs ask −0.19 s (the slow-down holds less than the engine's, as in 3f78 and 4a64: 0.15–0.2 s,
  "Left" under the buff clock). Dropping chains' anchors inside a slow-down's held frames
  (holds.ts tickBounds; scratch diff measured, not adopted) keeps the chain from 53.18 s, but the 0.54 s is still
  dropped: the ramp from 49.31 s caps the hold to 63 s at 0.72–0.79 s, and the unit placed at 49.56 s (latest 52.99 s,
  for 26 other clocks) already takes 0.51 s of it. Measured: development 2 better, 3 worse (489c 590 → 580 plain,
  mismatch 23 → 32), verified 1 mixed, hold-outs 1 better, 1 mixed. **Next:** which clock puts a unit at 49.4–53.0 s
  (it and the 54–56 s hold can't both be under the ramp's cap), or whether the ramp's application at 49.31 s is early.
- d774's totals (2026-11-18): Zhuang Fangyi's ultimate at 102.17 s now starts
  2.6 s before its event (the same placement rule); her simulated total +11.3 →
  +15.4%, no verdict moved. **Explained 2026-11-23** ("Fight totals" above): the replay's strikes and finales in
  Si's two phases (30.6–54.6 s, 124.5–137.8 s), where the log has no hit; with `enemy-away` +27.2 → +3.7%.
- Zhuang Fangyi's `attack1_ult_2_abilityrange` (seen 2026-11-18; **found
  and fixed 2026-11-22**): Empyrean attacks 1 and 2 both spawn four
  entities, `attack1_ult_1..4_abilityrange` (SpawnAbilityEntity at 12–15
  and 10–13), each a cylinder at its own offset and angle that hits a
  target only without the 0.4 s marker attack1UltHitMark the one that hit
  leaves: one hit, logged under the first entity whose shape held the
  target (`efsim zmdlogs census --select 'event:attack1_ult_._abilityrange'`:
  _1, _2 and _3 all seen, 50 groups). Both kit hits now name the four keys.
  The two attacks then share every key, so the placement tells them apart
  by attack 1's windows (attack 2 from frame 22, attack 1 from 60), past
  her Empyrean battle skill, which keeps the chain (logcasts.ts `choose`,
  only for steps alike in every key); 16 Empyrean hits that read ×1.4 or
  ×0.71 (the other step) now fit. Left: the entity k lands k − 1 frames
  after the first (the kit lands every key at the first's frame).
- Zhuang Fangyi's Sunderblade count in d774 ("8 strikes where the log has
  3", **explained 2026-11-22**): the log has all 8 (97.87–99.56 s and
  102.17–102.58 s, the final at 102.89 s): her ultimate (pressed at ~99.6
  s, logged at its end, 102.17 s) held the battle skill's strikes, which a
  buff on her deals (normal_skill_trigger_sword). 4d60 the same: the final
  at 157.42 s, her ultimate's logged end. The strikes are now on the
  world's clock (KitHit.world). **The ×1.39 (2026-11-23): an
  Electrification the replay let expire.** The first strike's ×1.3858 is
  exactly a consumed level-1 Electrification: the scale's conductCnt 1
  (atk_scale + atk_up_per_conduct × 1: ×1.2) and one more layer each of
  Lone Barge's consume DMG (+0.32) and Xiranflow (+0.15), DMG 3.037 →
  3.507 (8751 × 1.2 × 3.507 / 3.037 = 12126; logged 12127). The log lists
  Perlica's forced Electrification (since 87.22 s, P1's 8.75 s) to 97.44 s,
  where the battle skill (event 97.24 s, its consumption at frame 6) takes
  it: 9.61 s of world time against 8.75 s; the replay's ended at ~96.6 s
  (no Electrification on Perlica's hit at 96.69 s). So the cause is the
  buff clock's hidden holds on an enemy status ("The buff clock": the holds
  placed once for every timer), not the strikes' zones. The remaining
  ×1.342 on strikes 2–4 was the strikes' Amp marks: the replay struck 3
  times before Liino's combo stop where the log struck once, because the
  placement put her combo 0.6 s late (**fixed 2026-11-23**, logcasts.ts
  `ownStopLoggedFrame`: a hit inside its own cast's stop is logged at the
  stop's end; every Liino combo in the logs shows it). **Fixed 2026-11-23 (the
  enemy's statuses as clocks, "The buff clock"):** the Electrification's
  run places 0.83 s of hold before 97.44 s; the first strike is plain
  (12127) and the eight strikes land one for one with the log's.

- Si's talent Haste after a burst without an Inksoul (2026-11-16): the
  data (only xianjing_linkline's finish and xianjing_inkboom create
  talent1_speedup; xianjing_inkhurteffect's end doesn't) and the kit give
  none. **Ruled out:** a log check: ZMDLogs records no Haste (no speed-up
  buff in four raw details with 2 Final Stroke, 4 Inksoul-expiry and 3
  no-Inksoul ends), and fixtures keep only buffs with damage effects.
  **Shows (2026-11-16, refreshed fixtures):** `poise.origin` tells the
  path of each Artful Intent burst that dealt Stagger: of the 79 bursts
  in the development logs (multi-target included), 39 are credited to
  Final Stroke (`normal_skill_2`), 33 to an Inksoul expiry
  (`normal_skill_inkmove_2`); 7 deal no Stagger (40d9, 3f78, a7a7, db87,
  e82d, 064b, 4f7e: one each), so their path isn't recorded.
  **Still possible:** the game acting otherwise than its data reads (no
  sign of it). It flips the owner's team's rule comparison (Initial
  Stroke right away +3.0% now, −3.0% with Haste on every burst).
  **Next check:** in-game test 109.

- Laevatain's enhanced battle skill (`normal_skill_during_ult`): ×0.833
  in e989, ×1.083 in db87; its `ratio` key has no value in the data
  (in-game test 20).
- Arcane's talent 1, paramType 4 (−6 on the INT combo) ignored by the
  engine: a second cooldown cut would make INT combos twice as frequent
  (kit review N1; an in-game timing decides).
- 4e5e at 12219 ms: Estella's Lift lists Stagger 10 apart from her
  ultimate's 24, the one exception of 156 to the shared-event rule.
- 1d91: Typhoeus's natural-triggered hits get Barrage Array's +0.10 in the
  engine, which the damage doesn't show (seen before the lance fix: recheck).
- From the roadmap: Snowshine ×0.96
  (04d4), Liino ×1.031 (92b4) offsets; 3aa6's Stagger at 145.6 s; Xaihi's Amp timing (b6aa); Last
  Rite's weapon buff (b6aa); Ember low by one factor. (bdf2's Si combo
  finisher ×1.456: closed 2026-11-14, see "Buffs a cast consumes".)
- b7b3: Tangtang's waterspouts from 15927 ms are ×1.13 the log's in the
  replay (11060 logged against 12495), as before 2026-11-14; it runs the
  replay's total over and the time to kill 1.2% early (test bound 1.5%).
- f879: the placement gives Laevatain's battle skill at 87.1 s the burn
  ticks and explosion logged at 94.7–96.1 s (another cast's): they keep
  its Link since 2026-11-14 (10 mismatches ×1.3). A placement fix
  (logcasts.ts), not an engine one.
- db87: Laevatain's Combustion ticks from 49.3 s lack Si's Amp in the log
  (12325 against 16762 at 47.4 s); the engine keeps the Amp its snapshot
  took at the forced Combustion at 45.7 s. A Combustion re-applied at
  48.6 s (her combo) taking a new snapshot would fit; not checked.
