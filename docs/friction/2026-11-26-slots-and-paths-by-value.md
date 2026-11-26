# Slots and paths by value, Pogranichnik's bank (2026-11-26)

Task: pair a cast's logged hits to its kit hits by value (9c0b's Hunter Pursuit, 7910's rogue wave), Pogranichnik's
SP-driven team buffs (Thermite Cutter, Fervent Morale), and 9c6e's Liino combo on two enemies; branch
worktree-agent-afcd0d768286cbdd8.

## 1. No view shows a cast's landings twice over (both paths of a jump)

- **What happened:** the brief put Fervent Morale on "a guessed SP model"; the cause was that the replay landed six
  slashes for one Pogranichnik combo (the pins on the 4-stack path's frames, the 3-stack path's own beside them), so his
  bank got both paths' SP. It showed only as "replay only" LAND lines at the same ms as pinned ones in `zmdlogs replay`,
  found after a scratch probe of each combo's landed hit ids (scratch/pg-combo.ts) and a grep over five logs' replays;
  about an hour. `zmdlogs decisions` has JUMPDROP for a jump the pins contradict, nothing for a jump kept with pins in
  its skipped part.
- **Cause:** pinned landings survive a jump (schedule.ts jumpCast keeps `pinned`), and nothing records a cast whose
  landed hits exceed its kit path; the views list landings, not casts' landing counts.
- **Suggestion:** a decisions kind (or a FLAG in `zmdlogs replay`) for a cast that lands more hits of an id than its
  path has, or a pinned landing in a skipped part of a jump it kept; drivers.ts replayCast can record it beside
  `dropped`.
- **Files:** packages/engine/src/timeline/drivers.ts, packages/logs/src/decisionsview.ts, packages/logs/src/replayrun.ts
- **Why it helps:** a double landing changes SP, stacks and triggers (here a team buff's timing in four logs) while each
  landing looks plain; one line per case would have pointed at it at once.

## 2. A kit buff's windows against the log's lanes take two commands and an eye

- **What happened:** to compare Fervent Morale's applications I ran `zmdlogs raw … --buffs` (the log's lanes) and
  `zmdlogs replay --kit-buff` (the replay's windows) per log and lined the start times up by hand, five logs, several
  rounds as the fix changed.
- **Cause:** the two sides print in different commands and formats; `zmdlogs differences` groups per hit, not per
  application.
- **Suggestion:** `zmdlogs lanes <fixture> --kit-buff owner:id` (or `replay --kit-buff --against-lanes`): each logged
  lane start beside the replay's nearest window start and the offset, unmatched ones on each side.
- **Files:** packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts
- **Why it helps:** a buff's application timing is the usual question after a kit trigger fix; a paired list makes it
  a diff instead of a reading.

## 3. measure --split files fails on a change whose files import each other's new exports

- **What happened:** `measure --split files` reported three of the change's files "not measured alone" (a new export
  in paths.ts used by drivers.ts, timeline.ts and castassembly.ts), so the split said nothing about the path rule; the
  message suggests `--group`, which needs a second run.
- **Cause:** parts are single files by default; the import graph between the changed files isn't used to group them.
- **Suggestion:** group automatically the changed files that import a symbol another changed file adds (or retry a
  failed part together with the files its error names), and say which group each part is.
- **Files:** scripts/measure.ts
- **Why it helps:** saves a re-run (minutes under the lock) for nearly every change that adds an engine export.

## What worked well

The placement dump diffed against the base (`at-commit.ts --run` with a small scratch script) listed every pairing the
slot rule moved in all logs in two minutes, which caught the first version moving 7910's stares; `measure --hits` named
the Breach's Arts Intensity as the c4f3 regression directly from its modifier lines.
