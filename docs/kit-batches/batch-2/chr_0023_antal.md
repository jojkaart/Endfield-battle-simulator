# Antal (chr_0023_antal): gap report, batch 2

Operator Antal (Electric, Supporter: CharGrowthTable `charTypeId` Pulse,
`profession` 4, `mainAttrType` 41 Intellect, `weaponType` 2 Arts Unit,
rarity 4). Equipment covered here (owner of each, [batch-2.md](../batch-2.md)):
weapons `wpn_funnel_0002` Jiminy 12, `wpn_funnel_0001` Hypernova Auto,
`wpn_funnel_0003` Fluorescent Roc; gear sets `suit_pulse_cryst01` Pulser
Labs, `suit_will01` Mordvolt Resistant.

Sources: rmxlinux TableCfg CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, WeaponBasicTable,
EquipSuitTable, I18nTextTable_EN; Json/SkillData `chr_0023_antal_*`,
`sk_wpn_funnel_000{1,2,3}`, `passive_equipsuit_cpinflict_01`,
`passive_equipsuit_will_01`; Json/BuffData `buff_chr_0023_antal_*`,
`buff_wpn_funnel_000{1,2,3}`, `buff_equipsuit_cpinflict_01*`,
`buff_equipsuit_will_*`, `buff_common_affixes_*`. Values are at skill
level 12 / weapon skill level 9 unless stated. `efsim kit-draft
chr_0023_antal` was run on the main checkout; the kit plan below was
loaded and simulated from a scratch copy (see "Kit plan").

No committed log fixture has Antal; nothing here is checked against a log.

