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

## Re-analysis (pass 2, 2026-10-18)

Against the engine and kit format at b33e2e7 (schemas/kit.schema.json, equipment-kit.schema.json,
engine `events.ts`, `timeline.ts`, `buffs.ts`), `efsim kit-draft chr_0034_typhoea` (v2) and the
`KNOWN` list in packages/data/test/skillCompile.test.ts. First-round facts were re-checked against
rmxlinux SkillData / BuffData / SkillPatchTable / PotentialTalentEffectTable and the fixtures;
corrections and new facts first.

### Claims re-checked, and new facts

- **Finisher scale (row 3, G1 corrected).** power_attack_projhit's damage unit has a literal
  `atkScale` 4 (`useBlackboardKey` false), but its `atkCalculation` is BreakingAttackCalculation
  `atk_scale` × multiplier 1.0, and that's the one that counts: every operator's finisher splits
  `atk_scale` (9 at every level) over its units by multipliers summing to 1 (Endministrator
  0.1 + 0.9, Chen 0.8 + 0.2, …). So 9 × ATK × the enemy's finisher multiplier; kit-draft's
  `atk_scale` is right, the first round's "literal 4 × atk_scale" was wrong.
- **Combo conversion (row 20) confirmed.** common_func_arrowreload: arrows = (Signs − 1) ÷ 2 =
  3.5 at 8 Signs, then all Signs removed. fixtures/zmdlogs-bdf223db8e49.json: after the floating
  combo (arrows 12171), shots 1–4 (12806, 13499, 14025, 14699) all burst (13143, 13813, 14487,
  15033) and the 5th too (15597 → 16303), so the count rounds to 4. The first hover (8490–10464)
  also has 4 bursts: 4 starting arrows (G14).
- **Off-field 5th ABATK.** Not controlled, floating_attack5 launches floating_attack1_01_projhit
  with `enhence_arrow` 0 whether or not she has arrows: a plain shot (`atk_scale_base`, mask 128:
  no Final Strike, no burst, no SP), no arrow used; it still consumes 1 Nature stack for a Sign
  and `usp_recover` (kit-draft branches of floating_attack5).
- **New: the floating combo continues the chain off-field.** combo_skillfloating casts
  floating_attack1 at frame 57 when she isn't controlled, and floating_loop at 67 (kit-draft
  note).
- **Off-field cadence** (kit-draft casts): first shot at 32 (battle skill), 57 (floating combo),
  89 (ultimate); next shot cast at 22 of shots 1–2, 23 of shot 3, 35 of shot 4. Off-field shots
  jump at frame 0 to another section (distance ≥ 12 m → 45, 4–12 m → 75; attack4 150 / 300); each
  section keeps the same offsets (shot 1 frame after the jump, next cast 21–22 after it), so
  section 0's frames are right as long as jumps are instant (Ti3).
- **Hover end, from the data (G3).** Controlled with no next input, a shot casts floating_loop
  at frame 22 (shots 1–3; shot 4 at 35); floating_loop (30 frames) casts floating_end at 27; its
  frames 8–14 end floatingmode: about 57 frames (1.9 s) after the last shot's cast. Battle skill:
  loop at 37; floating combo at 67; ultimate at 89 (if hovering). The 5th shot ends it at frame
  15. floatingmode is created with `autoFinishByAction` / `finishWithNextSkillIfNotInherited` and
  an inherit list of the floating skills and the floating combo, so casting anything else
  (grounded attacks, finisher) ends it too. Its 10 s is the ChangeSkillAction's (lifeTimeType 2),
  and that swap of the combo slot to combo_skillfloating happens only when she's controlled as the
  hover starts (CheckMainCharacterCondition in floatingmode buffEvent 5).
- **New: combo trigger pulses at hover end.** buff_chr_0034_typhoea_combo_trigger_combo (0.2 s,
  no actions: a native trigger marker) is created by arrow_energy whenever a Sign is added at 8,
  and also unconditionally at floating_attack5 frame 20, floating_attack4 frame 58 and
  floating_end frame 21. Whether these re-open the window when Signs are at 8 (e.g. after the
  combo came off cooldown) is unknown (test T6).
- **Hail of Arrows logic** (buff_chr_0034_typhoea_ultimate_skill_cause_subarrowrain, 5 s; compare
  codes 0 <, 3 ≥, 4 = as skillCompile decodes them). On her damage carrying an ABATK arrow tag
  (1208750764 plain, 959424907 Power Shot) while `trigger_times` < 5: if the 0.2 s
  `_timer` buff is off, +1, timer on, spawn sub1 (count < 5) or sub2 (count = 5); if the timer is
  on, spawn without counting (another target of the same arrow). One enemy: one rain per shot, the
  5th counted shot gives sub2. Rains are spawned at the hit: sub1 3 ticks at +6, +9, +12 (mask 512);
  sub2 5 ticks at +6, +8, +10, +11, +13 and the blast at +30 (mask 4608). Bursts carry no arrow tag.
- **Ultimate main hit** lands at frame 62 (spawn 61 + entity frame 1), logged as
  `chr_0034_typhoea_ultimate_skill_arrowrain` (2× in the fixtures; kit: 61, no key; `KNOWN`).
- **Battle-skill team energy (row 6).** It's `ObtainUspInNormalSkill` at frame 12 (window 12–18),
  only if a volley arrow hit (buff normal_start_hittimes), not the buff_common_obtain_ultimate_sp
  kit-draft looks for, so the draft has no `teamEnergyFrame`. The same action is in
  chr_0028_wulfa_normal_skill.
