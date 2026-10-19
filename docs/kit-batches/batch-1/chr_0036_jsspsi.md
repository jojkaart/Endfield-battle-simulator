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

## Re-analysis (pass 2, 2026-10-18)

Batch 1, phase 4. Checked against the engine and kit format at b33e2e7
(`schemas/kit.schema.json`, `packages/engine/src/{timeline,events,buffs,expr,damage}.ts`),
`efsim kit-draft chr_0036_jsspsi` (v2), the D1 `KNOWN` list in
`packages/data/test/skillCompile.test.ts`, and the data again (rmxlinux
SkillData/BuffData, SkillPatchTable, CharGrowthTable, I18nTextTable_EN).
Fixtures: zmdlogs-40d9a3c1da37, -0eef2474a26f, -bdf223db8e49,
-b7b3762d5da8, `fixtures/pending/zmdlogs-e82d45c46040`; examples
`si-laevatain.scenario.json`, `si-jade-vessel.json`.

### Corrections to the first round

1. **P5's +1 stack is in the data** (first round: "both branches add 0",
   G3/row 20, contradicted). SD combo_skill_abilityrange IfElse #85 on
   CompareFloat #86 (`EntityBB_potential5` compare 3 = "≥" 1): its succeed
   branch starts with ModifyDynamicBlackboard #87 `EntityBB_combo_count += 1`
   (operation 1, directValue 1), then #88–#91 `atk_scale_count =
   combo_count × atk_scale2_1 + atk_scale2`; the first round read only the
   SimpleCalcBBs. The P2 buff branch (IfElse #15) does the same:
   succeed #17 `combo_count + 1`, fail #21 `combo_count`. So
   **n = stacks consumed + potential5** for both the final hit and the P2
   ATK. kit-draft v2 shows exactly this (`(($EntityBB_combo_count + 1) ×
   atk_scale2_1) + atk_scale2` only if potential5 ≥ 1). The log fits 3
   consumed + 1 = 4 (final hit 8.625, P2 ATK 0.20 in 40d9a3c1da37). The
   CompareFloat codes used across Si's files are consistent with 0 <, 1 ≤,
   2 >, 3 ≥, 4 =.
2. **The Artful Intent counting rule is settled by the logs** (G2: first
   round "unclear", and its "kit claim contradicted" is withdrawn). The
   fixtures' burst `value` is capped by the enemy's remaining HP (the burst
   ended three of the fights); their `uncapped` field is the damage. In
   all four logs the uncapped burst is **0.20 × the sum of every logged
   hit from Si's battle-skill hit (inclusive) up to the end of Artful
   Intent**, to within the per-hit rounding:

   | Log | Burst (`value` / `uncapped`) | 0.2 × hits since the battle skill | Last recorded / first unrecorded hit before the burst |
   |---|---|---|---|
   | 0eef2474a26f (inkmove_2) | 301679 / 301679 | 301679.6 | 699 ms / 335 ms |
   | 40d9a3c1da37 (inkmove_2) | 121312 / 432652 | 432652.8 | 827 ms / 152 ms |
   | bdf223db8e49 (inkmark_projhit) | 284900 / 530319 | 530321.4 | 1210 ms / 231 ms |
   | e82d45c46040, pending (inkmove_2) | 284977 / 401585 | 401586.4 | 1995 ms / none |

   What counts: every hit on the target from anyone, reactions and
   Combustion ticks included (rate `ink_damage_rate` 0.13 + P1 0.07). The
   burst has no multipliers: Jade Vessel's DMG taken, amps and crit don't
   change it, so it is Fixed DMG. The recording stops between 335 and 699 ms
   before the burst in every log. That fits Final Stroke ending Artful
   Intent at its frame 12 with the burst (`inkmove_2`) 13 frames (433 ms)
   later, and an expiry whose projectile (`inkmark_projhit`) lands 14
   frames (467 ms) after the end. Initial Stroke doesn't reset the record:
   three logs have the Inksoul path (`inkmove_2`), and their record still
   starts at the battle-skill hit. Data agrees: BD
   xianjing_inkhurteffect ability event 12, group 1 (CheckObjectTypeMatch
   8 → SaveDamageContext `ink_damage` valueType 1 → `EntityBB_ink_damage
   += ink_damage × ink_damage_rate`) runs on every hit, with no
   cooldown. The global CD (`ink_hitcd` 0.5 s) gates only group 2, the
   visual `normal_skill_inkhurt_front` cast.
3. **Artful Intent runs on the enemy's clock.** In bdf223db8e49 it lasted
   about 21.7 s (battle-skill hit 2140 ms; burst 24321 ms − 467 ms), i.e.
   20 s + the 1.5 s Immobilization freeze (P1) + combo slow-downs. That is
   what the engine's `freezes` does to enemy debuffs.
4. Initial Stroke's own ChangeSkillAction → `normal_skill_2` is
   **disabled**. Its enabled one (→ `normal_skill`) sits under an IfElse, a
   fallback when there is no target. The Initial → Final switch comes from
   BD normal_skill_check's Switch on `EntityBB_normal_skill_id` (#3 → _2,
   #4 → _1, #5 → normal_skill). The state machine is the same as in the
   first round.
5. Immobilization's freeze is **conditional**. BD normal_skill_hitstop
   CheckBuffStackNumAdvanced (tag 188749032, compareType 0 "<" 1) runs
   before TimeDilationAction (layer 1, curve 0 → 0, duration −1, finishByAction).
   Tag 188749032 is `buff_cc_eny_control_immune_abnormal`'s, so
   control-immune enemies aren't frozen. No enemy table references that
   buff (game or level code applies it). See R8.
6. Battle-skill team energy is unconditional at frame 15. Both infliction
   branches of SD normal_skill_abilityrange_1 create
   `buff_common_obtain_ultimate_sp` (#23, #31) after CheckEntityNum ≥ 1.
   kit-draft reports "only conditionally" because it doesn't merge
   exhaustive branches (R9).
7. Both ultimate entities (`_abilityrange`, controlled; `_abilityrange_1`,
   not) have the amp buff and the talent's SetSkillCdAtOnce (2 each).
8. Poise per landing (damageAttributeType 1 units; SPT level 12):
   - none on attacks 1–4, the combo slashes, the finisher or the dive;
   - attack5 `poise` 18 (onlyEnableForMainChar);
   - battle-skill hit `poise` 5;
   - combo final hit `poise` 10;
   - ultimate slashes `poise` (0); ultimate final hit `poise_2` 20;
   - bursts `ink_poise`, which BD xianjing_linkline / xianjing_inkboom
     assign from `EntityBB_ink_boom_poise` = `ink_boom_poise` 5.
9. Jade Vessel's `buff_wpn_claym_0018_enemyvul` is stackingType **11**
   (max 1, priorityKey `dmg_taken_up`). The loader turns only stackingType
   1 into a stack group, so the engine adds up two wielders' copies (R7).
10. Talents attach per-level buffs: talent 1 → `buff_chr_0036_jsspsi_talent2_1`
    (coolDown −10) / `_talent2_2` (−20); talent 2 → `_talent1_1` (ratio_speed
    0.15) / `_talent1_2` (0.30), both duration_speedup 5. A build has only
    the one for its level in `StatPanel.sources` (R4).

### 1. First-round rows and gaps against the current engine

| First round | Now | How (fields), or what's missing |
|---|---|---|
| Row 2: attack 4 channel ends early on move input | rotation choice | The 6 fixed hits stay; no change. |
| Row 4 + G8 (stagger on every hit; Final Strike stagger only when controlled) | **supported** | Hit `poise` with the keys in correction 8; attack5 `poiseControlledOnly: true`. The stagger meter is P2. Compiler gap: poise isn't emitted (R9). |
| Row 5 (finisher landings and factors) | **supported**, hand-written | Four hits at 3/12/21/37, `scale ["atk_scale"]`, `factor` 0.07 / 0.10 / 0.13 / 0.70 (BreakingAttackCalculation `multiplier`). KNOWN lists the landings at 3/12/21; the compiler doesn't read the multiplier (R9). |
| Row 6 + G8 (finisher only on a Staggered enemy, zone, SP) | **supported**, engine | skillSpecification 8: only while Staggered, once per stagger, × the enemy's attribute 27, finisher SP. Nothing in the kit. |
| Row 7 (dive SP) | **supported** | Draft `sp: "atb"` (0 at every level). |
| Row 9 (infliction by slot 0's element) | **supported** | `applies`: `{kind:"infliction", element:"fire", if:{teamSlotElement:{slot:0, element:"fire"}}}` and `{kind:"infliction", element:"cryst", if:{not:{teamSlotElement:{slot:0, element:"fire"}}}}`. The draft has both branches, but with an opaque condition (`SaveCharTypeIdToIntBySquadSlot→spellinficttype = 0`; charType 0 = Fire), R9. |
| Row 10 + G7a + G13 (Immobilization, enemy freeze, tag) | **supported** | `{kind:"control", status:"immobilization", durationKey:"static_duration", freezes:true}` on the battle-skill hit; `control` event, `enemyControl` predicate. Control immunity isn't modelled (R8). |
| Row 11 + G2 (Artful Intent record and burst) | **gap R1** | Counting rule now known (correction 2); mechanism missing. |
| Row 12 + G1 (Initial / Final Stroke states) | **supported** | Hitless skills (`hits: []`, SP 15 / 0 from SPT), `available` predicates on `buffActive`, delayed cast triggers (`on:{event:"cast", skills:[…]}`, `delay`), `endBuff`, buffs without `duration`. Sketch in the kit plan. |
| Row 13, 14 (Inksoul transfer; host defeated) | n/a | One enemy. |
| Row 15 + G9 (team energy at the hit) | **supported** | `teamEnergyFrame: 15` (V5); Initial Stroke at the cast (default). |
| Row 16 (combo trigger) | supported | Unchanged. |
| Row 19 + G3 (combo n from the trigger) | **supported**, with R2 / R3 | ValueExpr `{eventCount:true}`: the largest count of the events that opened the window (timeline.ts openCombo: `Math.max`), as the description says ("highest stacks"). n = `{sum:[{eventCount:true}, "potential5"]}` (correction 1). One hit can't hold `atk_scale2 + n × atk_scale2_1` (R2), and the log checker has no event count (R3). |
| Row 20 (P5 +1, where) | **settled by the data** | Correction 1. |
| Row 21 + G7b (combo slow-down 0.8 s) | **supported**, automatic | Ti1 reads the combo's global TimeDilationAction (ComboSkill curve); Si's example +2.9%. Attacker hit-stop isn't modelled (generic, not Si's). |
| Row 24 + G10 (amp 1 frame late) | **supported** | Delayed cast trigger at frame 62 (entity frame 62, spawned at 0) applies `ultimate_amp`; no `beforeDamage` on a slash. |
| Row 26 + G12 (event keys by branch) | **supported** | A hit's `events` lists both `_abilityrange` and `_abilityrange_1` (and the three burst keys). |
| Row 27 + G5 (talent 1: slot 0's combo cooldown) | **supported** except R4 | Trigger action `{kind:"cooldown", who:{slot:0}, skills:"combo", seconds:{key:"coolDown", skill:"buff_chr_0036_jsspsi_talent2_2"}}` (coolDown is −10 / −20: negative cuts). At frame 62 with the amp. The source name depends on the talent level (R4). |
| Row 28 + G6 (talent 2: Haste when the Inksoul disappears) | **supported** except R4 | `on:{event:"buffEnded", buff:"inksoul"}` → team buff with `{attr:92, value:"ratio_speed"}`, duration `duration_speedup`, `gameBuff` `buff_chr_0036_jsspsi_talent1_speedup` (stackingType 1: strongest). Haste semantics are assumed (Ti4, in-game test 19). Source name: R4. |
| Row 30 (P1 values) | supported | `static_duration` → control, `ink_damage_rate` → R1's rate; `ink_boom_range` (radius) is irrelevant against one enemy. |
| Row 31 + G4 (P2 ATK buff) | **supported**, R5 minor | Buff `duration: "potential2_duration"` (0 below P2 → skipped, B6), zone `atk`, value `{sum:["potential2_base", {product:["potential2_enhance", {sum:[{eventCount:true},"potential5"]}]}]}`. Applied with `beforeDamage` on the first slash (frame 14) because a cast trigger can't read the window count (R5): it starts and ends 14 frames late. |
| W4 + G13/G14 (Jade Vessel: DMG taken on Immobilization) | **supported** | Equipment trigger `on:{event:"control", statuses:["immobilization"]}`, `by:"self"` → enemy buff, zone `damageTaken`, `dmg_taken_up`, 30 s. Cross-wielder stacking: R7. |
| W5 + G14/G15 (Jade Vessel: next combo DMG) | **supported** | Same control trigger plus `on:{event:"cast", kinds:["ultimate"]}`, `by:"self"` → self buff, `duration:"duration_combo"`, `consumedBy:["combo"]`, `damageBonus` `combo_dmg_up`, `skillType:"combo"`. |
| W6 (dead buffs) | n/a | |
| Y2 + G14–G16 (Yinglung's Edge) | **supported** | Gear-set kit (T3, `wornEquipment`): `on:{event:"cast", kinds:["battle"]}`, `by:"anyone"` → self buff, layered `maxStacks:"max_stack"`, no duration, `consumedBy:["combo"]`, `damageBonus` `dmg_up`, `skillType:"combo"` (layers add up; consumption takes all layers). |
| Y3 (do the strokes count as battle-skill casts?) | **unknown → R6** | The strokes are battle-type skills (skillSpecification 3) with `normalSkillSubType` 1 (the battle skill has 0). A `cast` trigger with `kinds:["battle"]` counts them. In-game test T4. |
| G11 (compiler) | **mostly done**, R9 | v2 now gets frames, `atk_scale1`, `EntityBB_` keys, the energy, `detached`, both infliction branches, the final hit's expression, attack5's SP and Final Strike. The dead `attack4_abilityrange` is gone. Rest: R9. |

### 2. Remaining gaps

#### R1. Damage record and Fixed-DMG burst (N2), family: values + buff lifecycle. **Unique** (data-wide)
- **Feature:** (a) an enemy buff that, while active, adds
  `rate × damage` of every hit on its target, from anyone, to its own
  total. That includes the hit that applies it (so `beforeDamage`),
  reactions and DoT ticks. The damage is the hit's full damage (no HP
  cap). The burst doesn't count. (b) The total stays readable when the buff
  ends, as a ValueExpr in the triggers that react to the end. (c) A
  hit whose damage is that value exactly (Fixed DMG: no ATK, zones, crit,
  DEF, RES or Staggered multiplier), still emitting a hit event of its kind
  (mask 4352: battle) and dealing poise. Sketch:
  `"buffs":[{"id":"artful_intent","target":"enemy","duration":"duration","modifiers":[],"records":{"rate":"ink_damage_rate"}}]`;
  trigger `{"on":{"event":"buffEnded","buff":"artful_intent"},"by":"self","delay":13,"skill":"chr_0036_jsspsi_normal_skill","do":[{"kind":"hits","hits":[{"id":"burst","damageType":"battle","fixedDamage":{"recorded":"artful_intent"},"poise":"ink_boom_poise","detached":true,"events":["chr_0036_jsspsi_normal_skill_inkmove_2","chr_0036_jsspsi_normal_skill_inkmark_projhit","chr_0036_jsspsi_normal_skill_inboom_projhit"]}]}]}`.
  Hits currently require `scale`, so `fixedDamage` replaces it.
- **Evidence:** correction 2, all four logs, within ±2.4. The mechanism is
  BD xianjing_inkhurteffect AE 12 group 1. The bursts are SD inkmove_2 /
  inkmark_projhit / inboom_projhit, DamageAction damageType 8 with
  DefiniteValueCalculation `ink_damage` / `EntityBB_ink_damage`.
  SaveDamageContext appears in no other operator's files (only enemy
  life-link, CC and gambling buffs), and damageType 8 only in these three
  Si files (16 units). Batch 2 can't change that, so it goes on
  [kit-unique.md](../../kit-unique.md) in the kits phase.
- **Impact:** 302k–530k per burst (uncapped), 32–50% of Si's damage in
  the logs (432652 of 1.37M in 40d9a3c1da37, 301679 of 0.87M in
  0eef2474a26f, 530319 of 1.06M in bdf223db8e49). Without it
  every Si rotation is under-predicted by that much, and search can't
  value Final Stroke timing. Minor: the burst lands 13 or 20 frames after
  the end depending on the Inksoul's distance (`$distancecount` 1 / 2,
  SD inkmove_2); take 13.

#### R2. Hit scale as a ValueExpr, family: values
- **Feature:** a hit's multiplier as one ValueExpr (sums of products), not
  only a product of keys, e.g. `"scale":{"sum":["atk_scale2",{"product":[{"sum":[{"eventCount":true},"potential5"]},"atk_scale2_1"]}]}`
  (or `extraScale` terms that add). Evaluated where `computeHit` builds
  `scaleParts`.
- **Evidence:** SD combo_skill_abilityrange #88–#91 / #100–#103.
  kit-draft: "scale is … not key × literal (write it by hand)". The
  `atk_scale2 / atk_scale2_1` ratio changes with level (3.48–3.54), so no
  literal factor works. KNOWN lists the kit's three-entry split.
- **Impact:** the workaround is two hits at frame 49 (`atk_scale2`; and
  `atk_scale2_1` with `extraScale [{value:{sum:[{eventCount:true},"potential5"]}, if:{potentialAtLeast:0}}]`).
  Expected damage is right, but random crits roll twice. The log checker
  can't map one logged hit to two kit hits, so a hit worth 62–74% of the
  combo stays unverifiable.

#### R3. Event counts in the log checker, family: log tooling
- **Feature:** `zmdlogs check` evaluates hits that read `{eventCount:true}`
  for each count 1–4 (as it already tries reaction stack counts) and
  reports the one that matches.
- **Evidence:** packages/cli/src/logcheck.ts computes kit hits with
  `situation: {team}` only. `expr.ts` throws on `eventCount` without a
  count, and the checker catches that as "doesn't happen".
- **Impact:** the combo's final hit (599622 in 40d9a3c1da37, 379860 in
  0eef2474a26f, 1135323 in e82d45c46040) can't be checked even after R2.

#### R4. Talent values by the build's talent level, family: values
- **Feature:** a value naming a talent's key without naming its per-level
  buff, e.g. `{"talent":1,"key":"coolDown"}`, resolving to the buff that
  talent attaches at the build's level. Also a predicate (or a skip rule)
  for "talent not unlocked", so the trigger doesn't run at level 0.
- **Evidence:** `talentNodes` (correction 10). `StatPanel.sources` holds
  only the current level's buff ID, and `skillValue` throws for the other.
- **Impact:** a kit written for level 2 (`_talent2_2`, `_talent1_2`) throws
  for builds at talent level 1 or 0. It fails loudly, not wrongly, but
  those builds can't be simulated. Affects Si's two talents; any talent
  with per-level buffs and a triggered effect has the same problem.

#### R5. The combo's window count in cast triggers, family: triggers (minor)
- **Feature:** a cast event of a combo carries its window's count, so a
  delayed cast trigger can read `{eventCount:true}` (today
  `eventCountOf` returns 1 for every non-status event).
- **Evidence:** BD combo_potential2 is created at combo entity frame 0
  (`potential2_count = combo_count × enhance + base`); the first slash is
  at 14.
- **Impact:** the P2 ATK buff starts and ends 14 frames (0.47 s) late
  (applied by the first slash instead). It never misses a hit of the
  combo. Negligible.

#### R6. Which battle skills count as "casts a battle skill", family: triggers. **Unknown** (in-game T4)
- **Feature:** if T4 shows the strokes don't count, a cast filter that
  tells the main battle skill from its sub-skills (SkillData
  `normalSkillSubType` 0 vs 1; e.g. `on:{event:"cast", kinds:["battle"], subType:0}`),
  read from the data.
- **Evidence:** SD normal_skill_1 / _2 `normalSkillSubType` 1,
  skillSpecification 3. The game's CheckSkillType `[2]` (Yinglung
  `_aruadetect`; Link's battle-skill consumption) may or may not see them.
- **Impact:** with the strokes counted, Yinglung gains up to 2 stacks too
  many per Si cycle (+0.2 combo DMG each), and Link is wasted on a hitless
  Initial Stroke. Either can be wrong by a whole stack.

#### R7. Stacking type 11 across owners, family: buff lifecycle (minor, unknown)
- **Feature:** decide whether stackingType 11 with a priority key
  (`buff_wpn_claym_0018_enemyvul`) means only the strongest instance on the
  target counts, as with type 1, and put it in the loader's stack groups.
- **Evidence:** correction 9. The description says "do not stack with
  themselves".
- **Impact:** only with two Jade Vessel wielders on one team, which then
  over-predict by 0.075–0.21 DMG taken. One wielder is unaffected.

#### R8. Control immunity, family: physical state (minor)
- **Feature:** enemies that carry the control-immune tag (188749032) get
  the control status (Jade Vessel still triggers on applying it) but no
  freeze. That needs an enemy property in the scenario or enemy data.
- **Evidence:** correction 5. bdf223db8e49 (eny_0046) shows the freeze
  working there; no table says which enemies are immune.
- **Impact:** against an immune boss, Artful Intent, Jade Vessel's 30 s
  debuff, infliction timers and Corrosion would run 1–1.5 s shorter per
  battle skill than the engine predicts.

#### R9. Compiler remainders (D1), family: data compilation
- **Feature/evidence:** `kit-draft chr_0036_jsspsi` today:
  - no `factor` from BreakingAttackCalculation `multiplier` (finisher);
  - no `poise` (skillCompile.ts skips damageAttributeType 1 units);
  - no `teamEnergyFrame` when every branch has the buff (battle skill, frame 15);
  - the SaveCharTypeIdToIntBySquadSlot branch isn't turned into
    `teamSlotElement {slot:0, element:"fire"}`;
  - no buffs (atk_buff_2 at 62, combo_potential2 at 0, hitstop → a
    `control` application);
  - the bursts are drafted as `LITERAL_0` hits of normal_skill (at 629) and
    of normal_skill_1;
  - `inboom_projhit` isn't reached;
  - normal_skill_2 isn't drafted (no landings);
  - no SetSkillCdAtOnce.
- **Impact:** all of these are hand-written in the kit; none blocks it.

**Open: 9** (R1–R9; R6 and R7 depend on in-game answers). R1 is the only
one with a large damage effect.

### 3. Kit plan

Data sources: SD = SkillData, BD = BuffData, SPT level 12 values; frames
from kit-draft v2 unless noted. Drop every `durationFrames` (the loader
reads the timing). All entity and projectile hits are `detached`.

**Operator kit `chr_0036_jsspsi.json`** (element `cryst`)

Buffs:
- `artful_intent`: target enemy, `gameBuff` buff_chr_0036_jsspsi_xianjing_inkhurteffect,
  duration `duration` (20 s), no modifiers, `records` rate
  `ink_damage_rate` (R1).
- `inksoul`: self, no duration, no modifiers (BD xianjing_linkline: "lasts
  as long as the remaining duration of Artful Intent", so it is ended
  with Artful Intent rather than timed).
- `ultimate_amp`: team, `gameBuff` buff_chr_0036_jsspsi_atk_buff_2,
  duration `enhance_duration`, zone `amp` `enhance_final` for `cryst` and
  `fire` (as now).
- `combo_p2_atk`: self, `gameBuff` buff_chr_0036_jsspsi_combo_potential2,
  duration `potential2_duration`, zone `atk`, value
  `{sum:["potential2_base",{product:["potential2_enhance",{sum:[{eventCount:true},"potential5"]}]}]}`.
- `talent_haste`: team, `gameBuff` buff_chr_0036_jsspsi_talent1_speedup,
  duration `duration_speedup`, `{attr:92, value:"ratio_speed"}` (values
  from the talent-2 buff, R4).

Triggers:
- `combo_window`: unchanged (`inflictionConsumed` cryst/fire, anyone,
  `openCombo`).
- `ultimate_effects`: `on:{event:"cast", skills:["chr_0036_jsspsi_ultimate_skill"]}`,
  `by:"self"`, `delay:62`, `do:[{kind:"buff", buff:"ultimate_amp"},
  {kind:"cooldown", who:{slot:0}, skills:"combo", seconds:<talent 1 coolDown>}]`
  (SD ultimate_skill_abilityrange(_1) CreateBuff atk_buff_2 and
  SetSkillCdAtOnce at entity frame 62).
- `initial_stroke`: `on:{event:"cast", skills:["chr_0036_jsspsi_normal_skill_1"]}`,
  `delay:8`, `do:[{kind:"buff", buff:"inksoul"}]` (CreateBuff linkline at 8).
- `final_stroke`: `on:{event:"cast", skills:["chr_0036_jsspsi_normal_skill_2"]}`,
  `delay:12`, `do:[{kind:"endBuff", buff:"artful_intent"}]` (CreateBuff
  xianjing_inkboom at 12; the recording ends here, correction 2).
- `artful_intent_end`: `on:{event:"buffEnded", buff:"artful_intent"}`,
  `do:[{kind:"endBuff", buff:"inksoul"}]`.
- `burst`: `on:{event:"buffEnded", buff:"artful_intent"}`, `delay:13`,
  `skill:"chr_0036_jsspsi_normal_skill"`, the burst hit of R1 (Fixed DMG
  = record, poise `ink_boom_poise`, three event keys).
- `inksoul_haste`: `on:{event:"buffEnded", buff:"inksoul"}`,
  `do:[{kind:"buff", buff:"talent_haste"}]` (BD xianjing_inkboom /
  xianjing_linkline create talent1_x).

Skills, hit by hit:
- attack1: `atk_scale1` @6, `atk_scale2` @15, event attack1 (as now).
- attack2: `atk_scale` @5. attack3: `atk_scale` @9. attack4: `atk_scale`
  ×6 @5–20.
- attack5: `atk_scale` @25, `sp:"atb"` (20, controlled only per the draft),
  `finalStrike`, `poise:"poise"` (18) with `poiseControlledOnly:true`,
  event attack5.
- power_attack (finisher): four hits `atk_scale` @3/12/21/37 with `factor`
  0.07/0.10/0.13/0.70, event power_attack. The finisher multiplier and SP
  come from the engine.
- plunging_attack_end: `atk_scale` @1, `sp:"atb"` (0).
- normal_skill:
  - `available:{not:{buffActive:"artful_intent"}}`, `teamEnergyFrame:15`;
  - one hit `atk_scale` @15, event normal_skill_abilityrange_1, `poise:"poise"`;
  - `buffs:[{buff:"artful_intent", beforeDamage:true}]`, so the hit itself
    is recorded (0eef2474a26f needs it);
  - `applies`: Heat if slot 0 is Heat, else Cryo (row 9), then
    `{kind:"control", status:"immobilization", durationKey:"static_duration", freezes:true}`
    (SD normal_skill_abilityrange_1 #27/#28 and #19/#20; damage first, so
    Jade Vessel's debuff misses this hit, as in the game).
- normal_skill_1 (Initial Stroke): `damageType` battle,
  `available:{all:[{buffActive:"artful_intent"},{not:{buffActive:"inksoul"}}]}`,
  `hits: []` (15 SP and its team energy from SPT; effects by trigger).
- normal_skill_2 (Final Stroke): `damageType` battle,
  `available:{buffActive:"inksoul"}`, `hits: []` (0 SP).
- combo_skill:
  - `slash_first` `atk_scale` @14 with `energy:"usp"` and
    `buffs:[{buff:"combo_p2_atk", beforeDamage:true}]` (R5);
  - `slash` ×9 @17–41;
  - `final` @49 with `poise:"poise"` (10) and scale
    `atk_scale2 + (eventCount + potential5) × atk_scale2_1` (R2; until
    then the two-hit split);
  - event combo_skill_abilityrange on all of them.
- ultimate_skill:
  - `slash` ×8 `atk_scale` @63–88 (poise 0: none);
  - `final` `atk_scale_2` @100 with `poise:"poise_2"` (20);
  - `events` `[…_ultimate_skill_abilityrange, …_ultimate_skill_abilityrange_1]`;
  - the amp moves to the trigger. The time stop is read from the data.
- Notes to fix:
  - the battle-skill note's ratio claim (0.1998) is right, but on
    `uncapped`;
  - the combo note's "+1 when potential5 ≥ 1" is right;
  - the ultimate note's "not modelled" cooldown is now the trigger.

**Weapon kit `equipment/wpn_claym_0018.json`** (values `sk_wpn_claym_0018`
at the build's level; drop both legacy `conditions`)
- Buff `wpn_claym_0018.enemy_vul`: enemy, `gameBuff` buff_wpn_claym_0018_enemyvul,
  duration `duration` (30 s), zone `damageTaken` `dmg_taken_up`.
- Buff `wpn_claym_0018.combo_ready`: self, `gameBuff`
  buff_wpn_claym_0018_normal_skill_trigger, duration `duration_combo` (20 s),
  `consumedBy:["combo"]`, zone `damageBonus` `combo_dmg_up`,
  `skillType:"combo"` (max_stack 1, so a plain buff).
- Trigger `on:{event:"control", statuses:["immobilization"]}`, `by:"self"`,
  `skill:"sk_wpn_claym_0018"` → buff enemy_vul, buff combo_ready
  (passiveEventActions abilityEvent 102, CheckBuffIdInContext checkType 1 on
  tag −1065936627).
- Trigger `on:{event:"cast", kinds:["ultimate"]}`, `by:"self"` → buff
  combo_ready (abilityEvent 30, CheckSkillType [7]).
- Permanent Intellect, Cryo DMG and ATK stay in the panel.

**Gear-set kit `equipment/suit_atk02.json`** (values `passive_equipsuit_atk_02`;
3 pieces)
- Buff `suit_atk02.edge`: self, `gameBuff` buff_equipsuit_atk_02_addcombodamage,
  no duration, `maxStacks:"max_stack"` (3), `consumedBy:["combo"]`, zone
  `damageBonus` `dmg_up`, `skillType:"combo"`.
- Trigger `on:{event:"cast", kinds:["battle"]}`, `by:"anyone"` → buff edge
  (BD buff_equipsuit_atk_02 aura → `_aruadetect` CheckSkillType [2]; R6
  for the strokes).
- ATK +15% stays in the panel.

**Examples and fixtures.**
- `si-laevatain.scenario.json` loses its two `wpn_claym_0018.*`
  conditions, and its total will change: Jade Vessel's bonuses become
  timed, the set's stacks and P2 appear, and the burst appears once R1
  exists.
- Checks to expect:
  - burst uncapped 432652 (40d9a3c1da37), 530319 (bdf223db8e49), 301679
    (0eef2474a26f), 401585 (pending e82d45c46040);
  - combo slashes with +0.6 / +0.7 weapon and 2 / 3 set stacks;
  - P2 ATK 0.20 and final hit n = 3 + 1 in 40d9a3c1da37;
  - ultimate under the amp from frame 62.

### 4. In-game tests for what's still unknown

The first round's T1 (what Artful Intent records) is answered by the logs.
Proposed additions and changes to docs/in-game-tests.md (not made here):
- **T2 (extends #10) Highest or latest count:** with Si's combo off
  cooldown, consume 3 stacks of Cryo, then 1 stack within 6 s, then cast
  the combo. Is the final hit 3 (+1 at P5) × `atk_scale2_1` + `atk_scale2`
  (the engine: highest), or 1 (+1)? Also, without P5, check that 1 stack
  gives 3.5 + 1.0 at level 12.
- **T3 Jade Vessel windows:**
  - cast only the ultimate, wait 10 s, then cast the combo: it should
    carry +`combo_dmg_up`; after 25 s it shouldn't;
  - time the enemy's DMG-taken icon after the battle skill: 30 s, or
    31–31.5 s (frozen with the enemy during Immobilization, as the engine
    assumes).
- **T4 Strokes as battle skills (R6):**
  - wearing 3× Type 50 Yinglung on Si: battle skill, Initial Stroke,
    Final Stroke, then read the Yinglung's Edge stacks (1 or 3);
  - with a teammate's Link up (after their combo), cast Initial Stroke:
    is Link used up?
- **T5 Control immunity (R8):** on a boss and on a normal enemy, cast
  Si's battle skill and time Artful Intent's icon: 20 s + the
  Immobilization (1 s, 1.5 s at P1) where the freeze works, 20 s where the
  enemy is immune.
- #14 (slot-0 element) stays an optional confirmation; #19 (Haste) still
  decides Ti4's assumption for Si's talent 2.

## Re-analysis (pass 3, 2026-10-18)

Batch 1, phase 4, against the code at caf1a2b (`events.ts`, `model.ts`,
`expr.ts`, `timeline.ts`, `buffs.ts`, `packages/data/src/kits.ts`, both
kit schemas) and the data (CharGrowthTable, SkillPatchTable through
`loadGameData`, I18nTextTable_EN). The plan below was written as kit files
into a scratch copy of the repository and loaded with `loadGameData`; it
loads only after the two fixes in R10 and R11. Three things were then
simulated. First, the Si example with its conditions removed. Second, the
same rotation with Initial Stroke and a late Final Stroke. Third, a solo
Si battle skill.

### (a) Pass-2 gaps now

| Pass 2 | Now | Fields, semantics |
|---|---|---|
| R1 damage record and Fixed-DMG burst (N2) | **supported in the engine**; the hit doesn't load (R10) | Enemy buff `records: {rate}` (loader: enemy buffs only; rate resolved at application). `addHits` adds `rate × exact` of every landing that isn't Fixed DMG with `appliedAt ≤ frame < expiresAt`. That includes the applying hit when the buff is `beforeDamage`, reactions and ticks (`recordStatus`). `buffEnded` carries `recorded` from `endBuff` and from expiry. `{eventRecorded: true}` reads it. A `fixedDamage` hit's value is taken when its `hits` action runs: at the event, or after `delay`, since the pending action keeps the event. Scratch run: burst 148,454 = 0.2 × 742,271 (every hit from the battle-skill hit on), at Final Stroke + 12 + 13 frames. |
| R2 hit scale as a value | **supported in the engine** (`scaleValue`, times the product of `scale`); the hit doesn't load (R10) | `scale: []` plus `scaleValue`. Scratch run: final hit = 13.75 × slash = (3.5 + 2 × 1.0) × 1.15 / 0.46, i.e. n = 1 consumed + potential5. |
| R3 event counts in the log checker | supported (L2) | Hits whose JSON names `eventCount` are tried at counts 1–4 (`scaleValue` included). A Fixed DMG hit is reported as unquantified, so the burst is still checked by hand against `uncapped`. |
| R4 talent values by level | supported | `{talent: 0, key: "coolDown"}` (talent 0 = Proxy's Patronage: buff_…_talent2_1 / _2, −10 / −20) and `{talent: 1, key: "ratio_speed" \| "duration_speedup"}` (talent 1 = Unsoiled Brush: talent1_1 / _2), checked in the loaded `talentNodes`. They read 0 while the talent isn't learned, so the cooldown change does nothing and the Haste (0 s) is skipped. No `talentAtLeast` needed. |
| R5 the window count in cast triggers | supported (V9) | A combo's `cast` event carries `count`. The P2 buff moves to a cast trigger at frame 0 (entity frame 0). |
| R6 do the strokes count as battle skills | **still open**: list item "Si R6" | Interim: yes (`kinds: ["battle"]` sees them; Initial Stroke also uses up Link). In-game test 29. |
| R7 stackingType 11 across wielders | **still open**: B9 | Interim: layers per owner. With one wielder a reapply replaces it. Minor. |
| R8 control immunity | supported per scenario (A7) | `target.controlImmune: true` stops the freeze. No enemy table says who is immune, so the scenario says it. Test 37. |
| R9 compiler remainders | **still open**: D2 | Interim: the kit hand-writes them; no effect on the numbers. |

### (b) Kit plan: what changed

Unchanged from pass 2: basic attacks, attack5 (`sp: "atb"`, `poise`,
`poiseControlledOnly`), the four finisher landings with `factor`, the dive,
the battle skill's hit (`poise`, `applies`: slot-0 Heat / Cryo, then
`control` immobilization `static_duration` `freezes`), its
`available` / `teamEnergyFrame: 15`, both strokes' `available`, the
`combo_window` trigger, and the weapon and gear-set buffs. Drop every
`durationFrames` and the kit's `conditions`. Changes:

1. **Every trigger that reads plain keys names its `skill`.** Without it,
   plain keys are read from `<operator>.<trigger id>`, and the loader
   rejects that ("isn't one of … value sources"). This applies to
   `ultimate_effects` (ultimate_skill), `combo_p2` (combo_skill),
   `artful_intent_end` (normal_skill) and every equipment trigger.
2. **Buffs** (`artful_intent`, `inksoul`, `ultimate_amp` as pass 2):
   ```json
   {"id":"combo_p2_atk","label":"P2 ATK","target":"self","gameBuff":"buff_chr_0036_jsspsi_combo_potential2","duration":"potential2_duration","modifiers":[{"zone":"atk","value":{"sum":["potential2_base",{"product":["potential2_enhance",{"sum":[{"eventCount":true},"potential5"]}]}]}}]},
   {"id":"talent_haste","label":"Unsoiled Brush: Haste","target":"team","gameBuff":"buff_chr_0036_jsspsi_talent1_speedup","duration":{"talent":1,"key":"duration_speedup"},"modifiers":[{"attr":92,"value":{"talent":1,"key":"ratio_speed"}}]}
   ```
3. **Triggers** (after `combo_window`):
   ```json
   {"id":"ultimate_effects","on":{"event":"cast","skills":["chr_0036_jsspsi_ultimate_skill"]},"by":"self","skill":"chr_0036_jsspsi_ultimate_skill","delay":62,"detached":true,
    "do":[{"kind":"buff","buff":"ultimate_amp"},{"kind":"cooldown","who":{"slot":0},"skills":"combo","seconds":{"talent":0,"key":"coolDown"}}]},
   {"id":"combo_p2","on":{"event":"cast","skills":["chr_0036_jsspsi_combo_skill"]},"by":"self","skill":"chr_0036_jsspsi_combo_skill","do":[{"kind":"buff","buff":"combo_p2_atk"}]},
   {"id":"initial_stroke","on":{"event":"cast","skills":["chr_0036_jsspsi_normal_skill_1"]},"by":"self","delay":8,"do":[{"kind":"buff","buff":"inksoul"}]},
   {"id":"final_stroke","on":{"event":"cast","skills":["chr_0036_jsspsi_normal_skill_2"]},"by":"self","delay":12,"do":[{"kind":"endBuff","buff":"artful_intent"}]},
   {"id":"artful_intent_end","on":{"event":"buffEnded","buff":"artful_intent"},"by":"self","skill":"chr_0036_jsspsi_normal_skill","do":[
     {"kind":"hits","if":{"buffActive":"inksoul"},"hits":[{"id":"burst_inksoul","scale":[],"damageType":"battle","fixedDamage":{"eventRecorded":true},"frames":[13],"poise":"ink_boom_poise","events":["chr_0036_jsspsi_normal_skill_inkmove_2"]}]},
     {"kind":"hits","if":{"not":{"buffActive":"inksoul"}},"hits":[{"id":"burst_mark","scale":[],"damageType":"battle","fixedDamage":{"eventRecorded":true},"frames":[14],"poise":"ink_boom_poise","events":["chr_0036_jsspsi_normal_skill_inkmark_projhit","chr_0036_jsspsi_normal_skill_inboom_projhit"]}]},
     {"kind":"endBuff","buff":"inksoul"}]},
   {"id":"inksoul_haste","on":{"event":"buffEnded","buff":"inksoul"},"by":"self","do":[{"kind":"buff","buff":"talent_haste"}]}
   ```
   - The burst path follows the data and the description ("When Artful
     Intent expires and no Inksouls are present, it bursts"; otherwise the
     Inksoul returns: `inkmove_2`, 13 frames *(pass-2 claim)*; the mark
     projectile lands after 14 frames *(claim)*).
   - The two `hits` actions use action-level `if`. It is judged when the
     action runs, at the `buffEnded` event and before the third action ends
     the Inksoul. Pass 2's separate `burst` / `artful_intent_end` triggers
     and the burst's trigger `delay` are merged into this one trigger.
   - `detached` on a trigger is only allowed on delayed cast triggers
     (loader). The burst hits need none: triggered hits have no cast to be
     cut short with.
   - `detached` on `ultimate_effects` matches the ability entity. It makes
     no difference today: the ultimate's earliest cancel is frame 64.
   - Final Stroke cut short before frame 12 drops the `endBuff` (scratch
     run). Artful Intent then runs to expiry and bursts through the
     Inksoul. That is the data's behaviour (CreateBuff `xianjing_inkboom`
     at frame 12 of the skill).
4. **Skills:**
   - `chr_0036_jsspsi_normal_skill_2` (Final Stroke) is a kit skill as
     planned, but the loader rejects it (R11).
   - Combo `final`: `{"id":"final","scale":[],"scaleValue":{"sum":["atk_scale2",{"product":[{"sum":[{"eventCount":true},"potential5"]},"atk_scale2_1"]}]},"frames":[49],"poise":"poise","events":["chr_0036_jsspsi_combo_skill_abilityrange"]}`
     replaces the three-entry split; it needs R10.
   - No `buffs` on `slash_first` (P2 is now the trigger).
   - Ultimate: one `slash` entry (count 8, frames 63–88) and `final`, both
     with `events` `[…_ultimate_skill_abilityrange, …_ultimate_skill_abilityrange_1]`.
     The amp leaves the first slash.
   - **The combo and ultimate hits must list their entity `events`.** The
     loader then makes them `detached` by default. The combo's window
     allows the battle skill and Initial Stroke from frame 20 (SkillData
     windows 20–81), and the ultimate's allows them from 64. The current
     kit has `events: []` there, so a cancel would drop the remaining
     slashes.
5. **Weapon kit `equipment/wpn_claym_0018.json`**: pass 2's buffs and
   triggers. Both triggers take `"skill":"sk_wpn_claym_0018"`. Drop both
   legacy `conditions`. `si-laevatain.scenario.json` must then drop its
   two `wpn_claym_0018.*` conditions, or it fails.
6. **Gear-set kit `equipment/suit_atk02.json`** (new file): pass 2's
   `suit_atk02.edge` buff and trigger, with `"skill":"passive_equipsuit_atk_02"`
   (the gear set's only value source).

With R10 and R11 patched in the scratch copy, all three files load.
Without the patches the loader rejects the plan:
- schema: `…/hits/0/scale must NOT have fewer than 1 items`, for both
  bursts and the combo's final hit;
- loader: `chr_0036_jsspsi_normal_skill_2: not one of chr_0036_jsspsi's
  skills`, for the skill and for the `final_stroke` cast filter.

### (c) New gaps

#### R10. A hit's `scale` can't be empty, family: data compilation (kit format)
- **Feature:** `schemas/kit.schema.json` `$defs.hit.scale` allows `[]`
  (drop `minItems: 1`). The loader keeps its own rules: empty with
  `fixedDamage` (it already throws otherwise), and preferably non-empty
  unless `scaleValue` or `fixedDamage` is set.
- **Evidence:** the schema has `minItems: 1`, while `normalizeHits` throws
  unless a `fixedDamage` hit has `scale` empty. The schema's own
  `fixedDamage` description says "scale is []". So no Fixed DMG hit can
  load. tests/timeline.test.ts builds its recording test in TypeScript and
  never meets the schema.
- **Impact:** blocking. Si's burst (32–50% of her damage) and the one-hit
  combo final can't be written. The only schema-legal workaround for the
  final hit would be a dummy key equal to 1.

#### R11. Final Stroke isn't in any skill group, family: data compilation
- **Feature:** the data layer gives a skill outside CharGrowthTable's
  `skillGroupMap` the group of the grouped skill whose ChangeSkillAction
  reaches it. Here BD `normal_skill_check` switches `normal_skill_1` →
  `normal_skill_2`, so it gets the battle group: the build's battle level,
  and `isSkill` for cast filters.
- **Evidence:** CharGrowthTable `chr_0036_jsspsi.skillGroupMap` lists
  `normal_skill` and `normal_skill_1` but not `normal_skill_2`.
  SkillPatchTable has `normal_skill_2` at every level (cost 0).
  `loadOperatorKit` rejects kit skills and cast filters outside
  `op.skillGroups`. Other levelled skills outside every group (each kit's
  owner to check): `chr_0028_wulfa_combo_1_skill`,
  `chr_0038_purrche_normal_skill_block_1`, `chr_0015_lifeng_attack4`,
  `chr_0034_typhoea_ultimate_skill`, `chr_0017_yvonne_passive_0`, and every
  `*_dash_attack`.
- **Impact:** blocking. Without Final Stroke nothing can end Artful Intent
  early and the Inksoul never disappears early. Search can't time the
  burst, and the Haste never follows a Final Stroke.

#### R12. Enemy buffs applied with a freezing control status miss the freeze, family: physical state (control)
- **Feature:** an enemy-target buff applied while the enemy is frozen
  (`enemyFrozenUntil > frame`) should start its timer when the freeze ends
  (`expiresAt += enemyFrozenUntil − frame`). Today the freeze is applied
  only to what is already on the enemy, when `runTriggers` takes the
  `control` event, so the result depends on order.
- **Evidence:** when any kit in the team has a trigger with `beforeDamage`,
  `landHit` runs the hit's status events (the freeze included) before
  `applyBuffs(true)` adds Artful Intent, so Artful Intent isn't extended.
  Otherwise the freeze comes in the final `runTriggers` and Artful Intent
  is extended. Scratch run, solo battle skill at P5: the expiry burst
  lands at 22.47 s; with a no-op `beforeDamage` trigger added to the kit
  it lands at 20.97 s. Gilberta's Pursuit (T5) will be such a trigger. Jade
  Vessel's `enemy_vul` is added by a trigger on that same `control` event,
  after the freeze, so it always lasts 30 s flat (attack hits at 30.1 s
  have it, at 30.5 s don't). In-game test 37, however, states the engine's
  expectation as 31–31.5 s. Correction 3 (bdf223db8e49: about 21.7 s)
  supports freezing Artful Intent.
- **Impact:** in teams with a `beforeDamage` trigger, Artful Intent ends
  1–1.5 s early and records that much less team damage (about 7% of the
  burst over a 21.5 s window). Jade Vessel's debuff is 1–1.5 s short if
  test 37 confirms the freeze. Small but systematic; the fix is a few
  lines.

#### R13. Delayed cast-trigger actions don't follow Haste, family: timing (Ti4)
- **Feature:** a cast trigger's `delay` should be scaled by the cast's
  action speed, as its hits and `teamEnergyFrame` are
  (`round(delay / speed)`, the speed taken at the cast).
- **Evidence:** `castSkill` scales hit frames by `actionSpeed` (attribute
  92), while `runTriggers` queues `e.frame + t.delay` unscaled. Scratch
  run: Si's ultimate 0.93 s after Final Stroke, with her own 30% Haste up:
  the slashes start at frame 48, the amp still comes at 62, and 5 of 8
  slashes miss it (2,963 instead of 4,243). The ultimate deals about 12%
  less.
- **Impact:** every kit whose skill effects are delayed cast triggers
  (Si's amp, talent cooldown, Inksoul and Final Stroke; Laevatain's,
  Typhoeus's and Liino's follow-ups) runs out of step under Haste. In
  batch 1 only Si's talent gives Haste (shared with Tangtang). It rests on
  the Haste assumption of test 19.

### (d) In-game tests the kit still depends on

- **10:** the combo count, highest or latest; P5 +1.
- **19:** what Haste speeds up (talent 2; also R13).
- **29:** do the strokes count as battle skills, for Yinglung stacks and
  Link (R6).
- **37:** Artful Intent and Jade Vessel's debuff under Immobilization, and
  on control-immune enemies (R8, R12). Its stated engine expectation for
  Jade Vessel (31–31.5 s) should read 30 s until R12 is fixed.
- **41:** Jade Vessel's combo bonus after the ultimate.
- **18:** whether time stops freeze the enemy's timers. Artful Intent runs
  on the enemy's clock, so this sets its length under teammates'
  ultimates.
- **14:** optional confirmation of the slot-0 element.

## Kit (2026-10-18)

Batch 1, phase 5. Written from the pass-3 plan, with the pass-3 engine
features (empty `scale`, Final Stroke's battle group, cast-speed delays,
freezes after the damage).

### What was written

- `packages/data/kits/operators/chr_0036_jsspsi.json`, the full kit:
  - buffs `artful_intent` (enemy, records `ink_damage_rate`), `inksoul`
    (no duration), `ultimate_amp`, `combo_p2_atk` (P2, n = eventCount +
    potential5) and `talent_haste` (talent 1 values; 0 s while not
    learned);
  - triggers `combo_window`, `ultimate_effects` (amp and the slot-0 combo
    cooldown by talent 0's coolDown, at frame 62, detached), `combo_p2`,
    `initial_stroke` (+8), `final_stroke` (+12), `artful_intent_end` (the
    two Fixed DMG bursts by Inksoul presence, then the Inksoul ends) and
    `inksoul_haste`;
  - skills: the basic attacks (attack5 with `sp`, `poise`,
    `poiseControlledOnly`), the four finisher landings with `factor`, the
    dive with `sp`, the battle skill (`available`, `teamEnergyFrame: 15`,
    `poise`, Artful Intent before the damage, slot-0 Heat / Cryo, then
    Immobilization), Initial and Final Stroke (hitless, `available`), the
    combo (one `final` hit with `scaleValue`) and the ultimate (one
    `slash` entry ×8 and `final`, both entity keys). Every
    `durationFrames` and the legacy `conditions` are gone.
- `packages/data/kits/equipment/wpn_claym_0018.json`: buffs
  `wpn_claym_0018.enemy_vul` and `.combo_ready` (`consumedBy` combo),
  triggers on Immobilization (`control`) and on the wielder's ultimate.
  The two legacy conditions are gone.
- `packages/data/kits/equipment/suit_atk02.json` (new): `suit_atk02.edge`
  (layered, `max_stack`, `consumedBy` combo), on anyone's battle-skill
  cast.
- `examples/si-laevatain.scenario.json`: its two `wpn_claym_0018.*`
  conditions are dropped.
- Tooling, so the logs can check the kit:
  - `zmdlogs check` (packages/cli/src/logcheck.ts) also tries the hitter's
    kit buffs that a cast consumes (`consumedBy` its kind, 0 to max
    layers), which ZMDLogs never logs, and counts a boundary buff listed
    twice with the same effects once (an instance ending as its refresh
    starts);
  - `efsim calc` / `compare` show hits that read `eventCount` at a count of
    1 (they threw before), with a note;
  - `simulate` names control statuses in its arts table.
- Tests: the KNOWN list in packages/data/test/skillCompile.test.ts (Si's
  five lines replaced by six, below), its helper now matches a
  `scaleValue`-only hit by its first key; two cli tests (refreshed
  boundary instances; calc with Si's count-dependent hit).
- docs/kit-unique.md (where Artful Intent lives) and in-game test 37 (the
  engine's expectation for Jade Vessel's debuff is a flat 30 s).

KNOWN changes, each with its reason:
- `power_attack/hit1–4 factor: kit 0.07 / 0.1 / 0.13 / 0.7, data 1`: the
  compiler doesn't read BreakingAttackCalculation's `multiplier` (D2). The
  old line (landings at 3, 12, 21 without a kit hit) is gone.
- `normal_skill teamEnergyFrame: kit 15, data 0`: both infliction branches
  create the energy buff at 15; the compiler doesn't merge exhaustive
  branches (D2).
- `combo_skill/final scale: kit {sum…}, data (…)`: the same expression
  with `EntityBB_combo_count` = eventCount (+ potential5); the test
  compares key products only. The three old `final_*` lines are gone.
- The old `normal_skill applies at 15` line is gone: the kit now has both
  branches.

### Deviations from the plan

- None in the kit's mechanics. The plan's triggers that read no plain
  keys (`initial_stroke`, `final_stroke`, `inksoul_haste`) have no
  `skill`; equipment trigger IDs carry the `<equipment>.` prefix.
- The log checker changes above weren't in the plan. Without them the
  combo hits (now mapped, as the plan asks, so they are detached) are 22
  mismatches across two fixtures, and one ultimate slash in
  zmdlogs-b7b3762d5da8 is another.
- `si-laevatain.scenario.json` keeps its rotation (no strokes), so its
  Artful Intent doesn't end inside the 20 s and there's no burst in it.

### Verification

`npm run check` passes (typecheck, lint, 380 + 8 tests).

Log coverage, `zmdlogs check` (Si only; the other operators' lines are
unchanged):

| Fixture | Before: match / mismatch / unmodelled / uncovered (covered) | After |
|---|---|---|
| zmdlogs-0eef2474a26f | 5 / 0 / 3 / 12 (3%) | 5 / 0 / 15 / 0 (100%) |
| zmdlogs-40d9a3c1da37 | 3 / 0 / 0 / 21 (1%) | 23 / 0 / 1 / 0 (100%) |
| zmdlogs-b7b3762d5da8 | 1 / 0 / 0 / 20 (1%) | 21 / 0 / 0 / 0 (100%) |
| zmdlogs-bdf223db8e49 | 3 / 0 / 12 / 12 (8%) | 3 / 0 / 24 / 0 (100%) |

- 40d9a3c1da37: the 10 combo slashes match with Jade Vessel's bonus
  (level 8) and 2 Yinglung stacks, the final hit with event count 3 (+1
  at P5) and a crit; all 9 ultimate hits match.
- b7b3762d5da8 (P1): the slashes match with Jade Vessel (level 4) and 3
  stacks, the final hit with event count 4. The slash at t=5688 now
  matches with its refreshed boundary buffs counted once.
- The rest is "unmodelled": hits under Corrosion that match no level
  (0eef2474a26f, bdf223db8e49; G7's time dilation, test 4) and the bursts
  (Fixed DMG isn't judged from one logged hit). The bursts' rule was
  checked by hand in pass 2 (uncapped 301679 / 432652 / 530319).
- fixtures/pending/zmdlogs-e82d45c46040: Si's hits are now mapped and are
  all ×1.139 off, the factor already listed for that fixture (something
  unlogged), so it stays pending.

Example, `simulate examples/si-laevatain.scenario.json`: 683,239 →
793,930 (Si 283,466 → 313,809; Laevatain 399,773 → 480,120). Why:
- the rotation runs 1.2 s earlier, since the ultimate's lock now comes
  from the data (64 frames) instead of `durationFrames` 214;
- Jade Vessel's DMG taken is an enemy debuff from the battle-skill hit
  on, so Laevatain's hits get +0.18 too. Si's first five ultimate slashes
  and her battle-skill hit lose it (4,243 → 3,596; 8,839 → 7,491);
- the combo slashes gain a Yinglung stack and P2's ATK (9,330 → 10,801);
  the final hit is unchanged in multiplier (6.325).

Spot check (Si P5 with Laevatain; each mechanic seen at least once):
- the battle skill inflicts Cryo with Si in slot 0, Immobilization 1.5 s,
  Artful Intent from its own hit;
- Combustion on the Cryo opens the combo window, and the final hit is
  6.325 × at one consumed stack;
- Initial Stroke costs 15 SP; Final Stroke ends Artful Intent at +12, the
  Inksoul burst lands 13 frames later, then the Haste (30%) shortens the
  next ultimate's frames (first slash at 48 instead of 63; the amp still
  covers all 8);
- the ultimate's talent cut lets the combo come back 6.8 s after the
  first (cooldown 13 s); with both talents at 0 that combo can't be cast;
- Artful Intent left to expire bursts through the mark 14 frames after
  21.5 s, = 0.2 × every hit in it (75,790);
- Jade Vessel's debuff lasts 30 s flat after the battle-skill hit.

Engine problems found (packages/engine/src; not changed here):
1. **A `consumedBy` buff acts before it is consumed.** `buffModifiers`
   (buffs.ts) applies a buff with `consumedBy` and `cast === undefined`
   to every hit it reaches. In the game the waiting buff
   (normal_skill_trigger, addcombodamage) has no damage modifier; only
   the consumed form does, and only on its cast (CheckSkillCastId). So a
   battle skill cast during Si's combo adds its Yinglung stack to the
   combo's remaining hits (spot check: final hit 101,180 → 112,779).
   Fix: skip such buffs in `buffModifiers` (and `buffAttr`), and let
   `kitBuffModifiers` (triggers.ts) build them as consumed, so `calc
   --buff` and the log checker still see them.
2. **Status ticks and buff expiries run ahead of delayed trigger
   actions.** In `advance` (timeline.ts) the tick and expiry branches
   compare only with the next buff tick and hit, not with the next
   pending action (`due`) or energy grant. A Combustion tick after Final
   Stroke's frame 12 is processed before the `endBuff`, so Artful Intent
   records it (spot check: 5 ticks after the end, burst 15,660 instead of
   13,608). Fix: compute `due` first and add `due.frame` (and the grant's)
   to the `later` lists of both branches (ticks still first at equal
   frames). Every delayed cast trigger has the same problem (Si's amp,
   Laevatain's, Typhoeus's and Liino's follow-ups).
3. Optional, depends on in-game test 37: enemy buffs applied while the
   enemy is frozen aren't stretched by the freeze (Jade Vessel's debuff,
   added by the `control` trigger, lasts a flat 30 s; Artful Intent,
   added before the damage, gets 21.5 s). If the icon lasts 31–31.5 s,
   start such buffs' timers when the freeze ends.
4. Minor: `computeKit` and `kitBuffModifiers` throw on `eventCount`
   without a count. The CLI passes 1 to `computeKit` now; `calc --buff
   combo_p2_atk` still fails.

### Still unverified

- **Test 10:** the highest or latest count when several consumptions
  open the window (the logs fit the highest: 3 + 1 in 40d9a3c1da37, 4 at
  P1 in b7b3762d5da8).
- **Test 19:** what Haste speeds up (the engine speeds up hits, windows
  and delayed actions).
- **Test 29:** whether the strokes count as battle skills (they do here:
  up to 2 extra Yinglung stacks per Si cycle, and Link spent on Initial
  Stroke).
- **Test 37:** Artful Intent and Jade Vessel's debuff under Immobilization,
  and on control-immune enemies (`target.controlImmune`).
- **Test 41:** Jade Vessel's combo bonus after the ultimate alone.
- **Test 18:** whether time stops freeze Artful Intent's clock.
- **Test 14:** optional, the slot-0 element.
- *(claims)* the burst lands 13 frames after the end through the Inksoul
  (20 at distance 2, not modelled) and 14 through the mark; the P2 buff
  and the talent cut are at their data frames, neither logged.
