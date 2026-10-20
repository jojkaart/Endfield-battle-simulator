# Da Pan (chr_0018_dapan): gap report, batch 3

Operator Da Pan (Physical, greatsword: CharGrowthTable `weaponType` 3,
main attribute Strength 39, secondary Will 42), with the weapons Ancient
Canal (`wpn_claym_0014`) and OBJ Heavy Burden (`wpn_claym_0015`)
([batch-3.md](../batch-3.md)). No gear set is assigned to this report.

Sources (rmxlinux, the submodule's pinned commit): SkillData
`chr_0018_dapan_*` (13 files), BuffData `buff_chr_0018_dapan_*` (6 files),
`sk_wpn_claym_0014`, `sk_wpn_claym_0015`, `buff_wpn_claym_0014(_pdi_up)`,
`buff_wpn_claym_0015`, `buff_physical_do_crushed`, `buff_physical_crushed`;
TableCfg CharGrowthTable, SkillPatchTable, PotentialTalentEffectTable,
CharacterPotentialTable, WeaponBasicTable, I18nTextTable_EN. The operator
files came into the sparse checkout with commit 535e88f. Values are at
skill level 12 and weapon skill level 9 unless noted (SkillPatchTable; the
SkillData file defaults are placeholders, e.g. the combo's cooldown 10 vs
19 s). Frames are SkillData timeline frames (30 FPS) from the cast.

There's no earlier report on Da Pan. Brief claims checked: both weapon IDs
and names (WeaponBasicTable `engName`) are **confirmed**, both are
weaponType 3, his type; no log fixture has him or either weapon (`grep
chr_0018_dapan|wpn_claym_0014|wpn_claym_0015 fixtures/`: none).

`efsim kit-draft chr_0018_dapan` was run. It gives every damage landing
with the right frames, keys, energy and team energy, but leaves out
stagger (3 hits), the finisher factors, every physical status (two Lifts,
the Knock Down, the Crush and its multiplier), P5's extra Vulnerable,
the talents and the buffs they create. Those are the `data` rows.

## Action types per file

What each file uses that matters for damage, resources, state or timing
(sound, VFX, camera, animation, root motion, rotation, super armour,
teleport and weapon-visibility actions are left out):

| File | Action types that matter |
|---|---|
| attack1–4 | DamageAction (atkScale; attack1 and attack3's first hit in a ChannelingAction of one tick), ObtainCostAction costType 1 `atb` (0 for 1–3, 21 for attack4); attack4 mask 2097280 (Final Strike) and a poise unit `poise` 20 with onlyEnableForMainChar; AllowNextSkillAction (chain windows) |
| power_attack (finisher) | DamageAction ×2 (BreakingAttackCalculation, multiplier 0.4 at f16, 0.6 at f35; mask 132), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` (0–35) and `buff_common_full_immune_medium` (0–46), AllowNextSkillAction 35–56 (battle, combo) |
| plunging_attack_start / _end | _end: DamageAction 1.8 (mask 1152), ObtainCostAction `atb` (0) |
| dash_attack | ChannelingAction DamageAction (mask 131200, poise × 1/6); skillSpecification 7, not in the NormalAttack group |
| dodge | AllowNextSkillAction 7–13 only |
| normal_skill (battle) | f8: InterruptAction 1 s, DamageAction `atk_scale_pre`; f43: AirborneAction (forceAirborne **false**, `airborne_duration`), IfElse [CompareFloat `potential_5_interval` ≥ 1, CheckTimedMarker, CheckEntityNum compareType 4 minNum 1] → CreateBuff `buff_physical_no_guard` + CreateTimedMarker, DamageAction `atk_scale` with poise, CreateBuff `buff_common_obtain_ultimate_sp`; AllowNextSkillAction 65–89 (itself); durationFrame 210, exclusiveFrame 65 |
| combo_skill | f23: CreateBuff `_combo_skill_tutorial_marker`, CheckEntityNum, **CrushAction** (`damageMultiplier` `crush_multi`), DamageAction `atk_scale` with poise (mask 12288), ObtainCostAction `usp`; TimeDilationAction ComboSkill curve 0–15; AllowNextSkillAction 24–59 (battle skill); cooldown 19 s (L12); exclusiveFrame 52 |
| ultimate_skill | TimeDilationAction layer 0, scale 0, 0–36 (time stop, ignoring Da Pan); f0: AirborneAction **forceAirborne**; EventListenerAction 0–89 abilityEvent 222 (a kill) + CheckDamageDecorateMask mask 33280 + CompareFloat `potential_1_dmg_up` > 0 → CreateBuff `buff_chr_0018_dapan_potential_1`; 42–64: ChannelingAction (targetTriggerInterval 0.13 s, maxCountPerTarget 8) DamageAction `atk_scale_loop` (mask 4608) with a layer-1 hit-stop per tick; f80: IfElse CompareFloat `talent_1` ≥ 1 → ForEach target CreateBuff `buff_chr_0018_dapan_talent_1_preparation` (assigns `talent_1_duration`, `talent_1_stack` → max_stack, `talent_1_cd_reduce`), **KnockDownAction forceKnockDown**, DamageAction `atk_scale_end`; CreateBuff `buff_common_damage_immune_ult_skill` 0–100; AllowNextSkillAction 86–120 (battle, combo); cost 90, cooldown 15 s |
| talent_0 | blackboard only (`dmg_up`); the talent's buff comes from PotentialTalentEffectTable attachBuff |
| buff_…_talent_0 | abilityEvent 208 (Da Pan consumes a buff) + CheckBuffIdInContextAdvanced `buff_physical_no_guard` + CheckConsumeBuffLayer (≥ 1, stored as `consumedLayer`) → CreateBuff `_talent_0_dmg_up` × consumedLayer |
| buff_…_talent_0_dmg_up | attributeModifier attr 50 (Physical DMG) `dmg_up`, `duration`; stackingType 8 (layers on one refreshed timer), max `stack` |
| buff_…_talent_1_preparation | stackingType 8, max `max_stack`, `duration`; abilityEvent 30 + CheckSkillType [6] (a combo cast) → CreateBuff `_talent_1_cd_reduce` |
| buff_…_talent_1_cd_reduce | abilityEvent 13 (Da Pan deals damage) → SetSkillCdAtOnce isPercentage `cd_reduce`, skillTypeMask 64 (combo); FinishBuff 1 layer of `_preparation`; FinishBuff itself |
| buff_…_potential_1 | attr 50 `dmg_up`, `duration`, stackingType 4 |
| buff_…_combo_skill_tutorial_marker | nothing (1 s marker) |
| buff_physical_crushed / _do_crushed | StoreBuffCount of Vulnerable → `_do_crushed`: ReadSkillSettingData (Crush scale by count), × `dmg_multiplier`, **FinishBuff `buff_physical_no_guard` (all) before its DamageAction** (mask 16384), InterruptAction, IgniteAction 1 |
| sk_wpn_claym_0014 | cardAttributeModifier attr 87 (Arts Intensity) `phy_spell_up`; abilityEvent 208 + CheckBuffIdInContext tag 1075718177 (Vulnerable) + CheckConsumeBuffLayer → `count`; SimpleCalcBB `phy_dmg_up` = `phy_dmg_up_mult` × `count` → CreateBuff `buff_wpn_claym_0014_pdi_up`; toggleBuffs `buff_wpn_passive_spirit_01` (`atk_up`, not in the skill) |
| buff_wpn_claym_0014_pdi_up | attr 50 `phy_dmg_up_mult`, `duration`; stackingType 1, priority key `phy_dmg_up_mult`, maxStackCnt 2 |
| buff_wpn_claym_0014 | attr 87 `phy_spell_up` (lifeType 1); referenced by no file read here |
| sk_wpn_claym_0015 | cardAttributeModifier formulaItem 6, modifyAttributeType 2 (secondary attribute %) `second_attr_up`; abilityEvent 206 + tag 2029588776 (Weakness: `buff_common_affixes_weak`) and abilityEvent 401 + CheckPhysicalInflictionType mask 2 (Knock Down), each behind CheckTimedMarker / CreateTimedMarker `cd` (0.1 s) → CreateBuff `buff_wpn_claym_0015`; toggleBuffs `buff_wpn_lance_0003` (CheckCurHpRatio `hp_ratio`, not in the skill) |
| buff_wpn_claym_0015 | attr 3 DEF, formulaItem 6 (%) `def_up`, `duration`; stackingType 4 (refreshed) |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: `atk_scale` 0.63 / 0.75 / 0.38 + 0.75 (`atk_scale_2`) / 1.36 at f13 / 7 / 10, 23 / 32; attack4 Final Strike, `atb` 21 | supported | `hits[].scale`, `frames`, as kit-draft; Final Strike from the mask |
| 2 | "As the controlled operator, Final Strike also deals {poise} Stagger": attack4 poise 20, onlyEnableForMainChar | data | `poise: "poise"`, `poiseControlledOnly: true` (kit-draft emits no poise, D3) |
| 3 | Finisher: `atk_scale` 9.0 × 0.4 (f16) and × 0.6 (f35), GainBreakingAttackAtb, disable-cast 0–35 | data | `factor: 0.4` / `0.6` hand-written (kit-draft: `count: 2` without factors, D3); finisher SP and cast lock are the engine's |
| 4 | Dive attack `plunging_attack_end` 1.8 at f1 | supported | in the kit; not castable until rotations have jumps |
| 5 | Dash attack (skillSpecification 7, not in `chr_0018_dapan_NormalAttack`) | supported | left out, as in the other kits |
| 6 | Dodge | supported | the engine's (perfect dodges from BuffData); nothing operator-specific in the file |
| 7 | Battle skill "FLIP DA WOK!": cost 100 SP; f8 `atk_scale_pre` 0.41 (InterruptAction 1 s), f43 `atk_scale` 2.59 with poise 10 | supported | two hits as kit-draft, plus `poise` on the second (data, D3). The interrupt has no effect (enemy actions come only from the scenario) |
| 8 | "deals Physical DMG and Lift": AirborneAction at f43, **not forced** | data | `applies: [{kind: physicalStatus, status: lift}]` on the f43 hit: on an enemy without Vulnerable it only adds a stack (status.ts) |
| 9 | Team energy: `buff_common_obtain_ultimate_sp` at f43 | supported | `teamEnergy: [{frame: 43, ratio: 1}]` (compiled) |
| 10 | Timing: exclusiveFrame 65, recast window 65–89, dontInterruptCombo | supported | SkillData (the loader) |
| 11 | P5 "If the skill hits only one enemy, apply 1 more stack of Vulnerability on the target. This effect can only trigger once every {potential_5_interval}s" (45; 0 below P5): after the Airborne, before the DamageAction, behind a 45 s timed marker | data | a second application on the f43 hit, `{kind: vulnerable, if: {all: [{potentialAtLeast: 5}, {not: {buffActive: p5_interval}}]}}`, and `buffs: [{buff: p5_interval, if: (same)}]` (a 45 s marker buff, duration `potential_5_interval`). Order kept: the Lift is judged before the extra stack (checked: fresh enemy → 2 stacks, no Lift). One enemy: "only one enemy" always holds (`targetsHit` is 1) |
| 12 | Combo trigger: "When an enemy reaches 4 stacks of Vulnerability" (game code: no TriggerComboSkillAction in the files) | supported | trigger `on: {event: vulnerable, minStacks: 4}, by: anyone` → `openCombo` (any operator's stacks: "an enemy reaches") |
| 13 | Whether a stack added at 4 (the count stays 4) opens the window again | unknown | the engine emits `vulnerable` with 4 each time, so it reopens. In-game test A |
| 14 | Combo "MORE SPICE!": f23 `atk_scale` 6.5, poise 15, `usp` 10 (self), cooldown 19 s (L12; 20 at L1) | supported | as kit-draft plus `poise` (data) |
| 15 | "and Crush. This Crush also deals more DMG": CrushAction before the DamageAction, `damageMultiplier` `crush_multi` 1.2 (1.1 at L1) | data | `applies: [{kind: physicalStatus, status: crush, multiplierKey: crush_multi}]` (checked: Crush level 4 after the ultimate's Knock Down) |
| 16 | Combo timing: ComboSkill time dilation 0–15, exclusiveFrame 52, battle-skill window 24–59 | supported | SkillData (slow-down read as layer 0, 18 frames) |
| 17 | Ultimate "CHOP 'N DUNK!": cost 90, cooldown 15 s, time stop 0–36 (layer-0 dilation at scale 0, ignoring Da Pan), exclusiveFrame 100, window 86–120 (battle, combo) | supported | SkillData; cost from the tables |
| 18 | "slams the chopping board to forcibly Lift all enemies": AirborneAction forceAirborne at f0 (no damage landing) | data | cast trigger `ult_lift` → `apply` `{kind: physicalStatus, status: lift, forced: true}` at the cast (+1 Vulnerable, the Lift hit, the status). kit-draft only compiles landings |
| 19 | "6-sequence flurry": ChannelingAction 42–64, one landing per 0.13 s on a target (max 8), `atk_scale_loop` 0.5 | supported | 6 hits at 42 / 46 / 50 / 54 / 58 / 61 (compiled; the text says 6) |
| 20 | "bash every enemy to the ground to forcibly Knock Down and deal massive Physical DMG": f80 KnockDownAction forceKnockDown, `atk_scale_end` 4.0 (no poise) | data | `applies: [{kind: physicalStatus, status: knockdown, forced: true}]` on the f80 hit. With the f0 Lift the ultimate adds 2 Vulnerable on its own, which can reach the combo's 4 |
| 21 | Talent 1 "Reduce and Thicken": "After consuming 1 Vulnerability stack, Da Pan gains Physical DMG Dealt +{dmg_up} for {duration}s. This effect can reach {stack} stacks" (0.04 / 0.06, 10 s, 4): one layer per stack consumed, layers on one timer | data | buff `reduce_and_thicken` (`gameBuff` → shared timer; `maxStacks`, `duration`, `{attr: 50}` from `{talent: 0, key: …}`) and trigger `on: {event: physicalStatus, statuses: [crush, breach]}, by: self, beforeDamage: true` → `buff` with `layers: {eventCount: true}`. Crush and Breach are what consume Vulnerable; the event's level is the stacks consumed. Checked: 4 layers × 0.06 after the combo |
| 22 | Which hits talent 1 (and Ancient Canal) reach first: in `_do_crushed` the FinishBuff of Vulnerable (event 208) runs before the Crush's own DamageAction, and the CrushAction before the combo's DamageAction | supported | `beforeDamage: true`: both the combo hit and its Crush carry them (checked: combo hit 30,746 vs 18,297 bare in `calc`). The engine deals the Crush after the combo hit (batch 2 K3), which changes nothing here. In-game test B confirms |
| 23 | Talent 2 "Salty or Mild": "For every enemy hit by the final sequence of the ultimate, gains 1 stack of Prep Ingredients for {talent_1_duration}s (max stacks: {talent_1_stack})" (20 s; 1 / 2 by talent level), only if `talent_1` ≥ 1 | data | buff `prep_ingredients` (`maxStacks: talent_1_stack`, `duration: talent_1_duration`, keys of the ultimate) via `buffs: [{buff: prep_ingredients, if: {talentAtLeast: [1, 1]}}]` on the f80 hit; one enemy, one layer |
| 24 | "When Prep Ingredients is active, hitting an enemy with combo skills immediately shortens cooldown by {talent_1_cd_reduce} and consumes 1 stack" (0.4): set up at the combo's cast, run on Da Pan's first damage after it | supported | trigger `on: {event: hit, kinds: [combo]}, by: self, if: {buffActive: prep_ingredients}, maxPerCast: 1` → `cooldown` (self, combo, `fraction: −talent_1_cd_reduce`), `endBuff` 1 layer. Checked: ready 699 → 471 (−7.6 s of 19 s) |
| 25 | What "shortens cooldown by 40%" (SetSkillCdAtOnce isPercentage) means: of the full cooldown, of what's left, or set to 40% | unknown | the engine cuts by the fraction of the full cooldown (test 36's assumption). Da Pan separates "cut by" from "set to" by about 3 s: in-game test C |
| 26 | P1 "Fine Cooking": "If the ultimate defeats at least one enemy, Da Pan deals +{potential_1_dmg_up} Physical DMG for {potential_1_duration}s" (0.3, 15 s; listener 0–89 on abilityEvent 222 with mask 33280) | gap | kills (N1, deferred with multi-enemy support): no effect against a boss |
| 27 | P2: Prep Ingredients duration +10 s, max stacks +1 (skillBbModifier add on the ultimate) | supported | the panel's skill values (talents first, then potentials: set 2, add 1 → 3; 30 s; checked in a run) |
| 28 | P3: Strength +15, Physical DMG Dealt +8% | supported | stat panel |
| 29 | P4: ultimate cost × 0.85 | supported | tables (76.5 energy) |
| 30 | Actions with no damage effect: InterruptActions, hit-stops (layer-1 dilation on each flurry tick), `buff_common_damage_immune_ult_skill`, the finisher's immunity, the combo's tutorial marker | supported | not modelled (design.md lists hit-stop as not modelled) |

### Equipment

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| E1 | Ancient Canal: Strength +124, Arts Intensity +62 (`wpn_sp_attr_phy_spell_mid`), and sk_wpn_claym_0014 "Arts Intensity +{phy_spell_up}" (28, cardAttributeModifier attr 87) | supported | stat panel (scratch build: Arts Intensity 134.85 = 44.85 + 62 + 28) |
| E2 | "After the wielder consumes Vulnerability stack(s), the wielder gains Physical DMG Dealt +[{phy_dmg_up_mult} × Stacks Consumed] for {duration}s" (0.14 per stack, 20 s) | supported | trigger `on: {event: physicalStatus, statuses: [crush, breach]}, by: self, beforeDamage: true` → buff `{attr: 50, value: {product: [phy_dmg_up_mult, {eventCount: true}]}}` (its value taken at the event: K2, commit 7c7d00e). Checked: +0.56 after a level-4 Crush |
| E3 | "Effects of the same name cannot stack": stackingType 1, priority key `phy_dmg_up_mult`, maxStackCnt 2 | gap | **G2** (a weaker reapplication replaces a stronger one in the engine). Interim `maxStacks: 2` |
| E4 | toggleBuffs `buff_wpn_passive_spirit_01` with `atk_up`, which sk_wpn_claym_0014 doesn't have | supported | no effect (a template leftover, as Twilight's in batch 1) |
| E5 | OBJ Heavy Burden: Strength +124, HP +62.4%, and "Secondary Attribute +{second_attr_up}" (14%, formulaItem 6, modifyAttributeType 2) | supported | stat panel (Will 300.2 → 342.2 on Da Pan) |
| E6 | "When the wielder applies Knocked Down … gains DEF +{def_up} for {duration}s" (50.4%, 15 s; abilityEvent 401 mask 2, 0.1 s marker) | supported | trigger `on: {event: physicalStatus, statuses: [knockdown]}, by: self, cooldown: cd` (checked: applied at the ultimate's f80) |
| E7 | "… or Weakness": abilityEvent 206 + Weakness tag | supported | trigger `on: {event: buffApplied, categories: [weakness]}, by: self, cooldown: cd` (Catcher's ultimate Weakness has attr 62, so it counts) |
| E8 | The buff's DEF +50.4% is a percentage (formulaItem 6) | gap | **G1**: kit-buff attributes are flat additions; the buff is written without a modifier for now |
| E9 | toggleBuffs `buff_wpn_lance_0003` (CheckCurHpRatio `hp_ratio`, not in sk_wpn_claym_0015) | supported | no effect (leftover, as for Pursuit and Forgeborn in batch 1) |

**Counts:** operator 30 mechanics: 18 supported, 9 data, 1 gap (P1, N1
deferred), 2 unknown, 0 unique?. Equipment 9: 7 supported, 2 gap.

Nothing is unique: Vulnerable consumption by Crush is the Grizzled Edge
pattern (`suit_crush_fracture`, eventCount of a `physicalStatus` event);
abilityEvent 208 on Vulnerable is also in `sk_wpn_claym_0014` and, on
other tags, Xiranflow (`buff_equipsuit_expend_spell01`); the combo's
cooldown cut is Si's and Arcane's `cooldown` `fraction`; layered buffs on a
shared timer are B3.

## Gaps

### G1. Percentage attribute buffs (formulaItem 6)

- **family:** values (attributes).
- **feature:** a kit-buff attribute modifier may be a percentage of the
  panel line, `{attr: 3, value: "def_up", percent: true}`: while active it
  adds `value × (base + Σ add)` of that attribute (the panel formula's
  percent slot, `((base + add) × (1 + percent) + flat) × multiply`), summed
  with the panel's other percentages, not compounded with other buffs; read
  by `{attr: n}` values and `attrAtLeast` as flat buff attributes are today
  (`buffAttr`). The loader can take `percent` from the game buff's
  formulaItem 6. A main-attribute percentage would also have to reach ATK
  through the attribute bonus (effects.ts READ_ATTRS: "a buff's main
  attribute doesn't raise ATK … not modelled"), which this feature leaves
  open.
- **evidence:** `buff_wpn_claym_0015` attributeModifier attributeType 3,
  formulaItem 6, `def_up` (0.504 at skill level 9); description "the
  wielder gains DEF +{def_up:0.0%}". **Shared:** BuffData with formulaItem
  6 on attributes 1, 3 or 39–42: `buff_equipsuit_defup_01`,
  `buff_equipsuit_maxhpup_01`, `buff_equipsuit_attrisuitup_03` (unused),
  `buff_wpn_def_dur`, `buff_wpn_def_phyres_dur`, `buff_wpn_lance_0007`,
  `buff_wpn_lance_0012_attribute(2)`, `buff_wpn_sword_0026_celebration`,
  `buff_wpn_pistol_0009`, and the enemy-side
  `buff_chr_0004_pelica_normal_debuff` (Perlica, this batch).
- **impact:** none on Da Pan (no DEF-based hit, damage taken isn't
  simulated). On Catcher (also a greatsword; her ultimate applies Knock
  Down and Weakness): her P1 strike is 300 + 5 × DEF, so +50.4% DEF (about
  +70 to +100 DEF) is +350 to +500 per strike, roughly +30% on 5–6 strikes
  per ultimate.

### G2. Instances of one buff with a priority (stackingType 1)

- **family:** buff lifecycle.
- **feature:** reapplying a kit buff whose game buff is stackingType 1
  with a priority key keeps up to `maxStackCnt` instances (0: no limit),
  each with its own timer, and only the strongest acts; a weaker new
  instance doesn't replace or shorten a stronger one. Today `withBuff`
  replaces the active instance of the same kit buff (the loader's stack
  group only picks the strongest among different kit buffs, and among
  layers when `maxStacks` is set). Open detail: which instance the game
  drops when the limit is reached (the oldest or the weakest).
- **evidence:** `buff_wpn_claym_0014_pdi_up` stackingSettings
  `stackingType: 1, usePriorityKey: true, priorityKey: phy_dmg_up_mult,
  maxStackCnt: 2`; `buff_equipsuit_crush_fracture_physicdamage` has the
  same with `priorityKey: priority, maxStackCnt: 0` (Grizzled Edge, batch
  2; its kit writes one buff that a weaker Crush or Breach replaces).
- **impact:** Da Pan himself always consumes 4 stacks (his only
  consumption is the combo's Crush, whose window opens at 4), so none for
  him. A wielder who Crushes 4 stacks and then Breaches 1 within 20 s
  drops from +56% to +14% in the engine instead of keeping +56%. Interim
  in the draft: `maxStacks: 2` (two instances, the strongest acts, a third
  replaces the oldest).

N1 (kills, P1) is batch 2's deferred item, not a new gap. The data rows
are D3 (compiler leftovers: poise, finisher factors, physical statuses);
three more kinds of leftover for D3's list: talents' attached buffs and
the triggers behind them, a physical status without a damage landing
(the ultimate's f0 Lift), and an application inside a skill's IfElse
(P5's Vulnerable).

## Verification

No committed or pending fixture has Da Pan, Ancient Canal or OBJ Heavy
Burden. Logs (ZMDLogs) that would verify the kit:

- Da Pan at P5 with talents at level 2, with a teammate who applies
  Vulnerable (Lift or Knock Down: Gilberta, Estella, Catcher), against a
  boss: the battle skill (`chr_0018_dapan_normal_skill`, two hits), the
  ultimate (`chr_0018_dapan_ultimate_skill`: 6 + 1 hits;
  `buff_physical_airborne` at the cast and `buff_physical_knockdown` at
  f80), the combo (`chr_0018_dapan_combo_skill`) with its Crush
  (`buff_physical_crushed`, level 4 × `crush_multi` 1.2). The combo's and
  Crush's values settle row 22 (talent 1's +24% on both); cast times give
  Prep Ingredients' cooldown cut (row 25) and when the combo window opens
  (rows 12–13); the battle skill's first cast on a fresh enemy shows P5's
  order (2 stacks, no Lift).
- Ancient Canal on Da Pan: `buff_wpn_claym_0014_pdi_up` at 0.56 after each
  combo. OBJ Heavy Burden: `buff_wpn_claym_0015` after the ultimate's Knock
  Down (no damage effect on him; on Catcher it would show in her P1
  strikes, G1).

In-game tests (new; none of the existing ones covers Da Pan). Test 36 asks
the same cooldown question for Arcane; test C below answers part of it.
Test 56 (where a Crush gets its bonuses) is the Endministrator's; for Da
Pan the order changes no number, since his consumption buffs come before
both hits.

- **A. Does the combo light again at 4 stacks?** (ready, if you have Da
  Pan). Bring a dummy to 4 Vulnerable (battle skills and his ultimate add
  them; a teammate's Lift helps), don't cast the combo, and wait about 10 s
  until its prompt is gone (Vulnerable lasts 20 s from the last stack).
  Then add one more stack (a battle skill: its Lift on a Vulnerable target
  adds one, the count stays at 4). Engine: the combo prompt lights again.
  If it only lights when the count goes from 3 to 4, it stays dark.
- **B. Does the Crush's bonus act on the combo's own hit?** (ready, if you
  have Da Pan with Ancient Canal). The first combo of a fight (no bonus
  active before it) and a second one within 20 s of it (Ancient Canal's
  +56% still active from the first): compare the combo's damage numbers,
  the lower of two tries each (crits). Engine (data order): about equal,
  both carry the bonus. If a hit doesn't see the bonus its own Crush
  creates, the second is about 1.3–1.4× the first. (Use the ultimate's
  Prep Ingredients to get the second combo within 20 s.)
- **C. How much Prep Ingredients cuts the combo cooldown** (ready, if you
  have Da Pan with talent 2). Cast his ultimate, then his combo (the
  ultimate's two forced statuses help reach 4 stacks), and time from the
  combo's cast until it's ready again. Engine (40% of the full 19 s off):
  about 11.4 s; 40% of what's left gives about 11.7 s (not separable by
  hand); "set to 40% of full": about 8.4 s; no cut: 19 s. Without the
  ultimate first: 19 s.
- **D. P5's extra stack and the Lift** (ready, if you have Da Pan at P5).
  On a dummy without Vulnerable, cast the battle skill once. Data order
  (the Lift is judged first): 2 Vulnerable stacks and no Lift (no
  separate Lift damage number, the dummy isn't lifted). If the extra stack
  came first: 2 stacks and a Lift with its own damage number.

## Kit plan

Written today and loaded with the real loader in a scratch copy of the
repository at commit ae1c4f6
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0018_dapan/repo`;
copies of the three kits and the scenarios in `…/scratch-chr_0018_dapan/mykits/`):
`efsim calc` lists every hit for both weapons, `efsim simulate` runs a
rotation, `efsim kit-census` shows no field used by this kit alone, and
the data package's tests pass (`vitest run packages/data`: 276 of 276).

### Operator kit (today)

- **Stacks:** none.
- **Buffs:** `reduce_and_thicken` (self; `gameBuff`
  `buff_chr_0018_dapan_talent_0_dmg_up`, so the loader gives it a shared
  timer; `duration` `{talent: 0, key: duration}`, `maxStacks` `{talent: 0,
  key: stack}`, `{attr: 50, value: {talent: 0, key: dmg_up}}`);
  `prep_ingredients` (self; `gameBuff`
  `buff_chr_0018_dapan_talent_1_preparation`; `duration` and `maxStacks`
  from the ultimate's `talent_1_duration` / `talent_1_stack`; no
  modifiers); `p5_interval` (self, 45 s marker, duration
  `potential_5_interval` of the battle skill, so 0 and never applied below
  P5).
- **Skills** (frames from SkillData; events default to the skill):
  - attack1–4: `atk_scale` at 13 / 7 / 10 + `atk_scale_2` at 23 / 32;
    attack4 `poise: "poise"`, `poiseControlledOnly: true`.
  - power_attack: `atk_scale` at 16 `factor: 0.4` and at 35 `factor: 0.6`.
  - plunging_attack_end: `atk_scale` at 1.
  - normal_skill: `teamEnergy: [{frame: 43, ratio: 1}]`; `atk_scale_pre`
    at 8; `atk_scale` at 43 with `poise` and:

```json
"applies": [
  { "kind": "physicalStatus", "status": "lift" },
  { "kind": "vulnerable", "if": { "all": [{ "potentialAtLeast": 5 }, { "not": { "buffActive": "p5_interval" } }] } }
],
"buffs": [{ "buff": "p5_interval", "if": { "all": [{ "potentialAtLeast": 5 }, { "not": { "buffActive": "p5_interval" } }] } }]
```

  - combo_skill: `atk_scale` at 23, `energy: "usp"`, `poise`, `applies:
    [{kind: physicalStatus, status: crush, multiplierKey: crush_multi}]`.
  - ultimate_skill: `atk_scale_loop` ×6 at 42 / 46 / 50 / 54 / 58 / 61;
    `atk_scale_end` at 80 with `applies: [{kind: physicalStatus, status:
    knockdown, forced: true}]` and `buffs: [{buff: prep_ingredients, if:
    {talentAtLeast: [1, 1]}}]`.
- **Triggers:**

```json
[
  { "id": "combo_window", "on": { "event": "vulnerable", "minStacks": 4 }, "by": "anyone", "do": [{ "kind": "openCombo" }] },
  { "id": "reduce_and_thicken", "on": { "event": "physicalStatus", "statuses": ["crush", "breach"] }, "by": "self",
    "beforeDamage": true, "if": { "talentAtLeast": [0, 1] },
    "do": [{ "kind": "buff", "buff": "reduce_and_thicken", "layers": { "eventCount": true } }] },
  { "id": "prep_cut", "on": { "event": "hit", "kinds": ["combo"] }, "by": "self", "if": { "buffActive": "prep_ingredients" },
    "maxPerCast": 1, "skill": "chr_0018_dapan_ultimate_skill",
    "do": [
      { "kind": "cooldown", "who": "self", "skills": "combo", "fraction": { "product": [-1, "talent_1_cd_reduce"] } },
      { "kind": "endBuff", "buff": "prep_ingredients", "layers": 1 }
    ] },
  { "id": "ult_lift", "on": { "event": "cast", "skills": ["chr_0018_dapan_ultimate_skill"] }, "by": "self",
    "do": [{ "kind": "apply", "applies": [{ "kind": "physicalStatus", "status": "lift", "forced": true }] }] }
]
```

Scratch run (P5, Ancient Canal 9/9/9, Grizzled Edge ×3 + a Bonekrusha
piece at artifice 3; alone against Rhodagn; battle skill, ultimate,
combo, attacks 1–4, battle skill ×2, attacks 1–4, battle skill): 313,233
damage in 29.9 s. The first battle skill leaves 2 Vulnerable (P5), the
ultimate's Lift and Knock Down bring it to 4 and open the combo window at
f123, whose Crush (level 4 × 1.2) gives 4 layers of talent 1 (+0.24),
Ancient Canal +0.56 and Grizzled Edge +0.24 to both the combo hit and the
Crush; Prep Ingredients (30 s, max 3 at P5) cuts the combo's cooldown from
frame 699 to 471. With OBJ Heavy Burden: 212,611, and its DEF buff from
f123.

P1 waits on N1 (kills): not in the kit (its buff and listener would be a
`kill` trigger on the ultimate's frames 0–89).

### Equipment kits

- **wpn_claym_0014** (Ancient Canal): loads and runs as checked.

```json
{
  "buffs": [{ "id": "wpn_claym_0014.phys", "label": "Brutality: Lands of Yore (Physical DMG)", "target": "self",
    "gameBuff": "buff_wpn_claym_0014_pdi_up", "duration": "duration", "maxStacks": 2,
    "modifiers": [{ "attr": 50, "value": { "product": ["phy_dmg_up_mult", { "eventCount": true }] } }] }],
  "triggers": [{ "id": "wpn_claym_0014.on_consume", "on": { "event": "physicalStatus", "statuses": ["crush", "breach"] },
    "by": "self", "beforeDamage": true, "skill": "sk_wpn_claym_0014",
    "do": [{ "kind": "buff", "buff": "wpn_claym_0014.phys" }] }]
}
```

  `maxStacks: 2` is G2's interim; drop it if G2 is implemented as a
  loader rule for stackingType 1.
- **wpn_claym_0015** (OBJ Heavy Burden): buff `wpn_claym_0015.def` (self,
  `gameBuff: buff_wpn_claym_0015`, `duration`, **no modifier** until G1),
  triggers `on: {event: physicalStatus, statuses: [knockdown]}` and `on:
  {event: buffApplied, categories: [weakness]}`, both `by: self`,
  `cooldown: "cd"`, `skill: sk_wpn_claym_0015`. Loads. With G1 its
  modifier becomes `{attr: 3, value: "def_up", percent: true}`.

## Kit (2026-10-20)

Written against the engine after batch 3's shared features (T1–T4, V2–V4,
B1, B2, A1–A4, C1, D2–D4, S1–S4, N1) and the current `efsim kit-draft`.
No engine, loader, compiler or shared code was changed.

### Re-analysis

| Report item | Now | How |
|---|---|---|
| Rows 1, 4–7, 9, 10, 12, 14, 16, 17, 19, 22, 24, 27–30 | supported | as in the table above; checked in tests/kit-dapan.test.ts |
| Row 2 (Final Strike poise, controlled only) | done (D2) | compiled: `poise: "poise"`, `poiseControlledOnly: true`, `finalStrike: true` |
| Row 3 (finisher factors) | done (D2) | compiled: `factor` 0.4 / 0.6 |
| Rows 7, 14 (battle skill and combo poise) | done (D2) | compiled |
| Row 8 (battle skill Lift, not forced) | done (D2) | compiled `physicalStatus lift` |
| Row 11 (P5's extra Vulnerable once per 45 s) | done in part (D3) | the compiler gives the `vulnerable` application on the frame-43 hit (its conditions only as a note: CheckTimedMarker isn't sayable); the kit hand-writes the `if` (`potentialAtLeast 5`, not `p5_interval`) and the 45 s marker buff `p5_interval`. Order kept: Lift first (in-game test 74) |
| Row 13 (a stack added at 4) | interim (T1 done) | T1 gives `rising`; the kit keeps the engine's reading (a stack at the cap reopens the window, as in-game test 64 says "Engine: yes"). If 64 says dark, add `rising: true` to `combo_window` |
| Row 15 (Crush × `crush_multi`) | done (D2) | compiled `multiplierKey: crush_multi` |
| Row 18 (ultimate f0 forced Lift) | done (D3) | compiled as the cast trigger `ultimate_skill_f0` (the compile test reads only hits' applications: a KNOWN entry) |
| Row 20 (dunk forced Knock Down) | done (D2) | compiled |
| Row 21 (talent 1, Reduce and Thicken) | hand-written (D4 open: talents' attached buffs and their triggers) | buff `reduce_and_thicken` (`gameBuff` → shared timer, B3 interim) and trigger on `physicalStatus` crush / breach, `beforeDamage`, `layers: {eventCount: true}` |
| Row 23 (talent 2, Prep Ingredients) | hand-written (D4 open) | buff `prep_ingredients` on the dunk, `if: {talentAtLeast: [1, 1]}` |
| Row 25 (what "shortens by 40%" means) | interim | 40% of the full cooldown (engine-wide reading; in-game test 36, Da Pan part) |
| Row 26 (P1, a kill by the ultimate) | open (N2, deferred) | not in the kit: no effect against a boss |
| E1, E2, E4–E7, E9 | supported | as above |
| E3 (G2: instances by priority) | done (B1) | the loader gives `wpn_claym_0014.phys` `instances: 2` from maxStackCnt; the kit's `maxStacks: 2` interim is gone (the loader refuses it now) |
| E8 (G1: DEF %) | done (V4) | `{attr: 3, value: "def_up"}`; the loader sets `percent` from formulaItem 6 |

Still open and shared (not implemented here): N2 (kills: P1), B3 (the
stackingType 8 timer of talent 1's layers and Prep Ingredients: test 62),
T5 (a trigger during the combo's own cooldown: the window is ignored then),
D4's talent buffs (hand-written, as in batch 2), P1 of the batch table
(a Knock Down on an enemy without Vulnerable fires no OBJ Heavy Burden:
test 39's question).

### What was written

- `packages/data/kits/operators/chr_0018_dapan.json`: the kit plan's kit,
  from today's kit-draft (its frames, keys, poise, factors, statuses, the
  f0 cast trigger and the basic attacks' controlled-only `sp`), plus the
  talents' buffs and triggers, P5's `if` and marker, and the combo window.
  Hit IDs: `charge` / `flip` (battle skill), `flurry` ×6 / `dunk`
  (ultimate).
- `packages/data/kits/equipment/wpn_claym_0014.json` (Ancient Canal):
  the plan's kit without `maxStacks` (B1).
- `packages/data/kits/equipment/wpn_claym_0015.json` (OBJ Heavy Burden):
  the plan's kit with the DEF modifier (V4).
- `tests/kit-dapan.test.ts` (17 tests): every skill's hits and frames, the
  finisher factors, the Final Strike's poise and SP, P5's order (2 stacks,
  no Lift, a 45 s marker; P4: 1 stack), the battle skill's team energy at
  frame 43, the ultimate's forced Lift and Knock Down, Prep Ingredients
  (30 s, max 3 at P5; 20 s, max 2 at P1; none without talent 2), the
  combo window at 4 stacks and its reopening at the cap (interim), the
  Crush (level 4 × 1.2), talent 1's 4 layers (0.06; 0.04 at level 1) and
  Ancient Canal's 0.56 on both the combo hit and its Crush, the cooldown
  cut (cast + 570 − 228 frames; 570 without talent 2), no P1 buff, Ancient
  Canal's `instances` 2, and OBJ Heavy Burden on Da Pan (the dunk) and on
  Catcher (her ultimate's Weakness, refreshed by its Knock Down; her P1
  strikes gain 5 × 0.504 × her DEF line).
- `packages/data/test/skillCompile.test.ts`: Da Pan in OPERATORS, one KNOWN
  entry (the f0 Lift is a cast trigger; the test reads only hits).

### Verification

No fixture has Da Pan, Ancient Canal or OBJ Heavy Burden: no `zmdlogs`
run is possible. The kit plan's scratch scenario (P5, Ancient Canal 9/9/9,
Grizzled Edge ×3 + a Bonekrusha piece at artifice 3, alone against
Rhodagn; battle skill, ultimate, combo, attacks 1–4, battle skill ×2,
attacks 1–4, battle skill) gives the same as in the plan: **313,233** in
29.9 s (10,465 DPS); with OBJ Heavy Burden **212,611**. The engine casts
the ultimate at frame 43 of the first battle skill (its priority lets it
cut the skill once the flip has landed), so the f0 Lift comes at 1.43 s,
right after the battle skill's two stacks: 3 stacks, then 4 at the dunk
(4.10 s), which opens the combo (cast 4.30 s); its hit (30,746) and Crush
(122,680) carry talent 1's +0.24, Ancient Canal's +0.56 and Grizzled Edge's
+0.24. Timings fit the data: the flurry at 42–61 and the dunk at 80 from
the ultimate's cast, the combo hit at 23. With OBJ Heavy Burden its DEF
buff starts at the dunk (4.10 s) and lasts 15 s; it changes no number of
his (no DEF-based hit; damage taken isn't simulated).

Every example total and every `zmdlogs check` / `zmdlogs reactions`
output (fixtures and fixtures/pending) is byte-identical before and after
the kit.

### In-game tests the kit depends on

- **74** (P5's stack and the Lift: the kit judges the Lift first).
- **64**, Da Pan part (a stack added at 4 reopens the combo window).
- **51**, Da Pan part (talent 1 and Ancient Canal on the combo's own hit
  and its Crush).
- **36**, Da Pan part (Prep Ingredients cuts 40% of the full cooldown).
- **62** (stackingType 8 timer: talent 1's layers, Prep Ingredients).
- **39**'s Vulnerable-only part (batch 3 P1: OBJ Heavy Burden on a Knock
  Down that only adds a stack).
