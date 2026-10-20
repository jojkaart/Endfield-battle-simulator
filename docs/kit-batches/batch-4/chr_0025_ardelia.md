# Ardelia (chr_0025_ardelia): gap report, batch 4

Operator Ardelia (Nature: CharGrowthTable `charTypeId` Natural,
`profession` 4, `mainAttrType` 41 Intellect, `subAttrType` 42 Will,
`weaponType` 2 Arts Unit, rarity 6). Weapons covered here
([batch-4.md](../batch-4.md)): `wpn_funnel_0006` Opus: Etch Figure,
`wpn_funnel_0008` Detonation Unit, `wpn_funnel_0009` Oblivion,
`wpn_funnel_0010` Chivalric Virtues, `wpn_funnel_0013` Dreams of the
Starry Beach.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
CharacterTable, I18nTextTable_EN; Json/SkillData `chr_0025_ardelia_*`
(26 files) and `sk_wpn_funnel_00{06,08,09,10,13}`; Json/BuffData
`buff_chr_0025_ardelia_*` (17 files), `buff_wpn_funnel_00{06,08,09,10,13}*`,
`buff_wpn_lance_0003`, `buff_common_natural_natural_corrupt_triggered`.
Everything needed is in the checkout. Values are at skill level 12 and
weapon skill level 9 unless stated. `efsim kit-draft chr_0025_ardelia` was
run on the main checkout; the draft kits were loaded, calculated and
simulated in a scratch copy (see "Kit plan"). No log has Ardelia.

Claims from earlier notes, re-checked:
- *in-game-tests.md test 38: "Ardelia's battle skill" gives Arts
  Susceptibility.* **Confirmed:** on a Corroded target only
  (`buff_chr_0025_ardelia_normal_skill_vulnerable` → VulnerableAction
  subType 1 and 2), as her own child buffs
  `buff_chr_0025_ardelia_affixes_vulnerable_spell_child` /
  `_physic_child` (priority key `rate`), not the shared
  `buff_common_affixes_vulnerable_spell`. Test 38's question stands.
- *batch-1 Liino R7: HealActions without a heal tag are talent and
  equipment heals.* Ardelia's only heals (the Shadows of Mr. Dolly,
  `chr_0025_ardelia_remain_loop_sheep`) have `healTags.predefinedTag: []`
  with `useHealTags: true`, unlike Xaihi's tagged heal
  (`buff_chr_0011_seraph_mainchr_heal`: −320297214). So no tag, as R7 says.

## Data overview

Action types per file that affect damage, resources, state or timing
(visual, camera, audio, root-motion, teleport and targeting actions left
out). Frames from the skill's start, 30 FPS.

