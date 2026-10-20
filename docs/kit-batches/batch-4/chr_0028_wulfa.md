# Rossi (chr_0028_wulfa): gap report, batch 4

Operator: Rossi (`chr_0028_wulfa`, 6-star, Physical, sword; main attribute
Agility, secondary Intellect). Equipment (from [batch-4.md](../batch-4.md)):
Rapid Ascent (`wpn_sword_0011`), Thermite Cutter (`wpn_sword_0012`),
Eminent Repute (`wpn_sword_0013`), White Night Nova (`wpn_sword_0014`),
Never Rest (`wpn_sword_0016`).

Sources: rmxlinux 1.6 (the pinned submodule): SkillData
`chr_0028_wulfa_*` (attack1–5, power_attack, plunging_attack_start/end,
normal_skill and its projhit1–5, combo_1/2/3_skill, ultimate_skill and its
projhit, absorb_*, passive_cape), `sk_wpn_sword_0011/12/13/14/16`; BuffData
`buff_chr_0028_wulfa_*` (40 files) and `buff_wpn_sword_0011`–`0016*`;
TableCfg CharGrowthTable, CharacterPotentialTable, PotentialTalentEffectTable,
SkillPatchTable, WeaponBasicTable, I18nTextTable_EN. Every file needed was
in the checkout. `efsim kit-draft chr_0028_wulfa` was run. Log:
`fixtures/zmdlogs-4e5e1390085e.json` (§ Verification). Values at skill
level 12, talent level 2, weapon skill level 9, unless said.

## Mechanics

