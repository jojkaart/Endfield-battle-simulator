# Liino (chr_0035_liino): gap report, batch 1

Phase 1 (analysis only). Loadout: weapon wpn_lance_0014 (Bedazzling Night Debut), gear set suit_heal01 (LYNX).
Sources: rmxlinux `Json/SkillData`, `Json/BuffData`, `TableCfg` (CharGrowthTable, SkillPatchTable, CharacterPotentialTable,
PotentialTalentEffectTable, WeaponBasicTable, EquipSuitTable, I18nTextTable_EN); fixtures `zmdlogs-*.json`; the current kit
`packages/data/kits/operators/chr_0035_liino.json` (its claims re-checked; corrections marked **claim corrected**).
Scratch scripts: `/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch1/scratch-chr_0035_liino/`.

"No-op" below means the mechanic only changes healing or damage taken by the team, which the simulator doesn't model;
nothing has to be expressed, so it's counted as `supported`.

Enum readings used (inferred, not yet in the enum map): `buffEvent` 5 = on add, 2 = on finish, 3 = on add (child buffs),
1 = interval tick (`buff_chr_0035_liino_ultskill_music_damage` fires its beats on event 1 every `triggerInterval`);
BuffData `lifeType` 1 = lives until removed, ignoring `duration` (evidence: `buff_chr_0035_liino_normalskill_spelllnfliction_extraattack`
has `duration` 10 s and lifeType 1, and still fires 12 s after creation in zmdlogs-bdf223db8e49 at t=14699).

## SkillData / BuffData action types

Gameplay `$type`s only (presentation, rotation, root motion, VFX, voice, show/hide removed). D = damage, R = resources (SP/energy),
S = state (buffs, stance, skill swaps), T = timing / action legality.

