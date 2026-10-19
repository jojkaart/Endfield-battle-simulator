# Snowshine (chr_0014_aurora): gap report, batch 3

Operator Snowshine (Defender, Cryo, greatsword: CharacterTable
`profession` 2, `charTypeId` Cryst, `weaponType` 3; main attribute
Strength 39, secondary Will 42), with the weapons Seeker of Dark Lung
(`wpn_claym_0011`) and Finishing Call (`wpn_claym_0012`), both weaponType
3 ([batch-3.md](../batch-3.md)). No gear set is assigned to her.

Sources (rmxlinux): SkillData `chr_0014_aurora_*` (16 files),
BuffData `buff_chr_0014_aurora_*` (13 files), `sk_wpn_claym_0011/0012`,
`buff_wpn_claym_0011_atk_up_up`, `buff_wpn_claym_0011_primary01`,
`buff_wpn_claym_0012_up`, `buff_common_cryst_cryst_frozen_triggered`,
`buff_common_obtain_ultimate_sp`; TableCfg CharacterTable, CharGrowthTable,
CharacterPotentialTable, PotentialTalentEffectTable, SkillPatchTable,
WeaponBasicTable, I18nTextTable_EN. Values at skill level 12 / weapon
skill level 9 unless noted. Frames are SkillData timeline frames (30 FPS)
from the cast. The SkillData and BuffData files arrived mid-analysis
(commit 535e88f); everything below is read from them, not from the
reference simulators.

Claims re-checked: the brief's "her battle skill has the same shape as
Catcher's" is **confirmed** (listener on being hit, a counter jump,
InterruptCurSkillAction), with one difference: there's no unconditional
jump. The not-attacked path ends at f106 by InterruptCurSkillAction.
Catcher's report ([batch-2/chr_0020_meurs.md](../batch-2/chr_0020_meurs.md)
G1, G2) already lists Snowshine's listener as shared (0–51, f106):
**confirmed**. Test 53's description of her bash (Cryo DMG and Cryo
Infliction on the attacker) matches the data.

`efsim kit-draft chr_0014_aurora` was run. It compiles the hit frames,
factors, Final Strike, SP and team-energy parts correctly. What it leaves
out is in the `data` rows: per-hit element, poise, the Snow Zone and its
Solidification, and hitless energy.

## Action types per file

Only the action types that matter for damage, resources, state or timing
are listed. Sound, VFX, camera, animation, root motion, rotation, super
armour, target finding, teleport and ComboCacheAction are left out.

