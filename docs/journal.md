# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.

## 2026-10-18: arts reactions on the timeline; six kits merged

**Goal:** the timeline should trigger inflictions and reactions itself, and
the six favourites' kits (written in parallel by sub-agents, each with its
own journal notes below) should be merged with the engine changes they
asked for.

**Done:**
- `engine/src/status.ts`: one state machine for inflictions, bursts,
  reactions, forced reactions and consumption (Talos Wiki rules); Corrosion
  and Electrification act on hits as Modifiers, Combustion ticks each second.
  Kits say what each hit `applies` (the data doesn't: SpellInfliction actions
  are disabled stubs), taken from skill descriptions.
- Operator `stacks` with `gains` / `requires` (Laevatain's Melting Flame:
  her empowered battle-skill hit now lands only at 4 stacks; before, the
  timeline always counted it). Forced reactions can take duration and damage
  scale from skill values. The timeline reproduces Zero Sanity's in-game
  forced Combustion tick (2608) and empowered hit (57552) exactly.
- Final Strikes come from SkillData (mask bit 2097152) and kits can declare
  team triggers (Laevatain's Heat absorption). `triggers.ts hitEffects` is
  shared by the timeline and `efsim zmdlogs reactions`, which replays a log
  and compares predicted with logged reactions: 40d9's Combustion at 14441
  ms is predicted exactly, with no false predictions.
- Electrification's strength matches two logged rates exactly.
- Checker, from the agents' reports: logged buffs counted as BuffData says
  (stackingType 1 once, literal max stacks, decorate-mask conditions), every
  kit hit of a shared key tried, boundary buffs tried in subsets; the
  importer drops damage-taken zones on operators; skill-value condition
  sources and per-hit bonuses. Two pending fixtures now pass.

**Decisions:**
- What a hit applies takes effect before its own damage (Gilberta's and
  Arcane's logs both show it).
- Hits under Corrosion that match no level count as "under unmodelled
  effects", not mismatches: three agents found the ramp too strong in some
  logs (Si's points to ticks pausing during time dilation). Non-Corrosion
  hits stay strict.
- `buff_common_<element>_triggered` (newer logs' reaction key) is still not
  parsed as a reaction: it fits in Arcane's report only with dedupe, which
  is now in, so it can be revisited.

**Open:** e82d45c46040 stays pending (three unexplained factors). Gilberta's
d9e59 needs Liino's zero-duration buffs imported. Link isn't modelled.

## 2026-10-18: Liino's kit

**Goal:** Liino's (chr_0035_liino) hit structure, verified against logs.

**Done:** kit with the battle skill (6 projectiles × `atk_scale`, verified
12/12 in `zmdlogs-0eef2474a26f` and the new `zmdlogs-bdf223db8e49`; the
follow-up volley 6 × `atk_scale_2`) and the combo (`atk_scale` at frame 9,
`atk_scale_2` at frame 33). The kit-coverage test now takes known gaps per
operator.

**Decisions:** the follow-up volley and the combo keep empty `events`: all
their logged hits but six are under Corrosion, which the engine's model
doesn't reproduce (see in-game test 4), and a covered mismatch would fail
the log test. Ultimate and basic attacks are left out (reasons in the
kit's sources).

**Problems:** two imports were wasted: `btl_upload_5d51a64dd089`'s enemy
(`eny_0090_wgabyss_hdg011`) isn't in the tables, and level inference fails
on stages with scaled HP. Liino's ultimate is only in a parser-v58 log that
misses her own buffs; in-game test 6 asks for a clean one.
## 2026-10-18: Arcane's kit

**Goal:** hit structure for Arcane (chr_0032_lizhiyan), verified against
ZMDLogs.

**Done:** kit `packages/data/kits/operators/chr_0032_lizhiyan.json` (basic
attacks, plunge, battle skill, combo skill and its "seal" buffs, both
ultimates); two Rhodagn logs imported to `fixtures/pending/` (not under the
log test yet, see problems).

**Findings:**
- Every damage unit, the seals included, is plain ATK × a combo-skill key
  passed by assignBlackboard: seal_total = atk_scale_touch, seal2 / seal
  listeners = atk_scale_boom, seal_finisher_wisd = 4 × atk_scale_laser1 +
  atk_scale_laser2. Nothing scales on Intellect directly; the mode (Intellect
  ≥ Will → INT) picks branches and Susceptibility amounts.
- Log buffs with stackingType 1 ("cannot stack", e.g. Solemn Phalanx's
  will_dmg / will_atk) appear once per refresh in ZMDLogs; counting each
  buff ID once makes all 13 Arcane hits of btl_upload_b7b3762d5da8 and 4 of 5
  of btl_upload_e82d45c46040 match ±1. The checker sums them today, so both
  logs fail; parked in `fixtures/pending/`.
- `buff_common_natural_triggered` is the Corrosion reaction's damage
  (0eef: 2 stacks, 18904 exact); its stacks equal the Corrosion level the
  same hit's battle skill then gets (level 2, also exact).
- Arcane's ultimate (INT) forces Corrosion level 1 (`count` 1, duration
  `duration2`); talent 2 hooks every Corrosion she applies: +duration_add s
  and max reduction × (1 + corrupt_rate).

**Problems:**
- `fixtures/zmdlogs-d9e59d0fb737.json` (2026-10-15 01:55 +08:00, parser v58,
  before 555me's 1.6 commit 371c743) is 1.7–2.2× the model for every Arcane,
  Gilberta and Typhoeus hit after Arcane's ultimate. Within it the INT hits
  agree with each other (same ×1.9617 residual), so the structure holds, but
  its event keys can't be in the kit without failing the log test. Likely
  game 1.5; needs a 1.6 INT log or in-game test 7.
- The kit can't pick a hit by Intellect ≥ Will, and one event key maps to
  one hit, so INT variants and the final INT laser carry no event keys.

## 2026-10-18: damage calculator

**Goal:** something usable: the stat panel and damage per hit of a build,
verified in game.

**Done:**
- Loaders and cross-checks for growth, potentials, weapons, weapon level
  curves, gear, gear sets, enemies and attribute defaults (all agree between
  the sources); English names; blackboard defaults and permanent stat
  effects (`cardAttributeModifier`) from skill files.
- Engine: attribute enum map, stat aggregation with contributions, damage
  zones, crit modes, conditions. Hand-written kits (hit structure only,
  schema-checked, keys cross-checked against SkillData) for Laevatain and
  Forgeborn Scathe's conditional buff.
- Fixture format (JSON Schemas) and the Zero Sanity Laevatain fixture: 10
  stat panel values and 25 hits, **all exact** from game 1.6 tables.
- `efsim` CLI: find, template, calc, compare. 105 tests.

**Findings / decisions:**
- Formula slots: 5 add, 6 percent, 7 flat, 8 multiply; final =
  ((base + add) × (1 + percent) + flat) × multiply. 5 and 6 verified in
  game; 7 and 8 from data patterns. Slot 0 appears once and is refused.
- ATK bonus uses whole attributes (settled); final damage rounds to nearest
  (settled). Laevatain's level table now runs to 99.
- Potentials change skill values by add / multiply / set; which hits a
  value like `ratio` multiplies is in SkillData's action graph, so kits
  encode it, verified by fixtures (P1's ratio applies to the enhanced
  battle skill, not the normal one).
- Skill levels follow CharGrowthTable's skill groups (enhanced basic
  attacks use the ultimate's level but the basic attack damage bonus).
- Some tables store doubles (potentials 0.15), others float32; values are
  kept as written.
- Code must be erasable TypeScript (`erasableSyntaxOnly`) so Node 22 runs
  it directly; no build step.

**Problems:**
- Projectile and ability-entity hits link to their parent skill only by
  file name; rmxlinux has no ProjectileData.
- Conditional effects aren't modelled generically yet, so weapon
  comparisons understate weapons whose strength is conditional; `compare`
  lists them.

## 2026-10-18: TypeScript project foundation

**Goal:** start roadmap step 3, the code base everything else builds on.

**Done:** npm workspaces (`packages/data`, `packages/engine`), TypeScript
5.9 strict, Vitest 5, ESLint 10 with rules enforcing engine independence
and no `Math.random` / `Date.now`; GitHub Actions CI; cloud session start
hook; `scripts/fetch-data.sh` (sparse fetch of only the listed tables at
the pinned commits: 4.5 s and 63 MB instead of minutes and 3.5 GB). Data
loader with strict, source-aware field readers, exact int64 parsing, and
normalisers for BattleConst, SkillPatchTable and CharacterTable;
cross-check of all three between rmxlinux and 555me passes; spot checks
against values verified on the web. Engine has only unit types so far
(frames at 30 FPS, seconds, ratios). 22 tests plus the extension's.

**Decisions:**
- The account importer waits until the system is verified and finds
  useful new rotations (owner).
- Number equality across sources: identical, or the same float32 with one
  side exactly float32 (555me prints shortest decimals, rmxlinux full
  float32; some fields are doubles).
- Packages export TypeScript sources directly; no build step until needed.
- TypeScript stays 5.9: typescript-eslint doesn't support 6.1+ yet.

**Problems:**
- Liino's `chr_0035_liino_normal_skill_combo` repeats the blackboard key
  `music_trigger` with the same value at every level; same-value repeats
  are accepted, conflicting ones fail.
- Vitest 3 pulled in tinypool with critical advisories; upgraded to 5.
- Root `"type": "module"` broke the extension's CommonJS tests; the
  extension folder has its own `package.json`.

## 2026-10-18: account data capture

- No official API for player data. SKPORT's unofficial API exposes roster,
  builds (artificing per gear substat) and inventory, but needs the login
  token; Gryphline warns against third-party logins. Findings:
  [player-data.md](player-data.md).
- Owner's idea, built: a Brave/Chrome extension
  ([tools/skport-capture](../tools/skport-capture/README.md)) that passively
  copies what SKPORT's own pages load and saves it to a file. No requests
  of its own, no headers or tokens. Unit tests plus an end-to-end test in
  Chromium against a fake SKPORT.
- Problem found: Chrome injects a content-script file only once per page,
  even across worlds, so the isolated relay can't share `core.js` with the
  page hook; validation moved to the background worker.
- Not yet tested against the real SKPORT pages; the owner's first capture
  will show which endpoints the pages actually call.

## 2026-10-18: design review with the owner

- Owner approved scheduled action lists for recorded rotations, and wants
  later an interactive system: battle simulation and a policy evaluator
  side by side, generating the action list on the fly and searching the
  tree of choices. Design now has a **stepping API** (init / advance to
  decision point / legal actions / apply / fork) with recorded rotations
  and search as drivers on top.
- Owner plays daily and may run simple in-game tests; started
  [in-game-tests.md](in-game-tests.md).
- Talos Wiki API: lookups as needed are fine, no scripted mass downloads;
  ask before any unavoidable mass download (now in CLAUDE.md).

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
