# Pogranichnik (chr_0029_pograni): batch 4, analysis 1

Pogranichnik (6★ Guard, Physical, sword; CharGrowthTable `chr_0029_pograni`)
with the weapons assigned to him in [batch-4.md](../batch-4.md):
wpn_sword_0017 Glorious Memory, wpn_sword_0021 Grand Vision and its variant
wpn_sword_0021_ink, wpn_sword_0022 Lupine Scarlet, wpn_sword_0024 Complexed
Industry, wpn_sword_0026 Farsight.

Sources: rmxlinux TableCfg (CharGrowthTable, PotentialTalentEffectTable,
SkillPatchTable, WeaponBasicTable, I18nTextTable_EN) and Json/SkillData,
Json/BuffData (all files the kit needs are in the checkout); `efsim
kit-draft chr_0029_pograni`; fixtures/pending/zmdlogs-7e19489ae503.json
(7e19) and, for Lupine Scarlet, fixtures/zmdlogs-4e5e1390085e.json (4e5e).
Draft kits were written and checked in a scratch copy of the repository
(see the kit plan); nothing in the repository was changed but this report.

Ability events read below (from their use in the data and earlier reports):
13 / 101 a hit dealt / taken, 30 a skill cast, 44 a critical hit, 59 a
physical status suffered (only in this operator's in-aura buff), 126 an
infliction applied, 142 SP obtained, 206 a buff applied by the owner,
401 / 402 a physical status applied. `compareType` 0 <, 1 ≤, 2 >, 3 ≥, 4 =.

## Mechanics

### Action types per file (gameplay only)

| File | Action types that matter | What they do |
|---|---|---|
| attack1–4 | DamageAction, ObtainCostAction, AllowNextSkillAction, SnapToTarget | hits; `atb` 0 at every level (only attack5 has SP) |
| attack5 | DamageAction (mask 2097280), ObtainCostAction `atb` (atbSourceType 1, controlled only), ModifyDynamicBlackboard `isHitbyMain` | Final Strike, poise unit only as controlled |
| power_attack | DamageAction ×3 (BreakingAttackCalculation 0.1, 0.1, 0.8), GainBreakingAttackAtb, BlowOff | finisher |
| plunging_attack_end | DamageAction, PushBack | dive attack |
| normal_skill | DamageAction ×2, FractureAction (Breach) at 38 before the second, SaveBuffStackNumAdvanced (tag 1075718177 Vulnerability) → SwitchAction `num` → ObtainCostAction atb1–atb4, IfElse CheckEntityNum ≥ 2 + `has_potential1` → atb_return (method 1, returned), CreateBuff `buff_common_obtain_ultimate_sp` at 38, ChannelingAction, AllowNextSkillAction | damage, Breach, SP by stacks, P1, team energy, timing |
| combo_skill | f0: CheckBuffStackNumAdvanced on `buff_chr_0029_pograni_combo_skill_count1–4` → `EntityBB_noguard_count`, FinishBuff of all four, CompareFloat → JumpToAction 600 / 400 / 200; per path DamageAction, SimpleCalcBB `calc_atb = atb_n × atb_ratio`, ObtainCostAction, `usp`, InterruptAction (enemy), TimeDilationAction ComboSkill, MarkCanInterrupt 80 / 280 / 450, InterruptCurSkillAction 191 / 391 / 545 | the slash sequences |
| ultimate_skill | UltimateTimeAction, DamageAction `atk_scale_rush` at 76, InterruptAction, SpawnAbilityEntity ×4 at 74, FinishBuff `buff_chr_0029_pograni_ultimate_skill` at 0, PullAction, BlowOff | rush, soldiers, recast |
| ultimate_skill_abilityentity | CheckBuffStackNum (state = 0) → CreateBuff `buff_chr_0029_pograni_ultimate_skill` (at entity f3 = skill f77) | the state |
| buff_…_ultimate_skill | buffEvent 0: CreateBuff `_ultimate_skill_count` × `count` (5); 5: AuraAction (radius 50, enemies) → `_abilityentity_inaura`; 2: FinishBuff `_effect_layer` (visual) | Steel Oath, the aura |
| buff_…_abilityentity_inaura (on enemies) | abilityEvent 59 and 101 (+ CheckTargetsEqual attacker, CheckDamageDecorateMask 8192): CheckTimedMarker `soldier_attacked` (0.1 s), CheckBuffStackNumAdvanced count = 1 / > 1, FinishBuffAdvanced 1 layer, CreateBuff `_finall_rush` / SpawnAbilityEntity `_attack2`, GetTargetBuffBBAdvanced (talent2 `duration`, talent1_exist `atk_up`, `physpell_up`, `max_stack_owner`, `max_stack_team`) → CreateBuff `buff_chr_0029_pograni_talent1` on the event's operator | the follow-ups and talent 2 |
| …_abilityentity_attack2 | f0 jumps by count (5: none, 4 → 100, 3 → 200, 2 → 300); DamageAction `atk_scale_trigger` (mask 512, no poise) + ObtainCostAction `atb_trigger` (type 3) at 9 / 108 / 209 / 307; TimeDilationAction layer 1 0.4 s per path | harass |
| buff_…_finall_rush → …_finish4 ×4 | f25: CheckTimedMarker `ultimate_finalhit` (only the first deals damage) → ObtainCostAction `atb_final` (type 3), DamageAction `atk_scale_final` + poise unit `poise_final` (mask 4608), TakeDownAction 1.2 s; f31 FinishBuff the state | Decisive Assault |
| …_finish1–3 | DamageAction, ObtainCostAction | spawned by nothing (unused files) |
| talent1 | abilityEvent 142 + CheckObtainAtbType method [0] type [3] → SaveAtbObtainValue, ModifyDynamicBlackboard `EntityBB_atb_contain` +=, CompareFloat ≥ `atb_gain` → −= atb_gain, CreateBuff `buff_chr_0029_pograni_talent1` (self, max `max_stack_owner`); abilityEvent 150 resets the bank | The Living Banner |
| buff_…_talent1 | attribute 2 formulaItem 6 `atk_up`, 87 formulaItem 5 `physpell_up`; stackingType 11, maxStackCntKey `max_stack` (no priority key: own timers) | Fervent Morale |
| buff_…_talent1_exist, _talent2 | value holders (lifeType 1) attached by talents 1 and 2 | gates and values |
| combo_skill_count1–4 | duration 6 s, stackingType 9 | created by game code (the combo trigger) |
| potential_5_effect, _effect_layer, _soldier_end | visuals / FinishOwner | none |

### Operator

| # | Mechanic (source) | Status | How / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4: 1 / 2 / 2 / 6 landings at 8 / 7, 14 / 9, 15 / 3, 5, 7, 11, 13, 15 (SkillData; L12 atk_scale 0.52 / 0.32 / 0.37 / 0.14) | supported | kit-draft as is (`atb` is 0 in the level table) |
| 2 | Attack 5, Final Strike: f16, poise 18 and `atb` 20 only as the controlled operator ("As the controlled operator, Final Strike also deals {poise} Stagger") | supported | `poiseControlledOnly`, `sp: {if: controlled}` |
| 3 | Finisher: atk_scale (9.0 at L12) × 0.1, 0.1, 0.8 (BreakingAttackCalculation) | supported | `factor`; finisher SP by the engine |
| 4 | Dive attack (plunging_attack_end, f3, 1.8) | supported | rotations can't reach it (S10) |
| 5 | Battle skill "The Pulverizing Front": hit 1 at 28 (`atk_scale`, poise 5), hit 2 at 38 (`atk_scale2`, poise 5) with Breach before its damage; team energy at 38; cost 100 SP; windows 45–55 battle skill, 48–55 basic | supported | kit-draft (`applies: breach` on hit 2; `teamEnergy` 38) |
| 6 | Battle skill SP "based on the number of Vulnerability stacks consumed": SaveBuffStackNum of Vulnerable on the targets before the FractureAction, SwitchAction 1→atb1, 2→atb2, 3→atb3, 4→atb4 (L10+: 5 / 15 / 25 / 35; L1–9: 5 / 10 / 20 / 30); none without stacks | data | kit-draft writes `sp: atb1` on hit 2 (wrong; D3's open "Switch-chosen SP", shared with Alesh). Exact today: a trigger on his own Breach (`physicalStatus breach`, `fromKinds: [battle]`), whose `eventCount` is the Breach level = stacks consumed, with an `sp` action `atb1 + Σ (atb_k − atb_{k−1}) × min(1, max(0, n − k + 1))` (kit plan). A Breach on an enemy without stacks is only a Vulnerable stack (status.ts), and the data gives no SP then either |
| 7 | Breach strength (level = stacks consumed, Physical DMG taken × Arts Intensity) | supported | status.ts; 7e19 t=14984 Breach hit matches at level 4 |
| 8 | P1: 15 SP returned "when hitting at least 2 enemies" (CheckEntityNum ≥ 2) | supported | inert with one enemy (`targetsHit` is 1); not written |
| 9 | Combo trigger: "When Crush or Breach consumes the enemy's Vulnerability stack(s)" (game code; anyone's) | supported | trigger `physicalStatus [crush, breach]`, `by: anyone` → `openCombo` (window 6 s = the count buffs' 6 s) |
| 10 | Combo paths: "a number of slash sequences (up to 3) based on the max number of Vulnerability stacks consumed … Consuming 4 stacks enhances the 3rd": count buffs 1–4 (6 s, game code), f0 jumps ≤1 → 600, 2 → 400, 3 → 200, 4 → none | supported | composite, exact: four kit buffs `combo_count1–4` (6 s) applied by the combo trigger with `layers: min(1, max(0, eventCount − k + 1))` (count k exists iff some event within 6 s consumed ≥ k: the same as the game's "highest count buff present"), `KitSkill.jumps` on them, `endBuff` of all four at the cast. kit-draft only notes the jumps (their condition reads game-code buffs) |
| 11 | Combo slashes per path (relative to the path start): 23 `atk_scale` (poise1, `usp` 10), 37 `atk_scale2` (poise1), 61 `atk_scale3` (poise3, 3 stacks) or `atk_scale4` (poise4, 4 stacks); SP `atb_n × atb_ratio` each (type 3); InterruptAction on each | supported | kit-draft's four hit entries with the jumps; InterruptAction is E1 (deferred) |
| 12 | Combo end per path: MarkCanInterrupt 80 / 280 / 450 and InterruptCurSkillAction 191 / 391 / 545 (1-stack path: exclusive 649, duration 728) | **gap** | **G2**: the loader keeps only the first MarkCanInterrupt (80), which the 2- and 3-stack paths jump over |
| 13 | Combo world slow-down per path (TimeDilationAction ComboSkill at 0 / 200 / 400 / 600) | supported | S3 (follows the jump decided at the cast) |
| 14 | Combo cooldown 18 s (17 at L12), P5 −2 s; P5 `atb_ratio` 1.2 | supported | loader (skillParamModifier, skillBbModifier) |
| 15 | Ultimate: rush at 76 (`atk_scale_rush` 3.0 at L12, poise 10), InterruptAction, time stop; cost 90, P4 ×0.85; a recast ends the previous state (FinishBuff at f0) | supported | kit-draft's rush hit; cost, time stop by the loader; the new state replaces the old buff |
| 16 | Shieldguard Banner state and Steel Oath: state buff from f77 (entity f3 after the f74 spawn) for `duration` 30 s; 5 count layers ("generating 5 points of Steel Oath") | supported | cast trigger (delay 77, launch 74, detached): kit buff `banner` + stack `steel_oath` set to 5 |
| 17 | Recast with points left: the old count layers keep their own 30 s (stackingType 2, max 99) and add to the new 5 | unknown | kit sets 5; needs two ultimates within 30 s with points unused (rare); not proposed as a test |
| 18 | Harass: "After an enemy suffers a Physical Status or takes DMG from Pogranichnik's combo skill, Pogranichnik consumes 1 point … and summons 1 Shieldguard": in-aura events 59 (anyone's physical status) and 101 (his combo's damage), count > 1, shared 0.1 s marker → `atk_scale_trigger` (1.0 at L12, mask 512, no poise), SP `atb_trigger` (10 at L10+) | supported | triggers on `physicalStatus` (`by: self` / `teammate`) and on his combo `hit`, with `buffActive banner`, a 0.1 s marker buff, `stack steel_oath atLeast 2`, `gain −1`, a `hits` action at +9 frames |
| 19 | Decisive Assault: "When the last Steel Oath point is consumed, all 4 Shieldguards initiate a Decisive Assault": count = 1 → four finish4 entities, one hit at +25 (`atk_scale_final` 4.5 at L12, poise 15, SP `atb_final` 40 at L10+), TakeDownAction 1.2 s, the state ends at +31 | supported | the same triggers with `below: 2`; TakeDownAction unknown as for Catcher's combo and Snowshine's ultimate (batch 2 / 3), not modelled; the state's end isn't needed (no points left) |
| 20 | Follow-up timing: data +9 / +25 frames; 7e19 has the harasses 0.54–0.68 s after the combo slashes that caused them and the Assault 0.44 s after Chen's Lift; the fourth harass 1.94 s after Ember's Knock Down | unknown | the entities' own TimeDilationAction (layer 1, 0.4 s) and the combo's world slow-down: "entity-layer slow-downs aren't modelled" (timeline assumptions; Ti1b family). Effect: a harass lands before or after the next slash, so it does or doesn't carry that slash's Fervent Morale (+8% ATK). Log timestamps for entities are coarse; not testable by hand |
| 21 | Vulnerable-only application and event 59 | supported | 7e19 t=25479: Chen's battle skill on an enemy without stacks (the Breach at 14984 took all four) gave no harass and no Morale although two points were left; her real Lift at 27753 did. The engine emits no `physicalStatus` for it (evidence for P1's "no", receiving side) |
| 22 | kit-draft's ultimate: 4 × 16 landings at the cast's frames, "lands always" | data | the compiler runs the in-aura buff's event handlers as if at the aura's start (known limit: event handlers, D4 open). Hand-written triggers replace them |
| 23 | Talent 1 "The Living Banner": "recovering {atb_gain} SP with his own skills grants Fervent Morale for {duration}s" (80 SP, P3: 60; natural SP of source type 3; one stack per SP event at most) | supported | composite, exact: stack `sp_banked`, `gains` of the same value on every hit that grants his skill SP (combo slashes, harass, Assault) and on the battle-skill SP trigger; `stackAtLeast` triggers (80, or 60 at P3+) → buff + `gain −atb_gain` (no grant is larger than the threshold, so one stack per event, as the data) |
| 24 | Fervent Morale: ATK +`atk_up` (0.08 at talent level 2, formulaItem 6), Arts Intensity +`physpell_up` (8), 20 s, "Duration of each stack is counted separately", 3 stacks, P3 5 on self | supported | layered self buff, `maxStacks {talent: 0, key: max_stack_owner}` (the loader applies P3: 5) |
| 25 | Talent 2 "Tactical Instruction": "Any operator triggering the ultimate's subsequent effects also gains Fervent Morale for {duration}s" (talent2 `duration` 5 / 10 s; owner's cap max_stack_owner, others' max_stack_team 3; requires talent 1) | supported (but G3) | event 59 by a teammate: team buff `to: eventSubject` (layers per recipient); by himself and event 101: a second self buff of 10 s. **G3**: in the game both self sources are one buff with one cap of 5 |
| 26 | SP source of the harass and Assault (`atb_trigger`, `atb_final` are ObtainCostActions in the entity files, type 3) | **gap** | **G1**: the hits' SP events have no `sourceType`, so a `sourceTypes: [3]` trigger (Thermite Cutter, Rossi's) misses them |
| 27 | P2 Will +20, Physical DMG +10%; P3 talent values; P4 cost ×0.85; P5 cooldown −2, atb_ratio 1.2 | supported | loader |
| 28 | Talent bank reset (abilityEvent 150, out of battle), dash attack | not modelled | outside a fight; S5 (deferred) |

### Weapons

Permanent lines (stat panel): Glorious Memory Agility (`wpn_attr_agi_high`),
Crit Rate, skill 3 ATK + `atk_up` (cardAttributeModifier); Grand Vision
Agility, ATK, skill 3 Arts Intensity + `phy_spell_up`; Lupine Scarlet
Agility, Crit Rate, skill 3 ATK + `atk_up`; Complexed Industry Will,
Electric DMG, skill 3 ATK + `atk_up`; Farsight main attribute, Arts
Intensity (skill 3 has no permanent line).

| # | Mechanic (source) | Status | How / what's missing |
|---|---|---|---|
| W1 | Glorious Memory: "When the wielder's skill applies Vulnerability, during the next ultimate cast within {duration}s, the wielder gains DMG Dealt +{dmg_up}. Max stacks … {max_stack}. Duration of each stack is counted separately. Effect only triggers once every 0.5s." Data: abilityEvent 206 + CheckBuffIdInContext **checkType 1** (the tag query, 1075718177 Vulnerability; the listed `buff_common_originum_frozen` is ignored with checkType 1, so batch 2's note that it names the crystals is misleading) + CheckOriginSkillType [2, 6, 7] + marker `cd` → `_exist` (stackingType 2, max 3, 30 s); ultimate cast → `_valid` (attributes 50–54 + dmg_up × layers, CreateBuffAttachingSkill), whose end clears `_exist` | supported | as Aspirant (wpn_sword_0015): layered buff with `consumedBy: [ultimate]`, trigger `vulnerable` `fromKinds [battle, combo, ultimate]`, cooldown `cd`. 7e19: Chen's ultimate hits carry `_valid` 1.008 = 3 × 0.336 (L9) on all five elements |
| W2 | Glorious Memory and Grand Vision's `_valid` is a buff on the wielder for the cast's duration (CreateBuffAttachingSkill), so it reaches the status hits and triggered hits that cast causes | **gap** | **G5**: the engine's consumed buffs act only on hits carrying the cast's index; physical-status hits and trigger hits don't |
| W3 | Glorious Memory's and Grand Vision's toggleBuffs: `buff_wpn_lance_0003` (Pathfinder's Beacon's ATK formulaItem 6 + atk_up) under CheckCurHpRatio ≥ `hp_ratio`, a key neither skill defines; Glorious Memory passes its own `atk_up` (19.6% at L9), Grand Vision has no `atk_up` | unknown | not modelled (the description has one ATK line). If the game applies it, Glorious Memory's ATK counts twice; 7e19's Chen drift fits a true 1 + ATK% about 1.57 instead of 1.35 with a lower base (batch 3, Chen's report), which +19.6% would be part of. Settled by test 75 (below) |
| W4 | Grand Vision: "When the wielder applies Originium Crystals or Solidification, during the next battle skill or ultimate cast within {duration}s, the wielder gains Physical DMG Dealt +{phy_dmg_up}. Effects of the same name cannot stack." Data: abilityEvent 206 checkType 0 [buff_common_originum_frozen] or checkType 1 tag 1535684437 → `_exist` (stackingType 9, `duration` 20 s); cast of type [2, 7] → `_valid` (attribute 50) | supported (but G5) | plain buff `consumedBy [battle, ultimate]`; triggers `buffApplied gameBuffs [buff_common_originum_frozen]` and `reaction [solidification]`, `by: self`. 7e19 t=33734: `_valid` 0.648 (L5) on the Endministrator's battle skill **and** its Crush (413,543) and crystal hits; not on her ultimate at 35661 (consumed). **The Endministrator's signature**: only her kit applies Originium Crystals; the Solidification half works for anyone |
| W5 | wpn_sword_0021_ink: the same WeaponBasicTable row as wpn_sword_0021 (same weaponSkillList, potential skill, templates); only `modelPath` and the ID differ (a skin) | **gap** | **G6**: equipment kits are found by weapon ID, so the variant gets no Grand Vision effect |
| W6 | Lupine Scarlet: "After the wielder's skill deals Critical DMG, the wielder gains 1 stack of Wolven Blood … Physical and Heat DMG Dealt +{dmg_up}. … {max_stack} stacks. After reaching {max_stack} stacks … another +{dmg_up2} for {duration}s. After the duration ends, all Wolven Blood stacks are removed." Data: abilityEvent 44, its CheckDamageDecorateMask 8960 **disabled** (any crit), `_layer` stackingType 2 max 16, lifeType 1 (no expiry); at ≥ 16 without `_final` → `_final` 20 s; `_final`'s end clears the layers | supported | as MI Security: trigger `hit` `crit: true`, layered buff, `buffLayers atLeast 16` → final, `buffEnded` → `endBuff`. 4e5e (Rossi): basic-attack crits and Bleed-tick crits add layers (t=4948 attack1, 6829 attack3, 35175 bleed), 16 reached at 13601, the final's layers gone at 35175: the mask really is off. Rolled crits only (expected crits trigger nothing, as MI Security) |
| W7 | Complexed Industry: "When the wielder's combo skill applies Electric Infliction, the wielder gains Arts Intensity +{phy_spell_up} and Electric DMG Dealt +{pulse_dmg_up} for {duration}s. Effects of the same name cannot stack." Data: abilityEvent 126 + CheckOriginSkillType [6] + CheckSpellInflictionType mask 2; two buffs, stackingType 11, priority key, max 1 | supported | trigger `inflictionApplied [pulse]`, `fromKinds [combo]`, `beforeDamage` (as Solemn Phalanx); the loader's stack group (B2). An Electric infliction that forms a reaction at once doesn't count (test 35's question) |
| W8 | Farsight: "When entering battle, the entire team gains Dream Striving … DMG Dealt +{dmg_up}, Arts Intensity +{phy_spell_up}, and DEF +{def_up} for {duration}s. When Dream Striving ends, the wielder restores the entire team for {hp_up_c} HP." Data: abilityEvent 6 → team buff (50–54, 87, 3 formulaItem 6; stackingType 1, priority dmg_up); buffEvent 2 → HealAction once | supported | trigger `fightStart` → team buff (DEF `percent` from the loader, V4), `buffEnded` → `heal team` (amount not modelled: N2) |

Signature weapons: Grand Vision is the Endministrator's. The others are
generic. On Pogranichnik, Glorious Memory only triggers when his Breach
hits an enemy without Vulnerability (it then only adds a stack: a
Vulnerability application) and Grand Vision never does; Thermite Cutter
(wpn_sword_0012, Rossi's report) is what he wears in 7e19 and fits him
(team ATK per skill SP).

## Gaps

### G1. SP kinds and sources of the files a skill reaches

- **family:** data compilation
- **feature:** `SkillData.spKinds` / `spSources` of a skill also hold the
  ObtainCostAction keys of the files its timeline reaches (SpawnAbilityEntity
  skills, helper casts, created buffs' handlers and the entities they
  spawn), where the key isn't already the skill's own, so a kit hit or
  trigger hit naming that key (`sp: "atb_trigger"`) gets the data's
  `natural` and `sourceType`. Alternative: `KitHit.spSource` written by hand.
- **evidence:** `chr_0029_pograni_ultimate_skill_abilityentity_attack2`
  ObtainCostAction `atb_trigger` atbSourceType 3, `…_finish4` `atb_final`
  type 3; the ultimate's own file has neither. 7e19: Thermite Cutter's
  `buff_wpn_sword_0012_atk_up` (CheckObtainAtbType type [3]) gets a new
  application at each harass and at the Assault (9 = 1 battle skill + 3
  combo slashes + 4 harasses + 1 Assault, listing by listing on the
  Endministrator's and Chen's hits).
- **impact:** with Thermite Cutter (and any `sourceTypes: [3]` effect),
  5 of his 9 skill SP grants per ultimate are invisible: shorter team ATK
  uptime (+14% per stack at L9, 2 stacks). His own kit writes
  `spKind: natural` by hand and banks talent 1's SP on the hits, so it
  doesn't depend on this.

### G2. Several MarkCanInterrupt on one timeline

- **family:** timing (S1 follow-up)
- **feature:** `SkillTiming.interruptibleFrom` becomes a list of frames;
  the action gate uses the first one the cast's playhead reaches that no
  taken jump skipped.
- **evidence:** `chr_0029_pograni_combo_skill` MarkCanInterrupt at 80, 280,
  450 (one per path; skillData.ts keeps the first). Also
  `chr_0038_purrche_normal_skill` (1007, 1429), `…_normal_skill_loop_1`
  (361, 675), `chr_0034_typhoea_floating_attack4` (58, 210, 359, 509,
  659), all top-level and enabled.
- **impact:** after a 2- or 3-stack combo, his actions outside the
  AllowNextSkillAction windows (ultimate, swap, as test 61 defines the
  mark) wait until the path's end (145 / 191 frames) instead of 50 / 80:
  3.2–3.7 s. Purrchena's and Typhoeus's later segments the same.

### G3. One buff applied with different durations

- **family:** buff lifecycle
- **feature:** trigger action `buff` (and `BuffApplication`) takes
  `duration?: ValueExpr`, the application's own duration instead of the kit
  buff's (the data's CreateBuff `assignItems` duration), so one kit buff
  keeps one layer cap.
- **evidence:** talent 1 creates `buff_chr_0029_pograni_talent1` with
  `duration` 20 (chr_0029_pograni_talent1); the in-aura buff creates the
  same buff with `duration_temp` = `buff_chr_0029_pograni_talent2.duration`
  (5 / 10 s) and `max_stack_owner`. 7e19 agrees with 10 s on teammates
  (Ember's from 25812 still on at 33152, Chen's from 27753 at 36117).
- **impact:** the kit's two self buffs (20 s and 10 s) can hold up to 5
  layers each, the game 5 in all: up to +8% ATK and +8 Arts Intensity per
  extra layer while both are full (rare: 7e19 peaks at 5).

### G4. `zmdlogs reactions` maps a key to its first kit hit

- **family:** log tooling
- **feature:** the replay maps the n-th logged landing of a cast's event key
  to the n-th kit landing with that key (frame order), or tries each
  candidate as `zmdlogs check` does, so applications on later landings
  replay.
- **evidence:** both battle-skill landings are logged as
  `chr_0029_pograni_normal_skill`; the replay takes `hit` (no status) for
  both, so the Breach at 14984 is "unexpected" and Chen's Lift at 25479 is
  "predicted but not logged". With the second landing given its own key
  in a scratch fixture: the Breach matches and the 25479 Lift prediction
  goes (3 matched, 1 predicted, 4 unexpected, all Ember's and the
  Endministrator's Crush).
- **impact:** log tooling only: every multi-landing skill whose later
  landing applies something.

### G5. What a cast-consumed buff reaches

- **family:** buff lifecycle
- **feature:** a `consumedBy` buff standing for a CreateBuffAttachingSkill
  buff acts on all its owner's hits from the consuming cast's start until
  that cast ends (its physical-status hits, reaction hits, trigger hits),
  not only on hits with the cast's index; buffs whose data checks the cast
  ID (Jade Vessel's CheckSkillCastId) keep today's rule. A field such as
  `consumedScope: "cast" | "whileCasting"` (default from the data where
  the loader can tell).
- **evidence:** 7e19 t=33734: `buff_wpn_sword_0021_valid` 0.648 on the
  Endministrator's battle skill, its Crush hit (`buff_physical_crushed`,
  413,543) and the crystal hit (`buff_common_originum_frozen`, 64,292).
  timeline.ts `eventDamage` computes status hits with no cast index, and
  trigger hits have none. Same data shape: Glorious Memory `_valid`,
  Aspirant `_pdi_up`.
- **impact:** Grand Vision on the Endministrator: her Crush (her largest
  hit) and the crystal hit miss +64.8% (L5) to +100.8% (L9) Physical
  DMG; the opener's total about −30%. Glorious Memory and Aspirant: the
  Lift / Knock Down hits inside the ultimate (Chen's none; others').

### G6. Weapon variants

- **family:** data compilation (loader)
- **feature:** a weapon without its own kit uses the kit of a weapon with
  the same `weaponPotentialSkill` and `weaponSkillList`; or `variants`
  on equipment kits as on operator kits.
- **evidence:** WeaponBasicTable `wpn_sword_0021_ink` equals
  `wpn_sword_0021` except `weaponId` and `modelPath`; it's the only
  such pair in the table (`efsim find "Grand Vision"` lists both).
- **impact:** a build with the variant loses Grand Vision's effect.

Referenced, not re-proposed: E1 (InterruptAction in the combo and the
rush), S5 (dash), S10 (dive), T5 (his own Breach while the combo is on
cooldown: ignored), P1 (row 21 is evidence for the receiving side),
D3's Switch-chosen SP (row 6), D4's event handlers and talents' attached
skills (rows 22–25: kit-draft compiles none of the talents), Ti1b /
entity-layer slow-downs (row 20), TakeDownAction (Catcher's batch-2
report row 15, Snowshine's row 29), N2 (Farsight's heal).

Not gaps, possible simplifications: a value for an `sp` event's amount
(`eventCount` of an `sp` event, row 23: one trigger instead of gains on
four hits) and a predicate on a combo's window count (row 10: no count
buffs). Both composites are exact.

## Verification

**7e19** (`fixtures/pending/zmdlogs-7e19489ae503.json`; Pogranichnik P4,
skills 9 / 10 / 12 / 10, Thermite Cutter 90 [9, 9, 5]; the Endministrator
with Grand Vision, Chen with Glorious Memory, Ember), `zmdlogs check` in
the scratch copy:

- before: 29 hits, 1 match (the Breach), 28 not covered (21% of his
  damage covered);
- with the draft kit: **29 match, 0 mismatch, 0 not covered (100%)**,
  every hit to the point; the other operators' lines unchanged (Ember 1 /
  0 / 3 / 17, the Endministrator 0 / 34, Chen 0 / 21). The fixture's build
  for him needs no correction.
- Assumptions the matches took: the Endministrator's unlogged crystal aura
  (K6) on his hits from 12542 to 14487 (her combo at 12296, consumed by
  his Breach at 14984); boundary buffs where his Fervent Morale or Thermite
  Cutter started at that hit.

What the log confirms structurally:

- Breach at 14984 at level 4, so the combo at 20300 is the 4-stack path:
  three slashes, the third `atk_scale4` (17,970).
- 4 harasses (20837, 21521, 22455, 27753) and the Assault (28190): 5 Steel
  Oath points. Triggers: the three combo slashes (event 101), Ember's
  Knock Down at 25812 and Chen's Lift at 27753 (event 59): Fervent Morale
  appears on Ember at 25812 and on Chen at 27753 as boundary entries, so
  the teammate who caused the status gets it (talent 2).
- Talent 1 at 60 SP (P3+) from his skill SP including the harasses: bank
  35 (battle skill, 4 stacks, L10) + 5 + 10 + 7 + 10 = 67 at the second
  harass (21521, boundary Morale), then 30 + 10 + 10 + 40 = 90 at the
  Assault (28190, boundary Morale). Talent 2 stacks at the slashes (20300,
  20837, 21811). Five on him from 28292 (P3's cap).
- Chen's battle skill at 25479 on an enemy without Vulnerability gave no
  harass and no Morale with two points left (row 21).

**The two claims from Chen's batch-3 report, checked:**

- "Pogranichnik's Breach consumed Vulnerable stacks before her Lift at
  25479": true. The Breach at 14984 is level 4 (all four stacks); no
  physical status lands between 14984 and 25479, so her 25479 Lift only
  adds a stack (no `buff_physical_airborne` hit is logged). `zmdlogs
  reactions` still predicts the Lift with the draft kit (2 matched, 2
  predicted, 5 unexpected, as before) because of G4; with the second
  battle-skill landing keyed apart it disappears and the Breach matches
  (level 2 in the replay: Ember's Knock Downs aren't replayed, no kit).
- "His weapon buff is listed 7–9 times on one of her hits": ZMDLogs lists
  `buff_wpn_sword_0012_atk_up` once per application (one per skill SP
  grant of his, 9 by 28292), and the game counts at most 2 (`max_stack`
  2): the Endministrator's logged damage rises ×1.043 from 1 to 2
  listings (15191 → 21521, attack 3) and not at all from 2 to 9 (attack 5
  at 20424 and 23673: 10,725 both). `zmdlogs check` already caps them at
  2 (`teamStackCaps`), so the listings don't explain Chen's ×0.959 on
  her second battle skill.

**Simulation** (scratch scenario, Chen P5 + Pogranichnik P5 with Glorious
Memory): Chen's combo Lift opens a harass and gives her Morale (10 s); his
Breach on 2 stacks gives a harass, the 2-slash path (slashes at +23, +37)
and a harass per slash; Chen's later Lift fires the Assault 25 frames
later. A Chen build with Glorious Memory gets 2 layers (battle skill +
combo) on all her ultimate hits, consumed by it.

**4e5e** (Lupine Scarlet on Rossi): the layer and final structure as in
W6; the values are Rossi's report's to check with his kit.

**Logs that would verify the rest:** Pogranichnik's 1-, 2- and 3-stack
combos; his ultimate cast twice within 30 s; any wielder of Complexed
Industry or Farsight; Grand Vision on a Solidification applier.

**In-game tests** (checked against docs/in-game-tests.md 1–76): none new
is needed for the kit.

- **75** (Chen's ATK panel): with Glorious Memory equipped, an ATK about
  +19.6 points of ATK% above `efsim calc` would mean the copied
  Pathfinder's Beacon toggle (W3) counts.
- **61** (MarkCanInterrupt): what the mark allows; G2 itself follows from
  the data.
- **39** (Vulnerable-only physical status, P1): 7e19 answers it for the
  receiving side (row 21); 401 / 402 on the applier's side stay its
  question.
- **35** (reaction-forming infliction): Complexed Industry's case.
- **60** (T5): his own Breach while his combo is on cooldown.

Lupine Scarlet's "any crit" (W6) is settled by 4e5e, so its would-be test
isn't proposed.

## Kit plan

Draft files, loaded with the real loader in the scratch copy
(`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-chr_0029_pograni/repo/packages/data/kits/operators/chr_0029_pograni.json`
and `…/kits/equipment/wpn_sword_0017.json`, `wpn_sword_0021.json`,
`wpn_sword_0022.json`, `wpn_sword_0024.json`, `wpn_sword_0026.json`): all
**load**; `vitest run` passes there (980 tests; three CLI / compiler tests
timed out at 5 s under load and pass with a longer timeout).

### Operator kit `chr_0029_pograni`

Talent indices: 0 The Living Banner (`chr_0029_pograni_talent1`), 1
Tactical Instruction (`buff_chr_0029_pograni_talent2`).

**Stacks:** `steel_oath` (max 5), `sp_banked` (max 1000).

**Buffs:** `combo_count1`–`combo_count4` (self, 6 s, gameBuff
`buff_chr_0029_pograni_combo_skill_countN`, no modifiers); `banner`
(self, `{key: duration, skill: chr_0029_pograni_ultimate_skill}` = 30 s,
gameBuff `buff_chr_0029_pograni_ultimate_skill`); `soldier_marker` (self,
0.1 s); Fervent Morale three times, each with
`[{zone: atk, value: {talent: 0, key: atk_up}}, {attr: 87, value: {talent: 0, key: physpell_up}}]`:
`fervent_morale` (self, `{talent: 0, key: duration}`, maxStacks
`{talent: 0, key: max_stack_owner}`), `fervent_morale_t2` (self,
`{talent: 1, key: duration}`, same cap; one buff with the first once G3
exists), `fervent_morale_team` (team, `{talent: 1, key: duration}`,
maxStacks 3: `max_stack_team` is only a SkillData default of
chr_0029_pograni_talent1, not a talent value).

**Skills:**

- attack1–5, power_attack, plunging_attack_end: kit-draft as is.
- normal_skill: hits at 28 (`atk_scale`, poise) and 38 (`atk_scale2`,
  poise, `applies: [{kind: physicalStatus, status: breach}]`),
  `teamEnergy [{frame: 38, ratio: 1}]`; no `sp` on the hits (the trigger
  below gives it).
- combo_skill: kit-draft's four hits (frames 23 / 223 / 423 / 623;
  37 / 237 / 437; 61 `atk_scale4`; 261 `atk_scale3`), each with `sp`
  `{product: [atb_n, atb_ratio]}` and a `gains` of the same amount on
  `sp_banked` (`if: talentAtLeast [0, 1]`); `energy: usp` on the first;
  and

```json
"jumps": [
  { "at": 0, "to": 600, "if": { "not": { "buffActive": "combo_count2" } } },
  { "at": 0, "to": 400, "if": { "all": [{ "buffActive": "combo_count2" }, { "not": { "buffActive": "combo_count3" } }] } },
  { "at": 0, "to": 200, "if": { "all": [{ "buffActive": "combo_count3" }, { "not": { "buffActive": "combo_count4" } }] } }
]
```

- ultimate_skill: the rush hit at 76 (`atk_scale_rush`, `poise_rush`);
  kit-draft's 64 entity landings dropped.

**Triggers:**

- `combo_window`: `physicalStatus [crush, breach]`, `by: anyone` →
  `openCombo`, then `buff combo_countK` with
  `layers: {min: [1, {max: [0, {sum: [{eventCount: true}, 1 − K]}]}]}`
  for K = 1…4.
- `combo_cast`: cast of the combo → `endBuff` of the four.
- `battle_sp`: `physicalStatus [breach]`, `fromKinds [battle]`, `by:
  self`, skill normal_skill → `sp` (`spKind: natural`) and `gain
  sp_banked` of

```json
{ "sum": ["atb1",
  { "product": [{ "sum": ["atb2", { "product": [-1, "atb1"] }] }, { "min": [1, { "max": [0, { "sum": [{ "eventCount": true }, -1] }] }] }] },
  { "product": [{ "sum": ["atb3", { "product": [-1, "atb2"] }] }, { "min": [1, { "max": [0, { "sum": [{ "eventCount": true }, -2] }] }] }] },
  { "product": [{ "sum": ["atb4", { "product": [-1, "atb3"] }] }, { "min": [1, { "max": [0, { "sum": [{ "eventCount": true }, -3] }] }] }] }] }
```

  (a `{switch}` value, D3, would replace it).
- `living_banner` / `living_banner_p3`: `stackAtLeast sp_banked` 80 (not
  P3) / 60 (P3+) → `buff fervent_morale`, `gain sp_banked
  {product: [-1, {talent: 0, key: atb_gain}]}`.
- `ultimate_state`: cast of the ultimate, `delay 77`, `launch 74`,
  `detached` → `buff banner`, `gain steel_oath {sum: [5, {product: [-1,
  {stackCount: steel_oath}]}]}` (set to 5).
- Six follow-up triggers, all with skill `chr_0029_pograni_ultimate_skill`
  and `if: {all: [{buffActive: banner}, {not: {buffActive:
  soldier_marker}}, <count>]}`, doing `gain steel_oath −1`, `buff
  soldier_marker`, a `hits` action, and Morale (`if: {all:
  [{talentAtLeast: [0, 1]}, {talentAtLeast: [1, 1]}]}`):
  - on `physicalStatus` `by: self`, on `physicalStatus` `by: teammate`
    (Morale `fervent_morale_team` with `to: eventSubject`), and on `hit`
    of his combo `by: self`;
  - each in two forms: `stack steel_oath atLeast 2` → harass
    `{scale: [atk_scale_trigger], damageType: ultimate, events:
    [chr_0029_pograni_ultimate_skill_abilityentity_attack2], frames: [9],
    sp: atb_trigger, spKind: natural, gains: [sp_banked atb_trigger]}`;
    `atLeast 1, below 2` → Decisive Assault `{scale: [atk_scale_final],
    poise: poise_final, events: […_abilityentity_finish4], frames: [25],
    sp: atb_final, spKind: natural, gains: [sp_banked atb_final]}`.

Waits on gaps: G1 (the follow-ups' SP source for others' triggers), G2
(combo path timing, loader only), G3 (one Morale buff). Not written: P1
(one enemy), E1, TakeDownAction, the state's end at the Assault (no points
left), the recast leftover (row 17), dash and dive.

### Equipment kits

- **wpn_sword_0017** Glorious Memory: buff `wpn_sword_0017.ready` (self,
  gameBuff `buff_wpn_sword_0017_exist`, duration `duration`, maxStacks
  `max_stack`, `consumedBy [ultimate]`, attrs 50–54 + `dmg_up`); trigger
  `vulnerable` `fromKinds [battle, combo, ultimate]`, `by: self`,
  cooldown `cd`. Waits on G5 for the cast's status and trigger hits; W3
  noted in sources.
- **wpn_sword_0021** Grand Vision: buff `wpn_sword_0021.ready` (self,
  gameBuff `_exist`, duration `duration`, `consumedBy [battle,
  ultimate]`, attr 50 + `phy_dmg_up`); triggers `buffApplied gameBuffs
  [buff_common_originum_frozen]` and `reaction [solidification]`, `by:
  self`. Waits on G5 (her Crush) and G6 (the `_ink` variant; until then
  a copy named wpn_sword_0021_ink.json would do).
- **wpn_sword_0022** Lupine Scarlet: buffs `layer` (self, maxStacks
  `max_stack`, no duration, attrs 50, 51 + `dmg_up`) and `final` (self,
  `duration`, attrs 50, 51 + `dmg_up2`); trigger `hit` `crit: true`,
  `by: self` → layer, then final `if: {all: [{buffLayers: layer,
  atLeast: 16}, {not: {buffActive: final}}]}` (16 is `max_stack` at every
  level); `buffEnded final` → `endBuff layer`.
- **wpn_sword_0024** Complexed Industry: buffs `intensity` (attr 87 +
  `phy_spell_up`) and `electric` (attr 52 + `pulse_dmg_up`), `duration`;
  trigger `inflictionApplied [pulse]`, `fromKinds [combo]`, `by: self`,
  `beforeDamage`.
- **wpn_sword_0026** Farsight: buff `dream` (team, gameBuff
  `buff_wpn_sword_0026_celebration`, `duration`, attrs 50–54 + `dmg_up`,
  87 + `phy_spell_up`, 3 + `def_up`); triggers `fightStart` → buff,
  `buffEnded dream` → `heal team`.

Each needs a test file and the operator an example scenario at the kits
phase; the 7e19 fixture can move from pending once the Endministrator's
and Chen's builds are settled (his own hits all match).
