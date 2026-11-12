# Pogranichnik (chr_0029_pograni): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0029_pograni.json
(no equipment kit reviewed: the kit has no equipment references). Reference: docs/combat-mechanics.md.

## Flags

### F1. Basic attacks 2, 3 and 4 have one hit each; SkillData has 2, 2 and 6 landings
- **Where:** packages/data/kits/operators/chr_0029_pograni.json → skills `chr_0029_pograni_attack2` (hit `hit`), `chr_0029_pograni_attack3` (hit `hit`), `chr_0029_pograni_attack4` (hit `hit`)
- **Kit has:** one `atk_scale` hit per chain step, no frames. The attack4 note says the factors are "the SkillData coefficients kit-draft reads".
- **Expected:** SkillData (basic kind, mask 128) has: `chr_0029_pograni_attack2.json` atk_scale at frames 7–13 and 14–20; `chr_0029_pograni_attack3.json` at 9–10 and 15–16; `chr_0029_pograni_attack4.json` six DamageActions at 3–4, 5–6, 7–8, 11–12, 13–14, 15–16 (each with a poise unit). Reference §7.2: a chain step's hits are its own landings; the kit must list them.
- **Why it may matter:** most of the basic-chain damage and the Stagger of the chains (about 2–6 landings per chain use). Size: the missing landings are a large share of the chain's damage.
- **Evidence:** `jq` over each file's timelineActions (damageUnits per timeline item); compare with attack1 (one landing, one hit in the kit) and Tangtang's chains (one kit hit per landing).
- **Confidence it's a real problem:** high that the landing counts differ. Medium that it is an error rather than a compiler fold; the kit has no `count` or `frames` that would cover the extra landings.
- **Verdict:** NOT A PROBLEM — the loaded kit has attack2 count 2 frames [7, 14], attack3 count 2 frames [9, 15], attack4 count 6 frames [3, 5, 7, 11, 13, 15]: exactly the data's landings (the compiler fills count and frames; the kit just doesn't spell them).

### F2. Stagger units are not on the kit's hit fields for several landings
- **Where:** packages/data/kits/operators/chr_0029_pograni.json → hits `hit` of `chr_0029_pograni_attack3`/`attack4`/`attack5`, `hit` and `hit_2` of `chr_0029_pograni_normal_skill`, the four `combo_skill` hits, `chr_0029_pograni_ultimate_skill` (hit `hit`, the rush)
- **Kit has:** `poise` on the Decisive Assault hits only (`poise_final`, in the `oath_final_*` triggers). Elsewhere the poise is in notes only (attack5: "deals {poise} Stagger ... only for the controlled operator"; the rush note: "poise_rush").
- **Expected:** SkillData damage units of damageAttributeType 1 on the same landings: attack3 and attack4 (a poise unit on each landing), attack5 (controlled-only, mask 2097280), the battle skill (poise 2.0 on frames 28 and 38), the combo (poise units at frames 26, 40, 64 and 226, 240, 264, 426, 440, 626), the rush (poise_rush at 76–82). Reference §5: "It comes only from damage units of damageAttributeType 1 ... Final Strikes' Stagger counts only while their operator is controlled."
- **Why it may matter:** Stagger progress, Stagger nodes and the finisher windows for every chain and combo. Batch-4 item G3a and the batch-4 table's "3 KNOWN entries" say the compiled landings still keep some poise apart from their hits. Whether `foldPoise` (packages/data/src/kitMatch.ts) folds the mixed-action units was not checked.
- **Evidence:** `grep -n poise` on the kit (only `poise_final` appears on fields); SkillData damageUnits; packages/data/src/kitMatch.ts lines 113–129; docs/kit-batches/batch-4.md D6.
- **Confidence it's a real problem:** medium (the compiler may fold them; the kit's own fields do not show it)
- **Verdict:** NOT A PROBLEM — the loaded kit has poise on attack5 ("poise", controlled-only), battle skill `hit` and `hit_2` ("poise"), all four combo hits (poise1/poise3/poise4) and the rush ("poise_rush"). Attack3 and attack4 have poise units, but their blackboard `poise` is 0.0 (SkillData chr_0029_pograni_attack3/attack4 blackboard), so they deal no Stagger.

