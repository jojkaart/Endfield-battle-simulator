# Endministrator (chr_0003_endminf): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0003_endminf.json (covers both playable IDs, chr_0002_endminm as variant; + equipment kits reviewed: none). Reference: docs/combat-mechanics.md.

## Flags

### F1. Vulnerable trigger fires on every stack, including at 4 stacks and on enemies that already have it; the reference marks this OPEN
- **Where:** packages/data/kits/operators/chr_0003_endminf.json → triggers `crystals_vulnerable`: `on: {event: "vulnerable"}` (no `rising` or `fromNone` filter), `beforeDamage: true`, which runs the crystal hit, talent 1, P2's half and then `endBuff originium_crystals`.
- **Kit has:** the crystals are consumed on every Vulnerable stack added (note: "igniteType 7 ... on every Vulnerable stack added. A Crush or Breach on an enemy without Vulnerable only adds a stack, so it consumes the crystals through this trigger").
- **Expected:** docs/combat-mechanics.md §4 (Vulnerable): "Whether adding Vulnerable at 4 stacks, or to an enemy that already has it, fires 'Vulnerable' combo triggers: [OPEN] (test 64; schema `vulnerable` event: `rising`, `fromNone`)." §8.5 lists the `rising` and `fromNone` filters. The kit's note relies on BuffData's igniteEventAction for buffEvent 7 but does not mention test 64.
- **Why it may matter:** if a Vulnerable stack added at 4 stacks, or to an enemy that already has Vulnerable, does not ignite in game, then the crystals are consumed early by those applications. That loses talent 2's Physical DMG taken for the rest of the crystals' life, and talent 1's ATK, P2's share and P3's energy. Which skills apply Vulnerable to an enemy already at 4 stacks decides how often this happens. Size not computed.
- **Evidence:** the kit's trigger and note (above). The BuffData igniteEventAction (buff_physical_no_guard, buffEvent 7) is cited by that note and was not reopened in this pass. In-game test 64 in docs/in-game-tests.md is the open question.
- **Confidence it's a real problem:** medium
- **Verdict:** UNCERTAIN — The flag describes the kit correctly: `crystals_vulnerable` has no `rising` / `fromNone` filter, and the data (buff_physical_no_guard buffEvent actions) runs its igniteEventAction on every stack added, which is what the kit's note says. Whether the game fires it for a stack at 4 or on an already Vulnerable enemy is exactly combat-mechanics §4's [OPEN] item (test 64). No log of this operator isolates it (the only cited fixture, 7e19, is a Breach on an enemy where the crystal hit matches).
  - **Decides it (if UNCERTAIN):** in-game test 64's mechanism, but run with the Endministrator: crystals up with her combo on a dummy already carrying 4 Vulnerable stacks, then a Lift/Crush adding a fifth; do the crystals break and does the crystal hit land? Test 64 currently names only Chen and Da Pan, so add an Endministrator variant (or settle with Chen's result, as it is the same event).

## Checked, no conflict found

- Combo (Sealing Sequence): the second DamageAction at frame 23 carries `atk_scale` with mask 12288 and the crystals are created between the two DamageActions, so talent 2 applies to that hit. Matches the kit's `beforeDamage` reading.
- Combo duration: SkillPatchTable `duration` 4.0 (L1 and L9), 4.5 (L10), 5.0 (L12). Matches the kit's "4 / 4.5 / 5 s at L1-9 / 10-11 / 12".
- Ultimate: hit at frame 50 (`atk_scale`, mask 4608); break hit `originum_ult_break_scale` (mask 512) on sealed targets; IgniteAction type 6 at frame 50 after the break hit. The crystal's own DamageAction uses the combo's `atk_scale_trigger`. Matches. L12 values (atk_scale 8.0, break 6.0) match the kit's source note.
- Battle skill: channeling at frame 11, CrushAction before its DamageAction (mask 4352, atk_scale key). P1's `atb_return` 50 is an ObtainCostAction with atbGainMethod 1 (returned) at frame 11, matching the kit's returned-SP reading.
- Finisher (power_attack2): DamageActions at frames 9 and 27 with BreakingAttackCalculation multipliers 0.1 and 0.9 on `atk_scale`. Matches.
- Potentials (PotentialTalentEffectTable and buffs): P2 ratio 0.5; P3 ultimate usp 15; P1 atb_return 50; P5 cd_minus 2 (attachBuff of chr_9000_endmin_potential_5); P4 ×1.2 on the ultimate's `atk_scale` and `originum_ult_break_scale` for both IDs (chr_9000_endmin_potential_4). The loader applies P4 from the virtual character's table (batch-2 row 29), so the kit needs no entry for it.
- Talent 2: chr_9000_endmin_talent_2_1 and _2_2 give dmg 0.10 and 0.20 on chr_0003_endminf_talent_0. Matches the kit's talent-2 aura.
- Essence Disintegration: max 1 (refreshes), consistent with the kit's "cannot stack" text.
- Physical status ignites (crystals_status, crystals_breach): the kit's claims about which hit sees talent 2 are stated from the BuffData order in its notes; the order was not re-derived here. The kit's own interim K1 (crystals_status) is left for phase 3.

## Not checked

- The male ID chr_0002_endminm was not compared in this pass; the kit says batch 2 compared all 11 skill pairs.
- The crystal's Lift / Knock Down / Crush ignite order (BuffData notes cited by the kit) was not reopened.
- Talent 1's atk_up (0.15 / 0.30) and duration (15 s) in chr_9000_endmin_talent_1_* were not compared numerically.
- Logs: not opened; fixture 7e19 is cited only through the kit. Hold-out fixtures were not touched.
- Equipment: none reviewed in this pass.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: none · UNCERTAIN: F1
F1 (uncertain): crystals might survive Vulnerable stacks that do not "ignite" in game; test 64 decides, with an Endministrator variant.
