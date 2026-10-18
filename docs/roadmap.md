# Roadmap

## Next steps

Done 2026-10-18: TypeScript project, CI, data loader with cross-checks, stat
aggregation, single-hit damage, Laevatain's kit, the Zero Sanity fixture (35
in-game values, all exact), the `efsim` damage calculator, ZMDLogs fixtures
and checker, the timeline (v1) with arts reactions and stacks, and kits for
the six favourites.

1. **Kit batches** ([kit-process.md](kit-process.md)): analysis → shared
   features per family → re-analysis, until nothing is missing; then kits.
   Batch 1: Laevatain and the six favourites with their weapons and gear
   sets (absorbs the remaining steps of
   [kit-abstractions.md](kit-abstractions.md#4-order-of-work)). Batch 2: the
   Endministrator and the 4- and 5-star operators nearly every player has.
   - Batch 1 implementation pass: triggers, equipment kits, conditions,
     buff lifecycle, values and resources, skills (timing from SkillData),
     stacks, arts state and the log checker's stack caps are in
     ([progress](kit-batches/batch-1.md#progress)). Still to do: physical
     statuses and stagger (P1–P2), time dilation and haste (Ti1, Ti4), the
     SkillData compiler and loader defaults (D1, with projectile timing
     Ti2), then re-analysis of the seven and their kits.
2. **Rotation search** (`efsim search`, beam search on the stepping API) is
   in; next: a resource-aware evaluator, team runs for the favourites, and a
   report of the best rotations found.
3. **Corrosion model:** time dilation, the applier's talents (Arcane), and
   carry-over on reapplication; in-game test 4.
4. **Still open from setup:** a `Result` schema, `NOTICE` when MIT code is
   first copied, the tie-break order.

## Later

- Interactive search: drivers on the engine's stepping API that generate
  the action list on the fly, with a battle policy / evaluator exploring the
  tree of choices ([design.md](design.md#stepping-api)).
- **Account import** from the SKPORT capture extension
  ([player-data.md](player-data.md)), only once the system is verified and
  can find useful new team rotations (owner's call, 2026-10-18). Until then,
  fixtures use published, fully specified setups.
- Team-composition search with constraints (must-include / always-exclude
  operators, available weapons and gear).
- Web interface for browsing and comparing results.
- Rust implementation of the engine, validated against the same fixtures.
- **Patch update routine:** bump data submodule pins, re-run the data
  cross-check, review every fixture whose result changed (balance change vs
  bug), and record it in the journal. Document once the first update is done.
