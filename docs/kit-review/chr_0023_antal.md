# Antal (chr_0023_antal): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0023_antal.json
(+ equipment kits reviewed: none; signature weapon and gear not opened). Reference: docs/combat-mechanics.md.

## Flags

### F1. Battle skill landing carries a second ATK-scaled damage unit the kit omits
- **Where:** packages/data/kits/operators/chr_0023_antal.json → skills[chr_0023_antal_normal_skill] → hits[hit] (scale `atk_scale`, frame 20 from the data)
- **Kit has:** one hit, `scale: ["atk_scale"]`, no literal component. Its note says "Battle skill hit: `atk_scale` 2.0 at frame 20, mask 4352; ... one hit" (batch plan row 7).
- **Expected:** Json/SkillData/chr_0023_antal_normal_skill.json, the DamageAction at frame 20 has two damage units:
  - unit 1: `AtkScaleCalculation`, damageAttributeType 0, mask 4352, atkScale literal **2.85** (`useBlackboardKey: false`);
  - unit 2: damageAttributeType 1 (the stagger unit), `atk_scale` key (SkillData default 4.0; SkillPatch level 12 gives 2.0), `simpleCalculation: true`, poise key `poise` (absent from SkillPatch, so 0).

  Reference: combat-mechanics §1.3 (a hit's multiplier is the product of its blackboard keys and literal factors, from the DamageAction) and §2.2 (decorate mask 4352 is battle). The kit's single `atk_scale` hit matches only the stagger unit's key.
- **Why it may matter:** if unit 1 deals damage, every battle-skill landing carries an extra 2.85 ATK-scale on top of the kit's 2.0 (about +140% of the kit's per-landing scale), which changes the battle-skill damage in every rotation with Antal. If unit 2 is the only damage unit, the kit is right and the literal unit is a shield or a non-damage part that the kit should say so. Size depends on how the engine reads an attribute-1 unit that also has an ATK key.
- **Evidence:** Json/SkillData/chr_0023_antal_normal_skill.json (frame 20 DamageAction, both units, read with jq on `actionGroupData.timelineActions`); TableCfg/SkillPatchTable.json `chr_0023_antal_normal_skill` L12 (atk_scale 2.0, duration 60, rate 0.10, cost 100 SP; no poise). The batch-2 plan docs/kit-batches/batch-2/chr_0023_antal.md does not mention 2.85 anywhere (grep finds nothing).
- **Confidence it's a real problem:** medium
- **Verdict:** (phase 3)

### F2. The kit says no committed log has Antal; two committed fixtures do
- **Where:** packages/data/kits/operators/chr_0023_antal.json → sources[6] ("Not verified against a log: no committed fixture has Antal ... U1–U4")
- **Kit has:** that statement, and U1–U4 as open unknowns for in-game tests only.
- **Expected:** fixtures/multi-target/zmdlogs-3440cf450fea.json and fixtures/multi-target/zmdlogs-0206142f9134.json both contain `chr_0023_antal` (754 mentions in one of them, including his combo and attack projectiles). docs/accuracy-plan.md also names an "antal-focus" pair in its per-fight examples (+2.2%, +37.4%). Reference: combat-mechanics §11 (log quirks) and the kit's own "Unknowns" list, which could be partly answered by these logs.
- **Why it may matter:** U1–U4 (combo windows from physical statuses and reactions, Electric/Heat Amp carrying the Amp tag, P5's +4% holding) and the combo and Focus behaviour may already be settled or contradicted by these logs, so the kit's "not verified" status is out of date. Size: not measured.
- **Evidence:** `grep -rl chr_0023_antal fixtures` (excluding the hold-out ids); docs/accuracy-plan.md examples list (around lines 103 and 196).
- **Confidence it's a real problem:** high that the kit's statement is stale; medium that it hides a mismatch.
- **Verdict:** (phase 3)

## Checked, no conflict found
- Battle skill: frame 20 DamageAction after the Focus CreateBuff (kit's `beforeDamage` on `focus` and `focus_p5_timer`); mask 4352; cost 100 SP; SkillPatch duration 60 and rate 0.10 match the buff's duration and Susceptibility rate.
- Combo: DamageAction at frame 21 with mask 12288 and `atk_scale` (SkillPatch 3.4, literal 2.5 default); the stagger unit (poise key `poise`, 10) and the ObtainCostAction usp 10 at 21 are read from the data by the loader when the kit hit omits them (packages/data/src/kits.ts `withDataFacts`), so their absence from the JSON is not a conflict. SkillPatch cooldown 24 s and usp 10 match the batch plan.
- Combo `applies` order: SwitchAction at 21 before the DamageAction, as the kit's `applies` (event element, event status) describe.
- Ultimate: CreateBuff at frame 49, duration 12 s and rate 0.20 (SkillPatch), team target, Electric and Heat Amp (pulse / fire).
- Talent 1: cd 30 s (PotentialTalentEffectTable `chr_0023_antal_talent_1_1/_2`). The Amp tag gate and the heal's trigger were not re-read.
- Talent 2: probability 0.30 (PotentialTalentEffectTable `chr_0023_antal_talent_2_1/_2`, BuffData `probability` default 1.0 overridden).
- Basic attack 4 SkillPatch values (atk_scale 1.15, poise 15, atb 15) and basic attack 3 atk_scale 0.77 match the kit's sources line; the kit's frames (27 for attack 4, 14/18 for attack 3) were not re-read from SkillData.

## Not checked
- Basic attack 3 and 4 frames and branches (the have_recovered marker, the two launches at 27) were not re-read from SkillData; only SkillPatch values were.
- Projectile hit frames for attacks 1–4 and the finisher (`*_projhit`), and the dive attack.
- The P5 Focus bonus chain (`focus_p5_timer`, `focus_p5`, `p5_reset`) and its U3 assumption: BuffData not opened.
- Combo window triggers (`combo_infliction`, `combo_physical`) against the game's combo-trigger text beyond the kit's own quote; open tests 35 and 63 are the kit's own.
- Logs: no committed fixture has Antal (kit's own note); docs/accuracy-plan.md, open-problems.md and in-game-tests.md were not searched for Antal.
- Hold-out fixtures were not opened.
