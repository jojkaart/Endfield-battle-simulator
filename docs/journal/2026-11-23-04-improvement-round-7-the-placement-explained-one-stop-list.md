## 2026-11-23: Improvement round 7: the placement explained, one stop list, measure's checks

**Goal:** the seventh friction round over the five open reports (round 6's backlog and own report, hold-clocks,
rossi-gilberta, ramp-slowdowns), behaviour-preserving, beside an agent working on kit and engine accuracy.

**Done** (docs/friction-done/2026-11-23-round-7.md has the list by cause): `zmdlogs holds --why` (one refresh rule,
one clock check, each instance's verdict recorded by runBounds / statusBounds); scripts/cli-ab.ts (any efsim command
at two commits' code, `--holds` for the bounds a change moved); `measure --hits` against the code that wrote the
snapshots, with the modifiers that moved per hit; `measure --variant`; the negative control and a count of logs
without `since` in every measure; `zmdlogs ramp --held`; the compiler's time dilations listed (`efsim kit`,
`gamedata dilations`); `verify-at --test`; tests/stops-source.test.ts; casts view on the replay's stops, with
`poise.origin` and batched times. Snapshots unchanged ("No log's verdicts moved"); the scoreboard as it was
(development 65.2% plain, hold-out 73.7%).

**Decisions:** a test, not a lint rule, guards the stop lists (a lint rule needed disable comments in buffreplay.ts,
which the other agent edits). The replay's run() refactor, KitWindow's chain, pinned expiries, the status trace and
the engine clock's one shift value stay in the backlog: each needs buffreplay.ts or the engine's clock to itself.
Round 6's points 1–10, 12 and 14 parked after their second carry.

**Findings:** cutting the placement's unplaced cast events' stops at resets made 1cd1 worse (plain 182 → 177: an
event's time is the press, Arcane's combo cast a second later), so they stay uncut (open-problems). All 13 hold-outs
lack `since` / `source` on their effects: the lane-based rules (hidden holds' run clocks, heldToLoggedEnds,
layerCrits) are untested there; a blind re-import is the lead's and owner's call. The first measure after a
code-only commit printed "no hit's verdict changed" for a moved log: hold-clocks point 2 reproduced, then fixed.

**Problems:** friction.ts carry put the carried-from note in the middle of a wrapped From line (fixed). Two empty
heredocs typed from habit (not refused); a chained `&& git commit` ran after a typecheck error piped through `head`
(amended).
