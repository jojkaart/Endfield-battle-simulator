## 2026-11-27: Exposed totals: stage Electrification, kills, Rossi's combo 3

**Goal:** the fight totals that rose once the attack-4 round read hits right (207f +5.5%, 3aa6, d774, 9847, a9d7),
split by operator and landing kind and fixed by mechanisms; 3f78's Rossi combo 3 at 50.55 s, made inside combo 2's
uncuttable frames (docs/journal/2026-11-27-01-zhuang-fangyi-s-attack-4-and-liino-s-silent-stance-ends.md).

**Done:**
- **Hard 27's stage Electrification is Arts DMG Taken only** (enginecheck.ts logOnly, stageElements): the log lists it
  without an element and the check added it to every hit; buff_common_pulse_pulse_conduct_triggered_do reaches
  CheckDamageTypeMask 92 (Arts), physical only with `if_contain_physicdamage` = 1, which nothing in the data sets. 207f's
  physical hits 21–36 s (Rossi's attacks, combos, bleeds, Gilberta's set) read ×0.847 = 1.33 ÷ 1.57 with it, plain now.
- **A kill from a stage-scaled total** (enginecheck.ts stageScaledKill): 207f's logged total is 5.7600 × the data's Max
  HP, its last hit without an `uncapped` value; every capped single-life kill in the development logs sits within 1.3e-5
  of a two-decimal multiple (scripts/probes/totals/stage-kills.ts), 5082 (×7.6000) is the other uncapped one. The totals cap
  the killing hits (Rossi's ultimate final: 1,134,403, predicted 1,218,124), loggedEnemyHp reads the HP, and the check
  leaves a killing hit unjudged where it reads above its value (logcheck.ts killingBlows `capOnly`).
- **Rossi's combo 3 on its jumped path** (logcasts.ts jumpedFirst): placed by its perfect hit (frame 29) it started at
  49.59 s, 13 frames before combo 2's window (frame 37); its late hit (227, 15 after the jump 0 → 212) puts it at
  50.05 s, where the perfect-timing ring (combo 2's frame 52) isn't on yet, so the kit's own condition jumps. No INSIDE,
  no JUMPDROP, no extra Vulnerable: Gilberta's 58.90 s ultimate Susceptibility 0.39, the log's. The rule takes the
  twin's slot only where the skipped path's start is before the operator's previous cast lets the skill start.
- tests/logcasts.test.ts (three tests).

**Scoreboard** (`npm run snapshots:update` after merging main at 0b68614, the away stretches; `measure --base 0b68614`
for this branch alone): development plain 81.0 → 81.4%, mismatch 6.4 → 6.3%, mean |damage error| 3.3 → 3.1%, within 5%
27 → 28; hold-out unchanged (82.6%, 5.5%, 7.1%); earlier pending unchanged (81.4%, 7.6%, 1.6%;
abfd mismatch 2 → 1). Better: 207f (plain 269 → 308, mismatch 16 → 3, +5.5 → +1.6%), 3f78 (plain 114 → 151, 0.9 →
0.2%); 5082 adds a time to kill. No log worse. Rossi's row: plain 74.2 → 76.6%, mismatch 5.1 → 4.6%, mean |damage
error| 1.8 → 1.3%. No engine or kit rule changed (log tools only): no team-ab.

**Decisions:** the stage kill by the total, not a list of stage factors: the factors differ per stage and per version
(hdg027 ×5.28 in 2fd9 / 99fb, ×5.76 in 207f), the grid is what they share. The combo-3 rule asks the kit's windows,
not the Stagger: every logged combo-3 hit has Stagger 5 (poise_f), perfect ones too.

**Dead ends:** the Stagger value as the path's evidence (above); d774's +4.9% (Zhuang Fangyi's first Empyrean battle
skill at 103.28 s: 3 strikes, no final, in the log; neither blades, an attack's cut nor half a life's HP explain it:
docs/open-problems.md "The totals that rose once hits read right").

**Left:** d774 103.28 s; 3f78's team-wide ×1.017 after 50.55 s (Corrosion's ramp late in the replay: the enemy's
clock); a9d7's Chen −3.0% (spread, Pogranichnik's team buffs on her combo); 207f's Rossi attack 4 hit_ai tail (+1.3%).
