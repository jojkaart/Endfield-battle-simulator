# Akekuri (chr_0019_karin): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0019_karin.json (+ equipment kits reviewed: none; not part of this pass). Reference: docs/combat-mechanics.md.

Method: the kit compared with `efsim kit-draft chr_0019_karin` (compiled from SkillData), SkillPatchTable level-12 values, PotentialTalentEffectTable and BuffData rows, and the engine's `attributes.ts` (attribute 41 is INT).

## Flags

### F1. Her SP is natural in the data, but the engine counts it as returned, so it gives the team no energy
- **Where:** packages/data/kits/operators/chr_0019_karin.json → sources paragraph 4 ("the engine counts all kit SP as returned (open item V3), so her SP gives no team energy when spent"); SP triggers `combo_sp_1`, `combo_sp_2`, `ult_sp_1`–`ult_sp_3` (no kind written; the loader takes it from the data).
- **Kit has:** the note that every ObtainCostAction costType 1 of hers has atbGainMethod 0 (natural), with the interim reading that all of her SP is returned.
- **Expected:** docs/combat-mechanics.md §7.3: natural SP (atbGainMethod 0) gives ultimate energy when spent; returned SP (method 1) gives none. [DATA] (resources.ts `gainSp`). §7.4: 0.065 energy per natural SP a teammate spends on a battle skill ([ASSUMED] rate).
- **Why it may matter:** her SP never feeds the team's energy in the engine. Her combo gives about 7.5 × factor SP per landing (two landings per cast, 7.5 at talent 0; SkillPatch L12 atb 7.5), and her ultimate gives 26 + 27 + 27 = 80 SP at level 12. Each SP a teammate later spends on a battle skill should add 0.065 energy. The size is not computed here.
- **Evidence:** packages/data/kits/operators/chr_0019_karin.json (above); SkillData chr_0019_karin_ultimate_skill and chr_0019_karin_combo_skill (ObtainCostAction costType 1, atbGainMethod 0, atbSourceType 3); docs/kit-batches/batch-2/chr_0019_karin.md G3 and O18 ("interim as proposed: all kit SP is returned"); docs/kit-batches/batch-2.md V3. The batch file's K5 says "Done: SP grants take their kind from the data (atbGainMethod)", which doesn't match the kit's interim note; that is the reason for the flag.
- **Confidence it's a real problem:** medium (documented as open, so the question is whether V3 is still open or K5 has closed the energy part).
- **Verdict:** (phase 3)

## Checked, no conflict found
- Hit frames and counts: basic attacks 1–3 (frames 9, 8/16, 10), attack 4 (frames 19, 20 non-Final, 21 Final Strike; atk_scale 0.37 × 3 = display 1.11), dive (frame 1), battle skill (frame 20, Heat infliction, `poise` 10), combo (frames 22 and 31, usp 5, `poise` 5, cooldown 9). The finisher's frames 13 and 36 match.
- Finisher multipliers: the draft emits factor 0.2 (frame 13) and 0.8 (frame 36) on `atk_scale` 9.0 at level 12, which sums to 1.0 as the BreakingAttackCalculation says. The kit's sources call those multipliers "hand-written", but the compiler emits them and the loader takes `factor` from SkillData (kit-trim's list). That sources sentence is stale; I found no damage conflict.
- Combo SP formula: data ops match the kit (sub_ratio ÷ rate, atb_up = 1 + INT × sub_ratio/rate, max_ratio + 1, atb × min(atb_up, max_ratio)). Talent 1 values (sub_ratio 0.01 / 0.015, max_ratio 0.5 / 0.75, rate 10) match PotentialTalentEffectTable. Both combo grants read the already-scaled atb in the data, so the kit's two equal formulas give the same total.
- Ultimate SP at level 12: atb_1 26, atb_2 27, atb_3 27 (SkillPatch), matching the kit's `ult_sp_*`. Its duration key is 10 s, which matches the kit's Link duration.
- Potentials: P1 buff_chr_0019_karin_potential_1 (atk_up 0.1, duration 10, max_stack 5), P3 team ATK set to 0.1 with the flag set to 1, P5 tail `potential_5_duration` 5, talent 2 sets combo = 1 and imbue_scale 0.2. All match the kit.
- Stacking: P1's layer buff is stackingType 8 (shared timer, as the kit's note says).
- Kit buff durations that differ from the data (talent 2 and P3 lifeType 1 with autoFinishByAction) are marked with dataOverride, as the process requires.

## Not checked
- P4 (ultimate cost ×0.9 through paramType 1) isn't written in the kit's sources. The cost belongs to the engine (reference §7.4), so no kit change is expected, but it should be confirmed in phase 3.
- No log exists for Akekuri (the kit says so), so the kit is not verified against a fixture.
- The Link rule (kit's `zone_link` as a Link stack or a fixed imbue; the in-game test U2) and the P5 tail's interaction with the 10 s cap are documented as open and were not judged.
- Equipment kits and weapons were not reviewed.
