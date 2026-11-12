# Chen Qianyu (chr_0005_chen): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0005_chen.json
(+ equipment kits reviewed: none). Reference: docs/combat-mechanics.md.

## Flags

No flags. The kit's known gaps are all written down with their tests or batch notes (Momentum Breaker not modelled, batch 3 E1; P1 Shadowless HP condition, test 69; combo window on Vulnerable, test 64; Slashing Edge stacking, test 62; the ultimate's P5 `phy_up` branch). None of them is a conflict with the data that the kit misstates.

## Checked, no conflict found
- Basic attacks 1 to 4: two landings in attack1 (frames 8, 11), one in attack2 (frame 7), two in attack3 (9, 12) and two in attack4 (4, 10), all atk_scale with mask 128. The kit writes one hit per attack with no frames, and the loader fills them from SkillData (the existing test kit-chen.test.ts asserts those landings).
- Attack 5 (Final Strike): one DamageAction at frame 16 with mask 2097280 and a poise unit (onlyEnableForMainChar); the kit's poise and atb "only when controlled" notes match.
- Finisher: two landings at frames 5 and 29 with BreakingAttackCalculation multipliers 0.2 and 0.8 (SkillData chr_0005_chen_power_attack.json). The kit's frames match, and the factors are filled by the loader (kit-chen.test.ts checks them).
- Battle skill (Ascending Strike): damage at frame 13, mask 4352, poise unit at 13; Lift written as not forced, which matches §4 (an enemy without Vulnerable only gains a stack).
- Combo (Soar to the Stars): damage at frame 17, mask 12288; usp 10 (SkillPatchTable); the aura and the Lift's applies entry.
- Ultimate (Blade Gale): slash1 at 58 (the only slash with a poise unit), slashes at 63, 68, 72, 76 and 80 (mask 4608), final at 103 (atk_scale2, potential5 branch); all match SkillData.
- Talent 1 (Slashing Edge): talent_1_1 / _1_2 attach buff_chr_0005_chen_talent_0 with atk 0.04 / 0.08, duration 10 s and max_stack 5 (PotentialTalentEffectTable); the kit's talent-level 2 value of 0.08 matches.
- P1 Shadowless: extra_dmg 0.2 and hp_remain 0.5 on the buff (PotentialTalentEffectTable potential_1), as the kit writes.
- P2 (attribute 40 +15, the kit's Agility; attribute 50 +0.08, the kit's Physical DMG +8%), P3 (×1.1 on the ultimate's atk_scale1 and atk_scale2, the battle skill's atk_scale and the combo's atk_scale), P4 (ultimate cost ×0.85), P5 (combo cooldown −3 s; potential5 = 1 on the ultimate): all match PotentialTalentEffectTable.
- Combo window: the trigger `vulnerable` by anyone, as the kit states; its uncertainty is recorded (test 64).

## Not checked
- Equipment kits were not reviewed.
- The `zmdlogs check` run and fixture logs were not re-run; the kit's log claims were not re-verified.
- Talent 2 (Momentum Breaker, 5 / 10 Stagger per interrupted charge) was not checked against the engine, because the kit says it is deliberately not modelled (batch 3 E1).
- The dash attack, the dive attack's jump and the combo's EventListener (abilityEvent 55, cd_reduction) are outside the kit by its own note; not reviewed.
- The combo's Lift has floatingDuration 0 in the data; the Lift length is outside the kit (nothing reads it, per the kit's note); not checked further.
- Level 12 SkillPatchTable values (for example attack1 atk_scale 0.23 and the ultimate's cost 70) were not re-read.
