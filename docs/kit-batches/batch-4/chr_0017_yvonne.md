# Yvonne (chr_0017_yvonne): gap report, batch 4

Phase 1 (analysis only), against the engine at 0fb4120. Operator: Cryo
(CharGrowthTable `charTypeId` Cryst), `profession` 8, main attribute 41
(Intellect), secondary 40 (Agility), `weaponType` 6 (handcannon), rarity 6.
Equipment covered here ([batch-4.md](../batch-4.md)): `wpn_pistol_0005`
Navigator, `wpn_pistol_0007` Home Longing, `wpn_pistol_0008` Wedge. None
is plainly another operator's signature: all three are written relative to
the wielder (Navigator and Home Longing suit any Cryo or Nature wielder).

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
I18nTextTable_EN; Json/SkillData `chr_0017_yvonne_*` (39 files),
`sk_wpn_pistol_0005/0007/0008`; Json/BuffData `buff_chr_0017_yvonne_*` (38
files), `buff_wpn_pistol_0005*`, `_0007_valid`, `_0008*`. All of them are in
the checkout. `efsim kit-draft chr_0017_yvonne` run on the main checkout.
Log: `fixtures/pending/zmdlogs-abfd4b7478ec.json` (183 Yvonne hits).
Earlier claims re-checked: abilityEvent 205 (a buff added to the aura
holder, any source) and the Umbral Torch aura pattern (batch 1); 102 / 206
(the wielder applies a buff); buffEvent codes 0 start, 1 tick, 2 finish,
5 while enabled (skillCompile.ts; buffEvent 5 holds RefrainObtainUsp and
SwitchModeAction here, so "while enabled" fits); `uspRecoverTag` as a
grant that ignores a RefrainObtainUsp naming that tag (batch 1, Arcane):
none of Yvonne's grants carry one, so her states block them all.

Scratch: `/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-chr_0017_yvonne/`
(`kits/` the four draft kits, `repo/` a copy running them,
`repo/examples/yvonne-fluorite.scenario.json`, `scripts/gen_kit.py`, and
`logcheck.verification.diff`, a verification-only checker patch: see
Verification).

## Skill values (SkillPatchTable, level 1 / 12)

| Skill | Values | Cooldown / cost |
|---|---|---|
| attack1 / 2 / 3 / 4 | `atk_scale` 0.24/0.53, 0.13/0.28 (×2 shots), 0.11/0.24 (×3), 0.41/0.92; `atb` 0 | |
| attack5 | `atk_scale` 0.56/1.26, `poise` 17, `atb` 17 | |
| power_attack (finisher) | `atk_scale` 4/9 (BreakingAttackCalculation multipliers 0.1 and 0.9) | |
| plunging_attack_end | `atk_scale` 0.8/1.8 | |
| normal_skill (battle) | `atk_scale` 1.11/2.5, `atk_scale2` 0.67/1.5, `atk_scale_layer` 0.89/2.0, `poise` 10, `usp_base` 10, `usp_layer` 30; file `atb_return` 10 | 100 SP |
| combo_skill | `atk_scale_tick` 0.45/1.0, `atk_scale_boom` 0.89/2.0, `usp` 10, `usp_extra` 10, `poise` 10, `interval` 0.75, `maxcnt` 4, `duration` 3 | 20 / 18 s |
| ultimate_skill | `duration` 7 (the state), `atk_scale1` 0.089/0.2 (display), `atk_scale2` 1.33/3.0, `atk_scale_extra` 2.67/6.0; file `atk_up` 0.3, `crit_dmg_up` 0.15 (P5 sets 0.1 / 0.3) | 220 energy, 10 s |
| ult_attack1_1, 2_1, 2_2, 3_1, 3_2 | `atk_scale` 0.089/0.2 per shot; ult_attack1_1 also `normal_dmg_up` 0.03, `crit_rate_up` 0.06, `layer` 10 (all levels) | (ultimate group) |
| ult_attack_end | `atk_scale` 1.33/3.0, `atk_scale_extra` 2.67/6.0, `poise` 20 | |

Talents (PotentialTalentEffectTable): talent 1 "Barrage of Technology"
(nodes `passive_skill_0_1/2`, talent index 0) attaches skill
`chr_0017_yvonne_talent_1` with `dmg_up` 0 / 0.5; talent 2 "Freezing Point"
(`passive_skill_1_1/2`, index 1) attaches `chr_0017_yvonne_talent_0` with
`inflict_up` 0.1 / 0.2, `status_up` 0.2 / 0.4. Potentials: P1 combo
`has_potential1` 1, `radius` 5, `interval` 0.5, `maxcnt` 6, `usp_extra` 25
(set); P2 Intellect +20, Crit Rate +7%; P3 talent_0 `inflict_up` +0.1,
`status_up` +0.2 (add); P4 normal_skill `atb_return` 10, `has_potential2` 1;
P5 ultimate_skill and ult_attack_end `has_potential5` 1, `atk_up` 0.1,
`crit_dmg_up` 0.3. Attribute nodes: Intellect +10 / 15 / 15 / 20.

Weapons at skill level 9: Navigator Intellect (`wpn_attr_wisd_high`), Cryo
DMG +43.3% (`wpn_sp_attr_crystdam_high`), skill 3 `crit_up` 0.098,
`dmg_up` 0.098, `crit_up2` 0.056, `duration` 15. Home Longing Agility, Cryo
DMG, ATK +`atk_up` 0.196, `dmg_up` 0.224, `duration` 20, `max_stack` 2.
Wedge main attribute, Crit Rate, Arts DMG +`spell_dmg_up` 0.336,
`spell_dmg_up2` 0.224, `spell_dmg_up3` 0.448, `duration` / `duration2` 15.

## SkillData / BuffData action types

Presentation (effects, sound, camera, animation, root motion, rotation,
teleport, weapon visibility, voice, UI) left out. D damage, R resources,
S state, T timing / legality.

