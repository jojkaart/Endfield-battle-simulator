# Ember (chr_0011_seraph): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0011_seraph.json
(+ equipment kits reviewed: none; not referenced by the operator kit). Reference: docs/combat-mechanics.md.

## Flags

None. No conflict with the reference or the game data was found in the areas below. Phase 3 can skip this operator's flags unless the notes in "Not checked" are picked up.

## Checked, no conflict found
- Basic attacks 1–4: one projectile landing each (attack1 at 10, attack2 at 7, attack3 at 8, attack4 at 7 and 12), mask 128 on the landing, atb on attack1 only when controlled (data: ObtainCostAction atb at the projectile's DamageAction). attack4's two launches are in the kit's note; the hit entry carries no frames (representation only, not a conflict).
- Attack5: DamageAction at frame 19, mask 2097280 (Final Strike), atb 15 for the controlled operator, poise only for the controlled operator (`onlyEnableForMainChar`).
- Finisher: mask 132, multiplier 1.0 (no factor), as the note says.
- Battle skill (Auxiliary Crystal): atb (ObtainCostAction) at frame 6, the crystal's spawn tick at frame 7 + 30 = 37, teamEnergy at frame 37 ratio 1 (the same tick creates `buff_common_obtain_ultimate_sp`); no damage hits (correct: the data has no DamageAction in the battle skill).
- Crystal treatments: Final Strike mask 2097152 gate, 0.3 s per-member marker, two treatments (crystal_heals reset at the crystal's spawn), cooldown 0.3 on both `crystal_count` and `crystal_heal`, `crystal_heal` delayed 8 frames (first tick at 0.25 s), gain applied at the hit so `crystal_heal` sees the count before it (as the kit states).
- Combo: the Cryo infliction and its Arts-burst ordering (`SpellInfliction` at frame 0 before the DamageAction, mask 12288, Cryo); usp 10 on hit; combo_skill_projhit carries the damage (launch at 24); `atk_scale` is patched from SkillPatchTable (the blackboard default is 0 in both files, so the kit's 4.5 at level 12 is the only source).
- Talent 1 (Cryo fragility): cryst_up 0.07 / 0.10 and duration 5 s on the combo (talent_1_1 / 1_2 rows); `exist_talent_1` gate.
- Potentials: P1 atk_up +0.05 on the battle skill (table row: add 0.05 to `atk_up`); P2 ultimate cost ×0.9 (paramType 1, modifyType 2, 0.9); P3 `potential_3` on the combo (bounce, no effect against one); P4 Intellect +15 and Treatment Efficiency (attribute rows, stat panel); P5 ×1.1 on `atk_up`, `wisd_up`, `wisd_max` (table rows; the kit's logs check in its own notes, zmdlogs-dbaee23b801d and -abfd4b7478ec, agrees with the cap applying to the Intellect part only).
- Ultimate: TimeDilation at frame 0 and channelling cast; the team's Amp buffs at frame 58 (`atk_buff` and `atk_buff_2` created at 58, per the kit); the stack-overflow value as `min(Intellect × wisd_up, wisd_max) + atk_up` (BuffData `atk_buff`: StoreAttributeValue attr 41, IfElse on `final_atkup` vs `wisd_max`, SimpleCalc adds `atk_up`); the two EnhancedAction child buffs (12 s each, subType 3 and 5, rate `final_final_atkup`).
- Duration 12 s for the ultimate's Amp, 25 s for the crystal's amp buff (`buff_duration`), and 20 s for the crystal itself (`duration` from the battle skill), as in the kit's sources.

## Not checked
- The EnhancedAction `subType` values 3 and 5 (the kit maps them to Cryo and Nature without citing the enum; subType 1 is cited as "all four Arts elements" in the kit's note). Not verified against the enum.
- The talent 2 Dispel (Cryo Infliction and Solidification) on the team at the ultimate: the kit's description is not re-checked against the dispel action in the data.
- The crystal's aura entity (`normal_skill_abentity_onfield`) and its frames 1–901, and `buff_chr_0011_seraph_combo_count`'s 10 s layer expiry (the kit's open question U2 / B4, in-game test 70).
- Dash attack, extra attack and dodge: not kit skills (kit sources say so; dash attacks are deferred).
- Heal amounts (not modelled by the kit, as stated).
- Log fixtures: no `zmdlogs check` run in this pass; the hold-out fixtures were not opened.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: none (no flags) · UNCERTAIN: none
No new flags. Checked: the loaded kit's hits against `efsim kit-draft` (frames, counts, atb, usp: same), and the logs: the verified zmdlogs-dbaee23b801d (7 hits, 6 plain, 1 assumed, 0 mismatch, 0 unmatched landings) and the pending zmdlogs-abfd4b7478ec (75 hits, 72 plain), -9555de54bb3d (58, 39 plain) and -b6aa15281db4 (29, 22 plain, 5 under unmodelled effects) have no Ember mismatch. zmdlogs-c3c735dbb022 shows Ember's hits all at ×0.337 of the prediction, every hit type alike (basic, combo): a build offset (level or stats), not a kit shape, in a fixture with 242 problems. The talent-2 Dispel at the ultimate (SkillData sai 31) has no damage effect (operator statuses are not simulated), as the kit's note says. Hold-outs were not opened.
