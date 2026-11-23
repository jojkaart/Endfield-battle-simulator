# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 122 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

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
  8.1%. Development 13 better (5082 plain 150 → 219, mismatch 36 → 6; 7910 255 → 318; db87; f978 394 → 444), 3 worse:
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
skipped beyond 3 steps.

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

## 2026-11-23: Hidden holds placed once for every timer

**Goal:** the buff clock's next step (docs/journal/2026-11-22-03-the-buff-clock-unlogged-world-holds-keep-buffs-past-their.md):
estimate where each fight's unlogged world holds fall from every clock the log shows, hold every timer there once, and
see whether the holds, read as perfect dodges, explain the Team SP shortfall.

**Done (open-problems "The buff clock", "Placed"):**
- packages/logs holds.ts: one hidden clock P per fight. Bounds: each buff that ran out in a first replay without holds
  against the log's run of it (lateness at its last listed hit, at most by the next hit without it, in world time past
  the expiry), the enemy's tick series as chains (Combustion, Rossi's bleed, Typhoeus's combo field, Aurora's
  ultimate); P rises no faster than real time and not in the Stagger. Difference constraints, a conflicting bound
  dropped; the least total hold, midway between the earliest and latest placement. `efsim zmdlogs holds <fixture>`.
- The replay holds the world's clock there (engine timeline/clock.ts `holdWorld`: buffs, the enemy's statuses and
  debuffs, combo windows; not cooldowns, SP or the operators' timing), then keeps listed buffs to the log's end.
  Engine assumption `hidden-holds`, new default `placed` (`holds`: the holds alone). BuffReplay.spTopUps: the SP
  replayCast raises at each cast.
- Scoreboard (`log` → `placed`): development plain 59.9 → 62.8%, mismatch 16.4 → 15.6%, mean |damage error| 9.2 → 9.1%,
  within 5% 14 → 16; hold-outs 69.6 → 69.9%, 6.7 → 6.6%, 11.0% unchanged (2 better, 1 worse); earlier pending 53.1 →
  54.0%; verified 75.6 → 77.4%; all but the hold-outs 57.5 → 59.6%, 18.8 → 18.3%, 8.1 → 8.0%, within 5% 31 → 34.
  Development 12 better, 2 worse (a27b, ad7f: damage only), 11 mixed; worse elsewhere d572, 0c14 (Wolven Blood layers
  held to max stacks early; d572's Corrosion ramp a step behind), de6a (a 4% buff held 0.1 s past a hit). Team-ab
  against 6b117c1: every team's fight the same.
- How well determined: 108.6 s of holds in 5,899 s of the 60 logs (1.8%), 211 units of 0.512 s, 50 placed within 1 s,
  92 within 3 s, every one spanned by a kept clock (median 3).
- SP: the holds as dodges (185, 1,295 SP) cover 87 of the 1,766 SP the replay lacks: the shortfall is where the clocks
  place nothing (04d4, 6339, db87, 79cc). Not the gap; no evidence for or against the dodge reading.
- The dodger's own 0.315 s (the data's layer 1): pairs of runs on one window, owner controlled or not, ratio median 1.12
  (62 pairs), not 0.62: no sign of a dodger's clock on its buffs.

**Decisions:** the world's clock alone: holding the operators' clocks too (slowDown, nobody exempt) moved kit-timed
landings off the log's (bdf2 lost a Nature burst to one frame of hold; verified damage error 1.9 → 3.2%). The midpoint
rather than one extreme: it's feasible and splits the uncertainty. The log's ends stay on top: they are facts, the holds
an estimate.