| File | Gameplay types | Affect |
|---|---|---|
| attack1 / 2 / 3 / 4 | LaunchProjectile (11; 11 + 14 robot; 6, 9, 12; 11, castSkillOnBlock = the same projhit), ComboCacheAction (→ attack2 / 3 / 4 / 5), AllowNextSkillAction (→ next step at 16–27, 14–28, 20–34, 24–38; **→ attack5 at 0–27, 0–28, 0–34**; attack4: **TogglableAction [0-24] → attack5 while `buff_chr_0017_yvonne_talent_1_valid`**), SetSuperArmor | D, T |
| attack*_projhit, attack2_robot_projhit | DamageAction `atk_scale` (mask 128); ObtainCostAction `atb` (0) for the controlled operator | D |
| attack5 | ChannelingAction 21–23 (maxCountPerTarget 1) → DamageAction `atk_scale` mask 2097280 (Final Strike); IfElse CheckMainCharacter → poise unit `poise`, ObtainCostAction `atb` (atbSourceType 1, natural) once; **FinishBuffAction talent_1_valid at 21**; IfElse on `buff_…_ultimate_skill` / `_end` → ComboCache / AllowNext 34–60 → ult_attack2_1, else 37–60 → attack1 | D, R, S, T |
| power_attack (+ _projhit) | projectile at 8 (BreakingAttack × 0.1), DamageAction at 28 (BreakingAttack × 0.9), GainBreakingAttackAtb, disable-cast and immunity buffs, BlowOffEnemyAction, window → battle, combo | D, R, T |
| plunging_attack_end | IfElse on `buff_…_potential_5` (orphan) → DamageAction `atk_scale` mask 1152 | D |
| dash_attack (+ _projhit), dodge | dash attack (skillSpecification 7); buff_…_dash_attack SwitchModeAction dash / ult_dash / ult_dash_end | D, T |
| normal_skill (battle) | CreateBuff `_listener` (0, until her next skill), `_projectile` (5, 1 s, autoFinishByAction); window 34–56 → normal_skill; durationFrame 150, exclusiveFrame 34 | S, T |
| buff_…_normal_skill_projectile | finish (35): CheckTagMatch on Yvonne (7 control tags, queryType 2: none of them) → LaunchProjectile → normal_skill_projhit (hit and block) | T |
| normal_skill_projhit | InterruptAction; IfElse `has_potential2` = 1 and exactly 1 target: ForEach target: IfElse Cryo (1570888476) or Nature (−1411846745) Infliction ≥ 1: **SaveBuffStackNum (Cryo, else Nature) → `count`, ForceSpellStatusAction Solidification (spellStatusType 2), count = consumedLayer = `count`, consumedType 2 / 3**, `atk_scale_final` = `atk_scale_layer` × `count` + `atk_scale` + `atk_scale2`, then DamageAction (mask 4352) + poise; else DamageAction `atk_scale` + poise; P4 branch adds ObtainCostAction `atb_return` (atbGainMethod 1 returned, atbSourceType 3); `max_count` = max `count`; after the loop: buff_common_obtain_ultimate_sp; if `max_count` > 0: ObtainCostAction `usp_base` + `usp_layer` × `max_count` | D, R, S |
| buff_…_normal_skill_listener | abilityEvent 206 + tag Solidification (1535684437) + CheckSkillCastId → CreateBuff `_normal_skill_frozen` on the enemy | S |
| buff_…_normal_skill_frozen | DamageAction **disabled**: inert apart from being the buff talent 1 listens for | — |
| combo_skill | SpawnAbilityEntity at 0–3 → combo_skill_abilityrange; TimeDilationAction ComboSkill 0.667 s (layer 0, Yvonne and her entities exempt) and 0.15 s layer 1 on the entity; window 19–56 → normal_skill; durationFrame 130, exclusiveFrame 24 | T |
| combo_skill_abilityrange | entity frame 19: ObtainCostAction `usp` if a target is in `radius`; CreateBuff `buff_…_combo_skill` (assigns `usp_extra` → `usp`) | R |
| buff_…_combo_skill | 3 s, triggerInterval `interval`, maxTriggerCnt `maxcnt`, first tick at once: PullAction, DamageAction `atk_scale_tick` (mask 8192; three branches Solidified / energy shard / plain, identical damage), ObtainCostAction `usp` once (`has_added_usp`); finish → `_combo_skill_finish` | D, R |
| buff_…_combo_skill_finish | 0.72 s, first tick after 0.5 s: InterruptAction, **CreateBuff buff_common_cryst_cryst_frozen_triggered (count 1, extra_duration 2) before** DamageAction `atk_scale_boom` (mask 12288) + poise; ObtainCostAction `usp` only if no tick hit; a disabled ForEach (energy-shard Solidification); finish → FinishOwner | D, S |
| ultimate_skill | FinishBuff of both states at 0; UltimateTimeAction 0–61; RefrainObtainUsp 0–61; damage immunity 0–64; three Tink-a-Bella entities (no actions); at 61 CreateBuff `buff_…_ultimate_skill` (both IfElse branches on the orphan `buff_…_potential_4` identical) and `_full_effect` (empty); durationFrame 126, exclusiveFrame 64, no windows | R, S, T |
| buff_…_ultimate_skill | `duration` (7 s), stackingType 4; while enabled: SwitchModeAction "ult", RefrainObtainUsp; start: if `has_potential5` ≥ 1 → child `buff_…_potential_5_new`; if `has_potential4` = 1 (never set) → `_potential4_valid`; finish → `buff_…_ultimate_skill_end` | R, S |
| buff_…_ultimate_skill_end | 3 s; while enabled: **ComboCacheAction → ult_attack_end** (cacheTime 0.5, overrideCacheTime, clearOffsetTargetSkillIdOnEnd), RefrainObtainUsp, P5 child buff; finish: FinishBuff shield / environment / potential4_valid / full_effect / layers, **SetSkillCdAtOnce skillTypeMask 128 (ultimate) functionType 1 value 10** | R, S, T |
| buff_…_potential_5_new | ATK formulaItem 6 +`atk_up`, Crit DMG +`crit_dmg_up`, stackingType 1 | D |
| ult_attack1_1 / 2_1 / 2_2 / 3_1 / 3_2 | LaunchProjectile → ult_attack1_projhit or ult_attack2_projhit (1_1: 9, 15, 21; 2_1: 11, 14, 17, 21; 2_2: 1, 4, 7, 11; 3_1: 13–27 every 2; 3_2: 1–15 every 2; CheckHp / CheckEntityNum branches only pick the target), CreateBuff `_ultimate_skill_layer` with each launch except 2_1's at 21 and 2_2's at 11; ComboCache / AllowNext → next step (3_2 → 3_2), and AllowNext 0–26 / 0–30 / 0–20 / 0–36 / 0–28 → **ult_attack_end, attack5** | D, S, T |
| ult_attack*_projhit | DamageAction `atk_scale` (mask 128); a Probablity 0.125 voice branch | D |
| buff_…_ultimate_skill_layer | stackingType 8, max 10, `recycle_time` 4 s; Crit Rate (attr 9) + `normal_dmg_up` (0.03), Crit DMG (attr 10) + `crit_rate_up_dynamic`, set to `crit_rate_up` (0.06) by buffEvent 6 once at 10 layers (RefreshBuffAttrModifierValue) | D |
| ult_attack_end | frame 0: +1 layer; GetTargetBuffBB `normal_dmg_up` × layer count → `normal_dmg_up`, `crit_rate_up_dynamic` → `crit_rate_up`; [28–60] IfElse end state ≥ 1: DamageAction `atk_scale` mask 2101376 (Final Strike) + poise 20, else the same with processors Crit Rate +`normal_dmg_up`, Crit DMG +`crit_rate_up` (+ orphan-P5 `_true` keys, 0); then ForEach target Solidified → DamageAction `atk_scale_extra` (mask 128) and FinishBuffAdvanced tag Solidification; **[28–31] FinishBuffAction end state and layers**; durationFrame 161, exclusiveFrame 60 | D, S |
| talent_0 / talent_1 (SkillData) | `buffs` → `buff_…_talent_0` / `_talent_1` (lifeType 1: permanent) | S |
| buff_…_talent_0 (Freezing Point) | damageModifier: target Cryo and not Solidified → Crit DMG +`inflict_up`; Solidified and not Cryo, or both → +`status_up` | D |
| buff_…_talent_1 (Barrage) | abilityEvent 102 + `buff_…_normal_skill_frozen` + 0.1 s marker → `_talent_1_valid` (15 s, stackingType 4) | S |
| buff_…_talent_1_valid | while enabled: **ComboCacheAction → attack5** (cacheTime 0.5, overrideCacheTime); abilityEvent 30 (cast) + CheckSkillId attack5 → CreateBuffAttachingSkill `_talent_1_valid_up` (DamageScaleProcessor NormalCalcZone +`dmg_up`, for that cast) | D, S, T |
| Orphans | `chr_0017_yvonne_passive_0` + buff (combo-skill `usp` 15 on any Solidification, 0.1 s), `_potential_4` / `_potential_5` skills and buffs, `_potential_5_cd` / `_effect`, `_ultimate_skill_potential4_valid`, `_normal_attack5_mark`, `_power_attack` (empty), `_train_*`, `_combo_skill_tutorial_marker`, shield / camera / voice / wep / environment / robot_end buffs: nothing reachable gives them gameplay | none |
| sk_wpn_pistol_0005 | card Crit Rate +`crit_up`; `buffs` → `buff_wpn_pistol_0005` (permanent AuraAction, radius 40, on enemies) → `_inaura`: abilityEvent 205 + tag Solidification or Corrosion (−421286163): CheckTargetsEqual (the wielder caused it) → `_valid` with `dmg_up`, `crit_up2` × `multi` 2, else (NotNext) `_valid` plain; `_valid`: attr 53, 54 +`dmg_up`, attr 9 +`crit_up2`, `duration`, stackingType 1, priority key `dmg_up`, **maxStackCntKey `max_stack` (the skill has no such key)**; toggleBuffs `buff_wpn_lance_0003` (CheckCurHpRatio `hp_ratio`, not in the skill: leftover) | D |
| sk_wpn_pistol_0007 | card ATK formulaItem 6 +`atk_up`; abilityEvent 30 + CheckSkillType [6] (combo) → `buff_wpn_pistol_0007_valid` (stackingType 2, max `max_stack`, `duration`): damageModifier CheckDamageTypeMask 80 (Cryo, Nature) + decorate mask 256 (battle skill) → NormalCalcZone +`dmg_up`; nothing ends it early; toggleBuffs `buff_wpn_passive_spirit_01` (no file) | D |
| sk_wpn_pistol_0008 | card attr 51–54 +`spell_dmg_up`; abilityEvent 30 + CheckSkillType [2] (battle) → `buff_wpn_pistol_0008` (attr 51–54 +`spell_dmg_up2`, `duration`); abilityEvent 206 + CheckOriginSkillType [2] + tag 1474064594 (Arts Reaction) → `_extra_valid` (+`spell_dmg_up3`, `duration2`); both stackingType 1, priority key, **maxStackCntKey `max_stack` (not in the skill)**; `_extra` (abilityEvent 102 copy), `_cd`, `_icon` orphans; toggleBuffs `buff_wpn_passive_spirit_01` | D |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: one hit per projectile at its launch frame, `atk_scale` each (attack4's castSkillOnBlock is the same hit, not a second one) | supported | hits with `launch`, events the projhit files; log ✓ |
| 2 | attack5 at 21: Final Strike, `atk_scale`; "As the controlled operator, Final Strike also deals {poise} Stagger" (poise unit in CheckMainCharacter), `atb` 17 natural SP when controlled | supported | `poise`, `poiseControlledOnly`, `sp: {if: controlled, then: atb}`; log ✓ |
| 3 | attack1–3's AllowNextSkillAction → attack5 from frame 0, while their ComboCacheAction maps the next input to attack2–4: attack5 is reachable mid-chain only when a buff maps the input (talent 1) | gap | **G1**. The loader makes every window listing a chain step a chain continuation, so attack1 → attack5 is castable at will. Interim (exact but for a deferral): attack5 `chainStep: false`, `available` = Barrage or marker `a4_chain` |
| 4 | Conditional windows: attack4's [0–24] → attack5 only while talent_1_valid (TogglableAction); attack5's 34–60 → ult_attack2_1 only in an ultimate state, 37–60 → attack1 otherwise (IfElse) | gap | **G2**: read as unconditional. attack4 → attack5 can start at frame 0 instead of 24 (the interim marker can't fix the frame); after attack5 the chain points at ult_attack2_1 (harmless: `available`) |
| 5 | Finisher: projectile at 8 (× 0.1) and hit at 28 (× 0.9), finisher SP | supported | two hits with `factor` |
| 6 | Dive attack (skillSpecification 6; the P5 branches read an orphan buff) | supported | plain hit; not castable (S10) |
| 7 | Dash attack, and its ultimate modes (`ult_dash`, `ult_dash_end`) | gap (deferred) | S5 (batch 3) |
| 8 | Battle skill: bomb launched at 35 (projectile buff 5 + 1 s), `atk_scale`, poise 10, on a target without Cryo or Nature Infliction | supported | `bomb_plain`, `launch: 35` |
| 9 | "If hitting an enemy with Cryo Infliction or Nature Infliction, then consume all Arts Infliction stacks, forcibly apply Solidification, and deal Cryo DMG … based on the number of stacks consumed": consumption and forced Solidification (level = stacks) **before** the DamageAction; multiplier `atk_scale` + `atk_scale2` + n × `atk_scale_layer` (L12: 6, 8, 10, 12) | supported | `consumeInfliction [cryst, natural]`, `forcedReaction` level `{consumed: true}`. The natural form (one hit, `scaleValue` reading `{consumed: true}`) breaks `calc` and `zmdlogs check` (G3c); interim: four branch hits (`minStacks` 4…1) and the plain one, exact. Log ✓ (3 and 4 stacks; the hit sees its own Solidification: talent 2's ×2) |
| 10 | "After the battle skill successfully applies Solidification, Yvonne gains additional Ultimate Energy based on the number of stacks consumed … only 1 time": `usp_base` + `usp_layer` × n (40–130) | supported | hit `energy` per branch |
| 11 | Team energy (buff_common_obtain_ultimate_sp) at the bomb | supported | `teamEnergy: [{frame: 35, ratio: 1, detached: true}]` |
| 12 | P4: "If the explosion hits only one enemy, return {atb_return} SP" (returned, atbSourceType 3) | supported | `sp: {if: potentialAtLeast 4, then: atb_return}` on every bomb branch (one enemy) |
| 13 | The launch's control-tag check on Yvonne; listener → `_normal_skill_frozen` (disabled damage) | supported | nothing (always launches; the frozen buff only matters to talent 1, row 29) |
| 14 | COMBO TRIGGER: "When the controlled operator performs a Final Strike on an enemy with Solidification" | supported | `{on: {event: hit, finalStrike: true}, by: controlled, if: {enemyStatus: solidification}}` → openCombo; scratch run: attack5 after the bomb opens it |
| 15 | Combo ticks: entity frame 19 then every `interval`, `maxcnt` ticks (4 at 0.75 s; P1: 6 at 0.5 s), `atk_scale_tick` | supported | `tick1` [19], `ticks` [42, 64, 87] if not P1, `ticks_p1` [34, 49, 64, 79, 94] if P1, `launch: 0` |
| 16 | Combo energy: `usp` at frame 19 (a target in range) and `usp_extra` at the first tick that hits ("only 1 time"); P1 `usp_extra` 25 | supported | `energy: {sum: [usp, usp_extra]}` on tick1 |
| 17 | Explosion (finish buff's tick at 124): forced Solidification level 1 with `extra_duration` 2 before its DamageAction `atk_scale_boom`, poise 10; its energy only if no tick hit | supported | `applies: [{forcedReaction solidification, level 1, extraSeconds 2}]` (A2); no energy |
| 18 | Combo's global slow-down 0.667 s (layer 0; Yvonne and her entity exempt) and the entity's own 0.15 s layer-1 dilation | supported (data) | loader reads layer 0; the entity layer isn't modelled (Ti1b, open) |
| 19 | Combo cooldown 20 / 18 s, window 19–56 → battle skill | supported (data) | loader |
| 20 | Ultimate: 220 energy, time stop 0–61, no energy 0–61, immunity, "makes Yvonne the controlled operator" | supported | `takesControl`, `energyBlockSeconds: 2.0333`; loader |
| 21 | Ultimate state from frame 61 for `duration` (7 s): basic attacks become the enhanced chain (SwitchModeAction "ult"), no energy | supported | buff `ult_state` (`blocksEnergy`) by a cast trigger at delay 61; attack1–4 `available: not (ult_state or ult_end or barrage)`, ult attacks `available: ult_state and not barrage` (Laevatain's pattern) |
| 22 | Enhanced chain 1_1 → 2_1 → 2_2 → 3_1 → 3_2 → 3_2 …: 3, 4, 4, 8, 8 shots of `atk_scale` | supported | one entry per projectile with `launch`; events ult_attack1/2_projhit (2_2's shots at 1 and 7 can be either key); log ✓ |
| 23 | Layers: one per launch (not 2_1's last or 2_2's last; +1 at the end strike's frame 0), max 10, 4 s on one timer: Crit Rate +0.03 per layer; at 10 layers Crit DMG +0.06 per layer (+0.6) | supported | buff `ult_layers` (`maxStacks: 10`, the loader's `sharedTimer`), modifiers attr 9 `normal_dmg_up`, attr 10 `crit_rate_up` `if: {buffLayers: ult_layers, atLeast: 10}`; hits `buffs: [{buff: ult_layers, beforeDamage: true}]`. Log ✓ (+0.6 Crit DMG at 10 layers). Whether the timer restarts per layer: B3 (test 62) |
| 24 | End state (3 s, from the state's end): the next basic-attack input becomes ult_attack_end (ComboCacheAction in the buff), no energy | gap | **G1** (a buff's input mapping). Interim: buff `ult_end` (`blocksEnergy`), ult_attack_end `available: ult_end`; cast inside an open chain window it waits for the window's end (up to 0.3 s) |
| 25 | End strike at 28: `atk_scale` 3.0 Final Strike, poise 20; "If the enemy is Solidified, Yvonne performs an additional attack … and then consumes the enemy's Solidification" (`atk_scale_extra` 6.0, mask 128, FinishBuffAdvanced after it) | supported | hits `end` (`finalStrike`) and `end_extra` (`if` Solidified, `finalStrike: false`, `consumeStatus [solidification]` `afterDamage`); the end strike on a Solidified enemy opens her combo |
| 26 | End strike: which IfElse branch and whether the layers still act. [28–60] (checks the end state) and [28–31] (FinishBuff end state and layers) start on the same frame; damage first: layers act (Crit Rate +0.3, Crit DMG +0.6 at 10), no processors; finish first: processors only (Crit Rate +0.03 × layers, Crit DMG +0.06) | unknown | interim: file order (damage first). About ±25% on the crits of her two biggest hits. A log only (row 23's log has no end strike) |
| 27 | Ultimate cooldown: 10 s set when the end state ends (consumed by the end strike at 28, or after 3 s) | supported | triggers `ult_cooldown` (`buffEnded ult_end` → `cooldown set 10`, end layers), `end_strike_ends_state` (delay 28) |
| 28 | Tink-a-Bella bots (three entities) | supported | no actions: nothing |
| 29 | Talent 1: "After applying Solidification, the next basic attack directly becomes a Final Strike with DMG Dealt +{dmg_up}" (0 / 0.5): her battle skill's own Solidification (CheckSkillCastId) → talent_1_valid, the input → attack5, the bonus on that cast, ended by attack5 at 21 | supported (interim) | buff `barrage` (15 s, `consumedBy: [basic]`, damageBonus `{talent: 0, key: dmg_up}`) by `{on: reaction, statuses: [solidification], fromKinds: [battle]}`; the input mapping is G1's interim (row 3). Log ✓ (+0.5 on attack5 three times) |
| 30 | How long talent 1's mapping holds: while talent_1_valid is enabled (15 s, buffEvent 5), or `cacheTime` 0.5 s with `overrideCacheTime` | unknown | interim: the whole buff. In-game test Y1 |
| 31 | Talent 2: "Against enemies with active Cryo Infliction, gains Critical DMG Dealt +{inflict_up}. Effect is doubled against enemies with Solidification" (damageModifier, judged at the damage) | supported | permanent self buff from `fightStart`, attr 10 `{talent: 1, key: status_up}` if Solidified, `inflict_up` if Cryo and not Solidified (C1); log ✓ (+0.2 and +0.4, and +0.4 on the bomb that Solidifies) |
| 32 | P1: combo radius, 2 more ticks, interval 0.5, `usp_extra` 25 | supported | rows 15–16 |
| 33 | P2: Intellect +20, Crit Rate +7% | supported (data) | stat panel |
| 34 | P3: talent 2 +0.1 / +0.2 | supported | skillValues on the talent skill (`{talent: 1, key}` reads them) |
| 35 | P5: "During the ultimate, ATK +{atk_up} and Critical DMG Dealt +{crit_dmg_up}" (child buff of both states) | supported | modifiers on `ult_state` and `ult_end`, `if: potentialAtLeast 5`, values `{key, skill: ultimate_skill}` |
| 36 | Orphans (action-type table) | supported | left out |
| 37 | The explosion's forced Solidification level 1 on a level-4 one from her bomb | unknown | test 66's question (a forced reaction on a stronger status); engine as for Perlica |
| 38 | A combo trigger during the combo's cooldown (her Final Strikes on a Solidified enemy come often) | unknown | T5 (test 60) |
| 39 | kit-draft leftovers: attack4's block landing as a second hit; attack5 without poise; the bomb as six landings with a non-key scale, no energy and no P4 SP; the combo's three identical branches as six hits, `usp` on every first-tick branch, `usp_extra` on the explosion (wrong: only without a tick hit), P1's interval and count not applied, `extra_duration` only noted; ult shots grouped by branch (CheckHp only picks the target) without per-shot launch, 2_2's alternate projectile missed, layers only noted; the end strike as four hits with processors "not a key", no `consumeStatus`; ultimate states, talents and potentials not compiled; the bomb's control-tag condition and orphan-buff branches reported as conditions | data | D3 / D4 (batch 3), ForceSpellStatusAction `consumedType` as a consumption (D3 open item) |
| W1 | Navigator: Intellect, Cryo DMG, Crit Rate +`crit_up` | supported (data) | stat panel |
| W2 | Navigator: "When Solidification or Corrosion is applied to enemies, the wielder gains Cryo DMG Dealt and Nature DMG Dealt +{dmg_up}, and Critical Rate +{crit_up2} for {duration}s. If this effect is triggered by the wielder, double the increase gained." (any applier, forced included) | supported | buffs `valid` (×1, `by: teammate`) and `valid_own` (×2, `by: self`), both on `reaction [solidification, corrosion]`, `beforeDamage`; log ✓ (0.112 = 2 × 0.056 at skill level 4; it acts on the bomb that Solidifies) |
| W3 | Navigator: "Effects of the same name cannot stack" (stackingType 1, priority `dmg_up`: the doubled instance wins) | gap | **G4**: the kits can't name `buff_wpn_pistol_0005_valid` (its maxStackCntKey isn't in the skill), so no `stackGroup`. Interim: the team copy isn't applied while the own copy is active, and the own copy ends it |
| W4 | Home Longing: Agility, Cryo DMG, ATK +`atk_up` | supported (data) | stat panel |
| W5 | Home Longing: "For {duration}s after the wielder casts a combo skill, the wielder's next battle skill gains Cryo and Nature DMG Dealt +{dmg_up}. Max stacks … {max_stack}. Duration of each stack is counted separately." | supported | `{on: cast, kinds: [combo]}` → layered self buff (`maxStacks: max_stack`), damageBonus `dmg_up`, elements cryst / natural, `skillType: battle` |
| W6 | Home Longing: "next battle skill": nothing in the data consumes the buff (20 s for every Cryo / Nature battle-skill hit) | unknown | interim: the data (not consumed). In-game test Y2 |
| W7 | Wedge: main attribute, Crit Rate, Arts DMG +`spell_dmg_up` | supported (data) | stat panel |
| W8 | Wedge: "When the wielder casts a battle skill, the wielder gains Arts DMG Dealt +{spell_dmg_up2} for {duration}s" | supported | `{on: cast, kinds: [battle]}` → self buff attrs 51–54 (G4: no `gameBuff`; a same-owner reapplication of one value refreshes, which is what instances amount to here) |
| W9 | Wedge: "When the wielder's battle skill applies an Arts Reaction, the wielder gains Arts DMG Dealt +{spell_dmg_up3} for {duration2}s. The two effects apply separately" (forced reactions included) | supported | `{on: reaction, fromKinds: [battle]}`, `beforeDamage` (test 51's question) → a second buff |
| W10 | Weapon leftovers: toggleBuffs `buff_wpn_lance_0003` / `buff_wpn_passive_spirit_01`, Wedge `_extra` / `_cd` / `_icon` | supported | inert |

**Counts** (49 rows): supported 38 (6 of them `supported (data)`: rows
18, 19, 33, W1, W4, W7; rows 9, 29, W2 and W8 rest on interims),
gap 5 (rows 3 and 24: G1; row 4: G2; W3: G4; row 7: S5, deferred),
unknown 5 (rows 26, 30, 37, 38, W6), data 1 (row 39), unique? 0. G3 (log
tooling) has no row: it blocks verification, not the kit.

## Gaps

### G1. A chain step reached by input mapping; buffs that map the basic attack

- **family:** skills (states)
- **feature:** (a) the loader takes a basic attack's chain continuations
  from its ComboCacheAction mapping (the next basic-attack input; `cmdType`
  absent), using the AllowNextSkillAction windows only for the frames: a
  window listing a step the cache doesn't map makes no chain step (it only
  allows that step when something else maps the input). (b) A kit buff
  `basicAttack: skillId` (the loader can read it from a ComboCacheAction
  in the game buff's buffEvent 5, which holds while the buff is enabled):
  while it's active the owner's basic-attack input is that skill: it can
  start as a chain head or inside any window that lists it, an open chain
  window of another step doesn't defer it, and other basic attacks can't
  start. Judged at the action's start.
- **evidence:** `chr_0017_yvonne_attack1` ComboCacheAction 0–27 →
  attack2, AllowNextSkillAction 16–27 → attack2 and 0–27 → attack5 (attack2
  0–28, attack3 0–34 the same); ult attacks 0–20…0–36 → ult_attack_end,
  attack5. `buff_chr_0017_yvonne_talent_1_valid` and
  `buff_chr_0017_yvonne_ultimate_skill_end` buffEvent 5 ComboCacheAction
  (→ attack5, → ult_attack_end; overrideCacheTime). Only these two buffs
  have a ComboCacheAction in BuffData, and no other operator's chain
  window lists a step its cache doesn't map (scan of every
  `chr_*_attack*`: the others list attack1, a chain head; Lifeng's attack3
  → attack5 is a real cache mapping). The engine's `chainAfter` turns
  every listed chain step into a continuation (timeline.ts).
- **impact:** without the interim, attack1 → attack5 at frame 0: a Final
  Strike (1.26 × ATK, 17 SP, 17 Stagger, her combo trigger) every ~1 s
  instead of after four attacks (~3 s); search would find it. The interim
  (attack5 `chainStep: false`, `available: barrage or a4_chain`, every
  other basic attack `not barrage`) is exact except that attack5 or the end
  strike cast inside another step's open window waits for its end (up to
  14 frames, about 0.5 s).

### G2. Windows under a condition

- **family:** data compilation (timing)
- **feature:** `readSkillFile` marks an AllowNextSkillAction found under a
  TogglableAction or an IfElse branch as `conditional`; `KitSkill.windows:
  [{from, skills?, if}]` says when it's open (judged at the cast, as
  `jumps`); a conditional window the kit doesn't list stays closed.
- **evidence:** `chr_0017_yvonne_attack4` TogglableAction [0–24] (condition
  CheckBuffStackNumAdvanced `talent_1_valid` ≥ 1) → attack5;
  `chr_0017_yvonne_attack5` IfElse on the ultimate states → 34–60
  ult_attack2_1, else 37–60 attack1. The reader's `find` collects windows
  at any depth (skillData.ts). The only other conditional windows in the
  data are Typhoeus's floating attacks (IfElse; batch 1).
- **impact:** after attack4, attack5 can start at frame 0 instead of 24
  (attack4's own shot at 11 is dropped if it does: −0.92 × ATK for a Final
  Strike 0.8 s sooner). Small, but a search exploits it.

### G3. Log tooling: three things `zmdlogs check` can't see on Yvonne

- **family:** log tooling
- **feature:** (a) `teamStackCaps` finds a layered buff's cap by name
  (`passive_equipsuit_critsuit_01` doesn't prefix
  `buff_equipsuit_critsuitatk_01`), so MI Security's layers are never tried:
  fall back to the buff's literal `maxStackCnt` (5) when no source has the
  key. (b) ZMDLogs never lists crit-zone effects (no fixture has a
  critRate or critDamage entry), so an operator's own crit buffs
  (talent 2's damageModifier, the ultimate layers, P5) should be tried as
  unlogged variants with their possible values (each modifier's branch,
  layers 0 to max), as unlogged cast buffs are. (c) `calc` and the log
  check don't know `{consumed: true}` / `consumedAtLeast` in a hit's values
  (their situation has `eventCount` only): try 1–4 as for `eventCount` (and
  show calc at 1), so a hit like the bomb can be one entry.
- **evidence:** unpatched check: 23 of 183 match, every crit ×1.70 off
  (Crit DMG 0.5 + talent 2's 0.2) and MI Security ×1.10–1.18; with a
  scratch-only patch doing (a) and a fixed (b) list of Crit DMG values
  (`logcheck.verification.diff`): 182 of 183. (c): with the bomb as one
  hit, `calc` stops ("value depends on a condition that isn't known here")
  and the check drops the hit.
- **impact:** Yvonne's kit can't be verified against the log without (a)
  and (b); (c) costs only the four-branch interim.

### G4. A maxStackCntKey the applying skill doesn't have

- **family:** buff lifecycle (loader)
- **feature:** when a game buff with a priority key names a
  `maxStackCntKey` the applying skill lacks, the instances limit is what
  the game reads for a missing key (0: no limit, as B1's 0) instead of a
  load error.
- **evidence:** `buff_wpn_pistol_0005_valid`, `buff_wpn_pistol_0008`,
  `buff_wpn_pistol_0008_extra_valid` (maxStackCntKey `max_stack`;
  sk_wpn_pistol_0005 / 0008 have no `max_stack`): the loader refuses the
  kit ("instances (maxStackCntKey): sk_wpn_pistol_0005 has no value
  max_stack").
- **impact:** these kit buffs can't carry `gameBuff`, so no `stackGroup`:
  Navigator's two copies would add (+0.098 + 0.196 Cryo DMG instead of the
  stronger one) without the interim; Wedge is exact without it. Other
  batch-4 weapons may hit the same check.

## Verification

- **Log** `fixtures/pending/zmdlogs-abfd4b7478ec.json` (Yvonne P0, basic
  7, battle 9, combo 4, ultimate 9, Navigator at skill 3 level 4, four MI
  Security pieces), draft kits in the scratch copy:
  - `zmdlogs check`: 183 hits covered (was 0), 23 match, 160 mismatch;
    Si 190/193, Xaihi 75/75, Fluorite 56/56 unchanged.
  - With the verification-only patch (G3a, G3b): **182 of 183 match.**
    What the matches assumed: talent 2's Crit DMG +0.2 (Cryo) and +0.4
    (Solidified), +0.6 at 10 ult layers and +1.0 (both) on the ult shots;
    MI Security 2–5 layers; Barrage's +0.5 on the three attack5s after a
    bomb; bombs at 3 and 4 stacks with Navigator's doubled buff acting on
    the bomb itself ("boundary buffs applied" at all three: evidence for
    `beforeDamage` on a weapon buff a forced reaction triggers, test 51's
    question); the bomb at 64571 crits with +0.4: the hit sees the
    Solidification it forces (the data's order, C1); the combo tick at
    68615 with +0.4. The build needs no correction.
  - The one left: t=116720 `ult_attack2_projhit` 1626 vs 1868 non-crit
    (×0.870), the fight's last hit: the killing blow, capped by the
    enemy's HP and logged without `uncapped`. Proposed fixture note (not
    edited): mark it as the kill.
  - `zmdlogs reactions`: unchanged (5 matched, 3 unexpected Fluorite
    bursts); Yvonne's three bombs show as "other" (consumption and forced
    Solidification; the replay counts a value level as 4).
  - Not in this log: the end strike, the combo's later ticks and explosion
    (only one tick logged, at 68615), P1–P5, Home Longing, Wedge.
- **Scratch simulation** (`yvonne-fluorite.scenario.json`: P5, level 12,
  Navigator, with Fluorite): Fluorite's Nature at 3.3 s; the battle skill
  at 3.5 s, bomb at 4.67 s (bomb_1, 17,917, forced Solidification); Barrage
  → attack5 at once (its hit opens the combo); combo ticks every 0.5 s
  (P1) from 6.00 s, explosion at 9.50 s (Solidification); attack1–4, attack5
  0.36 s after attack4 (G2: the game needs 0.8 s); ultimate at 9.93 s,
  enhanced attacks from 12.07 s, layers rising to 10 by 3_1's second shot,
  the state ends at 18.97 s and the end strike (cast at 19.0 s, `at`) lands
  at 19.93 s. Rotation steps must time the end strike: an unavailable step
  is an error, not a wait.
- **Loader:** the four draft kits load (`calc` on each weapon,
  `packages/data/test/kits.test.ts` and `skillCompile.test.ts`: 428 passed
  in the scratch copy).
- **Logs that would verify the rest:** a ZMDLogs battle with Yvonne casting
  her end strike (a crit: ×2.5 vs ×1.96 of a non-crit decides row 26) on a
  Solidified enemy (the extra hit), a full combo (ticks, explosion), at P1
  and P5, and with Home Longing (several battle skills within 20 s of a
  combo) or Wedge.

### In-game tests (proposed; by eye or a 2 s stopwatch difference)

Cross-checked: 51 (an effect on the hit that triggers it: this log
already answers it for Navigator), 60 (T5), 62 (B3), 66 (forced reaction
on a stronger status), 47 (projectile travel) apply as they are.

- **Y1. How long talent 1 keeps the next basic attack a Final Strike**
  (ready, if you have Yvonne with Barrage of Technology and a Cryo or
  Nature teammate; row 30). Teammate inflicts Cryo or Nature; Yvonne's
  battle skill Solidifies the dummy. Then wait about 3 s (no input) and
  press basic attack once. Engine (mapping while the buff lasts): the
  press is the Final Strike (one big shot, about 2.4–3.5× attack 1's
  number) and her combo lights (Final Strike on a Solidified enemy).
  Cache-time reading (0.5 s): it's attack 1 (a small shot) and the combo
  stays dark. Pressing at once after the bomb is the control: Final Strike
  in both.
- **Y2. Home Longing: the next battle skill or every one for 20 s?** (ready,
  if you have Home Longing on a Cryo or Nature caster; row W6). On a dummy
  with no infliction: combo, then two battle skills within about 10 s, then
  a third more than 20 s after the combo. Compare non-crit numbers (lower
  of two tries). Data: the first two equal, about 15% above the third.
  Description: only the first above the other two.
- **Y3 (a part of test 62).** During her ultimate, keep attacking and watch
  the layer buff's counter: it stays at 10 to the end (each layer restarts
  the 4 s timer: engine), or drops about 4 s after the first shot and
  builds up again (all expire with the first).

Not testable by hand: row 26 (same-frame order), projectile travel (test
47).

## Kit plan

Draft files (loaded with the real loader in the scratch copy; see
Verification): `…/scratch-chr_0017_yvonne/kits/chr_0017_yvonne.json`
(generated by `scripts/gen_kit.py`), `wpn_pistol_0005.json`,
`wpn_pistol_0007.json`, `wpn_pistol_0008.json`.

### Operator kit chr_0017_yvonne

- **Stacks:** none.
- **Buffs:** `freezing_point` (self, permanent, gameBuff talent_0: attr 10
  `{talent: 1, key: status_up}` if Solidified, `inflict_up` if Cryo
  Infliction and not Solidified); `barrage` (self, 15 s, gameBuff
  talent_1_valid, `consumedBy: [basic]`, damageBonus `{talent: 0, key:
  dmg_up}`); `a4_chain` (marker, G1 interim: 38 frames from attack4's
  cast; with G2, 24–38); `ult_state` (`{key: duration, skill:
  ultimate_skill}`, `blocksEnergy`, P5 atk / attr 10 modifiers `if:
  potentialAtLeast 5`); `ult_end` (3 s, `blocksEnergy`, P5 modifiers);
  `ult_layers` (gameBuff `_ultimate_skill_layer`, 4 s, `maxStacks: 10`):
  ```json
  { "id": "ult_layers", "target": "self", "gameBuff": "buff_chr_0017_yvonne_ultimate_skill_layer", "duration": 4, "maxStacks": 10,
    "modifiers": [
      { "attr": 9, "value": { "key": "normal_dmg_up", "skill": "chr_0017_yvonne_ult_attack1_1" } },
      { "attr": 10, "value": { "key": "crit_rate_up", "skill": "chr_0017_yvonne_ult_attack1_1" }, "if": { "buffLayers": "ult_layers", "atLeast": 10 } } ] }
  ```
- **Triggers:** `combo_window` (row 14); `freezing_point` (`fightStart`,
  `if: talentAtLeast [1, 1]`); `barrage` (`{on: reaction, statuses:
  [solidification], fromKinds: [battle]}`, `if: talentAtLeast [0, 1]`);
  `a4_chain` (cast attack4); `ult_state` (cast ultimate, delay 61);
  `ult_end` (`buffEnded ult_state`); `ult_cooldown` (`buffEnded ult_end` →
  endBuff `ult_layers`, `cooldown` ultimate `set: 10`);
  `end_strike_ends_state` (cast ult_attack_end, delay 28 → endBuff `ult_end`,
  `ult_layers`); `end_strike_layer` (cast ult_attack_end → `ult_layers`).
- **Skills** (frames are SkillData frames; projectiles at launch):
  - attack1 [11]; attack2 [11] + robot [14]; attack3 [6], [9], [12];
    attack4 [11]: one entry per projectile with `launch`, all `available:
    not (ult_state or ult_end or barrage)`.
  - attack5: `chainStep: false`, `available: {any: [barrage, all [a4_chain,
    not ult_state]]}`; hit [21] `poise`, `poiseControlledOnly`, `sp: {if:
    controlled, then: atb, else: 0}`.
  - power_attack: [8] factor 0.1 (`launch` 8), [28] factor 0.9;
    plunging_attack_end [1].
  - normal_skill: `teamEnergy: [{frame: 35, ratio: 1, detached: true}]`;
    hits in `branch: bomb`, n = 4, 3, 2, 1, then plain:
    ```json
    { "id": "bomb_4", "branch": "bomb", "scale": [], "scaleValue": { "sum": ["atk_scale", "atk_scale2", { "product": ["atk_scale_layer", 4] }] },
      "if": { "any": [{ "enemyInfliction": "cryst", "minStacks": 4 }, { "enemyInfliction": "natural", "minStacks": 4 }] },
      "frames": [35], "launch": 35, "events": ["chr_0017_yvonne_normal_skill_projhit"], "poise": "poise",
      "applies": [{ "kind": "consumeInfliction", "elements": ["cryst", "natural"] }, { "kind": "forcedReaction", "status": "solidification", "level": { "consumed": true } }],
      "energy": { "sum": ["usp_base", { "product": ["usp_layer", 4] }] },
      "sp": { "if": { "potentialAtLeast": 4 }, "then": "atb_return", "else": 0 } },
    { "id": "bomb_plain", "branch": "bomb", "scale": ["atk_scale"], "frames": [35], "launch": 35, "events": ["chr_0017_yvonne_normal_skill_projhit"], "poise": "poise",
      "sp": { "if": { "potentialAtLeast": 4 }, "then": "atb_return", "else": 0 } }
    ```
    With G3c: one hit, `scaleValue` `atk_scale` + (if consumed)
    `atk_scale2` + `atk_scale_layer` × `{consumed: true}`, energy likewise.
  - combo_skill: `tick1` [19] `energy: {sum: [usp, usp_extra]}`; `ticks`
    ×3 [42, 64, 87] `if: not P1`; `ticks_p1` ×5 [34, 49, 64, 79, 94] `if:
    P1`; `explosion` [124] `atk_scale_boom`, `poise`, `applies:
    [{forcedReaction solidification, level 1, extraSeconds 2}]`; all
    `launch: 0`, events `buff_chr_0017_yvonne_combo_skill` / `_finish`.
  - ultimate_skill: no hits, `takesControl`, `energyBlockSeconds: 2.0333`.
  - ult_attack1_1 … 3_2: `available: ult_state and not barrage`; one
    `shotN` per projectile (`scale: [atk_scale]`, `launch` = frame,
    `buffs: [{buff: ult_layers, beforeDamage: true}]` except 2_1's [21] and
    2_2's [11]).
  - ult_attack_end: `available: ult_end`; `end` [28] `poise`,
    `poiseControlledOnly`, `finalStrike: true`; `end_extra` [28]
    `atk_scale_extra`, `finalStrike: false`, `if: enemyStatus
    solidification`, `applies: [{consumeStatus [solidification],
    afterDamage: true}]`.
- **Waits on gaps:** G1 (interim exact but for the deferral), G2 (attack5
  after attack4 too early), G3 (verification; the bomb's branches), G4
  (weapons), row 26 (file order), B3 / T5 (engine-wide interims).

### Equipment kits

- **wpn_pistol_0005 (Navigator):** buffs `valid` (attrs 53, 54 `dmg_up`,
  attr 9 `crit_up2`, `duration`) and `valid_own` (the same × 2); triggers
  `{on: reaction, statuses: [solidification, corrosion]}`, `by: self` →
  `valid_own` (first ending `valid`), `beforeDamage`; `by: teammate` →
  `valid` with `if: not valid_own`. With G4: both buffs `gameBuff:
  buff_wpn_pistol_0005_valid` (one stack group, unlimited instances), and
  the interim `if` / `endBuff` go.
- **wpn_pistol_0007 (Home Longing):** buff `valid` (gameBuff
  `buff_wpn_pistol_0007_valid`, `maxStacks: max_stack`, `duration`,
  damageBonus `dmg_up`, elements cryst / natural, `skillType: battle`);
  trigger `{on: cast, kinds: [combo]}`, `by: self`. If Y2 says "next
  battle skill": `consumedBy: [battle]`.
- **wpn_pistol_0008 (Wedge):** buffs `cast` (attrs 51–54 `spell_dmg_up2`,
  `duration`) and `reaction` (`spell_dmg_up3`, `duration2`); triggers
  `{on: cast, kinds: [battle]}` and `{on: reaction, fromKinds: [battle]}`
  (`beforeDamage`), `by: self`. With G4: `gameBuff` `buff_wpn_pistol_0008`
  / `_extra_valid`.
