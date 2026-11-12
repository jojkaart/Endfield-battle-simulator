# Da Pan (chr_0018_dapan): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0018_dapan.json
(+ equipment kits reviewed: wpn_claym_0014 Ancient Canal, wpn_claym_0015 OBJ Heavy Burden;
the default weapon wpn_claym_0010 is stats only). Reference: docs/combat-mechanics.md.

## Flags

### F1. Talent 1 and Ancient Canal act on the combo's Crush hit before its damage, on an open question (test 51)
- **Where:** kit `triggers` → `reduce_and_thicken` (physicalStatus crush / breach, `beforeDamage: true`);
  packages/data/kits/equipment/wpn_claym_0014.json → `triggers` → `wpn_claym_0014.on_consume` (`beforeDamage: true`).
- **Kit has:** `beforeDamage: true` on both. The notes say the Vulnerable FinishBuff runs before the
  Crush's DamageAction and cite "in-game test 51, Da Pan part" as the evidence.
- **Expected:** combat-mechanics §8.4 lists "Ancient Canal and Da Pan's talent layers on his combo's own
  hit" among the effects put on the same hit "because the data creates them first", tagged **[OPEN]**
  (test 51; 10–25% on those hits). §8.4 allows `beforeDamage` "only where the data creates the buff before
  the DamageAction", so the kit's choice follows the data's order, but the game's answer is still open.
  docs/in-game-tests.md test 51 says the Ancient Canal / Da Pan case is still open ("Partly answered").
- **Why it may matter:** the combo's own hit and any Crush or Breach that consumes stacks carry up to
  +24% Physical DMG from talent 1 (4 stacks × 0.06 at talent level 2) and Ancient Canal's bonus
  (0.56 at 4 stacks, level 9). If the game applies them only from the next hit, those hits are 10–25%
  too high in the engine (test 51's own estimate).
- **Evidence:** docs/combat-mechanics.md §8.4 "Test 51's findings" and §11; docs/in-game-tests.md test 51
  (Da Pan paragraph); the two kit trigger notes above.
- **Confidence it's a real problem:** medium (the engine's default is unproven, not known wrong).
- **Verdict:** UNCERTAIN — the kit follows the data's order (the Vulnerable FinishBuff before the Crush DamageAction) and says so; §8.4 tags the game's answer [OPEN] (test 51). The one Da Pan log, fixtures/multi-target/zmdlogs-10df8c76ccda.json, can't decide it: at t=160427 the combo (logged 16730) and its Crush (buff_physical_do_crushed, logged 37974) both mismatch under every reading (the Crush's highest candidate is 33904, so logged is ×1.12 above even the best one), and the whole fight carries a ×1.25 / ×0.96 pattern shared with Pogranichnik's hits (ratio 1.2494 at t=5649), i.e. a fight-wide cause not specific to Da Pan. Note the log leans the opposite way to the flag's worry (logged above predicted, not below).
  - **Decides it (if UNCERTAIN):** in-game test 51's Da Pan part (does the combo's own Crush hit show the talent 1 / Ancient Canal bonus), or a single-enemy Da Pan log with the 1.25 cause explained.

### F2. Prep Ingredients' 40% cooldown cut uses a reading that test 36 leaves open
- **Where:** kit `triggers` → `prep_cut` → `do[0]`: cooldown fraction `product [-1, talent_1_cd_reduce]`
  on skills `combo`.
- **Kit has:** "'Shortens cooldown by 40%' read as 40% of the full cooldown (in-game test 36, Da Pan part)".
- **Expected:** combat-mechanics §7.5: "Cuts 'by a percentage' (of the total, or of what's left): [OPEN]
  (test 36)". Test 36 is unanswered; its Da Pan part gives about 11.4 s ready time for 40% of the full
  cooldown and about 11.7 s for 40% of what's left (docs/in-game-tests.md test 36).
- **Why it may matter:** the two readings differ by about 0.3 s on the combo's next ready time. Small effect.
- **Evidence:** docs/combat-mechanics.md §7.5; docs/in-game-tests.md test 36; combo cooldown 19 s at level 12
  (SkillPatchTable chr_0018_dapan_combo_skill).
