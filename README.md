# Endfield Battle Simulator

A utility for automatically evaluating team compositions and rotations in
*Arknights: Endfield* and comparing them against each other.

Status: early development. A **damage calculator** works: stat panel and
damage per hit for an operator build, verified against in-game values
(Laevatain: 10 stat panel values and 25 hits, all exact). Hit structure
("kits") exists for Laevatain so far; stats work for every operator. No
rotations or team search yet. Next steps: [`docs/roadmap.md`](docs/roadmap.md).

## Damage calculator

```sh
npm run efsim -- find laevatain                       # look up IDs by name
npm run efsim -- template chr_0016_laevat --weapon wpn_sword_0006 > my-build.json
npm run efsim -- calc examples/laevatain-forgeborn.json
npm run efsim -- calc examples/laevatain-forgeborn.json --crit never --condition wpn_sword_0006.after_ultimate
npm run efsim -- compare examples/laevatain-forgeborn.json examples/laevatain-umbral-torch.json
```

Build files follow [`schemas/build.schema.json`](schemas/build.schema.json):
operator, level, promotion, potential, skill levels, weapon (level and the
levels of its three skills) and up to four gear pieces with the artificing
level of each stat line. `calc --verbose` lists every contribution to every
stat and the damage zones of a hit.

Limits today: conditional effects (most weapon and gear set passives,
talent buffs) are only included where a kit or weapon kit defines them as a
`--condition`; susceptibility, link, finisher, weakness, protection and arts
reactions aren't modelled yet. The output says so.

## Goals

- **Simulate** a team's rotation on a timeline and score it (damage, DPS over a
  fight window, per-operator contribution).
- **Search** the space of possible team compositions under constraints given as
  input or configuration:
  - operator constraints, at minimum *must include* and *always exclude* lists
    (expected to change per search);
  - available gear, especially which weapons are owned/allowed.
- **Compare** results across teams and rotations, and browse them in a web
  interface.
- Grow to cover a wide range of scenarios (enemies, fight lengths, target
  counts) over time.

## MVP

Keep the first version simple: reproduce damage/DPS results that have already
been published on the web. Matching known numbers is how we validate the engine
before building search on top of it.

## Correctness

The tool is only useful if its numbers are right. Tests are a first-class part
of the project and must be kept up to date and passing:

- unit tests for each part of the damage formula;
- fixture tests that reproduce published or in-game verified results;
- data cross-checks between independent sources where possible.

## Technology

- **Prototype:** TypeScript (engine, search and web UI).
- **Later:** a Rust implementation of the engine once the prototype's results
  are trusted, validated against the same test fixtures.

## Data

Game data (operators, skills, weapons, gear, enemies) comes from community
extractions of the game's data tables, linked as git submodules under
[`data/`](data/README.md) so that two separately produced extractions can be
cross-checked. Existing simulators used as a starting point are linked under
[`reference/`](reference/README.md). The evaluation behind these choices is in
[`docs/data-sources.md`](docs/data-sources.md).

```sh
./scripts/fetch-data.sh       # only the tables the code reads (~60 MB, seconds)
git submodule update --init   # or everything: data and reference repos (~3.5 GB)
```

## Development

Node 22 or newer.

```sh
./scripts/fetch-data.sh
npm install
npm run check                 # typecheck, lint, all tests
```

Packages: [`packages/data`](packages/data) (reads and cross-checks the game
tables) and [`packages/engine`](packages/engine) (the simulator; no
dependencies). Design: [`docs/design.md`](docs/design.md). CI runs
`npm run check` on every push. Cloud sessions run
`.claude/hooks/session-start.sh`, which does the first two steps.
