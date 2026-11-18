## 2026-11-18: Typhoeus's and Laevatain's in-game tests from the logs; buffs created in a stop are held

**Goal:** decide from the logs in-game tests 9, 43, 46 (Typhoeus) and 17, 21, 22 (Laevatain's
Twilight and Scorching Heart), checking the re-triage's claims (docs/in-game-tests-retriage-*.md).

**Decided** (each in its test's section of docs/in-game-tests.md):
- 9: the ×1.3 on her Power Shot's burst after a consumed Nature Infliction fits (41 plain matches
  with it, none at ×1/1.3; the misses are other causes).
- 43, partly: the re-triage misread the engine. Her controlled 5th shot is a Power Shot with a
  burst and no arrow used (data and kit); every logged 5th is the controlled one
  (`floating_attack5_01_projhit`) and is followed by its burst. No log has an off-field 5th: that
  half stays for the game.
- 46: one rain per shot, at most five, the 5th empowered (7 ultimates; the re-triage's 13 counted
  the log's repeated `ultimate_skill` events). d9e5's 5th rain needed the window held by two
  teammates' stops that were already running when it began.
- 17 (Laevatain's variant): the jumps skip: explosion to extra hit 0.97–1.17 s (no skip: 2.7 s),
  battle skill to next attack 1.2–1.4 s (3.8 s).
- 22: `since` is the latest (re)application (it moves at every re-creation, f879 92.49 s 12 s into
  an instance); in 25 empowered casts at 4 Melting Flame it never moves at the capped gain: no
  restart, as the engine has.
- 21 and 18's Twilight part, partly: every closed Twilight window outlasts 15 s from the press plus
  the engine's holds by 2.1–6.6 s, so her own stop holds Twilight; with that it's still 0.1–4.6 s
  short in all 7, and no single extra term fits (open-problems). No log has a combo cutting her
  enhanced battle skill short.

**Engine and replay changes:**
- Engine assumption `buff-in-stop` (default `held`; timeline/clock.ts `heldFromNow`, actions.ts
  `addBuff`): a buff created while a time stop or slow-down runs is held by the rest of it, as the
  running buffs were when it began (the same rule as an Arts Burst's clock, T14). It replaces the
  kit assumption `laevatain-twilight-own-stop` (removed with its trigger).
- `loggedCastStart` (buffreplay.ts): another's hit within 0.5 s after an ultimate's cast event, not
  only at it, says the event is the stop's end (Laevatain's ultimate in 17 of 22 windows, was 11).
- `efsim zmdlogs replay --assume <id>=<reading>`.

**Scoreboard** (`npm run snapshots:update`): development plain 49.5 → 50.0%, mismatch 19.3 → 19.3%, mean
|damage error| 13.0 → 12.7% (18 better, 3 worse, 2 mixed); hold-out plain 65.0 → 66.1%, mismatch 7.4 → 6.9%,
damage 12.5 → 12.1% (7 better, 2 worse); earlier pending plain 47.2 → 47.4%, damage 8.2 → 8.4%; verified
unchanged. Worse: db87 (plain 152 → 114: the placement fix makes Laevatain's stop overlap Camille's combo
slow-down, so Arcane's Corrosion ramp is held 0.5 s less; open-problems), d774 (totals +11.6 → +16.7%, Zhuang
Fangyi's ultimate 2.6 s earlier, no verdict moved), 1d91 (two of Ardelia's assumed matches), and 0.1-point totals
(4360, 0c14, c3c7), b6aa one plain hit.

**Examples:** the Ink Melt and Si-Laevatain-Liino-Gilberta timelines repaired (Laevatain's steps in Twilight's
extra 2 s as its forms): Ink Melt's 60 s 3,953,129 → 3,402,966 (−13.9%: its second ultimate no longer fits, as
show_weapon blocks her energy and starts her cooldown 2 s later); Si-Laevatain-Liino-Gilberta +2.7%; Typhoeus's
team's 60 s +0.75%.

**Teams** (`efsim rules`, 32 seeds from 1001, against `--assume buff-in-stop=runs` at the same code): Ink Melt
63,347 → 62,377 (−1.5%) at full energy, 56,123 → 59,917 (+6.8%) from zero (a longer Twilight, but her energy
blocked and her ultimate's cooldown started 2 s later); Typhoeus's team 52,374 → 52,641 (+0.5%) / 48,973 → 49,095
(+0.2%). Team pages updated.

**Tests:** kit tests whose buffs are created inside a stop or a combo's slow-down now expect the rest of it
(Akekuri, Ardelia, Lifeng, Mi Fu, Rossi, Wulfgard, Yvonne, Zhuang Fangyi, Laevatain); the search test re-pinned
(Laevatain alone +12.6%). The loop-search tests run Laevatain alone under `buff-in-stop=runs`: with the
longer Twilight she finds no loop in 12 rounds at beam 6 (a lead for the loop search). Holding by ultimates'
stops only (reading `ultimates`) measured worse than by every slow-down (development plain 50.0 → 49.8%,
hold-out 66.1 → 65.9%).

**Dead ends:** see open-problems "Laevatain's Twilight runs longer than its model" (a constant,
show_weapon's 16 s, the full 115-frame pause, a smaller combo hold). Two small Typhoeus misfits
noted there (1cd1 40.12 s, d9e5 11.73 s).
