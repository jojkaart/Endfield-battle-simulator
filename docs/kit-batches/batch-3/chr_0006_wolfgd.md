# Wulfgard (chr_0006_wolfgd): gap report, batch 3

Phase 1 (analysis only), against the engine as of 7c7d00e (K2 done).
Equipment covered here ([batch-3.md](../batch-3.md)): wpn_pistol_0004
(Rational Farewell), wpn_pistol_0006 (Opus: The Living), wpn_pistol_0012
(OBJ Velocitous). No gear set.

Sources: rmxlinux `Json/SkillData/chr_0006_wolfgd_*` and
`Json/BuffData/buff_chr_0006_wolfgd_*` (fetched by 535e88f; they weren't in
the sparse checkout when this analysis started, so nothing below rests on
the earlier gap), `sk_wpn_pistol_00{04,06,12}`, `buff_wpn_pistol_00{04,06,12}_*`,
`buff_common_fire_fire_burning_triggered`; TableCfg CharGrowthTable,
SkillPatchTable, CharacterPotentialTable, PotentialTalentEffectTable,
WeaponBasicTable, I18nTextTable_EN; `efsim kit-draft chr_0006_wolfgd`.
Cross-checks (claims, read only): Endaxis's compiled copy of the same
SkillData (`reference/Endaxis/src/data/operators/wulfgard.generated.ts`, no
code copied) agrees with every frame and branch below; Zero Sanity's
Wulfgard files (MIT, frames taken from Endaxis) place the combo hit at 0.9 s,
which would be about 15 frames of projectile travel after the launch at 12.
No earlier report covers Wulfgard; batch-1/2 facts used (abilityEvent 102 /
206 = "the wielder applies a buff", 127 = "applies an Arts Burst", 208 =
"removes a buff"; tag 1474064594 = Arts Reaction; stackingType 4 refreshes)
were re-checked against the files that use them.
Scratch: `/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0006_wolfgd/`
(draft kits in `kits/`, a repo copy running them in `repo/`, scenarios
`wulf-solo.scenario.json`, `s-lock.json`, `s-react.json`).

## Skill values (SkillPatchTable, level 1 / 12)

| Skill | Values | Cooldown / cost |
|---|---|---|
| attack1 / 2 / 3 | `atk_scale` 0.15/0.34, 0.18/0.39, 0.19/0.42 per shot (`display_atk_scale` = 2×, 2×, 3×: 2, 2 and 3 shots); `atb` 0 | |
| attack4 | `atk_scale` 0.68/1.52, `poise` 18, `atb` 18 | |
| power_attack (finisher) | `atk_scale` 4/9 (BreakingAttackCalculation, multiplier 1) | |
| plunging_attack_end | `atk_scale` 0.8/1.8 | |
| dash_attack | `atk_scale` 0.43/0.96, `poise` 5 | |
| normal_skill (battle) | `atk_scale` 0.34/0.77 per shot (display 2.3 = 3 shots), `poise_first_bullet` 1.67 (×3 = 5), `atk_scale_plus` 3.78/8.5, `poise_extra_bullet` 5, `atk_scale_plus_fail` 0.36/0.81, `poise_extra_bullet_fail` 0 | 100 SP |
| combo_skill | `atk_scale` 0.6/1.35, `poise` 10, `usp` 10 | 20 s (19 s at 12) |
| ultimate_skill | `atk_scale` 0.32/0.72 per hit (display 3.6 = 5 hits), `poise` 3 (×5 = 15) | 90 energy, 10 s |

Talents (PotentialTalentEffectTable): talent 1 "Scorching Fangs" attaches
buff `buff_chr_0006_wolfgd_talent_0` (`add` 0.2 / 0.3, `duration` 10);
talent 2 "Code of Restraint" sets the battle skill's `returnskillpower` 5 / 10
and `talent2` 1. Potentials: P1 Strength +15, Agility +15; P2 sets
`potential_skillpower` 10 and `potential_2` 1; P3 sets `potential_3` 1 and
`teammate_percent` 0.5; P4 ultimate cost ×0.85; P5 sets the ultimate's
`potential_5` 1. Attribute nodes: Strength +10 / 15 / 15 / 20.

Weapons at skill level 9 (SkillPatchTable): Rational Farewell: Strength
+124, Heat DMG +34.67%, `dmg_up` 0.28, `atk_up` 0.448, `duration` 15. Opus:
The Living: Agility +124, Arts DMG +34.67%, `crit_up` 0.084, `atk_up` 0.21,
`duration` 20, `max_stack` 2, `cd` 0.1. OBJ Velocitous: Agility +124,
Ultimate Gain Efficiency +37.14%, `atk_up` 0.14, `nature_dmg_up_mult` 0.14,
`duration` 20.

## SkillData / BuffData action types

Presentation types (effects, sound, camera, animation, root motion,
rotation, teleport, weapon visibility, voice, UI, debug) left out. D =
damage, R = resources, S = state, T = timing / legality.

