# Catcher (chr_0020_meurs): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0020_meurs.json
(+ equipment kits reviewed: none referenced; her default weapon wpn_claym_0010 is stats only).
Reference: docs/combat-mechanics.md.
Name: the batch brief named this operator Xaihi. CharacterTable `engName` and docs/glossary.md give
`chr_0020_meurs` = Catcher (`seraph` is Xaihi), so the heading uses Catcher.

## Flags

### F1. Her counter path frees her at a time that rests on an open question (test 61, MarkCanInterrupt)
- **Where:** kit `skills[normal_skill]` note and `sources[1]` (the counter's JumpToAction 60; the skill's
  InterruptCurSkillAction at 194 "ends the counter path"; the unattacked jump 45 → 255 and exclusive frame 285);
  kit `triggers` → `counter` (on `attacked`, jump to 60).
- **Kit has:** the frames above, taken from SkillData. Nothing about the mark (the frame at which she can act
  again), test 61, or the open question.
- **Expected:** combat-mechanics §7.1: "MarkCanInterrupt: [OPEN] (test 61)". docs/in-game-tests.md test 61
  names Catcher's counter among the cases where a skill may free its operator at a mark: "Catcher's counter
  too (batch 2). If the game doesn't free them there, these rotations are too fast in the engine."
- **Why it may matter:** the counter path is her only route to the battle skill's bash and P5 SP, and it sets
  when her next action can start. If the game frees her later, the engine's rotations for her are too fast.
- **Evidence:** docs/combat-mechanics.md §7.1; docs/in-game-tests.md test 61 (the Catcher paragraph at around
  line 1104); the kit notes above.
- **Confidence it's a real problem:** medium (the kit rests on the engine's reading of the mark, which the
  test is meant to settle; the kit does not say so).
