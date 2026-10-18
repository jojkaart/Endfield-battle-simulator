# Design

Status: **draft** (2026-10-18). Sections marked *open* wait on the formula
research or the first fixtures. Game terms: [glossary.md](glossary.md).

## Goals that shape the design

- **Correct numbers first.** Every number the engine produces must be
  traceable: which data, which formula step, which rule.
- **Fast enough to search.** Team search evaluates many scenarios, so one
  simulation must be cheap and must not do I/O or parse tables.
- **Portable engine.** The engine will be rewritten in Rust and validated
  against the same fixtures. Its inputs and outputs are therefore plain,
  serialisable data, and nothing else crosses its boundary.
- **Deterministic.** Same input, same output, bit for bit. Randomness (crit
  rolls) only through an explicit seed.

## Architectural principles

These hold for all code, in TypeScript now and in Rust later. A change that
breaks one needs a recorded reason (in this document or the journal).

**Structure**
1. **Pure core, I/O at the edges.** The engine and every formula function are
   pure: no file, network, clock or global state. Loading, caching and
   display live in the outer layers. Anything pure can be tested with plain
   inputs.
2. **Data in, data out.** Layers talk only through serialisable data
   (`DataBundle`, `Scenario`, `Result`), described by versioned JSON Schemas.
   Inputs are validated against the schema at each boundary. The schemas are
   the contract the Rust engine must meet.
3. **Separately testable subsystems.** Stat aggregation, resources (SP,
   energy, cooldowns), buffs, reactions and damage are each callable on
   their own with explicit inputs, so they can be tested without a whole
   timeline.
4. **No dependencies in the engine.** It imports nothing outside its own
   package, which keeps it small and easy to port.

**Correctness**
5. **One place per rule.** Each formula zone, stacking rule or constant is
   implemented once, named after the game concept, and cites the source it
   was verified against (wiki page, fixture, table). No copies of a rule
   elsewhere.
6. **No magic numbers.** Game constants come from the tables (`BattleConst`
   and others). Values not found in any table go in one constants module,
   each with its source and a note that it isn't table-backed.
7. **Fail loudly.** Unknown IDs, unmapped attribute types, unsupported
   SkillData/BuffData nodes and illegal rotation actions are errors, never
   defaults or silent skips. A supported subset that's explicit beats a
   guess.
8. **Explicit units in types.** Branded types for ticks, seconds, IDs
   (`CharId`, `SkillId`) and ratios. Percentages are stored as ratios
   (`0.2`, not `20`) and converted only in the data adapters and the UI.
9. **Deterministic.** No `Math.random`, no `Date`, no dependence on object
   key or hash order; events have a defined total order; random crits only
   from a seeded generator passed in.
10. **Explainable results.** Every hit carries its multiplier-zone breakdown
    and every stat its contributions (base, weapon, gear, buffs), so a wrong
    number can be traced to one step and compared with an in-game stat panel
    or a ZMDLogs hit.

**Testing**
11. **Every expected value has provenance.** Fixtures record where each value
    came from and which game version and data commits it was checked
    against. An expected value is never changed just to make a test pass; the
    reason (balance change, bug fix, better source) goes in the commit and
    the journal.
12. **Test at every level:** unit tests per zone and adapter; property tests
    for invariants (more ATK never lowers damage, the DEF curve is continuous
    at 0, totals equal the sum of hits); fixture tests against in-game
    values; cross-source table checks; differential checks against the
    reference simulators with a loose tolerance.
13. **Bugs become tests.** A fixed wrong number gets a test that would have
    caught it.
14. **Green before merge.** Lint, typecheck and all tests pass locally and in
    CI before anything reaches `main`. A failing test is fixed, not skipped.

## Layers

```
 data/ submodules ──► [data]  ──► DataBundle (JSON)
                                      │
 Scenario (JSON) ─────────────────────┼──► [engine] ──► Result (JSON)
        ▲                             │        ▲
        │                             │        │
     [search] ───── generates many scenarios ──┘
        │
     [cli] / [web]  read and display Results
```

| Layer | Does | Doesn't |
|---|---|---|
| **data** | Reads raw tables from the `data/` submodules, adapts each source's quirks (int64 IDs, string-encoded numbers, i18n), normalises them into a `DataBundle`; cross-checks sources. | Any game logic beyond renaming and joining. |
| **engine** | Pure function `simulate(bundle, scenario) → result`: stat aggregation, timeline, resources, buffs, reactions, damage. | I/O, table parsing, search, display. |
| **search** | Builds scenarios from constraints (must-include, exclude, owned weapons and gear), calls the engine, ranks results. | Damage logic. |
| **cli / web** | Run scenarios and searches, store and show results. | Damage logic. |

