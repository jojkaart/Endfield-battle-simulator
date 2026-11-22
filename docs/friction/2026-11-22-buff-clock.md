# The buff clock: what holds buffs past their end (2026-11-22)

Task: measure every listed buff's logged length against its data duration and the replay's expiry over every
development log, score deterministic hypotheses for the excess, implement what fits (engine assumption
`hidden-holds`, the replay keeping a listed buff to the log's end). Branch: this worktree's, on main at 0ab4b03.

## 1. No view of "each listed run against its data duration and the replay's expiry"

- **What happened:** the whole first hour went into scratch scripts (scratch/bc/lanes.ts, sum.ts, table.ts): build the
  log's runs per buff, source, start and holder; bracket each end by the holder's next hit without it; find the kit
  buff and its duration; find the replay's instance; take world time out. `zmdlogs lanes --world` gives one buff's runs
  in one log but no duration and no replay; the duration had to come from the replay's traces (the first `to` less
  `appliedAt`), which for a buff created inside a stop already includes the hold (Forgeborn read 22.03 s, Si's combo
  buff 10.53), so I filtered to "canonical" durations by hand.
- **Cause:** the data's duration of a kit buff is a ValueExpr evaluated in a timeline context; no exported helper turns
  `(fixture, owner:buff)` into seconds, and the lanes view and the replay's kit windows live in different modules
  (query.ts and buffreplay.ts) with no join.
- **Suggestion:** `efsim zmdlogs buffclock [fixture…|--all] [--buff re]`: per listed run of a kit-modelled game buff,
  since, end bracket (exact at a boundary hit), the kit's duration (an exported `kitBuffSeconds(data, build, def)` in the
  engine: the expression evaluated at the build's levels), world excess (worldMs), the replay's expiry and excess over
  it, whether the log refreshed it; a summary per buff and per log. My lanes.ts is a working draft of it.
- **Why it helps:** the previous agent's friction report asked for "a lane-end view"; three agents found the same
  excess one buff at a time. A cross-log table is the first question of every buff-timing diagnosis.

## 2. The replay's kit windows don't say which instance a later window continues

- **What happened:** matching a log run to "its" replay instance needed heuristics (start within −3 s…the last listed
  hit; the last such window). A refresh in the replay is a new window; a refresh in the log keeps the run's `since`.
  My first damage and clock results were muddied by runs the game refreshed and the replay didn't (Perlica's weapon
  buff +9 s), until I measured against the data's duration in world time instead of the replay.
- **Cause:** `kitWindows` returns flat windows per recipient; `BuffTrace` has the instance identity (`appliedAt`) only
  when traced, and no "refreshed by" link.
- **Suggestion:** give `KitWindow` its `appliedAt` and, when an application replaced an instance, the replaced one's
  start (`replaces?: number`); `zmdlogs replay --kit-buff` prints the chain.
- **Why it helps:** "the replay missed a refresh" and "the buff ran long" separate at a glance, and scripts stop
  guessing.

## 3. One extension of an expiry gets held again by later stops

- **What happened:** my first `heldToLoggedEnds` set the expiry to the log's end once, at the replay's expiry; the
  replay's later time stops then shifted it again (b6aa: Xaihi's debuff to 46.9 s where the log ended it at 43.8 s and
  the damage at 43.9 s agreed). Two more measure rounds (each a minute, plus reading `--hits`) to find it with a trace
  script, then a step-at-a-time keep with a clamp.
- **Cause:** the engine's clock (`shiftWorld`) shifts every buff's expiry at each stop; there is no "pinned" expiry, and
  the replay's other log-following rules (`heldTicks`) solve the same problem ad hoc.
- **Suggestion:** an `ActiveBuff.pinnedUntil` (or a replay-only "fixed end" field) that `shiftBuff` leaves alone, used by
  heldTicks' moved ends and heldToLoggedEnds alike; document in docs/design/timeline.md that any expiry taken from the
  log must be pinned.
- **Why it helps:** the next "take X's end from the log" rule is a one-liner, not a step-by-step workaround.

## 4. The worktree guard refuses arguments that look like shell words

- **What happened:** `node scratch/bc/clock.ts source 200` was refused ("runs a string through source"): my partition
  was named `source`. Renamed it to `owner`. Also, the hits export `zmdlogs hits --json` silently ignores `--assume`
  (it printed the default reading's verdicts), which cost a wrong conclusion until I wrote a replay script.
- **Cause:** the guard pattern-matches words; `hits` doesn't take the assumption option the check and measure take.
- **Suggestion:** mention in CLAUDE.md's worktree list that a bare `source` (and `eval`, `exec`) anywhere in a command is
  refused; make `zmdlogs hits` accept `--assume` (or refuse unknown options instead of ignoring them).
- **Why it helps:** two small traps, each a few minutes.

## 5. Hold-out fixtures can't show a listing-based change, and nothing says so

- **What happened:** the measure reported the hold-out row "unchanged" for a change that moved 60 development logs.
  Two verified logs (40d9, 4e5e) lack the runs' `since` and `source`; the hold-outs presumably too, but I can't look.
- **Cause:** older imports lack fields newer replay rules read; `measure` doesn't say which fields a log lacks.
- **Suggestion:** `measure` (and snapshots:update) print, as an aggregate, how many hold-out logs lack `since`/`source`
  on their effects (a count, no names), and `zmdlogs refresh` for the verified ones.
- **Why it helps:** "unchanged on the hold-outs" then reads as "not testable there" or "tested and unchanged".

## What worked well

- `npm run measure` (one minute, `--assume`, `--hits`): three iterations of the replay rule in half an hour.
- The engine assumptions registry: a replay-only reading slotted in with no plumbing beyond `opts.assume`.
- The raw-detail cache (19 logs) gave exact lane ends, which showed the logger's ends are flush times shared with other
  edges, and the battle's clock fields (`timeSource`, official vs timeline duration).
- `castTimeStops` / `worldMs` exported from @efsim/logs: the world-time arithmetic was one call.
