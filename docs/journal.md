# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 138 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

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
