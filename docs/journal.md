# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 156 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-26: Alesh's Rare Fin: chance paths and a cast from the listing

**Goal:** casts and paths the log shows only through their listed buffs, as general rules: 0c14's eventless 12.5 s
Alesh combo and the Rare Fin path of her combos in 0c14, 4e36 and a9d7 (open-problems "0c14").

**Done** (open-problems "0c14: Si, and Rossi's later windows", "The damage factors"):
- **A chance jump the log decides** (engine drivers.ts replayCast `chanceJumps`, chanceJumpsOf, chancePathLandings):
  the trigger isn't rolled; a taken jump is scheduled at its frame; the logged landings go to the path's hits of the
  same keys at the same frames from the cast's start (Alesh: hook 22 / slam 38 against hook_ex 77 / slam_ex 93 after
  10 → 65). Simulations never pass it.
- **The replay's chance paths from the listing** (castassembly.ts listedPaths): her P3 team ATK, only on the Rare Fin
  slam, is listed from exactly the slam's logged ms in all six cases; not taken where P3 is listed somewhere but on no
  hit in 3 s after, a running run decided by its end (a refresh keeps the `since`). 17 decisions in 3 logs (PATH
  lines in `zmdlogs decisions`), none against the values.
- **A cast from a hit's listed buff** (engine assumption `listed-casts` `inferred`, castsFromHitBuffs): a buff exactly
  one kit hit gives, its run starting where no cast of the skill could have landed it, gets a cast timed to land the
  hit there, its path's earlier hits pinned; its landings count for nothing. One cast in 61 development logs (0c14 at
  12.00 s: its Thermite layer at 12.73 s against the log's 12.71 s).
- In-game test 71 part 1 as good as decided by 0c14 (seven consumptions, seven combos; a run-out, none).

**Scoreboard** (measure against ade98a1, both rules; `listed-casts` alone: 0c14 404 → 493): earlier pending plain
68.1 → 70.2%, mean |damage error| 3.6 → 3.5% (0c14 plain 338 → 493, mismatch 20 → 12, total −1.3 → −0.3%; 4e36 281 →
368, +2.2 → +0.9%); development plain 69.6 → 69.7% (a9d7 99 → 101, −2.2 → −2.6%: its rolled Rare Fin landings, which
the log hasn't, gone, Alesh matched −5.6 → −0.7%); hold-out plain 80.8 → 81.0% (1 better, 1 mixed: +4 plain, its
total further); verified unchanged; negative control within its bound. The snapshots' scoreboard: docs/accuracy.md.
team-ab: unchanged (no simulated fight moved).

**Decisions:** the path rule isn't an assumption (the listing's evidence is exact to the ms in every case); the cast
rule is (`listed-casts`), as a cast made with no hit or event could be invented. P3 itself stays the log's: judged by
the replay where every cast's path was decided, 0c14 gained 3 mismatches' worth and one hold-out log lost 47 plain,
which can't be diagnosed by hand (docs/tried/2026-11-26-chance-path-buffs-decided.diff). The Stagger at its breaking
hit and the lives model were not reached.

**Problems:** the first measure compared against snapshots another commit's code wrote; the same-key pairing of two
paths' hits was wrong where one key covers the whole skill (friction report docs/friction/2026-11-26-alesh-rare-fin.md).

## 2026-11-26: Bursts and cooldowns: 4d60's runs a whole-game pause in a Stagger, the replay's Stagger starts

**Goal:** 4d60's Perlica weapon and Arcane's Will burst runs (a refresh the replay misses), d4fb's 97.05 s Physical
Suit exception, Snowshine's ×0.9846 left in 04d4, then test 33's reaction case.

