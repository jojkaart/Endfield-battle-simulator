## 2026-11-16: Faster tests, snapshot regeneration, accuracy scoreboard

Architecture review items 2, 5 and 11. **Tests:** buffreplay.test.ts was
split into three files and search.test.ts into two. The six single tests
of 25–60 s (whole log checks on 3f78, 4a64 and 4e5e, and `efsim search
--loop` output) moved to tests/slow/log-cases and search-loop-cli. No
assertion was dropped. test:logs now runs 3 workers and the pending logs
in 4 shards, because a log's check time doesn't follow its hit count
(340 hits can take 59 s). `npm test`, base and branch back to back at
load 11–12: 629 s with 2 timeouts (exactly the moved tests) against 380 s
passing. At load 3–5 the base took 383 s. **Snapshots:** `npm run
snapshots:update` (scripts/snapshots.sh) empties every snapshot and writes
it again, so the result doesn't depend on which side of a conflict was
taken. It restores the files if a run fails. **Scoreboard:**
[accuracy.md](../accuracy.md) comes from the verdict snapshots and
holdout.json (scripts/accuracy.ts; a test keeps it in step). First
numbers: development 31 fights, plain 47.2%, mismatch 19.8%, mean |damage
error| 15.8%; hold-out 13 fights, 62.1%, 7.6%, 13.5%; verified 6 fights,
71.0%, 0 mismatches, 1.7%. The fit measure for "better/worse": plain
matches, mismatches and |total damage error|. Hold-outs count only in
totals. It is used in the pending check's failures and shard summaries,
in `--compare <ref>`, and at the end of premerge.
