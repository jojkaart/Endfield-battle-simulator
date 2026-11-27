## 2026-11-27: Status landings paired by value; two-target fights marked

**Goal:** the status landings' pairing (BuffReplay.statusLanding: a logged Arts Burst, Combustion tick or other
status hit took the nearest replay landing within 16 frames, in time order) as a value-based assignment, so a burst a
stop held 0.55–0.85 s late still pairs with its own landing (the log-only round's lead, c779's crossed pair); 9c6e's
two targets marked so they stop weighing on the development means; beside an agent on placement cases (its files
untouched here).

**Done:**
- **One assignment per operator, kind and element** (packages/logs/src/statuspairs.ts pairStatusLandings, engine
  assumption `status-pairing`, default `assignment`; `nearest` the old pairing): over stretches without a gap of more
  than 60 frames, the pairing with the most pairs (a Hungarian method, each logged hit with a "none" column), then the
  least frames apart, a landing whose value doesn't fit counting 60 frames more; a landing 16–60 frames away only
  where its value fits within 1% (statusValueFits: the landing's damage again from its inputs under the log's crit
  flag, times the fixture's stage factor, against the uncapped logged value). c779: logged 9.68 s now takes the
  replay's 9.27 s and 10.08 s the 10.03 s (was 9.68 → 10.03, both others one-sided). `zmdlogs bursts --all`: one-sided
  bursts 31 log-only / 40 replay-only → 19 / 28 at 30 frames, and four more pairs at 60 (c3c7 22.32, c83c 32.31, 79cc
  24.23, 3aa6 12.31 s: 1.5–2.1 s late, equal values).
- **9c6e marked `severalTargets`** (fixture field with its evidence, schema, LogFixture; snapshotentry.ts emits the
  describing key `several targets`; scripts/accuracy.ts withSeveralTargets puts such a pending log in a row of its
  own; measure.ts's overlay keeps the mark). The evidence (scripts/probes/targets/two-targets.ts): Typhoeus's Nature
  burst logged twice within a frame nine times (79.85 s: 143,320 and 33,858 at one ms, both capped from one uncapped
  412,733) and eight kills with hits going on to 95.6 s. No other development log has the shape: the slug's kills
  (6339, 7b54) are one enemy's lives and phases; b7b3 10.91, c4f3 7.05 and db87 14.01 s have one status twin each and
  no kill.
- tests/status-pairing.test.ts (the assignment on c779's shape and on the log, the value-gated window, the mark's
  group); docs/design/data.md, fixtures/multi-target/README.md, docs/tried/2026-11-27-status-value-fit-10.diff.

**Scoreboard** (`npm run snapshots:update`, against main at 107766a). The reclassification alone (main's snapshots
with 9c6e in its own row, scratch only): development plain 81.5 → 82.4%, mismatch 6.3 → 5.9%, mean |damage error|
3.4 → 2.9%, 32 → 31 fights; its log-only share 3.13 → 2.02%, replay-only 3.61 → 3.33% (not an accuracy gain). The
pairing on top: development plain 82.4 → 82.5%, replay-only 3.33 → 3.15%, log-only 2.02 → 1.84%, |matched| 2.28%
unchanged, one-sided fights 21; hold-out plain 82.6 → 82.7%, replay-only 2.9 → 2.7%, log-only 5.0 → 4.8%, |matched|
2.0% unchanged, one-sided 11 → 10; earlier pending plain 81.6 → 81.7%, 1.1 → 1.0% / 0.9 → 0.8%; verified plain 78.2 →
78.4% (40d9 +1). As the scoreboard has it: development 82.5%, 5.9%, 2.9%; the new row 1 fight, 48.1% plain, 20.6%.
Better: 489c, 79cc, 9c0b, af7b, c779, c83c, db87, f978, 0c14, 3aa6, 458b, 9555, d572, 40d9, four hold-outs; mixed:
7910, f879, c3c7 (plain +1 to +4, mismatch down, their totals 0.1–0.2 points further: a status hit now paired whose
landing's value differs slightly from the one-sided pair's), none worse. No simulation reads the pairing (log check
only): no team-ab.

**Decisions:** a field the scoreboard reads, not a move to fixtures/multi-target/: the check runs 9c6e usefully as one
target (200 plain, the kill gaps' tests), its snapshot stays pinned and no key or test path moves. The 60-frame window
over 30: measured with --patch, 7 logs and 2 hold-outs better, none worse. The value fit at 1%: the replay's value is
the replay's own, so a burst landed before a buff the game's had is off by that buff, and 10% was mixed (the ticks of
one Combustion share a value and traded places): docs/tried/2026-11-27-status-value-fit-10.diff.

**Left:** pairs whose replay value a buff's edge puts off (1d91 50.47 / 51.02 s ×1.095, 7b54 46.70 s, a7a7 39.27 s,
e989 86.65 s, 7910 28.27 s, abfd 100.93 s): the fit judged by the check's reading of the pair; 9c6e's second target
itself (the engine has one); the slug's unlogged hits (lead 3, not reached).