Enabled action `$type`s that matter (cameras, effects, sounds, animation,
root motion, voice and debug prints left out): basic attacks: DamageAction,
SimpleCalcBBAction (×0.5 / ×0.2 on the dynamic `atk_scale`), ObtainCostAction
(`atb`, controlled only), IfElse + CheckMainCharacterCondition, JumpToAction
and MarkCanInterrupt / InterruptCurSkillAction (attack4); power_attack:
3 DamageActions with BreakingAttackCalculation, GainBreakingAttackAtb,
PauseComboSkillTime, CreateBuff; normal_skill: ChannelingAction,
SimpleCalcBBAction, DamageAction, AirborneAction, CheckBuffStackNumAdvanced
(tag 1075718177, Vulnerable), ObtainUspInNormalSkill, JumpToAction 37 → 215,
MarkCanInterrupt 49–214, LaunchProjectile ×4 (projhit2–5), CreateBuff
(wolf_timer, smarttarget, normal_defup); projhit2–5: DamageAction (Heat),
CreateBuff `normal_bleed` (assignItems), ObtainCostAction (`usp_2`; P1
`atb_return`), FinishBuffAdvanced; combo_2: ChannelingAction, DamageAction,
CreateBuff (damagewait → combo_2_damage, qte listener, usetimer, usecount),
ObtainCostAction `usp`, TriggerComboSkillAction, SetSkillCdAtOnce,
ChangeSkillAction (slot → combo_3, 6 s), TimeDilationAction; combo_3:
CheckBuffStackNumByTag ×4 (Heat, Nature, Electric, Cryo tags) +
SaveBuffStackNumAdvanced + FinishBuffAdvanced (consumption), SimpleCalcBB
chain on the scale, ForEach AirborneAction + CreateBuff `buff_physical_no_guard`,
DamageAction, ObtainCostAction `usp_s`, CreateBuff `combo_criticalrate`,
SetSkillCdAtOnce, ChangeSkillAction, JumpToAction 0 → 212, MarkCanInterrupt;
ultimate: UltimateTimeAction, TimeDilationAction, ChannelingCastingAction
5.67 s, CreateBuff (damage immunity, `ult_crit_damage_up_to_bleed`,
`ult_stopenemy(_elite)`), SimpleCalcBB (P5), 27 DamageActions, SpellInfliction,
RandomAction (hurt animation only); buffs: DamageAction (bleed, crit extra
damage, combo_2_damage), HealAction, DamageScaleProcessor, InstantModifyAttribute.

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–3 (Seething Wolfblood): attack1 `atk_scale` 0.61 at f8; attack2 two landings f5, f9, each ×0.5 (SimpleCalcBB on the dynamic `atk_scale` before the first); attack3 f4, f12, each ×0.5, poise units `poise` 0; `atb` 0 | supported | hits with `factor` 0.5 (the draft's). 4e5e: 8 + 19 + 16 logged, all match |
| 2 | Attack4: controlled: 5 landings f6, 8, 13, 15, 23 ×0.2, MarkCanInterrupt 50–188, ends 188; not controlled: IfElse CheckMainCharacterCondition → JumpToAction 0 → 189, landings f195–213 ×0.5 (the ×0.2 at f6 is skipped, so 0.5, not 0.1) | supported | `jumps: [{at: 0, if: {not: {controlled: true}}}]`; second hit entry `factor` 0.5. kit-draft writes 0.1 (G3). 32 logged (controlled), all match |
| 3 | Attack5, Final Strike (mask 2097280) f15, 1.13; `poise` 18 and `atb` 21 only as the controlled operator ("As the controlled operator, Final Strike also deals {poise} Stagger") | supported | `finalStrike`, `poise`, `poiseControlledOnly`, `sp: {if: controlled, then: atb}`. 6 logged, match |
| 4 | Finisher: f6, f15 BreakingAttackCalculation `multiplier` 0.1 of `atk_scale` 9.0, f36 0.8; GainBreakingAttackAtb f36 | supported | two entries `factor` 0.1 (×2) / 0.8. 4e5e: hits 1–2 match; hit 3 is the killing blow (logged 39523 capped, `uncapped` 261745 = ×1.051 the plan) |
| 5 | Finisher frame 0: PauseComboSkillTime and `powerattack_resumecombo` pause the sequence-2 window (combo_usetimer, the QTE listener: PauseBuffTime) while a finisher runs | gap | part of **G1** (a window that pauses); small |
| 6 | Dive attack `plunging_attack_end` f1, 1.8 (mask 1152) | supported | not castable until S10 (open) |
| 7 | Battle skill Crimson Shadow, cost 100 SP: f16, f22 `atk_scale_1` ×0.3 each; f35 ×0.4 with AirborneAction (Lift, `forceAirborne` false) and `poise_1` 5; P1 ×1.15 on `atk_scale_1`. "Charges to the target to deal Physical DMG and apply Lift" | supported | three hits; `applies: [{physicalStatus: lift}]`. 4e5e 10016/10112/12219: match with one Link stack (+30%; G9) |
| 8 | Battle-skill team energy: ObtainUspInNormalSkill at f35, only if a hit landed (`trigger`) | data | `teamEnergy: [{frame: 35, ratio: 1}]` by hand: kit-draft doesn't compile ObtainUspInNormalSkill (batch 1's R3; G3) |
| 9 | "If the target already has Vulnerability stack(s), the skill also unleashes a Wolven Ambrage": f35 CheckBuffStackNumAdvanced tag 1075718177 ≥ 1, judged **before** the f35 Lift → `FollowAttackTrigger`; f37 JumpToAction → 215 when set; otherwise MarkCanInterrupt 49–214, end 214 | supported | `jumps: [{at: 37, if: {enemyVulnerable: 1}}]` (judged at the cast, S7; the data judges at f35, 1.2 s later: a Vulnerable stack added or expiring meanwhile flips it, small). kit-draft emits no `jumps` (G3). On a fresh enemy the f35 Lift only adds the first stack, so the skill ends without the wolf |
| 10 | Wolven Ambrage: f230 four LaunchProjectiles (projhit2–5), each `atk_scale_3` ×0.25 Heat (damageType 2, mask 4352), `poise_2` ×0.25 (15 in all); P1 ×1.15 | supported | four hits `launch: 230`, `element: fire`, `events` per projhit file. 4e5e: all four logged (13314, 13410), match with Link (projhit3 one Lupine layer off: L-g) |
| 11 | Wolven energy `usp_2` 10 and P1's SP `atb_return` 10 (atbGainMethod 1, atbSourceType 3), once per cast (gate: `wolf_timer` = 1, then finished) | supported | first projectile: `energy: usp_2`, `sp: {if: {potentialAtLeast: 1}, then: atb_return, else: 0}`, `spKind: returned` |
| 12 | Battle-skill / combo self buff `normal_defup`: ProdCalcZone side 1 `defup` −0.5 (Rossi takes half damage) during the follow-up and the combos | supported | no effect: operator HP isn't tracked (N2) |
| 13 | Talent 1 Nicks and Scratches: "After Wolven Ambrage deals DMG, Rossi applies Razor Clawmark to the target for {duration_bleed}s. This effect cannot stack. … takes {atk_scale_bleed} ATK (Rossi's) of Physical DMG per second and suffers Physical DMG Taken and Heat DMG Taken +{damage_up}". projhit tree: if `talent_1_x` → CreateBuff `normal_bleed` **before** the DamageAction (assigned `duration_bleed`, `atk_scale_bleed`, `damage_up`, …); bleed buffEventAction every `damage_interval` 1 s, first at once (waitFirstTriggerInterval false): DamageAction mask 0x90000000 (no skill type); damageModifier NormalCalcZone side 1 for damageType 0 and 2. Talent levels **set** `atk_scale_bleed` 0.25 / 0.30, `duration_bleed` 15 / 25, `damage_up` 0.06 / 0.12, overriding SkillPatchTable's 0.36–0.81 / 15 | supported | enemy kit buff `razor_clawmark` (`every: 1`, `tickOnApply`, two `damageTaken` modifiers), applied by the first projectile (`beforeDamage`, `if: {talentAtLeast: [0, 1]}`), trigger `buffTick` → hit `atk_scale_bleed`, `damageType: none`. 4e5e: 26 ticks, all match at 0.30 (the talent's value wins), 0.12 DMG Taken logged |
| 14 | Bleed tick DamageAction `takeAtkSnapshot: true` (also Combustion's `buff_common_burning_status`, Liino's and Tangtang's projectiles) | gap | **G5**: ticks use the ATK of the moment, not the application's. 4e5e can't tell (Rossi's ATK didn't change between ticks) |
| 15 | Bleed reapplied while active (stackingType 4, "cannot stack"): refresh or new instance | unknown | engine: replaced (a tick at once). One 0.3 ATK tick at most; not testable by hand |
| 16 | Twelve Rossi buffs (normal_bleed, bleed_effect, combo_2_damage, normal_defup, smarttarget, tut_*) carry the same template timeline: TickIntervalAction 0.1 s at frames 10–20 with a DamageAction on `atk_scale` (0.3). The logs never show them (0 defup / smarttarget / tut hits; bleed ticks 1 s apart; 3 combo_2_damage ticks per combo) | data | kit leaves them out; kit-draft compiles them as landings (G3) |
| 17 | Talent 2 Seething Blood: "When Rossi's skill deals Critical DMG to a Razor Clawmarked enemy, trigger another hit that deals {bleed_critical_damage_scale} ATK of Heat DMG and restores … HP. If the target is also Combusted, … ×{talent2_burning_damage_scale}". Bleed abilityEvent 43 + CheckTargetsEqual + CheckDamageDecorateMask checkType 1 mask 8960 (battle, ultimate, combo) → `normal_bleed_crit_extra_damage`: ×`burning_damage_scale` if Combusted, Heat DamageAction mask 0x80000000, HealAction; 0.12 / 0.24, P3 +0.08 | supported | trigger `{on: hit, kinds: [battle, combo, ultimate], crit: true}`, `if: {talentAtLeast: [1, 1]}` + `enemyBuff`, hit `bleed_critical_damage_scale`, `damageType: none`, `extraScale` ×1.5 on `enemyStatus: combustion`, `heals: self`. 4e5e: 6 hits match at 0.32, three within 96 ms. Only with rolled crits (**G6**) |
| 18 | Talent 2 cooldown: `addingCooldown` keyed `damage_cd` (P3: `bleed_critical_damage_interval` −0.5) but `hasAddingCooldown` false | supported | no cooldown (the log's three procs in 96 ms agree); P3's interval part is inert |
| 19 | Combo trigger: "When an enemy has both Vulnerability and Arts Infliction stacks." | supported | two triggers, `by: anyone`: `vulnerable` with `if` any infliction, `inflictionApplied` with `if: {enemyVulnerable: 1}` → `openCombo`. When the state holds as the cooldown ends: T5 (test 60) |
| 20 | Combo sequence 1 (combo_2): f13, f24 `atk_scale` ×0.35 each, `usp` 10 at f24; f24 CreateBuff `combo_2_damagewait` (×0.1, 3 ticks, 0.125 s, after 0.3 s) → `combo_2_damage` ticks f33, 37, 41 (detached); P1 ×1.15; cooldown 14 s | supported | three entries. 4e5e: 4 hits + 6 ticks, all match |
| 21 | Sequence 2 opens from sequence 1 itself: f37 (if a hit landed) TriggerComboSkillAction, SetSkillCdAtOnce combo_2 0, ChangeSkillAction combo slot → combo_3 for 6 s, `combo_usetimer` 6 s; AllowNext combo_3 from f37 | gap | **G1**: the engine ignores `openCombo` from the owner's own combo, so combo_3 can never be cast (scratch-only engine change confirms the rest works) |
| 22 | combo_3 cast → SetSkillCdAtOnce combo_2 isPercentage 1.0 functionType 1 (full cooldown from now), ChangeSkillAction back | supported | `cooldownGroup` on both (combo_3's own cooldown is 0), as Typhoeus's two combos |
| 23 | Sequence 2 not cast in 6 s: `combo_usetimer` ends → ChangeSkillAction back and SetSkillCdAtOnce combo_2 isPercentage 1.0 (the full cooldown starts then: ready about 21 s after sequence 1, not 14 s) | gap | **G2**; interim trigger on the timer's unconsumed end: `cooldown seconds: 7.233` (217 frames, exact while nothing else moves combo_2's cooldown). In-game test R2 |
| 24 | "If COMBO SEQUENCE 2 is cast with perfect timing": the QTE listener (from combo_2 f37) shows a ring 0.5 s later for `time_succeed` 0.4 s (combo_2 f52–64); pressing during it sets `EntityBB_Combo_QTE_Trigger`; combo_3 f0: if not → `timing_success` 0, JumpToAction 0 → 212 (hit at 227, `poise_f`); if so → hit at 29 with `poise_s`, +1 Vulnerable (`buff_physical_no_guard` after the Lift), 0.4 s hit-stop and time dilation | supported | buff `qte_ring` (cast trigger delay 52, duration `time_succeed`), combo_3 `jumps: [{at: 0, if: {not: {buffActive: qte_ring}}}]`, two hit entries. A rotation needs `at` to hit the ring; search can't wait for it (**G4**) |
| 25 | Sequence 2 hit: consumes the first infliction found (Heat, Nature, Electric, Cryo; one element at a time, so all), scale (stacks × `damage_add` + `atk_scale_s`) × `potential_atk_multiply` (1; P1 ×1.15 on both keys); Lift (not forced) only on a target that had an infliction; `usp_s` 10 if a hit landed | supported | `scale: []`, `scaleValue: {sum: [atk_scale_s, {product: [damage_add, {consumed: true}]}]}`, one `consumeInfliction` of four elements, Lift / Vulnerable `if: {consumedAtLeast: 1}`. kit-draft: "write it by hand" (G3). 4e5e 57521: match with 0 stacks consumed (needs G10 in the checker) |
| 26 | Sequence 2 crit buff `combo_criticalrate`: Crit Rate + `crit_increase_rate` 0.25, Crit DMG + `crit_damage_increase_rate` 0.5, `crit_increase_duration` 15 s, at the cast (f0 or f212) | supported | self buff from a cast trigger. 4e5e: crit hits ×1.333 for 15 s after both sequence-2 casts (G9) |
| 27 | Sequence 2's damage is logged under `chr_0028_wulfa_combo_2_skill` (57521; the only one logged), not the file holding its DamageAction | supported | `events: [combo_3_skill, combo_2_skill]`; the draft's per-file rule misses it (G3) |
| 28 | Ultimate "Razorclaw" Ambuscade, cost 110 (P4 ×0.85): 25 stabs `atk_scale_1` 0.24 Heat at f63–111 (RandomAction only picks the hurt animation; both IfElse sides deal the same), slash 1 f122 `atk_scale_2` 2.5, slash 2 f131 `atk_scale_3` 7.5 with SpellInfliction (Heat; both sides of its bleed check the same) and `poise` 25; time stop 0–57, damage immunity, ChannelingCasting 5.67 s | supported | three entries (the draft's duplicates merged). 4e5e: all 27 match with Link ×2 stacks and the crit buffs (G9) |
| 29 | "When this skill successfully scores a critical hit, it deals higher Critical DMG": f58 CreateBuff `ult_crit_damage_up_to_bleed` (autoFinishByAction, 5 s): InstantModifyAttribute attr 10 + `crit_damage_up_to_bleed` 0.6 under CheckDamageDecorateMask checkType 2 mask 512 | supported | self buff `endsWithCast`, `critDamage` `onlyKinds: [ultimate]`. 4e5e: crit / non-crit stabs = 2.6 = 1 + 0.5 + 0.5 (combo) + 0.6 |
| 30 | P5 Legendary Destination: f58 if `potential_5`: `atk_scale_1/2/3` × `potential_5_damage_scale` (1.1) and `crit_damage_up_to_bleed` += `potential_5_critical_damage` (0.3) | supported | `extraScale: [{value: potential_5_damage_scale, if: {potentialAtLeast: 5}}]`; buff value `sum` of both keys (0 below P5). 4e5e is P3: not verified |
| 31 | Ultimate enemy stop: `ult_stopenemy` on rank-1 enemies, `_elite` (TimeDilationAction on the enemy, 3.1 s) on rank 2 (CheckEnemyRank); none on bosses | gap | **G7** (small): no enemy-rank predicate; a `control` with `freezes` would carry it |
| 32 | P1 Origin of Admiration: ×1.15 on `atk_scale_1`, `atk_scale_3` (battle), `atk_scale` (combo_2), `atk_scale_s`, `atk_scale_f`, `damage_add` (combo_3); `atb_return` 10. P2: Agility +20, Crit Rate +7%. P3: talent-2 values. P4: ultimate cost ×0.85 | supported | loader (skillBbModifier, skillParamModifier, stat panel). P1 verified on battle and combo hits; P2 on the panel |
| 33 | Attribute nodes: Agility +10 / 15 / 15 / 20 | supported | stat panel |
| 34 | Cape passive (`passive_cape` → `passive_usp_detect` → `passive_cape_stack_effect` by energy ratio 35 / 70 / 100%); the ultimate's `CapeBuffStack`, `gear`, `AnimScale_Gear_*` keys are read by nothing (AnimScale stays 1) | supported | cosmetic |
| 35 | Referenced by no skill: `combo_1_skill` (not in the skill group: an older combo), `absorb_*` (QTE visuals), `ult_critical_firedamage`, `ult_potential5_damage_up`, `potential_5_effect`, `ult_pifeng_effect`, `dung_usp_gainratio`, `combo_1_*` buffs; `tut_*` buffs (tutorial) | supported | inert |

**Weapons**

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| W1 | Rapid Ascent: main attribute, Crit Rate (skills 1–2); `sk_wpn_sword_0011` has no cardAttributeModifier, its `buffs` give `buff_wpn_sword_0011` (lifeType 1): mask 768 (battle, ultimate) + damageType 0 → NormalCalcZone + `phy_dmg_up` 42% | supported | self buff from `fightStart`, `damageBonus` `elements: [physical]`, `onlyKinds: [battle, ultimate]` |
| W2 | Rapid Ascent: "Against Staggered enemies, battle skills and ultimates also gain DMG Dealt +{dmg_up}" (98%); the data's second modifier has only CheckPoiseValue (compare 1, 0: Staggered), no mask, so every hit | unknown | interim: the data (`if: {enemyStaggered: true}`, any hit). In-game test R1 |
| W3 | Thermite Cutter: Will, ATK % (skills 1–2), ATK +`atk_up` 28% (skill 3 cardAttributeModifier); abilityEvent 142 + CheckObtainAtbType method [0] type [3] (natural SP from a skill) → team ATK +`atk_up2` 14%, 20 s, `buff_wpn_sword_0012_atk_up` stackingType 11 priority `lv`, `max_stack` 2 layers with their own timers | supported | team buff `maxStacks`, trigger `{on: sp, natural: true, sourceTypes: [3]}`. Two wielders' copies add (B2's open residue). 7e19 (pending, Pogranichnik) lists up to 9 instances of 0.09 on one hit against the cap of 2: for the merge with his kit. Rossi never triggers it: her only skill SP is P1's, which is returned |
| W4 | Thermite Cutter: "or grants a Link state": abilityEvent 9 + CheckTargetsEqual + CheckBuffIdInContext `buff_common_affixes_combo_trigger` | unknown | interim: the wielder's combo casts (the engine gives a Link stack per combo). Whether a teammate's combo (Link on the wielder) counts: in-game test R5 |
| W5 | Eminent Repute: main attribute, Physical DMG, ATK +`atk_up`; abilityEvent 208 + Vulnerable tag + CheckConsumeBuffLayer → wielder ATK +(`atk_up_add` + `atk_up_mult` × stacks consumed), the team half (×0.5 on CharacterTeamFinder); `buff_wpn_sword_0013_atk_up` stackingType 1 priority, max 2 | supported | as Ancient Canal (wpn_claym_0014): `physicalStatus` crush / breach, `beforeDamage`, `eventCount`; a second kit buff for the others (`recipients: {not: {isOwner: true}}`, ×0.5), same `gameBuff` so the strongest acts. Rossi consumes no Vulnerability |
| W6 | White Night Nova: main attribute, Arts Intensity, Arts DMG +`spell_dmg_up` (attrs 51–54); abilityEvent 102 + tags Burning / Conduct → `buff_wpn_sword_0014_magic_up_ex` (attrs 51–54 + `spell_dmg_up2`, attr 87 + `phy_spell_up`, 15 s, stackingType 4) | supported | trigger `{on: reaction, statuses: [combustion, electrification]}`, by self, `beforeDamage` (forced reactions included, as Wulfgard's talent). Rossi: her ultimate's Heat infliction on another element's infliction is her Combustion |
| W7 | Never Rest: Will, ATK %, Physical DMG +`phy_dmg_up` (attr 50); abilityEvent 142 natural type-3 SP + TimedMarker `cd` 0.1 s → `buff_wpn_sword_0016_valid` (attr 50 `pd_up`): wielder `phy_dmg_up2` 14%, ForEach team member `phy_dmg_up3` 7%, 30 s, stackingType 11 priority `pd_up`, `max_stack` 5 own timers | supported | self buff + team buff (not the owner), `maxStacks`, `cooldown: cd`. B2's residue as W3. Never fires for Rossi (as W3) |
| W8 | Never Rest leftovers: `buff_wpn_sword_0016` only ends `_team` (created by nothing); toggleBuffs `buff_wpn_lance_0003` reads `atk_up` / `hp_ratio`, keys this skill lacks | supported | inert |
| W9 | Signature: none of the five is Rossi's. Thermite Cutter and Never Rest want natural skill SP (Pogranichnik, Camille, Alesh, Antal, Arclight, Xaihi, Akekuri: ObtainCostAction type 3 method 0); Eminent Repute wants Crush / Breach. Lupine Scarlet (`wpn_sword_0022`, in Pogranichnik's list) is what Rossi wears in 4e5e and keys on crits and Physical + Heat DMG, her two elements | supported | the merge may move Lupine Scarlet to this report (Pogranichnik's report W6 already verifies its layers on Rossi's 4e5e hits) |

**Log tooling**

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| L-a | MI Security's ATK buff (`buff_equipsuit_critsuitatk_01`, stackingType 8, 5 layers) is listed once at 0.05; L1 tries layers only when it finds the cap, and `teamStackCaps`' ID-prefix rule misses `passive_equipsuit_critsuit_01` | gap | **G8**; with it Rossi goes from 5 to 90 matches (×5 layers on 81 hits) |
| L-b | Link isn't logged and the checker doesn't model it (battle skill +30% at one stack, ultimate +30% at two) | gap | **G9** |
| L-c | Own kit buffs the log never lists: `combo_criticalrate` (15 s), `ult_crit_damage_up_to_bleed` (cast) | gap | **G9** |
| L-d | A hit value reading `{consumed: true}` throws in the checker (and in `calc`), so sequence 2 is never predicted | gap | **G10** |
| L-e | `zmdlogs reactions` takes the first kit hit with a logged event key: the battle skill's three landings share one key, so its Lift (12219) shows as "unexpected" | gap | **G11** |
| L-f | The log drops `buff_wpn_lance_0015_dmgup` (fire +9.6%) from 65597 ms on while the damage stays, like the annotated `atkup` at 49418 | supported | fixture note (§ Verification) |
| L-g | Lupine Scarlet: on hits at max layers the log lists one layer (0.016) fewer than the damage used (crit hits ×1.0088 against non-crits; projhit3 and a talent-2 hit at 13314) | supported | for Pogranichnik's report (Lupine Scarlet's kit) |

**Counts:** 51 rows (35 operator, 9 weapon, 7 log tooling): 36 supported,
10 gap (5, 14, 21, 23, 31, L-a to L-e), 2 data (8, 16), 3 unknown (15, W2,
W4), 0 unique?. Gap entries: G1 (rows 5, 21), G2 (23), G5 (14), G7 (31),
G8 (L-a), G9 (L-b, L-c), G10 (L-d), G11 (L-e); G3, G4 and G6 sit behind
supported or data rows (compiler output, search, crit mode). Nothing is unique: the QTE ring is Rossi's only (ShowComboRingQte
appears in no other file) but it is a buff and a jump; a combo opening its
own next sequence (G1) is new in the data, and the feature is a general
option of `openCombo`; Camille's Hunter Pursuit (her report G1) is a
different structure (a battle-button cast).

