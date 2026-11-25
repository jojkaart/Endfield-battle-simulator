## 2026-11-25: The remaining leads: the Empyrean's end on its frame, ultimates in turn, the touch after a reaction

**Goal:** the leads the 2026-11-24 rounds left: Zhuang Fangyi's Empyrean ending early (4bfc 179.51 s, d774 104.18 s,
4d60's holds), Typhoeus's fc63 infliction state, Arcane's last bursts (9a80, 79cc, c83c), travelling ability
entities, 7e19's ×1.096 and d4fb's Swordmancer exception, the marker clocks.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The remaining leads"):
- **The Empyrean's end is a frame boundary** (669a62e): the replay's buff ended on the event's own frame (4bfc 179.50 s;
  d774's held 0.37 s to its event by heldTicks), so the advance ticked and ended it before loggedTick looked and the
  replay made a real ultimate. buffreplay.ts endedWithTick. ExtendBuffAction as a pause ruled out (4bfc's third
  Empyrean would run 47 s, the log's 26.65 s of world time). d774 104.18 s: not the clock; the team's hits thin out
  after the third strike, as where the enemy leaves at 30.63 s (positional).
- **Ultimates pressed together play their stops in turn** (4188729, logcasts.ts inTurn, a pass after the placement):
  of 27 overlapping pairs, 12 have a hitless stretch of the first stop's length before it (fc63, 00ae, 4a64, d774, …);
  fc63's 40.80 s burst was this (Gilberta's ultimate from 39.92 s, before Perlica's), not Typhoeus.
- **fc63 85.13 s: the touch's element after a reaction opener** (45da066): the game's enemy had Nature (Typhoeus's shot
  consumed it: its burst ×1.303), the replay Pulse (the Corrosion's consumed element). Engine assumption
  `window-reaction` (`consumed` default, `applied`): fc63 plain 511 → 549, mismatch 179 → 97, but 9a80 227 → 217 and
  fc63's total 3.4 → 5.3%; not the default; in-game test 33 updated.
- **Ruled out:** Imprisonment's enemy slow-down for the late bursts (45 of 50 touch-caused bursts on time); a `travels`
  field for Tangtang's stare and Arclight's dash (no movement in the data; marked, no log moves); Pogranichnik's
  layers for 7e19 (teammates fit with two under the same listing). Open: 9a80 35.05 s, 79cc 24.23 s (a frame around
  Arcane's reset), d4fb 97.05 s, 4d60's holds, the marker clocks (no log decides them; not reached).
- `--trace-buff status:infliction`; scripts/probes/placement/ult-overlap.ts.

**Scoreboard** (`npm run snapshots:update`): verified plain 78.2 → 78.0% (40d9 51 → 49: two hits assumed near the
moved stop); development plain 67.9 → 68.1%, mismatch 11.5 → 11.6%, mean |damage error| 7.0%; hold-out plain 78.5 →
78.7%, mismatch 5.9%, 8.5 → 8.6% (1 mixed, none worse); earlier pending plain 64.6 → 64.7%, 4.2 → 4.1%. Better: 00ae
607 → 687, 9090 995 → 1027, 1d91, 7910, c4f3, 4bfc, d774; **worse:** 489c plain 591 → 488 (its total −1.9 → −0.3%:
the hidden holds re-placed after the in-turn move, its Corrosion readings), 3f78's total −4.8 → −5.6%. Teams
(team-ab against eec0473): every team's fight the same.

**Decisions:** in-turn kept with 489c worse: the stop is where the log is quiet (Arcane's attack 4 split by it), and
the loss is the hold placement's response (friction report point 1); in-turn as a pass after the placement, not in
placeWith (inside it, 4360 and 9c6e cascaded); `window-reaction` registered, not switched, on one log each way.

**Problems:** the container restarted mid-round (nothing lost: committed before the long runs).
