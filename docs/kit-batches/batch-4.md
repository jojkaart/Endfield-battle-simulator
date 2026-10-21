# Batch 4: the 6-star operators

Owner (2026-10-20): "Let's complete the rest of the operators now": the
eleven operators still without a kit, all 6-stars, with every weapon that
has no kit yet (all gear sets have kits since batch 3).

Operators (rarity 6 in CharacterTable): Ember (chr_0009_azrila), Lifeng
(chr_0015_lifeng), Yvonne (chr_0017_yvonne), Ardelia (chr_0025_ardelia),
Last Rite (chr_0026_lastrite), Tangtang (chr_0027_tangtang), Rossi
(chr_0028_wulfa), Pogranichnik (chr_0029_pograni), Zhuang Fangyi
(chr_0030_zhuangfy), Mi Fu (chr_0031_mifu), Camille (chr_0033_camille).

Equipment: the 41 weapons without a kit, each with one owner of its weapon
type (the operator whose report covers it). Equipment is generic: written
relative to the wielder.

| Owner (weapon type) | Weapons |
|---|---|
| Rossi (sword) | wpn_sword_0011 Rapid Ascent, wpn_sword_0012 Thermite Cutter, wpn_sword_0013 Eminent Repute, wpn_sword_0014 White Night Nova, wpn_sword_0016 Never Rest |
| Pogranichnik (sword) | wpn_sword_0017 Glorious Memory, wpn_sword_0021 Grand Vision (and its variant wpn_sword_0021_ink), wpn_sword_0022 Lupine Scarlet, wpn_sword_0024 Complexed Industry, wpn_sword_0026 Farsight |
| Ardelia (arts unit) | wpn_funnel_0006 Opus: Etch Figure, wpn_funnel_0008 Detonation Unit, wpn_funnel_0009 Oblivion, wpn_funnel_0010 Chivalric Virtues, wpn_funnel_0013 Dreams of the Starry Beach |
| Zhuang Fangyi (arts unit) | wpn_funnel_0015 Lone Barge, wpn_funnel_0017 Flickers in the Mist, wpn_funnel_0018 Junction Point, wpn_funnel_0020 Suffering's End |
| Ember (greatsword) | wpn_claym_0004 Exemplar, wpn_claym_0006 Former Finery, wpn_claym_0007 Thunderberge |
| Last Rite (greatsword) | wpn_claym_0008 Sundered Prince, wpn_claym_0013 Khravengger, wpn_claym_0016 Phantom Pain |
| Mi Fu (greatsword) | wpn_claym_0017 Amaranthine Tassel, wpn_claym_0019 Long Heritage |
| Lifeng (polearm) | wpn_lance_0007 Beacon of Duty, wpn_lance_0009 Opero 77 (3-star), wpn_lance_0011 JET |
| Camille (polearm) | wpn_lance_0012 Mountain Bearer, wpn_lance_0015 Blessing of Lustrous Carmine, wpn_lance_0016 Golden Age |
| Yvonne (handcannon) | wpn_pistol_0005 Navigator, wpn_pistol_0007 Home Longing, wpn_pistol_0008 Wedge |
| Tangtang (handcannon) | wpn_pistol_0009 Clannibal, wpn_pistol_0010 Artzy Tyrannical, wpn_pistol_0011 Brigand's Calling |

The split is by weapon type only (no signature-weapon pairing is recorded
in the tables we read); a report may say a weapon belongs with another
operator of its type, and the merge moves it.

Logs with these operators (ZMDLogs fixtures):
- Ember and Pogranichnik: fixtures/pending/zmdlogs-7e19489ae503.json;
- Yvonne: fixtures/pending/zmdlogs-abfd4b7478ec.json;
- Last Rite and Tangtang: fixtures/zmdlogs-b7b3762d5da8.json;
- Rossi: fixtures/zmdlogs-4e5e1390085e.json;
- Camille: fixtures/zmdlogs-40d9a3c1da37.json and
  fixtures/zmdlogs-4e5e1390085e.json;
- none for Lifeng, Ardelia, Zhuang Fangyi, Mi Fu.

Phase: **kits done (2026-10-21).**

