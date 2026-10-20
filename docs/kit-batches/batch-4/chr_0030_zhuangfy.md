# Zhuang Fangyi (chr_0030_zhuangfy): gap report, batch 4

Operator Zhuang Fangyi (Electric, CharGrowthTable `charTypeId` Pulse,
`profession` 8, `mainAttrType` 42 Will, `subAttrType` 41 Intellect,
`weaponType` 2 Arts Unit, rarity 6). Equipment covered here
([batch-4.md](../batch-4.md)): `wpn_funnel_0015` Lone Barge,
`wpn_funnel_0017` Flickers in the Mist, `wpn_funnel_0018` Junction Point,
`wpn_funnel_0020` Suffering's End.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterTable,
CharacterPotentialTable, PotentialTalentEffectTable, SkillPatchTable,
WeaponBasicTable, I18nTextTable_EN; Json/SkillData `chr_0030_zhuangfy_*`
(all 46 present in the checkout), `sk_wpn_funnel_0015/0017/0018/0020`;
Json/BuffData `buff_chr_0030_zhuangfy_*` (31 files),
`buff_common_affixes_enhance_pulse*`, `buff_common_pulse_pulse_conduct_triggered*`,
`buff_common_affixes_vulnerable_*` (tags only), `buff_wpn_funnel_0015_*`,
`_0017_layer`, `_0018_layer(_teammates)`, `_0020_*`. Values at skill level 12
and weapon skill level 9 unless stated. Enum codes as the compiler reads them
(CompareFloat 0 <, 1 ≤, 2 >, 3 ≥, 4 =; blackboard operations 0 =, 1 +, 2 ×,
3 ÷; CheckSkillType 2 battle skill, 6 combo, 7 ultimate). `efsim kit-draft
chr_0030_zhuangfy` was run on the main checkout; the kit plan was written as
files in a scratch copy, loaded with the real loader and simulated (see "Kit
plan").

Claims checked: batch-4.md's "none [no log] for … Zhuang Fangyi" is right
(no fixture names her or Lone Barge / Flickers / Suffering's End; Junction
Point appears once, on Xaihi in `fixtures/pending/zmdlogs-e82d45c46040.json`,
see Verification). One engine comment was wrong for this kit's purpose:
events.ts says a trigger's applications have `fromKind` "none"; timeline.ts
(`apply` action) gives them the kind of the cast behind the trigger
(`origin.kind`), so a battle skill's cast-trigger consumption counts as "from
a battle skill" (checked in the scratch run, Lone Barge row W2).

## Data overview

Relevant actions per file (visual, camera, audio, movement, targeting left
out). Frames from the skill's start; `duration / exclusive` from the file.

| File | Relevant actions |
|---|---|
| `attack1` (123 / 23) | LaunchProjectile@6 → `attack1_projhit` ×2 (0.18 each) |
| `attack2` (320 / 27) | 2 × LaunchProjectile@2 → `attack2_sword_projhit` (`atk_scale_sword` 0.11); SpawnAbilityEntity@15 → `attack2_abilityrange`: DamageAction at 0, TickInterval 9–16 every 0.1 s (3 more; each tick a 0.5 `Probablity` between two equal DamageActions: VFX), `atk_scale` 0.08. CheckDistance 10 only picks positions |
| `attack3` (105 / 29) | 4 sword projectiles @14, 14, 16, 16 (`atk_scale_sword` 0.18) |
| `attack4` (170 / 23) | SpawnAbilityEntity@11 → `attack2_abilityrange` (4 × `atk_scale` 0.25) |
| `attack5` (165 / 55) | SpawnAbilityEntity@20 → `attack5_abilityrange`: one DamageAction mask 2097280 (Final Strike), poise unit `onlyEnableForMainChar` (18), ObtainCostAction `atb` 18 with `atbOnlyMainChar` |
| `power_attack` (153 / 45) | DamageAction BreakingAttackCalculation × 0.1 @11 and × 0.9 @40 (`atk_scale` 9.0), GainBreakingAttackAtb; disable-cast 0–41 |
| `plunging_attack_end` | DamageAction mask 1152 @1 (1.8), ObtainCostAction `atb` (0) `atbOnlyMainChar` |
| `normal_skill` (290 / 135, `dontInterruptCombo`) | 0–3: every Sunderblade with < 3 s left set to 3 s (CheckAbilityEntityCurDuration / SetAbilityEntityDuration). 6: FinishBuff `normal_skill_trigger_sword` (a previous cast's strikes); if the target has tag 1466867135 (Electrification): GetTargetBuffBB `count` → `conductCnt`, FinishBuffAdvanced finishAll (consumed), `sword_gene_num` = min(`conductCnt` + 1, `max_conduct_sword` 3), ObtainCostAction `atb_return` (atbGainMethod 1), +1 if `potential1_more_sword`; else +1 if `EntityBB_SwordNum` < `free_sword_limit` 3, +1 if `potential1_more_sword`; then LaunchProjectile × `sword_gene_num` → `normal_skill_gene_sword_projhit` (spawns one Sunderblade each), CreateBuff `buff_common_obtain_ultimate_sp`; CreateBuff `talent1`. 13: if `EntityBB_SwordNum` ≥ 1: `swordTriggerInterval` = 0.3 − SwordNum / 90, `atk_up_final` = `atk_up_per_conduct` × `conductCnt`, CreateBuff `normal_skill_trigger_sword` on self (interval, atk_scale, poise, usp_extra, atk_up_final, remain_sword_limit, final_rate). JumpToAction window 16–116 → 116 on marker `skillEnd` or SwordNum = 0. AllowNextSkill 45–116, 120–147 (basic attacks, itself, finisher). HitStop 123–126 |
| `buff_…_normal_skill_trigger_sword` (3 s, waitFirstTriggerInterval, interval from the skill, maxTriggerCnt 50) | start: atk_scale += atk_up_final; each trigger: if swordIndex < SwordNum, CreateBuff `sword_triggerd` on Sunderblade[swordIndex] (swordCnt = SwordNum), swordIndex + 1 |
| `buff_…_sword_triggerd` (1 s, on a Sunderblade) | 0: swordCnt − 1. 3: if last (swordIndex = swordCnt): marker `skillEnd`; if not last: talent1_mark, DamageAction `atk_scale` (mask 4352 for swordIndex 0, else 256), ObtainCostAction `usp_extra` if swordIndex < remain_sword_limit. 6: if last: talent1_mark, DamageAction `atk_scale` × `final_rate` (mask 4352) + poise `poise`, `usp_extra`, HitStop 0.4 s. 9: if last: FinishBuff trigger_sword |
| `normal_skill_gene_sword_projhit` | if Sunderblades ≥ `remain_sword_limit` 9: FinishOwner of the first (oldest); SpawnAbilityEntity `normal_skill_sword` with `EntityBB_swordDuration` = `sword_duration` (36 s) |
| `buff_…_passive_check_sword` (lifeType 1, every 0.03 s) | `EntityBB_SwordNum` = Sunderblades within 50 m |
| `normal_skill_ult` (210 / 143) | 0–18 ExtendBuffAction `ult_base`. 5: if `ult_skill_free`: 3 Sunderblades (4 with `potential1_more_sword`), FinishBuff `ult_skill_free` (no consumption, no team energy); else as `normal_skill` (consume, swords, `atb_return`, team energy). 15: `atk_up_final`, SpawnAbilityEntity `normal_skill_ult_abilityrange` (SwordNum passed). Jump window 16–100 → 100 on `skillEnd`. AllowNextSkill 30–143 (Empyrean attacks, itself) |
| `normal_skill_ult_abilityrange` (entity) | TickInterval 12–64 every 0.2 s: while tick_index (from 1) < SwordNum: talent1_mark, DamageAction `atk_scale + atk_up_final` (mask 4352 at tick 1, else 256); else JumpToAction 64. 67: marker `skillEnd`; 69: talent1_mark, × `final_rate`, SpellInfliction type 1 (Electric), DamageAction + poise `poise`, HitStop 0.4 s |
| `combo_skill` (210 / 60) | TimeDilation 0–15 (ComboSkill). 24: if Electric Infliction (tag 2123008650): `inflictCnt` = stacks, `conductCnt` = inflictCnt (+1 if Electrified), min 4, CreateBuff `buff_common_pulse_pulse_conduct_triggered` (count = conductCnt); then DamageAction `atk_scale` 3.6 mask 12288 + poise 10, FinishBuff the infliction (after the damage), ObtainCostAction `usp` 10 and `usp_extra` × inflictCnt (10 each) |
| `combo_skill_ult` (197 / 30) | 0–28 ExtendBuffAction `ult_base`; as `combo_skill` at 24 with `atk_scale` 5.4, no energy; marker `zhuangfy_combo_ult_tar` on the main target (0.5 s); ring projectile → `combo_skill_ring_projhit` → `combo_skill_ring_hit` only on targets without the marker (`returnTrueIfNotExists`): the other enemies |
| `ultimate_skill` (208 / 90) | UltimateTimeAction 0–78; cantCastSkill / cantSwitchPosition channel 0–90; 78: CreateBuff `ult_base` (`duration` 25, `combo_cd_rate` 4). No damage |
| `buff_…_ult_base` (25 s) | attribute 93 (ComboSkillCooldownRecoveryScalar) formulaItem 6 `combo_cd_rate`; start: SwitchModeAction UltMode, RefrainObtainUsp, ChangeSkill battle → `normal_skill_ult`, combo → `combo_skill_ult` (inheritOriginSkillCdProgress), child `ult_skill_free`; TagQueryListener predefinedQuery 1200 → ends itself; end: CastSkill `ultimate_skill_end` (or InterruptCurSkill), SetSkillCdAtOnce functionType 1 on the ultimate (15 s) |
| `buff_…_ult_skill_free` | attribute 45 (AtbCostAddition) formulaItem 5 −100 |
| `attack1_ult` / `attack2_ult` (160 / 135, 155 / 120) | 0–22 / 0–17 ExtendBuffAction `ult_base`; 4 SpawnAbilityEntity 12–15 / 10–13, each `_N_abilityrange` hits a target only if it lacks marker `hitMark1` (0.4 s) → one hit per target (1.5 / 2.1) at 15 / 13 |
| `attack3_ult` (179 / 140) | 0–35 ExtendBuffAction; SpawnAbilityEntity@3 → `attack3_ult_abilityrange`: one DamageAction @33 mask 2097280, 3.0, poise 18 `onlyEnableForMainChar`, `atb` 20 `atbOnlyMainChar` |
| `talent1` (attached skill) + `buff_…_talent1_base` | abilityEvent 9 on `talent1` → `talent1_base` (5 s): EnhancedAction subType 6 → `buff_common_affixes_enhance_pulse` (attribute 66, Electric Amp) `rate` = `base_rate`, child `…_zhuangfy_talent1_child`; enhancingList: each `talent1_mark` adds `enhance_rate` to that rate |
| `talent2` (attached skill) | abilityEvent 101 (hit taken): chance `base_rate` + `sword_rate` × Sunderblades → `buff_common_damage_immune_talent` (0.01 s) + `talent2_heal` (heal × Max HP, then 99 s before another) |
| `buff_…_potential1` / `_more_sword` | P1: abilityEvent 6 (entering battle) → `more_sword`; ends on abilityEvent 150 or 31 with CheckSkillType [2] |
| `buff_…_potential5` | P5: damageModifier, condition `ult_base` present: InstantModifyAttribute attribute 97 formulaItem 5 `ignore_pulse_resist` −15 (attacker side) |
| no gameplay | `check_sword_passive` (attaches the counter), `normal_skill_sword` (entity, VFX), `perfect_dodge`, `plunging_attack_start`, `air_attack_*`, `ultimate_skill_end` (20-frame exit, no damage), `buff_…_dash(_hide)`, `_ult_hide_model*`, `_ult_env_vfx`, `_ult_body_vfx`, `_potential5_vfx`, `_attack3_ult_cancel`, `_combo_skill_target_mark`, `_normal_skill_trigger_sword_tar` (targeting marker), `_power_attack_blow` (unreferenced), `_train_*` (training mode) |

Table values (SkillPatchTable, L1 → L12): attack1 `atk_scale` 0.08 → 0.18
(×2); attack2 0.04 → 0.08 (×4) + `atk_scale_sword` 0.05 → 0.11 (×2); attack3
`atk_scale_sword` 0.08 → 0.18 (×4); attack4 0.11 → 0.25 (×4); attack5 0.48 →
1.08, poise 18, `atb` 18; finisher 4.0 → 9.0; dive 0.8 → 1.8; battle skill
`atk_scale` 0.2 → 0.45, `atk_up_per_conduct` 0.03 → 0.09, poise 15,
`usp_extra` 6, `final_rate` 6, `max_conduct_sword` 3, `free_sword_limit` 3,
`remain_sword_limit` 9, `sword_duration` 36, `atb_return` 0, cost 100 SP;
Empyrean battle skill `atk_scale` 0.36 → 0.81, `atk_up_per_conduct` 0.08 →
0.18, the rest the same; combo 1.6 → 3.6, poise 10, `usp` 10, `usp_extra`
10, cooldown 18 → 17 s; Empyrean combo 2.4 → 5.4; Empyrean attacks 0.67 →
1.5, 0.94 → 2.1, 1.34 → 3.0 (poise 18, `atb` 20); ultimate cost 240 energy,
cooldown 15 s, `duration` 25, `combo_cd_rate` 4. Talents (level 1 / 2):
talent 1 `base_rate` 0.09 / 0.18, `enhance_rate` 0.01 / 0.02, `duration` 5;
talent 2 `base_rate` 0.09, `sword_rate` 0.01, `heal` 0.09 / 0.18, `duration`
99. Potentials: P1 `atk_scale` and `atk_up_per_conduct` × 1.15 on both
battle skills + `potential1`; P2 Will +20, Battle Skill DMG +15% (attr 32);
P3 `sword_duration` +10, `atb_return` set 10 on both battle skills; P4
ultimate cost × 0.85 (204); P5 `potential5` (`ignore_pulse_resist` −15).

Descriptions (CharGrowthTable + I18nTextTable_EN), short: battle skill
"Mantra of Sundering": "Consumes the target's Electrification to increase
the DMG multiplier … and create [Status Level of Electrification consumed
+1] Sunderblades. If the battlefield has fewer than 3 Sunderblades, [it] can
still create 1 … even if it does not consume … Zhuang Fangyi then channels
all Sunderblades nearby to successively unleash Thunder Strikes … giving
bonus Ultimate Energy, with the final Thunder Strike dealing 6 times the
DMG. A single battle skill casting can only create a max of 3." Combo
"Breath of Transformation": "COMBO TRIGGER: When the controlled operator's
Final Strike or Finisher hits an enemy with Electric Infliction. … consume
the said Electric Infliction stack(s), forcibly apply Electrification, and
give Ultimate Energy based on the number of stacks consumed. If
Electrification is forcibly applied to an enemy that already has
Electrification, then apply Status Level +1." Ultimate "Smiting Tempest":
the Empyrean of Truth: enhanced basic attacks; the battle skill's higher
multiplier and Electric Infliction on the final strike; the combo's higher
multiplier and "cooldown becomes 4 times faster"; "The first casting of the
battle skill … does not consume SP nor Electrification, and … is guaranteed
to create 3 Sunderblades."

## Mechanics

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| 1 | Basic 1: two projectiles 0.18 @6, 8 | supported | hit `count: 2`, frames [6, 8], detached (kit-draft) |
| 2 | Basic 2: 2 sword projectiles 0.11 @2 and an entity: 0.08 @15, 24, 27, 30 | data | kit-draft gives six alternatives (distance and the 0.5 VFX `Probablity`); both sides of each are the same hit: write two hits (`count` 2 and 4, `launch` 15) |
| 3 | Basic 3: four sword projectiles 0.18 @14, 14, 16, 16 | supported | as drafted |
| 4 | Basic 4: entity `attack2_abilityrange` 4 × 0.25 @11, 20, 23, 26 | data | as row 2 (draft: six alternatives) |
| 5 | Basic 5 Final Strike 1.08 @20, 18 stagger and 18 SP while controlled | data | one hit (draft: three equal distance alternatives); `sp: {if: {controlled: true}, then: atb}`: the compiler doesn't read ObtainCostAction `atbOnlyMainChar` (D, new item) |
| 6 | Chain timing, windows, exclusive frames | supported | SkillData (engine) |
| 7 | Finisher: 9.0 × 0.1 @11 and × 0.9 @40, finisher SP | supported | as drafted (BreakingAttackCalculation factors) |
| 8 | Dive attack 1.8 @1 | supported | kept for `calc`; not castable (S10 interim) |
| 9 | Battle skill f6: consumes Electrification (tag 1466867135: reaction and forced alike), its level L | supported | cast trigger (delay 6) `apply consumeStatus electrification`; its `statusConsumed` carries L (`eventCount`) and the cast's kind (battle) |
| 10 | Sunderblades created: min(L + 1, 3) when consuming; else 1 if fewer than 3 on the field; P1: +1 on the first battle skill after entering battle, beyond the cap | supported | layers of self buff `sunderblade`: `bs_consumed` (`layers: min(eventCount + 1, max_conduct_sword)`), the free one and P1's in the cast trigger, judged before the consumption (action order) |
| 11 | Sunderblades: each its own lifetime `sword_duration` (36 s; 46 s at P3), at most `remain_sword_limit` 9, the oldest removed by a tenth (`gene_sword_projhit` FinishOwner index 0) | supported | `maxStacks: remain_sword_limit`, layers with their own timers ("at the maximum a new one replaces the oldest") |
| 12 | At the battle skill's start every Sunderblade with less than 3 s left is set to 3 s | gap | G6 (small) |
| 13 | Thunder Strikes: N = Sunderblades on the field at f13; strikes 1…N−1 deal `atk_scale + atk_up_per_conduct × L`, the last × `final_rate` (6) with 15 stagger; trigger interval 0.3 − N/90 s from f13 (waitFirstTriggerInterval), damage 3 frames after each trigger, the last 6; detached from f13 (a buff on her, not tied to the cast) | supported | composite, exact within the model: stack `strike_n` = `{buffLayers: sunderblade}` at f13 (cast trigger), stack `conduct_cnt` = L; for each N = 1…9 a strike hit (`count` N−1, its frames) and a final hit, each `if: {stack: strike_n, atLeast: N, below: N + 1}` (judged as it lands), `scaleValue: atk_scale + atk_up_per_conduct × stackCount(conduct_cnt)`, `launch: 13`. G7 would shorten it (optional) |
| 14 | Whether the swords launched at f6 already count at f13 (projectile flight isn't in the data) | unknown | interim: they count (the description: "then channels all Sunderblades"); U1, test A |
| 15 | Strike frames: trigger times k × (9 − N/3) frames rounded up; the Empyrean entity's first tick at frame 12 | unknown | interim as stated; ±1 frame (±6 for the tick); logs only (U2) |
| 16 | Energy `usp_extra` 6 per strike, the final one included (swordIndex < 9 always) | supported | `energy: usp_extra` on every strike hit (54 at 9 Sunderblades) |
| 17 | A new battle skill ends the previous one's remaining strikes (FinishBuff trigger_sword at f6) | supported | the cast trigger resets `strike_n` at f6, so the old strikes' `if` fails; edge: an old strike landing after the new cast's f13 with the same N would still land (a recast inside the first cast's strikes, 200 SP in under 2 s) |
| 18 | The cast jumps 16 → 116 when the last strike's marker appears | supported | left out on purpose: windows 45–116 already let her act, so the jump moves the action gate by ≤ 1 frame (for N ≤ 3) |
| 19 | Team energy from the SP spent at f6 (both branches) | supported | `teamEnergy: [{frame: 6, ratio: 1}]` |
| 20 | P3: `atb_return` 10 SP (returned) after consuming Electrification; Sunderblade +10 s | supported | `sp: atb_return` in `bs_consumed` (spKind from the data: refund); `sword_duration` |
| 21 | Combo trigger: controlled operator's Final Strike or finisher on an Electric-Inflicted enemy | supported | `on: {event: hit, decorations: [finalStrike, finisher]}, by: controlled, if: {enemyInfliction: pulse}` → `openCombo` |
| 22 | Combo hit 3.6 @24, 10 stagger; consumes the Electric Infliction; forced Electrification of level = stacks (+1 if already Electrified), max 4, created before the damage | data | `applies: [consumeInfliction pulse, forcedReaction electrification level {if consumedAtLeast 1: min(4, consumed + (enemyStatus electrification ? 1 : 0)), else 0}]` (A3; level 0 applies nothing). The data consumes after the damage: no effect here. Draft: no level |
| 23 | Combo energy `usp` 10 + `usp_extra` 10 × stacks consumed | data | `energy: usp + usp_extra × {consumed: true}`; draft only `usp` |
| 24 | Combo cooldown 17 s, slow-down 0–15 | supported | SkillData |
| 25 | Her forced Electrification on a stronger one (stackingType 2 max 1: replace or keep) | unknown | engine replaces (test 66) |
| 26 | Ultimate: time stop 0–78, no damage, 240 energy (204 at P4), cooldown 15 s set when the state ends | supported | no hits; `ult_state` at frame 78; `ult_end`: `cooldown {set: 15}` |
| 27 | Empyrean of Truth: 25 s from f78, no energy gain meanwhile (RefrainObtainUsp) | supported | self buff `empyrean` (`duration`, `blocksEnergy`), not the draft's `energyBlockSeconds` 27.6 |
| 28 | Skill swaps in the state: basic attacks → attack1–3_ult, battle skill → `normal_skill_ult`, combo → `combo_skill_ult` (cooldown carried over) | supported | `available` on `empyrean` / its negation; `cooldownGroup: combo` |
| 29 | Empyrean attacks 1–2: one hit each (1.5 @15, 2.1 @13): four entities, the first to reach a target marks it for 0.4 s | data | one hit (draft: eight branch hits each, which would land 4–8×) |
| 30 | Empyrean attack 3: Final Strike 3.0 @33, 18 stagger and 20 SP while controlled | data | one hit, `poiseControlledOnly`, controlled SP (draft: two alternatives, uncontrolled SP) |
| 31 | Empyrean battle skill: consumption and swords as row 10; the first one after the ultimate: no consumption, 3 Sunderblades (4 with P1's) | supported | cast trigger at frame 5, its actions gated on `ult_free` |
| 32 | Empyrean strikes: entity from f15, every 0.2 s while tick < N: N−1 strikes (0.81 + 0.18 L) at 27 + 6k, then the final (× 6, Electric Infliction, 15 stagger) at 6N + 26 | data | composite as row 13 (`launch: 15`, final `applies: infliction pulse`). Draft: 9 + 1 hits at 27…75 and 84: it ignores `tick_index < SwordNum` and the jump to 64 |
| 33 | The free Empyrean battle skill costs no SP (`ult_skill_free`: attribute 45 −100) | gap | G2 |
| 34 | Combo cooldown "4 times faster" in the state (attribute 93 formulaItem 6 `combo_cd_rate`) | gap | G1; × 4 (text) or × 5 (panel formula: 1 + 4) is U4 |
| 35 | Empyrean combo 5.4 @24, its forced Electrification as row 22, no energy | supported | as row 22 without energy |
| 36 | Empyrean combo's ring: hits only enemies without the main target's 0.5 s marker | data | nothing against one enemy; the draft lands it on the main target ("no kit condition: lands always") |
| 37 | ExtendBuffAction on `ult_base` over the first 17–35 frames of each Empyrean action: the state doesn't end during them | unique? | G4 |
| 38 | State end: `ultimate_skill_end` cast (20-frame exit, ends the current action) | gap | G5 (loader: a skill a buff casts) |
| 39 | State ends early on TagQueryListener 1200 (swap? death?) | unknown | interim: no early end (U3, test E); Typhoeus's hover has the same listener |
| 40 | Talent 1: Electric Amp `base_rate` (18%) for 5 s from f6 (f5), + `enhance_rate` (2%) per strike that hits, reset by each battle skill | supported | self buff `t1_amp` (gameBuff `buff_common_affixes_enhance_pulse`) + layered `t1_amp_plus` added by each strike before its damage (`beforeDamage`), ended with `t1_amp` and at the next cast |
| 41 | Whether talent 1's growth is cumulative over the cast | unknown | interim cumulative (EnhancedAction raises the buff's dynamic `rate`); U5, test F |
| 42 | Talent 2: chance of damage immunity, heal once per 99 s | supported | nothing to write (incoming damage and HP aren't modelled, N2); a heal trigger would only mark every scenario as random |
| 43 | P1: × 1.15 on both battle skills' `atk_scale` and `atk_up_per_conduct` | supported | skill values (scratch: Empyrean strike 0.9315 + 0.207 L) |
| 44 | P2: Will +20, Battle Skill DMG +15% | supported | stat panel (`NormalSkillDamageIncrease` 0.15 on her strikes) |
| 45 | P3: Sunderblades 46 s | supported | skill value |
| 46 | P4: ultimate cost 204 | supported | skillParam |
| 47 | P5: her hits ignore 15 Electric RES during the state | supported | self buff `p5_resist` (`ignoreResistance` pulse 15) with the state, from P5 |
| 48 | Attribute nodes: Will +10 / +15 / +15 / +20 | supported | stat panel |
| 49 | Hit-stops (battle skill 0.25 s, final strikes 0.4 s, combo 0.3 s) | gap | Ti1b (open, not re-proposed) |
| 50 | Finisher during the state (UltMode's windows don't list it) | unknown | interim: castable (U6) |
| 51 | Visual, training and targeting files (data overview, last row) | supported | nothing to write |

Equipment:

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| W1 | Lone Barge: Will, ATK, skill 3 Electric DMG +44.8% (attr 52) | supported | stat panel (scratch: `PulseDamageIncrease` 0.448) |
| W2 | "When the wielder's battle skill consumes Arts Reactions, … Battle Skill Electric DMG +56% for 20 s; 2 stacks, separate durations, once per 0.1 s" (abilityEvent 208, CheckOriginSkillType [2], tag 1474064594) | supported | `on: {event: statusConsumed, fromKinds: [battle]}, by: self, cooldown: 0.1` → layered buff (`maxStacks: max_stack`), `damageBonus` pulse `skillType: battle` (decorate mask 256). Her cast-trigger consumption counts (origin kind; scratch: +0.56 on her strikes after it) |
| W3 | "After the wielder casts an ultimate, … Battle Skill Electric DMG +112% for 25 s" (abilityEvent 30, CheckSkillType [7]; stackingType 4) | supported | cast trigger `kinds: [ultimate]` → plain buff. Note: it starts at the cast, the Empyrean 78 frames later, so it ends ~2 s before the state (scratch: gone at 31.5 s, state to 33.6 s) |
| F1 | Flickers in the Mist: Will, Electric DMG, ATK +19.6% | supported | stat panel |
| F2 | "When the wielder gains Electric Amp, … Electric DMG +15.4% for 30 s; 3 stacks, separate durations, once per 0.1 s" (abilityEvent 9 + buff IDs `buff_common_affixes_enhance_pulse` / `_spell`) | gap | G3; interim `on: {event: buffApplied, gameBuffs: [both]}, by: self`: exact for her talent 1 (one layer per battle skill), misses teammates' Amps |
| J1 | Junction Point: Intellect, Ultimate Gain Efficiency, Nature DMG +19.6% | supported | stat panel |
| J2 | "When the wielder applies Arts Susceptibility or Arts Infliction with a combo skill, the wielder gains ATK +16.8% while other operators … +4.2%, 20 s; 2 stacks, separate durations" (abilityEvent 206 on the four elemental Susceptibility tags, 126; CheckOriginSkillType [6]) | supported | as Solemn Phalanx (wpn_funnel_0016): `buffApplied categories [susceptibility]` and `inflictionApplied`, both `fromKinds: [combo]` → self layer + team layer (`recipients: not isOwner`). Interim leftovers: the category also counts a Physical Susceptibility (the data's four tags are Heat, Cryo, Electric, Nature) |
| J3 | Whether an infliction that forms a reaction counts | unknown | open as for Solemn Phalanx (test 35's question); `inflictionApplied` excludes it |
| J4 | Two wielders: stackingType 11 layers with a priority key | gap | B2's residue (layered type-11, open) |
| S1 | Suffering's End: Agility, Nature DMG, Arts Intensity +42 | supported | stat panel |
| S2 | "When the wielder applies an Arts Burst, … Nature DMG +5.6% for 25 s; 4 stacks, separate durations, once per 0.1 s. At 4 stacks, … an additional +16.8%" (abilityEvent 127; 209 ends `maxup` below 4) | supported | `on: burst, by: self, cooldown 0.1` → layer, then `maxup` `if: {buffLayers ≥ 4}`; `buffEnded` of a layer → `endBuff maxup` if below 4 (as MI Security) |

Whose weapons: Lone Barge is plainly hers (a battle skill that consumes
reactions, and a 25 s battle-skill bonus after the ultimate: the Empyrean's
length). Flickers in the Mist fits her talent 1 (an Electric Amp each battle
skill) but works for any Electric Amp. Junction Point and Suffering's End
carry Nature DMG lines and Nature-team triggers: a Nature arts unit's
(Ardelia in this batch; Arcane, Gilberta, Typhoeus have kits); the merge may
move them.

**Counts:** 62 rows: 38 supported, 9 data, 7 gap, 1 unique?, 7 unknown
(operator 51: 30 / 9 / 5 / 1 / 6; equipment 11: 8 / 0 / 2 / 0 / 1).

## Gaps

### G1. Combo cooldown recovery rate from a buff (attribute 93)

- **Family:** skills (cooldowns).
- **Feature:** a kit buff modifier `{attr: 93, value, percent?}`
  (ComboSkillCooldownRecoveryScalar, default 1) is read by the cooldown code:
  while it's active, the owner's combo cooldown runs at that rate (remaining
  cooldown falls by rate × elapsed frames; a cooldown in progress keeps its
  progress when the buff starts or ends). The panel formula's percent slot
  makes formulaItem 6 + 4 a rate of 5; the description says 4 (U4). Batch 2's
  S2 (attribute 47) is applied at the cast only; this one must act over time.
- **Evidence:** `buff_chr_0030_zhuangfy_ult_base` attributeModifiers
  attributeType 93 formulaItem 6 `combo_cd_rate` (SkillPatchTable
  `chr_0030_zhuangfy_ultimate_skill` 4); "cooldown becomes
  {combo_cd_rate:0} times faster". The same attribute in
  `buff_chr_0035_liino_normalskill_combocd` (formulaItem 4, unused). Scratch
  run: the second Empyrean combo is refused ("isn't available at frame
  1165": its 17 s cooldown outlasts the state).
- **Impact:** large. Inside each 25 s state her combo comes back after
  3.4–4.3 s instead of 17 s, so the engine allows one combo per state where
  the game allows one per Final Strike (about every 3 s of chain): 3–5 combos
  (5.4 × ATK each, plus the forced Electrification that the next battle skill
  turns into Sunderblades and +18%/level strikes) are missing per ultimate.

### G2. A skill's SP cost changed by a buff (attribute 45)

- **Family:** skills (costs).
- **Feature:** the SP cost at the cast is max(0, the skill's cost + Σ
  attribute 45 (AtbCostAddition) of the caster's active buffs); the action
  gate checks that cost, not the table's. Kit: `modifiers: [{attr: 45,
  value: -100}]` on `ult_free`; the kit's cast trigger ends `ult_free` on use,
  as the data does. Generic (any cost attribute from buffs, next to G1 and
  batch 2's S2); no other BuffData uses attribute 45 today.
- **Evidence:** `buff_chr_0030_zhuangfy_ult_skill_free` attributeType 45
  formulaItem 5 −100, a child of `ult_base`; `normal_skill_ult` frame 5
  finishes it on the free path; "The first casting of the battle skill …
  does not consume SP". Scratch run: after the ultimate at 6.0 s the free
  battle skill waits for 100 SP until 18.1 s.
- **Impact:** large in rotations: 100 SP per ultimate (12.5 s of team
  regeneration; about 6.5 energy per teammate when spent), and the free
  cast's 3 Sunderblades come up to 12 s late, inside a 25 s state.

### G3. "The wielder gains an Amp" (receiver side, by element)

- **Family:** triggers.
- **Feature:** `on: {event: "buffApplied", categories: ["amp"], elements?:
  [...], received: true}`: fires for the trigger's owner when a kit buff
  with an Amp modifier reaches it (its own, or a team buff from anyone),
  `elements` matching when the Amp covers one of them (an all-Arts Amp covers
  each). And a kit buff that only raises an active Amp's rate (the data's
  EnhancedAction `enhancingList`; here `t1_amp_plus`) must not count as
  gaining one: `KitBuff.categories: []` (an override of the categories the
  loader infers). Today `categories` match the applier (`by`), not the
  receiver, and have no element filter.
- **Evidence:** `sk_wpn_funnel_0017` abilityEvent 9 (a buff added to the
  wielder) + CheckBuffIdInContext `buff_common_affixes_enhance_pulse`,
  `buff_common_affixes_enhance_spell`; EnhancedAction creates those common
  buffs (`buff_chr_0030_zhuangfy_talent1_base` subType 6; also Antal's
  ultimate, Xaihi's, Arcane's, Liino's and Si's Amp buffs), whose kit buffs
  name their own game buff, not the common one.
- **Impact:** with the interim, Flickers is exact for its owner's own
  Electric Amp; a wielder whose Electric or Arts Amp comes from a teammate
  (Antal's ultimate, Xaihi's crystal) loses up to 3 × 15.4% Electric DMG. A
  plain category trigger instead over-counts every strike's `t1_amp_plus`.

### G4. A buff held past its expiry while an action's window runs (unique?)

- **Family:** buff lifecycle.
- **Feature:** `KitSkill.holds: [{buff, until}]`: if the buff would expire
  while the cast's playhead is in [0, until), it ends at `until` (or when
  the cast is cut) instead. Only her files use ExtendBuffAction; the
  mechanism isn't hers in kind (a generic BuffData action), so it'd go in
  shared code if added.
- **Evidence:** ExtendBuffAction on `buff_chr_0030_zhuangfy_ult_base`:
  `attack1_ult` 0–22, `attack2_ult` 0–17, `attack3_ult` 0–35,
  `normal_skill_ult` 0–18, `combo_skill_ult` 0–28;
  `buff_chr_0030_zhuangfy_air_attack_ult_extend_buff`. Endaxis (read only)
  reads it as "prevents the buff from ending during the action's interval"
  (`buffActions.ts`, BuffHoldActionSource).
- **Impact:** small: up to 35 frames more state per ultimate, only when an
  action starts in its last second (P5's RES ignore, the energy block and
  G1's rate on those frames). Can be deferred.

### G5. Skills a buff casts (CastSkill in BuffData) as helpers

- **Family:** data compilation (loader; S4's extension).
- **Feature:** `castHelpers` also follows CastSkill in the BuffData an
  operator's skills create, so `chr_0030_zhuangfy_ultimate_skill_end` can be
  a `followUpOnly` kit skill cast by the `empyrean` end trigger (its 20
  exclusive frames, ending her current action).
- **Evidence:** `buff_chr_0030_zhuangfy_ult_base` buffEvent 2 → CastSkill
  `chr_0030_zhuangfy_ultimate_skill_end`; the loader rejects the kit skill
  ("unknown skill", scratch). 13 BuffData files have CastSkill (Arcane,
  Camille, Liino, Si, the common dash listener).
- **Impact:** small: a 0.67 s exit lock at each state end and the cut of the
  action in progress are missing.

### G6. Extend layers to at least a time

- **Family:** buff lifecycle.
- **Feature:** trigger action `{kind: "extendBuff", buff, atLeast: s}`:
  each active layer's remaining time becomes max(remaining, s).
- **Evidence:** `chr_0030_zhuangfy_normal_skill` / `_ult` frames 0–3:
  ForEach Sunderblade, CheckAbilityEntityCurDuration < 3 →
  SetAbilityEntityDuration 3.
- **Impact:** tiny: a Sunderblade expiring in the 13 frames before the
  strikes are counted is lost (one strike fewer), and one about to expire
  survives 3 s for a quick recast.

### G7 (optional). Counted landings decided at their launch, spaced by a value

- **Family:** timing / values.
- **Feature:** `KitHit.count` judged at the hit's `launch` frame when it has
  one (the data decides there: her f13, Avywenna's f7), `framesEvery` as a
  ValueExpr judged with it, and `lastFrameExtra` (frames added to the last
  landing) or a `last` override for its scale and stagger. Replaces the 36
  conditional entries and the `strike_n` stack of rows 13 and 32 with four
  hits; the composite is exact meanwhile.
- **Evidence:** rows 13, 32.
- **Impact:** none on numbers; kit size and readability.

### G8. Log tooling: hit values that read a stack

- **Family:** log tooling.
- **Feature:** `zmdlogs check` (and `calc`) try a hit whose `scaleValue`,
  `count` or `if` reads an own stack over the stack's range, as they try
  `eventCount` 1–4, and report the value that fits.
- **Evidence:** scratch `efsim calc` on her build: "value needs stack
  conduct_cnt, which isn't known here" (expr.ts); no other kit has a stack
  in a hit's value.
- **Impact:** no log with her could be checked until then (the Thunder
  Strikes are most of her damage).

### Data compilation (D3 / D4 leftovers and one new item)

kit-draft's output, corrected by hand in the plan:
- **New:** ObtainCostAction `atbOnlyMainChar` isn't read (basic 5,
  Empyrean basic 3, dive): `sp` should be `{if: {controlled: true}, then:
  atb}` (many operators' basic attacks use the flag; small, as basic attacks
  need control).
- Alternatives that are the same hit (CheckDistance positions, a 0.5
  `Probablity` between two equal DamageActions, per-target markers
  `hitMark1` that make four entities one hit, the ring that excludes the
  marked main target): emitted as 2–8 landing alternatives (D3).
- Buff-driven periodic hits: `normal_skill_trigger_sword`'s interval from
  the skill (0.3 − N/90) and `waitFirstTriggerInterval`, the per-sword
  buffs, "count = entities on the field", the entity's `tick_index <
  SwordNum` loop and its JumpToAction 64: the draft gives one strike and a
  final (normal) or 9 + 1 at wrong frames (Empyrean) (D4: "spawned entities
  a later skill recalls reported as a stack").
- The combo's forced level (`conductCnt` = stacks + 1 if Electrified) and
  `usp_extra × inflictCnt` energy: left as notes (D3 / D4).
- Scales `atk_scale + atk_up_per_conduct × $conductCnt?`: "write it by hand"
  (no source for the consumed level).

### Unknowns (no engine work until settled)

- **U1** the f6 Sunderblades striking in their own cast (test A).
- **U2** strike frame rounding; the entity's first tick at frame 12 (logs).
- **U3** the state ending on TagQueryListener 1200 (test E).
- **U4** G1's rate: × 4 or × 5. Not testable by hand (17 / 4 = 4.25 s vs
  3.4 s); small, as Final Strikes limit her combos more than the cooldown.
- **U5** talent 1's growth (test F).
- **U6** the finisher in the state (low priority; no test proposed).
- Row 25 (test 66), J3 (test 35).

## Verification

No ZMDLogs fixture has Zhuang Fangyi, Lone Barge, Flickers in the Mist or
Suffering's End. Junction Point is Xaihi's weapon in
`fixtures/pending/zmdlogs-e82d45c46040.json`, but Xaihi has no logged hit
and no logged hit carries `buff_wpn_funnel_0018_layer` (so her combo,
which inflicts Cryo, isn't in the logged window): `zmdlogs check` and `zmdlogs
reactions` on it give byte-identical output with and without the four
equipment kits. `packages/data/test/kits.test.ts` and `tests/logs.test.ts`
pass in the scratch copy with the draft kits (420 tests).

Logs that would verify the kit: any ZMDLogs battle with her (needs G8 for
`zmdlogs check`): `buff_chr_0030_zhuangfy_sword_triggerd` hits (count per
cast = Sunderblades, 0.45 + 0.09 L each, the last × 6; their spacing 0.2–0.29
s settles U2), `chr_0030_zhuangfy_normal_skill_ult_abilityrange` (Empyrean,
N−1 + 1, 0.2 s apart), talent 1's `buff_common_affixes_enhance_pulse` rate
on each strike (U5), Lone Barge's two buffs, the combo's forced
Electrification level, combo casts 3–5 s apart in a state (G1, U4) and the
free battle skill's SP (G2).

In-game tests (by hand; none of 60–76 covers these; P0 values unless said):

- **A. Sunderblades per cast** (U1, rows 10, 13). On a training dummy with
  no Electric teammate, cast her battle skill four times about 5 s apart.
  Count the Thunder Strike numbers per cast (the last one is the big × 6):
  engine 1, 2, 3, 3 (P1+: 2, 3, 3, 3). If the new Sunderblades aren't ready
  in time: 0, 1, 2, 3 (the first cast deals nothing).
- **B. Sunderblade lifetimes** (row 11). Casts at 0, 10 and 20 s, then at
  50 s (stopwatch): each its own 36 s (engine): the 0 s and 10 s blades are
  gone, so 2 strikes (one old, one new); a shared, refreshed timer: 3.
  At P3 (46 s) cast the fourth at 60 s instead: 2 vs 3 the same way.
- **C. The free Empyrean battle skill** (G2). Spend the SP bar to empty,
  cast the ultimate, then at once the battle skill: data: it's castable and
  3 Sunderblades appear; engine today: it waits ~12 s for 100 SP.
- **D. Combo cooldown in the state** (G1). In the state, after a battle
  skill (its final strike inflicts Electric) and the three-hit chain, cast
  the combo; repeat the battle skill and chain at once: data: the combo is
  ready again about 4 s after the first; engine today: 17 s.
- **E. Swapping out of the state** (U3). Cast the ultimate, swap to a
  teammate 5 s later, swap back 3 s after that: does she still have the
  Empyrean (its icon, the enhanced attacks) or is it gone?
- **F. Talent 1's growth** (U5; needs 9 Sunderblades, i.e. three
  Electrification-consuming casts at level 2+, or the state; medium). In one
  cast, compare the first and the eighth small strike (non-crit numbers):
  cumulative (engine): the eighth about 1.12 × the first (Amp 1.20 → 1.34);
  not cumulative: equal.

Existing tests her kit depends on: 66 (her combo's forced Electrification
over a stronger one), 35's question (Junction Point, J3), 47 (projectile
travel, not by hand), 38 (two Electric Amps adding: her talent 1 with
Antal's ultimate).

## Kit plan

Files (scratch copy, load with the real loader and simulate):
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-zhuangfy/repo/packages/data/kits/operators/chr_0030_zhuangfy.json`
(generated by `…/scratch-zhuangfy/tools/genkit.py`) and
`…/repo/packages/data/kits/equipment/wpn_funnel_0015.json`, `_0017`, `_0018`,
`_0020`. **They load**; `efsim simulate` on a solo P5 Lone Barge scenario
(`…/scratch-zhuangfy/zfy.scenario.json`: two battle skills, the ultimate, two
Empyrean battle skills with chains and a combo) runs: 2 Sunderblades on the
first cast (free + P1), 3 on the second, +3 on the free Empyrean cast (6
strikes), +2 after the combo's level-1 Electrification is consumed (8); the
Empyrean final strike with 8 blades 58,847. `kit-census`: no field only
this kit uses.

**Stacks:** `conduct_cnt` (max 4: the level the current battle skill
consumed), `strike_n` (max 9: Sunderblades striking now).

**Buffs** (all `target: self`):

```json
{ "id": "sunderblade", "duration": "sword_duration", "maxStacks": "remain_sword_limit", "modifiers": [] },
{ "id": "p1_more_sword", "gameBuff": "buff_chr_0030_zhuangfy_potential1_more_sword", "modifiers": [] },
{ "id": "t1_amp", "gameBuff": "buff_common_affixes_enhance_pulse", "duration": {"talent": 0, "key": "duration"},
  "modifiers": [{ "zone": "amp", "elements": ["pulse"], "value": {"talent": 0, "key": "base_rate"} }] },
{ "id": "t1_amp_plus", "duration": {"talent": 0, "key": "duration"}, "maxStacks": 99,
  "modifiers": [{ "zone": "amp", "elements": ["pulse"], "value": {"talent": 0, "key": "enhance_rate"} }] },
{ "id": "empyrean", "gameBuff": "buff_chr_0030_zhuangfy_ult_base", "duration": "duration", "blocksEnergy": true, "modifiers": [] },
{ "id": "ult_free", "gameBuff": "buff_chr_0030_zhuangfy_ult_skill_free", "modifiers": [] },
{ "id": "p5_resist", "gameBuff": "buff_chr_0030_zhuangfy_potential5", "duration": "duration",
  "modifiers": [{ "zone": "ignoreResistance", "elements": ["pulse"],
                  "value": {"product": [-1, {"key": "ignore_pulse_resist", "skill": "buff_chr_0030_zhuangfy_potential5"}]} }] }
```

With G1: `empyrean` gets `{attr: 93, value: "combo_cd_rate", percent:
true}`; with G2: `ult_free` gets `{attr: 45, value: -100}`.

**Triggers:**
- `combo_window`: `{on: {event: hit, decorations: [finalStrike, finisher]},
  by: controlled, if: {enemyInfliction: pulse}, do: [openCombo]}`.
- `p1_start`: `fightStart`, `if potentialAtLeast 1` → buff `p1_more_sword`.
- `bs_swords` (cast `normal_skill`, delay 6, awaited, skill
  `normal_skill`), in this order (the free blade is judged before the
  consumption):

```json
[{ "kind": "gain", "gains": [{"stack": "conduct_cnt", "amount": -4}, {"stack": "strike_n", "amount": -9}] },
 { "kind": "buff", "buff": "sunderblade", "if": {"all": [{"not": {"enemyStatus": "electrification"}}, {"buffLayers": "sunderblade", "below": 3}]} },
 { "kind": "buff", "buff": "sunderblade", "if": {"buffActive": "p1_more_sword"} },
 { "kind": "apply", "applies": [{"kind": "consumeStatus", "statuses": ["electrification"]}] },
 { "kind": "endBuff", "buff": "p1_more_sword" },
 { "kind": "endBuff", "buff": "t1_amp_plus" },
 { "kind": "buff", "buff": "t1_amp", "if": {"talentAtLeast": [0, 1]} }]
```

- `bs_consumed` (`statusConsumed` electrification, by self, skill
  `normal_skill`): `buff sunderblade layers {min: [{sum: [{eventCount: true},
  1]}, "max_conduct_sword"]}`, `gain conduct_cnt {eventCount: true}`, `sp
  atb_return` if P3.
- `bs_count` (cast `normal_skill`, delay 13): `gain strike_n {buffLayers:
  sunderblade}`.
- `bsu_swords` (cast `normal_skill_ult`, delay 5): the same actions with
  `{not: {buffActive: ult_free}}` added to each, then `buff sunderblade
  layers {sum: [3, {if: {buffActive: p1_more_sword}, then: 1, else: 0}]}` if
  `ult_free`, `endBuff ult_free`, `endBuff p1_more_sword`, the talent-1
  pair. `bsu_count` at delay 15.
- `t1_end`: `buffEnded t1_amp` → `endBuff t1_amp_plus`.
- `ult_state` (cast `ultimate_skill`, delay 78, awaited): buffs `empyrean`,
  `ult_free`, `p5_resist` (P5). `ult_end`: `buffEnded empyrean` → `endBuff
  ult_free`, `endBuff p5_resist`, `{kind: cooldown, who: self, skills:
  ultimate, set: 15}`; with G5 also `{kind: cast, skill:
  chr_0030_zhuangfy_ultimate_skill_end}`.
- No talent-2 trigger (row 42).

**Skills:** attack1–5 `available: {not: {buffActive: empyrean}}`,
attack1–3_ult `available: {buffActive: empyrean}`, finisher and dive always.
Hits as in the mechanics rows: attack1 `count 2` [6, 8]; attack2 sword
`count 2` [2, 2] + range `count 4` [15, 24, 27, 30] `launch 15`; attack3
`count 4` [14, 14, 16, 16]; attack4 range `count 4` [11, 20, 23, 26]
`launch 11` (events `chr_0030_zhuangfy_attack2_abilityrange`); attack5 one
hit @20 `launch 20`, poise, `poiseControlledOnly`, controlled SP, Final
Strike; finisher 0.1 @11 + 0.9 @40; dive @1; attack1_ult @15 `launch 12`,
attack2_ult @13 `launch 10` (both events
`chr_0030_zhuangfy_attack1_ult_1_abilityrange`), attack3_ult @33 `launch
3`, Final Strike, poise controlled only, controlled SP.

`normal_skill` (`teamEnergy [{frame 6, ratio 1}]`): for N = 2…9 a strike hit
and for N = 1…9 a final hit; frames: strike k at 13 + ⌈k (9 − N/3)⌉ + 3,
final at 13 + ⌈N (9 − N/3)⌉ + 6 (N = 9: [22, 28, …, 64] and 73; N = 1: 28).
N = 9:

```json
{ "id": "strike_9", "scale": [], "scaleValue": {"sum": ["atk_scale", {"product": ["atk_up_per_conduct", {"stackCount": "conduct_cnt"}]}]},
  "count": 8, "frames": [22, 28, 34, 40, 46, 52, 58, 64], "events": ["buff_chr_0030_zhuangfy_sword_triggerd"], "launch": 13,
  "energy": "usp_extra", "if": {"stack": "strike_n", "atLeast": 9, "below": 10},
  "buffs": [{"buff": "t1_amp_plus", "beforeDamage": true, "if": {"talentAtLeast": [0, 1]}}] },
{ "id": "final_9", "scale": ["final_rate"], "scaleValue": "(as strike_9)", "frames": [73], "events": ["buff_chr_0030_zhuangfy_sword_triggerd"],
  "launch": 13, "energy": "usp_extra", "poise": "poise", "if": {"stack": "strike_n", "atLeast": 9, "below": 10}, "buffs": "(as strike_9)" }
```

`normal_skill_ult` (`teamEnergy [{frame 5, ratio 1, if: {not: {buffActive:
ult_free}}}]`): the same pairs with strikes at 27 + 6(k − 1), the final at
6N + 26, `launch 15`, events
`chr_0030_zhuangfy_normal_skill_ult_abilityrange`, no energy, the final with
`applies: [{kind: infliction, element: pulse}]`.

`combo_skill` (`cooldownGroup: combo`, not in the state) and
`combo_skill_ult` (same group, in the state; no energy, `atk_scale` 5.4, no
ring hit):

```json
{ "id": "hit", "scale": ["atk_scale"], "frames": [24], "poise": "poise",
  "applies": [{ "kind": "consumeInfliction", "elements": ["pulse"] },
              { "kind": "forcedReaction", "status": "electrification",
                "level": {"if": {"consumedAtLeast": 1},
                          "then": {"min": [4, {"sum": [{"consumed": true}, {"if": {"enemyStatus": "electrification"}, "then": 1, "else": 0}]}]},
                          "else": 0} }],
  "energy": {"sum": ["usp", {"product": ["usp_extra", {"consumed": true}]}]} }
```

`ultimate_skill`: `hits: []` (the state from the trigger; no
`energyBlockSeconds`).

**Equipment kits** (as written in the scratch files):
- `wpn_funnel_0015`: buffs `consume` (gameBuff `buff_wpn_funnel_0015_combo`,
  `duration`, `maxStacks: max_stack`, `damageBonus` pulse `skillType:
  battle` `pulse_dmg_up2`) and `ultimate` (gameBuff
  `buff_wpn_funnel_0015_ultimate`, `duration2`, `pulse_dmg_up3`); triggers
  `statusConsumed` `fromKinds [battle]` cooldown 0.1, and `cast kinds
  [ultimate]`.
- `wpn_funnel_0017`: buff `layer` (gameBuff `buff_wpn_funnel_0017_layer`,
  `duration`, `maxStacks`, `damageBonus` pulse `pulse_dmg_up2`); trigger
  `buffApplied gameBuffs [buff_common_affixes_enhance_pulse,
  buff_common_affixes_enhance_spell]`, by self, cooldown 0.1 (G3 interim;
  scratch: one layer per battle skill, three at most).
- `wpn_funnel_0018`: buffs `atk` (self, gameBuff
  `buff_wpn_funnel_0018_layer`, `maxStacks`, `atk_up`) and `team_atk`
  (team, `recipients: {not: {isOwner: true}}`, `atk_up2`); triggers
  `buffApplied categories [susceptibility] fromKinds [combo]` and
  `inflictionApplied fromKinds [combo]`, each applying both.
- `wpn_funnel_0020`: buffs `layer` (gameBuff
  `buff_wpn_funnel_0020_intensityup`, `maxStacks: max_stack`, Nature
  `nature_dmg_up`) and `max` (gameBuff `buff_wpn_funnel_0020_maxup`,
  `nature_dmg_up2`); triggers `burst` by self cooldown 0.1 → layer, then max
  `if buffLayers ≥ 4`; `buffEnded layer` `if buffLayers below 4` → `endBuff
  max`.

**Waits on gaps:** G1 (the state's combos: the largest error), G2 (the free
battle skill's SP), G3 (Flickers from teammates' Amps), G5 (the exit skill),
G8 (log checks); G4, G6 small; G7 optional; U1–U6 interims as stated.
