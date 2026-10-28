# Roadmap

Only what's next; what's done is in the [journal](journal.md) (older:
[archive](journal-archive.md)) and the batch docs. Every playable operator,
weapon and gear set has a kit (batches 1–4,
[kit-process.md](kit-process.md)); the October review's two rounds are
done but for the items below ([review-2026-10.md](review-2026-10.md)).

## Next steps

0. **Engine accuracy first** (the owner, 2026-10-26: above the search's
   scoring): [accuracy-plan.md](accuracy-plan.md). Phase A, B1 (Stagger)
   and B0 (teammates' own basic attacks, in-game test 101 to confirm the
   pace) are done; next SP recovery (B2), Corrosion, Solidification /
   Combustion durations, a reaction's own hit, the favourites' kit leads
   (Arcane's Nature burst in dbae).
1. **The tool's purpose: team rotations for the owner's favourites**
   (Typhoeus, Arcane, Si, Gilberta, Liino, Estella, Laevatain; 6-stars P0,
   4- and 5-stars P5 unless the owner's account says otherwise; no swaps by
   default, the owner's call 2026-10-25). The search's beams still disagree
   by 4–14%: a score closer to the final damage (a cheap rollout, or a value
   for what a state holds), then searches of the favourites' teams and a
   report of the best rotations found. Ask the owner for their roster.
2. **Log check leads** (design.md "The log check's rule"; the report names
   them, largest first): Stagger the log has that no logged hit explains
   (4e5e: 24 at 53.2 s), Rossi's Wolven Blood layers, Typhoeus's hover through
   her combo, Arcane's Solemn Phalanx WILL buffs, Camille's weapon ATK the
   log stops listing, the replay's inflictions against the log's reactions
   (one enemy replay instead of reactioncheck.ts's own), statuses and
   landings the replay misses (Arcane's Final Strike in b6aa, 9555's casts);
   458b's ×1.3 on Laevatain's `normal_skill_during_ult`; then tighten the
   totals' bound (45%). The fallbacks in verified fixtures (~300) are the
   work queue; a build fitter with structured `buildOverrides` instead of
   hand fits in notes; the negative control on the unscaled replay; d9e5
   (×1.7–2.0 after Arcane's ultimate); whether mostly-assumed matches (Rossi
   in 4e5e) hold hit by hit.
3. **Kit values from the data** (design.md "Kits and the game data"): fill
   launch frames, applications and bonuses; SP of hitless skills as cast
   triggers; the Typhoeus arrowrain `dataOverride` that hides dbae's
   verified hits; Mi Fu's per-fixture factor (2fd9 / 99fb / de6a).
4. **Engine:** slow-downs don't shift what's created between their cast and
   their start (`shiftClock`'s caller in clock.ts); buffs' expiry and ticks
   as scheduled items; `Modifier` with an attacker / defender side instead
   of `SNAPSHOT_ZONES`; Solidification durations (in-game test 71);
   Corrosion's time dilation and carry-over (test 4).
5. **Food:** a search over foods per operator; the importer setting a food
   the log lists; in-game test 98 (DEF +x%'s formula item 1).
6. **Process:** a generated table of which mechanics are verified against
   real data and which only against the engine's own reading (the in-game
   tests' queue is at the top of in-game-tests.md: keep it current); shared
   test helpers. Still open from setup: a `Result` schema,
   `NOTICE` when MIT code is first copied.

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
