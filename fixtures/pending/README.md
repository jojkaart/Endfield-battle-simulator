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
- `zmdlogs-dbaee23b801d.json`: 75 of 78 matches only with the log's buff
  listing; Liino (25) and Xaihi (7) have no other. The replay has
  `buff_wpn_funnel_0005_atk_up` (Xaihi's Stanza of Memorials),
  `buff_wpn_funnel_0016_will_atk` and Liino's
  `buff_chr_0035_liino_atkup` / `buff_wpn_lance_0014_damageup` off or at
  other instance counts where the log lists them and the damage has them
  (`zmdlogs check`'s replay section): triggers the replay misses, likely
  casts without logged damage (journal 2026-10-22).
- `zmdlogs-0eef2474a26f.json`: Arcane's 3 matched hits fit only the
  log's listing: the replay has Liino's `buff_wpn_lance_0014_damageup`
  on Arcane at 2.7–3.7 s, which the log doesn't list and the damage
  doesn't have. Typhoeus, Si and Liino verify (14, 5 and 12 matches;
  16, 14 and 1 hits under Corrosion within its range).

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
