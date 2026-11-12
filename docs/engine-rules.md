# Engine rules

What the engine (`packages/engine/src`) implements today, rule by rule, for
comparison with community sources. Each rule says what the code does, not
what the game should do. Tags come from
[combat-mechanics.md](combat-mechanics.md) where it has the rule
([SETTLED] / [DATA] / [ASSUMED] / [OPEN]); untagged rules have no entry there.
Where the code and that document differ, this file follows the code.
Attribute numbers are the game's attribute types (`attributes.ts`). Frames
are at 30 FPS.

## D. Damage formula and zones

- D1. One hit = ATK × scale × (1 + ΣdamageBonus) × crit × (1 + Σamp) × (1 + Σsusceptibility) × (1 + ΣdamageTaken) × Π(1 + multiplicative_i) × DEF factor × RES factor. [SETTLED]
- D2. Final damage per hit is `Math.round(exact)` (nearest integer; exact .5 rounds up). Damage is computed in doubles. [SETTLED]
- D3. Damage bonus zone: one additive pool of element DMG (attributes 50–55), skill-type DMG (17 basic, 32 battle, 33 combo, 28 ultimate), DMG vs Staggered (61, only while Staggered) and generic "DMG +x%" buffs; a modifier counts when its element, skill type, kind and decoration filters all match the hit. [SETTLED]
- D4. Amp zone (attributes 64–69, per element): 1 + Σ, separate from damage bonus; amps from different operators add. [SETTLED]
- D5. Susceptibility zone (attributes 70–75, per element): 1 + Σ, separate; instances from two sources add. [SETTLED]
- D6. Damage-taken zone: 1 + Σ, separate; holds Breach, Electrification and "target takes DMG +x%" effects. [SETTLED]
- D7. Multiplicative zone: each modifier multiplies as × (1 + v): Stagger (+0.3), finisher (attribute 27 − 1), Link, and effects written in this zone. [SETTLED]
- D8. ATK% from buffs adds to the panel's ATK% before the attribute bonus: ATK = ((operator base + weapon base) × (1 + panel ATK% + buff ATK%) + flat ATK) × attribute bonus. [SETTLED]
- D9. Attribute bonus = 1 + 0.005 × main attribute + 0.002 × secondary attribute + Σ (ATK-per-point factor, attributes 76–79) × its attribute's points; constants are BattleConst `atkRateOfMain` / `atkRateOfSub` (float32 0.0049999999, 0.0020000001). [SETTLED]; per-point factors [ASSUMED]
- D10. The attribute bonus uses each attribute's whole-number part (floored), including attributes added by buffs (buff points or % of the panel line are added, then floored). [SETTLED]
- D11. Panel line total = ((base + Σadd) × (1 + Σpercent) + Σflat) × Πmultiply, clamped to AttributeMetaTable limits; formula slots 5 add, 6 percent, 7 flat, 8 multiply, 0 treated as add. ATK lines with add or multiply parts are refused. [DATA]
- D12. Scale = product of the hit's blackboard keys at the skill's level after potentials × literal `factor` × `scaleValue` × matching `extraScale` parts. Values come from SkillPatchTable per level. [DATA]
- D13. `base` replaces ATK as what the scale multiplies (e.g. 300 + 5 × DEF); all other zones apply as usual. [DATA]
- D14. Fixed DMG hits (`fixedDamage`) deal exactly their value: every zone ×1, no crit, DEF, RES or Stagger. [DATA]
- D15. Reactions, bursts, Combustion ticks, physical-status hits, Shatter and hits marked `status`/`reaction` have no skill type: no skill-type DMG, but element DMG of their element, DMG vs Staggered, Amp, Susceptibility, damage taken and multiplicative modifiers apply. [SETTLED]
- D16. Hits of damage type `none` (weapon and gear-set procs) take no skill-type DMG. [DATA]
- D17. A hit's skill type comes from its decorate-mask kind (basic 128, battle 256, combo 8192, ultimate 512); `damageType` overrides only where the mask lacks it. [DATA]
- D18. Decorations: Final Strike (bit 2097152), finisher (skillSpecification 8), dive (1024); a modifier with `decorations` acts only on landings with one of them; `onlyKinds` limits it to kinds (burst, reaction, combustionTick, lift, knockdown, crush, breach, shatter). [DATA]
- D19. Arts Intensity (attribute 87) does not act on direct skill hits; it scales only reaction, burst, Combustion-tick, physical-status and Shatter damage, and status strength (A31, A38). [SETTLED]
- D20. Arts reaction, burst and Shatter damage × attribute 49 (IgniteDamageScalar) = 1 + (Lv − 1) / 196 (1.4541 at Lv 90). [SETTLED]
- D21. Physical-status hits (Lift, Knock Down, Crush, Breach, and `status: "crush"` skill hits) × attribute 25 = 1 + (Lv − 1) / 392 (1.2270 at Lv 90). [SETTLED]
- D22. Direct skill hits have no level coefficient; there is no enemy level multiplier. [SETTLED]
- D23. A `status: "crush"` skill hit (e.g. "Crush DMG" hits) takes Crush's level coefficient and × (1 + AI/100), and no skill-type DMG. [SETTLED]
- D24. `zoneScale` multiplies every modifier of the named zone reaching that hit by its value. [DATA]
- D25. Modifiers with a `when` condition are judged on the enemy and buffs as the damage is computed, i.e. after the hit's own applications and before-damage buffs.
- D26. Weakness (attribute 62) and Protection (attribute 63) are ×1 in damage; they are only buff categories for triggers. [ASSUMED]
- D27. Burst DMG (attributes 35–38) and Arts-reaction DMG (56–59) are not modelled: a panel or kit buff carrying one is refused. [ASSUMED]
- D28. Damage-reduction phases, enemy shields and number shields are not modelled. [ASSUMED]

