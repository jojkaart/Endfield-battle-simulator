## 2026-11-28: Placement paths: a value rule on multiplier bounds, slots cut to a path, hitless ultimate stops

**Goal:** the three placement entries round 23 added to the backlog's accuracy list
(docs/friction/2026-11-28-backlog-after-round-23.md): a cast's slots cut to its path, a value rule on a
consumed-scaled multiplier's bounds (8f32 38.50 s), the unplaced ultimate events' stops at the cast assembly's
reading (458b 84.37 s); then 9c6e's 78.88 s array tick pair. Base main at 967d460; files: packages/logs/src/
logcasts.ts, castassembly.ts, placementwords.ts, the new ultimateevent.ts.

**Done:**
- **A landing kept on its cast by value** (logcasts.ts keptByValue, Group.bounds from multiplierBounds, PlacedJoin
  `value`): a landing a newer cast of its operator's would take off its open cast (`superseded`) stays on it where
  its value, against the cast's last landing with crits taken out, fits the next slot's multiplier within
  VALUE_TOLERANCE and lies outside every slot of the group the key's choice would open (widened by the same). The
  choice is now worked out lazily before the join (openChoice). 8f32 36.11 s: Rossi's combo 2 hit_2 (×0.60, as hit 1)
  against a combo 3 perfect strike (×3.45–11.73): kept, so the 38.50 s perfect strike opens the combo 3, its Lift at
  38.50 s, and the Endministrator's crystal shatter is made.
- **A cast's slots cut to its first landing's path** (pathSlots, onPathFrom): after the first landing, a slot on the
  same path before its end, or on a path a jump on it (at or past the first landing) goes to; the slots before it
  stay as they are (PlacedHit.index counts in the whole list). The world time from the first landing is measured
  against its own slot (`head`), not slot 0, for a jumped first landing; realignByValue assigns one path's slots only.
  8f32 2.02 / 10.02 s: Alesh's 10.02 s hook and slam had joined her 1.29 s combo 7.4 s late as its Rare Fin slots;
  now a combo of their own, and the 2.02 s cast the Rare Fin path by value.
- **A hitless ultimate's unplaced event stop** (unplacedCastStops): from ultimateEventRead's start against the placed
  casts' stops (458b: Akekuri's from 82.53 s, not 84.37 s). ultimateEventRead moved to ultimateevent.ts (a move:
  logcasts.ts can't import castassembly.ts, which imports it); castassembly.ts re-exports it.
- **The second pass's stops with the ultimate merge** (passStops, ultimateMerge): the first pass's stops were built
  without Placement.merge, so 9c6e's Liino ultimate (cast at 67.85 s) placed again from her song's 78.88 s beat made a
  stop 76.30–78.87 s, a frame before the Barrage Array's first tick pair: `byTime` saw a stop's end that could batch
  it. Now one cast: the pair a twin by time, the array's ticks in turn.

**Measured** (`measure --at HEAD --base`, one commit at a time): the value rule 8f32 plain 395 → 405, damage +2.1 →
−0.2%; the ultimate stops no verdict moved (4bfc's 144.37 s volley pair placed elsewhere); the path cut 8f32 405 → 409,
one hold-out mixed (+1 plain, −1 assumed, its mean per-hit error closer); the merge 4bfc 870 → 876, damage −0.6 →
+0.1%, 9c6e other (combo kind +7.6 → +7.0%, Typhoeus −12.2 → −12.3%, damage −11.1% both). Nothing worse.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 84.2 → 84.3%, mismatch 4.6%,
|damage error| 1.3 → 1.2%; hold-outs plain 82.5 → 82.6%, mismatch 5.1%, |damage error| 5.9%; earlier pending plain
84.9 → 85.0%, |damage error| 1.2%; several targets unchanged but 9c6e's totals. Log-side only (packages/logs): no
simulated fight moves, so no team-ab.

**Decisions:** the value rule asks the choice the placement would make (not every other group), since a new cast of
the cast's own skill fits the same value; it only overrides `superseded`, not `pressed`, the channel end or `used`.
The path cut stays a prefix of the slot list, so the slot indices realign and the replay read stay valid. The pass
merge is the final placement's own rule applied to the stops pass 2 reads; castTimeStops' other callers (the cast
assembly's stop list) keep their list unmerged (not measured: their merge would move the replay's stops).

**Left:** 458b's 111 s layer ends 0.3 s early (world holds 88.7–111.5 s: not the ultimate's stop); the Decisive
Assault's frame (open, a fit only).
