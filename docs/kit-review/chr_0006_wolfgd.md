# Wulfgard (chr_0006_wolfgd): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0006_wolfgd.json
(+ equipment kits reviewed: none). Reference: docs/combat-mechanics.md.

## Flags

No flags. The kit's open items are each written down with their tests or batch notes (battle-skill and extra-shot ordering; P3 teammate scope; the ultimate's forced Combustion frame, test 51 and test 35; the reaction-opened combo window, test 35). None of them is a conflict with the data that the kit misstates.

## Checked, no conflict found
- Ultimate (Wolven Fury): five DamageActions at 46, 52, 59, 64 and 69, atk_scale, mask 4608 (SkillData chr_0006_wolfgd_ultimate_skill.json). The kit writes one hit with no frames; the loader fills the five landings, so the kit does not drop hits. Its forced Combustion (buff_common_fire_fire_burning_triggered, level I, 10 s) is judged at frame 45 per the kit's note.
- Finisher: one landing at frame 34, BreakingAttackCalculation multiplier 1, atk_scale, mask 132. The kit's "multiplier 1" matches.
- Battle skill: launches at 6 and 16 (normal_skill_projhit), the third shot at 23 (the IfElse on SpellInflict: projhit_1 when the flag is set, projhit_FireSpellInfliction otherwise), the extra shot at 141, and the JumpTo at 31 to 118. The jump and the mark at 48 match the kit's note.
- Extra shot: atk_scale_plus 3.78 (SkillPatchTable) and the fail branch atk_scale_plus_fail; the poise key is 0 at every level, as the kit says.
- Combo (Frag Grenade·β): launch at 12, combo_skill_abilityrange at entity frame 0 with a Heat infliction, DamageAction atk_scale with mask 12288, usp 10 (SkillData combo_skill_abilityrange).
- Talent 1 (Scorching Fangs): talent_1_1 / _1_2 attach buff_chr_0006_wolfgd_talent_0 with add 0.2 / 0.3 and duration 10 s (PotentialTalentEffectTable); the kit's buff matches.
- Talent 2: returnskillpower 5 / 10 on the battle skill (talent_2_1 / _2_2), with talent2 set to 1; the kit's sum of returnskillpower and potential_skillpower on the extra shot is as written.
- Potentials: P1 Strength and Agility +15 (attributes 39 and 40), P2 potential_skillpower 10, P3 potential_3 with teammate_percent 0.5, P4 ultimate cost ×0.85, P5 potential_5 on the ultimate (the combo cooldown reset). All match PotentialTalentEffectTable.
- Basic attacks 1 to 4 and the battle skill's frame entries are kit launch frames read from the skill's projectile events; the kit's own note says so and its test (kit-wulfgard.test.ts) asserts the basic attacks at [7, 14], [10, 16], [12, 18, 24] and [23].

## Not checked
- Equipment kits were not reviewed.
- The `zmdlogs check` run was not done; the kit says no log fixture has Wulfgard, so nothing here is log-verified.
- The battle skill's and the basic attacks' DamageAction frames inside their projectile entities were not traced; the kit's launch frames were taken from the skill files.
- The talent 1 buff's stackingType 4 (refreshed, "cannot stack") and the P3 teammate buff's recipients (the finder has no validator, per the kit's note) were not read from BuffData.
- Level 12 SkillPatchTable values (for example the battle skill's atk_scale 0.34 at level 1, and the ultimate's cost) were not re-read.
