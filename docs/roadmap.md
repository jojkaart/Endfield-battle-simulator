# Roadmap

## Next steps

Done 2026-10-18: TypeScript project, CI, data loader with cross-checks, stat
aggregation, single-hit damage, Laevatain's kit, the Zero Sanity fixture (35
in-game values, all exact), the `efsim` damage calculator, ZMDLogs fixtures
and checker, the timeline (v1) with arts reactions and stacks, and kits for
the six favourites.

1. **Kits for the six favourites (in):** Typhoeus, Arcane, Si, Gilberta,
   Liino, Estella, each with notes on what's verified. To finish: add
   `applies` (inflictions) to every kit and check them with `efsim zmdlogs
   reactions`; restore the event keys the agents held back now that the
   checker handles shared keys and BuffData stacking; a literal factor per
   hit (Typhoeus's split arrows); a reaction-type kit hit (Typhoeus's own
   burst); a mode requirement (Arcane: Intellect ≥ Will); Link
   (`buff_common_affixes_combo_trigger` → skillimbue, ×1.2 at one stack);
   importing zero-duration log buffs as unquantified (Liino's in d9e59).
2. **Ultimate energy and combo triggers** in the timeline, so rotations
   can't cast ultimates or combos they couldn't in game.
3. **Team buffs from skills** on the timeline (BuffData modifiers with
   durations), starting with the favourites' own: Liino's ATK and Amp,
   Si's ultimate Amp, Typhoeus's combo debuff, Estella's Physical
   Susceptibility, Arcane's Susceptibility.
4. **Rotation search** for a team of favourites: policy-driven drivers on
   the stepping API comparing rotations by total damage over a fixed time.
5. **Corrosion model:** time dilation, the applier's talents (Arcane), and
   carry-over on reapplication; in-game test 4.
6. **Still open from setup:** a `Result` schema, `NOTICE` when MIT code is
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