**Dead ends:** bounds from the run's end less the expiry in real time: holds then carried b6aa's Xaihi debuff 2.8 s past
the log's end (the stops after its old expiry held it again); world time past the expiry fixed it. The first pass kept
buffs to the log's end (its `log` ends were on) and so saw no lateness at all. A cap of world time per span dropped
489c's Si's Amp (3 s of holds inside three overlapping ultimates' stops).

**Left:** test 111; Corrosion's listed ramp levels and Wolven Blood's layers as clocks; pauses (12 units in hitless
spans) and overlapping ultimates' stops, which a dodge can't be; Gilberta's tower-boss Vulnerable stacks and Arcane's
seal unchanged by the holds.

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

## 2026-11-22: The buff clock: unlogged world holds keep buffs past their end

**Goal:** what holds operators' buffs past their modelled end in some windows (Laevatain's Forgeborn and Scorching
Heart, Rossi's Wolven Blood, Gilberta's Vulnerable stacks, Liino's beats; three agents found it the same day).

**Done (open-problems "The buff clock"):** every listed run of a kit-modelled game buff over the 77 development logs
with run starts (6,991 runs): its world length (placed stops out) against the data's duration and the replay's expiry,
with what each window holds. 724 clean single runs run a median +0.49 s long, over almost every team's buffs, not
Laevatain's alone. Hypotheses scored against the table, a hidden-clock solver and the enemy's tick series:
- a listing lag: **wrong**, the damage sides with the listing past the replay's expiry (802 hits against 92);
- one hidden clock per fight: **fits**, 152 of 1,378 runs conflict (341 with the excesses shuffled), the enemy's 588
  tick pairs fit the same clock (28 dropped), and the 8 runs a tick series covers end where it says (±0.3 s);
- perfect dodges (0.512 s world slow-down each by the data, unlogged): **fits** what can be tested: the ticks' unexplained
  holds cluster at +0.42–0.56 s and come 34 times in 378 pairs outside Stagger, once in 92 inside it (a Staggered enemy
  doesn't attack); 9c0b's ten hitless seconds hold ~7.5 s, a pause;
- per-holder clocks (hit-stops, animations), overlapping stops held for their sum, a clock rate, a constant per
  ultimate or combo, the game timer pausing: **wrong** (Si's Amp ends at one ms on every holder; exact where no other
  ultimate falls inside; free ticks run at 1.000 between holds).

**Implemented:** engine assumption `hidden-holds` (default `log`, `none` the old replay; read only by the log check's
replay, buffreplay.ts `heldToLoggedEnds`): a timed kit buff whose single run the log lists past the replay's expiry is
kept on a step at a time to a frame after its last listed hit, before any holder's hit without it, within 40% of its
life. First tries extended once at the expiry: the replay's later stops then held it again past the log's end (b6aa's
Xaihi debuff to 46.9 s against 43.8), and the max over holders' runs gave Si a teammate's later end; both fixed.
Scoreboard: all but the hold-outs plain 55.7 → 57.5%, mismatch 18.8% unchanged, mean |damage error| 8.3 → 8.1%, within
5% 33 → 31 (c83c, fc63 over-predict already); development 57.8 → 59.9%, 16.5 → 16.4%, 9.8 → 9.2%; hold-out unchanged
(69.6%, 6.7%, 11.0%); development logs 14 better, 1 worse (4a64, plain 130 → 128: two Arcane hits at 16.9 s now carry a Hot Work Nature DMG instance the log doesn't list, a knock-on of another buff kept, not traced),
9 mixed (per-hit error closer in 15 of the 16 mixed logs over both groups). Simulations unchanged (team-ab against 0ab4b03: every team's fight the same; they dodge with
`--dodge`).

**Decision:** the replay takes the buff's end from the log, as it takes the Stagger windows and the bleed's ticks: it
can't place the dodges, and the damage agrees with the log. Not a kit change (no buff's duration moved).

**Left:** in-game test 111 (perfect dodges counted during Si's Amp); the holds placed once for every timer (enemy
statuses, unlisted buffs, the dodges' SP for "Team SP"); the dodger's own 0.315 s; runs ending before the replay's
expiry (~7%); Liino's beats running fast (the other direction). The hold-outs' aggregate doesn't move, so
it isn't confirmed there.

## 2026-11-22: Improvement round 5: the lock's queue, premerge's done line, diagnosis views

Goal: improvement round 5 (docs/friction/README.md, step 2) over the eleven open reports (round 4's backlog and
report, the finisher gate, the eight 2026-11-22 accuracy branches) and the lead's own friction from merging their
batch. Summary and outcomes: docs/friction-done/2026-11-22-round-5.md; what's left:
docs/friction/2026-11-22-backlog-after-round-5.md.

Done:
- premerge's last line comes from scripts/done-line.sh: "pass" only from its own end, "killed" from a signal trap.
  The false pass was bash's: a shell killed by a signal runs its EXIT trap with `$?` of the last finished command
  (0). Long steps now run in the background and are waited for, so the trap runs at once (bash defers traps during a
  foreground command) and stops them; tests/done-line.test.ts.
- The test lock: fair shares between worktrees (a worktree's n-th waiting job counts as arriving n × 20 min later),
  the estimated wait plus run against the 2 h background limit on the first waiting line, a kill in the queue named
  on the DONE line. measure and team-ab fix their code at queue time with a snapshot commit of the working tree
  (temporary index, own worktree, removed after): agents keep editing while they wait. team-ab's identity check runs
  in the short lane, its 32 seeds only for the moved teams.
- `npm run merge -- <branch>…`: a batch with one snapshots run, then `vitest related` on the code both sides changed.
- Views: `zmdlogs worldtime`, `lanes --world`, `measure --hits` and moved casts under `--changed placement`, the
  replay's EVENT lines (`loggedCastFates`, the same matcher as withLoggedCasts), fallback matches in `groups`,
  `verdictReading` in `hits --json`, `efsim assumptions`, skill groups and applications in `efsim kit`.
- Docs: batched timestamps, how the placement picks among groups sharing a key, misreadings, limits; `.prettierignore`.

Decisions: no hard one-job-per-agent cap (fair shares get the same without idling the machine); no more jobs in the
side lane (timeouts and incomparable measurements; the snapshot makes the wait free instead); `hits --json` fields
added, not renamed (scripts read `predicted`); the hold-out snapshot file stays where it is (a grep exclusion instead
of moving a file three scripts and the snapshots glob name); a replay-only buff-duration option and the `beside`
exemption for `launch` are behaviour changes, left to accuracy tasks.

Checked: `npm run measure -- --hits` at the views commit, every log byte for byte; team-ab against HEAD unchanged.

## 2026-11-22: Yinglung's Edge stack counts: hypotheses against 68 combos

**Goal:** the owner's brief: list deterministic causes for the Type 50 Yinglung's Edge count diverging from the
logs (about a third of combos, both ways), score each against every wearer combo in the development logs, iterate
on the misfits, implement a winner.

**Done:** the set's data (`gamedata tree` on its four buffs: an aura's detector on every member, a layer to the
wearer on that member's battle-skill cast, cap 3, no duration, the wearer's combo takes all). Per combo the layers
the damage implies (both readings' DMG-bonus gap in 0.2 units; Jade Vessel's 0.3–0.7 separates as it isn't a
multiple of 0.2): 68 Si and Bounda combos decided, the rest left out with named non-Edge causes. Thirteen first
hypotheses and two new ones scored (open-problems.md "Type 50 Yinglung's Edge", the table): the engine 52 exact /
4 first-combo lower bound / 12 wrong; every logged cast 58 / 0 / 10; without Si's hitless presses 55 / 4 / 9;
expiries, own-only, teammates-only, ultimates, any wearer's combo clearing, first-hit timing all worse. The
misfits suggested two new causes: **N2** Si's first press after her battle skill counts (Initial Stroke under
Artful Intent) and her other periodic presses don't; **N1** layers are lost over a pause with no hit (3f78 and 4a64
after ~20 s, 7b54 after 5.9 s; abfd keeps them over 4.9 s): together 64 / 1 / 3.

**Replay fix (buffreplay.ts):** a Final Stroke inferred from the mark's own burst (the kit's no-Inksoul branch,
where Final Stroke can't be cast) is now an expiry (an `expires` step, no cast): 0c14 81.7 and 489c 107.6 3 → 2;
the engine 54 / 4 / 10. Scoreboard (`npm run snapshots:update`): verified and hold-out unchanged, development plain
52.0%, earlier pending 48.9 → 49.0% plain; 489c mismatches 120 → 113, 0c14 plain 123 → 133; no log worse. Tried and reverted: making Laevatain's Twilight battle skill once where the replay makes it
twice (the `normal_skill` event and the placed `normal_skill_during_ult`, db87 41.2 3 → 2, plain 114 → 126): the
same static rule broke Purrchena's battle skill and counter (04d4); the replay's state has to decide.

**Decisions:** N1 and N2 not built into the engine: N1 needs "leaving battle", which the log doesn't record and the
simulator's fights don't have (test 106 (e) asks the owner); N2 in the replay means making every press under
Artful Intent the stroke the slot holds, and the replay's Artful Intent outlasts the game's (its Inksoul-burst
Final Strokes 2–3 s after the last press fit the expiry better), so it waits on that. Estella's five single-hit
combos don't decide anything (her Razorhorn ATK was fitted on the same hits).

**Left:** c779's moved layer, 0c14 166.7 (two layers and Jade Vessel short); the replay's stroke reading (Final
Stroke only with a press just before the burst; Initial Stroke at the first press). In-game test 106 now asks only
(e) a pause / leaving combat and (d) whether Final Stroke gives a stack.

## 2026-11-22: Twilight's excess is her buffs' clock, not Twilight's

**Goal:** why Laevatain's Twilight still lasts 0.1–4.6 s longer than modelled in the
closed windows (open-problems "Laevatain's Twilight runs longer than its model", in-game
tests 18 and 21), and fix it.

**Done:** every Twilight window of the 18 Laevatain logs bracketed again (last enhanced
cast, first plain cast, from `zmdlogs instances`), with the replay's holds counted from a
run with Twilight 45 s long (so holds after the modelled end count). Then each candidate
tested per window (open-problems has the table): a constant, show_weapon's 16 s, the
battle skill's full 115-frame pause, a combo hold other than 1.9 s, every 1- and
2-feature linear model over her combos, battle skills, others' ultimates and combos,
her hit-stops, a clock rate, others' stops longer than their UltimateTimeAction (bounded
by the hit-free gaps), the Stagger, P5's kill extension, refreshes by a combo or a
Scorching Heart start, a later start, an enhanced step after the end. None fits all
windows: c83c needs ≥3.1 s where f879 45.4 s allows ≤1.2 s. The game data has no
mechanism beyond the engine's (`gamedata who buff_chr_0016_laevat_ult_end`: her combo's
channel, potential_5 and show_weapon's start).

