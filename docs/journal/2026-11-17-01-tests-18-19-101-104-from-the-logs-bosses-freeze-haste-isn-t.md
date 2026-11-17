## 2026-11-17: Tests 18, 19, 101, 104 from the logs: bosses freeze, Haste isn't attack speed, teammates' pause

Goal: the owner can't record tests 18, 19, 101 by hand and answered 104
from play (most bosses freeze, a few rare ones don't); decide what the
logs can (development logs only).

**104.** Bosses freeze by default now; control immunity is per enemy, in
a table with the log evidence (packages/data/src/enemyFacts.ts, read into
EnemyData.controlImmune: the data has the tag on no enemy, so it's a data
fact from the logs, not an engine rule). Each boss with a freezer, checked
frozen against immune: Rhodagn's five logs don't move (he freezes),
Chiliarch (c3c7: Ardelia's Susceptibility held too long) and the enemy Si
(4a64: Arcane's WILL debuff held too long; 3f78 leans the other way) are
listed immune. Under both readings Si's own debuffs are held, so her
Artful Intent ends (the 2026-11-13 evidence) don't tell them apart. Not
per fixture: fixtures are being refreshed in parallel, and immunity is the
enemy's. Scoreboard unchanged in every group.

**18.** Cooldowns run through others' ultimate stops: settled (58 combo
pairs come back between the cooldown and the cooldown plus the stops,
e.g. Typhoeus 17.1 s apart, cooldown 17 s, 4.9 s of stops in 9c6e).
Estella's Physical Susceptibility held by her own stop fits c4f3 (5 of
6). Laevatain's Twilight isn't decided (her logged Twilight ends run
2.5–7 s past the simple model): registered as kit assumption
`laevatain-twilight-own-stop` (reading `held`, +2.03 s).

**19.** Haste doesn't speed up attacks: basic-attack steps in the 5 s
after Si's Inksoul ends (30%) are 0.995× as far apart as elsewhere (95%
0.95–1.02; sped up, 0.77). The engine no longer plays hasted casts faster
(clock.ts actionSpeed is 1). It broke the five Si example timelines,
which had been searched with hasted casts: each now has the better of
the old timeline repaired (the gear ascent's repaired replay: steps
moved later or dropped) and a fresh single-beam search, a lower bound
(owner's 3.99M → 3.47M repaired, from zero 3.26M → 2.29M searched; Ink
Melt 4.75M → 3.95M repaired, from zero 4.72M → 2.84M searched, beam 48 no better; Si, Laevatain,
Liino, Gilberta 3.08M → 2.60M searched). A full re-search (beams
12/24/48, skeletons) is left: hours of CPU.

**101.** Not one timer: two thirds of full chains run straight on, the
rest wait a heavy-tailed pause (median 3.7 s); the share of free time a
teammate attacks depends on the fight and the operator (R² 0.41 each),
not on Stagger or the parser. Measured the same way, the engine's
teammates attacked 0.59–0.66 of their free time against the logs' 0.43
(median per operator-fight): the old 3.5 s was the median of the gaps
over 1.5 s alone. Pause now 6.5 s (0.41–0.45). The log replay plays the
logged casts, so only the examples and the rule numbers see it.

Rule numbers (32 fresh seeds, sustained DPS, full / from zero; docs/teams):
the owner's team 56,493 / 56,055 → bosses freeze 56,716 / 56,141 → no
Haste speed 55,278 / 55,598 → pause **52,382 / 52,716**; Ink Melt 69,668
/ 61,716 → 69,698 / 62,331 → 61,255 / 57,302 → **63,347 / 56,123**;
Typhoeus's team (no freezer, no Haste) 54,607 / 51,076 → pause **52,369
/ 48,967**. All three fight Rhodagn, now frozen by Si's battle skill.
Scoreboard (docs/accuracy.md): bosses freezing moves no group; Haste
without cast speed: development plain 47.2 → 47.3% (79cc +26 plain, 458b
+4, 791 −3 plain but damage −18.4 → −17.6%, a7a7 −2), mismatch 19.8% and
mean |damage error| 15.8% unchanged; hold-out 62.1 / 7.6 / 13.5%
unchanged. The pause doesn't reach the log replay (it plays the logged
casts).

Dead end: the old 3.5 s's "40% of free time" didn't reproduce with the
same measure on the engine. A scratch measure had a units bug (time stops
in frames compared with ms), harmless since both sides had it.
