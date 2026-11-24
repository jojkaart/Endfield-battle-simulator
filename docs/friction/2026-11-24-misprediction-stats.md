# Misprediction statistics (2026-11-24)

Task: a statistical analysis of the simulator's mispredictions across every development log (ranked candidate causes
with evidence, hold-outs as aggregates only), and a fix for a candidate that turned out certain (Zhuang Fangyi's
Empyrean combo key). Branch worktree-agent-a72af0fe24c692b31, base e5f22ef.

## 1. No per-hit record with "why it's off": the analysis had to rebuild the check's internals

- **What happened:** `zmdlogs hits --json` gives the verdict, the primary reading and the differences, but not what
  the analysis needed most: which single disagreement with the listing, taken the log's way, makes the hit fit. I
  wrote scripts/probes/stats/build.ts, which copies hitRecords' composition (placeHits, logBuffReplay, engineHits,
  checkLog, engineReport, readingBasis, landingDamage) and re-derives the edge toggles' modifier swap
  (`loggedEntries` over one kit buff group's names) to read each difference, the crit flip and each boundary kit buff
  on / off. Getting it right took four builds (the killing blows' capped values, then a column name clash, then the
  boundary counterfactuals); about an hour.
- **Cause:** the check computes these alternatives internally (readingBasis groups) but only exports the one that
  matched; the per-difference counterfactual isn't a concept any view exposes.
- **Suggestion:** a `counterfactuals` field on HitRecord (hitexport.ts): for each LogDifference, the reading with that
  group as the log lists it, plus crit flipped and Stagger toggled; and `zmdlogs explain <fx…|--all>` printing each off
  hit's first explanation (one difference / listing / boundary / fight-operator factor / class), with the per-class
  shares measure could also report for the hold-outs.
- **Why it helps:** the analysis's largest class (20.4% of the error, the hold-outs' 34%) is exactly "one difference
  the log's way fits", and any future diagnosis of a buff starts from that list; with the field, build.ts shrinks to
  feature extraction.

## 2. Grading a hit: crit-less hits and capped hits aren't graded the way the check grades them

- **What happened:** my first error table put 10.7% of the error on plain matches: they were killing blows, whose
  `value` is capped while the check grades `uncapped`. Crit-less hits (`crit: null`) needed a choice too (P against
  P × (1 + Crit DMG)), which HitRecord's `predicted` doesn't make (`expected` is the mean).
- **Cause:** HitRecord has `value`, `uncapped`, `predicted`, `expected`, `verdictReading`, `logReading` with
  different conventions; nothing says which pair is "the engine's error on this hit".
- **Suggestion:** one HitRecord field, `graded: { logged, predicted }`, the pair the check judges (uncapped, the crit
  the log gives or the nearer one), documented in hitexport.ts's header.
- **Why it helps:** every cross-log statistic starts from it; a wrong pair silently moves a tenth of the error.

## 3. Analysis at one commit while fixing at the next

- **What happened:** after the Zhuang Fangyi fix was in the working tree I needed the tables at e5f22ef's code.
  `scripts/at-commit.ts` made a tree, but a probe edited later had to be copied into scratch/at/<hash>/scripts/probes/
  to run there (CLAUDE.md says never copy source over a tree for an A/B; a probe isn't source, but the rule doesn't
  say).
- **Cause:** at-commit trees run their own committed probes; there's no way to run the current probe against another
  commit's packages.
- **Suggestion:** `node scripts/at-commit.ts <ref> --run <script> [args]`: run a script from this tree with the other
  tree's packages resolved (NODE_PATH or a loader), or a sentence in CLAUDE.md that copying a probe into an at-commit
  tree is fine.
- **Why it helps:** "measure at the base, fix at HEAD" is the normal shape of an analysis round.

## 4. A kit field override took four tries

- **What happened:** adding a logged key to `combo_skill_ult`'s hit: first "no frames, and the data's landings aren't
  one branch path", then (frames written) "events differ from the compiled SkillData", then (frames and events in
  dataOverride) "frames marked as differing but agrees". Only frames written plus `dataOverride.events` passes.
- **Cause:** the compiler's checks run one at a time and each message names only its own rule; that writing a field
  can make it agree (so it must not be in dataOverride) isn't said up front.
- **Suggestion:** when a kit hit's `events` differ from the data, the error could say in one message: "write
  `frames` (the data can't place a landing for a key of another skill), and mark `events` in dataOverride".
- **Why it helps:** variant keys shared with a base skill (this round's finding) are the likeliest next kit edits.

## 5. analyze.py's feature tables are slow (6 minutes)

- **What happened:** the fight bootstrap (300 resamples) and within-fight shuffles (20 × 2) for 50 rows run in pure
  pandas loops; I ran sections separately while iterating.
- **Suggestion:** vectorize the bootstrap (fight-level sums once, resample the sums), and keep the section argument.
- **Why it helps:** a next round re-running the analysis after fixes can do it in a minute.

## 6. A test pins one log's total, which measure and snapshots:update don't run

- **What happened:** the kit fix measured clean and snapshots:update passed, then premerge failed on
  tests/logcasts.test.ts: the enemy-away test asserts d774's total within 6%, which the fix moved to +7.2% (explained:
  the combos' ×1.5 had hidden replay-only strikes). A second 8-minute premerge after a one-line bound change.
- **Cause:** totals bounds of particular logs live in feature tests, beside the snapshots that already pin every log's
  total; snapshots:update runs only the log suites.
- **Suggestion:** such tests assert the feature's effect (away against counted: the difference), not the log's total;
  or snapshots:update also runs `npx vitest related` over the tests naming the logs whose totals moved.
- **Why it helps:** a verdict-moving change finds its knock-ons in the step that is meant to show them.

## What worked well

- The worker-thread builder: 61 fights in about a minute, so rebuilding after every idea was cheap.
- `poise.origin` in refreshed fixtures: it named the Empyrean combo outright.
- `measure` and `snapshots:update` reporting mixed logs with the per-hit fit: d774's worse total was explained in one
  `zmdlogs totals` call.
- `scripts/edit.ts` for every doc and code edit: no shell text damage this round.
