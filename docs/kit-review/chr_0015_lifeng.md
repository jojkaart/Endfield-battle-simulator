# Lifeng (chr_0015_lifeng): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0015_lifeng.json (+ equipment kits reviewed: wpn_lance_0009 (default weapon, declares nothing), wpn_lance_0010 (Valiant, its physicalStatus trigger)). Reference: docs/combat-mechanics.md.

## Flags

### F1. Link lasts 20 s in the kit (the combo's ComboAction); the Link buff's data and the reference say 15 s
- **Where:** packages/data/kits/operators/chr_0015_lifeng.json → triggers `combo_link` (`do: link, count 1, seconds: "duration"`, ComboAction at frame 19).
- **Kit has:** Link for the combo's `duration`, 20 s at every level. The note says the Link buff's own literal is 15 s and that the choice is open (report U2, in-game test 78).
- **Expected:** docs/combat-mechanics.md §7.6: "Link is a team stack (`buff_common_affixes_combo_trigger`, 15 s, up to 4 used)." BuffData/buff_common_affixes_combo_trigger.json has duration 15 (literal, `useBlackboardKey` false), which matches the reference. The Camille kit (chr_0033_camille.json, `combo_f47`) takes its Link at `combo_duration` 15 s, so the two combo Links in the same engine differ in length.
- **Why it may matter:** 5 s of Link after each Lifeng combo. Link adds +30 / 45 / 60 / 75% to a battle skill and +20 / 30 / 40 / 50% to an ultimate by stack count (§7.6), and it decides whether Lifeng's ultimate gets its third hit (`link_hit`, castLink). A cast in those 5 s would change damage.
- **Evidence:** BuffData/buff_common_affixes_combo_trigger.json (duration 15); SkillPatchTable chr_0015_lifeng_combo_skill duration 20 (as the kit's source note gives it); chr_0033_camille.json `combo_f47`; docs/in-game-tests.md test 78 (line 1501, the open question the kit cites).
- **Confidence it's a real problem:** medium
- **Verdict:** (phase 3)

## Checked, no conflict found

- Battle skill: two swings at frames 7 and 20 (mask 4352, `atk_scale`) and the slam at 54. At 54, the Vulnerable check and CreateBuff (purify) run before KnockDownAction and the DamageAction, which matches the kit's `beforeDamage` description; team energy after. Consistent with the data order.
- Knock Down duration: the kit's 1.5 s is the KnockDownAction's own `duration` (SkillData, value 1.5, `useBlackboardKey` false). The reference's "Knock Down (10 s)" (§4) is the knockdown buff's default (duration 10 from its blackboard). Not a conflict with the kit as written; phase 3 should confirm the engine uses the action's 1.5 s.
- Combo: ComboAction at 19 (count 1) with a DamageAction at 19 (`atk_scale`, mask 12288), and the second DamageAction at 48 (`atk_scale2`, mask 12288). Matches `combo_link` frame and the two hits.
- Finisher: DamageActions at frames 6 and 33, BreakingAttackCalculation (mask 132). Matches the kit's 0.1 / 0.9 split and frames.
- Potentials: P1 phy_resist_down +0.05 and num 2 (chr_0015_lifeng_potential_1); P5 interval 15 s, atk_scale_potential5 2.5 and poise_potential5 5 (chr_0015_lifeng_potential_5). Match the kit.
- Talent 1: atk_up 0.001 and 0.0015 per point (chr_0015_lifeng_talent_1_1 and _1_2). Matches the kit's source note.
- Talent 2: atk_scale_talent2 0.5 and 1.0 by talent level (chr_0015_lifeng_talent_2_1 and _2_2). Matches.
- Turbid Avatar: purify duration 12 s with its `rate` key; the kit's Physical Susceptibility duration of 12 s. Consistent with §1.1 (Susceptibility is its own pool).
- Equipment wpn_lance_0009: nothing declared, its stat lines are in the panel. Consistent with the equipment rules in §9.
- Equipment wpn_lance_0010 (Valiant): one extra hit on each physicalStatus of the wielder, damageType none, frames 0. The engine emits physicalStatus for Lift, Knock Down, Crush and Breach but not for Shatter (§4). Consistent. Its open skill-type question is test 48, which the weapon kit already records.

## Not checked

- Ultimate: the time stop (0-56), the entity's frames (58, 67, 121), the isCombo / castLink logic and the three hits were not re-derived from SkillData.
- Basic chain (attack1 to attack5) SkillPatchTable values and the Final Strike's SP were not compared.
- The turbid_susceptibility triggers' `fromNone` and `rising` filters against test 64 (Vulnerable events) were not evaluated; the kit flags its own threshold question.
- The talent-2 and P5 handler order was not re-derived from BuffData (the kit documents it).
- Logs: none for Lifeng per the kit; not opened. Hold-out fixtures were not touched.
- Other equipment that names Lifeng was not reviewed beyond the two weapon kits above.