## C. Crit

- C1. Crit rate = attribute 9 total (operator base 0.05 from CharacterTable + sources), clamped to [0, 1]. [SETTLED]
- C2. Crit DMG = attribute 10 total (default 0.5 + sources); a crit is × (1 + crit DMG). [SETTLED]
- C3. Crit modes: `expected` × (1 + rate × crit DMG) (default), `always` × (1 + crit DMG), `never` ×1, `rolled`: crit when a uniform draw in [0, 1) < rate. [SETTLED] for the multiplier
- C4. Every hit can crit (skill hits, bursts, reactions, physical-status hits, Shatter) except Combustion ticks and Fixed DMG. [ASSUMED] (Combustion ticks: [SETTLED])
- C5. In `expected` mode no hit counts as a crit for `crit: true` triggers. [ASSUMED]
- C6. Rolled crits use a seeded mulberry32 stream (`crit`), one draw per damaging landing (ticks included).
- C7. Crit stats on a Combustion tick come from the applier's snapshot (B21) but are not used, since ticks can't crit.

## R. Resistance, defense, level

- R1. DEF factor = 1 / (1 + 0.01 × DEF) (BattleConst `efficiencyOfDEF`); every enemy has DEF 100 at every level, so ×0.5. [SETTLED]
- R2. Negative DEF would use 2 − 0.99^(−DEF); no buff in the data lowers DEF. [DATA]
- R3. No DEF shred or DEF-ignore zone exists in the pipeline.
- R4. RES factor = (100 − enemy resistance points + Σ ignoreResistance) / 100, per hit element; points are attributes 94–99 (physical, natural, cryst, pulse, fire, ether). [SETTLED]
- R5. No floor: shredded resistance below 0 makes the factor exceed ×1. [SETTLED]
- R6. Scalar attributes 80–85 (1 − points/100) are ignored; the points count. [SETTLED]
- R7. Resistance points are level-independent per enemy (stage variants via template `attrModifiers`). [DATA]
- R8. Corrosion's shred enters the ignoreResistance zone and applies to every element, Physical and Ether included. [SETTLED] for 94–98
- R9. Operator level enters damage only through attributes 25 and 49 (D20, D21) and stats; enemy level only selects the enemy's level row (DEF, HP). [SETTLED]

## A. Arts inflictions, bursts, reactions, statuses

