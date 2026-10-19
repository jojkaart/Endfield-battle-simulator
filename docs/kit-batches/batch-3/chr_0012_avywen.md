# Avywenna (chr_0012_avywen): gap report, batch 3

Operator Avywenna (Electric, Striker: CharGrowthTable `charTypeId` Pulse,
`profession` 8, `mainAttrType` 42 Will, `subAttrType` 40 Agility,
`weaponType` 5 Polearm, rarity 5). Equipment covered here (owner of each,
[batch-3.md](../batch-3.md)): `wpn_lance_0004` Chimeric Justice,
`wpn_lance_0006` Cohesive Traction, `wpn_lance_0013` OBJ Razorhorn. No
gear set.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
I18nTextTable_EN; Json/SkillData `chr_0012_avywen_*` (23 files),
`sk_wpn_lance_0004/0006/0013`; Json/BuffData `buff_chr_0012_avywen_*`
(13 files), `buff_wpn_lance_0004_*`, `_0006_*`, `_0013_*`,
`buff_common_affixes_vulnerable_*`. Values at skill level 12 / weapon
skill level 9 unless stated. Her SkillData and BuffData arrived in the
checkout during this analysis (commit 535e88f); everything below is read
from them. `efsim kit-draft chr_0012_avywen` was run on the main checkout;
the kit plan was loaded and simulated from a scratch copy (see "Kit
plan").

No log fixture has Avywenna or any of her three weapons.

Claims re-checked:
- *Reference simulators* (read before her data was fetched, as claims):
  Zero Sanity applies P5's ×1.15 to the battle skill's own hit too.
  **Contradicted:** only `chr_0012_avywen_combo_skill_lance_back` and
  `_ultimate_skill_lance_back` have the `potential_5_rate` branch; the
  battle skill's own DamageAction at frame 18 doesn't.
- *Combo `usp` 10* (SkillPatchTable, all levels): **not granted.** The
  combo's only ObtainCostAction costs `talent0_usp` (frame 14, per target,
  gated on `buff_chr_0012_avywen_talent_0`). SkillData's `usp` default is
  0 and no action reads it. The game's own sub-description says
  "Ultimate Energy Gain 0", while every other operator's combo shows its
  `usp`.
- *Ultimate `pulse_resist_down_rate` 0.4 / `_duration` 8* (SkillPatchTable):
  **dead keys.** No action in `chr_0012_avywen_ultimate_skill` reads them,
  and neither does the description. The only other `pulse_resist_down` is
  in `buff_chr_0012_avywen_talent_0_listener`, which no file creates.
