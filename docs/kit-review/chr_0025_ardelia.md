# Ardelia (chr_0025_ardelia): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0025_ardelia.json
(+ equipment kits reviewed: none; weapon and gear not opened). Reference: docs/combat-mechanics.md.
Name check: docs/glossary.md has no entry for `chr_0025_ardelia`; the brief's name is used.

## Flags

### F1. The kit says no log has Ardelia; a committed fixture does, with an unexplained residual
- **Where:** packages/data/kits/operators/chr_0025_ardelia.json → sources[4] ("No log has Ardelia.") and the skills' notes that her Susceptibility is in-game test 38 only
- **Kit has:** that statement, so her battle skill and combo are not compared with any log.
- **Expected:** fixtures/multi-target/zmdlogs-064bafebf7b0.json contains `chr_0025_ardelia` (5 fixture files in all, one committed). docs/accuracy-plan.md, the fight c3c7 entry (around line 530): "c3c7 96 → 113 (+4.6 → +10%: its Xaihi +165% and Ardelia +75% kits drive its total)". Reference: combat-mechanics §11 (log quirks and build inputs) and §3.2 / §8.4 (Corrosion consumed before the Dolly Rush hit).
- **Why it may matter:** the log has her kits driving the fight's total, and the residual there is +10%; the kit's Susceptibility, Corrosion consumption and combo window have not been compared with it. If her kit causes part of the +10%, the battle skill or combo is the likely part. Size: the whole c3c7 total is +10% off, of which her share is unknown.
- **Evidence:** `grep -rl chr_0025_ardelia fixtures` (hold-out ids excluded); docs/accuracy-plan.md line ~530.
- **Confidence it's a real problem:** high that the statement is stale; medium that the residual involves her kit.
- **Verdict:** NOT A PROBLEM — documentation only: sources[4] is stale; fixtures/multi-target/zmdlogs-064bafebf7b0.json has Ardelia. `zmdlogs check`: 206 hits, 73 match, 91 mismatch; mismatches are attacks and her two combo hits at constant ratios (1.2499 at t=5974 equal to her attacks, 0.96, 1.25). The log contains no battle skill and no ultimate of hers, so Susceptibility and Corrosion consumption are untested (still test 38), and nothing shows a combo error. The c3c7 +10% in docs/accuracy-plan.md is another fixture (fixtures/pending/zmdlogs-c3c735dbb022.json), not examined here.

### F2. Battle skill's Arts Susceptibility has a cap (`rate_vul_max` 0.40) that the kit does not model
- **Where:** packages/data/kits/operators/chr_0025_ardelia.json → buffs[arts_susceptibility] and buffs[physical_susceptibility] (`value: rate_vul_base`)
- **Kit has:** the rate from `rate_vul_base` only (0.20, P1 +0.08 = 0.28), with no cap.
- **Expected:** TableCfg/SkillPatchTable.json `chr_0025_ardelia_normal_skill` L12 has `rate_vul_max` 0.40. No file opened in this pass reads it: grep of Json/SkillData and Json/BuffData for chr_0025_ardelia finds no `rate_vul_max` use. Reference: combat-mechanics §4 (Vulnerable stacks) and §8.1 (layers on a shared timer), with the Arts Susceptibility of two sources OPEN (test 38).
- **Why it may matter:** a cap of 0.40 would bite only if the Susceptibility stacks above 0.40 (two casts on a Corroded target at P1, or a second source). With the kit's values it stays at 0.28 unless stacking happens. Size: up to 0.12 on the Susceptibility zone when it applies.
- **Evidence:** TableCfg/SkillPatchTable.json (the L12 row: atk_scale 3.2, poise 10, rate_vul_base 0.2, duration_vul 30, rate_vul_max 0.4).
- **Confidence it's a real problem:** low (the key may be unused; the kit's values may already be right).
- **Verdict:** NOT A PROBLEM — `rate_vul_max` is only a SkillPatchTable key: it is read by no SkillData or BuffData file (grep of Json/ finds only `rate_vul`, `rate_vul_base`), is absent from the skill's displayed values (4 sub-descriptions, none the max), and the buff applies the rate through VulnerableAction with a child buff (buff_chr_0025_ardelia_affixes_vulnerable_spell_child, rate key `rate` = rate_vul_base). A single source at 0.28 (P1) never reaches 0.40, so a cap changes nothing for the kit as written; stacking from a second source is test 38's question, not this key's.

## Checked, no conflict found
- Battle skill SkillPatch values: atk_scale 3.2, poise 10, rate_vul_base 0.20, duration_vul 30, SP 100 (costType 1). The kit's `arts_susceptibility` and `physical_susceptibility` durations are `duration_vul`.
- Battle skill damage: frame 32 in both branches (`ram_corroded` and `ram`), mask 4352, the atk_scale unit with the stagger unit (no ATK) as the second unit. The kit's branch structure matches.
- Final Strike (attack 4): SkillPatch atk_scale 1.24, poise 18, atb 18, matching the kit's sources line (frames and mask not re-read).
- Combo: SkillPatch atk_scale 1.0, atk_scale_boom 2.5, duration_corrupt 7, poise 10, usp 10, cooldown 17 s. The bomb uses `atk_scale_boom` with its P5 ×1.2 (potential5_dmg_rate) as the kit writes it; the Corrosion's duration is `duration_corrupt` plus P5's `potential5_duration`.
- Ultimate SkillPatch: atk_scale 1.65, poise 3, interval 0.3, cost 90 (P4 ×0.85 per the kit's sources). Per-enemy cap is the kit's documented interim (U1, test 96).

## Not checked
- Ultimate frames (81–198, every 9 frames) and copy count: the kit's interim (test 96) was not re-derived from SkillData; projectile frames for basic attacks and the combo (20, 52) were not re-read.
- Talent 2 recast and the dash shortcuts (kit says not taken; not re-checked).
- Combo window trigger text against CharGrowthTable beyond the kit's quote.
- Equipment (weapon and gear) not opened.
- The c3c7 log (F1) was not opened; F1 rests on docs/accuracy-plan.md's summary. Hold-out fixtures were not opened.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2 · UNCERTAIN: none
sources[4] ('No log has Ardelia') is stale (064bafebf7b0 has attacks and the combo, no battle skill or ultimate); `rate_vul_max` is used by no data file.
