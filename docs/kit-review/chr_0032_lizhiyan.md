# Arcane (chr_0032_lizhiyan): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0032_lizhiyan.json (+ equipment kits reviewed: none; not part of this pass). Reference: docs/combat-mechanics.md.

Method: the kit compared with `efsim kit-draft chr_0032_lizhiyan` (compiled from SkillData), SkillPatchTable level-12 values, PotentialTalentEffectTable and BuffData rows.

## Flags

None. Nothing I checked conflicts with the reference or the game data. The kit documents its open points (the window opened by a reaction (test 35), the Gloompurge Arcana length (test 32), the slow-down of Imprisonment (Ti1b, tests 18 and 37), the P5 cooldown meaning (V7, test 36), and the INT battle skill's ×2.23 in one log). They were not judged.

## Checked, no conflict found
- Finisher: the five BreakingAttackCalculation objects are 0.1 four times and 0.5 once, and the kit's landings (7, 10, 13, 32, 34 at 0.1; 36 at 0.5) total 1.0 of atk_scale. The kit says the 32/34 pair shares one action and needs verifying; that is documented.
- Ultimate: `duration` 20 s (the array) and `duration2` 15 s (the forced Corrosion) match SkillData; `energyBlockSeconds` 1.567 is frame 47 / 30.
- Imprisonment: INT = duration_pre 0.633 + duration 4.0 = 4.633 s; WILL = 0.633 + duration_will 6.0 (SkillPatch L12) = 6.633 s. Both match the kit's note.
- Potential 1: atk_scale_touch multiplied by 1.3 (multiply), as the kit says.
- Talent 1: enhance_rate +0.16 on the Arts Amp; it is applied only when the talent level is above 0 (the kit's guard).
- Battle skill: team energy at frame 20, in line with the note.
- Cluster Strike: the kit's energy (`percentOfMax` 0.5, then 1 on the second strike) and the array's 2-strike rule match the listener design described in the kit's sources.
- The forced Corrosion (level 1, duration2 15 s) matches reference §3.5's 15 s duration.

## Not checked
- The laser frames of the ultimate's entities (15/19/23/27 and 12/16/20/24) were not compared with the SkillData entity timelines, only with the kit's note.
- Gloompurge Arcana's 10 s length (the kit uses ChangeSkillAction with a literal 10; test 32 is open).
- No log was re-run for this review. The kit's own verifications (btl_upload_b7b3762d5da8 and others) were taken at face value, and the hold-out fixtures were not opened.
- Equipment kits and weapons were not reviewed.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: N2, N3, N4, N5, N6 · UNCERTAIN: N1, N7
Phase 2 had no flags; phase 3 re-read the kit against SkillData, BuffData, SkillPatchTable (all 12 levels) and PotentialTalentEffectTable, and ran every non-hold-out fixture that has her (`zmdlogs check` verdicts per hit). No REAL flag. Of her hits in the single-target fixtures, most match plain or assumed (for example 012a 116 plain of 155, 9555 148 of 168, 3aa6 112 of 186, e989 66 of 75, bdf2 51 of 59; all hits of b7b3 (13), 0eef (4) and dbae (4) match). The mismatch clusters are the INT lasers (N7), Gloompurge Arcana (`ultimate_skill2` 11915 at 78.9 s in 0206, 13195 at 27.6 s in b74c, multi-target logs whose replay already misplaces other hits) and the multi-target logs generally. Checked and found consistent with the data, in addition to phase 2's list: the WILL branch of the combo skill (rate_final = min(spell_vul_per_will × Will, max_spell_vul_will) + rate_pre, both modes assign it to `spell_vulnerable_pre` with duration_vul = the seal's duration; the Nature and Cryo subtypes 3 and 5 are the only enabled ones), the touch's infliction (only when `EntityBB_wisd_greater_will` < 1, a four-way switch on `EntityBB_consumed_type`, which only `seal_total` reads, so it can only be set natively), the mode selector (`passive`: CompareDeckAttr compare 3 = ≥, success sets wisd_greater_will 1 = INT), the ultimate's laser values (`atk_scale_laser` and `atk_scale_laser_will` are equal at all 12 levels, and both of the abilityrange aura's buffInput entries feed the same key; 8 lasers × 0.45 at L12 = the 360% description), `atk_scale` 14.4 / `atk_scale_will` 3.6 on ult 2 with P5's ×1.3 on `atk_scale` only, the INT early-end laser frames (the finisher buff's four lasers 3 frames apart and the final 6 frames after, as the kit's +43/46/49/52/58), the combo's P1 ×1.3 on touch, boom, laser1 and laser2 (generic skill-value ops), talent 2 (`duration_add` applies only when the collected buff's duration is above 0; `final_corrupt_rate` = 1 + corrupt_rate on max_def_decrease; P3 adds +5 s and +0.2), P2 (INT +15, WILL +15, Arts Intensity +16: attributes only), P4 (×0.85 on both ultimates: generic).

### N1. Talent 1's paramType 4 half (INT combo, −6) is loaded as "other"
- **Where:** packages/data/src/tables/potentials.ts (`SKILL_PARAMS` has only 1 cost and 2 cooldown); PotentialTalentEffectTable `chr_0032_lizhiyan_talent_1_1` and `_1_2` each carry a paramType 2 (−6, combo, `lizhiyan_wisd`) and a paramType 4 (−6, combo, `lizhiyan_wisd`) skillParamModifier. No other operator has paramType 4 (13 rows use type 2, 31 type 1).
- **Kit has:** the INT −6 s cooldown (type 2, applied by the loader with the activeCondition); nothing for type 4. The kit sources and batch-1 (R11) record it as undecoded.
- **Check:** the data never says what type 4 changes. The combo's cooldown is 20 / 19 / 18 s (L1–8 / 9–11 / 12); if type 4 were a second cooldown cut, INT would have 18 − 12 = 6 s at L12 instead of 12 s. In d9e59d0fb737 (the only INT log) the two logged "combo casts" (9483 and 13829 ms) are 4.3 s apart, but the second is the early end's `seal_again` entity logged under the combo's id (its lasers land at 13829 ms), so the log says nothing about the cooldown.
- **Verdict:** UNCERTAIN — the effect is real in the data and the engine ignores it. If it is a further cooldown cut it changes how often an INT Arcane can cast her combo (a rotation question, up to 2× more combos); if it is something else (a cooldown after an interrupt, an initial cooldown) it changes nothing.
  - **Decides it:** an in-game timing of an INT Arcane with talent 1: cast the combo, wait it out and time the cooldown (test 13's INT counterpart): 12 s means type 4 does nothing to the cooldown, 6 s or between means it stacks. Also useful: a log with two real INT combo casts more than 6 s apart.

### N2. Attack 5's Stagger: the kit note says 10, the data has 17
- **Where:** kit skill `chr_0032_lizhiyan_attack5`, hit note "Stagger `poise` (10) too".
- **Check:** SkillPatchTable L12 `chr_0032_lizhiyan_attack5` has `poise` 17.0 (and `atb` 17.0); the loaded hit has `"poise": "poise", "poiseControlledOnly": true`, so the engine reads 17. The 10 in the note is the battle skill's / ultimate's value.
- **Verdict:** NOT A PROBLEM — the engine uses the data; only the note is wrong.

### N3. `cd_reduce` (7 / 3 s) in the combo's buffs
- **Check:** `cd_reduce` is in the blackboards of the combo skill (0), `seal_again` (3), `spell_vulnerable` (7) and `seal_finisher` / `seal_finisher_wisd` (7) and is assigned down that chain, but no action in any of those files has a cooldown, skill-cooldown or reduce type (types counted), and no key string refers to it besides the assignments; SkillPatch has no `cd_reduce`. It is left over from an earlier design.
- **Verdict:** NOT A PROBLEM — nothing consumes it, so the kit is right not to model a cooldown cut at the INT early end.

### N4. The SP kind of `atb_return_wisd` is right by the engine's fallback
- **Check:** the ObtainCostAction for `atb_return_wisd` is in `buff_…_seal2` and `buff_…_seal_bunshin_end_listener`, both atbGainMethod 1 (returned), not in a skill file, so `spKindsOf` has no entry for it; `spGrantOf` then falls back to returned, which is what the data says.
- **Verdict:** NOT A PROBLEM — correct today. (A kit-written `spKind: "returned"` on the two `sp` actions would make it independent of the fallback.)

### N5. There is no kit test file for Arcane
- **Check:** tests/ has kit-*.test.ts for 28 operators; none for chr_0032 (or Typhoeus). Her kit appears in tests/snapshots/kits.json, in the log-verdict snapshots (8 and 50 entries) and in other operators' tests (kit-ardelia, kit-zhuangfy, stats, logcasts), but nothing asserts her mode switch, Imprisonment durations, early end, Cluster Strike or the `window` infliction directly.
- **Verdict:** NOT A PROBLEM for any number today (the snapshots pin her hits in the logs); a coverage gap against "keep tests up to date": a mode regression (INT/WILL tie, `window`) would show only as a changed snapshot.

### N6. Cluster Strike lasers use `atk_scale_laser` in both modes
- **Check:** see the summary: the abilityrange has two auras whose buffInput assigns `atk_scale_laser` from `atk_scale_laser_will` (WILL) or `atk_scale_laser` (INT); the two are equal at every level (0.20 to 0.45).
- **Verdict:** NOT A PROBLEM — no difference at any level.

### N7. INT early-end lasers and the other INT hits run low in the two INT logs
- **Where:** kit triggers `int_early_end` / `explosion` and the INT hits; fixtures/pending/zmdlogs-a7a7a40c97ed.json (P5, INT, 14 `seal_finisher_wisd` hits at 23.4–56.5 s) and fixtures/pending/zmdlogs-d9e59d0fb737.json (P0, INT).
- **Check:** a7a7: the early-end lasers are under-predicted by about 1.26 (23.4 s) and about 1.65 = 1.5 × 1.10 (49–56 s, where the crit flag is unknown, so the nearest candidate is a crit); the final laser to laser ratio in the log is 4.33 = atk_scale_laser2 / atk_scale_laser1, so the kit's two keys and its +43/46/49/52/58 timing are right. d9e5: every Arcane hit after her ultimate is ×1.116 to ×1.150 of the prediction (battle skill, touch, boom, all lasers), one common factor. Both are under a forced or reaction Corrosion whose ramp the replay doesn't value yet (open-problems "Corrosion"), and a7a7's engine had no landing for the lasers (they are matched through kit-hit variants).
- **Verdict:** UNCERTAIN — a uniform factor on every hit of one window points to a shared zone (Corrosion, the Amp or an unlisted Susceptibility), not to the INT trigger; the kit's own numbers (laser ratio, frames) are confirmed. I could not tell the Corrosion explanation from a missing INT-only effect with the tools here.
  - **Decides it:** an INT log without a forced Corrosion in the window (an INT ultimate used when the enemy already has none, or Corrosion level known), or `zmdlogs scales` on d9e5's hits against the replay's Corrosion level; test 34 (lasers after the natural end) for the unlogged part.

