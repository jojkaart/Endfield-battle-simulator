# Alesh (chr_0024_deepfin): gap report, batch 3

Phase 1 (analysis only), against the engine as of ae1c4f6 plus the working
tree's in-progress K5 (natural / returned SP, `spKind`). Equipment covered
here ([batch-3.md](../batch-3.md)): wpn_sword_0019 (OBJ Edge of Lightness),
wpn_sword_0020 (Finchaser 3.0). No gear set.

Sources: rmxlinux `Json/SkillData/chr_0024_deepfin_*` (attack1–5,
power_attack, plunging_attack_start/_end, normal_skill, combo_skill,
ultimate_skill, dodge), `Json/BuffData/buff_chr_0024_deepfin_*`
(talent_1_auro, talent_1, potential_3, combo_camera), `sk_wpn_sword_0019`,
`sk_wpn_sword_0020`, `buff_wpn_sword_0019_up`, `buff_wpn_sword_0020_cryst`,
`buff_wpn_sword_0020_atk_up`; TableCfg CharGrowthTable, SkillPatchTable,
CharacterPotentialTable, PotentialTalentEffectTable, WeaponBasicTable,
I18nTextTable_EN; `efsim kit-draft chr_0024_deepfin`. The SkillData and
BuffData files weren't in the sparse checkout when this analysis started;
they were fetched mid-session (535e88f) and everything below is read from
them. No earlier report covers Alesh; facts reused from other reports
(tag 1535684437 = Solidified, CheckOriginSkillType 2 = battle skill,
damageTypeMask 16 = Cryo, primaryAttributeType 2 = Intellect, stackingType
4 refreshes) were re-checked against data where they matter.
No log fixture has Alesh or either weapon. Scratch:
`/tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/batch3/scratch-chr_0024_deepfin/`
(draft kits in `mykits/`, a repo copy with them in `repo/`, scenarios
`scen_*.json`).

## Skill values (SkillPatchTable, level 1 / 12)

| Skill | Values | Cooldown / cost |
|---|---|---|
| attack1–4 | `atk_scale` 0.18/0.39, 0.10/0.23, 0.28/0.62, 0.28/0.62; `atb` 0 | |
| attack5 | `atk_scale` 0.28/0.62 (two hits; `atk_scale_display` 1.24), `poise` 17, `atb` 19 | |
| power_attack (finisher) | `atk_scale1` 0.8/1.8, `atk_scale2` 3.2/7.2 (BreakingAttackCalculation, multiplier 1.0) | |
| plunging_attack_end | `atk_scale` 0.8/1.8, `atb` 0 | |
| normal_skill | `atk_scale` 2.0/4.5, `poise` 10, `atb_1`–`atb_4` 10/20/30/40 → 15/25/35/45 | 100 SP |
| combo_skill | `atk_scale_1` 0.33/0.75, `atk_scale_2` 1.0/2.25, `atk_scale_1ex` 0.53/1.2, `atk_scale_2ex` 1.6/3.6, `atb` 10/15, `atb_sp` 10, `poise` 10, `prob` 0.1, `usp_normal` 10 | 9 s / 8 s |
| ultimate_skill | `atk_scale` 4.36/9.8, `poise` 20, `atb` 20/25, `atb_up` 12/15 per kill, `atb_max` 100 | 100 energy, 20 s |

SkillData defaults the tables don't set (read by the engine through
`SkillData.defaults`): combo `prob_add` 0, `prob_max` 0, `rate` 10,
`potential_3` 0, `atk_up` 0.15, `Duration` 10; normal_skill `potential_1`
0, `potential_1_atb` 0; ultimate `potential_5` 0, `hp_tar` 0.5, `atk_up`
1.5, `kill_num` 0.

Action types per file (damage / resources / state / timing):
- attack1–5, plunging_attack_end: DamageAction, ObtainCostAction costType 1
  `atb` (atbSourceType 1, only if controlled); PushBack, ComboCache,
  AllowNextSkillAction (timing). attack5: two DamageActions at 18 (mask
  2097280, Final Strike; poise unit `$poise` onlyEnableForMainChar) and 19
  (mask 128; poise 0; the `atb`).
- power_attack: two DamageActions (BreakingAttackCalculation, multiplier
  1.0, mask 132) at 13 and 47; ObtainCostAction literal 0; GainBreakingAttackAtb
  factor 1; LaunchUpward / BlowOff (the controlled branch only, no status);
  buff_common_full_immune_medium, buff_common_power_attack_disable_cast_skill.
- normal_skill (frame 27): SaveBuffStackNumAdvanced on tag 1570888476
  (Cryo Infliction, the applyTags of buff_common_energy_shard_attached_cryst)
  → `num`; IfElse `potential_1` ≥ 1 → SimpleCalcBB `atb_n` += `potential_1_atb`;
  SwitchAction on `num` 1–4 → ObtainCostAction `atb_n` (atbSourceType 3,
  gain method 0: natural); DamageAction `atk_scale` (mask 4352) + poise;
  CreateBuff buff_common_obtain_ultimate_sp (if a target); ForceSpellStatusAction
  spellStatusType 2, count = consumedLayer = `$count` (the Cryo stacks),
  consumedType 2, only if CheckBuffStackNumByTag Cryo ≥ 1. HitStop 0.3 s.
