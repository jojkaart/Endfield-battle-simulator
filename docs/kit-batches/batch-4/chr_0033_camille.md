# Camille (chr_0033_camille): gap report, batch 4

Operator Camille (Heat; CharGrowthTable `charTypeId` Fire, `profession` 7,
`mainAttrType` 40 Agility, `subAttrType` 41 Intellect, `weaponType` 5
Polearm, rarity 6). Equipment covered here ([batch-4.md](../batch-4.md)):
`wpn_lance_0012` Mountain Bearer, `wpn_lance_0015` Blessing of Lustrous
Carmine, `wpn_lance_0016` Golden Age. No gear set.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
I18nTextTable_EN; Json/SkillData `chr_0033_camille_*` (23 files),
`sk_wpn_lance_0012/0015/0016`; Json/BuffData `buff_chr_0033_camille_*`
(28 files), `buff_wpn_lance_0012_*`, `_0015_*`, `_0016_*`,
`buff_common_affixes_combo_trigger`, `_skillimbue_atk`. Values at skill
level 12 and weapon skill level 9 unless stated. Every file needed is in
the checkout. Ability-event names (45 OnReceiveHeal, 126
OnCharBeforeOutputSpellInfliction, 206 OnBeforeOutputBuff, 262
OnAbilityEntityFinished, 302 OnBeforeOutputDamage) are Endaxis's enum
(`reference/Endaxis`, read only), taken as claims and checked against the
logs where they can be.

Logs: fixtures/zmdlogs-40d9a3c1da37.json (Camille P3 with Laevatain, Si,
Gilberta) and fixtures/zmdlogs-4e5e1390085e.json (Camille P1 with Rossi,
Estella, Gilberta), both with Blessing of Lustrous Carmine (skill levels
9/9/4) and three Frontiers (`suit_atb01`) pieces.

Claims from earlier reports, re-checked:
- *Camille's combo and ultimate grant natural skill SP* (batch-2 Akekuri
  report, Frontiers): **confirmed**, and Hunter Pursuit's too: every
  costType-1 ObtainCostAction in her combo, combo_skill_2 and ultimate has
  `atbGainMethod` 0 and `atbSourceType` 3; her basic attacks have type 1.
- *Her normal_skill_2 uses switchToBuffConfig* (batch-1 Liino report, N2
  `beside`): **true, but not a `beside` case.** It has `asSkillCast`
  false, condition `buff_chr_0033_camille_ult_henshin_state` ≥ 1 and buff
  `buff_chr_0033_camille_cast_combo2`, whose start event casts
  `chr_0033_camille_combo_skill_2` (a full cast). See G1.
- *The CastSkill in normal_skill_projhit_sub* (brief): it is the
  retarget path (`listen_target_dead` abilityEvent 1 OnOwnerHpZero →
  `reset_target` → a projectile to another enemy → `projhit_sub` →
  CastSkill `normal_skill_abilityrange`). kit-draft compiles it as a hit
  that "lands always"; on one enemy it never happens (row 9).
- *40d9's unexplained Heat burst at 7550 ms* (batch-1 Laevatain report):
  **explained** once Camille's battle skill inflicts: `zmdlogs reactions`
  matches it to Laevatain's 6657 ms Heat and Camille's 7663 ms burst to
  her own (3 matched, 0 / 0, was 2 / 0 / 1).
- *Link: 40d9 Gilberta's ultimate ×1.2000 with one stack from Camille's
  combo* (batch-1 Gilberta report, data-sources.md): consistent with the
  data, but the engine's rule built on it ("every combo cast leaves a
  stack", B8) is contradicted by four other logged casts: G2.

## Data overview

Action types per file that affect damage, resources, state or timing
(visual, audio, camera, movement, super-armour and targeting left out):

