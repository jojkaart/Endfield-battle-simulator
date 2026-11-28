## 2026-11-28: Estella and Akekuri logs: four imports, a stage variant's rank, Akekuri's combo SP on its landings

**Goal:** more development logs for the owner's team (Estella, Si, Akekuri, Arcane): the scoreboard had Akekuri in 2
fights and Estella in 5.

**Done:**
- Screened both operators' ZMDLogs profiles (each lists every battle with the operator: Estella 45, Akekuri 75, most
  before game 1.6), 13 exports and 5 details (4 s apart). Usable: Estella's one new 1.6 fight on a stage the data has
  (8f32, Tower 7, on Valiant) and three with Akekuri (1a77 and 8056: one account's Rhodagn rush and boss Si with Si
  P0; f574: Hard 33's slugs). The rest: towers 21 and 24 (not in the pinned data), Minghe (no kit), Akekuri at levels
  1–60, a multi-target rush, or hold-outs. All four on the development list; f574 marked `severalTargets` with the
  slug probe's evidence (as 6339, 7b54). First checks in fixtures/pending/README.md.
- 1a77 / 8056: Akekuri and Wulfgard are level 80; `fit-build` gives both attribute nodes 2 and a level-80 weapon in
  both logs (tied for Akekuri with weapon 72 and a food; the food-free pair fits all four), buildOverrides.
- 8f32's replay stopped at 44.8 s: eny_0082_hsbear_race007 has an attribute template of its own and no display entry,
  so no rank, and Rossi's ultimate freeze asks for it. The loader now takes the EnemyTable templateId's display (39
  enemies; development targets 9, none Elite with a Rossi). 8f32 plain 171 → 395, −56.8 → +2.1%; Estella 60 of 63.
- Akekuri's combo SP as cast triggers 22 and 31 frames after the cast came after both landings where the replay pins
  them early (8056 76.98 s, 1a77 80.35 s, 458b 127.5 / 197.6 s: ×1.262 = Frontiers 1.16 × a Positive Feedback
  layer). The data has each ObtainCostAction in its DamageAction's tick, before it: now the hit's own `sp` with
  spBeforeDamage. 458b plain 1073 → 1093, 8056 +3, 1a77 +3.
- Scoreboard (snapshots:update): development 29 → 32 fights, plain 84.3 → 84.2%, mismatch 4.7 → 4.6%, |damage error|
  1.3%; earlier pending plain 84.4 → 84.6%; several targets 3 → 4 (f574 −26.5%); verified and hold-out unchanged.
  Akekuri 2 → 5 fights (plain 94.6 → 94.2%), Estella 5 → 6 (80.3 → 83.0%, |damage error| 2.5 → 2.2%). team-ab
  against 0f3c894: every team's fight identical (the owner's team's simulated combos had their SP on time).

**Open:** 8056's first Akekuri ultimate shows one of its three SP grants' buffs (her ×0.862 basics at 25–30 s). The
data rules out a target check or a cut; the SP cap fits (the replay at 284 and 300, and its SP runs short), but 22
firings at the replay's cap do show their buffs (458b 227.5 s). In-game test 112 (open-problems "Akekuri: her SP
grants"; scripts/probes/sp/spcap.ts). Tests: 48 not decidable from 8f32 (no skill-type bonus in her build; her
Valiant hits don't get the combo cast's Yinglung's Edge), 71 part 1 agreed by 8f32, 11 still no log.

**Dead ends:** an SP-cap rule for the "recovers SP" event wasn't built: the replay's SP decides too few firings
either way.
