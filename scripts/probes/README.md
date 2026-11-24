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
fixtures/ and fixtures/pending/), but for stats/holdout-aggregates.ts, which prints group aggregates only (as
measure's summary does) and writes nothing.

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
| corrosion/ramp-pairs.ts | Do the replay's stops hold more than the ramp's readings allow between any two of them (independent of the application's logged ms)? The least hidden hold they ask | `TOL=150 [OTHER=none] node scripts/probes/corrosion/ramp-pairs.ts [ids…] [--since] [--verbose]` | 2026-11-23, ramp slow-downs |
| corrosion/freezeramp.ts | Does a freeze hold Corrosion's ramp in the log (the hold the readings allow across each replay freeze)? | `node scripts/probes/corrosion/freezeramp.ts [ids…]` | 2026-11-23, ramp slow-downs |
| corrosion/stop-sum.ts | Held world time at the lowest scale against the sum of the stops (rule T3), placed casts only | `node scripts/probes/corrosion/stop-sum.ts <id> <from s> <to s>` | 2026-11-23, round 6 |
| crits/layer-xval.ts | layerCrits with every crit flag hidden: how many inferred crits the log flags as crits, against the base rate and a shuffled listing (negative control) | `node scripts/probes/crits/layer-xval.ts [--shuffle] [-v]` | 2026-11-23, Wolven Blood crits |
| crits/value-xval.ts | valueCrits with half the crit flags hidden (two folds): the inferred crits the log flags as crits, per operator, against the base rate and values shuffled within a key (negative control) | `node scripts/probes/crits/value-xval.ts [--shuffle] [--show]` | 2026-11-23, ticks and layers |
| physical/physmiss.ts | Each log-only physical status hit without a landing: the logged hits at its ms, the replay's status landings within 1.5 s and the enemy state there | `node scripts/probes/physical/physmiss.ts [ids…]` | 2026-11-24, fight totals 4 |
| physical/shatters.ts | Each logged Shatter: whom the log credits, the physical statuses at its ms, the controlled operator, the replay's Shatter | `node scripts/probes/physical/shatters.ts [ids…]` | 2026-11-24, fight totals 4 |
| physical/shatter-credit.ts | Each replay Shatter's credit under "the Vulnerable instance's starter" against the log's | `node scripts/probes/physical/shatter-credit.ts [ids…]` | 2026-11-24, fight totals 4 |
| edge/edge-export.ts | Per Type 50 Yinglung's Edge wearer combo: the engine's layers and both readings' damage | `node scripts/probes/edge/edge-export.ts > scratch/edge-all.json` | 2026-11-23, round 6 |
| edge/edge-score.py | The Edge stack-count hypotheses (H1–H13) scored against the implied layers (edge_implied.py) | `python3 -I scripts/probes/edge/edge-score.py [-v]` | 2026-11-23, round 6 |
| stats/build.ts | The misprediction statistics' tables: every development log's hits (verdict, readings, zones, differences, one-difference / crit / boundary counterfactuals, cast, stop, hold, cut, time features), one-sided landings and fights | `node scripts/probes/stats/build.ts [--workers 4] [ids…]` (writes scratch/stats/hits.jsonl, onesided.jsonl, fights.jsonl) | 2026-11-24, misprediction statistics (at e5f22ef's code) |
| stats/names.ts, stats/buffprops.ts | Operator names, weapon and gear set names (round 11); every team kit buff's properties (target, consumed, instances, origin, trigger events) for the tables | `node scripts/probes/stats/names.ts`, `node scripts/probes/stats/buffprops.ts` (scratch/stats/names.json, equipment.json, buffs.json) | 2026-11-24 |
| stats/analyze.py (with load.py) | Where the error concentrates: first explanations, buffs by mechanism (each row's top fight and top hit shares, the equipment's name, NOT_KIT fights apart), ratio clusters, drift, boundary effects, features with fight bootstrap and within-fight shuffles, interactions, a tree / lasso held out by fight group, one-sided kinds, fight-level features; `buff <regex> [fx…]` one buff's hits | `python3 -I scripts/probes/stats/analyze.py [section…] > scratch/stats/report.txt` (about a minute since round 11: numpy bootstrap and shuffles; features alone 17 s) | 2026-11-24 |
| stats/bands.py | The ×1.5 band of off hits by group (Empyrean combos by Stagger origin, Liino's ultimate windows, Alesh, Ardelia) | `python3 -I scripts/probes/stats/bands.py` | 2026-11-24 |
| stats/doublecount.py | Hits whose primary reading has a kit buff and an unmapped log buff with one zone and value: the log lists the kit buff under a game buff it doesn't name (KitBuff.loggedAs). Since round 11 a screen of its own: `efsim zmdlogs differences`' "Likely loggedAs" section (packages/logs/src/loggedas.ts, owner or equipment id required), and the pending suite fails on a new pair | `python3 -I scripts/probes/stats/doublecount.py` (reads scratch/stats/hits.jsonl) | 2026-11-24, misprediction candidates (the "ready" weapon buffs, Yvonne's P5) |
| stats/onebuff.py | One kit buff's hits explained by taking it the log's way, per fight (time, operator, event, ratio, which side has it); since round 11 a shim of `analyze.py buff` | `python3 -I scripts/probes/stats/onebuff.py <buff regex> [fx…]` (reads scratch/stats/) | 2026-11-24, kit buff leads |
| stats/hpside.ts, stats/hpside.py | An operator's hits against the enemy's HP left (the fight's logged total as its HP, or POOL × Max HP), a listed buff, logged ÷ primary; counts by HP side and ratio | `node scripts/probes/stats/hpside.ts <operator> <buff part> <ids…> > scratch/x.txt`, `python3 -I scripts/probes/stats/hpside.py < scratch/x.txt` | 2026-11-24, misprediction candidates (Chen's P1, test 69) |
| stats/lives.ts | An operator's hits of a key against the logged damage so far in multiples of Max HP (an enemy's lives) | `node scripts/probes/stats/lives.ts [operator] [key part]` | 2026-11-24, misprediction candidates (Alesh's P5) |
| stats/holdout-aggregates.ts | The analysis's top candidates as group aggregates: the hold-outs' only view (reads them in memory, prints no log, operator or per-log value; the one probe that reads hold-outs) | `node scripts/probes/stats/holdout-aggregates.ts --holdout` or `--dev` | 2026-11-24 (after c9cf9a3) |
| kits/arcane-will-burst.ts | Each listed run of Solemn Phalanx's WILL burst buff against Arcane's nearest logged Arts Burst (does it start at her burst?) | `node scripts/probes/kits/arcane-will-burst.ts` | 2026-11-24, kit buff leads |
| bursts/arcane-bursts.ts | An operator's logged Arts Bursts against the replay's: within 150 ms, 0.15–0.55 s, none, replay-only (under a reading) | `node scripts/probes/bursts/arcane-bursts.ts [operator] [--assume burst-stops=others] [--ids a,b]` | 2026-11-24, cooldown-clock round |
| kits/typhoeus-press.ts | Typhoeus's battle-skill press events against her first floating-start arrow after each (ms, Hovering ATK listed) | `node scripts/probes/kits/typhoeus-press.ts` | 2026-11-24, kit buff leads |
| kits/zhuangfy-empyrean-end.ts | Each of Zhuang Fangyi's logged ultimate_skill events: a cast, or the Empyrean's end (seconds since the previous, her hits in the next 78 frames, her next forms, Lone Barge's ultimate buff on her next hit) | `node scripts/probes/kits/zhuangfy-empyrean-end.ts` | 2026-11-24, kit buff leads |
| stagger/pause-bars.py | Around each hitless pause: the Stagger bar before and after, the enemy debuffs carried across | `python3 -I scripts/probes/stagger/pause-bars.py [min s] [ids…]` | 2026-11-23, round 6 |
| placement/ult-events.ts | Each ultimate cast event (the first of a group) of a skill with a full time stop: the hitless stretch before and after it, press-like / end-like / mid, counts per operator (the rule is @efsim/logs castEventPlace since round 11: `zmdlogs instances`, `replay`'s EVENT lines) | `node scripts/probes/placement/ult-events.ts` | 2026-11-24, placement leads |
| placement/liino-amp.ts | Each Liino ultimate: the log's cast events, the hitless gaps before her first projectiles, Cosmovoice ATK's listed `since` | `node scripts/probes/placement/liino-amp.ts` | 2026-11-24, placement leads |
| cooldowns/physuit.ts | Swordmancer procs against the wearer's logged Physical statuses (proc or none, time since the last proc, Staggered); the world time then from `zmdlogs worldtime` | `node scripts/probes/cooldowns/physuit.ts` | 2026-11-24, placement leads (trigger-cooldowns) |
