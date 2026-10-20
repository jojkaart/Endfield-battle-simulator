# Batch 3: the 5-star operators

Owner (2026-10-19): after the Endministrator and the 4-stars (batch 2), the
5-stars; everyone has every 5-star at P5 (the default in searches).

Operators (rarity 5 in CharacterTable): Perlica (chr_0004_pelica), Chen
Qianyu (chr_0005_chen), Wulfgard (chr_0006_wolfgd), Arclight
(chr_0007_ikut), Xaihi (chr_0011_seraph), Avywenna (chr_0012_avywen),
Snowshine (chr_0014_aurora), Da Pan (chr_0018_dapan), Alesh
(chr_0024_deepfin), Purrchena (chr_0038_purrche).

Equipment: the 5-star weapons that have no kit yet, each with one owner of
its weapon type (the operator whose report covers it), and the two gear
sets still without one. Equipment is generic: written relative to the
wielder.

| Owner | Weapons (5-star) | Gear sets |
|---|---|---|
| Perlica (arts unit) | wpn_funnel_0004 Wild Wanderer, wpn_funnel_0007 Monaihe | suit_wisd01 |
| Xaihi (arts unit) | wpn_funnel_0012 Freedom to Proselytize, wpn_funnel_0014 OBJ Arts Identifier | suit_wisdwill01 |
| Chen Qianyu (sword) | wpn_sword_0005 Sundering Steel, wpn_sword_0007 Fortmaker | |
| Arclight (sword) | wpn_sword_0015 Aspirant, wpn_sword_0018 Twelve Questions | |
| Alesh (sword) | wpn_sword_0019 OBJ Edge of Lightness, wpn_sword_0020 Finchaser 3.0 | |
| Purrchena (sword) | wpn_sword_0023 Dessert Moment | |
| Snowshine (greatsword) | wpn_claym_0011 Seeker of Dark Lung, wpn_claym_0012 Finishing Call | |
| Da Pan (greatsword) | wpn_claym_0014 Ancient Canal, wpn_claym_0015 OBJ Heavy Burden | |
| Avywenna (polearm) | wpn_lance_0004 Chimeric Justice, wpn_lance_0006 Cohesive Traction, wpn_lance_0013 OBJ Razorhorn | |
| Wulfgard (handcannon) | wpn_pistol_0004 Rational Farewell, wpn_pistol_0006 Opus: The Living, wpn_pistol_0012 OBJ Velocitous | |

Logs with these operators (ZMDLogs fixtures): Perlica in
fixtures/pending/zmdlogs-e82d45c46040.json; Xaihi in
fixtures/zmdlogs-dbaee23b801d.json and fixtures/pending/zmdlogs-abfd4b7478ec.json;
Chen Qianyu in fixtures/pending/zmdlogs-7e19489ae503.json.

Phase: **analysis 1 done (2026-10-19); merge below.** Reports:
[batch-3/](batch-3/), one per operator, each ending with a kit plan.

## Merged gaps

Report references are `operator Gn` (a gap) or `operator row n` (a
mechanics row). Nothing is unique: every report checked
[kit-unique.md](../kit-unique.md), and every gap has a second user or is a
general rule. "Unknown" rows have an interim and wait on a test or a log.

