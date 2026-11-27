# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 184 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-27: Camille's Vesperwings moving to the next target

**Goal:** on main at e4a1e36, beside the Liino agent: Camille's `normal_skill_abilityrange` hits (6339 ×5, 7b54 ×1),
never placed: her Vesperwings moving to the next slug when its own dies (docs/open-problems.md "Hard 33's Woodcraft
Slugs"; docs/tried/2026-11-27-sub-skill-events.diff).

**The data:** abilityrange_first (and abilityrange) put buff_chr_0033_camille_normal_skill_listen_target_dead on the
target; at its death (abilityEvent 1) reset_target (0.1 s) finds the next target, launches projhit_sub
(skillSpecification 3, castSkillOnHit), which casts abilityrange on it: frame 0 the debuff (with the bat_duration
icon's time left: SaveBuffLifeTime), Heat infliction, the battle skill's atk_scale and poise; no team energy.

**Done:**
- **Engine:** trigger event `targetDeath` (events.ts), made only by `targetDies` (drivers.ts), which the replay calls;
  its `landings` pin the triggers' hits at logged frames as replayCast's do. BuffApplication `keepEnd` (a new instance
  ending where the active one does). Trigger action `castEvent` (a cast event of a skill an entity casts, no action).
- **Kit:** trigger `vesperwings_move` (frame 3 on the world's clock, the travel not in the data), and
  `vesperwings_move_cast` behind the new kit assumption `vesperwings-move-cast` (`battle`, default; `none`).
- **Replay:** targets.ts `deathMoves` (each logged landing of a targetDeath trigger's hit; the death at the logged
  kill within MOVE_AFTER_KILL_MS before it, else the lead before the landing) and `moveEvent` (a cast event at a
  move's ms, key the skill's id with a suffix, is no press: castassembly.ts assembleCasts, loggedCastFates `move`);
  replaysteps.ts / replayrun.ts death steps; `zmdlogs replay` / decisions DEATH lines. tests/vesperwings-move.test.ts.

**Decisions:** the death at the logged kill, not at the landing less the lead: 6339's 29.26 s kill purges her
Susceptibility from the listing (`logged-purges`) before the 29.67 s move, so a death at the landing found no debuff
and made nothing. The cast event: the plain move made 6339 mixed (plain 115 → 109): Si's 28.39–29.57 s combo slashes
need 3 Yinglung's Edge layers and the replay had 2 once the presses standing in for the moves were gone; the move as
a battle-skill cast (projhit_sub is one; ZMDLogs logs a normal_skill event at four of six) gives the third. Registered
as a reading: the data doesn't say whether ability event 30's CheckSkillType sees an entity's cast.

**Numbers** (measure against e4a1e36; snapshots:update for the scoreboard): only the several-targets row moves: plain
70.6 → 71.3%, mismatch 15.3%, mean |damage error| 8.3 → 6.3%; 6339 plain 115 → 120, −10.3 → −6.3%; 7b54 plain
115 → 116, −3.3 → −1.2%. Development, earlier pending, verified unchanged; hold-outs' aggregates unchanged (one
hold-out has a logged move: 2 hits uncovered → fallback, DEATH +2, SKIP −2). Team fights unchanged (team-ab identity:
no simulated fight has a death; the one enemy never dies).

**Checked:** every Camille log: only 6339 and 7b54 have the move's key (the multi-target fixtures none, the others no
mid-fight kill). **Left open:** 6339's 19.68 s move follows no logged kill; 7b54's 19.90 s normal_skill event, 0.31 s
after a kill with no hit, a likely move onto a shielded slug (not made); 6339's Laevatain 35.70 s empowered hit is not
the move's Heat alone (nothing of hers absorbs it in time); the moves' Heat on the replay's one enemy gives replay-only
bursts (statuses per target); other kits' listeners on a target's death (open-problems).

## 2026-11-27: Twins on several targets

**Goal:** on main at de528c7 (merged with 22750d2), beside the build-fit agent: the placement's same-ms twins in the
several-targets fights (7b54's Si combos: 2 slashes × 4 slugs at 15.60 s took eight of the ten slash slots, a second
combo opened for the rest), then which of 6339's, 7b54's and 9c6e's one-sided landings are placement errors.

**Done:**
- **logcasts.ts placeWith** (fights read per target only): where value can't tell a twin from the next slot (the
  slots' multipliers alike, `nextDiffers` false), a batch of the key's alike hits at one ms is `targets` hits per
  landing (targets.ts `batchTargets`: the least k with hit i and i + k of one target by value for every i,
  `oneTargetByValue`: one value, or a crit the panel's crit factor above; a batch two landings long, else the count an
  earlier batch of the cast read); a slot's multipliers over event counts tell a twin by value too (Si's final); a
  used-up combo's landing within 150 ms of its last, of its value, no cast event between, is its last landing on
  another target (`later`: 7b54 16.48 s, a third slug's final). Combos only for `later`: on every kind it took
  Typhoeus's shots, Ardelia's attack 3 and Liino's beats in 9c6e for twins; the batch rule on landing-long batches
  made 9c6e's Ardelia 224 / 259 (a debuff between) twins: both lost plain hits (314 → 312, mismatch 33 → 44), now no
  9c6e cast moves. targets.ts's assignment reads the twins as before (one landing reaches each target once).
- **Decision lines:** PlacedHit.twin (`value`, `used`, `batch` with its targets and batch size, `later`);
  `zmdlogs casts --choices` prints it on each twin's HIT line, `casts --json` carries it.
- **`zmdlogs hits --json` `target`** (index, how, drop, kills; text lines `T<n>`): the several-targets friction
  report's point 2.
- several-targets reading **`targets-ungated`** (every twin copied in the totals, fitting or not): registered and
  measured, not the default (docs/design/assumptions.md).
- tests/target-twins.test.ts.

**Scoreboard** (`npm run snapshots:update`; measure against 22750d2): only the several-targets row moves: plain
68.5 → 70.6%, mismatch 15.4 → 15.3%, mean |damage error| 16.1 → 8.3%; 7b54 plain 99 → 115, +26.8 → −3.3%; 6339 and
9c6e unchanged. Development, earlier pending, verified and hold-outs unchanged (no unmarked log reads it); no
simulation reads it: no team-ab.

**Found, not placement errors** (docs/open-problems.md "Hard 33's Woodcraft Slugs"):
- Camille's `normal_skill_abilityrange` (6339 ×5, 7b54 ×1): her Vesperwings moving to the next target at its own
  target's death (listen_target_dead → reset_target → projhit_sub), the battle skill's damage, Heat and
  Susceptibility again; five of six 0.23–0.54 s after a logged kill. ZMDLogs logs a normal_skill event at four of them,
  which the replay makes as presses, standing in for the move. Reading those events as no press: 6339 plain 115 →
  103, −10.3 → −15.2% (docs/tried/2026-11-27-sub-skill-events.diff). Needs a kit hit (packages/data) and a pressless
  replay landing.
- 6339's 35.70 s Laevatain empowered hit: her Melting Flame a stack short at 32.24 s (likely the move's Heat).
- 6339's 21.60 s hit_2: TAILKEPT's guard passes the cast's own killing hit by rounding (logged 0.3 ms after its
  frame); the exact guard: development plain 84.3 → 83.7% (c4f3 −66), hold-out |damage error| 5.8 → 5.9%
  (docs/tried/2026-11-27-tail-own-landing.diff).
