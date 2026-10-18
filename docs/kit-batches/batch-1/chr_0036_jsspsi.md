# Si (chr_0036_jsspsi), Jade Vessel (wpn_claym_0018), Type 50 Yinglung (suit_atk02): gap report

Batch 1, phase 1 (analysis only). Data: rmxlinux `Json/SkillData`, `Json/BuffData`,
`TableCfg/{CharGrowthTable,CharacterPotentialTable,PotentialTalentEffectTable,SkillPatchTable,WeaponBasicTable,EquipSuitTable,I18nTextTable_EN}`.
Engine/kit format as of this checkout (`schemas/kit.schema.json`, `packages/engine/src/*`).
Claims from the current kit (`packages/data/kits/operators/chr_0036_jsspsi.json`) and
`packages/data/kits/weapons.json` are marked *(claim)* and were re-checked; results say
"confirmed" or "contradicted".

Abbreviations: SD = `Json/SkillData/chr_0036_jsspsi_<x>.json`, BD = `Json/BuffData/buff_chr_0036_jsspsi_<x>.json`,
SPT = SkillPatchTable, PTE = PotentialTalentEffectTable. Values at skill level 12 unless said.

## Action types in the data, and which matter

Per file, presentation (animation, VFX, sound, camera, root motion, hit-stop, UI) left out:

