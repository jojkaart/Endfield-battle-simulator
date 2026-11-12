# Rossi (chr_0028_wulfa): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0028_wulfa.json
(+ equipment kits reviewed: none; the equipment kits that name her were not opened in this pass). Reference: docs/combat-mechanics.md.

## Flags

### F1. Battle skill (Crimson Shadow): charge and lift hits use `atk_scale_1` without the 0.3 / 0.4 factors the data applies
- **Where:** kit → skills[chr_0028_wulfa_normal_skill] hits `charge` (frames 16, 22) and `lift` (frame 35): `scale: ["atk_scale_1"]`, no `factor`
- **Kit has:** full `atk_scale_1` (SkillPatchTable 1.92 at level 12) on each charge landing and on the lift landing.
- **Expected:** SkillData chr_0028_wulfa_normal_skill: the DamageActions at frames 16, 22 and 35 read `atk_scale_once`, and `atk_scale_once` is set by SimpleCalcBB actions to `atk_scale_1 × 0.3` at sai 92 (before the frame-16 hit), `atk_scale_1 × 0.3` at sai 108 (frame 22) and `atk_scale_1 × 0.4` at sai 123 (frame 35). The kit's own batch-4 plan lists these as factors. [DATA] (§1.3 scale; kit-abstractions "Literal factors": SimpleCalcBB ×/÷ on the scale before the DamageAction)
- **Why it may matter:** if the factors apply, each charge is 0.3 × the kit's value and the lift 0.4 ×; the battle skill's non-explosive damage would be overstated about 3× on the charges and 2.5× on the lift. The logs' fit is not stated for these hits, so the size is unquantified here.
- **Evidence:** SkillData chr_0028_wulfa_normal_skill.json SimpleCalcBBAction sai 92 / 108 / 123 (`key` atk_scale_once, operation 2, value2 0.3 / 0.3 / 0.4; value1 `atk_scale_1`). docs/kit-batches/batch-4/chr_0028_wulfa.md (battle-skill rows) for the plan.
- **Confidence it's a real problem:** medium (the data is explicit; the logs may fit the kit as built if the engine applies the factor elsewhere, which this pass did not check)
- **Verdict:** NOT A PROBLEM — the flag read the kit JSON, not the loaded kit: the loaded `charge` hit has `factor: 0.3` (count 2, frames 16 and 22) and `lift` has `factor: 0.4`, both filled from the data's SimpleCalcBB (`efsim kit-draft` / kits.ts). Tested against the log: zmdlogs-4e5e1390085e (verified; Rossi 162 of 162 hits match, 72 plain) with the factors removed in a scratch script gives 3 new mismatches on the battle-skill hits (10016, 10112, 12219 ms).