- 6339's 19.91 s Si ink burst: her presses before it are on shielded slugs (no hit, no listing), so the Final Stroke
  is skipped; what a shielded-slug state would need is in open-problems.
- 7b54's 47.2–48.1 s twins log-only: every slug's slash reads ×1.26 high (a kit-buff difference, mismatched before
  too). 9c6e's: statuses per target.

**Dead ends:** a time-based twin count (slots due by the batch's ms): the first batch's slashes come before the kit
frames allow from the event (the stop batches them), so time can't count slots there.

## 2026-11-27: Ember, Alesh and Catcher's mismatches: two build fits and DEF's percentage

**Goal:** the operators whose hits mostly mismatch (by operator, every log but the hold-outs): Ember 80.2%, Snowshine
88.8%, then Alesh 20.1%, Avywenna 19.9%, Catcher 13.9%. Is each one factor on most hits (a build input), one skill
(a kit error), or a buff the log lists that the replay lacks?

**Found and fixed:**
- **Ember (04d4) ×1.0226 on every kit hit**, under the offset screen's 3%: Exemplar's skill 1 at level 9 for the
  exported 8 (Strength 112 → 132), the one single change of fit-build's 124 (`--pairs`); fixture buildOverrides.
  04d4's Ember 310 → 9 mismatches. Her other three logs were already fitted (2fd9, 99fb) or plain (7e19).
- **Alesh (4e36) ×0.9745**, also under 3%: attribute nodes 2 (node 5's favorability 300, as Si's in 0c14 and
  Perlica's in fc63), 13 of 13 clean; his weapon's skill 3 at 2, the other single change, is ruled out by the log's
  Thermite Cutter 0.08 a layer. Hard 15's "per-operator factors" (Akekuri, Alesh) are both node counts.
- **Catcher's P1 strikes ×1.027 (04d4)**: a kit buff's DEF percentage (OBJ Heavy Burden, formulaItem 6) was of the
  panel line alone, his talent's DEF points (formulaItem 5) added after; the game sums add-slot points first. Engine
  buffs.ts buffAttr: a percentage is of the line with the buffs' points in it. Catcher 35 → 15 mismatches.

**Scoreboard** (measure against the snapshots of de528c7; snapshots:update for the final commit): earlier pending
plain 82.3 → 84.4%, mismatch 7.5 → 4.4%, |damage error| 1.3 → 1.2% (04d4 plain 375 → 590, mismatch 614 → 293,
−3.2 → −1.4%; 4e36 plain 368 → 401, mismatch 37 → 4); verified, development, hold-outs and several-targets
unchanged; no log worse. By operator: Ember mismatch 80.2 → 2.6%, Alesh 20.1 → 0.6%, Catcher 13.9 → 6.0%.
`node scripts/team-ab.ts --base de528c7`: every team's own fight the same (no team has Catcher with OBJ Heavy
Burden), so the team numbers are unchanged.

**Decisions:** fits only where one input explains the hits (Ember, Alesh), as the earlier fits did. Snowshine's
×0.9624 (04d4) stays out of scope: one factor in [0.96232, 0.96258] fits all 157 clean hits, but no build of nodes,
weapon level and weapon skill 1 hits it with fewer than three changes, and no resistance does (her physical basic
attacks read the same factor as her Cryo hits); docs/open-problems.md has it. Avywenna's 9847 mismatches are the
fight-wide stretch, team-wide hits and Liino's Medicant layers (listed up to ×9, the kit keeps 4): not her kit, so
left as a lead in docs/open-problems.md. The multi-target 146d has the same build but no fixture there takes
buildOverrides, so it isn't touched.

**Dead ends:** a gear piece swapped between Ember and Snowshine (both off by exactly 0.125 of attribute bonus, in
opposite directions): no swap fits either; a food for Ember (116 of 284).

**Left:** Snowshine's build; Catcher's ATK hits at ×1.0005 (Will one point above the export's); Ember's 7e19
33.15 s finisher (an unlisted talent layer); Liino's Medicant layer count on teammates.

## 2026-11-27: Casts across a Stagger break: the hold from the moments, break-held-starts

**Goal:** the hold-outs' INSIDE under the break's hold (docs/open-problems.md "The hold at a Stagger break"): which
casts the hold lengthens past the next press, what the logs show about a press during the hold, and a rule for it.

**Done:**
- `zmdlogs decisions --all --assume break-hold=none`: the development INSIDE flags the hold makes are four, fc63
  102.33 s (Typhoeus's combo ran through the break, placed from its landing without the hold, held again by the
  replay), 3aa6 145.73 s (Zhuang Fangyi's battle skill 3 frames after her own combo's breaking hit), 4d60 56.60 s (a
  break on Arcane's ultimate stop's end frame; the clocks on time after it) and 458b 87.47 s (an INSIDE without the
  hold too).
- **`break-hold-place` `moments` is the default**, its hold starting no sooner than 134 ms after the moment before
  (holds.ts BREAK_AFTER_PREV_MS: 9090's 128.50 s volleys, logged there, the replay's clock 0.07–0.10 s late, land
  before it; tests/buffreplay-typhoeus.test.ts passes). 4d60's INSIDE gone.
- **The placement takes the run's readings** (placeHits / placementPasses / settleCheck `assume`; logBuffReplay,
  composeCheck and the views with `--assume` pass them; checkLog takes the composed placement instead of placing
  again at the defaults), and engine assumption **`break-held-starts`** (default `unheld`) has the held start as a
  reading: `held` moves a start the landing puts before a break, not inside another operator's combo slow-down, by
  the break's hold (logcasts.ts heldBreaks, castStart). It supersedes the round's two tried diffs (deleted).
- Probes scripts/probes/stagger/press-in-hold.ts (the starts inside or before a hold) and ult-edge.ts (breaks at an
  ultimate's stop); tests/break-placement.test.ts.

**Scoreboard** (`npm run snapshots:update`, against 2d414f3): development plain 84.3% (4d60 983 → 985, 9090 1031 →
1030, 4360 assumed +1 fallback −1), earlier pending 82.3% (d4fb 851 → 850; 3aa6 and 458b other), verified and
hold-outs unchanged. 9090's and d4fb's: hidden holds placed elsewhere (the tick bounds take the moved holds).

**Decisions:** `moments` adopted: the log's evidence (no logged moment inside a hold) where `ms` contradicts it, flat
on every group, 4d60's INSIDE gone. `held` not the default: development unchanged (fc63's and 3aa6's INSIDE gone),
earlier d4fb +2, but one hold-out −6 plain (unquantified +3, fallback +1, mismatch +2, no decision kind moved), the
same in every variant measured (all breaks; outside every combo slow-down; under `ms`). No simulated fight moved (the
engine's timeline untouched), so no team-ab.

**Dead ends:** a start inside a hold moved before it (the first try: new INSIDE flags at d4fb 40.43, 195.87 s and
3aa6 145.53 s: those combos were pressed in the hold, the kit's uncuttable frames forbid the earlier start); the
same rule under `ms` (one hold-out −6, d4fb −9: the stamped-inside breaks' holds are misplaced at the ms); no hold
at an ultimate stop's end frame (engine and replay: under `moments` development unchanged, one hold-out −1; kept in
docs/tried/2026-11-27-break-ultimate-stop-end.diff). Whether a press during a hold waits it out or runs unheld the
landings can't tell (30 starts inside a hold, 12 at its last 55 ms; d4fb 196.05 s and 9847 57.64 s read as
unheld presses).

**Left:** the hold-outs' INSIDE (not fc63's kind alone); breaks inside a combo's slow-down (4360, c4f3, d4fb: moments
0.13–0.25 s after); 458b 87.47 s. Not taken up: the several-targets agent's 7b54 lead (Si's combo slashes on several
slugs at one ms spread over the slots; a placement counting same-ms twins on several targets as one slot), left for
the next round.