**Done** (open-problems "The kit buff leads", "Trigger cooldowns", "04d4 Snowshine", "Arcane's WILL combo touch"):
- **4d60: not a refresh, a whole-game pause inside a Stagger.** Across 117.22–124.45 s (no hit by anyone) every clock
  runs 6–7 s long: the log's Stagger, Perlica's Wild Wanderer and Qingbo layer, Arcane's two Solemn Phalanx debuffs,
  Liino's beats. The hold placement couldn't put a hold there because the Stagger was a still span. Engine assumption
  `pause-holds`, new default `away` (holds.ts withoutGaps cuts the away stretches out of the Stagger's still span):
  5.4 s placed there, 13 clocks spanning each unit, earliest and latest within 0.4 s. The earlier ruling-out (Xiranflow
  on time) doesn't hold for 4d60: its layers are replaced by later consumptions, and the world-time counts included
  the Empyrean's end as a 78-frame stop.
- **The replay's Stagger window record** took a window's start as its end less the Stagger's length; a Stagger the
  log's listing holds ends at the listing's next moment, so d4fb's windows read 10 s early (97.26 → 86.50 s), and the
  placement took those 10 s as still. Now no earlier than the last sample (replayrecord.ts).
- **d4fb 97.05 s:** the missed proc's Lift is the hit that breaks the Stagger bar; the one other breaking status with
  the cooldown clear (0c14's 182.30 s Crush) procs. A breaking Lift applying no status fits, on one case: not built.
  The other misses are cascades (3.37 s, the fight's first, unexplained).
- **Snowshine:** her nodes' favorability (60, 150, 300, 300) gives no ×0.9624 alone; on top of two nodes, 46 pairs of
  build changes fit within 0.001 and no single one (scripts/probes/stats/snowshine-builds.ts): one constant, one
  number, no log decides it.
- **Test 33:** 9a80's and fc63's touches follow the same opener (Arcane's Nature forming Corrosion) and fit opposite
  readings of `window-reaction`; the reaction kind doesn't decide it, the in-game test stays.

**Scoreboard** (`npm run snapshots:update`): development plain 69.0 → 69.6%, mismatch 11.4 → 11.2%, mean |damage
error| 6.9 → 6.8%; hold-out unchanged; earlier pending plain 68.0 → 68.1%, mismatch 11.9%, mean |damage error| 3.6%.
Better: 4d60 (plain 696 → 806, −4.1 → −1.5%), c4f3 (−3.0 → −2.5%), c6d8 (plain 112 → 125); d4fb other (±1); none worse.

**Decisions:** `pause-holds` an assumption (the evidence is one log, though 13 clocks agree), read only by the log
check's replay: no simulated fight moves, so no team-ab. The two small edits in buffreplay.ts and replayrecord.ts are
in the replay modules the parallel inferred-casts agent owns; kept small and named for the lead.

**Problems:** the world-time view counts a tick-read event's stop the placement leaves out (query.ts replayTimeStops),
which misled the earlier round's Xiranflow count; `zmdlogs stagger`'s window start showed the record's error without
anything flagging it.

## 2026-11-26: Improvement round 14: the replay's decisions as records, one composition each, the buffreplay.ts split

**Goal:** the five open friction reports (round 13's backlog, round 13's own report, the 0c14-and-operator-curve,
away-and-presses and combo-hold reports), every file free this round, so the buffreplay.ts split and the backlog points
held back for the replay, the engine and the check could be done. No verdict may move.

**Done** (docs/friction-done/2026-11-26-round-14.md; the backlog: docs/friction/2026-11-26-backlog-after-round-14.md):
- **buffreplay.ts in six modules**, a move only (80253f4): castassembly.ts, replayrun.ts, holdinputs.ts,
  replaycrits.ts, replayedhits.ts; buffreplay.ts keeps replayKitBuffs and BuffReplay. The 130 statements checked
  against the original by AST; prose citations follow the names.
- **The replay's decisions as records**: BuffReplay.made; `efsim zmdlogs decisions <fixture…|--all> --assume <id>=<r>`
  (the SKIP, TAILCUT, FAILED, MISSED, INFER, MADE, JUMPDROP, FORCED, INSIDE, CUTS lines two readings differ in); the
  EVENT line from the replay's own record (8915 111.23 s: the inferred press); JUMPDROP from drivers.ts replayCast's
  `dropped` callback; `zmdlogs hits --against <id>=<r>`.
- **One composition each**: composeCheck (snapshotEntry and hitRecords), replaykeys.ts (the strings the snapshots'
  kinds group by), a burst's recorded infliction (StatusEvent `inflictedAt`) for `zmdlogs bursts` and `clocks --clock
  burst`, logBuffReplay refusing data not under its combo-curve reading.
- Smaller: `totals --by crit` and `hits --json` totalsPredicted / totalsCrit; `hits --operator` reads only the logs with
  the operator, with a time estimate; `measure --split files --only`; logBuffReplay's options object and
  scripts/typecheck-scratch.ts; per-command CLI options; "Chen" for Chen Qianyu; `friction.ts check` and its test.

**Scoreboard** (`npm run snapshots:update`): "No log's verdicts moved"; development plain 69.0%, mismatch 11.4%, mean
|damage error| 6.9%; hold-out 80.8%, 5.6%, 8.4% (unchanged). The split alone: `measure --base 0b094c3`, no log moved.
Engine record changes: team-ab's identity check against 0b094c3 twice, every team's fight the same.

**Decisions:** six modules, not the backlog's four (the crits and the hit readings have no caller in the run); the
fight's lives not unified (lastLifeKilled's and loggedEnemyHp's rules differ, so one function moves verdicts: the
accuracy list); the log context's signature change carried, its failure mode made an error first; CLAUDE.md not edited
(a sub-agent's brief can't authorize it): its views sentence is the lead's.

**Problems:** the first guard run showed `zmdlogs decisions --assume combo-curve=…` had replayed the defaults on the
reading's data, the bug class the guard is for; "Chen" matched Purrchena too until the name's word starts came first.

## 2026-11-26: 0c14 and the operator curve: a teammate's attack on its own path, crits read from values in the totals

**Goal:** 0c14's under-prediction (−3.2%: Rossi's matched landings ×0.943, Si's ×0.964), a combo curve for the
operators' clocks alone, the unlogged tails' cuts across the logs, then Alesh's eventless combo, 207f, Snowshine's
×0.9624 and the buffreplay.ts split.

**Done** (open-problems "0c14", "The damage factors", "The enemy's clock", "The replay's Stagger windows"):
- **The totals' expected crits** (scripts/probes/totals/parts.ts): of Rossi's −186k, about 87k was crit-unknown hits
  counted at expected crits though their values show the crit (her first ultimate ×1.032 off on every stab, its two
  crit finals at ×0.766). Engine assumption `totals-crits` `read`, the new default (enginecheck.ts critFromValue:
  the reading the value is within ×1.08 of, the other not).
- **A teammate's attack 4 on its own path** (drivers.ts controlPathLandings): Rossi's kit jumps to hit_ai (× 0.5)
  when she isn't controlled; the placement matched the controlled path's frames and the replay dropped the jump.
  A jump on control now follows who the log shows controlled: 2fd9 plain 250 → 275, 99fb 161 → 173, 0c14 +2.
- **What's left of 0c14** is Alesh's: her 12.5 s Rare Fin combo the log shows only by its buffs (a second Thermite
  Cutter layer on everyone at 20.7–43.3 s, her P3 from 13.25 s), her 59.56 s combo's Rare Fin path (also 4e36, a9d7),
  and a Stagger at its breaking hit (80.48 s, −30k; scripts/probes/stagger/break-order.ts: the breaking hit without it
  45 of 47, the hits after it at its ms with it 10 of 29, every combo hit after its own Lift's break 4 of 4).
- **Operators-only combo curves** (`combo-operator-hold` `plateau-0.5`/`0.6`/`0.7`/`flat`, timeline/clock.ts
  comboOperatorCurve): verified plain 78.0 → 77.9 / 77.7 / 77.6 / 76.0%; 9a80 (Arcane's team) +4 under `plateau-0.5`,
  3aa6 −13. Recorded and stopped, as the brief said.
- **The tail cuts** (scripts/probes/tails/cuts.ts): 16 cuts, 7 dropping a landing, none against the log. 9c6e's is
  the placement's two-enemy split (Liino's hit 1 on both enemies at one ms); de6a's hit_3 falls in a 2.3 s stretch with
  no hit by anyone.
- Snowshine: her nodes 5 and 7 need favorability, so two nodes give ×0.977 of the ×0.9624; ×0.985 left.

**Scoreboard** (`npm run snapshots:update`): verified plain 78.0%, mean |damage error| 2.0 → 1.5%; development plain
69.0%, mismatch 11.4%, mean |damage error| 7.0 → 6.9%; hold-out plain 80.6 → 80.8%, mismatch 5.6%, mean |damage
error| 8.3 → 8.4% (1 mixed: +15 plain, Rossi's attack 4, its total further; 2 other); earlier pending plain 67.7 →
68.0%, mismatch 11.9%, mean |damage error| 4.0 → 3.6% (0c14 plain 336 → 338, −3.2 → −1.3%; 2fd9 250 → 275, −3.6 →
−1.3%; 99fb 161 → 173, −2.9 → −0.3%; b6aa −5.5 → −2.3%).

**Decisions:** `totals-crits` `read` is a totals rule (plain counts unchanged): it takes one fight's crit luck out of
the totals; the six logs whose totals got slightly further (de6a −0.8 → −1.0%, 9847 +0.2 → −0.5%, fc63, 5082, 458b,
9555, ≤0.7 points) had expected crits covering a model error. The curve readings stay registered as the measured
record. A placement rule taking a landing at its cast's previous one's ms as a second enemy's fixed 9c6e's Liino combo
and broke 40d9's Si (her combo slashes batched at one ms, Si −23%): dropped. Alesh's two combo leads not built: a
combo has no cast event and the Rare Fin path is a chance jump the replay doesn't roll; both need a cast or path read
from the listing or the values (next steps). The buffreplay.ts split (point 6) not done: no time left after the
accuracy items. 207f not reached. team-ab: unchanged (no simulated fight moved). Smoke passed.

**Problems:** the totals' per-hit numbers aren't in any view (a probe written for it); two paths sharing keys show
only as odd ratios; `hits --all` after an engine edit recomputes every log (friction report
docs/friction/2026-11-26-0c14-and-operator-curve.md).

## 2026-11-26: Combo hold and the replay's tails: Rossi's cut battle skill, the combo's excess in its first half, the curve a reading

**Goal:** 0c14's Rossi replay-only landings (58, 0.30M), a9d7's Slashing Edge across an away stretch, where in a
combo the operators' extra hold sits, smaller leads (Alesh's eventless combo, 207f, Snowshine's ×0.9624), and round
13's backlog points 1, 4 and 6.

**Done** (open-problems "The damage factors", "The enemy's clock", "0c14"):
- **0c14's Rossi: one battle skill's tail.** Her 35.40 s battle skill lands its two charge hits and then nothing the
  log has (no Lift, wolves, 16 bleed ticks, nor the Endministrator's combo shatter the Lift sets off), the enemy
  there; without that Lift's Vulnerable stack her 52.04 s battle skill takes no follow-up (its Lift hit logged, no
  Lift status, no wolves). Engine assumption `unlogged-tails` `cut`, the new default (buffreplay.ts tailCuts,
  ReplayCastOptions.endsAt, TAILCUT lines in `zmdlogs replay`): a battle skill, combo or ultimate whose later
  landings are none of them logged ends after its last logged one, the earliest first, the replay made again after
  each. Guards found by three measures: not where the log has another hit of the operator's casts no cast holds
  (3f78's combo_3), where a decided buff the tail starts is listed as a new run (db87's Camille), in the fight's
  last 1.5 s (2fd9's kill) or an away stretch. 0c14 plain 293 → 336, replay-only 58 → 14.
- **a9d7's edge: a hidden hold.** Chen's ~0.4M ultimate final isn't logged where her other finals are, and the edge
  refreshes on a landing that deals damage, which the log would show; a hold of 0.37–0.84 s after 158.60 s fits the
  placement's free unit. The away rule's edge unchanged.
- **The combos' operator excess sits in the stop's first half** (scripts/probes/combo-hold/edges.ts): landings
  0–200 ms before a listed start on time, landings right after the listed end at full density and already 186 ms
  late, at 0.5–0.6 of the stop 294 ms. A uniform extra hold on the operators (`combo-operator-hold` `3f`/`4f`/`6f`,
  registered, off) measured worse: verified plain 78.0 → 77.4 / 77.1 / 76.4%, earlier pending −0.9.
- **Backlog point 4:** `combo-curve` (`guess`, `flat`, `middle`; timeline/curves.ts withCurveReading, applied by
  createContext and the log tools' entries). `measure --variant combo-curve=flat` reproduces the patch measure of the
  enemy-clock round: verified 78.0 → 73.0%, development 69.0 → 68.0%; `middle` 75.6%, 68.6%.
- **Backlog point 1:** `zmdlogs casts --choices` (choose's rule per cast, LoggedCast.chosen) and `zmdlogs placement
  --choices` (the in-turn rule's verdict and checks per overlapping ultimate, Placement.inTurn); settleCheck pairs
  through pairCasts.
- Snowshine narrowed (level, potential and weapon skill levels ruled out); Alesh's eventless combo and 207f not reached.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 69.0%, mismatch 11.4%, mean |damage
error| 7.0% (unchanged; 9c6e −13.2 → −13.5%: Liino's unlogged combo hit2 out of an under-predicted total); hold-out
plain 80.6%, mismatch 5.6%, mean |damage error| 8.4 → 8.3% (1 better, 2 worse, totals only); earlier pending plain
67.3 → 67.7%, mismatch 11.9%, mean |damage error| 4.0% (0c14 mixed: plain 293 → 336, its total +2.7 → −3.2%, its
matched Rossi ×0.943 and Si ×0.964 below the log; de6a −0.4 → −0.8%, Pogranichnik's unlogged combo hit_3). team-ab:
unchanged (the defaults change no simulated fight). Smoke passed.

**Decisions:** `cut` the default and `cut-all` (basic attacks too: totals mixed, 8 logs closer, 6 further) kept as a
reading. `combo-operator-hold` kept registered though worse, as the measured record of the obvious mechanism. Backlog
point 6 (the buffreplay.ts split) not done: the tail cuts went in by grep, and a 3,100-line move with its proof
didn't fit beside the accuracy items.

**Problems:** the tail rule's false cuts showed only per measure (friction report: a decisions view across logs);
`--why` and `--rules` were taken CLI option names (the views' option is `--choices`); an unescaped quote in an
assumption's text broke smoke's and team-ab's first runs (typecheck would have caught it: run it after text edits).

## 2026-11-26: Away and presses: the enemy away in the replay, hitless presses from the listing, layers

**Goal:** build as general rules what the damage-factors round hard-coded or held back: the enemy away from the fight
in the replay (0c14's Si press at 139.68 s), a press with no logged hit inferred from a buff only its hit gives (her
153.99 s press), Rossi's slash2 extras at a life's or fight's end, an untracked layered buff's layers (Ember, 7e19);
then whether a fixed delay per stop edge explains the combos' extra hold.

**Done** (open-problems "The damage factors", "The enemy's clock"):
- **The replay's enemy away** (engine assumption enemy-away `absent`, the new default; TimelineScenario.enemyAway,
  landing.ts): a hit from the frame after a stretch's last logged hit to the frame before the next applies nothing to
  the enemy (damage, applications, Stagger, enemy-side buffs, hit events); the operators' own buffs from it still come
  (d774's and 9c6e's Liino presses there put her stance's ATK on the team, as the log lists after). The totals leave out
  every unmatched landing from the stretch's first frame on (the enemy leaves with its last logged hit). An Arts Burst
  still lands: holding it back lost 4a64's Arcane weapon debuff the log lists (6 plain), so only its damage is left out.
- **Hitless presses** (`hitless-presses` `inferred`, the new default; buffreplay.ts inferredPress): made only with the
  log's own cast event, the enemy there, the next hit within 1.5 s listing a new run of a decided buff that the replay
  gives with the press and not without; the press after it is then the variant it pulls; its own landings aren't
  counted. Two presses across the logs: 0c14's Si (153.99 s) and 8915's Liino (111.23 s). Alesh's eventless 0c14 combo
  stays open. A recorded burst whose applier is unlogged is now unread (more than twice the buff's life away), not
  read over 73 s of hits.
- **Life ends and kills:** a fight of several lives ends in a kill when its last life dealt one Max HP (lastLifeKilled,
  read by the totals and enemy-hp `kill`). With the leaving frame it covers 4a64's both slash2s (+2.9 → +0.8%); 207f's
  stays (no kill the log shows). Both held-back diffs deleted (docs/tried/README.md).
- **Layers:** the check reads an unjudged kit buff on one timer (stackingType 8/10) listed once at each count to its
  maximum (enginecheck.ts unjudgedLayered): 7e19 mismatch 4 → 1, 04d4 616 → 614, 99fb 116 → 111; 7e19's 33.15 s
  ×1.096 is left (no listing then). Negative control holds.
- **Item 5:** one constant per combo fits as well as a share (probes combo-hold/edge-casts.ts, edge-ticks.ts), but
  57 ms a combo for the enemy's ticks against 140 ms for the operators' casts: one delay on the world's clock is ruled
  out. Next: where in the combo the operators' excess sits.

**Scoreboard** (`npm run snapshots:update`): development plain 69.0%, mismatch 11.4%, mean |damage error| 7.0%
(unchanged; 4a64 better; 891566, 9c6e, a9d7 slightly worse); hold-out plain 80.4 → 80.6%, mismatch 5.6%, mean |damage
error| 8.4% (1 better, 1 mixed: +12 plain, its total further); earlier pending plain 66.3 → 67.3%, mismatch 12.0 →
11.9%, mean |damage error| 4.1 → 4.0% (0c14 plain 172 → 293, −3.4 → +2.7%). team-ab: unchanged (simulations never set
enemyAway). Smoke passed.

**Decisions:** both readings default, with the others kept (`away`, `absent-edge`, `skipped`): `absent` against
`absent-edge` because the logs record every landing (d774's unlogged strikes 0.23 and 0.27 s into its stretches).
The hold-out mixed log's total getting further fits 0c14's pattern: the readings that now fit raise the total onto an
over-prediction elsewhere. a9d7's Chen (an ultimate final 0.74 s into a stretch no longer refreshing a buff the log
lists later) is reported, not fixed.

**Problems:** the replay view's EVENT line called the inferred Liino press a tick; kill and life detection live in two
places; a burst's unbounded record start was silent (friction report).

## 2026-11-26: Improvement round 13: clocks, dropped bounds, --assume everywhere, options before the queue

**Goal:** friction round 13 over the five open reports (round 12's backlog and own report, holds-and-placement,
damage factors, the enemy's clock), beside an accuracy agent holding the replay, placement, check, holds, engine and
compiler files. Write-up: docs/friction-done/2026-11-26-round-13.md.

**Done:**
- `efsim zmdlogs clocks` (clocksview.ts): tick chains, casts' landings and bursts against the stops inside, by stop
  kind and combo operator; the enemy-clock round's five probes in one run (combos 0.23–0.40 × their held time late,
  ultimates on time). `zmdlogs holds --dropped --all`: the dropped bounds by kind and cover (tick bounds in a Stagger
  with a combo: 47 dropped in 9 logs, 35 kept). `differences --clusters`. query.ts `loggedStaggerSpans` for views and
  probes.
- `--assume` on every view that replays (REPLAYING / NOT_REPLAYING in the CLI, a test over the usage).
- measure checks its options and readings before it queues; `--help` on measure, snapshots, premerge, team-ab,
  verify-at (scripts/usage.ts); `--variant --hits` lists a variant's own hits against the plain tree.
- castpairs.ts `pairCasts` (measure `--changed placement`'s moved casts); scripts/lead-files.ts for the lead's file
  split; at-commit's patch failures name the hunks; edit.ts's end block without `=======`; docs/design/tests.md "What a
  hold-out output may say"; the report format's **Files:** line.

**Decisions:** every point needing the replay, placement, compiler or engine went to the backlog (6 live points), not
done in halves outside them; round 12's backlog point 4 closed (the lead's decision), point 5 moved to the accuracy
list. Burst bounds closed: the enemy-clock round ruled them out.

**Scoreboard:** unchanged; `npm run snapshots:update`: "No log's verdicts moved", no snapshot file changed. No engine
change (no smoke, no team-ab).

**Problems:** finding which file each point needed took about twenty minutes of grep (hence the **Files:** line); a
type name clash across `export *` (ClockRow) at the first typecheck.

## 2026-11-26: The lead: the check's own-buff fix adopted, the two accuracy rounds merged

- **Goal:** merge the two parallel accuracy rounds of 2026-11-26 (damage factors; the enemy's clock) and apply what
  the damage-factors round held back because the check was the other agent's file.
- **Merged:** both rounds. The only conflicts were in docs/roadmap.md, docs/roadmap-details.md and docs/tried/README.md,
  where both sides added text; I combined them.
- **Adopted:** the check's loggedEntries now matches an unjudged kit buff's listed entry only against its own game
  buff's engine modifiers. Before, Ember's Pay the Ferric Price was dropped as one of Thermite Cutter's +0.09 layers in
  7e19. The held-back diff is deleted, as docs/tried/README.md says.
- **Scoreboard** (`npm run snapshots:update`):
  - hold-out plain 79.0 → 80.4%, mismatch 5.9 → 5.6%, mean |damage error| 8.5 → 8.4% (3 better, 0 worse);
  - development and verified unchanged;
  - earlier pending's mean |damage error| 4.2 → 4.1%, with 0c14 −4.9 → −3.4% and 7e19 better.
- **Still held back:** the 0c14 diff (Si's away press, hard-coded) and the life-end landings diff (mixed). Both need
  general rules in the replay: an enemy-absent away state, and a hitless press inferred from a buff only its hit gives.
  They are next steps, not adoptions.

## 2026-11-26: The enemy's clock: combos hold every clock more than their stops; no pause while the enemy is away

**Goal:** the holds-and-placement round's leads, in order: db87's enemy-clock delay in a Stagger (its Corrosion 0.58 s
past the replay's end, Combustion ticks 1.5 s apart), a burst's delay as a hold bound (9a80 35.05 s), 4d60's unlogged
holds (a boss-phase pause?), d4fb 97.05 s; if time, freezes on Electrification / Solidification and a placement pass
by quiet stretches.

**Done** (open-problems "The enemy's clock", new; the four leads' paragraphs):
- **Found: across a combo's stop every clock runs late** by a fifth to a half of what the stop list holds, across an
  ultimate's on time (scripts/probes/combo-hold/): the enemy's tick chains in a Stagger 3.43 s over 87 pairs with a
  combo against 0.02 s over 30 without; an operator's cast across a teammate's combo +263 ms median (112 casts);
  bursts +181 ms (45); buff runs 0.45 × the combo-held time. db87's four tick pairs each span one combo.
- **Ruled out:** Arcane's Imprisonment slowing the enemy's clock (SealAction's curve, over 1 s or its 6.6 s: the
  ticks after a seal are on time; in-game test 37's Arcane part decided from the logs); a Stagger or the enemy's
  actions (Staggered chains without combos run on their period); a longer ComboSkill curve (flat: verified 78.0 →
  73.0%, development 69.0 → 68.0%, hold-out 79.0 → 76.7%; a middle curve worse too; docs/tried/2026-11-26-combo-curve-flat.diff);
  a burst's delay as a hold bound (placed holds don't hold bursts: 012a, 458b, 489c, 7910 on time across 0.10–0.42 s
  of them); a pause of the operators' timers while the enemy is away (Xiranflow's 25 s layers on Zhuang Fangyi run on
  time across 4d60's and d774's away windows); for d4fb 97.05 s a cooldown shared by the set's two wearers and one
  restarted by every Physical status.
- **Registered, not the default:** engine assumption `stagger-holds` (`combos`: the hidden holds may rise inside a
  Stagger within a combo's stop, up to half its hold; holds.ts comboHoldSpans, placeHolds `slow`): development plain
  69.0 → 69.2%, hold-out 79.0 → 79.2%, verified 78.0 → 77.5% (0eef), db87 −6.0 → −5.9% only.

**Scoreboard:** no default changed, no verdict moved (`npm run snapshots:update`). No engine timing change (no smoke,
no team-ab).

**Decisions:** `stagger-holds` stays off with a verified log worse and db87 barely moved: the placement's least
total takes the Stagger's 0.44 s from holds placed earlier, and nothing bounds the unlisted Corrosion past the
replay's end. The burst bound wasn't built: its mechanism (dodges holding the operators' clocks) isn't what the bursts
show. Not reached: Electrification / Solidification across a freeze (no listed run across one found in a first look,
7910's Solidification unlisted), the quiet-stretch placement pass.

**Problems:** the ComboSkill curve's measures waited behind another worktree's measures in the lock's queue (about
10 min each); the probes' first cut (per tick pair) split a stop's time between neighbouring pairs, so only chain
sums with whole stops inside are evidence.

## 2026-11-26: Damage factors: Catcher's weapon, the Crush's stacks from Si's away press, Ember's listed layers

**Goal:** the damage factors the misprediction statistics left, largest first: the Crush ×2.2 (0c14) and ×1.90 (2fd9),
04d4's Catcher ×2.1 and Snowshine ×0.962, Ember's ×1.096 (7e19), Rossi's ultimate ×1.09 / ×1.08, bleed clock, slash2
extras and combo_3 over-hold, then the cast tails; another agent held the replay, holds and check files.

**Done** (open-problems "Misprediction statistics", The damage factors):
- **The Crush is right; its misses were Vulnerable stacks.** Every logged Crush reads exactly with the data's
  multiplier by stacks consumed. Rossi's perfect combo gives a Lift and one more stack per consumed infliction, so one
  infliction the replay lacks costs two stacks: 2fd9's (fixed by round 4's counter bash), and 0c14's at 182.30 s (2 →
  4: 172,059 exactly). 0c14's cause: Si's battle-skill press in the away stretch (139.68 s), made by the replay, landed
  nothing in the game, and her hitless 153.99 s press was her battle skill (Jade Vessel's Immobilization debuff listed
  from the next hit, her Artful Intent ending at the log's 181.00 s). Hard-coded as a measurement:
  docs/tried/2026-11-26-0c14-si-away-press.diff (0c14 plain 172 → 293, −4.9 → +1.2%); the rule is the replay's.
- **04d4's Catcher: weapon level 3** (fixture buildOverrides). fit-build threw on his DEF-scaled hits under a DEF food
  candidate; such a candidate is now unscored (buildfit.ts, tests/buildfit-fit.test.ts). 04d4 plain 185 → 376.
- **Ember's ×1.096:** the check's loggedEntries dropped her listed talent ATK (+0.09) as one of Thermite Cutter's
  layers (fix held back: docs/tried/2026-11-26-log-entries-own-buff.diff, hold-out plain 79.0 → 80.4%, 3 better, 0
  worse), and her talent's layers aren't listed (one entry at 1–3 layers: 04d4's steps ×1.023 / 1.085 / 1.147).
- **Rossi:** her ultimate's ×1.09 / ×1.08 fit now (closed); the slash2s without an extra are a fight's or a life's last
  hit (scripts/probes/rossi/slash2.py; the totals rule is mixed and too broad, docs/tried/2026-11-26-life-end-landings.diff);
  the bleed's unlanded ticks and combo_3's over-hold left to the holds' owner.
- Snowshine narrowed (her attribute bonus 3.325 → 3.200 exactly; no weapon level or node count reaches it); the cast
  tails' largest are stage, two-target and placement cases, no kit cause.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 69.0%, mismatch 11.4%, mean |damage
error| 7.0% (unchanged); hold-out 79.0%, 5.9%, 8.5% (unchanged); earlier pending plain 64.7 → 66.3%, mismatch 13.9 →
12.0%, mean |damage error| 4.1 → 4.2% (04d4 mixed: per hit 17.9 → 6.5%, its total +2.1 → −3.0%, the over-prediction had
hidden the rest of its deficit). No kit or engine change: team-ab not needed.

**Decisions:** fixes in files another agent held were measured with `--patch` and kept as docs/tried diffs marked held
back (README paragraph), not applied; Catcher's level-3 weapon taken though the weapon's skill levels (3, 2, 3) can't be
checked against a breakthrough table the data sources lack.

**Problems:** `measure -- --help` queued 5 min for the lock before rejecting the option (friction report).
