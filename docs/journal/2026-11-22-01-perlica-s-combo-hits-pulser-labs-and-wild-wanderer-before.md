## 2026-11-22: Perlica's combo hits: Pulser Labs and Wild Wanderer before the hit's damage

**Goal:** Perlica's combo hits ×1.15–1.40 above the engine (fc63, 3aa6, 4d60, 4360, 9847), her −9.6% in 9090's
totals although every hit matched, and fc63's ×0.934 ATK (docs/open-problems.md, "Typhoeus, Arcane, Liino, Perlica").

**Found:** one cause for the first two. Where her combo hit had no other DMG bonus it was ×1.500 of the engine in every
Pulser Labs log (4360, 9090, 9847; fc63 ×1.401 = 1.5 × its ATK offset), elsewhere 1 + 0.5 over the hit's DMG sum; in the
Wild Wanderer logs (3aa6, d774) 1 + 0.192 / 0.224, the weapon's dmg_up at her skill-3 levels. Both triggers (Pulser Labs
abilityEvent 102, Wild Wanderer 206, the Electrification tag) ran after the applying hit's damage while P3's, on the same
event and tag, ran before it; her combo makes its forced Electrification before its DamageAction. Both are now
`beforeDamage`; 46 of her 59 combo hits are exactly the primary reading (14 before). 9090's −9.6% was those 7 combo hits,
matched only by the log-listing fallback: no hit is missing (130 of 130 landed; per skill attack1 20, attack2 34, attack3
51, attack4 16, combo 7, ultimate 2), Perlica −9.4 → −2.7%, the rest crit luck. ZMDLogs lists none of the three buffs on
the hit that creates them (a new "Common misreadings" line in docs/design/data.md).

**Follow-on:** e82d's Electrification reaction hit (the only one in the development logs) took the +0.5 too (Perlica
+14.8 → +64%); it fits P3's ATK without Pulser Labs' DMG and without its own Electrification. So a reaction's own hit
takes its triggers' ATK but not their DMG bonuses for Electrification as for Combustion (landing.ts `reactionHitSide`,
was `combustionHitSide`), and OWN_HIT_SEES has Electrification seeing the one before it (ASSUMED, one hit;
combat-mechanics §3.2, §3.8): e82d Perlica −3.4%. **fc63:** `zmdlogs fit-build` fits attribute nodes 2 (nodes 5 and 7
need favorability 300) with Stanza at level 86 (57 of 81 hits, 20 of 21 clean; 1 node at 89 is within 0.1%): kept as
the fixture's `buildOverrides`, the pair a fit, not a reading.

**Scoreboard (docs/accuracy.md):** development plain 52.0 → 52.5%, mismatch 18.2 → 17.9%, mean |damage error| 12.6%
unchanged; hold-out plain 67.3 → 67.4%, mismatch 6.7%, error 12.1 → 12.0% (2 better, 0 worse); earlier pending 48.9 →
49.0%, error 8.3 → 8.4%. Logs better: 4d60, 9090, fc63, 3aa6; mixed 4360, 9847, c6d8, d774 (each closer per hit;
4360's and c6d8's fights were already over-predicted by others), worse e82d (fight −8.5 → −8.8%: its reaction hit was
over-predicted, now right, the fight's shortfall is elsewhere). Perlica's row: plain 58.8 → 66.7%, mismatch 24.1 →
18.8%, mean |damage error| 18.5 → 19.2% (c6d8 +137.8 → +163.7%, a team-wide ×0.1 log; fc63 −0.5 → −6.1%, where the
ATK offset had hidden the missing combo bonus, now both right, the rest an unflagged ultimate crit and Stagger runs).

**Dead ends:** none kept. Left: 4d60's combos ×1.08 (Liino's stance ATK listed, not replayed), a reaction
Electrification with Wild Wanderer (in-game test 68's open half), the Electrification reaction rule rests on one hit.
