# Misprediction candidates worked (2026-11-24)

Task: work through the misprediction analysis's candidates (the weapon "ready" buffs, the ×1.5 band, the fight-wide
factors below the offsets screen, the one-buff list's largest), find causes and fix them; branch
worktree-agent-a5ff74675a35a6740 from a4f6ddb.

## 1. A log buff no kit buff stands for is silently added beside the kit buff that it is

- **What happened:** the analysis ranked the Endministrator's and Chen Qianyu's weapon "ready" buffs as a consumption
  problem (2.8% of the error) and suggested reading BuffData for what consumes them. The cause was elsewhere: the
  hits list `buff_wpn_sword_0021_valid`, the attached buff with the modifier, and the kit buff's gameBuff is the
  modifier-less `_exist`, so the check added the listed `_valid` as an unmapped "log buff" on top of the kit buff
  (the hit row's `mods` showed both `kit …:wpn_sword_0021.ready` and `log buff buff_wpn_sword_0021_valid` at 0.648).
  Finding it took reading one stats row by hand; the `differences` entry said only "engine has it, the log doesn't",
  which reads as a state error. A ten-line scan (scripts/probes/stats/doublecount.py: a kit buff and an unmapped log
  buff with the same zone and value at one hit) then found Yvonne's P5 child the same way (72 hits).
- **Cause:** the check has no notion of "a listed game buff whose effect equals an active kit buff's": an unmapped
  listed buff with modifiers is added, and the difference view reports the kit buff as engine-only. The kit side
  (`loggedAs`) existed, but nothing pointed at the missing entries.
- **Suggestion:** in packages/logs enginecheck/logcheck, flag a hit where an unmapped listed game buff carries the same
  zone and value as an active kit buff of the same owner (or the same equipment prefix: `buff_wpn_sword_0021_*` against
  `wpn_sword_0021.*`) as a "likely loggedAs" in `zmdlogs differences` and in `efsim kit-census` (or a test that fails
  on a new pair across the development logs, like the offsets screen). Also: the kit loader could warn when a kit
  buff's gameBuff has no attributeModifier while a sibling BuffData file (`_valid`, `_up`, `_pdi_up`) created by
  CreateBuffAttachingSkill under the same skill does.
- **Why it helps:** it turns a two-hour hunt into a listed suggestion; double counts look exactly like state errors in
  every current view.

## 2. The enemy's HP: a hidden "undefined" made two potentials silently off

- **What happened:** Chen Qianyu's P1 (below half HP) and Alesh's P5 ultimate (×1.5 below half) were off in every
  stage fight and every fight against Si because `loggedEnemyHp` returned undefined unless the logged total was the
  data's Max HP; a condition on an unknown HP read as "full HP" (`before.enemyHp ?? 1` in landing.ts). Nothing in
  `zmdlogs check`, `differences` or the stats tables said the replay had no HP. In-game test 69 sat "ready" for a
  month on a reading (7e19) that a later log (a27b) already decided.
- **Cause:** an unknown fact defaulting to a value, without a mark on the hits it decides.
- **Suggestion:** where a hit's reading depends on a fact the replay doesn't know (enemy HP undefined under an
  `enemyHpBelow`, and similar), give the verdict an assumption label ("enemy HP unknown: P1 off") and try the other
  reading as an alternative, so it shows in `groups` and the stats' first explanations. And a periodic check that
  re-reads "ready" in-game tests against logs imported since (test 69's question was answerable from a27b).
- **Why it helps:** both potentials were 20–50% of a hit, in about ten fights, found only through a ratio cluster.

## 3. The replay's views don't say why a logged cast event wasn't made

- **What happened:** 9c0b's Si ultimate at 7.02 s was shown as "a press of its own (the skill's hits show
  elsewhere: a slot press)" by `zmdlogs replay`; the real reason (not enough ultimate energy, 0 of 68) took a
  temporary debug print inside `replayedSkill` (`earliestStart`'s error string).
- **Cause:** `loggedCastFates` (views.ts / buffreplay.ts) computes its own fate without the replay's decision; the
  replay records no reason for a slot press it skipped.
- **Suggestion:** record in the replay run why each logged cast event was skipped (replayedSkill's branch and
  earliestStart's error) and print it on the EVENT line ("skipped: needs 68 ultimate energy, 0.0").
- **Why it helps:** skipped presses are a class of one-sided errors (a whole Amp window here); the reason is the next
  step every time.

## 4. Placement choices between skills sharing a key are invisible

- **What happened:** Ardelia's attack 1 was placed as attack 2 because `choose` (logcasts.ts) walked back past her
  attack 3 and combo to an attack 1 five seconds earlier. The ×1.5 ratio and `zmdlogs casts` showed the wrong skill,
  but not why it was chosen.
- **Suggestion:** `zmdlogs casts --why` (the same idea as `holds --why`): for a cast whose key several skills share,
  print the candidates and which rule picked it (anchor, window of which earlier cast, fallback).
- **Why it helps:** the same kind of bug (a shared key) was the Empyrean combo's and now Ardelia's; the next one will
  be found faster.

## 5. Measure's summary can't say which change moved a hold-out

- **What happened:** with two changes in the tree, the hold-out mean |damage error| went 8.0 → 8.7 → 8.5%. Splitting it
  needed separate measures per change (each about two minutes plus the lock's queue, seven in this task).
- **Suggestion:** `measure --variant` already exists for assumption readings; a `--split <commit range>` (each commit's
  own effect against its parent, one run each, printed as one table) would answer "which commit moved what".
- **Why it helps:** fewer chained measures; a mixed result is attributed without guessing.

## What worked well

- The stats tables (scripts/probes/stats/build.ts) as a JSONL per hit: every question here was a 20-line script over
  them, with the counterfactual readings (`cf`) saying at once whether a difference taken the log's way fits.
- `zmdlogs fit-build`'s "clean hits" count: it ruled out Liino's factors as builds in one command each.
- `node scripts/cli-ab.ts HEAD -- <efsim args>`: the diff of `casts` and `totals` showed each fix's effect per fight.
- `scripts/edit.ts` for multi-block edits and `verify-at.ts` for the new test failing at HEAD.

## Outcome (round 11)

- 1 (A log buff no kit buff stands for is silently added beside the kit buff that it is): the screen done (016d623):
  packages/logs/src/loggedas.ts pairs a kit buff's modifier with a log-only listed buff (enginecheck.ts logOnly) of
  the same zone, element and value, from the kit buff's owner or under its equipment's id: `zmdlogs differences`'
  last section ("none" over the development logs now), and the pending suite fails on a pair LOGGED_AS_EXPLAINED
  doesn't name. The kit loader's warning from the data carried (2026-11-24-backlog-after-round-11.md point 9).
- 2 (The enemy's HP: a hidden "undefined" made two potentials silently off): the assumption label carried
  (2026-11-24-backlog-after-round-11.md point 7: the check's core and the engine's landing); the periodic re-read of
  "ready" in-game tests done as a CLAUDE.md line (a log imported for any task is checked against the ready tests a log
  could answer).
- 3 (The replay's views don't say why a logged cast event wasn't made): carried
  (2026-11-24-backlog-after-round-11.md point 3): buffreplay.ts's replayedSkill, the accuracy agent's.
- 4 (Placement choices between skills sharing a key are invisible): carried (2026-11-24-backlog-after-round-11.md
  point 8): logcasts.ts's choose, the accuracy agent's.
- 5 (Measure's summary can't say which change moved a hold-out): done (48f6676, b7f6e6f): `measure --split commits
  --base <ref>` (and `--split files`), the hold-outs counted per part.
