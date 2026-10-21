# Mi Fu (chr_0031_mifu): gap report, batch 4

Operator Mi Fu (Physical, greatsword: CharGrowthTable `weaponType` 3,
main attribute Strength 39, secondary Will 42, rarity 6), with the weapons
Amaranthine Tassel (`wpn_claym_0017`) and Long Heritage (`wpn_claym_0019`)
([batch-4.md](../batch-4.md)).

Sources (rmxlinux, submodule commit 8b955ea): SkillData `chr_0031_mifu_*`
(12 files), BuffData `buff_chr_0031_mifu_*` (22 files), `sk_wpn_claym_0017`,
`sk_wpn_claym_0019`, `buff_wpn_claym_0017_dmgup(2)`,
`buff_wpn_claym_0019_teamatk` / `_teamspell`, `buff_common_affixes_*`
(their tags); TableCfg CharGrowthTable, SkillPatchTable,
PotentialTalentEffectTable, CharacterPotentialTable, WeaponBasicTable,
EnemyAttributeTemplateTable, I18nTextTable_EN. Values at skill level 12
and weapon skill level 9 unless noted (SkillPatchTable; SkillData
defaults are placeholders, e.g. the combo's `rate` 0.1 / `duration` 15 vs
0.05 / 16 s). Frames are SkillData timeline frames (30 FPS) from the cast.

No earlier report covers Mi Fu. Brief claims checked: both weapon IDs and
names (WeaponBasicTable `engName`) **confirmed**, both weaponType 3; no
fixture has Mi Fu or either weapon (`grep -r` over fixtures/: none).
Claim from batch 2 (Endministrator G6) re-checked: "enemies have no super
armor in EnemyData" is **wrong** for our tables:
EnemyAttributeTemplateTable has `initialSuperArmor`, `zeroPoiseSuperArmor`
and `superArmorWhenResilienceZero` for all 149 templates (Rhodagn
`eny_0051_rodin`: 30 / 30 / 0).

`efsim kit-draft chr_0031_mifu` was run. It gives every damage landing
with the right frames, keys, poise, energy, team energy, the Crush and the
forced Lift, but: no battle-skill states (ChangeSkillAction), no
Physical Susceptibility buff, no talents or P3, no World Splitter
multiplier (`$atk_scale_runtime?`) and no hit for its two poise-only
units; the finisher's three landings come twice each (identical IfElse
sides), and the ultimate's literal-0 DamageAction at f98 comes as a hit.

## Action types per file

What each file uses that matters for damage, resources, state or timing
(sound, VFX, camera, animation, root motion, rotation, teleports, pulls,
super armor, hit-stop and weapon visibility left out):