| File | Action types that matter | Affects |
|---|---|---|
| SD attack1–5, attack4 (channel) | DamageAction (mask 128; attack5 2097280 = Final Strike), ChannelingAction (attack4, ≤6 ticks), ObtainCostAction costType 1 (attack5: SP `atb` 20 when controlled), AllowNextSkillAction, DefiniteValueCalculation (poise) | damage, SP, timing, stagger |
| SD attack4_abilityrange | DamageAction | none: not spawned by any file (grep) — dead *(claim confirmed)* |
| SD power_attack | DamageAction ×4 with BreakingAttackCalculation `multiplier` 0.07/0.10/0.13/0.70 × atk_scale (mask 132 = basic + finisher bit), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` | damage, SP, stagger gate |
| SD plunging_attack_end | DamageAction (mask 1152 = dive), ObtainCostAction costType 1, SpawnAbilityEntity/RandomAction/CreateBuff `plunging_attack_ayao` (visual) | damage, SP |
| SD normal_skill | SpawnAbilityEntity `normal_skill_abilityrange_1` at frame 9 (assigns atk_scale, duration, static_duration, ink_damage_rate, poise), AllowNextSkillAction → `normal_skill_1` from frame 34 | timing, state |
| SD normal_skill_abilityrange_1 | **SpellInfliction enabled** (type 0 / type 2) chosen by SaveCharTypeIdToIntBySquadSlot `slotIndex 0` + CompareFloat; DamageAction (mask 4352 = battle) `EntityBB_atk_scale`; CreateBuff `xianjing_inkhurteffect` (Artful Intent, duration = `duration` 20 s), `normal_skill_hitstop` (Immobilization, duration `static_duration`), `normal_skill_check` (skill-state driver), `buff_common_obtain_ultimate_sp` (team energy) | damage, arts state, state, resources |
| SD normal_skill_1 (Initial Stroke, 15 SP) | SpawnAbilityEntity `normal_skill_abilityrange` (Inksoul, no DamageAction), ChangeSkillAction → `normal_skill_2`, CreateBuff `buff_common_obtain_ultimate_sp`, FinishBuffAdvanced | state, resources (no damage) |
| SD normal_skill_2 (Final Stroke, 0 SP) | ChangeSkillAction → `normal_skill`, FinishBuffAdvanced `normal_skill_check`, CreateBuff `xianjing_inkboom` at frame 12 | state, triggers the burst (no direct damage) |
| SD normal_skill_inkmove_2 | DamageAction ×8 damageType **8 (fixed)**, value = `ink_damage` (recorded), poise `ink_poise`; FinishBuffAdvanced | damage (burst when the Inksoul returns) |
| SD normal_skill_inboom_projhit / inkmark_projhit | DamageAction damageType 8 (fixed), projectile from BD xianjing_inkhurteffect / xianjing_inkboom | damage (burst on Artful Intent expiry) |
| SD combo_skill | SpawnAbilityEntity `combo_skill_abilityrange` (passes `EntityBB_combo_count`, then resets it), TimeDilationAction 0.8 s, CreateBuff obtain_ultimate_sp | damage, timing |
| SD combo_skill_abilityrange | DamageAction ×10 (mask 12288 = combo) `EntityBB_atk_scale` at entity frames 14–41, final DamageAction `atk_scale_count` at 49; SimpleCalcBB: `atk_scale_count = combo_count × atk_scale2_1 + atk_scale2` (both branches of the potential5 IfElse add **0** to combo_count); P2 buff branch: `combolayer = (combo_count [+1 in one branch]) × potential2_enhance + potential2_base`; ObtainCostAction costType 0 `usp` at frame 14, two more at 49 **disabled** *(claim confirmed)* | damage, energy, buff |
| SD ultimate_skill / _abilityrange / _abilityrange_1 | Spawns `_abilityrange` (controlled branch) or `_abilityrange_1` (not controlled); DamageAction ×8 `EntityBB_atk_scale` + 1 `EntityBB_atk_scale_2` (mask 4608 = ultimate); CreateBuff `atk_buff_2` on the team (enhance_final, enhance_duration); GetCharBySquadSlot slot 0 + SetSkillCdAtOnce `skillTypeMask 64`, value `talent_combo_reduce` = talent buff `coolDown` × −1 (10 / 20); heal buff **disabled** | damage, team buff, cooldown |
| BD atk_buff_2 | EnhancedAction ×2 (Cryo, Heat Amp; a third disabled), stackingType 2, max 1 | damage |
| BD combo_potential2 | attributeModifier attr 2 (ATK), formulaItem 6, value `potential2_count`; duration `potential2_duration`; its own SimpleCalcBB/Refresh are disabled (value set by the combo entity) | damage |
| BD normal_skill_hitstop | TimeDilationAction layer 1, duration −1 (= buff lifetime); applyTags `-1065936627` (also on `buff_chr_0027_tangtang_ultskill_debuff`) | timing; the tag Jade Vessel keys on |
| BD xianjing_inkhurteffect (Artful Intent) | SaveDamageContext → SimpleCalcBB `ink_damage2 = ink_damage × ink_damage_rate`, `EntityBB_ink_damage += ink_damage2` (accumulated on Si); CheckDamageTransferredSource; on end: LaunchProjectile (inboom_projhit) or CastSkill inkmove_2 via the Inksoul; ChannelingActionV2 (UI display cap 999 ×10⁴); StoreEntityProperty `kill_damage` (enemy death); child BD xianjing_inkhurteffect_1 (SpellInfliction ×4 under a **disabled** SwitchAction) | damage (record), state |
| BD normal_skill_check | ChangeSkillAction ×4 (normal_skill ↔ _1 ↔ _2), SetBuffDurationAction, FinishBuff | state |
| BD xianjing_inkboom, xianjing_linkline | CastSkill inkmove_2, CreateBuff `talent1_1/_2` → `talent1_speedup` (SpeedupAction, stackingType 1 priority `ratio_speed`) | state, timing (Haste) |
| BD talent2_1/_2, talent1_1/_2 | none (markers, stackingType 7; read by the ultimate / inkboom) | — |
| BD unreferenced (dead): atk_buff, ayao_*, combo_skill_layercount, ink_mark, ink_triggered, normal_skill (VulnerableAction, only via the dead linkboom), normal_skill_in_combo, potential5vfx, qizi_count, xianjing_inkboomqizi(_1), xianjing_inkdamage(_marker), xianjing_linkboom(_ex), xianjing_listener(_1) | (none reach a live skill; grep over SkillData + BuffData) | — |
| BD `buff_common_obtain_ultimate_sp` | ObtainUspInNormalSkill (`usp_everyone` 6.5 per 100 SP × ratio) | energy |

## Mechanics

### Operator

| # | Mechanic (source) | Status | Expressed by / missing |
|---|---|---|---|
| 1 | Basic attacks 1–5: hits, keys, frames (SD attack1–5; SPT `atk_scale1/2`, `atk_scale`) | supported | kit hits with scale/frames (already in the kit) |
| 2 | Basic attack 4 channel: ≤6 ticks, ends early on move input (SD attack4 ChannelingAction frames 5–40, CheckHasMoveInput) | supported | 6 fixed hits; early cancel is a rotation choice, not modelled (minor) |
| 3 | Final Strike: mask 2097152, SP `atb` 20 (SD attack5 ObtainCostAction costType 1) | supported | `finalStrike` from mask; `atb` read by the engine at the first hit |
| 4 | Stagger (poise) on every hit; "As the controlled operator, Final Strike also deals {poise} Stagger" (CharGrowthTable NormalAttack desc; DefiniteValueCalculation poise units) | gap | G8 |
| 5 | Finisher: 4 hits at frames 3/12/21/37 with multipliers 0.07/0.10/0.13/0.70 × atk_scale (SD power_attack BreakingAttackCalculation) | data | `factor` per hit exists; kit still has one summed hit at 37 *(claim confirmed: sum = 1.00)*; kit-draft doesn't emit the factors (G11) |
| 6 | Finisher only near a Staggered enemy, finisher zone, SP recovery (GainBreakingAttackAtb) (desc: "Basic attack performed near a Staggered enemy becomes a finisher … recovers some SP") | gap | G8 |
| 7 | Dive attack (SD plunging_attack_end, mask 1152, SP via ObtainCostAction) | supported | kit hit; dive SP not checked (costType 1 value from blackboard `atb` = 0) |
| 8 | Battle skill hit: Cryo DMG `atk_scale` 1.0, entity spawn frame 9 + entity frame 6 (SD normal_skill, normal_skill_abilityrange_1) | supported | kit hit at frame 15 (matches zmdlogs-40d9a3c1da37, b7b3762d5da8) |
| 9 | Battle-skill infliction: Cryo, or Heat if the slot-1 operator is Heat (desc; SD normal_skill_abilityrange_1: SaveCharTypeIdToIntBySquadSlot **slotIndex 0** → CompareFloat → SpellInfliction type 0 / type 2, both **enabled**) | supported | two hit entries with `if: {teamSlotElement:{slot:0,element:"fire"}}` / `not`, each with its `applies`. Kit today always inflicts Cryo (wrong with Laevatain in slot 1 in zmdlogs-40d9a3c1da37). The data branch is enabled, so kit-draft could compile it (G11). Settles which slot: index 0 = first (in-game test 14 becomes a confirmation only) |
| 10 | Immobilization on the battle-skill target for `static_duration` 1 s (+0.5 at P1) (BD normal_skill_hitstop: enemy TimeDilation layer 1, tag −1065936627) | gap | G7 (time), G13 (a named, tagged control status that hits apply; Jade Vessel keys on it) |
| 11 | Artful Intent: 20 s (`duration`); records `ink_damage_rate` (0.13, +0.07 at P1) of DMG the target takes; bursts as Fixed DMG on expiry or Final Stroke (desc; BD xianjing_inkhurteffect SaveDamageContext + SimpleCalcBB; SD inkmove_2 / inboom_projhit damageType 8) | unique? | G2. Which damage counts is **unknown**: see G2 evidence (the kit's "0.1998 in 40d9a3c1da37" is contradicted) |
| 12 | Battle-skill states: battle skill → Initial Stroke (`normal_skill_1`, 15 SP, hitless, pulls the Inksoul) → Final Stroke (`normal_skill_2`, 0 SP, hitless, ends Artful Intent early → burst) → back (SD ChangeSkillAction in normal_skill_1/_2 and BD normal_skill_check; AllowNextSkillAction windows) | gap | G1 |
| 13 | Inksoul: damage/effects on it go to the host, once (desc) | supported | one enemy: identical to hitting the host |
| 14 | Host defeated → relink / drop Inksoul (desc; BD xianjing_linkline, StoreEntityProperty kill_damage) | supported (n/a) | one immortal enemy |
| 15 | Team ultimate energy from SP spent: battle skill and Initial Stroke apply `buff_common_obtain_ultimate_sp` (6.5 per 100 SP) — at the **hit** (entity frame 6, only if it hits: CheckEntityNum) for the battle skill, at frame 0 for Initial Stroke | gap (minor) | engine grants 0.065/SP at the cast for every SP-cost skill: right amount, ~15 frames early for the battle skill; G9 |
| 16 | Combo trigger: "When an enemy's Cryo Infliction or Heat Infliction is consumed or absorbed" (CharGrowthTable) | supported | `comboTriggers` `inflictionConsumed` cryst/fire (reactions count as consumption in `conditionMet`) |
| 17 | Combo slashes: 10 × `atk_scale` at entity frames 14–41, spawn frame 0 (SD combo_skill_abilityrange) | supported | kit hits |
| 18 | Combo energy `usp` 10 at frame 14 (ObtainCostAction costType 0; the two at frame 49 are disabled) | supported | `energy: "usp"` on the first slash |
| 19 | Combo final hit: `atk_scale2 + n × atk_scale2_1`, n = "highest stacks of Arts Infliction consumed or absorbed from a single target" (desc; SD combo_skill_abilityrange SimpleCalcBB `atk_scale_count`; `EntityBB_combo_count` set by game code) | gap | G3; kit uses n = 1 (+1 at P5) as a lower bound |
| 20 | P5 "+1 stack" and where it is added | unknown | G3 evidence: the final-hit formula adds 0 to `combo_count` in both potential5 branches, so the +1 must already be in `combo_count` (game code) or not apply to the final hit |
| 21 | Combo time dilation 0.8 s from frame 0 (SD combo_skill TimeDilationAction) | gap | G7 |
| 22 | Combo cooldown 15 s (SPT), P5 −2 s (PTE potential_5 skillParamModifier paramType 2) | supported | engine reads SPT + `skillParams` |
| 23 | Ultimate: 8 slashes `atk_scale` + final `atk_scale_2` (SD ultimate_skill_abilityrange(_1)) | supported | kit hits |
| 24 | Ultimate team Cryo + Heat Amp `enhance_final` for `enhance_duration` 12 s (BD atk_buff_2 created at entity frame 62) | supported | kit buff `ultimate_amp` on the first slash (frame 63) `beforeDamage`; 1 frame late because a buff can't be applied without a hit (G10, minor) |
| 25 | Ultimate cost 80 (SPT), P4 ×0.85 (PTE potential_4 paramType 1); cooldown 30 s; no energy block (no RefrainObtainUsp in any Si file) | supported | engine reads SPT + `skillParams` |
| 26 | Ultimate event key depends on whether Si is controlled (`_abilityrange` vs `_abilityrange_1`) | gap (minor) | G12 |
| 27 | Talent 1 "Proxy's Patronage": after the ultimate, the Team Position 01 operator's combo cooldown −10 s / −20 s (PTE talent_1_1/_1_2 → BD talent2_1/_2 `coolDown` −10/−20; SD ultimate_skill_abilityrange_1 GetCharBySquadSlot slot 0, SetSkillCdAtOnce mask 64, value = coolDown × −1 *(claim "negated" confirmed)*) | gap | G5 |
| 28 | Talent 2 "Unsoiled Brush": when the Inksoul disappears, allied operators gain 15% / 30% Haste for 5 s (PTE talent_2_1/_2_2 → BD talent1_x → BD talent1_speedup SpeedupAction, priority-keyed) | gap | G6 |
| 29 | Attribute nodes: Intellect (attr 41) +10/+15/+15/+20 (CharGrowthTable chr_0036_jsspsi_1/3/5/7; nodes 5 and 7 need trust 300) | supported | panel (`attributeNodes`) |
| 30 | P1: Immobilization +0.5 s, record ratio +0.07, burst radius +0.4 (PTE potential_1, modifyType 1 add) | supported (values) | `skillValues` add; the mechanisms they feed are G2/G7 |
| 31 | P2: on combo cast, ATK + [potential2_base 0.08 + potential2_enhance 0.03 × n] for potential2_duration 10 s, no stacking (PTE potential_2 sets the keys; BD combo_potential2 ATK attr, stackingType 2 max 1; below P2 the keys are 0) | gap | G3 (n) and G4 (no buff below P2: duration 0 makes `applyBuff` throw) |
| 32 | P3: ultimate `atk_scale`, `atk_scale_2`, `enhance_final` ×1.2 (PTE potential_3 modifyType 2) | supported | `skillValues` multiply |
| 33 | P5: combo `atk_scale`, `atk_scale2`, `atk_scale2_1` (and unused `_2`, `_3`) ×1.15; `potential5` = 1 | supported | `skillValues`; the kit's `potential5` scale trick |

### Jade Vessel (wpn_claym_0018), wielder-generic

WeaponBasicTable `weaponSkillList`: `wpn_attr_wisd_high`, `wpn_sp_attr_crystdam_high`, `sk_wpn_claym_0018`.
SPT sk_wpn_claym_0018 level 1 → 9: atk_up 0.16 → 0.448, dmg_taken_up 0.075 → 0.21, duration 30, duration_combo 20, combo_dmg_up 0.25 → 0.70, max_stack 1.
Description: "When the wielder applies Immobilization on the enemy, the target enemy suffers DMG Taken +X for 30s. When the wielder applies Immobilization on the enemy or after the wielder casts an ultimate, the next combo skill cast within 20s gains DMG Dealt +Y. The two effects apply separately and do not stack with themselves."

| # | Mechanic (source) | Status | Expressed by / missing |
|---|---|---|---|
| W1 | Skill 1: Intellect +156 at level 9 (permanent) | supported | panel |
| W2 | Skill 2: Cryo DMG +43.3% (permanent) | supported | panel |
| W3 | Skill 3: ATK +atk_up (permanent; 0.384 at level 8: panel 53.4% = 0.384 + set 0.15) | supported | panel |
| W4 | On the wielder applying a status tagged Immobilization (sk_wpn_claym_0018 passiveEventActions abilityEvent 102, CheckBuffIdInContext **checkType 1** with tag −1065936627; the listed buff id is Si's hitstop, but the tag is also applied by `buff_chr_0027_tangtang_ultskill_debuff`): the target gets `buff_wpn_claym_0018_enemyvul`, DMG taken +dmg_taken_up (defender NormalCalcZone) for `duration` 30 s, stackingType 11 priority key (strongest only) | gap | G13 + G14. Today an always-on condition `enemy_vulnerable` (weapons.json); value matches logs *(claim confirmed: vuln_taken 0.18 at level 8 in zmdlogs-40d9a3c1da37)* but it applies from t=0 and never expires |
| W5 | On the wielder applying Immobilization, or casting an ultimate (abilityEvent 30, CheckSkillType skillTypeList [7]): self `normal_skill_trigger` (duration 20 s, max_stack 1); on the wielder's next combo cast (abilityEvent 30, skillTypeList [6]) it becomes `normal_skill_comboimbue_atk`: DMG +combo_dmg_up × stacks (NormalCalcZone) for hits with mask 8192 **of that cast only** (CheckSkillCastId), and the trigger ends | gap | G14 + G15. Today an always-on condition `combo_after_battle_skill` (whole fight, every combo; and its label says "after Si's battle skill", which misses the ultimate source). Value fits zmdlogs-40d9a3c1da37 (0.6 at level 8) and 0eef2474a26f (0.7 at level 9) *(claim confirmed for the values; not logged by ZMDLogs)* |
| W6 | `buff_wpn_claym_0018_comboimbue` / `_comboready` (attr 64–69 bonuses, max 3) | supported (n/a) | not referenced by sk_wpn_claym_0018 or any other file: dead |

### Type 50 Yinglung (suit_atk02), wearer-generic, 3 pieces

EquipSuitTable suit_atk02 → `passive_equipsuit_atk_02` (equipCnt 3). SPT: atk_up 0.15, dmg_up 0.2, max_stack 3.
Description: "Wearer's ATK +15%. When any operator in the team casts a battle skill, the wearer gains 1 stack of Yinglung's Edge that gives DMG +20% to the wearer's next combo skill. Yinglung's Edge can stack 3 time(s)."

| # | Mechanic (source) | Status | Expressed by / missing |
|---|---|---|---|
| Y1 | ATK +15% (permanent) | supported | panel |
| Y2 | Team battle-skill cast → wearer +1 stack (BD buff_equipsuit_atk_02 AuraAction on the team → `_aruadetect` abilityEvent 30 CheckSkillType [2] → `_addcombodamage`, stackingType 2, max `max_stack`, no duration); wearer's next combo cast ([6]) → `_addcombodamage_buff` DMG +dmg_up × stacks (NormalCalcZone, mask 8192, CheckSkillCastId: that cast only), stacks cleared | gap | G14 + G15 + G16 (gear sets aren't a kit/condition source at all) |
| Y3 | Whether Si's Initial Stroke / Final Stroke count as "casts a battle skill" (skill type 2) | unknown | the strokes are separate battle-group skills; zmdlogs-40d9a3c1da37 fits 2 stacks (Si 6565 ms, Camille 6751 ms) before the combo at 13917 ms, so either no stroke was cast before it or strokes don't count; in-game test T4 |

## Gaps

### G1. Battle-skill states (Initial Stroke, Final Stroke) — family: skills (states)
- **Feature:** a skill slot whose skill changes by state: casting `normal_skill` replaces the battle skill with `normal_skill_1` while Artful Intent lasts; casting `normal_skill_1` replaces it with `normal_skill_2` while the Inksoul lasts; `normal_skill_2` (or Artful Intent ending) restores `normal_skill`. Needs (a) hitless kit skills with their own SP cost (15 / 0 from SPT), lock and cancel window; (b) a state that a cast or a buff's end sets and clears (`availableWhile`/`unavailableWhile` exist, but nothing can end a buff early or start one without a hit); (c) cast-time effects (end Artful Intent → burst). Evaluated at cast legality (`earliestStart`) and at cast (`apply`).
- **Evidence:** SD normal_skill_1 ChangeSkillAction → `normal_skill_2`, SD normal_skill_2 ChangeSkillAction → `normal_skill` + FinishBuffAdvanced `normal_skill_check` + CreateBuff `xianjing_inkboom` at frame 12; BD normal_skill_check ChangeSkillAction ×4; desc "After casting the skill, Si's battle skill is temporarily changed to Initial Stroke … Final Stroke".
- **Impact:** illegal rotations (battle skill recast while Artful Intent is up; strokes impossible), the Initial Stroke's 15 SP and team energy missing, and the burst can't be timed early. Search can't choose when to burst.

### G2. Artful Intent damage record and Fixed-DMG burst — family: values + buff lifecycle; status unique?
- **Feature:** an enemy debuff that, while active, accumulates `rate × damage` of each hit the target takes (evaluated after each hit's damage, all operators, possibly excluding some sources — see evidence), and a hit whose value is the accumulated total, dealt as **Fixed DMG** (damageType 8: no ATK, zones, crit or DEF; event keys `normal_skill_inkmove_2` when the Inksoul returns, `normal_skill_inboom_projhit` / `_inkmark_projhit` from the projectile on expiry). Triggered by the debuff ending (expiry after `duration` 20 s, or ended by Final Stroke, G1). Needs: a per-buff accumulator, a ValueExpr term "recorded value", a fixed-damage hit kind, and "on buff end" triggers.
- **Evidence:** BD xianjing_inkhurteffect SaveDamageContext → `ink_damage2 = ink_damage × ink_damage_rate`, `EntityBB_ink_damage += ink_damage2`; SD inkmove_2 DamageAction damageType 8 value `BB:ink_damage` (and value 1 when nothing was recorded). Nobody else: `damageType 8` occurs only in Si's files; SaveDamageContext only in Si's and enemy/CC buffs. **Which damage counts is unclear:** burst ÷ all logged damage between the battle-skill hit and the burst is 0.198 in zmdlogs-0eef2474a26f (P5, rate 0.20) but **0.056** in zmdlogs-40d9a3c1da37 and 0.107 in zmdlogs-bdf223db8e49 (also P5) — the kit's claim of "0.1998 in 40d9a3c1da37" is contradicted. In 40d9a3c1da37 0.2 × cumulative damage reaches the burst value at ~13.9 s (Si's combo/ultimate, Laevatain's ult), in bdf223db8e49 at ~13.1 s, so the record may stop at some event (the Initial Stroke pull? CheckDamageTransferredSource?) or be capped.
- **Impact:** missing damage: 121k–302k per burst in the logs, 11–35 % of Si's logged damage (121312 of 1057752 in 40d9a3c1da37; 301679 of 872607 in 0eef2474a26f; 284900 of 813155 in bdf223db8e49). Unverifiable until the counting rule is known (in-game test T1).

### G3. Combo stack count from the trigger — family: triggers + values
- **Feature:** when a combo window opens on an `inflictionConsumed` (or reaction) event, store with the window the stacks consumed/absorbed from a single target (the max over events while the window is open — unknown whether a later, larger consumption raises it); the combo cast reads it as a ValueExpr term (e.g. `{triggerStacks:true}`, or `consumed` resolving to the trigger's count inside the combo's hits and buffs). Used by the final hit (`atk_scale2 + n × atk_scale2_1`) and the P2 ATK buff (`potential2_base + potential2_enhance × n`). P5's +1: see below.
- **Evidence:** SD combo_skill passes `EntityBB_combo_count` to the entity; SD combo_skill_abilityrange SimpleCalcBB `combolayer_count = EntityBB_combo_count + 0` in **both** potential5 branches, then `× atk_scale2_1 + atk_scale2`; the P2 branch has `combo_count + 1` in one branch, +0 in the other (CompareFloat compare 3, valueB 1, semantics unknown). Log: zmdlogs-40d9a3c1da37 P2 buff logged as ATK 0.20 = 0.08 + 0.03 × 4; final hit 599622 at 14737 ms = 28.125 × the slash (21320), = 18.75 × 1.5 crit, i.e. multiplier 8.625 = 4.025 + 4 × 1.15 with Si's panel crit DMG 50 % (efsim calc on the fixture build). Both use 4, consistent with `combo_count` already including P5's +1 (game code) and the P2 "+1" branch not taken at P5. *(claim "+1 when potential5 ≥ 1 in the formula" is not what the data shows; the result, n = stacks + 1 at P5, is consistent with the log.)*
- **Impact:** final hit at 1 stack (+1 at P5) vs up to 4 (+1): 4.025 + 1.15·k; at P5 the kit's 2-stack lower bound gives 6.325 vs 8.625 at 4 stacks (−27 % on a hit that is 62–74 % of the combo's damage: 599622 of 812822 in 40d9a3c1da37). P2 ATK understated likewise.

### G4. Conditional buff application on a hit — family: buff lifecycle (or conditions)
- **Feature:** `if` (Predicate) on a hit's `buffs[]` entry, or skip a buff whose resolved duration is 0 instead of throwing. Evaluated when the hit lands.
- **Evidence:** P2's buff exists only at P2+ (PTE potential_2 sets `potential2_duration` 10; SPT has 0 below); `applyBuff` throws on `duration ≤ 0` (packages/engine/src/buffs.ts).
- **Impact:** without it the P2 buff can't be in the kit at all (kit lacks it today): Si's combo at P2+ under-predicted by the ATK buff (0.20 ATK% in zmdlogs-40d9a3c1da37), and later hits for 10 s.

### G5. Cooldown change on another operator — family: triggers
- **Feature:** a trigger/hit action "reduce the remaining cooldown of skill type X of the operator in team slot N by V seconds" (SetSkillCdAtOnce functionType 0, skillTypeMask 64 = combo), with V from a talent buff's blackboard (`coolDown` × −1). Needs a ValueExpr factor for talent values (`{talent: index, buff, key}`; conditions already have this source) and an action targeting a team slot. Evaluated at the ultimate entity's frame (with the amp buff, entity frame 62).
- **Evidence:** SD ultimate_skill_abilityrange_1 GetCharBySquadSlot `slotIndex 0`, CheckBuffStackNumAdvanced `talent2_1`/`talent2_2`, GetTargetBuffBBAdvanced, SimpleCalcBB `talent_combo_reduce × −1`, SetSkillCdAtOnce. Shared: SetSkillCdAtOnce also in chr_0034_typhoea_combo_skill(floating), chr_0035_liino_normal_skill(_combo), chr_0032_lizhiyan_ultimate_skill2, chr_0005_chen_combo_skill, chr_0006_wolfgd_ultimate_skill, chr_0028_wulfa_combo_*.
- **Impact:** missing combo casts of the slot-1 operator (10–20 s earlier per Si ultimate); affects rotations/search, not per-hit damage.

### G6. Haste on a state ending — family: timing (+ triggers: on buff end)
- **Feature:** team "Haste" `ratio_speed` (0.15 / 0.30) for 5 s, priority-stacked (strongest), triggered when the Inksoul / Artful Intent ends; Haste scales action speed (locks, cancel windows, hit frames) of each affected operator.
- **Evidence:** PTE talent_2_1/_2_2; BD talent1_speedup SpeedupAction, stackingType 1 priorityKey `ratio_speed`; created from BD xianjing_inkboom and xianjing_linkline. Shared: SpeedupAction in buff_chr_0027_tangtang_comboskill_waterbuff(_outaura).
- **Impact:** 15–30 % faster team actions for 5 s after each burst: more hits in that window (DPS under-predicted by up to that much for 5 s).

### G7. Time dilation (enemy hit-stop, combo slow-down) — family: timing
- **Feature:** (a) enemy-local time dilation for a buff's lifetime (Immobilization: TimeDilationAction layer 1, `static_duration` 1 s, +0.5 at P1): the enemy's timers (infliction/status durations, Corrosion/Combustion ticks) pause; (b) the combo's global TimeDilationAction 0.8 s from frame 0. Evaluated in `status.ts` timers and tick scheduling.
- **Evidence:** BD normal_skill_hitstop; SD combo_skill TimeDilationAction duration 0.8. Kit sources: zmdlogs-0eef2474a26f Corrosion still level-2 ticks at 4.19 s after three combo casts at 3.53 s, 3 ticks from 4.32 s *(claim; consistent with in-game-tests.md #4)*. Shared: TimeDilationAction in Typhoeus's, Last Rite's, Tangtang's, Wulfa's, Liino's buffs.
- **Impact:** status ticks and expiries early by ~0.8 s per combo and 1–1.5 s per battle skill: Corrosion levels on later hits off by one (the "under unmodelled effects" hits in 0eef2474a26f / bdf223db8e49).

### G8. Stagger and the finisher — family: physical state
- **Feature:** poise per hit (DefiniteValueCalculation `poise` keys; Final Strike's extra stagger when controlled), the enemy's stagger bar, the Staggered state, the finisher only while Staggered, its zone, and its SP gain (GainBreakingAttackAtb).
- **Evidence:** SD power_attack; SPT `poise`, `ink_boom_poise`, `poise_2`; NormalAttack desc.
- **Impact:** finisher (9.0 ATK at level 12) never legal/illegal correctly; stagger-dependent bonuses missing. Shared with every operator (already a known deferred family).

### G9. Energy from SP spent at the hit — family: timing (resources)
- **Feature:** grant `buff_common_obtain_ultimate_sp` energy when the hit that applies it lands (and only if it hits), not at the cast.
- **Evidence:** SD normal_skill_abilityrange_1 CreateBuff obtain_ultimate_sp at entity frame 6 (cast frame 15) behind CheckEntityNum ≥ 1; Initial Stroke at frame 0.
- **Impact:** team energy 15 frames early per battle skill; only matters for ultimates cast at the threshold. Minor.

### G10. Buffs at a frame without a hit — family: skills (hitless skills)
- **Feature:** kit skills can apply buffs (and other effects) at a frame without a damage hit.
- **Evidence:** ultimate amp at entity frame 62, first slash at 63; P2 buff at combo entity frame 0, first slash at 14; strokes (G1) have no hits at all.
- **Impact:** amp ends 1 frame late (negligible); needed for G1/G4.

### G11. Compiler gaps (kit-draft) — family: data compilation
- **Feature/evidence:** `efsim kit-draft chr_0036_jsspsi` today: no frames; attack1 hit 1 scale `LITERAL_0` (the DamageAction uses `atk_scale1`); entity keys left as `EntityBB_atk_scale`/`EntityBB_atk_scale_2` instead of following SpawnAbilityEntity `assignPairs` back to `atk_scale`/`atk_scale_2`; combo final hit as `atk_scale_count` (the SimpleCalcBB chain `combo_count × atk_scale2_1 + atk_scale2` is in the data); finisher factors 0.07/0.10/0.13/0.70 missing; no energy (`usp` at entity frame 14); the enabled SpellInfliction + SaveCharTypeIdToIntBySquadSlot branch not turned into `applies` + `teamSlotElement`; the dead `attack4_abilityrange` drafted as a hit; `normal_skill_1/_2` not drafted; bursts drafted as hits of `normal_skill`.
- **Impact:** hand-written kit fields that the data has; the kit's single summed finisher hit and Cryo-only infliction are both from this.

### G12. Event keys by branch — family: log tooling
- **Feature:** one kit hit maps to two event keys chosen by a branch (controlled or not): `ultimate_skill_abilityrange` vs `_abilityrange_1`; burst `inkmove_2` vs `inboom_projhit` / `inkmark_projhit` by path. Kit `events` lists all; the log check must accept either.
- **Evidence:** SD ultimate_skill CheckMainCharacterCondition branches; fixtures log `_abilityrange_1` (40d9a3c1da37, b7b3762d5da8), `inkmove_2` (40d9a3c1da37, 0eef2474a26f), `inkmark_projhit` (bdf223db8e49).
- **Impact:** unverifiable hits only.

### G13. Immobilization as a status hits apply, with tags — family: physical state (control statuses)
- **Feature:** a hit `applies` a named control status (Immobilization) with a duration key, carrying the game's tag (−1065936627), so that time dilation (G7) and wielder-relative triggers (G14) can see it. Generic: Tangtang's ultimate applies the same tag.
- **Evidence:** BD normal_skill_hitstop `applyTags [-1065936627]`; BD buff_chr_0027_tangtang_ultskill_debuff same tag; sk_wpn_claym_0018 CheckBuffIdInContext checkType 1 + tag query.
- **Impact:** Jade Vessel's two effects can't key on anything (they're always on today).

### G14. Equipment triggers on the wielder's own events — family: triggers
- **Feature:** weapon and gear-set kits with a `triggers` list, wielder-relative: `on` the wielder casting a skill of a type (abilityEvent 30 + CheckSkillType), the wielder applying a status with a tag (abilityEvent 102 + CheckBuffIdInContext), any team member casting a skill of a type (Yinglung's aura); `do`: apply a timed enemy debuff (DMG taken, priority-stacked) or a self buff/stack. Values from the weapon skill at its level (or the set's SPT).
- **Evidence:** sk_wpn_claym_0018 passiveEventActions; BD buff_equipsuit_atk_02 / `_aruadetect`.
- **Impact:** Jade Vessel: DMG taken 0.18–0.21 for 30 s per battle skill (today: whole fight from t=0, over-predicting every hit before the first battle skill and after 30 s gaps); combo bonus (below).

### G15. Buffs consumed by the next cast, scoped to that cast — family: buff lifecycle
- **Feature:** a self buff/stack that the wielder's next cast of skill type X consumes (all stacks), turning into a modifier on that cast's hits only (CheckSkillCastId + decorate mask 8192), with value `per_stack × stacks`; optional window (Jade Vessel 20 s) and stack cap (Yinglung 3). Evaluated at the cast (consume) and on the cast's hits (apply).
- **Evidence:** BD buff_wpn_claym_0018_normal_skill_trigger → `_normal_skill_comboimbue_atk`; BD buff_equipsuit_atk_02_addcombodamage → `_addcombodamage_buff`. Same structure as Link (buff_common_affixes_combo_trigger → skillimbue_atk, zmdlogs-40d9a3c1da37 provenance note).
- **Impact:** Si's combo slashes in the fixtures need +1.0 (40d9a3c1da37) and +1.3 (0eef2474a26f) DMG bonus from these two; today Jade Vessel's is an always-on condition and the set's is absent, so the 11 combo hits stay unmapped in every fixture. Each Yinglung stack is +0.2 DMG bonus on a combo worth 57–77 % of Si's logged damage.

### G16. Gear sets as a kit source — family: data compilation (conditions)
- **Feature:** a gear-set kit file (like `weapons.json`), loaded when the build's equipped count reaches `equipCnt`, carrying G14/G15 triggers; values from SPT `passive_equipsuit_*`.
- **Evidence:** weapons.json source note "gear sets aren't a condition source"; `efsim calc` lists "Type 50 Yinglung set (3 pieces): conditional effects of passive_equipsuit_atk_02" as not in the panel.
- **Impact:** no gear-set conditional effect can be modelled for anyone.

## Verification

- **zmdlogs-40d9a3c1da37** (Si P5, Laevatain in slot 1, Jade Vessel 9/9/8, 3× Yinglung): battle skill and basic attack 1 match today; Heat infliction from slot 1 (bursts at 7550/7663 ms *(claim)*) checks mechanic 9; ultimate (P3 amp 0.432) checks 23–24 once G12 and the boundary-buff counting are handled *(kit claim)*; combo slashes check G15 (+0.6 weapon, +2 × 0.2 set); final hit and P2 ATK 0.20 check G3/G4; burst at 18836 ms (121312) checks G2 — does **not** fit "rate × all damage".
- **zmdlogs-0eef2474a26f** (P5, level-9 weapon skill): combo +1.3 (G15, 3 stacks), Corrosion ticks under time dilation (G7), burst 301679 = 0.198 × all damage since the battle skill (G2).
- **zmdlogs-bdf223db8e49** (P5): combo triggered by Arcane's Nature reaction on Cryo (mechanic 16), burst via `inkmark_projhit` at 24321 ms, 22.2 s after the battle skill (longer than `duration` 20 s: time dilation? G2/G7), ratio 0.107.
- **zmdlogs-b7b3762d5da8** (P1): no P3/P5 values; ultimate boundary-buff case *(kit claim)*; no burst logged.
- `efsim zmdlogs reactions` on 40d9a3c1da37 after the mechanic-9 fix: Heat bursts should then come from Si's battle skill.
- No zero-sanity fixture has Si.

**In-game tests** (to add to docs/in-game-tests.md; #10 and #14 already exist — #14 is answered by the data, slot index 0, and becomes a confirmation):
- **T1 Artful Intent record:** on a dummy, cast Si's battle skill, then (a) let it expire with only Si attacking; (b) with a teammate's big hit; (c) cast Initial Stroke early, then hit the target, then Final Stroke. Compare the burst with 0.13 (P0) × the damage numbers before / after Initial Stroke, to find what is recorded and when recording stops.
- **T2 Combo n and P5:** extends #10: at P5, consume 1 stack and read the final hit (expect 4.025 + 2 × 1.15 at level 12) and, at P2+, the ATK buff (0.08 + 0.03 × 2 if the +1 counts for P2 too).
- **T3 Jade Vessel window:** cast the ultimate (no battle skill), wait 10 s, cast the combo: the combo slashes should carry +combo_dmg_up; wait 25 s instead: they shouldn't. Also check the enemy's DMG-taken icon disappears 30 s after the battle skill.
- **T4 Yinglung stacks from strokes:** wearer Si: battle skill, Initial Stroke, Final Stroke, then combo; count the Yinglung's Edge stacks shown (1 or 3).
