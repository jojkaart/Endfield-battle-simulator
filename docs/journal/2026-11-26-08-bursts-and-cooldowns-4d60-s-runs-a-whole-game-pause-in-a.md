## 2026-11-26: Bursts and cooldowns: 4d60's runs a whole-game pause in a Stagger, the replay's Stagger starts

**Goal:** 4d60's Perlica weapon and Arcane's Will burst runs (a refresh the replay misses), d4fb's 97.05 s Physical
Suit exception, Snowshine's ×0.9846 left in 04d4, then test 33's reaction case.

**Done** (open-problems "The kit buff leads", "Trigger cooldowns", "04d4 Snowshine", "Arcane's WILL combo touch"):
- **4d60: not a refresh, a whole-game pause inside a Stagger.** Across 117.22–124.45 s (no hit by anyone) every clock
  runs 6–7 s long: the log's Stagger, Perlica's Wild Wanderer and Qingbo layer, Arcane's two Solemn Phalanx debuffs,
  Liino's beats. The hold placement couldn't put a hold there because the Stagger was a still span. Engine assumption
  `pause-holds`, new default `away` (holds.ts withoutGaps cuts the away stretches out of the Stagger's still span):
  5.4 s placed there, 13 clocks spanning each unit, earliest and latest within 0.4 s. The earlier ruling-out (Xiranflow
  on time) doesn't hold for 4d60: its layers are replaced by later consumptions, and the world-time counts included
  the Empyrean's end as a 78-frame stop.
- **The replay's Stagger window record** took a window's start as its end less the Stagger's length; a Stagger the
  log's listing holds ends at the listing's next moment, so d4fb's windows read 10 s early (97.26 → 86.50 s), and the
  placement took those 10 s as still. Now no earlier than the last sample (replayrecord.ts).
- **d4fb 97.05 s:** the missed proc's Lift is the hit that breaks the Stagger bar; the one other breaking status with
  the cooldown clear (0c14's 182.30 s Crush) procs. A breaking Lift applying no status fits, on one case: not built.
  The other misses are cascades (3.37 s, the fight's first, unexplained).
- **Snowshine:** her nodes' favorability (60, 150, 300, 300) gives no ×0.9624 alone; on top of two nodes, 46 pairs of
  build changes fit within 0.001 and no single one (scripts/probes/stats/snowshine-builds.ts): one constant, one
  number, no log decides it.
- **Test 33:** 9a80's and fc63's touches follow the same opener (Arcane's Nature forming Corrosion) and fit opposite
  readings of `window-reaction`; the reaction kind doesn't decide it, the in-game test stays.

**Scoreboard** (`npm run snapshots:update`): development plain 69.0 → 69.6%, mismatch 11.4 → 11.2%, mean |damage
error| 6.9 → 6.8%; hold-out unchanged; earlier pending plain 68.0 → 68.1%, mismatch 11.9%, mean |damage error| 3.6%.
Better: 4d60 (plain 696 → 806, −4.1 → −1.5%), c4f3 (−3.0 → −2.5%), c6d8 (plain 112 → 125); d4fb other (±1); none worse.

**Decisions:** `pause-holds` an assumption (the evidence is one log, though 13 clocks agree), read only by the log
check's replay: no simulated fight moves, so no team-ab. The two small edits in buffreplay.ts and replayrecord.ts are
in the replay modules the parallel inferred-casts agent owns; kept small and named for the lead.

**Problems:** the world-time view counts a tick-read event's stop the placement leaves out (query.ts replayTimeStops),
which misled the earlier round's Xiranflow count; `zmdlogs stagger`'s window start showed the record's error without
anything flagging it.
