## 2026-10-20: batch 3 — the ten kits, pattern review

**Goal:** batch 3's kits (the ten 5-stars with their 5-star weapons and
two gear sets), after the shared features below.

**Done:** ten kit agents in worktrees, one per operator, from one shared
brief (re-analysis of every gap against the engine first, then the kit,
tests, an example, the logs, a "Kit" section in the report). Merged one at
a time; the compiler test's OPERATORS / KNOWN lists conflicted at every
merge and were resolved by a script that keeps both sides. 963 tests.
Logs: Xaihi 82/82 hits with her fixtures' weapon levels fitted (85, 60);
abfd's reactions 5 matched / 3 unexpected (was 0 / 8). Pattern review:
`efsim kit-census` on 22 kits; MI Security's counter replaced by
`buffLayers`; `enemyHpBelow` takes a value; `randomOutcomes` counts
`choose`. Pending-log notes updated.

**Decisions and why:**
- Two kit agents each fixed `ownHitsLanded` for a different case
  (Snowshine: nothing past a first end; Wulfgard: nothing a due jump
  skips); both are general rules, so the merge keeps both.
- Snowshine's combo trigger ("HP below 60%") stays an interim (any
  attack on the controlled operator opens it), since operator HP isn't
  tracked (owner, 2026-10-20): in fights without enemy attacks her combo
  never comes, which fits "effects needing low HP don't fire".
- Chen's P1 follows the data (below half enemy HP), although the 7e19
  log lists it at full HP; in-game test 69 decides.

**Problems:** the machine's load with ten agents made the CLI process
tests time out at 60 s in several agents' runs (they pass alone and in
the merged run). Open engine-wide questions are listed in the review
(kit-abstractions.md): buffs held by global slow-downs, the dodge policy
and `cast` counters, S3's residue.
