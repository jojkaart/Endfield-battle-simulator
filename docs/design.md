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

`Timeline` and `Buff` are the hard part: the raw SkillData/BuffData are C#
action graphs. The data layer translates the subset that matters for damage
(hit frames, multipliers via blackboard keys, buff applications, resource
changes) into a small, explicit set of engine event types. Unknown node
types are reported, not silently ignored, so coverage gaps are visible.
(*Open*: which node types matter; see the architecture notes.)

## Engine

### Input: Scenario

```ts
Scenario {
  team: Loadout[]          // 1–4 operators
  enemy: { id, level, count?: 1 }
  duration: Ticks
  rotation: Rotation
  options: { crit: "expected" | "never" | "always" | { seed } }
}
Loadout {
  operator: CharId, level, promotion, potential,
  skillLevels: { basic, battle, combo, ultimate },   // 1–12
  weapon: { id, level, refinement }, gear: GearPiece[]
}
```

### Rotation

Two forms, the first needed for the MVP:

1. **Explicit timeline:** an ordered list of actions, each
   `{ operator, action, at? }` where `action` is a basic-attack chain,
   battle skill, combo, ultimate, swap…, and `at` is a time or "as soon as
   possible after the previous action". This is enough to reproduce
   published rotations (End-DPScope scenarios, ZMDLogs cast timelines).
2. **Policy (later, for search):** a priority list ("ultimate when ready,
   combo when its window opens, else battle skill if SP ≥ cost, else basic")
   that the engine expands into an explicit timeline. Search varies
   policies, not hand-written timelines.

The engine **checks** every action: not enough SP or energy, cooldown not
ready, combo window closed. An invalid action is an error in the result, not
a silent skip, so a reproduced rotation can't quietly differ from the
original.

### Time

Integer ticks, never floating-point seconds, so event ordering is exact.
The tick is the game's timeline frame (`_startFrame` / `_endFrame` in
SkillData). *Open:* its rate (30 or 60 FPS); durations given in seconds are
converted to ticks with a documented rounding rule.

### Simulation model

Discrete-event: a priority queue of events ordered by (tick, a fixed
tie-break order). Skill casts schedule their hits and buff changes; buffs
schedule their expiry. Ties are resolved by a documented rule (e.g. buff
expiry before hits in the same tick), *open* until checked against the
reference simulators or logs. Discrete events skip idle time, which keeps
long fights cheap for search.

State per operator: stats, SP (team), ultimate energy, cooldowns, active
buffs. State per enemy: HP, stagger, infliction stacks, statuses, debuffs.

### Damage

One module computes a hit from the current state as a product of
**multiplier zones**, matching the formula in
[data-sources.md](data-sources.md#3-damage-formula). Each hit's zones are
kept in the result, so a hit can be compared zone by zone with ZMDLogs, which
logs the same zones.

Crit: `expected` multiplies by `1 + rate × critDmg` (deterministic, for
search); `never` / `always` for matching in-game tests; seeded rolls only if
needed.

### Output: Result

```ts
Result {
  total, dps, perOperator: Record<CharId, number>,
  hits: { tick, operator, source: SkillId, target, damage, zones, crit }[],
  events?: … ,               // resources, buffs; only when requested
  errors: RotationError[]
}
```

The per-hit list is optional at runtime (search only needs totals), but
always produced in tests.

## Fixtures and tests

- **Language-neutral fixtures** in `fixtures/` (repo root), one JSON file
  each: `scenario`, `expected` (totals, per-hit values or stats), `tolerance`,
  and `provenance` (source URL or file, date, game version, data submodule
  commits it was verified against). TypeScript tests read them now; Rust
  tests read the same files later.
- **Tolerance per fixture:** exact (or ±1 for rounding) for in-game verified
  values; looser for other simulators' outputs.
- **Unit tests** for each formula zone and each data adapter.
- **Cross-check test:** the tables the engine uses must be identical between
  the two `data/` sources.
- A fixture whose value changes after a data update is reviewed, never just
  re-recorded: balance change or bug.

## Code layout (proposed)

npm workspaces, one package per layer:

```
packages/data     loaders, adapters, DataBundle builder, cross-check
packages/engine   simulate(); no dependencies on other packages
packages/search   (later)
packages/cli
packages/web      (later)
fixtures/         language-neutral fixtures
```

`engine` depends on nothing but its own types, which keeps the Rust port's
surface exactly the `DataBundle`, `Scenario` and `Result` schemas.

## Open questions

- Frame rate and tie-break rules (timeline).
- Rounding rules (damage, stats).
- Breach, Corrosion vs Arts Intensity, stagger grouping (formula).
- Which SkillData/BuffData node types the engine must understand.
- Whether the explicit-timeline rotation format can express ZMDLogs cast
  timelines directly.
