# Alesh (chr_0024_deepfin): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0024_deepfin.json
(+ equipment kits reviewed: none; weapon and gear not opened). Reference: docs/combat-mechanics.md.
Name check: docs/glossary.md maps `deepfin` to Alesh.

## Flags

### F1. Ultimate's log ratios are not reflected, and the kit says no log has Alesh
- **Where:** packages/data/kits/operators/chr_0024_deepfin.json → skills[chr_0024_deepfin_ultimate_skill] → hits[hit] (frame 90, `extraScale` atk_up under P5 and enemyHpBelow hp_tar); sources[4] ("No log fixture has Alesh ... (2026-10-20)")
- **Kit has:** the ultimate damage as one hit, with the P5 ×1.5 gated by hp_tar 0.5. The kit's own source says no committed fixture has her.
- **Expected:** docs/open-problems.md, section "0c14: Si, and Rossi's later windows" (found 2026-11-11): log fixture 4e36 (fixtures/pending/zmdlogs-4e3651100056.json) shows Alesh's ATK buff listed twice at 26 s (engine once, ×1.146) and her **ultimates ×1.34 and ×1.90** against the engine. Reference: combat-mechanics §11 (build inputs: weapon level and nodes are a constant factor per operator; the ×0.807 weapon-60 finding is in the same note), and §1.3 for hit scales. The kit should say which of these the kit carries and which it leaves out.
- **Why it may matter:** two ultimate landings differing by ×1.34 and ×1.90 is larger than the constant build factor the note gives her (×0.807 at weapon 60), so the ultimate's damage in the kit is wrong or incomplete for at least one of these cases (the P5 threshold, a second landing, or a buff the kit lacks). Size: the note's ×1.90 is +90% on the landing it was measured on.
- **Evidence:** docs/open-problems.md "0c14" section (4e36 numbers as above); fixtures/pending/zmdlogs-4e3651100056.json exists (not opened in this pass). The kit's source line is dated 2026-10-20, before this finding.
- **Confidence it's a real problem:** medium (the log finding is recorded but unexplained; the kit's stale "no fixture" line is a fact).
- **Verdict:** (phase 3)

### F2. Talent 1's 3 s lockout is cited to a BuffData default that is 0 in the file
- **Where:** packages/data/kits/operators/chr_0024_deepfin.json → buffs[talent1_icd] (`duration: 3`) and the three talent-1 triggers (`not buffActive talent1_icd`)
- **Kit has:** a literal 3 s marker. Its note says it is "a literal because it's a BuffData default of buff_chr_0024_deepfin_talent_1_auro (CD)".
- **Expected:** Json/BuffData/buff_chr_0024_deepfin_talent_1_auro.json: the CreateTimedMarker 'talent' duration is blackboard key `CD`, whose default in that file is **0.0**. TableCfg/PotentialTalentEffectTable.json `chr_0024_deepfin_talent_1_1/_2` set only `usp`/`usp_self` (3/6 and 4/8), with no `cd`. Reference: combat-mechanics §8.2 (a kit duration that differs from the data's value carries `dataOverride` with a reason).
- **Why it may matter:** this marker is the only limit on how often Alesh gains energy from Solidification or Originium Crystals (3 + 6 / 4 + 8 usp per proc). With a 0 s lockout every Solidification would pay; with 3 s, as the kit has it, far fewer do. This moves ultimate energy timing for every Alesh rotation with talent 1.
- **Evidence:** the two data files above (values read with jq). The English talent name "Flash-frozen for Freshness" is in data/555me-beyondGameData/tableCfg/CharGrowthTable.json; its description was not located in this pass, so the 3 s may come from the in-game description. The kit cites no description.
- **Confidence it's a real problem:** medium (the value may be right; the cited source is not the one that gives it).
- **Verdict:** (phase 3)

### F3. The kit says no log has Alesh; a committed fixture does
- **Where:** packages/data/kits/operators/chr_0024_deepfin.json → sources[4] ("No log fixture has Alesh, OBJ Edge of Lightness or Finchaser 3.0 (2026-10-20)")
- **Kit has:** that statement, which leaves her log checks (and the open test 63 reading) without a fixture.
- **Expected:** fixtures/multi-target/zmdlogs-69e75ed40a8c.json contains `chr_0024_deepfin`, and fixtures/pending/zmdlogs-4e3651100056.json is the log behind F1. Reference: combat-mechanics §11 and the kit's own unknowns.
- **Why it may matter:** the kit's combo, battle-skill and ultimate numbers have not been compared with these logs; the stale line also hides the F1 finding from anyone reading the kit alone. Size: not measured.
- **Evidence:** `grep -rl chr_0024_deepfin fixtures` (hold-out ids excluded).
- **Confidence it's a real problem:** high that the statement is stale; medium that it hides a mismatch.
- **Verdict:** (phase 3)

## Checked, no conflict found
- Battle skill SkillPatch values: atk_scale 4.5, poise 10, SP 15 / 25 / 35 / 45 by consumed Cryo stacks, P1 +10 SP (`potential_1_atb`, PotentialTalentEffectTable `chr_0024_deepfin_potential_1`). The stagger unit's poise key is read from the data by the loader; the kit omits it on purpose.
- Basic attack 5 (Final Strike): frames 18 (mask 2097280) and 19 (mask 128) match SkillData; atk_scale 0.62 each (display 1.24); stagger 17 (SkillPatch); controlled-only SP.
- Combo: hook at 22 (ObtainCostAction atb 15, mask 8192) and slam at 38 (mask 12288), the Rare Fin hook at 77 and slam at 93 (ObtainCostAction atb_sp 10 at 93, mask 12288) match SkillData; SkillPatch atk_scale_1 0.75 + atk_scale_2 2.25 = display 3.0, ex 1.2 + 3.6 = display 4.8; usp_normal 10; cooldown 8 s.
- Combo P3: buff `atk_up` 0.15 and `Duration` 10 (PotentialTalentEffectTable `chr_0024_deepfin_potential_3`, `chr_0024_deepfin_combo_skill`), potential_3 set at the combo.
- Ultimate P5: potential_5 1.0, hp_tar 0.5 and atk_up 1.5 (PotentialTalentEffectTable `chr_0024_deepfin_potential_5`). SkillPatch atb_up 15, atb 25, atb_max 100, cost 100 (costType 0), poise 20, atk_scale 9.8.
- Talent 1 energy: usp 3 + usp_self 6 and 4 + 8 (PotentialTalentEffectTable `chr_0024_deepfin_talent_1_1/_2`).
- Element: ultimate damage type 4 (Cryo) and mask 4608, others physical (type 0), as the kit's `element` says.

## Not checked
- The battle skill's and the ultimate's DamageAction frames (27 and 90) sit inside ChannelingAction children in SkillData; I did not re-read their exact frames, only the kit's SP values and the ultimate's SP timing (91) documented in the kit.
- Rare Fin chance formula and the Intellect scaling (kit says "continuous, not per full 10 Intellect as the text reads"): not compared with the CharGrowthTable text.
- Shatter as a combo opener (`combo_on_shatter`): the kit labels it an interim behind in-game test 63, which is open (docs/in-game-tests.md). Not re-judged.
- Equipment (weapon 60 factor and the gear sets): not opened.
- Log 4e36 itself was not opened; F1 rests on docs/open-problems.md's numbers. Hold-out fixtures were not opened.
