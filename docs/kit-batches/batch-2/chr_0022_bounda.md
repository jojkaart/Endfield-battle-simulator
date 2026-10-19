# Fluorite (chr_0022_bounda): gap report, batch 2

Phase 1 (analysis only), against the engine as of 1aa09d4. Equipment covered
here ([batch-2.md](../batch-2.md)): weapons wpn_pistol_0001 (Peco 5),
wpn_pistol_0002 (Howling Guard), wpn_pistol_0003 (Long Road); gear sets
suit_expend_spell01 (Xiranflow), suit_generaltype (AIC Fieldwork), suit_atk01
(Aburrey's Legacy).

Sources: rmxlinux `Json/SkillData/chr_0022_bounda_*`, `Json/BuffData/buff_chr_0022_bounda_*`,
`buff_common_affixes_slow`, `sk_wpn_pistol_000{1,2,3}`, `buff_wpn_pistol_000{1,2,3}`,
`passive_equipsuit_{expend_spell01,generaltype,atk_01}`, `buff_equipsuit_{atk_01*,expend_spell01,expend_spelldamage}`;
TableCfg CharGrowthTable, SkillPatchTable, CharacterPotentialTable, PotentialTalentEffectTable,
WeaponBasicTable, EquipSuitTable, I18nTextTable_EN; `efsim kit-draft chr_0022_bounda`;
fixture `fixtures/pending/zmdlogs-abfd4b7478ec.json` (Fluorite P5, level 60, all skills level 1,
with Si, Yvonne and Xaihi). No earlier report covers Fluorite, so nothing here is
carried over as a claim; the batch-1 facts used (InterruptAction isn't Immobilization,
CheckSkillType 2/6/7 = battle/combo/ultimate, stackingType 4 refreshes) are re-checked
where they matter. Scratch: `/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch2/scratch-chr_0022_bounda/`
(draft kits in `kits/`, a repo copy with them in `repo/`).

## Skill values (SkillPatchTable, level 1 / 12)

| Skill | Values | Cooldown / cost |
|---|---|---|
| attack1–3 | `atk_scale` 0.25/0.56, 0.33/0.73, 0.26/0.57; `atb` 0 | |
| attack4, attack4_1 | `atk_scale` 0.6/1.35 (`display_atk_scale` = 3×), `attack_poise` 15, `atb` 15 | |
| power_attack (finisher) | `atk_scale` 4/9 (BreakingAttackCalculation, multiplier 1) | |
| plunging_attack_end | `atk_scale` 0.8/1.8, `atb` 0 | |
| normal_skill | `atk_scale` 1.87/4.2, `poise` 10, `duration` 3, `move_speed_scalar` 0.3, `boom_up` 0.3 | 100 SP |
| combo_skill | `atk_scale` 1.69/3.8, `usp` 10, `poise` 10, `atb` 10 (unused), `atk_scale_add_1…4` (unused) | 40 s (38 s at 12) |
| ultimate_skill | `atk_scale1…4` 1.11/2.5 each, `poise` 5, `boom_up` 0.3 | 100 energy, 10 s |

Talents (PotentialTalentEffectTable): talent 1 "Love the Stab and Twist" attaches
`chr_0022_bounda_talent_1` (`dmg_up` 0.1 / 0.2) → permanent `buff_chr_0022_bounda_talent_1`;
talent 2 "Unpredictable" attaches `chr_0022_bounda_talent_2` (`atk_up` 0.1 / 0.2,
`probability` 0.2, `duration` 10) → permanent `buff_chr_0022_bounda_talent_2`.
Potentials: P1 Agility +10, Intellect +10; P2 talent 2 `probability` +0.1; P3 battle skill
`duration_potential` = 6, `potential_lv` = 3 (set); P4 ultimate cost ×0.9; P5 attaches
`buff_chr_0022_bounda_potential_5_auro` (`CD` 1, `reduce` 1).

## SkillData / BuffData action types

Presentation types (effects, sound, camera, animation, root motion, rotation,
teleport, weapon visibility, voice, debug) left out. D = damage, R = resources,
S = state, T = timing / legality.

| File | Gameplay types | Affect |
|---|---|---|
| attack1 / 2 / 3 | LaunchProjectile (13 / 9 / 9), ComboCacheAction, AllowNextSkillAction (attack3: two windows, 18–24 → attack4, 24–30 → attack4_1), CheckEntityNum, CheckMainCharacterCondition | D, T |
| attack1–3_projhit | DamageAction (`atk_scale`, mask 128); attack3: ObtainCostAction costType 1 `atb` × 0.333 (atb 0) | D, R |
| attack4 / attack4_1 | LaunchProjectile (29 / 26; castSkillOnHit and castSkillOnBlock both → attack4_projhit), HitStopAction 0.06 s, windows → attack1 | D, T |
| attack4_projhit | DamageAction `atk_scale` mask 2097280 (Final Strike) + poise unit `attack_poise` (onlyEnableForMainChar); ObtainCostAction `atb` (atbOnlyMainChar) | D, R |
| power_attack | DamageAction BreakingAttackCalculation (frame 20), GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` 0–22, `full_immune_medium`, windows → battle, combo | D, R, T |
| plunging_attack_end | DamageAction AtkScaleCalculation (mask 1152), ObtainCostAction `atb` | D, R |
| normal_skill | LaunchProjectile (10, hit and block → normal_skill_projhit), CreateBuff `buff_chr_0022_bounda_normal_skill_onlymark` (self, 5 s), HitStopAction | D, S, T |
| normal_skill_projhit | SpawnAbilityEntity `abilityentity_chr_0022_bounda_normal_skill` (→ `_abilityrange`, attached to the target), SlowAction (duration literal 3.1 s, rate `move_speed_scalar`) | S, T |
| normal_skill_abilityrange | JumpToAction 0–89 → 89 if the target's HP ≤ 0 (CheckHp); JumpToAction 0–89 → 149 if the target has `buff_chr_0022_bounda_ultimate_skill`; at 89 (radius 3) and at 149 (radius 4): FinishBuff (onlymark, ultimate marker), InterruptAction (1 s), SpellInfliction type 3 (Nature), DamageAction `atk_scale` mask 4352 (the 149 one with DamageScaleProcessor ProdCalcZone +0.3), IfElse `potential_lv` ≥ 3 → SlowAction `duration_potential`, CreateBuff `buff_common_obtain_ultimate_sp`; FinishOwnerAction at 90 / 150 | D, R, S, T |
| combo_skill | SwitchAction on `EntityBB_combo_index` (2 → SpellInfliction Cryo, 3 → Nature), DamageAction `atk_scale` mask 12288 (15), ObtainCostAction `usp` (if a target), TimeDilationAction ComboSkill 0.533 s, HitStopAction ×2, EventListenerAction (mask 8192, CompareFloat `atk_up_potential_4` > 0 → `buff_chr_0022_bounda_potential_4`), window → battle skill | D, R, S, T |
| combo_skill_projhit | DamageAction, ObtainCostAction `atb`: **orphan** (nothing launches it) | none |
| ultimate_skill | TimeDilationAction RESETto1 1 s, UltimateTimeAction 0–56, ChannelingCastingAction 0–77 (cantCastSkill, cantSwitchPosition), CreateBuff damage immunity, LaunchProjectile ×4 (59, 63, 67, 72), windows 77–94 → attack1, battle, combo | D, T |
| ultimate_skill_1…3_projhit | DamageAction `atk_scaleN` (mask 4608 / 512), CreateBuff `buff_chr_0022_bounda_ultimate_skill` on the target (0.2 s) | D, S |
| ultimate_skill_4_projhit | IfElse CheckBuffStackNumAdvanced ≥ 2 Nature → SpellInfliction Nature, else ≥ 2 Cryo → Cryo; DamageAction `atk_scale4`; CreateBuff ultimate marker | D, S |
| talent_1, talent_2 (SkillData) | `buffs` → their BuffData (permanent) | S |
| buff_…_talent_1 | damageModifier: CheckTagMatch 1925762097 (Slow, the tag of `buff_common_affixes_slow`) on the target → NormalCalcZone + `dmg_up` | D |
| buff_…_talent_2 | abilityEvent 101 (damage taken) × 4: CheckTagMatch on the attacker, CheckDamageType 2–5 (Arts), Probablity `probability` → `buff_common_damage_immune_talent` (0.01 s) + `buff_chr_0022_bounda_talent_2_atkup` (ATK attr 2 formulaItem 6 `atk_up`, `duration`, stackingType 4) | D |
| buff_…_potential_5_auro → _potential_5_cd | AuraAction on enemies; abilityEvent 121 + CheckSpellInflictionType mask 12 (Cryo, Nature) + CheckTimedMarker / CreateTimedMarker `CD` on her → SetSkillCdAtOnce combo `reduce` | T |
| buff_…_potential_4 | ATK `atk_up_potential_4` 10 s: reached only by the combo's dead EventListener (P4 is the cost cut) | none |
| buff_…_normal_skill_onlymark, buff_…_ultimate_skill | markers (tag −1486085048; 0.2 s) | S |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–3: one projectile each, `atk_scale` (attack1–3_projhit, mask 128), frames 13 / 9 / 9 from LaunchProjectile | supported | `hits` with `events: [*_projhit]` (detached). Log: 33 hits, all at one factor (Verification) |
| 2 | Attack3 SP `atb` × 0.333 | supported | `sp`; `atb` is 0 at every level, so nothing |
| 3 | Attack4: one projectile, `atk_scale`, Final Strike (mask 2097280), SP `atb` 15 and stagger `attack_poise` 15 only as the controlled operator ("As the controlled operator, Final Strike also deals {attack_poise:0} Stagger") | supported | `sp: atb`, `poise: attack_poise`, `poiseControlledOnly`; Final Strike from the data. `display_atk_scale` = 3 × `atk_scale` is the tooltip only: the log's attack4 hits sit at the same factor as attacks 1–3 with one landing (10 hits) |
| 4 | Attack4_1: the same Final Strike from a later input (attack3's window 24–30, launch at frame 26) | gap | G2: the chain points at one step only (`chainAfter` takes the first window's step); attack4_1 isn't inferred as a step (`attack4_1` has no lower-numbered sibling) and with `chainStep: true` is never castable. Same damage as attack4 |
| 5 | kit-draft gives attack4, attack4_1 and the battle skill two landings each (the projectile's hit and block routes) and the battle skill's two explosions as both landing | data | G6: they're alternatives (one projectile; `castSkillOnBlock` only when blocked; the explosions are JumpToAction branches) |
| 6 | Finisher: BreakingAttackCalculation `atk_scale` (multiplier 1), GainBreakingAttackAtb, disable-cast buff 0–22 | supported | P2 finishers; no `factor` needed (multiplier 1) |
| 7 | Dive attack (`plunging_attack_end`, skillSpecification 6) | supported | not castable until rotations have jumps (S10) |
| 8 | Battle skill: "Kicks an Improvised Explosive that sticks to the target, applying Slow and exploding after a short duration": projectile at frame 10, the stuck entity and Slow 3.1 s (SlowAction literal; `duration` 3 is the text value) | supported | enemy marker buff `improvised_explosive` (3.1 s) and `{kind: control, status: "slow", seconds: 3.1}` from a cast trigger with `delay: 10` |
| 9 | Explosion at entity frame 89 (cast frame 99 without travel): Nature DMG `atk_scale`, Nature Infliction, stagger `poise`, team energy (`buff_common_obtain_ultimate_sp`) | supported | the skill's own hit, `frames: [99]`, `detached`, `if: {buffActive: improvised_explosive}`; `teamEnergyFrame: 99`. A trigger on its hit ends the marker. As the cast's own hit it gets Link |
| 10 | Explosion InterruptAction (immobilizedTime 1 s) | supported | no effect: not Immobilization (no control tag; batch-1 Laevatain row 19), nothing in the batch listens to it |
| 11 | "If an Improvised Explosive has been stuck to the target, [the ultimate] detonates it immediately and increases the DMG and size of the explosion": each ultimate projhit puts `buff_chr_0022_bounda_ultimate_skill` on the target, the entity jumps to 149: radius 4, ProdCalcZone +0.3 | supported | trigger on her ultimate's hits `if: {buffActive: improvised_explosive}`: `endBuff` + a `hits` action (battle, `bonuses: [{zone: multiplicative, key: boom_up}]`); the frame-99 hit then finds no marker. Ran in a scratch simulation (Verification) |
| 12 | Whether Link counts for the ultimate-detonated explosion | unknown | the engine's Link acts on the consuming cast's own hits only; this explosion is a trigger hit at the ultimate (no Link), while the battle skill that consumed the Link loses its own hit. In-game test F1 |
| 13 | A rotation step without `at` after the battle skill (e.g. the ultimate) starts at once, before frame 10, so the kick never lands | gap | G3: `ownHitsLanded` waits for the cast's non-detached hits, not its delayed cast-trigger actions |
| 14 | "Defeating the target also sets off the Improvised Explosive immediately" (JumpToAction on CheckHp ≤ 0) | supported | no effect against one enemy (N1, with multi-enemy support) |
| 15 | "Only 1 Improvised Explosive can be present in the battlefield" | unknown | nothing in the data enforces it (the onlymark buff is checked by nothing); two casts within 3 s (200 SP) would each explode in the draft. In-game test F3; low priority |
| 16 | P3: "After Improvised Explosive explodes, the slow effect is applied to all enemies hit and lasts {duration_potential}s" (6 s; `potential_lv` ≥ 3) | supported | `{kind: control, status: slow, durationKey: duration_potential, if: {potentialAtLeast: 3}}` on both explosions (the key is 0 below P3, and a 0 s control is an error, so the `if` is needed) |
| 17 | Combo trigger: "When an enemy has 2 or more stacks of Cryo Infliction or Nature Infliction" | supported | `{on: inflictionApplied, elements: [cryst, natural], minStacks: 2, by: anyone}` → openCombo (Arcane's INT trigger has the same shape) |
| 18 | Combo hit: Nature DMG `atk_scale`, frame 15, `usp` 10 (if a target), `poise` 10 | supported | one hit. Log: 3 combos, exact after the build factor with 2 and 3 Type 50 Yinglung stacks (Verification) |
| 19 | Combo: "applies another Arts Infliction of the element already on the enemy" — data: SwitchAction on `EntityBB_combo_index` (2 Cryo, 3 Nature), set when the window opens | unknown | today `{element: "enemy", if: {any: [{enemyInfliction: cryst}, {enemyInfliction: natural}]}}` (interim rule A6: the enemy's current element). Differs only if the enemy's infliction changed between the window and the hit. Same structure in `chr_0023_antal_combo_skill` (shared). In-game test 33's second part, with Fluorite |
| 20 | Combo TimeDilationAction (ComboSkill, 0.533 s) and hit-stops | supported | Ti1 (global slow-down); hit-stop Ti1b not modelled (open list) |
| 21 | Combo EventListener → `buff_chr_0022_bounda_potential_4` (ATK `atk_up_potential_4`) | supported | dead code: P4 is the cost cut and nothing sets `atk_up_potential_4`; leave out. Likewise `atk_scale_add_1…4`, `atk_scale_potential5`, `infliction_num` (blackboard only) and the orphan `combo_skill_projhit` |
| 22 | Ultimate: 4 shots, `atk_scale1…4`, frames 59 / 63 / 67 / 72 (launch), `poise` 5 each | supported | four hits (detached). Log: all four equal (1081), one factor with the rest. Logged gaps 467 / 224 / 123 ms vs 133 / 133 / 167 ms in the data: projectile travel or hit-stop (Ti2 / Ti1b, small) |
| 23 | "If the final DMG sequence hits a target with at least 2 stacks of Cryo Infliction or Nature Infliction, then apply the same Arts Infliction again" (Nature checked first) | supported | shot 4 `applies` with `if: {enemyInfliction: natural, minStacks: 2}` / `{enemyInfliction: cryst, minStacks: 2}`. Log: a Cryo burst follows the 4th shot (t=64225) |
| 24 | Ultimate time stop 0–56, time dilation, cantCastSkill / cantSwitchPosition 0–77, damage immunity | supported | from SkillData (Ti1, S9) |
| 25 | Ultimate cost 100 (P4 ×0.9 = 90), cooldown 10 s, no energy of its own, no RefrainObtainUsp | supported (data) | the scratch run shows 90 at P5 |
| 26 | Talent 1: "Fluorite gains DMG Dealt +{dmg_up} against Slowed targets" (0.1 / 0.2; any Slow: the condition is the Slow tag) | gap | G1: a buff modifier that holds only while the hit's target is in a state. Slow itself is expressible (row 8) |
| 27 | Slow from teammates (Gilberta's ultimate field, Typhoeus's combo debuff, Tangtang: SlowAction in their files) counts for talent 1 | supported | `control` applications in those kits (kits phase: Gilberta's and Typhoeus's kits don't apply Slow today, as it had no effect) |
| 28 | Talent 2: on taking Arts DMG, a `probability` chance (0.2, P2 +0.1) of Arts DMG immunity and ATK +{atk_up} (0.1 / 0.2) for 10 s, not stacking | gap | G5 (new: the enemy's attacks). The log has it active at 79–89 s (`buff_chr_0022_bounda_talent_2_atkup`, atk 0.2) |
| 29 | P1 Agility +10, Intellect +10; attribute nodes Agility +10 / 15 / 15 / 20 | supported (data) | stat panel (`efsim calc` lists them) |
| 30 | P2 talent-2 probability +10% | supported | only matters with G5 |
| 31 | P4 ultimate cost −10% | supported (data) | skillParamModifier paramType 1 |
| 32 | P5: "Whenever Cryo Infliction or Nature Infliction is applied to the enemy, [combo] cooldown is shortened by {reduce}s. Effect can only trigger once every 1s." | supported | `{on: inflictionApplied, elements: [cryst, natural], by: anyone, cooldown: CD, skill: buff_chr_0022_bounda_potential_5_auro}` → `{kind: cooldown, who: self, skills: combo, seconds: −reduce}` (Estella's P5 shape). Whether an infliction that forms a reaction fires abilityEvent 121 is the open Arcane R3 question (test 35). Log: combo casts 38.4 s apart with a 40 s cooldown, so cuts happened |
| W1 | Peco 5: main attribute +`mainattr`; skill 2 flat ATK +`atk_up` (formulaItem 7, cardAttributeModifier) | supported (data) | stat panel (`calc`: +33.6 flat at level 9). `buff_wpn_pistol_0001` is an orphan; `toggleBuffs` → `buff_wpn_passive_spirit_01` has no file (as in batch 1) |
| W2 | Peco 5 has two skills, but a build's `weapon.skillLevels` needs three | gap | G8 (format, small) |
| W3 | Howling Guard: Intellect, ATK% (stat panel); "When the wielder's battle skill hits the enemy, the wielder gains ATK +{atk_up} for {duration}s" (abilityEvent 302 + decorate mask 256) | supported | equipment kit: `{on: hit, kinds: [battle], by: self}` → self buff `zone: atk` (20 s, refreshed) |
| W4 | Long Road: Strength, Arts DMG (stat panel); "When the wielder casts a combo skill, the wielder gains ATK +{atk_up} for {duration}s" (abilityEvent 30, CheckSkillType [6]) | supported | `{on: cast, kinds: [combo], by: self}` → self buff |
| S1 | AIC Fieldwork: DMG +20% for every element (attrs 50–55), Ultimate Gain Efficiency +10% (attr 44) | supported (data) | stat panel (`calc` shows both) |
| S2 | AIC Fieldwork: DMG Reduction ×0.9 (attrs 4–7, 48, 60), the HP-ratio `buff_equipsuit_str_reducedmg_01` toggle | supported | damage taken isn't modelled |
| S3 | Aburrey's Legacy: battle / combo / ultimate DMG +24% (attrs 32, 33, 28) | supported (data) | stat panel |
| S4 | Aburrey's Legacy: "When the wearer casts a battle skill, combo skill, or ultimate, the wearer gains ATK +{atk_up} for {duration}s. The buff from each of the three skill types is unique" | supported | three buffs, three cast triggers |
| S5 | Xiranflow: ATK +10% | supported (data) | stat panel |
| S6 | Xiranflow: "Whenever the wearer consumes Electrification or Corrosion, the wearer gains a number of buff stacks equal to the Status Level of the Arts Reaction consumed … Electric DMG and Nature DMG +{spell_dmg_up} for {duration}s. Max {max_stack}. Duration of each stack is counted separately." | gap | `{on: statusConsumed, statuses: [electrification, corrosion], by: self}` → a layered buff (`maxStacks: max_stack`) works for one layer; G4: a buff action that adds `eventCount` layers |
| S7 | What "consumes" covers for Xiranflow (abilityEvent 208 + a tag check on the removed buff): a skill removing the status; also a status replaced or expiring? | unknown | the engine's `statusConsumed` is "removed by a hit before it runs out" (`consumeStatus`); no batch-2 operator consumes Electrification or Corrosion, so it needs a log with such a consumer |
| K1 | A kit buff modifier `{attr: 2}` (ATK, as BuffData writes it) is accepted and does nothing | gap | G7: found writing the equipment drafts; the kits use `zone: atk` |

**Counts** (44 rows): supported 32 (7 of them `supported (data)`: rows 25,
29, 31, W1, S1, S3, S5), gap 7 (rows 4, 13, 26, 28, W2, S6, K1), data 1
(row 5), unknown 4 (rows 12, 15, 19, S7), unique? 0. Gaps G1–G8 below (G6
is row 5's compiler gap).

## Gaps

### G1. A buff modifier that holds only against a target in a state (talent 1)

- **family:** conditions
- **feature:** `KitBuffModifier.if: Predicate`, judged per hit as it lands,
  on the hit's target and the hit (the same context a hit's `if` gets:
  `enemyControl`, `enemyStatus`, `enemyPhysical`, `enemyInfliction`,
  `enemyModifier`, `enemyStaggered`…). It generalises the existing
  `staggeredOnly` filter. Talent 1 is then a permanent self buff (a
  `fightStart` trigger, no duration) with `{zone: damageBonus, value:
  {talent: 0, key: dmg_up}, if: {enemyControl: "slow"}}`. `calc` and the
  log checker treat a modifier with an unknown `if` like an unknown hit `if`
  (try both).
- **evidence:** `buff_chr_0022_bounda_talent_1` damageModifier condition
  CheckTagMatch 1925762097 (the `applyTags` of `buff_common_affixes_slow`)
  → DamageScaleProcessor NormalCalcZone `dmg_up`. Text: "Fluorite gains
  DMG Dealt +{dmg_up:0%} against Slowed targets." The same shape (a
  damageModifier with a target condition) is in
  `buff_chr_0034_typhoea_combo_enemy_debuff` (CheckBuffStackNumAdvanced on
  `buff_common_affixes_slow`), where the debuff slows the enemy itself, so
  its kit doesn't need it.
- **impact:** +20% DMG on every Fluorite hit against a Slowed enemy: her
  explosion always (3.1 s Slow from the kick), everything within 6 s after
  it from P3, and everything inside Gilberta's ultimate field. Roughly
  5–15% of her damage; missing entirely today.

### G2. Basic-attack steps with alternatives by timing (attack4 / attack4_1)

- **family:** skills (timing)
- **feature:** the chain pointer holds every chain step that a basic
  attack's windows list, each with its own window: attack3 → attack4 in
  frames 18–24, attack4_1 in 24–30. `actionGate` lets a step start in its
  own window; an attack input lands as the step whose window it's in. The
  loader marks `attack4_1` a chain step because a lower step's window
  lists it (not only by the trailing number).
- **evidence:** `chr_0022_bounda_attack3` AllowNextSkillAction 18–24 [attack4]
  and 24–30 [attack4_1]; ComboCacheAction the same. In the scratch copy,
  `attack4_1` with `chainStep: true` fails: "is a basic-attack chain step,
  and the chain isn't at it". Other operators with suffixed steps:
  `chr_0017_yvonne_ult_attack1_1…3_2`, `chr_0042_namtch_attack5_1…3`.
- **impact:** none on Fluorite's numbers (same values; attack4 is the
  earlier and better choice). Matters for replaying logs that use the late
  input and for Yvonne's and chr_0042's chains.

### G3. A rotation step waits for the current cast's own delayed actions

- **family:** skills (timing)
- **feature:** a recorded action without `at` starts no earlier than the
  operator's current cast's pending non-detached delayed cast-trigger
  actions (they're the cast's own effects, like its hits), in
  `ownHitsLanded`. With `at` it may still interrupt and drop them.
- **evidence:** scratch scenario: battle skill then ultimate without `at`:
  the ultimate starts at the battle skill's frame (priority 7 > 3), the
  frame-10 kick is dropped, and neither explosion happens; with `at` 0.8 s
  later the ultimate detonates it (13,058 damage). Arcane's `imprison`
  (delay 11) is the same kind of trigger.
- **impact:** a rotation that writes "battle skill, ultimate" loses the
  battle skill's whole damage (7–13k per cast at level 12). Small fix.

### G4. A buff action that adds several layers

- **family:** buff lifecycle
- **feature:** `{kind: "buff", buff, layers?: ValueExpr}`: that many
  layers at once (each with its own duration, the oldest replaced at
  `maxStacks`), e.g. `layers: {eventCount: true}` (a `statusConsumed`
  event's count is the status level already).
- **evidence:** `buff_equipsuit_expend_spell01`: GetTargetBuffBBAdvanced
  `count` of the consumed buff → CreateBuffAction `count: addstack` of
  `buff_equipsuit_expend_spelldamage` (stackingType 2, `max_stack`). The
  same need was met for Umbra of Frigid Eventide's `wind_grant` layers with
  a stack instead (its layers share one timer); here they don't.
- **impact:** Xiranflow gives 1 layer (+15% Electric / Nature DMG) where a
  level II–IV consumption gives 2–3 (+30–45%) for 25 s.

### G5. Effects triggered by the enemy's attacks (talent 2)

- **family:** *new* ("enemy actions"): no family covers what the enemy does
  to the team; nothing in the engine models enemy attacks.
- **feature (interim):** an always-on, user-switched state for talent 2's
  ATK (scenario `options.conditions`), as the legacy conditions do. Today a
  condition can't read it: `conditionValue` reads a talent's attached
  *buff* only, and talent 2 attaches a *skill* (`chr_0022_bounda_talent_2`);
  the fix is small (values family: read attached skills as `talentSource`
  already does). Later, an enemy-attack timeline (Arts hits at known times)
  would let a trigger `on: damageTaken` fire it with its probability as an
  expected value.
- **evidence:** `buff_chr_0022_bounda_talent_2` abilityEvent 101 +
  CheckDamageType 2–5 + Probablity `probability` → `_talent_2_atkup`
  (ATK +`atk_up`, 10 s). Log: `buff_chr_0022_bounda_talent_2_atkup` (atk
  0.2) on her hits from t=79476 to 88682 against Rhodagn.
- **impact:** +20% ATK for 10 s after an Arts hit taken, 20–30% of the
  time: a few % of her damage over a fight; unmodelled. Other operators
  with "when hit" offensive effects will need the same; propose to defer
  with the interim condition.

### G6. Compiler: projectile routes and jump branches are alternatives

- **family:** data compilation
- **feature:** `compileSkill` emits one landing for a LaunchProjectile with
  both `castSkillOnHit` and `castSkillOnBlock` naming the same skill (the
  block route only when blocked); JumpToAction targets inside an ability
  entity are alternatives of the landing at the jump's start (not extra
  landings), reported as a branch.
- **evidence:** `efsim kit-draft chr_0022_bounda`: attack4 and attack4_1
  each have `projhit` + `projhit_2`, and the battle skill has two hit
  entries of count 2 at frames 99 and 159 (four explosions), where the data
  has one projectile and one explosion (frame 89 or 149 of the entity). The
  compiled projhit Slow (SlowAction) isn't emitted either.
- **impact:** none on kits written by hand; matters once the loader takes
  defaults from the compiler (D1 follow-up).

### G7. ATK as a kit-buff attribute is silently ignored

- **family:** buff lifecycle (attribute modifiers, B6)
- **feature:** the loader rejects `{attr: 2}` (and other attributes that
  `attrModifier` doesn't map and nothing reads) in a kit buff, or maps ATK
  (attr 2, formulaItem 6) to `zone: atk`. Design principle 7 (fail loudly).
- **evidence:** a draft `wpn_pistol_0003.atk_up` with `{attr: 2, value:
  atk_up}` loaded and `calc --buff` gave the same damage; with `{zone:
  atk}` it changes (633 → 877 per attack1 with Long Road and Aburrey's
  combo buff). Every BuffData ATK buff in this batch is attr 2 formulaItem 6.
- **impact:** none if kit writers know it; a silent zero otherwise.

### G8. Build format: weapons with two skills

- **family:** data compilation (build schema)
- **feature:** `weapon.skillLevels` has as many entries as the weapon has
  skills (WeaponBasicTable `weaponSkillList`: 2 for 3-star weapons).
- **evidence:** a Peco 5 build with `[9, 9]` fails the schema ("must NOT
  have fewer than 3 items"); `[9, 9, 9]` works, the third ignored.
- **impact:** none on numbers; a confusing build file.

## Verification

**The pending log** `fixtures/pending/zmdlogs-abfd4b7478ec.json` (Rhodagn;
Fluorite P5, level 60, promotion 2, skills level 1, wpn_pistol_0012, four
suit_atk02 pieces). With the draft kit in the scratch copy, `efsim zmdlogs
check` gives Fluorite 56 hits, 100% of her damage covered, 0 match and 56
mismatch, **every one at the same ratio 0.5428–0.5448** (0.5438 ± rounding):
attacks 1–4, the ultimate's four shots, and the four Cryo bursts credited to
her (`buff_common_cryst_cryst_triggered`) alike. Read with that factor:

- attack4 is one landing of `atk_scale` (rules out 3 × from `display_atk_scale`);
- the combo is one `atk_scale` hit: 4170 / 0.5438 = 7668 = the prediction
  with 2 Yinglung stacks (7665), 4453 / 0.5438 = 8189 = 3 stacks (8187);
- the four ultimate shots are one `atk_scaleN` landing each (1081 / 0.5438 = 1988 vs 1986 predicted);
- each combo is followed by a Cryo burst of hers (exact), so the combo
  inflicted Cryo on a Cryo-inflicted enemy (row 19, the Cryo branch), and
  the 4th ultimate shot's Cryo branch fired (t=64225, row 23);
- P5: combos 38.4 s apart against a 40 s cooldown (rows 17, 32);
- talent 2's ATK (+0.2) is logged at 79–89 s and the ratio doesn't change
  under it, so the factor is in her base ATK (operator + weapon), not in
  ATK%. The log doesn't record weapon level; the fixture assumes 90 for a
  level-60 operator. A weapon around level 22 gives about this factor
  (`calc`: ATK 2,566 at weapon level 90, 1,365 at 20). The fixture's build
  should be corrected before it's promoted.

She never casts her battle skill in this log, so the explosive (rows 8–16),
talent 1, Howling Guard and Aburrey's battle buff are unverified by it.

**Si's ×0.965:** nothing in Fluorite's kit or equipment explains it. She has
no team buff and no enemy debuff with a modifier: talent 1 is her own DMG
against Slowed targets, talent 2 her own ATK, the P5 aura only cuts her own
combo cooldown, the ultimate's target buff and the explosive marker carry no
modifiers, and Slow (`buff_common_affixes_slow`) changes only attribute 86
(SlowActionSpeedScalar, move speed); she didn't cast her battle skill, so no
Slow was applied anyway. Her suit_atk02 aura only counts teammates'
battle-skill casts for her own stacks. A team-wide ×0.965 would also hide in
her uniform 0.5438 (it can't be separated from her build), but no data path
from her reaches Si's damage.

**Scratch runs:** the draft kits load with the real loader (`calc`,
`simulate`, `zmdlogs check`), and `npx vitest run` in the scratch copy passes
(19 files, 425 tests; the kit test wants `attack4_1` in the kit, which is why
it's there although not castable). A Fluorite + Gilberta scenario: kick at
0.33 s (Slow 3.1 s), explosion at 3.30 s (7,097, P3 Slow 6 s), Gilberta's
explosion makes 2 Nature stacks → Fluorite's combo, its Nature → burst;
battle skill at 14.37 s and ultimate at 15.2 s → enhanced explosion at
17.20 s (13,058) right after the first shot and no frame-99 explosion.

**Logs that would verify the rest:**
- Fluorite's battle skill alone (normal explosion: frame, `atk_scale`, the
  logged key `chr_0022_bounda_normal_skill_abilityrange`, talent 1's +DMG under her
  own Slow) and battle skill → ultimate within 3 s (the ×1.3 explosion, its
  Link, row 12).
- With a Nature teammate (Gilberta, Typhoeus, Arcane in INT mode) for the
  combo's and the ultimate's Nature branches, and Gilberta's ultimate field
  for talent 1 under a teammate's Slow.
- At P3 (the 6 s Slow) and P5 (combo cooldown cuts with a known infliction
  sequence).
- Equipment: Howling Guard and Long Road on her (ATK buffs are logged as
  `buff_wpn_pistol_0002` / `_0003`), Aburrey's Legacy (three buffs),
  AIC Fieldwork (stat panel only), Xiranflow on an operator that consumes
  Electrification or Corrosion (none in batch 2), for G4 and row S7.

**In-game tests** (none in docs/in-game-tests.md covers these; numbers to be
assigned at the merge):
- **F1. Link on the detonated explosion.** A combo (one Link stack), then
  Fluorite's battle skill and at once her ultimate: is the big explosion
  ×1.3 only, or ×1.3 × 1.3 (Link at 1 stack, +30%)? And is the ultimate's
  first shot boosted by Link (the battle skill used it up)?
- **F2. Talent 1 under a teammate's Slow.** With Gilberta, compare
  Fluorite's basic attacks inside and outside Gilberta's ultimate field
  (no Slow of her own): +10/20% inside means anyone's Slow counts (the data
  says so: the condition is the tag only).
- **F3. Two explosives.** Two battle skills within 3 s on one enemy (SP
  ≥ 200): one explosion, two, or does the second replace the first?
- Test 33's second part applies to her combo too (the trigger's element or
  the enemy's current one); test 35 to her P5 (does an infliction that
  forms a reaction cut the cooldown?); test 47 to her shots and kick
  (travel).

## Kit plan

As it would be written today; the drafts are
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch2/scratch-chr_0022_bounda/kits/`
(chr_0022_bounda.json, wpn_pistol_0002.json, wpn_pistol_0003.json,
suit_atk01.json, suit_expend_spell01.json), and they load.

**Operator kit** `chr_0022_bounda.json`, `element: natural`, no stacks.

Skills (frames from SkillData; projectile hits at launch, Ti2):

| Skill | Hit | Scale | Frame | Other |
|---|---|---|---|---|
| attack1 / 2 / 3 | projhit (events `*_projhit`) | `atk_scale` | 13 / 9 / 9 | attack3 `sp: atb × 0.333333313` (0) |
| attack4 | projhit (`attack4_projhit`) | `atk_scale` | 29 | `sp: atb`, `poise: attack_poise`, `poiseControlledOnly`; Final Strike from the data |
| attack4_1 | the same | `atk_scale` | 26 | `chainStep: true`; castable only after G2 |
| power_attack | hit | `atk_scale` | 20 | finisher (engine) |
| plunging_attack_end | hit | `atk_scale` | 1 | `sp: atb` (0) |
| normal_skill | explosion (`normal_skill_abilityrange`) | `atk_scale` | 99 | `detached`, `if: {buffActive: improvised_explosive}`, `poise: poise`, Nature infliction, P3 Slow; `teamEnergyFrame: 99` |
| combo_skill | hit | `atk_scale` | 15 | `energy: usp`, `poise: poise`, infliction of the enemy's element if Cryo or Nature |
| ultimate_skill | shot1–4 (`ultimate_skill_N_projhit`) | `atk_scaleN` | 59 / 63 / 67 / 72 | `poise: poise`; shot 4's two conditional inflictions |

Buff: `improvised_explosive` (enemy, 3.1 s, no modifiers). Triggers:

```json
{ "id": "combo_window", "on": { "event": "inflictionApplied", "elements": ["cryst", "natural"], "minStacks": 2 }, "by": "anyone", "do": [{ "kind": "openCombo" }] },
{ "id": "explosive_stuck", "on": { "event": "cast", "skills": ["chr_0022_bounda_normal_skill"] }, "by": "self", "delay": 10,
  "skill": "chr_0022_bounda_normal_skill",
  "do": [{ "kind": "buff", "buff": "improvised_explosive" },
         { "kind": "apply", "applies": [{ "kind": "control", "status": "slow", "seconds": 3.1 }] }] },
{ "id": "explosive_done", "on": { "event": "hit", "skills": ["chr_0022_bounda_normal_skill"] }, "by": "self",
  "do": [{ "kind": "endBuff", "buff": "improvised_explosive" }] },
{ "id": "ultimate_detonates", "on": { "event": "hit", "skills": ["chr_0022_bounda_ultimate_skill"] }, "by": "self",
  "if": { "buffActive": "improvised_explosive" }, "skill": "chr_0022_bounda_normal_skill",
  "do": [{ "kind": "endBuff", "buff": "improvised_explosive" },
         { "kind": "hits", "hits": [{ "id": "enhanced_explosion", "damageType": "battle", "scale": ["atk_scale"],
             "bonuses": [{ "zone": "multiplicative", "key": "boom_up" }],
             "events": ["chr_0022_bounda_normal_skill_abilityrange"], "frames": [1], "poise": "poise",
             "applies": [{ "kind": "infliction", "element": "natural" },
                         { "kind": "control", "status": "slow", "durationKey": "duration_potential", "if": { "potentialAtLeast": 3 } }] }] }] },
{ "id": "p5_combo_cooldown", "on": { "event": "inflictionApplied", "elements": ["cryst", "natural"] }, "by": "anyone",
  "if": { "potentialAtLeast": 5 }, "cooldown": "CD", "skill": "buff_chr_0022_bounda_potential_5_auro",
  "do": [{ "kind": "cooldown", "who": "self", "skills": "combo", "seconds": { "product": [-1, "reduce"] } }] }
```

Combo and shot-4 applications:

```json
"applies": [{ "kind": "infliction", "element": "enemy",
              "if": { "any": [{ "enemyInfliction": "cryst" }, { "enemyInfliction": "natural" }] } }]
"applies": [{ "kind": "infliction", "element": "natural", "if": { "enemyInfliction": "natural", "minStacks": 2 } },
            { "kind": "infliction", "element": "cryst", "if": { "enemyInfliction": "cryst", "minStacks": 2 } }]
```

Notes for the kits phase:
- `boom_up` (0.3 in the normal skill's table at every level) stands for the
  DamageScaleProcessor's literal +0.3; `bonuses` reads it from the trigger's
  `skill`.
- The two `if: {potentialAtLeast: 3}` are required: below P3
  `duration_potential` is 0 and a 0 s control status throws.
- Waiting on gaps: talent 1 (G1: `fightStart` → permanent buff with the
  modifier `if: {enemyControl: "slow"}`), talent 2 (G5: an interim
  condition once conditions read attached skills), attack4_1 (G2),
  rotation timing after the battle skill (G3: until then, scenarios give
  the following step an `at`).
- Gilberta's and Typhoeus's kits should apply their Slow
  (`control` "slow") so that talent 1 sees it (row 27).

**Equipment kits** (values from each weapon's skill 3 or the set skill;
every ATK buff as `zone: atk`, not `attr: 2`, G7):

- `wpn_pistol_0001` (Peco 5): none; both effects are stat-panel modifiers.
- `wpn_pistol_0002` (Howling Guard): buff `wpn_pistol_0002.atk_up` (self,
  `gameBuff: buff_wpn_pistol_0002`, `duration: duration`, `{zone: atk, value:
  atk_up}`); trigger `{on: {event: hit, kinds: [battle]}, by: self, skill:
  sk_wpn_pistol_0002}` → that buff.
- `wpn_pistol_0003` (Long Road): the same with `buff_wpn_pistol_0003`, trigger
  `{on: {event: cast, kinds: [combo]}, by: self, skill: sk_wpn_pistol_0003}`.
- `suit_generaltype` (AIC Fieldwork): none; all stat panel.
- `suit_atk01` (Aburrey's Legacy): buffs `suit_atk01.battle` / `.combo` /
  `.ultimate` (`gameBuff` buff_equipsuit_atk_01_normalskill / _comboskill /
  _ultimateskill, `duration`, `{zone: atk, value: atk_up}`), triggers on
  `cast` of `battle`, `combo`, `ultimate` by self, `skill:
  passive_equipsuit_atk_01`.
- `suit_expend_spell01` (Xiranflow): buff `suit_expend_spell01.spell_dmg`
  (self, `gameBuff: buff_equipsuit_expend_spelldamage`, `duration`,
  `maxStacks: max_stack`, attrs 52 and 54 `spell_dmg_up`); trigger `{on:
  {event: statusConsumed, statuses: [electrification, corrosion]}, by:
  self, skill: passive_equipsuit_expend_spell01}` → the buff, with `layers:
  {eventCount: true}` once G4 exists (one layer until then).
