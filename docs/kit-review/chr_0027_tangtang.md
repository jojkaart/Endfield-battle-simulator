# Tangtang (chr_0027_tangtang): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0027_tangtang.json
(no equipment kit reviewed: the kit has no equipment references). Reference: docs/combat-mechanics.md.

## Flags

### F1. Combo window trigger: `reactions: true` contradicts the kit's own note
- **Where:** packages/data/kits/operators/chr_0027_tangtang.json → triggers `combo_window_infliction`, fields `on.reactions` and `note`
- **Kit has:** `on: {event: inflictionApplied, reactions: true, elements: [cryst]}`, with the note "An infliction that forms a reaction at once doesn't count in the engine (in-game test 35's question)."
- **Expected:** `reactions: true` means the trigger also fires when the infliction forms a reaction at once (schemas/kit.schema.json, `reactions`). The note says the engine does not count such inflictions. Both cannot hold. The reference marks the question as OPEN: "Windows opened by a reaction: [OPEN] (test 35)" (combo-mechanics §7.5).
- **Why it may matter:** decides whether a Cryo infliction that forms Solidification (or another reaction) opens Tangtang's combo window. That changes when her combo can be cast, and so SP, Link and the Whirlpool timing in rotations.
- **Evidence:** the trigger's `on` block and note in the kit file; schemas/kit.schema.json `reactions` description; docs/in-game-tests.md test 35; docs/combat-mechanics.md §7.5.
- **Confidence it's a real problem:** medium-high (a field and the note disagree; the question itself is open)
- **Verdict:** NOT A PROBLEM — the field is what the engine does: events.ts line 453 counts an infliction that forms a reaction when `reactions: true`, and the loader's commit fbdfdb5 (2026-10-22, owner's reading) made every such kit count it. The note's last sentence ("doesn't count in the engine") is stale wording, not a second behaviour; b7b3 (the cited fixture) is unaffected. Only the open test 35 can change the choice, for all kits using `reactions: true` alike.
  - **Fix (if REAL):** none for damage; reword the note to "counts since 2026-10-22; test 35 can still confirm" (as chr_0032_lizhiyan.json does).

### F2. Basic attack 4 has one hit; SkillData has three landings
- **Where:** packages/data/kits/operators/chr_0027_tangtang.json → skills `chr_0027_tangtang_attack4`, hits `hit` (atk_scale_1) and `hit_2` (atk_scale_2)
- **Kit has:** two hits, one per scale key, no frames.
- **Expected:** SkillData `chr_0027_tangtang_attack4.json` has three DamageActions: atk_scale_1 at frames 6–8, atk_scale_1 at 10–12, atk_scale_2 at 23–28 (decorate mask 128, basic). Two atk_scale_1 landings are in the data, one in the kit.
- **Why it may matter:** one basic-attack landing missing (about one atk_scale_1 hit per chain, ≈ a full basic multiplier per use) and the chain's timing for the first two landings.
- **Evidence:** `jq` over the file's timelineActions (damageUnits per timeline item); the other chains of this kit (attack2, attack3) have one kit hit per data landing, so attack4 is the outlier.
- **Confidence it's a real problem:** medium (the two frames 6–8 and 10–12 could be one landing split by a branch; not checked in the timeline's branch structure)
- **Verdict:** NOT A PROBLEM — the loaded kit has attack4 `hit` with count 2, frames [6, 10] (atk_scale_1) and `hit_2` at 23 (atk_scale_2): the compiler fills `count` and `frames` from SkillData, so the two atk_scale_1 landings are in the loaded kit (dumped from loadKits).

