# Arcane (chr_0032_lizhiyan): gap report, batch 1

Scope: Arcane in both Array Arcana modes (INT: Intellect ≥ Will; WILL:
Will > Intellect), weapon Type 42: Solemn Phalanx (wpn_funnel_0016), gear
sets Eternal Xiranite (suit_usp02), Catastrophe (suit_usp01) and Hot Work
(suit_fire_natr01). Engine and kit format as of commit 3a54dd8.

Sources used: CharGrowthTable `skillGroupMap` texts (scratchpad
skill_desc.txt), PotentialTalentEffectTable / CharacterPotentialTable with
I18nTextTable_EN, SkillPatchTable, Json/SkillData `chr_0032_lizhiyan_*`
and Json/BuffData `buff_chr_0032_lizhiyan_*` (game 1.6), the current kit
(`packages/data/kits/operators/chr_0032_lizhiyan.json`), and the log
fixtures. Facts from the kit's own notes are marked *(kit claim)* where I
didn't re-derive them.

Data conventions found while reading (needed to read the branches below):
`CompareFloat.compare` 0 `<`, 1 `<=` (or `<`), 2 `>`, 3 `>=`, 4 `==`
(derived from branches whose meaning the descriptions fix, e.g.
ultimate_skill2 frame 58: `EntityBB_wisd_greater_will == 0` → WILL damage
`atk_scale_will`). The mode flag `EntityBB_wisd_greater_will` is set by
`buff_chr_0032_lizhiyan_passive` from `CompareDeckAttr compare 3 lhsType 2
rhsType 3` (deck Intellect ≥ deck Will). `SpellInfliction.inflictionType`
3 Nature, 2 Cryo, 1 Electric, 0 Heat (matches docs/design.md as corrected
in 3a54dd8).

## Action types per file

Damage = D, resources = R, state = S, timing = T. Cosmetic types (Effect,
PlaySound, Camera*, CharWeapon*, PlayAnimation, VoiceTrigger, EnemyHurtAnim,
RayCastEffect, ShowHideActor, SetAnimatorParam, root motion, rotation,
teleport, Selector*) are left out.

