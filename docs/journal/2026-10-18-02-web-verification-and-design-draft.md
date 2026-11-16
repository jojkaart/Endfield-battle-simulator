## 2026-10-18: web verification and design draft

**Goal:** with web access, verify the research, then draft the design.

**Done:**
- Tested reachability of every host in the docs; the owner edited the
  allowlist accordingly. Record: [network-allowlist.md](../network-allowlist.md)
  (purpose and usefulness per host, removal candidates).
- Four parallel sub-agents: licences/terms, data access (APIs), formula
  questions, reference-simulator architecture. Results merged into
  [data-sources.md](../data-sources.md), [design.md](../design.md) (with
  architectural principles), [game-data-format.md](../game-data-format.md),
  [reference-simulators.md](../reference-simulators.md) and a new
  [glossary.md](../glossary.md).
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
