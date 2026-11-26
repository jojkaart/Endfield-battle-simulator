# Backlog after improvement round 15 (2026-11-26)

Task: the points of the reports round 15 read (docs/friction-done/2026-11-26-round-15.md lists them) that round 15
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 15)"
section. Point 1 is round 14's backlog's point 1, carried (its second carry: parked next round unless a report hits
it); round 14's point 2 was closed by this round. Points 2–4 are new. Round 15 had every file to itself. The parked
list and the accuracy list follow; the accuracy list gained four entries (the last four).

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. The log tools take the game data without the readings of it

- **What happened:** making the ComboSkill curve a reading (engine assumption `combo-curve`) needed the log tools'
  stop lists and the replay's timeline to read the same resampled data, but the log tools take `(data, fx)` in about
  twenty places (placeHits, castTimeStops, skillStops' callers) while the readings travel apart in
  ReplayOptions.assume, so the combo-hold round wrapped the data at four entries (createContext, snapshotEntry,
  hitRecords, the zmdlogs CLI's data()). A script or view that called placeHits with the raw data under `--assume
  combo-curve=…` mixed the two curves silently.
- **Since round 14:** logBuffReplay refuses data not under its call's combo-curve reading (logcheck.ts: "the game data
  is under another of its readings"); its first run caught `zmdlogs decisions` replaying the defaults on the reading's
  data. The mix is now an error, not a wrong number; the signature still lets it be written.
- **Cause:** the readings of the data are options of the replay, not of the data the placement reads.
- **Suggestion:** a log context `{ data, assume }` (data already under the readings: withCurveReading and any later
  data-level reading) that placeHits, the stop builders and the replay take, or `placeHits(data, fx, { assume })`
  applying it, so the placement and the replay can't be given two readings; the views take the context from the CLI.
- **Files:** packages/logs/src/logcasts.ts, logcheck.ts, snapshotentry.ts, hitexport.ts, views.ts, query.ts,
  packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** any later reading of a compiled table (a curve, a hold, a duration) is measurable without patches,
  and a call can't be written wrong. Cost: a signature change across the package (behaviour-preserving: snapshots and
  `zmdlogs hits --json` by cli-ab).
- **From:** docs/friction-done/2026-11-26-combo-hold-and-replay.md point 3; docs/friction-done/2026-11-26-backlog-after-round-14.md, point 1.

## 2. No search of which build changes give an operator's factor, and how many do by chance

- **What happened:** Snowshine's ×0.9624 in 04d4 needed a scan of single and paired build changes (potential, weapon
  skill levels, levels, each gear piece swapped or dropped); `zmdlogs fit-build` covers attribute nodes, the weapon's
  level and foods only, so the bursts-and-cooldowns round wrote scripts/probes/stats/snowshine-builds.ts. 46 pairs fit
  within 0.001: the question is undecidable, worth knowing before a round spends time on it.
- **Cause:** fit-build's candidate space is fixed, and nothing counts how many candidates fit by chance.
- **Suggestion:** `zmdlogs fit-build --pairs` over the wider space (skill levels, gear swaps within the worn set,
  potential, attribute-node subsets by favourability, the operator's level with its promotion), from the probe,
  printing the number of single changes and pairs within the tolerance beside the best, so "one constant, many
  explanations" shows at once; then delete the probe (scripts/probes/README.md: a view replaces it).
- **Needs:** packages/logs/src/buildfit.ts, packages/cli/src/commands/zmdlogs.ts (fit-build's options),
  scripts/probes/stats/snowshine-builds.ts (removed). Tools only: no verdict moves.
- **Why it helps:** a build offset is decided or flagged undecidable in one command; the backlog's accuracy list has
  two such leads (04d4's Snowshine, 99fb's Purrchena at level 1).
- **From:** docs/friction-done/2026-11-26-bursts-and-cooldowns.md point 4.

## 3. The by-operator scoreboard reads as a fight metric but isn't

- **What happened:** the totals-off brief's operator means (Perlica 17.3%, Liino 17.1% …) looked like a shared cause;
  each is the operator's own total error (scripts/accuracy.ts perOperator), dominated by the four stage logs and by
  small totals where a few replay-only beats are 20–60% (Liino's 0eef +58% on a 9 s fight). It took a jq pass over the
  snapshots' `operator <id>` keys to see it.
- **Cause:** docs/accuracy.md's "By operator" table gives the mean without the operator's share of the fight or a
  median, and nothing tells a stage log's effect from a kit's. The share isn't in the snapshots: only each operator's
  error is.
- **Suggestion:** a `share operator <id>` key per fight in the snapshots (snapshotentry.ts totals: the operator's
  logged damage ÷ the fight's), then the table's mean weighted by it and a median; and the stage logs flagged where
  the scoreboard can read them without opening the hold-outs (a list of stage enemy ids in scripts/accuracy.ts, from
  the fixtures' `enemy.id`, rather than a flag in fixtures/holdout/holdout.json). Round 15 didn't: the new key moves
  every snapshot file (not a verdict), which a tooling round that must leave the snapshots byte for byte can't.
- **Needs:** packages/logs/src/snapshotentry.ts, scripts/accuracy.ts, tests/snapshots/ (`npm run snapshots:update`:
  the new keys), docs/accuracy.md (generated).
- **Why it helps:** the next brief built on the table won't send an agent after a cause that is four stage logs.
- **From:** docs/friction-done/2026-11-26-totals-off.md point 2.

## 4. The replay's Stagger window starts are derived, not recorded

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
- **From:** docs/friction-done/2026-11-26-bursts-and-cooldowns.md point 2 (its first half).

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
- **Slots by value within a cast** (docs/friction-done/2026-11-26-totals-off.md point 3): 9c0b's Hunter Pursuit and
  7910's Tangtang rogue wave are placed with a logged landing in the wrong slot (values ×5–17 off); realignUltimates
  handles ultimates only and keeps the first landing's slot, so the cast's start (and its Link) stays wrong. A
  realignment for any kind with the first slot free when the landings are fewer than the slots, by time and by the
  logged values against the kit hits' scales (logcasts.ts). Moves the placement: measure.
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

## What worked well

The reports' episodes made each tool testable on arrival: 4d60's Empyrean end at 106.47 s is worldtime's line without
frames, c4f3's Wolven Blood final pairs 68.50 s with the check's 72.30 s in `zmdlogs clock`, db87's 27.13 s Link is a
LINK line, d4fb's 86.50 s window a FLAG; and the new fact table's test found three fallback readings assuming a crit
the replay had read, on its first run.
