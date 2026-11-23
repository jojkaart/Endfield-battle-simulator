## 2026-11-23: Fight totals 2: an all-fights view, kills from capped hits, missing foods, Typhoeus's shots

**Goal:** the previous round's leads on the fight totals: an all-fights view first, then 4360's kill, fc63's bursts,
3f78's Rossi ultimate slots, a9d7's fight-wide factor.

**Done** (docs/open-problems.md "Fight totals", items 6–9):
- **The view.** `efsim zmdlogs totals --all [--workers n]` (or several fixtures): every fight's error as matched,
  replay-only and log-only shares of its logged total (enginecheck.ts `totalsShares`), largest first, the operators
  carrying it and each group's means; `zmdlogs totals <fx> --by event`. measure's summary gives the same means per
  group, the hold-outs' only view: 12 of 13 hold-outs are one-sided (replay-only 7.3%, log-only 6.2%, |matched| 2.5%).
- **Build offsets.** a9d7's "fight-wide factor" was its team's food (Jakub's Legacy; no log against Si's boss lists
  food, and this one alone had none by hand): fit-build, fixture `buildOverrides`. A screen of every log's per-operator
  median (scratch) found six more: d9e5 every operator's food, 012a, 92b4, c3c7, ad7f, d4fb a node count or weapon
  level, each confirmed by fit-build with its clean hits.
- **Kills.** A capped last hit makes a fight a kill (the stages scale the data's HP), and the killing frame is the
  replay's landing of a killing hit when sooner (4360's returning lances +6.5%).
- **Placement.** An ultimate's fewer landings take their slots by time (3f78: Rossi's slashes); an off-field-only hit
  isn't placed while the log shows its operator controlled, and a cast with a delayed landing logged isn't joined by an
  earlier frame's landing (Typhoeus's 4th shot read as her 5th in seven logs).

**Scoreboard** (`npm run snapshots:update`): development plain 66.4 → 67.1%, matched 80.7 → 83.4%, mismatch 14.4 →
11.7%, mean |damage error| 8.1 → 7.3%, within 5% 21 → 24; hold-out 77.5%, 91.8%, 6.3 → 6.2%, 9.1% (2 better, 1 mixed);
earlier pending 60.4 → 62.7%, 81.7 → 84.9%, 17.7 → 14.8%, 5.3 → 4.9%, within 5% 17 → 18; verified 99.1 → 99.3% matched,
1.8 → 2.0%; all but the hold-outs 6.5 → 5.9%, within 5% 44 → 48. Better: a9d7 −18.5 → −5.0%, d9e5 −11.5 → +0.2%, 4360
+6.9 → +0.5%, 3f78 −8.0 → −3.4%, fc63 +7.2 → +6.8%, d4fb, 012a, c3c7, ad7f, 92b4 by plain. Worse, each explained:
2fd9 −13.1 → −15.6% (replay-only landings at the kill's frame had hidden Mi Fu's Crush ×1.90), dbae −2.3 → −2.6%
(the kill likewise), bdf2 −0.1 → −0.7% and 9090 −0.6 → −0.9% (the 5th shot's burst now placed right, without the
Hovering ATK the log gives it: open).

**Decisions:** build offsets as fixture overrides only with fit-build's clean-hit counts (Chen in a9d7 has no clean
hit: her teammates' food, said so). Hold-out aggregates only in measure (the CLI keeps refusing hold-outs). No engine
or kit change: no team fight moves, so no team-ab.

**Left:** the hold-outs' one-sided landings; 2fd9's Crush stacks; fc63's arrows after the hovering ultimate; the 5th
shot's burst's Hovering ATK; Chen's readings (d4fb, a9d7); e82d's Si combo listing.

**Problems:** one multi-line `python3 -c` slipped through (friction report); with-lock's done line went into a
redirected stdout JSONL, so a wait on the stderr log would never have ended.
