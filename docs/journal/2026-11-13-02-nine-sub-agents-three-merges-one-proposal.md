## 2026-11-13 (night): nine sub-agents, three merges, one proposal

The owner asked for every pending item to run in parallel overnight and
be integrated as it finished. Merged into main, each after `npm run
check` on the merged tree:
- **Damage distributions** (opus): five additive fields (min, mean, max,
  variance, third moment) per hit and per fight; min and max from no-crit
  / all-crit battles; crit-triggered hits rolled in K battles; Ardelia's
  sheep from 23 counted casts (example 152,724 → 114,744). Monte Carlo
  (400 runs) agrees on three teams.
- **Liino's beats in the log check** (opus): her in-stance events are
  beats (no cast, no SP); logged casts matched on world time (this was the
  bug that made skipping them hurt her teammates). Hold-out mismatch 6.2 →
  5.9%, mean |damage error| 17.7 → 16.8%; development 22.1 → 21.7%
  (plain 36.1 → 35.8%, all 1d91: one heal short, open).
- **Freezes** (sonnet diagnosis, opus implementation): on a control-immune
  enemy (a Boss) a freeze holds the freezer's own debuffs (Si's Artful
  Intent fits to ~10 ms); on others, as before, everyone's. The broader
  rule (only the freezer's, everywhere) was measured and rejected (b6aa,
  489c). Aggregates unchanged.
Decided by the logs: tests 72, 17 (Wulfgard), 63, 79, 89, 30, 20 (with 83
and 104 in part). Not an engine error after all: Liino's weapon layers
(the log over-lists; damage fits 4; corrects the lead's earlier reading).
Ruled out: teammates' Final Strike SP as the SP gap (the data gates only
five operators; Tangtang's kit gate is a CheckMainCharacterCondition
branch). Waiting on the owner: Laevatain's test-20 change (local branch
laevatain-data-reading, up to date with main: development mismatch 19.8 →
19.6%, hold-out 5.9 → 5.6%; her examples 1–4% lower). New leads: Arcane's
WILL combo 12.2 s in 0206 against 18 s (test 13, raised); OBJ Razorhorn
17–19 s against 15 s; db87's ×1.3 under Laevatain's sword buff; 1cd1's
team-wide step at 24 s.
