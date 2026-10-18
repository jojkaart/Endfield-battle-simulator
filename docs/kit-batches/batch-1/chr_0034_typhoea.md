# Typhoeus (chr_0034_typhoea): gap report, batch 1

With weapon `wpn_funnel_0019` (Umbra of Frigid Eventide) and gear set
`suit_spellburst` (Deep Rampart). Phase 1, analysis only.

Sources: rmxlinux `Json/SkillData/chr_0034_typhoea_*`, `Json/BuffData/buff_chr_0034_typhoea_*`,
`buff_common_natural_natural_triggered_typhoea`; `TableCfg/CharGrowthTable` (skill groups, talent nodes),
`CharacterPotentialTable`, `PotentialTalentEffectTable`, `SkillPatchTable` (values at level 12 / weapon
skill levels), `I18nTextTable_EN`; `WeaponBasicTable`, `EquipSuitTable`, `sk_wpn_funnel_0019`,
`buff_wpn_funnel_0019_*`, `passive_equipsuit_spellburst01`, `buff_equipsuit_spellburst_01*`. Dumps and
scripts: `scratchpad/batch1/scratch-chr_0034_typhoea/` (`out/*.txt` per file, `skilltypes_f.txt`,
`bufftypes_f.txt`). Kit claims (packages/data/kits/operators/chr_0034_typhoea.json) were re-checked;
where one was wrong it says so.

Element: Nature. Typhoeus applies **no** Nature Infliction herself (no enabled `SpellInfliction` in any
skill she casts; the descriptions never say she inflicts). She consumes teammates' Nature stacks and
forces her own Nature Bursts.

## Action types

Gameplay-relevant `$type`s per skill (cosmetic ones — effects, sound, camera, animation, root motion,
targeting selectors — left out; full lists in `skilltypes_f.txt`):

| Skill / buff | Types that matter | Affect |
|---|---|---|
| attack1–5, *_projhit | LaunchProjectile, DamageAction, SimpleCalcBB (÷2, ×0.35, ×0.13), ObtainCostAction (attack5_01 costType 1 `atb` 21: SP), AllowNextSkill, CreateBuff (attack3/5 per-target gates) | damage, SP, timing |
| power_attack (+projhit) | GainBreakingAttackAtb, BreakingAttackCalculation, DamageAction (literal 4 × atk_scale, mask 132), BlowOff | damage, SP; **finisher** |
| plunging_attack_start/end (+projhit) | DamageAction (mask 1152), ObtainCostAction (`atb`) | damage, SP; dive attack |
| normal_skill_floating_start | CreateBuff floatingmode (f0), LaunchProjectile ×2 volleys (f2–5, f7–10), ObtainUspInNormalSkill (f12–18, only if a volley arrow hit: `normal_start_hittimes`), ObtainCostAction `atb_return` (0), CastSkill floating_attack1 at f32 **only when not controlled**, CastSkill floating_loop f37 | damage, energy, state, timing |
| floating_attack1–4 | per shot at f1: CheckBuffStackNum arrow_num ≥ 1 → FinishBuffAdvanced 1 layer + `enhence_arrow`=1 (else consume a `passive_arrowrecover_exitfight` layer); LaunchProjectile floating_attack1_01_projhit; CastSkill floating_attack(N+1) at f22 **when not controlled**, else floating_loop; AllowNextSkill; TimeDilation all disabled | damage, state, timing |
| floating_attack5 | `atb_end`/`poise_end` = value × ABATK count (not passed on); controlled → `enhence_arrow`=1 without consuming (FinishBuff disabled); not controlled → `enhence_arrow`=0; FinishBuffAdvanced floatingmode; creates combo_trigger_combo | damage, SP, state |
| floating_attack1_01 / 5_01_projhit | IfElse on `enhence_arrow` and on Nature tag (-1411846745) ≥ 1: FinishBuffAdvanced **finishLayerCnt 1** (one stack), ObtainCostAction `usp_recover` (12 at lvl 12), CreateBuff arrow_energy_buffer_2 (+1 Sign), SimpleCalcBB `total_damage_rate` × `enchence_burst_damage_rate`, CreateBuff buff_common_natural_natural_triggered_typhoea (`damage_enhence`); DamageAction `atk_scale_base` (plain, tag 1208750764) or `atk_scale_total` (Power Shot, tag 959424907); 5_01 also creates normal_attack5_atb_recovered (SP `atb` 23) **only when controlled** | damage, energy, resources, state |
| combo_skill / combo_skillfloating | ObtainCostAction `usp` 10 (f35, CheckSquadInFight), CreateBuff common_func_arrowreload, **SetSkillCdAtOnce on the other combo (100%)**, TimeDilationAction 0.833 s (everyone but her and her spawns), floating: InheritBuff floatingmode, SwitchAction resets ABATK index | damage, energy, cooldown, timing |
| combo_01_projhit / 02 / persistentdamage | DamageAction (÷7), SpawnAbilityEntity array; array: AuraAction (enemy debuff), ChannelingAction 18 ticks (÷18) | damage, enemy debuff |
| ultimate_skillfloating | UltimateTimeAction (f0–62), CreateBuff floatingmode (if not hovering) or InheritBuff, CreateBuff arrow_num × `arrow_num_given` (f61), SpawnAbilityEntity arrowrain (f61), CastSkill floating_attackN at f89–92 **when not controlled** | damage, resources, state, timing |
| ultimate_skill_arrowrain / sub1 / sub2 | SimpleCalcBB × `potential_damge_up`, DamageAction (mask 4608), CreateBuff cause_subarrowrain (5 s), ChannelingActionV2 ticks | damage, triggered hits |
| ultimate_skill (unused: not in the ultimate group, kit claim confirmed) | — | — |
| archery_* (6 skills) | TyphoeaArchery*, LaunchProjectile, DamageAction | none: an activity minigame (only referenced by Activity*/Map tables), not combat |