### F3. Stagger (poise-only units) not on the kit's hit fields, while its notes say they are folded in
- **Where:** packages/data/kits/operators/chr_0027_tangtang.json → skills `chr_0027_tangtang_attack5` (hit `shot`), `chr_0027_tangtang_combo_skill` (hit `jet`), `chr_0027_tangtang_normal_skill` (hit `shot`, and the `spout*` hits), `chr_0027_tangtang_ultimate_skill` (hit `rogue_wave`); only the `early_rogue_wave` hit (in the `olden_stare_dive` trigger) has a `poise` field.
- **Kit has:** a `poise` field only on `early_rogue_wave` (poise3). The notes say the poise-only units are folded in ("kit-draft folds it in, D6"). The attack5 note says "Final Strike also deals 18 Stagger" (controlled only), the combo note "poise 10", the battle skill note "5 × poise1 2 = 10", the rogue wave note "poise2 15". No field carries these.
- **Expected:** SkillData DamageActions with damageAttributeType 1 units: attack5_projhit (poise 18, Final Strike, controlled only), combo_skill (poise at frame 35, 10), normal_skill_projhit / ability hits (poise1 ×5 at frames 27–39), ultimate_skill_1 entity (poise2 at entity frame 120, 15). Reference §5: "Stagger = the hit's poise × ...; it comes only from damage units of damageAttributeType 1" and "Final Strikes' Stagger counts only while their operator is controlled".
- **Why it may matter:** Stagger bar progress, Stagger nodes and the finisher window. Batch-4 review item G3a says the draft-copied Tangtang kit lost "18 and 10 Stagger per Final Strike and combo"; the batch-4 table still lists "3 KNOWN entries" with the compiled landing apart. Whether the compiler folds these at match time (packages/data/src/kitMatch.ts `foldPoise`) for the mixed-action cases was not checked.
- **Evidence:** `grep -n poise` over the kit file (only early_rogue_wave); docs/kit-batches/batch-4/chr_0027_tangtang.md "Re-analysis of the gaps" G3a; docs/kit-batches/batch-4.md D6; packages/data/src/kitMatch.ts lines 113–129.
- **Confidence it's a real problem:** medium (the notes say folded; the fields and the batch-4 "KNOWN" entries say otherwise)
- **Verdict:** NOT A PROBLEM — the loaded kit carries the poise: attack5 `shot` poise "poise" controlled-only (Final Strike), combo `jet` poise "poise", battle skill `shot` poise "poise1", ultimate `rogue_wave` poise "poise2" (withDataFacts fills `poise` and `poiseControlledOnly` from the compiled landing; foldPoise folds the poise-only unit into it). The spout hits are scale-less entity ticks with no stagger unit.

### F4. OLDEN STARE freezes every enemy, including bosses, without citing the open boss-freeze question
- **Where:** packages/data/kits/operators/chr_0027_tangtang.json → triggers `olden_stare`, the `control` apply `immobilization` with `freezes: true`
- **Kit has:** the freeze with `freezes: true`, and the note "scenario target controlImmune turns the freeze off". It cites report U3 and test 37, not test 104.
- **Expected:** reference §6.3: "Freezes ... stop the enemy's own clock, unless it is control-immune ... The engine takes every Boss (rank 2) as immune. [OPEN] (test 104; b7b3 and c3c7 fit it)". Test 104 is the boss-freeze question in docs/in-game-tests.md.
- **Why it may matter:** a Boss's clock and its timers during OLDEN STARE (up to 4 s) and the Immobilization's effect on the boss hits; the kit's freeze length rests on that open point.
- **Evidence:** docs/combat-mechanics.md §6.3; docs/in-game-tests.md test 104; the kit's `olden_stare` note.
- **Confidence it's a real problem:** low (the kit is documented on the freeze; the boss part is not cited)
- **Verdict:** NOT A PROBLEM — the freeze rule is the engine's, not the kit's: docs/in-game-tests.md test 104 says the engine takes every Boss as control-immune since 2026-10-31 (b7b3 Rhodagn and c3c7 fit it), so the kit's `freezes: true` does not stop a boss's clock in the simulation. The kit note says only that controlImmune turns the freeze off; citing test 104 would be a courtesy.

