# Mostly-mismatching operators: build fits under the screen (2026-11-27)

Task: diagnose the operators whose hits mostly mismatch (Ember, Snowshine, then Alesh, Avywenna, Catcher) and fix
what the logs decide; branch worktree-agent-a3e7b4de355ae8803.

## 1. The build-offset screen hides small exact offsets

- **What happened:** Ember's 80% mismatch in 04d4 and Alesh's 100% in 4e36 were each one exact factor on every hit
  (×1.0226, ×0.9745), each fixed by one single-change fit (weapon skill 1 at 9; two attribute nodes) in minutes.
  `zmdlogs offsets --all` listed both rows (+2.3% tight 60%, −2.6% tight 97%) without the `*`, because
  `OFFSET_SCREEN.minOff` is 3%; the slow test never failed on them, and earlier rounds had read Ember's ×1.0226 as
  "her build offset" in docs/open-problems.md for weeks without fitting it.
- **Cause:** the screen's threshold is on the factor's size, but the check's tolerance is ±1 damage, so any offset
  above ~0.1% on a tight row makes every hit a mismatch. A 2% offset costs as much accuracy as a 20% one.
- **Suggestion:** in packages/logs/src/buildoffsets.ts make a row a candidate when it is tight (≥ 60% within 1%) and
  its median is off by more than the check's tolerance on its median hit (e.g. 0.3%), not 3%; print the candidates
  sorted by hits mismatched. A row that fit-build can't fit then needs its OFFSETS_EXPLAINED entry, as Snowshine's has.
- **Files:** packages/logs/src/buildoffsets.ts, tests/slow/ (the build-offset test).
- **Why it helps:** the cheapest accuracy gains (hundreds of hits per log) surface as a failing slow test instead of
  waiting for a by-operator scan. Risk: a few more OFFSETS_EXPLAINED entries for stage logs.

## 2. fit-build's "best" list ranks multi-input fits above the single change that fits exactly

- **What happened:** for Ember, `fit-build 04d4 --operator Ember` printed a food (116 of 284) and three-input sets as
  "best"; the exact single change (weapon skill 1 at level 9, which fits 170 of 284 and every clean hit) appeared
  only under `--pairs` as "the wider space … ATK only", unscored. I had to add the override and rerun to learn its
  score.
- **Cause:** the scored search covers nodes, weapon level and food only; weapon skill levels, potential and gear are
  in the unscored ATK-only space.
- **Suggestion:** score the wider space's single changes (at least weapon skill levels) by the same clean-hit test
  and merge them into the "best" list; mark each candidate with its number of changed inputs.
- **Files:** packages/logs/src/buildfit.ts, packages/cli/src/commands/zmdlogs.ts (fit-build output).
- **Why it helps:** the evidence for a buildOverride comes from one command instead of a fixture edit and rerun.

## 3. No view for "one factor fits every clean hit within ±1"

- **What happened:** to tell a real single factor from a coincidental median, and to bound it tightly enough to rule
  builds in or out (Snowshine's [0.96232, 0.96258]; Catcher's DEF strikes [1.02649, 1.02786]), I wrote
  scratch/fine.ts over `zmdlogs hits --json` (logged ± 1 over `landing.exact`, intersected).
- **Cause:** offsets and fit-build give medians and fit counts, not the feasible interval of the factor.
- **Suggestion:** a `--bound` option on `zmdlogs offsets` (or `hits --operator … --event …`) printing, per operator
  and event, the interval of factors that put every clean hit within ±1 (empty: not one factor).
- **Files:** packages/logs/src/buildoffsets.ts or packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** a build candidate is checked against one interval in a line, and an exact ATK question
  (Snowshine's) is closed without a scratch script.

## 4. A DEF-based hit's base isn't shown with its parts

- **What happened:** Catcher's P1 strikes read `zones.atk` 1457.6 in `hits --json`; finding that this was
  300 + 5 × (160 × 1.252 + 31.2) took reading three kit files, BuffData trees and computing by hand.
- **Cause:** a hit with a `base` expression records only its value, not the attribute it read and that attribute's
  panel line, buff points and percentages.
- **Suggestion:** in a landing's record (`hits --json`), for a hit whose base reads an attribute, add the attribute's
  breakdown (panel total, buff points by buff, percentages by buff).
- **Files:** packages/engine/src/damage.ts (landing record), packages/logs/src/views.ts.
- **Why it helps:** a DEF- or HP-scaled hit's misfit points at its input directly.

## What worked well

- `zmdlogs groups --operator` and `differences` split each operator's mismatches into one factor vs. listings vs.
  stretches in one call; the per-event median ratios made each cause obvious.
- `fit-build --pairs` listing exactly one single change was decisive evidence for Ember.
- `npm run measure` with no reference compared against the right snapshots and named the two better logs.

## Outcome (round 20)

- 1 (The build-offset screen hides small exact offsets): done (f96773c): OFFSET_SCREEN minOff 3% → 0.3% and 2 damage
  on the row's median hit (the check's ±1); the view's `mism` column, candidates by their mismatches. No development
  row sits between 0.3% and 3% now (Ember's and Alesh's were fitted), so no OFFSETS_EXPLAINED entry was needed; the
  slow suites hold the new screen.
- 2 (fit-build's "best" list ranks multi-input fits above the single change that fits exactly): done (f96773c): each
  weapon skill level and potential is scored as a single change beside the combinations, each candidate marked `[n
  inputs]`; 04d4's Ember without her override finds weapon skill 1 at level 9 first (tests/buildfit-fit.test.ts).
- 3 (No view for "one factor fits every clean hit within ±1"): done (f96773c): `zmdlogs offsets --bound` (factorBounds:
  per operator and event the interval, empty with the factor fitting most).
- 4 (A DEF-based hit's base isn't shown with its parts): done (f96773c): `hits --json` landing.base (the expression,
  each attribute's panel line and sources, the fight's buffs on it, the reading's in-fight total), computed in
  hitexport.ts from the landing's inputs and the replay's state, not an engine record.
