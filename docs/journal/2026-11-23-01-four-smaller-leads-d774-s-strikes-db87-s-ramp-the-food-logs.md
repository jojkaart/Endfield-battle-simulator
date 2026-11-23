## 2026-11-23: Four smaller leads: d774's strikes, db87's ramp, the food logs' openers, Hard 27's resistance

**Goal:** four leads with a stated next check in docs/open-problems.md: d774's Sunderblade strikes ×1.39, db87's
Corrosion ramp across overlapping stops (rule T3), 3f78 / 4a64 "−36.5% after food", Hard 27's ×1.1125.

**Found:**
- **d774:** the first strike's ×1.3858 is exactly a consumed level-1 Electrification (conductCnt 1 and one more layer
  each of Lone Barge's consume DMG and Xiranflow): the log lists Perlica's 8.75 s Electrification for 9.61 s of world
  time, to the battle skill that takes it; the replay's had expired. A hidden hold on an enemy status (the buff
  clock's open half), not a strike zone. Strikes 2–4's ×1.342 were Amp marks: the replay struck three times before
  Liino's combo stop where the log struck once.
- **Liino's combo was placed 0.6 s late in every log:** its hit 1 (frame 9, the world at 0.01) is logged where its
  own slow-down ends (hit 2 follows by a median 0.23 s, not 0.8 s; no teammate's hit in the second before it). Fixed
  in the placement (logcasts.ts `ownStopLoggedFrame`, docs/design/data.md "What the log records").
- With the stop moved, a status applied inside it lost its hold (9090's Electrification ended at 15.3 s, listed to
  16 s): the engine held buffs created in a stop (buff-in-stop) but not enemy statuses. Engine assumption
  `status-in-stop`, default `held` (clock.ts `holdNewStatuses`), `runs` the old rule.
- **db87 (T3):** the lowest scale stays. Read as resistance steps on every hit, the log's ramp runs behind the
  replay's by a growing 0.1–0.45 s (19 s) to 0.57–0.72 s (25 s); a sum would add 0.5 s at once and 0.6 s more at
  22.0–22.9 s (three combo slow-downs), past what the hits allow. A hidden hold (Si's Amp +2.49 s there).
- **3f78 / 4a64:** totals now −6.1 / +7.6% (earlier rounds). The first windows' "no level fits" ×1.013 is Corrosion's
  ramp one step ahead in the log: the replay holds it 0.2–0.3 s too long across Gilberta's, Si's and Arcane's opener
  combos (Si and Arcane pressed in Gilberta's stop). Not fixed; next check in open-problems.
- **Hard 27:** a second player's log on the stage (v59, game 1.6; imported as fixtures/pending/zmdlogs-207fff414d82.json,
  first check 0 plain of 342, −12.4%): physical ×1.112 from the first hit, Cryo and Nature ×0.890. The enemy has
  resistance 11 for every element the logs have; the table (the base template's) says physical 20, others 0. Enemy
  fact `LOGGED_RESISTANCES` (enemyFacts.ts). Then Ember (weapon level 80) and Snowshine (weapon level 20) fitted by
  `zmdlogs fit-build`, as buildOverrides.

**Scoreboard** (`npm run snapshots:update`): development plain 59.9 → 60.1%, mismatch 16.4 → 16.3%, |damage| 9.2%;
hold-out 69.6 → 70.1%, 6.7 → 6.5%, 11.0 → 10.9% (5 better, 0 worse); earlier pending (the new log among them: 24
fights) 53.1 → 54.9%, 23.3 → 19.0%, |damage| 8.1 → 8.4% (207f's −18.8% joins the mean; 2fd9 −22.9 → −19.5%, 99fb
−10.9 → −7.5%); verified 75.6 → 75.9%. Better: 2fd9 (plain 0 → 161), 99fb (0 → 155), 4360, 7910, 9c6e, fc63, 4bfc,
1d91, 00ae, 0eef, bdf2. Worse: a7a7 (386 → 351: its first Liino combo at the fight's start now ends before the
Corrosion of 3.86 s, so Si's combo stop alone holds the ramp 0.53 s where the log allows 0.42), 4d60 (−6), 3f78 (−2,
status-in-stop), 9090, 9847 and c6d8 (−1 each; knock-ons of Liino's moved stops); mixed d774 (+13 plain, mismatches
59 → 39, its over-predicted total +22.6 → +24.6%), 9a80, c3c7. Teams (team-ab against 6b117c1, seeds 1001–1032,
status-in-stop held): Estella's sustained DPS +0.08% full / −0.00% zero, Typhoeus's +0.05% / +0.04%, Typhoeus's 60 s
timeline −0.30% (full energy), the rest unchanged. Also: a7a7's INT lasers' event at 42128 ms, now 1.35 s of world
time after Arcane's combo touch, had become her combo's own event; after a combo's last landing the window is 1 s
(buffreplay.ts COMBO_EVENT_AFTER_MS; no verdict moved).

**Decisions:** the placement rule only for frozen frames (scale ≤ 0.05): counting every frame below 1 moved 4e5e, db87
and others' casts. `status-in-stop` held by default for one world clock with buff-in-stop, measured better on both
groups. The resistance is the logs' (two players, two game versions), not a per-log factor. The new fixture is a
development log in fixtures/pending; it counts as "earlier pending" until holdout.json's development list (which
agents don't open) has it.

**Left:** d774's strike count before her ultimate (the log's world holds 0.83 s, Liino's slow-down 0.61 s); the
enemy statuses' hidden holds (the buff clock); the food logs' opener; what sets Hard 27's 11 (its born buffs have no
BuffData file); Purrchena's level 1 in 99fb. Friction report docs/friction/2026-11-23-smaller-leads.md.
