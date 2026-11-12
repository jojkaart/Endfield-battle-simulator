# Si (chr_0036_jsspsi): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0036_jsspsi.json
(+ equipment kits reviewed: none; the kit cites wpn_claym_0018 and suit_atk02 only as evidence for its combo bonuses). Reference: docs/combat-mechanics.md.

## Flags

### F1. Artful Intent's 1 to 1.5 s extra length relies on a freeze stopping the enemy's clock (OPEN)
- **Where:** packages/data/kits/operators/chr_0036_jsspsi.json → buffs[artful_intent] (`duration`, note "runs on the enemy's clock"); skills[normal_skill].hits[hit].applies (control `immobilization`, `freezes: true`)
- **Kit has:** "It runs on the enemy's clock (zmdlogs-bdf223db8e49: about 21.7 s, 20 s + the P1 Immobilization freeze + combo slow-downs)", stated as settled.
- **Expected:** combat-mechanics §6.3: a freeze stops the enemy's own clock "unless it is control-immune … The engine takes every Boss (rank 2) as immune. [OPEN] (test 104)". §8.2: buffs run on the world clock [ASSUMED]. docs/in-game-tests.md test 37: Si's 1 to 1.5 s difference is "not testable by hand", and the engine reads 20 s, or 21 to 21.5 s where the freeze works.
- **Why it may matter:** Artful Intent records every hit its target takes (ink_damage_rate 0.13 at level 12, plus 0.07 from P1, so 0.20 as the kit writes it), and the Fixed DMG burst is that sum. Each second of extra length records more hits, so the burst grows with it. Size: about 1 to 1.5 s per battle skill on bosses only (test 37's estimate); not sized beyond that.
- **Evidence:** zmdlogs-bdf223db8e49 (burst at 24321 ms, 22.2 s after the battle skill; kit source 4). docs/in-game-tests.md test 37 and test 104. The kit does not say whether the bdf223db8e49 target was a Boss; if it was, the freeze would be immune under the engine's current reading and the 21.7 s needs another cause.
- **Confidence it's a real problem:** medium
- **Verdict:** UNCERTAIN — the flag's own premise holds only for non-bosses, and the kit is consistent with that. The bdf223db8e49 target is eny_0046_lbshamman_hdg016 (an ordinary enemy, not a Boss), where the freeze works and 21.7 s fits; the engine already skips the freeze on Bosses (combat-mechanics §6.3), and b7b3762d5da8 (Rhodagn) and c3c735dbb022 (Chiliarch) fit that reading. The kit needs no change; what is open is whether bosses are really control-immune.
  - **Decides it (if UNCERTAIN):** in-game test 104 (Si's battle skill on a boss: does it freeze for about 1 s?). If bosses do freeze, drop the Boss immunity in the engine (not the kit); Artful Intent then runs 1 to 1.5 s longer on bosses and its Fixed DMG burst records that much more.

### F2. The note's infliction type numbers are the reverse of the reference enum
- **Where:** packages/data/kits/operators/chr_0036_jsspsi.json → skills[normal_skill].note (and hits[hit].applies, the fire / cryst pair)
- **Kit has:** "SaveCharTypeIdToIntBySquadSlot slotIndex 0 → SpellInfliction type 2 (Heat) or 0 (Cryo)".
- **Expected:** combat-mechanics §3.1 and packages/data/src/skillCompile.ts INFLICTION: type 0 = Heat, 2 = Cryo. SkillData chr_0036_jsspsi_normal_skill_abilityrange_1.json: the IfElse (serverActionIndex 14) runs CompareFloat on `spellinficttype` against 0; its success branch has SpellInfliction inflictionType 0 (index 16) and its failure branch has inflictionType 2 (index 24).
- **Why it may matter:** only the note. The `applies` entries pick the element by a slot-0 element condition, which the logs support for Heat (kit source 1). A reviewer who maps the note's numbers onto the enum would read the Heat and Cryo branches the wrong way round. The SaveCharType key and whether it stores an element or a character type are not checked here.
- **Evidence:** the SkillData keys above; docs/combat-mechanics.md §3.1; zmdlogs-40d9a3c1da37 (Heat bursts after Laevatain in slot 0, per kit source 1).
- **Confidence it's a real problem:** low
- **Verdict:** NOT A PROBLEM — the flag is right that the note's numbers are reversed (SkillData chr_0036_jsspsi_normal_skill_abilityrange_1: success branch of CompareFloat `spellinficttype` vs 0 = SpellInfliction type 0 = Heat; failure branch = type 2 = Cryo; skillCompile.ts INFLICTION index 0 = fire, 2 = cryst), but only the note text is wrong. The `applies` entries (fire when slot 0 is fire, else cryst) are correct and verified: zmdlogs-40d9a3c1da37 checks 23 of 24 Si hits with 0 mismatches.
  - Housekeeping: reword the note to "type 0 (Heat) or 2 (Cryo)"; no damage or timing changes.

## Checked, no conflict found
- Battle skill: damage at entity frame 6, so frame 15 with the spawn at frame 9; mask 4352, atk_scale; Artful Intent created at entity index 8, before the damage, which supports `beforeDamage: true` (§8.4); team energy at frame 15 (SkillData; buff_common_obtain_ultimate_sp).
- Immobilization: static_duration 1.0 s in SkillPatchTable; +0.5 s at P1 (PotentialTalentEffectTable potential_1, skillBbModifier).
- Combo: 10 atk_scale hits at frames 14 and 17 to 41, final hit at 49 with atk_scale_count (SkillData combo_skill_abilityrange, both branches); atk_scale2 and atk_scale2_1 values; usp 10; poise 10; P5 ×1.15 and the +1 combo_count (potential_5). The window's trigger text (I18nTextTable_EN, Si's COMBO TRIGGER) matches `inflictionConsumed` on cryst and fire.
- Ultimate: 8 slashes at 63, 66, 70, 73, 77, 80, 84, 88 and the final at 100 (poise_2 20); amp buff atk_buff_2 and the team cooldown cut at entity frame 62 (CreateBuffAction, SetSkillCdAtOnce skillTypeMask 64); P3 ×1.2 on atk_scale, atk_scale_2 and enhance_final (potential_3); enhance_duration 12 s.
- Talents: talent 1 (cooldown −10 / −20 s, talent_1_1 / _1_2 → talent2_1 / _2_2) and talent 2 (Haste 0.15 / 0.30 for 5 s, talent_2_1 / _2_2 → talent1_1 / _1_2, ratio_speed as the priority key) match PotentialTalentEffectTable.
- Potentials: P1 ink_damage_rate +0.07 and static_duration +0.5; P2 combo buff potential2_base 0.08, potential2_enhance 0.03, potential2_duration 10; P4 ultimate cost ×0.85 is left to the engine (not in the kit's sources, which is harmless).
- Artful Intent burst: Fixed DMG (damageType 8, `fixedDamage`), frame 13 with Inksoul and 14 without, ink_boom_poise 5 (SkillPatchTable).
- Finisher: four landings at 3, 12, 21 and 37 with multipliers 0.07, 0.10, 0.13 and 0.70 (SkillData chr_0036_jsspsi_power_attack.json). The kit's hits list those frames, so the loader fills the factors from the data.
- Basic attacks 1 to 3: frames are not written in the kit, so the loader takes them from SkillData.

## Not checked
- Equipment kits (wpn_claym_0018, suit_atk02) were not read; only the kit's own citations were taken.
- The `zmdlogs check` run and fixture logs were not re-run; log claims were taken from the kit's sources and docs.
- Basic attack 4 (channel 5 to 40): the single DamageAction at frame 5 and the channel's repeat count were not traced, so the "up to 6 hits" note is unverified against the engine.
- ult_effect_1 to _3 (0.2 s buffs created at ultimate entity frame 97, not in the kit): their effect was not identified.
- SetSkillCdAtOnce functionType 0 for the talent's cooldown cut (set or reduce): not checked against the engine.
- Attack 5 (Final Strike) and the plunging attack have no log fixture; their values were taken from SkillData only.
- Hit-stop, Stagger and the Immobilization's effect on Si's own clock were not checked beyond the OPEN items cited above.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F2 · UNCERTAIN: F1, N1
No REAL flags.

### N1. Attack 5 (Final Strike) has log fixtures; one hit misses (phase 2 said none)
- **Where:** packages/data/kits/operators/chr_0036_jsspsi.json → skills[chr_0036_jsspsi_attack5]; "Not checked" in this file ("no log fixture")
- **Kit has:** hit `hit` from SkillData, no log note.
- **Expected:** fixtures/pending/zmdlogs-c3c735dbb022.json logs 8 Si attack5 hits (7594, 17305, 55881, 65371, 71438, 84493, 91824, 95915, 104745 ms); `zmdlogs check` matches all but t=65371 (logged 7351; readings 8675 / 7613 / 6451 / 9238, closest 3.5% high). The others (for example 6744 at 55881, 91824 and 95915 ms) are plain.
- **Why it may matter:** one hit in 8, 3.5% off its nearest reading, with the log listing only Jade Vessel's enemyvul and a funnel ATK buff; most likely a log-listing or boundary-buff effect, not the kit's scale. Si's other open items (0c14 in docs/open-problems.md) are unrelated.
- **Evidence:** `zmdlogs check fixtures/pending/zmdlogs-c3c735dbb022.json`: Si 185 hits, 181 match, 1 mismatch.
- **Confidence it's a real problem:** low
- **Verdict:** UNCERTAIN — a single hit, no kit pattern; the other seven Final Strikes are exact.
  - **Decides it (if UNCERTAIN):** another log with Final Strike under a known buff set; or a replay of c3c7's 65.3 s buffs against the log listing.
