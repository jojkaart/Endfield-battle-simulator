## 2026-11-23: Crits from values, Combustion ticks from the tick before, landings batched at a stop's end

**Goal:** four leads after the hold-clocks round (docs/journal/2026-11-23-03-corrosion-s-ramp-under-slow-downs-arcane-s-reset-freezes.md):
5082's regression (−2.1 → −8.2%), 458b's Wulfgard Combustion ticks, a battle skill's hit logged at another cast's stop's
end (a7a7 3.87 s), Rossi's combo_3 dilations.

**Found and done:**
- **5082** (open-problems "Smaller"): not Arcane's Arts DMG Taken (the replay has both layers) nor the moved 0.77 s
  hold unit. Arcane's combo reset shortened the replay's own clock 0.1–0.2 s for every instance, which tipped two buffs
  over hits: Yvonne's MI Security layers ran out 0.05 s before her finisher (×1.166), because the log gives none of her
  85 ultimate hits a crit flag, though their values are two levels ×3.0 apart and the log lists the layers to the end;
  and Xaihi's weapon team ATK on Arcane from 50.51 s (×1.18), an instance 1.67 s late, past INSTANCE_LATE_MS (left).
  buffreplay.ts `valueCrits`: a crit-less hit CRIT_APART above the lowest of its key, skill and scale within 1 s is a
  crit (not where logged non-crits split by themselves, nor a slot of two scales). Cross-validated with half the flags
  hidden (scripts/probes/crits/value-xval.ts): 442 of 445 right for the operators with crit triggers (Rossi, Chen,
  Yvonne), 0.90 over every operator against a base rate of 0.10; values shuffled within a key 0.24. 5082 −8.2 → +0.7%.
- **458b** (open-problems "Ink Melt logs"): each Combustion tick deals with the owner's attacker side as it was at the
  tick before (85.70 s without Akekuri's ATK from 84.37 s, 86.69 s with it, 230.62 s with her potential's +0.10 that
  only the tick before lists). Engine assumption `combustion-snapshot` (`last-tick`, default; `application`):
  situation.ts `retakeTickSnapshots`. Over the 21 Combustion logs 52 ticks plain that weren't, 1 the other way. 458b's
  6.1 → 7.5% is Laevatain's total at 74bc686 (Si's strokes onto the placed holds), not the ticks.
- **a7a7 3.87 s** (open-problems "Smaller"): a landing logged at another cast's frozen stop's end whose cast event puts
  it just before the stop landed there: the cast starts at the event, the batched landings (and what they set off)
  land at their kit frames (logcasts.ts `beforeStopStart`, LoggedCast.beforeStop; buffreplay.ts `batchedFrame`). a7a7's
  Corrosion ramp readings off the replay's step 15 → 4. 489c 49.31 s is another case (the hit inside Rossi's combo
  slow-down, logged 0.31 s after it), left.

**Scoreboard:** see the entry's last lines (written after `npm run snapshots:update`).

**Decisions:** crits inferred only upwards and only for operators whose kits have crit triggers (the replay's buffs);
the check's own verdicts try both crits anyway. INSTANCE_LATE_MS kept at 1 s: 5082 fits 2 s (2.17 s of holds, no bound
dropped) but 4d60's refreshed Arcane runs are why the cap exists, and one log doesn't move it. The tick rule as an
engine reading with the old one kept: its mechanism (the snapshot taken after each tick) is the logs', not the data's.

**Dead ends:** valueCrits keyed by hit id within one placed cast (Yvonne's ultimate is eight-shot casts, one landing per
id: nothing inferred); by the key and scale names alone (0.72: Purrchena's attack1 slot holds hits of 367 and 551, both
logged non-crits; scale names repeat across skills); a crit-zone check from the stat panel (Yvonne's ultimate adds Crit
DMG the panel lacks).

**Left:** Xaihi's weapon instance in 5082; 458b's 86.69 s and 227.60 s ticks (the replay's tick before is elsewhere);
4e36's Wulfgard ticks between the two readings; Rossi's combo_3 dilations (two at frame 0, 12 and 19 frames, different
priorities: one replacing the other would hold 7 frames less, about the 0.15–0.2 s 3f78 and 4a64 ask; not built).