- *Tag −1640994543 = "Electric Susceptible"* (P5's check): it is in the
  `applyTags` of `buff_common_affixes_vulnerable_pulse`, `_spell` (Arts
  Susceptibility) and `_all`. So an all-Arts Susceptibility counts too.
- *Tags 1570888476 / 1535684437* (Razorhorn): Cryo Infliction
  (`buff_common_energy_shard_attached_cryst`) and Solidification
  (`buff_common_cryst_cryst_frozen_triggered_do`, `buff_common_cryst_*_triggered`).
  Tag 1075718177 is `buff_physical_no_guard` (Vulnerable), as batch 1 found.

## Data overview

Action types per file that affect damage, resources, state or timing
(visual, audio, camera, push-back, super-armour and targeting actions left
out):

| File | Relevant actions |
|---|---|
| `attack1`–`attack3` | DamageAction mask 128 at frame 7 (`atk_scale`), ObtainCostAction costType 1 `atb` (`atbOnlyMainChar`), HitStopAction, AllowNextSkillAction |
| `attack4` | DamageAction mask 128 at 5 (`atk_scale`) and 18 (`atk_scale_2`), each ObtainCostAction `atb` × 0.5 |
| `attack5` (Final Strike) | DamageAction mask 2097280 at 24 (`atk_scale`), a poise unit (`poise`, `onlyEnableForMainChar`), ObtainCostAction `atb` if controlled |
| `power_attack` (spec. 8) | 3 DamageActions mask 132 at 27 / 28 / 29, BreakingAttackCalculation `multiplier` 0.3 / 0.2 / 0.5; GainBreakingAttackAtb at 27; `buff_common_power_attack_disable_cast_skill` 0–29 |
| `plunging_attack_end` | DamageAction mask 1152 at 1 |
| `normal_skill` (spec. 3, cost 100 SP) | 0–6: finds her lances within 50 m (`buff_…_lance_becalled_ready`); 7: for each combo lance and each ultimate lance, CreateBuff `buff_chr_0012_avywen_lance_becalled` on it (its timeline jumps to 1500 and finishes) and LaunchProjectile back to her (`castSkillOnHit` → `_combo_skill_lance_back` / `_ultimate_skill_lance_back`, `castSkillOnReach` → `_combo_skill_lance_back_reach`); 18: CreateBuff `buff_common_obtain_ultimate_sp`, DamageAction mask 4352 (`atk_scale`, `poise`), HitStop 0.15 s; window 34–60 to itself; `dontInterruptCombo` |
| `combo_skill_lance_back` | IfElse (`potential_5_rate` > 0 **and** the target has tag −1640994543): `atk_scale_lance` × `potential_5_rate`, else × 1; DamageAction mask 4352 + poise `poise_lance`; sets `EntityBB_talent0` = `talent0_usp`; InterruptAction, PullAction, HitStop 0.2 s |
| `ultimate_skill_lance_back` | the same with `atk_scale_lance_ult` / `poise_lance_ult`, plus CreateBuff `buff_chr_0012_avywen_lance_pulse_check` on the target **before** the damage; TimeDilation `interrupt_weakness` 0.4 s |
| `combo_skill_lance_back_reach` | if `EntityBB_talent0` > 0 and she has `buff_…_talent_0`: ObtainCostAction `EntityBB_talent0` (energy when a lance that hit something reaches her) |
| `buff_…_lance_pulse_check` (0.3 s, stackingType 7) | buffEvent 0: if no other pulse_check, SpellInfliction type 1 (Electric) on its owner |
| `combo_skill` (spec. 4) | 14: LaunchProjectile `…_lance_out` to 3 points (`lance_land_pos1–3`), on block `…_combo_skill_lance_gene` (SpawnAbilityEntity `abilityentity_…_combo_skill_lance`); 14: DamageAction mask 12288 (`atk_scale`, `poise`), then, with `buff_…_talent_0`, ObtainCostAction `talent0_usp` per target; TimeDilationAction ComboSkill 0.5 s (0–12); window 21–68 to the battle skill |
| `combo_skill_lance` / `ultimate_skill_lance` (the lance entities) | JumpToAction to 1500 when `lance_becalled`; FinishOwner at 900 if `potential_2` < 1, else at 1500 (30 s / 50 s) |
| `ultimate_skill` (spec. 5, cost 100) | UltimateTimeAction 0–45; 45: LaunchProjectile `…_ultimate_skill_lance_out`, on block `…_ultimate_skill_lance_gene` (spawns the EX lance); 51: if `pulse_vul_duration` > 0 CreateBuff `buff_…_ultimate_skill_debuff` **then** DamageAction mask 4608 (`atk_scale`, `poise`), then `talent0_usp` per target; `buff_common_damage_immune_ult_skill` 0–65; window 57–73 |
| `buff_…_ultimate_skill_debuff` | duration `pulse_vul_duration`, stackingType 2 max 1; buffEvent 5: VulnerableAction subType 6 (Electric), `rate` = `pulse_vul_rate` |
| `buff_…_talent_0` | marker, lifeType 1 (attached by talent 1) |

Unreferenced (nothing creates or casts them): `chr_0012_avywen_passive_listen_combo`,
`_potential_2`, `_talent_0` (skill), `_dodge` and `_dash_attack` (no skill
group), `buff_…_talent_0_listener` (and the `_talent_0_debuff` it names,
which has no file), `buff_…_talent_1_mark`, `_mark_ult`,
`_listen_combo_first_used`, the tutorial and training buffs.

Text (CharGrowthTable + I18nTextTable_EN):
- Basic "Thunderlance: Blitz": 5 sequences, Physical; Final Strike
  `{poise}` Stagger as the controlled operator; dive and finisher text.
- Battle skill "Thunderlance: Interdiction": "Leaps into mid-air to stir up
  a maelstrom with her lance, dealing some Electric DMG to nearby enemies
  while pulling back all Thunderlances and Thunderlance EX in the
  battlefield towards herself. The returning Thunderlances pierce through
  all enemies along their paths and deal Electric DMG, while returning
  Thunderlances EX deal more Electric DMG and also apply Electric
  Infliction."
- Combo "Thunderlance: Strike": "COMBO TRIGGER: When controlled operator
  performs a Final Strike on a target with active Electric Infliction or
  Electrification. Leaps into mid-air and throws 3 Thunderlances at the
  target, then deals 1 hit of Electric DMG to enemies in the area of
  effect."
- Ultimate "Thunderlance: Final Shock": "Throws a Thunderlance EX at the
  target area that deals massive Electric DMG to enemies nearby."
- Talent 1 "Expedited Delivery": "After a thrown or returning Thunderlance
  or Thunderlance EX hits the enemy, Avywenna gains {talent0_usp}
  Ultimate Energy" (3 / 4: skillBbModifier set on normal, combo and
  ultimate skill; attaches `buff_chr_0012_avywen_talent_0`).
- Talent 2 "Tactful Approach": the ultimate "also applies
  {pulse_vul_rate} Electric Susceptibility for {pulse_vul_duration}s"
  (0.06 / 0.10, 10 s).
- P1 "Doubling Down": `talent0_usp` +2. P2 "Pole of Menace": `potential_2`
  = 20 on combo and ultimate ("duration +20 s"). P3 "Hard Negotiator":
  Will +15, Electric DMG +8% (attr 52). P4 "Very Experienced": ultimate
  cost ×0.85. P5 "Carrot and Sharp Stick": `potential_5_rate` = 1.15 on
  the battle skill: "When returning Thunderlances or Thunderlances EX hit
  an Electric Susceptible enemy, the DMG multipliers are increased to
  1.15 times the original."

