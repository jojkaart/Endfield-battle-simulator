# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 198 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

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

## 2026-11-28: The check's targets are the replay's, and a freeze's run-on on every target

**Goal:** the backlog after round 21's accuracy list, its first and last items: the second assignment of a fight
read per target numbered its targets afresh, so enginecheck.ts atItsTarget read a candidate `t` at the replay's
target `t`, another slug (7b54: 147 of 210 hits with both off their landing's targets); and a freeze's ramp and
statuses run-on (clock.ts rampRunsOn, statusesRunOn) read the current target only.

**Done:**
- targets.ts assignTargets takes AssignOptions (`fixed`, `ids`); with ids `landings` a new target takes the id of a
  target its first hit's landing reached in the replay that no target has yet (each a candidate, the first that
  fits), else an id no landing names. enginecheck.ts SECOND_PASS_TARGETS `mapped` (the default; `free` the old
  numbering). 7b54: 147 → 55 hits off their landing; 6339 and 9c6e unchanged (0 and 1).
- The 55 left are hits the two assignments put on other slugs: at 16.36 s the first assignment had both of
  Laevatain's attack 2 hits (1462, 1701) on one slug, neither fitting in the one-enemy replay; in the second replay
  1701 fits only with Vesperwings and Arcane's will_susc on, which that slug was read without, so it went to a slug
  of its own, and the 19.59 s kill and Si's 20.21 s attacks followed. logcheck.ts TARGET_REPLAYS (at most three):
  the replay is made again on the check's assignment while it puts a hit on another target than the replay was made
  on. 7b54's third replay gives the same assignment back: 0 of 210 off. 6339 and 9c6e stop at two.
- clock.ts rampRunsOn and statusesRunOn run on every target the freeze held (eachTarget), a target it didn't hold
  unchanged; synthetic tests in tests/target-statuses.test.ts; clock.ts left tests/enemy-readers.test.ts's list.
  The backlog's "no fight read per target has a freeze yet" was wrong: Si's Immobilization freezes the slugs (not
  control-immune) at 6339 4.53 s and 7b54 3.40 and 29.50 s, each a single-target landing with no status on any
  target then, so it reads nothing.

