# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.

## 2026-10-18: web verification and design draft

**Goal:** with web access, verify the research, then draft the design.

**Done:**
- Tested reachability of every host in the docs; the owner edited the
  allowlist accordingly. Record: [network-allowlist.md](network-allowlist.md)
  (purpose and usefulness per host, removal candidates).
- Four parallel sub-agents: licences/terms, data access (APIs), formula
  questions, reference-simulator architecture. Results merged into
  [data-sources.md](data-sources.md), [design.md](design.md) (with
  architectural principles), [game-data-format.md](game-data-format.md),
  [reference-simulators.md](reference-simulators.md) and a new
  [glossary.md](glossary.md).
- Key findings: the game's BuffData encodes damage modifier zones
  (additive `NormalCalcZone` vs multiplicative `ProdCalcZone`, attacker and
  defender side), which settles Breach (damage taken, not negative DEF) and
  stagger grouping; Corrosion/Breach/Electrification scale with a separate
  Arts Intensity curve; timelines are 30 FPS; SkillData's own blackboard and
  costs are defaults (overlay SkillPatchTable); ZMDLogs' per-hit data is in
  `/api/battles/{id}`, not `/export`; first fixture battle chosen.

**Decisions:**
- Rotations are programs scheduled at the earliest legal frame, not
  absolute timestamps; illegal actions are errors (all reference simulators
  only warn, which breaks search).
- Two-stage engine: cached build stage, then an integer-frame event queue;
  several clocks from day one (time-stop).
- SkillData/BuffData are compiled offline into summaries plus a small,
  tested, hand-written behaviour layer per operator; unknown types fail.
- Don't copy Zero Sanity's game-data JSON (partly sourced from Endaxis).

**Problems / dead ends:**
- Sub-agents can't write report files to the scratchpad; they return text.
- Talos Wiki: robots.txt disallows `/api.php` for automated agents. Two
  agents had sent ~60 targeted requests (≥1 s apart) before this was noticed;
  the owner then decided API lookups are fine as long as they cause no undue
  load: no scripted mass downloads. `Mozilla/5.0` user agent is blocked there; use a descriptive one.
- BWIKI rate-limits after a few requests; Huiji, Icy Veins, NGA block
  automated requests; end.wiki's domain no longer exists.
- In this session `555me-beyondGameData` was cloned with `--depth 1` (its
  history isn't needed yet); `fetch --unshallow` before per-patch work.

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
