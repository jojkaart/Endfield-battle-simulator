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
2. **Set up the TypeScript project:** package layout, test runner, lint and
   typecheck, and a loader that reads tables from `data/` submodules
   (watch for int64 text IDs and 555me's string-encoded numbers).
3. **Table cross-check test:** compare the tables the engine uses between the
   two `data/` submodules and fail on any difference.
4. **First fixture: single-hit damage.** Reproduce the in-game verified
   Laevatain hit table and stat-panel tests from
   `reference/zero-sanity-timeline` (`src/tests/unit/laevatainDamageCalc.test.ts`,
   `loadoutAggregator.test.ts`). Those values date from ~March 2026, so check
   for balance changes in the data history first.
5. **Second fixture:** one short single-target ZMDLogs battle (parser v57+),
   matched hit by hit.
6. **Rotation fixture:** the End-DPScope standard Endaxis scenario
   (3,700,482 and its three variants), as a loose cross-simulator check.

## Later

- Rotation simulation on a timeline (SP, energy, cooldowns, buffs, reactions).
- Team-composition search with constraints (must-include / always-exclude
  operators, available weapons and gear).
- Web interface for browsing and comparing results.
- Rust implementation of the engine, validated against the same fixtures.
