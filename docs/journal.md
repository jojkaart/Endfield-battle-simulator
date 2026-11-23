# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 134 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-23: Fight totals 3: the one-sided landings by kind, Sunderblade variants, Si's burst paths, the Barrage Array's pace

**Goal:** the totals' error is mostly one-sided (12 of 13 hold-outs: replay-only 7.3%, log-only 6.2%, |matched|
2.5%): classify every one-sided landing by kind, rank the kinds, fix the largest shared ones.

**Done** (docs/open-problems.md "Fight totals", round 3, items 10–12):
- **The view.** packages/logs/src/onesided.ts: each replay-only landing and log-only hit by where it sits (twin like /
  other: an opposite-side landing of its operator within 1.5 s; unread; twin uncounted; its cast's logged landings:
  no cast, cast unlogged / tail / head / gap; the replay's reason for no landing, a status's split by dealt within 5 s,
  by another operator, not at all), nature, skill kind and flags (stop, cut, next cast, end, away).
  `efsim zmdlogs totals <fx> --kinds`, `totals --all --kinds` (per group, then by operator and key); measure's summary
  "One-sided landings by kind" (each group's means, the hold-outs' only view, never a log, operator or key).
- **Zhuang Fangyi's Sunderblade variants in turn.** Another variant's hits were slot alternatives only at a slot's
  frame, which an 8-blade cast's never are: nothing pinned, strikes matched by time, a final for a strike (3aa6 87.5 s).
  Now a variant's n-th landing is the slot's n-th turn at its own frame (logcasts.ts `Slot.at`).
- **A trigger's alternative paths, one landing.** Si's Artful Intent burst through the Inksoul or as the mark (and
  Typhoeus's arrow rain sub1 / sub2, Last Rite's phantom): a logged hit of one path takes the replay's landing of the
  other (buffreplay.ts `alternativeEvents`), a recorded burst within 60 frames (c779, 4e36).
- **A detached series at its own pace.** Typhoeus's Barrage Array's 18th tick, after her own ultimate's stop, was a
  combo of its own whose hovering conversion gave three Hunting Arrows (fc63 95.1, 96.5 s power shots the log hasn't):
  the next slot's landing within the slots' gap of the last one's is the same cast's (`paced`).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1%, matched 83.4%, mismatch 11.7%, mean |damage
error| 7.3 → 7.2%, within 5% 24 → 25; hold-out 77.5%, 91.8 → 91.9%, 6.2%, 9.1 → 8.2% (1 better, 1 mixed, 2 other);
earlier pending 62.7 → 63.0%, 84.9 → 85.2%, 14.8 → 14.5%, 4.9 → 4.8%; verified unchanged; all but the hold-outs 5.9 →
5.8%, within 5% 48 → 49. Better: fc63 +6.8 → +3.3%, 3aa6 −2.1 → −1.6% (plain 380 → 394), 4d60, c6d8; mixed, closer per
hit: 4bfc −1.6 → −1.7% (plain 773 → 787), d774 +3.7 → +3.8% (plain 365 → 372; the 0.1 pt not looked into);
other: 04d4 (a Purrchena hit fallback → assumed), 4e36 (Si's per-operator total 1.9 → 1.6%). The one-sided gross
(development, earlier, verified, the stage logs and 9c6e aside) 4.70 → 4.15% of a fight before the Barrage Array fix.

**Decisions:** the classification lives in fightTotals' result (TotalsComparison.oneSided), so the totals and the kinds
can't disagree; the hold-outs' kinds only as group means in measure. No engine or kit change (team-ab not needed).
Value-aware slots within a cast (9a80's Si combo final placed on a slash: 6.6%) measured as a scratch count first
(scratch/misslot.ts: mean 0.18% of a fight), not built: one fight carries most of it.

**Left:** cast tails (development 1.9%, hold-outs 2.3%: basic attacks cut by inputs the log doesn't show, a few big
ones), Zhuang Fangyi's Sunderblade count in 4d60, the hold-outs' log-only physical status hits (2.45%), Rossi's
Seething Blood extras, Typhoeus's 5th-shot Hovering ATK (narrowed: no snapshot, the hover's end varies 0.52–0.71 s).

**Problems:** two multi-line `python3 -c` and two heredocs typed from habit (friction report); `zmdlogs totals --all`
can't show one fight's kinds, so the analysis needed a JSONL dump script (scratch/onesided-dump.ts).

## 2026-11-23: Fight totals 2: an all-fights view, kills from capped hits, missing foods, Typhoeus's shots

**Goal:** the previous round's leads on the fight totals: an all-fights view first, then 4360's kill, fc63's bursts,
3f78's Rossi ultimate slots, a9d7's fight-wide factor.

**Done** (docs/open-problems.md "Fight totals", items 6–9):
- **The view.** `efsim zmdlogs totals --all [--workers n]` (or several fixtures): every fight's error as matched,
  replay-only and log-only shares of its logged total (enginecheck.ts `totalsShares`), largest first, the operators
  carrying it and each group's means; `zmdlogs totals <fx> --by event`. measure's summary gives the same means per
  group, the hold-outs' only view: 12 of 13 hold-outs are one-sided (replay-only 7.3%, log-only 6.2%, |matched| 2.5%).
- **Build offsets.** a9d7's "fight-wide factor" was its team's food (Jakub's Legacy; no log against Si's boss lists
  food, and this one alone had none by hand): fit-build, fixture `buildOverrides`. A screen of every log's per-operator
  median (scratch) found six more: d9e5 every operator's food, 012a, 92b4, c3c7, ad7f, d4fb a node count or weapon
  level, each confirmed by fit-build with its clean hits.
- **Kills.** A capped last hit makes a fight a kill (the stages scale the data's HP), and the killing frame is the
  replay's landing of a killing hit when sooner (4360's returning lances +6.5%).
- **Placement.** An ultimate's fewer landings take their slots by time (3f78: Rossi's slashes); an off-field-only hit
  isn't placed while the log shows its operator controlled, and a cast with a delayed landing logged isn't joined by an
  earlier frame's landing (Typhoeus's 4th shot read as her 5th in seven logs).

