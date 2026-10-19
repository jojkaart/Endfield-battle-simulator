# Chen Qianyu (chr_0005_chen): gap report, batch 3

Operator: Chen Qianyu (`chr_0005_chen`, 5-star Guard, Physical, sword;
main attribute Agility, secondary Strength). Equipment (from
[batch-3.md](../batch-3.md)): weapons Sundering Steel (`wpn_sword_0005`) and
Fortmaker (`wpn_sword_0007`); no gear set.

Sources: rmxlinux 1.6 (the pinned submodule commit): SkillData
`chr_0005_chen_*` (attack1–5, power_attack, plunging_attack_start/end,
dash_attack, dodge, normal_skill, combo_skill, ultimate_skill, potential_1,
talent_0, talent_1, talent_1_1, talent_1_2), `sk_wpn_sword_0005`,
`sk_wpn_sword_0007`; BuffData `buff_chr_0005_chen_*` (combo_skill_mark,
combo_skill_tutorial_marker, potential_1, talent_0, talent_0_1, talent_1,
train_ultimate), `buff_wpn_sword_0005_atk_up_basic`, `_atk_up_up`,
`buff_wpn_sword_0007`; TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
AttributeMetaTable, I18nTextTable_EN. Chen's SkillData and BuffData were not
in the sparse checkout when this analysis started; they arrived during it
(commit 535e88f) and everything below is read from them. `efsim kit-draft
chr_0005_chen` was run on them. Log: `fixtures/pending/zmdlogs-7e19489ae503.json`
(§ Verification). Zero Sanity's `chen-qianyu/*.json` (MIT) was read as a
claim only; its ultimate gives every slash 15 Stagger, which the data
contradicts (row 13).

Values at skill level 12, talent level 2, unless said.

## Mechanics

