# Catcher (chr_0020_meurs): gap report, batch 2

Operator Catcher (Defender, Physical, greatsword: CharacterTable weaponType
3), with the weapons Darhoff 7 (`wpn_claym_0010`), Industry 0.1
(`wpn_claym_0003`) and Quencher (`wpn_claym_0009`), and the gear sets
Æthertech (`suit_poise01`), AIC Heavy (`suit_stragi01`) and MI Security
(`suit_criti01`) ([batch-2.md](../batch-2.md)).

Sources (rmxlinux, game 1.6): SkillData `chr_0020_meurs_*` (13 files),
BuffData `buff_chr_0020_meurs_*` (9 files), `sk_wpn_claym_0003/0009/0010`,
`buff_wpn_claym_*`, `passive_equipsuit_poisebreak_01 / stragi_01 /
critsuit_01`, `buff_equipsuit_poisedmg_01*`, `buff_equipsuit_stragi_01`,
`buff_equipsuit_critsuit*_01`, `buff_equipsuit_will_01`,
`buff_common_obtain_ultimate_sp`; TableCfg CharGrowthTable,
CharacterPotentialTable, PotentialTalentEffectTable, SkillPatchTable,
WeaponBasicTable, EquipSuitTable, I18nTextTable_EN. Values are at skill
level 12 / weapon skill level 9 unless noted. Frames are SkillData timeline
frames (30 FPS) from the cast.

There is no earlier report on Catcher. Claims from the brief and
batch-2.md re-checked: the six equipment IDs and names (WeaponBasicTable
`engName`, EquipSuitTable → set skills) are **confirmed**; all three
weapons are weaponType 3, Catcher's type.

`efsim kit-draft chr_0020_meurs` was run; what it leaves out is in the
`data` rows and in § Kit plan.

## Action types per file

What the files use that matters for damage, resources, state or timing
(sound, VFX, camera, animation, root motion, rotation, super armour and
teleport actions left out):

