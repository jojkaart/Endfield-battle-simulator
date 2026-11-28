# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 194 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

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

## 2026-11-27: Target deaths: Laevatain absorbs the dead slug's Heat

**Goal:** on main at 14fe159, beside the tail-cuts agent: the several-targets row's replay-only Heat bursts after
Camille's Vesperwings moves (6339 21.60, 25.57, 33.17 s) and statuses per target; the kits' listeners on a target's
death (docs/open-problems.md "Hard 33's Woodcraft Slugs").

**Found:**
- **Laevatain's passive_enemy** (BuffData abilityEvent 1, HP 0, on every enemy her talent-0 aura reaches): at the
  enemy's death it counts its Heat Infliction layers, absorbs each and gives her as many Melting Flame (no room check,
  no cooldown). Not in the brief's list, found by a census of every abilityEvent 1 handler (scratch/hpzero.ts). Each
  of 6339's three bursts is a move's Heat on a slug the replay's one enemy still held the dead slug's Heat for: the
  kill's absorption takes it, and the 31.62 s kill's gives the fourth Melting Flame the 35.70 s empowered hit needs.
- **The other listeners:** Arcane's spell_vulnerable handler is all disabled (nothing to build), Typhoeus's
  combo_trigger_combo empty; Si's inkhurteffect and normal_skill_check carry her Artful Intent's record onto an ink
  phantom entity (not built); Zhuang Fangyi's, Seraph's, Tangtang's, Yvonne's are in no several-targets fight.

