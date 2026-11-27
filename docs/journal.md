# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 168 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

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

**Scoreboard** (`npm run snapshots:update`): development plain 80.0 → 80.4%, mismatch 6.8 → 6.7%, mean |damage error|
3.3 → 3.1%, within 5% 27 → 28; hold-out unchanged (82.6%, 5.5%, 7.1%); earlier pending unchanged (81.4%, 7.6%, 1.6%;
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

## 2026-11-26: A stop's batched landings: the log's Stagger bars give their order; Pogranichnik's Morale before the damage

**Goal:** the order of the landings the log batches at a stop's end (c4f3 7.05 s: Chen Qianyu's combo shattered the
Solidification in the replay, Estella's in the game), as a general rule; the Vulnerable stacks c4f3's 13.07 s Breach
consumed (three in the replay, four by the next combo's path); if time, d4fb 86.67 s (Pogranichnik's bank 0.3 s late)
and 7910's early rogue wave.

**Done:**
- **A logged ms is a batch, its order the Stagger bars'.** The log flushes every ~100 ms and at a stop's end, so one ms
  holds hits up to three frames apart; each Stagger event's bar (the one before it less its dealt) falls in the game's
  order. c4f3 7049 ms: Estella's combo 274 → 264 (the Shatter credited to it), her ultimate 254 → 234, Chen's combo and
  the Lifts 234 → 224 (open-problems had read the bars backwards). Over the development logs' 60 pairs of two operators'
  events at one ms the bars follow neither the operator IDs (28 right), the team's order (39) nor the casts' starts (29
  of 44: why docs/tried/2026-11-24-same-ms-cast-order.diff was mixed): the game's time order inside the batch, which only
  the bars keep (scripts/probes/physical/batch-rules.ts). The replay now lands pinned landings at one logged ms in the
  bars' order (castassembly.ts `batchOrder` → landings' `order` → engine `ScheduledHeader.loggedOrder`, schedule.ts
  `dueBefore`). Simulations keep the ID order: no rule from cast data fits.
- **Lead 2 was a knock-on of lead 1.** With the batch's order Estella's Lift adds the Vulnerable stack Chen's Shatter
  had not, and c4f3's 13.07 s Breach consumes four; every Breach or Crush before a Pogranichnik combo whose path its
  values decide now consumes the path's stacks (25 combos; at cbe7d5b c4f3 13.67 s alone differed:
  scripts/probes/physical/breach-path.ts). c4f3's hits from 7.05 to 14.43 s replay exact.
- **Fervent Morale before the damage of the hit that makes it** (lead 3, d4fb 86.67 s): the layer the logs list since a
  Breach's ms is talent 2's, from his ultimate's follow-up on his own physical status, which comes with the data's
  FractureAction before the battle skill's DamageAction: `beforeDamage` on oath_harass_status_self / _mate (d4fb 86.67,
  161.59 s, c4f3 71.15 s, a9d7 205.06 s, de6a 26.03 s exact). And a hit's stacks gained with its SP before the damage
  raise their stacks event then (landing.ts; only Pogranichnik's hits have both): the bank's layer counts for the slash
  that filled it (d4fb 47.92 s).

**Scoreboard** (`npm run snapshots:update` after merging main at f05036d, the logged purges; `measure --base f05036d`
for this change alone): development plain 74.3 → 76.2%, mismatch 10.4 → 10.2%, mean |damage error| 5.1 → 4.9%; hold-out plain 82.1 → 82.2%, 7.4 → 7.1% (2 better, none worse); earlier pending plain 73.0 → 77.7%,
mismatch 11.7 → 11.3%, 3.5 → 3.4%. Chen 43.0 → 74.3% plain, Pogranichnik 52.1 → 75.3%, Estella 59.9 → 81.0%, the male
Endministrator 52.9 → 88.7%, Lifeng 43.5 → 91.2%. Better c4f3 (275 → 464, −3.4 → −0.8%), 3f78 (91 → 147, −3.7 →
0.0%), a9d7 (265 → 333, −3.3 → −1.5%), d4fb (516 → 844), de6a (71 → 287), 458b, 7e19 and four by a hit or two. Mixed
b7b3 (0.4 → 0.7%: Tangtang's battle-skill shot before Last Rite's combo by the bars, now an exact read crit, which had
hidden her expected-crit landings' +12%; Arcane's touch at 7.15 s now exact) and 4bfc (−1.0 → −1.2%: Arclight's burst at
88.82 s matched, Zhuang Fangyi's replay-only 19,584 gone). The per-operator total errors that rose (Arclight 4.8 → 5.7%,
Tangtang 3.6 → 4.0%, Lifeng 0.9 → 1.3%) are those hits turning exact. team-ab: unchanged (both teams' own fights the same,
the owner's Estella team included). The example pogranichnik-chen moved (+1.5%, the Morale timing), snapshot updated.

**Decisions:** the bars are read only where the batch has two Stagger origins and two bars; several events at bar 0
(a break) share a place, as do events without Stagger (the ID order then). schedule.ts, state.ts and planning/search.ts
(a key field) were outside the brief's file list: one line each for `loggedOrder`. No assumption: the bars are the log's
own record of the order.

**Left:** Estella's weapon ATK at 7.05 s (her combo, Shatter and Lift with it, her ultimate after them without it: one
batch, not built); the harasses' logged delays (0.6–1.3 s, the kit's 0.3 s) and d4fb's 88.55 s harass and 89.82 s
Assault placed as an ultimate the replay doesn't cast; c4f3 92.93 / 147.41 s and a9d7 239.40 s Morale layers; 7910's
early rogue wave (not attempted).