| File | Action types that matter |
|---|---|
| attack1–4 | DamageAction (AtkScaleCalculation / atkScale), ObtainCostAction (attack4 `atb` 25), AllowNextSkillAction, ChannelingAction, HitStopAction; attack4: poise unit with onlyEnableForMainChar |
| power_attack (finisher) | DamageAction ×2 (BreakingAttackCalculation, multiplier 0.4 / 0.6), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` (0–35, autoFinishByAction), AirborneAction (**isEnable false**), BlowOffAction, AllowNextSkillAction 35–75 |
| plunging_attack_end | DamageAction (mask 1152), ObtainCostAction |
| dash_attack | DamageAction (mask 131200, poise), skillSpecification 7; not in a skill group |
| normal_skill (battle) | ObtainCostAction costType 1 (`atb_return_base`), CreateBuff `buff_common_obtain_ultimate_sp` ×2 (ratio 0.5 at f0 and f60), AuraAction (`buff_chr_0020_meurs_reduce_damage`), EventListenerAction (abilityEvent 101 and 9) → **JumpToAction 60**, **JumpToAction 45 → 255** (unconditional), CreateBuff `buff_chr_0014_aurora_reduce_damage_remain`, InterruptAction, ChannelingAction (DamageAction, CreateBuff `buff_physical_no_guard`, DoOnce ObtainCostAction `potential5_atb`), TimeDilationAction (layer 1, target and self), MarkCanInterrupt f129, **InterruptCurSkillAction f194**, AllowNextSkillAction 95–129 |
| combo_skill | DamageAction ×2, ObtainCostAction `usp`, TakeDownAction, ModifyDynamicBlackboard (`shield_duration` += `potential3_duration`), CreateBuff `buff_chr_0020_meurs_combo_skill_shield` (self + one teammate), TimeDilationAction (ComboSkill curve), AllowNextSkillAction 24–60 |
| ultimate_skill | UltimateTimeAction 0–38, ChannelingCastingAction 0–103 (cantCastSkill, cantSwitchPosition), CreateBuff `buff_chr_0020_meurs_ult_weak`, InterruptAction ×3, DamageAction ×3, KnockDownAction (not forced), SpawnAbilityEntity (talent shockwave, if `talent_1` ≥ 1), CreateBuff `buff_common_damage_immune_ult_skill`, AllowNextSkillAction 103–120 |
| talent_shockwave (entity) | DamageAction ×3 (f3, f18, f33; mask 512), InterruptCurSkillAction at f29 if `talent_1` < 2 |
| buff_…_potential_1 | abilityEvent 13 + CheckDamageDecorateMask (checkType 1, mask 768) → DamageAction with **MultiplyAttributeCalculation** (attributeType 3 = DEF, multiplier `def_scale`, addition `dmg_base`) |
| buff_…_talent_0 | **StoreAttributeValue** (Will ÷ 10, useFloor, × `rate`) → attributeModifier DEF |
| buff_…_combo_skill_shield | ShieldConfig (MultiplyAttributeCalculation DEF × `shield_def_rate` + `shield_base`), applyTags −1757502026 |
| buff_…_reduce_damage(_remain) | ShelterAction (`taken_dmg`) |
| buff_…_ult_weak | WeakAction (`weak_scale`, `weak_duration`) |
| buff_…_signal_weakness_trigger_combo | TriggerComboSkillAction (on its end); nothing in the data creates it (game code) |
| buff_…_nor_skill_weak, _ult_weak_strong | WeakAction; **never created** by any file (dead data) |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: `atk_scale` 0.79 / 0.87 / 1.22 / 1.60, frames 12 / 10 / 16 / 23; attack4 mask 2097280 (Final Strike), `atb` 25 | supported | `hits[].scale`, `frames`; Final Strike and `atb` from the data. Matches kit-draft |
| 2 | Final Strike stagger: "As the controlled operator, Final Strike also deals {poise} Stagger"; attack4 poise unit `poise` 22, onlyEnableForMainChar | data | kit writes `poise: "poise"`, `poiseControlledOnly: true`; kit-draft doesn't emit poise (D2) |
| 3 | Finisher `power_attack`: two landings f15 / f35, BreakingAttackCalculation `atk_scale` (9) × 0.4 / × 0.6; GainBreakingAttackAtb; disable-cast 0–35. Its AirborneAction is `isEnable: false` | data | `factor: 0.4` / `0.6` hand-written (kit-draft gives two plain `atk_scale` landings, D2); finisher rules are the engine's |
| 4 | Dive attack `plunging_attack_end` (1.8, mask 1152, skillSpecification 6) | supported | refused until rotations have jumps (S10) |
| 5 | Dash attack (skillSpecification 7, not in `chr_0020_meurs_NormalAttack`'s skill list) | supported | left out, as in Gilberta's kit |
| 6 | Battle skill cost 100 SP; "immediately returns some SP": ObtainCostAction costType 1 `atb_return_base` 30 at f0, atbGainMethod 1 | supported | cast trigger with `{kind: sp, value: "atb_return_base"}` (returned SP) |
| 7 | "grants Protection to self and nearby operators": AuraAction 0–83 of `reduce_damage` (ShelterAction `taken_dmg` 0.9), cut at f45 by the jump; then `_remain` 0.5 s (and 1 s at f60 on the retaliation path) | supported | team buff with `{attr: 63, value: "taken_dmg"}`, 2 s; no damage effect (enemy damage isn't simulated), but it is a `protection` category buff for `buffApplied` triggers (Eternal Xiranite `suit_usp02`) |
| 8 | Battle skill timing: `durationFrame` 373, `exclusiveFrame` 285; JumpToAction at f45 → f255 **always**; nothing after f255 but the end | gap | **G2**. The engine plays every timeline frame (Ti3 interim), so Catcher is held 285 frames (9.5 s) instead of 45 + 30 = 75 (2.5 s). The `endAction` interim doesn't work: the action gate ignores a pending `endAction` (checked in scratch, § Kit plan) |
| 9 | Retaliation: "When attacked while the said shield is raised, perform a retaliation bash that deals Physical DMG and applies 1 stack of Vulnerability": EventListener 0–60, abilityEvent 101 (Catcher is hit) with CheckDamageDecorateMask checkType 3 mask 805306368, or abilityEvent 9 with `buff_eny_0018_lbtough_pre_catch` within 3 m → JumpToAction 60. From f60: bash at f83 (`atk_scale` 4.0, poise 20, `buff_physical_no_guard`), InterruptAction 2 s, ends at f194 (InterruptCurSkillAction), recast window 95–129 | gap | **G1** (no enemy attacks) and **G2** (event-driven jump; the skill's end on this path) |
| 10 | Battle skill team energy: `buff_common_obtain_ultimate_sp` with `ratio` 0.5 at f0 **and** 0.5 at f60 (retaliation path only) | gap | **G5**. `teamEnergyFrame` gives all of it at one frame; not attacked, the game gives half |
| 11 | P5 "Hitting an enemy while the shield is active returns {potential5_atb} SP": DoOnce, `potential5_atb` 10 (0 below P5), CheckBuffStackNumAdvanced tag −1757502026 (the combo shield's tag) on Catcher ≥ 1 | supported | on the bash hit: `sp: {if: {buffActive: "combo_shield"}, then: "potential5_atb"}`; waits on row 9 |
| 12 | Combo trigger, part 1: "When an enemy starts charging up a skill" (`buff_chr_0020_meurs_signal_weakness_trigger_combo` → TriggerComboSkillAction; applied by game code) | gap | **G1** |
| 13 | Combo trigger, part 2: "or when the controlled operator is attacked and falls below {trigger_hp_ratio} HP" (0.4) | gap | **G1** plus HP (N1, deferred with multi-enemy support) |
| 14 | Combo hits: f17 `atk_scale` 0.55 with `usp` 10 (ObtainCostAction in the same group); f20 `atk_scale_1` 2.25, poise 10; cooldown 33 s (L12); ComboSkill time dilation | supported | as kit-draft, plus `poise` (data, D2) |
| 15 | Combo TakeDownAction (duration 1, on hit 2's targets); not in the description | unknown | not a physical status in data-sources.md's list (Airborne, KnockDown, Crush, Fracture); assumed no effect. In-game test C |
| 16 | Combo shield: "granting shields to self and another teammate (controlled operator prioritized). DEF can further increase Shield points": `shield_base` 810 + DEF × `shield_def_rate` 5.06, `shield_duration` 10 s + `potential3_duration` | supported | self buff `combo_shield` with no modifiers and duration `{sum: [shield_duration, potential3_duration]}` (for P5's condition). Shield points, breaking on absorption and the teammate's shield have no damage effect |
| 17 | Ultimate: cost 80, cooldown 15 s, `startCdFrame` 9, time stop 0–38, cantCast/cantSwitch 0–103; hits f46 `atk_scale` 2.0 (poise 5), f64 `atk_scale_1` 2.7 (poise 5), f85 `atk_scale_2` 4.0 (`poise1` 10) | supported | as kit-draft, plus `poise` (data) |
| 18 | Ultimate Weakness: `buff_chr_0020_meurs_ult_weak`, `weak_scale` 0.3, `weak_duration` 8 s, created at f46 | supported | enemy buff `{attr: 62, value: weak_scale}`: lowers only the enemy's damage; a `weakness` category buff for triggers. Not compiled (created buff, D2) |
| 19 | Ultimate "applies Knock Down to all enemies": KnockDownAction at f85 before the DamageAction, `knockdown_time` 2, no forceKnockDown | data | `applies: [{kind: physicalStatus, status: knockdown}]` (not forced: on an enemy without Vulnerable it only adds a stack); kit-draft doesn't emit physical statuses (D2) |
| 20 | InterruptAction on every ultimate hit (1 s) and on the bash (2 s) | supported | enemy actions aren't simulated, so no effect; becomes relevant with G1 |
| 21 | Talent 2 "Comprehensive Mindset": "Final hit creates {talent_1+1} shockwave(s), each dealing {atk_scale_shockwave} ATK": entity at f102 if `talent_1` ≥ 1, waves at f105 / 120 / 135; the entity's InterruptCurSkillAction at f29 stops the third if `talent_1` < 2; `atk_scale_shockwave` 0.30 / 0.45 (talent levels 1 / 2); mask 512 | data | `detached` hits with `if: {talentAtLeast: [1, 1]}` (two) and `[1, 2]` (the third). kit-draft gives three waves whenever `talent_1` ≥ 1 |
| 22 | Talent 1 "Resilient Defense": "For every 10 Will, DEF +{rate}" (1.0 / 1.2): `buff_chr_0020_meurs_talent_0`, StoreAttributeValue Will ÷ 10 with useFloor × `rate`, recomputed every 0.1 s | gap | **G4**. The loader leaves it out ("Not in this panel"); at Will 311.7 (P5, Quencher, Æthertech) it's +37.2 DEF |
| 23 | P1 "After hitting the enemy, deals another strike that deals [{dmg_base} + DEF×{def_scale}] of Physical DMG" (300, 5): permanent buff, abilityEvent 13 (Catcher deals damage) with mask 768 (battle or ultimate, checkType 1: any bit), DamageAction with MultiplyAttributeCalculation DEF × 5 + 300, decorate mask 0 | gap | **G3** (a hit whose base isn't ATK). The trigger itself is supported: `on: hit, kinds: [battle, ultimate], by: self`, a `hits` action, `damageType: none`, event key `buff_chr_0020_meurs_potential_1` |
| 24 | How many P1 strikes per ultimate: the data fires on every landing with bit 256 or 512, so 3 ultimate hits + 2–3 shockwaves (5–6), and 1 per bash | unknown | in-game test B; the plan follows the data |
| 25 | P2 DEF +20, Will +10 | supported | stat panel (attribute effects) |
| 26 | P3 combo shield +5 s (`potential3_duration` set to 5) | supported | row 16's duration |
| 27 | P4 ultimate cost ×0.9 (skillParamModifier paramType 1) | supported | tables (72 energy) |
| 28 | Which enemy hits start the retaliation: CheckDamageDecorateMask checkType 3, mask 805306368 (bits 28–29) | unknown | the checkType's meaning (probably "none of these bits": excludes some damage kinds) isn't in the data; matters only once G1 exists |

### Equipment

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| E1 | Darhoff 7: `wpn_attr_main_low` (main attribute +79) and `sk_wpn_claym_0010` "ATK +{atk_up}" (cardAttributeModifier attr 2, formulaItem 7: flat +33.6) | supported | stat panel; no kit file needed |
| E2 | Industry 0.1: Strength +93, ATK +23.4% (panel); "When the wielder's battle skill hits the enemy, the wielder gains ATK +{atk_up} for {duration}s. Effects of the same name cannot stack": abilityEvent 302 + mask 256 (checkType 2) → `buff_wpn_claym_0003` (ATK% +0.336, 20 s, stackingType 4: refreshed) | supported | `on: {event: hit, kinds: [battle]}, by: self` → buff `{zone: atk, value: atk_up}`. On Catcher only the bash is a battle-skill hit (G1); P1's strike has mask 0 and doesn't count |
| E3 | Quencher: Will +93, HP +46.8% (panel); "When the wielder performs a Final Strike on the enemy, the wielder gains ATK +{atk_up} for {duration}s": abilityEvent 302 + mask 2097152 → `buff_wpn_claym_0009` (+0.336, 10 s, stackingType 4) | supported | `on: {event: hit, finalStrike: true}, by: self` |
| E4 | Æthertech 3-piece: "Wearer's ATK +{atk_up}" (0.08, cardAttributeModifier) | supported | stat panel |
| E5 | Æthertech: "After the wearer applies Vulnerability, the wearer gains Physical DMG Dealt +{phy_dmg_up} for {duration}s. This effect can reach {max_stack} stacks": abilityEvent 102 + Vulnerable tag 1075718177 → `_damagebuff` (attr 50 +0.08, 15 s, **stackingType 8**, max 4: layers share one duration that each new layer refreshes) | supported | composite, exact: a counter stack (max 4) gained by an `on: vulnerable, by: self` trigger, then a reapplied buff whose value is `phy_dmg_up × stackCount` (reapplying resets the shared timer), and a `buffEnded` trigger that empties the counter. Checked in scratch: 1, 2, 3 layers give 0.08 / 0.16 / 0.24. Lift and Knock Down emit the `vulnerable` event too (status.ts `addVulnerable`) |
| E6 | Æthertech: "If the target has {stack_cond} stacks of Vulnerability, the wearer gains an additional Physical DMG Dealt +{phy_dmg_up2} for {duration2}s. This effect cannot stack" (4, +0.16, 10 s, stackingType 4) | supported | same trigger, `{kind: buff, if: {enemyVulnerable: 4}}` (checked in scratch) |
| E7 | AIC Heavy 3-piece: "Wearer's HP +{hp_up}" (500, flat) | supported | stat panel. `buff_equipsuit_will_01` in its `buffs` has only a blackboard (no effect; Mordvolt Resistant lists it too) |
| E8 | AIC Heavy: "After the wearer defeats an enemy, the wearer restores {hp_add} HP. Effect trigger cooldown: {cd}s" (abilityEvent 222, objectTypeMask 16) | gap | N1 (kills; deferred with multi-enemy support). No damage effect |
| E9 | MI Security 3-piece: "Wearer's Critical Rate +{crit_up}" (0.05) | supported | stat panel |
| E10 | MI Security: "After the wearer scores a critical hit, the wearer gains ATK +{atk_up} for {duration}s. This effect can reach {max_stack} stacks. At max stacks, grant an additional Critical Rate +{crit_up2}. This effect cannot stack": abilityEvent 44 → `_critsuitatk_01` (ATK% +0.05, 5 s, stackingType 8, max 5); on a layer change at ≥ 5 → `_critsuitdmg_01` (Crit Rate +0.05, lifeType 1), ended when `_critsuitatk_01` ends | gap | **G6** (no crit event). The rest is the E5 composite plus `stackAtLeast` and `endBuff` (loads) |

**Counts:** operator 28 mechanics: 14 supported, 4 data, 7 gap, 3
unknown, 0 unique?. Equipment 10: 8 supported, 2 gap (one is N1).

## Gaps

### G1. Enemy actions: being attacked, an enemy charging a skill

- **family:** *new* (enemy actions). None fits: triggers react to what
  operators and the enemy's status do, and the engine has no model of what
  the enemy does. The trigger and skill halves belong to triggers and G2.
- **feature:** the scenario lists the enemy's actions, e.g.
  `enemyActions: [{at: 6.5, kind: "attack", target: "controlled"}, {at:
  12, kind: "charge"}]` (`target`: the controlled operator, an operator ID,
  or the team). The engine emits events `{type: "enemyAttack", frame,
  target}` and `{type: "enemyCharge", frame}`; triggers listen with `on:
  {event: "enemyAttack", target: "self" | "controlled"}` and `on: {event:
  "enemyCharge"}`. With nothing listed, nobody is attacked (today's
  behaviour). Catcher's combo then has `openCombo` on `enemyCharge`; its
  second trigger also needs the controlled operator's HP (N1). Search would
  take the enemy's actions as given, not choose them.
- **evidence:** CharGrowthTable `chr_0020_meurs_ComboSkill` "COMBO
  TRIGGER: When an enemy starts charging up a skill, or when the
  controlled operator is attacked and falls below {trigger_hp_ratio:0%}
  HP"; `chr_0020_meurs_NormalSkill` "When attacked while the said shield
  is raised, perform a retaliation bash"; `chr_0020_meurs_normal_skill`
  EventListenerAction 0–60 (abilityEvent 101 → JumpToAction 60).
  **Shared:** the same listener (abilityEvent 101, mask 805306368) is in
  Snowshine's (`chr_0014_aurora_normal_skill`, listener 0–51), Purrchena's
  (`chr_0038_purrche_normal_skill`, `_block_*`, `_loop_*`, combo) and
  Ember's (`chr_0009_azrila_normal_skill`) files; "When the controlled
  operator is attacked" is Ember's and Purrchena's combo trigger, and
  Snowshine's is "After controlled operator gets attacked and drops below
  {trigger_hp_ratio} HP". Four operators: an owner decision before
  implementation (kit-process.md "Deferring").
- **impact:** Catcher's battle-skill damage (bash 4.0 × ATK, 1 Vulnerable,
  P1's strike, P5's SP, Industry 0.1's trigger) never happens; her combo
  either never opens (with a trigger) or opens whenever it's off cooldown
  (without one, today's default): 2.8 × ATK every 33 s that may not be
  there.

### G2. Jumps in a skill's timeline, and a skill's own end

- **family:** timing (Ti3) and skills (the action gate).
- **feature:** when a JumpToAction runs, the cast's playhead moves from
  frame `at` to frame `to`: hits, windows, channels, delayed cast-trigger
  actions, team-energy parts and the skill's `exclusiveFrame` /
  `durationFrame` between them are skipped, and those after come
  `at − to` frames sooner (if `to < at` frames repeat). Unconditional jumps
  come from SkillData (the loader can read them; the compiler already
  lists them); event-driven ones are written in the kit, e.g. `jumps: [{on:
  {event: "enemyAttack", target: "self"}, from: 0, until: 45, to: 60}]`,
  judged while the playhead is in `[from, until)`. An
  InterruptCurSkillAction on the skill's own timeline (f194) ends the
  action there. The action gate must see such ends: today `earliestStart`
  judges the gate on the state before pending actions run, so an
  `endAction` the cast scheduled doesn't free the operator (the open item
  from batch 1's review, "the action gate read before the state is
  advanced": 5 frames for Liino, 210 here).
- **evidence:** `chr_0020_meurs_normal_skill`: JumpToAction [45–46] → 255;
  durationFrame 373, exclusiveFrame 285 (in the 255–373 segment that only
  the no-attack path reaches); retaliation segment 60–194 ending in
  InterruptCurSkillAction. Only a skipping jump makes these frames
  consistent, so Catcher's data supports the "jumps skip time" reading that
  in-game test 17 asks about for Laevatain (batch 1 Ti3; also Liino R5).
  Snowshine's battle skill has the same shape (InterruptCurSkillAction
  f106, listener 0–51).
- **impact:** every battle skill holds Catcher 9.5 s instead of 2.5 s
  (scratch run: next action at 9.50 s, also with `at: 2.4`); any rotation
  using it is wrong by 7 s per cast. With G1, the bash lands 23 frames
  after the attack and the action ends 134 frames after it.

### G3. A hit whose base isn't ATK

- **family:** values (and data compilation for the calculation type).
- **feature:** a hit field `base: ValueExpr` that replaces the ATK zone
  (`scale` may then be empty; every other zone, crit included, as usual):
  `"base": {"sum": ["dmg_base", {"product": [{"attr": 3}, "def_scale"]}]}`.
  The data's form is MultiplyAttributeCalculation (`attributeType`,
  `multiplier`, `addition`, `valueSource`), so the compiler can emit it.
  Not `fixedDamage`: the strike is Physical DMG with zones (no damageType
  8).
- **evidence:** `buff_chr_0020_meurs_potential_1` DamageAction
  `atkCalculation: MultiplyAttributeCalculation {attributeType: 3,
  multiplier: $def_scale, addition: $dmg_base}`; P1 text above. The same
  calculation type is used with ATK and an addition by Typhoeus's
  `chr_0034_typhoea_archery_projectile_bounce_projhit` (ATK × 1.2 + 1250,
  not in her kit) and with attribute 1 by `chr_0016_laevat_dung_abilityentity`
  (dungeon). Among operator effects only Catcher's uses a non-ATK
  attribute, but the mechanism is a generic calculation type, so it's
  shared, not unique.
- **impact:** P1's strikes missing. In the scratch build (P5, Quencher
  9/9/9, Æthertech ×4 at artifice 3: ATK 2757, DEF 160, + talent 1's 37 =
  197) each strike is 300 + 5 × 197 = 1285 ≈ 0.47 × ATK before zones; up to
  6 per ultimate (≈ 2.8 × ATK on top of the ultimate's 10.05 × ATK, though
  without the ultimate DMG bonus) and 1 per bash.

### G4. Attribute-derived values: floor, and attributes from buffs

- **family:** values.
- **feature:** a ValueExpr `{floor: ValueExpr}`, and `{attr: n}` read in a
  fight as the panel plus the operator's active buffs' attributes (today
  `evaluate` reads the panel only; buff attributes reach only Ultimate Gain
  Efficiency and Haste through `buffAttr`). Talent 1 is then a permanent
  self buff applied on `fightStart` with `{attr: 3, value: {product:
  [{talent: 0, key: "rate"}, {floor: {product: [{attr: 42}, 0.1]}}]}}`.
  Alternatively the loader compiles talent-attached StoreAttributeValue
  buffs into derived panel modifiers (the value is static unless Will
  changes in the fight).
- **evidence:** `buff_chr_0020_meurs_talent_0` StoreAttributeValue
  (attributeType 42, divisorValue 10, useFloor, multiplierValue `rate`) →
  attributeModifier attr 3; PotentialTalentEffectTable
  `chr_0020_meurs_talent_1_1/2` (rate 1.0 / 1.2). Shared:
  StoreAttributeValue with useFloor is in Arclight's talent
  (`buff_chr_0007_ikut_talent_1`, per 15 Agility / Intellect → Physical /
  Electric DMG) and without floor in Xaihi's (`buff_chr_0011_seraph_atk_buff`).
- **impact:** +37 DEF in the scratch build → +186 per P1 strike (≈ 14% of
  P1's damage, ≈ 4% of an ultimate with its strikes); shield size (no
  damage effect).

### G5. A battle skill's team energy in parts

- **family:** skills (team energy; D2 lists team-energy frames as a
  compiler leftover).
- **feature:** `teamEnergy: [{frame: 0, ratio: 0.5}, {frame: 60, ratio:
  0.5}]` on a skill, replacing `teamEnergyFrame`: each part gives `ratio` ×
  the natural-SP energy at its timeline frame, dropped if the cast is cut
  before it or a jump skips it (G2). Compilable from each
  `buff_common_obtain_ultimate_sp` CreateBuff's `ratio`.
- **evidence:** `chr_0020_meurs_normal_skill` [0–3] and [60–62] CreateBuff
  `buff_common_obtain_ultimate_sp` with `ratio` 0.5 (useDirectValue);
  `buff_common_obtain_ultimate_sp` ObtainUspInNormalSkill coefficient
  `ratio`. Snowshine's battle skill has the same pair (f0, f107).
- **impact:** not attacked, each team member gets 3.25 energy per 100
  natural SP from Catcher's battle skill, not 6.5 (the engine gives 6.5).

### G6. Critical-hit events

- **family:** triggers (a hit filter), with an owner decision on how
  `crit: expected` fires them.
- **feature:** hit events carry `crit`; a hit trigger takes `crit: true`.
  With `crit: always` / `never` it's exact. Under `expected` the engine
  needs a rule, e.g. a deterministic expected-crit accumulator per operator
  (each hit adds its crit rate; a hit that takes the sum past an integer
  counts as a crit), or seeded random crits per run.
- **evidence:** `buff_equipsuit_critsuit_01` abilityEvent 44 → CreateBuff
  `_critsuitatk_01`; description quoted in E10. Shared: abilityEvent 44 is
  also in `sk_wpn_sword_0022`, `sk_wpn_pistol_0010` and
  `buff_chr_0028_wulfa_ult_critical_firedamage` (Rossi).
- **impact:** MI Security's ATK +5–25% and Crit Rate +5% (the set's whole
  conditional effect) missing; the scratch placeholder (on every hit)
  overstates it.

## Verification

No committed or pending fixture has Catcher (`grep chr_0020_meurs
fixtures/`: none).

Logs that would verify the kit (ZMDLogs):

- Catcher at P1 or higher (ideally P5), talent 2 at level 2, against an
  enemy that attacks and charges skills (a boss): battle skills that
  retaliate (event `chr_0020_meurs_normal_skill`), the ultimate
  (`chr_0020_meurs_ultimate_skill`, `chr_0020_meurs_talent_shockwave`), P1's
  strikes (`buff_chr_0020_meurs_potential_1`: how many per ultimate settles
  row 24; their values settle G3 and G4's DEF), the combo after an enemy's
  charge (G1), a finisher (factors 0.4 / 0.6). Cast times give the battle
  skill's real length (G2).
- Equipment: Æthertech on Catcher with a teammate who adds Vulnerable
  (Estella's or Gilberta's Lifts) so the layers and the 4-stack bonus show
  (`buff_equipsuit_poisedmg_01_damagebuff` / `_attackbuff`); Quencher's
  `buff_wpn_claym_0009` after attack4; Industry 0.1 after a bash; MI
  Security's `buff_equipsuit_critsuitatk_01` layers against the logged
  crits (G6). A teammate with Eternal Xiranite (`suit_usp02`) would show
  Catcher's Protection and Weakness as category buffs.

In-game tests (new; none of the existing ones covers Catcher). Test 17
(Laevatain's battle-skill jumps) asks G2's question for another operator;
either answers both.

- **A. How long Catcher's battle skill holds her** (ready, if you have
  Catcher). Against a dummy that doesn't attack: cast the battle skill and
  mash basic attack; about 2.5 s to the attack means jumps skip time,
  about 9.5 s means they don't. Against an attacking enemy: the bash comes
  about 0.8 s after the blocked hit, and she's free about 4.5 s after it.
- **B. How many extra strikes P1 deals** (ready, if you have Catcher at
  P1+ with talent 2 at level 2). Ultimate on a dummy: count the small
  extra damage numbers (DEF-based, no ultimate bonus): 3 (main hits only)
  or 5–6 (the shockwaves too)? A retaliation bash should add 1.
- **C. Does the combo's slam leave Vulnerability?** (lower priority) On an
  enemy without Vulnerability, cast Catcher's combo: does a Vulnerability
  stack or a Knock Down appear? (The data has a TakeDownAction, which the
  engine treats as nothing.)
- **D. Which enemy skills light Catcher's combo** (later, with G1): note
  whether every charge-up lights it or only those with the interrupt
  warning.

## Kit plan

Written today (it loads), in a scratch copy of the repository
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch2/scratch-chr_0020_meurs/repo`,
kits `packages/data/kits/operators/chr_0020_meurs.json` and
`packages/data/kits/equipment/{wpn_claym_0003,wpn_claym_0009,suit_poise01,suit_criti01}.json`):
`efsim calc` lists every hit, `efsim simulate` runs a rotation, and the
data package's tests pass (`vitest run packages/data`: 196 of 196).

