# Arclight (chr_0007_ikut): gap report, batch 3

Phase 1 (analysis only), against the engine at 7c7d00e (K2 done). Equipment
covered here ([batch-3.md](../batch-3.md)): wpn_sword_0015 (Aspirant),
wpn_sword_0018 (Twelve Questions). No gear set.

Sources: rmxlinux `Json/SkillData/chr_0007_ikut_*` (15 files),
`Json/BuffData/buff_chr_0007_ikut_*` (10 files, the two `buff_train_*` are
base-building), `sk_wpn_sword_0015`, `sk_wpn_sword_0018`,
`buff_wpn_sword_0015_exist`, `buff_wpn_sword_0015_pdi_up`,
`buff_wpn_sword_0018_atk_up`; TableCfg CharGrowthTable, SkillPatchTable,
CharacterPotentialTable, PotentialTalentEffectTable, WeaponBasicTable,
I18nTextTable_EN; `efsim kit-draft chr_0007_ikut`. The SkillData and
BuffData files came into the checkout during this analysis (535e88f); every
row below is read from them. No earlier report covers Arclight; the facts
reused from earlier reports are marked as claims and were re-checked where
they matter (Liino's report: tag 1474064594 = "Arts Reaction"; BuffData
buffEvent codes 0 start / 2 finish; `atbSourceType 3` = returned SP;
abilityEvent 402 + CheckPhysicalInflictionType mask 1 = Lift, from Gilberta's
Delivery Guaranteed). Scratch: `/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0007_ikut/`
(draft kits in `kits/`, a repo copy with them in `repo/`, scenarios in `scen/`).

## Skill values (SkillPatchTable, level 1 / 12)

| Skill | Values | Cooldown / cost |
|---|---|---|
| attack1–4 | `atk_scale` 0.10/0.23, 0.13/0.28, 0.13/0.29, 0.12/0.27; `display_atk_scale` (attack3 2×, attack4 3×); `atb` 0 | |
| attack5 | `atk_scale` 0.48/1.07, `poise` 16, `atb` 17 | |
| power_attack (finisher) | `atk_scale` 4/9 | |
| plunging_attack_end | `atk_scale` 0.8/1.8, `atb` 0 | |
| dash_attack | `atk_scale` 0.12/0.27, `atk_scale2` 0.28/0.64, `poise` 5, `atb` 5 | not in a skill group |
| normal_skill | `atk_scale` 0.45/1.01, `atk_scale2` 1.8/4.05, `poise1` 5, `poise2` 5, `atb` 30/40 | 100 SP |
| combo_skill | `atk_scale` 0.52/1.17 (`display_atk_scale` 3×), `poise` 5, `atb` 8/10, `usp` 5 | 3 s at every level (SkillData castData says 5; the table wins) |
| ultimate_skill | `atk_scale1` 1.56/3.5, `atk_scale2` 2.44/5.5, `poise1`/`poise2` 7 (10 at 12) | 90 energy, 15 s |

The battle skill's other keys (`pulse_up`, `talent_1`, `count`, `duration`,
`thirdhit`, `SpawnThird`, `exist_p5`) are SkillData blackboard defaults (0),
set by the talents and potentials:

- Talent 1 "Wildland Trekker" (`chr_0007_ikut_talent_1_1` / `_1_2`):
  skillBbModifiers on `chr_0007_ikut_normal_skill`: `talent_1` = 1,
  `duration` = 15, `pulse_up` += 0.0005 / 0.0008, `count` = 3. Text:
  "Triggering the additional effect {count} time(s) grants the team Electric
  DMG Dealt +{pulse_up} for every point of Arclight's Intellect. This effect
  has a {duration}s duration and cannot stack."
- Talent 2 "Hannabit Wisdom": attaches `buff_chr_0007_ikut_talent_2`
  (`prob` 0.3 / 0.5): "chance to ignore an Arts Infliction applied on her".
