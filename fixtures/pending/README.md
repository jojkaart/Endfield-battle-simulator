# Pending log fixtures

Imported battle logs that the log test (`tests/logs.test.ts`) doesn't run
yet, because something outside the kits doesn't match. Move a file up to
`fixtures/` once it passes (`efsim zmdlogs check <file>`).

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