### Operator kit (today)

- **Stacks:** none.
- **Buffs:** `protection` (team, 2 s, `{attr: 63, value: taken_dmg}`),
  `combo_shield` (self, `{sum: [shield_duration, potential3_duration]}`
  from the combo, no modifiers), `weakness` (enemy, `weak_duration`,
  `{attr: 62, value: weak_scale}` from the ultimate).
- **Skills** (frames from SkillData; events default to the skill):
  - attack1–4: `atk_scale` at 12 / 10 / 16 / 23; attack4 `poise: "poise"`,
    `poiseControlledOnly: true`.
  - power_attack: `atk_scale` at 15 `factor: 0.4` and at 35 `factor: 0.6`.
  - plunging_attack_end: `atk_scale` at 1 (not castable until jumps).
  - normal_skill: `hits: []`, `teamEnergyFrame: 0` (G5: the full amount
    today).
  - combo_skill: `atk_scale` at 17 with `energy: "usp"`; `atk_scale_1` at
    20 with `poise: "poise"`, `buffs: [{buff: "combo_shield"}]`. No
    `openCombo` trigger (G1): castable whenever off cooldown.
  - ultimate_skill: `atk_scale` at 46 (`poise`, `buffs: [weakness]`),
    `atk_scale_1` at 64 (`poise`), `atk_scale_2` at 85 (`poise: "poise1"`,
    `applies: [{kind: physicalStatus, status: knockdown}]`); shockwaves
    `detached`, events `chr_0020_meurs_talent_shockwave`: two at 105 / 120
    with `if: {talentAtLeast: [1, 1]}`, one at 135 with `[1, 2]`.
