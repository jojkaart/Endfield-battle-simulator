# Backlog after improvement round 18 (2026-11-27)

Task: the points of the reports round 18 read (docs/friction-done/2026-11-27-round-18.md lists them) that round 18
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 18)"
section. Round 17's backlog point 1 (a layered buff's per-layer clock) is carried (its first carry); points 2 and 3
are new. Round 18 had every file to itself. The parked list and the accuracy list follow; the accuracy list gained
one entry (the last: a hold at a Stagger break).

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A layered buff's layers have no clock view

- **What happened:** the away-statuses round exposed Zhuang Fangyi's Xiranflow layers
  (`chr_0030_zhuangfy:suit_expend_spell01.spell_dmg`, a `maxStacks` gear buff) held 3.0 s by the stops where the game
  holds them 0.6–1.2 s (4d60 43–69 s). `zmdlogs holds --why` says only "not a clock: maxStacks", and `zmdlogs clock
  --kit-buff` pairs instances with log runs, not layers with their applications; the only view was `replay
  --trace-buff`, layer by layer by hand. Round 17 made the owner's name work in `--kit-buff` / `--trace-buff`
  (clockview.ts kitBuffKey) and the refusal name the team's keys with that id; the per-layer view is left.
- **Cause:** layered buffs are skipped by the hold placement (holds.ts NOT_A_CLOCK `maxStacks`) and by the clock view,
  which reads BuffTrace instances, one per buff, not one per layer.
- **Suggestion:** a per-layer mode of `zmdlogs clock` for a `maxStacks` buff (`--layers`): each layer's application
  (the trace's stack count rising) against the log's listed layer count at each hit (`hits --zones`' layered
  entries), with the layer's own expiry and the lateness past it, as for instances.
- **Needs:** packages/logs/src/clockview.ts, packages/logs/src/replayrecord.ts (the trace's layer count per step),
  packages/cli/src/commands/zmdlogs.ts, tests/clockview.test.ts. A view: no verdict moves.
- **Why it helps:** gear layers (Xiranflow, Swordmancer-type sets) are a recurring buff-clock question; each agent
  rebuilt the layer timeline by hand.
- **From:** docs/friction-done/2026-11-27-away-statuses.md point 2 (its per-layer clock); backlog after round 17, point 1.

## 2. An assumption's evidence text lives in the engine's source

- **What happened:** round 17 replaced a probe's path by the new view's name in engine assumption `pause-holds`'s
  reading text (packages/engine/src/timeline/assumptions.ts). The next CLI call rebuilt the game-data cache
  ("inputs changed since the last entry written: …assumptions.ts", about 10 s, in every checkout sharing the cache),
  and the brief's engine-change rule asked for a team-ab identity run (3 min with the lock's queue) for a change of
  prose.
- **Cause:** the readings' long evidence texts (each reading's description past its first sentence: measures, logs,
  dates) live in the engine's own source, which the data cache keys on (packages/data/src/cache.ts engineSources
  traces assumptions.ts through the data build's run-time imports) and the engine-change rules cover. Round 18
  looked at a comment- and string-insensitive digest: comments alone don't cover the case (the text is a string
  literal), and a digest that skips string literals could miss a real change (an id is a string).