- **Sign sources** each have a 0.2 s adding cooldown (arrow_energy_buffer_1/2/3
  `hasAddingCooldown`): buffer_2 is the consumption Sign, buffer_1/3 the talent's burst Sign
  (which of the two depends on a tag; same effect).
- **Gear set target.** physpellup's CreateBuff has a CharacterTeamFinder + ExcludeOwner selector,
  but `targetSource` 4 (owner) and the text says "the wearer gains": wearer only, as the logs show.
- **Weapon durations** are BuffData's (Windform 15 s, spelldmgup 30 s, max 4): the skill's
  `wind_duration` / `spell_dmg_duration` / `spell_dmg_max_stack` aren't passed; `wind_grant` (4)
  is the CreateBuff count, `phy_spell_up` and `spell_dmg_up2` are passed.
- **Poise.** Damage units with `damageAttributeType` 1 (`poiseCalculation` key `poise`): attack5
  (17, `onlyEnableForMainChar`), floating_attack5 (20, main character only), combo_01_projhit
  (10), ultimate_skill_arrowrain (20). kit-draft skips them (skillCompile.ts: "1 = poise").
- **Fight start** (passive_arrowrecover): Signs = `energy_enterfight` (talent 1 attachBuff 1/2/4;
  the BuffData 6 is overridden); arrows = those held when the last fight ended
  (passive_arrowrecover_exitfight layers), or 4 in the listed dungeon categories (boss rush,
  resource, high difficulty, …). An ABATK with no arrow but an exitfight layer is still a Power
  Shot; that only happens out of a fight.

### 1. First-round rows now