- A1. Arts elements: Heat (fire), Electric (pulse), Cryo (cryst), Nature (natural); the enemy holds at most one infliction element at a time. [DATA]
- A2. An infliction lasts 20 s (600 frames) and holds at most 4 stacks. [SETTLED]
- A3. Fresh infliction on a clean enemy: min(4, stacks) stacks, no damage. [SETTLED]
- A4. Same element again: stacks add (capped at 4), the 20 s timer resets, and one Arts Burst triggers, even at 4 stacks. [SETTLED]
- A5. Arts Burst: 160% ATK of that element (base 1.6, independent of stacks) × attribute 49 × (1 + AI/100). [SETTLED]
- A6. A burst lands 30 frames (1.0 s, `buff_common_<e>_<e>_triggered` triggerInterval) after its infliction, on the inflicting operator's clock (T14); its damage uses the buffs and enemy state at landing. [SETTLED]
- A7. Different element: the current infliction is consumed and the reaction of the new element triggers at level = consumed stacks (1–4); the new element is not left as an infliction. [SETTLED]
- A8. Reaction initial hit: (80% + 80% × level) ATK of the new element (1.6 / 2.4 / 3.2 / 4.0) × attribute 49 × (1 + AI/100). [SETTLED]
- A9. Element → reaction: Heat Combustion, Electric Electrification, Cryo Solidification, Nature Corrosion. [SETTLED]
- A10. Forced reaction: consumes nothing, leaves the infliction as it was, no initial hit, level 1 unless the kit says (or the stacks a preceding consume took). [DATA]
- A11. A forced reaction's `durationKey` sets its duration, `scaleKey` (`extra_scaling`) multiplies its strength, `extraSeconds` lengthens that application. [DATA]
- A12. One instance per reaction status; reapplying replaces it with the new level, applier, AI and a fresh duration (no level max-merge). [ASSUMED]
- A13. Reaction statuses coexist with each other and with a new infliction.
- A14. `consumeInfliction` removes stacks without a reaction (optionally only some elements, at most `stacks`; the rest keeps its timer). [DATA]
- A15. Kit element `"enemy"` applies the enemy's current element (nothing without one); `"window"` the latest element the owner's combo trigger saw since the cast, else the window opener's, else the enemy's current. [SETTLED] for Arcane; latest vs first opener [OPEN]
- A16. A hit's applications take effect before its own damage (the hit sees the new status) unless marked `afterDamage`. [SETTLED]
- A17. The reaction's initial hit lands after the triggering hit's damage, on the enemy state that hit saw; buffs that `beforeDamage` triggers apply act on it. [SETTLED]
- A18. Reaction and burst damage belongs to the operator whose hit applied the infliction (its panel and buffs).
- A19. Combustion: lasts 10 s at every level (code keeps 10 s; the buff file says 11 s). [SETTLED]
- A20. Combustion tick: (12% + 12% × level) ATK Heat (0.24 / 0.36 / 0.48 / 0.60) × attribute 49 × (1 + AI/100), every 30 frames from application, the last on the end frame: 10 ticks. [SETTLED]
- A21. Combustion ticks can't crit and take no skill-type DMG. [SETTLED]
- A22. Combustion ticks snapshot the applier's attacker side at application (ATK%, attributes, DMG bonus, Amp, crit stats, Arts Intensity); defender side (Susceptibility, damage taken, multiplicative incl. Stagger, resistance) is read at each tick. [SETTLED]
- A23. A new Combustion (reaction or forced) restarts ticks and retakes the snapshot; a Heat infliction alone does not change a running Combustion. [OPEN] (458b)
- A24. A forced Combustion's `scaleKey` multiplies each tick.
- A25. Electrification: Arts damage taken (damage-taken zone) +12 / 16 / 20 / 24% by level × (1 + 2·AI / (AI + 300)) × scaleKey, AI = applier's at application. [SETTLED]
- A26. Electrification applies to Heat, Electric, Cryo and Nature hits only (not Physical, not Ether). [OPEN]
- A27. Electrification lasts 12 / 18 / 24 / 30 s by level. [SETTLED]
- A28. Corrosion lasts 15 s at every level. [SETTLED]
- A29. Corrosion shred (resistance points) by level: start 3.6 / 4.8 / 6 / 7.2; +0.84 / 1.12 / 1.4 / 1.68 per full second elapsed; cap 12 / 16 / 20 / 24; all × (1 + 2·AI / (AI + 300)) of the applier at application. [SETTLED]
- A30. The shred ramps in whole-second steps (floor of elapsed seconds); each step adds then clamps to the cap. [SETTLED] (fits logs); under slow-downs and freezes [OPEN]
- A31. Arts Intensity effect on status strength: × (1 + 2·AI / (AI + 300)), approaching ×3; on damage: × (1 + AI/100). [SETTLED]
- A32. Corrosion carry-over: a new Corrosion while one runs starts from max(running shred now, own start), then ramps to its own cap, which its first tick clamps to. [SETTLED]
- A33. Corrosion's own initial hit sees the Corrosion that was on the enemy before (not its own shred) and not the buffs its status triggers. [SETTLED]
- A34. Talent `statusTweaks`: `capScale` multiplies Corrosion's cap, `extraSeconds` lengthens the status; a forced Corrosion's `extra_scaling` multiplies start, per-second gain and cap. [DATA]
- A35. Corrosion's ramp does not advance during time stops, slow-downs or freezes (its start is shifted with the enemy clock).
- A36. Solidification lasts 5.75 / 6.75 / 7.75 / 8.75 s by level (native settings say 6–9 s). [OPEN]
- A37. Solidification has no damage modifier and does not freeze or control the enemy in the engine.
- A38. Shatter: a physical status, a Vulnerable stack added directly, or a physical status's stack-only add on a Solidified enemy consumes the Solidification: (120% + 120% × its level) Physical (2.4 / 3.6 / 4.8 / 6.0) × attribute 49 × (1 + AI/100), after the status's own hit; Vulnerable is unaffected. [DATA]
- A39. Every damage-dealing status event's attacker is its applier; status-dealt damage deals no Stagger (S8).

