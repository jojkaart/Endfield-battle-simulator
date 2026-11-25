# Backlog after improvement round 11 (2026-11-24)

Task: the points of the reports round 11 read (docs/friction-done/2026-11-24-round-11.md lists them) that round 11
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 11)"
section. Points 1–5 are round 10's backlog's (1, 2, 4, 5 and 6 there), carried once more; 6–13 are new. Most need a
file another agent held this round (the replay, the placement, the check's core, the kit compiler, the engine): each
says which. The parked list and the accuracy list follow.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A slow-down's identity through the stop lists and the replay's record

- **What happened:** pairing the timeline's applied slow-downs with the log tools' stop lists by start frame and
  caster gave 52 length differences that went into a commit message (95cf3f6) before the view showed 0c14's Rossi
  combo_3 with "12 frames: the list has 19" beside "19 frames: as listed": her two frame-0 dilations had collided on
  one key (round 8). The replay's record merged two slow-downs of one start and priority the same way (stop-lists
  report point 2: Purrchena's shielded combo printed "the list has 20 frames" for an 18-frame one).
- **Since round 9:** the compiler gives each compiled slow-down its dilation's index in the skill file
  (SkillTiming.slowdowns `n`, packages/data/src/skillData.ts; SkillDilation `n`), and `gamedata dilations` matches
  by it. Nothing downstream carries it yet.
- **Since round 10:** round 9's own report (point 3) hit it again: TimeStop lives in logcasts.ts, AppliedStop in
  replayrecord.ts and their pairing in views.ts, so the change spans the placement's modules. First step, a move
  only: a packages/logs/src/stops.ts with TimeStop, AppliedStop, stopsAgainstList and the identity key, imported by
  the three (behaviour-preserving: `zmdlogs stops --all --differ` and `replay --stops` identical by
  `node scripts/cli-ab.ts <base> -- …`), when no accuracy agent holds logcasts.ts or replayrecord.ts.
- **Since round 11:** `zmdlogs stops --all --differ` over the 61 logs reads as listed 1376, covered 36 (14 logs),
  length 0, timeline only 2 (2 logs), list only 0 (the views now leave out the hitless events the replay read as a
  buff's tick: query.ts replayTimeStops with the replay). Not hit by a new report this round: parked after the next
  carry without one.
- **Suggestion:** carry `n` (and the skill) into TimeStop (packages/logs/src/logcasts.ts skillStops: `...d` or `n:
  d.n`), TimelineState.slowdowns (engine timeline/clock.ts slowDown's push: `n: d.n`, keep it out of search.ts's
  state key if one reads slowdowns) and AppliedStop (replayrecord.ts, keyed by the state's slow-down object or by
  (start, caster, n) in place of start|caster|priority|kind); then pair by (start, caster, n) first in views.ts
  stopsAgainstList. `zmdlogs stops --all --differ` before and after: the counts must stay (or explain each change).
- **Why it helps:** the next comparison of the stop lists (the accuracy list's "the lists from the timeline")
  pairs exactly, and a count that goes into a commit is right the first time.
- **From:** docs/friction-done/2026-11-23-round-8-friction.md point 2; docs/friction-done/2026-11-23-stop-lists.md
  point 2; docs/friction-done/2026-11-23-backlog-after-round-9.md point 1; docs/friction-done/
  2026-11-24-backlog-after-round-10.md point 1.

## 2. A logged hit placed in the wrong slot is invisible in the totals' parts

- **What happened:** Mi Fu's attack 3 in a27b: the logged hit_2 (5,896) was matched to `hit`'s second landing
  (predicted 2,905), so the totals showed a matched −2,991 and a replay-only hit_2 +5,896, a "cast tail" in the kinds
  although nothing is missing. Finding it took the replay view and the kit's frames side by side; 9a80's Si combo
  final (6.6% of the fight) is the same. The one-sided classification can't see it, because one side is matched.
- **Cause:** TotalPart (enginecheck.ts) keeps the operator, skill, hit and frame but not the landing's cast, so
  "matched to a different hit of the same cast than its value says" needs a scratch script that re-derives the
  landings from the parts by key and frame.
- **Suggestion:** carry the landing's cast index in TotalPart (fightTotals, enginecheck.ts: `cast: l.cast`), flag a
  matched part whose logged value fits another landing of its cast within 5% while its own prediction is off by more
  than 15% (`slot?` in `zmdlogs totals --kinds`), and export the parts like the one-sided landings (`zmdlogs totals
  --all --json --parts`, cached beside them: reports.ts FightTotals, round 10).
- **Why it helps:** the next placement fix (slots by value) starts from a count instead of a hunt.
- **From:** docs/friction-done/2026-11-23-one-sided.md points 1 (the parts export) and 3; docs/friction-done/
  2026-11-24-backlog-after-round-10.md point 2.

## 3. A landing or a press the replay drops leaves no reason in its views

- **What happened:** Snowshine's bashes vanished silently: the replay printed no NOLAND reason beyond "a landing the
  replay didn't land", no FAILED, no CUTS. That the cast's end at frame 106 dropped a pinned landing at 125 took a
  scratch script, the SkillData timing by hand and the kit JSON for the `attacked` trigger's jump. Round 10's `efsim
  kit` now prints the ends and the triggers' jumps ("paths:"), but the replay still says nothing. The same for a
  press (stats-candidates report point 3): 9c0b's Si ultimate at 7.02 s showed as "a press of its own (the skill's
  hits show elsewhere: a slot press)"; the real reason, not enough ultimate energy (0 of 68), took a temporary debug
  print inside buffreplay.ts `replayedSkill` (`earliestStart`'s error string).
- **Cause:** the replay records what it made, not why it didn't make or land something; `loggedCastFates`
  (buffreplay.ts) computes an EVENT line's fate from the cast assembly, without the replay's decision.
- **Suggestion:** record in the replay (a) when a pinned landing is cancelled (an end, a jump, a cut: the engine's
  timeline drops it) with its cause: a DROPPED line in `zmdlogs replay` and the one-sided kinds' context for the
  log-only hit; (b) why each logged cast event was skipped (replayedSkill's branch and earliestStart's error), on its
  EVENT line ("skipped: needs 68 ultimate energy, 0.0"), and the fate from the replay's own decision (point 6 below).
  An engine timeline change for (a) (record only: smoke, the identity check of team-ab); (b) is buffreplay.ts's.
- **Why it helps:** "a landing the replay didn't land" is the largest log-only kind in the development logs (1.4%),
  and skipped presses are a class of one-sided errors (a whole Amp window in 9c0b); each would name its cause.
- **From:** docs/friction-done/2026-11-24-physical-statuses.md point 2; docs/friction-done/
  2026-11-24-backlog-after-round-10.md point 4; docs/friction-done/2026-11-24-stats-candidates.md point 3.

## 4. `zmdlogs explain`: each off hit's first explanation from the counterfactuals

- **What happened:** the misprediction analysis needed, per off hit, the reading with one listing difference taken
  the log's way, the crit flipped and each boundary kit buff on or off. scripts/probes/stats/build.ts copied
  hitRecords' composition and re-derived the edge toggles' modifier swap to get them: four builds, about an hour.
- **Since round 11:** HitRecord.counterfactuals (hitexport.ts hitCounterfactuals) has them, in `zmdlogs hits
  --json` and its cache, and build.ts calls the same function (0eef's rows identical to the c6f1874 tables'). Left:
  the view and the hold-outs' share.
- **Suggestion:** `zmdlogs explain <fx…|--all>` printing each off hit's first explanation (one difference / listing
  / boundary / fight-operator factor / class: analyze.py `explain`'s order) with the per-class shares, from the
  records' `counterfactuals` against `graded`; and the same per-class shares in measure's summary for the hold-outs
  (aggregates only: a measure-worker answer like `shares`).
- **Why it helps:** the analysis's largest class (20.4% of the error, the hold-outs' 34%) is exactly "one difference
  the log's way fits"; a fix's effect on it shows at the first measure instead of after a stats rebuild.
- **From:** docs/friction-done/2026-11-24-misprediction-stats.md point 1; docs/friction-done/
  2026-11-24-backlog-after-round-10.md point 5.

## 5. A kit field override's errors come one rule at a time

- **What happened:** adding a logged key to Zhuang Fangyi's `combo_skill_ult` hit took four tries: "no frames, and the
  data's landings aren't one branch path", then (frames written) "events differ from the compiled SkillData", then
  (frames and events in dataOverride) "frames marked as differing but agrees". Only frames written plus
  `dataOverride.events` passes.
- **Cause:** the compiler's checks (packages/data/src) run one at a time and each message names only its own rule.
- **Suggestion:** when a kit hit's `events` differ from the data, one message: "write `frames` (the data can't place a
  landing for a key of another skill), and mark `events` in dataOverride". With point 9 below (the kit loader's
  warning), one pass over packages/data/src's messages.