### F2. Combo sequence 1 (combo_2): its two landings use `atk_scale` without the ×0.35 factor the data applies
- **Where:** kit → skills[chr_0028_wulfa_combo_2_skill] hits `hit` (frame 13) and `hit_2` (frame 24): `scale: ["atk_scale"]`, no `factor`
- **Kit has:** full `atk_scale` (SkillPatchTable 1.5 at level 12) on both landings.
- **Expected:** SkillData chr_0028_wulfa_combo_2_skill: the DamageActions at frames 13 and 24 read `atk_scale_once`, set at sai 27 and sai 42 by SimpleCalcBB `atk_scale × 0.35`. The batch-4 plan (docs/kit-batches/batch-4/chr_0028_wulfa.md, row 20) says "f13, f24 `atk_scale` ×0.35 each". The kit JSON does not carry it. [DATA]
- **Why it may matter:** ×2.86 on each of the two sequence-1 landings if the factor applies (the combo's own ticks, from `combo_2_damagewait`, are a separate question and are not assessed here).
- **Evidence:** SkillData chr_0028_wulfa_combo_2_skill.json SimpleCalcBBAction sai 27 and 42 (operation 2, value 0.35); the batch-4 plan's row 20; docs/open-problems.md (Rossi's combo_2 ×0.94 in 3f78's second window) suggests the logs match the kit as written, which would mean the factor is applied somewhere else. That conflict is why confidence is medium.
- **Confidence it's a real problem:** medium
- **Verdict:** NOT A PROBLEM — the loaded `combo_2_skill` hits `hit` and `hit_2` carry `factor: 0.35` (loaded kit; the JSON does not need to repeat it). Removing it in a scratch script gives 4 mismatches in zmdlogs-4e5e1390085e (combo_2 hits at 29121, 30212, 54674, 55289 ms); with it all 162 Rossi hits match. The open-problems ×0.94 in 3f78 is a separate, small residual, not a missing factor.

### F3. Basic attack 2: the note describes two landings, the kit lists one hit with no frames
- **Where:** kit → skills[chr_0028_wulfa_attack2] hit `hit` (`scale: ["atk_scale"]`, no frames); note "SimpleCalcBB × 0.5 on the dynamic atk_scale before the first DamageAction: two landings at half each."
- **Kit has:** one hit entry and no frames, so the hit count and timing are not recorded; the note refers to two landings.
- **Expected:** SkillData chr_0028_wulfa_attack2: SimpleCalcBB `atk_scale × 0.5` at sai 9, then two enabled DamageActions at frame 5 (sai 10) and frame 9 (sai 18), both mask 128 and `atk_scale`. [DATA]
- **Why it may matter:** the second landing's timing (frame 9) is absent, so the chain's damage timing is missing one landing per attack2. The ×0.5 is correctly described in the note; only the hit representation is missing.
- **Evidence:** SkillData chr_0028_wulfa_attack2.json (DamageActions at f5 and f9; SimpleCalc sai 9).
- **Confidence it's a real problem:** low (the note covers the scale; the omission is in the representation)
- **Verdict:** NOT A PROBLEM — the loaded `attack2` hit has `count: 2`, frames `[5, 9]` and `factor: 0.5` (filled from the data); only the kit JSON omits them. In zmdlogs-4e5e1390085e the 19 logged attack2 hits all match.

### F4. Elite stop (Razorclaw Ambuscade, 3.1 s freeze): the kit gates it on rank 1; the data's gate that creates the 3.1 s elite stop is enemyRankSet 2
- **Where:** kit → triggers[ult_stop_elite]: `if: { enemyRank: [1] }`, applies a freezing control of 3.1 s
- **Kit has:** the 3.1 s freezing control only for rank 1 (Elite, per the reference's rank enum).
- **Expected:** SkillData chr_0028_wulfa_ultimate_skill: `CheckEnemyRank` at sai 51 with `enemyRankSet` 2 gates CreateBuff `buff_chr_0028_wulfa_ult_stopenemy_elite` (sai 53, the 3.1 s stop). `CheckEnemyRank` at sai 62 with `enemyRankSet` 1 gates CreateBuff `buff_chr_0028_wulfa_ult_stopenemy` (sai 64). In docs/combat-mechanics.md §10 rank 2 is Boss and rank 1 is Elite, so the data names the 3.1 s stop after the enemy set the kit gives as Boss. The `enemyRankSet` bit meaning is not written down in the reference. [DATA] / [ASSUMED]
- **Why it may matter:** the 3.1 s freeze and its time stop apply to the wrong enemy class if the mapping is inverted; this is a freeze, so the enemy's clock stops too (§6.3).
- **Evidence:** SkillData chr_0028_wulfa_ultimate_skill.json, CheckEnemyRank sai 51 and 62; kit note "CheckEnemyRank enemyRankSet 2 → … (frame 150 = 93 frames = 3.1 s)" (the kit cites the same key but applies it to rank [1]). Log check not run.
- **Confidence it's a real problem:** low (the enum for enemyRankSet is not in the reference, and the kit's note cites the same key; the mapping needs a check)
- **Verdict:** NOT A PROBLEM — `enemyRankSet` is a bit set, not a rank value: the kit reads bit 1 (value 2) as displayType 1 (Elite) and bit 0 (value 1) as Common, which is why the batch plan calls them "1 normal, 2 elite", and the data names the 3.1 s buff `buff_chr_0028_wulfa_ult_stopenemy_elite`. The flag compared the set value with the §10 rank enum (where 2 is Boss). The kit's note labels the bit reading a claim (batch-4 E2) and tests/kit-rossi.test.ts pins the elite/boss behaviour, but no log or in-game test of a Rossi ultimate on an elite exists; the name evidence is the best there is.

## Checked, no conflict found
- Basic attacks 1, 3, 4 (controlled path and not-controlled path frames 195–213 with the factor 0.5 documented by dataOverride), 5 (Final Strike mask 2097280, controlled-only poise and atb), finisher (mask 132, hits at frames 6 / 15 / 36).
- Battle skill: charge frames 16 and 22, lift frame 35 (its poise unit is `lit 2.0` in data; the kit's note that Lift deals no Stagger of its own matches §5), Wolven Ambrage frame 230 with four launches and `atk_scale_3` (kit `atk_scale_3` 2.88 at level 12 matches the data's key), jump 37 → 215 when Vulnerable is set (documented as judged at the cast).
- Combo sequence 2: frame 37 window, combo_usetimer 6 s, ring at 52, perfect-timing hit at 29 and late hit at 227 (documented compiler limits in dataOverride).
- Combo_3 cooldown and the `SetSkillCdAtOnce` to combo_2 at frame 0 (seq2_cast): as the kit describes; not re-verified against the data in this pass.
- Ultimate: 25 stabs at the frames listed (63–111), Slash 1 at 122 (`atk_scale_2`), Slash 2 at 131 (`atk_scale_3`, Heat infliction), Crit DMG buff at 58 (5 s, ends with the cast).
- Potentials: P1 ×1.15 on atk_scale_1 / atk_scale_3 (battle), atk_scale (combo_2), atk_scale_s / atk_scale_f / damage_add (combo_3), atb_return 10 (matches the PotentialTalentEffectTable rows); P5 potential_5_damage_scale 1.1 and potential_5_critical_damage 0.3 (matches the table; the kit's text says 1.1, the data's ultimate blackboard default is 1.2 and is overwritten by the table).
- Talent 1 (Nicks and Scratches): duration_bleed 15 / 25, atk_scale_bleed 0.25 / 0.30, damage_up 0.06 / 0.12 (matches talent_1_1 / 1_2 rows).
- Talent 2 (Seething Blood): bleed_critical_damage_scale 0.12 / 0.24 (matches talent_2_1 / 2_2 rows). The kit's note records that the bleed crit buff has no cooldown (hasAddingCooldown false; 4e5e shows three procs within 96 ms), so the interval the talent also sets (1.0) is not treated as a cooldown. Not flagged.
- P3: bleed_critical_damage_scale +0.08 and heal_scale +0.04 (noted as inert for the interval, as above).
- Combo_crit buff (`crit_increase_rate` 0.25, `crit_damage_increase_rate` 0.36 from the data's combo_3 blackboard) and its 15 s duration, applied at combo_3 frame 0.

## Not checked
- The power attack's hit frames and mask arithmetic beyond the mask, and the dive attack.
- The projectile entities for the Wolven Ambrage (projhit2–5), their travel times and the four-launch timing.
- Rossi's food/equipment kits (the equipment kits that name her were not opened).
- Log fixtures: no `zmdlogs check` run in this pass; the hold-out fixtures were not opened. The accuracy-plan notes on Rossi's combo and ultimate (open-problems "Rossi's ultimate", "0c14: Si, and Rossi's later windows") were read but not re-tested.
- The bleed tick template timeline that the kit documents as a data quirk (D7g): accepted as documented.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2, F3, F4 · UNCERTAIN: none
All four flags read the kit JSON rather than the loaded kit; the factors, count and frames are filled from SkillData on load, and the verified fixture zmdlogs-4e5e1390085e (162 of 162 Rossi hits match) breaks without the factors (scratch variants).
No new flags. Hold-outs were not opened.