## Gaps

### G1. A combo that opens its own next sequence

- **family:** skills (states) / triggers.
- **feature:** the trigger action `openCombo` gets an optional `skills:
  [skill IDs]`: it opens a window only those skills can use, and is not
  subject to the rule that a combo's own events don't open its owner's
  window (`runTriggers`: `origin.operator === owner && origin.kind ===
  "combo"` → ignored). Its length: `seconds` (ValueExpr, default the 6 s
  COMBO_WINDOW_FRAMES), or until a named own buff ends (`whileBuff`), so a
  buff extended by `extendBuff` (the finisher's PauseComboSkillTime, row 5)
  extends it. Rossi: `{on: cast combo_2, delay: 37, do: [{kind: openCombo,
  skills: [combo_3], whileBuff: seq2_ready}, {kind: buff, buff:
  seq2_ready}]}`, and `{on: cast power_attack, if: buffActive seq2_ready, do:
  [{kind: extendBuff, buff: seq2_ready, seconds: <finisher length>}]}`.
- **evidence:** combo_2 f37–41 TriggerComboSkillAction (if a hit landed and
  `can_trigger_combo`), f37–58 ChangeSkillAction (slot 1 → combo_3, 6 s),
  AllowNextSkillAction 37–65 lists combo_3; CharGrowthTable: "Rossi's combo
  skill has 2 consecutive sequences". Scratch run without the origin rule:
  combo_3 casts at f37 of combo_2 (late path) or in the ring (perfect),
  both as the data says.
- **impact:** without it sequence 2 can't be cast: per combo (P1, L12)
  (3.45 + 2.07 × stacks) × ATK, 10 energy, a Lift, the perfect-timing
  Vulnerability, and the 15 s +25% Crit Rate / +50% Crit DMG buff that
  every later hit uses. Large.

### G2. A cooldown set to a fraction of the full one

- **family:** skills (cooldowns).
- **feature:** the `cooldown` trigger action gets `setFraction`
  (ValueExpr): each matching skill's cooldown starts anew at that fraction
  of its own full cooldown (SetSkillCdAtOnce functionType 1 with
  isPercentage), whether one runs or not.
- **evidence:** `buff_chr_0028_wulfa_combo_usetimer` buffEventAction (its
  end, unless `need_set_cd` was cleared by combo_3): SetSkillCdAtOnce
  combo_2 isPercentage true value 1.0 functionType 1. Typhoeus's two
  combos have the same action inside a cast, which `cooldownGroup` covers;
  here it runs on a buff's end.
- **impact:** interim literal (+7.233 s on the running cooldown) is exact
  until something else changes combo_2's cooldown (attribute 47 scales
  both alike). Without either, the combo is back 7.2 s early whenever
  sequence 2 is skipped.

