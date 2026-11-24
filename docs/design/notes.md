# Code layout, lessons and open questions

Part of the [design](../design.md): The proposed code layout, lessons from the reference simulators, and open questions.

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
scripts/          fetch-data.ts: sparse fetch of the tables in packages/data/tables.json
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

Details: [reference-simulators.md](../reference-simulators.md).

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

- What the game does at ties within a frame (simultaneous hits of different operators, listeners to one event): the engine's order is [documented](timeline.md#order-within-a-frame), not verified.
- Rounding and float32 (see [data-sources.md](../data-sources.md#rounding)).
- Which SkillData/BuffData action types the compiler must understand for
  the first fixtures.
- How combo trigger conditions are expressed without CharacterData.
- Search algorithm over the decision tree, and how the evaluator scores
  partial states.
