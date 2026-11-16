## 2026-10-18: energy, combos, buffs, rotation search; kit abstractions

**Goal:** make the timeline able to play a real rotation for the
favourites, then (owner's request) review what the kits share before adding
operators.

**Done:**
- Timeline: timed kit buffs (self / team / enemy, values from skill data,
  limited by hit kind), ultimate energy (cost after potentials, 0.065 per
  natural SP to the team, kit grants, Ultimate Gain Efficiency, blocks),
  combo windows (6 s, kit triggers), skill states (`availableWhile`),
  action kinds separate from level groups, swaps that wait. Research by a
  sub-agent across the data and both reference simulators.
- `efsim search`: beam search on the stepping API, deduplicating equivalent
  states; found rotations replay exactly with `simulate` and beat the
  hand-written example.
- Second kit round for all six favourites (inflictions, buffs, combo
  triggers, energy, event keys); every example scenario runs.
- Review: `docs/kit-abstractions.md` (what kits hand-write that the data
  has; requests grouped into five families; what in the parallel
  per-operator approach caused one-off fields). Owner's rule: repeat it for
  every new kit (`efsim kit-census`, CLAUDE.md).
- Step 1 of the review: one `Predicate` and one `ValueExpr` (engine
  `expr.ts`) replace hit `when` → `if`, `scaleIf` → `extraScale`,
  `ValueSpec` → `ValueExpr`, combo triggers' `when` / `whileBuff` → `if`.
  Behaviour unchanged (all examples and log matches identical). That
  commit's message lost these field names to shell backtick expansion;
  this entry is the record.

**Decisions and why:**
- BuffData stackingType 1 is "only the strongest counts"; a priority key
  alone isn't (two `vulnerable_crystal` instances add up in b7b3). One
  agent's opposite claim was checked against a log before it was used.
- Worktrees resolved the main checkout's packages, so some agent checks ran
  the wrong kits: `scripts/setup-worktree.sh`, and CLAUDE.md says to use it.

**Open:** steps 2–5 of the review (one trigger list, buff lifecycle,
kit-draft v2 compiling frames / energy / factors / buffs from the data,
arts-state extensions); a resource-aware search evaluator.