SkillPatchTable at level 12: attack1–5 `atk_scale` 0.37 / 0.48 / 0.46 /
0.23 + 0.45 (`atk_scale_2`) / 1.13, attack5 `poise` 17, `atb` 19 (attack
1–4 `atb` 0); finisher 9.0; dive 1.8; battle skill `atk_scale` 1.5,
`poise` 5, `atk_scale_lance` 1.68, `poise_lance` 5, `atk_scale_lance_ult`
4.32, `poise_lance_ult` 10, cost 100 SP; combo `atk_scale` 3.8, `poise` 10,
`lance_duration` 30, cooldown 12 s (13 below level 12); ultimate
`atk_scale` 9.5, `poise` 20, `lance_duration_ult` 30, cost 100, cooldown
10 s. SkillData cooldowns (combo 10, battle 10) are overridden by the
table.

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Attack 1–3: one hit at frame 7, Physical (DamageAction damageType 0), mask 128, `atb` 0 | supported (data) | one hit each; `element: physical` by hand (the draft omits it: D3 per-hit element) |
| 2 | Attack 4: hits at 5 (`atk_scale`) and 18 (`atk_scale_2`), SP `atb` × 0.5 each | supported (data) | two hits, `sp: {product: [atb, 0.5]}` (draft correct) |
| 3 | Attack 5: Final Strike at 24, `poise` 17 for the controlled operator only, `atb` 19 if controlled | supported; poise by hand | `finalStrike`, `sp: atb`, `poise: poise`, `poiseControlledOnly` (D3: draft has no poise) |
| 4 | Finisher: 3 hits at 27 / 28 / 29, factors 0.3 / 0.2 / 0.5 (BreakingAttackCalculation), mask 132 | supported; factors by hand | three hits with `factor` (D3: the draft gives factor 1 and merges 28–29) |
| 5 | Dive attack at 1, 1.8 | supported (damage) | not castable until rotations have jumps (S10) |
| 6 | `dash_attack`, `dodge` (SkillData, no skill group) | n/a | not rotation actions, as in batch 2 |
| 7 | Battle skill hit at 18: 1.5, `poise` 5, mask 4352; 100 SP; team energy at 18 | supported (data) | one hit; `teamEnergy: [{frame: 18, ratio: 1}]` (draft correct) |
| 8 | The battle skill recalls every lance at frame 7 (`lance_becalled` → the entity ends); only lances within 50 m | supported (composite) | `requires … consume: true` on the lance hits empties the counters at the cast; a cast trigger `recall` ends the lifetime buffs. 50 m: one enemy, always in range |
| 9 | Each returning Thunderlance: 1.68, `poise_lance` 5, mask 4352, one hit per lance that meets the enemy ("pierce") | **gap** (G2) | interim: 15 hits `lance_k` with `requires: {stack: lances, atLeast: k}`. Exact up to 15 lances (5 combos within 50 s); a hit count from a value would be one entry |
| 10 | Each returning Thunderlance EX: 4.32, `poise_lance_ult` 10 | **gap** (G2) | interim: 5 hits `lance_ex_k` on stack `lances_ex` |
| 11 | EX lances apply Electric Infliction: `lance_pulse_check` (0.3 s) is created on the enemy before the damage and inflicts only if no other one is active, so EX lances landing together inflict once | supported; **data** | EX hit `applies: [{kind: infliction, element: pulse, if: {not: {buffActive: lance_pulse_check}}}]` + `buffs: [{buff: lance_pulse_check}]` (enemy buff, 0.3 s). The draft reports the infliction "with no landing" (G4) |
| 12 | When returning lances land: frame 7 + the projectile's flight back (projectile data not in the files) | unknown | U3. Frame 7, `detached`, as a lower bound |
| 13 | Combo trigger: a Final Strike by the controlled operator on an enemy with Electric Infliction or Electrification | supported | trigger `on: {event: hit, finalStrike: true}`, `by: controlled`, `if: {any: [{enemyInfliction: pulse}, {enemyStatus: electrification}]}`, `openCombo`. The engine judges it after the Final Strike's own applications (U5) |
| 14 | Combo hit at 14: 3.8, `poise` 10, mask 12288; no `usp` (see claims) | supported (data) | one hit; `poise` by hand (D3) |
| 15 | The combo throws 3 lances (3 projectiles at 14 → entities that live 900 frames, 1500 at P2) | supported (composite) | cast trigger `combo_lances` (`delay: 14`): `gain` 3 on stack `lances` and 3 layers of self buff `thunderlance` (duration `lance_duration` + `potential_2`, each layer its own timer); its `buffEnded` (one per layer) takes 1 off the stack. G1 would drop the counter |
| 16 | Combo cooldown 12 s, slow-down 0.5 s, window 21–68 to the battle skill | supported (data) | engine reads SkillPatchTable and SkillData |
| 17 | Ultimate hit at 51: 9.5, `poise` 20, mask 4608; cost 100, cooldown 10 s, time stop 0–45 | supported (data) | one hit; poise by hand (D3) |
| 18 | The ultimate throws one Thunderlance EX (projectile at 45, entity on block; same lifetimes) | supported (composite) | cast trigger `ult_lance` (`delay: 45`): `gain` 1 `lances_ex`, a layer of `thunderlance_ex` |
| 19 | Ultimate `pulse_resist_down_rate` / `_duration` (SkillPatchTable only) | n/a | dead keys (see claims) |
| 20 | Talent 1: `talent0_usp` energy per returning lance that hit (at its reach), per target of the combo hit and of the ultimate hit; only with the talent's buff | supported; **data** | hit `energy: {if: {talentAtLeast: [0, 1]}, then: talent0_usp}`. The gate matters: P1 adds 2 to `talent0_usp` even with the talent unlearned. The draft drops the gate (G4). Energy lands with the lance's hit, a few frames before its reach |
| 21 | Talent 2: the ultimate's Electric Susceptibility (0.06 / 0.10, 10 s), created before its own damage | supported | enemy buff `tactful_approach` (zone susceptibility, pulse, `pulse_vul_rate`, duration `pulse_vul_duration`: 0 without talent 2, so not applied), hit `buffs: [{…, beforeDamage: true}]`. Simulated: the ultimate hit carries +0.10 |
| 22 | Talent 2's Susceptibility with another Electric Susceptibility (Antal's Focus): sum or larger | unknown | U6, same question as in-game test 38. The debuff's stackingType is 2, so the loader gives it no stack group: they add |
| 23 | P1 `talent0_usp` +2 | supported (data) | skill values after talents and potentials (6 at P1) |
| 24 | P2: lances live 50 s instead of 30 s | supported | duration `{sum: [lance_duration, potential_2]}` (30 + 0 / 30 + 20); the data's lifetime is a fixed frame (900 / 1500) chosen by `potential_2` ≥ 1, same values. Simulated: lances recalled at 40 s return at P5 and have run out at P0 |
| 25 | P3 Will +15, Electric DMG +8% | supported (data) | stat panel (`efsim calc`: PulseDamageIncrease 0.427 at P5 with Cohesive Traction) |
| 26 | P4 ultimate cost ×0.85 | supported (data) | stat panel / energy max |
| 27 | P5: returning lances (both kinds) × `potential_5_rate` (1.15) against an enemy with an Electric, Arts or all-element Susceptibility | supported | lance hits `extraScale: [{value: potential_5_rate, if: {all: [{potentialAtLeast: 5}, {enemyModifier: {zone: susceptibility, element: pulse}}]}}]` (`enemyModifier` counts all-element modifiers, as the tag does). Simulated: EX lance P5/P0 = 1.250 = 1.15 × the P3 difference 1.087; the battle-skill hit 1.087 only |
| 28 | Hit-stops and time dilations (lance_back 0.2 s, EX lance 0.4 s, battle skill 0.15 s, basic attacks) | gap (known) | Ti1b hit-stop, open since batch 1: not modelled |
| 29 | kit-draft output | data | G4 |
| 30 | Chimeric Justice: Strength +124, Ultimate Gain Efficiency +37.1%, Crit Rate +8.4% (cardAttributeModifier attr 9) | supported (data) | stat panel (`efsim calc`: CriticalRate 13.4%, UltimateSpGainScalar 137.1%) |
| 31 | Chimeric Justice: "When the wielder applies Vulnerability to an enemy with no Vulnerability stacks, the wielder gains ATK +42% for 15s" (abilityEvent 206, the target's `buff_physical_no_guard` stacks = 0, applied buff with tag 1075718177 → `buff_wpn_lance_0004_atk_up`, stackingType 4) | **gap** (G3) | interim: `on: {event: vulnerable}`, `by: self`, `if: {not: {enemyVulnerable: 2}}` (judged after the stack is added): exact while each application adds one stack. Simulated on Estella: fires on her combo's Lift (0 → 1), not on her ultimate's (1 → 2) |
| 32 | Cohesive Traction: Will +124, Electric DMG +34.7%, Combo Skill DMG +28% (attr 33) | supported (data) | stat panel |
| 33 | Cohesive Traction: on a combo cast (abilityEvent 30, CheckSkillType 6) a layer of `buff_wpn_lance_0006_exist` (30 s, max 3, each layer its own timer, **addingCooldown 30 s**); on a battle-skill cast (type 2) Electric DMG + `pulse_dmg_up` × layers for that cast (CreateBuffAttachingSkill `_skill_pulse01`, whose end finishes all layers) | supported; **unknown** | self buff `wpn_lance_0006.pulse` (attr 52, `maxStacks: max_stack`, `consumedBy: [battle]`), trigger `on: {event: cast, kinds: [combo]}` with `cooldown: 30` (the adding cooldown). Same structure as Bonekrusha (`suit_attri01`). Simulated: +0.28 on all of the next battle skill's hits, lances included. U2: with the 30 s adding cooldown no second layer can exist while the first lasts |
| 34 | OBJ Razorhorn: Will +124, Physical DMG +34.7% | supported (data) | stat panel |
| 35 | OBJ Razorhorn: DMG Dealt +22.4% against enemies with Cryo Infliction or Solidification (`buff_wpn_lance_0013_damage01`, permanent, damageModifier NormalCalcZone with CheckTagMatch on the target) | supported | self buff from `fightStart`, modifier `{zone: damageBonus, value: dmg_up, if: {any: [{enemyInfliction: cryst}, {enemyStatus: solidification}]}}` (C1, judged per hit) |
| 36 | OBJ Razorhorn: "After consuming Solidification, ATK +33.6% for 15s" (abilityEvent 208, CheckConsumeBuffLayer ≥ 1 on a Solidification-tagged buff → `buff_wpn_lance_0013_atk_up`, stackingType 2 max 1) | supported; **unknown** | triggers `on: {event: statusConsumed, statuses: [solidification]}` and `on: {event: shatter}`, `by: self` → self buff. U4: whether a Shatter counts as consuming it (the engine's Shatter emits `shatter`, not `statusConsumed`). Simulated on Estella: fires on her Shatter |
| 37 | `toggleBuffs` `buff_wpn_passive_spirit_01` in all three weapon skills | n/a | no BuffData file: inert (as for Jiminy 12, batch 2) |

Counts (37 rows, by primary status): **supported 27** (rows 1–5, 7, 8,
11, 13–18, 20, 21, 23–27, 30, 32–36; 12 of them "supported (data)": rows
1, 2, 7, 14, 16, 17, 23, 25, 26, 30, 32, 34; rows 3, 4, 14, 17 also need
values by hand that the compiler misses), **gap 4** (rows 9, 10: G2; row
31: G3; row 28: known Ti1b, open), **data 1** (row 29: G4; rows 11 and 20
have data parts too), **unknown 2** (rows 12 U3, 22 U6; rows 13 U5, 33 U2,
36 U4 carry an unknown too), **unique? 0**, **n/a 3** (rows 6, 19, 37).
U1 (row 9) and U7 (row 11) are unknowns inside supported or gap rows.
G1 is a clean-up of rows 15 and 18, which are exact today.

Nothing is unique. The lances are field objects counted, timed and
consumed: a counter beside layered buffs, the pattern MI Security's kit
already uses; the recall is an ordinary consuming requirement. Cohesive
Traction is Bonekrusha's structure, Razorhorn uses C1 conditions and
existing status events, Chimeric Justice the existing `vulnerable` event.

## Gaps

### G1. An own buff's layer count as a value and a condition

- **family:** values / conditions (buff lifecycle).
- **feature:** ValueExpr `{buffLayers: "<own kit buff>"}`: the number of
  active layers of one of the owner's kit buffs (1 or 0 for a plain buff),
  evaluated where the value is; Predicate `{buffLayers: "<id>", atLeast?,
  below?}` likewise. The loader checks the id like `buffActive`.
- **evidence:** Avywenna's lances: `chr_0012_avywen_normal_skill` frame 7
  ForEach over the spawned lance entities (Selector OwnerSpawnedEntityFinder),
  each with its own lifetime (`chr_0012_avywen_combo_skill_lance` frames
  900 / 1500). Today's kits pair a counter stack with the layered buff
  (Avywenna here, MI Security's `suit_criti01.layers`), plus a `buffEnded`
  trigger per layer to keep them equal. Cohesive Traction reads the layer
  count too (`SaveBuffStackNumAdvanced` `count` × `pulse_dmg_up`), which
  `consumedBy` already covers.
- **impact:** none on numbers: the composite is exact (checked in scratch:
  recall at 40 s finds 3 lances at P5 and none at P0). It removes two
  stacks and two triggers from her kit and the counter from MI Security's.
  Low priority; worth doing together with G2.

### G2. A hit whose count is a value

- **family:** skills (hits) / values.
- **feature:** `KitHit.count` may be a ValueExpr, judged at the cast for
  the caster (before a `requires` consumes anything), e.g.
  `{stackCount: "lances"}` or, with G1, `{buffLayers: "thunderlance"}`;
  0 lands nothing. `frames` then gives the first landing's frame and
  later landings repeat the last frame (or a `framesEvery` spacing).
  Each landing is its own hit event (crits, talent energy, triggers).
- **evidence:** one `chr_0012_avywen_combo_skill_lance_back` landing per
  recalled lance (LaunchProjectile inside the ForEach at frame 7 of the
  battle skill); text "pulling back all Thunderlances … The returning
  Thunderlances … deal Electric DMG".
- **impact:** the interim (15 + 5 hit entries with `requires: {atLeast:
  k}`) is exact as long as at most 15 lances and 5 EX lances are on the
  field: 5 combos and 5 ultimates within 50 s (P2) are out of reach at
  the 12 s / 10 s cooldowns and 85–100 energy. The cost is kit size and
  `calc` listing 20 near-identical rows.

### G3. "Applies Vulnerability to an enemy with none"

- **family:** triggers.
- **feature:** the `vulnerable` status event carries the stacks it added
  (or the count before); `TriggerOn` `{event: "vulnerable", fromNone:
  true}` matches only events on an enemy that had 0 Vulnerable stacks
  before them.
- **evidence:** `sk_wpn_lance_0004` passiveEventActions abilityEvent 206:
  CheckBuffStackNumAdvanced `buff_physical_no_guard` compareType 1 value 0
  on the target, CheckBuffIdInContext tag 1075718177, CreateBuff
  `buff_wpn_lance_0004_atk_up`. Text: "applies Vulnerability to an enemy
  with no Vulnerability stacks".
- **impact:** the interim `{not: {enemyVulnerable: 2}}` is exact when an
  application adds one stack (every physical status and every kit
  `vulnerable` application today). It misses an application of two or
  more stacks on a clean enemy (none in the kits yet). ATK +42% for 15 s
  when it goes wrong.

### G4. Compiler leftovers seen on Avywenna

- **family:** data compilation (D3 continued).
- **feature:** `kit-draft` / `compileSkill` should
  1. turn a `CheckBuffStackNumAdvanced` on a buff a talent attaches
     (PotentialTalentEffectTable `attachBuff` `buff_chr_0012_avywen_talent_0`)
     into `talentAtLeast` on the energy or hit it gates, rather than a note;
  2. follow a CreateBuff on the hit's target (`buff_…_lance_pulse_check`)
     into that buff's start event and attach its SpellInfliction (with the
     buff's own once-per-0.3-s guard) to the landing;
  3. report spawned ability entities that a later skill recalls
     (SpawnAbilityEntity + OwnerSpawnedEntityFinder) as a stack the kit
     must declare, with the entity's lifetime frames;
  4. the known D3 items: per-hit element (the basic attacks are Physical,
     damageType 0, but the draft would make them Electric), poise (every
     hit), BreakingAttackCalculation factors (0.3 / 0.2 / 0.5), created
     enemy buffs (the ultimate's debuff).
- **evidence:** the draft: no `element` on the basic attacks, no `poise`,
  finisher `hit` + `hit_2 count 2`, the EX infliction and the reach energy
  "with no landing", combo / ultimate `energy: talent0_usp` "only if
  stacks(buff_chr_0012_avywen_talent_0) ≥ 1". It splits each lance into a
  P5 and a non-P5 landing (the IfElse), both at frame 7, count 1.
- **impact:** none once the kit hand-writes them; the values are in the
  kit plan.

## Unknowns

- **U1. How many lances hit a single boss.** Returning lances "pierce
  through all enemies along their paths". The data hits whatever the
  projectile meets on its way back. The lances land around the target
  (`lance_land_pos1–3`), so the kit assumes every lance hits it once.
  If some miss, both the damage (1.68 each) and the talent energy (4 / 6
  each) drop.
- **U2. Cohesive Traction's adding cooldown.** `buff_wpn_lance_0006_exist`
  has `addingCooldown` 30 s, the same as its duration, so at most one
  layer can be active, although the text says up to 3 stacks. The kit
  follows the data (trigger cooldown 30 s); +28% vs up to +84% Electric
  DMG on a battle skill.
- **U3. Lance travel time** (projectile files aren't in the data): the
  hits land at frame 7 + flight. Sub-second; matters only for buffs that
  start or end in between.
- **U4. Does a Shatter count as "consuming Solidification"** for
  Razorhorn? Interim yes (a `shatter` trigger beside `statusConsumed`).
- **U5. The combo trigger's moment:** the engine judges the enemy's state
  after the Final Strike's own applications. A teammate's Final Strike
  that inflicts Electric on a clean enemy opens the window in the engine;
  one whose infliction consumes Electric (a reaction) doesn't. If the
  game checks before the hit, both flip. Rare: no kit's Final Strike
  inflicts today.
- **U6. Two Electric Susceptibilities** (Tactful Approach + Antal's Focus,
  both VulnerableAction subType 6 → `buff_common_affixes_vulnerable_pulse`,
  whose stacking has `priorityKey` `rate`): sum or the larger? Same as
  in-game test 38.
- **U7. EX lances landing together inflict once** (`lance_pulse_check`
  start event: inflict only if no other check is active). This reads
  stackingType 7 as "a second check is still created". If the second
  check is refused instead, the result is the same: one infliction.
  Settled by the data either way; listed so the reading is on record.

## Verification

No fixture has Avywenna or Chimeric Justice, Cohesive Traction or OBJ
Razorhorn (`grep` over fixtures/ and fixtures/pending/), so nothing is
checked against a log. Logs that would check her, in order of value:

1. **Avywenna with a few combos before a battle skill** (any team in
   which the controlled operator's Final Strikes land on an Electric
   enemy; her own ultimate → battle skill gives the first Electric
   Infliction). The logged events `chr_0012_avywen_combo_skill_lance_back`
   / `_ultimate_skill_lance_back` give the number of returning lances
   (U1) and their timestamps (U3). The combo and ultimate keys and the
   energy jumps show talent 1. Expected per lance at level 12: 1.68 ×
   ATK (4.32 for EX).
2. **P5 Avywenna** with her ultimate's Susceptibility (talent 2) up during
   the battle skill: lance hits ×1.15, the battle skill's own hit not.
3. **Equipment:** Cohesive Traction (`buff_wpn_lance_0006_skill_pulse01`
   value on the battle skill after one and after two combos within 30 s,
   U2); Chimeric Justice on a Vulnerable applier (Estella, Catcher, the
   Endministrator); OBJ Razorhorn on a Cryo team (Estella): the
   `damage01` bonus against Cryo / Solidified, `atk_up` after a Shatter
   (U4).

Existing in-game tests that touch her: 38 (two Susceptibility sources:
U6 is the Electric version), 47 (projectile travel, not testable by hand:
U3 is the same question), 51 (an effect a hit creates acting on that hit:
the ultimate's debuff is created before its DamageAction, so the engine
puts it on the ultimate hit, as for the cases in 51).

Proposed in-game tests (not written to in-game-tests.md in this phase):

1. *Avywenna's returning lances* (U1; ready if you have Avywenna): on a
   dummy, one combo, then the battle skill. Count the Electric damage
   numbers: 3 lance numbers about 1.12× the battle skill's own number
   (1.68 / 1.5) plus that one is the prediction. Fewer lance numbers
   means some lances miss a single target. Repeat after two combos
   (6 + 1).
2. *Cohesive Traction's stacks* (U2; if you have Avywenna with Cohesive
   Traction): the battle skill's own number (a) with no combo in the last
   30 s, (b) after one combo, (c) after two combos within about 15 s.
   Prediction at weapon level 9 for a P0 Avywenna: (b)/(a) ≈ 1.21. Then
   (c)/(b) ≈ 1.00 if the 30 s adding cooldown holds (the data), ≈ 1.17 if
   two stacks add. The buff icon's stack number shows it too.
3. *Razorhorn after a Shatter* (U4; if you have Estella with OBJ
   Razorhorn): Shatter a Solidified dummy (her combo's Lift). Does an ATK
   buff icon appear on Estella, and is her next basic attack about 1.2×
   the same attack before (ATK +33.6%, diluted by her other ATK%)?
4. *Final Strike timing for her combo* (U5): not testable by hand without
   a Final Strike that inflicts Electric; kept as an unknown.

## Kit plan

Written as it would be today and **loaded with the real loader** from a
scratch copy of the repository (main checkout untouched, re-synced after
commit ae1c4f6):
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0012_avywen/repo/packages/data/kits/operators/chr_0012_avywen.json`
and `…/repo/packages/data/kits/equipment/{wpn_lance_0004,wpn_lance_0006,wpn_lance_0013}.json`
(generated by `…/scratch-chr_0012_avywen/gen.py`). All load; `vitest run
packages/data/test/kits.test.ts packages/data/test/skillCompile.test.ts`
passes there (263 tests). `efsim calc` lists every hit, and scratch
scenarios (`…/repo/examples/avy-*.scenario.json`, solo Avywenna with
Cohesive Traction, P0 and P5; `est-wpn_lance_0004/0013.scenario.json`,
Estella's example with the two other lances) show:
ultimate → battle skill (one EX lance, its Electric Infliction) → basic
chain → combo window from her Final Strike → combo (3 lances) → chain →
combo → battle skill with 6 lance hits, +0.28 Electric DMG from Cohesive
Traction on all of them, and 36 energy from the lances at P5. Lances
recalled after 40 s return at P5 and have run out at P0. Chimeric
Justice and Razorhorn fired on Estella's Lift and Shatter.

### Operator kit `chr_0012_avywen`

Element `pulse`. Skills (frames from the data; hand-written parts
marked):

| Skill | Hits |
|---|---|
| attack1–3 | `hit`: `atk_scale`, frame 7, events `chr_0012_avywen_attack1/2/3`, `sp: atb`, `element: physical` (hand) |
| attack4 | `hit` (5, `atk_scale`) and `hit_2` (18, `atk_scale_2`), `sp: {product: [atb, 0.5]}`, physical |
| attack5 | `hit`: 24, `finalStrike`, `sp: atb`, `poise: poise`, `poiseControlledOnly` (hand), physical |
| power_attack | `hit_1` 27 factor 0.3, `hit_2` 28 factor 0.2, `hit_3` 29 factor 0.5 (hand), physical; finisher SP is the engine's |
| plunging_attack_end | `hit`: 1, `sp: atb`, physical (not castable: S10) |
| normal_skill | `teamEnergy: [{frame: 18, ratio: 1}]`; `lance_1`…`lance_15` and `lance_ex_1`…`lance_ex_5` (below); `hit`: 18, `poise: poise` |
| combo_skill | `hit`: 14, `poise: poise`, `energy` talent-gated (below); no `usp` |
| ultimate_skill | `hit`: 51, `poise: poise`, `energy` talent-gated, `buffs: [{buff: tactful_approach, beforeDamage: true}]` |

The lance hits (k = 1…15 on `lances`, 1…5 on `lances_ex`):

```json
{ "id": "lance_1", "label": "Returning Thunderlance 1", "scale": ["atk_scale_lance"], "frames": [7],
  "events": ["chr_0012_avywen_combo_skill_lance_back"], "detached": true, "poise": "poise_lance",
  "energy": { "if": { "talentAtLeast": [0, 1] }, "then": "talent0_usp" },
  "extraScale": [{ "value": "potential_5_rate",
                   "if": { "all": [{ "potentialAtLeast": 5 }, { "enemyModifier": { "zone": "susceptibility", "element": "pulse" } }] } }],
  "requires": { "stack": "lances", "atLeast": 1, "consume": true } },
{ "id": "lance_ex_1", "label": "Returning Thunderlance EX 1", "scale": ["atk_scale_lance_ult"], "frames": [7],
  "events": ["chr_0012_avywen_ultimate_skill_lance_back"], "detached": true, "poise": "poise_lance_ult",
  "energy": { "if": { "talentAtLeast": [0, 1] }, "then": "talent0_usp" },
  "extraScale": [ "…as above…" ],
  "applies": [{ "kind": "infliction", "element": "pulse", "if": { "not": { "buffActive": "lance_pulse_check" } } }],
  "buffs": [{ "buff": "lance_pulse_check" }],
  "requires": { "stack": "lances_ex", "atLeast": 1, "consume": true } }
```

Stacks, buffs and triggers (as loaded):

```json
"stacks": [
  { "id": "lances", "label": "Thunderlances on the field", "max": 99 },
  { "id": "lances_ex", "label": "Thunderlances EX on the field", "max": 99 }
],
"buffs": [
  { "id": "thunderlance", "label": "Thunderlance (one layer per lance, its own lifetime)", "target": "self",
    "duration": { "sum": ["lance_duration", "potential_2"] }, "maxStacks": 99, "modifiers": [] },
  { "id": "thunderlance_ex", "label": "Thunderlance EX (one layer per lance)", "target": "self",
    "duration": { "sum": ["lance_duration_ult", "potential_2"] }, "maxStacks": 99, "modifiers": [] },
  { "id": "lance_pulse_check", "label": "EX infliction lockout (0.3 s)", "target": "enemy",
    "gameBuff": "buff_chr_0012_avywen_lance_pulse_check", "duration": 0.3, "modifiers": [] },
  { "id": "tactful_approach", "label": "Tactful Approach: Electric Susceptibility", "target": "enemy",
    "gameBuff": "buff_chr_0012_avywen_ultimate_skill_debuff", "duration": "pulse_vul_duration",
    "modifiers": [{ "zone": "susceptibility", "elements": ["pulse"], "value": "pulse_vul_rate" }] }
],
"triggers": [
  { "id": "combo_window", "on": { "event": "hit", "finalStrike": true }, "by": "controlled",
    "if": { "any": [{ "enemyInfliction": "pulse" }, { "enemyStatus": "electrification" }] },
    "do": [{ "kind": "openCombo" }] },
  { "id": "combo_lances", "on": { "event": "cast", "skills": ["chr_0012_avywen_combo_skill"] }, "by": "self",
    "skill": "chr_0012_avywen_combo_skill", "delay": 14, "awaited": true,
    "do": [{ "kind": "gain", "gains": [{ "stack": "lances", "amount": 3 }] },
           { "kind": "buff", "buff": "thunderlance", "layers": 3 }] },
  { "id": "ult_lance", "on": { "event": "cast", "skills": ["chr_0012_avywen_ultimate_skill"] }, "by": "self",
    "skill": "chr_0012_avywen_ultimate_skill", "delay": 45, "awaited": true,
    "do": [{ "kind": "gain", "gains": [{ "stack": "lances_ex", "amount": 1 }] },
           { "kind": "buff", "buff": "thunderlance_ex" }] },
  { "id": "lance_expired", "on": { "event": "buffEnded", "buff": "thunderlance" }, "by": "self",
    "do": [{ "kind": "gain", "gains": [{ "stack": "lances", "amount": -1 }] }] },
  { "id": "lance_ex_expired", "on": { "event": "buffEnded", "buff": "thunderlance_ex" }, "by": "self",
    "do": [{ "kind": "gain", "gains": [{ "stack": "lances_ex", "amount": -1 }] }] },
  { "id": "recall", "on": { "event": "cast", "skills": ["chr_0012_avywen_normal_skill"] }, "by": "self",
    "do": [{ "kind": "endBuff", "buff": "thunderlance" }, { "kind": "endBuff", "buff": "thunderlance_ex" }] }
]
```

Notes:
- The counter and the layers stay equal: each layer that runs out sends
  its own `buffEnded` (−1). The recall's `endBuff` sends one event for all
  layers, after the cast's `requires` has already emptied the counter, so
  its −1 clamps at 0. With G1 + G2: drop both stacks and the expiry
  triggers, and write one hit each with `count: {buffLayers: …}`.
- The lances' lifetime starts at frame 14 / 45 in the kit. In the game it
  starts when the thrown projectile lands (a few frames later), so the kit
  ends them a little early.
- Energy: max 100 (85 at P4). Talent 1 gives `talent0_usp` (4; 6 at P1)
  per lance hit, combo hit and ultimate hit, gated on talent 1 because P1
  adds to the key even without the talent. No RefrainObtainUsp anywhere in
  her files.
- `potential_5_rate` is 0 below P5 (SkillData default), so the extraScale
  also checks `potentialAtLeast: 5`, as the data's `> 0` test does.
- Not written: hit-stops (Ti1b), the 50 m recall range (one enemy).

### Equipment kits

- **wpn_lance_0004 Chimeric Justice:**
  ```json
  "buffs": [{ "id": "wpn_lance_0004.atk", "label": "Brutality: Cemented Fury (ATK)", "target": "self",
              "gameBuff": "buff_wpn_lance_0004_atk_up", "duration": "duration",
              "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
  "triggers": [{ "id": "wpn_lance_0004.first_vulnerable", "on": { "event": "vulnerable" }, "by": "self",
                 "skill": "sk_wpn_lance_0004", "if": { "not": { "enemyVulnerable": 2 } },
                 "do": [{ "kind": "buff", "buff": "wpn_lance_0004.atk" }] }]
  ```
  With G3: `on: {event: vulnerable, fromNone: true}` and no `if`. Crit Rate
  and the stat lines are in the stat panel. Avywenna herself never applies
  Vulnerable, so on her it does nothing.
- **wpn_lance_0006 Cohesive Traction:**
  ```json
  "buffs": [{ "id": "wpn_lance_0006.pulse", "label": "Suppression: Concentric Circles (Electric DMG, next battle skill)",
              "target": "self", "gameBuff": "buff_wpn_lance_0006_exist", "duration": "duration",
              "maxStacks": "max_stack", "consumedBy": ["battle"],
              "modifiers": [{ "attr": 52, "value": "pulse_dmg_up" }] }],
  "triggers": [{ "id": "wpn_lance_0006.combo", "on": { "event": "cast", "kinds": ["combo"] }, "by": "self",
                 "skill": "sk_wpn_lance_0006", "cooldown": 30,
                 "do": [{ "kind": "buff", "buff": "wpn_lance_0006.pulse" }] }]
  ```
  `cooldown: 30` is the buff's `addingCooldown` (a literal in BuffData,
  not a skill key; U2). `buff_wpn_lance_0006_comboskill01` is referenced
  by nothing (the Combo Skill DMG is cardAttributeModifier attr 33).
- **wpn_lance_0013 OBJ Razorhorn:**
  ```json
  "buffs": [
    { "id": "wpn_lance_0013.dmg", "label": "Infliction: Conquest of Icy Peaks (DMG vs Cryo / Solidified)", "target": "self",
      "gameBuff": "buff_wpn_lance_0013_damage01",
      "modifiers": [{ "zone": "damageBonus", "value": "dmg_up",
                      "if": { "any": [{ "enemyInfliction": "cryst" }, { "enemyStatus": "solidification" }] } }] },
    { "id": "wpn_lance_0013.atk", "label": "Infliction: Conquest of Icy Peaks (ATK after consuming Solidification)", "target": "self",
      "gameBuff": "buff_wpn_lance_0013_atk_up", "duration": "duration",
      "modifiers": [{ "zone": "atk", "value": "atk_up" }] }
  ],
  "triggers": [
    { "id": "wpn_lance_0013.start", "on": { "event": "fightStart" }, "by": "self", "skill": "sk_wpn_lance_0013",
      "do": [{ "kind": "buff", "buff": "wpn_lance_0013.dmg" }] },
    { "id": "wpn_lance_0013.consumed", "on": { "event": "statusConsumed", "statuses": ["solidification"] }, "by": "self",
      "skill": "sk_wpn_lance_0013", "do": [{ "kind": "buff", "buff": "wpn_lance_0013.atk" }] },
    { "id": "wpn_lance_0013.shatter", "on": { "event": "shatter" }, "by": "self",
      "skill": "sk_wpn_lance_0013", "do": [{ "kind": "buff", "buff": "wpn_lance_0013.atk" }] }
  ]
  ```
  Simulated on Estella's example: +0.224 on her hits against the
  Solidified enemy, ATK +0.336 from her Shatter on. Her battle-skill
  projectile that causes the Solidification doesn't get the +0.224,
  although the reaction's own hit does: the modifier's `if` sees the
  enemy as it was before that hit's applications (timeline.ts passes the
  hit's `before` situation to `computeHit`). The data checks the
  target's tags when the damage is computed, after the SpellInfliction,
  so that one hit may be 22% low. This affects every C1 modifier, not
  only this weapon; noted for the merge, not counted as a row here.