- combo_skill: frame 10 SimpleCalcBB / StoreAttributeValue / CompareFloat /
  Probablity → JumpToAction 65 (the Rare Fin branch); normal hits at 22
  (ObtainCostAction `atb`, atbSourceType 3, then DamageAction mask 8192) and
  38 (DamageAction mask 12288 + poise; ObtainCostAction costType 0
  `usp_normal`); JumpToAction 64 → 120; Rare Fin hits at 77 (`atb`,
  `atk_scale_1ex`) and 93 (ObtainCostAction `atb_sp`, atbSourceType 0;
  DamageAction `atk_scale_2ex` + poise; `usp_normal`; IfElse `potential_3`
  → CreateBuff buff_chr_0024_deepfin_potential_3 on targetGroupKey team);
  HitStop 0.95 s (controlled) / 0.3 s at 38 and 93; JumpToAction 0 → 4 when
  no target within 4.5 m; AllowNextSkillAction 39–65, 94–120, 120–130
  (battle skill only); CreateBuff buff_chr_0024_deepfin_combo_camera
  (camera, no effect).
- ultimate_skill: UltimateTimeAction 0–77; ChannelingCastingAction 0–96
  (can't cast, can't switch); frame 90 SpellInfliction inflictionType 2
  (Cryo), IfElse (`potential_5` ≥ 1 and CheckHp isRatio < `hp_tar`) →
  `atk_scale` × `atk_up` else plain, DamageAction (damage type 4, Cryo,
  mask 4608) + poise, BlowOff; EventListenerAction 89–91 (`kill_num` += 1 per
  kill); frame 91 ObtainCostAction `atb_up` × `kill_num` + `atb`, capped
  at 100 (atbSourceType 3, natural); AllowNextSkillAction 96–113 (attack1,
  battle skill, combo); buff_common_damage_immune_ult_skill.
- BuffData talent_1_auro (on Alesh, lifeType 1): AuraAction giving
  buff_chr_0024_deepfin_talent_1 to the teammates (excludeOwner); abilityEvent
  102 (Alesh applies a buff) with CheckTimedMarker 'talent', CheckBuffIdInContext
  checkType 1 tag 1535684437 (Solidified) → ObtainCostAction costType 0
  `usp` + `usp_self`, CreateTimedMarker 'talent' `CD` (3) on Alesh.
  talent_1 (on each teammate): abilityEvent 102 by checkType 0
  buff_common_originum_frozen or checkType 1 Solidified → `usp` to Alesh,
  same marker on Alesh (targetSource 1). potential_3: attr 2 formulaItem 6
  `atk_up`, `duration`, stackingType 4.

## Mechanics

