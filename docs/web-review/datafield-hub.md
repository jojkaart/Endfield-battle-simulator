# Datafield and EndfieldHub: engine comparison

Sources (two sites, reported separately; DF- ids are arknightsendfield.gg, EH- ids are endfieldhub.org):

- arknightsendfield.gg (Datafield runs and a mechanics article). Pages read:
  - https://arknightsendfield.gg/character/typhoeus-build/ (three Datafield runs; the page text also has operator talent and kit lines)
  - https://arknightsendfield.gg/guide/arknights-endfield-combat-elemental-reactions/ (short combat article, "last updated October 27, 2026")
  - sitemaps and the guide index (https://arknightsendfield.gg/arknights-endfield-guide/) to find the pages; no other mechanics page exists in the page sitemap.
- endfieldhub.org. Pages read:
  - https://endfieldhub.org/guides/damage-formula
  - https://endfieldhub.org/guides/damage-deep-dive
  - https://endfieldhub.org/guides/reactions-deep-dive
  - https://endfieldhub.org/guides/stagger-system
  - https://endfieldhub.org/webmcp/find_enemy.json (59 enemies, as_of 2026-02-19, canonical_url https://endfieldhub.org/database/enemies)
  - https://endfieldhub.org/llms-full.txt (index only), https://endfieldhub.org/webmcp-tools (tool list, no rules)

Fetched 2026-11-12. About 15 requests in all, 3 s apart per host, with the research user agent. Page text is saved under the scratchpad folder `web/datafield-hub/`.

Basis in general:
- Datafield: the run pages give in-game totals credited to Datafield (team, gear, clear time, damage share); no per-hit data and no formulas. The combat article states no numbers or sources.
- EndfieldHub: its damage, reaction and stagger guides say they are based on the 666bj documentation (translated); the guides cite the 666bj source and its own game-data tables. Its enemy JSON is derived from the client tables and says so. Several of its statements contradict each other (noted per item). Its llms-full index credits the Talos Wiki, Prydwen, Game8, Mobalytics and datafield.cc.

Version/date: Datafield run page (Typhoeus) gives no run date; the page text carries a "V1.5" marker. Datafield combat article: October 27, 2026. EndfieldHub guides: 2026 editions, its tier lists "Version 1.6 Phase 2, November 5, 2026"; enemy JSON as_of 2026-02-19 (pre-1.6 data). Engine follows 1.6 data.

Overall: EndfieldHub is the only source here with rule-level statements. Datafield has one rule-level claim (Lift and Knock Down add Stagger), which EndfieldHub also makes (EH-7). Several EH-vs-engine differences are contradicted inside EH itself, so each is marked with that conflict.

## Differences

### DF-1. S3, P6: Lift and Knock Down add Stagger
- **Engine:** Only kit hits with `poise` deal Stagger; Lift, Knock Down, reactions, statuses and Shatter deal none. Lift and Knock Down deal no Stagger of their own (S3, P6; P6 has one log exception marked [OPEN]).
- **Source:** The combat article calls Lift and Knock Down "increases Stagger" without numbers. https://arknightsendfield.gg/guide/arknights-endfield-combat-elemental-reactions/
- **Basis:** Unstated (no test, no data cited). Version/date: article updated 2026-10-27.
- **Impact if the source is right:** Each Lift or Knock Down adds some Stagger; teams with many Vulnerable generators reach Stagger earlier and get more 1.3x windows. Size unknown (the source gives no value). EH-7 gives 10 points each, which is the same claim with a number.
- **How we could test it:** Stagger bar delta on a Lift or Knock Down with no other poise source (in-game test on a training dummy, or a ZMDLogs check of the Stagger field around Lift hits, which would also resolve the P6 log exception).

## Engine silent (mechanics the source states that no rule covers)

Datafield:
- Breach "breaks shields and armour" (combat article, Breach entry). Engine: enemy shields and damage-reduction phases are not modelled (D28, N7).
- Solidification "applies crowd control" (combat article, generic). Engine: no freeze or control from Solidification (A37). Covered by EH-4 for the specific claim.
- Stagger Node effects: the article says the enemy is interrupted and immobilized at a node. Engine: a node raises an event only (S11). Immobilization has no rule.
- Heavy attack backswing and animation cancelling by dodge or skill (combat article). Engine: no animation or hit-stop model (T10).
- Operator talent lines on the Typhoeus page (Perlica: Electric DMG +50% for 10 s after Electrification; Arcane: Heat DMG +50% after Combustion, Nature DMG +50% after Corrosion; Liino: teammates' DMG Dealt +16% for 15 s, "cannot stack"; Protective Barrier shattering). These are kit data, not rules. No conflict found with B1/B5 or D3 as described, but the engine values are in the kit data and were not checked.

EndfieldHub:
- Enemy-side damage reduction and shields (Tidewalker Statue: takes 50% less from non-Combustion types; shields taking 90% less). Engine: no enemy damage-reduction zone (D28, N7).
- Non-controlled operator damage reduction on boss attacks (coefficients 0 to 0.7). Engine: enemy damage is not simulated (N8). Operator-side, so out of scope for the outgoing damage.
- Stagger state: enemy cannot act. Engine: enemy actions are scenario inputs (N8), no rule.
- Post-stagger cooldown: accumulation halved for 1 / 3 / 5 / 10 s after a Stagger ends (Common / Advanced / Elite / Boss). Engine: nothing (S10 says only that the bar refills when a Stagger ends).
- Charge interrupts: a skill hit during an enemy's charge adds Stagger (15 or 20 base; 60 to 100 on some enemies). Engine: no rule.
- Electrification chains damage to nearby enemies. Engine: one enemy (K37), no chain.
- Laevatain and Yvonne cannot execute a Finisher while in their Ultimate (stagger guide). Engine: finisher gating is not in S13; ultimate gating is [OPEN] (K25).
- Industrial Explosives: "ATK x 120% + 1250" (a flat term added to the ATK-scaled term). Engine: D12/D13 describe a base that replaces ATK and a level scale; whether an ATK-scaled term can carry a flat addend is not stated in the rules. Unclear, check the scale formula in the engine.
- Gear substats carry hidden decimals (Arts Intensity 55 displayed = 55.2 actual; DEF 21 = 21.6 at some gear levels). The source says the decimals change effect enhancement. Engine: D10 floors only the ATK attribute bonus; whether attribute 87 and the DEF lines keep decimals is not stated. Check data values against the panel.
- Finisher damage type: the stagger guide says Finisher damage counts as Basic Attack damage (so Normal Attack DMG bonuses apply); the damage guide lists Finishers under "All Skill DMG Boost". Engine: the skill type of a finisher hit is not stated (D3, D17). Source is internally inconsistent; check the finisher's skill type in the data.

## Agreements

Datafield: no rule-level agreement claims beyond what the Datafield article shares with the others. Its statements (Vulnerable is the core debuff; Crush consumes all stacks; Breach and Crush are the finishers of the physical loop; Arts Burst on same-element stacks) match P1, P7, P8 and A4/A5. The run totals check out internally (damage shares sum correctly; e.g. 5,357,815 / 7,089,179 = 75.6%).

Datafield run timing (not a rule claim): the clear times and the team DPS on each run imply 66.2 s, 64.9 s and 74.6 s, i.e. the times are rounded. No conflict with T1; noted for a sanity fixture only.

EndfieldHub (rule ids the source confirms):
- D1, D2 are not stated by EH. D3: the damage-bonus pool is additive and includes element, skill-type and Stagger DMG bonuses (EH damage guide). D4: amplification is one additive zone per element. D5: susceptibility is an additive zone. D6: Electrification and Breach increase damage taken; D7: Stagger x1.3 and Finisher x1-1.75 are multiplicative; Link is multiplicative.
- D8, D9, D10, D11: ATK = ((base + weapon) x (1 + %) + flat) x attribute bonus; attribute bonus = 1 + 0.005 x primary + 0.002 x secondary; integer part of attributes.
- C1, C2, C3: base crit 5% and CDMG 50%; crit multiplier 1 + CDMG on a crit, expected 1 + rate x CDMG. C4: DoT (Combustion ticks) cannot crit; reaction damage can crit (the reaction formula lists Critical Hit).
- R1 and N2: enemy DEF 100 at every level, factor 0.5 (EH: 100 / (DEF + 100), same as 1 / (1 + 0.01 DEF)). R2: the negative-DEF formula 2 - 0.99^(-DEF) is the same as the engine's. R4: resistance factor = 1 - points/100 + ignored/100; grades (D 0, C 20 giving 0.8, B 50 giving 0.5) match find_enemy. R5: a D-grade enemy with -20 points takes 20% more (EH Laevatain example); EH also states a 0.1 floor, which is in the operator-resistance paragraph and does not conflict at reachable values.
- N3, N4: find_enemy resistances are level-independent per enemy (1, 0.8 or 0.5 multipliers); Marble Appendage has Stagger HP 0 (unstaggerable, S1 and N4).
- A2: an infliction holds up to 4 stacks. A5: Arts Burst 160% (1.6). A7: reaction stage = consumed stacks (1 to 4). A8: reaction initial hit 80% x (1 + stage), giving 4.0 at stage 4 (also the EH table, which says 400%). A19, A20, A21: Combustion lasts 10 s; each tick 12% x (1 + stage) of ATK, 10 ticks, no crit.
- A25, A27, A31: Electrification +12/16/20/24% Arts damage taken for 12/18/24/30 s; enhancement 2 AI / (AI + 300) (EH reactions guide).
- A26 (scope): EH says Electrification affects Arts damage only, which fits A26's listed hits; the Physical-hit exclusion is consistent.
- A28, A29, A30, A31, A32: Corrosion shreds resistance, starting 3.6/4.8/6/7.2, +0.84/1.12/1.4/1.68 per second, capped at 12/16/20/24, for 15 s, enhanced by AI with the same 2 AI/(AI+300) curve; a refresh keeps the current value (EH reactions guide, same numbers). The 10 s ramp to the cap matches the engine's ramp at level 1.
- A38: Shatter is triggered by applying Vulnerable or a Physical status to a Solidified enemy and consumes the Solidification (EH reactions guide). Base 120% x (1 + stage) matches (120% + 120% x level) if stage = level.
- P1: Vulnerable max 4 stacks. P4, P5: Lift and Knock Down hits 120% ATK Physical, adding one Vulnerable. P7: Crush consumes all stacks, 150% x (1 + n). P8: Breach consumes all stacks, 50% x (1 + n). P9: Breach gives +12/16/20/24% Physical damage taken for 12/18/24/30 s by stage (EH reactions guide; the formula guide's DEF wording is EH-8).
- D19 scope: EH lists Arts Intensity on Crush, Combustion, Solidification, Shatter, Arts Burst, Breach, Electrification and Corrosion; engine D19 scales the same kinds. The Lift and Knock Down AI damage term matches D19 as well.
- D20, D21: Arts level coefficient 1 + (Lv - 1)/196 (1.454 at Lv 90) for reactions and Arts Burst; Physical 1 + (Lv - 1)/392 (1.227) for Physical statuses.
- S2: Stagger = poise x efficiency; base efficiency per the EH stagger guide is Stagger Efficiency (+20% from Swordmancer, the only known source), which fits attribute 26 with default 1. S7: Stagger Frailty 1.3x on Staggered enemies, separate from the additive "DMG vs Staggered" bonus (EH damage and stagger guides). S13: one Finisher per Stagger (the first Normal Attack). S14: Finisher coefficient 1 / 1.25 / 1.5 / 1.75 by tier (find_enemy and stagger guide agree). S15: finisher SP 25 / 35 / 50 / 100 by tier (find_enemy finisherSpGain agrees, with Alpha 50).
- S9: Stagger duration is per enemy (find_enemy staggerRecovery ranges 6 s to 24 s, most 6 s; engine: attribute 21 in 6 to 24 s, most 6, 7 or 9). Values in the data should be compared (not done here).
- K32: Link numbers: Battle Skills +30/45/60/75% and Ultimates +20/30/40/50% for 1 to 4 stacks; multiplicative; Link is consumed by the next Battle Skill or Ultimate (for scope, see EH-9).

## Not covered by the source

Datafield: nothing beyond the items above. Its runs give end-to-end totals only, so they cannot check any rule group. The run page is a sanity fixture at most (a full simulation would need rotation and gear, which the page gives only partly).

EndfieldHub: D12 (scale per level; only the Industrial Explosives example), D15 to D18 (decoration and type masks, beyond finisher type), D22 to D28 (except the items listed above), C5 to C7 (crit modes and rolled crits), A1, A3, A6, A9 to A18, A22 to A24, A33 to A35 (reaction and status clock and snapshot details), P2, P3, P6, P10 to P13 (except Lift and Knock Down Stagger, EH-7), S4 to S6, S8, S10 to S12 (except the post-stagger cooldown above), T1 to T21 (time, holds, slow-downs, dives), K1 to K31 (casting, SP, energy, cooldowns, combo windows; EH gives only the SP for Finishers), B1 to B24 (buffs), E1 to E11 (equipment; EH gives only Swordmancer, gear substat decimals and Link), N5 to N11 (enemy ranks, HP, freezes and immunity; EH's staggerHp per enemy in find_enemy is not compared here).

## DF-items summary for the cross-site comparison

- Lift and Knock Down add Stagger (DF-1). Also stated by EH-7 (with 10 points each). Two sites agree.

## EndfieldHub differences

Each item below is EH's own claim; where EH contradicts itself, both places are quoted by page.

### EH-1. A29, A28, R8: Corrosion is a damage-over-time effect (formula guide, amp table)
- **Engine:** Corrosion is a resistance shred and deals no damage over time (A28, A29; the initial hit is A33). Resistance shred enters the ignore-resistance zone (R8).
- **Source:** The formula guide describes Corrosion as "a powerful damage over time effect that can stack", and the amplification table lists "Nature damage and Corrosion DoT" (https://endfieldhub.org/guides/damage-formula, https://endfieldhub.org/guides/damage-deep-dive). The EH reactions guide (https://endfieldhub.org/guides/reactions-deep-dive) describes the same resistance-reduction effect as the engine, so the EH pages disagree.
- **Basis:** Unstated in the formula guide; the reactions guide cites the 666bj documentation. Version/date: 2026 editions.
- **Impact if the source is right:** Corrosion would add ticks (unknown size) and Nature Amp would apply to them. The engine would miss that damage entirely.
- **How we could test it:** Corrosion ticks in a ZMDLogs battle log (any damage events at a fixed interval after the Corrosion application); an in-game test with Corrosion on a training dummy and the damage read from the hit log.

### EH-2. A22, B21: Combustion ticks do not snapshot
- **Engine:** Combustion ticks take the applier's attacker side (ATK %, attributes, DMG bonus, Amp, crit stats, Arts Intensity) from application (A22, B21); the defender side is read at each tick.
- **Source:** "The DOT does not snapshot and scales dynamically with buffs" (formula guide, Combustion entry). https://endfieldhub.org/guides/damage-formula
- **Basis:** Unstated. The reactions guide, which cites the 666bj documentation, says nothing on snapshots.
- **Impact if the source is right:** Any buff gained during a Combustion (Heat DMG, Heat Amp, ATK %, Arts Intensity) would raise the remaining ticks, not only the ones after application. Roughly 10 ticks of 12% to 60% ATK each per Combustion, so a late buff could change a Combustion's total by several percent.
- **How we could test it:** In-game test: apply a Heat DMG or Amp buff mid-Combustion and compare tick sizes; or ZMDLogs ticks before and after a buff.

### EH-3. A36: Solidification duration is 6 / 7 / 8 / 9 s
- **Engine:** 5.75 / 6.75 / 7.75 / 8.75 s by level (A36, marked [OPEN]); the engine notes say the native settings give 6 to 9 s.
- **Source:** Duration "6/7/8/9 seconds based on Reaction Stage" (reactions guide). https://endfieldhub.org/guides/reactions-deep-dive
- **Basis:** Unstated (the page credits the 666bj documentation). Version/date: 2026 edition.
- **Impact if the source is right:** Each Solidification lasts 0.25 s longer. Small, but it matters for the Solidification-to-Shatter window, and the engine's odd values look like an offset.
- **How we could test it:** Read the Solidification duration from the native settings or the status data (not done here) and compare with 6 / 7 / 8 / 9.

### EH-4. A37, P13, T12: Solidification immobilizes the enemy
- **Engine:** Solidification has no damage modifier and does not freeze or control the enemy (A37).
- **Source:** "Immobilizes enemy" (reactions guide, Solidification entry), and "Stagger immobilizes enemies" (stagger guide). https://endfieldhub.org/guides/reactions-deep-dive, https://endfieldhub.org/guides/stagger-system
- **Basis:** Unstated (the reactions guide cites the 666bj documentation). Version/date: 2026 editions.
- **Impact if the source is right:** An immobilized enemy would stop its clock (T12, N9) for 6 to 9 s, which holds every other timer (T6). Team timing of Solidification windows would change. Size depends on the enemy and the rotation.
- **How we could test it:** Check whether the Solidification status in the data carries a `freezes` or control entry (a data read); if it does, the engine's A37 is wrong. Otherwise an in-game check: does the enemy's attack animation or cooldown pause?

### EH-5. D20, A38: Shatter uses the physical level coefficient
- **Engine:** Shatter damage is multiplied by attribute 49 (Arts level coefficient, 1 + (Lv - 1)/196), so 1.454 at Lv 90 (D20, A38).
- **Source:** The reactions guide lists Shatter under "Physical Status (Vulnerable, Breach, Crush, Shatter)", whose level coefficient is 1 + (Lv - 1)/392 (max 1.227). https://endfieldhub.org/guides/reactions-deep-dive
- **Basis:** Unstated; the page credits the 666bj documentation. The same page's Shatter numbers (349% at stage 1, 872% at stage 4) equal 240% and 480% multiplied by 1.454, and 872% also has an unexplained 1.25 factor, so its own table uses the Arts coefficient. This is a second point against its classification.
- **Impact if the source is right:** At Lv 90, Shatter would be 1.227 instead of 1.454, i.e. about 16% less damage in EH's rule; the engine is about 18.5% higher than EH's rule.
- **How we could test it:** Shatter hits at a known level in ZMDLogs (or an in-game test at Lv 1 and Lv 90 with the same stage) to get the ratio; the ratio alone separates 1.454 from 1.227 (1.185x).

### EH-6. D19, A8, A20: Arts Intensity does not act on reaction initial hits
- **Engine:** Arts Intensity multiplies reaction initial hits by (1 + AI/100) (A8, and D19 for reactions), and Combustion ticks likewise (A20).
- **Source:** "Initial hits: not affected by Arts Intensity (only the reaction itself)" (reactions guide). The same page's Arts Intensity section says +1% damage for Combustion, Solidification and Shatter, which conflicts with its own initial-hit line. https://endfieldhub.org/guides/reactions-deep-dive
- **Basis:** Unstated. Internally inconsistent.
- **Impact if the source is right:** At 100 AI the engine's reaction initial hit is 2.0x, while EH's would stay 1.0x, so the engine would overstate those hits by 100% at that AI. Scales with AI; large if true.
- **How we could test it:** In-game test: a reaction's initial hit at 0 AI and at a known AI (equipment or buff), compare the ratio; or ZMDLogs reaction hits at different AI.

### EH-7. S3, P6: Lift and Knock Down add 10 Stagger each, with +0.5% per AI point
- **Engine:** Lift and Knock Down deal no Stagger of their own (S3, P6; P6 has one log exception marked [OPEN]).
- **Source:** Each of Lift and Knock Down "accumulates 10 Stagger points" and "+1% damage + 0.5% stagger" per Arts Intensity point (reactions guide, Vulnerable and Arts Intensity sections). The stagger guide says Lift or Knock Down "accumulates additional Stagger" and advises timing them for Stagger. https://endfieldhub.org/guides/reactions-deep-dive, https://endfieldhub.org/guides/stagger-system
- **Basis:** Unstated (the stagger guide cites the 666bj documentation). Version/date: 2026 editions.
- **Impact if the source is right:** Each Lift or Knock Down adds 10 Stagger (about 10 times the poise of a normal hit in the same cast, depending on the enemy's bar); one physical loop could fill a bar. Breaks the S3 rule for every Lift and Knock Down.
- **How we could test it:** Stagger bar change on one Lift with no other Stagger source (in-game test on a dummy), or a ZMDLogs check of the Stagger field around Lift hits (also resolves the P6 log exception). Same test as DF-1.

### EH-8. R2, R3, P9: Breach reduces enemy DEF (negative DEF)
- **Engine:** Breach increases Physical damage taken by 12 to 24% (damage-taken zone, D6, P9). No DEF shred and no DEF-ignore zone exists (R3); no buff lowers DEF in the data (R2).
- **Source:** The formula guide says Breach "reduces enemy Physical defense", and the damage deep-dive says Breach "reduces enemy Physical DEF: can push negative", and "Breach pushing enemy DEF negative dramatically amplifies Physical damage for the entire team". https://endfieldhub.org/guides/damage-formula, https://endfieldhub.org/guides/damage-deep-dive. The reactions guide says Breach is a 12 to 24% Physical damage-taken effect ("Physical Fragility"), which matches the engine. The deep-dive also says Breach is "Physical Fragility".
- **Basis:** Unstated (the deep-dive credits the 666bj documentation). The data-sources note already records that EH's negative-DEF claim contradicts the Talos Wiki.
- **Impact if the source is right:** Enemy DEF at 0 gives a factor of 1.0 (twice the 0.5 at DEF 100); at DEF -20 the EH formula gives 1.18, about 2.4 times the engine's 0.5. A very large effect on Physical teams.
- **How we could test it:** A Breach on a dummy and the Physical damage ratio before and after (the engine's prediction is a 12 to 24% gain); the ratio separates the two claims immediately.

### EH-9. K32: Link applies to one hit only
- **Engine:** The Link bonus from the next Battle Skill or Ultimate applies to all of that cast's hits until its last hit (K32).
- **Source:** "Link applies to one hit and then resets" (damage deep-dive, Link section, and common mistakes 9). The formula guide says Link "only applies to one attack per use". https://endfieldhub.org/guides/damage-deep-dive, https://endfieldhub.org/guides/damage-formula
- **Basis:** Unstated (the deep-dive credits the 666bj documentation).
- **Impact if the source is right:** For a multi-hit Battle Skill, the engine adds +30 to +75% (or +20 to +50% for Ultimates) to every hit, while EH counts it once. For a 5-hit Battle Skill, the difference is up to four hits' worth of the bonus.
- **How we could test it:** A multi-hit Battle Skill after a Link in a ZMDLogs battle log: are the later hits boosted (engine) or not (EH)? Or an in-game test on a dummy with Link stacks.

### EH-10. S11: Stagger nodes at 33% and 66% give a 2.5 s immobilize and 1.3x damage
- **Engine:** A Stagger node (`poiseKnotPctList`, e.g. 50%) raises a `staggerNode` event when the bar crosses it from above; it has no damage effect (S11).
- **Source:** "Stagger nodes at 33% and 66% of Stagger value cap"; a partial Stagger "gives 2.5 seconds of immobilization and 1.3x damage increase", for Elite and Boss enemies (stagger guide). The Datafield combat article says a node interrupts the enemy and immobilizes it briefly. https://endfieldhub.org/guides/stagger-system
- **Basis:** Unstated (the stagger guide cites the 666bj documentation).
- **Impact if the source is right:** On Elite and Boss enemies, two extra 2.5 s windows of x1.3 per Stagger cycle (unless the node is ignored by the enemy). Large for bosses.
- **How we could test it:** Check the `poiseKnotPctList` values in the data for Elite and Boss enemies (is 33% and 66% there?), then a boss test at a node: does the damage ratio show 1.3x for 2.5 s?

### EH-11. D6: Arts Fragility and Physical Fragility are separate multiplicative categories
- **Engine:** Electrification, Breach and "target takes DMG +x%" effects are one additive zone (D6).
- **Source:** "Arts Fragility" (Electrification) and "Physical Fragility" (Breach) are "two separate multiplicative categories" (damage deep-dive, Fragility section). https://endfieldhub.org/guides/damage-deep-dive
- **Basis:** Unstated.
- **Impact if the source is right:** On one hit, only one of Electrification (Arts) or Breach (Physical) applies, so the zones do not meet and the numbers agree. They differ only when a generic "takes DMG +x%" effect (e.g. Xaihi's Execute Process, an Arts Fragility) joins an Electrification on the same Arts hit: additive gives 1 + 0.24 + 0.20 = 1.44; EH's multiplicative split gives 1.24 x 1.20 = 1.488 (about 3% more).
- **How we could test it:** Only needed if the generic-fragility talents are in scope; a data check of the zone assignment of talent fragility effects.

### EH-12. D14: True Damage bypasses Defense only, not every zone
- **Engine:** Fixed DMG hits (`fixedDamage`) deal their exact value: every zone x1, no crit, DEF, RES or Stagger (D14).
- **Source:** "True Damage bypasses the Defense multiplier"; the rest of the formula still applies (damage deep-dive, opening). https://endfieldhub.org/guides/damage-deep-dive
- **Basis:** Unstated. The engine's fixed DMG and EH's true damage may not be the same category; the source does not name in-game examples.
- **Impact if the source is right:** A true-damage hit would also take DMG bonus, Amp, Susceptibility, damage-taken and Stagger zones in EH's model, and the engine omits them. Size depends on the hit; the source gives no example values.
- **How we could test it:** Find the hits with a "true damage" or fixed tooltip in the data and compare their zones with D14; if the game shows an in-game example, compare the damage on a dummy.

### EH-13. A4: Arts Burst on same-element stacks (cap wording)
- **Engine:** Each same-element application triggers one Arts Burst, including at 4 stacks (A4); burst damage is 160% of the element and does not depend on stacks (A5).
- **Source:** Formula guide: "Applying the 2nd, 3rd, and 4th stack triggers an Arts Burst". Reactions guide: a same-element infliction "stacks one additional layer (up to 4) and deals 160%". https://endfieldhub.org/guides/damage-formula, https://endfieldhub.org/guides/reactions-deep-dive
- **Basis:** Unstated.
- **Impact if the source is right:** A same-element application at 4 stacks would deal no burst; the engine adds one per application. A small difference per cast, but it repeats on every 4-stack cycle.
- **How we could test it:** Arts Burst count per same-element application at 4 stacks in ZMDLogs or an in-game test.

### EH-14. D4: Physical teams have no Amp (EH) vs a physical Amp attribute in the engine
- **Engine:** Amp is one additive zone per element (D4), and the attribute table has a physical enhanced-damage attribute (`PhysicalEnhancedDmgIncrease`, attributes.ts, `ELEMENT_AMP`).
- **Source:** "Physical teams have no access to Amplification" (damage deep-dive, Amplification section and common mistakes 10). https://endfieldhub.org/guides/damage-deep-dive
- **Basis:** Unstated.
- **Impact if the source is right:** None, unless a kit or gear gives physical Amp; then the engine would count it and EH would not. Low priority.
- **How we could test it:** Search the data for any physical Amp source. If none exists, the engine's physical Amp entry is unused and this is no difference.

## Engine silent (mechanics the source states that no rule covers)

These are the Engine silent items for EndfieldHub. Datafield's are listed above, with its only difference (DF-1).

- Enemy-side damage reduction and shields (Tidewalker Statue; 90% shield reduction): damage-reduction and shield phases are not modelled (D28, N7). https://endfieldhub.org/guides/damage-deep-dive
- Non-controlled operator damage reduction (boss coefficients 0 to 0.7): enemy damage not simulated (N8); operator-side. https://endfieldhub.org/guides/damage-deep-dive
- Stagger state: the enemy cannot act. No rule (N8). https://endfieldhub.org/guides/stagger-system
- Post-stagger cooldown: the accumulation halves for 1 / 3 / 5 / 10 s after a Stagger ends (by tier). No rule (S10 only says the bar refills). https://endfieldhub.org/guides/stagger-system
- Charge interrupts (a skill hit during an enemy's charge adds 15 or 20 Stagger; 60 to 100 on some enemies). No rule. https://endfieldhub.org/guides/stagger-system
- Electrification chains damage to nearby enemies. No rule (K37, one enemy). https://endfieldhub.org/guides/reactions-deep-dive
- Laevatain and Yvonne cannot Finisher during their Ultimate. S13 has no gating, K25 leaves ultimates [OPEN]. https://endfieldhub.org/guides/stagger-system
- Chen Qianyu's combo skills do not add Stagger (the stagger guide's exception to "combo skills accumulate Stagger"). Not in S2/S3 notes; check the data's poise for her combo. https://endfieldhub.org/guides/stagger-system
- Finisher damage type (Basic Attack or skill): EH's damage guide lists Finishers under "All Skill DMG Boost", its stagger guide calls Finisher damage Basic Attack damage. Engine: type not stated (D3, D17). https://endfieldhub.org/guides/damage-deep-dive, https://endfieldhub.org/guides/stagger-system
- Industrial Explosives style "ATK x x% + flat": a flat addend next to the ATK-scaled term (D12, D13 unclear). https://endfieldhub.org/guides/damage-formula
- Gear substat decimals (Arts Intensity 55.2, DEF 21.6): the source says the decimals change effect enhancement. Engine D10 floors the ATK attribute bonus only; check that attribute 87 and the effect values keep decimals. https://endfieldhub.org/guides/reactions-deep-dive, https://endfieldhub.org/guides/damage-deep-dive
- Animation cancelling and heavy-attack backswing (Datafield combat article; EH does not describe it): no hit-stop model (T10).

## Not covered by the source

Datafield covers only end-to-end run totals and one combat article, so it checks no rule group beyond P and A in outline. EndfieldHub's damage, reaction and stagger guides cover D, C, R, A, P, S and parts of K and E; they say nothing on T (time, holds, slow-downs), most of K (casting, SP, energy, cooldowns, combo windows), B (buffs and stacking types), the rest of E, or N (enemy ranks, freezes and immunity). Rule ids not listed in either site's Agreements are in this group.

Practical note: the EH rule statements conflict with EH's own other pages on Corrosion (EH-1), Breach (EH-8), Shatter (EH-5), Arts Intensity on initial hits (EH-6), Finisher damage type and the Arts Burst cap (EH-13). Treat any single EH claim with that in mind; the data-sources note already marks EH as not independent of the Talos Wiki.
