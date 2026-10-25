# Pending log fixtures

Imported battle logs that the check doesn't verify yet (docs/design.md,
"What a log check verifies"), because something outside the kits doesn't
match. `npm run test:logs` (tests/slow/) pins each one's current verdict
counts per operator (tests/snapshots/log-verdicts-pending.json), so any
change shows. Move a file up to `fixtures/` once `efsim zmdlogs check
<file>` says "Verified" (and move its snapshot entry: `npm run
snapshots:update`).

## Moved here from fixtures/, 2026-10-24 (stricter verification)

The check used to count any hit under a buff the log lists without a
value as "under unmodelled effects" (Corrosion's, here), whatever its
damage, and an operator with only such hits, or only matches through the
log's buff listing, passed. Now Corrosion excuses a hit only when its
damage lies between a reading's with the least and the most shred
Corrosion can give, and every operator with a kit needs a plain or
assumed match (log-listing fallbacks show the damage with the log's
buffs, not the engine's).

- `zmdlogs-d9e59d0fb737.json` (0 of 98 hits matched): every hit after
  Arcane's ultimate is ×1.7–2.0 the prediction (Typhoeus 42, Arcane 13,
  Gilberta 8 of their hits are now mismatches; 34 stay under Corrosion
  within its range, Liino's 24 among them). Arcane's kit notes already
  say so: this INT battle predates the 1.6 tables (555me's commit
  371c743), and all of it is under her ultimate's forced Corrosion. Not
  a kit error the check can name; maybe the battle is from 1.5.
- `zmdlogs-dbaee23b801d.json` (back in fixtures/ since 2026-10-25): 75
  of 78 matches were only with the log's buff listing; Liino (25) and
  Xaihi (7) had no other. The replay had `buff_wpn_funnel_0005_atk_up`
  (Xaihi's Stanza of Memorials) off: it comes from her ultimate, which has
  no damage. The replay now infers that cast from the buff's lane
  (castsFromBuffLanes; journal 2026-10-25): Liino 20 plain, 2 assumed,
  3 fallback; Xaihi 1 plain, 6 fallback (Arcane's weapon's
  `buff_wpn_funnel_0016_will_atk` the replay still has off where the log
  lists it); negative control 0.
- `zmdlogs-0eef2474a26f.json` (back in fixtures/ since 2026-10-25):
  Arcane's 3 matched hits fit only the log's listing: the replay had
  Liino's `buff_wpn_lance_0014_damageup` on Arcane at 2.7–3.7 s, which the
  log doesn't list and the damage doesn't have. That buff goes to whom her
  combo heals (the controlled operator, which the log doesn't record): the
  replay leaves it to the log now, and Arcane has 2 plain and 1 assumed
  matches. With the replay's Corrosion (its landings' shred) the negative
  control gives 0 (×1.03 gave 6: Corrosion level 4 on Liino's volley).

The Corrosion range moved hits from "unmodelled" to mismatch in two
fixtures already pending: `04d401ad257e` Catcher 9, Purrchena 1;
`4e3651100056` Ardelia 7.

- `zmdlogs-e82d45c46040.json` (Rhodagn, game 1.6, parser v59): three
  unexplained factors in one fight. Perlica's Electrification reaction
  (t=7544) is ×1.209 the level III prediction (×1.200 of it is her P3
  layer, in her kit since 2026-10-20; ×1.0078 is left, batch-3 A6), Si's
  battle skill (t=2315) ×1.139, and an Arcane Cryo burst (t=8561) sits between the predictions
  with and without its boundary buffs. Something the log doesn't list acts
  on several operators; its Electrification *strength* (0.39571) does
  match (docs/data-sources.md). Si's ×1.139 is Ginseng Meat Stew (+180
  flat ATK, a food buff the log doesn't list; 2026-10-21; since 2026-10-22
  her build's `food`, set by hand): 21 of her 22 hits match. No food fits
  Perlica's two hits.
- `zmdlogs-7e19489ae503.json` (Rhodagn, game 1.6, imported 2026-10-19 for
  batch 2): the Endministrator (34% of the damage, P3) with Ember, Chen
  Qianyu and Pogranichnik; Ember and Pogranichnik have no kit yet. Chen's
  21 hits are covered since her kit (2026-10-20) and mismatch: her build in
  the log looks off (in-game test 75) and the log doesn't list team
  effects that act on her (docs/kit-batches/batch-3/chr_0005_chen.md,
  section Kit). With her kit
  all 34 of her hits are covered and mismatch, for two reasons outside
  the kit (docs/kit-batches/batch-2/chr_0003_endminf.md, section Kit): the
  log doesn't list talent 2's +20% Physical DMG taken on the sealed enemy,
  and her ATK is short by what +180 flat ATK (+21.98% ATK) gives. The ATK
  is Ginseng Meat Stew, a food buff the log doesn't list (2026-10-21,
  the owner's suggestion; since 2026-10-22 her build's `food`, set by hand
  with a provenance note, instead of effects hand-added to her hits):
  all 34 of her hits match now.
- `zmdlogs-abfd4b7478ec.json` (Rhodagn, imported 2026-10-19 for batch 2):
  Fluorite (P5) with Si, Yvonne and Seraph. Every Si hit was ×0.965 of the
  prediction and every Fluorite hit ×0.544: build corrections from the
  log's own data (2026-10-19, provenance notes: Si attributeNodes 2,
  Fluorite promotion 3 with weapon level 20) make all 56 of Fluorite's hits
  and 186 of Si's match; the checker's finisher multiplier (2026-10-20)
  matches her four finisher hits too. Xaihi (Seraph) matches 75 of 75 with
  her kit and weapon level 60 (2026-10-20, provenance note). Left: Yvonne
  has no kit.

## New logs, 2026-10-21 (not investigated yet)

Imported for the 14 operators without a log (found through ZMDLogs'
character profiles; docs/data-sources.md#zmdlogs). All single-target;
the enemy level (90) comes from each stage's DungeonTable entry. None has
been investigated: the per-operator results below are the first
`zmdlogs check` (match / hits). Many operators are off by one constant
factor across a whole fight, which points at the build or a buff the log
doesn't list, not the kit: below 1 (Liino ×0.937, Wulfgard ×0.773,
Perlica ×0.82, Alesh ×0.81) fits build values the log doesn't record and
the importer assumes at their highest (weapon level 90, promotion,
talents); above 1 (Camille ×1.083, Arcane ×1.068) fits a food buff (the
Ginseng Meat Stew alone doesn't fix 0c14). In c6d80590f5ea every
operator is ×0.100: an enemy-side effect (eny_0090_wgabyss_hdg011).
Avywenna has no log on the site since 1.6.

| Fixture | Enemy | Date, parser, length | First check |
|---|---|---|---|
| `zmdlogs-012ae1c80ae6` | eny_0058_agdisk_hdg015 | 2026-10-13, v58, 61 s | Laevatain 65/113, Akekuri 0/37, Arcane 69/155, Camille 81/130 |
| `zmdlogs-04d401ad257e` | eny_0125_fdcentur | 2026-10-06, v58, 528 s | Ember 0/324, Snowshine 0/225, Purrchena 0/251, Catcher 0/252 |
| `zmdlogs-0c14fb3ce77d` | eny_0134_jsspsi | 2026-10-21, v59, 200 s | Rossi 11/268, Endministrator 0/128, Si 0/194, Alesh 0/54 |
| `zmdlogs-2fd915292bb7` | eny_0124_kltdcap_hdg027 | 2026-10-06, v58, 70 s | Rossi 2/223, Mi Fu 0/90, Snowshine 0/25, Ember 0/21 |
| `zmdlogs-3aa6ab93bad4` | eny_0134_jsspsi | 2026-10-17, v59, 151 s | Zhuang Fangyi 69/199, Perlica 12/42, Arclight 49/75, Arcane 186/186 |
| `zmdlogs-458b03609665` | eny_0120_klbear_tower015 | 2026-10-19, v59, 234 s | Laevatain 383/384, Wulfgard 54/247, Akekuri 18/165, Si 0/389 |
| `zmdlogs-4bfc6f3e84b8` | eny_0120_klbear_tower015 | 2026-10-20, v59, 183 s | Zhuang Fangyi 208/429, Perlica 25/157, Arclight 0/182, Liino 175/175 |
| `zmdlogs-4e3651100056` | eny_0058_agdisk_hdg015 | 2026-10-21, v59, 76 s | Si 152/153, Ardelia 0/130, Wulfgard 72/93, Alesh 0/34 |
| `zmdlogs-92b450306768` | eny_0027_agscorp_hdg002_assult | 2026-10-13, v58, 11 s | Arcane 3/3, Typhoeus 34/34, Liino 0/12, Purrchena 0/0 |
| `zmdlogs-99fb3c35fda2` | eny_0124_kltdcap_hdg027 | 2026-10-06, v58, 60 s | Rossi 0/181, Mi Fu 0/73, Purrchena 0/39, Ember 0/22 |
| `zmdlogs-a7a7a40c97ed` | eny_0120_klbear_tower015 | 2026-10-20, v59, 56 s | Wulfgard 0/45, Arcane 1/269, Si 1/95, Liino 0/49 |
| `zmdlogs-c6d80590f5ea` | eny_0090_wgabyss_hdg011 | 2026-10-21, v59, 93 s | Zhuang Fangyi 18/175, Perlica 3/52, Arcane 24/244, Liino 8/102 |
| `zmdlogs-d4fb69b036fe` | eny_0120_klbear_tower015 | 2026-10-21, v59, 208 s | Endministrator 15/310, Chen Qianyu 212/220, Lifeng 0/189, Pogranichnik 258/258 |
| `zmdlogs-d5720d9ceb94` | eny_0120_klbear_tower015 | 2026-10-21, v59, 159 s | Rossi 457/520, Mi Fu 25/144, Camille 245/284, Gilberta 148/173 |
| `zmdlogs-d774d0ce7bd3` | eny_0134_jsspsi | 2026-10-21, v59, 140 s | Zhuang Fangyi 88/172, Perlica 11/51, Liino 0/100, Arcane 161/161 |
| `zmdlogs-de6a94e9cf6b` | eny_0134_jsspsi | 2026-10-19, v59, 156 s | Pogranichnik 0/84, Lifeng 0/71, Chen Qianyu 2/102, Mi Fu 0/91 |

**With the kit-buff replay (2026-10-22;** `zmdlogs check` takes kit buffs
from the replay of the logged casts, the log's listing where that fits
nothing; docs/design.md, "Kit buffs in the log check"). Matches that went
up: 012ae1c80ae6 Arcane 69 → 155/155, Camille 81 → 122, Laevatain 65 → 75
(Camille's `buff_wpn_lance_0015_atkup` drops out of the log as in 4e5e,
and the damage keeps it); 0c14fb3ce77d Rossi 11 → 12, Si 0 → 7;
458b03609665 Wulfgard 54 → 56; 7e19489ae503 Ember 14 → 16; 99fb3c35fda2
Rossi 0 → 1; a7a7a40c97ed Arcane 1 → 3; c6d80590f5ea Liino 8 → 13
(`buff_chr_0035_liino_atkup` gaps); d5720d9ceb94 Camille 245 → 251. A
fight's killing blow (its last hit, whose uncapped value is the log's
overkill estimate) now counts as under unmodelled effects, not a mismatch:
one hit each for Laevatain (012ae), Ember (04d4), Mi Fu (2fd9), Zhuang
Fangyi (4bfc, c6d8), Wulfgard (4e36), Chen Qianyu (7e19), Rossi (d572).
Nothing went down. The check's report lists, per buff and operator, where
the replay and the log disagree and which the damage fits; the largest
"fits the log" ones (the replay is wrong there) are casts the log shows
no damage of (abfd's `buff_wpn_funnel_0010_atk_up` and
`buff_equipsuit_usp_02_AddAttack`) and the enemy's
`buff_common_affixes_vulnerable_physical` in d4fb, d572 and de6a.

**With the replay's facts (2026-10-25;** docs/design.md, "What the replay
decides": Link, cast-consumed buffs, event counts, own stacks, layers,
Corrosion, crits and casts without damage from the replay of the logged
casts). Gains: d572 Camille plain 121 → 223, Rossi 2 → 35; 458b Laevatain
65 → 148 (fallback 154 → 78); 4bfc Liino 98 → 164; d4fb Chen 14 → 53,
Pogranichnik 82 → 147 (fallback 109 → 53); 012ae Laevatain 21 → 37
(mismatch 37 → 23), Camille 28 → 65 (mismatch 8 → 0); 4e36 Si 33 → 60,
Wulfgard 4 → 26 (mismatch 19 → 13); 3aa6 Arclight 29 → 44. Losses, each a
disagreement the replay now shows instead of a count tried until one fit:
d4fb Chen 8 → 41 mismatches (Glorious Memory instances on her ultimate,
talent layers), Endministrator 9 → 12 and 7e19 Endministrator 0 → 2 (the
Grand Vision her ultimate consumes acts on her crystal shatter in the
timeline, not in the damage), abfd Si 0 → 11 (one Yinglung's Edge layer
short, as in b7b3), 458b Akekuri 147 → 156 (attack 1/2), 0c14 Rossi
256 → 260 and de6a Chen 100 → 102 (matches that fit only with Link one off
the logged sources' count), 458b Laevatain 1 → 7 and c6d8 Zhuang Fangyi
154 → 156, d9e5 Arcane 13 → 15 (no Link: her two battle skills leave the
Corrosion bracket).


## Through the engine's damage path, 2026-10-25

The check now computes each hit through the engine at its landing in the
replay of the logged casts (docs/design.md, "The log check's rule"):
plain and assumed matches are the engine's readings, and a match only the
log's own listing gives is a fallback. Across the 20 pending fixtures
plain 1947 → 1332, assumed 1123 → 346, fallback 1100 → 2736, mismatch
6004 → 5759 (the engine's readings fit hits the log-listing readings
didn't). Every check also compares the fight's totals simulated against
the log's (`zmdlogs check` prints them; the snapshot pins them): the
table gives each fixture's verdicts per operator (plain / assumed /
fallback / mismatch) and its total damage's error (simulated / logged −
1), over all and per operator.

| Fixture | Plain / assumed / fallback / mismatch per operator | Total damage | Per operator |
|---|---|---|---|
| `zmdlogs-012ae1c80ae6` | Laevatain 25/13/52/23, Akekuri 0/0/0/37, Arcane 69/4/82/0, Camille 40/11/79/0 | -14.9% | Laevatain -18.4%, Akekuri +13.8%, Arcane -1.0%, Camille +3.5% |
| `zmdlogs-04d401ad257e` | Ember 0/0/0/312, Snowshine 0/0/0/218, Purrchena 0/0/0/242, Catcher 0/0/0/252 | -8.3% | Ember -14.0%, Snowshine -6.0%, Purrchena -30.0%, Catcher +104.5% |
| `zmdlogs-0c14fb3ce77d` | Rossi 0/0/8/260, Endministrator 0/0/0/128, Si 0/0/7/183, Alesh 0/0/0/54 | -24.0% | Rossi -56.3%, Endministrator +38.6%, Si -5.6%, Alesh +10.5% |
| `zmdlogs-2fd915292bb7` | Rossi 0/1/2/220, Mi Fu 0/0/0/89, Snowshine 0/0/0/25, Ember 0/0/0/21 | -52.3% | Rossi -59.0%, Mi Fu -46.2%, Snowshine +18.1%, Ember -7.4% |
| `zmdlogs-3aa6ab93bad4` | Zhuang Fangyi 14/0/56/114, Perlica 24/5/2/11, Arclight 55/9/5/6, Arcane 86/18/82/0 | -44.4% | Zhuang Fangyi -50.9%, Perlica -29.8%, Arclight +42.6%, Arcane +5.0% |
| `zmdlogs-458b03609665` | Laevatain 171/65/141/7, Wulfgard 129/42/19/57, Akekuri 0/7/2/156, Si 0/0/0/383 | -15.0% | Laevatain -21.5%, Wulfgard -5.2%, Akekuri +9.4%, Si -3.4% |
| `zmdlogs-4bfc6f3e84b8` | Zhuang Fangyi 46/19/160/187, Perlica 45/12/13/87, Arclight 0/0/0/182, Liino 30/8/137/0 | -41.4% | Zhuang Fangyi -48.7%, Perlica -11.4%, Arclight +15.4%, Liino +17.7% |
| `zmdlogs-4e3651100056` | Si 6/3/143/0, Ardelia 0/0/0/130, Wulfgard 4/2/74/13, Alesh 0/0/0/34 | +16.8% | Si +14.5%, Ardelia +158.0%, Wulfgard +18.0%, Alesh +0.0% |
| `zmdlogs-7e19489ae503` | Ember 15/0/1/5, Endministrator 9/7/16/2, Chen Qianyu 0/0/0/20, Pogranichnik 18/5/6/0 | +48.1% | Ember -3.1%, Endministrator +129.8%, Chen Qianyu +10.4%, Pogranichnik +16.1% |
| `zmdlogs-92b450306768` | Arcane 1/1/1/0, Typhoeus 2/1/31/0, Liino 0/0/0/12, Purrchena 0/0/0/0 | -34.8% | Arcane -14.8%, Typhoeus -35.3%, Liino -40.7%, Purrchena n/a |
| `zmdlogs-99fb3c35fda2` | Rossi 0/0/0/181, Mi Fu 0/0/0/72, Purrchena 0/0/0/39, Ember 0/0/0/22 | -62.3% | Rossi -63.9%, Mi Fu -61.2%, Purrchena -75.5%, Ember -18.3% |
| `zmdlogs-a7a7a40c97ed` | Wulfgard 0/0/0/45, Arcane 0/0/1/264, Si 0/0/1/91, Liino 0/0/0/49 | -39.9% | Wulfgard -25.5%, Arcane -33.3%, Si -64.0%, Liino -33.6% |
| `zmdlogs-abfd4b7478ec` | Si 17/3/159/11, Yvonne 3/3/176/1, Xaihi 8/2/65/0, Fluorite 3/0/53/0 | -46.4% | Si -38.0%, Yvonne -63.6%, Xaihi -10.3%, Fluorite -21.6% |
| `zmdlogs-c6d80590f5ea` | Zhuang Fangyi 0/0/16/156, Perlica 0/0/3/49, Arcane 0/0/24/220, Liino 0/0/13/89 | -20.0% | Zhuang Fangyi -33.1%, Perlica +131.8%, Arcane +140.5%, Liino +10.3% |
| `zmdlogs-d4fb69b036fe` | Endministrator 2/1/13/8, Chen Qianyu 31/8/140/41, Lifeng 0/0/3/186, Pogranichnik 90/9/159/0 | -13.2% | Endministrator -38.0%, Chen Qianyu -1.4%, Lifeng +11.8%, Pogranichnik +21.4% |
| `zmdlogs-d5720d9ceb94` | Rossi 94/36/328/61, Mi Fu 23/7/93/21, Camille 143/21/87/33, Gilberta 105/12/31/24 | -44.1% | Rossi -48.2%, Mi Fu -46.2%, Camille -21.5%, Gilberta +13.5% |
| `zmdlogs-d774d0ce7bd3` | Zhuang Fangyi 11/0/77/75, Perlica 8/3/1/39, Liino 0/0/0/100, Arcane 3/2/156/0 | -24.4% | Zhuang Fangyi -37.3%, Perlica -5.5%, Liino +144.7%, Arcane -17.8% |
| `zmdlogs-d9e59d0fb737` | Typhoeus 0/0/0/40, Arcane 0/0/0/15, Liino 0/0/0/0, Gilberta 0/0/0/8 | -26.2% | Typhoeus -37.6%, Arcane -12.3%, Liino -16.4%, Gilberta -15.2% |
| `zmdlogs-de6a94e9cf6b` | Pogranichnik 0/0/0/84, Lifeng 0/0/0/71, Chen Qianyu 0/0/0/102, Mi Fu 0/0/0/90 | -23.2% | Pogranichnik -17.8%, Lifeng -26.5%, Chen Qianyu -0.7%, Mi Fu -30.9% |
| `zmdlogs-e82d45c46040` | Arcane 1/2/2/0, Perlica 0/0/0/2, Si 1/4/16/0, Xaihi 0/0/0/0 | -61.1% | Arcane -44.3%, Perlica +14.8%, Si -63.5%, Xaihi n/a |

## The owner's team, 2026-10-25 (not investigated yet)

Si, Last Rite, Arcane and Xaihi, the owner's team, found by intersecting
the four operators' ZMDLogs character profiles (docs/data-sources.md#zmdlogs),
and one more with Ardelia instead of Arcane. All parser v59, single
target; enemy levels from the stages' DungeonTable entries. First
`zmdlogs check` (match / hits):

| Fixture | Enemy | Date, length | First check |
|---|---|---|---|
| `zmdlogs-b6aa15281db4` | eny_0120_klbear_tower015 (Lv90) | 2026-10-19, 48 s | Si 20/104 (84 unmodelled), Last Rite 14/35, Arcane 0/121 (102 mismatch, ×0.71–0.86), Xaihi 2/29 (27 unmodelled) |
| `zmdlogs-9555de54bb3d` | eny_0127_bigents_hdg032 (Lv90) | 2026-10-22, 97 s | Si 0/85 (82 mismatch), Last Rite 68/68, Arcane 168/168, Xaihi 58/58 |
| `zmdlogs-c3c735dbb022` | eny_0125_fdcentur (Lv80) | 2026-10-25, 115 s | Si 174/185, Last Rite 48/48, Xaihi 0/57, Ardelia 0/184 |

**Last Rite's Mirages (batch 4 G4, in-game test 83).** In b6aa the player
swaps (Xaihi's crystal Amp, which only the controlled operator's Final
Strike gets, goes to Si at 23.15 s and to Last Rite at 27.07 s). After
Last Rite's battle skill at 15.40 s, Arcane's Final Strike at 18.36 s
brings one Mirage pair (`buff_chr_0026_lastrite_normal_skill_phantom` at
18.66 s, the kit's +9 frames); Si's (22.92 s) and Last Rite's own
(26.82 s) controlled Final Strikes within the perfusion's 15 s bring
none. The kit's `mirage` gives each member's perfusion one use, so it
predicts Mirages on both: the log points to one use per cast for the
team. 9555 (Last Rite controlled throughout) and c3c7 (Si controlled
throughout; 6 casts, 6 pairs) don't test a swap but agree. Read from the
site's detail, not yet confirmed by the check; the kit is unchanged.

**Mirages, engine-first check (2026-10-25).** The replay of the logged
casts with Last Rite's kit (`mirage`: every member's perfusion acts once,
batch-4 G4) against the logs:
- b6aa15281db4 (one battle skill, 15.40 s): the log has one Mirage pair,
  at Arcane's Final Strike (18.36 s); none at Si's (22.92 s) or Last
  Rite's own (26.82 s). The engine has one pair at Si's (22.77 s): it
  takes Si's Final Strike as a trigger, but not Arcane's (a replay gap,
  open). With Arcane's counted, the kit's rule would give two pairs
  (Arcane's and Si's) where the log has one: the log points to one use per
  cast for the whole team, the interim before G4 (test 83).
- c3c735dbb022: six battle skills, six logged pairs; the engine has five,
  at other Final Strikes for three of them (which Final Strike is first
  differs). 9555de54bb3d: the engine makes none (its casts aren't all
  replayed; open).
Not changed in the kit: the owner decides (test 83, or these logs).
