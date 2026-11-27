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
