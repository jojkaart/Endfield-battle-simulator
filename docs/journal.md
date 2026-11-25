# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 144 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-25: The remaining leads: the Empyrean's end on its frame, ultimates in turn, the touch after a reaction

**Goal:** the leads the 2026-11-24 rounds left: Zhuang Fangyi's Empyrean ending early (4bfc 179.51 s, d774 104.18 s,
4d60's holds), Typhoeus's fc63 infliction state, Arcane's last bursts (9a80, 79cc, c83c), travelling ability
entities, 7e19's ×1.096 and d4fb's Swordmancer exception, the marker clocks.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The remaining leads"):
- **The Empyrean's end is a frame boundary** (669a62e): the replay's buff ended on the event's own frame (4bfc 179.50 s;
  d774's held 0.37 s to its event by heldTicks), so the advance ticked and ended it before loggedTick looked and the
  replay made a real ultimate. buffreplay.ts endedWithTick. ExtendBuffAction as a pause ruled out (4bfc's third
  Empyrean would run 47 s, the log's 26.65 s of world time). d774 104.18 s: not the clock; the team's hits thin out
  after the third strike, as where the enemy leaves at 30.63 s (positional).
- **Ultimates pressed together play their stops in turn** (4188729, logcasts.ts inTurn, a pass after the placement):
  of 27 overlapping pairs, 12 have a hitless stretch of the first stop's length before it (fc63, 00ae, 4a64, d774, …);
  fc63's 40.80 s burst was this (Gilberta's ultimate from 39.92 s, before Perlica's), not Typhoeus.
- **fc63 85.13 s: the touch's element after a reaction opener** (45da066): the game's enemy had Nature (Typhoeus's shot
  consumed it: its burst ×1.303), the replay Pulse (the Corrosion's consumed element). Engine assumption
  `window-reaction` (`consumed` default, `applied`): fc63 plain 511 → 549, mismatch 179 → 97, but 9a80 227 → 217 and
  fc63's total 3.4 → 5.3%; not the default; in-game test 33 updated.
- **Ruled out:** Imprisonment's enemy slow-down for the late bursts (45 of 50 touch-caused bursts on time); a `travels`
  field for Tangtang's stare and Arclight's dash (no movement in the data; marked, no log moves); Pogranichnik's
  layers for 7e19 (teammates fit with two under the same listing). Open: 9a80 35.05 s, 79cc 24.23 s (a frame around
  Arcane's reset), d4fb 97.05 s, 4d60's holds, the marker clocks (no log decides them; not reached).
- `--trace-buff status:infliction`; scripts/probes/placement/ult-overlap.ts.

**Scoreboard** (`npm run snapshots:update`): verified plain 78.2 → 78.0% (40d9 51 → 49: two hits assumed near the
moved stop); development plain 67.9 → 68.1%, mismatch 11.5 → 11.6%, mean |damage error| 7.0%; hold-out plain 78.5 →
78.7%, mismatch 5.9%, 8.5 → 8.6% (1 mixed, none worse); earlier pending plain 64.6 → 64.7%, 4.2 → 4.1%. Better: 00ae
607 → 687, 9090 995 → 1027, 1d91, 7910, c4f3, 4bfc, d774; **worse:** 489c plain 591 → 488 (its total −1.9 → −0.3%:
the hidden holds re-placed after the in-turn move, its Corrosion readings), 3f78's total −4.8 → −5.6%. Teams
(team-ab against eec0473): every team's fight the same.

**Decisions:** in-turn kept with 489c worse: the stop is where the log is quiet (Arcane's attack 4 split by it), and
the loss is the hold placement's response (friction report point 1); in-turn as a pass after the placement, not in
placeWith (inside it, 4360 and 9c6e cascaded); `window-reaction` registered, not switched, on one log each way.

**Problems:** the container restarted mid-round (nothing lost: committed before the long runs).

## 2026-11-24: Cooldown clocks from the data, Arcane's burst held by her own ultimate, every finisher hit Staggered

**Goal:** the kit-buff and placement rounds' four leads: a per-trigger cooldown clock, a kit field for travelling
landings, Arcane's bursts in the replay, Ember's finisher in 7e19.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The cooldown-clock round"):
- **KitTrigger.cooldownClock from the data.** The game has CD timers (AddGlobalCDTimer, or a `…_cd` buff) and timed
  markers (CreateTimedMarker); the compiler (kits.ts cooldownClockOf, skillData.ts cooldownTimers) matches each
  trigger's cooldown key to them: CD timers world (Swordmancer, Mi Fu's P3, Antal's heal, three claymores,
  suit_spellburst; Laevatain's absorb written by hand), markers raw (Glorious Memory, Sundering Steel, Xaihi's crystal,
  19 more). `trigger-cooldowns` now `kit` / `raw` / `world`; world cooldowns move with every world shift (stops,
  resets, hidden holds) and a start inside a stop is held by its rest. The two hold-outs' worse totals are Swordmancer's
  (a measure with only it on the world's clock moves both): replay-only 4.9 → 4.8%, log-only unchanged, so its dropped
  procs were ones the game didn't deal. No development log decides a marker's clock.
- **Arcane's bursts: her own ultimate's stop holds them** (`burst-stops` `all`). b7b3's touch at 4.95 s burst in the
  replay at 5.97 s inside her stop; the log's at 10.34 s. Her 130 bursts: within 150 ms 89 → 94, none 23 → 20,
  replay-only 24 → 21 (scripts/probes/bursts/arcane-bursts.ts). The element at her touch (test 33) explains none of
  the leads' cases.
- **Every finisher hit deals as on a Staggered enemy** (`finisher-stagger` `cast`): 7e19's hit_2 after Chen's stop read
  ×1.564 = ×1.43 × ×1.096, Chen's hit at that ms unstaggered; the only such finisher in the logs. 7e19 −4.9 → −1.1%.
- **KitHit.travels** (the compiler, from LaunchProjectile) reproduces the event rule for every projectile ultimate,
  with or without its contradiction check, but not the ability entities it also takes (Tangtang's stare: b7b3 47 → 45
  plain from its frame), so the rule keeps its check for them and skips it for travelling landings (placements as
  before; the dropped variant in docs/tried/2026-11-24-travelling-landings-only.diff).
- 4bfc 179.51 s (the lead's question): Empyrean's end by the log (Arclight's chain unbroken), the replay's empyrean
  buff ended early; not fixed.

**Scoreboard** (`npm run snapshots:update`): verified plain 77.9 → 78.2% (b7b3 44 → 47); development plain 67.8 →
67.9%, mismatch 11.5%, mean |damage error| 6.9 → 7.0%; hold-out 78.5%, 5.9%, 8.5% (2 better, 2 worse by totals:
Swordmancer, 1 other); earlier pending plain 64.6%, mismatch 13.9%, 4.3 → 4.2%. Worse: 6339 37.5 → 40.8% (its
finisher's replay-only hit_2 now Staggered), 79cc one plain (Ardelia's combo placed late from its projectile holds a
burst), 012a 0.6 → 0.7% (a burst matched as assumed). Teams (team-ab against e3272c6): Estella–Si–Akekuri–Arcane full
+0.01% sustained (60 s timeline +0.08%), zero +0.02%; Typhoeus–Arcane–Liino–Perlica sustained unchanged, its full 60 s
timeline −0.51%.

**Decisions:** the clock from the game's mechanism, not per kit, the explicit field only where the trigger reaches no
source (refused where the data says it); `burst-stops` `ultimates` measured and kept as a reading (combo slow-downs do
hold bursts: e82d, c6d8, four hold-outs worse).

**Dead ends:** the travelling field alone as the event rule (above).

## 2026-11-24: Improvement round 11: measure --split, zmdlogs bursts, the views' stops without the replay's ticks

**Goal:** the owner's friction workflow, round 11: the five open reports (round 10's backlog and own report, the
misprediction candidates, the kit buff leads, the placement leads), tools only, beside an accuracy agent in the kit
compiler, kits, engine, placement, replay and check core; no verdict may move.

**Done** (docs/friction-done/2026-11-24-round-11.md has the list by cause; the backlog,
docs/friction/2026-11-24-backlog-after-round-11.md, the rest):
- `npm run measure -- --split files [--group a,b]` / `--split commits --base <ref>`: each part of a change measured on
  the logs the whole moved; the summary's reference line; `--variant` also against the plain tree. On the placement
  leads' range: 1cd1 and af7b by 00876b1, 4d60 by the merge that brought the Empyrean's end in.
- `efsim zmdlogs bursts` (each Arts Burst logged against replayed, each side's likely cause, the stops between).
- query.ts castEventPlace in `instances` and `replay`'s EVENT lines (at its press, at its stop's end, …; the log time
  beside the world time); docs/design/data.md's paragraph.
- replayTimeStops `tickRead`: with the replay, the views leave out a hitless event the replay read as a buff's tick,
  as the hold placement does (`zmdlogs stops --all --differ` list only 2 → 0, nothing else moved); the EVENT line
  says when the replay made a cast its key reads as a tick (3aa6).
- The likely-loggedAs screen (loggedas.ts: `zmdlogs differences`, the pending suite); HitRecord.counterfactuals (build.ts
  calls it); analyze.py in numpy (6+ min → 67 s), its buffs section's top-fight and top-hit shares, equipment names,
  NOT_KIT fights, `analyze.py buff`.
- `friction.ts outcomes --backlog`, edit.ts's marker messages, CLAUDE.md and docs/design/tests.md notes.

**Scoreboard:** unchanged (`npm run snapshots:update`: "No log's verdicts moved"); no engine or kit change, so no
team-ab.

**Decisions:** the views' tick filter takes the replay's applied stops rather than every hitless event of a tick skill:
the first version, without the replay, dropped 3aa6's seven real Zhuang Fangyi ultimates (cli-ab showed eleven new
"timeline only" lines); the exact list from the replay itself is buffreplay.ts's (backlog point 6). The bursts' causes
are a search (the replay records neither inflictions nor a burst's source): said in the view's header, the record in
the backlog (point 13).

**Problems:** the loggedAs screen finds no pair in the development logs now (the candidates' fixes took them), so its
test is on a real listing with a made-up kit modifier; the pending suite guards the rest.

## 2026-11-24: Placement leads: ultimates from their cast events, Chen's stew, trigger cooldowns on the world's clock

**Goal:** the misprediction rounds' placement and timing leads: Liino's ultimate windows (1cd1, af7b; 1d91, 9c6e),
7e19's Chen ×1.15 and Ember −21.5%, what 0c14 / 4e36 / de6a have left, then the one-sided landings' largest kinds.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The placement leads"):
- **Liino's windows were her travelling projectiles.** Pyrotechnics (frame 76, `detached`) land 0.1–0.8 s of the
  world's time after their frame, so the cast placed from them came late: its stop over teammates' logged hits, its
  Amp (frame 77) after hits the log has under it. An ultimate's cast event sits at an edge of its stop, the end for
  most operators (scripts/probes/placement/ult-events.ts: Si 26 of 35, Liino 13 of 21, Laevatain 11 of 16). logcasts.ts
  eventStopStart: an ultimate whose first landing is on its way (detached, or Ardelia's sheep's random count) and whose
  frame-placed stop covers a teammate's logged hit starts from such an event (1cd1 −7.5 → −3.5%, af7b, 1d91, 9c6e,
  5082, 7910's Ardelia, 3aa6's Arclight).
- **7e19's Chen: Ginseng Meat Stew** (buildOverrides; fit-build 17 of 19), after ruling out P1 (×1.15 from 99.9% HP in
  a Max-HP fight; P1 would be ×1.185) and listing differences; the Endministrator has the same stew by hand. Ember's
  −21.5% is her finisher's second hit with the Staggered parts after the log's Stagger ended: open.
- **Swordmancer's cooldown is on the world's clock** (engine assumption `trigger-cooldowns`, reading `world`; the
  default stays `raw`): its replay-only procs are the largest "no cast" kind (scripts/probes/cooldowns/physuit.ts:
  every miss under 15 s of world time, every proc past it); Mi Fu's P3 in 2fd9 too. `world` for every trigger moved
  four kit tests' fights (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel, chen-solo) and two
  hold-outs' totals for the worse: not every trigger cooldown is a CD timer. Next a kit field for the clock.
- **The hold placement** leaves out cast events the replay read as ticks (the kit-buff round's Empyrean end in 4d60).

**Scoreboard** (`npm run snapshots:update`, against main at ca5b566): development plain 67.7 → 67.8%, matched 83.8 →
83.9%, mismatch 11.6 → 11.5%, mean |damage error| 7.0 → 6.9%, within 5% 25 → 26; hold-out plain 78.4 → 78.5%,
mismatch 5.9%, mean |damage error| 8.5% (1 better, 1 worse by one plain hit now assumed, 1 other); earlier pending
plain 64.4 → 64.6%, mismatch 14.1 → 13.9%, 4.4 → 4.3%, within 5% 18 → 19; all but the hold-outs 5.5 → 5.4%. Better:
1cd1 −7.5 → −3.5%, af7b plain 588 → 599, 5082 +2.3 → −0.1%, 8915, 7e19 plain 66 → 85 (−6.6 → −4.9%); mixed, per hit
closer: 1d91, 9c6e; worse: 7910 (−5.8 → −6.1%: Corrosion readings ±2% as the placed holds moved with Ardelia's stop,
whose press at 55.12 s the log shows), 9090 (Perlica's Electrification 0.1 s short at 64.40 s), 3aa6 (one plain).
Teams (team-ab against c6f1874): every team's fight the same.

**Decisions:** the event rule only where the frame's stop contradicts the log (Si's ability-entity slashes placed well
from their frames: b6aa's ready-buff order says the event there was the press), at least 150 ms earlier, a first song
beat within that keeping its start (d9e5: a frame's move shifted Corrosion's ramp); the cooldown clock left at `raw`
(smoke failed under `world`: kit tests encode other triggers' raw cooldowns).

**Dead ends:** the event rule for every detached ultimate (Si's moved 1.6–2.1 s in 4a64 and b6aa, worse); P1 on
Chen's own HP (d4fb switches at 0.499 of the enemy's).

## 2026-11-24: Kit buff leads: Zhuang Fangyi's Empyrean end, the rest not kit values

**Goal:** the misprediction analysis's largest one-buff leads (its "one kit buff the replay has wrong, the listing
right" class, ~20% of the off error): Arcane's weapon, Will burst and Susceptibility buffs, Gilberta's weapon, Zhuang
Fangyi's weapon and Sunderblades, Typhoeus's Hovering ATK, then the list; fix or rule out each, double counts first.

**Done** (open-problems "Misprediction statistics", "The kit buff leads"; tables rebuilt with build.ts at c6f1874,
per buff the new scripts/probes/stats/onebuff.py; no double count among them, doublecount.py's pairs unchanged):
- **Fixed: Zhuang Fangyi's Lone Barge ultimate buff (1.0%).** The log's `ultimate_skill` events 30–35 s after an
  ultimate's are the Empyrean's end (ult_end casts ultimate_skill_end): no time stop follows, her next hits are her
  plain forms, Lone Barge's buff isn't listed after them (4 of 4; the 9 real casts list it;
  scripts/probes/kits/zhuangfy-empyrean-end.ts). The replay made each a press (a 78-frame stop, the buff 25 s more).
  The empyrean buff now ticks once at its end, logged as the ultimate (`every`, `ticksLoggedAs`, `endFollowsTick`: no
  code change). Test: tests/slow/log-cases.test.ts (4bfc).
- **Ruled out as kit leads:** Arcane's Susceptibility layers (one e82d hit read two ways is 88% of it); "Arcane's weapon
  Arts DMG Taken" (Detonation Unit, 96% of it 9c6e's second target); Arcane's Will burst buff (it starts at her logged
  burst in 90 of 91 runs, scripts/probes/kits/arcane-will-burst.ts: its error is her bursts', replay-only after her
  touch or ultimate or seconds early across stops); Gilberta's weapon (4a64's instance lasts 16.5 s of world time where
  two ultimates' stops overlap 1.5 s in the placement); Typhoeus's Hovering ATK (the 5th shot's burst, and a floating
  start pressed inside her combo's frames 0.14–0.18 s before the replay's, scripts/probes/kits/typhoeus-press.ts);
  Xaihi's Crystal Amp (Max HP, not simulated); Laevatain's Scorching Heart (a Melting Flame refresh the replay lacks).

**Scoreboard** (`npm run snapshots:update`): development plain 67.8 → 67.7%, mismatch 11.5 → 11.6%, mean |damage
error| 7.0%; hold-out plain 78.3 → 78.4%, 5.9%, 8.5% (1 better); earlier pending plain 64.2 → 64.4%, mismatch 14.2 →
14.1%, 4.4%; all but the hold-outs 5.5%. 4bfc mixed, per hit closer (plain 795 → 819, mismatch 29 → 15, total 0.3 →
−0.8%); **4d60 worse** (plain 707 → 696, −1.8 → −4.1%): the phantom stop held Arcane's Solemn Phalanx runs, Perlica's
weapon and a Sunderblade 2.6 s that the game holds 3.6–6.1 s by something unlogged around 98–143 s (those hold bounds
dropped). Teams (team-ab against c6f1874): every team's fight the same (no team has Zhuang Fangyi).

**Decisions:** kept the Empyrean fix with 4d60 worse: the mechanism is decided by the log (no stop, plain forms, no
buff after the event, 4 of 4), and 4d60's loss is an unexplained hold the phantom stop happened to cover. The hold
placement still counts the phantom stop (buffreplay.ts replayedCastStops, the other agent's file): in the friction
report, not changed.

**Left:** 4d60's 3.6–6.1 s of unlogged holds (its Stagger window takes none); Arcane's bursts (test 33's element, the
burst's clock across her own ultimate's stop); Zhuang Fangyi's d774 104.18 s Empyrean battle skill (3 logged hits, no
final, the replay 8 and the final).

## 2026-11-24: Misprediction candidates: logged-as buffs, the enemy's HP, Ardelia's chain

**Goal:** work through the misprediction analysis's candidates (docs/analysis/2026-11-24-misprediction-stats.md): the
weapon "ready" buffs, the rest of the ×1.5 band, the fight-wide factors below the offsets screen, then the one-buff
list's largest; root cause and fix, or ruled out with why.

**Done** (the analysis's follow-up section; open-problems "Misprediction statistics"):
- **The "ready" buffs were a double count.** The consuming cast's hits list the attached buff with the modifier
  (`_valid`), not the kit buff's modifier-less gameBuff (`_exist`): the check added both (59 hits in 0c14, 7e19, d4fb,
  a27b). `loggedAs` on Grand Vision's and Glorious Memory's buffs, Aspirant's, Cohesive Traction's, and Yvonne's ultimate
  states (P5 child, 5082's 72 hits; found by scripts/probes/stats/doublecount.py).
- **The enemy's HP from a kill's total, in lives** (engine assumption `enemy-hp`, buffreplay.ts loggedEnemyHp): the
  replay had an HP only when the total was the data's Max HP. Chen Qianyu's P1 below half (d4fb ×1.16 below, ×1.00
  above; in-game test 69 decided from a27b) and Alesh's P5 ultimate (×1.5 below half: a9d7 6 of 6 over Si's two lives).
- **Ardelia's ×1.5 basic attacks were placements:** attacks 1 and 2 share a key; after attack 3 and a combo the
  placement took an older attack 1's window (logcasts.ts choose: the latest basic cast says the step).
- **Si's Amp in 9c0b:** her ultimate pressed before the log's first hit, skipped for energy the log can't show; made now.
- **Ruled out:** Liino's 7910 / af7b factors as builds (fit-build fits her clean hits as exported; the screen is right).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1 → 67.8%, matched 83.5 → 83.9%, mismatch 11.6 →
11.5%, mean |damage error| 7.2 → 7.0%; hold-out plain 77.6 → 78.3%, mismatch 6.2 → 5.9%, mean |damage error| 8.0 →
8.5% (2 better, 4 mixed, per hit closer; the total that moved most came with the "ready" fix, which exposed an
under-prediction the double count hid, as in 7e19); earlier pending plain 63.7 → 64.2%, 4.5 → 4.4%; all but the
hold-outs 5.7 → 5.5%. Better: d4fb +9.6 → +0.5% (plain 465 → 516), 9c0b −4.9 → +3.0% (367 → 410), a9d7 −5.0 →
−1.8%, c4f3 −5.0 → −3.1% (214 → 242), 5082, a27b. Totals worse with per-hit closer: 7e19 +2.0 → −6.6% (the
Endministrator +21.9 → +2.3% exposed Ember's −21.5% and Chen's ×1.15), 0c14 −3.5 → −4.9%, 4e36 and de6a (matched
closer, replay-only landings left). Teams (team-ab against a4f6ddb): every team's fight the same (the log check's changes only).

**Decisions:** the HP rule behind an assumption (the stage pools are a kill's total, not seen in any data file); lives
only where an away stretch starts at a multiple of Max HP (Si's eight fights all show it). The pre-log ultimate rule
only before the first hit: every unseen ultimate made regardless made 1cd1 −19.5% (docs/tried/).

**Left:** Liino's ultimate Amp starts later in the replay than in the game (1cd1, af7b: the replay's stop of her
ultimate covers teammates' logged hits); 7e19's Chen ×1.15; the one-buff list's rest.

## 2026-11-24: Improvement round 10: no shell programming, printers that say what they leave out, rows cached

**Goal:** the five open friction reports (round 9's backlog and own report, the one-sided landings, the physical
statuses, the misprediction statistics), tools only, beside an accuracy agent in the kits, fixtures, snapshots and
engine kit code; and the lead's item from the owner: no real shell programming left in the repository. Summary:
docs/friction-done/2026-11-24-round-10.md; backlog: docs/friction/2026-11-24-backlog-after-round-10.md.

**Done:**
- **The shell scripts in TypeScript.** scripts/done-line.ts (`doneJob`), scripts/premerge.ts (preconditions, steps,
  accuracy compare, done line), scripts/snapshots.ts, scripts/fetch-data.ts (CI's cache key too),
  scripts/session-start.ts; premerge.sh and the session hook are one `exec node` line each, and a test holds every
  tracked .sh to that. snapshots:update now also runs the tests that read a changed log's fixture.
- **Printers that say what they leave out.** `efsim kit`: each skill's paths (ends, jumps, the triggers' jumps on it)
  and every trigger's actions; `gamedata tree --path` and "presentation only" for a branch that only plays an effect
  (Empyrean's free-path branches: so not 4d60's Sunderblades); efsim names every option given but never read; `zmdlogs
  hits --from/--to`.
- **Rows cached and shared.** `zmdlogs totals --all --json` (every one-sided landing, cached); the hit and totals caches
  read from the main checkout's and other worktrees' at the same code key. HitRecord.graded. The offsets screen shows
  the check's ATK explanation. measure refuses a `--patch` the tree already has; `at-commit --run`.

**Scoreboard:** unchanged (snapshots:update, itself the new script: "No log's verdicts moved"; every file
byte-identical): development plain 67.1%, mismatch 11.6%, mean |damage error| 7.2%; hold-out 77.6%, 6.2%, 8.0%.

**Decisions:** premerge's vitest steps run under the lock as `testlock.ts` children, so a signal to premerge stops
them and frees the ticket (a spawnSync couldn't be interrupted; the synchronous runLocked is gone). A signal waits up
to 5 s for the running step before the cleanups, so snapshots puts its files back after vitest stopped writing. The
.sh wrappers use `exec` so a signal reaches node. The unread-option check warns (stderr, after the output) rather
than refuses: a spread of the values counts as reading all, so it can miss one but never names a wrong one. Round 9's
backlog points 2 and 3 parked after their second carry; the rest is the backlog's seven points.

## 2026-11-24: Misprediction statistics across the logs; Zhuang Fangyi's Empyrean combo key

**Goal:** the owner's ask: one statistical pass over every log's mispredictions (not one log or operator at a time),
ranking candidate causes that could each explain a large share; analysis, not fixes, but for a certain one.

**Done:** scripts/probes/stats/: build.ts (every development log's hits with the check's verdicts, readings, zones,
differences, features, and counterfactual readings: each listing difference taken the log's way, the crit flipped,
boundary kit buffs on and off; one-sided landings; fights), analyze.py (first explanations, ratio clusters, buffs by
mechanism, features with fight bootstraps and within-fight shuffles, a tree and lasso held out by fight group,
one-sided kinds, fight-level features), bands.py, holdout-aggregates.ts (aggregates only). The write-up:
docs/analysis/2026-11-24-misprediction-stats.md; open-problems "Misprediction statistics".
- Stage logs aside, the off hits' error is one kit buff the replay has wrong at the hit (the listing right) 20.4%,
  alternatives or the listing with alternatives 30.2%, Corrosion 8.5%, unexplained 35.1% (in known fight-operators).
- **Fixed:** Zhuang Fangyi's Empyrean combo is logged under the base combo's key (Stagger origin combo_skill_ult):
  21 hits ×1.500 = 5.4 / 3.6, 4.3% of the error, the largest single cause. The kit's Empyrean combo hit carries the
  base key now.
- Leads: two weapons' "ready" buffs on ultimates (2.8%, 6 fights), the rest of the ×1.5 band (Liino's ultimate
  windows, Alesh's ultimate; 6.9% of the hold-outs' error), boundary effects as a marker of state changes (off 42.8%
  against 24.2%, explaining 1.8% themselves), a weak drift with time (34 of 57 fights), Liino's factors in 7910, af7b.

**Scoreboard** (`npm run snapshots:update`, the kit fix): development plain 67.1%, mismatch 11.7 → 11.6%, mean
|damage error| 7.3 → 7.2%; hold-out 77.6%, 6.2%, 8.2 → 8.0% (1 better); earlier pending plain 63.6 → 63.7%, mismatch
14.5 → 14.3%, 4.3 → 4.5%, within 5% 19 → 18 (3aa6, 4bfc better; d774 +3.8 → +7.2% and c6d8 mixed, per hit closer:
the combos' ×1.5 hid d774's replay-only Empyrean strikes); all but the hold-outs 5.6 → 5.7%. Teams (team-ab against
e5f22ef): every team's fight the same.

**Decisions:** the analysis at e5f22ef's code (the tables built in an at-commit tree), the hold-out confirmation after
the fix; grading a crit-less hit on the nearer of its two crits, a capped hit on its uncapped value; the off rate
beside the error share, since the error favours big hits; the stage logs left out of the attribution.

**Dead ends:** the error-weighted feature shares alone (Stagger, ultimates, the fight's last tenth) looked like
causes and were mostly hit size; the tree screen finds nothing that generalizes across fight groups.

## 2026-11-23: Fight totals 4: whose Shatter, Snowshine's counter, Rossi's borrowed crits

**Goal:** the hold-outs' log-only physical status hits (2.08% of a fight none within 5 s, 0.45% by another operator),
Rossi's replay-only Seething Blood extras, Zhuang Fangyi's Sunderblade count in 4d60 (docs/open-problems.md "Fight
totals", round 4).

**Done** (items 13–15 there):
- **Whose Shatter.** A Vulnerable stack joining a running Vulnerable shatters as the operator's who started it
  (BuffData: buff_physical_no_guard's on-stack handler takes the buff's source; 04d4: Catcher's Knock Downs on Ember's
  Vulnerable logged as Ember's Shatters at her value). status.ts `vulnerable.by`.
- **Snowshine's counter.** An end that would drop a pinned landing wasn't reached: the kit trigger's jump past it was
  taken (drivers.ts `eventJumps`; her bash at frame 125 behind an `attacked` jump the replay can't see). 04d4's six
  dropped bashes, their Solidification and four Shatters; 2fd9 −15.6 → −3.6% (plain 188 → 246).
- **Rossi's crits.** A pinned landing took a same-ms sibling's logged crit (landing.ts `loggedCritAt`: its own hit's
  or none); valueCrits read a Stagger's start as a crit (values over their listed effects now). Her replay-only extras
  in 3f78 1.36 → 0.24% of the fight.
- docs/tried/ gets its first file: the casts' order for same-ms hits of two operators (Estella before Chen Qianyu in
  three fights), mixed (4bfc −14 plain).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1%, mismatch 11.7%, mean |damage error| 7.2 → 7.3%;
hold-out plain 77.5 → 77.6%, 8.2% (2 better, 1 mixed, none worse; replay-only 5.2 → 4.9%, log-only 5.3 → 4.9%);
earlier pending plain 63.0 → 63.6%, 4.8 → 4.3%, within 5% 18 → 19; all but the hold-outs 5.8 → 5.6%. Worse: 3f78
−3.4 → −4.8%, 207f −1.2 → −2.9%, 489c −1.2 → −1.9%, 99fb −2.5 → −2.9%: the wrong extras and crits hid Rossi's matched
under-prediction (3f78: −6.6% over 140 matched landings); 04d4 −1.8 → +2.4% (plain 180 → 185) shows Catcher's open
×2.1 build offset the missing Shatters hid.

**Decisions:** Shatter credit as a rule, not an assumption: the data says it and three log cases do, none against
among 42 logged Shatters. The same-ms order dropped rather than limited further: the logs' simultaneous hits are mostly
a stop's end's batch, where no order is shown.

**Left:** the hold-outs' physical misses didn't move (2.08%): not the development logs' mechanisms; next a split by
status kind in measure. Rossi's slash2 extras where her bleed's last tick falls at the slash (bleed clock). Zhuang
Fangyi's 4d60 Empyrean cast: 6 blades where the log has 8, the four counts before all right (the free path's data
next). Slots by value within a cast not started (9a80 checked: the logged final placed on slash #9 by turn order,
one slash fewer in the log).

**Problems:** one multi-line `python3 -c` and one empty heredoc typed from habit (friction report);
`measure --patch` applies to the queued tree, not HEAD, so an "all but one change" patch needs `--at <base>`.

## 2026-11-23: Improvement round 9: the offsets screen, text-edit guards, measure's kinds

**Goal:** the five open friction reports (round 8's backlog and own report, the stop lists, both fight-totals rounds),
tools only, while another agent worked on one-sided landings in logcasts.ts, buffreplay.ts, replayrecord.ts and
fightTotals. Summary: docs/friction-done/2026-11-23-round-9.md; backlog: docs/friction/2026-11-23-backlog-after-round-9.md.

**Done:**
- **Build offsets screened.** `efsim zmdlogs offsets --all` (buildoffsets.ts: per log and operator the median of
  logged ÷ primary over non-crit kit hits, tight within 1%); the verified and pending suites fail on a candidate no
  buildOverride or OFFSETS_EXPLAINED entry accounts for. Today 6: three stage logs, Purrchena's level 1 (99fb),
  Catcher's weapon (04d4), and a new lead, Snowshine in 04d4 ×0.962 (fit-build undecided).
- **The shell's text damage, mechanically.** scripts/edit.ts (exact replacements from an edits file written with the
  Write tool); the damage's shapes in a doc fail `npm test`; scripts/bash-guard.ts refuses a heredoc, a multi-line or
  backticked inline script, a multi-line `git commit -m` and a live backtick, as a PreToolUse hook for the owner to
  wire (the summary has the settings line).
- **Measure says what moved:** an "other" log's field kinds, the hold-outs' by kind and their operators as counts,
  `--hits`' moved hidden-hold units, `--logs` by prefix. Shares (matched, replay-only, log-only) in every snapshot
  entry and a scoreboard table, the hold-outs' included. `zmdlogs stops --all --differ`. SkillTiming.slowdowns `n`.
  with-lock's done line on stderr. docs/tried/ for dropped diffs.

**Scoreboard:** unchanged (snapshots:update "No log's verdicts moved"; the files changed by the share keys only):
development plain 67.1%, mismatch 11.7%, mean |damage error| 7.3%; hold-out 77.5%, 6.2%, 9.1%; the new table: the
hold-outs' |matched| 2.5% against replay-only 7.1% and log-only 6.2%, 11 of 13 one-sided.

**Decisions:** the offsets screen is a second function beside logcheck.ts's buildOffsets (that one explains with
0.3% spread in `check`; this one screens all fight). Share keys aren't verdicts: `direction` leaves them out, so
their arrival moved no log. Moved hold-outs' operators printed as counts (the lead may drop that). Not done: the
dilation index through the stop lists and the record (the other agent's files), a kit form naming the engine's hold
(an engine timing change), the twins test (the other agent's subject).

**Problems:** this round's own agent typed a multi-line `git commit -m` with escaped code spans after building the
guard (intact by luck): the reason the hook, not prose, is the answer.
