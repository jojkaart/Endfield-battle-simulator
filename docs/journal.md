# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 162 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-26: What ends Arcane's Doubles Susceptibility: the slug's purges, e82d's second touch

**Goal:** the lead from docs/journal/2026-11-26-12-arcane-s-will-lines-and-chen-s-late-wolven-blood-final.md: Arcane's
combo Susceptibility (`doubles_susceptibility`) gone before Si's combo final in e82d (8.93–9.12 s) and 6339 (29.38 s),
which the replay keeps; find what ends it in the data, check it on every Arcane log, implement, measure.

**Done:**
- **Every run of it, every Arcane log** (scripts/probes/kits/arcane-doubles-runs.ts): in WILL each run ends at its
  seal's tick, 6.1–7.6 s of world time, but four. **6339's two and 7b54's at 47.48 s aren't Arcane's:** every team
  debuff on Hard 33's slug ends at the same logged moment (Jade Vessel, Camille's Susceptibility, Arcane's weapon
  lines), and in 6339 every hit after 11.27 s read exactly with the log's listing, the replay's 1.40 times the logged.
- **Engine assumption `logged-purges`** (default `log`; packages/logs holdinputs.ts loggedPurges, purgedByLog, wired in
  buffreplay.ts): a logged moment after which none of the team's runs on the enemy listed there is listed again, at
  least 3 debuffs (a debuff's per-element affixes once) from two operators, the next moment within 1.5 s: the replay
  ends every enemy-side kit buff, status, infliction, Vulnerable stack and control there, and drops an Arts Burst on
  its way (6339's replay-only burst at 29.40 s had put Arcane's Solemn Phalanx line on every later hit). Only 6339's two
  moments qualify among the development logs. Scoreboard: development plain 73.8 → 74.3%, mean |damage error| 6.1 →
  5.1%; 6339 plain 28 → 112 of 140, +40.8 → −8.0%; verified, hold-out and earlier pending unchanged.
  tests/logged-purges.test.ts.
- **e82d is the only second touch inside a running seal in any log** (multi-target included;
  arcane-second-touch.ts): only the Doubles Susceptibility goes, the first run's listing ending where the second's
  begins. Ruled out: Si's Immobilization (seals applied while she holds the enemy run their full length:
  arcane-doubles-immobilization.ts), Si's Initial Stroke (0eef inside a run), Rhodagn's Stagger node (bar 225), the
  seal's early end by abilityEvent 8 / 1403 / 1601 (it casts abilityentity_end, logged as a combo cast; none),
  its tick. Open: the second application refreshing the first instance, which ends with the first seal at the second
  touch's InterruptAction (87 ms before the last inside listing: the log's batching), or Arcane's passive's
  TagQueryListener. Not implemented: one hit in one log.

**Decisions:** a log-read stage event, not a kit rule: no data names the slug's phases, and the purge's evidence is the
log's own listing (as the logged Stagger steps are). Statuses and inflictions go too (the burst decided it: without
them 6339 kept 35 mismatches). The affix pair counts once because 3aa6 at 25.42 s (Arcane's pair and Perlica's
Electrification) read as a purge otherwise and lost 26 plain (earlier pending). The −8.0% isn't worse than +40.8%: the
over-prediction had cancelled Si's low combo-final slots at 11.31 s (the slug's HP cap). No team-ab: no kit or
engine rule simulations read changed.

**Left:** e82d −8.9% (a log with a second touch inside an Imprisonment decides it); 7b54's partial ends (16.48,
19.59, 47.48 s: other debuffs listed on); 6339's Laevatain hits 14.6–19.2 s (the replay ×1.28) and Si's combo final
slots at 11.31 s.

## 2026-11-26: Slots and paths by value: Hunter Pursuit, Pogranichnik's combo and his bank