| File | Relevant actions |
|---|---|
| attack1 / attack2 / attack3 | LaunchProjectile (1 @6; 2 @8, 10; 15 @11–39 every 2) → `*_attack1_projhit` / `*_attack3_projhit`: DamageAction `atk_scale` (mask 128), ObtainCostAction `atb` (costType 1, controlled only; 0 at every level). attack3_projhit: Probablity 0.3 with an empty branch |
| attack4 | 8 SpawnAbilityEntity alternatives (CheckMainCharacterCondition, CheckDistanceCondition 10, Probablity 0.5: entity and animation only) → `attack4_sheep` frame 24: DamageAction `atk_scale` (mask 2097280, Final Strike), poise `poise` (onlyEnableForMainChar), ObtainCostAction `atb` 18 (controlled); CreateBuff `attack4_kill_sheep` |
| power_attack | BreakingAttackCalculation × 0.1 @18, TickIntervalAction 10 × 0.05 @21–51, × 0.4 @57; GainBreakingAttackAtb; channel 0–57 cantCastSkill |
| plunging_attack_end | DamageAction `atk_scale` (mask 1152), ObtainCostAction `atb` (0) |
| normal_skill | @32: ForEach tar {CheckBuffStackNumAdvanced tag −421286163 (Corrosion) ≥ 1 → CreateBuff `normal_skill_vulnerable` (duration ← `duration_vul`, rate ← `rate_vul_base`) → FinishBuffByTag Corrosion (isFinishedEarly) → CreateTimedMarker `talent1_mark` 1 s} → DamageAction `atk_scale`, poise `poise` (mask 4352) → CreateBuff `buff_common_obtain_ultimate_sp`; LaunchProjectile × `sheep_num` to random points (castSkillOnBlock / OnReach → `normal_skill_gene_sheep`; castSkillOnHit false). @33–36: CheckTimedMarker `talent1_mark`, CompareFloat `talent1` ≥ 1, FindTarget `other_cor_tar` (HitBox 12 m, TagValidator Corrosion, max 1), CheckEntityNum ≥ 1, then JumpToAction → 189. @188 InterruptCurSkillAction. 189–378: the same ram again (hit @221). JumpToAction 25→32 and 214→221 on CheckDistanceCondition < 1 / 1.5 m. MarkCanInterrupt @52; exclusiveFrame 239; AllowNextSkill attack1 47–52 and 236–241 |
| combo_skill | LaunchProjectile @20 (homing, castSkillOnHit) → `combo_skill_projhit`; TimeDilationAction 0.8 s (ignores her and her spawned entities); AllowNextSkill normal_skill 23–40; exclusiveFrame 40; CreateBuff `combo_skill_kill_sheep` (autoFinishByAction) |
| combo_skill_projhit | IfElse CompareFloat `potential5_dmg_rate` > 0 → ModifyDynamicBlackboard `atk_scale` ×= and `atk_scale_boom` ×= `potential5_dmg_rate`; DamageAction `atk_scale` (mask 12288, no poise); ObtainCostAction `usp` (costType 0); SpawnAbilityEntity `combo_skill_bomb` at the target (setAbilityEntityTarget) |
| combo_skill_bomb | @52: SimpleCalcBB `duration_corrupt_final` = `duration_corrupt` + `potential5_duration` → CreateBuff `buff_common_natural_natural_corrupt_triggered` on tar (duration ← it) → DamageAction `atk_scale_boom` + poise on the entity's target → ModifyDynamicBlackboard `atk_scale_boom` × 0.5 → TargetPostProcessor ExcludeTarget (the entity's target) → DamageAction on the rest of tar |
| ultimate_skill | UltimateTimeAction 0–80; two ChannelingActions 81–201 every 0.1 s, each a LaunchProjectile to a random point (2–6 m around her; 1.5–6 m in a 120° cone toward the main target) → `ultimate_skill_sheep_projhit` on block / reach; JumpToAction 171→201 if `potential3_duration` < 1; ChannelingCastingAction 0–201 (cantCastSkill, cantSwitch); exclusiveFrame 223; AllowNextSkill normal / combo 209–226 |
| ultimate_skill_sheep_projhit | HitBox 1.5 m at the landing point; Probablity `effect_prob` → SpawnAbilityEntity `remain_loop` (a Shadow); ForEach tar {CheckTimedMarkerCondition `ArdeliaUltMark` (returnTrueIfNotExists) → DamageAction `atk_scale` + poise (mask 4608) → CreateTimedMarker `ArdeliaUltMark` `interval` (0.3 s) on that target} |
| normal_skill_gene_sheep / remain_loop_sheep | A Shadow of Mr. Dolly (10 s): AuraAction 1.2 m: the controlled operator entering it → HealAction (Will × `heal_scale` + `heal_value`; P2 half to the lowest-HP teammate), untagged; FinishOwner |
| passive_combo_skill, buff `combo_skill_trigger_*`, `combo_skill_timer`, `combo_skill_boom`, `combo_skill_bomb_potential3` | Reached from no skill in a skill group (CharGrowthTable `skillIdList`): unused |
| normal_skill_vulnerable → affixes_vulnerable_spell_child / _physic_child | VulnerableAction subType 1 (Arts) and 2 (Physical), `rate`, `duration`; parent stackingType 2 max 1, children priority key `rate` |

Skill values (SkillPatchTable level 12): attack1 0.68, attack2 0.45 × 2,
attack3 0.08 × 15, attack4 1.24 (poise 18, atb 18), finisher 9.0, dive
1.8; battle skill 3.2, poise 10, `rate_vul_base` 0.20, `duration_vul` 30,
`rate_vul_max` 0.40 (read by nothing), 100 SP; combo 1.0, `atk_scale_boom`
2.5, `duration_corrupt` 7, `usp` 10, poise 10, cooldown 17 s; ultimate
1.65, poise 3, `interval` 0.3, 90 energy.

Talents and potentials (PotentialTalentEffectTable):
- Talent 1 Friendly Presence (`talent_1_1`–`_1_3`): `sheep_num` 3, `heal_scale` / `heal_value` (0.38/45 → 0.75/90), ultimate `effect_prob` 0.1: the Shadows heal. No damage.
- Talent 2 Mountainpeak Surfer (`talent_2_1`): sets the battle skill's key `talent1` = 1 (the recast).
- P1: `rate_vul_base` +0.08 (0.28). P2: `potential2` = 1 (half heal to another). P3: ultimate `potential3_duration` = 1 (channel to 201: +1 s), `effect_prob` ×1.2. P4: ultimate cost ×0.85 (76.5). P5: combo cooldown −2 s, `potential5_dmg_rate` = 1.2, `potential5_duration` = 4.

