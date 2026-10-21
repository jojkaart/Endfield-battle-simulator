# Lifeng (chr_0015_lifeng): batch-4 analysis

Phase 1 (analysis only), 2026-10-20. Operator: Lifeng, 6-star Physical
polearm (CharGrowthTable `charTypeId` Physical, `weaponType` 5, main
attribute Agility 40, secondary Strength 39, `defaultWeaponId`
wpn_lance_0009). Weapons covered: wpn_lance_0007 Beacon of Duty,
wpn_lance_0009 Opero 77, wpn_lance_0011 JET.

Sources: rmxlinux TableCfg (CharGrowthTable, SkillPatchTable,
CharacterPotentialTable, PotentialTalentEffectTable, WeaponBasicTable,
I18nTextTable_EN) and Json/SkillData `chr_0015_lifeng_*` (16 files),
Json/BuffData `buff_chr_0015_lifeng_*` (12 files), `sk_wpn_lance_00{07,09,11}`,
`buff_wpn_lance_00{07,09,11}*`. Every file needed is in the checkout.
`efsim kit-draft chr_0015_lifeng` was the starting skeleton. Draft kits
(operator and three weapons) were written and loaded in a scratch copy
(section "Kit plan").

## Skill texts (CharGrowthTable + I18nTextTable_EN)

- **Basic (Ruination):** "An attack with up to 4 sequences … As the
  controlled operator, Final Strike also deals {poise} Stagger." Finisher,
  dive as usual.
- **Battle skill (Turbid Avatar):** "Swings the polearm multiple times to
  deal 2 hits of Physical DMG, then slams the ground to deal Physical DMG
  and Knock Down … If the enemy struck by the last hit of this skill has no
  Vulnerability stacks, apply Physical Susceptibility to the said enemy as
  well."
- **Combo (Aspect of Wrath):** "COMBO TRIGGER: When the controlled operator
  performs a Final Strike on an enemy with Physical Susceptibility or
  Breach. Unleashes an aspect that performs a spear thrust to deal Physical
  DMG and grants Link."
- **Ultimate (Heart of the Unmoving):** two slams, each Physical DMG and
  Knock Down, "If the skill consumes a Link, then it deals an additional
  hit of massive Physical DMG."
- **Talent 1 (Illumination):** "Every point of Intellect and Will further
  grants ATK +{atk_up}" (0.10% / 0.15%).
- **Talent 2 (Subduer of Evil):** "Applying Knock Down also deals
  {atk_scale_talent2} ATK of Physical DMG" (50% / 100%).
- **P1:** battle-skill Susceptibility +5%, and it also applies to enemies
  with no more than {num} (2) Vulnerability stacks. **P2:** all attributes
  +15. **P3:** talent 1 +0.05% per point. **P4:** ultimate cost −15%.
  **P5:** "Every 15s, the next effect triggered [talent 2] deals another
  250% ATK of Physical DMG and 5 Stagger."

Values at level 12 (SkillPatchTable): attack1 0.27 ×2, attack2 0.65,
attack3 0.79, attack5 0.39 + 1.13 (poise 19, atb 21), finisher 9.0, dive
1.8, dash 1.01; battle skill 0.86 ×2 + 2.68 (poise 10), `phy_resist_down`
0.12, `duration` 12, cost 100 SP; combo 1.05 + 3.75 (poise 10), usp 10,
`duration` 20, cooldown 15 s; ultimate 4.0 + 4.0 + 6.0 (poise 5 each), cost
90 energy, cooldown 15 s.

