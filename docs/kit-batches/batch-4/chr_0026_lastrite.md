# Last Rite (chr_0026_lastrite): gap report, batch 4

Phase 1 (analysis only), 2026-10-20, at commit 8dbd8f9. Operator: Last
Rite, 6-star Cryo greatsword (CharGrowthTable `charTypeId` Cryst,
`weaponType` 3, main attribute Strength 39, secondary Will 42,
`defaultWeaponId` wpn_claym_0010, which has a kit). Weapons covered:
wpn_claym_0008 Sundered Prince, wpn_claym_0013 Khravengger, wpn_claym_0016
Phantom Pain ([batch-4.md](../batch-4.md)).

Sources (rmxlinux, the submodule's pinned commit): TableCfg CharGrowthTable,
SkillPatchTable, CharacterPotentialTable, PotentialTalentEffectTable,
WeaponBasicTable, CharacterTable, AttributeMetaTable, I18nTextTable_EN;
Json/SkillData `chr_0026_lastrite_*` (12 files), Json/BuffData
`buff_chr_0026_lastrite_*` (13 files), `sk_wpn_claym_00{08,13,16}`,
`buff_wpn_claym_00{08,13,16}*` (9 files). Values are at skill level 12 and
weapon skill level 9 unless noted (SkillPatchTable; SkillData defaults only
for keys the table doesn't set: the battle skill's `atk_up` 0.2, `poise` 5,
`potential_1`; the combo's `usp_base`/`usp`/`count` are in the table).
Frames are SkillData timeline frames (30 FPS) from the cast. The one file
not in the checkout is the dash attack's SkillData
(`chr_0026_lastrite_dash_attack` has a SkillPatchTable row only); it isn't
fetched (S5 is deferred anyway).

Brief claims checked: the three weapon IDs and names (WeaponBasicTable
`engName`) are **confirmed**, all weaponType 3. Last Rite is in
`fixtures/zmdlogs-b7b3762d5da8.json` (with Arcane, Tangtang and Si) and in
no other fixture (`grep lastrite fixtures/ fixtures/pending/`); she wears
Khravengger there. The "unexplained burst timings around 7150 ms"
(batch-1 Arcane report, batch-2 K6, batch-3 L2) are explained below
(Verification, G6b): ultimate time stops the replay doesn't apply, not
Last Rite.

`efsim kit-draft chr_0026_lastrite` was the starting skeleton. It gets the
basic chain, finisher, dive, the ultimate's frames and stagger right, and
the combo's frames, but misreads the battle skill (the jump condition is
inverted, the SP and the second team-energy part are missing, the Mirages
come out as skill hits at fixed frames) and the combo's energy; details in
G5.

## Skill texts (CharGrowthTable + I18nTextTable_EN)

- **Basic (Dance of Rime):** "An attack with up to 4 sequences that deals
  Cryo DMG. As the controlled operator, Final Strike also deals {poise}
  Stagger." Dive and finisher as usual.
- **Battle skill (Esoteric Legacy of Seš'qa):** "Performs a Hypothermic
  Perfusion on the controlled operator's weapon and returns some SP. The
  next Final Strike performed by the currently controlled operator within
  a certain duration creates Last Rite's Mirages that unleash an additional
  attack at the target. This attack deals Cryo DMG and applies Cryo
  Infliction. When the controlled operator is Last Rite herself, casting
  this battle skill does not reset her basic attack sequence."
- **Combo (Winter's Devourer):** "COMBO TRIGGER: When an enemy has {count}
  or more Cryo Infliction stacks. Encases the target enemy in icicles and
  shatters them to consume all Cryo Infliction stacks of the said enemy.
  The number of Cryo Infliction stacks consumed determines the amount of
  Cryo DMG dealt to the said enemy and Ultimate Energy gained by Last
  Rite." (`count` 3; cooldown 9 s, 8 s at level 12.)
- **Ultimate (Vigil Services):** "encases herself in frost armor, creates
  an ice scythe to perform 3 slashes, and gains immunity to all damages
  while this state is active. … Last Rite can only gain Ultimate Energy
  from her own battle skills and combo skills." (Cost 240, 20 s.)
- **Talent 1 (Hypothermia):** "After Last Rite consumes any Arts
  Infliction, she applies Cryo Susceptibility to the target with the
  effect of [Number of Arts Infliction stacks consumed × {crystal_up}] for
  {duration}s. This effect cannot stack." (0.02 / 0.04, 15 s.)
- **Talent 2 (Cryogenic Embrittlement):** "When the ultimate deals DMG to
  an enemy with Cryo Susceptibility, the effect of that Cryo
  Susceptibility is {rate} times the original." (1.2 / 1.5.)
- **Potentials:** P1 "When the controlled operator with Hypothermic
  Perfusion performs a Final Strike that hits the enemy, it deals another
  {atk_up} DMG and {poise} Stagger" (sets the battle skill's `atk_up` 0.2,
  `poise` 5, `potential_1` 1); P2 Strength +20, Cryo DMG +10%; P3 combo
  `atk_scale`, `atk_scale2`, `atk_scale3` and ultimate `atk_scale`,
  `atk_scale2` ×1.15; P4 ultimate cost ×0.85 (204); P5 battle skill `atb`
  +5 and `atk_scale` ×1.2.

## Action types per file

What each file uses that matters for damage, resources, state or timing
(sound, VFX, camera, animation, root motion, rotation, super armour,
teleport, target finding and weapon-visibility actions left out):

| File | Action types that matter |
|---|---|
| attack1–3 | DamageAction (attack1 f12; attack2 f10, f24; attack3 f9, f27), ObtainCostAction costType 1 `atb` (0) inside CheckMainCharacterCondition; AllowNextSkillAction |
| attack4 | DamageAction f21 (mask 2097280: Final Strike) with a poise unit `poise` 25 (onlyEnableForMainChar), ObtainCostAction `atb` 30 if controlled; CheckBuffStackNumAdvanced on the perfusion → `isBuffed` (animation only) |
| power_attack | BreakingAttackCalculation `atk_scale` × 1.0 f40, GainBreakingAttackAtb; skillSpecification 8 |
| plunging_attack_end | DamageAction f2 `atk_scale` 1.8, ObtainCostAction `atb` (0) |
| normal_skill | f0: ModifyDynamicBlackboard `atk_scale` ×0.5; f0 JumpToAction 300 if **NotNextCheckAction + CheckMainCharacterCondition** (not controlled); f6 CreateBuff `_main_start`; f51 MarkCanInterrupt; f187 JumpToAction 429; f300 FinishBuff `_tag`, CreateBuff `_self`, CreateBuff `buff_common_obtain_ultimate_sp`, ObtainCostAction `usp` (useUspRecoverTag 264623624), LaunchProjectile (projhit file empty); exclusiveFrame 373, durationFrame 429; `switchToBuffConfig` asSkillCast: CheckSkillType [0] checkTargetCurSkill mustBeforeExclusiveTime + controlled → `_inattack` |
| buff_…_normal_skill_main_start | 1.5 s; its f26 (skill f32): FinishBuff `_tag`, CreateBuff `_self`, `buff_common_obtain_ultimate_sp`, ObtainCostAction `usp` (her tag) |
| buff_…_normal_skill_inattack | on start: `atk_scale` ×0.5, FinishBuffAdvanced the perfusion, CreateBuff `_self`, team energy, `usp` (her tag) |
| buff_…_normal_skill_self | on start: CreateBuff `buff_chr_0026_lastrite_normal_skill` on **CharacterTeamFinder** (every member), ObtainCostAction costType 1 `atb` (atbGainMethod 1: returned; atbSourceType 3) |
| buff_…_normal_skill (Hypothermic Perfusion) | `duration` 15 s, stackingType 2 max 1; damageModifier (holder controlled, Final Strike, `potential_1` = 1): DamageScaleProcessor NormalCalcZone +`atk_up`; abilityEvent 302 (holder deals damage): [CheckHp, Final Strike, controlled, `potential_1` = 1] DamageAction poise `poise` (no damage); [CheckHp, 0.1 s marker, Final Strike, controlled] IfElse CheckTagMatch 264623624 on the holder → CreateBuff `_phantom_main` else `_phantom` (on the main target), CreateBuff `_tag` on the holder |
| buff_…_normal_skill_tag | abilityEvent 9 (a buff added) + its own stack ≥ 1 → FinishBuff the perfusion and itself (on the holder) |
| buff_…_normal_skill_phantom / _phantom_main | 3 s; f9 / f21: InterruptAction, SpellInfliction Cryo, DamageAction `atk_scale` (assigned ×0.5 value), DamageAction `atk_scale` again (mask 4352: battle); HitStopAction |
| combo_skill | f2 CreateBuff `_combo_skill_hitstop` on the enemy; f0 TimeDilationAction ComboSkill curve 0.6 s (layer 0); f13: SaveBuffStackNumByTag Cryo Infliction (tag 1570888476) → `infliction_num`, DamageAction `atk_scale` (mask 8192), ObtainCostAction `usp_base`, IfElse CheckHp > 0 → ObtainCostAction `usp` × `infliction_num` and `recover_usp` = 1 (both with her tag); f63 ForEach target: SaveBuffStackNumByTag → `final_combo_atkscale` = `atk_scale3` × n, DamageAction (mask 12288), DamageAction `atk_scale2` + poise `poise`, **FinishBuffByTag** Cryo Infliction (all), BlowOffAction; f63 IfElse `recover_usp` = 0 → ObtainCostAction `usp` × min(total, 4); exclusiveFrame 90 |
| buff_…_combo_skill_hitstop | 2 s; TimeDilationAction layer 1, time scale **0**, on the buff owner (the enemy), finishByAction |
| ultimate_skill | UltimateTimeAction 0–85; ChannelingCastingAction 0–170 (cantCastSkill, cantSwitch); CreateBuff `buff_common_damage_immune_ult_skill`; ChannelingAction ticks f86, f105 (DamageAction `atk_scale`, poise `poise1`) and f134 (`atk_scale2`, `poise2`, BlowOffAction), each IfElse `talent_2` = 1 → the damage unit gets **InstantModifyAttribute attribute 73, formulaItem 8, modifyTargetSide 1, `rate`**; TimeDilationActions at 85–145; exclusiveFrame 170 |
| buff_…_passive | lifeType 1: RefrainObtainUsp, refrainObtainUspTags 264623624 |
| buff_…_talent_1 | lifeType 1, abilityEvent 208 (she removes a buff) + CheckBuffIdInContextAdvanced tag −193971080 (Arts Infliction) + CheckConsumeBuffLayer ≥ 1 → `infliction_num`; SimpleCalcBB `crystal_vul` = n × `crystal_up`; CreateBuff `_talent_1_vul` |
| buff_…_talent_1_vul | VulnerableAction subType 5 (Cryo), `crystal_vul`, asChildBuff; stackingType 1, priority `crystal_vul`, max 1 |
| sk_wpn_claym_0008 | abilityEvent 302 + mask 2097152: [NotNextCheckAction, controlled] → `buff_wpn_claym_0008_atk_up` (`atk_up`); [controlled] → the same with `atk_up` × `multi` (2); `buffs`: `buff_wpn_claym_0008` (permanent); toggleBuffs `buff_wpn_passive_spirit_01` (template leftover) |
| buff_wpn_claym_0008(_atk_up) | `_atk_up`: attr 2 formulaItem 6 `atk_up`, `duration` 8 s, stackingType 1 priority `atk_up`; `buff_wpn_claym_0008`: poiseModifier (Final Strike, controlled) InstantModifyAttributeForPoise attr 26 formulaItem 5 +`poise_up` |
| sk_wpn_claym_0013 | cardAttributeModifier attrs 32, 33, 28 +`dmg_up`; abilityEvent 126 + CheckOriginSkillType [2] + CheckSpellInflictionType mask 4 + 0.1 s marker → `_normal_skill`; abilityEvent 302 + mask 8192 + target Cryo Infliction ≥ 1 + marker → `_combo_skill`; toggleBuffs `buff_wpn_lance_0003` (leftover) |
| buff_wpn_claym_0013_* | `_normal_skill` attr 53 `cryst_dmg_up` `duration`; `_combo_skill` attr 53 `cryst_dmg_up2` `duration2`; both stackingType 4; `buff_wpn_claym_0013` (per energy shard) referenced by nothing |
| sk_wpn_claym_0016 | cardAttributeModifier attr 50 `phy_dmg_up`; abilityEvent 30 + CheckSkillType [2, 6] + 0.1 s marker → `_dmgup` |
| buff_wpn_claym_0016_* | `_dmgup` attr 50 `phy_dmg_up` (assigned `phy_dmg_up2`), `duration` 20 s, stackingType 2, maxStackCntKey `max_stack` 3; `buff_wpn_claym_0016`, `_atk_up`, `_cd` referenced by nothing |

## Mechanics

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4 (SkillData frames above; atk_scale 0.68, 0.62 ×2, 0.77 ×2, 2.03) | supported | kit hits from kit-draft |
| 2 | Final Strike: attack4 mask 2097280, poise 25 controlled only, `atb` 30 if controlled | supported | `finalStrike`, `poise`, `poiseControlledOnly`, `sp: {if: controlled}` |
| 3 | Finisher (power_attack ×1.0 f40, finisher SP) | supported | kit hit; engine finisher SP |
| 4 | Dive (plunging_attack_end f2) | supported | kit hit (rotations don't schedule it: S10) |
| 5 | Dash attack (SkillPatchTable `chr_0026_lastrite_dash_attack` 0.96, poise 5; SkillData not in the checkout) | gap | S5 (deferred) |
| 6 | Battle skill: cost 100 SP; controlled path 0–187 (MarkCanInterrupt 51, jump 187 → 429), not-controlled path jump 0 → 300 (exclusive 373, end 429) (normal_skill timeline) | supported | `jumps: [{at: 0, to: 300, if: {not: {controlled: true}}}]`; the 187 jump is read from the data. kit-draft labels the f0 jump "(controlled)": G5a |
| 7 | Battle skill returns `atb` 30 (+5 at P5) SP, returned (buff_…_self ObtainCostAction atbGainMethod 1) | data | cast triggers `sp` at delay 32 and 300 (the jump makes them exclusive); kit-draft emits neither (G5b) |
| 8 | Battle skill energy `usp` 16 with her tag (main_start f26 → skill f32; f300) | data | cast triggers `energy` with `ignoreBlock`; kit-draft emits them without, and marks the f32 one detached though its buff ends with her next skill (G5b) |
| 9 | Team energy (buff_common_obtain_ultimate_sp at f32 and f300) | data | `teamEnergy: [{frame: 32}, {frame: 300}]` (S6: exclusive by the jumps); kit-draft keeps only the first (G5b) |
| 10 | Cast during her own basic attack while controlled: runs as `_inattack` beside the attack, at once, chain kept (switchToBuffConfig asSkillCast, CheckSkillType [0] mustBeforeExclusiveTime) | gap | G3 (interim: an ordinary cast; `dontInterruptCombo` keeps the chain, but she loses about 1.1 s per cast) |
| 11 | Hypothermic Perfusion on every team member for 15 s (normal_skill_self CreateBuff on CharacterTeamFinder) | supported | team buff `perfusion` (gameBuff `buff_chr_0026_lastrite_normal_skill`), applied by the cast triggers |
| 12 | Mirages: on a holder's Final Strike while controlled, 2 hits of `atk_scale` × 0.5 at +9 frames (+21 when Last Rite holds it: CheckTagMatch on the holder), Cryo Infliction before the first, battle kind (mask 4352) | data | trigger `mirage` (`on: hit, finalStrike`, `by: controlled`, `if: buffActive perfusion`), two `hits` actions split by `{controlled: true}` (the owner is the controlled one exactly when she's the hitter). kit-draft makes them skill hits at f41/53/309/321 (G5c) |
| 13 | Each holder's perfusion acts once and only that holder's ends (the tag buff on the holder, abilityEvent 9) | gap | G4 (interim: `endBuff` after the first Mirage: one use for the team) |
| 14 | Whose stats the Mirages use (the buffs are Last Rite's, on the enemy; no log has them) | unknown | interim: hers (trigger hits of her kit). A log with `buff_chr_0026_lastrite_normal_skill_phantom` settles it |
| 15 | Hit-stops (HitStopAction on Mirages and attacks) | gap | Ti1b (open, referenced) |
| 16 | P1: +`atk_up` 20% DMG on the holder's Final Strike while controlled (the perfusion's damageModifier) | gap | G2 |
| 17 | P1: +`poise` 5 Stagger on that Final Strike (a poise-only DamageAction in the handler) | supported | interim: `poise` on the first Mirage hit (`if: potentialAtLeast 1`), 9–21 frames late; a poise-only hit is batch-3 E1's deferred item |
| 18 | Combo trigger: ≥ `count` 3 Cryo stacks | supported | `{on: inflictionApplied, elements: [cryst], minStacks: 3}`, `by: anyone` → `openCombo` |
| 19 | Combo ice shard f13 `atk_scale` 1.6 (×1.15 P3) | supported | kit hit; verified b7b3 t=10155 (multiplier 1.84) |
| 20 | Combo bonus f63 `atk_scale3` × n (n = Cryo stacks then, ≤ 4) | supported | four `branch` hits `if: {enemyInfliction: cryst, minStacks: k}`, `factor: k`; verified t=11462 (n = 4, 11.04) |
| 21 | Combo slash f63 `atk_scale2` + poise 15, then FinishBuffByTag of all Cryo stacks after both DamageActions | supported | `consumeInfliction` with `afterDamage`; verified t=11462 (talent 1's 0.16 is a boundary buff there) |
| 22 | Combo energy 40 + 15 × n at f13 (n before the consumption; her tag); f63 fallback when the target is dead at f13 | data | cast trigger at delay 13: `energy usp_base` + four `energy usp` with `if: enemyInfliction ≥ k`, all `ignoreBlock`; kit-draft puts `usp × 4` on the f63 hits (G5d) |
| 23 | Combo freezes the enemy (buff_…_combo_skill_hitstop: time scale 0 on the enemy, f2, 2 s, finishByAction) | unknown | Ti1b (open). b7b3 suggests it doesn't hold pending bursts (Verification); statuses: test 37 part |
| 24 | Combo world slow-down (ComboSkill curve 0.6 s), cooldown 9 / 8 s, exclusiveFrame 90 | supported | read from SkillData / SkillPatchTable |
| 25 | Ultimate: slashes `atk_scale` 4.0 at f86, f105 (poise 5 each) and `atk_scale2` 8.0 at f134 (poise 10); cost 240; 20 s; UltimateTimeAction 0–85; ChannelingCasting 0–170 | supported | kit hits; timing from SkillData. b7b3 logs only the first two slashes (Verification) |
| 26 | Ultimate damage immunity (buff_common_damage_immune_ult_skill) | supported | nothing to do (enemy damage isn't simulated) |
| 27 | Passive: Ultimate Energy only from her own battle skills and combos (RefrainObtainUsp with tag 264623624; her grants carry the tag) | supported | permanent self buff `energy_lock` with `blocksEnergy` (from `fightStart`); her grants as trigger `energy` with `ignoreBlock` (as Arcane's array). Team energy and gear-set energy are then blocked for her |
| 28 | Talent 1: Cryo Susceptibility n × `crystal_up` for `duration` after consuming Arts Infliction; strongest instance only | supported | trigger `{on: inflictionConsumed, by: self}` → enemy buff `{zone: susceptibility, elements: [cryst], value: {product: [{talent: 0, key: crystal_up}, {eventCount: true}]}}`, gameBuff for B1 instances; verified (0.16 at t=11462 boundary, active at 15280) |
| 29 | Talent 1 on a reaction's consumption (her Mirage's Cryo landing on another element) | unknown | interim: counts (`inflictionConsumed` includes it), as OBJ Velocitous (batch-3 Wulfgard W7); test A below |
| 30 | Talent 2: each ultimate slash × `rate` on the target's whole Cryo Susceptibility (InstantModifyAttribute attr 73, formulaItem 8, target side) | unique? | G1. b7b3 confirms the reading exactly |
| 31 | P2 Strength +20, Cryo DMG +10% | supported | stat panel |
| 32 | P3 ×1.15 on combo and ultimate scales | supported | loader (data); verified (1.84 = 1.6 × 1.15) |
| 33 | P4 ultimate cost ×0.85 | supported | loader (skillParam) |
| 34 | P5 battle skill `atb` +5, `atk_scale` ×1.2 (the Mirages) | supported | loader (data) |
| 35 | Attribute nodes (Strength +10, +15, +15, +20) | supported | stat panel |

### Equipment

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| E1 | Sundered Prince: Strength, Crit Rate lines | supported | stat panel |
| E2 | Sundered Prince: on the wielder's Final Strike, ATK +`atk_up` (0.28) for `duration` 8 s, doubled (`multi` 2) if controlled; same name doesn't stack | supported | trigger `{on: hit, finalStrike: true, by: self}` → buff with value `{if: {controlled}, then: atk_up × multi, else: atk_up}` (judged at application); gameBuff for instances |
| E3 | Sundered Prince: Final Strikes while controlled deal Stagger +`poise_up` (0.336) (permanent buff_wpn_claym_0008, poiseModifier attr 26) | gap | G2 |
| E4 | Khravengger: Strength, ATK lines; battle, combo and ultimate DMG +`dmg_up` (0.56) | supported | stat panel (cardAttributeModifier) |
| E5 | Khravengger: the wielder's battle skill applies Cryo Infliction → Cryo DMG +`cryst_dmg_up` (0.28) for 15 s | supported | `{on: inflictionApplied, elements: [cryst], fromKinds: [battle], by: self}`, cooldown 0.1. Whether a reaction-forming infliction counts: the test-35 question (engine: no) |
| E6 | Khravengger: the wielder's combo damage on a Cryo-inflicted enemy → Cryo DMG +`cryst_dmg_up2` (0.56) for 15 s | supported | `{on: hit, kinds: [combo], by: self}` with `if: enemyInfliction cryst`; verified (b7b3: 0.32 at level 4, boundary on the shard, active from t=11462) |
| E7 | Phantom Pain: Strength, Arts Intensity lines; Physical DMG +`phy_dmg_up` | supported | stat panel |
| E8 | Phantom Pain: battle skill or combo cast → Physical DMG +`phy_dmg_up2` (0.154) for 20 s, 3 layers with own timers, once per 0.1 s | supported | `{on: cast, kinds: [battle, combo]}` → layered buff `maxStacks: max_stack` |
| E9 | Orphan buffs and template toggleBuffs (above) | supported | nothing to write |

Khravengger fits Last Rite (her battle skill's Mirages apply Cryo, her
combo needs a Cryo-inflicted enemy) and is what she wears in b7b3; Sundered
Prince is named after her battle skill's Seš'qa, but its effect is plain
Final Strike–generic. Phantom Pain is a Physical weapon (battle and combo
casts), no use to a Cryo operator; it suits Mi Fu, Da Pan or Catcher. None
needs moving: all are generic.

**Counts:** 44 rows: supported 29, data 5 (rows 7, 8, 9, 12, 22), gap 6
(rows 5 S5, 10 G3, 13 G4, 15 Ti1b, 16 and E3 G2), unique? 1 (row 30, G1),
unknown 3 (rows 14, 23, 29).

## Gaps

### G1. A hit that scales the target's damage-zone total (talent 2)

- **family:** values (a hit's own modifiers, like `bonuses`).
- **feature:** `KitHit.zoneScale: [{zone, value: ValueExpr}]`: for this
  hit, every modifier of that zone that reaches it (from anyone: the
  enemy's debuffs included) is multiplied by `value`, judged as the hit
  lands. Last Rite's slashes: `{zone: "susceptibility", value: {if:
  {talentAtLeast: [1, 1]}, then: "rate", else: 1}}`; only modifiers that
  reach the hit's element count (attribute 73 is Cryo Susceptibility: an
  all-element Arts Susceptibility counts, as it feeds attribute 73). The
  compiler can then read InstantModifyAttribute `modifyTargetSide` 1 with
  formulaItem 8 into it (G5e).
- **evidence:** SkillData `chr_0026_lastrite_ultimate_skill` f86/105/134:
  IfElse `talent_2` = 1 → damage unit InstantModifyAttribute
  `{attributeType: 73, formulaItem: 8, param: rate}`, modifyTargetSide 1;
  PotentialTalentEffectTable `chr_0026_lastrite_talent_2_1/_2` set
  `talent_2` 1 and `rate` 1.2 / 1.5. b7b3 (talent 2 at level 2): both
  logged slashes (182,223) are ×1.1811 over the kit; the logged Cryo
  Susceptibility on them sums to 0.568 (Arcane's 0.18 and 0.128, the Arts
  Susceptibility 0.1, her talent 1's 0.16), and (1 + 1.5 × 0.568) / 1.568
  = 1.1811. Scaling only her own 0.16 gives ×1.051, leaving out the Arts
  one ×1.149: the whole zone is scaled. A prototype of this field in the
  scratch copy (damage.ts: the hit's matching modifiers × value) makes all
  5 of her b7b3 hits match.
- **unique?:** no other SkillData or BuffData file has a target-side
  InstantModifyAttribute with formulaItem 8 (survey of every file:
  attribute 73 × only here; the other target-side ones are adds in buffs,
  not per hit: Laevatain's 98, Zhuang Fangyi's P5 97, the burning
  statuses' attribute 3), and kit-unique.md has nothing
  like it. As a general damage-pipeline field it costs little in shared
  code; the merge decides whether it goes on the unique list instead.
- **impact:** her ultimate (her largest hits: 4 + 4 + 8 × ATK × 1.15) is
  low by (1 + 0.5·S) / (1 + S): +6.9% with only her own 0.16, +18.1% in
  b7b3 (27,944 per slash).

### G2. Final-Strike filters on buff modifiers, and Stagger efficiency from buffs

- **family:** conditions (a modifier filter judged per hit) and values
  (an attribute read where the game reads it).
- **feature:** `KitBuffModifier.decorations: ["finalStrike" | "finisher"]`
  (as `TriggerOn.hit.decorations`): the modifier acts only on landings with
  any of them; with the existing per-hit `if: {controlled: true}` for
  CheckMainCharacterCondition. And attribute 26 (PoiseDamageOutputScalar,
  Stagger efficiency) allowed on kit buffs (READ_ATTRS), summed into the
  stagger a hit deals (`dealPoise` reads only the panel's today) with the
  same filters, so the stagger code sees the hit's decorations.
- **evidence:** BuffData `buff_chr_0026_lastrite_normal_skill`
  damageModifier: CheckMainCharacterCondition, CheckDamageDecorateMask
  checkType 1 mask 2097152, CompareFloat `potential_1` = 1 →
  DamageScaleProcessor NormalCalcZone +`atk_up` (P1: "it deals another
  {atk_up} DMG"); `buff_wpn_claym_0008` poiseModifier: CheckDamageDecorateMask
  checkType 2 mask 2097152, CheckMainCharacterCondition →
  InstantModifyAttributeForPoise attr 26 formulaItem 5 +`poise_up`
  (Sundered Prince: "buff the Final Strike so that it deals Stagger
  +{poise_up}"). A survey of every BuffData damageModifier and
  poiseModifier finds the Final-Strike mask in these two only.
- **impact:** P1: +20% DMG Bonus on one Final Strike per perfusion (at
  most ×1.2 of it: Si's attack5 8,888 → up to +1.8k per battle skill;
  her own attack4 12,194 → up to +2.4k).
  Sundered Prince: +33.6% Stagger on the controlled wielder's Final
  Strikes (her attack4's 25 → 33.4), which moves stagger timing.

### G3. Running beside a basic attack (the battle skill in her own chain)

- **family:** conditions (a predicate on the current action) and skills
  (a beside cast's own timing).
- **feature:** (a) Predicate `currentAction: {kinds: [SkillType], beforeExclusive?: true}`:
  the operator's current action is a skill of these kinds (and its
  playhead is before its exclusiveFrame), from CheckSkillType
  `checkTargetCurSkill` / `mustBeforeExclusiveTime`; Last Rite's skill gets
  `beside: {all: [{controlled: true}, {currentAction: {kinds: [basic], beforeExclusive: true}}]}`.
  (b) The `cast` event says whether the cast ran beside (`beside: true`),
  with a trigger filter `on: {event: cast, beside?: boolean}`, so the
  `_inattack` path's SP, energy, team energy and perfusion come at frame 0
  and the timeline path's at 32 (a beside cast also shouldn't take its
  jumps, MarkCanInterrupt or lock: it has no animation).
- **evidence:** SkillData `chr_0026_lastrite_normal_skill`
  `switchToBuffConfig` {asSkillCast: true, buffs: `_inattack`, condition:
  CheckSkillType skillTypeList [0] checkTargetCurSkill mustBeforeExclusiveTime,
  CheckMainCharacterCondition}; description "casting this battle skill
  does not reset her basic attack sequence". Other files check the current
  skill the same way: `chr_0035_liino_normal_skill_end` (CheckSkillType
  [2, 7, 8]), `chr_0036_jsspsi_normal_skill_inkhurt_front`; Liino's combo
  is the existing `beside` user (its predicate is a buff).
- **impact:** today the controlled cast is an ordinary skill: it ends her
  basic attack (the chain is kept by `dontInterruptCombo`) and holds her
  until frame 34 or so (solo scenario: battle skill after attack 2 at
  6.97 s, attack 3 at 8.10 s): about 1.1 s of her DPS per battle skill
  while she's on the field, and SP/energy/perfusion 1 s later than the
  game. A `beside: {controlled: true}` interim would be wrong the other
  way (castable inside her own combo or ultimate), so the interim is
  conservative. Test B.

### G4. One recipient's use of a team buff

- **family:** buff lifecycle (with conditions).
- **feature:** (a) trigger action `endBuff` with `to: "eventSubject"`
  (the twin of `buff`'s): the team buff stops reaching that member only
  (the active buff keeps a list of members it no longer reaches); (b)
  Predicate `operatorBuff: <BuffData id>`: a buff standing for that game
  buff reaches the operator, from anyone (the twin of `enemyBuff`), used
  as `eventOperator: {operatorBuff: "buff_chr_0026_lastrite_normal_skill"}`
  in the Mirage trigger instead of the owner's `buffActive`.
- **evidence:** `buff_chr_0026_lastrite_normal_skill_self` creates the
  perfusion on CharacterTeamFinder (no filter): every member holds one;
  each holder's abilityEvent 302 handler (CheckMainCharacterCondition: the
  holder controlled) creates `_tag` on that holder, and `_tag` ends that
  holder's perfusion (FinishBuffAction, abilityEvent 9). So after a swap
  the next operator's Final Strike makes Mirages again within the 15 s.
  The description only speaks of "the controlled operator's weapon".
- **impact:** the interim (one use for the team: `endBuff` at the first
  Mirage) misses the Mirages of a second member's Final Strike after a
  swap within 15 s (2 × `atk_scale` × 0.5 = 3.84 × ATK at P5, and a Cryo
  stack, per extra member). Staying on one controlled operator, it's exact.
  A per-member cooldown interim would be wrong in that commoner case.
  Test C.

### G5. kit-draft on Last Rite (data compilation)

- **family:** data compilation (D3 / D4 leftovers).
- **feature / evidence**, each a compiler fix:
  - **a.** NotNextCheckAction negates the next condition; `isConditionType`
    skips it, so the battle skill's f0 jump is labelled "(controlled)"
    (it's "not controlled"), and Sundered Prince's two branches would both
    read "controlled". It's in 63 files (28 of them battle skills), so
    any `if` the compiler emits behind one is inverted.
  - **b.** A hitless skill's SP granted inside a buff it creates
    (`_self`'s ObtainCostAction `atb`) isn't emitted as a cast trigger
    (only noted); a second `buff_common_obtain_ultimate_sp` part is dropped
    though the jumps make the parts exclusive (S6 allows both); the f32
    energy is marked detached although `_main_start` has
    finishWithNextSkillIfNotInherited. SkillData.spKinds / spSources don't
    follow CreateBuff either, so this SP has no atbSourceType (only
    `sourceTypes` triggers by the wielder care: OBJ Edge of Lightness, a
    sword).
  - **c.** The perfusion's abilityEvent 302 handler is compiled as skill
    hits at fixed frames (41, 53, 309, 321) with `branch`; they're event
    handlers (a Final Strike by the holder) and should be reported as a
    trigger to write, not as hits.
  - **d.** Combo energy: the f13 grant `usp` × `infliction_num` (behind
    CheckHp > 0) is dropped, and the f63 fallback `usp` × 4 (when
    `recover_usp` = 0) is put on both f63 hits; the note "damage by
    DefiniteValueCalculation (not ATK × scale)" on the shard is wrong
    (simpleCalculation with `atkScale` `atk_scale`: b7b3's shard is
    1.84 × ATK).
  - **e.** InstantModifyAttribute attribute 73 side 1 is "not read" (G1);
    switchToBuffConfig isn't reported (G3); the combo's enemy time
    dilation is reported only as "creates on the enemy" (Ti1b).
- **impact:** none on a hand-checked kit; each would mislead the next
  kit's author (a. on every battle skill).

### G6. Log tooling

- **a.** `zmdlogs check` can't judge an enemy-state `if` inside a hit's
  `scaleValue` (K6 judges hit `if`s on the replay): the combo bonus written
  as `{product: [atk_scale3, {sum: [{if: enemyInfliction ≥ k, then: 1}…]}]}`
  is skipped and t=11462 mismatches ×6.0; written as four `branch` hits it
  matches. The kit uses the branch form; either the checker evaluates
  ValueExpr `if`s on the replay too, or a ValueExpr
  `{enemyInflictionStacks: element}` (the twin of `enemyVulnerableStacks`)
  makes it one hit. Small.
- **b.** `zmdlogs reactions` doesn't stop pending bursts during the
  ultimates' time stops (SkillTiming.slowdowns from UltimateTimeAction) of
  the logged casts. In b7b3 that explains the three late Cryo bursts
  (family log tooling, with A5): the burst from Arcane's t=4953 Cryo is
  due at 5953 ms, inside Arcane's own time stop before her 7150 ms
  ultimate hit (UltimateTimeAction 0–47 = 1,567 ms), then Tangtang's
  (UltimateTimeAction 0–82 = 2,733 ms, before her `ultimate_skill_1` hits
  from 10155 ms; the log has no hit at all from 7150 to 10155 ms):
  5953 + 1567 + 2733 = 10,253 ms, logged 10,340; the two from 7150 ms are
  due at 8150: 8150 + 2733 = 10,883 ms, logged 10,910 (×2). That needs
  each ultimate's cast placed from its first logged hit and its time stop
  applied in the replay, and Tangtang's kit for her cast. Last Rite isn't
  involved, except that her combo's enemy freeze (row 23, cast ≈ 9.8 s,
  2 s) evidently doesn't hold these bursts: they land inside it.

Referenced, not re-proposed: Ti1b (rows 15, 23), S5 (row 5), S10 (row 4),
batch-3 E1 (row 17's poise-only hit), W7 (row 29), the test-35 question
(E5), B1's interim at the limit (rows 28, E2).

## Verification

`fixtures/zmdlogs-b7b3762d5da8.json` (Last Rite P4, skill levels 11 / 11 /
12 / 12, Khravengger level 90 with skill levels 9 / 9 / 4, talents assumed
at level 2) checks the combo, talent 1, Khravengger's combo buff, P3 and
talent 2. She casts no battle skill there, so the perfusion, Mirages, P1
and P5 are unverified. Results with the draft kits in the scratch copy:

- `zmdlogs check`: Last Rite 5 hits, **3 match, 2 mismatch**, 100%
  covered (before: 0 covered). Matches: the shard (t=10155, 38,771), the
  bonus at n = 4 (t=11462, 332,488) and the slash (55,415). Mismatches:
  both ultimate slashes (t=15280, 15652), ×1.1811 each, which is G1
  exactly; with the G1 prototype, 5 of 5 match. Arcane 13/13 and Si 21/21
  unchanged. `tests/logs.test.ts` fails on those two hits until G1 is in
  (so the kit and G1 go in together); `vitest run packages/data` passes
  (428/428), so the four kits load with the real loader.
- `zmdlogs reactions`: unchanged (2 matched, 1 not logged, 2 unexpected):
  her only inflictions are the Mirages, absent from the log; her combo's
  consumption at 11462 changes no predicted burst. Explanation of the
  burst times: G6b.
- The build is right as logged: Khravengger's combo buff 0.32 is level 4,
  talent 1's 0.16 = 4 × 0.04 and talent 2's ×1.5 are level 2, P3's ×1.15
  is in every combo and ultimate multiplier. No fixture correction.
- Not explained: only two of the three ultimate slashes are logged
  (f86, f105); the third (`atk_scale2`, f134, ×2 their damage) is missing
  although the fight goes on to 18,024 ms. The data has no condition on it
  but the ChannelingAction's target search; the kit keeps three slashes
  (the description's "3 slashes"). Her own frame spacing in the log is
  short of 30 FPS (1,307 ms for the combo's 50 frames: 30 FPS at +27.5%,
  which fits Si's talent-2 Haste of 30% within 25 ms; 372 ms for the
  ultimate's 19 frames, faster still), a question for test 19, not her kit.

Logs that would verify the rest: a ZMDLogs battle with Last Rite casting
her battle skill off-field and on-field (P1+ and P5 for the Mirage
multiplier and P1's +20% / Stagger), events
`buff_chr_0026_lastrite_normal_skill_phantom` / `_phantom_main` with their
attributed ATK (row 14), a swap between two Final Strikes within 15 s
(G4), and a Heat / Electric / Nature teammate so a Mirage forms a reaction
(row 29). Sundered Prince's and Phantom Pain's buffs would show as
`buff_wpn_claym_0008_atk_up` (0.28 / 0.56) and `buff_wpn_claym_0016_dmgup`
layers.

In-game tests (new, for docs/in-game-tests.md; existing ones referenced):

- **A. Does Hypothermia count a reaction's consumption?** (ready, if you
  have Last Rite with talent 1; settles W7's first half for OBJ Velocitous
  too). A Heat (or Electric, Nature) teammate applies an infliction to a
  dummy and stays controlled; Last Rite casts her battle skill off-field;
  the teammate's Final Strike brings her Mirage, whose Cryo turns the
  infliction into a reaction. Is there a Cryo Susceptibility icon on the
  dummy (no combo cast)? Engine: yes. If not, `hypothermia` gets a
  `fromReaction: false`-style filter (only consumptions by her combo).
- **B. The battle skill inside her own chain** (ready, if you have Last
  Rite; G3). Last Rite controlled, stopwatch from the first basic attack
  to the third Final Strike: three plain chains, then three chains with
  the battle skill pressed during attack 2 of the first two. Data: the
  same time (the cast runs beside the attack, nothing is cancelled).
  Engine: about 2.2 s longer. Also: does attack 2's second hit still show
  its damage number when the skill is pressed between its hits? (Data:
  yes; engine: the hit is cancelled, test 16's question.)
- **C. Mirages after a swap** (ready, if you have Last Rite; G4). With
  operator X controlled, Last Rite casts her battle skill off-field;
  swap to Y at once and finish Y's chain: Mirages on Y's Final Strike?
  Then swap back to X and finish X's chain within the 15 s: Mirages again?
  Data: Mirages both times (every member holds a perfusion; each acts
  once). Engine (interim): only the first. If only X's Final Strike makes
  them (not Y's), the perfusion is the controlled operator's only, as the
  description says.
- **D. Her combo's enemy freeze** (a part of test 37; Ti1b). A teammate
  puts a debuff with an icon of 10 s or more on a dummy (e.g. Arcane's
  talent-1 Susceptibility); bring the dummy to 3 Cryo stacks and cast her
  combo within the debuff: does the icon last about 2 s longer than
  without the combo? Engine: no change; a 2 s freeze per combo (cooldown
  8 s) would stretch every enemy timer by about a quarter.
- Referenced: test 19 (Haste: her log spacing), test 35 (E5's
  reaction-forming infliction), test 51 (whether her Khravengger combo buff
  acts on the shard that creates it: the data has it after the damage,
  the kit agrees with b7b3's boundary listing), test 16 (cancelled hits).

Talent 2's reading (G1) and the combo's n (row 20) are settled by b7b3; no
test needed.

## Kit plan

Written today and loaded with the real loader in a scratch copy of the
repository at 8dbd8f9
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-lastrite/repo`;
copies of the four kits, two builds and three scenarios in
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-lastrite/mykits/`,
the G1 prototype kit in
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-lastrite/kit_with_zoneScale_prototype.json`).
All four load (`vitest run packages/data`: 428/428); `efsim simulate`
runs a Si + Last Rite rotation (off-field battle skills, Mirages at +9
frames on Si's Final Strikes, the combo at n = 4 after a fourth stack from
a Mirage, the ultimate) and a solo one (Mirages at +21; energy only from
her own 16s, checked from 0 energy); `zmdlogs check` as above.

### Operator kit (today)

Stacks: none. Element `cryst`.

Buffs:

```json
{ "id": "energy_lock", "label": "Only her own battle and combo skills give her Ultimate Energy",
  "target": "self", "blocksEnergy": true, "gameBuff": "buff_chr_0026_lastrite_passive", "modifiers": [] },
{ "id": "perfusion", "label": "Hypothermic Perfusion", "target": "team",
  "duration": { "key": "duration", "skill": "chr_0026_lastrite_normal_skill" },
  "gameBuff": "buff_chr_0026_lastrite_normal_skill", "modifiers": [] },
{ "id": "talent1_vul", "label": "Hypothermia: Cryo Susceptibility", "target": "enemy",
  "gameBuff": "buff_chr_0026_lastrite_talent_1_vul", "duration": { "talent": 0, "key": "duration" },
  "modifiers": [{ "zone": "susceptibility", "elements": ["cryst"],
    "value": { "product": [{ "talent": 0, "key": "crystal_up" }, { "eventCount": true }] } }] }
```

Triggers:

- `energy_lock_on`: `fightStart` → buff `energy_lock`.
- `combo_window`: `{event: inflictionApplied, elements: [cryst], minStacks: 3}`,
  `by: anyone` → `openCombo`.
- `battle_skill_on_field`: cast of the battle skill, `by: self`,
  `delay: 32` (not detached: `_main_start` ends with her next skill),
  `skill: chr_0026_lastrite_normal_skill`: `sp atb` (returned), `energy usp`
  with `ignoreBlock`, `buff perfusion`. `battle_skill_off_field`: the same
  at `delay: 300` (after the jump it runs at the cast).
- `mirage` (written out; the frames are relative to the Final Strike):

```json
{ "id": "mirage", "on": { "event": "hit", "finalStrike": true }, "by": "controlled",
  "if": { "buffActive": "perfusion" }, "skill": "chr_0026_lastrite_normal_skill",
  "do": [
    { "kind": "hits", "if": { "controlled": true }, "hits": [
      { "id": "mirage_main_1", "label": "Mirage (Last Rite holds it)", "scale": ["atk_scale"], "factor": 0.5, "frames": [21],
        "events": ["buff_chr_0026_lastrite_normal_skill_phantom_main"], "damageType": "battle", "element": "cryst",
        "applies": [{ "kind": "infliction", "element": "cryst" }],
        "poise": { "if": { "potentialAtLeast": 1 }, "then": "poise", "else": 0 } },
      { "id": "mirage_main_2", "label": "Mirage (Last Rite holds it)", "scale": ["atk_scale"], "factor": 0.5, "frames": [21],
        "events": ["buff_chr_0026_lastrite_normal_skill_phantom_main"], "damageType": "battle", "element": "cryst" } ] },
    { "kind": "hits", "if": { "not": { "controlled": true } }, "hits": [
      { "id": "mirage_1", "…": "the same at frame 9, events buff_chr_0026_lastrite_normal_skill_phantom" },
      { "id": "mirage_2", "…": "the same at frame 9" } ] },
    { "kind": "endBuff", "buff": "perfusion" } ] }
```

- `combo_energy`: cast of the combo, `by: self`, `delay: 13`,
  `skill: chr_0026_lastrite_combo_skill`: `energy usp_base`, then four
  `energy usp` with `if: {enemyInfliction: cryst, minStacks: k}` (k = 1–4),
  all `ignoreBlock: true` (40 + 15 × n).
- `hypothermia`: `{event: inflictionConsumed}`, `by: self`,
  `if: {talentAtLeast: [0, 1]}` → buff `talent1_vul` (after the consuming
  hit's damage: not `beforeDamage`).

Skills:

- attack1–4, power_attack, plunging_attack_end: kit-draft's hits as they
  are (attack3's second hit `sp: 0`; attack4 `finalStrike`, `poise`,
  `poiseControlledOnly`, `sp: {if: controlled, then: atb}`).
- normal_skill (battle): `hits: []`,
  `jumps: [{at: 0, to: 300, if: {not: {controlled: true}}}]`,
  `teamEnergy: [{frame: 32, ratio: 1}, {frame: 300, ratio: 1}]`.
- combo_skill: `shard` (`atk_scale`, f13); `bonus_4` … `bonus_1`
  (`branch: "bonus"`, `if: {enemyInfliction: cryst, minStacks: k}`,
  `scale: [atk_scale3]`, `factor: k`, f63, in that order); `slash`
  (`atk_scale2`, f63, `poise: poise`,
  `applies: [{kind: consumeInfliction, elements: [cryst], afterDamage: true}]`).
  All events `chr_0026_lastrite_combo_skill`. No `energy` on the hits (the
  passive block would stop it).
- ultimate_skill: `slash` (`atk_scale`, count 2, f86 and f105,
  `poise: poise1`), `slash_3` (`atk_scale2`, f134, `poise: poise2`).

What waits on a gap:

- G1: on all three slashes,
  `"zoneScale": [{ "zone": "susceptibility", "value": { "if": { "talentAtLeast": [1, 1] }, "then": "rate", "else": 1 } }]`
  (with it b7b3 matches 5/5).
- G2: on `perfusion`,
  `{ "zone": "damageBonus", "value": { "if": { "potentialAtLeast": 1 }, "then": { "key": "atk_up", "skill": "chr_0026_lastrite_normal_skill" }, "else": 0 }, "decorations": ["finalStrike"], "if": { "controlled": true } }`
  (taken at application; the loader may also read `potential_1`), and
  P1's Stagger as a stagger-only action once E1's is there.
- G3: `beside` on the battle skill and the two cast triggers split by
  `beside` (frame 0 for the beside path).
- G4: `mirage` with `if: {eventOperator: {operatorBuff: "buff_chr_0026_lastrite_normal_skill"}}`
  and `{kind: endBuff, buff: perfusion, to: "eventSubject"}`.

### Equipment kits (today)

- **wpn_claym_0008 Sundered Prince:** buff `wpn_claym_0008.atk` (self,
  gameBuff `buff_wpn_claym_0008_atk_up`, `duration`, modifier
  `{zone: atk, value: {if: {controlled: true}, then: {product: [atk_up, multi]}, else: atk_up}}`);
  trigger `{on: {event: hit, finalStrike: true}, by: self, skill: sk_wpn_claym_0008}`
  → that buff. Waits on G2: a permanent buff (from `fightStart`) with
  `{attr: 26, value: poise_up, decorations: [finalStrike], if: {controlled: true}}`.
- **wpn_claym_0013 Khravengger:** buffs `wpn_claym_0013.battle` (attr 53
  `cryst_dmg_up`, `duration`, gameBuff `buff_wpn_claym_0013_normal_skill`)
  and `wpn_claym_0013.combo` (attr 53 `cryst_dmg_up2`, `duration2`, gameBuff
  `buff_wpn_claym_0013_combo_skill`); triggers
  `{on: {event: inflictionApplied, elements: [cryst], fromKinds: [battle]}, by: self, cooldown: 0.1}`
  and `{on: {event: hit, kinds: [combo]}, by: self, if: {enemyInfliction: cryst}, cooldown: 0.1}`,
  both `skill: sk_wpn_claym_0013`.
- **wpn_claym_0016 Phantom Pain:** buff `wpn_claym_0016.phys` (attr 50
  `phy_dmg_up2`, `duration`, `maxStacks: max_stack`, gameBuff
  `buff_wpn_claym_0016_dmgup`); trigger
  `{on: {event: cast, kinds: [battle, combo]}, by: self, cooldown: 0.1, skill: sk_wpn_claym_0016}`.

Tests the kits would get (as batch 3's): the combo's n-alternatives and
energy (40 + 15 × n), the energy lock (teammates' battle skills give her
nothing), Mirage frames (+9 / +21) and their single use, the off-field
jump, talent 1's value after a 4-stack consumption, Sundered Prince's
doubling while controlled, Phantom Pain's three layers; example scenario
`lastrite-si.scenario.json`.

## Kit (2026-10-21)

Kit phase, on the batch-4 shared features (commit 3e66c59). Files:
`packages/data/kits/operators/chr_0026_lastrite.json`; equipment
`packages/data/kits/equipment/wpn_claym_0008.json` (Sundered Prince),
`wpn_claym_0013.json` (Khravengger), `wpn_claym_0016.json` (Phantom Pain);
`tests/kit-lastrite.test.ts`; the example `examples/lastrite-si.scenario.json`
with the build `examples/lastrite-p5.json` (P5, Khravengger); Last Rite in
`packages/data/test/skillCompile.test.ts` with three KNOWN entries; a note
on her in `fixtures/zmdlogs-b7b3762d5da8.json` (notes only, the build is
right). `efsim kit-draft` was re-run as the start; the analysis drafts in
the scratch folder served as notes.

### Re-analysis

Gaps:

| Gap | Now | How |
|---|---|---|
| G1 talent 2 (zone scale) | **done** (V1) | `zoneScale: [{zone: susceptibility, value: {if: {talentAtLeast: [1, 1]}, then: rate, else: 1}}]` on all three slashes |
| G2 P1's +20% DMG on Final Strikes; Sundered Prince's Stagger | **done** (C3) | the perfusion's modifier `{zone: damageBonus, value: atk_up × potential_1, decorations: [finalStrike], if: {controlled: true}}`; Sundered Prince's permanent `{attr: 26, value: poise_up, decorations: [finalStrike], if: {controlled: true}}` |
| G3 battle skill beside her own basic attack | **done** (C4) | `beside: {all: [{controlled: true}, {currentAction: {kinds: [basic], beforeExclusive: true}}]}`; three cast triggers split by the cast filter `beside` (at the cast / delay 32 / delay 300). Plus the one-line engine fix below |
| G4 each holder's perfusion | **done** (C2, B6) | the Mirage trigger's `if: {eventOperator: {operatorBuff: buff_chr_0026_lastrite_normal_skill}}` and `{kind: endBuff, buff: perfusion, to: eventSubject}`; a new cast gives it back to everyone |
| G5a NotNextCheckAction | **done** (D7a) | kit-draft labels the f0 jump "not controlled" |
| G5b hitless SP, second team-energy part, detached | **partly** (D8e) | kit-draft emits both cast triggers with `atb` and `usp`, but still marks them `detached`, without `ignoreBlock`, and keeps only the first team-energy part (a KNOWN entry). The SP kind comes from `_self` (D2: returned): nothing hand-written |
| G5c Mirages compiled as skill hits | **done** (D9c) | kit-draft reports them as event-driven landings for a trigger |
| G5d combo energy, the DefiniteValueCalculation note | **open** (D8f leftover) | kit-draft still puts `usp × 4` on both frame-63 hits and keeps the wrong note; the kit writes the energy by hand |
| G5e attribute 73 side 1, switchToBuffConfig | **open** (D10a/f leftovers) | still "not read" (the ultimate comes out as talent_2 branch pairs), switchToBuffConfig not reported; `zoneScale` and `beside` hand-written |
| G6a enemy-state value in `zmdlogs check` | **done** (L6) | the combo bonus is one hit: `scale: [atk_scale3]`, `scaleValue: {enemyInflictionStacks: cryst}`, `if: {enemyInfliction: cryst}` |
| G6b time stops in `zmdlogs reactions` | **done** (L5) | b7b3's three late Cryo bursts match (held by Arcane's and Tangtang's time stops) |

Mechanics rows that weren't `supported`:

| Row | Now | How |
|---|---|---|
| 5 dash attack | open | batch-3 S5; its SkillData isn't in the checkout |
| 7 returned SP | done | cast triggers `sp atb` (returned per D2); 35 at P5 |
| 8 her energy with her tag | done | cast triggers `energy usp`, `ignoreBlock`, not detached |
| 9 team energy | done | `teamEnergy` at 32 and 300 (S6: exclusive by the jumps); at the cast when beside |
| 10 beside | done | G3 |
| 12 Mirages | done | trigger `mirage`: two hits per path (the first applies the pair's one Cryo stack), +9 frames, +21 when she's the holder |
| 13 one use per holder | done | G4 |
| 14 whose stats the Mirages use | unknown, interim | hers (her trigger hits); no log has the phantom buffs yet |
| 15 hit-stops | open | Ti1b |
| 16 P1 DMG | done | G2 |
| 17 P1 Stagger | done (D6) | a `poiseOnly` hit (`poise`, 5) at the Final Strike, `if: {potentialAtLeast: 1}` (it rode on the first Mirage in the plan) |
| 22 combo energy | done | one action at delay 13: `usp_base + usp × {enemyInflictionStacks: cryst}` (40 + 15 × n), `ignoreBlock`; the frame-63 fallback for a target dead at 13 isn't written (no kills) |
| 23 the combo's 2 s enemy freeze | open | Ti1b; test 37's variant |
| 29 talent 1 on a reaction's consumption | interim | counts (A1, test 81); tested |
| 30 talent 2 | done | G1 |
| E3 Sundered Prince's Stagger | done | G2 |

**Engine fix (local; changes no existing total).** In `castSkill`
(packages/engine/src/timeline.ts) a cast that runs beside the current
action gives the team's energy at the cast, not at its `teamEnergy`
frames: a beside cast plays no timeline (the game runs the
switchToBuffConfig buff, here `_inattack`, which creates
`buff_common_obtain_ultimate_sp` as it starts). Without it her beside cast
scheduled both parts (32 and 300; no jump skips either on a beside cast),
doubling the team's energy. The only other `beside` skill, Liino's combo,
spends no SP. Example totals and log outputs are unchanged (below).

Assumption: CheckSkillType [0] (her `beside` condition) is read as the kit
kind `basic`, which includes her finisher and dive; SkillData has no
skill-type field to confirm whether the game counts those.

### What the kit models

- **Basic attacks, finisher, dive:** kit-draft's hits; attack4 is the
  Final Strike (25 Stagger and 30 SP as the controlled operator). Dives
  aren't castable yet (batch-1 S10).
- **Battle skill:** hitless, three paths. Off-field (jump 0 → 300):
  returned SP (`atb`, 35 at P5), her 16 energy, the team's energy and the
  perfusion at the cast. Controlled outside her chain: the same at frame
  32 (her next action from 34). Controlled inside her basic attack before
  its exclusive frame: beside the attack, everything at the cast, the
  chain not delayed (the analysis's interim lost about 1.1 s per cast).
- **Hypothermic Perfusion:** a team buff (15 s). Each holder's first Final
  Strike while controlled gets P1's +20% DMG and +5 Stagger, then two
  Mirages (`atk_scale` × 0.5 each, ×1.2 at P5; battle, Cryo; one Cryo
  stack) 9 frames later, 21 when Last Rite holds it; that holder's
  perfusion ends, the others keep theirs. Approximation: the game ends it
  when the holder next gains a buff (`_tag`, abilityEvent 9), so a Final
  Strike with several landings may get P1's +20% on more than its first;
  the kit ends it at once.
- **Combo:** opens at 3 Cryo stacks; shard (f13), bonus `atk_scale3 × n`
  and slash (f63), then every Cryo stack consumed; energy 40 + 15 × n at
  f13. Talent 1: Cryo Susceptibility 0.04 × n for 15 s (the strongest
  instance acts).
- **Ultimate:** slashes at 86, 105 and 134, each with the whole Cryo
  Susceptibility reaching it × 1.5 (×1.2 at talent level 1).
- **Passive:** only her own grants give her energy (team and gear-set
  energy are blocked).
- **Sundered Prince:** ATK +`atk_up` (×`multi` 2 while controlled, judged at
  application) for 8 s after the wielder's Final Strike; Stagger
  +`poise_up` on the controlled wielder's Final Strikes. Tested on her.
- **Khravengger:** Cryo DMG +`cryst_dmg_up` after the wielder's
  battle-skill Cryo Infliction (her Mirages: from the pair's second Mirage
  on, the buff coming after the first's damage, test 51's question) and
  +`cryst_dmg_up2` after combo damage on a Cryo-inflicted enemy. Tested on
  her and on b7b3.
- **Phantom Pain:** a layer of Physical DMG +`phy_dmg_up2` per battle skill
  or combo cast, at most 3 with their own 20 s timers. Tested on Catcher
  (a Physical greatsword user with a kit).

Left out: the dash attack (S5), hit-stops and the combo's enemy freeze
(Ti1b), the combo's dead-target energy fallback, damage immunity during
the ultimate.

### Verification

- `zmdlogs check fixtures/zmdlogs-b7b3762d5da8.json`: Last Rite **5 of 5
  match**, 100% covered (before: 0 covered): the combo's shard and slash
  (both 1.84 × ATK, so the checker lists both under `shard`), the bonus at
  n = 4 (`enemy cryst ×4`) and both ultimate slashes (with `zoneScale`). Arcane 13/13, Si 21/21, Tangtang 1/46 (no kit
  yet) unchanged. `tests/logs.test.ts` passes.
- `zmdlogs reactions` on b7b3: still 3 matched, 0 predicted but not
  logged, 1 logged but not predicted (Tangtang's 15374 ms Solidification,
  which needs her kit). Her own lines: she left the "no inflictions in the
  kit" list, and her combo's consumption shows ("other 11462 ms: consumed 4
  cryst"); it changes no burst. Her Mirages (her only inflictions) aren't
  in this log.
- The example (Si controlled, then Last Rite): 823,680 damage in 21.17 s,
  38,914 DPS. Timings as planned: Mirages at Si's Final Strikes + 9
  (frames 105, 207), at hers + 21 (328, 459); the battle skill cast in
  attack 2 at 11.73 s with attack 3 0.97 s later, as in a plain chain;
  the combo at n = 4 (bonus 11.04 × ATK); the ultimate's slashes at
  Susceptibility 1.24 (0.16 × 1.5). The analysis's solo scenario now has
  attack 3 at 7.13 s after the beside cast (8.10 s with the old interim)
  and 16 energy per battle skill.
- Every other example total and every `zmdlogs check` / `zmdlogs
  reactions` output on fixtures/ and fixtures/pending/ is unchanged.

### In-game tests the kit depends on

- **81** (Hypothermia on a reaction): the interim counts it.
- **82** (the battle skill inside her chain): the kit follows the data (no
  time lost); the test confirms it.
- **83** (Mirages after a swap): the kit follows the data (each member's
  first Final Strike); "only X's" would make the perfusion the controlled
  operator's only.
- **37**'s variant (the combo's 2 s enemy freeze): not modelled.
- **51** (an effect on its own hit: Khravengger's battle buff isn't on the
  pair's first Mirage), **35** (a reaction-forming infliction for
  Khravengger: the engine says no), **19** (Haste: her log spacing).
