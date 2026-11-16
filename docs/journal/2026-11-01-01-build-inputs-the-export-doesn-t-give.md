## 2026-11-01: Build inputs the export doesn't give

Goal: Liino's 100 mismatches in d774, all ×0.937. Not her kit or stats
(her Amp confirms her Will, the raw log her gear): her weapon was level
80, which the importer can't know (it assumes 90; skill level 9 needs
only the last breakthrough, at 80). A scan for operators with one factor
on most hits found Akekuri (weapon 80) and Si (2 attribute nodes) in 458b,
and Purrchena (weapon 84) in 04d4. The check now reports such offsets
with the inputs that explain them (`buildOffsets`), and those fixtures
carry the inputs with notes. 458b plain 445 → 895, mismatches 560 → 27;
d774 +45 plain; 04d4 0 → 160. Unexplained offsets are listed as leads.
458b's remaining mismatches are Combustion ticks: they answer in-game
test 77 (two ticks of one burn ×1.3 apart, Stagger only, despite new ATK
buffs: the ATK snapshot holds), and show a step up after a later Heat hit
(a refreshed snapshot?), a lead.
Then (2026-11-03) the offset search tries a lower weapon level and fewer
attribute nodes together when neither alone fits: 4bfc's Arclight is
both (plain 400 → 558). Dead end: the builds with a duplicate accessory
(9555's Si, 04d4's Snowshine) fit neither with nor without it.
