# Perlica (chr_0004_pelica): gap report, batch 3

Operator Perlica (Electric, Caster: CharGrowthTable `charTypeId` Pulse,
`profession` 5, `mainAttrType` 41 Intellect, `subAttrType` 42 Will,
`weaponType` 2 Arts Unit, rarity 5). Equipment covered here
([batch-3.md](../batch-3.md)): weapons `wpn_funnel_0004` Wild Wanderer,
`wpn_funnel_0007` Monaihe; gear set `suit_wisd01` Mordvolt Insulation.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
EquipSuitTable, I18nTextTable_EN; Json/SkillData `chr_0004_pelica_*`,
`sk_wpn_funnel_0004`, `sk_wpn_funnel_0007`, `passive_equipsuit_wisd_01`;
Json/BuffData `buff_chr_0004_pelica_*`, `buff_wpn_funnel_0004*`,
`buff_wpn_funnel_0007`, `buff_equipsuit_wisd_*`,
`buff_common_pulse_*`. Perlica's SkillData and BuffData weren't in the
sparse checkout when this analysis started; the main session fetched them
during it (commit 535e88f) and every row below is read from them. Values
are at skill level 12 / weapon skill level 9 unless stated. `efsim
kit-draft chr_0004_pelica` was run on the main checkout; the kit plan was
loaded, simulated and log-checked from a scratch copy (see "Kit plan").

Claims from earlier notes, re-checked:
- *data-sources.md, Electrification: "Perlica's forced one
  (btl_upload_b6082588d600) is 0.272665 = 0.1596 × 1.70843 at AI 164.55,
  i.e. level I × 1.33, probably a talent or potential of hers."*
  **Explained by the data:** P4 (`chr_0004_pelica_potential_4`,
  skillBbModifier `extra_scaling` set 1.33 on the combo) and
  `buff_common_pulse_pulse_conduct_triggered_do`, which multiplies its
  `final_spell_resistance_decrease` by `extra_scaling`
  (ModifyDynamicBlackboard operation 2). 0.12 × 1.33 = 0.1596.
- *fixtures/pending/README.md: "Perlica's Electrification reaction
  (t=7544) is ×1.209 the level III prediction".* **Mostly explained:** her
  P3 ATK +20% (`buff_chr_0004_pelica_potential_3_atkup`, a boundary buff
  in the log) acts on the reaction hit, which gives ×1.200; ×1.0078 is
  left. See Verification.
- *Zero Sanity's note: talent 1 also counts stagger nodes.* **Not in the
  data:** `buff_chr_0004_pelica_talent_0` checks CheckPoiseValue compare 4
  (equal) against 0, i.e. only a fully Staggered enemy.
- *Endaxis / Zero Sanity: talent 2 "chains 1 more time".* The data's
  bounce goes to **another** enemy (FindTargetAction with an ExcludeTarget
  post-processor on the hit target, PriorityFilter max 1, radius 15), so
  against one enemy it does nothing.

## Data overview

Action types per file that affect damage, resources, state or timing
(visual, camera, audio, root-motion, teleport and targeting actions left
out). Frames are from the skill's start; `duration` / `exclusive` from
the file.

