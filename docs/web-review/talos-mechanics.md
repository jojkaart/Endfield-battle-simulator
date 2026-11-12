# Talos Wiki (Part 2, combat mechanics): engine comparison

Source: https://endfield.wiki.gg/wiki/<Title> (api.php action=parse, prop=wikitext), pages read: Arts Reaction, Arts Infliction, Arts Burst, Combustion, Electrification, Solidification, Corrosion, Shatter, Physical Status, Vulnerability (the "Vulnerable" title redirects here), Lift, Knock Down, Crush, Breach, Stagger, Ultimate Energy, Skill Points (the "SP" title redirects here), Combo Skill/Instant Protocol: Chain, Combat Mechanic, Link. Fetched 2026-11-12. No separate time-stop or slow-down page exists (a title search for "time stop" returned none). Requests: 27 in total.

Basis in general: not stated on the pages; community-written wiki. Numbers look table-derived, and no page describes its values as in-game tests. Several pages carry a "Patch-dependent" tag. The changelogs name Beta Test I/II and the versions "At the Wake of Spring" and "Dreamscape of Wind and Snow" but give no version number for the current values, so they cannot be mapped to game 1.6 here. Version/date: not given (fetched 2026-11-12).

## Differences

### W1. S3, P6: Lift and Knock Down deal Stagger
- **Engine:** physical-status hits deal no Stagger (P6, settled, one log exception open); only kit hits with `poise` do (S3).
- **Source:** on a Vulnerable target, Lift and Knock Down each deal their Physical hit, apply 10 Stagger, and add one Vulnerable stack. The Stagger page lists Physical Statuses among the things that fill the Stagger meter. The Crush and Breach pages state no Stagger. Pages: https://endfield.wiki.gg/wiki/Lift, https://endfield.wiki.gg/wiki/Knock_Down, https://endfield.wiki.gg/wiki/Stagger, https://endfield.wiki.gg/wiki/Physical_Status
- **Basis:** unstated.
- **Impact if the source is right:** every Lift or Knock Down on a Vulnerable target adds 10 Stagger. That fills the bar faster in Lift-heavy rotations and moves the Stagger window (S7, S9) earlier. The size depends on each enemy's bar (attribute 20), which is not on the wiki page.
- **How we could test it:** in game, apply a Lift to a Vulnerable enemy with a known bar and read the meter before and after. Data: check whether the Lift and Knock Down skill-patch entries carry a poise field, and whether the attribute-20 values match the bar sizes the wiki implies.

### W2. P4, P5: Lift and Knock Down durations
- **Engine:** Lift status 3 s (P4); Knock Down status 10 s (P5).
- **Source:** on Lift and Knock Down, weaker enemies are unable to act for 1 second. Some operators lift for longer (Chen Qianyu is named). Pages: https://endfield.wiki.gg/wiki/Lift, https://endfield.wiki.gg/wiki/Knock_Down
- **Basis:** unstated.
- **Impact if the source is right:** if the engine's value is the crowd-control window, it is 3 times too long for Lift and 10 times too long for Knock Down. If it is a different state (for example the Lifted debuff), the wiki gives no duration for it, and the 1 s is only the action lock.
- **How we could test it:** in game, Knock Down a weak enemy and time how long it cannot act. Data: find which field the 3 s and 10 s values sit in and what they gate (action lock, debuff, or enemy clock).

### W3. A37, S8: Solidification and Staggered enemies cannot move or act
- **Engine:** Solidification does not freeze or control the enemy (A37). Staggered enemies are not made immobile; S8 only stops Stagger from landing on them.
- **Source:** Solidification "prevents the enemy from taking action" for 5.75 to 8.75 s by level. Staggered enemies are "immobile for a while". Pages: https://endfield.wiki.gg/wiki/Solidification, https://endfield.wiki.gg/wiki/Stagger
- **Basis:** unstated.
- **Impact if the source is right:** enemy actions are not simulated (N8), so the only effect in the engine would be if the immobility also stops the enemy clock (P13, T12). That would hold the Stagger timer (S9, S12), Vulnerable, inflictions, Combustion ticks and debuffs for the same time. Up to 8.75 s per Solidification.
- **How we could test it:** in game, apply Solidification to an enemy that has a visible 20 s timer (Vulnerable, Combustion) and check whether the countdown pauses. Repeat during Stagger.

