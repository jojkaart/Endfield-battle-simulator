# Gilberta (chr_0013_aglina): gap report, batch 1

Phase 1 (analysis only). Weapons: Pursuit `wpn_funnel_0011` (6★), Twilight
`wpn_funnel_0005` (5★). Gear set: `suit_phy01` (3 pieces,
`passive_equipsuit_physuit_01`).

Sources read: CharGrowthTable `chr_0013_aglina` (skill groups, talent
nodes, profession 4 = Supporter), CharacterPotentialTable,
PotentialTalentEffectTable `chr_0013_aglina_talent_*` / `_potential_*`,
SkillPatchTable, I18nTextTable_EN, every `Json/SkillData/chr_0013_aglina_*`
and `Json/BuffData/buff_chr_0013_aglina_*` file, the weapon and set skills
and buffs, and fixtures 40d9a3c1da37, 4e5e1390085e, d9e59d0fb737. The
current kit's notes count as claims; where they're used below they were
re-checked against the data (file and key given) or the logs.

Statuses: **supported** = can be expressed today (and the kit does, or
could without engine work); **data** = expressible, but hand-written though
the data has it; **gap**; **unique?**; **unknown**.

## Action types per file

Cosmetic, targeting and input actions are left out (Effect, Sound, Camera,
FindTarget, Selector, EnemyHurtAnim, PushBack, ComboCache, ReceiveMoveInput,
SnapToTarget, …). **D** = affects damage, **R** = resources (SP, energy),
**S** = state (buffs, statuses, modes), **T** = timing / legality.

