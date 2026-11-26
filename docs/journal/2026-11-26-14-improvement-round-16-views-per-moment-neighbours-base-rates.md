## 2026-11-26: Improvement round 16: views per moment, neighbours, base rates and records

**Goal:** improvement round 16 over the five open friction reports (Arcane's Doubles end, her WILL lines, a stop's
batched landings, round 15's own, slots and paths by value) and round 15's backlog; every file the round's
(docs/friction-done/2026-11-26-round-16.md has the details).

**Done:**
- **Per moment:** `efsim zmdlogs ends <fixture> [--at s]` (endsview.ts): the runs ending at a logged moment and those
  going on, a purge's shape and loggedPurges' reading, the moment spacing; `zmdlogs lanes` prints the spacing and the
  cast events within it beside each end; a batched ms's Stagger bars on `replay` / `casts` lines and a BATCH line
  where the replay's order differs (c4f3 7.05 s: Estella's first Lift lands before her ultimate in the replay, after
  it by the bars: on the backlog's accuracy list).
- **Neighbours and base rates:** `zmdlogs hits --same-listing <s>` (the nearest hits with the very same listing and
  their verdicts) and `--listed <regex>` (the entries' sources, sinces, values); `zmdlogs boundaries` (per kit buff and
  side, how its boundary hits read); open-problems' header asks a listing candidate to name its neighbour.
- **By value:** `zmdlogs clock` pairs an instance with the run of its own value (BuffTrace.values), a refreshed run
  across its start included (e82d's first Doubles instance now on its 0.1794 run from 3.98 s, not the talent's 0.197).
- **Records:** `replay --trace-stack owner:stack`; `replay --kit-buff … --against-lanes`; BOTHPATHS decisions (engine
  drivers.ts `keptSkipped`, record only; none in the development logs now).
- **Smaller:** the Stagger bar's direction documented; `gamedata tree` prints stackingType readings
  (docs/game-data-format.md "stackingType readings"); bash-guard says a refused chain ran nothing, `--check-file`;
  `measure --split files` puts a new export and its users in one part; `fit-build --pairs` (04d4's Snowshine: no
  single change, 26 pairs, 7 distinct ATK values: undecidable by the logs).
- **The by-operator share:** `share operator <id>` per fight, a describing snapshot key (the brief allowed one), and
  the scoreboard's by-operator table's median, share-weighted |error| and mean share (Liino: mean 16.7%, median 5.7%);
  snapshots.ts prints "keys added only".

**Checks:** team-ab against 33c3248 after the engine record: unchanged. `npm run snapshots:update`: "No log's verdicts
moved", "keys added only in 74 log(s) … share operator <id> ×294"; docs/accuracy.md's existing numbers the same.

**Decisions:** a new view where a question spans buffs or sides (ends, boundaries), a flag on an existing one where it
is one fact more (the grain on lanes, bars on LAND lines). The clock keeps its old rule where no value matches or none
was traced. The Snowshine probe stays: open-problems cites its count on two nodes, which the view's "build as read"
doesn't reproduce. BATCH stays out of `decisions` (its records are the replay's, the bars the fixture's): the backlog.

**Left** (docs/friction/2026-11-26-backlog-after-round-16.md): the recorded Stagger start (carried once), the stage
logs' flag in the scoreboard, BATCH counted in `decisions`; the log context parked. CLAUDE.md lines for the lead in the
round's summary.
