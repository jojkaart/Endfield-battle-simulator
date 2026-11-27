# Backlog after improvement round 21 (2026-11-27)

Task: the points of the reports round 21 read (docs/friction-done/2026-11-27-round-21.md lists them) that round 21
didn't do. Round 21 closed round 20's backlog points 2 (snapshots:update refuses a tree edited since it was queued) and
3 (`zmdlogs hits --layers`); its point 1 (a hold that isn't a cast's stop has no clock view), carried twice without a
new report, is parked, as are round 8's layers point's other parts. Every point of the five reports was done or went to
the accuracy list below: no point is carried. Round 21 had every file to itself. The accuracy list gained four entries
(the last four): the check's targets on 7b54, cutTails' `needed` on the replay's own pairing, a channel inside a
detached file, a freeze on a fight read per target.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## Parked

A new report that hits one brings it back with its full text from there.

Point 1 of docs/friction-done/2026-11-27-backlog-after-round-20.md (full text there under the same number), carried twice without a new report:

- 1. A hold that isn't a cast's stop has no clock view.

Round 8's layers point (docs/friction-done/2026-11-23-backlog-after-round-8.md point 1), its other parts after round 21's
`hits --layers` (full text in docs/friction-done/2026-11-27-backlog-after-round-20.md point 3):

- 1 (the rest). `logReading` as an object (value, zones, modifiers, the kit buffs dropped) and `zmdlogs consumed` per
  consuming cast.

Point 1 of docs/friction-done/2026-11-27-backlog-after-round-18.md (full text there under the same number), carried twice without a new report:

- 1. A layered buff's layers have no clock view.

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

Round 7's points (full text in docs/friction-done/2026-11-23-backlog-after-round-7.md under the same number):

- 2. `zmdlogs clock`'s remainders: `--on/--off` cast brackets, `--all` in place of scripts/probes/buff-clock/lanes.ts,
  the owner's trigger hit after the end with its origin.
- 5. Probes have no "still runs" check (none rotted; round 13 ran tick-chains.ts and tickstag.ts on the shared
  Stagger-span helper).
- 7 (the rest). `zmdlogs statuses <fixture>`: the replay's status events with the logged status hits interleaved.

Round 6's points 1–10 and 12 (full text in docs/friction-done/2026-11-23-backlog-after-round-6.md under the same
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

## Declined

Suggestions declined for good, with why: a later round doesn't rebuild them.

- **A moved hold-out's change split by cast, skill, operator or rule kind** (declined (blindness), round 20;
  docs/friction-done/2026-11-27-break-placement.md point 2): measure's summary was to count the moved hold-outs'
  replayed casts by cast kind and shift bucket (and the breaks or stops near them), paired by a hash of operator and
  skill, for a placement rule that moved one hold-out by −6 plain with no decision kind's count moved. Round 20 built
  it and the lead had it removed: the standing rule for hold-outs is aggregates only, no per-mechanism-class split and
  no stable per-hold-out labels; counts of moved casts by kind and shift are a mechanism-class split of the
  hold-outs' change and point a blind agent at which kind of rule to tune against the hold-outs, hashed names or not
  (docs/design/tests.md "What a hold-out output may say"). A placement rule's hold-out loss is traced on development
  logs (`cli-ab.ts <ref> --placement`, `zmdlogs decisions --all`), with the hold-outs' aggregates as the check.

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
- **The replay's Stagger window starts recorded, not derived** (round 16's backlog point 1, parked, brought back by
  docs/friction-done/2026-11-27-break-hold.md point 3): replayrecord.ts derives a window's start as its end less the
  Stagger's length, which a stop at the break moves: with `break-hold` the replay's windows started 15–17 frames after
  every break, and the hidden holds' still spans let holds rise in those frames (the break-hold round dropped its fix
  on the hold-outs). A `since` frame on TimelineState.stagger, set where resources.ts dealPoise breaks the bar and
  where holdStagger starts one, read by replayrecord.ts in place of the derivation. A record for the engine
  (team-ab), but the still spans, the windows' edges (kitBuffNearChange) and the holds read the windows: measure,
  snapshots:update.
- **A shielded target's landing** (docs/friction-done/2026-11-27-several-targets.md point 3): in 6339's kill gaps the
  next slug takes Camille's Vesperwings as the log lists, but no infliction (her weapon's Heat DMG the replay applies):
  a shielded slug takes 0 damage and no status while kit buffs on hit still apply. TimelineScenario.enemyAway is all
  or nothing; a `shielded` span kind (landings at 0 damage, no infliction or status, on-hit kit buffs applied), read
  only by the replay. Measured as `targets-gaps-away`: one plain and 2.3 points of 6339's total either way; Hard 33
  only so far. Moves verdicts: measure, snapshots:update.
- **The check's targets aren't the replay's landings' on 7b54** (docs/friction-done/2026-11-27-statuses-per-target.md
  point 2; round 21's `zmdlogs hits` `≠ landing`, hitexport.ts targetMismatches): the second assignment
  (enginecheck.ts fightTargets, SECOND_PASS_TARGETS `free`) numbers targets afresh, and atItsTarget reads a candidate
  `t` at the replay's target of that id: on 7b54 147 of 210 hits with both have a check target not among their
  landing's targets (6339 none, 9c6e one, tests/target-statuses.test.ts), so a hit may be read at another slug's
  statuses (most are plain now: the slugs' statuses alike). Map the second assignment's ids onto the replay's (each
  target by the landings it shares with the first pass); `fixed` (each hit on its first-pass target) is ruled out
  (7b54 plain 151 → 142, docs/open-problems.md "statuses per target"). Moves verdicts: measure `--several-targets`,
  snapshots:update.
- **cutTails' `needed` on the replay's own pairing** (docs/friction-done/2026-11-27-tail-cut-test.md point 1):
  replayrun.ts loggedShown takes any landing of the operator's event within 16 frames, no one-landing-each, so abfd's
  two 64.10 s attack-4 hits count as shown after a cut through other pinned landings (−2 plain in the tail-cut entry).
  landingpairs.ts pairKitLandings (round 21) is the check's own pairing as a function of a run's landings; `needed`
  reading it (the statuses' half stays loggedShown's: statuspairs needs the check's value fits) moves verdicts:
  measure, snapshots:update; `zmdlogs decisions --why-kept` shows per kept tail what the real pairing loses.
- **A capped channel inside a detached file gets no end** (docs/friction-done/2026-11-27-interrupted-casts.md point 4;
  round 21's skillCompile.ts Ctx.channel): the channel token would also give KitHit.latestFrame to 9 kit hits whose
  channel sits in a buff's or an entity's own file (latest frames 196, 231 ×4, 32, 36, 215 ×2), which the old
  "not detached" filter left out; the token keeps `!l.detached` so the compiled data stays the same. Dropping it
  changes engine timing (the channel-end join rule, the replay's ticks past their end): smoke, team-ab, measure.
- **A freeze on a fight read per target** (tests/enemy-readers.test.ts, round 21): clock.ts rampRunsOn and
  statusesRunOn (a freeze's ramp and statuses, freeze-ramp) read the current target's statuses only, as the hidden
  holds did before the statuses-per-target round; no fight read per target has a freeze yet. Under everyTarget when
  one does; moves verdicts there only.

## What worked well

Each report's episode was a ready test: 9847's 75.44 s Liino battle skill for `decisions --why-kept`,
abilityEvent 1 for `gamedata handlers` (Arcane's spell_vulnerable all disabled), 6339 at 19.70 s for `statuses
--inflictions`, 0eef's Medicant for `hits --layers`, round 20's unpark of round 6's point 14 for withoutNumbers.