| ID | Feature | Needed by |
|---|---|---|
| E1 | **Deferred** (owner decisions, item 3). Enemy charges as a state: `enemyActions` kind `charge` gets `seconds` (the charge-up's length; not in our tables, so the scenario says it), and the enemy is *charging* for that long. A battle-skill, combo or ultimate hit landing in it ends the charge and emits `{type: "interrupt", frame, operator, kind}`; the charge's scripted attack is optionally dropped. Triggers `on: {event: interrupt}` with `by`; predicate `enemyCharging`. The game's own interruption Stagger is applied once its value is known (0 until then). Chen's talent 2 is then an `interrupt` trigger with a poise-only hit (or a `poise` action) that doesn't count as a damaging hit for other triggers | Chen G1 (talent 2: 5 / 10 Stagger per interrupt); every operator's interruption Stagger |
| E2 | **Dropped** (owner, 2026-10-20: operator HP isn't tracked). HP left by an enemy attack, from the scenario: `enemyActions[].hpAfter` (ratio of the target's Max HP, default 1; scenario default `options.hpAfterAttack`), carried by the `attacked` event; `attacked` filter `hpBelow: ValueExpr` (matches when `hpAfter` < it). Heals don't raise it (no HP model). Owner first (below) | Snowshine G2 (her only combo trigger, `trigger_hp_ratio` 0.6), Catcher's second combo trigger (0.4, left out of her kit) |
| E3 | **Done** (read from the kit's `attacked` trigger with a `jump` of the current skill): dodge policy: with `dodge` on, the controlled operator doesn't dash at an attack its current skill would counter (a kit `attacked` trigger, `by: self`, whose `jump` names the current skill and whose `[from, until)` holds the playhead; or a skill field `noDodge: [from, until]`): the attack lands and the counter runs | Snowshine G4 (today `--dodge 1` loses every bash and her combo), Catcher (batch 2 G1), Purrchena row 34 (blocks), Ember |
| T1 | The `vulnerable` event carries the stacks before and after it. Filters: `fromNone: true` (0 before); if tests C3 / A say so, `rising: true` (the count went up: not a stack added at the cap of 4). If P1 is yes, the event also says it came from a physical status | Avywenna G3 (Chimeric Justice; interim `not enemyVulnerable 2`, exact while each application adds one stack), Chen row 10 (combo "becomes Vulnerable"), Da Pan row 13 (combo "reaches 4"), Chen row 29 |
| T2 | A trigger on any operator's buff being consumed: `on: {event: buffEnded, gameBuffs: [...], consumed?: true}`, `by` the buff's owner (self / teammate / anyone); `consumed` means ended by an action before it ran out (`endBuff`, a `consumedBy` cast), not expiry or a replacement. Judged on the situation at the event (batch 2 T5) | Alesh G1 (combo on the Endministrator's Originium Crystals consumed) |
| T3 | The `sp` event carries the grant's atbSourceType (SkillData per key, like K5's `spKinds`: 1 basic attacks, 3 skills, 0 finishers, perfect dodges and some extras); filter `sourceTypes: [...]` | Alesh G4 (OBJ Edge of Lightness, obtainTypeList [3]; interim `kinds: [battle, combo, ultimate]`, one extra layer at a Rare Fin) |
| T4 | A weighted random choice: trigger action `{kind: choose, options: [{weight: ValueExpr, do: [...]}]}`; one option, rolled on the battle's `chance` stream with p = weight / Σ weights (judged when the action runs; weight 0 excludes) | Purrchena G4 (giftbox item that never repeats the last; Prezzies; today an exact composite of 57 triggers) |
| T5 | Unknown: a combo trigger during the combo's own cooldown. Interim (engine-wide): ignored; the alternative keeps a window that opens when the cooldown ends | Arclight row 20 (3 s cooldown: her battle skill's consumption lands inside it), every short-cooldown combo |
| C1 | A buff modifier's `if` on the enemy (batch 2 C1) is judged on the enemy after the hit's own applications, as the data checks the target's tags when the damage is computed (after SpellInfliction); today `computeHit` gets the hit's `before` situation. Check against the logs that fixed "applications before damage" (Gilberta, Arcane) first | Avywenna (kit-plan note: OBJ Razorhorn's +22.4% missing on the hit that Solidifies), every C1 modifier |
| V1 | **Done** (f393bbe, K5): SP kinds from atbGainMethod (`spKind`; `sp` event `natural`) | Wulfgard row 3, Alesh rows 7, 20 |
| V2 | ValueExpr `{buffLayers: id}` (active layers of an own kit buff; 1 or 0 for a plain one) and Predicate `{buffLayers, atLeast?, below?}`, checked like `buffActive` | Avywenna G1 (lances: drops two counter stacks and their `buffEnded` triggers), MI Security's counter (`suit_criti01.layers`) |
| V3 | `KitHit.count` as a ValueExpr, judged at the cast before `requires` consumes; 0 lands nothing; later landings repeat the last frame (or `framesEvery`); each landing is its own hit event | Avywenna G2 (one returning lance per lance on the field; interim 15 + 5 hits with `requires atLeast k`, exact) |
| V4 | Percentage attribute buffs: `{attr, value, percent: true}` adds value × (base + Σ add) in the panel's percent slot (summed with the panel's percentages, not compounded); read by `{attr}` and `attrAtLeast` as flat buff attributes are; the loader takes it from formulaItem 6. A main-attribute percentage reaching ATK stays open (effects.ts) | Da Pan G1 (OBJ Heavy Burden DEF +50.4%: about +30% on Catcher's P1 strikes), `buff_equipsuit_defup_01`, `_maxhpup_01`, `buff_wpn_def_dur`, `buff_wpn_lance_0007`, `buff_wpn_lance_0012_attribute`, `buff_wpn_sword_0026_celebration`, `buff_wpn_pistol_0009`, Perlica's `normal_debuff` |
| B1 | stackingType 1 with a priority key: a reapplication keeps up to `maxStackCnt` instances (0: no limit), each with its own timer, and only the strongest acts; a weaker one doesn't replace a stronger one (open: which instance goes at the limit). Today `withBuff` replaces | Da Pan G2 (Ancient Canal: a Breach after a 4-stack Crush drops +56% to +14%; interim `maxStacks: 2`), Grizzled Edge (batch 2) |
| B2 | stackingType 11 across wielders (batch 1's B9): the strongest per group acts, whoever owns it. The loader groups only stackingType 1 (kits.ts `normalizeBuffs`), so two wielders' copies add | Xaihi E5 (OBJ Arts Identifier), Purrchena E3 (Dessert Moment; 9 equipment buffs), Perlica W3 (Wild Wanderer) |
| B3 | Unknown: stackingType 8's timer. The loader gives the layers one timer that each layer refreshes (batch 2 B3, Endaxis's reading); Chen's 7e19 log has her talent-1 layers gone 10.6 s after the first, though six were added since. If test C4 agrees, `sharedTimer` becomes "all layers expire with the first" for every stackingType 8 buff | Chen row 17, Perlica P3, Da Pan talent 1, Akekuri P1, Æthertech, MI Security |
| B4 | Unknown: whether stackingType 3 counters with a duration expire (Arclight's `extra_count`: lifeType 1 with a 10 s literal; Xaihi's `combo_count`: 10 s). Interim: never | Arclight row 31 (decides whether talent 1 fires without an Electrification teammate), Xaihi U2; test 42's question for Typhoeus's Signs |
| S1 | **Done**: MarkCanInterrupt: the loader reads a top-level, enabled MarkCanInterrupt into `SkillTiming.interruptibleFrom`; once the cast's playhead reaches it (not skipped by a jump), the action gate treats the cast as past its `exclusiveFrame` (whether dashes and swaps too is part of the test). Endaxis's runtime reads it so | Wulfgard G1 (plain battle skill holds 3.9 s, not 1.6 s), Snowshine G1 (+1.3 s per uncountered shield), Purrchena G3 (unshielded combo holds 6.9 s, not ~0.9 s), Arclight (f34), Catcher (f129, batch 2); Typhoeus (no change) |
| S2 | **Done for hits** (`KitHit.launch`; delayed trigger actions still open): a detached hit or delayed action belongs to its cast until its launch frame (a hit's `frames`; for trigger actions `detached: {from}` or a `launch` frame): before it, a cut cast or a jump over it drops it, and a jump before it shifts it, as for the cast's own items; after it, it lands whatever happens. A step without `at` doesn't wait for items a due jump will skip | Wulfgard G4 (phantom 8.5 × ATK shots; interim `detached: false`), Purrchena G2 (Prezzies 2.3 s late, the shielded giftbox 9 s late; interim real-frame delays), Laevatain (batch 1: frames 0–3 of her battle skill) |
| S3 | **Done for jumps decided at the cast** (event-driven jumps and `finishByAction` stops still open): a cast's slow-downs follow its playhead: one in a segment a jump skips, or after the action ended, never starts; a running `finishByAction` one stops when the action ends | Purrchena G5 (about 0.7 s of world drift per unshielded combo) |
| S4 | Helper skills reached by CastSkill: the loader accepts the SkillData files an operator's skill casts as `followUpOnly` kit skills in the caster's skill group, without a SkillPatchTable row (values from the caster's level values and the file's blackboard; timing from SkillData), cast by trigger `cast` actions at the data's frames | Purrchena G1 (`normal_skill_loop_1/_2`, `_block_1/_2`: the shield holds her 3 s or more; today 1.67 s) |
| S5 | **Deferred.** Dash attacks as rotation actions after a dash (`*_dash_attack`, skillSpecification 7), with hits and poise (small: rotations dash only to dodge) | Perlica G3, Wulfgard G5, every operator |
| S6 | **Done** (f62dde1): team-energy parts may add up to more than 1 when jumps make them exclusive | Arclight G1 |
| S7 | **Done** (f62dde1): a conditional jump's `if` reads the enemy's state at the cast | Arclight G2 (her Electrification variant) |
| A1 | A forced status's strength × the applying skill's `scaleKey` (`extra_scaling`) for every status, not only Combustion's ticks: Electrification's Arts DMG Taken (level × AI curve × scale), Breach's `physical_res_down`, forced Corrosion; taken at application, kept with the status (`ActiveStatus.damageScale`); default 1 | Perlica G1 (P4 ×1.33: about +4–6% on the team's arts hits for 8.75 s per combo) |
| A2 | `forcedReaction.extraSeconds` (ValueExpr), added to the level's table duration for that application only (`buff_common_cryst_cryst_frozen_triggered`'s `extra_duration`), not to the operator's other statuses as `statusTweaks` would | Snowshine G3 (P3: +2 s on the Snow Zone's Solidification) |
| A3 | `forcedReaction.level` as a ValueExpr, judged after the hit's earlier applications; `{consumed: true}` = the stacks the preceding `consumeInfliction` removed. The compiler emits ForceSpellStatusAction `consumedLayer` / `consumedType` as that pair | Alesh G2 (battle skill; interim five branch hits, exact), Arclight row 24 (ultimate; interim four `forcedReaction` entries) |
| A4 | `KitApplication.afterDamage: true`: the application (and its `if`) runs after its hit's damage, for data where a FinishBuffByTag or consumption follows the DamageAction; the default stays before | Wulfgard G3 (the extra shot keeps Electrification's Arts DMG Taken; interim a marker and two triggers), Arclight row 11 (interim a hit trigger) |
| A5 | **Done**: the delay is read from BuffData (buff_common_<e>_<e>_triggered: triggerInterval 1 s, waitFirstTriggerInterval; `BattleConstants.burstDelayFrames`); a pending burst is on the enemy's clock (`pendingBursts`, shifted by freezes and time stops). fluorite-gilberta 111,108 → 111,240; no log verdict changed. Was: Arts Bursts land 30 frames after the infliction, on the enemy's clock (paused and slowed with the enemy): the damage, the `burst` event and the burst's modifiers at that moment. Two-element reactions stay immediate; `KitHit.reaction` hits are unchanged | Xaihi G1 (logged +1.4–3.5 s; −23% on a burst across a stagger), Arcane (batch 1), burst triggers (OBJ Arts Identifier, Seeker of Dark Lung, Typhoeus); every operator |
| A6 | Unknown (logs only): does a reaction's initial hit take the status it creates? Engine and data: yes. e82d t=7544 fits only without it (×1.0078 vs ×0.783). If a second log agrees, the initial hit is computed before its own status | Perlica G2 |
| A7 | Unknown: does a Shatter count as consuming a reaction (Solidification)? If yes, a Shatter also emits `statusConsumed` (solidification) and the kits' `shatter` interims go. The interims disagree today: Twelve Questions no, OBJ Razorhorn yes, Alesh's combo yes | Alesh U1, Arclight W8, Avywenna U4, Liino's combo (batch 1 G7) |
| P1 | Unknown: does a physical status that only adds a Vulnerable stack (the enemy had none) fire "applies a physical status" effects (abilityEvent 401)? Engine: no. If yes, `physicalStatus` (or T1's `vulnerable` with its source) fires then | Chen row 29 (Sundering Steel), Xaihi E4 (OBJ Arts Identifier), Antal U1 (batch 2), Swordmancer (test 39), Grizzled Edge |
| D1 | **Done** (Probablity branches still open): jumps inside a top-level timeline IfElse (or Probablity branch) are read as conditional jumps at that frame, so `KitSkill.jumps: [{at, if}]` can name them | Wulfgard G2 (31 → 118; interim a cast trigger's `jump`), Purrchena row 20 (combo 0 → 210 / 270, loops 0 → 360), Alesh row 13 (Rare Fin 10 → 65 as a chance jump), Typhoeus's floating attacks |
| D2 | **Done** (2026-10-20, compiler and kit-draft; [kit-abstractions.md](../kit-abstractions.md#compiled-now-batch-1-d1)): poise units and `poiseControlledOnly`; per-hit element (Physical basics of an Arts operator); BreakingAttackCalculation factors; physical statuses (KnockDownAction, AirborneAction, CrushAction with `multiplierKey`, FractureAction; deadOption 2 only noted: Perlica's finisher Knock Down is then a dying target's, against her report's row 7, a question for the game); Vulnerable stacks; created buffs reported with their target. Batch 2's D3 is done with it, except jumps (D1) | all ten reports (e.g. Snowshine row 4, Avywenna G4, Arclight rows 3, 16, 25, Wulfgard row 40) |
| D3 | **Mostly done** (2026-10-20): IfElse / Probablity / SwitchAction alternatives as `branch` hits when each side is one hit landing equally often, else `if` where the conditions can be said (controlled, talent and potential gates), else notes; ExecuteIntervalAction ticks; AuraAction `buffInput` buffs with their ticks and applications; energy, applications (a physical status without a landing) and a hitless skill's SP as cast triggers; an application or grant inside an IfElse with `if` when sayable. **Open:** a ModifyDynamicBlackboard on a hit's scale (Chen's P5); Switch-chosen SP (Alesh); conditions on distance, tags and chance (notes) | Arclight row 16, Alesh (SwitchAction SP; the ultimate SP's kill listener counted once), Purrchena (item roll, Handicraft's 4 pulls), Snowshine rows 23, 30, 32 (combo `usp`, Snow Zone), Da Pan (ultimate f0 Lift, P5's Vulnerable), Chen row 14 (P5 `atk_scale2 += phy_up`) |
| D4 | **Partly done** (2026-10-20): a created status buff's assigned keys as `durationKey` / `scaleKey` (and a key's level); damage-unit processors (InstantModifyAttribute attribute 9 → `bonuses: critRate`, DamageScaleProcessor → damageBonus / multiplicative); a CheckBuffStackNumAdvanced on a talent- or potential-attached buff → `talentAtLeast` / `potentialAtLeast`, and a key only one talent or the potentials set (`talent2 > 0`) the same. **Open:** a CreateBuff on the target followed into its start event when its infliction sits on another branch than the landing (Avywenna's lance check); talents' attached buffs and their triggers; BuffData defaults of a talent's attached buff as values; spawned entities a later skill recalls reported as a stack to declare; no note for unreachable branches | Perlica (combo: P1's 8.75 s would be 12 s; ultimate crit), Avywenna G4, Da Pan (talents), Alesh row 27 (`CD` 3), Xaihi row 9 |
| L1 | **Done** (3eb9cf4): a stackingType 8 buff listed once is tried at 1 to its maximum layers after the plain reading fails, reported as `<buff> ×n layers`. Was: `zmdlogs check` counts a stackingType 8 buff the log lists once as 1 to `maxStackCnt` layers (as for unlogged cast buffs) and reports the count, or replays the kit's layers | Chen G3 (+3.5% per layer; part of why all 21 of her 7e19 hits mismatch) |
| L2 | **Done** (3eb9cf4, window only): same-element bursts match within 4 s (reactions keep 1.2 s); the burst tick isn't logged anywhere. Was: `zmdlogs reactions` matches a burst on the enemy-clock delay (with A5: +30 frames on the enemy's clock; until then a window that allows stagger and hit-stop), or by the burst buff's tick | Xaihi G2 (her three abfd bursts "not logged", then "unexpected" 1.4–3.5 s later) |
| N1 | **Done**: enemy HP **from the scenario** (scenario `enemyHp: [{at, fraction}]`, predicate `enemyHpBelow`) (owner, 2026-10-20): its HP fraction over the fight, default full (not computed from damage); predicate `enemyHpBelow: fraction` (CheckHp isRatio on the target), judged per hit, for `extraScale`, a modifier's `if` and a hit's `if`. Kills stay deferred | Alesh G3 (P5: ultimate ×1.5 below half HP, his largest hit), Chen G2 (P1 +20% below half HP; but 7e19 has it at full HP: test C1) |
| N2 | Operator HP and kills (batch 1–2's N1, deferred): stays deferred unless the owner decides otherwise; the interims stay | Xaihi U1 (crystal Amp at Max HP: always), Freedom to Proselytize (below 99%: never), Mordvolt Insulation (above 80%: always), AIC Light, Da Pan P1 and Alesh's ultimate SP (kills), Snowshine talent 1, Purrchena talent 2 |

Already open and only referenced (no new rows): Ti1b hit-stop (Arclight
row 15, Xaihi row 21, Avywenna row 28, Snowshine rows 8 and 34, Da Pan row
30, Alesh row 30), Ti2 projectile travel (Xaihi, Avywenna U3, Purrchena row
33), S10 dive attacks (every report), batch 2's K3 (no change for Da Pan:
row 22) and K6.

### Owner's decisions (2026-10-20)

1. **HP.** "For enemy HP, scenario should set it. For operator HP, it
   comes from stats and gear/weapon effects as well as if they receive
   damage during battle. … players usually have healing items set up that
   automatically trigger when HP drops below a percentage. So, unless
   there are damage effects that depend on HP, there's probably no point
   in tracking the HP itself."
   - N1 becomes **enemy HP from the scenario** (not from the damage dealt):
     the scenario says the enemy's HP fraction over the fight (e.g. below
     50% from a given time), default full; predicate `enemyHpBelow`.
   - Operator HP isn't tracked (N2 stays deferred): operators count as
     topped up by auto-heals, so effects needing an operator below an HP
     threshold don't fire (Snowshine's only combo trigger, Catcher's second
     half) and those needing full HP do. E2 (HP left per attack) is
     dropped. Revisit only if a damage effect depends on operator HP.
