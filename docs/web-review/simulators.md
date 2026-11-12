# Simulators in reference/: engine comparison

Three sources, reported separately: **ZS-** Zero Sanity (`reference/zero-sanity-timeline`, MIT, commit c44d46cc, 2026-05-10); **EA-** Endaxis (`reference/Endaxis`, no licence, read only, commit fbf6a292, 2026-10-18); **DP-** End-DPScope (`reference/End-DPScope`, commit d6027464, 2026-09-20). Read locally with no network, 2026-11-12. The engine side is `docs/engine-rules.md` (rule ids D, C, R, A, P, S, T, K, B, E, N).

Overlap: `End-DPScope/research/终末地数据机制导论.md` is the 666bj primer, the same text as site 2 in the web review, so DP claims from it are not independent of that report. `End-DPScope/vendor/endaxis` is a copy of Endaxis; EA claims are not counted twice. The DP folder `research/新乘区导论（伤害篇）.md` is by MoeYinlo (bilibili).

## Pages read

- **ZS:** `src/model/calculation/calculationSpec.md`; `src/model/game-data/gameMechanicsSpec.md`; `.claude/skills/damage-formula/SKILL.md`; `src/model/eventSpec.md` (Electrification, Corrosion, Combustion, combo window, time stops, physical statuses); `src/controller/timeline/engineSpec.md` (time-stop handling); `src/model/game-data/generic/statuses/status-{lift,knock-down,crush,breach,vulnerable,link,solidification,electrification,corrosion,combustion,shatter,stagger-node,stagger-full}.json` (durations, stacks, stat values); `docs/notes/expected-crit-calculation.md`; `docs/notes/operators/{alesh,da-pan}.md`; `docs/questions.md`; `public/limitations.md`; `public/devlog.md` and `docs/devlog.md` (searched); `src/tests/combatTestingSpec.md`; `src/model/game-data/operatorDataSpec.md` (timeDependency).
- **EA:** `docs/architecture/combat.md`; `docs/architecture/buff-stacking.md`; one number from `src/ui/timeline/results/TimelineHitDetailDialog.test.ts` (searched).
- **DP:** `功能说明.md`; `使用指南.md`; `维护日志.md` (searched); `research/终末地数据机制导论.md` (sections 1.1–1.15, 2.1–2.6, 3.1–3.5, 4.5–4.6); `research/新乘区导论（伤害篇）.md` (zones, calculation flow, crit RNG).

## Basis in general

- **ZS:** damage test expectations are described as "observed from the actual game" (`combatTestingSpec.md`). The effective-ATK rounding was fitted to in-game-observed Laevatain values (37 full-loadout and 19 bare cases). The status files are marked as reconciled with data and wiki; no test is cited for their durations. Devlog entries run to 2026-04-11.
- **EA:** design docs. They say the rules come from native game tables and tests, but give no test numbers.
- **DP:** the 666bj primer describes its author's full-test observations and public-version (1.0) tables, updated to 2026-02-28. The MoeYinlo primer is based on game data and code, with no test cited. `功能说明.md` says its Yvonne crit numbers were verified "in the engine" (its own Endaxis-based engine), not in game.
- The engine follows game 1.6 data. Every source here predates 1.6 by an unknown amount.

---

## ZS: Zero Sanity

### ZS-1. D20, D21 (level multipliers): hidden-level formula as written
- **Engine:** physical-status hits × (1 + (Lv − 1)/392), so 1.2270 at Lv 90 (D21). Arts burst, reaction and Shatter × (1 + (Lv − 1)/196), so 1.4541 at Lv 90 (D20).
- **Source:** `.claude/skills/damage-formula/SKILL.md`, "Hidden Level Multipliers": physical = 1 + (Lv − 139)/2, arts = 1 + (Lv − 119)/6, with the note that these equal 1 at the baseline levels. At Lv 90 these give −23.5 and −3.83, so the formula as written cannot be used. The code may differ from the doc.
- **Basis:** unstated for ZS. DP (666bj primer, section 2.3) and EA (a test expects 1 + 89/196) agree with the engine.
- **Impact if the source is right:** none that makes sense at Lv 90. If the code uses the doc's formula, every status and arts hit is wrong by a large factor.
- **How we could test:** read ZS's code (`damage` calculation for the hidden multiplier) to see which formula it uses. If it uses 1/392 and 1/196, this is a doc error only.

### ZS-2. A7, A8 (reaction level): cap of 2 for automatic reactions
- **Engine:** reaction level = consumed infliction stacks, 1 to 4. Initial hit 80% + 80% × level, so up to 4.0 ATK at 4 stacks (A7, A8). Corrosion start shred 3.6 to 7.2 by level (A29).
- **Source:** `calculationSpec.md`, "Status Level": StatusLevel = min(ActiveOtherElementInflictionCount, 2), capped at 2 for auto-derived reactions. Example: "4 Heat + 1 Nature → Corrosion Lv.2 (capped)". The ZS status data files allow level 4 (for example `status-combustion.json`, level max 4).
- **Basis:** the example table is called "Verified Examples" with no test named. DP (666bj primer 2.1): reaction level goes up to 4, and their tests show it.
- **Impact if the source is right:** reactions from 3 or 4 stacks are underpowered by up to 40% on the initial hit (2.4 instead of 4.0 ATK). Corrosion caps at 16 instead of 24 shred. Affects every reaction with 3+ stacks.
- **How we could test:** logs of reactions that consumed 3 or 4 stacks (ZMDLogs or our own). Compare the initial hit with 80% + 80% × level, and check the Corrosion shred cap.