**Done:** engine targetDies takes TargetDeathOptions (`except`: triggers that don't run; `endsStatuses`: the replay's
enemy's statuses and due bursts end), replayEvent an `only` predicate; replay assumption **`target-deaths`** (default
`kills`: a death at every logged kill of a fight read per target, an operator whose death trigger lands a hit, Camille,
running its triggers only where its landing is logged; `moves`, the old; `statuses`); targets.ts targetDeaths,
replaysteps.ts runEventStep, replayrun.ts's death steps (one function, committed alone, its message naming the
tail-cuts agent); kit trigger `death_absorb`; tests/target-deaths.test.ts; the design of statuses per target in
docs/design/data.md (a second replay pass with each landing's target, levels as values, the Stagger per hit).

**Scoreboard** (`npm run snapshots:update`; measure against 14fe159): the several-targets row plain 71.3 → 71.6%,
mismatch 15.3 → 15.2%, mean |damage error| 6.3 → 4.6%, within 5% 1 → 2, replay-only 17.8 → 16.4%, log-only 22.9 →
19.7%; 6339 plain 120 → 121, −6.3 → +0.1%; 7b54 mixed (plain 116 → 117, mismatch 82 → 81, per hit closer, −1.2 →
−2.3%: Si's replay-only 30.50 s burst gone, which had offset its log-only twins). Development, earlier pending and
verified unchanged. **One hold-out worse** (|damage error| 5.8 → 5.9%, totals and battle-skill keys, the same under
every reading): the one unmarked log whose replay makes a death (round 20: a logged Vesperwings move), where the
death now runs the team's death_absorb too. By operator, Laevatain's mean 6.6 → 9.0% (6339's 21.60 s replay-only
hit_2, TAILKEPT, no longer offset by the missing empowered hit), Camille's 9.1 → 5.0%. Team fights unchanged
(team-ab identity at 14fe159: no simulated fight has a death).

**Decisions:** `kills` over `moves` (row 4.2% under `moves`): every death runs the triggers the data puts on the dead
target, not only those where Camille's move happens to be logged; its 7b54 total moves only because a replay-only
burst it removes was offsetting. `statuses` rejected (6339 −5.0%): its 29.26 s Laevatain combo hit needs Combustion
or Corrosion on its slug, which only the one enemy's kept 24.03 s Combustion gives; 9c6e −1 plain. Laevatain's trigger
without an assumption: the data's handler is enabled and unconditional.

**Left:** statuses per target as designed (9c6e's second Wanderer's Nature bursts); 6339's 25.03–28.47 s Combustion
ticks against its 29.26 s combo hit; Si's ink phantom; the DEATH lines list only the moves (decisionsview.ts, the
other agent's file: friction report point 2).

## 2026-11-27: Tail cuts: what the shown-hit guard stands for

Goal: the backlog's accuracy entry "A tail-cut test better than the own-landing pass"
(docs/friction/2026-11-27-backlog-after-round-20.md): replayrun.ts tailCuts' "a logged hit of its operator's casts no
other cast holds" guard passed on the cast's own last landing, logged a fraction of a ms into its frame (143 of the
development logs' 217 TAILKEPT lines, `[shown-own]`); making it exact had cost c4f3 −66 and 9847 −21 plain
(docs/tried/2026-11-27-tail-own-landing.diff).

What the kept tails supplied (cli-ab `--hits-zones` with the exact guard against the tree, then `zmdlogs replay`):
- **c4f3** (all 78 moved hits after 109 s): one cast, Pogranichnik's battle skill at 108.08 s. Its logged hit at 109.01 s
  carries hit_2's value (29,561), the replay's first hit is 23,848; the tail's hit_2 at 109.33 s sets off the Breach
  the log has at 109.01 s, and its Fervent Morale stack and weapon's team ATK, which the 78 later hits read. The other
  three shown-own tails in c4f3 (basic attacks) move nothing.
- **9847** (22 hits, 78–114 s): Liino's battle skill at 75.44 s. Its volley timer opens at the cast's frame 45 (76.94 s),
  after its last logged projectile (75.83 s); cut there, the volleys the log has from 78.36 s and every 10–12 s after
  never come. Not a landing of the cast: the timer is a frame action, the volleys a kit buff's hits.
- Nothing later needed the rest: of the 143, 106 are cut now (TAILCUT 152 → 244 over 61 logs), most of them basic
  attacks' last hits; the rest are kept by another guard or left by the round limit.

Done (e7d8e08, c542358):
- The cast's own logged landings are no evidence. In their place: `landed` (a logged hit no cast holds with a tail
  landing's event within 16 frames: the free match's reach), `status` (a logged status hit of its operator whose
  nearest status landing of its kind the tail set off: c4f3's Breach; d572's Mi Fu battle skill Crushes at 125.40 and
  144.84 s),
  `shown-free` (as before, without the own pass), `effect` (as before) and `needed`: replayrun.ts cutTails (the loop,
  moved out of buffreplay.ts replayKitBuffs) undoes a cut whose replay loses a logged hit's landing (loggedShown) and
  keeps the tail. `needed` caught 9847's volleys and 7b54's Laevatain attack 5 at 46.47 s, whose hit_2 breaks the
  Stagger and so times Arcane's lasers (the log's at 47.62 s).
