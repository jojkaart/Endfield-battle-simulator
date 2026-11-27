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
