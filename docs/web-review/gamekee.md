# GameKee (伤害乘区 article): engine comparison

Source: https://www.gamekee.com/zmd/691878.html (article 伤害乘区, id 691878; body read from the JSON `data.content_json`, the `content` field is empty), linked pages: https://www.gamekee.com/zmd/692503.html (伤害计算表, a pointer to a spreadsheet, no mechanics), https://www.gamekee.com/zmd/second/202692 (enemy codex, not readable: the detail endpoint returns "article does not exist"). No link to reactions, Stagger or energy articles. Fetched 2026-11-12. Credits: 吃我无痕 (article), 卡诺kan0 (optimisation, table).

Basis in general: stated as the authors' own testing ("攻略原作者", "攻略优化"), with a formula per zone; numbers given explicitly, no test logs or sample sizes except one note that a consumption-order test is based on a small sample. Version/date: article updated 2026-04-12 (created 2026-01-30); it refers to "公测后" (after open beta) changes but names no game version. The engine follows 1.6, so the article may predate it. The 1.2 in the table title is the spreadsheet's version, not the game's.

## Differences

### W1. A16, A17, B17: order of a reaction's initial hit relative to the hit that triggers it
- **Engine:** the triggering hit's own damage is computed first, then the reaction's initial hit (A17, B17 order list: "damage … reaction/burst/status damage"). The hit sees the status it applies (A16).
- **Source:** the article lists the steps when a status is added in this order: (1) the damage the status itself deals, (2) the status and its buff are triggered, (3) the basic, skill, finisher or combo hit (and Combustion damage) is dealt. So the reaction's damage comes before the triggering hit's damage, and the triggering hit comes last. Page: https://www.gamekee.com/zmd/691878.html ("状态添加" paragraph).
- **Basis:** unstated (no test given for this order); the article's consumption-order test is labelled as a small sample.
- **Impact if the source is right:** every reaction-causing skill hit. Reaction initial hits are 1.6–4.0 ATK (plus attribute 49); a difference matters when the reaction hit breaks or lands on a Staggered enemy (S6 ×1.3 timing), or when a buff that the triggering hit creates changes the reaction hit. Rough size: a few percent of one hit per trigger.
- **How we could test it:** a combat log read: find a reaction-causing skill hit and check whether the reaction's hit is logged before or after the skill hit's damage; or a scenario where the trigger breaks Stagger and the reaction hit gets or misses ×1.3.

### W2. P7: Crush hit and the action's damageMultiplier
- **Engine:** Crush's hit is (150% + 150% × n) × the action's `damageMultiplier` × attribute 25 × (1 + AI/100) (P7).
- **Source:** the article says a physical status's multiplier (Lift, Knock Down, Crush, Breach) is set by the physical-level formula only and is unrelated to the skill's own multiplier ("和原本的技能倍率无关"). Crush's table: 300 / 450 / 600 / 750% for 1–4 stacks, i.e. 150% × (n+1), as the engine. Page: https://www.gamekee.com/zmd/691878.html ("物理异常" tab).
- **Basis:** unstated (a rule statement, not a test); the article's values agree with the engine when the action's multiplier is 1.
- **Impact if the source is right:** only Crush actions whose `damageMultiplier` is not 1 (check the kit data). Crush hits are 3.0–7.5 ATK-equivalent, so any such kit would be off by its multiplier.
- **How we could test it:** a data read: list Crush actions in the kit data with `damageMultiplier` ≠ 1; an in-game test with a Crush hit from a kit that sets one.

### W3. K5, K10, K11: which energy sources get attribute 44 (ultimate charge efficiency)
- **Engine:** attribute 44 scales fixed energy grants (K11) only. Natural SP spent gives energy (K5) and the team's share is 0.065 × SP spent (K10), with no mention of attribute 44 in those rules.
- **Source:** the article says final energy gained = energy from any source × ultimate charge efficiency ("任意来源能量 × 终结技充能效率"). Page: https://www.gamekee.com/zmd/691878.html ("能量" line).
- **Basis:** unstated.
- **Impact if the source is right:** energy from SP-based sources (K5, K10) for builds with attribute 44 would be under-counted by the attribute-44 factor. Size: up to the attribute 44 bonus on those gains.
- **How we could test it:** first read the code path for K5/K10 to see whether 44 is applied there (the rule text may just be incomplete). If not, an in-game test: same SP spend with and without attribute 44, compare the energy bar.

## Engine silent (mechanics the source states that no rule covers)
- **Link decay:** the article says Link stacks ("连击") are capped at 4 and the effect "有衰减" (decays), but gives no details. The engine has a fixed 15 s stack life (K31) and no decay (K32). Page: https://www.gamekee.com/zmd/691878.html ("连击" section). It is unclear what decays (value, or time).
- **Consumption of reaction statuses (Electrification, Corrosion, Solidification):** the article gives a consumption order per status: 源石结晶 (Solidification): (1) linked damage, (2) the status and its buffs, (3) buffs created afterwards, (4) the consuming hit's damage. 腐蚀 (Corrosion) follows (2), (3), (4). 导电 (Electrification): (3) buffs created afterwards, (4) the consuming hit's damage, then (2) the status and its buff removed last, so the consuming hit still sees Electrification's vulnerability. The engine's consumption rule (A14) covers inflictions only; the order for reaction statuses is not stated. Page: https://www.gamekee.com/zmd/691878.html ("状态消耗" paragraph). The article says this test is a small sample.