| File | Relevant actions |
|---|---|
| `attack1`, `attack2` | DamageAction mask 128 at 4 / 10 (`attack2` 10 / 14), each ObtainCostAction `atb` × 0.5 (type 1; `atb` 0 at every level) |
| `attack3` | ChannelingAction 7–22, at most 4 per target: DamageAction `atk_scale` |
| `attack4` | DamageAction at 11 (`atk_scale_1`); LaunchProjectile at 20 → `attack4_projhit`: 7 DamageActions 2 frames apart (`atk_scale_2`) |
| `attack5` | DamageAction mask 2097280 (Final Strike) at 21, poise unit `poise` 18 `onlyEnableForMainChar`, ObtainCostAction `atb` 20 if controlled |
| `power_attack` (spec. 8) | 7 LaunchProjectiles at 3–8 → `power_attack_projhit` (×6) / `_witheff`, factor 0.05 each; DamageAction at 43, BreakingAttackCalculation 0.65; GainBreakingAttackAtb |
| `plunging_attack_start/_end` | dive; DamageAction mask 1152 at 1 |
| `normal_skill` | 100 SP; LaunchProjectile at 12 → `normal_skill_projhit`; AllowNextSkillAction 18–34 (combo); exclusive 26 |
| `normal_skill_projhit` | SpawnAbilityEntity `abilityentity_chr_0033_camille_normal_skill` (skill `abilityrange_first`, EntityBB keys from the battle skill: `atk_scale`, `poise`, `bat_duration`, `bat_atk_scale`, `weak_scale`, `vulnerable_scale`); CreateBuff `buff_common_obtain_ultimate_sp` (team energy) and `normal_skill_bateffect` |
| `normal_skill_abilityrange_first` | SpellInfliction Heat; DamageAction `EntityBB_atk_scale`, poise `EntityBB_poise`, mask 4352; CreateBuff (target, `autoFinishByAction`) `normal_skill_weak` (duration `EntityBB_bat_duration`) and `listen_target_dead` |
| `buff_…_normal_skill_weak` | applyTags 2079142122; WeakAction `weak_scale` and VulnerableAction subType 4 (Heat) `vulnerable_scale` as child buffs |
| `passive_normal_skill_ability_entity` | the entity's passive (how it is attached isn't in our tables): buff `bat_checktarget` (0.5 s ticks; no target and not retargeting → the entity ends); abilityEvent 9 (OnAddedBuff) `bateffect`, stacks ≥ 2 → CreateBuff `normal_skill_delay_damage` |
| `buff_…_normal_skill_delay_damage` | 0.4 s; at its end DamageAction `bat_atk_scale` (EntityBB), Heat, mask 256 (battle skill) |
| `passive_listen_normal_skill` | buff `combo_2_type` (ChangeSkillType combo_skill_2 → 6, combo); abilityEvent 262 (OnAbilityEntityFinished) ends the hover icon |
| `combo_skill` | ChannelingAction ticks at 19 (`atk_scale_1_1`), 27 (`atk_scale_1_2`, LaunchUpward: displacement only), 47: on a target with tag 2079142122 CreateBuff `bateffect` and, if `talent_0` ≥ 1, ComboAction (count 1, `combo_duration`); DoOnce ObtainCostAction `atb` (type 3); DamageAction `atk_scale_1_3`, poise `poise`; then on the tagged target with `talent_0` HealAction (heal_base + Intellect × heal_sub_multi, combo heal tag −1517158118, on Camille); ObtainCostAction costType 0 `usp` once. Cooldown 18 s (L12). TimeDilation 0–15 (0.6 s). AllowNext 51–63 (battle skill, normal_skill_2) |
| `normal_skill_2` | battle group, 0 SP (SkillPatchTable); switchToBuffConfig (henshin ≥ 1) → `buff_…_cast_combo2` → CastSkill `combo_skill_2` |
| `combo_skill_2` (Hunter Pursuit) | frame 0 FinishBuffAdvanced `ult_henshin_state`; ticks at 20 (`atk_scale_2_1`), 33 (DoOnce `atb`, then `atk_scale_2_2`, poise `poise`), 49 (`atk_scale_2_3`), 70 (`talent_0` → DoOnce ComboAction; tagged target → `bateffect`; DoOnce `atb_ex`; `atk_scale_2_4`, poise `poise_2`; `talent_0` → HealAction; `usp` once). TimeDilation 52–67 (0.5 s) |
| `ultimate_skill` | 130 energy; TimeDilation 0–69 (2.77 s, everyone but Camille); ChannelingCastingAction cantCastSkill 0–122; 7 ticks 75–84 (`atk_scale_1`), 104 (`atk_scale_2`), 120 (Heat infliction once per target via `ult_hit`, DoOnce `atb`, `atk_scale_3`, poise `poise`); CreateBuff `ult_effect` (inert) at 90, `ult_henshin_state` at 118 (`duration` 15) |
| `buff_…_ult_henshin_state` | ChangeSkillAction battle skill → `normal_skill_2`; at its end two cosmetic buffs |
| `passive_talent1` (talent 2) | abilityEvent 45 (OnReceiveHeal) + CheckHealTag (battle −320297214, combo −1517158118, ultimate −1499119779) → `talent1_atkup` (attribute 51 Heat DMG, `atk_up`) on Camille and, ×`teammate_rate`, on each teammate; CheckOverHeal → the same again |
| unreached | `ult_lance_target` → `ult_delay_damage` → `ult_self_layer`; `chrdg_atk_up`, `_addusp`, `_lastcombo`, `_lastcombo_aura`, `_lastcombo_finish`, `_fire_dmg_up`; `potential_5_effect` (visual); `passive_default_ring` (visual). No file creates the first two chains |

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Attacks 1–2: two Heat hits each (4 / 10, 10 / 14), SP `atb` × 0.5 if controlled (0) | supported (data) | draft correct. Logs: 16 hits match |
| 2 | Attack 3: 4 ticks at 7–10 | supported (data) | `count: 4`. Logged 4 per attack 3 |
| 3 | Attack 4: hit at 11 + 7 projectile hits at 20–32 (`attack4_projhit`) | supported (data) | `launch: 20`; travel isn't in the data (Ti2). Logged 7 per attack 4 |
| 4 | Attack 5: Final Strike at 21, poise 18 if controlled, SP 20 if controlled | supported (data) | `finalStrike`, `poiseControlledOnly`. Logs match |
| 5 | Finisher: 7 projectiles × 0.05 at 3–8 + hit × 0.65 at 43 | supported (data) | `factor`s compiled; not in either log |
| 6 | Dive attack | supported (damage) | not castable in rotations (S10) |
| 7 | Battle skill (Blazing Exorcism): projectile at 12 → the Vesperwings entity: Heat Infliction, `atk_scale` 2.0, poise 10; 100 SP; team energy at 12 | supported (data) | one hit, `launch: 12`, `teamEnergy: [{frame: 12, ratio: 1}]`; travel Ti2. Logs: 4 of 4 match |
| 8 | Vesperwings hover on the target: Weakness `weak_scale` + Heat Susceptibility `vulnerable_scale` (0.07; P1 0.12) for `bat_duration` (45 s; P1 60 s), from before the hit's damage | supported; **data** | enemy buff `vesperwings` (attr 62 + zone `susceptibility` fire, `gameBuff` `buff_chr_0033_camille_normal_skill_weak`), hit `buffs: [{buff, beforeDamage: true}]`. The draft only notes the buff (D4). Logs: Susceptibility 0.12 as `buff_common_affixes_vulnerable_fire`, on the battle skill's own hit (6751, 5563, 46901, 65097 ms match only with it) |
| 9 | Retarget when the target dies (listen_target_dead → projhit_sub → abilityrange, remaining hover time carried) | n/a | one enemy, no kills (N2); drop the draft's `abilityrange` hit ("lands always") |
| 10 | Hover end: `bat_checktarget` 0.5 s ticks end the entity without a target; entity end (262) ends the icon | n/a | single target: the hover lasts `bat_duration` |
| 11 | Combo trigger: "When an enemy's Heat Infliction is consumed or absorbed" | supported | `on: {event: inflictionConsumed, elements: [fire]}`, `by: anyone` → `openCombo`. Simulated: opens on Gilberta's Corrosion |
| 12 | Combo (Heartstake Thorn): 19 / 27 / 47, 0.6 / 0.6 / 1.8, poise 10, energy 10, SP 20 (P3 ×1.3, ×1.15); cooldown 18 s (P3 −2) | supported (data) | draft hits; P3 via skill values and skillParam. Logs: 12 of 12 match |
| 13 | Combo SP is granted before hit 3's damage (DoOnce before the DamageAction): Lustrous Carmine's ATK is on hit 3 | supported; **data** (G5) | cast trigger `combo_f47_sp` (`delay: 47`, `sp: atb`; runs before the frame-47 hit), not the hit's `sp`. Logs: 40d9 9240, 4e5e 7982 / 30769 ms match with the ATK counted |
| 14 | Explosion: a combo hit on a target with hovering Vesperwings → 0.4 s later `bat_atk_scale` (1.0) Heat, battle-skill DMG type, key `buff_…_normal_skill_delay_damage` | supported; **data** | cast trigger `combo_f47`: `hits` (`frames: [12]`, `damageType: battle`, skill `chr_0033_camille_normal_skill`) with `if: {enemyBuff: buff_chr_0033_camille_normal_skill_weak}`. Not compiled (entity passive). Logs: 6 of 6 match |
| 15 | The entity's check "bateffect stacks ≥ 2" | unknown → settled by logs | U2: every combo and Hunter Pursuit on a hovering target explodes in both logs (6 of 6); the kit fires on every one |
| 16 | Talent 1 (Hunter of Transgression): combo on a hovering target (Hunter Pursuit: any target) → heal Camille + Link 15 s | supported | cast triggers: `buff link` (team, `link: true`, `maxStacks: 4`) at 47 / 70 and `heal self` (`healKind: combo`) one frame after the hit (the HealAction follows the DamageAction). Gated by `talentAtLeast [0, 1]` (talent_0) and, on the combo, the hover |
| 17 | Link stacks: only ComboAction (and Akekuri's talent buff) give Link, not every combo | **gap** (G2) | engine-wide: B8 gives every combo cast a stack; with Camille's `link` buff her combo gives 2 (logs: 1) |
| 18 | Ultimate (Sanguine Downpour): 7 × 0.4 (75–84), 1.2 (104), 2.0 (120) with Heat Infliction, poise 15, SP 40; 130 energy (P4 110.5); time stop 2.77 s; cantCastSkill to 122 | supported (data) | draft hits; SP as cast trigger `ult_f120` (before hit 3's damage, row 13's pattern). Logs: 9 of 9 match |
| 19 | Hunter Pursuit state: after the ultimate (frame 118, 15 s) the battle-skill button casts Hunter Pursuit, "treated as a combo skill" (ChangeSkillType 6), 0 SP, no combo window; it ends the state at frame 0 (one per ultimate) | **gap** (G1) | interim: hitless battle-kind skill `normal_skill_2` (`available: buffActive hunter_state`) whose cast trigger `cast`s `combo_skill_2` (`followUpOnly`, kind combo); `normal_skill` gets `available: not hunter_state` |
| 20 | Hunter Pursuit hits: 20 / 33 / 49 / 70, 0.6 / 0.6 / 0.6 / 3.2, poise 10 + 10, SP 20 at 33 and 20 at 70 (both before their damage), energy 10 at 70; explosion if hovering | supported (data) | four hits; SP as cast triggers at 33 / 70; explosion as row 14 at 70. Logs: 4 of 4 match |
| 21 | Talent 2 (Bloodfount Revival): when Camille receives a skill heal, Heat DMG +`atk_up` (0.02 / 0.04; P5 +0.06) per layer, 40 s each, max 5; teammates 25% of it; a second layer at Max HP | supported (own heals) | trigger `on: {event: heal, kinds: [battle, combo, ultimate]}`, `by: self`, 2 layers (topped up: N2) of `bloodfount` and `bloodfount_team` (`recipients: not isOwner`, `atk_up × teammate_rate`). Logs: ×2 at every heal; 0.01 per layer on teammates (40d9) |
| 22 | Talent 2 from a teammate's skill heal (OnReceiveHeal: any healer) | **gap** (G3); unknown | U1. Interim: Camille's own heals only |
| 23 | P1: Weakness / Susceptibility +0.05, hover +15 s | supported (data) | skill values; logs 0.12 |
| 24 | P2: Agility +20, Intellect +20 | supported (data) | stat panel |
| 25 | P3: combo cooldown −2 s; combo and Hunter Pursuit multipliers ×1.3, SP ×1.15 | supported (data) | skill values / skillParam (calc: combo hit 3 2.34) |
| 26 | P4: ultimate cost ×0.85 | supported (data) | skillParam |
| 27 | P5: talent 2 `atk_up` +0.06 | supported (data) | `{talent: 1, key: atk_up}` reads the potential's change (calc: 5 layers ×1.184 at P5 over P3) |
| 28 | Slow-downs (combo 0.6 s, Hunter Pursuit 0.5 s, ultimate 2.77 s) and hit-stops | supported / gap (known) | slow-downs from SkillData; hit-stops Ti1b (open since batch 1) |
| 29 | Combustion ticks after a buff of the applier ends (4e5e 66004–68449 ms) | unknown | U5 (arts state, not Camille's kit) |
| 30 | kit-draft output | data | G5 |
| 31 | `zmdlogs reactions` maps a logged landing to the first kit hit with its key | **gap** (G6, log tooling) | the ultimate's Heat Infliction (hit 3 of 9 landings with one key) never replays |
| 32 | Unreached files (row "unreached" above) | n/a | nothing creates them |
| 33 | Lustrous Carmine: Agility, Heat DMG, Ultimate Gain Efficiency +50.4% (attribute 44) | supported (data) | stat panel (calc: UltimateSpGainScalar 150.4%) |
| 34 | Lustrous Carmine: "When the wielder's skill recovers SP, the entire team gains ATK +16.8% for 20s" (142 OnObtainAtb, method [0], type [3]) | supported | team buff `wpn_lance_0015.atk` (attr 2 → zone atk), trigger `on: {event: sp, natural: true, sourceTypes: [3]}`, `by: self`. Logs: on teammates; on the SP-granting hit (row 13) |
| 35 | Lustrous Carmine: "When the wielder's skill applies Heat Infliction, the entire team gains Heat DMG Dealt +16.8% for 20s" (126 + CheckOriginSkillType [2, 6, 7] + Heat mask) | supported; unknown part | `on: {event: inflictionApplied, elements: [fire], fromKinds: [battle, combo, ultimate]}`, `beforeDamage: true`. Logs: on the inflicting battle-skill hit itself (test 51's question, answered for this handler). An infliction that forms a reaction: test 35's question (`inflictionApplied` excludes it) |
| 36 | Mountain Bearer: Agility, Physical DMG | supported (data) | stat panel |
| 37 | Mountain Bearer: DMG Dealt +56% against Vulnerable enemies (`buff_wpn_lance_0012_noguard`, permanent) | supported | self buff from `fightStart`, `{zone: damageBonus, value: dmg_up, if: {enemyVulnerable: 1}}` (calc: ×1.56 on a hit) |
| 38 | Mountain Bearer: battle skill applies Vulnerability → All Attributes +22.4% for 15 s | supported trigger; **gap** effect | `on: {event: vulnerable, fromKinds: [battle]}`, `cooldown: cd` (0.1 s marker); the attribute percentages don't reach ATK (V4 residue): calc unchanged with the buff |
| 39 | Mountain Bearer: battle skill applies Physical Susceptibility → All Attributes +22.4% for 15 s (206, tag 1066759270 = `buff_common_affixes_vulnerable_physical` / `_all`, CheckOriginSkillType [2]) | **gap** (G4) + V4 | interim `on: {event: buffApplied, gameBuffs: [...]}`: any skill's, not only the battle skill's |
| 40 | Mountain Bearer `toggleBuffs` `buff_wpn_lance_0003` with `atk_up` from this skill's blackboard (it has none: 0) | n/a | inert |
| 41 | Golden Age: Will, Treatment Efficiency, Electric DMG +16.8% (attribute 52) | supported (data) | stat panel |
| 42 | Golden Age: combo deals DMG → Treatment Efficiency +11.2% 15 s (302 + type [6]) | supported | self buff, no damage effect (heals aren't modelled); `on: {event: hit, kinds: [combo]}` |
| 43 | Golden Age: combo heals another operator → team Arts DMG +14% 20 s (50 + combo heal tag + not the wielder) | supported | `on: {event: heal, toOthers: true, kinds: [combo]}`; stackingType 1 priority (stack group from `gameBuff`). Camille's own combo heal is on herself: it never fires for her |
| 44 | Signatures | n/a | Lustrous Carmine is Camille's (both her logs). Mountain Bearer is plainly Lifeng's: his battle skill Knocks Down (Vulnerable) and applies Physical Susceptibility to an enemy without Vulnerable (CharGrowthTable chr_0015_lifeng_NormalSkill); the merge may move it to his report. Golden Age (Will, Electric, combo heals of teammates) fits an Electric healer such as Liino |

Counts (44 rows, by primary status): **supported 30** (rows 1–8, 11–14,
16, 18, 20, 21, 23–28, 33–37, 41–43; 17 of them "supported (data)";
rows 8, 13, 14 need hand-written parts the compiler misses), **gap 6**
(rows 17 G2, 19 G1, 22 G3, 31 G6, 38 V4 residue, 39 G4), **data 1**
(row 30; rows 8, 13, 14 have data parts), **unknown 2** (rows 15 U2,
settled by logs, and 29 U5; row 22 carries U1, row 35 U4), **unique? 0**,
**n/a 5** (rows 9, 10, 32, 40, 44; row 28's hit-stop half is the known
Ti1b).

Nothing is unique. ComboAction (Link) is also in `chr_0015_lifeng_combo_skill`;
the explosion is an ordinary triggered hit; the hover debuff is a plain
enemy buff with Weakness and Susceptibility (Catcher's Weakness, Estella's
Susceptibility); talent 2 is a heal trigger with layered team buffs
(`wpn_lance_0014`'s shape). OnReceiveHeal (45) is only in Camille's files,
but G3 is the mirror of the existing `toOthers` filter, not a mechanism of
its own. G1's "a skill of one kind cast from another kind's button" may be
shared: `buff_chr_0030_zhuangfy_ult_base` also changes a skill's type
(ChangeSkillType `ultimate_skill_end` → 3) and replaces two buttons; the
merge should compare with Zhuang Fangyi's report.

## Gaps

### G1. Hunter Pursuit: a combo-kind skill cast from the battle-skill button

- **family:** skills (states).
- **feature:** `KitSkill.comboWindow: false` (name open): a combo-kind
  skill the rotation casts without the operator's combo window (it is on
  another button), with its own SkillPatchTable cost (0 SP) and cooldown,
  gated by `available` (`{buffActive: hunter_state}`). The cast is a combo
  for everything else: its cast event has kind combo and `followUp: false`
  (cast filters, `kinds: [combo]`), its hits are combo hits, it doesn't
  consume Link, and it doesn't put the regular combo on cooldown (another
  skill ID). The regular battle skill gets `available: {not: {buffActive:
  hunter_state}}` (already expressible). `hasComboTrigger`'s window check
  in `actionGate` / `startsNow` skips skills with the flag.
- **evidence:** `buff_chr_0033_camille_ult_henshin_state` ChangeSkillAction
  (battle skill → `normal_skill_2`); `normal_skill_2` switchToBuffConfig
  (`asSkillCast` false, henshin ≥ 1) → `buff_chr_0033_camille_cast_combo2`
  (buffEvent 3: CastSkill `combo_skill_2`); `buff_…_combo_2_type`
  ChangeSkillType `combo_skill_2` → 6; CharGrowthTable UltimateSkill:
  "Hunter Pursuit: Treated as a combo skill and costs no SP"; `combo_skill_2`
  frame 0 FinishBuffAdvanced henshin (one per ultimate).
- **impact:** small. The interim (a hitless battle-kind `normal_skill_2`
  plus a `cast` trigger of a `followUpOnly` combo_skill_2) is exact for
  damage, SP and energy; but the button counts as a battle-skill cast: it
  uses up any Link stacks on the team for nothing (rare: the ultimate just
  before it uses them first) and fires "casts a battle skill" effects, and
  the Hunter Pursuit cast is `followUp: true`, so a trigger filtered
  `followUp: false` misses it.

### G2. Link comes from Link sources, not from every combo cast

- **family:** buff lifecycle (Link: batch-1 B4 / B8).
- **feature:** drop the built-in stack that every combo cast leaves the
  team (timeline.ts: `if (costs.kind === "combo") next = { ...next, link:
  [...live, frame + LINK_FRAMES] }`). Link stacks then come only from kit
  buffs with `link: true`: Camille's talent 1 (ComboAction in
  `combo_skill` frame 47 and `combo_skill_2` frame 70), Lifeng's combo
  (ComboAction in `chr_0015_lifeng_combo_skill`: his report), Akekuri's
  talent 2 (`global_buff_combo_trigger`, already a `link` buff). The
  consumption by the next battle skill or ultimate and the values by
  stack count (B8, test 8) stay.
- **evidence:** ComboAction occurs only in Camille's and Lifeng's files
  (`grep ComboAction+` over SkillData / BuffData). The one logged Link
  (40d9 12951 ms, `buff_common_affixes_combo_trigger` credited to Camille)
  has one stack after her one combo, although that combo also had talent 1
  on a hovering target (talent-2 layers logged at 9240 ms prove the
  branch ran): built-in + ComboAction would be two (×1.30, logged ×1.20).
  Casts after other operators' combos carry no Link at all; each matches
  `zmdlogs check` exactly with the logged buffs only (the checker adds no
  Link; ×1.2 or more would be a mismatch):
  - b7b3762d5da8 7150 ms: Arcane's ultimate 2.0 s after Tangtang's combo;
  - pending abfd4b7478ec 28304 ms: Si's ultimate 2.5 s after her own combo;
  - pending abfd4b7478ec 85643 ms: Si's battle skill 0.6 s after Xaihi's combo;
  - pending abfd4b7478ec 61958 ms: Fluorite's ultimate after Xaihi's and her own combos.
  No battle skill or ultimate came between combo and cast in any of them.
- **impact:** large, engine-wide: today every battle skill within 15 s of
  any combo deals ×1.30 (up to ×1.75 with four) and every ultimate ×1.20
  (up to ×1.50) too much, and rotation searches chase it. With Camille's
  kit the engine would give her combo two stacks. Test 8's set-up ("after
  one teammate's combo") assumes the built-in rule; with G2 it needs a
  Link source (Camille's combo on a hovering target, Akekuri's ultimate).
  Worth telling the owner at the merge.

### G3. A heal trigger on heals the owner receives

- **family:** triggers.
- **feature:** `heal` trigger filter `toOwner: true` (mirror of
  `toOthers`): only heals whose target is the trigger's owner, from any
  healer (`by: anyone`), with the existing `kinds` filter (heal tags).
  Camille's talent 2 becomes `on: {event: heal, kinds: [battle, combo,
  ultimate], toOwner: true}`, `by: anyone`.
- **evidence:** `chr_0033_camille_passive_talent1` / `buff_…_talent1`
  abilityEvent 45 (OnReceiveHeal) + CheckHealTag on the three skill heal
  tags; weapons that react to the wielder's own heals use 50
  (OnOutputHeal: `sk_wpn_lance_0014`, `_0016`, `sk_wpn_funnel_0012`). The
  description ("Whenever Camille restores HP via a skill") is ambiguous.
- **impact:** with a skill healer in the team (Liino's soundwaves every
  3 s, Xaihi's crystal, Purrchena's giftbox) talent 2 would sit at 5
  layers: Camille's Heat DMG +20% (talent level 2; +50% at P5) and +5% /
  +12.5% for each teammate, instead of 2 layers per Camille combo. Zero
  without a skill healer, or if 45 counts only her own heals (U1, test
  below).

### G4. Buff-category triggers by element (Mountain Bearer)

- **family:** triggers.
- **feature:** the `buffApplied` trigger with `categories` gets
  `elements?: Element[]` (the applied buff has a modifier of that
  category reaching one of them; an all-element one counts, as the tag
  1066759270 is also on `buff_common_affixes_vulnerable_all`); or the
  `gameBuffs` variant gets `fromKinds`. Mountain Bearer's second effect:
  `on: {event: buffApplied, categories: [susceptibility], elements:
  [physical], fromKinds: [battle]}`, `by: self`, `cooldown: cd`.
- **evidence:** `sk_wpn_lance_0012` abilityEvent 206 CheckBuffIdInContext
  tag 1066759270 (`buff_common_affixes_vulnerable_physical`, `_all`, Mi Fu's
  passive, `buff_equipsuit_crush_fracture`) + CheckOriginSkillType [2].
- **impact:** none today for damage (its effect waits on V4's residue,
  row 38). Without G4 the interim fires on any skill's Physical
  Susceptibility (Estella's combo, a teammate's own skill doesn't count:
  `by: self`); a categories-only trigger would also fire on Camille's
  Heat Susceptibility. Matters for Lifeng (row 44).

### G5. Compiler leftovers seen on Camille (data)

- **family:** data compilation (D1 / D3 / D4 leftovers, one new item).
- **feature / evidence:**
  1. *SP before the damage* (new): an ObtainCostAction that precedes the
     DamageAction in the same tick (Camille's combo 47, Hunter Pursuit 33
     and 70, ultimate 120: DoOnce before the DamageAction) is emitted as
     the hit's `sp`, which the engine grants after the damage; SP
     triggers (Lustrous Carmine, Frontiers, OBJ Edge of Lightness,
     Akekuri's P1) then miss that hit. Logs show Lustrous Carmine's ATK
     on the combo's hit 3 three times. kit-draft should emit it as a cast
     trigger at the hit's frame (a cast trigger at a hit's frame runs
     before the hit: checked in scratch), or the hit could take an
     `spBeforeDamage` flag. Likewise a HealAction after the DamageAction
     belongs one frame after the hit, not before it.
  2. The hover debuff (row 8) is reported as created, not emitted (D4).
  3. The explosion (an ability entity's passive: OnAddedBuff →
     delay_damage) isn't reached: the passive skill's attachment to the
     entity isn't in our tables. kit-draft lists
     `buff_chr_0033_camille_normal_skill_delay_damage` ×5 as a logged key
     missing from the draft, which points at it.
  4. ComboAction (Link) and HealAction aren't compiled (no `heals`, no
     Link buff).
  5. The retarget hit `abilityrange` is emitted as landing always (row 9).
  6. ChangeSkillAction / switchToBuffConfig with `buffs` → CastSkill
     (Hunter Pursuit's path) isn't followed: "nothing compiled:
     normal_skill_2".
- **impact:** item 1: up to +16.8% ATK (Lustrous Carmine at L9) missing on
  one hit per combo / ultimate in a kit copied from the draft; the others
  are hand-written once.

### G6. Reaction replay: landings that share an event key

- **family:** log tooling.
- **feature:** `zmdlogs reactions` (`kitHit` in reactioncheck.ts) takes
  the first kit hit whose `events` hold the logged key; when hits of one
  skill share a key but differ in `applies`, map the n-th logged landing
  of that key within a cast to the n-th kit landing (or use the kit hit
  `zmdlogs check` matched).
- **evidence:** 4e5e: Camille's ultimate logs 9 landings as
  `chr_0033_camille_ultimate_skill`; only hit 3 (52347 ms) inflicts Heat.
  Its burst at 53273 ms is "unexpected"; with a unique key for that one
  landing in a scratch fixture and kit, it matches (16 / 0 / 2).
- **impact:** log verification only; any skill whose landings share a key
  (most ultimates and combos) can hide its infliction from the replay.

## Unknowns

- **U1. Does talent 2 count a teammate's skill heal?** (G3) The data reads
  "receives a heal with a skill heal tag", from anyone. Interim: no. Test
  below.
- **U2. The explosion's "bateffect ≥ 2" check.** Read literally, the
  entity explodes only when a second `bateffect` stack is added within its
  1 s life. Both logs show an explosion after every combo and Hunter
  Pursuit on a hovering target (6 of 6, 0.29–0.34 s after the hit, longer
  where an ultimate's time stop came between: 40d9 9240 → 12951 ms across
  Gilberta's ultimate, 4e5e 58883 → 61070 ms; consistent with test 18's
  "time stops freeze buffs"). Settled: every one. The heal's target
  (selector CharacterTeamFinder + MainCharacterValidator on targetSource 1)
  is settled the same way: Camille's own talent-2 layers rise at every
  such combo.
- **U3. Hunter Pursuit's button and Link** (interim only, G1): whether
  pressing it consumes Link. Moot once G1 is done.
- **U4. A Heat Infliction that forms a reaction** for Lustrous Carmine's
  team Heat DMG (row 35): batch 1's open question (Arcane R3, test 35).
- **U5. Combustion ticks and the applier's buffs.** 4e5e: Camille's
  Combustion (65097 ms) ticks at 66004, 67447 and 68449 ms are ×1.043,
  ×1.044 and ×1.063 the prediction from the logged buffs; all three match
  exactly with `buff_wpn_lance_0015_dmgup` (logged at 65097, gone from the
  ticks) and, for the last, the talent-2 layer that ran out in between.
  So the ticks seem to keep the applier's bonuses from the reaction; the
  engine evaluates them at each tick. One log; another with a buff ending
  during Combustion would settle it (not testable by hand: sub-5%
  differences on DoT numbers).

## Verification

`zmdlogs check` and `zmdlogs reactions` with the draft kits in the scratch
copy (main checkout untouched):

| Fixture | Camille hits | Reactions |
|---|---|---|
| zmdlogs-40d9a3c1da37 (P3) | **6 of 6 match** (was 1 match, 5 not covered): battle skill, 3 combo hits, its explosion, the Heat burst | **3 matched / 0 / 0** (was 2 / 0 / 1) |
| zmdlogs-4e5e1390085e (P1, basic 9) | **61 match, 0 mismatch, 24 under unmodelled effects** (was 0 covered). The 24 are every hit from 49418 ms, which the fixture's hand annotation marks with an unquantified `buff_wpn_lance_0015_atkup`. With that annotation applied (+9.6% ATK) in a scratch copy: 82 of 85; the other 3 are Combustion ticks (U5), and with U5's reading 85 of 85 | **15 matched / 0 / 3** (was 8 / 1 / 10). Unexpected: Rossi's Lift (no kit), Camille's 53273 ms Heat burst (G6), Gilberta's 68873 ms Nature burst (not Camille's) |

The matches confirm: every frame-independent value (multipliers at both
skill levels, P1 and P3, the talent-2 values 0.04 / 0.01, Lustrous
Carmine at skill level 4: 0.096 / 0.096), the hover debuff on the battle
skill's own hit, Lustrous Carmine's Heat DMG on the inflicting hit itself,
its ATK on the SP-granting combo hit, and talent-2 layers only after the
combo's hit 3 (boundary). No fixture correction is needed. A provenance
note for 4e5e could add that its three Combustion ticks fit only with the
reaction-time buffs (U5).

Existing in-game tests that touch Camille: 8 (Link values; its set-up
needs a Link source after G2), 18 (time stops: the delayed explosions fit
it), 35 (U4), 38 (two Heat Susceptibilities: the Vesperwings' and e.g.
Antal's Focus), 47 (projectile travel: battle skill, attack 4, finisher),
51 (an effect on its own hit: the two logs answer it "yes" for an
abilityEvent-126 weapon effect, the handler Solemn Phalanx's INT buff
also uses).

Proposed in-game tests (not written to in-game-tests.md in this phase):

1. *Talent 2 from a teammate's heal* (U1, G3; ready if you have Camille
   and Liino, or another operator whose battle skill heals the team):
   Camille in the team, her combo not cast. Liino's battle skill (its
   soundwaves heal every 3 s). Data reading: Camille's Heat DMG buff icon
   (talent 2) appears with 2 stacks at the first soundwave and shows 5
   within about 6 s. Engine today: no icon until Camille's own combo.
   Medium priority (needs Camille).
2. *Where Link comes from* (G2; a variant of test 8, ready if you have
   Camille and Gilberta): Gilberta's ultimate on a dummy (a) with no combo
   before it, (b) right after a combo of anyone but Camille or Lifeng,
   (c) right after Camille's combo on a dummy with hovering Vesperwings
   (her battle skill first; talent 1 learned), (d) right after Camille's
   combo without them. Logs predict (a) = (b) = (d) and (c) ×1.20; the
   engine today gives (b) and (d) ×1.20 and (c) ×1.30. Compare the lower
   of two numbers each (crits). The four logged casts already decide (b);
   (c) vs (d) checks the talent's condition. High value (every team).

## Kit plan

Written as it would be today and **loaded with the real loader** from a
scratch copy (`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-camille/repo`,
node_modules linked to its own packages, `EFSIM_DATA_DIR` the main
checkout's data): `packages/data/kits/operators/chr_0033_camille.json` and
`packages/data/kits/equipment/{wpn_lance_0012,wpn_lance_0015,wpn_lance_0016}.json`
there. All load; `vitest run packages/data/test tests/logs.test.ts
tests/timeline.test.ts --testTimeout 120000` passes (587 tests; the
longer timeout only because ten agents share the machine). `efsim calc`
lists every hit; scratch scenarios (`examples/camille-scratch*.scenario.json`
there: Camille P5 with Laevatain, and with Gilberta) run battle skill →
Corrosion opens the combo → combo with explosion 0.4 s after hit 3, heal,
Link and two talent-2 layers → ultimate → Hunter Pursuit from the button
with its explosion and the Heat burst from the ultimate's infliction.

### Operator kit `chr_0033_camille`

Element `fire`. Hits as in the mechanics table (frames, keys, events,
poise and energy from kit-draft; the draft's `abilityrange` hit dropped).
Hand-written:

- **Buffs:** `vesperwings` (enemy; `gameBuff`
  `buff_chr_0033_camille_normal_skill_weak`; duration `{key: bat_duration,
  skill: normal_skill}`; modifiers attr 62 `weak_scale`, susceptibility
  fire `vulnerable_scale`); `hunter_state` (self, ultimate `duration`);
  `link` (team, `link: true`, duration `combo_duration` of the combo,
  `maxStacks: 4`); `bloodfount` (self, damageBonus fire `{talent: 1, key:
  atk_up}`, duration `{talent: 1, key: duration}`, `maxStacks: 5`);
  `bloodfount_team` (team, `recipients: {not: {isOwner: true}}`, value
  `{product: [{talent: 1, key: atk_up}, {talent: 1, key: teammate_rate}]}`).
- **Battle skill hit:** `launch: 12`, Heat infliction, `buffs: [{buff:
  vesperwings, beforeDamage: true}]`; `available: {not: {buffActive:
  hunter_state}}`.
- **Triggers** (each SP before its hit, each heal one frame after):

```json
{ "id": "combo_window", "on": { "event": "inflictionConsumed", "elements": ["fire"] }, "by": "anyone", "do": [{ "kind": "openCombo" }] },
{ "id": "combo_f47_sp", "on": { "event": "cast", "skills": ["chr_0033_camille_combo_skill"] }, "by": "self", "delay": 47, "awaited": true,
  "skill": "chr_0033_camille_combo_skill", "do": [{ "kind": "sp", "value": "atb" }] },
{ "id": "combo_f47", "on": { "event": "cast", "skills": ["chr_0033_camille_combo_skill"] }, "by": "self", "delay": 47, "awaited": true,
  "skill": "chr_0033_camille_normal_skill",
  "do": [
    { "kind": "buff", "buff": "link", "if": { "all": [{ "talentAtLeast": [0, 1] }, { "enemyBuff": "buff_chr_0033_camille_normal_skill_weak" }] } },
    { "kind": "hits", "if": { "enemyBuff": "buff_chr_0033_camille_normal_skill_weak" },
      "hits": [{ "id": "explosion", "scale": ["bat_atk_scale"], "frames": [12], "damageType": "battle", "element": "fire",
                 "events": ["buff_chr_0033_camille_normal_skill_delay_damage"] }] }
  ] },
{ "id": "combo_f48_heal", "on": { "event": "cast", "skills": ["chr_0033_camille_combo_skill"] }, "by": "self", "delay": 48,
  "do": [{ "kind": "heal", "target": "self", "healKind": "combo",
           "if": { "all": [{ "talentAtLeast": [0, 1] }, { "enemyBuff": "buff_chr_0033_camille_normal_skill_weak" }] } }] },
{ "id": "bloodfount", "on": { "event": "heal", "kinds": ["battle", "combo", "ultimate"] }, "by": "self",
  "if": { "talentAtLeast": [1, 1] }, "skill": "chr_0033_camille_passive_talent1",
  "do": [{ "kind": "buff", "buff": "bloodfount", "layers": 2 }, { "kind": "buff", "buff": "bloodfount_team", "layers": 2 }] },
{ "id": "hunter_on", "on": { "event": "cast", "skills": ["chr_0033_camille_ultimate_skill"] }, "by": "self", "delay": 118,
  "do": [{ "kind": "buff", "buff": "hunter_state" }] },
{ "id": "hunter_end", "on": { "event": "cast", "skills": ["chr_0033_camille_combo_skill_2"] }, "by": "self",
  "do": [{ "kind": "endBuff", "buff": "hunter_state" }] }
