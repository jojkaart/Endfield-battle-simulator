# Gilberta (chr_0013_aglina): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0013_aglina.json (+ equipment kits reviewed: none; the weapon wpn_funnel_0011 is only named in her combo note and was not opened). Reference: docs/combat-mechanics.md.

## Flags

### F1. Combo note says the forced Lift adds Lift Stagger
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → skills `chr_0013_aglina_combo_skill`, hit `hit`, `note` (the Lift part)
- **Kit has:** "the engine adds the Lift hit (logged buff_physical_airborne), +1 Vulnerable and Lift stagger." The hit's own Stagger is the combo's poise 5 (SkillPatch), which the kit does not change.
- **Expected:** docs/combat-mechanics.md §4 [SETTLED]: Lift and Knock Down "deal no Stagger of their own"; the log lists one Stagger event shared by the hit and its Lift. The engine agrees (packages/engine/src/timeline/actions.ts, comment at ~line 117: "Lift and Knock Down deal no Stagger of their own").
- **Why it may matter:** no damage value changes (the combo's 5 is its own hit's poise). The note would send phase 3 looking for an extra Stagger source that the engine and logs say is absent.
- **Evidence:** the note text above; combat-mechanics §4; actions.ts ~117.
- **Confidence it's a real problem:** low (wording only, probably stale)
- **Verdict:** (phase 3)

### F2. Dash attack left out on a reason the data doesn't support
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → `sources` (the last entry, "dash_attack isn't in her skill groups"); no skill entry. Data: Json/SkillData/chr_0013_aglina_dash_attack.json and chr_0013_aglina_dash_attack_projhit.json; TableCfg/SkillPatchTable.json key `chr_0013_aglina_dash_attack`.
- **Kit has:** "dash_attack isn't in her skill groups (no level source) and is left out."
- **Expected:** SkillPatchTable has level rows for `chr_0013_aglina_dash_attack` (levels 1–12; level 1: atk_scale 0.17, display 0.51, poise 5, atb 0). So a level source exists. The open question is only whether dash attacks are in her skill groups, which docs/kit-batches/batch-1/chr_0013_aglina.md (row 9) records as "unknown". The kit should say that, not "no level source".
- **Why it may matter:** if dash attacks are usable in rotations, a whole basic-attack family (with Stagger 5 at each level) is missing from her kit. The size is not checked here.
- **Evidence:** SkillPatchTable rows (read with a scratch script, not saved); docs/kit-batches/batch-1/chr_0013_aglina.md row 9.
- **Confidence it's a real problem:** medium that the stated reason is wrong; low-to-medium that the omission changes results (depends on skill groups).
- **Verdict:** (phase 3)

### F3. Finisher factors described as hand-written, but absent from the JSON
- **Where:** packages/data/kits/operators/chr_0013_aglina.json → `sources` entry 4 ("hand-written factors, D2: kit-draft drops the multiplier"); skills `chr_0013_aglina_power_attack`, hits `hit` and `final`.
- **Kit has:** no `factor` on either hit. The note on each hit states the multiplier (0.05 on six hits at frames 12–29; 0.7 at frame 43).
- **Expected:** the data's BreakingAttackCalculation multipliers (0.05 and 0.7, SkillData `chr_0013_aglina_power_attack.json`). The loader takes them from the data when a hit leaves `factor` out (packages/data/src/kits.ts `withDataFacts`). Checked by loading the kit through `loadKits`: the engine's hits carry `factor: 0.05` (×6) and `factor: 0.7`.
- **Why it may matter:** no number is wrong today. The sources line misdescribes how the factors are set, so phase 3 could wrongly "fix" them by hand or doubt them.
- **Evidence:** packages/data/kits/operators/chr_0013_aglina.json (no factor fields); packages/data/src/kits.ts ~line 909; SkillData `chr_0013_aglina_power_attack.json` (multiplier 0.05 at frames 12–29, 0.7 at 43).
- **Confidence it's a real problem:** low (stale note)
- **Verdict:** (phase 3)

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