- **Verdict:** UNCERTAIN — the kit's frames come from SkillData (JumpToAction 60, InterruptCurSkillAction 194) and the open question is the engine's reading of the mark (§7.1 test 61), which the docs already tag [OPEN]. Her log has no counter-path timing to test it (the fight's casts don't separate it from the check's tolerances).
  - **Decides it (if UNCERTAIN):** in-game test 61, Catcher's paragraph: time from the counter to the first accepted input.

### F2. P1 strike reads DEF, but food DEF% is an open question (test 98)
- **Where:** kit `triggers` → `p1_strike` → `hits[0].base` = `dmg_base + attr 3 × def_scale` (300 + 5 × DEF).
  The talent `resilient_defense` also adds DEF (attr 3), so its DEF feeds the same term.
- **Kit has:** the formula with no caveat about food DEF%.
- **Expected:** combat-mechanics §1.5: "A food's 'DEF +x%' uses formula item 1, whose formula isn't known. It is
  kept out of DEF, and readers of DEF refuse it. [OPEN] (test 98)". docs/journal.md (around lines 1108–1112)
  records that the DEF foods are refused "where DEF is read (kit values, Catcher's P1 strike)".
- **Why it may matter:** with a DEF food worn, the P1 strike's base is refused rather than computed, so the
  P1 strike is either missing or wrong for that build. The size is 5 × the DEF change from the food.
- **Evidence:** docs/combat-mechanics.md §1.5; docs/journal.md around lines 1108–1112; kit `p1_strike` note.
- **Confidence it's a real problem:** medium (the build-specific gap is real; the kit does not mention it).
- **Verdict:** UNCERTAIN — a documented, deliberate refusal (combat-mechanics §1.5, journal 1108–1112): with a DEF +x% food worn, the P1 strike is refused rather than computed wrongly, and 8 foods are affected. The kit is not wrong; the formula item 1 is unknown. No log wears a DEF food (the Catcher log's gear gives DEF 160 with no food and its P1 hits are ×1.0274, see F3), and the size is 5 × the DEF change.
  - **Decides it (if UNCERTAIN):** in-game test 98 (Bottled Milk: DEF 140 → 167 or unchanged).

### F3. The only Catcher log (04d401ad257e, pending) matches none of her 252 hits, with no entry in open-problems
- **Where:** fixtures/pending/zmdlogs-04d401ad257e.json (eny_0125_fdcentur, level 90; Catcher at level 80,
  potential 5, weapon wpn_claym_0015 at level 90 with skill levels [3, 2, 3]; four gear pieces, two of them
  the same item_equip_t4_suit_phy01_edc_02). Run with `node packages/cli/src/main.ts zmdlogs check`; the
  output is saved at /tmp/claude-0/-home-user-Endfield-battle-simulator/cfb486ef-c396-564d-b928-8b0d87099e4f/scratchpad/kr6/check04d4.txt.
- **Kit has:** nothing for this log. Her Physical hits are not otherwise checked against logs.
- **Expected:** logged damage close to predicted. Same fight: Ember fits at about ×1.02 and Snowshine at about
  ×0.96 (their build-offset lines), and Purrchena, also Physical, matches 203 of 251 hits. Catcher matches none
  of her 252 judged hits. Her mismatch ratios run from about 0.36 to 0.67 (median 0.47), basic attacks included.
- **Why it may matter:** this is her only log. Purrchena's Physical hits fit, so a plain physical-resistance
  cause for the enemy is unlikely. The spread is not one constant factor either. The candidates sit in her own
  build or gear: weapon wpn_claym_0015 (level 90, skill levels [3, 2, 3]), the two identical suit_phy01 pieces
  (combat-mechanics §9 lists fixture 04d4 as the open duplicate-piece question, where "the duplicate fits neither
  one copy nor two"), or her level (80, where a build offset would be about ×0.94, not ×0.47). Not identified
  here, and the kit's hit data is not implicated by what was checked.
- **Evidence:** the check output above; docs/journal.md around line 1045 ("Pending 04d401ad257e Catcher
  mismatch 243 → 252 (unmodelled 9 → 0)"); docs/combat-mechanics.md §9. No entry for this fixture in
  docs/open-problems.md (grep found none for Catcher).
- **Confidence it's a real problem:** medium that the engine's Catcher prediction is wrong for this log; low
  that the cause is in the kit. Cause not identified.
- **Verdict:** NOT A PROBLEM — not the kit: the cause is a build input the export omits, the weapon level. The check's ratio is a near-constant 0.470 (0.4697–0.4706) across every ATK-based skill (basics, combo, ultimate, shockwave), i.e. no kit scale key, frame or hit is off; and the DEF-based P1 strike (`buff_chr_0020_meurs_potential_1`) already sits at ×1.0274, which a weapon can't change. Re-running the check on a copy of the fixture (fixtures/pending/zmdlogs-04d401ad257e.json with only Catcher's `weapon.level` changed; scratch files in the scratchpad kv6/) gives the median basic-hit ratio: weapon level 90 → 0.470, 80 → 0.501, 60 → 0.576, 40 → 0.677, 20 → 0.821, **1 → 1.0265** (±0.001, all skills). Her weapon wpn_claym_0015 (5-star) is logged with skill levels [3, 2, 3]; the break-through bounds (555me WeaponBreakThroughTemplateTable weapon_breakthrough_456star_C_2) allow skill levels [3, 2, 3] at stages 0–3 (level ≤ 79) but not stage 4, so level 90 is excluded by the log's own skill levels (stage 0 bounds are 3/3/4, which [3, 2, 3] fits). At level 1 the weapon's ATK is far below the level-90 411 (panel ATK not printed for that run). The gear as modelled (4 phy01 pieces, the duplicate counted twice) fits with it: a run with no gear at all gives ×1.23 instead, so the duplicate piece is not what breaks this log (it stays [OPEN] in §9 for 9555). What remains is ×1.026–1.027, equal to the P1 strike's ×1.0274 and close to Ember's ×1.0226 in the same fight, so it is a fight-wide factor (enemy eny_0125 side), not Catcher's.
  - **Fix (if REAL):** none for the kit. For the fixture: set Catcher's weapon level to about 1 (the minimum) in fixtures/pending/zmdlogs-04d401ad257e.json with a provenance note, and look into the fight-wide ×1.023–1.027 (Ember ×1.0226, Catcher ×1.0265, P1 ×1.0274; Purrchena's level-84 fit may have absorbed it). With these, her hits (all skills) would fit to within about 0.1%, which also makes this log a verification of her hit data (scale keys, frames, P1 formula).
- Also add to docs/open-problems.md: weapon level of the Catcher log, and the shared ×1.026.

## Checked, no conflict found
- Hits, frames and scale keys against SkillData and SkillPatch (level 12): attack1–4 (attack4 mask 2097280,
  poise 22, atb 25 as SkillPatch gives); finisher at 15 and 35 (BreakingAttack 0.4 / 0.6); dive.
- Battle skill: bash at f83 (`atk_scale` 4, poise 20 at level 12), returned SP 30 at the cast (`atb_return_base`,
  atbGainMethod 1), P5 10 returned SP while shielded (`potential5_atb`). Team energy at frames 0 and 60 (ratio 0.5
  each, per the kit's note) is not in the kit; with no override, the loader derives it from SkillData.
  `taken_dmg` 0.9 is the key Protection reads (the kit's `protection` buff).
- Combo: hits at f17 and f20 (`atk_scale` 0.55 and `atk_scale_1` 2.25 at level 12), usp 10, poise 10.
- Ultimate: hits at f46 (`atk_scale` 2), f64 (`atk_scale_1` 2.7) and f85 (`atk_scale_2` 4), with the Knock Down
  at f85 not forced (force false), as the kit says. Weakness: `weak_scale` 0.3 and `weak_duration` 8 on the first hit.
- Shockwaves: talent 2 at 105 / 120 (talent ≥ 1) and 135 (talent ≥ 2), `atk_scale_shockwave` 0.3 / 0.45
  (PotentialTalentEffectTable talent_2_1 / 2_2).
- P1 strike: `dmg_base` 300 and `def_scale` 5, damageType none (no skill-type bonus, §2.1), triggers on the
  battle and ultimate landings (mask 768, which includes the shockwaves).
- P5 potential5_atb 10; P3 potential3_duration 5; talent 1 `rate` 1.0 / 1.2 with floor(Will / 10).
- Protection (attr 63) and Weakness (attr 62) kept as buff categories, with damage taken not modelled (§1.1).
- Combo window: an enemy's charge, against the CharGrowthTable text (the HP half is documented N1).
- Counter's `attacked` trigger (the frame-60 jump) matches the listener's frames 0–60 in the kit notes.

## Not checked
- The shockwave entity's own DamageAction scale calculation (the kit's `atk_scale_shockwave` mapping was read,
  not re-derived from the entity file).
- The counter's frame-60 team energy (its path inside the jump) and the frame-60 time dilation (layer 1, 0.7 s;
  documented as not modelled).
- combo_shield (shield points) and the teammate shield: documented as not modelled.
- Potential 4's cost ×0.9 and the combo's cooldown (33 s at level 12): taken from the engine's generic handling,
  not checked here.
- No other Catcher log was opened; the only one available to this pass is 04d401ad257e (F3).

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F3 · UNCERTAIN: F1, F2
F3 resolved: the log's weapon level is not 90 (the importer's assumption); at level ~1 every ATK-based Catcher hit fits ×1.0265 with spread under 0.1%, so her kit's scale keys, frames and the P1 strike (×1.0274 independent of the weapon) are consistent with the data. The leftover ×1.026 is shared with Ember (×1.0226) in the same fight and looks fight-wide.
N1. **The Catcher log's weapon level and the shared ×1.026 are not in docs/open-problems.md.**
- **Where:** fixtures/pending/zmdlogs-04d401ad257e.json, `team[3].weapon.level` (90, assumed by the importer).
- **Evidence:** the weapon-level scan under F3; check output "build offset: Catcher's hits ×1.0267 the engine's" at weapon level 1.
- **Verdict:** REAL (fixture, not kit) — the fixture's assumed weapon level misleads the check; a note and the level change would turn 252 mismatches into a ×1.027 offset, shared with the other operators' ×1.02.
  - **Fix (if REAL):** edit the fixture's Catcher weapon level to 1 with a provenance note (as for Purrchena's 84), and record the ×1.026 in docs/open-problems.md.
