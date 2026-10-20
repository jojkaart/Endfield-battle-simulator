# Purrchena (chr_0038_purrche): gap report, batch 3

Operator Purrchena (Defender, Physical, sword: CharGrowthTable `charTypeId`
Physical, `weaponType` 1), with the weapon Dessert Moment (`wpn_sword_0023`,
5-star, weaponType 1: **confirmed** hers) ([batch-3.md](../batch-3.md)).

Sources (rmxlinux, game 1.6): SkillData `chr_0038_purrche_*` (26 files),
BuffData `buff_chr_0038_purrche_*` (46 files), `sk_wpn_sword_0023`,
`buff_wpn_sword_0023_intensityup` / `_spelldmgup`; TableCfg CharGrowthTable,
CharacterPotentialTable, PotentialTalentEffectTable, SkillPatchTable,
WeaponBasicTable, I18nTextTable_EN. Values are at skill level 12 / weapon
skill level 9 unless noted. Frames are SkillData timeline frames (30 FPS)
from the cast. Her files were added to the checkout during this analysis
(commit 535e88f); before that only TableCfg was present.

There is no earlier report on Purrchena. Claims checked: Catcher's report
(batch 2 G1) says her `normal_skill`, `_block_*`, `_loop_*` and combo use
the Catcher-style listener (abilityEvent 101, CheckDamageDecorateMask
checkType 3, mask 805306368): **confirmed** for normal_skill 0–50, loop_1 /
loop_2 0–360, block_1 3–24, block_2 2–25 and the shielded combo segments
221–251 / 281–310. "When the controlled operator is attacked" as her combo
trigger: **confirmed** (CharGrowthTable `chr_0038_purrche_ComboSkill`; no
trigger action in the data, so it's game code).

`efsim kit-draft chr_0038_purrche` was run (output in the scratch folder):
basic attacks, finisher, dive and counter compile right; the combo (36
hits) and the ultimate (38 hits) come out as every random alternative at
once, because the compiler doesn't decide Probablity branches; what else it
leaves out is in the `data` rows.

## Action types per file

What matters for damage, resources, state or timing (sound, VFX, camera,
animation, root motion, rotation, super armour, teleport and target-finding
left out):

| File | Action types that matter |
|---|---|
| attack1–3 | ChannelingAction + DamageAction (`atk_scale_1/2/3` = `atk_scale` × SimpleCalcBB factors), attack3: mask 2097280 (Final Strike), poise unit `poise` (onlyEnableForMainChar), ObtainCostAction `atb` (atbOnlyMainChar), AllowNextSkillAction |
| power_attack | DamageAction (BreakingAttackCalculation, multiplier 1.0, mask 132) f24, GainBreakingAttackAtb, CreateBuff `buff_common_power_attack_disable_cast_skill` 0–25, BlowOffAction |
| plunging_attack_end | DamageAction (mask 1152), ObtainCostAction `atb` |
| normal_skill | durationFrame 184, exclusiveFrame 50, spec 3. ObtainCostAction costType 1 `atb_return_1` / `potential_5_atb` f0; CreateBuff `buff_common_obtain_ultimate_sp` f0, `buff_chr_0038_purrche_aura_block` 0–50 (inherited by block_1/2, loop_1/2, combo, counter), `_block_counter` f0, `_block_change_skill` f0; EventListenerAction 0–50 (101 → CastSkill block_1; 9 with `buff_eny_0018_lbtough_pre_catch` → block_1); AllowNextSkillAction 12–50 (counter); **CastSkill loop_1 at f49**. Frames 300–1495 lie beyond durationFrame (dead) |
| normal_skill_loop_1 / _loop_2 | durationFrame 494 / 431, exclusiveFrame 361, MarkCanInterrupt 361, InterruptCurSkillAction 491 (loop_1). IfElse f0–1: `enter_normal_skill_end` present or no aura → JumpToAction 360; EventListener 0–360 (101 → block_1 from loop_1, block_2 from loop_2; 9 + `block_end` → JumpToAction 360); AllowNextSkillAction counter over the whole loop. No DamageAction (their `atk_scale` 0.42 / `poise` 30 defaults are unused) |
| normal_skill_block_1 | 25 frames. ObtainCostAction costType 0 `talent_1_usp`, costType 1 `atb_return_2`, `potential_5_atb`; CompareFloat `talent_1_usp` > 0 → CreateBuff `ult_add_red` (one layer); InterruptAction (attacker, 2 s); DamageAction **disabled**; TimeDilationAction layer 1 (0.6 s, attacker and self); CreateBuff `pause_block` 0–9, `block_shelter_stay`; EventListener 3–24 (→ block_2); CastSkill loop_2 at 23 (or 9 if the aura ended) |
| normal_skill_block_2 | 25 frames. InterruptAction 2 s; DamageAction disabled; layer-1 dilations; `pause_block` 0–11; EventListener 2–25 (→ block_2 again, if the aura is up); CastSkill loop_2 at 22 (or 12) |
| normal_skill_counter | exclusiveFrame 35, spec 3. f0 FinishBuff `aura_block`, `block_counter`, `block_change_skill`, `block_counter_mark`; ChannelingAction 9–13: SpellInfliction 3 (Nature), DamageAction `atk_scale` (damageType 6, mask 4352, poise `poise`), BlowOffAction, ObtainCostAction `atb_return` / `potential_5_atb` if a block happened; AllowNextSkillAction 15–45 (normal_skill) |
| combo_skill | durationFrame 330, exclusiveFrame 330, spec 4. f0 IfElse: aura up → JumpToAction 210 (no block yet) or 270 (after a block); f1 / 211 / 271: random item (Probablity 0.3333 / 0.5, rerolled 50/50 if equal to `comboType_last`, stored in `combo_lasttype`); LaunchProjectile giftbox at 17 / 221 / 281 → `combo_skill_gene` → SpawnAbilityEntity `combo_skill_giftbox_abilityrange`; TimeDilationAction ComboSkill at 0, 210, 270; AllowNextSkillAction 26–75 (counter, normal_skill), 221–251 and 281–310 (counter); **MarkCanInterrupt 28**, **InterruptCurSkillAction 206**; shielded segments: EventListener (→ block_1 / block_2), `pause_block` 210–251 / 270–310, CastSkill loop_1 at 250 / loop_2 at 309 |
| combo_skill_giftbox_abilityrange | entity f44: HealAction (MultiplyAttributeCalculation Will × `heal_scale` + `heal_static_value`, heal tag −1517158118) on the team, ObtainCostAction `usp`; f45 Switch `comboType`: 1 → projectile → `projhit_1` → entity `abilityrange_1_1` (or `_potential_3` when `potential_3` = 1); 2 → `projhit_3`; 3 → ForEach team → projectile → `projhit_4` |
| combo_skill_projhit_3 (Bomb) | InterruptAction 1 s, DamageAction `atk_scale_boom` (mask 12288) + poise `poise` |
| combo_skill_abilityrange_1_1 (Handicraft) | ExecuteIntervalAction 0.5 s over 0–56: PullAction + DamageAction `atk_scale_blackhole_dot` (mask 8192); f56 DamageAction `atk_scale_blackhole_end` (mask 12288), InterruptAction |
| combo_skill_projhit_4 (Yummy Dessert) | HealAction (Will × `heal_scale_fish` + `heal_static_value_fish`, combo heal tag) |
| ultimate_skill | durationFrame 262, exclusiveFrame 157, spec 5. f0–3: `prob` += `ult_add_red` layers × `talent1_prob_up`, three Probablity(`prob`) rolls each adding 1 to `box_num`, FinishBuff `ult_add_red`; ChannelingCastingAction 0–139 (cantCastSkill, cantSwitch); TimeDilationAction 0–135 (layer 0, finishByAction); JumpToAction 0 → 68 if `box_num` ≥ 1, 67 → 135 always; CreateBuff `pause_change_skill_buff` 0–146; f138: three LaunchProjectile slots by `box_num` (red = `ult_skill_projhit`; else Probablity(`normal_boom_prob` 0.5) → `normal_bomb_projhit`, else `normal_blackhole_projhit` if `black_hole_count` < 1, else bomb); AllowNextSkillAction 146–180 |
| ult_skill_projhit (Ambassador's Special) | CreateBuff `ult_spell_vulnerable` (`duration_vul`, `rate_vul`), DamageAction `atk_scale_ult` (mask 4608) + poise `poise_2` |
| ult_skill_normal_bomb_projhit | DamageAction `atk_scale` (mask 4608) + poise `poise_1` |
| ultimate_skill_abilityrange_blackhole | as the combo's Handicraft: 0.5 s interval over 0–56 (`atk_scale_blackhole_dot`, mask 512), f56 `atk_scale_blackhole_end` (mask 4608) |
| buff_…_aura_block | 3 s; PauseBuffTime on cast of block_1 / block_2 / combo, resumed when `pause_block` ends; ends on a dash (`buff_common_dash`), on an ultimate cast (CheckSkillType 7), on swap events 2/3; on `block_counter` ≥ 2 the first time: SetBuffDuration 3.0; on `block_counter` ≥ 2: `block_shelter_down` (Protection step); on end: `block_end` |
| buff_…_block / _block_instance / _block_shelter_stay(_instance) | AuraAction → ShelterAction `dmg_taken_down` (Protection to nearby operators), enhancing −0.2 per `block_shelter_down_aura_instance` layer |
| buff_…_block_counter | stackingType 8, max 3, 30 s; at ≥ 2 layers → `block_counter_mark` |
| buff_…_block_change_skill | 10 s, ChangeSkillAction normal_skill → counter (lifeTimeType 2); paused by `pause_change_skill_buff`; its end removes `block_counter` |
| buff_…_combo_lasttype | duration 40, lifeType 1, holds `combotype` |
| buff_…_ult_spell_vulnerable | stackingType 2, max 3; VulnerableAction subType 1 (Arts) → child `vulnerable_spell_child` (priority key `rate`) |
| buff_…_ult_add_red | stackingType 2, max 3, lifeType 1 |
| buff_…_talent_2 / _effectbuff(_Add / _cd) | Aura on the team; at full HP (CheckHp = 1.0) a defender-side damage reduction `dmg_down` for the next hit (ends on abilityEvent 12), per-operator global cooldown `cd` |
| `combo_always_*`, `perform_test_*`, `train_ult_*` | Force outcomes (tutorials / tests); nothing in battle creates them |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–3: `atk_scale` 1.08 / 1.16 / 2.30; attack1 f10 ×0.4, f17 ×0.6; attack2 f11 ×0.2, f14 ×0.3, f22 ×0.5; attack3 f18 ×0.2, f21 ×0.8 (Final Strike, mask 2097280) | supported | as kit-draft (`frames`, `factor`) |
| 2 | Final Strike: `poise` 21 (onlyEnableForMainChar), `atb` 23 (atbOnlyMainChar): "As the controlled operator, Final Strike also deals {poise} Stagger" | data | `poise`, `poiseControlledOnly` hand-written (D3); `sp: atb` from kit-draft |
| 3 | Finisher f24, `atk_scale` 9.0 × BreakingAttackCalculation multiplier 1.0; disable-cast 0–25; GainBreakingAttackAtb | supported | as kit-draft; finisher rules are the engine's |
| 4 | Dive `plunging_attack_end` f1, 1.8 | supported | not castable until rotations have jumps (S10) |
| 5 | Battle skill: 100 SP; "immediately returns some SP": `atb_return_1` 20 at f0 (atbGainMethod 1); team energy at f0 (`buff_common_obtain_ultimate_sp`, no ratio) | supported | cast trigger `{kind: sp, value: atb_return_1}`; default team energy |
| 6 | "While Purrchena's shield is up, she grants Protection to herself and nearby operators": `aura_block` 3 s (`display_time_1`) → ShelterAction `dmg_taken_down` 0.9 | supported | self buff `shield_up` (3 s) and team buff `protection` `{attr: 63, value: dmg_taken_down_1}`: a Protection-category buff (Eternal Xiranite); damage taken isn't simulated |
| 7 | The shield holds her: normal_skill casts loop_1 at f49; the loop runs until the aura ends (block_end → JumpToAction 360, exclusive 361) | gap | **G1**: loop_1, loop_2 and block_2 have no SkillPatchTable row and none of the four helper skills is in a skill group, so the loader refuses them as kit skills ("unknown skill"). The engine frees her at normal_skill's exclusive frame 50 (1.67 s) instead of when the shield drops (3 s, more after a block) |
| 8 | Blocks: attacked while the shield is up → block_1 (first) or block_2 (later), 25 frames each, the aura paused 9 / 11 frames (`pause_block`), InterruptAction on the attacker | supported | triggers `on: attacked, by: self, if: {buffActive: shield_up}` split by a `blocked` stack; the pause as `extendBuff` 9/30 and 11/30 s (exact for a pause of known length). The 25-frame casts wait on G1 |
| 9 | "the first successful block extends the shield up duration and returns additional SP": SetBuffDuration 3.0 on the aura (not +3: remaining set to 3 s), `atb_return_2` 20 returned | supported | first-block trigger: re-apply `shield_up` and `protection` (a plain buff's reapplication resets its timer), `extendBuff` 0.3 s, `sp: atb_return_2` |
| 10 | "Protection granted during shield-raising is reduced after every blocked attack": SkillPatch `dmg_taken_down_2..4` 0.8 / 0.7 / 0.6, but `block_instance` lowers it by `shelter_add` −0.2 per `block_shelter_down` layer (0.9 / 0.7 / 0.5 / 0.3, the SkillData defaults) | unknown | the data disagrees with itself; no damage effect (damage taken isn't simulated). Not written |
| 11 | "After casting, Purrchena's battle skill is temporarily changed to LEAVE MY FRIENDS ALONE!": `block_change_skill` 10 s (ChangeSkillAction), paused during the ultimate (`pause_change_skill_buff` 0–146) | supported | self buff `counter_ready` 10 s; normal_skill `available: {not: {buffActive}}`, counter `available: {buffActive}`; the ultimate's pause as `extendBuff` 78/30 s (frames 0–67 and 135–146 played) |
| 12 | Counter: "headbutts a target in front of her to deal Nature DMG and apply Nature Infliction": f9 `atk_scale` 4.0, damageType 6, Nature infliction, poise 20, BlowOff; ends the shield (FinishBuff aura at f0); exclusive 35, recast window 15–45 | data | hit `element: natural`, `poise` hand-written (D3: per-hit element, poise); kit-draft gives the infliction. Cast trigger ends `counter_ready`, `shield_up`, `protection` |
| 13 | Counter SP `atb_return` and P5 `potential_5_atb` (also in normal_skill and block_1) | supported | 0 at every level and no potential sets `potential_5_atb` (P5 changes the ultimate): dead keys, nothing to write |
| 14 | Combo trigger: "When the controlled operator is attacked" | supported | trigger `on: attacked, by: controlled` → `openCombo` |
| 15 | Combo item: "randomly revealing one of the following items": Handicraft (comboType 1), Bomb (2), Yummy Dessert (3) with 1/3 each; equal to the last one (`combo_lasttype`, 40 s) → 50/50 between the other two | gap | **G4** (a weighted choice). Today: an exact composite of `chance` triggers (K1) with marker stacks, one set per previous item (scratch kit: 12 triggers per path) |
| 16 | Giftbox opens at entity frame 44 (combo f61: launch f17 + 44): team heal (combo heal tag), `usp` 10 | supported | delayed cast trigger: `{kind: heal, target: team, healKind: combo}`, `{kind: energy, value: usp}`, `detached`. Projectile travel isn't in the data (row 33) |
| 17 | Bomb: `atk_scale_boom` 3.0 (P3 3.6), poise 10, "additional Stagger" | supported | triggered hit, `damageType: combo` |
| 18 | Handicraft: pulls every 0.5 s from entity f0 over 0–56 (4: f0/15/30/45) × `atk_scale_blackhole_dot` 0.25, end f56 `atk_scale_blackhole_end` 0.5 (`display_atk_scale_blackhole` 1.5 = 4 × 0.25 + 0.5) | data | written by hand: kit-draft gives one pull (ExecuteIntervalAction isn't expanded: D3) |
| 19 | Yummy Dessert: "Grants HP Treatment to the controlled operator"; the data heals every team member (ForEach team → `projhit_4`) | supported | `{kind: heal, target: team, healKind: combo}` (the data's reach). Heal amounts aren't modelled |
| 20 | Combo while the shield is up: f0 IfElse → JumpToAction 210 (no block yet) / 270 (after one); giftbox at 221 / 281; blocks still possible; the aura paused 41 / 40 frames; back to loop_1 / loop_2 at 250 / 309 | supported (interims) | the jump as a cast-trigger `jump` (from 0 until 1; IfElse-nested jumps aren't in `timing.jumps`, so `KitSkill.jumps` can't name them: D3 note); the pause as `extendBuff`; the return to the loop waits on G1 (interim `endAction` at 250 / 309); the giftbox's frames on G2 (interim: real-frame delays 55) |
| 21 | Combo without the shield: InterruptCurSkillAction 206, MarkCanInterrupt 28, AllowNextSkillAction 26–75 (counter, battle skill), exclusiveFrame 330 = durationFrame | gap | **G3**: the engine ends the action at 206 and holds lower-priority actions until then (checked: attack2 6.87 s after the combo); MarkCanInterrupt at 28 isn't read |
| 22 | The combo's three ComboSkill slow-downs (f0, 210, 270): only the one on the path taken plays | gap | **G5**: the engine applies all three (checked: an enemy attack at 31 s after one unshielded combo comes at 32.1–32.3 s; the first slow-down alone loses ≈ 0.44 s) |
| 23 | Combo cooldown 22 s (L12); ComboSkill time dilation | supported | tables, loader |
| 24 | Ultimate: cost 100 (P4 ×0.85 = 85), cooldown 20 s, cantCast/cantSwitch 0–139, time stop 0–135, JumpToAction 0 → 68 if any Ambassador's Special (conditional) and 67 → 135 (always), exclusive 157 | supported | loader. Both paths reach f138 70 real frames after the cast, so the conditional jump needn't be taken |
| 25 | "There is a chance that the Prezzie reveals Ambassador's Special": three independent rolls of `prob` 0.2 (P1 ×1.5 = 0.3) + `ult_add_red` layers × `talent1_prob_up` 0.1 | supported | one `chance` trigger per Prezzie (K1), judged at the cast before the layers are consumed (T5). Scratch: 35 of 120 Prezzies at P5 (0.29; expected 0.3) |
| 26 | The other Prezzies: Bomb with `normal_boom_prob` 0.5, else Handicraft if none yet this ultimate (`black_hole_count`), else Bomb | supported | composite: per Prezzie a `chance` trigger and a fallback trigger with marker stacks (`prezzie_n`, `ult_handicraft`); G4 would make it one action |
| 27 | Ambassador's Special: `atk_scale_ult` 6.0 (P5 7.2), `poise_2` 15, "applies Arts Susceptibility": `rate_vul` 0.025 (P5 0.03) for `duration_vul` 5 s, created before the DamageAction; `ult_spell_vulnerable` stackingType 2, max 3 | supported | enemy buff `{zone: susceptibility, elements: [fire, pulse, cryst, natural], value: rate_vul}`, `maxStacks: 3`, `beforeDamage`. Whether layers from one ultimate add up is assumed (the child buff is priority-keyed, stackingType 0: such buffs add up per buffData.ts) |
| 28 | Prezzie Bomb `atk_scale` 3.0, `poise_1` 10; Handicraft as row 18 with mask 512 / 4608 | supported | triggered hits, `damageType: ultimate` |
| 29 | The Prezzies launch at timeline f138, after the jump 67 → 135 | gap | **G2**: a detached delayed action or hit isn't moved by the jump (checked: 4.6 s after the cast instead of 2.3 s). Interim: the Prezzie triggers are not `detached` (the cantCastSkill channel covers 0–139; their hits aren't cut by a later cast, checked) |
| 30 | Talent 1 "Your sorry came LATE!": first block gives `talent_1_usp` 6 / 10 energy; "Chance for Ambassador's Special of the next ultimate is increased by {talent1_prob_up}. This effect can reach {talent_1_stack} stacks": one `ult_add_red` layer per first block (max 3, lifeType 1), all consumed by the next ultimate | supported | first-block trigger: `energy: talent_1_usp`, gain stack `sorry_came_late` (max 3) if talent 1; ultimate cast trigger empties it |
| 31 | Talent 2 "Ambassador's Duty": operators at full HP take `dmg_down` 50% less from the next hit, per operator once every `cd` 180 / 90 s | gap | N1 (HP; deferred). No damage effect (a defender-side damage modifier, not a ShelterAction, so not a Protection-category buff either). Not written |
| 32 | P1 `prob` ×1.5; P2 DEF +20, Will +20; P3 `atk_scale_boom`, `heal_*_fish` ×1.2, `potential_3` = 1 (Handicraft entity `abilityrange_1_1_potential_3`, radius +20%); P4 ultimate cost ×0.85; P5 `atk_scale_ult` ×1.2, `rate_vul` ×1.2 | supported | values from the tables; P3's Handicraft logs under event key `chr_0038_purrche_combo_skill_abilityrange_1_1_potential_3` (a hit pair with `if: potentialAtLeast 3`); its radius has no effect on one enemy |
| 33 | Projectile travel of the giftbox, the Dessert and the Prezzies (speeds 12–23 in EntityBB) | unknown | not in the data (in-game test 47 is not testable by hand); hits land at launch + entity frames |
| 34 | The shield ends with a dash (`buff_common_dash`), an ultimate (CheckSkillType 7) or any skill that doesn't inherit it (basic attacks) | supported | triggers `on: perfectDodge` and `on: cast, kinds: [basic, ultimate]` → `endBuff`. With `dodge` in a scenario the controlled Purrchena dashes instead of blocking (test 53) |
| 35 | Which enemy hits block: CheckDamageDecorateMask checkType 3, mask 805306368; the abilityEvent 9 grab branch (`buff_eny_0018_lbtough_pre_catch`) | unknown | as Catcher's row 28: assumed every attack counts; the grab isn't modelled |
| 36 | InterruptAction on the attacker (blocks 2 s, items 1 s), BlowOff, PullAction, layer-1 dilations at blocks | supported | no effect: enemy actions are scripted; entity-layer dilation isn't modelled (design.md) |

### Equipment

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| E1 | Dessert Moment: `wpn_attr_str_mid` (Strength), `wpn_sp_attr_heal_mid` (Treatment Efficiency), `sk_wpn_sword_0023` "Max HP +{hp_up}" (cardAttributeModifier attr 1, formulaItem 6: +28% at L9) | supported | stat panel |
| E2 | "When the wielder's combo skill grants HP treatment, the operator receiving this HP treatment gains Arts Intensity +{phy_spell_up} and Arts DMG Dealt +{spell_dmg_up} for {duration}s": abilityEvent 50 + CheckHealTag −1517158118 (combo heal tag; no CheckTargetsEqual, so the wielder's own heal counts) → `buff_wpn_sword_0023_intensityup` (attr 87 +14) and `_spelldmgup` (attrs 51–54 +0.098), 20 s, on the healed (targetSource 0) | supported | trigger `on: {event: heal, kinds: [combo]}, by: self` → two team buffs `to: eventSubject`. Checked in scratch: the counter's Nature hit ×1.098 after a combo heal |
| E3 | "Effects of the same name cannot stack": stackingType 11, maxStackCnt 1, priority key | gap | B9 (batch 1, minor): one wielder is exact (a reapplication replaces); two wielders' copies would add up. 9 equipment buffs have this setting |

**Counts:** operator 36 mechanics: 24 supported, 3 data, 6 gap (G1, G2,
G3, G4, G5, and talent 2 on N1, deferred), 3 unknown, 0 unique?. Equipment 3:
2 supported, 1 gap (B9, minor).

## Gaps

### G1. Helper skills a skill casts (the shield's loop and blocks)

- **family:** skills (states) and data compilation.
- **feature:** the loader accepts as kit skills the SkillData files an
  operator's skill reaches through CastSkill (here `normal_skill_loop_1`,
  `_loop_2`, `_block_1`, `_block_2`), with the caster's skill group
  (battle) and no SkillPatchTable row needed: values default to the
  caster's level values (the helpers' own `atb_return_2`, `talent_1_usp`
  match normal_skill's keys) and the file's blackboard. They're
  `followUpOnly`, cast by trigger `cast` actions at the data's frames (49,
  23, 22, 250, 309), and their timing (exclusive 361, the jump to 360, the
  end at 491) comes from SkillData as for other skills. Today
  `data.skills` comes from SkillPatchTable only (gameData.ts) and
  `op.skillGroups` from CharGrowthTable plus ChangeSkillAction targets,
  which miss all four.
- **evidence:** `chr_0038_purrche_normal_skill` [49] CastSkill `loop_1`;
  loop_1 / loop_2 exclusiveFrame 361 and JumpToAction 360 on `block_end`;
  SkillPatchTable has `chr_0038_purrche_normal_skill_block_1` only, and no
  skill group lists any of them; scratch load: "chr_0038_purrche_normal_skill_loop_1:
  unknown skill" (kits.ts:448).
- **impact:** the engine frees her 50 frames after the cast, so a rotation
  can basic-attack while the shield is up (in the game she holds it 3 s,
  plus 3 s from the first block, plus 0.3–1.4 s of pauses). Ultimates,
  combos and the counter are unaffected (higher priority or allowed by the
  windows). The interim also has to end the shielded combo by `endAction`
  where the data returns to the loop.

### G2. Detached actions and hits launched after a jump

- **family:** timing (follow-up of S1).
- **feature:** a pending item that is `detached` only because it survives
  its cast being cut (a projectile or entity on its way) still moves with
  the cast's jumps when it is *launched* after the jump's frame. A hit or
  delayed trigger action gets a launch frame (`detached: {from: 221}`, or
  a `launch` frame; default for detached hits: their frame), and `skip()`
  (timeline.ts, the jump handler) shifts items whose launch frame is past
  the jump, detached or not. Items launched before (Laevatain's explosion
  at 22, whose dots come after her jumps at 30 / 37) stay put, as now.
- **evidence:** timeline.ts: a detached cast trigger's actions carry no
  cast (`!t.detached` at the cast tie) and `skip()` excludes detached
  pending hits and energy. Scratch: with `detached` Prezzie triggers (delay
  138, after the data's jump 67 → 135) the hits land 4.60 s after the cast
  instead of 2.33 s; the shielded combo's giftbox (jump 0 → 270, open at
  timeline 325) landed at 10.9 s instead of 1.8 s. Other skills with
  unconditional jumps whose reports should check: Wulfgard
  (`chr_0006_wolfgd_normal_skill` 117 → 247), Arclight (`chr_0007_ikut_normal_skill`
  95 → 204), Alesh (`chr_0024_deepfin_combo_skill` 64 → 120).
- **impact:** the ultimate's whole damage 2.3 s late, and the shielded
  combo's item 9 s late, unless the kit avoids `detached` (the ultimate can,
  its channel protects it) or writes real-frame delays (the combo's interim:
  delay 55 instead of timeline 265 / 325).

### G3. MarkCanInterrupt: where a skill becomes cancellable

- **family:** timing (skill timing, the action gate).
- **feature:** the loader reads a top-level `MarkCanInterrupt` frame into
  `SkillTiming`, and the action gate lets any action start from the
  earlier of it and `exclusiveFrame`. Interpretation from the data: in the
  other files that have one it sits on the exclusive frame (Purrchena's
  loops 361 = 361; Typhoeus's combo 60–241 with exclusiveFrame 60) or ends
  the recast window (Catcher's counter 129, window 95–129); Purrchena's
  combo has exclusiveFrame = durationFrame 330 (a placeholder-looking
  value) and MarkCanInterrupt at 28, two frames after its 26–75 window
  opens. In-game test B below settles it.
- **evidence:** `chr_0038_purrche_combo_skill` [28–28] MarkCanInterrupt,
  [206] InterruptCurSkillAction, exclusiveFrame 330. Files with
  MarkCanInterrupt: Wulfgard and Arclight battle skills, Snowshine's and
  Catcher's battle skills, Typhoeus's combo and floating attack 4,
  Purrchena's combo, battle skill and loops.
- **impact:** after every combo cast without the shield the engine holds
  her basic attacks for 6.9 s (checked in scratch: attack2 6.87 s after
  the combo) instead of about 0.9 s; the battle skill and counter can
  still start in the 26–75 window.

### G4. A weighted random choice

- **family:** triggers (extends K1).
- **feature:** a trigger action `{kind: "choose", options: [{weight:
  ValueExpr, do: [...]}, ...]}`: one option runs, picked on the battle's
  `chance` stream with probability weight / Σ weights (weights judged when
  the action runs; 0 excludes an option). Purrchena's combo: three options
  with weights `{if: {stack: combo_last, …}, then: 0, else: 1}` and a
  `combo_last` stack set by each option (the 40 s memory: the stack, or a
  40 s buff per type). The ultimate: per Prezzie `chance` (red), then
  `choose` bomb 1 / Handicraft `{if: ult_handicraft ≥ 1, then: 0, else:
  1}`. The owner question that comes with it: random outcomes are rolled
  even under `crit: expected`, so a search with one seed optimises one
  lucky or unlucky sequence; `--runs` gives the spread. An expected-value
  mode (each option's hits × its probability) would need fractional
  inflictions and stacks, so rolling with many seeds is probably the way.
- **evidence:** `chr_0038_purrche_combo_skill` frames 1 / 211 / 271
  (Probablity 0.3333 then 0.5, CompareFloat `comboType` = `comboType_last`
  → reroll 0.5), `buff_chr_0038_purrche_combo_lasttype` (40 s);
  `chr_0038_purrche_ultimate_skill` [0–3] and [138]. No other operator's
  skill timeline chooses between outcomes at random (Probablity elsewhere:
  Alesh's combo, visual only; the trigger chances K1 covers).
- **impact:** none on the numbers today: the composite is exact (checked:
  0.29 per Prezzie over 40 seeds; one Handicraft at most). It costs a kit
  of 57 triggers instead of about 15, and every new path multiplies it.
  Per combo the item is worth 3.6 (Bomb, P3) / 1.5 (Handicraft) / 0
  (Dessert) × ATK, so its spread is large.

### G5. Slow-downs on segments a cast never plays

- **family:** timing (slow-downs, follow-up of S1).
- **feature:** a cast's `slowdowns` follow its playhead as hits do: one
  that starts in a segment a jump skips, or after the action ended
  (InterruptCurSkillAction, a cancel), never starts; one that's running
  when the action ends stops then if it's `finishByAction`.
- **evidence:** `chr_0038_purrche_combo_skill` TimeDilationAction ComboSkill
  at 0–17, 210–225 and 270–282 (loader: slowdowns `0+20`, `210+18`,
  `270+15`); path A ends at 206. Scratch: one unshielded combo at 1.2 s,
  then an enemy attack listed at 31 s opens the combo window only between
  32.1 and 32.3 s: 1.1–1.3 s lost, as three slow-downs give (about 0.44 +
  0.40 + 0.33 s), not one.
- **impact:** each unshielded combo delays the world (enemy actions, buffs,
  teammates, inflictions) by about 0.7 s too much, so later timings in the
  fight drift. Any skill with jump-skipped or post-end global dilations has
  the same error.

### Compiler leftovers (D3, not new)

Per-hit element (the counter's Nature), poise units, ExecuteIntervalAction
ticks (the Handicraft's 4 pulls), Probablity branches (kit-draft emits all
alternatives of the combo and ultimate), jumps nested in IfElse (the combo's
0 → 210 / 270, the loops' 0 → 360) and the finisher's factor (1.0 here).

## Verification

No committed or pending fixture has Purrchena or Dessert Moment
(`grep -rl "chr_0038\|wpn_sword_0023" fixtures/`: none).

Logs that would verify the kit (ZMDLogs):

- Purrchena against an enemy that attacks, with battle skills that block:
  `chr_0038_purrche_normal_skill_counter` hits (4.0 × ATK Nature, the
  Nature infliction), the cast times of the counter and the next actions
  (G1's hold), the SP returned (`atb_return_1`, `atb_return_2`).
- Combos: the item per cast (`combo_skill_projhit_3` Bomb,
  `combo_skill_abilityrange_1_1(_potential_3)` Handicraft pulls and end,
  heals) settles the no-repeat rule (G4) and the pull count (row 18); the
  time to her next hit after an unshielded combo settles G3.
- Ultimates: `ult_skill_projhit` (Ambassador's Special, with
  `buff_chr_0038_purrche_ult_spell_vulnerable` / `vulnerable_spell_child`
  on later arts hits: layers, row 27), `ult_skill_normal_bomb_projhit`,
  `ultimate_skill_abilityrange_blackhole`; the hit time after the cast
  (2.3 s from data, G2).
- Dessert Moment: `buff_wpn_sword_0023_intensityup` / `_spelldmgup` on
  teammates' hits after her combo heals (who gets them: the giftbox's
  "nearby operators").

In-game tests (new; the owner doesn't use Purrchena, so all are low
priority, except B, whose answer also tells how MarkCanInterrupt works for
other operators). Test 53 (does a perfectly dodged hit count as attacked)
and 54 (can a dash cancel a skill) already cover her listener and her
dash; nothing in them changes.

- **A. Does the shield hold her?** (ready, if you have Purrchena) On a dummy
  that doesn't attack, cast the battle skill and keep pressing basic
  attack. Does her first swing come while the shield and the Protection
  icon are still up (the engine today: about 1.7 s after the cast), or only
  when the shield drops (the data: about 3 s)? With an attacking enemy,
  after the first block the shield should stay about 3 s more.
- **B. How soon can she act after an unshielded combo?** (ready, if you
  have Purrchena) Let an enemy hit you (any operator controlled) to light
  the combo, cast it with no shield up, and press basic attack at once
  (Purrchena controlled). Does she swing within about 1 s (MarkCanInterrupt
  at frame 28) or only about 7 s later (the engine: the skill's end at
  206)?
- **C. Does the Giftbox ever repeat an item?** (ready, if you have
  Purrchena; tedious) Cast the combo six times, each within 40 s of the
  last, and note the item each time (an explosion, a pulling vortex, or a
  dessert). The data never repeats the previous item; independent thirds
  would repeat at least once in five pairs 87% of the time.
- **D. At most one Handicraft per ultimate?** (ready, if you have
  Purrchena at P0; tedious) Over ten ultimates, count the vortexes each
  time. The data allows one at most; independent 50/50 Prezzies would
  give two or more in half of the ultimates without an Ambassador's
  Special.

Not testable by hand: the Ambassador's Special chance (30% at P1+, plus 10%
per talent layer), the Protection values (row 10), projectile travel
(row 33).

## Kit plan

Written in a scratch copy of the repository at commit 7c7d00e
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0038_purrche/repo`;
copies of the drafts next to it as `kit-draft-chr_0038_purrche.json` and
`kit-draft-wpn_sword_0023.json`, generated by `gen.py` there). Both load
with the real loader: `efsim calc` lists every skill hit, `efsim simulate`
runs the test scenarios (`purr7`, `purr10`, `purr14` in the scratch folder), and the data
package's tests pass (`vitest run packages/data`: 273 of 273).

### Operator kit (today)

- **Stacks:** `blocked` (max 1: `block_counter` ≥ 2), `sorry_came_late`
  (max 3: `ult_add_red`), `combo_last` (0–3: the last item), markers
  `combo_roll`, `prezzie_1..3`, `ult_handicraft`.
- **Buffs:** `shield_up` (self, `display_time_1`, gameBuff `aura_block`, no
  modifiers), `protection` (team, `{attr: 63, value: dmg_taken_down_1}`,
  gameBuff `block_instance`), `counter_ready` (self, 10 s, gameBuff
  `block_change_skill`), `arts_susceptibility` (enemy, `duration_vul`,
  `maxStacks` 3, four arts elements, `rate_vul`).
- **Skills:** attack1–3, power_attack, plunging_attack_end as kit-draft
  (plus attack3's `poise`, `poiseControlledOnly`); normal_skill with
  `hits: []` and `available: {not: {buffActive: counter_ready}}`;
  normal_skill_counter with `available: {buffActive: counter_ready}` and
  the headbutt (f9, `element: natural`, `poise`, Nature infliction);
  combo_skill and ultimate_skill with `hits: []` (all their damage comes
  from triggers).
- **Battle-skill triggers:**

```json
{ "id": "battle_cast", "on": { "event": "cast", "skills": ["chr_0038_purrche_normal_skill"] }, "by": "self", "skill": "chr_0038_purrche_normal_skill",
  "do": [{ "kind": "sp", "value": "atb_return_1" }, { "kind": "gain", "gains": [{ "stack": "blocked", "amount": -1 }] },
         { "kind": "buff", "buff": "shield_up" }, { "kind": "buff", "buff": "protection" }, { "kind": "buff", "buff": "counter_ready" }] },
{ "id": "block_first", "on": { "event": "attacked" }, "by": "self",
  "if": { "all": [{ "buffActive": "shield_up" }, { "stack": "blocked", "below": 1 }] },
  "do": [{ "kind": "buff", "buff": "shield_up" }, { "kind": "extendBuff", "buff": "shield_up", "seconds": { "div": [9, 30] } },
         { "kind": "buff", "buff": "protection" }, { "kind": "extendBuff", "buff": "protection", "seconds": { "div": [9, 30] } },
         { "kind": "gain", "gains": [{ "stack": "blocked", "amount": 1 }] },
         { "kind": "sp", "value": { "key": "atb_return_2", "skill": "chr_0038_purrche_normal_skill" } },
         { "kind": "energy", "value": { "key": "talent_1_usp", "skill": "chr_0038_purrche_normal_skill" }, "if": { "talentAtLeast": [0, 1] } },
         { "kind": "gain", "gains": [{ "stack": "sorry_came_late", "amount": 1, "if": { "talentAtLeast": [0, 1] } }] }] },
{ "id": "block_later", "on": { "event": "attacked" }, "by": "self",
  "if": { "all": [{ "buffActive": "shield_up" }, { "stack": "blocked", "atLeast": 1 }] },
  "do": [{ "kind": "extendBuff", "buff": "shield_up", "seconds": { "div": [11, 30] } }, { "kind": "extendBuff", "buff": "protection", "seconds": { "div": [11, 30] } }] }
```

  plus `counter_cast` (ends `counter_ready`, `shield_up`, `protection`),
  `shield_end` (`buffEnded shield_up` → end `protection`), `shield_cut`
  (cast of a basic attack or ultimate → end both), `shield_dash`
  (`perfectDodge` → end both), `counter_paused_by_ult` (ultimate cast, if
  `counter_ready` → `extendBuff` 78/30 s).
- **Combo triggers:** `combo_window` (`attacked`, `by: controlled` →
  `openCombo`); for the shielded paths `combo_shielded` /
  `combo_shielded_blocked` (cast, `if` shield and `blocked` below / at
  least 1 → `jump` from 0 until 1 to 210 / 270, `extendBuff` 41 / 40
  frames) and `…_end` (delay 250 / 309 → `endAction`, G1's interim); per
  path (`unshielded` delay 61; `shielded` and `shielded_blocked` delay 55
  in real frames, G2's interim) a detached `giftbox_*` trigger (team heal
  with `healKind: combo`, `energy: usp`) and the item choice: for each
  previous item (`combo_last` 0–3) a chain of `chance` triggers over the
  allowed items (1/3 then 1/2, or 1/2 then the rest), each acting only
  while `combo_roll` is 0 and setting `combo_last` to its item, e.g.

```json
{ "id": "giftbox_unshielded_after2_item1", "on": { "event": "cast", "skills": ["chr_0038_purrche_combo_skill"] }, "by": "self",
  "if": { "all": [{ "not": { "buffActive": "shield_up" } }, { "stack": "combo_last", "atLeast": 2 }, { "stack": "combo_last", "below": 3 }] },
  "chance": { "div": [1, 2] }, "delay": 62, "detached": true, "skill": "chr_0038_purrche_combo_skill",
  "do": [{ "kind": "hits", "if": { "stack": "combo_roll", "below": 1 }, "hits": [
           { "id": "handicraft_pull", "scale": ["atk_scale_blackhole_dot"], "count": 4, "frames": [1, 16, 31, 46], "damageType": "combo", "events": ["chr_0038_purrche_combo_skill_abilityrange_1_1"] },
           { "id": "handicraft_end", "scale": ["atk_scale_blackhole_end"], "frames": [57], "damageType": "combo", "events": ["chr_0038_purrche_combo_skill_abilityrange_1_1"] }] },
         { "kind": "gain", "gains": [{ "stack": "combo_last", "amount": { "sum": [1, { "product": [-1, { "stackCount": "combo_last" }] }] }, "if": { "stack": "combo_roll", "below": 1 } }] },
         { "kind": "gain", "gains": [{ "stack": "combo_roll", "amount": 1 }] }] }
```

  and a reset of `combo_roll` one frame later. The Bomb is the same with
  `atk_scale_boom` and `poise`; the Dessert is a `heal` (team, combo). The
  40 s memory isn't written (the stack keeps the last item for the fight;
  cooldown 22 s makes the difference rare). At P3 the Handicraft's event key
  is `…_abilityrange_1_1_potential_3` (a second hit pair with
  `if: potentialAtLeast 3`; not in the scratch draft).
- **Ultimate triggers:** per Prezzie n, three triggers on the ultimate's
  cast with delay 138 (not detached, G2): `prezzie_n_ambassador` (`chance:
  {sum: [prob, {product: [talent1_prob_up, {stackCount: sorry_came_late}]}]}`
  → marker, Ambassador's hit with `buffs: [{buff: arts_susceptibility,
  beforeDamage: true}]`), `prezzie_n_bomb` (`chance: normal_boom_prob` →
  Bomb if not resolved), `prezzie_n_rest` (Handicraft if not resolved and
  none yet, else Bomb); then `ult_reset` (markers) at 139 and
  `ult_consume` at the cast (`sorry_came_late` −3).

Scratch results (P5, Dessert Moment 9/9/9, no gear; ATK 2,178; Rhodagn
Lv90, crit expected): headbutt 4,466 (×1.3 with the combo's Link, ×1.098
after a combo heal: Dessert Moment's Nature DMG); Ambassador's Special
8,039, Prezzie Bomb 3,350, Handicraft pull 279 and end 558. A block at
1.0 s returns its 20 SP (146 SP at 2.3 s, as 120 + regen + 20). The
Prezzies land 2.33 s after the cast.

### Waiting on gaps

- **G1:** the loops and blocks as `followUpOnly` kit skills: cast triggers
  (normal_skill delay 49 → loop_1; block_1 delay 23 and block_2 delay 22 →
  loop_2), the block triggers casting block_1 / block_2 instead of acting
  directly, and the shield's end as

```json
{ "id": "shield_end", "on": { "event": "buffEnded", "buff": "shield_up" }, "by": "self",
  "do": [{ "kind": "jump", "skill": "chr_0038_purrche_normal_skill_loop_1", "from": 0, "until": 360, "to": 360 },
         { "kind": "jump", "skill": "chr_0038_purrche_normal_skill_loop_2", "from": 0, "until": 360, "to": 360 },
         { "kind": "endBuff", "buff": "protection" }] }
```

  (and on a loop's cast without the shield, a jump from 0 until 2 to 360);
  the shielded combo then casts loop_1 / loop_2 at 250 / 309 instead of
  `endAction`.
- **G2:** the giftbox triggers in timeline frames (61 / 265 / 325) with a
  launch frame (17 / 221 / 281), and the Prezzies `detached` again.
- **G3:** nothing in the kit; the loader's MarkCanInterrupt.
- **G4:** the item choice as one `choose` per path (three options, weights
  from `combo_last`), the Prezzies as `chance` + `choose`.
- **G5:** nothing in the kit.

### Equipment kit

- **wpn_sword_0023** (Dessert Moment): two team buffs
  `wpn_sword_0023.intensity` (`{attr: 87, value: phy_spell_up}`, gameBuff
  `buff_wpn_sword_0023_intensityup`, `duration`) and
  `wpn_sword_0023.arts_dmg` (attrs 51–54 `spell_dmg_up`, gameBuff
  `buff_wpn_sword_0023_spelldmgup`, `duration`); trigger `on: {event: heal,
  kinds: [combo]}, by: self, skill: sk_wpn_sword_0023` → both buffs `to:
  eventSubject`. Loads and runs (checked on the counter's Nature hit). It
  works on any wielder whose kit declares combo-kind heals (hit `heals` or
  a trigger `heal` with `healKind: combo`), e.g. Liino's combo; B9's
  cross-wielder stacking stays open.

## Kit (2026-10-20)

Written against the engine after batch 3's shared features (S1–S4, D1,
D3, T4, B2). Files: `packages/data/kits/operators/chr_0038_purrche.json`,
`packages/data/kits/equipment/wpn_sword_0023.json`, the example
`examples/purrchena-shield.scenario.json` (build `purrchena-p5.json`) and
`tests/kit-purrchena.test.ts`; Purrchena is in skillCompile.test.ts's
OPERATORS with no KNOWN entry (her combo's and ultimate's landings are all
on branches, which the test doesn't report; everything else agrees).

### Re-analysis

| Gap / row | Now | How |
|---|---|---|
| G1 helper skills (row 7) | **done** (S4) | `normal_skill_loop_1/_2`, `_block_1/_2` are `followUpOnly` kit skills (no hits), cast by delayed cast-trigger `cast` actions at the data's frames: normal_skill 49 → loop_1, block_1 23 / block_2 22 → loop_2, shielded combo 250 → loop_1 / 309 → loop_2. The loops' IfElse at 0 is `jumps: [{at: 0, if: {not: shield_up}}]` (D1); the shield's end jumps them to 360 (trigger `shield_end`), exclusive 361. Not attacked she's free 91 frames after the cast (the data: 3 s), 130 after a block at 1 s. Blocks: `attacked` → `cast` block_1 (no block yet) / block_2; block_1's own effects (SP, energy, layer, the shield set to 3 s) are its cast trigger. **Local engine fix** (below) |
| G2 detached after a jump (rows 20, 29) | **done** (S2) | the giftbox triggers in skill frames with `launch` 17 / 221 / 281 (open at 61 / 265 / 325: real 61 / 55 / 55), the Prezzies `detached` with `launch: 138` (real 70 after the cast). The real-frame interim is gone |
| G3 MarkCanInterrupt (row 21) | **done** (S1) | from the loader: attack1 28 frames after an unshielded combo (test); on the shielded paths the jump skips frame 28 |
| G4 weighted choice (rows 15, 26) | **done** (T4) | the item is one `choose` per path (weights `{if: combo_last = n, then: 0, else: 1}`, the chosen option sets `combo_last`); the Prezzies: `ult_rolls` at the cast (three `choose` red / not, judged before the layers are used up), `ult_prezzies` at 138 (per slot: the Ambassador's Special if slot ≤ `ult_red`, else `choose` Bomb `normal_boom_prob` / the rest: Handicraft if none yet, else Bomb). 26 triggers instead of 57 |
| G5 slow-downs off the path (row 22) | **mostly done** (S3 + the combo's `jumps`); **open residue** | unshielded: only the frame-0 slow-down plays (13.2 world frames lost). Shielded: S3 keeps a slow-down that starts at the jump's own frame (0), and can't see the combo end at 250 by its CastSkill (a trigger `cast`, not in `timing.ends`), so after a block (270) the world loses 13 frames (data 9.9: the 15-frame one only) and before one (210) 23 (data 11.8: the 18-frame one only). See "Open" |
| Row 8/9 blocks, pauses | interim (as planned) | the aura's PauseBuffTime as `extendBuff` by the pause_block lengths (9, 11; the combo's 41 / 40 minus what the engine already holds, see "Open"); the first block re-applies the shield (SetBuffDuration 3.0) |
| Row 11 the change, paused by the ultimate | interim | `counter_ready` (10 s, buff default) + `extendBuff` 9 frames at the ultimate (78 real frames paused, of which the engine's time stop already holds 69) |
| Row 20 the shielded combo's listener | done | stack `combo_unguarded` from the cast to frame 221 / 281: no block before (in practice the slow-down keeps the enemy from attacking then) |
| Rows 10, 31, 33, 35 | open as before | Protection step-down (data disagrees with itself), talent 2 (N2, deferred), projectile travel (test 47), which hits a block counts (all assumed). None changes damage |
| E3 (B9) | **done** (B2) | both Dessert Moment buffs are stack groups from their game buffs (stackingType 11, priority key, maxStackCnt 1) |
| Row 34 dash; batch-3 E3 dodge policy | **open** (shared) | E3's policy only sees `attacked` triggers with a `jump` of the current skill: Purrchena's blocks are `cast` actions, so with `--dodge` she dashes at every attack while shielded (ending the shield) instead of blocking |

**Local engine fix** (timeline.ts `earliestStart`, one condition): a kit
whose triggers have a `cast` action now counts as one whose current action
may end sooner, as `endAction` already did. Without it a step judged while
block_1 was current started at block_1's exclusive frame (55), right
through its loop_2 cast at 53 (the block test's attack1 at 55 instead of
130). Typhoeus and Liino also have `cast` actions: every example total and
every `zmdlogs check` / `reactions` output is unchanged.

### What the kit models

- Basic attacks, finisher, dive and counter as kit-draft compiles them
  (factors, Final Strike's controlled-only stagger and SP, the counter's
  Nature element, infliction and poise).
- The shield: `shield_up` (self, `display_time_1`), `protection` (team,
  attribute 63: a Protection-category buff), `counter_ready` (the battle
  slot shows the counter for 10 s: `available` on both skills); the
  battle skill's 20 returned SP (`atb_return_1`), the first block's 20
  (`atb_return_2`), talent 1's energy (`talent_1_usp`, block_1's key) and
  its layer (`sorry_came_late`, max 3); the shield ends with the counter,
  a basic attack, an ultimate or a dash.
- The combo: window on an attack on the controlled operator; the three
  paths by the combo's `jumps` (shield up and `blocked` below / at least
  1); the giftbox's team heal (combo heal tag), `usp` and item: Handicraft
  (4 pulls `atk_scale_blackhole_dot` 0.5 s apart from the item's frame,
  the end `atk_scale_blackhole_end` at +56; at P3 under the
  `…_abilityrange_1_1_potential_3` key), Bomb (`atk_scale_boom`, P3 ×1.2,
  poise) or Yummy Dessert (a team heal with the combo tag), never the last
  one (combo_lasttype is lifeType 1: kept until replaced, so the stack
  `combo_last` keeps it for the fight).
- The ultimate: three Prezzies 70 frames after the cast; the Ambassador's
  Special chance `prob` (P1 ×1.5) + layers × `talent1_prob_up`; its Arts
  Susceptibility (`rate_vul`, P5 ×1.2; max 3 layers, each 5 s) before its
  own damage; at most one Handicraft.
- Dessert Moment: Arts Intensity +14 and Arts DMG +9.8% for 20 s on
  whoever a combo heal of the wielder heals.

Left out: damage taken and heal amounts, swaps ending the shield, the
grab branch, the blocks' first 2–3 frames without a listener, block_1 /
block_2 casting the loop early when the shield ended during them (it's
paused then), a block cutting the combo's pause short, projectile travel.

### Verification

No fixture has Purrchena or Dessert Moment, so nothing to check against
logs. `efsim calc` (P5, Dessert Moment 90 / 9, no gear; ATK 2,178 vs
Rhodagn Lv90, expected crits): headbutt 4,466 (×1.3 with the combo's Link,
×1.098 with Dessert Moment: 6,375 in the example), Ambassador's Special
8,039, Prezzie Bomb 3,350, giftbox Bomb 4,020, Handicraft 279 per pull and
558 at the end: the analysis's scratch numbers. The example (seed 1):
40,342 in 30.9 s; blocks at 1.0 / 2.0 / 4.4 / 5.4 s (the later two on the
enemy's clock, delayed by the combo's slow-down), the counter from the
loop at 6.0 s, the Prezzies at +2.33 s, the second battle skill holding her
3.0 s before attack1, attack1 0.93 s after the unshielded combo. Rolls
(scratch, 300 ultimates per setting): Ambassador's Special 0.316 per
Prezzie at P5 (0.3), 0.212 at P0 (0.2), 0.613 at P5 with three layers
(100 ultimates; 0.6); never two Handicrafts in one ultimate. The test's
80 combos (20 seeds × 4) never repeat an item.

### Open (shared; not fixed here)

- **S3 residue** (timing): `plannedSlowdowns` keeps a slow-down starting
  exactly at a jump's frame (the combo's frame-0 one on both shielded
  paths, where the data's IfElse at 0 leaves it at once), and can't drop
  one after an end that a kit's `cast` makes (the 270 slow-down on the 210
  path, after the CastSkill at 250). About 3 / 11 world frames too many per
  shielded combo.
- **The caster's own buffs under her own slow-downs**: the engine holds
  every buff for what a slow-down costs the world, the caster's too. The
  data pauses Purrchena's aura during the shielded combo (pause_block) and
  her skill change during her ultimate (pause_change_skill_buff), which
  suggests (doesn't prove) her own buffs aren't held. The kit's pauses are
  written as the data's length minus what the engine holds (41 − 23,
  40 − 13, 78 − 69), so the totals are the data's either way; the tests
  pin them, so a change in either engine rule shows.
- **Random outcomes miss `choose`**: `randomOutcomes` (search.ts) lists
  rolled crits, dodges and trigger `chance`, not `choose` actions, so
  `simulate` prints no "one battle of a distribution" note for her and
  `search` ranks candidates over one seed.
- **Dodge policy** (E3): see row 34 above.

### In-game tests the kit depends on

76 (hers: A the shield's hold, C the item never repeating, D one
Handicraft per ultimate), 61 (MarkCanInterrupt; her combo's frame 28 is
one of its alternatives), 53 and 54 (whether a dodged hit counts as
attacked, and dashes), 47 (projectile travel: the giftbox, Dessert and
Prezzies land at their launch + entity frames).
