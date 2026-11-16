## 2026-10-28: accuracy plan B2–B7 from the data and the logs

B2 (SP pause): neither the logs (no SP in them) nor the data say; in-game
test 102 measures the stop as B − A of two timings. B3: the logs don't
show Corrosion too strong (the plan's guess); the data's carry-over on
reapplication was missing (a7a7 −19.4 → −8.8%, plain 137 → 315). B4:
Solidification's length isn't in our data or the logs (test 71). B5: the
data's 11 s Combustion made the replay's ticks worse (458b 60 → 53 against
58 logged): kept 10 s, with the numbers in the code. B7: the one-element
key `buff_common_natural_triggered` is Corrosion's own hit, made before
its status (so without its own shred): the "×1.42" of batch 1 L2 is gone
(the engine moved since); 0eef, bdf2, d572, a7a7 match it plainly.
Dead end: a 10 s / 11 s A/B with a half-reverted sed gave a wrong reading
(one of the two tick conditions stayed): compare from snapshots.
Then B8 for Typhoeus: her hover ended early in the replay (keepPrevious
kept the cut loop's landing; her combo placed as the grounded variant):
bdf2 plain 105 → 123, 92b4 → 0%. Keeping only hits on keepPrevious was
tried first and lost real delayed buffs (Liino and Si −11–13% in bdf2):
only follow-up casts are dropped now.
Zhuang Fangyi: battle-skill presses during her ultimate become her ult
battle skill when its own keys follow (3aa6 −40.7 → −23.8%). c6d8 then
shows a ×10 damage reduction on its boss the log doesn't list (Arcane's
ultimate 0.100× exactly): next lead there.
