## 2026-11-27: Several targets read per target

**Goal:** the scoreboard's worst row, the three fights against several targets under one id (6339, 7b54: Hard 33's
eight slugs; 9c6e: Hard 31's two Wanderers), on main at 0366a35 beside an agent on casts across a Stagger break: the
per-target state the log check needs, built for the replay, and what stays one-sided.

**Done:**
- **Design** (docs/design/data.md "Several targets"): the simulation keeps one enemy; the check holds the targets. A
  probe first (scratch, not kept): of 7b54's 204 hits with a landing, 65 fit their primary reading and 115 fit with
  some of its enemy-side units left out, and the trial assignment's targets held their states over later hits
  (Camille's 26.98–29.36 s hits all without Jade Vessel).
- **packages/logs targets.ts** `assignTargets`, read through enginecheck.ts `fightTargets` (engine assumption
  `several-targets`, default `targets`): each logged hit on a target (two hits one landing stands for at one ms on
  two; else the alive target its value fits, the one hit last first, a new one only when none fits; a capped hit kills
  its own); each target's units (enemy kit buffs, Corrosion / Electrification / Breach) as the replay's instances: one
  it got kept to its expiry, one it was read without never later, an open one decided by the first hit that only one
  choice fits. `readingBasis` drops the units a hit's target lacks; `killPurges` none (a kill ends its own target's:
  buffreplay.ts's one line, committed alone); the replay's enemy stays through a kill gap with targets left
  (fixture fields `severalTargets.atOnce`, `fromStart`; schema), whose landings the totals leave out; the totals count
  a landing once more for each twin on another target whose value fits it.
- tests/several-targets.test.ts; tests/slug-targets.test.ts under `one`; the evidence in docs/design/assumptions.md.

**Scoreboard** (`npm run snapshots:update`): the several-targets row plain 54.1 → 68.5%, mismatch 27.6 → 15.4%, mean
|damage error| 20.0 → 16.1%; 6339 better (plain 108 → 115, −19.7 → −10.3%), 9c6e better (244 → 314, mismatch 94 →
33, −24.5 → −11.3%), 7b54 mixed (65 → 99, mismatch 116 → 83, +15.7 → +26.8%: its replay-only landings read with the
one enemy's debuffs, which no kill purges now). Development, earlier pending, verified and hold-outs unchanged (no
other log is marked); no simulation reads it: no team-ab.

**Decisions:** the values decide a hit's target, as they decide a crit the log leaves out: the log has no target per
hit and lists every target's debuffs under the one id; the persistence (an instance kept, one missed never had
later) is what makes it evidence rather than a fit per hit. The totals' copies are gated on the twin's fit: ungated
the row's mean was 26.3% (7b54 +61.3%: Si's combo finals the placement paired with slashes, once per slug), as one
target 20.9%. Kill gaps kept: 6339 gets Camille's Vesperwings at 14.09 s as the log lists, and her weapon's Heat DMG,
which it doesn't (a shielded slug takes no infliction): measured `targets-gaps-away` (one plain, 2.3 points of total
the other way), kept for the log's listing.

**Left** (docs/open-problems.md "Hard 33's Woodcraft Slugs"): the placement's twins (7b54's Si combos: logcasts.ts,
the other agent's; friction report point 1), statuses' levels, bursts and Stagger per target (9c6e's second
Wanderer's bursts), a shielded slug's landing (0 damage, no infliction, buffs applied), Camille's uncovered battle
skill hits in 6339.