- **Why it helps:** variant keys shared with a base skill are the likeliest next kit edits.
- **From:** docs/friction-done/2026-11-24-misprediction-stats.md point 4; docs/friction-done/
  2026-11-24-backlog-after-round-10.md point 6.

## 6. The replay's own list of the stops it held, and the EVENT fate from its decision

- **What happened:** the kit-buff leads made Zhuang Fangyi's Empyrean end tick (`ticksLoggedAs`), and `zmdlogs
  replay 4d60` said "a tick of empyrean" at 106.47 s while `casts` drew a 78-frame STOP there and `clock` read the
  Empyrean as cut by the ultimate (kit-buff leads report point 2). The placement leads then left such events out of the
  hold placement's stops (buffreplay.ts, "Not a logged event the replay read as a buff's tick", using the replay's
  made casts). Round 11 made the views agree: query.ts replayTimeStops marks such a stop `tickRead` and, given the
  replay, leaves out those the timeline never applied (`zmdlogs stops --all --differ`: list only 2 → 0, nothing else
  moved); `casts` and `worldtime` mark them. Doing so showed the EVENT fate wrong the other way: 3aa6's seven real
  Zhuang Fangyi ultimates (hits not placed) read "a tick of empyrean" because loggedCastFates decides by the key; the
  EVENT line now says "but the replay made the cast" from the applied stop. So does 4bfc's 179.51 s event, which the
  kit-buff leads judged the Empyrean's end from the log: the replay still makes an ultimate there (its 78-frame stop
  applied, "as listed"), an open replay question for the accuracy agent (tests/slow/log-cases.test.ts now checks the
  key's fate there, and the EVENT text at 92.68 s only).
- **Cause:** the views re-derive from the applied stops what the replay decided (made or not) instead of reading it.
- **Suggestion:** BuffReplay exposes the stop list its hold placement used (`heldStops`, or the made casts' keys) and
  loggedCastFates' "tick" comes from the replay's decision (buffreplay.ts); replayTimeStops then takes that list,
  and views.ts's `tickOrCast` and the `tickRead` filter go.
- **Why it helps:** one truth for what the replay held, in one place; the next kit that ticks as a cast's key needs no
  view change.
- **From:** docs/friction-done/2026-11-24-kit-buff-leads.md point 2.

## 7. A fact the replay doesn't know reads as a default, unmarked

- **What happened:** Chen Qianyu's P1 (below half HP) and Alesh's P5 ultimate (×1.5 below half) were off in every
  stage fight and every fight against Si because `loggedEnemyHp` returned undefined unless the logged total was the
  data's Max HP; a condition on an unknown HP read as "full HP" (`before.enemyHp ?? 1` in landing.ts). Nothing in
  `zmdlogs check`, `differences` or the stats tables said the replay had no HP.
- **Cause:** an unknown fact defaulting to a value, without a mark on the hits it decides.
- **Suggestion:** where a hit's reading depends on a fact the replay doesn't know (enemy HP undefined under an
  `enemyHpBelow`, and similar), give the verdict an assumption label ("enemy HP unknown: P1 off") and try the other
  reading as an alternative, so it shows in `groups` and the counterfactuals (the check's core, logcheck.ts /
  enginecheck.ts readings; the engine's landing.ts for the mark). Moves verdicts (assumed matches): measure.
- **Why it helps:** both potentials were 20–50% of a hit, in about ten fights, found only through a ratio cluster.
- **From:** docs/friction-done/2026-11-24-stats-candidates.md point 2.

## 8. `zmdlogs casts --why`: which rule chose a skill among those sharing a key

- **What happened:** Ardelia's attack 1 was placed as attack 2 because `choose` (logcasts.ts) walked back past her
  attack 3 and combo to an attack 1 five seconds earlier. The ×1.5 ratio and `zmdlogs casts` showed the wrong skill,
  but not why it was chosen; the Empyrean combo's key was the same kind of bug.
- **Suggestion:** `zmdlogs casts --why` (as `holds --why`): for a cast whose key several skills share, the candidates
  and which rule picked it (anchor, window of which earlier cast, fallback): a record of `choose`'s steps in
  logcasts.ts's placement, printed by views.ts castsView.
- **Why it helps:** the next shared-key bug is found from one view.
- **From:** docs/friction-done/2026-11-24-stats-candidates.md point 4.

## 9. The kit loader doesn't warn of a gameBuff without the modifier its sibling has

- **What happened:** the Endministrator's and Chen Qianyu's weapon "ready" buffs name the modifier-less `_exist`
  BuffData as their gameBuff, while the hits list the attached `_valid` with the modifier; the check counted both.
  Round 11's likely-loggedAs screen (packages/logs/src/loggedas.ts: `zmdlogs differences`, and the pending suite
  fails on a new pair) finds the double count from the logs; nothing finds it from the data before a log does.
- **Suggestion:** the kit loader (packages/data/src) warns when a kit buff's gameBuff has no attributeModifier while a
  sibling BuffData file (`_valid`, `_up`, `_pdi_up`) created by CreateBuffAttachingSkill under the same skill does:
  "list it as `loggedAs`".
- **Why it helps:** the next weapon with an attached buff gets its loggedAs at the kit, not after an analysis.
- **From:** docs/friction-done/2026-11-24-stats-candidates.md point 1 (its second suggestion).

## 10. A kit hit's frame is ambiguous for landings on their way

- **What happened:** Liino's Pyrotechnics are `detached` at frame 76, but they land 0.1–0.8 s of world time after it
  (dbae: the beat at frame 77 at 8.26 s, the projectiles at 8.61 s). The placement treated the frame as the landing's
  and placed the cast up to 3.5 s late (af7b); the fix had to infer travel from the log (logcasts.ts eventStopStart).
- **Cause:** KitHit.frames means the damage frame for most hits and the launch frame for projectiles.
- **Suggestion:** a KitHit field (`travels: true`, or a `travel` range) the compiler sets for hits from a
  LaunchProjectile / a projectile ability entity, read by logcasts.ts (a landing's frame then bounds the start) and
  by the simulator. The accuracy agent's (kit compiler, kits, placement): the lead's brief named it theirs.
- **Why it helps:** no event-and-contradiction heuristic per such skill; Si's slashes, which don't travel, need no side
  condition.
- **From:** docs/friction-done/2026-11-24-placement-leads.md point 2.

## 11. A trigger's cooldown state has no trace

- **What happened:** under trigger-cooldowns=world the replay still made de6a's Swordmancer procs; only a temporary
  stderr print in the engine's clock.ts showed the ready frame landing exactly on the Lift's frame (15.01 s of world
  time) and that the hidden holds didn't hold the timer.
- **Suggestion:** `zmdlogs replay --trace-trigger owner:id`: each firing, its ready frame and every shift of it (the
  step that made it), as `--trace-buff` does for expiries: a ReplayOptions.trace kind recorded by replayrecord.ts from
  TimelineState.triggerState, printed by views.ts replayView (buffreplay.ts / replayrecord.ts this round's other
  agent's).
- **Why it helps:** a cooldown question is one command, without editing the engine.
- **From:** docs/friction-done/2026-11-24-placement-leads.md point 4.

## 12. An engine reading can't be narrower than "every trigger"

- **What happened:** Swordmancer's 15 s cooldown runs on the world's clock; the only switch is engine assumption
  `trigger-cooldowns` for every kit trigger, and `world` for all of them failed four kit tests and moved two hold-outs
  worse, so the fix stayed behind a non-default reading.
- **Cause:** a kit trigger's `cooldown` doesn't say where it comes from (AddGlobalCDTimer, a buff's addingCooldown, a
  skill's cooldown).
- **Suggestion:** the compiler records each trigger cooldown's source on the trigger (`cooldownFrom: "globalCdTimer" |
  "addingCooldown" | …`); engine readings select by it. The accuracy agent's (kit compiler, engine): the lead's brief
  named it theirs.
- **Why it helps:** a finding about one game mechanism becomes one switch over exactly the triggers that use it.
- **From:** docs/friction-done/2026-11-24-placement-leads.md point 5.

## 13. The burst view's causes are a heuristic

- **What happened:** round 11's `zmdlogs bursts` (packages/logs/src/burstsview.ts) names each burst's likely cause as
  the operator's latest inflicting hit at least the burst delay of world time before it, because the replay records
  neither inflictions (status.ts "inflicted" events are dropped in recordStatus) nor a burst's source hit
  (PendingBurst has `fromCast` and `fromKind`, the burst's landing neither).
- **Suggestion:** keep the burst's source on its record (the PendingBurst's infliction frame and cast in the burst
  StatusEvent or the landing: engine landing.ts delayBursts / landBurst), and have burstRows read it in place of the
  search.
- **Why it helps:** a burst across a stop or on old stacks names its real cause; Arcane's burst clock question starts
  from facts.
- **From:** this round's own work (docs/friction/2026-11-24-round-11-friction.md).

## Parked

A new report that hits one brings it back with its full text from there.

Round 10's backlog's points 3 (measure --split) and 7 (analyze.py's speed) are done (round 11); none parked this
round.

Round 9's points (full text in docs/friction-done/2026-11-23-backlog-after-round-9.md under the same number):

- 2. A kit value written as "the data's length minus what the engine holds" (an extendBuff `pauseFrames` form:
  engine timing, smoke, team-ab).
- 3. No test that a hit's replay-only and log-only twins don't come back (cheaper since round 10: a count of the
  `twin like` / `twin other` contexts in snapshotEntry's `oneSided`, in the pending suite; its bound is an accuracy
  agent's).

Round 8's point (full text in docs/friction-done/2026-11-23-backlog-after-round-8.md under the same number):

- 1. A layered or consumed buff's layers, per hit and per cast, log against replay (`logReading` as an object,
  `zmdlogs consumed`, `zmdlogs layers`; `hits --zones` covers part of it since round 8).

Round 7's points (full text in docs/friction-done/2026-11-23-backlog-after-round-7.md under the same number):

- 2. `zmdlogs clock`'s remainders: `--on/--off` cast brackets, `--all` in place of scripts/probes/buff-clock/lanes.ts,
  the owner's trigger hit after the end with its origin.
- 5. Probes have no "still runs" check (none rotted; round 11 ported two, ult-events.ts and onebuff.py, onto
  library calls).
- 7 (the rest). `zmdlogs statuses <fixture>`: the replay's status events with the logged status hits interleaved.

Round 6's points 1–10, 12 and 14 (full text in docs/friction-done/2026-11-23-backlog-after-round-6.md under the same
number):

- 1. groups: off under both readings or only under the replay's (split by logError, FORCED casts as a cause).
- 2. No interval selectors in census (`stagger:`, `control:<op>`, `--inside`).
- 3. A ticking buff's ticks and holds: logged against replayed (`zmdlogs ticks`, `--trace-buff` nextTick).
- 4. A cast's two variants both landing raises no flag (CastFlag "both-variants").
- 5. One skill's hits across logs with their zones (`hits --operator --event --zones`).
- 6. `differences` blames the applying hit for a buff it creates ("created by this hit").
- 7. A no-landing reason that hides an unlogged crit.
- 8. Open rule questions go stale as the engine moves (`examples/<team>.questions.json`).
- 9. Who inflicts what, as a team table (`kit-census --team`).
- 10. A buff's holds past its modelled end need a kit edit (`--buff-duration`; `measure --patch` covers measuring).
- 12. `zmdlogs instances` and the replay's casts disagree silently (`instances --replay`).
- 14. smoke and snapshots read the tree when their turn comes.

Round 5's points (full text in docs/friction-done/2026-11-22-backlog-after-round-5.md under the same number):

- 1. Game-data file reads scattered; table files keyed by size and time (one dataFiles.ts module, exact cache key).
- 2. Status-event landings record no `facts` (`statusFacts` on LandedHit).
- 3. Status and Stagger modifiers identified by their `source` text (`Modifier.status`).
- 4. Test files carry copies of the same helpers (move onto tests/helpers/, drop @efsim/cli's re-export).
- 5. SP kept path-independent by a snap (an SP anchor, only when a shortcut needs it).
- 6. Fixed-length search times not documented (a table in docs/design/search.md).
- 7. Prose citations of doc sections and source paths not checked (extend scripts/check-links.ts).
- 9. Status log keys only in a doc table (`STATUS_LOG_KEYS`; a lane's `since` semantics).
- 10. The importer has no test of its own (on tests/helpers/zmdlogs.ts `syntheticDetail`).
- 11. No shared measure of teammates' attack share (`zmdlogs pace`).
- 13. The cast table's gaps and units (`SkillInstance` world gaps and cooldowns, branded ms / frames).
- 14. The weapon breakthrough table isn't loaded (needs the lead: tables.json, fetch-data in the main checkout).
- 15. A generic "in her ultimate" rules cue (`{ "inUltimate": op }`; team-ab).
- 16. Kit tests pin absolute expiries (`expectLasts`).
- 17. Loop tests depend on engine readings they don't test (pin `options.assume`).
- 18. Test texts in step with the kits (a kit-census warning).
- 19. Kit notes may rest on disabled actions (`efsim gamedata dilations` lists the switched-off dilations).
- 20. Who wears what; an operator's event keys (`zmdlogs list --weapon/--gear`, `census --by-key`).
- 21. `--assumptions` doesn't run the engine's readings (cli/assume.ts `alternatives()`).

## Needs an accuracy or search task (not friction work)

- **The build-offset screen's open lead** (round 9, `efsim zmdlogs offsets --all`; packages/logs/src/buildoffsets.ts
  OFFSETS_EXPLAINED): Snowshine in 04d4, ×0.962 on 77% of her 193 counted hits; `zmdlogs fit-build 04d4 --operator
  chr_0014_aurora`'s best needs two inputs (weapon level 51 and a food, 91 of 207 fit): undecided. And Purrchena in
  99fb (level 1 in the export, ×2.47): fit-build doesn't vary an operator's level (a buildfit.ts candidate set: the
  operator's level, its promotion following). A fitted override moves the verdicts: measure, snapshots:update; drop
  the OFFSETS_EXPLAINED entry with it.
- **The log tools' stop lists from the timeline's applied slow-downs** (docs/friction-done/2026-11-23-remaining-leads.md
  point 3): BuffReplay.appliedStops has them; replayedCastStops could read the first run's, so a cast cut early or a
  kit trigger's jump shows. `zmdlogs stops --all --differ` gives what is left in a few minutes: two timeline-only
  slow-downs (3f78's Rossi at 50.13 s and one more), no list-only one since round 11. Moves the placement: measure.
- **Ramp readings anchored on the application's logged ms** (docs/friction-done/2026-11-23-ramp-slowdowns.md point 2):
  where the applying hit landed before a stop and was logged at its end (a7a7 3.86 s, 489c 49.31 s) every reading of
  the instance looks over-held. Pair bounds between consecutive readings of one instance (scripts/probes/corrosion/
  ramp-pairs.ts) and a softer application bound. Moves the placement: measure, the negative control.
- **`launch` delays the next cast, `beside` casts included** (docs/friction-done/2026-11-22-liino-beats.md point 4):
  exempting `beside` casts from timing.ts `ownHitsLanded` changes engine timing; smoke and team-ab.
- **Which skill a logged press is** (docs/friction-done/2026-11-22-yinglung-edge.md point 4): mark a press and a nearby
  placed variant as alternatives of one slot in withLoggedCasts and let makeCast drop the one the state rules out
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate, and resumable guided searches.
- **Zhuang Fangyi's two extra Sunderblades in 4d60** (physical-statuses report point 3): not Empyrean's free-path or
  Electrification branches (round 10). Still open; the next look is elsewhere in the skill's data.
- **Arcane's bursts** (kit-buff leads): `zmdlogs bursts --all --operator Arcane` (round 11) lists each logged burst
  against the replay's with each side's likely cause and the stops between: the first table for test 33's element and
  the burst's clock across her own ultimate's stop.

## What worked well

Every report named the episode its fix would have shortened (4d60's 106.47 s, 3aa6, e82d 9.12 s, 9c6e, 1cd1, the
placement leads' commit range), so each change was tried on that episode at once; `cli-ab` over `zmdlogs stops
--all --differ` turned "the views now agree" into a two-line diff.

## Outcome (round 12)

- 1 (A slow-down's identity through the stop lists and the replay's record): parked (carried twice, no new report:
  docs/friction/2026-11-25-backlog-after-round-12.md, "Parked", round 11's point 1).
- 2 (A logged hit placed in the wrong slot is invisible in the totals' parts): parked (the same).
- 3 (A landing or a press the replay drops leaves no reason in its views): done (9009c2b): BuffReplay.droppedLanding
  (landingWatch follows every pinned landing through the steps: another alternative of its branch, its kit hit's `if`,
  the operator's next cast, its cast's end, a jump; or why it was never pinned) on the NOLAND lines, BuffReplay.skipped
  (replayedSkill's and makeCast's reasons, earliestStart's own error: "needs 160 ultimate energy, 0.0") as SKIP lines;
  every "a landing the replay didn't land" in the development logs (232) has a reason. No engine change: watched from
  the schedule before and after each step.
- 4 (`zmdlogs explain`): parked (the same).
- 5 (A kit field override's errors come one rule at a time): done (54a99db): a hit whose written events the data's
  landings don't log gets one message with the whole fix (frames written, events marked); a stale mark says to drop it
  (tests/kit-messages.test.ts).
- 6 (The replay's own list of the stops it held, and the EVENT fate from its decision): done (3b79889): the EVENT line
  reads BuffReplay.skipped (the replay's decision) and gives the buff's last end and the event in frames; query.ts
  replayTimeStops leaves out the stops of casts the replay skipped as ticks (`zmdlogs stops --all --differ` identical
  by cli-ab). The hold placement's own `made` set stays inside buffreplay.ts (it is the same decision).
- 7 (A fact the replay doesn't know reads as a default, unmarked): the label done (3b79889: buffreplay.ts
  unknownFacts, "enemy HP unknown" in `check`, `differences` and HitRecord.unknownFacts); the alternative reading moves
  verdicts, so it is in the new backlog's accuracy list.
- 8 (`zmdlogs casts --why`): carried (2026-11-25-backlog-after-round-12.md point 1)
- 9 (The kit loader doesn't warn of a gameBuff without the modifier its sibling has): done (54a99db): kits.ts
  unloggedAttachedBuffs over skillData.ts attachedModifierBuffs (a created buff without modifiers beside a
  cast-attached one with them, CreateBuffAttachingSkill); none in the kits, and it finds Glorious Memory's _valid when
  its loggedAs is dropped (a test); `efsim kit-census` prints it. A test, not a loader warning: a load that printed
  would print on every run.
- 10 (A kit hit's frame is ambiguous for landings on their way): closed by the cooldown-clock round (KitHit.travels from
  LaunchProjectile, read by logcasts.ts eventStopStart); nothing left for a friction round.
- 11 (A trigger's cooldown state has no trace): done (3131523): `zmdlogs replay --trace-trigger owner:id` (or the id
  alone), each firing and each shift of the ready frame with its step, a run of placed holds on one line; de6a's
  Swordmancer reads in one command.
- 12 (An engine reading can't be narrower than "every trigger"): the field done (9009c2b: KitTrigger.cooldownFrom, the
  mechanisms the compiler matched, printed by `efsim kit` and counted by kit-census); a reading that selects by it is
  an accuracy task (the new backlog's accuracy list).
- 13 (The burst view's causes are a heuristic): carried (2026-11-25-backlog-after-round-12.md point 2)