## 2026-11-27: Several targets read per target

**Goal:** the scoreboard's worst row, the three fights against several targets under one id (6339, 7b54: Hard 33's
eight slugs; 9c6e: Hard 31's two Wanderers), on main at 0366a35 beside an agent on casts across a Stagger break: the
per-target state the log check needs, built for the replay, and what stays one-sided.

**Done:**
- **Design** (docs/design/data.md "Several targets"): the simulation keeps one enemy; the check holds the targets. A
  probe first (scratch, not kept): of 7b54's 204 hits with a landing, 65 fit their primary reading and 115 fit with
  some of its enemy-side units left out, and the trial assignment's targets held their states over later hits
  (Camille's 26.98–29.36 s hits all without Jade Vessel).
- **packages/logs targets.ts** `assignTargets`, read through enginecheck.ts `fightTargets` (engine assumption
  `several-targets`, default `targets`): each logged hit on a target (two hits one landing stands for at one ms on
  two; else the alive target its value fits, the one hit last first, a new one only when none fits; a capped hit kills
  its own); each target's units (enemy kit buffs, Corrosion / Electrification / Breach) as the replay's instances: one
  it got kept to its expiry, one it was read without never later, an open one decided by the first hit that only one
  choice fits. `readingBasis` drops the units a hit's target lacks; `killPurges` none (a kill ends its own target's:
  buffreplay.ts's one line, committed alone); the replay's enemy stays through a kill gap with targets left
  (fixture fields `severalTargets.atOnce`, `fromStart`; schema), whose landings the totals leave out; the totals count
  a landing once more for each twin on another target whose value fits it.
- tests/several-targets.test.ts; tests/slug-targets.test.ts under `one`; the evidence in docs/design/assumptions.md.

**Scoreboard** (`npm run snapshots:update`): the several-targets row plain 54.1 → 68.5%, mismatch 27.6 → 15.4%, mean
|damage error| 20.0 → 16.1%; 6339 better (plain 108 → 115, −19.7 → −10.3%), 9c6e better (244 → 314, mismatch 94 →
33, −24.5 → −11.3%), 7b54 mixed (65 → 99, mismatch 116 → 83, +15.7 → +26.8%: its replay-only landings read with the
one enemy's debuffs, which no kill purges now). Development, earlier pending, verified and hold-outs unchanged (no
other log is marked); no simulation reads it: no team-ab.

**Decisions:** the values decide a hit's target, as they decide a crit the log leaves out: the log has no target per
hit and lists every target's debuffs under the one id; the persistence (an instance kept, one missed never had
later) is what makes it evidence rather than a fit per hit. The totals' copies are gated on the twin's fit: ungated
the row's mean was 26.3% (7b54 +61.3%: Si's combo finals the placement paired with slashes, once per slug), as one
target 20.9%. Kill gaps kept: 6339 gets Camille's Vesperwings at 14.09 s as the log lists, and her weapon's Heat DMG,
which it doesn't (a shielded slug takes no infliction): measured `targets-gaps-away` (one plain, 2.3 points of total
the other way), kept for the log's listing.