| File | Types | Affect |
|---|---|---|
| SkillData normal_skill | LaunchProjectile×6 (→ projhit_start → projhit / projhit_02), CreateBuffAction×17 (music_tag, music_damage, extraattack, ui), AuraAction (spelllnfliction_check on enemies), EventListenerAction×3 (abilityEvent 9: End Stance → SetSkillCdAtOnce set_cd 5 s, JumpTo 1967; abilityEvent 150: interrupted → JumpTo 1967), FinishBuffAdvanced×6, InheritBuffAction×3, ObtainCostAction (costType 1 `potential_atb_return`, P1), `buff_common_obtain_ultimate_sp` at frame 15, ChannelingCastingAction (0–90, cantCastSkill, cantSwitchPosition), AllowNextSkillAction×4 (50–1872: combo, normal_skill_end; 1817+: normal_skill, power_attack), TickIntervalAction, SimpleCalcBBAction, StoreCurSkillExecuteFrame, CheckSquadInFight, CheckBuffStackNumAdvanced, CheckEntityNum, JumpToAction | D, R, S, T |
| SkillData normal_skill_projhit / _projhit_02 | DamageAction (`atk_scale`, mask 4352), ForEachAction, InterruptAction | D |
| SkillData normal_skill_projhit_start (+_vfx…04) | LaunchProjectile×2, SmartTargetFinder | D (travel), T |
| SkillData normal_skill_projhit_hit | DamageAction (`atk_scale_2`) | D |
| SkillData normal_skill_soundwave_projhit | HealAction, StoreAttributeValue, CreateBuffAction (no DamageAction) | heal only |
| SkillData normal_skill_projhit_health | CreateBuffAction (team finder) | heal only |
| SkillData normal_skill_combo | InheritBuffAction×9, EventListenerAction×3 (same End Stance / interrupt handling), SetSkillCdAtOnce, AllowNextSkillAction×2, TickIntervalAction (no DamageAction) | S, T |
| SkillData normal_skill_end | CheckSkillType (no DamageAction, no buffs: End Stance is detected by the stance's listeners) | S, T |
| SkillData combo_skill | DamageAction×2 (`atk_scale` 9, `atk_scale_2` 33, mask 12288), ObtainCostAction (costType 0 `usp`, 33), HealAction (33), CreateGlobalBuffAction (`global_buff_liino_combo_atb_return`, talent 2), FinishBuffAdvanced (ends volley animations hitl/hitr at 0), TriggerCustomAbilityEvent `liino_comboskill_end` (67 → music_tag casts normal_skill_combo), TimeDilationAction×2 (0–7 on own entities; 0–25 = 0.9333 s on everything except Liino), InheritBuffAction×9, `switchToBuffConfig` (during Cosmovoice: runs as buff_chr_0035_liino_comboskill_ultskill_hit), AllowNextSkillAction (68–109) | D, R, S, T |
| SkillData ultimate_skill | SpawnAbilityEntity (76), CreateBuffAction×17 (refrainobtainusp 77–527, ultskill_music_tag, ultskill_music_damage 77–477, heal_start 80, heal 513), StoreAttributeValue + CompareFloat + ModifyDynamicBlackboard (`fnlatk_up` = min(will_up × Will, will_max)), SimpleCalcBBAction×3 (`atk_scale_4` = `atk_scale_3` × `final_value` at 508), LaunchProjectile (finale 508), ChangeSkillAction (77–527, battle skill → End Stance), EventListenerAction (End Stance → JumpTo 540, skipping the finale), UltimateTimeAction (0–77), TimeDilationAction (0–30), ChannelingCastingAction×3 (0–77, 77–137, 508–527), AllowNextSkillAction×3 (77–527 End Stance; 163–527 combo; 527–580 normal_skill/combo/attack1), no InheritBuffAction | D, R, S, T |
| SkillData ultimate_skill_projhit_abilityentity | LaunchProjectile×42 (two per frame 0/3/6/8/11/15/18/21/25/28; bomb 40) | D, T |
| SkillData ultimate_skill_projhit / _l / _r | DamageAction (`atk_scale`), AtkScaleCalculation | D |
| SkillData ultimate_skill_projhit_damage_02 | ForceSpellStatusAction (Electrification, count 1), DamageAction (`atk_scale_2`) | D, S |
| SkillData ultimate_skill_soundwave_projhit | DamageAction (`atk_scale_3`), HealAction | D |
| SkillData ultimate_skill_soundwave_02_projhit | DamageAction (`atk_scale_4`) | D |
| SkillData attack1–5, attack3/4_projhit, power_attack, plunging_* | DamageAction (attack1 ×2, attack2 in ChannelingAction, attack3 1 + projectiles, attack4 projectiles only, attack5 mask 2097280 = Final Strike, ObtainCostAction `atb` 20), BreakingAttackCalculation + GainBreakingAttackAtb (power_attack = finisher) | D, R |
| BuffData normalskill_music_tag | AuraAction (team: normalskill_buff_atkup → atkup; self atkup_owner), talent-1 AuraAction (talent_shelter, radius 5.5), CheckCustomAbilityEvent + CastSkill (normal_skill_combo after a combo), on finish: CreateBuff normalskill_end | S |
| BuffData atkup / atkup_owner / atkup_finishtime | attributeModifier ATK (attr 2, formulaItem 6) `atk_up`; stackingType 1, stackingKey `liino_atk_up` | D |
| BuffData normalskill_spelllnfliction_check (on enemies) | abilityEvent 9 + CheckBuffIdInContext (buff_common_{cryst,fire,pulse,natural}_triggered, tag 1474064594), CreateTimedMarker, CreateBuff spelllnfliction_hit (2 s, on Liino); maxTriggerCnt 1, lifeType 1 | S (volley trigger) |
| BuffData normalskill_spelllnfliction_extraattack | buffEvent 1, `triggerInterval` = `atk_trigger` 10 s, CheckBuffIdInContext spelllnfliction_hit, CheckDistance 20 m, TimedMarker 0.6 s, CreateBuff music_animation_hitl / hitr (alternating) | D (volley), T |
| BuffData normalskill_music_animation_hitl / hitr | LaunchProjectile (projhit_hit, frames 24, 32, …) | D, T |
| BuffData normalskill_music_damage | buffEvent 1 every `music_trigger` 3 s: LaunchProjectile soundwave (heal only) | heal only |
| BuffData ultskill_music_tag | AuraAction (team: normalskill_buff_atkup + ultskill_buff_atkup), self atkup_owner + ultskill_buff_atkup, talent-1 aura (radius 6); applyTags −499637408 (the tag the combo's switchToBuffConfig checks) | D, S |
| BuffData ultskill_buff_atkup → spellenhance / spellenhance_finishtime | EnhancedAction subType 6 and 3 (logged as buff_common_affixes_enhance_pulse / _natural), rate `spellenhance_rate`; finishtime duration = `finish_duration` (0) | D |
| BuffData ultskill_music_damage | buffEvent 1 every `ultmusic_trigger` 1.5 s: LaunchProjectile soundwave (damage + heal) | D |
| BuffData ultskill_refrainobtainusp | RefrainObtainUsp, lifeType 1, `duration` 1 s | R |
| BuffData comboskill_ultskill_hit | DamageAction×2 (9, 33), ObtainCostAction, HealAction, CreateGlobalBuffAction (talent 2), TimeDilationAction×2, CreateBuff ultskill_combo_end | D, R, T |
| BuffData combo_atb_return (global) | abilityEvent 143, CheckSkillType [2], SaveCharTypeId + CompareString (Pulse / Natural), ObtainCostAction costType 1 `atb_return`, FinishGlobalBuffAction (ends after triggering) | R |
| BuffData potential / potential_enterfight | abilityEvent 6 (without the stance tag) → enterfight (lifeType 1); abilityEvent 150 → finish | R |
| BuffData talent_shelter (+ _normalskill / _ultskill / _finishtime) | DamageScaleProcessor defender side (ProdCalcZone, `shelter`), attr 30 (treatment received) | no-op |
| BuffData skill_end, normalskill_end, _end_active, _endtag(_finish), ultskill_end, ultskill_combo_end | marker buffs, CheckSkillType | S |
| Unused in normal play | ultskill_spellvulnerable (VulnerableAction, referenced by nothing), normalskill_combocd (attr 93, referenced by nothing), chrdung_* (character-dungeon variant: TriggerComboSkillAction, extra usp) | — |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Battle skill: 6 projectiles × `atk_scale` (SkillData normal_skill LaunchProjectile ×2 at frames 12/14/16 → projhit_start → projhit(_02); display_atk_scale 2.4 = 6 × 0.4) | supported | `hits` projectiles, count 6. Verified 6/6 in bdf223db8e49 and 0eef2474a26f (re-run: Liino 12 match, 0 mismatch in each). |
| 2 | Hit frames, counts, event keys of every skill (SkillData DamageAction frames + projectile/entity spawn frames) | data | Hand-written in the kit (108 kit-wide); kit-draft v1 emits no frames (checked: `efsim kit-draft chr_0035_liino`). |
| 3 | Vocalist Stance: team ATK +`atk_up` (0.06–0.10 by level, P1 +0.06) for `music_duration` 60 s (music_tag aura → buff_chr_0035_liino_atkup / _atkup_owner) | supported | `buffs` vocalist_stance (team, atk). Logged on every teammate hit in bdf223 / 0eef. |
| 4 | Vocalist Stance ends when the ultimate is cast (normal_skill EventListener abilityEvent 150 → JumpTo 1967 ends the action; its buffs are `autoFinishByAction`; the ultimate has no InheritBuffAction, unlike the combo; description: "This stance replaces Liino's Vocalist Stance") | gap | G1. Kit note already says so. |
| 5 | Stance volley: Additional ATK 6 × `atk_scale_2` (display_atk_scale_2 1.2) when an arts infliction lands on an enemy near her, at most every `atk_trigger` 10 s, while the stance lasts (spelllnfliction_check → _hit → extraattack → music_animation_hitl/hitr → projhit_hit) | gap | G4. Kit lands one volley per cast at frame 45. Cadence: U1. |
| 6 | Stance soundwave every `music_trigger` 3 s (normal_skill_soundwave_projhit: HealAction only, no DamageAction) | supported | Nothing to deal (claim re-checked: no DamageAction). Its heals feed G5. |
| 7 | During Vocalist Stance the battle skill is End Stance (description; AllowNextSkillAction lists normal_skill_end) | supported | `unavailableWhile: vocalist_stance` on the battle skill. |
| 8 | End Stance: hitless, no SP, ends Vocalist (no more volleys) or Cosmovoice (JumpTo 540: no finale); after Vocalist the battle skill gets `set_cd` 5 s (SetSkillCdAtOnce) | gap | G2. |
| 9 | Battle skill SP cost 25, team energy 0.065 per natural SP (buff_common_obtain_ultimate_sp at frame 15) | supported | Engine at the cast frame (15 frames earlier than the data; negligible). |
| 10 | Actions allowed during the stance and the ultimate: only combo / End Stance (normal_skill AllowNextSkillAction 50–1872; ultimate 77–527 End Stance, 163–527 combo); ChannelingCastingAction cantCastSkill + cantSwitchPosition (battle 0–90, ultimate 0–77, 77–137, 508–527) | gap | G8. Engine frees her at the first AllowNextSkillAction frame (50 / 77) for anything. U4. |
| 11 | After a combo, the stance resumes (TriggerCustomAbilityEvent liino_comboskill_end → CastSkill normal_skill_combo, InheritBuffAction, no damage; description: combo "does not interrupt Vocalist Stance") | supported | Kit buffs simply persist; normal_skill_combo needs no kit entry. |
| 12 | Combo trigger: an Arts Reaction applied while Vocalist Stance is active (CharGrowthTable "COMBO TRIGGER") | supported | `comboTriggers` `on: reaction` (forced ones included) + `if: buffActive vocalist_stance`. |
| 13 | Combo trigger: an Arts Reaction consumed while Vocalist Stance is active (same text) | gap | G7. |
| 14 | Combo trigger while Cosmovoice Stance is active (text names only Vocalist; but the ultimate allows the combo 163–527 and the combo has a Cosmovoice variant) | unknown | U2. |
| 15 | Combo hits `atk_scale` @9, `atk_scale_2` @33, energy `usp` 20 @33 (ObtainCostAction costType 0) | supported | `hits` hit1 / hit2, `energy: usp`. Logged only under Corrosion / unmodelled effects. |
| 16 | Combo during Cosmovoice runs as buff_chr_0035_liino_comboskill_ultskill_hit (combo_skill `switchToBuffConfig`, tag −499637408 of ultskill_music_tag): same keys, frames 9/33, ObtainCostAction, heal | supported | Same kit hits. Its log event key (probably the buff file) isn't in `events`: add when a log shows it. |
| 17 | Combo time dilation: everything but Liino slowed 0.9333 s (TimeDilationAction 0–25, curve ComboSkill) | gap | G10 (shared: time dilation). |
| 18 | Combo cancels an in-flight volley (combo_skill frame 0 FinishBuffAdvanced music_animation_hitl / hitr) | gap | Part of G4 (buff lifecycle: a skill ends a buff). |
| 19 | Combo cooldown 8 s, P3 −1 s (skillParamModifier paramType 2) | supported | Engine (stats skillParams). |
| 20 | Ultimate: 20 pyrotechnics × `atk_scale`, bomb `atk_scale_2` with forced Electrification (ForceSpellStatusAction count 1), beats `atk_scale_3` every `ultmusic_trigger` 1.5 s from frame 77 (first beat immediate: waitFirstTriggerInterval false), finale `atk_scale_3` × `final_value` (3) at 508 | supported | `hits` (scale list does the product), `applies forcedReaction electrification`. Verified 25/25 in dbaee23b801d. |
| 21 | Finale doesn't happen when Cosmovoice is ended early (description; End Stance → JumpTo 540) | supported | Holds until End Stance exists (G2); then the finale needs `if: not ended early`. |
| 22 | Cosmovoice: team Electric + Nature Amp = min(`will_up` × Will, `will_max`) for `ultmusic_duration` 15 s (StoreAttributeValue / CompareFloat at 77; EnhancedAction subType 6 and 3) | supported | `buffs` cosmovoice_stance, ValueExpr min/product/attr 42. Logged value 0.410537 = 0.0004 × 1026.34 (dbaee23). |
| 23 | Cosmovoice: team ATK Boost `atk_up` of the ultimate (0.1, P1 +0.06), stackingKey `liino_atk_up` shared with Vocalist (highest only) | supported | Expressible today: declare it with `gameBuff: buff_chr_0035_liino_atkup`, and give vocalist_stance the same gameBuff, so both share one stack group. **Claim corrected:** the kit leaves it out because "kits can't end or replace a buff"; the stack group already prevents double counting. Kit fix in phase 5; G9 is the data-side cleanup. |
| 24 | During Cosmovoice the battle skill is End Stance; casting it ends Cosmovoice early, no SP (description; ChangeSkillAction 77–527) | gap | G3 (availability) + G2 (End Stance). |
| 25 | Ultimate cost 160 (P4 × 0.85), cooldown 20 s | supported | Engine. |
| 26 | Energy block: buff_chr_0035_liino_ultskill_refrainobtainusp created over 77–527, `duration` 1 s, lifeType 1 | unknown | `energyBlockSeconds` 3.5667 (1 s from frame 77). If lifeType 1 ignores the duration, the block runs to frame 527 = 17.57 s. U3. |
| 27 | Ultimate cut-in (UltimateTimeAction 0–77, TimeDilationAction 0–30) and projectile travel (dbaee23: first pair t=8613, rest 9530–10101, bomb 10341; kit frames 76, 79–104, 116) | gap | G10 (timing). Damage per hit unaffected. |
| 28 | Nothing lingers after Cosmovoice (ultskill_buff_atkup on finish → spellenhance_finishtime with duration `finish_duration` = 0 at every level; atkup_finishtime likewise) | supported | No buff needed. Not yet seen in a log (no fixture reaches the stance's end). |
| 29 | Heals: battle-skill start (projhit_health), soundwave every 3 s (AOE), combo (controlled operator, frame 33), ultimate start (team, frame 80), beats (AOE, 1.5 s), finale (team, frame 513) | gap | No heal events in kits; needed by the weapon (G5). |
| 30 | Basic attack chain attack1–5 (2 / 1-channel / 1+projectiles / 10 projectiles / 1 hits; attack5 Final Strike mask 2097280, `atb` 20 SP), plunging attack | data | Kit leaves them out (no fixture logs any). Hits, counts and frames are in SkillData (attack4: 4 projectiles per launch frame 5/7/10/13/16 for 10 hits, which ones land unknown). |
| 31 | Finisher (power_attack `atk_scale` 9.0, BreakingAttackCalculation) | gap | G11 (shared: finisher formula). |
| 32 | Talent 1 Idol Zone: in either stance, operators in the AOE get DMG Taken −10% / −20% and Treatment Received +10% / +20%, 3 s after leaving | supported | No-op. |
| 33 | Talent 2 Starry Boost: 30 s after her combo, the next battle skill cast by an Electric or Nature operator returns 5 / 10 SP; doesn't stack, ends after triggering (global_buff_liino_combo_atb_return → buff_chr_0035_liino_combo_atb_return) | gap | G6. |
| 34 | P1: first battle skill after entering battle without the stance returns `potential_atb_return` 25 SP (normal_skill frame 0 ObtainCostAction costType 1, needs buff_chr_0035_liino_potential_enterfight) | gap | G6; window U5. |
| 35 | P1: both stances' ATK Boost +0.06 (skillBbModifier add on `atk_up` of normal_skill and ultimate_skill) | supported | Skill values after potentials. |
| 36 | P2: Will +20, Treatment Efficiency +10% | supported | Stat panel; the second is a no-op. |
| 37 | P3: combo multipliers × 1.4 (`atk_scale`, `atk_scale_2`), heal × 1.4, cooldown −1 | supported | Checked: `efsim calc` at P5 gives combo 1.890 / 3.150. |
| 38 | P4: ultimate energy cost × 0.85 | supported | skillParam cost. |
| 39 | P5: `will_up`, `will_max` × 1.2; battle `atk_scale(_2,_3)` and ultimate `atk_scale(_2,_3,_4)` × 1.2 | supported | Checked: calc gives 0.480 / 0.240 / 0.192 / 7.680 / 0.720. (`atk_scale_4` is overwritten at frame 508 by `atk_scale_3` × `final_value`, which the kit's scale product reproduces.) |
| 40 | Weapon skill 1: Will +156 (wpn_attr_will_high L9) | supported | Stat panel (calc --verbose lists it). |
| 41 | Weapon skill 2: Treatment Efficiency +46.4% | supported | No-op. |
| 42 | Weapon skill 3, permanent part: main attribute +44.8% (sk_wpn_lance_0014 cardAttributeModifier attr 29, modifyAttributeType 1 = main attribute) | supported | Stat panel (calc shows Will +0.45). |
| 43 | Weapon skill 3, triggered part: when the wielder's skill heals another team operator, that operator gets ATK +`atk_up` (9.8% at L9) for `duration` 20 s; max 4 stacks, each with its own duration; once per 0.1 s per receiver (sk_wpn_lance_0014 passiveEventActions abilityEvent 50, CheckHealTag, NotNext CheckTargetsEqual (receiver ≠ wielder), TimedMarker 0.1 s; buff_wpn_lance_0014_damageup stackingType 11, `max_stack`) | gap | G5. Logged: teammates carry 1–4 entries of buff_wpn_lance_0014_damageup (0.098 at L9 in bdf223 / 0eef; 0.056 at L4 in dbaee23 / d9e59); never on Liino. |
| 44 | LYNX 3-piece: wearer's Treatment Efficiency +20% (passive_equipsuit_healup_01 cardAttributeModifier attr 29) | supported | No-op. |
| 45 | LYNX 3-piece: after the wearer heals an ally, the ally gets 15% DMG Reduction for 10 s, 30% if the heal exceeds its Max HP; doesn't stack (buff_equipsuit_healup_01 abilityEvent 50 → buff_common_dmgtk_down_equip_1) | supported | No-op (defensive). It would use G5's heal event if damage taken were ever modelled. |

## Gaps

### G1. End a buff when a skill is cast (Vocalist Stance on the ultimate)
- **family:** buff lifecycle
- **feature:** `ends` on a kit skill: a list of the operator's own kit buffs removed at the skill's start frame (before its hits),
  together with what they carry (pending triggered hits of G4, beats). Here: the ultimate ends `vocalist_stance`; End Stance (G2)
  ends `vocalist_stance` or `cosmovoice_stance`. Removal ends the buff for every target (team aura).
- **evidence:** SkillData chr_0035_liino_normal_skill EventListenerAction abilityEvent 150 (frames 0–1815) → CreateBuff
  normalskill_end, FinishBuff extraattack / musicloop, JumpTo 1967 (end of the action; music_tag etc. are `autoFinishByAction`);
  chr_0035_liino_ultimate_skill has no InheritBuffAction (the combo has 9); description "This stance replaces Liino's Vocalist Stance".
- **impact:** after an ultimate cast during the stance, the team keeps +`atk_up` ATK (10–16%) until the 60 s stance would have
  ended, up to ~40 s too long, and the battle skill stays wrongly unavailable for that time (G3's check reads the same buff), so a
  rotation can't recast it. Typical rotation (battle skill, then ultimate within the stance) hits this every cycle.

### G2. End Stance: a hitless skill that ends a state and sets a cooldown
- **family:** skills (hitless skills, cooldowns)
- **feature:** a kit skill with no hits (chr_0035_liino_normal_skill_end) that is castable only while either stance is active
  (G3), costs nothing, `ends` the active stance (G1), and sets another skill's remaining cooldown (`setCooldown: {skill:
  chr_0035_liino_normal_skill, seconds: 5}` when it ended Vocalist; none after Cosmovoice per the description). Ending Cosmovoice
  early must also cancel the finale (a hit with `if: not ended early`, or the finale hit is dropped when the buff is ended rather than
  expired).
- **evidence:** SkillPatchTable chr_0035_liino_normal_skill_end (empty blackboard), SkillData normal_skill_end (CheckSkillType only);
  normal_skill EventListenerAction abilityEvent 9 → SetSkillCdAtOnce `set_cd` 5.0, JumpTo 1967; ultimate EventListenerAction
  137–527 → JumpTo 540 (skips frame 508); description: "Casting this will end her Vocalist Stance early without consuming any SP,
  after which the battle skill will enter a short cooldown" / "This effect does not trigger if the stance is ended early".
- **impact:** rotations can't end a stance to recast the battle skill (6 × `atk_scale` + a fresh stance) sooner; with G1 missing the
  same is true after an ultimate. Moderate for search, no effect on scripted rotations that don't use it.

### G3. Skill availability as a Predicate
- **family:** skills (states) / conditions
- **feature:** `availableWhile` / `unavailableWhile` take a Predicate (today one buff id). Battle skill: `unavailableWhile: {any:
  [{buffActive: vocalist_stance}, {buffActive: cosmovoice_stance}]}`; End Stance the opposite. Evaluated at the action's start frame.
- **evidence:** description "During the stance, her battle skill is replaced with End Stance"; SkillData ultimate ChangeSkillAction 77–527.
- **impact:** the engine lets the battle skill (new Vocalist Stance, 6 projectiles, 25 SP) be cast during Cosmovoice; in game that
  input ends Cosmovoice early. Illegal action, about 2.4–2.9 × ATK of extra damage plus a stance it couldn't have.

### G4. Triggered hit sequences: the stance volley
- **family:** triggers
- **feature:** a kit trigger `on: inflictionApplied` (status.ts `inflicted` and burst events; any element; `by: anyone`), `if:
  buffActive vocalist_stance`, `cooldown: atk_trigger` (10 s, from the trigger), `do: hits` — 6 × `atk_scale_2`, event
  chr_0035_liino_normal_skill_projhit_hit, at offsets after the trigger (data: projectiles from music_animation_hitl/hitr frames 24,
  32, …; log bdf223 pairs at +0 / +107 / +234 ms). The hits are owned by Liino (her panel and buffs, kind battle). A skill can end the
  running sequence (combo frame 0 FinishBuff hitl/hitr) and the trigger stops with the stance (G1).
- **evidence:** BuffData normalskill_spelllnfliction_check (abilityEvent 9 on buff_common_{e}_triggered with tag 1474064594),
  _extraattack (`triggerInterval` bb `hit_tigger` ← `atk_trigger`, CheckDistance 20 m), music_animation_hitl; description "if there
  are enemies nearby, Liino will perform an Additional ATK … on a regular basis"; logs: bdf223 volleys at t=3231 and 14699
  (11.5 s apart), 0eef at 4187.
- **impact:** a 60 s stance with steady teammate inflictions gives up to 6 volleys (6 × 0.24 ATK at P5 each); the kit counts 1. That
  undercounts ~5 × 1.44 = 7.2 × ATK per stance, about 3 × the battle skill's own projectiles (2.88 × ATK).

### G5. Heal events, and triggers on them that buff the healed operator (wpn_lance_0014; also LYNX)
- **family:** triggers (+ buff lifecycle, data compilation for weapon kits)
- **feature:**
  1. Kits declare heal events: on a hit or on a buff's periodic tick (`heals: {target: self | controlled | team | teamInRange}`), with
     frames; no amounts needed. Liino: battle-skill start, soundwave every `music_trigger` 3 s while vocalist_stance, combo frame 33
     (controlled operator), ultimate frame 80 (team), beats every 1.5 s, finale (team). A periodic buff tick (`every: <ValueExpr>`,
     first tick immediate or not) would also replace the hand-listed beat frames and G4's cadence.
  2. Weapon (and gear-set) kits get `buffs` and `triggers`, not only always-on `conditions`, written wielder-relative: `on: heal`,
     `by: wielder`, `targetFilter: notWielder`, per-receiver rate limit 0.1 s, `do: applyBuff` to the event's target (a new buff
     target: the healed operator).
  3. Buff stacking with independent stacks: up to `max_stack` (4) instances, each with its own expiry (stackingType 11), each adding
     `atk_up` (9.8% at L9) to ATK.
  Nothing here is Liino-specific: any wielder whose kit declares heals on teammates triggers it; one that never heals others never does.
- **evidence:** SkillData sk_wpn_lance_0014 passiveEventActions (abilityEvent 50, CheckHealTag, NotNextCheckAction +
  CheckTargetsEqual, CheckTimedMarkerCondition 0.1 s, CreateBuff buff_wpn_lance_0014_damageup to the teammate); BuffData
  buff_wpn_lance_0014_damageup (attr 2 formulaItem 6, stackingType 11, `max_stack`); SkillPatchTable L9 `atk_up` 0.098, `duration`
  20, `max_stack` 4. Logs: teammates' hits carry 1–4 stacks in bdf223 (Typhoeus mostly 3–4), 0eef (1–2), dbaee23 and d9e59 (0.056
  each, skill level 4); Liino's own hits none.
- **impact:** the largest damage effect of the loadout: teammates' ATK +9.8% per stack, typically 2–4 stacks (+20–39%), missing from
  every simulated rotation with this weapon. Log checks are unaffected (they read the logged buffs).

### G6. SP grants from kit effects (P1, talent 2)
- **family:** values (resources) + triggers
- **feature:** an `sp` ValueExpr on a hit, a skill cast or a trigger action, counted as returned SP (spent first, gives no energy,
  as `spReturned` already works for `atb`). P1: at the battle skill's frame 0, `potential_atb_return` (25) if it's the first battle
  skill since the fight started and no stance is active (a once-per-fight flag, e.g. a stack). Talent 2: Liino's combo starts a
  30 s one-shot effect (`atb_return_duration`); the next battle-skill cast by any operator whose element is pulse or natural returns
  `atb_return` (5 / 10) and ends it; recasting the combo doesn't stack it. Needs a trigger `on: skillCast` (`kind: battle`, `by:
  anyone`) and a Predicate on the caster's element (`casterElement`).
- **evidence:** PotentialTalentEffectTable chr_0035_liino_potential_1 (`potential_atb_return` 25, attachBuff buff_chr_0035_liino_potential),
  SkillData normal_skill frame 0 ObtainCostAction costType 1; chr_0035_liino_talent_2_1 / _2_2 (`atb_return` 5 / 10,
  `atb_return_duration` 30), combo CreateGlobalBuffAction, BuffData combo_atb_return (CheckSkillType [2], CompareString Pulse / Natural,
  FinishGlobalBuffAction).
- **impact:** 10 SP per combo (~1.25 s of team SP regen) for an Electric/Nature teammate's battle skill, 25 SP once per fight at P1.
  Changes how many battle skills fit; small but systematic.

### G7. "Reaction consumed" event
- **family:** arts state
- **feature:** a StatusEvent when an active reaction status is removed by a hit (`statusConsumed {status, by}`), and `on:
  statusConsumed` (optionally `statuses`) in combo triggers / triggers. Which hits consume which status comes from kits (applications
  `consumeStatus`), the same way `consumeInfliction` works for inflictions.
- **evidence:** CharGrowthTable chr_0035_liino_ComboSkill: "an Arts Reaction is consumed or is applied on an enemy" (no data: combo
  triggers are game code, conditionId empty).
- **impact:** missing combo windows in teams that consume statuses (e.g. Shatter of Solidification, itself a physical-state gap).
  None of the fixture teams can show it.

### G8. Action states: what the operator may cast while an action continues
- **family:** skills (states) + data compilation
- **feature:** per skill, compiled from SkillData: frame ranges with the set of skills that may be cast (AllowNextSkillAction lists)
  and ChannelingCastingAction flags (cantCastSkill, cantSwitchPosition); the action lasts until `exclusiveFrame` (or until a stance it
  maintains ends: G1/G2). The timeline checks a new action of that operator against the set, and a swap against cantSwitchPosition.
  Ultimates are assumed castable anyway (the description has Cosmovoice replacing an active Vocalist; the lists don't name it).
- **evidence:** normal_skill exclusiveFrame 1821, AllowNextSkillAction 50–1872 [combo, normal_skill_end], 1817+ [normal_skill,
  power_attack]; ChannelingCastingAction 0–90 cantCastSkill, cantSwitchPosition; ultimate exclusiveFrame 543, AllowNextSkillAction
  77–527 [normal_skill_end], 163–527 [combo], ChannelingCastingAction 77–137; engine: `lockFrames = cancelFrame ?? exclusiveFrames`
  (timeline.ts skillCosts).
- **impact:** the engine allows basic attacks and swaps that the game may not (U4); Liino's own basic damage is small, but the search
  explores illegal sequences and the combo/End Stance timing (allowed from 50 vs channel to 90) is unchecked.

### G9. Stack groups by BuffData stackingKey
- **family:** data compilation
- **feature:** `stackGroup` = the BuffData `stackingKey` (when stackingType is 1) instead of the file id, so different files with
  one key (buff_chr_0035_liino_atkup, _atkup_owner, _atkup_finishtime: `liino_atk_up`; spellenhance / _finishtime: `liino_spellenhance`)
  form one group.
- **evidence:** BuffData stackingSettings of those files; packages/data/src/kits.ts line 209 (`stackGroup: gameBuff`).
- **impact:** none if both stance buffs name the same gameBuff (mechanic 23); a trap otherwise (double-counted ATK, ~10–16%).

### G10. Time dilation and projectile travel (shared)
- **family:** timing
- **feature:** the known shared gaps: TimeDilationAction (combo: others × curve for 0.9333 s; ultimate 0–30) and UltimateTimeAction
  (0–77), and projectile travel from launch to impact.
- **evidence:** combo_skill / comboskill_ultskill_hit TimeDilationAction; dbaee23b801d hit times (above, mechanic 27).
- **impact:** hit times off by up to ~1 s within the ultimate, so buff windows that start or end near them may be wrong; damage per
  hit unchanged.

### G11. Finisher (shared)
- **family:** physical state
- **feature:** finisher damage (power_attack `atk_scale` 9.0, BreakingAttackCalculation) on a Staggered enemy.
- **evidence:** SkillData chr_0035_liino_power_attack; description "FINISHER: … deals massive Electric DMG and recovers some SP".
- **impact:** small for a support; shared with every operator.

## Status counts

27 supported (5 of them no-ops: rows 6, 32, 41, 44, 45), 14 gap, 2 data, 2 unknown, 0 unique?.

## Verification

Fixtures with Liino (all wpn_lance_0014, LYNX):

| Fixture | What it can check | State now |
|---|---|---|
| zmdlogs-bdf223db8e49 | battle skill 6/6; two volleys (t=3231 and 14699, cadence for U1); combo (Corrosion, usp02); team ATK and lance stacks (1–4) on teammates; G5 once teammates' hits are simulated | 12 match, 8 under unmodelled effects |
| zmdlogs-0eef2474a26f | battle skill 6/6; one volley (t=4187); combo; lance stacks 1–2 | 12 match, 1 under unmodelled effects. Open: the team ATK buff vanishes at t=8741, ~1.2 s after a combo whose second hit isn't logged (stance ended? End Stance? swap?) |
| zmdlogs-dbaee23b801d | ultimate 20 + bomb + 4 beats, Cosmovoice ATK and Amp logged; projectile timings (G10); lance stacks at L4 | 25/25 match |
| zmdlogs-d9e59d0fb737 | ultimate under Corrosion; parser v58 doesn't log her stance buffs | 0 match, 24 under unmodelled effects |

No fixture has: Vocalist → ultimate → after Cosmovoice (G1), End Stance (G2), the finale, a combo during Cosmovoice, P1 or talent-2
SP. Log tooling note: some hits list 5–6 buff_wpn_lance_0014_damageup entries though `max_stack` is 4 (bdf223: Typhoeus 5 once,
Si 6 once); worth checking whether the parser repeats entries.

Unknowns and in-game tests (simple, for the owner):

- **U1 volley cadence.** Is it "on an infliction, then 10 s cooldown", and does a burst (same element again) count? Test: cast the
  battle skill with no teammate damage for 15 s, then apply one infliction: does the volley come at once? Apply another within 10 s:
  no volley expected.
- **U2 combo during Cosmovoice.** Cast the ultimate without Vocalist Stance, then let a teammate apply a reaction: does the combo
  light up? (Also: does her own bomb's forced Electrification open it?)
- **U3 energy block.** During Cosmovoice, cast her combo (20 energy): does her ultimate gauge move before the stance ends? If not,
  `energyBlockSeconds` should be ~17.6 s (frame 527), not 3.57.
- **U4 actions during the stance.** While Vocalist Stance is active with Liino controlled, can she basic attack? Can you swap away
  in the first 3 s after the battle skill?
- **U5 P1 window.** At P1+, enter battle, wait 5 s, cast the battle skill: are 25 SP returned? (data: enterfight buff lifeType 1,
  duration 1.5 s)
- **U6 (low)** Does End Stance count as "a battle skill cast" for talent 2?

## Re-analysis (pass 2, 2026-10-18)

Phase 4. Checked against the engine and kit format as of the batch-1 "Progress" list (triggers, values, conditions, buff
lifecycle, skills S1–S7, arts state A1–A5, physical state P1–P2, Ti1 part, Ti4), `schemas/kit.schema.json`,
`efsim kit-draft chr_0035_liino` (v2) and the `KNOWN` list in packages/data/test/skillCompile.test.ts. Engine code read:
packages/engine/src/events.ts, buffs.ts, timeline.ts (actionGate, addBuff, trigger actions). Scratch scripts:
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/liino2/`.

### Claims corrected in this pass

Facts from the first round re-checked against the data; these were wrong or weakly founded:

1. **The volley reacts to an Arts Reaction, not to an infliction.** buff_chr_0035_liino_normalskill_spelllnfliction_check
   (put on enemies by the battle skill's AuraAction, frames 45–1691) fires on abilityEvent 9 (= OnAddedBuff in Endaxis's
   native event table, tools/game-data-compiler abilityEventProjection.ts, read only) when the added buff is
   buff_common_{cryst,fire,pulse,natural}_triggered or carries tag 1474064594. Those `_triggered` buffs are the reactions
   (journal: `buff_common_natural_triggered` is the Corrosion reaction's damage), and tag 1474064594 is the tag the weapon
   skills that say "Arts Reaction" query (sk_wpn_pistol_0008, sk_wpn_sword_0018, sk_wpn_funnel_0015 descriptions).
2. **End Stance's cooldown is 3 s, not 5.** `set_cd` isn't in SkillPatchTable at any level; the SkillData default of
   chr_0035_liino_normal_skill is 3.0.
3. **abilityEvent 150 isn't "interrupted".** It isn't in Endaxis's native table; buff_chr_0035_liino_potential uses it to
   end P1's entry marker, so it's most likely "leaving the fight". The ultimate ends Vocalist Stance because it interrupts the
   battle skill's action and the stance buffs are `autoFinishByAction` with `inheritSkillIdList` naming only the combo and
   normal_skill_combo (normal_skill CreateBuffActions at 15–1815 and 45–1691). Same effect, different mechanism.
4. **No heal at the battle skill's start.** chr_0035_liino_normal_skill_projhit_health is launched by nothing (only its own
   `_vfx` file names it). Vocalist Stance heals through the soundwave only: buff normalskill_music_damage, created at frame 15,
   `waitFirstTriggerInterval` false, every `music_trigger` 3 s to frame 1815.
5. **The ultimate's 0.9 s gap between the first projectile pair and the rest isn't travel.** In dbaee23 (8613 → 9530 ms),
   Arcane's combo starts at 8501: its time dilation slows Liino's entity. Ti1 already models that.
6. **The first round's evidence for "lifeType 1 ignores `duration`" doesn't hold up.** The 12 s volley in bdf223 is the
   10 s tick plus slow-downs, which a 10 s duration would also allow. Better evidence: buff_chr_0026_lastrite_passive is a
   permanent passive with lifeType 1 and duration 1 s, and Liino's buff_chr_0035_liino_ultskill_refrainobtainusp (lifeType 1,
   duration 1 s) is created by a CreateBuffAction spanning exactly Cosmovoice (77–527, `autoFinishByAction`). The only other
   RefrainObtainUsp buffs in the game have lifeType 0 and real durations. Reading: a lifeType 1 buff lives until it's ended,
   here by its creating action's end.
7. **Nine beats, not eleven.** buff ultskill_music_damage is created by a 77–477 clip with `autoFinishByAction`, so its
   15 s duration (`vfx_music_duration` ← `ultmusic_duration`) never runs out: beats at 77 + 45k ≤ 477, 9 beats, and the
   finale at 508. The kit's 9 is right; the KNOWN entry ("data 18 landings", plus 482/527) is a compiler limitation (it
   ignores `autoFinishByAction`).
8. **The finisher is not 4 × `atk_scale`.** chr_0035_liino_power_attack has BreakingAttackCalculation multipliers 0.1 (a
   tick at 12/15/18) and 0.7 (frame 34): 3 × 0.1 + 0.7 = 1.0 × `atk_scale` (9.0). kit-draft's four plain `atk_scale`
   landings are 4× too high.
9. **P1 has no time window.** buff_chr_0035_liino_potential_enterfight (lifeType 1) is made on OnEnterFight when the
   Vocalist tag −438154626 is absent, and ends only when the battle skill uses it (normal_skill frame 0–2: FinishBuff,
   CheckSquadInFight, ObtainCostAction `potential_atb_return`) or on event 150. So U5 is settled by the data: it's the first
   battle skill of the fight.
10. **Cosmovoice very likely enables the combo (U2).** The battle skill (15–1815) and the ultimate (77–539) add the same
    entity tags [−1601691447, 1263537306, −1895802021], and the combo has a Cosmovoice variant (`switchToBuffConfig`). The
    description names only Vocalist. Still a test (below), but the data favours "either stance".

### 1. First-round rows and gaps against the current engine

| First-round row / gap | Now? | How (fields), or what's still missing |
|---|---|---|
| 2 Hit frames, counts, event keys (data) | supported | kit-draft v2 emits them; copy its battle-skill, combo, ultimate and basic-attack landings. Hand-written exceptions: volley (event-driven), beats (9, see claim 7), finale `if`, finisher factors (claim 8), poise (not emitted). |
| 4 / G1 Ultimate ends Vocalist Stance | supported | trigger `on: {event: cast, skills: [chr_0035_liino_ultimate_skill]}`, `by: self`, `do: [endBuff vocalist_stance, endBuff volley_window]` (B1). |
| 5 / G4 Stance volley | supported (shape depends on U1) | a trigger `on: reaction` (not infliction, claim 1), `by: anyone`, `if: buffActive volley_window`, `cooldown: atk_trigger`, `do: hits` (T1/T2), frames +24/25/28/29/32/33 from SkillData hitl/hitr. The alternative reading (a 10 s tick that fires only if a reaction happened in the last 2 s) is expressible too: a ticking buff (`every`, `tickOnApply`) plus a 2 s marker buff. Sketches in the kit plan. |
| 8 / G2 End Stance (hitless, ends a stance, sets cooldown, cancels finale) | supported | kit skill chr_0035_liino_normal_skill_end with `hits: []` (S1), `available` either stance (S2); its own cast trigger: `cooldown {who: self, skills: battle, seconds: set_cd}` only after Vocalist, then `endBuff` of every stance buff. The finale and the beats get `if: {buffActive: cosmovoice_amp}`. Cost 0 comes from SkillPatchTable chr_0035_liino_normal_skill_end (battle group). |
| 10 / G8 What she may do during the stance and the ultimate | partly | Done (S3): windows (normal_skill 50–1872 [combo, End Stance]; ultimate 77–527 [End Stance], 163–527 [combo]), exclusive frames (1821, 543), swaps blocked by `cantSwitchPosition` (0–90; 0–77, 77–137, 508–527). Missing: `cantCastSkill` channels don't block casts (gap R4), and the stance's action resuming after a combo / ending with the stance (R5). |
| 13 / G7 Combo on a consumed reaction | supported | second combo trigger `on: {event: statusConsumed}` (A5), same `by` and `if`. |
| 14 / U2 Combo during Cosmovoice | unknown (data says yes, claim 10) | write `if: {any: [{buffActive: vocalist_stance}, {buffActive: cosmovoice_amp}]}`; test 2 below. |
| 16 Combo's Cosmovoice variant | supported | same hits; add `buff_chr_0035_liino_comboskill_ultskill_hit` to their `events` (likely log key, not yet seen). |
| 17, 27 / G10 Time dilation, cut-in, travel | partly | Done (Ti1): her combo's global ComboSkill dilation (frames 0–25, loaded), her ultimate's time stop (0–77), and other operators' slow-downs shifting her entity (claim 5). Missing (batch-wide): entity-layer dilation (combo 0–7 on her own entities) and hit-stop (beats 0.15 s), R9; projectile travel (Ti2), R8: both logs have the first beat before the first projectile pair. |
| 18 Combo cancels an in-flight volley | gap | R3: triggered hits belong to no cast (timeline.ts `case "hits"`), so nothing can cancel them. |
| 23 / G9 Stack group by stackingKey | supported | done (B6, kits.ts: stackingType 1 → stackingKey). Both stances' ATK buffs name `gameBuff: buff_chr_0035_liino_atkup` (key `liino_atk_up`); Cosmovoice's Amp names buff_chr_0035_liino_spellenhance (key `liino_spellenhance`). |
| 24 / G3 Battle skill unavailable in either stance | supported | `available: {not: {any: [{buffActive: vocalist_stance}, {buffActive: cosmovoice_amp}]}}` (S2). |
| 26 / U3 Energy block | supported (value unknown) | a self buff with `blocksEnergy: true` (S7/B2), applied at frame 76–77, duration `ultmusic_duration` (15 s, to frame 527), ended by End Stance. Replaces `energyBlockSeconds` 3.5667, which kit-draft still emits from the 1 s duration (claim 6). Test 3 decides 15 s vs 1 s. |
| 29 / G5.1 Heal events | supported | hits' `heals` (combo hit 2: `controlled`; beats: `team`), a `heal` action on triggers (vocalist soundwave on the stance's `buffTick`; ultimate frames 80 and 513 as delayed cast triggers). |
| 30 Basic attacks, plunging (data) | supported | kit-draft v2 landings; counts check out against `display_atk_scale` (attack1 2 × 0.21, attack2 5 × 0.12, attack3 0.5 + 5 × 0.02, attack4 10 × 0.081, attack5 1.0, plunge 1.44 + 0.36). attack5's SP: `sp: {if: {controlled: true}, then: atb, else: 0}` unless the engine already gates Final-Strike SP on control. Poise hand-written (attack5 `poise`). |
| 31 / G11 Finisher | supported | P2 (spec 8 skills only on a Staggered enemy, the enemy's multiplier and SP); hits hand-written with the factors of claim 8. |
| 33 / G6 Talent 2 SP | supported | buff `starry_boost` (self, no modifiers, duration `{product: [talent_b, atb_return_duration]}`, 0 without the talent so it's skipped); trigger `on: {event: cast, kinds: [battle]}`, `by: anyone`, `if: {all: [{buffActive: starry_boost}, {eventOperator: {operatorElement: [pulse, natural]}}]}`, `do: [sp atb_return, endBuff starry_boost]` (V4, C2). |
| 34 / G6, U5 P1 SP | supported | stack `p1_ready` (max 1, `initial: 1`); trigger on her battle-skill cast with `if: {stack: p1_ready, atLeast: 1}` → `sp: potential_atb_return` (0 below P1: SkillData default 0, P1 sets 25 via skillBbModifier) and `gain p1_ready −1`. Window: claim 9. |
| 43 / G5.2–3 Weapon: healed teammates get ATK, 4 layers each | partly | Expressible: equipment kit wpn_lance_0014 with a layered team buff (`maxStacks`, B3) given `to: eventSubject` by `on: {event: heal, toOthers: true}`, `by: self` (T3). Missing: **layers aren't per recipient** (R1): `withBuff` (buffs.ts) keys layers by buff and owner only, so all teammates share one pool of 4. Also missing: the 0.1 s limit per receiver (R2) and a heal-kind filter (R7, no effect for Liino). |
| 45 LYNX heal → DMG reduction | supported (no-op) | nothing to write; a `to: eventSubject` plain buff would hit the same R1 problem (it would replace another ally's instance) if damage taken were ever modelled. |

Status counts after this pass, with the 45 first-round rows: 39 supported (5 no-ops), 4 partly (rows 10, 17, 27 and 43),
1 gap (row 18), 1 unknown (row 14, data-favoured). Row 26's value is unknown but expressible either way.

### 2. Remaining gaps

#### R1. Per-recipient instances of a team buff given to one operator (`to: eventSubject`)
- **family:** buff lifecycle
- **feature:** a team buff applied with `to: eventSubject` (or any `recipients` subset) is keyed by (buff, owner,
  recipient). A layered one keeps up to `maxStacks` layers per recipient, each with its own expiry. A plain one replaces
  only that recipient's instance. `endBuff` and `extendBuff` without a subject act on every recipient; `buffApplied` and
  `buffEnded` events say which recipient.
- **evidence:** packages/engine/src/buffs.ts `withBuff` (`same` = id and owner) and timeline.ts `addBuff` (recipients =
  [subject]). BuffData buff_wpn_lance_0014_damageup is a buff on each receiver (stackingType 11, `max_stack` 4). Log
  zmdlogs-bdf223db8e49 around t≈12.7 s: Typhoeus 4, Arcane 2, Si 3 layers at once (9 > 4). tests/timeline.test.ts "Liino's
  weapon pattern" uses a two-operator team, so it can't show this.
- **impact:** with three healed teammates, the team shares 4 layers instead of 4 each: about +13% ATK per teammate
  instead of up to +39% (L9). This is the loadout's largest damage effect. Also wrong for any plain `eventSubject` buff on
  two allies (LYNX's DMG reduction, if damage taken is modelled).

#### R2. Trigger rate limit per event subject
- **family:** triggers
- **feature:** `cooldownPer: "subject"` (or `cooldownScope`), meaning the trigger's cooldown is tracked per event subject
  (the healed operator) rather than per trigger.
- **evidence:** sk_wpn_lance_0014 passiveEventActions: CreateTimedMarker `sk_wpn_lance_0014` 0.1 s on the receiver,
  CheckTimedMarkerCondition before the buff. Description: "Each operator can gain this effect at most once every 0.1s".
- **impact:** small. A plain `cooldown: 0.1` would wrongly block the 2nd and 3rd receivers of one team heal (one heal event
  per member at the same frame), so the kit must leave the limit out. That overcounts only when two of the wielder's heals
  reach the same ally within 0.1 s, e.g. her ultimate's first beat (77) and heal_start (80) at the edge.

#### R3. A cast ending a trigger's pending hits
- **family:** triggers (buff lifecycle)
- **feature:** a trigger action `cancelHits: {trigger: <id>}` (the owner's hits still to land from that trigger are dropped)
  for use in a cast trigger, or triggered hits that belong to the owner's current action and are cancelled with it unless
  `detached`.
- **evidence:** chr_0035_liino_combo_skill frame 0 FinishBuffAdvanced buff_chr_0035_liino_normalskill_music_animation_hitl /
  hitr (the volley's launcher; projectiles at its frames 24–33).
- **impact:** up to one volley (6 × `atk_scale_2`, 1.44 × ATK at P5) is counted too often whenever the combo is cast
  within ~1.1 s of the volley's trigger. Under reading B the same reaction can open the combo window and start the volley,
  so a rotation that casts the combo at once loses that volley in game. Not seen in the fixtures (their combos are 3+ s
  after volleys).

#### R4. `cantCastSkill` channels don't block casts
- **family:** skills (states)
- **feature:** during a ChannelingCastingAction with `cantCastSkill`, the operator can't start any skill, even one a window
  lists or one that outranks the current skill. Ultimates may need an exception; the data doesn't say and needs a test.
- **evidence:** loaded timing of chr_0035_liino_normal_skill: window 50–1872 [combo, End Stance] but channel 0–90
  `cantCastSkill`, and End Stance's listeners only exist from frame 90. Ultimate: window 77–527 [End Stance] but channel
  77–137 `cantCastSkill`, listener from 137. timeline.ts reads `cantSwitch` only (line ~1042). Shared: every operator with
  channels.
- **impact:** the engine allows End Stance or the combo 1.3 s early after her battle skill and End Stance 2 s early in
  Cosmovoice. An End Stance there does nothing in game (no listener), while the engine ends the stance. Small for
  scripted rotations; search can exploit it.

#### R5. The stance's action follows the stance (resume after a combo, jump to the end when it ends)
- **family:** timing (Ti3, JumpToAction) / skills
- **feature:** (a) after her combo, the stance's action resumes: the game casts chr_0035_liino_normal_skill_combo at
  combo frame 67 (TriggerCustomAbilityEvent `liino_comboskill_end` → music_tag CastSkill), with windows [End Stance,
  combo] and exclusive frame 1954. A kit `cast` trigger action can do this already. (b) When the stance ends (expiry
  creates normalskill_end; End Stance creates normalskill_end_active), the action jumps to its end (JumpToAction 1967). A
  trigger action "end the owner's current action" (`endAction`, a JumpTo to the end) on `buffEnded vocalist_stance` would
  express (b).
- **evidence:** SkillData normal_skill EventListenerActions 90–1815 (abilityEvent 9 + CheckBuffIdInContextAdvanced
  normalskill_end / _end_active → JumpTo 1967); normal_skill_combo timing (loaded: windows 0–1800, exclusive 1954); combo
  InheritBuffAction 0–78 into normal_skill_combo.
- **impact:** which actions Liino may take during the stance. Today the engine frees her after a combo but keeps her
  battle skill's exclusive time otherwise. With (a) alone she'd stay locked past the stance's end. Damage small (her basic
  attacks and finisher), and it depends on U4.

#### R6. Data compilation: buff lifetimes, poise, finisher factors (D1 remainder)
- **family:** data compilation
- **feature:** skillCompile.ts should (1) end a created buff at its CreateBuffAction's last frame when `autoFinishByAction`
  (unless a later InheritBuffAction hands it on), and treat lifeType 1 as "until ended", ignoring `duration`; (2) emit
  `poise` from a DamageAction's poise unit (`poiseCalculation` key); (3) multiply a landing's scale by
  BreakingAttackCalculation `multiplier`.
- **evidence:** claims 6–8; the kit-draft output (energyBlockSeconds 3.5667; 22 beat landings to 527; volleys only at 45 and
  345, though extraattack lives 45–1691 and would tick 6 times; power_attack 4 × `atk_scale`; no `poise` anywhere though
  normal_skill_projhit(_02), combo hit 2, projhit_damage_02 and attack5 carry a `poise` unit).
- **impact:** none once the kit hand-writes these (status `data`). The draft misleads the next operator with
  `autoFinishByAction` or lifeType 1 buffs, and the finisher is 4× too high if copied.

#### R7. Heal events carry their kind (skill-heal tag)
- **family:** triggers
- **feature:** heal events carry the healing skill's kind, from HealAction `healTags` (−320297214 battle, −1517158118 combo,
  −1499119779 ultimate, none). `on: {event: heal, kinds: [...]}` filters on it.
- **evidence:** sk_wpn_lance_0014 CheckHealTag queries exactly those three tags; 96 of the game's HealActions have no tag
  (talent, potential, equipment and other heals).
- **impact:** none for Liino, since all her heals are tagged. A wielder whose only heals to teammates are untagged (e.g. a
  talent heal) would wrongly trigger the weapon. Generic-equipment rule.

#### R8. Projectile travel (Ti2, batch-wide, open)
- **family:** timing
- **feature:** as in the batch file (Ti2).
- **evidence:** dbaee23 / d9e59: the first beat (frame 77) is logged 355–534 ms before the first projectile pair (frame 76).
- **impact:** the kit must apply Cosmovoice with the first pair `beforeDamage` (as today), not at its data frame 77.
  Damage per hit unchanged.

#### R9. Entity-layer dilation and hit-stop (Ti1 remainder, batch-wide, open)
- **family:** timing
- **feature:** as in the batch file (Ti1 "not yet").
- **evidence:** combo TimeDilationAction 0–7 on her own entities; HitStopAction 0.15 s on each beat
  (ultimate_skill_soundwave_projhit).
- **impact:** a few frames per combo or beat.

R1 is the only large one, and it's not Liino-specific (any `to: eventSubject` layered buff). R3–R5 touch action legality
and one volley at a time. R6 is compiler work with a hand-written fallback. R8 and R9 are already tracked for the batch.

### 3. Kit plan (phase 5)

Values name the skill they come from: skill keys plainly where the hit's or trigger's `skill` is the owner's skill, else
`{key, skill}`. Frames are 30 FPS from the cast.

**Buffs** (operator kit):

| id | target | gameBuff | duration | modifiers / flags | source |
|---|---|---|---|---|---|
| vocalist_stance | team | buff_chr_0035_liino_atkup | `music_duration` (normal_skill) | atk `atk_up`; `every: music_trigger`, `tickOnApply: true` (heal ticks) | normal_skill 15–1815 music_tag / music_damage |
| volley_window | self | — | none (ended with the stance) | — | AuraAction spelllnfliction_check and extraattack from frame 45 |
| cosmovoice_atk | team | buff_chr_0035_liino_atkup | `ultmusic_duration` | atk `atk_up` (ultimate) | ultskill_music_tag aura → normalskill_buff_atkup |
| cosmovoice_amp | team | buff_chr_0035_liino_spellenhance | `ultmusic_duration` | amp [pulse, natural] `{min: [{product: [will_up, {attr: 42}]}, will_max]}` | ultimate frame 77 StoreAttributeValue / CompareFloat; EnhancedAction subType 6, 3 |
| cosmovoice_block | self | — | `ultmusic_duration` (U3: or 1 s) | `blocksEnergy: true` | ultskill_refrainobtainusp 77–527 |
| starry_boost | self | — | `{product: [talent_b, atb_return_duration]}` (combo) | — | combo CreateGlobalBuffAction (talent 2) |

**Stacks:** `p1_ready` (max 1, `initial: 1`).

**Skills:**

- **chr_0035_liino_normal_skill** (battle), `available: {not: {any: [{buffActive: vocalist_stance}, {buffActive:
  cosmovoice_amp}]}}`, `teamEnergyFrame: 15`. Hits from kit-draft: `projhit` 1 × `atk_scale` @12 (event
  …_normal_skill_projhit), `projhit_02` 5 × `atk_scale` @12,14,14,16,16 (…_projhit_02), both `detached`, `poise: poise`,
  `buffs: [{buff: vocalist_stance, beforeDamage: true}]` on the first (all six are logged with it). No volley hit here.
- **chr_0035_liino_normal_skill_end** (battle), `hits: []`, `available: {any: [{buffActive: vocalist_stance}, {buffActive:
  cosmovoice_amp}]}`.
- **chr_0035_liino_combo_skill** (combo): `hit` `atk_scale` @9; `hit_2` `atk_scale_2` @33, `energy: usp`, `heals:
  controlled`, `poise: poise`. Events for both: chr_0035_liino_combo_skill and buff_chr_0035_liino_comboskill_ultskill_hit.
  Drop the hand-written `durationFrames: 150` (the loader reads the data).
- **chr_0035_liino_ultimate_skill** (ultimate), no `energyBlockSeconds`. Landings from kit-draft, all `detached`:
  `projhit_first` 2 × `atk_scale` @76 with `buffs` cosmovoice_atk, cosmovoice_amp, cosmovoice_block `beforeDamage`
  (R8); `projhit` 14 × @79,79,82,82,91,91,94,94,97,97,101,101,104,104; `projhit_l` 2 × @84,87; `projhit_r` 2 × @84,87;
  `bomb` `atk_scale_2` @116 (…_projhit_damage_02), `applies` forced electrification, `poise: poise`; `beats` 9 ×
  `atk_scale_3` @77,122,…,437 (…_soundwave_projhit), `heals: team`, `if: {buffActive: cosmovoice_amp}`; `finale`
  [`atk_scale_3`, `final_value`] @508 (…_soundwave_02_projhit), same `if`.
- Basic attacks from kit-draft (attack1–5, plunging_attack_end) with attack5 `poise: poise` and its SP as in row 30.
  **chr_0035_liino_power_attack**: `ticks` [`atk_scale`, 0.1] × 3 @12,15,18 and `final` [`atk_scale`, 0.7] @34 (event
  chr_0035_liino_power_attack).

**Triggers** (in this order):

```json
[
  { "id": "combo_on_reaction", "on": { "event": "reaction" }, "by": "anyone",
    "if": { "any": [{ "buffActive": "vocalist_stance" }, { "buffActive": "cosmovoice_amp" }] }, "do": [{ "kind": "openCombo" }] },
  { "id": "combo_on_consumed", "on": { "event": "statusConsumed" }, "by": "anyone",
    "if": { "any": [{ "buffActive": "vocalist_stance" }, { "buffActive": "cosmovoice_amp" }] }, "do": [{ "kind": "openCombo" }] },
  { "id": "volley_window_open", "on": { "event": "cast", "skills": ["chr_0035_liino_normal_skill"] }, "by": "self", "delay": 45,
    "do": [{ "kind": "buff", "buff": "volley_window", "if": { "buffActive": "vocalist_stance" } }] },
  { "id": "volley", "on": { "event": "reaction" }, "by": "anyone", "if": { "buffActive": "volley_window" },
    "cooldown": "atk_trigger", "skill": "chr_0035_liino_normal_skill",
    "do": [{ "kind": "hits", "hits": [{ "id": "volley", "label": "Additional ATK", "damageType": "battle", "scale": ["atk_scale_2"],
      "count": 6, "frames": [24, 25, 28, 29, 32, 33], "events": ["chr_0035_liino_normal_skill_projhit_hit"] }] }] },
  { "id": "stance_song", "on": { "event": "buffTick", "buff": "vocalist_stance" }, "by": "self", "do": [{ "kind": "heal", "target": "team" }] },
  { "id": "stance_end_cleanup", "on": { "event": "buffEnded", "buff": "vocalist_stance" }, "by": "self", "do": [{ "kind": "endBuff", "buff": "volley_window" }] },
  { "id": "ult_replaces_vocalist", "on": { "event": "cast", "skills": ["chr_0035_liino_ultimate_skill"] }, "by": "self",
    "do": [{ "kind": "endBuff", "buff": "vocalist_stance" }] },
  { "id": "ult_heal_start", "on": { "event": "cast", "skills": ["chr_0035_liino_ultimate_skill"] }, "by": "self", "delay": 80,
    "do": [{ "kind": "heal", "target": "team" }] },
  { "id": "ult_heal_finale", "on": { "event": "cast", "skills": ["chr_0035_liino_ultimate_skill"] }, "by": "self", "delay": 513,
    "do": [{ "kind": "heal", "target": "team", "if": { "buffActive": "cosmovoice_amp" } }] },
  { "id": "end_stance", "on": { "event": "cast", "skills": ["chr_0035_liino_normal_skill_end"] }, "by": "self", "skill": "chr_0035_liino_normal_skill",
    "do": [
      { "kind": "cooldown", "who": "self", "skills": "battle", "seconds": "set_cd", "if": { "buffActive": "vocalist_stance" } },
      { "kind": "endBuff", "buff": "vocalist_stance" }, { "kind": "endBuff", "buff": "cosmovoice_atk" },
      { "kind": "endBuff", "buff": "cosmovoice_amp" }, { "kind": "endBuff", "buff": "cosmovoice_block" } ] },
  { "id": "p1_return", "on": { "event": "cast", "skills": ["chr_0035_liino_normal_skill"] }, "by": "self",
    "if": { "stack": "p1_ready", "atLeast": 1 },
    "do": [{ "kind": "sp", "value": "potential_atb_return" }, { "kind": "gain", "gains": [{ "stack": "p1_ready", "amount": -1 }] }] },
  { "id": "starry_boost_start", "on": { "event": "cast", "skills": ["chr_0035_liino_combo_skill"] }, "by": "self", "delay": 33,
    "skill": "chr_0035_liino_combo_skill", "do": [{ "kind": "buff", "buff": "starry_boost" }] },
  { "id": "starry_boost", "on": { "event": "cast", "kinds": ["battle"] }, "by": "anyone", "skill": "chr_0035_liino_combo_skill",
    "if": { "all": [{ "buffActive": "starry_boost" }, { "eventOperator": { "operatorElement": ["pulse", "natural"] } }] },
    "do": [{ "kind": "sp", "value": "atb_return" }, { "kind": "endBuff", "buff": "starry_boost" }] }
]
```

Notes on the sketch:
- "Either stance" is written with `cosmovoice_amp` everywhere (any Cosmovoice buff would do; the old kit's `cosmovoice_stance` is split into `cosmovoice_atk` and `cosmovoice_amp` for their two stack groups).
- The volley's alternative reading A (test 1): replace `volley` with `volley_window` given `every: atk_trigger`,
  `tickOnApply: true`, plus a self buff `reaction_seen` (2 s, BuffData spelllnfliction_hit `hit_duration`). One trigger
  `on: reaction` gives `reaction_seen` when `buffActive volley_window`; a second `on: buffTick volley_window` with `if:
  buffActive reaction_seen` lands the hits.
- Data values: delay 45 is the AuraAction / extraattack start. The volley window really ends at 1691, 4 s before the
  stance, unless a combo hands it to normal_skill_combo. That's an approximation.
- `starry_boost` delay 33: the combo's CreateGlobalBuffAction follows the frame-33 hit.
- Optional, after R5: a `cast` action of chr_0035_liino_normal_skill_combo at combo frame 67 while vocalist_stance is active.

**Equipment kit wpn_lance_0014** (new file; correct only for one healed teammate until R1, and the 0.1 s limit is left
out per R2):

```json
{ "equipment": "wpn_lance_0014",
  "buffs": [{ "id": "wpn_lance_0014.atk", "label": "Medicant: Shimmering Curtain (ATK)", "target": "team",
    "gameBuff": "buff_wpn_lance_0014_damageup",
    "duration": { "key": "duration", "skill": "sk_wpn_lance_0014" },
    "maxStacks": { "key": "max_stack", "skill": "sk_wpn_lance_0014" },
    "modifiers": [{ "zone": "atk", "value": { "key": "atk_up", "skill": "sk_wpn_lance_0014" } }] }],
  "triggers": [{ "id": "wpn_lance_0014.healed", "on": { "event": "heal", "toOthers": true }, "by": "self",
    "skill": "sk_wpn_lance_0014", "do": [{ "kind": "buff", "buff": "wpn_lance_0014.atk", "to": "eventSubject" }] }] }
```

Will +156, main attribute +44.8% and Treatment Efficiency stay in the stat panel. **suit_heal01 (LYNX):** no kit (both
effects are no-ops).

**Examples:** examples/liino-laevatain.scenario.json depends on the combo opening during Cosmovoice: its combo comes after
her ultimate, which now ends Vocalist. It stays legal only with the "either stance" condition (U2). Expect its total to
change: Vocalist's ATK stops at the ultimate, Cosmovoice ATK is added, and the energy block is longer.

**Verification after the rewrite:** bdf223 and 0eef battle skill 6/6, volleys at t=3231 / 14699 and 4187 (now triggers),
combo hits; dbaee23 25/25 (the beats' `if` must hold); the KNOWN list loses the follow-up frames and gains the beats
(9 vs compiled 11) and power_attack factors as compiler limits with this evidence.

### 4. In-game tests for the remaining unknowns

These are simple ones for the owner. They supersede U1–U6 above; U5 is settled by the data (claim 9).

1. **What fires the volley (U1).** Liino plus two teammates who apply different arts inflictions. Cast her battle skill,
   then let nobody attack for 12 s: do any volleys (six small Electric hits) appear? Next, trigger one Arts Reaction: does a
   volley follow within about a second, or only at the next 10 s mark after the cast? Trigger a second reaction 3 s later: no
   volley is expected. Volleys with no reactions would mean "regular basis" really is a plain 10 s timer. A volley within a
   second of the reaction is reading B; one only at the 10 s mark is reading A.
2. **Combo during Cosmovoice (U2).** Cast the ultimate without Vocalist Stance active, then let teammates cause a reaction:
   does her combo become available? (Data: yes.)
3. **Energy during Cosmovoice (U3).** Right after her ultimate, cast her combo (20 energy) a few seconds into Cosmovoice:
   does her ultimate gauge rise at once, or only after the stance ends (~15 s)? If it only rises later, the block is 15 s;
   if it rises at once, the block is the 1 s the file says.
4. **Actions during the stance (U4, R4, R5).** With Liino controlled in Vocalist Stance: (a) does a basic attack come
   out? (b) Within the first 3 s after the battle skill, can you cast End Stance or her combo, or does it wait until about
   3 s? (c) Right after her combo, can she basic attack?
5. **End Stance and "battle skill" effects (U6).** (a) After her combo (talent 2 active), cast End Stance: are SP returned?
   (b) With a Link stack from a teammate's combo, cast End Stance, then her battle skill: does the battle skill still get
   the Link bonus? (c) After End Stance from Vocalist, how long until the battle skill is castable? (Data: 3 s; the first
   report said 5.)
6. **Weapon stacks (R1, new).** Liino with Bedazzling Night Debut and three teammates at full HP. Cast her battle skill and
   watch for 15 s: does each teammate's ATK icon count up on its own, to 4 each? Does it count up while they're at full HP
   (does an overheal count as a heal)? How often does it rise (every 3 s soundwave, or only when the teammate is near her)?
