## 2026-10-18: design review with the owner

- Owner approved scheduled action lists for recorded rotations, and wants
  later an interactive system: battle simulation and a policy evaluator
  side by side, generating the action list on the fly and searching the
  tree of choices. Design now has a **stepping API** (init / advance to
  decision point / legal actions / apply / fork) with recorded rotations
  and search as drivers on top.
- Owner plays daily and may run simple in-game tests; started
  [in-game-tests.md](../in-game-tests.md).
- Talos Wiki API: lookups as needed are fine, no scripted mass downloads;
  ask before any unavoidable mass download (now in CLAUDE.md).