**Scoreboard** (`npm run snapshots:update`): development plain 66.4 → 67.1%, matched 80.7 → 83.4%, mismatch 14.4 →
11.7%, mean |damage error| 8.1 → 7.3%, within 5% 21 → 24; hold-out 77.5%, 91.8%, 6.3 → 6.2%, 9.1% (2 better, 1 mixed);
earlier pending 60.4 → 62.7%, 81.7 → 84.9%, 17.7 → 14.8%, 5.3 → 4.9%, within 5% 17 → 18; verified 99.1 → 99.3% matched,
1.8 → 2.0%; all but the hold-outs 6.5 → 5.9%, within 5% 44 → 48. Better: a9d7 −18.5 → −5.0%, d9e5 −11.5 → +0.2%, 4360
+6.9 → +0.5%, 3f78 −8.0 → −3.4%, fc63 +7.2 → +6.8%, d4fb, 012a, c3c7, ad7f, 92b4 by plain. Worse, each explained:
2fd9 −13.1 → −15.6% (replay-only landings at the kill's frame had hidden Mi Fu's Crush ×1.90), dbae −2.3 → −2.6%
(the kill likewise), bdf2 −0.1 → −0.7% and 9090 −0.6 → −0.9% (the 5th shot's burst now placed right, without the
Hovering ATK the log gives it: open).

**Decisions:** build offsets as fixture overrides only with fit-build's clean-hit counts (Chen in a9d7 has no clean
hit: her teammates' food, said so). Hold-out aggregates only in measure (the CLI keeps refusing hold-outs). No engine
or kit change: no team fight moves, so no team-ab.

**Left:** the hold-outs' one-sided landings; 2fd9's Crush stacks; fc63's arrows after the hovering ultimate; the 5th
shot's burst's Hovering ATK; Chen's readings (d4fb, a9d7); e82d's Si combo listing.

**Problems:** one multi-line `python3 -c` slipped through (friction report); with-lock's done line went into a
redirected stdout JSONL, so a wait on the stderr log would never have ended.

## 2026-11-23: Fight totals: the enemy away, the Endministrator's shatters, Hard 27's Electrification

**Goal:** the mean |damage error| of fight totals had stalled (development 8.7%, hold-out 10.2%, earlier pending 8.1%)
while per-hit matching improved. Split the largest totals into matched scale, replay-only and log-only landings and fix
what moves them.