2. **Randomness.** "This is where the result becomes not a number, but
   rather a random distribution and needs to be interpreted and tracked as
   such." Rotations with random outcomes (trigger chances, random items,
   dodge success, rolled crits) are judged as distributions: search ranks
   candidates over several seeds (a distribution per candidate, not one
   seeded number) and reports the found rotation's distribution; a single
   seeded battle stays available for inspection.
3. Enemy charges as a state (E1) and dash attacks (S5): deferred (small:
   Chen's talent 2 Stagger; rotations dash only to dodge).

### Unknowns settled by in-game tests

Proposed tests that meet the rules in
[in-game-tests.md](../in-game-tests.md) (by eye, stopwatch differences of
2 s or more, relative comparisons), to be numbered there. Priority: high
affects many operators; medium needs a batch-3 5-star the owner has but
doesn't use; low needs Snowshine or Purrchena, or is tedious.

| Test (report) | Needs | Settles | Priority / existing |
|---|---|---|---|
| Combo trigger during the combo's cooldown (Arclight A2): ultimate, combo, at once the battle skill; does the combo light when its cooldown ends? Engine: no | Arclight | T5 | high (every short-cooldown combo) |
| MarkCanInterrupt (Wulfgard W1): on a clean dummy, battle skill then basic attack: first shot about 1.6 s (mark) vs 3.9 s (engine); on a Combusted dummy 2.4 s either way | Wulfgard (alternatives: Snowshine's triple shield, 4.5 vs 7.1 s; Purrchena B, ~1 vs ~7 s) | S1 | high |
| stackingType 8 timer (Chen C4): battle skill, combo 8 s later: the talent icon goes about 10 s after the battle skill (first layer) or after the combo (refresh) | Chen | B3 | high; same question as Akekuri's proposed P1 test (batch 2, not in the list) |
| Shatter as consumption (Alesh A): his ultimate, battle skill (Solidification; control: button dark), then Estella Shatters it: does his combo light? | Alesh, Estella | A7 | high (Liino's combo too). Avywenna's Razorhorn test (ATK icon after Estella's Shatter) and Arclight A3 (Twelve Questions) are variants |
| Physical status on an enemy without Vulnerable (Chen C2: Sundering Steel's icon after her first battle skill on a fresh enemy, 1 or 2 stacks after the second) | Chen with Sundering Steel; or Gilberta with 3 Swordmancer | P1 | high; same as test 39's optional Vulnerable-only part |
| Status events that don't change the count (Chen C3: combo after a stack added to an already Vulnerable enemy; Da Pan A: a stack added at 4) | Chen; Da Pan | T1 | medium |
| Chen's P1 at full HP (C1): basic attack 1 above and below half HP, no talent layers: ×1.19 apart (data) or equal (log) | Chen at P1+ | N1 for Chen | medium |
| An effect's own hit (Da Pan B: first combo vs one within 20 s with Ancient Canal up: equal (data) or ×1.3–1.4) | Da Pan with Ancient Canal | test 51's question (also Wulfgard row 21, Perlica P3 / Pulser Labs, Seeker of Dark Lung) | medium; a variant of 51 |
| Prep Ingredients' cut (Da Pan C): combo cooldown after his ultimate: 11.4 s (cut by 40%), 8.4 s (set to 40%), 19 s (none) | Da Pan with talent 2 | test 36's question ("of what's left" not separable) | medium; a variant of 36 |
| Forced Electrification over a stronger one (Perlica B): reaction Electrification III/IV, then her combo: the icon ends about 5 (8.75) s later (replace) or 15+ s later (kept) | Perlica | every forced reaction on a stronger status | medium |
| Perlica A (P3 stacks per Electrification: 1 or 2 on the icon) and C (Wild Wanderer's team icon on a reaction and on a forced Electrification) | Perlica at P3+; Wild Wanderer | U1, U3 | medium |
| Arclight A1: (a) the talent icon gone about 10 s after the first extra attack, or held; (b) at P5 the completing extra attack ×1.16 or equal | Arclight (two Electrifications within 10 s need a teammate) | B4, row 30 | medium |
| Xaihi X1 (Amp icon after a treatment while hurt vs at full HP), X2 (one or two crystals; Final Strikes to the combo), X3 (Final Strikes 12 s vs 3 s apart: is the combo castable?) | Xaihi | N2 interim, U3, B4 | medium |
| Wulfgard W3: basic attack 1 before and after P3 triggers: same (keeps +30%) or 9–12% lower | Wulfgard at P3+ | row 26 | medium |
| Wulfgard W2 (extra shot about 1.8 s vs 4.7 s after the cast) and W4 (combo lit by a reaction-forming infliction) | Wulfgard | test 17's and 35's questions | optional; variants of 17 and 35 |
| Avywenna 1 (lance numbers after one combo: 3, after two: 6) and 2 (Cohesive Traction: battle skill after two combos ×1.00 or ×1.17 over after one) | Avywenna; Cohesive Traction | U1, U2 | medium; her U6 is test 38 |
| Alesh B (combo lit when the Endministrator's crystals are consumed, dark when they run out) and C (Solidification about 5.75 s on 1 Cryo stack vs 7.75–8.75 s on 3–4; optional) | Alesh, the Endministrator | T2 | medium |
| Da Pan D (P5 on a fresh dummy: 2 stacks and no Lift number, or a Lift number) | Da Pan at P5 | row 11's order | medium |
| Chen C5: her stat panel vs `efsim calc` | Chen | 7e19's build (below) | medium; as tests 1 and 55 |
| Purrchena A (first swing at about 1.7 s or when the shield drops, about 3 s), C (does the giftbox repeat an item; tedious), D (two vortexes in one ultimate; tedious, P0) | Purrchena | S4, T4's no-repeat rule | low |

Not testable by hand (logs settle them): A6 (Perlica G2), A5's 1 s (Xaihi
G1), Wulfgard row 35 (6 frames), Snowshine row 31 (9 or 10 ticks),
Avywenna U3 and U5, Alesh's talent-1 cooldown and Rare Fin reading,
Purrchena's chances and Protection values, projectile travel (test 47).

### Log fixture corrections

- `fixtures/zmdlogs-dbaee23b801d.json` (committed): Xaihi's weapon level
  **85**, not 90: then all 7 of her hits match (weapon 89 with 3
  attribute nodes fits too; say so in the provenance note). It must go in
  the same commit as her kit, or `tests/logs.test.ts` fails.
- `fixtures/pending/zmdlogs-abfd4b7478ec.json`: Xaihi's (Seraph's) weapon
  level **60**: 75 of 75 match (other single-value fits leave 10–13
  mismatches). The log also shows two Cryo Amps from different operators
  adding (evidence for test 38's question, for Amp).
- `fixtures/pending/zmdlogs-e82d45c46040.json` (Perlica): the README's
  "×1.209" on her Electrification reaction is ×1.200 from her P3 ATK (a
  boundary buff) and ×1.0078 unexplained; the reaction fits only without
  Pulser Labs' bonus and without its own Electrification (A6). Her logged
  skill levels (all 1 at promotion 2) aren't reliable: her battle skill
  fits P3 at two layers or skill level 5–6. Stays pending; update the
  README's note.
- `fixtures/pending/zmdlogs-7e19489ae503.json` (Chen): the assumed build
  (weapon and gear levels aren't logged) is off: a drift of about −0.75%
  per talent layer fits 1 + ATK% ≈ 1.57 instead of 1.35 with a base about
  15% lower (like K7's +180 ATK). Type 50 Yinglung's unlogged combo bonus
  explains most of her combos' ×1.34 / ×1.54; Pogranichnik's
  `buff_wpn_sword_0012_atk_up` is listed 7–9 times on one hit; talent 1's
  layers are listed once (L1); P1's +20% is logged from 5.4 s at full HP
  (N1, test C1); slashes 5–6 (×1.106) and the final slash (×1.36, no
  talent entry) are unexplained (B3). Settle the build with her stat
  panel (C5).