The decisive probe: Forgeborn Scathe's 20 s buff (`buff_wpn_sword_0006_valid`, listed on
her hits), created by the same ultimate and with none of Twilight's own pauses, runs past
the replay by about as much in the same windows (0.9–2.8 s in the closed ones, 3–8 s in
3440 and 9c0b). Twilight less Forgeborn contains 0 in five of nine windows and misses it by
0.09–0.43 s in four, both ways. So Twilight's model holds; what runs long is her buffs'
clock in those windows (Scorching Heart's natural ends outside Twilight too: 0.2–1.5 s in
8 of 9). Measured Twilight 17 s (+2) on every Laevatain log: no verdict moves at all, the
development and hold-out rows unchanged.

**Decision:** no kit change (a longer Twilight would put a world-clock effect into one
kit, and the accuracy doesn't ask for it). Registered kit assumption
`laevatain-twilight-clock` (test 21): `model` (default) or `forgeborn` (+1.8 s, Forgeborn's
median excess; trigger `twilight_clock_excess`), the switch for what rides on it: Ink Melt
59,662 → 61,930 (+3.80% ± 1.30, seeds 1001–1032, full energy, `efsim rules …
--assumptions`). Scoreboard unchanged (development 52.0% plain, hold-out 67.3%); team-ab
against 1ab4647 identical (the default is the old kit). Smoke: one failure, the timeline
test's list of her kit triggers (fixed). Docs: open-problems (table, ruled out, still possible),
in-game tests 18 and 21, design/rules.md's assumption list, roadmap.

**Left open:** what holds her buffs (and not cooldowns, test 18): perfect dodges' 0.6 s
world slow-down (the log records no dodges), pauses at a fight's start (9c0b: 10 s with no
hit, Forgeborn +6–7.8 s), hit-stops in part. Next: the buff clock over every log, each
listed buff's natural end against the replay's. Friction report
docs/friction/2026-11-22-twilight.md (a `--long` trace and a lane-end view would have
found the probe in minutes).