| # | Mechanic (source) | Status | Expressed as / missing |
|---|---|---|---|
| 1 | Basic attacks 1–4, one hit each at 7 / 5 / 13 / 15, Physical | supported | hits `atk_scale`, `element` physical (kit default) |
| 2 | attack5: two hits 0.62 at 18 and 19; the first is the Final Strike with 17 stagger only if controlled; `atb` 19 at 19 ("As the controlled operator, Final Strike also deals {poise} Stagger") | supported | `finalStrike`, `poise` + `poiseControlledOnly` on hit 1, `sp: atb` on hit 2 |
| 3 | Finisher: 1.8 at 13, 7.2 at 47 (multiplier 1.0), no SP of its own, enemy's finisher SP (GainBreakingAttackAtb) | supported | two hits; the multiplier is 1.0, so no `factor` |
| 4 | Dive attack 1.8 at frame 1 | supported | hit; rotations have no jumps (engine note) |
| 5 | Battle skill: 4.5 × ATK Physical at 27, poise 10, team energy at 27 | supported | hit + `teamEnergy [{frame 27, ratio 1}]` |
| 6 | Battle skill on a Cryo-inflicted target: consumes all Cryo stacks, forced Solidification of level = stacks consumed (ForceSpellStatusAction count = consumedLayer = `$count`) | supported (verbose); gap G2 for the compact form | five hits of branch `cryo` (`if enemyInfliction cryst minStacks 4…1`, else plain), each `applies [consumeInfliction cryst, forcedReaction solidification level n]` |
| 7 | Battle skill SP by stacks consumed: `atb_1`…`atb_4` (15/25/35/45), natural (gain method 0); "can only trigger 1 time, even if the skill hits multiple enemies" | supported | `sp` per branch hit, `spKind: natural` (K5, in progress); one enemy |
| 8 | P1 Super Salty Comeback: "SP Recovery grants an additional {potential_1_atb} SP" (+10, only with a consumption: the SimpleCalcBB is before the Switch) | supported | `sp: {sum: [atb_n, potential_1_atb]}` (default 0 below P1) |
| 9 | Combo trigger, part 1: "When the Arts Reaction … of a nearby target is consumed" (game code) | supported | trigger `on: statusConsumed`, `by: anyone` → `openCombo` |
| 10 | Combo trigger: Shatter (Solidification consumed by a physical status) | unknown (U1) | engine's `shatter` isn't a `statusConsumed`; draft opens the window on `shatter` too (hypothesis A); in-game test A |
| 11 | Combo trigger, part 2: "…or Originium Crystals of a nearby target is consumed" | gap G1 | no trigger on another operator's kit buff being consumed |
| 12 | Combo, normal path: 0.75 at 22 (SP `atb` 15, natural, before the hit), 2.25 at 38 (poise 10, `usp_normal` 10), then JumpToAction 64 → 120 | supported | hits `hook`, `slam`; the unconditional jump is read from SkillData |
| 13 | Rare Fin chance: `min(prob + Intellect × prob_add / rate, prob + prob_max)` (StoreAttributeValue primaryAttributeType 2, useFloor false), Probablity → JumpToAction 10 → 65 | supported | trigger `rare_fin`: cast of the combo, `delay 10`, `chance` (K1) → `jump` 10 → 65 (Catcher's event-driven jump) |
| 14 | Rare Fin path: 1.2 at 77 (SP `atb`), 3.6 at 93 (poise, `usp_normal`, SP `atb_sp` 10 of atbSourceType 0) | supported | hits `hook_ex`, `slam_ex`; skipped on the normal path by 64 → 120 |
| 15 | Talent 2 Veteran Angler: "Every {rate} Intellect grants Rare Fin catching chance +{prob_add} (max +{prob_max})": skillBbModifier set `prob_add` 0.002 / 0.005, `prob_max` 0.3, `rate` 10 on the combo | data | values reach the combo through `skillValues` over SkillData defaults; the data is continuous (useFloor false), not per full 10 INT as the text reads: ≤ 0.5 % chance difference |
| 16 | Combo jump at 0 → 4 when the target is beyond 4.5 m | supported | a conditional jump not listed isn't taken (target in range) |
| 17 | Combo cooldown 9 s / 8 s; casting it keeps the basic chain (dontInterruptCombo) | supported | data |
| 18 | P3 May the Willing Bite: "After catching a Rare Fin, the entire team gains ATK +{atk_up} for {Duration}s. This effect cannot stack." | supported | team buff `p3_atk` (attr ATK % via `zone: atk`, refreshed), applied by `slam_ex` after its damage, `if potentialAtLeast 3` |
| 19 | Ultimate: 9.8 × ATK Cryo at 90, Cryo Infliction, poise 20 | supported | hit `element: cryst`, `applies [infliction cryst]` |
| 20 | Ultimate SP: `atb` 25 on hit (natural), + `atb_up` 15 per target defeated, max 100 | supported (kills: N1) | `sp: atb` on the hit; kills deferred with multi-enemy support (N1) |
| 21 | P5 Mega Lunker Rumors: "Hitting a target below {hp_tar} HP increases the DMG Multiplier to {atk_up} times the original" (CheckHp isRatio < 0.5 → `atk_scale` × 1.5) | gap G3 | no enemy HP in the engine |
| 22 | P4 Insane Angling Set: ultimate cost × 0.85 | supported | skillParam cost (loader) |
| 23 | Ultimate timing: UltimateTimeAction 0–77, ChannelingCasting 0–96, AllowNext 96–113 | supported | data |
| 24 | Talent 1 Flash-frozen for Freshness, own Solidification: `usp` + `usp_self` (3 + 6 / 4 + 8) | supported | trigger `on: reaction [solidification]`, `by: self` → `energy {talent: 0, …}` |
| 25 | Talent 1, a teammate's Solidification: `usp` | supported | same, `by: teammate` |
| 26 | Talent 1, a teammate applies Originium Crystals (buff_common_originum_frozen) | supported | `on: buffApplied gameBuffs [buff_common_originum_frozen]`, `by: teammate` (T6) |
| 27 | Talent 1's single 3 s cooldown over the three cases (one timed marker 'talent' on Alesh) | supported | marker buff `talent1_icd` (3 s) checked and set by all three triggers; `CD` is a literal 3: the talent table's attached blackboard has only `usp` / `usp_self`, and the loader doesn't read BuffData defaults into talent sources (data) |
| 28 | P2 Calm and Tranquil: Strength +15, Intellect +15 | supported | stat panel (verified: Wisd 140.82 = 125.82 + 15) |
| 29 | Attribute nodes: Strength +10 / +15 / +15 / +20 | supported | stat panel |
| 30 | Hit-stops: combo 0.95 s (controlled) / 0.3 s at 38 and 93, battle skill 0.3 s | gap (known: batch-1 Ti1) | the engine doesn't model hit-stop (simulate's assumption list) |
| 31 | Dodge (chr_0024_deepfin_dodge: ComboCache / AllowNext to chr_0002_endminm_dash_attack, a copy in the data); camera buff; teleports; super armor | supported (no effect) | nothing to write |
| W1 | Edge of Lightness skill 3: "Secondary Attribute +{second_attr_up}" (attr 0, formulaItem 6, modifyAttributeType 2) | supported | stat panel |
| W2 | "After the wielder's skill recovers SP, the entire team gains Heat DMG Dealt and Electric DMG Dealt +{dmg_up} for {duration}s; max 3 stacks, each timed separately" (abilityEvent 142, CheckObtainAtbType obtainTypeList [3], method unchecked) | supported (interim); gap G4 for the exact filter | trigger `on: sp, kinds [battle, combo, ultimate]`, `by: self`; buff team, attrs 51 and 52, `maxStacks: max_stack` (stackingType 11) |
| W3 | Edge of Lightness skills 1–2 (wpn_attr_agi_mid, wpn_sp_attr_atk_mid) | supported | stat panel |
| W4 | Finchaser 3.0 skill 3: "ATK +{atk_up}" | supported | stat panel |
| W5 | "When the wielder's battle skill applies Solidification, target enemy suffers Cryo DMG Taken +{cryst_dmg_up} for {duration}s. Effects of the same name cannot stack." (abilityEvent 206, CheckOriginSkillType [2], tag Solidified; DamageScaleProcessor side 1, mask 16, stackingType 1) | supported | trigger `on: reaction [solidification], fromKinds [battle]`, `by: self` → enemy buff `damageTaken` cryst; stackGroup from `gameBuff` |
| W6 | Finchaser 3.0 skills 1–2 (wpn_attr_str_mid, wpn_sp_attr_crystdam_mid) | supported | stat panel |
| W7 | buff_wpn_sword_0020_atk_up (flat ATK, lifeType 1) | supported (no effect) | referenced by no SkillData or BuffData file |

