# Endfield Battle Simulator

A utility for automatically evaluating team compositions and rotations in
*Arknights: Endfield* and comparing them against each other.

Status: planning. No code yet.

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

Game data (operators, skills, weapons, gear, enemies) will come from external
sources, ideally more than one so they can be cross-checked against each other.
Candidate sources are being evaluated in [`docs/data-sources.md`](docs/data-sources.md).
