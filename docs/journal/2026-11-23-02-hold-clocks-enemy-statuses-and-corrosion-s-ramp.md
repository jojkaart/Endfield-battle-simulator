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