## P. Physical statuses

- P1. Vulnerable: max 4 stacks, 20 s; each new stack sets the shared timer to max(current end, now + 20 s). [DATA]
- P2. Only physical-status applications and direct Vulnerable applications add stacks; plain Physical hits add none. [DATA]
- P3. A physical status on an enemy without Vulnerable only adds 1 stack (no status, no hit), unless it is a forced Lift or Knock Down. Crush and Breach have no forced form. [DATA]
- P4. Lift: +1 Vulnerable (not consumed), status 3 s, hit 120% ATK Physical × attribute 25 × (1 + AI/100), level 1 regardless of stacks. [DATA]
- P5. Knock Down: same as Lift with a 10 s status. [DATA]
- P6. Lift and Knock Down deal no Stagger of their own. [SETTLED]; one exception in logs [OPEN]
- P7. Crush: consumes all n Vulnerable stacks (n ≥ 1), hit (150% + 150% × n) (3 / 4.5 / 6 / 7.5) × the action's `damageMultiplier` × attribute 25 × (1 + AI/100); status 3 s. [DATA]
- P8. Breach: consumes all n stacks, hit (50% + 50% × n) (1 / 1.5 / 2 / 2.5) × attribute 25 × (1 + AI/100). [DATA]
- P9. Breach debuff: Physical damage taken +12 / 16 / 20 / 24% by n × (1 + 2·AI / (AI + 300)) × `extra_scaling`; lasts 12 / 18 / 24 / 30 s by n (buff file default 15 s); a new Breach replaces the old. [DATA]; AI scaling [OPEN]; duration [ASSUMED]
- P10. One instance per physical status; reapplying replaces it.
- P11. Physical-status hits can crit, take element (Physical) DMG, Amp, Susceptibility, damage taken and Stagger's ×1.3, and no skill-type DMG.
- P12. Physical statuses run on the enemy clock (held by time stops and freezes).
- P13. Control statuses (Immobilization etc.) last their seconds or skill value; with `freezes` they stop the enemy's clock unless it is control-immune (S12, N9). [OPEN]

## S. Stagger

