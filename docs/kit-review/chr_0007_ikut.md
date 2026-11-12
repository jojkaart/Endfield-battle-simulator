# Ikutsu (chr_0007_ikut): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0007_ikut.json (the kit and its batch-3 plan call this operator Arclight; docs/kit-batches/batch-3/chr_0007_ikut.md) (+ equipment kits reviewed: none opened; wpn_sword_0012 and buff_equipsuit_combosuit_01 appear only in the log-check output). Reference: docs/combat-mechanics.md.

## Flags

### F1. Kit says no fixture has this operator; two pending fixtures do
- **Where:** packages/data/kits/operators/chr_0007_ikut.json → `sources` entry S4 ("Not verified against a log: no fixture has Arclight"). The batch-3 plan says the same (docs/kit-batches/batch-3/chr_0007_ikut.md, near line 199).
- **Kit has:** no log check for this operator; the note says none exists.
- **Expected:** fixtures/pending/zmdlogs-3aa6ab93bad4.json and fixtures/pending/zmdlogs-4bfc6f3e84b8.json list chr_0007_ikut as a team member (157 and 370 occurrences). `node packages/cli/src/main.ts zmdlogs check <fixture>` gives:
  - 4bfc6f3e84b8: Arclight 182 hits, 177 match, 5 mismatch (100% of her damage covered);
  - 3aa6ab93bad4: Arclight 75 hits, 74 match, 1 mismatch.
- **Why it may matter:** the kit's verification status is wrong, so phase 3 would not look at these logs. The mismatches are in F2.
- **Evidence:** the two fixture files and the check output (scratch; not saved in the repo).
- **Confidence it's a real problem:** high that the note is wrong; the impact depends on F2.
- **Verdict:** (phase 3)

### F2. Combos and attack4 land about 2.9% low in one log; attack2 is off in both logs
- **Where:** packages/data/kits/operators/chr_0007_ikut.json → skills `chr_0007_ikut_combo_skill` (hits `hit1`, `hit2`), `chr_0007_ikut_attack4` (hit `hit`), `chr_0007_ikut_attack2` (hit `hit`).
- **Kit has:** combo `atk_scale` (1.17 at level 12 per sources S0), attack4 `atk_scale` (channelling, at most three per target), attack2 `atk_scale`. No note on these gaps.
- **Expected:** the logged hits in fixtures/pending/zmdlogs-4bfc6f3e84b8.json against the engine's prediction from this kit:
  - combo t=40340 ms: logged 1986, predicted 1930 / 2162 / 2225 (ratio 1.0290);
  - combo t=99927 ms: logged 1930, predicted 1875 / 2100 / 2162 (ratio 1.0293);
  - combo t=110683 ms: logged 1930, predicted 1875 / 2355 / 2425 (ratio 1.0293);
  - attack4 t=103188 ms: logged 249, predicted 242 / 271 / 279 (ratio 1.0289);
  - attack2 t=75652 ms: logged 316, predicted 255 / 278 / 354 (ratio 1.2392).
  And in fixtures/pending/zmdlogs-3aa6ab93bad4.json: attack2 t=145742 ms, logged 546, predicted 518 / 398 / 601 / 633 (ratio 1.0541).
  The three combo hits and the attack4 hit are all about ×1.029 low, a constant that matches none of the zones the kit names. The check's own note says the engine's `suit_atb01` damage bonus (+0.16) fits 24 of her 25 hits in that log, so it is not the cause.
- **Why it may matter:** a uniform ~3% gap on every combo and a channelled hit points to a missing multiplier on those skills (a combo is about 1,900 in that log). The attack2 gaps (×1.24 and ×1.05) differ in size and may have another cause, such as a stagger reading or log timing.
- **Evidence:** the check output above (scratch, from the two fixtures).
- **Confidence it's a real problem:** medium (the log check reports these as mismatches, and the ×1.029 pattern repeats across three combos and one attack4 hit; the cause is not identified)
- **Verdict:** (phase 3)

### F3. dataOverride on the battle skill's third slash gives a matcher reason, not a data difference
- **Where:** packages/data/kits/operators/chr_0007_ikut.json → skill `chr_0007_ikut_normal_skill`, hit `third` (`dataOverride.poise`).
- **Kit has:** `poise: "poise2"` on the hit, with a dataOverride whose reason says the kit is right and that "the test matches the kit hit to another atk_scale landing there (the `tar` hits, the out-of-range branch)".
- **Expected:** in SkillData chr_0007_ikut_normal_skill.json at frame 136, the CheckTagMatch-false side's first DamageAction (atk_scale, poise2) is what `third` describes, so the kit's poise agrees with the data. The override therefore records a difference that is not in the data, and it hides whatever the matcher was comparing on this hit.
- **Why it may matter:** an override that masks a matcher mismatch could also hide a real one on this hit (its poise2 is 5 at level 12, per the kit's sources).
- **Evidence:** packages/data/kits/operators/chr_0007_ikut.json (hit `third`); SkillData chr_0007_ikut_normal_skill.json, frame 136 (an IfElse on CheckDistanceCondition, then CheckTagMatch; the false side has a DamageAction with poise2).
- **Confidence it's a real problem:** low (the poise value is right; the mark is probably a workaround)
- **Verdict:** (phase 3)

## Checked, no conflict found
- Battle skill frame 136: the data's branch structure (distance < 5 → Electrification check → extra attack with Electric DMG and poise2, otherwise the third slash with poise2; the out-of-range side has one DamageAction with no poise) matches the kit's `extra` / `third` alternatives with `branch` marks. The kit's buff `wildland_trekker` is `beforeDamage` on the extra hit, as the kit's note says.
- Log, Arclight in fixtures/pending/zmdlogs-4bfc6f3e84b8.json: the check reports only the five mismatches listed in F2, so her battle-skill, ultimate, basic-attack and power-attack hits in that fixture match (plain or assumed).
- The kit loads through `loadKits` without disagreements from the matcher (hits, frames, keys, factors, SP, poise, energy).

## Not checked
- Hit-by-hit values of the combo, the ultimate, the power attack and the talent and potential effects (S2: talent 1 pulse_up +0.0005 / +0.0008 and count 3; P1 atb +10; P3 pulse_up ×1.3; P4 cost ×0.85; P5 count 2). The kit states them; I did not re-read them from the tables.
- The team buff's values (attribute 52, pulse_up × Intellect, duration 15, max 1 stack): read from the kit's note, not from BuffData.
- Dash attack (in no skill group, per the kit), dive attack (rotation support pending), hit-stops, the ultimate's freeze of enemies below 10 super armour, the frame-136 `tar` hits: listed by the kit as not modelled.
- In-game questions the kit leaves open: the wildland counter (test 65), the combo-during-cooldown rule (test 60).
- Equipment behind F2 (wpn_sword_0012's team ATK, the combo suit's damage bonus): not opened.
- fixtures/pending/zmdlogs-3aa6ab93bad4.json: read for Arclight only.
- Phase-2 scope only; hold-out fixtures were not opened.
