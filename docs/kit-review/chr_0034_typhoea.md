# Typhoeus (chr_0034_typhoea): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0034_typhoea.json (+ equipment kits reviewed: none; not part of this pass). Reference: docs/combat-mechanics.md.

Method: the kit compared with `efsim kit-draft chr_0034_typhoea` (compiled from SkillData), SkillPatchTable level-12 values, PotentialTalentEffectTable and BuffData rows, and the other operator kit that shares the Barrage Array rule (chr_0036_jsspsi).

## Flags

### F1. The Barrage Array's Nature Burst bonus: the kit and the data have no slowed-target condition, but Si's kit note says one is needed
- **Where:** packages/data/kits/operators/chr_0034_typhoea.json → buffs `barrage_array` (target enemy, `damageTaken` = `persistent_naturalburst_increase`, `onlyKinds: [burst]`, duration `persistent_time`). Conflicting note: packages/data/kits/operators/chr_0036_jsspsi.json, its sources paragraph on the combo's Susceptibility ("its damageModifier needs decorate mask 33554432 and a slowed target, so it doesn't apply to Si").
- **Kit has:** the bonus on Arts Bursts only (decorate mask 33554432), while the enemy stands in the array. No slowed-target condition.
- **Expected:** BuffData `buff_chr_0034_typhoea_combo_enemy_debuff` damageModifier: `CheckDamageDecorateMask` (mask 33554432, enabled) and `CheckBuffStackNumAdvanced` on `buff_common_affixes_slow` (value 1, **isEnable: false**). So the data's enabled condition is the mask alone, which agrees with the Typhoeus kit. Si's note says a slowed target is needed, which the data does not enable. [DATA]
- **Why it may matter:** the rule differs between the two kits. The slow check would matter only if it were enabled and the target were not already slowed when the Nature Burst lands. The array slows the same enemies it damages (SkillPatch `persistent_slow` 0.6), so the size should be small; a slow applied after the debuff could still change the first bursts.
- **Evidence:** BuffData buff_chr_0034_typhoea_combo_enemy_debuff.json (damageModifier conditions above); SkillPatchTable chr_0034_typhoea_combo_skill L12 (`persistent_naturalburst_increase` 0.10, `persistent_slow` 0.6, `persistent_time` 6); Si's kit note cites log zmdlogs-0eef2474a26f, where the kit says all ten combo hits match only with the debuff dropped for Si.
- **Confidence it's a real problem:** medium that the rule is inconsistent between the two kits. Low that it changes damage much, since the effect is small and the data's check is off.
- **Verdict:** NOT A PROBLEM — the data's enabled condition is the decorate mask alone: BuffData `buff_chr_0034_typhoea_combo_enemy_debuff` damageModifier has `CheckDamageDecorateMask` (mask 33554432, checkType 2) enabled and `CheckBuffStackNumAdvanced` on `buff_common_affixes_slow` with `isEnable: false`, so the Typhoeus kit (`onlyKinds: [burst]`, no slow condition) reads the data exactly. The inconsistency is in the wording of Si's note, not in either kit's damage: Si's slashes carry the combo mask (12288), not the burst mask, so the debuff the log lists on them doesn't apply, which is what Si's fixtures need (0eef2474a26f: all ten hits exact without it). The "slowed target" reason in Si's note names a check the data disables. Typhoeus's own side is evidenced by fixtures/zmdlogs-dbaee23b801d.json (the debuff listed 52 times, kit note: only on bursts).
  - (Doc only, not damage: chr_0036_jsspsi.json's sources sentence should say "needs decorate mask 33554432 (an Arts Burst)"; the slow check is disabled.)

### F2. Talent 2 (Linken sphere) and the P1 shield-cooldown change are not mentioned in the kit
- **Where:** packages/data/kits/operators/chr_0034_typhoea.json (no talent 2 entry; the sources name only talent 1 and the potentials).
- **Kit has:** nothing for talent 2 or for the P1 effect on the shield's cooldown.
- **Expected:** PotentialTalentEffectTable `chr_0034_typhoea_talent_2_1` and `_2_2` attach `buff_chr_0034_typhoea_talent_linken_sphere` (protect_times 1, damage_resist 0.3, sheild_cd 18, duration 10 s); the P1 entry attaches `buff_chr_0034_typhoea_potential_decrease_sheildcd` (decrease_cd −3). Reference §10: operator HP isn't tracked.
- **Why it may matter:** probably nothing for damage output (a damage-taken shield cannot change the simulated damage when HP isn't tracked). The kit should say so, so phase 3 doesn't read the gap as a missing mechanic.
- **Evidence:** TableCfg/PotentialTalentEffectTable.json (keys above); Json/BuffData/buff_chr_0034_typhoea_talent_linken_sphere.json.
- **Confidence it's a real problem:** low (an undocumented omission, not a damage conflict).
- **Verdict:** NOT A PROBLEM — nothing to simulate: `buff_chr_0034_typhoea_talent_linken_sphere` has only `protect_times` 1, `damage_resist` 0.3, `sheild_cd` 18 and duration 10 s (no damage modifier, no shield-break effect, no attribute change for the team), and the P1 `buff_chr_0034_typhoea_potential_decrease_sheildcd` (decrease_cd −3) only shortens that shield's cooldown. Reference §8 ("Operator HP isn't tracked", [ASSUMED]) already makes a damage-taken shield a no-op in the engine, so omitting both cannot change any hit or timing.

## Checked, no conflict found
- Battle skill's team energy: the kit's frame 12 (window 12–18, `ObtainUspInNormalSkill`) matches the timeline of `chr_0034_typhoea_normal_skill_floating_start` (the action sits in the 12–18 section). The kit's override of the compiler's `buff_common_obtain_ultimate_sp` reading is correct.
- Basic attack 4: SimpleCalc factors atk_scale × 0.35 (atk_scale_1) and × 0.13 (atk_scale_2), as the kit says.
- Power Shot's Nature Burst: `buff_common_natural_natural_triggered_typhoea` has triggerInterval 0.35 s, waitFirstTriggerInterval true, maxTriggerCnt 1. The kit's `enemyDelay` of 10 frames is 0.35 s rounded down from 10.5 frames; the difference is half a frame and I do not flag it.
- Talent 1: `atk_scale_enhence` is set by talent 1 on the floating shots (set, modifyType 3). The kit's values (1.2 / 1.4 / 1.6) were not re-read.
- Potentials: P1 ×1.2 on atk_scale_base (multiply) and the P1 hover ATK (potential_atkup 1, atk_up 0.18); P3 +0.06 persistent_naturalburst_increase (add); P5 arrow_num_given +1, potential_damage_rate 1.1 and potential_damge_up 1.2 (set). All match the kit.
- Power Shot consumption: `enchence_burst_damage_rate` 1.3 at level 12 (SkillPatch) matches the kit's note.
- Combo: SkillPatch L12 atk_scale 2.0, atk_scale_persistent 1.0, persistent_time 6, usp 10 match the kit's sources; the arrow and tick counts come from the SkillData compile, not re-read.
- Barrage Array duration: persistent_time 6 s, as the kit says.
- Hail of Arrows factors (1/3 on atk_scale_outer, 0.08 and 0.6 on atk_scale_center) match the kit's sources.
- P3 combo cooldown −2 s (paramType 2, the combo and its floating version): engine-side, not written in the kit. No kit change expected.

## Not checked
- The timeline frames of the floating chain (shots 1–5, the hover loop, the follow-ups) were checked only through the compiled draft and the kit's notes, not frame by frame.
- Logs: the kit's fixtures (dbaee, 0eef, bdf223, d9e5) were not re-run. The hold-out fixtures were not opened.
- Equipment kits and weapons were not reviewed.
- Finisher: the kit's ×1.0 on a Staggered enemy is marked as not yet seen in any log, and it was not judged.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2 · UNCERTAIN: none
No REAL flag. The phase 2 file checked the kit's numbers and found no conflict; phase 3 found none either.
New flags: none (the Typhoeus kit tests live in tests/batch4-skills.test.ts and the log snapshots; nothing further was checked beyond the two flags).
