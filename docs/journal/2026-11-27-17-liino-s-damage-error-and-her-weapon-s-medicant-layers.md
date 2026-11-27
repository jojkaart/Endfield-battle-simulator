## 2026-11-27: Liino's damage error and her weapon's Medicant layers

**Goal:** Liino has the largest by-operator mean |damage error| (8.5% over 19 fights, median 3.1%): which of her
hits carry it; and her weapon's Medicant layers (buff_wpn_lance_0014_damageup) listed up to ×9 on one teammate
against the kit's 4 (in-game test 25).

**Found:**
- **Her error is all one-sided.** Her matched landings are within ±0.5% in every fight; every fight's error is
  replay-only landings (`zmdlogs totals --all --json`, her parts as % of her own total): 0eef's combo hit2 tail
  (+57.8% of a 0.9% share: 3.0 points of the mean alone), her stance pressed before the fight's first logged hit
  (1cd1 +8.2 points, c6d8 +6.5, 9c6e +5.7, 9847 +2.7), and Cosmovoice beats, finales and volleys the log never shows
  (1cd1, 1d91, af7b +15–18 points each). Every Cosmovoice logs its Pyrotechnics and bomb, but 0–10 of its 10 beats
  and its finale in 5 of 24; the beats are projectiles launched from Liino (her reach; by controlled operator 67% of
  beats land, Typhoeus controlled 13 of 30): positions, which no log records. docs/open-problems.md "Liino's own
  damage error".
- **Medicant: 4 per teammate, by value, at every listed count.** 6,500 teammates' hits in 19 logs: the value reads
  min(entries, 4) (entries 5–13: 3,097 of 3,434 imply exactly 4); the listing also under-counts (9847's Avywenna at
  57.64–64.75 s: 2, 3, 4 layers where 0, 2, 3 are listed, the ×1.033 of the last round). No kit change.
- **Overheals count (test 25 decided).** Liino's stance heals before a fight's first logged hit, when nobody has
  been hit, give layers the damage carries (1cd1: three on Typhoeus by 11.95 s, by value; 9c6e, 9847, c6d8, 8318,
  4bfe). The teammates a heal misses there (1cd1's Ardelia, 9847's Gilberta, c6d8's Arcane) miss it at full HP too:
  the soundwave's reach, which also explains 1d91's Arcane and Ardelia.

**Held back / tried (log-check files of the parallel several-targets agent):**
docs/tried/2026-11-27-opening-away.diff (the opening as an away stretch for the totals and the replay's enemy:
hold-outs unchanged, 9c0b better, 1cd1, 9847, db87 0.1–0.4 points worse where the opening's landings covered a low
matched part; Liino 8.5 → 8.1% with a 6 s floor; for the lead) and, found again after the several-targets round
had tried it, docs/tried/2026-11-27-tail-own-landing.diff (tailCuts' shown-hit guard takes a cast's own last
landing for another hit; with a 0.5 s end guard as well: 0eef right, Liino 8.5 → 5.5%, but 15 better / 5 worse,
c4f3 plain 468 → 402, hold-out |damage error| 5.8 → 5.9%: dropped; its header has the round's numbers).

**Scoreboard:** unchanged (docs only: no kit or engine change; no snapshot moved). Team numbers unchanged (no
simulated fight changed; team-ab not run).

**Decisions:** no "drop the unlogged beats" reading: it would fit the log by construction; the reach is an input,
and for simulations an expected beat share (about 0.7) is the honest model, left for the planning side. Test 25
marked decided on the premise that a stage fight starts at full HP.

**Probes:** scripts/probes/kits/liino-medicant-layers.ts, liino-opening-layers.ts, liino-cosmovoice-beats.ts.
