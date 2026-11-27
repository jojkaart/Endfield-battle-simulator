# Backlog after improvement round 16 (2026-11-26)

Task: the points of the reports round 16 read (docs/friction-done/2026-11-26-round-16.md lists them) that round 16
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 16)"
section. Point 1 is round 15's backlog's point 4, carried (its first carry); round 15's points 2 (fit-build's wider
space) and 3 (the by-operator share) were closed by this round, the stage flag of point 3 left as point 2 here; round
15's point 1 (the log context) moved to the parked list (carried twice without a new report). Point 3 is new. Round 16
had every file to itself. The parked list and the accuracy list follow; the accuracy list lost its "slots by value"
entry (closed by the slots-and-paths round) and gained one (the last).

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. The replay's Stagger window starts are derived, not recorded

- **What happened:** `zmdlogs stagger d4fb` printed a replay window from 86.50 s against the log's 97.26 s; an earlier
  round read it as a Stagger holding a cooldown. The record took a window's start as its end less the Stagger's
  length, wrong for a Stagger the log's listing holds; it also fed the hold placement's still spans. The
  bursts-and-cooldowns round bounded the derived start by the last sample without one (replayrecord.ts), and round 15
  flags a replay window starting over a second from the log's first Staggered hit (views.ts staggerLine, `FLAG:`).
- **Cause:** TimelineState.stagger has no start, so the record derives it.
- **Suggestion:** a `since` frame on TimelineState.stagger (set where resources.ts dealPoise breaks the bar and where
  holdStagger starts one), which replayrecord.ts reads in place of the derivation.
- **Needs:** packages/engine/src/timeline/resources.ts, state.ts, packages/logs/src/replayrecord.ts; team-ab (a record
  only), and a measure: the still spans read the windows, so a start that moves moves the holds.
- **Why it helps:** the still spans, the windows' edges (kitBuffNearChange) and every "Staggered there" argument read
  this record; one recorded start replaces a bound.
- **From:** docs/friction-done/2026-11-26-bursts-and-cooldowns.md point 2 (its first half); docs/friction-done/2026-11-26-backlog-after-round-15.md, point 4.

## 2. The scoreboard can't tell a stage log's effect from a kit's

- **What happened:** the totals-off brief's operator means (Perlica 17.3%, Liino 17.1% …) were dominated by four stage
  logs and by small totals; round 16 added each operator's share of a fight (`share operator <id>`, a describing
  snapshot key) and the by-operator table's median and share-weighted |error|, which take the small totals' weight
  out. The stage logs are still mixed in: nothing in the snapshots says which fight is against a stage enemy.
- **Cause:** the scoreboard reads the snapshots alone (scripts/accuracy.ts needs no game data or fixtures), and the
  snapshots carry no fight's enemy.
