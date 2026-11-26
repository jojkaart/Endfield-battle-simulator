## 2026-11-26: Improvement round 13: clocks, dropped bounds, --assume everywhere, options before the queue

**Goal:** friction round 13 over the five open reports (round 12's backlog and own report, holds-and-placement,
damage factors, the enemy's clock), beside an accuracy agent holding the replay, placement, check, holds, engine and
compiler files. Write-up: docs/friction-done/2026-11-26-round-13.md.

**Done:**
- `efsim zmdlogs clocks` (clocksview.ts): tick chains, casts' landings and bursts against the stops inside, by stop
  kind and combo operator; the enemy-clock round's five probes in one run (combos 0.23–0.40 × their held time late,
  ultimates on time). `zmdlogs holds --dropped --all`: the dropped bounds by kind and cover (tick bounds in a Stagger
  with a combo: 47 dropped in 9 logs, 35 kept). `differences --clusters`. query.ts `loggedStaggerSpans` for views and
  probes.
- `--assume` on every view that replays (REPLAYING / NOT_REPLAYING in the CLI, a test over the usage).
- measure checks its options and readings before it queues; `--help` on measure, snapshots, premerge, team-ab,
  verify-at (scripts/usage.ts); `--variant --hits` lists a variant's own hits against the plain tree.
- castpairs.ts `pairCasts` (measure `--changed placement`'s moved casts); scripts/lead-files.ts for the lead's file
  split; at-commit's patch failures name the hunks; edit.ts's end block without `=======`; docs/design/tests.md "What a
  hold-out output may say"; the report format's **Files:** line.

**Decisions:** every point needing the replay, placement, compiler or engine went to the backlog (6 live points), not
done in halves outside them; round 12's backlog point 4 closed (the lead's decision), point 5 moved to the accuracy
list. Burst bounds closed: the enemy-clock round ruled them out.

**Scoreboard:** unchanged; `npm run snapshots:update`: "No log's verdicts moved", no snapshot file changed. No engine
change (no smoke, no team-ab).

**Problems:** finding which file each point needed took about twenty minutes of grep (hence the **Files:** line); a
type name clash across `export *` (ClockRow) at the first typecheck.
