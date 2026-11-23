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
