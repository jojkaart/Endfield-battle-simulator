# The hold at a Stagger break, Rossi's bleed (2026-11-27)

Task: find and implement the hold at a logged Stagger break (5082's Yvonne), and why 99fb's Rossi bleed ticks after
her ultimate had no landing; branch worktree-agent-aef72dfd574eeedc4.

## 1. A log-side helper can't see the reading a measure variant sets

- **What happened:** the engine's break hold needed the replay's hidden-hold tick bounds (holds.ts tickBounds) to
  know the same hold, or the holds would place it a second time. tickBounds is called from buffreplay.ts (another
  agent's file) as `tickBounds(fx, stops)`, with no `assume`; so `measure --variant break-hold=14f` would have run the
  engine under 14f and the bounds under the default. I worked around it by making the default a constant
  (assumptions.ts BREAK_HOLD_READING) and measuring `--variant <file>:BREAK_HOLD_READING=…`; the first try (a plain
  `--variant break-hold=…`) would have measured an inconsistent pair without any warning.
- **Cause:** engine readings reach the log tools only through each call site's own plumbing (opts.assume passed by
  hand to some functions, ENGINE_ASSUMPTIONS defaults read inline in others: buffreplay.ts reads `pause-holds`,
  `stagger-holds` itself); nothing says which helpers read a reading, so a new reading read in a helper silently
  takes the default under a variant.
- **Suggestion:** one `readingOf(assume, id)` in packages/logs (the default when absent) and every log-side reader of
  an engine reading taking the replay's `assume` (buffreplay.ts passing it to tickBounds, statusBounds, runBounds);
  a test that greps packages/logs for `ENGINE_ASSUMPTIONS.find(` outside that helper.
- **Files:** packages/logs/src/buffreplay.ts, packages/logs/src/holds.ts, packages/logs/src/assumptions.ts,
  tests/engine-assumptions.test.ts
- **Why it helps:** a variant measures what it names; the constant trick isn't needed for the next reading.

## 2. The clock views can't show a hold that isn't a cast's stop

- **What happened:** `zmdlogs clocks --rows` marks rows with a break inside, but its residuals mix the placement's
  mistakes (Si's combo +2.5 s) with the hold, and its tick chains are cut at the Stagger's edges, so no tick row
  spans a break. I wrote a probe (scripts/probes/stagger/break-hold.ts) for per-break rows: each cast's landings
  after the break against its last one before, the landings at the break's own ms, and the tick pair spanning it.
  With the hold in the engine, the views (replayTimeStops) still don't list it, so after the fix they show the same
  0.5 s lateness as before.
- **Cause:** the views' world time is the replay's casts' stops only (castassembly.ts replayStops); engine holds that
  come from events (a break, a dodge, a freeze) have no place in that list.
- **Suggestion:** a `--around break` mode for `zmdlogs clocks` (the probe's rows: per event, each clock's pair
  spanning it, no Stagger cut), and replayStops taking an `events` list of non-cast stops (the logged breaks under
  `break-hold`) so the views subtract them.
- **Files:** packages/logs/src/clocksview.ts, packages/logs/src/castassembly.ts, packages/logs/src/query.ts
- **Why it helps:** the next event-borne hold (a Lift, a Knock Down, a perfect dodge) is a view away, and a fixed
  hold stops showing as lateness.

## 3. The replay's Stagger window start was derived, and an engine stop broke it

- **What happened:** after the hold, the replay's Stagger windows started 16 frames after every break (my probe of
  window starts against logged breaks: most at +15–17 frames; the fix was later dropped on the hold-outs, the late
  start feeding the hidden holds' still spans): replayrecord.ts derived a window's start as `until −
  staggerFrames`, which a stop at the break moves. The hidden holds' still spans then let holds rise in those frames.
- **Cause:** the engine's Stagger state has no start (TimelineState.stagger: poise, until, finisherUsed), so the
  recorder reconstructs it.
- **Suggestion:** a `since` frame on TimelineState.stagger set by dealPoise / holdStagger, read by replayrecord.ts.
- **Files:** packages/engine/src/timeline/state.ts, packages/engine/src/timeline/resources.ts,
  packages/logs/src/replayrecord.ts
- **Why it helps:** any stop at a break's frame (this one, a future dilation) leaves the window's start right.

## 4. Pre-planned rotations decide cast frames before earlier landings

- **What happened:** my first unit test expected attack2, cast after attack1's breaking hit, to come 16 frames
  later; it didn't: `simulate` applies each rotation action at once, so attack2's frame was fixed before attack1's hit
  landed. Cost one debug script.
- **Cause:** documented nowhere near the stops: a stop holds what's scheduled, not a rotation's later presses.
- **Suggestion:** one line in docs/design/timeline.md "Time": a time stop moves what is scheduled; presses of a
  pre-planned rotation keep their frames (rules and the search decide at the time).
- **Files:** docs/design/timeline.md
- **Why it helps:** tests of stops are written right the first time.

## What worked well

`measure --variant <file>:<CONST>=<v>` ran five lengths and the none reading in one queue; `zmdlogs replay
--trace-buff` showed the bleed's +93 frames at the freeze in one run; `zmdlogs hits --against` and `holds
--assume` explained a mixed log (8915: a WIDE unit re-placed) without a measure.
