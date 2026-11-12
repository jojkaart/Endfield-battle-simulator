# Liino (chr_0035_liino): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0035_liino.json
(+ equipment kits reviewed: none). Reference: docs/combat-mechanics.md.

## Flags

### F1. Finisher: the kit has three 0.1 landings at frames 12, 15 and 18; the data has one at 12
- **Where:** packages/data/kits/operators/chr_0035_liino.json → skills[chr_0035_liino_power_attack].hits[ticks] (frames [12, 15, 18], scale atk_scale) and hits[final] (frames [34])
- **Kit has:** "BreakingAttackCalculation multipliers 0.1 (frames 12/15/18) and 0.7 (34): 3 × 0.1 + 0.7 = 1 × atk_scale (9.0)", as four landings at full atk_scale.
- **Expected:** SkillData chr_0035_liino_power_attack.json has two DamageActions: frame 12 with a BreakingAttackCalculation multiplier of 0.1, and frame 34 with a multiplier of 0.7 (GainBreakingAttackAtb at 34). The file has no DamageAction or breaking multiplier at frames 15 or 18. The landings in this file sum to 0.8 of atk_scale, not 1.0. (combat-mechanics, "How to use this when reviewing a kit", step 1: hits against SkillData, frames and count.)
- **Why it may matter:** if the file is the whole finisher, the kit's two extra 0.1 landings add 0.2 of atk_scale (about 1.8 of the 9.0 the kit sums to), a roughly 25% overcount of this finisher's damage. Each landing is also a Stagger or poise event if the unit carries one. No log fixture logs Liino's finisher (kit note), so nothing confirms the 15 and 18 frames.
- **Evidence:** packages/data/kits/operators/chr_0035_liino.json (the two hit entries and the note); Json/SkillData/chr_0035_liino_power_attack.json (DamageAction and BreakingAttackCalculation at timeline frames 12 and 34 only; the whole file was searched). Compare Si's and Chen's finishers, whose explicit frames and multipliers match their SkillData.
- **Confidence it's a real problem:** medium
- **Verdict:** (phase 3)

### F2. Starry Boost's SP: the kit's value is the talent rank 1 value; rank 2 gives 10
- **Where:** packages/data/kits/operators/chr_0035_liino.json → triggers[starry_boost_start] and triggers[starry_boost] (`sp` value `atb_return`); sources, "Talents and potentials" and the note on SkillData defaults ("atb_return 5")
- **Kit has:** `atb_return` as a plain key, described as the SkillData default of 5.
- **Expected:** TableCfg/PotentialTalentEffectTable.json: chr_0035_liino_talent_2_1 sets combo_skill `atb_return` to 5.0 (skillBbModifier, modifyType 3); chr_0035_liino_talent_2_2 sets it to 10.0. Both set talent_b 1.0 and atb_return_duration 30. SkillPatchTable has no combo `atb_return`. The kit does not name which talent rank it models.
- **Why it may matter:** 5 or 10 SP returned to the next Pulse or Nature battle skill, once per combo cast. The SP is returned (method 1), so it gives no ultimate energy but does change the rotation's SP.
- **Evidence:** the two PotentialTalentEffectTable rows above; the sources line in the kit.
- **Confidence it's a real problem:** low (it depends on whether the plain key reads the talent-modified blackboard at runtime, which the kit does not say)
- **Verdict:** (phase 3)

### F3. Talent 1 (Shelter / healing taken) is neither modelled nor listed as out of scope
- **Where:** packages/data/kits/operators/chr_0035_liino.json → sources (the talent section covers talent 2 only); no buff or trigger for talent 1
- **Kit has:** nothing for talent 1.
- **Expected:** TableCfg/PotentialTalentEffectTable.json: chr_0035_liino_talent_1_1 and _1_2 set, on normal_skill and ultimate_skill, `shelter` −0.1 / −0.2, `healtaken_rate` +0.1 / +0.2, `shelter_duration` 3 s, and `talent_a` 1. combat-mechanics has no rule for shelter.
- **Why it may matter:** if Shelter reduces damage taken by the team, it is a damage-taken term on enemy hits, and enemy damage is not simulated (§1.1), so no damage changes here. If it is a shield or a heal term, it is out of scope. Either way the kit should say which, so phase 3 can close it.
- **Evidence:** the PotentialTalentEffectTable rows above.
- **Confidence it's a real problem:** low
- **Verdict:** (phase 3)

## Checked, no conflict found
- Battle skill: six projectile hits at atk_scale (normal_skill_projhit and projhit_02 ×5) with the stance buff applied before the first hit; the kit's log claim (6/6 in 0eef2474a26f and bdf223db8e49) was not re-run.
- Ultimate beats: nine beats at 77 + 45k (ultmusic_trigger 1.5 s from SkillPatchTable, frames 77 to 437); finale at 508; Cosmovoice duration 15 s and finish_duration 0 (SkillPatchTable).
- Ultimate projectiles: entity launches at frame offsets 0, 3, 6, 8, 11, 15, 18, 21, 25, 28 from ultimate frame 76 (chr_0035_liino_ultimate_skill_projhit_abilityentity); the bomb at offset 40 with atk_scale_2 (2.84 at level 1, with the forced Electrification).
- Ultimate amp: min(will_up × Will, will_max), with will_up and will_max both ×1.2 at P5 (potential_5); ATK +0.06 at P1 on both stances (potential_1). The kit's level 12 values were not re-read.
- Combo: 2 hits (atk_scale 0.6, atk_scale_2 1.0), usp 20 (SkillPatchTable); P3 atk_scale and atk_scale_2 ×1.4 and combo cooldown −1 s (potential_3).
- Talent 2's starry_boost_start trigger: created by the combo after its frame-33 hit, while talent 2 is learned (talent_b 1.0); duration 30 s, consumed by the next Pulse or Nature battle skill (the kit's trigger matches the data).
- Basic attacks 1 to 5 and the plunging attack: two landings in attack1 (frames 3 and 7), one in attack2 (frame 7, inside ChannelingAction 7 to 19), one in attack3 (frame 12, plus the attack3 projectile entity), attack5 Final Strike at 17 with poise onlyEnableForMainChar, plunging attack landings at 2 and 8. Their counts and frames come from SkillData through the loader.
- P1 first-battle-skill SP: potential_atb_return 25 at P1 (potential_1, a skillBbModifier on normal_skill), granted once per fight by the p1_ready stack.

## Not checked
- Equipment kits were not reviewed.
- The `zmdlogs check` run was not done; the log claims in the kit (volley 6/6, ultimate 25/25, Cosmovoice amp 0.410537) were taken from the kit's sources.
- Combo window trigger text (I18nTextTable_EN) was not compared with the kit's trigger; the kit's `reaction` trigger was taken as written.
- End Stance set_cd 3 s and the finish_duration 5 s on the battle skill are SkillData defaults, not in SkillPatchTable; their values were not read from SkillData.
- The RefrainObtainUsp energy block (kit: whole stance, against the buff's 1 s): the kit's own note cites in-game test 27 as undecided, so it is not flagged here.
- Ultimate projectile frames at offsets 8 and 11 (ultimate frames 84 and 87) are not in the kit's explicit list; their side-shot hits take frames from the loader, which was not traced.
- Basic attack 2's five channel hits and attack 3's five projectiles were not traced to their entities.
