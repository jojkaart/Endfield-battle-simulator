## 2026-11-16: Architecture review

The owner asked for an analysis of the whole architecture and how it
could help development: [architecture-review.md](../architecture-review.md)
(read-only; prioritised table at the top). Measured: `npm test` 308 s
under load (two files make 45% of the summed time), every CLI call or
worker spends 9–11 s building the game data (42% of a profile of three
300 s rule runs; `efsim find` 9.1 s), and most of a rule run is asking
whether a press can start (frame-by-frame stepping, state copies).
Top items: a cached GameData, test rebalancing, rule-run invariants, a
button model in the engine (the End Stance class of bug), event-driven
rule stepping, assumption toggles and an accuracy scoreboard. No code
changed.
