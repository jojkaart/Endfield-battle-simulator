# Roadmap

Only what's next, about one screen. Each step's leads, numbers and open
questions: [roadmap-details.md](roadmap-details.md) (same order), which also
holds the longer-term list. What's done: the [journal](journal.md). Every
playable operator, weapon and gear set has a kit (batches 1–4,
[kit-process.md](kit-process.md)); the October review is done but for items
below ([review-2026-10.md](review-2026-10.md)).

## Next steps

- **Architecture review** ([architecture-review.md](architecture-review.md),
  2026-11-16): the quick wins 1–7 first; the button model, one start
  check, event stepping, run checks, visible states in kits and assumption
  switches (8, 9, 3, 4, 10) are done, and the package boundaries and
  the design.md split (12–14, friction round 2); next the accuracy scoreboard (11),
  more open readings registered as kit assumptions (tests 101, 102, 108),
  and a cheaper basic-attack start for the rule driver (now most of a run).
- **Friction rounds** ([friction/](friction/README.md)): rounds 1–4
  done (round 4, 2026-11-18: a query layer over the logs, `zmdlogs
  instances | census | buffs | lanes | control | cadence`, `efsim kit`,
  `efsim repair`, `npm run smoke`, `team-ab`, a short lane in the test
  lock, the hold-outs' own snapshot file); the backlog
  ([2026-11-18-backlog-after-round-4.md](friction/2026-11-18-backlog-after-round-4.md))
  joins the next round once about five new reports have collected.
- **Rule-based rotations** (phases 1 and 2 done; 2026-11-22 the search
  decides its own questions: the objective across starts, rule sets,
  setups, new cues): for the owner only gear to farm (the owner's team's
  +8.0%; Arcane in INT mode is decided: −1.9% rules against rules, not worth
  the Hot Work loadout) and in-game tests 106, 108 (dives); next a cheaper
  variance for the guided search (most of a day's runs), the gear ascent
  on the new lists, a cheaper worth for timeline-moving stats.
- **Typhoeus's team:** the least converged search (beam 96, or seeded with
  the found rotations); fc63's 4th shot anchored to her 5th's cast;
  Liino's stance ATK missing at 4d60's combos (Perlica's combo hits and
  9090's −9.6% done 2026-11-22: Pulser Labs and Wild Wanderer before the
  hit's damage).
- **Gear:** a search seeded with the current rotation, so a re-search with
  new gear means something; then Si on the LYNX Slab loadout.
- **Planning after phase 3:** cheaper macros, a setup value that doesn't
  overvalue held pieces, skeletons that aren't greedy; the owner's opener
  and loop with Arcane in WILL; Ink Melt next to the owner's team.
- **Engine accuracy** ([accuracy-plan.md](accuracy-plan.md); the owner,
  2026-10-26: above the search's scoring): B2 (SP stop; test 102 isn't
  testable by hand, the owner 2026-11-16) stays on its interim, B4 waits on
  test 71; tests 18, 19, 101, 104 done from the logs (2026-11-16: bosses
  freeze, Haste isn't attack speed, teammates' pause 6.5 s); tests 9, 17,
  22, 46 decided and 21, 43 partly from the logs (2026-11-18: buffs created
  in a stop are held; Twilight still 0.1–4.6 s longer than its model); Arcane's misses grouped (2026-11-18: 908 → 866; next her
  Imprisonment's end from the log); the replay follows the log's Stagger
  windows, and the engine adds a 2 s recovery (2026-11-18, test 110 from
  the logs; with tests 8, 10, 12, 107, 108's tap: the owner's queue holds
  only game-only tests now); Gilberta's Vulnerable count at her ultimate
  (test 12's leftover); build offsets fitted, not hand-set (`zmdlogs
  fit-build`, fixture `buildOverrides`, 2026-11-18; next: weapon levels
  bounded by their skill levels, the old hand fits moved over); then the
  screened logs' leads
  ([open-problems.md](open-problems.md)), diagnosed in parallel; then B8,
  B6, B9, B10.
- **The tool's purpose:** rotations for the owner's favourites (Typhoeus,
  Arcane, Si, Gilberta, Liino, Estella, Laevatain, Rossi): a search score
  closer to the final damage, then searches and a report; ask the owner for
  their roster.
- **Standing lists** (details): log check leads, kit values from the data,
  engine, food, process.
