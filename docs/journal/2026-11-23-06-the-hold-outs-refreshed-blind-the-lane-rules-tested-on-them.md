## 2026-11-23: The hold-outs refreshed blind: the lane rules tested on them

Goal: round 7 found every hold-out (and the verified 40d9, 4e5e) imported before effects carried `since` / `source`,
so the replay's rules that read the log's buff runs (the hidden holds' run and status clocks, `heldToLoggedEnds`,
`layerCrits`) were untested there. Refresh them without anyone seeing a hold-out, then measure.

Done:
- `zmdlogs refresh` refused 40d9 and 4e5e: one 0 ms trigger buff each was unquantified at import, and today's detail
  has every `dynamicEffects` empty (40d9 under the same parser version). `refreshFixture` now lets a hit's
  `unquantified` listing only have lost entries, keeps the fixture's then (`RefreshResult.keptUnquantified`, one
  provenance note) and still refuses a new entry. Both refreshed: since / source / poise.origin added; verdicts
  unchanged (4e5e: other counts only).
- scripts/holdout-refresh.ts: the split's hold-out ids by code, each detail fetched once (3.5 s apart, the importer's
  user agent, memory only, never the raw cache), refreshed in a temporary copy, written back only if its id, battle,
  team and enemy are unchanged; prints an index, ok / failed (a category) and since yes/no per fixture, then counts.
  Tested on a synthetic root (tests/holdout-refresh.test.ts). Run: 13 ok, since 0 → 13, no listing kept.
- Scoreboard (same code, main at 636bbc0; the fixtures only): hold-out plain 74.0 → 77.6%, matched 91.7 → 92.1%,
  mismatch 6.4 → 6.3%, mean |damage error| 10.8 → 10.6%, within 5% 7 → 8; 5 better, 1 worse, 6 mixed, 1 unchanged.
  Verified, development, earlier pending unchanged.
- `measure --variant hidden-holds=none|log|holds` on the refreshed hold-outs against the default `placed` (77.6%,
  6.3%, 10.6%): none 70.3%, 6.5%, 10.9% (1 better, 7 worse); log 73.0%, 6.5%, 10.7%; holds 76.8%, 6.3%, 10.5%.

Decision: the hidden holds (`placed`, `log` on top) are confirmed on the hold-outs: the best reading there, by about
the development logs' margin (none → placed: development 57.8 → 65.4%, hold-out 70.3 → 77.6%).

Left: the one hold-out worse after the refresh can't be traced (a hold-out); `layerCrits` has no assumption reading,
so its share of the 74.0 → 77.6% isn't separated; a detail takes ~45 s to download.
