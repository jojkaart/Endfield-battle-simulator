# CLAUDE.md

Project overview and goals: [README.md](README.md).

## Branches

Until the first genuinely useful version exists:

- `main` is the working branch. Merge finished work into `main` and push it
  without asking or waiting for approval.
- Other branches are only for running several sub-agents in parallel on
  different parts of the system; merge them back into `main` when done.

After that milestone, a `dev` branch takes over the role `main` has now.

## Journal and roadmap

- Read [docs/journal.md](docs/journal.md) and [docs/roadmap.md](docs/roadmap.md)
  at the start of a session.
- Before a session ends (or after a significant milestone), add a short entry
  at the top of the journal: goal, what was done, decisions and why, dead ends
  or problems, and update the roadmap's next steps.

## Correctness

The tool is only useful if its numbers are right. Keep tests up to date and
passing with every change. Follow the architectural principles in
[docs/design.md](docs/design.md#architectural-principles).

## Data and reference code

- Game data comes from the submodules under `data/`; see
  [data/README.md](data/README.md). Don't copy their data into this repo.
- Existing simulators under `reference/` are a starting point; see
  [reference/README.md](reference/README.md) for what each licence allows.
  `reference/Endaxis` has no licence: read it and compare outputs, but never
  copy its code.
- Web sources: follow the terms summarised in
  [docs/data-sources.md](docs/data-sources.md#licences-and-terms-in-short).
  Lookups are fine (including the Talos Wiki API); no scripted mass
  downloads or anything that puts undue load on a site. Use a descriptive
  user agent. Track hosts in [docs/network-allowlist.md](docs/network-allowlist.md).