**Found:** most large errors weren't matched scale but landings on one side only (docs/open-problems.md "Fight totals",
shares of each fight's logged total from scratch scripts over `zmdlogs totals`' parts):
- **The enemy away.** The logs' hitless gaps fall apart at 6 s; every longer one is against a boss with phases (19 in
  the 8 fights against Si: about 20–24 s, then 13–14 s, the team pressing, nothing logged). The replay kept landing
  there: d774 25.9% (Zhuang Fangyi's strikes and finales), 4a64 11.1%, 3f78 9.7%, 0c14 8.4%, 3aa6 5.6%. Engine
  assumption `enemy-away` (`away`, read only by the totals: replay-only landings more than 0.3 s inside a 6 s stretch
  without logged hits aren't counted; `counted` the old rule).
- **The Endministrator's crystal shatters.** buff_common_originum_frozen is her ultimate's third hit and her crystals'
  trigger hit; with no ultimate near, the placement chose the ultimate: 0c14 got seven ultimates the log doesn't have,
  every one at Rossi's Lift's ms (19.5%), 7e19 two (12.5%). Triggers on physical statuses are now placed from the logged
  status hits (logcasts.ts `statusHits` as `firedAt`).
- **The male Endministrator.** d4fb's hits are keyed chr_0002_endminm_* throughout, read with the female's kit: none
  landed (log-only 36%, replay-only 20%). logs.ts `withEndminVariant`; then her basics were ×0.804, basic level 9 (the
  roster gives no levels, 12 assumed): `buildOverrides` may now set skill levels.
- **Hard 27's Electrification.** All three Hard 27 logs list an Electrification (Arts DMG Taken +0.24) with no giver
  from ~20 s, the only giver-less status in the logs, no Electric operator in either team: the stage's, now read from
  the log (enginecheck.ts `stageStatus`). 207f's Rossi fire hits ×1.18 → plain.
- Smaller: no HP left for replay-only landings at a kill's frame (abfd); Si's Fixed DMG bursts are their logged hits'
  parts in `zmdlogs totals` (they showed as a replay-only landing beside a log-only hit).

**Scoreboard** (`npm run snapshots:update`): development plain 65.8 → 66.4%, matched 80.4 → 80.7%, mismatch 14.8 →
14.4%, mean |damage error| 8.7 → 8.1%, within 5% 20 → 21; hold-out 77.3 → 77.5%, 91.8%, 6.3%, 10.2 → 9.1% (3 better,
1 mixed); earlier pending 58.6 → 60.4%, 79.2 → 81.7%, 17.8 → 17.7%, 8.1 → 5.3%, within 5% 13 → 17; all but the
hold-outs 7.8 → 6.5%; verified unchanged. Better: d774 +27.2 → +3.7%, 0c14 +26.1 → −3.4%, 207f −15.0 → −1.2%, 4a64
+11.4 → +1.4%, 7e19 +10.4 → +2.0%, 99fb −7.4 → −2.5%, 2fd9 −19.1 → −13.1%, e989, 3aa6. Worse, each a compensating
error exposed: a9d7 −13.9 → −18.5% (matched −19.6% across Chen, Estella, Alesh), 3f78 −5.0 → −8.0% (Rossi's ultimate
with one stab fewer logged: its slashes took the wrong slots, net −6.3%), 9c6e −10.2 → −12.6% (two targets), d4fb
−8.5 → +10.2% (plain 198 → 368, per hit closer; her ultimate and crystal hits ×0.75 together, open), 4d60 and 04d4 by
≤ 0.4 pt. Measured with `enemy-away=counted`, the Endministrator changes alone moved the hold-outs 10.2 → 10.6% (1
mixed, presumably as d4fb); `away` brings them to 9.1%.

**Decisions:** the away rule as an engine assumption read only by the log tools, as `hidden-holds` is: a stage's phase
isn't the team's to simulate. 6 s from the gap histogram, not fitted to the totals. The stage status only where the
fixture names givers elsewhere (refreshed fixtures), so an old fixture's every status isn't read as the stage's.

**Left:** a9d7's fight-wide factor; 2fd9's Mi Fu Crush ×1.90; 3f78's Rossi ultimate slots (by value, or from the end
for an ultimate); fc63's burst keys (Typhoeus's hover bursts replay-only against her natural bursts log-only); 4360's
kill not detected (tower016's data HP isn't the logged total; the last hit is capped).