| File | Types that matter |
|---|---|
| attack1–5, plunging_attack_end | DamageAction (D), ObtainCostAction `atb` (R: SP; attack5 `atb` 17 at L12), ChannelingAction/ForEach (D: hit count), HitStopAction (T), ComboCacheAction, AllowNextSkillAction (T) |
| attack1_projhit | DamageAction, ObtainCostAction: not spawned by any 1.6 file (dead) |
| power_attack (finisher) | DamageAction with BreakingAttackCalculation ×5 (D), GainBreakingAttackAtb (R), HitStopAction (T) |
| normal_skill | SpawnAbilityEntity abilityrange2 (D), AllowNextSkillAction → combo (T) |
| normal_skill_abilityrange2 | SpellInfliction type 3 (S), DamageAction `atk_scale_will` / `atk_scale_wisd` by mode (D), CreateBuffAction `buff_common_obtain_ultimate_sp` (R: 6.5 energy to everyone, on hit), PullAction (WILL; positional), HitStopAction (T) |
| normal_skill_abilityrange, buff_…_normal_skill, buff_…_normal_skill_aura | InverseSpellInfliction, AuraAction: not spawned in 1.6 (dead) |
| combo_skill | SimpleCalcBB / ModifyDynamicBlackboard (S: `duration_final`, `rate_final` by mode), StoreAttributeValue attr 42 (S), CreateBuffAction seal_total at frame 9 (D/S), TimeDilationAction ×3 (T), SetAbilityEntityDuration, AllowNextSkillAction → battle skill at 16 (T) |
| buff_…_seal_total | SpellInfliction ×8 in a SwitchAction on `EntityBB_consumed_type`, WILL only (S), DamageAction `atk_scale_touch` (D), ObtainCostAction `usp` (R), CreateBuffAction seal / seal_listener / seal2 / seal_effect (S), HitStopAction (T), PullAction (WILL) |
| buff_…_seal (Imprisonment) | SealAction `duration` (S: enemy slowed), CreateBuffAction spell_vulnerable_pre at start (D), CastSkill combo_skill_abilityentity_end on end (D) |
| buff_…_combo_skill_spell_vulnerable_pre / _spell_vulnerable | VulnerableAction subType 3 Nature and 5 Cryo, `rate`, `duration_vul` (D) |
| combo_skill_abilityentity_end | DamageAction `atk_scale_boom` (D), CreateBuffAction seal_bunshin_end_listener (INT, S), FinishBuffAdvanced spell_vulnerable (S), HitStopAction (T) |
| buff_…_seal2 | abilityEvent 101 + CheckDamageDecorateMask 256 (Arcane's battle skill hits): ObtainCostAction costType 1 `atb_return_wisd` (R: SP), DamageAction `atk_scale_early_finish` (D), FinishBuffAdvanced seal (S) |
| buff_…_seal_bunshin_end_listener | same as seal2 for 99 s after an INT natural end (D/R/S) |
| buff_…_seal_listener | abilityEvent 204 on seal / bunshin_end_listener: CastSkill abilityentity_seal_again (D/S) |
| combo_skill_abilityentity_seal_again | INT frame 41: CreateBuffAction seal_finisher_wisd (D); WILL frame 239: seal_finisher (D); frame 240: spell_vulnerable (D); JumpToAction (T) |
| buff_…_seal_finisher_wisd | DamageAction `atk_scale_laser1` at buff frames 2/5/8/11, `atk_scale_laser2` at 17 (D), FinishBuffAdvanced spell_vulnerable at 17 (S), HitStopAction (T) |
| buff_…_seal_finisher | DamageAction `atk_scale_laser2` (D), FinishBuffAdvanced spell_vulnerable (S) |
| ultimate_skill | RefrainObtainUsp frames 0–47 (R), DamageAction `atk_scale` frame 47 (D), SpellInfliction by enemy infliction tag, WILL (S), CreateBuffAction `buff_common_natural_natural_corrupt_triggered` (count, duration2), INT (S), CreateBuffAction talent1_vulnerable, WILL (D), CreateBuffAction listener_owner (S/R), SpawnAbilityEntity abilityrange + 8 places (S), UltimateTimeAction, TimeDilationAction (T) |
| buff_…_ultimate_skill_listener_owner (array, 20 s) | RefrainObtainUsp clearUspOnEnd (R), ChangeSkillAction → ultimate_skill2 (S), CreateBuffAction talent1_enhance, INT (D), ObtainCostAction −999 on end if 2 strikes (R) |
| ultimate_skill_abilityrange / buff_…_inaura (on enemies in the array) | AuraAction (S); inaura abilityEvent 101 with mask 2097152 (Final Strike) or 4: CreateBuffAction target_mark / laser buffs, ObtainCostAction `usp_step` (= MaxUltimateSp / 2, ignoreUspGainScalar, uspRecoverTag) (R), layer counter (S) |
| buff_…_target_mark, _inaura_laser1/2/3, ultimate_skill_laser | SpawnAbilityEntity laser entities ×4/×4/×6 (D), DamageAction `atk_scale_laser` (D), timed markers (T) |
| buff_…_ultimate_skill_layer | counter, max 3, SaveBuffStackNum (S) |
| buff_…_ultimate_skill_listener (10 s) | ChangeSkillAction → ultimate_skill2, RefrainObtainUsp clearUspOnEnd, ObtainCostAction 1.0 isPercent (R), −999 on end (R), talent1_enhance (INT) |
| ultimate_skill2 | talent1_enhance (INT, frame 0), DamageAction `atk_scale` (INT) / `atk_scale_will` (WILL) frame 58 (D), talent1_vulnerable (WILL) (D), SetSkillCdAtOnce combo `cd_minus` % (WILL, frame 0) (T), UltimateTimeAction (T) |
| buff_…_talent1_enhance | EnhancedAction subType 1 `enhance_rate` (D: Arts Amp) |
| buff_…_talent1_vulnerable | VulnerableAction subType 3 and 5 (D) |
| buff_…_talent2 | abilityEvent 202 (a Corrosion buff Arcane applies): ModifyCollectedBuffBbValue `duration` + `duration_add`, `max_def_decrease` × (1 + `corrupt_rate`) (D/S) |
| buff_…_passive | CompareDeckAttr → `EntityBB_wisd_greater_will` (S) |
| train_*, buff_train_output_seal_lizhiyan | RaiseTrainLevelEvent: tutorial only |

## Mechanics

| # | Mechanic (source) | Status | How expressed / what's missing |
|---|---|---|---|
| 1 | Basic attack 1–5 hits (attack1 3×`atk_scale` at 10, attack2 3× at 11–13, attack3 2×, attack4 8×, attack5 1× at 22; SkillData DamageAction frames) | supported | kit hits with frames; verified on b7b3762d5da8 and bdf223db8e49 (all match) |
| 2 | Final Strike (attack5 mask 2097152) and its SP (`atb` 17 at L12) | supported | loader marks `finalStrike`; timeline reads skill `atb` |
| 3 | Final Strike Stagger (`poise`), Finisher (power_attack, BreakingAttackCalculation, "massive Nature DMG and recovers some SP") | gap | G14 (physical state); finisher left out of kit |
| 4 | Dive attack (plunging_attack_end `atk_scale`) | supported | kit hit; verified b7b3762d5da8 (8037) |
| 5 | Mode selection: "Intellect ≥ Will, Array Arcana: INT is ACTIVE"; deck attributes only (talent 1 text; CompareDeckAttr) | supported | `if: {attrAtLeast: [41, 42]}`; panel = permanent stats only. The kit's WILL predicate `attrAtLeast [42, 41]` is also true at equality; `{not: {attrAtLeast: [41, 42]}}` fixes it (kit fix, no engine work). Floor: description shows floored values, engine compares unfloored (edge case) |
| 6 | Battle skill hit: WILL `atk_scale_will`, INT `atk_scale_wisd` ("Array Arcana: INT: Deals more DMG"; abilityrange2 frame 20) | supported | two hits with `if`; WILL verified 0eef2474a26f |
| 7 | Battle skill Nature Infliction (abilityrange2 SpellInfliction type 3, before the DamageAction) | supported | `applies: infliction natural`; kit-draft could compile it (data) |
| 8 | Battle skill ultimate energy (`buff_common_obtain_ultimate_sp`: `usp_everyone` 6.5, at the hit, only if a target is hit) | supported | engine's generic 0.065 × natural SP at the cast; timing differs by 20 frames |
| 9 | Combo trigger INT: "When Nature Infliction or at least 2 stacks of non-Nature Arts Infliction are applied" | supported | `comboTriggers` `inflictionApplied` + `if` mode. Whether an application that forms a reaction counts is unknown (engine: no) |
| 10 | Combo trigger WILL: "When an Arts Infliction is applied" | supported | as 9 |
| 11 | Tactical Doubles hit `atk_scale_touch` at seal_total frame 6 (skill frame 15), energy `usp` 10 | supported | kit hit with `energy: usp`; verified 0eef, b7b3, e82d *(kit claim for e82d)* |
| 12 | Combo Nature/Cryo Susceptibility during Imprisonment: rate INT `rate_pre`, WILL min(Will × `spell_vul_per_will`, `max_spell_vul_will`) + `rate_pre`; duration `duration_pre` + `duration` (INT) / + `duration_will` (WILL) (combo_skill frames 0–3; seal → spell_vulnerable_pre) | supported | kit buffs with ValueExpr min/product/attr. Duration: ValueExpr `sum` now exists, so `{sum: ["duration_pre", "duration_will"]}` replaces the single key (kit fix). Will is read with StoreAttributeValue (live attribute; engine uses the panel) — matters only with Will buffs |
| 13 | P1: `atk_scale_touch`, `atk_scale_boom`, `atk_scale_laser1`, `atk_scale_laser2` × 1.3 | supported | potential skill-value multiply (PotentialTalentEffectTable potential_1) |
| 14 | P1: `rate_pre` + 0.06 only in WILL (`activeCondition lizhiyan_will`); `atb_return_wisd` + 10 only in INT | gap | G2: loader ignores `activeCondition`, so INT P1+ gets 0.10 instead of 0.04 Susceptibility |
| 15 | WILL combo: "apply another stack of Arts Infliction of the same element" (seal_total SwitchAction on `EntityBB_consumed_type` → SpellInfliction 3/2/1/0, before the touch damage) | gap | G1 |
| 16 | WILL pulls (combo, battle skill) | supported | positional only, nothing to model |
| 17 | Imprisonment itself (SealAction: "slows all actions") | unknown | no damage effect; whether it slows timers on the enemy (statuses, the explosion marker uses `useTimeDilationDt`) is unknown |
| 18 | Explosion when Imprisonment ends (seal buffEvent 1 → combo_skill_abilityentity_end, `atk_scale_boom` at its frame 14) | supported (approx.) | fixed frame 222 (WILL). bdf223db8e49 logs it 7418 ms after the touch vs 6.9 s modelled: hit-stop / time dilation (G13). An INT natural end has no fixed frame in the kit (G5) |
| 19 | INT: battle skill hitting the Imprisoned enemy (seal2 abilityEvent 101, mask 256): SP + `atb_return_wisd` (30 at L12), early-finish explosion `atk_scale_boom`, ends Imprisonment; then seal_again frame 41 → seal_finisher_wisd lasers 4 × `atk_scale_laser1` + `atk_scale_laser2`; "applies another instance of Nature Susceptibility and Cryo Susceptibility" | gap | G5 (trigger on own hit with a condition), G7 (SP). Kit hard-codes the hits as if the battle skill follows the combo at once (frames 36, 79–94) |
| 20 | INT: after a natural end, seal_bunshin_end_listener (99 s) gives the same early-finish effects to Arcane's next battle-skill hit on that enemy (combo_skill_abilityentity_end frame 10) | unknown | data read only; no log; would need G5 |
| 21 | Post-Imprisonment Susceptibility (seal_again frame 240 → spell_vulnerable, rate ← `rate_final`, duration ← `duration_vul` (2 s INT) or `duration_vul` + `duration_extra` (WILL); ended by seal_finisher_wisd's last laser) | gap | G6 (buff on another buff's end; buff ended by a hit). b7b3762d5da8 keeps 0.18 about 2 s past the 2nd Imprisonment *(kit claim)* |
| 22 | WILL seal_finisher (`atk_scale_laser2` at seal_again frame 239 when not INT) | unknown | which Imprisonment ends run seal_again in WILL (abilityEvent 204 looks like "finished early"); no log has the key |
| 23 | Combo cooldown (SkillPatch 20/19/18 s) | supported | skill cooldown |
| 24 | Talent 1: combo cooldown −6 s, INT only (`activeCondition lizhiyan_wisd`, paramType 2 and 4) | gap | G2: applied to every build (WILL 12 s instead of 18 s at L12; in-game test 13 is ready). paramType 4 is unknown (left as "other") |
| 25 | Ultimate array creation hit `atk_scale` frame 47 | supported | kit hits per mode; verified b7b3, e82d, dbae |
| 26 | Ultimate INT: forced Corrosion (CreateBuffAction `buff_common_natural_natural_corrupt_triggered`, `count` 1 → level, `duration2` 15 s), before the hit | supported | `forcedReaction` with `durationKey`; compilable (CreateBuff of a `buff_common_*_triggered`) (data) |
| 27 | Ultimate WILL: "targets enemies with Arts Infliction … applies another Arts Infliction stack of the same element" (SpellInfliction chosen by the enemy's infliction tag, before the hit) | gap | G1 |
| 28 | Ultimate energy block: RefrainObtainUsp 0–47, then listener_owner (`duration` 20 s, clearUspOnEnd) | supported (approx.) | `energyBlockSeconds` 21.567; ending early after two Cluster Strikes needs G6/G8 |
| 29 | Gloompurger Array state (listener_owner) | supported | kit buff `gloompurger_array` |
| 30 | Cluster Strike: "When hitting an enemy within the Gloompurger Array with a Finisher or a Final Strike performed by the controlled operator … triggers up to 2 times" (inaura abilityEvent 101, mask 2097152 or 4; 0.4 s marker; layer counter max 2; 4 lasers × `atk_scale_laser` each, `laser_count` 8) | gap | G8 |
| 31 | Cluster Strike energy: each strike `usp_step` = MaxUltimateSp (attr 22) / 2, ignoring Ultimate Gain Efficiency and the block; listener start +100%; −999 when the window ends unused | gap | G9 |
| 32 | Switch to Gloompurge Arcana for 10 s after the 2nd strike (listener, ChangeSkillAction) | gap | needs G8 to start the state; `availableWhile` exists. Today ult2 is never castable (its energy is blocked) |
| 33 | Ultimate 2 hit frame 58: INT `atk_scale` (14.4 at L12, × 1.3 at P5), WILL `atk_scale_will` (3.6) | supported | kit hits with `if` (unreachable until 32) |
| 34 | P5: after casting ult 2, combo cooldown −`cd_minus` (30%) if cooling down (SetSkillCdAtOnce isPercentage, frame 0; data: WILL only, the text doesn't say) | gap | G10; mode restriction unknown (in-game test) |
| 35 | Talent 1 WILL: ult 1 and ult 2 hits apply min(Will × `spell_vul_rate_per_will`, `spell_vul_rate`) + `spell_vul_rate_potential` Nature/Cryo Susceptibility for `duration` 10 s, "cannot stack" (talent1_vulnerable, before the DamageAction) | gap | G3 (talent values unreachable); otherwise a kit buff with ValueExpr. b7b3762d5da8 logs 0.128 at Will 788 (= cap at talent level 2) as a boundary buff on the ult hit |
| 36 | Talent 1 INT: "During the ultimate, Arcane gains `enhance_rate` Arts Amp" (talent1_enhance, EnhancedAction subType 1; 0.24 at talent level 2, +0.16 at P5) | gap | G3, G6; duration unknown: data makes it a child of the array (20 s) and of the listener, but d9e59d0fb737 logs `buff_common_affixes_enhance_spell` 0.24 only as a boundary buff on the ult hit (6098 ms) and on no later hit (combo at 9934 ms) |
| 37 | Talent 2 (+P3): "Corrosion applied by Arcane lasts `duration_add` s longer, and Max Resistance Reduction is increased to 1 + `corrupt_rate` times" (10 s / 0.1 at level 2; P3 +5 s / +0.2) | gap | G4 (and G3 for the values). bdf223db8e49: Corrosion from 8152 ms still on her hits at 24090 ms (15.9 s; base 15 s) |
| 38 | P2: Intellect and Will +15, Arts Intensity +16 | supported | potential attribute effects |
| 39 | P4: both ultimates cost × 0.85 | supported | skillParam cost |
| 40 | Attribute nodes: Intellect and Will +8/+10/+10/+15 | supported | attribute nodes |
| 41 | Time stop / dilation / hit-stop (UltimateTimeAction, TimeDilationAction in combo and ultimates, HitStopAction on most hits) | gap | G13 (timing; known) |
| 42 | Reaction initial hit logged as `buff_common_natural_triggered` (her Nature onto Cryo; 0eef 3620 ms, bdf2 8152 ms) | gap | G15 (log tooling) |

Weapon Type 42: Solemn Phalanx (wpn_funnel_0016; sk_wpn_funnel_0016,
buff_wpn_funnel_0016_*). The mode test is the wielder's own deck
attributes; everything below is wielder-relative.

| # | Mechanic (source) | Status | How expressed / what's missing |
|---|---|---|---|
| W1 | Intellect +156, Ultimate Gain Efficiency +46.4%, ATK +`atk_up` (44.8% at skill 9) (wpn_attr_wisd_high, wpn_sp_attr_usgs_high, sk_wpn_funnel_0016 statModifier attr 2 slot 6) | supported | permanent stats in the panel |
| W2 | "Wielder's Intellect ≥ Will" / "Will > Intellect" gate (CompareDeckAttr compare 3 on the wielder, re-checked on abilityEvent 155 and 6) | gap | G11 (equipment effects need a Predicate) |
| W3 | Intellect ≥ Will: when the wielder applies Arts Infliction with own skill (abilityEvent 126, CheckOriginSkillType [2, 6, 7]) → wielder Heat/Electric/Cryo/Nature DMG + `spell_dmg_up` for `duration` 20 s (wisd_natureup attrs 51–54, stackingType 4) | gap | G12 (trigger: infliction applied by wielder, skill-type filter). d9e59d0fb737 logs `wpn_funnel_0016_wisd_natureup` 0.32 from her battle-skill infliction (12450 ms) |
| W4 | Intellect ≥ Will: when the wielder applies Arts Susceptibility with own skill (abilityEvent 206 + buff check) → wielder ATK + `atk_up2` for 20 s (wisd_atkup) | gap | G12 (trigger: buff of a category applied by wielder). d9e5 logs it on the combo touch, 4 frames after the combo's Susceptibility |
| W5 | Will > Intellect: when the wielder applies Arts Burst with own skill (abilityEvent 127) → enemy Arts DMG Taken + `spell_dmg_taken_up` (damageTypeMask 92) for `duration3` 25 s; same-name instances: strongest only (stackingType 1, priority key) | gap | G12 (trigger: burst by wielder → enemy debuff) |
| W6 | Will > Intellect: when the wielder applies Arts Susceptibility with own skill → enemy Arts DMG Taken + `spell_dmg_taken_up2` for `duration4` 25 s (will_dmg, stackingType 1) | gap | G12. dbaee23b801d: `buff_wpn_funnel_0016_will_dmg` is a boundary buff on her WILL combo touch |

Gear sets (passive_equipsuit_*, buff_equipsuit_*; set skill level 1).

| # | Mechanic (source) | Status | How expressed / what's missing |
|---|---|---|---|
| S1 | Eternal Xiranite: HP +1000 | supported | permanent stat |
| S2 | Eternal Xiranite: "After the wearer applies Amp, Protection, Susceptibility, or Weakness, other teammates gain DMG Dealt + `dmg_up` (16%) for 15 s. This effect cannot stack." (abilityEvent 102 + CheckBuffIdInContext; CharacterTeamFinder + ExcludeOwnerValidator; AddAttack DamageScaleProcessor NormalCalcZone attacker side = damage bonus; stackingType 2) | gap | G12 (trigger: buff of a category applied by wearer; target "team except wearer"). d9e59d0fb737 logs `equipsuit_usp_02_AddAttack` damageBonus 0.16 on Arcane from Liino's set. The BuffData default 0.25 is not the value: SkillPatch 0.16 matches the log |
| S3 | Catastrophe: Ultimate Gain Efficiency +20% | supported | permanent stat |
| S4 | Catastrophe: "The wearer casts a battle skill, the action returns 50 SP. This effect only triggers 1 time per battle." (abilityEvent 30, CheckSkillType [2], `has_gain_atb` reset on abilityEvent 6) | gap | G12 (trigger on own cast, count limit 1) + G7 (returned SP) |
| S5 | Hot Work: Arts Intensity +30 | supported | permanent stat (attr 87 → artsIntensity) |
| S6 | Hot Work: "After the wearer applies Combustion … Heat DMG + 50% for 10 s. After the wearer applies Corrosion … Nature DMG + 50% for 10 s. … cannot stack." (abilityEvent 102 on the status buffs; attrs 51 / 54; stackingType 2) | gap | G12 (trigger: reaction status applied by wearer, forced ones included). d9e59d0fb737 logs `fninflict_01_poisedamageadd` 0.5 as a boundary buff on her INT ultimate (forced Corrosion, 6098 ms) |

Counts: 42 + 6 + 6 = 54 mechanics: supported 27, gap 24, unknown 3,
data 0 (two compilable items, 7 and 26, are marked supported since the kit
already writes them), unique? 0.

## Gaps

**G1. Infliction of the element the enemy already has**
- family: arts state
- feature: a `HitApplication` `{kind: "infliction", element: "enemy"}`
  (stacks default 1): at application, read the enemy's current infliction;
  if there is one, add stacks of its element (so a burst, as for any
  same-element stack); if none, do nothing. Evaluated in the hit's
  `applies`, before damage. The combo's Switch is on
  `EntityBB_consumed_type`, which may be the element of the triggering
  infliction rather than what's on the enemy now; with only the trigger
  event in between they're the same unless the trigger formed a reaction
  (see in-game test A).
- evidence: seal_total frame 6 (SwitchAction → SpellInfliction 3/2/1/0,
  WILL branch); ultimate_skill frame 47 (CheckBuffStackNumAdvanced on the
  four infliction tags → SpellInfliction, WILL branch); conditionPostDesc2
  of ComboSkill and UltimateSkill. Also listed in kit-abstractions.md
  "Arts state".
- impact: WILL is missing 1 stack per combo and per ultimate: an Arts
  Burst (160% ATK, plus teammates' and her weapon's burst triggers, W5),
  higher stack counts for later reactions, and combo windows that depend
  on stacks. b7b3762d5da8 credits Arcane with Cryo bursts at 10340 and
  10910 ms but not at her combo/ultimate frames, so the timing needs
  checking.

**G2. Potential and talent effects limited to a mode (`activeCondition`)**
- family: data compilation (with conditions)
- feature: the loader keeps `activeCondition` on each
  PotentialTalentEffectTable entry; a kit maps condition IDs to Predicates
  (`"activeConditions": {"lizhiyan_wisd": {attrAtLeast: [41, 42]},
  "lizhiyan_will": {not: …}}`); `computeStats` applies the effect only if
  the predicate holds for the panel (deck attributes, so evaluate after
  the permanent stats, without the gated effects themselves). Also decode
  skillParamModifier paramType 4 (here −6 on the combo alongside paramType
  2; only Arcane uses it).
- evidence: chr_0032_lizhiyan_talent_1_1 / _1_2 (paramType 2 and 4, −6,
  `lizhiyan_wisd`); chr_0032_lizhiyan_potential_1 (`rate_pre` +0.06
  `lizhiyan_will`, `atb_return_wisd` +10 `lizhiyan_wisd`). Only Arcane's
  entries use activeCondition in 1.6. `efsim calc` lists "talent 1 level 2:
  effect type 2" as not applied (the paramType 4 half).
- impact: WILL combo cooldown 12 s instead of 18 s at L12 (illegal combos
  in every WILL rotation: +50% combo casts); INT P1+ Susceptibility 0.10
  instead of 0.04 on Nature and Cryo hits during Imprisonment.

**G3. Talent values (attachSkill blackboards)**
- family: data compilation
- feature: read modifyType 1 (attach skill) entries: the attached skill
  (`chr_0032_lizhiyan_talent1`, `_talent2`) gets the entry's blackboard as
  its values at the build's talent level, then the potentials'
  skillBbModifiers on it (P3, P5) apply; the talent skills become
  reachable from ValueExpr `{key, skill}` (today the loader requires a
  skillGroup, and `data.skills` has neither). Talent level 0 → effect
  absent.
- evidence: PotentialTalentEffectTable chr_0032_lizhiyan_talent_1_2
  (`enhance_rate` 0.24, `spell_vul_rate` 0.128, `spell_vul_rate_per_will`
  0.0002, `duration` 10), talent_2_2 (`duration_add` 10, `corrupt_rate`
  0.1); potential_3/5 modify these; probe: `data.skills
  ["chr_0032_lizhiyan_talent1"]` is undefined.
- impact: mechanics 35–37 can't be written. Talent 1 WILL Susceptibility
  alone is +12.8% (P5 +19.8%) on the team's Nature and Cryo hits for 10 s
  after each ultimate (verified magnitude in b7b3762d5da8).

**G4. The applier's talents change the statuses it applies**
- family: arts state
- feature: per-operator status modifiers, from ValueExprs at the applier:
  for `corrosion` applied by that operator (reaction or forced), duration
  + `duration_add` s and the shred cap × (1 + `corrupt_rate`) (the ramp's
  `max_def_decrease`; whether the per-second rate also scales is to be
  checked). Stored on the ActiveStatus when applied.
- evidence: buff_chr_0032_lizhiyan_talent2 abilityEvent 202 →
  ModifyCollectedBuffBbValue `duration` + `duration_add`,
  `max_def_decrease` × `final_corrupt_rate`; bdf223db8e49 Corrosion lasting
  ≥ 15.9 s; listed in kit-abstractions.md "Arts state" and roadmap item 3.
- impact: Corrosion from Arcane lasts 25–30 s instead of 15 s and shreds
  up to 13.2–15.6 instead of 12 points at level I (× Arts Intensity
  effect); affects every teammate's hits. Several bdf223db8e49 hits are
  "under unmodelled effects" because of it.

**G5. Effects triggered by one of the operator's own hits under a condition**
- family: triggers
- feature: kit `triggers` entry `on: hit` with `by: self`, a hit filter
  (skill kind battle, i.e. decorate mask 256), a Predicate (an own enemy
  buff active, here Imprisonment / seal2), and `do`: land kit hits at
  delays (explosion now, lasers at +41 + 2/5/8/11/17 frames), SP (G7),
  end a kit buff (Imprisonment), apply a kit buff (second Susceptibility).
  Evaluated when the triggering hit lands, after its own damage.
- evidence: buff_chr_0032_lizhiyan_combo_skill_seal2 abilityEvent 101 +
  CheckDamageDecorateMask 256; seal_listener → seal_again frame 41 →
  seal_finisher_wisd; conditionPostDesc1 ("Hitting an enemy under
  Imprisonment with Arcane's battle skill returns some SP, ends the
  Imprisonment early …"). d9e59d0fb737: seal2 and the battle skill at
  12450 ms, lasers 13829–14345 ms.
- impact: INT's main damage (explosion 1.2 + lasers 5.0 × ATK at L12, ×
  1.3 at P1) is right only if the battle skill follows the combo
  immediately; any other rotation gets it at the wrong time or when it
  can't happen, and search can't explore the trade-off. Same family as
  Liino's volley and Arcane's Cluster Strike (G8).

**G6. Buffs that end, or start, with other buffs and hits**
- family: buff lifecycle
- feature: (a) a kit buff applied when another kit buff ends (Imprisonment
  end → post-Imprisonment Susceptibility, duration `duration_vul` (+
  `duration_extra` in WILL), rate `rate_final`); (b) `ends` on a hit (the
  final laser ends it); (c) a child buff that lasts while its parent does
  (INT Amp while the array state lasts, then the listener; array ended by
  the second Cluster Strike). Plus `on: buffEnd` for triggers (the WILL
  explosion when Imprisonment ends, so it follows the buff instead of a
  fixed frame once timing changes).
- evidence: seal_again frame 240 (spell_vulnerable), seal_finisher_wisd
  frame 17 FinishBuffAdvanced spell_vulnerable; listener_owner buffEvent 0
  talent1_enhance `asChildBuff`; listener buffEvent 0 FinishBuffAdvanced
  listener_owner.
- impact: post-Imprisonment Susceptibility (0.18 for ~2 s in b7b3762d5da8
  *(kit claim)*) missing; Amp and array state lengths wrong once Cluster
  Strikes exist.

**G7. SP grants from hits and triggers**
- family: values (resource grants; triggers' `do`)
- feature: hit and trigger field `sp: ValueExpr`, returned SP
  (ObtainCostAction costType 1 with atbGainMethod 1: spent first, gives no
  ultimate energy, as the timeline already treats skill `atb`). Today only
  a skill's `atb` key on its first hit exists.
- evidence: seal2 / bunshin_end_listener `atb_return_wisd` (30 at L12,
  +10 P1 INT); buff_equipsuit_usp_01 `atb_recover` 50.
- impact: INT loses 30–40 SP per combo cycle (a third of a battle skill);
  Catastrophe's 50 SP missing; SP-limited rotations wrong.

**G8. Cluster Strike: a team trigger on Final Strikes and Finishers inside the array**
- family: triggers
- feature: `on: hit`, `by: controlled operator` (anyone), hit filter Final
  Strike (mask 2097152) or Finisher (mask 4), condition: the owner's array
  buff active; debounce 0.4 s; count limit 2 per array; `do`: 4 laser hits
  (`atk_scale_laser`, Arcane's ATK and zones, log key
  chr_0032_lizhiyan_ultimate_skill_laser) after the laser delay, gain the
  layer counter, energy `usp_step` (G9); on the 2nd: end the array state,
  start the 10 s Gloompurge Arcana state. Evaluated when the teammate's hit
  lands. `teamTriggers` today only `applies`/`gains` on finalStrike.
- evidence: buff_chr_0032_lizhiyan_ultimate_skill_inaura abilityEvent 101
  (CheckDamageDecorateMask 2097152 / 4, CreateTimedMarker 0.4 s,
  ultimate_skill_layer); UltimateSkill desc; SkillPatch `laser_count` 8.
  When target_mark spawns laser3 (6 lasers) is unknown.
- impact: 2 × 4 × 0.45 = 3.6 × ATK per ultimate missing at L12, and
  ultimate 2 (INT 14.4 × ATK, 18.7 at P5; WILL 3.6 × plus talent 1
  Susceptibility) never happens.

**G9. Energy grants that bypass efficiency and blocks; clearing energy**
- family: values
- feature: energy grant options `ignoreEfficiency` (ignoreUspGainScalar),
  `ignoreBlock` (uspRecoverTag), `percent` (isPercentValue, of max), and a
  "set energy to 0" when a state buff ends (clearUspOnEnd, −999). Values
  may name a panel attribute (`usp_step` = MaxUltimateSp / 2, attr 22,
  after P4's cost × 0.85).
- evidence: inaura / target_mark ObtainCostAction `usp_step`; listener
  buffEvent 0 ObtainCost 1.0 isPercent useUspRecoverTag; listener /
  listener_owner RefrainObtainUsp clearUspOnEnd and ObtainCost −999.
- impact: with G8, ultimate 2 becomes castable only through these grants;
  without G9 it stays uncastable.

**G10. Cooldown change as a trigger action**
- family: triggers (cooldown change)
- feature: `do: {cooldown: {skill, percent | seconds}}`: cut the
  remaining cooldown of a skill now, if it's cooling down. Here on own
  ult 2 cast (frame 0), WILL only by the data (condition
  `EntityBB_wisd_greater_will == 0` and `cd_minus > 0`).
- evidence: ultimate_skill2 frame 0 SetSkillCdAtOnce isPercentage
  `cd_minus` (0.3 at P5); potential_5 text. Si's talent and Gilberta P5
  need the same (kit-abstractions.md "Triggers").
- impact: one extra-early combo per ult 2 at P5 (needs G8 first).

**G11. Equipment effects gated by a Predicate on the wielder**
- family: conditions
- feature: weapon and gear-set kit entries take a Predicate evaluated for
  the wielder (here `attrAtLeast [41, 42]` and its negation on the
  wielder's deck attributes), alongside or instead of user-toggled
  `conditions`. Re-evaluated when the panel is built (abilityEvent 155/6
  re-check at battle start).
- evidence: sk_wpn_funnel_0016 and buff_wpn_funnel_0016 CompareDeckAttr
  compare 3 lhsType 2 rhsType 3; weapon text "Wielder's Intellect ≥ Will …
  Wielder's Will ＞ Intellect".
- impact: without it the weapon's two halves can't be chosen per wielder
  (needed for W3–W6 on any operator).

**G12. Equipment triggers on the wielder's own events**
- family: triggers
- feature: weapon and gear-set kits get the same `triggers` list as
  operators, with `by: wielder` and these events: infliction applied by
  the wielder (optional skill-kind filter: battle, combo, ultimate =
  CheckOriginSkillType [2, 6, 7]); Arts Burst by the wielder; reaction
  status applied by the wielder (forced included); a buff of a category
  applied by the wielder (Susceptibility, Amp, Protection, Weakness:
  derived from the kit buff's zones, so kit buffs need a category when
  their zone doesn't say it, e.g. Protection, Weakness); the wielder casts
  a skill of a kind; count limit per battle. `do`: apply a buff to self,
  team-except-wielder (new target), or the enemy, with values from the
  equipment skill's blackboard at its level, duration, element filters
  (damageTypeMask 92 → Arts elements), and stacking (stackingType 1:
  strongest of the same name across wielders; 2/4: refresh).
- evidence: W3–W6 (buff_wpn_funnel_0016_wisd / _will abilityEvents 126,
  127, 206), S2 (buff_equipsuit_usp_02 abilityEvent 102,
  ExcludeOwnerValidator), S4 (buff_equipsuit_usp_01 abilityEvent 30, 6),
  S6 (buff_equipsuit_fninflict_01 abilityEvent 102); logged in
  d9e59d0fb737 and dbaee23b801d (see the tables).
- impact: on Arcane, INT: +32–56% ATK and +32–56% Arts DMG (weapon skill
  4–9) most of the fight; WILL: +9.6–16.8% Arts DMG Taken twice on the
  enemy for the whole team; Hot Work +50% Nature DMG after each Corrosion;
  Eternal Xiranite +16% for three teammates after each of her
  Susceptibilities. Today all of it is either off or a manual always-on
  toggle, so team numbers with these items are off by tens of percent.

**G13. Time stop, dilation and hit-stop**
- family: timing
- feature: known gap (time dilation); here UltimateTimeAction on both
  ultimates, TimeDilationAction in the combo (frames 0 and 9) and
  ultimates, HitStopAction on the touch (0.2 s), explosion (0.3 s), lasers
  (0.55 s), battle skill (0.4 s).
- evidence: bdf223db8e49 explosion 7418 ms after the touch vs 6.9 s
  modelled.
- impact: hit timings drift by ~0.5 s per combo; buff windows and
  Corrosion ticks slip.

**G14. Stagger and Finishers**
- family: physical state
- feature: known gap (finisher formula, Stagger); here power_attack
  (BreakingAttackCalculation, GainBreakingAttackAtb) and every hit's
  `poise`. Also the Finisher half of G8's Cluster Strike trigger.
- evidence: chr_0032_lizhiyan_power_attack; NormalAttack desc.
- impact: Finisher damage and its SP missing; Cluster Strike only from
  Final Strikes.

**G15. Reaction initial hit logged as `buff_common_<element>_triggered`**
- family: log tooling
- feature: map `buff_common_natural_triggered` (and other elements) to the
  reaction's initial hit, or explain its ×1.42 (comment in reactions.ts).
- evidence: 0eef2474a26f 3620 ms (18904), bdf223db8e49 8152 ms (28282),
  both her battle skill's Nature onto Cryo; "not covered" in the checker.
- impact: one unverifiable hit per such reaction (a third of her logged damage in
  0eef2474a26f).

## Verification

Fixtures (all Arcane with wpn_funnel_0016):

| Fixture | Mode, potential, gear | Checks today | Will check after |
|---|---|---|---|
| zmdlogs-b7b3762d5da8 | WILL, P4, Eternal Xiranite | 13/13 match: basics, plunge, touch ×2 with WILL Susceptibility, ult hit with talent 1 Susceptibility (as a logged boundary buff) | G3 (talent 1 Susceptibility 0.128 from the kit, not the log), G1 (the Cryo bursts credited to her), weapon W5/W6 |
| zmdlogs-bdf223db8e49 | WILL, P5, 3 Eternal Xiranite + 1 Hot Work | 32 match, 26 under Corrosion she applied, 1 not covered (G15) | G4 (Corrosion duration and cap), G13 (explosion timing) |
| zmdlogs-0eef2474a26f | WILL, P5, Catastrophe ×3 + Xiranite ×1 | 3/4 match (battle skill under Corrosion level 2) | G15, G4 |
| zmdlogs-dbaee23b801d | WILL, P0, Eternal Xiranite | 4/4 match (W6's debuff as a logged boundary buff) | G12 (W6 from the kit) |
| zmdlogs-d9e59d0fb737 | INT, P0, Hot Work | 0/16 match: all under her forced Corrosion; `zmdlogs scales` still implies ×1.88 on attack1 (0.2632 vs 0.14) with the logged effects (Hot Work 0.5, weapon INT 0.32 ATK and 0.32 Arts DMG, teammates' buffs) | the only INT log: G4, G5 (lasers 13829–14345 ms), talent 1 Amp (logged 0.24), G12 (W3, W4, S6). The residual is the open question of in-game test 7 |
| pending/zmdlogs-e82d45c46040 | WILL, P5, Eternal Xiranite | touch ×2, ult *(kit claim)* | as b7b3 |

No log has a Cluster Strike (`chr_0032_lizhiyan_ultimate_skill_laser`),
ultimate 2, the WILL seal_finisher or seal_bunshin_end_listener.

In-game tests (existing 7 and 13 still apply; 13 settles G2's cooldown):

- **A. WILL same-element stack.** Will > Intellect; a teammate applies
  Cryo Infliction to a dummy, then Arcane's combo (and separately her
  ultimate). Does a Cryo Arts Burst appear at the combo hit / ultimate
  hit, and how many Cryo stacks are shown after? Repeat with Nature as
  the trigger. Settles G1 and whether the element is the enemy's or the
  trigger's.
- **B. INT Arts Amp duration.** Intellect ≥ Will; ultimate, then within
  20 s basic attacks and a battle skill: does the Arts Amp buff icon
  stay for the array's 20 s or end with the animation? (d9e59d0fb737
  suggests the latter.)
- **C. INT combo without the battle skill.** Combo, let Imprisonment end
  (one explosion), then battle skill on the same enemy within a few
  seconds: does it give SP, a second explosion and the lasers (mechanic
  20)?
- **D. P5 cooldown cut in INT** (only with a P5 Arcane): ult 2 while the
  combo cools down, INT vs WILL: is the cooldown cut in both?
- **E. Combo trigger from a reaction.** Arcane with combo ready; a
  teammate applies Heat, then Nature (forming Corrosion, no Nature
  infliction left): does Arcane's combo become available? (INT and WILL
  triggers, mechanics 9–10.)
- **F. Talent 2 Corrosion duration.** Her battle skill on a Cryo-inflicted
  dummy: time the Corrosion icon (expect 25 s at talent level 2, 30 s at
  P3).

## Notes on the current kit (claims re-checked)

- Confirmed: combo seal_total at frame 9, touch at its frame 6, Imprisonment
  `duration_pre` + `duration` (INT) / `duration_will` (WILL), explosion at
  abilityentity_end frame 14, laser frames 2/5/8/11/17, ultimate hit and
  forced Corrosion at 47, ult 2 hit at 58, RefrainObtainUsp 0–47 then 20 s,
  talent 1 cooldown applied to every build, attack1–5 and plunge keys.
- Outdated: the notes still speak of `when` and `ValueSpec`; ValueExpr
  `sum` now allows `duration_pre` + `duration`, and `not` allows the
  strict WILL predicate.
- Added here: P1 also scales `atk_scale_boom`, `atk_scale_laser1/2` (the
  kit note mentions only `atk_scale_touch`); P5's cooldown cut is WILL-only
  in the data; the battle skill's energy comes from
  `buff_common_obtain_ultimate_sp` at the hit; Cluster Strikes grant half
  the ultimate cost each (G9); Hot Work and the weapon's INT buffs are
  logged in d9e59d0fb737 but the ×1.9 residual remains with them.

## Re-analysis (pass 2, 2026-10-18)

Against the engine and kit format at b33e2e7 (everything in batch-1.md
"Progress"), `efsim kit-draft chr_0032_lizhiyan` (v2) and the D1 `KNOWN`
list in packages/data/test/skillCompile.test.ts. Every claim above was
re-read in Json/SkillData, Json/BuffData, SkillPatchTable and
I18nTextTable_EN (rmxlinux, game 1.6), and values were taken from the
engine's `skillValue` on the fixture builds (P0 d9e59d0fb737, P4
b7b3762d5da8, P5 bdf223db8e49).

### Facts re-checked (corrections to the first round)

- **The WILL "post-Imprisonment Susceptibility" (row 21, kit claim) isn't in
  the data.** `buff_…_combo_skill_spell_vulnerable` is created only by
  `combo_skill_abilityentity_seal_again`, which only `buff_…_seal_listener`
  casts, on abilityEvent 204 (the seal or the bunshin_end_listener finished
  *by an action*). Only INT ends it early: seal2's abilityEvent 101 handler
  starts with `CompareFloat isWisd ≥ 1`, and bunshin_end_listener is only
  created under INT (abilityentity_end frame 10). abilityentity_end (the
  natural end) also finishes any spell_vulnerable at its frame 14. So in
  WILL the Susceptibility ends with Imprisonment (spell_vulnerable_pre is
  `asChildBuff` of the seal). b7b3762d5da8's 0.18 lasting ~2.0–2.3 s past
  the modelled end (second touch 7150 ms, seen at 15652, gone at 15927)
  matches the ultimate cast inside it: UltimateTimeAction frames 0–47
  (1.57 s) plus the combo's ComboSkill slow-down (0.6 s curve), which Ti1
  now models. bdf223db8e49's explosion +0.5 s (7418 ms vs 6.9 s) is the
  same kind of shift (combo slow-down, hit-stops).
- **WILL seal_finisher (row 22) is unreachable**: it sits at seal_again
  frame 239, which only runs after an early end (INT only, above).
- **seal_again's timing** (row 19): spell_vulnerable at its frame 0 (both
  modes), seal_finisher_wisd at frame 41 (INT, if no lizhiyan_combo_finisher
  marker), lasers at that buff's frames 2/5/8/11 (laser1) and 17 (laser2,
  which also finishes spell_vulnerable). From the battle-skill hit H: lasers
  at H+43/46/49/52/58. d9e59d0fb737 has them at H+41.4/44.4/48.2/50.6/56.9
  (12450 → 13829…14345 ms): ~1.5 frames early, consistently.
- **INT post-Imprisonment Susceptibility duration**: seal_again assigns
  `duration_vul ← duration_calc = duration_vul (+ duration_extra in WILL)`,
  but no blackboard gives seal_again a `duration_vul` (not in its
  defaults, not in SkillPatch: `skillValue` throws). The buff falls back to
  its default 12 s and is ended by the final laser, so in practice it lasts
  from the early end to H+58 (1.93 s), rate `rate_final` (= `rate_pre` in
  INT). SkillPatch's `duration_wisd` (2 s) isn't read by any graph.
- **After a natural INT end** (row 20): bunshin_end_listener (99 s,
  lifeType 1) gives the next battle-skill hit SP `atb_return_wisd` and an
  explosion (`atk_scale_early_finish`, its own event key), then finishes
  itself early (→ 204). The lasers would need seal_listener and the clone,
  but the clone is removed by abilityentity_end's FinishOwnerAction at its
  frame 44, so probably no lasers: in-game test C.
- **Imprisonment slows the enemy's clock**: SealAction with a direct curve
  over its duration, 0.3 → 0.2 (by 5%) → 1.0 (at the end); the tutorial
  text says "An enemy under Imprisonment will experience a slower flow of
  time". The seal buff itself has `useTimeDilationDt: false`.
- **Cluster Strike** (rows 30–32): inaura abilityEvent 101, two paths:
  (a) Final Strike (mask 2097152) by the controlled operator → target_mark
  (0.1 s); at its end, if the array (listener_owner) is up and no 0.4 s
  marker: laser buff by layer count, energy `usp_step`, layer +1; (b)
  Finisher (mask 4), once per finisher (`is_power_attacked`, reset on
  abilityEvent 21), no 0.4 s marker: the same at once. Laser buffs spawn
  lasers at frames 0/4/8/12 (laser1, laser2: 4 each) or 0,0,5,5,10,10
  (laser3: 6); each laser deals `atk_scale_laser` at its frame 12 (mask
  4608, ultimate). So lasers at FS+15/19/23/27 or Finisher+12/16/20/24.
  `atk_scale_laser_will` equals `atk_scale_laser` at all 12 levels (one hit
  serves both modes). `usp_step` = attribute 22 (max energy) / 2 per strike,
  ignoreUspGainScalar, uspRecoverTag. A third strike (laser3) is in practice
  unreachable: at the second, listener_owner's abilityEvent 9 starts the
  listener and finishes itself, and its end (buffEvent 2) ends the array
  entity (abilityentity_finish_self), whose aura carries inaura.
  `buff_…_ultimate_skill_inaura_attack` is referenced by nothing (dead).
- **Ultimate state lifecycle**: listener_owner (array, `duration` 20 s):
  ChangeSkillAction to ult 2, RefrainObtainUsp clearUspOnEnd, INT
  talent1_enhance as a child; at its end with < 2 strikes, energy −999.
  listener (Gloompurge Arcana): finishes listener_owner (clearing energy),
  then +100% (isPercent, uspRecoverTag, *not* ignoreUspGainScalar), INT
  talent1_enhance child, RefrainObtainUsp clearUspOnEnd; at its end, the
  layer counter and energy −999. Its ChangeSkillAction lasts 10 s
  (lifeTimeType 2); the buff's own `duration` isn't assigned (default 30 s).
  Whether casting ult 2 ends it is unknown (test G).
- **Arcane's ultimates don't take control** (`switchToCenterBeforeCast`
  false; Laevatain's is true), so the Final Strikes that trigger Cluster
  Strikes are usually a teammate's.
- **Talent 1 WILL Susceptibility** (rows 35, ult 1 and ult 2): rate =
  min(Will × `spell_vul_rate_per_will`, `spell_vul_rate`) +
  `spell_vul_rate_potential` (Will by StoreAttributeValue 42), duration key
  `duration` taken from the *ultimate's* blackboard by assignBlackboard
  (ultimate `duration` = 20 s; the talent's `duration` = 10 s): which one
  wins is unknown (test H; b7b3762d5da8 ends at 18024 ms with it still on,
  10.9 s after the hit). Values: 0.128 cap, 0.0002 per Will, +0.07 at P5.
- **Talent 1 INT Amp**: child of listener_owner and then of listener
  (array + Gloompurge state), plus a cast-long child in ult 2 (frame 0,
  autoFinishByAction). d9e59d0fb737 logs it (0.24) only as a boundary
  buff on the ult hit; if it really lasts the array, it explains ×1.24 of
  that log's ×1.9 residual (test B, test 7).
- **Talent 2**: abilityEvent 202 on a Corrosion-tagged buff Arcane applies:
  `duration` + `duration_add` (only if the duration is > 0), and
  `max_def_decrease` × (1 + `corrupt_rate`); the ramp rate isn't touched.
  Values: 10 s / 0.1 below P3, 15 s / 0.3 from P3.
- **Talent 1 cooldown**: −6 s (paramType 2) now applies in INT only (C3).
  `efsim calc` still lists "talent 1 level 2: effect type 2" (the paramType
  4 half) as not applied.
- **P5 cooldown cut**: ult2 frame 0, WILL only (`EntityBB_wisd_greater_will
  == 0`, `cd_minus > 0`), SetSkillCdAtOnce isPercentage `cd_minus` (0.3)
  on the combo. Text: "if … still in its cooldown, immediately shorten the
  length of the cooldown by 30%". Typhoeus's combos use the same action
  with value 1.0 for their shared cooldown, so "set to x of full" and
  "shorten by x" can't both be its meaning: test D.
- **WILL combo infliction element**: seal_total's Switch is on
  `EntityBB_consumed_type`, which no SkillData or BuffData file writes (set
  natively, probably the element of the infliction that opened the combo
  window); the default branch is Heat. The ultimate instead checks the
  enemy's infliction tags (Nature → Cryo → Electric → Heat), i.e. the
  enemy's current element.
- **Finisher** (row 3): six landings at 7, 10, 13, 32, 34, 36, all
  `atk_scale` (9.0 at basic L12) × BreakingAttackCalculation `multiplier`
  0.1 (×5) and 0.5 (sum 1.0), mask 132; GainBreakingAttackAtb at 36; poise
  units 5/5/5/20/20/10 (DefiniteValueCalculation literals; the two at
  32/34 share one action, to verify). No
  ObtainCostAction, but the loader's file default `atb` = 8 makes the
  timeline add 8 SP per finisher (`skillSpGain`), on top of the enemy's
  finisher SP.
- **Logged bursts credited to Arcane**: Cryo bursts
  (`buff_common_cryst_cryst_triggered`) ~1.0–1.5 s after her WILL touch
  (0eef 2719 → 3729, bdf2 6395 → 7371, e82d 7021 → 8561/8647), a Nature
  burst 1.84 s after (dbae 8501 → 10341), never at the touch itself.
  Either the log credits a burst to the owner of the stack it lands on, or
  the stack lands later than the touch: test A.
- **The misspelt combo entity** (`chr_032_lizhiyan_combo_skill_abilityentity_seal`,
  now fetched) holds only animation, movement, sound and effects.
- Unchanged and confirmed: frames of every hit in the current kit's
  skills; P1 ×1.3 on touch, boom, laser1, laser2 (1.04 / 1.56 / 0.78 / 3.38
  at P4); P1 `rate_pre` +0.06 WILL only and `atb_return_wisd` +10 INT only
  (now applied per mode); P4 cost × 0.85 on both ultimates; combo
  `duration_pre` 0.633 (file default), `duration` 4, `duration_will` 6,
  cooldown 20/19/18; battle skill 100 SP; ult 2 cost 100, cooldown 10 s.

### 1. First-round rows and gaps against the current engine

| First round | Now | How (fields) or what's missing |
|---|---|---|
| 3 Stagger, Finisher (G14) | supported (data: poise, factor) | P2: the finisher is castable on a Staggered enemy only, with the finisher multiplier and SP. Kit: skill `chr_0032_lizhiyan_power_attack`, hits with `factor` 0.1 / 0.5 and `poise` (hand-written: kit-draft compiles neither, gap R8). Spurious `atb` 8 SP: gap R7. Finisher half of Cluster Strike: gap R1 |
| 5 Mode ties and floors | supported (kit fix) | `{not: {attrAtLeast: [41, 42]}}` for WILL everywhere (kit triggers and hits still use `[42, 41]`). The in-game text floors deck attributes; whether the comparison floors is an edge case (± 1 point) |
| 7, 26 compilable inflictions | compiled | kit-draft v2 emits SpellInfliction and the forced Corrosion |
| 8 Battle skill team energy timing | supported (kit fix) | `teamEnergyFrame: 20` (KNOWN: "kit -, data 20") |
| 9, 10 Combo triggers | supported | `inflictionApplied` (INT: `[natural]`, and `[fire, pulse, cryst]` with `minStacks: 2`; WILL: any). Applications that form a reaction don't count in the engine (test E) |
| 12 Durations | supported (kit fix) | `{sum: ["duration_pre", "duration"]}` / `{sum: ["duration_pre", "duration_will"]}` |
| 14 P1 by mode (G2) | supported | C3: kit `activeConditions`; verified: INT P0 `atb_return_wisd` 30, WILL P4 `rate_pre` 0.10 |
| 15, 27 Same-element stack (G1) | supported (approx.) | A1: `{kind: "infliction", element: "enemy"}` with `if` WILL, on the touch and the array hit, before damage. The combo's element is natively the trigger's (`EntityBB_consumed_type`): gap R10 |
| 16 Pulls | n/a | positional |
| 17 Imprisonment slow | gap | the enemy's clock follows a curve during Imprisonment: gap R5 (entity time dilation) |
| 18 Explosion at the natural end | supported | trigger `on: buffEnded imprisonment`, hit at +14 frames, guarded by an early-end marker buff. Time stops and global slow-downs shift it (Ti1); hit-stop doesn't yet (R6) |
| 19 INT battle skill ends Imprisonment (G5, G7) | supported | trigger `on: hit, kinds: [battle], by: self, if: INT ∧ buffActive imprisonment`: `sp`, marker buff, `endBuff`, early explosion at +0, lasers at +43/46/49/52/58, post Susceptibility buff |
| 20 After a natural INT end | supported (lasers unknown) | kit buff `int_after_end` (99 s) from the explosion trigger; trigger on the next battle-skill hit: `sp`, explosion, `endBuff`. Lasers: test C |
| 21 Post-Imprisonment Susceptibility (G6a, b) | supported (INT); not a mechanic (WILL) | INT: buff `post_susceptibility_int` from the early-end trigger, duration 58/30 s (ended by the final laser). WILL: refuted above |
| 22 WILL seal_finisher | not a mechanic | unreachable (needs an early end) |
| 23 Combo cooldown | supported | |
| 24 Talent 1 cooldown INT only (G2) | supported | C3. paramType 4 still undecoded (unknown, R11) |
| 28 Energy block (G6c, G9) | supported | skill `energyBlockSeconds: 1.567` (RefrainObtainUsp 0–47), state buffs with `blocksEnergy`, `clearEnergy` when the array ends with < 2 strikes and when Gloompurge ends |
| 30 Cluster Strike (G8) | supported (Final Strike half) | trigger `on: hit, finalStrike: true, by: controlled`, `if` array ∧ `stack below 2`, `cooldown: 0.4`, `hits` (4 lasers, `damageType: ultimate`), `gain`. Finisher half: gap R1 |
| 31 Cluster Strike energy (G9) | supported | `energy` 0.5 `percentOfMax`, `ignoreEfficiency`, `ignoreBlock`; Gloompurge start: `clearEnergy`, then 1.0 `percentOfMax` `ignoreBlock` |
| 32 Switch to Gloompurge Arcana | supported | actions with `if: {stack: cluster_strikes, atLeast: 2}` in the same trigger (`endBuff` array, `buff` gloompurge_arcana); ult 2 `available: buffActive gloompurge_arcana`, ult 1 `available: not` either state. Its length and whether casting ult 2 ends it: test G |
| 33 Ult 2 hits | supported | reachable now (energy granted past the block) |
| 34 P5 cooldown cut (G10) | gap | `cooldown` action takes seconds only; isPercentage needs a fraction of the full or remaining cooldown: gap R4 |
| 35 Talent 1 WILL Susceptibility (G3) | supported (duration unknown) | V1: `{key: …, skill: "chr_0032_lizhiyan_talent1"}`, `{attr: 42}`, min/sum; duration 10 vs 20 s: test H |
| 36 Talent 1 INT Amp (G3, G6c) | supported (duration unknown) | buff `int_amp` (zone `amp`, arts elements) applied at array start, ended by the state triggers; test B |
| 37 Talent 2 (G4) | supported | A4: `statusTweaks` corrosion `extraSeconds: "duration_add"`, `capScale: {sum: [1, "corrupt_rate"]}`, `skill: chr_0032_lizhiyan_talent2` (forced and reaction Corrosion both) |
| 41 Time stop, dilation, hit-stop (G13) | partly supported | Ti1: UltimateTimeAction (0–47, 0–50) and the combo's global TimeDilation are read from SkillData. Still missing: hit-stop (R6) and entity-layer dilation (combo frames 0–6 `layer 1` on the targets; Imprisonment, R5) |
| 42 `buff_common_natural_triggered` (G15) | gap | L1 left the ×1.42 open: gap R9 |
| W2 Mode gate on equipment (G11) | supported | equipment triggers' `if` is judged for the wearer: `attrAtLeast [41, 42]` / its negation (CompareDeckAttr lhsType 2 = attribute 41, rhsType 3 = 42) |
| W3 INT: own infliction → Arts DMG (G12) | supported (approx.) | `on: inflictionApplied, by: self` → self buff (attrs 51–54, `spell_dmg_up`, `duration`). Missing: the source-skill filter [battle, combo, ultimate] and whether reacting applications count: gap R3 |
| W4 INT: own Susceptibility → ATK (G12) | gap | no event for "the wearer applied a buff of a category": gap R2 |
| W5 WILL: own burst → enemy Arts DMG Taken (G12) | supported (approx.) | `on: burst, by: self` → enemy buff (`damageTaken`, arts elements, `gameBuff` priority-keyed); source-skill filter: R3 |
| W6 WILL: own Susceptibility → enemy Arts DMG Taken (G12) | gap | R2 |
| S2 Eternal Xiranite (G12) | gap | team buff with `recipients: {not: {isOwner: true}}` is expressible; its trigger (Amp, Protection, Susceptibility or Weakness applied by the wearer) is R2 |
| S4 Catastrophe (G12, G7) | supported | `on: cast, kinds: [battle], by: self, maxCount: 1` → `sp` `atb_recover` (`has_gain_atb` resets on abilityEvent 6, taken as the fight start) |
| S6 Hot Work (G12) | supported | `on: reaction, statuses: [combustion]` / `[corrosion]`, `by: self` (forced included) → self buffs (attr 51 / 54, 10 s, refresh) |

### 2. Remaining gaps

**R1. Finisher as a trigger filter**
- family: triggers
- feature: `on: {event: "hit", finisher: true}` (and on `cast`), true for
  landings with decorate-mask bit 4 / skills of skillSpecification 8, like
  `finalStrike`; plus once per cast (the game's `is_power_attacked`, reset
  on abilityEvent 21), e.g. `perCast: true` on the trigger, since a
  finisher's six landings span 29 frames, longer than the 0.4 s debounce.
- evidence: buff_chr_0032_lizhiyan_ultimate_skill_inaura abilityEvent 101,
  CheckDamageDecorateMask checkType 1 mask 4; UltimateSkill desc ("with a
  Finisher or a Final Strike performed by the controlled operator");
  shared with Laevatain's talent 1 (passive_teammate mask 2097156, her
  report row 44 / gap 12).
- impact: Cluster Strikes only from Final Strikes: rotations that stagger
  and finish inside the array lose up to 4 × 0.45 ATK per strike and the
  route to ult 2 (INT 14.4 × ATK, 18.7 at P5).

**R2. Events for buffs of a category applied by an operator**
- family: triggers
- feature: `on: {event: "buffApplied", categories: [...]}` without `buff`:
  any kit buff (operator or equipment) applied by the event's operator
  (`by` applies), whose category is Amp (zone `amp`), Susceptibility
  (`susceptibility`), Weakness (attribute 62) or Protection (63), or the
  BuffData tag of its `gameBuff`; also buffs on the enemy, self or team.
  Today `buffApplied` names one of the owner's own kit buffs, which a
  generic equipment kit can't.
- evidence: buff_wpn_funnel_0016_wisd / _will abilityEvent 206 +
  CheckBuffIdInContextAdvanced (tag 1427729990); buff_equipsuit_usp_02
  abilityEvent 102 + CheckBuffIdInContext with four tags (2029588776,
  −1748167886, −1957150384, −881002460). Logged: `wpn_funnel_0016_wisd_atkup`
  4 frames after her combo Susceptibility (d9e59d0fb737),
  `wpn_funnel_0016_will_dmg` on her WILL touch (dbaee23b801d),
  `equipsuit_usp_02_AddAttack` 0.16 on Arcane from Liino's set
  (d9e59d0fb737). Shared: every wearer of Eternal Xiranite (Liino, Arcane
  in batch 1).
- impact: Solemn Phalanx INT ATK +`atk_up2` (0.32 at weapon skill level 4,
  0.36 at 5; first round: up to 0.56 at 9) and WILL enemy Arts DMG Taken
  +`spell_dmg_taken_up2` (0.096 at 4, 0.108 at 5) for the team; Eternal Xiranite +16% DMG for three
  teammates for 15 s after each Susceptibility or Amp: today all off.

**R3. Which skill caused a status event; reacting inflictions**
- family: triggers
- feature: status events (inflictions, bursts, reactions) and buff
  applications carry the source skill kind, and trigger filters take
  `fromKinds: ["battle", "combo", "ultimate"]` (CheckOriginSkillType
  [2, 6, 7]; 2 battle as in Catastrophe's CheckSkillType [2], 7 ultimate
  as in Link). Also decide whether "applies Arts Infliction" (abilityEvent
  126) includes an application that formed a reaction, which
  `inflictionApplied` excludes.
- evidence: buff_wpn_funnel_0016_wisd abilityEvent 126 and _will 127, 206,
  each with CheckOriginSkillType skillTypeList [2, 6, 7].
- impact: none for Arcane (her basic attacks don't inflict); a generic
  weapon on an operator whose basic attacks inflict or burst would trigger
  when the game doesn't. Reacting applications: W3's 20 s buff may not be
  refreshed when the engine says it is (or the reverse).

**R4. Cooldown change by a fraction**
- family: triggers (cooldown change)
- feature: the `cooldown` action with `fraction` (ValueExpr) instead of
  `seconds`: SetSkillCdAtOnce isPercentage. Its meaning (shorten the
  remaining time by x of it, by x of the full cooldown, or set it to x of
  the full) needs test D; Typhoeus's value 1.0 (read as a shared cooldown)
  must fit the same rule.
- evidence: chr_0032_lizhiyan_ultimate_skill2 frame 0 (`cd_minus` 0.3 at
  P5, WILL only); P5 text. Also chr_0034_typhoea_combo_skill(floating),
  and in batch 2 buff_chr_0006_wolfgd_talent_1 (`ratio`),
  buff_chr_0018_dapan_talent_1_cd_reduce, chr_0005_chen_combo_skill
  (`cd_reduction`).
- impact: WILL P5: one earlier combo per ult 2 (−5.4 s of 18 if of the
  full cooldown); more for batch 2.

**R5. Entity time dilation with a curve (Imprisonment)**
- family: timing (Ti1, entity layer)
- feature: an enemy-side slow-down applied by a hit or buff, with a curve
  over its duration (SealAction directCurve 0.3 → 0.2 → 1.0), slowing the
  enemy's own clock as `control.freezes` does at scale 0; plus which
  timers follow the enemy's clock (its statuses, inflictions, debuffs from
  every operator) and which don't (the seal itself: `useTimeDilationDt`
  false).
- evidence: buff_chr_0032_lizhiyan_combo_skill_seal buffEvent 5
  SealAction; the tutorial text "An enemy under Imprisonment will
  experience a slower flow of time"; design.md "Time" ("Not modelled yet:
  entity-layer dilation").
- impact: unknown until test I: if enemy-held timers follow its clock, a
  6.6 s WILL Imprisonment adds ~2.5 s to every status and debuff on the
  enemy (Corrosion ramp and duration, Electrification, teammates'
  Susceptibilities) once per combo; if not, nothing.

**R6. Hit-stop**
- family: timing (Ti1)
- feature: HitStopAction pauses its attacker (and, with affectType 2, the
  target) for its duration: Arcane's touch 0.2 s, explosion 0.3 s, lasers
  0.55 s, battle skill 0.4 s, ult 2 0.4 s, most basic attacks.
- evidence: HitStopAction in seal_total, abilityentity_end,
  seal_finisher_wisd, normal_skill_abilityrange2, ultimate_skill2;
  bdf223db8e49 explosion +0.5 s; design.md "Time".
- impact: her own actions 0.2–0.5 s later per skill than modelled; small
  shifts of the explosion and the lasers. Shared with every operator.

**R7. SP from a skill's `atb` default without an action reading it**
- family: values (data compilation)
- feature: a skill's SP (`skillSpGain`) only from an ObtainCostAction
  costType 1 that the skill reaches (D1 compiles these), not from a
  blackboard `atb` that no action uses.
- evidence: chr_0032_lizhiyan_power_attack: no ObtainCostAction, file
  default `atb` 8 (data.skills defaults), SkillPatch without `atb`; the
  finisher's SP is GainBreakingAttackAtb (the enemy's
  `breakingAttackedAtbObtain`). Liino's, Da Pan's, Tangtang's and
  Purrchena's power_attack files also list an `atb` key (values to check).
- impact: +8 SP per Arcane finisher (if the key isn't read natively:
  test J).

**R8. Poise and finisher multipliers in kit-draft** (status `data`)
- family: data compilation (D1)
- feature: the compiler skips damage units of damageAttributeType 1
  (poise) and takes `atk_scale` without BreakingAttackCalculation's
  `multiplier`; emit `poise` and `factor` for them.
- evidence: skillCompile.ts `damage()` ("1 = poise (stagger) damage",
  `continue`); power_attack draft: 6 × `atk_scale`, no factor; poise keys
  `poise_touch`, `poise_boom`, `poise_early_finish`, `poise_final`,
  `poise` (battle skill 10, ultimates), literal 20 (Cluster lasers), 5/20/10
  (finisher).
- impact: none once the kit hand-writes them (the batch-1 kits carry no
  poise yet, so stagger is under-counted for everyone until then).

**R9. `buff_common_<element>_triggered`**
- family: log tooling
- feature: explain the one-element reaction key (×1.42–1.43 of a level I
  reaction in 0eef2474a26f 3620 ms and bdf223db8e49 8152 ms, both P5
  Arcane's Nature onto Cryo) and map it (reactions.ts
  `parseReactionEvent`).
- evidence: as G15; reactions.ts comment; both are P5 (talent 2 at its P3
  values), which may or may not matter.
- impact: one unverifiable hit per such reaction (18.9k and 28.3k, a third
  of her logged damage in 0eef2474a26f).

**R10. WILL combo: the trigger's element or the enemy's** (status
`unknown`)
- family: arts state
- feature: if `EntityBB_consumed_type` is the element of the infliction
  that opened the combo window, the touch needs "the event's element"
  (e.g. `element: "trigger"`, stored with the window like its count), not
  `element: "enemy"`.
- evidence: seal_total frames 6–9 SwitchAction on `EntityBB_consumed_type`
  (written by no data file; default branch Heat); ultimate_skill frame 47
  checks the enemy's tags instead.
- impact: only when the enemy's infliction changes between the trigger
  and the touch (up to 6 s): a burst more or less per such combo (160% ×
  her ATK at the level coefficient).

Unknowns that need only tests (no engine work whatever the answer): the
paramType 4 half of talent 1 (R11; a second −6 on the combo, purpose
unknown), Gloompurge's length and end (G), talent 1 Susceptibility
duration (H), INT Amp duration (B), lasers after a natural INT end (C),
combo trigger on a reacting application (E), burst attribution (A).

### 3. Kit plan

Operator kit `chr_0032_lizhiyan` (frames from the skill's start unless
"+n" = after the trigger's event; INT = `{attrAtLeast: [41, 42]}`, WILL =
`{not: INT}`; data = SkillData / BuffData files named; values at the
build's levels):

**Skills**

- attack1–attack4, plunging_attack_end: as now (verified frames; kit-draft
  agrees). Add `poise` once known (R8).
- attack5: hit at 22, `finalStrike` from data, `sp: {if: {controlled:
  true}, then: "atb"}` (17 at L12; kit-draft "SP atb only if controlled").
- power_attack (new; finisher): `damageType: basic`, events
  `[chr_0032_lizhiyan_power_attack]`; hit `a` count 5 frames [7, 10, 13,
  32, 34] `factor: 0.1`, hit `b` frame [36] `factor: 0.5` (scale
  `atk_scale`, BreakingAttackCalculation multipliers); poise 5/5/5/20/20/10;
  `sp: 0` on `b` if test J shows the 8 SP isn't real (R7).
- normal_skill: two hits (`atk_scale_will` if WILL, `atk_scale_wisd` if
  INT) at 20, `applies: [{infliction, natural}]`, `detached: true`, events
  `[chr_0032_lizhiyan_normal_skill_abilityrange2]`, `poise: "poise"`;
  skill `teamEnergyFrame: 20`.
- combo_skill: one hit `touch` at 15, `atk_scale_touch`, `detached`,
  `energy: "usp"`, `poise: "poise_touch"`, events
  `[buff_chr_0032_lizhiyan_combo_skill_seal_total]`, `applies: [{kind:
  "infliction", element: "enemy", if: WILL}]` (seal_total frame 6, before
  the damage; R10). No explosion or laser hits on the skill (they move to
  triggers). Imprisonment and its Susceptibility by a delayed cast trigger
  at 11 (seal_total frame 2), so teammates' hits from frame 11 see it.
- ultimate_skill: `energyBlockSeconds: 1.567` (RefrainObtainUsp 0–47),
  `available: {not: {any: [{buffActive: gloompurger_array}, {buffActive:
  gloompurge_arcana}]}}`; one hit at 47 `atk_scale`, events
  `[chr_0032_lizhiyan_ultimate_skill]`, `poise: "poise"`, `applies:
  [{infliction, element: enemy, if: WILL}, {forcedReaction, corrosion,
  level: 1, durationKey: "duration2", if: INT}]`, `buffs:
  [{buff: t1_susceptibility, beforeDamage: true, if: WILL},
  {buff: gloompurger_array}]`.
- ultimate_skill2: `available: {buffActive: gloompurge_arcana}`; hits at
  58: `atk_scale_will` if WILL with `buffs: [{t1_susceptibility,
  beforeDamage}]`, `atk_scale` if INT with `buffs: [{int_amp,
  beforeDamage}]`.

**Buffs** (`gameBuff` = the BuffData buff)

- `imprisonment`: enemy, no modifiers, duration `{if: INT, then: {sum:
  [duration_pre, duration]}, else: {sum: [duration_pre, duration_will]}}`
  (4.633 / 6.633 s), gameBuff `buff_chr_0032_lizhiyan_combo_skill_seal`.
  (Its slow-down: R5.)
- `doubles_susceptibility`: enemy, susceptibility natural + cryst, value
  `{sum: ["rate_pre", {if: WILL, then: {min: [{product:
  ["spell_vul_per_will", {attr: 42}]}, "max_spell_vul_will"]}, else: 0}]}`,
  same duration as Imprisonment, gameBuff `…_spell_vulnerable_pre`.
- `post_susceptibility_int`: enemy, susceptibility natural + cryst
  `rate_pre`, duration 1.933 (58 frames, to the final laser), gameBuff
  `…_combo_skill_spell_vulnerable`.
- `early_end_marker`: self, no modifiers, 0.1 s (the game's timed
  markers): tells the natural-end trigger to stay quiet.
- `int_after_end`: enemy, no modifiers, 99 s, gameBuff
  `…_seal_bunshin_end_listener`.
- `gloompurger_array`: self, no modifiers, duration `duration` (20),
  `blocksEnergy`, gameBuff `…_ultimate_skill_listener_owner`.
- `gloompurge_arcana`: self, no modifiers, 10 s (ChangeSkillAction; test
  G), `blocksEnergy`, gameBuff `…_ultimate_skill_listener`.
- `int_amp`: self, zone `amp`, elements fire/pulse/cryst/natural, value
  `{key: enhance_rate, skill: chr_0032_lizhiyan_talent1}`, no duration
  (ended by triggers), gameBuff `buff_chr_0032_lizhiyan_talent1_enhance`.
- `t1_susceptibility`: enemy, susceptibility natural + cryst, value
  `{sum: [{min: [{product: [{key: spell_vul_rate_per_will, skill: T1},
  {attr: 42}]}, {key: spell_vul_rate, skill: T1}]}, {key:
  spell_vul_rate_potential, skill: T1}]}` (T1 =
  chr_0032_lizhiyan_talent1), duration `{key: duration, skill: T1}` (10 s;
  20 if test H says the ultimate's), gameBuff `…_talent1_vulnerable`.

**Stacks:** `cluster_strikes` (max 2; the game's
`…_ultimate_skill_layer`).

**statusTweaks:** `[{status: corrosion, skill: chr_0032_lizhiyan_talent2,
extraSeconds: "duration_add", capScale: {sum: [1, "corrupt_rate"]}}]`.

**Triggers** (`skill` = the skill plain keys name)

1. Combo windows: as now, with WILL = `{not: INT}` (INT: Nature, or ≥ 2
   stacks of fire/pulse/cryst; WILL: any; `by: anyone`).
2. `imprison` — `on: cast, skills: [chr_0032_lizhiyan_combo_skill]`,
   `delay: 11`, skill combo: `buff imprisonment`, `buff
   doubles_susceptibility`.
3. `int_early_end` — `on: hit, kinds: [battle]`, `by: self`, `if: {all:
   [INT, {buffActive: imprisonment}]}`, skill combo (data: seal2
   abilityEvent 101 → seal_listener 204 → seal_again → seal_finisher_wisd):
   `sp "atb_return_wisd"`; `buff early_end_marker`; `endBuff imprisonment`;
   `endBuff doubles_susceptibility`; `buff post_susceptibility_int`;
   `hits`: early explosion +0 `atk_scale_boom` (`poise_early_finish` =
   seal_total's `poise_boom`), events `[buff_…_combo_skill_seal2]`;
   lasers +43/46/49/52 `atk_scale_laser1`; final laser +58
   `atk_scale_laser2` (`poise_final`); events
   `[buff_…_combo_skill_seal_finisher_wisd]`; all `damageType: combo`
   (mask 12288).
4. `explosion` — `on: buffEnded imprisonment`, `if: {not: {buffActive:
   early_end_marker}}`, skill combo: `hits` +14 `atk_scale_boom`
   (`poise_boom`), events `[chr_0032_lizhiyan_combo_skill_abilityentity_end]`,
   `damageType: combo`; `buff int_after_end` if INT (abilityentity_end
   frame 10).
5. `int_late_hit` — `on: hit, kinds: [battle]`, `by: self`, `if: {all:
   [INT, {buffActive: int_after_end}, {not: {buffActive: imprisonment}}]}`:
   `sp "atb_return_wisd"`, `endBuff int_after_end`, `hits` +0
   `atk_scale_boom`, events `[buff_…_combo_skill_seal_bunshin_end_listener]`
   (lasers only if test C shows them).
6. `array_start` — `on: buffApplied gloompurger_array`: `gain
   cluster_strikes −2` (reset), `buff int_amp` if INT.
7. `cluster_strike` — `on: {event: hit, finalStrike: true}`, `by:
   controlled`, `if: {all: [{buffActive: gloompurger_array}, {stack:
   cluster_strikes, below: 2}]}`, `cooldown: 0.4`, skill ultimate_skill:
   `gain cluster_strikes`; `energy 0.5 percentOfMax ignoreEfficiency
   ignoreBlock` (`usp_step`); `hits` 4 × `atk_scale_laser` at +15/19/23/27,
   `damageType: ultimate`, poise 20, events
   `[chr_0032_lizhiyan_ultimate_skill_laser]`; then, each with `if:
   {stack: cluster_strikes, atLeast: 2}`: `endBuff gloompurger_array`,
   `clearEnergy`, `buff gloompurge_arcana`, `energy 1 percentOfMax
   ignoreBlock` (listener start).
8. `cluster_strike_finisher` — as 7 with `on: {event: hit, finisher:
   true}` and lasers at +12/16/20/24, once per finisher: needs R1.
9. `array_end` — `on: buffEnded gloompurger_array`, `if: {stack:
   cluster_strikes, below: 2}`: `clearEnergy`, `endBuff int_amp`.
10. `gloompurge_end` — `on: buffEnded gloompurge_arcana`: `clearEnergy`,
    `endBuff int_amp`, `gain cluster_strikes −2`. If test G shows that
    casting ult 2 ends the state: also `on: cast, skills: [ult2]` →
    `endBuff gloompurge_arcana` (delay as the test shows).
11. `p5_cooldown` — `on: cast, skills: [chr_0032_lizhiyan_ultimate_skill2]`,
    `if: {all: [WILL, {potentialAtLeast: 5}]}`: `cooldown` self combo by
    `cd_minus` as a fraction (R4; until then left out).

Fix in `sources`: drop the `when` / ValueSpec wording and the not-modelled
list; note inaura_attack and the WILL seal_finisher as unreachable. Update
the D1 `KNOWN` entries for the explosion and laser frames (they become
trigger hits; the compiled listener frames stay lower bounds) and for the
ultimate's conditional inflictions.

Equipment kits (generic: `by: self` = the wearer; values from the named
skill at the build's levels):

- `wpn_funnel_0016` (skill `sk_wpn_funnel_0016`): buffs `int_arts` (self,
  attrs 51–54 `spell_dmg_up`, `duration` 20, gameBuff
  `buff_wpn_funnel_0016_wisd_natureup`), `int_atk` (self, attr 2
  `atk_up2`, `duration2` 20, `…_wisd_atkup`), `will_burst` (enemy,
  `damageTaken` arts elements `spell_dmg_taken_up`, `duration3` 25,
  `…_will_atk`, priority-keyed), `will_susc` (enemy, `spell_dmg_taken_up2`,
  `duration4` 25, `…_will_dmg`, priority-keyed). Triggers: `inflictionApplied`
  by self if INT → `int_arts`; `burst` by self if WILL → `will_burst`
  (both with R3's `fromKinds` once it exists); `buffApplied` category
  susceptibility by self → `int_atk` if INT / `will_susc` if WILL (R2).
  The always-on stats stay in the panel.
- `suit_usp02` Eternal Xiranite (skill `passive_equipsuit_usp_02`): buff
  `team_dmg` (team, `recipients: {not: {isOwner: true}}`, `damageBonus`
  `dmg_up` 0.16, `duration` 15, gameBuff `buff_equipsuit_usp_02_AddAttack`);
  trigger `buffApplied` categories amp / protection / susceptibility /
  weakness by self → `team_dmg` (R2).
- `suit_usp01` Catastrophe (`passive_equipsuit_usp_01`): trigger `cast`
  kinds [battle] by self, `maxCount: 1` → `sp "atb_recover"` (50).
- `suit_fire_natr01` Hot Work (`passive_equipsuit_fninflict_01`): buffs
  `heat` (self, attr 51 `fire_dmg_up`, `duration` 10) and `nature` (self,
  attr 54 `nature_dmg_up`, `duration2` 10), refresh; triggers `reaction`
  statuses [combustion] / [corrosion] by self → `heat` / `nature`.

Fixtures that check it: b7b3762d5da8, bdf223db8e49, 0eef2474a26f,
dbaee23b801d (WILL: touch with Susceptibility, `element: enemy`, talent 1
Susceptibility from the kit, weapon W5/W6 and Eternal Xiranite from their
kits instead of logged boundary buffs), d9e59d0fb737 (INT: early end,
lasers at H+43…58 vs logged H+41.4…56.9, talent 2 Corrosion, Hot Work,
weapon W3/W4, INT Amp), pending e82d45c46040. `efsim zmdlogs reactions` on
the WILL logs tests the bursts credited to her (test A). No log has a
Cluster Strike, ult 2, a finisher or a late INT explosion.

### 4. In-game tests for the remaining unknowns

The first round's A–F still apply, extended as below; 7 and 13 too.

- **A (extended). WILL same-element stack and its element.** Will >
  Intellect. (1) A teammate applies Cryo; Arcane's combo at once: is a
  Cryo burst shown at the touch, and whose damage number is it (hers or
  later on a teammate's hit)? (2) A teammate applies Cryo (opening the
  window), then a Heat hit consumes it (Solidification), then Arcane's
  combo: does the touch apply Cryo (the trigger's element), nothing, or
  Heat? Settles R10 and the burst attribution.
- **D (extended). P5 cooldown cut.** P5, Will > Intellect: note the combo's
  remaining cooldown, cast ult 2, read it again. Compare with 30% of 18 s
  (5.4 s off), 30% of the remaining time, or "set to 30%". Repeat with
  Intellect ≥ Will (data: no cut). Settles R4 for Arcane; Typhoeus's two
  combos (does casting one put the other on full cooldown?) check the
  same rule.
- **G. Gloompurge Arcana window.** After the second Cluster Strike, how
  long does the ult 2 button stay (10 s expected)? Cast ult 2 early: does
  her energy bar start refilling right after, or only when the 10 s are
  over?
- **H. Talent 1 Susceptibility duration.** Will > Intellect, ultimate on a
  dummy: time the Nature Susceptibility icon from the ultimate (10 s or
  20 s, plus the 1.6 s time stop).
- **I. Imprisonment and the enemy's timers.** A teammate applies a timed
  debuff or status to a dummy (e.g. Electrification, or Arcane's own
  Corrosion), then Arcane's WILL combo (6.6 s Imprisonment): does the
  status run out later than without the combo, by about 2–3 s?
- **J. Finisher SP.** Arcane's finisher on a staggered enemy: how much SP
  does it return (the enemy's finisher SP alone, or 8 more)?
- **K. Cluster Strike from a Finisher.** Inside the array, stagger the
  enemy and finish it with the controlled operator: do the four lasers
  come, and does a finisher plus a Final Strike within 0.4 s count once?

## Re-analysis (pass 3, 2026-10-18)

Against the engine at 59b80bd (batch-1.md "Pass 2 progress"): events.ts,
model.ts, expr.ts, timeline.ts, the loader (packages/data/src/kits.ts) and
both schemas. The plan below was written out as a full operator kit and four
equipment kits in a scratch directory and loaded with a copy of the loader
pointed there: it loads. Run on examples/arcane-will-solo and an INT variant
(the d9e59d0fb737 build), it gives the expected effects on the expected hits
(WILL solo total 54.0k → 102.1k: weapon debuffs, talent-1 Susceptibility,
WILL bursts, two Cluster Strikes).

### Facts re-checked (corrections to pass 2)

- **Talent-1 Susceptibility lasts the talent's 10 s, not the ultimate's
  20 s.** ultimate_skill and ultimate_skill2 read it with
  GetTargetBuffBBAdvanced `{blackboardKey: duration_vul, desiredKey:
  duration, buffIdList: [buff_chr_0032_lizhiyan_talent1]}`, then
  CreateBuffAction assigns `duration ← duration_vul`. desiredKey is the
  key on the buff: in Si's ultimate_skill_abilityrange the same action reads
  `coolDown` (the only key of her talent2 buffs) into `talent_combo_reduce`.
  The attached talent skill has `duration` 10 at both levels. Test 30 is
  now only a confirmation.
- **Both talent-1 buffs exist only when their value is above 0**
  (CompareFloat compare 2 before the CreateBuff): talent1_vulnerable if
  `spell_vul_rate + spell_vul_rate_potential > 0`, talent1_enhance (in
  listener_owner) if `enhance_rate > 0`. Talent 1 level 1 has 0 for both
  (data: `enhance_rate` 0, `spell_vul_rate` 0); P5 adds 0.16 / 0.07. A
  0-value buff would still fire category triggers (Eternal Xiranite, the
  weapon), so the kit guards them.
- **Order at ultimate frame 47** (serverActionIndex): listener_owner 45,
  forced Corrosion 51, same-element inflictions 55–64, talent1_vulnerable
  79/81, DamageAction 82. So the array state (and INT Amp, its child) and
  the WILL Susceptibility are in place before the ultimate's own hit.
  dbaee23b801d's ultimate hit (2485 ms) matches only with
  `buff_wpn_funnel_0016_will_dmg` and the Susceptibility applied
  (`efsim zmdlogs check`: "boundary buffs applied:
  buff_wpn_funnel_0016_will_dmg, buff_common_affixes_vulnerable_natural"),
  so the weapon reacts to a buff in the same frame before the damage.
- `poise_early_finish` and `poise_final` aren't keys of
  chr_0032_lizhiyan_combo_skill (they're in the seal2 / seal_finisher_wisd
  BuffData blackboards; seal_finisher_wisd's default `poise_final` is 10).
- The weapon's abilityEvent 206 handlers (wisd_atkup, will_dmg) check
  CheckOriginSkillType [2, 6, 7], like 126 and 127; Eternal Xiranite's 102
  handler doesn't.
- The combo can't be cut before frame 16 (exclusive 23, first window 16),
  nor the ultimates before 48 / 63 (cantCastSkill channels).

### (a) Pass-2 gaps now

| Pass 2 | Now | Fields |
|---|---|---|
| R1 Finisher filter, once per cast | supported | `on: {event: "hit", decorations: ["finisher"]}` (true for landings of a skillSpecification 8 skill; triggered hits never), `maxPerCast: 1` (counted per cast index of the hit). `decorations: ["finalStrike"]` ≡ `finalStrike: true` |
| R2 Buff-category events | supported | `on: {event: "buffApplied", categories: [...]}`, `by: "self"` = the wearer; categories from the kit buff's modifiers: zone `amp` / `susceptibility`, attr 62 / 63. Two leftovers: R12, R13 below |
| R3 Source skill kind; reacting inflictions | supported (status events) / still open (reacting) | `fromKinds: ["battle", "combo", "ultimate"]` on `inflictionApplied` and `burst`. Reacting applications: open list "Arcane R3", interim: not counted (`inflictionApplied` excludes them), test 35. Buff applications have no source kind: R13 |
| R4 Cooldown by a fraction | supported (assumed meaning) | cooldown action `fraction` (of the skill's full cooldown, added; negative cuts it). Open list "V7", interim: of the full cooldown, test 36 |
| R5 Imprisonment slows the enemy's clock | still open | open list "Ti1b": entity-layer slow-downs not modelled; tests 18, 37 |
| R6 Hit-stop | still open | open list "Ti1b": not modelled; tests 18, 37 |
| R7 Finisher's unread `atb` 8 | still open (D2), kit-writable | open list "D2": kits hand-write it. Any hit with `sp` stops the skill's default `atb` (timeline: `skill.hits.some(h => h.sp !== undefined)`), so `sp: 0` on a finisher hit removes the 8 SP; the enemy's finisher SP stays. Test 31 |
| R8 Poise and finisher factors in kit-draft | still open (D2), kit-writable | kits hand-write `poise` and `factor` |
| R9 `buff_common_<element>_triggered` ×1.42 | still open | open list "L2": such hits stay unchecked |
| R10 WILL combo element: the trigger's or the enemy's | still open | open list "A6": interim the enemy's current (`element: "enemy"`), test 33 |
| R11 talent-1 paramType 4 half | unknown | still loaded as `{kind: "other", modifyType: 2}`; no test written for it yet |

### (b) Kit plan: what changes

Everything not listed stays as in pass 2's plan. INT = `{"attrAtLeast": [41,
42]}`, WILL = `{"not": INT}`, and

```json
"T1_ON": {"all": [{"talentAtLeast": [0, 1]}, {"any": [{"talentAtLeast": [0, 2]}, {"potentialAtLeast": 5}]}]}
```

(talent-1 value above 0; written inline, the kit format has no macros).

**Values from talents.** Use `{talent: 0, key}` (V8: 0 while unlearned,
potentials applied) instead of `{key, skill: "chr_0032_lizhiyan_talent1"}`
(both load):

```json
{"id": "t1_susceptibility", "label": "Talent 1 Susceptibility (WILL)", "target": "enemy",
 "duration": {"talent": 0, "key": "duration"}, "gameBuff": "buff_chr_0032_lizhiyan_talent1_vulnerable",
 "modifiers": [{"zone": "susceptibility", "elements": ["natural", "cryst"], "value": {"sum": [
   {"min": [{"product": [{"talent": 0, "key": "spell_vul_rate_per_will"}, {"attr": 42}]}, {"talent": 0, "key": "spell_vul_rate"}]},
   {"talent": 0, "key": "spell_vul_rate_potential"}]}}]}
{"id": "int_amp", "label": "Talent 1 Arts Amp (INT)", "target": "self", "gameBuff": "buff_chr_0032_lizhiyan_talent1_enhance",
 "modifiers": [{"zone": "amp", "value": {"talent": 0, "key": "enhance_rate"}, "elements": ["fire", "pulse", "cryst", "natural"]}]}
```

**Skills.**

- power_attack: `poise` is one value per hit entry, so the pass-2 entry `a`
  (count 5, poise 5/5/5/20/20) can't be written; split by poise, `sp: 0`
  on the last entry (R7, until test 31):

  ```json
  "hits": [
   {"id": "a", "scale": ["atk_scale"], "factor": 0.1, "count": 3, "frames": [7, 10, 13], "poise": 5, "events": ["chr_0032_lizhiyan_power_attack"]},
   {"id": "b", "scale": ["atk_scale"], "factor": 0.1, "count": 2, "frames": [32, 34], "poise": 20, "events": ["chr_0032_lizhiyan_power_attack"]},
   {"id": "c", "scale": ["atk_scale"], "factor": 0.5, "frames": [36], "poise": 10, "sp": 0, "events": ["chr_0032_lizhiyan_power_attack"]}]
  ```
- combo_skill: one `touch` hit whose WILL infliction has its own `if`
  (`"applies": [{"kind": "infliction", "element": "enemy", "if": WILL}]`).
- ultimate_skill: the hit keeps `applies` (WILL same-element infliction,
  INT forced Corrosion) but loses `buffs`. The array and the WILL
  Susceptibility go in a delayed cast trigger at 47: pending actions run
  before hits of the same frame (timeline.ts `advance`), so `array_start`
  (INT Amp) and the equipment's category triggers act on this hit, as in
  the data (R12). With the pass-2 hit `buffs` (`beforeDamage` or not) they
  run after the damage:

  ```json
  {"id": "ult_frame_47", "on": {"event": "cast", "skills": ["chr_0032_lizhiyan_ultimate_skill"]}, "by": "self", "delay": 47,
   "skill": "chr_0032_lizhiyan_ultimate_skill",
   "do": [{"kind": "buff", "buff": "gloompurger_array"},
          {"kind": "buff", "buff": "t1_susceptibility", "if": {"all": [WILL, T1_ON]}}]}
  ```
  `skill` is required: the trigger's buffs read their plain keys from it
  (`gloompurger_array`'s `duration`). Without it the loader refuses
  ("chr_0032_lizhiyan.ult_frame_47 isn't one of chr_0032_lizhiyan's value
  sources").
- ultimate_skill2: no hit `buffs`. WILL Susceptibility the same way
  (`"id": "t1_susceptibility_ult2"`, `skills: [ultimate_skill2]`, `delay:
  58`, `if: {all: [WILL, T1_ON]}`). INT Amp is already on through
  Gloompurge Arcana. Only if test 32 shows that casting ult 2 ends that
  state: add an `endsWithCast: true` copy of `int_amp` (ult 2 frame 0,
  autoFinishByAction), applied on the cast with `if: {not: {buffActive:
  int_amp}}`. Kit buffs that stand for the same non-type-1 game buff add up.

**Triggers.**

- `imprison`: add `"detached": true` (seal_total exists from combo frame 9;
  nothing can cut the combo before 16 anyway).
- `int_early_end`: `on: {event: "hit", skills:
  ["chr_0032_lizhiyan_normal_skill"]}` (more exact than `kinds`). Poise:
  `"poise_boom"` on the early explosion and the literal `10` on the final
  laser. The pass-2 keys `poise_early_finish` / `poise_final` are refused
  ("chr_0032_lizhiyan_combo_skill has no value poise_final"). The early-end
  marker stays: `eventRemaining` is a value, and there's no predicate on
  values.
- `array_start`: `{"kind": "buff", "buff": "int_amp", "if": {"all": [INT,
  T1_ON]}}`.
- `cluster_strike` (Final Strike) as pass 2. Its 0.4 s debounce is
  `cooldown: 0.4` and doesn't apply to the finisher path.
- `cluster_strike_finisher` (was blocked on R1):

  ```json
  {"id": "cluster_strike_finisher", "on": {"event": "hit", "decorations": ["finisher"]}, "by": "controlled", "maxPerCast": 1,
   "if": {"all": [{"buffActive": "gloompurger_array"}, {"stack": "cluster_strikes", "below": 2}]},
   "skill": "chr_0032_lizhiyan_ultimate_skill",
   "do": [{"kind": "gain", "gains": [{"stack": "cluster_strikes"}]},
          {"kind": "energy", "value": 0.5, "percentOfMax": true, "ignoreEfficiency": true, "ignoreBlock": true},
          {"kind": "hits", "hits": [{"id": "laser", "scale": ["atk_scale_laser"], "count": 4, "frames": [12, 16, 20, 24], "damageType": "ultimate", "poise": 20, "events": ["chr_0032_lizhiyan_ultimate_skill_laser"]}]},
          {"kind": "endBuff", "buff": "gloompurger_array", "if": {"stack": "cluster_strikes", "atLeast": 2}},
          {"kind": "clearEnergy", "if": {"stack": "cluster_strikes", "atLeast": 2}},
          {"kind": "buff", "buff": "gloompurge_arcana", "if": {"stack": "cluster_strikes", "atLeast": 2}},
          {"kind": "energy", "value": 1, "percentOfMax": true, "ignoreBlock": true, "if": {"stack": "cluster_strikes", "atLeast": 2}}]}
  ```
- `p5_cooldown` (was blocked on R4). `cd_minus` is 0 below P5, so no
  potential check is needed; `skills` is one kind, not a list:

  ```json
  {"id": "p5_cooldown", "on": {"event": "cast", "skills": ["chr_0032_lizhiyan_ultimate_skill2"]}, "by": "self", "if": WILL,
   "skill": "chr_0032_lizhiyan_ultimate_skill2",
   "do": [{"kind": "cooldown", "who": "self", "skills": "combo", "fraction": {"product": [-1, "cd_minus"]}}]}
  ```

**Equipment kits.** Pass 2's IDs are refused: equipment stack, buff and
trigger IDs must start with `<equipment ID>.` (`wpn_funnel_0016.int_arts`,
`suit_usp02.team_dmg`, …; references use the full ID). Every trigger that
applies a buff with plain keys needs `skill` (the weapon skill or set skill),
or the loader refuses the trigger's own name as a value source. Zones:
weapon INT ATK `atk` (`atk_up2`), INT Arts DMG `damageBonus` on the four
Arts elements, WILL debuffs `damageTaken` on the four Arts elements
(priority-keyed game buffs: `stackGroup` from `gameBuff`), Xiranite
`damageBonus`, Hot Work `damageBonus` `[fire]` / `[natural]` (game buffs
`buff_equipsuit_fninflict_01_firedamageadd` / `_poisedamageadd`).

```json
"triggers": [
 {"id": "wpn_funnel_0016.int_infliction", "on": {"event": "inflictionApplied", "fromKinds": ["battle", "combo", "ultimate"]}, "by": "self", "if": INT,
  "beforeDamage": true, "skill": "sk_wpn_funnel_0016", "do": [{"kind": "buff", "buff": "wpn_funnel_0016.int_arts"}]},
 {"id": "wpn_funnel_0016.int_susceptibility", "on": {"event": "buffApplied", "categories": ["susceptibility"]}, "by": "self", "if": INT,
  "skill": "sk_wpn_funnel_0016", "do": [{"kind": "buff", "buff": "wpn_funnel_0016.int_atk"}]},
 {"id": "wpn_funnel_0016.will_burst", "on": {"event": "burst", "fromKinds": ["battle", "combo", "ultimate"]}, "by": "self", "if": WILL,
  "skill": "sk_wpn_funnel_0016", "do": [{"kind": "buff", "buff": "wpn_funnel_0016.will_burst"}]},
 {"id": "wpn_funnel_0016.will_susceptibility", "on": {"event": "buffApplied", "categories": ["susceptibility"]}, "by": "self", "if": WILL,
  "skill": "sk_wpn_funnel_0016", "do": [{"kind": "buff", "buff": "wpn_funnel_0016.will_susc"}]}]
```

- `suit_usp02`: `{"id": "suit_usp02.on_category", "on": {"event":
  "buffApplied", "categories": ["amp", "protection", "susceptibility",
  "weakness"]}, "by": "self", "skill": "passive_equipsuit_usp_02", "do":
  [{"kind": "buff", "buff": "suit_usp02.team_dmg"}]}`, with buff `target:
  "team"` and `recipients: {"not": {"isOwner": true}}`.
- `suit_usp01`: `{"id": "suit_usp01.sp", "on": {"event": "cast", "kinds":
  ["battle"]}, "by": "self", "maxCount": 1, "skill":
  "passive_equipsuit_usp_01", "do": [{"kind": "sp", "value":
  "atb_recover"}]}`.
- `suit_fire_natr01`: the two `reaction` triggers (`statuses:
  ["combustion"]` / `["corrosion"]`, `by: "self"`) with `"beforeDamage":
  true` and `"skill": "passive_equipsuit_fninflict_01"`.
- `beforeDamage` follows the data order: W3's battle-skill SpellInfliction
  and the INT ultimate's forced Corrosion come before their DamageAction.
  d9e59d0fb737 has both buffs only as boundary buffs on those hits and
  matches nothing, so the logs can't decide. W5 (`will_burst`) is left
  after the damage: the WILL logs show no `will_atk` on the touch, and
  bursts credited to her come 1–1.5 s later (test 33). Expect the kit check
  of b7b3762d5da8 (ult hit at 7150 ms without `will_atk`) to depend on
  that.

### (c) New gaps

**R12. Category triggers on a buff a hit applies before its damage**
- family: triggers
- feature: a hit's `buffs` with `beforeDamage: true` add their
  `buffApplied` events to the after-damage run (timeline.ts `landHit`:
  `events` → `runTriggers` after `computeHit`), and the loader refuses
  `beforeDamage` on non-status triggers ("only status-event triggers can
  act before their hit's damage"). So a trigger on that buff (own
  `buffApplied` or a category trigger: Solemn Phalanx W4/W6, Eternal
  Xiranite) can't act on the hit. Needed: `buffApplied` events of
  before-damage buffs are run before the damage, for triggers with
  `beforeDamage: true` (allow it on `buffApplied`).
- evidence: ultimate_skill frame 47 order (above); dbaee23b801d 2485 ms
  matches only with `buff_wpn_funnel_0016_will_dmg` applied.
- impact: for Arcane none with the plan's workaround (a delayed cast
  trigger at the hit's frame, which runs before same-frame hits). Without
  it, her WILL ultimate and ult-2 hits miss +9.6–16.8% Arts DMG Taken and
  the INT ultimate hit misses Amp 0.24. The same applies to any kit that
  writes a before-damage Susceptibility or Amp on a hit, with generic
  equipment.

**R13. Source skill kind of a buff application**
- family: triggers
- feature: `fromKinds` on `buffApplied` category triggers, and the
  `buffApplied` event carries the kind of what applied the buff: a hit's
  kind; for a trigger's buff, the kind of the cast it belongs to (a delayed
  cast trigger: its cast; the game's inheritSourceSkillCastInfo); otherwise
  `none`.
- evidence: buff_wpn_funnel_0016_wisd and _will, abilityEvent 206:
  CheckBuffIdInContextAdvanced, then CheckOriginSkillType skillTypeList
  [2, 6, 7].
- impact: none on Arcane (her Susceptibilities come from her combo and
  ultimates). A wearer whose Susceptibility comes from a basic attack or a
  talent trigger gets W4 / W6 (+ATK `atk_up2`, enemy +Arts DMG Taken) when
  the game doesn't give them. Minor; it's R3's buff half, not on the open
  list.

### (d) In-game tests the kit still depends on

7 (INT residual; Amp for the array's 20 s), 13 (WILL combo cooldown,
confirmation), 18 (time stops; with 37 for Ti1b), 30 (now a confirmation of
the data's 10 s), 31 (Cluster Strike from a finisher, finisher + Final
Strike within 0.4 s, finisher SP), 32 (Gloompurge length; does ult 2 end
it), 33 (WILL same-element stack: timing, attribution, element), 34
(lasers after a natural INT end), 35 (combo window and W3 on a reacting
application), 36 (`fraction` meaning), 37 (Imprisonment and enemy timers).
Not yet in docs/in-game-tests.md: whether a same-hit equipment buff counts
on its own hit (Hot Work on the INT ultimate's hit, W3 on the battle skill
that inflicts): it settles the `beforeDamage` choices above. The first
round's F (talent-2 Corrosion duration) is optional: the data sets it.

## Kit (2026-10-18)

### Written

- `packages/data/kits/operators/chr_0032_lizhiyan.json`: the pass-3 plan
  (pass 2 where pass 3 left it). Stack `cluster_strikes`; talent-2
  `statusTweaks`; buffs `imprisonment`, `doubles_susceptibility`,
  `post_susceptibility_int`, `early_end_marker`, `int_after_end`,
  `gloompurger_array`, `gloompurge_arcana`, `int_amp`, `t1_susceptibility`;
  triggers for the combo windows, `imprison` (cast + 11, detached),
  `int_early_end`, `explosion`, `int_late_hit`, `array_start`,
  `cluster_strike` (Final Strike, 0.4 s), `cluster_strike_finisher`
  (`decorations: ["finisher"]`, `maxPerCast: 1`), `array_end`,
  `gloompurge_end`, `p5_cooldown` (`fraction`); skills with the new
  finisher (`power_attack`, `factor`, `poise`, `sp: 0` on its last
  landing), one combo hit `touch` and one ultimate hit `array` whose WILL /
  INT effects carry their own `if`. The old per-mode combo hits (touch,
  explosion and lasers at assumed frames) and the not-modelled list in
  `sources` are gone; notes say where each value comes from.
- Equipment: `wpn_funnel_0016` (Solemn Phalanx: W3–W6), `suit_usp02`
  (Eternal Xiranite), `suit_usp01` (Catastrophe), as planned.
- `examples/arcane-will-solo.scenario.json`: description only.
- Tests: `kits.test.ts` drops the power_attack gap; `skillCompile.test.ts`
  KNOWN: the six old Arcane rows went with the hits they described
  (explosion and laser frames are trigger hits now, the ultimate's applies
  changed), six new ones: the finisher's three `factor`s (the compiler
  reads no BreakingAttackCalculation multiplier, D2), the combo's and the
  ultimate's `element: "enemy"` infliction (the data's Switch on
  EntityBB_consumed_type / the enemy's tags, A6), and the ultimate's
  `energyBlockSeconds` 1.567 against the compiled 21.567 (the array's 20 s
  block is `gloompurger_array`'s `blocksEnergy`, which two Cluster Strikes
  end early).
- `packages/cli/src/reactioncheck.ts`: the reaction replay now leaves out an
  application whose own `if` is false for the build (it ignored it, so the
  WILL logs got the INT forced Corrosion once the ultimate's two effects
  became one hit).

### Deviations from the plan

- **The ultimate's array and talent-1 Susceptibility are hit `buffs` with
  `beforeDamage`, not the delayed cast triggers `ult_frame_47` /
  `t1_susceptibility_ult2`.** The plan used those only because a
  before-damage buff's `buffApplied` triggers ran after the damage (R12);
  P3-10 runs them before it, so `array_start` (INT Amp) and the weapon's
  and Eternal Xiranite's category triggers act on the hit either way. The
  WILL solo total is the same as the pass-3 scratch run (102,141).
- **Solemn Phalanx W4 / W6 have `fromKinds: ["battle", "combo",
  "ultimate"]`** (P3-11, R13; abilityEvent 206's CheckOriginSkillType
  [2, 6, 7]). Arcane's Susceptibilities come from her combo (the `imprison`
  trigger carries the combo's kind, `int_early_end` the battle skill's)
  and ultimates, so nothing changes for her.
- `suit_fire_natr01` (Hot Work) isn't written here: another operator owns
  it. The INT build of d9e59d0fb737 needs it; the plan's version (two
  `reaction` triggers with `beforeDamage`) is in the pass-3 scratch kits.

### Verification

`npm run check` passes (375 tests).

`efsim zmdlogs check`, Arcane, before → after (identical counts; only the
"kit hit touch_will / array_will" labels are gone, those keys now have one
kit hit each):

| Fixture | Hits | Match | Mismatch | Unquantified | Uncovered | Covered |
|---|---|---|---|---|---|---|
| 0eef2474a26f | 4 | 3 | 0 | 0 | 1 (`buff_common_natural_triggered`, L2) | 67% |
| b7b3762d5da8 | 13 | 13 | 0 | 0 | 0 | 100% |
| bdf223db8e49 | 59 | 32 | 0 | 26 | 1 (L2) | 78% |
| d9e59d0fb737 | 16 | 0 | 0 | 16 (forced Corrosion, pre-1.6 tables) | 0 | 100% |
| dbaee23b801d | 4 | 4 | 0 | 0 | 0 | 100% |

The other operators' lines are unchanged. `efsim zmdlogs reactions`
(Arcane's): 0eef2474a26f and bdf223db8e49 go from 1 matched + 1 unexpected
Cryo burst to 2 matched (the WILL touch's same-element Cryo, logged 1.0 s
later, and the battle skill's Corrosion now at level 2, as the hit checks
assume); b7b3762d5da8 predicts Cryo bursts at 4953 and 7150 ms (×2) that
the log has at 10340 / 10910 ms, outside the 1.2 s window; dbaee23b801d's
predicted Nature burst at 8501 ms is logged at 10341 ms (both test 33);
d9e59d0fb737 unchanged.

Example totals (`efsim simulate`):

- arcane-will-solo: 54,023 → 102,141. New hits: two Cluster Strikes from
  the chain's Final Strikes (8 lasers, 13,016) and the bursts of the touch's
  and the ultimate's same-element Nature (8,613 + 10,477); the rest
  (+16.0k) is talent 1's Susceptibility (0.128, 10 s from the ultimate),
  Solemn Phalanx's two Arts DMG Taken debuffs (0.108 each, from the
  combo's Susceptibility and the touch's burst) on every later hit, and the
  combo explosion 2 frames later (Imprisonment from seal_total frame 2).
- gilberta-gravity-field: 271,088 → 286,594: Gilberta wears Eternal
  Xiranite; her Susceptibility now gives Laevatain +16% DMG for 15 s
  (222,452 → 237,958, Combustion ticks included).
- The others are unchanged (estella-solidification: Estella is alone;
  liino-laevatain: Liino has one usp02 piece).

Spot checks (scratch scenarios, a stepping trace of buffs, stacks, energy,
SP and hit modifiers):

- INT (d9e59d0fb737 build, P0): battle-skill infliction → W3 Arts DMG on
  that hit; combo at +11 → Imprisonment, Susceptibility 0.04, W4 ATK; the
  battle skill hitting the Imprisoned enemy ends it early: SP +30, early
  explosion, post-Imprisonment Susceptibility until the final laser, lasers
  at +43/46/49/52/58; ultimate: forced Corrosion, array and INT Amp 0.24 on
  its own hit; Final Strikes → Cluster Strikes (+50 energy past the block,
  lasers at +15…27), the second → Gloompurge Arcana (energy 100) and ult 2
  (Amp still on); Gloompurge's end clears Amp and the strikes; a second
  combo (12 s cooldown: talent 1's −6 s in INT) ends naturally: explosion at
  +14, then the next battle-skill hit gives SP and the late explosion.
- WILL (P5, Eternal Xiranite, Laevatain): touch with the enemy's element
  (burst) and W6; W5 after the burst; Eternal Xiranite +16% on Laevatain
  only; talent-1 Susceptibility 0.198 (0.128 + P5 0.07) before the
  ultimate's hit, 10 s; a Finisher (enemy staggered by hand) gives one
  Cluster Strike (lasers at +12…24, not one per landing), SP without the
  unread 8; the Final Strike gives the second; ult 2 (Susceptibility
  before its hit) cuts the combo's cooldown by 5.4 s (30% of 18 s).
- Catastrophe: the first battle skill returns 50 SP, the second nothing.

### Still unverified

In-game tests 7 (INT Amp for the array's 20 s), 13, 18 and 37 (time stops,
Imprisonment's slow-down, Ti1b), 30 (10 s, a confirmation), 31 (Finisher
Cluster Strike, Finisher + Final Strike within 0.4 s, finisher SP), 32
(Gloompurge length; does ult 2 end it), 33 (WILL same-element stack:
timing, attribution, element; the reaction check above), 34 (lasers after a
natural INT end), 35 (combo window and W3 on a reacting application), 36
(`fraction` meaning), 51 (whether a same-hit equipment buff counts on its
own hit: W3's and Hot Work's `beforeDamage`). No log has a Cluster Strike,
ult 2, a finisher or a late INT explosion.
