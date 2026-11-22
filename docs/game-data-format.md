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
- **`isEnable: false` on an action means it never runs** (hundreds of
  disabled actions in operator files: TimeDilationAction, FindTargetAction,
  CreateBuffAction, SpellInfliction, …). `efsim gamedata tree` prints
  `DISABLED (isEnable false)` on its line; a kit claim resting on such an
  action is wrong (Liino's volley trigger read a disabled
  CheckBuffIdInContext as a live condition from batch 1 to 2026-11-18).

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

### abilityEvent numbers

What an `EventListenerAction` / `abilityEventAction` listens to, collected
from the kits' notes and the batch reports (round 3, 2026-11-18). `efsim
gamedata tree` names them (packages/cli/src/gamedata.ts `ENUMS`, "?" kept);
a reading marked "?" comes from one file or one context only. Add a number
here (and to `ENUMS`) when a kit decodes one; `efsim gamedata tree <id>
--grep abilityEvent` shows a file's listeners with their names.

| abilityEvent | Meaning | Where it was read |
|---|---|---|
| 1 | the owner's HP reaches 0 (OnOwnerHpZero) | kit notes |
| 6 | entering battle | Liino, Perlica (stances) |
| 8 | the owner is defeated? | one note; Arcane's Imprisonment (buff_chr_0032_lizhiyan_combo_skill_seal) and combo_skill_precheck cast her explosion on 8, 1403 and 1601, guarded by has_finished: an end when the holder goes, not a timer (2026-11-22: the logs' ends fit the seal's tick, below) |
| 9 | a buff added to the holder (OnAddedBuff) | Purrchena, Camille, Catcher, weapons |
| 12 | takes damage? | Ember (one file) |
| 13 | deals damage (a landing of the holder's) | Catcher P1, Da Pan |
| 30 | casts a skill (with CheckSkillType) | Da Pan, weapons |
| 40 | applies Knock Down? | Lifeng U1 (only file using it) |
| 43 | the holder takes Critical DMG | gear |
| 44 | the holder scores a critical hit | weapons, gear |
| 45 | receives a heal (OnReceiveHeal) | Camille |
| 50 | heals someone (OnOutputHeal) | Camille, weapons |
| 55 | an enemy Lifted? (`buff_common_train_airborne`: "airborne success") | one file |
| 59 | suffers a physical status (anyone's) | Pogranichnik |
| 64 | an operator takes damage? | one note |
| 101 | takes damage, is hit (melee; 161 the projectile listener) | Purrchena, Catcher, Bounda, Antal, buffData.ts dash |
| 102 | applies a buff | Alesh, gear, weapons |
| 121 | an infliction applied to the enemy? (with CheckSpellInflictionType) | Bounda P5 |
| 122 | an infliction on the holder? | one note |
| 126 | applies an Arts Infliction (OnCharBeforeOutputSpellInfliction) | weapons, gear |
| 127 | applies an Arts Burst | weapons, gear |
| 141 | an enemy's charge interrupted? | one file |
| 142 | obtains SP (OnObtainAtb; CheckObtainAtbType) | Karin P1, Pogranichnik talent 1 |
| 143 | a skill cast, its cost paid? (with CheckSkillType) | Liino talent 2 |
| 150 | leaving battle | Pogranichnik |
| 202 | ? (a Corrosion buff Arcane applies) | Arcane |
| 203 | ? (resumecombo's end) | one note |
| 205 | a buff added to the aura holder, from anyone? | one note |
| 206 | applies a buff (OnBeforeOutputBuff) | weapons |
| 208 | removes / consumes a buff (CheckConsumeBuffLayer) | Da Pan, Last Rite, gear |
| 209 | a buff layer of the holder ends? | one note |
| 222 | a kill? | one note |
| 262 | an ability entity finished (OnAbilityEntityFinished) | one note |
| 302 | deals damage (OnBeforeOutputDamage) | Last Rite, Xaihi, weapons |
| 401 | applies a physical status | weapons, gear |
| 402 | applies a physical status? | one note |
| 1401 | the holder removed from the field? | one file: Wulfgard's combo_usetimer finishes itself |
| 1402 | the owner's spawned entities are to go? | Arcane's passive and combo_skill_seal_total: FinishOwnerAction on her clones (spawned objects with tag −1480463572) |
| 1403 | the holder removed from the field? | Arcane's seal and combo_skill_precheck (CheckTargetsEqual: the holder is the event's subject) cast her explosion early |
| 1601 | the holder handed over to another entity? | the same two (SaveTransferredSource, then CheckTargetsEqual on it) |

The 14xx / 1601 readings come from Arcane's files and one of Wulfgard's
(2026-11-22): all four clean up after an entity that leaves; none fires
against one boss mid-fight (her Imprisonment's logged ends fit the seal's
one tick at `trigger_time`, its duration − 0.5 s, wherever nothing holds
it: the kit note of chr_0032_lizhiyan `imprisonment`).

Seen without a reading: 21, 31 (resets `EntityBB_isCombo`), 155, 204.

