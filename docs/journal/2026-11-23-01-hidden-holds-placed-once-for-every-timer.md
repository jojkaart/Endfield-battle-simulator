## 2026-11-23: Hidden holds placed once for every timer

**Goal:** the buff clock's next step (docs/journal/2026-11-22-03-the-buff-clock-unlogged-world-holds-keep-buffs-past-their.md):
estimate where each fight's unlogged world holds fall from every clock the log shows, hold every timer there once, and
see whether the holds, read as perfect dodges, explain the Team SP shortfall.

**Done (open-problems "The buff clock", "Placed"):**
- packages/logs holds.ts: one hidden clock P per fight. Bounds: each buff that ran out in a first replay without holds
  against the log's run of it (lateness at its last listed hit, at most by the next hit without it, in world time past
  the expiry), the enemy's tick series as chains (Combustion, Rossi's bleed, Typhoeus's combo field, Aurora's
  ultimate); P rises no faster than real time and not in the Stagger. Difference constraints, a conflicting bound
  dropped; the least total hold, midway between the earliest and latest placement. `efsim zmdlogs holds <fixture>`.
- The replay holds the world's clock there (engine timeline/clock.ts `holdWorld`: buffs, the enemy's statuses and
  debuffs, combo windows; not cooldowns, SP or the operators' timing), then keeps listed buffs to the log's end.
  Engine assumption `hidden-holds`, new default `placed` (`holds`: the holds alone). BuffReplay.spTopUps: the SP
  replayCast raises at each cast.
- Scoreboard (`log` → `placed`): development plain 59.9 → 62.8%, mismatch 16.4 → 15.6%, mean |damage error| 9.2 → 9.1%,
  within 5% 14 → 16; hold-outs 69.6 → 69.9%, 6.7 → 6.6%, 11.0% unchanged (2 better, 1 worse); earlier pending 53.1 →
  54.0%; verified 75.6 → 77.4%; all but the hold-outs 57.5 → 59.6%, 18.8 → 18.3%, 8.1 → 8.0%, within 5% 31 → 34.
  Development 12 better, 2 worse (a27b, ad7f: damage only), 11 mixed; worse elsewhere d572, 0c14 (Wolven Blood layers
  held to max stacks early; d572's Corrosion ramp a step behind), de6a (a 4% buff held 0.1 s past a hit). Team-ab
  against 6b117c1: every team's fight the same.
- How well determined: 108.6 s of holds in 5,899 s of the 60 logs (1.8%), 211 units of 0.512 s, 50 placed within 1 s,
  92 within 3 s, every one spanned by a kept clock (median 3).
- SP: the holds as dodges (185, 1,295 SP) cover 87 of the 1,766 SP the replay lacks: the shortfall is where the clocks
  place nothing (04d4, 6339, db87, 79cc). Not the gap; no evidence for or against the dodge reading.
- The dodger's own 0.315 s (the data's layer 1): pairs of runs on one window, owner controlled or not, ratio median 1.12
  (62 pairs), not 0.62: no sign of a dodger's clock on its buffs.

**Decisions:** the world's clock alone: holding the operators' clocks too (slowDown, nobody exempt) moved kit-timed
landings off the log's (bdf2 lost a Nature burst to one frame of hold; verified damage error 1.9 → 3.2%). The midpoint
rather than one extreme: it's feasible and splits the uncertainty. The log's ends stay on top: they are facts, the holds
an estimate.

**Dead ends:** bounds from the run's end less the expiry in real time: holds then carried b6aa's Xaihi debuff 2.8 s past
the log's end (the stops after its old expiry held it again); world time past the expiry fixed it. The first pass kept
buffs to the log's end (its `log` ends were on) and so saw no lateness at all. A cap of world time per span dropped
489c's Si's Amp (3 s of holds inside three overlapping ultimates' stops).

**Left:** test 111; Corrosion's listed ramp levels and Wolven Blood's layers as clocks; pauses (12 units in hitless
spans) and overlapping ultimates' stops, which a dodge can't be; Gilberta's tower-boss Vulnerable stacks and Arcane's
seal unchanged by the holds.
