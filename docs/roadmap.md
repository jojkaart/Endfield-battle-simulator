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
   - Batch 1 is done: the seven kits and 17 equipment kits are in, with no
     log mismatches ([kits](kit-batches/batch-1.md#kits-2026-10-19)); what's
     left waits on in-game tests
     ([open](kit-batches/batch-1.md#pass-2-whats-still-open)).
   - Batch 2 is done: five kits and 27 equipment kits, and the leftovers
     K1–K8 ([batch-2.md](kit-batches/batch-2.md)); K3 and K7 wait on
     in-game tests.
   - Batch 3 is done: the ten 5-star kits with 23 equipment kits
     ([batch-3.md](kit-batches/batch-3.md)); what's left waits on in-game
     tests 60–76 or is listed as open in the
     [review](kit-abstractions.md#review-after-batch-3s-kits-2026-10-20)
     (S3's residue, the dodge policy for `cast` counters, loader warnings,
     compiler leftovers D3 / D4).
   - Batch 4 is done (2026-10-21): the eleven 6-stars and 41 weapons, so
     every playable operator and every weapon and gear set has a kit
     ([batch-4.md](kit-batches/batch-4.md)). Dive attacks are rotation
     actions. The review's follow-ups are done (log checker; attributes
     reaching ATK, stack caps from the data, tags, `linkGained`; engine
     timing). Open: a beside cast's timeline items, compiler leftovers
     ([kit-abstractions.md](kit-abstractions.md#review-after-batch-4s-kits-2026-10-21)),
     in-game tests 77–97.
2. **Rotation search** (`efsim search`, beam search on the stepping API):
   resource-aware ranking, ranking over seeded battles for random outcomes
   (crit-triggered kits ranked with rolled crits), the found rotation's
   spread, dives. Next, the tool's purpose: team searches for the
   owner's favourites (6-stars at P0, 4- and 5-stars at P5 unless the
   owner's account data says otherwise) and a report of the best
   rotations found.
3. **The new logs** (fixtures/pending/README.md, 2026-10-21): 16
   single-target fights for the operators that had none; find each
   operator's constant factor (build values the log doesn't record, food,
   enemy-side effects), then the kits' own mismatches. Six multi-target
   fights wait in fixtures/multi-target/ for multi-target support.
4. **Food buffs:** consumables (UseItemTable, BuffData `buff_common_*_potion_*`)
   as a per-operator build option, so simulations and searches can count
   them (one food buff per operator, 300 s). The Endministrator's +180 ATK
   in 7e19 was one (Ginseng Meat Stew).
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
