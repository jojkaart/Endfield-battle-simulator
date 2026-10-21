# Tangtang (chr_0027_tangtang): gap report, batch 4

Operator Tangtang (Cryo; CharacterTable `charTypeId` Cryst, `profession`
5, `mainAttrType` 40 Agility, `subAttrType` 39 Strength, `weaponType` 6
Handcannon, rarity 6, `dontInterruptCombo` true). Equipment covered here
([batch-4.md](../batch-4.md)): `wpn_pistol_0009` Clannibal,
`wpn_pistol_0010` Artzy Tyrannical, `wpn_pistol_0011` Brigand's Calling.

Sources: rmxlinux TableCfg CharacterTable, CharGrowthTable,
CharacterPotentialTable, PotentialTalentEffectTable, SkillPatchTable,
WeaponBasicTable, I18nTextTable_EN; Json/SkillData `chr_0027_tangtang_*`
(30 files), `sk_wpn_pistol_0009/0010/0011`; Json/BuffData
`buff_chr_0027_tangtang_*` (37 files), `buff_wpn_pistol_0009*`,
`_0010_valid`, `_0011_valid*`. Values at skill level 12 / weapon skill
level 9 unless stated. `efsim kit-draft chr_0027_tangtang` was run on the
main checkout; the draft kits of the last section were loaded, tested and
checked against the log from a scratch copy.

Log: `fixtures/zmdlogs-b7b3762d5da8.json` (Arcane, Last Rite, Tangtang,
Si): Tangtang at P5, skills 11 / 12 / 12 / 12, Brigand's Calling (weapon
skill 3 at level 5), MI Security hand + 3 Bonekrusha. With the draft kits
**all 46 of her logged hits match** (Verification).

Claims re-checked: the brief's "45 logged hits" is 45 hits of her own
events plus her Cryo burst at 15374 ms (`buff_common_cryst_cryst_triggered`,
already matched by the engine without a kit): 46. Nothing else was taken
from earlier reports.

## Data overview

Relevant actions per file (visual, audio, camera, rotation, root motion,
super armour and targeting left out):