- **Suggestion:** a list of stage enemy ids (from the development fixtures' `enemy.id`, never read from a hold-out)
  and the by-operator table without the stage fights beside it; or a describing key `stage 1` in a stage fight's
  totals (snapshotentry.ts, from `fx.enemy.id` against a list in packages/logs), which the hold-outs carry blind too.
- **Needs:** packages/logs/src/snapshotentry.ts (the key) or scripts/accuracy.ts (the list), tests/snapshots/
  (`npm run snapshots:update`: keys added only, the round's summary names them), docs/accuracy.md (generated).
- **Why it helps:** a brief built on the by-operator table reads a kit's error, not a stage's.
- **From:** docs/friction-done/2026-11-26-totals-off.md point 2 (its stage half); docs/friction-done/2026-11-26-backlog-after-round-15.md, point 3.
- Closed by worktree-agent-a16f5232d3d1dbf34 (round 17), 21e5956 and dbe2545: a describing snapshot key `stage` in a
  stage fight's totals (enginecheck.ts stageFight: the fixture's stageFactors, a stage status, a STAGE_ENEMIES enemy;
  8 fights) and the by-operator table's "Without stage fights" mean.

## 3. A batched ms's order disagreement isn't counted across logs

- **What happened:** round 16 put each batched Stagger event's bar on `zmdlogs replay` / `casts` lines and a BATCH
  line where the replay landed them in another order than the bars give (views.ts batchDisagreements); its first run
  on c4f3 7.05 s shows Estella's first Lift landed before her ultimate, the bars after it. How many batches disagree
  over every log, and of which kinds (a status event's landing, a trigger's hit), needs a replay view per log.
- **Cause:** `zmdlogs decisions` reads the replay's own records (replayDecisions(data, replay)); the bars are the
  fixture's, so BATCH isn't one of its kinds.
- **Suggestion:** replayDecisions takes the fixture too (or decisionsView adds BATCH lines from batchDisagreements
  beside the replay's), so `zmdlogs decisions --all` counts BATCH per log and `--assume` shows a reading's effect on
  the batches.
- **Needs:** packages/logs/src/decisionsview.ts, packages/logs/src/views.ts (batchDisagreements), tests/decisions.test.ts.
  Tools only: no verdict moves.
- **Why it helps:** the next batch-order rule (a trigger's hit in a batch, Estella's weapon ATK at 7.05 s) starts from
  a count, not a log at a time.
- **From:** docs/friction-done/2026-11-26-batched-landings.md point 2 (its count).
- Closed by worktree-agent-a16f5232d3d1dbf34 (round 17), 1b0a829: replayDecisions(data, replay, fx) adds BATCH
  decisions, so `zmdlogs decisions --all` counts them (20 in 10 development logs) and `--assume` shows a reading's.

## Parked

A new report that hits one brings it back with its full text from there.

Round 14's backlog point 1, round 15's point 1 (full text in docs/friction-done/2026-11-26-backlog-after-round-15.md
under point 1), carried twice without a new report:

- 1. The log tools take the game data without the readings of it (a log context `{ data, assume }` that placeHits,
  the stop builders and the replay take; a mix is an error since round 14).

Round 12's backlog point 5 (holds per stretch) moved to the accuracy list below: it moves verdicts.

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
  `zmdlogs consumed`, `zmdlogs layers`; `hits --zones` covers part of it since round 8; round 13's `differences
  --clusters` shows a layered buff's steps when the log lists it once).

Round 7's points (full text in docs/friction-done/2026-11-23-backlog-after-round-7.md under the same number):

- 2. `zmdlogs clock`'s remainders: `--on/--off` cast brackets, `--all` in place of scripts/probes/buff-clock/lanes.ts,
  the owner's trigger hit after the end with its origin.
- 5. Probes have no "still runs" check (none rotted; round 13 ran tick-chains.ts and tickstag.ts on the shared
  Stagger-span helper).
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

- **Hidden holds per stretch, and conflicts ranked by evidence** (round 12's backlog point 5, carried there from the
  remaining-leads report): holds.ts placeHolds solves one least-total problem over the whole fight, so a local change
  (489c's Gilberta ultimate 1.9 s earlier) moved units 25 s away and lost 103 plain hits. Place holds per stretch
  between moments every clock agrees on (a long Stagger, an away stretch), and rank a conflict by the bound's evidence
  (a listed status's end against a ramp reading's) rather than its ask. Round 13's `zmdlogs holds --dropped --all`
  gives the systematic conflicts first: tick bounds inside the log's Stagger with a combo's stop inside are dropped
  47 times in 9 logs against 35 kept (the enemy-clock round's combo lateness), tick bounds across an ultimate in a
  Stagger 17 dropped, none kept. Moves verdicts: measure.
- **One model of a fight's lives** (docs/friction-done/2026-11-26-away-and-presses.md point 1): the totals' kill
  (enginecheck.ts lastLifeKilled, fightTotals) and the replay's enemy HP (replayrun.ts loggedEnemyHp) each find the
  lives' ends at the away stretches with their own rule, and the two rules differ: lastLifeKilled takes a stretch whose
  damage so far is a whole number of Max HPs to 10% over, loggedEnemyHp one within −0.1% to the fight's excess +0.5%
  over j × Max HP, and only for fights of at least two lives with an excess under 10%. One `fightLives(data, fx)` (each
  life's from, to, HP, killed, what ends it) that both read, and onesided.ts's `away` flag, has to pick one rule:
  it moves verdicts (measure, snapshots:update), so it isn't a move. Test per fixture shape: Si's two lives, a tower's
  ×7.6, a capped kill, 4a64's uncapped one.
- **Combos hold every clock more than their stops** (the enemy-clock round; engine assumption `stagger-holds`,
  registered, off): `zmdlogs clocks --all --by operator` (round 13) gives the lateness per clock kind and combo
  operator in one run: Σ residual ≈ 0.23 × held for tick chains across combos, 0.40 for casts, 0.33 for bursts
  (bursts from the nearest candidate cause then; since round 14 from the replay's recorded infliction: rerun before
  citing); ultimates on time (−0.00). The curve is a reading (`combo-curve`, 2026-11-26). The combo
  hold and replay round placed the operators' excess in the stop's first half and measured a uniform extra hold on
  the operators (`combo-operator-hold`, worse): docs/open-problems.md "The enemy's clock".
- **The placement isn't a fixed point for 21 casts** (round 12's settleCheck, `efsim zmdlogs placement --all`): the
  holds-and-placement round measured a third pass and dropped it (docs/tried/); the 14 overlapping ultimate pairs
  left are pinned in tests/logcasts-stops.test.ts.
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
  the OFFSETS_EXPLAINED entry with it. Round 16: `fit-build --pairs` counts the wider space's singles and pairs by ATK
  (the operator's level among them, its promotion not), so Snowshine's is "no single, 26 pairs": undecidable by the
  logs; Purrchena's level is the next try (`fit-build 99fb --operator Purrchena --pairs`).
- **The log tools' stop lists from the timeline's applied slow-downs** (docs/friction-done/2026-11-23-remaining-leads.md
  point 3): BuffReplay.appliedStops has them; replayedCastStops could read the first run's, so a cast cut early or a
  kit trigger's jump shows. `zmdlogs stops --all --differ` gives what is left in a few minutes. Moves the placement:
  measure.
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
  Electrification branches (round 10). Still open; the replay's NOLAND lines (round 12) give each Sunderblade landing
  that didn't land its kit hit's `if`.
- **Arcane's bursts** (kit-buff leads): `zmdlogs bursts --all --operator Arcane` (round 11) lists each logged burst
  against the replay's with each side's likely cause and the stops between: the first table for test 33's element and
  the burst's clock across her own ultimate's stop.
- **A reaction's level tried every way where the log decided it** (assumptions.ts ASSUMPTION_FACTS `stacks`, round
  15): logBuffReplay replays again with the levels the log shows (loggedReactionLevels), yet readingBasis still tries
  every other level 1–4 of a non-burst reaction, labelled "the replay's arts state isn't checked against the log's
  reactions yet". Offering them only where the log's level is unknown turns some assumed matches into mismatches:
  measure.
- **The log-listing fallback's readings try both crits whatever the replay read** (ASSUMPTION_FACTS `crit`;
  tests/assumption-facts.test.ts exempts the fallback class): logcheck.ts candidates enumerates crit and no crit with
  a "crit" assumption even where the replay read the crit (0c14 165.49 s and 199.14 s, a9d7 101.27 s). A fallback
  stays one either way; the verdict's reading and its labels would follow the replay. Small: measure for the readings.
- **The enemy's side of a value or condition from the replay** (ASSUMPTION_FACTS `situational`, `value`): the replay
  has its inflictions and Vulnerable at each landing, but the check takes the enemy's side as unknown ("its
  inflictions aren't checked against the log's reactions") and tries both ways; a check of the replay's inflictions
  against the log's reactions first, then the replay's side as the primary reading's. Moves verdicts: measure.
- **A batch's Lift before the ultimate the bars put first** (round 16's BATCH line, c4f3 7.05 s): the replay lands
  Estella's first Lift (bar 234 → 224, logged 4,353, the replay's 2,044) right after her combo, before her ultimate
  (254 → 234), which the bars put first; pinned landings follow the bars (schedule.ts dueBefore), a status event's
  landing doesn't. Whether her ultimate's buffs are on that Lift's damage (×2.1) is the question; moves verdicts:
  measure. With Estella's weapon ATK at 7.05 s (open-problems), one batch.

## What worked well

The reports' episodes made each view testable on arrival: 6339's purges and e82d's 8.93 s end are `zmdlogs ends` lines, e82d's Doubles instance pairs with its 0.1794 run in `zmdlogs clock`, c4f3's 7.05 s batch carries its bars and a BATCH line, d4fb's bank is a TRACE, 04d4's Snowshine is fit-build's pairs.

## Outcome (round 17)

- 1 (The replay's Stagger window starts are derived, not recorded): parked (carried twice without a new report: an
  engine record whose start moves the holds' still spans, a measure's work); the Parked list of
  docs/friction/2026-11-27-backlog-after-round-17.md.
- 2 (The scoreboard can't tell a stage log's effect from a kit's): done (21e5956, dbe2545): the `stage` key and the
  by-operator "Without stage fights" mean (its "Closed by" line above).
- 3 (A batched ms's order disagreement isn't counted across logs): done (1b0a829): BATCH decisions in `zmdlogs
  decisions` (its "Closed by" line above).
