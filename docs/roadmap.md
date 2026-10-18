# Roadmap

## Next steps

1. **Review the design with the owner** ([design.md](design.md)), then
   settle its open questions where data can (tie-break order, which action
   types the first fixtures need). Keep [glossary.md](glossary.md) growing.
2. **In-game tests:** the owner plays daily and may run simple tests;
   list and status in [in-game-tests.md](in-game-tests.md). Stat panels
   are ready now; the others wait on the engine.
3. **Set up the TypeScript project:** package layout, test runner, lint and
   typecheck, and a loader that reads tables from `data/` submodules
   (watch for int64 text IDs and 555me's string-encoded numbers). Include:
   - **language-neutral fixtures:** expected results as data files (setup,
     rotation, expected values) that the TypeScript tests read now and the
     Rust tests will read later;
   - **fixture provenance:** each fixture records its source and the game
     version / data submodule commit it was verified against;
   - **CI** (GitHub Actions) running lint, typecheck and all tests on every
     push, fetching only the needed data folders (sparse checkout) with
     caching;
   - **SessionStart hook** for cloud sessions: initialise submodules and
     install dependencies so tests can run immediately;
   - `NOTICE` file with copyright notices whenever MIT code from
     `reference/` is copied;
   - JSON Schemas for `DataBundle`, `Scenario`, `Result` (`schemas/`);
   - the version-pinned enum map ([game-data-format.md](game-data-format.md#known-enum-values)).
4. **Table cross-check test:** compare the tables the engine uses between the
   two `data/` submodules and fail on any difference.
5. **First fixture: single-hit damage.** Reproduce the in-game verified
   Laevatain hit table and stat-panel tests from
   `reference/zero-sanity-timeline` (`src/tests/unit/laevatainDamageCalc.test.ts`,
   `loadoutAggregator.test.ts`). Those values date from ~March 2026, so check
   for balance changes in the data history first.
6. **Second fixture:** ZMDLogs `btl_upload_40d9a3c1da37` (Rhodagn, 1.6,
   19 s, Laevatain ultimate hits), matched hit by hit via `/api/battles/{id}`;
   later `btl_upload_f239236b857f` as the full-kit Laevatain fixture
   (needs 1.5 data). See [data-sources.md](data-sources.md#zmdlogs).
7. **Rotation fixture:** the End-DPScope standard Endaxis scenario
   (3,700,482 and its three variants), as a loose cross-simulator check.

## Later

- Rotation simulation on a timeline (SP, energy, cooldowns, buffs, reactions).
- Interactive search: drivers on the engine's stepping API that generate
  the action list on the fly, with a battle policy / evaluator exploring the
  tree of choices ([design.md](design.md#stepping-api)).
- Team-composition search with constraints (must-include / always-exclude
  operators, available weapons and gear).
- Web interface for browsing and comparing results.
- Rust implementation of the engine, validated against the same fixtures.
- **Patch update routine:** bump data submodule pins, re-run the data
  cross-check, review every fixture whose result changed (balance change vs
  bug), and record it in the journal. Document once the first update is done.
