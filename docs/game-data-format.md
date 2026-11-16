# Game data format: SkillData and BuffData

Notes on the raw `Json/SkillData` and `Json/BuffData` files in
`data/rmxlinux-EndfieldData` (game 1.6), for the data compiler. Table
formats are summarised in [data-sources.md](data-sources.md#what-the-tables-contain).
Collections Endaxis also uses (ProjectileData, AbilityEntityData,
CharacterData) are **not** in rmxlinux; projectile-hit (`*_projhit*`) and
ability-entity (`*_abilityentity`) skills do exist as SkillData files.

## Conventions

- Timeline positions are integer frames at **30 FPS**. Cooldowns, buff
  durations and blackboard values are in seconds or plain numbers.
- Floats are float32 expansions (`2.8499999046325684`).
- `$type` holds a C# class name, e.g.
  `Beyond.Gameplay.Core.PlayAnimationAction+PlayAnimationActionData`.
- Enums are unnamed numbers (attribute type, stacking type, buff event,
  formula slot, side). See [known enum values](#known-enum-values).

## SkillData (one file per skill ID)

```
{ skillId, durationFrame, exclusiveFrame, offsetRecordFrame, dontInterruptCombo, skillTags,
  castData { cooldownTime (s), startCdFrame, maxChargeTime,
             costData { costType 0 = ultimate energy | 1 = SP, costValue } },
  blackboard [ { key, valueDouble, isDynamic } ],
  actionGroupData {
    timelineActions [ { _startFrame, _endFrame,
                        _sequenceActionData { actionData [ { $type, … } ] } } ],
    passiveEventActions [] } }
```

- **Blackboard and castData are defaults, not per-level values.** Always
  overlay `SkillPatchTable` by skill ID and level (Perlica's file says
  `atk_scale 2.85`, cost 40; Laevatain's says cost 0 while the table says
  100 SP).
- **Action types seen:**
  - control flow: `IfElseAction`, `SwitchAction`, `ForEachAction`,
    `JumpToAction`, `CheckBuffStackNumAdvanced`, `CheckEntityNum`,
    `CompareFloat`, `CheckMainCharacterCondition`;
  - targeting: `FindTargetAction` (hit-box shapes; saves a target group key);
  - combat: `DamageAction`, `SpellInfliction`, `InterruptAction`,
    `CreateBuffAction`, `FinishBuffAction`, `ChannelingAction` (repeated
    ticks), `LaunchProjectile`, `SpawnAbilityEntity`,
    `ModifyDynamicBlackboard`, `SetSuperArmorAction`;
  - skill flow: `AllowNextSkillAction` (cancel window), `ComboCacheAction`,
    `FinishOwnerAction`;
  - presentation, to strip: `PlayAnimation`, `Effect`, `PlaySound`,
    `CameraImpulse`, `CustomRootMotion`, `CharWeaponVisible`.
- **Hits:** a `DamageAction` holds `damageUnits[]`. The HP unit has
  `atkScale` bound to a blackboard key (`atk_scale`), a numeric `damageType`
  and a `damageDecorateMask` bitmask saying what kind of damage it is (skill
  type, burst, status…); zones key on that mask. A second unit is poise
  (stagger) damage (`damageAttributeType` 1, blackboard `poise`). The
  infliction is a sibling `SpellInfliction`.
- **Buffs:** `CreateBuffAction { buffs [ { buffId, value } ], targetSettings,
  inheritSourceSkillCastInfo }`. Even energy gain on hit is a buff
  (`buff_common_obtain_ultimate_sp`).
- **Variants are branches inside one file:** Laevatain's battle skill checks
  her Melting Flame stacks at frame 0 and jumps to different sections. Her
  DoT lives in the spawned entity's own file (11 ticks, frames 25…62).
- Examples checked: Perlica battle-skill hit at frame 13 (0.433 s), cancel
  window from frame 28; Laevatain battle skill spawns an entity at frame 4
  whose first action is at its frame 18, i.e. 0.733 s.

## BuffData (one file per buff ID)

```
{ id, lifeType, duration { value (s) | blackboardKey }, blackboard [ … ],
  stackingSettings { stackingType, maxStackCnt, maxStackCntKey, stackingKey, priority, … },
  attributeModifier { attributeModifiers [ { attributeType, formulaItem, param { value | blackboardKey } } ] },
  damageModifier [ { condition, damageProcessors [ { $type, modifier { attributeType, formulaItem, param },
                     modifyTargetSide, calcZone } ] } ],
  healModifier, poiseModifier, shieldConfigs, globalModifier,
  buffEventAction [ { buffEvent, actions } ], abilityEventAction, timelineActions,
  triggerInterval, maxTriggerCnt, addingCooldown }
```

- Damage modifiers name a side (attacker / defender) and a zone:
  `NormalCalcZone` (114 entries, additive within a side), `ProdCalcZone`
  (133, multiplicative), `EnergyTypeCalcZone` (7), `RaceCalcZone` (1),
  `ComboCalcZone` (1), none (10).
- Buff lifecycle logic uses the same action vocabulary as skills
  (`CreateBuff`, `FinishBuff`, `Switch`, `GetTargetBuffBBAdvanced`,
  `SaveBuffStackNum`).
- Value keys can be misleading: Breach's (`buff_physical_do_fracture`)
  damage-taken value is keyed `physical_res_down`.
- Some values come from skill-setting keys with Chinese names
  (e.g. `碎甲物理伤害提高`, `腐蚀每跳减抗`) that scale with the caster's stats.

## Reading the files: `efsim gamedata`

- `efsim gamedata tree <id> [--grep re] [--depth n]`: a BuffData or
  SkillData file as an event → action → condition tree, presentation
  actions (animation, sound, camera, effects) and default values left out,
  value fields as `key k (default v)`, the enums below named.
- `efsim gamedata who <id>`: every file that names a buff or skill id,
  with the action around it (`CreateBuffAction`, `FinishBuffAction`, a
  check) and its buff event or frame: "who creates buff X" in one command.
- The enum names it prints come from `ENUMS` in packages/cli/src/gamedata.ts;
  keep it in step with the table below (a `?` marks an inferred reading).

## What the data can't tell

Questions whose answer is not in either extraction, so the logs (or an
in-game test) decide them. Don't spend time establishing these negatives
again:

- **Skill-setting values.** Reaction and status values (Breach's DMG Taken,
  Corrosion's shred per tick, durations: keys with Chinese names such as
  `碎甲物理伤害提高`, `腐蚀每跳减抗`) are read in BuffData with
  `ReadSkillSettingData` from a skill-setting table that **isn't extracted**
  in rmxlinux or 555me (checked 2026-11-16). Coefficients come from the
  logs (combat-mechanics §3.7).
- **`enhanceAttributeSource` says nothing about scaling:** every
  skill-setting read carries it, whether the value scales or not.
- **Attribute tooltip formulas** (e.g. Arts Intensity's effect numbers)
  are computed in C#
  (`CS.Beyond.Gameplay.PhysicalAndSpellInflictionEnhanceFormatData`, called
  from the Lua UI), not in data. The only data on which effects Arts
  Intensity touches is the stat hint text of AttributeShowConfigTable
  (attribute 87).
- **Native templates:** the character template's plunging-attack pairing,
  the input mapping of buttons to skills, ProjectileData, AbilityEntityData
  and CharacterData are not in rmxlinux (the dive is paired by file names:
  skillData.ts `diveOf`).
- **What a battle log can't show:** buffs without a damage zone (speed,
  stance markers: ZMDLogs records only buffs it can value; data-sources.md
  "ZMDLogs").

## Known enum values

To be moved into the version-pinned enum map with a verifying effect for
each. Sources: End-DPScope `research/附录A 全属性列表.md` (MIT), the English
text table, BuffData effects, the kit analyses (docs/kit-batches/).

| Enum | Value | Meaning | Evidence |
|---|---|---|---|
| attributeType | 3 | DEF | End-DPScope list; `buff_chr_0016_laevat_*` |
| attributeType | 35–38 | Burst DMG increase | formula research |
| attributeType | 49 | IgniteDamageScalar (arts reaction / burst DMG) | End-DPScope list |
| attributeType | 56–59 | Combustion/… boost | formula research |
| attributeType | 61 | DamageToBrokenUnitIncrease (vs staggered) | End-DPScope list |
| attributeType | 62 | WeaknessDmgScalar | End-DPScope list |
| attributeType | 63 | ShelterDmgScalar (Protection) | End-DPScope list |
| attributeType | 64–69 | Amp | formula research |
| attributeType | 70–75 | Susceptibility | formula research |
| attributeType | 78, 79 | possibly Link-related; Link itself is applied as a `ComboCalcZone` damage modifier (`buff_common_affixes_skillimbue_atk`), not an attribute | unverified |
| attributeType | 94–98 | resistance points, five elements | English text table; Corrosion buff |
| costType | 0 / 1 | ultimate energy / SP | SkillPatchTable |
| buffEvent | 0 | on start (the buff is added) | inferred: kit-batches batch-3 chr_0007_ikut, batch-4 chr_0017_yvonne |
| buffEvent | 1 | on tick (every `triggerInterval`) | inferred: batch-4 chr_0017_yvonne |
| buffEvent | 2 | on finish | inferred: batch-3 chr_0007_ikut, batch-4 chr_0017_yvonne |
| buffEvent | 5 | while enabled (holds state actions: RefrainObtainUsp, SwitchMode, ChangeSkill, Speedup) | inferred: batch-4 chr_0017_yvonne; skillCompile.ts |
| buffEvent | 6 | on stack change (holds CheckBuffStackNumAdvanced) | inferred: batch-2 notes; `?` in `efsim gamedata` |
| buffEvent | 7 | on every stack added | inferred: batch-2 chr_0003_endminf row 16 |
| CompareFloat.compare | 0 / 1 / 2 / 3 / 4 | `<` / `<=` / `>` / `>=` / `==` | derived from branches whose meaning the descriptions fix: batch-1 chr_0032_lizhiyan, chr_0036_jsspsi |
| SpellInfliction.inflictionType | 0 / 1 / 2 / 3 | Heat / Electric / Cryo / Nature | batch-1 chr_0032_lizhiyan; design.md |
| lifeType | 0 / 1 | timed (its `duration`) / until something finishes it (duration ignored) | inferred: batch-1 chr_0034_typhoea (rows 8, 41: open test T1) |
| stackingType | 13 values | unlimited, high priority, stack, enhance, refresh, extend, modify, unique, enhance+refresh, overwrite duration, enhance+overwrite, high priority with max, timed growing enhance (order to verify) | Endaxis (described, not copied) |
