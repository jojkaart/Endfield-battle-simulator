# Arcane (chr_0032_lizhiyan): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0032_lizhiyan.json (+ equipment kits reviewed: none; not part of this pass). Reference: docs/combat-mechanics.md.

Method: the kit compared with `efsim kit-draft chr_0032_lizhiyan` (compiled from SkillData), SkillPatchTable level-12 values, PotentialTalentEffectTable and BuffData rows.

## Flags

None. Nothing I checked conflicts with the reference or the game data. The kit documents its open points (the window opened by a reaction (test 35), the Gloompurge Arcana length (test 32), the slow-down of Imprisonment (Ti1b, tests 18 and 37), the P5 cooldown meaning (V7, test 36), and the INT battle skill's ×2.23 in one log). They were not judged.

## Checked, no conflict found
- Finisher: the five BreakingAttackCalculation objects are 0.1 four times and 0.5 once, and the kit's landings (7, 10, 13, 32, 34 at 0.1; 36 at 0.5) total 1.0 of atk_scale. The kit says the 32/34 pair shares one action and needs verifying; that is documented.
- Ultimate: `duration` 20 s (the array) and `duration2` 15 s (the forced Corrosion) match SkillData; `energyBlockSeconds` 1.567 is frame 47 / 30.
- Imprisonment: INT = duration_pre 0.633 + duration 4.0 = 4.633 s; WILL = 0.633 + duration_will 6.0 (SkillPatch L12) = 6.633 s. Both match the kit's note.
- Potential 1: atk_scale_touch multiplied by 1.3 (multiply), as the kit says.
- Talent 1: enhance_rate +0.16 on the Arts Amp; it is applied only when the talent level is above 0 (the kit's guard).
- Battle skill: team energy at frame 20, in line with the note.
- Cluster Strike: the kit's energy (`percentOfMax` 0.5, then 1 on the second strike) and the array's 2-strike rule match the listener design described in the kit's sources.
- The forced Corrosion (level 1, duration2 15 s) matches reference §3.5's 15 s duration.

## Not checked
- The laser frames of the ultimate's entities (15/19/23/27 and 12/16/20/24) were not compared with the SkillData entity timelines, only with the kit's note.
- Gloompurge Arcana's 10 s length (the kit uses ChangeSkillAction with a literal 10; test 32 is open).
- No log was re-run for this review. The kit's own verifications (btl_upload_b7b3762d5da8 and others) were taken at face value, and the hold-out fixtures were not opened.
- Equipment kits and weapons were not reviewed.