### G3. kit-draft on Rossi's files

- **family:** data compilation (D3 / D4 open items and new ones).
- **feature:** what the compiler gets wrong or leaves out here:
  1. the template timeline (TickInterval 0.1 s, frames 10–20, DamageAction
     on the buff's default `atk_scale` 0.3) in 12 Rossi buffs is compiled
     as landings (defup 4–8, smarttarget 4, tut_* up to 12, bleed +16,
     bleed_effect 256, combo_2_damage +4); the logs have none. Why the game
     doesn't run them is unknown; a signature rule (that exact template)
     or a note would do;
  2. a buff created on the target whose buffEventAction deals damage every
     `damage_interval` (the bleed) becomes 64-landing hits per talent
     branch, five copies per projectile: it should become a kit buff with
     `every` / `tickOnApply` and a `buffTick` trigger hit, and the
     talent flags `talent_1_x > 0.5` a `talentAtLeast` (D4);
  3. landings after a jump use a factor from SimpleCalcBB actions the jump
     skips (attack4's second set 0.1 instead of 0.5);
  4. identical IfElse sides (the ultimate's hurt-animation roll, its bleed
     check before SpellInfliction) give duplicate hits; P5's SimpleCalcBB
     on the scales is left as `$atk_scale_1?` (D3 open);
  5. combo_3's scale (SaveBuffStackNumAdvanced of a buff created with
     count = consumed stacks) could be `{sum: [atk_scale_s, {product:
     [damage_add, {consumed: true}]}]}`, and its else-if element chain one
     `consumeInfliction` of four elements;
  6. ObtainUspInNormalSkill isn't compiled to `teamEnergy` (batch 1 R3);
  7. no `jumps` emitted for conditions it can say (attack4: controlled;
     battle skill: a Vulnerable-tag check at f35 → `enemyVulnerable: 1`);
  8. talent 2 (bleed abilityEvent 43 → crit extra damage) is emitted as
     branch hits at f230 instead of a crit-hit trigger;
  9. the event key of sequence 2 (row 27) isn't its file.
- **evidence:** the draft (`…/scratch-chr_0028_wulfa/draft.json`) against
  the SkillData above and the 4e5e log.
- **impact:** none on the simulation (kits are hand-written); the draft
  is long and misleading for this operator (92 hit entries, ~1,500
  landings in the battle skill alone).

### G4. Search and a short timing window

- **family:** search (skills / timing).
- **feature:** when a skill's `jumps` or hit `if` read an own buff that a
  pending trigger of the operator will apply shortly (`qte_ring` from
  combo_2's cast), search also tries the step at that buff's start, not
  only at the earliest legal frame.
- **evidence:** combo_3 f0 IfElse `EntityBB_Combo_QTE_Trigger`; the ring
  (combo_2 f52–64). The earliest start (f37) is always the late path.
- **impact:** found rotations miss the perfect-timing Vulnerability stack
  (one more Vulnerable for the next Lift / Crush / Breach and the combo
  trigger). Alternative interim the owner may prefer: assume the player
  always hits the ring (drop the jump).

### G5. Damage over time with an ATK snapshot

- **family:** values (with arts state for Combustion).
- **feature:** a periodic damage whose DamageAction has `takeAtkSnapshot`
  takes the attacker's ATK (and only ATK) when the buff or status is
  applied; its ticks keep it. Kit: `KitHit.atkSnapshot: true` on a trigger
  hit of a `buffTick`, the snapshot stored with the buff instance;
  `status.ts` stores the applier's ATK with Combustion.
- **evidence:** `takeAtkSnapshot: true` in `buff_chr_0028_wulfa_normal_bleed`,
  `buff_common_burning_status` (Combustion), `chr_0035_liino_ultimate_skill_projhit*`
  (5 files), `chr_0027_tangtang_normal_skill_water_projhit*`,
  `chr_0027_tangtang_ultimate_skill_1` (12 files, grep of SkillData and
  BuffData). 4e5e can't decide it (Rossi's ATK buffs were the same at
  every tick); in-game test R4.
- **impact:** a 25 s bleed or 10 s Combustion applied before an ATK buff
  (or after one ends) is off by that buff's share of ATK (e.g. +10–15%
  on those ticks).

