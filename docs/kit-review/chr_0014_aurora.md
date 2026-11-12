# Aurora (chr_0014_aurora): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0014_aurora.json (+ equipment kits reviewed: none). Reference: docs/combat-mechanics.md.

## Flags

### F1. Snow Zone's forced Solidification uses the engine's level-1 duration, which the reference marks OPEN
- **Where:** packages/data/kits/operators/chr_0014_aurora.json → skills → chr_0014_aurora_ultimate_skill → hit `snow_zone_solidify` (`frames: [126]`, `applies: forcedReaction solidification, level 1, extraSeconds: extra_duration`).
- **Kit has:** "a level-1 Solidification for its table duration", with P3 adding 2 s through `extra_duration`. The kit gives no number and no OPEN note.
- **Expected:** docs/combat-mechanics.md §3.6: "The engine's durations are 5.75 / 6.75 / 7.75 / 8.75 s by level (Talos). The native settings say 6 / 7 / 8 / 9 s. [OPEN] (accuracy plan B4, test 71; the code and the docs disagree)." Level 1 is therefore 5.75 s in the engine and 6 s in the native settings.
- **Why it may matter:** the Solidified state ends 0.25 s apart between the two readings at level 1 (and at P3, the same gap). That decides whether a later physical status or Vulnerable on that enemy shatters it (Shatter: 120% + 120% × level physical, §3.6). Only the window matters, not the damage of the Snow Zone itself, which the kit says is unchanged.
- **Evidence:** the kit hit above; docs/combat-mechanics.md §3.6; the Solidification duration table is in the engine (not reopened here). Test 71 and accuracy plan B4 are the cited open questions.
- **Confidence it's a real problem:** low
- **Verdict:** UNCERTAIN — The kit uses the engine's table (packages/engine/src/status.ts line 87: 5.75 s at level 1) and the flag correctly notes the reference's [OPEN] (§3.6; test 71 part 2 times the icon, 5.75 s vs 6 s). The gap is 0.25 s of Solidified window, with no damage in the Snow Zone itself affected; no Aurora logs exist, and a shared engine value, not a kit choice, is in question (the kit already passes the level and `extraSeconds`).
  - **Decides it (if UNCERTAIN):** test 71 part 2 (stopwatch the Solidification icon after a level-1 application: about 5.75 s vs 6 s), or a log with a level-1 Solidification and a later Shatter just inside the 0.25 s window. The fix, if the native 6 s wins, belongs in status.ts, not Aurora's kit.

## Checked, no conflict found

- Battle skill: ObtainCostAction costType 1 `atb_return_base` at frame 0 with atbGainMethod 1 (returned); team energy `buff_common_obtain_ultimate_sp` at 0 (ratio 0.5). Consistent.
- Counter path: the jump from 0-51 to 107 and the delayed actions moved forward to 107 match the kit's description. The DamageAction at frame 107 (literal scale 0.01, mask 4352) is disabled in SkillData (`isEnable: false`), so the kit is right to omit it.
- Retaliation bash: SpellInfliction Cryo (inflictionType 2) at 125 before the DamageAction at 125 (`atk_scale`, mask 4352, poise unit). Matches. The P5 returned SP is an ObtainCostAction before the hit (SkillPatchTable's `potential_5_atb` 10 from chr_0014_aurora_potential_5). Matches.
- Talent 2 energy: chr_0014_aurora_talent_2_1 and _2_2 set talent_2_sup to 6 and 10. Matches.
- Protection durations: AuraAction 0-51 plus `reduce_damage_remain` 0.5 s (2.2 s); counter aura 107-125 plus 0.5 s (1.1 s). Matches the kit's arithmetic.
- Snow Zone ticks: `buff_chr_0014_aurora_ultimate_skill_dmg` has duration 5 s, triggerInterval 0.5 s and waitFirstTriggerInterval, so ticks run from 66 + 15k, giving 81 to 216 (ten ticks, the tenth at the 5 s end). The kit's frame list (81, 96, 111, 141 to 216) plus the solidify tick at 126 matches.
- Frost buff: duration 5 s, triggerInterval 2 s (waitFirst), maxTriggerCnt 1, first tick at 126. Matches the kit's tick at 126.
- Potential 3 (chr_0014_aurora_potential_3): ultimate extra_duration +2. Matches.
- The `buff_chr_0014_aurora_ultimate_skill_limit` (forst_allow_count 2) is created by nothing in the checkout; batch-3 row 35 already records this, so no flag.
- Base values: L12 ultimate atk_scale 4.5, atk_scale_loop 0.65 (SkillPatchTable), in line with the kit's keys.

## Not checked

- The combo's window and its trigger (CharGrowthTable's "drops below 60% HP"): the kit's interim note (G2) covers it; not evaluated here.
- The counter trigger's `CheckDamageDecorateMask` pass-through is the kit's ASSUMED reading (as for Catcher); not evaluated.
- Protection's damage-taken effect (attribute 63) is not modelled by the kit or the engine per the kit's note; not evaluated.
- The ultimate's TakeDownAction and InterruptAction on the target, the frost's slow-down on small enemies, and P2's radius were not evaluated (the kit lists them as not modelled).
- Logs: not opened; log facts were read from the kit and batch-3 docs only. Hold-out fixtures were not touched.
- Equipment: none reviewed in this pass.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: none · UNCERTAIN: F1
F1 (uncertain): engine-wide Solidification duration (0.25 s); the kit is correct whichever wins.
