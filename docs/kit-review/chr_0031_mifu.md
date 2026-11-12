# Mi Fu (chr_0031_mifu): kit review

Reviewed: 2026-11-12 (phase 2, flags only). Kit: packages/data/kits/operators/chr_0031_mifu.json
(no equipment kit reviewed: the kit has no equipment references). Reference: docs/combat-mechanics.md.

## Flags

### F1. Basic attack 3 has two hits; SkillData has three landings
- **Where:** packages/data/kits/operators/chr_0031_mifu.json → skills `chr_0031_mifu_attack3`, hits `hit` (atk_scale1) and `hit_2` (atk_scale2)
- **Kit has:** two hits, no frames.
- **Expected:** SkillData `chr_0031_mifu_attack3.json` (basic, mask 128): atk_scale1 at frames 10–13, atk_scale1 at 16–20, atk_scale2 at 30–33. Reference §7.2: each chain landing is its own hit; a repeated scale key is a second landing.
- **Why it may matter:** one basic-attack landing (about a full atk_scale1 per use) and the timing of the chain's middle landing.
- **Evidence:** `jq` damage summary of `chr_0031_mifu_attack3.json`. Attack 2 in the same kit has one kit hit per data landing, so attack 3 is the outlier.
- **Confidence it's a real problem:** medium (the two atk_scale1 landings could be one landing split by a branch; the branch structure was not traced)
- **Verdict:** NOT A PROBLEM — the loaded kit has attack3 `hit` count 2 frames [10, 16] plus `hit_2` at 30: the data's three landings (the compiler fills count and frames).

