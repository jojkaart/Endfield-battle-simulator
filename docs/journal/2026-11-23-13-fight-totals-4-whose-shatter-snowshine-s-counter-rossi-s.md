## 2026-11-23: Fight totals 4: whose Shatter, Snowshine's counter, Rossi's borrowed crits

**Goal:** the hold-outs' log-only physical status hits (2.08% of a fight none within 5 s, 0.45% by another operator),
Rossi's replay-only Seething Blood extras, Zhuang Fangyi's Sunderblade count in 4d60 (docs/open-problems.md "Fight
totals", round 4).

**Done** (items 13–15 there):
- **Whose Shatter.** A Vulnerable stack joining a running Vulnerable shatters as the operator's who started it
  (BuffData: buff_physical_no_guard's on-stack handler takes the buff's source; 04d4: Catcher's Knock Downs on Ember's
  Vulnerable logged as Ember's Shatters at her value). status.ts `vulnerable.by`.
- **Snowshine's counter.** An end that would drop a pinned landing wasn't reached: the kit trigger's jump past it was
  taken (drivers.ts `eventJumps`; her bash at frame 125 behind an `attacked` jump the replay can't see). 04d4's six
  dropped bashes, their Solidification and four Shatters; 2fd9 −15.6 → −3.6% (plain 188 → 246).
- **Rossi's crits.** A pinned landing took a same-ms sibling's logged crit (landing.ts `loggedCritAt`: its own hit's
  or none); valueCrits read a Stagger's start as a crit (values over their listed effects now). Her replay-only extras
  in 3f78 1.36 → 0.24% of the fight.
- docs/tried/ gets its first file: the casts' order for same-ms hits of two operators (Estella before Chen Qianyu in
  three fights), mixed (4bfc −14 plain).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1%, mismatch 11.7%, mean |damage error| 7.2 → 7.3%;
hold-out plain 77.5 → 77.6%, 8.2% (2 better, 1 mixed, none worse; replay-only 5.2 → 4.9%, log-only 5.3 → 4.9%);
earlier pending plain 63.0 → 63.6%, 4.8 → 4.3%, within 5% 18 → 19; all but the hold-outs 5.8 → 5.6%. Worse: 3f78
−3.4 → −4.8%, 207f −1.2 → −2.9%, 489c −1.2 → −1.9%, 99fb −2.5 → −2.9%: the wrong extras and crits hid Rossi's matched
under-prediction (3f78: −6.6% over 140 matched landings); 04d4 −1.8 → +2.4% (plain 180 → 185) shows Catcher's open
×2.1 build offset the missing Shatters hid.

**Decisions:** Shatter credit as a rule, not an assumption: the data says it and three log cases do, none against
among 42 logged Shatters. The same-ms order dropped rather than limited further: the logs' simultaneous hits are mostly
a stop's end's batch, where no order is shown.

**Left:** the hold-outs' physical misses didn't move (2.08%): not the development logs' mechanisms; next a split by
status kind in measure. Rossi's slash2 extras where her bleed's last tick falls at the slash (bleed clock). Zhuang
Fangyi's 4d60 Empyrean cast: 6 blades where the log has 8, the four counts before all right (the free path's data
next). Slots by value within a cast not started (9a80 checked: the logged final placed on slash #9 by turn order,
one slash fewer in the log).

**Problems:** one multi-line `python3 -c` and one empty heredoc typed from habit (friction report);
`measure --patch` applies to the queued tree, not HEAD, so an "all but one change" patch needs `--at <base>`.
