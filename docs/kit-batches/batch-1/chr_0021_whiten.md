# Estella (chr_0021_whiten): gap report, batch 1

Operator Estella, weapon Valiant (`wpn_lance_0010`). Her 3-piece Swordmancer
set (`suit_phy01`) belongs to another analyst; only how it interacts with her
kit is noted here (§ Weapon and set interactions).

Sources: SkillData/BuffData `chr_0021_whiten_*`, `buff_chr_0021_whiten_*`,
`sk_wpn_lance_0010`, `buff_physical_airborne`,
`buff_common_cryst_triggered_physical_break`,
`buff_common_affixes_vulnerable_physical` (rmxlinux 1.6); SkillPatchTable,
CharGrowthTable, CharacterPotentialTable, PotentialTalentEffectTable,
I18nTextTable_EN; fixture `zmdlogs-4e5e1390085e` (Estella P5, skills
12/12/12/12, Valiant skill levels 3/9/6, Swordmancer ×3, game 1.5). Scales
below come from `efsim zmdlogs scales fixtures/zmdlogs-4e5e1390085e.json
chr_0021_whiten`: the logged value divided by the hit's zones with the
logged effects (boundary effects not applied).

Claims from the current kit's notes that I re-checked: cost 70 and P2 ×0.9,
ultimate cooldown 10 s, combo cooldown 18 s (17 s at level 12), combo `usp`
10 at frame 19 (only if the hit finds a target), no `RefrainObtainUsp`
in the ultimate, ultimate `atk_scale_total` = `atk_scale` (nothing writes
`dmg_up_total`), talent 1 `atb` 7.5 / 15, talent 2 −10% / −20%: all
**confirmed**. Three notes in the kit are **out of date** against today's
engine (rows 10 and 16). One is **incomplete** (P5's source, row 25).

## Where her damage comes from (the fixture)

What Estella dealt in `zmdlogs-4e5e1390085e` (536,453 in total), by logged
event:

| Event | Damage | Share | Modelled? |
|---|---:|---:|---|
| `buff_common_cryst_triggered_physical_break` (Shatter) | 100,941 | 18.8% | no |
| `chr_0021_whiten_ultimate_skill` | 98,977 | 18.5% | yes |
| `chr_0021_whiten_combo_skill` | 78,126 | 14.6% | yes (Solidified variant) |
| `buff_physical_airborne` (Lift damage) | 62,598 | 11.7% | no |
| `chr_0015_lifeng_ultimate_skill` (really Valiant's triggered hit, row 29) | 61,446 | 11.5% | no |
| `buff_common_cryst_fire_triggered` (her Solidification reaction) | 38,193 | 7.1% | yes |
| `buff_equipsuit_physuit_01` (set hit) | 31,002 | 5.8% | no (other analyst) |
| battle skill projectile | 29,548 | 5.5% | yes |
| basic attacks 1–4 | 35,622 | 6.6% | yes |

So **48% of her damage in this fight comes from what her forced Lifts
start** (Shatter, Lift damage, the weapon hit and the set hit). The engine
models none of it today.

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: `atk_scale` (attack3: `atk_scale` + `atk_scale2`, two DamageActions); masks 128, attack4 2097280 (Final Strike) | supported (data) | `hits[].scale`, `frames`, `finalStrike`; frames, locks and event keys are in SkillData (compiler). Verified: 16 hits ±1 in the fixture |
| 2 | Attack4 SP return: `atb` 19 (SkillPatchTable), ObtainCostAction costType 1 with `atbOnlyMainChar` | supported | engine reads `atb` on the skill's first hit; basic attacks need control anyway |
| 3 | Final Strike stagger (`poise` 17) and every hit's `poise` / DamageAction hit-env values: "As the controlled operator, Final Strike also deals {poise:0} Stagger" | gap | G9 (stagger meter; shared) |
| 4 | Finisher `chr_0021_whiten_power_attack`: `BreakingAttackCalculation` (atk_scale 9 at L12), `GainBreakingAttackAtb` (SP); "Basic attack performed near a Staggered enemy becomes a finisher … recovers some SP" | gap | G9 (finisher formula, finisher SP, stagger; shared) |
| 5 | Dive attack `plunging_attack_end` (atk_scale 1.8, mask 1152, `canCastInAir`) | supported (damage) | its availability (only in the air) isn't modelled: G10. Search already skips non-chain basics |
| 6 | Battle skill: projectile `chr_0021_whiten_normal_skill_projhit`, Cryo DMG `atk_scale` (3.5 at L12) with `dmg_up` on the first target (`EntityBB_first_hit` → `up_atk_scale` + DamageScaleProcessor NormalCalcZone `dmg_up`) | supported | `hits[].element`, `bonuses: [{zone: damageBonus, key: dmg_up}]`. Verified: 3 hits |
| 7 | Battle skill Cryo Infliction: "apply Cryo Infliction to all enemies along its straight path"; projhit `SpellInfliction` **`isEnable: true`, `inflictionType` 2** | data | kit hand-writes `applies: [{kind: infliction, element: cryst}]`; the data has it (G11) |
| 8 | Battle skill: projectile lands at an unknown time after launch (LaunchProjectile at frame 21) | gap | timing, shared (projectile travel); assumed to land at 21. Low impact |
| 9 | Combo trigger: "COMBO TRIGGER: When an enemy suffers Solidification." | supported | `comboTriggers: [{any: [{on: reaction, statuses: [solidification]}]}]` (forced ones included) |
| 10 | Combo, two variants per target (ForEach > IfElse CheckTagMatch 1535684437 = Solidified): Solidified → Physical Susceptibility buff, forced Lift, damage `atk_scale2` (6.3); not Solidified → forced Lift, damage `atk_scale` (3.6). `usp` 10 either way | supported | today: two hits with `if: {enemyStatus: solidification}` / `if: {not: {enemyStatus: solidification}}`, `energy: usp` on both. The kit models only the Solidified one and its note ("kits can't yet condition a hit on an enemy status") is **stale**. Correct only while Shatter isn't modelled for others (a teammate's physical status consumes Solidification before her combo: G1) |
| 11 | Combo Physical Susceptibility: `buff_chr_0021_whiten_combo_skill_physical_vulnerable` → VulnerableAction subType 2 (physical), `rate` 0.15, `duration` 6 s; created **before** the Lift and the DamageAction | supported | kit buff `physical_susceptibility` (enemy, susceptibility, physical), `beforeDamage: true`. Verified on 2 combo hits. Logged as `buff_common_affixes_vulnerable_physical` (stackingType 0, priorityKey `rate`, so it gets no `stackGroup`; whether it adds to another Physical Susceptibility is open, as for Gilberta's `vulnerable_spell`) |
| 12 | Combo forced Lift on every target (3 × `AirborneAction forceAirborne: true`): Lift damage, Vulnerable stack, a physical-status event | gap | G1 |
| 13 | Combo Lift on a Solidified target → Shatter (`buff_common_cryst_triggered_physical_break`, tag −615023885): damage, consumes Solidification | gap | G2 |
| 14 | Combo energy `usp` 10 (ObtainCostAction at frame 19 if CheckEntityNum `tar` ≥ 1) | supported (data) | `hits[].energy: usp` |
| 15 | Combo `TimeDilationAction` (curve ComboSkill, 0.6 s); ultimate `TimeDilationAction` (RESETto1, 1 s) and `UltimateTimeAction` | gap | G8 (time dilation; shared) |
| 16 | P1 "Physical Susceptibility duration +{rate_plus:0}s": `has_potential1` = 1, `rate_plus` = 3; in the Solidified branch, CompareFloat `has_potential1` = 1 → ModifyDynamicBlackboard `duration` += `rate_plus` (operation 1) before the buff | supported | `duration: {sum: ["duration", {product: ["has_potential1", "rate_plus"]}]}` (or `{if: {potentialAtLeast: 1}, …}`). **Careful:** the SkillData default of `rate_plus` is **−0.1**, so a plain `sum` gives 5.9 s below P1. The kit's note ("A ValueSpec names one key") is stale; P1+ builds get 6 s today instead of 9 s |
| 17 | Ultimate damage: `atk_scale_total` = `atk_scale` + `dmg_up_total` (never written) → 11.0 at L12, mask 4608 | supported | verified: 47,481 = 11.0 exactly |
| 18 | Ultimate: "To enemies with Physical Susceptibility, the skill forcibly applies Lift" (ForEach > CheckTagMatch 1066759270 > AirborneAction forced, before the DamageAction). Tag 1066759270 is on `buff_common_affixes_vulnerable_physical` and `_vulnerable_all` (any source) | gap | G3 (condition) + G1/G2 (Lift, Shatter if also Solidified) |
| 19 | Ultimate cost 70 (P2 ×0.9 → 63), cooldown 10 s | supported (data) | read from the tables |
| 20 | Battle skill team energy: projhit creates `buff_common_obtain_ultimate_sp` (first target) | supported | engine models it for every battle skill |
| 21 | Talent 1 "Commiseration": "When triggering Shatter, the next battle skill Onomatopoeia cast returns {atb} SP. This effect cannot stack." (7.5 / 15). Data: `buff_chr_0021_whiten_talent_0` on her: abilityEvent 102 + CheckBuffIdInContext tag −615023885 (Shatter) → creates `buff_chr_0021_whiten_talent_0_active` (`atb`, stackingType 7, max 1). Battle skill frames 21–24: CheckBuffStackNumAdvanced ≥ 1 → GetTargetBuffBBAdvanced `atb` → ObtainCostAction costType 1 (SP) → FinishBuffAdvanced | gap | G4 (trigger on own Shatter), G5 (SP grant as an effect), G6 (talent value in a ValueExpr); needs G2 |
| 22 | Talent 2 "Laziness Pays Off Now": ignores Cryo Infliction on herself and takes −10% / −20% Cryo DMG (`buff_chr_0021_whiten_talent_1`: CheckDamageType 4, DamageScaleProcessor side 1 ProdCalcZone `dmg_down`) | n/a | defensive: the simulator doesn't model incoming damage |
| 23 | P2 "Ultimate Energy cost −10%" (skillParamModifier paramType 1, ×0.9) | supported (data) | applied by the stat panel |
| 24 | P3 "range +50% and DMG Dealt +{dmg_up:0%} to the first enemy hit": `dmg_up` 0.4 and `distance` 12 on `chr_0021_whiten_normal_skill` | supported | `bonuses` key `dmg_up`; range doesn't matter against one enemy. Verified (scale 4.8999 = 3.5 × 1.4) |
| 25 | P4 Will +10, Strength +10; attribute nodes Will +10/15/15/20 | supported (data) | stat panel (matches `efsim calc`) |
| 26 | P5 "After applying Solidification to an enemy, Estella gains {usp:0} Ultimate Energy. Effect can only trigger once every 1s." Data: `buff_chr_0021_whiten_potential_5` is an AuraAction putting `buff_chr_0021_whiten_potential_5_inaura` (`usp` 5, `cd` 1) on enemies; on abilityEvent 9 + CheckBuffIdInContext tag 1535684437 (Solidified) + CheckTimedMarkerCondition → CreateTimedMarker `cd` on targetSource 1 (her) → ObtainCostAction `usp` to her | gap + unknown | G7 (trigger on any Solidification with cooldown, energy), G6 (potential value). Unknown: whose Solidification counts. The data checks only the tag, so anyone's; the text says "after applying" |
| 27 | Valiant skill 1 `wpn_attr_agi_high` (Agility +52 at level 3), skill 2 `wpn_sp_attr_phydam_high` (Physical DMG +43.3% at level 9) | supported (data) | stat panel |
| 28 | Valiant skill 3 `sk_wpn_lance_0010` "ATK +{atk_up}" (`cardAttributeModifier` attributeType 2, formulaItem 6; 0.20 at level 6) | supported (data) | stat panel, ATK ×(1 + 20%). Verified indirectly: the 16 matching hits need it |
| 29 | Valiant skill 3 triggered hit: "After the wielder applies Physical Statuses, the wielder also deals another hit of Physical DMG equal to {atk_scale} of the wielder's ATK" (`passiveEventActions` abilityEvent 402 → DamageAction `atk_scale`, 2.4 at level 6; no cooldown in the file) | gap | G1 (event), G4/G12 (triggered hit), G6 (weapon value) |
| 30 | Valiant's triggered hit is logged under event key `chr_0015_lifeng_ultimate_skill` | gap | G13 (log tooling) |
| 31 | Which skill-type bonus Valiant's hit gets (its DamageAction has `hitEnvData.inheritFirstDamageMask: true` and no decorate mask of its own) | unknown | in-game test 3 below |
| 32 | `buff_wpn_lance_0010` (attr 2 formulaItem 6 `atk_up`, `maxTriggerCnt` 1): `sk_wpn_lance_0010` doesn't create it (its `toggleBuffs` names `buff_wpn_passive_spirit_01`, which has no BuffData file) | supported | nothing to do: the stat panel uses `cardAttributeModifier`; noted so nobody adds the ATK twice |

Counts (32 rows): supported 18 (7 of them `supported (data)`: the kit
or engine has them, and a compiler could emit them), data 1 (row 7), gap 11
(rows 3, 4, 8, 12, 13, 15, 18, 21, 26, 29, 30; row 26 is also unknown),
unknown 1 (row 31), n/a 1 (row 22).

## Gaps

### G1. Forced Lift and the physical-status event

- **family:** physical state
- **feature:** a hit application `{kind: "physicalStatus", status: "lift",
  forced: true}` (also `knockdown`, `crush`, `breach` for other kits),
  handled by one physical-state module beside `status.ts`. A forced Lift
  always lands; it deals **Lift damage** = 1.2 × ATK × (1 + (Lv − 1)/392)
  × (1 + AI/100), Physical, with the normal physical zones (Physical DMG
  bonus, Physical Susceptibility, DEF); its mask 32768 has no
  skill-type bit, so presumably no skill-type bonus (unverified: no
  type-specific bonus was active in the fixture). It also gives the
  enemy 1 Vulnerable stack (unverified for forced Lifts) and emits an event
  `{kind: "physicalStatus", status, operator, forced}` that triggers can
  listen to (G4, G12; the Swordmancer set). Order within the hit, from
  SkillData: the hit's `beforeDamage` buffs, then the Lift (and Shatter,
  G2) with its damage, then the hit's own damage. Combo: CreateBuff →
  AirborneAction → DamageAction. Ultimate: CheckTagMatch → AirborneAction →
  DamageAction.
- **evidence:** `chr_0021_whiten_combo_skill` 3 × `AirborneAction
  forceAirborne: true` (both branches); `chr_0021_whiten_ultimate_skill`
  1 ×; `buff_physical_airborne` (ReadSkillSettingData `击飞伤害` with
  `enhanceAttributeSource` = the source, DamageAction mask 32768). Log
  `buff_physical_airborne` at 7174 / 12219 / 29524 / 54882 / 65097 ms: the
  scale is 2.9253 = 1.2 × 1.22704 × 1.98673 (panel Arts Intensity 98.67;
  `efsim calc`) exactly at 12219, and × 1.15 (her own Susceptibility,
  applied just before) at 7174 and 29524. abilityEvent 402 (wielder applies
  a physical status) is also used by `sk_wpn_sword_0015`,
  `buff_wpn_funnel_0011` and the `buff_train_output_*` buffs.
- **impact:** 11.7% of her damage in the fixture (62,598) is Lift damage,
  and it's the trigger for G2 (Shatter: 18.8%), Valiant (11.5%) and the
  set (5.8%). Without it her damage is about 48% short in a Solidification
  team. Every Lift, Knockdown or Breach operator needs it.

### G2. Shatter

- **family:** physical state (with arts state: it consumes Solidification)
- **feature:** when a physical status (G1) is applied to an enemy with
  Solidification, Solidification ends and the applier deals **Shatter**:
  (1.2 + 1.2 × level) × ATK × (1 + (Lv − 1)/196) × (1 + AI/100), Physical
  (level = the Solidification's level). Emit a `shatter` status event
  `{operator, level}` so that triggers (G4) and log replay can see it.
  `status.ts`'s `ActiveStatus` already has the level; Solidification needs
  to be removable by an event other than expiry.
- **evidence:** `buff_common_cryst_triggered_physical_break` (tag
  −615023885, DamageAction mask 134217728, `atk_scale` set by game code).
  Log: Shatter at 7174 ms scale 7.9732 / 1.15 = 6.933 = 2.4 × 1.45408 ×
  1.98673 (level I, after her level-I Solidification at 5776 ms, whose
  initial hit is 4.6222 = 1.6 × 1.45408 × 1.98673); at 54882 ms
  12.9165 / 1.08 / 1.15 = 10.40 = 3.6 × 1.45408 × 1.98673 (level II, after
  the level-II reaction at 53177 ms, 7.4877 / 1.08 = 6.933). The × 1.08 is
  the fixture's hand-annotated missed ATK buff after 49.4 s. Other users
  of the Shatter tag: `buff_chr_0011_seraph_talent_2_phydown`,
  `buff_train_check_shatter`.
- **impact:** 18.8% of her damage (100,941), her largest single source.
  Also, without Solidification being consumed, row 10's "is the target
  Solidified" is wrong whenever another physical status lands between the
  Solidification and her combo.

### G3. Condition: enemy has a debuff of a kind, from anyone

- **family:** conditions
- **feature:** a Predicate `{enemyModifier: {zone: "susceptibility",
  element: "physical"}}`, true when any active enemy-target buff (any
  team member's kit buff, or a logged one in the log replay) has a modifier
  in that zone that applies to that element (an all-element one counts).
  Evaluated where the hit lands, before its own effects, like `enemyStatus`.
  Used on the ultimate's Lift application (needs `if` on an `applies` entry,
  not only on a whole hit: the ultimate's damage happens either way).
- **evidence:** ultimate ForEach > `CheckTagMatch` tag 1066759270 >
  AirborneAction; the tag is on `buff_common_affixes_vulnerable_physical`,
  `buff_common_affixes_vulnerable_all`, `buff_equipsuit_crush_fracture`,
  `buff_chr_0031_mifu_passive*`. Description: "To enemies with Physical
  Susceptibility, the skill forcibly applies Lift to them." Log: Lift +
  Valiant hit at both ultimates (12219, 65097 ms), each under
  `buff_common_affixes_vulnerable_physical` 0.15.
- **impact:** without it, the ultimate's Lift has to be always or never
  applied. It is worth Lift damage + Valiant hit (+ Shatter if Solidified)
  ≈ 2.9 + 2.4 (+ 2.4–6.0) ATK-scale on top of the ultimate's 11.0.

### G4. Triggers on status events, by self or anyone, doing gains

- **family:** triggers
- **feature:** the planned single `triggers` list: `on` a status event
  (`reaction` with `statuses`, `shatter`, `physicalStatus`), `by` self /
  teammate / anyone, optional `cooldownSeconds`, optional `if`; `do`:
  stack gains, energy (G7), SP (G5), hits (G12). Talent 1 is `{on:
  "shatter", by: "self", do: {gains: [{stack: "commiseration", amount: 1}]}}`
  with a stack of max 1 ("cannot stack"). The battle skill's projectile
  then has `{sp: {key: "atb", talent: 0}, if: {stack: "commiseration",
  atLeast: 1}, consumes: "commiseration"}`, evaluated at frame 21 (the
  read happens on the cast's frames 21–24, in the skill, not the projhit).
  This needs a consumption that doesn't decide whether the hit exists:
  `requires.consume` today removes the hit when the stack is missing.
- **evidence:** row 21 (buff files and battle-skill actions). The
  `teamTriggers` of today fire only on `finalStrike`.
- **impact:** 15 SP per Shatter (one per combo with a Solidified target,
  about every 17 s): ≈ 15% of a battle skill's 100 SP, so roughly one extra
  battle skill every ~110 s. The returned SP gives no team energy, which
  `spReturned` already handles.

### G5. SP as an effect

- **family:** triggers (an action, like energy)
- **feature:** `sp: ValueExpr` on a hit (and as a trigger action), added
  when it lands and counted as returned SP (`spReturned`: spent first, no
  team energy). Today SP comes only from a skill's own `atb` on its first
  hit.
- **evidence:** battle skill ObtainCostAction costType 1 `atb` from
  `buff_chr_0021_whiten_talent_0_active`; finisher `GainBreakingAttackAtb`.
- **impact:** see G4; the finisher SP too (G9).

### G6. Values from talents, potentials and weapon skills in a ValueExpr

- **family:** values
- **feature:** ValueExpr terms `{talent: index, key}` (the build's talent
  level → that node's `attachBuff.blackboard`), `{potential: n, key}`
  (`attachBuff.blackboard` of potential n), `{weaponSkill: i, key}` (the
  weapon skill's blackboard at its level). `Condition.source` already
  resolves the first and last for always-on conditions; triggers and
  trigger hits need the same inside a ValueExpr.
- **evidence:** PotentialTalentEffectTable `chr_0021_whiten_talent_1_1/2`
  (`atb` 7.5 / 15), `chr_0021_whiten_potential_5` (`usp` 5, `cd` 1 in the
  BuffData), SkillPatchTable `sk_wpn_lance_0010` (`atk_scale` 1.2…3.36).
- **impact:** without it the kit writes literals (wrong at other talent or
  weapon levels) or can't express the effect.

### G7. P5: energy on any Solidification, once per second

- **family:** triggers
- **feature:** `{on: "reaction", statuses: ["solidification"], by:
  "anyone", if: {potentialAtLeast: 5}, cooldownSeconds: {potential: 5,
  key: "cd"}, do: {energy: {potential: 5, key: "usp"}}}`. The cooldown is
  hers, not per enemy (the timed marker is on targetSource 1, the buff's
  source). Energy is subject to Ultimate Gain Efficiency and energy blocks
  like other grants (`gainEnergy`). A refresh of an active Solidification
  probably counts (abilityEvent 9 fires when the tagged buff is added);
  unverified.
- **evidence:** row 26. The kit's note ("from any source") agrees with the
  data, but the description says "After applying Solidification".
- **impact:** +5 energy per Solidification (cost 63 at P2+): with one
  Solidification per rotation cycle ≈ 8% more ultimates. Only at P5.

### G8. Time dilation and the ultimate's time stop

- **family:** timing (shared, already known)
- **feature:** per action, a period in which other entities' time (buff
  and status timers, cooldowns?) runs at a curve's rate. For ultimates
  (`UltimateTimeAction`) apparently a pause of everything but the caster
  until the hit frame.
- **evidence:** combo `TimeDilationAction` curve ComboSkill 0.6 s;
  ultimate `TimeDilationAction` RESETto1 1 s + `UltimateTimeAction`. Log:
  her Susceptibility from the combo at 54882 ms (P5, so P1's 9 s → ends
  63882 ms) is still on the ultimate's hits at 65097 ms (cast ≈ 63297 ms:
  hit frame 54 = 1.8 s). That fits buff timers pausing during the
  ultimate's 1.8 s (63882 + 1800 ≈ 65682 > 65097), or a longer duration than
  the data says.
- **impact:** decides whether the ultimate gets the Susceptibility
  (×1.15, plus G3's Lift) after a combo 9–11 s earlier. A small timing
  error in general.

### G9. Stagger meter and finisher

- **family:** physical state (shared, already known)
- **feature:** poise per hit (DamageAction poise units, `poise` keys), the
  stagger meter and staggered window, the finisher's
  `BreakingAttackCalculation` (×1 / 1.25 / 1.5 / 1.75 by enemy tier) and
  `GainBreakingAttackAtb`, "near a Staggered enemy" availability.
- **evidence:** rows 3–4; the kit's finisher note (the one logged finisher
  in btl_upload_39e3cddab245 is ×1.215 of `atk_scale` 9).
- **impact:** finisher damage (9.0 ATK-scale) and SP; the staggered
  damage-taken window. Shared by every operator.

### G10. Skill availability: dive and finisher

- **family:** skills (states)
- **feature:** the dive attack is castable only in the air
  (`canCastInAir`, after `plunging_attack_start`) and the finisher only
  near a staggered enemy. Recorded rotations can cast both at any time
  today.
- **evidence:** `chr_0021_whiten_plunging_attack_end` `canCastInAir: true`;
  row 4's description.
- **impact:** low: search already skips non-chain basic skills; only
  hand-written rotations can do something illegal.

### G11. Inflictions from SpellInfliction

- **family:** data compilation
- **feature:** the compiler reads enabled `SpellInfliction` actions:
  `inflictionType` 0 fire, 1 pulse, 2 cryst, 3 natural (from the operators
  below), one stack per hit by default, and emits `applies`. The
  design doc's "`SpellInfliction` actions are disabled stubs" holds only
  for some (Laevatain's ult attacks and battle skill during ult, Typhoeus's
  ultimate projhits).
- **evidence:** `chr_0021_whiten_normal_skill_projhit` SpellInfliction
  `isEnable: true, inflictionType: 2`. Across `chr_*` SkillData:
  enabled type 0 ×14 (Laevatain ult_attack3, Camille, Wulfa…), 1 ×5
  (Perlica…), 2 ×14 (Estella, Seraph, Aurora, Tangtang…), 3 ×12
  (Gilberta, Arcane…); disabled ×9.
- **impact:** none on numbers (the kit already writes it); fewer
  hand-written facts.

### G12. Triggered hits

- **family:** triggers
- **feature:** a trigger action `hits: [{scale: ValueExpr, element,
  damageType?, events}]` that lands a hit for the trigger's owner at the
  event's frame, with that owner's zones at that moment. For Valiant:
  `{on: "physicalStatus", by: "self", do: {hits: [{scale: {weaponSkill: 2,
  key: "atk_scale"}, element: "physical"}]}}`, kept with the weapon (any
  wielder; it fires only if the wielder applies physical statuses), no
  cooldown. The hit lands after the effects of the hit that caused the
  status (at 7174 ms it's under her Susceptibility: 2.76 = 2.4 × 1.15).
- **evidence:** `sk_wpn_lance_0010` passiveEventActions abilityEvent 402;
  log: one hit per Lift (5 Lifts, 5 hits; scale 2.3999 at 12219 ms, 2.76 at
  7174 ms, 2.9807 / 1.08 = 2.76 at 54882 ms). The combos that also Shatter
  give only one hit each, so Shatter doesn't count as a second physical
  status.
- **impact:** 11.5% of her damage (61,446).

### G13. Log key of Valiant's hit

- **family:** log tooling
- **feature:** an alias from logged event key to the real source: the
  log names Valiant's triggered hit `chr_0015_lifeng_ultimate_skill`
  (attributed to Estella), so a weapon kit's hit should list that key in
  `events`, or the importer should map it.
- **evidence:** the 5 `chr_0015_lifeng_ultimate_skill` hits by
  `chr_0021_whiten` in `zmdlogs-4e5e1390085e` all equal Valiant's
  `atk_scale` 2.4 (weapon skill level 6) × the logged zones, at the same
  instants as her 5 Lifts; Lifeng isn't in the team.
- **impact:** 5 hits (11.5% of her damage) can't be checked without it.

## Weapon and set interactions (Estella-specific)

- **Valiant** fits her because both her combo variants and her ultimate (on
  a Physically Susceptible enemy) **force** Lift: at least one triggered hit
  per combo and per ultimate after a combo, with no cooldown.
- **Swordmancer** (`passive_equipsuit_physuit_01`: 250% ATK hit after the
  wearer applies a Physical Status, 15 s cooldown, `AddGlobalCDTimer`):
  with her combo cooldown of 17 s (level 12), every combo triggers it.
  Ultimates within 15 s of that combo don't. In the log: set hits only at
  the 3 combos (7174, 29524, 54882 ms), none at the ultimates 5.0 s and
  10.2 s after a combo. Scale 2.875 / 1.15 = 2.5 (under her
  Susceptibility). It depends on the same G1 event.

## Verification

- **`fixtures/zmdlogs-4e5e1390085e.json`** (the only fixture with her):
  `efsim zmdlogs check` now: 41 hits, 16 match, 0 mismatch, 9 under
  unmodelled effects (the hand-annotated ATK buff after 49.4 s), 16 not
  covered (Shatter ×3, set ×3, Lift ×5, Valiant ×5). Once G1, G2, G12 and
  G13 exist it can check: Lift damage (5 hits, formula and its Arts
  Intensity factor), Shatter at levels I and II (3 hits), Valiant's hit and
  its ordering after the Susceptibility (5), the set hit and its 15 s
  cooldown (3), and the ultimate's Lift condition (G3: 2 ultimates, both
  under Susceptibility). The combo's non-Solidified variant, P1's duration
  (indirectly, G8) and the reaction levels (Solidification I at 5776 ms,
  II at 53177 ms) are in it too. The hits after 49.4 s need the fixture's
  ×1.08 annotation.
- `efsim zmdlogs reactions` on it is incomplete: Camille and Rossi have no
  kits, so Estella's three Solidifications show as unexpected (the replay
  doesn't know the Heat Infliction they consume).
- Not checkable from logs: SP (talent 1), energy (P5, combo `usp`).

**In-game tests** (new; for docs/in-game-tests.md):

1. **P5 energy from a teammate's Solidification** (only with P5): with
   Estella's energy bar visible and nothing else giving her energy, let a
   teammate cause Solidification (their Cryo onto another infliction, or
   a forced one). +5 means anyone's counts (G7). Then two Solidifications
   within 1 s should give +5 once.
2. **Talent 1 SP** (talent 1 level 2): note team SP, cast her combo on a
   Solidified enemy (Shatter), then her battle skill. Expected: SP after
   the battle skill = before − 100 + 15. Then a second battle skill without
   a Shatter in between: −100 only. Also: does a Shatter caused by a
   teammate's physical status count?
3. **Valiant's hit and skill-type bonuses:** with a combo-DMG or
   ultimate-DMG bonus active (e.g. a set or buff that names only one skill
   type) and none for the other, compare Valiant's hit after a combo with
   the one after an ultimate (its `inheritFirstDamageMask` may give it the
   type of the hit that caused the Lift).
4. **Susceptibility through the ultimate** (P1+): combo on a Solidified
   enemy, then cast the ultimate so its hit lands 9.5–10.5 s after the
   combo hit. If the hit still shows Physical Susceptibility (and Lifts),
   buff timers pause during the ultimate (G8).
5. Existing test 11 (combo on a non-Solidified target) still applies;
   now it would confirm row 10's second hit rather than a missing one.

## Re-analysis (pass 2, 2026-10-18)

Against the engine and kit format after batch 1's implementation pass
(batch-1.md "Progress": T1–T3, C1–C2, B1–B6, V1–V5, S1–S7, A1–A5, P1, P2,
control statuses, Ti1 part, Ti4, L1, D1). Evidence used: `schemas/kit.schema.json`
and `equipment-kit.schema.json`; engine `timeline.ts` (`landHit`, `castSkill`,
`actionGate`), `status.ts` (physical statuses, Shatter), `events.ts`, `expr.ts`,
`stats.ts` (`StatPanel.sources`); loader `kits.ts` (value sources);
`efsim kit-draft chr_0021_whiten` (v2) and `compileSkill` on each of her
skills; `packages/data/test/skillCompile.test.ts` (`KNOWN` has **no Estella
entry**: her kit's frames, energy and inflictions agree with the compiled
data); `efsim zmdlogs check fixtures/zmdlogs-4e5e1390085e.json` today:
41 hits, **21 match, 0 mismatch**, 12 under unmodelled effects (the ×1.08
after 49.4 s), 8 not covered (Valiant ×5, set ×3), 83% of her damage covered.

Round-1 claims re-checked against the data in this pass: combo poise unit on
all three DamageActions (`poise` 10 at L12), attack4's poise unit with
`onlyEnableForMainChar` (`poise` 17), battle-skill projhit and ultimate
poise units (`poise` 10 / 20), attack1–3 and the dive without poise units;
`atb` is 0 on attack1–3 and the dive, 19 on attack4; P5's attached
blackboard is only `usp` 5 (`cd` 1 is in `buff_chr_0021_whiten_potential_5_inaura`'s
BuffData); talent 1's attached buff `buff_chr_0021_whiten_talent_0` carries
`atb` 7.5 / 15 (BuffData default 5), its trigger is abilityEvent 102 (the
owner applies a buff) with the Shatter tag −615023885; P5's is abilityEvent 9
on the enemy (a buff added, any source) with the Solidified tag 1535684437;
Valiant's `passiveEventActions` abilityEvent 402 → one DamageAction
(`atk_scale`, damageType 0, mask 0, `inheritFirstDamageMask`, no poise
unit, no cooldown). The ultimate's `UltimateTimeAction` spans frames 0–54
unconditionally, the combo's `TimeDilationAction` (ComboSkill) 0–18: both
are now read by the loader (`timing.slowdowns`). All **confirmed**.

### 1. First-round rows against the current engine

| Row | First round | Now | How (fields), or what's still missing |
|---|---|---|---|
| 3 | Final Strike stagger, poise per hit: gap (G9) | **supported** | `poise` on hits (P2): attack4 `poise: "poise", poiseControlledOnly: true`; combo, battle projhit, ultimate `poise: "poise"`. Lift's own stagger (10 × (1 + AI/200)) is the engine's. Kit-draft doesn't emit poise (R6) |
| 4 | Finisher: gap (G9) | **supported** | `skillSpecification` 8 in the data → castable only on a Staggered enemy, once per stagger, × the enemy's finisher multiplier (attribute 27), finisher SP added at the cast (`finisherSp`). Kit: one hit `atk_scale` at 30. Not log-verified (no committed fixture with her finisher) |
| 5 | Dive only in the air: gap (G10) | **gap** (R5) | `available` exists, but no predicate or state for "airborne after `plunging_attack_start`" (not one of her SkillTable skills, so a kit can't cast it) |
| 7 | Battle-skill Cryo infliction from SpellInfliction: data (G11) | **supported** | D1 compiles it (draft has `applies: [{kind: infliction, element: cryst}]`); the D1 test checks the kit against it |
| 8 | Projectile travel: gap | **gap** (R3) | Ti2 not done; the hit stays at the launch frame 21 |
| 10 | Two combo variants: supported, kit stale | **supported, kit must change** | two hits with `if: {enemyStatus: solidification}` / `{not: …}`; listed **non-Solidified first** (R1). Shatter now consumes Solidification, so a teammate's physical status before her combo correctly gives the `atk_scale` variant |
| 11 | Combo Physical Susceptibility | supported | kit buff, `beforeDamage: true`; optionally `gameBuff: buff_common_affixes_vulnerable_physical` like Gilberta's `vulnerable_spell` (stackingType 0: no stack group). Additivity with another source: still open (Gilberta's question too) |
| 12 | Forced Lift (G1) | **supported** | `applies: [{kind: physicalStatus, status: lift, forced: true}]` on both combo hits: Lift hit (1.2 × ATK × level × AI), +1 Vulnerable, `physicalStatus` event. Order in `landHit`: applications, then `beforeDamage` buffs, the hit's damage, then the status hits (`recordStatus`), so Lift and Shatter are under her own Susceptibility as in the log (7174, 29524 ms). Log check: the 5 Lift hits match |
| 13 | Shatter (G2) | **supported** | engine `status.ts`: a physical status (or new Vulnerable stack) on a Solidified enemy ends it and deals 2.4 / 3.6 / 4.8 / 6 by level; `shatter` event with the applier as operator. Log check: 3 Shatter hits match (levels I and II) |
| 15 | Time dilation and time stop (G8) | **supported (data)** | Ti1: the loader reads `UltimateTimeAction` (54 frames) and the combo's global `TimeDilationAction` (ComboSkill curve, 11.8 frames lost); nothing in the kit. Hit-stop isn't modelled (R4) |
| 16 | P1 +3 s: supported, kit stale | **supported, kit must change** | `duration: {sum: ["duration", {product: ["has_potential1", "rate_plus"]}]}`: 6 s below P1 (`has_potential1` 0 × `rate_plus` −0.1 = 0), 9 s from P1 |
| 18 | Ultimate Lift on Physically Susceptible enemies (G3) | **supported** | `if` per application (C1) + `enemyModifier` (C2): `{kind: physicalStatus, status: lift, forced: true, if: {enemyModifier: {zone: susceptibility, element: physical}}}`; judged before the hit's own effects; any source's buff counts (all-element too). Shatters if the enemy is also Solidified. Log: both ultimates' Lifts match |
| 21 | Talent 1 SP after Shatter (G4, G5, G6) | **supported, one hole** | stack `commiseration` (max 1) gained by a trigger on `shatter` `by: self`; the projhit's `sp` reads it (`{if: {stack…}, then: {key: atb, skill: buff_chr_0021_whiten_talent_0}, else: 0}`); a trigger on her `hit` of kind battle uses it up (−1). Hole: nothing gates the shatter trigger on talent 1 being learned, and at talent level 0 the value source is absent, so the read throws (R2) |
| 22 | Talent 2 (defensive) | n/a | unchanged |
| 26 | P5 energy on any Solidification, 1 s (G7) | **supported** (unknown stays) | trigger `on: {event: reaction, statuses: [solidification]}, by: anyone, if: {potentialAtLeast: 5}, cooldown: 1, skill: buff_chr_0021_whiten_potential_5, do: [{kind: energy, value: usp}]`. Reaction events include forced Solidifications and re-applications. `cd` is a literal (R6). Whose Solidifications count in game: test 1 |
| 29 | Valiant's triggered hit (G1, G4/G12, G6) | **supported** | equipment kit `wpn_lance_0010`: trigger `on: {event: physicalStatus}, by: self, skill: sk_wpn_lance_0010` → `hits` action (`atk_scale`, physical, `damageType: none`). The engine emits `physicalStatus` for Lift / Knock Down / Crush / Breach, not for Shatter or a Vulnerable-only application, which fits the log (one hit per Lift, none extra per Shatter) |
| 30 | Valiant's log key (G13) | **supported** | the hit's `events: ["chr_0015_lifeng_ultimate_skill", "sk_wpn_lance_0010"]` (L1: aliases are kit `events`) |
| 31 | Valiant's skill-type bonus | unknown | `damageType: none` (mask 0) until test 3 settles `inheritFirstDamageMask` |

Found in this pass (not in round 1):

| # | Finding (source) | Status | What to do |
|---|---|---|---|
| 33 | Team energy of the battle skill comes at the projectile's hit: `buff_common_obtain_ultimate_sp` is created in `chr_0021_whiten_normal_skill_projhit` (frame 21) on the first-target branch (`EntityBB_first_hit = 0`) | supported (kit error) | `teamEnergyFrame: 21` (V5). Today the team gets it at the cast, 0.7 s early. The compiler leaves the first-hit branch undecided, so the D1 test reads "data 0" and will need a KNOWN line or a compiler fix (R6) |
| 34 | Kit-draft gives `element: cryst` (CharacterTable) and no per-hit `element`, though only the projhit has damageType 4; everything else is 0 (physical) | data | keep the kit's `element: physical` and the projhit's `element: cryst` (R6) |
| 35 | Draft marks the projhit `detached: true` | kit choice | leave it out: with no travel time the landing frame is the launch frame, and a `detached` hit survives an interrupt before frame 21, when in game the projectile was never launched (her combo and ultimate outrank the battle skill and may cut it at any frame) |
| 36 | Basic attacks' SP: compiled `atb` "only if controlled" on attack1–4 and the dive | supported | engine default (`atb` on the first hit); only attack4's 19 is non-zero; basic attacks need control anyway |
| 37 | `durationFrames` in the kit | redundant | `actionGate` takes timing from SkillData (`timing`); drop the field |
| 38 | Her Susceptibility's lifetime in the log: present 7174–17282, gone by 17398–17589 ms (10.1–10.4 s, her own 1.8 s ultimate inside it, plus teammates' combos); 29524–39250, gone by 39556 (9.7–10.0 s, combos only); 54882–69142 and on (≥ 5.3 s over 9 s: Gilberta's 1.73 s and her own 1.78 s stops plus combos). The engine adds every time stop to every buff, so it predicts ≥ 10.8 s for the first window | unknown | the windows don't fit one rule (the first says her own ultimate didn't extend her debuff by the full 1.8 s, the third needs it). The log's own clock is real time (no hits 10418–12219 ms during her stop). In-game test 4 |

### 2. Remaining gaps

**Open: 6** (R1–R6). Everything else from round 1 can be expressed now.

#### R1. Alternatives judged one after another

- **family:** conditions
- **feature:** two hits with opposite `if`s at the same frame (the format's
  way of writing an IfElse branch, kit-abstractions §2) are judged one at a
  time as each lands, after the earlier one's effects. If the
  Solidified hit lands first, its Lift shatters the enemy, and then the
  non-Solidified hit's `if` is true too: both land. Either the engine
  judges a cast's same-frame alternatives together (e.g. an `else` hit or a
  shared `branch` id: one situation for the group, judged before any of
  them acts), or the loader enforces an order and a test pins it.
- **evidence:** `landHit` returns early on `kitHit.if` and otherwise applies
  `applies` before the next pending hit; pending hits at one frame land in
  kit order (`castSkill` pushes `skill.hits` in order). Data: one
  `IfElseAction` on tag 1535684437 per target in `chr_0021_whiten_combo_skill`.
- **impact:** with the non-Solidified hit listed first (the kit plan) none.
  In the other order, every combo on a Solidified enemy also deals 3.6 ×
  ATK, a second Lift (2.9), a second Valiant hit (2.4) and a second `usp`
  10: about +60% on the combo. Any kit whose branch changes its own
  condition (consuming an infliction, a stack) has the same trap.

#### R2. Talent level in predicates

- **family:** conditions (with values)
- **feature:** a Predicate `{talentAtLeast: [index, level]}` (talent index
  0-based as in `Build.talents`, judged from the build), so triggers and
  values from a talent's attached buff can be gated. Today a value
  `{key, skill: <talent buff>}` throws when the build has that talent at
  level 0 (`StatPanel.sources` lacks it), and nothing stops the trigger
  that leads to it.
- **evidence:** `computeStats` skips level-0 talents; `skillValue` throws
  "isn't one of …'s skills, nor a … source of this build". Talent 1:
  `chr_0021_whiten_passive_skill_0_1/_2` attach `buff_chr_0021_whiten_talent_0`.
  Shared: any talent trigger (Laevatain's, Gilberta's and Arcane's talents
  today use legacy `conditions` with `source.kind: talent`).
- **impact:** only builds with talent 1 unlearned: the simulation stops
  with an error at her first battle skill after a Shatter. No damage
  error otherwise.

#### R3. Projectile travel (Ti2) and "detached" before launch

- **family:** timing
- **feature:** a hit's launch frame and landing frame separately (travel
  from the projectile's speed and distance, or a measured delay), with
  `detached` meaning "survives an interrupt after launch" only.
- **evidence:** `LaunchProjectile@21` → `projectile_chr_0021_whiten_normal_skill`
  (its speed isn't in the fetched tables); engine note "Projectile hits land
  at their launch frame".
- **impact:** her battle skill's damage, Cryo infliction, the Solidification
  it causes (and so her combo window, P5 energy and talent 1's SP) come a
  little early; size unknown (a few frames at close range). Low.

#### R4. Hit-stop, and what a time stop freezes

- **family:** timing (Ti1 remainder)
- **feature:** attacker hit-stop (`HitStopAction`, mostly under
  `CheckMainCharacterCondition`), and whether a caster's own buffs and
  debuffs are frozen by its own ultimate's time stop (row 38).
- **evidence:** HitStop 0.08 / 0.16 / 0.06 + 0.15 / 0.38 s on attack1–4,
  0.3 / 0.4 s on the combo, 0.05 s on the projhit, 0.4 s on the finisher.
  The logs' basic-chain spacing (attack3→4 27–28 frames against a window
  at 28) leaves no room for attack3's 0.21 s of hit-stop, so it doesn't
  seem to delay the next action. Row 38 for the time stop.
- **impact:** hit-stop: probably none on her timing (the log says so for
  attack3). Time stop: her Physical Susceptibility (+15% Physical for the
  whole team) may last up to 1.8 s too long after each of her own
  ultimates; small.

#### R5. Mid-air availability

- **family:** skills (states)
- **feature:** a state "in the air" (after a jump or
  `plunging_attack_start`) that `available` can test, or a way to make
  the dive castable only after a jump action. `plunging_attack_start`
  has a SkillData file but isn't in SkillTable, so a kit can't list it.
- **evidence:** `chr_0021_whiten_plunging_attack_end` `canCastInAir`,
  `skillSpecification` 6; every operator has the same pair.
- **impact:** low: search skips non-chain basic skills; a hand-written
  rotation can cast the dive (1.8 × ATK) from the ground with no jump time.

#### R6. Data compilation still missing for her kit (D1 remainder)

- **family:** data compilation
- **feature:** kit-draft / the compiler should also emit: the hit `element`
  from `damageUnits[].damageType` (0 physical, 4 cryst), not the
  operator's element as the kit default; `poise` from damage units of
  `damageAttributeType` 1 (with `poiseControlledOnly` from
  `onlyEnableForMainChar`); `AirborneAction forceAirborne` as
  `physicalStatus lift forced`; `CheckTagMatch` on known tags as
  predicates (1535684437 → `enemyStatus: solidification`, 1066759270 →
  `enemyModifier susceptibility physical`); enemy buffs a skill creates
  (`VulnerableAction` subType 2 → a `susceptibility` buff with its
  `rate` / `duration`, P1's `ModifyDynamicBlackboard` as a `sum`);
  DamageScaleProcessor `dmg_up` as `bonuses`; the first-target branch
  (`EntityBB_first_hit`) decided for one enemy, as `CheckEntityNum` is;
  BuffData values of buffs that talents and potentials attach (P5's `cd`).
  The D1 test should compare physical statuses and poise too (today
  `kitAppText` ignores them).
- **evidence:** `efsim kit-draft chr_0021_whiten`: `element: cryst`, no
  `poise`, no Lift, no `if`s (three combo hits from the IfElse paths, the
  P1 path split into two), no buff, projhit split by `$EntityBB_first_hit`,
  team energy reported as conditional.
- **impact:** none on numbers once the kit hand-writes them (the kit plan
  does); without it the draft is wrong for 8 of her 9 skills' element, and
  the D1 test can't check Lifts, poise or `teamEnergyFrame`.

**Found on the way, not needed by her kit (for the merge):** a trigger
action delayed from a cast (`delay`, S1's way of writing a skill's
timeline effects) isn't cancelled when its cast is interrupted
(`castSkill` filters `pending` hits, not `pendingActions`). Her talent 1 SP
would hit this if written as a cast trigger with `delay: 21`, so the plan
puts it on the projhit instead.

### 3. Kit plan

**Operator kit `chr_0021_whiten`.** Default `element: physical`. Values at
the build's levels (SkillPatchTable); L12 figures in brackets. No
`durationFrames` (row 37).

Stacks:

- `commiseration` (max 1): talent 1's `buff_chr_0021_whiten_talent_0_active`
  (stackingType 7, max 1: "cannot stack").

Buffs:

- `physical_susceptibility`: `target: enemy`, `gameBuff:
  buff_common_affixes_vulnerable_physical`, `duration: {sum: ["duration",
  {product: ["has_potential1", "rate_plus"]}]}` [6 s; 9 s from P1],
  `modifiers: [{zone: susceptibility, value: "rate", elements: [physical]}]`
  [0.15]. Source: `buff_chr_0021_whiten_combo_skill_physical_vulnerable`
  (VulnerableAction subType 2), combo IfElse > CompareFloat
  `has_potential1` > ModifyDynamicBlackboard `duration` += `rate_plus`.

Skills, hit by hit (frames from `compileSkill`; events default to the skill
ID unless listed):

| Skill | Hit | Fields | Data |
|---|---|---|---|
| attack1 | `hit` | `scale: [atk_scale]` [0.56], `frames: [6]` | DamageAction mask 128 |
| attack2 | `hit` | `atk_scale` [0.68], `[6]` | mask 128 |
| attack3 | `hit1`, `hit2` | `atk_scale` [0.34] at 7, `atk_scale2` [0.45] at 18; both `events: [chr_0021_whiten_attack3]` | two DamageActions |
| attack4 | `hit` | `atk_scale` [0.90], `[21]`, `poise: "poise"` [17], `poiseControlledOnly: true`; Final Strike and `atb` [19] from the data | mask 2097280; poise unit `onlyEnableForMainChar` |
| power_attack | `hit` | `atk_scale` [9], `[30]`; finisher rules, multiplier and SP are the engine's (spec 8) | BreakingAttackCalculation, GainBreakingAttackAtb |
| plunging_attack_end | `hit` | `atk_scale` [1.8], `[1]` (availability: R5) | mask 1152 |
| normal_skill | `projhit` | skill: `teamEnergyFrame: 21`. Hit: `atk_scale` [3.5], `frames: [21]`, `element: cryst`, `events: [chr_0021_whiten_normal_skill_projhit]`, `bonuses: [{zone: damageBonus, key: dmg_up}]` [0; 0.4 from P3], `applies: [{kind: infliction, element: cryst}]`, `poise: "poise"` [10], `sp: {if: {stack: commiseration, atLeast: 1}, then: {key: atb, skill: buff_chr_0021_whiten_talent_0}, else: 0}` [15 at talent level 2]; not `detached` (row 35) | projhit SpellInfliction type 2; first-target DamageScaleProcessor; CreateBuff `buff_common_obtain_ultimate_sp`; battle-skill frame 21 CheckBuffStackNumAdvanced → GetTargetBuffBBAdvanced `atb` → ObtainCostAction costType 1 → FinishBuffAdvanced |
| combo_skill | `not_solidified` (**first**) | `atk_scale` [3.6], `[19]`, `events: [chr_0021_whiten_combo_skill]`, `if: {not: {enemyStatus: solidification}}`, `applies: [{kind: physicalStatus, status: lift, forced: true}]`, `energy: usp` [10], `poise: "poise"` [10] | IfElse false path: AirborneAction → DamageAction `atk_scale` |
| | `solidified` | `atk_scale2` [6.3], `[19]`, same events, `if: {enemyStatus: solidification}`, `buffs: [{buff: physical_susceptibility, beforeDamage: true}]`, `applies` as above, `energy: usp`, `poise: "poise"` | true path: (P1 blackboard) CreateBuff → AirborneAction → DamageAction `atk_scale2`; ObtainCostAction `usp` once if a target is hit |
| ultimate_skill | `hit` | `atk_scale` [11] (`atk_scale_total` = `atk_scale` + unwritten `dmg_up_total`), `[54]`, `poise: "poise"` [20], `applies: [{kind: physicalStatus, status: lift, forced: true, if: {enemyModifier: {zone: susceptibility, element: physical}}}]` | ForEach > CheckTagMatch 1066759270 > AirborneAction, then DamageAction; time stop from the data |

Triggers:

- `combo_window` (unchanged): `on: {event: reaction, statuses:
  [solidification]}, by: anyone, do: [{kind: openCombo}]` (CharGrowthTable
  COMBO TRIGGER).
- `talent1_shatter`: `on: {event: shatter}, by: self, do: [{kind: gain,
  gains: [{stack: commiseration}]}]`, plus `if: {talentAtLeast: [0, 1]}`
  once R2 exists. Source: `buff_chr_0021_whiten_talent_0` (abilityEvent 102,
  Shatter tag, targetSource 1).
- `talent1_used`: `on: {event: hit, kinds: [battle]}, by: self, do:
  [{kind: gain, gains: [{stack: commiseration, amount: -1}]}]`. A trigger
  rather than the hit's own `gains`, because `landHit` applies `gains`
  before it resolves `sp`, so the stack would be gone when `sp` reads it.
- `p5_energy`: `on: {event: reaction, statuses: [solidification]}, by:
  anyone, if: {potentialAtLeast: 5}, cooldown: 1, skill:
  buff_chr_0021_whiten_potential_5, do: [{kind: energy, value: usp}]` [5].
  Cooldown literal from `buff_chr_0021_whiten_potential_5_inaura` `cd`
  (R6); her cooldown, not per enemy (CreateTimedMarker targetSource 1).

Notes to carry: talent 2 and P3's range not modelled (defensive / one
enemy); P2's cost ×0.9 and P4's attributes come from the tables.

**Equipment kit `wpn_lance_0010` (Valiant), new:**

```json
{
  "$schema": "../../../../schemas/equipment-kit.schema.json",
  "equipment": "wpn_lance_0010",
  "sources": ["rmxlinux SkillData sk_wpn_lance_0010: passiveEventActions abilityEvent 402 (the wielder applies a physical status) → DamageAction atk_scale, damageType 0, mask 0 (inheritFirstDamageMask), no poise, no cooldown; SkillPatchTable atk_scale 1.2…3.36. Logged as chr_0015_lifeng_ultimate_skill (zmdlogs-4e5e1390085e: 5 hits at her 5 Lifts, 2.4 at skill level 6)."],
  "triggers": [{
    "id": "wpn_lance_0010.physical_status_hit",
    "on": { "event": "physicalStatus" },
    "by": "self",
    "skill": "sk_wpn_lance_0010",
    "do": [{ "kind": "hits", "hits": [{
      "id": "hit", "scale": ["atk_scale"], "element": "physical", "damageType": "none",
      "frames": [0], "events": ["chr_0015_lifeng_ultimate_skill", "sk_wpn_lance_0010"]
    }] }]
  }]
}
```

Its ATK +20% (skill 3, `cardAttributeModifier`) and the stat skills stay in
the stat panel; `buff_wpn_lance_0010` isn't created (row 32), so nothing
else.

**Equipment kit `suit_phy01` (Swordmancer):** owned by Gilberta's report
(S2); it's expressible the same way. As her fixture needs it: trigger `on:
{event: physicalStatus}, by: self, skill: passive_equipsuit_physuit_01,
cooldown: "duration"` [15 s, per wearer: AddGlobalCDTimer], `hits: [{id:
hit, scale: [atk_scale], element: physical, damageType: none, poise:
"poise", frames: [0], events: [buff_equipsuit_physuit_01]}]` [2.5, poise
10]. Fits the log: hits at the 3 combos only, none at the ultimates 5.0 and
10.2 s later.

**Verification after the rewrite:**

- `efsim zmdlogs check fixtures/zmdlogs-4e5e1390085e.json`: all 41 of her
  hits covered (Valiant ×5 and the set ×3 by event key); the ones after
  49.4 s still need the ×1.08 annotation.
- `skillCompile.test.ts`: expect one new KNOWN line for `teamEnergyFrame`
  (kit 21, data 0, first-hit branch) unless R6's first-hit fix lands first;
  the two combo hits and the ultimate match by key and frame.
- `examples/estella-solidification.scenario.json` (Valiant + Swordmancer
  ×3): its total rises (Lift, Shatter, Valiant and set hits; the team's
  energy 0.7 s later); re-baseline it in the kits phase.
- A unit test for R1: a Solidified combo lands exactly one combo hit, one
  Lift, one Shatter, one Valiant hit and 10 energy.

### 4. In-game tests for what's still unknown

1. **P5 energy from a teammate's Solidification** (round 1 test 1, still
   open; only with P5): with nothing else giving her energy, let a teammate
   cause Solidification. +5 means anyone's counts (the data says so).
   Then re-Solidify an enemy that is already Solidified: +5 again means a
   refresh counts. Two within 1 s: +5 once.
2. **Talent 1 SP** (round 1 test 2; talent 1 at level 2): note team SP,
   combo on a Solidified enemy (Shatter), then her battle skill: SP should
   end at before − 100 + 15. A second battle skill without a Shatter: −100
   only. A teammate's Shatter (their Lift on a Solidified enemy), then her
   battle skill: the data says no SP back.
3. **Valiant's hit and skill-type bonuses** (round 1 test 3): with a bonus
   for one skill type only (combo DMG or ultimate DMG), compare Valiant's
   hit after her combo with the one after her ultimate.
4. **Her Susceptibility across her own ultimate** (replaces round 1 test 4;
   P1+, a variant of test 18): combo on a Solidified enemy, cast her
   ultimate right after, and time how long the Physical Susceptibility icon
   stays from the combo hit: about 9 s means her own time stop doesn't
   freeze it, about 10.8 s means it does (row 38).
5. **Test 11 (combo on a target that isn't Solidified)** still applies; it
   now checks the `not_solidified` hit, and should also show a Lift damage
   number and a Vulnerable stack (forced Lift), but no Shatter.

## Re-analysis (pass 3, 2026-10-18)

Against the engine after batch-1.md "Pass 2 progress". Evidence: `events.ts`
(`TriggerOn`, `TriggerActionKind`, `KitTrigger`), `model.ts` (`KitHit.branch`,
`detached`), `expr.ts` (`talentAtLeast`, `{talent, key}`), `timeline.ts`
(`landHit` branch selection, `runTriggers` delayed actions, the
interrupt filter on `pendingActions`), `damage.ts` `skillValue` (unlearned
talent/potential sources → 0), loader `kits.ts`, both schemas. The plan
below was **loaded and run** from a scratch copy of `packages/data` (the
repo's kits untouched): it passes schema and loader checks;
`efsim zmdlogs check fixtures/zmdlogs-4e5e1390085e.json` gives Estella
41 hits, **26 match, 0 mismatch**, 15 under unmodelled effects (the ×1.08
after 49.4 s), **0 not covered (100% of her damage)**; in
`examples/estella-solidification.scenario.json` plus a second battle skill,
the Solidified combo lands one combo hit, one Lift, one Shatter, one
Valiant hit, one set hit, and the next battle skill returns 15 SP; a combo
cast after Solidification has run out lands `not_solidified` (Lift, no
Shatter); a build with talent 1 at level 0 and P0 runs without error and
returns no SP.

Re-checked against the data in this pass: talent 1 is talent index 0
(`chr_0021_whiten_passive_skill_0_1/_2` → `buff_chr_0021_whiten_talent_0`,
`atb` 7.5 / 15); the SP read is in `chr_0021_whiten_normal_skill` itself,
a sequence at frames 21–24 (CheckBuffStackNumAdvanced → GetTargetBuffBBAdvanced
→ ObtainCostAction → FinishBuffAdvanced), not in the projhit; the battle
skill's own `atb` is 0 (SkillData default); `buff_chr_0021_whiten_talent_0_active`
is lifeType 1 (no expiry; its only event, 150, ends it, most likely on leaving
the fight: Liino's report), stackingType 7, max 1. Its CreateBuff has
`finishWithNextSkillIfNotInherited: true`, but that flag is true on every
one of the 4,342 CreateBuff actions in BuffData/SkillData, and
`autoFinishByAction` is false here, so it doesn't end with the next skill.
P5's attached blackboard is only `usp` 5 (`cd` 1 is in `_potential_5` /
`_potential_5_inaura` BuffData). Valiant's skills: `wpn_attr_agi_high`,
`wpn_sp_attr_phydam_high`, `sk_wpn_lance_0010`. All **confirmed**.

### (a) Pass-2 gaps now

| Pass 2 | Now | Fields / interim rule |
|---|---|---|
| R1 alternatives judged one after another | **supported** (C4) | `branch: "target"` on both combo hits: judged together on the situation before either lands; the first in kit order whose `if` holds lands. So the order now matters the other way: `solidified` (with `if: {enemyStatus: solidification}`) first, `not_solidified` (no `if`, the else) second. An `if`-less hit listed first would always win. The loader requires a branch's hits to have the same `count` (1 each) |
| R2 talent level in predicates | **supported** (V8) | `if: {talentAtLeast: [0, 1]}` on the Shatter trigger; the SP value is `{talent: 0, key: "atb"}` (0 while unlearned; the loader checks `atb` on every buff talent 0 attaches). `{key, skill: buff_…}` no longer throws either (unlearned sources give 0) |
| R3 projectile travel; `detached` before launch | **still open**: Ti2 | interim: kits write landing frames; the projhit stays at its launch frame 21 (no log measures her travel: test 47). `detached` now means what R3 wanted for cast triggers (S8); for the projhit see the plan's `"detached": false` |
| R4 hit-stop; what her own time stop freezes | **still open**: Ti1b (hit-stop not modelled) | the engine freezes every buff, the caster's own included, during an ultimate's time stop: her Susceptibility may last up to 1.8 s too long per own ultimate. Tests 18 (Estella bullet) and 37 |
| R5 mid-air availability | **supported as a rule** (S10) | `earliestStart` refuses any skillSpecification-6 skill ("needs mid-air, and rotations have no jumps"): the dive can't be cast at all until rotations have jumps. Keep its hit in the kit |
| R6 compiler leftovers | **still open**: D2 | kits hand-write (no effect on numbers). The D2 row in batch-1.md doesn't name one of R6's items: values of the **BuffData** of a buff a talent or potential attaches (P5's `cd`). The loader reads attached values only from the attachBuff blackboard, so `cooldown: "cd"` with `skill: buff_chr_0021_whiten_potential_5` is **rejected** ("has no value cd"): keep the literal `1` |
| Note: delayed cast-trigger actions not cancelled | **supported** (S8) | delayed actions of a cast event are dropped when the cast is cut short before they run (unless `detached`). Talent 1's SP now uses this (plan) |

Not needed by her kit: `decorations`, `fromKinds`, `categories`,
`maxPerCast`, `beforeDamage` on triggers (Valiant's and the set's hits are
separate hits, so they don't care), `scaleValue`, `fixedDamage`, `records`,
`endsWithCast`, `cancelHits`, `endAction`, `fraction`, `eventRemaining`,
`eventRecorded`, the hit trigger's `reaction` filter.

### (b) Kit plan: what changed

Everything else in the pass-2 plan (§ 3) stands: buffs, attack1–4,
power_attack, dive, ultimate, `combo_window`, `p5_energy`, Valiant's kit,
Swordmancer's trigger. No `durationFrames`.

1. **Combo** (replaces the two rows; R1):

```json
{ "skillId": "chr_0021_whiten_combo_skill", "label": "Combo skill", "damageType": "combo", "hits": [
  { "id": "solidified", "label": "Combo skill (Solidified target)", "branch": "target",
    "if": { "enemyStatus": "solidification" },
    "scale": ["atk_scale2"], "events": ["chr_0021_whiten_combo_skill"], "frames": [19],
    "buffs": [{ "buff": "physical_susceptibility", "beforeDamage": true }],
    "applies": [{ "kind": "physicalStatus", "status": "lift", "forced": true }],
    "energy": "usp", "poise": "poise" },
  { "id": "not_solidified", "label": "Combo skill (target not Solidified)", "branch": "target",
    "scale": ["atk_scale"], "events": ["chr_0021_whiten_combo_skill"], "frames": [19],
    "applies": [{ "kind": "physicalStatus", "status": "lift", "forced": true }],
    "energy": "usp", "poise": "poise" }
] }
```

2. **Talent 1** (R2 and S8): the projhit loses its `sp`, the `talent1_used`
   hit trigger goes, and one delayed cast trigger does both at the frame the
   data does them (frames 21–24 of the battle skill). Each action's `if` is
   judged when it runs, so the trigger itself has none (its `if` would be
   judged at the cast). A cast cut short before frame 21 does neither,
   as in game.

```json
{ "id": "talent1_shatter", "on": { "event": "shatter" }, "by": "self",
  "if": { "talentAtLeast": [0, 1] },
  "do": [{ "kind": "gain", "gains": [{ "stack": "commiseration" }] }] },
{ "id": "talent1_sp", "on": { "event": "cast", "skills": ["chr_0021_whiten_normal_skill"] }, "by": "self", "delay": 21,
  "do": [
    { "kind": "sp", "value": { "talent": 0, "key": "atb" }, "if": { "stack": "commiseration", "atLeast": 1 } },
    { "kind": "gain", "gains": [{ "stack": "commiseration", "amount": -1 }] }
  ] }
```

   The stack: `{ "id": "commiseration", "label": "Commiseration (talent 1)",
   "max": 1 }` (`label` is required by the schema). The `sp` action counts as
   returned SP (no team energy), as before.

3. **Battle-skill projhit: write `"detached": false`.** Pass 2 said "leave
   it out"; but the loader *defaults* a hit to detached when its `events`
   don't include the skill's own ID, and `chr_0021_whiten_normal_skill_projhit`
   doesn't. Left out, it would land even when her combo or ultimate cuts
   the battle skill before frame 21 (checked: the loaded hit has
   `detached: true`). The rest of the hit is unchanged: `atk_scale`,
   `element: cryst`, `frames: [21]`, `bonuses` `dmg_up`, Cryo infliction,
   `poise: "poise"`, skill `teamEnergyFrame: 21`.

4. **`p5_energy`:** unchanged, `cooldown: 1` stays a literal (R6 row above:
   `"cd"` is rejected).

5. **Verification after the rewrite** (replaces pass 2's list):
   - `skillCompile.test.ts` fails with exactly one new disagreement, to add
     to `KNOWN`: `"chr_0021_whiten_normal_skill teamEnergyFrame: kit 21,
     data 0"` (the first-target branch, D2). The branched combo hits, the
     Lifts and poise raise none.
   - The log check numbers above (26 / 0 / 15 / 0) once Valiant's and
     Swordmancer's kits are in.
   - `examples/estella-solidification.scenario.json`: re-baseline (Lift,
     Shatter, Valiant and set hits; no test pins its total today).
   - Unit tests: a Solidified combo lands one combo hit, one Lift, one
     Shatter, one Valiant hit and 10 energy; a battle skill cut short before
     frame 21 returns no SP and keeps the stack.

Nothing in the plan is rejected by the loader.

### (c) New gaps

None. The only new finding is the loader default in (b) 3, a kit-writing
trap rather than a missing feature: worth a line in the kit-format docs
(a hit whose events name another SkillData file is `detached` unless it
says otherwise).

### (d) In-game tests the kit still depends on

- **11** (combo on a non-Solidified target: the `not_solidified` hit, Lift
  number, Vulnerable stack, no Shatter);
- **18** (Estella bullet: does her own time stop freeze her Susceptibility; R4);
- **38** (two Susceptibility sources add or not; her Physical one too);
- **39** (Swordmancer's hit, if she wears it);
- **47** (her battle skill's travel; R3, lower priority);
- **48** (Valiant's skill-type bonus, `inheritFirstDamageMask`);
- **49** (talent-1 SP, and that a teammate's Shatter doesn't count);
- **50** (P5: anyone's Solidification, refreshes, 1 s cooldown).