`action $type`s per file (enabled ones; cameras, sounds, effects, root
motion, animation and voice left out): basic attacks: DamageAction,
ObtainCostAction (`atb`, only as the controlled operator), IfElse,
CheckMainCharacterCondition, CheckEntityNum, AllowNextSkillAction,
ComboCacheAction; attack5 adds ChannelingAction (16–21, maxCountPerTarget 1),
CheckSuperArmor, ModifyDynamicBlackboard (the `hit` once-flag);
power_attack: two DamageActions with BreakingAttackCalculation,
GainBreakingAttackAtb, CreateBuff (full immunity, disable-cast 0–30),
BreakInteractiveAction; normal_skill: StoreAttributeValue, AirborneAction ×2,
DamageAction (AtkScaleCalculation), CreateBuff `buff_common_obtain_ultimate_sp`;
combo_skill: EventListenerAction (abilityEvent 55 → SetSkillCdAtOnce),
AuraAction (AirborneAction, DamageAction, once ObtainCostAction `usp`),
TimeDilationAction ComboSkill, TemporaryUnlockAction; ultimate_skill:
UltimateTimeAction, TimeDilationAction (layer 1, RESETto1), InterruptAction,
7 DamageActions, CompareFloat + ModifyDynamicBlackboard (P5), CreateBuff
`buff_common_damage_immune_ult_skill`, ChannelingCastingAction 3.57 s.
The talent and potential SkillData files have no actions (their effects are
the attached BuffData). Damage, resources, state and timing come only from
the ones listed.

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4 (Soaring Break): `atk_scale` 0.23 / 0.54 / 0.30 / 0.34; landings 2 / 1 / 2 / 2 (`display_atk_scale` = 2 × `atk_scale` for 1, 3, 4) at frames 8, 11 / 7 / 9, 12 / 4, 10; mask 128; `atb` 0 | supported | draft hits; split hits name `events`. Logged counts agree (2/1/2/2 in 7e19) |
| 2 | Attack 5, Final Strike (mask 2097280) at frame 16 (ChannelingAction 16–21, one landing per target), `atk_scale` 0.9; poise unit `poise` 16 with onlyEnableForMainChar ("As the controlled operator, Final Strike also deals {poise} Stagger"); `atb` 18 once, only as controlled | data | `finalStrike`, `poise`, `poiseControlledOnly`; the draft leaves out the poise (D3). The third unit (hitEnvData 25) is environment damage, ignored |
| 3 | Finisher `power_attack` (mask 132): DamageActions at frame 5 and 29, BreakingAttackCalculation `multiplier` 0.2 / 0.8 of `atk_scale` 9.0; GainBreakingAttackAtb at 29; disable-cast 0–30 | data | two hits with `factor` 0.2 / 0.8 (draft: one hit ×2, no factors: D3) |
| 4 | Dive attack `plunging_attack_end` (1.8, mask 1152) | supported | not castable until rotations have jumps |
| 5 | Dash attack (`chr_0005_chen_dash_attack`, in SkillPatchTable, no skill group), dodge | supported | not rotation actions (as batch 1–2) |
| 6 | Battle skill Ascending Strike: frame 13, `atk_scale` 3.8, `poise` 10, cost 100 SP; team energy (`buff_common_obtain_ultimate_sp`) at 13; SkillData castData cooldownTime 25 is a file default (SkillPatchTable: 0); dontInterruptCombo | supported | draft hit + `teamEnergy` frame 13 |
| 7 | Battle skill Lift: AirborneAction **before** the DamageAction ("dealing Physical DMG and Lift"); the second AirborneAction after it (forceAirborne, deadOption 2) is a death launch | supported | `applies: [{kind: physicalStatus, status: lift}]` (applications come before the hit's damage) |
| 8 | Lift duration from the skill: `airborne` = `airborne_initial` (2.5 s at L12, 1 s at L1) + Strength × `airborne_coefficient` (0) × 0.01 (StoreAttributeValue attr 39); the combo's Lift has floatingDuration 0 | supported | the engine's Lift lasts 3 s; nothing reads a Lift's duration yet (no kit uses `enemyPhysical`), so no effect today. Noted for a future "Lifted enemy" condition |
| 9 | Combo trigger: "COMBO TRIGGER: When an enemy becomes Vulnerable." (game code) | supported | trigger `on: {event: vulnerable}`, `by: anyone`, `openCombo`. 7e19: both combos follow her own battle skill's first Vulnerable stack |
| 10 | Whether a stack added to an already Vulnerable enemy opens the window ("becomes" Vulnerable) | unknown | the plan opens it on every stack added (`vulnerable` fires per stack); in-game test C3 |
| 11 | Combo Soar to the Stars: AuraAction 17–27 along the dash, once per target: AirborneAction (Lift) then DamageAction `atk_scale` 2.7 (mask 12288, **no poise unit**), then `usp` 10 once per cast; cooldown 15 s (16 below L12); ComboSkill time dilation; AllowNext battle skill 23–40 | supported | draft hit + `applies` Lift; `energy: usp`. Logged: the combo hit and its Lift hit at the same ms (7335, 27753) |
| 12 | Combo EventListener 15–31 on abilityEvent 55 (an enemy Lifted: `buff_common_train_airborne` uses 55 as "airborne success") → SetSkillCdAtOnce isPercentage `cd_reduction` on skill type 64 | supported | inert: `cd_reduction` is 0 in the file and set by no table or buff |
| 13 | Ultimate Blade Gale: 6 slashes `atk_scale1` 0.81 at frames 58, 63, 68, 72, 76, 80; only the first has a poise unit (`poise_start` 15, "First Strike Stagger"), the others 0 | data | three hit entries (first slash with poise, five without); the draft has one ×6 entry, no poise (D3) |
| 14 | Ultimate final slash at 103: `atk_scale2` 10.23, `poise_final` 20; before it, if `potential5` = 1, ModifyDynamicBlackboard `atk_scale2` += `phy_up` | data | hit `scale: [atk_scale2]`; the draft writes `$atk_scale2?` (the compiler stops at the ModifyDynamicBlackboard: D3). `phy_up` is 0 in the file and set by nothing (only chr_0007_ikut's talent also names a `phy_up`), so P5's ultimate part adds 0 |
| 15 | Ultimate: cost 70 energy, cooldown 10 s, UltimateTimeAction, ChannelingCastingAction 3.57 s, InterruptAction (2 s on the target), damage immunity, AllowNext battle/combo | supported | SkillData / SkillPatchTable (engine). 7e19: the Endministrator's ultimate (35661) falls between her 6th and final slash and delays the final by its time stop (2.15 s logged vs 0.77 s in the data), as the engine models |
| 16 | Talent 1 Slashing Edge: "After hitting an enemy with skills, Chen gains ATK +{atk} for {duration}s. This effect can reach {max_stack} stacks." `buff_chr_0005_chen_talent_0` abilityEvent 13 (her damage landing) + CheckDamageDecorateMask checkType 2 mask 256 / 512 / 8192 → CreateBuff `buff_chr_0005_chen_talent_0_1` (attr 2 formulaItem 6 `atk` 0.04 / 0.08, `duration` 10, stackingType 8, max 5) | supported | layered self buff (`maxStacks`, loader's `sharedTimer`), trigger on her battle, combo and ultimate hits; values `{talent: 0, key}`. Per landing: an ultimate gives 5 layers. 7e19: the slashes' damage rises about 3.5% per slash (one layer each) |
| 17 | Talent 1 layer timer (stackingType 8): one timer that each new layer refreshes (B3, Endaxis's reading: batch 2's U3) | unknown | 7e19 contradicts the refresh: the buff is on every ultimate slash up to 33963 but gone on the final slash at 36117, 10.6 s after the battle skill that created it (25479) although the combo (27753) and six slashes added layers since. So the layers seem to expire with the first one. In-game test C4; affects Akekuri P1, Æthertech, MI Security too |
| 18 | Talent 2 Momentum Breaker: "Interrupting the enemy's charge up deals another {poise} Stagger." 5 / 10: `buff_chr_0005_chen_talent_1` abilityEvent 141 (only this file uses 141) → DamageAction with one poise unit `poise` (inheritFirstDamageMask) | gap | **G1**: enemies charge only as an instant event; no charging state, no interruption |
| 19 | P1 Shadowless: "DMG Dealt +{extra_dmg} to enemies below {hp_remain} HP." `buff_chr_0005_chen_potential_1` damageModifier: DamageScaleProcessor NormalCalcZone +`extra_dmg` 0.2, condition CheckHp isRatio compare 0 `hp_remain` 0.5, hpOwner targetSource 0 | unknown | the data reading needs **G2** (the enemy's HP). But 7e19 logs the buff (+0.2 damageBonus) on every Chen hit from t=5435, at about full HP (the fight is a kill: the team's damage, 2,292,898, is Rhodagn's Lv90 HP 2,292,909), and the damage fits only with it (without it her first hit of the fight would need three talent layers). Interim: always on (fightStart buff). In-game test C1 |
| 20 | P2 Heirloom Martial Arts: Agility +15, Physical DMG +8% | supported | stat panel (`efsim calc`: potential 2 15 and 8.0%) |
| 21 | P3 Dual-Wielding Swordmancer: ×1.1 on `atk_scale1`, `atk_scale2` (ultimate), `atk_scale` (battle, combo) | supported | loader (skillValue multiply); `calc`: 4.180, 2.970, 0.891, 11.253; 7e19's first battle skill fits 4.18 to 1.3% |
| 22 | P4 Improvised Chi Xiao: ultimate cost ×0.85 (skillParamModifier paramType 1) | supported | loader; the scratch simulation spends 59.5 |
| 23 | P5 Bonded with the World: combo cooldown −3 s (paramType 2, add), and `potential5` = 1 on the ultimate | supported | loader (cooldown 12 s); the ultimate part is inert (row 14) |
| 24 | Attribute nodes (Skirmisher): Agility +10 / +15 / +15 / +20 | supported | stat panel |
| 25 | `combo_skill_mark`, `combo_skill_tutorial_marker`, `train_ultimate` (training events), the talent/potential SkillData files (no actions) | supported | no effect on damage |
| 26 | Skill timing: windows, exclusive frames, dontInterruptCombo (battle skill, combo, finisher), combo time dilation, ultimate time stop | supported | SkillData (engine) |

**Weapons**

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 27 | Sundering Steel: Agility (`wpn_attr_agi_mid`), Physical DMG (`wpn_sp_attr_phydam_mid`), ATK +`atk_up1` 5–14% (`sk_wpn_sword_0005` cardAttributeModifier attr 2 formulaItem 6) | supported | stat panel (`calc`: ATK% 29.0% = Yinglung 15% + 14%; Physical DMG 42.7%) |
| 28 | Sundering Steel: "When the wielder deals a Physical Status, the wielder gains ATK +{atk_up2} for {duration}s. Max stacks for effects of the same name: {max_stack}. Duration of each stack is counted separately. Effect only triggers once every 0.1s." passiveEventActions abilityEvent 401 (no CheckPhysicalInflictionType: any physical status), CheckTimedMarkerCondition → CreateBuff `buff_wpn_sword_0005_atk_up_up` (attr 2 formulaItem 6 `atk_up2` 7.5–21%, `duration` 20 s, stackingType 2 max `max_stack` 2) and a TimedMarker for `cd` | supported | trigger `on: {event: physicalStatus}`, `by: self`, `beforeDamage`, `cooldown: "cd"` (0.1 s: the level table names the key `"cd "` with a trailing space, so the SkillData default 0.1 applies); layered buff `maxStacks: max_stack` (own timers) |
| 29 | Sundering Steel: does event 401 come for a status on an enemy without Vulnerable, which only adds a stack (Chen's first battle skill on a fresh enemy)? | unknown | the plan follows the engine (no `physicalStatus` event then, as Swordmancer's and Grizzled Edge's kits); Grizzled Edge's own Vulnerable ≥ 1 check on 401 hints that 401 comes anyway. In-game test C2 |
| 30 | Sundering Steel's ATK on the hit whose status raised it (401 runs inside the AirborneAction, which Chen's skills put before their DamageAction) | supported | `beforeDamage` (as Æthertech); the same question as in-game test 51 |
| 31 | Fortmaker: Intellect (`wpn_attr_wisd_mid`), Ultimate Gain Efficiency (`wpn_sp_attr_usgs_mid`), ATK +`atk_up` 5–14% and Arts Intensity +`phy_spell_up` 25–70 (`sk_wpn_sword_0007` cardAttributeModifier attr 2 formulaItem 6, attr 87 formulaItem 5): "ATK +{atk_up}. Arts Intensity +{phy_spell_up}." | supported | stat panel (`calc`: Arts Intensity 70); no passiveEventActions: a sources-only kit |
| 32 | `buff_wpn_sword_0007` and `buff_wpn_sword_0005_atk_up_basic` (referenced by no skill file); toggleBuffs `buff_wpn_passive_spirit_01` (no file, every weapon) | supported | inert |

**Log tooling**

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 33 | ZMDLogs lists a layered buff once: `buff_chr_0005_chen_talent_0_1` appears as one 0.08 entry on every hit, while the ultimate slashes rise one layer each (+3.5%) | gap | **G3** (log tooling) |

**Counts:** 33 rows: 23 supported, 2 gap (18, 33), 4 data (2, 3, 13, 14:
compiler leftovers, batch 2's D3), 4 unknown (10, 17, 19, 29), 0 unique?.
Gap entries: G1 behind row 18, G2 behind row 19's data reading, G3 behind
row 33. Nothing is unique: the charge interruption is the game's general
mechanism (every skill hit interrupts; only the extra Stagger is Chen's),
the enemy-HP condition is Alesh's too (his report's G3), and the rest maps
onto existing fields.

## Gaps

### G1. Enemy charges as a state, and interrupting them

- **family:** triggers (an extension of batch 2's E1, enemy actions from
  the scenario).
- **feature:**
  - `enemyActions` entries of kind `charge` get a length (`seconds`, the
    charge-up's duration; default unknown per enemy, so the scenario says)
    and the engine keeps an enemy **charging state** from the charge's
    start for that long.
  - A skill hit (battle skill, combo or ultimate kind: "Dealing Skill DMG is
    the only way to interrupt an enemy's charging state", I18n
    7822133759525754254; "Dealing DMG to an enemy in charging state with
    skills will interrupt them … and deals Stagger", −453802088936622969)
    landing during it ends the charge and emits `{type: "interrupt", frame,
    operator, kind}` (its hitter). Optional: an attack scripted as the
    charge's outcome is cancelled.
  - The game's own interruption Stagger (the tutorial's "deals Stagger";
    its value per enemy isn't in the tables we fetch) applied by the engine
    when known; until then 0.
  - Triggers `on: {event: "interrupt"}`, `by` as for hits. Chen's talent 2
    is then `{on: {event: "interrupt"}, by: "self", if: {talentAtLeast: [1,
    1]}, do: [{kind: "hits", hits: [{scale: [], scaleValue: 0, poise:
    {talent: 1, key: "poise"}, damageType: "none", …}]}]}` (a poise-only
    hit; it must not count as a damaging hit for other triggers), or a
    `poise` trigger action.
  - A predicate `enemyCharging: true` comes for free (Catcher's combo
    reads the start only).
- **evidence:** `buff_chr_0005_chen_talent_1` abilityEvent 141 →
  DamageAction (one unit, damageAttributeType 1, `poise`), talent text
  above; PotentialTalentEffectTable `chr_0005_chen_talent_2_1/_2_2`
  (`poise` 5 / 10). Batch 2's E1: `EnemyActionSpec` kind `charge` is a
  start frame only (timeline.ts); the ultimate's and Catcher's
  InterruptAction have "no effect on scripted enemy actions".
- **impact:** 10 Stagger per interrupted charge, and the interruption's own
  Stagger for every operator: the Staggered window (×1.3 damage taken in
  the logs' `buff_common_poise_break_damage_taken_scale`, finishers) comes
  earlier against charging bosses. Small for Chen's damage; not
  verifiable without charges in a scenario.

### G2. The enemy's HP

- **family:** conditions, with new state (the enemy's HP); batch 1's N1
  ("kills and HP") was deferred as having no effect against one enemy, but
  this one does. The same as Alesh's G3 (docs/kit-batches/batch-3/chr_0024_deepfin.md,
  his P5 and ultimate CheckHp `hp_tar`): one feature.
- **feature:** the enemy's HP over the fight: EnemyData attribute 1 at
  its level (Rhodagn Lv90: 2,292,909) minus the damage dealt so far
  (scenario option for the starting fraction, default full); a predicate
  `enemyHpAtMost: <fraction>` (CheckHp isRatio compare 0 on the damage's
  target, judged per hit), usable on a buff modifier's `if`. Chen's P1:
  `{zone: damageBonus, value: extra_dmg, if: {enemyHpAtMost: hp_remain}}`.
- **evidence:** `buff_chr_0005_chen_potential_1` damageModifier condition
  (CheckHp, hpOwner targetSource 0, isRatio, compare 0, `hp_remain` 0.5).
  Against it: 7e19 logs the buff on every hit from 5.4 s, and the damage
  fits with it (row 19). Either targetSource 0 isn't the target here, or
  the log's damage has another unlisted +20%; C1 decides whether G2 is
  needed for Chen at all.
- **impact:** if the data reading holds, the interim (always on)
  overstates her damage by 1 − 1.08/1.28 = 16% for the part of a fight
  above half HP (with Physical DMG +8% from P2 only; less with more DMG
  bonus); if the log reading holds, nothing.

### G3. Layered buffs that ZMDLogs lists once

- **family:** log tooling (with K6).
- **feature:** `zmdlogs check` counts a BuffData stackingType 8 buff
  (layers) as 1 to `maxStackCnt` layers, as it does for unlogged cast
  buffs, and reports the count it assumed; better, from the kit's own
  replay of the layers (talent triggers known). Otherwise every Chen hit
  after her second skill hit is mispredicted by 3.5–6% per missing layer.
- **evidence:** 7e19, the ultimate slashes 33152–33627: non-crit
  26636 → 27561 (+3.47%) and crit 37181 → 38568 (+3.73%) between
  neighbouring slashes with the same logged effects (one 0.08 entry); at
  1 + ATK% ≈ 2.3 on those hits, one 0.08 layer is +3.5%.
- **impact:** her logged hits can't match until the checker tries layer
  counts (all 21 mismatch today partly for this).

## Verification

**Log:** `fixtures/pending/zmdlogs-7e19489ae503.json` (Rhodagn Lv90, a
kill, parser v58): Chen P5, skills 12/12/12/12, Glorious Memory
(`wpn_sword_0017`, not this batch's; no kit), 3 × Type 50 Yinglung + Redeemer
gloves; team Ember (no kit), the Endministrator (P3), Pogranichnik (no kit).
21 of her hits (33% of the team's damage). In the scratch copy with the
draft kits: before 0 match, 2 unmodelled, 19 not covered (2% covered);
after **0 match, 21 mismatch, 0 not covered (100% covered)**. The other
three operators' lines don't change.

- **Confirmed structure:** every event key (attack1–5,
  normal_skill, combo_skill, ultimate_skill; the Lift as
  `buff_physical_airborne`), landing counts (2/1/2/2/1, battle 1, combo 1
  plus its Lift, ultimate 6 + 1), the combo's Lift on a Vulnerable enemy
  (7335 and 27753; `zmdlogs reactions` matches both; it also predicts a
  Lift hit at 25479 that isn't logged, because Ember's and Pogranichnik's
  kits are missing from the replay and Pogranichnik's Breach at 14984
  consumed the stacks), P3's ×1.1 (her first battle skill fits 4.18 to
  1.3% with no talent layer, as the log's boundary entry says), talent 1's
  value 0.08 and its layers rising per slash (G3), the Endministrator's
  crystal aura on teammates (talent 2 +20%, K6): attack5 at 12440, 144 ms
  after her combo sealed the enemy, is ×1.20 above Chen's other basic
  attacks, and the first four slashes are ×1.2 until the crystals are
  consumed at 33734.
- **With natural layer counts and the crystal aura added** (a fit in the
  scratch copy, `fit2.ts`): battle skill 0.987, the combo's Lift 0.979,
  all seven basic attacks 0.972, slashes 1–4 1.00–1.01; ratio
  logged / predicted. Left over:
  - a drift of about −0.75% per talent layer (0.987, 0.979, 0.972 at 0,
    1, 2 layers): it fits a true 1 + ATK% of about 1.57 instead of the
    panel's 1.35 with a base about 15% lower, i.e. the fixture's assumed
    build (weapon and gear levels aren't logged) is off, as the
    Endministrator's +180 ATK was (K7). Settle with Chen's in-game stat
    panel (test C5 below, with 55);
  - slashes 5–6 (after the crystals are consumed) ×1.106 and the final
    slash ×1.36 above the plan, unexplained (the final has no talent
    entry in the log at all: row 17);
  - the combos: ×1.34 / ×1.54, of which Type 50 Yinglung's unlogged combo
    bonus explains most (with 2 layers 1.022); Pogranichnik's
    `buff_wpn_sword_0012_atk_up` listed 7–9 times on one hit, the second
    battle skill at 0.959.
  These are build and log questions, not kit structure; the kit's values
  can't be called verified until the build is settled.
- Not in the log: the finisher, the dive attack, P1's HP condition (row
  19), talent 2, Sundering Steel, Fortmaker (no fixture has either
  weapon).

**Logs that would verify the rest:** Chen with Sundering Steel or
Fortmaker and known weapon / gear levels; a fight with a long stretch
below and above half HP split by time (P1); a finisher; a boss that
charges (talent 2, after G1).

**In-game tests** (new; checked against docs/in-game-tests.md: 51 is the
same question as row 30, 55 is the same kind as C5; none other covers
Chen). All by eye or stopwatch:

- **C1 P1 at full HP** (needs Chen at P1+): basic attack 1 on one enemy
  above half HP, then below (any enemy with an HP bar; no skill for 10 s
  before each, so no talent layers; take the lower of a few hits against
  crits). About ×1.19 lower above half HP if the condition holds (P2's
  8% only), equal if P1 is always on (as the log says).
- **C2 Sundering Steel on a fresh enemy:** Chen's battle skill on an
  enemy with no Vulnerability: does the weapon's ATK buff icon appear?
  Then a second battle skill (now Vulnerable, a real Lift): 1 or 2
  stacks? Prediction: plan = no icon after the first, 1 stack after the
  second; the other reading = 1 then 2.
- **C3 Combo trigger on an already Vulnerable enemy:** battle skill →
  combo (enemy at 2 stacks); wait until the combo's cooldown ends (12 s
  at P5, 15 s otherwise; Vulnerability lasts 20 s from the combo) and add
  a stack with a teammate's Lift or Knock Down: does Chen's combo light
  up? Plan: yes.
- **C4 Talent 1's timer** (settles batch 2's U3 for every stackingType 8
  buff): battle skill, then the combo about 8 s later; watch the talent's
  buff icon: does it vanish about 10 s after the battle skill (layers
  expire together with the first: the log's reading) or about 10 s after
  the combo (each layer refreshes the timer: the engine's B3)? An 8 s
  stopwatch difference. The icon's counter should show 1, then 2.
- **C5 Chen's ATK in the stat panel vs `efsim calc`** (as test 55), for
  the log's drift: send any build of hers with the panel.

## Kit plan

Written in a scratch copy of the repository
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0005_chen/repo`,
files `packages/data/kits/operators/chr_0005_chen.json`,
`packages/data/kits/equipment/wpn_sword_0005.json`,
`packages/data/kits/equipment/wpn_sword_0007.json`; copy of the main
checkout's working tree, taken after commit 7c7d00e). **All three load with the
real loader** (`efsim calc` on Chen with each weapon, `zmdlogs check`,
`kit-census`), and a solo scenario (battle skill, combo, ultimate, a basic
chain, battle skill + combo at 14 s; Sundering Steel, P5) simulates:
340,482 in 15 s, the combo window opening on her own Vulnerable stack,
talent layers rising per slash, cooldown 12 s, ultimate cost 59.5.

### Operator kit `chr_0005_chen.json`

- **Skills** (hits as rows 1–14; `damageType` per skill; frames from
  SkillData, so the loader's timing and the kit agree):
  - attack1–4: `scale [atk_scale]`, counts 2/1/2/2, frames as row 1.
  - attack5: `frames [16]`, `finalStrike`, `poise: "poise"`,
    `poiseControlledOnly`.
  - power_attack: `hit1` factor 0.2 at 5, `hit2` factor 0.8 at 29 (both
    `events: [chr_0005_chen_power_attack]`).
  - plunging_attack_end: frame 1.
  - normal_skill: `teamEnergy [{frame: 13, ratio: 1}]`, hit at 13 with
    `poise`, `applies: [{kind: physicalStatus, status: lift}]`.
  - combo_skill: hit at 17, `energy: "usp"`, `applies` Lift, no poise.
  - ultimate_skill: `slash1` (58, `poise: poise_start`), `slash` ×5
    (63, 68, 72, 76, 80), `final` (103, `scale [atk_scale2]`, `poise:
    poise_final`), all `events: [chr_0005_chen_ultimate_skill]`.
- **Buffs:**

  ```json
  { "id": "slashing_edge", "target": "self", "gameBuff": "buff_chr_0005_chen_talent_0_1",
    "duration": { "talent": 0, "key": "duration" }, "maxStacks": { "talent": 0, "key": "max_stack" },
    "modifiers": [{ "zone": "atk", "value": { "talent": 0, "key": "atk" } }] },
  { "id": "shadowless", "target": "self", "gameBuff": "buff_chr_0005_chen_potential_1",
    "modifiers": [{ "zone": "damageBonus", "value": { "key": "extra_dmg", "skill": "buff_chr_0005_chen_potential_1" } }] }
  ```

- **Triggers:** `combo_window` (`on: {event: vulnerable}`, `by: anyone`,
  `openCombo`); `slashing_edge` (`on: {event: hit, kinds: [battle, combo,
  ultimate]}`, `by: self`, `if: {talentAtLeast: [0, 1]}`, buff, after
  damage: the log's battle-skill hit has the layer as a boundary entry);
  `shadowless` (`on: fightStart`, `if: {potentialAtLeast: 1}`; the interim
  of row 19, replaced by an `if: {enemyHpAtMost: …}` on the modifier if C1
  says so, G2).
- **Waits on gaps:** talent 2 (G1: an `interrupt` trigger with a
  poise-only hit, `{talent: 1, key: "poise"}`); P1's condition (G2 / C1);
  the timer semantics of `slashing_edge` (C4: if layers don't refresh, the
  loader's `sharedTimer` for stackingType 8 changes for every kit using
  it); Lift durations (row 8) only when something reads them.

### Equipment kits

- `wpn_sword_0005.json` (Sundering Steel):

  ```json
  "buffs": [{ "id": "wpn_sword_0005.atk", "target": "self", "gameBuff": "buff_wpn_sword_0005_atk_up_up",
              "duration": "duration", "maxStacks": "max_stack", "modifiers": [{ "zone": "atk", "value": "atk_up2" }] }],
  "triggers": [{ "id": "wpn_sword_0005.on_status", "on": { "event": "physicalStatus" }, "by": "self",
                 "beforeDamage": true, "cooldown": "cd", "skill": "sk_wpn_sword_0005",
                 "do": [{ "kind": "buff", "buff": "wpn_sword_0005.atk" }] }]
  ```

  Wielder-relative: any physical status the wielder applies (Lift, Knock
  Down, Crush, Breach); row 29 (C2) decides whether a Vulnerable-only
  application counts too (then also `on: {event: vulnerable}` from a
  status, which needs the `vulnerable` event to say it came from a
  status: a filter on the event, triggers family).
- `wpn_sword_0007.json` (Fortmaker): sources only; everything is in the
  stat panel.