### F5. Team Haste from talent 1 rests on an ASSUMED rule the kit does not mention
- **Where:** packages/data/kits/operators/chr_0027_tangtang.json → buffs `haste`, `haste_tail`; trigger `whirlpool_forms` (`talentAtLeast [0,1]`)
- **Kit has:** team Haste (attribute 92, `ratio_speed`) for the Whirlpool duration plus `duration_talent1buff`, and the battle skill's `haste_tail` and Slow.
- **Expected:** reference §6.4: "Attribute 92 ... the cast plays faster (its hits, windows and lock come sooner) ... [ASSUMED] (test 19)". The kit's haste effect on the battle skill's hits depends on that rule.
- **Why it may matter:** timing of hits and windows when talent 1 is on; the kit's note does not say the rule is untested.
- **Evidence:** docs/combat-mechanics.md §6.4; the kit's `haste` buff; docs/in-game-tests.md test 19 and test 84 (Tangtang's own Haste).
- **Confidence it's a real problem:** low
- **Verdict:** UNCERTAIN — the kit's Haste (attribute 92, `ratio_speed`) is the data's own buff, and what Haste speeds up is the engine's ASSUMED rule (combat-mechanics §6.4, test 19), shared by every Haste user; nothing in the kit is wrong against the data.
  - **Decides it (if UNCERTAIN):** in-game test 19 (count a teammate's basic-attack damage numbers in 5 s with and without Haste), or test 84 for Tangtang's own Haste.

## Checked, no conflict found
- Whirlpool stacking: buff_chr_0027_tangtang_water is stackingType 2, maxStackCntKey water_stack = 2 (BuffData, blackboard), duration_water 30 s per layer: matches the kit's `whirlpool` buff (reference §8.1).
- Waterspout counts per Whirlpool count (1 spout, 2 with one Whirlpool, 3 with two or more): the kit's spout1/2/3 count and frame lists match the SkillData entity ticks (first tick at frame 23, then about every 8 frames over 90 frames, 12 ticks per spout), and the Susceptibility gates (spout_susceptibility_2 / _3).
- Battle skill channel: 5 × atk_scale_1 over frames 27–39 with poise1 per tick (SkillData normal_skill, mask 4352): kit `shot` matches; wake at frame 11 matches `whirlpools_consumed`.
- Finisher: landings at frames 9 and 21 (mask 132), matching the kit's power_attack hits.
- Dive attack: mask 1152 (basic + dive), four ticks over frames 3–11, matching `plunging_attack_end` and the dive decoration used by `olden_stare_dive`.
- Ultimate OLDEN STARE: 8 stare ticks at atk_scale_1 over entity frames 0–120 (ultimate_skill_1), rogue wave atk_scale_2 at 120 with poise2, early wave atk_scale_3 at 133 with poise3: matches `stare`, `rogue_wave`, `early_rogue_wave`.
- Attack5 Final Strike flag: mask 2097280 (Final Strike bit set) matches `finalStrike: true`.
- Combo: one jet hit at frame 26–29 with atk_scale (mask 12288, combo) matches the kit's combo hit.
- Combo window opener "by anyone" and its cryo/burst sources match the CharGrowthTable text quoted in the kit.

## Not checked
- The numeric values (scales, factors, poise numbers, potentials P1–P5, talent values, cooldowns, SP and ultimate energy costs, `atb_return` amounts): only the keys and structure were compared, not the values at the build's level.
- Basic-attack launch frames (attack1–3 and attack2/3 `launch` values) and the basic-chain timing: the SkillData timeline projectile fields were not located.
- Triggers `combo_window_burst`, `whirlpool_forms` (delay 26), the Slow and the `olden_stare_dive` hit frames versus the dive's landing timing (batch-1 S10 rotation dives are not castable yet).
- Log fixtures: only the kit's own citations; no fixture was opened (the hold-out fixtures were excluded).
- Equipment kits: none referenced by this operator's kit.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2, F3, F4 · UNCERTAIN: F5
F1's note wording is stale (the kit counts reaction-forming inflictions since 2026-10-22); a doc fix only. F5 is the shared Haste assumption (test 19). Logs: b7b3 (Tangtang) was run through `zmdlogs check`; Tangtang is +4.7% there, not traced to these flags.
