# Zhuang Fangyi (chr_0030_zhuangfy): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0030_zhuangfy.json
(no equipment kit reviewed: the kit has no equipment references). Reference: docs/combat-mechanics.md.

Scope note: this kit is large (about 105 KB, with the battle skill, its empowered and ultimate variants, and many talent and potential triggers). This review compared the basic chain, finisher, combo and the poise landings against SkillData. The battle skill's strike and final-strike lists and the sword trigger chain were checked for shape only.

## Flags

### F1. Basic attack 4 reuses attack 2's entity in the kit, but its SkillData entity differs
- **Where:** packages/data/kits/operators/chr_0030_zhuangfy.json → skills `chr_0030_zhuangfy_attack4`, hit `range` (atk_scale, frames [11, 20, 23, 26], launch 11, no finalStrike)
- **Kit has:** the attack2 entity's geometry: one immediate landing at 11 and three ticks (20, 23, 26), "attack2's entity again ... as one hit (see attack2)". No Final Strike flag.
- **Expected:** SkillData `chr_0030_zhuangfy_attack4_abilityrange.json` has a DamageAction at its frame 0–1 with decorate mask 2097280 (Final Strike bit set, plus basic), two atk_scale landings at 9–15 and one at 21–24 (mask 128). The attack2 entity `chr_0030_zhuangfy_attack2_abilityrange.json` has one landing at 0–1 (mask 128) and two at 9–16 (mask 128), with no 21–24 landing. Reference §2.2: Final Strike is decorate bit 2097152 on a chain's last landing; §6.2 / §7.2 for chain landings.
- **Why it may matter:** one missing landing (21–24, at about frame 32 of the skill) and a Final Strike flag on the first landing: Final Strike-dependent effects (Stagger rules, SP and other Final Strike triggers) would not apply to it.
- **Evidence:** `jq` damage summary of `attack2_abilityrange` and `attack4_abilityrange`; the kit's own note for attack4.
- **Confidence it's a real problem:** medium-high (the entities differ in the data; the note reuses attack2's)
- **Verdict:** NOT A PROBLEM — chr_0030_zhuangfy_attack4.json spawns chr_0030_zhuangfy_attack2_abilityrange (grep; compileSkill of attack4 lands in attack2_abilityrange at 11, 20, 23, 26), exactly the kit's frames and note. attack4_abilityrange (Final Strike mask, 21–24 landing) is spawned by nothing; the only Final Strike in the chain is attack5, flagged in the kit.

### F2. Stagger (poise) units are not on the kit's hit fields for the combo and the Final Strike
- **Where:** packages/data/kits/operators/chr_0030_zhuangfy.json → skills `chr_0030_zhuangfy_combo_skill` (hit `hit`), `chr_0030_zhuangfy_attack5` (hit `range`, Final Strike); `chr_0030_zhuangfy_attack3` ult variant (`attack3_ult`, hit `range`)
- **Kit has:** `poise` on the battle skill's `final_N` hits only. The attack5 note says "poise onlyEnableForMainChar"; no poise field is set on the hit.
- **Expected:** SkillData: `chr_0030_zhuangfy_combo_skill.json` frames 24–27 with atk_scale (mask 12288) plus a damage unit of damageAttributeType 1 (poise); `chr_0030_zhuangfy_attack5_abilityrange.json` frames 0–12 with atk_scale (mask 2097280, Final Strike) plus a poise unit (controlled only per the note); `chr_0030_zhuangfy_attack3_ult_abilityrange.json` frames 30–33 with a poise unit. Reference §5: "It comes only from damage units of damageAttributeType 1 ... Final Strikes' Stagger counts only while their operator is controlled."
- **Why it may matter:** Stagger progress and the finisher window for the combo, Final Strike and the ultimate-state chain. Size: the poise value per landing is not read here.
- **Evidence:** `grep -n poise` on the kit (only the `final_N` hits); SkillData damage units; the kit's attack5 note. The batch-4 table's "3 KNOWN entries" and the D6 fold (packages/data/src/kitMatch.ts `foldPoise`) apply to these cases.
- **Confidence it's a real problem:** medium (the compiler may fold them)
- **Verdict:** NOT A PROBLEM — the loaded kit has poise on combo `hit` ("poise"), attack5 `range` ("poise", controlled-only, Final Strike) and attack3_ult `range` ("poise", controlled-only, Final Strike): the compiler fills them from the landing's poise unit.

## Checked, no conflict found
- Basic attack 2 and attack 4 entity tick timing: the immediate landing at the spawn frame and three ticks 9, 12, 15 frames after it match the kit's frames (SkillData ticks at relative 9 and 15 plus the middle one) for attack2.
- Basic attack 5 (Final Strike, controlled-only SP `atb`): one landing at 20 with mask 2097280 matches the kit's `range` hit's `finalStrike: true` and its SP gate.
- Power attack (finisher): landings at frames 11 and 40 (mask 132) match the kit's `hit` (11) and `hit_2` (40).
- Dive attack: mask 1152 (basic + dive), one landing over frames 1–6, matching `plunging_attack_end`.
- Combo: landing at 24–27 (mask 12288, combo), matching the kit's combo hit (one landing, its damage type combo).
- Battle skill `final_N` hits: each has `poise: poise` with `final_rate` scale and frames that rise by one per strike (28, 36, 43, 50, 56, 61, 66, 70, 73), which is the shape the SkillData's final strikes take in the ultimate variant (32, 38, ..., 80).
- Ultimate variant and the Empyrean state's windows: the sword trigger chain (`bs_swords`, `bsu_swords`, `ult_state`, `ult_end`) was read for shape only.

## Not checked
- The sword-strike lists of the battle skill (`strike_2`…`strike_9`) and their frames against the battle skill's sword entities (no damage units in `chr_0030_zhuangfy_normal_skill.json` itself: the strikes live in entity files not traced here).
- Numeric values: scales (`final_rate`, `atk_up_per_conduct`), SP and energy grants, cooldowns, potentials P1–P5 and talent 1 / talent 2 amounts.
- Buffs `sunderblade`, `t1_amp`, `t1_amp_plus`, `p1_more_sword`, `empyrean`, `ult_free`, `p5_resist`: stacking types, durations and targets against BuffData, not traced.
- Triggers `bs_consumed` (statusConsumed) and `ult_end`'s cooldown and cast values.
- Log fixtures: only the kit's citations; no fixture was opened (the hold-out fixtures were excluded). The accuracy plan's Zhuang items (B8 and the Thunder Strikes) were not traced to the kit.
- Equipment kits: none referenced by this operator's kit.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2 · UNCERTAIN: none
attack4_abilityrange is an unspawned entity; the loaded kit has the poise. No log fixture outside the hold-out.