### W4. A8, A36: reaction initial damage tables disagree within the wiki
- **Engine:** every reaction's initial hit is 160 / 240 / 320 / 400% ATK by level (A8). Solidification lasts 5.75 / 6.75 / 7.75 / 8.75 s (A36).
- **Source:** the Solidification and Corrosion pages give 160 to 400% ATK in the introduction, but their level tables list 240 / 360 / 480 / 600% ATK for Levels I to IV. The Combustion and Electrification pages use 160 to 400% in both the text and the tables, which matches the engine. Shatter's 240 to 600% matches A38. Pages: https://endfield.wiki.gg/wiki/Solidification, https://endfield.wiki.gg/wiki/Corrosion
- **Basis:** unstated; the page contradicts itself.
- **Impact if the table is right:** Solidification and Corrosion initial hits would be 1.5 times the engine's at Level I (2.4 against 1.6 ATK), and the same ratio at each level. This is one hit per reaction, so the size is small, but Solidification's hit is the one the engine would under-count.
- **How we could test it:** in game, trigger Solidification and Electrification from the same kind of setup and compare the damage numbers at Level I. Log check: find Solidification applications and compare the initial hit with the operator's ATK.

### W5. A32: Corrosion carry-over is not clamped to the new cap
- **Engine:** a new Corrosion starts from max(running shred now, its own start), then clamps to its own cap at its first tick.
- **Source:** if a new Corrosion lands on an enemy with Corrosion, its reduction equals the old one's if that is higher. If the carried value is above the new Corrosion's maximum, the new one "won't be further increased", so the carried value is kept and not clamped. Page: https://endfield.wiki.gg/wiki/Corrosion
- **Basis:** unstated.
- **Impact if the source is right:** only when a weaker Corrosion overwrites a stronger one that is still above its cap. Example: a Level IV Corrosion (cap 24) at 20 overwritten by a Level I one (cap 12). The source keeps 20; the engine drops to 12 at the first tick, and this is the difference per enemy in that window.
- **How we could test it:** in game, apply a Level IV Corrosion, then a Level I one, and read the enemy's resistance display. Log check: find overwrite cases in the logs and compare the shred values.

### W6. K1: natural SP regeneration pause after a spend
- **Engine:** natural regeneration stops for 1.5 s (45 frames) after any SP spend (K1, marked assumed; the regen rate and pause are open).
- **Source:** natural regeneration is 8 SP per second. Perfect Dodge "pauses the natural regeneration for half a second". The page says nothing about a pause after a spend. Page: https://endfield.wiki.gg/wiki/Skill_Points
- **Basis:** unstated.
- **Impact if the source is right:** each spend in the engine blocks up to 12 SP of regeneration (1.5 s at 8 SP/s) that the source says would come back. That is up to a dozen SP per cast, which matters in SP-limited rotations.
- **How we could test it:** in game, spend 100 SP and time how long until the bar starts to refill. Log check: compare SP samples right after spends with the 8 SP/s rate.

### W7. T18: Perfect Dodge gives about 7.5 SP and pauses regeneration for 0.5 s
- **Engine:** +7 natural SP for a Perfect Dodge (T18, marked open: 7 or 7.5). The regeneration pause rule is the one in W6.
- **Source:** Perfect Dodge recovers "approximately 7.5 SP" and pauses natural regeneration for half a second. Page: https://endfield.wiki.gg/wiki/Skill_Points, and the Combat Mechanic page for the dodge.
- **Basis:** unstated (approximate).
- **Impact if the source is right:** 0.5 SP per dodge, plus a 0.5 s regeneration pause (about 4 SP) that the engine does not model for dodges.
- **How we could test it:** in game, read SP just before and just after a Perfect Dodge, repeated over several dodges to average out rounding.

