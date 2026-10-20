# Batch 4: the 6-star operators

Owner (2026-10-20): "Let's complete the rest of the operators now": the
eleven operators still without a kit, all 6-stars, with every weapon that
has no kit yet (all gear sets have kits since batch 3).

Operators (rarity 6 in CharacterTable): Ember (chr_0009_azrila), Lifeng
(chr_0015_lifeng), Yvonne (chr_0017_yvonne), Ardelia (chr_0025_ardelia),
Last Rite (chr_0026_lastrite), Tangtang (chr_0027_tangtang), Rossi
(chr_0028_wulfa), Pogranichnik (chr_0029_pograni), Zhuang Fangyi
(chr_0030_zhuangfy), Mi Fu (chr_0031_mifu), Camille (chr_0033_camille).

Equipment: the 41 weapons without a kit, each with one owner of its weapon
type (the operator whose report covers it). Equipment is generic: written
relative to the wielder.

| Owner (weapon type) | Weapons |
|---|---|
| Rossi (sword) | wpn_sword_0011 Rapid Ascent, wpn_sword_0012 Thermite Cutter, wpn_sword_0013 Eminent Repute, wpn_sword_0014 White Night Nova, wpn_sword_0016 Never Rest |
| Pogranichnik (sword) | wpn_sword_0017 Glorious Memory, wpn_sword_0021 Grand Vision (and its variant wpn_sword_0021_ink), wpn_sword_0022 Lupine Scarlet, wpn_sword_0024 Complexed Industry, wpn_sword_0026 Farsight |
| Ardelia (arts unit) | wpn_funnel_0006 Opus: Etch Figure, wpn_funnel_0008 Detonation Unit, wpn_funnel_0009 Oblivion, wpn_funnel_0010 Chivalric Virtues, wpn_funnel_0013 Dreams of the Starry Beach |
| Zhuang Fangyi (arts unit) | wpn_funnel_0015 Lone Barge, wpn_funnel_0017 Flickers in the Mist, wpn_funnel_0018 Junction Point, wpn_funnel_0020 Suffering's End |
| Ember (greatsword) | wpn_claym_0004 Exemplar, wpn_claym_0006 Former Finery, wpn_claym_0007 Thunderberge |
| Last Rite (greatsword) | wpn_claym_0008 Sundered Prince, wpn_claym_0013 Khravengger, wpn_claym_0016 Phantom Pain |
| Mi Fu (greatsword) | wpn_claym_0017 Amaranthine Tassel, wpn_claym_0019 Long Heritage |
| Lifeng (polearm) | wpn_lance_0007 Beacon of Duty, wpn_lance_0009 Opero 77 (3-star), wpn_lance_0011 JET |
| Camille (polearm) | wpn_lance_0012 Mountain Bearer, wpn_lance_0015 Blessing of Lustrous Carmine, wpn_lance_0016 Golden Age |
| Yvonne (handcannon) | wpn_pistol_0005 Navigator, wpn_pistol_0007 Home Longing, wpn_pistol_0008 Wedge |
| Tangtang (handcannon) | wpn_pistol_0009 Clannibal, wpn_pistol_0010 Artzy Tyrannical, wpn_pistol_0011 Brigand's Calling |

The split is by weapon type only (no signature-weapon pairing is recorded
in the tables we read); a report may say a weapon belongs with another
operator of its type, and the merge moves it.

Logs with these operators (ZMDLogs fixtures):
- Ember and Pogranichnik: fixtures/pending/zmdlogs-7e19489ae503.json;
- Yvonne: fixtures/pending/zmdlogs-abfd4b7478ec.json;
- Last Rite and Tangtang: fixtures/zmdlogs-b7b3762d5da8.json;
- Rossi: fixtures/zmdlogs-4e5e1390085e.json;
- Camille: fixtures/zmdlogs-40d9a3c1da37.json and
  fixtures/zmdlogs-4e5e1390085e.json;
- none for Lifeng, Ardelia, Zhuang Fangyi, Mi Fu.

Phase: **analysis 1 (2026-10-20)**. Reports: [batch-4/](batch-4/), one per
operator, each ending with a kit plan.