## Mechanics

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| 1 | Basic chain attack1 → attack2 → attack3 → attack5 (ComboCacheAction in each file; skill group lists 1, 2, 3, 5). `chr_0015_lifeng_attack4` has SkillPatchTable rows (display 1.09) but no SkillData file and isn't in the group (also noted in batch-1 Si's report) | supported | four basic skills; attack4 unused |
| 2 | attack1: two DamageActions f9, f17, `atk_scale` each, SP `atb` × 0.5 each, controlled only (atb 0) | supported | `count: 2`, compiled |
| 3 | attack5 (sequence 4): f13 `atk_scale`; f24 Final Strike `atk_scale2` (mask 2097280, poise unit onlyEnableForMainChar), SP atb 21 controlled only; a third DamageAction at f24 with a literal-0 scale and mask 0 | supported / **data** | kit-draft emits the literal-0 unit as `hit_3` **with the same SP again** (42 SP per chain instead of 21): the kit drops it, as the Endministrator's combo did. Compiler: skip zero-scale damage units, attach one ObtainCostAction once (D3 family) |
| 4 | Finisher: f6 / f33, BreakingAttackCalculation 0.1 / 0.9 of `atk_scale`; GainBreakingAttackAtb | supported | compiled `factor`s; finisher SP is the engine's |
| 5 | Dive attack (plunging_attack_end f1) | supported | kept for calc; not schedulable (S10) |
| 6 | Dash attack (`chr_0015_lifeng_dash_attack`, skillSpecification 7, poise 5) | deferred | S5 |
| 7 | Battle skill hits: f7, f20 (`atk_scale`, main target), f54 slam (`atk_scale2`, poise) with KnockDownAction (1.5 s, not forced); `buff_common_obtain_ultimate_sp` at f54 | supported | compiled hits, `applies: knockdown`, `teamEnergy` f54 |
| 8 | Battle-skill Physical Susceptibility: f54 ForEach target → CheckBuffStackNumByTag (Vulnerable tag 1075718177) compareType 1 (at most) `num` (0; P1 sets 2) → CreateBuff `buff_chr_0015_lifeng_purify` (VulnerableAction subType 2, rate `phy_resist_down`, `duration`; stackingType 2 max 1). This timeline item comes **before** the KnockDownAction and the slam's DamageAction | supported (**data**) | A hit's `buffs[].if` is judged after the hit's own `applies` (timeline.ts landHit), so it would see the slam's own Vulnerable stack. Exact instead: `vulnerable` triggers, `fromKinds: [battle]`, `beforeDamage: true` — P0 `fromNone: true`; P1 `rising: true` with `not enemyVulnerable 4` (≤ 2 before = ≤ 3 after a rising stack). The slam's Knock Down always adds a stack below 4, so this equals the data's check. Literal thresholds behind `potentialAtLeast` (batch-3 review: "a stack compared with a value", open). kit-draft only notes the condition |
| 9 | The slam itself takes its Susceptibility (created before the DamageAction) | supported (test 51's question) | `beforeDamage: true` on the trigger |
| 10 | Two Physical Susceptibility sources (Estella's combo, Lifeng's) | unknown | test 38's question; same `gameBuff` as Estella's kit (`buff_common_affixes_vulnerable_physical`, assumed logged name) |
| 11 | Combo trigger: controlled operator's Final Strike on an enemy with Physical Susceptibility or Breach | supported | trigger `on: {event: hit, finalStrike: true}`, `by: controlled`, `if: any[enemyModifier {susceptibility, physical}, enemyPhysical breach]` (as Avywenna's) |
| 12 | Combo hits: f19 `atk_scale`; f48 `atk_scale2`, poise, ObtainCostAction usp 10; TimeDilation `ComboSkill` | supported | compiled |
| 13 | Combo "grants Link": **ComboAction** at f19 (count 1, duration = the combo's `duration`, 20 s; SkillPatchTable sub-description "Combo Duration (s) 20") | **gap** | G2: the engine gives *every* combo a 15 s Link at its cast (timeline.ts, `LINK_FRAMES`); in the data only Lifeng's and Camille's combos have a ComboAction |
| 14 | Link duration 20 s (ComboAction) vs the Link buff's own literal 15 s (`buff_common_affixes_combo_trigger` duration, useBlackboardKey false) | unknown | part of G2; in-game test L-C |
| 15 | Ultimate: time stop (UltimateTimeAction 0–56), SpawnAbilityEntity at 58 (`chr_0015_lifeng_ultimate_skill_abentity`): entity f6 KnockDownAction (2.1 s) + PullAction + DamageAction `atk_scale1` (poise); f66 KnockDownAction + `atk_scale2` (poise2); f121 `atk_scale3` (poise3). Cast frames 64, 124, 179. AllowNextSkill battle / combo 66–80, channel 0–70 | supported | compiled hits with `launch: 58` (detached); Knock Downs as `applies` |
| 16 | Ultimate's third hit only if the cast consumed a Link: entity f67 IfElse `isCombo = 0` → JumpToAction 150 (skips f121), else `EntityBB_isCombo` = 0. The ultimate copies `isCombo` from `EntityBB_isCombo` at frames 1–3; `buff_chr_0015_lifeng_passive` sets it to 1 on abilityEvent 9 (a buff added to her) when the buff is `buff_common_affixes_skillimbue_atk` (Link used by her cast), and to 0 on abilityEvent 31 | **gap** | G1: no predicate for "this cast used Link" (`buffActive` and `operatorModifier` skip cast-bound buffs, which is how the engine's Link is held). kit-draft notes the jump but leaves the hit unconditional. Interim: always lands |
| 17 | Link's own bonus on the ultimate (+20/30/40/50%, mask 768 hits of that cast) and on her battle skill | supported | engine Link (`buff_common_affixes_skillimbue_atk`) |
| 18 | Ultimate cost 90; P4 cost × 0.85 (skillParamModifier paramType 1) | supported | stat panel skill params |
| 19 | Talent 1: attached skill `chr_0015_lifeng_talent_1` (castType 1) whose SkillData `buffs` creates `buff_chr_0015_lifeng_talent_1` (assign `atk_up`): attributeModifiers 78 (formulaItem 5) and 79 (formulaItem 0) = `atk_up` | **gap** | G3: the stat panel already adds attributes 76–79 to the attribute bonus (stats.ts, `AtkIncreaseFactorFrom*`), but a talent's attached skill only records its blackboard: the buff is never applied and isn't even listed under "Not in this panel" (`efsim calc`) |
| 20 | Talent 1's reading: attribute bonus (engine's model of 78/79, "not yet verified") or ATK% | unknown | test L-E; +13% vs +33% ATK at P0 |
| 21 | Talent 2: `buff_chr_0015_lifeng_talent_2` abilityEvent 40 (applying Knock Down; no other file uses 40) → DamageAction `atk_scale_talent2`, damageType 0, no decorate mask, no poise; no cooldown (triggerInterval 1 s with no tick handler) | supported | trigger `on: physicalStatus [knockdown]`, `by: self`, `if: talentAtLeast [1,1]`, hit `scaleValue {talent: 1, key}`, `damageType: none` |
| 22 | Talent 2 on a Knock Down that only adds a Vulnerable stack (enemy had none) | unknown | batch-3 P1 (engine: no event). abilityEvent 40 isn't 401, so the answer may differ; test L-D (a part of test 39) |
| 23 | P1: `phy_resist_down` +0.05 (skillBbModifier add), `num` = 2 | supported | stat-panel skill values; row 8's P1 trigger |
| 24 | P2: attributes 39–42 +15 | supported | stat panel |
| 25 | P3: talent 1's `atk_up` +0.0005 (skillBbModifier on chr_0015_lifeng_talent_1) | **gap** | inside G3 |
| 26 | P5: attaches `buff_chr_0015_lifeng_potential_5` (interval 15, `atk_scale_potential5` 2.5, `poise_potential5` 5): lifeType 1, waitFirstTriggerInterval, its first tick (15 s) creates `_potential_5_1` (if talent 2's buff is there) and finishes itself; talent 2's handler with `_5_1` deals `atk_scale_talent2 + atk_scale_potential5` in one DamageAction with poise 5, finishes `_5_1` and re-creates `_potential_5` | supported (**data**) | buffs `p5_timer` (`every`) and `p5_ready`, triggers `fightStart`, `buffTick`, and two `hits` actions in the talent-2 trigger. Talents' attached buffs and triggers aren't compiled (D4, open). `_potential_5_2`, `_vfx` and SkillData `chr_0015_lifeng_potential_5` are referenced by nothing |
| 27 | Log keys: her ultimate's DamageActions are all in `chr_0015_lifeng_ultimate_skill_abentity`; `chr_0015_lifeng_ultimate_skill` holds none. Talent 2's hit is in `buff_chr_0015_lifeng_talent_2` | unknown | assumed by the compiler's rule (the file holding the DamageAction; logs show it for other entity and buff hits: Si's `_abilityrange`, `buff_equipsuit_physuit_01`). See "Valiant's log key" below |
| 28 | Unused data: `buff_chr_0015_lifeng_normal_skill_debuff` (an older Susceptibility on Final Strikes, attribute 80) and `_icon`, `_combo_skill_tutorial_marker`, `buff_common_train_*_lifeng` | n/a | referenced by no skill (or tutorial only) |

