## 2026-11-27: Ember, Alesh and Catcher's mismatches: two build fits and DEF's percentage

**Goal:** the operators whose hits mostly mismatch (by operator, every log but the hold-outs): Ember 80.2%, Snowshine
88.8%, then Alesh 20.1%, Avywenna 19.9%, Catcher 13.9%. Is each one factor on most hits (a build input), one skill
(a kit error), or a buff the log lists that the replay lacks?

**Found and fixed:**
- **Ember (04d4) ×1.0226 on every kit hit**, under the offset screen's 3%: Exemplar's skill 1 at level 9 for the
  exported 8 (Strength 112 → 132), the one single change of fit-build's 124 (`--pairs`); fixture buildOverrides.
  04d4's Ember 310 → 9 mismatches. Her other three logs were already fitted (2fd9, 99fb) or plain (7e19).
- **Alesh (4e36) ×0.9745**, also under 3%: attribute nodes 2 (node 5's favorability 300, as Si's in 0c14 and
  Perlica's in fc63), 13 of 13 clean; his weapon's skill 3 at 2, the other single change, is ruled out by the log's
  Thermite Cutter 0.08 a layer. Hard 15's "per-operator factors" (Akekuri, Alesh) are both node counts.
- **Catcher's P1 strikes ×1.027 (04d4)**: a kit buff's DEF percentage (OBJ Heavy Burden, formulaItem 6) was of the
  panel line alone, his talent's DEF points (formulaItem 5) added after; the game sums add-slot points first. Engine
  buffs.ts buffAttr: a percentage is of the line with the buffs' points in it. Catcher 35 → 15 mismatches.

**Scoreboard** (measure against the snapshots of de528c7; snapshots:update for the final commit): earlier pending
plain 82.3 → 84.4%, mismatch 7.5 → 4.4%, |damage error| 1.3 → 1.2% (04d4 plain 375 → 590, mismatch 614 → 293,
−3.2 → −1.4%; 4e36 plain 368 → 401, mismatch 37 → 4); verified, development, hold-outs and several-targets
unchanged; no log worse.

**Decisions:** fits only where one input explains the hits (Ember, Alesh), as the earlier fits did. Snowshine's
×0.9624 (04d4) stays out of scope: one factor in [0.96232, 0.96258] fits all 157 clean hits, but no build of nodes,
weapon level and weapon skill 1 hits it with fewer than three changes, and no resistance does (her physical basic
attacks read the same factor as her Cryo hits); docs/open-problems.md has it. Avywenna's 9847 mismatches are the
fight-wide stretch, team-wide hits and Liino's Medicant layers (listed up to ×9, the kit keeps 4): not her kit, so
left as a lead in docs/open-problems.md. The multi-target 146d has the same build but no fixture there takes
buildOverrides, so it isn't touched.

**Dead ends:** a gear piece swapped between Ember and Snowshine (both off by exactly 0.125 of attribute bonus, in
opposite directions): no swap fits either; a food for Ember (116 of 284).

**Left:** Snowshine's build; Catcher's ATK hits at ×1.0005 (Will one point above the export's); Ember's 7e19
33.15 s finisher (an unlisted talent layer); Liino's Medicant layer count on teammates.
