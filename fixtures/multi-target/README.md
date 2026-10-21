# Multi-target log fixtures

Battle logs against several enemies at once, imported with `efsim zmdlogs
import` (it puts a battle here when its hits land on more than one enemy
ID). Each hit names its `target`; enemy-side buffs are matched to the
target's enemy type, so enemies of one type (summoned hounds) aren't told
apart. The enemy level comes from the stage (DungeonTable), or 90 is
assumed (provenance notes say which).

The engine doesn't model several targets yet, so `tests/logs.test.ts`
doesn't run these. They're kept for developing multi-target support.

| Fixture | Stage | Enemies | Team |
|---|---|---|---|
| `zmdlogs-0206142f9134.json` | — (2026-10-04, v57, 117 s) | eny_0048_hvybow (269), eny_0007_mimicw (236), eny_0027_agscorp (196), eny_0073_slimerg (106) | Laevatain, Camille, Antal, Arcane |
| `zmdlogs-064bafebf7b0.json` | — (2026-10-20, v59, 83 s) | eny_0023_aghornb_tower011 (272), eny_0047_firebat_tower011 (261), eny_0093_hshog_tower011 (176) | Laevatain, Si, Arcane, Ardelia |
| `zmdlogs-10df8c76ccda.json` | — (2026-10-20, v59, 185 s) | eny_0070_agscorp2 (336), eny_0093_hshog (308), eny_0055_hscrane (141) | Endministrator, Chen Qianyu, Da Pan, Pogranichnik |
| `zmdlogs-146d5ae8c480.json` | — (2026-10-06, v58, 247 s) | eny_0120_klbear (585), eny_0117_klhound_klbearsummon (14) | Ember, Snowshine, Purrchena, Catcher |
| `zmdlogs-3440cf450fea.json` | — (2026-10-01, v57, 101 s) | eny_0093_hshog_tower011 (188), eny_0047_firebat_tower011 (174), eny_0023_aghornb_tower011 (111) | Camille, Laevatain, Wulfgard, Antal |
| `zmdlogs-82735c6db6fc.json` | Beast File: Qingbo Stockade - Brutal (2026-10-21, v59, 149 s) | eny_0070_agscorp2 (233), eny_0093_hshog (231), eny_0055_hscrane (144) | Endministrator, Chen Qianyu, Lifeng, Pogranichnik |
