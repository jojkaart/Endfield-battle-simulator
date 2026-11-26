## 2026-11-26: 0c14 and the operator curve: a teammate's attack on its own path, crits read from values in the totals

**Goal:** 0c14's under-prediction (−3.2%: Rossi's matched landings ×0.943, Si's ×0.964), a combo curve for the
operators' clocks alone, the unlogged tails' cuts across the logs, then Alesh's eventless combo, 207f, Snowshine's
×0.9624 and the buffreplay.ts split.

**Done** (open-problems "0c14", "The damage factors", "The enemy's clock", "The replay's Stagger windows"):
- **The totals' expected crits** (scripts/probes/totals/parts.ts): of Rossi's −186k, about 87k was crit-unknown hits
  counted at expected crits though their values show the crit (her first ultimate ×1.032 off on every stab, its two
  crit finals at ×0.766). Engine assumption `totals-crits` `read`, the new default (enginecheck.ts critFromValue:
  the reading the value is within ×1.08 of, the other not).
- **A teammate's attack 4 on its own path** (drivers.ts controlPathLandings): Rossi's kit jumps to hit_ai (× 0.5)
  when she isn't controlled; the placement matched the controlled path's frames and the replay dropped the jump.
  A jump on control now follows who the log shows controlled: 2fd9 plain 250 → 275, 99fb 161 → 173, 0c14 +2.
- **What's left of 0c14** is Alesh's: her 12.5 s Rare Fin combo the log shows only by its buffs (a second Thermite
  Cutter layer on everyone at 20.7–43.3 s, her P3 from 13.25 s), her 59.56 s combo's Rare Fin path (also 4e36, a9d7),
  and a Stagger at its breaking hit (80.48 s, −30k; scripts/probes/stagger/break-order.ts: the breaking hit without it
  45 of 47, the hits after it at its ms with it 10 of 29, every combo hit after its own Lift's break 4 of 4).
- **Operators-only combo curves** (`combo-operator-hold` `plateau-0.5`/`0.6`/`0.7`/`flat`, timeline/clock.ts
  comboOperatorCurve): verified plain 78.0 → 77.9 / 77.7 / 77.6 / 76.0%; 9a80 (Arcane's team) +4 under `plateau-0.5`,
  3aa6 −13. Recorded and stopped, as the brief said.
- **The tail cuts** (scripts/probes/tails/cuts.ts): 16 cuts, 7 dropping a landing, none against the log. 9c6e's is
  the placement's two-enemy split (Liino's hit 1 on both enemies at one ms); de6a's hit_3 falls in a 2.3 s stretch with
  no hit by anyone.
- Snowshine: her nodes 5 and 7 need favorability, so two nodes give ×0.977 of the ×0.9624; ×0.985 left.

**Scoreboard** (`npm run snapshots:update`): verified plain 78.0%, mean |damage error| 2.0 → 1.5%; development plain
69.0%, mismatch 11.4%, mean |damage error| 7.0 → 6.9%; hold-out plain 80.6 → 80.8%, mismatch 5.6%, mean |damage
error| 8.3 → 8.4% (1 mixed: +15 plain, Rossi's attack 4, its total further; 2 other); earlier pending plain 67.7 →
68.0%, mismatch 11.9%, mean |damage error| 4.0 → 3.6% (0c14 plain 336 → 338, −3.2 → −1.3%; 2fd9 250 → 275, −3.6 →
−1.3%; 99fb 161 → 173, −2.9 → −0.3%; b6aa −5.5 → −2.3%).

**Decisions:** `totals-crits` `read` is a totals rule (plain counts unchanged): it takes one fight's crit luck out of
the totals; the six logs whose totals got slightly further (de6a −0.8 → −1.0%, 9847 +0.2 → −0.5%, fc63, 5082, 458b,
9555, ≤0.7 points) had expected crits covering a model error. The curve readings stay registered as the measured
record. A placement rule taking a landing at its cast's previous one's ms as a second enemy's fixed 9c6e's Liino combo
and broke 40d9's Si (her combo slashes batched at one ms, Si −23%): dropped. Alesh's two combo leads not built: a
combo has no cast event and the Rare Fin path is a chance jump the replay doesn't roll; both need a cast or path read
from the listing or the values (next steps). The buffreplay.ts split (point 6) not done: no time left after the
accuracy items. 207f not reached. team-ab: unchanged (no simulated fight moved). Smoke passed.

**Problems:** the totals' per-hit numbers aren't in any view (a probe written for it); two paths sharing keys show
only as odd ratios; `hits --all` after an engine edit recomputes every log (friction report
docs/friction/2026-11-26-0c14-and-operator-curve.md).