- S1. Stagger HP = enemy attribute 20; an enemy with 0 can't be Staggered. [DATA]
- S2. Stagger per hit = the kit hit's `poise` × attacker attribute 26 (default 1, min 0, buff filters judged per landing) × enemy attribute 24 (default 1). [SETTLED]
- S3. Only kit hits with `poise` deal Stagger; bursts, reactions, Combustion, physical-status hits and Shatter deal none. [SETTLED]
- S4. A hit and the Lift, Knock Down or reaction it causes are one Stagger event (the hit's). [SETTLED]
- S5. Final Strikes marked `poiseControlledOnly` deal Stagger only if their operator was controlled at the cast. [SETTLED]
- S6. Stagger is dealt after the hit's damage: the hit that breaks the bar doesn't get the ×1.3.
- S7. At 0 the enemy is Staggered: multiplicative × (1 + 0.3) on every hit (`buff_common_poise_break_damage_taken_scale` dmg_up 0.3), separate from "DMG vs Staggered" bonuses (damage-bonus zone). [SETTLED]
- S8. While Staggered the enemy takes no Stagger. [SETTLED]
- S9. Stagger duration = enemy attribute 21 × attribute 31 seconds (21 is 6–24 s by enemy, most 6, 7 or 9; default 10; 31 default 1), on the enemy's clock. [SETTLED] for the base; extra 0.3–2.3 s in logs [OPEN]
- S10. The bar never recovers by itself; it refills to full when a Stagger ends, or on a scenario `recover` action (boss refills). [SETTLED]; Rhodagn's refill trigger [OPEN]
- S11. Stagger Nodes (`poiseKnotPctList`, e.g. 50%) raise a `staggerNode` event when the bar passes them from above; no damage effect. [DATA]
- S12. Time stops and freezes extend a running Stagger (its end is on the enemy clock). [SETTLED]
- S13. Finisher (`power_attack`, skillSpecification 8): only on a Staggered enemy, once per Stagger. [DATA]
- S14. Finisher damage × enemy attribute 27 (1 / 1.25 / 1.5 / 1.75; Common 1, Advanced 1.25, Elite/Alpha 1.5, Boss 1.75 typical), multiplicative zone. [DATA]
- S15. Finisher SP: the enemy's `breakingAttackedAtbObtain` (25 / 35 / 50 / 100), natural SP, atbSourceType 0, at the finisher's first landing. [DATA]; source type [ASSUMED]

## T. Time

- T1. Integer frames at 30 FPS; seconds convert with round(s × 30). [SETTLED]
- T2. Projectile travel isn't in the data: hits land at kit frames (launch frame or log-read). [DATA]
- T3. Ultimate time stops (`UltimateTimeAction`) and global `TimeDilationAction` slow-downs scale time for everyone but the caster; the lowest scale counts where they overlap. [DATA]
- T4. Combo slow-down curve `ComboSkill`: 0.01 for the first 40% of its duration, linear to 1 at 93%, 1 after. [DATA]; linear ramp [ASSUMED]
- T5. Lost frames = Σ(1 − scale) over the slow-down's frames (rounded); everything after the start on a held clock is shifted by that many frames.
- T6. Held by others' stops/slow-downs (world clock): enemy statuses, inflictions, Vulnerable, Combustion ticks, debuffs, Stagger timer, combo windows, Link stacks, SP regen and its pause, energy blocks, every buff (caster's own included). [ASSUMED] for buffs and SP
- T7. Held for each non-caster operator: its hits on the way, delayed actions, current action and chain windows. [ASSUMED]
- T8. Cooldowns run on raw time through stops and slow-downs. [ASSUMED]
- T9. An operator inside its own ultimate's stop isn't held by another's stop or slow-down until its own stop ends. [SETTLED] for three logs; reach [OPEN]
- T10. Hit-stop, entity-layer dilation and `SetIgnoreGlobalTimeScaleAction` aren't modelled. [OPEN]
- T11. Enemy-clock waits (`enemyDelay` hits, enemy buffs' triggerInterval) are held by every time stop, the caster's own included. [SETTLED]
- T12. Freezes: a `freezes` control stops the enemy clock for its duration (overlaps count once), unless control-immune; default immune = Boss (rank 2). [OPEN]
- T13. Haste (attribute 92, default 1, clamped 0.1–1.3): a cast's skill frames play as round(x / speed) real frames (hits, windows, exclusive time, jumps); cooldowns unchanged. [ASSUMED]
- T14. Arts Burst clock: held by others' stops/slow-downs (including ones already running), not by its own operator's, nor by freezes. [SETTLED]
- T15. Order within a frame: bursts, status ticks, buff expiries, delayed actions, team energy, enemy actions, buff ticks, hits, after-hits actions, jumps, teammates' attacks. [ASSUMED]
- T16. Hits at one frame land in operator-ID order; otherwise in scheduling order. [ASSUMED]
- T17. A buff is active from its application frame up to (not including) its end frame; a periodic tick on the end frame happens before it ends.
- T18. Perfect dodge (with `dodge.chance`, at an enemy attack on the controlled operator): +7 natural SP, world slowed by an 18-frame curve (about 15 frames lost, dodger and cooldowns exempt), dodger frozen ~10 frames, 15-frame dodge action, `perfectDodge` event. [DATA]; 7 or 7.5 SP [OPEN]
- T19. No dodge during an ultimate before its exclusive frame, in the air, or when the current skill would counter the attack. [DATA]
- T20. Dives: the landing starts 22 frames (0.73 s) after the jump (fall begins at frame 2), from jump height 2.1 m, gravity 40, plunge at 0.6 m, 0.633 s hover, fall 60 m/s. [ASSUMED]
- T21. Food buffs last 300 s from the fight's start; after that the panel without the food is used. [DATA]

## K. Casting

- K1. Team SP: max 300, start 200, regenerates 8/s (8/30 per frame), regeneration paused 1.5 s (45 frames) after any spend; a later spend never shortens a running pause. [ASSUMED]; regen rate and pause [OPEN]
- K2. SP regen stops during others' time stops and slow-downs (lost frames). [ASSUMED]
- K3. SP cost = table cost (SkillPatchTable, costType 1) + attribute 45 of panel and buffs, at least 0; a cost above 300 can't be cast; casts wait for SP. [DATA]
- K4. SP above 300 is lost. [DATA]
- K5. Natural SP (regen, finisher SP, perfect dodge, `atbGainMethod` 0) gives ultimate energy when spent; returned SP (skills' `atb`, method 1, default) is spent first and gives none. [DATA]
- K6. A skill's `atb` arrives at its first landing unless the kit names the hit (`hit.sp`). [ASSUMED] timing
- K7. `spBeforeDamage`: the hit's SP and its triggers come before its damage. [DATA]
- K8. SP grants marked controlled-only (`onlyExecuteWhenSourceIsMainChar`) are given only while that operator is controlled. [DATA]
- K9. Ultimate energy: max = the ultimate's cost (costType 0); start 0 unless the scenario says; no passive gain; casting spends the full cost. [DATA]
- K10. Team energy: each team member gains 0.065 × natural SP spent by a battle skill, at the cast or split at the skill's `buff_common_obtain_ultimate_sp` frames. [ASSUMED] rate; [DATA] frames
- K11. Fixed energy grants (`usp`, commonly 10 on combos) × attribute 44 (default 1) unless `ignoreUspGainScalar`; energy is capped at max. [DATA]
- K12. Energy blocks (`RefrainObtainUsp`, `energyBlockSeconds`, `blocksEnergy` buffs) stop the owner's gain; `useUspRecoverTag` grants ignore them. [DATA]
- K13. Potentials change cost and cooldown via `skillParamModifier` (paramType 1 cost, e.g. ×0.85 ultimate cost at P4; 2 cooldown). [DATA]
- K14. Cooldowns (SkillPatchTable, seconds → frames) start at the cast; combo cooldowns × attribute 47 (ComboSkillCooldownScalar). [DATA]
- K15. Combo cooldowns run at attribute 93's recovery rate (default 1) when a kit buff changes it; progress is kept across rate changes. [DATA]
- K16. A `cooldownGroup` puts every member on its own cooldown when one is cast. [DATA]
- K17. Cooldown cuts by fraction are of the skill's full cooldown, applied only to a running cooldown. [OPEN]
- K18. Combo window: opened by the kit's trigger (`openCombo`) for 6 s (180 frames), per operator, on the world clock; casting the combo closes it; a new trigger while open restarts the 6 s. [ASSUMED]
- K19. A trigger while every combo the window is for is on cooldown doesn't open it (what it saw is still recorded). [ASSUMED]
- K20. An operator's own combo doesn't open its own window, except a window for named skills (its next sequence). [ASSUMED]
- K21. A kit with no `openCombo` trigger allows its combo whenever it is off cooldown. [ASSUMED]
- K22. Action gates: a skill may start after the current action's duration, inside a window (`AllowNextSkillAction`) that lists it, from the current action's exclusive frame, or at once if it outranks it. [DATA]
- K23. Priorities by skillSpecification: basic 1, battle 2, finisher 2, combo 5, ultimate 7, dive always; others 2. [ASSUMED]
- K24. Starting a skill ends the current one: its pending hits, delayed cast actions and `endsWithCast` buffs are cancelled, except detached hits (launched projectiles). [DATA]
- K25. `cantCastSkill` channels (and a finisher's disable-cast frames) block every cast of that operator whatever the priority; `cantSwitchPosition` blocks swaps. [DATA]; ultimates [OPEN]
- K26. A swap costs no time and doesn't stop the old operator's action; basic attacks and dives need the operator to be controlled; casting a basic attack or dive makes it controlled; `takesControl` ultimates take control. [ASSUMED]
- K27. Chains: a chain step (attack2…) starts only while an earlier step's window lists it; an attack input during that window is that step. [DATA]
- K28. `dontInterruptCombo` skills keep the chain's next step until 1 s (30 frames) after their exclusive time; other skills clear it. [ASSUMED] 1 s
- K29. Teammates attack on their own (default on): when not controlled and their action is over, they run their basic chain at its windows and pause 3.5 s (105 frames) after a full chain; their own skills cut it at once. [SETTLED] pace; [ASSUMED] fixed pause
- K30. Teammates' hits get no Final-Strike Stagger and no controlled-only SP or effects. [DATA]
- K31. Link: a team stack lasting 15 s, given only by a kit `link` action (data ComboAction) or a buff counting as Link; ordinary combos give none. [SETTLED]
- K32. The next battle skill or ultimate by anyone uses all Link stacks (counted up to 4): multiplicative +30 / 45 / 60 / 75% (battle, 0.15 + 0.15n) or +20 / 30 / 40 / 50% (ultimate, 0.1 + 0.1n) on that cast's hits only, until its last hit. [SETTLED] one stack on an ultimate; per-stack [OPEN]
- K33. A follow-up cast (a skill casting another) costs nothing, starts no cooldown and uses no Link.
- K34. Triggers: `cooldown` (seconds; per subject optional), `maxCount` per fight, `maxPerCast`, `chance` rolled after `if` (a miss starts no cooldown). [DATA]
- K35. Triggers of different operators on one event run in team order; each judges its `if` on the state at the event, before any trigger acts. [ASSUMED]
- K36. Heals are events without amounts; operator HP isn't tracked (low-HP conditions never hold, full-HP ones always do). [ASSUMED]
- K37. One enemy; every hit lands on it.

## B. Buffs

- B1. Plain buffs (stacking types 0, 4, 7, 9): a new instance from the same owner replaces the active one; instances from different owners add. [DATA]
- B2. A priority key alone doesn't make a group: type 0 with a key from two sources adds. [SETTLED]
- B3. Layered buffs (types 2, 11; `maxStacks`): each layer has its own timer; at the maximum the oldest layer goes; modifiers add per layer. [DATA]
- B4. Shared-timer layers (types 8, 10; `sharedTimer`): each new layer resets every layer's end to its own. [DATA]; kit buffs [OPEN]
- B5. Stack groups (type 1, or type 11 with a priority key and one instance): instances from different owners don't add; only the highest-priority instance acts, whole; ties and groups without a key go to the latest applied. [DATA]
- B6. Instances with a priority (`instances` n): at most n per owner; at the limit the weakest (ties: oldest) goes, so a weaker new one doesn't replace a stronger one. [DATA]
- B7. Type 2 with one literal layer on others is one instance whoever applies it. [SETTLED]
- B8. `stackingKey` joins buffs of different files into one (all foods share one key: one food per operator). [DATA]
- B9. A team buff with recipients keeps layers per recipient set.
- B10. Duration and values are fixed at application, at the applier's levels and situation; duration 0 means not applied; no duration means until ended. [DATA]
- B11. Buffs run on the world clock: others' time stops lengthen them. [ASSUMED]
- B12. `extendBuff` adds seconds to every layer of an active buff; `endBuff` ends all or the oldest layers. [DATA]
- B13. `endsWithCast` buffs end when the owner's current skill ends or the owner starts another. [DATA]
- B14. Targets: `self` (owner's hits), `team` (all members, or `recipients` judged at application), `enemy` (every team member's hits on it). [DATA]
- B15. `consumedBy`: inactive until the next cast of those kinds by someone it reaches; then it acts only on that cast's hits (until its last hit), or with `whileCasting` on every hit of the caster until the cast ends. [DATA]
- B16. By default a hit's buffs act from the next hit (applied after its damage). [DATA]
- B17. `beforeDamage` buffs act on the hit that applies them. Order within a landing: cast SP, applications, before-damage triggers on what they caused, stack gains, before-damage buffs, `spBeforeDamage` SP, damage, `afterDamage` applications, other buffs, hit SP, energy, reaction/burst/status damage, Stagger, then triggers. [DATA]
- B18. Buff modifiers reach a hit only if active at its landing frame (no snapshot), except snapshots below. [SETTLED]
- B19. Buffs and amps of the same zone add within the zone; buffs of different zones multiply (D1).
- B20. Buffs carrying Strength / Agility / Intellect / Will (points or % of the panel line) raise ATK through the attribute bonus, floored. [DATA]
- B21. Snapshot: only Combustion and `atkSnapshot` periodic hits (Rossi's bleed) keep the attacker side (ATK%, attributes, DMG bonus, Amp, crit rate, crit DMG, Arts Intensity) from application. [SETTLED]
- B22. A periodic buff ticks every `every` seconds from application (or at once with `tickOnApply`), including a tick on its end frame. [DATA]
- B23. Ultimate-gain efficiency (44), SP cost (45), Stagger efficiency (26), Haste (92) and combo recovery (93) on buffs are read where the game reads them, not as damage zones. [DATA]
- B24. Electrification's, Corrosion's and Breach's strengths are fixed at application by the applier's AI, not updated later. [SETTLED]

## E. Equipment

- E1. Weapon base ATK by weapon level adds to operator base ATK before ATK%. [DATA]
- E2. Weapon skills: three (two for 3-star), each at its build level; their permanent stat modifiers are panel lines at that level; conditional parts are equipment kits. [DATA]
- E3. The engine doesn't enforce weapon breakthrough bounds or potential on skill levels; those are build inputs. A weapon of another type is a warning only.
- E4. Equipment effects are wielder-relative and generic; values come from the equipment's own skills at the build's levels. [DATA]
- E5. Gear lines: line 0 fixed, lines 1–3 by artifice level 0–3. [DATA]
- E6. Gear sets: active with `piecesRequired` pieces (3 for all 24 sets; no 2-piece effects); identical pieces each count. [DATA]; duplicates [OPEN]
- E7. Set skill stat modifiers are panel lines; conditional set effects are equipment-kit triggers. [DATA]
- E8. Food: one per operator; its attribute modifiers are panel lines for its duration (300 s) from the fight's start; a food's DEF +x% (formula item 1) is kept out and refused by readers. [DATA]; DEF% [OPEN]
- E9. Flat ATK (e.g. the stew's +180) goes in the flat slot, after ATK% and before the attribute bonus. [SETTLED]
- E10. Talents default to their highest level, attribute nodes to all available at the promotion; potentials P1–Pn apply in order. [DATA]
- E11. Effects under an `activeCondition` apply only when the kit's meaning of it holds on the stat panel. [DATA]

## N. Enemies

- N1. Enemy level comes from the scenario (stage's level); it selects the level row (DEF, HP). [DATA]
- N2. DEF is 100 at every level for every enemy in the data. [SETTLED]
- N3. Resistances are per-element points (attributes 94–99), level-independent. [SETTLED]
- N4. Stage variants use templates with `attrModifiers`: add, × (1 + v) or × v; Stagger HP × 0 on unstaggerable variants. [DATA]
- N5. Ranks (`displayType`): 0 Common, 1 Elite, 2 Boss, 3 Advanced, 4 Alpha; super armor (initial, while Staggered) is visible only to kit predicates. [DATA]
- N6. Enemy HP isn't simulated: HP fraction is a scenario input (1 by default) for HP conditions.
- N7. Born buffs, shields, number shields and damage-reduction phases aren't modelled. [ASSUMED]
- N8. Enemy attacks and charges are scenario inputs on the enemy's clock; enemy damage isn't simulated.
- N9. Control immunity: the scenario says; else every Boss (rank 2) is immune to freezes. [OPEN]
- N10. Boss Stagger refills (second lives, Rhodagn) are scenario `recover` actions, not automatic. [SETTLED] in logs; trigger [OPEN]
- N11. Finisher multiplier (attribute 27) and finisher SP are per enemy (S14, S15). [DATA]