```

  plus the same pattern for Hunter Pursuit (`pursuit_f33` SP `atb`,
  `pursuit_f70_sp` `atb_ex`, `pursuit_f70` Link with `talentAtLeast [0, 1]`
  only and the explosion, `pursuit_f71_heal`) and the ultimate
  (`ult_f120` SP `atb`); the hits carry no `sp` where a trigger grants it.
- **Hunter Pursuit (G1 interim):** skill `chr_0033_camille_normal_skill_2`
  (`damageType: battle`, `available: {buffActive: hunter_state}`, no hits)
  and trigger `pursuit_button` (`on: cast normal_skill_2` → `{kind: cast,
  skill: chr_0033_camille_combo_skill_2}`); `combo_skill_2` with
  `damageType: combo`, `followUpOnly: true`. With G1: drop the button
  skill and trigger, give `combo_skill_2` `comboWindow: false` and
  `available: {buffActive: hunter_state}`.
- **Waiting on gaps:** G2 (the `link` buff stays; the engine stops adding
  its own stack), G3 (`bloodfount`: `toOwner: true`, `by: anyone`).

### Equipment kits

- **`wpn_lance_0015`** (Lustrous Carmine): team buffs
  `wpn_lance_0015.atk` (zone atk `atk_up`, `duration`) and
  `wpn_lance_0015.heat` (attr 51 `fire_dmg_up`, `duration2`), both with
  their `gameBuff`; triggers `on: {event: sp, natural: true, sourceTypes:
  [3]}` and `on: {event: inflictionApplied, elements: [fire], fromKinds:
  [battle, combo, ultimate]}` with `beforeDamage: true`, both `by: self`.
- **`wpn_lance_0012`** (Mountain Bearer): self buff
  `wpn_lance_0012.vulnerable_dmg` from `fightStart`
  (`{zone: damageBonus, value: dmg_up, if: {enemyVulnerable: 1}}`); self
  buffs `.attrs` / `.attrs2` (attrs 39–42, `percent: true`, `duration`);
  triggers `on: {event: vulnerable, fromKinds: [battle]}` and (G4 interim)
  `on: {event: buffApplied, gameBuffs:
  [buff_common_affixes_vulnerable_physical, buff_common_affixes_vulnerable_all]}`,
  both `cooldown: cd`. The attribute buffs do nothing until V4's residue
  (a main attribute's percentage reaching ATK; about +15% ATK for a wielder
  like Camille at L9) is done.
- **`wpn_lance_0016`** (Golden Age): self buff `.heal` (no modifiers:
  Treatment Efficiency) on `{event: hit, kinds: [combo]}`; team buff
  `.arts` (attrs 51–54 `spell_dmg_up`, `duration2`) on `{event: heal,
  toOthers: true, kinds: [combo]}`.

## Kit (2026-10-21)

Files: `packages/data/kits/operators/chr_0033_camille.json`;
`packages/data/kits/equipment/wpn_lance_0007.json` (Beacon of Duty, moved
here from Lifeng by the merge's "Weapon owners"), `wpn_lance_0015.json`
(Blessing of Lustrous Carmine), `wpn_lance_0016.json` (Golden Age);
Mountain Bearer (`wpn_lance_0012`) went to Lifeng. Tests:
`tests/kit-camille.test.ts` (20 tests); Camille added to OPERATORS in
`packages/data/test/skillCompile.test.ts` (no disagreement with the
compiled SkillData, so no KNOWN entry). Example:
`examples/camille-gilberta.scenario.json` with `examples/camille-p3.json`
(her 40d9 build). Fixture: a note on `fixtures/zmdlogs-40d9a3c1da37.json`
(what her kit explains; notes only, the build is right). No engine,
loader or compiler change.

### Re-analysis

Gaps:

| Gap | Status | How |
|---|---|---|
| G1 Hunter Pursuit from the battle-skill button | **done** (S7) | `combo_skill_2`: `comboWindow: false`, `available: {buffActive: hunter_state}`; the button skill `normal_skill_2` and its `cast` trigger are gone. `normal_skill` keeps `available: {not: {buffActive: hunter_state}}`. The cast is a combo cast by the player (`followUp: false`), uses no Link and leaves the regular combo's window and cooldown alone. The combo's (51–63) and the ultimate's (125–150) AllowNextSkill windows list the button `normal_skill_2`; since the follow-up after the kits, the loader adds the skill a button's switchToBuffConfig casts to every window listing the button, so Hunter Pursuit opens at 51 / 125 (it waited for 63 / 133 before) |
| G2 Link only from Link sources | **done** (B1) | trigger action `link` (`seconds: combo_duration`) at combo frame 47 (talent 1 and hovering Vesperwings) and Hunter Pursuit frame 70 (talent 1 only); the engine gives a combo no stack by itself |
| G3 talent 2 from heals Camille receives | **done** (T2) | `on: {event: heal, kinds: [battle, combo, ultimate], toOwner: true}`, `by: anyone` (the data's OnReceiveHeal). U1 (does a teammate's heal count?) stays for test 93: with Liino in the team her battle skill's heals fill all 5 layers (tested) |
| G4 Mountain Bearer's element filter | moved | T1 is done; the weapon is Lifeng's now. Beacon of Duty uses T1 here (`tags: [458037917]`) |
| G5 compiler leftovers | partly done | (1) SP before the damage: **done** (D8a, `spBeforeDamage` on combo hit 3, Hunter Pursuit hits 2 and 4, ultimate hit 3). (2) the hover debuff: still only reported (written by hand). (3) the explosion (entity passive): still not reached; kit-draft lists `…_delay_damage` as a logged key it lacks (hand-written triggers). (4) HealAction: now `heals: "self"`, but unconditional, while the data has it behind `talent_0` and the hover tag: the kit uses heal triggers instead; ComboAction still not compiled (hand-written `link`). (5) the retarget hit: **done** (now an event-driven note, not a landing). (6) the switch to Hunter Pursuit: still "nothing compiled: normal_skill_2" (S7 covers it by hand) |
| G6 reaction replay by landing | **done** (L1) | 4e5e's ultimate burst (53273 ms) now matches |

Mechanics rows not covered by the gaps: rows 1–8, 11–14, 16, 18, 20, 21,
23–27, 33–35, 41–43 as in the plan (row 37–40 are Lifeng's now). Row 15
(U2) settled by the logs: every combo and Hunter Pursuit on a hovering
target explodes. Row 28: slow-downs from SkillData; hit-stops (Ti1b) open.
Row 29 (U5): **done** by V2 (Combustion keeps the applier's side from its
application): 4e5e's three ticks match. Rows 9, 10, 32: n/a on one enemy.
Row 35's reaction-forming infliction: test 35 (U4).

Beacon of Duty rows (Lifeng's W1–W4): W1 stat panel; W2 `inflictionApplied`
[fire] from battle / combo / ultimate, `beforeDamage`; W3 **done** by T1:
`on: {event: buffApplied, tags: [458037917], fromKinds: [battle, combo,
ultimate]}` (Heat Susceptibility, an Arts or all-element one counts); W4
plain buffs (two wielders adding: B2's open part).

### What the kit models

- Basic chain, finisher (7 projectiles × 0.05 + 0.65), dive landing (not
  castable until dive attacks are rotation steps: it never fires in the
  scenarios).
- Battle skill: one hit at 12 (`launch: 12`), Heat Infliction, the
  Vesperwings debuff (Weakness and Heat Susceptibility, 45 s / P1 60 s)
  before its damage, team energy at 12.
- Combo: hits at 19 / 27 / 47; SP before hit 3; the explosion
  (`bat_atk_scale`, battle-skill DMG, 12 frames after hit 3) if the
  Vesperwings hover; with talent 1 on them, one Link stack and a heal one
  frame after hit 3 (detached from 47, so a cast cut after hit 3 still
  heals). Delays run on the cast's playhead: a teammate's time stop between
  hits moves them with the hits.
- Ultimate: 7 + 1 + 1 hits, Heat on the last, its SP before that hit;
  Hunter Pursuit armed at 118 for 15 s.
- Hunter Pursuit: four hits (20 / 33 / 49 / 70), SP before hits 2 and 4,
  energy at 70, Link and heal with talent 1 whatever the target, the
  explosion if hovering; ends the state at its frame 0.
- Talent 2: two Bloodfount layers per skill heal Camille receives (Heat DMG
  `atk_up` each, 40 s, max 5), a quarter for each teammate; P5 +0.06.
- Potentials from the data (P1 values and duration, P2 panel, P3 cooldown,
  multipliers and SP, P4 cost, P5 talent value).
- Lustrous Carmine: team ATK on natural skill SP (on the granting hit), team
  Heat DMG on a Heat Infliction from a skill (on the inflicting hit).
- Beacon of Duty: the wielder's Physical and Heat DMG on a skill's Heat
  Infliction; the team's on a skill's Heat Susceptibility (Camille's battle
  skill: both on its own hit).
- Golden Age: Treatment Efficiency on a combo hit (no damage effect); team
  Arts DMG when the wielder's combo heals someone else (never on Camille;
  on Liino when her combo heals the controlled operator).

Left out: projectile travel (Ti2, test 47), hit-stops (Ti1b), the retarget
path (one enemy), the bateffect ≥ 2 check (settled: always), heal amounts
(N2), the Weakness's effect on the enemy's damage (not modelled), and
Hunter Pursuit's window residue above.

### Verification

`zmdlogs check` (only Camille's lines changed; every other fixture's output
and every example total are the same as before the kit):

| Fixture | Camille hits | Reactions |
|---|---|---|
| 40d9a3c1da37 (P3) | **6 of 6 match** (was 1 match, 5 not covered); Gilberta's ultimate at 12951 ms: "Link 1 (predicted 1)" (was predicted 0) | **3 / 0 / 0** (was 2 / 0 / 1): her battle-skill Heat makes the 7663 ms burst |
| 4e5e1390085e (P1) | **62 match, 0 mismatch, 23 under unmodelled effects** (was 0 covered); with the fixture's hand annotation applied (Lustrous Carmine's ATK from 49418 ms) **85 of 85** (tested) | **16 / 0 / 2** (was 8 / 1 / 10). Left: Rossi's 12219 ms Lift (no kit yet) and Gilberta's 68873 ms Nature burst (not Camille's) |

One 4e5e match is a coincidence worth knowing: the ultimate's hit 3 at
52347 ms is reported "Link 1 (predicted 0)", but no Link source is within
15 s; the real fit is the annotation's ATK (×1.0958 on the ultimate's
other hits) times Frontiers' +16% boundary buff from that hit's own SP
(×1.0951 at her DMG-bonus sum 1.68): ×1.2000, the same as one Link stack.
With the annotation applied it matches without Link. The 23 unquantified
hits are the annotation's, as in the analysis (24 then: this one now fits a
variant).

Example `camille-gilberta` (P3, Gilberta P0, 20 s): 200,535 damage, 11,937
DPS over 16.80 s. Combo at 4.60 s on Gilberta's Corrosion,
explosion 0.4 s after hit 3, Link used by Gilberta's ultimate at 7.00 s
(×1.2), Hunter Pursuit at 11.17 s (125 frames after the ultimate), its
explosion at frame 82. Before the window rule it was 201,716 over 17.07 s:
Hunter Pursuit came 8 frames later, so its 0.6 s time stop fell after
Gilberta's ultimate hit, and its first hit (11.83 s now) found her
Anomalous Gravity Field and DMG Dealt +0.16 (5,061; now 3,786). A search
can still order them that way; this example's fixed rotation doesn't. Largest hits: Hunter Pursuit's last
(27k with Gilberta's field), the ultimate's last (9.7k), combo hit 3
(10.6k).

### In-game tests the kit depends on

- **8** (Link, rewritten for B1) and its Camille variant in batch-4.md
  ("Where Link comes from", (c) vs (d)): the talent-1 condition on the
  combo's Link.
- **93** (talent 2 from a teammate's heal): the kit counts it (the data's
  OnReceiveHeal).
- **35** (a reaction-forming infliction for Lustrous Carmine's and Beacon
  of Duty's infliction effects: the kit doesn't count it).
- **38** (two Heat Susceptibilities: the Vesperwings' and another's add).
- **47** (projectile travel: battle skill, attack 4, finisher).
- **18** (time stops freeze buffs and the delayed explosion: fits).
- **77** (Combustion snapshot, V2's ATK part).
