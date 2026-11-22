# Arcane's Imprisonment end and INT lasers (2026-11-22)

Task: diagnose and fix Arcane's Imprisonment end (the log's combo "cast" at its natural end) and her INT early-end
lasers in a7a7 (worktree branch from 1ab4647).

## 1. Log ms are not one clock, and nothing says so per event

- **What happened:** most of the session went into explaining ±0.5 s residuals in Imprisonment's end and the INT
  lasers. Several hours of hypotheses (world clock, unscaled time, freezes, clone skills) before noticing that the
  log's timestamps are batched: many hits of different operators share one ms during and after stops (a7a7
  48.78–50.01 s: seven timestamps for ~40 hits; an `attack4`'s eight hits at frames 2–11 logged at one ms), so the
  "uneven batches" of the lasers were the log's, not the game's.
- **Cause:** docs/design/data.md "What the log records" says times include stops, but not that the log quantizes
  timestamps (and how coarsely, when); no view flags hits whose ms is shared with many others.
- **Suggestion:** a "batched" column in `zmdlogs casts` / `replay` (how many logged hits share this ms), and one line
  in "What the log records": timestamps are flushed in ~100 ms steps and at stop ends; a residual under ~0.2 s, or one
  at a shared ms, isn't timing evidence.
- **Why it helps:** stops agents from modelling the log's quantization as game mechanics.

## 2. A per-window timing table had to be written three times

- **What happened:** scratch scripts (touch → logged end → explosion; the world's time under placed stops via
  `castTimeStops` + `worldMs`; per-hit verdict dumps at two codes for diffing) were rewritten from scratch; `census`
  gives distances but not "the world's time between A and B under the placed stops".
- **Cause:** `worldMs` and `castTimeStops` are exported but no CLI exposes them; `measure` gives counts per log, not
  which hits moved.
- **Suggestion:** `efsim zmdlogs census … --list --world` printing each pair's real and world gap; `npm run measure --
  --hits <log>` printing the hits whose verdict class changed (the per-hit diff I wrote as scratch/verd.ts and ran at
  `scripts/at-commit.ts`'s worktree).
- **Why it helps:** "which hits got worse and why" is the question every "keep a fix only if no log gets worse"
  brief asks; it took ~20 min per log by hand.

## 3. `withLoggedCasts` swallows entity events into the nearest press

- **What happened:** the INT lasers' start events (a7a7 42.13, 48.89 s) never reached the replay: `near` matched them
  to Arcane's real combos 2.4 s of world time away (LOGGED_CAST_MS 2500 across stops). Found only by adding a debug
  print to `heldTicks`. A general fix (combo events within 1.5 s of their cast) worsened the hold-out; it is now
  limited to skills a buff's ticks are logged under.
- **Cause:** which logged events the replay treats as presses, as ticks or as a placed cast's own is decided in three
  places (withLoggedCasts `near`, loggedTickFrames, loggedTick) with no view of the result.
- **Suggestion:** `zmdlogs replay` marks each logged cast event as "the placed cast's", "a tick of <buff>" or "a
  press", so a missing event shows at once.
- **Why it helps:** the same trap waits for every entity-cast logged under its spawner's id (Arcane, Liino).

## 4. The lock queue dominated the wall time

- **What happened:** four `npm run measure` runs waited 8–10 min each for the lock behind other agents' rules jobs;
  `snapshots:update` waited longer.
- **Cause:** short jobs queue behind long `with-lock` jobs that arrived earlier.
- **Suggestion:** let `measure` (read-only, 2 min) skip ahead of `job` entries regardless of arrival, as premerge does.
- **Why it helps:** measuring is the inner loop of accuracy work.

## What worked well

`efsim gamedata tree` (trigger_time and the seal's tick were one read away), `zmdlogs lanes` (the Susceptibility's
`since` gave the seal's real start and end), `zmdlogs casts` with STOP lines, `--trace-buff`, and `scripts/at-commit.ts`
for a base-code run beside the working tree.