### ZS-3. P4, P5, P7 (Lift, Knock Down, Crush): status duration 1 s
- **Engine:** Lift status 3 s (P4). Knock Down status 10 s (P5). Crush status 3 s (P7).
- **Source:** `status-lift.json`, `status-knock-down.json`, `status-crush.json`: duration 1 s each, stacks RESET. `SKILL.md` also says "Lift (1s RESET)" and "Knock Down (1s RESET)". The per-skill `duration 1.8s` for Da Pan's Lift (`docs/notes/operators/da-pan.md`) suggests the skill can set its own value.
- **Basis:** data (status files marked RECONCILED); no test cited. DP (666bj primer 2.2) gives no duration for these statuses, so there is no second source.
- **Impact if the source is right:** Lift, Knock Down and Crush would expire 2 s (Lift, Crush) or 9 s (Knock Down) before the engine's end. Any later physical status that relies on the first one still being active would change.
- **How we could test:** a log of a Lift or Knock Down followed by a second physical status. Check whether a second status is still active 1 s to 3 s later.

### ZS-4. S9 (Stagger duration): fixed 5 s
- **Engine:** Stagger duration = enemy attribute 21 × attribute 31 seconds, 6 to 24 s by enemy, default 10 (S9).
- **Source:** `status-stagger-full.json` and `status-stagger-node.json`: 5 s each.
- **Basis:** data; no test cited. DP (666bj section 3.2) says most enemies have 6 or 9 s and some have 11 or 24 s, which agrees with the engine. ZS's 5 s does not agree with DP.
- **Impact if the source is right:** every Stagger window is 1 s to 19 s shorter than the engine's, which changes the ×1.3 uptime and Finisher timing.
- **How we could test:** in-game Stagger windows on known enemies (for example a boss at 11 s or 24 s, the number in DP's table). Also ZMDLogs stagger events.

### ZS-5. P1 (Vulnerable): each stack has its own timer
- **Engine:** Vulnerable max 4 stacks, 20 s. All stacks share one timer; each new stack sets the shared end to max(current end, now + 20 s) (P1).
- **Source:** `status-vulnerable.json`: max 4, 20 s, interaction REFRESH. `gameMechanicsSpec.md`: REFRESH ends the stack that expires earliest and starts a new stack with the full duration, so stacks expire one by one.
- **Basis:** data; no test cited. DP says nothing about Vulnerable (破防) duration.
- **Impact if the source is right:** after a gap of more than 0 s, the engine keeps all stacks alive longer than ZS. Crush, Breach and Lift damage (which scale with stacks) would be higher in the engine.
- **How we could test:** a log with two Vulnerable applications 10 s apart, then a Crush at 25 s. Check the stack count the game uses.

### ZS-6. A36 (Solidification duration): 6, 7, 8, 9 s
- **Engine:** 5.75 / 6.75 / 7.75 / 8.75 s by level, flagged [OPEN] (A36).
- **Source:** `status-solidification.json`: VARY_BY level [6, 7, 8, 9] s, MERGE. The engine notes already say "native settings say 6–9 s".
- **Basis:** data; no test cited. DP (666bj section 2.1) says the same 6/7/8/9 s, which is a second source.
- **Impact if the source is right:** each level is 0.25 s longer than the engine, a 4% change in the freeze window.
- **How we could test:** the in-game freeze duration on one enemy at level 1 (a stopwatch or a log with the start and end frames).

### ZS-7. K31 (Link duration): 20 s
- **Engine:** Link lasts 15 s (K31, [SETTLED]).
- **Source:** `status-link.json`: duration 20 s, max 4 stacks, REFRESH.
- **Basis:** data; no test cited. DP gives no Link duration.
- **Impact if the source is right:** a Link that is 15 to 20 s old is still active in ZS but has expired in the engine. A battle skill cast in that window misses the Link bonus in the engine.
- **How we could test:** a log where a Link is applied and then a battle skill is cast 16 to 19 s later. Check whether the bonus still applies.

### ZS-8. D8, D11 (effective ATK rounding): ATK rounded before the multipliers
- **Engine:** no rounding of ATK. Panel values stay in doubles, attributes are floored (D10). Only the final hit is rounded (D2).
- **Source:** `calculationSpec.md`, "Effective Attack": EffectiveATK = ceil(RawEffATK) if its fraction is ≥ 0.7, else floor. Its "Rounding Experiments" say no rounding over-shoots by +2 to +8 on 37 full-loadout tests, and the threshold rule matches all 37. The bare-loadout failures (−1) are not explained.
- **Basis:** in-game test (37 full and 19 bare Laevatain values, ZS's expected values from the game).
- **Impact if the source is right:** every hit whose ATK has a fractional part changes by up to ±1 ATK, and the +2 to +8 overshoot in ZS's tests is bigger than a ±1 rounding would give. Affects every hit that the engine computes from ATK.
- **How we could test:** run the Laevatain loadouts from ZS's test file through our engine and compare the ATK value and final damage. Also check the ZS note's +2 to +8 overshoot case: it may come from some other term.

### ZS-9. R5 (resistance floor): ZS's two docs disagree
- **Engine:** no floor. Shredded resistance below 0 makes the factor above 1 (R5). Laevatain's Scorching Heart (ignore 10 to 20 heat resistance) can drive it negative.
- **Source:** `calculationSpec.md`: Resistance = max(0, EnemyResistance − ResistanceReduction). `SKILL.md`, section 12: the Scorching Heart case "can go negative (e.g., 0 resistance + 20 ignored = effectively −20, dealing 20% MORE damage)". DP (666bj, 1.12) and the engine agree with no floor.
- **Basis:** unstated for the calc floor. The SKILL example is not dated.
- **Impact if the source is right:** Laevatain heat hits against 0-resistance enemies are 20% lower with the floor.
- **How we could test:** an in-game Laevatain heat hit on a 0-resistance enemy, with and without Scorching Heart active. Compare the damage with the engine.

### ZS-10. D26 (Weakness and Protection): ZS applies them to operator damage
- **Engine:** Weakness and Protection are ×1 in damage (D26, [ASSUMED]).
- **Source:** `calculationSpec.md`, "Damage Formula": the product includes (1 − Weakness) and (1 − Protection). `SKILL.md`: Protection = 1 − max(effect), Sanctuary from Snowshine and Catcher. Weakness is described as reducing "target's damage output" (Catcher's ultimate).
- **Basis:** unstated. DP (666bj, 1.6 and 1.7) describes both as applying to damage received by the team, or the weakened unit's damage output, not operator-to-enemy damage. MoeYinlo (DP) reads Weakness from the attacker's snapshot and Shelter from the defender's.
- **Impact if the source is right:** if Protection really multiplied operator damage, every hit would be wrong. The DP and MoeYinlo scope is probably right, which means ZS's formula is the mistake. The one case that matters is an operator weakened by a kit.
- **How we could test:** check Catcher's ultimate data: does it weaken enemies or the team? If the team, check its outgoing damage in game.

### ZS-11. D5 (Susceptibility): multiplicative term
- **Engine:** Susceptibility is 1 + Σ, additive (D5). No multiplicative part.
- **Source:** `calculationSpec.md`: Susceptibility = (1 + ElementSusceptibility) × SusceptibilityMultiplier, the multiplier from Last Rite's Cryogenic Embrittlement T2 (`with.multiplier`).
- **Basis:** unstated. No second source.
- **Impact if the source is right:** Last Rite's T2 damage would be multiplied on top of the additive susceptibility.
- **How we could test:** an in-game Last Rite T2 damage check against the engine's additive value.

### ZS-12. S11 (Stagger Nodes): node stagger gives frailty for 5 s
- **Engine:** a node raises a `staggerNode` event with no damage effect (S11).
- **Source:** `status-stagger-node.json`: 5 s, APPLY STAT STAGGER_FRAILTY value 1, to the enemy. So a node stagger also gives the ×1.3 frailty for 5 s.
- **Basis:** data; no test cited. DP (666bj, 3.4) says a node gives a brief stagger of 2.5 s by default, a different duration.
- **Impact if the source is right:** Stagger node windows would add ×1.3 to every hit for 5 s. Common enemies have nodes at 50%.
- **How we could test:** in-game damage on a node-stagger enemy (a node at 50%) before and after the node. Check for a ×1.3 step.

### ZS-13. T18 (perfect dodge): full time stop
- **Engine:** the world slows along an 18-frame curve, about 15 frames lost, with the dodger frozen about 10 frames (T18).
- **Source:** `eventSpec.md`, "Time Stop Effects": `APPLY DODGE TIME_STOP FOR <duration>`, with "all actions allowed within". ZS's segment time stops are full stops.
- **Basis:** unstated.
- **Impact if the source is right:** the frames lost in a dodge would be the whole stop duration, not 15 frames, which shifts every other operator's timeline after a dodge.
- **How we could test:** an in-game perfect dodge with a known enemy action timer. Count the frames the enemy's attack is delayed.

### ZS-14. T4 (combo time stop): full stop for the combo segment
- **Engine:** the Combo slow-down curve scales time to 0.01 for the first 40% of the skill, then ramps to 1 at 93% (T4). It is a slow-down, not a stop.
- **Source:** `eventSpec.md`: "combo skill time stop, other combos can chain within"; the combo window segment defaults to a time stop. Animation segments in ZS are REAL_TIME and not extended.
- **Basis:** unstated.
- **Impact if the source is right:** the ramp of the engine's combo curve is wrong if the game stops time fully. Affects timing of other operators during combo windows.
- **How we could test:** log a combo's start and end, and the enemy's action timer during it. Compare with the 0.01 to 1 ramp.

### ZS-15. C3, C5 (expected crit mode): crit-triggered stacks
- **Engine:** expected mode uses 1 + rate × crit DMG. In expected mode no hit counts as a crit for `crit: true` triggers (C5). So crit-triggered stacks get no stacks in expectation.
- **Source:** `docs/notes/expected-crit-calculation.md`: crit-triggered stacks (for example MI Security, Cryoblasting Pistolier) follow a Markov model E(T). NEVER gives 0, ALWAYS builds one stack per frame, EXPECTED uses E(T). The devlog says Cryoblasting Pistolier "10 crit stacks at +3% each".
- **Basis:** unstated for the model. The per-hit alternative is in DP's 功能说明 ("每击暴击率 +3%", per hit, not per crit).
- **Impact if the source is right:** in expected mode, crit-stacking operators would gain the stacks at the expected rate, not zero. Only for operators whose stacks depend on crits.
- **How we could test:** in-game counts of Pistolier-type stacks over a fight (are they per hit or per crit?). Compare with the engine's expected mode.

### ZS-16. C2 (Yvonne Freezing Point): crit DMG numbers
- **Engine:** Crit DMG from the data (attribute 10, default 0.5 plus sources, C2). The Yvonne numbers are in the data, not in the rules.
- **Source:** `public/devlog.md` ("Yvonne reconciled"): Freezing Point gives +20% / +40% crit DMG (talents 1 and 2) while Solidification is active, and +10% / +20% while Cryo Infliction is active, added together. DP-14 gives different numbers.
- **Basis:** the devlog says the kit was "cross-referenced against in-game wiki descriptions". No test.
- **Impact if the source is right:** Yvonne's crit DMG with both states active would be +60% at talent 2 (ZS), not +40% (DP).
- **How we could test:** check our Yvonne data against both sources. Decide with an in-game test: Yvonne's crit damage on a cryo-infliction enemy, then on a frozen enemy.

### ZS-17. D3, D7, S7 (Stagger in the damage formula): ZS's doc counts it twice and drops ×1.3
- **Engine:** Stagger DMG bonus is additive in the damage-bonus zone (D3). Stagger frailty ×1.3 is multiplicative (D7, S7). Stagger frailty is counted once.
- **Source:** `calculationSpec.md`: StaggerDMG% is in the MultiplierGroup and again as a separate factor StaggerBonus = 1 + StaggerDMG%. The formula does not show the 1.3 frailty. `SKILL.md` does have 1.3.
- **Basis:** unstated. Internal to ZS's docs.
- **Impact if the source is right:** if both terms are real, Stagger DMG bonuses count twice. Only a documentation error if not.
- **How we could test:** read ZS's code for the damage formula. If it applies StaggerDMG% twice, that is a real difference to check in game.

### ZS-18. P4 (Lift and Knock Down consumption): ZS's wording conflicts
- **Engine:** Lift and Knock Down add +1 Vulnerable and do not consume the existing stacks (P4, P5).
- **Source:** `SKILL.md`, the physical-status table: Lift and Knock Down "Consume Vulnerable". Its text and `eventSpec.md` (around line 299): APPLY LIFT / KNOCK_DOWN "always adds 1 Vulnerable stack". The two readings are different.
- **Basis:** unstated.
- **Impact if the source is right:** if Lift consumes the stacks, Crush and Breach after it would hit for less.
- **How we could test:** in game, apply Lift to an enemy with 3 Vulnerable stacks. Read the stack count afterwards.

### ZS-19. T1 (frame grid): 120 steps per second
- **Engine:** integer 30 FPS frames, round(s × 30) (T1).
- **Source:** `calculationSpec.md`, "Rounding Rules": frame counts are `Math.round(seconds * 120)`.
- **Basis:** unstated; a modelling choice.
- **Impact if the source is right:** small. Durations of 0.73 s (dives) or 5.75 s (Solidification) round to different frames at 120 than at 30.
- **How we could test:** list kit durations that round differently at 30 and at 120 (for example 5.75 s, 0.73 s). Check the engine's frame counts.

### ZS-20. K10 (team energy from SP): ZS's Alesh data differs
- **Engine:** each team member gains 0.065 × natural SP spent on a battle skill (K10, rate ASSUMED).
- **Source:** `docs/notes/operators/alesh.md`: the battle skill consumes 100 SP and gives 17 UE to self and 8.5 UE to the team.
- **Basis:** Alesh's data (its note says "per-wiki"). ZS does not state a general rate.
- **Impact if the source is right:** the team rate would be 0.085 per SP for Alesh's battle skill, not 0.065. Possibly a skill-specific value.
- **How we could test:** check the Alesh battle skill's team energy in game. Compare with DP's 6.5 per 100 SP.

### ZS-21. A20 (Combustion tick timing): ticks at 0 to 9 s
- **Engine:** 10 ticks every 30 frames from application, the last on the end frame, so ticks at 1 s to 10 s after application, and the initial hit separate (A20).
- **Source:** `eventSpec.md`, Combustion: a DOT_PHASE with frames at offsets 0, 1, …, 9 s ("10 DoT frames, 1/s for 10s"). The initial damage is the frame at offset 0. `combatTestingSpec.md` C4 says the duration is 5 s, which conflicts with the 10 s in the data.
- **Basis:** data. The 5 s test line looks stale.
- **Impact if the source is right:** the first tick would come 1 s earlier than the engine's, and the first tick would be the initial hit, not a separate one.
- **How we could test:** a log of a Combustion's tick timestamps (ZMDLogs or our own). Check whether the first tick is at 0 s or 1 s.

---

### ZS: agreements
- D1 (multiplicative zone structure), D3 (additive damage bonus pool), D4 (Amp additive), D5 (Susceptibility additive, except ZS-11), D6 (Fragility = Electrification and Breach, additive, matching the engine's damage-taken zone).
- D8, D9, D10 (attribute bonus 0.005 main and 0.002 secondary; attributes floored): ZS's calc spec and SKILL agree with the engine.
- R1, R2, N2 (enemy DEF 100 at every level, 100/(DEF+100), and the negative-DEF formula 2 − 0.99^(−DEF)). ZS's note "DEF 0.5 effective" matches.
- R4 (resistance formula 1 − R/100 + ignored/100), R7, N3 (per-element points; ZS tiers D 0, C 20, B 50 match DP's tier table; per-enemy data not compared here).
- R8 (Corrosion shred applies to Arts and Physical, `devlog.md` line about Corrosion and Physical Resistance).
- C1, C2 (operator base crit 5%, crit DMG 50%; enemy base crit 0).
- S7 (×1.3 frailty while Staggered, multiplicative with the bonus), S14 (Finisher 1.0, 1.25, 1.5, 1.75 by rank).
- A5 (Arts Burst 160% ATK), A7 (reaction of the incoming element when the other element is present, incoming infliction removed, others consumed), A9 (element to reaction mapping: Heat–Combustion, Electric–Electrification, Cryo–Solidification, Nature–Corrosion).
- A10 (forced reaction: no initial damage: `isForceApplied` frame deals 0).
- A19, A20 (Combustion 10 s and 12% + 12% × level, except the C4 test line, ZS-21).
- A25, A27 (Electrification +12/16/20/24% Arts fragility, duration 12/18/24/30 s).
- A28, A29 (Corrosion 15 s; start 3.6/4.8/6/7.2; 10-second ramp to the cap; both Arts and Physical resistance).
- A38 (Shatter 120% + 120% × level, Arts hidden scaling). ZS lists Shatter with arts reactions; the engine calls it Physical damage with attribute 49 scaling; the scaling agrees.
- P1 (max 4 stacks, 20 s, except the timer, ZS-5), P3 (physical statuses need Vulnerable for Lift and Knock Down; Breach and Crush always apply).
- P4, P5 (Lift and Knock Down hit for 120% ATK).
- P7, P8 (Crush 150% + 150% × n, Breach 50% + 50% × n).
- P9 (Breach physical fragility 12/16/20/24%, duration 12/18/24/30 s by level).
- K5 (natural SP feeds ultimate energy, returned SP does not, `CLAUDE.md` and devlog).
- K18 (combo window 6 s, `COMBO_WINDOW` 6.0 s).
- K31, K32 (Link is consumed by the next battle skill or ultimate, max 4 stacks, battle +30/45/60/75%, ultimate +20/30/40/50%; durations differ, ZS-7).
- T6 (game-time durations are extended by foreign time stops), T8 (cooldowns are REAL_TIME), animations are REAL_TIME and not extended by other stops (`operatorDataSpec.md`).

### ZS: engine silent (mechanics ZS states that no engine rule covers)
- Enemy-side damage reduction: Bonekrusher Vanguard takes −90% while shielded, prism-linked enemies −80%, Tidewalker Statue −50% except fire (+30%) at range (`SKILL.md` section 15; DP 1.4, 1.15). In scope (operator damage to enemies). Engine D28 says damage-reduction phases are not modelled.
- Generic ARTS_DAMAGE_BONUS pool (`calculationSpec.md`): no such pool in D3.
- Operator defence and damage-taken: gear DR = Defense/(Defense+240) (ZS's own check: 36.8% vs 58.3% in game), non-controlled damage reduction coefficients, operator resistance from AGI/INT. Out of scope for operator-to-enemy damage (N8).

### ZS: not covered by the source
- Burst delay of 1 s (A6), projectile travel (T2), slow-down curves (T3, T4 is ZS-14), dives (T20), SP regeneration and pause (K1; ZS gives only "200 pool, 8/s regen" in `devlog.md`), out-of-combat SP, energy costs (K9), healing (K36), gear sets (E), Stagger node values, teammate attacks (K29–K30), Finisher SP table (S15).

---

## EA: Endaxis

### EA-1. B1, B2 (buff groups): source is not part of the group key
- **Engine:** a plain buff from the same owner replaces the active one; instances from different owners add (B1). A type-0 buff with a shared key from two sources adds (B2).
- **Source:** `buff-stacking.md`, "Grouping": the group key is `stackingKey ?? id`. The source is not part of the key. Buffs from different sources in one group follow the same stacking policy. A reuse type (refresh, enhance, extend, overwrite) reuses the first unfinished instance, so the two sources do not add.
- **Basis:** unstated (design doc, native tables).
- **Impact if the source is right:** for reuse-type buffs, two owners with one stacking key share a single instance. The engine would add them. Mapping from the engine's type numbers to Endaxis's 13 types is not known from these docs.
- **How we could test:** map the engine's types 0, 4, 7, 9 to the game's `stackingType`. Then check two same-key buffs from different owners in game.

### EA-2. B5 (stack-group ties): older or newer wins?
- **Engine:** priority group, ties go to the latest applied (B5).
- **Source:** `buff-stacking.md`, "Priority and ties": (1) higher priority first, (2) on a tie, longer remaining lifetime first (unlimited first), (3) on a tie, smaller instance ID first.
- **Basis:** unstated.
- **Impact if the source is right:** two equal-priority effects go to the one with more time left, not the newest. Changes which buff acts when a new application has a shorter lifetime.
- **How we could test:** two equal-priority effects in game, applied at different times with different durations. See which one acts.

### EA-3. B3 (layered buffs at max): oldest layer goes
- **Engine:** at the maximum, the oldest layer goes (B3).
- **Source:** `buff-stacking.md`, `stack` type: at the maximum, end the old instance with the shortest remaining lifetime. On a tie, end the newer old instance. Priority is not read for `stack`.
- **Basis:** unstated.
- **Impact if the source is right:** when layers have different durations (a later layer that expires earlier), the engine would drop the wrong one.
- **How we could test:** an in-game stacking buff applied twice at different times, with the second one having a shorter duration. Check which layer ends first.

### EA-4. B6 (instances with a priority): the weakest goes
- **Engine:** at the limit the weakest goes (ties: oldest). A weaker new one does not replace a stronger one (B6).
- **Source:** `buff-stacking.md`, `highPriorityWithMaxStack`: every candidate is kept, the top N are enabled, and the rest are disabled. A disabled candidate keeps its lifetime and comes back when a stronger one ends.
- **Basis:** unstated.
- **Impact if the source is right:** the engine drops the weaker candidate; Endaxis keeps it dormant. When the stronger one expires, the weaker one returns with its remaining lifetime in Endaxis, but not in the engine.
- **How we could test:** an in-game case with two priorities where the stronger one ends first. See whether the weaker one comes back.

### EA-5. B1, B10 (refresh rule): only if longer?
- **Engine:** a new instance from the same owner replaces the active one with the new full duration (B1), whatever its length.
- **Source:** `buff-stacking.md`: `refresh` renews the lifetime only if the new one is longer. `overwriteDuration` sets the lifetime directly, even if shorter.
- **Basis:** unstated.
- **Impact if the source is right:** a shorter re-application would not shorten the buff under `refresh`. The engine shortens it under B1 (if the engine's type is a replace type).
- **How we could test:** a buff re-applied with a shorter duration in game. See whether the old end time holds.

### EA-6. S10 (Stagger recovery): the bar recovers
- **Engine:** the bar never recovers by itself; it refills when a Stagger ends (S10).
- **Source:** `combat.md`, time table: "失衡恢复" (Stagger recovery) runs on global scaled time. The doc gives no rate.
- **Basis:** unstated. It may mean the stagger state's recovery timer, not bar recovery.
- **Impact if the source is right:** a recovering bar would change the stagger count on slow enemies.
- **How we could test:** an enemy's stagger bar left alone for 20 s in game. Check whether it goes down.

### EA-7. T8 (cooldowns): flag for global time
- **Engine:** cooldowns run on raw time through stops and slow-downs (T8, ASSUMED).
- **Source:** `combat.md`, time table: cooldowns use unscaled time, unless the active dilation "explicitly requires" global time for cooldowns.
- **Basis:** unstated. The flag exists in Endaxis's data; the engine has none.
- **Impact if the source is right:** only for dilations that set the flag. Likely a small effect.
- **How we could test:** read the kit data for a dilation with that flag, then check its cooldown in game.

### EA: agreements
- T1: 30 FPS integer frames.
- T3, T6: an ultimate that sets the global scale to zero pauses normal buffs, including the caster's own.
- T7: entity timelines use the entity's own clock, held by others' stops.
- T8 (default): cooldowns run unscaled.
- K2, K18: SP regeneration and the combo window run on global scaled time.
- B2 (unlimited type with a shared key adds), B4 (overwriting the duration of each layer), B7 (one key groups different IDs), B10 (duration and values come from the new application), B11 (buffs on the world clock).
- B5 (priority selects the first; ties differ, EA-2).
- D20 (level coefficient 1 + 89/196 at Lv 90 in `TimelineHitDetailDialog.test.ts`, the same as the engine).

### EA: engine silent
- Entity-layer time dilation with its own clock flags and projectile clock sync (T10 says entity-layer dilation is not modelled).
- Charged skills (充能): the engine has cooldowns but no charges (K14).
- `timedGrowingEnhance` (layers that grow on a timer by themselves) and `modify` (merges an input into an existing buff).
- Stagger node brief stun and node buffs (Endaxis says in its own text they are not yet connected either; both sources say they exist).
- Enemy-to-operator freezes and infliction effects (out of scope).

### EA: not covered by the source
- Reactions (A), physical statuses (P), damage zones (D), resources (K, except above), equipment (E), enemies (N), Stagger amount and Finisher.

---

## DP: End-DPScope

### DP-1. A36 (Freeze duration): 6, 7, 8, 9 s
- **Engine:** 5.75 / 6.75 / 7.75 / 8.75 s (A36, OPEN).
- **Source:** `research/终末地数据机制导论.md`, 2.1: 冻结 initial duration 6/7/8/9 s by level.
- **Basis:** the 666bj primer's full-test observations. Agrees with ZS-6.
- **Impact:** as in ZS-6.
- **How we could test:** as in ZS-6.

### DP-2. P4, P5, S4, P6 (Lift and Knock Down stagger): 10 each
- **Engine:** Lift and Knock Down deal no Stagger of their own (P6, SETTLED). A hit and the Lift or Knock Down it causes are one Stagger event (S4).
- **Source:** `终末地数据机制导论.md`, 2.2: 击飞 and 倒地 each "accumulate 10 stagger" and add 1 layer of 破防.
- **Basis:** the 666bj primer's full-test observations. The text does not say whether the 10 belongs to the hit or the status.
- **Impact if the source is right:** each Lift or Knock Down adds 10 Stagger, which changes Stagger timing on any enemy where Lift or KD is used. Also, under 2.4 these statuses get +0.5% Stagger per point of Arts Intensity; the engine has no such rule.
- **How we could test:** in game, a Lift or Knock Down on an enemy with a known Stagger bar and a hit with no Stagger. Compare the bar gain.

### DP-3. S10 (Stagger reduction after a quick re-stagger): not in the engine
- **Engine:** the bar never recovers by itself (S10).
- **Source:** `终末地数据机制导论.md`, 3.5: if an enemy becomes Staggered within 3 s (normal), 6 s (advanced), 10 s (elite and boss) or 15 s (leader) of its last Stagger, its accumulated Stagger is cut by 50% for 1, 3, 5 or 10 s after the Stagger ends.
- **Basis:** the 666bj primer's full-test observations.
- **Impact:** a re-stagger on a fast enemy gets less Stagger in the 1 to 10 s after the Stagger ends.
- **How we could test:** in game, a boss with a known bar that is staggered twice in quick succession.

### DP-4. K1 (SP regeneration pause): 0.5 s after a battle skill
- **Engine:** regeneration pauses 1.5 s (45 frames) after any SP spend (K1, ASSUMED; the pause length is OPEN).
- **Source:** `终末地数据机制导论.md`, 4.5: casting a battle skill pauses SP regeneration about 0.5 s; a perfect dodge pauses it 0.5 s.
- **Basis:** the 666bj primer's full-test results ("测试结果显示" for the dodge; not stated for the battle skill).
- **Impact:** after each battle skill, the engine regenerates less SP than the game. The difference is 1 s of regeneration per battle skill (1.5 s vs 0.5 s), at 8 SP/s. Over 8 battle skills that is 64 SP, about 21% of the cap.
- **How we could test:** in game, the SP bar over a battle skill cast with no other spend. Count the regeneration frames.

### DP-5. K2 (SP regeneration during ultimate animations)
- **Engine:** SP regeneration stops during other operators' time stops and slow-downs (K2). The caster's own ultimate stop is not mentioned.
- **Source:** `终末地数据机制导论.md`, 4.5: SP regeneration pauses "during the ultimate animation".
- **Basis:** the 666bj primer, unstated test.
- **Impact:** if it pauses for the caster's own ultimate too, the engine over-regenerates SP during each ultimate animation (about 2 s).
- **How we could test:** in game, SP over the ultimate animation of an operator with a known animation length.

### DP-6. T18, K1 (perfect dodge): 7.5 SP, not 7
- **Engine:** perfect dodge gives +7 natural SP [DATA], with 7 or 7.5 [OPEN] (T18).
- **Source:** `终末地数据机制导论.md`, 4.5: a perfect dodge restores about 7.5 SP and pauses regeneration 0.5 s.
- **Basis:** "测试结果显示" (test results) in the 666bj primer, so an in-game test.
- **Impact:** 0.5 SP per dodge; small, but the engine's data value would be off.
- **How we could test:** in game, the SP change from one perfect dodge.

### DP-7. C3, C6 (crit RNG): .NET Random, not mulberry32
- **Engine:** rolled crit uses a seeded mulberry32 stream, one draw per landing (C6). Crit when draw < rate.
- **Source:** `research/新乘区导论（伤害篇）.md`, "最终结算": the game rolls a value in [0, 1) with the .NET Random (Knuth subtractive generator), seeded by the session's running time, and crits when r ≤ p + 0.00001.
- **Basis:** the MoeYinlo primer, code-based. No test cited.
- **Impact:** only in the rolled mode; the game seed cannot be reproduced anyway. Low.
- **How we could test:** not needed for the engine's expected mode. For rolled mode, match the threshold (≤ p + 1e-5).

### DP-8. R1, R3, N2 (enemy DEF): Bonekrusher Executioner doubles to 300
- **Engine:** every enemy has DEF 100 at every level, no DEF change (N2, R3).
- **Source:** `终末地数据机制导论.md`, 1.10: 碾骨行刑人 raises its DEF to 300 below 50% HP.
- **Basis:** the 666bj primer, described as a game effect. No test cited.
- **Impact:** against that enemy below 50% HP, the DEF factor halves (0.5 to 0.25), so damage halves.
- **How we could test:** in game, damage against a Bonekrusher Executioner above and below 50% HP.

### DP-9. C2 (Yvonne Freezing Point): the numbers differ from ZS
- **Engine:** from the data.
- **Source:** `功能说明.md`, the Yvonne table: 冰点 gives +20% crit DMG against a cryo-infliction enemy, and "冻结加倍" (doubles when frozen), so +40% when both. Says verified "in the engine" (not in game).
- **Basis:** the End-DPScope engine (Endaxis-based), not in game. ZS-16 gives +10/+20% cryo and +20/+40% Solidification.
- **Impact:** Yvonne's crit damage with both states active: +40% (DP) or +60% (ZS at talent 2).
- **How we could test:** as in ZS-16.

### DP-10. Combo (ComboCalcZone, K32): buff lasts the whole skill
- **Engine:** Link stacks apply to "that cast's hits only, until its last hit" (K32).
- **Source:** `新乘区导论（伤害篇）.md`, "ComboCalcZone": a combo consumed by a skill creates a buff lasting the skill's full duration. It listens to the caster's damage, and writes the bonus to any battle-skill or ultimate-mask hit in that time.
- **Basis:** the MoeYinlo primer, code-based.
- **Impact:** hits after a skill's last hit (for example delayed hits) would get the bonus in the game but not the engine. Low.
- **How we could test:** a delayed hit in a battle skill after the last hit, with Link active, in game.

### DP-11. A22 (Combustion tick snapshot): read at each tick
- **Engine:** Combustion ticks snapshot the applier's attacker side at application (A22, SETTLED). Defender side read each tick.
- **Source:** `新乘区导论（伤害篇）.md`, "完整的伤害计算过程": the attribute snapshot is taken at the start of each damage calculation, so for a tick it is the state at that tick.
- **Basis:** the MoeYinlo primer, code-based. The engine's SETTLED status suggests a log test.
- **Impact:** if the game reads the attacker side at each tick, a buff applied mid-burn would change later ticks. The engine's ticks would not change.
- **How we could test:** a log of Combustion ticks across the application of an ATK or DMG buff. Compare with the engine's tick values.

### DP-12. D14 (Real and Life-drain damage): all zones ignored
- **Engine:** fixed damage ignores every zone (D14).
- **Source:** `新乘区导论（伤害篇）.md`, footnote: "Real" or "LifeDrain" damage ignores "some or all" coefficients, depending on the type.
- **Basis:** the MoeYinlo primer, code-based.
- **Impact:** only for kit damage of those types. Low.
- **How we could test:** list the kit damage types that are Real or LifeDrain, and check which coefficients they ignore.

### DP-13. D3 (generic "all skill" DMG bonus): basic attacks excluded
- **Engine:** the generic `DMG +x%` buff counts for any hit it matches (D3). Basic attack vs skill type from the decorate mask (D17). Whether the generic pool includes basic attacks is not stated.
- **Source:** `终末地数据机制导论.md`, 1.3: 全技能伤害提升 applies to battle skills, ultimates and combos, not basic attacks. Finishers (处决) and dives (下落) do benefit from basic-attack bonuses.
- **Basis:** the 666bj primer's full-test observations.
- **Impact:** a generic all-skill bonus would apply to basic attacks in the engine if the pool is not split by skill type.
- **How we could test:** read the kit data for a generic all-skill buff (`DMG` with no type) and check whether it matches basic-attack hits.

### DP-14. D26 (Weakness): attacker-side in the game
- **Engine:** Weakness ×1 in damage (D26).
- **Source:** `新乘区导论（伤害篇）.md`: Weakness (虚弱) is read from the attacker's snapshot and multiplies the attacker's damage. The 666bj primer: only Catcher's ultimate has it, reducing the target's output.
- **Basis:** the MoeYinlo primer, code-based.
- **Impact:** the engine is right for enemy-applied Weakness. It is wrong only if a kit weakens an operator's outgoing damage (check Catcher's ultimate target; see ZS-10).
- **How we could test:** Catcher's ultimate data: confirm the target of Weakness.

### DP: agreements
- D1, D3 (the zone structure: additive damage bonus, Amp, Susceptibility (脆弱), damage-taken (易伤), multiplicative Stagger and finisher, DEF, resistance). Matches the engine's zones, and matches the MoeYinlo list of predefined zones.
- D4 (Amp from Xaihi's and Antal's ultimates), D5 (Susceptibility additive), D6 (damage-taken 易伤 additive, with Electrification and Breach).
- D7 (Stagger ×1.3, 失衡易伤 = 1.3 for all enemies).
- D8, D9, D10 (ATK formula, attribute bonus, attributes floored; the 2.952 / 775.7167 worked example fits an unrounded panel). Note this disagrees with ZS-8, which the DP example supports.
- D12, D13 (flat base addition, 基础伤害提升值, e.g. 120% ATK + 1250).
- D19 (Arts Intensity acts on abnormal and burst damage and status strength, not direct hits), D20, D21 (level coefficients 1 + (Lv − 1)/196 and /392), D22.
- R1, R2, N2 (DEF 100/(DEF+100); DEF 100 for enemies; negative DEF as in the engine), R4 (1 − R/100 + ignored/100), R5 (no floor, the same as the MoeYinlo formula), R7, N3 (tiers D 0, C 20 (30 for one), B 50; the per-enemy table in 1.12 not compared to the engine data).
- R8 (Corrosion lowers all-element resistance, including Physical and Ether).
- C1, C2 (operator base crit 5%, crit DMG 50%; enemy base crit 0, crit DMG 50%), C3 (expected 1 + rate × crit DMG as default, from `使用指南.md`).
- S2 (Stagger efficiency; 点剑 +20%), S7 (×1.3), S9 (Stagger duration by enemy, 6 or 9 typical, longer for some), S13 (finisher once, on the first basic attack of the controlled operator), S14 (finisher 1, 1.25, 1.5, 1.75), S15 (finisher SP 25/35/50/100).
- A1 (one infliction element at a time), A4 (same element adds a stack and triggers a burst, even at 4), A5 (Arts Burst 160%), A7 (reaction consumes the other element's stacks and uses the consumed count as level, up to 4), A8 (80% × (1 + level) initial hit), A9 (element to reaction mapping), A10 (forced reactions have no initial hit), A19, A20 (Combustion 10 s, 12% × (1 + level) per second), A25 (Electrification 12/16/20/24% and 12/18/24/30 s), A27, A28, A29 (Corrosion 15 s; start 3.6/4.8/6/7.2; +0.84/1.12/1.4/1.68 per second; cap 12/16/20/24), A31 (AI scaling 2·AI/(AI+300) on status strength), A32 (refreshing Corrosion keeps the earlier shred), A38 (Shatter 120% × (1 + level) with the Arts coefficient, consumes Solidification).
- P1 (Vulnerable max 4 stacks), P3 (no Lift or Knock Down without 破防), P4, P5 (Lift and Knock Down 120% ATK and +1 stack), P7, P8 (Crush 150% × (1 + level), Breach 50% × (1 + level), both consume the stacks), P9 (Breach +12/16/20/24% for 12/18/24/30 s).
- K4 (SP cap 300), K1 (regeneration 8/s in combat), K5 (returned SP gives no energy), K10 (6.5 energy per 100 SP to the team; ENGINE's ASSUMED rate now has a source), K11 (combos give 10 energy to the caster), K31 (only Lifeng's combo and Akekuri's talented ultimate give Link), K32 (Link values 30/45/60/75% and 20/30/40/50%, max 4).

### DP: engine silent
- Enemy-side damage reduction: 碾骨先锋 with a shield (−90%), 棱镜天使 linked enemies (−80%), 破潮之像 ranged (fire +30%, other −50%) (1.4, 1.15). In scope; D28 says not modelled. Same as ZS.
- Enemy-side Shelter (庇护 read from the defender's snapshot, MoeYinlo): the engine has ×1 (D26). In scope if an enemy can carry Shelter.
- Damage-taken scalars (承伤系数, attributes 4 to 7, one per element) in the shared zone (MoeYinlo). The engine ignores scalar attributes 80–85 (R6) and has no rule for 4–7.
- Abnormal and burst damage increase per element (MoeYinlo: AbnormalAndBurstIncrease). The engine refuses these buffs (D27); the game has them.
- Composite damage-type bonuses (for example Cryo and Electric, 1.3). The engine has per-element pools only (D3).
- Stagger: the 50% cut after a quick re-stagger (DP-3); the 2.5 s brief stagger of a node (3.4; ZS-12 gives 5 s with frailty).
- Stagger from interrupting an enemy charge (3.1: 15 to 100).
- Finisher disabled while Laevatain or Yvonne is in their ultimate (3.3). K25 leaves ultimates OPEN.
- Solidification (冻结) makes weak enemies unable to act (2.1). A37 says the engine does not control the enemy.
- Ranged or enemy-side effects on operators (2.6, 1.4, 1.12, 1.13): out of scope (N8).
- Operator DEF from acid (水灯虫), out of scope.
- SP out of combat (75/s recovery, 40/s drop, 3 s to two bars; 4.5).

### DP: not covered by the source
- Healing (4.1), weapon and enemy growth (4.3, 4.4), per-enemy resistance and stagger tables (1.12, 3.5) beyond the spot checks, gear stats (1.10, 2.4), Arts Intensity on gear (2.4 table), and the enemy-side formulas (2.6 numbers).

---

## Summary

- ZS: 21 differences, 1 stated formula that is unusable (ZS-1). Most important: ZS-2 (reaction level cap at 2), ZS-4 (Stagger 5 s), ZS-8 (ATK rounding, which conflicts with DP's worked example).
- EA: 7 differences. Most important: EA-2 and EA-4 (buff tie rules and dormant candidates).
- DP: 14 differences. Most important: DP-2 (Lift and KD Stagger), DP-4 (SP pause), DP-8 (enemy DEF 300).
- Agreements: each source lists its own, above.
- Cross-source conflicts to resolve first: freeze duration (ZS-6, DP-1: 6–9 s vs the engine's 5.75–8.75); Yvonne crit numbers (ZS-16 vs DP-9); reaction level cap (ZS-2 vs DP and the engine). The engine agrees with DP on ZS-1 and ZS-9.