Claims from earlier notes, re-checked:
- *VulnerableAction / EnhancedAction `subType` 6 = Electric, 4 = Heat*
  (Liino's kit note says 6 and 3 are Electric and Nature): **confirmed**
  for 6 and 4 by Antal's own icon buffs: the ultimate's subType 6 child
  `buff_chr_0023_antal_ultimate_icon_2` has `_spritePath`
  `icon_battle_affix_pulse_enhance`, the subType 4 child
  `buff_chr_0023_antal_ultimate_icon` has `icon_battle_affix_fire_enhance`.
- *Tag −1748167886 is "Amp"* (batch-1 Arcane report, reading
  `buff_equipsuit_usp_02`): **only partly confirmed.** It is in the
  `applyTags` of `buff_common_affixes_enhance_all`, `_spell` and
  `_physical`, but **not** of `_enhance_pulse` or `_enhance_fire`
  (those carry −1046270741 and −1920931676 only). Matters for talent 1
  (row 26, U4).
- *Damage units with `damageAttributeType` 1 carry the stagger
  (`poiseCalculation`)* (batch-1 pass 3): consistent with every Antal file.

## Data overview

Action types per file that affect damage, resources, state or timing
(visual, camera, audio, root-motion and targeting actions left out):

| File | Relevant actions |
|---|---|
| `chr_0023_antal_attack1/2/3` | LaunchProjectile (→ `_projhit`), ModifyDynamicBlackboard `atk_scale` ×0.5 (attack3, once, before both launches), AllowNextSkillAction, ComboCacheAction |
| `chr_0023_antal_attack1/2/3_projhit` | DamageAction (mask 128), ObtainCostAction costType 1 `atb` if controlled |
| `chr_0023_antal_attack4` | ModifyDynamicBlackboard `atk_scale` ×0.5, 2 × LaunchProjectile → `attack4_powerattack_projhit`, AllowNextSkillAction |
| `chr_0023_antal_attack4_powerattack_projhit` | IfElse CheckTimedMarkerCondition `have_recovered` (`returnTrueIfNotExists`): no marker → DamageAction mask 2097280 (Final Strike) with poise unit (`onlyEnableForMainChar`), ObtainCostAction `atb`, CreateTimedMarker `have_recovered` 0.5 s; marker → DamageAction mask 128, no poise, no SP |
| `chr_0023_antal_power_attack` (skillSpecification 8) | 6 × LaunchProjectile (frames 10, 12, 14, 15, 16 → `power_attack02_projhit`; 25 → `power_attack_projhit`), CreateBuff `buff_common_power_attack_disable_cast_skill` 0–30, AllowNextSkillAction 32–48 |
| `chr_0023_antal_power_attack02_projhit` / `_projhit` | DamageAction BreakingAttackCalculation multiplier 0.06 / 0.7 (mask 132); ObtainCostAction `atb` / GainBreakingAttackAtb |
| `chr_0023_antal_plunging_attack_end` | DamageAction (mask 1152) |
| `chr_0023_antal_normal_skill` | frame 20: FinishBuffAction `buff_chr_0023_antal_normal_skill` (finishAll) → CreateBuffAction same (assigns `rate`, `duration`, `potential_3`, `potential_3_atb`, `potential_5`, `delay_time`, `potential_5_rate`) → DamageAction (mask 4352; poise unit, key `poise`, 0) → CreateBuff `buff_common_obtain_ultimate_sp`; HitStopAction 0.1 s; castData costType 1 (SP) |
| `buff_chr_0023_antal_normal_skill` | buffEvent 0 → CreateBuff child `buff_chr_0023_antal_tageffect` (passes all keys); 60 s, stackingType 7 max 2 |
| `buff_chr_0023_antal_tageffect` (Focus, head-bar icon) | buffEvent 0: 2 × VulnerableAction (subType 6, 4; `rate`; `duration`; enhancingList: + `potential_5_rate` while/when `buff_chr_0023_antal_talent_1_combotrigger` present); buffEvent 1 (interval tick, `triggerInterval` = `delay_time`, `waitFirstTriggerInterval`, `maxTriggerCnt` 1): if `potential_5` ≥ 1 → CreateBuff `talent_1_combotrigger` (0.1 s) on the enemy; buffEvent 2 → FinishBuff `talent_1_combotrigger`; abilityEvent 8 (owner defeated): if `potential_3` ≥ 1 → ObtainCostAction costType 1 `potential_3_atb` |
| `chr_0023_antal_combo_skill` (skillSpecification 4) | frame 21: InterruptAction → SwitchAction `EntityBB_combo_type` {0: Switch `EntityBB_combo_index` {0 SpellInfliction Heat, 1 Electric, 2 Cryo, 3 Nature}; 1: Switch `EntityBB_combo_index` {0 AirborneAction (not forced), 1 KnockDownAction, 2 FractureAction (Breach), 3 CrushAction damageMultiplier 1.0}; 2: DebugPrint "NA"} → DamageAction (mask 12288, poise unit) → ObtainCostAction costType 0 `usp`; TimeDilationAction ComboSkill 0.667 s (frames 0–17); AllowNextSkillAction 24–63 (battle skill) |
| `chr_0023_antal_ultimate_skill` (skillSpecification 5) | TimeDilationAction RESETto1, UltimateTimeAction 0–42; ChannelingCastingAction `cantCastSkill`, `cantSwitchPosition` 0–56; frame 49: CreateBuffAction `buff_chr_0023_antal_utimate_skill` on the whole team (assigns `duration`, `rate`); AllowNextSkillAction 56–73 |
| `buff_chr_0023_antal_utimate_skill` | buffEvent 0: 2 × EnhancedAction (subType 6, 4; `rate`; `duration`); stackingType 2 max 1 |
| `chr_0023_antal_talent_1` / `buff_chr_0023_antal_talent_1` | AuraAction → `buff_chr_0023_antal_talent_1_heal_trigger` on allies: abilityEvent 13 → CheckGlobalCDTimer, CheckTagMatch −1748167886 on the ally, CheckDamageDecorateMask (checkType 1, mask 8960 = battle + ultimate + combo), HealAction (`healvalue` + Strength × `multiplier`), AddGlobalCDTimer `cd` |
| `chr_0023_antal_talent_2` / `buff_chr_0023_antal_talent_2` | abilityEvent 101 (owner takes damage), not dashing, Physical → Probability → `buff_common_damage_immune_talent` 0.01 s, HealAction self |

Unreferenced files (nothing in SkillData or BuffData creates or launches
them): `chr_0023_antal_combo_skill_projhit`, `chr_0023_antal_attack4_projhit`,
`buff_chr_0023_antal_utimate_skill_delay`, `buff_chr_0023_antal_combo_fire`,
`buff_chr_0023_antal_combo_airborne` (the last two only from the unused
combo projhit). Left out.

Text (CharGrowthTable + I18nTextTable_EN):
- Basic "Exchange Current": "An attack with up to 4 sequences that deals
  Electric DMG. As the controlled operator, Final Strike also deals
  {poise:0} Stagger." + dive and finisher boilerplate.
- Battle skill "Specified Research Subject": "Applies Focus with a long
  duration on the enemy and deals Electric DMG. An enemy with an active
  Focus also suffers Electric Susceptibility and Heat Susceptibility.
  Focus can only be applied to 1 enemy at any given time."
- Combo "EMP Test Site": "COMBO TRIGGER: When an enemy with active Focus
  suffers a Physical Status or Arts Infliction. Triggers 1 energy explosion
  on the enemy that deals Electric DMG and applies another stack of the
  same Physical Status or Arts Infliction."
- Ultimate "Overclocked Moment": "Applies temporary Electric Amp and Heat
  Amp to the entire team."
- Talent 1 "Improviser": "After an Amped teammate's skill deals DMG, Antal
  restores the said teammate's HP by [{healvalue} + Strength×{multiplier}].
  This HP restoring effect triggers 1 time every {cd}s for each operator."
  (72 + 0.6 × Str / 108 + 0.9 × Str, cd 30.)
- Talent 2 "Subconscious Act": "Gains {probability:0%} chance of Physical
  DMG immunity and restores HP of self by [{healvalue} + Strength×{heal_scale}]."
- P1 "Arts Talent": Electric and Heat Amp ×1.1 (skillBbModifier `rate` ×1.1
  on the ultimate). P2 "Improved Automation": ultimate cost ×0.9. P3
  "Applied Originium Theory": "When an enemy with an active Focus debuff is
  defeated, return {potential_3_atb} SP" (15; `potential_3` set 1). P4
  "Granny's Reminder": Intellect +10, Max HP +10%. P5 "High Specs Tech
  Tester": "Applying Focus on the same target for {delay_time}s increases
  Electric Susceptibility and Heat Susceptibility effects by
  {potential_5_rate:0%}" (20 s, +0.04; `potential_5` set 1).

SkillPatchTable at level 12: attack1–4 `atk_scale` 0.52 / 0.63 / 0.77 /
1.15, attack4 `poise` 15, `atb` 15 (attack1–3 `atb` 0); finisher 9.0;
dive 1.8; battle skill `atk_scale` 2.0, `rate` 0.10, `duration` 60, cost
100 SP; combo `atk_scale` 3.4, `poise` 10, `usp` 10, cooldown 24 s (25 at
level 1); ultimate `rate` 0.20, `duration` 12, cost 100 energy, cooldown
20 s. `chr_0023_antal_dash_attack` has a SkillPatchTable entry but no
SkillData file and isn't in a skill group.

## Mechanics

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Attack 1–2: one projectile each, frames 8 / 12 (`_projhit` mask 128) | supported (data) | `hits[].scale`, `frames`, `events: [<file>_projhit]`, `detached`; the draft has them |
| 2 | Attack 3: two projectiles at 14 / 18, `atk_scale` ×0.5 once before both | supported (data) | `count: 2`, `factor: 0.5` (draft correct) |
| 3 | Attack 4: two projectiles at 27, ×0.5 each; the first (no `have_recovered` marker) is the Final Strike (mask 2097280) with `atb` 15 and `poise` 15 (controlled only), and sets the marker; the second (marker present, 0.5 s) is plain mask 128 | supported; **data** | two hits of count 1: `first` (`finalStrike: true`, `sp: atb`, `poise`, `poiseControlledOnly`) and `second` (`finalStrike: false`). The draft gives each branch `count: 2` (four landings): G3 |
| 4 | Finisher: 5 × `atk_scale` × 0.06 (frames 10, 12, 14, 15, 16) + 1 × 0.7 (25), mask 132; GainBreakingAttackAtb | supported; **data** | factors hand-written (D2: BreakingAttackCalculation `multiplier`). The draft's `sp: atb` names a key `chr_0023_antal_power_attack` doesn't have, so the draft fails to load (G3); finisher SP is the engine's |
| 5 | Dive attack `plunging_attack_end`, frame 1, mask 1152 | supported (damage) | not castable until rotations have jumps (S10 interim) |
| 6 | Dash attack (SkillPatchTable only) | n/a | no SkillData file, no skill group |
| 7 | Battle skill hit: `atk_scale` 2.0 at frame 20, mask 4352; poise key absent from SkillPatchTable (SkillData default 0) | supported (data) | one hit; no poise |
| 8 | Battle skill cost 100 SP; team energy from it at frame 20 (`buff_common_obtain_ultimate_sp`) | supported (data) | `teamEnergyFrame: 20` (draft has it) |
| 9 | Focus: Electric + Heat Susceptibility `rate` (0.10) for `duration` (60 s), created **before** the DamageAction (so the battle-skill hit itself has it); the old Focus is finished first (a re-cast replaces it) | supported; **data** | enemy kit buff `focus` (zone susceptibility, elements pulse + fire, value `rate`), hit `buffs: [{buff: focus, beforeDamage: true}]`; a plain buff replaces itself. The compiler doesn't emit created buffs (D2) |
| 10 | "Focus can only be applied to 1 enemy at any given time" (Focus marker on Antal, stackingType 7, FinishBuff finishAll) | n/a | one enemy |
| 11 | Battle skill HitStopAction (char_hard_stop, 0.1 s) | gap (known) | Ti1b hit-stop: open, interim not modelled ([batch-1.md](../batch-1.md#pass-2-whats-still-open)) |
| 12 | Combo trigger, infliction half: "an enemy with active Focus suffers … Arts Infliction" | supported | trigger `on: {event: inflictionApplied}`, `by: anyone`, `if: {buffActive: focus}` (buffActive sees own enemy buffs: timeline `st.buffs` owner = Antal), `openCombo` |
| 13 | Combo trigger, physical half: "… suffers a Physical Status" (the combo's switch covers Lift, Knock Down, Breach, Crush) | supported; **unknown** | `on: {event: physicalStatus}`, same `if`. Unknown: whether a physical-status action that only adds Vulnerable (no Vulnerable before, not forced: the engine emits only a `vulnerable` event) counts (U1) |
| 14 | Does an infliction that forms a reaction at once count? | unknown | interim: no (`inflictionApplied` excludes it), as for Arcane (in-game test 35) |
| 15 | Combo hit: `atk_scale` 3.4 at frame 21 (mask 12288), poise 10, `usp` 10 | supported (data) | `energy: usp`, `poise: poise` (draft lacks poise: D2) |
| 16 | Combo applies "another stack of the same … Arts Infliction": SwitchAction `EntityBB_combo_type` 0 → `EntityBB_combo_index` 0–3 → SpellInfliction Heat / Electric / Cryo / Nature, before the DamageAction | gap | G1. Interim `{kind: infliction, element: enemy}`: right while the triggering infliction is still the enemy's (usual case: then a burst); the draft emits all four inflictions unconditionally (G3) |
| 17 | Combo applies "another … of the same Physical Status": `combo_type` 1 → non-forced AirborneAction / KnockDownAction / FractureAction / CrushAction (damageMultiplier 1.0) | gap | G1. No interim: nothing physical is applied. The status rules (Lift / Knock Down land because the triggering one left Vulnerable; Breach / Crush after one that consumed Vulnerable only add a stack) are the engine's existing ones |
| 18 | Combo cooldown 24 s; ComboSkill slow-down 0.667 s; window to the battle skill 24–63 | supported (data) | engine reads SkillPatchTable and SkillData (Ti1, S3) |
| 19 | Ultimate: team Electric + Heat Amp `rate` (0.20) for `duration` (12 s), CreateBuff at frame 49 on every team member; no damage | supported | hitless skill (`hits: []`) + delayed cast trigger (`delay: 49`) → team buff `overclocked_moment` (zone amp, pulse + fire). Simulated: Antal's Electric hit ×1.200 under it, ×1.220 at P1 |
| 20 | Ultimate cost 100 (P2 ×0.9), cooldown 20 s, time stop 0–42, cantCastSkill / cantSwitchPosition channel 0–56, `buff_common_damage_immune_ult_skill` | supported (data) | engine reads them; the immunity is defensive (n/a) |
| 21 | P1: Amp ×1.1 (skillBbModifier `rate` modifyType 2 on the ultimate) | supported (data) | skill values after potentials (`panel.skillValues`) |
| 22 | P2: ultimate cost ×0.9 (skillParamModifier paramType 1) | supported (data) | stat panel / energy max |
| 23 | P3: 15 SP when an enemy with Focus is defeated (tageffect abilityEvent 8) | gap (deferred) | N1 kills: no effect against one enemy (the fight ends with it) |
| 24 | P4: Intellect +10, Max HP +10% | supported (data) | stat panel (`efsim calc`: "potential 4 10", "MaxHp potential 4 0.10") |
| 25 | P5: Focus held 20 s on one target → Susceptibility +0.04 (tageffect interval tick → 0.1 s `talent_1_combotrigger` named by the VulnerableActions' enhancingList); re-cast restarts it | supported; **unknown** | timer buff `focus_p5_timer` (duration `delay_time`: 0 below P5, so not applied), on its `buffEnded` a buff `focus_p5` (+`potential_5_rate`, for `duration` − `delay_time`), ended by the next battle skill at frame 20. Simulated: a hit at 25 s ×1.036 at P5 vs P0 (1.14 / 1.10), gone after a re-cast. Unknown: whether the enhancement holds for the rest of Focus or only while the 0.1 s buff lasts (U3) |
| 26 | Talent 1: heal an Amped teammate after their battle skill / combo / ultimate hit, once per 30 s per operator | gap (small) | G2 (an "operator is Amped" predicate). Interim: `if: {buffActive: overclocked_moment}` (Antal's own Amp reaches everyone), `cooldownPer: eventSubject`, `heal` to `eventOperator`. Heal amounts aren't modelled; only the heal event matters (heal triggers). Unknown whether his own Electric / Heat Amp carries the tag the data checks, and whether he heals himself (U4) |
| 27 | Talent 2: chance of Physical DMG immunity, self-heal when hit | n/a | defensive (incoming damage isn't modelled) |
| 28 | kit-draft output (rows 3, 4, 7, 15, 16, 17, 19 and the battle-skill hit's `sp: potential_3_atb`) | data | G3 |
| 29 | Jiminy 12 (3-star; two skills): Main Attribute +79 (`wpn_attr_main_low`); `sk_wpn_funnel_0002` cardAttributeModifier attr 2 formulaItem 7: ATK +33.6 flat | supported (data) | stat panel (`efsim calc`: "+ 33.60 flat"). `buff_wpn_funnel_0002` (formulaItem 5) is never created (toggleBuffs names `buff_wpn_passive_spirit_01`, which has no file): don't add it. Flat slot 7 isn't verified in game ([model.ts](../../../packages/engine/src/model.ts) Slot note) |
| 30 | Hypernova Auto: Intellect +93, Arts DMG +26% (stat panel); skill 3 "When the wielder's HP is above 80%, ATK +42%" (toggleBuffs `buff_wpn_funnel_0001` attr 2 formulaItem 6 while CheckCurHpRatio ≥ `hp_ratio_c`) | supported (interim) | equipment kit: `fightStart` → self buff `atk_up` without a duration. HP isn't modelled (no incoming damage), so full HP is assumed (N1, deferred) |
| 31 | Fluorescent Roc: Will +93, ATK +23.4% (stat panel); skill 3 "When the wielder's battle skill hits the enemy, the wielder gains ATK +33.6% for 20s" (abilityEvent 302 + CheckDamageDecorateMask mask 256 → `buff_wpn_funnel_0003`, stackingType 4) | supported | equipment kit: `on: {event: hit, kinds: [battle]}`, `by: self` → self buff (`duration` from the skill, 20 s; a plain buff refreshes). Simulated |
| 32 | Pulser Labs: Arts Intensity +30 (cardAttributeModifier attr 87) | supported (data) | stat panel ("Pulser Labs set (3 pieces) 30") |
| 33 | Pulser Labs: "After the wearer applies Electrification, the wearer gains Electric DMG +50% for 10s; after the wearer applies Solidification, Cryo DMG +50% for 10s" (abilityEvent 102 + CheckBuffIdInContext tags 1466867135 / 1535684437 → `_elecdamageadd` attr 52, `_crystdamageadd` attr 53, stackingType 2 max 1; `duration` / `duration2` 10 from SkillPatchTable, BuffData default 8) | supported | equipment kit: two triggers `on: {event: reaction, statuses: [electrification] / [solidification]}`, `by: self` → self buffs (`attr: 52` / `53`). Forced reactions count (the tag is on the status buff) |
| 34 | Mordvolt Resistant: Will +50 (cardAttributeModifier attr 42; SkillData default 70 is overridden by the table) | supported (data) | stat panel ("Mordvolt Resistant set (3 pieces) 50") |
| 35 | Mordvolt Resistant: "When the wearer's HP is below 50%, Treatment Effect +30%" (toggleBuffs `buff_equipsuit_will_healrt_01` attr 29) | n/a | heal amounts and HP aren't modelled (N1). `buff_equipsuit_will_01` (`will` 200) is passed a key the skill doesn't have (`will` → `wil`) and has no modifiers: inert |

Counts (35 rows, by primary status): **supported 24** (rows 1–5, 7–9,
12, 13, 15, 18–22, 24, 25, 29–34; 13 of them "supported (data)": the
stat panel or SkillData has them, and rows 3, 4, 9 also need hand-written
values the compiler misses), **gap 5** (rows 16, 17: G1; row 26: G2;
row 11: known Ti1b, open; row 23: N1, deferred), **data 1** (row 28: G3),
**unknown 1** (row 14; three other rows carry an unknown too: 13 U1,
25 U3, 26 U4), **unique? 0**, **n/a 4** (rows 6, 10, 27, 35).

Nothing is unique: Focus is an ordinary enemy debuff; the combo's
"same as the trigger" application is shared with Fluorite and Arcane (G1);
the P5 timer uses existing buff and trigger features.

## Gaps

### G1. A combo's application taken from the event that opened its window

- **family:** triggers (the window's event carried into the combo), with
  arts state and physical state (the application kinds).
- **feature:** `openCombo` records, beside `count`, what the opening event
  was: `{kind: "infliction", element}` for `inflictionApplied` (and
  `inflictionConsumed`, `burst`), `{kind: "physical", status}` for
  `physicalStatus`, nothing for others. New application values:
  `{kind: "infliction", element: "event"}` and
  `{kind: "physicalStatus", status: "event"}`: resolved, for a combo's
  hits, against the window's recorded event, and for a trigger's `apply`
  against the trigger's own event (same rule as ValueExpr `eventCount`).
  When the event isn't of that kind (an infliction-opened window and a
  `status: "event"` application, or no event), the application does
  nothing, so a kit lists both and exactly one acts:
  `applies: [{kind: infliction, element: event}, {kind: physicalStatus, status: event}]`.
  When several events open or refresh the window before the cast, the
  latest one counts (the game overwrites `EntityBB_combo_*` each time it
  fires: assumed, U5). `forced` stays false (the combo's actions aren't
  forced).
- **evidence:** `chr_0023_antal_combo_skill` frame 21: SwitchAction
  `choice` `EntityBB_combo_type` {0: inflictions by `EntityBB_combo_index`
  0 Heat, 1 Electric, 2 Cryo, 3 Nature; 1: AirborneAction (no
  `forceAirborne`), KnockDownAction, FractureAction, CrushAction by the
  same index; 2: DebugPrint "NA"}, before the DamageAction. Text: "applies
  another stack of the same Physical Status or Arts Infliction".
  `EntityBB_combo_index` occurs elsewhere only in
  `chr_0022_bounda_combo_skill` (Fluorite: SwitchAction → SpellInfliction
  Cryo / Nature; her text "of the element already on the enemy", so
  `element: "enemy"` suits her). Arcane's WILL combo (batch-1 A6, interim
  "the enemy's current", in-game test 33) is the same question.
- **impact:** every Antal combo. Infliction-opened windows: the interim
  `element: "enemy"` is right unless the infliction changed between the
  window and the landing (a reaction consumed it: no infliction is
  applied instead of a fresh one). Physical-opened windows: no second
  Lift / Knock Down (a 120% ATK physical-status hit with Arts Intensity,
  +1 Vulnerable, 10 × (1 + AI/200) stagger, and a Shatter on a Solidified
  enemy), no Vulnerable stack after a Crush / Breach; and if the enemy
  also carries an infliction, the interim applies it instead, a spurious
  160% ATK burst. In a physical team (Lift / Knock Down operators) every
  combo is wrong in kind.

### G2. "The operator has an Amp" (a buff of a zone on an operator, from anyone)

- **family:** conditions.
- **feature:** a predicate `operatorModifier: {zone, element?}`, the
  operator-side twin of `enemyModifier`: true when an active buff from
  anyone that reaches the operator in context has a modifier in that zone
  (an all-element one counts for any element). Used inside `eventOperator`
  for "an Amped teammate's skill":
  `if: {eventOperator: {operatorModifier: {zone: "amp"}}}`. It reads kit
  buffs only (as `buffApplied` categories do), so Amps written as kit
  buffs count.
- **evidence:** `buff_chr_0023_antal_talent_1_heal_trigger` abilityEvent
  13: CheckTagMatch −1748167886 on the aura's owner (the teammate),
  CheckDamageDecorateMask mask 8960. Text: "After an Amped teammate's
  skill deals DMG". Today `buffActive` names one of the trigger owner's own
  buffs and can't see another operator's Amp.
- **impact:** heal events only (amounts aren't modelled): heal-triggered
  effects of Antal's own equipment or teammates' kits fire too rarely when
  the Amp is someone else's (Liino's Cosmovoice, Electric / Heat Amp
  weapons). No damage effect on Antal himself. Interim (row 26) covers his
  own Amp.

### G3. Compiler leftovers seen on Antal

- **family:** data compilation (D2 continued).
- **feature:** `kit-draft` / `compileSkill` should
  1. treat a SwitchAction on `EntityBB_combo_*` as a branch it can't
     decide: report the options with their values instead of emitting
     every option's SpellInfliction unconditionally, and include the
     physical options (AirborneAction, KnockDownAction, FractureAction,
     CrushAction) once G1 exists (`element: event` / `status: event`);
  2. split landings of one projectile file whose damage sits in both
     branches of an IfElse on a timed marker the first landing sets
     (`have_recovered`): one landing per launch, the first in the
     no-marker branch (count 1 each, not 2 + 2);
  3. not attach an ObtainCostAction found in a created buff's
     `abilityEventAction` (here abilityEvent 8, enemy defeated) to the
     skill's hit as `sp` (`potential_3_atb` on the battle skill);
  4. only emit `sp: atb` when the kit skill has an `atb` value
     (`chr_0023_antal_power_attack` doesn't; its projectile file does), so
     the draft loads;
  5. the known D2 items: BreakingAttackCalculation multipliers (0.06,
     0.7), poise (combo 10, attack4 15 controlled-only), created buffs (the
     battle skill's Focus, the ultimate's team Amp at frame 49).
- **evidence:** the draft (`efsim kit-draft chr_0023_antal`): attack4 hits
  `powerattack_projhit` and `_2` each `count: 2, frames: [27, 27]`; combo
  `applies` all four inflictions; normal_skill `sp: "potential_3_atb"`;
  ultimate "nothing compiled". Loaded as a kit it fails in the loader's key check (`checkKey`):
  `chr_0023_antal_power_attack` has no value `atb` at level 1.
- **impact:** none on numbers once the kit hand-writes them; the
  per-hand values are listed in the kit plan.

## Unknowns (for in-game tests)

- **U1. Does a Vulnerable-only physical status open the combo?** A non-forced
  Lift / Knock Down / Crush / Breach on an enemy without Vulnerable only
  adds a stack (status.ts). The data's switch has no "Vulnerable" option;
  interim: no. One combo more or less per such application.
- **U2. Does an infliction that forms a reaction count?** Interim no
  (in-game test 35 asks it for Arcane).
- **U3. P5's enhancement:** for the rest of that Focus (interim) or only
  during the 0.1 s `talent_1_combotrigger`? ±4 points of Electric / Heat
  Susceptibility for up to 40 s per Focus.
- **U4. Talent 1:** does Antal's own Electric / Heat Amp make a teammate
  "Amped" (the checked tag isn't on `buff_common_affixes_enhance_pulse` /
  `_fire`), and does he heal himself? Heal events only.
- **U5.** When several events refresh the combo window, which one's
  element / status the combo applies (latest assumed). Rare.
- Two Electric (or Heat) Amp sources (Antal + Liino), or Antal's Electric
  Susceptibility with another's: added (engine) or the larger? Same
  question as in-game test 38, for Amp too.

## Verification

No committed fixture has Antal. Logs that would check him, in order of
value:

1. **Antal + an infliction teammate** (Laevatain's ult chain for Heat,
   Estella's battle skill for Cryo, Gilberta's explosion for Nature):
   battle skill (does its own hit already have Focus's 10%: row 9's
   `beforeDamage`), combo opened by the teammate's infliction (its key
   `chr_0023_antal_combo_skill` and the burst
   `buff_common_<e>_<e>_triggered` under Antal: G1 interim), ultimate Amp
   on the Heat teammate's hits (×1.20 / ×1.22 at P1). Focus should show as
   `buff_common_affixes_vulnerable_pulse` / `_fire` on the enemy, the Amp
   as `buff_common_affixes_enhance_pulse` / `_fire` (to be confirmed: the
   log names were not seen).
2. **Antal + a Lift / Knock Down teammate** (Estella's or Gilberta's
   forced Lift, a Knock Down operator from batch 2): a combo opened by a
   physical status, and whether Antal's combo logs `buff_physical_airborne`
   / `_knockdown` under him (G1 physical).
3. **P5 Antal** with Focus held > 20 s and a teammate's Electric or Heat
   hits before and after 20 s, and after a re-cast (U3).
4. Equipment: Fluorescent Roc (`buff_wpn_funnel_0003` after the battle-skill
   hit, 20 s), Hypernova Auto (ATK +42% from the start), Jiminy 12 (flat
   ATK in the panel); Pulser Labs needs a wearer that applies
   Electrification or Solidification (Antal himself rarely does: his combo
   repeats the enemy's element, a burst, not a reaction).

In-game tests: 35 (U2) exists; new ones to add (proposed here, not
written to in-game-tests.md in this phase):
- *Antal's combo on a Vulnerable-only physical status* (U1): Focus on a
  dummy without Vulnerable, a teammate's non-forced Lift or Knock Down
  (it only adds Vulnerable): is the combo lit?
- *Antal's P5* (U3): at P5, Focus a dummy, then a teammate's Electric hit
  at ~10 s, ~25 s, ~45 s without re-casting: does the +4% appear at 20 s
  and stay?
- *Antal's combo after a physical trigger* (G1, confirmation): a
  teammate's Lift on a Focused dummy, then the combo: is the dummy Lifted
  again (a second Lift damage number)?
- *Talent 1 under his own ultimate* (U4, lower priority): a teammate's
  battle skill under Overclocked Moment: does a heal number appear?

## Kit plan

Written as it would be today and **loaded with the real loader** from a
scratch copy of the repository (the main checkout untouched):
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch2/scratch-chr_0023_antal/repo/packages/data/kits/operators/chr_0023_antal.json`
and `…/repo/packages/data/kits/equipment/{wpn_funnel_0001,wpn_funnel_0003,suit_pulse_cryst01}.json`.
All load ("loaded: 9 skills, 6 triggers, 4 buffs"); `vitest run
packages/data/test/kits.test.ts packages/data/test/skillCompile.test.ts`
passes there (159 tests). Simulated with Gilberta (her Nature explosion
under Focus opened the combo; Antal's combo applied Nature, a Nature
burst), and with scripts checking the Amp (×1.200, P1 ×1.220) and P5
(×1.036 at 25 s, gone after a re-cast).

### Operator kit `chr_0023_antal`

Element `pulse`. Skills (frames from the draft; the hand-written parts
marked):

| Skill | Hits |
|---|---|
| attack1 | `projhit`: `atk_scale`, frame 8, events `chr_0023_antal_attack1_projhit`, `sp: atb`, detached |
| attack2 | `projhit`: frame 12, `_attack2_projhit`, `sp: atb`, detached |
| attack3 | `projhit`: count 2, frames 14, 18, `_attack3_projhit`, factor 0.5, `sp: atb`, detached |
| attack4 | `first`: frame 27, `_attack4_powerattack_projhit`, factor 0.5, `sp: atb`, `poise: poise`, `poiseControlledOnly`, `finalStrike: true`; `second`: frame 27, same event, factor 0.5, `finalStrike: false` (hand: G3.2) |
| power_attack | `small`: count 5, frames 10, 12, 14, 15, 16, `_power_attack02_projhit`, factor 0.06; `final`: frame 25, `_power_attack_projhit`, factor 0.7 (hand: D2, no `sp`) |
| plunging_attack_end | `hit`: frame 1, `sp: atb` (not castable: S10) |
| normal_skill | `teamEnergyFrame: 20`; `hit`: frame 20, `buffs: [{buff: focus, beforeDamage: true}, {buff: focus_p5_timer, beforeDamage: true}]` (no `sp`: G3.3) |
| combo_skill | `hit`: frame 21, `energy: usp`, `poise: poise`, `applies: [{kind: infliction, element: enemy}]` (interim; with G1: `[{kind: infliction, element: event}, {kind: physicalStatus, status: event}]`) |
| ultimate_skill | `hits: []` |

Buffs and triggers (as loaded):

```json
"buffs": [
  { "id": "focus", "label": "Focus: Electric and Heat Susceptibility", "target": "enemy",
    "gameBuff": "buff_chr_0023_antal_tageffect", "duration": "duration",
    "modifiers": [{ "zone": "susceptibility", "elements": ["pulse", "fire"], "value": "rate" }] },
  { "id": "focus_p5_timer", "label": "Focus: 20 s on the same target (P5 timer)", "target": "enemy",
    "duration": "delay_time", "modifiers": [] },
  { "id": "focus_p5", "label": "Focus held 20 s (P5): Susceptibility +", "target": "enemy",
    "duration": { "sum": ["duration", { "product": [-1, "delay_time"] }] },
    "modifiers": [{ "zone": "susceptibility", "elements": ["pulse", "fire"], "value": "potential_5_rate" }] },
  { "id": "overclocked_moment", "label": "Overclocked Moment: team Electric and Heat Amp", "target": "team",
    "gameBuff": "buff_chr_0023_antal_utimate_skill", "duration": "duration",
    "modifiers": [{ "zone": "amp", "elements": ["pulse", "fire"], "value": "rate" }] }
],
"triggers": [
  { "id": "combo_infliction", "on": { "event": "inflictionApplied" }, "by": "anyone",
    "if": { "buffActive": "focus" }, "do": [{ "kind": "openCombo" }] },
  { "id": "combo_physical", "on": { "event": "physicalStatus" }, "by": "anyone",
    "if": { "buffActive": "focus" }, "do": [{ "kind": "openCombo" }] },
  { "id": "ultimate_amp", "on": { "event": "cast", "skills": ["chr_0023_antal_ultimate_skill"] }, "by": "self",
    "delay": 49, "skill": "chr_0023_antal_ultimate_skill", "do": [{ "kind": "buff", "buff": "overclocked_moment" }] },
  { "id": "p5_bonus", "on": { "event": "buffEnded", "buff": "focus_p5_timer" }, "by": "self",
    "skill": "chr_0023_antal_normal_skill", "do": [{ "kind": "buff", "buff": "focus_p5" }] },
  { "id": "p5_reset", "on": { "event": "cast", "skills": ["chr_0023_antal_normal_skill"] }, "by": "self",
    "delay": 20, "do": [{ "kind": "endBuff", "buff": "focus_p5" }] },
  { "id": "talent1_heal", "on": { "event": "hit", "kinds": ["battle", "combo", "ultimate"] }, "by": "anyone",
    "if": { "all": [{ "talentAtLeast": [0, 1] }, { "buffActive": "overclocked_moment" }] },
    "cooldown": { "talent": 0, "key": "cd" }, "cooldownPer": "eventSubject",
    "do": [{ "kind": "heal", "target": "eventOperator" }] }
]
```

Notes:
- The P5 timer works because a re-applied plain buff replaces the old one
  without a `buffEnded` event, so `focus_p5_timer` only "ends" by running
  out 20 s after the last Focus; below P5 `delay_time` is 0 and the timer
  isn't applied. `p5_reset` is a non-detached delayed cast trigger, so a
  battle skill cut before frame 20 keeps the bonus, as the game's
  FinishBuff at frame 20 would. The battle-skill hit at frame 20 may still
  see the old `focus_p5` (order of a delayed action and a hit in one
  frame): at most one hit +4%.
- `talent1_heal` waits on G2 to read other operators' Amps; replace its
  `buffActive` by `{eventOperator: {operatorModifier: {zone: "amp"}}}`.
- No `takesControl` on the ultimate (its text doesn't say so).
- Energy: max 100 (90 at P2); combo `usp` 10; the battle skill's team
  energy at frame 20. No RefrainObtainUsp anywhere in his files.

### Equipment kits

- **wpn_funnel_0002 Jiminy 12:** no kit (stat-panel effects only).
- **wpn_funnel_0001 Hypernova Auto:**
  ```json
  "buffs": [{ "id": "wpn_funnel_0001.atk_up", "label": "Start of a Saga: ATK up (HP above 80%)", "target": "self",
              "gameBuff": "buff_wpn_funnel_0001", "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
  "triggers": [{ "id": "wpn_funnel_0001.full_hp", "on": { "event": "fightStart" }, "by": "self",
                 "skill": "sk_wpn_funnel_0001", "do": [{ "kind": "buff", "buff": "wpn_funnel_0001.atk_up" }] }]
  ```
  Waits on HP (N1) to switch off below 80%.
- **wpn_funnel_0003 Fluorescent Roc:**
  ```json
  "buffs": [{ "id": "wpn_funnel_0003.atk_up", "label": "Emergency Boost: ATK up", "target": "self",
              "gameBuff": "buff_wpn_funnel_0003", "duration": "duration",
              "modifiers": [{ "zone": "atk", "value": "atk_up" }] }],
  "triggers": [{ "id": "wpn_funnel_0003.battle_hit", "on": { "event": "hit", "kinds": ["battle"] }, "by": "self",
                 "skill": "sk_wpn_funnel_0003", "do": [{ "kind": "buff", "buff": "wpn_funnel_0003.atk_up" }] }]
  ```
- **suit_pulse_cryst01 Pulser Labs:**
  ```json
  "buffs": [
    { "id": "suit_pulse_cryst01.electric_dmg", "label": "Electric DMG up (after applying Electrification)", "target": "self",
      "gameBuff": "buff_equipsuit_cpinflict_01_elecdamageadd", "duration": "duration",
      "modifiers": [{ "attr": 52, "value": "pulse_dmg_up" }] },
    { "id": "suit_pulse_cryst01.cryo_dmg", "label": "Cryo DMG up (after applying Solidification)", "target": "self",
      "gameBuff": "buff_equipsuit_cpinflict_01_crystdamageadd", "duration": "duration2",
      "modifiers": [{ "attr": 53, "value": "cryst_dmg_up" }] }
  ],
  "triggers": [
    { "id": "suit_pulse_cryst01.electrification", "on": { "event": "reaction", "statuses": ["electrification"] }, "by": "self",
      "skill": "passive_equipsuit_cpinflict_01", "do": [{ "kind": "buff", "buff": "suit_pulse_cryst01.electric_dmg" }] },
    { "id": "suit_pulse_cryst01.solidification", "on": { "event": "reaction", "statuses": ["solidification"] }, "by": "self",
      "skill": "passive_equipsuit_cpinflict_01", "do": [{ "kind": "buff", "buff": "suit_pulse_cryst01.cryo_dmg" }] }
  ]
  ```
- **suit_will01 Mordvolt Resistant:** no kit (Will +50 in the stat panel;
  the Treatment Effect below 50% HP isn't modelled). A kit file can be
  added for completeness of "every gear set has a kit" with only its
  `sources`, if the batch wants one.
