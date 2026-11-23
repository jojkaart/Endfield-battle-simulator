# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 130 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-23: Improvement round 8: the replay split, views on its record

**Goal:** the eighth friction round over the five open reports (round 7's backlog and its own report, ticks and layers,
the hold-out refresh, the remaining leads), behaviour-preserving, with no other agent in the code: so the replay's
run() refactor and the engine-clock points earlier rounds had left could be taken. Summary:
docs/friction-done/2026-11-23-round-8.md; what's left: docs/friction/2026-11-23-backlog-after-round-8.md.

**Done:**
- The replay's run() is `replayOnce(input, pass)` (buffreplay.ts), its steps in replaysteps.ts, what it records in
  replayrecord.ts (replayRecorder). Measured byte for byte. Every new view output below was then an edit to the record.
- Views: a kit window's chain (`replaces`: "refreshes the one from"), enemy-status traces (`replay --trace-buff
  status:<s>`, a moved application named a hold, the log's runs as LANE), `replay --stops` (the timeline's applied
  slow-downs against the log tools' lists), the crit each landing took and its source (`hits --json`, `--zones`, LAND
  lines), INSIDE judged by the gates alone with CUTS for a legal interrupt (78 of 169 former INSIDE flags), `zmdlogs
  totals` (matched, replay-only and log-only parts), `holds --why`'s log-end side, "same totals (cosmetic)" values.
- Tools: `measure --patch <diff>`, held frames per slow-down (`gamedata dilations`, `efsim kit`), `runstate
  --touching`, RefreshMismatch.values (printed by `zmdlogs refresh` for development fixtures), merge.ts and
  premerge.sh printing hold-out paths as counts, CLAUDE.md's commit and hold-out lines.

**Decisions:** pinned expiries (round 7's backlog 4) were built as a scratch diff and measured with `measure --patch`:
development and verified unchanged, one hold-out entry "other"; not adopted in a behaviour-preserving round, moved to
the accuracy list. No ClockShift type: the grep it was meant to serve found no anchor reading besides Corrosion's, and
clock.ts `moved` already is the one mapping (documented). `measure --patch` in place of a registered `stop-path`
reading: it measures any half of a change.

**Found:** the engine applies Arcane's combo reset only to the slow-downs running when her combo starts, so a
teammate's combo slow-down starting before her frame 9 runs whole (1d91 50.30 s, 7910 4.90 s, 9555 31.73 s) where the
log tools' lists cut it (docs/open-problems.md, Arcane's combo reset); Purrchena's combo has 30 list-only stops (04d4,
99fb). Both are accuracy tasks.

**Scoreboard** (`npm run snapshots:update`: "No log's verdicts moved", no snapshot changed): verified 77.9 / 99.1 /
0.0 / 1.8%, development 65.7 / 80.4 / 14.8 / 8.6%, hold-out 77.4 / 91.9 / 6.3 / 10.2%, earlier pending 58.5 / 79.2 /
17.8 / 8.1% (plain, matched, mismatch, mean |damage error|), as before.

**Problems:** `--logs 9c0b` matched 489c0be3e162 too (an id part inside another id): full ids for a selection. One
multi-line `python3 -c` slipped through (the round's friction report).

## 2026-11-23: A finisher cut by an ultimate, late instance runs, cut casts' later stops

**Goal:** the remaining leads after the hold-out refresh: 458b's Laevatain total (9.0 → 11.3% at 74bc686), Rossi's
combo_3 dilations, Xaihi's weapon instance in 5082 (1.67 s late), 489c 49.31 s.

**Found and done:**
- **458b:** a compensating error going away. 74bc686 made her enhanced battle skills at 92.9–94.3 s right; what was left
  over were two replay-only finisher hit_2 landings (225,802 and 281,334), kept because her ultimate came inside the
  finisher's disable-cast buff (frames 0–42), which the engine let hold every cast. Every logged ultimate inside a
  finisher's frames cut it (458b ×2; d572, Rossi's placed from its own hits, 17 frames in). Engine assumption
  `finisher-ultimate` (`cuts`; `held` the old rule): SkillTiming channels' `finisher`, timing.ts afterCantCast. 458b
  damage 8.0 → 0.8%, d572 4.2 → 2.1%.
- **5082:** INSTANCE_LATE_MS now skips an instance buff's late run only where the replay reapplies it on the holder
  inside the run (a refresh in place needs one); otherwise the run is a clock (buffreplay.ts runBounds). Xaihi's 27.37 s
  instance is her last: Arcane's 50.51 s hits plain, 5082 plain 224 → 247; 4d60 +6 net (15 hits at 102.98 s now read a
  Corrosion the log has ended: a Corrosion end from the hits isn't a bound yet).
- **489c 49.31 s:** right as placed (held start + the slow-down = 49.29 s). The "ahead" ramp readings at 49.77–50.00 s
  are Rossi's own ×1.013 (her weapon's layers, from 47.0 s, before the Corrosion). Found on the way: the log tools' stop
  lists put every SkillTiming slow-down at its own frame, so Rossi's combo_3 on its perfect path (ends at 211) held the
  world again at frame 212, 7 s later, and Pogranichnik's and Purrchena's combos had their paths' stops at 6–20 s; the
  engine never had them. skillStops now follows the path the cast's landings show (logcasts.ts pathOf, the engine's
  pathSlowdowns shared with casting.ts). 489c plain 579 → 589, mismatch 31 → 23; 9a80 +5.
- **Rossi's combo_3 dilations:** worth 1.5–2.2 frames, not 7 (the combo one ramps from its frame 8); 3f78's excess
  167 → 114–135 ms either way; the "combo priority outranks" reading measured mixed (489c −8). Not built.

**Scoreboard** (`npm run snapshots:update` against aa938ce's snapshots): development plain 65.4 → 65.7%, mismatch 14.8%,
mean |damage error| 8.6%; hold-outs plain 77.6 → 77.4%, mismatch 6.3%, mean |damage error| 10.6 → 10.2% (1 better,
0 worse, 2 mixed); earlier pending 58.5%, 17.8%, 8.4 → 8.1% (3 better, 1 worse: 99fb −1 plain, a knock-on of the stop
lists; 2 mixed); verified unchanged. Teams (team-ab against aa938ce): every team's fight the same.

**Decisions:** the finisher rule as an engine assumption (three cases, two operators, all one way). The hold-outs' plain
−0.2 pt is the stop lists' part (measured apart: the placement's part moves nothing); kept, since the lists now match the
engine's own timeline and one hold-out can't be traced.

**Left:** Rossi's bleed tick series across a reapplication (489c 52–60 s, which drops the ramp's bounds); a Corrosion end
read from the hits as a hold bound (4d60); 6339's Laevatain hit_2 with no own cast before it; the castFlag view's INSIDE
wording (it counts the wait for own hits, not only uncuttable frames).

## 2026-11-23: The hold-outs refreshed blind: the lane rules tested on them

Goal: round 7 found every hold-out (and the verified 40d9, 4e5e) imported before effects carried `since` / `source`,
so the replay's rules that read the log's buff runs (the hidden holds' run and status clocks, `heldToLoggedEnds`,
`layerCrits`) were untested there. Refresh them without anyone seeing a hold-out, then measure.

Done:
- `zmdlogs refresh` refused 40d9 and 4e5e: one 0 ms trigger buff each was unquantified at import, and today's detail
  has every `dynamicEffects` empty (40d9 under the same parser version). `refreshFixture` now lets a hit's
  `unquantified` listing only have lost entries, keeps the fixture's then (`RefreshResult.keptUnquantified`, one
  provenance note) and still refuses a new entry. Both refreshed: since / source / poise.origin added; verdicts
  unchanged (4e5e: other counts only).
- scripts/holdout-refresh.ts: the split's hold-out ids by code, each detail fetched once (3.5 s apart, the importer's
  user agent, memory only, never the raw cache), refreshed in a temporary copy, written back only if its id, battle,
  team and enemy are unchanged; prints an index, ok / failed (a category) and since yes/no per fixture, then counts.
  Tested on a synthetic root (tests/holdout-refresh.test.ts). Run: 13 ok, since 0 → 13, no listing kept.
- Scoreboard (same code, main at 636bbc0; the fixtures only): hold-out plain 74.0 → 77.6%, matched 91.7 → 92.1%,
  mismatch 6.4 → 6.3%, mean |damage error| 10.8 → 10.6%, within 5% 7 → 8; 5 better, 1 worse, 6 mixed, 1 unchanged.
  Verified, development, earlier pending unchanged.
- `measure --variant hidden-holds=none|log|holds` on the refreshed hold-outs against the default `placed` (77.6%,
  6.3%, 10.6%): none 70.3%, 6.5%, 10.9% (1 better, 7 worse); log 73.0%, 6.5%, 10.7%; holds 76.8%, 6.3%, 10.5%.

Decision: the hidden holds (`placed`, `log` on top) are confirmed on the hold-outs: the best reading there, by about
the development logs' margin (none → placed: development 57.8 → 65.4%, hold-out 70.3 → 77.6%).

Left: the one hold-out worse after the refresh can't be traced (a hold-out); `layerCrits` has no assumption reading,
so its share of the 74.0 → 77.6% isn't separated; a detail takes ~45 s to download.

## 2026-11-23: Crits from values, Combustion ticks from the tick before, landings batched at a stop's end

**Goal:** four leads after the hold-clocks round (docs/journal/2026-11-23-03-corrosion-s-ramp-under-slow-downs-arcane-s-reset-freezes.md):
5082's regression (−2.1 → −8.2%), 458b's Wulfgard Combustion ticks, a battle skill's hit logged at another cast's stop's
end (a7a7 3.87 s), Rossi's combo_3 dilations.

**Found and done:**
- **5082** (open-problems "Smaller"): not Arcane's Arts DMG Taken (the replay has both layers) nor the moved 0.77 s
  hold unit. Arcane's combo reset shortened the replay's own clock 0.1–0.2 s for every instance, which tipped two buffs
  over hits: Yvonne's MI Security layers ran out 0.05 s before her finisher (×1.166), because the log gives none of her
  85 ultimate hits a crit flag, though their values are two levels ×3.0 apart and the log lists the layers to the end;
  and Xaihi's weapon team ATK on Arcane from 50.51 s (×1.18), an instance 1.67 s late, past INSTANCE_LATE_MS (left).
  buffreplay.ts `valueCrits`: a crit-less hit CRIT_APART above the lowest of its key, skill and scale within 1 s is a
  crit (not where logged non-crits split by themselves, nor a slot of two scales). Cross-validated with half the flags
  hidden (scripts/probes/crits/value-xval.ts): 442 of 445 right for the operators with crit triggers (Rossi, Chen,
  Yvonne), 0.90 over every operator against a base rate of 0.10; values shuffled within a key 0.24. 5082 −8.2 → +0.7%.
- **458b** (open-problems "Ink Melt logs"): each Combustion tick deals with the owner's attacker side as it was at the
  tick before (85.70 s without Akekuri's ATK from 84.37 s, 86.69 s with it, 230.62 s with her potential's +0.10 that
  only the tick before lists). Engine assumption `combustion-snapshot` (`last-tick`, default; `application`):
  situation.ts `retakeTickSnapshots`. Over the 21 Combustion logs 52 ticks plain that weren't, 1 the other way. 458b's
  6.1 → 7.5% is Laevatain's total at 74bc686 (Si's strokes onto the placed holds), not the ticks.
- **a7a7 3.87 s** (open-problems "Smaller"): a landing logged at another cast's frozen stop's end whose cast event puts
  it just before the stop landed there: the cast starts at the event, the batched landings (and what they set off)
  land at their kit frames (logcasts.ts `beforeStopStart`, LoggedCast.beforeStop; buffreplay.ts `batchedFrame`). a7a7's
  Corrosion ramp readings off the replay's step 15 → 4. 489c 49.31 s is another case (the hit inside Rossi's combo
  slow-down, logged 0.31 s after it), left.

**Scoreboard** (`npm run snapshots:update`, after merging main at aa29bac): development plain 65.2 → 65.4%, mismatch
14.8%, mean |damage error| 8.9 → 8.6%, within 5% 16 → 19; hold-outs 73.7 → 74.0%, 6.4%, 10.8% (5 better, 1 worse,
1 mixed: aggregates only); earlier pending 57.9 → 58.5%, 18.2 → 17.8%, 8.3 → 8.4%; all but the hold-outs 62.6 → 63.0%,
15.8 → 15.6%, 8.0 → 7.9%; verified unchanged. Development 10 better, 0 worse, 4 mixed (489c, db87, f978: per-hit
closer, totals ±0.2 pt; 9a80 −1 plain: Si's combo at 35.05 s reads the Stagger's ×1.3, a knock-on of a cast placed
from its event); earlier pending a7a7 376 → 405 (mismatch 45 → 14), 458b 1048 → 1064 (mismatch 22 → 12), abfd plain
313 → 333 but total −1.3 → +3.9% (Yvonne's crit-refreshed buffs now on: the old −1.3% hid them), 4e36 mixed.
Teams (team-ab against 8daa9e9, seeds 1001–1032): Estella's sustained DPS −0.01% full / −0.00% zero, 60 s timelines
+0.00%; Typhoeus's fight the same. Examples snapshot moved with the ticks.

**Decisions:** crits inferred only upwards and only for operators whose kits have crit triggers (the replay's buffs);
the check's own verdicts try both crits anyway. INSTANCE_LATE_MS kept at 1 s: 5082 fits 2 s (2.17 s of holds, no bound
dropped) but 4d60's refreshed Arcane runs are why the cap exists, and one log doesn't move it. The tick rule as an
engine reading with the old one kept: its mechanism (the snapshot taken after each tick) is the logs', not the data's.

**Dead ends:** valueCrits keyed by hit id within one placed cast (Yvonne's ultimate is eight-shot casts, one landing per
id: nothing inferred); by the key and scale names alone (0.72: Purrchena's attack1 slot holds hits of 367 and 551, both
logged non-crits; scale names repeat across skills); a crit-zone check from the stat panel (Yvonne's ultimate adds Crit
DMG the panel lacks).

**Left:** Xaihi's weapon instance in 5082; 458b's 86.69 s and 227.60 s ticks (the replay's tick before is elsewhere);
4e36's Wulfgard ticks between the two readings; Rossi's combo_3 dilations (two at frame 0, 12 and 19 frames, different
priorities: one replacing the other would hold 7 frames less, about the 0.15–0.2 s 3f78 and 4a64 ask; not built).

## 2026-11-23: Improvement round 7: the placement explained, one stop list, measure's checks

**Goal:** the seventh friction round over the five open reports (round 6's backlog and own report, hold-clocks,
rossi-gilberta, ramp-slowdowns), behaviour-preserving, beside an agent working on kit and engine accuracy.

**Done** (docs/friction-done/2026-11-23-round-7.md has the list by cause): `zmdlogs holds --why` (one refresh rule,
one clock check, each instance's verdict recorded by runBounds / statusBounds); scripts/cli-ab.ts (any efsim command
at two commits' code, `--holds` for the bounds a change moved); `measure --hits` against the code that wrote the
snapshots, with the modifiers that moved per hit; `measure --variant`; the negative control and a count of logs
without `since` in every measure; `zmdlogs ramp --held`; the compiler's time dilations listed (`efsim kit`,
`gamedata dilations`); `verify-at --test`; tests/stops-source.test.ts; casts view on the replay's stops, with
`poise.origin` and batched times. Snapshots unchanged ("No log's verdicts moved"); the scoreboard as it was
(development 65.2% plain, hold-out 73.7%).

**Decisions:** a test, not a lint rule, guards the stop lists (a lint rule needed disable comments in buffreplay.ts,
which the other agent edits). The replay's run() refactor, KitWindow's chain, pinned expiries, the status trace and
the engine clock's one shift value stay in the backlog: each needs buffreplay.ts or the engine's clock to itself.
Round 6's points 1–10, 12 and 14 parked after their second carry.

**Findings:** cutting the placement's unplaced cast events' stops at resets made 1cd1 worse (plain 182 → 177: an
event's time is the press, Arcane's combo cast a second later), so they stay uncut (open-problems). All 13 hold-outs
lack `since` / `source` on their effects: the lane-based rules (hidden holds' run clocks, heldToLoggedEnds,
layerCrits) are untested there; a blind re-import is the lead's and owner's call. The first measure after a
code-only commit printed "no hit's verdict changed" for a moved log: hold-clocks point 2 reproduced, then fixed.

**Problems:** friction.ts carry put the carried-from note in the middle of a wrapped From line (fixed). Two empty
heredocs typed from habit (not refused); a chained `&& git commit` ran after a typecheck error piped through `head`
(amended).

## 2026-11-23: Wolven Blood's crits from its listed layers; Gilberta's tower-boss stacks from an instance buff's clock

**Goal:** two leads from docs/journal/2026-11-23-02-hold-clocks-enemy-statuses-and-corrosion-s-ramp.md: Rossi's Wolven
Blood starting late where the log gives her hits no crit (489c's 16th layer at 55.61 s, the replay's at 59.5 s), and
Gilberta's Vulnerable stacks outliving 20 s on the tower bosses (4360 116.0 s, 9847 126.1 s; 9847 310 → 300 from the
ramp cap).

**Done (open-problems "The buff clock" Wolven Blood bullet, "Gilberta's Susceptibility"):**
- buffreplay.ts `layerCrits`: a trigger on its operator's crits that adds a layer of a buff the log lists with its start
  adds one per crit, so n layers listed from a moment (`listedStarts`: entries with that `since` over the entry kinds)
  are n crits there, after the logged and shownCrits ones: all the crit-less hits there when as many, else the largest
  standing apart ×1.4 (CRIT_APART, shared with shownCrits). Cross-validation with every flag of the operator hidden
  (development logs; Rossi, Chen's and Yvonne's crit sets too): 956 of 973 right (0.98, base rate 0.64); the listed
  starts moved to random moments of her hits (negative control): 0.63. Both in tests/buffreplay-fixtures.test.ts on 489c.
- loggedLaneEnds: a run is refreshed only when it stops being listed within 200 ms of the other's start (runs listed side
  by side are two instances). runBounds: an instance buff's run (KitBuff.instances, excluded before) is a clock where the
  log shows it apart (`runApart`: each replay application inside it has its own run, some run overlaps it, none ends
  within 1 s of it), it is the run nearest the instance (`nearestRun`), and it is at most 1 s late (INSTANCE_LATE_MS).
  4360: Perlica's Arts DMG Taken from 92.24 s, 0.74 s late, places a hold that keeps the 90.87 s stacks: Gilberta's
  116.0 s Susceptibility reads 0.39 (3 stacks), Avywenna's ultimate under it plain.
- Scoreboard (`npm run snapshots:update`): development plain 64.4 → 64.9%, mismatch 15.2 → 15.0%, mean |damage error|
  9.3 → 8.8%, within 5% 16 → 17; hold-outs unchanged; earlier pending 57.3 → 57.7%, 18.4%, 8.0 → 8.3% (0c14); all but the
  hold-outs 61.9 → 62.3%, 16.1 → 15.9%, 8.1 → 7.9%. Rossi 39.8 → 41.8% plain. Development 11 better (489c 517 → 546,
  mismatch 57 → 38; 207f 106 → 121; 5082 damage −18.1 → −2.1%), 3 worse: 4a64 (150 → 140: the Wolven Blood runs moved
  the placed holds, Corrosion read a step ahead at 16.8 s and Gilberta's Pursuit lost at 28.3 s), 9847 (one mismatch,
  Gilberta's attack 3 at 140.3 s, the moved holds), 9a80 (damage 0.5 → 1.4%); 0c14's total +16.4 → +26.1% (Rossi's own
  −10.8 → +1.6%, Si's +14.1 → +21.9%: her replay-only Artful Intent burst records Rossi's larger damage). No engine or kit
  change: the simulated fights are the same (team-ab not run).

**Decisions:** the crit count only adds crits (at 16 layers a new one replaces one; the listing undercounts there). An
ambiguous moment is left alone unless the largest stand apart: the hit's own verdict tries both crits anyway, what matters
is the count. Instance buffs as clocks only with the log's evidence that the run is an instance of its own: Arcane's
will_dmg / will_atk runs keep their start through refreshes (489c, 9c0b: overlapping runs end together; b6aa, 4d60:
lone runs 2–8 s late; 4d60 placed 11 s of holds before the 1 s cap). holds.ts statusLanes keeps the old refresh rule
(another agent's file).

**Dead ends:** instance buffs allowed wholesale (489c plain 517 → 475: Arcane's refreshed runs asked 2.6 s of holds);
the per-buff independence test (9c0b's will_dmg passed it); without the nearest-run rule 489c's 12.0 s instance paired
with the 14.6 s run.

**Left:** 9847 126.1 s (0.30 against 0.36): no listed clock asks the 0.73 s more before the ultimate; Gilberta's listed
Susceptibility as a Vulnerable-count clock (a holds.ts bound builder). 489c's final 1.1 s late from two bleed ticks the
replay lands off the log's (ticksShownByHits), d572's one layer short from ~8 s with every crit logged.

## 2026-11-23: Corrosion's ramp under slow-downs: Arcane's reset, freezes

**Goal:** the hold clocks' open direction (docs/journal/2026-11-23-02-hold-clocks-enemy-statuses-and-corrosion-s-ramp.md):
146 of 3,553 ramp readings show the game's Corrosion ramp ahead of the replay's, 139 with a combo slow-down in the
window. Which slow-downs over-hold it, and why; then the hold bounds on the replay's own stops; then 458b's Wulfgard
Combustion ticks.

**Found (open-problems "The buff clock", What over-holds it):** four causes, not one combo rule.
- **Freezes** (f978's 33 readings, the largest bucket, and 7910): the replay's freeze held Corrosion's ramp its whole
  length; the log's steps run on (Si's Immobilization in f978 at 57.6 s: ≤ 0.51 s held of 1.5 s; a7a7 18.1 s ≤ 0.68 s;
  Tangtang's stare in 7910 47.8 s about 0.7 s of 4 s). The probe had counted Laevatain's combo in f978's window.
- **Arcane's combo resets the combo slow-down:** its SkillData has a layer-0 TimeDilationAction back to scale 1 (curve
  RESETto1) at frame 9, in the same priority tag as every combo's dilation (−593023102). Under the lowest-scale rule it
  would do nothing; the game keeps one dilation per priority, so it ends her own 0.6 s slow-down at frame 9 and a
  teammate's running then. 3f78's opener (an application the battle-skill event confirms): steps allow 0.61–0.73 s by
  3.0 s, lowest scale 0.92 s, with the reset 0.72 s; 4a64 likewise.
- **The application's logged ms** (a7a7 3.87 and 20.53 s, 489c 49.31 s): readings ahead of real time since `since`.
  a7a7: Arcane's battle-skill event (2.31 s) puts its hit at 2.98 s, before Liino's combo stop, logged at the stop's
  end (3.86 s); the placement starts the cast through the stop, so the replay applies Corrosion 0.9 s late.
- **Left:** Rossi's combo_3 (two dilations at frame 0 in different priorities) in 3f78 / 4a64, ~0.15–0.2 s; Zhuang
  Fangyi's ultimate placed from its event in 4d60 (0.17 s).

**Done:**
- Data: each compiled slow-down's `priority`, SkillTiming.resets (skillData.ts). Engine: `combo-reset` (default
  `resets`): a reset ends the running slow-downs of its priority, its own too, and gives each clock back what they would
  still have taken (clock.ts `cutAtResets`, `resetSlowdowns`; the shift functions take negative frames, floored after
  the reset). `freeze-ramp` (default `runs`): a freeze holds Corrosion's end, not its ramp (`rampRunsOn`).
  tests/slowdown-reset.test.ts.
- Logs: every stop list is cut at the resets among its casts (logcasts.ts `skillStops`, `withResets`); the hold bounds
  use the replay's own casts' stops (buffreplay.ts `replayedCastStops`, which `replayTimeStops` now calls). Probes
  corrosion/ramp-pairs.ts (pairs of readings cap the model's hold between them, independent of `since`) and
  freezeramp.ts.

**Scoreboard** (`npm run snapshots:update` against 6921b3f): development plain 64.4 → 64.6%, mismatch 15.2 → 15.1%,
|damage| 9.3%; hold-outs 73.5 → 73.7%, 6.4%, 10.8% (5 better, 4 worse); earlier pending 57.3 → 57.5%, 18.4 → 18.2%,
8.0 → 7.9%; verified 77.7 → 77.9%, 1.9 → 1.8%. Better: f978 (444 → 469), a7a7 (351 → 376, mismatch 71 → 45), 3f78
(53 → 63), 4a64 (150 → 156, mismatch 2 → 0), 9c6e, 891566, 7910, 9a80, c83c, b6aa, 2fd9, 99fb, 0eef, b7b3. Worse
(knock-ons of the hidden holds placed again, small): 4d60 −4 plain (Zhuang Fangyi's strikes at 151.7–152.4 s land
0.15–0.3 s off the log's), 79cc −4 (a Corrosion step ahead at 50.1–53.6 s, ×0.987: after Arcane's cut combo the log
asks a dodge-sized hidden hold the bounds now place elsewhere), 9090 −3, 1d91 −1, af7b −1, d9e5 damage −0.1 pt; mixed
00ae (−9 plain, a mismatch fewer), 489c, 9c0b, fc63, 1cd1. Measured apart: freeze-ramp alone 3 better, 0 worse
(hold-outs 73.5 → 74.0%, 2 better, 0 worse); the reset alone, the stop lists uncut, mixed (hold-outs 73.4%, 4 worse);
cutting the lists then 2 better, 0 worse on the hold-outs; the bounds on the replay's stops alone: 2 better, 1 mixed.

**After merging main** (d9b1d2d: Wolven Blood's crits, instance buffs' runs as clocks; `snapshots:update` against
main's snapshots): development plain 64.9 → 65.2%, mismatch 15.0 → 14.8%, |damage| 8.8 → 8.9%; earlier pending 57.7 →
57.9%, 18.4 → 18.2%, 8.3%; 489c 546 → 573 (mismatch 38 → 31, damage −1.8 → −0.7%). One combination regression:
5082 damage −2.1 → −8.2% (plain 227 → 224): with the bounds on the replay's own stops (Yvonne's ultimate at its stop,
not at its 38.16 s event) and main's instance-buff clocks, a 0.77 s hidden-hold unit moves from 38.14 to 36.77 s
(now placed within 0.1 s), and at Yvonne's ultimate finisher (49.78 s, two hits of 0.6 and 1.2 M) and Arcane's hits
at 50.51 s the replay lacks a ×1.17–1.18 the log has, matching a second layer of Arcane's weapon Arts DMG Taken (listed
×2); not traced further. statusLanes takes main's 200 ms refresh rule too (no verdict moves).

**Teams** (team-ab against 6921b3f, seeds 1001–1032; both teams have Arcane, whose combo now holds the world 9
frames): Estella's sustained DPS +0.10% full / −0.13% zero (60 s timeline +4.92% / −1.61%: one rotation's casts moved),
Typhoeus's +0.34% / −0.04% (as a bot at zero energy +4.40%; 60 s timeline −0.26% / −0.01%). Sustained numbers within
their seed spread; the owner's rules need no re-search for this. Examples snapshot moved accordingly.

**Decisions:** the reset in the engine, not a per-log fix: the data carries it, and only a replacing dilation makes
it mean anything. One priority tag per dilation recorded for every slow-down (the reset names its priority). The
views and bounds cut at resets whatever the `combo-reset` reading (they have no scenario). Lead 3 (458b) looked at,
not fixed (open-problems "Ink Melt logs").

**Dead ends:** per-cluster brackets of the hold across a stop from the ramp (a step is 1 s wide: brackets of ±1 s,
uninformative); the readings with the application as one end (they mix in the application's logged-ms errors: the
pairwise test without it separates them).

## 2026-11-23: Improvement round 6: a kit buff's clock, probes, the split

**Goal:** the sixth friction round (docs/friction/README.md) over the six open reports (round 5's backlog and its own
report, the buff clock, Artful Intent, hidden holds, the four smaller leads) and the lead's list, behaviour-preserving;
on main at 235d717. Summary: docs/friction-done/2026-11-23-round-6.md.

**Done:**
- `efsim zmdlogs clock --kit-buff owner:id [fixture…]` (packages/logs/src/clockview.ts): per instance the first
  expiry, the expiry on the replay's own clock (`hidden-holds=none`, before any shortening step), how it ended there
  and in the check's replay, the log's run and the lateness in real and world time; four agents had scripted it.
- scripts/probes/<topic>/ with an index and a rule (a scratch script a doc cites moves there in that commit); eleven
  cited probes promoted from other worktrees' scratch and run at this code; open-problems points at them.
- `node scripts/holdout-split.ts add-development <fixture>` (the development array's text alone, the parse checked,
  nothing of the hold-out list shown); 207f registered.
- World-time views (worldtime, lanes --world, cadence) on the stops of the replay's casts (query.ts `replayTimeStops`:
  db87's Laevatain ultimate placed from its cast event was missing); `measure` reads a log new since the reference
  commit from the measured tree; `zmdlogs hits --assume`; census `origin:<re>`.
- `operatorId(data, "Arcane")` (@efsim/data), `efsim find --operators`, devFixtures by name.
- The backlog: closed-by lines and a parked list (docs/friction/README.md), scripts/friction.ts `outcomes` / `carry`;
  round 5's points 1–21 parked; docs/friction/2026-11-23-backlog-after-round-6.md has 20 live points.

**Scoreboard** (`npm run snapshots:update`: no log's verdicts moved; only the groups): development 31 → 32 fights,
plain 63.2 → 62.5%, mismatch 15.4 → 15.6%, |damage| 9.1 → 9.4%; earlier pending 24 → 23 fights, 56.1 → 56.9%,
18.8 → 18.7%, 8.4 → 8.0%; verified, hold-outs and all but the hold-outs unchanged.

**Decisions:** the split edited as text, not re-serialised (a whole-file rewrite would put hold-out ids in the
diff). `zmdlogs clock` as a consumer of the replay's traces under two readings, so nothing in logBuffReplay moved
while the hidden-holds clocks agent works in it; its run() refactor, the enemy-status trace view and the Corrosion
reader left to that agent (the backlog's "Taken" section). Probes not typechecked or linted: they age, and the
README's "last run" column says when one was last seen working. Points carried through two rounds without a new
report parked rather than re-read.

**Left:** the backlog's 20 points (`zmdlogs clock` from casts and over every buff, the kit windows' instance chain,
pinned expiries, origin columns, the hold-out field count, round 5's carried views); friction report
docs/friction/2026-11-23-round-6-friction.md.

## 2026-11-23: Hold clocks: enemy statuses and Corrosion's ramp

**Goal:** more clocks for the hidden holds (docs/journal/2026-11-23-01-hidden-holds-placed-once-for-every-timer.md):
the enemy's listed statuses and Corrosion's ramp steps; Rossi's Wolven Blood clock; the last merge's combination
regressions (458b, bdf2, a7a7); d774's Sunderblade count.

**Done (open-problems "The buff clock", More clocks):**
- holds.ts `statusBounds` / `statusLanes`: each Electrification, Corrosion and Breach the replay without holds let run
  out, against the log's run of it (the enemy's side of every hit lists them, any element); from below only for a
  status a team kit consumes. The placed holds alone didn't cover d774 (0.26 s placed where its Electrification asks
  0.84 s); now 0.83 s: the first Sunderblade strike plain (12127), all eight strikes one for one with the log's.
- rampsteps.ts + `efsim zmdlogs ramp <fixture>`: each hit under Corrosion read at every step of the replay's Corrosion
  (the steps whose damage fits ±1), against the replay's own world time there; logcheck.ts `logBuffReplay` places the
  holds again with these bounds (ReplayOptions.holdBounds). db87 plain 166 → 206, mismatch 59 → 18.
- Engine: a running Corrosion's ramp stands still inside a stop (status.ts `rampElapsed`, ActiveStatus.rampHeld); it
  used to be set back by the rest of the stop at the stop's start (4d60 73.65 s: 2.6 s younger, 14.4 against 22.5).
- Scoreboard (`npm run snapshots:update`): development plain 63.2 → 65.1%, mismatch 15.4 → 15.0%, mean |damage
  error| 9.1 → 9.0%; hold-outs 70.3 → 73.5%, 6.4%, 10.8% (3 better, 0 worse, 2 mixed); earlier pending 56.1 → 56.5%,
  18.8 → 18.6%, 8.4%; verified 77.1 → 77.7% (matched 97.8 → 99.1%); all but the hold-outs 60.6 → 61.9%, 16.4 → 16.1%,
  8.1%; with round 6's groups (207f a development log) development 62.5 → 64.4%, 15.6 → 15.2%, 9.4 → 9.3%,
  earlier pending 56.9 → 57.3%. Development 13 better (5082 plain 150 → 219, mismatch 36 → 6; 7910 255 → 318; db87; f978 394 → 444), 3 worse:
  9847 (310 → 300: the ramp caps the holds Gilberta's Vulnerable run asked for, below), 4d60 (697 → 696: Liino's
  ultimate hits at 83.3–83.6 s a step behind the log's ramp, one frame of hold), fc63 (508 → 504: Arcane's 0.12 Susceptibility held past the log's end at 18.85–19.07 s by a hold the new clocks moved earlier); d572
  908 → 918, mismatch 26 → 17; d774 348 → 365, mismatch 38 → 24, its over-predicted total +24.8 → +27.2% (the
  Electrification it now keeps).
- Teams (team-ab against 235d717, seeds 1001–1032): Estella's sustained +0.00% full / +0.01% zero, as a bot +0.08%,
  her zero-energy 60 s timeline +0.07%; Typhoeus's unchanged (60 s timeline +0.00%). Five example snapshots moved
  ≤ 0.13% (Corrosion read inside stops).

**Found:** Wolven Blood has no clock of its own (no time-scale flags in its BuffData; its runs last 19.5–20.8 s of
world time); its misfits are its 16th layer, on hits the log gives no crit (489c 55.61 s; the replay reaches 16 at
59.5 s). The ramp says 9847's Gilberta Vulnerable stacks outliving 20 s aren't hidden holds (it allows ≤ 0.94 s there).
The other direction is common: 146 of 3,553 ramp readings need a hold below zero, 139 with a combo slow-down in the
window (f978, 3f78, 9c6e, a7a7, 4d60): the replay holds the ramp longer than the game across some combos. a7a7 (lead
3) is one; 458b's regression is Wulfgard's Combustion ticks, not traced; bdf2 156 → 157.

**Decisions:** a status's last listing within two frames (70 ms), not a buff run's 200 ms: no holder's hits bracket
it, and a consumed status's last listing is the consuming hit. Ramp bounds against the replay's own world time (its
Corrosion at the landing, its placed holds added back), not the placement's stops: those miss ultimates placed from
their events (db87's Laevatain, 4d60's Zhuang Fangyi), and a first version double-counted 1.5 s in db87. The run()
closure stays: the ramp pass composes outside it (one more replayKitBuffs with `holdBounds`).

**Dead ends:** reading the ramp only from the log's listed Corrosion: db87's log lists none (the replay's application
stands in). A ramp reading far from the replay's step (Arcane's seal finisher at step 2 of 10): a coincidence, now
skipped beyond one step: the ramp is read from the damage the check judges, and with three steps the
negative control found 34 chance matches of 167 in bdf2 at ×0.97 (none with one; the logs' verdicts the same).

**Left:** test 111; the combo slow-downs that over-hold the ramp; crits a buff's listed layers show (Wolven Blood); the
replay's own stops for every view and bound (friction report docs/friction/2026-11-23-hold-clocks.md).

## 2026-11-23: Si's strokes from the log: Initial Stroke at the first press, the burst's origin

**Goal:** the brief after the Yinglung's Edge hypotheses (2026-11-22): what each of Si's logged presses is and when
Artful Intent ends, then whether N2 (her first press counts for the set) follows; and whether anything in the logs or
the data marks leaving combat (N1).

**Done:** the bursts' `poise.origin` tells how each Artful Intent ended: `normal_skill_2` Final Stroke (26), the
Inksoul returning by itself at expiry `normal_skill_inkmove_2` (22), the mark's burst (`inkmark_projhit`, 26: no
Inksoul, ended at its one press 20–34 s after the hit). Initial Stroke is the first press after the battle skill; her
other presses under Artful Intent (269 of her 276 hitless events, every ~3.3 s) do nothing the log shows. Built in the
replay (2a9a267): castsFromBuffEnds infers Final Stroke only from a burst credited to it (or to nothing); pullingPresses
makes the first press Initial Stroke (ReplayedCast.as) unless the mark's burst ends that Artful Intent; the kit's
initial_stroke trigger detached (the Inksoul comes from the entity spawned at frame 0). The engine's Edge score 54 / 4 /
10 → 61 / 2 / 5 of 68 (N2 follows from the strokes). Scoreboard: development plain 59.9 → 60.1%, mismatch 16.4 →
16.2%, mean |damage error| 9.2 → 9.3%; earlier pending 53.1 → 53.2%; verified and hold-out unchanged; c83c mismatches
31 → 0, 9555 11 → 1; 7b54 damage 48.2 → 49.0% (a combo out of the Edge test, an Initial Stroke layer more). Team
numbers unchanged (team-ab against 6b117c1: every team's own fight identical), so the owner's rules need no re-search. The detached Initial Stroke broke
examples/ink-melt-zero (its second Initial Stroke at 6.67 s, after one cut by her combo at 3.8 s, now finds the
Inksoul up): that step dropped by hand (`repair --write` dropped 80 steps instead), total 2,844,498 → 2,853,256. c83c,
e989 and 0c14's mean |damage error| +0.1–0.3 points with the layers their combos imply.

**Decisions:** Final Stroke's layer stays counted as the kit has it: no log tells (always past the cap or before the
same combo). N1 not built: the set's buffs handle no battle exit in the data (ability event 7 only in six buffs, Si's
normal_skill_check among them), the layer is the caster detector's child buff but the wearer's own layers go too; the
two clear cases are the boss Si's half-HP pause (3f78, 4a64), 7b54's is ambiguous (Jade Vessel or Camille's hitless
press). Test 106 (e) now asks about that phase change.

**Dead ends / found:** a Stagger bar back to full after a pause marks nothing (every ~5 s pause refills it). 0c14
166.7 and its ×0.288 burst: a battle skill at 157.42 s whose hit the log lacks restarted the record (0.17 × the hits
from 158.76 s = the logged 90,026). Why Artful Intent without Initial Stroke lasts until a press, and what the later
presses are, stay open.