Counts (38 rows): supported 33 (row 6 written as five branches until G2;
W2 with an interim filter until G4), gap 3 (G1, G3, row 30's known Ti1),
data 1 (row 15), unknown 1 (U1), unique? 0. Row 27's literal `CD` is a
small loader note (BuffData defaults of a talent's attached buff aren't
read), not a gap of its own.

## Gaps

### G1. A trigger on another operator's buff being consumed
- **family:** triggers (extends batch-2 T6, which gave `buffApplied` a
  `gameBuffs` filter).
- **feature:** `on: {event: "buffEnded", gameBuffs: [...], consumed?: true}`
  with `by` the buff's owner (anyone, teammate, self): a kit buff that stands
  for one of these BuffData buffs ends, whoever owns it. `consumed: true`
  narrows it to ends by an action before it ran out (an `endBuff`, a
  `consumedBy` cast; `remaining > 0`), not expiry and not a reapplication
  replacing it. Judged on the situation at the event, as T5.
- **evidence:** CharGrowthTable chr_0024_deepfin_ComboSkill: "When the Arts
  Reaction or Originium Crystals of a nearby target is consumed" (game code,
  conditionId empty). The Endministrator's kit consumes the crystals with
  `endBuff originium_crystals` in four triggers (crystals_status,
  crystals_breach, crystals_vulnerable, crystals_ultimate); events.ts
  `buffEnded` matches only the trigger owner's own buff.