## 2026-11-26: Slots and paths by value: Hunter Pursuit, Pogranichnik's combo and his bank

**Goal:** a cast's logged hits paired to its kit hits by value where time and keys don't decide (9c0b's Hunter Pursuit,
7910's rogue wave); Pogranichnik's SP-driven team buffs (Thermite Cutter, Fervent Morale) behind Chen's, Lifeng's,
Pogranichnik's and the Endministrator's fallbacks; if time, 9c6e's Liino combo on two enemies (open-problems "Fight
totals" round 5, "Low plain, low mismatch").

**Done:**
- **Slots by value** (logcasts.ts realignByValue): a cast's landings of a key fewer than its slots, the slots'
  multipliers apart by more than ×2, take the slots their values fit under one scale, then by world time; the first
  slot moves only for a key that is its cast's only one, by values or by the landings no other stop separates (by time
  alone it moved 7910's stares across Liino's stops). 9c0b's Hunter Pursuit is hits 2–4 (its Link before Arcane's
  ultimate), db87's Camille ultimate hit_2 / hit_3, a27b's Mi Fu, 00ae's Arcane lasers.
- **Neither of Pogranichnik's buffs reads the team's SP.** Thermite Cutter was right: its `other values` are the
  listing (once per application), the hits' values fit the replay's two layers. Fervent Morale's bank was double-fed:
  his combo's slashes, pinned to the 4-stack path's frames by kit order, landed beside the 3-stack path the replay took.
  Now a landing in a taken state jump's skipped part goes onto the jumped-to path (engine paths.ts takenPathLandings),
  and the values choose the path where they alone fit (castassembly.ts valuePaths, replayCast kitJumps; PATH lines).
  c4f3's first layer 15.97 → 34.03 s (log 34.04 s).
- **A Breach's Arts Intensity after its hit's before-damage triggers** (landing.ts): the data's SP comes before the
  FractureAction, so the layer the SP makes counts for the Breach (alone: d4fb plain 516 → 837 on the old bank).
- **A second enemy's landing by value** (logcasts.ts sameByValue): 9c6e's Liino combo at 47.72 s; 40d9 unchanged.

**Scoreboard** (`npm run snapshots:update`): development plain 72.7 → 73.8%, mismatch 10.6 → 10.5%, mean |damage
error| 6.3 → 6.1%; hold-out unchanged; earlier pending plain 73.0%, 3.5%. Pogranichnik 41.9 → 52.1% plain (total error
5.0 → 2.8%), Chen 38.8 → 43.0%. Better 9c0b, db87, a27b, 7b54; mixed 9c6e (plain 175 → 202, −13.5 → −13.9%), a9d7 (177 →
265, −2.2 → −3.3%: the doubled slashes had hidden Chen's −3.2% and Estella's −7.0%), c4f3 (223 → 275, −2.9 → −3.4%),
d4fb (−0.4%: 86.67 s, the bank 0.3 s late in the replay); worse 7910 0.0 → −0.2% (its 352,792 is the early rogue
wave by value, ×17.5 a stare, with no dive logged: matched to the plain wave now). team-ab: unchanged.

**Decisions:** none of it an assumption: the values' ratios are ×2–17 apart where they decide, and each rule acts only
where they do. landing.ts is outside the brief's file list (not status.ts or the buffs): named for the lead.

**Left:** the Vulnerable stacks a Breach consumed read from the next combo's path (c4f3 13.07 s: three in the replay,
four in the game), the harasses' Fervent Morale on whom (c4f3 68.83 s), 7910's early wave.

## 2026-11-26: Arcane's WILL lines and Chen's late Wolven Blood final

**Goal:** three leads from open-problems: e82d's −8.9% (Si's combo final at 9.12 s, with Arcane's Solemn Phalanx WILL
lines listed five times), c4f3's second Wolven Blood final ending at 104.5 s against the log's 99.1 s, and Estella's
set and Susceptibility missing on Chen in c4f3.