### G6. Crit-triggered effects with expected crits

- **family:** triggers (randomness: owner's decision 2, batch 3).
- **feature:** `randomOutcomes` lists kits with `on: {event: hit, crit:
  true}` triggers (and equipment kits) as a random outcome, so search ranks
  over seeds with rolled crits, and `simulate` with `crit: expected` warns
  that such effects are off. Today "with expected, no hit counts as a crit
  for triggers" (design.md, Damage) and nothing says so.
- **evidence:** talent 2 (row 17), MI Security (suit_criti01), Lupine
  Scarlet's layers (Pogranichnik's report W6). Scratch smoke rotation
  (battle skill ×2, ultimate, both sequences; logged build at P5): rolled
  crits 397–432k over seeds 1–5, talent 2 9–11% of it; expected crits
  294k.
- **impact:** about −30% for this build in expected mode, silently; search
  undervalues Rossi and every crit-stacking build.

### G7. Enemy rank

- **family:** conditions.
- **feature:** predicate `enemyRank: [ranks]` from the scenario's enemy
  (CheckEnemyRank `enemyRankSet`: 1 normal, 2 elite; the rank's table
  source is to be found, EnemyTemplateDisplayInfoTable `displayType` is a
  candidate, a claim), so an ultimate's `control` with `freezes` can apply
  to normal and elite enemies only.
