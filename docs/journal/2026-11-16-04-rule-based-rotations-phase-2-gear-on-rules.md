## 2026-11-16: Rule-based rotations, phase 2: gear on rules

Goal (the owner): gear chosen analytically: find what a team's play
leaves on the table, then the gear that fixes it (too much Ultimate Gain
Efficiency on a damage dealer whose ultimate comes faster than the
supports' it needs). Done (design.md "Rule-based rotations": common
random numbers, crits as a distribution, "Diagnosis, marginal values,
gear on rules"):

- **Common random numbers**: a rule's k-th cue onset draws its delay from
  (seed, the rule's cue and presses, k) only. Owner's team, 10 seeds, sd
  of a per-seed difference: a gear change 64 (independent seeds 4,006);
  two rules swapped 1,097 against 3,174 (the old shared stream 3,836).
  Stratified (Latin hypercube) draws: no clear gain over 20 replicates,
  dropped. Seeded numbers in the docs re-drawn (the owner's list now
  57,096 sd 1,402; Ink Melt 65,922; Typhoeus's 52,088).
- **Crits as a distribution** in `efsim rules` (the lead's addition):
  each run's crit spread from each hit's chance, combined over seeds by
  the law of total variance; mean, sd split delays / crits, 5–95%. Crits'
  sd is 350–380 DPS on all three teams, delays' 550–2,900; none of the
  three has a crit-triggered effect (the code falls back to rolled crits
  for those that do). Replaces the rolled-crit runs.
- **`efsim diagnose`** (engine policydiag.ts, an observer of
  `playRules`; engine statistics `energyGained` by source, `energySpent`,
  `spOverflow`): energy gained / spent / wasted / held (balances), time
  with an ultimate ready but not cast by why, combos lit but unused, SP
  at the cap, other operators' buffs and enemy states on the main damage
  dealer's hits, shares; **marginal values** per operator for one
  gear-line-sized step of each stat the game's T4 gear offers (a fifth
  synthetic piece, paired on common seeds; noisy ones taken to 16
  seeds); findings in plain words.
- **`efsim gear --rules`**: loadouts scored by playing the list (8 seeds,
  16 for noisy gains), candidates from the logs plus swaps and set builds
  proposed by the marginal values, coordinate ascent, a change only
  beyond twice its standard error, the result checked on fresh seeds,
  the diagnosis before and after. Workers (rulespool.ts).

Results (examples keep their gear; team pages' "Gear"):
- Owner's team: Estella's efficiency is the owner's example (worth +0.3%
  ± 0.8 a line, Arts Intensity +5.2%); Akekuri's and Arcane's are
  bottlenecks (+2.9% ± 0.9, +1.3% ± 0.6). Estella Heavy Armor + Grizzled
  Edge Gauntlets +3.7% ± 0.1 (a candidate no log or site had), Si the
  logs' LYNX Slab loadout +3.6% ± 0.8, Akekuri Fiber Gloves T1 +1.7% ±
  0.8: together +8.0% ± 0.9 on 24 fresh seeds. A 60-list rule search on
  the new gear found nothing better than the current list (61,293
  against 61,480). Without rule 10 (spare SP to Akekuri) the list sits at
  the SP cap 165 s of 300 (−19%): the diagnosis shows it at once.
- Ink Melt: Wulfgard's efficiency is the bottleneck (+6.6% ± 1.5 a line);
  Bonekrusha Wristband → LYNX Gloves +3.9% ± 1.0 on 24 fresh seeds, but
  −1.5% on the example's 60 s timeline: example kept.
- Typhoeus's team: Perlica's Probe + Hot Work Power Cartridge →
  Calibrator + LYNX Slab +0.87% ± 0.04 (damage only), +0.3% / +0.6% on the
  60 s rotations: example changed (5,774,076 / 5,019,331; snapshots
  updated). The ascent's biggest gain, Arcane on the logs' Hot Work
  loadout (+5.9% ± 0.7, 24 fresh seeds), flips her to INT mode (Intellect
  813 / Will 363): left to the owner; gear --rules now flags mode flips.

Decisions: a separate `diagnose` command (its ~300 runs need workers,
and gear --rules reuses it); the marginal values' steps are the game's
median T4 line sizes; a change is confirmed on fresh seeds because the
ascent's best-of-many gain is biased up (Ink Melt: +7.3% in the ascent,
+2.1% / +3.9% on fresh seeds). Problems: stats that move the timeline
(Ultimate Gain Efficiency, mode-flipping attributes) stay noisy on common
seeds (±1–2% a line at 4 seeds) while damage-only stats are exact to
±0.1%; the ascent is path-dependent where gains are within that noise (a
first owner's-team run took Akekuri's change first, a second Si's).
Runtimes (4 cores, 3 workers): diagnose with marginal values 3–4 min a
team; gear --rules 18–20 min a team (1,000–1,150 runs of 300 s).