**Measured:** the full measure against 60fa436 at each step: no log's verdicts moved, hold-outs unchanged. The
scoreboard (docs/accuracy.md): the several-targets row's mean |damage error| 10.4 → 10.0%, replay-only 12.1 →
11.7%, plain 75.6% and mismatch 11.2% unchanged; every other row unchanged. 7b54 4.0 → 2.8%: the third replay's
landings on their slugs leave out a replay-only Heat burst at 46.70 s (Arcane's, 12,851), so Arcane's own 7b54
total goes −4.1 → −22.3% (her five log-only hits, 14,502, no longer offset): her row's mean |damage error| 3.0 →
3.4%, own one-sided 5.3 → 4.8%. Why no verdict moved: 7b54's only reaction
status is Combustion (a dot), so no hit reads a Corrosion, Electrification or Breach level and the ids decided
nothing in its values; the slugs' kit buffs are decided by the assignment itself, not by id. team-ab: every team's
fight the same.

**Left:** a freeze on a twin's other target holds the first target's clock (landing.ts runs the other target's
control event after the first is current again); no such freeze in a log yet (docs/open-problems.md "statuses per
target").

## 2026-11-28: needed on the check's pairing, a channel's end in a detached file

Goal: two entries of the accuracy list in docs/friction/2026-11-27-backlog-after-round-21.md: cutTails' `needed` on
the replay's own pairing, and a capped channel inside a detached file (both left by round 21 as moving verdicts).

Done (9da9d4a, 592f7c7):
- **`needed` on the check's pairing** (replayrun.ts loggedShown, cutTails): a kit hit's landing is now
  landingpairs.ts pairKitLandings' (pinned, else a landing of its operator with its event within 16 frames, each once);
  the statuses' half stays loggedShown's own. Alone that kept tails it shouldn't: a logged hit before the cut that the
  pairing had given one of the tail's unlogged landings counted as lost (c83c 47.17 s: eight batched Arcane attack-4
  hits, four the placement's twins, paired with the 47.23 s cast's landings at 47.50 / 47.60 s; 4a64 16.93 s, 9847
  44.53 s): hold-out |damage error| 5.9 → 6.8%, 4a64 +2 plain. So only a logged hit after the cut counts: the tail's
  landings and what they set off come after it. With both, and with the filter alone on the old rule, no log's
  verdicts or totals move. abfd's 64.10 s case is gone since round 21's channel end.
- **A channel in a detached file gets its end** (skillCompile.ts drops `!detached`): Tangtang's ultimate stare to
  frame 196 (b7b3 and 7910 have no tick past it once the stops between are out: b7b3's 15.28 s tick sits after Last
  Rite's 12.30–15.13 s ultimate stop), Rossi's wolves, Zhuang Fangyi's attack-5 and ultimate attack-3 ranges (single
  landings: nothing reads their end). Typhoeus's Barrage Array (frame 215) is marked in her kit, `dataOverride`
  `latest`, now a DataField (kitMatch.ts compares the kit hit's latestFrame with the data, schema enum too): the logs
  have its 18 ticks up to 6.4–8.0 s of world time after the first with no combo press between, and the end split one
  array into two combos six times (00ae, fc63; unmarked: 00ae 1.1 → 3.9%, fc63 3.2 → 5.9%, hold-out plain −6,
  docs/tried/2026-11-28-barrage-array-channel-end.diff). With the mark nothing moves.

Checks: measure against 60fa436 for each change (no verdict or total moved anywhere: development plain 84.3%,
|damage error| 1.3%; hold-out 82.5%, 5.9%; earlier pending and several targets unchanged); `npm run smoke` passed;
team-ab identical for both teams (the owner's and Typhoeus's: every hit and a rules seed the same, the 32-seed
numbers unchanged); snapshots:update for the kit digests (Tangtang, Rossi, Zhuang Fangyi).

Decisions: the channel's end per kit hit, not per file kind: the data's end where the logs agree, a reasoned mark where
they don't, as any other data field. The after-cut filter is not a fit: a hit logged before the cut can't be what a
later landing set off.

Still open: what runs Typhoeus's array past its entity's 180 frames (its entity held by stops the placement's world
time leaves in, or a longer life; its first tick also 0.5–0.7 s after the press against the kit's 1.17 s).

## 2026-11-27: Friction round 21: one home for the pairing and keepPrevious, counterfactual replays, measure's split by what it measured

Goal: improvement round 21 over five reports and round 20's backlog (summary:
docs/friction-done/2026-11-27-round-21.md; what's left: docs/friction/2026-11-27-backlog-after-round-21.md).

Done: landingpairs.ts pairKitLandings (the replay's kit-landing pairing, moved out of replayKitBuffs); one keepPrevious
rule (castassembly.ts keptPrevious / isPreviousCast) with ReplayedCast.keepPreviousWhy and a CUTS line that says the
hits are kept; ReplayOptions.cutCasts and counterfactual.ts: `zmdlogs decisions --why-kept <fixture>`; HitRecord
.target.landing and `≠ landing`; measure's code errors as "not measured alone", refs pinned at queue time, a
cross-hunk name warned at queue time; tests/enemy-readers.test.ts; `gamedata handlers`, `find`'s disabled parent;
skillCompile.ts Ctx.channel; placementwords.ts; `statuses --inflictions`; `hits --layers <owner:id>`; `tried.ts
refresh`; snapshots:update refusing a tree edited since queued; MISSED `rounds`; lint:changed's registry tests;
friction.ts withoutNumbers; edit.ts's unclosed `end` block.

Decisions: every change behaviour-preserving. cutTails' `needed` stays on loggedShown (pairKitLandings there moves abfd:
the accuracy list). The compiler's channel token keeps the old `!detached` filter: without it 9 kit hits of channels in
a buff's or entity's own file would gain an end (the accuracy list). The check's target ids: 6339 agree with the
landings', 9c6e but one, 7b54 147 of 210 differ (SECOND_PASS_TARGETS `free` numbers afresh): a view and a test now,
the fix on the accuracy list. `hits --against` already answered the statuses-per-target report's point 3 (the
round added the target to its lines). The statuses view and the DEATH lines from the replay's record came with the
statuses-per-target round; this round added the inflictions. Round 20's backlog point 1 (clocks around a non-cast
hold) parked, carried twice without a new report.

Checks: `npm run snapshots:update` at 95a4f66: every group "unchanged", "No log's verdicts moved", no key added;
the compiled game data's sha1 the same at HEAD and after the compiler move (no engine number can move: team-ab not
needed); every development log's keepPrevious flags the same under the one rule (10458 casts); cli-ab identical on
the views touched.

## 2026-11-27: Casts their operator's next press interrupts: a channel's end

Goal: the tail-cut round's open part (docs/journal/2026-11-27-19-tail-cuts-what-the-shown-hit-guard-stands-for.md):
abfd 64.10 s, two logged Si attack-4 hits cut with an attack 4 her next one interrupted at 64.07 s; more generally,
logged hits that land after their operator's next cast started.