## 2026-11-22: The rule search decides: an objective across starts, rule sets, setups

**Goal:** the owner: "The whole point of this simulator is to discover [the rules] for each team." Three rule
questions had been left as the owner's call because the guided search had no objective across the fight's two starts
(full energy, the zero-energy companion). Later the same day, also from the owner: conditionally active rule sets, so a
team with Arcane and a non-Nature inflicter can play a Corrosion setup phase.

**Done** (docs/design/rules.md "The objective across starts", "Rule sets", "The search decides"):
- **The objective:** every list played on both starts on the same seeds, each seed scored by the two starts' mean
  sustained DPS (`startsObjective`); the guided search's default (`--objective mean`; `first` the old veto), per-start
  gains in its report, `efsim rules --compare` the same. Chosen over one long fight from zero because both starts
  happen in play and a fight from zero never returns to four full bars.
- **Cues:** `ultimates` (how many ready at once, rank 4), `energy` (an ultimate's gauge, rank 5), `statusLevel` (a
  status at a level, rank 3: Corrosion at full strength is level 4). In guideCues, the rule search's pool and its
  threshold moves.
- **Rule sets:** `sets: [{ name, when }]` and a rule's `set`; one ordered list, a set rule read only while its
  condition holds (`effectiveRules`); the condition counts once in the learnability; flat lists unchanged.