Only the engine is ported to Rust. The TypeScript data layer can keep
producing the same `DataBundle` JSON for it.

## Data layer

- **Source of truth:** the raw tables in the `data/` submodules, read at
  build time. The `DataBundle` is generated, never committed (we don't
  republish data).
- **Adapters per source:** `rmxlinux` and `555me` differ in format (inline vs
  table i18n, numbers as strings in 555me). Each has an adapter producing the
  same normalised records, which makes the cross-check a plain comparison.
- **IDs:** the game's internal IDs throughout (`chr_0016_laevat`,
  `wpn_claym_0003`, `eny_0082_hsbear`). Display names come from i18n.
- **Numbers:** kept exactly as in the tables (e.g. `4.449999809265137`); no
  rounding on load. Rounding happens only where the formula is shown to round
  (*open*: rounding rules).
- **Attribute types** are numeric in the tables; the data layer maps them to
  names (`atk`, `def`, `str`, …) once, in one documented table, verified
  against known stat panels.
- **Provenance:** a `DataBundle` records the submodule commits it was built
  from and the game resource version (from 555me's commit message).

### DataBundle (sketch)

Records keyed by ID, containing only what the engine needs:

```ts
DataBundle {
  provenance: { sources: { name, commit }[], resourceVersion }
  constants: BattleConst            // atkRateOfMain, efficiencyOfDEF, …
  operators: Record<CharId, Operator>
  skills: Record<SkillId, Skill>    // per level: blackboard, cost, cooldown
  timelines: Record<SkillId, Timeline>  // from Json/SkillData, simplified
  buffs: Record<BuffId, Buff>           // from Json/BuffData, simplified
  weapons, gear, gearSets, enemies, …
}
```

Operator/weapon/gear growth curves are stored as tables, not pre-applied, so
the engine computes stats from levels the same way the game does.

### Skills and buffs from SkillData / BuffData

The raw files are C# action graphs, mostly presentation (animation, VFX,
sound, camera). Structure and known enum values:
[game-data-format.md](game-data-format.md). The data layer does **not**
interpret the graphs at run time. It compiles each skill and buff into a
small summary:

- **Skill:** hit frames (including hits from spawned entities and
  projectiles), per hit the blackboard scale key, poise, element and damage
  category (`damageDecorateMask`), inflictions, which buffs are applied at
  which frame, cancel windows, `durationFrame`, cooldown and cost.
- **Buff:** stacking type and limit, duration, attribute modifiers, damage
  modifiers (side, zone, value key).

