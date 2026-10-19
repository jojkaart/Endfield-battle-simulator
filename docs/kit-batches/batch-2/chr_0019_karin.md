# Akekuri (chr_0019_karin): gap report, batch 2

Operator Akekuri (CharGrowthTable `charTypeId` Fire, `profession` 7,
`mainAttrType` 40 Agility, `subAttrType` 41 Intellect, `weaponType` 1
Sword, rarity 4). Her skills deal Physical DMG except the battle skill
(Heat). Equipment covered here ([batch-2.md](../batch-2.md)): weapons
`wpn_sword_0009` Wave Tide and the lances `wpn_lance_0009` Opero 77,
`wpn_lance_0003` Pathfinder's Beacon, `wpn_lance_0008` Aggeloslayer
(written as generic equipment: no batch-2 operator uses lances); gear sets
`suit_atb01` Frontiers, `suit_combo_cd01` Qingbo, `suit_agi01` Roving
MSGR.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
EquipSuitTable, I18nTextTable_EN; Json/SkillData `chr_0019_karin_*`,
`sk_wpn_sword_0009`, `sk_wpn_lance_000{3,8,9}`,
`passive_equipsuit_{combosuit_01,combo_cd01,agi_01}`; Json/BuffData
`buff_chr_0019_karin_*`, `buff_wpn_{sword_0009,lance_0003,lance_0008,lance_0009}`,
`buff_equipsuit_{combosuit_01*,combo_cd01*,agi_*}`,
`buff_common_affixes_combo_trigger`. Values at skill level 12 and weapon
skill level 9 unless stated. `efsim kit-draft chr_0019_karin` was run on the
main checkout; the kit plan was loaded and simulated from a scratch copy
(§ Kit plan). Reference simulators were read for claims only (Zero Sanity's
Akekuri files; Endaxis's generated Akekuri buff and its SP-gain kinds, not
copied), each marked as a claim below.

No committed or pending log fixture has Akekuri (`grep karin` over
`fixtures/` and `fixtures/pending/`: none); nothing here is checked against
a log.

## Data overview

Action `$type`s per file (presentation actions such as camera, effects,
sound, animation, root motion, teleports left out) and what they do for
the simulation:

