# Yvonne (chr_0017_yvonne): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0017_yvonne.json
(+ equipment kits reviewed: wpn_pistol_0005 Navigator, wpn_pistol_0007 Home Longing, wpn_pistol_0008 Wedge).
Reference: docs/combat-mechanics.md.

## Flags

### F1. The battle skill's team energy at the bomb (frame 35) is missing from the kit; the engine grants it at the cast
- **Where:** kit `skills[normal_skill]`: no `teamEnergy`; `dataOverride.teamEnergy` = "Compiler limitation
  (as Estella's) ...". The batch-4 plan, docs/kit-batches/batch-4/chr_0017_yvonne.md row 11, says
  "Team energy (buff_common_obtain_ultimate_sp) at the bomb | supported | `teamEnergy: [{frame: 35,
  ratio: 1, detached: true}]`".
- **Kit has:** no team-energy entry. Because a `dataOverride.teamEnergy` exists, the loader skips
  deriving it from SkillData (packages/data/src/kits.ts, around line 1021). The engine then falls back
  to a grant at the cast for the whole team (packages/engine/src/timeline/casting.ts, around line 221,
  `skill.teamEnergy === undefined`).
- **Expected:** combat-mechanics §7.4: team energy comes at the frames of the skill's
  `buff_common_obtain_ultimate_sp` (`teamEnergy`). Per the kit's note, that buff sits in the projectile
  file chr_0017_yvonne_normal_skill_projhit.json at launch 35, behind a tag check on Yvonne's control state
  that the compiler leaves undecided (the projectile file does hold CheckBuffStackNumByTag conditions and
  ObtainCostAction grants). The batch-4 plan's value is frame 35, ratio 1, detached.
- **Why it may matter:** the bomb's team energy (0.065 per natural SP, 100 SP, so about 6.5 energy per
  team member) arrives at the cast instead of 35 frames later (about 1.17 s), and is no longer detached.
  This shifts the ultimate timing for the whole team after each bomb.
- **Evidence:** the kit JSON (skill `normal_skill`, no `teamEnergy`); the batch-4 report row 11 and its
  sample at around line 374; packages/data/src/kits.ts around lines 1021–1023; packages/engine/src/timeline/casting.ts around line 221.
- **Confidence it's a real problem:** medium (the kit contradicts its own plan; the code path read, not run).
- **Verdict:** (phase 3)

## Checked, no conflict found
- Hits, frames and scale keys against SkillData and SkillPatch at level 12: attack1–4 projectiles
  (launches 11 and 6/9/12; attack4 at 11), attack5 (channel 21–23, poise 17, atb 17), finisher (launches 8
  and hit 28 with BreakingAttack 0.1 / 0.9, atk 9), dive (1.8).
- Battle skill: bomb at 35, `atk_scale` 2.5 + (consumed ≥ 1: `atk_scale2` 1.5 + `atk_scale_layer` 2.0 × consumed).
  I traced `atk_scale_final` through the projectile's branches; it matches. The projectile's unit `atkScale`
  2.85 is an unused default (the multiplier is `atkCalculation.atkScale`). Energy `usp_base` 10 + `usp_layer` 30
  × consumed; poise 10; cost 100 SP.
- Combo: tick at 19, then 42 / 64 / 87 (`maxcnt` 4, interval 0.75, usp 10, usp_extra 10, cooldown 18 s).
  P1: ticks at 34–94, maxcnt 6, interval 0.5, usp_extra 25 (PotentialTalentEffectTable).
- Ultimate: `atk_scale1` 0.2 per shot, `atk_scale2` 3 and `atk_scale_extra` 6 on the end strike, poise 20,
  cost 220, cooldown 10 s, duration 7 s. Ultimate state layers: attr 9 (Critical Rate) +normal_dmg_up 0.03
  per layer, attr 10 (Critical DMG) +crit_rate_up 0.06 at 10 layers. The key names are odd, but
  attributes.ts confirms attr 9 = CriticalRate and attr 10 = CriticalDamageIncrease.
- Talents: talent 1 `dmg_up` 0 / 0.5; talent 2 `inflict_up` 0.1 / 0.2 and `status_up` 0.2 / 0.4; P3 +0.1 / +0.2
  on talent 0. P4 `atb_return` 10 gated on potential 4. P5 `atk_up` 0.1 and `crit_dmg_up` 0.3 on the
  ultimate (has_potential5). P2 Intellect +20 and Crit Rate +7% are stat-panel lines.
- Combo window (Final Strike on a Solidified enemy, controlled) against the CharGrowthTable text.
- The ultimate's timing: state creation at frame 61, RefrainObtainUsp over frames 0–61 (energyBlockSeconds
  61 frames), end-state cooldown set to 10 s, damage immunity 0–64.
- The P4 returned SP on the bomb (returned SP gives no energy, §7.3).
- Equipment: Navigator's reaction triggers (beforeDamage on Solidification / Corrosion) rest on test 51's
  question, and the kit notes say so. Home Longing's "every Cryo / Nature battle-skill hit" reading is
  documented as test 80. Wedge's reaction trigger (beforeDamage) is the same test-51 question.

## Not checked
- The `end_strike_ends_state` afterHits placement (row 26, documented open) and the Barrage / Link
  interaction (test 79, documented open): not re-derived.
- The combo entity's SP and energy path (abilityentity files) beyond the tick values above.
- BuffData values for freezing_point and talent_1_valid, and the exact frame-61 state creation.
- Equipment numbers: sk_wpn_pistol_0005 / 0007 / 0008 values and their buff durations were not checked
  against SkillPatch; only their triggers and buffs were read.
- No log fixture was opened for Yvonne in this pass (the batch-4 fixtures were not examined).