| File | Gameplay types | Affect |
|---|---|---|
| attack1 / 2 / 3 | LaunchProjectile (attack1: 7 → projhit01, 14 → projhit; attack2: 10, 16; attack3: 12, 18, 24), AllowNextSkillAction (24–49 → attack2; 23–38 → attack3; 32–52 → attack4), ComboCacheAction, CheckMainCharacterCondition, SetSuperArmorAction | D, T |
| attack1_projhit / _projhit01 / attack2_projhit / attack3_projhit | DamageAction `atk_scale` (mask 128), ObtainCostAction costType 1 `atb` × 0.5 / × 0.333 inside CheckMainCharacterCondition (`atb` 0) | D, R |
| attack4 | LaunchProjectile at 23 → attack4_projhit | D, T |
| attack4_projhit | DamageAction `atk_scale` mask 2097280 (Final Strike) + a poise unit `poise` with onlyEnableForMainChar; ObtainCostAction `atb` (atbGainMethod 0) for the controlled operator | D, R |
| power_attack | DamageAction BreakingAttackCalculation (frame 34, multiplier 1), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` and `full_immune_medium`, HitStopAction, window → battle, combo | D, R, T |
| plunging_attack_end | DamageAction (frame 2, mask 1152) | D |
| dash_attack / _projhit | LaunchProjectile → DamageAction `atk_scale`, poise, ObtainCostAction (skillSpecification 7) | D |
| normal_skill (battle) | frames 0–2: IfElse CheckTagMatch on the smart target, tags −1110095722 (Burning = Combustion) or 1466867135 (Conduct = Electrification) → ModifyDynamicBlackboard `SpellInflict` = 1; LaunchProjectile at 6 and 16 → normal_skill_projhit; at 23: IfElse `SpellInflict` ≥ 1 → projhit_1, else → projhit_FireSpellInfiction, then CreateBuff `buff_common_obtain_ultimate_sp` (CheckSquadInFight); at 31: IfElse `SpellInflict` ≥ 1 → **JumpToAction 118**; MarkCanInterrupt 48–51; **JumpToAction 117 → 247** (unconditional); at 141: LaunchProjectile → plus_projhit, and IfElse `potential_3` > 0 and CheckBuffStackNumAdvanced `buff_chr_0006_wolfgd_talent_0_effectbuff` ≥ 1 → GetTargetBuffBBAdvanced `add`, `duration` of `buff_chr_0006_wolfgd_talent_0`, CreateBuff effect buff on Wulfgard, FindTarget CharacterTeamFinder (no validator: the whole team), ModifyDynamicBlackboard `teammate_percent` × `add`, CreateBuff effect buff (`add` = `teammate_percent`) on the team; AllowNextSkillAction 32–54 and 152–184 → normal_skill; durationFrame 272, exclusiveFrame 159 | D, R, S, T |
| normal_skill_projhit | InterruptAction 1 s, DamageAction `atk_scale` (mask 4352) + poise `poise_first_bullet` | D |
| normal_skill_projhit_FireSpellInfiction | SpellInfliction (Heat), DamageAction `atk_scale` + `poise_first_bullet` | D, S |
| normal_skill_projhit_1 | DamageAction `atk_scale` + `poise_first_bullet` (no infliction) | D |
| normal_skill_plus_projhit | InterruptAction; IfElse CheckTagMatch smart target Burning / Conduct: succeed → IfElse `talent2` > 0 → (IfElse `potential_2` > 0 → `returnskillpower` += `potential_skillpower`), ObtainCostAction costType 1 `returnskillpower` (atbGainMethod 1: returned), then DamageAction `atk_scale_plus` + poise `poise_extra_bullet`; fail → SpellInfliction (Heat), DamageAction `atk_scale_plus_fail` + `poise_extra_bullet_fail`; **after it**: IfElse target has Burning → FinishBuffByTag Burning, else Conduct → FinishBuffByTag Conduct | D, R, S |
| combo_skill | TimeDilationAction ComboSkill 0.6 s (global), LaunchProjectile at 12 → combo_skill_projhit, AllowNextSkillAction 30–65 → normal_skill; durationFrame 138, exclusiveFrame 30 | T |
| combo_skill_projhit | SpawnAbilityEntity `abilityentity_chr_0006_wolfgd_combo_skill` → combo_skill_abilityrange; CreateBuff tutorial marker | S |
| combo_skill_abilityrange | at entity frame 0: InterruptAction, SpellInfliction (Heat), DamageAction `atk_scale` (mask 12288) + poise `poise`, ObtainCostAction costType 0 `usp` (unconditional) | D, R, S |
| ultimate_skill | frames 0–14: IfElse `potential_5` > 0 → SetSkillCdAtOnce functionType 1, skillTypeMask 64 (combo), value 0; UltimateTimeAction 0–46; TimeDilationAction layer 1 RESETto1 on itself (scale 1: no effect); DamageAction `atk_scale` + poise `poise` at 46, 52, 59, 64, 69 (mask 4608; InterruptAction 1 s on the first, disabled on the others); ChannelingAction 45–72 (every 0.2 s, maxCountPerTarget 1) → CreateBuff `buff_common_fire_fire_burning_triggered` on target group `target1` (found at 46); six LaunchProjectile `projectile_chr_0006_wolfgd_UltimateWolf` at 45–65 with every castSkillOn… flag false (visual); CreateBuff damage immunity 0–80; AllowNextSkillAction 75–89 → normal_skill, combo_skill; durationFrame 168, exclusiveFrame 80 | D, S, T |
| talent_0 (SkillData) | `buffs` → buff_chr_0006_wolfgd_talent_0 | S |
| buff_…_talent_0 | lifeType 1 (permanent); abilityEventAction 102 (Wulfgard applies a buff) + CheckBuffIdInContext tag −1110095722 (Burning) → CreateBuff `buff_chr_0006_wolfgd_talent_0_effectbuff` (`duration`, `add`) on him | S |
| buff_…_talent_0_effectbuff | attr 51 (Heat DMG) formulaItem 5 + `add`, duration `duration`, stackingType 4 (refreshed), max 1 | D |
| Orphans | `chr_0006_wolfgd_talent_1` + `buff_…_talent_1` (combo cooldown × `ratio` on abilityEvent 222: an older talent 2; PotentialTalentEffectTable's talent 2 only sets blackboard keys), `buff_…_talent_atkup`, `_potential_atkup`, `_potential_5`, `_extra_attack` + `chr_0006_wolfgd_extra_attack`, `_ultimate_skill`, `_ultimate_skill_plus`, `chr_0006_wolfgd_ultimate_skill_projhit` (+ its `_damage`, `_mark` buffs), `_normal_skill_hit`, `_normal_skill_usp`: nothing reachable names them | none |
| sk_wpn_pistol_0004 | cardAttributeModifier attr 32 (Battle Skill DMG) + `dmg_up`; passiveEventActions 127 + CheckOriginSkillType [6] → `buff_wpn_pistol_0004_atk_up`; 206 + CheckOriginSkillType [6] + CheckBuffIdInContext tag −1110095722 → the same buff (attr 2 formulaItem 6 + `atk_up`, `duration`, stackingType 2 max 1) | D |
| sk_wpn_pistol_0006 | cardAttributeModifier attr 9 (Crit Rate) + `crit_up`; 206 + tag 1474064594 (Arts Reaction) + CheckTimedMarkerCondition / CreateTimedMarker `cd` → `buff_wpn_pistol_0006_atk_up_up` (attr 2 formulaItem 6 + `atk_up`, `duration`, stackingType 2, maxStackCnt from `max_stack`) | D |
| sk_wpn_pistol_0012 | cardAttributeModifier attr 2 formulaItem 6 + `atk_up`; 208 + tag −193971080 (Arts Infliction; Liino's projectile smart-targets it with 1474064594) + CheckConsumeBuffLayer ≥ 1 (`count`) + SimpleCalcBB `nature_dmg_up` = `nature_dmg_up_mult` × `count` → `buff_wpn_pistol_0012_natural` (attr 54 + value, `duration`, stackingType 1 with priority key) | D |
| Weapon orphans | `buff_wpn_pistol_0004_up`, `buff_wpn_pistol_0006_crit_up`, `buff_wpn_pistol_0012_atk_up` (stackingType 7, named by nothing); toggleBuffs `buff_wpn_passive_spirit_01` has no file (as in batches 1–2) | none |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–3: 2, 2, 3 projectiles, `atk_scale` each (frames 7/14, 10/16, 12/18/24); `atb` 0 | supported | hits with their projhit `events` (detached by the loader's default) |
| 2 | Attack4: one projectile at 23, Final Strike; "As the controlled operator, Final Strike also deals {poise} Stagger" (poise unit onlyEnableForMainChar), SP `atb` 18 for the controlled operator | supported | `sp: {if: {controlled: true}, then: atb}`, `poise`, `poiseControlledOnly` |
| 3 | Attack4's `atb` is natural SP (atbGainMethod 0); the engine counts every kit SP grant as returned | gap (known) | V3 / K5 (batch 2), every kit |
| 4 | Chain windows 24–49, 23–38, 32–52; `dontInterruptCombo` on the battle skill and combo | supported (data) | loader (chainStep, keepsChain) |
| 5 | Finisher: BreakingAttackCalculation `atk_scale` 9 at 34, multiplier 1, disable-cast buff | supported | P2 finisher; no factor |
| 6 | Dive attack (skillSpecification 6) | supported | not castable until rotations have jumps (S10) |
| 7 | Dash attack (`dash_attack`, `atk_scale` 0.96, poise 5) | gap (engine-wide) | G5: not modelled for any operator (design.md "Enemy attacks and dodges") |
| 8 | Battle skill shots 1–2 at 6 and 16, `atk_scale`, poise `poise_first_bullet` | supported | one hit, count 2 |
| 9 | "If the target has active Combustion or Electrification": the data decides it at frames 0–2 (`SpellInflict`, CheckTagMatch Burning / Conduct on the smart target) | supported | a cast trigger with `if: {any: [{enemyStatus: combustion}, {enemyStatus: electrification}]}` → marker buff `spell_inflict` (`endsWithCast`) |
| 10 | Third shot at 23: "The final shot also applies Heat Infliction" unless the flag is set (projhit_FireSpellInfiction vs projhit_1) | supported | two hits in `branch: shot3` on `buffActive: spell_inflict` |
| 11 | Team energy at 23 (`buff_common_obtain_ultimate_sp`, ratio 1) | supported | `teamEnergy: [{frame: 23, ratio: 1}]` |
| 12 | With the flag, JumpToAction 31 → 118 (inside an IfElse) | gap | G2: the loader reads only top-level jumps, so `KitSkill.jumps` can't name it. Interim: a delayed cast trigger with `do: jump` (as Catcher's counter) |
| 13 | Without it, JumpToAction 117 → 247 (unconditional, top level) | supported (data) | skips frames 118–246 (the extra shot and P3) |
| 14 | MarkCanInterrupt at 48 (on the plain path only: the reaction path's jump skips it) | gap | G1: not read. The engine holds a plain cast until real frame 117 (exclusiveFrame 159 sits in the skipped frames) instead of 48: 2.3 s per plain battle skill for basic attacks and a second battle skill |
| 15 | Windows 32–54 and 152–184 → battle skill; exclusiveFrame 159 (reaction path: real 72) | supported (data) | loader |
| 16 | "… consume the Arts Reaction to fire an additional shot that deals massive Heat DMG": launched at 141 (real 54 after the jump), `atk_scale_plus` 8.5, poise 5; at landing the target is checked again: without Burning / Conduct it deals `atk_scale_plus_fail` 0.81 with Heat Infliction and no poise | supported | two hits in `branch: extra` (`if` enemyStatus at landing / else), frame 141 (the jump pulls it to 54; the 117 jump drops it) |
| 17 | The extra shot consumes Combustion, else Electrification, **after** its damage (FinishBuffByTag after the DamageAction) | gap | G3: a hit's applications act before its damage, so a `consumeStatus` on the hit would lose Electrification's Arts DMG Taken (+12–24% × Arts Intensity effect) on an 8.5 × ATK shot. Interim: the hit applies a marker after its damage, and two `buffApplied` triggers consume |
| 18 | Projectiles launched at 23 and 141 are "detached" for the loader (logged under projhit keys): a detached hit lands even when its launch frame is skipped by a jump or the cast is cut first (scratch run: the plain path's extra shot landed at 4.7 s, unshifted) | gap | G4. Interim: the battle skill's hits `detached: false` |
| 19 | A rotation step without `at` after a plain battle skill waits until real 117: the extra-shot hits stay pending until the 117 → 247 jump drops them | gap | G4 (second part) |
| 20 | Talent 1: "Whenever Wulfgard applies Combustion, he gains Scorching Fangs for {duration}s. This effect cannot stack. … Heat DMG Dealt +{add}" (abilityEvent 102 + Burning tag: his reactions and his ultimate's forced Combustion) | supported | `{on: reaction, statuses: [combustion], by: self}` → self buff attr 51 `{talent: 0, key: add}`, refreshed |
| 21 | Whether Scorching Fangs (and the weapons' buffs, W2 W4 W6) already count on the hit whose infliction forms the reaction | unknown | the data's SpellInfliction comes before its DamageAction, so the draft uses `beforeDamage: true`; Hot Work's kit doesn't for the same event. In-game test 51 |
| 22 | Talent 2: "Whenever the battle skill Thermite Tracers successfully consumes an Arts Reaction, return {returnskillpower} SP" (5 / 10), on the extra shot's succeed branch, returned SP | supported | extra shot `sp: {if: {talentAtLeast: [1, 1]}, then: {sum: [returnskillpower, potential_skillpower]}}` (scratch run: +20 at P5) |
| 23 | P1 Strength +15, Agility +15 | supported (data) | stat panel |
| 24 | P2: "Returns {potential_skillpower} additional SP" (only inside `talent2` > 0) | supported | the sum in row 22 (`potential_skillpower` is 0 below P2) |
| 25 | P3: "While Scorching Fangs is active, triggering the battle skill's additional effects immediately resets the Scorching Fangs duration and grants other teammates Scorching Fangs with {teammate_percent} of the base effects" (at the extra shot's launch, frame 141) | supported | delayed cast trigger (delay 141; skipped on the plain path) with action `if`s `potentialAtLeast 3` and `buffActive: scorching_fangs` → `scorching_fangs` and a team buff `scorching_fangs_team` (`recipients: not isOwner`, `add` × `teammate_percent`) |
| 26 | P3's second CreateBuff targets the whole team (CharacterTeamFinder without a validator), Wulfgard included, with the 50% value, on a stackingType-4 buff he already has | unknown | if a refresh takes the new instance's values, his own Fangs drops to 15%. Interim: the description (teammates only). In-game test W3, or a log |
| 27 | P4 ultimate cost ×0.85 (76.5) | supported (data) | skillParamModifier; scratch run starts full at 76.5 |
| 28 | P5: "Casting the ultimate Wolven Fury immediately resets the cooldown of the combo skill" | supported | cast trigger `if: potentialAtLeast 5` → `{kind: cooldown, who: self, skills: combo, set: 0}` |
| 29 | Combo trigger: "When an Arts Infliction is applied to an enemy" (by anyone) | supported | `{on: inflictionApplied, by: anyone}` → openCombo |
| 30 | Whether an infliction that forms a reaction at once opens the window | unknown | interim: no (`inflictionApplied` excludes it; Endaxis's native event for this combo is "before take infliction", which suggests yes). In-game test 35, Wulfgard variant W4 |
| 31 | Combo: grenade launched at 12, entity at the target: Heat Infliction, `atk_scale`, poise 10, `usp` 10 | supported | one hit (frame 12: launch; travel Ti2, open) |
| 32 | Combo TimeDilationAction ComboSkill 0.6 s, window 30–65 → battle skill, cooldown 20 / 19 s | supported (data) | Ti1, loader |
| 33 | Ultimate: "dealing 5 hits of Heat DMG" at 46, 52, 59, 64, 69, `atk_scale`, poise 3 each | supported | one hit, count 5 (DamageActions in the skill: not detached) |
| 34 | Ultimate: "forcibly applying Combustion" (ChannelingAction → `buff_common_fire_fire_burning_triggered`: level I, 10 s) | supported | delayed cast trigger (delay 45) `apply forcedReaction combustion` |
| 35 | When the forced Combustion lands: the channel's first tick at 45 targets group `target1`, which the frame-46 FindTargetAction fills; the next tick is at 51 | unknown | interim 45 (the compiler's frame): all five hits get Scorching Fangs; at 51 the first doesn't (about 4% of the ultimate's damage). A log's `buff_common_fire_fire_burning_triggered` time settles it; not testable by hand |
| 36 | Ultimate time stop 0–46, damage immunity 0–80, window 75–89 → battle, combo; cooldown 10 s | supported (data) | Ti1, loader |
| 37 | The ultimate's six wolf projectiles name `normal_skill_plus_projhit` but cast nothing (every castSkillOn… false) | supported | no hits (kit-draft agrees) |
| 38 | InterruptActions (battle-skill shots, extra shot, combo, ultimate's first hit) | supported | no effect (not Immobilization: no control tag) |
| 39 | Orphan files (action-type table) | supported | left out |
| 40 | kit-draft leftovers: no poise on any hit; attack4's controlled-only poise; the battle skill's IfElse branches listed as five landings with notes; the talent-2 SP "not a kit value"; the IfElse jump "not followed"; the forced Combustion only as a note | data | D3 (batch 2) |
| W1 | Rational Farewell: Strength, Heat DMG, Battle Skill DMG +`dmg_up` | supported (data) | stat panel (`calc`: 28% at level 9) |
| W2 | Rational Farewell: "When the wielder's combo skill applies Arts Burst or Combusted, the wielder gains ATK +{atk_up} for {duration}s. Effects of the same name cannot stack." | supported | `{on: burst, fromKinds: [combo]}` and `{on: reaction, statuses: [combustion], fromKinds: [combo]}`, by self → self ATK buff (scratch run: +44.8% on Wulfgard's combo after a Heat burst) |
| W3 | Opus: The Living: Agility, Arts DMG, Crit Rate +`crit_up` | supported (data) | stat panel |
| W4 | Opus: "When the wielder applies an Arts Reaction, the wielder gains ATK +{atk_up} for {duration}s. Max stacks … {max_stack}. Duration of each stack is counted separately. Effect only triggers once every 0.1s." | supported | `{on: reaction, by: self, cooldown: cd}` → layered self buff `maxStacks: max_stack` (forced reactions count: the engine's `reaction` event includes them) |
| W5 | OBJ Velocitous: Agility, Ultimate Gain Efficiency, ATK +`atk_up` | supported (data) | stat panel |
| W6 | Velocitous: "After the wielder consumes an Arts Infliction, the wielder gains Nature DMG Dealt +[{nature_dmg_up_mult} × Stacks Consumed] for {duration}s. Effects of the same name cannot stack." | supported | `{on: inflictionConsumed, by: self}` → self buff attr 54 `{product: [nature_dmg_up_mult, {eventCount: true}]}` (values at the event: K2, 7c7d00e) |
| W7 | Velocitous: whether a reaction's consumption of the infliction it lands on fires abilityEvent 208 for the applier, and whether a weaker instance replaces a stronger one (stackingType 1, priority key) | unknown | engine: yes to both (inflictionConsumed includes reactions; a reapplication replaces, as Grizzled Edge's kit assumes). A log with a Nature wielder forming reactions settles both |

**Counts** (47 rows): supported 34 (10 of them `supported (data)`: rows
4, 13, 15, 23, 27, 32, 36, W1, W3, W5), gap 7 (rows 3 (V3, batch 2), 7
(G5), 12 (G2), 14 (G1), 17 (G3), 18 and 19 (G4)), data 1 (row 40, D3),
unknown 5 (rows 21, 26, 30, 35, W7), unique? 0. New gaps G1–G5 below; V3,
D3, Ti2 and tests 35 / 51 are batch-1/2 items. G1's exact meaning (from the
mark on, or only during it) rests on Typhoeus's combo and test W1.

## Gaps

### G1. MarkCanInterrupt: a skill becomes interruptible from a frame

- **family:** skills (timing)
- **feature:** the loader reads `MarkCanInterrupt` on a skill's own
  timeline (not inside a condition) as `SkillTiming.interruptibleFrom`:
  from that frame on, `actionGate` treats the skill as past its exclusive
  frames (any skill may start, as after `exclusiveFrame`). A mark inside
  frames a jump skips isn't reached. Several marks: the first one reached
  counts (Typhoeus's floating attack4 has five, each at the start of a
  shot's loop; Purrchena's battle skill has marks beyond its duration,
  reached only through its loops).
- **evidence:** `chr_0006_wolfgd_normal_skill` MarkCanInterrupt 48–51,
  exclusiveFrame 159, JumpToAction 117 → 247. The same action in
  `chr_0007_ikut_normal_skill` (34; exclusive 164), `chr_0014_aurora_normal_skill`
  (67; exclusive 145), `chr_0020_meurs_normal_skill` (129; exclusive 285),
  `chr_0034_typhoea_combo_skill` (60 = its exclusive frame),
  `chr_0034_typhoea_floating_attack4` (58, 210, …; exclusive 999),
  `chr_0038_purrche_combo_skill` (28; exclusive 330) and its battle-skill
  loops. Typhoeus's combo, where the mark sits exactly on the exclusive
  frame, is the case that fixes the meaning; Arclight's, Snowshine's and
  Catcher's would shorten their locks by 1.1–5.2 s.
- **impact:** Wulfgard's plain battle skill holds him 3.9 s instead of
  1.6 s (scratch `s-lock.json`: attack1 at 3.90 s): about 2.3 s of basic
  attacks lost per plain battle skill in rotations that follow it with
  basic attacks or another battle skill. Combos and ultimates aren't held
  (higher priority). Settled by in-game test W1.

### G2. Jumps inside a timeline IfElse are conditional jumps

- **family:** data compilation (timing)
- **feature:** `readSkillFile` also collects a JumpToAction in the
  succeed / fail actions of a top-level IfElseAction on the timeline, as a
  `conditional` jump at that timeline frame, so `KitSkill.jumps: [{at,
  if}]` can name it (the kit writes what the IfElse condition means, here
  the cast-time flag). kit-draft already sees it ("JumpToAction at f31 …
  (if $SpellInflict? ≥ 1) → frame 118; not followed").
- **evidence:** `chr_0006_wolfgd_normal_skill` frames 31–32: IfElse
  CompareFloat `SpellInflict` ≥ 1 → JumpToAction 118. Same shape in
  `chr_0024_deepfin_combo_skill` (0, 10), `chr_0038_purrche_combo_skill`,
  `chr_0038_purrche_normal_skill_loop_1/_2`, `chr_0034_typhoea_floating_attack1…4`
  and `chr_0032_lizhiyan_combo_skill_abilityentity_seal_again` (41).
- **impact:** without the interim, Wulfgard's additional shot (8.5 × ATK,
  the reaction consumption, talent 2's SP and P3) never happens: the
  unconditional 117 → 247 jump always skips it. The interim (a delayed cast
  trigger with `jump`, judged at the cast) is exact, so this is cleanup
  that turns one trigger into data.

### G3. An application that acts after its hit's damage

- **family:** arts state
- **feature:** `KitApplication.afterDamage?: true`: the application runs
  after the hit's damage (and its own `if` is judged then), for data where
  FinishBuffByTag / a consumption follows the DamageAction. Default stays
  "before" (Gilberta's and Arcane's logs).
- **evidence:** `chr_0006_wolfgd_normal_skill_plus_projhit`: the IfElse with
  the DamageAction, then IfElse Burning → FinishBuffByTag Burning, else
  Conduct → FinishBuffByTag Conduct. Engine: "What a hit applies takes
  effect before its own damage" (timeline assumptions). No other kit uses
  `consumeStatus` yet; the merge should check the batch's other consumers
  of reactions (and Laevatain's absorption) for the same order.
- **impact:** on an Electrified target the additional shot loses
  Electrification's Arts DMG Taken (12–24% × the Arts Intensity effect)
  if it consumes before its damage. The interim (a 0.1 s marker the hit
  applies after its damage, and two `buffApplied` triggers, both judged at
  the event so Combustion is preferred) is exact but roundabout.

### G4. A detached hit belongs to its cast until its launch frame

- **family:** skills (timing)
- **feature:** (a) a hit whose `events` make it detached (projectile or
  entity) is detached only from its launch frame (`frames`): before that a
  cut cast drops it, and a jump over its launch frame drops it, as for the
  cast's own hits; after it, it lands whatever happens. (b) A rotation
  step without `at` doesn't wait for hits that a jump already due on the
  cast (an unconditional one, or a conditional one already taken) will
  skip.
- **evidence:** scratch run (draft with the loader's default `detached`):
  the plain cast at 2.5 s, cut at 6.0 s, still landed its frame-141 extra
  shot at 7.2 s (consuming Combustion), and a second plain cast's extra
  shot landed at 10.7 s although the 117 → 247 jump skips its launch.
  batch-1's open item "a detached hit dropped if its cast is cut before its
  entity exists (Laevatain: frames 0–3 of her battle skill)" is part (a).
  Part (b): with `detached: false`, a combo without `at` after a plain
  battle skill waited until 9.9 s (6.0 + 117 frames) for the pending
  frame-141 hits.
- **impact:** with the default, phantom 8.5 × ATK shots on every plain
  battle skill (about 15–18k each at level 12); with the interim
  (`detached: false`), shots in flight are cut by a later skill (small:
  kit frames are launch frames) and steps without `at` wait 3.9 s after a
  plain battle skill (rotations can write `at`).

### G5. Dash attacks

- **family:** skills
- **feature:** a dash attack (skillSpecification 7, `dash_attack`) as a
  rotation action after a dash. Every operator has one; design.md lists
  "the dash attack" as not modelled.
- **evidence:** `chr_0006_wolfgd_dash_attack` → `_dash_attack_projhit`
  (`atk_scale` 0.96, poise 5); `*_dash_attack` files for every operator in
  the data.
- **impact:** small (rotations don't dash except to dodge). Not
  Wulfgard's; listed so the merge can propose to defer it engine-wide.

## Verification

- **Logs:** no fixture has Wulfgard. OBJ Velocitous is in
  `fixtures/pending/zmdlogs-abfd4b7478ec.json` on Fluorite (level 20,
  skill 3 at level 3): with the draft weapon kit in the scratch copy,
  `zmdlogs check` is unchanged (Fluorite 56 hits, 56 match, 100% covered;
  diff of the full output against the main checkout's: none). Fluorite
  consumes no infliction there (her hits carry no
  `buff_wpn_pistol_0012_natural`), so this only shows the kit adds nothing
  where it shouldn't.
- **Logs that would verify the kit:** a ZMDLogs battle with Wulfgard
  casting (1) his ultimate: the forced Combustion's time
  (`buff_common_fire_fire_burning_triggered`) against the first hit (row
  35), `buff_chr_0006_wolfgd_talent_0_effectbuff` (0.3) on the hits; (2)
  battle skills on Combusted and Electrified targets: the
  `chr_0006_wolfgd_normal_skill_plus_projhit` hit at 8.5 × ATK about 1.8 s
  after the cast (jumps skip time), Electrification's Arts DMG Taken on it
  (G3), the fail branch's 0.81; (3) at P3 with teammates: the teammates'
  effect buff at 0.15 and Wulfgard's own value after the trigger (row 26);
  (4) combos after a teammate's reaction-forming infliction (row 30); (5)
  each weapon's buff (`buff_wpn_pistol_0004_atk_up`, `_0006_atk_up_up`,
  `_0012_natural`). Wulfgard is common, so such a log is a good request.
- **Scratch simulations** (`wulf-solo.scenario.json`, P5, Rational
  Farewell, level 12): ultimate (Combustion at 1.50 s, five hits with
  Scorching Fangs), battle skill at 2.50 s on the Combusted enemy (jump,
  extra shot 17,870 at 4.30 s, Combustion consumed, SP +20), plain battle
  skill at 6.00 s (Heat Infliction opens the combo), combo at 9.90 s
  (Heat burst, Rational Farewell's ATK +44.8%, Fangs refreshed by P3
  until 14.3 s). `s-react.json`: Fluorite's Nature then Wulfgard's combo
  forms Combustion (Fangs on the combo hit, before its damage), then his
  battle skill's extra shot with one Link stack (×1.3).

### In-game tests (proposed; observable by eye or a 2 s stopwatch difference)

Cross-checked with the list: 17 (jumps skip time) and 35 (combo windows by
reactions) ask the same questions with Laevatain and Gilberta / Arcane;
W2 and W4 are easier versions for a common operator. 51 governs row 21.

- **W1. How long a plain Thermite Tracers holds Wulfgard** (ready, if you
  have Wulfgard; G1). On a dummy with no Combustion or Electrification:
  cast the battle skill and keep pressing basic attack. Then on a
  Combusted dummy (right after his ultimate, while it burns) do the same.
  Prediction, time from the cast to the first basic-attack shot: data with
  the mark: plain **about 1.6 s**, Combusted about 2.4 s (plain is sooner);
  engine today: plain **about 3.9 s**, Combusted 2.4 s (plain is later).
- **W2. Do jumps skip time? (Wulfgard)** (ready, if you have Wulfgard;
  S1's interim, test 17's question). On a Combusted dummy, cast the battle
  skill and time from the cast (or the first small shot numbers) to the big
  additional shot's number. With skips **about 1.8 s** (plus travel); without
  **about 4.7 s**. A second sign: with skips Wulfgard can attack again
  about 2.4 s after the cast; without, about 5.3 s.
- **W3. P3: does Wulfgard keep his full Scorching Fangs?** (ready, if you
  have Wulfgard at P3+). After his ultimate (Scorching Fangs on), note the
  non-crit damage numbers of basic attack 1; cast the battle skill on the
  still-Combusted dummy (the additional shot triggers P3), then basic
  attack 1 again within the 10 s. No combos in between (Link, Rational
  Farewell). Same numbers: he keeps +30% (description, engine). About 9–10%
  lower (with a +34.7% Heat or Arts DMG weapon; 11–12% without): his copy
  became the teammates' 15%.
- **W4. Combo window from a reaction (Wulfgard)** (ready, if you have
  Wulfgard; test 35). A teammate applies a non-Heat infliction (his combo
  lights); wait about 7 s until the button goes dark again (the window is
  6 s; the infliction lasts 20 s); then a second teammate applies a
  different element, forming a reaction. Does Wulfgard's combo light up?
  Engine: no.

Not testable by hand: row 35 (6 frames), the combo's projectile travel
(Ti2, test 47).

## Kit plan

Draft files (loaded with the real loader in the scratch repo copy: `calc`,
`simulate`, `packages/data/test/kits.test.ts` 232 passed,
`skillCompile.test.ts` 12 passed; `zmdlogs check` of abfd4b unchanged):
`…/scratch-chr_0006_wolfgd/kits/chr_0006_wolfgd.json`,
`wpn_pistol_0004.json`, `wpn_pistol_0006.json`, `wpn_pistol_0012.json`.

### Operator kit chr_0006_wolfgd

- **Stacks:** none.
- **Buffs:** `spell_inflict` (self, marker, `endsWithCast`, 10 s);
  `scorching_fangs` (self, `gameBuff` …talent_0_effectbuff, attr 51
  `{talent: 0, key: add}`, duration `{talent: 0, key: duration}`);
  `scorching_fangs_team` (team, `recipients: {not: {isOwner: true}}`, attr
  51 `add × teammate_percent`); `extra_shot_landed` (self, 0.1 s marker,
  G3 interim).
- **Skills** (frames are SkillData frames; projectile hits at launch):
  - attack1: `projhit01` [7], `projhit` [14]; attack2: ×2 [10, 16];
    attack3: ×3 [12, 18, 24]; all `atk_scale`, events their projhit files.
  - attack4: [23], `sp: {if: {controlled: true}, then: atb, else: 0}`,
    `poise: poise`, `poiseControlledOnly`; Final Strike from the data.
  - power_attack [34]; plunging_attack_end [2].
  - normal_skill: `teamEnergy: [{frame: 23, ratio: 1}]`; every hit
    `detached: false` (G4); hits:
    ```json
    { "id": "shot", "scale": ["atk_scale"], "count": 2, "frames": [6, 16], "events": ["chr_0006_wolfgd_normal_skill_projhit"], "poise": "poise_first_bullet" },
    { "id": "shot3_plain", "branch": "shot3", "frames": [23], "events": ["chr_0006_wolfgd_normal_skill_projhit_FireSpellInfiction"], "if": { "not": { "buffActive": "spell_inflict" } }, "applies": [{ "kind": "infliction", "element": "fire" }], … },
    { "id": "shot3_reaction", "branch": "shot3", "frames": [23], "events": ["chr_0006_wolfgd_normal_skill_projhit_1"], "if": { "buffActive": "spell_inflict" }, … },
    { "id": "extra_shot", "branch": "extra", "scale": ["atk_scale_plus"], "frames": [141], "events": ["chr_0006_wolfgd_normal_skill_plus_projhit"], "poise": "poise_extra_bullet",
      "if": { "any": [{ "enemyStatus": "combustion" }, { "enemyStatus": "electrification" }] },
      "sp": { "if": { "talentAtLeast": [1, 1] }, "then": { "sum": ["returnskillpower", "potential_skillpower"] }, "else": 0 },
      "buffs": [{ "buff": "extra_shot_landed" }] },
    { "id": "extra_shot_fail", "branch": "extra", "scale": ["atk_scale_plus_fail"], "frames": [141], "events": ["chr_0006_wolfgd_normal_skill_plus_projhit"], "poise": "poise_extra_bullet_fail", "applies": [{ "kind": "infliction", "element": "fire" }] }
    ```
    Frame 141 is pulled to real 54 by the 31 → 118 jump and dropped by the
    117 → 247 jump; no extra condition is needed.
  - combo_skill: one hit [12], events `chr_0006_wolfgd_combo_skill_abilityrange`
    (detached), `applies: [{infliction: fire}]`, `poise`, `energy: usp`.
  - ultimate_skill: one hit, count 5, [46, 52, 59, 64, 69], `poise`.
- **Triggers:**
  - `combo_window`: `{on: inflictionApplied, by: anyone}` → openCombo.
  - `scorching_fangs_on_combustion`: `{on: reaction, statuses: [combustion]}`,
    by self, `beforeDamage`, `if: {talentAtLeast: [0, 1]}` → buff.
  - `thermite_flag`: cast of normal_skill, `if` Combustion or
    Electrification → buff `spell_inflict`.
  - `thermite_jump` (G2 interim):
    ```json
    { "on": { "event": "cast", "skills": ["chr_0006_wolfgd_normal_skill"] }, "by": "self", "delay": 31,
      "if": { "any": [{ "enemyStatus": "combustion" }, { "enemyStatus": "electrification" }] },
      "do": [{ "kind": "jump", "skill": "chr_0006_wolfgd_normal_skill", "from": 31, "until": 32, "to": 118 }] }
    ```
    With G2, this becomes `"jumps": [{"at": 31, "if": {"buffActive": "spell_inflict"}}]` on the skill.
  - `hunting_hour` (P3): cast of normal_skill, `delay: 141`, `skill:
    chr_0006_wolfgd_normal_skill`, actions `buff scorching_fangs` and `buff
    scorching_fangs_team`, each `if: {all: [{potentialAtLeast: 3},
    {buffActive: scorching_fangs}]}` (judged when they run, at 141).
  - `extra_shot_consumes_combustion` / `_electrification` (G3 interim):
    `{on: buffApplied, buff: extra_shot_landed}`, by self, `if`
    `enemyStatus: combustion` → `apply consumeStatus [combustion]`; `if`
    Electrification and not Combustion → `apply consumeStatus
    [electrification]`. With G3: `applies` on `extra_shot` with
    `afterDamage: true`, and the marker goes.
  - `natural_predator` (P5): ultimate cast, `if: {potentialAtLeast: 5}` →
    `{kind: cooldown, who: self, skills: combo, set: 0}`.
  - `wolven_fury_combustion`: ultimate cast, `delay: 45` → `apply
    forcedReaction combustion` (row 35's interim).
- **Waits on gaps:** G1 (the plain battle skill's lock: data only, nothing
  in the kit); G2, G3 (interims above, exact); G4 (`detached: false`);
  V3 (attack4's SP natural); D3 (poise and branches hand-written).

### Equipment kits

- **wpn_pistol_0004 (Rational Farewell):** buff `wpn_pistol_0004.atk_up`
  (self, `zone: atk`, `atk_up`, `duration`, gameBuff
  `buff_wpn_pistol_0004_atk_up`); triggers `{on: burst, fromKinds: [combo]}`
  and `{on: reaction, statuses: [combustion], fromKinds: [combo]}`, by self,
  `beforeDamage` (test 51), `skill: sk_wpn_pistol_0004`. Battle Skill DMG
  stays in the stat panel.
- **wpn_pistol_0006 (Opus: The Living):** buff `wpn_pistol_0006.atk_up`
  (self, `zone: atk`, `maxStacks: max_stack`, `duration`); trigger
  `{on: reaction, by: self, cooldown: cd, beforeDamage: true}`.
- **wpn_pistol_0012 (OBJ Velocitous):**
  ```json
  { "id": "wpn_pistol_0012.nature", "target": "self", "gameBuff": "buff_wpn_pistol_0012_natural", "duration": "duration",
    "modifiers": [{ "attr": 54, "value": { "product": ["nature_dmg_up_mult", { "eventCount": true }] } }] }
  ```
  trigger `{on: inflictionConsumed, by: self, beforeDamage: true}` → buff
  (W7's interims).
