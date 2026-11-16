# Fixtures and tests

Part of the [design](../design.md): Fixtures, tests, snapshots and the accuracy scoreboard.


- **Language-neutral fixtures** in `fixtures/` (repo root), one JSON file
  each: `scenario`, `expected` (totals, per-hit values or stats), `tolerance`,
  and `provenance` (source URL or file, date, game version, data submodule
  commits it was verified against). TypeScript tests read them now; Rust
  tests read the same files later.
- **Tolerance per fixture:** exact (or ±1 for rounding) for in-game verified
  values; looser for other simulators' outputs (they can be ~10% off for
  some operators).
- Fixture values are observations, so Zero Sanity's in-game per-hit tables
  and End-DPScope's scenario totals can be used. **Don't copy Zero Sanity's
  game-data JSON:** it's hand-curated, partly sourced from Endaxis
  (unlicensed), and we load from the submodules.
- **Unit tests** for each formula zone and each data adapter.
- **Cross-check test:** the tables the engine uses must be identical between
  the two `data/` sources.
- **Consistency tests:** the data compiler is deterministic (build twice,
  compare); a forked simulation equals one run from scratch; the same seed
  gives the same result.
- A fixture whose value changes after a data update is reviewed, never just
  re-recorded: balance change or bug.
- **Snapshots** (`tests/snapshots/`, 2026-10-24) are a regression baseline,
  not expected values with provenance (principle 11 doesn't apply to them,
  and they never stand in for a fixture): `examples.json` pins every
  `examples/*.scenario.json` result (total, hit and cast counts, damage per
  operator, a digest of the hits, whole and per 10 s; a failure lists the
  hits from the first window that moved), `log-verdicts.json` the verdict
  counts per operator of every verified log fixture (a ratchet: no fewer
  plain, plain + assumed or total matches, no more fallbacks), and
  `log-verdicts-pending.json` those of every pending fixture (exactly: they
  only pin the current state). A deliberate change: `npm run
  snapshots:update` (scripts/snapshots.sh: every snapshot emptied and
  written again with `EFSIM_UPDATE_SNAPSHOTS=1`, so the result depends only
  on the code), and the file's diff goes in the commit with the reason.
- **The accuracy scoreboard** (docs/accuracy.md, scripts/accuracy.ts) is
  computed from the verdict snapshots and the hold-out split: per group
  (verified, development, hold-out, earlier pending) the shares of plain
  matches, matches and mismatches, the mean |total damage error| and the
  fights within ±5%, and the same per operator over every log but the
  hold-outs. `snapshots:update` writes it, a test checks it matches the
  snapshots, and `node scripts/accuracy.ts --compare <ref>` gives the change
  against another commit with each log's direction by the fit measure (more
  plain matches, fewer mismatches, a smaller |damage error|; hold-outs only
  as counts). The pending check's failures and shard summaries use the
  same measure.
- **`npm test`** runs everything but the slow checks; **`npm run
  test:logs`** (`tests/slow/`, a few minutes: the pending fixtures in four
  shards, the negative control, the search's beam ratchets, and single
  tests of tens of seconds) runs them, and `npm run check` runs both.
- **Test output:** vitest 5 shows a file's `console.*` output only when
  the file fails (unless `--silent=false`). A line meant for every run (a
  shard's summary, a "keep the gain" hint) goes through
  `process.stdout.write`.
- **Snapshot files** that don't parse (merge conflict markers) are read as
  empty by an update run and fail otherwise with the fix (tests/snapshot.ts
  `readStored`); snapshot tests record their entry before any assertion
  that can fail, so an update never keeps a stale entry. One writer
  (`formatSnapshot` / `writeSnapshotFile`) lays out every snapshot file;
  `node scripts/snapshot-keys.ts <file> --rename <regex> <to>` renames
  keys after a file move without running the tests, printing counts only.
- **Record fields and exact shapes** (2026-11-16): fields the engine keeps
  only as records for analyses (an infliction's `by`, a reaction's
  `inflictionBy`, a landing's `facts`) aren't part of behaviour. Behaviour
  tests match the fields they mean with `toMatchObject` (element, stacks,
  expiresAt; kind, level, consumed); one test per record pins its exact
  shape (packages/engine/test/status.test.ts "pins the record-only
  fields"). Adding a record then touches that one test.
- **The pending shards** (tests/slow/logs-pending-*.test.ts) are balanced
  by each log's check time in the last snapshot update
  (tests/slow/pending-costs.json, written by scripts/pending-costs.ts from
  snapshots.sh's vitest report; a new log falls back to its hit count).
