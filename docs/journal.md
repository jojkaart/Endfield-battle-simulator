# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.

## 2026-10-18: project setup and data-source research

**Goal:** turn the empty repo into a plan and choose data sources.

**Requirements gathered from the owner** (now in [README](../README.md)):
- Search team compositions under constraints: must-include / always-exclude
  operator lists (often changed per search), available gear and especially
  weapons.
- MVP: keep it simple, reproduce results published on the web.
- Web interface for browsing results; the owner will usually ask Claude to run
  simulations.
- TypeScript prototype, Rust implementation later.
- Correctness is essential; tests must stay up to date and passing.
- Data from multiple sources so they can be cross-checked.

**Done:**
- Researched raw data repos, wikis/databases, and existing simulators with
  three parallel sub-agents; wrote up [data-sources.md](data-sources.md).
- Linked data repos and reference simulators as git submodules
  ([data/](../data/README.md), [reference/](../reference/README.md)).
- Added [CLAUDE.md](../CLAUDE.md) and [roadmap.md](roadmap.md).

**Decisions:**
- Primary data rmxlinux/EndfieldData, cross-check 555me/beyondGameData. The
  two were compared value by value and are identical, but both decode the same
  game files, so in-game numbers are still needed to validate the formula.
- Submodules rather than copying data: no republishing, but local clones keep
  full copies. The owner sees no problem using data others have published.
- Existing simulators are a starting point. Endaxis has no licence: read and
  compare only, never copy its code.
- Using ZMDLogs' published logs through its public API is fine.
- Branches: until the first useful version, work goes straight to `main`
  without asking; other branches only for parallel sub-agents. Afterwards a
  `dev` branch takes `main`'s role.

**Problems / dead ends:**
- The environment's network policy blocked every website except GitHub, so
  wiki, tool and licence findings came from search extracts and are marked
  *(unverified)*. The owner set up a new environment with those hosts allowed;
  the next session should verify them.
- `rmxlinux-EndfieldData` is ~2.3 GB checked out and takes ~1.5 min to fetch;
  it's marked `shallow` in `.gitmodules`. Submodules may not be initialised
  automatically in a new cloud session (`git submodule update --init`).

**Next:** see [roadmap.md](roadmap.md).