## Mechanics

| # | Mechanic (source) | Status | How it's expressed / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–3: projectiles (attack1/2/3 → `*_projhit`), SP `atb` 0 | supported | hits with `detached`, `sp: {if: controlled, then: atb}` (kit-draft's output) |
| 2 | attack3_projhit Probablity 0.3 | supported | empty branch: nothing to write |
| 3 | attack4: Dolly Final Strike at entity frame 24, poise 18 controlled only, SP 18; 8 compiled alternatives | supported | one hit (`finalStrike`, `poiseControlledOnly`, `launch: 0`); the 8 alternatives only choose the entity, so kit-draft's 8 `branch` hits collapse to one |
| 4 | Finisher (power_attack): 0.1 + 10 × 0.05 + 0.4 of `atk_scale` | supported | three hits with `factor`; the engine gates and adds finisher SP and multiplier |
| 5 | Dive attack (plunging_attack_end) | supported | hit written; not castable (S10) |
| 6 | Battle skill "Hops on Mr. Dolly and rams the target": hit @32, poise 10, team energy @32 | supported | hit, `teamEnergy: [{frame: 32, ratio: 1}]` |
| 7 | "If the target has Corrosion, then consume the Corrosion and apply Physical Susceptibility and Arts Susceptibility" (normal_skill @32, both before the DamageAction) | supported | two hits in `branch: "ram"`: the first `if: {enemyStatus: corrosion}`, `applies: [{kind: consumeStatus, statuses: [corrosion]}]`, `buffs` with `beforeDamage: true`. Judged before the applications, as Estella's combo (verified in 4e5e with its own Susceptibility on the hit) |
| 8 | Susceptibility values: `rate_vul_base` (P1 +0.08), `duration_vul` 30 s; own child buffs with priority key `rate` | supported | kit buffs `arts_susceptibility` (fire, pulse, cryst, natural) and `physical_susceptibility`, `gameBuff` the child IDs. With another source: test 38 |
| 9 | Battle-skill timing: free from MarkCanInterrupt @52 (window 47–52), ends @188 | gap | **G1**: the loader reads the talent-2 jump 33→189 as unconditional, so every cast jumps (and **G2** then opens the skipped window at frame 33) |
| 10 | Talent 2: "Triggering the additional effect while an enemy with Corrosion is nearby immediately casts the battle skill again" (frames 33→189, second ram @221, second team energy) | supported | needs another Corroded enemy within 12 m (the only one's Corrosion was just consumed): never against one enemy; the kit lists no jump |
| 11 | Dash shortcuts 25→32, 214→221 (CheckDistanceCondition < 1 / 1.5 m) | supported | interim: not taken (≤ 7 frames) |
| 12 | Talent 1, P2, P3's `effect_prob`: Shadows of Mr. Dolly heal when the controlled operator touches one | supported | nothing to declare: heals aren't simulated (N2), touching needs movement, and the heal is untagged, so no `heal` trigger with `kinds` (every current one) would see it. Their projectiles have castSkillOnHit false: no damage |
| 13 | Combo trigger: "When the controlled operator performs a Final Strike on an enemy with no stacks of Vulnerability or Arts Infliction" | supported | trigger `{on: hit, finalStrike: true}`, `by: controlled`, `if: not any(enemyVulnerable 1, enemyInfliction ×4)`. Judged after the Final Strike lands; no Final Strike in any kit applies anything, so its own effects can't matter today |
| 14 | Combo projectile: `atk_scale`, `usp` 10; P5 ×`potential5_dmg_rate` | supported | hit with `energy: usp`, `extraScale: [{value: potential5_dmg_rate, if: {potentialAtLeast: 5}}]`, `launch: 20` |
| 15 | Combo bomb @72: forced Corrosion (7 s, P5 +4 s) before the explosion; `atk_scale_boom` (P5 ×1.2) on the main target, half on the others | supported | hit `bomb`: `applies: [{forcedReaction corrosion, level 1, durationKey: duration_corrupt, extraSeconds: potential5_duration}]`, `extraScale` as row 14, poise; the half-damage hit on other enemies is left out (one enemy). kit-draft lists both and can't say the scale: G3 |
| 16 | Combo timing: cooldown 17 s (P5 15 s), exclusive 40, TimeDilation 0.8 s that ignores her and her spawned entities | supported | data. Whether her detached hits run on the slowed world clock in the engine: batch 3's engine-wide slow-down question (the bomb is 1.7 s after the 0.8 s curve; small) |
| 17 | Combo and ultimate projectile flight (homing projectile, sheep to random points) | unknown | Ti2 (projectile travel, open): frames are the launch frames |
| 18 | Combo cut short: `combo_skill_kill_sheep` (autoFinishByAction) kills spawned entities by a tag the tables don't give | unknown | **U3**, low: interim the bomb survives once launched (`launch: 20`) |
| 19 | Ultimate: time stop 0–80, channel 81–201, cantCast / cantSwitch, P3 +1 s (jump 171→201 below P3), P4 cost | supported | data; `jumps: [{at: 171, if: {not: {potentialAtLeast: 3}}}]` |
| 20 | Ultimate hits: "Each enemy can only take 1 damaging hit every {interval}s" (ArdeliaUltMark 0.3 s per target); about 20 sheep per second land at random points | unknown | **U1**: interim the cap, one hit per 9 frames from 81 (11 below P3, 14 from P3; `detached: false` so the P3 jump drops the last 3). How many land near one enemy depends on its size and position. kit-draft gives 82 landings: G3 |
| 21 | `passive_combo_skill` and the `combo_skill_trigger_*` / `_timer` / `_boom` buffs, `combo_skill_bomb_potential3` | data | unused (no skill group reaches them); left out |
| 22 | P1–P5 | supported | loader potentials (rows 8, 14, 15, 16, 19); P2 and P3's heal chance: no damage |
| W1 | Opus: Etch Figure: Will, Nature DMG, ATK + `atk_up` (cardAttributeModifier) | supported | stat panel (`calc`: ATK × 1.196 at L9) |
| W2 | "When the wielder's battle skill applies Nature Infliction, other operators in the team gain Arts DMG Dealt +{spell_dmg_up} … +{spell_dmg_up2} per enemy … max {max_stack}" (abilityEvent 30 → child buff → abilityEvent 126, mask 8, same cast, battle) | supported | as `wpn_funnel_0011`: `inflictionApplied` natural `fromKinds: [battle]`, `maxPerCast: 1`, team buff with `recipients: {not: {isOwner: true}}`, value `spell_dmg_up + min(targetsHit, max_stack) × spell_dmg_up2`. Not Ardelia's weapon: her battle skill inflicts nothing. It fits a Will-main Nature operator whose battle skill inflicts Nature (Gilberta) |
| W3 | Opus toggleBuffs: `buff_wpn_lance_0003` (ATK + `atk_up`, formulaItem 6) while CheckCurHpRatio ≥ `hp_ratio`, a key the skill lacks; `atk_up` *is* in the skill (unlike Delivery Guaranteed, where batch 1 found the toggle inert) | unknown | **U2**: interim inert. If a missing key reads 0, the condition always holds and the weapon gives ATK + 19.6% twice |
| W4 | Detonation Unit: main attribute, Arts Intensity line, secondary attribute + `second_attr_up` (cardAttributeModifier modifyAttributeType 2) | supported | stat panel (`calc`: Will 118 → 151 at L9) |
| W5 | "When the wielder applies an Arts Burst, target enemy suffers Arts DMG Taken +{spell_damage_taken_up} for {duration}s" (abilityEvent 127; DamageScaleProcessor side 1, mask 92) | supported | `on: burst`, `by: self` → enemy buff `damageTaken`, the four Arts elements. Ardelia never bursts (she inflicts nothing): no effect on her |
| W6 | Oblivion: Intellect, Arts DMG line, crit rate + `crit_up` | supported | stat panel (19% crit at L9) |
| W7 | "When the wielder casts an ultimate … Arts DMG Dealt +{spell_dmg_up} for {duration}s. When the wielder casts a combo skill … +{spell_dmg_up2} for {duration2}s" (abilityEvent 30, types 7 / 6; stackingType 4) | supported | two `cast` triggers → self buffs on attributes 51–54. Works for Ardelia (both her combo and ultimate are Nature) |
| W8 | Chivalric Virtues: Will, HP, Treatment Efficiency + `heal_up` | supported | stat panel; Treatment Efficiency has no damage effect |
| W9 | "After the wielder's skill provides HP treatment, the entire team gains ATK +{atk_up} for {duration}s" (abilityEvent 50 + CheckHealTag battle / combo / ultimate) | supported | `on: {event: heal, kinds: [battle, combo, ultimate]}`, `by: self` → team `atk` buff. Ardelia's heals are untagged: never. It fits a healer with tagged skill heals (Xaihi's battle-skill heal carries −320297214) |
| W10 | Dreams of the Starry Beach: Intellect, Treatment Efficiency line, secondary attribute + `second_attr_up` | supported | stat panel (Will 118 → 171 at L9) |
| W11 | "After the wielder consumes Corrosion, target enemy suffers Arts DMG Taken +{spell_dmg_taken_up} for {duration}s" (abilityEvent 208, Corrosion tag, CheckConsumeBuffLayer ≥ 1) | supported | `on: {event: statusConsumed, statuses: [corrosion]}`, `by: self`, `beforeDamage: true` (the consumption precedes the battle skill's DamageAction; an ability-event buff made before a DamageAction acts on it, as Perlica's P3 in e82d). Ardelia's signature: her battle skill is the consumer. Test 51's question |
| W12 | Dreams' `buff_wpn_funnel_0013_valid`: stackingType 1, priority `lv`, `useMaxStackCntKey` `max_stack`, which neither the skill nor the buff has | gap | **G4**: the loader refuses the kit with that `gameBuff` |

