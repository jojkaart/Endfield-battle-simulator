## 2026-11-18: The owner's in-game test queue from the logs: Stagger recovery, Laevatain's Finisher

**Goal:** the owner: "don't ask me to test things that are easier to determine from logs." Test 110 and every
test in the owner's queue (106, 108, 10, 97, 107, 8, 54, 100, 98, 12, 109) tried on the logs; the queue rebuilt
with only what no log can decide. (The other ready tests are being re-triaged by other agents.)

**Decided by the logs** (each test's section in docs/in-game-tests.md has the evidence):
- **110:** a Stagger lasts about 2 s past PoiseRecTime and the stops in it. 30 windows bracketed within 3 s: the
  log's end a median 2.3 s after the engine's own; with +2 s on the enemy's clock a median 0.1 s off, rms 3.15 →
  1.40 s, 12 short / 13 long (27 / 2 before). Hits don't extend it (Staggers outlast 1.8–7 s hitless gaps and end
  0.1 s after a hit); hit rate, Finishers, Stagger dealt don't explain it. Engine assumption `stagger-recovery`
  (`2s` default, `none`); `stagger-freeze` (held / runs: rms 1.40 / 1.42, undecided).
- **108 (the tap):** the next tap is the Finisher, except in Laevatain's Twilight: 7 Staggers with her Twilight
  chain (2–26 hits each), no Finisher; outside it she Finishers every time. Her kit gates the Finisher off in
  Twilight (the enhanced chain has no finisher in the data).
- **10** (final hit by stacks: 63 of 86 exact, n 1–5), **8** (ordinary combos give no Link: 714 skills after one,
  327 plain without it, 20 of 220 mismatches at ×1.2), **12** (the data's value formula; 5 s with ends scattered
  −1 to +2 s), **107** (buffs held for exactly the stops: the 2026-11-14 damage evidence), **98** (the stew),
  **100** (when: 0–9 s after Rhodagn's HP first falls below 70%, five of five long fights).

**Engine changes, measured:** scoreboard (`npm run snapshots:update`): development and verified unchanged, hold-out
plain 65.0% unchanged (one log mixed), earlier pending mean |damage error| 8.2 → 8.3% (d774: a Stagger the replay
breaks itself at 127.9 s, unlisted, now 2 s longer). The replay follows the log's listing, so the recovery shows in
the simulations, not the scoreboard. Team numbers, 32 fresh seeds (1001–1032), full energy / from zero: the owner's
53,780 → 53,514 / 52,744 → 52,972, → **52,937 / 52,850** with Akekuri's battle skill kept out of her ultimate (below); Typhoeus's 52,374 → 51,859 / 48,973 → 48,937; Ink Melt 63,347 → 62,424 / 56,123
→ 57,486 with the recovery, → **59,140 / 54,421** with the Finisher gate (−5.3% both: the rules had Laevatain
Finisher inside Twilight).

**Tooling:** `BuffReplay.staggerCuts` / `StaggerRun.engineCut` (the engine's own end where the log's calm hit came
first, which `staggerHolds` missed: those windows looked like exact fits), `staggerRuns(data, fx, { assume })`;
engine assumption `combo-window-count` (highest / latest) for test 10: no verdict moves under `latest` in 36 Si
logs, so no log has the case.

**premerge** then failed on tests the 2 s moves (the stagger timeline test, 9090's engine ends), on Laevatain-alone loop
searches (no exact loop in 12 rounds at beam 6 with the recovery: those tests now run under `stagger-recovery=none`,
as they test the loop machinery) and on the owner's team's rules check: Akekuri's battle skill pressed past her
ultimate's interrupt mark ends her ultimate state (seed 2). Her `zone_hold` is a visible state now and the SP ≥ 200
rule waits for it.

**Not decidable / left:** 106 (the buff isn't listed), 97 and 108's dive part (4 dive hits in 79 logs, none in a
row), 54 (dashes not logged), 109 (no Haste logged), 100's trigger, 98's milk: the new queue. Test 12's leftover is
an engine issue: its Vulnerable count at Gilberta's ultimate is one or two low in 4360, 489c, 9847, d572 (the damage
follows the listed value 86 to 24; open-problems). Also found: 4d60 has a 7.2 s whole-game pause (no hit from
anyone, a teammate's chain continuing after it), which the log's clock runs through; bigents' Staggers run 11–14 s
past the data.