| File | Relevant actions |
|---|---|
| `chr_0004_pelica_attack1` (166 / 15) | LaunchProjectile@8 → `attack1_projhit`; AllowNextSkillAction 16–27 |
| `chr_0004_pelica_attack1_projhit` | DamageAction `atk_scale` mask 128; IfElse CheckMainCharacter + CheckEntityNum → ObtainCostAction costType 1 `atb` |
| `chr_0004_pelica_attack2` (168 / 22) | LaunchProjectile@9 and @12 → `attack2_projhit`; AllowNextSkillAction 18–28 |
| `chr_0004_pelica_attack2_projhit` | DamageAction `atk_scale` mask 128; ObtainCostAction `atb` × coefficient 0.3333 if controlled |
| `chr_0004_pelica_attack3` (173 / 29) | LaunchProjectile@16, @19, @22 → `attack3_projhit`; AllowNextSkillAction 26–40 |
| `chr_0004_pelica_attack3_projhit` | DamageAction `atk_scale` mask 128; ObtainCostAction `atb` if controlled |
| `chr_0004_pelica_attack4` (269 / 43) | LaunchProjectile@27 → `attack4_projhit`; AllowNextSkillAction 54–64 |
| `chr_0004_pelica_attack4_projhit` | DamageAction mask 2097280 (Final Strike) + poise unit `poise` (`onlyEnableForMainChar`); ObtainCostAction `atb` (atbSourceType 1); HitStopAction 0.3 s |
| `chr_0004_pelica_power_attack` (135 / 50, skillSpecification 8) | 35–44: DamageAction BreakingAttackCalculation `atk_scale` × multiplier 1.0 (mask 132), then IfElse CheckMainCharacter → **KnockDownAction forceKnockDown** + GainBreakingAttackAtb; CreateBuff `buff_common_power_attack_disable_cast_skill` 0–35, `buff_common_full_immune_medium` 0–50; AllowNextSkillAction 35–58 |
| `chr_0004_pelica_plunging_attack_end` (skillSpecification 6) | DamageAction `atk_scale` mask 1152 at 3–8, ObtainCostAction `atb`; 4 × LaunchProjectile@1 → `plunging_attack_projhit` (no actions) |
| `chr_0004_pelica_dash_attack` / `_projhit` | LaunchProjectile@3; projhit DamageAction `atk_scale` + poise; SkillPatchTable atk_scale 0.96, poise 5 |
| `chr_0004_pelica_normal_skill` (155 / 30, skillSpecification 3) | frame 13: InterruptAction, **SpellInfliction** inflictionType 1 (Electric), DamageAction `atk_scale` (mask 4352) + poise unit `poise`, CreateBuff `buff_common_obtain_ultimate_sp`; AllowNextSkillAction 28–54; `dontInterruptCombo` |
| `chr_0004_pelica_combo_skill` (115 / 45, skillSpecification 4) | LaunchProjectile 24–27 → `combo_skill_projhit`; TimeDilationAction 0.833 s (ComboSkill curve) 0–22; AllowNextSkillAction 25–54 |
| `chr_0004_pelica_combo_skill_projhit` | IfElse (`talent2` = 1, target tag 1075718177 Vulnerable, `EntityBB_bounced` = 0) → set `EntityBB_bounced` 1, FindTarget `extra_target` (another enemy), LaunchProjectile itself again; InterruptAction; CreateBuff tutorial marker; **CreateBuff `buff_common_pulse_pulse_conduct_triggered`** on the target (assigns `duration`, `extra_scaling`) **before** DamageAction `atk_scale` mask 12288 + poise unit `poise`; CheckEntityNum → ObtainCostAction costType 0 `usp`, costType 1 `atb` (no such key: 0) |
| `buff_common_pulse_pulse_conduct_triggered` | if `duration` > 0: `real_duration` = `duration`, else the skill setting 导电持续时间 by `count`; CreateBuff `_do` (duration, `count` 1, `extra_scaling`); stacking key `pulse_triggered` |
| `buff_common_pulse_pulse_conduct_triggered_do` | Electrification: ReadSkillSettingData 导电法术伤害提高 by `count` → StoreAttributeValue (attribute 57, the AI curve) → × `extra_scaling` → defender NormalCalcZone for damage types 2/3/4/6 (mask 92); tag 1466867135; stacking key `pulse_triggered`, stackingType 2 max 1 |
| `chr_0004_pelica_ultimate_skill` (114 / 85, skillSpecification 5) | UltimateTimeAction 0–50; CreateBuff `buff_common_damage_immune_ult_skill` 0–85; 58–63: DamageAction `atk_scale` mask 4608 with damage processor **InstantModifyAttribute attribute 9 (crit rate) + `crit`**, poise unit `poise`; SpawnAbilityEntity@55 (its skill only finishes the entity); AllowNextSkillAction 63–90 |
| `buff_chr_0004_pelica_talent_0` (talent 1) | lifeType 1; damageModifier CheckPoiseValue (target poise = 0) → attacker NormalCalcZone + `dmg` |
| `buff_chr_0004_pelica_potential_3` (P3) | abilityEvent 102 + CheckBuffIdInContext tag 1466867135 → CreateBuff `_atkup` (assigns `atk_up`, `atk_duration`) |
| `buff_chr_0004_pelica_potential_3_atkup` | attribute 2 formulaItem 6 (ATK %) + `atk_up`; `atk_duration`; stackingType 8, max 2 |
| `chr_0004_pelica_talent_0/1/1_1`, `extra_attack`, `drone_fx_passive`, `attack1_projhit02`, `attack4_projhit_no_effect`, `plunging_attack_projhit`; `buff_chr_0004_pelica_talent_1/_1_1/_1_cd`, `_normal_debuff`, `_drone_fx`, `_combo_skill_tutorial_marker` | no gameplay actions, or unreferenced (`attack1_projhit02`: no file launches it) |