**Left** (docs/open-problems.md "Hard 33's Woodcraft Slugs"): the placement's twins (7b54's Si combos: logcasts.ts,
the other agent's; friction report point 1), statuses' levels, bursts and Stagger per target (9c6e's second
Wanderer's bursts), a shielded slug's landing (0 damage, no infliction, buffs applied), Camille's uncovered battle
skill hits in 6339.

## 2026-11-27: Friction round 19: one reader of a reading, the follow-ups view, an enemy's stage text

Goal: improvement round 19 over five reports and round 18's backlog (summary:
docs/friction-done/2026-11-27-round-19.md; what's left: docs/friction/2026-11-27-backlog-after-round-19.md).

Done: the engine's assumption registry moved out of timeline/ (packages/engine/src/assumptions.ts, the log replay's
own readings in replay-assumptions.ts), one sentence per reading with the evidence in docs/design/assumptions.md
(outside the game-data cache's key); every reader through `readingOf` with the run's readings, holds.ts tickBounds
among them (it took break-hold's and break-hold-place's defaults under a variant); a trace test that fails a reader
handed no readings. `zmdlogs followups` (a trigger's landings against the events that fired them, from a replay-only
record `LandedHit.fired`), `replay --against-lanes` with each pair's ends, `holds --steps`, `[pinned]` LAND lines,
`gamedata enemy` (Hard 33's "They are legion" in one command) and an ability entity's tree, `instancesWhy`,
`stateAt` / `optionsAt`, the hold-outs' key test in one helper with a blindness test over every printer of
accuracy.ts and measure.ts, friction.ts by a backlog's label, lead-files `--split`.

Decisions: the replay-only readings stay registered in the engine (its context checks every `--assume` id) but in a
file of their own; the evidence went to a Markdown doc the CLI parses rather than JSON, so it reads as a doc. The
readers' run check gives every assumption explicitly at its default, so the run is the default one and every default
path is traced. The recorded Stagger start (a new report brought round 16's parked point back) moves the holds: the
accuracy list, not this round.

Checks: `npm run snapshots:update`: no log's verdicts moved, nothing changed; team-ab identical at both engine
changes (the move, and the replay-only firing record).

## 2026-11-27: The break's open points: the hold's place, combos, the Stagger end

**Goal:** the open points of the hold at a Stagger break (docs/open-problems.md "The hold at a Stagger break"): where
the hold sits against the breaking hit's logged ms, breaks inside a combo's slow-down, a `stagger-recovery` refit,
and the two hold-outs whose ~30 hits went plain → assumed.

**Done:**
- **The hold's place** (scripts/probes/stagger/break-place.ts): of the 22 breaks a clock reads, 16 are late after the
  ms only; 9090 128.92 s before it only, c4f3 33.58 s and 5082 44.43 s on both sides. The log stamps a breaking hit at
  its hold's start, inside it or at its end. No logged moment falls inside a hold, so the next moment bounds it:
  engine assumption `break-hold-place`, reading `moments` (holds.ts breakHoldStarts, a replay step that holds from
  the hold's start: replaysteps.ts, clock.ts breakHold `placed`), registered with the default `ms`.
- **Combos:** the hold applies inside a combo's slow-down, unscaled (a7a7 48.14 s, f879 57.12 s, c83c 55.83 s:
  +458–501 ms after the ms); the three with hits 0.13–0.25 s after are the stamped-inside case.
- **The Stagger end:** scripts/probes/stagger/stagger-end-fit.ts over `zmdlogs stagger`'s 38 bracketed runs: the
  engine's own end +0.32 s past the bracket's middle at the median; −0.3 s centres it, the mean |error| 2.74 → 2.72 s.
- Two placement diffs measured and kept in docs/tried (logcasts.ts is another agent's file): the pass-2 stops with the
  breaks' holds (hold-outs unchanged), and a cast's start held back by them without a cast event (development 3
  better, hold-outs 2 worse, plain −12).

**Scoreboard:** unchanged (the defaults are the old behaviour; `npm run measure` with `moments` as the default:
development plain 84.2% either way, 4d60 +2, 9090 −2, d4fb −1; hold-outs unchanged).

**Decisions:** `moments` not the default: flat on every group, and in 9090 it holds Liino's two volleys due at
128.57–128.60 s (logged at 128.50 s, the replay's clock 0.07–0.10 s late there) past their landing
(tests/buffreplay-typhoeus.test.ts). `stagger-recovery` stays `2s`: the shift that centres the median is within its
error. No simulated fight moved (the new reading is the replay's only), so no team-ab.

**Ruled out for the hold-outs:** the hold's start as the moments place it; the placement's stops with the breaks'
holds; the held cast starts made them worse. Under `break-hold=none` they lose one INSIDE decision: an action the hold
lengthens past the next press (as 3aa6's breaker logged inside its hold, fc63's combo across a break) is the lead.

## 2026-11-27: Camille's Vesperwings at an away stretch, Pogranichnik's harasses

**Goal:** two leads from docs/open-problems.md: e989's Camille Firefang Weakness (fire Susceptibility 0.12) the replay
kept on 69.19–89.32 s, and Pogranichnik's harasses 0.2–2 s off in his five logs.

**Camille.** The debuff is a child of the hovering Vesperwings entity (autoFinishByAction); the entity checks its
target every 0.5 s (buff_chr_0033_camille_normal_skill_bat_checktarget: FindTargetAction, CheckEntityNum,
FinishOwnerAction unless retargeting) and finishes without one. Every other Camille run ends at a refresh, a kill or
the fight's end; only e989 has an away stretch, and it lists the debuff to 19.67 s (the first stretch's start: no purge
is read there, the stretch being longer than PURGE_GAP_MS) and to 69.19 s, 1.74 s before the stretch 70.93–84.83 s, at
a check's boundary (61.69 s + 15 × 0.5 s). Si's boss leaves as the damage reaches about 50% and 85% of twice its Max HP
(scripts/probes/entities/jsspsi-phases.ts), the second time 0.2–3.6 s after the share is dealt, still hit meanwhile.
Built: KitBuff.targetCheck (`every`, `assumption`), read only by the log check's replay (buffreplay.ts targetLosses,
lostTargets, composed into `held` after the purges), behind Camille's kit assumption `vesperwings-target-loss`:
`kept` (as before), `away` (the first check after the stretch's last logged hit), `listed` (the check at the debuff's
last listing within TARGET_LOSS_LEAD_MS, 4 s, before the stretch; default). Measured: `listed` e989 plain 260 → 267,
|damage error| 0.5 → 0.1%, its 86.65 s Heat burst paired; `away` mixed (264, 0.8%); one hold-out better under both
(mean |damage error| 6.4 → 5.8%). Why a kit assumption: the engine registry is in timeline/, the parallel agent's
folder (friction report point 2).

**Pogranichnik.** The harass entity slows itself at each path's frames 0–3 (TimeDilationAction layer 1, 0.4 s, an
inline curve 0.30 → 0.043 → 1: mean scale 0.23, scripts/probes/entities/harass-slowdown.ts), so its frame-9 hit comes
9.24 frames late; as an entity's timeline it is on the world's clock, which his own combo's slow-down holds (d4fb's
Breach at 86.67 s, its harass at 87.97 s across his combo from 87.20 s). Kit: frames [18], `world`. Over his five logs
(scripts/probes/entities/harass-deltas.ts) median |Δ| 299 → 88 ms, one-sided 37 → 21; frame 17 measured worse (119 ms);
the teleport takes no time (ruled out). d4fb's 87.97 / 88.55 s harasses now pair right. The Decisive Assault stays at
frame 25: every logged one comes 0.21–0.44 s after its event, which nothing in the data gives (frame 8 fits all but
two; not built: open-problems "The placement cases the one-sided rounds left").

**Numbers** (snapshots:update, docs/accuracy.md): development plain 84.2 → 84.3%, |damage error| 1.3%; hold-out plain
82.5%, mismatch 5.3 → 5.1%, mean |damage error| 6.4 → 5.8%; earlier pending plain 82.2 → 82.3%. Better: e989, c4f3,
7e19, d4fb, de6a and one hold-out; mixed: a9d7 (plain 332 → 336, damage −1.7 → −1.8%, per-hit error closer); worse:
none. Team fights unchanged (team-ab identity at e2e6f3f: no team example has either operator); the
pogranichnik-chen example snapshot moves with the harass frames.

## 2026-11-27: The hold at a Stagger break; Rossi's bleed through her freeze

**Goal:** two leads of the placement-cases round (docs/open-problems.md): the clocks that run late across a logged
Stagger break (round 18's `zmdlogs clocks` rows, 5082's Yvonne +0.51 s), and 99fb's bleed ticks after Rossi's
ultimate placed as battle-skill hits.

**Done** (docs/open-problems.md "The hold at a Stagger break"):
- **A break holds every clock** (engine assumption `break-hold`, default `14f`; timeline/clock.ts breakHold, called
  at dealPoise's `staggered` in landing.ts): 14 frames at scale 0 for the world, the enemy and every operator, the
  breaker too, not inside an ultimate's stop. The evidence (scripts/probes/stagger/break-hold.ts): the clocks 0.6 s or
  more past a break run 0.41–0.61 s late but two (26 rows, every operator and enemy, enemy ticks too, median 0.54 s);
  none at the 86 Stagger Node crossings, whose buff (buff_common_mini_poise_break) has a 0.5 s layer-1 dilation. The
  data's enablePoiseBreakTimeDilation is true on every damage unit and has no length. 14f: the Node buff's curve holds
  0.46 s, and 12f–18f match alike while 16f/18f put c83c's total 5 points off (a tail cut's threshold).
- The replay: its tick bounds take the logged breaks as stops (holds.ts loggedBreaks, breakStops), so the hidden
  holds don't place the hold again; it holds only at the breaks the log shows (TimelineScenario.loggedBreaks, ±4
  frames: 6339, d4fb, f978 and 0c14 break the replay's own bar where the log has none). 5082's Yvonne keeps her chain
  at 45.06 s. Dropped after the split: the replay's Stagger window recorded from the break, not 14 frames later
  (docs/tried/2026-11-27-break-window-start.diff; the hold-outs 2 better without it).
- **Rossi's bleed runs through her ultimate's freeze** (kit `runsThroughFreeze` on Razor Clawmark): the replay held it
  +93 frames at the freeze (frames 57–150 of her ultimate on an Elite), and the log's ticks run a second apart there in
  every Elite log (99fb, 2fd9, 207f). Nothing ended the bleed: the "ended" one was held, so its logged ticks had no
  replayed landing and the placement took them for a battle skill's.

**Scoreboard** (`npm run snapshots:update` at the final commit, against f96757f): development plain 83.9 → 84.2%,
mismatch 4.8 → 4.7%, mean |damage error| 1.2 → 1.3%; earlier pending plain 81.9 → 82.2%; verified unchanged;
hold-outs plain 82.9 → 82.5%, mismatch 5.4 → 5.3%, |damage error| 6.3 → 6.4% (2 logs, about 30 hits plain → assumed:
still matched, under every hold length). The split (open-problems' table): the hold itself carries the hold-outs'
loss; the gate, the tick stops and the Stagger end don't; Rossi's bleed alone moves no hold-out aggregate (development
plain +0.1, and its fights' totals 207f 0.4 → 1.1%, 99fb −0.1 → 0.5%: more of the logged ticks land).

**Team numbers** (`node scripts/team-ab.ts --base a6c425f`, 32 seeds): the owner's team (estella-si-akekuri-arcane)
sustained DPS −0.89% (full energy, sd 2.9%) and −0.90% (zero); Typhoeus's team −0.60% / −0.36%: every break now costs
the team 0.47 s, within one sd.

**Decisions:** an engine stop, not a replay-only hold: the evidence is every operator's and the enemy's, so the
simulation has it too. `stagger-recovery` stays `2s` (with the hold the engine's own Stagger runs short in 18 of 71
logged runs, quartiles 0.43 / 0.84 / 1.62 s, against 20, 0.60 / 1.53 / 3.32 s; a refit is a next check).

**Open:** where the hold sits against the breaking hit's logged ms (9090, c4f3, 3aa6: the late clocks before it);
breaks inside a combo's slow-down; the hold-outs' 30 hits.

## 2026-11-27: Hard 33's eight slugs; status pairs read by the check

**Goal:** two leads on main at a6c425f: Hard 33's slug (7b54 +40.4%, the largest development error; 6339 −12.6%), its
mechanics from the game data and the logs; the status pairs whose replay value a buff's edge put off (1d91, 7b54,
a7a7, e989, 7910, abfd), beside an agent on holds and Rossi's bleed (its files untouched).

**Found:**
- **The slug is eight slugs** (docs/open-problems.md "Hard 33's Woodcraft Slugs"; scripts/probes/targets/slugs.ts):
  both totals are 9.600 Max HP (eight of 1.2), the kills fall at whole slugs of damage (6339: 1.00, 3.00 with two at
  one ms, 4.46, 5.00, 6.00, 7.00, 8.00), one key at one ms at several values (7b54 17 times), and the stage's own text
  says "They are legion" (one slug unshielded at a time, its death unshielding another). The data's number shield
  zeroes a shielded slug's hits (−9999 in the product zone): no log has a zero hit. ZMDLogs lists every slug's debuffs
  under the one id (7b54's attack 1 at 5.27 / 10.99 s: one listing, ×1.198 apart = Jade Vessel × Camille's 0.07), so
  "debuffs that don't act", the partial purges and the non-round factors were other slugs' debuffs, and the purges
  kills. The slugs' own buffs and AI aren't in the data.
- **The status pairs, case by case:** 1d91 (the game's burst after Arcane's combo touch, its listing has Doubles) and
  7910 (held by Arcane's own ultimate stop at +0 ms) on the other side of a buff's edge; abfd held 2.55 s (76 frames);
  a7a7 not an edge: Liino's Medicant ×4, an unjudged kit buff the burst's listing lacks; e989 not an edge: the replay
  keeps Camille's Firefang Weakness 69.19–89.32 s (open); 7b54 the slugs.

**Done:**
- 6339 and 7b54 marked `severalTargets` with that evidence (their own row with 9c6e: a reclassification).
- **`logged-purges` `log-kills`** (default; enginecheck.ts killPurges): in a several-targets fight the replay's enemy
  sheds the team's debuffs at each logged kill.
- **`status-pairing` `check`** (default): a pair fits too by the check's primary reading of it (enginecheck.ts
  primaryParts, now shared with readingBasis), with the landing's modifiers or the replay's at the logged hit's frame,
  and a pair that fits only there is read there by the check (BuffReplay.statusInputs); STATUS_WIDE_FRAMES 60 → 90.
- tests/slug-targets.test.ts, tests/status-pairing-check.test.ts; damageOptions exported from the engine's barrel.

**Scoreboard** (`npm run snapshots:update` against a6c425f): development (29 fights) plain 82.7 → 83.9%, mismatch 5.8 →
4.8%, mean |damage error| 2.9 → 1.2%, |matched| 2.16 → 1.35%, replay-only 2.83 → 1.12%, log-only 1.60 → 0.57%; of it the
reclassification alone (measure's plain tree) plain 83.8%, 4.8%, 1.2%, the readings +0.1 plain. Hold-out plain 82.7 →
82.9%, mismatch 5.4%, |damage error| 6.3%, replay-only 2.69 → 2.62%, log-only 4.79 → 4.70%: 3 better, 1 mixed (plain +3,
its total moved), none worse. Earlier pending plain 81.8 → 81.9%; verified 78.4 → 78.5% (b7b3). Several targets (3
fights) 48.1% plain / 20.6% for 9c6e alone → 54.1% / 20.0%. Better: 1d91, 4360, 7910, 79cc, 8915, 9847, 9c0b, c83c, e989,
012a, 9555, a7a7, b6aa, c6d8, d774, e82d, b7b3, 7b54 (plain 1 → 65, +40.4 → +15.7%); mixed (plain up, a total 0.1–0.3
points further): c779, f978, 3aa6, abfd, c3c7, 9c6e (plain 200 → 244, −20.6 → −24.5%: the second target's log-only no
longer cancelled); worse: af7b (total 0.7 → 0.8%, a burst now paired at a slightly other value), 6339 (plain 114 → 108,
−12.6 → −19.7%: the slug after its 20.37 s kill had Camille's Susceptibility). No simulation reads either assumption
(log check only): no team-ab.

**Decisions:** a fixture mark and a kill purge, not a shield model: which slug a hit lands on is in no log, and the
listing can't say a slug's debuffs; a kill is the one moment the log says the target changed. `check` reads a pair at
the logged frame only where the landing's own frame doesn't fit and the logged one does (the assumed → plain bursts of
b7b3, c779, c6d8: Arcane's WILL burst line a frame off): the log's time is the burst's.

**Left:** e989's Camille Firefang Weakness (replay-only run 69–89 s); per-target state for several-targets fights;
the slugs' replay-only landings (hits on shielded slugs).