Buffs: `floatingmode` (lifeType 1; ChangeSkillAction combo→combo_skillfloating; creates potential_atkup if
`potential_atkup`=1; ends on TagQueryListener (land/interrupt), CheckSkillInterruptReason, super-armour
break), `normal_skill_arrow_energy` (Signs, max 8, creates combo_trigger_combo at 8),
`normal_skill_arrow_num` (arrows, max 4), `arrow_energy_buffer_1/2/3` (each +1 Sign on add),
`common_func_arrowreload` (arrows = (Signs − 1) ÷ 2, then all Signs removed), `passive_arrowrecover`
(talent 1: enter-fight Signs, dungeon-category arrows, aura `passitive_enemy_listennaturalspellbrust` on
enemies: +1 Sign on any Nature-burst tag -1322688515), `combo_enemy_debuff` (DamageScaleProcessor
NormalCalcZone defender side, mask 33554432 = Arts Burst; SlowAction), `ultimate_skill_cause_subarrowrain`
(CheckDamageTag ABATK tags, `trigger_times` < 5, 0.2 s timer, sub1 ×4 then sub2),
`buff_common_natural_natural_triggered_typhoea` (TriggerSpellBurstEventAction spellBurstType 3,
ReadSkillSettingData 法术爆发伤害倍率 × `damage_enhence`, DamageAction mask 33554432, applyTags = the
standard Nature-burst tag), `talent_linken_sphere*` (defensive), `potential_atkup` (attr 2 formula 6).
Unused (not created by anything she casts, not attached by a talent): `normal_skill` (SP −10/s channel),
`normal_skill_naturalspellinflect` (enabled SpellInfliction, orphaned), `passive_spellbrust_*`,
`talent_2` / `talent_2_damageup` (old talent 2), `combo_skill_arrowrecover_speedup`.

## Mechanics