**Problems:** one multi-line `python3 -c` with backticks ran a shell substitution into open-problems.md (caught,
fixed with a patch file); an empty heredoc typed from habit (friction report).

## 2026-11-23: Arcane's reset reaches a combo inside her first 9 frames; Purrchena's stops; pinned expiries

**Goal:** round 8's accuracy list: the combo reset's reach (the engine against the log tools' stop lists), Purrchena's
one-sided stops, pinned expiries re-measured, then 489c's bleed tick series.

**Found and done:**
- **The reset's reach:** a teammate's combo slow-down starting between Arcane's combo and her frame 9 ran whole in the
  engine (24–27 frames) where the lists cut it (2–4). The logs side with the lists: 9555's Imprisonment burst comes
  1.46 s after her cast, as with no teammate's combo (1.48 s at 81.53 s; held, 1.84 s), and the hits after it carry her
  Susceptibility and gear-set bonus as logged (assumed ×1.07–1.41 → plain); 7910 and c83c likewise; 1d91's Liino volleys
  0.5 s late → on time. Engine: TimelineState.resets, a reset still to come cuts a slow-down of its priority that starts
  before it, which doesn't hold the reset's caster (clock.ts slowDown); `combo-reset` default `reaches`.
- **Purrchena's combo:** no hits of its own, so the lists kept all three slow-downs (0, 210, 270) for every cast: now the
  path with no conditional jump when no landing shows one (logcasts.ts pathOf). The engine's 210 path reached the
  frame-270 slow-down past her loop's cast at 250: SkillTiming.recasts (a CastSkill of her own skill on the timeline) end
  a path's slow-downs (pathSlowdowns); her shield extension 41 − 13. The replay's record kept one slow-down per start and
  priority, which hid a jump's own slow-down beside the frame-0 one (Purrchena, Rossi's combo_3, Pogranichnik); now kept
  apart, `replay --stops` calls the covered ones "covered (the same holds)". No length difference left.
- **Pinned expiries:** round 8's diff re-measured on this code: verified, development, earlier pending unchanged, one
  hold-out "other". Adopted (the log's end already holds every stop up to it; simpler than the step-at-a-time keep).
- **489c's bleed series:** not a reapplication (1.00 s ticks either side of the 1.54 s gap; the gap's +0.54 s is what the
  ramp asks too). The hold is dropped because a unit at 49.4–53.0 s and it exceed the ramp's cap from 49.31 s; its first
  tick, inside Rossi's combo_3, asks −0.19 s (her combo_3 over-hold again). Dropping tick anchors inside slow-downs
  measured worse (489c 590 → 580 plain): not adopted.

**Scoreboard** (`npm run snapshots:update`): development plain 65.7 → 65.8%, matched 80.4%, mismatch 14.8%, mean
|damage error| 8.6 → 8.7%; hold-out 77.4 → 77.3%, 91.9 → 91.8%, 6.3%, 10.2% (1 better, 1 worse, 1 other); earlier pending
58.5 → 58.6%, 17.8%, 8.1%; verified unchanged. Better: 7910 (324 → 339), 1d91 (336 → 341), c83c (563 → 569), 489c, db87;
9555 mixed (261 → 270 plain, per hit closer). Worse: 8915 −6 plain (hidden holds placed again: a unit at 90–95 s holds an
unlisted Corrosion, ×1.015), fc63 +2 mismatch (her Susceptibility now on two hits the log reads without it, among
replay-only Typhoeus combo landings), 6339 damage 35.7 → 37.5% (a lost landing in a log a third off).

**Teams** (team-ab against 6ddacfa): Typhoeus's team unchanged; Estella's at zero energy +0.08% sustained (+0.64% as a
bot, −0.32% at 0.6 s), full energy −0.05%, both 60 s timelines unchanged: within the seed spread.

**Problems:** finding every case took a scratch loop over 80 fixtures (no multi-log `--stops`); a kit number written as
"the data's length minus the engine's hold" had to follow the engine fix by hand (friction report).

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