Tag 1466867135 is in the `applyTags` of the reaction buffs
`buff_common_pulse_{cryst,fire,natural}_triggered` and of the forced
`buff_common_pulse_pulse_conduct_triggered_do`: "applies Electrification"
covers both.

Table values (SkillPatchTable, L1 → L12): attack1–4 `atk_scale` 0.25 →
0.57, 0.15 → 0.34 (×2), 0.12 → 0.28 (×3), 0.57 → 1.27; attack4 `poise` 15,
`atb` 15 (others 0); finisher 4.0 → 9.0; dive 0.8 → 1.8; dash 0.43 → 0.96
(poise 5); battle skill 1.78 → 4.0, poise 10, 100 SP; combo 0.8 → 1.8,
poise 10, `usp` 10, `duration` 5, cooldown 20 s (19 s at L12); ultimate
4.45 → 10.0, poise 20, cost 80 energy, cooldown 10 s.

## Mechanics

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| 1 | Basic attack 1: one projectile (attack1 LaunchProjectile@8) | supported | hit `atk_scale`, frame 8, event `chr_0004_pelica_attack1_projhit`, `sp: atb`, detached (kit-draft) |
| 2 | Basic attack 2: two projectiles @9, @12, each `atk_scale` (display_atk_scale = 2 × atk_scale) | supported | count 2, frames [9, 12], `sp: atb × 0.333333` (atb is 0) |
| 3 | Basic attack 3: three projectiles @16, @19, @22 | supported | count 3 |
| 4 | Basic attack 4: Final Strike @27, 15 SP, 15 stagger while controlled (attack4_projhit mask 2097280, poise unit `onlyEnableForMainChar`) | supported | `finalStrike`, `sp: atb`, `poise: poise`, `poiseControlledOnly` (poise hand-written: row 12) |
| 5 | Chain timing, windows, exclusive frames, `dontInterruptCombo` (AllowNextSkillAction per file) | supported | engine reads SkillData (design.md "Skill timing") |
| 6 | Finisher: BreakingAttackCalculation 9.0 × multiplier 1.0 @35, finisher SP (GainBreakingAttackAtb) | supported | hit `atk_scale`, frame 35; the engine gates it on Staggered, adds the enemy's multiplier and SP |
| 7 | Finisher's **forced Knock Down** when she's controlled (power_attack IfElse CheckMainCharacter → KnockDownAction forceKnockDown, after the DamageAction) | data | `applies: [{kind: physicalStatus, status: knockdown, forced: true, if: {controlled: true}}]`; kit-draft doesn't emit it (D3: its Knock Down). Shared: Da Pan's ultimate has a forced KnockDownAction too |
| 8 | Finisher's disable-cast buff 0–35 | supported | engine reads `buff_common_power_attack_disable_cast_skill` |
| 9 | Dive attack (plunging_attack_end @3, 1.8) | supported | hit kept for `calc`; not castable in rotations (S10 interim: no jumps) |
| 10 | Dash attack (chr_0004_pelica_dash_attack: projectile @3, 0.96, poise 5) | gap | G3: no dash attack action in the engine (design.md "Enemy attacks and dodges": not modelled); every operator |
| 11 | Battle skill: Electric Infliction then the hit @13 (`atk_scale` 4.0), 100 SP, team energy from `buff_common_obtain_ultimate_sp` @13 | supported | hit `applies: infliction pulse`, `teamEnergy: [{frame: 13, ratio: 1}]` (kit-draft) |
| 12 | Stagger of every hit (poise units: attack4 15, battle 10, combo 10, ultimate 20) | data | `poise` on each hit by hand; kit-draft emits none (D3: poise) |
| 13 | Combo trigger: "When controlled operator performs a Final Strike on any enemy." (CharGrowthTable) | supported | trigger `on: {event: hit, finalStrike: true}`, `by: controlled`, `do: openCombo` |
| 14 | Combo hit: projectile @24, `atk_scale` 1.8, `usp` 10 on hit, cooldown 20 / 19 s, time dilation 0–22 | supported | hit frame 24, event `chr_0004_pelica_combo_skill_projhit`, `energy: usp`, detached; dilation from SkillData (Ti1) |
| 15 | Combo's **forced Electrification**, level I (`count` 1), `duration` 5 s, created **before** its DamageAction (so the combo hit already takes it) | data | `applies: [{kind: forcedReaction, status: electrification, durationKey: duration, scaleKey: extra_scaling}]` (applications act before the hit's damage); kit-draft emits the status without `durationKey` / `scaleKey` (D3: keys of a created buff) |
| 16 | Forced Electrification on an enemy that already has a (stronger, longer) reaction Electrification: both use stacking key `pulse_triggered`, stackingType 2 max 1 | unknown | engine: the new one replaces the old (status.ts `withStatus`); whether the game keeps the old level / timer isn't in the data (U2, test B) |
| 17 | Ultimate: time stop 0–50, hit 58 (`atk_scale` 10.0), cost 80, cooldown 10 s, no energy block | supported | hit frame 58, event `chr_0004_pelica_ultimate_skill` (kit-draft); time stop read from SkillData |
| 18 | Ultimate's own crit rate: InstantModifyAttribute attribute 9 + `crit` on its damage unit (0; P5 +0.3) | data | `bonuses: [{zone: critRate, key: crit}]` on the hit; kit-draft doesn't read damage-unit processors (D3, new item) |
| 19 | Ultimate's damage immunity (0–85) | supported | no effect: incoming damage isn't modelled |
| 20 | Talent 1 Obliteration Protocol: "DMG Dealt +{dmg} to Staggered enemies" (0.2 / 0.3; CheckPoiseValue = 0) | supported | self buff, `modifiers: [{zone: damageBonus, value: {talent: 0, key: dmg}, if: {enemyStaggered: true}}]` (C1), applied on `fightStart` |
| 21 | Talent 2 Cycle Protocol: "When hitting a Vulnerable enemy, the hit chains 1 more time" (`talent2` set 1; bounce to another enemy) | supported | nothing to write: with one enemy the FindTarget excluding the hit target finds none. Multi-enemy fights would need the bounce (comes with multi-enemy support, like N1) |
| 22 | P1: combo `duration` ×1.75 (8.75 s) | supported | skill value change (PotentialTalentEffectTable modifyType 3, op multiply), read through `durationKey` |
| 23 | P2: ultimate cost ×0.85 (68) | supported | skillParam paramType 1 |
| 24 | P3: "After Perlica applies Electrification to the enemy, she gains ATK +{atk_up} for {atk_duration}s. This effect can reach {max_stack} stacks." (abilityEvent 102 + tag 1466867135; `_atkup` stackingType 8 max 2) | supported | trigger `on: {event: reaction, statuses: [electrification]}`, `by: self`, `beforeDamage: true` → layered buff (`maxStacks`, shared refreshed timer from stackingType 8), values `{skill: buff_chr_0004_pelica_potential_3, key: …}`; reaction and forced both count |
| 25 | P3: layers gained per Electrification | unknown | interim one per reaction event; the e82d log's battle-skill hit fits two (U1, test A) |
| 26 | P4: "The Arts DMG Taken debuff effects on the enemy applied by the skill's Electrification are increased to {extra_scaling} times the original." (`extra_scaling` set 1.33) | gap | G1: the engine reads a forced status's `scaleKey` only for Combustion ticks, not Electrification's strength |
| 27 | P5: ultimate crit rate +30% (`crit` add 0.3) | supported | skill value change, read by the hit's `bonuses` (row 18) |
| 28 | Attribute nodes: Intellect +10 / +15 / +15 / +20 | supported | stat panel |
| 29 | Does an Electrification reaction's own initial hit take its own Arts DMG Taken? | unknown | engine: yes (a hit's applications act before the reaction's initial hit, timeline.ts); e82d t=7544 fits only without it (G2) |
| 30 | Electrification itself: level by consumed stacks, AI curve, 12–30 s, Arts DMG Taken on arts damage types | supported | status.ts (checked against logs, data-sources.md) |
| 31 | Unused / visual files (talent SkillData stubs, `extra_attack`, `drone_fx`, `attack1_projhit02`, …) | supported | nothing to write |

