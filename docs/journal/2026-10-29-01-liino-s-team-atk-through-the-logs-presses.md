## 2026-10-29: Liino's team ATK through the logs' presses

Goal: B8's Liino lead. The largest gap was d774: her stance's team ATK
on in the log from 54.6 to 115.9 s, off in the replay. The enemy is gone
from 30.6 s (no hits), so her battle skill at 49863 ms hit no one, and the
replay skipped the press as an unshown variant. Such a press (`unseen`:
no hit by anyone within 1 s of its first landing) is now cast when the
slot holds it: d774 plain 33 → 147, c6d8 0 → 29. The data also has the
stance's ATK lingering 5 s after it ends (`atkup_finishtime`, kit
`vocalist_linger`); c6d8's log suggests ~1.7 s after an End Stance, so
test 28 now asks. The presses every ~3 s in every Liino log are the
stance's soundwave heals, not casts (her stance and volleys go on).
Dead end: casting every available press (458b, c3c7, dbae worse; it even
re-cast Liino's ultimate from the "ultimate" presses during Cosmovoice).
Then Typhoeus's off-field chain: the replay made the chain's next shot
and the logged one 2 frames later; a logged cast now takes the place of
a follow-up cast due within 10 frames before it (dbae +9.9 → −4.2%).
Then 012a's early Stagger: Arcane's Cluster Strike lasers had 20 Stagger
each in the kit (a misread literal; no logged laser has any), and
Camille's combo was placed as three casts around a misplaced attack 3.
Stagger starts now come within 1–4 s of the logs; plain 012a 138 → 226.
Some totals fell (b6aa −15.3%): the false Stagger's ×1.3 had hidden
deficits, which are leads now.
b6aa's next: every hit under its Corrosion implied ×1.25 the engine's
shred, level 3 against the replay's 2. The missing Cryo stack was Last
Rite's Mirage, needing a battle skill the log never shows (cast beside her
basic attack). The replay now infers such a cast from the trigger hit
(`castsFromTriggerHits`, beside-capable skills only: unrestricted it
invented an ultimate and a combo). b6aa −8.4%, plain 62 → 216; 9555
−17.4 → +5.7%. Then 9555's Si: two usp02 wearers' team DMG stacked in the
replay; one-layer stackingType 2 buffs on others are one group now
(9555 +2.3%). Then Zhuang Fangyi's strikes: the kit was right, the
placement wasn't (her strike variants' finals sat between strikes): slots
follow the largest variant, and a logged press starts a new cast. 3aa6
−10.6%, 4bfc −12.9% (plain 206 → 311, 209 → 406). Dead end: bounding
joins by slot frames (split her plain battle skill and Last Rite's combo).
Not engine leads: 3aa6's Stagger compare (the poise print fired in
speculative states too), Si's build in 9555.
Liino's +124% in d774: one ultimate placed as three casts from its keys;
an ultimate's casts now merge within its duration (d774 Liino +29%,
4bfc Liino −5.7%). Anchored triggers (Liino's song beats) can move their
cast earlier (4e5e −2.8%). Zhuang's Sunderblade counts differ from the
log both ways (they hang on the Electrification replay): not a quick fix.
Si −27% in 0eef is one crit, not an error. a7a7's Si: the next cast cut
an inferred Final Stroke before its Artful Intent end; it keeps it now
(a7a7 −2.2%). Dead end: skipping Liino's in-stance presses when the
slot doesn't hold her battle skill (her +61% → +1%, the team worse):
in-game test 103 asks what they are.
