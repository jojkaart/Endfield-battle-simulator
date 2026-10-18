# Roadmap

## Next steps

Done 2026-10-18: TypeScript project, CI, data loader with cross-checks, stat
aggregation, single-hit damage, Laevatain's kit, the Zero Sanity fixture (35
in-game values, all exact) and the `efsim` damage calculator.

1. **More kits.** Hit structure for more operators, each verified against
   something in-game (a fixture). ZMDLogs is the best source: real hits with
   full loadouts for many operators. Liino: battle skill and combo done;
   her follow-up volley and combo wait on a Corrosion model that matches
   the logs, her ultimate on a parser-v59 log (in-game tests 4 and 6).
   Arcane's kit is in; to finish it
   (journal 2026-10-18 "Arcane's kit"): count stackingType-1 log buffs once
   per buff ID, then move `fixtures/pending/` into `fixtures/`; let a kit hit
   require Intellect ≥ Will (or the reverse); let one event key try several
   hits; settle `zmdlogs-d9e59d0fb737` (game 1.5?) with a 1.6 INT log; then
   restore the withheld event keys listed in the kit's notes.
2. **ZMDLogs hit-by-hit fixture** (`btl_upload_40d9a3c1da37`, Rhodagn, 1.6,
   19 s): import the loadout and the per-hit damage (`/api/battles/{id}`),
   store only the extracted numbers with the battle ID (no names), and
   match each hit. Needs buff zones from the log's buff events
   ([data-sources.md](data-sources.md#zmdlogs)).
3. **Conditional effects** from BuffData: weapon and gear set passives,
   talent buffs, with the zones not yet modelled (susceptibility, link,
   finisher, weakness, protection, multiplicative). Reactions and physical
   statuses after that (Zero Sanity's combustion value 2608 is ready as a
   fixture).
4. **Rotation engine** on the stepping API ([design.md](design.md#stepping-api)):
   timeline, SP, energy, cooldowns, buff durations; first check against the
   End-DPScope standard scenario (3,700,482, loose tolerance).
5. **Still open from setup:** JSON Schemas for `Scenario` / `Result` once
   they exist, `NOTICE` when MIT code is first copied, the tie-break order.

## Later

- Rotation simulation on a timeline (SP, energy, cooldowns, buffs, reactions).
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