Counts (34 rows): 27 supported, 1 data, 2 gap (row 9: G1 with G2; W12:
G4; G3 is kit-draft's side of rows 3, 6, 15 and 20), 4 unknown (rows 17,
18, 20, W3; row 17 is the open Ti2). Nothing is unique: [kit-unique.md](../../kit-unique.md)
lists only Si, and every mechanism above maps onto existing fields.

## Gaps

### G1. A JumpToAction behind checks in its own sequence is conditional (loader)

- **family:** data compilation (timing).
- **feature:** `skillData.ts` reads a timeline JumpToAction as conditional
  only when its own `conditionAction` has actions. A sequence also stops
  at the first failing check, so a jump preceded in the same
  `_sequenceActionData.actionData` list by an enabled condition action
  (`Conditions.*`, `Check*`, `CompareFloat`, `NotNextCheckAction`,
  `Probablity`) must be `conditional: true` too; the kit then says when it's
  taken (`KitSkill.jumps`). The compiler already sees these conditions
  (kit-draft notes "if CheckTimedMarkerCondition(id=talent1_mark), if
  talent1 ≥ 1 → frame 189"); only the loader's timing misses them.
- **evidence:** `chr_0025_ardelia_normal_skill` timeline action 33–36:
  CheckTimedMarkerCondition `talent1_mark`, CompareFloat `talent1` ≥ 1,
  FindTarget, CheckEntityNum ≥ 1, JumpToAction destFrame 189 with an empty
  conditionAction. Loaded timing: `jumps: [… {at: 33, to: 189,
  conditional: false} …]`. A scan of every `chr_*` SkillData file finds
  this pattern only here.
- **impact:** every battle skill takes talent 2's recast path. With the
  kit's single hit, the cast skips MarkCanInterrupt (52) and the end at
  188, so whatever doesn't outrank a battle skill waits for the exclusive
  frame (239, real frame 83): a second battle skill comes at 2.77 s
  instead of 1.73 s (scratch, both runs), about 1 s lost per pair; with
  G2 her next basic attack comes 14 frames early (1.10 s instead of
  1.57 s). Combos and ultimates outrank it and aren't affected. A kit
  listing the data's second ram would double the battle skill. The
  scratch loader fix (sequence checks mark the jump conditional) gives
  the data's answers above, and the scratch test suite passes with it.

### G2. A window a jump skipped opens at the jump's frame (engine)

- **family:** timing.
- **feature:** `actionGate` maps a skill frame inside a skipped segment
  to the jump's real frame (`actionFrame`: "a skipped frame is its
  jump's"), so an AllowNextSkill window lying wholly inside the segment
  (`from > at`, `to < to`) passes the `at(w.from) ≤ at(w.to)` test and
  opens at the jump frame. A window whose frames were all skipped should
  not open at all (a window that straddles the jump's target opens at
  its first reached frame).
- **evidence:** scratch run with the unfixed loader: Ardelia's battle
  skill (jump 33→189) then attack1: the attack starts at frame 33 from
  the window 47–52, which the jump skipped. Other skills with a window
  inside a jumped segment (scan of the loaded timings): Wulfgard's battle
  skill (31→118 with window 32–54), Arclight's (4→96 with 36–60),
  Catcher's (45→255 with 95–129), and in batch 4 Rossi, Pogranichnik,
  Last Rite and Mi Fu. In Arclight's case
  (scratch: Perlica's forced Electrification, then two battle skills) the
  second cast waits for her own later hits (`ownHitsLanded`), which hides
  it; it shows when nothing else holds the next action.
- **impact:** an action allowed up to a few frames to a second early
  after a skipped segment; today only seen with G1. Small but general.

### G3. kit-draft items (data compilation)

- **family:** data compilation (D3 / D4 follow-ups).
- **feature:**
  1. *Per-target hit-rate markers:* a DamageAction gated by
     CheckTimedMarkerCondition (`returnTrueIfNotExists`) on a marker that a
     CreateTimedMarker after it puts on the same target for `interval`
     lands at most once per `interval` on one enemy. kit-draft should
     emit the channel's landings at that spacing (with a note on the
     geometry), not every tick of both channels.
  2. *Landings only a conditional jump reaches:* hits after an
     InterruptCurSkillAction end that only a conditional jump crosses
     belong to that jump's path (a note or an `if`), not to the plain
     cast.
  3. *ExcludeTarget:* a DamageAction after a TargetPostProcessorAction
     ExcludeTarget on the entity's target hits only other enemies: leave
     it out (as batch 3 did by hand for Arclight row 12 and Perlica's
     bounce).
  4. *A scale changed in the parent file* (ModifyDynamicBlackboard on
     `atk_scale_boom` in `combo_skill_projhit`, read by the bomb it
     spawns): D3's open "ModifyDynamicBlackboard on a hit's scale"
     (Chen's P5), not new; and `CompareFloat potential5_dmg_rate > 0`,
     a key only P5 sets, could be `potentialAtLeast: 5` (D4's "a key only
     the potentials set").
- **evidence:** kit-draft output for chr_0025_ardelia: ultimate
  `count: 82` at frames 81, 81, 84, 84, …, 201, 201; battle skill
  `count: 2` at 32 and 221; combo `bomb` and `bomb_2` (`($atk_scale_boom?
  × 0.5)`), both "scale is $atk_scale_boom?: not key × literal"; combo
  `projhit` / `projhit_2` with "only if potential5_dmg_rate > 0 (no kit
  condition)".
- **impact:** none on a hand-checked kit; a kit copied from the draft
  would have the ultimate ×7.5 (82 vs 11 hits), the battle skill ×2 and
  the combo bomb ×1.5.

### G4. A maxStackCntKey nobody has (loader)

- **family:** buff lifecycle (loader).
- **feature:** `gameBuffInstances` takes a stackingType 1 buff's
  `maxStackCntKey` and requires the applying skill to have it. When the
  key is in neither the skill's blackboard nor the buff's (and the
  CreateBuffAction doesn't assign it), read it as the game reads a
  missing key: 0, i.e. `maxStackCnt` 0 (no limit), and load the kit.
- **evidence:** `buff_wpn_funnel_0013_valid` stackingSettings
  `useMaxStackCntKey: true`, `maxStackCntKey: "max_stack"`; neither
  `sk_wpn_funnel_0013` nor the buff has `max_stack`, and the
  CreateBuffAction assigns only `spell_taken_up`, `duration`, `lv`. The
  loader: "buff wpn_funnel_0013.arts_taken instances (maxStackCntKey):
  sk_wpn_funnel_0013 has no value max_stack at level 1".
- **impact:** no damage difference for one wielder (every instance has
  the same `lv`; the strongest acts either way). Without the `gameBuff`
  the kit loses the stack group (two wielders' copies would add) and the
  log name. The draft leaves `gameBuff` out until this is fixed.

### Unknowns (no engine work until settled)

- **U1. Wooly Party's hits on one enemy.** The data caps them at one per
  `interval` (0.3 s) per enemy; whether the cap is reached depends on how
  many of the ~20 sheep per second land within 1.5 m (plus the enemy's
  radius) of it. Interim: the cap from the first tick (11 hits, 14 from
  P3). If a large enemy takes about 6, her ultimate is about 45% lower.
  Settled by a log; by hand optionally (Verification).
- **U2. Opus: Etch Figure's toggle.** See W3. If live, +19.6% ATK (L9) on
  top of the panel's; the same pattern (toggle `buff_wpn_lance_0003`,
  `atk_up` in the skill, no `hp_ratio`) is in `sk_wpn_sword_0010` (Umbral
  Torch, Laevatain's kit) and `sk_wpn_sword_0017` (Glorious Memory, Chen
  in 7e19). A lead, not evidence: batch 3 fitted Chen's 7e19 hits with an
  ATK% about 1.57 instead of 1.35 (plus a lower base), and 1.35 + 0.196 =
  1.55. Settled by test 75 if the panel shows toggled buffs, or by a log
  with one of the three weapons; for the merge (Pogranichnik's report
  covers sword_0017).
- **U3. The combo's bomb when the combo is cut.** Row 18; low.

Already open and only referenced: Ti2 (rows 17, 20), S10 (row 5), test 38
(row 8, Susceptibility from two sources), test 4 (Corrosion ramp: her
combo's Corrosion lasts 7–11 s), test 51 (W11), batch 3's slow-down
question (row 16).

## Verification

No fixture has Ardelia (batch-4.md). Logs that would check her:
- any ZMDLogs battle with her battle skill on a Corroded enemy: the hit
  with `buff_chr_0025_ardelia_affixes_vulnerable_spell_child` and (with
  Dreams) `buff_wpn_funnel_0013_valid` as boundary buffs (rows 7, W11);
  teammates' hits under the Susceptibility and its 30 s (row 8);
- her ultimate: the count of `chr_0025_ardelia_ultimate_skill_sheep_projhit`
  per cast and its spacing (U1), and their delay after the cast (Ti2);
- her combo: the `combo_skill_projhit` and `combo_skill_bomb` times after
  the cast (Ti2), and the bomb with its own Corrosion's shred (row 15);
- her battle skill's timing to the next action (G1);
- a log with Opus: Etch Figure, Umbral Torch or Glorious Memory and
  `buff_wpn_lance_0003` listed or not (U2).

In-game tests (rules of [in-game-tests.md](../../in-game-tests.md)):

1. **Part of test 51 (variant with Ardelia and Dreams of the Starry
   Beach):** does an effect a hit triggers count on that same hit? Basic
   chain to a Final Strike on a clean dummy, her combo (Corrosion and a
   Link stack), wait about 3 s for the explosion, battle skill A
   (consumes the Corrosion, Link ×1.3), then within 25 s battle skill B
   (no Corrosion, no Link).
   Compare the non-crit numbers of A and B. Predictions (P0, L9 weapon):
   A/B ≈ 1.30 if both her Susceptibility and the weapon's Arts DMG Taken
   act on A (engine); ≈ 1.02 if only the weapon's comes from the next
   hit; ≈ 1.08 if only her Susceptibility does; ≈ 0.85 if neither acts on
   A. All four assume the Corrosion is gone before A's damage, as the
   data orders it. Medium priority (needs Ardelia and the weapon).
2. **Test 38** already covers her Susceptibility with Gilberta's.
3. **Test 75** (stat panel vs engine) settles U2 for Glorious Memory if
   the panel shows the toggle; the same reading with Opus: Etch Figure or
   Umbral Torch on any wielder: with the toggle live, the panel's ATK% is
   0.196 higher (L9) than `efsim calc`'s (ATK about 16% higher when the
   weapon is the only ATK% source: 1.392 / 1.196).
4. **U1 (optional, tedious; logs settle it better):** record her
   ultimate below P3 on a large dummy with a phone and count the Wooly
   Party damage numbers on it: 10–11 (the cap; engine 11) or clearly
   fewer (geometry). Low priority.

Not testable by hand: Ti2 (projectile travel; test 47), U3 (the bomb's
1.7 s, cut within frames 23–40).

## Kit plan

Draft files, loaded with the real loader in the scratch copy
(`…/scratchpad/batch4/scratch-ardelia/repo/packages/data/kits/operators/chr_0025_ardelia.json`
and `…/kits/equipment/wpn_funnel_00{06,08,09,10,13}.json`). They load:
`efsim calc` for a P5 build with each weapon (panels as in W1–W10),
`efsim simulate` on solo scenarios, and the scratch test suite (978 tests
pass; three timed out under the shared machine's load and pass alone).

**Operator kit** (element `natural`):
- Buffs: `arts_susceptibility` and `physical_susceptibility` (row 8):
  ```json
  { "id": "arts_susceptibility", "target": "enemy",
    "gameBuff": "buff_chr_0025_ardelia_affixes_vulnerable_spell_child",
    "duration": "duration_vul",
    "modifiers": [{ "zone": "susceptibility", "value": "rate_vul_base", "elements": ["fire", "pulse", "cryst", "natural"] }] }
  ```
  (`physical_susceptibility`: `_physic_child`, `elements: ["physical"]`).
- Trigger `combo_window` (row 13):
  ```json
  { "on": { "event": "hit", "finalStrike": true }, "by": "controlled",
    "if": { "not": { "any": [{ "enemyVulnerable": 1 }, { "enemyInfliction": "fire" }, { "enemyInfliction": "pulse" }, { "enemyInfliction": "cryst" }, { "enemyInfliction": "natural" }] } },
    "do": [{ "kind": "openCombo" }] }
  ```
  Scratch: with Perlica's battle-skill Electric infliction up, her Final
  Strike opens no window (the combo is refused).
- Basic attacks as kit-draft (rows 1–3; attack4 one hit, `launch: 0`,
  `finalStrike`, `poise` controlled only, SP `atb`); finisher three hits
  with `factor` 0.1 / 0.05 × 10 / 0.4; dive attack hit (S10).
- Battle skill (rows 6–11): `teamEnergy: [{frame: 32, ratio: 1}]`, no
  `jumps`, two hits:
  ```json
  { "id": "ram_corroded", "branch": "ram", "if": { "enemyStatus": "corrosion" },
    "scale": ["atk_scale"], "frames": [32], "events": ["chr_0025_ardelia_normal_skill"],
    "applies": [{ "kind": "consumeStatus", "statuses": ["corrosion"] }],
    "buffs": [{ "buff": "arts_susceptibility", "beforeDamage": true }, { "buff": "physical_susceptibility", "beforeDamage": true }],
    "poise": "poise" },
  { "id": "ram", "branch": "ram", "scale": ["atk_scale"], "frames": [32], "events": ["chr_0025_ardelia_normal_skill"], "poise": "poise" }
  ```
  Waits on G1 for its timing (until then every cast takes the 33→189
  path). Scratch, P5 with Dreams after her combo: the corroded ram is
  3.2 × ATK × Susceptibility 1.28 × Arts DMG Taken 1.28 × Link 1.3, no
  Corrosion shred (consumed first).
- Combo (rows 14–16): `projhit` (frame 20, `launch: 20`, `energy: usp`)
  and `bomb`:
  ```json
  { "id": "bomb", "scale": ["atk_scale_boom"],
    "extraScale": [{ "value": "potential5_dmg_rate", "if": { "potentialAtLeast": 5 } }],
    "frames": [72], "events": ["chr_0025_ardelia_combo_skill_bomb"],
    "applies": [{ "kind": "forcedReaction", "status": "corrosion", "level": 1, "durationKey": "duration_corrupt", "extraSeconds": "potential5_duration" }],
    "poise": "poise", "detached": true, "launch": 20 }
  ```
  (`projhit` has the same `extraScale`). Scratch: at P5 the projhit is
  1.2 × 1.0 and the bomb 1.2 × 2.5 under its own Corrosion's initial
  shred (3.6 points); Corrosion 11 s.
- Ultimate (rows 19–20): `jumps: [{at: 171, if: {not: {potentialAtLeast: 3}}}]`;
  one hit `sheep`, `count: 14`, frames 81, 90, …, 198 (every 9),
  `poise`, **`detached: false`** (the loader's default for another
  file's key is detached, which would keep the 3 landings the P3 jump
  skips). Scratch: 11 hits at P0, 14 at P5. Waits on U1 (the count) and
  Ti2 (the first landing).

**Equipment kits** (each `skill: "sk_wpn_funnel_00xx"`):
- `wpn_funnel_0006`: buff `wpn_funnel_0006.arts_dmg` (`target: team`,
  `recipients: {not: {isOwner: true}}`, `gameBuff` `_valid`, damageBonus
  on the four Arts elements, `spell_dmg_up + min(targetsHit, max_stack) ×
  spell_dmg_up2`); trigger `inflictionApplied` natural, `fromKinds:
  [battle]`, `by: self`, `beforeDamage`, `maxPerCast: 1`. Toggle left out
  (U2).
- `wpn_funnel_0008`: enemy buff `damageTaken` (four Arts elements,
  `spell_damage_taken_up`, `duration`, `gameBuff` `_magic_damage_taken_up`);
  trigger `burst`, `by: self`.
- `wpn_funnel_0009`: self buffs `.ult` (attrs 51–54 + `spell_dmg_up`,
  `duration`) and `.combo` (+ `spell_dmg_up2`, `duration2`); `cast`
  triggers on `ultimate` and `combo`.
- `wpn_funnel_0010`: team buff `atk` + `atk_up`, `duration`; trigger
  `heal` with `kinds: [battle, combo, ultimate]`, `by: self`.
- `wpn_funnel_0013`: enemy buff `damageTaken` (four Arts elements,
  `spell_dmg_taken_up`, `duration` 25 s); trigger `statusConsumed`
  corrosion, `by: self`, `beforeDamage: true`. `gameBuff` waits on G4.

Panel stats (ATK%, secondary attribute %, crit rate, HP, Treatment
Efficiency) come from cardAttributeModifier in the stat panel, as `calc`
shows; nothing to write. Per-kit test files and an example scenario
(Ardelia with Dreams: chain, combo, battle skill on the Corrosion,
ultimate) come with the kits in phase 5.
