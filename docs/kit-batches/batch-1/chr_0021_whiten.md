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
