# Camille (chr_0033_camille): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0033_camille.json (+ equipment kits reviewed: none; the kit names no equipment kit). Reference: docs/combat-mechanics.md.

## Flags

### F1. Vesperwings explosion lands 0.4 s after the hit in the kit; the logs show 0.29-0.34 s
- **Where:** packages/data/kits/operators/chr_0033_camille.json → triggers `combo_f47_explosion` and `pursuit_f70_explosion`, hit `explosion` (`frames: [12]`, trigger delays 47 and 70, `damageType: battle`).
- **Kit has:** the explosion 12 frames after the cast trigger's frame, which is 0.4 s after combo hit 3 (frame 47) or after Hunter Pursuit hit 4 (frame 70). The `combo_f47_explosion` note says "whose end (0.4 s)".
- **Expected:** the buff's own duration matches the kit: `buff_chr_0033_camille_normal_skill_delay_damage` has duration 0.4 s (BuffData, `duration.value` 0.4). The kit's own note (U2 in docs/kit-batches/batch-4/chr_0033_camille.md, and its row 14) says every logged explosion came 0.29-0.34 s after the hit (6 of 6). Reference §6.1: integer frames at 30 FPS, so 12 frames is 0.40 s. §6.2 (hit-stops, Ti1b / B10) and §6.3 (whose clock) are the reference's candidate explanations for a shorter real gap; the kit cites neither.
- **Why it may matter:** shifts the explosion by 0.06-0.11 s in every combo and Hunter Pursuit on a hovering target. That moves it relative to the ultimate's time stop and other operators' hits in a window (batch-4 notes that an ultimate's stop between the hit and the explosion lengthens the gap, 40d9 9240 → 12951 ms). Damage size not computed.
- **Evidence:** BuffData/buff_chr_0033_camille_normal_skill_delay_damage.json (duration 0.4, bat_atk_scale default 5.0 overridden by the entity's 1.0); docs/kit-batches/batch-4/chr_0033_camille.md row 14 and U2 (fixtures 40d9 and 4e5e, as cited there; not reopened in this pass).
- **Confidence it's a real problem:** medium
- **Verdict:** (phase 3)

## Checked, no conflict found

- Combo frames and costs: DamageActions at 19, 27 and 47 (keys `atk_scale_1_1`, `atk_scale_1_2`, `atk_scale_1_3`, mask 12288); natural atb (costType 1, atbSourceType 3) at 47 before hit 3; usp after it. Matches the kit.
- Combo Link: ComboAction count 1 at frame 47, inside a tag match and a `talent_0 >= 1` check (CompareFloat on talent_0). Kit's `combo_f47` condition matches.
- Combo heal: heal under the same talent and tag gate after hit 3; kit's `combo_f48_heal` (detached, launch 47) matches.
- Hunter Pursuit: DamageActions at 20, 33, 49 and 70 (`atk_scale_2_1` to `_2_4`); atb at 33 and atb_ex at 70 before their hits. Matches.
- Ultimate: channeling damage from frame 75 (`atk_scale_1`), hit at 104 (`atk_scale_2`), hit at 120 (`atk_scale_3`) with a Heat SpellInfliction (inflictionType 0) before the damage at 120, and an atb at 120. Hunter state duration 15 s (ultimate `duration`). Matches.
- Battle skill: the entity's CreateBuff runs at frame 0 (timeline 1-2, autoFinish) before its DamageAction at frame 0 (timeline 5), so `beforeDamage: true` on `abilityrange_first` is supported by the data order. Weak and Heat-susceptibility values: L12 `weak_scale` 0.07 and `vulnerable_scale` 0.07 (SkillPatchTable), P1 +0.05 gives 0.12 as logged. `bat_duration` 45 s, P1 +15 gives 60 s. Matches.
- Potentials (PotentialTalentEffectTable chr_0033_camille_potential_1 to _5): P1 weak/vulnerable +0.05 and bat_duration +15; P2 attributes 40 and 41 +20; P3 combo cooldown −2 s, combo and Hunter Pursuit atk_scale ×1.3 and atb / atb_ex ×1.15; P4 ultimate cost ×0.85; P5 talent-2 atk_up +0.06. Matches the kit's list.
- Talent 2 (chr_0033_camille_talent_2_1): atk_up 0.02, duration 40 s, teammate_rate 0.25. Matches the Bloodfount buff durations (40 s) and the teammate share (0.25).
- Talent 1 (chr_0033_camille_talent_1_1 and _1_2): talent_0 = 1, combo_duration 15, heal_base 30 / 60, heal_sub_multi 0.15 / 0.30 on both combos. Matches the kit's talent gates.
- Combo window: the kit's inflictionConsumed (fire) trigger matches the CharGrowthTable text quoted in the kit and reference §7.5.
- Link source: the kit uses only the combo's ComboAction (and the Hunter Pursuit ComboAction), consistent with §7.6. Link length here is combo_duration 15 s, which equals the Link buff's own literal 15 s.
- Vesperwings modifiers: Weakness (attr 62) and the fire-only Susceptibility zone. Consistent with §1.1 (Weakness ×1 in damage; Susceptibility its own pool).
- Bloodfount stacking: stackingType 2 (layers with timers), cap from its own `max_stack` 5. The kit documents the literal 3 being overridden; not flagged.

## Not checked

- Hit-stops and projectile travel: documented by the kit as unmodelled (Ti1b, Ti2); not evaluated.
- Heal amounts (heal_base, heal_sub_multi) and Bloodfount's per-heal layer count (CheckOverHeal path) were compared only by the kit's notes, not numerically against the log.
- The Hunter Pursuit cast chain (normal_skill_2 → buff cast_combo2 → combo_skill_2) was checked only through the kit's notes, not through SkillData of normal_skill_2.
- The basic-attack chain and dive values were not compared to SkillPatchTable.
- Logs: not opened; log facts were read from the kit and batch-4 docs only. Hold-out fixtures were not touched.
- Equipment: no equipment kit is referenced by this kit; Camille's usual weapon and gear sets were not reviewed in this pass.