Equipment:

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| W1 | Wild Wanderer skills 1–2: Intellect (wpn_attr_wisd_mid), Electric DMG (wpn_sp_attr_electrondam_mid) | supported | stat panel (calc: Wisd +124, Pulse DMG +34.7% at L9) |
| W2 | Skill 3: Arts Intensity +phy_spell_up (10–28; cardAttributeModifier attribute 87) | supported | stat panel |
| W3 | Skill 3: "When the wielder applies Electrification, the team gains Physical DMG Dealt and Electric DMG Dealt +{dmg_up} for {duration}s. Effects of the same name cannot stack." (sk_wpn_funnel_0004 abilityEvent 206 + CheckBuffIdInContext tag 1466867135 → `buff_wpn_funnel_0004_up` on the team: attributes 50, 52 + `dmg_up` 0.08–0.224, 15 s, stackingType 11 priority `dmg_up`) | supported | equipment trigger `on: reaction electrification, by: self` → team buff with `gameBuff` (the stacking group keeps the strongest across wielders) |
| W4 | When abilityEvent 206 fires relative to the applying hit, and whether a reaction's Electrification (not only the forced one) fires it | unknown | interim: both count, after the hit's damage (Arcane's 206 handler was logged 4 frames after its buff, d9e59d0fb737); U3, test C |
| M1 | Monaihe skills 1–2: Will (wpn_attr_will_mid), Ultimate Gain Efficiency (wpn_sp_attr_usgs_mid) | supported | stat panel |
| M2 | Skill 3: Main Attribute +primary_attr_up (5–14%; cardAttributeModifier formulaItem 6, modifyAttributeType 1) | supported | stat panel (calc: Intellect ×1.14 of the rest) |
| M3 | Skill 3: Arts Intensity +phy_spell_up (25–70) | supported | stat panel |
| M4 | `buff_wpn_funnel_0007` (same values) | supported | never created: toggleBuffs names `buff_wpn_passive_spirit_01`, which has no BuffData (as Jiminy 12) |
| S1 | Mordvolt Insulation 3-piece: Intellect +wisd_up (50) | supported | stat panel |
| S2 | "When the wearer's HP is above {hp_ratio} (80%), Arts DMG +{spell_dmg_up} (20%)" (toggleBuffs `buff_equipsuit_wisd_spdmg_01`, attributes 51–54, CheckCurHpRatio compareType 3) | supported | self buff on `fightStart` (HP isn't modelled, N1: always above 80%), as Roving MSGR (suit_agi01) |

**Counts:** 41 rows: 31 supported, 4 data, 2 gap, 4 unknown, 0 unique?
(operator 31: 22 / 4 / 2 / 3 / 0; equipment 10: 9 / 0 / 0 / 1 / 0).

## Gaps

### G1. A forced status's strength times its skill value (`scaleKey` beyond Combustion)

- **Family:** arts state.
- **Feature:** `forcedReaction.scaleKey` multiplies the status's effect
  strength, not only Combustion's damage over time: for Electrification
  its Arts DMG Taken (level value × AI curve × `scaleKey`), evaluated when
  the status is applied and kept with it (`ActiveStatus.damageScale` is
  already stored; `statusModifiers` must multiply Electrification's value
  by it). The same key exists for Breach (`buff_physical_do_fracture`:
  `physical_res_down` × `extra_scaling`) and forced Corrosion
  (`buff_common_natural_natural_corrupt_do` has the key), so the rule is
  generic: whatever strength the status has, × the applying skill's
  `extra_scaling`. Default 1.
- **Evidence:** PotentialTalentEffectTable `chr_0004_pelica_potential_4`
  (skillBbModifier `extra_scaling` modifyType 3 → 1.33 on
  `chr_0004_pelica_combo_skill`); `combo_skill_projhit` CreateBuff
  `buff_common_pulse_pulse_conduct_triggered` assigning `extra_scaling`;
  `buff_common_pulse_pulse_conduct_triggered_do` ModifyDynamicBlackboard
  `final_spell_resistance_decrease` operation 2 by `extra_scaling`.
  ZMDLogs btl_upload_b6082588d600 (data-sources.md): forced
  Electrification 0.272665 = 0.12 × 1.33 × 1.70843 at AI 164.55.
- **Impact:** at P4+ (the search default P5) her forced Electrification is
  a third too weak: Arts DMG Taken 0.12 × AI factor (1.5–2.0 at 100–300
  AI) → +6–10 points missing for 8.75 s after each combo, on every arts
  hit of the team, her combo hit included (the status is applied before
  its damage). Roughly +4–6% on arts hits in that window.

### G2. A reaction's initial hit and its own new status (if the log is right)

- **Family:** arts state.
- **Feature:** decide, per status, whether the reaction's initial hit
  (the `buff_common_<el>_<el>_triggered` damage) takes the modifiers of
  the status it creates. The engine says yes for every status ("a
  reaction's initial hit already sees the new status", timeline.ts),
  which is right for the *applying* hit (Gilberta's and Arcane's logs) but
  hasn't been checked for the reaction's own hit. If more logs confirm
  this one, the initial hit of an Electrification reaction is computed
  before its own Arts DMG Taken.
- **Evidence:** fixtures/pending/zmdlogs-e82d45c46040.json t=7544,
  `buff_common_pulse_cryst_triggered` 36250 (level III: the logged
  strength 0.39571 = 0.20 × 1.97855 at AI 287.4). Predictions (scratch
  `zmdlogs check`, every boundary subset): level III + P3 ATK, without
  its own Electrification, 35968 (×1.0078); with it, 46297 (×0.783).
  The data alone would say yes (the buff computes
  `final_spell_resistance_decrease` just before its DamageAction), so this
  is one log against the data: **unknown** until a second log.
- **Impact:** if the log is right, every Electrification reaction's
  initial hit is too high in simulations by its own Arts DMG Taken
  (×1.12–1.6 by level and AI; ×1.29 here). Only the initial hit; later
  hits are unaffected.

### G3. Dash attacks as actions

- **Family:** skills (an action kind).
- **Feature:** a dash attack (SkillData `*_dash_attack`, SkillPatchTable
  `*_dash_attack`) castable as an action after a dash, with its hits and
  poise; design.md lists it as not modelled.
- **Evidence:** `chr_0004_pelica_dash_attack` (LaunchProjectile@3 →
  `_projhit`, `atk_scale` 0.96, poise 5).
- **Impact:** small for damage (a dash attack is rarely worth its time),
  but no rotation can contain one. Every operator.

### Data compilation (D3, batch 2's open item)

kit-draft's leftovers for this kit, all hand-written in the plan: poise on
every hit; the finisher's KnockDownAction; the keys a created status buff
gets (`duration`, `extra_scaling` assigned to
`buff_common_pulse_pulse_conduct_triggered`: the draft writes the forced
Electrification without `durationKey` / `scaleKey`, so P1's 8.75 s would
be the level-I default 12 s); **new:** damage-unit processors
(InstantModifyAttribute attribute 9 `crit` → `bonuses: critRate`). The
dash attack isn't drafted (G3).

### Unknowns (no engine work until settled)

- **U1** P3 layers per Electrification: interim one per reaction event
  (test A).
- **U2** forced Electrification on an enemy with a stronger one: interim
  replace (test B).
- **U3** Wild Wanderer's abilityEvent 206: interim reactions and forced
  both count, after the applying hit's damage (test C).
- **U4** the e82d residuals (×1.0078 on the reaction, the battle skill
  hit's level): see Verification.

## Verification

**Log:** fixtures/pending/zmdlogs-e82d45c46040.json (Rhodagn, game 1.6):
Perlica level 60, promotion 2, P5, logged skill levels all 1, weapon
wpn_funnel_0008 (no kit; its Arts Burst effect doesn't act here), Pulser
Labs 3 pieces. Two Perlica hits, both at t=7544: her battle skill on a
Cryo-inflicted enemy and the Electrification reaction it forms. With the
draft kit (scratch copy, `zmdlogs check`): **2 hits, 100% covered, 0
match, 2 mismatch**. Every prediction was printed (scratch patch of
logcheck.ts):

- **Reaction 36250** (boundary effects: Pulser Labs Electric DMG +0.5,
  its own Electrification 0.39571, P3 ATK +0.2). Level III without
  boundary buffs is 29973 (the README's ×1.209). With **P3 only**:
  35968, ×1.0078. P3 acting on the reaction is what the data says
  (abilityEvent 102 fires when the tagged reaction buff is added, before
  that buff's start-event DamageAction; the plan's trigger has
  `beforeDamage`). With Pulser Labs too (42893 at level III, 38604 at
  level II) or with its own Electrification (46297) it's far off, so the
  log fits only if Pulser Labs' bonus comes after the reaction's damage
  and the reaction doesn't take its own status (G2). Left: ×1.0078, not explained (her AI
  is pinned by the logged Electrification strength; a level coefficient
  of level 62 instead of 60 would fit, which is no explanation).
- **Battle skill 8542** (same boundary effects). With all three: 7312,
  ×1.1682. Two readings, neither exact: P3 at **two layers** (+40% ATK;
  her panel has no other ATK %, so ×1.1667, residual ×1.0013: U1), or
  the logged skill level 1 being wrong (the log can't hold skill levels
  at promotion 2 reliably: Pulser + P3 without Electrification at level
  6, 2.67 / 1.78, gives ×1.0024; Pulser + Electrification without P3 at
  level 5, 2.49 / 1.78, ×1.0022). This hit
  can't verify the battle skill until her skill levels are known.

So the plan explains ×1.200 of the README's ×1.209 (P3), and the log
suggests G2. The fixture stays pending for Perlica; Arcane's 5 hits still
match, and Si's ×1.139 is outside this report.

**Other logs that would verify the kit:** a Perlica log with known skill
levels (her own account data, or a level-90 build at max levels), with
(1) a combo after a Final Strike (combo hit, forced Electrification's
`vuln_taken` = 0.12 × AI curve × 1.33 at P4, P1's 8.75 s as the debuff's
logged span), (2) an Electrification reaction from her battle skill with
P3 below and at 2 layers (U1, G2), (3) a finisher (Knock Down hit). The
log btl_upload_b6082588d600 (data-sources.md) already has her forced
Electrification at P4+; importing it as a fixture would check G1.

**In-game tests** (by eye or stopwatch, relative):

- **A. P3 layers per Electrification** (ready, if you have Perlica at
  P3+): on a dummy, inflict Cryo with a teammate, then cast Perlica's
  battle skill (one Electrification reaction). Count the stacks on her
  ATK buff icon. Engine: 1. If it shows 2, every Electrification gives
  two layers (the e82d battle skill would then fit within 0.13%).
- **B. Forced Electrification over a long one** (ready, if you have
  Perlica): build Electrification III or IV with a reaction (it lasts
  24–30 s), then within a few seconds use Perlica's combo (forced level
  I, 5 s, 8.75 s at P1). Time how long the Electrification icon stays
  after the combo. Engine (replace): about 5 s (8.75 s); if the game
  keeps the stronger one, it stays for the rest of the original
  (≥ 15 s longer).
- **C. Wild Wanderer on a reaction** (ready, if you have Wild Wanderer):
  with it on Perlica, form Electrification by a reaction (Cryo, then her
  battle skill) and look for the team buff icon on a teammate; then with
  her combo (forced). Engine: the icon appears both times.
- Cross-check with existing tests: test 51 (does an effect a hit triggers
  count on that same hit) asks the same question as P3's and Pulser Labs'
  `beforeDamage`; this log answers it for P3 on a reaction hit (yes) and
  Pulser Labs on it (no), one data point each. G1 needs no test (a log
  shows the ×1.33). G2 isn't observable by eye (the reaction can't be
  formed without its own status): logs only, **not testable by hand**.

## Kit plan

Loaded with the real loader in a scratch copy of the repository at
7c7d00e (/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0004_pelica/repo,
files `packages/data/kits/operators/chr_0004_pelica.json` and
`packages/data/kits/equipment/{wpn_funnel_0004,wpn_funnel_0007,suit_wisd01}.json`):
`vitest run packages/data/test/kits.test.ts` passes (227 tests, the new
kit included), `skillCompile.test.ts` passes, `zmdlogs check` runs (above)
and a scratch scenario (Estella's Cryo battle skill, then Perlica's battle
skill, basic chain, combo, ultimate) simulates: the reaction and forced
Electrification happen, P3 raises the battle skill by ×1.157 and the
combo by ×1.315 (second layer), Wild Wanderer's team buff raises the
following basic attacks ×1.136, Mordvolt Insulation the battle skill
×1.149. P4 changes nothing (G1).

**Operator kit `chr_0004_pelica`** (`element: pulse`). Skills, hit by hit:

| Skill | Hit | Scale | Frame(s) | Events | Other |
|---|---|---|---|---|---|
| attack1 | projhit | atk_scale | 8 | attack1_projhit | `sp: atb`, detached |
| attack2 | projhit ×2 | atk_scale | 9, 12 | attack2_projhit | `sp: {product: [atb, 0.333333313]}`, detached |
| attack3 | projhit ×3 | atk_scale | 16, 19, 22 | attack3_projhit | `sp: atb`, detached |
| attack4 | projhit | atk_scale | 27 | attack4_projhit | `sp: atb`, `poise: poise`, `poiseControlledOnly`, `finalStrike`, detached |
| power_attack | hit | atk_scale | 35 | power_attack | forced Knock Down if controlled |
| plunging_attack_end | hit | atk_scale | 3 | plunging_attack_end | `sp: atb` (not castable: S10) |
| normal_skill | hit | atk_scale | 13 | normal_skill | `poise`, infliction pulse; `teamEnergy: [{frame: 13, ratio: 1}]` |
| combo_skill | projhit | atk_scale | 24 | combo_skill_projhit | forced Electrification, `energy: usp`, `poise`, detached |
| ultimate_skill | hit | atk_scale | 58 | ultimate_skill | `poise`, `bonuses: critRate crit` |

Non-obvious parts:

```json
{ "id": "hit", "scale": ["atk_scale"], "frames": [35], "events": ["chr_0004_pelica_power_attack"],
  "applies": [{ "kind": "physicalStatus", "status": "knockdown", "forced": true, "if": { "controlled": true } }] }
```

```json
{ "id": "projhit", "scale": ["atk_scale"], "frames": [24], "events": ["chr_0004_pelica_combo_skill_projhit"],
  "applies": [{ "kind": "forcedReaction", "status": "electrification", "durationKey": "duration", "scaleKey": "extra_scaling" }],
  "energy": "usp", "poise": "poise", "detached": true }
```

`scaleKey` loads today but only acts once G1 is in. Ultimate:
`"bonuses": [{ "zone": "critRate", "key": "crit" }]`.

Buffs and triggers:

```json
"buffs": [
  { "id": "obliteration_protocol", "target": "self", "gameBuff": "buff_chr_0004_pelica_talent_0",
    "modifiers": [{ "zone": "damageBonus", "value": { "talent": 0, "key": "dmg" }, "if": { "enemyStaggered": true } }] },
  { "id": "supervisory_duties", "target": "self", "gameBuff": "buff_chr_0004_pelica_potential_3_atkup",
    "duration": { "key": "atk_duration", "skill": "buff_chr_0004_pelica_potential_3" },
    "maxStacks": { "key": "max_stack", "skill": "buff_chr_0004_pelica_potential_3" },
    "modifiers": [{ "zone": "atk", "value": { "key": "atk_up", "skill": "buff_chr_0004_pelica_potential_3" } }] }
],
"triggers": [
  { "id": "combo_window", "on": { "event": "hit", "finalStrike": true }, "by": "controlled", "do": [{ "kind": "openCombo" }] },
  { "id": "obliteration_protocol", "on": { "event": "fightStart" }, "by": "self",
    "if": { "talentAtLeast": [0, 1] }, "do": [{ "kind": "buff", "buff": "obliteration_protocol" }] },
  { "id": "supervisory_duties", "on": { "event": "reaction", "statuses": ["electrification"] }, "by": "self",
    "beforeDamage": true, "if": { "potentialAtLeast": 3 }, "do": [{ "kind": "buff", "buff": "supervisory_duties" }] }
]
```

The P3 layers share one timer that each new layer refreshes: the loader
sets that from the game buff's stackingType 8. Talent 2 has nothing to
write against one enemy. Energy: max 80 (68 at P2), combo `usp` 10 on
its hit, no block.

**Equipment kits:**

- `wpn_funnel_0004` (Wild Wanderer): buff `wpn_funnel_0004.team_dmg`
  (`target: team`, `gameBuff: buff_wpn_funnel_0004_up`, `duration:
  duration`, modifiers `attr` 50 and 52 = `dmg_up`); trigger
  `wpn_funnel_0004.electrification` `on: {event: reaction, statuses:
  [electrification]}`, `by: self`, `skill: sk_wpn_funnel_0004`, `do:
  buff` (no `beforeDamage`: U3). Its stats are in the panel.
- `wpn_funnel_0007` (Monaihe): sources only (every effect is in the stat
  panel), as Jiminy 12's kit.
- `suit_wisd01` (Mordvolt Insulation): buff `suit_wisd01.arts_dmg`
  (`target: self`, `gameBuff: buff_equipsuit_wisd_spdmg_01`, `attr` 51–54
  = `spell_dmg_up`, no duration); trigger `on: fightStart`, `by: self`,
  `skill: passive_equipsuit_wisd_01`. Intellect +50 is in the panel.

**Waits on:** G1 (P4's ×1.33); G2 and U1 (the e82d fixture's two hits);
G3 (dash attack); U2 and U3 keep their interims. Nothing is unique:
`scaleKey` is Laevatain's field, a forced Knock Down is Da Pan's too,
"applies Electrification" triggers are Pulser Labs', HP-gated set bonuses
are Roving MSGR's.