- **Triggers:** `battle_sp` (cast of normal_skill → `sp:
  atb_return_base`, `buff: protection`).

The interim `battle_end_unattacked` (cast trigger, `delay: 75`,
`endAction`) is in the scratch kit but **doesn't work** (G2: next action
still at 9.50 s); drop it rather than ship it.

Scratch run (P5, Quencher, Æthertech ×4; battle skill, attack1,
ultimate, combo, attacks 1–4): 34,229 damage; the ultimate's Knock Down
adds 1 Vulnerable, and Æthertech's first layer (+0.08 Physical) acts from
the first shockwave on.

### Waiting on gaps (JSON as proposed, not loadable today)

Battle skill with G1, G2 and G5 (the retaliation as an event-driven jump;
the skill's own unconditional jump and its end at f194 read from
SkillData):

```json
{
  "skillId": "chr_0020_meurs_normal_skill",
  "label": "Battle skill",
  "damageType": "battle",
  "teamEnergy": [{ "frame": 0, "ratio": 0.5 }, { "frame": 60, "ratio": 0.5 }],
  "jumps": [{ "on": { "event": "enemyAttack", "target": "self" }, "from": 0, "until": 45, "to": 60 }],
  "hits": [
    {
      "id": "bash",
      "scale": ["atk_scale"],
      "frames": [83],
      "poise": "poise",
      "applies": [{ "kind": "vulnerable" }],
      "sp": { "if": { "buffActive": "combo_shield" }, "then": "potential5_atb" }
    }
  ]
}
```

