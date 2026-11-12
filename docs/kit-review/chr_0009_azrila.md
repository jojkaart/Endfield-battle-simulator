# Ember (chr_0009_azrila): kit review

Reviewed: 2026-11-12 (phase 2 flags; phase 3 verdicts 2026-11-12). Kit: packages/data/kits/operators/chr_0009_azrila.json (Ember in the glossary and CharacterTable; "Azrila" is only the id) (+ equipment kits reviewed: none opened in full; packages/data/kits/equipment/wpn_claym_0004.json read for its sources only, because the log check names it). Reference: docs/combat-mechanics.md.

## Flags

### F1. Sources say three effects are left out; the kit includes all three
- **Where:** packages/data/kits/operators/chr_0009_azrila.json → `sources` entry S0 ("what it leaves out: ... talent 2's ATK, the ultimate's team shield and P5's ATK").
- **Kit has:** buffs `ferric_atk` (talent 2 ATK, attached to trigger `ferric`), `ult_shield` and `p5_atk` (both used by the ultimate's hit `hit` in `buffs`), so the three effects are in the JSON.
- **Expected:** the sources should match the fields. Either S0 is stale (the likely case: the three buffs are wired) or the buffs are dead, which the trigger and hit references rule out.
- **Why it may matter:** a reader (phase 3) following S0 would think talent 2 and P5 are absent and might test the wrong thing.
- **Evidence:** kit fields as above; SkillData chr_0009_azrila_ultimate_skill.json (the hit's buffs are wired to `ult_shield` and `p5_atk`); PotentialTalentEffectTable `chr_0009_azrila_talent_2_1/_2_2` (attack 0.06 / 0.09, duration 7).
- **Confidence it's a real problem:** low (wording; numbers are consistent with the data)
- **Verdict:** NOT A PROBLEM — stale wording, no number affected. The loaded kit has `ferric_atk` (talent 2), `ult_shield` and `p5_atk` (the ultimate's `buffs`), and S0's "what it leaves out" list should drop "talent 2's ATK, the ultimate's team shield and P5's ATK" (the shield's points stay unmodelled: the second source entry says so). The numbers match PotentialTalentEffectTable (talent_2 attack 0.06 / 0.09, duration 7; P5 extraattack 0.1, extrashield 1.2).

### F2. Team target for the shield and P5 ATK may include Ember herself
- **Where:** packages/data/kits/operators/chr_0009_azrila.json → buffs `ult_shield` and `p5_atk` (`target: "team"`); skill `chr_0009_azrila_ultimate_skill`, hit `hit`.
- **Kit has:** `target: "team"` with no `recipients`, so the P5 ATK (`extraattack` 0.1, on each shield holder) reaches every member the engine counts as team.
- **Expected:** SkillData chr_0009_azrila_ultimate_skill.json, the CreateBuff for `buff_chr_0009_azrila_ultimateshield`: targetGroupKey `Teammate`, targetSource 2 (CharacterTeamFinder), no validator. Whether "Teammate" includes the caster is not stated in the data files I read. The kit does not say either.
- **Why it may matter:** if the group excludes the caster, the kit gives Ember +10% ATK from P5 that the game does not; if it includes her, the kit is right. The shield itself is not modelled, so only P5 ATK is at stake.
- **Evidence:** the target settings above; the kit's buff fields.
- **Confidence it's a real problem:** low (depends on how "Teammate" is read; needs a check of the team finder)
- **Verdict:** UNCERTAIN — only P5's +10% ATK is at stake and no log has an Ember at P5 (the Ember fixtures are P1 in 7e19, P3 in 2fd9 and 99fb, P4 in 04d4 and 146d). The data: `buff_chr_0009_azrila_ultimateshield` is created with targetGroupKey `Teammate`, targetSource 2; this is the only `Teammate` group in any chr_* ultimate, combo or battle SkillData, so no other kit or log gives the convention, and P5's child buff goes to "the shield's holder" (targetSource 0). I did not confirm how the engine's `team` target treats the caster for this source type. Effect if wrong: +10% ATK on Ember during her own ultimate's 10 s.
  - **Decides it (if UNCERTAIN):** a log of an Ember at P5 (her own hits after the ultimate list `buff_chr_0009_azrila_ultimate_skill_shield_extraattack` or not), or an in-game panel check of her ATK after the ultimate at P5.

### F3. Log check: every Ember hit reads about 2.3% high in two logs; no hit matches exactly
- **Where:** whole operator (basic attacks, battle skill, combo, ultimate, physical-status hits). Logs: fixtures/pending/zmdlogs-04d401ad257e.json and fixtures/multi-target/zmdlogs-146d5ae8c480.json.
- **Kit has:** no note on any Ember log; the kit's sources do not say whether she was checked.
- **Expected:** `node packages/cli/src/main.ts zmdlogs check` on fixtures/pending/zmdlogs-04d401ad257e.json gives Ember 324 hits, 0 match, 312 mismatch (12 under unmodelled effects). The basic attacks are consistently ×1.0226 over the log, e.g. attack2 at t=6158 ms (logged 6503, predicted 6359 / 6177), attack3 at 7414 ms (8075 vs 7896 / 7670), battle skill at 13341 ms (1828 vs 1788), Physical Solidification break at 14390 ms (23000 vs 22491). A few hits are ×0.998 (attack2 at 18456 ms, attack3 at 19614 ms). In fixtures/multi-target/zmdlogs-146d5ae8c480.json the check gives 0 of 198 matching, with basic attacks at ×1.0226 and others at ×1.107 and ×1.175.
  The open-problems entry for Hard 27 (docs/open-problems.md, "Azrila's own ×1.044") already records an unexplained all-element factor on this player's Azrila, with P2's attributes (+3.8% ATK) ruled out. The factor here is smaller, and it shows on every basic attack we looked at.
- **Why it may matter:** a constant ~2.3% on all her damage is a build input (weapon level, gear, nodes) or a kit term (for example a P2 attribute, the talent 2 stacks, or the weapon's physical buff) applied at the wrong size. The kit's damage would be high for every operator-level number.
- **Evidence:** the two fixtures above; check output (scratch); docs/open-problems.md (Hard 27 section, "Azrila's own ×1.044"); PotentialTalentEffectTable `chr_0009_azrila_potential_2` (two attribute modifiers, +20 each, attributes 39 and 42).
- **Confidence it's a real problem:** medium that her numbers are off; the cause is not identified and the kit may not be it
- **Verdict:** NOT A PROBLEM (kit) — a build offset, not a kit error. The offset is one constant per player and the same on every hit type: in pending/zmdlogs-04d401ad257e.json and fixtures/multi-target/zmdlogs-146d5ae8c480.json (same build, P4, wpn_claym_0004 skills 8/9/5) it is ×1.0226 on basic attacks at 6-31 s (before any weapon buff), on the battle skill, Shatter, knock-down, combo and the finisher (t=104084, 104704: ×1.0226 as well, so the finisher machinery is right); in 2fd9 and 99fb (another player: P3, wpn_claym_0006) it is ×1.0444 (the check's own "build offset" line); and in 7e19 (P1, third player) 15 of 21 Ember hits match plain. A kit error would show the same size for every player. The fixtures give no `attributeNodes` for any Ember (the Arclight fixture has it), no weapon level beyond skill levels, and food is unknown: all plausible sources of 2-4%. Note P2's attributes (+20 Str and Will at P2: the stat panel goes from ATK 3409 at P1 to 3569 at P2, +4.7%) are a different size and the open-problems "Hard 27" entry already rules them out for ×1.044. Later in 04d4 the ratio moves in steps (1.08, 1.15, 0.96, 1.33) at times that match other operators' buffs; those are not isolated here.

### F4. Her signature weapon's physical buff: engine applies it, the log shows neither the engine's nor its own reading on 37 hits
- **Where:** packages/data/kits/equipment/wpn_claym_0004.json (conditional buff `buff_wpn_claym_0004_phy_damage_up`, layers from her battle-skill landings); the operator kit does not reference the weapon, so this is an equipment-kit question.
- **Kit has:** not applicable (the operator kit has no weapon reference). The equipment kit's source says the buff was "verified in fixtures/pending/zmdlogs-7e19489ae503.json ... phy_damage_up2 0.2 at skill level 6".
- **Expected:** in fixtures/multi-target/zmdlogs-146d5ae8c480.json the check reports `chr_0009_azrila:wpn_claym_0004.phy on Ember`: engine +0.18 on 37 hits from 26.5 s to 245.8 s, the log does not list it, and neither reading fits (fit 0 / 0 / 37). A lower weapon skill level could give 0.18, but that would not explain the fit.
- **Why it may matter:** Physical DMG on every battle-skill and ultimate landing for a weapon-user; if the stacking or the level is wrong here, the same applies to other logs.
- **Evidence:** the check output (scratch); the equipment kit's sources.
- **Confidence it's a real problem:** low (one log, and a build input may explain it)
- **Verdict:** NOT A PROBLEM (for the operator kit) — the weapon buff cannot be judged from these logs and the flag is an equipment-kit question. The ×1.0226 offset on every hit (F3) removes the discrimination: the hits before the weapon buff exists (6-31 s) have the same ratio as the ones with the engine's +0.18 on (54-515 s), so the engine's value fits the same as no buff; the "fit 0 / 0 / 81" reading is the per-player offset, not the weapon. The log lists two `buff_wpn_claym_0004_phy_damage_up` instances where the replay has three (every Ember hit with it in 04d4 and 146d), but the 0.2 per layer at skill level 6 is in 7e19 (log lists 0.2, skills 9/9/6, matching the equipment kit's own source) and the weapon in 04d4/146d is level 5 (0.18). What would settle layers and magnitude is a log with an Ember that has no build offset (such as 7e19's) and more battle-skill landings.

## Checked, no conflict found
- Basic attacks 1–4: `atk_scale` keys; attack4 Final Strike (mask 2097280), atb 28 when controlled, poise 25 on the controlled operator only (the kit's note; the poise unit's onlyEnableForMainChar is what the engine reads).
- Power attack: BreakingAttackCalculation multipliers 0.1 and 0.9 in SkillData (summing to 1.0), and the loader's matcher agrees with the kit's frames and factors.
- Combo: cooldown 18 s at level 12 (SkillPatch), usp 10, poise 10. The heal (heal_base 675 and will_additive 1.58 at level 12) is outside the damage model and was not evaluated.
- Battle skill: `atk_scale` 0.73 and `atk_scale2` 3.17 at level 12 (SkillPatch) and poise 10 (SkillPatch); the extra-poise landing on `slam_guard` is gated on `guard_success` (the kit's `if`, as the kit describes it).
- Ultimate: `atk_scale` 2.89 at level 1 and cost 100 at level 1 (P4 ×0.85 via the loader); duration 10 s and `hp_percent` (0.18 to 0.22 by level) for the shield (shield values are not modelled); poise 25 on the hit.
- Protection and P1: `extratime` 1.5 and `extrashelter` 0.2 (PotentialTalentEffectTable `chr_0009_azrila_potential_1`); the `protection` buff is `target: self`.
- Talent 2 (ferric_atk): attack 0.06 / 0.09 and duration 7 s (PotentialTalentEffectTable `chr_0009_azrila_talent_2_1/_2_2`); no trigger cooldown in the data (triggerInterval −1, maxTriggerCnt −1), as the kit has none; maxStacks 3.
- P5: `extrashield` 1.2 and `extraattack` 0.1 (PotentialTalentEffectTable `chr_0009_azrila_potential_5`); the child-buff chain is as the kit describes (not traced in full).
- The kit loads through `loadKits` without disagreements from the matcher.

## Not checked
- The shield's points, breaking, and the heal and damage-taken effects (the kit lists them as not modelled).
- Logs beyond the two named in F3 and F4 (for example fixtures/pending/zmdlogs-2fd915292bb7.json, zmdlogs-7e19489ae503.json, zmdlogs-99fb3c35fda2.json, which contain her in smaller numbers); not run.
- Protection's damage effect (the reference says Protection is ×1 in damage, so the kit's attr 63 modifiers do nothing to damage; not re-verified).
- Phase-2 scope only; hold-out fixtures were not opened.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F3, F4 · UNCERTAIN: F2

Names: glossary.md and CharacterTable (`engName`) give `azrila` = Ember; the heading "Azrila" is fixed. Logs: 7e19 16/21 match (the 5 misses are the knock-down, combo and two finisher hits from 25.8 s: ×1.096 on most, where the log lists poise-suit and Stagger entries; the big finisher also fits at ×1.0958 against a reading the check did not list first); 04d4 0/324, 146d 0/198, 2fd9 and 99fb 0 matches, all ×1.0226 or ×1.0444 uniformly (F3).
The Hard 27 entry in docs/open-problems.md ("Azrila's own ×1.044") should name the per-player constants found here: ×1.0226 (04d4, 146d: P4, claym_0004 skills 8/9/5), ×1.0444 (2fd9, 99fb: P3, claym_0006), none in 7e19 (P1); common cause not found, not the kit.
