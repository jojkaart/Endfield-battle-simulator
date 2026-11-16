## 2026-10-21: batch 4 — the eleven 6-stars, Link, dives

**Goal:** the owner's "complete the rest of the operators": the eleven
6-stars without kits and the 41 weapons without one, through the full
process (analysis, merge, shared features, kits, review).

**Done:** eleven analysis agents (read-only, draft kits checked against
the logs in scratch copies), one merge agent (docs/kit-batches/batch-4.md:
E, T, C, V, B, S, A, D, L rows, owner decisions, weapon owners, test
proposals), five feature agents in worktrees (triggers and conditions;
values and buffs; skills and timing; data compilation; log tooling), one
dive agent (batch-1 S10: dives as rotation actions and in the search),
eleven kit agents, three follow-up agents (log checker; stats and loader;
engine timing), and two docs agents (in-game tests 77–96 and parts of
existing tests). All merged one at a time; 1622 tests. Logs: b7b3 matches
every hit of all four operators; 4e5e's reactions 18/0/0 and, with kit
values for its hand-noted buffs, Camille 85/85, Estella 41/41, Rossi
152/162; 7e19 Pogranichnik 29/29, Ember 14/21; abfd Yvonne 182/183; 40d9
Camille 6/6.

**Decisions and why:**
- Link only from the data's sources (ComboAction: Lifeng's and Camille's
  combos; Akekuri's talent). Two analysis agents found it independently;
  five logs show ordinary combos leave none. Example totals dropped 1–9%
  where a battle skill or ultimate followed a combo. In-game test 8
  confirms it. Thermite Cutter reacts to Link; it gives none
  (Pogranichnik's kit agent corrected my first reading).
- Owner (2026-10-21): dives in rotations; 6-stars default to P0 in
  searches. Jump physics aren't in the data: Endaxis's values, with
  in-game test 97 for the pace and what a jump may do.
- Combustion's ticks keep the applier's side from the reaction (4e5e's
  three ticks fit only that); the enemy's side is read per tick.
- Merges without a full check after each while twelve agents ran (4 CPUs,
  15 GB, out-of-memory kills and test timeouts): typecheck, lint and the
  affected test files per merge, a full check once the load dropped.

**Follow-ups after the review** (three agents, merged one at a time,
each compared against a clean copy):
- Log checker: unquantified hand-noted buffs valued from the kits; Rossi
  on 4e5e 152/162.
- Values and loader: a buff's main attributes reach ATK through the
  panel's floored attribute bonus (`lifeng-solo` 391,096 → 514,161:
  Mountain Bearer, ×1.17 ATK per buff); stack caps from the data;
  Solemn Phalanx on the Arts Susceptibility tag; `linkGained` for
  Thermite Cutter; `efsim calc` shows attributes 76–79.
- Engine timing: ticks on a buff's end frame (4e5e's 26 bleed ticks);
  `afterHits` for delayed actions (per trigger: Yvonne's and Mi Fu's
  files order the same-frame clips oppositely); modifier conditions after
  a hit's own buffs (`yvonne-fluorite` +544); `untilFrame` (Ember); a
  button skill's windows open for the skill it casts (`camille-gilberta`
  201,716 → 200,535: Hunter Pursuit 8 frames sooner, its first hit now
  lands before Gilberta's field).
- No log verdict moved in either of the last two.

**Problems:** machine load with 12 agents (an agent's `pkill` may have
hit others' runs; `npx tsx` runs were killed for memory, `node` directly
works); several agents' worktree setup scripts were refused (links made by
hand, as before); the compiler test's OPERATORS / KNOWN lists conflicted
at every kit merge (resolved by script).
