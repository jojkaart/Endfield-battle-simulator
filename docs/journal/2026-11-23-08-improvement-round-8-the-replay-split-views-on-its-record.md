## 2026-11-23: Improvement round 8: the replay split, views on its record

**Goal:** the eighth friction round over the five open reports (round 7's backlog and its own report, ticks and layers,
the hold-out refresh, the remaining leads), behaviour-preserving, with no other agent in the code: so the replay's
run() refactor and the engine-clock points earlier rounds had left could be taken. Summary:
docs/friction-done/2026-11-23-round-8.md; what's left: docs/friction/2026-11-23-backlog-after-round-8.md.

**Done:**
- The replay's run() is `replayOnce(input, pass)` (buffreplay.ts), its steps in replaysteps.ts, what it records in
  replayrecord.ts (replayRecorder). Measured byte for byte. Every new view output below was then an edit to the record.
- Views: a kit window's chain (`replaces`: "refreshes the one from"), enemy-status traces (`replay --trace-buff
  status:<s>`, a moved application named a hold, the log's runs as LANE), `replay --stops` (the timeline's applied
  slow-downs against the log tools' lists), the crit each landing took and its source (`hits --json`, `--zones`, LAND
  lines), INSIDE judged by the gates alone with CUTS for a legal interrupt (78 of 169 former INSIDE flags), `zmdlogs
  totals` (matched, replay-only and log-only parts), `holds --why`'s log-end side, "same totals (cosmetic)" values.
- Tools: `measure --patch <diff>`, held frames per slow-down (`gamedata dilations`, `efsim kit`), `runstate
  --touching`, RefreshMismatch.values (printed by `zmdlogs refresh` for development fixtures), merge.ts and
  premerge.sh printing hold-out paths as counts, CLAUDE.md's commit and hold-out lines.

**Decisions:** pinned expiries (round 7's backlog 4) were built as a scratch diff and measured with `measure --patch`:
development and verified unchanged, one hold-out entry "other"; not adopted in a behaviour-preserving round, moved to
the accuracy list. No ClockShift type: the grep it was meant to serve found no anchor reading besides Corrosion's, and
clock.ts `moved` already is the one mapping (documented). `measure --patch` in place of a registered `stop-path`
reading: it measures any half of a change.

**Found:** the engine applies Arcane's combo reset only to the slow-downs running when her combo starts, so a
teammate's combo slow-down starting before her frame 9 runs whole (1d91 50.30 s, 7910 4.90 s, 9555 31.73 s) where the
log tools' lists cut it (docs/open-problems.md, Arcane's combo reset); Purrchena's combo has 30 list-only stops (04d4,
99fb). Both are accuracy tasks.

**Scoreboard** (`npm run snapshots:update`: "No log's verdicts moved", no snapshot changed): verified 77.9 / 99.1 /
0.0 / 1.8%, development 65.7 / 80.4 / 14.8 / 8.6%, hold-out 77.4 / 91.9 / 6.3 / 10.2%, earlier pending 58.5 / 79.2 /
17.8 / 8.1% (plain, matched, mismatch, mean |damage error|), as before.

**Problems:** `--logs 9c0b` matched 489c0be3e162 too (an id part inside another id): full ids for a selection. One
multi-line `python3 -c` slipped through (the round's friction report).
