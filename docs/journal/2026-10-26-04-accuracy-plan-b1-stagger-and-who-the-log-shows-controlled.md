## 2026-10-26: accuracy plan B1 (Stagger), and who the log shows controlled

Goal: the plan's B1, the engine's largest known error. Downloaded the 29
battle details again (scratch only, 3 s apart) for their `poiseDamage`
per hit (the bar after each hit), now kept in fixtures as `LogHit.poise`
(`efsim zmdlogs refresh` replaces `zmdlogs casts`; it also added the
logged casts to 23 fixtures). Findings (accuracy-plan.md "B1 done"): the
kits' Stagger per hit is right; the bar never recovers on its own
(in-game test 99 answered); a window is PoiseRecTime plus time stops plus
~1 s; bosses refill the bar themselves (second lives; Rhodagn in three
of five fights at 29.5–45 s, not at a fixed HP: test 100 asks the owner).
The real bug was the replay's: it made every basic attacker controlled,
but teammates attack on their own (B0) and their Final Strikes deal no
Stagger (the log: one operator per fight has Stagger on basic hits). Now
the controlled operator comes from those hits and the others' basic casts
replay as theirs (`replayCast` `teammate`); the replay takes the log's
recoveries (an enemy action `recover` the engine now has, refillPoise).
Also: a logged cast inside its operator's own cantCastSkill channel keeps
the running cast (Xaihi's ultimate Amp in dbae, A6's leftover).
Plain matches up nearly everywhere (abfd 31 → 270, 458b 294 → 442, a7a7
0 → 137); totals abfd −34.6 → −6.5%, e82d −32.7 → −9.1%, 458b −15.2 →
−1.7%. A few totals moved away from 0 (4e5e −0.7 → −5.2%, c3c7 +0.1 →
+7.9%): the false Staggers had offset other deficits. dbae is pending
again (Xaihi's hits need Arcane's Nature burst, which the reaction replay
doesn't make). Dead end: a 70%-HP phase rule for Rhodagn (40d9 and e82d
pass 70% without a refill). Left: B0 in `simulate` and the search
(teammates' pace, now measurable), 4e5e's 24 unattributed Stagger at
53.2 s.
