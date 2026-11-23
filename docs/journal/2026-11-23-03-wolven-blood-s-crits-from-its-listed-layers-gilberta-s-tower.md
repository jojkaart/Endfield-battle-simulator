## 2026-11-23: Wolven Blood's crits from its listed layers; Gilberta's tower-boss stacks from an instance buff's clock

**Goal:** two leads from docs/journal/2026-11-23-02-hold-clocks-enemy-statuses-and-corrosion-s-ramp.md: Rossi's Wolven
Blood starting late where the log gives her hits no crit (489c's 16th layer at 55.61 s, the replay's at 59.5 s), and
Gilberta's Vulnerable stacks outliving 20 s on the tower bosses (4360 116.0 s, 9847 126.1 s; 9847 310 → 300 from the
ramp cap).

**Done (open-problems "The buff clock" Wolven Blood bullet, "Gilberta's Susceptibility"):**
- buffreplay.ts `layerCrits`: a trigger on its operator's crits that adds a layer of a buff the log lists with its start
  adds one per crit, so n layers listed from a moment (`listedStarts`: entries with that `since` over the entry kinds)
  are n crits there, after the logged and shownCrits ones: all the crit-less hits there when as many, else the largest
  standing apart ×1.4 (CRIT_APART, shared with shownCrits). Cross-validation with every flag of the operator hidden
  (development logs; Rossi, Chen's and Yvonne's crit sets too): 956 of 973 right (0.98, base rate 0.64); the listed
  starts moved to random moments of her hits (negative control): 0.63. Both in tests/buffreplay-fixtures.test.ts on 489c.
- loggedLaneEnds: a run is refreshed only when it stops being listed within 200 ms of the other's start (runs listed side
  by side are two instances). runBounds: an instance buff's run (KitBuff.instances, excluded before) is a clock where the
  log shows it apart (`runApart`: each replay application inside it has its own run, some run overlaps it, none ends
  within 1 s of it), it is the run nearest the instance (`nearestRun`), and it is at most 1 s late (INSTANCE_LATE_MS).
  4360: Perlica's Arts DMG Taken from 92.24 s, 0.74 s late, places a hold that keeps the 90.87 s stacks: Gilberta's
  116.0 s Susceptibility reads 0.39 (3 stacks), Avywenna's ultimate under it plain.
- Scoreboard (`npm run snapshots:update`): development plain 64.4 → 64.9%, mismatch 15.2 → 15.0%, mean |damage error|
  9.3 → 8.8%, within 5% 16 → 17; hold-outs unchanged; earlier pending 57.3 → 57.7%, 18.4%, 8.0 → 8.3% (0c14); all but the
  hold-outs 61.9 → 62.3%, 16.1 → 15.9%, 8.1 → 7.9%. Rossi 39.8 → 41.8% plain. Development 11 better (489c 517 → 546,
  mismatch 57 → 38; 207f 106 → 121; 5082 damage −18.1 → −2.1%), 3 worse: 4a64 (150 → 140: the Wolven Blood runs moved
  the placed holds, Corrosion read a step ahead at 16.8 s and Gilberta's Pursuit lost at 28.3 s), 9847 (one mismatch,
  Gilberta's attack 3 at 140.3 s, the moved holds), 9a80 (damage 0.5 → 1.4%); 0c14's total +16.4 → +26.1% (Rossi's own
  −10.8 → +1.6%, Si's +14.1 → +21.9%: her replay-only Artful Intent burst records Rossi's larger damage). No engine or kit
  change: the simulated fights are the same (team-ab not run).

**Decisions:** the crit count only adds crits (at 16 layers a new one replaces one; the listing undercounts there). An
ambiguous moment is left alone unless the largest stand apart: the hit's own verdict tries both crits anyway, what matters
is the count. Instance buffs as clocks only with the log's evidence that the run is an instance of its own: Arcane's
will_dmg / will_atk runs keep their start through refreshes (489c, 9c0b: overlapping runs end together; b6aa, 4d60:
lone runs 2–8 s late; 4d60 placed 11 s of holds before the 1 s cap). holds.ts statusLanes keeps the old refresh rule
(another agent's file).

**Dead ends:** instance buffs allowed wholesale (489c plain 517 → 475: Arcane's refreshed runs asked 2.6 s of holds);
the per-buff independence test (9c0b's will_dmg passed it); without the nearest-run rule 489c's 12.0 s instance paired
with the 14.6 s run.

**Left:** 9847 126.1 s (0.30 against 0.36): no listed clock asks the 0.73 s more before the ultimate; Gilberta's listed
Susceptibility as a Vulnerable-count clock (a holds.ts bound builder). 489c's final 1.1 s late from two bleed ticks the
replay lands off the log's (ticksShownByHits), d572's one layer short from ~8 s with every crit logged.
