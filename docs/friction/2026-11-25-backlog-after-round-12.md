# Backlog after improvement round 12 (2026-11-25)

Task: the points of the reports round 12 read (docs/friction-done/2026-11-25-round-12.md lists them) that round 12
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 12)"
section. Points 1–2 are round 11's backlog's (8 and 13 there), carried once; 3–5 are new. No agent holds a file this
round's work needs; each point says which files it touches. The parked list and the accuracy list follow.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. `zmdlogs casts --why`: which rule chose a skill among those sharing a key

- **What happened:** Ardelia's attack 1 was placed as attack 2 because `choose` (logcasts.ts) walked back past her
  attack 3 and combo to an attack 1 five seconds earlier. The ×1.5 ratio and `zmdlogs casts` showed the wrong skill,
  but not why it was chosen; the Empyrean combo's key was the same kind of bug.
- **Suggestion:** `zmdlogs casts --why` (as `holds --why`): for a cast whose key several skills share, the candidates
  and which rule picked it (anchor, window of which earlier cast, fallback): a record of `choose`'s steps in
  logcasts.ts's placement, printed by views.ts castsView. Since round 12 placeHits has named passes
  (placementPasses), so the record can say which pass chose.
- **Why it helps:** the next shared-key bug is found from one view.
- **From:** docs/friction-done/2026-11-24-stats-candidates.md point 4; docs/friction-done/2026-11-24-backlog-after-round-11.md point 8.

## 2. The burst view's causes are a heuristic, and the enemy's inflictions before a burst aren't shown

- **What happened:** round 11's `zmdlogs bursts` (packages/logs/src/burstsview.ts) names each burst's likely cause as
  the operator's latest inflicting hit at least the burst delay of world time before it, because the replay records
  neither inflictions (status.ts "inflicted" events are dropped in recordStatus) nor a burst's source hit
  (PendingBurst has `fromCast` and `fromKind`, the burst's landing neither). The remaining-leads round hit the same
  gap from the other side: fc63's lead ("the infliction state before Arcane's ultimate is wrong") took a scratch script
  over `replay.reactions` before `--trace-buff status:infliction` existed.
- **Since round 12:** `zmdlogs reactions` lists the log-side inflictions among its "other" events (reactioncheck.ts);
  the replay's own are in `--trace-buff status:infliction` (remaining-leads round).
- **Suggestion:** keep the burst's source on its record (the PendingBurst's infliction frame and cast in the burst
  StatusEvent or the landing: engine landing.ts delayBursts / landBurst; record only, smoke and team-ab's identity
  check), have burstRows read it in place of the search, and print the replay's infliction stacks and their appliers
  just before each burst (the `status:infliction` trace's state at the burst's cause).
- **Why it helps:** a burst across a stop or on old stacks names its real cause; every burst or reaction lead starts
  with "what did the enemy have", in one view.
- **From:** this round's own work (docs/friction/2026-11-24-round-11-friction.md); docs/friction-done/2026-11-24-backlog-after-round-11.md point 13; docs/friction-done/2026-11-25-remaining-leads.md point 3 (its second half).

## 3. Two compositions of one fight's check: the snapshot check's and the hit records'

