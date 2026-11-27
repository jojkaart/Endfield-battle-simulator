## 2026-11-26: Arcane's mismatches: a stage's damage factor from the fixture

**Goal:** the by-operator table's largest pool of mismatches, chr_0032_lizhiyan (5688 hits in 40 fights, 12.3%
mismatch, share-weighted |damage error| 13.0%), grouped by cause and fixed. The brief called her Akekuri; the numbers
and the file are Arcane's (Akekuri is chr_0019_karin: 202 hits in 2 fights, no mismatch), so Arcane was the work.

**Done:**
- **Grouped** (`zmdlogs groups --operator Arcane`): 697 mismatches, 492 of them 8915's (292) and c6d8's (200), the two
  stage logs whose every hit sits at one round factor. scripts/probes/stage/stage-factors.ts (runs of hits at one
  team-wide logged ÷ reading over every log): 8915 ×0.500 to 37.71 s (228 of 261), ×0.050 at 38.45–39.72 s (15 of 15),
  ×0.200 at 41.01–85.93 s (274 of 285), all four operators; c6d8 ×0.100 from 15.75 s to the boss's Stagger break at
  75.59 s (334 of 413). Nothing else in any development log is a round factor (the other runs are buffs: 1d91, fc63,
  4d60, 7b54's slug).
- **A fixture's `stageFactors`** (zmdlogs.ts StageFactor, schemas/log-fixture.schema.json; hand-written windows with
  their evidence, as buildOverrides are): enginecheck.ts `stageModifiers` puts the factor into the multiplicative zone of
  every reading of a hit logged in the window (readingBasis), of the log-listing readings (logcheck.ts) and of the
  replay-only landings in the fight's totals; the `replay` view's LAND lines show the staged damage beside the replay's
  own. tests/stage-factors.test.ts. c6d8's OFFSETS_EXPLAINED entry (Perlica ×0.1) dropped: no offset left.
- Arcane's mismatches 697 → 233.

**Scoreboard** (`npm run snapshots:update`): development plain 76.2 → 79.2%, mismatch 10.2 → 6.9%, mean |damage
error| 4.9 → 3.1%; earlier pending plain 77.7 → 80.6%, mismatch 11.3 → 7.7%, 3.4 → 1.5%; verified and hold-out
unchanged (no fixture there has the field). Better: 8915 (plain 157 → 651, mismatch 614 → 67, +62.3 → +6.8%), c6d8
(125 → 467, 436 → 14, +43.9 → +0.5%); no log worse. Arcane's row: plain 77.8 → 85.1%, mismatch 12.3 → 4.1%,
mean |damage error| 9.2 → 4.2%, share-weighted 13.0 → 2.8%. No kit or engine rule changed: no team-ab.

**Decisions:** a fixture field, not a rule the check infers: the factor comes from the hits' values, which the check
grades, so it is written once, reviewable, from all operators' hits at once and at round values (×0.5, ×0.05, ×0.2,
×0.1), and never fitted per hit or per operator. Hold-outs get none (they aren't opened); their stage logs, if any,
stay uncheckable, which keeps their row honest. A window runs to the next window's first hit; c6d8's ends at the
break (roadmap-details had "the Abyss boss's ×0.1 until its Stagger"). Not simulated: no data gives the shields.

**Left** (docs/open-problems.md "Arcane's mismatches after the stage factors"): 1d91's ×0.965 / ×0.929 / ×0.894
steps (Liino's lane: her buffs unlisted there), fc63's Corrosion 89–110 s (`window-reaction`, test 33), 7b54's slug,
9c6e's two targets; new in 8915 now that it reads: a Corrosion ramp step and Hot Work's Nature end 0.1–0.3 s earlier
in the game than in the replay after Liino's and Si's combos pressed together (7.07–8.90 s).
