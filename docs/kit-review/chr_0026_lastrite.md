# Last Rite (chr_0026_lastrite): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0026_lastrite.json
(+ equipment kits reviewed: none; weapon and gear not opened). Reference: docs/combat-mechanics.md.
Name check: the brief's name is used; docs/glossary.md has no entry for `chr_0026_lastrite`.

## Flags

### F1. The Mirage trigger says no log has the Mirages; log b6aa has one at 6141 ms
- **Where:** packages/data/kits/operators/chr_0026_lastrite.json → triggers[mirage] (its note: "no log has them yet (report row 14)")
- **Kit has:** the Mirage pair as trigger hits, with the statement that no log shows them.
- **Expected:** docs/accuracy-plan.md, the b6aa Corrosion entry (2026-10-29, around line 364–368): "the buff replay lacked a Cryo stack: Last Rite's Mirage at 6141 ms (on her Final Strike, needing her battle skill's perfusion), whose battle skill the log never shows." The same b6aa fight supports the kit's "one pair per cast" choice (the kit's own note). Reference: combat-mechanics §8.4 (Test 51's findings: a battle skill's hit has its own timing) and §7.2 (basic-attack chains).
- **Why it may matter:** the Mirage pair is a battle-skill-sized hit set (SkillData mask 4352, ×0.5 each, Cryo infliction). If the log's 6141 ms hit is a Mirage, the trigger timing (frame 21 of the phantom buff) and the infliction it applies are checked by one log; if it is not, the kit's Mirage is unsupported. Size: two hits at atk_scale 3.2 × 0.5 (P5 ×1.2) per cast.
- **Evidence:** docs/accuracy-plan.md (b6aa, 6141 ms, "Mirage"); the kit's triggers[mirage] note in packages/data/kits/operators/chr_0026_lastrite.json.
- **Confidence it's a real problem:** medium (the kit's statement is stale; whether the 6141 ms hit fits the Mirage is not recorded).
- **Verdict:** NOT A PROBLEM — documentation only: the note 'no log has them' is stale, and the log supports the kit. fixtures/pending/zmdlogs-b6aa15281db4.json has the Mirage as buff_chr_0026_lastrite_normal_skill_phantom_main (two hits at t=6141, 23861 each) and buff_chr_0026_lastrite_normal_skill_phantom (two hits at t=18659, 28267 each); `zmdlogs scales` gives 1.95 and 1.96 battle-skill-scale, kit 3.2 × 0.5 × 1.2 (P5) = 1.92. `zmdlogs check`: Last Rite 35 hits, 31 match (27 plain), none of the four Mirage hits is a mismatch, and `--simulate` lands all 35 hits. 'One pair per cast' is also consistent (a pair at each cast).

