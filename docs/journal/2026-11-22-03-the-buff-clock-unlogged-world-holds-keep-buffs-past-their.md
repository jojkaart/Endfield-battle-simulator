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