## Agreements
- **D1, D3, D4, D5, D6, D7:** zones and additivity: the skill-type DMG (basic, battle, combo, ultimate) is in the same additive pool as element DMG and generic DMG buffs (D3); Amp, Susceptibility and damage-taken (易伤) are separate zones (D4–D6); Stagger, Link and the arts intensity are separate multipliers (D7, D19). Breach and Electrification sit in the damage-taken zone (D6).
- **D8, D9, E9:** ATK = ((operator + weapon) × (1 + ATK%) + flat) × (1 + attribute bonus); each main attribute point = 0.5% and each sub point = 0.2%; flat ATK from equipment sits in the flat slot.
- **D20, D21:** arts level coefficient 1 + (Lv − 1)/196 and physical level coefficient 1 + (Lv − 1)/392, with the trigger's operator level (R9).
- **R1:** defence reduction A/(A+100) (multiplier 100/(100+A)); most enemies DEF 100 gives ×0.5.
- **R4:** resistance zone = (100 − points)/100 with ignored resistance added as 0.01 per point; a 50-point enemy gives 0.5 and a 20-point ignore gives 1.2. The enemy tiers (0, 20, 50 points) are enemy data, not contradicted.
- **R8, A29:** Corrosion shreds all elements including Physical and Ether; start 3.6 / 4.8 / 6 / 7.2, +0.84 / 1.12 / 1.4 / 1.68 per second, cap 12 / 16 / 20 / 24 (exact match). The article says start and rate increase slightly with the applier's stats, as A29's arts-intensity factor does.
- **A32 (same level only):** reapplying Corrosion at the cap keeps the shred and only resets the duration. The article does not address a higher-level reapplication, so the cross-level case is open.
- **A5, A8, A20, A19:** arts burst independent of stacks (160% ATK); initial hit 80% + 80% × level for Electric, Cryo and Nature reactions; Shatter 120% + 120% × level; Combustion 10 s with 12% + 12% × level per second (10 ticks). The article's Combustion totals (4 / 6 / 8 / 10 at levels 1–4) equal the initial hit plus ten ticks in the engine's formula (1.6 + 2.4, 2.4 + 3.6, 3.2 + 4.8, 4 + 6). This is my reconstruction, not the article's own working.
- **A7, A10:** level from consumed stacks; a forced reaction is level 1 and has no initial hit, while the forced hit still sees the status's buffs (A16).
- **A12:** a lower-level Electrification overwriting a higher one loses value; this supports the engine's replacement with no max-merge (qualitative).
- **A22, A33 (partial):** the article warns that a status's own damage should not benefit from that status's buffs; the engine's A33 implements this for Corrosion's initial hit only.
- **A25:** Electrification damage-taken 12 / 16 / 20 / 24% by level. The article gives no AI or duration detail.
- **A38:** Shatter uses the arts level coefficient (120% + 120% × level) and is a status, not a skill hit.
- **D19, P9 (partial):** arts intensity applies to arts burst, arts infliction and physical statuses. Breach's damage-taken values 12 / 16 / 20 / 24% and durations 12 / 18 / 24 / 30 s (the article says the duration did not change in the update) match P9; the engine's P9 duration [ASSUMED] is supported by this.
- **P4, P5:** Lift and Knock Down hit 120% × physical level coefficient.
- **P7, P8:** Crush (猛击) 150% × (n+1) and Breach (碎甲) 50% × (n+1) with n = stacks: the article's multipliers match the engine's values (Crush 3 / 4.5 / 6 / 7.5; Breach 1 / 1.5 / 2 / 2.5). The article does not say whether stacks are consumed (P7, P8 consume all n); no conflict.
- **S7:** Stagger gives ×1.3 damage taken (30% for all enemies, Boss and common alike), separate from the damage-taken zone.
- **K31, K32:** Link gives +30 / 45 / 60 / 75% (battle) and +20 / 30 / 40 / 50% (ultimate) for 1–4 stacks, applied to the next battle skill or ultimate by anyone, and cleared on use; only 黎风's combo and 秋栗's talent give it (ordinary combos give none).
- **A16 (order step ②→③):** a status and its buff are active on the hit that triggered them.

## Not covered by the source
- **C (crit):** no crit formula or crit numbers in the article.
- **T (time):** no timing or frame data.
- **K (casting, SP, cooldowns; except K5, K10, K11, K31, K32):** not covered.
- **B (buffs):** only buff categories by zone, not lifetimes, snapshots, stacks or ordering.
- **N (enemies):** only the stagger vulnerability applying to all enemies; no rank, level or HP data (the codex link was not readable).
- **A26 (which elements Electrification applies to):** the article's "法术易伤" (arts vulnerability) would include Heat, Electric, Cryo and Nature; whether it includes Ether is not said, so A26 stays open.
- **A36, A37 (Solidification duration and control):** not in the article.
- **P13, R2, R3:** not covered.
- **Internal inconsistency to note:** the arts-status tab lists 猛击 (Crush) among arts effects, while the physical-status tab gives it the physical level coefficient. We follow the physical-tab formula, as the engine does (P7).
