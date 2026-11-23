# Four smaller leads (2026-11-23)

Task: four leads from docs/open-problems.md (d774's Sunderblade strikes ×1.39, db87's Corrosion ramp across
overlapping stops, 3f78 / 4a64's "−36.5% after food", Hard 27's ×1.1125), each to a cause or what's ruled out; base
main at 6b117c1, branch of worktree agent-a58a694ab66bcb985.

## 1. No view of an enemy status's life in the replay

- **What happened:** d774's ×1.3858 was a level-1 Electrification the game's battle skill consumed and the replay had
  let expire. Finding where the replay's Electrification ended took a hand loop over `zmdlogs hits --json`, printing
  each hit's `landing.enemy` and watching `appliedAtMs` change (it moves with every hold, which first looked like a
  re-application at 87.83 s). The same loop then served a7a7's Corrosion (base against new code) and 9090's
  Electrification: about an hour in total.
- **Cause:** `zmdlogs replay --trace-buff` traces a kit buff's expiry and the step that changed it; nothing does that
  for the enemy's statuses (Corrosion, Electrification, Combustion), whose `appliedAt` the engine shifts in place
  (clock.ts `shiftEnemy`), so a hold and a new application look alike in the per-hit JSON.
- **Suggestion:** `zmdlogs replay --trace-status <status>`: each application, each hold (start, frames, the stop that
  made it), its expiry or consumption, beside the log's lane of the status's debuff key
  (`buff_common_pulse_pulse_conduct_triggered_do`, the Corrosion keys) and its last listed hit.
- **Why it helps:** enemy statuses are now the open half of the buff clock (the holds for every timer); every lead on
  them starts with this question.

## 2. `measure --hits` fails on a new fixture

- **What happened:** after importing fixtures/pending/zmdlogs-207fff414d82.json, `npm run measure -- --hits` ran the
  whole measurement, then died in the reference pass (`ENOENT ... scratch/at/6b117c18a/fixtures/pending/zmdlogs-207f…`)
  and printed `EFSIM-DONE measure fail` with no summary: one more 2-minute run without `--hits`.
- **Cause:** scripts/measure.ts measures the reference code for the moved logs in the reference ref's worktree, whose
  fixtures don't have the new file.
- **Suggestion:** in the reference pass read the fixtures from the measured tree (or skip a log the reference doesn't
  have, listing it as "new"), as the summary already does ("1 new").
- **Why it helps:** a new log is exactly when the per-hit list matters.

## 3. The placed-cast views miss the replay's event-placed ultimates

- **What happened:** for db87 `zmdlogs worldtime 16 21` reported only Camille's combo stop: Laevatain's ultimate at
  16.60 s, whose stop the replay has, is placed from its cast event by buffreplay.ts (loggedCastStart), not by
  placeHits, so worldtime, `lanes --world` and `cadence` leave it out. My own scratch script (castTimeStops over
  placeHits) had the same hole, which I found only by reading `zmdlogs casts`.
- **Cause:** two lists of casts: placeHits' (from hits) and the replay's (withLoggedCasts adds hitless and event-placed
  casts); the world-time views use the first.
- **Suggestion:** export the replay's time stops (the stops the replay ran, operator, skill, frames) from
  logBuffReplay, and have worldtime / lanes --world / cadence use them; or say in their header which casts they count.
- **Why it helps:** a hold missing from a world-time number is silent and decides "is this a hidden hold or a placed
  stop".

## 4. A new development log can't be registered without opening the hold-out file

- **What happened:** the new Hard 27 fixture lands in "Earlier pending" on the scoreboard: the development list is in
  fixtures/holdout/holdout.json, which agents never open, and no script adds an id to it.
- **Cause:** the split file mixes the development list (public) with the hold-out list (secret).
- **Suggestion:** `node scripts/holdout-split.ts --add-development <fixture>` that appends without printing, or keep
  the development list in fixtures/pending/development.json.
- **Why it helps:** new development logs land in the right row; nobody has to choose between the rules and the
  scoreboard.

## 5. Corrosion's ramp has no reading tool

- **What happened:** for db87, 3f78 and 4a64 I wrote scratch/corrosion-lag.ts: each hit with the replay's Corrosion,
  the logged ÷ primary read as a resistance step, and the bounds that puts on the log's extra hold. It decided two
  leads (db87: not the stops' sum; the food logs' "no level fits": the ramp one step ahead), but its crude instance
  grouping and other zones' noise cost time.
- **Cause:** `zmdlogs hits` gives the shred but not which step the logged value implies.
- **Suggestion:** `zmdlogs hits --json` field `corrosionStep` (the step the logged value implies, if within 0.25
  points) and a `zmdlogs corrosion <fixture>` view of each ramp's steps, log against replay, with the lag bounds.
- **Why it helps:** ramp timing is the cleanest clock probe the logs have (a step per second, read off every hit).

## What worked well

- The lead's brief named the base, the area to stay out of and the exact next checks; the open-problems sections had
  the ruled-out lists that made "a second player's log" an immediate decider for Hard 27.
- `zmdlogs fit-build` found Ember's and Snowshine's weapon levels in seconds once the resistance was right.
- measure's snapshot at queue time: I kept editing during every run.
