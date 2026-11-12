# Estella (chr_0021_whiten): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0021_whiten.json (+ equipment kits reviewed: none; the power_attack and log notes name only the operator's own data). Reference: docs/combat-mechanics.md.

## Flags

### F1. Finisher value unverified; the one logged hit does not fit a finisher tier
- **Where:** packages/data/kits/operators/chr_0021_whiten.json → skills `chr_0021_whiten_power_attack`, hit `hit` (`note` and sources entry S3).
- **Kit has:** "Not in a committed log fixture. The one logged hit (btl_upload_39e3cddab245, t=71860) is ×1.215 of atk_scale 9 with the logged buffs and stagger, before the finisher multiplier."
- **Expected:** docs/combat-mechanics.md §5 [DATA]: a finisher is `atk_scale` × the enemy's finisher multiplier, from enemy attribute 27, of 1 / 1.25 / 1.5 / 1.75 by tier. The data's own BreakingAttackCalculation multiplier here is 1 (SkillData `chr_0021_whiten_power_attack.json`, damageUnit atkCalculation multiplier 1, atkScale key `atk_scale`; SkillPatchTable `atk_scale` 9 at level 12). A ×1.215 residual is not a tier, and the kit does not say what produces it.
- **Why it may matter:** every finisher on Estella (9 × ATK at level 12, plus the finisher SP) rests on this one unexplained hit. If the residual is a real term, all finishers are low; if it is a buff or a stagger reading in that log, the kit is right and the note should say which.
- **Evidence:** the kit's sources S3 and the power_attack note. The scratch log btl_upload_39e3cddab245 is not in fixtures/ (the kit says "not committed"); I did not locate it.
- **Confidence it's a real problem:** low (one hit from an uncommitted log; the explanation may be buffs the note doesn't name)
- **Verdict:** (phase 3)

### F2. Battle skill and its Solidification at 76220 ms unexplained, and not in open-problems
- **Where:** packages/data/kits/operators/chr_0021_whiten.json → skill `chr_0021_whiten_normal_skill` (no note on this), sources entry S3. Not in docs/open-problems.md (grep for 76220 finds nothing).
- **Kit has:** S3 says the battle skill and its Solidification at t=76220 are "unexplained (×1.1988, ×1.2841, under stagger and Endministrator's talent_1 ATK buff)". The kit does not model the Endministrator buff's conditional (`buff_chr_0003_endminf_talent_0`, which S3 says applies to some hits when the target carries `buff_common_originum_frozen`).
- **Expected:** the logged battle skill should match the kit once the logged buffs are applied; S3 shows that the Endministrator buff's damage modifier is conditional, and that some Estella hits fit ×1.2 with it. The t=76220 hits have no recorded explanation.
- **Why it may matter:** the battle skill (3.5 × ATK at level 12, plus its Solidification) and its Solidification are the largest Estella hits in that log. The unexplained ×1.20 to ×1.28 suggests a missing condition, either in the kit's buffs or in how the log's buffs are read.
- **Evidence:** the kit's sources S3 (scratch log btl_upload_39e3cddab245, not in fixtures/).
- **Confidence it's a real problem:** low (uncommitted log; the explanation may be in the log reading rather than the kit)
- **Verdict:** (phase 3)

## Checked, no conflict found
- Basic attacks: attack1 / attack2 (`atk_scale`, level 12 values in SkillPatchTable), attack3 (`atk_scale` and `atk_scale2`, both landings), attack4 (`atk_scale` 0.9 at level 12, Final Strike mask 2097280 and atb 19 and poise 17 in SkillPatchTable; the controlled-only poise is the kit's note, not re-read from the poise unit).
- Battle skill: projectile hit at frame 21, `atk_scale` 3.5 at level 12, Cryo infliction (SpellInfliction type 2) in the projectile file, damage type 4 (cryst). P3's dmg_up (0.4, first target only) and its default 0 are stated correctly; `detached: false` with its reason (the projectile does not launch if the cast is cut before frame 21) is consistent with the data's launch frame.
- Combo: the two branches are the data's IfElse on the target's Solidified tag. The Solidified branch creates `buff_chr_0021_whiten_combo_skill_physical_vulnerable` before its DamageAction (frame 19), so `beforeDamage: true` matches §8.4. The non-Solidified branch creates no buff and uses `atk_scale`; both branches apply Lift. Level 12 values: `atk_scale` 3.6, `atk_scale2` 6.3, rate 0.15 (SkillPatch), duration 6 s; P1 adds `rate_plus` 3 to the duration (ModifyDynamicBlackboard on `duration`, gated by `has_potential1` = 1), giving 9 s, and 6 s below P1 (SkillData default rate_plus −0.1 drops out). usp 10 (SkillPatch), cooldown 18 s (17 at level 12).
- Ultimate: `atk_scale` 11 at level 12; the `atk_scale_total` reads `dmg_up_total`, which nothing in SkillData or BuffData writes (it is only read; its default is 0), so the kit's `atk_scale` is right. Lift only on Physical Susceptibility targets (the `if` on enemyModifier). Cost 70, potential 2 ×0.9 (skillParamModifier paramType 1), cooldown 10 s.
- Talent 1 (Commiseration): atb 7.5 / 15 (PotentialTalentEffectTable `chr_0021_whiten_talent_1_1/_2`), frame 21 action (the engine's `delay: 21`), only her own Shatters (in-game test 49). Talent 2 is listed as not modelled.
- P5 energy: `usp` 5 and the 1 s cooldown come from buff `buff_chr_0021_whiten_potential_5` (its own blackboard), which the engine resolves through the trigger's `skill` key (checked by loading the kit through `loadKits`).
- Physical Susceptibility: 15% at level 12 (SkillPatch `rate` 0.15), `susceptibility` zone on `physical`, target enemy, stacking type 0 with two sources adding (in-game test 38, stated in the kit).
- Combo window: COMBO TRIGGER text "When an enemy suffers Solidification" against the `reaction` trigger with `statuses: solidification`; forced Solidifications count (kit note, as the text says).
- The kit loads through `loadKits` without disagreements from the matcher.
- Log: fixtures/zmdlogs-4e5e1390085e.json (cited by the kit) and the multi-target fixture were read only for the kit's own claims; see Not checked.

## Not checked
- Talent 2 ("Laziness Pays Off Now"), P4's attributes and P3's range: listed by the kit as not modelled; not evaluated.
- `teamEnergy` frame of the battle skill (21 in the kit): read from the kit's note, not compared with the data's CreateBuff frame.
- Logs: I ran `zmdlogs check` on fixtures/multi-target/zmdlogs-69e75ed40a8c.json. It matched Estella only 31 of 91 hits, mostly by log-listing fallback, with logged values near 0 on several hits (ratio about 0.001). I judged that fixture unusable for her and did not use it as evidence. The other pending fixture that contains her (fixtures/pending/zmdlogs-a27bc3527682.json) was not run.
- Phase-2 scope only; hold-out fixtures were not opened.