| File | Types that matter | Effect |
|---|---|---|
| `attack1`, `attack3` | DamageAction (mask 128), ObtainCostAction (attack3: costType 1, `atb` 0) | damage |
| `attack2` | 2 × DamageAction (`atk_scale`, `atk_scale_2`), 2 × ObtainCostAction (`atb` 0) | damage |
| `attack4` | 3 × DamageAction (frames 19, 20, 21; the last mask 2097280 Final Strike, poise unit `poise` 17 `onlyEnableForMainChar`), ObtainCostAction `atb` 19 (atbGainMethod 0, atbSourceType 1) under CheckMainCharacterCondition | damage, stagger, SP |
| `power_attack` | 2 × DamageAction with BreakingAttackCalculation (`multiplier` 0.2 at frame 13, 0.8 at 36; mask 132), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` (autoFinishByAction) | finisher damage, SP, cast lock |
| `plunging_attack_end` | DamageAction (mask 1152), ObtainCostAction (`atb` 0) | dive damage |
| `plunging_attack_start` | none (animation) | – |
| `normal_skill` | SpellInfliction type 0 (Heat) + DamageAction damageType 2 (Heat, AtkScaleCalculation `atk_scale`, mask 4352, poise `poise`) at frame 20; CreateBuff `buff_common_obtain_ultimate_sp` at 20 if a target; BlowOffEnemyAction (deadOption 2: death knock-back) | damage, infliction, team energy |
| `combo_skill` | per sequence (frames 22 and 31): ObtainCostAction costType 1 `atb` (after ModifyDynamicBlackboard / StoreAttributeValue / CompareFloat math, below), DamageAction (`atk_scale`, mask 12288, poise `poise` 5), ObtainCostAction costType 0 `usp` (once per sequence by a `count` guard); TimeDilationAction ComboSkill 0.6 s | damage, SP, energy, stagger, slow-down |
| `ultimate_skill` | no DamageAction. ObtainCostAction costType 1 `atb_1`/`atb_2`/`atb_3` at frames 59, 86, 119; StoreAttributeValue / ModifyDynamicBlackboard at 0–12 (scales them by 1, see O16); CreateBuff `buff_chr_0019_karin_potential_3` (team, frame 0, if `potential_3` > 0), `buff_chr_0019_karin_talent_2` and `_talent_2_combo` (frame 1, if `combo` ≥ 1); UltimateTimeAction 0–55; TimeDilationAction RESETto1; ChannelingCastingAction cantCastSkill + cantSwitchPosition 0–119; AllowNextSkillAction 129–201 (battle skill, attack1, combo); CreateBuff `buff_common_damage_immune_ult_skill` | SP, team buffs, Link, timing |
| `buff_…_potential_1` | abilityEvent 142 + CheckObtainAtbType (method [0], type [3]) → CreateBuff `_potential_1_1` | P1 trigger |
| `buff_…_potential_1_1` | attributeModifier attr 2 formulaItem 6 `atk_up`; stackingType 8, max 5, duration `duration` | P1 ATK layers |
| `buff_…_potential_3` | attributeModifier attr 2 formulaItem 6 `atk`; lifeType 1 | P3 team ATK |
| `buff_…_potential_5` | none (lifeType 1 marker) | P5 flag read by talent 2 |
| `buff_…_potential_5_combo` | buffEvent 2 (finish) → FinishBuffAction `_talent_2_combo`; duration `potential_5_duration` | P5 tail |
| `buff_…_talent_2` | buffEvent 2 → IfElse CheckBuffStackNum `_potential_5` ≥ 1: CreateBuff `_potential_5_combo`, else FinishBuffAction `_talent_2_combo` | talent 2 end |
| `buff_…_talent_2_combo` | buffEvent 5 → CreateGlobalBuffAction `global_buff_combo_trigger` (`imbue_scale`, `duration`, autoFinishByAction) | talent 2 Link |
| `buff_…_talent_1`, `buff_…_ult` | globalModifier type 5 / none | **unused**: nothing creates them (`buff_…_ult` is only a UI highlight condition of the battle skill) |

`kit-draft` compiles attack1–4, power_attack, plunging_attack_end,
normal_skill and combo_skill frames, scales, counts, events, the Final
Strike, the Heat infliction, the combo's `usp` and the battle skill's
`teamEnergyFrame` 20. It leaves out (all checked above): the per-hit
element (it writes the kit element `fire`, which would make every
Physical hit Heat), poise, the finisher's 0.2 / 0.8 factors, the combo's
SP (a dynamic `atb`: "SP $atb?: not a kit value"), everything of the
ultimate ("Skills with nothing compiled"), and the buffs the skills create
(P3, talent 2).

SkillPatchTable at level 12: attack1 0.45; attack2 0.28 + 0.34; attack3
0.73; attack4 3 × 0.37 (poise 17, `atb` 19); power_attack 9; dive 1.8;
battle skill 3.2 (poise 10, 100 SP); combo 1.8 per sequence (poise 5,
`usp` 5, `atb` 7.5, cooldown 9 s; 10 s at L1); ultimate cost 120 energy,
cooldown 20 s, `atb_1/2/3` 26 / 27 / 27 (`atb_display` 80).
`chr_0019_karin_dash_attack` (dodge attack, 1.06) has a SkillPatchTable
entry but no SkillData file and isn't in a skill group.

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| O1 | Basic attacks 1–4 (CharGrowthTable "An attack with up to 4 sequences that deals Physical DMG"): frames 9; 8, 16; 10; 19, 20, 21 | supported | `hits[].scale/frames/count`; Final Strike on attack4's third landing from mask 2097280 |
| O2 | Basic-attack SP: attack4 `atb` 19 only as controlled (CheckMainCharacterCondition); attack2/3 and dive `atb` 0 | supported | `sp: "atb"` on the landing with the ObtainCostAction. Natural vs returned: G3 |
| O3 | Final Strike stagger: "As the controlled operator, Final Strike also deals {poise:0} Stagger" (attack4 poise 17, `onlyEnableForMainChar`) | data | `poise: "poise"`, `poiseControlledOnly: true` hand-written (compiler: G7) |
| O4 | Finisher ("near a Staggered enemy … massive Physical DMG and recovers some SP"): BreakingAttackCalculation 0.2 × / 0.8 × `atk_scale` 9 at 13 / 36, GainBreakingAttackAtb | data | two hits with `factor` 0.2 / 0.8 (the compiler reads `multiplier` as 1: G7); the engine gates it on Staggered, adds the finisher multiplier and SP |
| O5 | Dive attack (mask 1152, `canCastInAir`) | supported | kept; the engine refuses skillSpecification 6 until rotations have jumps (S10) |
| O6 | Dodge attack `chr_0019_karin_dash_attack` | n/a | no SkillData, no skill group (as Gilberta's) |
| O7 | Battle skill "A frontal slash that deals Heat DMG and applies Heat Infliction": frame 20, `atk_scale` 3.2, poise 10, SpellInfliction type 0 | data | hit `element: "fire"` (kit element `physical`), `applies` Heat, `poise`; element and poise hand-written (G7) |
| O8 | Battle skill team energy (`buff_common_obtain_ultimate_sp` at frame 20) | supported | `teamEnergyFrame: 20` (compiled) |
| O9 | Combo trigger "When an enemy becomes Staggered …" | supported | trigger `on: {event: staggered}, by: anyone, do: openCombo` |
| O10 | Combo trigger "… or hits a Stagger Node" | gap | G1 |
| O11 | Combo: "a returning dash with 2 thrust sequences, each dealing Physical DMG": `atk_scale` 1.8 at 22 and 31, poise 5 each, `usp` 5 each (subdesc "Ultimate Energy Gain 10") | data | `count: 2, frames: [22, 31], energy: "usp", poise: "poise"`; poise hand-written (G7) |
| O12 | Combo SP "and recovering some SP": per sequence `atb` 7.5 × min(1 + INT × `sub_ratio` / `rate`, 1 + `max_ratio`) (ModifyDynamicBlackboard `sub_ratio` op 3 = ÷ `rate`; StoreAttributeValue baseValue 1, primaryAttributeType 2 = Intellect, multiplier `sub_ratio`, divisor 1, `useFloor` false; `max_ratio` op 1 += 1; CompareFloat compare 0 picks the smaller); the frame-31 grant reuses the scaled `atb`. Before each sequence's damage | supported | delayed cast triggers at 22 and 31 with `sp: {product: [atb, {min: [{sum: [1, {product: [{attr: 41}, sub_ratio, 0.1]}]}, {sum: [1, max_ratio]}]}]}`, and `sp: 0` on the hits (so the skill's `atb` isn't added to its first hit). `0.1` is 1 / `rate` (10 at every level): G6. Verified in a scratch run: 9.85 SP per sequence at INT 209 (7.5 × 1.3135) |
| O13 | Combo cooldown 10 → 9 s (SkillPatchTable) | supported | from the tables |
| O14 | Combo slow-down (TimeDilationAction ComboSkill 0.6 s, ignoring the caster) | supported | engine (Ti1) |
| O15 | Ultimate cost 120 energy, cooldown 20 s; P4 "Ultimate Energy cost −10%" (skillParamModifier paramType 1 ×0.9) | supported | tables |
| O16 | Ultimate "fires 3 Rallying Flares. Each firing recovers some SP": `atb_1/2/3` 26 / 27 / 27 at frames 59 / 86 / 119. Its own atb_up math multiplies them by 1 (the ultimate's `sub_ratio` is never set: talent 1 changes the combo only) | data | hitless skill (`hits: []`) + three delayed cast triggers `{kind: sp}` (the compiler emits nothing for this skill: G7) |
| O17 | Ultimate timing: time stop 0–55, cantCastSkill/cantSwitch channel 0–119, window 129–201 (battle skill, attack1, combo), exclusive 150, duration 233 | supported | SkillData (engine). In the scratch run a battle skill cut it at 4.30 s (frame 129) |
| O18 | Kind of SP her skills give: every ObtainCostAction of hers has atbGainMethod 0 (combo and ultimate atbSourceType 3, basic attacks 1); talent refunds elsewhere use method 1 (`atb_return` keys) | gap | G3: the engine counts all kit SP as returned SP (no team energy when spent) |
| O19 | Talent 1 "Cheer of Victory": "For every {rate} points of Intellect, SP Recovery +{sub_ratio} (max {max_ratio})"; PotentialTalentEffectTable `chr_0019_karin_talent_1_1/_2`: skillBbModifier "set" on the combo's `sub_ratio` 0.01 / 0.015, `max_ratio` 0.5 / 0.75, `rate` 10 | supported | the stat panel's `skillValues` (checked: `computeStats` lists the three sets); O12's value reads them. Text "for every 10 points" vs data without floor: unknown U1 (≤ 0.07 SP per sequence) |
| O20 | Talent 2 "Staying in the Zone": "When ultimate is active, grants a Link buff" (`combo` 1, `imbue_scale` 0.2 on the ultimate; `_talent_2_combo` → `global_buff_combo_trigger`) | gap | G2 (and unknown U2: what the Link is worth, how long) |
| O21 | Talent 2's Link ends with the ultimate (`_talent_2` autoFinishByAction; its finish ends `_talent_2_combo` unless P5) | supported | marker buff `endsWithCast` + `buffEnded` triggers (plan). How long the ultimate's "action" lasts when she does nothing after it: unknown U4 |
| O22 | P1 "Positive Feedback": "After recovering SP with skills, Akekuri gains ATK +{atk_up} for {duration}s … {max_stack} stacks" (abilityEvent 142, CheckObtainAtbType method 0 type 3) | supported | written next to each of her own SP grants (combo 22 / 31, ultimate 59 / 86 / 119). The general form needs the SP event of G5 (it would also count SP from equipment of source type 3) |
| O23 | P1 stacking: `_potential_1_1` stackingType 8, max 5 | supported | one stack `positive_feedback` (max 5) + a timer buff `atk_up × layers` re-applied on each layer (replacing it restarts its 10 s; Umbra's Windform pattern), `buffEnded` → −5. Type 8 as "enhance and refresh" (one timer, refreshed by each layer) is Endaxis's reading (claim): unknown U3. It matters: a combo every 9 s gives 2 layers, so with one shared timer she holds 5 layers (+50% ATK) nearly always; with separate timers about 2–4 |
| O24 | P2 Agility +10, Intellect +10 | supported | stat panel |
| O25 | P3 "While ultimate is active, entire team gains ATK +{atk}" (`buff_…_potential_3` on the team, autoFinishByAction, frame 0) | supported | team buff `zone: atk, value: atk`, `endsWithCast`, cast trigger `if: {potentialAtLeast: 3}`. Scratch run: ends at 4.30 s when her battle skill cuts the ultimate |
| O26 | P5 "Even when the ultimate ends, the Link buff persists for {potential_5_duration}s" (5 s) | supported | `zone_tail` buff with `duration: potential_5_duration` (0 s below P5: not applied); its end ends the Link. Waits on G2 to have an effect; whether the global buff's own 10 s caps it: U2 |
| O27 | Attribute nodes Agility +10 / 15 / 15 / 20 | supported | stat panel |
| O28 | Ultimate damage immunity, `buff_…_talent_1` / `buff_…_ult` (unused), BlowOff on death | n/a | defensive or presentation |
| O29 | Hit-stop on her basic-attack and combo hits (HitStopAction in attack1–4, combo) | unknown | Ti1b on batch 1's open list (not modelled; tests 18, 37) |
| E1 | Wave Tide skills 1–2: Intellect +93, ATK +23.4% (`wpn_attr_wisd_low`, `wpn_sp_attr_atk_low`) | supported | stat panel (checked with `efsim calc`) |
| E2 | Wave Tide skill 3 "When the wielder casts a combo skill, the wielder gains ATK +{atk_up} for {duration}s. Effects of the same name cannot stack." (abilityEvent 30, CheckSkillType [6] → `buff_wpn_sword_0009`, stackingType 4) | supported | cast trigger `kinds: [combo]` → self buff `zone: atk`, `duration: "duration"` (20 s; the SkillData default 15 is overridden), refreshed |
| E3 | Opero 77: main attribute +79, ATK +33.6 flat (cardAttributeModifier formulaItem 7). `buff_wpn_lance_0009` exists but nothing creates it | supported | stat panel only; no kit file |
| E4 | Pathfinder's Beacon skills 1–2: Agility +93, ATK +23.4% | supported | stat panel |
| E5 | Pathfinder's Beacon skill 3 "When the wielder's HP is above {hp_ratio_c}, ATK +{atk_up}" (toggleBuffs `buff_wpn_lance_0003` under CheckCurHpRatio ≥ 0.8; 0.42 at L9) | supported | permanent self buff on `fightStart` (interim: HP isn't modelled, N1; operators are at full HP) |
| E6 | Aggeloslayer skills 1–2: Will +93, Arts DMG +26% (all arts elements, Ether included) | supported | stat panel |
| E7 | Aggeloslayer skill 3 "When the wielder's battle skill hits the enemy, … ATK +{atk_up} for {duration}s" (abilityEvent 302 + CheckDamageDecorateMask checkType 2 mask 256) | supported | hit trigger `kinds: [battle], reaction: false` → self buff, 20 s, refreshed |
| E8 | Frontiers and Qingbo 3-piece "Wearer's Combo Skill Cooldown Reduction +15%" (cardAttributeModifier attr 47 ComboSkillCooldownScalar formulaItem 8, 0.85) | gap | G4: the panel has attr 47 = 0.85, but the cooldown never reads it (scratch run: second combo at 9.00 s) |
| E9 | Frontiers "After the wearer's skill recovers SP, the team gains DMG +{dmg_up} for {duration}s. This effect cannot stack." (abilityEvent 142 type 3 → team `buff_equipsuit_combosuit_01_adddamage`, DamageScaleProcessor NormalCalcZone `dmg_up` 0.16, 15 s, stackingType 2 max 1) | gap | G5 (the buff itself: team `damageBonus` buff, in the plan) |
| E10 | Qingbo "When the wearer casts a combo skill, the wearer gains Skill DMG Dealt +{spell_up} (for every skill) for {duration}s. … {max_stack} stacks. Duration of each stack is counted separately." (attrs 32, 33, 28 battle / combo / ultimate DMG; stackingType 2, `max_stack` 2 passed) | supported | cast trigger `kinds: [combo]` → layered buff `maxStacks: "max_stack"`, 15 s each (checked: two layers after two combos) |
| E11 | Roving MSGR Agility +50 | supported | stat panel |
| E12 | Roving MSGR "When the wearer's HP is above {hp_ratio}, Physical DMG +{phy_dmg_up}" (toggleBuffs, attr 50, 0.2) | supported | permanent self buff on `fightStart` (interim full HP, N1) |
| E13 | Two Frontiers wearers ("This effect cannot stack"; same BuffData, stackingType 2 max 1, from two sources) | unknown | minor; batch 1's B9 rule (layers per owner) gives both. Not tested |

Counts (42 rows): supported 28, data 5 (O3, O4, O7, O11, O16), gap 5
(O10, O18, O20, E8, E9 → G1–G5; G6 and G7 are smaller gaps without a row
of their own), unknown 2 (O29, E13; U1–U4 are open points inside
supported or gap rows), unique? 0, n/a 2.

Before calling anything unique: [kit-unique.md](../../kit-unique.md) has
only Si's damage record. Two of the gaps have a single user in the data so
far: the Stagger Node combo trigger (CharGrowthTable: only Akekuri's
COMBO TRIGGER text mentions `ba.poiseknot`) and a talent granting Link
(`global_buff_combo_trigger` is created only in
`buff_chr_0019_karin_talent_2_combo`). Both extend shared engine state
(the stagger meter, P2; Link, B8), so they are proposed as shared
mechanisms, not as her own module.

## Gaps

### G1. A Stagger Node event

- **family:** physical state (stagger), with a new trigger event.
- **feature:** when a hit's stagger takes the enemy's stagger HP from above
  to at or below `node × max` for a node of its `staggerNodes`
  (EnemyData, `poiseKnotPctList`), emit `{type: "staggerNode", frame,
  operator, node}` (`operator`: who dealt the stagger), before the
  `staggered` event if the same hit also empties the bar. A node fires
  once per stagger cycle (the bar refilling after a stagger re-arms them:
  assumed, U6). Trigger `on: {event: "staggerNode"}`, `by` as usual. Lives
  in `dealPoise` (timeline.ts), which already has the before / after
  values. Her combo: `{on: {event: "staggerNode"}, by: "anyone", do:
  [{kind: "openCombo"}]}`.
- **evidence:** CharGrowthTable `chr_0019_karin_ComboSkill`: "COMBO
  TRIGGER: When an enemy becomes Staggered or hits a Stagger Node."
  Rhodagn's `staggerNodes` [0.5] (stagger HP 280); 36 of 149 enemies have
  nodes. batch-1.md P2: "Stagger nodes (small staggers) have no damage
  effect and aren't modelled."
- **impact:** against Rhodagn, half of her combo windows from stagger are
  missing (one per 280 stagger instead of one per 140). Each combo is 2 ×
  1.8 ATK, ~20 SP, 10 energy, 2 P1 layers, and Wave Tide's / Qingbo's
  triggers; she's an SP battery, so this is the largest gap for her
  value to a team.

### G2. Link stacks from a kit buff

- **family:** buff lifecycle (Link, batch 1's B8).
- **feature:** a kit buff flag `link: true` (team buff): while it's active
  it counts as one Link stack for the team, added to the combo stacks
  (`st.link`) when a battle skill or ultimate uses Link (`n = min(4, combo
  stacks + active link buffs)`); using Link ends it (a `buffEnded` event,
  so P5's tail logic sees it). Its duration and early end are the buff's
  own (`duration`, `endBuff`). Follow-up casts neither use it nor end it,
  as for combo stacks.
- **evidence:** `chr_0019_karin_ultimate_skill` frames 1–150: CompareFloat
  `combo` ≥ 1 → CreateBuff `buff_chr_0019_karin_talent_2` (autoFinishByAction)
  and `_talent_2_combo`, whose buffEvent 5 creates
  `global_buff_combo_trigger` (`imbue_scale` 0.2, `duration` 10,
  autoFinishByAction). The game's Link buff
  `buff_common_affixes_combo_trigger` takes its value from
  ReadSkillSettingData `连击增伤` by its stack `count` on the caster's skill
  cast (CheckSkillType [2, 7]) and then finishes the global buff (finishAll,
  finishParent): so one use. The asset `global_buff_combo_trigger` itself
  isn't in the data (only its path in StringPathHash). Claim (Zero Sanity
  `ultimate-squad-on-me.json`): Link "to TEAM" for the ultimate's active
  segment, +5 s at P5, consumed by the next battle skill / ultimate as one
  stack.
- **impact:** without it talent 2 does nothing: the first battle skill or
  ultimate cast during her ultimate (or within P5's 5 s) misses +30% /
  +20% (one stack; more when combo stacks are also up: +15% / +10% per
  extra stack), once per ultimate (20 s cooldown). Interim, if wanted: a
  team buff with `consumedBy: ["battle", "ultimate"]` and multiplicative
  0.3 / 0.2 by skill type is exact with no combo stack up and overstates
  with one (it multiplies instead of adding a stack).

### G3. Natural and returned SP

- **family:** values (resources).
- **feature:** SP grants carry their kind: natural (ObtainCostAction
  atbGainMethod 0: spent, it gives the team 0.065 energy per SP like
  regenerated SP) or returned (atbGainMethod 1: spent first, no energy).
  Kit field `spKind: "natural" | "returned"` on hits' `sp` and on `sp`
  actions (a skill's default `atb` too), and two pools in the timeline
  instead of `spReturned` alone; the compiler emits the kind from
  atbGainMethod.
- **evidence:** every ObtainCostAction costType 1 of hers has atbGainMethod
  0 (attack2/3/4, dive, combo × 2, ultimate × 3); the method-1 ones in the
  data are refunds keyed `atb_return*` / `potential_*_atb` (Laevatain's,
  Liino's, Typhoeus's, Catcher's battle skills; Estella's has method 1
  too). Claim (Endaxis, generated data, read only): method 0 → `spGainKind
  'gain'`, 1 → `'refund'`; its Akekuri SP gains are all `'gain'`; Zero
  Sanity models her combo and ultimate SP as `RECOVER` (natural), not
  `RETURN`. timeline.ts `returnSp` treats skills' `atb` and every kit
  grant as returned. Scratch run: after her ultimate (80 SP) the battle
  skill gave 1.46 energy (only the 20 SP above the 80 counted).
- **impact:** her 80 SP per ultimate and ~20 per combo give no ultimate
  energy to anyone when spent; if they're natural, that's 5.2 energy per
  operator per ultimate and ~1.3 per combo. It touches every kit: Final
  Strikes' `atb` (19 → 1.2 energy per operator) is method 0 too, so the
  whole team's energy economy is low today. Needs the in-game test below
  before it changes numbers.

### G4. Cooldown attributes

- **family:** skills (cooldowns).
- **feature:** a skill's cooldown at cast reads the caster's cooldown
  attributes: attr 47 ComboSkillCooldownScalar (× on combo cooldowns), and
  the others the data uses (16 SkillCooldownScalar, 46
  SkillCooldownAddition, 93 ComboSkillCooldownRecoveryScalar), from the
  panel and from active buffs (`buffAttr`). Today `skillCosts` uses only
  potentials' `skillParams`.
- **evidence:** `passive_equipsuit_combosuit_01` and
  `passive_equipsuit_combo_cd01` cardAttributeModifier attr 47 formulaItem
  8 `comboskill_cooldown` 0.85 (SkillPatchTable). `efsim calc`: the panel
  shows ComboSkillCooldownScalar 0.85; scratch run with Qingbo: second
  combo at 9.00 s, not 7.65 s. Attr 47 also in `wpn_sk_cscd(_high)` (weapon
  stat skills), `buff_common_cdr_buff_potion_1`, `buff_chr_0031_mifu_*`,
  `buff_chr_0033_camille_*`; attr 16 in `buff_equipsuit_cd_01`; attr 93 in
  `buff_chr_0035_liino_normalskill_combocd`.
- **impact:** two of the three gear sets here do 15% less than they
  should for every wearer: up to 18% more combos where windows allow.

### G5. An "SP recovered" event

- **family:** triggers.
- **feature:** an event `{type: "sp", frame, operator, amount, kind,
  natural}` whenever an operator's hit or trigger action grants SP (not
  regeneration; the finisher's SP as `basic`), `kind` = the skill kind of
  its source (a hit's damage type; a cast trigger's skill; `none`
  otherwise), matching atbSourceType (1 basic attacks, 3 skills). Trigger
  `on: {event: "sp", kinds?, natural?}`. P1 and Frontiers then are one
  trigger each: `{on: {event: "sp", kinds: ["battle", "combo",
  "ultimate"], natural: true}, by: "self"}`.
- **evidence:** abilityEvent 142 + CheckObtainAtbType `obtainMethodList`
  [0], `obtainTypeList` [3] in `buff_chr_0019_karin_potential_1` and
  `buff_equipsuit_combosuit_01`; also in `buff_cc_*`, `buff_dung_*`,
  `buff_train_*`, `sk_wpn_lance_0015`, `sk_wpn_sword_0012/0016/0019`,
  `chr_0029_pograni_talent1` (later batches). Survey of costType-1
  ObtainCostActions: atbSourceType 1 on basic attacks, 3 on battle / combo
  / ultimate skills, 0 on a few finishers, dives and refunds.
- **impact:** Frontiers' team DMG +16% (15 s, refreshed by every skill SP
  grant: with Akekuri nearly always up) can't be written for any wearer;
  P1 can be written only per SP grant of her own kit.

### G6. Division in values (small)

- **family:** values.
- **feature:** `{quotient: [a, b]}` in ValueExpr (ModifyDynamicBlackboard
  operation 3, StoreAttributeValue `divisorValue`). Catcher's G4 asks for
  `floor` in the same place (StoreAttributeValue `useFloor`).
- **evidence:** combo frame 22 ModifyDynamicBlackboard `sub_ratio` op 3
  value `$rate`.
- **impact:** none today: the plan writes `0.1` for 1 / `rate` (10 at both
  talent levels and in SkillData), a literal the loader can't check
  against the data.

### G7. Compiler leftovers seen on Akekuri (D2)

- **family:** data compilation.
- **feature:** kit-draft / loader defaults should emit: the per-hit element
  from the DamageAction's `damageType` (0 physical, 2 heat) with the kit
  element the basic attacks' (today it writes `element: fire` for the whole
  kit); poise from `poiseCalculation` (`applyScale` false here: the plain
  value), `onlyEnableForMainChar` → `poiseControlledOnly`;
  BreakingAttackCalculation `multiplier` as `factor`; SP-only ObtainCostActions
  on a hitless skill as delayed cast-trigger `sp` actions (her ultimate);
  the buffs a skill creates (P3's team buff, talent 2's).
- **evidence:** the draft vs the data in § Data overview;
  `skillCompile.test.ts` with her plan added to `OPERATORS` reports exactly
  two disagreements, `chr_0019_karin_power_attack/hit factor: kit 0.2,
  data 1` and `…/hit_2 factor: kit 0.8, data 1` (the same as Laevatain's
  known ones).
- **impact:** none once hand-written; the element trap would make every
  Physical hit Heat if a kit were taken from the draft as is.

## Unknowns (for in-game tests)

- **U1** Talent 1: continuous in Intellect (data: no floor) or per full 10
  points (text). At most 0.07 SP per sequence.
- **U2** Talent 2's Link: is it one Link stack (counted with combo stacks:
  +30% on a battle skill alone, +45% with one combo stack) or a fixed
  +20% (`imbue_scale` 0.2, which equals one stack's ultimate value)? Does it
  last until the ultimate ends (+5 s at P5), or is it capped at the global
  buff's `duration` 10 s from frame 1 (which would cut P5's tail when she
  doesn't act after her ultimate)?
- **U3** P1's stackingType 8: one timer refreshed by each layer (Endaxis:
  `enhanceAndRefresh`) or separate timers.
- **U4** How long `autoFinishByAction` buffs (P3, talent 2) last if she
  does nothing after her ultimate: its `durationFrame` 233 (7.77 s, the
  engine's rule) or less (Zero Sanity's claim: 5.1 s).
- **U5** G3: does SP from her ultimate give team energy when spent.
- **U6** Stagger Nodes re-arm after a full stagger (assumed), and two nodes
  crossed by one hit.

Observed in the scratch run, for test 18: buffs applied during her own
time stop (talent 2's Link at frame 1, 10 s) aren't lengthened by it,
while the engine says the world (buffs included) is frozen; buffs
existing before a stop are shifted. Only matters for the 10 s cap of U2.

## Verification

**Logs that would check her** (none exists): a ZMDLogs Rhodagn fight with
Akekuri at P5, skills 12, talent levels 2 / 1, and
- teammates who cast battle skills and ultimates during and just after her
  ultimate (any operator; Laevatain or Si give large single hits): checks
  the Link (G2, U2) as the logged `buff_common_affixes_skillimbue` value,
  and P3's team ATK +10% on their hits and its length (U4);
- her combos at stagger nodes and full staggers (G1): the combo hits
  (1.8 each), and her ATK under P1 layers (U3) and Wave Tide's +33.6%
  (both logged as ATK buffs);
- Qingbo or Frontiers worn: Qingbo's layers on her combo / battle hits,
  Frontiers' +16% on the team's hits, and the combo interval (7.65 s
  possible: G4);
- the battle skill (3.2, Heat, its infliction's burst with a teammate).
Lance weapons need a lance user's log (Estella, Liino, …) with Aggeloslayer
(its ATK after the battle-skill hit) or Pathfinder's Beacon (always-on
ATK); Opero 77 is stat-panel only.

**In-game tests** (new; numbers for docs/in-game-tests.md are the merge's
to assign). Existing ones that bear on her: 8 (Link stack values), 18
(what a time stop freezes).
1. **Akekuri's Link** (U2): with no combo used for 15 s, cast her ultimate
   (talent 2 learned), then a teammate's battle skill during it: compare
   its damage with the same battle skill without her ultimate. ×1.30 = one
   stack, ×1.20 = fixed `imbue_scale`. Then once with a combo just before
   (×1.45 expected if it's a stack). At P5: does the teammate still get it
   4 s after her ultimate ends; and 6 s after an ultimate she doesn't cut
   short (10 s cap)?
2. **Positive Feedback layers** (U3, P1+): two combos 8 s apart (4
   layers), then wait: do all four ATK layers disappear together 10 s
   after the second combo (one timer) or two of them 8 s earlier?
3. **SP from her ultimate and team energy** (U5, G3): teammate B with an
   empty ultimate. Spend 100 SP regenerated naturally on a battle skill and
   note B's energy gain; then cast Akekuri's ultimate (80 SP) and spend
   that SP the same way. Same gain: natural SP; no gain: returned.
4. **Combo at a Stagger Node** (G1): against Rhodagn, stagger it with
   battle skills only and watch for Akekuri's combo prompt when its bar
   passes half, then again at the full stagger.
5. **Combo cooldown with Qingbo or Frontiers** (G4): her combo cooldown
   timer with three pieces: 7.65 s (×0.85) or 9 s.
6. **P3 / Link length** (U4): cast her ultimate and do nothing; time the
   team ATK icon.

## Kit plan

Written and loaded from a scratch copy of the repository (main checkout
untouched): the operator kit and five equipment kits below pass the schema
and the loader; `efsim calc` gives every hit; `vitest run` passes (423
tests) with them in place; with her kit added to
`skillCompile.test.ts`'s operators only the two finisher-factor
disagreements of G7 appear. Scenarios run from scratch (P5 with Wave Tide
+ Qingbo; P0 with talents 0, Aggeloslayer + Roving MSGR):
- ultimate: SP +26 / +27 / +27 at 1.97 / 2.87 / 3.97 s, P1 at 3 layers
  (ATK +30%), team ATK +10% until her battle skill cut the ultimate at
  4.30 s, talent 2's holder until then and the P5 tail 4.30–9.30 s;
- combo (kit copy without its window trigger): 9.85 SP per sequence at INT
  209, 10 energy, 2 P1 layers per combo, Wave Tide ATK +33.6% and a
  Qingbo layer at the cast, two Qingbo layers after the second combo,
  first combo hit already under the frame-22 P1 layer (delayed actions run
  before same-frame hits, as the game's ObtainCostAction precedes its
  DamageAction);
- P0, talents 0: no P1 layers, no P3 buff, no talent-2 buffs; Aggeloslayer's
  ATK from the battle-skill hit; Roving's Physical DMG from the start.

### Operator kit `chr_0019_karin` (today)

```json
{
  "$schema": "../../../../schemas/kit.schema.json",
  "operator": "chr_0019_karin",
  "sources": ["…"],
  "element": "physical",
  "stacks": [
    { "id": "positive_feedback", "label": "Positive Feedback layers (P1)", "max": 5 }
  ],
  "buffs": [
    { "id": "positive_feedback", "label": "Positive Feedback (P1: ATK per layer)", "target": "self",
      "duration": { "key": "duration", "skill": "buff_chr_0019_karin_potential_1" },
      "modifiers": [{ "zone": "atk", "value": { "product": [{ "key": "atk_up", "skill": "buff_chr_0019_karin_potential_1" }, { "stackCount": "positive_feedback" }] } }] },
    { "id": "squad_atk", "label": "SQUAD! ON ME! team ATK (P3)", "target": "team", "endsWithCast": true,
      "modifiers": [{ "zone": "atk", "value": "atk" }] },
    { "id": "zone_hold", "label": "Staying in the Zone (while the ultimate lasts)", "target": "self", "endsWithCast": true, "modifiers": [] },
    { "id": "zone_link", "label": "Staying in the Zone Link (talent 2)", "target": "team", "duration": "duration", "modifiers": [],
      "note": "G2: add \"link\": true once it exists; until then it has no effect." },
    { "id": "zone_tail", "label": "Tempo of Awareness (P5)", "target": "self", "duration": "potential_5_duration", "modifiers": [] }
  ],
  "triggers": [
    { "id": "combo_window_staggered", "on": { "event": "staggered" }, "by": "anyone", "do": [{ "kind": "openCombo" }] },
    { "id": "combo_sp_1", "on": { "event": "cast", "skills": ["chr_0019_karin_combo_skill"] }, "by": "self", "delay": 22, "skill": "chr_0019_karin_combo_skill",
      "do": [
        { "kind": "sp", "value": { "product": ["atb", { "min": [{ "sum": [1, { "product": [{ "attr": 41 }, "sub_ratio", 0.1] }] }, { "sum": [1, "max_ratio"] }] }] } },
        { "kind": "gain", "gains": [{ "stack": "positive_feedback" }], "if": { "potentialAtLeast": 1 } },
        { "kind": "buff", "buff": "positive_feedback" }
      ] },
    { "id": "combo_sp_2", "…": "the same with delay 31" },
    { "id": "ult_sp_1", "on": { "event": "cast", "skills": ["chr_0019_karin_ultimate_skill"] }, "by": "self", "delay": 59, "skill": "chr_0019_karin_ultimate_skill",
      "do": [
        { "kind": "sp", "value": "atb_1" },
        { "kind": "gain", "gains": [{ "stack": "positive_feedback" }], "if": { "potentialAtLeast": 1 } },
        { "kind": "buff", "buff": "positive_feedback" }
      ] },
    { "id": "ult_sp_2", "…": "delay 86, atb_2" },
    { "id": "ult_sp_3", "…": "delay 119, atb_3" },
    { "id": "p1_out", "on": { "event": "buffEnded", "buff": "positive_feedback" }, "by": "self",
      "do": [{ "kind": "gain", "gains": [{ "stack": "positive_feedback", "amount": -5 }] }] },
    { "id": "ult_p3", "on": { "event": "cast", "skills": ["chr_0019_karin_ultimate_skill"] }, "by": "self", "if": { "potentialAtLeast": 3 },
      "skill": "chr_0019_karin_ultimate_skill", "do": [{ "kind": "buff", "buff": "squad_atk" }] },
    { "id": "ult_talent2", "on": { "event": "cast", "skills": ["chr_0019_karin_ultimate_skill"] }, "by": "self", "delay": 1, "if": { "talentAtLeast": [1, 1] },
      "skill": "chr_0019_karin_ultimate_skill", "do": [{ "kind": "buff", "buff": "zone_hold" }, { "kind": "buff", "buff": "zone_link" }] },
    { "id": "zone_end", "on": { "event": "buffEnded", "buff": "zone_hold" }, "by": "self", "skill": "chr_0019_karin_ultimate_skill",
      "do": [{ "kind": "buff", "buff": "zone_tail" }, { "kind": "endBuff", "buff": "zone_link", "if": { "not": { "potentialAtLeast": 5 } } }] },
    { "id": "zone_tail_end", "on": { "event": "buffEnded", "buff": "zone_tail" }, "by": "self",
      "do": [{ "kind": "endBuff", "buff": "zone_link" }] }
  ],
  "skills": [
    { "skillId": "chr_0019_karin_attack1", "label": "Basic attack 1", "damageType": "basic",
      "hits": [{ "id": "hit", "scale": ["atk_scale"], "frames": [9] }] },
    { "skillId": "chr_0019_karin_attack2", "label": "Basic attack 2", "damageType": "basic", "hits": [
      { "id": "hit", "scale": ["atk_scale"], "frames": [8], "events": ["chr_0019_karin_attack2"], "sp": "atb" },
      { "id": "hit_2", "scale": ["atk_scale_2"], "frames": [16], "events": ["chr_0019_karin_attack2"], "sp": "atb" } ] },
    { "skillId": "chr_0019_karin_attack3", "label": "Basic attack 3", "damageType": "basic",
      "hits": [{ "id": "hit", "scale": ["atk_scale"], "frames": [10], "sp": "atb" }] },
    { "skillId": "chr_0019_karin_attack4", "label": "Basic attack 4 (Final Strike)", "damageType": "basic", "hits": [
      { "id": "hit", "scale": ["atk_scale"], "count": 2, "frames": [19, 20], "events": ["chr_0019_karin_attack4"], "finalStrike": false },
      { "id": "hit_2", "scale": ["atk_scale"], "frames": [21], "events": ["chr_0019_karin_attack4"], "sp": "atb", "poise": "poise", "poiseControlledOnly": true, "finalStrike": true } ] },
    { "skillId": "chr_0019_karin_power_attack", "label": "Finisher", "damageType": "basic", "hits": [
      { "id": "hit", "scale": ["atk_scale"], "frames": [13], "factor": 0.2, "events": ["chr_0019_karin_power_attack"] },
      { "id": "hit_2", "scale": ["atk_scale"], "frames": [36], "factor": 0.8, "events": ["chr_0019_karin_power_attack"] } ] },
    { "skillId": "chr_0019_karin_plunging_attack_end", "label": "Dive attack", "damageType": "basic",
      "hits": [{ "id": "hit", "scale": ["atk_scale"], "frames": [1], "sp": "atb" }] },
    { "skillId": "chr_0019_karin_normal_skill", "label": "Battle skill", "damageType": "battle", "teamEnergyFrame": 20,
      "hits": [{ "id": "hit", "scale": ["atk_scale"], "element": "fire", "frames": [20], "poise": "poise", "applies": [{ "kind": "infliction", "element": "fire" }] }] },
    { "skillId": "chr_0019_karin_combo_skill", "label": "Combo skill", "damageType": "combo",
      "hits": [{ "id": "hit", "scale": ["atk_scale"], "count": 2, "frames": [22, 31], "energy": "usp", "poise": "poise", "sp": 0 }] },
    { "skillId": "chr_0019_karin_ultimate_skill", "label": "Ultimate", "damageType": "ultimate", "hits": [] }
  ]
}
```

Notes for the kits phase:
- Each note in the loaded draft cites its SkillData / BuffData actions
  (shortened above to `"…"`); the abbreviated `combo_sp_2`, `ult_sp_2`,
  `ult_sp_3` are copies of their first with the delay and key shown.
- P1's counter-plus-timer stands for stackingType 8 (U3). If the test says
  separate timers, it becomes a layered buff (`maxStacks:
  {key: "max_stack", skill: "buff_chr_0019_karin_potential_1"}`) and the
  stack goes.
- P1's gains and buff sit next to each SP grant; with G5 they become one
  trigger `on: {event: "sp", kinds: ["battle", "combo", "ultimate"],
  natural: true}, by: "self"` with `skill: buff_chr_0019_karin_potential_1`.
- G1 adds `{ "id": "combo_window_node", "on": { "event": "staggerNode" },
  "by": "anyone", "do": [{ "kind": "openCombo" }] }`.
- G2 adds `"link": true` to `zone_link`; U2 may change its `duration` (10 s
  from frame 1) or drop it.
- G3 adds the SP kind (`natural`) to every `sp` here: all her grants are
  atbGainMethod 0.
- `0.1` in the combo SP is 1 / `rate` until G6.
- Not modelled: the ultimate's damage immunity, the dodge attack, hit-stop
  (Ti1b).

### Equipment kits

All six were written and loaded; Opero 77 needs no file (stat panel only).

```json
{ "equipment": "wpn_sword_0009",
  "buffs": [{ "id": "wpn_sword_0009.atk", "label": "ATK (Wave Tide)", "target": "self", "duration": "duration", "gameBuff": "buff_wpn_sword_0009",
              "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
  "triggers": [{ "id": "wpn_sword_0009.combo_cast", "on": { "event": "cast", "kinds": ["combo"] }, "by": "self", "skill": "sk_wpn_sword_0009",
                 "do": [{ "kind": "buff", "buff": "wpn_sword_0009.atk" }] }] }
```

```json
{ "equipment": "wpn_lance_0008",
  "buffs": [{ "id": "wpn_lance_0008.atk", "label": "ATK (Aggeloslayer)", "target": "self", "duration": "duration", "gameBuff": "buff_wpn_lance_0008",
              "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
  "triggers": [{ "id": "wpn_lance_0008.battle_hit", "on": { "event": "hit", "kinds": ["battle"], "reaction": false }, "by": "self", "skill": "sk_wpn_lance_0008",
                 "do": [{ "kind": "buff", "buff": "wpn_lance_0008.atk" }] }] }
```

```json
{ "equipment": "wpn_lance_0003",
  "buffs": [{ "id": "wpn_lance_0003.atk", "label": "ATK (Pathfinder's Beacon, HP above 80%)", "target": "self",
              "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
  "triggers": [{ "id": "wpn_lance_0003.start", "on": { "event": "fightStart" }, "by": "self", "skill": "sk_wpn_lance_0003",
                 "do": [{ "kind": "buff", "buff": "wpn_lance_0003.atk" }] }] }
```

```json
{ "equipment": "suit_combo_cd01",
  "buffs": [{ "id": "suit_combo_cd01.spellup", "label": "Skill DMG (Qingbo)", "target": "self", "duration": "duration", "maxStacks": "max_stack",
              "gameBuff": "buff_equipsuit_combo_cd01_spellup",
              "modifiers": [{ "attr": 32, "value": "spell_up" }, { "attr": 33, "value": "spell_up" }, { "attr": 28, "value": "spell_up" }] }],
  "triggers": [{ "id": "suit_combo_cd01.combo_cast", "on": { "event": "cast", "kinds": ["combo"] }, "by": "self", "skill": "passive_equipsuit_combo_cd01",
                 "do": [{ "kind": "buff", "buff": "suit_combo_cd01.spellup" }] }] }
```

```json
{ "equipment": "suit_agi01",
  "buffs": [{ "id": "suit_agi01.phydmg", "label": "Physical DMG (Roving MSGR, HP above 80%)", "target": "self",
              "modifiers": [{ "attr": 50, "value": "phy_dmg_up" }] }],
  "triggers": [{ "id": "suit_agi01.start", "on": { "event": "fightStart" }, "by": "self", "skill": "passive_equipsuit_agi_01",
                 "do": [{ "kind": "buff", "buff": "suit_agi01.phydmg" }] }] }
```

```json
{ "equipment": "suit_atb01",
  "buffs": [{ "id": "suit_atb01.dmg", "label": "DMG (Frontiers)", "target": "team", "duration": "duration", "gameBuff": "buff_equipsuit_combosuit_01_adddamage",
              "modifiers": [{ "zone": "damageBonus", "value": "dmg_up" }] }],
  "triggers": [{ "id": "suit_atb01.skill_sp", "on": { "event": "sp", "kinds": ["battle", "combo", "ultimate"], "natural": true }, "by": "self",
                 "skill": "passive_equipsuit_combosuit_01", "do": [{ "kind": "buff", "buff": "suit_atb01.dmg" }],
                 "note": "Waits on G5 (not loadable today; the loaded draft has the buff only)." }] }
```

Notes: each file also has `$schema` and `sources` (the SkillData /
BuffData actions and SkillPatchTable values quoted in § Mechanics E1–E12).
The two gear sets' combo cooldown ×0.85 needs no kit field once G4 reads
attr 47 from the panel. Pathfinder's Beacon and Roving MSGR assume full HP
(N1). Buff durations come from the skills' `duration` (20 s for both
weapons; the SkillData defaults 15 are overridden by SkillPatchTable).

## Kit (2026-10-19)

### Re-analysis

| Gap | Now | How the kit uses it |
|---|---|---|
| G1 Stagger Node | covered (T1) | trigger `combo_window_node`, `on: {event: staggerNode}, by: anyone` |
| G2 Link from a kit buff | covered (B1) | `zone_link` has `link: true` |
| G3 natural vs returned SP | open (V3) | interim as proposed: all kit SP is returned (no team energy when spent) |
| G4 cooldown attributes | covered (S2) | nothing in the kit: attr 47 from Frontiers / Qingbo makes her combo cooldown 230 frames (9 s × 0.85 = 229.5) |
| G5 "SP recovered" event | covered (T2), without the gain method | P1 is one trigger `p1_layer` (`on: {event: sp, kinds: [combo, ultimate]}`); Frontiers the same (below) |
| G6 division | covered (V2) | the combo SP reads `{div: [sub_ratio, rate]}` (`rate` is in the combo's SkillData blackboard and set by talent 1); the literal 0.1 is gone |
| G7 compiler leftovers | open (D3) | hand-written as before: per-hit element, poise, finisher factors, the ultimate's SP, the ultimate's buffs |
| U3 stackingType 8 | covered (B3) | P1 is a layered buff (`maxStacks` from buff_chr_0019_karin_potential_1, `gameBuff` buff_chr_0019_karin_potential_1_1, so the loader sets `sharedTimer`); the counter stack and the `p1_out` trigger are gone |
| O8 battle-skill team energy | migrated | `teamEnergy: [{frame: 20, ratio: 1}]` (kit-draft gives the same) |
| U1 floor | no change | `floor` exists now, but the data says `useFloor: false`; kept continuous (≤ 0.07 SP per thrust) |

Her SkillData has no JumpToAction or InterruptCurSkillAction, and she
doesn't react to enemy attacks or charges, so jumps, `enemyActions` and
dodges don't apply to her.

New, a precision limit of T2 that belongs with V3: the `sp` event carries
no gain method. P1 and Frontiers check atbGainMethod 0 (natural) and
atbSourceType 3 (skills). A survey of every costType-1 ObtainCostAction in
SkillData / BuffData: every battle-skill SP grant is a refund (method 1:
both Endministrators, Laevatain, Catcher, Typhoeus, Liino; Estella's is
method 1, type 0), and natural skill SP comes only from combos and
ultimates (Akekuri's combo and ultimate, Antal's combo projectile,
Camille's combo and ultimate; Laevatain's on-kill buff). So `kinds: [combo,
ultimate]` is exact for every grant in the data except Liino's combo refund
(buff_chr_0035_liino_combo_atb_return, method 1), which a Liino wearing
Frontiers would wrongly count. The fix, with V3: the `sp` event carries the
grant's kind (natural / returned), the trigger filters on it (`natural:
true`), and `battle` goes back into the kinds.

### What was written

- `packages/data/kits/operators/chr_0019_karin.json`: the plan's kit with
  the changes above; `gameBuff` on the P1, P3, talent-2 and P5 buffs;
  `awaited` on the five SP cast triggers (they are the skills' own
  ObtainCostActions).
- `packages/data/kits/equipment/`: `wpn_sword_0009` (Wave Tide),
  `wpn_lance_0003` (Pathfinder's Beacon), `wpn_lance_0008` (Aggeloslayer),
  `suit_atb01` (Frontiers, now with its trigger), `suit_combo_cd01`
  (Qingbo), `suit_agi01` (Roving MSGR). Opero 77 (`wpn_lance_0009`) needs no
  file: stat panel only (`buff_wpn_lance_0009` is created by nothing).
- `examples/akekuri-frontiers.json` (P5, talents 2 / 1, Wave Tide 9/9/9,
  four Frontiers pieces) and `examples/akekuri-laevatain.scenario.json`
  (with `laevatain-forgeborn.json`, 45 s): her ultimate, Laevatain's battle
  skill on the Link and P3, her battle skill cutting the ultimate, chains
  until a Final Strike passes the Stagger Node (36.2 s) and opens her combo.
- `tests/kit-akekuri.test.ts` (14 tests): the flares (26 / 27 / 27 SP at
  frames 59 / 86 / 119, three P1 layers ending together at 419, Frontiers
  on the team refreshed to 569); P3 and the Link on a teammate's battle
  skill (×1.3; nothing at P2 or with talent 2 unlearned); P3 and the Link
  holder ending at 233, or when a basic attack cuts the ultimate at 129,
  with the P5 tail to 279 and the Link's own 10 s cap at 301; her own battle
  skill cutting the ultimate uses the Link (P5 and P4); a teammate 4 s after
  the cut gets the Link at P5, not at P4; the example's combo (window from
  the Stagger Node, SP 7.5 × 1.75 per thrust at INT 730, two P1 layers on
  one timer, Wave Tide +33.6% for 20 s, 10 energy × efficiency, cooldown
  230 frames); a full stagger opening the combo (Ram: 60 stagger HP, no
  nodes); P0 with no talents (80 SP, no buffs); talent 1 unlearned (7.5 SP
  per thrust); Qingbo (a layer of battle / combo / ultimate DMG +20%, 15 s,
  max 2; cooldown ×0.85, 9 s without the set); Frontiers not triggered by
  basic-attack SP; Roving MSGR (Physical DMG +20% from frame 0); the lances
  on Estella (Aggeloslayer: ATK +33.6% from her battle-skill hit for 20 s,
  none before; Pathfinder's Beacon: +42% from frame 0).
- `packages/data/test/skillCompile.test.ts`: her kit in `OPERATORS`; KNOWN
  gains exactly the two finisher factors the report predicted
  (`chr_0019_karin_power_attack/hit` 0.2, `/hit_2` 0.8:
  BreakingAttackCalculation's multiplier, D3).

### Deviations from the plan

- P1: a layered buff with a shared timer instead of a counter plus a timer
  buff, and one `sp` trigger instead of a gain next to each SP grant (the
  plan's own "with G5 / U3" notes).
- Frontiers and P1 use `kinds: [combo, ultimate]`, not `[battle, combo,
  ultimate]` with `natural: true` (no `natural` filter; above).
- The example wears Frontiers, not Qingbo: it shows the `sp` trigger and
  the team buff; Qingbo is in the tests.
- Found while testing, not in the plan: her own battle skill cutting her
  ultimate uses talent 2's Link (the engine judges Link at the cast, before
  the ultimate's end ends `zone_hold`, and with it the Link below P5). In
  the game the Link buff (buff_common_affixes_combo_trigger) is also read
  at the cast; which comes first is unknown (test 2 below). Below P5 it's
  the only way she gets her own Link when she cuts the ultimate with her
  battle skill, so it matters (+30% on a 3.2× hit).

### Verification

- `npm run check`: passes (468 tests).
- Log fixtures: no committed or pending fixture has Akekuri. All 11
  (8 committed, 3 pending) checked before and after with `zmdlogs check`
  and `zmdlogs reactions`: output identical. Frontiers (3 pieces) is worn
  by Camille in zmdlogs-40d9a3c1da37 and zmdlogs-4e5e1390085e and by Xaihi
  in zmdlogs-dbaee23b801d (Xaihi has 2 pieces in pending
  zmdlogs-e82d45c46040); neither wearer has a kit, so the trigger isn't
  checked there, and the logged buff_equipsuit_combosuit_01_adddamage
  (0.16) on teammates' hits already matched through the logged buffs. By
  eye in zmdlogs-4e5e1390085e, the buff appears on the team's hits right
  after Camille's combo (hits 7.1–8.0 s → from 8.3 s; 29.3–30.8 s → 31.0 s)
  and ultimate (50.9–52.3 s → 52.4 s), not after her battle skill (46.9 s),
  and lasts about 15 s: consistent with `kinds: [combo, ultimate]`.
- `simulate examples/akekuri-laevatain.scenario.json`: 211,470 (Akekuri
  63,783, Laevatain 147,688), last hit at 39.8 s. The flares refill 80 SP;
  Laevatain's battle skill at 2.5 s lands under ×1.3 (Link) and ATK +10%
  (P3); her battle skill at 4.30 s cuts the ultimate and inflicts Heat
  (absorbed by Laevatain at 8.2 s); the Stagger Node opens the combo at
  36.2 s, cast at 38.0 s. The team is SP-starved between 11 and 19 s (two
  operators, battle skills only).
- Other examples: totals unchanged (none wears this equipment).
- Spot checks: every trigger (`combo_window_staggered`, `combo_window_node`,
  `combo_sp_1/2`, `ult_sp_1/2/3`, `p1_layer`, `ult_p3`, `ult_talent2`,
  `zone_end`, `zone_tail_end`), every buff and every equipment trigger fire
  in the tests above.

### Logs that would check her

As in § Verification above: a ZMDLogs Rhodagn fight with Akekuri at P5
(skills 12, talents 2 / 1) whose teammates cast battle skills and
ultimates during and just after her ultimate (the Link as
buff_common_affixes_skillimbue, P3's ATK), her combos at the Stagger Node
and at full staggers (combo hits 1.8, her ATK under P1 layers and Wave
Tide), with Frontiers or Qingbo worn (the +16% / +20% and the 7.65 s combo
interval). A lance user's log (Estella, Liino) with Aggeloslayer or
Pathfinder's Beacon checks those two.

### Open

- V3 (natural vs returned SP, and the `sp` event's gain method).
- D3 (the compiler leftovers above).
- U2 (Link value and length), U3 (one timer or separate), U4 (how long P3
  lasts without a cut), U6 (nodes after a full stagger: the engine re-arms
  them when the bar refills), and the Link order above.

### Proposed in-game tests

All by eye or on a phone video; no frame counts, no SP values.

1. **Her Link on a teammate** (U2): no combo for 15 s, then her ultimate
   (talent 2 learned) and a teammate's battle skill during it; compare its
   damage number with the same battle skill without her ultimate (below P3,
   or allow for P3's ATK +10%). About ×1.30: a Link stack; ×1.20: a fixed
   `imbue_scale`. Once more with a combo just before her ultimate: ×1.45 if
   it adds to the combo's stack.
2. **Her own battle skill cutting her ultimate** (Link order): cast her
   ultimate and, as soon as allowed, her battle skill; compare its damage
   number with one cast with no Link and no ultimate. ×1.30: it used her
   Link. Then a teammate's battle skill right after: no Link expected if
   hers used it.
3. **The P5 tail and the 10 s cap**: cast her ultimate and cut it at once
   with a basic attack; 4 s later a teammate's battle skill: higher damage
   (Link) at P5, none at P4. Then cast her ultimate and do nothing (it
   ends after about 7.8 s); a teammate's battle skill 11 s after the cast:
   Link or not (the kit says not: capped at 10 s).
4. **Positive Feedback timer** (U3, P1+): two combos about 8 s apart, then
   wait: does the ATK buff icon (4 layers) disappear all at once about 10 s
   after the second combo, or drop to 2 layers about 8 s earlier?
5. **Combo at a Stagger Node** (G1): against Rhodagn, battle skills and
   chains only; does her combo prompt light up when the stagger bar passes
   half, and again at the full stagger?
6. **Combo cooldown with Frontiers or Qingbo** (S2): phone video of her
   combo icon with three pieces and without: about 7.7 s vs 9 s.
7. **Frontiers on a refund** (the `kinds` interim): Laevatain wearing
   Frontiers, no combo or ultimate: does the team get the Frontiers DMG
   icon after her battle skill returns SP? Expected: no.
8. **SP from her ultimate and team energy** (V3): watch a teammate's
   ultimate gauge when a battle skill spends SP that came from her flares,
   and when it spends regenerated SP: does the gauge rise both times?
9. **P3's length** (U4): cast her ultimate and do nothing; time the team
   ATK buff icon (about 7.8 s expected).