| # | Mechanic (source) | Status | Expressed by / missing |
|---|---|---|---|
| 1 | Basic attack 1–5 hits (attack1–5 + projhits; atk_scale ÷2, ×0.35, ×0.13; attack5 Final Strike mask 2097280, SP `atb` 21) | supported | hits with `factor`, frames, events; finalStrike from data; SP via skill `atb` |
| 2 | Frames, literal factors, event keys, combo `usp` grant are hand-written (kit-census: factor 16, frames 28, events 31, energy 2) | data | SkillData LaunchProjectile/SpawnAbilityEntity frames, SimpleCalcBB, ObtainCostAction (kit-abstractions §1) |
| 3 | Finisher = `power_attack` (desc "FINISHER: … near a Staggered enemy … recovers some SP"; GainBreakingAttackAtb, mask 132, atk_scale 9) | gap | kit models it as an ordinary basic castable any time; no stagger state (G1) |
| 4 | Dive attack = plunging_attack (desc "Basic attack performed in mid-air"; mask 1152) | gap | castable any time; no airborne state (G2, low) |
| 5 | Battle skill opening volley: 2 arrows × atk_scale×0.5 (normal_skill_attack1/2_projhit) | supported | hits arrow1/arrow2 |
| 6 | Battle skill team energy (ObtainUspInNormalSkill at f12–18, only if a volley arrow hit) | supported | engine grants natural-SP energy at the cast; only the timing/hit gate differs |
| 7 | Hovering state gates ABATKs and the floating combo (floatingmode; ChangeSkillAction) | supported | kit buff `hovering` + `availableWhile`; grounded combo lacks `unavailableWhile: hovering` (kit fix) |
| 8 | Hovering ends on the 5th ABATK (FinishBuffAdvanced floatingmode), on landing ~1 s after the last action (floating_loop 30 f → floating_end FinishBuff f8–14), on interruption; BuffData lifeType 1 (no fixed 10 s; kit claim "lasts 10 s" is the BuffData literal, not the behaviour) | gap | kit: fixed 10 s, never ended (G3) |
| 9 | ABATK chain 1→5 is an attempt counter (`EntityBB_floating_attack_index`), reset by combo_skillfloating and the ultimate | gap | chain order not enforced, never reset (G4) |
| 10 | Power Shot: consumes **1** Hunting Arrow at f1 if any; arrow deals atk_scale_base × atk_scale_enhence | gap | four one-arrow stacks `arrow_1`–`arrow_4`, shot N uses slot N (G5) |
| 11 | Plain ABATK (no arrow): atk_scale_base; on a Nature-inflicted target consumes 1 stack, +1 Sign, +`usp_recover` (12) energy (projhit failActions) | gap | no hit at all (kit note); needs a no-arrow variant (G5) and partial consumption (G7) |
| 12 | Power Shot forced Nature Burst: standard burst × `potential_damage_rate` (P5 1.1) × `enchence_burst_damage_rate` (1.3) if it consumed Nature | supported | reaction-type hit, `extraScale` with `enemyInfliction` (judged before its own consumption) |
| 13 | That burst is a real Arts Burst event (TriggerSpellBurstEventAction; standard Nature-burst tag) seen by talent 1, the weapon, the gear set and teammates' burst triggers | gap | reaction-type hits emit no `burst` StatusEvent (G6) |
| 14 | Power Shot / plain shot consume **one** Nature stack (FinishBuffAdvanced finishLayerCnt 1) | gap | `consumeInfliction` removes all stacks (G7) |
| 15 | +1 Sign per consumption (arrow_energy_buffer_2), not per stack | gap | kit `gains {consumed: true}` counts every stack consumed (G7) |
| 16 | `usp_recover` energy (12 at lvl 12) per consumption | supported | `energy: {if: {consumedAtLeast: 1}, then: "usp_recover"}` works on the consuming hit; kit doesn't use it yet (kit fix; its note says it can't) |
| 17 | 5th ABATK: controlled → Power Shot without an arrow, Final Strike, SP `atb` 23 (normal_attack5_atb_recovered); not controlled → plain shot, no SP | gap | no "controlled" predicate; kit always Power Shot (G8) |
| 18 | Battle skill / ultimate cast off-field auto-fire the ABATK chain (CastSkill floating_attack1 at f32 / f89–92 and N→N+1 at f22, CheckMainCharacterCondition fail branch) | gap | floating attacks are kind basic: need the controlled operator (G9) |
| 19 | Combo trigger at 8 Signs (arrow_energy maxStack 8 creates combo_trigger_combo) | supported | `comboTriggers stackAtLeast signs 8` |
| 20 | Combo converts Signs to arrows: (Signs − 1) ÷ 2 arrows, all Signs removed (common_func_arrowreload) | supported | requires signs ≥ 8 consume + gain 4; 8 Signs → 3.5 → 4 arrows in practice (bdf223: 4 Power Shots after the combo, t=12806–15033) |
| 21 | Combo hits: 7 arrows × atk_scale÷7, Barrage Array 18 ticks × atk_scale_persistent÷18 | supported | hits with factor/count/frames |
| 22 | Barrage Array: Nature Burst DMG taken + `persistent_naturalburst_increase` (P3 +0.06), any operator's bursts | supported | enemy buff, zone damageTaken, `onlyKinds: burst` |
| 23 | Combo `usp` 10 energy at f35 | supported | hit `energy` |
| 24 | The two combos share one cooldown (SetSkillCdAtOnce on the other, 100%) | gap | separate cooldowns (G10) |
| 25 | Combo time dilation 0.833 s on everyone but her (TimeDilationAction ignoreTargets self + spawns) | gap | not modelled (G11, shared) |
| 26 | Ultimate arrow rain main hit (atk_scale_main × potential_damge_up) | supported | hit `main` (unkeyed, see Verification) |
| 27 | Ultimate: enters/keeps Hovering, resets ABATK index, gives `arrow_num_given` arrows (2; P5 +1 → 3) | gap | gains slots arrow_1/2 only, P5's 3rd arrow lost (G5); reset (G4) |
| 28 | Hail of Arrows: next 5 ABATK hits within 5 s (cause_subarrowrain, CheckDamageTag, `trigger_times` < 5, 0.2 s timer) spawn sub1 (3 ticks × outer÷3) ×4, then sub2 (5 × center×0.08 + center×0.6) | gap | 17 hits without frames, landing at the ultimate's start (G12) |
| 29 | Ultimate time stop (UltimateTimeAction f0–62) | gap | not modelled (G11, shared) |
| 30 | Projectile travel (all her hits are projectiles; bursts log ~0.31–0.46 s after their arrow) | gap | launch frames used (G11) |
| 31 | P1: ABATK atk_scale_base ×1.2; Hovering ATK +18% (potential_atkup only created when the casting skill's `potential_atkup` = 1) | supported | skill-value potentials; buff `hovering_atk` via `min(atk_up, potential_atkup)` workaround; it should end with hovering (G3) |
| 32 | P1 / talent 2: Protective Barrier (damage reduction, super armour, shield CD) | supported | defensive only, no effect on output; not modelled |
| 33 | P2: Agility +20, Arts Intensity +16 | supported | panel |
| 34 | P3: combo cooldown −2 s (both combos), Barrage +6% | supported | skillParam / skillValue potentials |
| 35 | P4: ultimate cost ×0.85 | supported | skillParam |
| 36 | P5: Power Shot burst ×1.1, ultimate ×1.2, +1 arrow | supported (arrow: gap G5) | skillValue `set`/`add` |
| 37 | Talent 1: Power Shot ×`atk_scale_enhence` 1.2/1.4/1.6 | supported | skillValue `set` on floating_attack1–5 |
| 38 | Talent 1: +1 Sign whenever **any** Nature Burst triggers on an enemy (enemy aura listening for the burst tag; standard and her forced bursts both carry it) | gap | kit: +1 only on her own Power Shot bursts (G6, G13) |
| 39 | Talent 1: on entering battle +`energy_enterfight` Signs (1/2/4); 4 arrows at fight start in the listed dungeon categories; arrows kept across fights (`passive_arrowrecover_exitfight`) | gap | kit stacks start at 0 (G14) |
| 40 | Talent 1: max 4 arrows, 8 Signs | supported | stack `max` |
| 41 | Signs / arrows lifetime: BuffData duration `recover_time` 24 s but lifeType 1 (as on permanent passives) | unknown | kit: no expiry; test T1 |
| 42 | Burst ~0.33 s after its arrow (bdf223 Δ 315–337 ms; 0eef 331–371; d9e59 289–432) | unknown | where the delay comes from (projectile travel vs burst buff); test T2 |

**Weapon wpn_funnel_0019** (Umbra of Frigid Eventide; `weaponSkillList` wpn_attr_agi_high,
wpn_sp_attr_atk_high, sk_wpn_funnel_0019). Assessed as wielder-relative mechanisms.

| # | Mechanic (source) | Status | Expressed by / missing |
|---|---|---|---|
| W1 | Agility, ATK% (skills 1–2), Arts DMG +`spell_dmg_up` (skill 3; 44.8% at lvl 9, all four arts elements) | supported | stat panel (`efsim calc` shows them) |
| W2 | After the wielder **casts a battle skill** (passiveEventActions abilityEvent 30, CheckSkillType [2]): Arts Intensity +`phy_spell_up` for 15 s (buff_wpn_funnel_0019_intensityup, stackingType 4 refresh) | gap | weapons can only have always-on `conditions` (G15) |
| W3 | Same trigger: 4 layers of Windform for 15 s (burstup_layer, stackingType 2, max 4) | gap | no layered buff, no equipment trigger (G15, G16) |
| W4 | When the wielder applies an Arts Burst (abilityEvent 127, no element filter), Windform ≥ 1, at most once per 0.1 s (CreateTimedMarker): consume 1 Windform, gain a layer of Arts DMG +`spell_dmg_up2` (attrs 51–54) for 30 s, max 4, each with its own duration (stackingType 11) | gap | G6 (her bursts aren't events), G15, G16 |

**Gear set suit_spellburst** (Deep Rampart, 3 pieces → passive_equipsuit_spellburst01 level 1).

| # | Mechanic (source) | Status | Expressed by / missing |
|---|---|---|---|
| S1 | 3-piece: Arts DMG +16% | supported | stat panel |
| S2 | When the wearer applies a Nature or Cryo Burst (CheckSpellInflictionType mask 12), at most once per 0.1 s (AddGlobalCDTimer): Arts Intensity +16 for 20 s, max **3** layers (SkillPatch `max_stack` 3 passed by assignItems; the BuffData default 2 is overridden), each with its own duration (stackingType 2) | gap | no gear-set kit entries at all; G6, G15, G16 |
| S3 | Timed Arts Intensity buffs (W2, S2) also set the strength of statuses the wearer applies | gap | `timeline.ts artsIntensity()` reads only panel + condition modifiers, not timed buffs (G17) |

## Gaps

**G1 Finisher needs a Staggered enemy.** *family:* physical state. *feature:* a stagger state on the
enemy (poise from hits' `poise` values) and a skill availability predicate `enemyStaggered`; the
finisher zone (NOT_MODELLED) and its SP (GainBreakingAttackAtb). *evidence:* CharGrowthTable NormalAttack
desc "FINISHER: Basic attack performed near a Staggered enemy becomes a finisher"; power_attack
GainBreakingAttackAtb, power_attack_projhit mask 132, SkillPatch atk_scale 9. *impact:* a recorded
rotation can cast a 9× hit (42,544 per cast in `efsim calc` P5) at will; search doesn't (not a chain
step). Shared by every operator (all have finishers).

**G2 Dive attack needs mid-air.** *family:* skills (states). *feature:* plunging attacks only after a
jump/airborne state; low priority (rarely used). *evidence:* desc "DIVE ATTACK: Basic attack performed in
mid-air". *impact:* small; only recorded rotations.

**G3 Hovering ends on events, not after 10 s.** *family:* buff lifecycle. *feature:* `ends` on a kit
buff: ended by a hit/skill (5th ABATK frame 15), by an idle timeout (no next action within N frames:
floating_loop 30 f then floating_end), and lifeType-1 buffs having no duration; buffs created *by* the
state (P1 ATK, autoFinishByAction) end with it. *evidence:* floating_attack5 FinishBuffAdvanced
floatingmode; normal_skill_floating_loop CastSkill floating_end at f27–30; floating_end FinishBuffAdvanced
floatingmode f8–14; floatingmode lifeType 1, TagQueryListener → FinishBuff. *impact:* illegal actions
(ABATKs and the floating combo up to 10 s after the 5th shot, or after swapping away and back); P1 ATK
+18% on hits after hovering ended.

**G4 Skill chain as an attempt counter, reset by other skills.** *family:* skills (states). *feature:*
a kit-level chain state (next step index) that the timeline enforces (only the next step is castable
while the state is active) and that named skills reset (`resetsChain: floating` on
combo_skillfloating and ultimate_skillfloating). *evidence:* `EntityBB_floating_attack_index` set by each
floating_attackN, reset to 0 by normal_skill_floating_start, ultimate_skillfloating (f61),
combo_skillfloating SwitchAction; desc "her Aerial Basic Attack (ABATK) attempts are reset". *impact:*
recorded rotations can cast shots out of order; after a combo/ultimate the search can't start a new
1→5 run, so up to 4 ABATKs (and their Power Shots/bursts) are lost per reset.

**G5 Consume part of an own stack; a variant for "below N" at cast.** *family:* conditions + values.
*feature:* `requires` becomes a cast-time Predicate plus `consume: ValueExpr` (default all): e.g.
Power Shot hits `{stack: arrows, atLeast: 1, consume: 1}`, plain-shot hits `{stack: arrows, below: 1}`
judged at the cast, before any consumption by this cast. Then one `arrows` counter (max 4) replaces the
four slot stacks, and the ultimate's gain is `amount: "arrow_num_given"` (P5 3). *evidence:*
floating_attack1 f1 CheckBuffStackNum arrow_num ≥ 1 → FinishBuffAdvanced finishLayerCnt 1; ultimate
CreateBuff arrow_num count `arrow_num_given`; PotentialTalentEffectTable potential_5 `arrow_num_given` +1.
(Hit `if` can't do it: it's judged at landing, after `requires` already used the stack.) *impact:* no
plain shots at all (missing atk_scale_base 0.65–1.0 hits, their consumption, Sign and 12 energy); P5 loses
one Power Shot + burst per ultimate (~46k each at P5 in `efsim calc`); slots misbehave when a hover is cut
short.

**G6 Reaction-type hits emit their status event.** *family:* arts state. *feature:* a hit with
`reaction: {kind: burst}` pushes a `burst` StatusEvent (element, operator) into the same event list
`applyToEnemy` events go to, so comboTriggers `burst`, team triggers and equipment triggers see it; its
damage stays the kit hit's. *evidence:* buff_common_natural_natural_triggered_typhoea
TriggerSpellBurstEventAction spellBurstType 3 and the standard burst tag -1322688515; logs: weapon
spelldmgup layers and gear physpellup layers rise by one at each of her bursts (dbaee t=8391, 9860,
11237: 1→2→3 physpellup, 4→8→12 spelldmgup entries). *impact:* weapon W4 and gear S2 never fire for her;
teammates with burst triggers ignore her bursts.

**G7 Consume one infliction stack.** *family:* arts state. *feature:* `consumeInfliction` with
`stacks: n` (default all); the `consumed` event and `{consumed}` value report n; the infliction keeps
stacks − n (and its expiry). *evidence:* floating_attack1_01_projhit / 5_01_projhit FinishBuffAdvanced
finishLayerCnt 1 on the Nature tag; desc "consumes 1 stack of Nature Infliction". *impact:* with 2–4
teammate stacks the kit wipes them all (teammates' later reactions/bursts lose levels), gives N Signs
instead of 1, and later shots find no infliction (no ×1.3, no energy). Already listed in kit-abstractions
("Partial consumption").

**G8 "Controlled operator" predicate.** *family:* conditions. *feature:* Predicate `controlled`
(the hit's operator is the controlled one when the skill was cast), usable on hits, extraScale,
energy/SP, finalStrike. *evidence:* floating_attack5 CheckMainCharacterCondition → `enhence_arrow` 1/0;
floating_attack5_01_projhit creates normal_attack5_atb_recovered only when main character; desc "If
Typhoeus is the controlled operator, her 5th ABATK is regarded as a Final Strike and a Power Shot".
*impact:* matters once G9 exists (off-field chains): the 5th would wrongly be a Power Shot (~46k burst)
and give 23 SP.

**G9 Skills that cast follow-up skills.** *family:* skills (states). *feature:* a kit skill field
`casts: [{skill, frame, if}]` scheduling another kit skill on the same operator without control or input
(CastSkill), with `if: {not: controlled}`; casts that aren't the controlled operator's don't need control.
*evidence:* normal_skill_floating_start f32 CastSkill floating_attack1 (fail branch of
CheckMainCharacterCondition); floating_attack1–4 f22 CastSkill floating_attack(N+1) when not main
character; ultimate_skillfloating f89–92 CastSkill floating_attackN. *impact:* an off-field Typhoeus
(battle skill or ultimate, then swap) fires her ABATKs in game; the timeline can't (basic kind needs
control), so off-field rotations lose all ABATK/burst damage.

**G10 Shared cooldown.** *family:* skills (cooldowns). *feature:* `cooldownGroup` on skills (casting one
puts every member on its own cooldown). *evidence:* combo_skill SetSkillCdAtOnce combo_skillfloating
value 1.0 isPercentage, and the reverse in combo_skillfloating. *impact:* illegal actions: two combos
within one cooldown (the trigger needs 8 Signs, so rare, but legal after a Sign refill).

**G11 Timing: time dilation, ultimate time stop, projectile travel.** *family:* timing (shared,
owner decision). *evidence:* combo TimeDilationAction 0.833 s; ultimate UltimateTimeAction f0–62;
every hit is LaunchProjectile/SpawnAbilityEntity; burst Δ above. *impact:* her hits land early by
~0.1–0.4 s; teammates' timers keep running through her 2 s ultimate and combo slow.

**G12 Triggered hits from a buff.** *family:* triggers. *feature:* trigger `on: hit` by self with a
skill/tag filter (her ABATK hits) while a buff is active, `do: hits` (a kit hit group landing at
trigger frame + offsets), count limit 5 with the last different (`nth: 5 → sub2`), 0.2 s internal
cooldown, window 5 s from the arrow rain. *evidence:* buff_chr_0034_typhoea_ultimate_skill_cause_subarrowrain
(duration 5, CheckDamageTag 1208750764/959424907, trigger_times, timer 0.2 s, SpawnAbilityEntity sub1/sub2).
*impact:* 12 + 6 hits land at the ultimate's start instead of on the shots, before their buffs; they
happen even if no ABATK follows (overcount) or ≥5 shots don't fit in 5 s.

**G13 Trigger on any operator's burst.** *family:* triggers. *feature:* trigger `on: burst` (element
filter), `by: anyone`, `do: gains`, optionally once per frame across targets. *evidence:* talent 1 desc;
passive_arrowrecover AuraAction → enemy buff listennaturalspellbrust (CheckBuffIdInContextAdvanced tag
-1322688515) → arrow_energy_buffer_1/3 (+1 Sign); dbaee t=10341 a Lizhiyan Nature burst
(buff_common_natural_natural_triggered). *impact:* fewer Signs with Nature teammates (each teammate burst
is 1/8 of a combo).

**G14 Initial stack values.** *family:* values (+ scenario input). *feature:* `stacks[].initial`
(ValueExpr) able to name a talent's attached-buff blackboard value (`energy_enterfight` of
buff_chr_0034_typhoea_passive_arrowrecover via talent 1), plus scenario overrides (arrows 0–4: fight start
in a listed dungeon category = 4; carried-over arrows otherwise). ValueExpr today names only the
operator's own skills. *evidence:* PotentialTalentEffectTable talent_1_1/2/3 attachBuff blackboard
`energy_enterfight` 1/2/4; passive_arrowrecover CheckSquadInFight + CheckDungeonCategory → arrow_num ×4,
arrow_energy × `energy_enterfight`; bdf223/0eef: all four shots of the first hover are Power Shots.
*impact:* the first hover has no Power Shots (4 bursts, ~4 × 40k) and the first combo comes 4 Signs late.

**G15 Equipment triggers.** *family:* triggers (+ data compilation). *feature:* weapon and gear-set kit
entries with the same `triggers` as operators, relative to the wielder: `on: cast` (kind battle/ultimate/
combo, from CheckSkillType 2/7/6 on abilityEvent 30), `on: burst` by self (elements from
CheckSpellInflictionType mask), internal cooldown (CreateTimedMarker / AddGlobalCDTimer 0.1 s), `do`:
apply a self buff whose values are weapon/gear skill keys at the equipped skill level (ValueExpr
`{key, weaponSkill: 3}` / `{key, gearSet}`), consume N layers of another buff, as a precondition. A
gear-set kit file doesn't exist yet (kits/weapons.json only). kit-draft could compile these from
passiveEventActions. *evidence:* sk_wpn_funnel_0019 passiveEventActions; buff_equipsuit_spellburst_01
abilityEventAction. *impact:* Arts Intensity +56–98 for 15 s after each battle skill, Arts DMG up to
+4 × 6.4–11.2%, gear +16–48 Arts Intensity: all missing in the timeline (the log checker sees them
from logs). Large for her bursts (Arts Intensity scales burst damage).

**G16 Layered buffs.** *family:* buff lifecycle. *feature:* kit buffs with `maxStacks` (ValueExpr) and
stacking mode from BuffData stackingType: independent durations per layer (types 2, 11), refresh (4),
replace; `count` on application; consume N layers. Today `withBuff` keeps one instance per buff and
owner. *evidence:* buff_wpn_funnel_0019_burstup_layer (type 2, max 4), _spelldmgup (type 11, max 4),
buff_equipsuit_spellburst_01_physpellup (type 2, max_stack 3). *impact:* W3, W4, S2 can't be expressed
even with G15.

**G17 Status strength ignores timed Arts Intensity.** *family:* arts state. *feature:* the applier's
Arts Intensity at the hit (panel + conditions + active buffs) sets the strength of the statuses it
applies. *evidence:* timeline.ts `artsIntensity()` uses `ctx.modifiers` only, while burst damage uses
`buffModifiers`. *impact:* none for Typhoeus herself (she applies no statuses); wrong Corrosion/
Electrification strength for any wielder of W2/S2 that applies them.

**G18 Log checker stack caps from SkillPatch.** *family:* log tooling. *feature:* the log checker's cap
for buffs with `useMaxStackCntKey` should come from the value the skill passes (assignItems
`max_stack` 3 from SkillPatch), and stackingType 2 at the cap replaces the oldest (logs list 4 physpellup
entries at the moment a burst adds one: dbaee t=14084). Kit claim "BuffData caps it at max_stack 2, which
the log checker follows" is stale: logcheck.ts now leaves such buffs uncapped. *impact:* her burst event
key is still off; at least 7 bursts per log (most of her damage: dbaee check covers 16% of her damage)
stay unverified until re-checked.

## Verification

- **fixtures/zmdlogs-dbaee23b801d.json** (P1, weapon skills 9/9/4, 4-piece Deep Rampart, with Lizhiyan,
  Liino, Xaihi): current check 35 of 43 Typhoeus hits match, 0 mismatch; 7 bursts and the ultimate
  main hit not covered (16% of her damage). Checks: W2 (intensityup 56 = level 4 `phy_spell_up`), W4
  (spelldmgup 0.064, one layer per burst t=8391/9860/11237, 4 max), S2 (physpellup layers 1→2→3), G13
  (teammate Nature burst t=10341), Barrage debuff on bursts, ultimate main hit t=13975 (crit, matches).
- **fixtures/zmdlogs-bdf223db8e49.json** (P5, 9/9/9): every grounded basic attack, the volley, shots;
  4 Power Shots in the first hover (G14 start arrows) and 4 after the combo (row 20, 8 Signs → 4 arrows);
  burst delay Δ ≈ 0.33 s (row 42).
- **fixtures/zmdlogs-0eef2474a26f.json** (P5): same structure, shorter; burst Δ 331–371 ms.
- **fixtures/zmdlogs-d9e59d0fb737.json** (P0, parser v58): hovering from the ultimate only; the ABATKs
  there carry no intensityup, consistent with W2 firing on the battle skill cast only (floating attacks
  aren't "battle skill casts" although they're in the NormalSkill group). Its missing buffs (kit note:
  ×1.54–1.9 after t=9605, ultimate ×1.1585 at t=4415) are unexplained; Hail of Arrows sub2 (t=13829–14675)
  is only here.
- After G5–G7, G14, G15–G16: re-run `efsim zmdlogs check` and `zmdlogs reactions` on all four; key the
  burst (`buff_common_natural_natural_triggered_typhoea`) once G18 is fixed.

In-game tests (new; existing test 9 covers the ×1.3 burst):

- **T1 Hover and stack lifetime.** Battle skill, fire one ABATK, then do nothing: how long until she
  lands (expect ≈1 s)? Then, in combat, hold Signs/arrows for 30 s without acting: do they drop at 24 s?
- **T2 Burst delay.** Slow-motion clip of one Power Shot: is the burst number ~0.3 s after the arrow
  number? (Settles whether bursts need a delay or it's arrow travel.)
- **T3 One stack consumed.** A teammate applies 3 Nature stacks; one Power Shot: how many stacks remain on
  the enemy, how many Signs were gained (1 or 3)?
- **T4 Off-field ABATKs.** Cast her battle skill, swap away at once: does she fire 5 shots on her own,
  are shots with arrows Power Shots, and is the 5th a Power Shot without arrows?
- **T5 Teammate burst Signs.** With 0 Signs, have a Nature teammate trigger a Nature Burst (two Nature
  inflictions): does Typhoeus's Sign counter go up by 1?

## Summary

Counts (operator rows 1–42, weapon W1–W4, gear S1–S3; 49 rows; each row one
status; row 36's arrow part is G5) — supported 22, gap 24, data 1, unique? 0, unknown 2. Gaps: G1 physical state (finisher/
stagger), G2 skills/states (dive), G3 buff lifecycle (state ends), G4 skills/states (chain counter
and reset), G5 conditions + values (partial own-stack consumption, cast-time "below"), G6 arts state
(burst event from reaction hits), G7 arts state (consume one infliction stack), G8 conditions
(controlled), G9 skills (follow-up casts), G10 skills/cooldowns (shared cooldown), G11 timing (dilation,
time stop, projectile travel), G12 triggers (hits triggered by own hits under a buff), G13 triggers
(on anyone's burst), G14 values (initial stacks from talent blackboard), G15 triggers + data
compilation (equipment triggers, gear-set kits), G16 buff lifecycle (layered buffs), G17 arts state
(status strength with timed AI), G18 log tooling (SkillPatch stack caps). Nothing looks unique: the
mechanisms are the shared families of kit-abstractions §2.