- **What happened:** round 11's likely-loggedAs screen needed each hit's kit modifiers; the pending suite has the
  snapshot check's EngineHits (the replay's landing, no reading), `zmdlogs differences` the hit records (the primary
  reading's modifiers, log buffs included), so the screen was written on a neutral modifier shape both could feed, and
  the two differ slightly (the reading keeps only judged kit buffs).
- **Cause:** snapshotEntry (snapshotentry.ts) and hitRecords (hitexport.ts) each compose the replay, engineHits and
  checkLog; only hitRecords computes readingBasis.
- **Suggestion:** snapshotEntry returns a lazy `bases(h)` (readingBasis per hit, memoised) and hitRecords builds on
  snapshotEntry, so a screen in the suite and a view over the records read the same reading. Behaviour-preserving:
  `zmdlogs hits --all --json` identical before and after by cli-ab, and snapshots:update "No log's verdicts moved".
- **Why it helps:** one composition, so a screen that passes in the suite is the view's answer too.
- **From:** docs/friction-done/2026-11-24-round-11-friction.md point 4.

## 4. A change to many kits can't be attributed among the hold-outs without saying what they contain

- **What happened:** the cooldown-clock round moved two hold-outs' totals worse with a change to every world-clock
  trigger; attributing it took two throwaway patches (only Swordmancer; only Laevatain's absorb) and two queued
  measures. Its report asked for `measure --split kits` (one run per kit, aggregates only).
- **Why not built (round 12):** which kit's run moves a hold-out says which kits the hold-outs' teams have: the lead's
  round 9 decision keeps the hold-outs' operators out of every output ("which operators the moved hold-outs have tells
  what the hold-outs contain; the field kinds stay", docs/friction-done/2026-11-23-round-9.md), and a weapon or gear
  set narrows a team as much.
- **Suggestion, for the lead to decide:** a split by the game's mechanism class instead of by kit (round 12 recorded
  each trigger cooldown's mechanism, KitTrigger.cooldownFrom; `efsim kit-census`: `globalCd` on 6 triggers, `cdBuff`
  on 2, `marker` on 23), aggregates only, and only for classes with at least three kits; or the patch-per-kit measures by hand, as now, on development
  logs (whose per-kit split is no secret: `measure --patch` with the kit's half). Whatever is built must keep
  `scripts/accuracy.ts --compare`'s rule: counts and field kinds, no operator or equipment.
- **Why it helps:** "two hold-outs worse: explain" in one command, if the lead accepts what a mechanism class says.
- **The lead's decision (2026-11-25): not built, either way.** The classes are small (6, 2 and 23 triggers), so a
  class that moves a hold-out still narrows which kits its team has. Attribution stays as now: patch-per-kit
  measures on development logs, and the hold-outs' aggregates as a check. Closed; don't carry it.
- **From:** docs/friction-done/2026-11-24-cooldown-clock.md point 2.

## 5. The hold placement's units move far from a change

- **What happened:** moving Gilberta's ultimate in 489c 1.9 s earlier lost 103 plain hits at 46–63 s; the holds'
  units moved from 37.73 / 50.75 s to 74.17 / 77.20 s. Round 12's pins (`zmdlogs holds --verbose`: each unit's
  "earliest held back by" / "latest forced by", each dropped bound's "conflicting with"; `cli-ab <ref> --patch <view
  diff> --holds <fx>` on both sides) gave the reason in one run: the in-turn move made the replay's Corrosion by Li
  Zhiyan expire 2.07 s later (over 47167 → 49233 ms), its status bound turned from [1.19, 1.84] s into at most 0.19 s
  over 13.1–49.2 s, and the ramp bounds asking 0.3–0.4 s there now conflict with it and the bleed ticks 41667⇒47127.
- **Cause:** holds.ts placeHolds solves one least-total problem over every clock of the fight: a bound that spans
  the moved stop changes, and the conflict resolution (drop the bound asking most, a tick's or ramp's at half) flips.
- **Suggestion:** place holds per stretch between moments every clock agrees on (a long Stagger, a fight's away
  stretch), so a local change stays local; and rank a conflict by the bound's evidence (a listed status's end against
  a ramp reading's) rather than its ask. Both move verdicts: measure, an accuracy task with this tool.
- **Why it helps:** every placement fix (several per round) is measured through the holds; a placement right by the
  log's own evidence shouldn't read as −100 plain.
- **From:** docs/friction-done/2026-11-25-remaining-leads.md point 1 (its longer-term half).

## Parked

A new report that hits one brings it back with its full text from there.

Round 11's points 1, 2 and 4 (full text in docs/friction-done/2026-11-24-backlog-after-round-11.md under the same
number), each carried twice without a new report:

- 1. A slow-down's identity through the stop lists and the replay's record (carry SkillDilation `n` into TimeStop,
  TimelineState.slowdowns and AppliedStop; pair by it in stopsAgainstList).
- 2. A logged hit placed in the wrong slot is invisible in the totals' parts (TotalPart's cast, a `slot?` flag, a parts
  export).
- 4. `zmdlogs explain`: each off hit's first explanation from the counterfactuals, and the per-class shares for the
  hold-outs in measure.

Round 9's points (full text in docs/friction-done/2026-11-23-backlog-after-round-9.md under the same number):

- 2. A kit value written as "the data's length minus what the engine holds" (an extendBuff `pauseFrames` form:
  engine timing, smoke, team-ab).
- 3. No test that a hit's replay-only and log-only twins don't come back (a count of the `twin like` / `twin other`
  contexts in snapshotEntry's `oneSided`, in the pending suite; its bound is an accuracy agent's).

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

- **489c's hidden holds after the in-turn move** (point 5's finding): the in-turn stop holds Li Zhiyan's Corrosion
  2.07 s more of world time, so the log's Corrosion end (48.81–49.22 s) caps the holds at 0.19 s over 13.1–49.2 s,
  against the ramp readings' 0.3–0.4 s. Either the in-turn stop doesn't hold the enemy's status clock the full stop
  (an ultimate's stop over another's, the enemy's timers), or the ramp readings there are off; `zmdlogs holds 489c
  --verbose` and `--trace-buff status:corrosion` from 13 to 50 s. Moves the placement: measure.
- **The placement isn't a fixed point for 21 casts** (round 12's settleCheck, `efsim zmdlogs placement --all`):
  4a64's in-turn pair (Rossi 21.23 → 24.55 s, Si 23.09 → 22.63 s in a third pass), 7910's four, 9a80's Rossi battle
  skills, 9090's Arcane and Typhoeus, 9c6e, 79cc, c779. Whether a third pass places them better is a measure (`--patch`
  with placeHits running pass 2 twice); the 14 overlapping ultimate pairs left are pinned in
  tests/logcasts-stops.test.ts.
- **An "enemy HP unknown" hit's other reading** (round 11's backlog point 7, its second half): round 12 labels such
  hits (buffreplay.ts unknownFacts; `check`, `differences`, `hits --json`); trying the below-half reading as an
  alternative moves verdicts (assumed matches). No development log has the label under the default reading.
- **Engine readings by cooldown mechanism** (round 11's backlog point 12, its second half): KitTrigger.cooldownFrom
  says each trigger's mechanism since round 12; `trigger-cooldowns` could select by it (a reading per mechanism class
  in place of every trigger at once). Moves fights: measure, team-ab.
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
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves. The replay's SKIP lines
  (round 12) say why each press it didn't make was skipped.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate, and resumable guided searches.
- **Zhuang Fangyi's two extra Sunderblades in 4d60** (physical-statuses report point 3): not Empyrean's free-path or
  Electrification branches (round 10). Still open; the next look is elsewhere in the skill's data. The replay's NOLAND
  lines (round 12) give each Sunderblade landing that didn't land its kit hit's `if`.
- **Arcane's bursts** (kit-buff leads): `zmdlogs bursts --all --operator Arcane` (round 11) lists each logged burst
  against the replay's with each side's likely cause and the stops between: the first table for test 33's element and
  the burst's clock across her own ultimate's stop.

## What worked well

The reports named their episodes (489c's units, de6a's Swordmancer, 4bfc 179.51 s, 9c0b's skipped ultimate, Zhuang
Fangyi's combo_skill_ult), so each tool was tried on the episode it should have shortened, and cli-ab with a patch
answered the costliest one (489c) in a single run.