| File | Action types that matter |
|---|---|
| attack1–4 | DamageAction in a one-tick ChannelingAction (attack1 f9; attack2 f9, f16; attack3 f10, f16, f30; attack4 f7, f30), Switch on `hitstop_times` (hit-stop only); attack4 ObtainCostAction costType 1 `atb` 28 (controlled only), mask 2097280 and poise 25 (onlyEnableForMainChar) on its f30 hit; AllowNextSkillAction (chain) |
| powerattack (finisher) | DamageAction ×3 (BreakingAttackCalculation multiplier 0.3 f6, 0.2 f17, 0.5 f37; each in an IfElse on CheckTargetContains with the same hit on both sides), GainBreakingAttackAtb f37, CreateBuff `buff_common_power_attack_disable_cast_skill` 0–38, **`buff_chr_0031_mifu_buffpause` 0–38** (autoFinishByAction), AllowNextSkillAction 38–67 (combo, all three battle moves) |
| plunging_attack_start / _end | _end: DamageAction f2 1.8, ObtainCostAction `atb` (0) |
| normalskill_1 (Cloudtrapper) | f0 ObtainCostAction costType 1 50 (atbGainMethod 1: returned), CreateBuff `buff_chr_0031_mifu_normalskill_2`; f7 DamageAction `atk_scale` (mask 4352), CreateBuff `buff_common_obtain_ultimate_sp`, IfElse CheckSuperArmor (target, compareType 3, 30) → **JumpToAction 105**, else PullAction; MarkCanInterrupt 25; f104 JumpToAction 204 (the end); AllowNextSkillAction 11–30 and 115–131 (normalskill_2, attack2, finisher, combo); durationFrame 203, exclusiveFrame 125; cost 100 SP |
| normalskill_2 (Trail and Mangle) | **TimeDilationAction layer 1 on herself, ×1.25, 0–15**; DamageAction `atk_scale` f3, f10; f24: FinishBuff `normalskill_2`, ForEach SaveBuffStackNumAdvanced (Vulnerable tag 1075718177 → `maxstack`, unused), **CrushAction** (damageMultiplier 1.0), DamageAction `atk_scale2` + poise `poise`, CreateBuff `buff_common_obtain_ultimate_sp`; CreateBuff `buff_chr_0031_mifu_listen_crush` 22–27; AllowNextSkillAction 28–62 (normalskill_3, finisher, combo, attacks); durationFrame 150, exclusiveFrame 34; normalSkillSubType 1; cost 50 SP |
| normalskill_3 (World Splitter) | f21 FinishBuffAdvanced `normalskill_3`; f23 and f25 DamageAction with **only a poise unit** (`poise` 5 each; f23 mask 4096); f26 ForEach: `atk_scale_runtime` = `atk_scale` × `yuanshi_multi` (**ReadSkillSettingData** "弭弗特殊猛击" column 1) × `crushmulti` (1 + `crushmultiadd_talent` if `talent` > 0 and the target is Staggered (CheckPoiseValue = 0) or has tag 1066759270), DamageAction `atk_scale_runtime` **mask 20480** (4096 + Crush bit 16384, no battle bit 256), CreateBuff `buff_common_obtain_ultimate_sp`; CheckSuperArmor > 10 picks a hit-stop; durationFrame 241, exclusiveFrame 45; normalSkillSubType 1; cost 50 SP |
| combo_skill | TimeDilationAction layer 0 ComboSkill 0–8 (0.37 s, ignoring her); f0 IfElse `talent` > 0 and CheckGlobalCDTimer(`buff_chr_0031_mifu_shield`) → (if `potential` > 0) CreateBuff `potential_addattack`, StoreAttributeValue Max HP × `talent_shield_hppercent`, CreateBuff `shield`, AddGlobalCDTimer `talent_shield_cd`; DamageAction `atk_scale1` f8, f10; f27 CreateBuff `normalskill_2`; f31 ModifyDynamicBlackboard `final_effect` = `rate` (+ `extra_effect` if `potential` = 1), `final_time` = `duration` (+ `extra_time`), CreateBuff `vulnerablephysic_comboskill` on the target, **then** DamageAction `atk_scale2` + poise, CheckSkillHasHit → ObtainCostAction `usp`; AllowNextSkillAction 35–73; cooldown 19 s (L12) |
| ultimate_skill | UltimateTimeAction 0–71; ChannelingCastingAction 0–103 (cantCastSkill, cantSwitch); CreateBuff `buffpause` 0–105 (autoFinishByAction); f75 AirborneAction **forceAirborne**, DamageAction `atk_scale`; f98 DamageAction with a literal 0 multiplier; f102 DamageAction `atk_scale2` + poise `poise2`, CreateBuff `normalskill_2`; AllowNextSkillAction 113–124; durationFrame 249, exclusiveFrame 118; cost 80, cooldown 15 s |
| buff_…_normalskill_2 / _3 | 15 s, stackingType 2 max 1; buffEvent 5: ChangeSkillAction normalskill_1 → normalskill_2 / _3 (lifeTimeType 2); buffEvent 0 (start): FinishBuff the other one; abilityEvent 9 / 203 + CheckBuffIdInContextAdvanced `buffpause` → PauseBuffTime on / off |
| buff_…_listen_crush | abilityEvent 401 + CheckPhysicalInflictionType mask 8 (Crush) + CheckOriginSkillType [2] + Vulnerable (tag 1075718177) ≥ 3 on the target + global CD 0.1 s → CreateBuff `normalskill_3` |
| buff_…_vulnerablephysic_comboskill | VulnerableAction subType 2 (physical), `rate`, `duration` |
| buff_…_potential_addattack | attr 2 (ATK), formulaItem 6, `addattack_effect`, duration `addattack_duraion` |
| buff_…_shield | shield `FinalShield`, SetSuperArmorAction, duration `duration` |
| buff_…_buffpause, _comboprocess | markers (pause; teleport choice) |
| buff_…_passive, _passive_2, _passive_detect, _blue, _red, _test_1, _anglevalue, _WoundBuff, _vulnerablephysic_ultimate, _chrdg_* (4) | created by no table, skill or buff read here (`grep` over SkillData and BuffData: only themselves): leftovers and trial-stage buffs |
| sk_wpn_claym_0017 | cardAttributeModifier attr 50 `phy_dmg_up`; passiveEventActions abilityEvent 206 + CheckBuffIdInContext checkType 1 tag 1066759270 (Physical Susceptibility) → `buff_wpn_claym_0017_dmgup`; abilityEvent 401 + mask 8 + Vulnerable ≥ 1 → SaveBuffStackNumAdvanced `count`, SimpleCalcBB `phy_dmg_up_final` = `phy_dmg_up2` + `atk_up_mult` × `count` → `buff_wpn_claym_0017_dmgup2`; toggleBuffs `buff_wpn_passive_spirit_01` (`atk_up`, not in the skill) |
| buff_wpn_claym_0017_dmgup / _dmgup2 | attr 87 `phy_spell_up`, `duration`, stackingType 4 (priority `lv`) / attr 50 `phy_dmg_up_mult`, `duration2`, stackingType 1 priority, maxStackCnt 2 |
| sk_wpn_claym_0019 | cardAttributeModifier attr 2 formulaItem 6 modifyAttributeType 1 (main attribute %) `primary_attr_up`; abilityEvent 126 + CheckOriginSkillType [2] + CheckSpellInflictionType mask 5 (Heat, Cryo) → `buff_wpn_claym_0019_teamspell` (targetSource 4 + CharacterTeamFinder); abilityEvent 102 + CheckBuffIdInContext checkType 1 (`buff_common_affixes_enhance_crystal`, tag 486772476) + NotNext CheckTargetsEqual(wielder, target) → `buff_wpn_claym_0019_teamatk` (targetSource 3 + CharacterTeamFinder) |
| buff_wpn_claym_0019_teamspell / _teamatk | attr 53 `cryst_dmg_up` / attrs 51–54 `spell_dmg_up`; both stackingType 11 with a priority key, maxStackCnt 1 |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: `atk_scale` 0.76 f9; 0.30 f9 + 0.56 f16; 0.34 ×2 f10, f16 + 0.69 f30; 0.11 f7 + 1.61 f30 | supported | compiled hits |
| 2 | "As the controlled operator, Final Strike also deals {poise} Stagger": attack4 f30 poise 25 (onlyEnableForMainChar), `atb` 28 controlled only | supported | compiled: `poise`, `poiseControlledOnly`, `sp: {if: controlled}` |
| 3 | attack4's f7 hit isn't the Final Strike (the f30 unit has the bit) | supported | `finalStrike: false` / `true` overrides (compiled; Final Strike per file is batch 3's open loader item) |
| 4 | Finisher: `atk_scale` 9.0 × 0.3 f6, × 0.2 f17, × 0.5 f37 (900% shown), finisher SP f37 | data | three hits with `factor`; kit-draft emits each landing twice as `branch` alternatives over CheckTargetContains whose sides are the same hit (D3: identical alternatives aren't merged) |
| 5 | The finisher pauses the battle-skill state buffs while `buffpause` is on (0–38; the disable-cast buff holds the finisher that long) | supported | triggers on the finisher's cast: `extendBuff` 38/30 s on whichever state buff is active (Purrchena's pattern). Not exercised in the scratch runs (no Stagger reached) |
| 6 | Dive attack `plunging_attack_end` 1.8 f2 | supported | in the kit; not castable until rotations have jumps (S10) |
| 7 | Cloudtrapper: 100 SP, "returns 50 SP after casting" (f0, atbGainMethod 1) | supported | cast trigger `sp` 50 (returned: the literal's default kind) |
| 8 | Cloudtrapper hit f7 `atk_scale` 1.5 (P5 ×1.1); team energy at f7 | supported | compiled |
| 9 | Cloudtrapper on a target with super armor ≥ 30 (CheckSuperArmor compareType 3): JumpToAction 7 → 105 (no pull; she closes in, windows 115–131, exclusive 125) instead of the pull path (windows 11–30, MarkCanInterrupt 25, end at 104 → 204) | gap | **G2** (no enemy super-armor predicate). Rhodagn and 62 of 149 templates have 30+. Interim: jump not listed (pull path; at most 6 frames early on the next move, 2 frames on the free point) |
| 10 | With the jump in the kit, the engine opens the skipped 11–30 windows at frame 7 | gap | **G1** (engine: a window inside a jumped-over segment is open at the jump's own frame). Scratch run: the next Trail and Mangle at frame 7 with the jump, 11 without; the data's heavy path allows it at real frame 17 |
| 11 | "After casting MOVE 1, the next battle skill will be temporarily replaced with Trail and Mangle": `normalskill_2` buff 15 s at f0 | supported | self buff `trail_ready` (gameBuff, 15 s); `available` on the three moves (Si's and Purrchena's pattern) |
| 12 | The two state buffs replace each other (each one's start ends the other) | supported | triggers `on: {event: buffApplied, buff}` → `endBuff` the other |
| 13 | Trail and Mangle: 50 SP; `atk_scale` 0.61 ×2 f3, f10; f24 `atk_scale2` 0.79 + poise 5 + Crush (multiplier 1); team energy f24 | supported | compiled hits + Crush |
| 14 | Trail and Mangle ends its own state at f24 (a cut cast keeps it) | supported | delayed cast trigger (delay 24) `endBuff trail_ready` |
| 15 | "If this Crush consumes at least 3 Vulnerability stacks from a single target, then the next battle skill will be temporarily replaced with World Splitter" (listen_crush 22–27, abilityEvent 401, ≥ 3 stacks) | supported | two `branch` hits at f24: `if: {enemyVulnerable: 3}` with `buffs: [splitter_ready]`, and the plain one (judged before the Crush consumes; a Crush on 0 stacks only adds one) |
| 16 | Trail and Mangle plays its first 15 frames at ×1.25 (layer-1 TimeDilationAction on herself, finishByAction) | gap | Ti1b (entity-layer dilation not modelled): 3 frames late on everything after frame 15 |
| 17 | World Splitter: 50 SP; f21 ends its state; f26 `atk_scale` 6.0 (P5 ×1.1); team energy f26 | supported | delayed cast triggers (`endBuff` at 21, the hit at 26), `teamEnergy` |
| 18 | "this DMG is not treated as Battle Skill DMG, but as Crush DMG": mask 20480 (Crush bit 16384, no battle bit; no CheckDamageDecorateMask in the data tests 16384) | gap | **G3** (a skill's hit can't have its own damage type). Interim, exact: the hit as a delayed cast trigger's `hits` with `damageType: none`, `awaited` |
| 19 | World Splitter's scale × `yuanshi_multi` from ReadSkillSettingData ("弭弗特殊猛击", column 1; the table isn't in our data, dynamic default 1) | unknown | 1 assumed (SkillPatchTable shows "World Splitter DMG Multiplier 600%" = `atk_scale`). The ModifyDynamicBlackboard chain on the scale is D3's open item; in-game test B or a log |
| 20 | World Splitter's 10 Stagger: two poise-only damage units (5 + 5) at f23, f25 | gap | **G5** (no poise-only landing). Interim: `poise: {product: [poise, 2]}` on the f26 hit (3 frames late) |
| 21 | Talent 1 Stern Crackdown: "When hitting a target with Physical Susceptibility or Staggered, DMG Multiplier is increased to {crushmultiadd_talent+1} times" (1.1 / 1.2 by talent level; skillBbModifier on normalskill_3) | supported | `extraScale: [{value: {sum: [1, crushmultiadd_talent]}, if: {all: [{talentAtLeast: [0, 1]}, {any: [{enemyStaggered: true}, {enemyModifier: {zone: susceptibility, element: physical}}]}]}}]` (tag 1066759270 is on `buff_common_affixes_vulnerable_physical` and `_all`). Checked: ×1.200 |
| 22 | Combo trigger "When an enemy has 3 or more Vulnerability stacks" (game code) | supported | trigger `on: {event: vulnerable, minStacks: 3}, by: anyone` → `openCombo` |
| 23 | Whether that trigger is a state: the combo lights again when its cooldown ends while 3+ stacks remain, and goes dark when a Crush consumes them | unknown | engine: a 6 s window per stack event; T5 ignores triggers during the cooldown. In-game test A |
| 24 | Combo: `atk_scale1` 0.68 ×2 f8, f10; f31 `atk_scale2` 1.15 + poise 10 + `usp` 10 (CheckSkillHasHit); cooldown 19 s; ComboSkill slow-down | supported | compiled |
| 25 | "applying temporary Physical Susceptibility": 5% for 16 s (P1: +5%, +4 s), created before the f31 DamageAction | data | enemy buff `combo_susceptibility` (`gameBuff: buff_common_affixes_vulnerable_physical`, zone susceptibility, physical; `rate + extra_effect`, `duration + extra_time`), `buffs: [{…, beforeDamage: true}]` on the f31 hit (Estella's pattern). kit-draft only notes the created buff |
| 26 | Combo → Trail and Mangle at f27 (ends a World Splitter state) | supported | delayed cast trigger `buff trail_ready` |
| 27 | Ultimate: cost 80 (P4 ×0.85), cooldown 15 s, time stop 0–71, channel 0–103, windows 113–124 | supported | SkillData and tables |
| 28 | Ultimate f75 forced Lift + `atk_scale` 2.03; f102 `atk_scale2` 4.97 + poise `poise2` 20 (P5 +5) | supported | compiled |
| 29 | Ultimate f98 DamageAction with a literal 0 multiplier | data | left out (kit-draft drafts a `LITERAL_0` hit); whether a 0-damage DamageAction counts as a hit for on-hit effects isn't known, and no effect of Mi Fu's own needs it |
| 30 | Ultimate → Trail and Mangle at f102 (ends a World Splitter state); its `buffpause` 0–105 | supported | delayed cast trigger; the pause is moot (the ultimate can't be cut before f103, and f102 re-applies the state and ends the other) |
| 31 | Talent 2 Vigilant Fury: combo cast creates a shield (15% / 30% Max HP, 10 s), harder to interrupt, once per 60 s | supported | no damage effect (operator HP isn't tracked: N2; super armor has no effect) |
| 32 | P1: combo cooldown −2 s; Susceptibility +5%, +4 s | supported | tables (skillParam) and the buff's sums |
| 33 | P2: Strength +20, Arts Intensity +16 | supported | stat panel |
| 34 | P3: shield +5 s, cooldown −15 s; "Each time the shield is triggered, Mi Fu gains ATK +6% for 20s" (behind the shield's global CD) | supported | trigger on the combo's cast, `if: {all: [{talentAtLeast: [1, 1]}, {potentialAtLeast: 3}]}`, `cooldown: talent_shield_cd` (45 s at P3) → buff `p3_atk` (zone atk) |
| 35 | P4: ultimate cost ×0.85 | supported | tables (68) |
| 36 | P5: the three moves' `atk_scale` / `atk_scale2` ×1.1 ("can stack with Stern Crackdown"), ultimate `poise2` +5 | supported | skill values (multiplicative with row 21's `extraScale`) |
| 37 | Trail and Mangle and World Splitter are sub-skills (normalSkillSubType 1, as Si's strokes, Liino's End Stance, Purrchena's counter): do they count as battle-skill casts for Link and "casts a battle skill" effects? | unknown | engine: yes; in-game test 29's question |
| 38 | Unreached buffs (`passive`, `passive_2`, `passive_detect`, `blue`, `red`, `test_1`, `anglevalue`, `WoundBuff`, `vulnerablephysic_ultimate`, `chrdg_*`) | supported | nothing to write |
| 39 | No-effect actions: InterruptActions, pulls, teleports (`comboprocess` decides them), hit-stop switches, the shield's and the finisher's immunity, World Splitter's CheckSuperArmor hit-stop choice | supported | not modelled (design.md) |

### Equipment

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| E1 | Amaranthine Tassel: Strength, ATK lines and "Physical DMG Dealt +{phy_dmg_up}" (44.8%, card attr 50) | supported | stat panel |
| E2 | "When the wielder applies Physical Susceptibility, the wielder gains Arts Intensity +{phy_spell_up} for {duration}s" (84, 20 s; abilityEvent 206, tag 1066759270) | gap | **G4** (category triggers can't name the element). Interim: `on: {event: buffApplied, categories: [susceptibility]}`, `if: {enemyModifier: {zone: susceptibility, element: physical}}` (over-fires on an Arts Susceptibility applied while a Physical one is up). Checked: +84 at the combo's f31 |
| E3 | `buff_wpn_claym_0017_dmgup` stackingType 4 with priority `lv` (refreshed) | supported | the loader's reading from `gameBuff` |
| E4 | "When the wielder applies Crush, … Physical DMG Dealt +[{phy_dmg_up2} + ({atk_up_mult} × Max number of Vulnerability stacks consumed from one enemy)] for {duration2}s" (25.2% + 8.4% × n, 30 s); abilityEvent 401 before the stacks go | supported | trigger `on: {event: physicalStatus, statuses: [crush]}, by: self, beforeDamage: true` → buff `{attr: 50, value: {sum: [phy_dmg_up2, {product: [atk_up_mult, {eventCount: true}]}]}}` (Ancient Canal's pattern). Checked: 0.504 after a level-3 Crush, on the Crush and its hit |
| E5 | "The two effects … do not stack with themselves": `dmgup2` stackingType 1, priority, maxStackCnt 2 | supported | the loader's `instances` (B1) |
| E6 | Vulnerable ≥ 1 required: a Crush on a clean enemy (it only adds a stack) gives nothing | supported | no `physicalStatus` event then (status.ts) |
| E7 | toggleBuffs `buff_wpn_passive_spirit_01` (`atk_up` not in the skill) | supported | leftover, no effect (as Ancient Canal's) |
| E8 | Long Heritage: Intellect, Cryo DMG lines, "Main attribute +{primary_attr_up}" (19.6%, formulaItem 6, modifyAttributeType 1) | supported | stat panel (checked: Strength line "Long Heritage skill 3 … 0.20") |
| E9 | "When the wielder's battle skill applies Cryo Infliction or Heat Infliction, the wielder gains Cryo DMG Dealt +{cryst_dmg_up} for {duration}s" (16.8%, 20 s; targetSource 4 with a team finder: the wielder, as `suit_spellburst`'s note reads the same shape) | supported | trigger `on: {event: inflictionApplied, elements: [fire, cryst], fromKinds: [battle]}`, `by: self` → buff `{attr: 53}`. abilityEvent 126 read as an infliction without a reaction, as `wpn_funnel_0016` does |
| E10 | "When the wielder grants Arts Amp to another operator in the team, the entire team gains Arts DMG Dealt +{spell_dmg_up} for {duration2}s" (11.2%, 20 s; stackingType 11 priority: B2) | gap | **G4** (no recipient or element filter). Interim: `on: {event: buffApplied, categories: [amp]}, by: self` → team buff (attrs 51–54). Checked on Si: applied at her ultimate's f62 |
| E11 | Which Amps count: CheckBuffIdInContext checkType 1 lists `buff_common_affixes_enhance_crystal` and tag 486772476, which only `_enhance_spell` and `_enhance_all` carry (not the single-element Amps Si's ultimate creates) | unknown | if checkType 1 means the tag only, Si's Cryo/Heat Amp doesn't count; if IDs or tags, her Cryo Amp does. In-game test C |
| E12 | Signature: Long Heritage fits **Si** (chr_0036_jsspsi, greatsword: her battle skill inflicts Cryo or Heat by slot 1's element, her ultimate gives the team Cryo and Heat Amp); on Mi Fu (Physical, no inflictions, no Amp) neither effect fires. Amaranthine Tassel fits Mi Fu (combo Susceptibility, Trail and Mangle's Crush) | — | the merge may move Long Heritage to Si's side; its kit is written here either way |

**Counts:** operator 39 mechanics: 28 supported, 3 data, 5 gap (G1,
G2, G3, G5, and Ti1b), 3 unknown, 0 unique?. Equipment 12: 8 supported,
2 gap (G4 twice), 1 unknown, 1 note.

Nothing is unique ([kit-unique.md](../../kit-unique.md) lists only Si's
damage record). Battle-skill states by ChangeSkillAction are Si's,
Purrchena's, Typhoeus's and Laevatain's (and in batch 4 Rossi's, Zhuang
Fangyi's, Camille's); "a Crush that consumed n stacks" is Grizzled Edge's
and Ancient Canal's `eventCount`; a combo Susceptibility before its own hit
is Estella's; each gap below names its other users.

## Gaps

### G1. A window a jump skips must stay closed

- **family:** timing (skills).
- **feature:** in `actionGate`, a window `[from, to]` of the current
  cast is open only on frames the cast's playhead really reaches: frames
  in `(j.from, j.to)` of a jump it took are never played. A window wholly
  inside a skipped segment is closed; one that starts inside it opens at
  the jump's destination (`j.to`, i.e. real frame `j.at`) only if `to ≥
  j.to`. Today `actionFrame` maps every skipped skill frame to the jump's
  real frame, so `max(frame, at(from)) <= at(to)` holds at exactly that
  frame, and `earliestStart`'s re-judgement after the jump (the first frame
  the action changed) lands on it. Exclusive and duration frames keep
  today's mapping (a jump past them does pass them).
- **evidence:** scratch scenario `ns1-timing` (Cloudtrapper, then Trail
  and Mangle): with `jumps: [{at: 7, if: always}]` Trail and Mangle starts
  at frame 7, without at 11 (window 11–30); the data's jumped path allows
  it from window 115–131, real frame 7 + 10 = 17. Shared: every jump over
  a window, e.g. Arclight's `normal_skill` (4 → 96 on an Electrified
  target over 36–60, which lists her battle skill: a step judged at the
  jump's frame, e.g. one with `at` there, starts 66 frames early).
- **impact:** Mi Fu (once G2 lets her kit take the jump): her next move
  after Cloudtrapper 10 frames (0.33 s) early per cast on heavy targets,
  and searches exploit it. Arclight: only steps judged on the jump frame
  (her own hits normally hold the step past it).

### G2. Enemy super armor as a condition

- **family:** conditions.
- **feature:** predicate `enemySuperArmor: {atLeast?: number, below?:
  number}`, judged like `enemyStaggered` (usable in `KitSkill.jumps[].if`,
  a hit's `if`, triggers). The data layer reads EnemyAttributeTemplateTable
  `initialSuperArmor` and `zeroPoiseSuperArmor` for the scenario's target
  (in the checkout already); the engine uses `zeroPoiseSuperArmor` while
  the enemy is Staggered (assumed: CheckSuperArmor reads the current
  value; Rhodagn is 30 either way). CheckSuperArmor `compareType` 3 = ≥
  (as CheckEntityNum's 3), 2 = >, as the compiler already reads compares.
- **evidence:** `chr_0031_mifu_normalskill_1` f7 IfElse CheckSuperArmor
  (compareType 3, value 30) → JumpToAction 105; `normalskill_3`
  CheckSuperArmor > 10 (hit-stop only). Shared: the Endministrator's seal
  (`buff_common_originum_frozen` CheckSuperArmor < 20: batch 2 G6,
  deferred on the wrong claim that the data has no super armor),
  Arclight's ultimate freeze (< 10, batch 3 row 27), Snowshine's frost
  (`buff_…_ultimate_skill_frost` < 30). Values: 62 templates 30, 1 at 35,
  24 at 20, 4 at 5, 58 at 0.
- **impact:** Mi Fu: the heavy path against bosses vs the pull path
  against light enemies: about 6 frames on her next move and 2 on her free
  point per Cloudtrapper (no damage). The others: freezes that never hit
  bosses (Rhodagn 30) but do hit trash enemies.

### G3. A skill's hit with its own damage type

- **family:** data compilation (skills).
- **feature:** `KitHit.damageType` allowed on a skill's hits as an
  override (default: the skill's); the loader stops refusing it (kits.ts
  "a skill's hits take its damage type"); the hit's damage takes that
  type's skill bonus (none for `none`) and its `hit` event that `kind`,
  while the cast stays the skill's (SP, `cast` events, team energy).
  kit-draft emits it when a landing's decorate mask has no kind bit of its
  skill (today only a note: "mask 20480 (none, skill is battle)").
- **evidence:** `chr_0031_mifu_normalskill_3` f26 DamageAction
  `damageDecorateMask` 20480 = 4096 + 16384 (the bit
  `buff_physical_do_crushed`'s damage carries), without 256; description
  "this DMG is not treated as Battle Skill DMG, but as Crush DMG". A scan
  of operator SkillData for damage units whose mask lacks their skill's
  kind bit finds, besides projectile and entity files with their own
  specification, `chr_0015_lifeng_attack5` (mask 0; Lifeng's report
  decides it).
- **impact:** none with the interim (a delayed cast trigger's `hits`, exact
  for damage, events and cut casts); without it World Splitter, Mi Fu's
  biggest skill hit, would take every Battle Skill DMG bonus (+53.8% in the
  scratch build: ×1.5).

### G4. Category triggers by element and recipient

- **family:** triggers.
- **feature:** `on: {event: buffApplied, categories: [...]}` gets
  `elements?: Element[]` (the buff's modifier of a listed category reaches
  at least one of them; an all-element one counts), `allElements?:
  Element[]` (it reaches every one of them) and `toOthers?: true` (it
  reaches an operator other than its applier: a team buff, or a buff given
  to a teammate). The `buffApplied` event carries, per category, the
  elements its modifiers reach and whom the buff reaches. The game's tags
  map onto it: 1066759270 Physical Susceptibility = `elements: [physical]`;
  1427729990 Arts Susceptibility (on each single-element Arts
  Susceptibility) = `elements: [fire, pulse, cryst, natural]`; 486772476
  Arts Amp (only on `_enhance_spell` and `_enhance_all`) = `allElements`
  of the four Arts elements; single-element tags (458037917 Heat,
  1425735059 Cryo, −1640994543 Electric, −575106878 Nature
  Susceptibility) = that element.
- **evidence:** `sk_wpn_claym_0017` abilityEvent 206 tag 1066759270;
  `sk_wpn_claym_0019` abilityEvent 102 tag 486772476 (+
  `buff_common_affixes_enhance_crystal`) and NotNext CheckTargetsEqual.
  Shared (abilityEvent 206 / 102 on element tags): `sk_wpn_lance_0012`
  (1066759270), `sk_wpn_sword_0021` (1066759270), `sk_wpn_funnel_0018`
  (the four elemental Susceptibility tags), `sk_wpn_lance_0007` (458037917)
  in batch 4, and the existing `wpn_funnel_0016` kit (tag 1427729990
  written as `categories: [susceptibility]`, which also counts a Physical
  Susceptibility).
- **impact:** Amaranthine Tassel: +84 Arts Intensity (20 s) from an Arts
  Susceptibility the wielder applies while a Physical one is up (interim's
  error), or, without the interim's `if`, from any Susceptibility. Long
  Heritage: the team's +11.2% Arts DMG from a self-only or non-Arts Amp.
  Neither wrong case occurs with Mi Fu or Si.

### G5. Poise-only landings

- **family:** data compilation (skills).
- **feature:** `KitHit.poiseOnly: true` (with `scale: []`): the landing
  deals its `poise` (Stagger, nodes, `staggered` events) at its frame and
  nothing else: no damage, no crit roll, no `hit` event. kit-draft emits it
  for a DamageAction whose units all have damageAttributeType 1 (today
  "stagger poise without damage (no hit drafted)").
- **evidence:** `chr_0031_mifu_normalskill_3` f23 and f25 (one poise unit
  `poise` 5 each; SkillPatchTable "World Splitter Stagger 10"). Shared:
  `chr_0009_azrila_normal_skill`, `chr_0017_yvonne_attack5`,
  `chr_0027_tangtang_attack5_projhit` and `_combo_skill` (batch 4), and
  E1's poise-only interrupt Stagger (Chen's talent 2).
- **impact:** Mi Fu: 10 Stagger 3 frames late (interim: on the f26 hit);
  only a Stagger that would start in those 3 frames moves.

Already open and only referenced: Ti1b (row 16: her ×1.25 self speed-up),
S10 (row 6), D3 (rows 4, 19: identical alternatives, a
ModifyDynamicBlackboard chain on a scale), D4 (talents' and potentials'
effects hand-written), T5 (row 23), N2 (row 31), K3 (Trail and Mangle's
Crush damage before its hit: no difference for Mi Fu, every buff on
either is applied before both), B2 (E10), B1 (E5).

## Verification

No committed or pending fixture has Mi Fu, Amaranthine Tassel or Long
Heritage. Logs (ZMDLogs) that would verify the kit:

- Mi Fu with a teammate who adds Vulnerable (Da Pan, Chen, Estella,
  Gilberta), against a boss: her combo (`chr_0031_mifu_combo_skill`, three
  hits; `buff_common_affixes_vulnerable_physical` at 5% / 10% from f31 and
  on that hit), Trail and Mangle (`…_normalskill_2`, three hits, the
  Crush as `buff_physical_crushed` with its level) and World Splitter
  (`…_normalskill_3`): its zones settle G3's reading (no Battle Skill DMG
  bonus), row 19 (`yuanshi_multi`), talent 1's ×1.2 and P5's ×1.1. Cast
  times give the states (World Splitter only after a 3+ stack Crush) and,
  against a heavy enemy, Cloudtrapper's jump (row 9).
- Amaranthine Tassel: `buff_wpn_claym_0017_dmgup` (84) after her combo,
  `_dmgup2` at 0.252 + 0.084 × n after each Crush.
- Long Heritage on Si: `buff_wpn_claym_0019_teamspell` after her battle
  skill's infliction, `_teamatk` on the team after her ultimate (E11).

In-game tests. Existing ones that cover Mi Fu: **64** (does a stack added
at 3+ reopen the window: Mi Fu's ≥ 3 rule fires on every stack added
while ≥ 3, as Da Pan's at 4), **60** (T5), **51** (Amaranthine's Crush
buff on the Crush and its own hit, as Ancient Canal's), **29** (row 37:
sub-skills as battle-skill casts; Mi Fu could be a fourth part), **38**
(two Physical Susceptibility sources, e.g. Mi Fu and Estella). New:

- **A. Mi Fu's combo trigger as a state** (ready, if you have Mi Fu at
  P1+ and a teammate whose skills add Vulnerable without Crush or Breach,
  e.g. Da Pan's battle skill and ultimate, Chen or Estella). Part 1: bring
  a dummy to 3 Vulnerable stacks, cast her combo as soon as it lights,
  then add no stacks and don't Crush (Vulnerable lasts 20 s from the last
  stack; her combo's cooldown is 17 s at P1+). Watch the combo button:
  state reading: it lights again about 17 s after the combo; engine: it
  stays dark until a new stack. Part 2: bring the dummy to 3+ stacks
  (combo lights), don't cast it, cast Cloudtrapper then Trail and Mangle
  at once (its Crush consumes the stacks): does the combo button go dark
  at the Crush (state) or stay lit until about 6 s after it lit (engine)?
  Overlaps test 60's question (a trigger kept through the cooldown).
- **B. World Splitter against Cloudtrapper** (ready, if you have Mi Fu;
  best with a gear set or buff that gives Battle Skill DMG and without
  Amaranthine Tassel, Grizzled Edge or Ancient Canal). A teammate brings a
  dummy to 3 Vulnerable stacks without Susceptibility (no Mi Fu combo, no
  Estella combo); then Cloudtrapper, Trail and Mangle, World Splitter.
  Compare World Splitter's number with Cloudtrapper's (the lower of two
  tries each: crits). Data (G3's interim, `yuanshi_multi` 1): 4.0 / (1 +
  b), b = the Battle Skill DMG bonus on her panel (e.g. 2.6 at +53.8%);
  4.0 means World Splitter does take the battle-skill bonus; a ratio off
  both means `yuanshi_multi` isn't 1.
- **C. Long Heritage and Si's Amp** (low priority: needs Si with Long
  Heritage). Cast Si's ultimate (team Cryo and Heat Amp): does the Secret
  History team buff (Arts DMG Dealt) appear on a teammate? Engine: yes. No
  icon: only all-Arts Amps count (E11).

Not testable by hand: row 16 (3 frames), row 20 (3 frames), G1 and row 9
(6–10 frames: a log against a heavy enemy settles row 9).

## Kit plan

Written today and loaded with the real loader in a scratch copy of the
repository at commit eefee06
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-chr_0031_mifu/repo`;
the three kits, builds and scenarios also in `…/scratch-chr_0031_mifu/mykits/`).
The kits load: `efsim calc` lists every hit for both weapons, `efsim
simulate` runs the rotations below, `efsim kit-census` shows no field used
by this kit alone, and the data package's tests pass with them (`vitest
run packages/data`: 432 of 432).

### Operator kit (today)

- **Stacks:** none.
- **Buffs:** `trail_ready` (self, `gameBuff`
  `buff_chr_0031_mifu_normalskill_2`, 15 s, no modifiers);
  `splitter_ready` (self, `…_normalskill_3`, 15 s); `combo_susceptibility`
  (enemy, `buff_common_affixes_vulnerable_physical`); `p3_atk` (self,
  `…_potential_addattack`, zone atk):

```json
{ "id": "combo_susceptibility", "target": "enemy", "gameBuff": "buff_common_affixes_vulnerable_physical",
  "duration": { "sum": [{ "key": "duration", "skill": "chr_0031_mifu_combo_skill" }, { "key": "extra_time", "skill": "chr_0031_mifu_combo_skill" }] },
  "modifiers": [{ "zone": "susceptibility", "elements": ["physical"],
    "value": { "sum": [{ "key": "rate", "skill": "chr_0031_mifu_combo_skill" }, { "key": "extra_effect", "skill": "chr_0031_mifu_combo_skill" }] } }] },
{ "id": "p3_atk", "target": "self", "gameBuff": "buff_chr_0031_mifu_potential_addattack",
  "duration": { "key": "potential_addattack_duration", "skill": "chr_0031_mifu_combo_skill" },
  "modifiers": [{ "zone": "atk", "value": { "key": "potential_addattack_effect", "skill": "chr_0031_mifu_combo_skill" } }] }
```

  `extra_effect` / `extra_time` are 0 below P1 (SkillData defaults; P1
  sets them, and the data adds them only when P1's `potential` = 1), so
  the sums are exact.
- **Skills** (frames from SkillData; events default to the skill):
  - attack1–4, plunging_attack_end: as compiled (row 1–3, 6).
  - powerattack: `atk_scale` at 6 / 17 / 37 with `factor` 0.3 / 0.2 / 0.5
    (one hit per landing, not kit-draft's branch pairs).
  - normalskill_1: `available: {all: [{not: {buffActive: trail_ready}},
    {not: {buffActive: splitter_ready}}]}`, `teamEnergy: [{frame: 7, ratio:
    1}]`, hit `atk_scale` at 7. No `jumps` until G1 and G2 (then `[{at: 7,
    if: {enemySuperArmor: {atLeast: 30}}}]`).
  - normalskill_2: `available: {buffActive: trail_ready}`, `teamEnergy` at
    24, `flurry` `atk_scale` ×2 at 3 / 10, and:

```json
{ "id": "mangle_splitter", "branch": "mangle", "if": { "enemyVulnerable": 3 }, "scale": ["atk_scale2"], "frames": [24], "poise": "poise",
  "applies": [{ "kind": "physicalStatus", "status": "crush" }], "buffs": [{ "buff": "splitter_ready" }] },
{ "id": "mangle", "branch": "mangle", "scale": ["atk_scale2"], "frames": [24], "poise": "poise",
  "applies": [{ "kind": "physicalStatus", "status": "crush" }] }
```

  - normalskill_3: `available: {buffActive: splitter_ready}`, `teamEnergy`
    at 26, `hits: []` (its hit is a trigger until G3).
  - combo_skill: `atk_scale1` ×2 at 8 / 10; `uppercut` `atk_scale2` at 31
    with `energy: usp`, `poise`, `buffs: [{buff: combo_susceptibility,
    beforeDamage: true}]`.
  - ultimate_skill: `lift` `atk_scale` at 75 with `applies:
    [{kind: physicalStatus, status: lift, forced: true}]`; `slam`
    `atk_scale2` at 102 with `poise: poise2`; the f98 literal-0 hit left
    out.
- **Triggers:** `combo_window` (`vulnerable` minStacks 3, by anyone →
  `openCombo`); `cloudtrapper_cast` (cast normalskill_1 → `sp` 50, `buff
  trail_ready`); `trail_end` (cast normalskill_2, `delay` 24 → `endBuff
  trail_ready`); `splitter_end` (cast normalskill_3, `delay` 21 →
  `endBuff splitter_ready`); `combo_trail` (delay 27) and `ultimate_trail`
  (delay 102) → `buff trail_ready`; `trail_replaces_splitter` /
  `splitter_replaces_trail` (`buffApplied` of one → `endBuff` the other);
  `finisher_pause_trail` / `_splitter` (cast powerattack, `if: {buffActive}`
  → `extendBuff` 38/30 s); `p3_shield_atk` (row 34); and World Splitter's
  hit (G3's interim, G5's interim on its poise):

```json
{ "id": "world_splitter_hit", "on": { "event": "cast", "skills": ["chr_0031_mifu_normalskill_3"] }, "by": "self",
  "delay": 26, "awaited": true, "skill": "chr_0031_mifu_normalskill_3",
  "do": [{ "kind": "hits", "hits": [{
    "id": "world_splitter", "label": "World Splitter", "scale": ["atk_scale"], "damageType": "none", "element": "physical",
    "events": ["chr_0031_mifu_normalskill_3"], "frames": [0], "poise": { "product": ["poise", 2] },
    "extraScale": [{ "value": { "sum": [1, "crushmultiadd_talent"] },
      "if": { "all": [{ "talentAtLeast": [0, 1] }, { "any": [{ "enemyStaggered": true }, { "enemyModifier": { "zone": "susceptibility", "element": "physical" } }] }] } }] }] }] },
{ "id": "p3_shield_atk", "on": { "event": "cast", "skills": ["chr_0031_mifu_combo_skill"] }, "by": "self",
  "if": { "all": [{ "talentAtLeast": [1, 1] }, { "potentialAtLeast": 3 }] }, "cooldown": "talent_shield_cd",
  "skill": "chr_0031_mifu_combo_skill", "do": [{ "kind": "buff", "buff": "p3_atk" }] }
```

  With G3 the World Splitter hit moves into normalskill_3's `hits` with
  `damageType: none`; with G5 its poise becomes two `poiseOnly` hits at 23
  and 25.

Scratch run (`mifu-dapan.scenario.json`: Mi Fu P5 with Amaranthine Tassel
9/9/9 and Grizzled Edge ×3 + a Bonekrusha piece at artifice 3, Da Pan P5
with Ancient Canal, against Rhodagn; Da Pan's battle skill and ultimate,
Mi Fu's combo, Trail and Mangle, World Splitter, Cloudtrapper, Trail and
Mangle, attacks 1–4, ultimate, Trail and Mangle): 646,443 damage in
26.9 s. Da Pan's ultimate brings the enemy to 3 stacks at 1.43 s and opens
Mi Fu's combo window; the combo applies 10% Physical Susceptibility for
20 s at its f31 (before its hit) and Trail and Mangle's state at f27;
Trail and Mangle's Crush (level 3) gives World Splitter's state, Amaranthine
Tassel's +0.504 Physical DMG and ends Trail and Mangle's; World Splitter
lands at its f26 at ×1.200 (talent 1; 61,067 with talent 1 off, 73,281
with it) and ends its state at f21; Cloudtrapper gives Trail and Mangle
(15 s); the next Trail and Mangle starts at Cloudtrapper's frame 11 (the
window), its Crush on one stack gives no World Splitter. P3's ATK +6% from
the combo's cast. With Long Heritage on Si (`si-lh.scenario.json`, the
si-laevatain example with Si's weapon swapped): the team buff from her
ultimate's f62, the Cryo DMG buff from her battle skill's Cryo infliction.

### Equipment kits

- **wpn_claym_0017** (Amaranthine Tassel): buffs
  `wpn_claym_0017.arts_intensity` (self, `gameBuff
  buff_wpn_claym_0017_dmgup`, `duration`, `{attr: 87, value:
  phy_spell_up}`) and `wpn_claym_0017.phys` (self, `…_dmgup2`,
  `duration2`, `{attr: 50, value: {sum: [phy_dmg_up2, {product:
  [atk_up_mult, {eventCount: true}]}]}}`; the loader gives it `instances`
  2); triggers `on: {event: buffApplied, categories: [susceptibility]}`
  with G4's interim `if` → `arts_intensity`, and `on: {event:
  physicalStatus, statuses: [crush]}, beforeDamage: true` → `phys`. With
  G4 the first becomes `categories: [susceptibility], elements: [physical]`
  without the `if`.
- **wpn_claym_0019** (Long Heritage): buffs `wpn_claym_0019.cryo` (self,
  `…_teamspell`, `duration`, `{attr: 53, value: cryst_dmg_up}`) and
  `wpn_claym_0019.team_arts` (team, `…_teamatk`, `duration2`, attrs 51–54
  `spell_dmg_up`); triggers `on: {event: inflictionApplied, elements:
  [fire, cryst], fromKinds: [battle]}` → `cryo`, and `on: {event:
  buffApplied, categories: [amp]}` → `team_arts` (G4 interim; then
  `toOthers: true` and, per test C, `elements: [cryst]` or `allElements`
  of the four Arts elements).

Both load and fire as described (checked in the runs above).

## Kit (2026-10-21)

Files: [chr_0031_mifu.json](../../../packages/data/kits/operators/chr_0031_mifu.json),
[wpn_claym_0017.json](../../../packages/data/kits/equipment/wpn_claym_0017.json)
(Amaranthine Tassel), [wpn_claym_0019.json](../../../packages/data/kits/equipment/wpn_claym_0019.json)
(Long Heritage, generic, tested on Si); tests
[tests/kit-mifu.test.ts](../../../tests/kit-mifu.test.ts) (25); example
[examples/mifu-dapan.scenario.json](../../../examples/mifu-dapan.scenario.json)
with [examples/mifu-p5.json](../../../examples/mifu-p5.json). Started from
a fresh `efsim kit-draft chr_0031_mifu` (it now emits World Splitter's
`damageType: none`, its two `poiseOnly` landings, leaves out the
ultimate's literal-0 unit) and the kit plan above. Phantom Pain
(`wpn_claym_0016`) is Last Rite's to write (batch-4.md "Weapon owners");
Mi Fu is its natural wielder, nothing coordinated here.

### Re-analysis

| Item | Now | How |
|---|---|---|
| G1 (window a jump skips) | **done** | S9b. Cloudtrapper on Rhodagn: Trail and Mangle at frame 17 (window 115 after the 7 → 105 jump), 11 on a light enemy (test) |
| G2 (enemy super armor) | **done** | E1: `jumps: [{at: 7, if: {enemySuperArmor: {atLeast: 30}}}]`; Rhodagn 30, `eny_0099_slimeml2` 5 (test) |
| G3 (a skill hit's own damage type) | **done** | D5: World Splitter's `split` hit in the skill with `damageType: none`; no Battle Skill DMG on it, the cast stays a battle skill (SP, team energy at 26) |
| G4 (category triggers by element / recipient) | **done** | T1: Amaranthine `on: {event: buffApplied, tags: [1066759270]}` (the loader maps it to Susceptibility reaching Physical: exact); Long Heritage `categories: [amp], elements: [cryst], toOthers: true` (the reading of checkType 1 stays open: E11) |
| G5 (poise-only landings) | **done** | D6: `poiseOnly` hit at 23 and 25 (5 + 5 Stagger; test reads the bar) |
| Row 4 (finisher's identical IfElse sides) | interim, exact | three hits written by hand; kit-draft still emits branch pairs (batch-3 D3 residue) |
| Row 5 (finisher pauses the states) | interim, exact | `extendBuff` 38 frames on the active state (Purrchena's form; the finisher's channel can't be cut before 38). No shared pause action exists; nothing else needs one here |
| Row 9, 10 (Cloudtrapper's heavy path) | **done** | G1, G2 |
| Row 16 (Trail and Mangle ×1.25 self speed-up 0–15) | **open** (Ti1b) | not modelled: everything after its frame 15 comes 3 frames late |
| Row 18, 20 | **done** | G3, G5 |
| Row 19 (`yuanshi_multi`) | unknown | written as a scale key (`["atk_scale", "yuanshi_multi"]`): the SkillData default 1, since ReadSkillSettingData's table isn't in the checkout; test 91 |
| Row 23 (combo trigger as a state) | **open** (batch-3 T5) | engine: a 6 s window per Vulnerable event at 3+; test 90 |
| Row 25 (combo Susceptibility before its hit) | done | `buffs: [{…, beforeDamage: true}]` on the f31 hit (test: on the uppercut, not on the f10 hit) |
| Row 29 (ultimate's literal-0 unit) | done | D8c: the compiler leaves it out; the kit too |
| Row 31 (talent 2's shield) | open (batch-3 N2) | no damage effect; P3's ATK buff is modelled with the shield's 60 / 45 s cooldown |
| Row 37 (sub-skills as battle skills) | unknown | engine: yes (Link, cast triggers); test 29 |
| States (ChangeSkillAction) | interim, exact | hand-written (D10a reports the created state buffs, compiles nothing): kit buffs `trail_ready` / `splitter_ready` gating `available` |
| E2 | **done** | G4 |
| E5 (`dmgup2` instances) | done | loader (batch-3 B1) |
| E10 | **done** (reading open) | G4: an Amp reaching Cryo given to someone else |
| E10's two wielders | open (batch-3 B2 residue) | two Long Heritage wielders' team buffs would add; minor |
| E11 | unknown | test 92: with "tag query only" the trigger becomes `tags: [486772476]` and Si's Cryo / Heat Amp stops counting |

Nothing new is missing; no engine, loader or compiler change. One tiny
CLI fix: `efsim calc` listed a `poiseOnly` hit with damage (7,368 ×2 for
World Splitter's Stagger units); `kitHits` in
packages/cli/src/commands.ts now skips them as damage.ts's `kitHits`
does. No kit had a `poiseOnly` hit before, so no existing output changes.

### What the kit models

- Basic attacks 1–4 (attack4's f30 Final Strike: 25 Stagger and 28 SP
  only while controlled), the finisher (9.0 × 0.3 / 0.2 / 0.5), the dive
  attack (castable once dives are rotation steps: batch-1 S10).
- The three battle-skill moves on one button: Cloudtrapper (100 SP, 50
  returned at the cast, its heavy / pull path by the enemy's super armor),
  Trail and Mangle (Crush; on 3+ Vulnerable stacks World Splitter's state),
  World Splitter (10 Stagger at 23 / 25, Crush-type damage at 26, talent 1
  ×1.1 / ×1.2 on a Staggered or Physically Susceptible target, P5 ×1.1).
  The states: 15 s, each ending the other, ended by their own move (24 /
  21, kept if the cast is cut before), given by Cloudtrapper (0), the combo
  (27) and the ultimate (102), paused by the finisher.
- The combo (window on 3+ Vulnerable stacks; Physical Susceptibility 5% /
  16 s, 10% / 20 s at P1+, on its own last hit; 10 energy; 19 s, 17 s at
  P1), P3's ATK +6% for 20 s once per 45 s with talent 2.
- The ultimate (80, 68 at P4; forced Lift at 75; slam at 102 with 20 / 25
  Stagger).
- Amaranthine Tassel: Arts Intensity +84 for 20 s on the wielder's
  Physical Susceptibility; Physical DMG +0.252 + 0.084 × stacks for 30 s on
  a Crush that consumes Vulnerable, already on the Crush and its hit
  (0.504 at 3 stacks).
- Long Heritage: Cryo DMG +0.168 for 20 s when the wielder's battle skill
  inflicts Cryo or Heat (on the inflicting hit too: Si's SpellInfliction
  comes before its DamageAction); team Arts DMG +0.112 for 20 s when the
  wielder's Amp reaching Cryo reaches a teammate (Si's ultimate with
  Laevatain: yes; Si alone: no). On Mi Fu neither fires.

Left out: the ×1.25 speed-up (Ti1b), the shield (N2), pulls, teleports,
hit-stop and the unreached buffs (row 38). Data quirk noted for the dive
work: `chr_0031_mifu_plunging_attack_end`'s only AllowNextSkillAction
window lists `chr_0009_azrila_attack1` (Ember's attack 1), not Mi Fu's.

`efsim kit-census`: `hit.damageType` (on a skill hit) and `hit.poiseOnly`
are used by this kit only; both are batch-4 shared fields (D5, D6) with
other data users (D6: Tangtang, Yvonne, Ember), not one-offs.
skillCompile.test.ts: Mi Fu added to OPERATORS with two KNOWN entries
(the test can't match a `poiseOnly` hit, whose scale is empty, to a
landing; World Splitter's `$atk_scale_runtime?`, a ModifyDynamicBlackboard
chain the compiler doesn't follow).

### Verification

No log fixture has Mi Fu, Amaranthine Tassel or Long Heritage, so no
`zmdlogs` checks. The example (`mifu-dapan`: Mi Fu P5 with Amaranthine
Tassel and Grizzled Edge, Da Pan P5 with Ancient Canal, vs Rhodagn):
636,140 damage in 27.1 s (23,474 DPS); Mi Fu 582,605 (91.6%), of which
the level-3 Crush from Trail and Mangle is 166,792 and World Splitter
73,281 (the analysis run's value, ×1.2 from talent 1). Timings match the
plan: Da Pan's ultimate gives 3 stacks at 1.43 s and opens the combo at
once; Trail and Mangle at the combo's frame 35 (2.60 s), World Splitter at
Trail and Mangle's 28 (3.53 s), its hit at 26 (4.40 s); Cloudtrapper waits
for SP (17.53 s), the next Trail and Mangle at its real frame 17 (heavy
path); the ultimate's hits at 75 / 102. The analysis run gave 646,443 in
26.9 s on the engine before the shared features; the difference is most
likely B1 (no Link from the combo for Trail and Mangle) and the heavy
path's 6 frames (not traced hit by hit). At P0 (the search default for 6-stars) the
same rotation gives 548,101.

Example totals and log outputs: every `examples/*.scenario.json` and
every `zmdlogs check` / `reactions` on fixtures/ and fixtures/pending/
compared before (a copy of HEAD) and after: unchanged.

### In-game tests the kit depends on

90 (the combo trigger as a state), 91 (World Splitter's damage type and
`yuanshi_multi`), 92 (Long Heritage and Si's Amp: the checkType 1
reading), 29 (sub-skills as battle-skill casts), 38 (two Physical
Susceptibility sources), 51 (Amaranthine's Crush buff on the Crush and its
hit; Long Heritage's Cryo DMG on the inflicting hit), 64 (a stack added at
3+ reopens the window), 60 (batch-3 T5), 35 (an infliction that forms a
reaction, for Long Heritage).