**Goal:** a cast's logged hits paired to its kit hits by value where time and keys don't decide (9c0b's Hunter Pursuit,
7910's rogue wave); Pogranichnik's SP-driven team buffs (Thermite Cutter, Fervent Morale) behind Chen's, Lifeng's,
Pogranichnik's and the Endministrator's fallbacks; if time, 9c6e's Liino combo on two enemies (open-problems "Fight
totals" round 5, "Low plain, low mismatch").

**Done:**
- **Slots by value** (logcasts.ts realignByValue): a cast's landings of a key fewer than its slots, the slots'
  multipliers apart by more than ×2, take the slots their values fit under one scale, then by world time; the first
  slot moves only for a key that is its cast's only one, by values or by the landings no other stop separates (by time
  alone it moved 7910's stares across Liino's stops). 9c0b's Hunter Pursuit is hits 2–4 (its Link before Arcane's
  ultimate), db87's Camille ultimate hit_2 / hit_3, a27b's Mi Fu, 00ae's Arcane lasers.
- **Neither of Pogranichnik's buffs reads the team's SP.** Thermite Cutter was right: its `other values` are the
  listing (once per application), the hits' values fit the replay's two layers. Fervent Morale's bank was double-fed:
  his combo's slashes, pinned to the 4-stack path's frames by kit order, landed beside the 3-stack path the replay took.
  Now a landing in a taken state jump's skipped part goes onto the jumped-to path (engine paths.ts takenPathLandings),
  and the values choose the path where they alone fit (castassembly.ts valuePaths, replayCast kitJumps; PATH lines).
  c4f3's first layer 15.97 → 34.03 s (log 34.04 s).
- **A Breach's Arts Intensity after its hit's before-damage triggers** (landing.ts): the data's SP comes before the
  FractureAction, so the layer the SP makes counts for the Breach (alone: d4fb plain 516 → 837 on the old bank).
- **A second enemy's landing by value** (logcasts.ts sameByValue): 9c6e's Liino combo at 47.72 s; 40d9 unchanged.

**Scoreboard** (`npm run snapshots:update`): development plain 72.7 → 73.8%, mismatch 10.6 → 10.5%, mean |damage
error| 6.3 → 6.1%; hold-out unchanged; earlier pending plain 73.0%, 3.5%. Pogranichnik 41.9 → 52.1% plain (total error
5.0 → 2.8%), Chen 38.8 → 43.0%. Better 9c0b, db87, a27b, 7b54; mixed 9c6e (plain 175 → 202, −13.5 → −13.9%), a9d7 (177 →
265, −2.2 → −3.3%: the doubled slashes had hidden Chen's −3.2% and Estella's −7.0%), c4f3 (223 → 275, −2.9 → −3.4%),
d4fb (−0.4%: 86.67 s, the bank 0.3 s late in the replay); worse 7910 0.0 → −0.2% (its 352,792 is the early rogue
wave by value, ×17.5 a stare, with no dive logged: matched to the plain wave now). team-ab: unchanged.

**Decisions:** none of it an assumption: the values' ratios are ×2–17 apart where they decide, and each rule acts only
where they do. landing.ts is outside the brief's file list (not status.ts or the buffs): named for the lead.

**Left:** the Vulnerable stacks a Breach consumed read from the next combo's path (c4f3 13.07 s: three in the replay,
four in the game), the harasses' Fervent Morale on whom (c4f3 68.83 s), 7910's early wave.

## 2026-11-26: Arcane's WILL lines and Chen's late Wolven Blood final

**Goal:** three leads from open-problems: e82d's −8.9% (Si's combo final at 9.12 s, with Arcane's Solemn Phalanx WILL
lines listed five times), c4f3's second Wolven Blood final ending at 104.5 s against the log's 99.1 s, and Estella's
set and Susceptibility missing on Chen in c4f3.