- **Suggestion:** each reading keeps one sentence in assumptions.ts; the evidence goes to a notes file the CLI reads
  for `efsim assumptions` (packages/engine/src/timeline/assumption-notes.json, keyed by id and reading, or
  docs/design/assumptions.md), outside engineSources' trace; a test that every reading has a note and every note a
  reading. Behaviour-preserving (the readings' ids and defaults stay in the source): team-ab's identity check once.
- **Needs:** packages/engine/src/timeline/assumptions.ts, packages/cli/src/commands/assumptions.ts,
  packages/data/src/cache.ts (only to confirm the notes file isn't traced), tests/engine-assumptions.test.ts.
- **Why it helps:** the open-problems prose of a reading follows the views as they change, without a cache rebuild in
  every checkout and an engine identity run.
- **From:** docs/friction-done/2026-11-27-round-17-friction.md point 3.

## 3. A hold's per-frame steps have no view

- **What happened:** 5082's Yvonne case (her own timeline held about 0.5 s at a Stagger break: shots two frames apart
  logged 0.45 s apart) needed the replay, the stagger view and `zmdlogs holds` side by side, and the hidden holds
  around it turned out spread over 1.5 s in 1-frame steps, which only a debug print showed. Round 18 marked the
  clocks a logged Stagger break falls inside (`zmdlogs clocks --rows`: "a Stagger break inside"; the cast clocks
  with one run 186 ms late at the median against 10 ms without), so the break shows; the steps the placement puts
  around it still don't.
- **Cause:** `zmdlogs holds` prints the 0.512 s units and their placements, not the frames each step holds.
- **Suggestion:** `zmdlogs holds <fixture> --steps <from>-<to>`: the per-frame hold steps the replay applies in that
  window (PlacedHolds' times and the cumulative hold, as frames held per frame), beside the stops there.
- **Needs:** packages/logs/src/holds.ts (PlacedHolds), packages/logs/src/views.ts (holdsView),
  packages/cli/src/commands/zmdlogs.ts, tests/replayrecord.test.ts or a new test. A view: no verdict moves.
- **Why it helps:** a hold the model lacks (a break dilation) or one the placement spreads reads as one table, not a
  debug print.
- **From:** docs/friction-done/2026-11-27-placement-cases.md point 3 (holds --steps).

## Parked

A new report that hits one brings it back with its full text from there.

Point 1 of docs/friction-done/2026-11-26-backlog-after-round-16.md (full text there under the same number), carried twice without a new report:

- 1. The replay's Stagger window starts are derived, not recorded.

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
- **A log-only buff applied to elements its game buff doesn't reach** (docs/friction-done/2026-11-27-exposed-totals.md
  point 1): logeffects.ts maskReaches reads only CheckDamageDecorateMask (the skill-type mask) into
  RawBuffFile.damageMask; a game buff's CheckDamageTypeMask (the element mask) isn't read, so a log-only buff the log
  lists without an element applies to every element (207f: Hard 27's stage Electrification on physical hits, ×0.847 on
  41 hits; special-cased since as enginecheck.ts stageElements). Read CheckDamageTypeMask per damageModifier in
  packages/data/src/buffData.ts (unconditional masks, or the union where a CompareFloat condition's key is never set)
  into a `damageElements` field, have logModifiers give an element-less log effect those elements, and drop
  stageElements. Moves verdicts wherever another log-only buff has an element mask: measure, snapshots:update. Since
  round 17 `zmdlogs groups --operator` lists the own mismatches by their log-only buffs, the first place to look.
- **Fight-wide factor stretches no fixture holds** (round 17's `zmdlogs offsets --all` last section, buildoffsets.ts
  factorStretches, at 6859f9d): 14 stretches in 8 development logs where two or more operators' hits sit at one ratio:
  7b54 four (×0.90, ×0.90, ×0.84, ×0.89: Hard 33's slug, its shield and phase factors, buildoffsets.ts
  OFFSETS_EXPLAINED), fc63 89.9–110.0 s three (×0.95, ×0.91, ×1.13: 62 of 75 hits, Perlica, Typhoeus, Gilberta,
  Arcane), 9c6e 54.6–61.1 s three (×0.71–0.87), and one each in 4e5e (×1.08), 1d91 (×0.93), 3f78 (×0.95), 9847
  (×1.04). Each is a stage factor for the fixture's `stageFactors` (7b54 first: the slug's phases) or one shared
  cause (a team debuff the replay lacks); `zmdlogs groups` counts their mismatches as fight-wide. A stageFactors entry
  moves verdicts: measure, snapshots:update.
- **A hold at a Stagger break** (docs/friction-done/2026-11-27-placement-cases.md point 3; round 18's `zmdlogs clocks
  --all --clock tick,cast`): the cast clocks whose span holds a logged Stagger break run late, 40 rows at a median of
  186 ms (Σ held 45.4 s in them), against 4,785 rows without at 10 ms; 5082's Yvonne +0.51 s across the break at
  44.43 s (her ultimate's shots 0.47 s of kit frames apart, logged 0.98 s apart). The data's
  enablePoiseBreakTimeDilation suggests a break dilation the stop list lacks; a reading for it moves the placement
  and the holds: measure, smoke, team-ab where the engine's timing changes.

## What worked well

Each report's episode was a ready test: c779's crossed bursts for the twin marks, d774's guard for TAILKEPT, 40d9's
Gilberta projectile for a late join, 6339's Si combo for REALIGN, 5082's Yvonne for the break rows, 107766a's
snapshots for `--compare --regroup` (the journal's scratch sums came out the same), and two STATUS_WIDE_FRAMES values
for `--variant <file>:<CONST>=<v>` in one run.
