# Xaihi (chr_0011_seraph): gap report, batch 3

Operator Xaihi (Supporter, Cryo, Arts Unit: CharGrowthTable `profession`
4, `charTypeId` Cryst, `weaponType` 2; main attribute Will 42, secondary
Intellect 41), with the weapons Freedom to Proselytize (`wpn_funnel_0012`)
and OBJ Arts Identifier (`wpn_funnel_0014`), both weaponType 2, and the
gear set AIC Light (`suit_wisdwill01`) ([batch-3.md](../batch-3.md)).

Sources (rmxlinux): SkillData `chr_0011_seraph_*` (29 files), BuffData
`buff_chr_0011_seraph_*` (31 files), `sk_wpn_funnel_0012`,
`sk_wpn_funnel_0014`, `buff_wpn_funnel_0012`, `buff_wpn_funnel_0014_up`,
`buff_wpn_funnel_0014_hp`, `passive_equipsuit_wisdwill_01`,
`buff_equipsuit_wisdwill_01/_02`, `buff_common_cryst_cryst_triggered` (and
the other `buff_common_<el>_<el>_triggered`); TableCfg CharGrowthTable,
CharacterPotentialTable, PotentialTalentEffectTable, SkillPatchTable,
WeaponBasicTable, EquipSuitTable, I18nTextTable_EN. Values at skill level
12 / weapon skill level 9 unless noted; frames are SkillData timeline
frames (30 FPS) from the cast. The SkillData and BuffData files arrived
mid-analysis (commit 535e88f); everything below is read from them. Zero
Sanity's Xaihi files (reference/zero-sanity-timeline, MIT) were read as
claims only: its ultimate formula (`min(cap, base + INT × k)` over the
whole Amp) is **contradicted** by both logs (see row 24).