### W8. K31: Link duration is fixed at 15 s
- **Engine:** a team Link stack lasts 15 s (K31). Stacks use the same length.
- **Source:** each Link buff "has an independent duration" set by the skill that grants it. Camille's Link lasts 15 s, and an Akekuri potential extends the Link by 5 s. Page: https://endfield.wiki.gg/wiki/Link
- **Basis:** unstated.
- **Impact if the source is right:** Links from other sources with shorter or longer durations would be wrong in the engine. The effect is limited to the window after a Link is given.
- **How we could test it:** data: check whether ComboAction `link` entries carry their own duration. If they do, the 15 s in K31 is only the default. The Link page's wording of "diminishing returns" contradicts its own table, which adds 15 points per stack (linear), and the engine follows the table (K32).

## Engine silent (mechanics the source states that no rule covers)

- Forced Arts Burst: Typhoeus's skill can "forcibly apply" a Nature Burst with no Nature Infliction present (Arts Burst page). A10 covers forced reactions only.
- Electrification effect bonuses: the Electrification page gives a formula where "+x%" bonuses are summed and then "×x" multipliers are multiplied, applied after the Arts Intensity multiplier. The engine has a single `scaleKey` multiplier (A25) and no sum-then-product rule. Perlica's talents depend on it. Page: https://endfield.wiki.gg/wiki/Electrification
- Stagger Nodes: on Alpha and Boss enemies, passing a node interrupts the enemy and makes it stumble briefly (Stagger page). S11 raises an event only.
- Crowd-control immunity of stronger enemies: Lift and Knock Down do not affect "stronger" enemies (the wiki does not define the term). N9 covers only freezes on Boss. Pages: Lift, Knock_Down.
- Hostile inflictions on operators: four enemy-applied stacks cause Combustion (8 s, ignores DEF), Electrification (2 s stun, +20% Arts damage taken for 10 s) or Solidification (3.5 s) on an operator (Combustion, Electrification, Solidification, Arts Infliction pages). K36 says operator HP and such states are not tracked.
- Shield-break SP: fully breaking an enemy's shield restores a small amount of SP (Skill Points page). N7 says shields are not modelled.
- Dash stamina: dashes use stamina that regenerates to a cap, and a Perfect Dodge is the one that restores SP (Combat Mechanic page).
- Crush-type skill damage: some skills deal Crush DMG (for example Mi Fu's World Splitter) without applying a Crushed status, and that damage gets Arts Intensity but not the Link or Battle Skill DMG bonus (Crush page). P7 applies the action's `damageMultiplier` but has no Crush-type flag.
- Solidification's Shatter multiplier attribute: the wiki calls Shatter Physical DMG and says nothing about the attribute. A38 uses attribute 49 (the Arts reaction attribute), while the Physical statuses P4 to P8 use attribute 25. This is a question for the data, not a confirmed difference.

## Agreements

- A2, A3, A4: 20 s infliction, 4 stacks, same-element re-application resets the timer and triggers a burst, including at 4 stacks (Arts Infliction, Arts Burst pages).
- A5: Arts Burst is 160% ATK of the triggering operator.
- A7, A9: a different element consumes the current infliction and triggers the reaction of the new element, with the element pairings matched. (The Arts Infliction overview sentence reverses the roles of "former" and "latter". The per-element and Arts Reaction pages match the engine, so the overview is taken as a wording error.)
- A10, A11, A24: forced reactions are Level I with no initial hit. Forced Combustion is 24% ATK per second for 10 s; forced Electrification is +12% for 12 s; forced Corrosion starts at 3.6 with the Level I ramp.
- A12, A23: a new reaction of the same kind replaces the old one regardless of level, and resets the duration (Combustion, Electrification, Corrosion pages). A23's open question about a Heat infliction alone is not addressed.
- A18, A39: reaction, burst and Shatter damage belongs to the triggering operator.
- A19, A20, A21 (partly): Combustion is 10 s; ticks are 24 / 36 / 48 / 60% ATK per second, one per second, ten in all. The hostile section sets Combustion's crit to 0, which fits A21. The operator-applied case is not stated.
- A25, A31: Electrification's Arts damage taken is +12 / 16 / 20 / 24%, multiplied by (3 × AI + 300) / (AI + 300), which equals 1 + 2·AI/(AI + 300) (Electrification and Breach pages).
- A26 (partly): the debuff applies to Arts DMG taken, so Physical is excluded. The wiki does not say how Ether is handled. A26 stays open.
- A27: Electrification lasts 12 / 18 / 24 / 30 s.
- A28: Corrosion lasts 15 s.
- A29: Corrosion starts at 3.6 / 4.8 / 6 / 7.2, gains 0.84 / 1.12 / 1.4 / 1.68 per second, and caps at 12 / 16 / 20 / 24.
- A36: Solidification lasts 5.75 / 6.75 / 7.75 / 8.75 s. This matches the engine but does not settle the open item, since the wiki's basis is unstated.
- A38: Shatter's values match: 240 / 360 / 480 / 600% ATK by the Solidification level, consumed by a Physical Status or a Vulnerable stack, after the status's own hit (values only; see the attribute question above).
- P1: Vulnerability holds at most 4 stacks; further stacks reset the duration. The duration itself (20 s) is not stated on the wiki page.
- P2, P3: a Physical Status on a non-Vulnerable enemy adds one Vulnerable stack and nothing else. Only Lift and Knock Down can be forced, and Crush and Breach have no forced form.
- P4: a Lift or Knock Down on a Vulnerable enemy deals 120% ATK Physical and adds one Vulnerable stack without consuming the existing stacks (Lift and Knock Down changelog).
- P7: Crush consumes all Vulnerable stacks and deals 300 / 450 / 600 / 750% ATK for 1 to 4 stacks.
- P8: Breach consumes all stacks and deals 100 / 150 / 200 / 250% ATK for 1 to 4 stacks.
- P9: Breach adds +12 / 16 / 20 / 24% Physical damage taken by stacks, scaled by the same Arts Intensity multiplier (AI scaling was open; now matches). Durations 12 / 18 / 24 / 30 s match the wiki, which resolves the assumed duration.
- S3 (partly): Final Strikes and skills deal Stagger. Reactions and bursts are not listed as Stagger sources.
- S5: the controlled operator's Final Strike deals Stagger (Combat Mechanic, Stagger pages).
- S7: Staggered enemies take 30% more damage (×1.3).
- S8: a Staggered enemy takes no further Stagger.
- S13: the first basic attack on a Staggered enemy is the Finisher, once per Stagger.
- S15: Finisher SP depends on the enemy.
- K1 (max and rate): SP caps at 300 and natural regeneration is 8 SP per second. The pause is W6.
- K3 (battle skill costs): most battle skills cost 100 SP, some 50 or 25.
- K5: returned SP spent does not give Ultimate Energy.
- K9: Ultimate Energy max is the ultimate's cost; casting spends all of it.
- K10: battle skills give every team member 6.5 Ultimate Energy per 100 non-returned SP spent. This is the engine's 0.065 rate, and it settles K10's assumed rate.
- K11: combo skills give the caster 10 Ultimate Energy.
- K12: an enhancement that blocks Ultimate Energy (Laevatain's Twilight) stops gain while active, as the engine's energy blocks do.
- K14: combo skills have cooldowns and cost no SP. The Combat Mechanic page says battle skills have no cooldown; the engine reads cooldowns from data (K14), so the data should show 0 for battle skills. Check this.
- K29 (partly): uncontrolled teammates perform basic attacks automatically; their battle skills, combos and ultimates must be cast manually. The 3.5 s pause is not stated.
- K31 (partly): Link is given by combat skills; K32: the next battle skill or ultimate uses all Link stacks, adding +30 / 45 / 60 / 75% (battle) or +20 / 30 / 40 / 50% (ultimate), multiplicative. This matches the engine's 0.15 + 0.15n and 0.1 + 0.1n.

## Not covered by the source

- A6 (the burst's 1 s delay), A13 to A17, A22 (snapshot), A30, A33, A35, A37's damage side.
- B group: the wiki's pages do not discuss buff rules.
- K2, K6, K7, K16 to K28, K30, K33, K34, K36, K37: combo windows (6 s), cooldown groups, chains and triggers are not on these pages.
- S1, S4, S6, S9, S10, S12: Stagger bar size, duration and recovery are not stated (the Stagger page gives no numbers).
- P5 beyond W2; P10 to P13 (instance replacement is not stated; control-status freezes are not discussed).
- Crush status duration (engine 3 s): not stated on the Crush page.
- T group: no page for time stops or slow-downs; T1 to T21 are not covered.
- SP at combat start (K1 start 200), SP outside combat.
