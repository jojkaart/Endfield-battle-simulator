# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 203 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-28: Placement paths: a value rule on multiplier bounds, slots cut to a path, hitless ultimate stops

**Goal:** the three placement entries round 23 added to the backlog's accuracy list
(docs/friction/2026-11-28-backlog-after-round-23.md): a cast's slots cut to its path, a value rule on a
consumed-scaled multiplier's bounds (8f32 38.50 s), the unplaced ultimate events' stops at the cast assembly's
reading (458b 84.37 s); then 9c6e's 78.88 s array tick pair. Base main at 967d460; files: packages/logs/src/
logcasts.ts, castassembly.ts, placementwords.ts, the new ultimateevent.ts.

**Done:**
- **A landing kept on its cast by value** (logcasts.ts keptByValue, Group.bounds from multiplierBounds, PlacedJoin
  `value`): a landing a newer cast of its operator's would take off its open cast (`superseded`) stays on it where
  its value, against the cast's last landing with crits taken out, fits the next slot's multiplier within
  VALUE_TOLERANCE and lies outside every slot of the group the key's choice would open (widened by the same). The
  choice is now worked out lazily before the join (openChoice). 8f32 36.11 s: Rossi's combo 2 hit_2 (×0.60, as hit 1)
  against a combo 3 perfect strike (×3.45–11.73): kept, so the 38.50 s perfect strike opens the combo 3, its Lift at
  38.50 s, and the Endministrator's crystal shatter is made.
- **A cast's slots cut to its first landing's path** (pathSlots, onPathFrom): after the first landing, a slot on the
  same path before its end, or on a path a jump on it (at or past the first landing) goes to; the slots before it
  stay as they are (PlacedHit.index counts in the whole list). The world time from the first landing is measured
  against its own slot (`head`), not slot 0, for a jumped first landing; realignByValue assigns one path's slots only.
  8f32 2.02 / 10.02 s: Alesh's 10.02 s hook and slam had joined her 1.29 s combo 7.4 s late as its Rare Fin slots;
  now a combo of their own, and the 2.02 s cast the Rare Fin path by value.
- **A hitless ultimate's unplaced event stop** (unplacedCastStops): from ultimateEventRead's start against the placed
  casts' stops (458b: Akekuri's from 82.53 s, not 84.37 s). ultimateEventRead moved to ultimateevent.ts (a move:
  logcasts.ts can't import castassembly.ts, which imports it); castassembly.ts re-exports it.
- **The second pass's stops with the ultimate merge** (passStops, ultimateMerge): the first pass's stops were built
  without Placement.merge, so 9c6e's Liino ultimate (cast at 67.85 s) placed again from her song's 78.88 s beat made a
  stop 76.30–78.87 s, a frame before the Barrage Array's first tick pair: `byTime` saw a stop's end that could batch
  it. Now one cast: the pair a twin by time, the array's ticks in turn.

**Measured** (`measure --at HEAD --base`, one commit at a time): the value rule 8f32 plain 395 → 405, damage +2.1 →
−0.2%; the ultimate stops no verdict moved (4bfc's 144.37 s volley pair placed elsewhere); the path cut 8f32 405 → 409,
one hold-out mixed (+1 plain, −1 assumed, its mean per-hit error closer); the merge 4bfc 870 → 876, damage −0.6 →
+0.1%, 9c6e other (combo kind +7.6 → +7.0%, Typhoeus −12.2 → −12.3%, damage −11.1% both). Nothing worse.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 84.2 → 84.3%, mismatch 4.6%,
|damage error| 1.3 → 1.2%; hold-outs plain 82.5 → 82.6%, mismatch 5.1%, |damage error| 5.9%; earlier pending plain
84.9 → 85.0%, |damage error| 1.2%; several targets unchanged but 9c6e's totals. Log-side only (packages/logs): no
simulated fight moves, so no team-ab.

**Decisions:** the value rule asks the choice the placement would make (not every other group), since a new cast of
the cast's own skill fits the same value; it only overrides `superseded`, not `pressed`, the channel end or `used`.
The path cut stays a prefix of the slot list, so the slot indices realign and the replay read stay valid. The pass
merge is the final placement's own rule applied to the stops pass 2 reads; castTimeStops' other callers (the cast
assembly's stop list) keep their list unmerged (not measured: their merge would move the replay's stops).

**Left:** 458b's 111 s layer ends 0.3 s early (world holds 88.7–111.5 s: not the ultimate's stop); the Decisive
Assault's frame (open, a fit only).

## 2026-11-28: Combo windows: Typhoeus's Signs at a burst's application; openers logged inside a combo's slow-down

**Goal:** the backlog's accuracy entry "INSIDE flags that are a shut combo window" (docs/friction/2026-11-28-backlog-after-round-23.md):
the development logs' 18 INSIDE lines held by the cast's combo window, by cause; fix what the data decides.

**Found** (docs/open-problems.md "Combo windows"):
- **Typhoeus, 5 lines** (0eef 6.77, bdf2 11.00, 1d91 8.63, d9e5 11.17, af7b 68.97 s): each floating combo pressed after a
  Power Shot's arrow (or Arcane's Nature infliction, af7b) and before its burst's damage, where the replay's 8th Sign
  came. Her talent's listener (passitive_enemy_listennaturalspellbrust) runs on abilityEvent 9, a buff added to the
  enemy, with the Nature-burst tag that buff_common_natural_natural_triggered and her Power Shot's own burst buff
  carry: the Sign comes at the burst's application, one triggerInterval (1 s, or 0.35 s for her shot) before its damage.