- P1: `atb` += 10 on the battle skill ("After triggering additional
  effects, the skill recovers another 10 SP"). P2: Agility +15, Intellect
  +15. P3: `pulse_up` ×1.3. P4: ultimate cost ×0.85 (76.5). P5: `count` = 2,
  and attaches `buff_chr_0007_ikut_finish_count_p5`.
- Attribute nodes: Agility +10 / +15 / +15 / +20.

`efsim calc` (P5, level 90, Twelve Questions 9/9/9) applies these in the
order talents → potentials, so `pulse_up` = 0.0008 × 1.3 = 0.00104.

## SkillData / BuffData action types

Presentation types (effects, sound, camera, animation, root motion,
rotation, teleport, show/hide, weapon visibility, voice) left out. D =
damage, R = resources, S = state, T = timing / legality.

| File | Gameplay types | Affect |
|---|---|---|
| attack1 / 2 / 3 | DamageAction `atk_scale` mask 128 (5 / 5 / 7 + 13), AllowNextSkillAction, ComboCacheAction | D, T |
| attack4 | ChannelingAction (executeEachFrame, interval 0.033 s, maxCountPerTarget 3) → DamageAction `atk_scale` (frames 5, 6, 7), ObtainCostAction `atb`; AllowNextSkillAction 27–40 | D, R, T |
| attack5 | DamageAction `atk_scale` mask 2097280 (Final Strike) + poise unit `poise` (onlyEnableForMainChar) at 12; ObtainCostAction `atb` | D, R |
| power_attack | DamageAction BreakingAttackCalculation `atk_scale` × multiplier 0.05 / 0.05 / 0.9 at 15 / 23 / 38 (mask 132), GainBreakingAttackAtb 38, `buff_common_power_attack_disable_cast_skill` 0–40, `full_immune_medium` 0–68 | D, R, T |
| plunging_attack_end | DamageAction mask 1152 at 1 | D |
| dash_attack (skillSpecification 7) | DamageAction `atk_scale` + `poise` at 5, `atk_scale2` + `poise` at 9 (mask 131200) | D |
| normal_skill | frame 0 IfElse CheckTagMatch 1466867135 (Electrification) on the target → ModifyDynamicBlackboard `SpawnThird` = 1; frame 4 JumpToAction → 96 if `SpawnThird` = 1; frames 19 / 24 DamageAction `atk_scale` (24: + `poise1`, CreateBuff `buff_common_obtain_ultimate_sp`); frame 95 JumpToAction → 204 (always); frames 112 / 118 DamageAction `atk_scale` (118: + `poise1`); frame 136 IfElse (below); InterruptAction (1 s) and HitStopAction on every hit; SetSuperArmor; AllowNextSkillAction 36–60 and 162–188; durationFrame 214, exclusiveFrame 164 | D, R, S, T |
| normal_skill, frame 136 | IfElse CheckDistanceCondition < 5 on the smart target: **true** → IfElse CheckTagMatch 1466867135: **true** → [IfElse `talent_1` > 0 → CreateBuff `buff_chr_0007_ikut_normal_skill_extra_count` (`pulse_up`, `duration`, `count`)], ObtainCostAction costType 1 `atb` atbSourceType 3, DamageAction `atk_scale2` damageType 3 (Electric) + `poise2` on the smart target, `thirdhit` = 1, DamageAction `atk_scale` on `tar` (excludes the smart target), CreateBuff `buff_common_obtain_ultimate_sp`, FinishBuffAdvanced tag 1466867135 (isFinishedEarly); **false** → DamageAction `atk_scale` + `poise2` on the smart target, DamageAction `atk_scale` on `tar`, team energy; distance **false** → DamageAction `atk_scale` on `tar`, team energy | D, R, S |
| combo_skill | FinishBuff `buff_chr_0007_ikut_combo_skill_counts` 0–3; TimeDilationAction ComboSkill 0.5 s (influenceSkillCdTime 0.4); frame 17 ObtainCostAction `atb` (atbSourceType 3), DamageAction `atk_scale` mask 12288 + `poise`, ObtainCostAction costType 0 `usp`; frames 21, 25 DamageAction `atk_scale`; 25 CreateBuff tutorial marker; AllowNextSkillAction 27–60; durationFrame 86, exclusiveFrame 37 | D, R, T |
| ultimate_skill | TimeDilationAction RESETto1, UltimateTimeAction 0–56, ChannelingCastingAction 0–85 (cantCastSkill, cantSwitchPosition), `buff_common_damage_immune_ult_skill` 0–85, SpawnAbilityEntity `abilityentity_chr_0007_ikut_ultimate_skill` at 54, AllowNextSkillAction 77–89; durationFrame 141, exclusiveFrame 85 | T |
| ultimate_skill_abentity | frame 7: SpellInfliction type 1 (Electric), DamageAction `atk_scale1` damageType 3 mask 4608 + `poise1`; ForEach CheckSuperArmor < 10 → HitStopAction 3 s on the target; frame 63: DamageAction `atk_scale2` + `poise2`, then ForEach: CheckTagMatch 2123008650 (Electric Infliction) → SaveBuffStackNumByTag `count` → ForceSpellStatusAction spellStatusType 1 (Electrification), `count` = `consumedLayer` = `count`, consumedType 1 | D, S |
| buff_…_normal_skill_extra_count | lifeType 1, duration literal 10, stackingType 3, max 3, has an icon (icon_battle_ikut_talent_1); buffEvent 6: CheckBuffStackNumAdvanced ≥ `count` → StoreAttributeValue attr 41 (Intellect) × `pulse_up` → `final_pulse_up` → CreateBuff `buff_chr_0007_ikut_atk_buff_talent` on CharacterTeamFinder, then FinishBuffAdvanced all `extra_count` layers | S |
| buff_…_atk_buff_talent | attr 52 (Electric DMG) formulaItem 5 `pulse_up`, `duration`, stackingType 2 max 1 | D |
| buff_…_finish_count_p5 | lifeType 1; buffEvent 0: FinishBuffAdvanced all `extra_count` layers | S (none in a fresh fight) |
| buff_…_talent_2 | abilityEvent 122 (an infliction on her) + Probablity `prob` → `_talent_2_immune` (tag −956116137) | none on damage |
| chr_0007_ikut_talent_1 (SkillData), buff_…_talent_1 | Physical / Electric DMG from an attribute (`threshold` 15, ticks every 1 s): **orphans**, no table attaches them | none |
| buff_…_atk_buff_talent_p5 | ATK `atk_up`, stackingType 8: **orphan** (nothing creates it) | none |
| buff_…_combo_skill_counts, _tutorial_marker, _normal_skill_hide | counter finished by the combo but created by nothing; markers; ShowHideActor | none |
| sk_wpn_sword_0015 | cardAttributeModifier attr 28 `dmg_up`; abilityEvent 402 + CheckPhysicalInflictionType mask 1 + CheckTimedMarker / CreateTimedMarker 0.5 s → CreateBuffAttachingSkill `buff_wpn_sword_0015_exist`; abilityEvent 30 + CheckSkillType [7] → SaveBuffStackNumAdvanced `count` of `_exist`, SimpleCalcBB `phy_dmg` = `phy_dmg_up` × `count` → `_pdi_up` | D, S |
| buff_wpn_sword_0015_exist / _pdi_up | `_exist`: no modifier, `duration`, stackingType 2 max `max_stack`; `_pdi_up`: attr 50 formulaItem 5, lifeType 1, buffEvent 2 (finish) → FinishBuffAdvanced all `_exist` | D |
| sk_wpn_sword_0018 / buff_wpn_sword_0018_atk_up | cardAttributeModifier attr 0 formulaItem 6 modifyAttributeType 2 (secondary attribute %); abilityEvent 208 + CheckBuffIdInContext checkType 1 tag 1474064594 → `_atk_up` (attr 2 formulaItem 6 `atk_up`, `duration`, stackingType 2 max `max_stack`) | D |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: `atk_scale`, frames 5 / 5 / 7, 13 / 5, 6, 7 (attack4: a 3-tick ChannelingAction) | supported | `hits` from kit-draft; display 2× / 3× is the count |
| 2 | Attack5 Final Strike: frame 12, mask 2097280, stagger `poise` 16 only as controlled, SP `atb` 17 | supported | `sp: atb`, `poise`, `poiseControlledOnly`; Final Strike from the data |
| 3 | Finisher: three BreakingAttackCalculation landings, multipliers 0.05 / 0.05 / 0.9 | data | D3 (finisher factors): three hits with `factor` by hand |
| 4 | Dive attack (`plunging_attack_end`) | supported | not castable until rotations have jumps (S10) |
| 5 | Dash attack (`dash_attack`, specification 7, in no skill group) | supported | left out, as for every operator (design.md: the dash attack isn't modelled) |
| 6 | Battle skill: two variants chosen at the cast by whether the target has Electrification (frame 0 → `SpawnThird`, frame-4 jump to 96) | gap | **G2**: `KitSkill.jumps[].if` can't read the enemy: `{jumps: [{at: 4, if: {enemyStatus: electrification}}]}` loads, but every cast throws "a kit condition can't be decided here" |
| 7 | Without Electrification: slashes at 19, 24 (`atk_scale`; `poise1` on the second), then the jump 95 → 204 (ends at 105) | supported | hits `slash1`, `slash2` (`poise: poise1`); the unconditional jump is the data's |
| 8 | With Electrification: slashes at 112, 118 (cast frames 20, 26 after the jump), `poise1` on the second | supported | hits `slash1_e`, `slash2_e` at frames 112, 118 (the jump moves them) |
| 9 | "If the enemy has active Electrification, consume the Electrification to unleash an additional attack that deals Electric DMG and recovers some SP": frame 136 (cast 44), `atk_scale2` Electric, `poise2`, SP `atb` (atbSourceType 3: returned), only if the target still has Electrification at 136 | supported | hit `extra`: `element: pulse`, `branch: third`, `if: {enemyStatus: electrification}`, `sp: atb`, `poise: poise2` |
| 10 | The same frame without Electrification (consumed by someone between the cast and 136): a third physical slash `atk_scale` + `poise2` (not in the description) | supported | hit `third`, same `branch` |
| 11 | The extra attack's FinishBuffAdvanced comes after its DamageAction: the extra hit still has Electrification's Arts DMG Taken (+12–24% × Arts Intensity) | supported | trigger `on: {event: hit, skills: [normal_skill], elements: [pulse]}` → `consumeStatus` (a hit trigger runs after the damage; an `applies` entry would run before it). Scratch run: the extra hit 8,625 = 5,924 × Link 1.3 × Electrification I 1.12 |
| 12 | Frame-136 hits on `tar` (every other enemy in range, the main target excluded) | supported | no effect against one enemy |
| 13 | Team energy (`buff_common_obtain_ultimate_sp`) at frame 24 without Electrification, at 136 with it | gap | **G1**: `teamEnergy: [{frame: 24, ratio: 1}, {frame: 136, ratio: 1}]` is refused ("the team's energy's parts add up to more than the whole") though the jumps make them exclusive; the engine already drops the skipped part (scratch run with the check removed: energy 5.0 → 10.9 after the hit, not at the cast) |
| 14 | CheckDistanceCondition < 5 at 136 | supported | assumed in range (melee, she blinks to the target) |
| 15 | Battle-skill windows 36–60 and 162–188, exclusiveFrame 164, InterruptAction (1 s, not Immobilization), hit-stops | supported | data (S3); hit-stop not modelled (Ti1b) |
| 16 | kit-draft's battle skill: both variants' four slashes as one hit of count 4, the frame-136 alternatives as four extra hits (one with `atk_scale` and `sp: atb`), team energy at 24 only | data | D3 (jump branches and IfElse alternatives as alternatives) |
| 17 | Combo trigger: "When an enemy suffers Electrification or after an enemy's Electrification is consumed" | supported | `{on: reaction, statuses: [electrification]}` and `{on: statusConsumed, statuses: [electrification]}`, both `by: anyone` (her own ultimate's forced Electrification and her battle skill's consumption included) |
| 18 | Combo: three slashes at 17 / 21 / 25 (`atk_scale` each = `display_atk_scale` / 3), `poise` 5 and SP `atb` (returned) and `usp` 5 on the first | supported | `hit1` (`energy: usp`, `sp: atb`, `poise`), `hit2` count 2 |
| 19 | Combo cooldown 3 s; TimeDilationAction ComboSkill 0.5 s | supported | data (Ti1) |
| 20 | A combo trigger during the combo's 3 s cooldown (e.g. her battle skill's consumption 1.5 s after a combo) | unknown | engine-wide interim: the window is ignored while on cooldown. In-game test A2 |
| 21 | Combo: FinishBuff `combo_skill_counts`, tutorial marker; blackboard `exist_talent`, `atk_up`, `exist_p5`, `count`, `duration` | supported | dead data: nothing creates the buff or reads the keys |
| 22 | Ultimate dash: entity frame 7 (cast 61): Electric DMG `atk_scale1`, Electric Infliction, `poise1` | supported | hit `dash` (`detached`, `applies` infliction pulse) |
| 23 | Ultimate explosion: entity frame 63 (cast 117): Electric DMG `atk_scale2`, `poise2` | supported | hit `explosion` (`detached`) |
| 24 | "If the enemy has active Electric Infliction, consume the Electric Infliction and forcibly apply Electrification": after the explosion's DamageAction, level = the stacks consumed | supported | cast trigger `delay: 118`, `detached`: four `forcedReaction` entries (level n `if` exactly n Electric stacks), then `consumeInfliction` pulse. Scratch run: forced Electrification I at 3.93 s, "consumed 1 pulse" |
| 25 | kit-draft's ultimate: the forced Electrification in the explosion's `applies` (before its damage) and without its level | data | D3 (level from SaveBuffStackNumByTag; ForEach after the DamageAction) |
| 26 | Ultimate time stop 0–56, channel 0–85 (cantCastSkill / cantSwitch), damage immunity, windows 77–89, cost 90, cooldown 15 s; P4 ×0.85 | supported | data (Ti1, S9); `calc` / scenario: cost 76.5 at P5 |
| 27 | Ultimate: enemies with super armor below 10 frozen 3 s (CheckSuperArmor → HitStopAction) | supported | not modelled, like the Endministrator's seal (batch-2 G6, deferred: no super armor in EnemyData, bosses unaffected) |
| 28 | Talent 1 counter: one `extra_count` layer per extra attack while `talent_1` > 0 (stackingType 3, max 3, lifeType 1) | supported | stack `wildland_count` (max 3); `gains` on `extra` with `if: {talentAtLeast: [0, 1]}` |
| 29 | Talent 1 grant: at `count` layers (3; P5: 2) the team gets Electric DMG +`pulse_up` × her Intellect (StoreAttributeValue at the grant), `duration` 15 s, a new grant replaces it; the layers end | supported | team buff `wildland_trekker` `{attr: 52, value: {product: ["pulse_up", {attr: 41}]}}` (values for the applier at application); `stackAtLeast` triggers (3 below P5, 2 at P5) reset the counter. Scratch: +16.4% at P5 with Twelve Questions (Intellect 157.9) |
| 30 | The grant comes before the completing extra hit's damage (CreateBuff `extra_count` precedes the DamageAction; its handler is buffEvent 6) | unknown | the kit gives the buff from the hit itself (`buffs: [{buff, beforeDamage: true, if: count reached}]`; the hit's `if` is judged after its gains). buffEvent 6 isn't in the code table (0 start, 1 trigger, 2 finish, 3 enable, 5, 10): the reading "a layer was added" fits the ≥ `count` check. In-game test A1 |
| 31 | Counter lifetime: lifeType 1 (no expiry, as the engine reads it elsewhere) with a duration literal 10 s | unknown | interim: no expiry (the stack never times out). Extras are usually more than 10 s apart without an Electrification teammate, so this decides whether talent 1 ever fires in such teams. In-game test A1; same data pattern as test 42 (Typhoeus's Signs) |
| 32 | Talent values through skillBbModifiers (set / add) on the battle skill's SkillData defaults; P3 ×1.3 after the talent's add; P5 `count` = 2 | supported | data (stats.ts applies talents, then potentials) |
| 33 | P5's attached `finish_count_p5`: clears the counter when it starts | supported | no effect in a fresh fight |
| 34 | P1: +10 SP after the extra attack | supported | data (`atb` + 10; the extra's `sp: atb` reads it) |
| 35 | P2 Agility +15, Intellect +15; attribute nodes | supported | data (stat panel) |
| 36 | Talent 2: a chance to ignore an Arts Infliction applied on her | supported | no effect: enemies' attacks don't inflict operators in the engine |
| 37 | Orphans: `chr_0007_ikut_talent_1` SkillData + `buff_chr_0007_ikut_talent_1`, `buff_…_atk_buff_talent_p5` | supported | dead data (no table attaches them, nothing creates the P5 buff); left out |
| 38 | Dodge | supported | generic (E1) |
| W1 | Aspirant: Agility, Physical DMG, Ultimate DMG +`dmg_up` (attr 28) | supported | data (`calc`: Ultimate DMG +44.8%, Physical DMG +34.7% at 9/9/9) |
| W2 | Aspirant: "After the wielder applies Lift ... Effect only triggers once every 0.5s": a layer of `_exist` (max 3, each 30 s) | supported | trigger `{on: physicalStatus, statuses: [lift]}`, `by: self`, `cooldown: 0.5` → layered buff |
| W3 | Aspirant: "during the next ultimate cast within {duration}s, the wielder gains Physical DMG Dealt +{phy_dmg_up}" × layers, then every layer ends | supported | layers carry `{attr: 50, value: phy_dmg_up}` with `consumedBy: [ultimate]`: the next ultimate uses all of them for its own hits (`calc --buff …:3`: attack5 ×1.749 = (1.347 + 3 × 0.336) / 1.347) |
| W4 | Aspirant: layers added during the consuming ultimate end with it in the game (`_pdi_up` buffEvent 2 finishes all `_exist`); the engine keeps them for the next ultimate | supported | edge case only for a wielder whose own ultimate Lifts; noted in the kit, no gap proposed |
| W5 | Aspirant on Arclight: she applies no Lift, and her ultimate is Electric | supported | only W1 acts (equipment is generic; nothing to write) |
| W6 | Twelve Questions: Agility, ATK %, secondary attribute +`second_attr_up` % | supported | data (`calc`: Intellect 138.49 → 157.88 = × 1.14; ATK +31.2%) |
| W7 | Twelve Questions: "After the wielder consumes an Arts Reaction, ATK +{atk_up} for {duration}s", 2 layers with their own durations | supported | trigger `{on: statusConsumed}` (any status), `by: self` → layered `zone: atk` buff. Scratch: her basic attacks ×1.16 after the extra attack consumes Electrification. Her ultimate consumes an infliction, not a reaction: no buff (correct) |
| W8 | Whether a Shatter by the wielder (Solidification ended by a physical status) is "consuming an Arts Reaction" | unknown | the engine's Shatter emits `shatter`, not `statusConsumed`. In-game test A3 (needs another wielder: Arclight can't Shatter) |
| W9 | Both weapons' `switchToBuffConfig` → `buff_wpn_passive_spirit_01` | supported | no file (as in batches 1 and 2): inert |

**Counts** (47 rows): supported 38 (8 of them data-only: rows 15, 19, 26,
32, 34, 35, W1, W6), gap 2 (rows 6, 13), data 3 (rows 3,
16, 25), unknown 4 (rows 20, 30, 31, W8), unique? 0.

Checked against [kit-unique.md](../../kit-unique.md) and the kits: nothing
is unique. Consuming a reaction status and opening a combo on its
consumption are Liino's (`consumeStatus`, `statusConsumed`); a team buff
scaled by the caster's attribute is the Endministrator's / Akekuri's value
pattern; next-cast buffs are Jade Vessel's; Lift-triggered weapons are
Gilberta's.

## Gaps

### G1. Team-energy parts on exclusive jump paths

- **family:** skills (team energy in parts, batch-2 S5)
- **feature:** the loader's check that `teamEnergy` ratios add up to at
  most 1 counts only parts that can happen in one cast: parts separated by
  a jump that skips one of them are alternatives (sum per path through the
  skill's jumps, `SkillTiming.jumps` with the kit's `jumps` conditions), or
  the check is dropped when the parts have `if`s or lie in a jumped range.
  The engine needs nothing: `takeJump` already drops a skipped part.
- **evidence:** `chr_0007_ikut_normal_skill` CreateBuff
  `buff_common_obtain_ultimate_sp` at frame 24 (before the jump 95 → 204)
  and in all three frame-136 branches (after the jump 4 → 96); kit-draft
  emits only the first. Loader: "the team energy's parts add up to more
  than the whole". With the check removed in the scratch copy, the
  Electrification variant gives the team its energy at the extra attack
  (5.0 → 10.9 after the cast), the plain one at frame 24.
- **impact:** small: the team's 6.5 energy per battle skill comes at the
  cast instead of 0.8 s or 1.5 s later. Interim: no `teamEnergy` (at the
  cast).

### G2. Cast-time conditions can't read the enemy

- **family:** conditions (where a Predicate is evaluated) / skills (jumps)
- **feature:** the situation a cast is judged in (`castSituation` in
  timeline.ts: `KitSkill.jumps[].if`, `requires`, hit availability at the
  cast) includes the enemy's state at the cast frame
  (`enemy: expireStatus(s.enemy, frame)`, and `staggered`), as hit and
  trigger situations do. The data's frame-0 checks read the target
  (CheckTagMatch on the smart target), so `enemyStatus`, `enemyInfliction`,
  `enemyPhysical`, `enemyBuff` must be decidable there.
- **evidence:** `chr_0007_ikut_normal_skill` frame 0 IfElse CheckTagMatch
  1466867135 → `SpawnThird` = 1, frame 4 JumpToAction → 96 if `SpawnThird`
  = 1. With `jumps: [{at: 4, if: {enemyStatus: "electrification"}}]` the
  kit loads, but `simulate` stops at the first battle skill: "a kit
  condition can't be decided here: {"enemyStatus":"electrification"}". A
  one-line patch in the scratch copy (the `enemy` field above) makes it run:
  both variants, frames and the extra attack as in the rows above, and
  `npx vitest run` passes there (24 files, 600 tests).
- **impact:** without it Arclight's battle skill can't be simulated with
  its real structure. Leaving the jump out loses the extra attack, her
  largest hit (`atk_scale2` 4.05 vs 2 × 1.01 for the slashes at level 12,
  plus Electrification's Arts DMG Taken), the SP return, talent 1 and her
  own combo trigger. Likely shared: any skill whose frame-0 check reads the
  target.

## Verification

**No fixture has Arclight** or either weapon (`grep` over `fixtures/` and
`fixtures/pending/`), so nothing is checked against a log.

**Scratch runs** (repo copy with the draft kits and the G2 patch; scenarios
in `scen/`): the draft kits load with the real loader (`calc`, `simulate`)
and the copy's test suite passes. `arclight-solo.scenario.json` (P5, Twelve
Questions, full energy): ultimate dash 5,120 at 2.03 s, explosion 8,045 at
3.90 s, forced Electrification I and the infliction consumed at 3.93 s;
combo (opened by it) 3 × 1,711; battle skill at 5.40 s takes the
Electrification variant: slashes 1,921 × 2 at 6.07 / 6.27 s (Link from the
combo, ×1.3), the extra attack 8,625 at 6.87 s, then Electrification
consumed; Twelve Questions' ATK raises the following basic attacks ×1.16;
a second battle skill at 10.40 s without Electrification: two slashes at
11.03 / 11.20 s. `arclight-talent.scenario.json` (counter started at 1,
P5): the extra attack that completes the count is 10,042 = 8,625 × 1.164
(talent 1 on it); started at 0 it stays 8,625.

**Logs that would verify the kit:**
- Arclight with an Electrification source (Avywenna or Perlica after a
  Heat or Cryo teammate, or her own ultimate): both battle-skill variants
  (key `chr_0007_ikut_normal_skill`; the extra hit's Electric element and
  Electrification on it), the frame-136 third slash when someone else
  consumed the Electrification, combos after a teammate's Electrification
  and after her own consumption (`chr_0007_ikut_combo_skill`), the
  ultimate (`chr_0007_ikut_ultimate_skill_abentity`) on an enemy with 2+
  Electric stacks (forced level), and teammates' Electric hits under
  `buff_chr_0007_ikut_atk_buff_talent` (its value fixes Intellect ×
  `pulse_up`, its start the counter's timing).
- Twelve Questions on her (`buff_wpn_sword_0018_atk_up` on her hits after
  each extra attack); Aspirant on a sword wielder that Lifts (Chen Qianyu?
  per her report), `buff_wpn_sword_0015_pdi_up` on that wielder's ultimate.

**In-game tests** (none in docs/in-game-tests.md covers these; numbers at
the merge). Arclight is a 5-star every player has:

- **A1. Wildland Trekker's counter (ready).** (a) Lifetime: get
  Electrification on a dummy (her ultimate does it), cast her battle skill:
  the talent icon (squad bar) appears with the first extra attack. Watch it
  for 15 s: does it vanish after about 10 s (the data's 10 s literal) or
  stay until the next extra attacks (lifeType 1, the engine)? (b) Timing,
  at P5 (count 2): two extra attacks within 10 s with nothing else changed
  (no combo between them): is the second extra attack's number about 16%
  higher than the first (the buff before its damage, the engine) or the
  same (after)? The team's Electric DMG icon should appear as it lands.
  Electrification twice within 10 s needs a teammate who causes it (an
  Electric hit on a Heat- or Cryo-inflicted enemy).
- **A2. A combo trigger during the combo's cooldown (ready; affects every
  operator with short combo cooldowns).** Ultimate on a dummy, then her combo
  as soon as it lights up, then at once her battle skill (the dummy still has
  the ultimate's Electrification): its extra attack consumes it about 2.4 s
  after the combo, inside the 3 s cooldown. When the cooldown ends, does the
  combo button light up without another Electrification? Engine: no (a
  trigger during the cooldown opens nothing). If the button is already lit
  before the extra attack lands, cast the battle skill sooner.
- **A3. Twelve Questions and Shatter (later; needs Twelve Questions on a
  sword operator that Shatters, e.g. the Endministrator's Crush on a
  Solidified enemy).** After the Shatter, does the ATK-up icon appear on
  the wielder? Engine: no (only a reaction status consumed by a hit
  counts). Low priority: Arclight herself can't Shatter.
- Test 35 asks the same as row 17 for other combos (a reaction the
  operator causes itself); test 17's rule (jumps skip time) is what makes
  rows 7–8 right (the two variants differ by 0.57 s in length: not
  testable by hand on their own).

## Kit plan

As it would be written today; the drafts are
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0007_ikut/kits/`
(chr_0007_ikut.json, wpn_sword_0015.json, wpn_sword_0018.json). They load
with the real loader; `simulate` needs G2 (patched in the scratch copy).

**Operator kit** `chr_0007_ikut.json`, `element: physical` (the default
hit element: her basic attacks, slashes and combo are Physical; the extra
attack and the ultimate say `element: pulse`).

| Skill | Hit | Scale | Frames | Other |
|---|---|---|---|---|
| attack1 / 2 | hit | `atk_scale` | 5 / 5 | `sp: atb` (0) |
| attack3 | hit ×2 | `atk_scale` | 7, 13 | `sp: atb × 0.5` (0) |
| attack4 | hit ×3 | `atk_scale` | 5, 6, 7 | `sp: atb` (0) |
| attack5 | hit | `atk_scale` | 12 | `sp: atb`, `poise`, `poiseControlledOnly`; Final Strike from the data |
| power_attack | hit1–3 | `atk_scale` | 15, 23, 38 | `factor` 0.05, 0.05, 0.9 |
| plunging_attack_end | hit | `atk_scale` | 1 | |
| normal_skill | slash1, slash2 | `atk_scale` | 19, 24 | taken without Electrification at the cast; slash2 `poise: poise1` |
| | slash1_e, slash2_e | `atk_scale` | 112, 118 | after the frame-4 jump; slash2_e `poise: poise1` |
| | extra | `atk_scale2` | 136 | pulse, `branch: third`, `if` Electrification, `sp: atb`, `poise: poise2`, counter gain and talent buff |
| | third | `atk_scale` | 136 | `branch: third`, `poise: poise2` |
| combo_skill | hit1, hit2 ×2 | `atk_scale` | 17; 21, 25 | hit1 `energy: usp`, `sp: atb`, `poise` |
| ultimate_skill | dash, explosion | `atk_scale1`, `atk_scale2` | 61, 117 | pulse, `detached`, `poise1` / `poise2`; dash inflicts Electric |

Battle skill and its extra attack:

```json
{ "skillId": "chr_0007_ikut_normal_skill", "label": "Tempestuous Arc", "damageType": "battle",
  "jumps": [{ "at": 4, "if": { "enemyStatus": "electrification" } }],
  "hits": [
    { "id": "slash1", "scale": ["atk_scale"], "frames": [19], "events": ["chr_0007_ikut_normal_skill"] },
    { "id": "slash2", "scale": ["atk_scale"], "frames": [24], "events": ["chr_0007_ikut_normal_skill"], "poise": "poise1" },
    { "id": "slash1_e", "scale": ["atk_scale"], "frames": [112], "events": ["chr_0007_ikut_normal_skill"] },
    { "id": "slash2_e", "scale": ["atk_scale"], "frames": [118], "events": ["chr_0007_ikut_normal_skill"], "poise": "poise1" },
    { "id": "extra", "scale": ["atk_scale2"], "element": "pulse", "frames": [136], "events": ["chr_0007_ikut_normal_skill"],
      "branch": "third", "if": { "enemyStatus": "electrification" }, "poise": "poise2", "sp": "atb",
      "gains": [{ "stack": "wildland_count", "amount": 1, "if": { "talentAtLeast": [0, 1] } }],
      "buffs": [{ "buff": "wildland_trekker", "beforeDamage": true,
                  "if": { "all": [{ "talentAtLeast": [0, 1] },
                                  { "any": [{ "all": [{ "potentialAtLeast": 5 }, { "stack": "wildland_count", "atLeast": 2 }] },
                                            { "stack": "wildland_count", "atLeast": 3 }] }] } }] },
    { "id": "third", "scale": ["atk_scale"], "frames": [136], "events": ["chr_0007_ikut_normal_skill"], "branch": "third", "poise": "poise2" }
  ] }
```

Stack `wildland_count` (max 3). Buff `wildland_trekker`: team,
`gameBuff: buff_chr_0007_ikut_atk_buff_talent`, `duration: duration`,
`{attr: 52, value: {product: ["pulse_up", {attr: 41}]}}`. Triggers:

```json
{ "id": "combo_on_electrification", "on": { "event": "reaction", "statuses": ["electrification"] }, "by": "anyone", "do": [{ "kind": "openCombo" }] },
{ "id": "combo_on_consumed", "on": { "event": "statusConsumed", "statuses": ["electrification"] }, "by": "anyone", "do": [{ "kind": "openCombo" }] },
{ "id": "extra_consumes", "on": { "event": "hit", "skills": ["chr_0007_ikut_normal_skill"], "elements": ["pulse"] }, "by": "self",
  "do": [{ "kind": "apply", "applies": [{ "kind": "consumeStatus", "statuses": ["electrification"] }] }] },
{ "id": "wildland_reset", "on": { "event": "stackAtLeast", "stack": "wildland_count", "atLeast": 3 }, "by": "self",
  "if": { "not": { "potentialAtLeast": 5 } }, "do": [{ "kind": "gain", "gains": [{ "stack": "wildland_count", "amount": -3 }] }] },
{ "id": "wildland_reset_p5", "on": { "event": "stackAtLeast", "stack": "wildland_count", "atLeast": 2 }, "by": "self",
  "if": { "potentialAtLeast": 5 }, "do": [{ "kind": "gain", "gains": [{ "stack": "wildland_count", "amount": -3 }] }] },
{ "id": "ult_electrify", "on": { "event": "cast", "skills": ["chr_0007_ikut_ultimate_skill"] }, "by": "self", "delay": 118, "detached": true,
  "do": [{ "kind": "apply", "applies": [
    { "kind": "forcedReaction", "status": "electrification", "level": 1, "if": { "all": [{ "enemyInfliction": "pulse", "minStacks": 1 }, { "not": { "enemyInfliction": "pulse", "minStacks": 2 } }] } },
    { "kind": "forcedReaction", "status": "electrification", "level": 2, "if": { "all": [{ "enemyInfliction": "pulse", "minStacks": 2 }, { "not": { "enemyInfliction": "pulse", "minStacks": 3 } }] } },
    { "kind": "forcedReaction", "status": "electrification", "level": 3, "if": { "all": [{ "enemyInfliction": "pulse", "minStacks": 3 }, { "not": { "enemyInfliction": "pulse", "minStacks": 4 } }] } },
    { "kind": "forcedReaction", "status": "electrification", "level": 4, "if": { "enemyInfliction": "pulse", "minStacks": 4 } },
    { "kind": "consumeInfliction", "elements": ["pulse"] } ] }] }
```

Notes for the kits phase:
- The extra attack's consumption is a hit trigger, not an `applies`
  entry, so the hit keeps Electrification's Arts DMG Taken (row 11). It is
  the only Electric hit of the battle skill, which the `elements` filter
  relies on.
- The talent buff is given by the completing hit itself (before its
  damage; its `if` is judged after the hit's gains, hence 2 / 3 after the
  gain); the `stackAtLeast` triggers only reset the counter. If test A1
  shows the buff comes after the hit, move the buff into the reset
  triggers.
- The ultimate's forced Electrification runs one frame after the explosion
  (the data's ForEach follows its DamageAction on the same frame); its
  level needs four conditional entries because `forcedReaction.level` is a
  number. A ValueExpr level (with the enemy's infliction stacks as a value)
  would shorten it; not proposed as a gap since it is expressible.
- Waiting on gaps: G2 (the jump `if`; until then the battle skill can't be
  cast in a simulation), G1 (team energy at frames 24 / 136; interim at the
  cast). D3 would compile rows 3, 16 and 25.

**Equipment kits** (values from each weapon's skill 3):

- `wpn_sword_0015` (Aspirant): buff `wpn_sword_0015.lift` (self,
  `gameBuff: buff_wpn_sword_0015_exist`, `duration: duration`, `maxStacks:
  max_stack`, `consumedBy: [ultimate]`, `{attr: 50, value: phy_dmg_up}`);
  trigger `{on: {event: physicalStatus, statuses: [lift]}, by: self,
  cooldown: 0.5, skill: sk_wpn_sword_0015}` → that buff. Each layer carries
  `phy_dmg_up`, so the consuming ultimate gets `phy_dmg_up` × layers on its
  own hits, as `_pdi_up` does. Ultimate DMG is on the stat panel.
- `wpn_sword_0018` (Twelve Questions): buff `wpn_sword_0018.atk_up` (self,
  `gameBuff: buff_wpn_sword_0018_atk_up`, `duration`, `maxStacks:
  max_stack`, `{zone: atk, value: atk_up}`); trigger `{on: {event:
  statusConsumed}, by: self, skill: sk_wpn_sword_0018}` → that buff (all
  four reaction statuses: tag 1474064594 is the Arts Reaction tag the
  "Arts Reaction" weapons query). The secondary attribute % is on the stat
  panel. Shatter waits on test A3.