### F3. Battle skill second hit: scale key and literal value differ between the kit and SkillData
- **Where:** packages/data/kits/operators/chr_0029_pograni.json → skills `chr_0029_pograni_normal_skill`, hit `hit_2` (scale `atk_scale2`, `applies` Breach)
- **Kit has:** `hit` with `atk_scale` and `hit_2` with `atk_scale2`, Breach applied before the hit's damage, no frames on either hit.
- **Expected:** SkillData `chr_0029_pograni_normal_skill.json`: DamageActions at frames 28–29 and 38–39 (both mask 4352). The unit at 38–39 (the Breach landing, with a FractureAction before it) uses `atkScale` with `useBlackboardKey: false` and literal value 2.0 (the 28–29 unit: same). The blackboard keys `atk_scale` (0.6) and `atk_scale2` (0.0 and 1.2) exist in the file.
- **Why it may matter:** if the Breach landing takes its multiplier from the literal 2.0 and not from `atk_scale2` (1.2 at its level), the hit's damage is off by a large factor; the kit gives no frame either, so its timing rests on the default.
- **Evidence:** `jq` on the DamageAction units at timeline starts 28 and 38 (sc 78 and 88); blackboard values in the file's `blackboard` entries.
- **Confidence it's a real problem:** low-medium (the literal may be the compiled value of the `atk_scale` key at this level; not verified against the compiled skill)
- **Verdict:** NOT A PROBLEM — the hit's `atkScale` field (literal 2.0, useBlackboardKey false) is the unused one; the used scale is the unit's `atkCalculation` (AtkScaleCalculation): atk_scale at frame 28 and atk_scale2 at frame 38 (SkillData chr_0029_pograni_normal_skill.json). The kit's `hit_2` = atk_scale2 agrees, with no dataOverride, so the loader's check passes; tests/kit-pogranichnik.test.ts asserts 1.92 / 2.38.

### F4. Finisher entities finish1–3 carry an ultimate-kind hit that the kit does not list
- **Where:** packages/data/kits/operators/chr_0029_pograni.json → triggers `oath_final_status_self` / `oath_final_combo` (the `decisive_assault` hit on `_finish4`)
- **Kit has:** the Decisive Assault from `_finish4` only, with the note "at their frame 25 CheckTimedMarker ultimate_finalhit lets only the first deal damage".
- **Expected:** SkillData `chr_0029_pograni_ultimate_skill_abilityentity_finish1.json`, `_finish2.json`, `_finish3.json` each have an ultimate-kind DamageAction (`atk_scale`, mask 512) at frames 9–13. The kit does not mention these hits.
- **Why it may matter:** possible extra ultimate-kind hits per Decisive Assault (three of four Shieldguards), if the marker does not gate them. Size unknown.
- **Evidence:** `jq` damage summary of the four `_finish*` files; the kit's `oath_final_status_self` note.
- **Confidence it's a real problem:** low (the marker may gate those hits; the kit's note is partial)
- **Verdict:** NOT A PROBLEM — chr_0029_pograni_ultimate_skill_abilityentity_finish1/2/3 are not spawned by any file in Json (grep: referenced only by themselves; they carry atk_scale 1.0 and atb 10, not the ultimate's atk_scale_trigger/final keys). The live entities are attack2 (harass) and finish4 (Decisive Assault), both in the kit.

## Checked, no conflict found
- Finisher: landings at frames 7, 14 and 25 (mask 132) match the kit's `power_attack` hits.
- Dive attack: mask 1152 (basic + dive), one hit, matching `plunging_attack_end`.
- Harass hits from the Shieldguard entity: `atk_scale_trigger` (mask 512) at frame 9 of each path, matching `oath_harass_*` `frames [9]`.
- Decisive Assault from `_finish4`: `atk_scale_final` at frame 25 (mask 4608) with `poise_final`, matching `oath_final_*`.
- Combo sequence keys: the three sequences of four landings (atk_scale, atk_scale2, atk_scale3/4) match the four combo hits' keys; the combo's `calc_atb_n` SP grants follow the ordering of the frames.
- Breach consumption and the battle-skill SP trigger (`battle_sp`) follow §4 (Breach consumes all stacks; 50% + 50% × n) and §7.3 (returned SP per consumed stack).
- Combo window opener (`physicalStatus` crush/breach, by anyone) matches the CharGrowthTable text quoted in the kit (reference §4: Crush and Breach give no Stagger of their own).
- Ultimate rush (`atk_scale_rush`, mask 4608, frames 76–82) and the Banner's timing (SpawnAbilityEntity at 74, state at 77) match the ultimate's data frames.

## Not checked
- Numeric values (scales, SP, poise, potentials, talent values, cooldowns, ultimate cost and energy): keys and structure only.
- The Steel Oath stack logic (the count-by-count triggers, `steel_oath` amounts) and the `fervent_morale` talent stacks against BuffData; not traced.
- Basic-attack launch and frame values for attacks 1–4 (the kit has none; SkillData timelines not traced).
- Log fixtures: only the kit's citations; no fixture was opened (the hold-out fixtures were excluded).
- Equipment kits: none referenced by this operator's kit.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2, F3, F4 · UNCERTAIN: none
The flags read the raw JSON; the loaded kit fills count, frames and poise from SkillData. No log fixture for this operator outside the hold-out.
