# Laevatain (chr_0016_laevat): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0016_laevat.json
(+ equipment kits reviewed: none referenced by the operator kit; signature weapon not identified in this pass). Reference: docs/combat-mechanics.md.

## Flags

### F1. Battle skill entity: ten damage hits after the explosion are not in the kit, and the "dot" scale key is never read
- **Where:** packages/data/kits/operators/chr_0016_laevat.json → skills[chr_0016_laevat_normal_skill] hits `explosion` / `dot`; SkillData chr_0016_laevat_normal_skill_abilityentity (Magma Fragment, spawned at frame 4)
- **Kit has:** three hits for the battle skill: `explosion` (entity DamageAction at 18), `dot` (scale `atk_scale_2`, launch 4), `empowered_extra`.
- **Expected:** SkillData's entity has 11 enabled DamageActions: frame 18 (mask 4352, explosion) and frames 25, 29, 33, 37, 41, 45, 50, 54, 58, 62 (mask 256, battle skill, literal scale 1.0, each with a poise-less unit). Its blackboard has `atk_scale_2 = 0.0`, and no enabled hit in the entity reads `atk_scale_2`. The `dot` hit therefore has no matching DamageAction in the data. [DATA] (§2.1 battle kind; §1.3 scale)
- **Why it may matter:** ten battle-skill hits per cast that the kit does not deal. Each is a battle-skill hit (skill-type DMG applies, mask 256), so battle-skill DMG and Amp/Susceptibility on those hits are missing from the simulated total. Size: unquantified. Each data hit uses a literal scale of 1.0 × ATK (the explosion's own scale key is `atk_scale`, whose entity value is 3.0 and is read by no entity hit), so the total depends on which scale the game applies; a phase-3 check should settle that before sizing.
- **Evidence:** `python3 kr4_sum.py SkillData/chr_0016_laevat_normal_skill_abilityentity.json` (entity dur 100 frames, blackboard atk_scale=3.0, atk_scale_2=0.0, atk_scale_3=0.0; the entity's own hits use literal scales). The 10 hits are not gated by any IfElse in the entity's timeline (only CheckEntityNum with minNum 1 wraps the buff grants, see F2). Log check not run in this pass.
- **Confidence it's a real problem:** medium (the data is clear; whether the game's log counts these as separate hits, and whether the literal scales are the real ones, needs a log check)
- **Verdict:** NOT A PROBLEM — the flag read the kit JSON, not the loaded kit: `packages/data/src/kits.ts` fills frames and counts from SkillData, and the loaded `dot` hit is `atk_scale_2`, count 10, frames 29–66 (`efsim kit-draft` shows the same ten hits, mask 256). The "literal scale 1.0" does not apply: the logs show explosion 1.4 and ten ticks of 0.14 in battle-skill scale (zmdlogs-458b03609665 at 18506–19923 ms, and 39447, 67937, 70946), i.e. `atk_scale_2` (SkillPatchTable level 12). `zmdlogs check` of 458b: Laevatain 383 of 384 hits match (265 plain), including every explosion and tick; the one mismatch is a burning tick.

### F2. Battle skill grants Melting Flame and team energy at every entity hit, not once; team energy is modelled as one part at frame 22
- **Where:** kit → skills[chr_0016_laevat_normal_skill] `explosion.gains` (MF on first hit only), `teamEnergy: [{frame 22, ratio 1}]`, stacks[melting_flame] note ("gained on the battle skill's first hit")
- **Kit has:** one MF on the explosion hit, and a single `teamEnergy` grant of ratio 1 at frame 22 (entity frame 18 + 4).
- **Expected:** the entity creates `buff_chr_0016_laevat_energy` (1 MF) and `buff_common_obtain_ultimate_sp` at each of its hits at frames 18, 25, 29, 33, 37, 41, 45, 50, 54, 58, 62 (skill frames 22–66). Each is gated only by `CheckEntityNum` (minNum 1, compareType 3, i.e. the fragment still exists), which holds for all 11. The grants set no `ratio`, so the buff's default ratio 1.0 applies at each. MF is capped at 4 (`max_stack`). [DATA] (§7.4 team energy in parts at the `buff_common_obtain_ultimate_sp` frames; §4 stack caps)
- **Why it may matter:** (a) MF: the battle skill alone can reach 4 MF in its first four hits, so the empowered extra hit and Scorching Heart trigger on a different timeline than the kit assumes. (b) Team energy: if each grant is a full part, the battle skill gives up to 11× the energy the kit models; if the parts sum to one share, the timing (frames 22 vs 22–66) still moves the ultimate's charge time. Which reading is right depends on how `ObtainUspInNormalSkill` (coefficient = `ratio`, bb `usp_everyone` 6.5) splits a cast's SP, which §7.4 leaves as ASSUMED.
- **Evidence:** SkillData chr_0016_laevat_normal_skill_abilityentity: CreateBuffAction sai 7/16/24/32/40/48/56/64/72/80/88 (energy) and 8/17/25/33/41/49/57/65/73/81/89 (obtain_ultimate_sp), each with empty `assignItems`; CheckEntityNum sai 6/13/21/… BuffData buff_common_obtain_ultimate_sp (`ObtainUspInNormalSkill`, ratio 1.0). Log check not run.
- **Confidence it's a real problem:** medium (the data is explicit; the energy total depends on the ASSUMED split rule in §7.4)
- **Verdict:** UNCERTAIN — the Melting Flame half is refuted by logs; the team-energy half is open. MF: giving each tick +1 MF (loaded kit's `dot` with `gains`, tried in a scratch script) puts Scorching Heart on at about 19 s in zmdlogs-458b03609665 where the log lists none (26 hits, 19.3–36.6 s), and 14 + 8 more hits disagree later; the kit as it is has no Scorching Heart disagreement in 458b over 233 s, and plain matches fall from 265 to 205 with the variant. So one MF per cast is right in practice, though the data's CreateBuff `buff_chr_0016_laevat_energy` (sai 7, 16, 24, …) sits at each tick: it probably targets something other than Laevatain, or the cast's own frame-22 CreateBuff is the one that counts. The kit-draft compiler likewise yields a single `teamEnergy` part at 22, and kitMatch checks the kit against it. Energy: 11 full parts would be 71.5 energy per cast against `usp_everyone` 6.5, which is implausible, but no log or test shows the ultimate gauge.
  - **Decides it (if UNCERTAIN):** an in-game phone video of a teammate's (or Laevatain's) ultimate gauge across one battle skill cast: one step of about 6.5 energy at once (kit) or growing over the tick frames; with a 100-SP skill and no other energy source.

### F3. Empowered extra hit: the kit's `scale` list includes `extra_scaling`, while its own dataOverride says the data puts `extra_scaling` only on the forced Combustion
- **Where:** kit → skills[chr_0016_laevat_normal_skill] hit `empowered_extra`: `scale: ["atk_scale_3", "extra_scaling"]`, `dataOverride.scale`, `applies[0].scaleKey: "extra_scaling"`
- **Kit has:** the hit's own damage multiplies by `extra_scaling` (listed in `scale`), and the forced Combustion also uses `extra_scaling`. The dataOverride text says the data has `atk_scale_3 ×= ratio` and that "extra_scaling only goes to the forced Combustion buff".
- **Expected:** SkillData: the DamageAction at frame 104 has `atkScale = atk_scale_3` (multiplied by `ratio` at frame 104 via ModifyDynamicBlackboard). `extra_scaling` is assigned only to the CreateBuff at frame 104 (the Combustion). So the data's hit has no `extra_scaling` term. [DATA] (§1.3 scale keys; §3.3 Combustion ticks)
- **Why it may matter:** at P3 the difference is ×1.5 on the extra hit (roughly 25% of the explosion-plus-extra total at P5 per test 20's own figures). The kit follows Zero Sanity's in-game table here, which is evidence, so the choice is documented; but the `scale` list and the dataOverride text contradict each other, so a phase-3 check cannot tell which the kit means.
- **Evidence:** docs/in-game-tests.md test 20 ("Zero Sanity's in-game number fits `extra_scaling` instead (1.5 from P3)"); docs/open-problems.md "Smaller" list; SkillData chr_0016_laevat_normal_skill DamageAction f104 and CreateBuffAction f104 assignItems (`extra_scaling`).
- **Confidence it's a real problem:** low (the choice is deliberate and open; the flag is for the self-contradiction in the kit's text)
- **Verdict:** REAL — the logs favour the data (`atk_scale_3 × ratio`) over the kit's `extra_scaling` choice, which follows Zero Sanity's table. The kit's `scale` list and its dataOverride text agree on what each says; the choice itself is what fails. zmdlogs-e9896c8d02be (P5): both empowered extra hits (55333 and 67244 ms) are logged 0.8000 × the kit's prediction (1.2 / 1.5 exactly); with the data reading all the fixture's mismatches disappear (see F4: 6 problems to 0, so the fixture verifies). Same direction in zmdlogs-3440cf450fea (P3, skill mismatches 6 to 2), -064bafebf7b0 (P2, 6 to 1) and -63398339803e (P5, 1 to 0); none gets worse (variants run in a scratch script, `scale` of `empowered_extra` set to `["atk_scale_3","ratio"]`).
  - **Fix (if REAL):** `empowered_extra.scale` → `["atk_scale_3", "ratio"]` (keep `extra_scaling` as the forced Combustion's `scaleKey`, which the data does assign it to). Effect: P3+ extra hit ×0.8 (46,040 vs Zero Sanity's 57,552 at P5 per test 20; the Zero Sanity fixture's expectations and kit tests that pin the 1.5 will change); P1–P2 extra hit ×1.2 higher than now (ratio applies, extra_scaling is 1). Confirm with in-game test 20 before dropping Zero Sanity's table.

### F4. Enhanced battle skill (Twilight): `ratio` on hits 1 and 2 conflicts with the data, and both log fixtures disagree with the kit in opposite directions
- **Where:** kit → skills[chr_0016_laevat_normal_skill_during_ult] hits `hit1` and `hit2`: `scale: ["atk_scale", "ratio"]` and `["atk_scale_2", "ratio"]`, with `dataOverride.scale`
- **Kit has:** `ratio` (×1.2 from P1) on the first two hits, taken from Zero Sanity's table; its dataOverride says the data multiplies only atk_scale_3.
- **Expected:** SkillData chr_0016_laevat_normal_skill_during_ult: the hits at frames 13 (atk_scale) and 23 (atk_scale_2) read no `ratio`; only the frame-98 hit (atk_scale_3) is multiplied by `ratio` (ModifyDynamicBlackboard). The P1 potential table sets `ratio` 1.2 on this skill. [DATA]
- **Why it may matter:** the two hits are the enhanced battle skill's explosion-type damage. With ×1.2 they are 20% higher; test 20 gives both readings (×1.2 vs none, a 2.8× vs 2.4× ratio against the explosion).
- **Evidence:** docs/open-problems.md "Smaller, not yet diagnosed": "`normal_skill_during_ult`: ×0.833 in e989, ×1.083 in db87; its `ratio` key has no value in the data (in-game test 20)". The two logs point opposite ways, so neither reading fits both. The kit cites test 20 but not these two log results.
- **Confidence it's a real problem:** medium (documented as open, but the kit does not record the log outcomes that already contradict each other)
- **Verdict:** REAL — same evidence as F3, from the Twilight battle skill. zmdlogs-e9896c8d02be (P5): `hit1` and `hit2` at 15433, 15826, 95043 and 95529 ms are all logged 0.8333 × the kit's prediction (exactly 1 / 1.2), while the `extra` hit (16806 ms, `atk_scale_3 × ratio`) matches exactly. With hit 1 and 2 reading no `ratio` and the extra hit on `ratio` instead of `extra_scaling` the fixture goes from 6 verification problems to 0 (scratch variant: `hit1.scale` = `["atk_scale"]`, `hit2.scale` = `["atk_scale_2"]`). Also fewer mismatches in 064b (P2, 6 to 1 with both changes), 3440 (P3, 6 to 2) and db8711232de9 (P1, 11 to 9). The kit records Zero Sanity's table but not these log results; the P1 fixture db87 is not clean (see N1).
  - **Fix (if REAL):** `hit1.scale` → `["atk_scale"]`, `hit2.scale` → `["atk_scale_2"]` (drop `ratio`), from P1: the two hits drop 1/1.2 (−16.7 %); the extra hit keeps `ratio`. Together with F3 this is the whole of open-problems' "normal_skill_during_ult ×0.833 in e989".

### F5. Enhanced battle skill (Twilight): no team energy, and no returned SP, although the data grants both
- **Where:** kit → skills[chr_0016_laevat_normal_skill_during_ult]: no `teamEnergy`; extra hit note "no energy"
- **Kit has:** no team-energy grant and no SP on the Twilight battle skill.
- **Expected:** SkillData chr_0016_laevat_normal_skill_during_ult: `buff_common_obtain_ultimate_sp` created at frames 13 and 23 (the two hits), and an ObtainCostAction `atb` (returned SP, atbGainMethod 1, atbSourceType 3) at frame 98 on the extra hit. P1's potential table sets `atb` 20 on this skill. [DATA] (§7.3 returned SP gives no energy; §7.4 team energy at the frames)
- **Why it may matter:** team energy on every Twilight battle skill, and the P1 SP return (20 SP, which the kit gives on the plain battle skill's extra hit only, per its note).
- **Evidence:** SkillData chr_0016_laevat_normal_skill_during_ult CreateBuffAction f13/f23 and ObtainCostAction f98; PotentialTalentEffectTable chr_0016_laevat_potential_1 (atb 20 on normal_skill_during_ult).
- **Confidence it's a real problem:** medium
- **Verdict:** NOT A PROBLEM — the flag read the kit JSON, not the loaded kit. The loaded `chr_0016_laevat_normal_skill_during_ult` has `teamEnergy: [{frame 13, ratio 1}]` (the same single-part result as the draft for the normal skill) and its `extra` hit carries `sp: "atb"` before the damage; `skillValue(... "atb")` reads 0 at P0 and 20 at P1+ for both battle skills (checked with a scratch script). The extra hit's "no energy" note is about `extra_usp`, which this skill's data has none of (the draft gives it no `energy`). Whether the Twilight team energy should be two parts (13 and 23) rests on the same open question as F2.

### F6. Enhanced basic attack 2 (Twilight): the kit has one hit; the data has two enabled damage hits and an inflicting structure
- **Where:** kit → skills[chr_0016_laevat_ult_attack2]: one hit `hit` (scale `atk_scale`, `ratio`)
- **Kit has:** one hit, no infliction.
- **Expected:** SkillData chr_0016_laevat_ult_attack2: two enabled DamageActions (frame 10, sai 23, mask 128; frame 21, sai 36, mask 128), both `atk_scale` (default 0.5) with `ratio` set at frame 10. The frame-21 DamageAction is inside the same channelling tick structure; a disabled SpellInfliction sits at frame 21 (isEnable false, so no Heat). [DATA]
- **Why it may matter:** one enhanced BATK hit per sequence is missing. Each is basic-attack DMG, so the total changes by one hit's worth for every ult_attack2.
- **Evidence:** SkillData chr_0016_laevat_ult_attack2.json (timelineActions[20] and [21] DamageActions, both isEnable true; the second is nested in a ChannelingAction actionOnTick). The kit has `ult_attack4` as a two-hit skill, so the omission is not a pattern. Log check not run.
- **Confidence it's a real problem:** medium (I did not confirm that the nested channel tick fires once per attack2 cast)
- **Verdict:** NOT A PROBLEM — the loaded `ult_attack2` has `count: 2`, frames `[10, 21]`, `atk_scale × ratio` and the half-`atb` (`efsim kit-draft` says the same: 2 landings, mask 128); the hit list in the kit JSON is filled from SkillData on load. The logs agree: two ult_attack2 hits per cast (zmdlogs-458b03609665 at 88098/88553, 98101/98577, 101847/102368, … ; the verified zmdlogs-40d9a3c1da37 has four logged hits and all match). The disabled SpellInfliction in the frame-21 tick has no effect, as the flag says.

### F7. Potential 5 (Twilight extension) is not in the kit
- **Where:** kit → buffs[twilight], triggers (none for P5)
- **Kit has:** nothing for potential 5.
- **Expected:** PotentialTalentEffectTable chr_0016_laevat_potential_5: attaches buff_chr_0016_laevat_potential_5 with `extend_duration` 1.0 and `max_duration` 7.0 (modifyType 5). That buff's ability events (id 222 and 203, not mapped here) check for `buff_chr_0016_laevat_ring_start_asset` and re-create `buff_chr_0016_laevat_ult_end` with duration = `extend_duration`, capped by `max_duration`. Potential 5 also sets `ratio` 1.2 on ult_attack1–4 (the kit reads `ratio` on those, so that part is engine-applied). [DATA]
- **Why it may matter:** up to 7 s of extra Twilight per ultimate at P5 (the kit's Twilight stops at 15 s). Twilight is her highest-damage state (accuracy-plan item 8).
- **Evidence:** PotentialTalentEffectTable.json (chr_0016_laevat_potential_5 row); BuffData/buff_chr_0016_laevat_potential_5.json (curr_duration / extend_duration / max_duration; abilityEvent ids 222, 203); buff_chr_0016_laevat_potential_5_cd (10 s cooldown). The trigger event for ids 222/203 is not mapped in this pass.
- **Confidence it's a real problem:** medium (the data is clear that P5 extends Twilight; the exact trigger and cap behaviour need the event mapping)
- **Verdict:** UNCERTAIN — the data is clear that P5 attaches a buff that re-creates `ult_end` with `extend_duration` (1 s) up to `max_duration` (7 s) when abilityEvents 222 / 203 fire (unmapped; the actions are gated on `CheckObjectTypeMatch` mask 16, a stack count ≥ 1 and a 10 s `potential_5_cd`), but no log exercises it. The P5 fixtures never run past the kit's Twilight end: zmdlogs-e9896c8d02be (ult at 7387 and 88634 ms; last enhanced hit 18716 ms and 95529 ms, both inside 15 s plus pauses) and the verified zmdlogs-40d9a3c1da37 (ult at 3041 ms, last enhanced hit 18009 ms, the fight ends at 18.8 s). Nothing contradicts the kit and nothing shows the extension.
  - **Decides it (if UNCERTAIN):** the abilityEvent 222 / 203 mapping (which game event: a kill, a hit, a reaction), and a P5 log or in-game timing of Twilight with that event firing (test 21 at P5): enhanced attacks landing after 15 s plus the pauses.

## Checked, no conflict found
- Basic attack 1, 2, 3 and 5 frames, masks (128; Final Strike 2097280 = 2097152 + 128) and the Final Strike bit on the second landing of attack5 (frames 23 / 26).
- Basic attack 4: hits and projectile launches as the kit describes (not checked against the projectile travel time, which the data omits).
- Enhanced basic attacks 1, 3 and 4: frames, `atk_scale × ratio` (ModifyDynamicBlackboard), Heat infliction on attack3 (enabled) and none on attack4 (both inflictions disabled in the data).
- Battle skill jumps at frame 30 (MF ≥ 4) and the empowered hit's consume at 104; FinishBuff of MF at 104.
- Combo skill: CreateBuff at frame 20 starting `combo_skill_hit` (0.7 s first trigger, one hit per enemy with Combustion or Corrosion), energy `usp_1` 25 matches the kit's `usp_1_display`; combo window opener (COMBO TRIGGER text, combustion and corrosion).
- Finisher: mask 132 (basic + finisher); its two literal scales (1.0 and 4.0) match the 0.2 / 0.8 split in the kit's note.
- Twilight duration 15 s (ult_end) and show_weapon 16 s with its end setting the ultimate cooldown to 10 s (SetSkillCdAtOnce, functionType 1).
- Scorching Heart: talent 1 values (−10 / −15 / −20 Heat RES, 20 s duration, max_stack 4) match the talent table rows; the buff's `ignoreResistance` modifier on attribute 98.
- Final Strike absorb: cooldown 1 s (passive_teammate_cd 1.0), mask 2097156, MF < 4 gate, talent ≥ 1 gate.
- Pause mechanics: pause_ult PauseBuffTime pair, show_weapon's RefrainObtainUsp, combo re-creation every 0.1 s (ChannelingAction, combo_skill frames 0–57).
- Potentials P1 (SP 20 and `ratio` on the battle skills), P3 (`duration` +1.5 s on the forced Combustion and `extra_scaling` ×1.5), P4 (ultimate cost ×0.85): matched by the kit's notes or by the engine's table handling; ratio/extra_scaling values are read from the same blackboard keys.

## Not checked
- Equipment kits: the operator kit references none, and her signature weapon was not identified.
- Talent 2 (shelter when HP ≤ 40%): not in the kit. It has no damage effect and HP is not tracked (§6 and §8.5 of the reference), so it is out of scope for damage; not flagged.
- Potential 1's buffs (`buff_chr_0016_laevat_potential_1`, `_1_1`: +1 MF every 2 s in fight) are not attached by the potential table (only skill edits are), so they are treated as unused. Not confirmed in-game.
- Log fixtures: no `zmdlogs check` run in this pass. Hold-out fixtures were not opened.
- Dive attack, dash attack and the Melting Flame duration (buff_chr_0016_laevat_energy has `duration` 30 with lifeType 1; the kit says "no expiry"): the lifeType meaning is not in the reference, so this was not resolved.
- Hit frames for the projectile of basic attack 4 and the battle skill's entity projectile travel time (not in the data).

## Phase 3 summary (2026-11-12)
REAL: F3, F4 · NOT A PROBLEM: F1, F5, F6 · UNCERTAIN: F2, F7
- F3: the empowered extra hit takes `ratio` (×1.2 from P1) not `extra_scaling`: P3+ extra hit ×0.8, P1–P2 ×1.2 (zmdlogs-e9896c8d02be and three more fixtures, scratch variants).
- F4: Twilight battle skill hits 1 and 2 take no `ratio`: −16.7 % from P1 (the same fixture; with F3 it turns e9896 from 6 verification problems into 0).
- Hold-outs were not opened. The scratch checks changed no repo file.

### N1. After F3 and F4 the P1 fixture zmdlogs-db8711232de9 still disagrees on the Twilight battle skill
- **Where:** `normal_skill_during_ult` hits at 20665–55308 ms (P1, pending, 77 verification problems in all).
- **Kit has:** `hit1`/`hit2` with `ratio`, `extra` with `ratio`.
- **Expected:** with the data reading the hits are still logged ×1.30 (hit 1, 2) and ×1.27–1.30 (extra) the prediction; the two other Twilight fixtures that fit (P5) need ×1.0 and ×1.2. Either a P1-only factor, or a buff the log does not list; the same fixture has other unexplained ×0.975 factors on its ult_attacks.
- **Confidence it's a real problem:** low
- **Verdict:** UNCERTAIN — a lone pending fixture with many other problems; nothing else shows a P1 difference.
  - **Decides it (if UNCERTAIN):** a clean P1 Twilight log, or in-game test 20 at P1.

### N2. Other leads checked and found fine
- Melting Flame's 30 s duration (`lifeType 1`) vs the kit's "no expiry": not tested (no discriminating log was found; the 458b Scorching Heart timeline agrees with the kit over 233 s).
- Hit counts of the battle skill under an empowered cast: logged clusters hold 7–9 ticks before the extra hit (zmdlogs-458b03609665, -63398339803e), as the kit's cut at the extra hit gives.