The bash at f83 is reached only through the jump (the unconditional
45 → 255 skips it otherwise). Combo trigger with G1:

```json
{ "id": "combo_window", "on": { "event": "enemyCharge" }, "by": "anyone", "do": [{ "kind": "openCombo" }] }
```

(the "attacked below 40% HP" half waits on N1). P1 with G3:

```json
{
  "id": "p1_strike",
  "on": { "event": "hit", "kinds": ["battle", "ultimate"] },
  "by": "self",
  "if": { "potentialAtLeast": 1 },
  "skill": "buff_chr_0020_meurs_potential_1",
  "do": [{ "kind": "hits", "hits": [{
    "id": "strike", "scale": [], "damageType": "none", "element": "physical",
    "base": { "sum": ["dmg_base", { "product": [{ "attr": 3 }, "def_scale"] }] },
    "events": ["buff_chr_0020_meurs_potential_1"], "frames": [0]
  }] }]
}
```

`dmg_base` / `def_scale` come from the potential's attached blackboard
(the stat panel's sources hold `buff_chr_0020_meurs_potential_1:
{def_scale: 5, dmg_base: 300}`, checked). The strike's own hit is kind
`none`, so it doesn't trigger itself. Talent 1 with G4: a `fightStart`
trigger applying a permanent self buff `{attr: 3, value: {product:
[{talent: 0, key: "rate"}, {floor: {product: [{attr: 42}, 0.1]}}]}}`.

### Equipment kits

- **wpn_claym_0010** (Darhoff 7): stats only; no file needed (or a
  sources-only file like `suit_heal01`).
- **wpn_claym_0003** (Industry 0.1): buff `wpn_claym_0003.atk` (self,
  `gameBuff: buff_wpn_claym_0003`, `duration`, `{zone: atk, value:
  atk_up}`); trigger `on: {event: hit, kinds: [battle]}, by: self, skill:
  sk_wpn_claym_0003` → that buff. Loads.
- **wpn_claym_0009** (Quencher): the same with `on: {event: hit,
  finalStrike: true}` and `buff_wpn_claym_0009`. Loads.
- **suit_poise01** (Æthertech): loads and runs as checked:

```json
{
  "stacks": [{ "id": "suit_poise01.layers", "label": "Æthertech layers", "max": 4 }],
  "buffs": [
    { "id": "suit_poise01.dmg", "label": "Physical DMG per layer", "target": "self", "gameBuff": "buff_equipsuit_poisedmg_01_damagebuff", "duration": "duration",
      "modifiers": [{ "attr": 50, "value": { "product": ["phy_dmg_up", { "stackCount": "suit_poise01.layers" }] } }] },
    { "id": "suit_poise01.dmg2", "label": "Physical DMG at 4 Vulnerable", "target": "self", "gameBuff": "buff_equipsuit_poisedmg_01_attackbuff", "duration": "duration2",
      "modifiers": [{ "attr": 50, "value": "phy_dmg_up2" }] }
  ],
  "triggers": [
    { "id": "suit_poise01.on_vulnerable", "on": { "event": "vulnerable" }, "by": "self", "skill": "passive_equipsuit_poisebreak_01",
      "do": [
        { "kind": "gain", "gains": [{ "stack": "suit_poise01.layers", "amount": 1 }] },
        { "kind": "buff", "buff": "suit_poise01.dmg" },
        { "kind": "buff", "buff": "suit_poise01.dmg2", "if": { "enemyVulnerable": 4 } }
      ] },
    { "id": "suit_poise01.layers_end", "on": { "event": "buffEnded", "buff": "suit_poise01.dmg" }, "by": "self",
      "do": [{ "kind": "gain", "gains": [{ "stack": "suit_poise01.layers", "amount": -4 }] }] }
  ]
}
```

  `stack_cond` (4) is a literal in `enemyVulnerable` (a number there).
  The counter-plus-buff pattern stands for BuffData stackingType 8 (shared,
  refreshed duration); MI Security uses it too, so the pattern review
  should decide whether `maxStacks` gets a shared-duration mode instead.
- **suit_stragi01** (AIC Heavy): sources-only file (HP in the panel; the
  kill heal waits on N1 and has no damage effect).
- **suit_criti01** (MI Security): counter `suit_criti01.layers` (max 5),
  buff `suit_criti01.atk` (`{zone: atk, value: atk_up × stackCount}`,
  `duration`), buff `suit_criti01.crit` (no duration, `{zone: critRate,
  value: crit_up2}`), triggers: on a crit (G6; the scratch file uses every
  hit as a placeholder) → gain 1, apply `.atk`; `stackAtLeast` 5 → apply
  `.crit`; `buffEnded .atk` → gain −5, `endBuff .crit`. Loads; not to be
  shipped before G6.

## Kit (2026-10-19)

Written against the engine after batch 2's shared features (S1 jumps, S5
team energy, S6 gate, V1 `base`, V2 floor/div, B3 shared timers, E1 enemy
actions, E2 rolled crits).

### Re-analysis of the gaps

| Gap | Now | How |
|---|---|---|
| G1 enemy attacks and charges | covered (one half deferred) | scenario `enemyActions`; trigger `counter` on `{event: attacked}`, `by: self`; trigger `combo_window` on `{event: enemyCharge}` → `openCombo`. Still open: the combo's "controlled operator attacked below 40% HP" half (HP, N1, deferred); the listener's abilityEvent 9 branch (one enemy's grab, `buff_eny_0018_lbtough_pre_catch`); which attacks pass CheckDamageDecorateMask checkType 3 (all are assumed to; row 28) |
| G2 jumps, the skill's own end | covered | SkillData: the unconditional 45 → 255 and InterruptCurSkillAction at 194 are read by the loader (`timing.jumps`, `timing.ends`); the counter is a trigger action `{kind: jump, skill: normal_skill, from: 0, until: 60, to: 60}` (frames 46–59 are unreachable anyway). See K2 |
| G3 hit base not ATK | covered | P1's strike: `base: {sum: [dmg_base, {product: [{attr: 3}, def_scale]}]}`, `scale: []`, `damageType: none` |
| G4 floor, attributes with buffs | covered | talent 1: permanent self buff `resilient_defense` on `fightStart`, `{attr: 3, value: rate × floor(Will ÷ 10)}`; DEF is a read attribute, and `{attr: 3}` in P1's base includes it |
| G5 team energy in parts | covered | `teamEnergy: [{frame: 0, ratio: 0.5}, {frame: 60, ratio: 0.5}]`; the jump 45 → 255 skips the second part, so it needs no condition |
| G6 crit events | covered | MI Security's trigger `on: {event: hit, crit: true}`; it acts only with `crit: rolled` (or `always`) |
| Row 8 (exclusive 285) | covered | not attacked, the next action may start 75 frames after the cast (2.5 s) |
| Æthertech / MI Security layers (B3) | covered | `maxStacks` with the loader's `sharedTimer` from stackingType 8 |
| Data rows (poise, finisher factors, Knock Down, shockwaves) | hand-written | D3 (compiler leftovers) still open; the finisher factors are new KNOWN entries in skillCompile.test.ts |

New gaps (not implemented; engine and loader code untouched):

- **K1. Weakness and Protection buffs can't be written** (family: buff
  lifecycle / loader check). B4's check refuses a kit-buff attribute that
  `buffAttrHasEffect` doesn't list, and `READ_ATTRS`
  (packages/engine/src/effects.ts) lacks 62 (WeaknessDmgScalar) and 63
  (ShelterDmgScalar), although `buffCategories` (timeline.ts) reads exactly
  those to give a buff its Weakness / Protection category for `buffApplied`
  triggers. Evidence: loading `{attr: 62, value: weak_scale}` fails with
  "attribute 62 feeds no damage zone and nothing reads it". Fix: add both
  to `READ_ATTRS` (read by buffCategories). Impact: Catcher's Protection
  (battle skill) and Weakness (ultimate) have no modifiers, so Eternal
  Xiranite (`suit_usp02`: team DMG when its wearer applies Amp,
  Protection, Susceptibility or Weakness) never fires from them when she
  wears it; no other damage effect (damage taken isn't simulated).
  Snowshine's Protection (batch 3) has the same need. Interim: the buffs
  keep their `gameBuff` but have empty modifiers; once fixed, put back
  `{attr: 63, value: taken_dmg}` and `{attr: 62, value: weak_scale}` (as
  their notes say).
- **K2. A rotation step judged before an event-driven jump misses the
  skill's later end** (family: timing; follow-up of S1 / S6).
  `earliestStart` binary-searches for the first frame the current action
  changes, then judges the start plainly from there. For a battle skill
  cast before the attack, the first change is the counter's jump (at the
  attack), and the plain judgement from there maps the exclusive frame 285
  through the jump (255 real frames after the cast for an attack at frame
  30) instead of seeing the end at 194 (164). Evidence: debug run, attack
  at frame 30: `earliestStart` for attack1 gives 255 from frame 0 and 164
  from frame 60 (the test "attacked in frames 0–45" pins the latter).
  Fix: repeat the search from the frame it found while the action keeps
  changing before the plain result (call `earliestStart` instead of
  `startFrom` on the advanced state, bounded by the horizon). Impact: the
  step after an attacked battle skill starts about 3 s late (in a first
  draft of the example, attack1 at 8.5 s instead of 5.47 s); higher-priority
  steps with an explicit `at`, and the battle skill's own recast window,
  are judged right. Interim: the example uses the recast window after the
  first counter and gives the ultimate after the second an explicit time.
- Not new, noted: the counter's TimeDilationAction at frame 60 (layer 1,
  0.7 s, on Catcher and the attacker) is an entity-layer slow-down, which
  design.md lists as not modelled; the bash may land about 0.3 s later in
  the game than here. The enemy's InterruptAction (2 s at the bash, 1 s
  per ultimate hit) has no effect on scripted enemy actions.

A layer-count predicate (BuffData CheckBuffStackNum) would let MI
Security's Crit Rate check read the layered buff itself; the counter stack
it uses instead is exact (the layers share one timer), so it isn't a gap.

### What was written

- `packages/data/kits/operators/chr_0020_meurs.json`: the plan's kit, with
  the battle skill's bash (frame 83: `atk_scale`, `poise`, 1 Vulnerable,
  P5's `sp: {if: {buffActive: combo_shield}, then: potential5_atb}`),
  `teamEnergy` in halves, triggers `resilient_defense` (fightStart),
  `battle_sp` (30 returned SP, Protection), `counter` (jump), `combo_window`
  (enemyCharge), `p1_strike` (on battle and ultimate hits, P1+); buffs
  `protection`, `combo_shield`, `weakness`, `resilient_defense`. The
  scratch interim `battle_end_unattacked` is gone (jumps do it).
- Equipment: `wpn_claym_0003` (Industry 0.1: ATK up on a battle-skill hit),
  `wpn_claym_0009` (Quencher: on a Final Strike), `suit_poise01`
  (Æthertech: a layered shared-timer buff per Vulnerable, `beforeDamage`,
  and the extra buff at 4 Vulnerable), `suit_criti01` (MI Security:
  layered shared-timer ATK per crit, a counter stack, Crit Rate at 5 until
  the layers end), and sources-only `wpn_claym_0010` (Darhoff 7, stats
  only) and `suit_stragi01` (AIC Heavy: HP in the panel; the kill heal is
  N1).
- `examples/catcher-p5.json` (P5, Quencher 9/9/9, Æthertech ×4 at artifice
  3) and `examples/catcher-counter.scenario.json` (solo vs Rhodagn; attacks
  at 1, 12 and 23 s, a charge at 7 s).
- `tests/kit-catcher.test.ts` (11 tests: both battle-skill paths and their
  timing, team energy, the counter's range, P5's SP, the combo window, the
  ultimate's shockwaves and P1 strikes by talent and potential, P1's value
  with talent 1's DEF, each equipment kit); Catcher added to the compiler
  comparison (skillCompile.test.ts) with its two finisher factors in
  KNOWN.

### Deviations from the plan

- Æthertech and MI Security use `maxStacks` with the loader's shared timer
  (B3) instead of the counter-plus-`stackCount` composite; MI Security
  keeps a counter only for its max-layers check.
- Æthertech's trigger is `beforeDamage` (the data creates the Vulnerable
  before the DamageAction, and the abilityEvent runs inside it), so the
  bash that applies a Vulnerable already has its layer.
- Protection and Weakness have no modifiers (K1).
- The counter's range is `until: 60` (the listener's frames); the skill's
  own jump at 45 makes it equivalent to 45.

### Verification

- `npm run check`: typecheck, lint, all tests and the tool tests pass.
- Example `catcher-counter`: 100,366 damage in 25.40 s. Counter bashes at
  1.77, 13.13 and 25.40 s (each with a P1 strike and a Vulnerable; the
  second with the combo's Link and P5's SP), the recast at 2.17 s held
  2.5 s (no attack), combo at 7.77 s after the charge (shield), ultimate at
  17 s (Weakness, Knock Down, 3 shockwaves, 6 P1 strikes), Æthertech from 1
  to 4 layers on one timer with its 4-Vulnerable bonus at 25.40 s, Quencher
  after each Final Strike. Every trigger, buff, stack and jump of the kits
  fires in the example or in kit-catcher.test.ts (MI Security with crits
  `always`; Industry 0.1 after a bash).
- Other examples unchanged (none wears this equipment): arcane-will-solo
  102,141; estella-solidification 186,537; gilberta-gravity-field 375,390;
  laevatain-solo 739,231; liino-laevatain 619,381; si-laevatain 1,017,030;
  typhoeus-gilberta 1,058,494.
- Log fixtures: none has Catcher. Every committed and pending fixture's
  `zmdlogs check` output is identical before and after these kits
  (diffed): the equipment is worn only by operators without kits
  (Æthertech 3-piece on Ember in pending 7e19489ae503, with 11 / 14 logged
  damagebuff / attackbuff entries; MI Security on Rossi in 4e5e1390085e and
  Yvonne in pending abfd4b7478ec; single pieces elsewhere). Logs list the
  per-layer value only (0.05 on every critsuitatk entry) and no crit-rate
  zones, so MI Security's layer count and Crit Rate can't be read from
  them. Ember's kit (batch 3) will make 7e19 check Æthertech.
- Logs that would check Catcher: as in § Verification (a ZMDLogs battle
  with Catcher at P1+, talent 2 at level 2, against a boss that attacks and
  charges: `chr_0020_meurs_normal_skill` bashes, the
  `buff_chr_0020_meurs_potential_1` strikes per ultimate, the combo after a
  charge, cast times for the battle skill's two lengths), plus Industry 0.1
  or Quencher on her, and MI Security on any operator with a kit.

### Open questions and proposed in-game tests

Tests A–D above stand (A asks for Catcher what in-game test 17 settled for
Laevatain; the engine assumes jumps skip time). New:

- **E. The counter's recast** (ready). Let an enemy hit Catcher's raised
  shield, then press the battle skill again as soon as the bash lands:
  does she start a second battle skill about 1–2 s after the hit (the
  data's window), well before the counter would end (about 4.5 s after
  it)?
- **F. Which attacks trigger the counter** (ready). Raise the shield
  against a ranged or area attack, not only a melee swing: does the bash
  come every time? (CheckDamageDecorateMask checkType 3, row 28.)
- **G. Does a dodged attack count?** (with in-game test 53) Cast the battle
  skill, then dash through the enemy's hit: bash or not?

Ready now, for anyone with Catcher: A, B, C, E and F.
