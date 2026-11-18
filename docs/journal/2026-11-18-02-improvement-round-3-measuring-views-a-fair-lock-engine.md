## 2026-11-18: Improvement round 3: measuring, views, a fair lock, engine readings

**Goal:** the third friction round (docs/friction/README.md): seven open reports (the round-2 backlog and
friction, the fixture refresh, tests from logs, Arcane's mismatches, cast placement, Stagger windows), ranked by the
time they cost accuracy work, behaviour-preserving. Summary: docs/friction-done/2026-11-18-round-3.md.

**Done** (a commit each):
- `npm run measure` (scripts/measure.ts): the log checks on worker threads into scratch/, the scoreboard change and
  each log's direction printed, nothing tracked written. All 73 logs in 64 s on a quiet machine, against 5-10 min for
  `snapshots:update`; `--with`, `--logs`, `--changed placement`, `--at <ref>`, `--base <ref>`, `--assume`.
- The test lock is a queue (arrival order, premerge and test suites ahead of jobs that arrived up to 20 min before,
  no starvation), with a heartbeat, `with-lock --status`, a batch-script warning; snapshots.sh holds it once;
  `EFSIM-DONE <job> pass|fail` lines; run states in scratch/runs/ (`node scripts/runstate.ts`);
  `snapshots:update -- --costs` alone rewrites pending-costs.json; `scripts/verify-at.ts` verifies a commit while
  editing goes on.
- `efsim zmdlogs casts | replay | stagger | differences | groups`, built from the agents' scratch prototypes;
  `zmdlogs hits --json` gains `listed`, `differences`, physical statuses and `appliedAtMs`.
- Engine assumptions (timeline/assumptions.ts): `control-immunity` (listed / bosses / none / all) and
  `teammate-pause` (6.5s / 3.5s) switch with `--assume`, in `zmdlogs check` and `measure` too (c3c7 under
  `control-immunity=none` gives test 104's Si 120 → 110 plain again).
- The inert Haste speed plumbing (hasteFrames, Acting.speed) removed.
- `efsim gamedata find <type>`; abilityEvent numbers tabled (docs/game-data-format.md) and named by `gamedata tree`.
- Docs: data.md "What the replay takes from the log" and "What the log records" (cast events by kind, hidden casts,
  status keys, ms vs frames); tests.md "Measuring a change"; open-problems' header (a cause cites its check; first
  steps `zmdlogs groups` / `differences`); `.ignore` and counter titles keep hold-outs off screen; CLAUDE.md.

**Behaviour:** `npm run snapshots:update` at 0bb1a1a left every snapshot and docs/accuracy.md as they were ("No log's
verdicts moved", no file changed); `npm run measure` agreed byte for byte; the default suite passed at 2d96fc3
(after the Haste removal) through verify-at. Scoreboard unchanged.

**Decisions:** measure compares against committed snapshots by default (they are HEAD's measurement), and keeps
unmeasured logs at the reference's entry on both sides, so a selection shows only its own moves. The lock's priority
is a fixed head start rather than a count of passes, so it needs no shared mutable state. Haste got no engine reading:
its alternative had no code left worth keeping; the evidence moved to castSkill's comment. `--assumptions` still runs
only the kits' alternatives (backlog point 14).

**Left:** docs/friction/2026-11-18-backlog-after-round-3.md (17 points: the round-2 code-quality items, a CLI / A/B
harness, citation checks, a status-key table in code, example repair, the teammate-pace measure, a cast table, …).
