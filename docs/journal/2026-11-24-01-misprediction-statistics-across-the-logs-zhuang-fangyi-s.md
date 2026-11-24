## 2026-11-24: Misprediction statistics across the logs; Zhuang Fangyi's Empyrean combo key

**Goal:** the owner's ask: one statistical pass over every log's mispredictions (not one log or operator at a time),
ranking candidate causes that could each explain a large share; analysis, not fixes, but for a certain one.

**Done:** scripts/probes/stats/: build.ts (every development log's hits with the check's verdicts, readings, zones,
differences, features, and counterfactual readings: each listing difference taken the log's way, the crit flipped,
boundary kit buffs on and off; one-sided landings; fights), analyze.py (first explanations, ratio clusters, buffs by
mechanism, features with fight bootstraps and within-fight shuffles, a tree and lasso held out by fight group,
one-sided kinds, fight-level features), bands.py, holdout-aggregates.ts (aggregates only). The write-up:
docs/analysis/2026-11-24-misprediction-stats.md; open-problems "Misprediction statistics".
- Stage logs aside, the off hits' error is one kit buff the replay has wrong at the hit (the listing right) 20.4%,
  alternatives or the listing with alternatives 30.2%, Corrosion 8.5%, unexplained 35.1% (in known fight-operators).
- **Fixed:** Zhuang Fangyi's Empyrean combo is logged under the base combo's key (Stagger origin combo_skill_ult):
  21 hits ×1.500 = 5.4 / 3.6, 4.3% of the error, the largest single cause. The kit's Empyrean combo hit carries the
  base key now.
- Leads: two weapons' "ready" buffs on ultimates (2.8%, 6 fights), the rest of the ×1.5 band (Liino's ultimate
  windows, Alesh's ultimate; 6.9% of the hold-outs' error), boundary effects as a marker of state changes (off 42.8%
  against 24.2%, explaining 1.8% themselves), a weak drift with time (34 of 57 fights), Liino's factors in 7910, af7b.

**Scoreboard** (`npm run snapshots:update`, the kit fix): development plain 67.1%, mismatch 11.7 → 11.6%, mean
|damage error| 7.3 → 7.2%; hold-out 77.6%, 6.2%, 8.2 → 8.0% (1 better); earlier pending plain 63.6 → 63.7%, mismatch
14.5 → 14.3%, 4.3 → 4.5%, within 5% 19 → 18 (3aa6, 4bfc better; d774 +3.8 → +7.2% and c6d8 mixed, per hit closer:
the combos' ×1.5 hid d774's replay-only Empyrean strikes); all but the hold-outs 5.6 → 5.7%. Teams (team-ab against
e5f22ef): every team's fight the same.

**Decisions:** the analysis at e5f22ef's code (the tables built in an at-commit tree), the hold-out confirmation after
the fix; grading a crit-less hit on the nearer of its two crits, a capped hit on its uncapped value; the off rate
beside the error share, since the error favours big hits; the stage logs left out of the attribution.

**Dead ends:** the error-weighted feature shares alone (Stagger, ultimates, the fight's last tenth) looked like
causes and were mostly hit size; the tree screen finds nothing that generalizes across fight groups.
