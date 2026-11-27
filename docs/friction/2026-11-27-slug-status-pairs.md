# Hard 33's slug and status pairs a buff's edge put off (2026-11-27)

Task: the slug logs (6339, 7b54: their mechanics from the data and the logs) and the status pairs whose replay value
a buff's edge put off (1d91, a7a7, e989, 7910, abfd); worktree branch off main at a6c425f.

## 1. A wrong premise lived in open-problems.md for weeks: one enemy where the stage text says "legion"

- **What happened:** "Hard 33's slug" (docs/open-problems.md) and five rounds after it read 6339 and 7b54 as one
  enemy with lives, phases, purges and a hidden shield. The stage's own description (I18nTextTable_EN, the
  DungeonTable entry's dungeonDesc id) says "They are legion" and describes several slugs; the logged totals were
  9.600 Max HP in both fights (eight slugs of 1.2). Finding it took one `jq` on DungeonTable and one lookup in the
  555me I18n table; nothing in the repository's tools prints a stage's text, so no earlier round looked.
- **Cause:** `efsim gamedata tree / who / find` read BuffData and SkillData only; the enemy's tables (EnemyTable,
  EnemyAttributeTemplateTable, DungeonTable, the I18n text) have no command, and `gamedata tree eny_…` answers "no
  BuffData or SkillData file of that name".
- **Suggestion:** `efsim gamedata enemy <enemy id | fixture>`: the EnemyTable row (template, AI template, born buffs),
  the attribute template at the fixture's level (Max HP, ATK, DEF, resistances), every DungeonTable entry naming it
  with its English name, description and feature text (I18nTextTable_EN), and the common BuffData files that name the
  enemy's id (the numshield files did). Also: the logged total ÷ Max HP when given a fixture.
- **Files:** packages/cli/src/commands/gamedata.ts, packages/data (an I18n reader), docs/design/data.md's question
  table.
- **Why it helps:** a stage's mechanics (shields, several targets, phases) are written down in its description; a
  diagnosis of any stage log would read it first, in seconds.

## 2. The listing's meaning for several targets is nowhere

- **What happened:** the check's "log reading" was −10 to −30% off in 7b54 too, which read as "debuffs listed but not
  acting". It was the listing being every slug's debuffs under the one id (7b54's Laevatain attack 1 at 5.27 and
  10.99 s: one listing, 1,927 and 1,608). Nothing in the docs says what ZMDLogs lists when several enemies share an
  id; I worked it out from two hits.
- **Cause:** docs/design/data.md "What the log records" describes a hit's effects list as the hit's own.
- **Suggestion:** a line there: under one enemy id the listing is the id's (every target's debuffs); a fight marked
  `severalTargets` can't be judged by the listing's debuffs. And `zmdlogs hits --same-listing` could flag hits of one
  key and listing whose values differ by more than a crit (two targets).
- **Files:** docs/design/data.md, packages/logs/src/hitexport.ts (same-listing).
- **Why it helps:** the next multi-target-under-one-id stage is recognised from the listing in minutes.

## 3. A reading that needs the replay's state at another frame had no handle

- **What happened:** the status pairing needed a landing's damage again from the replay's state at the logged hit's
  frame. BuffReplay keeps `stateAt` local to one block, and the engine's damageOptions wasn't exported; I re-wrote
  stateAt in the pairing block and exported damageOptions from the engine's timeline barrel.
- **Cause:** the replay's states (checkpoints + advance) are a private detail of buffreplay.ts; each new question
  copies the helper.
- **Suggestion:** one `stateAt(frame)` and one `optionsAt(operator, frame)` on the replay run (replayrun.ts's result),
  used by buffreplay.ts's both blocks and any view.
- **Files:** packages/logs/src/buffreplay.ts, packages/logs/src/replayrun.ts.
- **Why it helps:** the next "read it at the log's time" question is one call.

## 4. Several measures in a row because the variant code is fixed at queue time

- **What happened:** I queued a five-variant measure, then improved the reading while it ran (40 min under load);
  the variants measured the old reading, so a second five-variant measure followed (another 30 min).
- **Cause:** by design (measure fixes the code when queued); the cost is that a variant list queued early can't
  include the reading found while waiting.
- **Suggestion:** none structural; a note in docs/design/tests.md's measuring section: queue the variants once the
  reading's code is settled, and use `zmdlogs bursts|hits --assume` on the few logs in question first.
- **Files:** docs/design/tests.md.
- **Why it helps:** saves a measure round for the next agent.

## What worked well

- `zmdlogs totals --kinds`, `zmdlogs bursts` (the twin lines) and `measure --variant … --hits` answered every
  question; the hits lists named the modifier each changed verdict lost or gained.
- `--assume` on every view: the new readings could be checked on single logs before any measure.
- scripts/edit.ts for the long assumption texts with backticks.
