# CLAUDE.md

Project overview and goals: [README.md](README.md).

## Branches

Until the first genuinely useful version exists:

- `main` is the working branch. Merge finished work into `main` and push it
  without asking or waiting for approval.
- Other branches are only for running several sub-agents in parallel on
  different parts of the system; merge them back into `main` when done.

After that milestone, a `dev` branch takes over the role `main` has now.

## Correctness

The tool is only useful if its numbers are right. Keep tests up to date and
passing with every change.

## Data and reference code

- Game data comes from the submodules under `data/`; see
  [data/README.md](data/README.md). Don't copy their data into this repo.
- Existing simulators under `reference/` are a starting point; see
  [reference/README.md](reference/README.md) for what each licence allows.
  `reference/Endaxis` has no licence: read it and compare outputs, but never
  copy its code.
