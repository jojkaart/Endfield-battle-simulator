## 2026-11-18: Arcane's and Akekuri's in-game tests from the logs

**Goal:** decide from the logs the in-game tests on Arcane and Akekuri (the owner's team and Typhoeus's): 31, 51, 7,
30, 4, 57, 62 (the "Logs first" rule; the claims of docs/in-game-tests-retriage-01-40.md and -41-75.md checked, not
taken).

**Decided** (each in its own section of docs/in-game-tests.md, "Decided by the logs (2026-11-18)"):
- **31** (finishers in the array): a finisher alone is a Cluster Strike, four lasers about 0.4 s after its first hit
  (00ae, 4d60, a7a7, 2b01, c516). The engine already had it (`cluster_strike_finisher`): the re-triage's "the engine
  only has the Final Strike trigger" was stale; the replay lands all 20 lasers. A finisher and a Final Strike together
  are one strike (b6aa 46.6 s, four lasers).
- **51** (a hit's own effect on that hit): Solemn Phalanx (3 plain exact; 8915's on its stage factor) and Starry Beach
  (11 plain exact) count on the hit that creates them. New: Solemn Phalanx's INT Arts DMG is also on the Corrosion the
  same infliction forms (a7a7 3.86 s exactly (1.399 + 0.44) / 1.399; 8915 twice at 0.32), Hot Work's (from the
  Corrosion) isn't.
- **7** (INT Arcane ×2?): no; 00ae and a7a7 fit, 8915's ×1.85 is all its stage (238 of her 278 hits in the stage's
  windows within 1% of its factor, as Si's and Wulfgard's). The Amp lasts the array, Gloompurge relists it, and the
  second ultimate's cast replaces it with its own, gone by her next basic attack (00ae, 8915): the engine kept it up
  to 10 s more.
- **30** (her Susceptibility's length): 10 s from the hit (tight windows 10.4–11.8 s; none 20 s); the −1 to +3 s
  differences are timer holds (tests 37, 110).
- **4** (the Corrosion ramp): the engine's ramp; 1,156 of 1,897 non-crit hits under a plain-formula Corrosion within
  0.3 points of its shred, alternatives at most 281; 743 of 936 with raised caps / forced scales / carried shreds.
- **57** (Akekuri's Link): ×1.30, five plain exact Laevatain battle-skill hits in 458b.
- **62, Akekuri's part**: each layer restarts the shared timer (458b: 11 plain exact basics at 167–173 s with all five
  layers); Chen's, Yvonne's and Ember's parts stay open.

**Engine changes** (both kept: no log worse without explanation, hold-out not worse):
1. Before-damage triggers on the infliction (`inflictionApplied`: the game's abilityEvent 126, sent before it resolves
   the infliction into a reaction) run ahead of those on the reaction, so a Corrosion's (or Combustion's) own hit sees
   what they give (timeline/landing.ts). Only Solemn Phalanx (INT) changes a wearer's own Corrosion hit in practice.
2. Arcane's kit: `int_amp_ult2`, the second ultimate's own Amp (ends Gloompurge's at the cast; ended by her next basic
   attack, at most the skill's 287 frames). A first try with `endsWithCast` cut it before the ultimate's own hit in
   a7a7 (a battle skill placed inside the cast) and made a7a7 and a hold-out worse; a7a7 also shows her battle skill
   right after keeping it, so only a basic attack ends it.

**Scoreboard** (docs/accuracy.md from `npm run snapshots:update`, against 9fa151b): development
plain 49.5 → 49.6%, mismatch 19.3 → 19.2%, mean |damage error| 13.0 → 13.1% (00ae's total: its post-ultimate hits
moved from −40% to −15% each, unquantified, under a total already below the log); hold-out unchanged in the
aggregates (1 log better, none worse); 8915 plain 101 → 113, a7a7 352 → 353; Arcane's row plain 60.9 → 61.1%.

**Teams:** both play Arcane in WILL, where neither change acts (Solemn Phalanx's INT trigger and the second
ultimate's Amp need Intellect ≥ Will): the example snapshots didn't move.

**Left:** 8915 after its stage (×0.986 at 92–103 s, ×0.81–1.21 steps at 104–112 s); whether a combo or battle skill
ends the second ultimate's Amp; the 0.05 s by which Akekuri's P1 outlives the replay's end in 458b; her own finisher's
8 SP (no log records SP).