Weapons:

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| W1 | Beacon of Duty skills 1–2 (Agility, Ultimate Gain Efficiency) and skill 3's Heat DMG +`fire_dmg_up` (cardAttributeModifier attribute 51) | supported | stat panel |
| W2 | Beacon of Duty: abilityEvent 126 + CheckOriginSkillType [2, 6, 7] + CheckSpellInflictionType mask 1 (Heat) → `buff_wpn_lance_0007_dmgup` on the wielder: Physical and Heat DMG (attributes 50, 51) +`dmg_up` (0.224 at L9) for 20 s | supported | `inflictionApplied` [fire], `fromKinds` [battle, combo, ultimate], `beforeDamage`, as Solemn Phalanx; an infliction forming a reaction: open "Arcane R3" / test 35 |
| W3 | Beacon of Duty: abilityEvent 206 + CheckBuffIdInContext tag 458037917 (on `buff_common_affixes_vulnerable_fire`, `_spell`, `_all`: Heat, Arts or all Susceptibility) + origin [6, 7, 2] → `buff_wpn_lance_0007_dmgup2` on the whole team (CharacterTeamFinder): Physical and Heat DMG +`dmg_up2` (0.112) for 30 s | **gap** | G4: `buffApplied` filters `categories` but not the element; interim `gameBuffs` (common affix names only) |
| W4 | Beacon of Duty: both buffs stackingType 4 with `priorityKey pd_up` / `maxStackCntKey max_stack` (keys the weapon doesn't have): one instance, refreshed | supported | plain buffs; two wielders' team buffs adding is B2's open part |
| W5 | Opero 77: main attribute +`mainattr`; `sk_wpn_lance_0009` cardAttributeModifier attribute 2 formulaItem 7 (flat ATK +33.6 at L9) | supported | stat panel (`efsim calc`: "33.60 flat"); kit with sources only, as Tarr 11 |
| W6 | JET skills 1–2 (main attribute, ATK%) and skill 3 Arts DMG +`spell_dmg_up` (attributes 51–54) | supported | stat panel |
| W7 | JET: abilityEvent 30 + CheckSkillType [2] → `buff_wpn_lance_0011_normal_magic_up` (Arts DMG +`spell_dmg_up2`, 15 s); [6] → `_combo_magic_up` (+`spell_dmg_up3`, 15 s); stackingType 4 each, separate | supported | `cast` triggers `kinds: [battle]` / `[combo]` |

Signature fit (equipment is generic, so only a note for the merge): none of
the three is Lifeng's. Beacon of Duty needs Heat Inflictions and Heat
Susceptibility: Camille is the only Heat polearm operator (CharGrowthTable
weaponType 5: Lifeng, Avywenna, Camille, Estella, Liino). JET buffs Arts
DMG after battle skills and combos: an Arts polearm's (Liino, Avywenna or
Camille). Opero 77 is a 3-star stat stick and Lifeng's default weapon. The
polearm that fits her kit is Valiant (wpn_lance_0010, batch 1): an extra
Physical hit on each physical status she applies, i.e. on every Knock Down.

## Valiant's log key and Lifeng's ultimate

Batch 1 found Estella's Valiant hit logged as `chr_0015_lifeng_ultimate_skill`
(fixtures/zmdlogs-4e5e1390085e.json, 5 hits by chr_0021_whiten at her 5
Lifts; the kit lists both keys, packages/data/kits/equipment/wpn_lance_0010.json).
Checked against Lifeng's data:

- Nothing in the data links them: `sk_wpn_lance_0010` mentions no Lifeng
  file and Lifeng's files mention no Valiant. The label is ZMDLogs' own.
- `chr_0015_lifeng_ultimate_skill` (SkillData) has **no** DamageAction: its
  three hits are in `chr_0015_lifeng_ultimate_skill_abentity`, and the
  logged entity hits are under the entity file's name (Si's
  `_ultimate_skill_abilityrange` in 40d9 and b7b3, Typhoeus's
  `_arrowrain_sub1/2` in d9e5 and dbae). So Lifeng's own ultimate hits are expected
  as `chr_0015_lifeng_ultimate_skill_abentity`, and the alias doesn't
  collide with them. The draft kit uses only that key (row 27, unknown
  until a Lifeng log).