| File | Action types that matter |
|---|---|
| attack1, attack2 | DamageAction (mask 128, damageType 0 Physical), ObtainCostAction `atb` (0), HitStopAction, AllowNextSkillAction 32–47 / 28–43 |
| attack3 | ChannelingAction ×2: SimpleCalcBB `atk_scale` × 0.4 at f21 and × 0.6 at f39 (mask 2097280, Final Strike; poise unit `poise` with onlyEnableForMainChar), DoOnce ObtainCostAction `atb` (25), HitStopAction ×2, AllowNextSkillAction 61–75 |
| power_attack (finisher, spec 8) | DamageAction f41 (BreakingAttackCalculation multiplier **1.0**, mask 132), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` 0–41 and `buff_common_full_immune_medium`, AllowNextSkillAction 41–75 (battle, combo) |
| plunging_attack_end (spec 6) | DamageAction f1 (mask 1152), ObtainCostAction, PushBackAction |
| dash_attack (spec 7) | DamageAction (mask 131200); not in `chr_0014_aurora_NormalAttack`'s skill list |
| normal_skill (battle, spec 3) | f0: ObtainCostAction costType 1 `atb_return_base` (atbGainMethod 1, returned), CreateBuff `buff_common_obtain_ultimate_sp` (ratio 0.5); 0–51: AuraAction `buff_chr_0014_aurora_reduce_damage` (team) and, if `potential_1` ≥ 1, AuraAction `buff_chr_0014_aurora_potential_1_listener`; **EventListenerAction 0–51**: abilityEvent 101 + CheckDamageDecorateMask (checkType 3, mask 805306368) → **JumpToAction 107**; abilityEvent 9 + CheckBuffIdInContext `buff_eny_0018_lbtough_pre_catch` + distance 3 → JumpToAction 107; **MarkCanInterrupt f67**; **InterruptCurSkillAction f106**; f107: CreateBuff `buff_common_obtain_ultimate_sp` (ratio 0.5), ObtainCostAction `talent_2_sup` if > 0, CreateBuff `buff_chr_0014_aurora_reduce_damage` (self, `duration` assigned), InterruptAction on the target, TimeDilationAction layer 1 (0.7 s, target and self); AuraAction 107–125 `reduce_damage`; ChannelingAction 125–127: **SpellInfliction Cryo** (inflictionType 2), DoOnce ObtainCostAction costType 1 `potential_5_atb`, DamageAction `atk_scale` (mask 4352, damageType 4, poise `poise`), HitStopAction 0.4 s; AllowNextSkillAction 135–145 (itself). durationFrame 208, exclusiveFrame 145 |
| combo_skill (spec 5) | f12: ObtainCostAction `usp`, LaunchProjectile `projectile_chr_0014_aurora_combo_skill_bear_out` → `combo_skill_bear_gene` → SpawnAbilityEntity (`combo_skill_abilityrange`); TimeDilationAction 0–13 (global, 0.533 s); TemporaryUnlockAction (off-field cast); AllowNextSkillAction 15–60 (battle); no DamageAction |
| combo_skill_abilityrange (entity) | AuraAction 0–3 `buff_chr_0014_aurora_combo_skill_heal`, AuraAction 0–900 `…_combo_skill_heal_loop` (`duration`, `interval`), FinishOwnerAction f90 |
| ultimate_skill (spec 7) | UltimateTimeAction 0–60, CreateBuff `buff_common_damage_immune_ult_skill` 0–90 (autoFinishByAction), f62: InterruptAction, DamageAction `atk_scale` (mask 4608, damageType 4, poise `poise`), **TakeDownAction 0.5 s**, SpawnAbilityEntity (`ultimate_skill_abilityrange`, or `…_potential2` if `potential_2` = 1); TimeDilationAction layer 1 on self 0–3 (RESETto1); AllowNextSkillAction 71–90 (battle, combo) |
| ultimate_skill_abilityrange(_potential2) (entity) | AuraAction 4–157 (4–156) on enemies: `buff_chr_0014_aurora_ultimate_skill_frost` (`extra_duration`) and `…_ultimate_skill_dmg` (`atk_scale_loop`) |
| buff_…_ultimate_skill_dmg | 5 s, triggerInterval 0.5 s, waitFirstTriggerInterval, unlimited: DamageAction `atk_scale_loop` (mask 512, Cryo) |
| buff_…_ultimate_skill_frost | 5 s; event 5 (enable): if CheckSuperArmor < 30, TimeDilationAction layer 1 on the enemy for 2 s; event 1 (tick, interval 2 s, waitFirst, maxTriggerCnt 1): CreateBuff `buff_common_cryst_cryst_frozen_triggered` (`extra_duration`) |
| buff_common_cryst_cryst_frozen_triggered | ReadSkillSettingData 冰冻持续时间 (Solidification duration) for `count` 1, **ModifyDynamicBlackboard `duration` += `extra_duration`**, CreateBuff `…_frozen_triggered_do` |
| buff_…_reduce_damage | applyTags 1483840340; event 5: ShelterAction `taken_dmg` (+ AddTag −956116137 if `potential_1` > 0); event 2 (finish): CreateBuff `…_reduce_damage_remain` |
| buff_…_reduce_damage_remain | stackingType 4, `duration` 0.5: ShelterAction `taken_dmg` |
| buff_…_potential_1_listener / _potential_1 | abilityEvent 122 + CheckTagMatch → AddTag −956116137 for 0.05 s (infliction immunity, P1) |
| buff_…_talent_0 | healModifier: CheckHp ≤ `rate` → ModifyHealCalcResult × `heal_up` (lifeType 1) |
| buff_…_combo_skill_heal / _heal_loop | HealAction (MultiplyAttributeCalculation Will × `heal_scale` + `heal_static_value`; loop every `interval`) |
| buff_…_counter_trigger, _counter_succeed_mark, _ultimate_skill_limit (`forst_allow_count` 2, stackingType 2, 10 s), _combo_skill_tutorial_marker | nothing in the checkout creates them, except the tutorial marker (combo f12): no gameplay effect found |
| talent_1 (SkillData) | `buffs`: `buff_chr_0014_aurora_talent_1`, which has no BuffData file |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–2: `atk_scale` 1.24 / 1.32, f19 / f19, `atb` 0 (SkillPatchTable; "up to 3 sequences") | supported | kit-draft output as is |
| 2 | Basic attack 3: `atk_scale` 2.25 split × 0.4 (f21) and × 0.6 (f39, Final Strike), `atb` 25 at the second | supported | `factor` 0.4 / 0.6, `sp: "atb"` on `hit_2` (kit-draft output) |
| 3 | Final Strike stagger: "As the controlled operator, Final Strike also deals {poise} Stagger"; attack3's poise unit `poise` (23), onlyEnableForMainChar | data | kit writes `poise`, `poiseControlledOnly: true` (D3: the compiler emits no poise) |
| 4 | Basic attacks, finisher and dive are Physical (DamageAction damageType 0; descriptions "deals Physical DMG") while the operator is Cryo | data | each such hit needs `element: "physical"`; kit-draft omits it, so the hits default to the kit's `cryst` (D3 "per-hit element"). Found by `efsim calc`: the basics came out Cryo |
| 5 | Finisher: `atk_scale` 9.0 at f41, multiplier 1.0, finisher SP (GainBreakingAttackAtb), disable-cast 0–41 | supported | one plain hit; finisher rules are the engine's |
| 6 | Dive attack: `atk_scale` 1.8, f1 (mask 1152, spec 6) | supported | refused until rotations have jumps (S10) |
| 7 | Dash attack (spec 7, not in the skill group) | supported | left out, as in Catcher's and Gilberta's kits |
| 8 | Hit-stops: HitStopAction on attacks 1–3, the finisher and the bash; the counter's layer-1 TimeDilationAction (0.7 s at 0.3 → 1 on Snowshine and the enemy) | gap (Ti1b, open) | not modelled. The counter's slow-down probably delays the bash by about 0.3 s of real time |
| 9 | Battle skill cost: 100 SP; f0 "immediately returns some SP": `atb_return_base` 30 returned (atbGainMethod 1) | supported | trigger on its cast: `{kind: "sp", value: "atb_return_base"}`. Refunded SP gives no team energy (engine) |
| 10 | Battle skill team energy: `buff_common_obtain_ultimate_sp` ratio 0.5 at f0 and f107 | supported | `teamEnergy: [{frame: 0, ratio: 0.5}, {frame: 107, ratio: 0.5}]` (kit-draft output). Checked in the scratch copy: the f107 part comes only on the counter path |
| 11 | Protection: "grants Protection to self and nearby operators" — AuraAction 0–51 `reduce_damage` (ShelterAction `taken_dmg` 0.9), then `_remain` 0.5 s | supported | team buff with `{attr: 63, value: taken_dmg}` and `gameBuff` (Protection category for buffApplied triggers, e.g. suit_usp02). Damage taken isn't simulated. Duration 2.2 s written as a literal (51/30 + 0.5), not compiled |
| 12 | Counter: "When attacked while the said shield is raised, perform a retaliation bash": EventListenerAction 0–51, abilityEvent 101 (she is hit), mask check checkType 3 805306368 → JumpToAction 107 | supported | trigger `on: {event: "attacked"}`, `by: "self"`, `do: [{kind: "jump", skill, from: 0, until: 51, to: 107}]`, as in Catcher's kit. The mask check is assumed to pass every enemy attack, as for Catcher |
| 13 | The listener's abilityEvent 9 branch (one enemy's grab, `buff_eny_0018_lbtough_pre_catch`) | supported | not modelled (enemy-specific), as for Catcher |
| 14 | Not attacked: InterruptCurSkillAction f106 ends the action | supported | loader `SkillTiming.ends`. Scratch run: the next basic attack starts 3.53 s after the cast |
| 15 | **MarkCanInterrupt f67** on the not-attacked path (skipped by the counter's jump) | gap G1 | the engine ignores MarkCanInterrupt: she is held until f106, not f67 (+39 frames, 1.3 s per uncountered battle skill). Semantics: in-game test proposed below |
| 16 | Counter path f107: second Protection aura 107–125 + `_remain` 0.5 s, her own 1 s copy; InterruptAction on the enemy | supported | delayed cast trigger at 107 applying `protection_counter` (1.1 s). Jumps move delayed actions, and the f106 end drops them on the other path (checked). InterruptAction isn't modelled (as for Catcher) |
| 17 | Talent 2 (SAR Professional): "After successfully retaliating an enemy attack, Snowshine gains another {talent_2_sup} Ultimate Energy": ObtainCostAction `talent_2_sup` at f107 (6 / 10 at talent levels 1 / 2; PotentialTalentEffectTable `chr_0014_aurora_talent_2_1/_2` skillBbModifier set) | supported | same delayed trigger: `{kind: "energy", value: "talent_2_sup"}`. Scratch run: +13.7 with Seeker's UGE 137.1% |
| 18 | Bash at f125: SpellInfliction Cryo before the DamageAction, `atk_scale` 4.5, poise `poise` 20, mask 4352 | supported | hit at 125 with `applies: [{kind: "infliction", element: "cryst"}]`, `poise: "poise"` (poise hand-written: D3) |
| 19 | P5 (Cold Disaster Specialist): "Successfully retaliating an enemy attack returns {potential_5_atb} SP": DoOnce ObtainCostAction costType 1 in the bash channel (10 from P5, set) | supported | `sp: "potential_5_atb"` on the bash. Checked: +10 SP at P5, 0 at P0 |
| 20 | Recast window AllowNextSkillAction 135–145 (battle skill only); exclusiveFrame 145, durationFrame 208 on the counter path | supported | loader |
| 21 | Being attacked with `dodge` on: the controlled operator dashes at every attack, also with the shield up, so a perfect dodge ends the battle skill and the counter never happens | gap G4 | E1 follow-up (dodge policy). Shared with Catcher, Purrchena and Ember. Scratch run with `--dodge 1`: no bash, and the combo window never opens |
| 22 | Combo trigger: "After controlled operator gets attacked and drops below {trigger_hp_ratio} HP" (0.6) | gap G2 | needs HP (N1, proposed to defer in batch 2) or a scenario statement. This is her only combo trigger |
| 23 | Combo energy: ObtainCostAction `usp` 10 at f12; the combo has no damage | data | a delayed cast trigger at 12, `{kind: "energy", value: "usp"}`. kit-draft only notes "energy usp at f12 with no landing", so a hitless skill's energy needs a hand-written trigger (D3) |
| 24 | Combo heal: projectile to the controlled operator → entity aura → instant heal (Will × `heal_scale` + `heal_static_value`) to nearby operators, plus a loop heal every 0.5 s for `duration` 3 s (HealAction tag: combo heal) | supported | `heal` action, `target: "team"`, `healKind: "combo"`, at the launch frame (travel isn't in the data, Ti2). The loop's 6 heal events can be added with a buff with `every: 0.5` and a buffTick trigger; amounts aren't modelled. No kit she can wear reacts to heals today |
| 25 | Combo global slow-down (TimeDilationAction 0.533 s, ComboSkill curve), cooldown 25 / 24 / 23 s (SkillPatchTable) | supported | loader and tables |
| 26 | Link: combo casts give the team a Link stack (B8, built in) | supported | engine. Her combo's main team value with its 10 energy |
| 27 | Ultimate: 80 energy, cooldown 20 s, UltimateTimeAction 0–60, damage immunity 0–90 | supported | tables and loader |
| 28 | Ultimate slam f62: `atk_scale` 4.5, poise `poise` (15 at levels 1–9, 20 at 10–12), Cryo | supported | hit at 62 (kit-draft output, plus poise) |
| 29 | Ultimate TakeDownAction 0.5 s and InterruptAction on the target | unknown | not modelled. Catcher's combo has the same TakeDownAction (her report's in-game test C) |
| 30 | Snow Zone: "generates a Snow Zone (lasting several seconds) that deals Cryo DMG over time": entity at 62, AuraAction from entity frame 4 → `buff_…_ultimate_skill_dmg` (5 s, tick every 0.5 s, waitFirst), `atk_scale_loop` 0.65, mask 512 | data | 10 detached hits at frames 81, 96, …, 216 (66 + 15k), `events: ["buff_chr_0014_aurora_ultimate_skill_dmg"]`. kit-draft doesn't follow an AuraAction's `buffInput` buffs (D3). Assumes the enemy stays in the zone |
| 31 | Whether the zone's 10th tick (at the buff's 5 s expiry, frame 216) happens | unknown | 10 assumed. A log with Snowshine's ultimate settles it (9 vs 10 `…_ultimate_skill_dmg` hits) |
| 32 | Snow Zone forced Solidification: "forcibly applies Solidification to enemies caught within it": `…_ultimate_skill_frost` ticks once after 2 s (f126) → `buff_common_cryst_cryst_frozen_triggered`, count 1 (level 1) | data | delayed cast trigger at 126, `detached`, `apply` `{kind: "forcedReaction", status: "solidification", level: 1}` (duration from the engine's level-1 table). Not compiled (same AuraAction limit, D3) |
| 33 | P3 (Polar Survival Guide): "Duration of the Solidification applied by the skill is increased by {extra_duration}s": `extra_duration` += 2 (skillBbModifier modifyType 1, add), passed to `frozen_triggered`, which adds it to the table duration | gap G3 | `forcedReaction` has only `durationKey` (a whole duration). `statusTweaks.extraSeconds` would also lengthen Solidifications from her bash's Cryo infliction, which the text excludes |
| 34 | The frost buff's slow-down of an enemy with super armour < 30 (layer-1 TimeDilationAction, 2 s) | gap (Ti1b, open) | entity-layer slow-downs aren't modelled. Only small enemies |
| 35 | `buff_…_ultimate_skill_limit` (`forst_allow_count` 2 per 10 s) | unknown | created by nothing in the checkout, possibly game code limiting the zone's Solidifications. No effect with one enemy and a 20 s cooldown |
| 36 | P2 (Storm Region): radius +20% (`potential_2` → the `_potential2` entity, whose aura ends one frame sooner) | supported | no effect with one enemy |
| 37 | P1 (Cold Shelter): allies with Protection can't receive Arts Inflictions during the block | supported | no effect: enemies' inflictions on the team aren't simulated |
| 38 | P4 (Tundra Aegis): DEF +20, Will +20 | supported | stat panel (`efsim calc` at P5: Def 20, Will 128.9) |
| 39 | Talent 1 (Polar Survival): Treatment Effect +15% / +25% for targets at or below 45% / 55% HP | supported | heal amounts aren't simulated, so there's nothing to declare |
| 40 | Attribute nodes: Strength +10 / 15 / 15 / 20 | supported | stat panel |
| 41 | `talent_1` SkillData's `buff_chr_0014_aurora_talent_1` (no BuffData file) and the orphan counter buffs | supported | inert |

### Equipment

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| W1 | Seeker of Dark Lung: Strength +124 (`wpn_attr_str_mid`), Ultimate Gain Efficiency +37.1% (`wpn_sp_attr_usgs_mid`), Main Attribute +14% (`sk_wpn_claym_0011` cardAttributeModifier formulaItem 6, modifyAttributeType 1) | supported | stat panel (`efsim calc`: Str 386.3 = 338.9 × 1.14; UGE 137.1%) |
| W2 | Seeker: "When the wielder applies an Arts Burst, the wielder gains ATK +{atk_up} for {duration}s. Max stacks … {max_stack}. Duration of each stack is counted separately. Effect only triggers once every 0.1s." passiveEventActions abilityEvent 127 (as sk_wpn_funnel_0019's burst trigger) + timed marker `cd` 0.1 → `buff_wpn_claym_0011_atk_up_up` (attr 2 formulaItem 6 +`atk_up` 0.168, `duration` 30, stackingType 2, `max_stack` 3) | supported | burst trigger, `cooldown: 0.1`, `beforeDamage: true` (as Umbra's trigger on the same abilityEvent 127, which a log shows acting before the burst's damage; unverified here), layered buff `maxStacks: "max_stack"`, `zone: "atk"`. Scratch run: her second bash's Cryo infliction bursts; the layer then counts on that bash (5,202 → 6,076, since the infliction applies before its damage), the burst and the next attack1 (1,433 → 1,674, ×1.168); `calc --buff wpn_claym_0011.atk_up:3` ×1.504. The file default `max_stack` 2 is overridden by SkillPatchTable (3 at every level) |
| W3 | Seeker's toggleBuffs `buff_wpn_passive_spirit_01` and `buff_wpn_claym_0011_primary01` (created by nothing) | supported | inert (as in wpn_funnel_0002 / wpn_lance_0010) |
| W4 | Finishing Call: Strength +124, Max HP +62.4% (`wpn_sp_attr_hp_mid`), Secondary Attribute +14% (`sk_wpn_claym_0012` modifyAttributeType 2) | supported | stat panel (`efsim calc`: Will 124.15 = 108.9 × 1.14; Max HP 8,924) |
| W5 | Finishing Call: "Combo skill HP treatment effect +{heal_up}" (`buff_wpn_claym_0012_up` healModifier on heal tag −1517158118: attribute 29 +0.56) | supported | heal amounts aren't simulated, so there's nothing to declare (as in suit_heal01) |

**Counts** (46 rows, operator 41 + equipment 5): supported 32, gap 6
(G1–G4 new; Ti1b ×2, already open), data 5, unknown 3, unique? 0.

## Gaps

### G1. MarkCanInterrupt: a skill that frees its caster before its exclusive frame

- **family:** skills (the action gate); the data part is the loader.
- **feature:** the loader reads a MarkCanInterrupt on a skill's own
  timeline (enabled, top level) into `SkillTiming`, e.g.
  `interruptibleFrom: number[]`. When a cast's playhead reaches such a
  frame (a jump that skips it doesn't count), the action gate treats the
  cast as past its `exclusiveFrame`, so any skill may start. Endaxis's
  runtime reads it that way: "native canInterrupt: past the protection
  time, or this cast ran MarkCanInterrupt"
  (`reference/Endaxis/src/core/combat/skills/skillRuntime.ts`, read, not
  copied). Whether dashes and swaps are also freed is part of the same
  question.
- **evidence:** `chr_0014_aurora_normal_skill` MarkCanInterrupt [67–70],
  exclusiveFrame 145, InterruptCurSkillAction f106. Shared: the same
  action is in `chr_0006_wolfgd_normal_skill` (f48, exclusive 159),
  `chr_0007_ikut_normal_skill` (f34, exclusive 164),
  `chr_0020_meurs_normal_skill` (f129 on the counter path, exclusive 285,
  end f194), `chr_0038_purrche_combo_skill` (f28, exclusive 330),
  `chr_0038_purrche_normal_skill(_loop_1/_2)` and Typhoeus's
  `combo_skill` / `floating_attack4` (at or after their exclusive frame:
  no change). So batch 3's Wulfgard, Arclight and Purrchena need it too,
  and so does Catcher's existing kit.
- **impact:** an uncountered Saturated Defense holds her 106 frames
  instead of 67: 1.3 s per cast of rotation time, and every later action
  moves. (The counter path is unchanged: the jump skips f67.) Catcher's
  counter: free at 129 instead of 194 (2.2 s). Wulfgard's and Arclight's
  battle skills would differ by 3.7 s and 4.3 s, if their windows don't
  already allow the next action.

### G2. HP below a ratio when attacked (her combo trigger)

- **family:** triggers, with the enemy-attack model (E1); HP is N1.
- **feature:** HP isn't simulated, so the scenario says it. An enemy
  attack may carry the HP its target is left with
  (`enemyActions[].hpAfter`, a ratio of Max HP, default 1). The `attacked`
  event carries it, and an `attacked` trigger filter
  `hpBelow: <ValueExpr>` (here `trigger_hp_ratio`, 0.6) matches when
  `hpAfter < hpBelow`. A scenario-wide default
  (`options.hpAfterAttack`) would cover "every attack brings the
  controlled operator low". Heals would raise it again only if HP were
  simulated: out of scope.
- **evidence:** CharGrowthTable `chr_0014_aurora_ComboSkill`: "COMBO
  TRIGGER: After controlled operator gets attacked and drops below
  {trigger_hp_ratio:0%} HP" (SkillPatchTable `trigger_hp_ratio` 0.6).
  Catcher's second trigger is the same ("when the controlled operator is
  attacked and falls below {trigger_hp_ratio} HP", 0.4), left out in her
  kit. Batch 2 proposed to defer N1 (kills and HP).
- **impact:** her combo deals no damage, but it gives 10 ultimate energy
  (× UGE) and the team a Link stack (+30% on the next battle skill or
  ultimate, by anyone) every 23 s, and it is a combo cast for combo-cast
  triggers. Interims: (a) no trigger: the combo is castable whenever off
  cooldown (overstates); (b) a trigger on every attack on the controlled
  operator (the draft); (c) none at all. **Owner decision** (Catcher
  shares it).

### G3. Extra seconds on a forced reaction

- **family:** arts state.
- **feature:** `forcedReaction.extraSeconds` (a ValueExpr), added to the
  status's table duration for its level, as
  `buff_common_cryst_cryst_frozen_triggered` does: ReadSkillSettingData
  (Solidification duration for `count`), then ModifyDynamicBlackboard
  `duration` += `extra_duration`. It acts only on that application, not
  on the operator's other statuses (unlike `statusTweaks`).
- **evidence:** PotentialTalentEffectTable `chr_0014_aurora_potential_3`:
  skillBbModifier `extra_duration` +2 (modifyType 1) on
  `chr_0014_aurora_ultimate_skill`; "Duration of the Solidification
  applied by the skill is increased by {extra_duration}s"; the entity
  passes `extra_duration` to `buff_…_ultimate_skill_frost`, and that to
  `frozen_triggered`. In the checkout only this chain uses the common
  buff's `extra_duration`. It isn't unique: it's a parameter of the shared
  common buff, so any forced Solidification can use it.
- **impact:** at P3+ (P5 is the default), the zone's Solidification lasts
  2 s less in the engine than in the game (level 1: 5.75 s instead of
  7.75 s). Solidification itself deals no damage. It matters for Shatter
  timing (a teammate's physical status consuming it) and for effects that
  check Solidification.

### G4. No dash at an attack the current skill would counter

- **family:** timing / triggers (follow-up of E1's dodges).
- **feature:** with `dodge` on, the controlled operator doesn't dash at an
  attack while its current skill has an armed counter: a kit trigger
  `on: attacked` (`by: self`) with a `jump` action whose skill is the
  current one and whose `[from, until)` holds the playhead. The attack
  then lands as an ordinary one and the counter runs. A player raises the
  shield in order to be hit. Alternatively, a skill flag
  `noDodge: [from, until]` read by the dodge policy.
- **evidence:** `timeline.ts` `enemyAct`: with `dodge` the controlled
  operator dashes at every attack (only an ultimate before its exclusive
  frame is exempt), and a perfect dodge ends the current action and
  replaces the `attacked` event. Scratch run of the draft with
  `--dodge 1`: no bash, and the combo trigger never fires ("its combo
  trigger hasn't happened"). The same holds for Catcher's counter, and for
  Purrchena's and Ember's listeners ([Catcher G1](../batch-2/chr_0020_meurs.md)).
- **impact:** in any scenario with dodging, each attack during the shield
  costs her the bash (4.5 × ATK, the Cryo infliction, P5's 10 SP, talent
  2's 10 energy, the second team-energy half), with the dodge chance's
  probability.

### Compiler leftovers (D3, already open)

Snowshine adds four cases to D3. kit-draft emits no per-hit element
(rows 3–4, the Physical basics of a Cryo operator) and no poise. It
doesn't follow AuraAction `buffInput` buffs (their ticks and their
triggered applications: rows 30 and 32, the whole Snow Zone). And it
reports a hitless skill's energy only as a note (row 23). Protection's
aura-plus-remain duration (row 11) is hand-written too.

## Verification

- **Logs:** no fixture has Snowshine or either weapon (`grep` over
  fixtures/ and fixtures/pending/). These would verify the kit:
  - a log with her ultimate: the slam's and each Snow Zone tick's damage
    under `buff_chr_0014_aurora_ultimate_skill_dmg` (9 or 10 ticks, row
    31), and the forced Solidification's time and length;
  - a log of a countered battle skill: the bash's damage and time after
    the attack (125 − 107 = 18 frames plus the counter's slow-down, row 8);
  - Seeker of Dark Lung's ATK layers after her Cryo bursts.
- **Scratch runs** (draft kits in a copy of the repo, real loader and
  data). Battle skill at 0.5 s, attacked at 1.0 s: the bash lands at
  1.60 s (jump at the attack's frame to 107, bash at 125). The combo
  window opens at the attack. Both team-energy halves and talent 2 give
  22.6 energy before the combo (+13.7 from the combo's `usp`; UGE 137.1%). A
  battle skill not attacked holds her 3.53 s (f106) and gives only the f0
  half. Ultimate: slam at +2.07 s, ticks from +2.70 s every 0.5 s,
  Solidification at +4.20 s. `--dodge 1`: no counter (G4).
- **In-game tests.** The owner doesn't use Snowshine, so these are low
  priority.
  - Test 53 (does a perfectly dodged hit count as "attacked") already
    describes her bash correctly: Cryo DMG and Cryo Infliction on the
    attacker (SpellInfliction inflictionType 2 in the bash's channel).
    Test 54 (dash cancels) is unchanged.
  - **New, for G1: does an un-hit shield release her early?** On a
    training dummy, which doesn't attack, with the SP bar full (300; each
    cast costs 100 and returns 30): press the battle skill three times in
    a row, each as soon as the game accepts it, and time from the first
    shield to the third with a stopwatch or phone video. If
    MarkCanInterrupt frees her (G1 as proposed), the third cast comes
    **about 4.5 s** after the first; if not (today's engine: the skill
    holds her until it ends itself), **about 7.1 s**. A gap of about
    2.6 s. Then the same with a basic attack instead of the second and
    third press, as a check that it's not specific to recasting the
    battle skill. The same question decides Wulfgard's and Arclight's
    battle skills (G1), so a test with one of them may be the better
    choice if the owner has them.
  - Row 29 (TakeDownAction) is Catcher's test C.
  - Row 31 (9 or 10 ticks) is best settled by a log. By eye, it means
    counting about ten damage numbers, 0.5 s apart, in a video: possible,
    low value.

## Kit plan

Draft files, loaded with the real loader in the scratch copy
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0014_aurora/repo`
(packages/data/kits/operators/chr_0014_aurora.json,
packages/data/kits/equipment/wpn_claym_0011.json and wpn_claym_0012.json).
`efsim calc` and `efsim simulate` load and run them, and
`packages/data/test/kits.test.ts` passes with them in place. (One
unrelated `skillCompile.test.ts` failure in the copy is Fluorite's
team-energy entry from the main session's in-progress K4 change.)

### Operator kit (today)

- `element: "cryst"`. Hits of the basic chain, finisher and dive are
  `element: "physical"` (row 4).
- **Skills** (frames, keys and factors from kit-draft; additions in bold):
  - attack1 `hit` f19 `atk_scale`, `sp: atb`; attack2 the same.
  - attack3 `hit` f21 ×0.4 and `hit_2` f39 ×0.6, `sp: atb`,
    **`poise: "poise"`, `poiseControlledOnly: true`**.
  - power_attack `hit` f41 `atk_scale`; plunging_attack_end `hit` f1.
  - normal_skill: `teamEnergy` 0.5@0 and 0.5@107; `bash` f125
    `atk_scale`, **`poise: "poise"`**, `applies` Cryo infliction,
    `sp: "potential_5_atb"`.
  - combo_skill: `hits: []`.
  - ultimate_skill: `hit` f62 `atk_scale`, **`poise: "poise"`**; **`snow_zone`**
    ×10 (below).
- **Buffs:** `protection` (team, 2.2 s) and `protection_counter` (team,
  1.1 s), both `modifiers: [{attr: 63, value: {key: "taken_dmg", skill:
  "chr_0014_aurora_normal_skill"}}]`, `gameBuff:
  "buff_chr_0014_aurora_reduce_damage"`.
- **Triggers:**

```json
{ "id": "battle_cast", "on": { "event": "cast", "skills": ["chr_0014_aurora_normal_skill"] }, "by": "self",
  "skill": "chr_0014_aurora_normal_skill",
  "do": [{ "kind": "sp", "value": "atb_return_base" }, { "kind": "buff", "buff": "protection" }] },
{ "id": "counter", "on": { "event": "attacked" }, "by": "self",
  "do": [{ "kind": "jump", "skill": "chr_0014_aurora_normal_skill", "from": 0, "until": 51, "to": 107 }] },
{ "id": "counter_effects", "on": { "event": "cast", "skills": ["chr_0014_aurora_normal_skill"] }, "by": "self",
  "delay": 107, "skill": "chr_0014_aurora_normal_skill",
  "do": [{ "kind": "buff", "buff": "protection_counter" },
         { "kind": "energy", "value": "talent_2_sup", "if": { "talentAtLeast": [1, 1] } }] },
{ "id": "combo_energy_heal", "on": { "event": "cast", "skills": ["chr_0014_aurora_combo_skill"] }, "by": "self",
  "delay": 12, "skill": "chr_0014_aurora_combo_skill",
  "do": [{ "kind": "energy", "value": "usp" }, { "kind": "heal", "target": "team", "healKind": "combo" }] },
{ "id": "snow_zone_solidify", "on": { "event": "cast", "skills": ["chr_0014_aurora_ultimate_skill"] }, "by": "self",
  "delay": 126, "detached": true, "skill": "chr_0014_aurora_ultimate_skill",
  "do": [{ "kind": "apply", "applies": [{ "kind": "forcedReaction", "status": "solidification", "level": 1 }] }] }
```

  `counter_effects` relies on two engine behaviours, both checked in the
  scratch runs. On the counter path, the jump at the attack's frame
  brings the delayed actions at 107 forward to that frame. On the other
  path, the f106 end drops them. The snow zone hits:

```json
{ "id": "snow_zone", "scale": ["atk_scale_loop"], "count": 10,
  "frames": [81, 96, 111, 126, 141, 156, 171, 186, 201, 216],
  "events": ["buff_chr_0014_aurora_ultimate_skill_dmg"], "detached": true }
```

- **Waiting on gaps:**
  - G2: the draft's interim is (b), pending the owner's decision:
    `{ "id": "combo_window", "on": { "event": "attacked" }, "by":
    "controlled", "do": [{ "kind": "openCombo" }] }`. Once G2 exists:
    `"on": { "event": "attacked", "hpBelow": "trigger_hp_ratio" }` with
    `"skill": "chr_0014_aurora_combo_skill"`.
  - G3: `snow_zone_solidify`'s application gets `"extraSeconds":
    "extra_duration"` (value from the ultimate; 0 below P3).
  - G1 and G4 are engine and loader changes only: no kit change.
  - Optional: the loop heals as a team buff `{every: 0.5, duration:
    "duration"}` plus a `buffTick` trigger with a `heal` action. They
    matter only if a heal-triggered kit she can wear appears.
  - Not modelled (notes in the kit): the abilityEvent 9 grab branch,
    InterruptAction, TakeDownAction, hit-stops and the counter's
    slow-down (Ti1b), the frost slow-down on small enemies, and
    `ultimate_skill_limit`.

### Equipment kits

- **wpn_claym_0011** (Seeker of Dark Lung): a buff and a trigger, which
  acts before the burst's damage, as Umbra of Frigid Eventide's trigger on
  the same abilityEvent 127 does in log dbaee23b801d.

```json
"buffs": [{ "id": "wpn_claym_0011.atk_up", "label": "ATK (Seeker of Dark Lung)", "target": "self",
  "gameBuff": "buff_wpn_claym_0011_atk_up_up", "duration": "duration", "maxStacks": "max_stack",
  "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
"triggers": [{ "id": "wpn_claym_0011.burst", "on": { "event": "burst" }, "by": "self", "cooldown": 0.1, "beforeDamage": true,
  "skill": "sk_wpn_claym_0011", "do": [{ "kind": "buff", "buff": "wpn_claym_0011.atk_up" }] }]
```

  Whether the burst (and the bash that caused it) already counts the new
  layer is the same question as test 51 (an effect a hit triggers counting
  on that hit); a log of Snowshine with this weapon settles it.
- **wpn_claym_0012** (Finishing Call): no buffs or triggers. Its stat
  lines are in the panel, and its combo-heal bonus acts on heal amounts,
  which aren't simulated (`sources` say so, like suit_heal01).