**Done (diagnosis; no code change kept):**
- **e82d: not the WILL lines.** The game counts one will_atk and one will_dmg (stackingType 1 by priority, as the
  engine has them): the slash just before the final lists the same five lines and reads plain with two, and Si's
  finals with ×3–×4 lines listed read plain in 79cc, 9c0b, b6aa and f978. The final misses Arcane's combo
  Susceptibility (doubles_susceptibility): its lane ends at 8925 ms, between Si's last slash and her final, and the
  final read as a crit without it is the logged value to 0.01%. 6339 shows the same at Si's final. What ends it is
  open (the seal's replacement chain, a control ending the SealAction, a stage rule in 6339): open-problems, round 5.
- **c4f3: a layer short, not the final's clock.** The first final ends at 49958 ms, a crit's ms; that hit reads without
  the final and its layers, and the layer it adds survives the clear. The replay ended the final 42 ms later (the
  placement takes the end-boundary hit as listed), wiped that layer and reached the second final 2.7 s late. Taking
  every end-boundary hit as past the run (engine assumption `boundary-ends` `before`) fixed c4f3's finals (plain 223 →
  233) but measured mixed (development |damage error| 6.3 → 6.4%, 4360 −9 and 9555 −16 plain): dropped,
  docs/tried/2026-11-26-boundary-ends-before.diff.
- **Estella in c4f3: one batch's order at 7.05 s.** The replay lands Chen's combo first, shatters the Solidification
  with it and takes Estella's combo as its not-Solidified variant (×2.86 low), so neither her Physical Susceptibility
  nor her set's trigger come; the log credits the Shatter to her combo. The fix lies in the batch's landing order
  (castassembly.ts, another agent's file this round): left for the lead.

**Decisions:** no team numbers (no engine or kit change kept, team-ab not run). The boundary rule stays out: a lane's
end at a hit's ms isn't one side of the hit in general; c4f3's case is decided by that hit's own value.

**Left:** what ends Arcane's doubles Susceptibility before Si's final (e82d, 6339); a bound from an end-boundary hit's
value; the order of landings batched at a stop's end (c4f3 7.05 s). Friction report
docs/friction/2026-11-26-arcane-will.md.

## 2026-11-26: Improvement round 15: one rule for each fact, records the views carry

**Goal:** the five open friction reports and round 14's backlog (docs/friction/README.md's round), every file free:
the structural causes first (a fact computed twice by two rules, a record the views didn't carry, a comparison against
the wrong reference), behaviour-preserving.

**Done** (docs/friction-done/2026-11-26-round-15.md has the list and the commits):
- One rule each: the replay's stops (castassembly.ts replayStops, read by the hold placement and every world-time view;
  `zmdlogs worldtime` replays and shows a tick-read event without frames); a hit's twin on a jump's other path (engine
  timeline/paths.ts pathTwin, pathLandings, for the control and chance paths and castassembly.ts); each assumption
  kind's fact (assumptions.ts ASSUMPTION_FACTS, docs/design/data.md's table, tests/assumption-facts.test.ts); one
  reason per kit buff (replaycrits.ts buffDecidability).
- Records the views carry: HitRecord.assumptions and landing.cast, `zmdlogs assumed --operator`, groups' rows of casts
  matched only as another kit hit, LINK and two-casts MADE lines, measure's hold units with their pinning bounds,
  `zmdlogs clock`'s check paired by the nearest start, `zmdlogs stagger`'s FLAG.
- The reference: measure with no reference named and stale snapshots measures the merge base with main as --base;
  cli-ab reads the other worktree's paths as this checkout's.