Then it **overlays `SkillPatchTable`** by skill ID and level: the blackboard
and cost inside SkillData are defaults, not the real per-level values
(e.g. Laevatain's file says cost 0, the table says 100 SP).

What can't be compiled mechanically (conditional and triggered logic, combo
trigger conditions, which come from data we don't have) goes in a small
**hand-written behaviour layer per operator**, in a typed, schema-checked
format. Each hand-written rule cites its source and has a test. Unknown
action types or enum values fail the build, so coverage gaps are visible.

Numeric enums (attribute types, stacking types, buff events, formula slots)
are decoded through **one version-pinned enum map**, each entry verified
against a known effect. Starting points: End-DPScope's
`research/附录A 全属性列表.md` (attribute IDs) and the game's English text
table.

## Engine

### Input: Scenario

```ts
Scenario {
  team: Loadout[]          // 1–4 operators
  enemy: { id, level, count?: 1 }
  duration: Frames
  rotation: Rotation
  options: { crit: "expected" | "never" | "always" | { seed }, rounding: … }
}
Loadout {
  operator: CharId, level, promotion, potential,
  skillLevels: { basic, battle, combo, ultimate },   // 1–12
  weapon: { id, level, refinement }, gear: GearPiece[]
}
```

### Rotation

All three reference simulators take absolute timestamps and, when an action
is illegal (not enough SP, cooldown not ready, combo window closed), run it
anyway with a warning. That breaks search: changing one operator invalidates
every timestamp. So rotations are **programs** the engine schedules:

1. **Action list (MVP):** an ordered list of actions per operator
   (`{ operator, action, after?, at? }`; actions are basic chain segments,
   battle skill, combo, ultimate, swap). The engine runs each at the
   **earliest legal frame** given SP, energy, cooldowns, combo windows and
   animation lock. An explicit `at` frame is allowed for reproducing
   published timelines (ZMDLogs casts, End-DPScope scenarios); if it isn't
   legal there, that's an error.
2. **Generated on the fly (later, for search):** the action list isn't
   given up front. A **battle policy** chooses each next action from the
   current state while the battle runs, and the search explores the tree of
   possible choices (see [stepping API](#stepping-api)). Simple priority
   rules ("ultimate when ready, combo when its window opens, else battle
   skill if SP ≥ cost, else basic") are just one policy.

An illegal action is always an error in the result, never silently run or
skipped.

### Stepping API

The engine's core is a **state machine**, not only a `simulate()` call, so
the same code serves recorded rotations and interactive search:

```ts
init(bundle, scenario) → State
advance(state) → { state, decision? }   // run until the next decision point or the end
legalActions(state) → Action[]          // what can be done now, with earliest frames
apply(state, action) → State            // or an error if illegal
fork(state) → State                     // cheap copy for branching
evaluate(state) → partial Result        // damage so far, resources, timings
```

- A **decision point** is a frame where some operator can act: an
  animation lock or cancel window ends, a combo window opens, SP or energy
  becomes enough, a cooldown ends. Between decision points the engine runs
  events only.
- **Recorded rotations** are a driver that feeds the action list into
  `apply` at each decision point. `simulate(bundle, scenario)` is that
  driver, run to the end.
- **Search** is a driver too: at each decision point it asks a policy or
  evaluator for candidate actions, `fork`s the state per candidate, and
  explores the tree (beam search, Monte Carlo tree search, or similar;
  *open*). The evaluator scores partial states, e.g. damage so far plus an
  estimate of what the resources and buffs on hand are worth.
- This is why state must be **plain data** with cheap `fork`, and why
  `legalActions` must be fast and exact: search calls them at every node.
- The Rust port implements the same API; drivers can stay in TypeScript at
  first, calling the Rust engine, or move over later.

### Time

Integer frames at **30 FPS**, the game's own timeline unit (verified across
all operator SkillData files; Zero Sanity's 120 and old Endaxis's 60 are
tool choices). Seconds appear only for cooldowns, buff durations and table
values, and are converted once at load with a documented rounding rule.

From day one the engine has **several clocks**: global scaled time (an
ultimate or combo can freeze or slow it, which pauses ordinary buffs and SP
regen), per-entity time, and unscaled time for cooldowns. Adding these later
would touch everything.

### Simulation model

Two stages:

1. **Build stage**, per operator and build, cached: the stat snapshot with
   its contributions, plus the list of passive and triggered effects. Search
   reuses it across rotations and teams.
2. **Event stage:** an integer-frame priority queue ordered by
   (frame, a documented tie-break order). Casts schedule hits and buff
   changes; buffs schedule expiry; triggers fire from a registry. Each hit is
   emitted with the modifiers active at that moment, and damage is a cheap
   pure function of (snapshot, active modifiers, hit). Discrete events skip
   idle frames, which keeps long fights cheap.

SP, ultimate energy, stagger and cooldowns are **live state** that gates
actions, not post-passes. (Known details to model: team SP regenerates
8/s with a 1.5 s pause after spending; refunded SP doesn't give ultimate
energy.)

State is **plain data** (flat records and arrays, no object graph), so a
simulation can be forked by copying: search can simulate a shared opening
once and branch from it.

### Damage

Follows the **game's own pipeline**, as encoded in BuffData (see
[data-sources.md](data-sources.md#3-damage-formula)), not a flat product of
named multipliers:

1. Attacker and defender sides each accumulate modifiers by zone:
   `NormalCalcZone`-type zones add within a side, `ProdCalcZone` multiplies
   within a side; the two sides multiply.
2. Pre-calculation modifiers (ATK ratio, crit rate and damage, attribute
   edits in the game's formula slots, zone additions), then raw damage
   (ATK × scale, attribute × scale, fixed value), then post-calculation
   modifiers.
3. Shared factors: DEF, RES × damage taken, weakness, protection, level
   coefficient.
4. Crit last.

Each hit keeps its full breakdown (zone values and the buffs that fed them),
so it can be compared with a ZMDLogs hit and its buff events.

**Crit modes:** `expected` (each hit × (1 + rate × crit DMG); deterministic,
for search), `never` / `always` (in-game tests), seeded sampling. *Open:*
what `expected` means for crit-triggered effects. Endaxis fires them on
every crit-capable hit (overstates them); Zero Sanity tracks expected stack
counts. Pick one and document it. Other probabilities use a named PRNG with
one seeded stream per source; never `Math.random`.

**Numerics:** game tables are float32, and the game may compute in float32.
Where that matters, emulate it explicitly (`Math.fround` ↔ `f32`) behind one
switch, decided by fixtures. Rounding steps (attribute floor, final damage)
are each one switch; see [rounding](data-sources.md#rounding). Empirical
rounding rules fitted on a couple of data points are hypotheses, not facts.

### Output: Result

```ts
Result {
  total, dps, perOperator: Record<CharId, number>,
  hits: { frame, operator, source: SkillId, target, damage, breakdown, crit }[],
  events?: … ,               // resources, buffs; only when requested
  errors: RotationError[]
}
```

Breakdowns and event traces are opt-in at run time (search only needs
totals), but always produced in tests.

**Per-operator contribution** of buffs and debuffs uses LMDI (log-mean
Divisia) attribution, as End-DPScope does: it splits each hit's damage
exactly and additively across the operators whose effects contributed.

## Fixtures and tests

- **Language-neutral fixtures** in `fixtures/` (repo root), one JSON file
  each: `scenario`, `expected` (totals, per-hit values or stats), `tolerance`,
  and `provenance` (source URL or file, date, game version, data submodule
  commits it was verified against). TypeScript tests read them now; Rust
  tests read the same files later.
- **Tolerance per fixture:** exact (or ±1 for rounding) for in-game verified
  values; looser for other simulators' outputs (they can be ~10% off for
  some operators).
- Fixture values are observations, so Zero Sanity's in-game per-hit tables
  and End-DPScope's scenario totals can be used. **Don't copy Zero Sanity's
  game-data JSON:** it's hand-curated, partly sourced from Endaxis
  (unlicensed), and we load from the submodules.
- **Unit tests** for each formula zone and each data adapter.
- **Cross-check test:** the tables the engine uses must be identical between
  the two `data/` sources.
- **Consistency tests:** the data compiler is deterministic (build twice,
  compare); a forked simulation equals one run from scratch; the same seed
  gives the same result.
- A fixture whose value changes after a data update is reviewed, never just
  re-recorded: balance change or bug.

## Code layout (proposed)

npm workspaces, one package per layer:

```
packages/data     loaders, adapters, SkillData/BuffData compiler, DataBundle, cross-check
packages/engine   simulate(); no dependencies on other packages
packages/search   (later)
packages/cli
packages/web      (later)
fixtures/         language-neutral fixtures
schemas/          JSON Schemas for DataBundle, Scenario, Result
scripts/          fetch-data.sh: sparse fetch of the tables in packages/data/tables.json
```

Tooling (set up 2026-10-18): TypeScript 5.9 (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`), Vitest, ESLint with typescript-eslint. The
packages export their TypeScript sources directly; there's no build step
yet. ESLint enforces two principles mechanically: the engine imports
nothing outside itself, and game logic can't use `Math.random` or
`Date.now`.

**Number representation:** the two data sources write the same float32
values differently (rmxlinux in full, `1.7799999713897705`; 555me as the
shortest decimal, `1.78`), and a few fields are doubles, not float32. The
loader keeps each source's values as written; the primary (rmxlinux) is
used; the cross-check treats two numbers as equal when they're identical or
the same float32 with one side exactly float32. 64-bit integers (text IDs)
are kept exact as strings.

`engine` depends on nothing but its own types, which keeps the Rust port's
surface exactly the `DataBundle`, `Scenario` and `Result` schemas.

## Lessons from the reference simulators

Details: [reference-simulators.md](reference-simulators.md).

- Don't run the engine through UI state or a process per evaluation
  (End-DPScope spawns Node per simulation; Zero Sanity's engine imports view
  types and is tested through a React hook).
- Don't re-derive combo windows or time-stops on every insertion, or rerun
  the whole pipeline after stagger (Zero Sanity).
- Don't interpret a string-keyed rule language at run time; compile
  conditions and effects to small closed enums. That also makes the Rust
  port mechanical.
- Don't step every frame through a full action-graph interpreter (current
  Endaxis): highest fidelity, but too slow for search and too big to port.

## Open questions

- Tie-break rules within a frame.
- Rounding and float32 (see [data-sources.md](data-sources.md#rounding)).
- Meaning of `expected` crit for crit-triggered effects.
- Which SkillData/BuffData action types the compiler must understand for
  the first fixtures.
- How combo trigger conditions are expressed without CharacterData.
- Search algorithm over the decision tree, and how the evaluator scores
  partial states.