### F2. A log finding on her ultimate slash (b6aa, ×1.55) is not reflected
- **Where:** packages/data/kits/operators/chr_0026_lastrite.json → skills[chr_0026_lastrite_ultimate_skill] → hits[slash] (frames 86, 105)
- **Kit has:** the ultimate's slashes with `atk_scale` and the talent-2 Cryo Susceptibility zone scale. Its sources cite b7b3 for the slashes, not b6aa.
- **Expected:** docs/accuracy-plan.md, b6aa section ("Left in b6aa"): "her 814k ultimate slash whose crit the log doesn't give (×1.55 the expected value)". Reference: combat-mechanics §1.4 (crit under `expected` mode, and that the log has some hits without crit data, §11 "Parser versions").
- **Why it may matter:** a ×1.55 on one slash is a crit-data or kit issue; the kit's expected damage cannot be trusted for that landing until it is known which. Size: about +55% on one ultimate slash in b6aa.
- **Evidence:** docs/accuracy-plan.md (b6aa "Left in b6aa" line, about line 530–532); fixtures/zmdlogs-b7b3762d5da8.json is the kit's own log (not re-read here).
- **Confidence it's a real problem:** low (the log lacks crit data; the kit may be right and the log wrong).
- **Verdict:** NOT A PROBLEM — b6aa t=45677, 814662, has `crit: null` (the log doesn't give its crit); `zmdlogs check` judges it a match (it is not in the mismatch list) and `--simulate` lands it. The ×1.55 over the expected value is the crit-or-not ambiguity of one hit, not a kit scale (slash_3 at frame 134, atk_scale2 8.0, matches SkillPatch and the data). The two normal slashes at 43781 (271554) are consistent with the kit.

### N1. One ultimate slash at 44298 mismatches by ×1.057 in b6aa
- **Where:** packages/data/kits/operators/chr_0026_lastrite.json → skills[chr_0026_lastrite_ultimate_skill] → hits[slash]
- **Kit has / log shows:** `zmdlogs check` fixtures/pending/zmdlogs-b6aa15281db4.json: the only Last Rite mismatch, t=44298 logged 271554, predicted 256864 / 513728 / 217443 ...; the slash at t=43781 logs the same 271554 and matches.
- **Verdict:** UNCERTAIN — same logged value 0.5 s apart while the engine's value moves, and the check lists "Corrosion within its range but at no level that fits ×3" for her; it looks like Corrosion step timing (open-problems, b6aa), not the kit's scale, which fits t=43781.
  - **Decides it (if UNCERTAIN):** the Corrosion level or ramp at 44.3 s in b6aa (the buff replay's Corrosion at the hit); if the engine's shred at 44298 is fixed and the hit still misses, re-read frames 86/105 of the ultimate.

## Checked, no conflict found
- Talent 1 (Hypothermia): crystal_up 0.02 / 0.04 and duration 15 match PotentialTalentEffectTable `chr_0026_lastrite_talent_1_1` / `_2`. The talent index mapping and the stacking key were not re-read.
- Battle skill SkillPatch values: atk_scale 3.2, atb 30 (P5 +5 through PotentialTalentEffectTable `chr_0026_lastrite_potential_5`, modifyType 1), duration 15, usp 16 (energy on the battle skill), cost 100 SP. SkillData `atk_up` default 0.2 (`chr_0026_lastrite_normal_skill`). P5's atk_scale ×1.2 is applied by the loader to the battle skill's own scale, so the Mirage's `atk_scale` picks it up without an extraScale in the kit.
- Combo: SkillPatch atk_scale 1.6 (shard), atk_scale2 1.6 (slash), atk_scale3 2.4 (bonus per stack), poise 15, usp 15, usp_base 40, count 3, cooldown 8 s. The combo's energy (40 + 15 × Cryo stacks) matches usp_base and usp. P3 ×1.15 on atk_scale, atk_scale2, atk_scale3 is in PotentialTalentEffectTable `chr_0026_lastrite_potential_3` and applies to the same keys.
- Ultimate: SkillPatch atk_scale 4.0, atk_scale2 8.0, poise1 5, poise2 10, usp 10, cooldown 20 s. ChannelingAction frames 86, 105 and 134 match the kit's frames and the two-part scale (`slash` 86/105, `slash_3` 134).
- Perfusion duration: 15 s (SkillPatch), matching the kit's `duration` key.

## Not checked
- Combo frames 13 (shard) and 63 (bonus and slash): the kit's values follow its own notes (verified on b7b3 per the kit); the frames were not re-read from SkillData in this pass.
- Basic attack frames and the dive / dash attacks (dash has no SkillData file, per the kit).
- Battle-skill beside, on-field and off-field timing (frames 32, 300, the 187 → 429 jump): not re-derived from SkillData.
- The Hypothermia priority key and stacking (`talent1_vul` priority `crystal_vul`): not compared with BuffData beyond the kit's note.
- Equipment (the weapon battle-skill buff at 38.8 s in b6aa, which the accuracy plan leaves open) not opened.
- Hold-out fixtures were not opened; the logs named above were not re-read beyond the accuracy-plan summaries.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2 · UNCERTAIN: N1
The Mirage is in b6aa (t=6141, 18659) at 1.95 scale, matching 3.2 × 0.5 × 1.2; the trigger's 'no log has them' note is stale. The ×1.55 slash is a no-crit-data hit that the check accepts.
