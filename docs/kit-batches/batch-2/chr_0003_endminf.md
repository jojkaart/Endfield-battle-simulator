# The Endministrator (chr_0003_endminf): gap report, batch 2

Operator: the Endministrator, female (`chr_0003_endminf`, the ID in the
logs), with the other two entries `chr_0002_endminm` and `chr_9000_endmin`
(§ The three IDs). Equipment (from [batch-2.md](../batch-2.md)): weapons
Tarr 11 (`wpn_sword_0003`) and Prominent Edge (`wpn_sword_0008`); gear sets
Grizzled Edge (`suit_crush_fracture`), Bonekrusha (`suit_attri01`) and
Armored MSGR (`suit_str01`).

Sources: rmxlinux 1.6 (commit pinned in the data submodule): SkillData
`chr_0003_endminf_*`, `chr_0002_endminm_*`, `sk_wpn_sword_0003/0008`,
`passive_equipsuit_crush_fracture/attrisuit_01/str_01`; BuffData
`buff_common_originum_frozen(_inner)`, `buff_chr_0003_endminf_*`,
`buff_physical_*`, `buff_wpn_sword_0003/0008`, `buff_equipsuit_*`;
TableCfg CharacterTable, CharGrowthTable, CharacterPotentialTable,
PotentialTalentEffectTable, SkillPatchTable, EquipSuitTable,
WeaponBasicTable, GlobalConst, I18nTextTable_EN (CN/TC/JP for P5). Log:
`fixtures/pending/zmdlogs-7e19489ae503.json` (§ Verification). `efsim
kit-draft` was run for all three IDs.

Claims from earlier notes, re-checked: data-sources.md lists "the
Endministrator talent" among damage-taken effects: **confirmed** (talent 2
is a defender-side NormalCalcZone modifier, row 24). Estella's kit notes
that `buff_chr_0003_endminf_talent_0` (+0.2 Physical) applies only while
the target has `buff_common_originum_frozen`: **confirmed** (its
`damageModifier` condition). The batch file calls the batch "the 4-stars":
the Endministrator is **rarity 6** (CharacterTable), so the owner's P5
default for 4- and 5-stars doesn't cover them; their potential item is
`item_charpotentialup_chr_9000_endmin`, and the log has them at P3.

## The three IDs