- **Confidence it's a real problem:** low (the kit names the reading and the test).
- **Verdict:** UNCERTAIN — the kit names the reading (40% of the full cooldown) and the test (36); the two readings differ by about 0.3 s of the combo's ready time (11.4 s vs 11.7 s), so any error is small. No log measures a combo cooldown reduction here.
  - **Decides it (if UNCERTAIN):** in-game test 36, Da Pan part (the combo's ready time after Prep Ingredients).

### F3. Potential 1 (kill-triggered buff on the ultimate) is not modelled
- **Where:** kit `sources[1]` ("Not modelled: P1 ..."); no buff or trigger for buff_chr_0018_dapan_potential_1.
- **Kit has:** the omission, documented as deferred (batch 3, N2), with the note that its buff "would be a
  kill trigger on the ultimate's frames 0–89".
- **Expected:** PotentialTalentEffectTable `chr_0018_dapan_potential_1` on chr_0018_dapan_ultimate_skill:
  `potential_1_dmg_up` 0.3 and `potential_1_duration` 15 (the buff's own modifier was not opened).
  No combat-mechanics rule covers it.
- **Why it may matter:** +0.3 dmg_up on the ultimate's landings for 15 s after a kill. Matters only in
  fights where the ultimate kills; large in multi-enemy fights, rare against bosses.
- **Evidence:** PotentialTalentEffectTable entry above; kit `sources[1]`.
- **Confidence it's a real problem:** medium that the effect is missing; low on the size of its impact.
- **Verdict:** NOT A PROBLEM — the effect is real in the data (PotentialTalentEffectTable chr_0018_dapan_potential_1: `potential_1_dmg_up` 0.3, `potential_1_duration` 15 on the ultimate; the ultimate's EventListenerAction 0–89 on ability event 222 creates buff_chr_0018_dapan_potential_1), but it needs a kill event, which the engine has no way to express (no kill trigger in packages/engine or data), and the simulator fights one enemy: an ultimate that kills the only enemy ends the fight, so the 15 s buff has nothing to act on. The kit documents the omission (`sources[1]`, batch 3 N2). It would become real only with multi-enemy scenarios (then +30% ultimate damage for 15 s after a kill, on a kill that left other enemies).

## Checked, no conflict found
- Hits, frames and scale keys against SkillData damage units: attack1–3 (landings at f13, f7, f10 and f23),
  Final Strike attack4 (f32, mask 2097280, poise 20, atb 21 as SkillPatch gives), finisher frames 16 and 35
  with BreakingAttack multipliers 0.4 and 0.6, dive landing, battle skill charge (f8, `atk_scale_pre`) and
  flip (f43, `atk_scale`, a damageAttributeType 1 unit with poise 10), combo Crush at f23 (`crush_multi` 1.2
  at level 12, usp 10, cooldown 19 s).
- Ultimate: forced Lift at f0 (AirborneAction, no landing there); six flurry landings from ChannelingAction
  42–64 at targetTriggerInterval 0.13 s and maxCountPerTarget 8; dunk at f80 with forced Knock Down and
  `atk_scale_end`; no poise unit on the flurry or the dunk.
- The battle skill's 1 s InterruptAction (immobilizedTime 1) and the flip's non-forced Lift (adds a stack
  on an enemy without Vulnerable, §4).
- Level-12 blackboard values for the keys the kit uses (atk scales, usp, poise, atb, crush_multi).
- Talent 1 (dmg_up 0.04 / 0.06, stack 4, duration 10, stackingType 8) and talent 2 (talent_1 1 / 2, stack
  1 / 2 and +1 / +10 at P2) against PotentialTalentEffectTable and the buff file.
- P5: 45 s interval and the extra Vulnerable on the battle skill (0 below P5); test 74 order noted.
- Combo window: 4 Vulnerable stacks against the CharGrowthTable text; test 64 is cited as interim.
- Final Strike Stagger controlled-only (onlyEnableForMainChar) against §5.
- Equipment wpn_claym_0015: the Knock Down / Weakness triggers and their "non-forced Knock Down adds a
  stack only" note match §4 and test 39 (cited as open).
- Equipment wpn_claym_0014: the trigger shape (Crush and Breach consume Vulnerable, `count` = stacks consumed)
  matches §4 and §2.2. Its beforeDamage is F1.

## Not checked
- BuffData of prep_cut's cd_reduce buff and of prep_ingredients; the order inside buff_physical_do_crushed
  (I relied on the kit's note for that).
- Numbers of the equipment skills: sk_wpn_claym_0014 (phy_dmg_up_mult 0.14 at level 9), sk_wpn_claym_0015
  (def_up 0.504 at level 9), buff_wpn_claym_0015's duration and stacking.
- Ultimate energy cost (90, costType 0) and cooldown (15 s): the kit does not carry them.
- No log fixture for Da Pan was opened in this pass.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F3 · UNCERTAIN: F1, F2
Log check, for context: fixtures/multi-target/zmdlogs-10df8c76ccda.json is the only Da Pan log (not mentioned in docs/open-problems.md): Da Pan 58 of 117 hits match (20 plain, 11 assumed, 27 log-listing fallback), 59 mismatch; mismatch ratios cluster at ×1.25, ×1.625 and ×0.96 and Pogranichnik's hits in the same fight mismatch by the same ×1.25, so the cause is fight-wide (a multi-target / buff question), not Da Pan's kit.
N1. **Da Pan's only log mismatches half its hits and has no open-problems entry.**
- **Where:** fixtures/multi-target/zmdlogs-10df8c76ccda.json; `node packages/cli/src/main.ts zmdlogs check` on it.
- **Evidence:** 59 of 117 mismatch; ×1.2500 on attack1–4, battle skill, ultimate flurry and airborne at t=2824–37326 and 170289–179828 (Pogranichnik ×1.2494 at t=5649, same fight), ×1.625 at t=25263–33766 (1.25 × 1.3), ×0.9614 elsewhere; the combo Crush at t=160427 ×1.12 above the highest reading.
- **Verdict:** UNCERTAIN — a ×1.25 shared with another operator points at a fight-wide factor (unlogged enemy buff, Endministrator's `originium_crystals` is listed among the assumed items, or a weakness / susceptibility the engine doesn't see), not Da Pan's kit.
  - **Decides it (if UNCERTAIN):** a diagnosis of that fixture's ×1.25 (check whether `originium_crystals` / susceptibility explains it), recorded in docs/open-problems.md.
