# Backlog after improvement round 13 (2026-11-26)

Task: the points of the reports round 13 read (docs/friction-done/2026-11-26-round-13.md lists them) that round 13
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 13)"
section. Points 1–3 are round 12's backlog's (1–3 there), carried; 4–6 are new. Round 13 ran beside an accuracy agent
that held packages/logs' replay, placement, check and holds files, packages/engine and packages/data, so every point
here needs one of those; each says which. The parked list and the accuracy list follow.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. Which rule decided a cast: `zmdlogs casts --why` and `zmdlogs placement --why`

- **What happened:** Ardelia's attack 1 was placed as attack 2 because `choose` (logcasts.ts) walked back past her
  attack 3 and combo to an attack 1 five seconds earlier. The ×1.5 ratio and `zmdlogs casts` showed the wrong skill,
  but not why it was chosen; the Empyrean combo's key was the same kind of bug. The holds-and-placement round hit the
  same gap in the in-turn rule: for the 14 pinned overlapping ultimate pairs, `zmdlogs placement --all` and
  scripts/probes/placement/ult-overlap.ts say *that* they overlap, not which of inTurnStart's checks refused each move
  (reach, the moved stop overlapping a third one, logged hits inside it, the start held to an event, `fromEvent` /
  `beforeStop`, no opening landing). A temporary stderr print in logcasts.ts inTurn / inTurnStart, reverted after,
  gave the categories in open-problems (six not quiet, five of 2–4 frames, three resolvable); its first run mixed two
  passes' lines because settleCheck (which the placement view runs) calls inTurn again for its third pass. Half an
  hour.
- **Cause:** the placement returns its result only; its decisions aren't kept (holds.ts's pins and conflicts are,
  since round 12). The probe recomputes part of the logic (its own quiet count, the stops at ≤ 0.05) and drifts.