### F2. Battle skill Trail and Mangle: `flurry` has one hit; SkillData has two landings
- **Where:** packages/data/kits/operators/chr_0031_mifu.json → skills `chr_0031_mifu_normalskill_2`, hit `flurry` (atk_scale)
- **Kit has:** one `flurry` hit, no frames.
- **Expected:** SkillData `chr_0031_mifu_normalskill_2.json`: atk_scale (mask 4352, battle) at frame 3 and again at frame 10. Reference §2.2: battle-skill hits take the battle-skill bonus; each landing matters for on-hit triggers.
- **Why it may matter:** one battle-skill landing (the flurry's second hit) and the hit-triggers (Link and cast-based effects) it would count for.
- **Evidence:** `jq` damage summary of `chr_0031_mifu_normalskill_2.json`.
- **Confidence it's a real problem:** medium
- **Verdict:** NOT A PROBLEM — the loaded kit's `flurry` has count 2, frames [3, 10], matching the data.

### F3. Combo skill: two basic-kind landings in SkillData, one `hit` in the kit
- **Where:** packages/data/kits/operators/chr_0031_mifu.json → skills `chr_0031_mifu_combo_skill`, hit `hit` (atk_scale1)
- **Kit has:** `hit` (atk_scale1) and `uppercut` (atk_scale2, usp, Physical Susceptibility before the hit).
- **Expected:** SkillData `chr_0031_mifu_combo_skill.json` (mask 12288, combo): atk_scale1 at frames 8–9 and again at 10–11, then atk_scale2 with a poise unit at 31–32.
- **Why it may matter:** one combo landing per cast; the combo's damage and its trigger-count. Size: about one atk_scale1 per cast.
- **Evidence:** `jq` damage summary of `chr_0031_mifu_combo_skill.json`. The two frames may be a branch (not traced).
- **Confidence it's a real problem:** low-medium
- **Verdict:** NOT A PROBLEM — the loaded kit's combo `hit` has count 2, frames [8, 10], then `uppercut` at 31 with poise: matches the data.

### F4. Stagger units are not on the kit's hit fields for several landings
- **Where:** packages/data/kits/operators/chr_0031_mifu.json → skills `chr_0031_mifu_attack4` (hit `hit_2`, Final Strike), `chr_0031_mifu_combo_skill` (hit `uppercut`), `chr_0031_mifu_normalskill_2` (hit `mangle`), `chr_0031_mifu_ultimate_skill` (hit `slam`)
- **Kit has:** `poise` on the World Splitter's `poise` hit (poiseOnly, frames 23 and 25) only. The other poise values are in notes: attack4 "poise 25 onlyEnableForMainChar", slam "poise2 (20, P5 +5)".
- **Expected:** SkillData: attack4 landing at 30 (mask 2097280) with a poise unit (controlled-only, per the note); combo landing at 31–32 with a poise unit; mangle at 24 (atk_scale2 plus poise); ultimate slam at 102 (atk_scale2 plus poise2, mask 4608). Reference §5: Stagger comes only from damageAttributeType 1 units; Final Strikes' Stagger counts only while controlled.
- **Why it may matter:** Stagger progress and nodes for the chain, combo, battle skill and ultimate. Batch-4 item G3a and its "3 KNOWN entries" say some compiled landings still keep poise apart; whether `foldPoise` (packages/data/src/kitMatch.ts) handles the mixed-action units was not checked.
- **Evidence:** `grep -n poise` on the kit (only the World Splitter's poise hit); SkillData damage units; packages/data/src/kitMatch.ts lines 113–129.
- **Confidence it's a real problem:** medium (the compiler may fold them)
- **Verdict:** NOT A PROBLEM — the loaded kit has poise on attack4 `hit_2` ("poise", controlled-only, Final Strike), combo `uppercut` ("poise"), `mangle` and `mangle_splitter` ("poise") and `slam` ("poise2"); the compiler fills them from the data.

## Checked, no conflict found
- Basic attack 2: two landings (atk_scale1 at 9–10, atk_scale2 at 16–19), matching the kit's two hits.
- Basic attack 4 (Final Strike chain end): atk_scale1 at 7 and atk_scale2 at 30 with Final Strike mask 2097280 on the second, matching `hit` and `hit_2` and the `finalStrike` flags.
- Finisher: landings at frames 6, 17 and 37 (two units at 6, mask 132), matching `hit`, `hit_2`, `hit_3`.
- Dive attack: mask 1152 (basic + dive), one landing over frames 2–7, matching `plunging_attack_end`.
- Battle skill Cloudtrapper: channel landing at 7–12 (mask 4352), matching `normalskill_1`.
- World Splitter: poise-only landings at 23 and 25 and the crush landing at 26 (mask 20480: Crush bit plus the battle-skill-free mask), matching `poise`, `split` and reference §4 (Crush takes Crush's coefficient and no skill-type bonus).
- Ultimate Pile of No Mercy: lift at 75 (forced Lift) and slam at 102, matching `lift` and `slam`. The literal-0 landing at 98 is left out in the kit and the note says so.
- Combo window (`vulnerable` with minStacks 3, by anyone) matches the CharGrowthTable text quoted in the kit.
- Sub-skill battle-skill counting (Trail and Mangle, World Splitter) is documented in the kit as test 29's question (reference §2.2 OPEN): not flagged.

## Not checked
- Numeric values: scales (atk_scale1, atk_scale2, yuanshi_multi, crushmulti), SP and energy amounts, cooldown (19 s at level 12), talent and potential values (P1, P3, P5).
- Dive and combo landing timing versus rotation support (batch-1 S10).
- Buffs `trail_ready`, `splitter_ready`, `combo_susceptibility` and the P3 shield's stacking and duration: not traced to BuffData.
- Log fixtures: only the kit's citations; no fixture was opened (the hold-out fixtures were excluded).
- Equipment kits: none referenced by this operator's kit.

## Phase 3 summary (2026-11-12)
REAL: none · NOT A PROBLEM: F1, F2, F3, F4 · UNCERTAIN: none
All four flags read the raw JSON; the loaded kit has the counts, frames and poise. No log fixture outside the hold-out.
