## 2026-11-13: Damage distributions, Ardelia's random sheep count

Goal (the owner's design, the lead's brief): a result is a distribution.
Done: `moments.ts` (five additive fields per outcome: min, mean, max, var,
m3; crit hits, sums, mixtures, compound sums, hypergeometric thinning,
battles combined by the law of total cumulance, Cornish–Fisher 5 / 95%);
`HitDamage.critSpread` and `TimelineResult.moments` (one battle, mean =
its total to the double); `distribution.ts` `simulateDistribution` (K = 8
seeded battles, `--battles k`, only with dodges, chances or crit triggers;
crit mode `distribution` rolls just the hits a crit trigger could fire
on); `KitHit.landedCount` (schema, loader, Ardelia's sheep: 21 counted
casts); `efsim simulate` prints mean ± sd, the 5–95% range and bounds.
Mid-task change (the owner via the lead): min / max are two deterministic
battles, crits never with the fewest landings and always with the most
(assumes crit-triggered effects only raise damage). Totals: only
ardelia-corrosion moved (152,724 → 114,744: sheep × 6.1 / 11); Yvonne's
mean over 8 battles is 476,299 against the one expected battle's 403,505
(her gear's crit trigger never fires there). Monte Carlo (400 rolled
runs) agrees: design.md "Damage distributions". Left: the search still
ranks crit teams over rolled battles and its `--percentile` is the seeds'
nearest rank; the lead's follow-up (crit-triggered buffs at their
expected state, one battle); sheep Stagger at its expected value and hit
events on every planned landing; Rossi's never-crit bound is 268,669
against a mean of 1.17 M (her kit lives on crits: a loose bound).