**Done (diagnosis; no code change kept):**
- **e82d: not the WILL lines.** The game counts one will_atk and one will_dmg (stackingType 1 by priority, as the
  engine has them): the slash just before the final lists the same five lines and reads plain with two, and Si's
  finals with ×3–×4 lines listed read plain in 79cc, 9c0b, b6aa and f978. The final misses Arcane's combo
  Susceptibility (doubles_susceptibility): its lane ends at 8925 ms, between Si's last slash and her final, and the
  final read as a crit without it is the logged value to 0.01%. 6339 shows the same at Si's final. What ends it is
  open (the seal's replacement chain, a control ending the SealAction, a stage rule in 6339): open-problems, round 5.
- **c4f3: a layer short, not the final's clock.** The first final ends at 49958 ms, a crit's ms; that hit reads without
  the final and its layers, and the layer it adds survives the clear. The replay ended the final 42 ms later (the
  placement takes the end-boundary hit as listed), wiped that layer and reached the second final 2.7 s late. Taking
  every end-boundary hit as past the run (engine assumption `boundary-ends` `before`) fixed c4f3's finals (plain 223 →
  233) but measured mixed (development |damage error| 6.3 → 6.4%, 4360 −9 and 9555 −16 plain): dropped,
  docs/tried/2026-11-26-boundary-ends-before.diff.
- **Estella in c4f3: one batch's order at 7.05 s.** The replay lands Chen's combo first, shatters the Solidification
  with it and takes Estella's combo as its not-Solidified variant (×2.86 low), so neither her Physical Susceptibility
  nor her set's trigger come; the log credits the Shatter to her combo. The fix lies in the batch's landing order
  (castassembly.ts, another agent's file this round): left for the lead.

**Decisions:** no team numbers (no engine or kit change kept, team-ab not run). The boundary rule stays out: a lane's
end at a hit's ms isn't one side of the hit in general; c4f3's case is decided by that hit's own value.

**Left:** what ends Arcane's doubles Susceptibility before Si's final (e82d, 6339); a bound from an end-boundary hit's
value; the order of landings batched at a stop's end (c4f3 7.05 s). Friction report
docs/friction/2026-11-26-arcane-will.md.

## 2026-11-26: Improvement round 15: one rule for each fact, records the views carry

**Goal:** the five open friction reports and round 14's backlog (docs/friction/README.md's round), every file free:
the structural causes first (a fact computed twice by two rules, a record the views didn't carry, a comparison against
the wrong reference), behaviour-preserving.

**Done** (docs/friction-done/2026-11-26-round-15.md has the list and the commits):
- One rule each: the replay's stops (castassembly.ts replayStops, read by the hold placement and every world-time view;
  `zmdlogs worldtime` replays and shows a tick-read event without frames); a hit's twin on a jump's other path (engine
  timeline/paths.ts pathTwin, pathLandings, for the control and chance paths and castassembly.ts); each assumption
  kind's fact (assumptions.ts ASSUMPTION_FACTS, docs/design/data.md's table, tests/assumption-facts.test.ts); one
  reason per kit buff (replaycrits.ts buffDecidability).
- Records the views carry: HitRecord.assumptions and landing.cast, `zmdlogs assumed --operator`, groups' rows of casts
  matched only as another kit hit, LINK and two-casts MADE lines, measure's hold units with their pinning bounds,
  `zmdlogs clock`'s check paired by the nearest start, `zmdlogs stagger`'s FLAG.
- The reference: measure with no reference named and stale snapshots measures the merge base with main as --base;
  cli-ab reads the other worktree's paths as this checkout's.
- Tools: scripts/split-module.ts (a split as a checked move), check-links.ts staleCitations (eight fixed) and conflict
  markers (docs/roadmap.md had a merge's, resolved), `lead-files.ts --family`, bash-guard's sed hint, process step 6
  (CLAUDE.md is the lead's: lines proposed in the summary's "For the lead").

**Checks:** `npm run measure -- --base 32dfacd --at HEAD` after the refactors: no log's verdicts moved; team-ab against
32dfacd: every team's fight the same; `npm run snapshots:update` at the end: the scoreboard unchanged.

**Found on the way:** the CLI's `--no-cache` and `--no-foods` were dropped by parseArgs' allowNegative (read as an
undeclared `cache=false`), so the hits cache was read whatever the flag said; fixed (command.ts withDeclaredNegatives).
The fact table's test found the log-listing fallback trying both crits where the replay had read one (three hits in
0c14 and a9d7; a fallback either way): on the backlog's accuracy list with two other candidates the table names
(reaction levels the log decided, the enemy's side).

**Left** (docs/friction/2026-11-26-backlog-after-round-15.md): the log context `{ data, assume }` (carried twice),
fit-build over a wider space with chance counts, the by-operator scoreboard's share (a new snapshot key), a recorded
Stagger start.
