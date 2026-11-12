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

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: none (no flags) · UNCERTAIN: N1
No REAL flags. Fixtures exist for Chen (phase 2 had not run them): a27bc3527682 (59 hits: 45 plain, 7 assumed, 7 mismatch), 7e19489ae503, de6a94e9cf6b (102 hits, 81 match).

### N1. Ultimate slashes in a27bc3527682 are 8.8% high (engine ×1.096 of the log)
- **Where:** packages/data/kits/operators/chr_0005_chen.json → skills[chr_0005_chen_ultimate_skill]
- **Kit has:** slashes at 63..80 and the final at 103 (frames match SkillData).
- **Expected:** logged 11411 / 12020 / 12628 / 13237 / 13846 / 13846 at 21.5 to 22.2 s and 174865 at 25.2 s; the engine predicts ratio 0.912 on all seven, while Chen's other 52 hits there match. The `check` listing shows the engine adding chr_0005_chen:wpn_sword_0017.ready (damageBonus 0.336) and Aglina's arts_susceptibility 0.3 on these hits, which the log doesn't list (the log lists wpn_sword_0017_valid 0.336 instead), so the surplus comes from a weapon kit or another operator, not from Chen's scales.
- **Why it may matter:** the seven hits are the whole ultimate in that log; if the weapon buff is counted twice, Chen's ultimate is overcounted by 9.6% with that weapon.
- **Evidence:** `zmdlogs check fixtures/pending/zmdlogs-a27bc3527682.json` (lines on wpn_sword_0017.ready and aglina:arts_susceptibility).
- **Confidence it's a real problem:** medium, but for wpn_sword_0017 / Aglina, not the Chen kit
- **Verdict:** UNCERTAIN — the Chen kit's own values match; the surplus factor belongs to another kit.
  - **Decides it (if UNCERTAIN):** the owner of wpn_sword_0017's and Aglina's kits checks whether `ready` duplicates the logged `valid` entry and whether Aglina's susceptibility should be on at 21.5 s.

Also seen: 7e19489ae503 has every Chen hit at ×1.15 (a build or enemy-level offset, same ratio on all, not a kit pattern); de6a94e9cf6b ultimate hits are +0.4% (rounding). Shadowless (log lists 0.2 on 26 hits, engine omits it) is the documented P1 HP condition (test 69).