- **Search moves:** reaction setup sets (`reactionSetupEdits`: the applier at 4 stacks of another element, else the
  inflicter, from spare SP or not, with the list's own guards), rules moved between sets (`setMoveEdits`), an edit
  split by a start cue into two sets (`splitEdit`, after a round that keeps nothing or a kept edit that disagrees
  between the starts), the rule search's `editSets`.
- **Searches** (with-lock, 15–49 min each): the owner's team kept a Corrosion setup set: +1.06% ± 0.33 on 64 fresh
  seeds with Akekuri's ultimate guard (+1.71% as found; Arcane's press alone +0.94%). Ink Melt: Laevatain's ultimate
  waits for Corrosion, Si's for Combustion and Twilight: +3.21% ± 0.73 (64). Typhoeus's: ultimates wait for the hover,
  Arcane's battle skill while the Stagger bar is below half: +8.62% ± 0.65 (32). Questions: Estella on Stagger no; Ink
  Melt's rule 7 `shows` no (a loss from both starts now); the Twilight hold kept (dropping it −2.3%). Arcane INT
  (Hot Work), each mode with its own searched list: −1.91% ± 0.60 (64): not worth farming. Examples changed; an INT variant in examples/variants/.

**Problems:** the 2026-11-16 numbers behind the questions had all moved (the engine changes since): measured per start
before designing anything. The owner's setup as found pressed Akekuri's battle skill inside her ultimate; the rules
check in the test suite caught it, the setup move now copies the list's guards. The first INT search hit the 2 h
background limit (queue wait included): rerun with 4 rounds from the new WILL list. `npx prettier` reformatted a file
(no config in the repository): rebuilt from `git show HEAD`. Friction: docs/friction/2026-11-22-rule-objective.md.

## 2026-11-22: Rossi's bleed keeps only ATK; its ticks on the log's clock; her ultimate's crits

**Goal:** Rossi's mismatches (594 in her 9 development logs, second after Arcane), her bleed first: does its tick
clock drift as Liino's volleys did, and pin it or fix the kit; then Wolven Blood, Seething Blood, her ultimate.

**Done (open-problems "Rossi: her bleed, her ultimate's crits and what remains"):**
- The bleed's `takeAtkSnapshot` keeps ATK only (effects.ts `ATK_SNAPSHOT_ZONES`): d572's ticks follow Wolven Blood's
  layers, Camille's set DMG and the combo's Crit DMG tick by tick, not Camille's weapon ATK. Combustion keeps its
  whole-side snapshot (its own evidence).
- A tick at its buff's application doesn't see that buff's modifiers (PendingHit `firstTickOf`): every bleed's first
  tick lacks its +12% DMG Taken in every log.
- The bleed's ticks are pinned to the logged ones (`ticksShownByHits`, as Liino's volleys): the replay's ticks step
  0.3–0.6 s against the log's at other casts' placed stops, with no kit timer that fits; the bleed runs through her
  own combo slow-down in both.
- The replay counts crits the log leaves out where a trigger on crits logs its hits at that ms (buffreplay.ts
  `shownCrits`): every log gives her ultimate stabs no crit but logs the Seething Blood extra of each crit stab, so the
  extras and their Wolven Blood layers now land.

**Numbers (scoreboard):** all but the hold-outs plain 51.3 → 51.8%, mismatch 19.9 → 19.6%, mean |damage error|
9.9 → 8.3%, within 5% 28 → 31; development mismatch 18.2 → 17.7%, |damage| 12.6 → 10.1%; hold-out plain 67.3%,
mismatch 6.7% unchanged, |damage| 12.1 → 11.7% (1 better, 0 worse); Rossi plain 23.4 → 30.2%, |damage| 17.9 →
3.9%. 4e5e, 3f78, 489c, 4a64, 9a80, 2fd9, 99fb, d572 better; 0c14 mixed (total +8.5 → +10.4%, it over-predicts
already; per-hit closer). Rossi's own mismatches 594 → 497 (`zmdlogs groups --operator Rossi`).

**Decisions:** pinning over a kit timer for the ticks, because the steps follow where the replay places others' stops
(which it can't know better); the snapshot and first-tick rules are engine facts, so simulations get them too.
`ticksShownByHits` is unchanged (Liino's use is the same).

**Left open:** Hard 27 (2fd9, 99fb: 402 of the 497); Wolven Blood's max-stack bonus and the combo's Crit DMG lasting
up to ~2.5 s longer or shorter in world time than the replay's (tables in the entry); Corrosion's ramp under 489c's
ultimates; 0c14's crit-less ultimate without a bleed (no extras to show its crits; the log's layer counts would).
9a80's ultimate ×1.09 already fitted at the base.
