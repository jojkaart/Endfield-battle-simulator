# Gilberta (chr_0013_aglina): kit review

Reviewed: 2026-11-12 (phase 2 flags; phase 3 verdicts 2026-11-12). Kit: packages/data/kits/operators/chr_0013_aglina.json (+ equipment kits reviewed: none; the weapon wpn_funnel_0011 is only named in her combo note and was not opened). Reference: docs/combat-mechanics.md.

## Flags

### F1. Combo note says the forced Lift adds Lift Stagger
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → skills `chr_0013_aglina_combo_skill`, hit `hit`, `note` (the Lift part)
- **Kit has:** "the engine adds the Lift hit (logged buff_physical_airborne), +1 Vulnerable and Lift stagger." The hit's own Stagger is the combo's poise 5 (SkillPatch), which the kit does not change.
- **Expected:** docs/combat-mechanics.md §4 [SETTLED]: Lift and Knock Down "deal no Stagger of their own"; the log lists one Stagger event shared by the hit and its Lift. The engine agrees (packages/engine/src/timeline/actions.ts, comment at ~line 117: "Lift and Knock Down deal no Stagger of their own").
- **Why it may matter:** no damage value changes (the combo's 5 is its own hit's poise). The note would send phase 3 looking for an extra Stagger source that the engine and logs say is absent.
- **Evidence:** the note text above; combat-mechanics §4; actions.ts ~117.
- **Confidence it's a real problem:** low (wording only, probably stale)
- **Verdict:** NOT A PROBLEM — wording only. The engine gives a forced Lift no Stagger of its own (packages/engine/src/timeline/actions.ts ~108-114, docs/combat-mechanics.md §4 "They deal no Stagger of their own", SETTLED); the kit's `poise` 5 on the hit is the combo's own, and nothing in the loaded kit adds a Lift Stagger. The note's "+1 Vulnerable and Lift stagger" should read "+1 Vulnerable" (the Lift hit's Stagger is shared with the combo's). No number depends on it: Gilberta's combos with their Lifts match plain in fixtures/zmdlogs-4e5e1390085e.json (59/59), fixtures/pending/zmdlogs-a27bc3527682.json (66/66) and zmdlogs-489c0be3e162.json (0 mismatches).

### F2. Dash attack left out on a reason the data doesn't support
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → `sources` (the last entry, "dash_attack isn't in her skill groups"); no skill entry. Data: Json/SkillData/chr_0013_aglina_dash_attack.json and chr_0013_aglina_dash_attack_projhit.json; TableCfg/SkillPatchTable.json key `chr_0013_aglina_dash_attack`.
- **Kit has:** "dash_attack isn't in her skill groups (no level source) and is left out."
- **Expected:** SkillPatchTable has level rows for `chr_0013_aglina_dash_attack` (levels 1–12; level 1: atk_scale 0.17, display 0.51, poise 5, atb 0). So a level source exists. The open question is only whether dash attacks are in her skill groups, which docs/kit-batches/batch-1/chr_0013_aglina.md (row 9) records as "unknown". The kit should say that, not "no level source".
- **Why it may matter:** if dash attacks are usable in rotations, a whole basic-attack family (with Stagger 5 at each level) is missing from her kit. The size is not checked here.
- **Evidence:** SkillPatchTable rows (read with a scratch script, not saved); docs/kit-batches/batch-1/chr_0013_aglina.md row 9.
- **Confidence it's a real problem:** medium that the stated reason is wrong; low-to-medium that the omission changes results (depends on skill groups).
- **Verdict:** NOT A PROBLEM — the kit's stated reason is wrong, but the omission changes nothing. SkillPatchTable does have `chr_0013_aglina_dash_attack` rows (level 1: atk_scale 0.17, poise 5, atb 0), so "no level source" is false. But dash attacks are left out of every kit: docs/design.md ("Not modelled: ... the dash attack"), and the Ember and Seraph kits say "dash attacks aren't modelled (S5, deferred)". No non-hold-out fixture contains a `dash_attack` event, so no log can test it; rotations don't schedule one. Suggested wording: "dash_attack not modelled (S5, deferred); whether it is in her skill groups is unknown".

