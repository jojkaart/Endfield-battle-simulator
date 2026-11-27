## 2026-11-27: Statuses per target: a second replay with each landing on its target

**Goal:** on main at 5b08218, beside the interrupted-casts agent: build the design of docs/design/data.md "Statuses
per target" for the several-targets row (6339, 7b54, 9c6e), checking the log's `poise.bar` per target before the
Stagger part; the DEATH lines from the replay's own record and a view of its status record per target (the
target-statuses friction report, points 2 and 1).

**Done:**
- **Engine (replay only):** TimelineScenario.landingTargets and TimelineState.targets (timeline/targets.ts): the
  enemy's statuses per target, `enemy` the current one's. A landing lands on its first target (by ref, else operator,
  event and frame ±1; none: the target hit last) and applies what it inflicts on its other targets too; a burst and a
  status tick run on their own target; the world's holds and stops shift every target's statuses (clock.ts shiftEnemy;
  a freeze the current one's); targetDies `target` runs the death's triggers on that target's statuses, then ends
  them. Records: LandedHit.target / otherTargets, ReactionRecord.target, PendingBurst.target (search KeyRules).
- **Logs:** replay assumption **target-statuses** (`one`; `per-target`, the default): logcheck.ts logBuffReplay makes
  the replay again from the first one's assignment (enginecheck.ts replayTargets: each landing's targets, each kill's
  target; targets.ts targetDeaths one death per killed target); the check reads a hit at its target's Corrosion /
  Electrification / Breach levels (atItsTarget), the second assignment each candidate at its own statuses (statuses
  values there, not units). holdinputs.ts statusInstances and replayrecord.ts's status traces read every target
  (engine everyTarget): 9c6e's Corrosion on a swapped-out target had missed its hidden holds (plain 302 → 310).
- **Views:** BuffReplay.deaths (buffreplay.ts, committed alone for the placement agent); DEATH lines from it, every
  death with its target and the triggers not run (decisionsview.ts deathDecisions); `efsim zmdlogs statuses <fixture>
  [--target n]` (views.ts statusesView): each burst, reaction, consumption and tick with its target, its damage and
  the target's statuses after it, the deaths between. tests/target-statuses.test.ts.

**Found (the Stagger, checked, not built):** the logged bar is its hit's target's: a slug's first logged hit reads its
full bar (60) less its Stagger and its later hits count down (6339 14.80–19.91 s, 7b54 29.50–31.05 and 33.46–36.84 s),
which one bar can't give; the twins at one ms carry one bar between them (9c6e 52.49 s: 73 / 83 on both targets, one
target's 103 − 20 − 10). With 2 Staggered replay landings in the three fights (the log's 1), a bar per target would
move a hit's damage and 7b54's 46.47 s break at most: left (counts: 9c6e 32 of 53 poise hits consistent per target,
26 with one bar; 6339 8 / 9 and 7b54 7 / 7, the target changes falling on fresh slugs).

**Scoreboard** (`npm run snapshots:update`): the several-targets row plain 72.1 → 75.6%, mismatch 14.5 → 11.2%, mean
|damage error| 7.6 → 10.4%, replay-only 13.13 → 12.10%, log-only 19.53 → 17.40%; 7b54 plain 121 → 151 (mismatch 76 →
46), −1.0 → +4.0%; 6339 plain 121 → 122, −10.4 → −16.1%; 9c6e plain 314 → 310, −11.3 → −11.0%. Verified,
development, earlier pending and the hold-outs unchanged (no other log reads it).

**Decisions:** `per-target` the default though the row's mean |damage error| rises: both one-sided shares fall, and
each moved part goes the log's way: 6339's 25.03–28.47 s Combustion ticks were a dead slug's (−3.3 points of
replay-only), 7b54's 16.36 s Si combo twins now fit their slugs (−7.3 points of log-only), Laevatain's Melting Flame in
7b54 comes from each slug's own Heat (her 16–31 and 39–44 s hits match); what they had offset is left uncovered (6339's
Si ink at 19.91 s, 7b54's shielded slugs' replay-only landings), the shape of the tail cuts' adoption. One loss:
6339's 29.26 s Laevatain combo hit (−1.9 points), whose `if` needs Combustion or Corrosion on its slug, which only a
landing the log doesn't show can have given. The second assignment holding each hit to its first-pass target
(enginecheck.ts SECOND_PASS_TARGETS `fixed`, kept for `--set`) measured worse (7b54 plain 151 → 142).

**Left:** a target's statuses from landings the log doesn't show (6339's 29.26 s combo; 9c6e 74.47 s Liino's ultimate
on T6 without the log's Electrification); 7b54's 36.08–36.84 s Laevatain battle skill (×1.2–1.3 high, Scorching Heart
from 31.03 s); 9c6e's 52.80 s Typhoeus burst, whose two targets' values no status gives; the Stagger per target.