| First round | Now | How (fields), or what's missing |
|---|---|---|
| Row 2 (data): frames, factors, keys, energy hand-written | supported | kit-draft v2 compiles them (frames, `factor`, `events`, `energy` usp / usp_recover, `sp`, `detached`, `finalStrike`, `consumeInfliction stacks 1`); `KNOWN` covers attack3's gate (kit right: one arrow per wave) and the jump sections. Still hand-written: `poise`, the battle skill's `teamEnergyFrame` (R3) |
| Row 3, G1 finisher | supported | P2: skillSpecification 8 → only on a Staggered enemy, once per stagger, × the enemy's finisher multiplier, finisher SP. Hit: power_attack_projhit at 38, `atk_scale` (see above). Stagger needs `poise` on her hits (R3) |
| Row 4, G2 dive attack | gap | R5 |
| Row 6 battle-skill team energy | supported | `teamEnergyFrame: 12`, hand-written (R3) |
| Row 7 grounded combo while hovering (kit fix) | supported | `available` Predicate (below) |
| Row 8, G3 hover ends | partly | 5th shot, grounded casts, until-ended buff, P1 ATK ending with it: cast triggers with `delay`, `endBuff`, `buffEnded`. The idle end (loop → end, 1.9 s) needs R1 |
| Row 9, G4 attempt counter and resets | supported | stack `abatk` (0–5), `available: {stack, atLeast, below}`, `chainStep: false`, resets as gains of −5 (negative gains floor at 0) |
| Row 10, G5 one arrow per Power Shot | supported | one `arrows` stack (max 4), `requires: {stack: arrows, atLeast: 1, consume: 1}` |
| Row 11 plain ABATK | supported | a hit with `requires: {stack: arrows, below: 1}`, `consumeInfliction stacks 1`, Sign and energy `if: {consumedAtLeast: 1}` |
| Row 13, G6 burst is an event | supported | A3: a `reaction: burst` hit emits a burst status event |
| Row 14, G7 one Nature stack | supported | `consumeInfliction` `stacks: 1` (A2) |
| Row 15 one Sign per consumption | supported | `gains: [{stack: signs, if: {consumedAtLeast: 1}}]` |
| Row 16 `usp_recover` (kit error) | supported | `energy: {if: {consumedAtLeast: 1}, then: "usp_recover"}` |
| Row 17, G8 controlled 5th | supported | hit `if: {controlled: true}` (judged at the cast) and its `not` |
| Row 18, G9 off-field ABATKs | supported | trigger action `cast` on delayed cast triggers, `if: {not: {controlled: true}}` |
| Row 20 conversion (claim) | supported, re-checked | gain arrows `{product: [{stackCount: signs}, 0.5]}` (= 4), signs −8 |
| Row 24, G10 shared combo cooldown | supported | `cooldownGroup` |
| Rows 25, 29, G11 combo slow-down, ultimate time stop | supported | Ti1 reads them from SkillData (combo 25 frames at 0.01, ultimate 62 frames stopped); nothing in the kit |
| Row 30, G11 projectile travel | gap | R4 |
| Row 27 ultimate: hover, reset, `arrow_num_given` | supported | gain `arrow_num_given` (P5 → 3), abatk −5, hovering buff |
| Row 28, G12 Hail of Arrows | supported (caveat R2) | `on: hit` trigger with `hits`, a `hail` counter stack, `cooldown: 0.2` |
| Row 31 P1 ATK ends with hovering | supported | no duration, `buffEnded hovering` → `endBuff` |
| Row 36 P5 3rd arrow | supported | the gain's `amount` is the value |
| Row 38, G13 Sign on anyone's Nature burst | supported | `on: burst, elements: [natural], by: anyone`, `cooldown: 0.2` |
| Row 39, G14 starting Signs and arrows | supported | `stacks[].initial` with `{key, skill}`; scenario `startStacks` |
| Row 41 Sign / arrow lifetime | unknown | still T1 (24 s duration with lifeType 1) |
| Row 42 burst ~0.33 s after the arrow | unknown | T2; R4 |
| W2 Arts Intensity on battle-skill cast | supported | equipment trigger `on: cast, kinds: [battle]` → buff (attr 87) |
| W3 Windform layers | supported | equipment stack + timer buff (or layered buff) |
| W4 Arts DMG layers on her bursts | supported | `on: burst, by: self`, `if` Windform, `cooldown: 0.1`, `maxStacks: 4` |
| S2 Arts Intensity layers on Nature / Cryo bursts | supported | `on: burst, elements: [natural, cryst]`, `maxStacks` from `max_stack` (3) |
| S3, G17 status strength with timed AI | supported | `artsIntensity()` now reads active buffs |
| G18 log stack caps | supported | L1 (useMaxStackCntKey caps from the team's sources): the burst can take its event key |
| New: off-field floating combo chain | supported | delayed cast trigger at 57 |
| New: combo slot swap only if controlled at hover start | supported | a 10 s state buff applied `if: {controlled: true}`, gating the two combos |
| New: combo pulses at hover end | unknown | T6; once known, delayed cast triggers `openCombo` `if: {stack: signs, atLeast: 8}` |
| New: poise values | data | hand-written `poise` / `poiseControlledOnly` (R3) |

### 2. Remaining gaps

**R1 A skill's delayed effects end with the skill.** *family:* skills (timing). *feature:* the
pending actions of a `delay`ed trigger on `on: cast` with `skills` are dropped when that cast
ends early (the operator starts another skill, or a `cast` action ends it), as non-detached hits
already are: either always, or opt-in (`endsWithCast: true`). Equivalent alternative: a Predicate
`casting: <skillId>` (the operator's current skill is still that cast). *evidence:* SkillData
timeline actions stop with their skill: floating_attack1–3 frame 22 / floating_attack4 frame 35
CastSkill floating_loop (controlled) only run if the player gave no next input in the 18–25 /
28–42 window; floating_loop frame 27 → floating_end; floating_start frame 37. timeline.ts keeps
`pendingActions` through interrupts (castSkill filters only `pending` hits). The S1 pattern
("a skill's effects at frames are its own delayed cast triggers") has the same problem for every
kit that uses it. *impact:* hovering can't end by idling: after a hover cut short (no 5th shot),
ABATKs and the floating combo stay castable, P1's ATK +18% stays on, and the attempt counter isn't
reset, until something else ends it. Writing the loop anyway would cast floating_loop over the
player's next shot. Illegal actions in recorded rotations and search; P1 builds' damage after a
short hover.

**R2 Hit triggers filtered by skill or hit.** *family:* triggers. *feature:* `on: hit` takes
`skills` (skill IDs, as `on: cast` does) and/or `reaction: false` (only non-reaction hits), so a
trigger can react to some skills' own damage. *evidence:* cause_subarrowrain reacts to the ABATK
arrow damage tags only (1208750764, 959424907), not to the bursts (standard Nature-burst tag);
timeline.ts emits a `hit` event of kind basic for her `reaction: burst` hits too. *impact:* none
today: the burst lands with its arrow and the trigger's 0.2 s cooldown (the data's timer) drops
the second event. Once bursts land later than their arrows (R4, T2: 0.29–0.46 s), each Power
Shot would trigger two rains, and the 5-rain count would end after 3 shots: Hail of Arrows hits
on the wrong shots, and the empowered rain early.

**R3 kit-draft: poise and ObtainUspInNormalSkill.** *family:* data compilation. *feature:*
compile damage units of `damageAttributeType` 1 into the landing's `poise` (`poiseCalculation`
key) and `poiseControlledOnly` (`onlyEnableForMainChar`), and treat `ObtainUspInNormalSkill`
(with its frame and gate) as the team-energy frame like buff_common_obtain_ultimate_sp.
*evidence:* attack5_01/02_projhit, floating_attack5_01/02_projhit, combo_01_projhit,
ultimate_skill_arrowrain poise units; normal_skill_floating_start frames 12–18 (also
chr_0028_wulfa_normal_skill). *impact:* none once hand-written (values above); without them her
kit deals no stagger (finishers never come from her hits) and the team's battle-skill energy
comes 12 frames early. Every kit needs poise.

**R4 Projectile travel (Ti2), burst delay.** *family:* timing. *feature:* as batch-1 Ti2: hits
dealt by projectiles land after a travel time; for her, whether the forced burst's ~0.33 s is
travel of the arrow or a delay of the burst buff (T2). *evidence:* every hit of hers is a
LaunchProjectile / SpawnAbilityEntity; burst Δ 289–432 ms after the arrow in bdf223, 0eef, d9e59.
*impact:* her hits land 0.1–0.4 s early: buff windows (Windform, physpellup, teammates' timed
buffs) and the Hail of Arrows' 5 s are judged at the wrong moment; small damage effect, log
checks tolerate it.

