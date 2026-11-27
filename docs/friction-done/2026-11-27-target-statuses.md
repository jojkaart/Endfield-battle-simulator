# Statuses per target and buffs at a target's death (2026-11-27)

Task: in the several-targets fights (6339, 7b54, 9c6e), the replay-only Heat bursts after Camille's Vesperwings moves
and the per-target statuses; build the kit listeners on a target's death the data defines and the slug logs show
(branch of the accuracy agent on main at 14fe159). Result: replay assumption target-deaths, Laevatain's death_absorb.

## 1. No view of the replay's status record (bursts, consumptions, reactions, ticks)

- **What happened:** to see why 6339 bursts at 21.60, 25.57, 33.17 s, and later why its 29.26 s Laevatain combo hit
  stopped landing under one reading, I needed the replay's enemy-status history: which inflictions were consumed when
  (Laevatain's absorption), which Combustion was applied and when it ticked. `zmdlogs bursts` gives bursts only,
  `zmdlogs replay` gives landings and NOLAND, `zmdlogs decisions` the casts. I wrote scratch/reactions.ts (logBuffReplay,
  `replay.stateAt(last).reactions`, printed with frames) and ran it under each reading; it was the one tool that showed
  the mechanism (the dead slug's Heat absorbed at 20.37 s, the 24.03 s Combustion that let the 29.26 s combo land).
- **Cause:** TimelineState.reactions (bursts, reactions, `consumed`, Combustion ticks, controls) is recorded but no CLI
  view prints it; the inflictions themselves (StatusEvent `inflicted`) aren't in that record at all.
- **Suggestion:** `efsim zmdlogs reactions <fixture> [--assume …] [--from s --to s]`: each record of the final run's
  `reactions` with its time, kind, operator, element / status, level and stacks (a burst's `inflictedAt`), and the
  enemy's infliction stacks after it; `--deaths` marks the replay's death steps between. Optionally record
  `inflicted` events (record only) so a stack's arrival is visible too.
- **Files:** packages/logs/src/views.ts (or a new reactionsview.ts), packages/cli/src/commands/zmdlogs.ts,
  packages/engine/src/timeline/landing.ts (if `inflicted` is recorded).
- **Why it helps:** a status question (a burst too many, a reaction a kit hit's `if` needs) is answered by one command
  instead of a probe per task; cheap, read-only.

## 2. The replay's new deaths don't show in `zmdlogs decisions` / `replay`

- **What happened:** the DEATH lines (decisionsview.ts deathLines) list targets.ts deathMoves, the moves only. With
  target-deaths `kills` the replay also makes a death at every other logged kill (6339 10.35, 11.31 s; 7b54 16.36,
  19.59, 32.94 s), which runs Laevatain's absorption: those deaths are invisible in every view; I checked them with the
  probe above.
- **Cause:** the view reads its own copy of the rule (deathMoves) instead of the replay's record of the steps it ran,
  so a new rule in targets.ts targetDeaths leaves the view behind. decisionsview.ts was the parallel tail-cuts agent's
  file, so I didn't change it.
- **Suggestion:** decisionsview.ts deathLines from targets.ts targetDeaths(fx, kits, replay.assume) (each death's
  `why`, its moves, the triggers it excluded), or better from a record the replay keeps (BuffReplay.deaths: the death
  steps run, with their options), as the casts' MADE lines are.
- **Files:** packages/logs/src/decisionsview.ts, packages/logs/src/buffreplay.ts, packages/logs/src/replayrun.ts.
- **Why it helps:** every death the replay makes is printed with why; the view can't drift from the rule.

## 3. Finding every BuffData handler of one ability event took 21 runs of `gamedata find`

- **What happened:** "the other kits' listeners on a target's death" meant every buff with an abilityEvent 1 (HP 0)
  handler. `gamedata find` takes an action type, so scratch/hpzero.ts ran it for 21 action types and grepped the
  event column; it also printed Arcane's spell_vulnerable CreateBuffAction as `isEnable true`, though it sits under a
  disabled IfElseAction (the whole handler is dead: only `gamedata tree` shows that). And the brief's list named
  Laevatain's passive_enemy nowhere, the listener that turned out to matter most.
- **Cause:** the finder indexes actions by type, not by the event or the buff event they hang under, and reports an
  action's own isEnable, not whether a disabled ancestor switches it off.
- **Suggestion:** `efsim gamedata handlers <abilityEvent n|buffEvent n>` (every file with a handler of that event, its
  enabled action types, "all disabled" where nothing runs), and in `find` an action's effective enablement
  ("disabled by its parent IfElseAction"). Kit work on events (death, takes damage) then starts from one list.
- **Files:** packages/cli/src/gamedata.ts, packages/cli/src/commands/gamedata.ts.
- **Why it helps:** the census of a mechanism across kits is one command, and a disabled handler can't be mistaken
  for a live one.

## What worked well

- measure's `--variant` with the plain tree: three readings and the kit trigger's own effect (the plain run against
  the base) in one 7-minute run, which settled the default (`kills`, not `statuses`).
- The engine's replayEvent/targetDies from round 20: a new death kind needed an options argument, not a step kind.
- `zmdlogs totals --kinds` and NOLAND's reason (a kit hit's `if` that didn't hold) named the 29.26 s combo hit's cause
  at once.

## Outcome (round 21)

- 1 (No view of the replay's status record (bursts, consumptions, reactions, ticks)): done: `zmdlogs statuses` came
  with the statuses-per-target round (bursts, reactions, consumptions, physical statuses, ticks, deaths); round 21
  added `--inflictions` (ded49bf: each target's element × stacks where a frame of kit landings changed it, from the
  replay's states, no engine record).
- 2 (The replay's new deaths don't show in `zmdlogs decisions` / `replay`): done by the statuses-per-target round
  (BuffReplay.deaths, decisionsview.ts deathDecisions from the replay's record).
- 3 (Finding every BuffData handler of one ability event took 21 runs of `gamedata find`): done (72abb23): `efsim
  gamedata handlers <abilityEvent|buffEvent> <n>` (the action types that run and those switched off, ALL DISABLED);
  `gamedata find` says when a disabled parent switches an action off (Found.disabledBy), `--enabled` leaves it out.
