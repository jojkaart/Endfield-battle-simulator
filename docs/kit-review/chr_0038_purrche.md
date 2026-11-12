# Purrchena (chr_0038_purrche): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0038_purrche.json
(no equipment kit reviewed: the kit has no equipment references). Reference: docs/combat-mechanics.md.

Scope note: the kit is large (about 81 KB; a shield and block state machine, a counter, the shielded combo and giftbox triggers, and the ultimate's Prezzies). This review checked the basic chain, the counter, the combo's blackhole and boom landings and the ultimate's landings against SkillData. The shield state machine (block_*, loop_*, jumps) was read for shape only.

## Flags

### F1. Stagger units are not on the kit's hit fields for the Final Strike and the counter
- **Where:** packages/data/kits/operators/chr_0038_purrche.json → skills `chr_0038_purrche_attack3` (hit `hit_2`, Final Strike) and `chr_0038_purrche_normal_skill_counter` (hit `hit`)
- **Kit has:** no `poise` field on either hit. Their notes say "As the controlled operator, Final Strike also deals {poise} Stagger" (attack3) and "DamageAction atk_scale (4.0 ...) with poise (20)" (counter).
- **Expected:** SkillData `chr_0038_purrche_attack3.json` frames 21–23 (atk_scale2, mask 2097280) with a damageAttributeType 1 unit (poise, controlled only per the note); `chr_0038_purrche_normal_skill_counter.json` frames 9–13 (atk_scale, mask 4352) with a poise unit. Reference §5: Stagger comes only from damageAttributeType 1 units; Final Strikes' Stagger counts only while controlled.
- **Why it may matter:** Stagger progress for the chain's Final Strike and the counter (20 Stagger per counter in the note). Batch-4 G3a's "3 KNOWN entries" note that some compiled poise units stay apart from their hits; the fold rule (packages/data/src/kitMatch.ts `foldPoise`) may or may not cover these mixed actions.
- **Evidence:** `grep -n poise` on the kit (combo bomb, ultimate bombs and ambassador carry `poise`; the two above do not); SkillData damage units; the kit's own notes.
- **Confidence it's a real problem:** medium (the compiler may fold them; the notes assert the poise)
- **Verdict:** NOT A PROBLEM — the loaded kit has attack3 `hit_2` poise "poise" controlled-only (Final Strike, frame 21) and the counter `hit` poise "poise" (frame 9): filled from the data's poise units.

## Checked, no conflict found
- Basic attack 1: landings at frames 10 and 17 (SkillData atk_scale_1 and atk_scale_2), matching the kit's `hit` (10) and `hit_2` (17). The kit's 0.4 / 0.6 factors on atk_scale are the kit-draft's SimpleCalcBBAction and were not compared numerically.
- Basic attack 2: three landings at 11, 14 and 22, matching `hit`, `hit_2` and `hit_3`.
- Basic attack 3 (Final Strike): landings at 18 (basic) and 21 (Final Strike, mask 2097280), matching `hit` and `hit_2`.
- Dive attack: mask 1152 (basic + dive), one landing over frames 1–6, matching `plunging_attack_end`.
- Finisher: one landing at 24–26 (mask 132), matching `power_attack`.
- Counter (LEAVE MY FRIENDS ALONE!): channel landing at 9–13 with mask 4352 (battle skill) and Nature infliction on the hit, matching the kit's `hit` (infliction natural); the returned SP only "if a block happened" matches the note.
- Combo giftbox (blackhole): pull landings at 1, 16, 31, 46 (mask 8192, combo) and the end landing at 57 (mask 12288), matching the kit's `handicraft_pull` and `handicraft_end` (and their P3 copies). The boom landing at frame 1 (mask 12288, poise unit) matches `bomb` with `poise`.
- Ultimate: blackhole pull at 0, 15, 30, 45 and end at 56 (ultimate kind), the bomb at 0 (poise_1), and the ambassador at 0 (atk_scale_ult, poise_2), matching the kit's `ult_prezzies` hits.
- Combo window (`attacked`, by controlled) matches the CharGrowthTable text quoted in the kit (game code; no trigger action in the data).

## Not checked
- Numeric values: scales (atk_scale_1/2, atk_scale_ult, blackhole scales, the counter's 4.0), SP and energy amounts (atb_return and its P5 variant), cooldowns, potentials and talent values (talent1_prob_up, the Prezzie probabilities).
- The shield state machine (aura_block, block_1/2, loop_1/2, the jumps at 67/135/210/270/360): read for shape only; the frame-by-frame order was not traced.
- Buffs `shield_up`, `protection` (its duration override), `counter_ready`, `arts_susceptibility` (maxStacks 3) against BuffData.
- Log fixtures: only the kit's citations; no fixture was opened (the hold-out fixtures were excluded).
- Equipment kits: none referenced by this operator's kit.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1 · UNCERTAIN: none
The loaded kit has the poise. No log fixture outside the hold-out.