- Tools: scripts/split-module.ts (a split as a checked move), check-links.ts staleCitations (eight fixed) and conflict
  markers (docs/roadmap.md had a merge's, resolved), `lead-files.ts --family`, bash-guard's sed hint, process step 6
  (CLAUDE.md is the lead's: lines proposed in the summary's "For the lead").

**Checks:** `npm run measure -- --base 32dfacd --at HEAD` after the refactors: no log's verdicts moved; team-ab against
32dfacd: every team's fight the same; `npm run snapshots:update` at the end: the scoreboard unchanged.

**Found on the way:** the CLI's `--no-cache` and `--no-foods` were dropped by parseArgs' allowNegative (read as an
undeclared `cache=false`), so the hits cache was read whatever the flag said; fixed (command.ts withDeclaredNegatives).
The fact table's test found the log-listing fallback trying both crits where the replay had read one (three hits in
0c14 and a9d7; a fallback either way): on the backlog's accuracy list with two other candidates the table names
(reaction levels the log decided, the enemy's side).

**Left** (docs/friction/2026-11-26-backlog-after-round-15.md): the log context `{ data, assume }` (carried twice),
fit-build over a wider space with chance counts, the by-operator scoreboard's share (a new snapshot key), a recorded
Stagger start.

## 2026-11-26: Low plain, low mismatch: the replay's read crits and a status's crit

**Goal:** why most of Rossi's hits (and Chen Qianyu's, Yvonne's, Lifeng's, Pogranichnik's, the male Endministrator's)
match only under an assumption or the log-listing fallback; make the readings with a mechanism the default, and say
which are only the check's tolerance (open-problems "Low plain, low mismatch").

**Done:**
- **Grouped the non-plain matches by what they assume** (scripts/probes/assumed/kinds.ts): Rossi's 1109 were 418
  `crit` alone (her ultimate stabs and Seething Blood extras), 165 boundary, 181 fallbacks; Yvonne's 150 `crit`; Chen's,
  Lifeng's, Pogranichnik's and the Endministrator's nearly all fallbacks.
