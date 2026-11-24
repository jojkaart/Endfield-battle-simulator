# The replay's placement and timing leads (2026-11-24)

Task: the misprediction rounds' placement leads (Liino's ultimate windows in 1cd1 / af7b, 7e19's Chen ×1.15 and
Ember, 0c14 / 4e36 / de6a, the one-sided landings' largest kinds): root cause and fix or rule out. Branch
worktree-agent-a5e0a9f27359bf910, base c6f1874.

## 1. Nothing says when a log's cast event is logged: at the press or at the stop's end

- **What happened:** the lead's key question (where Liino's ultimate event sits in her stop) took a hand-written
  scratch script over every log (scripts/probes/placement/ult-events.ts): the ultimate events are at their stop's
  end for most operators (Si 26 of 35, Liino 13 of 21, Laevatain 11 of 16) and at the press for others. The fact was
  known in pieces (buffreplay.ts loggedCastStart's comment on Xaihi and Laevatain; data.md's "an ultimate's cast event
  repeats"), each piece in one function's comment, and `zmdlogs instances` / `replay` print an event with "the placed
  cast's (0.02 s of world time apart)", which hides that the event is 1.76 s after the placed start in log time: the
  world-time distance across the cast's own stop is always about 0.
- **Cause:** the views measure an event against a cast in world time only; no view says "this event is at the press /
  at the stop's end / inside the stop"; the meaning of a cast event is spread over comments.
- **Suggestion:** a column in `zmdlogs instances` (and the replay's EVENT line): the event's place against the
  hitless stretch around it (press-like, end-like, inside, unclear: ult-events.ts's rule), and the log-time distance
  beside the world-time one. One paragraph in docs/design/data.md "What the log records": ultimate events at the
  stop's end for most operators, with the probe's counts.
- **Why it helps:** the next placement question about any ultimate starts from a printed fact instead of a probe.

## 2. A kit hit's frame is ambiguous for landings on their way

- **What happened:** Liino's Pyrotechnics are `detached` at frame 76, but they land 0.1-0.8 s of world time after
  it (dbae: the beat at frame 77 at 8.26 s, the projectiles at 8.61 s). The placement treated the frame as the
  landing's and placed the cast up to 3.5 s late (af7b). The kit model has no field for "lands at or after this
  frame" (travel), so the fix had to infer it from the log (the event, the quiet stretch).
- **Cause:** KitHit.frames means the damage frame for most hits and the launch frame for projectiles; `detached` says
  only "lands even if the cast is cut".
- **Suggestion:** a KitHit field (e.g. `travels: true`, or a `travel` range) the compiler sets for hits from a
  LaunchProjectile / a projectile ability entity, read by logcasts.ts (a landing's frame then bounds the start
  instead of giving it) and by the simulator (land after a typical travel).
- **Why it helps:** the placement wouldn't need the event-and-contradiction heuristic (eventStopStart) for every such
  skill; Si's ability-entity slashes, which don't travel, wouldn't need excluding by a side condition.

## 3. measure answers "this tree against the snapshots", the question is usually "this switch against this tree"

- **What happened:** after a placement commit, the next idea (trigger cooldowns on the world's clock) needed
  `--base HEAD --assume …`; a first `--variant` run compared against the committed snapshots (base c6f1874) and mixed
  both changes into one summary. Each measure also waited 3-10 min in the lock queue behind other agents' premerges.
- **Cause:** the snapshots move only with snapshots:update, so after any commit "against HEAD" isn't "against the
  snapshots"; the default reference isn't the previous step.
- **Suggestion:** measure prints, when the snapshots' code isn't HEAD's, one line "reference: snapshots at X, HEAD is
  Y: --base HEAD measures this tree's change alone", and `--variant` runs the plain tree too (a two-column summary).
- **Why it helps:** one run per idea instead of two, and no misread summary.

## 4. A borderline cooldown was invisible until a debug print

- **What happened:** under trigger-cooldowns=world the replay still made de6a's Swordmancer procs; only a temporary
  stderr print in clock.ts showed the ready frame landing exactly on the Lift's frame (15.01 s of world time; one
  frame), and that the hidden holds (holdWorld) didn't hold the timer.
- **Cause:** no view shows a trigger's cooldown state (`--trace-buff` covers buffs and statuses, not triggerState).
- **Suggestion:** `zmdlogs replay --trace-trigger owner:id`: each firing, its ready frame and every shift of it (the
  step that made it), as --trace-buff does for expiries.
- **Why it helps:** a cooldown question is then one command, without editing the engine.

## 5. An engine reading can't be narrower than "every trigger"

- **What happened:** the logs show Swordmancer's 15 s cooldown on the world's clock; the only switch the engine
  offers is one for every kit trigger's `cooldown` (engine assumption `trigger-cooldowns`), and `world` for all of
  them failed four kit tests (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel, chen-solo) and moved
  two hold-outs worse, so the fix stayed behind a non-default reading. A per-trigger field needed a kit edit, which
  this task's brief kept out of (another agent was in the kits).
- **Cause:** a kit trigger's `cooldown` doesn't say where it comes from (AddGlobalCDTimer, a buff's addingCooldown,
  a skill's cooldown), so a timing rule can't follow the data's mechanism.
- **Suggestion:** the compiler (packages/data, SkillData / BuffData) records each trigger cooldown's source on the
  trigger (`cooldownFrom: "globalCdTimer" | "addingCooldown" | …`); engine readings select by it.
- **Why it helps:** a finding about one game mechanism becomes one switch over exactly the triggers that use it.

## What worked well

- `zmdlogs worldtime`, `casts`, `replay --stops`, `cli-ab` (`scratch/ult-moves.ts` was a three-line wrapper), and
  `measure --hits` with the modifiers that moved: every claim here came from them.
- fit-build's output with the precedent in d9e5's buildOverrides (the same stew on the same enemy) settled Chen in
  minutes.
- `verify-at --test` confirmed the new tests tell the change apart without leaving the tree.