| File | Relevant actions |
|---|---|
| `attack1` | LaunchProjectile at 3 → `attack1_projhit` (DamageAction mask 128, `atk_scale`) |
| `attack2` | projectiles at 6 (`attack2_projhit`, `atk_scale_1`) and 10 (`attack2_02_projhit`, `atk_scale_2`, ObtainCostAction `atb` × 0.5 if controlled: `atb` is 0 at every level) |
| `attack3` | ChannelingAction 5–13 every 0.06 s (5 hits, `atk_scale_1`), 4 projectiles at 17–18 (`attack3_projhit`, `atk_scale_2`) |
| `attack4` | DamageActions at 6, 10 (`atk_scale_1`), 23 (`atk_scale_2`) |
| `attack5` (Final Strike) | projectile at 22 → `attack5_projhit`: DamageAction mask 2097280 `atk_scale`; if controlled a poise-only DamageAction (`poise` 18) and ObtainCostAction `atb` 18 once per projectile (`EntityBB_atk05_cnt`) |
| `power_attack` (finisher) | DamageActions at 9 and 21, BreakingAttackCalculation 0.3 / 0.7 of `atk_scale` 9.0 |
| `plunging_attack_end` (dive) | TickIntervalAction 0.07 s over frames 3–11 (4 ticks), `atk_scale` 0.45; mask 1152 |
| `normal_skill` (battle, 100 SP) | 11: finds the Whirlpools (spawned entities, tag 45117620) within 50 m, each `water_cnt` += 1 and `buff_…_water_wake` on it; ObtainCostAction costType 1 `atb_return` × 1 (if `water_cnt` = 1) or × 2 (if = 2), atbGainMethod 1 (returned); spawns the mover `normal_skill_abilityentitymove`. 27–39: ChannelingAction, one target every 0.075 s, at most 5: DamageAction `atk_scale_1` + `poise1`, DoOnce `buff_common_obtain_ultimate_sp`. Exclusive 50, duration 136; window 31–93 for itself |
| `normal_skill_abilityentitymove` | frame 12: `water_cnt` 0 → one entity `normal_skill_water_projhit`; 1 → two `_projhit_1`; ≥ 2 → three `_projhit_2` (cast frame 23) |
| `normal_skill_water_projhit` / `_1` / `_2` (Waterspouts) | ChannelingAction 0.26 s over 90 frames (12 ticks): if the target's `buff_…_comboskill_spelllnfliction` < 1 for this cast (`limitSkillCastId`) SpellInfliction Cryo + that marker; `_1` / `_2`: if `buff_…_normalskill_spellvulnerable` < 1 for this cast, CreateBuff it with `rate_spellvulnerable` / `rate_spellvulnerable_02`; DamageAction mask 4352 `tornado_atk_scale01`; if `talent2_ultskill` ≥ 1 the damage unit adds DamageScaleProcessor NormalCalcZone `dmg_up_water_ult` |
| `passive_0` (in the battle-skill group) + `buff_…_passive_0` | sets `EntityBB_abilityentity_water01` = `normalskill_atk_scale01` (0.25), `EntityBB_abilityentity_rate_spellvulnerable(_02)`, `_duration_spellvulnerable`; the battle skill and ultimate copy them into `tornado_atk_scale01` etc. |
| `combo_skill` | 26: DamageAction mask 12288 `atk_scale`, a poise-only DamageAction `poise` 10, ObtainCostAction costType 0 `usp` once (`tar_cnt`); once per cast, if the jet hit an enemy, LaunchProjectile `projectile_chr_0027_tangtang_water` (on reach / finish / block → `combo_skill_water_gene`); TimeDilation ComboSkill 0.867 s; exclusive 41, duration 200; window 31–93 to the battle skill |
| `combo_skill_water_gene` | SpawnAbilityEntity the Whirlpool (`combo_skill_water`), CreateBuff `buff_…_water` on Tangtang (`duration_water` 30), timed markers 01 / 02 / 03 for its side |
| `combo_skill_water` (Whirlpool, 900 frames) | AuraAction (5 m, if `talent1_speed` ≥ 1) giving allies `buff_…_comboskill_waterbuff` (SpeedupAction `ratio_speed`) and enemies `_waterdebuff` (SlowAction `ratio_speedreduction`), on exit the `_outaura` buffs (3 s); JumpTo 1500 on `water_wake` (projectile `waterwake01` to Tangtang, `normal_skill_water_projhit_damage`, FinishBuff 1 layer of `buff_…_water`); JumpTo 1515 on `water_ultskillwake` (projectile to the stare); frame 900 FinishBuff 1 layer |
| `ultimate_skill` (cost 90) | UltimateTimeAction 0–82, cantCastSkill / cantSwitchPosition channel 0–82, damage immunity 0–84; 76: copies the passive's EntityBB values (`rate_spellvulnerable` += them), if `talent2` ≥ 1 `talent2_ultskill` = 1, SpawnAbilityEntity `ultimate_skill_1`; exclusive 84, duration 202, cooldown 20 s |
| `ultimate_skill_1` (OLDEN STARE, 210 frames) | 0–120: ChannelingAction, one target every 0.5 s, at most 8: DamageAction mask 4608 `atk_scale_1`; AuraAction 8 m: `buff_…_ultskill_debuff` on enemies, `_ultskill_buff` on allies; 120: DamageAction `atk_scale_2` + `poise2`; 127 FinishOwner. EventListener 0–119: when a hitter has `buff_…_ultskill_buff_damage` (a controlled operator's dive attack, mask 1024, on an enemy in the stare) JumpTo 128: CreateBuff `buff_…_ultskill_waterwake` (if `talent2`), 133 DamageAction `atk_scale_3` + `poise3`, 156 FinishOwner |
| `buff_…_ultskill_debuff` | applyTags −1065936627 (Immobilization); unless the target has tag 188749032 (control-immune), TimeDilationAction layer 1 with an empty curve (scale 0), `finishByAction` |
| `buff_…_ultskill_waterwake` | wakes the Whirlpools (→ 1515) and spawns `ult_skill_abilityentitymove`, which at its frame 18 spawns 1 + n Waterspouts (n: Whirlpools found, `water_cnt` ≥ 2 → three) with `talent2_ultskill` 1 |

Unreferenced or inert: `normal_skill_projhit`, `attack4_projhit` (named
by no file); `normal_skill_water_projhit_damage` (the woken Whirlpool's
projectile: its `tornado_atk_scale01` is 0 in the Whirlpool's blackboard
and its infliction needs 5 layers of `buff_…_comboskill_hit`, which
nothing creates; not in the log although a Whirlpool was woken at about
10.5 s); `buff_…_ultskill_spellvulnerable`, `_crystal_vulnerable`,
`_natural_vulnerable`, `_potential5_crystdamagelncrease`,
`_potential_5_effect`, `_water_call`, `_water_iceballstack`,
`_comboskill_hitspelllnfliction`, `_chrdg_*`, `_traindung_water_gene`.

Text (CharGrowthTable + I18nTextTable_EN, values at level 12):
- Basic "I'LL BLOW YOUR MIND!": 5 sequences, Cryo; Final Strike `{poise}`
  Stagger as the controlled operator; dive and finisher.
- Battle "IMA WAVERIDAAH!": a point-blank shot (180%, Stagger 10) and a
  Waterspout; "consumes all nearby Whirlpools to create additional
  Waterspouts and return some SP based on the number of Waterspouts
  created" (20 per Whirlpool). "Waterspout: Applies 1 stack of Cryo
  Infliction … and deals Cryo DMG over time (300%, 3 s). If the battle
  skill creates multiple Waterspouts, they also apply Arts Susceptibility
  (5% for 2, 10% for 3, 15 s) (but not another stack of Cryo Infliction).
  DMG dealt by the Waterspout is treated as Battle Skill DMG."
- Combo "RIVER, TO ME!": "COMBO TRIGGER: When applying Cryo Infliction or
  dealing Arts Burst DMG to an enemy." 240%, Stagger 10, a Whirlpool (30 s),
  energy 10; "Up to 2 Whirlpools can exist in the battlefield at any time."
- Ultimate "DA CHIEF SEES YOU!": OLDEN STARE "applies temporary
  Immobilization and deals Cryo DMG over time" (320% over 4 s); then a
  rogue wave (400%, Stagger 15); "If the controlled operator performs a
  dive attack in the OLDEN STARE pattern, its evolution ends and the rogue
  wave is summoned immediately" (700%, Stagger 20).
- Talent 1 "Fam of Honor": allies within 5 m of a Whirlpool gain 10% / 20%
  Haste, enemies suffer 20% / 40% Slow, 3 s after leaving.
- Talent 2 "Riot Bringer": during OLDEN STARE a controlled operator's dive
  ends it early and creates a Waterspout, converting nearby Whirlpools
  into more; those Waterspouts act as the battle skill's and gain DMG
  Dealt +40% / +60%.
- P1 "Reserve Hoard": combo ×1.2, cooldown −2 s; +5 SP per Whirlpool.
  P2: Agility +20, Cryo DMG +10%. P3: battle skill ×1.1 (`atk_scale_1`
  and the passive's `normalskill_atk_scale01`), Susceptibility +5% (battle
  skill and ultimate). P4: ultimate cost ×0.85. P5: ultimate ×1.15 (all
  three scales); talent 2's Waterspouts `dmg_up_water_ult` +0.8.

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Attack 1: projectile at 3, `atk_scale` | supported (data) | one hit, `launch: 3` |
| 2 | Attack 2: projectiles at 6 and 10; SP `atb` × 0.5 = 0 | supported (data) | two hits |
| 3 | Attack 3: 5 channel hits 5–12, 4 projectile hits 17–18 | supported (data) | two hits (counts 5 and 4) |
| 4 | Attack 4: hits at 6, 10 (`atk_scale_1`), 23 (`atk_scale_2`) | supported (data) | two hits |
| 5 | Attack 5: Final Strike at 22, `poise` 18 controlled only, `atb` 18 if controlled | supported; **data** | `finalStrike`, `sp: {if: controlled, then: atb}`, `poise`, `poiseControlledOnly`; the draft drops the poise-only DamageAction (G3a) |
| 6 | Finisher: 9 / 21, factors 0.3 / 0.7 | supported (data) | two hits with `factor` (draft right) |
| 7 | Dive attack: 4 ticks × 0.45 (display 180%) | supported (damage); **data** | not castable (S10); the draft gives 5 ticks (G3b) |
| 8 | Battle-skill shot: 5 hits 27–36, `poise1` 2 each, team energy at 27 | supported (data) | one hit `count: 5`, `teamEnergy: [{frame: 27, ratio: 1}]` |
| 9 | Waterspouts: 1 + Whirlpools at the cast (at most 3), each its own event key | supported; **data** | hits with `count` ValueExprs on `{buffLayers: whirlpool}` (V3), judged at the cast before the frame-11 consumption; the draft lands all three variants always (G3c, D4's open "spawned entities as a stack") |
| 10 | Waterspout ticks: 12 per spout every 0.26 s from cast frame 23, `normalskill_atk_scale01` of `passive_0` (0.25, 3.0 per spout) | supported; **data** | `scale: []`, `scaleValue: {key: normalskill_atk_scale01, skill: chr_0027_tangtang_passive_0}`, `launch: 11` (the mover); P3's ×1.1 reaches it (`efsim calc`: 0.275). The draft can't follow the passive buff's EntityBB key (G3d) |
| 11 | Waterspouts apply one Cryo Infliction per cast and target (first tick) | supported; **data**; **gap** (log tooling) | a first-tick hit with `applies` and a rest hit per variant; exact in the engine. The draft puts 1–3 inflictions on every landing (G3e); `zmdlogs reactions` can't tell the first tick from the rest (G4) |
| 12 | 2 / 3 Waterspouts: Arts Susceptibility `rate_spellvulnerable` / `_02` (5% / 10%, +5% at P3), 15 s, once per cast; one instance kept (stackingType 1, priority rate, `cntmax` 1) | supported; **gap** (loader) | two enemy buffs (zone susceptibility, four Arts elements); the loader refuses the game buff (G2), so the kit keeps them exclusive by hand (exact under B1's reading) |
| 13 | SP returned: `atb_return` × Whirlpools (20, 25 at P1), atbGainMethod 1 | supported | cast trigger at 11: `sp: {product: [atb_return, {buffLayers: whirlpool}]}`, `spKind: returned` |
| 14 | Waterspout damage is Battle Skill DMG (mask 4352) | supported | the battle skill's hits |
| 15 | The battle skill consumes every Whirlpool within 50 m at 11 | supported | `endBuff whirlpool` in the same trigger (one enemy: always in range) |
| 16 | Combo trigger: Cryo Infliction applied or an Arts Burst, by anyone | supported | two `openCombo` triggers (`inflictionApplied` cryst, `burst`), `by: anyone`. The log: her combo at 5137 ms with no earlier action of hers, after Si's Cryo hits (a teammate opens it). Reaction-forming inflictions: test 35's question |
| 17 | Combo hit at 26: `atk_scale` (2.4, ×1.2 at P1), `poise` 10, `usp` 10 once | supported; **data** | `energy: usp`, `poise: poise` (the draft drops the poise-only DamageAction: G3a) |
| 18 | The combo makes a Whirlpool when its projectile arrives (30 s; a layer of `buff_…_water`) | supported | self buff `whirlpool` (`maxStacks: 2`, duration `duration_water`) by a detached cast trigger at 26 (`launch: 26`); travel time is Ti2 |
| 19 | At most 2 Whirlpools ("Up to 2 … at any time"): the buff caps at 2 layers, but the gene spawns a third entity (marker 03) and the battle skill's SP IfElse has no branch for `water_cnt` 3 | unknown | U1. Kit: the third replaces the oldest (stackingType 2 at its cap) |
| 20 | Combo cooldown 12 s (−2 at P1), ComboSkill slow-down 0.867 s, windows | supported (data) | SkillPatchTable, SkillData, potentials (loader) |
| 21 | OLDEN STARE: entity at 76, 8 ticks every 0.5 s of `atk_scale_1` (0.4; 0.46 at P5) | supported (data) | one hit `count: 8`, `launch: 76` |
| 22 | Immobilization for the stare's 4 s: the enemy's clock stops (not on control-immune enemies) | supported; **data** | cast trigger at 76: `control immobilization`, `durationKey: display_duration`, `freezes: true` (Si's precedent; scenario `controlImmune`). The draft only lists the aura buff (G3f). U3 / test 37 |
| 23 | Rogue wave at entity frame 120: `atk_scale_2` 4.0, `poise2` 15 | supported | hit at 196 |
| 24 | A controlled operator's dive attack in the stare ends it: DoT stops, early wave `atk_scale_3` 7.0 (×1.15 P5), `poise3` 20, 5 frames after the dive | **gap** (G1) | S10 + a dive filter on hit triggers. Interim: `early_rogue_wave` behind the state `olden_stare_dive`, which nothing applies (never in a simulation; tried by `zmdlogs check`). The log has it: Arcane's dive at 15374 ms, the wave (193,830, scale 8.05) at 15558 ms |
| 25 | Ultimate time stop 0–82, cantCastSkill channel, damage immunity, cost 90 (×0.85 P4), cooldown 20 s | supported (data) | engine reads SkillData / tables |
| 26 | Talent 1: allies within 5 m of a Whirlpool, 10% / 20% Haste, +3 s after leaving | supported (interim) | team buffs `haste` (attr 92, the Whirlpool's 30 s + 3 s) and `haste_tail` (3 s, at the consumption); positions not modelled: the team counts as inside. U2 (Tangtang herself), test 19 (what Haste does) |
| 27 | Talent 1: enemies within 5 m, 20% / 40% Slow | supported (state) | `control slow` (33 s at the Whirlpool, 3 s at the consumption): only for `enemyControl slow` predicates; the speed itself isn't modelled (enemy attacks come from the scenario) |
| 28 | Talent 2: the dive also makes 1 + n Waterspouts (Battle Skill DMG, `dmg_up_water_ult` 0.4 / 0.6 in NormalCalcZone, 18 frames after the dive's jump), consuming the Whirlpools | **gap** (G1) | interim: cast trigger `riot_bringer` with `hits` (`damageType: battle`, `bonuses: [{zone: damageBonus, key: dmg_up_water_ult}]`) behind `olden_stare_dive`; infliction and Susceptibility left out until G1. The log has 9 of them (14,194 each) |
| 29 | P1: combo ×1.2, cooldown −2 s, `atb_return` +5 | supported (data) | loader (`efsim calc`: combo 2.88; values: `atb_return` 25) |
| 30 | P2: Agility +20, Cryo DMG +10% | supported (data) | stat panel |
| 31 | P3: shot ×1.1, Waterspouts ×1.1, Susceptibility +5% (battle skill and ultimate) | supported (data) | loader: 0.396, 0.275, rates 0.10 / 0.15 at P3 |
| 32 | P4: ultimate cost ×0.85 | supported (data) | energy max 76.5 |
| 33 | P5: ultimate ×1.15; talent 2's Waterspouts +0.8 (with talent 2 level 2: 0.6 + 0.8 = 1.4) | supported (data) | the loader's set-then-add gives 1.4, and the log's 9 such hits match only at 1.4 |
| 34 | Hit-stops (combo 0.1 / 0.15 s, battle skill 0.02–0.05 s, waves 0.15–0.2 s) | gap (known) | Ti1b, open since batch 1 |
| 35 | kit-draft output | data | G3 |
| 36 | Clannibal: main attribute, `wpn_sp_attr_magicdam_high`, Arts DMG +`spell_dmg_up` (card attributes 51–54) | supported (data) | stat panel |
| 37 | Clannibal: after the wielder consumes a reaction, that element's DMG Taken +`dmg_taken_up` 15 s on the target; one 25 s cooldown for all four (CheckGlobalCDTimerAction) | supported | four `statusConsumed` triggers sharing a cooldown state buff (`if: {not: {buffActive: wpn_pistol_0009.cd}}`), four enemy buffs (`damageTaken`, one element each, stackingType 1 priority `lv`). A Shatter: A7 |
| 38 | Artzy Tyrannical: Intellect, Crit Rate, Cryo DMG +`cryst_dmg_up` (card attribute 53) | supported (data) | stat panel |
| 39 | Artzy Tyrannical: a crit with a battle skill or combo (abilityEvent 44, mask 8448) → a layer of Cryo DMG +`cryst_dmg_up2`, 30 s each, max 3, at most once per 0.1 s | supported | `hit` trigger `crit: true`, `kinds: [battle, combo]`, `cooldown: 0.1`, self buff `maxStacks: max_stack`. Needs rolled crits (E2) |
| 40 | Artzy Tyrannical `toggleBuffs` (`buff_wpn_lance_0003` behind CheckCurHpRatio `hp_ratio`; neither key in this skill) | n/a | leftover, left out |
| 41 | Brigand's Calling: Agility, ATK, Cryo DMG +`cryst_dmg_up` (card attribute 53) | supported (data) | stat panel |
| 42 | Brigand's Calling: a Cryo Infliction from a battle skill or ultimate (abilityEvent 126, origin types 2 / 7, mask 4) → Cryo DMG +`cryst_dmg_up2` 20 s (one instance) | supported | `inflictionApplied` cryst `fromKinds: [battle, ultimate]`, `beforeDamage` (the log has it on the inflicting first tick as a boundary entry) |
| 43 | Brigand's Calling: an Arts Susceptibility from a battle skill or ultimate (abilityEvent 206, tag 1427729990) → Arts DMG Taken +`spell_damage_taken_up` 20 s on the target | supported | `buffApplied` `categories: [susceptibility]`, `fromKinds: [battle, ultimate]` |

Counts (43 rows, by primary status): **supported 37** (rows 1–18,
20–23, 25–27, 29–33, 36–39, 41–43; 17 of them "supported (data)": rows
1–4, 6, 8, 20, 21, 25, 29–33, 36, 38, 41; rows 5, 7, 9–11, 17, 22 also
need hand-written parts the compiler misses, row 7 is damage only until
S10, rows 11 and 12 carry G4 and G2), **gap 3** (rows 24 and 28: G1; row
34: Ti1b, open), **data 1** (row 35: G3), **unknown 1** (row 19: U1; rows
22 and 26 carry U3 and U2), **unique? 0**, **n/a 1** (row 40).

Nothing is unique. Whirlpools are field objects counted and consumed like
Avywenna's lances (`buffLayers`, V3 counts, a consuming cast trigger);
the stare's freeze is Si's Immobilization; the dive filter extends the
existing `decorations` hit filter (only Tangtang's data checks mask 1024
today: `buff_…_ultskill_buff` is the only file with it). Brigand's Calling
is plainly Tangtang's signature (Cryo Infliction and Arts Susceptibility
from a battle skill: her Waterspouts), but it's written generically.
Clannibal and Artzy Tyrannical fit any Cryo or reaction-consuming wielder.

## Gaps

### G1. Dive attacks inside the OLDEN STARE

- **family:** triggers (with S10, timing).
- **feature:** once S10 lets rotations cast dive attacks, a hit trigger
  filter `decorations: ["dive"]` (decorate bit 1024, as `finalStrike` and
  `finisher` already are) with `by: controlled`. The kit then writes the
  stare's DoT and wave as a cast trigger's detached hits (`olden_stare`,
  delay 76), and a second trigger on a dive hit while a state buff
  `olden_stare` (entity frames 0–119) is active does: `cancelHits` of
  `olden_stare`, `endBuff olden_stare`, the early wave (`atk_scale_3`,
  `poise3`, 5 frames later, ultimate damage), and with talent 2 the
  Waterspouts 18 frames later (Battle Skill DMG, `dmg_up_water_ult`
  bonus, count 1 + Whirlpools, the first tick's infliction and
  Susceptibility as the battle skill's, rates from the ultimate's
  `rate_spellvulnerable(_02)` + the passive's), then `endBuff whirlpool`.
  Every piece but the dive event exists (`cancelHits`, trigger `hits` with
  `damageType`, `buffLayers` counts).
- **evidence:** `chr_0027_tangtang_ultimate_skill_1` EventListenerAction
  0–119 → JumpTo 128, DamageAction `atk_scale_3` at 133;
  `buff_chr_0027_tangtang_ultskill_buff` abilityEvent listeners
  (CheckMainCharacterCondition, CheckDamageDecorateMask checkType 2 mask
  1024, enemy has `_ultskill_debuff` → `_ultskill_buff_damage` on the
  hitter); `buff_…_ultskill_waterwake` and `ult_skill_abilityentitymove`.
  Log b7b3762d5da8: Arcane's `plunging_attack_end` at 15374 ms, the early
  wave at 15558 ms (184 ms ≈ 5 frames), Riot Bringer Waterspouts from
  15928 ms; the stare's DoT stops after 5 of 8 ticks.
- **impact:** large where players dive: the early wave is 8.05 × ATK
  instead of 4.6 at P5 (+75%; her largest logged hit, 193,830), and talent
  2 adds 12–36 Waterspout ticks at 0.275 × ATK with +140% DMG at P5 (9
  logged at 14,194). It waits on S10 (rotations have no jumps); the
  interim state keeps the log check exact.

### G2. A game buff's stack cap read from its own blackboard

- **family:** data compilation (loader).
- **feature:** when a game buff's stacking has `useMaxStackCntKey` and the
  applying skill has no such value, the loader (`gameBuffInstances` /
  `checkBuff` in packages/data/src/kits.ts) takes the buff's own
  blackboard value, as the game does for keys a CreateBuffAction doesn't
  assign, instead of refusing the kit.
- **evidence:** `buff_chr_0027_tangtang_normalskill_spellvulnerable`
  stackingType 1, priorityKey `rate_spellvulnerable`, `maxStackCntKey`
  `cntmax`, blackboard `cntmax` 1; `normal_skill_water_projhit_1/_2`
  assign only `duration_spellvulnerable` and `rate_spellvulnerable`.
  Loader message: "buff spout_susceptibility_2 instances (maxStackCntKey):
  chr_0027_tangtang_normal_skill has no value cntmax".
- **impact:** none today on numbers: the kit leaves `gameBuff` out and
  keeps the 2- and 3-Waterspout buffs exclusive by hand (the 3-Waterspout
  cast ends the 5% one; the 5% one isn't applied over the 10% one),
  which is B1's one-instance reading. The cost is that the buffs aren't
  tied to their game buff (logs, stack groups across operators).

### G3. Compiler leftovers seen on Tangtang

- **family:** data compilation (D3 / D4 continued).
- **feature:** `compileSkill` / `kit-draft` should
  a. fold a poise-only DamageAction at the same frame and target as a
     damage landing into that landing's `poise` (`attack5_projhit`,
     `combo_skill`: "stagger poise without damage (no hit drafted)"), with
     `poiseControlledOnly` when it sits behind CheckMainCharacterCondition;
  b. count a TickIntervalAction's ticks on unrounded time (`k ×
     interval` ≤ the span), not on the rounded frame: the dive gets 5
     ticks (0.28 s rounds to frame 8 ≤ 8) where the span is 0.267 s and
     the display says 4;
  c. turn a count of the operator's spawned entities (ForEach over
     OwnerSpawnedEntityFinder tag 45117620 into `water_cnt`, then
     CompareFloat branches) into a declared layered buff and `count`
     conditions on it (D4's open "spawned entities a later skill recalls
     reported as a stack");
  d. follow an `EntityBB_*` key that the operator's passive buff sets
     (`buff_…_passive_0`: `EntityBB_abilityentity_water01` =
     `normalskill_atk_scale01` of `passive_0`) into a `scaleValue` on that
     skill's key;
  e. read a CheckBuffStackNumAdvanced with `limitSkillCastId` on a marker
     buff the same branch creates as "once per cast and target": the
     application on the first landing only, and count it once per cast,
     not once per spawned entity (the draft has 3 inflictions on every
     `_projhit_2` landing);
  f. turn a buff with applyTags −1065936627 and a layer-1 TimeDilation
     with an empty curve into `control immobilization` with `freezes`;
  g. not repeat a note per path (the combo's notes list the Whirlpool's
     two jumps 40 times, once per IfElse path through the gene).
- **evidence:** the draft (`efsim kit-draft chr_0027_tangtang`) against
  the kit plan below; frames and keys from the files in Data overview.
- **impact:** none once the kit hand-writes them (the values are in the
  kit plan); without (a) a kit misses 18 and 10 Stagger per Final Strike
  and combo.

### G4. `zmdlogs reactions` and a hit split into a first landing and the rest

- **family:** log tooling.
- **feature:** the replay (packages/cli/src/reactioncheck.ts) takes the
  first kit hit whose `events` contain a logged key. When a skill's
  landings of one key are split into a first-landing hit (with `applies`)
  and the rest, the replay should apply the first one's applications only
  to the first logged hit of that key per cast (a new cast: a gap longer
  than the hits' span since the last one of that key), and the rest's to
  the others. An alternative that also shortens kits: `applies[].oncePerCast`
  (engine: the first landing per cast and target, the data's
  `limitSkillCastId` marker), which the replay reads the same way.
- **evidence:** `zmdlogs reactions fixtures/zmdlogs-b7b3762d5da8.json`
  with the draft kit: every logged Waterspout hit replays a Cryo
  Infliction (33 "predicted but not logged" Cryo bursts), where the data
  inflicts once per battle skill.
- **impact:** the reaction report is unusable for any log with Tangtang;
  no effect on simulations or `zmdlogs check`.

## Unknowns

- **U1. A third Whirlpool.** `buff_…_water` caps at 2 layers (a third
  replaces the oldest), but `combo_skill_water_gene` spawns a new entity
  every time (marker 03 for a third), nothing in the files removes the
  oldest entity, and the battle skill's SP IfElse returns nothing when
  `water_cnt` is 3 (branches for 1 and 2 only). If the game caps entities
  elsewhere, the kit is right; if not, a third combo within 30 s means 3
  Waterspouts (same as with 2) but no SP refund. Reachable: combos 10–12 s
  apart without a battle skill.
- **U2. Does Tangtang get her own Haste?** The Whirlpool's AuraAction has
  `excludeOwner: true` with the entity as root; whether the owner is the
  entity or Tangtang decides whether she gets the 10% / 20%. Interim: the
  whole team (and positions aren't modelled: everyone counts as inside 5
  m). What Haste speeds up is test 19's question.
- **U3. How long the stare freezes the enemy.** The aura's
  `buff_…_ultskill_debuff` lasts while the enemy is inside (entity frames
  0–120, or to 128 after a dive): the engine stops the enemy's clock 4 s
  (statuses, inflictions, pending bursts, Susceptibilities run 4 s
  longer), as for Si (test 37). In the scratch simulation the Cryo burst
  of the battle skill cast just before the ultimate lands about 7.6 s
  after its infliction instead of 1 s (time stop and freeze).
- Known questions touched, not new: test 35 (an infliction that forms a
  reaction at once: her combo trigger and Brigand's Calling), test 38 (her
  Arts Susceptibility beside another one; the log lists Si's and Arcane's
  Cryo / Nature Susceptibilities on the same hits), A7 (Shatter as
  consumption, Clannibal), Ti2 (the combo's projectile to the Whirlpool),
  Ti1b (row 34), S10 (rows 7, 24, 28), E2 (Artzy Tyrannical needs rolled
  crits).

## Verification

`fixtures/zmdlogs-b7b3762d5da8.json`, scratch copy with the draft kits:

```
Tangtang (chr_0027_tangtang): 46 hits, 46 match, 0 mismatch, 0 under unmodelled effects, 0 not covered by a kit (100% of its damage covered)
  matched assuming: kit hit stare ×5, no crit ×40, boundary buffs applied ×3, kit hit spout2_first, unlogged suit_attri01.smash ×24, unlogged suit_attri01.smash ×5, crit ×2, kit hit early_rogue_wave, situational parts assumed ×1, kit hit riot_spout1 ×9
```

(main checkout without the kit: 1 match, 45 not covered). Per event:
combo ×1 (36,615), battle-skill shot ×5 (one a crit), stare DoT
×5 (6,483–11,076), two-Waterspout ticks ×24 (one a crit), the early rogue wave ×1
(193,830, only with `atk_scale_3`: 8.05 / 0.46 = 17.5 = the logged ratio
to the DoT tick on the same effects), Riot Bringer Waterspouts ×9 (only
with `dmg_up_water_ult` 1.4; the last one, 7,445, is capped by the
enemy's HP: `uncapped` 14,194), and her Cryo burst. Arcane and Si are
unchanged (13 / 13, 21 / 21). The build needs no correction: P5 and
weapon skill level 5 fit every hit. The "unlogged suit_attri01.smash"
entries are the existing Bonekrusha kit's cast buff, which the log doesn't
list.

What the log settles: the combo trigger counts a teammate's event (her
first action is the combo at 5137 ms, after Si's Cryo hits); any
controlled operator's dive ends the stare (Arcane's, at 15374 ms);
talent 2 and P5 add (0.6 + 0.8); Brigand's Calling's two buffs start on
the inflicting first Waterspout tick (boundary entries at 11276 ms, on
every later hit). What it can't: Haste and Slow (no damage), the
Immobilization's length (U3), a third Whirlpool (U1).

`zmdlogs reactions`: 3 matched (Tangtang's burst at 15374 ms among them),
33 predicted but not logged, all Cryo bursts from the replay inflicting on
every Waterspout tick (G4); 1 unexpected (Arcane's, as before).

Logs that would add: Tangtang without dives (the plain rogue wave), with
two Whirlpools (`_projhit_2`, 10% Susceptibility), and logs with
Clannibal (a reaction consumer: Arcane? the element debuffs) or Artzy
Tyrannical (layers after crits).

Proposed in-game tests (all by eye or stopwatch; not added to
in-game-tests.md in this phase):

1. *Tangtang's Immobilization and enemy timers* (U3; a Tangtang part of
   test 37; ready if you have Tangtang). On a dummy, battle skill after
   one combo (two Waterspouts: the Arts Susceptibility icon, 15 s). Start
   a stopwatch at the icon. Run A: do nothing more; the icon goes at about
   15 s. Run B: cast her ultimate right after the battle skill. Engine:
   the icon lasts about 15 + 2.7 (time stop, test 18's question) + 4
   (Immobilization) ≈ 21–22 s; if the Immobilization doesn't stop the
   enemy's timers, about 17–18 s; if neither, 15 s.
2. *Tangtang's own Haste* (U2; ready if you have Tangtang with talent 1).
   Combo on a dummy, then stand Tangtang in her Whirlpool: is the Haste
   icon on her portrait (or buff list)? Then swap to a teammate standing
   in it: icon there? Engine: both.
3. *A third Whirlpool* (U1; low priority, needs P1 for a 10 s cooldown and
   combo triggers from teammates). Three combos about 10 s apart without
   a battle skill: count the Whirlpools on the ground (2 or 3). Then the
   battle skill: does the SP bar jump visibly (refund) or not? Engine: 2
   Whirlpools, a refund of 50 SP (40 below P1).

Existing tests that touch her: 18 (time stop), 19 (Haste), 35, 37, 38,
47 (projectile travel: the combo's Whirlpool).

## Kit plan

Draft files (loaded with the real loader in the scratch copy; not in the
repository):
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-tangtang/repo/packages/data/kits/operators/chr_0027_tangtang.json`
and `…/kits/equipment/wpn_pistol_0009.json`, `wpn_pistol_0010.json`,
`wpn_pistol_0011.json` in the same folder. They load:
`packages/data/test/kits.test.ts` (380 tests, the 23 touching these kits
included) and `tests/logs.test.ts` pass in the scratch copy;
`efsim simulate` runs a 31 s solo rotation (battle skill, combo, battle
skill with one Whirlpool, ultimate, chain, …) and with Clannibal and Artzy
Tyrannical (`--runs 50` with rolled crits).

### Operator kit (`chr_0027_tangtang`, element `cryst`)

Buffs:
- `whirlpool` (self, `gameBuff buff_chr_0027_tangtang_water`, `maxStacks:
  2`, duration `{key: duration_water, skill: combo}`, no modifiers): one
  layer per Whirlpool.
- `haste` (team, `gameBuff …_comboskill_waterbuff`, attr 92 =
  `ratio_speed` of the combo, duration `duration_water` +
  `duration_talent1buff`) and `haste_tail` (team, `…_outaura`, 3 s).
- `spout_susceptibility_2` / `_3` (enemy, zone susceptibility, elements
  fire / pulse / cryst / natural, `rate_spellvulnerable` /
  `rate_spellvulnerable_02` of the battle skill, 15 s; no `gameBuff`
  until G2).
- `olden_stare_dive` (self, 1 s, no modifiers): G1's interim, never
  applied.

Triggers:
- `combo_window_infliction` (`inflictionApplied` cryst) and
  `combo_window_burst` (`burst`), `by: anyone`, `openCombo`.
- `whirlpool_forms`: cast of the combo, `delay: 26`, `detached`, `launch:
  26`: `buff whirlpool`; with talent 1 `buff haste` and `control slow`
  33 s.
- `whirlpools_consumed`: cast of the battle skill, `delay: 11`, `awaited`:

```json
"do": [
  { "kind": "sp", "value": { "product": ["atb_return", { "buffLayers": "whirlpool" }] }, "spKind": "returned", "if": { "buffLayers": "whirlpool", "atLeast": 1 } },
  { "kind": "buff", "buff": "haste_tail", "if": { "buffActive": "haste" } },
  { "kind": "apply", "applies": [{ "kind": "control", "status": "slow", "seconds": 3 }], "if": { "all": [{ "talentAtLeast": [0, 1] }, { "buffLayers": "whirlpool", "atLeast": 1 }] } },
  { "kind": "endBuff", "buff": "spout_susceptibility_2", "if": { "buffLayers": "whirlpool", "atLeast": 2 } },
  { "kind": "endBuff", "buff": "haste" },
  { "kind": "endBuff", "buff": "whirlpool" }
]
```

- `olden_stare`: cast of the ultimate, `delay: 76`, `detached`, `launch:
  76`: `{kind: control, status: immobilization, durationKey:
  display_duration, freezes: true}`.
- `riot_bringer`: cast of the ultimate, `delay: 204`, `detached`, `if:
  talentAtLeast [1, 1]`: `hits` (`riot_spout1/2/3`, `damageType: battle`,
  `scaleValue` the passive's key, `bonuses: [{zone: damageBonus, key:
  dmg_up_water_ult}]`, counts 12 / 24 / 36 by `buffLayers whirlpool`,
  frames 18 + the tick offsets) and `endBuff whirlpool`, each `if:
  buffActive olden_stare_dive` (G1).

Skills (hit by hit; frames from the cast; keys at the skill's level):
- `attack1` `shot` `atk_scale` [3] `launch 3`; `attack2` `shot_1`
  `atk_scale_1` [6], `shot_2` `atk_scale_2` [10] (events `_projhit`,
  `_02_projhit`); `attack3` `spray` ×5 [5, 7, 9, 10, 12], `shot` ×4
  [17, 17, 18, 18] `launch 17`; `attack4` `hit` ×2 [6, 10], `hit_2` [23];
  `attack5` `shot` [22] `launch 22`, `finalStrike`, `sp {if: controlled,
  then: atb}`, `poise`, `poiseControlledOnly`; `power_attack` [9] factor
  0.3, [21] factor 0.7; `plunging_attack_end` ×4 [3, 5, 7, 9].
- `combo_skill` `jet` `atk_scale` [26], `energy: usp`, `poise: poise`.
- `normal_skill`: `teamEnergy [{frame: 27, ratio: 1}]`; `shot` ×5
  `atk_scale_1` [27, 29, 32, 34, 36] `poise1`; Waterspouts (tick offsets
  0, 8, 16, 23, 31, 39, 47, 55, 62, 70, 78, 86 from frame 23, `launch:
  11`), per variant a first tick and the rest:

```json
{ "id": "spout2_first", "scale": [], "scaleValue": { "key": "normalskill_atk_scale01", "skill": "chr_0027_tangtang_passive_0" },
  "count": { "if": { "buffLayers": "whirlpool", "atLeast": 1, "below": 2 }, "then": 1, "else": 0 }, "frames": [23], "launch": 11,
  "events": ["chr_0027_tangtang_normal_skill_water_projhit_1"],
  "applies": [{ "kind": "infliction", "element": "cryst" }],
  "buffs": [{ "buff": "spout_susceptibility_2", "if": { "not": { "buffActive": "spout_susceptibility_3" } } }] },
{ "id": "spout2", "scale": [], "scaleValue": { "key": "normalskill_atk_scale01", "skill": "chr_0027_tangtang_passive_0" },
  "count": { "if": { "buffLayers": "whirlpool", "atLeast": 1, "below": 2 }, "then": 23, "else": 0 },
  "frames": [23, 31, 31, 39, 39, "… two per tick …", 109, 109], "launch": 11,
  "events": ["chr_0027_tangtang_normal_skill_water_projhit_1"] }
```

  `spout1_first` / `spout1` (`below: 1`, 1 + 11, `_projhit`, no
  Susceptibility) and `spout3_first` / `spout3` (`atLeast: 2`, 1 + 35,
  `_projhit_2`, `spout_susceptibility_3`) likewise. With G4's
  `oncePerCast` the pairs become one hit each.
- `ultimate_skill`: `stare` ×8 `atk_scale_1` [76, 91, …, 181] `launch
  76`; `rogue_wave` `atk_scale_2` [196] `poise2`, `if: {not: {buffActive:
  olden_stare_dive}}`; `early_rogue_wave` `atk_scale_3` [209] `poise3`,
  `if: {buffActive: olden_stare_dive}`. All logged as
  `chr_0027_tangtang_ultimate_skill_1`. After G1: the three move into
  the `olden_stare` trigger's hits so a dive trigger can cancel them.

### Equipment kits

- `wpn_pistol_0009` (Clannibal): buffs `wpn_pistol_0009.cd` (self, `gameBuff
  buff_wpn_pistol_0009_cd`, duration `cd`, no modifiers) and
  `wpn_pistol_0009.taken_<el>` (enemy, `gameBuff
  buff_wpn_pistol_0009_dmg_taken_up_<f|p|c|n>`, duration `duration`,
  `{zone: damageTaken, value: dmg_taken_up, elements: [<el>]}`);
  triggers, one per reaction:

```json
{ "id": "wpn_pistol_0009.combustion", "on": { "event": "statusConsumed", "statuses": ["combustion"] }, "by": "self",
  "if": { "not": { "buffActive": "wpn_pistol_0009.cd" } }, "skill": "sk_wpn_pistol_0009",
  "do": [{ "kind": "buff", "buff": "wpn_pistol_0009.cd" }, { "kind": "buff", "buff": "wpn_pistol_0009.taken_fire" }] }
```

  (electrification → pulse, solidification → cryst, corrosion →
  natural.)
- `wpn_pistol_0010` (Artzy Tyrannical): buff `wpn_pistol_0010.cryo_up`
  (self, `gameBuff buff_wpn_pistol_0010_valid`, duration `duration`,
  `maxStacks: max_stack`, `{attr: 53, value: cryst_dmg_up2}`); trigger
  `{event: hit, kinds: [battle, combo], crit: true}`, `by: self`,
  `cooldown: 0.1` → `buff`.
- `wpn_pistol_0011` (Brigand's Calling): buffs `wpn_pistol_0011.cryo_up`
  (self, `gameBuff buff_wpn_pistol_0011_valid`, duration `duration`, attr
  53 `cryst_dmg_up2`) and `wpn_pistol_0011.arts_taken` (enemy, `gameBuff
  buff_wpn_pistol_0011_valid2`, duration `duration2`, damageTaken
  `spell_damage_taken_up` on the four Arts elements); triggers
  `{event: inflictionApplied, elements: [cryst], fromKinds: [battle,
  ultimate]}` with `beforeDamage: true` → `cryo_up`, and `{event:
  buffApplied, categories: [susceptibility], fromKinds: [battle,
  ultimate]}` → `arts_taken`, both `by: self`.

Waiting on gaps: G1 (dive branch: early wave, Riot Bringer, needs S10),
G2 (the Susceptibility buffs' `gameBuff`), G4 (the reaction replay; with
`oncePerCast`, the first/rest pairs). G3 only shortens the hand-written
parts. Example scenario for the kit phase: the scratch rotation above
(`…/scratch-tangtang/repo/examples/tt.scenario.json`), with a teammate's
Cryo or a burst to open the first combo.

## Kit (2026-10-21)

Files: `packages/data/kits/operators/chr_0027_tangtang.json`,
`packages/data/kits/equipment/wpn_pistol_0009.json` (Clannibal),
`wpn_pistol_0010.json` (Artzy Tyrannical), `wpn_pistol_0011.json`
(Brigand's Calling); example `examples/tangtang-p5.json` +
`examples/tangtang-whirlpools.scenario.json`; tests
`tests/kit-tangtang.test.ts` (21), Tangtang in
`packages/data/test/skillCompile.test.ts` (10 KNOWN entries), and
`tests/batch4-logs.test.ts`'s L5 case, which expected no unlogged
prediction on b7b3 (true only without her kit), now allows exactly her two
explained ones (Verification). No engine, loader, compiler or tooling
change. Weapons: the three this report covers
(batch-4.md "Weapon owners" moves none of them).

### Re-analysis of the gaps

| Gap | Status | How |
|---|---|---|
| G1 dive attacks in the OLDEN STARE | **done in the kit; fires once dives are castable** (batch-1 S10, open: rotations can't cast `plunging_attack_end` yet) | C3's `dive` decoration on hit triggers (merged). Trigger `olden_stare_dive`: `on: {event: hit, decorations: [dive]}`, `by: controlled`, inside the window (`olden_stare`, 4 s from frame 76) and not after it (`olden_stare_over`): ends the stare, the early wave 5 frames later, with talent 2 the Riot Bringer Waterspouts 18 frames later (with their first tick's Cryo Infliction and Susceptibility, which the draft left out) and the Whirlpools' consumption. No `olden_stare_dive` interim state. The stare's ticks and the plain wave stay skill hits (they keep the cast's Link and cast-consumed buffs) with `if: not olden_stare_over`, instead of trigger hits behind `cancelHits` (G1's plan): same result, and the plain wave sets `olden_stare_over` itself, which closes the window at entity frame 120 even when Haste compresses her frames (below). Tested with dive-marked attack1 hits (her own, and Si's after a swap) |
| G2 stack cap from the buff's blackboard | **done** (B2) | both Susceptibility buffs name `buff_chr_0027_tangtang_normalskill_spellvulnerable` (loader: stack group, `cntmax` 1 from the buff); the hand-written "one instance across the two kit buffs" stays (the 3-Waterspout cast ends the 2-Waterspout one; the weaker isn't applied over the stronger) |
| G3a poise-only DamageAction | **done** in kit-draft (D6); the compiled landing still has it apart: 3 KNOWN entries | kit `poise` / `poiseControlledOnly` |
| G3b TickInterval rounding | **done** (D9a): the draft gives the dive 4 ticks | — |
| G3c spawned entities as a stack | **open** (batch-3 D4's open item; V3 deferred) | kit: `buffLayers whirlpool` counts, as planned |
| G3d EntityBB key the passive sets | **open** (D9e doesn't cover it: kit-draft still prints `$EntityBB_abilityentity_water01`): 6 KNOWN entries | kit `scaleValue` on passive_0's `normalskill_atk_scale01` |
| G3e once-per-cast infliction | **open** in kit-draft (D7f: the new draft still puts 1–3 inflictions on every Waterspout landing) | kit: a first-tick hit and the rest, per variant |
| G3f Immobilization from the debuff | **open** in kit-draft (D10d: the draft has no trigger for it) | kit trigger `olden_stare` (`control immobilization`, `freezes`) |
| G3g repeated notes | not seen in the new draft | — |
| G4 reaction replay first/rest | **done** (L1) | `zmdlogs reactions`: 33 false Cryo bursts → 2 (Verification) |

Mechanics rows not covered above: rows 1–18, 20–23, 25–33 and 36–43 are
written as the kit plan says (rows 5 and 17 with the folded poise, row 7
with 4 ticks, row 12 with `gameBuff`, row 43 with `tags: [1427729990]`,
T1). Row 19 (a third Whirlpool) keeps the interim (the layer cap replaces
the oldest; U1, test 95). Row 26 keeps the interim (the whole team,
Tangtang included, gets the Haste; U2, test 84). Row 34 (hit-stop, Ti1b)
stays open.

### What the kit leaves out or approximates

- **Dives:** none in a simulation until S10; the branch is exact against
  b7b3 (Verification). The early wave is a trigger's hit, so the
  ultimate cast's Link (only from Link sources since B1) and buffs that
  cast consumed don't reach it, while they reach the stare's ticks and
  the plain wave.
- **Immobilization after a dive:** the game's ends at the dive (the entity
  jumps past its aura); the kit's lasts its 4 s (no trigger action ends a
  control early). Only the freeze's length is off (U3, test 37's
  variant).
- **Haste on her own frames:** talent 1's Haste (attribute 92, 20%)
  compresses all her frames in the engine, the OLDEN STARE entity's too
  (ticks every 12.5 frames instead of 15, the wave 100 frames after the
  spawn). Whether entity timelines follow the owner's Haste is test 19's
  question; the frame tests run with talent 1 unlearned.
- **Positions:** the team counts as inside every Whirlpool (Haste) and the
  enemy inside the 5 m Slow; the Slow is only a state.
- **Riot Bringer's Susceptibility values** use the battle skill's keys:
  the data's are the ultimate's `rate_spellvulnerable(_02)` plus the
  passive's (ModifyDynamicBlackboard operation 1 at ultimate frame 76),
  equal at every potential (0.05 / 0.10 below P3, 0.10 / 0.15 from P3).
- Literals with their source in the notes: `olden_stare_over` 7 s (the
  entity's 210 frames); `whirlpool`'s `maxStacks: 2` (the buff's own
  `water_stack`, which no applying skill has, so a key can't name it).

### Equipment

- **Brigand's Calling** (her signature, tested on her): Cryo DMG +0.56
  (L9) for 20 s from the inflicting Waterspout tick (before its damage);
  Arts DMG Taken +0.168 for 20 s after her Susceptibility; nothing from
  basic attacks or a one-Waterspout cast.
- **Artzy Tyrannical** (tested on her): a crit on a battle skill or combo
  hit gives a 30 s layer of Cryo DMG +0.392, at most 3, one per 0.1 s;
  basic attacks' crits don't count; nothing without crits (searches rank
  it with rolled crits, T3).
- **Clannibal** (tested on Wulfgard, the handcannon wielder who consumes
  reactions: his battle skill's additional shot consumes Combustion in
  `wulfgard-fluorite`): Heat DMG Taken +0.28 for 15 s on the enemy, one
  shared 25 s cooldown for the four reactions; nothing on Tangtang.
  Shatter as a consumption stays batch-3 A7.

### Verification

`zmdlogs check fixtures/zmdlogs-b7b3762d5da8.json`:

```
Tangtang (chr_0027_tangtang): 46 hits, 46 match, 0 mismatch, 0 under unmodelled effects, 0 not covered by a kit (100% of its damage covered)
  matched assuming: kit hit stare, situational parts assumed ×5, no crit ×40, boundary buffs applied ×3, kit hit spout2_first, unlogged suit_attri01.smash ×24, unlogged suit_attri01.smash ×5, crit ×2, kit hit early_rogue_wave ×1, kit hit riot_spout1_first ×9
```

(before: 1 match, 45 not covered). The early wave (193,830) matches the
dive trigger's hit, the 9 Riot Bringer ticks its `riot_spout1*` hits at
`dmg_up_water_ult` 1.4. Arcane 13 / 13 and Si 21 / 21 unchanged; Last
Rite 0 / 5 (no kit in this worktree).

`zmdlogs reactions` on b7b3: before, 3 matched, 1 unexpected (her 15374 ms
burst: no kit); now 4 matched (her burst among them; Arcane's two bursts
are now due at 10917 ms, logged at 10910: her ultimate's time stop is
placed from the kit, L5), 2 predicted but not logged:

- 15928 ms: Riot Bringer's first tick adds Cryo to the battle skill's
  stack. The log confirms the infliction (Brigand's Calling's `_valid`
  refreshed on that hit, a boundary entry); the replay's extra stack is
  Last Rite's Cryo consumption at 11462 ms, which it can't see without her
  kit. With her analysis draft kit copied in (scratch only) it goes away.
- 17055 ms: the last two `_projhit_1` ticks of the battle skill cast at
  about 11 s are placed as a new cast's first landing (so an infliction):
  the log stretches that cast to 5.8 s with Last Rite's and Arcane's time
  stops in between, past the placement's span + CAST_SLACK_MS (1 s) and
  the skill's 4.5 s. A log-tooling limit (logcasts.ts doesn't discount
  others' time stops when it groups a key's landings); not changed here.

Example `tangtang-whirlpools`: 712,772 damage in 31.0 s, 22,968 DPS
(solo, expected crits; SP-bound after the ultimate). Every other example
total and every other `zmdlogs check` / `reactions` output is unchanged.

### In-game tests the kit depends on

37 (batch-4.md's variant "Enemy timers under Last Rite's freeze and
Tangtang's Immobilization": U3), 84 proposed (her own Haste: U2), 95
proposed (a third Whirlpool: U1), 19 (what Haste speeds up, entity
timelines included), 35 (an infliction forming a reaction at once: her
combo trigger and Brigand's Calling), 38 (her Arts Susceptibility beside
another), 18 (time stop), 47 (the combo projectile's travel to the
Whirlpool). Nothing new is ready beyond those proposed.
