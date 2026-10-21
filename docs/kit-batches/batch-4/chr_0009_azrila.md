# Ember (chr_0009_azrila): gap report, batch 4

Operator Ember (Defender, Heat, greatsword: CharGrowthTable `profession` 2,
`charTypeId` Fire, `weaponType` 3, rarity 6; main attribute Strength 39,
secondary Will 42), with the weapons Exemplar (`wpn_claym_0004`), Former
Finery (`wpn_claym_0006`) and Thunderberge (`wpn_claym_0007`), all
weaponType 3, 6-star ([batch-4.md](../batch-4.md)).

Sources (rmxlinux): SkillData `chr_0009_azrila_*` (18 files), BuffData
`buff_chr_0009_azrila_*` (17 files), `sk_wpn_claym_0004/0006/0007`,
`buff_wpn_claym_0004*`, `buff_wpn_claym_0006*`, `buff_wpn_claym_0007_valid`,
`buff_physical_knockdown`, `buff_common_affixes_shelter`; TableCfg
CharGrowthTable, CharacterPotentialTable, PotentialTalentEffectTable,
SkillPatchTable, WeaponBasicTable, I18nTextTable_EN. Values at skill level
12 / weapon skill level 9 unless noted; frames are SkillData timeline frames
(30 FPS) from the cast. Talent order (0-based, as `talentAtLeast` counts):
0 = Inflamed for the Assault (`chr_0009_azrila_talent_1_*`), 1 = Pay the
Ferric Price (`chr_0009_azrila_talent_2_*`).

`efsim kit-draft chr_0009_azrila` was run; it compiles every damage
landing, frame, factor, element, poise, SP, energy, Knock Down and the
battle skill's team energy correctly. What it leaves out or misreads is in
the `data` rows and G7.

## Earlier notes on Ember (claims re-checked)

- Batch 2, Catcher G1 ([batch-2/chr_0020_meurs.md](../batch-2/chr_0020_meurs.md)):
  "the same listener (abilityEvent 101, mask 805306368) is in … Ember's
  (`chr_0009_azrila_normal_skill`) files; 'When the controlled operator is
  attacked' is Ember's and Purrchena's combo trigger". **Confirmed**:
  normal_skill EventListenerAction [0–38], abilityEvent 101 +
  CheckDamageDecorateMask checkType 3 mask 805306368. But Ember's listener
  doesn't jump: it creates `buff_chr_0009_azrila_normal_skill_gpsuccess`,
  which adds Stagger to the slam at frame 38 (row 8).
- Batch 2's owner decision (enemy attacks from the scenario; "when attacked"
  effects fire then; batch-2.md lists Ember among them): **applies** to her
  combo trigger, talent 2 and the battle skill's guard.
- Batch 3 E3 ("Done … Snowshine G4, Catcher, Purrchena row 34, Ember"):
  **not true for Ember**. The dodge policy reads only an `attacked`
  trigger whose action is a `jump` of the current skill
  (`counters()` in packages/engine/src/timeline.ts). E3's second form, a
  skill field `noDodge: [from, until]`, was never added. Ember's guard is
  not a jump, so with dodging on she dashes and loses the slam (G1;
  scratch run below).
- In-game test 53 (does a perfectly dodged hit count as "attacked"?) names
  Ember as one of four operators who can run it. Ember gives the cleanest
  variant: her combo trigger needs no HP condition, unlike Catcher's (see
  Verification).

## Action types per file

Only the action types that matter for damage, resources, state or timing
are listed. Sound, VFX, camera, animation, root motion, rotation, target
finding, teleport and ComboCacheAction are left out.

