# Roadmap

## Next steps

1. **Verify the unverified.** Items marked *(unverified)* in
   [data-sources.md](data-sources.md) came from search-engine extracts because
   the sites were blocked during research. With web access, check them,
   especially:
   - licences/terms: Talos Wiki footer, EndfieldHub terms;
   - APIs: Talos Wiki `api.php` / Lua data modules, EndfieldHub `/webmcp/*.json`,
     ZMDLogs export API;
   - the open formula questions (Breach, Corrosion vs Arts Intensity, rounding;
     note.com/at67275 on rounding).
   Update data-sources.md with what's found.
2. **Design document** (`docs/design.md`) before code: data model, rotation
   format, and the boundary between engine, data loading, search and UI. The
   engine boundary is what the Rust port will replace, so keep it explicit.
   Also start `docs/glossary.md`: game terms, naming variants
   (Rank 1–12 = Lv1–9 + M1–M3 = 专1–3) and internal IDs (`pelica` = Perlica).
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
     `reference/` is copied.
4. **Table cross-check test:** compare the tables the engine uses between the
   two `data/` submodules and fail on any difference.
5. **First fixture: single-hit damage.** Reproduce the in-game verified
   Laevatain hit table and stat-panel tests from
   `reference/zero-sanity-timeline` (`src/tests/unit/laevatainDamageCalc.test.ts`,
   `loadoutAggregator.test.ts`). Those values date from ~March 2026, so check
   for balance changes in the data history first.
6. **Second fixture:** one short single-target ZMDLogs battle (parser v57+),
   matched hit by hit.
7. **Rotation fixture:** the End-DPScope standard Endaxis scenario
   (3,700,482 and its three variants), as a loose cross-simulator check.

## Later

- Rotation simulation on a timeline (SP, energy, cooldowns, buffs, reactions).
- Team-composition search with constraints (must-include / always-exclude
  operators, available weapons and gear).
- Web interface for browsing and comparing results.
- Rust implementation of the engine, validated against the same fixtures.
- **Patch update routine:** bump data submodule pins, re-run the data
  cross-check, review every fixture whose result changed (balance change vs
  bug), and record it in the journal. Document once the first update is done.
