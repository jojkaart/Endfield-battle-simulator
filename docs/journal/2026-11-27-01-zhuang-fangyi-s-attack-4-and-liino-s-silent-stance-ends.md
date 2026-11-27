## 2026-11-27: Zhuang Fangyi's attack 4 and Liino's silent stance ends

**Goal:** Zhuang Fangyi's (65.4% plain, 16.2% mismatch, 86% of her fights' damage) and Liino's (15.5% mismatch,
share-weighted |error| 15.1%) recurring mismatches, with mechanisms from the data or the logs.

**Done:**
- **Zhuang Fangyi's attack 4 was placed as attack 2 in every log of hers** (125 hits ×3.125, all "fallback", so no
  headline number showed it; `zmdlogs groups`' cast list did). Attack 4 spawns attack 2's range entity, one key for
  both. logcasts.ts choose: a skill's own start from its other keys anchors one cast only (attack 2's from its
  travelling swords, 0.7 s late, had taken every range hit within 1.5 s); at one logged ms the keys of one group are
  placed first (attack 3's swords then say the step); a step through an unlogged basic step by both windows' sum (her
  attack 3's swords missing); a landing on its way isn't an older cast's once a newer cast with its key started and it's
  overdue by its frame (3aa6 106.11 s). Tried and dropped on the way: a time bound on every launched entity's next
  landing (f879 +30 plain, but Yvonne's combo field in 5082, held 5 s, split: +7%) and the newer-cast cut without the
  overdue test (Yvonne's ultimate shots).
- **Liino's Vocalist linger removed:** its CreateBuffAction is disabled in the data (`gamedata tree
  buff_chr_0035_liino_normalskill_buff_atkup`); 9847, 0eef and 4d60 read without one.
- **An unlogged End Stance from her beats** (castassembly.ts silentExits): no log has her basic attacks inside a run of
  beats; after the last logged beat and the landings of her casts since, before a basic attack (9847 28.83 s).
  tests/logcasts-chains.test.ts, tests/kit-liino.test.ts.

**Scoreboard** (merged main at 22367af, the stage factors; `measure --base 22367af` for this branch alone):
development plain 79.2 → 80.0%, mismatch 6.9 → 6.8%, mean |damage error| 3.1 → 3.3%; hold-out plain 82.2 → 82.6%,
mismatch 5.6 → 5.5%, 7.1%; earlier pending plain 80.6 → 81.4%, 7.7 → 7.6%, 1.5 → 1.6%. By operator (against 22367af):
Zhuang Fangyi plain 71.4 → 79.2%, mismatch 8.3 → 7.1%, mean |damage error| 2.1%, median 1.7 → 1.0%; Liino plain 80.1 →
82.8%, mismatch 4.7%, mean 10.1 → 9.9%, share-weighted 9.0 → 8.7%. Better: 4bfc 821 → 856, 4d60 806
→ 822, 9847 304 → 413 (per hit 4.7 → 2.3%), 3aa6 402 → 413, c6d8 467 → 507, 8915, 1cd1, f879, two hold-outs. The
totals that rose (207f +1.2 → +5.5%, 3aa6, d774, 9847) are hits now read right exposing over-predictions elsewhere (per
hit closer in every one: 207f 8.3 → 3.3%). Worse: 3f78 147 → 114 plain (Rossi's combo 3 now the log's, by its
Stagger origin, made inside combo 2's frames; its perfect path's Vulnerable gives Gilberta's 58.90 s ultimate one stack
more than the log's 0.39), 9090 −1, 4d60's 66–71 s (−16 inside the +16: the stance runs out before its last beat,
which the linger had covered). team-ab (Typhoeus's team, the linger): sustained DPS −0.15% full, −0.11% zero.

**Left** (docs/open-problems.md "Zhuang Fangyi's and Liino's mismatches (2026-11-27)"): 4d60 43–60 s, Zhuang Fangyi's
Sunderblades (Electrification lost across the enemy-away stretch 27.4–37.0 s); Liino's stance on the beats' clock; her
Medicant layers on Arcane in 1d91; Rossi's combo 3 Vulnerable; 8915's clock lead (not looked at).