- **evidence:** ultimate f57–150 / f64–150: CheckEnemyRank 2 →
  `ult_stopenemy_elite` (TimeDilationAction on the enemy, 3.1 s), rank 1 →
  `ult_stopenemy` (2.87 s).
- **impact:** none against bosses (the fixtures' Rhodagn); against weaker
  enemies their clocks (inflictions, statuses, attacks) run on through
  the ultimate.

### G8. Layer caps of gear-set buffs in `zmdlogs check`

- **family:** log tooling (L1's follow-up).
- **feature:** `teamStackCaps` finds the applying skill by the buff file
  that creates the buff (its CreateBuff assignItems) or the kit buff's
  `maxStacks`, not by ID prefix: `buff_equipsuit_critsuitatk_01` is created
  by `buff_equipsuit_critsuit_01` from `passive_equipsuit_critsuit_01`
  (`max_stack` 5), which the prefix rule misses. (Scratch patch: also try
  the source ID without its trailing number.)
- **evidence:** 4e5e Rossi: from 7.2 s on every hit is ×1.1428 the plan
  (= (1.256 + 0.096 + 0.25) / (1.256 + 0.096 + 0.05): five layers, the
  log's one).
- **impact:** every MI Security wearer's hits mismatch once the set has
  stacked; Rossi 5 → 90 matches.

### G9. Assumptions the log can't show: Link and own buffs

- **family:** log tooling.
- **feature:** `zmdlogs check` tries, as it does unlogged cast buffs: Link
  stacks 0–4 on battle-skill and ultimate hits (the engine's values), and
  the operator's own kit buffs the log never lists (here
  `combo_criticalrate`, and `ult_crit_damage_up_to_bleed`, an
  `endsWithCast` buff that `unloggedCastBuffs` skips because it has no
  `consumedBy`), with and without.
- **evidence:** 4e5e: the battle skill's 8 hits fit one Link stack (+30%)
  and the ultimate's 27 two (+30%), the engine's values (test 8's
  question); crit hits 32344–46593 fit +0.5 Crit DMG for 15 s after a
  sequence-2 cast at about 31–32 s that left no hit (the log has no
  sequence-2 hit there; the buff shows it was cast), and the crit hits
  from 57521 to the end (ultimate, finisher) after the one at 57521; crit
  stabs fit +0.6 more.
- **impact:** 59 of Rossi's 162 hits need these assumptions (8 battle-skill
  hits, 27 ultimate hits, 24 other crit hits).

### G10. Consumed stacks in `zmdlogs check` and `calc`

- **family:** log tooling.
- **feature:** a hit whose values read `{consumed: true}` is tried at 0–4
  consumed stacks (as `eventCount` 1–4 is), and `calc` shows it at a
  stated count instead of failing ("value needs the consumed infliction
  stacks").
- **evidence:** `efsim calc` on any Rossi build fails; 57521 matches at 0
  stacks once tried.
- **impact:** sequence 2 is unverifiable and `calc` unusable for Rossi.

### G11. Several landings under one logged key in `zmdlogs reactions`

- **family:** log tooling.
- **feature:** the replay maps a logged event to the n-th kit landing with
  that key in the current cast (landing order), not always the first
  entry.
- **evidence:** 4e5e: Rossi's battle-skill Lift at 12219 is "unexpected";
  with the Lift entry first it matches but the two earlier hits then
  predict two false Lifts.
- **impact:** any skill whose landings share a key and differ in what they
  apply (Rossi's battle skill; combo_2 and combo_3 share one too).

## Verification

**Log:** `fixtures/zmdlogs-4e5e1390085e.json` (Rhodagn Lv90, a kill):
Rossi P3, skills 12/12/12/12, Lupine Scarlet 90 [9, 9, 4], Redeemer gloves
and three MI Security pieces; team Camille (no kit), Estella, Gilberta. 162
of her hits. In the scratch copy with the draft kit:

| checker | match | mismatch | unmodelled | not covered |
|---|---|---|---|---|
| no Rossi kit | 0 | 0 | 1 | 161 |
| draft kit, checker as in the repo | 5 | 115 | 42 | 0 |
| + G8 (layer caps) and G10 (consumed counts) | 90 | 30 | 42 | 0 |
| + G9's assumptions and the log's dropped Camille buffs (L-f, the fixture's own note) | 161 | 1 | 0 | 0 |

The other three operators' lines don't change (Estella 26 / 0 / 15,
Gilberta 44 / 0 / 14). The last row's assumptions, per hit: one Link stack
on the 8 battle-skill hits; on the 27 ultimate hits two Link stacks, both
crit buffs and Camille's buffs; the combo crit buff on 24 other crit hits
(32–47 s, and the two finisher hits); Camille's ATK +9.6% on 15 other hits
after 49418 as the fixture's note says (from 65597 also her Heat DMG
+9.6%, L-f); and one more Lupine layer on two hits at 13314 (L-g). The one
left is the killing blow (finisher hit 3: `uncapped` 261745 is ×1.051 the
plan; the log's own overkill estimate).

- **Confirmed:** every event key (sequence 2 under combo_2's key, the
  Lift as `buff_physical_airborne`), landing counts (2 / 2 / 5 / 1, battle
  3 + 4 wolves, combo 2 + 3 ticks, ultimate 25 + 2, finisher 3), all
  factors (attack2/3 ×0.5, attack4 ×0.2, battle 0.3 / 0.3 / 0.4 and 4 ×
  0.25, combo 0.35 / 0.35 / 3 × 0.1, finisher 0.1 / 0.1 / 0.8), P1's
  ×1.15, the talent levels' **set** values winning over SkillPatchTable
  (bleed 0.30 ATK per tick, not 0.81; DMG Taken 0.12; 26 ticks over the 25
  s plus time stops), talent 2 at 0.24 + P3 0.08 with no cooldown and no
  skill type (no Link on it), sequence 2's scale at 0 stacks (3.45), the
  ultimate's crit DMG +0.6 and the combo's +0.5, Link's values (battle
  +30% at one stack, ultimate +30% at two), Heat on the wolves, stabs and
  slashes.
- **Build:** the fixture's assumed build fits (every hit before 7.2 s is
  1.000 of the plan); no correction. Two fixture-note corrections to
  propose (not made): the hand annotation's "Rossi ×1.0735 with his 5%
  crit-set ATK" assumes one MI Security layer (with five it is ×1.064),
  and Rossi is "her" in the game's text; and `buff_wpn_lance_0015_dmgup`
  also drops out of the log from 65597 ms while the damage stays (L-f).
- **Reactions** (`zmdlogs reactions`): 8 matched, 1 predicted not logged,
  10 logged not predicted, as without the kit except that Rossi now
  declares inflictions; her Lift at 12219 is one of the 10 (G11).
- **Not in the log:** the not-controlled attack4, the dive attack, P1's
  SP, P4 / P5, the perfect-timing path (both sequence-2 casts look
  late or missed), Combusted talent-2 hits, any of the five weapons.
- **Simulation** (scratch, logged build at P5): the battle skill jumps on
  a Vulnerable enemy (wolves at 6.27 s for a cast at 4.53 s), the bleed
  ticks each second for 25 s, talent 2 fires on crits; sequence 2 needs a
  scratch-only change for G1, after which the late (f37) and perfect (f52)
  paths give one and two Vulnerable stacks.

**Logs that would verify the rest:** Rossi at P5 with a perfect sequence 2
on an inflicted enemy; a Combusted Clawmarked enemy (talent 2 ×1.5); any of
the five weapons; an ATK buff starting during a bleed (G5).

**In-game tests** (new, checked against docs/in-game-tests.md; related
existing ones: 8 Link values, the 4e5e log fits the engine's; 36 percentage
cooldowns; 60 a combo trigger during the cooldown, Rossi's trigger being a
state; 61 MarkCanInterrupt, Rossi's battle skill without Vulnerable is free
at about 1.6 s against its 7.1 s end):

- **R1 Rapid Ascent against a Staggered enemy** (needs Rapid Ascent on any
  sword user): basic attack 1 on the dummy before and during a Stagger,
  non-crit numbers. Description: ×1.3 (the Stagger's own DMG Taken); data:
  ×1.3 × (1 + 0.98 / (1 + the hit's DMG bonus)), about ×2.2–2.6. Low priority (a 6-star weapon).
- **R2 Rossi's combo cooldown without sequence 2** (needs Rossi): (a)
  sequence 1, then sequence 2 at once; (b) sequence 1 only. Stopwatch from
  sequence 1 to the combo's cooldown ending: data (a) about 15 s, (b)
  about 21 s; the engine without G2 says 14 s for (b). A 6 s difference.
- **R3 Perfect timing** (needs Rossi): on an enemy with one Vulnerability
  stack and an Arts Infliction, sequence 1 then sequence 2 inside the ring
  vs a second later: the Vulnerability counter goes up by 2 (Lift + the
  extra stack) or by 1. Medium.
- **R4 Damage over time and a later ATK buff** (needs any Combustion, e.g.
  Laevatain or Wulfgard, and a team ATK buff that can start mid-burn, e.g.
  Liino's Vocalist Stance; Rossi's bleed is the same question): Combustion
  tick numbers before and after the ATK buff appears: unchanged (snapshot:
  the data's flag) or up by the buff's ATK share. Higher priority: every
  Heat team.
- **R5 Thermite Cutter's Link part** (needs Thermite Cutter): a teammate's
  combo, then watch for the team ATK icon: data reading unknown (the
  wielder's own combo only, or anyone's). Low.

## Kit plan

Draft files (scratch copy
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch4/scratch-chr_0028_wulfa/repo/packages/data/kits/`):
`operators/chr_0028_wulfa.json`, `equipment/wpn_sword_0011.json`,
`wpn_sword_0012.json`, `wpn_sword_0013.json`, `wpn_sword_0014.json`,
`wpn_sword_0016.json`. All load with the real loader (`zmdlogs check`,
`calc` with each weapon, `simulate`); `calc` needs G10 for the operator kit
(a copy with sequence 2's scale replaced by `atk_scale_s` runs). Sequence 2
casts only with G1.

### Operator kit chr_0028_wulfa

- **Element** physical. **Stacks:** none.
- **Buffs:**
  - `razor_clawmark` (enemy, `gameBuff` `buff_chr_0028_wulfa_normal_bleed`,
    `duration: {key: duration_bleed, skill: normal_skill}`, `every: 1`,
    `tickOnApply`, modifiers `damageTaken` physical and fire `{key:
    damage_up, skill: normal_skill}`);
  - `seq2_ready` (self, `gameBuff` `…combo_usetimer`, 6 s, no modifiers);
  - `qte_ring` (self, `duration: {key: time_succeed, skill: combo_2_skill}`);
  - `combo_crit` (self, `gameBuff` `…combo_criticalrate`, duration
    `crit_increase_duration`, `critRate` `crit_increase_rate`, `critDamage`
    `crit_damage_increase_rate`, keys of combo_3);
  - `ult_crit_damage` (self, `gameBuff` `…ult_crit_damage_up_to_bleed`, 5 s,
    `endsWithCast`, `critDamage` `onlyKinds: [ultimate]`, value `{sum:
    [crit_damage_up_to_bleed, potential_5_critical_damage]}` of the
    ultimate).
- **Skills** (SkillData frames):
  - attack1 [8]; attack2 ×2 [5, 9] `factor` 0.5; attack3 ×2 [4, 12] 0.5;
    attack4 `jumps: [{at: 0, if: {not: {controlled: true}}}]`, ×5 [6, 8,
    13, 15, 23] 0.2 and ×5 [195, 198, 203, 205, 213] 0.5; attack5 [15]
    `finalStrike`, `poise`, `poiseControlledOnly`, `sp: {if: controlled,
    then: atb}`; power_attack ×2 [6, 15] 0.1 and [36] 0.8; dive [1]. Skills
    with several entries name `events` on each.
  - normal_skill: `teamEnergy: [{frame: 35, ratio: 1}]`, `jumps: [{at: 37,
    if: {enemyVulnerable: 1}}]`; `charge` ×2 [16, 22] `atk_scale_1` 0.3;
    `lift` [35] 0.4, `poise_1`, Lift; four wolves:
    ```json
    { "id": "wolf_1", "scale": ["atk_scale_3"], "factor": 0.25, "element": "fire", "frames": [230], "launch": 230,
      "events": ["chr_0028_wulfa_normal_skill_projhit3"], "poise": { "product": ["poise_2", 0.25] }, "energy": "usp_2",
      "sp": { "if": { "potentialAtLeast": 1 }, "then": "atb_return", "else": 0 }, "spKind": "returned",
      "buffs": [{ "buff": "razor_clawmark", "beforeDamage": true, "if": { "talentAtLeast": [0, 1] } }] }
    ```
    and `wolf_2`–`wolf_4` the same without energy, SP and buff (events
    projhit5, projhit2, projhit4).
  - combo_2_skill: `cooldownGroup: rossi_combo`, `available: {not:
    {buffActive: seq2_ready}}`; [13] and [24] `atk_scale` 0.35 (the second
    `energy: usp`); `ticks` ×3 [33, 37, 41] 0.1, `launch: 24`, events
    `buff_chr_0028_wulfa_combo_2_damage`.
  - combo_3_skill: `cooldownGroup: rossi_combo`, `available: {buffActive:
    seq2_ready}`, `jumps: [{at: 0, if: {not: {buffActive: qte_ring}}}]`:
    ```json
    { "id": "perfect", "scale": [], "scaleValue": { "sum": ["atk_scale_s", { "product": ["damage_add", { "consumed": true }] }] },
      "frames": [29], "events": ["chr_0028_wulfa_combo_3_skill", "chr_0028_wulfa_combo_2_skill"], "poise": "poise_s", "energy": "usp_s",
      "applies": [
        { "kind": "consumeInfliction", "elements": ["fire", "natural", "pulse", "cryst"] },
        { "kind": "physicalStatus", "status": "lift", "if": { "consumedAtLeast": 1 } },
        { "kind": "vulnerable", "stacks": 1, "if": { "consumedAtLeast": 1 } } ] }
    ```
    and `late` [227], `poise_f`, without the `vulnerable`.
  - ultimate_skill: `stab` ×25 [63, 65, 66, 69, 71, 74, 75, 77, 78, 80, 83,
    84, 87, 88, 90, 92, 94, 96, 97, 99, 102, 103, 106, 108, 111]
    `atk_scale_1`; `slash1` [122] `atk_scale_2`; `slash2` [131]
    `atk_scale_3`, `poise`, Heat infliction; all `element: fire` and
    `extraScale: [{value: potential_5_damage_scale, if: {potentialAtLeast:
    5}}]`.
- **Triggers:**
  - combo windows: `{on: vulnerable, by: anyone, if: {any: [enemyInfliction
    fire / pulse / cryst / natural]}}` and `{on: inflictionApplied, by:
    anyone, if: {enemyVulnerable: 1}}` → openCombo;
  - `seq2_open`: cast of combo_2, `delay: 37` → openCombo, buff
    `seq2_ready` (with G1: `{kind: openCombo, skills: [combo_3], whileBuff:
    seq2_ready}`);
  - `qte_ring`: cast of combo_2, `delay: 52` → buff `qte_ring`;
  - `seq2_cast`: cast of combo_3 → endBuff `seq2_ready`, buff `combo_crit`;
  - `seq2_timeout` (G2 interim): `{on: {event: buffEnded, gameBuffs:
    [buff_chr_0028_wulfa_combo_usetimer], consumed: false}, by: self}` →
    `{kind: cooldown, who: self, skills: combo, seconds: 7.233}` (with G2:
    `setFraction: 1`);
  - `ult_crit`: cast of the ultimate, `delay: 58` → buff `ult_crit_damage`;
  - `razor_clawmark_tick`: `{on: buffTick, buff: razor_clawmark}`, `skill:
    normal_skill` → hit `atk_scale_bleed`, `damageType: none`, events
    `buff_chr_0028_wulfa_normal_bleed` (with G5: `atkSnapshot: true`);
  - `seething_blood`:
    ```json
    { "on": { "event": "hit", "kinds": ["battle", "combo", "ultimate"], "crit": true }, "by": "self",
      "if": { "all": [{ "talentAtLeast": [1, 1] }, { "enemyBuff": "buff_chr_0028_wulfa_normal_bleed" }] },
      "skill": "chr_0028_wulfa_normal_skill",
      "do": [{ "kind": "hits", "hits": [{ "id": "extra", "scale": ["bleed_critical_damage_scale"], "element": "fire", "damageType": "none",
        "heals": "self", "extraScale": [{ "value": "talent2_burning_damage_scale", "if": { "enemyStatus": "combustion" } }],
        "events": ["buff_chr_0028_wulfa_normal_bleed_crit_extra_damage"] }] }] }
    ```
  - With G1's pause: `{on: cast power_attack, if: buffActive seq2_ready}` →
    `extendBuff seq2_ready` by the finisher's lock (65 frames, to check).
- **Not modelled:** `normal_defup` (damage taken), heals' amounts, the cape,
  the ultimate's enemy stop (G7), the template buff timelines.

### Equipment kits

- **wpn_sword_0011** Rapid Ascent: self buff `gameBuff`
  `buff_wpn_sword_0011`, `[{zone: damageBonus, elements: [physical],
  onlyKinds: [battle, ultimate], value: phy_dmg_up}, {zone: damageBonus,
  value: dmg_up, if: {enemyStaggered: true}}]`, applied at `fightStart`
  (R1 may add `onlyKinds` to the second).
- **wpn_sword_0012** Thermite Cutter: team buff `gameBuff`
  `buff_wpn_sword_0012_atk_up`, `duration`, `maxStacks: max_stack`, `atk`
  `atk_up2`; triggers `{on: sp, natural: true, sourceTypes: [3]}` and
  `{on: cast, kinds: [combo]}` (R5), by self.
- **wpn_sword_0013** Eminent Repute: self buff and team buff (`recipients:
  {not: {isOwner: true}}`), both `gameBuff` `buff_wpn_sword_0013_atk_up`,
  `atk` `{sum: [atk_up_add, {product: [atk_up_mult, {eventCount: true}]}]}`
  (team × 0.5); trigger `{on: physicalStatus, statuses: [crush, breach]}`,
  by self, `beforeDamage`.
- **wpn_sword_0014** White Night Nova: self buff `gameBuff`
  `buff_wpn_sword_0014_magic_up_ex`, attrs 51–54 `spell_dmg_up2`, attr 87
  `phy_spell_up`, `duration`; trigger `{on: reaction, statuses:
  [combustion, electrification]}`, by self, `beforeDamage`.
- **wpn_sword_0016** Never Rest: self buff (attr 50 `phy_dmg_up2`) and team
  buff (others, attr 50 `phy_dmg_up3`), both `gameBuff`
  `buff_wpn_sword_0016_valid`, `duration`, `maxStacks: max_stack`; trigger
  `{on: sp, natural: true, sourceTypes: [3]}`, by self, `cooldown: cd`.
