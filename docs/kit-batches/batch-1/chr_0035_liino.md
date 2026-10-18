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
