# Probes

Analysis scripts a finding rests on, kept so the next agent starts from them
instead of re-deriving them. A scratch script stays in scratch/ (git-ignored,
per worktree, gone when the worktree is pruned) unless a doc cites it for a
number the next step builds on (docs/open-problems.md, a journal entry, a
roadmap step): then it moves here in the same commit, under a topic folder,
with a header line saying which round wrote it, what it answers, and how to
run it (inputs and where it writes), and gets a line below. Round 6 (2026-11-23):
the hidden-holds round could reproduce the buff clock's numbers only because
the worktree that held scratch/bc/ was still on disk.

Probes aren't typechecked, linted or run by tests (tsconfig.json takes only
`scripts/*.ts`; eslint.config.js ignores this folder): they age with the code.
Run one from the repository root (`node scripts/probes/<topic>/<file>.ts`,
`python3 -I scripts/probes/<topic>/<file>.py`); inputs and outputs live in
scratch/. If one no longer runs, fix it or delete it with its line here (a
probe a committed view replaces is deleted). A question several agents ask
belongs in a view (`efsim zmdlogs …`), not here.

Never write player names, account IDs or hold-out logs' numbers into a probe
or its output paths; probes read development logs only (`devFixtures`,
fixtures/ and fixtures/pending/).

| Probe | Question | Run | Last run |
|---|---|---|---|
| buff-clock/lanes.ts | Each listed run of a kit-modelled game buff against the data's duration in world time and the replay's expiry (rows for the others) | `node scripts/probes/buff-clock/lanes.ts [ids…] > scratch/bc/rows.jsonl` | 2026-11-23, round 6 (c779) |
| buff-clock/clock2.ts | One hidden clock per fight or per partition (owner, holder, side, lane)? Difference constraints over the rows | `node scripts/probes/buff-clock/clock2.ts <global\|owner\|holder\|side\|lane> [tol ms] [--ticks]` | 2026-11-23, round 6 |
| buff-clock/tickstag.ts | Holds in the enemy's tick series inside and outside the Stagger | `node scripts/probes/buff-clock/tickstag.ts` | 2026-11-23, round 6 |
| buff-clock/dmg.ts | Past the replay's expiry, does the damage side with the log's lane or the engine? | `node scripts/probes/buff-clock/dmg.ts [--list]` (needs scratch/bc/hits.jsonl: `efsim zmdlogs hits --all --json`) | 2026-11-22 (not rerun) |
| hidden-holds/determined.ts | How well each log's placed holds are determined (units, spread, clocks spanning them) | `node scripts/probes/hidden-holds/determined.ts [ids…] [--verbose]` | 2026-11-23, round 6 (c779) |
| hidden-holds/sp.ts | The placed holds as perfect dodges against the Team SP the replay lacks | `node scripts/probes/hidden-holds/sp.ts [ids…] [--verbose]` | 2026-11-23, round 6 (c779) |
| corrosion/corrosion-lag.ts | Corrosion's ramp read as resistance steps per hit: the log's lag behind the replay's ramp | `npm run -s efsim -- zmdlogs hits <ids…> --json > scratch/all-hits.jsonl`, then `node scripts/probes/corrosion/corrosion-lag.ts scratch/all-hits.jsonl [--log id] [--verbose]` | 2026-11-23, round 6 (db87) |
| corrosion/rampprobe.ts | Across the logs, Corrosion ramp readings the replay over-holds (a combo slow-down in the window?) against those needing a hidden hold | `node scripts/probes/corrosion/rampprobe.ts` | 2026-11-23, hold clocks |
| corrosion/stop-sum.ts | Held world time at the lowest scale against the sum of the stops (rule T3), placed casts only | `node scripts/probes/corrosion/stop-sum.ts <id> <from s> <to s>` | 2026-11-23, round 6 |
| crits/layer-xval.ts | layerCrits with every crit flag hidden: how many inferred crits the log flags as crits, against the base rate and a shuffled listing (negative control) | `node scripts/probes/crits/layer-xval.ts [--shuffle] [-v]` | 2026-11-23, Wolven Blood crits |
| edge/edge-export.ts | Per Type 50 Yinglung's Edge wearer combo: the engine's layers and both readings' damage | `node scripts/probes/edge/edge-export.ts > scratch/edge-all.json` | 2026-11-23, round 6 |
| edge/edge-score.py | The Edge stack-count hypotheses (H1–H13) scored against the implied layers (edge_implied.py) | `python3 -I scripts/probes/edge/edge-score.py [-v]` | 2026-11-23, round 6 |
| stagger/pause-bars.py | Around each hitless pause: the Stagger bar before and after, the enemy debuffs carried across | `python3 -I scripts/probes/stagger/pause-bars.py [min s] [ids…]` | 2026-11-23, round 6 |