### F3. Finisher factors described as hand-written, but absent from the JSON
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → `sources` entry 4 ("hand-written factors, D2: kit-draft drops the multiplier"); skills `chr_0013_aglina_power_attack`, hits `hit` and `final`.
- **Kit has:** no `factor` on either hit. The note on each hit states the multiplier (0.05 on six hits at frames 12–29; 0.7 at frame 43).
- **Expected:** the data's BreakingAttackCalculation multipliers (0.05 and 0.7, SkillData `chr_0013_aglina_power_attack.json`). The loader takes them from the data when a hit leaves `factor` out (packages/data/src/kits.ts `withDataFacts`). Checked by loading the kit through `loadKits`: the engine's hits carry `factor: 0.05` (×6) and `factor: 0.7`.
- **Why it may matter:** no number is wrong today. The sources line misdescribes how the factors are set, so phase 3 could wrongly "fix" them by hand or doubt them.
- **Evidence:** packages/data/kits/operators/chr_0013_aglina.json (no factor fields); packages/data/src/kits.ts ~line 909; SkillData `chr_0013_aglina_power_attack.json` (multiplier 0.05 at frames 12–29, 0.7 at 43).
- **Confidence it's a real problem:** low (stale note)
- **Verdict:** NOT A PROBLEM — stale wording, numbers are right. SkillData chr_0013_aglina_power_attack.json has seven enabled DamageActions with BreakingAttackCalculation multipliers 0.05 at frames 12, 15, 18, 21, 24, 29 and 0.7 at frame 43 (sum 1.0), and `withDataFacts` in packages/data/src/kits.ts fills `factor` from the data when the kit leaves it out; the loaded kit carries 0.05 ×6 and 0.7. The sources entry should say "factors come from the data (kit-trim)".