- **`chr_9000_endmin` isn't playable.** GlobalConst says so in so many
  words: `endminVirtualCharId: chr_9000_endmin`, `femaleCharID:
  chr_0003_endminf`, `maleCharID: chr_0002_endminm`. The virtual entry has
  no SkillData of its own (its skill groups list *both* genders' skills,
  male first), no voice or profile records, and is what presets and
  dungeons name (CharPresetTable `endminf_indie`, CharTeamTable
  `player_60_chr_9000_endmin`). It is the account-level identity: the
  potential item and the talent tree belong to it. Today `efsim find`
  lists it as a third operator; it should be hidden (or resolve to the
  player's gender).
- **`chr_0002_endminm` is the same kit under other IDs.** Same stats
  (CharacterTable rows identical apart from names and art), same
  SkillPatchTable values for every skill (all 11 pairs compared), same hit
  frames, masks, keys and branches (the two `kit-draft` outputs differ only
  in IDs). Differences, all read from SkillData by the engine anyway: the
  finisher is `power_attack` (male) vs `power_attack2` (female; the female
  also has an unused `power_attack`), `durationFrame` (animation tails:
  e.g. combo 122 vs 164, ultimate 215 vs 250; `exclusiveFrame` equal
  everywhere), and a few window ends (combo → battle skill 24–51 vs 23–54,
  battle skill 24–53 vs 24–54, dash 23–33 vs 22–27). BuffData is shared:
  the male battle skill reads `buff_chr_0003_endminf_potential1`, P5's
  buff cuts the cooldown of both combo IDs, P4 multiplies both ultimates.
- **The gendered entries' talents point at stale data.** `chr_0003`'s and
  `chr_0002`'s talent nodes name `chr_0002_endminm_talent_{1,2}_{1,2}`:
  attached skills with **empty blackboards** and old texts ("Hitting at
  least 2 targets with the battle skill or ultimate shortens combo skill
  cooldown"). The virtual entry's nodes name `chr_9000_endmin_talent_*`
  with the real values (ATK +15/30% for 15 s; Physical DMG taken +10/20%)
  and the texts P2 refers to ("Talent Essence Disintegration improved:
  When the Endministrator gains the ATK buff …"). The log confirms the
  virtual values (`talent_1_tirgger` 0.3 at talent level 2). Gap G1.
- **One kit for two IDs** (G7): the format can express it without a copy
  as an operator-kit field naming the other ID and how skill IDs map:

  ```json
  "variants": [{
    "operator": "chr_0002_endminm",
    "skillPrefix": "chr_0002_endminm_",
    "skillIds": { "chr_0003_endminf_power_attack2": "chr_0002_endminm_power_attack" }
  }]
  ```

  The loader expands it into a second OperatorKit: every kit skill ID, hit
  event key and trigger `skills` filter that is a `chr_0003_endminf_<x>`
  SkillData ID becomes `chr_0002_endminm_<x>` (or the explicit
  `skillIds` entry); buff IDs, `gameBuff` and `skill` sources naming
  BuffData (`buff_chr_0003_endminf_*`) stay, since BuffData is shared. The
  expanded kit is validated against `chr_0002_endminm`'s own SkillData and
  growth table like any kit. Event keys need care: the log has the female
  combo under **`chr_0002_endminm_combo_skill`** (row 12), so the combo
  hit lists both keys in both variants.

## Mechanics

Values at skill level 12 unless said. "Draft" = what `kit-draft` emitted.

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 1 | Basic attacks 1–4 (Destructive Sequence): `atk_scale` 0.51 / 0.61 / 0.34 ×2 / 0.19 ×4, masks 128; frames 6; 5; 5, 12; 7, 9, 18, 19 | supported | draft hits as they are; split hits name `events` |
| 2 | Attack 5: Final Strike (mask 2097280), `atk_scale` 0.9, `atb` 20, `poise` 18 only for the controlled operator ("As the controlled operator, Final Strike also deals {poise} Stagger") | supported | `finalStrike`, `poise`, `poiseControlledOnly`; the draft misses the poise (compiler leftover D2) |
| 3 | Finisher `power_attack2`: two DamageActions, frame 9 and 27, BreakingAttackCalculation `multiplier` 0.1 and 0.9 of `atk_scale` 9.0; GainBreakingAttackAtb at 27; disable-cast buff 0–27 | supported | two hits with `factor` 0.1 / 0.9 (the draft has no factors: D2); finisher rules are the engine's |
| 4 | Dive attack `plunging_attack_end` (1.8, mask 1152) | supported | not castable until rotations have jumps (S10) |
| 5 | Dash attack `dash_attack` (in SkillPatchTable, not in any skill group) | supported | not a rotation action; left out like batch 1's |
| 6 | Battle skill (Constructive Sequence): one hit per target at frame 11 (ChannelingAction, maxCountPerTarget 1), `atk_scale` 3.5, `poise` 10, cost 100 SP, team energy (`buff_common_obtain_ultimate_sp`) at 11 | supported | draft hit + `teamEnergyFrame` 11 |
| 7 | Battle skill Crush: CrushAction runs **before** the DamageAction ("Deals Physical DMG and applies Crush") | supported | `applies: [{kind: physicalStatus, status: crush}]` (applications come before the hit's damage); without Vulnerable it adds 1 stack (status.ts) |
| 8 | Combo trigger: "COMBO TRIGGER: When another operator in the team deals DMG with combo skills." | supported | trigger `on: {event: hit, kinds: [combo]}`, `by: teammate`, `openCombo` |
| 9 | Combo (Sealing Sequence) hit at frame 23: `atk_scale` 1.0, `poise` 10, `usp` 10 if it hits; cooldown 15 s (16 s below L12); ComboSkill time dilation | supported | draft `hit_2`; cooldown and slow-down from data |
| 10 | Combo's first DamageAction (frame 23): `atkScale` names `atk_scale` without `useBlackboardKey` (literal 0), mask 12288 | supported | left out: a 0-damage hit; the log has one combo hit per cast |
| 11 | Originium Crystals: combo frame 23 CreateBuff `buff_common_originum_frozen` on the target **between** the two DamageActions; `duration` 4 / 4.5 / 5 s (L1–9 / 10–11 / 12); max 1 (stackingType 2); assigns `atk_scale_trigger` 4.0 and `originum_ult_break_scale` 6.0 from the combo | supported | enemy kit buff, applied by the combo hit with `beforeDamage: true` (talent 2 then counts for the combo hit). The disabled StoreAttributeValue (`str_ratio`) is ignored |
| 12 | Combo event key: the log names the female combo **`chr_0002_endminm_combo_skill`** (both combos in 7e19) | supported | `events: ["chr_0003_endminf_combo_skill", "chr_0002_endminm_combo_skill"]` |
| 13 | Which combo file the game runs for the female (the key says the male one): hit frame 23 in both, window and durationFrame differ (row "three IDs") | unknown | only timing of the next action (≤ 3 frames); in-game test E6 |
| 14 | Seal: on application, if the target's super armor < 20, `_inner` time-dilates it to 0 for the crystals' duration ("temporarily seal them") | gap | G6: enemies have no super armor in EnemyData. Bosses (Rhodagn) unaffected |
| 15 | Crystals consumed by a physical status from anyone: `igniteEventAction` igniteType 1, raised by `buff_physical_airborne`, `knockdown`, `do_crushed`, `do_fracture` (and Bleed); `finishAfterIgnited` ("Applying Physical Status … to the sealed enemy consumes the Originium Crystals and deals additional Physical DMG") | supported | trigger `on: physicalStatus`, `by: anyone`, `beforeDamage`, `if: {buffActive: originium_crystals}` → hits, buffs, `endBuff`. Verified in 7e19: a teammate's Breach (t=14984) and her own Crush (33734) each consume |
| 16 | Crystals consumed by Vulnerability: igniteType 7, `buff_physical_no_guard` buffEvent 7 (every stack added; its ≥ 2 check only guards Shatter's handler) | supported | the same trigger `on: vulnerable` |
| 17 | The consumption hit: `atk_scale_trigger` (combo level), mask 12288 (combo kind), damage source the Endministrator, logged as `buff_common_originum_frozen` | supported | trigger `hits` with `skill: chr_0003_endminf_combo_skill`, `damageType: combo`, `events: ["buff_common_originum_frozen"]`. Key verified (2 hits in 7e19) |
| 18 | The consumption hit sees the crystals (DamageAction runs before the buff finishes): talent 2's +20% counts for it, while the hit that applied the status sees them gone | gap | G2: a trigger's frame-0 hits land after all its actions, so either the crystal hit loses talent 2 (kit plan) or the status hit keeps it |
| 19 | Ultimate (Bombardment Sequence) at frame 50: `atk_scale` 8.0, `poise` 25, cost 80 energy (SkillData's 100 is a default), cooldown 10 s, time stop frames 0–44 | supported | draft hit; costs and time stop from data |
| 20 | Ultimate on a sealed target: ForEach target with crystals → DamageAction `originum_ult_break_scale` 6.0 (mask 512) then IgniteAction 6 ("deals one more hit") | supported | hit with `if: {buffActive: originium_crystals}` |
| 21 | igniteType 6 also runs the crystals' own DamageAction: `atk_scale_trigger` 4.0 (combo level) with mask **4608** (ultimate kind) — a third hit the text doesn't mention | unknown | written as a third conditional ultimate hit (`scaleValue` from the combo); in-game test E1 (no ultimate on crystals in 7e19) |
| 22 | igniteType 6 consequences: talent 1, P2, P3 (below), then the crystals end | supported | a cast trigger delayed 51 frames (one frame after the hits, so all three see the crystals) |
| 23 | Talent 1 Essence Disintegration: "When the Originium Crystals attached to the enemy are consumed, the Endministrator gains ATK +{atk_up} for {duration}s. This effect cannot stack." `atk_up` 0.15 / 0.30, 15 s (`buff_chr_0003_endminf_talent_1` blackboard, read by the crystals' ignite handlers into `talent_1_tirgger`, stackingType 2, max 1) | data | mechanism supported (self buff `zone: atk`, `{talent: 0, …}` values, applied by each consumption); its values reach the gendered IDs only with G1. Verified: 0.30 in 7e19 |
| 24 | Talent 2 Realspace Stasis: "Enemies with attached Originium Crystals suffer Physical DMG Taken +{dmg}" 0.10 / 0.20: `talent_0_aura` → `buff_chr_0003_endminf_talent_0` on the team, DamageScaleProcessor side 1 (defender) NormalCalcZone, CheckDamageType physical, CheckBuffStackNumAdvanced `buff_common_originum_frozen` ≥ 1 | data | as a `damageTaken` physical modifier on the crystals buff, `{talent: 1, key: dmg}`; needs G1 (today the loader stops: "chr_0003_endminf_talent_0 … has no value dmg") |
| 25 | Talent gating: in each ignite handler the talent-1 check comes first and P2 / P3 follow it in one sequence, so without talent 1 nothing after it would run | supported | written as `talentAtLeast [0, 1]` on talent 1 and P2; P3 left ungated (talent 1 is learned at promotion 1; moot in practice) |
| 26 | P1 Final Awakening: "Consuming Originium Crystals returns {atb_return} SP" (50); normal_skill: P1 buff and target sealed and not `has_returned` → ObtainCostAction costType 1, atbSourceType 3 (returned), once per cast, before the Crush | supported | cast trigger `delay: 11` (before the frame-11 hit), `sp` with `if: all [potentialAtLeast 1, buffActive]` |
| 27 | P2 Reflection of Authority: other operators get `ratio` 0.5 of the talent-1 ATK, same duration | supported | team buff, `recipients: {not: {isOwner: true}}`, value × `ratio` of `buff_chr_0003_endminf_potential2`. Verified: 0.15 on Pogranichnik's, Ember's and Chen's status hits in 7e19 |
| 28 | P3 The Guide: "After consuming Originium Crystals, the Endministrator gains {usp} Ultimate Energy. This effect does not benefit from other bonuses." 15, only in the igniteType 6 handler (`ignoreUspGainScalar`) | supported | `energy` with `ignoreEfficiency` in the ultimate trigger |
| 29 | P4 Commander of Originium: Arts Intensity +16; ultimate `atk_scale` and `originum_ult_break_scale` ×1.2 (both genders' skill IDs) | supported | read by the loader (attr modifier, skillValue multiply) |
| 30 | P5 (text "???" in every language): `buff_chr_0003_endminf_potential5` abilityEvent 9 on `potential5_trigger` (0.1 s, created by the battle skill at frames 11–14 and the ultimate at 50–53 when they hit) → SetSkillCdAtOnce on the combo by `cd_minus` 2 | supported | hit trigger on both skills, `maxPerCast` 1, cooldown 0.1, `cooldown` action −`cd_minus`; reduce semantics as for batch 1 (functionType 0) |
| 31 | Talent-1 ATK on the hit whose status consumed the crystals (battle skill: Crush → ignite → ATK buff → DamageAction) | supported | the consumption trigger is `beforeDamage`; in 7e19 the buff is a boundary effect on that hit (in-game test 51 is the same question) |
| 32 | `buff_chr_0003_endminf_attack4` (marker 1 s, ended by attack 5), `combo_skill_tutorial_marker`, `extra_attack`, `wind_move`, `train_ultimate_break_originum`, `skin_ink` | supported | no effect on damage (markers, tutorial, other operators' or level scripts) |
| 33 | Skill timing: windows, exclusive frames, `dontInterruptCombo`, combo time dilation, ultimate time stop, finisher disable-cast | supported | SkillData (engine) |

**Weapons**

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 34 | Tarr 11: main attribute +`mainattr`, flat ATK +`atk_up` 12–33.6 (`sk_wpn_sword_0003` cardAttributeModifier attr 2 formulaItem 7) | supported | stat panel; `buff_wpn_sword_0003` is referenced by no skill file. No triggers: a sources-only kit |
| 35 | Prominent Edge: Agility, Physical DMG (stat panel); "When the wielder's battle skill hits the enemy, the wielder gains ATK +{atk_up} for {duration}s. Effects of the same name cannot stack.": abilityEvent 302 + CheckDamageDecorateMask 256 → `buff_wpn_sword_0008` (attr 2 formulaItem 6, 0.12–0.336, 20 s, stackingType 4: refresh) | supported | trigger `on: {event: hit, kinds: [battle]}`, `by: self`, self buff `zone: atk` |

**Gear sets**

| # | Mechanic (source) | Status | Kit field / what's missing |
|---|---|---|---|
| 36 | Grizzled Edge: ATK +`atk_up` 8% | supported | stat panel (set skill cardAttributeModifier) |
| 37 | Grizzled Edge: "When the wearer applies Crush or Breach, the wearer gains Physical DMG Dealt +[{phy_dmg_up_perstack} × Vulnerability stacks consumed] for {duration}s": abilityEvent 401, CheckPhysicalInflictionType mask 12, Vulnerable ≥ 1, SaveBuffStackNum → `…_physicdamage` (attr 50, 0.06 per stack, 20 s) | supported | trigger `on: {event: physicalStatus, statuses: [crush, breach]}`, `by: self`, `beforeDamage`; value `eventCount` (a Crush / Breach event's level = stacks consumed) × `phy_dmg_up_perstack` |
| 38 | Grizzled Edge ×`special_multi` 1.5 if the target has Physical Susceptibility (tag 1066759270) or is Staggered (CheckPoiseValue) | supported | `if` value on `enemyModifier: {zone: susceptibility, element: physical}` / `enemyStaggered` |
| 39 | Grizzled Edge ×1.5 if the target has `buff_common_originum_frozen` (anyone's), judged before the Crush consumes them | gap | G3 (a predicate on an enemy buff by game ID, from anyone) and G4 (the order of triggers on one event). 7e19 t=33734: 0.36 = 4 × 0.06 × 1.5 on her own Crush of a sealed, unstaggered enemy without Physical Susceptibility |
| 40 | Grizzled Edge "This buff cannot stack": stackingType 1 with `priorityKey` = the value: a weaker later application may not replace a stronger one | unknown | engine: a reapplication replaces and resets; in-game test E4 |
| 41 | Bonekrusha: ATK +`atk_up` 15% | supported | stat panel |
| 42 | Bonekrusha: "When the wearer casts a combo skill, the wearer gains 1 stack of Bonekrushing Smash that grants the wearer's next battle skill DMG Dealt +{dmg_up}. … can stack {max_stack} time(s)": abilityEvent 30 CheckSkillType [6] → `attrisuitup_01` (stackingType 2, max 2); on a battle-skill cast ([2]) it creates `attrisuitup_02` (+`dmg_up` × layers, mask 256, CheckSkillCastId: that cast only) and ends all layers | supported | layered self buff `maxStacks: max_stack`, `consumedBy: [battle]`, `damageBonus` `dmg_up` limited to `skillType: battle`; trigger on own combo casts |
| 43 | Bonekrusha layer lifetime: `attrisuitup_01` duration names a `duration` key nobody assigns (default 20), `lifeType` 1 | unknown | kit plan: no duration (until used); in-game test E5 |
| 44 | Armored MSGR: Strength +50 (stat panel); "When the wearer's HP is below {hp_ratio}, … DMG Reduction" | supported | defensive and HP-based: not modelled; sources-only kit |

**Counts:** 44 mechanics: 35 supported, 3 gap (14, 18, 39), 2 data (23,
24), 4 unknown (13, 21, 40, 43), 0 unique?. Seven gap entries below (G1
behind rows 23–24, G4 beside G3 for row 39, G5 and G7 from the log and the
IDs). Nothing is unique: the crystals are an enemy state consumed by
physical statuses and Vulnerability, as Solidification is by Shatter, and
written with shared triggers.

## Gaps

### G1. The gendered Endministrators' talents come from the virtual character

- **family:** data compilation
- **feature:** `gameData.ts` builds `talentNodes` for `chr_0002_endminm`
  and `chr_0003_endminf` from `chr_9000_endmin`'s CharGrowthTable
  `talentNodeMap` (GlobalConst `endminVirtualCharId`, `maleCharID`,
  `femaleCharID` say which IDs it covers); potentials already agree
  (all three CharacterPotentialTable entries name `chr_9000_endmin_potential_*`).
  The virtual ID itself is dropped from the operator list (or kept out of
  `find` and team building). Attribute nodes are identical in all three.
- **evidence:** CharGrowthTable `chr_0003_endminf.talentNodeMap.
  chr_0003_endminf_passive_skill_*.passiveSkillNodeInfo.talentEffectId` =
  `chr_0002_endminm_talent_{1,2}_{1,2}` (attachSkill blackboards `[]`);
  `chr_9000_endmin_passive_skill_*` → `chr_9000_endmin_talent_*`
  (`atk_up` 0.15 / 0.30, `duration` 15; `dmg` 0.10 / 0.20). Loading the
  kit plan without it: `chr_0003_endminf_talent_0 (attached by a talent or
  potential) has no value dmg`. 7e19 logs `talent_1_tirgger` 0.30.
- **impact:** both talents unusable (the kit doesn't load, or they're 0):
  +30% ATK for 15 s after each consumption (on her and, at P2, +15% on the
  team), +20% Physical DMG taken on sealed targets.

### G2. A triggered hit that lands before the trigger's later actions

- **family:** triggers (timing of trigger actions)
- **feature:** a `hits` action option (e.g. `"now": true`) whose frame-0
  hits land as the action runs, before the trigger's next action, like
  the game's DamageAction inside an event handler; default unchanged.
  The crystal triggers become `[hits (now), buffs, endBuff]`, so the
  crystal hit sees the crystals (talent 2) and the consuming hit, which
  lands after the before-damage triggers, doesn't.
- **evidence:** `buff_common_originum_frozen.igniteEventAction[*]`:
  DamageAction first, `finishAfterIgnited: true`; talent 2's condition
  (`buff_chr_0003_endminf_talent_0` CheckBuffStackNumAdvanced on the
  frozen buff).
- **impact:** each status-driven consumption hit (4.0 × ATK at combo
  L12) misses talent 2's +20% in damage taken (about +0.8 × ATK, less
  with other damage-taken sources), roughly 5–8% of a consumption's
  damage. The ultimate's consumption isn't affected (its hits are the
  skill's own).

### G3. An enemy buff from anyone, by game buff ID (predicate and event filter)

- **family:** conditions (and triggers)
- **feature:** a Predicate `enemyBuff: "<BuffData ID>"`: some team
  member's kit buff with that `gameBuff` is active on the enemy. And a
  `buffApplied` filter `gameBuffs: [...]` with `by` (for equipment that
  reacts to the wearer applying such a buff).
- **evidence:** `buff_equipsuit_crush_fracture` abilityEvent 401
  CheckBuffStackNumAdvanced `buffIdList: [buff_common_originum_frozen]`.
  The same buff is named by `sk_wpn_sword_0017` (Glorious Memory) and
  `sk_wpn_sword_0021` (Grand Vision: "When the wielder applies Originium
  Crystals or Solidification, … Physical DMG Dealt +64.8%"), both worn in
  7e19 (Chen, the Endministrator): batch-3 equipment needs the event half.
  `buffActive` only sees the operator's own kit buffs, and equipment can't
  name operator kit IDs.
- **impact:** Grizzled Edge on the Endministrator: 0.24 instead of 0.36
  Physical DMG at 4 stacks (−12 points for 20 s) whenever she Crushes a
  sealed enemy, her normal opener.

### G4. Order of triggers on one status event

- **family:** triggers
- **feature:** the triggers that match one status event judge their `if`
  and the values they apply on the situation at the event, before any of
  them acts (the game raises the wearer's ability event 401 before the
  status buff's own handlers, which consume Vulnerable and ignite the
  crystals). Today they run in team order, then kit before equipment, each
  seeing what earlier ones did, so the Endministrator's consumption trigger
  removes the crystals before her own set looks.
- **evidence:** 7e19 t=33734 (row 39): the set counted 4 stacks (consumed
  by that Crush) and the crystals (consumed by it too). `buff_physical_
  do_crushed` buffEvent 0: FinishBuff no_guard, then IgniteAction 1.
- **impact:** as G3 (they're needed together); also any future
  equipment that checks a state its owner's own triggers consume.

### G5. Crush hits logged as `buff_physical_crushed`

- **family:** log tooling
- **feature:** the Crush status hit's log keys include
  `buff_physical_crushed` (the buff CrushAction creates via
  `try_crushed`; `do_crushed` holds the DamageAction): `PHYSICAL_KEYS` or
  the checker accepts both.
- **evidence:** 7e19 t=33734 `buff_physical_crushed` 413,543 (her
  largest hit in the log); no fixture logs `buff_physical_do_crushed`.
- **impact:** the log checker can't check Crush damage at all (every
  operator; 53% of the Endministrator's damage in 7e19: 413,543 of 782,845).

### G6. The seal on weak enemies

- **family:** arts/physical state (control statuses)
- **feature:** enemies' super armor in EnemyData, and the crystals as a
  `control` with `freezes` when it's below 20.
- **evidence:** `buff_common_originum_frozen` buffEvent 5 CheckSuperArmor
  < 20 → `buff_common_originum_frozen_inner` (TimeDilationAction scale 0
  for `duration`).
- **impact:** none on bosses; on mobs their timers stop for 5 s.
  **Propose to defer** with multi-enemy support (like N1).

### G7. One kit for two operator IDs

- **family:** data compilation (kit loader)
- **feature:** the `variants` field in § The three IDs.
- **evidence:** § The three IDs.
- **impact:** without it the male Endministrator needs a copied kit
  (every later fix twice) or has none.

## Verification

**Log:** `fixtures/pending/zmdlogs-7e19489ae503.json` (Rhodagn Lv90,
parser v58, 2026-10-12, single target): the Endministrator P3, skills
12/9/12/12, Grand Vision (`wpn_sword_0021`, not this batch's), 3 ×
Grizzled Edge + 1 Æthertech; team Ember, Chen Qianyu, Pogranichnik. 34
of her hits (34% of the team's damage). I ran `zmdlogs check` with the
kit plan in a scratch copy:

- **Confirmed structure:** event keys (crystal hits under
  `buff_common_originum_frozen`, the combo under `chr_0002_endminm_combo_skill`,
  battle skill and ultimate under their own); one combo hit per cast;
  consumption by a teammate's Breach (14984) and by her battle skill's
  Crush (33734); talent 1 at 0.30 on her and P2's 0.15 on three
  teammates; Grizzled Edge's 0.36 (G3/G4).
- **Not yet confirmed: values.** All 31 of her covered hits mismatch, by
  a ratio shared by every hit including plain basic attacks (×1.38
  before the first consumption, ×1.11–1.13 after), so it lies outside the
  kit's hit structure: her weapon (Grand Vision has no kit yet), the
  fixture's assumed weapon / talent levels, and a teammate's ATK buff the
  log lists up to nine times on one hit (`wpn_sword_0012_atk_up`). Settle
  with `efsim calc` against her in-game stat panel or a log with known
  equipment, then re-run: t=33734 also tells whether talent 1's ATK
  counts on the battle-skill hit (row 31) and whether talent 2 counts on
  the crystal hit (G2).
- Not in the log: the ultimate on a sealed target (rows 20–22), Bonekrusha,
  Prominent Edge, Tarr 11.

**Logs that would verify the rest:** the Endministrator with a combo user
who fires often (any teammate's combo opens her window), ultimate cast
while crystals are up (rows 20–21); Prominent Edge or Tarr 11 with known
levels; Bonekrusha (two combos then a battle skill); `btl_upload_39e3cddab245`
(Estella's kit notes: it has the Endministrator's talent 0 and 1 buffs).

**In-game tests** (new; none in docs/in-game-tests.md covers them, 51 is
related to row 31):

- **E1** Ultimate on a sealed enemy: how many damage numbers (2 or 3) and
  their size relative to an unsealed ultimate (row 21).
- **E2** Talent 2 on the crystal hit: crystal-shatter damage by a
  teammate's Lift with talent 2 at level 2 vs level 1 or 0, if the owner
  has an account at both (G2); otherwise read from a log with values
  settled.
- **E3** Grizzled Edge with crystals: Crush a sealed enemy with 4
  Vulnerable stacks, not staggered: the buff shows 36% (G3/G4; the log
  already says yes, a screenshot confirms).
- **E4** Grizzled Edge weaker reapplication: Crush with 4 stacks, then
  Breach with 1: does the buff stay at 24% (or 36%) or drop (row 40)?
- **E5** Bonekrusha stack lifetime: combo, wait 30 s, battle skill:
  still +30% (row 43)?
- **E6** Female Endministrator's combo → battle skill: the earliest
  battle skill after a combo (frame 23 vs 24 window start) — low priority
  (row 13).

## Kit plan

Written in a scratch copy and loaded with the real loader
(`/tmp/claude-0/…/scratchpad/batch2/scratch-chr_0003_endminf/repo/`
`packages/data/kits/{operators/chr_0003_endminf.json,equipment/*}`). It
**loads only with G1 simulated** (the scratch `gameData.ts` gives both
gendered IDs `chr_9000_endmin`'s talent nodes); without it the loader
stops at talent 2's `dmg`. Three scratch scenarios ran: teammate's Lift
consuming crystals (crystal hit 10,597; Estella's Lift hit already under
P2's ATK), combo → ultimate on crystals (three ultimate hits), and two
battle skills (the second Crushes; Grizzled Edge and Prominent Edge
apply).

### Operator kit `chr_0003_endminf.json`

- `element: physical`; no stacks.
- **Buffs:**

  ```json
  { "id": "originium_crystals", "target": "enemy", "gameBuff": "buff_common_originum_frozen",
    "duration": "duration",
    "modifiers": [{ "zone": "damageTaken", "value": { "talent": 1, "key": "dmg" }, "elements": ["physical"] }] },
  { "id": "essence_disintegration", "target": "self", "gameBuff": "buff_chr_0003_endminf_talent_1_tirgger",
    "duration": { "talent": 0, "key": "duration" },
    "modifiers": [{ "zone": "atk", "value": { "talent": 0, "key": "atk_up" } }] },
  { "id": "essence_disintegration_team", "target": "team", "recipients": { "not": { "isOwner": true } },
    "gameBuff": "buff_chr_0003_endminf_talent_1_tirgger", "duration": { "talent": 0, "key": "duration" },
    "modifiers": [{ "zone": "atk", "value": { "product": [{ "talent": 0, "key": "atk_up" },
      { "key": "ratio", "skill": "buff_chr_0003_endminf_potential2" }] } }] }
  ```

- **Skills** (keys from SkillPatchTable; frames from the draft):
  - `attack1` [6], `attack2` [5], `attack3` count 2 [5, 12], `attack4`
    count 4 [7, 9, 18, 19] (split hits name `events`), `attack5` [18]
    `finalStrike`, `poise: "poise"`, `poiseControlledOnly`; SP is the
    skill's `atb` on the first hit (only attack 5 has any: 20).
  - `power_attack2`: hits `hit1` [9] `factor` 0.1, `hit2` [27] `factor`
    0.9, both `atk_scale`, `events: ["chr_0003_endminf_power_attack2"]`.
  - `plunging_attack_end` [1] (not castable: S10).
  - `normal_skill`: `teamEnergyFrame` 11; hit [11] `atk_scale`, `poise`,
    `applies: [{kind: physicalStatus, status: crush}]`.
  - `combo_skill`: hit [23] `atk_scale`, `poise`, `energy: "usp"`,
    `buffs: [{buff: originium_crystals, beforeDamage: true}]`,
    `events: [chr_0003_endminf_combo_skill, chr_0002_endminm_combo_skill]`.
  - `ultimate_skill`, all at [50]: `hit` (`atk_scale`, `poise`), `break`
    (`originum_ult_break_scale`, `if: {buffActive: originium_crystals}`),
    `shatter` (`scale: []`, `scaleValue: {key: atk_scale_trigger, skill:
    chr_0003_endminf_combo_skill}`, same `if`, `events:
    [buff_common_originum_frozen]`, `detached: false`; row 21, test E1).
- **Triggers:**

  ```json
  { "id": "combo_window", "on": { "event": "hit", "kinds": ["combo"] }, "by": "teammate", "do": [{ "kind": "openCombo" }] },
  { "id": "crystals_physical", "on": { "event": "physicalStatus" }, "by": "anyone", "beforeDamage": true,
    "if": { "buffActive": "originium_crystals" }, "skill": "chr_0003_endminf_combo_skill",
    "do": [
      { "kind": "hits", "hits": [{ "id": "shatter", "scale": ["atk_scale_trigger"], "element": "physical",
        "damageType": "combo", "events": ["buff_common_originum_frozen"], "frames": [0] }] },
      { "kind": "buff", "buff": "essence_disintegration", "if": { "talentAtLeast": [0, 1] } },
      { "kind": "buff", "buff": "essence_disintegration_team", "if": { "all": [{ "talentAtLeast": [0, 1] }, { "potentialAtLeast": 2 }] } },
      { "kind": "endBuff", "buff": "originium_crystals" } ] }
  ```

  `crystals_vulnerable`: the same on `{event: vulnerable}`.
  `crystals_ultimate`: `on: {event: cast, skills: [ultimate]}`, `by:
  self`, `delay: 51`, actions each with `if` including `buffActive:
  originium_crystals`: the two talent buffs, `energy` `{key: usp, skill:
  buff_chr_0003_endminf_potential3}` with `ignoreEfficiency` at
  `potentialAtLeast 3`, then `endBuff`. `p1_sp`: `on: cast [normal_skill]`,
  `delay: 11`, `sp` `{key: atb_return, skill:
  buff_chr_0003_endminf_potential1}` if P1 and crystals. `p5_cooldown`:
  `on: hit, skills: [normal_skill, ultimate]`, `if: potentialAtLeast 5`,
  `cooldown: 0.1`, `maxPerCast: 1`, `cooldown` action `who: self, skills:
  combo, seconds: −cd_minus` (`buff_chr_0003_endminf_potential5`).
- **`variants`** for `chr_0002_endminm` once G7 exists (§ The three IDs).
- **Waits on:** G1 (loads at all), G2 (crystal hit's talent 2), G7 (male).

### Equipment kits

- `wpn_sword_0003.json`: sources only (permanent stats).
- `wpn_sword_0008.json`: buff `wpn_sword_0008.atk` (self, `gameBuff
  buff_wpn_sword_0008`, `duration`, `zone: atk` `atk_up`); trigger `on:
  {event: hit, kinds: [battle]}`, `by: self`, `skill: sk_wpn_sword_0008`.
- `suit_crush_fracture.json`:

  ```json
  { "id": "suit_crush_fracture.phys", "target": "self", "gameBuff": "buff_equipsuit_crush_fracture_physicdamage",
    "duration": "duration",
    "modifiers": [{ "attr": 50, "value": { "product": [{ "eventCount": true }, "phy_dmg_up_perstack",
      { "if": { "any": [{ "enemyModifier": { "zone": "susceptibility", "element": "physical" } }, { "enemyStaggered": true }] },
        "then": "special_multi", "else": 1 }] } }] }
  ```

  trigger `on: {event: physicalStatus, statuses: [crush, breach]}`, `by:
  self`, `beforeDamage: true` (event 401 comes before the status's hit),
  `skill: passive_equipsuit_crush_fracture`. With G3 the `any` gains
  `{enemyBuff: "buff_common_originum_frozen"}`; with G4 it sees them.
- `suit_attri01.json`: buff `suit_attri01.smash` (self, `gameBuff
  buff_equipsuit_attrisuitup_01`, `maxStacks: max_stack`, `consumedBy:
  [battle]`, no duration, `damageBonus` `dmg_up` with `skillType:
  battle`); trigger `on: {event: cast, kinds: [combo]}`, `by: self`,
  `skill: passive_equipsuit_attrisuit_01`. Kits phase: check that a
  layered `consumedBy` buff adds per layer and is used up whole.
- `suit_str01.json`: sources only (Strength in the panel; the HP-based
  damage reduction isn't modelled).

## Kit (2026-10-19)

### Re-analysis (phase A)

The report's gaps against the engine as of 455a0ca:

| Gap | Now | How the kit uses it |
|---|---|---|
| G1 talents from chr_9000_endmin | covered (D1) | `{talent: 0/1, key}` load for both gendered IDs; values verified on 7e19 (0.30 ATK; +0.20 Physical DMG taken, below) |
| G2 crystal hit before the trigger's later actions | covered (T4) | `hits` with `now: true` in the three consumption triggers |
| G3 enemy buff by game ID | covered (T6) | Grizzled Edge: `{enemyBuff: buff_common_originum_frozen}` |
| G4 every trigger on one event judged at the event | partly (T5): a trigger's `if` is judged at the event, the values its actions apply are not | interim: Grizzled Edge's sealed case is its own trigger and buff, chosen by `if` (new gap K2) |
| G5 Crush logged as `buff_physical_crushed` | covered (L1) | the Crush hit in 7e19 is now checked |
| G6 the seal on weak enemies | deferred (batch file) | not modelled; no effect on bosses |
| G7 one kit for two IDs | covered (D2) | `variants: [{operator: chr_0002_endminm, skills: {power_attack2 → power_attack}}]` |
| `teamEnergyFrame` | replaced (S5) | `teamEnergy: [{frame: 11, ratio: 1}]` (matches the compiler) |
| Unknowns 13, 21, 40, 43 | still unknown | in-game tests below |
| D3 / V3 | open | D3: the KNOWN lines (finisher factors, the combo's 0-damage DamageAction, the ultimate's ignite DamageAction). V3 doesn't bite: P1's SP is returned SP in the data itself (atbSourceType 3), which is what the `sp` action gives |

New gaps (no engine code written; interims in the kit):

- **K1. Where a physical status's own damage falls** (family: physical
  state / triggers). **Feature:** a hit's status damage computed where the
  game computes it, inside the status's handler and before the applying
  skill's DamageAction, with status-event triggers able to run before it
  (Breach's order) or between it and the skill hit (Lift, Knock Down,
  Crush). Today the engine runs before-damage triggers, then the skill hit's
  damage, then the status's damage (`recordStatus`), then the other
  triggers. **Evidence:** BuffData `buff_physical_airborne`, `_knockdown`
  and `_do_crushed` buffEvent 0 run their DamageAction before IgniteAction 1;
  `_do_fracture` runs IgniteAction 1 before its DamageAction. 7e19 t=33734:
  the Crush hit (413,543) and the crystal hit carry talent 2's +0.2, the
  battle skill hit doesn't; t=14984 (Pogranichnik's Breach): the crystal
  hit has neither talent 1 nor Breach's DMG taken. **Interim:** two
  consumption triggers: `crystals_breach` before damage; `crystals_status`
  (Lift, Knock Down, Crush) after damage, so the status hit sees the
  crystals. **Impact of the interim:** the skill hit that applies Lift /
  Knock Down / Crush to a sealed enemy gets +20% Physical DMG taken it
  shouldn't and misses the new talent 1 (+30% ATK; P2's 15% on a teammate)
  it should have, roughly even; a buff a hit trigger gives on that skill hit
  reaches the crystal hit (Prominent Edge's first proc: about +15% on it).
  With every consumption before damage (the plan), the Crush hit would lose
  12–17%, the largest hit she has.
- **K2. Trigger values at the event** (family: triggers; the rest of T5).
  **Feature:** a buff a trigger applies takes its values on the situation
  at the event, like the trigger's `if` (`triggerSituation(…, atEvent, …)`
  for its modifiers, duration and layers), not after the triggers before it
  on the same event acted. **Evidence:** `buff_equipsuit_crush_fracture`
  event 401 sees the crystals its owner's Crush consumes (7e19 t=33734: 0.36
  = 4 × 0.06 × 1.5). **Interim:** `suit_crush_fracture.on_status` (`if: not
  enemyBuff`) and `.on_status_sealed` (`if: enemyBuff`), each ending the
  other's buff; both buffs stand for the one game buff, so only the stronger
  counts. **Impact:** none with the interim; the format needs the doubling
  for any value that depends on what the same event consumes.
- **K3. Kit debuffs the log doesn't list** (family: log tooling).
  **Feature:** the log checker tries enemy-side kit buffs that ZMDLogs
  can't show (talent 2 is a team aura, `buff_chr_0003_endminf_talent_0`, and
  the crystals aren't listed either) with and without, as it does for
  cast-consumed buffs, or infers the crystals' window from the log (combo
  hit to the consuming hit). **Evidence:** 7e19: every hit on the sealed
  enemy (12296–14984 and 29823–33734, with the crystal hits and the Crush
  hit at the consuming moments) is off by exactly ×1.2 (×1.139 under
  Breach's +0.437). **Impact:** those 8 hits can't match.
- **K4. +180 ATK on the Endministrator in 7e19** (family: data or build;
  **explained 2026-10-21:** Ginseng Meat Stew, a food buff the log doesn't
  list: UseItemTable `item_corp3_animal_1`, `buff_common_atk_buff_potion_2`
  ATK +180 flat (formulaItem 7) and Crit Rate +11.44% for 300 s; the
  owner suggested food. Hand-noted in the fixture, all 34 of her hits
  match). Every one of her hits is short by the same additive ATK:
  +21.98% in the ATK% sum, i.e. exactly +180 flat ATK before the attribute
  multiplier (180 / 819 = 0.2198), the same with and without talent 1 and
  Pogranichnik's ATK buffs. A lower weapon level can't do it (that scales
  base ATK, a factor that doesn't depend on the ATK buffs; 90 is already
  the maximum). With +0.2198 ATK and talent 2 added to the fixture (scratch
  copy), **33 of 34 of her hits match** within 1 point and the Crush hit is
  within 0.003% (413,530 for 413,543). Nothing in her CharacterTable, talent
  or potential rows, Grand Vision's skills (skill 3 at level 5 = the logged
  0.648) or her gear lines gives it. To settle: her ATK in the in-game stat
  panel against `efsim calc` for the same loadout (test K4 below).

Also open: when a Lift lands on a Vulnerable enemy the engine emits the
Vulnerable stack before the Lift, so `crystals_vulnerable` consumes the
crystals before the Lift's damage; in the game the order inside LiftAction
(no_guard's buffEvent 7 against airborne's buffEvent 0) is native code.

### What was written

- `packages/data/kits/operators/chr_0003_endminf.json`: the plan's kit with
  `variants` for chr_0002_endminm; buffs `originium_crystals` (enemy,
  talent 2 as `damageTaken` physical), `essence_disintegration` (self),
  `essence_disintegration_team` (P2, `recipients: not isOwner`); triggers
  `combo_window`, `crystals_status` and `crystals_breach` (split by K1),
  `crystals_vulnerable`, `crystals_ultimate` (delay 51, `awaited`),
  `p1_sp` (delay 11), `p5_cooldown`; skills as planned, `teamEnergy`, the
  combo hit under both log keys, the ultimate's `break` and `shatter` on
  sealed targets.
- Equipment: `wpn_sword_0003` (sources only), `wpn_sword_0008` (ATK on a
  battle-skill hit), `suit_crush_fracture` (two buffs and triggers, K2),
  `suit_attri01` (layered `consumedBy` buff), `suit_str01` (sources only).
- `examples/endministrator-crystals.scenario.json` (with Estella and
  Gilberta) and the build `examples/endministrator-p5.json`.
- `tests/kit-endministrator.test.ts` (9 tests): the variant (renamed IDs,
  same hits and damage when the male takes her place in the example); the
  example (Crush on the sealed enemy: Crush, crystal hit and battle skill
  hit with talent 2, none with talent 1; atk_scale_trigger 4.0; Grizzled
  Edge 0.09 from the sealed trigger; P1's 50 SP; talent 1 and P2 after;
  P5 twice: combo ready 11 s after it; Prominent Edge from the hit on); a
  teammate's Lift consuming through Vulnerable; a Breach consuming before
  its damage; the ultimate on the sealed enemy (three hits, P4's ×1.2, P3's
  15 energy, talent 1 at frame 51; one hit and no energy unsealed); P0 and
  talent 1 unlearned; Grizzled Edge unsealed (0.12 at 2 stacks); Bonekrusha
  (0.3 per layer, 2 at most, used up whole, battle skill only); Tarr 11's
  flat ATK 33.6 and the two sources-only kits.
- `packages/data/test/skillCompile.test.ts`: both IDs added to the
  comparison, with 8 KNOWN lines (4 per ID, all D3: the finisher's 0.1 /
  0.9 factors, the combo's 0-damage DamageAction, the ultimate's crystal
  hit from the ignite handler).
- `fixtures/pending/README.md`: the 7e19 entry.

### Deviations from the plan

- The plan's single `crystals_physical` (before damage) is two triggers by
  status (K1), found from the log and BuffData's order.
- Grizzled Edge's sealed ×1.5 is a second trigger and buff instead of an
  `enemyBuff` term in the value (K2).
- `crystals_ultimate` is `awaited` (the skill's own effect).
- The ultimate's `shatter` has no `detached: false` (the default).

### Verification

- `npm run check`: passes (480 tests).
- `efsim zmdlogs check fixtures/pending/zmdlogs-7e19489ae503.json`, the
  Endministrator: before 34 hits, 0 match, 0 mismatch, 1 unmodelled, 33 not
  covered (53% covered); after **0 match, 34 mismatch, 0 not covered (100%
  covered)**, every mismatch explained by K3 and K4 (33 of 34 match with
  both added; the Crush to 0.003%). The log's ×1.38 / ×1.11 were these two:
  ×1.2 talent 2 × 1.149 (the +180 ATK at ATK% 1.47) before the first
  consumption, 1.113 (the same ATK at 1.95, no crystals) after it. The
  other three operators' lines don't change. No other fixture names
  either ID; `zmdlogs-b7b3762d5da8` has Bonekrusha on Tangtang (no kit):
  unchanged. `zmdlogs reactions`: 7 statuses by the kit-less teammates
  logged but not predicted, as before.
- `efsim simulate examples/endministrator-crystals.scenario.json`:
  **233,088** in 11.07 s (Endministrator 109,589, Estella 72,271, Gilberta
  51,228). Every trigger, buff and both Grizzled Edge variants fire at
  least once in the example or the tests; the kit has no stacks and no
  conditional jumps.
- Other examples, with and without the new files: arcane-will-solo
  102,144, estella-solidification 186,540, gilberta-gravity-field 375,387,
  laevatain-solo 739,228, liino-laevatain 619,389, si-laevatain 1,017,035,
  typhoeus-gilberta 1,058,494 (sums of rounded hits), unchanged; none wears
  the new equipment.

### Open questions

- K4's +180 ATK: explained, Ginseng Meat Stew (above).
- Row 21: the ultimate's third (crystal) hit.
- Row 40: a weaker Grizzled Edge reapplication (the engine replaces).
- Row 43: Bonekrusha's layers without a duration.
- The Lift / Vulnerable order inside LiftAction (above).

### Proposed in-game tests

- **K4** Her ATK in the stat panel, with any loadout the owner has, against
  `efsim calc` of that build: a gap of about 180 × her attribute
  multiplier (about 860 with this log's Agility) would confirm it.
- **E1** Ultimate on a sealed enemy: two or three damage numbers (row 21).
- **E7** Crush on a sealed enemy vs unsealed, same Vulnerable stacks (four,
  e.g. after Lifts or Breaches), not staggered: the Crush number is about
  1.2× when sealed (K1: Crush's damage sees the crystals). Status hits can
  crit (3 of the 18 in the fixtures did): take a few of each and compare
  the smaller numbers.
- **E8** P5 (if the owner has it): combo, then battle skill and ultimate
  right away: the combo becomes castable about 11 s after it instead of
  15 s (stopwatch).
- **E4** Grizzled Edge: Crush with 4 stacks, then Breach with 1: does the
  buff icon's value stay or drop (row 40)?
- **E5** Bonekrusha: combo, wait 30 s, battle skill: still about 1.3× the
  battle skill's damage number (row 43)?
