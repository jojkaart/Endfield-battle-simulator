## 2026-11-23: Improvement round 6: a kit buff's clock, probes, the split

**Goal:** the sixth friction round (docs/friction/README.md) over the six open reports (round 5's backlog and its own
report, the buff clock, Artful Intent, hidden holds, the four smaller leads) and the lead's list, behaviour-preserving;
on main at 235d717. Summary: docs/friction-done/2026-11-23-round-6.md.

**Done:**
- `efsim zmdlogs clock --kit-buff owner:id [fixture…]` (packages/logs/src/clockview.ts): per instance the first
  expiry, the expiry on the replay's own clock (`hidden-holds=none`, before any shortening step), how it ended there
  and in the check's replay, the log's run and the lateness in real and world time; four agents had scripted it.
- scripts/probes/<topic>/ with an index and a rule (a scratch script a doc cites moves there in that commit); eleven
  cited probes promoted from other worktrees' scratch and run at this code; open-problems points at them.
- `node scripts/holdout-split.ts add-development <fixture>` (the development array's text alone, the parse checked,
  nothing of the hold-out list shown); 207f registered.
- World-time views (worldtime, lanes --world, cadence) on the stops of the replay's casts (query.ts `replayTimeStops`:
  db87's Laevatain ultimate placed from its cast event was missing); `measure` reads a log new since the reference
  commit from the measured tree; `zmdlogs hits --assume`; census `origin:<re>`.
- `operatorId(data, "Arcane")` (@efsim/data), `efsim find --operators`, devFixtures by name.
- The backlog: closed-by lines and a parked list (docs/friction/README.md), scripts/friction.ts `outcomes` / `carry`;
  round 5's points 1–21 parked; docs/friction/2026-11-23-backlog-after-round-6.md has 20 live points.

**Scoreboard** (`npm run snapshots:update`: no log's verdicts moved; only the groups): development 31 → 32 fights,
plain 63.2 → 62.5%, mismatch 15.4 → 15.6%, |damage| 9.1 → 9.4%; earlier pending 24 → 23 fights, 56.1 → 56.9%,
18.8 → 18.7%, 8.4 → 8.0%; verified, hold-outs and all but the hold-outs unchanged.

**Decisions:** the split edited as text, not re-serialised (a whole-file rewrite would put hold-out ids in the
diff). `zmdlogs clock` as a consumer of the replay's traces under two readings, so nothing in logBuffReplay moved
while the hidden-holds clocks agent works in it; its run() refactor, the enemy-status trace view and the Corrosion
reader left to that agent (the backlog's "Taken" section). Probes not typechecked or linted: they age, and the
README's "last run" column says when one was last seen working. Points carried through two rounds without a new
report parked rather than re-read.

**Left:** the backlog's 20 points (`zmdlogs clock` from casts and over every buff, the kit windows' instance chain,
pinned expiries, origin columns, the hold-out field count, round 5's carried views); friction report
docs/friction/2026-11-23-round-6-friction.md.
