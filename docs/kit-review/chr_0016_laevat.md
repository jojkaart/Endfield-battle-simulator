# Laevatain (chr_0016_laevat): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0016_laevat.json
(+ equipment kits reviewed: none referenced by the operator kit; signature weapon not identified in this pass). Reference: docs/combat-mechanics.md.

## Flags

### F1. Battle skill entity: ten damage hits after the explosion are not in the kit, and the "dot" scale key is never read
- **Where:** packages/data/kits/operators/chr_0016_laevat.json → skills[chr_0016_laevat_normal_skill] hits `explosion` / `dot`; SkillData chr_0016_laevat_normal_skill_abilityentity (Magma Fragment, spawned at frame 4)
- **Kit has:** three hits for the battle skill: `explosion` (entity DamageAction at 18), `dot` (scale `atk_scale_2`, launch 4), `empowered_extra`.
- **Expected:** SkillData's entity has 11 enabled DamageActions: frame 18 (mask 4352, explosion) and frames 25, 29, 33, 37, 41, 45, 50, 54, 58, 62 (mask 256, battle skill, literal scale 1.0, each with a poise-less unit). Its blackboard has `atk_scale_2 = 0.0`, and no enabled hit in the entity reads `atk_scale_2`. The `dot` hit therefore has no matching DamageAction in the data. [DATA] (§2.1 battle kind; §1.3 scale)
- **Why it may matter:** ten battle-skill hits per cast that the kit does not deal. Each is a battle-skill hit (skill-type DMG applies, mask 256), so battle-skill DMG and Amp/Susceptibility on those hits are missing from the simulated total. Size: unquantified. Each data hit uses a literal scale of 1.0 × ATK (the explosion's own scale key is `atk_scale`, whose entity value is 3.0 and is read by no entity hit), so the total depends on which scale the game applies; a phase-3 check should settle that before sizing.
- **Evidence:** `python3 kr4_sum.py SkillData/chr_0016_laevat_normal_skill_abilityentity.json` (entity dur 100 frames, blackboard atk_scale=3.0, atk_scale_2=0.0, atk_scale_3=0.0; the entity's own hits use literal scales). The 10 hits are not gated by any IfElse in the entity's timeline (only CheckEntityNum with minNum 1 wraps the buff grants, see F2). Log check not run in this pass.
- **Confidence it's a real problem:** medium (the data is clear; whether the game's log counts these as separate hits, and whether the literal scales are the real ones, needs a log check)
- **Verdict:** (phase 3)

### F2. Battle skill grants Melting Flame and team energy at every entity hit, not once; team energy is modelled as one part at frame 22
- **Where:** kit → skills[chr_0016_laevat_normal_skill] `explosion.gains` (MF on first hit only), `teamEnergy: [{frame 22, ratio 1}]`, stacks[melting_flame] note ("gained on the battle skill's first hit")
- **Kit has:** one MF on the explosion hit, and a single `teamEnergy` grant of ratio 1 at frame 22 (entity frame 18 + 4).
- **Expected:** the entity creates `buff_chr_0016_laevat_energy` (1 MF) and `buff_common_obtain_ultimate_sp` at each of its hits at frames 18, 25, 29, 33, 37, 41, 45, 50, 54, 58, 62 (skill frames 22–66). Each is gated only by `CheckEntityNum` (minNum 1, compareType 3, i.e. the fragment still exists), which holds for all 11. The grants set no `ratio`, so the buff's default ratio 1.0 applies at each. MF is capped at 4 (`max_stack`). [DATA] (§7.4 team energy in parts at the `buff_common_obtain_ultimate_sp` frames; §4 stack caps)
- **Why it may matter:** (a) MF: the battle skill alone can reach 4 MF in its first four hits, so the empowered extra hit and Scorching Heart trigger on a different timeline than the kit assumes. (b) Team energy: if each grant is a full part, the battle skill gives up to 11× the energy the kit models; if the parts sum to one share, the timing (frames 22 vs 22–66) still moves the ultimate's charge time. Which reading is right depends on how `ObtainUspInNormalSkill` (coefficient = `ratio`, bb `usp_everyone` 6.5) splits a cast's SP, which §7.4 leaves as ASSUMED.
- **Evidence:** SkillData chr_0016_laevat_normal_skill_abilityentity: CreateBuffAction sai 7/16/24/32/40/48/56/64/72/80/88 (energy) and 8/17/25/33/41/49/57/65/73/81/89 (obtain_ultimate_sp), each with empty `assignItems`; CheckEntityNum sai 6/13/21/… BuffData buff_common_obtain_ultimate_sp (`ObtainUspInNormalSkill`, ratio 1.0). Log check not run.
- **Confidence it's a real problem:** medium (the data is explicit; the energy total depends on the ASSUMED split rule in §7.4)
- **Verdict:** (phase 3)

### F3. Empowered extra hit: the kit's `scale` list includes `extra_scaling`, while its own dataOverride says the data puts `extra_scaling` only on the forced Combustion
- **Where:** kit → skills[chr_0016_laevat_normal_skill] hit `empowered_extra`: `scale: ["atk_scale_3", "extra_scaling"]`, `dataOverride.scale`, `applies[0].scaleKey: "extra_scaling"`
- **Kit has:** the hit's own damage multiplies by `extra_scaling` (listed in `scale`), and the forced Combustion also uses `extra_scaling`. The dataOverride text says the data has `atk_scale_3 ×= ratio` and that "extra_scaling only goes to the forced Combustion buff".
- **Expected:** SkillData: the DamageAction at frame 104 has `atkScale = atk_scale_3` (multiplied by `ratio` at frame 104 via ModifyDynamicBlackboard). `extra_scaling` is assigned only to the CreateBuff at frame 104 (the Combustion). So the data's hit has no `extra_scaling` term. [DATA] (§1.3 scale keys; §3.3 Combustion ticks)
- **Why it may matter:** at P3 the difference is ×1.5 on the extra hit (roughly 25% of the explosion-plus-extra total at P5 per test 20's own figures). The kit follows Zero Sanity's in-game table here, which is evidence, so the choice is documented; but the `scale` list and the dataOverride text contradict each other, so a phase-3 check cannot tell which the kit means.
- **Evidence:** docs/in-game-tests.md test 20 ("Zero Sanity's in-game number fits `extra_scaling` instead (1.5 from P3)"); docs/open-problems.md "Smaller" list; SkillData chr_0016_laevat_normal_skill DamageAction f104 and CreateBuffAction f104 assignItems (`extra_scaling`).
- **Confidence it's a real problem:** low (the choice is deliberate and open; the flag is for the self-contradiction in the kit's text)
- **Verdict:** (phase 3)

### F4. Enhanced battle skill (Twilight): `ratio` on hits 1 and 2 conflicts with the data, and both log fixtures disagree with the kit in opposite directions
- **Where:** kit → skills[chr_0016_laevat_normal_skill_during_ult] hits `hit1` and `hit2`: `scale: ["atk_scale", "ratio"]` and `["atk_scale_2", "ratio"]`, with `dataOverride.scale`
- **Kit has:** `ratio` (×1.2 from P1) on the first two hits, taken from Zero Sanity's table; its dataOverride says the data multiplies only atk_scale_3.
- **Expected:** SkillData chr_0016_laevat_normal_skill_during_ult: the hits at frames 13 (atk_scale) and 23 (atk_scale_2) read no `ratio`; only the frame-98 hit (atk_scale_3) is multiplied by `ratio` (ModifyDynamicBlackboard). The P1 potential table sets `ratio` 1.2 on this skill. [DATA]
- **Why it may matter:** the two hits are the enhanced battle skill's explosion-type damage. With ×1.2 they are 20% higher; test 20 gives both readings (×1.2 vs none, a 2.8× vs 2.4× ratio against the explosion).
- **Evidence:** docs/open-problems.md "Smaller, not yet diagnosed": "`normal_skill_during_ult`: ×0.833 in e989, ×1.083 in db87; its `ratio` key has no value in the data (in-game test 20)". The two logs point opposite ways, so neither reading fits both. The kit cites test 20 but not these two log results.
- **Confidence it's a real problem:** medium (documented as open, but the kit does not record the log outcomes that already contradict each other)
- **Verdict:** (phase 3)

### F5. Enhanced battle skill (Twilight): no team energy, and no returned SP, although the data grants both
- **Where:** kit → skills[chr_0016_laevat_normal_skill_during_ult]: no `teamEnergy`; extra hit note "no energy"
- **Kit has:** no team-energy grant and no SP on the Twilight battle skill.
- **Expected:** SkillData chr_0016_laevat_normal_skill_during_ult: `buff_common_obtain_ultimate_sp` created at frames 13 and 23 (the two hits), and an ObtainCostAction `atb` (returned SP, atbGainMethod 1, atbSourceType 3) at frame 98 on the extra hit. P1's potential table sets `atb` 20 on this skill. [DATA] (§7.3 returned SP gives no energy; §7.4 team energy at the frames)
- **Why it may matter:** team energy on every Twilight battle skill, and the P1 SP return (20 SP, which the kit gives on the plain battle skill's extra hit only, per its note).
- **Evidence:** SkillData chr_0016_laevat_normal_skill_during_ult CreateBuffAction f13/f23 and ObtainCostAction f98; PotentialTalentEffectTable chr_0016_laevat_potential_1 (atb 20 on normal_skill_during_ult).
- **Confidence it's a real problem:** medium
- **Verdict:** (phase 3)

### F6. Enhanced basic attack 2 (Twilight): the kit has one hit; the data has two enabled damage hits and an inflicting structure
- **Where:** kit → skills[chr_0016_laevat_ult_attack2]: one hit `hit` (scale `atk_scale`, `ratio`)
- **Kit has:** one hit, no infliction.
- **Expected:** SkillData chr_0016_laevat_ult_attack2: two enabled DamageActions (frame 10, sai 23, mask 128; frame 21, sai 36, mask 128), both `atk_scale` (default 0.5) with `ratio` set at frame 10. The frame-21 DamageAction is inside the same channelling tick structure; a disabled SpellInfliction sits at frame 21 (isEnable false, so no Heat). [DATA]
- **Why it may matter:** one enhanced BATK hit per sequence is missing. Each is basic-attack DMG, so the total changes by one hit's worth for every ult_attack2.
- **Evidence:** SkillData chr_0016_laevat_ult_attack2.json (timelineActions[20] and [21] DamageActions, both isEnable true; the second is nested in a ChannelingAction actionOnTick). The kit has `ult_attack4` as a two-hit skill, so the omission is not a pattern. Log check not run.
- **Confidence it's a real problem:** medium (I did not confirm that the nested channel tick fires once per attack2 cast)
- **Verdict:** (phase 3)

### F7. Potential 5 (Twilight extension) is not in the kit
- **Where:** kit → buffs[twilight], triggers (none for P5)
- **Kit has:** nothing for potential 5.
- **Expected:** PotentialTalentEffectTable chr_0016_laevat_potential_5: attaches buff_chr_0016_laevat_potential_5 with `extend_duration` 1.0 and `max_duration` 7.0 (modifyType 5). That buff's ability events (id 222 and 203, not mapped here) check for `buff_chr_0016_laevat_ring_start_asset` and re-create `buff_chr_0016_laevat_ult_end` with duration = `extend_duration`, capped by `max_duration`. Potential 5 also sets `ratio` 1.2 on ult_attack1–4 (the kit reads `ratio` on those, so that part is engine-applied). [DATA]
- **Why it may matter:** up to 7 s of extra Twilight per ultimate at P5 (the kit's Twilight stops at 15 s). Twilight is her highest-damage state (accuracy-plan item 8).
- **Evidence:** PotentialTalentEffectTable.json (chr_0016_laevat_potential_5 row); BuffData/buff_chr_0016_laevat_potential_5.json (curr_duration / extend_duration / max_duration; abilityEvent ids 222, 203); buff_chr_0016_laevat_potential_5_cd (10 s cooldown). The trigger event for ids 222/203 is not mapped in this pass.
- **Confidence it's a real problem:** medium (the data is clear that P5 extends Twilight; the exact trigger and cap behaviour need the event mapping)
- **Verdict:** (phase 3)

## Checked, no conflict found
- Basic attack 1, 2, 3 and 5 frames, masks (128; Final Strike 2097280 = 2097152 + 128) and the Final Strike bit on the second landing of attack5 (frames 23 / 26).
- Basic attack 4: hits and projectile launches as the kit describes (not checked against the projectile travel time, which the data omits).
- Enhanced basic attacks 1, 3 and 4: frames, `atk_scale × ratio` (ModifyDynamicBlackboard), Heat infliction on attack3 (enabled) and none on attack4 (both inflictions disabled in the data).
- Battle skill jumps at frame 30 (MF ≥ 4) and the empowered hit's consume at 104; FinishBuff of MF at 104.
- Combo skill: CreateBuff at frame 20 starting `combo_skill_hit` (0.7 s first trigger, one hit per enemy with Combustion or Corrosion), energy `usp_1` 25 matches the kit's `usp_1_display`; combo window opener (COMBO TRIGGER text, combustion and corrosion).
- Finisher: mask 132 (basic + finisher); its two literal scales (1.0 and 4.0) match the 0.2 / 0.8 split in the kit's note.
- Twilight duration 15 s (ult_end) and show_weapon 16 s with its end setting the ultimate cooldown to 10 s (SetSkillCdAtOnce, functionType 1).
- Scorching Heart: talent 1 values (−10 / −15 / −20 Heat RES, 20 s duration, max_stack 4) match the talent table rows; the buff's `ignoreResistance` modifier on attribute 98.
- Final Strike absorb: cooldown 1 s (passive_teammate_cd 1.0), mask 2097156, MF < 4 gate, talent ≥ 1 gate.
- Pause mechanics: pause_ult PauseBuffTime pair, show_weapon's RefrainObtainUsp, combo re-creation every 0.1 s (ChannelingAction, combo_skill frames 0–57).
- Potentials P1 (SP 20 and `ratio` on the battle skills), P3 (`duration` +1.5 s on the forced Combustion and `extra_scaling` ×1.5), P4 (ultimate cost ×0.85): matched by the kit's notes or by the engine's table handling; ratio/extra_scaling values are read from the same blackboard keys.

## Not checked
- Equipment kits: the operator kit references none, and her signature weapon was not identified.
- Talent 2 (shelter when HP ≤ 40%): not in the kit. It has no damage effect and HP is not tracked (§6 and §8.5 of the reference), so it is out of scope for damage; not flagged.
- Potential 1's buffs (`buff_chr_0016_laevat_potential_1`, `_1_1`: +1 MF every 2 s in fight) are not attached by the potential table (only skill edits are), so they are treated as unused. Not confirmed in-game.
- Log fixtures: no `zmdlogs check` run in this pass. Hold-out fixtures were not opened.
- Dive attack, dash attack and the Melting Flame duration (buff_chr_0016_laevat_energy has `duration` 30 with lifeType 1; the kit says "no expiry"): the lifeType meaning is not in the reference, so this was not resolved.
- Hit frames for the projectile of basic attack 4 and the battle skill's entity projectile travel time (not in the data).
