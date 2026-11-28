# Backlog after improvement round 23 (2026-11-28)

Task: the points of the reports round 23 read (docs/friction-done/2026-11-28-round-23.md lists them) that round 23
didn't do. Round 22's backlog point 1 is half done (`zmdlogs clocks --around break`): the views' own stop list is
point 1 below; its point 2 (a test per row of the clock table) is closed (tests/clock-table.test.ts). Point 2 is round
22's own report point 2 (the zmdlogs CLI as one module), not built this round. The accuracy list gains three entries,
the parts of this round's points that move verdicts: a cast's slots cut to its path, a value rule on a consumed-scaled
hit's multiplier bounds, the placement's unplaced ultimate events on the cast assembly's reading. Round 23 had every
file to itself.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A hold that isn't a cast's stop: the views' one list

- **What happened:** the break-hold round's `zmdlogs clocks --rows` marked rows with a break inside, but their
  residuals mix the placement's mistakes (Si's combo +2.5 s) with the hold, and the tick chains are cut at the
  Stagger's edges, so no tick row spans a break; the agent wrote scripts/probes/stagger/break-hold.ts for per-break
  rows. Round 22 gave `zmdlogs clocks --breaks` and `zmdlogs worldtime --holds --without` / `--series` on the
  timeline's applied slow-downs (packages/logs replayclock.ts); round 23 gave the per-break rows (`zmdlogs clocks
  --around break`: clocksview.ts breakPairs, 5082's Yvonne at 44.43 s +323 → −111 ms with the engine's holds). The
  views' own stop list (replayTimeStops: `lanes --world`, `cadence`, `worldtime`'s first line) still lacks the
  engine's non-cast stops.
- **Cause:** the views' world time is the replay's casts' stops only (castassembly.ts replayStops); engine holds that
  come from events (a break, a dodge, a freeze) have no place in that list, and the list also feeds the placement.
- **Suggestion:** replayStops' callers in the views taking replayclock.ts's applied stops (or an `events` list of
  non-cast stops, holds.ts breakStops) where they have a replay, the placement's list left as it is.
- **Needs:** packages/logs/src/query.ts, packages/logs/src/replayclock.ts, packages/logs/src/views.ts (the views
  reading replayTimeStops), tests/query.test.ts. A view, but replayStops also feeds the placement: check `node
  scripts/cli-ab.ts <base> --placement` (the list's use there must stay as it is) and `node scripts/identity.ts
  --base <base>`.
- **Why it helps:** the next event-borne hold (a Lift, a Knock Down, a perfect dodge) is a view away, and a fixed hold
  stops showing as lateness.
- **From:** docs/friction-done/2026-11-27-break-hold.md point 2; backlog after round 19, point 1; backlog after round
  20, point 1 (parked by round 21); backlog after round 22, point 1.

## 2. One CLI module for thirty subcommands

- **What happened:** every view of round 22 (and round 23's `replay --sp`, `clocks --fit / --json / --around`,
  `totals --side`) meant three edits in packages/cli/src/commands/zmdlogs.ts: the usage string, the shared options
  object (one namespace: `--side` already meant enemy|team in `ends` and now means log|replay in `totals`) and a
  branch in one `run` function of about 900 lines.
- **Cause:** the CLI's one-module-per-command rule stops at `zmdlogs`, which holds every log view; command.ts parses
  one options object per command, so subcommands share it.
- **Suggestion:** a `subcommands` field on command.ts's Command (each with its usage lines, options and run), cli.ts
  picking the subcommand by the second positional and parsing with the global, the command's and the subcommand's
  options; packages/cli/src/commands/zmdlogs/ with one module per subcommand; REPLAYING / NOT_REPLAYING from a field
  of each; `zmdlogs which` reading the per-module usage. A move: the usage text and every subcommand's output the
  same (tests/zmdlogs-cli.test.ts, `cli-ab.ts HEAD -- zmdlogs …` on a few views).
- **Needs:** packages/cli/src/command.ts, packages/cli/src/cli.ts, packages/cli/src/commands/zmdlogs.ts (split),
  packages/cli/src/which.ts, tests/zmdlogs-cli.test.ts.
- **Why it helps:** a new view is one new file; options can't collide across subcommands silently.
- **From:** docs/friction-done/2026-11-28-round-22-friction.md point 2.

## Parked

A new report that hits one brings it back with its full text from there.

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
- **A cast's slots cut to its path** (docs/friction-done/2026-11-28-placement-cases.md point 2, the part that moves
  verdicts): round 23 tags each skill slot with its path (logcasts.ts Slot.path: pathStart, pathEnd) and the
  placement's cast end reads the first slot's tag, the same numbers; a cast's slots kept only on its first landing's
  path (and the twin and value rules reading `path` instead of a rule per case: Rossi's combo 3, Purrchena's shielded
  combo, Laevatain's battle skill) moves every jump-pathed cast's later slots. Measure: `--split hunks` beside de6a's
  Pogranichnik combo (fixed by pathEnd, the check that the tag path gives the same).
  Closed by worktree-agent-a44e9ee2d8c7368e5, f337fa7: logcasts.ts pathSlots / onPathFrom (a slot after the first on
  its path or on a jump's after it; the world time from the first landing's slot; realignByValue on one path); de6a
  unchanged, 8f32 plain 405 → 409 (Alesh's combos), one hold-out +1 plain / −1 assumed.
- **A value rule on a consumed-scaled multiplier's bounds** (docs/friction-done/2026-11-28-placement-cases.md point 3,
  the rule): logcasts.ts multiplierBounds (round 23) gives a hit whose value reads `consumed` its least and greatest
  multiplier (consumed 0 and 4); a value rule that rules out a slot whose least multiplier is above the hit's value
  (8f32 36.11 s: Rossi's combo 2 hit_2, 12,877, placed as a combo 3 perfect strike, its Lift 2.4 s early, the
  Endministrator's 38.50 s shatter lost, −1.28% of the fight; the rule written and dropped then had no bound) moves
  verdicts: measure, snapshots:update.
  Closed by worktree-agent-a44e9ee2d8c7368e5, 4e0f3a6: logcasts.ts keptByValue (Group.bounds; a superseded landing
  kept on its cast where the next slot fits its value and the chosen other group's slots can't); 8f32 plain 395 → 405,
  damage +2.1 → −0.2%, the shatter made.
- **The placement's unplaced ultimate events at the cast assembly's start** (docs/friction-done/2026-11-28-break-combo.md
  point 2, the rest): castassembly.ts ultimateEventRead (round 23) is the one reading of a hitless ultimate's event
  (press or stop's end) that loggedCastStart and the replay view's EVENT line read; logcasts.ts unplacedCastStops
  still starts each such event's stop at the event (458b 84.37 s: Akekuri's ultimate made at 82.53 s, its stop in the
  placement's list from 84.37 s). Reading ultimateEventRead there moves the placement's stop lists: measure,
  `cli-ab.ts <base> --placement`.
  Closed by worktree-agent-a44e9ee2d8c7368e5, f920e82: unplacedCastStops reads it (ultimateEventRead moved to
  ultimateevent.ts, castassembly.ts re-exports it); no log's verdicts moved (4bfc's 144.37 s pair placed elsewhere).
- **INSIDE flags that are a shut combo window** (round 23's startGateWords on `zmdlogs decisions --all`, at 1da5562):
  of the development logs' 72 INSIDE lines, 18 are held by the cast's combo window (shut until later in the replay:
  the replay's combo trigger, an infliction or a hit, comes after the log's press; 0eef 6.77 s, Typhoeus's floating
  combo), 9 by the SP cost (the replay's SP short: the `sp short` keys), one by a cooldown, one by a later gate and
  one with a priority that outranks; the rest by a window of the running action (34) or its uncuttable frames (8).
  The combo-window and SP ones say the replay's trigger or SP is late, not that the kit forbids the press: leads for
  an accuracy task (which trigger, how late), and the flag's kind could tell them apart. Measure.
  Closed in part by worktree-agent-aae9ee5eca9001663 (the combo-windows task, 2026-11-28): Typhoeus's 5 fixed (her
  Signs at a burst's application); 12 are openers logged inside the combo's own slow-down (a placement lead, the
  INSIDE line now says so); 3f78 19.30 s a cooldown question (docs/open-problems.md "Combo windows").

## Outcome (round 24)

- 1 (A hold that isn't a cast's stop: the views' one list): parked (carried twice without a new report; its full text
  stays here under point 1).
- 2 (One CLI module for thirty subcommands): carried (2026-11-28-backlog-after-round-24.md point 1).
