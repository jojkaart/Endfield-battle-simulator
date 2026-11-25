## 2026-11-25: Improvement round 12: decisions kept with their reasons

**Goal:** the four open friction reports (round 11's backlog of 13 points, round 11's own report, the cooldown-clock
and remaining-leads reports), with the replay, the kit compiler, the check's core and the engine free this round. No
verdict may move.

**Done** (docs/friction-done/2026-11-25-round-12.md; the backlog: docs/friction/2026-11-25-backlog-after-round-12.md):
- **The holds say why a unit sits where it does** (holds.ts holdPins, PlacedHolds.conflicts; `zmdlogs holds
  --verbose`; `cli-ab --patch <diff>` runs a new view on the old code). 489c across the in-turn commit in one run: the
  in-turn stop holds Li Zhiyan's Corrosion 2.07 s more, its status bound caps the holds at 0.19 s over 13.1–49.2 s, the
  ramp bounds there are dropped against it (open-problems).
- **The replay says why** it didn't land a pinned landing (landingWatch: branch, `if`, next cast, cast end, never
  pinned) and didn't make a logged cast (BuffReplay.skipped, earliestStart's own error); `--trace-trigger`; the EVENT
  line from the replay's decision, with the buff's end in frames; views' stops by the same decision.
- **The placement's passes named** (placementPasses; settleCheck: 21 casts a third pass would move; ultimateOverlaps:
  14 pairs, pinned; `zmdlogs placement`).
- **The data's facts kept**: KitTrigger.cooldownFrom (`efsim kit`, equipment kits by id, kit-census), one compiler
  message for a hit under another key, the likely-loggedAs screen from the data (none open), "enemy HP unknown"
  (unknownFacts).
- measure's moved.json and "Moved by an earlier measure too"; build.ts's built.json and partial/, load.py's fallback;
  `zmdlogs reactions`' inflictions; data/README's absent tables.

**Scoreboard** (`npm run snapshots:update`): "No log's verdicts moved"; only tests/snapshots/kits.json (27 digests,
cooldownFrom). No engine timing change (no smoke, no team-ab).

**Decisions:** no per-kit split of the hold-outs' aggregates: which kit's run moves a hold-out says what the hold-outs
contain, which round 9 keeps out; a split by mechanism class is put to the lead (backlog point 4). The drop reasons
watch the schedule from the replay (no engine change), and the verdicts' reason text stays as it was (the one-sided
kinds group by it). The loggedAs screen is a test and a kit-census section, not a loader warning (a load would print it
on every run). Round 11's backlog points 1, 2 and 4 parked (carried twice, no new report).

**Problems:** the first settleCheck paired a moved cast with its neighbour's start (9a80's Rossi battle skills): pair
the casts that stay first, then the moved ones.
