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