| File | Action types | Effect |
|---|---|---|
| attack1–3 | LaunchProjectile (projhit skill, assignBlackboard), AllowNextSkillAction, CheckMainCharacterCondition, CheckEntityNum | D (via projhit), T |
| attack1–3_projhit, attack4_projhit(_2) | DamageAction (atk_scale, mask 128; attack4_projhit mask 2097280 = Final Strike), ObtainCostAction costType 1 `atb` (×0.3334 on attack4's three projectiles, only as controlled operator, ≥1 target) | D, R |
| attack4 | LaunchProjectile ×3 (frames 23, 25, 27), CheckSquadInFight, AllowNextSkillAction | D, T |
| normal_skill | SpawnAbilityEntity (frame 21), DamageAction ×4 `atk_scale_pull` (29, 46, 62, 78, mask 256), CreateBuffAction `buff_common_obtain_ultimate_sp` (frame 29; ObtainUspInNormalSkill), InterruptAction + **SpellInfliction type 3 (isEnable true)** + DamageAction AtkScaleCalculation `atk_scale_explosion` (108, mask 4352), HealAction (talent 2), ChannelingCastingAction 0–111 (cantCastSkill, cantSwitchPosition), ModifyDynamicBlackboard (`radius` by `potential`), AllowNextSkillAction 123 (combo only); exclusiveFrame 135 | D, R, T |
| normal_skill_abilityrange | ChannelingAction → PullAction, CreateBuffAction monitor | none (pull) |
| combo_skill | AirborneAction forceAirborne, DamageAction `atk_scale` (48, mask 12288), ObtainCostAction costType 0 `usp` (48), HealAction (talent 2), TimeDilationAction 0–15 (0.6 s), AllowNextSkillAction 53 (battle, ultimate); exclusiveFrame 72 | D, R, S, T |
| ultimate_skill | UltimateTimeAction + UltimateShowAction 0–52, TimeDilationAction 0–3, InterruptAction + **SpellInfliction type 3 (isEnable true)** + DamageAction `atk_scale` (60, mask 4608), SpawnAbilityEntity field (60, duration `duration`), StoreAttributeValue (feeds nothing, see orphans), CreateBuffAction damage immunity, AllowNextSkillAction 64 (battle, combo); exclusiveFrame 85 | D, S, T |
| ultimate_skill_abilityrange | AuraAction → buff_chr_0013_aglina_ultimate_skill | S |
| buff_…_ultimate_skill | SaveBuffStackNumAdvanced / CheckBuffStackNumAdvanced (Vulnerability tag 1075718177), ModifyDynamicBlackboard chain → FinalRate, CompareFloat `potential2`, CreateBuffAction spell_vulnerable, SlowAction | D, S |
| buff_…_ultimate_spell_vulnerable | VulnerableAction (→ buff_common_affixes_vulnerable_spell, attrs 71–74) | D |
| power_attack | DamageAction ×7 BreakingAttackCalculation (`atk_scale` × 0.05 ×6, × 0.7; mask 132), GainBreakingAttackAtb, CreateBuffAction (immunity, disable cast) | D, R, T |
| plunging_attack_end | DamageAction `atk_scale` (mask 1152), ObtainCostAction `atb` | D, R |
| dash_attack(_projhit) | FinishBuffAction, DamageAction (mask 131200), ObtainCostAction | D, R |
| talent_0 → buff_…_talent_0 → _effectbuff → _effectbuff_Add | AuraAction (shape 0, all allies), CheckProfession (mask 49), attribute 44 formulaItem 5 `add` | R |
| talent_1, buff_…_talent_1(_heal) | HealAction | none |
| Orphans (nothing references them; grep over Json/ and TableCfg/): potential_5 + buff_…_potential_5(_dmgup, _taken_damage), buff_…_damage_taken_scale(_talent0), buff_…_ultimate_skill_grounded/_inair, extra_attack(+projhit, buff), buff_…_normal_skill, passive | DamageScaleProcessor, SwitchModeAction, FinishBuffAction, PullAction | none in play |
| sk_wpn_funnel_0011 | cardAttributeModifier attr 54 formulaItem 0 `nature_dmg_up`; passiveEventActions (abilityEvent 30) CheckSkillType [6] → CreateBuffAction buff_wpn_funnel_0011; toggleBuffs buff_wpn_lance_0003 (CheckCurHpRatio) | D |
| buff_wpn_funnel_0011 | abilityEvent 402: CheckSkillCastId, CheckPhysicalInflictionType mask 1, CheckOriginSkillType [6], CheckTargetContains/MergeTarget/CheckEntityNum (count targets), CompareFloat vs `max_stack`, SimpleCalcBBAction + ModifyDynamicBlackboard (`spell_dmg_up` + count × `spell_dmg_up2`), CreateBuffAction _valid on CharacterTeamFinder | D, S |
| buff_wpn_funnel_0011_valid | attrs 51–54 formulaItem 5 `spell_dmg_up`; stackingType 1, priority `spell_dmg_up` | D |
| sk_wpn_funnel_0005 | cardAttributeModifier attr 1 (HP%); passiveEventActions (abilityEvent 30) CheckSkillType [7] → SaveCharTypeId, ForEach team (ExcludeOwner), CompareString (NotNext) → CreateBuffAction _atk_up; toggleBuffs buff_wpn_passive_spirit_01 | D, S |
| buff_wpn_funnel_0005_atk_up | attr 2 formulaItem 6 `atk_up`; stackingType 1, priority `lv` | D |
| passive_equipsuit_physuit_01 | cardAttributeModifier attr 26 `poise_up`; buffs: buff_equipsuit_physuit_01 | (stagger) |
| buff_equipsuit_physuit_01 | abilityEvent 102: CheckBuffIdInContext (tag −6380412), CheckGlobalCDTimerAction, DamageAction (`atk_scale`, damageType 0 physical, mask 0, poise), AddGlobalCDTimer `duration` | D |

## Mechanics

### Operator

| # | Mechanic (source) | Status | How expressed / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: 1/2/3/3 projectile hits, `atk_scale` of the parent skill (LaunchProjectile assignBlackboard; projhit DamageAction) | supported | `hits[].scale`, `count`; verified exact in 40d9 (9 hits) and 4e5e (40 + 12 hits) per the kit's notes; `zmdlogs check` today: 4e5e 42 match / 0 mismatch, 40d9 9 / 0 |
| 2 | Hit frames, log event keys (`*_projhit`), locks, combo `usp` grant (LaunchProjectile / DamageAction frames, ObtainCostAction) | data | hand-written in the kit (`frames`, `events`, `durationFrames`, `energy`); `kit-draft` emits none of them; the engine already takes locks from SkillData |
| 3 | Final Strike = centre orb only (attack4_projhit mask 2097280) | supported | loader reads the mask bit |
| 4 | Basic-attack SP: attack4 `atb` 16, each of the three projectiles gives ×0.3334 (attack4_projhit ObtainCostAction coefficient), only as controlled operator | supported | engine adds 16 at the first hit; total equal (16.003), 2/3 of it 2–4 frames early |
| 5 | Projectile travel time (LaunchProjectile; arrival not in the data) | gap | timing; hits land at launch frame |
| 6 | Stagger from every hit (`poise` keys; Final Strike "also deals {poise} Stagger") | gap | stagger meter not modelled (physical state) |
| 7 | Finisher (power_attack): `atk_scale` × 0.05 ×6 + × 0.7 (BreakingAttackCalculation `multiplier`), only near a Staggered enemy, GainBreakingAttackAtb ("recovers some SP") | gap | factors expressible with `factor`; needs the Staggered state, the finisher precondition and its SP gain |
| 8 | Dive attack (plunging_attack_end, `atk_scale`, mask 1152) | supported (damage) / gap (legality) | hit is in the kit, unverified (no logged plunge); it's castable at any time, though it needs a jump |
| 9 | Dash attack (dash_attack_projhit, mask 131200) | unknown | not in CharGrowthTable skill groups, so the loader has no skill level for it; whether rotations need it is open |
| 10 | Battle skill: 100 SP (SkillPatchTable costType 1) | supported | loader |
| 11 | Battle skill: 4 pulls `atk_scale_pull` at 29/46/62/78 | supported | kit hits; 4e5e pulls exact ×1.0960 (annotated Camille ATK) |
| 12 | Battle skill explosion `atk_scale_explosion` + Nature Infliction before its damage ("implodes to deal Nature DMG and Nature Infliction"; SpellInfliction listed before DamageAction, isEnable true) | data | kit `applies`; the SpellInfliction is enabled in her files (unlike Laevatain's mostly disabled ones), so it can be compiled |
| 13 | Corrosion triggered by her explosion counts for the explosion (4e5e 68873: ×1.0513 from Corrosion I shred) | supported | status.ts applies first |
| 14 | Team ultimate energy from the battle skill's SP: given at frame 29 (CreateBuffAction buff_common_obtain_ultimate_sp → ObtainUspInNormalSkill), not at the cast | gap | engine gives 0.065/SP at the cast; ~1 s early |
| 15 | Battle-skill channeling (ChannelingCastingAction 0–111: cantCastSkill, cantSwitchPosition) and cancel window at 123 allowing only her combo (exclusiveFrame 135) | gap | engine uses the first AllowNextSkillAction frame (123) for every next action, ignoring `allowedSkillIdList`; what cantCastSkill blocks (her own or the team's skills) is unknown |
| 16 | Combo trigger: "When an Arts Reaction is applied to an enemy" (CharGrowthTable) incl. forced reactions | supported | `comboTriggers: [{any: [{on: reaction}]}]`; forced: d9e5 Li Zhiyan's forced Corrosion at 6098 ms, her combo at 11727 (5.6 s later, no other reaction logged in between); normal: 4e5e Solidification 5776 → combo 7598 |
| 17 | Combo opened by a reaction her own non-combo hit causes | unknown | engine allows it (only own combo hits are excluded); not seen in a log |
| 18 | Combo hit `atk_scale` at 48, `usp` 10 energy | supported | kit; 4e5e combos match with the weapon's buff applied (row W3) |
| 19 | Combo cooldown 20 s (19 s at level 12); P5 −2 s | supported | SkillPatchTable coolDown; P5 skillParamModifier paramType 2 (loader) |
| 20 | Combo forced Lift (AirborneAction forceAirborne; "forcibly Lifts") and its Physical hit (logged `buff_physical_airborne`: 6231 next to a 9646 combo in 4e5e 7598, 10505 next to 22001 in d9e5 11727) | gap | physical state; Lift also feeds rows 25, W3, G2 |
| 21 | Combo time dilation (TimeDilationAction 0–15, 0.6 s, curve ComboSkill) | gap | timing (time dilation); effect on others' timers not measured |
| 22 | Ultimate: 90 energy, cooldown 20 s, P4 cost ×0.85 | supported | loader |
| 23 | Ultimate hit `atk_scale` at 60 + Nature Infliction before damage | data | kit `applies`; SpellInfliction enabled in the file |
| 24 | Ultimate time stop (UltimateTimeAction 0–52; TimeDilationAction 0–3) | gap | timing; others' buffs and statuses should pause ~1.7 s (40d9: her Arts Susceptibility seen 12951–18009 ms, 5.06 s) |
| 25 | Arts Susceptibility from the field: FinalRate = `spell_vulnerable_rate` × (1 + n × `spell_vulnerable_perstack`), n = target's Vulnerability stacks (buff_chr_0013_aglina_ultimate_skill: SaveBuffStackNumAdvanced tag 1075718177, ModifyDynamicBlackboard chain) | supported for n = 0 / gap for n | kit buff `arts_susceptibility`; n needs the enemy's Vulnerability stacks (physical state). 4e5e (P0, level 12) logs 0.36 = n 2 after the Lifts at 54882 and 55403 ms |
| 26 | P2: with `potential2` = 1, n → n + 1 when n < 3 (literal 1, not `potential2_onceadd`), then ×2 ("double ... treated as having 1 additional stack") | supported for n = 0 (kit not updated) | ValueExpr can already say it: `{product: ["spell_vulnerable_rate", {sum: [1, {product: [2, "spell_vulnerable_perstack", {key: "potential2"}]}]}]}`. The kit uses plain `spell_vulnerable_rate`, so it's 0.30 where 40d9 (P3, level 10) logs 0.36: **kit wrong for P2+**. Earlier kit note says products can't be expressed: outdated |
| 27 | Arts Susceptibility lasts while the enemy is in the field: field `duration` 5 s from frame 60 (SpawnAbilityEntity duration key), applied after the hit's own damage | supported | kit buff, 5 s, applied after damage (log: starts at the hit and isn't in it) |
| 28 | Several sources of buff_common_affixes_vulnerable_spell (e.g. Liino's) | unknown | stackingType 0 with priority key `rate`: by buffData.ts's evidence (vulnerable_crystal, b7b3762d5da8) type 0 adds up, so the kit's own claim ("strongest counts") is contradicted; not checked for the spell variant |
| 29 | "If a target in the field is Lifted, the Lifted status will persist until the field wears off" | gap | physical state |
| 30 | Slow, Immobilize (InterruptAction), pull, damage immunity | supported | no damage or resource effect |
| 31 | Talent 1 Messenger's Song: "all allied guards, casters, and supporters gain Ultimate Gain Efficiency +{add}" (+4% / +7%; P3 +5%) | gap | needs a team attribute buff (attr 44, formulaItem 5) for the whole fight, a recipient filter (CheckProfession mask 49 = Guard 0, Supporter 4, Caster 5; CharProfessionTable), and compiling a talent that attaches a skill (modifyType 1; the loader reads no modifyType 1). She is a Supporter, so her own gain is missing too |
| 32 | Talent 2: heal on hitting ≥ 2 enemies (combo, last battle-skill hit) | supported | no damage or resource effect (healing isn't simulated) |
| 33 | P1: battle-skill radius 5.2 → 6.3 (`potential` only sets `radius` and VFX) | supported | no single-target effect |
| 34 | P5: combo `atk_scale` ×1.3 (skillBbModifier modifyType 2) | supported | loader |
| 35 | Link: a teammate's combo boosts her next battle skill / ultimate (40d9 ultimate exactly ×1.2000 with 1 stack, per that fixture's annotation); her combo gives Link to teammates | gap | shared team mechanic, not hers; values (skill setting 连击增伤) not in the fetched tables |
| 36 | d9e5 ultimate needs ×1.2689 under Li Zhiyan's forced Corrosion, no Link logged | unknown | kit note's claim, re-run: `zmdlogs check` d9e5 0 match / 7 under unmodelled effects; unexplained |
| 37 | Orphaned data: potential_5 skill and buffs, damage_taken_scale buffs, ultimate grounded/inair resistance buffs (+ StoreAttributeValue), extra_attack mode, `recovercost`, `damage_taken_scale` / `potential_lv` keys | supported | nothing creates them (grep over Json/ and TableCfg/); no effect |

### Weapons (wielder-relative)

| # | Mechanic (source) | Status | How expressed / what's missing |
|---|---|---|---|
| W1 | Pursuit: Will +156, Ultimate Gain Efficiency +46.4% (wpn_attr_will_high, wpn_sp_attr_usgs_high) | supported | stat panel; the timeline reads attr 44 |
| W2 | Pursuit: Nature DMG +{nature_dmg_up} (cardAttributeModifier attr 54, formulaItem 0) | supported | stat panel (slot 0 read as add, "unverified" in model.ts); consistent with 4e5e (skill 3 level 4, 0.256): 42 of her hits match |
| W3 | Pursuit: "After the wielder's combo skill applies Lifted, the team gains Arts DMG Dealt +{spell_dmg_up} for {duration}s. For every enemy Lifted, ... +{spell_dmg_up2}, up to ... max_stack" (buff_wpn_funnel_0011: on the wielder's combo hit with physical infliction type 1, count of distinct targets ≤ `max_stack` 3; value `spell_dmg_up` + count × `spell_dmg_up2`; buff_wpn_funnel_0011_valid on the whole team incl. the wielder: attrs 51–54, 15 s, stackingType 1 priority `spell_dmg_up`) | gap | triggers (wielder's own combo hit applying a physical status), physical state (the Lift event), values (weapon skill keys and the target count in a ValueExpr), a team buff from a weapon. Order: before the triggering hit's damage (4e5e 7598, 30327, 55403: combo matches with the 0.248 buff applied; 0.248 = 0.192 + 1 × 0.056 at level 4) |
| W4 | Pursuit toggleBuffs: buff_wpn_lance_0003 (CheckCurHpRatio `hp_ratio`, ATK% `atk_up`) | supported | no effect: neither key is in sk_wpn_funnel_0011's blackboard and no fixture logs that buff |
| W5 | Twilight: Intellect +124, ATK +31.2%, Max HP +28% (wpn_attr_wisd_mid, wpn_sp_attr_atk_mid, cardAttributeModifier attr 1) | supported | stat panel |
| W6 | Twilight: "When the wielder casts an ultimate, operators whose elements differ from the wielder gain ATK +{atk_up} for {duration}s" (abilityEvent 30, CheckSkillType [7]; teammates excluding the wielder whose charTypeId differs; buff_wpn_funnel_0005_atk_up attr 2 formulaItem 6, 20 s, stackingType 1 priority `lv`) | gap | triggers (wielder's own cast of an ultimate), team buff with a recipient filter (element ≠ wielder's), weapon skill values. At the cast: 40d9 Laevatain's hit at 11110 ms already has +22.4%, before Gilberta's ultimate hit at 12951; Laevatain, Camille and Si (Heat, Heat, Cryo) all get it, Gilberta not |
| W7 | Twilight toggleBuffs: buff_wpn_passive_spirit_01 with `atk_up` | unknown | that BuffData file isn't in the checkout; nothing logged in 40d9, so probably inert |

### Gear set suit_phy01 (3 pieces)

| # | Mechanic (source) | Status | How expressed / what's missing |
|---|---|---|---|
| S1 | "Wearer's Stagger Efficiency Bonus +20%" (cardAttributeModifier attr 26) | supported (inert) | in the panel; nothing uses it until stagger exists (row 6) |
| S2 | "After the wearer applies a Physical Status, the wearer also performs 1 hit that deals {atk_scale} ATK of Physical DMG and [{poise} Stagger]. Effect trigger cooldown: {duration}s" (buff_equipsuit_physuit_01: abilityEvent 102, tag −6380412, DamageAction `atk_scale` 2.5 damageType 0 mask 0, AddGlobalCDTimer `duration` 15 s per wearer) | gap | triggers (on the wearer's own physical-status application, with a cooldown), a triggered hit (own scale key from the set skill, Physical, no skill kind), physical state. d9e5 11727: proc 7907 at her combo's Lift (36% of that combo's 22001); its implied scale (3.38 against 2.5) isn't explained yet |

## Gaps

**G1. Physical statuses: Lift, its hit, Vulnerability stacks** (rows 20, 25,
29; feeds W3, S2).
- family: physical state
- feature: a physical-status state machine beside status.ts: `applies:
  {kind: "physicalStatus", status: "lift", forced: true}` on a hit; the Lift
  hit (Physical, logged `buff_physical_airborne`) and a Vulnerability stack;
  status events (`physicalStatusApplied`, with applier and status) that
  triggers can listen to; the enemy's Vulnerability stack count readable by
  predicates and values; a buff that extends an active Lift while it lasts
  (row 29).
- evidence: combo_skill AirborneAction `forceAirborne: true` (frame 48);
  description "forcibly Lifts"; ultimate "Lifted status will persist until
  the field wears off"; 4e5e 7598 / 30327 / 55403, d9e5 11727.
- impact: her combo's Lift hit is missing (6231 vs 9646, 10505 vs 22001:
  +48–65% on each combo); downstream, the ultimate's Arts Susceptibility
  per stack, Pursuit's team buff and the set proc have nothing to fire on.
  Large, many operators: owner decision.

**G2. Vulnerability stacks in Arts Susceptibility** (rows 25–26).
- family: values (needs G1)
- feature: a ValueExpr term `{enemyStacks: "vulnerability"}` (the target's
  Vulnerability count), evaluated when the buff is applied (the field's aura
  computes FinalRate once, on entering). With it, P2 is `if n < 3 then n + 1`,
  then ×2 (an `if` on a comparison, or `min(n + 1, max(n, 3))`; whether n = 3
  becomes 4 depends on CompareFloat `compare: 1`, unknown).
- evidence: buff_chr_0013_aglina_ultimate_skill (SaveBuffStackNumAdvanced
  tag 1075718177, ModifyDynamicBlackboard chain); SkillPatchTable
  `spell_vulnerable_perstack` 0.1, `spell_vulnerable_4stack` 0.42 (= 0.30 ×
  1.4); 4e5e P0 logs 0.36 (n = 2).
- impact: Arts Susceptibility 0.30 instead of up to 0.42 (0.54 with P2) in a
  physical team; teammates' Arts damage −8 to −16%.

**G3. Team attribute buffs with a recipient filter** (rows 31, W6).
- family: buff lifecycle (attribute buffs) + conditions
- feature: kit / weapon buffs on panel attributes (Ultimate Gain
  Efficiency, ATK%) that the timeline's energy gain and ATK read per
  recipient; a `recipient` predicate on a team buff, evaluated per team
  member: profession in a set (Messenger's Song: CheckProfession mask 49),
  element differs from the source's (Twilight: CompareString of
  charTypeId), excluding the source. Permanent (talent aura) or timed
  (Twilight, 20 s). Needs operator profession in OperatorData (the table
  loader already reads it, packages/data/src/tables/operators.ts).
- evidence: buff_chr_0013_aglina_talent_0_effectbuff(_Add); sk_wpn_funnel_0005
  passiveEventActions; 40d9 buff_wpn_funnel_0005_atk_up on Laevatain, Camille,
  Si.
- impact: Messenger's Song: Guard / Supporter / Caster teammates (and
  Gilberta) charge their ultimates 4–12% slower than in the game; Twilight:
  teammates' ATK +22.4% missing for 20 s per ultimate.

**G4. Wielder-relative weapon and gear-set triggers** (W3, W6, S2).
- family: triggers
- feature: weapon and gear-set kits get the same `triggers` list as
  operators, scoped to the wielder: `on` the wielder's cast of a skill kind
  (Twilight: ultimate, at the cast), the wielder's hit of a skill kind that
  applies a physical status (Pursuit: combo + Lift, before that hit's
  damage), the wielder applying any physical status (set, with
  `cooldown: duration` per wielder); `do`: apply a buff (team or filtered
  team, G3), or land a hit (G6). Weapon kits today hold only always-on
  `conditions` (schemas/weapon-kits.schema.json), and gear sets have no kit
  at all.
- evidence: abilityEvent 30 + CheckSkillType [6] / [7]; buff_wpn_funnel_0011
  abilityEvent 402 + CheckPhysicalInflictionType; buff_equipsuit_physuit_01
  abilityEvent 102 + Check/AddGlobalCDTimer.
- impact: Pursuit's +24.8–43.4% Arts DMG for the whole team for 15 s per
  combo, Twilight's ATK and the set's proc are all missing, so the weapons
  can't be compared at all.

**G5. Weapon / gear-set skill values and target counts in ValueExpr** (W3,
W6, S2).
- family: values
- feature: a ValueExpr key that names the wielder's weapon skill (at its
  skill level) or gear-set skill, e.g. `{weaponKey: "spell_dmg_up"}`; and an
  event count "targets the triggering hit affected" (Pursuit: `count`,
  capped by `max_stack`; 1 against one enemy). Today `skillValue` throws for
  skills outside the operator's skill groups.
- evidence: buff_wpn_funnel_0011 SimpleCalcBBAction `spell_dmg_up_final` =
  `count` × `spell_dmg_up2` + `spell_dmg_up`; 4e5e 0.248 = 0.192 + 0.056.
- impact: needed by every weapon whose buff value is a sum or a scaled key.

**G6. Triggered hits** (S2).
- family: triggers (do: hit)
- feature: a trigger action that lands a hit with its own scale key (from
  the set skill's blackboard), element Physical, no skill kind (mask 0, so
  no skill-type bonuses), its own log event key (`buff_equipsuit_physuit_01`)
  and poise.
- evidence: buff_equipsuit_physuit_01 DamageAction; d9e5 11727 (7907).
- impact: 2.5× ATK Physical up to once per 15 s, about a third of her combo.

**G7. Battle-skill team energy at its data frame** (row 14).
- family: data compilation (timing)
- feature: give the 0.065 / natural SP energy when
  `buff_common_obtain_ultimate_sp` is created (normal_skill frame 29), not
  at the cast; compile its frame from SkillData. Shared: chr_0021_whiten,
  chr_0016_laevat and others create the same buff.
- evidence: chr_0013_aglina_normal_skill frame 29 CreateBuffAction;
  BuffData buff_common_obtain_ultimate_sp (ObtainUspInNormalSkill).
- impact: 1 s early energy each battle skill; can move an ultimate one
  action earlier.

**G8. Cancel windows by next skill** (row 15).
- family: timing (skills)
- feature: read `allowedSkillIdList` of each AllowNextSkillAction; the lock
  for a next action is the first window that lists it, else exclusiveFrame.
  Battle skill: combo at 123, everything else 135; combo: battle / ultimate
  at 53, others 72; ultimate: battle / combo at 64, others 85.
- evidence: AllowNextSkillAction entries in normal_skill, combo_skill,
  ultimate_skill; packages/data/src/skillData.ts takes the minimum frame of
  any window.
- impact: her next basic attack after a battle skill, combo or ultimate can
  start 12–21 frames (0.4–0.7 s) too early.

**G9. Time dilation and ultimate time stop** (rows 21, 24).
- family: timing
- feature: UltimateTimeAction freezes the other operators', buffs' and
  statuses' clocks for its frames (0–52); TimeDilationAction slows time for
  its duration per its curve.
- evidence: ultimate_skill UltimateTimeAction 0–52, TimeDilationAction 0–3;
  combo_skill TimeDilationAction 0–15.
- impact: buffs and statuses expire ~1.7 s early per ultimate in the
  window; the effect of the combo's 0.6 s dilation is unmeasured.

**G10. Stagger and the finisher** (rows 6, 7, S1).
- family: physical state
- feature: a stagger meter fed by each hit's `poise` × Stagger Efficiency
  (attr 26), the Staggered state (already a damage option), a finisher
  skill available only while Staggered (power_attack: `factor` 0.05 ×6,
  0.7), and its SP gain (GainBreakingAttackAtb).
- evidence: power_attack DamageActions and GainBreakingAttackAtb;
  description "Basic attack performed near a Staggered enemy becomes a
  finisher"; scratchpad zmdlogs-576da29ffa7a (2510 ×5, 35135: 0.05 / 0.7),
  not a fixture.
- impact: no finisher (9× ATK at level 12), no stagger windows, set's
  Stagger bonus inert.

**G11. Projectile travel** (row 5).
- family: timing
- feature: a per-projectile delay (not in the data; from logs).
- evidence: LaunchProjectile on all basic attacks.
- impact: small; basic hits a few frames early.

**G12. Link** (row 35).
- family: triggers (a team trigger on combo casts) + buff lifecycle (stacks
  consumed by the next battle skill or ultimate cast)
- feature: as in the 40d9 annotation: combo casts give
  buff_common_affixes_combo_trigger; the next battle skill or ultimate
  turns them into buff_common_affixes_skillimbue_atk for that cast's hits.
- evidence: fixtures/zmdlogs-40d9a3c1da37.json provenance note; in-game
  test 8.
- impact: ×1.2 on her ultimate after one teammate combo (more with
  stacks); shared by every operator.

**G13. Dive attack needs a jump** (row 8).
- family: skills (states)
- feature: plunging_attack_end only after a jump (plunging_attack_start,
  durationFrame 1500, i.e. falling until landing).
- evidence: SkillData plunging_attack_start / _end.
- impact: small; the search could use a plunge anywhere.

**G14. Compile what the kit hand-writes** (rows 2, 12, 23).
- family: data compilation
- feature: kit-draft v2 / loader defaults: frames (DamageAction frames and
  LaunchProjectile frames for projhit skills), event keys, `usp` energy
  (ObtainCostAction costType 0), and inflictions from SpellInfliction where
  `isEnable` is true (both of hers are).
- evidence: kit-census `*` columns for aglina (hit.energy, hit.events,
  hit.frames, skill.durationFrames); `efsim kit-draft chr_0013_aglina`
  emits only scales and events.
- impact: none on numbers today; maintenance and drift.

No gap here looks unique: G1 / G10 cover every physical operator, G3–G6 every
weapon and set, G7–G9 and G12 every operator. Kit fix needing no engine work:
row 26 (P2 Arts Susceptibility as a ValueExpr).

## Verification

- **fixtures/zmdlogs-40d9a3c1da37.json** (P3, Twilight, phy01 3 pieces,
  ultimate level 10): basic attacks (9 match today), the ultimate under Link
  (×1.2), Arts Susceptibility 0.36 (row 26: checks the P2 formula once the
  kit has it), Twilight's ATK on Laevatain / Camille / Si and its timing
  (W6). No combo, so no set proc or Lift.
- **fixtures/zmdlogs-4e5e1390085e.json** (P0, Pursuit skill 3 level 4, usp02
  set): 42 hits match; combos with Pursuit's 0.248 applied before damage
  (W3), battle skill pulls and explosion with its own Corrosion (rows 11–13),
  ultimate; Lift hits (G1); 0.36 Arts Susceptibility at P0 = n 2 (G2). Two
  teammates have no kit (Wulfa, Camille), so reaction replay is incomplete.
- **fixtures/zmdlogs-d9e59d0fb737.json** (P1, Pursuit, phy01): set proc and
  Lift hit (S2, G1, G6), combo after a forced Corrosion (row 16), the
  unexplained ×1.2689 ultimate (row 36).

In-game tests (for docs/in-game-tests.md):

1. **Arts Susceptibility per Vulnerability stack** (G2): Gilberta below P2
   with a physical teammate. On a dummy, her ultimate with 0, 1, 2, then 3
   or 4 Vulnerability stacks on it (from Lift / Knockdown); read the Arts
   Susceptibility value. Expected 0.30 × (1 + 0.1 n) at level 12; repeat at
   P2+ with n = 3 to settle whether it becomes 4 (0.30 × 1.8) or stays 3
   (× 1.6).
2. **Her own reaction opening her combo** (row 17): dummy with a Heat
   infliction from a teammate; her battle skill's explosion causes
   Corrosion; is her combo button lit afterwards?
3. **Two Arts Susceptibility sources** (row 28): her ultimate and Liino's
   (or another source of the same debuff) on one dummy; is the value the
   sum or the larger one?
4. **Cancel windows** (G8): after her battle skill, how soon can she basic
   attack compared with how soon she can combo (expected ~0.4 s apart)?
5. **phy01 proc** (S2): with three phy01 pieces, does the extra hit come
   with every Lift from her combo, and not again within 15 s (two combos
   less than 15 s apart)?
6. **Messenger's Song** (row 31): a Guard / Caster / Supporter teammate's
   Ultimate Gain Efficiency in the stat panel with and without Gilberta in
   the team, and a Striker's or Vanguard's (expected unchanged).

## Re-analysis (pass 2, 2026-10-18)

Against the engine and kit format after the batch-1 implementation pass
([batch-1.md "Progress"](../batch-1.md#progress)), `schemas/kit.schema.json`,
`efsim kit-draft chr_0013_aglina` (v2) and the D1 comparison in
`packages/data/test/skillCompile.test.ts`. Pass 1's facts were treated as
claims and re-read in the data (files and keys below); where pass 1 was
wrong it says so.

**Compiler evidence.** `KNOWN` has one Gilberta entry:
`chr_0013_aglina_normal_skill teamEnergyFrame: kit -, data 29` (a kit
omission). Every other frame, count, event key, scale key, infliction and
energy grant in her kit agrees with the data. kit-draft v2 also emits what
the kit lacks: per-projectile `sp` (attack1 `atb`; attack2 `atb` × 0.5 per
landing; attack3 × 0.333333; the three attack4 orbs × 0.3334 each),
`detached` on all projectile hits, `finalStrike` only on the centre orb,
`teamEnergyFrame: 29`, and the finisher's seven landings
(frames 12, 15, 18, 21, 24, 29, 43). It still emits **no** `poise`, no
finisher factors (BreakingAttackCalculation `multiplier` 0.05 ×6 and 0.7 is
dropped: all seven landings come out as plain `atk_scale`), no forced Lift
(AirborneAction isn't compiled) and no `durationFrames`. That last one is
fine: the engine's action gate reads SkillData timing only, so kits'
`durationFrames` don't affect anything. The logged keys not in the draft are
`buff_physical_airborne` ×4 (Lift hits, status damage), `buff_equipsuit_physuit_01` ×1
(gear-set hit) and `buff_common_natural_triggered` ×1 (a reaction hit, R10).

**Current log checks** (`zmdlogs check`, today's kit): 4e5e 44 match / 0
mismatch / 14 under unmodelled effects (79% of her damage covered), 40d9
9 / 0 / 1 (the ultimate under Link), d9e5 0 / 0 / 8. d9e5 is the pre-1.6-table
battle in which, per Arcane's kit, every hit after Arcane's ultimate is off
by an unexplained factor. Gilberta's ultimate (×1.2689, pass-1 row 36) and
the gear-set hit (implied 3.38 against 2.5) fall in that window, so d9e5 is
good for **event order** only (the set hit with the Lift, the combo after a
forced Corrosion, Arts Susceptibility 0.30 at P1, which is a value the game
logged and not a damage number) and not for damage values.

### 1. First-round rows against the current engine

| First-round row / gap | Now supported? | How (fields), or what's still missing |
|---|---|---|
| 2, 12, 23, G14: frames, keys, locks, `usp`, inflictions hand-written | yes (data) | All are compiled by kit-draft v2 and agree with the kit (D1 test). The kit still has to carry them, because the loader doesn't default from the compiler yet. Still not compiled: `poise`, finisher factors, forced Lift (R4) |
| 4: basic-attack SP 2–4 frames early | yes | per-hit `sp` from the draft (`{"product": ["atb", 0.3334]}` on each attack4 orb); the skill's `atb` is then no longer added at the first hit |
| 5, G11: projectile travel | **no** | Ti2 still open: hits land at the launch frame (R7) |
| 6, G10: stagger from hits | yes (engine) / data | `poise` and `poiseControlledOnly` on hits (P2). The values aren't compiled, and the poise units' semantics are partly unknown (R4) |
| 7, G10: finisher | yes | skill `chr_0013_aglina_power_attack`: the engine treats skillSpecification 8 as Staggered-only, once per stagger, with the enemy's finisher multiplier and `finisherSp`. The kit writes `factor` 0.05 (×6) and 0.7 by hand (compiler gap R4) |
| 8, G13: dive needs a jump | **no** | there is no mid-air state or predicate yet. Worse, plunging attacks (specification 6) may interrupt anything (priority ∞), so search can exploit them (R6) |
| 9: dash attack | unknown, out of scope | `dash_attack(_projhit)` (atk_scale 0.38, poise 5, window → attack4) has SkillPatchTable levels but isn't in CharGrowthTable's skill groups, so it has no level source. No log has one. Leave it out |
| 13: Corrosion before the explosion's damage | yes | applications run before the hit's damage (`landHit`) |
| 14, G7: team energy at frame 29 | yes | `teamEnergyFrame: 29` (the only KNOWN entry) |
| 15, G8: cancel windows | yes, partly | SkillData windows, exclusive frames and priorities (S3): after the battle skill, combo at 123 and the rest at 135; combo → battle / ultimate at 53, the rest at 72; ultimate → battle / combo at 64, the rest at 85. Swaps are blocked during the channel (`cantSwitch`, 0–111). **Not honoured:** the same channel's `cantCastSkill`, and the finisher's `buff_common_power_attack_disable_cast_skill` (0–43). Both are parsed or present but not used, so her ultimate or combo may start mid-channel (R5) |
| 16: combo trigger on any reaction, forced included | yes | unchanged trigger `{on: {event: reaction}, by: anyone, do: [openCombo]}` |
| 17: combo opened by her own non-combo reaction | unknown | the engine allows it (only her own combo's events are excluded, `origin.kind === "combo"`). In-game test T2 |
| 20, G1: forced Lift and its hit | yes | combo hit `applies: [{kind: "physicalStatus", status: "lift", forced: true}]`. The engine adds the Lift hit (status damage, checked on 4e5e), +1 Vulnerable and Lift stagger 10 × (1 + AI/200). The order fits the data: AirborneAction is actionData[3] and DamageAction actionData[4] at frame 48 |
| 21, 24, G9: combo slow-down, ultimate time stop | yes (Ti1 part) | read from SkillData: the combo's 0.6 s `ComboSkill` curve, the ultimate's 52-frame stop. The ultimate's 0–3 TimeDilation is a `RESETto1` reset with no effect. In-game test 18 is pending |
| 25, 26, G2: Arts Susceptibility × Vulnerable stacks, P2 | yes | ValueExpr with `enemyVulnerableStacks`, evaluated when the buff is applied. That fits the data: the formula sits in `buff_chr_0013_aglina_ultimate_skill`'s start timeline and runs once on entering the field. **Correction to pass 1:** the P2 test is `CompareFloat compare 1` (≤ under the Endaxis enum codes the compiler uses), so n ≤ 3 → n + 1, then ×2 (literal 2). In-game test T1 confirms. Tag 1075718177 is `buff_physical_no_guard` (Vulnerable). Sketch in the kit plan |
| 27: 5 s, after the hit's own damage | yes | hit `buffs: [{buff: "arts_susceptibility"}]` (after the damage by default), `duration: "duration"` |
| 28: two sources of `buff_common_affixes_vulnerable_spell` | unknown | stackingType 0, so the engine adds them (no stack group). Only `buff_physical_*` evidence supports "type 0 adds" (buffData.ts). In-game test T3 |
| 29: "Lifted persists until the field wears off" | unknown, no data | nothing in the field (`_abilityrange`: AuraAction only), its buff (CheckBuffStackNum, ModifyDynamicBlackboard, CreateBuff, SlowAction) or the files they reach extends `buff_physical_airborne`. The `_inair` / `_grounded` buffs are orphans. No damage effect is visible in the data, so don't model it; in-game test T7 is optional |
| 30, 32, 33, 37 | yes | no effect against one enemy. Talent 2's heals need ≥ 2 targets (`CheckEntityNum minNum 2 compareType 3`), so the kit carries no `heals` until multi-enemy, which would also need an `if` on heals |
| 31, G3: Messenger's Song | yes, with a workaround | the talent's attached skill is a value source: `{key: "add", skill: "chr_0013_aglina_talent_0"}` (4% / 7%, P3 +5% via skillValue). A team buff `{attr: 44}` with `recipients: {operatorProfession: [0, 4, 5]}` (CheckProfession mask 49 = bits 0, 4, 5; CharacterTable: Estella / Wulfgard 0, Gilberta / Liino / Si 4, Arcane 5). No duration. **Missing:** a fight-start event to apply it. Interim: the first cast by anyone, `maxCount: 1` (R8). It also throws for a build with talent 1 at level 0 (R9) |
| 34, 19, 22, 10, 11, 18 | yes | loader (P5 ×1.3 and −2 s, P4 cost, SkillPatchTable) |
| 35, G12: Link | **no** | `consumedBy` exists, but nobody gives Link: there's no common source, no value by stack count, and the values aren't in our tables (R3) |
| 36: d9e5 ultimate ×1.2689 | not hers | the pre-1.6 anomaly window above. Don't use d9e5 for values |
| W1, W2, W4, W5 | yes | stat panel. W4: `buff_wpn_lance_0003` keys aren't in sk_wpn_funnel_0011's blackboard, so it's inert |
| W3, G4, G5: Pursuit | **partly** | expressible: an equipment trigger with `skill: "sk_wpn_funnel_0011"`, a team buff valued `spell_dmg_up + min(targetsHit, max_stack) × spell_dmg_up2` (V1, V2). **Missing:** (a) the trigger's buff must act on the combo hit that lifted. Logs show `buff_wpn_funnel_0011_valid` already on that hit, but triggers run after the hit's damage (R1). (b) a filter "Lift caused by a combo-type hit" (CheckOriginSkillType [6]) (R2) |
| W6, G3, G4: Twilight | yes | equipment trigger `on: {event: cast, kinds: [ultimate]}, by: self`; team buff `recipients: {all: [{not: {isOwner: true}}, {not: {sameElementAsOwner: true}}]}`. CharacterTable `charTypeId` is the element (Natural, Fire, Cryst…), and that's what CompareString compares |
| W7: `buff_wpn_passive_spirit_01` | inert | still not in the checkout; 40d9 logs nothing from it |
| S1: Stagger Efficiency +20% | yes | attr 26 now acts on stagger (P2) |
| S2, G6: Swordmancer hit | yes | gear-set kit `suit_phy01`: trigger `on: {event: physicalStatus}, by: self, cooldown: "duration"`, `hits` action (Physical, `damageType: none`, own event key, `poise`). Tag −6380412 isn't Vulnerable's (1075718177): `buff_dung_physicalstatus_enemy` lists the two side by side, and `buff_gambling_take_physical_abnormal` checks it for "physical abnormal". So Vulnerable alone doesn't proc. Whether Shatter counts, and the hit's scale, are unknown: d9e5 can't tell (T5) |

### 2. Remaining gaps

None of these is unique ([kit-unique.md](../../kit-unique.md) is empty, and
each has another user named below).

**R1. Triggers on a hit's own status events act before its damage** (W3).
- family: triggers
- feature: events caused by a hit's `applies` (status events: physicalStatus,
  vulnerable, reaction, inflictionApplied / Consumed, statusConsumed,
  control, shatter) run their triggers **before** that hit's `computeHit`,
  so a buff they apply already acts on the hit. The hit event itself, poise,
  `buffApplied` and heal events stay after the damage. This follows the
  existing rule "what the hit applies comes first" in `landHit`. Today
  `landHit` queues every event and runs triggers after the damage
  (timeline.ts, `const all = [hitEvent, ...asEvents(statusEvents), …]`).
  No current kit has a status-event trigger that applies a buff (all are
  `openCombo`), so the change moves no example total. An alternative is a
  per-trigger flag, `beforeDamage: true`, allowed only on status events.
- evidence: combo_skill frame 48: AirborneAction (actionData[3]) before
  DamageAction (actionData[4]). buff_wpn_funnel_0011 (created at the combo
  cast) creates `_valid` on abilityEvent 402. In fixtures/zmdlogs-4e5e1390085e.json,
  the combo hits at 7598, 30327 and 55403 carry `buff_wpn_funnel_0011_valid`
  as a boundary buff and match only with it applied.
- impact: every Pursuit combo hit misses the team Arts DMG it creates:
  +24.8% at skill level 4 (0.192 + 0.056), +43.4% at level 9. Against the
  hit's other DMG bonuses (Nature +25.6–44.8% from the same weapon) that is
  roughly −16 to −23% on each combo hit. It's every combo, not just the
  first: her cooldown (19 s, 17 s at P5) is longer than the buff (15 s).

**R2. The causing hit's skill type on status-event triggers** (W3).
- family: triggers
- feature: `kinds` (skill types, plus `none` for triggered hits) on the
  status-type `on` events (physicalStatus, inflictionApplied, reaction,
  burst, vulnerable, …), matched against the kind of the hit or action that
  caused the event. `runTriggers` already receives that as `origin.kind`.
  Pursuit: `{event: "physicalStatus", statuses: ["lift"], kinds: ["combo"]}`.
- evidence: buff_wpn_funnel_0011 abilityEvent 402: CheckPhysicalInflictionType
  mask 1, CheckOriginSkillType [6]. Arcane's wpn_funnel_0016 has the same
  check on inflictions (CheckOriginSkillType [2, 6, 7]; Arcane report W3).
  12 BuffData files use CheckOriginSkillType (wpn_funnel_0006, _0011,
  _0016 will / wisd, wpn_pistol_0008 among them).
- impact: none for Gilberta, whose only Lift is her combo. Wrong for any
  other wielder whose battle skill or ultimate Lifts, and for Arcane's
  weapon (infliction by basic attacks counts today).

**R3. Link** (row 35, pass-1 G12; batch-1 B4 left it without a source).
- family: triggers + buff lifecycle + values (shared by every operator)
- feature: a common mechanism, not a kit entry per operator. Every combo
  cast adds a Link stack to the team (`buff_common_affixes_combo_trigger`).
  The next battle skill or ultimate by anyone consumes all of them
  (`consumedBy`) and gets a ComboCalcZone multiplier by stack count, acting
  on that cast's hits only. Missing pieces: (1) where engine-wide common
  mechanics live: built in, or a common kit added to every operator like
  `effectiveKit` adds equipment; (2) a value by stack count, i.e. a
  `buffLayers` ValueExpr or a lookup (ultimate 20 / 30 / 40 / 50%, battle
  skill 1.5× that); (3) a zone for it (`multiplicative` suffices for a
  single source); (4) the stack cap. The values aren't in our tables
  (skill-setting key 连击增伤); Talos has them. In-game test 8.
- evidence: fixtures/zmdlogs-40d9a3c1da37.json 12951 ms, her ultimate exactly
  ×1.2000 with one stack (docs/data-sources.md "Consensus").
- impact: ×1.2–1.5 on her ultimate and battle skill after teammates'
  combos, in every team. 40d9's ultimate is the one unmodelled hit there.

**R4. Compiler remainder: poise, finisher multipliers, forced Lift** (rows 6,
7, 20; pass-1 G14).
- family: data compilation (+ log tooling)
- feature: compileSkill / kit-draft emit (a) `poise` per landing from the
  `damageAttributeType` 1 unit (blackboard `poise` by convention, game-data-format.md)
  and `poiseControlledOnly` from its `onlyEnableForMainChar`; (b) `factor`
  from BreakingAttackCalculation `multiplier`; (c) `physicalStatus` from
  AirborneAction `forceAirborne` (and the Knock Down / Crush / Fracture
  actions). Two semantic unknowns: the ultimate's poise unit is a
  DefiniteValueCalculation with value 1 (`applyScale` false), so is it 1 or
  the table's 20? And the three attack4 orbs each carry a unit, so is it 16
  per orb or 16 in all? ZMDLogs' `/api/battles/{id}` has `poiseDamage` per
  hit; log fixtures don't store it, and storing it would settle both.
- evidence: poise units in attack4_projhit, attack4_projhit_2 (controlled
  only), combo_skill, the normal_skill explosion and ultimate_skill; none in
  attack1–3_projhit or the pulls. SkillPatchTable `poise` is 16 (attack4),
  10 (battle skill), 5 (combo), 20 (ultimate). power_attack: 6 × 0.05 and
  1 × 0.7.
- impact: until compiled, poise is hand-written with two open readings.
  Ultimate 20 vs 1, and attack4 48 vs 16, move stagger breaks (Rhodagn 280)
  and so the ×1.3 Staggered windows and finisher availability. Factors and
  Lift are hand-written (no number error once written).

**R5. Casting blocks inside a skill: `cantCastSkill` channels and
disable-cast buffs** (row 15).
- family: skills (timing)
- feature: while a `ChannelingCastingAction` with `cantCastSkill` runs
  (her battle skill, 0–111), or `buff_common_power_attack_disable_cast_skill`
  is on (finisher, 0–43), the caster can't start another skill, even one
  that outranks the current one by priority. It's unknown whether teammates'
  casts are blocked too. skillData.ts parses `cantCastSkill` into
  `channels`, but `actionGate` only uses `cantSwitch`.
- evidence: chr_0013_aglina_normal_skill ChannelingCastingAction 0–111;
  power_attack CreateBuff 0–43. 23 operator skills have `cantCastSkill`
  channels, mostly ultimates (chr_0021_whiten, chr_0032_lizhiyan, chr_0028_wulfa,
  chr_0023_antal…).
- impact: illegal actions: her ultimate (priority 7) or combo (5) can start
  during the battle skill's channel and cut its pulls and explosion. The
  ultimate can also cut a finisher.

**R6. Dive attack needs mid-air** (row 8, pass-1 G13; shared with Estella
G10 and Typhoeus G2).
- family: skills (states)
- feature: an airborne state from `plunging_attack_start` (durationFrame
  1500: falling until landing; `canCastInAir`), and plunging attacks
  available only in it.
- evidence: SkillData plunging_attack_start / _end; engine `priorityOf`
  gives specification 6 an infinite priority.
- impact: search may use a 1.8 × ATK dive at any frame, interrupting
  anything. Until the state exists, leave the plunge out of the kit.

**R7. Projectile travel** (row 5, Ti2).
- family: timing
- feature: a per-projectile delay (not in the data; from logs or tests).
- evidence: LaunchProjectile in attack1–4.
- impact: small; basic hits a few frames early.

**R8. Fight-start event** (row 31).
- family: triggers
- feature: `on: {event: "fightStart"}`, fired once at frame 0 for every
  team member, for permanent auras (talents with lifeType 1 auras).
  Interim: `{on: {event: "cast"}, by: "anyone", maxCount: 1}`, exact as long
  as no energy is gained before the first cast's trigger runs (team energy
  comes at `teamEnergyFrame`, combo energy at its hit).
- evidence: buff_chr_0013_aglina_talent_0 (AuraAction, lifeType 1) →
  `_effectbuff_Add` (attr 44). Typhoeus's talent 1 ("on entering battle")
  is the same moment.
- impact: none with the interim; it's a clarity and robustness issue.

**R9. Effects of a talent that isn't unlocked** (row 31).
- family: conditions
- feature: a predicate `talentAtLeast: [index, level]`, or value sources
  that are absent below their unlock and skip the effect instead of
  throwing. `skillValue` throws when `panel.sources` lacks the talent's
  attached skill, and a build may set talent levels to 0.
- evidence: stats.ts talents loop (`if (level === 0) return`); damage.ts
  `skillValue` "isn't one of … sources".
- impact: builds below promotion 1–2 can't simulate (no wrong numbers).
  Shared: every talent-valued effect (Arcane talents 1–2, Laevatain's
  Scorching Heart, Typhoeus's Signs).

**R10. Reaction hits logged as `buff_common_<element>_triggered`** (carried:
batch-1 L1 "open", Arcane G15).
- family: log tooling / arts state
- feature: explain the ×1.42 these reaction hits show, so they can be
  checked.
- evidence: 4e5e 68873 ms `buff_common_natural_triggered` 41406, credited
  to her (her explosion's Nature onto a Heat infliction). It's the one
  uncovered event in her 4e5e check. Camille has no kit, so the replay
  can't place the Heat infliction yet.
- impact: one of her largest single numbers in 4e5e is unverifiable.

### 3. Kit plan

**Operator kit `chr_0013_aglina`** (from the draft, plus the hand-written
parts; drop `durationFrames` everywhere):

- `element: natural`; no stacks, no activeConditions.
- `buffs`:
  - `arts_susceptibility` (enemy, `gameBuff: buff_common_affixes_vulnerable_spell`,
    `duration: "duration"`; buff_chr_0013_aglina_ultimate_skill):
    ```json
    {"zone": "susceptibility", "elements": ["fire", "pulse", "cryst", "natural"],
     "value": {"product": ["spell_vulnerable_rate", {"sum": [1, {"product": ["spell_vulnerable_perstack",
       {"if": {"potentialAtLeast": 2},
        "then": {"product": [2, {"min": [{"sum": [{"enemyVulnerableStacks": true}, 1]}, 4]}]},
        "else": {"enemyVulnerableStacks": true}}]}]}]}}
    ```
    P2 is the only source of `potential2` (PotentialTalentEffectTable), and
    min(n + 1, 4) equals "n ≤ 3 → n + 1" because Vulnerable stops at 4.
    Expected: 0.30 at n 0 (d9e5 P1 logs 0.30); P2 n 0: 0.36 (40d9 P3 logs
    0.36); P0 n 2: 0.36 (4e5e: Estella's Lift at 54882 ms plus hers at 55403
    ms, once Estella's kit has its Lift); P2 n 4: 0.54.
  - `messengers_song` (team, no duration, `recipients: {operatorProfession:
    [0, 4, 5]}`, `modifiers: [{attr: 44, value: {key: "add", skill:
    "chr_0013_aglina_talent_0"}}]`; talent 1, P3 +0.05 through skillValue).
- `triggers`:
  - `combo_window`: unchanged (CharGrowthTable "When an Arts Reaction is applied").
  - `messengers_song`: `{on: {event: "cast"}, by: "anyone", maxCount: 1,
    skill: "chr_0013_aglina_talent_0", do: [{kind: "buff", buff:
    "messengers_song"}]}`; `fightStart` once R8 exists.
- `skills` (frames, keys and energy from SkillData; values from
  SkillPatchTable):
  - attack1: `projhit` atk_scale, frame 7, `sp: "atb"`, detached.
  - attack2: `projhit` ×2 at 4, 8, `sp: atb × 0.5`, detached.
  - attack3: `projhit` ×3 at 7, 10, 14, `sp: atb × 0.333333`, detached.
  - attack4: `projhit` (centre, Final Strike) at 23 and `projhit_2` ×2 at
    25, 27; each `sp: atb × 0.3334`, `poise: "poise"`,
    `poiseControlledOnly: true` (R4 decides per-orb vs split), detached.
  - power_attack (finisher): `hit` ×6 at 12, 15, 18, 21, 24, 29 with
    `factor: 0.05`, and `final` at 43 with `factor: 0.7`, event
    `chr_0013_aglina_power_attack` (BreakingAttackCalculation; a scratch log
    576da29ffa7a showed 2510 ×5 and 35135, five small hits against the
    data's six: check the count when it's committed).
  - normal_skill: `teamEnergyFrame: 29`; `pull` ×4 at 29, 46, 62, 78
    (`atk_scale_pull`, no poise unit); `explosion` at 108
    (`atk_scale_explosion`, `applies: [{kind: infliction, element:
    natural}]`, `poise: "poise"`).
  - combo_skill: `hit` at 48, `atk_scale`, `energy: "usp"`, `poise:
    "poise"`, `applies: [{kind: "physicalStatus", status: "lift", forced:
    true}]`.
  - ultimate_skill: `hit` at 60, `atk_scale`, `applies: [{kind:
    infliction, element: natural}]`, `buffs: [{buff:
    "arts_susceptibility"}]` (after the damage), `poise` per R4.
  - plunging_attack_end: leave out until R6.

**Equipment kits** (`packages/data/kits/equipment/`):

- `wpn_funnel_0011.json` (Pursuit; values from `sk_wpn_funnel_0011`):
  buff `wpn_funnel_0011.arts_dmg` (team, `gameBuff:
  buff_wpn_funnel_0011_valid`, `duration: "duration"`, `{zone: damageBonus,
  elements: [fire, pulse, cryst, natural]}` for attrs 51–54, value
  `{"sum": ["spell_dmg_up", {"product": [{"min": [{"targetsHit": true},
  "max_stack"]}, "spell_dmg_up2"]}]}`). Trigger `{on: {event:
  "physicalStatus", statuses: ["lift"], kinds: ["combo"] /* R2 */}, by:
  "self", skill: "sk_wpn_funnel_0011", do: [{kind: "buff", buff:
  "wpn_funnel_0011.arts_dmg"}]}`, running before the hit's damage (R1).
  Nature DMG + stays in the stat panel. Check: 4e5e combos with 0.248.
- `wpn_funnel_0005.json` (Twilight; `sk_wpn_funnel_0005`): buff
  `wpn_funnel_0005.atk_up` (team, `gameBuff: buff_wpn_funnel_0005_atk_up`,
  `duration: "duration"`, `recipients: {all: [{not: {isOwner: true}}, {not:
  {sameElementAsOwner: true}}]}`, `{zone: "atk", value: "atk_up"}`: attr 2
  formulaItem 6 = ATK%). Trigger `{on: {event: "cast", kinds:
  ["ultimate"]}, by: "self", skill: "sk_wpn_funnel_0005", do: [{kind:
  "buff", buff: "wpn_funnel_0005.atk_up"}]}`. Check: 40d9 +22.4% on
  Laevatain's 11110 ms hit (before her 12951 ms ultimate hit), on Camille
  and Si, and not on Gilberta.
- `suit_phy01.json` (Swordmancer; `passive_equipsuit_physuit_01`): trigger
  `{on: {event: "physicalStatus"}, by: "self", cooldown: "duration",
  skill: "passive_equipsuit_physuit_01", do: [{kind: "hits", hits: [{id:
  "proc", scale: ["atk_scale"], element: "physical", damageType: "none",
  events: ["buff_equipsuit_physuit_01"], frames: [0], poise: "poise"}]}]}`.
  The Stagger Efficiency +20% is already in the panel. Needs a clean log or
  T5 to check the scale.

### 4. In-game tests for the remaining unknowns

For [docs/in-game-tests.md](../../in-game-tests.md) (12, 15 and 8 exist and
are extended here):

- **T1. Arts Susceptibility per Vulnerable stack** (extends test 12): on a
  dummy, with a physical teammate's Lift / Knock Down, her ultimate at
  0, 1, 2, 3 and 4 Vulnerable stacks. Expected at ultimate level 12 below
  P2: 0.30, 0.33, 0.36, 0.39, 0.42. At P2+: 0.36, 0.42, 0.48, 0.54, 0.54.
  A 0.48 at n = 3 would mean the check is "< 3", not "≤ 3".
- **T2. Her own reaction opening her combo**: a teammate's Heat
  infliction, then her battle skill's explosion causes Corrosion. Is her
  combo button lit?
- **T3. Two Arts Susceptibility sources**: her ultimate and another
  `vulnerable_spell` source on one dummy: sum or larger?
- **T4. Casting during her battle skill** (extends test 15): with energy
  full (or a reaction just applied), press her ultimate (or combo) right
  after the battle skill. Does it start at once, or only after about 3.7 s
  (`cantCastSkill`)? Does a teammate's combo still fire meanwhile?
- **T5. Swordmancer hit**: three phy01 pieces on her, one combo (Lift) on a
  clean dummy. The extra Physical hit's number against her ATK gives the
  scale (2.5 expected, no Arts Intensity term). Then a second combo less
  than 15 s later (no hit expected). Optionally a teammate's Vulnerable-only
  hit on her own wearer (no hit expected).
- **T6. Messenger's Song** (pass-1 test 6): a Guard / Caster / Supporter
  teammate's Ultimate Gain Efficiency with and without Gilberta, and a
  Striker's or Vanguard's (unchanged).
- **T7. Lift in the field** (optional): her combo, then her ultimate's
  field over the Lifted dummy. Does the dummy stay up past 3 s while the
  field lasts?

Not in-game: re-import 4e5e / 40d9 with `poiseDamage` per hit (R4), and a
committed log with a finisher (seven landings).