Survey (a scratch pass over every development and multi-target log's placement, then every replay's NOLAND lines):
of the logged hits placed into a cast after another of their operator's casts started, nearly all are as they should
be (detached hits, combos beside, a chain step's hit at its own frame that the next step's placed start precedes:
keepPrevious keeps them). The replay cut a logged landing with the next cast in 10 places in 6 logs: abfd 64.10 s
(the channel below), fc63 94.79 s and c779 70.73 s (a hitless event cast between, below), and three multi-target
logs (69e7, 7b4e, b74c: Si's batched several-target hits, not followed).

Found and done:
- **A channel's end.** Si's attack 4 is a ChannelingAction from frame 5 to 40, at most 6 ticks per target 0.1 s apart
  (the kit's frames 5–20 are the earliest; an enemy in reach late takes them up to frame 40), and its skill lasts
  552 frames, so the placement's "slots to come within the skill's action" joined ticks 1.8 s late: abfd's six ticks
  at 63.77–64.35 s (the cap's six) took the 61.79 s cast's four slots left and made a second cast the replay then cut.
  The kit compiler now records a capped channel's end on its ticks (CompiledLanding.latest → KitHit.latestFrame, not on
  what a tick's buff deals later: Rossi's combo afterhits); placeWith joins no tick of one channel past it
  (`pastChannel`: by CHANNEL_SLACK_MS 400 ms, or by ON_TIME_MS with a press of the operator's between; not across an
  ultimate's event, whose stop the pass doesn't have yet: c83c 92.48 s). abfd 63.77 s and c3c7 33.64 s (past by
  0.63 s) and 60.64 s (0.17 s, a battle press between) are new casts; Liino's attack 2 (9090 93.91 s) and Arclight's
  attack 4 (4bfc 52.23 s), 0.21–0.23 s past with no press, stay. LoggedCast.pastChannel records it; its casts-view
  line is held back (docs/tried/2026-11-27-channel-decision-line.diff: views.ts was the statuses agent's file).
- **A channel's ticks in turn** (drivers.ts replayCast): an unpinned tick after a pinned late one comes as late, and
  none past the channel's end. c3c7 32.33 s: the 6th tick sat at its kit frame beside the 5th, pinned 3 frames late,
  so the tail cut didn't take it for a tail; 7910's Tangtang shots past their channel are gone.
- **The previous cast past a hitless one** (castassembly.ts ordered): keepPrevious compared each cast with the one
  just before it, a cast made from a log event alone too (a press that did nothing, a kit buff's tick the replay
  skips), so the cast before that lost its later logged hits: fc63 94.79 s (Arcane's combo event, an Imprisonment
  tick), c779 70.73 s.

Measured (`npm run measure -- --at HEAD --base 5b08218 --split hunks`) and the scoreboard (`npm run
snapshots:update`): development plain 84.3%, |damage error| 1.2 → 1.3% (7910 −0.8 → −1.2%, c779 0.8 → 0.9%, +1
plain); verified 1.5 → 1.4% (0eef 1.3 → 1.1%); earlier pending plain 84.4%, 1.2% (abfd 412 → 414 plain, 2.2 → 2.1%;
4e36 better; c3c7 2.1 → 2.2%); several targets unchanged; hold-out unchanged (one log's totals moved, no verdict).
Worse, explained: 7910 is under-predicted and the replay-only Tangtang shots that offset part of it were past their
channel; c3c7's three new attack-4 tail cuts use up the tail cut's 8 rounds, so its 101.77 s attack 1 tail stays
(TAILKEPT `rounds`, the known limit); c779's newly landed hit is matched, its total over by 0.1 point more.

Dead ends: the first version marked every landing a channel's tick body made, a buff's later ticks too (Rossi's
afterhits got frame 25 as their end: 9a80 280 → 206 plain, 0c14 −54) and applied the bound to a skill's separate
one-tick channels (Laevatain's normal_skill_during_ult: db87 236 → 199); a slack of 150 ms split Liino's and
Arclight's channels, and a 400 ms one alone split c3c7's five ticks at their fourth (a cascade into the next cast).

Still open: the multi-target cut landings; the CUTS record still flags an interrupt whose hits keepPrevious keeps
(c779 70.67 s; replayrun.ts castFlag, the other agent's file); 4a64 16.93 s (Arcane's batched attack 4s, a value
question, not this shape); the tail cut's round limit.

## 2026-11-27: Statuses per target: a second replay with each landing on its target

**Goal:** on main at 5b08218, beside the interrupted-casts agent: build the design of docs/design/data.md "Statuses
per target" for the several-targets row (6339, 7b54, 9c6e), checking the log's `poise.bar` per target before the
Stagger part; the DEATH lines from the replay's own record and a view of its status record per target (the
target-statuses friction report, points 2 and 1).

**Done:**
- **Engine (replay only):** TimelineScenario.landingTargets and TimelineState.targets (timeline/targets.ts): the
  enemy's statuses per target, `enemy` the current one's. A landing lands on its first target (by ref, else operator,
  event and frame ±1; none: the target hit last) and applies what it inflicts on its other targets too; a burst and a
  status tick run on their own target; the world's holds and stops shift every target's statuses (clock.ts shiftEnemy;
  a freeze the current one's); targetDies `target` runs the death's triggers on that target's statuses, then ends
  them. Records: LandedHit.target / otherTargets, ReactionRecord.target, PendingBurst.target (search KeyRules).
- **Logs:** replay assumption **target-statuses** (`one`; `per-target`, the default): logcheck.ts logBuffReplay makes
  the replay again from the first one's assignment (enginecheck.ts replayTargets: each landing's targets, each kill's
  target; targets.ts targetDeaths one death per killed target); the check reads a hit at its target's Corrosion /
  Electrification / Breach levels (atItsTarget), the second assignment each candidate at its own statuses (statuses
  values there, not units). holdinputs.ts statusInstances and replayrecord.ts's status traces read every target
  (engine everyTarget): 9c6e's Corrosion on a swapped-out target had missed its hidden holds (plain 302 → 310).
- **Views:** BuffReplay.deaths (buffreplay.ts, committed alone for the placement agent); DEATH lines from it, every
  death with its target and the triggers not run (decisionsview.ts deathDecisions); `efsim zmdlogs statuses <fixture>
  [--target n]` (views.ts statusesView): each burst, reaction, consumption and tick with its target, its damage and
  the target's statuses after it, the deaths between. tests/target-statuses.test.ts.

**Found (the Stagger, checked, not built):** the logged bar is its hit's target's: a slug's first logged hit reads its
full bar (60) less its Stagger and its later hits count down (6339 14.80–19.91 s, 7b54 29.50–31.05 and 33.46–36.84 s),
which one bar can't give; the twins at one ms carry one bar between them (9c6e 52.49 s: 73 / 83 on both targets, one
target's 103 − 20 − 10). With 2 Staggered replay landings in the three fights (the log's 1), a bar per target would
move a hit's damage and 7b54's 46.47 s break at most: left (counts: 9c6e 32 of 53 poise hits consistent per target,
26 with one bar; 6339 8 / 9 and 7b54 7 / 7, the target changes falling on fresh slugs).

**Scoreboard** (`npm run snapshots:update`): the several-targets row plain 72.1 → 75.6%, mismatch 14.5 → 11.2%, mean
|damage error| 7.6 → 10.4%, replay-only 13.13 → 12.10%, log-only 19.53 → 17.40%; 7b54 plain 121 → 151 (mismatch 76 →
46), −1.0 → +4.0%; 6339 plain 121 → 122, −10.4 → −16.1%; 9c6e plain 314 → 310, −11.3 → −11.0%. Verified,
development, earlier pending and the hold-outs unchanged (no other log reads it).

**Decisions:** `per-target` the default though the row's mean |damage error| rises: both one-sided shares fall, and
each moved part goes the log's way: 6339's 25.03–28.47 s Combustion ticks were a dead slug's (−3.3 points of
replay-only), 7b54's 16.36 s Si combo twins now fit their slugs (−7.3 points of log-only), Laevatain's Melting Flame in
7b54 comes from each slug's own Heat (her 16–31 and 39–44 s hits match); what they had offset is left uncovered (6339's
Si ink at 19.91 s, 7b54's shielded slugs' replay-only landings), the shape of the tail cuts' adoption. One loss:
6339's 29.26 s Laevatain combo hit (−1.9 points), whose `if` needs Combustion or Corrosion on its slug, which only a
landing the log doesn't show can have given. The second assignment holding each hit to its first-pass target
(enginecheck.ts SECOND_PASS_TARGETS `fixed`, kept for `--set`) measured worse (7b54 plain 151 → 142).

**Left:** a target's statuses from landings the log doesn't show (6339's 29.26 s combo; 9c6e 74.47 s Liino's ultimate
on T6 without the log's Electrification); 7b54's 36.08–36.84 s Laevatain battle skill (×1.2–1.3 high, Scorching Heart
from 31.03 s); 9c6e's 52.80 s Typhoeus burst, whose two targets' values no status gives; the Stagger per target.
