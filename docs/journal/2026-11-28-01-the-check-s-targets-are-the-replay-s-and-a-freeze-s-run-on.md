## 2026-11-28: The check's targets are the replay's, and a freeze's run-on on every target

**Goal:** the backlog after round 21's accuracy list, its first and last items: the second assignment of a fight
read per target numbered its targets afresh, so enginecheck.ts atItsTarget read a candidate `t` at the replay's
target `t`, another slug (7b54: 147 of 210 hits with both off their landing's targets); and a freeze's ramp and
statuses run-on (clock.ts rampRunsOn, statusesRunOn) read the current target only.

**Done:**
- targets.ts assignTargets takes AssignOptions (`fixed`, `ids`); with ids `landings` a new target takes the id of a
  target its first hit's landing reached in the replay that no target has yet (each a candidate, the first that
  fits), else an id no landing names. enginecheck.ts SECOND_PASS_TARGETS `mapped` (the default; `free` the old
  numbering). 7b54: 147 → 55 hits off their landing; 6339 and 9c6e unchanged (0 and 1).
- The 55 left are hits the two assignments put on other slugs: at 16.36 s the first assignment had both of
  Laevatain's attack 2 hits (1462, 1701) on one slug, neither fitting in the one-enemy replay; in the second replay
  1701 fits only with Vesperwings and Arcane's will_susc on, which that slug was read without, so it went to a slug
  of its own, and the 19.59 s kill and Si's 20.21 s attacks followed. logcheck.ts TARGET_REPLAYS (at most three):
  the replay is made again on the check's assignment while it puts a hit on another target than the replay was made
  on. 7b54's third replay gives the same assignment back: 0 of 210 off. 6339 and 9c6e stop at two.
- clock.ts rampRunsOn and statusesRunOn run on every target the freeze held (eachTarget), a target it didn't hold
  unchanged; synthetic tests in tests/target-statuses.test.ts; clock.ts left tests/enemy-readers.test.ts's list.
  The backlog's "no fight read per target has a freeze yet" was wrong: Si's Immobilization freezes the slugs (not
  control-immune) at 6339 4.53 s and 7b54 3.40 and 29.50 s, each a single-target landing with no status on any
  target then, so it reads nothing.

**Measured:** the full measure against 60fa436 at each step: no log's verdicts moved, hold-outs unchanged. The
scoreboard (docs/accuracy.md): the several-targets row's mean |damage error| 10.4 → 10.0%, replay-only 12.1 →
11.7%, plain 75.6% and mismatch 11.2% unchanged; every other row unchanged. 7b54 4.0 → 2.8%: the third replay's
landings on their slugs leave out a replay-only Heat burst at 46.70 s (Arcane's, 12,851), so Arcane's own 7b54
total goes −4.1 → −22.3% (her five log-only hits, 14,502, no longer offset): her row's mean |damage error| 3.0 →
3.4%, own one-sided 5.3 → 4.8%. Why no verdict moved: 7b54's only reaction
status is Combustion (a dot), so no hit reads a Corrosion, Electrification or Breach level and the ids decided
nothing in its values; the slugs' kit buffs are decided by the assignment itself, not by id. team-ab: every team's
fight the same.

**Left:** a freeze on a twin's other target holds the first target's clock (landing.ts runs the other target's
control event after the first is current again); no such freeze in a log yet (docs/open-problems.md "statuses per
target").