- `fight-end` at 0.5 s (TAIL_END_MS; was TAIL_NEAR_MS, 1.5 s): the kill drops only what comes after it. 0eef's Liino
  combo hit2 at 8.80 s (the team's hits logged to 10.03 s) and 79cc's Ardelia attack3 projectiles at 54.47 s (to
  55.95 s) are cut; measured as a variant, no other log's damage moved.
- TAILKEPT `rounds`: casts the 8-round limit leaves uncut, which were silent before (45 casts in 10 logs; d4fb 11,
  d572 9, 458b 7).

Measured after merging main at fa2c2ad (the target-deaths round; `npm run measure -- --base fa2c2ad`) and the
scoreboard (`npm run snapshots:update`): development plain 84.3% (unchanged; the exact guard alone was 83.7%), mean
|damage error| 1.3 → 1.2% (15 better, 4 worse); verified 1.6 → 1.5% (0eef 2.3 → 1.3%, 4e5e −3.0 → −3.3%); earlier
pending plain 84.4% (abfd 414 → 412), 1.2% (6 better, 3 worse); several targets plain 71.6 → 72.1% (7b54 117 → 121,
−2.3 → −1.0%), |damage error| 4.6 → 7.6% (6339 +0.1 → −10.4%); hold-out plain 82.5%, |damage error| 5.9 → 5.9% (4
better, 4 worse, the worse ones in basic attacks' totals). Against 14fe159 the same but for several targets (6.3 →
9.4%, 6339 −6.3 → −16.8%) and the hold-outs (5.8 → 5.9%). Replay-only share: development 1.1 → 0.9%, hold-outs 2.4 →
2.3%, several targets 16.4 → 13.1%; by operator Liino 8.5 → 5.6% (0eef no longer her largest), Laevatain 9.0 → 6.5%.
A test fixed: tests/logcasts.test.ts's
b7b3 `absent` case (Last Rite's third slash is now cut, as the fixture's note reads it; the `absent` path is tested
under `unlogged-tails` `kept`).

Decisions and why:
- Worse logs are under-predicted fights whose unlogged tails had cancelled part of it: 6339's Laevatain finisher hit_2
  at 21.60 s (105,356, 10.2% of the fight, no log line; at fa2c2ad it offset the log-only rest to +0.1%, its first
  hit the slug's kill at 20.37 s, Camille's Vesperwings moving at 20.60 s), db87's Laevatain ult_attack2 at 38.57 s (38,477), 4e5e's,
  a9d7's, de6a's and d774's basic tails; the same shape as `cut-all`'s adoption (docs/design/assumptions.md). abfd −2:
  two logged Si attack-4 hits at 64.10 s, pinned to an attack 4 her next one cut at 64.07 s, had matched the later
  cast's tail 0.33–0.43 s on; the cut is right, the interrupted cast is the open part (open-problems).
- The counterfactual check rather than more static guards: a tail's effects reach the log by many paths (a frame
  action's timer, a status, a Stagger break, SP), and the replay already makes the cut run; a rejected cut costs one
  round. 16 rounds instead of 8 measured worse (development 1.2 → 1.3%, no plain change, 135 against 115 s): kept 8.
- loggedShown pairs no landing once only (looser than buffreplay.ts's free match); kept so, as it errs towards cutting
  only where the log has nothing near (the friction report's point 1 for a shared pairing).

Still open: a tail whose effect shows only in later hits' values (a kit stack, a buff the log doesn't list);
several independent tails per replay (the round limit's 45 casts); abfd's interrupted attack 4.

## 2026-11-27: Friction round 20: guards that say what they cite, tried diffs by function, the build screen by the check's tolerance

Goal: improvement round 20 over seven reports and round 19's backlog (summary:
docs/friction-done/2026-11-27-round-20.md; what's left: docs/friction/2026-11-27-backlog-after-round-20.md).

Done: TAILKEPT names its guard and whether the hit it cites is the cast's own landing (`[shown-own]`, logged a few ms
into its frame), `zmdlogs decisions` counts the lines by guard; scripts/tried.ts (`--touching <file>[:<function>]`,
`index`, `new` refusing an existing name) with a test over docs/tried/; the build-offset screen at 0.3% and 2 damage
on the median hit (the check's ±1), `offsets --bound` (the factor interval), fit-build's weapon skill levels and
potentials as scored singles, `hits --json` landing.base (a DEF base's parts) and listedSinces; the by-operator
table's Largest and Own matched / one-sided (two describing `share own … operator` keys); measure's plain tree first
under `--variant`, `--several-targets`; engine replayEvent with one pin rule (pinLanding) and TimelineContext.replayed for the record-only fields;
NOLAND's kit-gap and trigger-group details, the twin's rule on LAND, LogBuffReplay.placement, a defaulted read's
caller; `verify-at --snapshot`, smoke fixing its code at queue time; `carry --unpark`, the same-listing VALUE flag,
`cli-ab --hits-zones`.

Decisions: the tail guard's behaviour stays (an exact guard moved 24 logs, docs/tried/2026-11-27-tail-own-landing.diff):
a test of what it stands for is on the accuracy list, beside a shielded target's landing. A DEF base's parts are
computed in hitexport.ts from the landing's inputs and the replay's state, not recorded by the engine. The
offset screen's lower threshold flagged no new development row (Ember's and Alesh's are fitted), so no
OFFSETS_EXPLAINED entry. Two parked points came back with `--unpark` (round 6's smoke-and-snapshots, round 8's
layers): smoke's half is done, snapshots' and the layers views are the backlog's points 2 and 3. The moved hold-outs'
replayed casts by kind and shift, built for the break-placement report, were removed at the lead's word: a split of
the hold-outs' change by mechanism class (hashed names or not) is what blindness forbids; the backlog's new Declined
section keeps it from being rebuilt, and docs/design/tests.md "What a hold-out output may say" names it. For the same
reason the two `share own … operator` keys are left out of the hold-out snapshot (accuracy.ts isHoldoutOmittedKey).

Checks: `npm run snapshots:update`: no log's verdicts moved, every group unchanged, keys added only (`share own matched
operator <id>`, `share own one-sided operator <id>`); team-ab identical at the engine change (7be8b2d).

## 2026-11-27: Liino's damage error and her weapon's Medicant layers

**Goal:** Liino has the largest by-operator mean |damage error| (8.5% over 19 fights, median 3.1%): which of her
hits carry it; and her weapon's Medicant layers (buff_wpn_lance_0014_damageup) listed up to ×9 on one teammate
against the kit's 4 (in-game test 25).

**Found:**
- **Her error is all one-sided.** Her matched landings are within ±0.5% in every fight; every fight's error is
  replay-only landings (`zmdlogs totals --all --json`, her parts as % of her own total): 0eef's combo hit2 tail
  (+57.8% of a 0.9% share: 3.0 points of the mean alone), her stance pressed before the fight's first logged hit
  (1cd1 +8.2 points, c6d8 +6.5, 9c6e +5.7, 9847 +2.7), and Cosmovoice beats, finales and volleys the log never shows
  (1cd1, 1d91, af7b +15–18 points each). Every Cosmovoice logs its Pyrotechnics and bomb, but 0–10 of its 10 beats
  and its finale in 5 of 24; the beats are projectiles launched from Liino (her reach; by controlled operator 67% of
  beats land, Typhoeus controlled 13 of 30): positions, which no log records. docs/open-problems.md "Liino's own
  damage error".
- **Medicant: 4 per teammate, by value, at every listed count.** 6,500 teammates' hits in 19 logs: the value reads
  min(entries, 4) (entries 5–13: 3,097 of 3,434 imply exactly 4); the listing also under-counts (9847's Avywenna at
  57.64–64.75 s: 2, 3, 4 layers where 0, 2, 3 are listed, the ×1.033 of the last round). No kit change.
- **Overheals count (test 25 decided).** Liino's stance heals before a fight's first logged hit, when nobody has
  been hit, give layers the damage carries (1cd1: three on Typhoeus by 11.95 s, by value; 9c6e, 9847, c6d8, 8318,
  4bfe). The teammates a heal misses there (1cd1's Ardelia, 9847's Gilberta, c6d8's Arcane) miss it at full HP too:
  the soundwave's reach, which also explains 1d91's Arcane and Ardelia.

**Held back / tried (log-check files of the parallel several-targets agent):**
docs/tried/2026-11-27-opening-away.diff (the opening as an away stretch for the totals and the replay's enemy:
hold-outs unchanged, 9c0b better, 1cd1, 9847, db87 0.1–0.4 points worse where the opening's landings covered a low
matched part; Liino 8.5 → 8.1% with a 6 s floor; for the lead) and, found again after the several-targets round
had tried it, docs/tried/2026-11-27-tail-own-landing.diff (tailCuts' shown-hit guard takes a cast's own last
landing for another hit; with a 0.5 s end guard as well: 0eef right, Liino 8.5 → 5.5%, but 15 better / 5 worse,
c4f3 plain 468 → 402, hold-out |damage error| 5.8 → 5.9%: dropped; its header has the round's numbers).

**Scoreboard:** unchanged (docs only: no kit or engine change; no snapshot moved). Team numbers unchanged (no
simulated fight changed; team-ab not run).

**Decisions:** no "drop the unlogged beats" reading: it would fit the log by construction; the reach is an input,
and for simulations an expected beat share (about 0.7) is the honest model, left for the planning side. Test 25
marked decided on the premise that a stage fight starts at full HP.

**Probes:** scripts/probes/kits/liino-medicant-layers.ts, liino-opening-layers.ts, liino-cosmovoice-beats.ts.