`efsim kit-draft chr_0011_seraph` was run. It compiles the basic attacks
(projectile launch frames, attack4's two landings, SP only if controlled),
attack5's Final Strike, the finisher (multiplier 1.0), the dive, the
combo's frame, Cryo infliction and `usp`, and the battle skill's team
energy at frame 37. It leaves out: poise (attack5, combo: D3), the whole
crystal mechanism (a buff → entity → aura → per-member listener chain), the
talent-1 debuff, and the ultimate's Amp. It also reports a frame-6 SP grant
on the battle skill "if stacks(buff_chr_0011_seraph_talent_1_atb) ≥ 1" that
can never happen (row 9).

## Action types per file

Sound, VFX, camera, animation, root motion, rotation, super armour,
teleport, target finding and ComboCacheAction are left out.

| File | Action types that matter |
|---|---|
| attack1–3, attack4 | LaunchProjectile (attack1 f10, attack2 f7, attack3 f8; attack4 f7 and f12) → `*_projhit`; AllowNextSkillAction (chain) |
| attack1–4_projhit | DamageAction `atk_scale` (mask 128, damageType 4 Cryo); IfElse CheckMainCharacterCondition → ObtainCostAction costType 1 `atb` (attack4 × 0.5; `atb` is 0 in SkillPatchTable) |
| attack5 | DamageAction f19 `atk_scale` (mask 2097280: Final Strike), poise unit `poise` (onlyEnableForMainChar), ObtainCostAction `atb` (15) if controlled; AllowNextSkillAction 33–40 (attack1) |
| power_attack (spec 8) | DamageAction f32, BreakingAttackCalculation multiplier **1.0** (mask 132), GainBreakingAttackAtb, `buff_common_power_attack_disable_cast_skill`, AllowNextSkillAction 34–53 (battle, combo) |
| plunging_attack_end (spec 6) | DamageAction f1 (mask 1152), ObtainCostAction `atb` |
| dash_attack, _projhit, _projhit02, dodge, extra_attack(_projhit) | DamageActions of the dash attack and an extra attack; not in CharGrowthTable `chr_0011_seraph_NormalAttack` |
| normal_skill (battle, spec 3) | f6: IfElse CheckBuffStackNum `buff_chr_0011_seraph_talent_1_atb` ≥ 1 → ObtainCostAction costType 1 `atb`, FinishBuff (unreachable, row 9); f7: CreateBuff `buff_chr_0011_seraph_spawnball` (finishWithNextSkillIfNotInherited; assigns atk_up, heal_value, buff_duration, will_up); no DamageAction, no AllowNextSkillAction; durationFrame 145, exclusiveFrame 30, cost 100 SP |
| buff_…_spawnball | waitFirstTriggerInterval, triggerInterval 1 s, maxTriggerCnt 1: SpawnAbilityEntity `chr_0011_seraph_normal_skill_abentity_onfield` at the controlled operator; CheckSquadInFight → CreateBuff `buff_common_obtain_ultimate_sp` (so both at frame 37) |
| normal_skill_abentity_onfield (the Auxiliary Crystal) | AuraAction 1–901 (radius 99, characters) → `buff_chr_0011_seraph_normal_skill_heal` on every team member; f600: if no `finishball_04` → FinishBuff `combo_skill_listener`, CreateBuff `finishball_02` (FinishOwnerAction: the crystal ends after 20 s) |
| buff_…_normal_skill_heal (on each member) | abilityEvent 302 (the member deals damage): CheckTimedMarkerCondition (0.3 s marker, per member), CheckBuffStackNum `finishball_04` (compare 1, none yet), CheckMainCharacterCondition (the member is controlled), CheckDamageDecorateMask mask 2097152 (Final Strike) → CreateBuff `buff_chr_0011_seraph_combo_count` on the crystal, CreateBuff `buff_chr_0011_seraph_mainchr_heal` on the member, CreateTimedMarker 0.3 s |
| buff_…_mainchr_heal | waitFirstTriggerInterval, interval 0.25 s, once: StoreAttributeValue Will (Xaihi's) × `will_up` + `heal_value` → HealAction (heal tag −320297214) on the controlled operator; then CheckHp (compare 3 ≥, ratio 1.0: at Max HP) → CreateBuff `buff_chr_0011_seraph_potential_1_atkup` |
| buff_…_potential_1_atkup | EnhancedAction subType 1 (all Arts elements), rate `atk_up`, duration `buff_duration`; stackingType 2 max 1 |
| buff_…_combo_count (on the crystal) | stackingType 3, max 2, 10 s; buffEvent 6 at ≥ 2 layers: CreateBuff `finishball_04` on the crystal, **TriggerComboSkillAction** (Xaihi's combo), FinishBuff itself |
| buff_…_finishball_04 | after 6 s: FinishBuff `combo_skill_listener`, FinishOwnerAction (the crystal ends) |
| combo_skill (spec 4) | f1: FinishBuff `combo_skill_listener`, `normal_skill_heal`; TimeDilationAction 0–24 (global, ComboSkill curve, 0.9 s); f24: LaunchProjectile from the crystal (from Xaihi if none) → `combo_skill_projhit`, CreateBuff `finishball_02` on the crystal; AllowNextSkillAction 25–60 (battle); durationFrame 122, exclusiveFrame 42 |
| combo_skill_projhit | in order: IfElse `exist_talent_1` ≥ 1 and CheckTagMatch on the target (1570888476 Cryo Infliction, 1535684437 Solidified) → CreateBuff `buff_chr_0011_seraph_talent_1_crystup` on the target; IfElse `potential_3` and not `EntityBB_bounced` → LaunchProjectile at one other enemy within 15 m (P3); InterruptAction 1 s; **SpellInfliction type 2 (Cryo)**; DamageAction `atk_scale` (mask 12288, Cryo) + poise unit `poise`; if it hit: HitStopAction 0.2 s, ObtainCostAction `usp` |
| buff_…_talent_1_crystup (on the enemy) | DamageScaleProcessor side 1 NormalCalcZone + `cryst_up` on CheckDamageType 4 (Cryo); duration `duration`; stackingType 2 max 1 |
| ultimate_skill (spec 5) | UltimateTimeAction 0–45; ChannelingCastingAction 0–75 (cantCastSkill, cantSwitchPosition); f58: CreateBuff `buff_chr_0011_seraph_atk_buff` + `_atk_buff_2` (0.2 s, empty) on the team; if `exist_talent_2` ≥ 1: DispelAction (Cryo Infliction, Solidification) on the team; `buff_common_damage_immune_ult_skill` 0–80; AllowNextSkillAction 67–100 (battle, combo); durationFrame 183, exclusiveFrame 80 |
| buff_…_atk_buff (per recipient) | StoreAttributeValue Intellect (of the source, Xaihi) × `wisd_up` (+ baseValue `atk_up` without useBlackboardKey: 0); CompareFloat ≥ `wisd_max` → `wisd_max`; SimpleCalcBB + `atk_up`; EnhancedAction subType 5 (Cryo) and 3 (Nature), duration `duration`; stackingType 2 max 1 |
| talent_0 / _1 / _2 SkillData and `buff_…_talent_0/1/1_atb/2/2_phydown` | an SP-on-battle-skill buff and a Physical RES shred; **no talent node attaches them** (PotentialTalentEffectTable `chr_0011_seraph_talent_1_1…2_2` only set blackboard keys on the combo and the ultimate) |
| tactic_skill, `buff_…_tactic_atb` | not in skillGroupMap or SkillPatchTable: not castable |
| `normal_skill_listener(_02)`, `normal_skill_trigger(_02)`, `combo_skill_trigger(_02)`, `ultimate_skill_ontarget_listener`, `finishball`, `finishball_03`, `train_lastcombo_with_ball`, `atk_buff_normal_skill`, `combo_skill_listener` | nothing in the battle path creates them (only each other, the unused `abentity_onfield02`, or a training stage); no effect |

## Mechanics

| # | Mechanic (source) | Status | How (kit fields) / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: projectiles, `atk_scale` 0.34 / 0.36 / 0.47 / 0.37 (SkillPatchTable L12), SP `atb` (0) only if controlled | supported | kit-draft output as is: `detached`, `sp: atb` (attack4 `atb × 0.5`), launch frames (travel: Ti2) |
| 2 | attack4 = two landings of `atk_scale` (display 0.74 is the sum) | supported | `count: 2`, frames [7, 12]; the logs have two equal hits per attack4 |
| 3 | attack5 Final Strike: 1.24, SP 15, stagger 15 for the controlled operator | data | `finalStrike`, `sp: atb` compiled; `poise: "poise"`, `poiseControlledOnly` hand-written (D3) |
| 4 | Finisher 9.0, multiplier 1.0 | supported | one hit at 32, no factor |
| 5 | Dive attack 1.8 | supported | kept for calc; not castable (S10) |
| 6 | Dash attack (not in the NormalAttack group) | supported | not a kit skill; dash attacks aren't modelled for anyone ([design.md](../../design.md#damage)) |
| 7 | Battle skill: 100 SP, no damage; the crystal comes out at frame 37 and only if Xaihi starts nothing before then (spawnball finishWithNextSkillIfNotInherited) | supported | trigger `crystal_out`: cast, `delay: 37`, `awaited`, not detached; buff `crystal` (20 s: `duration`) |
| 8 | Battle skill team energy at frame 37 (`buff_common_obtain_ultimate_sp` in the spawnball tick) | supported | `teamEnergy: [{frame: 37, ratio: 1}]` (compiled); cut with the cast, like the crystal |
| 9 | Battle skill frame-6 SP if `buff_…_talent_1_atb` | supported | unreachable: no talent attaches `chr_0011_seraph_talent_1` (row 33). Leave it out; kit-draft's note about it is misleading (D3 note) |
| 10 | "After the controlled operator performs a Final Strike on the enemy, the Auxiliary Crystal will restore the said operator's HP. This effect can trigger 2 times" | supported | triggers `crystal_count` (gain) and `crystal_heal` (heal at +8 frames, `healKind: battle`) on `{event: hit, finalStrike: true}`, `by: controlled`, `if` crystal out and fewer than 2 used |
| 11 | 0.3 s timed marker per member (a two-landing Final Strike counts once) | supported | `cooldown: 0.3`, `cooldownPer: eventSubject` |
| 12 | Combo trigger: "When the Auxiliary Crystal uses up its HP treatments" (TriggerComboSkillAction at 2 layers) | supported | trigger `crystal_used_up` on `stackAtLeast crystal_heals 2` → `openCombo`, `endBuff crystal` |
| 13 | The used-up crystal lingers 6 s (finishball_04), as long as the engine's 6 s combo window | supported | engine `COMBO_WINDOW_FRAMES`; nothing else reads the lingering crystal |
| 14 | Crystal life 20 s (entity f600), heals left unused | supported | buff `crystal` duration 20 s; no combo |
| 15 | `combo_count` layers last 10 s (stackingType 3): two Final Strikes more than 10 s apart may not open the window | unknown | interim: the count doesn't expire (U2; in-game test X3) |
| 16 | A second battle skill while a crystal is out: a second crystal, or a replacement | unknown | interim: replaced, count reset (`crystal_out` gains −2) (U3; test X2) |
| 17 | "When the controlled operator is already at Max HP when triggering the HP restoration, grant the said operator a temporary Arts Amp. This effect cannot stack." 0.15 (L12) + P1, 25 s, all four Arts elements | supported | team buff `crystal_amp` (`to: eventSubject`, per recipient, refreshed), `zone: amp`, elements fire/pulse/cryst/natural, value `atk_up`. HP isn't simulated: every treatment gives it (N1 interim; U1, test X1). Logged as `buff_common_affixes_enhance_spell` 0.16 on Si in abfd4b7478ec (0.11 at L7 + 0.05) |
| 18 | Heal amounts (`heal_value` + `will_up` × Will) | supported | heal events only (amounts aren't modelled) |
| 19 | Combo: `atk_scale` 4.5, Cryo Infliction before the damage, `usp` 10 if it hit, poise 10, cooldown 7 s (castData's 35 overridden) | data | kit-draft gives frame, event, infliction, energy; `poise` hand-written (D3) |
| 20 | Combo global slow-down (ComboSkill curve, 0.9 s) and window 25–60 (battle skill) | supported | loader (SkillData timing) |
| 21 | Combo HitStopAction 0.2 s, InterruptAction 1 s on the enemy | gap | Ti1b (hit-stop, open); InterruptAction has no damage effect |
| 22 | Talent 1 Execute Process: "Hitting an enemy with Cryo Infliction or Solidification also causes the enemy to suffer Cryo DMG Taken +{cryst_up} (7% / 10%) for {duration} (5) s. This effect cannot stack." Judged before the combo's own infliction; the debuff counts for that hit | supported | two hits on `branch: "target"`: `vs_cryo` with `if: all [talentAtLeast [0, 1], any [enemyInfliction cryst, enemyStatus solidification]]` and `buffs: [{buff: cryo_fragility, beforeDamage: true}]`, and `plain`. Verified: abfd4b7478ec combos at 19487, 57934, 99947 are ×1.089 = (1.12 + 0.10) / 1.12 over the one at 85032 |
| 23 | Talent 2 Freeze Protocol: the ultimate dispels Cryo Infliction and Solidification from the team | supported | no effect (statuses on operators aren't simulated) |
| 24 | Ultimate Stack Overflow: team Cryo and Nature Amp = `atk_up` + min(Intellect × `wisd_up`, `wisd_max`) for 12 s, at frame 58 | supported | team buff `stack_overflow`, value `{sum: [atk_up, {min: [{product: [{attr: 41}, wisd_up]}, wisd_max]}]}`; the cap is on the Intellect part only: dbaee23b801d logs 0.568052 = 0.264 + 921.37 × 0.00033 (above the 0.396 cap), abfd4b7478ec 0.301833 = 0.209 + 351.64 × 0.000264 (P5 × 1.1 on all three keys) |
| 25 | Ultimate time stop 0–45, cantCastSkill / cantSwitchPosition 0–75, window 67–100 | supported | loader |
| 26 | Ultimate cost 80 energy, cooldown 20 s; no damage | supported | `hits: []`, trigger `ultimate_amp` (`delay: 58`, `awaited`) |
| 27 | P1: crystal Amp +0.05 (`atk_up` add on normal_skill) | supported | panel `skillValues` |
| 28 | P2: ultimate cost × 0.9 | supported | panel `skillParams` (72 energy in a scratch run) |
| 29 | P3: the combo chains to one more enemy nearby | supported | no effect against one enemy (multi-enemy) |
| 30 | P4: Intellect +15, Treatment Efficiency +10% | supported | stat panel |
| 31 | P5: ultimate `atk_up`, `wisd_up`, `wisd_max` × 1.1 | supported | panel `skillValues` (both logs reproduce it) |
| 32 | Attribute nodes Will +10 / +15 / +15 / +20 | supported | stat panel; build `attributeNodes` |
| 33 | Unattached talent skills and buffs, tactic skill, unused listeners | supported | not kit content (table above) |
| 34 | Her Cryo bursts (combo on a Cryo-inflicted enemy) deal their damage and raise the burst event about 1 s later, on the enemy's clock | gap | **G1** (every operator's bursts) |
| 35 | Logged bursts 1.4–3.5 s after the hit don't match the replay | gap | **G2** (log tooling) |

### Equipment

| # | Mechanic (source) | Status | How / what's missing |
|---|---|---|---|
| E1 | Freedom to Proselytize: Will (`wpn_attr_will_mid`), Treatment Efficiency (`wpn_sp_attr_heal_mid`), Main Attribute + `all_attr_up` (cardAttributeModifier formulaItem 6, modifyAttributeType 1) | supported | stat panel |
| E2 | "When the wielder's battle skill provides HP treatment, the controlled operator is restored for another [{hp_will_add} + Will×{hp_will_mult}] HP. Effect only triggers once every {cd}s." (abilityEvent 50, CheckHealTag −320297214, CheckHp compare 0 < 0.99 on the controlled operator, global CD 15 s) | supported | no kit content: below 99% HP never holds while HP isn't simulated (N1). If HP comes: `{event: heal, kinds: [battle]}`, `by: self`, `cooldown: cd` → `heal` controlled. `buff_wpn_funnel_0012` (formulaItem 6) is never created (toggleBuffs names `buff_wpn_passive_spirit_01`, which has no file) |
| E3 | OBJ Arts Identifier: Intellect, Arts Intensity (`wpn_sp_attr_phy_spell_mid`), Max HP + `hp_up` % | supported | stat panel (`efsim calc`: PhysicalAndSpellInflictionEnhance 62, MaxHp + 0.28) |
| E4 | "When the wielder's combo skill applies Arts Burst or Physical Status, the entire team gains Heat DMG Dealt and Electric DMG Dealt +{dmg_up} for {duration}s." (abilityEvent 127 and 401, CheckOriginSkillType [6]) | supported | triggers on `{event: burst, fromKinds: [combo]}` and `{event: physicalStatus, fromKinds: [combo]}`, `by: self` → team buff attrs 51 / 52 + `dmg_up`, 15 s. Burst timing: G1. A Lift that only adds Vulnerable: batch 2's Antal U1 |
| E5 | "Effects of the same name cannot stack" (`buff_wpn_funnel_0014_up` stackingType 11, priorityKey `lv`) | gap | B9 (open, minor): two wielders on one team each give their own today |
| E6 | AIC Light: HP +500 | supported | stat panel |
| E7 | AIC Light: "After the wearer defeats an enemy, the wearer gains ATK +{atk_up} (20, flat) for {duration} (5) s" (abilityEvent 222, objectTypeMask 16) | supported | no kit content: kills (N1, deferred), as AIC Heavy |

Counts (operator + equipment, 42 rows): supported 34, data 2, gap 4 (G1,
G2, Ti1b, B9), unknown 2 (U2, U3), unique? 0. Nothing is unique: the
crystal is a counter stack and triggers, like batch 2's Fluorite and
Catcher; the talent branch is Estella's C4 pattern.

## Gaps

### G1. A burst's damage and event come 1 s after the infliction that causes it

- **family:** arts state (timing).
- **feature:** a same-element infliction (Arts Burst) schedules its burst
  for 30 frames later on the enemy's clock (paused and slowed with the
  enemy: time stops, freezes, and later hit-stop): the burst damage, its
  `burst` status event (for triggers: OBJ Arts Identifier, Seeker of Dark
  Lung, Typhoeus's burst triggers) and the burst's own hit-stop then.
  Modifiers are read at that moment (Staggered, buffs that start or end in
  between). Reactions (two elements) stay immediate. Kit hits that compute
  a burst themselves (`KitHit.reaction`, Typhoeus) are separate: their
  damage is the hit's own.
- **evidence:** BuffData `buff_common_{fire,pulse,cryst,natural}_{same}_triggered`:
  `waitFirstTriggerInterval: true`, triggerInterval 1.0; TriggerSpellBurstEventAction,
  ReadSkillSettingData (法术爆发伤害倍率) and the DamageAction sit in
  buffEvent 1 (the first tick). The cross-element ones
  (`buff_common_cryst_fire_triggered`, `…_fire_cryst_…`) deal theirs in
  buffEvent 0 (at once). Logs: zmdlogs-abfd4b7478ec Xaihi's combos at
  19487 / 57934 / 99947 ms, her Cryo bursts at 21003 / 59344 / 103478
  (+1.52 / +1.41 / +3.53 s; the last across the enemy's stagger, and logged
  with `buff_common_poise_break_damage_taken_scale` ×1.3 that her combo hit
  didn't have); Arcane's report (batch 1,
  "~1.0–1.5 s after her WILL touch, never at the touch itself", its test
  A); 40d9a3c1da37 +893 / +912 ms (packages/cli/src/reactioncheck.ts).
- **impact:** wrong modifiers on bursts whose 1 s straddles a change: in
  the 103478 example the engine deals the burst unstaggered (×1/1.3 =
  −23% for that burst); burst triggers fire 1 s early (a buff they give
  counts on hits it shouldn't). Typically a few percent of a burst-heavy
  operator's damage. Affects every operator, so it goes to the merge as a
  shared item, not Xaihi's.

### G2. The reaction replay's burst window

- **family:** log tooling.
- **feature:** `zmdlogs reactions` matches a logged burst within
  `REACTION_LOG_DELAY_MS` (1200 ms) of the predicted one. With G1 the
  prediction moves to +30 frames on the enemy's clock; until then (and for
  hit-stop and stagger, which stretch the enemy's clock) the window should
  allow the enemy-clock delay, or the check should use the burst's buff tick.
- **evidence:** `zmdlogs reactions` on abfd4b7478ec (build corrected,
  below): Xaihi's three bursts are "not logged" at the combo hit and
  "unexpected" 1.4–3.5 s later.
- **impact:** her `applies` look wrong in the replay although damage
  matches; no effect on simulation.

### Already open, referenced

- **D3** (compiler leftovers): poise on attack5 and the combo; the
  conditional created buff before the combo's damage (talent 1); the
  ultimate's StoreAttributeValue / CompareFloat / SimpleCalcBB chain; the
  unreachable frame-6 SP note.
- **Ti1b** (hit-stop): the combo's 0.2 s HitStopAction.
- **Ti2** (projectile travel): basic attacks and combo land at launch frames.
- **B9** (stacking type 11 across wielders): OBJ Arts Identifier.
- **N1** (HP and kills, deferred): the crystal Amp's Max-HP condition
  (interim: always at Max HP), Freedom to Proselytize's below-99% heal
  (never), AIC Light's kill ATK (never).

## Unknowns

- **U1.** Is the controlled operator below Max HP often enough to miss the
  crystal Amp? The engine assumes full HP (N1), so every treatment Amps.
  The data heals first, then checks Max HP, so a treatment that fills the
  bar still Amps. Test X1.
- **U2.** Does a `combo_count` layer expire after 10 s (stackingType 3),
  so two Final Strikes more than 10 s apart don't open the combo? Interim:
  no expiry. Test X3.
- **U3.** A second battle skill with a crystal out: two crystals (their
  treatments counted together?) or one replacing the other? Interim:
  replaced. Test X2.

## Verification

**Fixtures.** Both logs have Xaihi only with other weapons
(`wpn_funnel_0005`, `wpn_funnel_0010`) and gear (Frontiers, Eternal
Xiranite), so they check her kit, not her assigned equipment.

- **fixtures/zmdlogs-dbaee23b801d.json** (committed; with Typhoeus, Arcane,
  Liino): 7 Xaihi hits (attacks 1–5). With the draft kit and the fixture
  as committed: **0 match, 7 mismatch**, all at ratio 0.970 (one with
  boundary buffs). Nothing in the kit explains a uniform factor on every
  basic hit (and the ultimate's Amp, which reads her Intellect, matches
  exactly): it's her base ATK. The log doesn't record weapon level; the
  fixture assumes 90. Weapon level **85** matches all 7 (ATK 3,691.8);
  so does weapon level 89 with 3 attribute nodes. With weapon level 85 in
  the scratch copy of the fixture: Xaihi 7 of 7 match, every other
  operator unchanged, and `vitest run tests/logs.test.ts` and the whole
  suite (592 tests) pass. **The committed fixture must get this correction
  in the same commit as the kit**, or `tests/logs.test.ts` fails (with the
  kit and the uncorrected fixture it does fail in the scratch copy).
- **fixtures/pending/zmdlogs-abfd4b7478ec.json** (with Si, Yvonne,
  Fluorite; Xaihi level 80, promotion 3, Chivalric Virtues at "90"): 75
  hits, uniform ratio 0.803 (combos 0.875 = 0.803 × 1.089: talent 1, row
  22). Weapon level **60** (ATK 2,020.2) gives **75 of 75 match**: attacks,
  the four combos (both branches), and her three Cryo bursts. Other
  single-value fits (weapon 63 with 2 nodes, 68 with 0) leave 10–13
  mismatches. The log also shows that two Cryo Amps from different
  operators add (Xaihi's 0.301833 and another 0.32 on the same hits, all
  matching): evidence for the "sum or the larger" question of in-game test
  38 and Antal's report, for Amp.
- `zmdlogs reactions` on the corrected abfd: Xaihi's combo applications
  are right (each Cryo burst follows a combo on a Cryo-inflicted enemy),
  but the replay can't match them in time (G1, G2).
- **Simulation** (scratch scenario, Xaihi P5 with OBJ Arts Identifier):
  battle skill, two basic chains (2 Final Strikes) → the combo window opens
  at the second Final Strike, the combo casts at 7.30 s; attacks after the
  first treatment are ×1.20 (crystal Amp at P5: 0.15 + 0.05); a second
  combo 8 s later takes the `vs_cryo` branch and bursts; hits in the next
  5 s are ×1.10 (Cryo DMG Taken); the ultimate costs 72 energy (P2).

**Logs that would verify the rest:** any log with OBJ Arts Identifier
(`buff_wpn_funnel_0014_up` on teammates after her combo bursts) or Freedom
to Proselytize; a log where a crystal expires unused, or two battle
skills within 20 s (U2, U3).

**In-game tests** (to add to docs/in-game-tests.md at the merge; numbers
then). None of the existing tests covers Xaihi; test 38 is related (two
Amp sources add, per abfd4b7478ec above).

- **X1. Xaihi's crystal Amp below Max HP** (ready, if you have Xaihi).
  *Why:* the engine gives the controlled operator the crystal's Arts Amp on
  every treatment (it assumes full HP). *How:* let an enemy hit the
  controlled operator hard (well over the 500–650 HP a treatment heals:
  324 + 0.76 × Xaihi's Will at level 12), then
  cast Xaihi's battle skill and do a Final Strike: does the Arts Amp buff
  icon appear on that operator? Then the same at full HP. *Predictions:*
  data reading: no icon after the hurt one, icon at full HP; if the icon
  appears both times, the condition isn't what the data says.
- **X2. Two crystals** (ready, if you have Xaihi). *How:* cast her battle
  skill twice within a few seconds and count the crystals orbiting the
  controlled operator; then do Final Strikes and count how many it takes
  before her combo becomes castable. *Predictions:* one crystal and 2
  Final Strikes (replacement, the interim); two crystals and 2 (they share
  one count) or 4.
- **X3. The crystal's 10 s count** (ready, if you have Xaihi). *How:* battle
  skill, one Final Strike, then wait 12 s by stopwatch (the crystal lasts
  20 s) and do a second Final Strike: does the combo become castable?
  Compare with two Final Strikes 3 s apart. *Predictions:* castable both
  times (no expiry, the interim) or only the second time (the first
  treatment's layer expired after 10 s; then a third Final Strike opens
  it).

G1 isn't testable by hand (1 s); the logs settle it.

## Kit plan

Draft files, loaded with the real loader in the scratch copy
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0011_seraph/repo/packages/data/kits/operators/chr_0011_seraph.json`
and `…/kits/equipment/{wpn_funnel_0012,wpn_funnel_0014,suit_wisdwill01}.json`):
**they load**, the schema accepts them, the full test suite passes with the
dbae fixture corrected (above), `efsim simulate` runs them. Nothing in the
plan waits on a gap: G1 changes burst timing in the engine, not the kit.

### Operator kit `chr_0011_seraph`

- **stacks:** `crystal_heals` (max 2).
- **buffs:**
  - `crystal`: self, `duration: "duration"` (20), no modifiers (a state).
  - `crystal_amp`: team, `gameBuff: buff_chr_0011_seraph_potential_1_atkup`,
    `duration: "buff_duration"` (25), `{zone: amp, elements: [fire, pulse,
    cryst, natural], value: "atk_up"}`; values from `chr_0011_seraph_normal_skill`.
  - `cryo_fragility`: enemy, `gameBuff: buff_chr_0011_seraph_talent_1_crystup`,
    `duration: "duration"`, `{zone: damageTaken, elements: [cryst], value:
    "cryst_up"}` (combo keys after the talent's skillBbModifier; 0 s while
    unlearned).
  - `stack_overflow`: team, `gameBuff: buff_chr_0011_seraph_atk_buff`,
    `duration: "duration"` (12), `{zone: amp, elements: [cryst, natural],
    value: {sum: ["atk_up", {min: [{product: [{attr: 41}, "wisd_up"]},
    "wisd_max"]}]}}` (Intellect read when applied, buffs included).
- **triggers:**

```json
{ "id": "crystal_out", "on": { "event": "cast", "skills": ["chr_0011_seraph_normal_skill"] }, "by": "self",
  "delay": 37, "awaited": true, "skill": "chr_0011_seraph_normal_skill",
  "do": [{ "kind": "gain", "gains": [{ "stack": "crystal_heals", "amount": -2 }] }, { "kind": "buff", "buff": "crystal" }] },
{ "id": "crystal_count", "on": { "event": "hit", "finalStrike": true }, "by": "controlled",
  "if": { "all": [{ "buffActive": "crystal" }, { "stack": "crystal_heals", "below": 2 }] },
  "cooldown": 0.3, "cooldownPer": "eventSubject",
  "do": [{ "kind": "gain", "gains": [{ "stack": "crystal_heals", "amount": 1 }] }] },
{ "id": "crystal_heal", "on": { "event": "hit", "finalStrike": true }, "by": "controlled",
  "if": { "all": [{ "buffActive": "crystal" }, { "stack": "crystal_heals", "below": 2 }] },
  "cooldown": 0.3, "cooldownPer": "eventSubject", "delay": 8, "skill": "chr_0011_seraph_normal_skill",
  "do": [{ "kind": "heal", "target": "eventOperator", "healKind": "battle" },
         { "kind": "buff", "buff": "crystal_amp", "to": "eventSubject" }] },
{ "id": "crystal_used_up", "on": { "event": "stackAtLeast", "stack": "crystal_heals", "atLeast": 2 }, "by": "self",
  "do": [{ "kind": "openCombo" }, { "kind": "endBuff", "buff": "crystal" }] },
{ "id": "combo_takes_crystal", "on": { "event": "cast", "skills": ["chr_0011_seraph_combo_skill"] }, "by": "self",
  "delay": 24, "do": [{ "kind": "endBuff", "buff": "crystal" }] },
{ "id": "ultimate_amp", "on": { "event": "cast", "skills": ["chr_0011_seraph_ultimate_skill"] }, "by": "self",
  "delay": 58, "awaited": true, "skill": "chr_0011_seraph_ultimate_skill",
  "do": [{ "kind": "buff", "buff": "stack_overflow" }] }
```

  `crystal_count` and `crystal_heal` are judged together on the situation
  at the Final Strike (T5), so the heal's `if` sees the count before the
  gain. The 8 frames are mainchr_heal's 0.25 s first tick (7.5, rounded).

- **skills** (kit-draft output, with these changes):
  - attacks 1–4, finisher, dive: as compiled (frames 10, 7, 8, [7, 12];
    finisher 32; dive 1).
  - attack5: add `"poise": "poise", "poiseControlledOnly": true`.
  - battle skill: `hits: []`, `teamEnergy: [{frame: 37, ratio: 1}]`;
    drop kit-draft's frame-6 SP note.
  - combo: two hits on one branch (same frame 24, event
    `chr_0011_seraph_combo_skill_projhit`, `applies` Cryo infliction,
    `energy: "usp"`, `poise: "poise"`, `detached`):

```json
{ "id": "vs_cryo", "branch": "target",
  "if": { "all": [{ "talentAtLeast": [0, 1] }, { "any": [{ "enemyInfliction": "cryst" }, { "enemyStatus": "solidification" }] }] },
  "buffs": [{ "buff": "cryo_fragility", "beforeDamage": true }], "...": "shared fields" },
{ "id": "plain", "branch": "target", "...": "shared fields" }
```

  - ultimate: `hits: []` (trigger `ultimate_amp`).
- **sources:** list the files not used as skills (dash, dodge, extra
  attack, tactic skill, talent_0/1/2) and why.

### Equipment kits

- **wpn_funnel_0014** (OBJ Arts Identifier): team buff
  `wpn_funnel_0014.heat_electric` (`gameBuff: buff_wpn_funnel_0014_up`,
  `duration: "duration"`, `[{attr: 51, value: "dmg_up"}, {attr: 52, value:
  "dmg_up"}]`); triggers `wpn_funnel_0014.combo_burst` on `{event: burst,
  fromKinds: [combo]}` and `wpn_funnel_0014.combo_physical` on `{event:
  physicalStatus, fromKinds: [combo]}`, both `by: self`, `skill:
  sk_wpn_funnel_0014` → that buff. Simulated in the scratch run (the second
  combo's burst).
- **wpn_funnel_0012** (Freedom to Proselytize): sources only (stat panel;
  the extra heal needs the controlled operator below 99% HP: N1). The
  trigger it would become is in E2.
- **suit_wisdwill01** (AIC Light): sources only (HP in the panel; kill ATK:
  N1), as suit_stragi01.

**With the kit, in the same commit:** correct Xaihi's build in
`fixtures/zmdlogs-dbaee23b801d.json` (weapon level 85, with a provenance
note: the 7-hit fit, and that 89 with 3 attribute nodes fits as well), and
in `fixtures/pending/zmdlogs-abfd4b7478ec.json` (weapon level 60, 75 of 75).

## Kit (2026-10-20)

Re-analysis against the engine at 182f22b (batch 3's shared features
merged), then the kit: `packages/data/kits/operators/chr_0011_seraph.json`,
`packages/data/kits/equipment/{wpn_funnel_0012,wpn_funnel_0014,suit_wisdwill01}.json`,
tests `tests/kit-xaihi.test.ts`, example `examples/xaihi-si.scenario.json`
(build `examples/xaihi-p5.json`). No engine, loader or compiler change.

### Re-analysis per gap

| Gap / row | Now | How |
|---|---|---|
| G1 bursts 1 s after the infliction (row 34) | **done** (A5) | `BattleConstants.burstDelayFrames` from `buff_common_cryst_cryst_triggered`; her combo's burst lands 30 frames after its hit (test), and OBJ Arts Identifier's buff starts then |
| G2 the replay's burst window (row 35) | **done** (L2) | 4 s window: all three of her abfd bursts match (+1.52 / +1.41 / +3.53 s) |
| E5 / B9 OBJ Arts Identifier across wielders | **done** (B2) | the loader gives `wpn_funnel_0014.heat_electric` `stackGroup: buff_wpn_funnel_0014_up` from its game buff (type 11, priority key `lv`, one instance); test |
| D3 poise on attack5 and the combo (rows 3, 19) | **done** (D2) | kit-draft now compiles `poise` and `poiseControlledOnly`; the kit uses them as compiled |
| D3 the talent-1 branch (row 22) | interim (hand-written) | kit-draft reports the CreateBuff with its condition in a note only; the kit's two `branch: target` hits (`vs_cryo`, `plain`), no KNOWN entry needed |
| D3 the ultimate's Amp chain (row 24) | interim (hand-written) | kit-draft still compiles nothing for the ultimate; trigger `ultimate_amp` with the `{sum, min, product, attr}` value |
| D4 the unreachable frame-6 SP (row 9) | open (D4: no note for unreachable branches) | kit-draft still reports it; left out of the kit, said in its sources |
| Ti1b the combo's 0.2 s hit-stop (row 21) | open (shared) | not modelled |
| Ti2 projectile travel (rows 1, 19) | open (shared) | hits at their launch frames (test 47) |
| U1 the crystal Amp at Max HP (row 17) | interim (N2 deferred) | every treatment Amps (operators count as topped up); test 70 part 1 |
| U2 / B4 the 10 s count (row 15) | interim | the count doesn't expire (test); test 70 part 3 |
| U3 a second crystal (row 16) | interim | replaced, count reset (test); test 70 part 2 |
| E2 Freedom to Proselytize's extra heal | interim (N2) | never (the controlled operator is never below 99%); kit declares nothing |
| E7 AIC Light's kill ATK | interim (N2, kills) | never; kit declares nothing |
| E4 OBJ Arts Identifier on a Lift that only adds Vulnerable | unknown (P1) | engine: no; test 39's Vulnerable-only part |

Every other row of the mechanics table is as it says (supported), checked
against the engine: Final-Strike triggers by the controlled operator with a
per-member 0.3 s cooldown, `stackAtLeast` opening the combo, `to:
eventSubject` buffs, `heal` with `healKind`, `awaited` cast triggers, team
energy at frame 37, `talentAtLeast`, and `{attr: 41}` read when the buff is
applied.

### What the kit models

- **Basic attacks** as compiled: projectile landings at 10 / 7 / 8 /
  [7, 12] (attack4 two equal `atk_scale` landings), attack5 the Final
  Strike at 19 (SP 15 and Stagger 15 only when controlled), finisher at
  32 (factor 1), dive kept for calc.
- **Battle skill:** no damage; at frame 37 (spawnball's first tick) the
  crystal (`crystal`, 20 s, count reset) and the team energy, both
  dropped if her next skill starts first (e.g. her ultimate at frame 10).
- **Crystal:** each controlled operator's Final Strike while it's out and
  under 2 treatments is a treatment (`crystal_heal`, 8 frames later: the
  0.25 s tick) giving that operator the Arts Amp `atk_up` (0.15, P1
  +0.05) on all four Arts elements for 25 s; the second treatment opens
  the combo and ends the crystal. Judged at the Final Strike, so the
  delayed second treatment still lands after the crystal ends.
- **Combo:** one hit at 24 (Cryo Infliction before its damage, `usp`,
  poise 10), as `vs_cryo` (talent 1 learned and the enemy Cryo-inflicted
  or Solidified before the hit: Cryo DMG Taken `cryst_up` 0.07 / 0.10 for
  5 s, counting on this hit) or `plain`.
- **Ultimate:** at frame 58 the team Cryo and Nature Amp `atk_up` +
  min(Intellect × `wisd_up`, `wisd_max`) for 12 s (P5 ×1.1 on all three;
  P2 cost 72).
- **OBJ Arts Identifier:** her combo's burst or physical status gives the
  team Heat and Electric DMG +`dmg_up` (0.224 at level 9) for 15 s.
- **Left out:** heal amounts, operator HP (U1, E2), kills (E7), the
  combo's hit-stop and InterruptAction, P3's bounce (one enemy), talent 2's
  dispel (statuses on operators), dash and extra attacks (S5).

### Verification

- **fixtures/zmdlogs-dbaee23b801d.json** (committed): Xaihi's weapon level
  corrected to **85** (provenance note): her 7 hits go from 0 match / 7
  not covered (no kit) to **7 of 7 match**. With 90 all 7 mismatch
  (logged / predicted 0.970); 84 and 86 leave all 7 mismatched; 89 with
  attribute nodes 3 matches too (in the note). Other operators unchanged.
  `zmdlogs reactions`: unchanged except that the "no inflictions in the
  kit" line no longer names her (she has no Cryo hit in this log).
- **fixtures/pending/zmdlogs-e82d45c46040.json** (Perlica's; Xaihi is on
  the team with no logged hits): only that `zmdlogs reactions` line
  changes the same way.
- **fixtures/pending/zmdlogs-abfd4b7478ec.json:** weapon level corrected
  to **60** (provenance note): **75 of 75 match** (attacks, both combo
  branches, her three Cryo bursts). The fit is from her hits only: her
  Intellect (351.64, which her ultimate's logged Amp reads) doesn't depend
  on the weapon level; 59 and 61 leave 60 and 65 mismatched, 63 with 2
  attribute nodes 13, 68 with none 10. `zmdlogs reactions`: 0 matched / 8
  unexpected → **5 matched, 0 predicted but not logged, 3 unexpected**:
  her three Cryo bursts match, and Fluorite's (62772 → 64225) and Si's
  (85643 → 86626) now that her combos' Cryo is in the replay. The three
  left are Fluorite's at 21573, 61856 and 104011 (0.5–2.5 s after one of
  Xaihi's), unexpected before the kit too: the replay predicts no burst
  from Fluorite there (her kit's, not this one's).
- **Example totals:** every existing `examples/*.scenario.json` total and
  every other `zmdlogs check` / `reactions` line unchanged.
- **Example** `xaihi-si.scenario.json` (Xaihi P5 with OBJ Arts Identifier,
  Si): 289,662 damage in 34.47 s (Xaihi 12.6%). Crystal at 1.23 s; her
  Final Strike (4.03 s) and Si's (7.40 s) are the treatments, the combo
  window opens at Si's, the first combo (7.70 s) is plain with her own
  Amp 0.20; the ultimate's Amp is 0.568 (0.264 + 921.4 × 0.00033, as
  dbaee23b801d logs); the second crystal's combo (22.60 s) takes
  `vs_cryo` (Cryo DMG Taken 0.10 on its hit) and bursts 30 frames later,
  giving the team OBJ Arts Identifier's buff. As the report's scratch run.
  Global slow-downs (the combos' 0.9 s) stretch buffs' world time a
  little: the ultimate's 12 s Amp covers a hit at 702 that 58 + 360 frames
  from its cast at 270 wouldn't (engine-wide, not this kit).

### In-game tests the kit depends on

- **70** (all three parts: U1 Amp below Max HP, U3 two crystals, U2 the
  10 s count).
- **39** (its Vulnerable-only part: OBJ Arts Identifier on a combo's
  Vulnerable-only Lift; P1).
- **47** (projectile travel: every hit of hers lands at its launch frame).
- Test 38's Amp question: abfd4b7478ec has her ultimate's Cryo Amp and
  another 0.32 adding on the same hits (all matching); the kit relies on
  Amp sources adding.
