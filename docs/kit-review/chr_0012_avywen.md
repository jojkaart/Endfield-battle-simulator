# Avywenna (chr_0012_avywen): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0012_avywen.json
(+ equipment kits reviewed: none; not referenced by the operator kit). Reference: docs/combat-mechanics.md.

## Flags

None. No conflict with the reference or the game data was found in the areas below. Phase 3 can skip this operator's flags unless the notes in "Not checked" are picked up.

## Checked, no conflict found
- Basic attacks 1 and 4: attack1 DamageAction at frame 7 (mask 128, `atk_scale`), ObtainCostAction atb on the controlled operator (atb 0 at every level); attack4 DamageActions at frames 5 (`atk_scale`) and 18 (`atk_scale_2`), each with an atb cost (`atbSourceType` 1), as the kit's hit list has them.
- Power attack: three landings at frames 27, 28, 29 with the kit's multipliers (0.3 / 0.2 / 0.5, summing to 1.0); mask 132; the two later landings have a costType 1 ObtainCostAction with no value (0 SP), as the kit's notes say.
- Battle skill (Thunderlance: Interdiction): DamageAction at frame 18 (mask 4352, `atk_scale`) with `buff_common_obtain_ultimate_sp` created at 18 (teamEnergy); returning lances launch at frame 7, one per lance layer (`ForEach` with `lance_back` per lance; `atk_scale_lance` 0.5 in the blackboard); the lance-recall CreateBuff at frame 7 (`lance_becalled`).
- Combo: DamageAction at frame 14 (mask 12288, `atk_scale`, poise 10); its only ObtainCostAction costs `talent0_usp` (none of the combo's ObtainCost actions reads `usp`), which confirms the kit's note that SkillPatchTable's combo usp 10 is read by no action.
- Ultimate: DamageAction at frame 51 (mask 4608, `atk_scale` 5.0), with the talent-2 debuff `buff_chr_0012_avywen_ultimate_skill_debuff` created at frame 51 before the hit (the kit's beforeDamage). The EX lance is spawned at frame 45 (the kit's trigger, as the data's LaunchProjectile at 45 has it). Damage immunity is created at frame 0 (`buff_common_damage_immune_ult_skill`); the ultimate's time stop was not read in this pass.
- Lance lifetime: the combo lance's `Jump` (frame 0 → 1500) and the 900-frame block with `potential_2` compare: 30 s by default, 50 s at P2 (potential_2 +20). This matches the kit's `lance_duration` + `potential_2`.
- Talent 1: `talent0_usp` 2.0 at P1 (table row), 3 at talent level 1, 4 at level 2 (matches the kit's sources and the table rows talent_1_1 / 1_2 and potential_1).
- Talent 2 (Tactful Approach): `pulse_vul_rate` 0.06 / 0.10 and `pulse_vul_duration` 10 (talent_2_1 / 2_2 rows); the kit's `tactful_approach` buff is gated by `pulse_vul_duration > 0`.
- Potentials: P1 talent0_usp +2.0; P2 potential_2 +20 (lance lifetime); P3 stat rows (Will +15 and attribute 52 +0.08, stat panel only); P4 ultimate cost ×0.85 (paramType 1, modifyType 2, 0.85 on the ultimate; the kit's "85 at P4"); P5 `potential_5_rate` 1.15 on the battle skill's lance hits (the kit's `extraScale` under `potentialAtLeast 5` and the enemy-zone condition).
- Combo window: CharGrowthTable's COMBO TRIGGER text (Final Strike with Electric Infliction or Electrification) is as the kit writes it.

## Not checked
- The Thunderlance EX pulse-check buff (`buff_chr_0012_avywen_lance_pulse_check`, 0.3 s lockout) and its Electric infliction on the first returning EX lance; the kit's description of its start event was not compared with the buff's own actions.
- The P5 `enemyModifier` condition on the lance hits (which zone and which enemy state it reads): not traced.
- The lance projectile files (`lance_out`, `lance_land_pos`) and their flight times (the kit states they are not in the data, and that the lance lands at frame 7 as a lower bound).
- The `talent0_usp` values on the ObtainCostAction `coefficient` of attack4 (the kit's 0.5); the coefficient was not printed in this pass.
- Dash attack, extra attack and dodge: not kit skills (kit sources say so).
- Log fixtures: no `zmdlogs check` run in this pass; the hold-out fixtures were not opened.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: none (no flags) · UNCERTAIN: none
No new flags. No non-hold-out log fixture contains Avywenna, so nothing here is log-tested. Checked: the loaded kit's hits against `efsim kit-draft` (frames, counts, factors 0.3 / 0.2 / 0.5 on the power attack, `talent0_usp` energy on the combo, ultimate and lances, a battle-skill `teamEnergy` at frame 18, poise keys, the lance layers as counts): same. Unchecked and still open: the lance flight time and the EX pulse buff's lockout (kit notes say so), and the P5 `enemyModifier` condition. Hold-outs were not opened.