## Checked, no conflict found
- Basic attacks 1–4: hit keys (`atk_scale`), projectile files and launch frames (attack4: launches at 23, 25, 27; the side-orb file gets count 2), elements, damage decorate masks (attack4 centre 2097280, Final Strike), Stagger split (0.34 / 0.33 / 0.33 of 16) and controlled-only gating (the orb ObtainCost sits in an IfElse on CheckMainCharacterCondition). SP coefficients: attack3 0.333333, attack4 orbs 0.3334. attack1 and attack2 have no `sp` in the kit; their atb is 0 in SkillPatchTable, so nothing is lost.
- Battle skill: four pulls at 29 / 46 / 62 / 78 (`atk_scale_pull` 0.55 at level 12), explosion at 108 (`atk_scale_explosion` 1.30 at level 12), Nature infliction (SpellInfliction type 3) listed before the explosion's damage, so applied before damage (§3.2, default); poise 10 on the explosion only; SP cost 100 (costType 1). Team-energy buff at frame 29.
- Combo: forced Lift (AirborneAction forceAirborne, frame 48), usp 10 (SkillPatch), cooldown 20 s (19 at level 12), poise 5, the COMBO TRIGGER text ("When an Arts Reaction is applied to an enemy") against the `combo_window` trigger.
- Ultimate: `atk_scale` 7.5 at level 12, Nature infliction at frame 60 before damage, cost 90, duration 5 s (SkillPatch; the SkillData default of 6 is not used), spell_vulnerable_rate 0.30 and perstack 0.10 at level 12. The P2 expression (2 × min(n+1, 4) inside the perstack term) matches the CompareFloat / BuffStack chain in BuffData `buff_chr_0013_aglina_ultimate_skill.json`; the P2 reading itself is in-game test 12, as the kit says. The susceptibility is applied after the hit (the kit's `buffs` without beforeDamage); the aura's buff is created at the hit.
- Potentials: P1 (radius, not modelled, stated in the kit), P2 (above), P3 (talent_0 `add` +0.05), P4 (ultimate cost ×0.85, skillParamModifier paramType 1), P5 (combo cooldown −2 and combo `atk_scale` ×1.3, both in PotentialTalentEffectTable and applied by the data loader; `potentials.ts` names "Gilberta P5 combo −2"). The kit does not mention P5, and the engine does apply it from the table. The P5 buffs (`buff_chr_0013_aglina_potential_5*`) are not created by any skill; the P5 skill file has no actions. The kit's orphan list (plan row 37) is consistent with this.
- Talent 1 (Messenger's Song): add 0.04 / 0.07 (PotentialTalentEffectTable `chr_0013_aglina_talent_1_1/_2`), `talentAtLeast [0,1]`, profession bits 49 = Guard, Supporter, Caster; she is profession 4 (Supporter), so she gets it.
- The kit loads through `loadKits` without disagreements from the matcher (hits, frames, keys, factors, SP, poise, energy block).
- Log: fixtures/zmdlogs-40d9a3c1da37.json and fixtures/zmdlogs-4e5e1390085e.json are the ones the kit cites; I read the kit's claims about them but did not rerun the checks.

## Not checked
- The ultimate field's Slow, the combo's "nearby enemies", talent 2's heals, the P2 reading (test 12), and the Lifted-persists-until-the-field-ends text: all listed in the kit as not modelled or open; not evaluated here.
- Logs other than the two the kit cites. Multi-target fixtures with Gilberta (fixtures/multi-target/zmdlogs-4f7eb04ec5b5.json, zmdlogs-b74c8f31a39f.json, zmdlogs-c516ec177a9d.json) and pending ones (for example zmdlogs-489c0be3e162.json, zmdlogs-9a8097fcf351.json) were not run through `zmdlogs check`.
- Phase-2 scope only; hold-out fixtures were not opened.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2, F3, N2 · UNCERTAIN: N1

Logs (`zmdlogs check`, hold-outs excluded): Gilberta matches 59/59 in 4e5e1390085e, 66/66 in pending/a27bc3527682, 171/173 in d5720d9ceb94 (the 2 misses are ×0.992 on attack3 and attack4_projhit_2), 92/110 in 489c0be3e162 (0 mismatches, 18 under unmodelled Corrosion), 10/10 in 40d9a3c1da37. Her basic attacks, battle skill, combo, ultimate and Arts Susceptibility (including the P0 n=2 and P2 n=0 readings) are therefore settled by logs. The remaining Gilberta mismatches are in fixtures with Corrosion windows or multi-target replays that over-predict (9a80, 3f78, d9e5, 4f7e, b74c): not evidence against the kit.

### N1. Finisher: the one log of it shows five small hits, the data has six
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → skill `chr_0013_aglina_power_attack`, hit `hit` (frames 12, 15, 18, 21, 24, 29; source entry 4).
- **Kit has:** six small hits (0.05 each) and the 0.7 last hit; the kit's own source says the scratch log btl_upload_576da29ffa7a logged "2510 ×5 and 35135 ... with five small hits against the data's six".
- **Expected:** the data (checked above) has six enabled 0.05 hits; six plus 0.7 sum to exactly 1.0, as Ember's 0.1 + 0.9 do, which favours six.
- **Why it may matter:** if only five land in the game, the kit's finisher is 5% too high (0.05 of 1.0). One log, not committed; the missing hit could be a log or import gap.
- **Evidence:** the kit's source entry 4; SkillData power_attack timelineActions[2..8]. No committed fixture has a Gilberta finisher.
- **Confidence it's a real problem:** low
- **Verdict:** UNCERTAIN — only an uncommitted log says five.
  - **Decides it (if UNCERTAIN):** commit a log with a Gilberta finisher (two casts if possible) and compare the number of ~0.05 hits per cast; or an in-game finisher where the damage numbers can be counted.

### N2. Her Lift hits sit about 1.2–1.8% off in 9a80 and 3f78
- **Where:** `buff_physical_airborne` hits of her combo: pending/zmdlogs-9a8097fcf351.json t=2814 (×1.0123) and pending/zmdlogs-3f78ceb15bc3.json t=3181 (×1.0138) and 47937 (×1.0182).
- **Verdict:** NOT A PROBLEM — in 9a80 the same instant shows Rossi's attack3 off by the same ×1.0125 (logged 1271 vs 1255) and the gear proc on the Lift by ×1.0124, so the offset is on every Physical hit then (enemy or Corrosion state), not on Lift or the kit; her Lifts match plain in 4e5e, a27b, 489c and d5720.