| File | Action types that matter |
|---|---|
| attack1, attack2, attack3 | ChannelingAction [13–18] / [6–12] / [18–22]: DamageAction `atk_scale` (mask 128, damageType 0 Physical), HitStopAction (controlled only); AllowNextSkillAction 24–38 / 18–41 / 35–50; SetSuperArmor 15. durationFrame 163 / 151 / 182, exclusiveFrame 38 / 26 / 47 |
| attack4 | ChannelingAction [26–29]: DamageAction `atk_scale` (mask 2097280 Final Strike; poise `poise` 25, onlyEnableForMainChar), DoOnce ObtainCostAction costType 1 `atb` 28 (atbSourceType 1); durationFrame 180, exclusiveFrame 52 |
| power_attack (finisher, spec 8) | DamageAction f9 (BreakingAttackCalculation × **0.1**) and f23 (× **0.9**), mask 132; GainBreakingAttackAtb; `buff_common_full_immune_medium`, `buff_common_power_attack_disable_cast_skill`; AllowNextSkillAction 28–44 (battle, combo) |
| plunging_attack_end (dive, spec 6) | DamageAction f1 (mask 1152), ObtainCostAction `atb` (0, controlled only) |
| dash_attack (spec 7) | DamageAction (`atk_scale` 1.27, poise 5), ObtainCostAction `atb` 0; in SkillPatchTable, not in the NormalAttack skill group |
| normal_skill (battle, spec 3) | f0: if `talent1` > 0, CreateBuff `…_normal_skill_shelter` (rate = `shelterrate` (+ `extrashelter` if `potential_1`), duration −1, autoFinishByAction); **EventListenerAction [0–38]**: abilityEvent 101 + CheckDamageDecorateMask (checkType 3, mask 805306368) → CreateBuff `…_normal_skill_gpsuccess`; ChannelingAction [10–15]: DamageAction `atk_scale` (Heat, damageType 2, mask 4352), HitStopAction 0.16 s; **f38**: if `potential_1`, a target hit and `talent1`: CreateBuff shelter (duration `extratime`); KnockDownAction 1.5 s; DamageAction `atk_scale2` (Heat, mask 4352) + poise-only unit `poise`; **if gpsuccess ≥ 1: poise-only DamageAction `extrapoise`**; if a target was hit: CreateBuff `buff_common_obtain_ultimate_sp`, HitStopAction 0.2 s; SetSuperArmor 25 [0–55]; AllowNextSkillAction 51–60 (itself). durationFrame 162, exclusiveFrame 55. No MarkCanInterrupt, no jump |
| combo_skill (spec 4) | f0: shelter as for the battle skill; TimeDilationAction [0–12] (ComboSkill curve, 0.5 s); **f26**: InterruptAction (immobilizedTime 1), P1's shelter (`extratime`), KnockDownAction 1.5 s, DamageAction `atk_scale` (Physical, mask 12288) with poise `poise`, **HealAction** on the controlled operator (CharacterTeamFinder + MainCharacterValidator; `heal_base` + Will × `will_additive`; healTags −1517158118, the combo heal tag), if `potential_3`: `heal_base`, `will_additive` × `extracure` and a second HealAction on group CureTarget, ObtainCostAction `usp` if a target was hit; AllowNextSkillAction 40–60 (battle). durationFrame 161, exclusiveFrame 38; castData cooldown 28 is overridden by SkillPatchTable 19 → 18 |
| ultimate_skill (spec 5) | UltimateTimeAction [0–48], TimeDilationAction RESETto1 on self [0–3], `buff_common_damage_immune_ult_skill` [0–90]; **f50**: if `potential_5`, `hp_percent` × `extrashield`; StoreAttributeValue Max HP → `FinalShield` × `hp_percent`; InterruptAction; DamageAction `atk_scale` (Heat, mask 4608) + poise-only unit `poise`; CreateBuff `buff_chr_0009_azrila_ultimateshield` on group Teammate (CharacterTeamFinder) with `duration`, `hp_percent`, `potential_5`, `extraattack`, `FinalShield`; AllowNextSkillAction 59–90 (battle, combo). durationFrame 262, exclusiveFrame 90 |
| buff_…_normal_skill_shelter | event 0: ShelterAction (asChildBuff, `rate`, `duration`); event 5: SetSuperArmor 35 |
| buff_…_normal_skill_gpsuccess | `dur` 2 s, stackingType 7; abilityEvent 31 + CheckSkillId normal_skill → FinishBuffAdvanced (itself); a HitStop |
| buff_…_talent_2 (attached by talent 2) | abilityEvent 12 + CheckObjectTypeMatch 16 + CheckDamageDecorateMask (3, 805306368) → CreateBuff `buff_…_talent_2_buff` (`attack`, `duration`) |
| buff_…_talent_2_buff | attribute 2 (ATK) formulaItem 6 `attack`; `duration`; **stackingType 10**, maxStackCnt 3 |
| buff_…_ultimateshield | shieldConfigs `FinalShield`; applyTags **−1757502026** (the shield tag); event 0: if `potential_5` > 0, CreateBuff (asChildBuff) `…_ultimate_skill_shield_extraattack` on the holder (targetSource 0) |
| buff_…_ultimate_skill_shield_extraattack | attribute 2 formulaItem 6 `extraattack` (0.1 at P5) |
| Unused files | `chr_0009_azrila_talent_0` (toggles `buff_…_talent_atkup` / `_defup` by HP ratio 0.5), `_potential_5` (`buff_…_potential_5`, CheckCurHpRatio), `_combo_skill_defend` (creates `buff_chr_0003_endmin_extra_attack`: a copy of another operator's file), `_extra_attack` (BreakInteractiveAction: breakable objects), `_tactic_skill`, `_dodge` (animation only); buffs `…_normal_skill_weak`, `…_talent_0_1`, `…_talent_def_reduct`, `…_ultimate_skill` (DEF down), `…_ultimate_skill_atkreduct`, `…_ultimate_skill_defup` (stackingKey buff_potion), `…_ultimate_skill_Shield_Shelter`, `…_combo_skill_tutorial_marker`. No CharGrowthTable, SkillPatchTable or PotentialTalentEffectTable entry names any of them, and no used file reaches them |
| sk_wpn_claym_0004 | cardAttributeModifier attribute 50 (Physical DMG) formulaItem 5 `phy_damage_up`; passiveEventActions abilityEvent 302 + CheckDamageDecorateMask (checkType 1, mask 768) + no `buff_wpn_claym_0004_cd` → CreateBuff `_cd` (`cd_duraton` 0.1 s), CreateBuff `buff_wpn_claym_0004_phy_damage_up` (`phy_damage_up2`, `duration`, `max_stack`); toggleBuffs `buff_wpn_passive_spirit_01` (`atk_up`: not a key of this skill) |
| buff_wpn_claym_0004_phy_damage_up | attribute 50 formulaItem 5 `phy_damage_up2`; stackingType 2, maxStackCntKey `max_stack` (3) |
| sk_wpn_claym_0006 | cardAttributeModifier attribute 29 (Treatment Efficiency) `heal_up`; passiveEventActions abilityEvent 64 + CheckBuffStackNumAdvanced on the event's operator, tag −1957150384 ≥ 1 + CheckGlobalCDTimer `buff_wpn_claym_0006_cd` → FinishBuff `_icon`, HealAction on that operator (`heal_will_add` + Will × `heal_will_mult`), CreateBuff `_cd`, AddGlobalCDTimer `cd` 15 s |
| sk_wpn_claym_0007 | cardAttributeModifier attribute 88 (Shield applied) `shield_up`; passiveEventActions abilityEvent 50 + CheckHealTag −1517158118 (combo heal) + CheckGlobalCDTimer `buff_wpn_claym_0007_valid` → StoreAttributeValue Max HP × `hp_ratio`, AddGlobalCDTimer `cd` 15 s, CreateBuff `buff_wpn_claym_0007_valid` (`shield_valid`, `duration` 15 s) on the controlled operator; toggleBuffs `buff_wpn_lance_0003` (CheckCurHpRatio, `atk_up`: not a key of this skill) |
| buff_wpn_claym_0007_valid | shieldConfigs `shield_valid`; applyTags **−1757502026** |

Tag −1757502026 is the shield tag: BuffData files carrying it are
`buff_chr_0009_azrila_ultimateshield`, `buff_chr_0020_meurs_combo_skill_shield`,
`buff_chr_0031_mifu_shield`, `buff_wpn_claym_0007_valid`; the one reader is
Catcher's P5 (`chr_0020_meurs_normal_skill`). Tag −1957150384 (Protected)
is on `buff_common_affixes_shelter` (ShelterAction's child) and is read by
`buff_equipsuit_usp_02` (Eternal Xiranite), Snowshine's P1 listener and
Former Finery.

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–3: Physical, frames 13 / 6 / 18 (attack1–3 files; "an attack with up to 4 sequences that deals Physical DMG") | supported | skill hits with `element: physical` (kit-draft) |
| 2 | Basic attack 4, Final Strike: poise 25 when controlled, 28 SP when controlled (attack4: mask 2097280, onlyEnableForMainChar, DoOnce ObtainCostAction) | supported | `finalStrike`, `poise`, `poiseControlledOnly`, `sp: {if: {controlled}, then: atb}` (kit-draft) |
| 3 | Finisher: 9 × ATK in two landings 0.1 / 0.9, SP from the enemy (power_attack BreakingAttackCalculation) | supported | two hits with `factor` (kit-draft); finisher SP is the engine's |
| 4 | Dive attack: 1.8 × ATK, Physical (plunging_attack_end) | supported | skill hit; rotations don't jump (S10, open) |
| 5 | Dash attack: 1.27 × ATK, poise 5 (dash_attack in SkillPatchTable) | gap | S5 (deferred) |
| 6 | Battle skill leap: 0.73 × ATK Heat at f10 (normal_skill ChannelingAction [10–15]) | supported | hit `leap` (kit-draft) |
| 7 | Battle skill slam: 3.17 × ATK Heat, Knock Down, 10 Stagger at f38, team energy at f38 if a target is hit ("a heavy slam that deals Heat DMG, Knock Down, and Stagger") | supported | hit `slam`: `applies: knockdown`, `poise`; `teamEnergy: [{frame: 38, ratio: 1}]` (kit-draft) |
| 8 | Guard: "If Ember takes DMG from enemies during casting, the slam deals more Stagger when it hits" (listener [0–38] → gpsuccess 2 s → poise-only `extrapoise` 10 at f38) | data | trigger `attacked` `by: self` with `if: buffActive guard_listen` → buff `guard_success`; slam `poise: {sum: [poise, {if: {buffActive: guard_success}, then: extrapoise, else: 0}]}`. kit-draft only notes "stagger extrapoise without damage (no hit drafted)" (D3 open: a poise unit on another IfElse). Scratch run: 10 more Stagger when attacked at 1 s, none when attacked after f38 |
| 9 | The guard with dodging on: the player tanks the hit (super armour 25, talent 1's Protection) | gap | G1: the dodge policy dashes; the battle skill ends and the slam is lost |
| 10 | Battle-skill timing: exclusiveFrame 55, durationFrame 162, AllowNextSkill 51–60 (itself) | supported | loader (SkillData) |
| 11 | Combo trigger: "When the controlled operator is attacked" (CharGrowthTable chr_0009_azrila_ComboSkill; game code) | supported | trigger `on: attacked`, `by: controlled`, `openCombo` (as Purrchena) |
| 12 | Combo hit: 2.3 × ATK Physical, Knock Down, 10 Stagger, 10 energy at f26 (if a target is hit); cooldown 18 s at L12 | supported | hit with `applies: knockdown`, `poise`, `energy: usp` (kit-draft); cooldown from SkillPatchTable |
| 13 | Combo heal of the controlled operator, combo heal tag ("giving HP treatment to the controlled operator") | data | hit `heals: controlled` (the event's kind is the hit's: combo). kit-draft doesn't compile HealAction (G7) |
| 14 | Combo slow-down 0.5 s (TimeDilationAction [0–12]) | supported | loader |
| 15 | Combo and ultimate InterruptAction (immobilizedTime 1) | gap | E1 (deferred): an interrupt's Stagger isn't known |
| 16 | Ultimate hit: 6.5 × ATK Heat, 25 Stagger at f50 | supported | hit (kit-draft) |
| 17 | Ultimate shield: every teammate gets a Shield of `hp_percent` (25%) × Ember's Max HP for `duration` 10 s ("granting every teammate a Shield based on Ember's Max HP") | supported | team buff `ult_shield` (gameBuff `…_ultimateshield`, no modifiers) on the hit; shield points not modelled (as Catcher's combo shield) |
| 18 | Ultimate time stop, damage immunity [0–90] | supported | loader (UltimateTimeAction); immunity is defensive |
| 19 | Talent 1: Protection 30% / 50% while casting the battle skill and the combo (ShelterAction; "Ember gains {shelterrate} Protection") | supported | self buff `protection`, `endsWithCast`, `{attr: 63, value: shelterrate + extrashelter}`, applied by cast triggers if `talentAtLeast [0, 1]`; a Protection-category buff for `buffApplied` triggers (Eternal Xiranite) |
| 20 | Talent 1: "less likely to be interrupted" (shelter's SetSuperArmor 35) | supported | no effect: enemy interrupts aren't simulated |
| 21 | Talent 2: ATK +6% / +9% for 7 s when Ember receives DMG from an enemy, up to 3 stacks (`buff_…_talent_2`, abilityEvent 12) | supported | trigger `attacked` `by: self` → self buff `ferric_atk` (`{talent: 1, key: attack}`, `maxStacks: 3`). Logged at 0.09 in 7e19 |
| 22 | Talent 2's stacking: stackingType 10 (the inflictions' type), maxStackCnt 3 | unknown | G3 (U4); interim `sharedTimer: true` |
| 23 | P1: Protection +20%; "hitting an enemy extends the duration by 1.5 s" (second shelter at f38 / f26 with `extratime`) | supported | `extrashelter` in the value; buff `protection_hit` (`duration: extratime`) on the slam and the combo hit, `if` talent 1 and P1 |
| 24 | P2: Strength +20, Will +20 | supported | stat panel |
| 25 | P3: the combo also heals "another teammate with the lowest percentage HP" at 50% | unknown | U1: HP isn't tracked (N2), so whom it heals isn't known; interim: no second heal event |
| 26 | P4: ultimate energy cost × 0.85 | supported | skillParam (scratch run: 85 at P5) |
| 27 | P5: shield × `extrashield` 1.2 | supported | no effect (shield points not modelled) |
| 28 | P5: "while this shield is active, the wielder gains ATK +10%" (child buff of each holder's shield) | supported | team buff `p5_atk` (`{zone: atk, value: extraattack}`) on the hit with `if: potentialAtLeast 5`, same duration as the shield. Interim: the shield never breaks (U2) |
| 29 | The ultimate shield carries the shield tag −1757502026 that Catcher's P5 checks | gap | G2: Catcher's kit reads only her own `combo_shield` |
| 30 | kit-draft's note "creates on its target (the enemy hit): buff_…_shield_extraattack" | data | wrong target: it's the shield holder (G7) |
| 31 | Hit-stops (leap 0.16 s, slam 0.2 s, basics 0.2–0.3 s, finisher 0.5 s) | gap | Ti1b (open) |
| 32 | A perfectly dodged attack: no combo window, no talent-2 layer, no guard | unknown | engine: a perfect dodge replaces the attack (no `attacked` event); test 53 (Ember variant below) |
| 33 | Combo trigger during its 18 s cooldown | unknown | T5 (open; engine ignores it) |
| 34 | Unused files: talent_0 (ATK up above / DEF up below 50% HP), potential_5 (DMG at an HP ratio), combo_skill_defend, extra_attack, tactic_skill and the buffs only they reach | supported | not in the game (no table names them); left out |
| E1 | Exemplar: Physical DMG +`phy_damage_up` (cardAttributeModifier) | supported | stat panel (calc: 20.0% at skill level 6) |
| E2 | Exemplar: "When the wielder's battle skill or ultimate hits the enemy, the wielder gains Physical DMG Dealt +{phy_damage_up2} for {duration}s. Max stacks … {max_stack} … counted separately. … once every 0.1s." | supported | trigger `hit` `kinds: [battle, ultimate]`, `reaction: false`, `cooldown: cd_duraton` → self buff, `maxStacks: max_stack`, `{attr: 50}`. Status hits don't count (Knock Down's DamageAction mask is 65536). Verified in 7e19 (two layers per battle skill) |
| E3 | Exemplar: toggleBuffs `buff_wpn_passive_spirit_01` with `atk_up` | supported | template leftover, no effect (the skill has no `atk_up`) |
| F1 | Former Finery: Treatment Efficiency +`heal_up` | supported | stat panel; heal amounts aren't modelled |
| F2 | Former Finery: "After a Protected operator takes DMG, the wielder restores the said operator's HP by [{heal_will_add} + Will×{heal_will_mult}]. Effect only triggers once every {cd}s." | gap | G4: "the attacked operator is Protected" can't be said. Only a heal event (no damage) |
| T1 | Thunderberge: Shield applied +`shield_up` (attribute 88) | supported | no effect (shield points not modelled) |
| T2 | Thunderberge: "After the wielder's combo skill provides HP treatment, the controlled operator gains an additional [{hp_ratio} × Wielder's Max HP] Shield for {duration}s. … once every {cd}s." | supported | trigger `heal` `kinds: [combo]` `by: self`, `cooldown: cd` → team buff with `recipients: {controlled: true}` (gameBuff `buff_wpn_claym_0007_valid`). Scratch run: shield on the controlled operator at the combo's heal, 15 s |
| T3 | Thunderberge's shield carries the shield tag | gap | G2 (as row 29) |
| T4 | Thunderberge: toggleBuffs `buff_wpn_lance_0003` with `atk_up` | supported | template leftover, no effect (as OBJ Heavy Burden's) |

**Counts:** 43 rows: supported 29, data 3 (rows 8, 13, 30: G7's compiler
items; row 30 is a misread), gap 7 (rows 9 G1, 29 and T3 G2, F2 G4; rows
5 S5, 15 E1, 31 Ti1b referenced), unknown 4 (rows 22, 25, 32, 33),
unique? 0. Nothing is unique: every gap has a
second user (below), and [kit-unique.md](../../kit-unique.md) lists only
Si's damage record.

**Signature weapons:** none plainly another operator's. Exemplar pays off
for a wielder whose battle skill and ultimate hit often and who deals
Physical damage. Ember's battle skill and ultimate are Heat, so its layers
help only her basics, combo and finisher, but the log's player uses it on
her. Former Finery wants Protection on the team (Ember, Catcher, Snowshine,
Purrchena). Thunderberge wants a combo that heals: of the greatsword
operators, Ember and Snowshine (`healKind combo`) have one.

## Gaps

### G1. The dodge policy doesn't see Ember's guard

- **family:** skills / timing (batch 3 E3's residue; the batch-3 review's
  open item "the dodge policy recognising a counter written as a `cast`
  (Purrchena's blocks) and not only as a `jump`").
- **feature:** E3's second form: a skill field `noDodge: [from, until]`
  (skill frames, on the cast's playhead, as `jump` ranges are). With
  dodging on, the controlled operator doesn't dash at an attack while its
  current skill's playhead is in that range; the attack lands and its
  `attacked` triggers fire. `counters()` (timeline.ts) checks it beside the
  jump form. Ember: `chr_0009_azrila_normal_skill` `noDodge: [0, 38]`.
  Purrchena's shield frames could use the same field instead of the policy
  learning `cast` counters.
- **evidence:** normal_skill EventListenerAction [0–38] (abilityEvent 101)
  → gpsuccess → the slam's extra poise-only DamageAction; SetSuperArmor 25
  [0–55]. The mechanic exists to be hit. Scratch run with `dodge: {chance:
  1}` and an attack at 1 s: only the leap lands; Ember is in `dodge` from
  frame 39.
- **impact:** with dodging on and an attack in [0, 38), the battle skill
  loses the slam (3.17 of its 3.90 × ATK at L12, 81%), its Knock Down and
  Vulnerable stack, 10–20 Stagger and its team energy. Talent 2's ATK
  layer and her own combo window go too. No impact without dodging.

### G2. A shield from anyone, as a condition

- **family:** conditions (with buff categories).
- **feature:** a buff category `shield`: a kit buff whose `gameBuff`
  carries applyTags −1757502026 (the loader reads BuffData `applyTags`).
  A Predicate `{operatorBuff: {categories: [...]}}`: any active buff from
  anyone that reaches the operator (own, a teammate's team buff,
  equipment) is of one of these categories. Amp and Susceptibility come
  from their zone, Weakness and Protection from attributes 62 / 63, Shield
  from the tag. This is the twin of `operatorModifier`, which reads only
  zones. Catcher's P5 then becomes `sp: {if: {operatorBuff: {categories:
  [shield]}}, then: potential5_atb}`.
- **evidence:** `chr_0020_meurs_normal_skill` P5: CheckBuffStackNumAdvanced
  tag −1757502026 on Catcher (batch-2 Catcher row 11). The tag is on
  `buff_chr_0009_azrila_ultimateshield`, `buff_wpn_claym_0007_valid`,
  `buff_chr_0031_mifu_shield` and Catcher's own combo shield.
- **impact:** small. Catcher at P5 in a team with Ember (ultimate,
  Thunderberge) or Mi Fu misses 10 returned SP per bash while shielded by
  them. Not needed for Ember's own damage.

### G3. stackingType 10's timer

- **family:** buff lifecycle (next to B3, stackingType 8).
- **feature:** the loader sets `sharedTimer` for stackingType 10 as for 8
  (layers on one timer that each new layer refreshes), if test 62's Ember
  variant agrees. stackingType 10 is the inflictions' type
  (`buff_common_enemy_spell_*_attached`, maxStackCnt 4), and the engine
  already gives inflictions one refreshed timer (status.ts). Other type-10
  buffs: `buff_chr_0028_wulfa_combo_usecount` (Rossi's report decides
  what it is) and Typhoeus's `buff_chr_0034_typhoea_passive_spellbrust_damageup`
  (no kit buff stands for it).
- **evidence:** `buff_chr_0009_azrila_talent_2_buff` stackingSettings
  `{stackingType: 10, maxStackCnt: 3}`. In 7e19 the buff is listed once at
  0.09 on every Ember hit from 5330 to 13222, then gone at 14879. With a
  7 s duration it was applied twice (before 5330 and between 6222 and
  7879), yet the log never lists two entries, as it does for Exemplar's
  type-2 layers. This fits one refreshed timer (or a log that lists
  type-10 layers once).
- **impact:** talent 2's ATK +9% per layer: with independent timers, a
  layer can drop up to 7 s earlier than with a shared one. In-game test 62
  variant below. Interim in the draft: `sharedTimer: true` written in the
  kit (the schema allows it).

### G4. "A Protected operator takes DMG"

- **family:** conditions (the same predicate as G2).
- **feature:** `{eventOperator: {operatorBuff: {categories: [protection]}}}`
  on an `attacked` trigger `by: anyone`: the attacked operator has a
  Protection-category buff (attribute 63) from anyone. Former Finery is
  then `{on: {event: attacked}, by: anyone, if: <that>, cooldown: cd, do:
  [{kind: heal, target: eventOperator}]}`. The cooldown is one per wielder
  (AddGlobalCDTimer on the wielder), as a trigger's `cooldown` is.
- **evidence:** sk_wpn_claym_0006 abilityEvent 64 +
  CheckBuffStackNumAdvanced (tag −1957150384, `buff_common_affixes_shelter`)
  on the event's operator → HealAction on it.
- **impact:** heal events only (amounts aren't modelled), so no damage
  changes unless a heal-triggered effect is in the team (e.g.
  `wpn_lance_0014`). Interim: no trigger.

### G5. `zmdlogs check` can't layer Æthertech's buff

- **family:** log tooling (L1's follow-up).
- **feature:** `layerVariants` (packages/cli/src/logcheck.ts) tries a
  stackingType 8 buff listed once at 1 to its maximum layers. For a
  maximum set by a key (`maxStackCntKey`) it asks `teamStackCaps`. That
  function matches the buff to its applying skill by ID prefix, which
  fails for `buff_equipsuit_poisedmg_01_damagebuff` (the set skill is
  `passive_equipsuit_poisebreak_01`). Fix: when the cap isn't found, find
  the applying skill through the equipment or operator kit buff whose
  `gameBuff` is this buff (its kit's source skill), else fall back to the
  BuffData literal `maxStackCnt` (4 here).
- **evidence:** scratch copy with the literal fallback (one line in
  `layerVariants`): Ember goes from 5 to 14 of 21 hits matched, 9 of them
  with `buff_equipsuit_poisedmg_01_damagebuff ×2 layers`. That is the two
  Vulnerable applications of her two Knock Downs (6324, 8077); without
  the layer every Physical hit is ×1.0347 short (2.30 → 2.38 in the DMG
  bonus sum).
- **impact:** every Æthertech wearer's hits in logs (and any other
  set whose buff and skill IDs differ). It's tooling only; the engine's
  `suit_poise01` kit already layers it.

### G6. `zmdlogs reactions` takes the first kit hit with a logged key

- **family:** log tooling.
- **feature:** `kitHit` (packages/cli/src/reactioncheck.ts) returns the
  first kit hit whose `events` include the logged key. When a skill has
  several hits with one key (Ember's leap and slam are both
  `chr_0009_azrila_normal_skill`), map the n-th logged hit of that key in
  one cast to the n-th kit hit in frame order. Or try each such hit and
  keep the one whose `applies` explain the log.
- **evidence:** with the draft kit, the slam's Knock Downs at 6324 and
  25812 are "unexpected" while the combo's (a unique key) match at 8077 and
  28603. The replay then counts 3 Vulnerable stacks at 8077 where the log's
  Æthertech attackbuff (4 stacks) says 4.
- **impact:** reaction checks for every operator whose skill has two
  differently-applying hits under one key.

### G7. kit-draft omissions (data compilation)

- **family:** data compilation (D3 / D4 open lists).
- **feature:** (a) HealAction → `heals` (CharacterTeamFinder +
  MainCharacterValidator → `controlled`, the whole team → `team`, self →
  `self`; the heal tag gives the event's kind, here the hit's); (b) a
  created buff reported with its target when it sits in another buff's
  start event: CreateBuffAction with targetSource 0 inside
  `buff_…_ultimateshield` is the shield's holder, not "the enemy hit";
  (c) the P1 shelter at f38 / f26 behind CheckEntityNum and two
  CompareFloats (not reported at all); (d) a poise-only DamageAction under
  an IfElse on a created buff (`extrapoise`), noted but not drafted.
- **evidence:** kit-draft output for chr_0009_azrila (combo has no heal;
  the ultimate's note names the enemy as the child buff's target).
- **impact:** none once hand-written; it's compiler polish.

### Unknowns

- **U1 (row 25):** P3's second heal goes to "another teammate with the
  lowest percentage HP" (group CureTarget). HP isn't tracked (N2), so the
  target isn't known. Interim: no event. A heal event only matters to
  heal-triggered effects (Thunderberge's cooldown makes a second combo
  heal irrelevant to it).
- **U2 (row 28):** the shield's breaking. P5's ATK lasts while the holder's
  shield holds (asChildBuff); shield points and incoming damage aren't
  modelled (N2), so the interim is the full 10 s. Against a boss that hits
  hard, P5's +10% ATK on a teammate may end early.
- **U3 (row 32):** does a perfectly dodged attack count as "attacked"
  (test 53)? The engine says no.
- **U4 (row 22):** G3.

Referenced, not re-proposed: S5 (dash attack), S10 (dive attacks), E1
(InterruptAction), Ti1b (hit-stops), T5 (combo trigger during its
cooldown), N2 (operator HP: U1, U2, the unused talent_0 / potential_5
files would need it if they were live), D3 / D4 (G7).

## Verification

### Log: fixtures/pending/zmdlogs-7e19489ae503.json

Ember is in the log at P1, battle and ultimate at skill level 9, basic
and combo at 12, Exemplar (skill levels 9 / 9 / 6) and three Æthertech
pieces (`suit_poise01`), with the Endministrator, Chen Qianyu and
Pogranichnik. 21 hits; no ultimate. Run in the scratch copy with the draft
kits (packages loaded by the real loader):

| Run | Ember's hits |
|---|---|
| Main checkout (no kit) | 1 match, 3 under unmodelled effects, 17 not covered (10% of her damage covered) |
| Draft kits | **21 covered**, 5 match (both leaps, both slams, the Knock Down at 6324), 16 mismatch |
| Draft kits + G5's fallback (scratch only) | **14 match**, 7 mismatch |

The 14 matches cover all four battle-skill hits (the Heat leap and slam at
the logged weapon and skill levels), the first combo and its Knock Down,
and the basics at 9.4–20.6 s. Some needed the Endministrator's
unlogged crystals talent (+20% Physical DMG taken, the checker's
"unlogged enemy buff" variant: the ×1.2 at 13222 / 14879). Exemplar's
layers in the log fit the kit: one per battle-skill landing (6324: one
listed + one at the boundary; from 8077, two; a third at 24523).

The 7 left:
- t=21935 attack3 (×1.0721) and 23570 attack4 (×1.0777): each is exactly
  +0.16 Physical DMG short (2.22 → 2.38, 2.06 → 2.22). That is
  Æthertech's two damagebuff layers (15 s, refreshed at 8077 by her combo's
  Knock Down, so possibly still on at 21935 but not at 23570) or its
  attackbuff. The log doesn't list them on these hits; an unlogged
  Vulnerable application by Ember is the other reading. Not a kit
  question.
- t=25812 Knock Down (×1.366), t=28603 Knock Down and combo (×1.268
  both): Physical only (the Heat slam at 25812 matches). Candidates are the
  Endministrator's crystals (×1.2) with Æthertech layers the log doesn't
  list (1.2 × 1.066 = 1.279, 0.9% off at 28603) and Pogranichnik's
  `buff_wpn_sword_0012_atk_up`, listed 6–8 times (Chen's report saw the
  same). Unexplained; left to the Pogranichnik and Rossi reports
  (Thermite Cutter) and the batch merge.
- t=30861 finisher (×1.48) and t=33152 finisher (×18.2, 323,160): the
  second belongs to a fight-wide jump after about 33 s (Chen's ultimate
  ×17 at 36117 and the Endministrator's Crush ×4.4 at 33734). Something
  about Rhodagn after 33 s that no kit models; not Ember's.

`zmdlogs reactions`: 2 → **4 matched** with the draft kit (the combo's
Knock Downs at 8077 and 28603). The slam's Knock Downs at 6324 and 25812
stay "unexpected" because of G6.

Fixture corrections: none needed for Ember. Her build fits: the Heat hits
match at the logged levels, and Exemplar's third skill at level 6 gives
the logged 0.2. P1 changes only Protection, so the logged potential can't
be checked from damage. Batch 2's Catcher report said "Ember's kit
(batch 3) will make 7e19 check Æthertech". That now holds, with G5: two
damagebuff layers from her two Knock Downs, and the attackbuff at 4
Vulnerable from 8077.

### Scratch runs (engine)

From a scratch test on the draft kit (P5, Thunderberge, with Catcher):
- **Guard:** attacked at 1 s during a battle skill cast at 0.5 s leaves
  the enemy 10 Stagger lower after the slam than not attacked; attacked
  after f38 makes no difference.
- **Talent 2:** the first layer lasts 7 s. Attacks at 1, 3, 5 and 7.5 s
  give 3 layers on one timer.
- **Ultimate:** `ult_shield` and `p5_atk` on the team for 10 s from f50;
  at P4 no `p5_atk`.
- **Combo and Thunderberge:** the combo opens on the attack and heals the
  controlled operator (combo kind); Thunderberge's shield goes to the
  controlled operator for 15 s.
- **Dodging:** with `dodge: {chance: 1}`, the slam is lost (G1).

### Logs that would verify more

Any ZMDLogs battle with Ember at P5 using her ultimate (`chr_0009_azrila_ultimate_skill`,
and teammates' hits carrying `buff_chr_0009_azrila_ultimate_skill_shield_extraattack`,
which would also show how long the shield lasts against that boss: U2),
with Thunderberge or Former Finery for their buffs, and with talent 2 at
level 2 against a boss that hits her often (two or three
`talent_2_buff` entries on one hit would settle G3).

### In-game tests

The owner doesn't use Ember, so both are low priority, and both are
variants of existing tests:

- **Test 53, Ember variant** (the cleanest form of 53, since her combo
  trigger has no HP condition, unlike Catcher's): another operator
  controlled, Ember in the team with her combo off cooldown. Control: let
  an enemy attack hit the controlled operator; Ember's combo button lights.
  Then perfectly dodge the next attack. Lit means a dodged hit counts as
  "attacked"; not lit means it doesn't (engine).
- **Test 62, Ember variant (G3):** talent 2 at level 2. Let an enemy hit
  Ember once (ATK icon, 1 layer), then again about 4 s later (2 layers),
  then avoid hits. Watch the icon from the first hit: both layers gone at
  about 7 s (they expire with the first), gone at about 11 s (each layer
  restarts the timer: the draft's interim), or down to 1 at about 7 s and
  gone at about 11 s (own timers).

Test 54 (dash cancelling a battle skill) covers what G1 assumes about
dashing.

## Kit plan

Written in the scratch copy
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-chr_0009_azrila/repo/packages/data/kits/{operators/chr_0009_azrila.json,equipment/wpn_claym_000{4,6,7}.json}`)
and **loaded by the real loader** (schema and checks pass; `zmdlogs
check`, `zmdlogs reactions` and a scratch vitest run on them). Nothing
waits on a gap except G1 (dodging), G2 (Catcher's P5 seeing Ember's
shields), G3's interim and Former Finery (G4).

### Operator kit `chr_0009_azrila`

`element: fire`. Skills as kit-draft compiles them (frames, factors,
elements, poise, SP, energy, Knock Downs, team energy at 38), with these
additions.

Buffs:

```json
[
  { "id": "protection", "target": "self", "endsWithCast": true,
    "modifiers": [{ "attr": 63, "value": { "sum": ["shelterrate", "extrashelter"] } }],
    "gameBuff": "buff_chr_0009_azrila_normal_skill_shelter" },
  { "id": "protection_hit", "target": "self", "duration": "extratime",
    "modifiers": [{ "attr": 63, "value": { "sum": ["shelterrate", "extrashelter"] } }],
    "gameBuff": "buff_chr_0009_azrila_normal_skill_shelter" },
  { "id": "guard_listen", "target": "self", "endsWithCast": true, "modifiers": [] },
  { "id": "guard_success", "target": "self", "duration": 2, "endsWithCast": true, "modifiers": [],
    "gameBuff": "buff_chr_0009_azrila_normal_skill_gpsuccess" },
  { "id": "ferric_atk", "target": "self", "duration": { "talent": 1, "key": "duration" },
    "maxStacks": 3, "sharedTimer": true,
    "modifiers": [{ "zone": "atk", "value": { "talent": 1, "key": "attack" } }],
    "gameBuff": "buff_chr_0009_azrila_talent_2_buff" },
  { "id": "ult_shield", "target": "team", "duration": { "key": "duration", "skill": "chr_0009_azrila_ultimate_skill" },
    "modifiers": [], "gameBuff": "buff_chr_0009_azrila_ultimateshield" },
  { "id": "p5_atk", "target": "team", "duration": { "key": "duration", "skill": "chr_0009_azrila_ultimate_skill" },
    "modifiers": [{ "zone": "atk", "value": { "key": "extraattack", "skill": "chr_0009_azrila_ultimate_skill" } }],
    "gameBuff": "buff_chr_0009_azrila_ultimate_skill_shield_extraattack" }
]
```

`shelterrate`, `extrashelter`, `extratime`, `talent1` and `potential_1` are
SkillData blackboard keys (0 by default) that talent 1 and P1 set on both
skills (PotentialTalentEffectTable skillBbModifier), so plain keys work
from either skill. `sharedTimer` on `ferric_atk` is G3's interim; drop it
if the loader takes type 10 from the data.

Triggers:

```json
[
  { "id": "combo_window", "on": { "event": "attacked" }, "by": "controlled", "do": [{ "kind": "openCombo" }] },
  { "id": "ferric", "on": { "event": "attacked" }, "by": "self", "if": { "talentAtLeast": [1, 1] },
    "do": [{ "kind": "buff", "buff": "ferric_atk" }] },
  { "id": "battle_cast", "on": { "event": "cast", "skills": ["chr_0009_azrila_normal_skill"] }, "by": "self",
    "skill": "chr_0009_azrila_normal_skill",
    "do": [{ "kind": "buff", "buff": "protection", "if": { "talentAtLeast": [0, 1] } }, { "kind": "buff", "buff": "guard_listen" }] },
  { "id": "guard_listen_end", "on": { "event": "cast", "skills": ["chr_0009_azrila_normal_skill"] }, "by": "self",
    "delay": 38, "do": [{ "kind": "endBuff", "buff": "guard_listen" }] },
  { "id": "guard", "on": { "event": "attacked" }, "by": "self", "if": { "buffActive": "guard_listen" },
    "do": [{ "kind": "buff", "buff": "guard_success" }] },
  { "id": "combo_cast", "on": { "event": "cast", "skills": ["chr_0009_azrila_combo_skill"] }, "by": "self",
    "skill": "chr_0009_azrila_combo_skill", "if": { "talentAtLeast": [0, 1] },
    "do": [{ "kind": "buff", "buff": "protection" }] }
]
```

Skills (hit by hit):

| Skill | Hit | Frames | Scale | Element | Other |
|---|---|---|---|---|---|
| attack1 / 2 / 3 | hit | 13 / 6 / 18 | atk_scale | physical | event = file |
| attack4 | hit | 26 | atk_scale | physical | `finalStrike`, `poise: poise`, `poiseControlledOnly`, `sp: {if: {controlled: true}, then: atb}` |
| power_attack | hit, hit_2 | 9, 23 | atk_scale | physical | `factor` 0.1, 0.9 |
| plunging_attack_end | hit | 1 | atk_scale | physical | `sp: {if: {controlled}, then: atb}` (0) |
| normal_skill | leap | 10 | atk_scale | (fire) | none |
| normal_skill | slam | 38 | atk_scale2 | (fire) | `applies: [knockdown]`, `poise: {sum: [poise, {if: {buffActive: guard_success}, then: extrapoise, else: 0}]}`, `buffs: [{buff: protection_hit, if: {all: [{talentAtLeast: [0,1]}, {potentialAtLeast: 1}]}}]`; skill `teamEnergy: [{frame: 38, ratio: 1}]`; with G1, skill `noDodge: [0, 38]` |
| combo_skill | hit | 26 | atk_scale | physical | `applies: [knockdown]`, `energy: usp`, `poise`, `heals: controlled`, `buffs: [protection_hit (talent 1 and P1)]` |
| ultimate_skill | hit | 50 | atk_scale | (fire) | `poise`, `buffs: [{buff: ult_shield}, {buff: p5_atk, if: {potentialAtLeast: 5}}]` |

Not modelled (kit `sources` note): damage taken, shield points and heal
amounts; super armour; InterruptAction (E1); hit-stops (Ti1b); P3's
second heal (U1); the dash attack (S5); the unused files of row 34.

An example scenario for the kit: Ember P5 with Thunderberge vs Rhodagn
attacking at 1 and 8 s. A battle skill at 0.5 s (guarded: +10 Stagger, a
talent-2 layer), the combo opened by the same attack, then the ultimate
(team shield, P5 ATK on every teammate), basics, and a second battle skill
at 7 s guarded by the attack at 8 s.

### Equipment kit `wpn_claym_0004` (Exemplar)

```json
{ "equipment": "wpn_claym_0004",
  "buffs": [{ "id": "wpn_claym_0004.phy", "target": "self", "duration": "duration", "maxStacks": "max_stack",
              "modifiers": [{ "attr": 50, "value": "phy_damage_up2" }], "gameBuff": "buff_wpn_claym_0004_phy_damage_up" }],
  "triggers": [{ "id": "wpn_claym_0004.on_hit", "on": { "event": "hit", "kinds": ["battle", "ultimate"], "reaction": false },
                 "by": "self", "skill": "sk_wpn_claym_0004", "cooldown": "cd_duraton",
                 "do": [{ "kind": "buff", "buff": "wpn_claym_0004.phy" }] }] }
```

`cd_duraton` (sic) is the SkillData default 0.1 (no SkillPatchTable row
sets it). The permanent Physical DMG is on the panel.

### Equipment kit `wpn_claym_0006` (Former Finery)

Interim: `sources` only (Treatment Efficiency is on the panel; no trigger
until G4). With G4:

```json
{ "id": "wpn_claym_0006.on_protected_hit", "on": { "event": "attacked" }, "by": "anyone",
  "if": { "eventOperator": { "operatorBuff": { "categories": ["protection"] } } },
  "skill": "sk_wpn_claym_0006", "cooldown": "cd",
  "do": [{ "kind": "heal", "target": "eventOperator" }] }
```

### Equipment kit `wpn_claym_0007` (Thunderberge)

```json
{ "equipment": "wpn_claym_0007",
  "buffs": [{ "id": "wpn_claym_0007.shield", "target": "team", "recipients": { "controlled": true },
              "duration": "duration", "modifiers": [], "gameBuff": "buff_wpn_claym_0007_valid" }],
  "triggers": [{ "id": "wpn_claym_0007.on_combo_heal", "on": { "event": "heal", "kinds": ["combo"] }, "by": "self",
                 "skill": "sk_wpn_claym_0007", "cooldown": "cd",
                 "do": [{ "kind": "buff", "buff": "wpn_claym_0007.shield" }] }] }
```

No damage effect today; with G2 its shield counts for Catcher's P5.

## Kit (2026-10-21)

Files: [packages/data/kits/operators/chr_0009_azrila.json](../../../packages/data/kits/operators/chr_0009_azrila.json),
equipment `wpn_claym_0004` (Exemplar), `wpn_claym_0006` (Former Finery),
`wpn_claym_0007` (Thunderberge) in packages/data/kits/equipment/, tests
[tests/kit-ember.test.ts](../../../tests/kit-ember.test.ts), example
[examples/ember-guard.scenario.json](../../../examples/ember-guard.scenario.json)
(build `ember-p5.json`, with Catcher). Started from a fresh `efsim
kit-draft chr_0009_azrila`, which now also emits the combo's `heals:
controlled` and the guard's poise-only landing. No engine, loader or
compiler code changed.

### Re-analysis

| Item | Now | How |
|---|---|---|
| G1 dodge policy and the guard | **done** | batch-4 S12: battle skill `noDodge: [0, 38]` (the listener's clip). With dodging on she tanks an attack in frames 0–37 and the slam lands; at 38+ she dashes (test) |
| G2 a shield from anyone | **done** in engine and loader (C2; the loader adds the `shield` category from the tag) | `ult_shield` and `wpn_claym_0007.shield` are shield-category buffs (test). **Open outside this kit:** Catcher's P5 still reads `buffActive: combo_shield` in her kit; `sp: {if: {operatorBuff: {categories: [shield]}}, then: potential5_atb}` would let Ember's shields count (Catcher's kit, not edited here) |
| G3 stackingType 10 | **done** (B3) | the loader sets `sharedTimer` for type 10; the draft's hand-written one is dropped (test checks the loaded buff). Still a claim: test 62 (Ember variant) decides |
| G4 "a Protected operator takes DMG" | **done** (C2) | Former Finery: `attacked` `by: anyone`, `if: {eventOperator: {operatorBuff: {categories: [protection]}}}`, `cooldown: cd`, heal `eventOperator` |
| G5 checker layers of Æthertech | **done** (L2) | 7e19: 14 of 21 match (below) |
| G6 reactions and two hits under one key | **done** (L1) | 7e19: all four Knock Downs match |
| G7a heals | **done** (D8d) | kit-draft emits `heals: controlled` on the combo |
| G7b child buff's target | **done** enough (D10c) | kit-draft now says the shield's child buff goes to the team; the kit puts `p5_atk` on the team |
| G7c P1's shelter at 38 / 26 | **open** (compiler, D10e) | still not reported by kit-draft; hand-written (`protection_hit` on the slam and the combo hit) |
| G7d guard poise | **done** (D6), condition hand-written | kit-draft emits a poise-only landing `extrapoise` "lands always"; the kit adds `if: {buffActive: guard_success}` |
| Row 4 dive attack | **waits on S10** | hit written from the data (mask 1152); rotations can't dive yet, so it never fires in scenarios; nothing dive-triggered in this kit |
| Row 5 dash attack | **open** (batch-3 S5, deferred) | left out |
| Row 15 InterruptAction | **open** (batch-3 E1, deferred) | not modelled |
| Row 25 P3's second heal (U1) | **interim** | no event (HP isn't tracked, N2) |
| Rows 27–28 shield points, P5 ATK lasting (U2) | **interim** | full 10 s; points not modelled |
| Row 31 hit-stops | **open** (Ti1b) | not modelled |
| Row 32 perfect dodge as "attacked" (U3) | **unknown** | engine: no; test 53 (Ember variant) |
| Row 33 combo trigger during cooldown | **open** (batch-3 T5) | ignored, as for everyone |

New in this pass (data re-read): talent 1's frame-0 shelter is created
with `autoFinishByAction` inside a clip of [0–38] (battle skill) and
[0–26] (combo), so Protection ends at those frames, not with the cast
as the draft's `endsWithCast` had it. The kit keeps `endsWithCast` (a cut
cast ends it) and ends it at 38 / 26 with delayed `endBuff` triggers
(`guard_listen_end`, `protection_end_combo`), like the listener. No damage
effect (Protection only matters for categories and Former Finery). For
comparison, reference/zero-sanity-timeline gives 1.7 s + 1.5 s on a hit
at P1; the data's clip says 38 frames + `extratime` from the slam (to
frame 83). P1's second shelter has `finishWithNextSkillIfNotInherited`
(may end at her next skill): not modelled.

### What the kit models

- Basics 1–4 (Physical; attack 4 Final Strike, 25 Stagger and 28 SP
  when controlled), finisher (0.1 / 0.9), dive (Physical, 0 SP).
- Battle skill: leap (f10) and slam (f38: Heat, Knock Down, 10
  Stagger, team energy); the guard: a listener buff [0–38] → on an enemy
  attack on Ember, `guard_success` (gameBuff `…_gpsuccess`, 2 s), read by
  the poise-only landing `slam_guard` (`extrapoise` 10); `noDodge`.
- Combo: window when the controlled operator is attacked; f26 hit
  (Physical, Knock Down, 10 Stagger, `usp`), heal of the controlled
  operator (combo kind).
- Ultimate: f50 hit (Heat, 25 Stagger), team `ult_shield` (10 s, shield
  category from the tag), P5 `p5_atk` (ATK +10% to each holder, same
  10 s).
- Talent 1: Protection (attribute 63, `shelterrate + extrashelter`) in
  the two clips; P1's 1.5 s Protection after the slam / combo hit.
  Talent 2: `ferric_atk` per enemy hit on Ember (ATK +6 / 9%, 7 s, 3
  layers, one timer from the loader).
- P2 (stats), P4 (energy cost × 0.85) from the loader.
- Exemplar: a Physical DMG layer per battle-skill / ultimate landing
  (0.1 s cooldown, 3 layers, own timers). Former Finery: a heal event on
  a Protected attacked operator, once per `cd`. Thunderberge: on the
  wielder's combo heal, a shield buff on the controlled operator for
  `duration`, once per `cd`.

Left out: damage taken, shield points, heal amounts, super armour,
InterruptAction, hit-stops, P3's second heal, the dash attack, the
unused files of row 34 (kit `sources`).

### Verification

**Log fixtures/pending/zmdlogs-7e19489ae503.json** (`zmdlogs check`):
Ember 21 hits, **14 match, 7 mismatch**, 100% of her damage covered
(before the kit: 2 match, 17 not covered). The matches use the kit's
leap and slam (both battle skills), Æthertech's two damagebuff layers
(L2) and the Endministrator's unlogged crystals. The 7 left are the
analysis's, unchanged: t=21935 attack3 (×1.0721) and 23570 attack4
(×1.0777), each +0.16 Physical DMG short (Æthertech layers the log
doesn't list, or an unlogged Vulnerable application); t=25812 Knock Down
(×1.366), 28603 Knock Down and combo (×1.268 both): Physical-only
excesses with no kit or log candidate here (the Endministrator's crystals
× unlisted Æthertech layers come within 0.9% at 28603; Pogranichnik's
`buff_wpn_sword_0012_atk_up` listings are the other lead); t=30861 and
33152 finishers (×1.48, ×18.2), part of the fight-wide jump after about
33 s that no kit explains. No other operator's line changed.

`zmdlogs reactions`: **6 matched** (was 2), 2 predicted but not logged,
1 logged but not predicted (was 5): all four of Ember's Knock Downs
(6324, 8077, 25812, 28603) match. Her Vulnerable stacks now enter the
replay, so the "other" lines show Chen's at 7335 and 25479 ms one stack
higher (3, 4) and Ember's own (2, 4, 4, 4); nothing else changed.

Fixture notes: batch-4.md's proposed note for 7e19 isn't applied here
(the fixture is shared with Pogranichnik's kit agent; the build needs no
correction).

**Example** (`efsim simulate examples/ember-guard.scenario.json`):
96,095 damage in 15.07 s, 6,378 DPS, Ember alone dealing damage. Both
battle skills are attacked inside the listener (the 8 s attack lands at
9.93 s after the combo's slow-down and the ultimate's time stop); each
slam deals 20 Stagger; the combo cuts the battle skill at the slam
(frame 38, its first combo window) and lands at 2.63 s; the ultimate at
4.30 s. The slam (3.17 × ATK) hits 7,345, the combo 7,775 plus its Knock
Down 9,889, the ultimate 15,061, consistent with the report's
multipliers and her ~4,200–4,900 ATK (talent 2 and P5 layers).

**Totals unchanged:** every other `examples/*.scenario.json` total and
every other fixture's `zmdlogs check` / `reactions` output is identical
before and after the kit (only 7e19's Ember lines and the Vulnerable
counts above changed).

**Tests** (tests/kit-ember.test.ts): leap / slam frames and elements,
Stagger with and without the guard (attacked at frame 20 vs 45), the
listener's end, `noDodge` with dodging on, talent 1's Protection window
and P1's extension (P0 and talent 0 without), the combo's window, frame,
Stagger, energy and Protection, talent 2's three layers on one timer,
the ultimate's shield (category) and P5 ATK (none at P4), Exemplar's two
layers per battle skill on a later basic, Former Finery's heal (only
while Protected, once per cooldown), Thunderberge's shield on the
controlled operator. skillCompile: one KNOWN entry (the poise-only
`slam_guard` has no scale key, which that test matches by).

### In-game tests the kit depends on

- **Test 62, Ember variant** (batch-4.md, "Layers on one timer"):
  talent 2's layers share one refreshed timer (the loader's B3 reading).
- **Test 53, Ember variant**: a perfectly dodged attack doesn't count as
  "attacked" (engine), so no combo window, layer or guard.
Both low priority (the owner doesn't use Ember).
