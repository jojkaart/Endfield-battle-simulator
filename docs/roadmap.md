# Roadmap

## Next steps

Done 2026-10-18: TypeScript project, CI, data loader with cross-checks, stat
aggregation, single-hit damage, Laevatain's kit, the Zero Sanity fixture (35
in-game values, all exact), the `efsim` damage calculator, ZMDLogs fixtures
and checker, the timeline (v1) with arts reactions and stacks, and kits for
the six favourites.

1. **Kit abstractions** ([kit-abstractions.md](kit-abstractions.md)), before
   adding operators (owner's call, 2026-10-18): one `Condition` and one
   `ValueExpr` replacing `when` / `requires` / `scaleIf` / `ValueSpec`; one
   `triggers` list replacing `comboTriggers` / `teamTriggers`; buff
   lifecycle; `kit-draft` v2 and loader defaults compiled from SkillData /
   BuffData (frames, energy, blocks, factors, event keys, buffs).
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