- Lifeng can wield Valiant (a polearm). Her Valiant hits would then be
  logged as `chr_0015_lifeng_ultimate_skill` by Lifeng, which the Valiant kit
  already matches. Her ultimate hits must not list that key as an alias
  (it would make the two indistinguishable by key).
- `zmdlogs check` on 4e5e with the draft kits loaded is identical to the
  main checkout's (Estella 41 hits: 26 match, 15 under unmodelled effects).

## Gaps

### G1. "This cast used Link" as a condition

- **family:** conditions
- **feature:** predicate `{castLink: {atLeast?: n}}` (default 1): true for a
  hit whose cast used at least n Link stacks (the engine's cast-bound
  `link` buff for that cast, KitBuff.link stacks included), judged per hit
  from the hit's cast, so detached entity hits (`launch`) see their own
  cast. False for trigger hits not of a cast.
- **evidence:** `chr_0015_lifeng_ultimate_skill_abentity` frame 67 IfElse
  (CompareFloat `isCombo` = 0 → JumpToAction 150); ultimate frames 1–3
  (`EntityBB_isCombo` = 1 → `isCombo` = 1); `buff_chr_0015_lifeng_passive`
  abilityEvent 9 + CheckBuffIdInContextAdvanced
  `buff_common_affixes_skillimbue_atk` → `EntityBB_isCombo` = 1;
  description "If the skill consumes a Link, then it deals an additional
  hit". Other users to check (claims for Rossi's report):
  `chr_0028_wulfa_normal_skill` has a dynamic key `skillimbue`, and
  `sk_wpn_sword_0012` (Thermite Cutter) checks
  `buff_common_affixes_combo_trigger` in context.
- **impact:** the third hit is 6.0 × ATK of the ultimate's 14.0 (43% of its
  multipliers; under Link ×1.2–1.5 more). Interim "always" overstates every
  ultimate cast without Link by that much; "never" would understate the
  normal combo → ultimate rotation.

### G2. Link only from a ComboAction, with its count and duration

- **family:** buff lifecycle (engine-wide; owner first, per
  kit-process "Deferring": it touches every team)