**Kits done (2026-10-21):** all eleven, with the weapons of "Weapon
owners", each with a test file and an example; each report ends with a
"Kit (2026-10-21)" section. Logs: b7b3 matches every hit of all four
operators (Arcane 13, Last Rite 5, Tangtang 46, Si 21); 7e19:
Pogranichnik 29/29, Ember 14/21 (the rest outside her kit), reactions 7
matched / 0 unexpected; 4e5e: no mismatch, reactions 18/0/0; abfd: Yvonne
182/183 (the killing blow); 40d9: Camille 6/6 with her one Link stack on
Gilberta's ultimate. Full check 1573 tests; the 21 earlier example
totals unchanged. Pattern review:
[kit-abstractions.md](../kit-abstractions.md#review-after-batch-4s-kits-2026-10-21).
Dive attacks (batch-1 S10): in progress.

Earlier phase: analysis 1 done (2026-10-20); merge below. Reports:
[batch-4/](batch-4/), one per operator, each ending with a kit plan.

## Merged gaps

**Status (2026-10-21):** shared features merged (five groups in
worktrees, one merge at a time with the full check, example totals and
log outputs after each). Done: E1, E2 (the rank mapping from
EnemyTemplateDisplayInfoTable `displayType` is a claim), T1–T3, C1–C4,
V1, V2 (Combustion and `atkSnapshot` ticks keep the applier's side —
ATK, DMG bonus, Amp, crit, Arts Intensity — from their application, as
4e5e's three ticks show), B1–B6, S1–S9, S11, S12, D1–D6, L1–L6; D7–D10
partly (the items left are listed in the merge commits). Deferred: B7,
B8, V3. Dive attacks (batch-1 S10): the owner wants them (2026-10-21),
next. Example totals moved only by B1 (Link, 1–9% lower) and V2 (four
examples with Combustion); log verdicts only improved.


Report references are `operator Gn` (a gap), `operator row n` / `Wn` /
`En` (a mechanics or equipment row) or `operator Un` (an unknown); the
reports are claims, re-checked only where a row says so. IDs are this
batch's; items of earlier batches are named with their batch (batch-3 T5,
and batch-1 S10 for dive attacks: this table skips S10 so the name stays
unambiguous). Nothing below is unique except where a row says "one user"
([kit-unique.md](../kit-unique.md) lists only Si's damage record); a
one-user row is a general data rule or a kit-format field, not an
operator module. Impact: **large** (a main rotation or every team off by
10% or more), **medium** (one operator's damage or timing off by several
percent, or a weapon effect lost), **small** (rare cases, tooling, a few
frames).

| ID | Feature | Needed by |
|---|---|---|
| E1 | **Medium.** Enemy super armor as a predicate: `enemySuperArmor: {atLeast?, below?}` (CheckSuperArmor; compareType 3 ≥, 2 >), judged like `enemyStaggered` in jumps' `if`, hits' `if` and triggers. The data layer reads EnemyAttributeTemplateTable `initialSuperArmor`, and `zeroPoiseSuperArmor` while Staggered (assumed: the check reads the current value; Rhodagn 30 either way). Batch 2's "enemies have no super armor in EnemyData" (Endministrator G6) was wrong: all 149 templates have it | Mi Fu G2 (Cloudtrapper's heavy path at ≥ 30: about 6 frames per cast); the Endministrator's seal (< 20, batch-2 G6, deferred on that wrong claim), Arclight's ultimate freeze (< 10), Snowshine's frost (< 30): freezes that skip bosses but hit trash enemies |
| E2 | **Small.** Enemy rank as a predicate: `enemyRank: [ranks]` (CheckEnemyRank `enemyRankSet`, 1 normal, 2 elite) from the scenario's enemy; the table that gives the rank is still to be found (EnemyTemplateDisplayInfoTable `displayType` is a candidate, a claim) | Rossi G7 (ultimate stops normal / elite enemies 2.87 / 3.1 s, not bosses) |
| T1 | **Medium.** Buff-category triggers by element, recipient and receiving side. `on: {event: buffApplied, categories}` gets `elements?` (a listed-category modifier reaches one of them; an all-element or all-Arts one counts), `allElements?` (it reaches every one: the Arts Amp tag 486772476 is only on `_enhance_spell` / `_enhance_all`), `toOthers?` (it reaches an operator other than its applier) and `received?` (fires for the owner when such a buff reaches it, from anyone; today `categories` match the applier). The `buffApplied` event carries per category the elements and the recipients. Tags map to it: 1066759270 Physical Susceptibility, 1427729990 Arts Susceptibility, 458037917 / 1425735059 / −1640994543 / −575106878 Heat / Cryo / Electric / Nature Susceptibility, 486772476 Arts Amp. `KitBuff.categories` overrides the loader's inferred ones (an EnhancedAction that only raises an active Amp's rate, Zhuang Fangyi's `t1_amp_plus`, isn't "gaining an Amp"). Kit Susceptibility and Amp buffs name operator game buffs, so `gameBuffs` can't stand in. Open reading, shared: CheckBuffIdInContext checkType 0 = the ID list, 1 = the tag query (Pogranichnik W1, W4) or IDs and tags (Mi Fu E11); it decides Grand Vision's stray tag 1066759270 under checkType 0 (Mi Fu G4 lists it as a tag check, Pogranichnik W4 as an ID check: the reports disagree; test 92 decides) | Lifeng G4 (Beacon of Duty's team buff: Heat / Arts Susceptibility); Mi Fu G4 (Amaranthine Tassel E2: Physical; Long Heritage E10, E11: Arts Amp given to another); Camille G4 (Mountain Bearer: Physical, `fromKinds [battle]`; alternative there: `fromKinds` on the `gameBuffs` form); Zhuang Fangyi G3 (Flickers in the Mist: Electric or Arts Amp received from anyone); Zhuang Fangyi J2 (Junction Point: the four elemental tags; interim counts Physical); Grand Vision (Pogranichnik W4, if checkType 0 reads tags); existing `wpn_funnel_0016` (Solemn Phalanx: its `categories` interim also counts Physical) |
| T2 | **Small (medium with a skill healer).** `heal` trigger filter `toOwner: true` (the mirror of `toOthers`): heals whose target is the trigger's owner, from any healer (`by: anyone`), with the `kinds` heal-tag filter (abilityEvent 45 OnReceiveHeal; weapons on the wielder's own heals use 50). One user so far, a filter, not a mechanism | Camille G3, U1 (talent 2: with Liino, Xaihi or Purrchena in the team 5 layers, Heat DMG +20–50%; zero if 45 counts only her own heals: test 93) |
| T3 | **Medium to large, engine-wide (follows the owner's decision 2 of batch 3, no new decision).** Crit-triggered effects under expected crits: `randomOutcomes` lists kits with `on: {event: hit, crit: true}` triggers (operator and equipment) as random, so search ranks them over seeds with rolled crits; `simulate --crit expected` warns that such effects never fire (design.md says "no hit counts as a crit for triggers", silently) | Rossi G6 (talent 2, about −30% for the logged build in expected mode); Lupine Scarlet (Pogranichnik W6); MI Security (`suit_criti01`); Artzy Tyrannical (Tangtang, "needs rolled crits") |
| C1 | **Medium.** Predicate `castLink: {atLeast?: n}` (default 1): the hit's cast used at least n Link stacks (the engine's cast-bound Link, `KitBuff.link` stacks included), judged from the hit's own cast so detached entity hits (`launch`) see theirs; false for trigger hits not of a cast. With B1 it reads only real Link sources | Lifeng G1 (ultimate's third hit, 6.0 of 14.0 × ATK: interim "always"); claims for others not taken up by their reports (Rossi's `skillimbue` dynamic key) |
| C2 | **Small.** Predicate `operatorBuff`: `{categories: [...]}` (any active buff from anyone reaching the operator is of one of these: amp and susceptibility by zone, weakness / protection by attributes 62 / 63, `shield` by BuffData applyTags −1757502026, read by the loader) or a BuffData ID (a buff standing for that game buff reaches the operator from anyone: the twin of `enemyBuff`); usable as `eventOperator: {operatorBuff: …}`. The twin of `operatorModifier` (zones only) | Ember G2 (Catcher's P5 SP while shielded by Ember's ultimate, Thunderberge or Mi Fu's shield), Ember G4 (Former Finery: an attacked operator with Protection; heal events only), Last Rite G4b (her Mirage trigger on the holder of a perfusion) |
| C3 | **Medium** (Tangtang's part large once dives are scheduled). Decorate-mask filters on buff modifiers and Stagger efficiency from buffs: `KitBuffModifier.decorations: [finalStrike \| finisher \| dive]` (as `TriggerOn.hit.decorations`; with the existing per-hit `if: {controlled}`); attribute 26 (PoiseDamageOutputScalar) allowed on kit buffs and summed into a hit's Stagger (`dealPoise` reads the panel's only) under the same filters; the `dive` decoration (bit 1024) on hit triggers too | Last Rite G2 (P1 +20% on one Final Strike per perfusion; Sundered Prince's +33.6% Final-Strike Stagger); Tangtang G1 (a controlled operator's dive ends the OLDEN STARE early: early wave 8.05 vs 4.6 × ATK, talent-2 Waterspouts; waits on batch-1 S10, owner item 2) |
| C4 | **Medium.** Running beside a basic attack: (a) predicate `currentAction: {kinds, beforeExclusive?}` (CheckSkillType `checkTargetCurSkill` / `mustBeforeExclusiveTime`) for `beside`; (b) the `cast` event says `beside: true` (filter `on: {event: cast, beside?}`) so the beside path's SP, energy and buffs come at frame 0 and the animated path's at its frames; a beside cast takes no jumps, MarkCanInterrupt or lock | Last Rite G3 (controlled battle skill inside her own chain: about 1.1 s of DPS per cast, SP / energy 1 s late; test 82); other `CheckSkillType checkTargetCurSkill` users: Liino's `normal_skill_end`, Si's `normal_skill_inkhurt_front` |
| V1 | **Medium; one user in the data.** `KitHit.zoneScale: [{zone, value: ValueExpr}]`: every modifier of that zone reaching the hit (from anyone, the enemy's debuffs included, only those reaching the hit's element) × value for this hit; the compiler reads a target-side InstantModifyAttribute with formulaItem 8 into it. b7b3 confirms the whole-zone reading exactly (×1.1811 on both slashes; a prototype makes 5 of 5 match). Only Last Rite's data has it: as a general damage-pipeline field it stays out of kit-unique.md; if it's written in her module instead, it goes on that list | Last Rite G1 (talent 2: her ultimate slashes +7–18%); `tests/logs.test.ts` fails on b7b3 until it lands with her kit |
| V2 | **Medium to large (every Combustion).** Periodic damage with an ATK snapshot: a DamageAction with `takeAtkSnapshot` takes the applier's ATK when the buff or status is applied, kept by its ticks (`KitHit.atkSnapshot` on a `buffTick` trigger hit, stored with the buff instance; status.ts stores the applier's ATK with Combustion). **The reports disagree on the scope:** Rossi G5 reads the flag as ATK only; Camille U5 finds 4e5e's three Combustion ticks (66004–68449 ms) fit only with the applier's DMG bonuses at the reaction (Lustrous Carmine's Heat DMG, a talent-2 layer), i.e. a wider snapshot. Interim: today's (each tick's state); test 77 decides ATK, a log with a DMG-bonus buff ending mid-burn decides the rest | Rossi G5 (bleed), Camille U5; Combustion (`buff_common_burning_status`) in every Heat team; Liino's ultimate projectiles, Tangtang's Waterspouts and stare (flag in 12 files) |
| V3 | **None on numbers (optional; kit size).** `KitHit.count` judged at the hit's `launch` frame, `framesEvery` as a ValueExpr, a last-landing override (`lastFrameExtra`, its own scale and stagger); a value for an `sp` event's amount; a predicate on a combo's window count. Each replaces an exact composite | Zhuang Fangyi G7 (36 conditional entries and a stack become four hits; Avywenna's f7 the same); Pogranichnik "possible simplifications" (talent-1 bank, combo count buffs) |
| B1 | **Done** (2026-10-20: trigger action `link`, `{count?, seconds?}`; no built-in stack per combo; most example totals 1–9% lower; in-game test 8 rewritten to confirm). Was: **Large, engine-wide; owner decision 1.** Link only from Link sources: drop the built-in stack every combo cast leaves (timeline.ts, `costs.kind === "combo"` → `LINK_FRAMES`); stacks come from a skill's SkillData `ComboAction` (count, duration, at its frame; the loader compiles it into SkillTiming, e.g. `linkGrants: [{frame, count, seconds}]`) and from kit buffs with `link: true` (Akekuri's talent 2, unchanged). Consumption and the values per stack count (batch-1 B8, test 8) stay. Open within it: Lifeng's stack lasts the ComboAction's 20 s or the Link buff's literal 15 s (Lifeng U2, test 78); Camille's ComboActions sit in her talent-1 branch (hovering target). The engine's reading came from one log (40d9), which fits this one too | Lifeng G2, Camille G2 (and every team: battle skills ×1.30–1.75 and ultimates ×1.20–1.50 too high within 15 s of any combo); Rossi G9 (4e5e's fits: see owner item 1); Akekuri's talent buff (Camille G2); test 8's set-up, test 29's Link part and data-sources.md's Link paragraph assume the built-in stack |
| B2 | **Small.** A game buff whose stacking names a `maxStackCntKey` the applying skill lacks: the loader takes the buff's own blackboard value (Tangtang: `cntmax` 1 in the buff), else what the game reads for a missing key, 0 (no limit, as batch-3 B1's 0), instead of refusing the kit. The reports propose the two halves (Tangtang the buff's blackboard; Ardelia and Yvonne 0); they don't conflict. "A missing key reads 0" is also U2's question for the copied toggle (test 75's variant) | Tangtang G2 (`spout_susceptibility_2`), Ardelia G4 (Dreams of the Starry Beach `_valid`), Yvonne G4 (Navigator `_valid`: without a stack group the two copies add, +0.098 + 0.196 Cryo DMG; Wedge `buff_wpn_pistol_0008`, `_extra_valid`); until then those kit buffs carry no `gameBuff` (no log name, no stack group across wielders) |
| B3 | **Small.** stackingType 10's timer: the loader sets `sharedTimer` for stackingType 10 as for 8 (it's the inflictions' type, which the engine already runs on one refreshed timer), settled with batch-3 B3 by test 62 (Ember variant). 7e19 lists Ember's buff once although applied twice: one timer, or a log that lists type-10 layers once. Interim: `sharedTimer: true` written in her kit | Ember G3 (talent 2, ATK +9% per layer, up to 7 s earlier loss with own timers); Rossi's `combo_usecount`, Typhoeus's `passive_spellbrust_damageup` (no kit buff) |
| B4 | **Small.** Trigger action `buff` (and `BuffApplication`) takes `duration?: ValueExpr`, the application's own duration (CreateBuff `assignItems`), so one kit buff keeps one layer cap | Pogranichnik G3 (Fervent Morale from talent 1 at 20 s and from talent 2 at 10 s: one buff with one cap of 5; the kit's two self buffs can exceed it) |
| B5 | **Medium.** What a cast-consumed buff reaches: a `consumedBy` buff standing for a CreateBuffAttachingSkill buff acts on all its owner's hits while the consuming cast runs (its physical-status hits, reaction hits, trigger hits), not only hits with the cast's index; buffs whose data checks the cast ID (Jade Vessel's CheckSkillCastId) keep today's rule. A field such as `consumedScope: cast \| whileCasting`, defaulted by the loader where it can tell. 7e19 t=33734 shows Grand Vision's `_valid` on the Endministrator's battle skill, its Crush and the crystal hit | Pogranichnik G5 (Grand Vision on the Endministrator: her Crush and crystal hit miss +64.8–100.8% Physical DMG, about −30% on her opener); Glorious Memory `_valid`, Aspirant `_pdi_up` (Lift / Knock Down hits inside an ultimate) |
| B6 | **Small to medium.** One recipient's use of a team buff: trigger action `endBuff` with `to: "eventSubject"` (the twin of `buff`'s): the team buff stops reaching that member only (the active buff keeps the members it no longer reaches); used with C2's `operatorBuff` | Last Rite G4 (each member's first Final Strike after her off-field battle skill makes Mirages, 3.84 × ATK and a Cryo stack per extra member after a swap; interim one use for the team, exact without swaps; test 83) |
| B7 | **Small; one user; deferral proposed** (cost: up to 35 frames of Empyrean per ultimate, only when an action starts in its last second). `KitSkill.holds: [{buff, until}]`: a buff that would expire while the cast's playhead is in [0, until) ends at `until` or when the cast is cut (ExtendBuffAction; Endaxis reads it the same way). Shared code if added (a generic BuffData action) | Zhuang Fangyi G4 |
| B8 | **Tiny; deferral proposed** (one strike fewer in a 13-frame edge case). Trigger action `extendBuff` with `atLeast: s`: each active layer's remaining time becomes max(remaining, s) | Zhuang Fangyi G6 (Sunderblades set to at least 3 s at the battle skill's start) |
| S1 | **Large (Rossi).** `openCombo` from the operator's own combo, for its next sequence: `openCombo` gets `skills: [ids]` (a window only those skills use), is exempt from the rule that a combo's own events don't open its owner's window (`runTriggers` origin check), and lasts `seconds` (ValueExpr, default 6 s) or `whileBuff` (until an own buff ends, so `extendBuff` on it, the finisher's PauseComboSkillTime, extends the window) | Rossi G1 (sequence 2 can't be cast: (3.45 + 2.07 × stacks) × ATK, 10 energy, a Lift and the 15 s crit buff per combo; a scratch change confirms the rest works); Rossi row 5 (the pause) |
| S2 | **Small** (the interim is exact while nothing else moves the cooldown). Trigger action `cooldown` with `setFraction: ValueExpr`: each matching skill's cooldown restarts at that fraction of its own full cooldown, running or not (SetSkillCdAtOnce functionType 1, isPercentage), here on a buff's end | Rossi G2 (combo back about 21 s after sequence 1 when sequence 2 is skipped, not 14 s; interim +7.233 s; test 86); Typhoeus's two combos have the same action inside a cast (`cooldownGroup` covers that) |
| S3 | **Small to medium; policy, owner item 3.** Search and short timing windows: when a skill's `jumps` or a hit's `if` read an own buff a pending trigger of the operator applies shortly (Rossi's `qte_ring` from combo_2's cast), search also tries the step at that buff's start, not only at the earliest legal frame. Alternative: assume the player always hits the ring (drop the jump) | Rossi G4 (the perfect-timing path's extra Vulnerable stack is never found) |
| S4 | **Large (Zhuang Fangyi).** Combo cooldown recovery rate from a buff (attribute 93, ComboSkillCooldownRecoveryScalar, default 1): while active, the owner's combo cooldown runs at that rate, over time (not only at the cast, unlike batch-2 S2's attribute 47); progress is kept when the buff starts or ends. Rate 4 (text) or 5 (formulaItem 6 + 4 in the panel's percent slot) is her U4, not testable by hand (4.25 vs 3.4 s) | Zhuang Fangyi G1 (in each 25 s Empyrean the combo returns after 3.4–4.3 s instead of 17 s: 3–5 combos of 5.4 × ATK and their Sunderblades missing per ultimate); Liino's `normalskill_combocd` has the attribute (unused) |
| S5 | **Large (Zhuang Fangyi).** A skill's SP cost changed by buffs (attribute 45, AtbCostAddition): cost at the cast = max(0, cost + Σ attribute 45 of the caster's active buffs), checked by the action gate | Zhuang Fangyi G2 (the free Empyrean battle skill waits ~12 s for 100 SP; 100 SP per ultimate) |
| S6 | **Small.** `castHelpers` also follows CastSkill in the BuffData an operator's skills create, so the cast skill can be a `followUpOnly` kit skill cast by a trigger (its exclusive frames, ending the current action). 13 BuffData files have CastSkill (Arcane, Camille, Liino, Si, the common dash listener) | Zhuang Fangyi G5 (`ultimate_skill_end`: a 0.67 s exit lock and the cut of the current action at each Empyrean end); Camille G1's path (`buff_…_cast_combo2` casts `combo_skill_2`) |
| S7 | **Small.** `KitSkill.comboWindow: false` (name open): a combo-kind skill cast without the combo window (another button, here the battle skill's under a ChangeSkillAction), with its own cost and cooldown, gated by `available`; a combo for everything else (cast kind combo, `followUp: false`, combo hits, doesn't consume Link, doesn't put the regular combo on cooldown). Compare Zhuang Fangyi's `combo_skill_ult`: a swap on the combo button, which needs her window and is already expressible | Camille G1 (Hunter Pursuit; interim exact for damage, SP and energy, but the button counts as a battle-skill cast: uses Link, fires "casts a battle skill" effects; Hunter Pursuit is `followUp: true`) |
| S8 | **Medium.** Chain steps from input mapping and buffs that map the basic attack: (a) the loader takes a basic attack's chain continuations from its ComboCacheAction mapping, AllowNextSkillAction windows only giving their frames (a window listing a step the cache doesn't map makes no chain step); (b) a kit buff `basicAttack: skillId` (the loader can read it from a ComboCacheAction in the game buff's buffEvent 5): while active, the owner's basic-attack input is that skill (a chain head or inside any window listing it; an open window of another step doesn't defer it; other basic attacks can't start). Only Yvonne's two buffs have it; no other chain lists an unmapped step (scan) | Yvonne G1 (without the interim attack1 → attack5 at frame 0: a Final Strike every ~1 s; the interim makes attack5 or the end strike wait up to ~0.5 s for another step's window; how long the mapping holds: Yvonne row 30, test 79) |
| S9 | **Small, general.** AllowNextSkill windows open only when reached and when their condition holds: (a) the loader marks windows under a TogglableAction or an IfElse branch `conditional`; `KitSkill.windows: [{from, skills?, if}]` says when they're open (judged at the cast, like `jumps`), an unlisted conditional window stays closed; (b) `actionGate` opens a window only on frames the playhead reaches: one wholly inside a jumped segment is closed (today it opens at the jump's frame, `actionFrame` mapping skipped frames to the jump), one that straddles the jump's target opens there; exclusive and duration frames keep today's mapping | (a) Yvonne G2 (attack4 → attack5 from 0 instead of 24; Typhoeus's floating attacks are the other conditional windows); (b) Mi Fu G1 (next move 10 frames early after Cloudtrapper on heavy targets, once E1 lets her take the jump), Ardelia G2 (with D1); also Wulfgard, Arclight, Catcher, Rossi, Pogranichnik, Last Rite (windows inside jumped segments: hidden where own hits hold the next step) |
| S11 | **Medium (Pogranichnik).** Several MarkCanInterrupt on one timeline: `SkillTiming.interruptibleFrom` becomes a list; the gate uses the first one the playhead reaches that no taken jump skipped (batch-3 S1 keeps the first only) | Pogranichnik G2 (after a 2- or 3-stack combo, actions outside its windows wait 3.2–3.7 s too long); Purrchena's `normal_skill` and `normal_skill_loop_1`, Typhoeus's `floating_attack4` (to be re-checked: affected only where a jump skips the first mark) |
| S12 | **Small to medium.** Dodge policy for counters that aren't jumps: skill field `noDodge: [from, until]` (skill frames on the playhead), checked by `counters()` beside the jump form: the controlled operator doesn't dash at an attack in that range; the attack lands and its triggers fire. **Correction:** batch-3 E3 lists Ember as done, but only the jump form exists | Ember G1 (with dodging on, her battle skill loses the slam: 81% of its multiplier, Knock Down, Vulnerable, Stagger, team energy, talent 2 and her own combo window); Purrchena (batch-3 review: blocks written as `cast`, could use the same field) |
| A1 | **Unknown, small.** Does a reaction's consumption (another element's infliction turned into a reaction by this hit) count as "consuming an infliction"? Engine: yes (`inflictionConsumed` includes it). If no, `inflictionConsumed` gets a `fromReaction`-style filter | Last Rite row 29 (talent 1 Hypothermia on a Mirage's reaction; test 81); OBJ Velocitous (batch-3 Wulfgard W7) |
| D1 | **Medium (Ardelia).** Loader: a timeline JumpToAction preceded in its own sequence by an enabled condition action (`Conditions.*`, `Check*`, `CompareFloat`, `NotNextCheckAction`, `Probablity`) is `conditional` (a sequence stops at the first failing check), so `KitSkill.jumps` can say when it's taken. Only this file has the pattern (scan) | Ardelia G1 (every battle skill takes talent 2's recast path: about 1 s lost per pair of battle skills; with S9b her next attack 14 frames early) |
| D2 | **Small to medium.** Loader: `SkillData.spKinds` / `spSources` of a skill also hold the ObtainCostAction keys of the files its timeline reaches (spawned entities, helper casts, created buffs' handlers and their entities), so a kit hit naming such a key gets `natural` and `sourceType`. Alternative: `KitHit.spSource` by hand. 7e19 confirms (Thermite Cutter applied at each harass and the Assault) | Pogranichnik G1 (5 of 9 skill-SP grants per ultimate invisible to `sourceTypes: [3]` effects: Thermite Cutter, Never Rest, Lustrous Carmine, Frontiers) |
| D3 | **Small.** Weapon variants: a weapon without its own kit uses the kit of a weapon with the same `weaponPotentialSkill` and `weaponSkillList` (or `variants` on equipment kits, as on operator kits). The only such pair in WeaponBasicTable | Pogranichnik G6 (`wpn_sword_0021_ink`, a Grand Vision skin, loses its effect) |
| D4 | **Medium to large (Lifeng); one user today.** Stat panel: a talent's (or potential's) attached skill (PotentialTalentEffectTable `attachSkill`, modifyType 1) with `castType` 1 and a `buffs` list applies those BuffData buffs' attribute modifiers (lifeType 1, no conditions) with the blackboard assigned through `assignItems` (the talent level's values after skillBbModifiers such as P3's), like a weapon's cardAttributeModifier; buffs with handlers stay kit work. A loader rule, not a unique mechanism (a scan finds no other permanent attribute buff in attached skills) | Lifeng G3, row 25 (talent 1's attributes 78 / 79: ATK +13% at P0, +19% at P5 as stats.ts reads them, or +33% / +50% if the game reads ATK%: test 75's variant); `efsim calc` doesn't even list it as missing |
| D5 | **Small** (the interim is exact). A skill's hit with its own damage type: `KitHit.damageType` allowed on skill hits as an override (the loader stops refusing it); the hit takes that type's skill bonus and `hit`-event kind while the cast stays the skill's (SP, `cast` events, team energy); kit-draft emits it when a landing's decorate mask lacks its skill's kind bit | Mi Fu G3 (World Splitter "treated as Crush DMG", mask 20480: without the interim ×1.5 in the scratch build; test 91); Lifeng's attack5 mask-0 unit is a literal-0 one (D8) |
| D6 | **Small.** Poise-only landings: `KitHit.poiseOnly: true` (with `scale: []`): the landing deals its `poise` (Stagger, nodes, `staggered` events) and nothing else (no damage, crit or `hit` event); kit-draft emits it for a DamageAction whose units are all damageAttributeType 1, or folds one at the same frame and target into that landing's `poise` (with `poiseControlledOnly` behind CheckMainCharacterCondition) | Mi Fu G5 (World Splitter's 10 Stagger 3 frames late), Tangtang G3a (18 and 10 Stagger missing per Final Strike and combo in a draft-copied kit), Ember G7d and row 8 (the guard's extra poise), Yvonne `attack5`; batch-3 E1's interrupt Stagger |
| D7 | **Medium (misleads every draft).** Compiler, conditions and control flow (new items): (a) NotNextCheckAction negates the next condition (`isConditionType` skips it: in 63 files, 28 battle skills, any emitted `if` behind one is inverted; Sundered Prince's two branches both read "controlled"); (b) jumps for conditions it can say (attack4 controlled, a Vulnerable-tag check → `enemyVulnerable: 1`); (c) landings after an InterruptCurSkillAction that only a conditional jump crosses belong to that path; (d) a DamageAction after TargetPostProcessorAction ExcludeTarget hits only other enemies: leave it out; (e) per-target hit-rate markers (CheckTimedMarkerCondition `returnTrueIfNotExists` + CreateTimedMarker) as landings at that spacing; (f) CheckBuffStackNumAdvanced with `limitSkillCastId` on a marker the branch creates = once per cast and target (or a kit `applies[].oncePerCast`, which L1 would read too); (g) the 0.1 s template timeline (TickInterval, DamageAction on the default `atk_scale` 0.3) in 12 Rossi buffs isn't run by the game: skip or note it; (h) one note per path, not per IfElse path (40 repeats); (i) factors from SimpleCalcBB actions a jump skips aren't applied | (a) Last Rite G5a; (b) Rossi G3.7; (c) Ardelia G3.2; (d) Ardelia G3.3 (as batch 3 did by hand for Arclight, Perlica); (e) Ardelia G3.1 (ultimate 82 → 11 landings); (f) Tangtang G3e, G4; (g) Rossi G3.1; (h) Tangtang G3g; (i) Rossi G3.3 |
| D8 | **Small to medium.** Compiler, SP, energy and heals (new items): (a) an ObtainCostAction before the DamageAction in the same tick is emitted as a cast trigger at the hit's frame (or a hit flag `spBeforeDamage`), so SP triggers see that hit (logs show Lustrous Carmine's ATK on the SP-granting combo hit); a HealAction after the DamageAction comes after the hit; (b) ObtainCostAction `atbOnlyMainChar` → `sp: {if: {controlled}, then}`; (c) skip literal-0 damage units and attach an ObtainCostAction once (attack5's `hit_3` doubles its 21 SP); (d) HealAction → `heals` (team finder + MainCharacterValidator → `controlled`, team, self; the heal tag gives the kind); (e) a hitless skill's SP granted in a buff it creates as a cast trigger; a second `obtain_ultimate_sp` part kept when jumps make the parts exclusive; `finishWithNextSkillIfNotInherited` energy not detached; (f) combo energy `usp × infliction_num` and the `recover_usp` fallback; (g) ObtainUspInNormalSkill → `teamEnergy` (batch-1 R3) | (a) Camille G5.1; (b) Zhuang Fangyi (data list); (c) Lifeng row 3, Mi Fu (ultimate f98); (d) Ember G7a, Camille G5.4; (e) Last Rite G5b; (f) Last Rite G5d (also its wrong "DefiniteValueCalculation" note); (g) Rossi G3.6 |
| D9 | **Small.** Compiler, hit shapes and handlers (new items): (a) a TickIntervalAction's ticks counted on unrounded time (Tangtang's dive: 4, not 5); (b) a buff on the target dealing damage every `damage_interval` → a kit buff with `every` / `tickOnApply` and a `buffTick` trigger hit (not 64-landing hits per branch), talent flags `talent_1_x > 0.5` → `talentAtLeast`; (c) event handlers (abilityEvent 302 on Final Strikes) reported as triggers to write, not skill hits at fixed frames; (d) a crit handler (abilityEvent 43) as a crit-hit trigger, not branch hits; (e) an `EntityBB_*` key the passive sets followed into a `scaleValue`; (f) combo_3's scale as `atk_scale_s + damage_add × {consumed: true}` and its else-if element chain as one `consumeInfliction`; (g) the event key of a sequence reached by ChangeSkillAction (Rossi's sequence 2 logs under combo_2's key) | (a) Tangtang G3b; (b) Rossi G3.2; (c) Last Rite G5c; (d) Rossi G3.8; (e) Tangtang G3d; (f) Rossi G3.5; (g) Rossi G3.9 |
| D10 | **Small.** Compiler, states, buffs and entities (new items): (a) ChangeSkillAction states and switchToBuffConfig with `buffs` → CastSkill followed (today "nothing compiled"), switchToBuffConfig reported; (b) an ability entity's passive (OnAddedBuff → delay damage) reached, though its attachment isn't in our tables (kit-draft already lists the key as missing); (c) a CreateBuffAction with targetSource 0 inside another buff's start event targets that buff's holder; (d) applyTags −1065936627 with an empty-curve layer-1 TimeDilation → `control immobilization` with `freezes`; (e) a P1 effect behind CheckEntityNum and CompareFloats reported, not dropped; (f) InstantModifyAttribute target side 1 formulaItem 8 → V1's `zoneScale` | (a) Camille G5.6, Mi Fu (intro), Last Rite G5e; (b) Camille G5.3; (c) Ember G7b; (d) Tangtang G3f; (e) Ember G7c; (f) Last Rite G5e |
| L1 | **Medium (tooling).** `zmdlogs reactions` maps the n-th logged landing of a key within a cast to the n-th kit landing with that key (frame order; a new cast after a gap longer than the hits' span), or tries each candidate / takes the hit `zmdlogs check` matched, so applications on later landings replay. Tangtang's alternative `applies[].oncePerCast` (D7f) is read the same way | Ember G6 (slam Knock Downs "unexpected"), Tangtang G4 (33 false Cryo bursts: the report is unusable with her), Pogranichnik G4 (his Breach; Chen's 25479 Lift falsely predicted), Camille G6 (her ultimate's one inflicting landing of 9), Rossi G11 (her battle skill's Lift) |
| L2 | **Medium (tooling).** `zmdlogs check` finds a layered buff's cap through the kit buff whose `gameBuff` it is (its source skill), the BuffData file that creates it, or the buff's literal `maxStackCnt`, not by ID prefix (batch-3 L1's follow-up) | Ember G5 (Æthertech `poisedmg_01_damagebuff`: 5 → 14 of 21), Yvonne G3a and Rossi G8 (MI Security `critsuitatk_01`: Rossi 5 → 90 matches; every MI Security wearer) |
| L3 | **Medium (tooling).** `zmdlogs check` tries what the log never lists as unlogged variants, with and without: the operator's own crit-zone buffs at their possible values (each modifier branch, layers 0 to max; ZMDLogs lists no crit entries at all), own kit buffs the log omits (an `endsWithCast` buff without `consumedBy` included), and Link stacks 0–4 on battle-skill and ultimate hits. With B1 the Link variants become the predicted Link-source stacks, tried as ±1 | Yvonne G3b (182 of 183 with a scratch patch), Rossi G9 (59 of 162 hits need these) |
| L4 | **Medium (tooling; blocks `calc` for Rossi).** `calc` and `zmdlogs check` handle hit values that read `{consumed}` / `consumedAtLeast` or an own stack (`scaleValue`, `count`, `if`): try them over their range (0–4 consumed, the stack's range) as `eventCount` 1–4 is, report the fit, and show `calc` at a stated count instead of failing | Zhuang Fangyi G8 (`conduct_cnt`: her Thunder Strikes), Rossi G10 (sequence 2; `calc` fails on any Rossi build), Yvonne G3c (the bomb as one hit) |
| L5 | **Small (tooling).** `zmdlogs reactions` holds pending bursts through the logged ultimates' time stops (UltimateTimeAction slow-downs, each cast placed from its first logged hit), as the engine does (batch-3 A5) | Last Rite G6b (explains b7b3's three late Cryo bursts around 7150–10910 ms to within 30–90 ms: Arcane's and Tangtang's time stops; needs Tangtang's kit) |
| L6 | **Small.** `zmdlogs check` judges an enemy-state `if` inside a hit's ValueExpr on the replay (as K6 does for hit `if`s), or a ValueExpr `{enemyInflictionStacks: element}` (the twin of `enemyVulnerableStacks`) makes it one hit | Last Rite G6a (the combo bonus as one hit mismatches ×6.0; the kit uses four `branch` hits) |

Already open and only referenced (no new rows; new needs or evidence
noted):

- **Batch-1 S10 (dive attacks):** Lifeng row 5, Ardelia row 5, Last Rite
  row 4, Pogranichnik row 4, Mi Fu row 6, Tangtang rows 7, 24, 28. **New
  evidence and need:** b7b3 has a dive in a real fight (Arcane's
  `plunging_attack_end` at 15374 ms ends Tangtang's stare); Tangtang's
  ultimate pays off only with one (C3, owner item 2).
- **Batch-3 T5** (a combo trigger during its cooldown): Ember, Yvonne row
  38, Pogranichnik (his own Breach), Mi Fu row 23. **New need:** Mi Fu's
  trigger may be a *state* (the window relights when the cooldown ends
  while 3+ stacks remain, and closes when a Crush consumes them): test 90.
- **Batch-3 B3** (stackingType 8's timer): Yvonne's ultimate layers (test
  62 variant); Ember adds stackingType 10 (B3 above).
- **Batch-3 P1** (a physical status that only adds Vulnerable): Lifeng U1
  (talent 2 on abilityEvent 40, not 401: a new user, test 39 variant);
  **new evidence** from 7e19 (Pogranichnik row 21): Chen's battle skill on
  an enemy without stacks gave no harass (abilityEvent 59) though points
  were left, so "no" on the receiving side.
- **Batch-3 V4 residue** (a main attribute's percentage reaching ATK):
  **new user** Mountain Bearer's All Attributes +22.4% (Camille rows 38–39;
  its trigger is T1's).
- **Batch-3 A7** (Shatter as consumption): Clannibal (Tangtang).
- **Batch-3 E1** (enemy charges, InterruptAction): Ember row 15,
  Pogranichnik rows 11, 15, Last Rite row 17. **Batch-3 S5** (dash
  attacks): Ember, Lifeng row 6, Yvonne row 7 (and her ultimate dash
  modes), Last Rite row 5 (its SkillData isn't in the checkout),
  Pogranichnik row 28.
- **Batch-3 N2** (operator HP): Ember U1 (P3's second heal target), U2 (the
  shield breaking), Farsight's heal (Pogranichnik W8), Mi Fu row 31,
  Zhuang Fangyi, Ardelia's heals. Note: under the owner's "topped up"
  rule a `CheckCurHpRatio ≥` condition holds, so the copied toggle (Opus:
  Etch Figure, Umbral Torch, Glorious Memory; Ardelia U2, Pogranichnik W3)
  is live if a missing `hp_ratio` key reads 0 (test 75 variant).
- **Batch-3 D3 / D4 open items:** ModifyDynamicBlackboard on a hit's scale
  (Ardelia G3.4, Mi Fu row 19, Rossi's P5 SimpleCalcBB), Switch-chosen SP
  (Pogranichnik row 6), spawned entities as a stack (Tangtang G3c, Zhuang
  Fangyi's Sunderblades), talents' attached buffs and triggers (Lifeng
  rows 21, 26; Pogranichnik rows 22–25; Mi Fu; Yvonne), a key only the
  potentials set → `potentialAtLeast` (Ardelia G3.4), identical IfElse
  sides (Rossi G3.4, Mi Fu's finisher), ForceSpellStatusAction
  `consumedType` (Yvonne row 39). The batch-3 review's "a stack compared
  with a value" (Lifeng row 8: literal thresholds behind
  `potentialAtLeast`, exact).
- **Batch-3 B2 residue** (layered type-11 buffs across wielders): Zhuang
  Fangyi J4, Thermite Cutter and Never Rest (Rossi W3, W7), Long Heritage
  (Mi Fu E10). **Batch-3 B1's interim at the limit:** Last Rite rows 28,
  E2, Mi Fu E5.
- **Ti1b** (hit-stop; entity-layer slow-downs): Ember row 31, Last Rite
  rows 15, 23 (her combo freezes the enemy 2 s; b7b3 suggests pending
  bursts aren't held), Mi Fu row 16, Zhuang Fangyi row 49, Pogranichnik row
  20, Tangtang row 34. **Ti2** (projectile travel): Ardelia rows 17, 20,
  Tangtang (the combo's projectile), Camille (test 47).
- **Batch-2 items:** TakeDownAction (Catcher row 15): Pogranichnik row 19;
  K6 (enemy-side auras in the checker): used by Pogranichnik's 7e19 fits.
- **Existing tests' questions:** 35 (a reaction-forming infliction: Lifeng
  W2, Last Rite E5, Tangtang, Pogranichnik W7, Zhuang Fangyi J3, Camille
  U4), 38 (two sources of one Susceptibility or Amp: Lifeng row 10,
  Ardelia, Tangtang, Mi Fu, Camille, Zhuang Fangyi), 51 (an effect on its
  own hit: Ardelia W11; abfd answers "yes" for Navigator on Yvonne's bomb,
  40d9 / 4e5e for Lustrous Carmine's abilityEvent-126 handler), 66 (a
  forced reaction over a stronger one: Yvonne row 37, Zhuang Fangyi row
  25), 18 (time stops: Camille's delayed explosions fit it), 19 (Haste:
  Last Rite's frame spacing in b7b3), 29 (sub-skills as battle-skill
  casts: Mi Fu row 37), 61 (Rossi's battle skill without Vulnerable).

### Owner decisions needed

1. **Link (B1): engine-wide, evidence-based.** The engine gives every combo
   cast a 15 s Link stack. The data has ComboAction (the Link grant) in
   three SkillData files only: Lifeng's combo (count 1, 20 s) and
   Camille's combo and Hunter Pursuit (in her talent-1 branch, 15 s);
   Lifeng's description says the combo "grants Link", which would be
   redundant otherwise. Logs, all consistent with "only ComboAction (and
   Akekuri's talent buff) gives Link" and not with the engine:
   - 40d9 12951 ms: Gilberta's ultimate ×1.20 (one stack) after Camille's
     combo, whose talent-1 branch ran (built-in + ComboAction would be two,
     ×1.30);
   - b7b3 7150 ms: Arcane's ultimate 2.0 s after Tangtang's and her own
     combos: no Link (13 of 13 match without it); abfd 28304, 85643,
     61958 ms: Si's ultimate after her own combo, Si's battle skill after
     Xaihi's, Fluorite's ultimate after Xaihi's and her own: no Link;
   - 4e5e (checked at the merge from the fixture's hit times, with Rossi's
     G9 fits): Rossi's battle skill at 10016 ms after three combos
     (Camille's at 7077, which exploded at 8325; Estella's 7174;
     Gilberta's 7598) fits **one** stack (engine: three); her ultimate at
     61167 ms after six combos (Camille's at 54978 and Hunter Pursuit at
     57424, both exploding; Estella's, Gilberta's and three of Rossi's
     own) fits **two** (engine: four).
   Impact: the engine overstates every battle skill (×1.30–1.75) and
   ultimate (×1.20–1.50) cast within 15 s of an ordinary combo, and
   searches favour combo → battle-skill orders for every team.
   **Recommendation:** adopt B1 now, without waiting for the test; run
   the Link test (test 8's variant, first below) as confirmation; reword
   test 8's set-up ("after one teammate's combo" needs a Link source),
   test 29's Link part and data-sources.md's Link paragraph; test 57
   (Akekuri) is unaffected.
2. **Dive attacks (batch-1 S10, open since batch 1).** Tangtang's ultimate
   (C3, Tangtang G1) is built around a controlled operator's dive: the
   early wave is 8.05 instead of 4.6 × ATK (+75%; her largest logged hit)
   and talent 2 adds 12–36 Waterspout ticks, and b7b3 shows a player
   diving for it. Scheduling dives needs an airborne state and makes every
   operator's dive attack a rotation step. Do you dive in your rotations
   (with Tangtang or otherwise)? If yes, S10 and C3's dive filter come
   into this batch; if not, S10 stays deferred and Tangtang's kit plays
   without dives (her log check stays exact through the kit's interim
   state).
3. **Short timing inputs (S3; small but a search policy).** Rossi's
   sequence 2 has a perfect-timing ring (about half a second) that adds a
   Vulnerable stack. Should searches assume the player always hits such
   rings, or try both and report which was used? Recommendation: try both
   (a missed ring is a legal rotation), default to the perfect path when
   the scenario says "perfect inputs".

Smaller deferrals proposed by the merge (no owner decision needed under
kit-process "Deferring"): B7 (Zhuang Fangyi's held state: up to 35
frames per ultimate), B8 (Sunderblades' 3 s floor: one strike in an edge
case), V3 (kit size only).

### Weapon owners

Equipment stays generic (written relative to the wielder; kit-process
"Equipment is generic"): a reassignment only changes which kit agent
writes and tests the kit, and with which wielder its scenarios and log
checks run. The drafts in the reports' scratch copies go to the new
writer.

| Weapon | Proposal (report) | Writes it in the kit phase |
|---|---|---|
| wpn_sword_0022 Lupine Scarlet | Rossi wears it in 4e5e; it keys on crits and Physical + Heat DMG, her elements (Rossi W9; Pogranichnik W6 verified its layers on her hits) | **Rossi** (moved from Pogranichnik) |
| wpn_sword_0012 Thermite Cutter, wpn_sword_0016 Never Rest | Both want natural skill SP, which Rossi never triggers (Rossi W3, W7); Pogranichnik wears Thermite Cutter in 7e19 and his report settled its 9 listings vs the cap of 2 | **Pogranichnik** (moved from Rossi; proposed by the merge from both reports) |
| wpn_sword_0021 Grand Vision (+ `_ink` skin) | The Endministrator's signature (only her kit applies Originium Crystals; the Solidification half works for anyone; Pogranichnik W4); `_ink` is the same weapon (D3) | Pogranichnik (her kit exists, batch 2; verified on 7e19 with her) |
| wpn_claym_0019 Long Heritage | Fits Si (Cryo / Heat battle-skill inflictions, team Cryo and Heat Amp); nothing fires on Mi Fu (Mi Fu E12) | Mi Fu (Si's kit exists, batch 1); scenarios with Si; test 92 |
| wpn_lance_0012 Mountain Bearer | Plainly Lifeng's (Lifeng's battle skill Knocks Down and applies Physical Susceptibility; Camille row 44) | **Lifeng** (moved from Camille) |
| wpn_lance_0007 Beacon of Duty | Needs Heat Inflictions and Heat Susceptibility: Camille is the only Heat polearm (Lifeng's signature note) | **Camille** (moved from Lifeng; proposed by the merge: a swap with Mountain Bearer) |
| wpn_lance_0011 JET, wpn_lance_0009 Opero 77 | JET fits an Arts polearm (Liino, Avywenna, Camille); Opero 77 is Lifeng's default weapon. Lifeng's own best fit is Valiant (batch 1): Lifeng's ultimate hits must not list `chr_0015_lifeng_ultimate_skill` as a key (it's Valiant's logged name) | Lifeng |
| wpn_lance_0016 Golden Age, wpn_lance_0015 Lustrous Carmine | Golden Age fits an Electric healer such as Liino (kit exists); Lustrous Carmine is Camille's (both her logs) | Camille |
| wpn_funnel_0018 Junction Point, wpn_funnel_0020 Suffering's End | Nature lines and Nature-team triggers: a Nature arts unit's (Zhuang Fangyi's note); Ardelia triggers neither (her battle skill inflicts nothing, she never bursts), so moving them wouldn't help; natural wielders Gilberta, Arcane, Typhoeus (kits exist) | Zhuang Fangyi (drafts exist); scenarios with a Nature wielder |
| wpn_funnel_0006 Opus: Etch Figure, wpn_funnel_0010 Chivalric Virtues | Opus fits a Will-main Nature operator whose battle skill inflicts Nature (Gilberta); Chivalric Virtues a healer with tagged skill heals (Xaihi); neither fires on Ardelia (Ardelia W2, W9) | Ardelia; scenarios with Gilberta / Xaihi |
| wpn_claym_0016 Phantom Pain | A Physical weapon; suits Mi Fu, Da Pan or Catcher, not Last Rite (Last Rite's note; "none needs moving") | Last Rite (draft exists); scenarios with Mi Fu |
| all others | Signature or generic, no move proposed: Ember's three (Exemplar is on her in 7e19), Yvonne's three, Brigand's Calling (Tangtang's signature) and her other two, Khravengger (Last Rite in b7b3), Sundered Prince, Rapid Ascent, Eminent Repute (Crush / Breach: fits Pogranichnik or the Endministrator), White Night Nova, Glorious Memory, Complexed Industry, Farsight, Lone Barge (Zhuang Fangyi's), Flickers in the Mist, Dreams of the Starry Beach (Ardelia's signature), Detonation Unit, Oblivion, Amaranthine Tassel (Mi Fu's) | as in the table above |

### Unknowns settled by in-game tests

Proposed tests, merged and deduplicated, checked against the rules in
[in-game-tests.md](../in-game-tests.md) (by eye, stopwatch differences of
2 s or more, relative comparisons; no frames or SP numbers). **Written to
in-game-tests.md (2026-10-21):** the numbers below are final (77–96 kept
as proposed, since kits and tests cite them); "part of test N" is an
optional part of an existing test. The written tests use the kits'
current behaviour, which changed some predictions here: with B1 a combo
gives no Link (Ardelia's test 51 part recomputed: A/B ≈ 1.00 / 0.78 /
0.83 / 0.65), V2 keeps Combustion's ATK (test 77's engine side is now
"unchanged"), C4 runs Last Rite's battle skill beside her attack (test 82:
the engine says "same time"), B6 gives each member's perfusion one use
(test 83), S2, S4, S5 and T2 are in (tests 86, 88, 93), and calc now
includes Lifeng's talent 1 (test 75's part: panel = calc, or ×1.17 /
×1.25).
Priority: **high** affects many operators or a favourite (Typhoeus,
Arcane, Si, Gilberta, Liino, Estella, Laevatain); **medium** needs a
6-star of this batch; **low** is tedious, needs Ember (the owner doesn't
use her), or matters little.

| Test (reports) | Needs | Settles | Priority / existing |
|---|---|---|---|
| **Where Link comes from** (Lifeng L-A, Camille 2): Gilberta's ultimate on a dummy (a) with no combo in the last 20 s, (b) right after Estella's combo (anyone but Camille or Lifeng), (c) right after Camille's combo on a dummy with hovering Vesperwings (her battle skill first, talent 1 learned), (d) right after Camille's combo without them; optionally (e) right after Lifeng's. Lower of two numbers each (crits). Data and logs: a = b = d, c = e = 1.20 × a; engine today: b = d = 1.20 × a, c = 1.30 × a | Gilberta, Estella; Camille or Lifeng for (c)–(e) | B1 for every team; Camille's talent-1 condition | **high**; variant of test 8 → test 8 (rewritten 2026-10-20, options (c)–(f)) |
| **Combustion ticks and a later ATK buff** (Rossi R4; Camille U5): note a Combustion tick's number, then let a team ATK buff start mid-burn (e.g. Liino's Vocalist Stance) and compare the next ticks: unchanged (snapshot at application: the data's flag) or up by the buff's ATK share (engine). Use a buff of 10% ATK or more: smaller ones are lost in the numbers (Camille's 4–6% case isn't testable by hand) | any Combustion (Laevatain, Wulfgard) and a team ATK buff | V2's ATK part (Rossi's bleed is the same question) | **high** (every Heat team) → test 77 |
| **The copied toggle and talent 1 in the stat panel** (Ardelia U2, Pogranichnik W3, Lifeng L-E): stat-panel ATK against `efsim calc` for the same build: Laevatain with Umbral Torch (or anyone with Opus: Etch Figure or Glorious Memory): ATK% 0.196 higher than calc (L9) means the copied `buff_wpn_lance_0003` toggle is live; Lifeng: about 1.13× calc at P0 / 1.19× at P5 (talent 1 as attribute bonus) or 1.33× / 1.50× (ATK%) for the Opero 77 build | Laevatain with Umbral Torch; Lifeng for the second part | the toggle (B2's "a missing key reads 0"; Chen's 7e19 drift lead); D4's reading | **high** for the toggle (Laevatain), medium for Lifeng → part of test 75 |
| **Lifeng's Link hit and Link's length** (L-B, L-C): Lifeng's ultimate with no combo before it (2 big numbers) vs right after Lifeng's own combo (3), and after only Estella's combo (2 data, 3 engine); then the combo and the ultimate 17–18 s later with nothing between: a third hit means 20 s, none 15 s | Lifeng | C1, B1 on her, Lifeng U2 | medium → test 78 |
| **Lifeng's talent 2 on a Vulnerable-only Knock Down** (L-D): battle skill on a fresh dummy: an extra small Physical number at the slam or none (engine); a second battle skill shows one either way | Lifeng | batch-3 P1 for abilityEvent 40 (Lifeng U1) | medium → part of test 39 |
| **Layers on one timer, Ember and Yvonne** (Ember G3, Yvonne Y3): Ember (talent 2 level 2) hit once, then about 4 s later, then no hits: both layers gone at about 7 s, gone at about 11 s (engine's interim), or down to 1 at 7 s and gone at 11 s. Yvonne: during her ultimate keep attacking: the layer counter stays at 10 (engine) or drops about 4 s after the first shot | Ember; Yvonne | B3 (stackingType 10), batch-3 B3 | low (Ember) / medium (Yvonne) → part of test 62 |
| **A perfectly dodged hit as "attacked", Ember's form** (Ember U3): Ember's combo off cooldown, another operator controlled: let a hit land (combo lights), then perfectly dodge the next: lit or not (engine) | Ember | test 53's question | low → part of test 53 (its cleanest form: no HP condition) |
| **Yvonne's talent-1 Final Strike** (Y1): after her bomb Solidifies, wait about 3 s, press basic attack once: one big shot (2.4–3.5× attack 1) and her combo lights (engine: the mapping lasts the buff) or a small attack 1 and the combo stays dark (0.5 s cache); pressing at once is the control | Yvonne with a Cryo or Nature teammate | S8's mapping length (Yvonne row 30) | medium → test 79 |
| **Home Longing: the next battle skill or every one** (Y2): combo, two battle skills within 10 s, a third more than 20 s after the combo; non-crit numbers: first two equal and ~15% above the third (data) or only the first above (description) | Home Longing on a Cryo or Nature caster | Yvonne W6 | medium → test 80 |
| **An effect on its own hit, Ardelia's form** (Ardelia 1): Final Strike, her combo, wait ~3 s, battle skill A (consumes Corrosion, Link if B1 gives one), within 25 s battle skill B; A/B ≈ 1.30 (both act on A: engine), 1.02, 1.08 or 0.85 per reading (the report's table; recompute A's Link factor under B1) | Ardelia with Dreams of the Starry Beach | test 51's question for W11 and her Susceptibility | medium → part of test 51 |
| **Hypothermia on a reaction** (Last Rite A): a Heat (Electric, Nature) teammate inflicts and stays controlled; Last Rite's battle skill off-field; the teammate's Final Strike brings a Mirage whose Cryo forms a reaction: Cryo Susceptibility icon on the dummy (engine) or not | Last Rite with talent 1 | A1; OBJ Velocitous W7 | medium → test 81 |
| **Last Rite's battle skill inside her chain** (Last Rite B): stopwatch from the first basic attack to the third Final Strike: three plain chains, then three with the battle skill pressed during attack 2 of the first two: same time (data) or about 2.2 s longer (engine, ~1.1 s per cast; just above the 2 s floor: a phone video is safer, or a third cast if the SP bar allows); also: does attack 2's second hit still show its number (test 16's question) | Last Rite | C4 | medium → test 82 |
| **Mirages after a swap** (Last Rite C): X controlled, her battle skill off-field, swap to Y and finish Y's chain (Mirages?), back to X and finish within 15 s (again?): both (data), only the first (engine interim), or only X's (controlled operator only) | Last Rite | B6 | medium → test 83 |
| **Enemy timers under Last Rite's freeze and Tangtang's Immobilization** (Last Rite D, Tangtang 1): (a) a debuff icon of 10 s or more on a dummy, then 3 Cryo stacks and Last Rite's combo within it: about 2 s longer than without (freeze holds enemy timers) or unchanged (engine); (b) Tangtang's battle skill after one combo (Arts Susceptibility icon, 15 s): alone it goes at ~15 s; with her ultimate right after: ~21–22 s (engine: time stop + 4 s Immobilization), ~17–18 s (Immobilization doesn't stop timers), 15 s (neither) | Last Rite; Tangtang | Ti1b's enemy-layer freezes; Tangtang U3; informs test 37's Si part | medium → part of test 37 |
| **Tangtang's own Haste** (Tangtang 2): combo, stand her in her Whirlpool: Haste icon on her? then on a teammate standing in it? Engine: both | Tangtang with talent 1 | Tangtang U2 | medium → test 84 (with test 19 for what Haste does) |
| **Rapid Ascent against a Staggered enemy** (R1): basic attack 1 before and during a Stagger, non-crit numbers: ×1.3 (the Stagger's own DMG Taken: the description) or about ×2.2–2.6 (the data: the 98% on every hit) | Rapid Ascent on any sword user | Rossi W2 | medium (6-star weapon; the report said low) → test 85 |
| **Rossi's combo cooldown and perfect timing** (R2, R3): (a) sequence 1 then sequence 2 at once vs (b) sequence 1 only: stopwatch to the combo's cooldown end, about 15 s vs 21 s (engine without S2: 14 s); (c) on an enemy with one Vulnerable stack and an infliction, sequence 2 inside the ring vs a second later: the counter rises by 2 or 1 | Rossi | S2, S3's premise (Rossi row 23, G4) | medium → test 86 |
| **Zhuang Fangyi's Sunderblades** (A, B): four battle skills about 5 s apart, count the Thunder Strikes per cast: 1, 2, 3, 3 (engine; P1+ 2, 3, 3, 3) or 0, 1, 2, 3 (new blades not ready); casts at 0, 10, 20 and 50 s: 2 strikes on the last (own 36 s timers: engine) or 3 (shared refreshed timer); at P3 the fourth at 60 s | Zhuang Fangyi | her U1, row 11 | medium → test 87 |
| **The Empyrean state** (Zhuang Fangyi C, D, E): (c) empty SP, ultimate, battle skill at once: castable with 3 Sunderblades (data) or a ~12 s wait (engine today); (d) in the state, battle skill, chain, combo, then again: combo ready about 4 s after the first (data) or 17 s (engine); (e) swap out 5 s into the state and back 3 s later: Empyrean still on or gone | Zhuang Fangyi | S5, S4, her U3 | medium → test 88 |
| **Zhuang Fangyi's talent-1 growth** (F): in one cast with 9 Sunderblades, the first vs the eighth small strike (non-crit): ~1.12× (cumulative: engine) or equal | Zhuang Fangyi, talent 1 level 2+ | her U5 | medium (needs nine blades) → test 89 |
| **Mi Fu's combo trigger as a state** (Mi Fu A): (1) 3 Vulnerable stacks, her combo at once, then no new stacks or Crush: does the button relight about 17 s later (state) or stay dark (engine)? (2) 3+ stacks, combo lit, not cast; Cloudtrapper then Trail and Mangle (its Crush consumes the stacks): dark at the Crush (state) or lit until ~6 s after it lit (engine) | Mi Fu at P1+, a teammate adding Vulnerable without Crush / Breach | batch-3 T5's state reading for Mi Fu | medium → test 90 (related to tests 60 and 64) |
| **World Splitter's damage type** (Mi Fu B): 3 Vulnerable stacks from a teammate, no Susceptibility; Cloudtrapper, Trail and Mangle, World Splitter; compare World Splitter's number with Cloudtrapper's (lower of two each): 4.0 / (1 + b) (data: no Battle Skill DMG bonus), 4.0 (it takes the bonus), anything else: `yuanshi_multi` isn't 1 | Mi Fu with a Battle Skill DMG source, without Amaranthine Tassel, Grizzled Edge, Ancient Canal | D5's reading, Mi Fu row 19 | medium → test 91 |
| **Long Heritage and Si's Amp** (Mi Fu C): Si's ultimate (team Cryo and Heat Amp) with Long Heritage: does the team Arts DMG buff appear on a teammate (engine) or not (only all-Arts Amps count) | Si with Long Heritage | Mi Fu E11; T1's CheckBuffIdInContext checkType reading (also Grand Vision, Glorious Memory) | medium (Si, but needs the weapon) → test 92 |
| **Camille's talent 2 from a teammate's heal** (Camille 1): her combo not cast; Liino's battle skill (soundwaves every 3 s): Camille's Heat DMG icon appears and reaches 5 within ~6 s (data) or stays absent until her own combo (engine) | Camille and Liino (or another skill healer) | T2, Camille U1 | medium → test 93 |
| **Thermite Cutter's Link part** (R5): after a Link source's combo (Camille's on hovering Vesperwings, Lifeng's; with B1 an ordinary teammate's combo gives no Link), does the wielder get the team ATK icon? | Thermite Cutter and a Link source | Rossi W4 | low → test 94 (after the Link test) |
| **A third Whirlpool** (Tangtang 3): three combos ~10 s apart without a battle skill: 2 or 3 Whirlpools; then the battle skill: does the SP bar jump (refund)? | Tangtang at P1, teammates' combo triggers | Tangtang U1 | low (tedious) → test 95 |
| **Wooly Party hits on one enemy** (Ardelia 4): video her ultimate below P3 on a large dummy, count its numbers: 10–11 (the cap: engine) or clearly fewer | Ardelia | Ardelia U1 | low (tedious; a log settles it better) → test 96 |
| **Sub-skills as battle skills, Mi Fu's form** (Mi Fu row 37): with Link up, Trail and Mangle: is Link used up? | Mi Fu, a Link source | test 29's question | low (optional) → part of test 29 |
| **Attack 4 cut early** (Ardelia's § Kit, after the merge): her battle skill pressed as attack 4 starts: does Mr. Dolly's Final Strike number still appear, and does her combo light? Kit: neither (the Dolly is removed with the attack) | Ardelia | Ardelia row 3's `detached: false` | medium → part of test 16 |

Dropped as not testable by hand (logs settle them): Zhuang Fangyi U4
(×4 vs ×5: 4.25 vs 3.4 s, under 2 s) and U2 (strike frames); Yvonne row 26
(same-frame order of the end strike); Rossi row 15 (one 0.3 × ATK tick);
Pogranichnik rows 17 (rare) and 20 (sub-second follow-up timing); Mi Fu
G1, rows 9, 16, 20 (3–10 frames); Camille U5's DMG-bonus part (4–6% on
DoT numbers); Ardelia U3 (frames 23–40); Lifeng U4 and Last Rite row 14
(log keys, whose stats); Ember U2 (shield points against a boss); Ti2
(test 47); Rossi's bleed ticking at its own end (25 or 26 small numbers
over 25 s; 4e5e says 26: Rossi § Kit). Pogranichnik needs no new test
(tests 75, 61, 39, 35, 60 cover him).

### Log fixture notes

Notes the reports propose; fixtures are not edited here (each goes in with
the kit that needs it).

- `fixtures/zmdlogs-4e5e1390085e.json` (Rossi, Camille): the hand
  annotation's "Rossi ×1.0735 with his 5% crit-set ATK" assumes one MI
  Security layer (five give ×1.064), and Rossi is "her" in the game's
  text; `buff_wpn_lance_0015_dmgup` (Heat +9.6%) also drops out of the log
  from 65597 ms while the damage stays, like the annotated `atkup` at
  49418 (Rossi L-f); at maximum Lupine Scarlet layers the log lists one
  layer fewer than the damage used (Rossi L-g); Rossi's finisher hit 3
  is the killing blow (`uncapped` 261745 is ×1.051 the plan: the log's
  overkill estimate); Camille's three Combustion ticks (66004–68449 ms)
  fit only with the buffs at the reaction (Camille U5); the Link fits
  (one stack at 10016 ms, two at 61167 ms) are owner item 1's evidence.
- `fixtures/pending/zmdlogs-abfd4b7478ec.json` (Yvonne): t=116720
  `ult_attack2_projhit` (1626 vs 1868 non-crit, ×0.870) is the fight's
  last hit, the killing blow, capped by the enemy's HP and logged without
  `uncapped`: mark it as the kill. Her build needs no correction; the
  bombs show Navigator's doubled buff acting on the hit that Solidifies
  (test 51's question).
- `fixtures/zmdlogs-b7b3762d5da8.json` (Last Rite, Tangtang): the three
  late Cryo bursts around 7150 ms are Arcane's and Tangtang's ultimate
  time stops (L5; closes the batch-1 / batch-2 K6 / batch-3 L2 question);
  Arcane's dive at 15374 ms ends Tangtang's stare (owner item 2); Last
  Rite's third ultimate slash (f134) is missing though the fight goes on
  (unexplained); her frame spacing is faster than 30 FPS (Si's Haste, test
  19); Tangtang's last Riot Bringer Waterspout is HP-capped (its
  `uncapped` 14,194 is right). `tests/logs.test.ts` needs V1 with her kit.
- `fixtures/pending/zmdlogs-7e19489ae503.json` (Ember, Pogranichnik):
  ZMDLogs lists `buff_wpn_sword_0012_atk_up` once per application (9 by
  28292 ms) while the game counts 2 (the checker already caps it), so the
  listings don't explain Chen's ×0.959; her 25479 ms Lift only adds a
  stack (no airborne hit); Ember's t=21935 and 23570 hits are +0.16
  Physical DMG short (Æthertech layers the log doesn't list, or an
  unlogged Vulnerable application); something after about 33 s
  multiplies several operators' hits ×4–18 (Ember's finisher 323,160,
  Chen's ultimate, the Endministrator's Crush), unexplained; the copied
  Glorious Memory toggle is a lead for Chen's ATK drift (test 75).
- `fixtures/zmdlogs-40d9a3c1da37.json` (Camille): Laevatain's 7550 ms
  Heat burst is explained once Camille's battle skill inflicts
  (reactions 3 / 0 / 0 with her kit).