- **impact:** with the Endministrator in the team, no Alesh combo window
  from her crystals: up to one combo per crystal consumption (3.0 × ATK, or
  4.8 × with a Rare Fin; 15–25 SP; 10 energy; P3's team ATK). The interim
  of copying her four consumption triggers into Alesh's kit (with `if:
  {enemyBuff: buff_common_originum_frozen}`) would work under T5 but ties
  his kit to hers; not proposed.

### G2. A forced reaction's level as a value
- **family:** arts state (and data compilation).
- **feature:** `forcedReaction.level` as a ValueExpr, evaluated after the
  hit's earlier applications, so `{consumed: true}` after a
  `consumeInfliction` gives "Solidification of the level of the stacks just
  consumed"; and the compiler emitting ForceSpellStatusAction
  `consumedLayer` / `consumedType` as that `consumeInfliction` plus the
  level.
- **evidence:** normal_skill ForceSpellStatusAction spellStatusType 2,
  `count` = `consumedLayer` = `$count` (SaveBuffStackNumAdvanced on the
  Cryo tag), consumedType 2. Shared: chr_0007_ikut_ultimate_skill_abentity
  (Arclight, spellStatusType 1, count = consumedLayer = `count`,
  consumedType 1).
- **impact:** none on numbers (the five-branch interim is exact); one hit
  instead of five, and `kit-draft` could compile it (today its draft has a
  level-less forced Solidification and no consumption).

### G3. The enemy's HP
- **family:** conditions, with new state (enemy HP); relates to batch-1 N1
  ("kills and HP", deferred because it has "no effect against one enemy").
- **feature:** the enemy's HP during a fight: its maximum (EnemyData
  attribute 1 at its level) minus the damage dealt so far, from a scenario
  start fraction (default 1.0); a predicate `{enemyHpBelow: fraction}`
  judged per hit (for `extraScale`, modifier `if`, hit `if`). Kills stay
  N1.
- **evidence:** PotentialTalentEffectTable chr_0024_deepfin_potential_5
  (`hp_tar` 0.5, `atk_up` 1.5); ultimate_skill frame 90 CheckHp isRatio
  compare 1 `$hp_tar`. Shared: Chen Qianyu P1 (chr_0005_chen_potential_1,
  "DMG Dealt +{extra_dmg} to enemies below {hp_remain} HP",
  buff_chr_0005_chen_potential_1 CheckHp).
- **impact:** at P5 (the default assumption in searches) every ultimate
  hit after the enemy falls below half HP deals 1.5 × (9.8 → 14.7 × ATK):
  over a full kill, roughly half of Alesh's ultimates, his largest hit.
  N1's deferral reasoning doesn't hold for this case: **for the owner**.

### G4. The SP's source type on the `sp` event
- **family:** values / resources (extends batch-2 K5, which adds
  natural vs returned).
- **feature:** the `sp` event carries the grant's atbSourceType (1 basic
  attacks, 3 skills, 0 finishers, perfect dodges and some extras), from
  SkillData per key as K5's `spKinds`, and `on: {event: "sp", sourceTypes:
  [3]}` filters on it.
- **evidence:** sk_wpn_sword_0019 abilityEvent 142, CheckObtainAtbType
  checkObtainType true, obtainTypeList [3], checkObtainMethod false. Type-0
  grants inside skills: chr_0024_deepfin_combo_skill `atb_sp`; type-1 grants
  in battle skills: buff_chr_0034_typhoea_normal_skill (Typhoeus).
- **impact:** small: with `kinds [battle, combo, ultimate]` the weapon also
  fires on those few grants (one extra layer, max 3, at a Rare Fin's
  frame 93 when worn by Alesh). Frontiers (suit_atb01: method [0], type
  [3]) has the same filter and is covered by K5 plus `kinds`.

### U1. Does Shatter count as an Arts Reaction consumed?
- **family:** arts state (same question as Liino's combo, batch-1 G7).
- **question:** Shatter removes Solidification (status.ts `shatter`), but
  the engine raises a `shatter` event, not `statusConsumed`. Hypothesis A:
  it counts (sk_wpn_lance_0013's "After consuming Solidification" listens
  to abilityEvent 208 on the Solidified tag, and Shatter is the usual way a
  Solidification is removed); B: only skills that remove a status count.
- **interim:** the draft opens Alesh's window on `shatter` too (A); without
  it his combo would almost never open (no current kit uses
  `consumeStatus`, so `statusConsumed` fires only through future kits).
  In-game test A.

### Compiler leftovers (D3, data)

`kit-draft chr_0024_deepfin` gets the frames, scales, event keys, masks,
combo SP and energy, Cryo infliction and team energy right. Missing or
wrong, each already in D3's scope: the kit `element` is the operator's
(`cryst`) although every DamageAction but the ultimate's is Physical
(damage type 0; per-hit element); no `poise` anywhere; the battle skill's
SwitchAction SP and ForceSpellStatusAction consumption and level (G2);
the Rare Fin Probablity branch (as a chance jump); the P3 CreateBuff; the
ultimate's SP is reported "with no landing" and as `atb_up × (kill_num +
1) + atb`, counting the kill listener's +1 once (it is `atb_up × kill_num
+ atb` = 25 with no kills).

## Verification

**Logs:** no fixture has Alesh, Edge of Lightness or Finchaser 3.0. A ZMDLogs
battle with Alesh would check: every hit's multiplier (event keys
`chr_0024_deepfin_*`); the combo's path (`chr_0024_deepfin_combo_skill`
hits of 0.75 / 2.25 vs 1.2 / 3.6), and so the Rare Fin rate against his
Intellect over many combos; P3's buff_chr_0024_deepfin_potential_3 on
teammates' hits after a Rare Fin; buff_wpn_sword_0020_cryst on Cryo hits
after his battle skill; buff_wpn_sword_0019_up layers on Heat / Electric
teammates' hits; and, from combo cast times, U1 (a combo right after a
Shatter with nothing else consumed) and G1 (after a crystal consumption).

**Scratch runs** (draft kits in the repo copy, with Estella, P5 Alesh,
`examples/estella-solidification` Estella build): Alesh's ultimate inflicts
Cryo, Estella's battle skill adds a stack, his battle skill consumes 2 and
forces Solidification level 2 (branch `cryo2`), Estella's combo Lift
Shatters it and opens his combo (U1 interim). Talent 1: 23.4 vs 11.4
energy at the combo cast with talent 1 at level 2 vs 0 (the +12). Rare
Fin: 3 of seeds 1–12 took the 10 → 65 jump (chance 0.17 at Intellect 141);
its hits land at +0.73 s and +1.27 s from the cast, and P3's ATK shows on
the next basic chain (+13 %); the next action is one frame later than on
the normal path (exclusiveFrame 130 reached after 75 vs 74 frames).

**In-game tests** (proposed for docs/in-game-tests.md; the owner has
every 5-star):

- **A. Does Shatter open Alesh's combo?** (ready, with Alesh and Estella;
  answers U1, and by analogy Liino's batch-1 G7.) Alesh's ultimate on a
  dummy (Cryo Infliction icon), then his battle skill: Solidification
  appears; his combo button should stay dark (an infliction was consumed,
  not a reaction: control). Then Estella's combo or battle skill (forced
  Lift) Shatters it (the Shatter number appears). A: Alesh's combo button
  lights within a moment; B: it stays dark.
- **B. Do consumed Originium Crystals open it?** (ready, with Alesh and the
  Endministrator; confirms G1's reading.) Endministrator's combo puts
  crystals on a dummy; let them run out (about 5 s) without a physical
  status: the button should stay dark (only consumption counts). Again,
  then her battle skill (Crush) consumes them: the button lights. If it
  lights on expiry too, G1 is "ends", not "consumed".
- **C. Solidification level follows the stacks consumed** (optional
  confirmation). The Solidification icon after his battle skill on 1 Cryo
  stack vs on 3 or 4 stacks: about 5.75 s vs 7.75–8.75 s by status.ts's
  durations (a stopwatch difference of 2–3 s).
- Not testable by hand: talent 1's shared 3 s cooldown (energy isn't
  displayed); the Rare Fin chance's continuous vs per-10-Intellect reading
  (under 0.5 % apart); Edge of Lightness counting the Rare Fin's extra SP.

Cross-check of existing tests: none covers Shatter as a consumption (test
35 is about reactions being applied; Liino's tests 26–28 about her
stances); test A adds it. Test 49 (Estella's talent on her own Shatters)
is unaffected and can share test A's setup.

## Kit plan

Files as they'd be written today; drafts in the scratch copy load with the
real loader (`efsim calc` on P5 builds with each weapon, `efsim simulate`
on the scenarios above, both on the working tree with K5's `spKind`).
Talent indices: 0 Flash-frozen for Freshness, 1 Veteran Angler.

### chr_0024_deepfin.json

- `element: "physical"` (default for hits); the ultimate's hit
  `element: "cryst"`.
- Basic attacks: one hit each (`atk_scale`, frames 7 / 5 / 13 / 15, `sp:
  atb`); attack5 hit 1 at 18 (`finalStrike`, `poise: poise`,
  `poiseControlledOnly`, `sp: 0`), hit 2 at 19 (`sp: atb`). Finisher hits
  `atk_scale1` at 13 (`sp: 0`), `atk_scale2` at 47. Dive `atk_scale` at 1.
- Battle skill: `teamEnergy [{frame: 27, ratio: 1}]`, five hits at 27 of
  branch `cryo`, each `poise: poise`; until G2:

```json
{ "id": "cryo4", "branch": "cryo", "if": { "enemyInfliction": "cryst", "minStacks": 4 },
  "scale": ["atk_scale"], "frames": [27], "events": ["chr_0024_deepfin_normal_skill"], "poise": "poise",
  "sp": { "sum": ["atb_4", "potential_1_atb"] }, "spKind": "natural",
  "applies": [{ "kind": "consumeInfliction", "elements": ["cryst"] },
              { "kind": "forcedReaction", "status": "solidification", "level": 4 }] }
```

  …`cryo3`, `cryo2`, `cryo1` alike, and `plain` (no `if`, `sp: 0`). With
  G2 it becomes one hit: `applies [consumeInfliction cryst, {forcedReaction
  solidification, level: {consumed: true}, if: {consumedAtLeast: 1}}]`, `sp:
  {if: consumedAtLeast 4, then: …}` (or a `min`/`sum` over `consumed`).
- Combo: hits `hook` (`atk_scale_1`, 22, `sp: atb`), `slam` (`atk_scale_2`,
  38, `poise`, `energy: usp_normal`), `hook_ex` (`atk_scale_1ex`, 77, `sp:
  atb`), `slam_ex` (`atk_scale_2ex`, 93, `poise`, `energy: usp_normal`,
  `sp: atb_sp`, `buffs [{buff: p3_atk, if: {potentialAtLeast: 3}}]`). The
  data's 64 → 120 jump does the rest; the Rare Fin branch is a trigger:

```json
{ "id": "rare_fin", "on": { "event": "cast", "skills": ["chr_0024_deepfin_combo_skill"] }, "by": "self",
  "delay": 10, "skill": "chr_0024_deepfin_combo_skill",
  "chance": { "min": [
    { "sum": ["prob", { "product": [{ "attr": 41 }, { "div": ["prob_add", "rate"] }] }] },
    { "sum": ["prob", "prob_max"] } ] },
  "do": [{ "kind": "jump", "skill": "chr_0024_deepfin_combo_skill", "from": 10, "until": 11, "to": 65 }] }
```

- Combo window triggers: `statusConsumed` by anyone → `openCombo`;
  `shatter` by anyone → `openCombo` (U1, hypothesis A; drop it if test A
  says B); crystals consumed waits on G1 (`on: {event: buffEnded,
  gameBuffs: [buff_common_originum_frozen], consumed: true}`, by anyone).
- Ultimate: one hit `atk_scale` at 90, Cryo, `applies [infliction cryst]`,
  `poise`, `sp: atb` (natural from `spKinds`). P5 waits on G3:
  `extraScale [{value: "atk_up", if: {all: [{potentialAtLeast: 5},
  {enemyHpBelow: 0.5}]}}]` (`hp_tar` as the fraction).
- Buffs: `p3_atk` (team, `gameBuff` buff_chr_0024_deepfin_potential_3,
  `zone: atk` `{key: atk_up, skill: combo}`, duration `{key: Duration,
  skill: combo}`); `talent1_icd` (self, 3 s, no modifiers).
- Talent 1, three triggers sharing the marker:

```json
{ "id": "talent1_self", "on": { "event": "reaction", "statuses": ["solidification"] }, "by": "self",
  "if": { "all": [{ "talentAtLeast": [0, 1] }, { "not": { "buffActive": "talent1_icd" } }] },
  "do": [{ "kind": "energy", "value": { "sum": [{ "talent": 0, "key": "usp" }, { "talent": 0, "key": "usp_self" }] } },
         { "kind": "buff", "buff": "talent1_icd" }] }
```

  `talent1_team_solidification` (same `on`, `by: teammate`, energy `{talent:
  0, key: usp}`) and `talent1_team_crystals` (`on: {event: buffApplied,
  gameBuffs: [buff_common_originum_frozen]}`, `by: teammate`, same). A
  trigger `cooldownGroup` would replace the marker, but nothing else needs
  it yet.
- No stacks, no `statusTweaks`, no energy blocks (no RefrainObtainUsp in
  his files).

### wpn_sword_0019.json (OBJ Edge of Lightness)

```json
"buffs": [{ "id": "wpn_sword_0019.dmg", "target": "team", "gameBuff": "buff_wpn_sword_0019_up",
  "duration": "duration", "maxStacks": "max_stack",
  "modifiers": [{ "attr": 51, "value": "dmg_up" }, { "attr": 52, "value": "dmg_up" }] }],
"triggers": [{ "id": "wpn_sword_0019.skill_sp", "on": { "event": "sp", "kinds": ["battle", "combo", "ultimate"] },
  "by": "self", "skill": "sk_wpn_sword_0019", "do": [{ "kind": "buff", "buff": "wpn_sword_0019.dmg" }] }]
```

Natural and returned SP both count (the method isn't checked), so no
`natural` filter; G4 replaces `kinds` with `sourceTypes: [3]`. Skills 1–2
and the secondary attribute are on the stat panel.

### wpn_sword_0020.json (Finchaser 3.0)

```json
"buffs": [{ "id": "wpn_sword_0020.cryo_taken", "target": "enemy", "gameBuff": "buff_wpn_sword_0020_cryst",
  "duration": "duration", "modifiers": [{ "zone": "damageTaken", "value": "cryst_dmg_up", "elements": ["cryst"] }] }],
"triggers": [{ "id": "wpn_sword_0020.solidified",
  "on": { "event": "reaction", "statuses": ["solidification"], "fromKinds": ["battle"] },
  "by": "self", "skill": "sk_wpn_sword_0020", "do": [{ "kind": "buff", "buff": "wpn_sword_0020.cryo_taken" }] }]
```

After the applying hit's damage (Alesh's ForceSpellStatusAction comes
after his DamageAction). ATK and skills 1–2 are on the stat panel;
buff_wpn_sword_0020_atk_up is unreferenced and left out.

## Kit (2026-10-20)

Written against main at 182f22b (batch-3 shared features T1–T4, V2–V4,
B1, B2, A1–A5, C1, N1, D1–D4 merged). No engine, loader or compiler code
changed.

### Re-analysis

Gaps:

| Gap | Now | How the kit uses it |
|---|---|---|
| G1 combo on Originium Crystals consumed | **done** (T2) | trigger `combo_on_crystals`: `on: {event: buffEnded, gameBuffs: [buff_common_originum_frozen], consumed: true}`, `by: anyone` → `openCombo`. Works with the Endministrator's kit as it is (her `endBuff originium_crystals` in the four consumption triggers is a consumption; expiry isn't) |
| G2 forced reaction level as a value | **done** (A3) | one battle-skill hit instead of five branches: `applies [consumeInfliction cryst, forcedReaction solidification level {consumed: true}]`, both `afterDamage` (A4: the data's ForceSpellStatusAction comes after the DamageAction); SP by nested `if consumedAtLeast 4…1` (SP is judged after the applications, so it sees the count). Compiler half still open (KNOWN entry) |
| G3 enemy HP | **done** (N1) | ultimate `extraScale [{value: atk_up, if: {all: [potentialAtLeast 5, enemyHpBelow 0.5]}}]`; 0.5 is `hp_tar`, a literal because `enemyHpBelow` takes a number. The scenario's `enemyHp` sets it; full by default, so P5 never acts unless a scenario says the enemy is below half |
| G4 SP source type | **done** (T3) | Edge of Lightness: `on: {event: sp, sourceTypes: [3]}` (was `kinds [battle, combo, ultimate]`): the Rare Fin's `atb_sp` (type 0) no longer adds a layer |
| U1 / A7 Shatter as consumption | **open**, interim | `combo_on_shatter` (`on: shatter`, by anyone → `openCombo`), hypothesis A; in-game test 63 |
| Row 30 hit-stop (Ti1) | open (batch 1) | not modelled |
| Row 27 talent `CD` literal (D4) | open | `talent1_icd` duration 3 (a BuffData default of the talent's aura; talent values don't read BuffData defaults) |
| Ultimate SP kills (N2) | deferred | the data's expression with `kill_num` (0): `min(atb_up × kill_num + atb, atb_max)` = 25 |
| Rare Fin chance jump (D1, Probablity branches) | open, interim (exact) | trigger `rare_fin`: cast of the combo, `delay 10`, `chance`, `jump 10 → 65` |
| B2 layered stackingType 11 across wielders | open | Edge of Lightness: two wielders' layers add (one wielder in any normal team) |

Mechanics rows: 1–5, 9, 12–19, 22–29, 31, W1, W3–W7 as planned
(supported); 6–8 by A3 / A4 / V1 (one hit, natural SP of source type 3);
11 by T2; 20 natural and of source type 3 only because the kit's value
names `atb_up` first (SkillData `spKinds` / `spSources` key the grant by
the keys of its ObtainCostAction value, `atb_up` and `atb_max`, not `atb`:
a plain `sp: atb` would be returned SP of no source type); 21 by N1; W2 by
T3. Row 10 open (A7), row 30 open (Ti1), row 15 data (continuous reading).

### What the kit models and leaves out

- `packages/data/kits/operators/chr_0024_deepfin.json`: basic attacks
  (attack5's Final Strike and controlled-only stagger, its second hit's 19
  SP; `finalStrike: false` on it, else the loader marks every hit of a
  Final-Strike file), finisher (two hits, multiplier 1.0), dive attack;
  battle skill (one hit, consumption and level after the damage, SP 15 /
  25 / 35 / 45 + P1's 10, team energy at 27); combo (normal path hits at
  22 and 38; Rare Fin path by the `rare_fin` chance trigger: the jump skips
  55 frames, so its hits at data frames 77 and 93 land 22 and 38 frames
  after the cast as well; P3's team ATK +15% for 10 s after the Rare Fin
  slam); ultimate (Cryo, infliction, 20 stagger, 25 SP, P5 below half HP);
  combo triggers (Arts Reaction consumed, Shatter interim, crystals
  consumed); talent 1's three handlers with one shared 3 s marker.
- `wpn_sword_0019.json` (OBJ Edge of Lightness): a team layer per SP grant
  of source type 3 (battle skill, combo hook, ultimate, other skills' type-3
  grants; not basic attacks, finishers or the Rare Fin's `atb_sp`), Heat and
  Electric DMG +8.4% each, 20 s, three layers timed separately.
- `wpn_sword_0020.json` (Finchaser 3.0): Cryo DMG Taken +19.6% on the enemy
  for 15 s when the wielder's battle skill applies Solidification (forced or
  by reaction), after that hit's damage; stack group from the game buff.
- Left out: hit-stop; kills (ultimate SP per kill); the combo's out-of-range
  jump (0 → 4); buff_wpn_sword_0020_atk_up (unreferenced); camera buffs.
- `examples/alesh-estella.scenario.json` (new): Alesh P5 with Finchaser and
  Estella: 137,101 total (Alesh 35,902) in 9.83 s, expected crits, seed 1
  (the combo's normal path); 40 seeds with rolled crits: mean 136,787,
  sd 3.5%, max 153,231 (Rare Fin seeds).
- `tests/kit-alesh.test.ts` (18 tests): basic chain frames and SP (one grant,
  source type 1); finisher and skill list; battle skill on 0–4 Cryo stacks
  (consumption, forced Solidification level, SP with and without P1, natural
  SP), its damage before the Solidification, talent 1's 12 energy and
  marker, no talent below level 1; combo windows on a Shatter (not on his
  own Cryo consumption), on a consumed reaction, on the Endministrator's
  consumed crystals (not on their expiry; talent 1's 4 energy when she
  applies them); the combo's two paths, SP sources and energy, the Rare Fin
  rate over 40 seeds, P3 and its absence at P2, the chance expression
  (talent 2 levels 2 and 0); the ultimate's hit, infliction, stagger and SP;
  P5 ×1.5 below / not above half HP / not at P4; a teammate's Solidification
  (4 energy) and the shared lockout; Edge of Lightness's layers (none from
  basic attacks or a Cryo-less battle skill, none from `atb_sp`, cap 3,
  separate timers, values); Finchaser's debuff (timing, duration, the
  ultimate's time stop extending it on the enemy's clock, not on the
  applying hit, not from a teammate's Solidification).
- `packages/data/test/skillCompile.test.ts`: Alesh in OPERATORS; one KNOWN
  entry (the battle skill's consumption and level: the compiler reads no
  consumption from ForceSpellStatusAction `consumedLayer` and lists the
  Solidification only under CheckBuffStackNumByTag).

### Verification

- **Logs:** no ZMDLogs fixture has Alesh, Edge of Lightness or Finchaser
  3.0, so `zmdlogs check` / `reactions` have nothing of his; every existing
  fixture's output is unchanged.
- **Examples:** every existing `examples/*.scenario.json` total unchanged
  (the kit adds an operator and two weapons nobody else in them uses).
- **Scenario sanity** (the new example): ultimate at 3.0 s (frame 90) with
  Estella's Cryo: a Cryo burst at 4.0 s (A5), two stacks; his battle skill at
  4.1 s consumes both and forces Solidification level 2 (+35 SP; talent 1's
  12 energy; Finchaser's debuff); Estella's combo Lifts and Shatters at
  4.73 s, which opens his combo (A7 interim); combo hits at +0.73 s and
  +1.27 s, as in the report's scratch runs.

### Compiler leftovers (data)

`kit-draft chr_0024_deepfin` now gets elements, stagger and Final Strikes
right. Still open (D3 / D4 / A3's compiler half): the kit `element` is the
operator's (`cryst`); the battle skill's Switch-chosen SP (listed as 8
grants) and its consumption and level; the Rare Fin chance jump; P3's
CreateBuff (only noted); the ultimate's P5 branch as two unconditioned
alternatives (CheckHp could now compile to `enemyHpBelow`) and its SP as
`atb_up × (kill_num + 1) + atb` with no landing.

### In-game tests the kit depends on

- **63** (Shatter as a consumption): `combo_on_shatter` stays or goes.
- **71** part 1 (crystals consumed vs run out): `combo_on_crystals` reads
  "consumed"; part 2 confirms the Solidification level from the stacks
  consumed (A3).