- **feature:** a Link stack comes only from a skill whose SkillData has a
  `ComboAction` (count, duration), at that action's frame, lasting its
  duration (or the Link buff's 15 s: row 14), instead of from every combo
  at its cast (timeline.ts `if (costs.kind === "combo") … LINK_FRAMES`).
  Compiled by the loader into SkillTiming (e.g. `linkGrants: [{frame,
  count, seconds}]`); a combo without one grants nothing. KitBuff.link
  (Akekuri's talent) stays as is.
- **evidence:** ComboAction occurs in exactly three SkillData files:
  `chr_0015_lifeng_combo_skill` (f19, count 1, `duration` 20 s),
  `chr_0033_camille_combo_skill` (f47) and `_combo_skill_2` (f70)
  (`combo_duration` 15 s). Lifeng's description says her combo "grants
  Link" (redundant if every combo did). Logs: the only logged Link is from
  Camille (zmdlogs-40d9a3c1da37, Gilberta's ultimate ×1.2000, provenance
  note). In zmdlogs-b7b3762d5da8 Arcane's ultimate at 7150 ms comes 2.0 s
  after Tangtang's combo hit (5137 ms) and her own combo's seal (4953 ms)
  with no battle skill or ultimate cast in between except Si's ultimate
  (hits 4770–5688); `zmdlogs check` matches all 13 of Arcane's and all 21
  of Si's hits with no Link factor, so neither combo left a Link that
  either ultimate used (the engine would give +20–30%).
- **impact:** the engine adds +30–75% to every battle skill and +20–50% to
  every ultimate cast within 15 s of *any* combo; in the data only
  Lifeng's and Camille's combos do that. Searches currently favour combo →
  battle skill orders for every team. docs/data-sources.md's Link
  paragraph and tests 8 and 57 assume the engine's reading.

### G3. A talent's attached passive skill: its permanent buffs in the stat panel

- **family:** data compilation (stat panel)
- **feature:** when a talent (or potential) attaches a skill
  (PotentialTalentEffectTable `attachSkill`, modifyType 1) whose SkillData
  has `castType` 1 and a `buffs` list, the panel applies each listed
  BuffData buff's `attributeModifier` (lifeType 1, no conditions) with the
  blackboard assigned through `assignItems` (from the talent level's
  `attachSkill.blackboard`, after skillBbModifiers on that skill such as
  P3's), like a weapon skill's cardAttributeModifier. Here attributes 78
  and 79 (formulaItem 5 and 0, both read as adds) = `atk_up`; stats.ts
  already turns them into ATK per Intellect / Will point in the attribute
  bonus. Buffs with event handlers stay kit work.
- **evidence:** PotentialTalentEffectTable `chr_0015_lifeng_talent_1_1/_2`
  (attachSkill `chr_0015_lifeng_talent_1`, `atk_up` 0.001 / 0.0015);
  SkillData `chr_0015_lifeng_talent_1` `buffs: [buff_chr_0015_lifeng_talent_1,
  assign atk_up]`; BuffData `buff_chr_0015_lifeng_talent_1`;
  `chr_0015_lifeng_potential_3` skillBbModifier `atk_up` +0.0005 on that
  skill. `efsim calc` (P0 and P5) shows neither the effect nor a "not in
  this panel" line. No other talent's attached skill has a permanent
  attribute buff (scan of PotentialTalentEffectTable), so this is a loader
  rule with one user today, not a unique mechanism.
- **impact:** every Lifeng hit. With Opero 77 at L90, P0 (Intellect 115.5 +
  Will 117.5, talent 1 level 2): ATK 1,635 → 1,855 (+13.4%) as the engine
  models 78/79; P5 (130.5 + 132.5, 0.002): 1,701 → 2,032 (+19.4%). If the
  game reads it as ATK% instead (U, test L-E): 2,176 / 2,548. Not
  expressible as a kit buff: the `atk` zone is ATK% before the attribute
  bonus, and 78/79 aren't kit-buff attributes (effects.ts READ_ATTRS).

### G4. `buffApplied` by category and element

- **family:** triggers
- **feature:** `on: {event: buffApplied, categories: [susceptibility],
  elements: [...]}`: only buffs whose modifier of that category reaches one
  of the elements (an all-element or all-Arts one counts, as the game's
  tag 458037917 sits on `vulnerable_fire`, `_spell` and `_all`), with
  `fromKinds` as today. The `buffApplied` event carries the elements of its
  category modifiers.
- **evidence:** `sk_wpn_lance_0007` abilityEvent 206 + CheckBuffIdInContext
  checkType 1 tag 458037917. The same check by element in other batch-4
  weapons (claims for their reports): `sk_wpn_funnel_0018` (Junction Point:
  tags 458037917, 1425735059, −1640994543, −575106878), `sk_wpn_claym_0017`
  (Amaranthine Tassel) and `sk_wpn_lance_0012` (Mountain Bearer), tag
  1066759270 (Physical Susceptibility per Estella's kit note). Kit
  Susceptibility buffs name their game buffs after operator files
  (Purrchena's, Antal's, Arcane's), so `gameBuffs` can't stand in.
- **impact:** Beacon of Duty's team +11.2% Physical / Heat DMG for 30 s.
  With `categories` alone it would also fire on Lifeng's own Physical
  Susceptibility (wrong); the interim `gameBuffs` misses
  operator-named Heat / Arts Susceptibility buffs.

### Data (compiler) items, in existing families

- attack5's literal-0 damage unit emitted as a hit, and the f24 SP
  repeated on it (row 3; D3).
- A conditional jump on an ability entity's own timeline, keyed on a
  dynamic blackboard value another buff sets (row 16): noted only; the kit
  hand-writes the hit's `if` once G1 exists (D1 / D3).
- ComboAction isn't read (G2).
- The battle skill's CheckBuffStackNumByTag on the Vulnerable tag before a
  CreateBuff (row 8): noted only.
- Talent 2's abilityEvent 40 handler and P5's buff chain (rows 21, 26):
  talents' attached buffs and their triggers (D4, open).

## Unknowns

- **U1** (row 22): does a Knock Down that only adds a Vulnerable stack fire
  talent 2? Engine: no (P1). Test L-D.
- **U2** (row 14): Link from Lifeng's combo lasts 20 s (ComboAction) or
  15 s (Link buff). Interim with G2: the ComboAction's 20 s (what the
  game's skill panel shows). Test L-C.
- **U3** (row 20): talent 1 in the attribute bonus or as ATK%. Test L-E.
- **U4** (row 27): log keys of her ultimate and talent-2 hits. Logs only.
- abilityEvent 31 (resets `EntityBB_isCombo`) is also used by
  `*_interruptcheck` and `buff_common_train_*` buffs: read as "skill ended";
  it only matters if a stale flag could carry from a Linked battle skill to
  a later ultimate, which the reset prevents either way.

## Verification

- **Logs:** no fixture has Lifeng. 4e5e's `chr_0015_lifeng_ultimate_skill`
  hits are Estella's Valiant (above); its check is unchanged with the draft
  kits. A Lifeng log would verify: the ultimate's third hit with and
  without a Link before it (G1), the talent-2 hits' key and value (and
  whether one comes on a Vulnerable-only Knock Down, U1), the
  Susceptibility's value on the slam (row 9), talent 1 through any hit's
  ATK (G3 / U3), and P5's 15 s rhythm. Any log with a battle skill or
  ultimate within 15 s of an ordinary combo checks G2 (b7b3 already does).
- **In-game tests** (by eye, relative; none needs frames):
  - **L-A (high; part of test 8, needs Gilberta and Estella):** Gilberta's
    ultimate on a dummy (a) with no combo in the last 20 s, (b) right after
    Estella's combo, (c) optionally right after Camille's or Lifeng's combo.
    Data and b7b3: (b) = (a), (c) = 1.20 × (a). Engine today: (b) = (c) =
    1.20 × (a). Settles G2's premise for every team.
  - **L-B (if you have Lifeng):** her ultimate with no combo before it
    (2 big numbers) vs right after her own combo (3; the third about 1.5×
    a slam's). Also after only Estella's combo: 2 (data) or 3 (engine).
    Settles G1 / G2 on her.
  - **L-C (if you have Lifeng):** her combo, then her ultimate about 17–18 s
    later: a third hit means the Link lasted 20 s; none means 15 s (U2).
    (Cast nothing else in between; 2–3 s margins either side.)
  - **L-D (if you have Lifeng; part of test 39's P1 question):** her battle
    skill on a fresh dummy (no Vulnerable): an extra small Physical number
    (50–100% ATK) at the slam, or none (engine); a second battle skill shows
    one either way (U1).
  - **L-E (if you have Lifeng; like tests 55 and 75):** her stat-panel ATK
    against `efsim calc` for the same build. Today's calc lacks talent 1, so
    the panel should read about 1.13× calc at P0 / 1.19× at P5 (attribute
    bonus) or about 1.33× / 1.50× (ATK%) for the Opero 77 build above (U3,
    G3).
  - Cross-references: test 51 (an effect on its own hit: the slam's
    Susceptibility), test 38 (two Physical Susceptibility sources).
- **Weapons:** no logs. Beacon of Duty and JET need no test beyond test 35's
  reaction question (W2).

## Kit plan

Draft files, written and loaded in the scratch copy
(/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-chr_0015_lifeng/repo):
`packages/data/kits/operators/chr_0015_lifeng.json` and
`packages/data/kits/equipment/wpn_lance_0007.json`, `wpn_lance_0009.json`,
`wpn_lance_0011.json`. **They load:** `efsim calc` lists every hit (L12,
P5: slam 2.68, ultimate 4 / 4 / 6), `packages/data/test/kits.test.ts` and
`skillCompile.test.ts` pass (the latter needed `--testTimeout` under the
batch's load), and two 30 s scenarios simulate (P5 + JET, P0 + Beacon of
Duty): the first slam on a fresh enemy carries the Susceptibility
(×1.17 at P1+ / ×1.12 at P0 against a later slam), the combo opens on the
Final Strike under it, talent 2 fires on each real Knock Down (not on the
first, Vulnerable-only one), and at 18.8 s the P5-charged talent hit is
3.5× the plain one.

**Operator kit** (`element: physical`; talents: 0 Illumination, 1 Subduer of Evil):

- Skills (keys, frames, events as kit-draft, with the changes noted):
  - attack1 `hit` ×2 f9/f17, SP `{if controlled, then atb × 0.5}`; attack2
    f4; attack3 f11; attack5 `hit` f13 (`finalStrike: false`), `hit_2` f24
    `atk_scale2`, poise controlled only, Final Strike, SP atb controlled;
    kit-draft's `hit_3` dropped (row 3).
  - power_attack f6 / f33 factors 0.1 / 0.9; plunging_attack_end f1.
  - normal_skill: `hit` ×2 f7/f20; `slam` f54 `atk_scale2`, poise,
    `applies: [{physicalStatus knockdown}]`; `teamEnergy [{frame 54, ratio 1}]`.
  - combo_skill: f19 `atk_scale`; f48 `atk_scale2`, `energy: usp`, poise.
    Link: the engine's (G2 would move it to f19 and 20 s).
  - ultimate_skill: `slam` f64, `slam_2` f124 (Knock Down each), `link_hit`
    f179, all `launch: 58`, event `chr_0015_lifeng_ultimate_skill_abentity`.
    With G1: `link_hit.if = {castLink: {}}`; interim none.
- Buffs: `physical_susceptibility` (enemy, gameBuff
  `buff_common_affixes_vulnerable_physical`, `duration`, susceptibility
  physical `phy_resist_down`); `p5_timer` (self, gameBuff
  `buff_chr_0015_lifeng_potential_5`, `every {key interval, skill
  buff_chr_0015_lifeng_potential_5}`); `p5_ready` (self, gameBuff `_5_1`).
- Triggers:

```json
{ "id": "combo_window", "on": { "event": "hit", "finalStrike": true }, "by": "controlled",
  "if": { "any": [{ "enemyModifier": { "zone": "susceptibility", "element": "physical" } }, { "enemyPhysical": "breach" }] },
  "do": [{ "kind": "openCombo" }] },
{ "id": "turbid_susceptibility", "on": { "event": "vulnerable", "fromNone": true, "fromKinds": ["battle"] },
  "by": "self", "if": { "not": { "potentialAtLeast": 1 } }, "beforeDamage": true,
  "skill": "chr_0015_lifeng_normal_skill", "do": [{ "kind": "buff", "buff": "physical_susceptibility" }] },
{ "id": "turbid_susceptibility_p1", "on": { "event": "vulnerable", "rising": true, "fromKinds": ["battle"] },
  "by": "self", "if": { "all": [{ "potentialAtLeast": 1 }, { "not": { "enemyVulnerable": 4 } }] }, "beforeDamage": true,
  "skill": "chr_0015_lifeng_normal_skill", "do": [{ "kind": "buff", "buff": "physical_susceptibility" }] },
{ "id": "subduer_of_evil", "on": { "event": "physicalStatus", "statuses": ["knockdown"] }, "by": "self",
  "if": { "talentAtLeast": [1, 1] },
  "do": [
    { "kind": "hits", "if": { "not": { "buffActive": "p5_ready" } }, "hits": [{ "id": "hit", "scale": [],
      "scaleValue": { "talent": 1, "key": "atk_scale_talent2" }, "element": "physical", "damageType": "none",
      "frames": [0], "events": ["buff_chr_0015_lifeng_talent_2"] }] },
    { "kind": "hits", "if": { "buffActive": "p5_ready" }, "hits": [{ "id": "hit_p5", "scale": [],
      "scaleValue": { "sum": [{ "talent": 1, "key": "atk_scale_talent2" }, { "key": "atk_scale_potential5", "skill": "buff_chr_0015_lifeng_potential_5" }] },
      "poise": { "key": "poise_potential5", "skill": "buff_chr_0015_lifeng_potential_5" },
      "element": "physical", "damageType": "none", "frames": [0], "events": ["buff_chr_0015_lifeng_talent_2"] }] },
    { "kind": "buff", "buff": "p5_timer", "if": { "buffActive": "p5_ready" } },
    { "kind": "endBuff", "buff": "p5_ready" }
  ] },
{ "id": "p5_start", "on": { "event": "fightStart" }, "by": "self",
  "if": { "all": [{ "potentialAtLeast": 5 }, { "talentAtLeast": [1, 1] }] }, "do": [{ "kind": "buff", "buff": "p5_timer" }] },
{ "id": "p5_charge", "on": { "event": "buffTick", "buff": "p5_timer" }, "by": "self",
  "do": [{ "kind": "buff", "buff": "p5_ready" }, { "kind": "endBuff", "buff": "p5_timer" }] }
```

  The action order in `subduer_of_evil` matters: the plain hit is judged
  before `p5_ready` ends.
- Talent 1 isn't in the kit: it belongs in the stat panel (G3).
- Waits on gaps: G1 (`link_hit.if`), G2 (Link from her combo at f19 for
  20 s, and no Link from ordinary combos), G3 (talent 1, P3).

**Equipment kits:**

- `wpn_lance_0009` (Opero 77): sources only (all stat panel).
- `wpn_lance_0011` (JET): buffs `wpn_lance_0011.battle` (self, gameBuff
  `buff_wpn_lance_0011_normal_magic_up`, `duration`, damageBonus
  [fire, pulse, cryst, natural] `spell_dmg_up2`) and `.combo`
  (`_combo_magic_up`, `duration2`, `spell_dmg_up3`); triggers `on: {event:
  cast, kinds: [battle]}` / `[combo]`, `by: self`, `skill: sk_wpn_lance_0011`.
- `wpn_lance_0007` (Beacon of Duty): buffs `.infliction` (self,
  `buff_wpn_lance_0007_dmgup`, `duration`, damageBonus [physical, fire]
  `dmg_up`) and `.susceptibility` (team, `buff_wpn_lance_0007_dmgup2`,
  `duration2`, `dmg_up2`); triggers `inflictionApplied [fire]` with
  `fromKinds [battle, combo, ultimate]` and `beforeDamage`, and, waiting on
  G4, `{event: buffApplied, categories: [susceptibility], elements: [fire],
  fromKinds: [battle, combo, ultimate]}` (interim in the draft: `gameBuffs`
  [`buff_common_affixes_vulnerable_fire`, `_spell`, `_all`]).

## Kit (2026-10-21)

Files: `packages/data/kits/operators/chr_0015_lifeng.json`, equipment
`wpn_lance_0009.json` (Opero 77), `wpn_lance_0011.json` (JET) and
`wpn_lance_0012.json` (Mountain Bearer, moved here from Camille at the
merge; batch-4.md "Weapon owners"); Beacon of Duty (`wpn_lance_0007`)
moved to Camille, so its plan above is hers now. Example
`examples/lifeng-solo.scenario.json` with the build
`examples/lifeng-p5.json` (P5, Mountain Bearer, Swordmancer ×4). Tests
`tests/kit-lifeng.test.ts`; Lifeng is in `OPERATORS` in
`packages/data/test/skillCompile.test.ts` with no disagreement (no KNOWN
entry). Started from a fresh `efsim kit-draft chr_0015_lifeng` and the
draft above. No engine, loader or compiler change.

### Re-analysis

| Item | Now | How |
|---|---|---|
| G1 (the ultimate's third hit only after a Link) | **done** (C1) | `link_hit.if: {castLink: {}}`, judged from the hit's own cast, so the entity hit (`launch: 58`) sees the ultimate's Link. Tested with the combo's Link (three hits), without (two), and just after the Link ran out (two) |
| G2 (Link only from ComboAction) | **done** (B1) | trigger `combo_link`: a cast trigger at combo frame 19 (`delay: 19`, `awaited`) with action `link {count: 1, seconds: duration}` (20 s). U2 (20 s or the Link buff's literal 15 s) stays open: in-game test 78 |
| G3 (talent 1 in the stat panel) | **done** (D4) | nothing in the kit; tested in `tests/batch4-data.test.ts` (D4) and by an ATK check here. `efsim calc` shows it only inside the attribute bonus, with no line of its own (see "Shared layer") |
| G4 (`buffApplied` by element) | **done** (T1) | used by Mountain Bearer (`tags: [1066759270]`, `fromKinds: [battle]`). Beacon of Duty, the weapon G4 was found on, is Camille's now |
| Row 3 (attack5's literal-0 unit, its SP twice) | **done** (D8c) | kit-draft leaves the unit out and gives the SP once |
| Row 5 (dive) | interim | the dive hit is written from the data, but it can't be scheduled until dive attacks land (S10, in progress). Her kit has no dive-triggered effect |
| Row 6 (dash attack) | open | batch-3 S5 (deferred); not in the kit |
| Row 8 (the battle skill's Vulnerable-count check) | interim (exact) | two `vulnerable` triggers with `beforeDamage` (P0: `fromNone`; P1: `rising` and fewer than 4 stacks after). The thresholds are literals behind `potentialAtLeast`, because comparing a stack count with a value is still open (batch-3 review). kit-draft still only notes the condition |
| Row 9 (the slam takes its own Susceptibility) | supported | `beforeDamage`; this is test 51's question |
| Row 10 (two Physical Susceptibility sources) | unknown | test 38's question. The kit buff names `buff_common_affixes_vulnerable_physical`, as Estella's does |
| Row 16 (the entity's `isCombo` jump) | done with G1 | kit-draft still reports the jump as "not followed" and leaves the hit unconditional (compiler item, below) |
| Rows 21, 26 (talent 2, P5's charge) | hand-written | trigger `subduer_of_evil` and buffs `p5_timer` / `p5_ready`, as planned. Talents' attached buffs that have handlers stay kit work (batch-3 D4, D9c) |
| Row 22 / U1 (talent 2 on a Vulnerable-only Knock Down) | unknown | engine: no hit (batch-3 P1); test 39's variant |
| Row 25 (P3 on talent 1) | **done** (D4) | stat panel |
| Row 27 / U4 (log keys) | unknown | `chr_0015_lifeng_ultimate_skill_abentity` and `buff_chr_0015_lifeng_talent_2`, never the Valiant key `chr_0015_lifeng_ultimate_skill` |
| W5 (Opero 77) | done | sources only (flat ATK is in the panel) |
| W6, W7 (JET) | done | two self buffs on battle-skill and combo `cast` events |
| Mountain Bearer (Camille rows 36–40) | done, one effect open | DMG +56% against a Vulnerable enemy (a buff from fightStart, `enemyVulnerable: 1`). All Attributes +22.4% when the wielder's battle skill applies Vulnerable (`vulnerable`, `fromKinds [battle]`) or Physical Susceptibility (T1 `tags`), with `cooldown: cd` for the 0.1 s timed markers. **Open:** the percentages don't reach ATK (batch-3 V4 residue) |

Compiler items seen (data family, not fixed here):
- kit-draft emits no `link` trigger for a ComboAction, so the kit writes it
  by hand from the SkillData frame and keys.
- The entity's IfElse on `isCombo` (which `buff_chr_0015_lifeng_passive`
  sets from the Link buff) isn't compiled to `castLink`.
- The CheckBuffStackNumByTag before the purify CreateBuff is only noted.

### What the kit models

- Every hit at its SkillData frame: battle skill 7, 20, 54; combo 19, 48;
  ultimate 64, 124, 179 (from the entity spawned at 58); attack5 13, 24.
  All hits are Physical. SP, stagger, team energy, the ultimate's two Knock
  Downs and P4's cost (76.5) come from the data.
- Turbid Avatar's Physical Susceptibility (0.12, 0.17 from P1; 12 s),
  applied before the slam's damage to an enemy with no Vulnerable (from P1:
  at most 2 stacks).
- The combo trigger (a Final Strike by the controlled operator on an enemy
  with Physical Susceptibility or Breach) and the combo's Link (one stack,
  20 s).
- Talent 2's hit on each real Knock Down (0.5 / 1.0 × ATK, no skill-type
  bonus, no Link). P5: the first one after each 15 s charge deals
  3.5 × ATK and 5 Stagger, and the charge restarts from it.
- The equipment above.

Left out:
- the dash attack (S5);
- talent 2 on a Vulnerable-only Knock Down (U1, the engine's reading);
- Mountain Bearer's All Attributes reaching ATK (V4 residue). With the
  example build that's about +17% ATK per All Attributes buff (0.224 × the
  attribute bonus's Agility, Strength and talent-1 Intellect / Will parts:
  about +0.79 on 4.51), or +35% with both, for 15 s after each battle
  skill. It's the largest effect missing on her, and talent 1 makes it
  larger for her than for an Agility-main wielder without it.

### Verification

- **Logs:** no fixture has Lifeng. `zmdlogs check` and `zmdlogs reactions`
  give the same output on every fixture with her kits loaded (4e5e's
  `chr_0015_lifeng_ultimate_skill` hits are still Estella's Valiant).
- **Example** (`examples/lifeng-solo.scenario.json`, 30 s solo against
  Rhodagn): 391,096 damage, 14,051 DPS (last hit at 27.83 s). Checked by
  hand:
  - the first slam: 14,960 = 3,662.9 ATK × 2.68 × (1.98 + 0.56 Mountain
    Bearer) × 1.025 crit × 1.17 Susceptibility × 0.5 DEF;
  - the ultimate's slams: 26,794 (the same zones, plus Link ×1.2);
  - the Link hit: 40,191 (× 6 / 4);
  - talent 2: 5,582 per Knock Down (1.0 × ATK);
  - P5's hit: 16,699 at 18.57 s (3.5 × the plain hit without the
    Susceptibility, which had ended by then).

  Her later slams find 3–4 Vulnerable stacks (each lasts 20 s and is
  refreshed), so solo she gets one Susceptibility and one combo per 30 s.
  A Breach teammate consuming the stacks would open both again. Timings:
  2.33 s from the battle skill to the next action, 1.6 s from the combo to
  the ultimate, and the ultimate's hits 2.13 / 4.13 / 5.97 s after its cast
  (time stop 0–56).
- **Tests:** `tests/kit-lifeng.test.ts` (20 tests):
  - frames, hits and scales; the combo window; P4's cost;
  - the Susceptibility: P0 / P1 values, P1's threshold, its 12 s;
  - Link: given at frame 19, lasts 20 s, used by the ultimate, or by a
    battle skill cast before it;
  - the third hit with and without Link;
  - talent 2: levels, unlearned, no Link; P5: scale, Stagger, recharge;
    talent 1 in the panel;
  - Mountain Bearer: DMG against Vulnerable on the hit that adds the first
    stack; both attribute buffs from the battle skill, none from the
    ultimate; the tag trigger;
  - Opero 77's flat ATK; JET on Lifeng (no effect) and on Avywenna (both
    buffs on her Electric hits).

### In-game tests the kit depends on

- **8** (where Link comes from); its option (e) is Lifeng's combo: one
  stack.
- **78** (proposed): Lifeng's Link hit, and whether the Link lasts 20 s
  or 15 s.
- **39**'s variant (proposed): talent 2 on a Vulnerable-only Knock Down.
- **75** / **55**'s variant (proposed): talent 1 in the stat panel, as an
  attribute bonus or as ATK%.
- **38** (two Physical Susceptibility sources), **51** (the slam's own
  Susceptibility).

### Shared layer (noted, not changed)

- The batch-3 V4 residue (a main attribute's percentage reaching ATK) now
  has a large user: Mountain Bearer on Lifeng (above).
- `efsim calc` prints no line for attributes 76–79 (ATK per attribute
  point). The ATK line's "× 4.5110 (Agi 363, Str 429)" hides talent 1's
  +0.84 (design.md principle 10).
