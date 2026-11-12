# Perlica (chr_0004_pelica): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0004_pelica.json (+ equipment kits reviewed: none; not part of this pass). Reference: docs/combat-mechanics.md.

Method: the kit compared with `efsim kit-draft chr_0004_pelica` (compiled from SkillData) and with the BuffData, PotentialTalentEffectTable and CharacterPotentialTable rows for her potentials and talent.

## Flags

### F1. The kit records test 51 as answered for Perlica's P3 on the reaction hit; the reference and the test list it as open
- **Where:** packages/data/kits/operators/chr_0004_pelica.json → triggers `supervisory_duties` (`beforeDamage: true`, `on.event: reaction`, `statuses: [electrification]`); its note says "test 51's question, answered yes here".
- **Kit has:** P3's ATK buff (`supervisory_duties`) applied before the damage of the hit that forms Electrification, so that hit already has its ATK.
- **Expected:** docs/combat-mechanics.md §8.4 lists "Perlica's P3 with Pulser Labs" among the hits put on the same hit because the data creates them first, tagged **[OPEN] (test 51)**. docs/in-game-tests.md test 51 is "partly answered" (Hot Work only); the Solemn Phalanx, Ancient Canal and Starry Beach cases are still open, and Perlica isn't in the answered part.
- **Why it may matter:** if the game gives P3's ATK only from the next hit, the hit that forms Electrification is overstated by up to the P3 ATK (+20% per layer; the kit's own evidence has ×1.200 on that hit). It also decides whether the reaction's initial hit sees the layer.
- **Evidence:** fixtures/pending/zmdlogs-e82d45c46040.json at 7544 ms (two hits, her battle skill and the Electrification reaction it forms on a Cryo enemy). The kit's own sources say that fixture's logged skill levels are unreliable and that the reaction "fits only without its own Electrification (open list A6)", so the fixture is weak evidence for the rule.
- **Confidence it's a real problem:** medium (the kit may be right, but the record of the question as answered isn't supported by the reference or the test file).
- **Verdict:** (phase 3)

## Checked, no conflict found
- Hit frames, counts and keys: basic attacks 1–4 (projectile frames 8, 9/12, 16/19/22, 27), dive 3, finisher 35 (BreakingAttackCalculation multiplier 1), battle skill 13 (Electric infliction), combo 24 (forced Electrification with `duration` and `extra_scaling`), ultimate 58 with the crit bonus. All match the compiled draft and the 58–63 window of the ultimate's timeline.
- Potentials (PotentialTalentEffectTable): P1 combo `duration` ×1.75 (multiply), P2 ultimate cost ×0.85 (paramType 1), P3 attaches `buff_chr_0004_pelica_potential_3` (atk_up 0.2, duration 5, max_stack 2), P4 combo `extra_scaling` set to 1.33, P5 ultimate crit +0.3. The kit's values match.
- The P4 value (1.33) is the potential the reference's §3.4 suggested ("probably a talent or potential"); the data supports it, so the kit's reading is consistent with the data.
- Electrification buff `buff_common_pulse_pulse_conduct_triggered`: stackingKey `pulse_triggered`, stackingType 0, max 1 (a stronger forced one replaces it, as the kit says).
- P3 layer buff `buff_chr_0004_pelica_potential_3_atkup`: stackingType 8 (shared timer, as the kit's note says; test 62 open).
- Talent 1 (`buff_chr_0004_pelica_talent_0`): damage bonus to Staggered enemies, dmg 0.2 / 0.3. Matches the kit.
- Combo Final Strike trigger (`openCombo` on a controlled Final Strike) matches the CharGrowthTable COMBO TRIGGER text.

## Not checked
- SkillPatch values at level 12 were not re-read for Perlica (the kit's sources cite them); only the potential rows and the draft's timing were compared.
- Logs: only the e82d fixture was considered, through the kit's own notes. No log was re-run, and the hold-out fixtures were not opened.
- Finisher knock-down (test 67) and the open-list items the kit cites (A1, A6, B3, U1, test 66) are documented open items and were not judged.