- **Suggestion:** a record of the placement's choices beside Placement: per cast whose key several skills share, the
  candidates and the rule that picked it (anchor, window of which earlier cast, fallback) and the pass
  (placementPasses); per ultimate inTurn looked at, `{ cast, verdict: "moved" | "event" | "beforeStop" | "held" |
  "no-overlap" | "refused", checks?: { early, reach, reachMs, free, quiet, hitsInside }, candidate }`, kept for the
  final pass only (not settleCheck's third). `zmdlogs casts --why` prints the first (views.ts castsView),
  `zmdlogs placement --why` the second under each OVERLAP line (ultimateOverlaps attaches both casts' records); the
  probe reads the records. While in logcasts.ts: settleCheck can pair through packages/logs/src/castpairs.ts
  `pairCasts` (round 13; the same two-step rule, now tested once), dropping its own copy.
- **Why it helps:** every in-turn change (three rounds running) and every shared-key bug starts with "why this cast";
  one view answers it per cast, and a rule extension is judged from the list before a measure.
- **Needs:** packages/logs/src/logcasts.ts (the accuracy agent's this round).
- **From:** docs/friction-done/2026-11-24-stats-candidates.md point 4; docs/friction-done/2026-11-24-backlog-after-round-11.md point 8; docs/friction-done/2026-11-25-backlog-after-round-12.md point 1; docs/friction-done/2026-11-25-holds-and-placement.md point 1; docs/friction-done/2026-11-25-round-12-friction.md point 2 (its settleCheck half).
- Closed by worktree-agent-aab5ad7209df6114a, 22bcd58: logcasts.ts keeps `choose`'s rule on each new cast whose key
  several groups share (LoggedCast.chosen: anchor with its start and distance, alike / window / restart with the cast
  whose windows decided, first, late) and the in-turn rule's verdict on each ultimate of the final pass
  (Placement.inTurn: moved, event, beforeStop, held, no-overlap, refused, with early / reach / free / quiet /
  hitsInside for the start it tried; settleCheck's third pass keeps its own, unread). `zmdlogs casts --choices` prints
  the first on each CAST line, `zmdlogs placement --choices` the second under each OVERLAP (named `--choices`: `--why`
  takes a regex in `holds` and `--rules` a file in `gear`, and the CLI's options are one set). settleCheck pairs
  through castpairs.ts pairCasts (its own copy dropped; it now pairs by operator and skill, not also by key).
  Not done: the probe scripts/probes/placement/ult-overlap.ts still recomputes its quiet count (it can read
  Placement.inTurn's checks now).

## 2. The burst view's causes are a heuristic, and the enemy's inflictions before a burst aren't shown

- **What happened:** round 11's `zmdlogs bursts` (packages/logs/src/burstsview.ts) names each burst's likely cause as
  the operator's latest inflicting hit at least the burst delay of world time before it, because the replay records
  neither inflictions (status.ts "inflicted" events are dropped in recordStatus) nor a burst's source hit
  (PendingBurst has `fromCast` and `fromKind`, the burst's landing neither). The remaining-leads round hit the same
  gap from the other side: fc63's lead ("the infliction state before Arcane's ultimate is wrong") took a scratch script
  over `replay.reactions` before `--trace-buff status:infliction` existed. Round 13's `zmdlogs clocks --clock burst`
  measures each burst's lateness from the same heuristic cause: 35 of its bursts across an ultimate read 8 s late at
  the median, a cause far older than the burst's.
- **Since round 12:** `zmdlogs reactions` lists the log-side inflictions among its "other" events (reactioncheck.ts);
  the replay's own are in `--trace-buff status:infliction` (remaining-leads round).
- **Suggestion:** keep the burst's source on its record (the PendingBurst's infliction frame and cast in the burst
  StatusEvent or the landing: engine landing.ts delayBursts / landBurst; record only, smoke and team-ab's identity
  check), have burstRows read it in place of the search, and print the replay's infliction stacks and their appliers
  just before each burst (the `status:infliction` trace's state at the burst's cause).
- **Why it helps:** a burst across a stop or on old stacks names its real cause; every burst or reaction lead starts
  with "what did the enemy have", in one view; `clocks --clock burst` then measures the right span.
- **Needs:** packages/engine (landing.ts), the replay's record (replayrecord.ts).
- **From:** this round's own work (docs/friction/2026-11-24-round-11-friction.md); docs/friction-done/2026-11-24-backlog-after-round-11.md point 13; docs/friction-done/2026-11-25-remaining-leads.md point 3 (its second half); docs/friction-done/2026-11-25-backlog-after-round-12.md point 2.
- Closed by worktree-agent-a5e4ed1a5c0c50ba9, 6959fe6: engine landing.ts delayBursts keeps the infliction's frame on
  the burst it schedules (StatusEvent `inflictedAt`, record only; team-ab identity unchanged); burstsview.ts takes the
  replay's cause from it and the log's from the logged hit standing for that landing, the search only where neither
  exists (marked "nearest"); `clocks --clock burst` measures from it. Not done: the infliction stacks and appliers
  printed before each burst (`--trace-buff status:infliction` still answers it).

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
- **Why not in round 13:** the composition is of the check the accuracy agent was changing (enginecheck.ts,
  logcheck.ts), and its proof is a snapshots:update on both sides; a refactor under a parallel change of the same
  calls is a merge conflict at best.
- **From:** docs/friction-done/2026-11-24-round-11-friction.md point 4; docs/friction-done/2026-11-25-backlog-after-round-12.md point 3.
- Closed by worktree-agent-a5e4ed1a5c0c50ba9, 1b04e66: snapshotentry.ts composeCheck (placement, replay, engine
  readings, verdicts, the engine check and a memoised readingBasis per hit), which snapshotEntry and hitRecords both
  build on; `zmdlogs hits 0c14 8915 489c 0eef --json --no-cache` identical against the commit before by cli-ab (2,353
  records), snapshots:update "No log's verdicts moved".

## 4. The guessed slow-down curves can't be tried as a reading

- **What happened:** to test the obvious fix for the late clocks across combos (the guessed ComboSkill curve holds
  too little) the enemy-clock round wrote `measure --patch` diffs against packages/data/src/skillData.ts NAMED_CURVES,
  another agent's area that round; each patch measure waited ~10 min in the lock's queue. The curve can't be an engine
  assumption as it is: it is compiled into SkillTiming.slowdowns before any scenario is read.
- **Cause:** the named curves (assets the data doesn't have) are guesses compiled as data, not readings the
  assumptions registry can switch; `measure --variant` can't reach them.
- **Suggestion:** keep the curve's name and parameters on the compiled timing (`curve: "ComboSkill"` beside the
  scales), and let one function in packages/engine/src/timeline/ turn them into scales under the scenario's reading
  (an engine assumption `combo-curve`: the current guess as default, `flat`, `middle`); clock.ts slowDown and
  logcasts.ts skillStops both take the scales from it. Behaviour-preserving at the default: snapshots:update "No log's
  verdicts moved", smoke, team-ab's identity check.
- **Why it helps:** a guessed curve is exactly an open reading: `measure --variant combo-curve=flat` is one run beside
  the base instead of two queued patch runs, and no edit in another agent's files. docs/tried/2026-11-26-combo-curve-flat.diff
  is the reading's first measure.
- **Needs:** packages/data (skillData.ts), packages/engine (timeline/), packages/logs/src/logcasts.ts.
- **From:** docs/friction-done/2026-11-26-enemy-clock.md point 2.
- Closed by worktree-agent-aab5ad7209df6114a, 22bcd58: engine assumption `combo-curve` (`guess` the default, `flat`,
  `middle`). The compiler keeps the curve's name on each slow-down it samples (SkillTiming.slowdowns `curve`; the
  guess itself now lives in the engine, timeline/curves.ts COMBO_CURVES, which skillData.ts NAMED_CURVES reads), and
  withCurveReading(data, assume) resamples every ComboSkill slow-down under the reading: createContext applies it to
  the timeline, snapshotEntry, hitRecords and the zmdlogs CLI's data to the log tools' stop lists, so placement and
  replay agree. Memoised per data and reading; the default returns the data itself. Not as suggested: one data-level
  copy per reading instead of a function both clock.ts and skillStops call, since the log tools take `data` without
  the readings in twenty places. `measure --variant combo-curve=flat` is one run (numbers in the journal entry of
  2026-11-26, combo hold and replay).

## 5. Which strings are keys, and which are only text

- **What happened:** round 12 had to put the replay's drop reasons somewhere visible; the obvious place was the
  `unknown` of BuffReplay.landing ("a landing the replay didn't land"). A grep showed onesided.ts puts it into a
  one-sided landing's `context`, which the totals' kinds group by, which the snapshots' share keys and measure's
  hold-out kind table carry: changing the text would have changed every snapshot's kinds without a verdict moving.
- **Cause:** reason strings double as grouping keys (contexts, kinds, verdict reasons) with nothing marking which do.
- **Suggestion:** name the reason strings that are keys as constants in one module (`NO_LANDING = "a landing the
  replay didn't land"`, the one-sided contexts), with a comment that changing one changes the snapshots' share keys;
  views add detail beside them, never into them.
- **Why it helps:** a view change can't move a snapshot by accident, and an agent sees at the constant what it keys.
- **Needs:** packages/logs/src/buffreplay.ts (where the strings are made) and onesided.ts.
- **From:** docs/friction-done/2026-11-25-round-12-friction.md point 3.
- Closed by worktree-agent-a5e4ed1a5c0c50ba9, e0cec23: packages/logs/src/replaykeys.ts NO_LANDING (the replay's
  reasons for no landing or facts) and ONE_SIDED (the one-sided contexts), with the comment that a change moves the
  snapshots' kinds; buffreplay.ts and onesided.ts use them.

## 6. buffreplay.ts is one 2,900-line file

- **What happened:** round 12's skip reasons, drop watch, trigger traces and the enemy-HP label all went into
  packages/logs/src/buffreplay.ts; each needed an outline by grep (`^function`, `^export`) to find replayOnce,
  makeCast, replayedSkill and the BuffReplay object, 1,500 lines apart.
- **Cause:** the cast assembly (assembleCasts and its passes), the per-step replay loop (replayOnce, makeCast,
  replayedSkill, missedCasts), the holds' inputs (runBounds, heldToLoggedEnds) and the BuffReplay answers (landing,
  castFacts) share a file.
- **Suggestion:** split by those four: castassembly.ts, replayrun.ts, holdinputs.ts, buffreplay.ts (replayKitBuffs
  and the BuffReplay interface). A move only: snapshots:update "No log's verdicts moved", lint's import rule for the new
  files. Best done by the agent that next holds the replay, between accuracy tasks (a move under a parallel edit of
  the same file conflicts everywhere).
- **Why it helps:** the replay's decisions, the most-edited code of the accuracy rounds, are findable by file name.
- **Needs:** packages/logs/src/buffreplay.ts.
- **From:** docs/friction-done/2026-11-25-round-12-friction.md point 5.
- Not done by worktree-agent-aab5ad7209df6114a (2026-11-26, combo hold and replay): the round's replay work (the tail
  cuts beside the hitless presses, about 120 lines) went in without needing it, by grep; a move of 3,100 lines with
  its proof (snapshots:update "No log's verdicts moved") didn't fit beside the accuracy items. Still live.
- Not done by worktree-agent-a732e41da13b26399 (2026-11-26, 0c14 and the operator curve): no time left after the
  accuracy items (the round's replay change went into the engine's replayCast, not buffreplay.ts). Still live.
- Closed by worktree-agent-a5e4ed1a5c0c50ba9, 80253f4: six modules by statement (castassembly.ts, replayrun.ts,
  holdinputs.ts, replaycrits.ts, replayedhits.ts; buffreplay.ts keeps replayKitBuffs and BuffReplay), the 130
  top-level statements the original's (checked by AST), importers and the prose citations "buffreplay.ts <name>"
  following the names; measure against 0b094c3 "No log's verdicts moved", snapshots:update unchanged.

## Parked

A new report that hits one brings it back with its full text from there.

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
- **The replay's away state and hitless presses** (the damage-factors report point 5; docs/tried/2026-11-26-0c14-si-away-press.diff
  and the life-end landings diff held back): the accuracy agent of round 13's time holds it.
- **Combos hold every clock more than their stops** (the enemy-clock round; engine assumption `stagger-holds`,
  registered, off): `zmdlogs clocks --all --by operator` (round 13) gives the lateness per clock kind and combo
  operator in one run: Σ residual ≈ 0.23 × held for tick chains across combos, 0.40 for casts, 0.33 for bursts;
  ultimates on time (−0.00). Backlog point 4 makes the curve a reading (done 2026-11-26: `combo-curve`). The combo
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
  the OFFSETS_EXPLAINED entry with it.
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

## What worked well

The reports named their episodes (db87's tick chains, 489c's Corrosion, the 14 pairs, `measure -- --help`'s five
minutes, Ember's steps in 04d4), so each new view was tried on its episode: `holds --dropped --all` put the enemy-clock
round's finding (combos in a Stagger) on its first line, and `clocks --all` reproduced its five probes' numbers in one
run.

## Outcome (round 14)

- 1 (Which rule decided a cast: `zmdlogs casts --why` and `zmdlogs placement --why`): closed before this round (22bcd58, `--choices`); its leftover (scripts/probes/placement/ult-overlap.ts still recomputes its quiet count) not done: a probe, not a tool
- 2 (The burst view's causes are a heuristic, and the enemy's inflictions before a burst aren't shown): done (6959fe6): the burst's record keeps its infliction's frame (StatusEvent `inflictedAt`), burstRows reads it on both sides; the stacks before each burst not printed (`--trace-buff status:infliction`)
- 3 (Two compositions of one fight's check: the snapshot check's and the hit records'): done (1b04e66): composeCheck, which snapshotEntry and hitRecords share; identical records by cli-ab
- 4 (The guessed slow-down curves can't be tried as a reading): closed before this round (22bcd58, `combo-curve`); round 14 added the guard that the data is under the call's reading (126cf94)
- 5 (Which strings are keys, and which are only text): done (e0cec23): replaykeys.ts NO_LANDING and ONE_SIDED
- 6 (buffreplay.ts is one 2,900-line file): done (80253f4): six modules, a move only (no verdict moved: measure and snapshots:update)
