# Typhoeus's Barrage Array: its clock and its first tick (2026-11-28)

Task: find why Typhoeus's Barrage Array runs past its entity's 180 frames and why its first tick comes 0.5–0.7 s after
the press, and model it (her kit, the entity's clock, the placement); branch worktree-agent-af01af7cde8f1f78c.

## 1. No view of a tick series' clock with every stop and the hidden holds out

- **What happened:** the question "does this entity's channel fit its 180 frames on some clock" needed, per array, the
  log span of its ticks against the world time with the replay's applied stops (with and without the operator's own),
  and with the hidden holds the replay placed on top. `zmdlogs worldtime <fixture> a b` gives the stops' part only (the
  replay's casts' stops, not the hidden holds, not split by operator), and `zmdlogs holds` lists the holds without a
  span to compare. I wrote two scratch scripts (scratch/arrays.ts: every Typhoeus array, log / world / world without
  her own stops / plus holds; scratch/gaps.ts: one array's per-gap residuals) from BuffReplay.appliedStops and
  hiddenHolds.holds, turned into TimeStops by hand (AppliedStop's operator is `string | null`, TimeStop's `string`).
  That decided the whole task (her own ultimate holds the array, the holds explain the rest), but took about a third
  of the session.
- **Cause:** worldtime predates the hidden holds; the holds and the stops live in two record shapes (AppliedStop,
  PlacedHolds.holds) with no shared "as TimeStops" helper.
- **Suggestion:** `zmdlogs worldtime <fixture> <a> <b> [--holds] [--without <operator>]`: the hidden holds as stops
  (`--holds`), an operator's own stops left in or out; and `zmdlogs worldtime <fixture> --series <event>`: a tick
  series' chains (as holds.ts tickBounds builds them) with each chain's log span, world span and the kit period's
  expectation. Export a `replayClockStops(replay, { holds, without })` from packages/logs returning TimeStop[].
- **Files:** packages/logs/src/query.ts (worldtime), packages/logs/src/holds.ts or replayrecord.ts (the helper),
  packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** every "an entity / a buff runs past its end" lead (Tangtang's stare, Pogranichnik's harasses,
  Zhuang Fangyi's Sunderblades) asks the same question; one command instead of a scratch script each time.

## 2. A clock question that needed the engine's Clock semantics read from three files

- **What happened:** to know whether a `world` kit hit would be held by its caster's own combo slow-down I had to read
  casting.ts (hits scheduled before slowDown is applied, line ~375), clock.ts slowDown/shiftWorld and schedule.ts
  shiftClock, and then run a scratch engine script to confirm the array's first tick would move 16 frames. The design
  doc ("Waiting on the enemy's clock", docs/design/timeline.md) said what `world` means for buffs and Zhuang Fangyi's
  strikes but not that a cast's own slow-down holds a `world` hit scheduled by that cast.
- **Cause:** the ordering (pending hits first, the cast's own slow-down after) is an implementation fact nothing
  states where clocks are described.
- **Suggestion:** a short table in docs/design/timeline.md: each clock (`world`, `enemy`, `{operator}`, now
  worldFromLaunch) against each hold (own combo slow-down, own ultimate stop, a teammate's stop, hidden hold, freeze,
  Stagger-break hold): held or not. A test (tests/world-from-launch.test.ts is a start) per row.
- **Files:** docs/design/timeline.md, tests/world-from-launch.test.ts, tests/world-clock-hits.test.ts.
- **Why it helps:** a kit author choosing `world` / `launch` sees what each choice does without reading the engine.

## 3. The brief's framing of the first tick came from comparing a press with a kit frame

- **What happened:** "its first tick is logged 0.5–0.7 s after the press against the kit's frame 35 (1.17 s)" read
  like a timing bug; it is the documented combo-event lag (events lag frame 0 by 0.3–0.7 s; Typhoeus's median 0.52 s
  over 23 combos), and the first tick lands at the first arrow's ms in all 32 arrays. A scratch script per operator
  (scratch/comboLag.ts) was needed to see the lag by operator against each combo's slow-down.
- **Cause:** the event lag is a fact in docs/design/data.md's prose with no per-operator numbers or command.
- **Suggestion:** `zmdlogs casts --event-lags [--operator <op>]`: per skill kind and operator, the logged event's lag
  against the placed start (median, range), so a later lead compares against it before calling a press late.
- **Files:** packages/logs/src/views.ts (or a new eventlags.ts), packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** saves a dead end whenever a lead mixes a press's log time with a kit frame.

## What worked well

- `efsim gamedata tree` on the combo, its projectile's on-hit skill and the entity's skill gave the whole mechanism
  (persistent_time, the ChannelingAction cap, the dilation's ignore list) in three calls; `gamedata who` said at once
  that the entity's own definition isn't exported.
- `measure --split files` named the one part that moved the one log, and `cli-ab ... zmdlogs replay` showed exactly
  which unlogged ticks moved (dbae), so the worse log was explained in two commands.
- holds.ts already used the array's ticks as a clock (HOLD_SERIES), which made the hidden holds the answer rather than
  a new mechanism.

## Outcome (round 22)

- 1 (No view of a tick series' clock with every stop and the hidden holds out): done (95366e3): packages/logs
  replayclock.ts (replayClockStops from BuffReplay.appliedStops, an operator's own left out on request; replayHolds;
  heldWorldMs adds a hold to any stop, as holdWorld does); `zmdlogs worldtime <fx> <a> <b> --holds --without <op>`
  (per stop source: the list and the timeline's applied slow-downs); `zmdlogs worldtime <fx> --series <re> [--period
  ms] [--gap ms]` per tick chain (holds.ts tickChains, now the one chain rule of tickBounds and clocksview.ts too:
  `cli-ab clocks fc63 db87 4d60` identical). fc63's 87.91–94.26 s array: world 4.29 s with every stop out, 6.36 s with
  her own left in, 4.09 s with the holds out, against 4.00 s.
- 2 (A clock question that needed the engine's Clock semantics read from three files): done but a test per row
  (carried: 2026-11-28-backlog-after-round-22.md point 2): docs/design/timeline.md "Which clock each hold holds" (95366e3),
  the cast's own slow-down after its scheduled hits, the burst sentence's own-ultimate reading (`burst-stops` `all`).
- 3 (The brief's framing of the first tick came from comparing a press with a kit frame): done (95366e3): `zmdlogs
  casts --event-lags <fx…|--all> [--operator] [--verbose]` (eventlagsview.ts: per operator and skill kind over the
  plain casts, the odd ones counted by why: a teammate's stop between, the event over 1 s before the start): Typhoeus's
  combo median +0.53 s (world +0.05), Arcane's +0.29 s; data.md's cast-event lines name it.
