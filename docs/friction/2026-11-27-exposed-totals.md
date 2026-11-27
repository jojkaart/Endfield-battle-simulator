# Exposed totals: 207f, d774, a9d7 and 3f78's Rossi combo 3 (2026-11-27)

Task: the fight totals the attack-4 round exposed (207f, 3aa6, d774, 9847, a9d7) split by operator and landing kind and
fixed with mechanisms, and 3f78's Rossi combo 3 made inside combo 2's frames; base main 03cf43a.

## 1. No view says that a log-only buff reached a hit of an element its game buff doesn't reach

- **What happened:** 207f's Rossi was +6.9%, 41 hits from 21 to 36 s at ×0.847. `zmdlogs groups` blamed
  `wpn_sword_0022.layer`, `suit_criti01.atk` and Si's `enemy_vul` (the kit buffs the log lists differently); the
  cause, Hard 27's stage Electrification added to physical hits, showed only as one `log buff …:damageTaken 0.24` among
  forty modifiers in `hits --zones`, found by dividing 1.33 by 1.57 by hand and reading the buff's `gamedata tree`
  (its damageModifier's CheckDamageTypeMask 92). About 20 minutes.
- **Cause:** logeffects.ts maskReaches reads only CheckDamageDecorateMask (the skill-type mask) into
  RawBuffFile.damageMask; a game buff's CheckDamageTypeMask (the element mask) isn't read at all, so a log-only buff
  without an element in the log applies to every element, and nothing flags it. The stage Electrification is now
  special-cased (enginecheck.ts stageElements); any other log-only buff with an element mask still isn't.
- **Suggestion:** read CheckDamageTypeMask in packages/data/src/buffData.ts (per damageModifier, with its CompareFloat
  conditions on dynamic keys: unconditional masks only, or the union where a condition's key is never set) into a
  `damageElements` field, have logModifiers give a log effect without an element those elements, and drop
  stageElements. Until then, `groups` could print, per own mismatch group, the log-only modifiers (`log buff …`) of
  its hits, since those are what the replay can't verify.
- **Files:** packages/data/src/buffData.ts, packages/logs/src/logeffects.ts, packages/logs/src/enginecheck.ts,
  packages/logs/src/views.ts (groups).
- **Why it helps:** a log-only buff on the wrong element is a whole-fight factor (×0.847 on 41 hits here) that no
  difference line shows; reading the mask makes it impossible rather than findable.

## 2. A kill without an uncapped value looks like an over-prediction

- **What happened:** 207f's largest single error was Rossi's ultimate final, 1,134,403 logged against 1,218,124
  (−6.9%, 1.8% of the fight): a mismatch in `groups` ("wpn_sword_0022.final replay only"), "read" in `totals --by
  crit`. I spent a while on damage zones (0.931 = final ×0.3? seven layers? Si's amp?) before noticing the fight's
  total was 5.7600 × the data's Max HP, i.e. a kill whose last hit the log didn't mark capped.
- **Cause:** a kill was recognised only by the log's `uncapped` field, the data's Max HP exactly, or lastLifeKilled;
  `totals` prints "time to kill" only when it found one, and nothing prints the total as a multiple of Max HP.
- **Suggestion:** `zmdlogs totals <fixture>` prints, on its team line, the logged total ÷ the data's Max HP and how
  the kill was found (uncapped, Max HP, lives, stage-scaled, none): a ×5.7600 with "none" would have said it at once.
- **Files:** packages/logs/src/views.ts (totals), packages/logs/src/enginecheck.ts (fightTotals: return the kill's kind).
- **Why it helps:** the last hit of a kill is often the fight's largest; misreading it as a model error costs a dive
  into zones each time.

## 3. The placement's choice between a skill's paths for a new cast is invisible

- **What happened:** for 3f78's combo 3, `zmdlogs casts` showed `combo_3_skill@49.59 #0 frame 29` and `replay` showed
  INSIDE and JUMPDROP, but nothing said that the placement had another slot (the late hit at 227, 15 frames after the
  jump) that would have put the cast after combo 2's window. I found it by reading `efsim kit Rossi` (paths) and the
  SkillData's timeline (the JumpToAction inside the IfElse) and working the frames out by hand.
- **Cause:** slotsOf orders a key's slots by kit frame, ignoring the skill's jumps, and the CAST line prints only the
  slot taken.
- **Suggestion:** the CAST line names the alternatives a first landing had on another path (pathTwin), each with the
  start it would give, and whether the operator's previous cast allows it (jumpedFirst's test), e.g. `[late@227 on
  0→212: start 50.05, allowed]`.
- **Files:** packages/logs/src/logcasts.ts (jumpedFirst, a record on LoggedCast), packages/logs/src/views.ts (casts).
- **Why it helps:** a cast placed on the wrong path drops jumps and adds statuses (a Vulnerable stack here) that show up
  seconds later on another operator's hits; seeing the alternative at the cast saves the frame arithmetic.

## 4. A value the replay reads team-wide "unquantified" hides behind the fix that changes it

- **What happened:** after the combo-3 fix, 3f78's hits from 58.90 s went from −0.5% (one Vulnerable stack too many) to
  +1.7%, which looked like the fix overshooting. It was Corrosion's ramp (ignoreResistance 18.27 against the game's
  20.23), present before at 54.65 s and merely hidden at 58.90 s by the extra stack. Found by diffing `--zones` of a
  plain and an unquantified hit 0.3 s apart by hand (two runs and a `diff`).
- **Cause:** `cli-ab.ts` shows the lines that differ, not why; `hits --zones` prints every modifier on one line, so two
  hits' zones are compared by hand.
- **Suggestion:** `zmdlogs hits --against-hit <t>` (one fixture): each hit's zones and modifiers printed as the
  difference from the given hit's (only what differs: `resistance 1.183 vs 1.202; Corrosion level 2 ignoreResistance
  18.27 vs 20.23`).
- **Files:** packages/logs/src/views.ts (hits), packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** a plain neighbour is the usual reference (open-problems' header says so for listings); for zones
  there's no tool, and the difference is usually one modifier.

## What worked well

- `zmdlogs totals --by event` and `--by crit` pointed at the right hits in seconds in every fight.
- `npm run measure -- --base HEAD` against a WIP commit isolated each change; its better / worse lines made the
  decision quick.
- `zmdlogs raw --events` showing the Stagger origin per hit settled which skill a shared key's hit was.