- **The crit the replay read is the primary reading's** (engine assumption `check-crits`, default `replay`;
  enginecheck.ts readingBasis, primaryCritRead): the replay had read those crits from the log (replaycrits.ts:
  Seething Blood extras at the stab's ms, Wolven Blood layers, values) but the check took none and assumed the crit.
- **A status's damage that crits fires triggers on crits** (engine events.ts statusCritMatches, landing.ts recordStatus
  `crits`, asEvents; a replayed status's hit takes its logged crit, reactions.ts reactionEventKeys): Chen's Wolven
  Blood layers in a9d7 gain one at each crit Lift and fell a layer further behind at each (×1.013 → ×1.044 by 69 s);
  Lupine Scarlet and MI Security are both on abilityEvent 44 (any crit). Seething Blood and the pistol's kind-filtered
  triggers don't see it.

**Scoreboard** (`npm run snapshots:update`): development plain 69.7 → 71.8%, mismatch 11.2%, mean |damage error|
6.8%; hold-out plain 81.0 → 82.1% (one log mixed: plain +65, totals); earlier pending plain 70.2 → 72.9%, mean |damage
error| 3.5 → 3.4%; verified 78.0 → 78.1%. By operator: Rossi 51.9 → 73.2%, Yvonne 31.9 → 71.2%, Chen 30.2 → 38.8%,
Pogranichnik 44.1 → 41.9%, Lifeng and the Endministrator unchanged. Better: 0c14, 2fd9, 99fb, abfd, d572, a9d7 (101 →
177 plain), 3f78, 489c, 5082, 4e5e; mixed 207f, 4a64, 9a80 (totals +0.1–0.4%); worse c4f3 (243 → 223, −2.5 → −2.9%):
Chen's layers now right, her second Wolven Blood final ends 5 s late in the replay and the hidden-hold placement, which
reads it as a clock, moves its later units, so the third final and Pogranichnik's hits at 116–146 s read ×1.04 off.
team-ab: both teams' fights unchanged; examples.json: Rossi's example +0.46% (her Lifts' crits add layers).

**Decisions:** `check-crits` registered as an engine reading so the old classification stays one `--assume` away (the
value inference is cross-validated at 0.90, not proof); the status crit isn't an assumption (the log shows the layer at
every crit Lift and none at the others). Status damage counts only for triggers on crits: nothing in the logs says
whether it counts as a hit for other hit triggers. Left as the check's tolerance: boundary buffs at the hit's ms,
kit buffs changing within 500 ms, Link the replay can't say, crits no inference reads.

**Next / open:** Pogranichnik's Thermite Cutter and Fervent Morale, both on SP the log doesn't record, behind most of
Chen's, Lifeng's, Pogranichnik's and the Endministrator's fallbacks; c4f3's Wolven Blood final end (a clock).

## 2026-11-26: Fights outside 5%: a variant's cast event, detached tails, a carried Corrosion

**Goal:** the development and earlier-pending fights whose totals are off by more than 5% (8915, 7b54, 6339, c6d8:
stage logs; 9c6e, c83c, 7910, db87, e82d), split by operator and landing kind, fixed by mechanisms (open-problems
"Fight totals", round 5).

**Done:**
- **db87 (−6.0 → −1.2%): a cast event logged as its button's other variant.** Every Twilight battle-skill hit was
  ×1.3000, Link (1) from Camille's combo: the log records the presses as `normal_skill`, and the replay made each as a
  forced normal_skill besides the placed normal_skill_during_ult; that phantom took the Link and landed an explosion
  and ticks the log never shows. logcasts.ts `buttonVariants` (one castable only without a buff the other needs,
  neither giving it on its cast: Purrchena's battle skill readies her counter, so it isn't one), castassembly.ts
  `variantCastOf`; the placement times the variant from that event (the 27.13 s press before Si's ultimate stop).
- **c83c (+7.9 → +1.9%): a tail cut takes detached landings.** Si's combo final (an ability entity's detached hit,
  374k) a frame after her last logged slash survived the cut (at lastLogged + 1, after that frame's hits, detached
  ones exempt). Now at the last logged landing's frame, dropping the cast's later hits, detached too (drivers.ts
  `endsAt`). The hold-outs moved most from this.
- **7910 (−6.1 → 0.0%): a carried Corrosion above its cap stays.** Hits 51–62 s ×1.099 (one resistance step, the same
  +11.35 points for everyone) after Ardelia's forced level-1 Corrosion replaced Arcane's level 4: the data's tick
  adds and clamps only below the cap (reactions.ts corrosionShred; combat-mechanics §3.5).

**Scoreboard** (`measure --base 9e1904d` after merging main, then `npm run snapshots:update`): development mean
|damage error| 6.8 → 6.3%, within 5% 25 → 28, plain 71.8 → 72.7%, mismatch 11.2 → 10.6%; hold-out 8.4 → 7.4% (4
better, 1 mixed: plain −1, assumed +1), plain 82.1%; earlier pending plain 72.9 → 73.0%, 3.4 → 3.5% (4bfc −0.8 →
−1.0%, 3aa6 mixed: plain +6, total 0.2 → 0.6%, d4fb better). Worse: 79cc 0.0 → −0.1%, 4bfc: replay-only tail
landings removed from fights the replay under-predicts. team-ab (against 36e3bc8): only estella-si-akekuri-arcane
(zero energy)'s 60 s timeline moved, +0.83% (the Corrosion rule); sustained DPS unchanged.

**Decisions:** the Corrosion rule isn't an assumption (the data's gate is explicit and 7910's 143 hits fit it); the
variant rule needs complementary availability, not the same kind alone (04d4 and 99fb lost 91 and 30 plain with
kind only). Stage logs left (no enemy data for hsbear_hdg018 or wgabyss_hdg011). By-operator means are each
operator's own total, mostly the stage logs and small totals (Liino's unlogged beats).

**Left:** slots by value (9c0b's Hunter Pursuit, whose misplaced first landing sends its Link to the wrong cast;
7910's rogue wave), e82d's Si combo final (Arcane's weapon WILL lines ×5 listed, ×2 in the engine), 9c6e (two
targets). Friction report docs/friction/2026-11-26-totals-off.md.

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
