# Fluorite (chr_0022_bounda): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0022_bounda.json
(+ equipment kits reviewed: wpn_pistol_0001 Peco 5 (her default weapon), wpn_pistol_0002 Howling Guard,
wpn_pistol_0003 Long Road, suit_atk01 Aburrey's Legacy, suit_expend_spell01 Xiranflow, suit_generaltype
AIC Fieldwork). Reference: docs/combat-mechanics.md.
Name: the batch brief named this operator Catcher. CharacterTable `engName` and docs/glossary.md give
`chr_0022_bounda` = Fluorite (`meurs` is Catcher), so the heading uses Fluorite.

## Flags

No flags. In this pass the kit has no conflict with the reference or the game data that I could establish.
The open items it touches (tests 35 and 47, and the Slow question) are marked in the kit's notes. Test 59 (the
talent 2 chance, docs/in-game-tests.md) is not marked in the kit, but the kit's chance follows the data's value.

## Checked, no conflict found
- Hits and frames against SkillData: basic attacks (projectile hits; attack3's chain windows; attack4 at 29 and
  attack4_1 at 26 for the late input); attack3's SP as atb × 0.333 (controlled only); the finisher's breaking
  attack at frame 20 (multiplier 1) and the dive.
- Battle skill: the kick at cast frame 10 (LaunchProjectile to the projhit, SpawnAbilityEntity, a 3.1 s slow;
  duration 3.1 as the kit's note says); the explosion at frame 99 (entity frame 89), with Nature infliction,
  poise, and P3's slow `duration_potential` gated on `potential_lv` ≥ 3 (both the explosion and the detonation
  read `duration_potential` in the data). The explosion's damage mask 4352 includes the battle bit (256).
- Detonation: the ultimate's first landing on a stuck explosive detonates it (the kit's `ultimate_detonates`
  trigger, `frames [0]`). The kit reads the entity's JumpToAction (frames 0–89 → 149, gated on the ultimate's
  buff) as the detonation at the landing. The boom_up 0.3 is a ProdCalcZone (multiplicative) bonus, as §1.1
  gives for Fluorite's 30%.
- Ultimate: four shots keyed atk_scale1–4, with shot 4's "same element again on ≥ 2 stacks" branch (Nature
  first, then Cryo). Time stop and cantCastSkill frames as the kit's note.
- Combo: `atk_scale` hit with `infliction element event`, usp only with a target; the window's element as
  `event` (the SwitchAction on the combo entity's index, as the kit notes).
- Combo window: 2 or more Cryo or Nature stacks against the CharGrowthTable text.
- Element mapping for `unpredictable`: fire / pulse / cryst / natural are Heat / Electric / Cryo / Nature
  (damageType 2 / 3 / 4 / 6, as kit-abstractions gives).
- Talents: talent 1 dmg_up 0.1 / 0.2 on the Slow tag (`enemyControl: slow`, whole fight); talent 2 atk_up 0.1 / 0.2,
  duration 10 s, stackingType 4 (refreshed). Its chance is `probability` 0.2 on the talent skill, and P2's +0.1 is a
  skillBbModifier on that same skill, which the engine reads through the talent key (expr.ts `talentSource`).
- P5: `CD` 1 s and `reduce` 1 s on the Cryo / Nature infliction cooldown cut, at most once per second.
- P4: ultimate cost ×0.9 is the generic cost modifier, not a kit line.
- Equipment (usage only): wpn_pistol_0002's battle-hit trigger (mask 256) matches its data (no cooldown in the
  data's skill). wpn_pistol_0001 has no buffs or triggers (its toggle buff is an orphan, documented). suit_generaltype
  has no buffs or triggers (damage taken is not modelled, documented). Xiranflow's statusConsumed trigger is
  `by: self`, as its consumption scope is documented open.

## Not checked
- The ultimate's shot scale values (atk_scale1–4) and the battle skill's radius and explosion scale values against
  SkillPatch; only the keys and the structure were compared.
- The kick's projhit file and the slow's rate (move_speed_scalar) beyond the kit's note.
- Numbers of the equipment kits: wpn_pistol_0002 and wpn_pistol_0003 values, suit_atk01's per-skill ATK buffs,
  suit_expend_spell01's stack durations and max stacks. Only their triggers were read.
- wpn_claym_0013, wpn_funnel_0011 and wpn_pistol_0011: their sources cite her id in a note; not reviewed.
- Open items the kit cites (in-game tests 35 and 47, and its own F1–F3 notes), and docs/in-game-tests.md test 59
  (the talent 2 chance), which are unresolved in the docs.
- No Fluorite log was opened in this pass (fixtures/pending/zmdlogs-abfd4b7478ec.json is cited by the kit; not examined).