**R5 Airborne state for dive attacks.** *family:* skills (states). *feature:* plunging attacks
castable only mid-air (after a jump, which rotations don't have yet). *evidence:* CharGrowthTable
"DIVE ATTACK: Basic attack performed in mid-air"; plunging_attack_start/end (skillSpecification
6). *impact:* small: until then the kit should leave plunging_attack_end out, so it can't be cast
at will (shared by every operator).

Checked against [kit-unique.md](../../kit-unique.md): none is unique (R1, R2 are general
trigger/skill mechanisms, R3–R5 apply to every operator).

### 3. Kit plan

IDs below drop the `chr_0034_typhoea_` prefix. Values are the skills' own keys unless named.

**Stacks**

- `signs` max 8 (arrow_energy), `initial: {key: "energy_enterfight", skill:
  "buff_chr_0034_typhoea_passive_arrowrecover"}` (1 / 2 / 4).
- `arrows` max 4 (arrow_num), `initial: 4` (listed dungeon categories, which is where
  benchmarks and the fixtures are; a scenario's `startStacks` for other fights). Replaces
  `arrow_1`–`arrow_4`.
- `abatk` max 5: the attempt index (EntityBB_floating_attack_index).
- `hail` max 5: Hail of Arrows left (5 − `trigger_times`).

**Buffs**

- `hovering` (floatingmode): self, no duration, no modifiers.
- `hovering_atk` (potential_atkup): self, no duration, `atk` `{key: "atk_up", skill:
  "normal_skill_floating_start"}` (0.18 from P1; the ultimate's is the same).
- `combo_swap`: self, 10 s, no modifiers (the ChangeSkillAction).
- `barrage_array`: as now (enemy, `persistent_time`, damageTaken `persistent_naturalburst_increase`,
  `onlyKinds: [burst]`).
- `hail_window`: self, 5 s (cause_subarrowrain).

**Triggers** (all `by: self` unless said)

1. `combo_window`: as now (`stackAtLeast signs 8` → `openCombo`).
2. `talent_sign`: `on: {event: burst, elements: [natural]}`, `by: anyone`, `cooldown: 0.2` →
   gain `signs` 1 (talent 1; passitive_enemy_listennaturalspellbrust).
3. `hover_start`: `on: cast`, `skills: [normal_skill_floating_start, ultimate_skillfloating]` →
   buff `hovering`; buff `hovering_atk` `if: {potentialAtLeast: 1}`; buff `combo_swap`
   `if: {controlled: true}`; and for the battle skill only (a second trigger) gain `abatk` −5.
4. `ult_rain`: `on: cast`, `skills: [ultimate_skillfloating]`, `delay: 61`,
   `skill: ultimate_skillfloating` → gain `arrows` `arrow_num_given`; gain `abatk` −5; gain `hail`
   −5 then +5; buff `hail_window`.
5. `hail_end`: `on: {event: buffEnded, buff: hail_window}` → gain `hail` −5.
6. `hail_of_arrows` (R2 caveat):

   ```json
   {"id": "hail_of_arrows", "on": {"event": "hit", "kinds": ["basic"]}, "by": "self",
    "if": {"all": [{"buffActive": "hail_window"}, {"buffActive": "hovering"}, {"stack": "hail", "atLeast": 1}]},
    "cooldown": 0.2, "skill": "chr_0034_typhoea_ultimate_skillfloating",
    "do": [
      {"kind": "hits", "if": {"stack": "hail", "atLeast": 2}, "hits": [
        {"id": "sub_rain", "damageType": "ultimate", "scale": ["atk_scale_outer", "potential_damge_up"],
         "factor": 0.3333333333333333, "count": 3, "frames": [6, 9, 12], "detached": true,
         "events": ["chr_0034_typhoea_ultimate_skill_arrowrain_sub1"]}]},
      {"kind": "hits", "if": {"stack": "hail", "below": 2}, "hits": [
        {"id": "final_tick", "damageType": "ultimate", "scale": ["atk_scale_center", "potential_damge_up"],
         "factor": 0.08, "count": 5, "frames": [6, 8, 10, 11, 13], "detached": true,
         "events": ["chr_0034_typhoea_ultimate_skill_arrowrain_sub2"]},
        {"id": "final_blast", "damageType": "ultimate", "scale": ["atk_scale_center", "potential_damge_up"],
         "factor": 0.6, "frames": [30], "detached": true,
         "events": ["chr_0034_typhoea_ultimate_skill_arrowrain_sub2"]}]},
      {"kind": "gain", "gains": [{"stack": "hail", "amount": -1}]}]}
   ```
7. `abatk_step`: `on: cast`, `skills: [floating_attack1 … floating_attack5]` → gain `abatk` 1.
8. Off-field chain, each `do: [{kind: "cast", skill: <next>, if: {not: {controlled: true}}}]`:
   floating_start `delay: 32` → floating_attack1; combo_skillfloating 57 → floating_attack1;
   ultimate_skillfloating 89 → floating_attack1; floating_attack1 22 → 2; floating_attack2 22 → 3;
   floating_attack3 23 → 4; floating_attack4 35 → 5.
9. `hover_end_fifth`: `on: cast`, `skills: [floating_attack5]`, `delay: 15` → `endBuff hovering`.
10. `hover_end_grounded`: `on: cast`, `skills: [attack1, power_attack, combo_skill]` →
    `endBuff hovering` (the inherit list).
11. `hover_ended`: `on: {event: buffEnded, buff: hovering}` → `endBuff hovering_atk`,
    `endBuff combo_swap`, gain `abatk` −5 (floating_end resets the index).
12. `conversion` (or as gains on the combos' first arrow, frame 35): `on: cast`, `skills:
    [combo_skill, combo_skillfloating]`, `delay: 35` → gain `arrows` `{product: [{stackCount:
    "signs"}, 0.5]}`, then gain `signs` −8. The floating combo also gains `abatk` −5 at its cast
    (SwitchAction; frame to read from SkillData).
13. After R1: idle end. `cast floating_loop` `if: {controlled: true}` at floating_attack1–3 22,
    floating_attack4 35, floating_start 37, combo_skillfloating 67, ultimate_skillfloating 89
    (also `buffActive: hovering`); floating_loop 27 → `cast floating_end`; floating_end 8 →
    `endBuff hovering`. floating_loop and floating_end become hitless kit skills.
14. After T6, if confirmed: floating_attack5 20, floating_attack4 58, floating_end 21 →
    `openCombo` `if: {stack: signs, atLeast: 8}`.

**Skills, hit by hit** (frames, factors, keys from kit-draft v2; `detached` on every projectile
or entity hit)

- attack1: ×2 `atk_scale` × 0.5 at 5, 8 (attack1_01_projhit). attack2: `atk_scale` at 9
  (attack1_01_projhit). attack3: × 0.5 at 5 (attack3_01_projhit) and at 14 (attack3_02_projhit),
  one landing each (the damagetaken gate; `KNOWN`). attack4: × 0.35 at 5; ×5 × 0.13 at 15, 18,
  21, 24, 27. attack5: `atk_scale` at 22, events [attack5_01_projhit, attack5_02_projhit], `sp:
  "atb"` (21), Final Strike from the data, `poise: "poise"`, `poiseControlledOnly: true`.
  attack1 `available: {not: {buffActive: hovering}}`.
- power_attack (finisher, specification 8): power_attack_projhit `atk_scale` at 38 (on reach).
- plunging_attack_end: leave out (R5).
- normal_skill_floating_start (battle): ×0.5 at 2 (normal_skill_attack1_projhit), ×0.5 at 7
  (normal_skill_attack2_projhit); `teamEnergyFrame: 12`; triggers 3, 8, 13.
- floating_attack1–4 (basic, `chainStep: false`, `available: {all: [{buffActive: hovering},
  {stack: abatk, atLeast: N−1, below: N}]}`), each with its own values (all equal):
  - `power_shot` at 1: [`atk_scale_base`, `atk_scale_enhence`], events [floating_attack1_01_projhit],
    `requires: {stack: arrows, atLeast: 1, consume: 1}`;
  - `burst` at 1: `reaction: {kind: burst, element: natural}`, scale [`potential_damage_rate`],
    events [buff_common_natural_natural_triggered_typhoea] (now checkable, G18), same `requires`,
    `applies: [{kind: consumeInfliction, elements: [natural], stacks: 1}]`, `gains: [{stack: signs,
    if: {consumedAtLeast: 1}}]`, `energy: {if: {consumedAtLeast: 1}, then: "usp_recover"}`,
    `extraScale: [{value: "enchence_burst_damage_rate", if: {consumedAtLeast: 1}}]`, `finalStrike:
    false`; the burst's own Sign comes from trigger 2;
  - `plain_shot` at 1: [`atk_scale_base`], events [floating_attack1_01_projhit], `requires: {stack:
    arrows, below: 1}`, the same consumption, Sign and energy.
- floating_attack5 (basic, `available` as above with abatk 4–5): `power_shot` at 0
  ([`atk_scale_base`, `atk_scale_enhence`], floating_attack5_01_projhit, `if: {controlled: true}`,
  `sp: "atb"` (23), `poise: "poise"`, `poiseControlledOnly: true`); `burst` at 0 as above with `if:
  {controlled: true}` and no `requires`; `plain_shot` at 0 ([`atk_scale_base`],
  floating_attack1_01_projhit, `if: {not: {controlled: true}}`, consumption, Sign, energy,
  `finalStrike: false`). Triggers 9, 14.
- combo_skill (`available: {not: {all: [{buffActive: hovering}, {buffActive: combo_swap}]}}`) and
  combo_skillfloating (`available: {all: [{buffActive: hovering}, {buffActive: combo_swap}]}`),
  both `cooldownGroup: "combo"`: first arrow `atk_scale` ÷ 7 at 35 (combo_01_projhit), `energy:
  "usp"`, `poise: "poise"`, buff `barrage_array`; ×6 ÷ 7 at 40, 43, 44, 45, 47, 49 (floating: 39,
  …); array ×18 `atk_scale_persistent` ÷ 18 at 35, 45, … 205 (combo_persistentdamage). Floating
  combo: triggers 8, 12, 13.
- ultimate_skillfloating: main at 62, [`atk_scale_main`, `potential_damge_up`], events
  [ultimate_skill_arrowrain], `poise: "poise"`; the Hail of Arrows hits move to trigger 6.
  Triggers 3, 4, 8, 13.

**wpn_funnel_0019.json** (values `{key, skill: "sk_wpn_funnel_0019"}` at the weapon's skill
level)

- stack `wpn_funnel_0019.windform` max 4; buffs `intensityup` (self, 15 s, attr 87
  `phy_spell_up`, gameBuff buff_wpn_funnel_0019_intensityup), `windform_timer` (self, 15 s),
  `spelldmgup` (self, 30 s, `maxStacks: 4`, attrs 51–54 `spell_dmg_up2`).
- triggers (`by: self`, the wielder): `on: {event: cast, kinds: [battle]}` → buff `intensityup`, gain `windform`
  `wind_grant`, buff `windform_timer` (all four layers are granted together and the 4th replaces
  the oldest, so one timer is exact); `on: buffEnded windform_timer` → gain `windform` −4;
  `on: {event: burst}`, `if: {stack: windform, atLeast: 1}`, `cooldown: 0.1` → gain `windform` −1,
  buff `spelldmgup`.

**suit_spellburst.json** (values `{key, skill: "passive_equipsuit_spellburst01"}`)

- buff `physpellup` (self, duration `duration` (20), `maxStacks: max_stack` (3), attr 87
  `phy_spell_up` (16), gameBuff buff_equipsuit_spellburst_01_physpellup).
- trigger `on: {event: burst, elements: [natural, cryst]}`, `by: self`, `cooldown: 0.1` → buff
  `physpellup`.

Static parts (weapon Agility, ATK %, Arts DMG; set Arts DMG +16 %) stay in the stat panel.

**Verification after the rewrite:** `efsim zmdlogs check` and `zmdlogs reactions` on dbaee23b801d
(weapon W2/W4, set S2, a teammate's Nature burst at t=10341, ultimate main hit t=13975),
bdf223db8e49 and 0eef2474a26f (starting arrows, conversion, off-field-free hovers), d9e59d0fb737
(Hail of Arrows sub2 t=13829–14675; its unexplained ×1.54–1.9 and ×1.1585 remain).

### 4. In-game tests for what's still unknown

- **T1 Hover idle end and stack lifetime** (R1, row 41). Battle skill, one ABATK, then nothing:
  does she land about 2 s after that shot (data: ~1.9 s)? In a fight, hold Signs and arrows for
  30 s without using them: do they drop at 24 s?
- **T2 Burst delay** (R4, R2). Slow-motion clip of one Power Shot: is the burst number ~0.3 s after
  the arrow's, and does the delay change with distance (travel) or not (a burst delay)?
- **T4 Off-field ABATKs** (extended). Battle skill, swap away at once: five shots on her own, shots
  with arrows Power Shots, the 5th a plain shot (no burst number) even with arrows left? Same after
  an off-field floating combo.
- **T5 Teammate burst Signs.** With few Signs, a Nature teammate triggers a Nature Burst: +1 Sign?
- **T6 Combo window at hover end** (new). Reach 8 Signs while the combo is on cooldown, keep
  hovering until it's off cooldown, then let the hover end (5th shot): does the combo become
  available without another Sign?
- **T7 Hail of Arrows count** (optional). Ultimate, then five ABATKs within 5 s: four normal rains
  and an empowered one on the 5th? Land early and attack on the ground within the 5 s: no rains?

T3 (one stack consumed) is settled by the data (finishLayerCnt 1) and can be skipped.

**Summary:** of the first round's 18 gaps, 15 are now expressible (G1, G4–G10, G12–G18); G3
(idle end) and G11 (projectile travel) only partly; G2 not at all. Open: 5 gaps (R1 a skill's delayed
effects ending with it, R2 hit triggers by skill, R3 kit-draft poise and ObtainUspInNormalSkill,
R4 projectile travel, R5 airborne for dive attacks) and 2 unknowns (stack lifetime T1, combo pulse
at hover end T6).

## Re-analysis (pass 3, 2026-10-18)

Against the engine at 86a701f (events.ts, model.ts, expr.ts, timeline.ts, packages/data kits.ts,
both schemas) and `efsim kit-draft chr_0034_typhoea` at that commit. Facts re-checked in rmxlinux
SkillData (timeline actions by `_startFrame`) and the loaded SkillTiming (windows, durations).

**Corrections and new facts**

- **Shot 4 has no loop (pass 2 was wrong).** floating_attack4 casts floating_attack5 at frame 35
  only when not controlled; when controlled, timeline action 40 (frame 45) is
  CheckMainCharacterCondition → FinishBuffAdvanced floatingmode + index reset. Idle hover ends:
  shots 1–2 loop at 22 → end at 49 → landed at 57 (1.9 s); shot 3 at 23 → 58; shot 4 at 45
  (1.5 s); battle skill without a shot 37 → 72; floating combo 67 → 102; ultimate 89 → 124.
- **The loop doesn't block the next shot.** floating_loop (30 frames, exclusive 30) has windows 0–30
  for floating_attack1–5 and floating_end, so a shot cast after frame 22 starts from the loop. The
  loop casts of the battle skill (37) and floating combo (67) are unconditional in the data; the
  off-field branch's earlier cast (32 / 57) cuts them off.
- **Floating combo index reset at frame 0** (combo_skillfloating timeline action 39), not later.
- **floating_loop and floating_end are battle-type follow-ups**: skill group battle,
  skillSpecification 3, normalSkillSubType 0 (same as the battle skill; Si's strokes have 1). The
  weapon's W2 (abilityEvent 30, CheckSkillType [2]) may count them; floating attacks don't (d9e59).
- kit-draft v2 still emits no `poise` and no `teamEnergyFrame` for her (checked at 86a701f).
- **`stackAtLeast` fires on every `stacks` event of the owner**, whichever stack changed (the event
  carries no stack ID; hit gains emit one even when their `if` fails). With Signs held at 8 while
  the combo cools down, an `abatk` / `arrows` / `hail` gain would open the window, where the game
  opens it only on a Sign added at 8 (plus the hover-end pulses, test 45). The plan below avoids it.

### (a) Pass-2 gaps now

| Pass 2 | Now | How (fields), or interim rule |
|---|---|---|
| R1 delayed effects end with the skill | **supported** | `delay` on an `on: cast` trigger with `skills`: its actions are the cast's own and are dropped when the operator starts another skill (endCurrentSkill drops `pendingActions` of the cut cast; `detached: true` opts out). A `cast` action (follow-up) ends the current skill the same way. floating_loop / floating_end become hitless kit skills. `endsWithCast` doesn't fit floatingmode (it survives the floating skills: inherit list), so the hover end stays trigger-driven |
| R2 hit triggers by skill | **supported** | `on: {event: "hit", skills: [...], reaction: false}` (her `reaction: burst` hits carry `reaction: true` on their hit event) |
| R3 kit-draft poise, ObtainUspInNormalSkill | still open: **D2** on the open list | interim: kits hand-write `poise`, `poiseControlledOnly`, `teamEnergyFrame` (below) |
| R4 projectile travel, burst delay | still open: **Ti2** on the open list | interim: kits write landing frames. The logs have no cast times, so her travel can't be read; arrows keep launch frames and the burst stays on its shot's frame until test 47. R2's caveat is gone (`reaction: false`), so moving the burst later is a frame change plus a marker for its ×1.3 (a 0.5 s self buff applied by the consuming shot, read as `buffActive` in the burst's `extraScale`) |
| R5 airborne for dive attacks | **supported** (S10) | earliestStart refuses skillSpecification 6 until rotations have jumps, so plunging_attack_end can stay in the kit |
| Row 41 stack lifetime, combo pulse at hover end | still unknown | tests 42, 45 |

### (b) Kit plan: what changes

Pass 2's plan stands except as below. IDs in it are shorthand: every skill ID in a trigger
(`on.skills`, `cast`) must be the full `chr_0034_typhoea_…` ID, and every equipment stack, buff
and trigger ID must start with `<equipment ID>.` (the loader rejects anything else).

1. **Stacks.** `signs` `initial: {"talent": 0, "key": "energy_enterfight"}` (0 while talent 1 isn't
   learned) instead of `{key, skill}`; `hail` reset by the ultimate is one gain of +5 (gains clamp
   at `max`).
2. **Combo window** (replaces `combo_window` / `stackAtLeast`; trigger 2 gains the window and a
   talent gate):

   ```json
   {"id": "talent_sign", "on": {"event": "burst", "elements": ["natural"]}, "by": "anyone",
    "if": {"talentAtLeast": [0, 1]}, "cooldown": 0.2,
    "do": [{"kind": "gain", "gains": [{"stack": "signs", "amount": 1}]},
           {"kind": "openCombo", "if": {"stack": "signs", "atLeast": 8}}]},
   {"id": "sign_window", "on": {"event": "inflictionConsumed", "elements": ["natural"]}, "by": "self",
    "if": {"stack": "signs", "atLeast": 8}, "do": [{"kind": "openCombo"}]}
   ```

   Her only consumptions are the shots' (each gains its Sign before triggers run), so this opens
   exactly when a Sign is added at 8.
3. **Hail of Arrows** (trigger 6): `on` becomes
   `{"event": "hit", "skills": ["chr_0034_typhoea_floating_attack1", …, "chr_0034_typhoea_floating_attack5"], "reaction": false}`;
   `if` drops `buffActive: hovering`; `cooldown: 0.2` stays (the data's timer); `do` unchanged
   (`detached` on its hits can go: triggered hits have no cast to be cut from).
4. **Hover end and follow-ups** (replace triggers 8, 9 and 13). All `on: {event: "cast", skills:
   [<source>]}`, `by: "self"`, not detached:

   | Source | `delay` | `do` |
   |---|---|---|
   | floating_attack1 / 2 | 22 | `cast` floating_attack2 / 3 `if: {not: {controlled: true}}`; `cast` normal_skill_floating_loop `if: {controlled: true}` |
   | floating_attack3 | 23 | the same with floating_attack4 |
   | floating_attack4 | 35 | `cast` floating_attack5 `if: {not: {controlled: true}}` |
   | floating_attack4 | 45 | `endBuff hovering` `if: {controlled: true}` |
   | floating_attack5 | 15 | `endBuff hovering` |
   | normal_skill_floating_start | 32 / 37 | `cast` floating_attack1 `if: {not: {controlled: true}}` / `cast` normal_skill_floating_loop |
   | combo_skillfloating | 57 / 67 | the same |
   | ultimate_skillfloating | 89 | `cast` floating_attack1 `if: {not: {controlled: true}}`; `cast` normal_skill_floating_loop `if: {all: [{controlled: true}, {buffActive: hovering}]}` |
   | normal_skill_floating_loop | 27 | `cast` normal_skill_floating_end |
   | normal_skill_floating_end | 8 | `endBuff hovering` |

   Two delays on one source are two triggers. The two new skills (a `cast` target must be a kit
   skill: the loader only checks skillGroups, the engine throws on a skill missing from the kit):

   ```json
   {"skillId": "chr_0034_typhoea_normal_skill_floating_loop", "label": "Hover idle", "damageType": "battle",
    "available": {"not": {"potentialAtLeast": 0}}, "hits": []},
   {"skillId": "chr_0034_typhoea_normal_skill_floating_end", "label": "Hover end", "damageType": "battle",
    "available": {"not": {"potentialAtLeast": 0}}, "hits": []}
   ```

   (`available` never holds: follow-ups only. The shots' windows list floating_end, so some input
   casts it in game; ending a hover early never adds damage, so it's left out of rotations.)
   `damageType: "battle"` follows the interim rule of Si R6 (sub-skills count as battle skills,
   test 29): each idle end then fires W2 twice (Arts Intensity refresh, 4 Windform). Trigger 11
   (`hover_ended`) is unchanged and now also covers the idle end.
5. **Floating combo reset:** `on: cast, skills: [combo_skillfloating]`, no delay → gain `abatk` −5.
6. **Hand-written D2 values:** `poise: "poise"` on attack5's arrow (17, `poiseControlledOnly`),
   floating_attack5's `power_shot` (20, `poiseControlledOnly`), both combos' first arrow (10) and
   the ultimate's main hit (20); floating_attack1–4 and the battle skill have `poise` 0 (leave out);
   `teamEnergyFrame: 12` on the battle skill.
7. **plunging_attack_end** stays in the kit (kit-draft hits): S10 keeps it out of rotations.
8. **Small loader-shape fixes in pass 2's prose:** `hovering_atk`'s modifier is
   `{"zone": "atk", "value": {"key": "atk_up", "skill": "chr_0034_typhoea_normal_skill_floating_start"}}`
   (the ultimate's `atk_up` is the same 0.18 from P1), applied by an action with
   `if: {"potentialAtLeast": 1}`; `hovering` has no `duration` and `modifiers: []`.
9. **Equipment kits** (new files; plain keys name the trigger's `skill`):

   ```json
   {"equipment": "wpn_funnel_0019", "sources": ["…"],
    "stacks": [{"id": "wpn_funnel_0019.windform", "label": "Windform", "max": 4}],
    "buffs": [
     {"id": "wpn_funnel_0019.intensityup", "label": "Arts Intensity", "target": "self", "duration": 15,
      "gameBuff": "buff_wpn_funnel_0019_intensityup", "modifiers": [{"attr": 87, "value": "phy_spell_up"}]},
     {"id": "wpn_funnel_0019.windform_timer", "label": "Windform timer", "target": "self", "duration": 15, "modifiers": []},
     {"id": "wpn_funnel_0019.spelldmgup", "label": "Arts DMG", "target": "self", "duration": 30, "maxStacks": 4,
      "gameBuff": "buff_wpn_funnel_0019_spelldmgup",
      "modifiers": [{"attr": 51, "value": "spell_dmg_up2"}, {"attr": 52, "value": "spell_dmg_up2"},
                    {"attr": 53, "value": "spell_dmg_up2"}, {"attr": 54, "value": "spell_dmg_up2"}]}],
    "triggers": [
     {"id": "wpn_funnel_0019.battle_cast", "on": {"event": "cast", "kinds": ["battle"]}, "by": "self", "skill": "sk_wpn_funnel_0019",
      "do": [{"kind": "buff", "buff": "wpn_funnel_0019.intensityup"},
             {"kind": "gain", "gains": [{"stack": "wpn_funnel_0019.windform", "amount": "wind_grant"}]},
             {"kind": "buff", "buff": "wpn_funnel_0019.windform_timer"}]},
     {"id": "wpn_funnel_0019.windform_out", "on": {"event": "buffEnded", "buff": "wpn_funnel_0019.windform_timer"}, "by": "self",
      "do": [{"kind": "gain", "gains": [{"stack": "wpn_funnel_0019.windform", "amount": -4}]}]},
     {"id": "wpn_funnel_0019.burst", "on": {"event": "burst"}, "by": "self", "skill": "sk_wpn_funnel_0019",
      "if": {"stack": "wpn_funnel_0019.windform", "atLeast": 1}, "cooldown": 0.1,
      "do": [{"kind": "gain", "gains": [{"stack": "wpn_funnel_0019.windform", "amount": -1}]},
             {"kind": "buff", "buff": "wpn_funnel_0019.spelldmgup"}]}]}
   ```

   ```json
   {"equipment": "suit_spellburst", "sources": ["…"],
    "buffs": [{"id": "suit_spellburst.physpellup", "label": "Arts Intensity (Deep Rampart)", "target": "self",
               "duration": "duration", "maxStacks": "max_stack", "gameBuff": "buff_equipsuit_spellburst_01_physpellup",
               "modifiers": [{"attr": 87, "value": "phy_spell_up"}]}],
    "triggers": [{"id": "suit_spellburst.burst", "on": {"event": "burst", "elements": ["natural", "cryst"]}, "by": "self",
                  "cooldown": 0.1, "skill": "passive_equipsuit_spellburst01",
                  "do": [{"kind": "buff", "buff": "suit_spellburst.physpellup"}]}]}
   ```

   Re-applying a buff replaces it without a `buffEnded`, so the Windform timer only ends 15 s after
   the last grant (exact: a grant of 4 replaces all 4 layers). All keys exist at every level of
   their skills and the three `gameBuff`s are covered by tables.json (checked).

**Would the loader reject anything?** Pass 2's plan as written: only the shorthand (unprefixed
skill IDs, unprefixed equipment IDs, `atk` without `zone`), and trigger 13's `cast` targets would
load but throw at runtime unless floating_loop / floating_end are kit skills. The snippets above
follow the schema and kits.ts checks.

### (c) New gaps

None. Two notes for the merge, neither blocking (the plan avoids both):

- `stackAtLeast` can't tell which stack changed (`stacks` events carry no stack ID). Only this kit
  used it; with change 2 nobody does. A `stack` field on the event would make it exact.
- Whether battle-type follow-ups (floating_loop / floating_end) count as battle-skill casts is
  Si R6's open question (test 29, interim: yes). For Typhoeus it decides whether an idle hover end
  refreshes Umbra of Frigid Eventide (W2) twice; test 29 should get a Typhoeus case: ultimate only
  (no battle skill) with the weapon, let the hover end by itself, and look for the weapon's Arts
  Intensity buff.

### (d) In-game tests the kit depends on

9 (burst ×1.3), 17 (jumps: only her off-field shots at 4 m or more), 18 (her ultimate's time stop),
29 (follow-ups as battle skills, above), 36 (her shared combo cooldown), 42 (idle end: now from the
data, 1.9 s after shots 1–3 and 1.5 s after shot 4; stack lifetime), 43 (off-field shots), 44
(teammate burst Signs), 45 (combo pulse at hover end), 46 (Hail of Arrows count, optional), 47
(burst delay). Test 42's "Why" still says the engine can't end the hover by idling; it can now.
