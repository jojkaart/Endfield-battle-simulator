## 2026-11-25: Holds and placement: a freeze holds no Arts reaction status

**Goal:** round 12's accuracy leads: 489c's lost plain hits after ultimates played in turn (591 → 488), the 20
casts a third placement pass would move, the 14 overlapping ultimate pairs; if time, 9a80 / 79cc's bursts, 7e19's
×1.096, d4fb 97.05 s, the "enemy HP unknown" reading.

**Done** (open-problems "Ultimates pressed together", "Freezes on bosses", "Trigger cooldowns"):
- **489c: the Corrosion's end, held by Si's freeze** (e9ffcac). Neither the in-turn stop (the ramp's steps lag the
  replay's by a steady 0.31–0.41 s across both stops in turn) nor the ramp bounds: Si's Immobilization at 43.6 s held
  the replay's Corrosion's end 1.5 s, so its status bound allowed no hold while four clocks (the Vulnerable run, the
  ramp, the bleed and Combustion ticks) agree on about 1 s. Combustion's ticks run on through a freeze too (f978's at
  57.80 and 58.80 s). Engine assumption `freeze-ramp`, new default `statuses` (clock.ts statusesRunOn: none of the
  four reaction statuses held, the debuffs still are): 489c plain 488 → 632, mismatch 45 → 14.
- **A third placement pass: dropped** (docs/tried/2026-11-25-third-placement-pass.diff): 2-cycles (4a64's Rossi,
  7910's and 9090's Arcane swap back in a fourth pass), one more overlapping pair, development plain 68.1 → 67.8%.
- **The 14 overlapping pairs: the log decides each** (inTurnStart's checks): six have logged hits in the in-turn
  stop, five overlap 2–4 frames, three resolve with a 3-frame tolerance and a reach counting combo slow-downs, but
  d9e5 plain 86 → 50 and b6aa mixed (docs/tried/2026-11-25-in-turn-chains.diff). The pinned list is unchanged.
- d4fb 97.05 s: 2.18 s short, the Lift logged, a Stagger holding the cooldown ruled out (the 106.13 s proc). 9a80
  35.05 s: a quiet 29.66–30.00 s where a dodge-sized hold would carry the burst past two stops; bursts aren't hold
  clocks. Not reached: 79cc 24.23 s, 7e19's ×1.096, the "enemy HP unknown" reading (no development log has the label).
- `zmdlogs holds --assume`.

**Scoreboard** (`npm run snapshots:update`): verified 78.0% unchanged; development plain 68.1 → 69.0%, mismatch 11.6 →
11.4%, mean |damage error| 7.0%; hold-out plain 78.7 → 79.0%, mismatch 5.9%, 8.6 → 8.5% (1 better, 0 worse);
earlier pending plain 64.7%, 4.1% (b6aa better). Better: 489c, 9c0b, 8915, f978 (mixed: +4 plain, total 0.3 →
0.7%); **worse:** db87 (plain 209 → 208, total −4.5 → −6.0%: its Corrosion still acts 0.58 s past the new end, in a
Stagger whose Combustion ticks come every ~1.5 s). Teams (team-ab against 99806d9): estella-si-akekuri-arcane −0.15%
sustained (sd 1.6k), the rest the same.

**Decisions:** `statuses` over a Corrosion-only reading (the same on 489c and db87; f978's ticks need Combustion's
too); default switched with db87 worse, since its window has an enemy-clock delay the placement can't place in a
Stagger. The holds per stretch (backlog point 5) weren't needed: the conflict was one wrong bound, not the
placement's handling. The third pass and the in-turn extensions kept as tried diffs.

**Problems:** inTurnStart has no record of why it left a pair (a temporary stderr print answered it; friction
report); a debug print in inTurn also ran under settleCheck's third pass, mixing two passes' lines.