- **12 lines: the opener logged inside the combo's own slow-down** (2–17 frames into 18–25 frames at 0.01: 0.05–1.6
  frames of the world's time), mostly at a ms the combo's own first hit or cast event shares. The kit triggers are
  right; it is the pinned landing's ms (a placement lead, handed back).
- **3f78 19.30 s** (Arcane): her combo 17.17 s after the last against an 18 s cooldown; Gilberta's ultimate's
  infliction came while it ran. Unexplained (a reduction the kit lacks, or either combo's placement).

**Done:**
- Engine: StatusEvent `burstApplied` (landing.ts delayBursts at each burst's infliction, landHit at a burst hit's
  landing, a delayed one's before its damage; not recorded) and StatusOn burst `applied` (events.ts, the kit schema);
  Typhoeus's three Sign triggers read it. tests/burst-applied.test.ts (fails at the base: verify-at).
- Her Sign conversion moved from a delayed cast trigger (frame 35) onto her combo's first arrow (launched at frame 35):
  with the Sign at the application, fc63's conversion (her clock through Gilberta's and Arcane's combo slow-downs put it
  at 59.33 s, the logged arrow at 58.65 s) removed the Sign of Arcane's 58.77 s burst, and her 4th Power Shot at
  89.23 s became a plain shot the log contradicts. A simulated fight's frame 35 is the same.
- timing.ts startGateWords: a shut window's last opening, the skill's last cast, its latest recorded trigger and the
  cooldown that kept it shut, and a start inside the combo's own slow-down (views only).

**Measured** (`measure --at HEAD --base 1c11c35`, the views commit): no log's verdicts moved (the replay makes the
casts as logged; only the flags and the windows' facts at the casts moved); the first version, without the conversion
move, had fc63 "better" (3.2 → 0.9%) by losing that Power Shot, the reason for the move. `typhoeus-sign-cooldown`
`shared` against the default still loses 1d91's Sign (plain 354 → 352), at the applications' times now (10.83 and
10.93 s): `by-source` stays. Final measure against main at f031780 and `npm run snapshots:update`: see the
scoreboard. `npm run smoke`: only the Typhoeus zero-energy example moved (its snapshot, regenerated).

**Team numbers** (team-ab against 967d460, 32 seeds): the owner's team unchanged (its fight the same); Typhoeus's team
sustained DPS +2.60% full energy (56,949 → 58,428, sd 1,942–2,096), +3.03% zero (55,172 → 56,844, sd 2,669–3,039),
within about one sd: her combo windows open 10 frames earlier after her own shots, 30 after a teammate's infliction.

**Decisions:** not behind an assumption: the data names the event (abilityEvent 9, the tag on both burst buffs) and
five presses fit only it. The 12 slow-down cases left to the placement (their files); the INSIDE flag still counts
them (the friction report suggests a kind of its own).

**Left:** the 12 openers' placement; 3f78's cooldown; fc63's battle skills INSIDE her combo's window 0 (her clock
through overlapping combo slow-downs runs late against her pinned landings, as the conversion did).

## 2026-11-28: Improvement round 23: why a change moves a log, the replay's SP as a record, measuring without re-measuring

**Goal:** the five open friction reports and round 22's backlog (docs/friction-done/2026-11-28-round-23.md), tools
only: no verdict moves.

**Done** (round summary for the details):
- Why a change moves a log: packages/logs landingmoves.ts in `measure --hits` (a `landings:` line per moved log:
  lost its landing with the NOLAND reason, a shift onto another logged hit's) and `zmdlogs hits --against`
  (HitRecord.dropped): 3aa6 under `combo-operator-hold=4f-episode` loses 4 of Zhuang Fangyi's landings to their `if`.
  The INSIDE line names the gate that bound (timing.ts startGateWords): 0eef's Typhoeus combo at 6.77 s is her combo
  window, not her attack's frames. `efsim kit` prints skillSpecification, priority, channels; every kit skill's
  specification is held to its kind (tests/skill-specification.test.ts).
- SP as a record: TimelineState.spGained (a statistic), `zmdlogs replay --sp` and TOPUP lines (spview.ts), the
  describing snapshot keys `sp short` / `sp short casts` and measure's "Team SP the replay lacked" line.
- Measuring: `measure --plain-from` / `--trust-plain` (a variant run's plain.json), snapshots:update stops at the
  first code change, `zmdlogs clocks --json / --fit / --around break`, `efsim gamedata curve`.
- One rule per question: the EVENT line's nearest cast, castassembly.ts ultimateEventRead, Slot.path.
- Traps and rules: heldMs and an ESLint rule on exact worldMs, multiplierBounds, `zmdlogs totals --all --side`,
  scripts/lead-status.ts, --help in every script, the assumptions notes' form written down, edit.ts's part-of-a-line
  form documented, tests/clock-table.test.ts.
- Paperwork: docs/friction/2026-11-28-backlog-after-round-23.md (points 1–2, three new accuracy entries), the reports
  and round 22's backlog in docs/friction-done/ with their outcomes.

**Checked:** `node scripts/identity.ts --base e865411`: the compiled data and every log's replay record the same (0 of
65 development, 0 of 13 hold-outs) at 4fe2e66 and at the last code commit; snapshots:update and team-ab as the round
summary says; premerge at the final commit.

**Decisions:** SP shortfall as a describing key (not a worker field), so measure's reference side comes from the
snapshots for free; the INSIDE gate in words from a mirror of actionGate's options (views only), not by instrumenting
the hot gate path; `--plain-from` reuses only on equal git trees of packages/, scripts/ and fixtures/ unless
`--trust-plain`, since an identity check costs as much as the plain run it would save; --help answered on the first
argument only, so wrappers (with-lock, cli-ab) pass a command's own `-h` through. The zmdlogs CLI split (round 22's
own point 2) needs a subcommand layer in command.ts and cli.ts: carried as a task of its own.

**Problems:** none beyond the round's own: edit.ts always matched a part of a line (only its header said whole lines);
the first `--plain-from` tries measured again, rightly, on code changed in between.

## 2026-11-28: Breaks inside a combo's slow-down; Akekuri's ultimate as an ultimate

**Goal:** docs/open-problems.md "The hold at a Stagger break": 458b 87.47 s (Akekuri's combo INSIDE her ultimate),
whether and how a break inside a combo's slow-down holds, a press inside a hold.

**Found:**
- 458b 87.47 s is the placement of Akekuri's ultimate: its hitless event at 84.37 s was read as the press
  (castassembly.ts loggedCastStart wants another's hit within 500 ms after it), though the team's next hits fall
  inside the 1.83 s stop a press there would make. From its stop's end (82.53 s) the combo clears the ultimate's
  cantCastSkill channel (frames 0–119), and the log's team ATK layer starts (84.47, 86.03, 87.14 s) are the ultimate's
  SP grants at its frames 59, 86, 119. castassembly.ts was the placement agent's file: held back
  (docs/tried/2026-11-28-ult-event-stop-end-held-back.diff), then applied on this branch after that agent's merge.
- Akekuri's ultimate file says skillSpecification 0, the only ultimate of 34 not 5: the engine gave it a plain skill's
  interrupt priority and no ultimate's stop (458b 158.53 s INSIDE her combo; a break inside her stop held by the
  engine, not by the replay's stop list). skillData.ts ultimateSpecification reads it as 5.
- A break inside a combo's slow-down holds, on top of it: engine assumption `break-hold-combo` (`added`: the running
  slow-downs pause through the hold; `lowest`, the earlier rule; `none`), clock.ts addedHold and holds.ts breakStops.
  scripts/probes/stagger/break-combo.ts: 18 development breaks inside a combo's slow-down, most at its end where the
  readings differ by a frame or two; the stamped-inside ones (4360, c4f3, d4fb, f574, 458b 85.57 s) fit `moments`, the
  next moment being the clock the hold released.

**Measured** (`measure --variant`, on 2f4afbd): `added` against `lowest` development 00ae +2, 9090 +1, hold-outs one +2
and one −1 plain, 458b damage 0.6 → 0.5%; `none` hold-outs 82.5 → 82.4% (one −7), development 00ae −2, 9090 −3. The
specification fix alone: 458b 1093 → 1087 (its ultimate's third SP grant, from the misplaced 84.37 s start, at 88.33 s
displaces the combo's 88.20 s team ATK layer); with the held-back diff 1089, the rest unchanged: the layers then start
where the log has them (88.20, 88.68 s) and end 0.3 s before the log's at 111.0–111.6 s (the base's plain there came
from a layer the log's starts contradict: the ultimate's grant at 88.93 s).

**Decisions:** `added` the default (the breaker's own clocks are held by its break, and a combo's slow-down is an
action on its caster's timeline; measured better than `lowest`, `none` worse). The specification read as 5 (the
data's 33 other ultimates, the skill's own time stop, 458b 158.53 s); its 458b cost explained above, recovered in part
by the held-back diff. A press in a hold stays undecided (9847 57.64 s's event lag fits both).

**Scoreboard** (`npm run snapshots:update`; measure against main at 3717a31, the ultimate-event diff applied):
verified 78.5% and development 84.2% plain (00ae 689 → 691, 9090 1030 → 1031), hold-outs 82.5% (one +2, one −1
plain), earlier pending 84.9% (04d4 597 → 599; 3aa6 mixed, 419 → 420, mismatch 19 → 17; 458b 1093 → 1089, as
above), several targets 69.4%: every row's percentage unchanged. **Team numbers**
(team-ab against 2f4afbd, 32 seeds): the owner's team sustained DPS +0.95% full energy (53,513 → 54,023, sd 1,319),
−0.32% zero (53,059 → 52,889, sd 1,392), within one sd; Typhoeus's team unchanged (its fight the same). `npm run
smoke` passed. The ultimate-event diff is log-side (castassembly.ts, read only by the replay): no simulated fight
moves, so team-ab wasn't rerun for it.

**Left:** 458b's layer ends at 111 s, 0.3 s early (world holds between 88.7 and 111.5 s);
Wulfgard's combos pressed inside his own ultimate (1a77, 8056: INSIDE 26–41 frames, the ultimate's hits running on).

## 2026-11-28: Placement cases: a twin by time, a cast's path end, the Decisive Assault ruled out

**Goal:** three placement leads (docs/open-problems.md): Pogranichnik's Decisive Assault logged 0.21–0.44 s after
its event against the data's frame 25; f574's one Mi Fu Trail and Mangle on two slugs placed as two casts (50 SP
spent twice); the placement's log-only casts (f879 95.10, 5082 45.06, 3aa6 125.65 s). Base main at 2f4afbd.

**Done:**
- **A twin by time** (logcasts.ts placeWith `byTime`, PlacedTwin `time`; tests/target-twins.test.ts): in a fight
  read per target, a key's second hit at its slot's landing's ms, alike in value, where the next slot is due more
  than ON_TIME_MS later and no stop holds the world in the ON_TIME_MS before that ms (the log flushes about every
  100 ms and at a stop's end), is that landing on another target. f574's flurries (frames 3 and 10, alike) at one
  ms had been one slug's two flurries; now one cast, f574's SP short 110 → 56. It also pairs 9c6e's Barrage Array
  ticks on its two enemies and 7b54's Laevatain attack 2 at 16.36 s.
- **A cast's slots end with its path** (logcasts.ts pathEnd; tests/placement-cases.test.ts): a cast's slots, span
  and reach end at the skill's first InterruptCurSkillAction after its first landing (no jump between skipping it).
  de6a 132.20 s: Pogranichnik's combo (de6a logs no cast events) had joined the 108.61 s combo, whose path-0 slots ran
  into the jumped paths' 223–261. d572: Rossi's attack 4 hit_ai (past the jump to 189) no longer joined to a
  controlled-path cast.
- Lead 3: all three named casts were fixed 2026-11-27; the log-only list at 2f4afbd is in open-problems ("Log-only
  landings": Arcane's INT lasers, 8f32's crystal shatter, the Assaults, de6a's combo, now fixed).

**Scoreboard** (snapshots:update against HEAD): verified, development and hold-out unchanged; earlier pending plain
84.7 → 84.9%, mismatch 4.4%, |damage error| 1.2% (de6a better, plain 298 → 317, damage −0.5 → +0.1%; d572 mixed,
plain 1039 → 1044, damage 1.3 → 1.4%: its attack 4 a cast of its own); several targets plain 69.4%, mismatch 14.9%,
|damage error| 14.1 → 14.3% (f574 −26.5 → −27.4%, 9c6e −11.0 → −11.1%: the one cast lands less than the phantom
second did; f574's replay values run ×0.83 of the slugs' logged ones anyway). No engine or kit change: no team-ab.

**The Decisive Assault (not built):** by event kind, after his combo slash 0.21–0.25 s (one 0.70 s), after a
teammate's Lift 0.25–0.44 s, after his own Breach 1.04 s; the harasses after a slash 0.6 s. Ruled out: its own
slow-down (finish4's curve: frame 25 at 34.9 frames, `harass-slowdown.ts finish4`), the final rush's 1 s slow-down as
a world-wide one (teammates' hits at their kit frames across it in d4fb and 7e19; the buff is on the enemy), an
earlier trigger (none 1.0–1.2 s before six of the nine). A frame from the logs alone would be a fit.

**Dead end:** 8f32 38.50 s (the Endministrator's crystal shatter, −1.28%): Rossi's combo 2 hit_2 at 36.11 s taken
for a combo 3 perfect strike (its Lift 2.4 s early, before the crystals). A rule keeping it on the open combo by its
value was dropped unmeasured: the perfect strike's multiplier (`consumed`-scaled) has no nominal scale, so no value
rule can compare it; next a lower bound for such multipliers. Friction: docs/friction/2026-11-28-placement-cases.md.

## 2026-11-28: Team SP: Purrchena's counter presses, the SP readings as assumptions

**Goal:** the replay's SP runs short of what the logs' casts need (open-problems "Team SP"): recount it, work
through "Still possible" from the data and the logs, fix what they decide.

**Done:**
- Recount at 10aa577 (scripts/probes/sp/shortfall.ts): 16 of 65 development logs short, 41 casts, 1,327 SP, all
  battle skills; 04d4 621 of it, Purrchena's presses in the away stretches.
- Purrchena: the log records every press of her battle-skill button as a normal_skill event, the counter's too.
  The replay made each hitless event a battle skill (100 SP, forced against her kit while the counter was readied)
  and, where the counter's headbutt is logged 0.29 s after the event, both. castassembly.ts variantCastOf now takes
  a follow-up variant placed at its event (nearer than half the first frame the battle skill's windows allow the
  counter: 269.81, 329.46, 419.96, 505.25 s); replayrun.ts replayedSkill skips a hitless event while the kit holds
  the slot's other variant (the enemy away: 264.25, 325.64, 395.79, 400.31, 407.54, 500.37 s; each later counter
  comes inside the 10 s of the battle skill before, so these didn't use it up). 04d4 621 → 0 SP; measure: 04d4 plain
  590 → 597, per-hit error 5.82 → 5.68%, 99fb plain 183 → 190; earlier pending plain 84.6 → 84.7%. After it: 15 of 65
  logs, 27 casts, 706 SP.
- Ruled out: teammates' unlanded Final Strikes (232 placed Final Strike casts in the 15 short logs, every logged hit
  landed: scripts/probes/sp/unlanded.ts); a kit missing an SP key the data grants (scripts/probes/sp/keys.ts; Laevatain's
  P1 return on her empowered hit was already read).
- Engine assumptions `sp-regen` (`pause`, the default; `ticks`: 4 SP every 0.5 s, the timer restarting at each spend)
  and `sp-start` (`200`, the default; `full`), resources.ts spAt / spReachedAt, the state's spTick, timing.ts and
  wake.ts reading it, the search keying the ticks' phase. Under them (scripts/probes/sp/readings.ts): `ticks` 11 logs /
  577 SP, `pause` + `full` 5 / 323, `ticks` + `full` 5 / 251. Five logs are short in their first 12 s whatever the
  regeneration (79cc: four battle skills in 11 s, 92 SP); a full start covers them all. In-game test 113 (the bar at
  a fight's start) is ready; 102 stays not testable.
- Scoreboard (snapshots:update): verified, development, hold-out and several targets unchanged; earlier pending plain
  84.6 → 84.7% (04d4 mixed: plain 590 → 597, mismatch 293 → 292, damage −1.4 → −1.5%, its skipped presses no longer
  making Purrchena's on-cast gear buff; 99fb better, 183 → 190). team-ab against 10aa577 at the defaults: every
  number +0.00% (only the rule text differs). With `ticks` and `full` as the defaults (a run to see what they'd move,
  not committed), sustained DPS: the owner's team 53,513 → 54,517 (+1.9%) full energy, 53,059 → 53,482 (+0.8%) zero;
  Typhoeus's team 56,949 → 57,845 (+1.6%), 55,172 → 58,090 (+5.3%); the scenarios' 60 s timelines +0.7% / 0 / 0 / 0.
  main merged at 1771492 (the combo hold's readings, no fight moved); the final measure against it.

**Decisions:** the defaults stay: the logs only bound SP from below, so a more generous reading can't be shown
right by them; the start's 200 is the native settings' (as Endaxis reads them) and test 113 can decide it by eye;
`ticks` fits 666bj's test and the data no better than `pause`, and keys a search state's tick phase (fewer merges).
A hitless counter press is skipped, not made: making it used the counter up, and the counters the log shows after
it were then forced against the kit.

**Problems:** the lock queue (another agent's measures) cost about 15 min per measure; a first version made the
hitless presses as counters, measured, then replaced by the skip (the forced counters after them).

**Left:** test 113; 1d91 52.27 s, 79cc 28.70 / 31.47 s, 9c6e 51.83 / 76.50 s, af7b 36.60 s; f574's Mi Fu Trail and
Mangle on two slugs placed as two casts (a several-targets placement case: 50 SP spent twice).

## 2026-11-28: A combo's excess hold: per episode, not a share; the still-possible list decided

**Goal:** docs/open-problems.md "The enemy's clock: a combo holds every clock more than its stop list says": remeasure
the excess on today's code, test the "Still possible" list, build what it decides.

**Found:**
- The excess is still there at development plain 84.2% (`zmdlogs clocks --all --clock tick,cast,burst --breaks --by
  operator`, combos only, Σ residual ÷ Σ held): the enemy's tick chains 0.23 (0.22 in the log's Stagger), casts 0.40
  (109 rows, median 240 ms), bursts 0.30; across an ultimate 0.00 / −0.03.
- It is a constant per episode (a run of overlapping combo slow-downs), not a share of the hold
  (scripts/probes/combo-hold/episodes.ts): a cast across one combo is 212–285 ms late at 291–615 ms held; across two
  pressed together about as late (363 ms median over 10, Zhuang Fangyi's battle skills across Liino's and Xaihi's 265,
  −187, 363, 79 ms). A constant per combo fits the rows a little better than a share for ticks, casts and bursts.
- Decided from the data and the logs: the layer-1 TimeDilationActions the compiler drops hold the caster or her own
  objects in 5 of 6 combos, only Arcane's her target (gated by onlyExecuteWhenSourceIsGuard, elsewhere a camera
  actions' flag), and the enemy's statuses across Arcane's combos run as late as across others': ruled out. The
  controlled operator's casts run late as the teammates' do (162 against 211 ms an episode), and the enemy's ticks too:
  no camera or cut-in holding teammates apart. The edges (edges.ts, rerun): nothing late before the start, already late
  right after the end.

**Done:** engine assumption `combo-operator-hold` readings `4f-episode`, `5f-episode`, `6f-episode` (timeline/clock.ts
slowDown: the extra frames only at a slow-down that starts while none runs), tests/combo-operator-hold.test.ts; today's
numbers on the registry's readings and docs/design/assumptions.md.

**Measured** (`measure --variant`, each against the plain tree): `4f-episode` verified, development and hold-out plain
unchanged, earlier pending 84.6 → 83.9% (4bfc −36, half of `4f`'s −97; 3aa6 −40); `4f` verified 78.5 → 77.6%, earlier
83.4%; `plateau-0.6` verified 78.2%; `combo-curve` `middle` verified 76.1%, development 83.5%, hold-out 81.5%, `flat`
73.5%, 82.9%, 80.0%; `stagger-holds` `combos` development 84.4%, verified 78.0% (0eef −4). None the default.

**Decision:** no reading made the default. The loss under every operator hold is the replay's: its landings are
pinned to the log, so the hold moves only what isn't, Zhuang Fangyi's strike_n stack on her clock (3aa6 21.26 and
32.90 s: the strike's `if` fails and each later strike takes the one before's value), while her strike there lands where
`none` puts it. The engine default is unchanged: no simulated fight moved (team-ab's identity check; snapshots:update
"No log's verdicts moved").

**Open:** why some casts take the per-episode hold and others not (Zhuang Fangyi's strikes on time in 3aa6, late in
4bfc and d774); a world-clock hold per episode (about 2.5 frames; the hidden holds take it outside a Stagger);
`4f-episode` for simulated fights, which the replay can't judge while its landings are pinned.

## 2026-11-28: Improvement round 22: clocks, screening, views that say why, a move's identity check

**Goal:** the five open friction reports and round 21's backlog (docs/friction-done/2026-11-28-round-22.md), tools
only: no verdict moves.

**Done** (round summary for the details):
- Clocks: packages/logs replayclock.ts (the timeline's applied stops and the hidden holds as TimeStops, a hold added
  to any stop), `zmdlogs worldtime … --holds --without <op>` and `worldtime <fx> --series <re>` (fc63's array across
  Typhoeus's ultimate: 4.29 s world with every stop out, 6.36 s with hers left in, 4.00 s expected), holds.ts
  tickChains as the one chain rule, `zmdlogs clocks --breaks` (5082's Yvonne at the break +0.5 → +0.05 s), `zmdlogs
  casts --event-lags` (Typhoeus's combo +0.53 s, Arcane's +0.29 s), docs/design/timeline.md "Which clock each hold
  holds" (and the burst sentence's own-ultimate reading, stale since `burst-stops` `all`).
- Screening: `efsim zmdlogs screen <battle id…> [--fetch]` ("Choosing logs" as checks; a hold-out refused unread; an
  account only as a count), missingEnemyFacts in the screen, import, `gamedata enemy` and the check's head ("The
  replay stopped: at t s: …").
- Views that say why: the TAILKEPT `needed` line with the lost hit's pairing before and after the cut; `hits
  --targets` (HitRecord.target.replay, .replays); `statuses --controls` (6339 4.53 s, 7b54 3.40, 29.50 s);
  `replay --trace-trigger … --against-starts <buff>` (8056: Frontiers' two extra firings at the SP cap).
- Measuring: `measure --variant-patch` (two on 0eef in one run), scripts/identity.ts (the data and every log's replay
  record by part at a base and the tree; the hold-outs a count), lint:changed running the fakeReplay tests and the
  typecheck, kitMatch.ts HIT_FACTS_ARE_DATA_FIELDS with a schema-enum test, `efsim zmdlogs which "<question>"`.
- Paperwork: docs/friction/2026-11-28-backlog-after-round-22.md (points 1–2), the reports and round 21's backlog in
  docs/friction-done/ with their outcomes.

**Checked:** `node scripts/identity.ts --base c81a34f` at c3ba762: the data, 65 development logs and 13 hold-outs the
same. `npm run snapshots:update` at a640e94: verified, development, hold-out, earlier pending and several targets
"unchanged", "No log's verdicts moved", no snapshot file or docs/accuracy.md changed; no engine file changed (no
team-ab).

**Decisions:** the hidden holds add to a stop (holdWorld shifts every world clock), so heldWorldMs subtracts them on
top of worldMs rather than as scale-0 stops; the screen reads the detail's own roster (no export fetched) and counts
an account among cached development details only; identity hashes parts of the replay record rather than the
snapshot entry (that is measure's), so a difference names where to look.

**Problems:** a code edit during the first snapshots:update would have failed it (codeKey); stopped and rerun after
the commit. The `--fetch` path is untested against the site (no downloads this round).

## 2026-11-28: Estella and Akekuri logs: four imports, a stage variant's rank, Akekuri's combo SP on its landings

**Goal:** more development logs for the owner's team (Estella, Si, Akekuri, Arcane): the scoreboard had Akekuri in 2
fights and Estella in 5.

**Done:**
- Screened both operators' ZMDLogs profiles (each lists every battle with the operator: Estella 45, Akekuri 75, most
  before game 1.6), 13 exports and 5 details (4 s apart). Usable: Estella's one new 1.6 fight on a stage the data has
  (8f32, Tower 7, on Valiant) and three with Akekuri (1a77 and 8056: one account's Rhodagn rush and boss Si with Si
  P0; f574: Hard 33's slugs). The rest: towers 21 and 24 (not in the pinned data), Minghe (no kit), Akekuri at levels
  1–60, a multi-target rush, or hold-outs. All four on the development list; f574 marked `severalTargets` with the
  slug probe's evidence (as 6339, 7b54). First checks in fixtures/pending/README.md.
- 1a77 / 8056: Akekuri and Wulfgard are level 80; `fit-build` gives both attribute nodes 2 and a level-80 weapon in
  both logs (tied for Akekuri with weapon 72 and a food; the food-free pair fits all four), buildOverrides.
- 8f32's replay stopped at 44.8 s: eny_0082_hsbear_race007 has an attribute template of its own and no display entry,
  so no rank, and Rossi's ultimate freeze asks for it. The loader now takes the EnemyTable templateId's display (39
  enemies; development targets 9, none Elite with a Rossi). 8f32 plain 171 → 395, −56.8 → +2.1%; Estella 60 of 63.
- Akekuri's combo SP as cast triggers 22 and 31 frames after the cast came after both landings where the replay pins
  them early (8056 76.98 s, 1a77 80.35 s, 458b 127.5 / 197.6 s: ×1.262 = Frontiers 1.16 × a Positive Feedback
  layer). The data has each ObtainCostAction in its DamageAction's tick, before it: now the hit's own `sp` with
  spBeforeDamage. 458b plain 1073 → 1093, 8056 +3, 1a77 +3.
- Scoreboard (snapshots:update): development 29 → 32 fights, plain 84.3 → 84.2%, mismatch 4.7 → 4.6%, |damage error|
  1.3%; earlier pending plain 84.4 → 84.6%; several targets 3 → 4 (f574 −26.5%); verified and hold-out unchanged.
  Akekuri 2 → 5 fights (plain 94.6 → 94.2%), Estella 5 → 6 (80.3 → 83.0%, |damage error| 2.5 → 2.2%). team-ab
  against 0f3c894: every team's fight identical (the owner's team's simulated combos had their SP on time).

**Open:** 8056's first Akekuri ultimate shows one of its three SP grants' buffs (her ×0.862 basics at 25–30 s). The
data rules out a target check or a cut; the SP cap fits (the replay at 284 and 300, and its SP runs short), but 22
firings at the replay's cap do show their buffs (458b 227.5 s). In-game test 112 (open-problems "Akekuri: her SP
grants"; scripts/probes/sp/spcap.ts). Tests: 48 not decidable from 8f32 (no skill-type bonus in her build; her
Valiant hits don't get the combo cast's Yinglung's Edge), 71 part 1 agreed by 8f32, 11 still no log.

**Dead ends:** an SP-cap rule for the "recovers SP" event wasn't built: the replay's SP decides too few firings
either way.

## 2026-11-28: Typhoeus's Barrage Array on the world's clock

**Goal:** round 22's open part (docs/journal/2026-11-28-01-needed-on-the-check-s-pairing-a-channel-s-end-in-a-detached.md):
why Typhoeus's Barrage Array runs past its entity's 180 frames (its kit had the data's end left out, dataOverride
`latest`), and why its first tick comes 0.5–0.7 s after the combo's press against the kit's frame 35.

**Found (data and every Typhoeus development log, scratch surveys):**
- The data: chr_0034_typhoea_combo_persistentdamage lasts 180 frames (persistent_time 6 s at every skill level), a
  ChannelingAction every 1/3 s capped at 18 per target: ticks at its frames 0–170. No longer life, no refresh: every
  full array has exactly the cap's 18 ticks.
- Its clock is the world's. Over the 32 arrays of 12 logs, the 18-tick ones span 5.74–9.75 s of log time; with every
  stop the replay applied taken out, her own ultimate's included, and the hidden holds the replay placed, 5.56–6.17 s
  against 5.67 s. Her own ultimate holds it: fc63 90.53→92.87 s, 2.35 s of log time between two ticks, 0.28 s with her
  stop out (her clock isn't held by her own stop). Her own combo's slow-down doesn't (its ignore list spares her
  spawned objects; the array starts after it anyway).
- The first tick lands at the first arrow's ms in all 32 arrays: the entity spawns at the arrow's hit (frame 35), as
  the kit has it. The 0.5–0.7 s from the press is her combo event's usual lag (median 0.52 s over 23 combos; every
  combo's event lags its frame 0 by 0.3–0.7 s, docs/design/data.md "What the log records"), not an early spawn.

**Done:**
- Kit: both combos' `area` hits `world: true`, `launch: 35` (the data's LaunchProjectile at 35, kitMatch agrees); the
  `latest` override gone, so they have the data's end, frame 215.
- Engine: ScheduledHeader.worldFromLaunch (casting.ts for a `world` hit with a `launch`; schedule.ts shiftClock reads
  it): on the caster's clock until the launch, the world's from then. A `world` hit without a launch as before. Zhuang
  Fangyi's Thunder Strikes (world, launch 13) take it too: no verdict moved. drivers.ts' channel-turn rule skips a
  world channel (its lateness already has the stops to come in it).
- Placement (logcasts.ts placeWith `onWorld`): a world channel's elapsed takes out every stop but its operator's own
  non-ultimate ones, and a tick past its end is a new cast's only with a logged press of the cast's kind between, no
  slack bound: the placement has no hidden holds (00ae 24.63 s: 6.79 s with the stops out, 0.68 s of hidden holds
  inside it later).
- tests/world-from-launch.test.ts (engine), tests/channel-ends.test.ts (the six arrays one combo each).

**Measured** (`npm run measure -- --at HEAD --base 0f3c894 --split files`): development, hold-out, earlier pending and
several targets unchanged; verified |damage error| 1.4 → 1.5% (dbae −2.6 → −3.0%, the kit alone). dbae's six unlogged
ticks were at kit frames on her clock, 14.10–15.77 s, beside the logged ticks of those slots' neighbours; held by her
ultimate they come at 16.17–16.83 s, three of them inside the fight's last 0.5 s (TAILKEPT fight-end): an
under-predicted fight loses wrong ticks that offset it. team-ab: the owner's team the same; Typhoeus's team full
+0.00%, zero +0.03% (32 seeds). The scoreboard (snapshots:update): verified |damage error| 1.4 → 1.5%, every other row unchanged; Typhoeus's own one-sided 3.5 → 3.4%.

**Left:** dbae's and 00ae 24.63 s's arrays run 0.4 s past 170 frames with every stop and hold out (00ae's in Perlica's
and Gilberta's combo stops: the combos' known excess hold).
