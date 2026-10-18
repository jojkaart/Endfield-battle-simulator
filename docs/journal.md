# Journal

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first. Keep entries short; details belong in the docs they produced.

## 2026-10-18: batch 1 — pass-2 gaps implemented

**Goal:** implement the gaps the seven pass-2 re-analyses left
([batch-1.md](kit-batches/batch-1.md#pass-2-remaining-gaps-merged-2026-10-18)).

**Done:** Link for every team; layers per recipient, per-subject
cooldowns, a fight-start event; trigger filters (skills, decorations,
finisher, the causing hit's kind, buff categories, heal kinds,
reaction hits, once per cast); before-damage status triggers; branches
for alternative hits; `scaleValue`, cooldown fractions, values of
unlearned talents as 0, `talentAtLeast`, `{talent, key}`; what ends with
a cast (delayed actions, `endsWithCast` buffs, `cancelHits`,
`endAction`); `cantCastSkill` channels; no dive attacks without jumps;
the time a buff had left and what a recording buff recorded; Fixed DMG
(Si's Artful Intent, unique); control-immune targets; event counts in
the log checker; kit buffs in fixtures and `calc --buff`. In-game tests
20–50 collected from the reports. Then a pass-3 re-analysis of the seven.

**Decisions and why:**
- Before-damage status triggers are opt-in (`beforeDamage`), not the
  default: the data orders actions per skill, and no current trigger
  needs the other order.
- Delayed cast-trigger actions belong to their cast (dropped when it's cut
  short) unless `detached`: SkillData timeline actions stop with their
  skill.
- A cooldown fraction is of the full cooldown, and ultimates don't get
  through `cantCastSkill` channels: assumptions, with in-game tests 36
  and 15.
- What can't be settled without the game (jumps, hit-stop, the WILL
  combo's element, …) is listed with its interim rule in
  [batch-1.md](kit-batches/batch-1.md#pass-2-whats-still-open) rather than
  guessed in code.

**Problems:** none that moved numbers: every change kept the example
totals and log verdicts identical until a kit uses it (checked against
the previous commit each time).

## 2026-10-18: batch 1 — values, skills, arts, physical state, time

**Goal:** the rest of batch 1's shared features, per family.

**Done:** values and resources (event counts, starting stacks, SP on hits,
energy-grant options, team energy at its data frame); skills (hitless
skills via delayed cast triggers, availability Predicates, cooldown groups,
control-taking casts, follow-up casts, energy-blocking buffs); when the
next action may start, from SkillData windows, `skillSpecification`
priorities and exclusive time, with interrupts cancelling hits still to
land and basic-attack chain steps from the data; stack requirements as
ranges with partial use; arts-state extensions (enemy-element infliction,
partial absorption, burst events, applier status tweaks, status
consumption); the log checker's skill-set stack caps; physical state
(Vulnerable, Lift, Knock Down, Crush, Breach, Shatter) and stagger with
finishers; control statuses that freeze the enemy's clock; ultimate time
stops and global slow-downs; haste.

**Decisions and why:**
- Research by sub-agents on Endaxis (read, not copied) for the skill-gate,
  time and physical rules; claims checked against our data and logs
  before use. Endaxis's "no windows, anything goes" is its own admitted
  bypass, so the engine doesn't follow it; its ignoring of
  `cantSwitchPosition` isn't followed either (the data is explicit).
- A recorded action without a time waits for the current skill's own
  hits; only an explicit time interrupts. Otherwise every priority
  interrupt would cut skills short in hand-written rotations.
- Slow-downs shift everything after their start by the frames they cost:
  exact for stops, simple, and keeps state plain.
- Haste and the time stop's effect on cooldowns are assumptions with
  in-game tests (18, 19); 15–17 check the skill gate.

**Problems:** the Laevatain example overran Twilight once enhanced attacks
waited for the data's exclusive time, until her kit got the Twilight
pause (report gap 2); Liino's example had a chain step the chain no longer
allows. One commit went out with a type error in a test (fixed in the
next).

**Results:** example totals moved only where timing changed (−1.6% to
+2.9%); log checks gained Estella's and Gilberta's physical-status hits
(coverage 52% → 83% and 67% → 79%) with no mismatches.

**Next:** merge the SkillData compiler (D1, in progress in a worktree),
use it for loader defaults, re-analyse the seven, write the kits.

## 2026-10-18: batch 1 — analysis, then triggers, conditions and buffs

**Goal:** the owner's kit process ([kit-process.md](kit-process.md)): analyse
all seven batch-1 operators first, then implement the missing features per
family, not per operator. Owner: implement every gap (nothing deferred);
any equipment on any operator; P5 default for 4- and 5-stars in batch 2.

**Done:**
- Analysis: seven gap reports and the merged table
  ([kit-batches/batch-1.md](kit-batches/batch-1.md)), whose "Progress"
  section lists what's implemented.
- Values from talent, potential, weapon and gear-set skills (V1) and
  mode-limited talent effects (C3).
- One event model (engine `events.ts`): hits, casts, status events, buffs
  applied / ended / ticking, stacks, heals. One `triggers` list per kit
  replaces `comboTriggers` and `teamTriggers` (combo windows are an
  `openCombo` action); actions apply, gain, energy, SP, buffs (apply,
  extend, end layers), cooldowns, heals and hits. Triggered hits name
  their damage type (`none` exists).
- Equipment kits (`kits/equipment/<id>.json`) for weapons and gear sets act
  for the wearer through `effectiveKit`.
- Predicates for who is controlled, enemy debuffs from anyone, element,
  profession, team-buff recipients and the event's operator; an `if` on
  every effect.
- Buffs: layers, next-cast consumption (Link), attribute modifiers (UGE),
  recipient filters, stacking keys, open-ended and 0 s buffs, ticks.

**Decisions and why:**
- Patterns, not fields: ending a buff on a skill or with its parent, or
  starting one when another ends, are triggers (`on: cast` / `buffEnded`),
  not new buff fields; pausing a buff is `extendBuff` by the pause.
- Equipment IDs are prefixed (`<equipment>.<id>`) instead of rewritten by
  the loader: unambiguous, and predicates need no renaming.
- A hit's `controlled` predicate uses who was controlled at its cast
  (Typhoeus's report), not at landing.

**Problems found:** operator elements came from the data capitalised
("Fire"), so `teamSlotElement` could never match; fixed. Every step was
checked against the session's starting commit: example totals, log-check
and reaction-replay verdicts on all fixtures are identical.

**Next:** values and resources (V2–V5), data compilation (D1), skills
(S1–S7), arts state (A1–A5), physical state and timing, log tooling; then
re-analysis of the seven and the kits.

## 2026-10-18: energy, combos, buffs, rotation search; kit abstractions

**Goal:** make the timeline able to play a real rotation for the
favourites, then (owner's request) review what the kits share before adding
operators.

**Done:**
- Timeline: timed kit buffs (self / team / enemy, values from skill data,
  limited by hit kind), ultimate energy (cost after potentials, 0.065 per
  natural SP to the team, kit grants, Ultimate Gain Efficiency, blocks),
  combo windows (6 s, kit triggers), skill states (`availableWhile`),
  action kinds separate from level groups, swaps that wait. Research by a
  sub-agent across the data and both reference simulators.
- `efsim search`: beam search on the stepping API, deduplicating equivalent
  states; found rotations replay exactly with `simulate` and beat the
  hand-written example.
- Second kit round for all six favourites (inflictions, buffs, combo
  triggers, energy, event keys); every example scenario runs.
- Review: `docs/kit-abstractions.md` (what kits hand-write that the data
  has; requests grouped into five families; what in the parallel
  per-operator approach caused one-off fields). Owner's rule: repeat it for
  every new kit (`efsim kit-census`, CLAUDE.md).
- Step 1 of the review: one `Predicate` and one `ValueExpr` (engine
  `expr.ts`) replace hit `when` → `if`, `scaleIf` → `extraScale`,
  `ValueSpec` → `ValueExpr`, combo triggers' `when` / `whileBuff` → `if`.
  Behaviour unchanged (all examples and log matches identical). That
  commit's message lost these field names to shell backtick expansion;
  this entry is the record.

**Decisions and why:**
- BuffData stackingType 1 is "only the strongest counts"; a priority key
  alone isn't (two `vulnerable_crystal` instances add up in b7b3). One
  agent's opposite claim was checked against a log before it was used.
- Worktrees resolved the main checkout's packages, so some agent checks ran
  the wrong kits: `scripts/setup-worktree.sh`, and CLAUDE.md says to use it.

**Open:** steps 2–5 of the review (one trigger list, buff lifecycle,
kit-draft v2 compiling frames / energy / factors / buffs from the data,
arts-state extensions); a resource-aware search evaluator.

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
