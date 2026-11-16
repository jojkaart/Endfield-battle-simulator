# Design

Status: **draft** (2026-10-18). Sections marked *open* wait on the formula
research or the first fixtures. Game terms: [glossary.md](glossary.md).

## Goals that shape the design

- **Correct numbers first.** Every number the engine produces must be
  traceable: which data, which formula step, which rule.
- **Fast enough to search.** Team search evaluates many scenarios, so one
  simulation must be cheap and must not do I/O or parse tables.
- **Portable engine.** The engine will be rewritten in Rust and validated
  against the same fixtures. Its inputs and outputs are therefore plain,
  serialisable data, and nothing else crosses its boundary.
- **Deterministic.** Same input, same output, bit for bit. Randomness (crit
  rolls) only through an explicit seed.

## Architectural principles

These hold for all code, in TypeScript now and in Rust later. A change that
breaks one needs a recorded reason (in this document or the journal).

**Structure**
1. **Pure core, I/O at the edges.** The engine and every formula function are
   pure: no file, network, clock or global state. Loading, caching and
   display live in the outer layers. Anything pure can be tested with plain
   inputs.
2. **Data in, data out.** Layers talk only through serialisable data
   (`DataBundle`, `Scenario`, `Result`), described by versioned JSON Schemas.
   Inputs are validated against the schema at each boundary. The schemas are
   the contract the Rust engine must meet.
3. **Separately testable subsystems.** Stat aggregation, resources (SP,
   energy, cooldowns), buffs, reactions and damage are each callable on
   their own with explicit inputs, so they can be tested without a whole
   timeline.
4. **No dependencies in the engine.** It imports nothing outside its own
   package, which keeps it small and easy to port.

**Correctness**
5. **One place per rule.** Each formula zone, stacking rule or constant is
   implemented once, named after the game concept, and cites the source it
   was verified against (wiki page, fixture, table). No copies of a rule
   elsewhere.
6. **No magic numbers.** Game constants come from the tables (`BattleConst`
   and others). Values not found in any table go in one constants module,
   each with its source and a note that it isn't table-backed.
7. **Fail loudly.** Unknown IDs, unmapped attribute types, unsupported
   SkillData/BuffData nodes and illegal rotation actions are errors, never
   defaults or silent skips. A supported subset that's explicit beats a
   guess.
8. **Explicit units in types.** Branded types for ticks, seconds, IDs
   (`CharId`, `SkillId`) and ratios. Percentages are stored as ratios
   (`0.2`, not `20`) and converted only in the data adapters and the UI.
9. **Deterministic.** No `Math.random`, no `Date`, no dependence on object
   key or hash order; events have a defined total order; random crits only
   from a seeded generator passed in.
10. **Explainable results.** Every hit carries its multiplier-zone breakdown
    and every stat its contributions (base, weapon, gear, buffs), so a wrong
    number can be traced to one step and compared with an in-game stat panel
    or a ZMDLogs hit.

**Testing**
11. **Every expected value has provenance.** Fixtures record where each value
    came from and which game version and data commits it was checked
    against. An expected value is never changed just to make a test pass; the
    reason (balance change, bug fix, better source) goes in the commit and
    the journal.
12. **Test at every level:** unit tests per zone and adapter; property tests
    for invariants (more ATK never lowers damage, the DEF curve is continuous
    at 0, totals equal the sum of hits); fixture tests against in-game
    values; cross-source table checks; differential checks against the
    reference simulators with a loose tolerance.
13. **Bugs become tests.** A fixed wrong number gets a test that would have
    caught it.
14. **Green before merge.** Lint, typecheck and all tests pass locally and in
    CI before anything reaches `main`. A failing test is fixed, not skipped.
15. **Effects share primitives.** Everything that changes damage (stat
    panel attributes, kit and equipment buffs, battle-log buffs, timeline
    buffs) becomes the same `Modifier` (zone, value, element / skill-type /
    staggered filters, source), summed by one function per zone
    (`packages/engine/src/effects.ts`). Similar effects in the game are data
    for these primitives, never their own code; no operator- or
    weapon-specific branches in the engine.

## Layers

```
 data/ submodules ──► [data]  ──► DataBundle (JSON)
                                      │
 Scenario (JSON) ─────────────────────┼──► [engine] ──► Result (JSON)
        ▲                             │        ▲
        │                             │        │
     [search] ───── generates many scenarios ──┘
        │
     [cli] / [web]  read and display Results
```

| Layer | Does | Doesn't |
|---|---|---|
| **data** | Reads raw tables from the `data/` submodules, adapts each source's quirks (int64 IDs, string-encoded numbers, i18n), normalises them into a `DataBundle`; cross-checks sources. | Any game logic beyond renaming and joining. |
| **engine** | Pure function `simulate(bundle, scenario) → result`: stat aggregation, timeline, resources, buffs, reactions, damage. | I/O, table parsing, search, display. |
| **search** | Builds scenarios from constraints (must-include, exclude, owned weapons and gear), calls the engine, ranks results. | Damage logic. |
| **cli / web** | Run scenarios and searches, store and show results. | Damage logic. |

Only the engine is ported to Rust. The TypeScript data layer can keep
producing the same `DataBundle` JSON for it.

## Data layer

- **Source of truth:** the raw tables in the `data/` submodules, read at
  build time. The `DataBundle` is generated, never committed (we don't
  republish data).
- **Compiled-data cache:** building the GameData takes ~10 s, so
  `loadGameData` keeps a v8-serialised copy in the main checkout's
  `node_modules/.cache/efsim` (git-ignored, shared by its worktrees; packages/data
  `cache.ts`). Its key hashes everything the build reads: the sources' commits
  and table file stats, the kits, schemas, `tables.json`, the data package's
  sources and the engine modules they run (traced from their imports), the V8
  version and a format number. A hit is the build's exact result (a test
  compares it with a fresh build); any read error rebuilds.
  `EFSIM_NO_CACHE=1` turns it off, `efsim cache clear` empties it.
- **Worktrees:** in a git worktree whose `data/` submodules are empty, the
  loader reads the main checkout's `data/` (`EFSIM_DATA_DIR` overrides).
- **Adapters per source:** `rmxlinux` and `555me` differ in format (inline vs
  table i18n, numbers as strings in 555me). Each has an adapter producing the
  same normalised records, which makes the cross-check a plain comparison.
- **IDs:** the game's internal IDs throughout (`chr_0016_laevat`,
  `wpn_claym_0003`, `eny_0082_hsbear`). Display names come from i18n.
- **Numbers:** kept exactly as in the tables (e.g. `4.449999809265137`); no
  rounding on load. Rounding happens only where the formula is shown to round
  (*open*: rounding rules).
- **Attribute types** are numeric in the tables; the data layer maps them to
  names (`atk`, `def`, `str`, …) once, in one documented table, verified
  against known stat panels.
- **Provenance:** a `DataBundle` records the submodule commits it was built
  from and the game resource version (from 555me's commit message).

### DataBundle (sketch)

Records keyed by ID, containing only what the engine needs:

```ts
DataBundle {
  provenance: { sources: { name, commit }[], resourceVersion }
  constants: BattleConst            // atkRateOfMain, efficiencyOfDEF, …
  operators: Record<CharId, Operator>
  skills: Record<SkillId, Skill>    // per level: blackboard, cost, cooldown
  timelines: Record<SkillId, Timeline>  // from Json/SkillData, simplified
  buffs: Record<BuffId, Buff>           // from Json/BuffData, simplified
  weapons, gear, gearSets, enemies, …
}
```

Operator/weapon/gear growth curves are stored as tables, not pre-applied, so
the engine computes stats from levels the same way the game does.

### Skills and buffs from SkillData / BuffData

The raw files are C# action graphs, mostly presentation (animation, VFX,
sound, camera). Structure and known enum values:
[game-data-format.md](game-data-format.md). The data layer does **not**
interpret the graphs at run time. It compiles each skill and buff into a
small summary:

- **Skill:** hit frames (including hits from spawned entities and
  projectiles), per hit the blackboard scale key, poise, element and damage
  category (`damageDecorateMask`), inflictions, which buffs are applied at
  which frame, cancel windows, `durationFrame`, cooldown and cost.
- **Buff:** stacking type and limit, duration, attribute modifiers, damage
  modifiers (side, zone, value key).

Then it **overlays `SkillPatchTable`** by skill ID and level: the blackboard
and cost inside SkillData are defaults, not the real per-level values
(e.g. Laevatain's file says cost 0, the table says 100 SP).

What can't be compiled mechanically (conditional and triggered logic, combo
trigger conditions, which come from data we don't have) goes in a small
**hand-written behaviour layer per operator**, in a typed, schema-checked
format. Each hand-written rule cites its source and has a test. Unknown
action types or enum values fail the build, so coverage gaps are visible.

**Kits and the game data** (2026-10-25, review 3.1). The loader
(`packages/data/src/kits.ts`) compiles each kit skill once
(`kitMatch.ts` `compileOperatorSkill`, with kit-draft's options: the
talents' and potentials' attached buffs and value gates, timing values at
the highest level; cached per loaded data) and matches its hits to the
compiled landings (`matchSkill`: by first scale key, log events, frames on
one branch path). Then:

- **What a kit leaves out comes from the data** where every landing the
  hit stands for agrees (`hitFacts`, `withDataFacts`): frames (a hit
  without frames takes the landings of its key and events when they are
  one branch path no other hit takes landings of; a skill hit must end up
  with frames), events, factor, element, poise and poiseControlledOnly,
  detached, energy; `count` defaults to the number of frames; the skill's
  teamEnergy and energyBlockSeconds (unless an energy-blocking buff of its
  own cast trigger blocks it); SP: the grant going with each landing (one
  only while controlled as `{if: {controlled: true}, then: v}`,
  `spBeforeDamage` when it comes first), when every grant of the skill
  goes with a kit hit's landing or the kit names SP elsewhere in it.
  `efsim kit-trim` removes hand-written values equal to these, each only
  when the file loads exactly as before.
- **What a kit writes must be the data's**, or the load fails: every
  field above, the scale keys, Final Strike, a hand-written SP grant (its
  value, only-while-controlled, before or after the damage), launch, the
  applications by frame, landings no hit stands for; a cast trigger on one
  skill with that skill's values is part of its timeline (its hits at
  delay + frame, its energy, SP and applications at the delay; one with a
  random choice is left out); an equipment kit's triggered hits against
  their skill's landings where it has some; a kit buff's duration against
  the data's CreateBuff of its game buff where a skill's hit or own cast
  trigger applies it (a key of that skill, the buff file's own literal,
  or until ended). A difference on purpose is
  marked where it is, with the reason: `dataOverride: {field: "reason"}` on
  the hit, the trigger, the buff (`duration`), or the skill (`teamEnergy`,
  `energyBlockSeconds`, `applies@<frame>`, `lands <file>`). A mark where nothing differs fails
  too, so a fixed kit or compiler drops its marks. What the compiler can't
  say (dynamic keys, conditions it can't decide, jumps it doesn't follow)
  shows as a difference; its mark says so.
- **References** are checked as the kit loads: log event keys name fetched
  SkillData or BuffData files, a trigger's `gameBuffs` fetched BuffData,
  an application's `durationKey` / `scaleKey` / `multiplierKey` values of
  the applying skill (`scaleKey` on a physical status only for Breach).
- **Every node type** in the fetched SkillData and BuffData is listed in
  `skillTypes.ts` (interpreted by the compiler, the timing reader or the
  buff reader; a condition the compiler leaves undecided; or walked
  without interpretation, with why): a patch that adds one fails
  `skillTypes.test.ts`.

Not yet from the data (compared where written): launch frames,
applications, bonuses, buff durations (a kit buff without one lasts until
ended, so "left out" can't mean "the data's"); SP where the data doesn't
place all of a skill's grants on its hits (hitless skills, grants on
branches): there the engine still adds the skill's `atb` on its first hit.

**Arts state and stacks.** Kits list per hit what it `applies`
(inflictions, forced reactions, consumption). Which hits inflict is in
SkillData: an enabled `SpellInfliction` action next to the hit, with
`inflictionType` 0 Heat, 1 Electric, 2 Cryo, 3 Nature (45 enabled across the
operators' files, matching the skill descriptions; the 9 disabled ones are
unused variants). An earlier note here called them all disabled stubs,
generalising from Laevatain's disabled ones (corrected 2026-10-18, found
by the batch 1 analysis); the kit compiler should read them. One state machine
(`packages/engine/src/status.ts`) turns those into bursts, reactions and
statuses (Corrosion, Electrification, Combustion ticks, Solidification),
and statuses act on hits as ordinary Modifiers. Operator counters such as
Laevatain's Melting Flame are kit `stacks` that hits `gain` and `require`.
`efsim zmdlogs reactions` replays a log through the state machine to check
a kit's `applies` against the logged bursts and reactions.
Order within one landing: the hit's inflictions, then the triggers marked
`beforeDamage` on what they caused (their buffs count for the hit), then
the hit's damage. A reaction's own hit sees those buffs (Perlica's P3 on
her Electrification's hit, e82d), except Corrosion's, which the data
deals before its status exists (its damage buff first): it sees neither
its own shred nor what the status triggers (Hot Work's Nature DMG is on
the hit that forms the Corrosion, not on its own: 3f78, 4a64).

**Kit buffs in the log check** (2026-10-22, owner: the engine activates
buffs from the events that trigger them, not from the log's listing).
`efsim zmdlogs check` replays the logged casts on the timeline
(`packages/cli/src/buffreplay.ts`, engine `replayCast`): each placed cast
(logcasts.ts) starts at its logged frame without a rotation's checks, its
logged landings land at their logged frames (pinned: later time stops
don't move them, the log's time has them in), an operator's earlier cast
keeps its hits when the log shows them after the next cast started. The
kits' triggers, the enemy's statuses and SP then run as in a simulation,
and the kit buffs that stand for a game buff the log lists
(`KitBuff.gameBuff`) are read off the state: their instances per
operator. Where the replay is sure (away from its own changes: ±0.5 s of
a start, and an expiry also ±10% of the instance's life, since the
timeline's time-stop and hit-stop accounting is off by about that), it
decides: a buff it has off loses the log's entries, one it has on that
the log doesn't list gets them (the values the log gives the buff
elsewhere), one both have on keeps the log's entries (a buff the log lists
once whatever its layers, stackingType 8, at the replay's layers). Buffs a
trigger on chances, enemy actions or heals of the controlled operator
applies stay as the log lists them; so does everything near a change. A
hit no reading of the replay's version fits is tried with the log's
listing, and a match there is labelled "the log's buff listing (replay:
…)". The report lists where the replay and the log disagree (on/off,
instance counts) and which reading the damage fits: log gaps, or kit
triggers that are wrong. `--log-buffs` checks with the log's listing alone.

**The log check's rule** (owner, 2026-10-25: "if our engine can simulate
something, the log [check] should run that and compare the result with
what the log says"). Wherever the engine models something (buffs and
their layers, Link, statuses and reactions, Stagger, the finisher,
consumed buffs, crit-independent damage, timing), the check computes it
with the engine and compares the result with the log; the log supplies
only inputs the engine can't produce, and is otherwise what's compared
against. A logged hit's reading is the engine's damage path at its
landing in the replay of the logged casts (`packages/cli/src/enginecheck.ts`
`engineReadings`: engine `landingDamage` with the timeline's own
`damageOptions` there, which the replay records per landing as
`LandedHit.inputs`), so the check and a simulation share every rule; a
kit hit lands where the placement pins it, a status hit (burst,
reaction, physical status, Combustion tick) is the replay's status
damage of its operator, kind and element nearest the logged one. What
still comes from the log, and why:
- the **crit flag** (the replay can't know the roll; `loggedCrits` also
  feed crit-triggered buffs, a pinned landing its own hit's flag);
- **buffs no team kit defines** (`logOnly`: their entries become
  modifiers), and the hitter's **food** when its build doesn't set it;
- the **enemy's HP** over the fight (`TimelineScenario.enemyHp`);
- the outcome of what the replay **can't judge**: kit buffs whose
  triggers depend on chances, the enemy's actions or heals of the
  controlled operator (`BuffReplay.unjudgedKitBuffs`; the log's entries
  replace the engine's for them);
- the **build values** the log records (levels, gear, potentials);
- an **arts reaction's level** where the log shows one and the replay's
  enemy has other stacks (2026-11-11; `logcheck.ts` `loggedReactionLevels`,
  TimelineScenario `loggedReactionLevels`): the levels whose engine
  readings of the logged reaction hit fit its value (±1); one alone is
  the log's, of several the one the logged hits' inflictions give
  (`reactioncheck.ts`) if it is among them, else the replay keeps its own.
  The replay is made again with them (at most three times in all), so
  the status (a Corrosion's shred, Combustion's ticks) has that level too.
  Its inflictions themselves aren't checked against the log yet.
The log's entries under a buff the engine models are compared with the
engine's modifiers, not added: a kit buff stands for the game buffs a log
lists it under (`loggedNames`: its `gameBuff`, its `loggedAs`, and the
affix buffs its file's VulnerableAction / EnhancedAction create,
`buff_common_affixes_{vulnerable,enhance}_<element>` by the action's
subType, which is how ZMDLogs lists most Susceptibility and Amp); the
timeline's statuses (reactions, Corrosion, Electrification, Breach,
Stagger, Link) are the engine's too. Where the replay isn't sure (a kit
buff or Stagger changing within REPLAY_EDGE_MS of the hit, or a buff
whose instances depend on crits the log doesn't give; Link, consumed
buffs or a combo's count it can't say; the event's other kit hits; an
unlogged crit; the enemy's side of a hit's conditions, as its
inflictions aren't checked against the log yet; a Corrosion or a
reaction level the replay lacks; log-only buffs at the hit's boundary),
readings are tried, labelled: a match there is **assumed**, one with
none **plain**. Where no engine reading fits, or the replay has no
landing for the hit, the old reading of the log's own listing (with the
replay's decisions, "What the replay decides" below) is the **fallback**,
labelled with why the engine didn't serve (`the log's buff listing (no
engine reading fits (n))`, or the landing's reason); a fallback doesn't
verify an operator. Its Stagger is the pipeline's own (DamageOptions
`staggered` from the log's `buff_common_poise_break_damage_taken_scale`,
so Staggered-only modifiers apply). Gaps the fallback still covers
(2026-10-25; the report's "engine against the log's listing" names them
per buff and operator): the replay's Stagger (Staggered at 23–34 s in
4e5e and 19–24 s in bdf2, where the log has none: teammates' Final
Strikes taken as the controlled operator's, and Rhodagn's own recovery;
both from the log since 2026-10-26), its inflictions (40d9: a Corrosion after Gilberta's ultimate the log
never lists), Wolven Blood's layers on Rossi, Typhoeus's hover through
her combo, statuses it doesn't deal near the logged time, and a few
landings it doesn't make. `--log-buffs` checks with the log's listing
alone (`buffs: "log"`, no replay); `engine: false` the fallback's
readings alone (for testing them).

Every check also reports the fight's **totals** simulated against the
log's (`engineReport`: the replay's landings, its own included, matched
landings at their primary reading): total damage, per operator and per
kind (basic, battle, combo, ultimate, status, none), hits, status hits,
hits under Stagger, the last hit's time and the crit share, each as a
percentage error; the verdict snapshots pin them to 0.1%. Both sides
sum to the log's last hit: in a fight that ends in a kill (the log's
total is the enemy's HP) the replay's damage goes on past the HP to the
log's kill, so each operator's covers the same span, and when the replay
reached the HP is its own row, the time to kill. A recorded burst (Si's
Artful Intent: rate × every hit on the target while it lasted) counts in
its operator's row with the teammates' share of its record as logged, not
as replayed, so a teammate's replay error stays in that teammate's row
(489c and 9a80: Rossi's; 2026-11-14); the team's total and the kinds keep
the replay's burst, and the report lists each move. The replay's Stagger bar
follows the log: set to the log's bar before each hit with Stagger, and a
Stagger of its own ended where the log shows none (buffreplay.ts
`loggedPoiseBars`), so its Stagger windows are the log's; the totals'
"hits under Stagger" row measures that following, not the engine's
Stagger sums. Landings a log can't
have (a hit that didn't reach the logged enemy) are named by hand in the
fixture's `absent`, each with why, and left out of the replay's side.

**Why the check missed the Stagger bug** (journal 2026-10-25): until then
`checkLog` computed every hit through options of its own (`staggered:
false` and the log's listed ×1.3, its own finisher, Link, Corrosion and
situation) and took only kit buffs' on/off from the replay, so the
simulation's `damageOptions` (where Stagger counted twice) was never
compared with a log. The rule above removes that: the check's plain
matches are the simulation's own landings (tests/logs.test.ts holds each
to it).

**What the replay decides** (2026-10-25, review 3.2: the checker reads
facts from the replay instead of trying alternatives). The replay records
per logged cast (`BuffReplay.castFacts`) and per logged landing
(`BuffReplay.landing`: the engine's `LandedHit` with `LandingFacts`)
what the log doesn't list, and the check reads it, no assumption:
- **Link** the cast used (`Cast.link`; predictedLink, a second Link model,
  is gone);
- **buffs the cast consumed** (`consumedBy`) with their modifiers;
- **combo event counts** (the window the replay had open);
- the landing's **kit hit** and its operator's side of the situation: own
  **stacks**, own **buff layers**, who was controlled;
- **Corrosion**: the shred the engine's damage of the landing had (its
  ramp, the applier's talent cap);
- **crits**: the log's crit flags go into the replay
  (`TimelineScenario.loggedCrits`), so buffs triggers on crits apply are
  decided; where a landing's crit isn't logged, only where a second replay
  with those landings critting agrees;
- **casts without logged damage**: the log's cast events
  (`LogFixture.casts`, from the detail's skill events without damage;
  `zmdlogs refresh` adds them to an older fixture), else a cast inferred from
  the lane of the one buff it applies (`castsFromBuffLanes`); a logged
  cast inside its operator's own cantCastSkill channel keeps the running
  cast (the game couldn't have cut it there); one is a placed cast's
  within 2.5 s of the world's time (time stops between don't count); one
  of a skill a kit buff's ticks are logged under (`ticksLoggedAs`: Liino's
  stance beats) while that buff is on is its tick there, not a cast;
- **who is controlled**: every basic-attack hit with Stagger is
  controlled-only, so the log's Stagger per hit (`LogHit.poise`) names
  the controlled operator; the others' basic casts are their own attacks
  (`controlledFromLog`, `replayCast` `teammate`: the controlled operator
  stays). Without such a hit, each basic cast's operator is controlled;
- **the enemy's Stagger recoveries**: where the log's bar is back to full
  between two hits, the replay refills its bar (`loggedRecoveries`,
  `refillPoise`: a second life, or Rhodagn's own move). Its Stagger
  otherwise is the engine's, from the kits' Stagger per hit.
A fact the replay's own timing could change is unknown: Link or a
consumable that starts, ends or is used by another cast within
REPLAY_EDGE_MS of the cast (on the timeline without the cast, so its time
stop doesn't hide a teammate's grant), layers without a duration at an
operator's first such cast (casts before the log may have built them), a
cast the replay couldn't make, a hit it didn't land (a trigger's landing
counts within NEAR_FRAMES of the logged hit). There the old alternatives
are tried, each labelled "(the replay can't say: why)". The enemy's side
(inflictions, Vulnerable, consumed stacks) isn't taken from the replay
yet: its inflictions aren't checked against the log's reactions. The end
point, `zmdlogs check --simulate` (`simulateLog`), compares each logged
hit with its landing's damage, with only crits, enemy HP and effects no
kit models from the log: a diagnostic (journal 2026-10-25).

**What a log check verifies** (2026-10-24, after a review found matches
that said little). A logged hit is read many ways (crit or not, boundary
buffs, Corrosion levels, situational parts, event counts, value
assumptions, layers, unlogged own and cast buffs, Link, auras, kit-valued
unquantified buffs, and the log-listing fallback): median tens to hundreds
of readings, up to ~11,000 (until 2026-10-25; the replay now decides most
of these where it can: "What the replay decides", above). A match is
the first reading within ±1, so `checkLog` now tries them all and
returns, per match, `readings` (tried, matching), the `assumptions` as
data (`Assumption`: kind, label, buffs, count) and a `class`: **plain** (no assumption), **assumed**, or
**fallback** (only the log's buff listing fits). Verdicts that aren't
matches: **mismatch**; **unvalued** (no reading fits, under a buff the
log lists without a value and no kit values: the prediction lacks it,
so it neither verifies nor blames the kits); **unquantified** with a
`reason`: under Corrosion whose damage no level fits but some reading's
damage with the least and the most shred Corrosion can give brackets
(outside every bracket Corrosion can't explain it: a mismatch), the
killing blow, Fixed DMG a fight computes (where the log can't value it:
below), a status hit of an operator without a kit; and **uncovered**.
A recording buff's burst (Si's Artful Intent, `KitBuff.records`; since
2026-11-14, `packages/cli/src/recordedburst.ts`) is Fixed DMG of what the
buff recorded, which the log's own hits give: the buff's rate for the
hitter's build (ink_damage_rate: 0.13 at P0, +0.07 from P1, less below
battle skill 12) × the sum of every logged hit on the target, by anyone
(statuses, reactions and ticks too; Fixed DMG not), each at its uncapped
value where the log has one, from the logged hit that applied the buff
(inclusive) to the record's end. The log doesn't have the end (Final
Stroke's frame 12, or the expiry, 0.3–0.9 s before the burst), so each
logged time up to 1 s before the burst is a reading, and hits logged at
the start's ms but before it are read both ways; a reading fits within
±1 and ±0.5 × rate per counted hit (each logged value is rounded). A fit
is an **assumed** match (assumption `recordEnd`: the end's lag), none a
mismatch, or unquantified on the killing blow; a multi-target log, or
one without the applying hit before the burst, leaves it unquantified
(Fixed DMG). 34 of 40 single-target bursts fit (2026-11-14; misfits in
docs/open-problems.md). The negative control leaves these matches out:
they scale with the log's values. Until 2026-10-24 any hit under any
unquantified buff counted as unmodelled, so a fixture could pass with no
match at all (d9e59d0fb737: 0 of 98). A fixture is **verified**
(`verificationProblems`, the rule `tests/logs.test.ts` holds every
fixture in `fixtures/` to) when it has no mismatch and no unvalued hit,
and every operator with a kit and hits the check can judge (covered, and
not unmodelled for a reason other than Corrosion) has at least one plain
or assumed match. Fallback matches aren't mismatches, but they show the
damage with the log's buffs, not the engine's: they don't verify an
operator alone. `zmdlogs check` prints the verdict, per operator the
plain / assumed / fallback counts, and a strength line (readings per
match; matches whose only fitting reading was one of ≥100; a FLAG when
more than half are fallback, or fewer than half plain). How often a
reading fits by chance is measured by the negative control
(`tests/slow/negative-control.test.ts`): every verified fixture with all
logged values ×0.97 and ×1.03 must give at most 1% of its judged hits
as matches (4% until 2026-10-25). It gave 0–3% on 2026-10-24 (4e5e 11 of
345 at ×0.97, bdf2 5 of 166 at ×1.03), from readings with a free count in
steps near 3% (a layered buff the log lists once, at 1 up to its maximum
layers) or 1–2% (Corrosion levels); with the replay deciding those
("What the replay decides"), 4e5e gives 2 and every other verified fixture
0. Readings per hit fell with it (4e5e 91,895 in all to 25,936; median
3). A single assumed match is still weak evidence; a fixture whose hits
match by the hundred, where ×0.97 matches a few, isn't chance.

Since 2026-10-25 ("The log check's rule", above) plain and assumed
matches are the engine's readings at the landing, and fallback the log's
listing; tests/logs.test.ts also holds every plain match to the
simulation's own landing (`simulateLog`, ±1) and every verified fixture's
total damage, simulated against the log's, to within MAX_DAMAGE_ERROR
(45%: today dbae −43.9%, bdf2 −28.0%, 0eef −27.1%, b7b3 +23.1%, 40d9
−12.9%, 4e5e −12.5%); a fixture's error mustn't grow past its snapshot's.
That bound is loose because the engine's own state still differs from the
games' in the ways the report lists (Stagger, inflictions, layers);
tightening it is the measure of those fixes. The negative control gives
4e5e 3 of 345 at ×0.97 (two through the fallback), every other 0.

**The buff timing report** (2026-11-15, `efsim zmdlogs timing [fixture…]`,
`packages/cli/src/bufftiming.ts`; a diagnostic, never scored: it changes
no verdict, snapshot or accuracy number). The check toggles a kit buff
only where its replayed instances change within REPLAY_EDGE_MS of a hit;
a timing error of seconds (a time stop held another length, a trigger the
replay misses, the wrong recipient) shows up as a fallback or a mismatch.
For each such hit (`--assumed`: assumed matches too) the report takes the
engine's reading (enginecheck.ts `readingBasis`: the same primary reading
and alternatives `engineReadings` evaluates, without its own edge toggles)
and re-runs only the damage formula (`landingDamage`) with one kit buff of
the battle changed: off, on as the log lists it at the hit, on as the
replay values it at its nearest other landings (up to 3 distinct modifier
sets, which also gives other layer counts), or, where the replay never
values it, as the kit does (`kitBuffModifiers`, 1–5 layers); a buff on its
owner alone isn't tried on a teammate's hit, nor one the replay can't
judge. Each toggle is tried on the check's other alternatives (crit, Link,
… all combinations up to 16, else the plain reading and the crit's). A
fit is within ±1, as the check's. For hits no single toggle fits, pairs
of the 16 toggles nearest an edge (`--singles`: none). Each fit is placed
against the replay's instances of the buff at the hit's operator
(`BuffReplay.kitWindows`, sampled at the logged hits ±0.5 s: an early end
is at the first sample without it): "fits if it ended / started *d* s
later / earlier" within TIMING_EDGE_MS (5 s) of an edge, else "never
present in the engine" or "engine has it, damage says absent"; "carried"
where no instance reaches the operator (a Combustion snapshot or a cast
carries the modifiers), "inactive" where one does but its modifiers don't
act, "values" where the engine has it with other values. Each hit keeps
its smallest explanation (one toggle before two; an edge's, nearest
first; then values, inactive, carried; missing and extra last); the
others are listed as "also fits" (two buffs whose values fit alike make a
hint ambiguous), and hits whose ±1 is coarser than 0.05% (logged value
below 2,000) are counted as coarse. Hits whose best fit is the same buff,
direction and edge (without an edge: consecutive within 3 s) form a run;
two hits or more are a **pattern**, single fits are noise (a buff the
damage says is absent across a whole engine window shows as "starts
early" and "ends late" runs on that window's two edges). A pattern
counts plain matches in its span at its operators that the same change
would break (**against**), and lists what happens near where the buff
would have to start or end (casts placed and logged hitless, time stops
and slow-downs, the log's reactions, Stagger) beside the kit's sources of
the buff (skill hits and triggers that apply, extend or end it, with
their events; its duration, consumption and BuffData buff). A source an
event in the window matches (a cast of the right operator and kind, a hit
with the crit a crit trigger needs, or whose crit the log doesn't give, a reaction, a heal's cast,
Stagger; a time stop at the engine's end for an end shift; for a buff
missing or starting late, casts up to 20 s before the window) is a
**mechanism candidate**; a pattern without one is marked NO MECHANISM.
Patterns are summed per buff and direction across logs (runs, hits,
logs, offset median and spread, damage at stake = |logged − engine
primary|) and ranked by damage at stake. Without fixtures it reads every
development log of fixtures/pending/holdout.json; hold-out logs are
never read, only counted as skipped. It takes ~4.5 s a log (27
development logs in ~2 min). The hints it gives follow the accuracy
plan's rule, "Fits need a mechanism": leads in docs/open-problems.md,
not kit changes.

**Buffs from skills** are kit `buffs` (engine `buffs.ts`): target self,
team or enemy, a duration (0: not applied; none: until ended) and
modifiers on a zone or an attribute whose values are ValueExprs at the
applier's levels. Attributes that don't act on hits (Ultimate Gain
Efficiency) are read where the game reads them. A buff can be layered
(`maxStacks`, each layer with its own duration), reach only some team
members (`recipients`, a Predicate per member), or be consumed by the next
cast of a kind and act on that cast's hits only (`consumedBy`: Link). Buffs
from the same BuffData stacking key count only one instance, whole: the
one with the highest priority, the value of the game buff's priority key
at application (`KitBuff.priority`: the effect that reads the key, the
key itself, or, where a parent buff fills it, what the kit states;
tests/kits-priority.test.ts checks which against every CreateBuffAction);
ties and groups without a priority key: the latest.
Hits and triggers apply them, by default after the hit's own damage;
triggers end them (all, or the oldest layers), and a buff ending is an
event. Modifiers can be limited to hit kinds (`onlyKinds`,
the game's decorate-mask conditions, e.g. bursts only).

**Triggers** (engine `events.ts`): the timeline emits events (a hit
landing, a cast, the arts state's bursts / reactions / consumptions, a kit
buff applied or ending, an operator's stacks changing) and runs every team
member's kit `triggers` on them, in team order. A trigger names the event
(`on`, with filters), whose events count (`by`: self, teammate, anyone, the
controlled operator), an `if` Predicate judged for its owner, a cooldown and
a count limit, and actions (`do`): open the combo window, apply to the
enemy, gain stacks, energy, SP, apply, extend or end a buff, change a
cooldown, heal, land hits. Heals are events without amounts (who healed
whom, when), and periodic buffs tick (`buffTick`) for triggers.
What the actions cause are events too, run in the same chain (a loop in the
kit data is an error). Combo windows and team effects such as Laevatain's
Heat absorption on the controlled operator's Final Strikes are triggers;
`triggers.ts` gives the log replay the applications and gains a logged hit
causes. A trigger's `hits` action lands hits as its owner; each names its
damage type (`none` for hits of no skill type).

**Equipment kits** (`packages/data/kits/equipment/<id>.json`, one per
weapon or gear set) hold stacks, buffs and triggers that act for whoever
wears them (the owner's rule: any equipment on any operator, effects just
may not activate). Their IDs start with `<id>.`, their values come from the
equipment's own skills at the build's levels (`StatPanel.sources`), and
`effectiveKit` adds them to the wearer's kit for the fight: the weapon and
every gear set with enough pieces (`wornEquipment`).

Numeric enums (attribute types, stacking types, buff events, formula slots)
are decoded through **one version-pinned enum map**, each entry verified
against a known effect. Starting points: End-DPScope's
`research/附录A 全属性列表.md` (attribute IDs) and the game's English text
table.

## Engine

### Input: Scenario

```ts
Scenario {
  team: Loadout[]          // 1–4 operators
  enemy: { id, level, count?: 1 }
  duration: Frames
  rotation: Rotation
  options: { crit: "expected" | "never" | "always" | "rolled", seed?, rounding: … }
}
Loadout {
  operator: CharId, level, promotion, potential,
  skillLevels: { basic, battle, combo, ultimate },   // 1–12
  weapon: { id, level, refinement }, gear: GearPiece[]
  food?: ItemId            // a food buff, eaten before the fight
}
```

**Food buffs** (`Build.food`, since 2026-10-22): one UseItemTable item per
operator (all 36 food buffs share one stacking key, so the single field is
the game's rule). The loader (`packages/data/src/foods.ts`) takes the items
whose buffs persist on one operator and reads each buff's attribute
modifiers (BuffData `buff_common_*_potion_*`) at the item's blackboard
values; a buff that does anything else (dispel, heal, damage modifier) or
lasts other than the item is refused. Their lines go into the stat panel
like gear lines (`food <name> (<buff>)`, e.g. the stew's 180 ATK in the flat
slot), for the food's duration (300 s) from the fight's start: the timeline
switches to the panel without them at the end (`panelAt`), the log checker
by hit time. Defensive lines (DMG taken, heal bonuses) are panel lines no
damage reads. DEF +x% uses formula item 1, whose formula isn't known: it's
kept out of DEF (`StatLine.unmodelled`), and whatever reads DEF (kit
values) refuses it, so it never counts as nothing silently (in-game test
98). Items used in battle for an instant effect (heals, ultimate energy)
aren't foods; a build naming one gets the reason.

### Rotation

All three reference simulators take absolute timestamps and, when an action
is illegal (not enough SP, cooldown not ready, combo window closed), run it
anyway with a warning. That breaks search: changing one operator invalidates
every timestamp. So rotations are **programs** the engine schedules:

1. **Action list (MVP):** an ordered list of actions per operator
   (`{ operator, action, after?, at? }`; actions are basic chain segments,
   battle skill, combo, ultimate, swap). The engine runs each at the
   **earliest legal frame** given SP, energy, cooldowns, combo windows and
   animation lock. An explicit `at` frame is allowed for reproducing
   published timelines (ZMDLogs casts, End-DPScope scenarios); if it isn't
   legal there, that's an error.
2. **Generated on the fly (later, for search):** the action list isn't
   given up front. A **battle policy** chooses each next action from the
   current state while the battle runs, and the search explores the tree of
   possible choices (see [stepping API](#stepping-api)). Simple priority
   rules ("ultimate when ready, combo when its window opens, else battle
   skill if SP ≥ cost, else basic") are just one policy.

An illegal action is always an error in the result, never silently run or
skipped.

### Stepping API

The engine's core is a **state machine**, not only a `simulate()` call, so
the same code serves recorded rotations and interactive search:

```ts
init(bundle, scenario) → State
advance(state) → { state, decision? }   // run until the next decision point or the end
legalActions(state) → Action[]          // what can be done now, with earliest frames
apply(state, action) → State            // or an error if illegal
fork(state) → State                     // cheap copy for branching
evaluate(state) → partial Result        // damage so far, resources, timings
```

- A **decision point** is a frame where some operator can act: an
  animation lock or cancel window ends, a combo window opens, SP or energy
  becomes enough, a cooldown ends. Between decision points the engine runs
  events only.
- **Recorded rotations** are a driver that feeds the action list into
  `apply` at each decision point. `simulate(bundle, scenario)` is that
  driver, run to the end.
- **Search** is a driver too: at each decision point it asks a policy or
  evaluator for candidate actions, `fork`s the state per candidate, and
  explores the tree (beam search, Monte Carlo tree search, or similar;
  *open*). The evaluator scores partial states, e.g. damage so far plus an
  estimate of what the resources and buffs on hand are worth.
- This is why state must be **plain data** with cheap `fork`, and why
  `legalActions` must be fast and exact: search calls them at every node.
- The Rust port implements the same API; drivers can stay in TypeScript at
  first, calling the Rust engine, or move over later.

### Rotation search

`efsim search` (engine `searchRotation`, `searchBeams`) is a beam search on
the stepping API. By default it never swaps (`SearchOptions.swaps`, CLI
`--swaps`; the owner, 2026-10-25: "I don't intend to do operator swaps
during battles"): the scenario's controlled operator does every basic
attack and dive the rotation makes, and the teammates cast their battle
skills, combos and ultimates; between those, the teammates basic-attack on
their own (scenario `teammateAttacks`, default on: `teammates.ts`, which
the search doesn't decide). At each decision point every legal action is tried
(`legalActions`: the actions that can start soonest, plus the controlled
operator's next basic attacks even if later, plus the *asides* whenever
legal: the swaps and the controlled operator's dive, which don't count for
what's soonest — a swap can nearly always start at the state's own frame
and a jump as soon as the current skill's exclusive frames end, so counted
they hid every skill that could start a few frames later: review round
two, 2026-10-25), each applied with `at` the frame it starts, so the found
rotation replays to exactly the searched states with `simulate`. Per
half-second bucket the best `beamWidth` nodes survive, ranked by committed
damage (hits landed plus everything already on its way: the state advanced
to the fight's end) plus what the state holds for later (below, *How the
beam ranks*); the result is the node with the most committed damage.

**Pruning** (`prune`): of equivalent states only the best is kept (below);
then the best of each *family* in score order, then, if there's room, the
best of the rest. A family is the states that are the same but for who's
controlled (now, and when each hit on its way was cast) and the order of
the buff list (`stateKeyer(ctx, true)`): a swap is free and takes no time,
so every state came in up to one variant per team member, all with one
score, and in a team they filled the beam (the 4-operator example at beam
12: at one bucket all 12 nodes scored 671,349, and the rotation the beam of
6 had found was dropped). A search policy, not an exact merge (the others
are a swap away). Capping nodes per coarser macro state (controlled
operator, SP band, ultimates ready, combos off cooldown; or ultimates cast
so far), with or without a reserve for the best of each, was tried and
dropped: it moved results both ways (laevatain-solo at beam 12: 1,165,844
→ 1,006,745; the 4-operator example still fell to 1,576,033 at beam 6).
`resourceWeight` (unspent SP and energy worth what one cast deals per
point) was removed for the same reason: it hoards (si-laevatain at weight
1: 468,743), and with families a weight of 0.2 lowered every result
measured (liino-laevatain 1,510,467 → 1,436,660 at beam 12, the 4-operator
example 3,554,349 → 3,316,409 at beam 6); its one-cast prices can't value
an ultimate whose worth is what it enables (Laevatain's). Its successor,
priced by probes and with casts in progress counted, is below.

**How the beam ranks** (2026-11-14; `resourcePrices`, `resourceValue`,
`SearchOptions.valueWeight`, default 0.5). Damage so far prunes the lines
that bank for later: from zero ultimate energy every line looks alike until
someone's ultimate is up. So a node's score is its committed damage plus
`valueWeight` × what it holds:

- *Ultimate energy and team SP* at a price per point found by **probes**,
  not tables: once per search, from the fight's start with every ultimate
  charged, each operator's ultimate and battle skill is cast, then the
  controlled operator basic-attacks for 10 s; a cast's worth is the damage
  committed by then minus that of the attacks alone. So a cast that pays
  off through later hits is priced by them (laevatain-solo: her ultimate
  282,014, her battle skill 4,128), and a kit change moves the prices with
  it. Energy is worth its operator's ultimate's worth over its cost; SP the
  mean over the team's battle skills of worth over SP cost (who gets the SP
  is a choice). The resources' worth falls linearly to 0 over the last 10 s
  of the fight (no time left to spend them).
- *Casts in progress*: what of a probed cast's worth is still to come at
  its age (the probe's curve, half-second steps). Without it a cast turned
  the energy's worth into nothing until its damage landed, and the beam
  hoarded: Laevatain held her ultimate to 19.6 s of 30 (630,476 at beam 12
  against 1,113,946), si-laevatain fell to 390,173. With it, casting is
  worth at least holding at every age the probe saw.

What it doesn't see: what builds up outside the resources (enemy debuffs,
inflictions, stacks that a later skill consumes). In the owner's team from
zero energy (30 s) the best rotation holds Estella's battle skill and combo
to 27 s for 263k where a cast at 22 s gets 131k; the value is about 20k
there, too little to keep that line in a wide beam. Probing costs 0.03–0.2 s
a search; the score about nothing per state (per-state times within the
machine's noise, 0.9–1.1×). Weights compared (single widths, best of
w/2 / w / 2w): 0 / 0.5 / 1 gave the owner's team (30 s, full energy)
1,560,514 / 1,586,388 / 1,598,596, from zero 979,020 / 1,068,442 /
1,016,787; si-laevatain 2,407,715 / 2,387,476 / 2,387,476; laevatain-solo
1,155,679 / 1,156,151 / 1,155,621; si-laevatain-liino-gilberta 3,190,240 /
3,185,817 / 3,170,975 (w 6 / 12 / 24); duo 263,699 at all. Each width alone
still moves both ways with it (si-laevatain-liino-gilberta at 24:
3,190,240 → 2,933,298 at 0.5): the value helps the owner's teams most and
is within ±1% elsewhere, so it's on at 0.5; `valueWeight: 0` is the ranking
before, bit for bit (the pinned totals in tests/search.test.ts).

**Equivalent states** (`stateKey(ctx, state)`) are equal in every field
that what comes next reads: each `TimelineState` field, and each field of
each kind of scheduled item and of a buff, is classified in a `KeyRules`
record (in the key, a projection of it, or a reason it isn't: landed hits
and the reaction record are the score and the log), so a new field doesn't
compile until someone decides; scheduled items are keyed per kind, in
order (the order within a kind is what ties go by); the key is a canonical
serialisation (sorted keys), with SP and energy rounded to 0.1
(floating-point noise between paths). Exact by construction, it leaves
out (`KeyEnv`, 2026-10-25):

- *Deadlines already past.* Everything after a state happens at its frame
  or later (advance only moves forward, an action starts no sooner than
  the state's frame, a slow-down shifts only what's after its start, which
  is no sooner either), so a deadline the engine reads only as "is it
  later than now" is none once it's at or before the frame: `readyAt`
  (read as `> frame` or max(frame, ⌈it⌉); cooldown changes skip ended
  ones), `energyBlockedUntil` (`> frame`, set anew), `spPausedUntil`
  (max(frame, it), raised with max), Link expiries (`> frame`),
  `enemyFrozenUntil` (max(event frame, it)), a stagger that's over (the bar
  counts as full, `finisherUsed` is read only while Staggered), slow-downs
  that have ended, chain steps whose window closed (a dead step that was
  next isn't promoted: `chainAfter` keeps only a live one), a buff's ended
  `whileCasting`, combo windows that closed — except those a follow-up
  combo of the team may cast into (`castSkill` reads a follow-up's window
  count without checking it's open) — and a trigger's cooldown once ready
  (its count only when it has a `maxCount`).
- *Cast indices* count from the end of the cast list (the engine only
  tells casts apart, looks one up and numbers the next by the list's
  length): in scheduled items' cast references, bursts' `fromCast`, a hit's
  `branch`, a delayed action's event, actions, buffs, per-cast trigger
  counts and each operator's last cast; a cast nothing refers to any more
  drops out (its Link, its per-cast trigger counts).

Tests: a state with dead deadlines added has the state's key and the same
future (the same choices, damage and keys for 40 steps); every pair of
different states a small beam merges (40 pairs) plays on the same.
Merges gained (beam 24, nodes compared → merged): si-laevatain 8,943 →
1,533 before, 9,190 → 1,701 after; laevatain-solo 3,463 → 76 before,
3,465 → 176 after. Few: paths that meet again mostly differ in what's to
come, not in what's past.

**How far to trust a result** (`searchBeams`). A beam search isn't
monotone in its width: what survives a bucket is ranked by a score of the
present, so a rotation that pays off later (Si's Initial Stroke deals nothing
itself; Laevatain's ultimate deals little, its enhanced attacks a lot) can
be dropped when a wider beam brings in more nodes that are ahead for now.
`efsim search --beam w` (default 24) therefore runs w/2, w and 2w, keeps
the best and prints each width's result and the spread, (best − worst) /
best; above 1% it says to treat the best as a lower bound. Since
2026-11-14 each width after the first is **guided** by the best rotation
found so far (`SearchHooks.guide`): its nodes keep a place in the beam
(the last, when the score alone would drop them; an equivalent state that's
kept takes it over), so the wider beam finds at least as much and the
spread is what the wider beams found on top (before, the owner's team gave
3,061,788 / 2,924,392 / 2,928,204 at 12 / 24 / 48: the wider beams lost
the narrow one's rotation). The owner's team (60 s, 2026-11-14), beams 12 /
24 / 48, before (single widths, damage so far) → after (guided, with the
value): full energy 3,061,788 / 2,924,392 / 2,928,204 (spread 4.5%) →
3,232,373 / 3,273,371 / 3,286,029 (1.6%; 47 / 44 / 50 ms a state, about
1.1× before); from zero energy 2,827,922 / 3,008,031 / 2,744,453 (8.8%;
40 / 40 / 45 ms a state) → 2,797,948 / 2,808,913 / 2,973,678 (5.9%; 42 /
41 / 42 ms): from zero the best of the three fell 1.1% (3,008,031 →
2,973,678; the value is small while the energies are low, *How the beam
ranks*), and the widths still disagree. Zero-energy fights are where the
ranking is weakest. `--single` runs
w alone. A search stopped by `maxExpansions` (200,000) says so (`capped`,
and a warning). Beam widths 12 / 24 / 48 (single widths; 2026-10-25):

| example | before | after |
|---|---|---|
| si-laevatain (20 s) | 2,142,022 / 2,147,903 / 2,064,639 (16: 2,051,398; spread 4.5%) | 2,094,656 / 2,156,233 / 2,185,220 (4.1%) |
| laevatain-solo (30 s) | 1,165,844 / 1,194,306 / 1,196,307 (2.5%) | 1,165,844 / 1,165,844 / 1,196,307 (2.5%) |
| liino-laevatain (30 s) | 1,510,467 / 1,514,664 / 1,526,692 (1.1%, swap fix only) | 1,510,467 / 1,402,446 / 1,511,305 (7.2%) |
| si-laevatain-liino-gilberta (20 s, beams 6 / 12 / 24) | 3,016,009 / 1,557,958 (swap fix and key) | 3,554,349 / 3,701,403 / 3,173,136 (14.3%) |
| the same without swaps (the default since 2026-10-25) | | 2,434,451 / 2,650,070 / 2,691,389 (9.5%; 9 / 23 / 45 s) |

So the gap left is the ranking, not the key or the choices: what the
beam needs is a score closer to the final damage (a rollout, or a value
for what a state holds: ready skills, a running ultimate, a set-up
sequence). The probed resource value (*How the beam ranks*) is the cheap
part of that; what builds up outside the resources is still unseen, and
the guided widths make sure a wider beam at least keeps what a narrower
one found. Ratchets
(tests/slow/search-beams.test.ts): the best of w/2, w, 2w at 2w within 1%
of that at w; one width alone, 2w within 2% of w (duo and si-laevatain's
first 10 s at w = 4).

**A full team** (si-laevatain-liino-gilberta, 20 s): beams 6 / 12 / 24
took 36 / 85 / 172 s (1,306 / 3,050 / 5,283 states, heap under 400 MB),
about 26 ms a state against 4 ms for si-laevatain. The time goes to
landing hits (`landHit` 40% of a profile at beam 4: the situation and
trigger scans per hit, the damage path, which grow with four kits and
their gear) inside advance (56%), for judging the choices (`earliestStart`
37%) and committed damage (17%); the key is 3%. Nothing cheap was left on
the search's side. With `--swaps`, its rotations lean on two assumptions: an operator's
basic attack goes on after a swap (two chains run at once, swapping
between their steps: in-game test 15) and a swap mid-fall keeps the
landing (test 97); the default search makes neither. The example's
rotation is the no-swap search's since 2026-10-25 (2,691,389; with swaps
3,464,381).

**Random outcomes** (owner, 2026-10-20: "the result becomes not a number,
but rather a random distribution and needs to be interpreted and tracked as
such"). A scenario has them (`randomOutcomes`) with rolled crits, a dodge
chance strictly between 0 and 1 and enemy attacks to dodge, or a kit
trigger (own or worn) with a `chance`. Then each beam node carries the
states of K seeded battles (`seeds`, default 4; `efsim search --seeds k`):
seeds `seed`, `seed` + 1, … from the scenario's seed. The first battle
(the scenario's own seed) proposes the legal actions and their frames;
every battle applies the same step with that `at`, which in the others
starts at their own earliest legal frame from there (after a perfect dodge
one battle may be ahead of another) — exactly what `simulate` does when it
replays the rotation with that seed, so replay stays exact per seed. A
child whose step isn't legal in some battle (no combo window there, not
enough energy) is dropped. Requiring the same start frame in every battle
was the alternative; it drops nearly every child once dodges have shifted
the battles apart. A node's score is the mean of its K battles' values, or
a percentile (`percentile`, nearest rank; `--percentile 25`) to prefer
rotations that hold up when the dice go badly. Without random outcomes
K = 1 and the search is the deterministic one, bit for bit.

The result keeps the single battle with the scenario's seed (`result`,
for inspection) and adds the found rotation's distribution
(`rotationSpread` over `runs` battles, default 50: mean, standard
deviation, min, 5th / 50th / 95th percentiles, max). Unlike `simulateRuns`
(`efsim simulate --runs`, which rolls crits), it keeps the scenario's own
options, crit mode included, so an expected-crit fight with dodges varies
by its dodges only. A battle in which the rotation can't be played (an
action's random outcome went otherwise) is counted as `illegal` and left
out of the figures. `efsim simulate` without `--runs` notes when the
scenario has random outcomes: its total is one battle of a distribution.
With expected crits it prints the total's distribution instead
([Damage distributions](#damage-distributions)), whose seeded battles
(crit `distribution`, `--battles k`) are the ones this paragraph's search
would rank by. The search itself is unchanged by that (2026-11-13): it
still ranks crit-triggered teams over rolled battles (`searchCritMode`)
and its `--percentile` is the seeds' nearest rank, not the distribution's
Cornish–Fisher estimate; the planned follow-up replaces the K battles by
one deterministic battle with crit-triggered buffs at their expected state.

**Speed** (profiled 2026-10-20). 75–85% of the search's time went to
judging candidate actions (`earliestStart`), and nearly all of that to
actions that couldn't be chosen anyway: errors and starts later than the
soonest. `earliestStart` replays the fight to find when the operator's
current action ends (a kit's `endAction`, jumps, dodges), a combo replays
to every pending hit looking for its window, and each replay starts from
the node's state again. Now, all exact (same rotations and totals):

- `memoised` (timeline/advance.ts): on the contexts the search makes, `advance`
  is memoised per state object and frame (the cache is the context's own
  `advanceMemo`, not module state). `advance` is a pure function and
  states are never changed in place, so a repeated call returns the first
  one's result; judging an operator's skills from one state shares the
  replays.
- `legalActions` judges the controlled operator's basic attacks and the
  asides first. When a basic attack can start at the state's own frame
  (most decision points), nothing starts sooner, so the other actions are
  choices only if they can start right then: `startsNow` (timeline/drivers.ts) judges that without
  how much later they could (`startFrom`'s frame is the state's own, and a
  combo that needs a window has one open).
- Of the others, `startsNow` is asked first; only when no action but an
  aside can start at the state's frame are they judged in full (more often
  since the swap fix: si-laevatain at beam 24 went from 2.3 to 3.9 ms a
  state).
- Follow-up skills (`followUpOnly`) aren't judged (never legal from a
  rotation); committed damage is cached per state (its advance to the end
  isn't kept by the memo).

Searches at beam 24, wall time without loading the data, before and after
run alternately on the same (shared, so noisy) machine, best of the runs;
found rotations and totals unchanged:

| example | before | after | total |
|---|---|---|---|
| laevatain-solo (30 s, one operator) | 5.7 s | 2.9 s | 1,182,147 |
| si-laevatain (20 s) | 10.9 s | 5.4 s | 1,916,642 |
| liino-laevatain (30 s) | 55.1 s | 21.4 s | 1,510,009 |
| typhoeus-gilberta (60 s) | 289.5 s | 38.3 s | 3,366,828 |

With random outcomes a search costs about K times as much per child
(each battle is applied and scored; only the first judges the choices):
si-laevatain with `--dodge 0.7 --attack-every 4` and K = 4 took 23 s.

**Opener and loop** (`searchLoop`, `efsim search --loop [--loops n] [--rounds n] [--sync]`;
owner, 2026-11-14: "complete rotations, not a fixed 60 s window", an
opener and then a loop that can be repeated for as long as the fight
lasts, its boundaries at the ultimates' casts). A **loop** is a round of
actions (from a cast of the boundary ultimate to its next) that plays
again *exactly* — the same actions at the same times from its start —
from where it ends, `repeats` (3) more times in a row; the rounds before
its first play are the **opener**. Everything replays with `simulate`
(one rotation, `at` absolute); `--out` saves the opener and n plays of
the loop (default 4; plays past those found are exact replays, checked).
Fights with random outcomes are refused (an exact replay in one battle
needn't hold in another).

*Boundary* (`slowestUltimate`, `ultimatePeriods`): the ultimate with the
longest recharge in the opener search's rotation (over the scenario's
fight, at least 60 s): cast twice or more, the mean time between casts;
cast once, the time from its cast to the horizon over the share of its
energy back by then. Fewest casts was the rule before: with full energy
every ultimate is cast at 0 and that picked one never cast again within
60 s (Akekuri's), or the fastest when only it was cast twice (Estella's).

*Closing rounds.* Round after round from where the last ended (its
boundary cast), the beam search (`SearchHooks.prefix`) runs over
`LOOP_MAX_FRAMES` (90 s) and 10 s more and returns every rotation that
reaches the boundary's next cast (`SearchHooks.stopAt`: such a child ends
there, isn't expanded, and comes back in `SearchResult.stops`). Plans are
compared by **`closingScore`**: damage landed per second, where what the
round takes from the resources it found is charged as the time their
regeneration needs to make it up — SP at 8 a second, each operator's
ultimate energy at its bar over its recharge (`energyRates`), the longest
of them, since they come back side by side — and × 0.85 if it leaves the
kit stacks different (Laevatain's Melting Flame decides whether her battle
skill is the empowered one). A surplus isn't credited: in a loop played
on, it caps and is lost. The round is one of:

1. *A new plan*: of the stops within 5% of the best score
   (`closingMargin`), the one with the best mean over **two plays** —
   itself, then itself again from where it ends (moved later as in 3) —
   trying one plan per set of skills at their frames, at most 8; none
   whose second play can be played: the best. A plan tuned to where it
   starts rarely survives its own end (laevatain-solo's best first rounds
   drain the SP the opener left: 101 → 60 → 17 → 6).
2. *The last round replayed exactly*: kept unless a new plan scores 2%
   better (`hysteresis`). Three replays in a row make the loop.
3. *The last round moved later* (`shifts`), when it can't be replayed
   exactly: an action that can't start at its frame starts as soon as it
   can — waiting up to 20 s for energy, SP or a combo window — and
   everything after it that much later; a basic attack whose chain step
   isn't there becomes the step that is; a finisher on an enemy not
   Staggered and a combo whose window doesn't open are dropped. A plan of
   its own, which may then replay exactly: what's late is mostly what's
   short, and casting it when it's ready resets it.

Tolerance (3%, `tolerance`): the plays' damage per second, reported
(`damageApart`, `agrees`), not a condition. The actions are the same in
every play, but the enemy's Stagger cycle needn't follow the loop's, so
the Staggered bonus falls in a different play each time; the loop's DPS
is over all its plays (5–8 in the measurements).

Measured (2026-11-14): laevatain-solo (full energy), beams 4 /
6 / 8: loops of 35.4 / 31.2 / 34.4 s at 36,214 / 37,215 / 36,939 DPS over
their plays (14.1% apart at beam 6: Stagger), after openers of 478.7 /
195.5 / 225.5 s (12 rounds or fewer; 30–50 s a run); opener and 8 plays at
beam 6: 15,733,256 in 445.4 s, 35,324 DPS, which `simulate` replays. For
comparison at beam 6: the fixed 60 s search 43,453 DPS and the 300 s one
36,764 (both with the start's full energy and 200 SP, which a loop can't
count on): the loop is at the long fight's sustained rate. The rounds are
chaotic: small changes move the fixed point (before the chain-step and
combo repairs in 3, beams 4–8 gave loops of 28,260–32,544 DPS or none; at
beam 6 one run found a 50.0 s loop at 32,544 that repeats to the damage,
0.0% apart, its Stagger in step).

The owner's team, beam 6, 12 rounds (52–55 min a run, 2.5–5 min a
round): **no loop**. From zero energy (boundary Estella's ultimate)
rounds of 41–86 s, opener and rounds 33,754,626 in 803.7 s, 42,001 DPS
(the fixed 300 s search: 41,024); with full energy (boundary Akekuri's,
back after 60–80 s) rounds of 63–86 s, 39,759,477 in 925.5 s, 42,962 DPS
(the fixed 300 s search: 44,503). No new plan within 5% of a round's best
played twice, and no round's plan replayed: on the second play an
ultimate lacks energy past the 20 s wait (Si's 80 with 22–56, Arcane's
100 with 0–95, Akekuri's 108 with 73) or Arcane's sequence 2 finds her
array (Gloompurge Arcana) gone. Why: the four ultimates don't recharge in
step — Estella's in about 40–45 s, Si's and Arcane's 45–50 s, Akekuri's
60–80 s — so a round of one boundary ultimate holds a non-whole number of
the others', and a plan that casts each once wastes energy while one that
casts one twice can't do it again; Arcane's ultimate is two casts tied by
her array, whose energy block shifts with it. A loop here likely needs
more than one round of the boundary (two of Akekuri's ≈ three of
Estella's), or a boundary where every ultimate is ready: the
synchronized burst rounds below close for both scenarios.

*Synchronized burst rounds* (`sync`, `efsim search --loop --sync`;
2026-11-14). The boundary is the moment **every** operator's ultimate is
ready, as players hold the fast ones for a burst window. An operator's
*lead* ultimates (`leadUltimates`) are those castable from a rotation,
costing energy, and available at the fight's start before any buff
(Arcane's Gloompurger Array; not her sequence 2, castable only during
Gloompurge Arcana). One is *ready* (`ultimatesUnready`) when it's off
cooldown, its energy is full and it's available (Arcane: neither the
array nor Gloompurge Arcana up), whether or not the operator is free to
act. A round starts after the step at such a moment and ends at the first
step after which every ultimate is ready again, each lead ultimate cast
in between (`SearchHooks.stopAt` gets the state after the step and the
rotation); the round's last action is that step, and the next round
starts after it. The opener runs from the fight's start to the first such
moment: none when every bar starts full; from zero energy the build-up,
the stop of the opener search with the most damage landed a second. The
closing machinery is the boundary mode's (exact replay, moved-later
replay, closingScore, two plays); energy is full at both ends of a round,
so closingScore charges only the SP a round takes. Rounds are looked for
up to `LOOP_SYNC_MAX_FRAMES` (120 s): every bar must refill after one
cast each, and the team's energy comes mostly from the SP it spends (from
zero energy, Si's 80 took 98 s).

*Each lead ultimate once a round, none in the opener*
(`SearchHooks.allow`: refused actions aren't choices and don't count for
what's soonest). Without it the beam, ranked by damage, casts each
ultimate the moment it's ready, and its lines rarely meet a moment every
one is: si-laevatain and the owner's team found no round end at all. With
it a fast ultimate is held at a full bar until the round ends; what that
costs is measured: `TimelineState.energyOverflow` counts energy granted
past a full bar (a statistic, not in the state key), and each repetition
reports it (`energyLost`), split into **held** (lost while the operator's
lead ultimate was ready, stepped action by action) and the rest (a grant
that crosses the cap; Arcane's sequence 2 grant on a bar not yet empty).

Measured, the owner's team (2026-11-14; rotations in
[docs/teams/rotations/](teams/rotations/), each replayed by `simulate` to
the same total):

| | zero energy, beam 6 | zero energy, beam 8 | full energy, beam 6 |
|---|---|---|---|
| loop | **closes**, rounds 3–8 | **closes**, rounds 11–16 | **closes**, rounds 14–19 |
| loop length | 81.1 s | 84.3 s | 84.9 s |
| loop DPS over its 6 plays (apart) | 40,677 (1.3%) | 41,862 (0.0%) | 41,056 (0.3%) |
| opener (build-up, then rounds) | 255.7 s, 9,319,391 (78.7 s, 2,601,325) | 941.9 s, 37,062,742 (82.6 s) | 1,095.2 s, 42,612,457 (none) |
| opener and 6 plays | 29,120,948 in 742.5 s, 39,218 DPS | 58,244,871 in 1,447.9 s, 40,226 | 63,526,451 in 1,604.6 s, 39,590 |
| held at a full bar, a play | Estella 34 of 63, Arcane 30 of 100 | Estella 60, Arcane 112, Si 15 | Estella 63, Arcane 63, Akekuri 22 |
| run | 8 rounds, 44 min | 16 rounds, 5.1 h (3 jobs at once) | 19 rounds, 2.3 h |

For comparison, the boundary mode (no loop in 12 rounds): 42,001 DPS over
803.7 s from zero energy, 42,962 over 925.5 s with full energy; the fixed
300 s search 41,024 and 44,503 (with the start's energy and 200 SP, which
a loop's plays don't get). A fixed-length search of the same total length
(742.5 s from zero energy) wasn't measured: at beam 6 it ran out of the
default 2.2 GB heap, and with 9 GB hadn't finished after 65 min (stopped).
The loops run at 40.7–41.9k DPS, a little below the boundary mode's
rounds, which spend energy as it comes and don't repeat.

Every loop's length is set by the slowest bar (Si's 80, or Akekuri's
108): about 81–85 s. Estella's ultimate (back in about 40–45 s otherwise)
waits half to a whole bar at full, Arcane's a third to one; Arcane also
loses 150–170 a round to her sequence's grant, which holding doesn't
cause. Their direct hits are worth about 107–152k (Estella) and 138–182k
(Arcane's two parts) a cast, so what's held is worth at most about 3%
(zero energy, beam 6), 8% (full energy) and 10% (beam 8) of the loop's
damage — a ceiling for a two-round loop (the fast ultimates cast more
often between the slow ones' casts), which isn't built. The first rounds
change plans often (chaotic, as the boundary mode's: a new plan's score
swings with where the enemy's Stagger falls; one round's exact replay
fails by 1–3 frames, and its moved-later version loses to a new plan
that scores 2% better), so the opener is long when the loop is found
late (941.9 and 1,095.2 s).

`--sync` is not the default: it's the mode that closes for the owner's
team, but other teams' bars don't all refill in 120 s after one cast each
(si-laevatain: Laevatain's 255 at 102 after 100 s; xaihi-si: not every
bar full within 90 s from the start; akekuri-laevatain: no round within
90 s, before the limit was 120 s), and Laevatain alone loops lower than in
the boundary mode (53.3 s at 31,247 DPS against 31.2 s at 37,578, beam 6:
her combo's energy, granted at a full bar just before her ultimate, is
lost); perlica-estella (beam 4) found no loop in 12 rounds.

Rounds take 4–6 min each at beam 6 alone (12 min late in a run with three
jobs at once). Memory: every state carried every hit landed since the
fight's start, copied per node, so late rounds ran out of the default heap
(beam 8 at about 700 s, beam 6 at about 1,300 s, killed); a round's search
now leaves the prefix's landed hits out of its states
(`SearchHooks.hitsFrom`; their sum starts each node's damage, so the
search finds the same to the bit). The fixed-length search has no such
cut.

Tried and dropped (2026-11-14): cutting the fixed-length search's rotation
at two casts of an ultimate and replaying the segment — at its exact
frames (every cut failed: a chain step not reached, a combo window not
open, a finisher on an enemy not Staggered, the ultimate 25 frames late),
as a player would (the skills in order as soon as legal: the repetitions
drifted, 1188 → 1277 → 1500 frames), or with closing conditions as a
filter (the same energy, SP, stacks, cooldowns and chain step at the end:
no state of a beam of 12 met them; SP within 3 and the same stacks: none
of 420 stops of laevatain-solo's first round). Each repetition searched
afresh until three agree (the first `--loop`): they never did
(laevatain-solo, 6 repetitions of 29.9–47.5 s; the owner's team, 42–59
s). Exact replays of each round's best plan alone: laevatain-solo's
high-DPS plans all failed on their second play (the battle skill late for
SP, the combo's window not open, the ultimate's enhanced attacks out of
Twilight); only rounds that hold the ultimate past 49 s replayed (33,380
DPS, exactly periodic). A round's skills as a skeleton, the search
choosing the basic attacks in between: the next round couldn't complete
it (the SP for six battle skills wasn't there). Ultimate energy charged
at its probed price instead of as recharge time: the owner's team's
rounds kept casting ultimates on energy the opener left (Si's at 0 of a
round, short 72 of 80 on the second play).

### Payoffs and chains

`efsim payoffs <scenario>` (engine `payoffs`, payoffs.ts; owner, 2026-11-15:
plan from the payoffs, the buffs and debuffs that maximise each action and
the rotations that set them up; good teams' combos overlap). The forward
beam keeps the best N states per step, so setups that pay off 10–20 s later
look worse meanwhile and fall out (Ink Melt: beams 12/24/48 gave 3.50 /
3.50 / 4.41M). The payoff table is phase 1 of planning backward from the
payoffs; phase 2 prunes the forward search with it (below, *Pruning the
search*); phase 3 feeds the backward-built setups into the search (journal,
roadmap). Every number is the engine's: **probes** on the stepping API
(runStep, observe), never kit semantics re-derived by hand, so a kit change
moves the table with it. A planning aid, never part of a fight's result.

*Steps* (`planSteps`): each operator's battle skills, combos and ultimates
(not follow-ups), and the controlled operator's basic chain from the attack
input (its first available chain head, or what a buff maps the input to:
Laevatain's enhanced attacks in Twilight) to its Final Strike, taken as one
step. They're measured in a planning fight (`planContext`): the scenario's
team and enemy, every ultimate charged, no enemy actions.

*Probes* (`probeStep`, `observe`): a step cast at its earliest from a
state, against the same fight without it, watched for 20 s. Buffs, combo
windows, enemy statuses and pieces are sampled every 8 frames and compared
by **counts** (instances of each buff, openings of each window, enemy
events by what happened), not by frames: an ultimate's time stop moves
everything else in its fight later, so the same buff from something else
sits at another frame with it than without it (comparing by frames made
every ultimate "open" every window). What a probe records: damage (all
hits, its operator's own, reactions), its cast's first and last hit, the
buffs it created (owner, target, offset, duration, layers, stack group,
modifiers), enemy events (inflictions, reactions, consumptions, Shatter,
physical and control statuses), the windows it opened (whose, when), SP
and energy against the fight without it, its cost and busy frames, and
the **pieces** it achieves (below).

*Situations*: none; Staggered; each element the team inflicts at one
stack; Link when the team makes it; the step's operator's kit stacks at
their maximum (Laevatain's Melting Flame: plain data, so a trigger on
reaching it doesn't fire). A step that can't be cast from the start gets a
**prefix**: an opener whose probe opened its window, two steps from the
start (a reaction: an infliction, then another element), one or two of its
operator's own steps (Si's strokes after her battle skill), each allowed
to wait 20 s for availability; failing those, a combo is probed in a window
forced open (Akekuri's, opened by a Stagger) and a gated skill with the
buffs its `available` condition reads put on through the engine (`addBuff`:
Arcane's Gloompurge Arcana, which needs two Final Strikes inside her
array). Both are marked in the table and listed as unreachable.

*Pieces and ceilings.* A piece is what the team can have on when a payoff
lands: a buff instance as the engine created it (with modifiers, Link, an
input mapping, or a buff some skill's `available` reads: Twilight), a
reaction status (Corrosion, Solidification, Combustion…), a physical
status (Breach), Vulnerable stacks, Link stacks. Each damaging step's
**ceiling** is its `dealt` damage (its own kit hits plus the reaction hits
it adds) under every piece the team achieves (`withPieces`: re-timed to the
cast; statuses old enough to be at full strength, Corrosion's shred ramps),
in the best of the exclusive situations (no infliction, each element at 1
and 4 stacks, each with and without Stagger, each with and without its own
stacks full), with and without the gating buffs (Twilight shuts
Laevatain's plain battle skill). Conflicts the engine knows are left to it:
one infliction at a time (the situations), a stack group's strongest
acting (buffs.ts reads the instances), element, skill-type and Staggered
filters, build-fixed modes (Arcane's INT / WILL, Laevatain in slot 1:
the build). Pieces that lower the ceiling are left out one at a time
(`against`: a status the cast consumes, Twilight); each kept piece's
**worth** is what the ceiling loses without it. Each piece lists its
**achievers** (step, situation, cost) with the **lead**: how long before
the payoff's start the achiever may start for the piece to be on for all
its hits ([offset − first hit, offset + duration − last hit]).

*Window payoffs*: reaction statuses (their damage in the probe that formed
them, and who forms them) and recording buffs (Si's Artful Intent: rate and
window; the burst lands as the recording step's own hits, so the setup
efficiency marks it).

*Chains* (`findChains`): depth-first from the fight's start, each step cast
at its earliest in the engine after the ones before, kept when it's
**tied** to them: a combo cast within a window an earlier step of the
chain opened (`opens`), or a step that after them opens a window or causes
a reaction, consumption, Shatter, physical or control status (its own
operator's: a time stop reorders others' events) that it doesn't from the
fight's start (`sets up`, starting within 3 s). Each step once a chain;
chains of the same steps starting at the same frames are one (the order of
simultaneous casts). Every chain of two steps or more is kept (the owner:
rank is for display only, `--top` limits printing, never the data). For
each: damage (within 20 s of its last start, against the fight without it),
span (first start to the last moment one of its operators is busy with it),
SP and energy cost, damage per second of span and per SP. For the best ten
per second (`measure`): each step's **slack** (how much later it may start,
half seconds up to 6 s, with every later step still tied and the damage
within 1%), and a **merge**: setups cast before it (each other step, kept
when chain and setup deal more together than apart: synergy; greedy, up to
three) and **fillers** fitted into its idle time (each other step after
each chain step, kept when no chain step moves and the damage rises: an
idle operator, spare SP, a gap in a cooldown; up to three). Low-value steps
stay in the data: they matter when they fill resources that would go
unused (the owner, 2026-11-15).

*Setup efficiency* (`setupEfficiency`): a rotation's casts, each one's own
kit hits (its skill's hits until the operator's next cast of it) against
its ceiling's `bestCast`, and which chains it plays (each step at or after
the one before and within a combo window and 2 s of it, simultaneous casts
in any order).

What's exact and what isn't: probes, ties, chains' damage, slack and
merges are the engine's own numbers for the planning fight (full energy,
the fight's start, no enemy actions, teammates attacking on their own as
the scenario says). Ceilings are heuristic upper bounds: the best of the
situations and pieces probes found, not a proof. Known shortfalls, flagged
by efficiencies above 100%: payoffs that grow with what comes after them
(Si's burst records the team's damage in its window; Arcane's INT combo
explosion is set off by her battle skill), states no probe reaches (a
stackAtLeast buff, Link above what probes saw, reaction levels above what
one-stack situations give), and buffs whose value was fixed at another
applier's levels. JSON (`--json`): the whole report (steps, situations,
every probe, ceilings with bundles and achievers, chains with slack and
merges, the efficiency) for phase 3.

Measured (2026-11-15; full energy): the owner's team (examples/
estella-si-akekuri-arcane: 1,489 probes, 3.1 min; its WILL variant 1,799)
and Ink Melt (1,020 probes, 42 s); laevatain-solo 82 probes, 0.4 s. The
owner's chain — Akekuri's battle skill (Heat) → Arcane's combo (opens;
adds Heat) → Estella's battle skill (Cryo: Solidification of 2, sets up
both combo windows) → Estella's and Si's combos (opens) — is found,
315,557 in 2.5 s (124,562 a second; 3rd of 123 chains), merged with Si's,
Akekuri's and Arcane's ultimates as setups and Si's battle skill and
Estella's ultimate as fillers to 878,706. Best per second: the same with
Si's battle skill (Cryo) in Estella's place, 341,717 in 2.3 s (146,450 a
second). **But only with Arcane in WILL mode**: the example's builds (full
artifice assumed) put her INT just above WILL (484.4 against 473.5 at the
fight's start; the owner's in-game copy of a log's loadout was 472 / 473,
WILL), and in INT mode her combo adds no infliction and opens only on a
Nature reaction or two stacks, so the chain doesn't exist there
(tests/slow/payoffs-chains.test.ts checks a WILL variant, her accessories'
WILL version). The example's rotation (INT) reaches 40–77% of its big
casts' ceilings and plays none of the five-step chains (Arcane's battle
skill → combo 4 times). Settled the same day: the owner tunes her to the
most Intellect just below Will (472.44 / 473.50 with these pieces, WILL);
the examples and the test now use that build, and re-searched they gain
16.7% and 7.3% (3,835,505 and 3,226,208; the team page). Ink Melt's rotation: Laevatain's Twilight battle
skill 75%, Si's combos 96 / 88 / 63%, Laevatain's battle skills 59–77%;
one chain played twice (Si's battle skill → Wulfgard's combo); its best
chain (Si's battle skill → Laevatain's chain → Wulfgard's combo → Si's
combo, 236,234 in 4.4 s) merges with Laevatain's, Si's and Wulfgard's
ultimates as setups and Wulfgard's battle skill and Ardelia's ultimate as
fillers to 719,456.

*Phase 3: backward-built setups in the search* (2026-11-15). What phases 1
and 2 showed: the payoffs that matter come in short chains (2–5 s) tied by
combo windows and reactions, and their worth is mostly in what's around
them (the owner's chain alone 315,557; with three ultimates as setups and
two fillers 878,706); the forward beam drops these because a chain's first
steps deal little (Akekuri's battle skill 9,133). The bound is far too
loose to prune (below) and dominance fires a few times a search, so the
gain has to come from *what the beam can see*. Three parts and the share
of the beam they live in, each an option of the search (`efsim search`:
macros on by default, `--no-macros`; `--skeletons`; `--setup score|share`):

1. **Chains as macro actions** (macros.ts; `SearchOptions.macros`). The
   payoff table's chains (all of them: rank is for display) as a prefix
   tree of their steps (`macroTree`). At a node where a chain's first step
   is among the choices, `playMacros` plays the tree from the node's own
   state (so the probes run from arbitrary search states, not the planning
   fight's start): the first step at its choice's frame, each later one at
   its earliest (`runStep`; a combo tied by `opens` waits up to its 6 s
   window, which must have opened since the macro's first step, another
   step 3 s), and offers a child at every node where a found chain ends
   (two steps or more). Between steps of teammates the controlled operator
   basic-attacks while that doesn't move the next step's start (judged once
   for all of them: without it the controlled operator idled through every
   macro, and Ink Melt over 40 s fell from 3,120,118 to 2,399,719 at beam
   6). The child is the state after the last step, in that step's bucket:
   the beam ranks the state after the payoff. Its rotation is the plain
   actions, each with the frame it starts, which `simulate` replays
   (tests/planning.test.ts). Not in a loop's rounds (their `stopAt` needs
   every step). The macro hands back a copy of its last state: what the
   tree's deeper steps advanced it to is memoised on the state object, and
   a node holding it kept all of that alive (Ink Melt ran out of a 4.5 GB
   heap).
2. **The beam's extra share** (`prunePools`; `SearchOptions.extraBeam`,
   default half the width). Offered in the main beam, macro children
   crowded out the lines that set up later payoffs (Ink Melt over 40 s,
   beam 6: 2,399,719 against 3,120,118 before the fill). So a node whose
   rotation played a macro (or a skeleton's own action, or with
   `setupShare` any node the main share dropped) is kept in a share of its
   own, up to `extraBeam` more a layer; the main share is exactly the
   search without them (its nodes, its pruning, only the narrower width's
   guide keeping a place). With the same guide the search therefore finds
   at least as much at the same width; across `searchBeams`' widths the
   guide itself changes (the wider width is guided by what the narrower
   one found with the share), so that isn't guaranteed there (skeletons on
   Ink Melt, below). The share's children waiting in a later bucket are
   cut to the best 4 × its width once they're twice that (a macro lands up
   to seconds ahead; the main share's are never cut early).
3. **Skeletons as guides** (skeleton.ts; `searchBeams` `skeletons`,
   `SearchHooks.guides`, `incumbent`). Items: every chain and each
   measured chain merged with its setups (before) and fillers (after the
   chain step each follows). A skeleton is a greedy rollout from the
   fight's start: at each decision every choice the search would have and
   every item whose first step is one of them (played as a macro) is valued
   by what it adds to the state's worth (committed damage plus the
   resources at their probed prices × the value weight, so what a cast
   spends is charged at the resources' price) per second it takes (to its
   last step's start, plus half a second), and the best is played; the
   i-th skeleton takes the i-th best option at the start (3 by default).
   Played in the engine as it's built, each step as soon as it's legal
   (waiting for its window, SP or energy), a skeleton is already repaired:
   the loop's moved-later replay isn't needed. The guide becomes a list:
   each guide keeps a place in the beam (the last places, in the guides'
   order; one guide is exactly the old rule); where a skeleton's next
   action isn't among a node's choices it's added to them (a skeleton waits
   where the search's choices wouldn't); nodes that left the main share's
   guide to follow a skeleton are in the extra share. The best skeleton's
   damage is the bound's incumbent. The skeletons themselves are weak
   (greedy: 60–80% of the search's results); what they add is the extra
   share's lines along them.
4. **A setup-aware value** (setupvalue.ts; `SearchOptions.setup`,
   `setupWeight`, `setupShare`). From the ceilings: each damaging step's
   bundle pieces and their worth (what the ceiling loses without each). A
   state's score adds, for each piece it holds (a buff instance active, a
   reaction or physical status, Vulnerable or Link stacks; a lower level or
   fewer stacks in proportion), its worth to the best payoff that can still
   be cast before the piece ends (cooldown, SP with regeneration, energy,
   and its availability now), plus a combo's bare damage while its window
   is open and it's off cooldown; × the value weight, tapering over the
   last 10 s as the resources do. A piece counts once (the best payoff),
   and a buff of the payoff's own operator doesn't count (its own sequence,
   which the resource value prices through its casts in progress:
   Laevatain's Twilight for her enhanced attacks): summed over every ready
   payoff, the first version reached 357k at 2 s of Ink Melt's example
   rotation (the resources' 81k) and sent the beam into early ultimates.
   `setupShare`: the value ranks only the extra share.

Measured (2026-11-15; 60 s, guided beams 12 / 24 / 48 as `efsim search`
runs them; each cell the three widths' totals, then the run's seconds:
table (payoff probes, and skeletons) + the three widths; four such jobs at
a time on the 4-core machine, which other sessions shared, so times are
comparable within a row only roughly):

| example | without (as before) | macros (the default) | skeletons | setup value in the score |
|---|---|---|---|---|
| owner's team, full energy | 3.33M / 3.33M / 3,835,505; 1,722 s | **3,918,666 / 3,918,666 / 3,922,576**; 267 + 417 / 774 / 1,442 s | 3,527,197 / 3,616,937 / 3,725,740; 330 + 371 / 717 / 1,334 s | 3,215,303 / 3,242,469 / 3,309,886; 235 + 197 / 462 / 789 s |
| owner's team, zero energy | 2.50M / 2.53M / 3,226,208; 1,596 s | **2,502,659 / 2,581,516 / 3,394,218**; 281 + 350 / 662 / 1,081 s | 2,502,659 / 2,758,499 / 3,397,119; 272 + 277 / 506 / 836 s | 1,829,952 / 2,137,125 / 2,137,953; 223 + 180 / 361 / 589 s |
| Ink Melt, full energy | 3,496,392 / 3,504,192 / 4,411,886; 137 / 274 / 590 s | **4,479,156 / 4,620,703 / 4,689,365**; 11 + 522 / 998 / 2,313 s | 3,496,392 / 3,610,514 / 3,661,634; 32 + 208 / 472 / 908 s | 3,644,528 / 4,013,440 / 4,013,440; 13 + 147 / 349 / 605 s |
| Ink Melt, zero energy | 1,796,863 / 2,993,557 / 3,841,514; 100 / 262 / 529 s | **1,820,477 / 4,320,354 / 4,601,305**; 23 + 630 / 1,014 / 1,670 s | 2,540,005 / 3,729,608 / 3,909,985; 31 + 165 / 309 / 885 s | 3,001,627 / 3,001,627 / 3,160,093; 18 + 128 / 272 / 571 s |

The owner's team is Arcane in WILL mode (her accessories' Intellect
artifice at 0: Intellect 472.44, Will 473.50, the owner's build); its
"without" column is the plain `efsim search --beam 24` that searched its
example rotations (commit 30850ad, another job mix; the narrower widths'
totals as rounded there). Before the build
was corrected the same parts were measured on the INT build (full
artifice) and on a WILL variant (the accessories' WILL version), with the
same pattern: macros better at every width (INT full energy 3,286,029 →
3,430,236, from zero 2,973,678 → 3,010,131; the WILL variant 3,356,828 →
3,504,173), the setup value better on the WILL variant (3,697,570) and
worse from zero (2,903,988), skeletons best on the WILL variant
(3,755,026, playing the owner's chain with Si's battle skill twice).

**The owner's team order (2026-11-15, after the table).** The table's
owner's-team rows had Estella in slot 1, so Si's battle skill inflicted
Cryo; the owner's order puts Akekuri in slot 1 (Heat). Re-measured with
that order (same build, same widths, four jobs at a time): plain 3,135,336
/ 3,344,984 / 3,360,158 full energy and 2,313,225 / 2,319,339 / 2,604,968
from zero; macros 3,444,884 / 3,444,884 / 3,486,730 and 2,949,334 /
2,962,844 / 2,982,948; skeletons (without macros) **3,353,446 / 3,990,122
/ 3,990,122** and **2,416,632 / 2,692,055 / 3,263,818**, the examples'
rotations now. Macros still beat the plain search at every width, but
settle early (spreads 1.2% / 1.1%); skeletons win both energies here.

**Decisions.** Macros found more at every width on every example. At
equal run time they win with full energy (their w/2 alone, table
included, beats the search without them at 2w: 3.92M in 684 s against
3.84M in 1,722 s; 4.48M in 533 s against 4.41M in 1,001 s) but lose from
zero energy, where the search without them reaches its best only at 2w
and macros have by then finished w/2 and w (the owner's team 2.58M
against 3.23M; Ink Melt 1.82M against 3.84M). They are `efsim search`'s default
(`--no-macros` for the search before; the engine's `SearchOptions.macros`
stays opt-in, so the pinned tests and loops are unchanged). The cost is
1.6–3.8× the time a width (the extra half-beam of nodes, and the macros
played at each node: on Ink Melt 145 ms a state against 57). Skeletons
and the setup value stay opt-in: each made examples worse (skeletons both
full-energy fights, Ink Melt 3.66M against 4.41M and the owner's team
3.73M against 3.84M: the wider widths' guide changes with the share,
above; from zero they found the owner's team's best, 3,397,119; the setup value in the score Ink Melt both energies and the
owner's team both energies, from zero by a third: it still overvalues
holding a piece over casting). Macros and skeletons together did worse than macros alone on the
owner's team (3,675,264 / 3,766,856 / 3,771,274 with full energy,
2,502,659 / 2,525,620 / 3,228,589 from zero: one extra share split
between them). The setup value's share variant (`setupShare`) is
implemented and tested but wasn't measured at 60 s.

### Pruning the search

Two prunings on the beam search (`SearchOptions.dominance`, `.bound`;
`efsim search --prune` turns both on; off by default).

**Dominance** (`dominatesState`, stateKeyer `amounts`): of two states of a
layer with the same key but for SP, returned SP and ultimate energy, drop
one if the other has at least as much committed damage, SP and every
operator's energy and no more returned SP. Exact for the fight: nothing
reads SP or energy but the gates (enough SP, enough energy) and the energy
a spend gives (natural SP: cost less returned SP); every gain is a capped
sum (min(cap, x + g) keeps the order), SP events carry the nominal amount,
`clearEnergy` sets both to 0; so every rotation legal from the dominated
state is legal from the other at the same frames and deals the same from
there (tests/payoffs.test.ts plays a found rotation from a state with 100
SP more, at the poorer state's frames). Caveats: the search offers only
the soonest actions, so the richer state's choices can differ from the
poorer's (an SP-gated skill becomes the soonest); a state on the guide's
line is never dropped (the wider beam's guarantee); one battle only (no
random outcomes). It fires rarely: paths that differ in SP nearly always
differ in what's scheduled, cast or held too (none in laevatain-solo at
beam 24 or si-laevatain at 12; 0–5 states a beam below).

**Branch and bound** (`upperBound`, `remainingBound`, bound.ts): drop a
child whose committed damage plus a bound on what it can still add is
below the most committed damage found so far (a rotation that stops acting
deals exactly its committed damage, so that's reachable). The bound is an
LP relaxation: every step at most its ceiling per cast (the largest of
`dealt` and every hit's difference, bare or under the bundle), and only
casts that start before the fight's end less the step's first effect;
battle skills and chains hold their operator for their busy frames
(operators in parallel, a fractional knapsack each); combos and ultimates
count by cooldown only (they may cut into other actions); team SP is what
the state has plus 8 a second, each cast using its cost less the most SP
its probes gave back; a Lagrangian over SP (min over λ of λ × SP plus the
knapsacks at value − λ × net SP; any λ ≥ 0 bounds the relaxation); × (1 +
the highest recording rate, Si's Artful Intent). Admissible only as far as
the ceilings are (above): states on the guide's line are never cut, and
those under the bound while the guide's own damage would beat the best so
far are counted (`boundMisses`: none measured). Ultimate energy isn't
bounded, only cooldowns. Tests: committed + bound ≥ what the rotation
reaches from there at every state of beam 48's and beam 6's rotations
(laevatain-solo, 15 s); the search finds the same or more with it at the
same width.

**The bound is too loose to prune.** Along Ink Melt's example rotation it
is 2.7–3.8× the damage actually still to come (10.2M at the start against
3.7M; 2.1M at 49.3 s against 0.76M), while the states a layer keeps are
within a few percent of each other: it cuts only children in the last
seconds, 0.0–0.4% of them. Tightening it would need bounds the probes
can't give admissibly (ultimate energy from SP and grants, how often a
battle skill's ceiling bundle can really be on), so it stays as it is.

Measured (2026-11-15, 60 s, guided beams 12 / 24 / 48 as `efsim search`
runs them, two jobs at a time on the 4-core machine; score, states
expanded and seconds per beam, before → with dominance and the bound; the
bound's table is the payoff probes without chains; measured before the
bound counted only casts that start in time to do something, which lowers
it by up to 5% early in the fight and most in its last seconds):

| example | beam 12 | beam 24 | beam 48 | dominated / bounded (12, 24, 48) |
|---|---|---|---|---|
| owner's team, full energy | 3,232,373: 2,871 / 161 s → 2,871 / 163 s | 3,273,371: 5,749 / 322 s → 5,729 / 311 s | 3,286,029: 11,709 / 715 s → 11,663 / 690 s | 0, 2, 2 / 0, 18, 45 (table 155 s) |
| owner's team, zero energy | 2,797,948: 2,581 / 122 s → 2,578 / 126 s | 2,808,913: 5,203 / 252 s → 5,173 / 249 s | 2,973,678: 10,925 / 564 s → 10,921 / 488 s | 6, 12, 2 / 1, 14, 4 (table 147 s) |
| Ink Melt, full energy | 3,496,392: 2,391 / 136 s → 2,391 / 147 s | 3,504,192: 5,057 / 298 s → 5,052 / 296 s | 4,411,886: 10,438 / 661 s → 10,427 / 636 s | 0, 0, 5 / 0, 5, 11 (table 14 s) |
| Ink Melt, zero energy | 1,796,863: 2,086 / 96 s → 2,074 / 105 s | 2,993,557: 5,442 / 231 s → 5,418 / 259 s | 3,841,514: 9,693 / 524 s → 9,549 / 523 s | 0, 0, 0 / 15, 25, 42 (table 16 s) |

The found rotations and totals are the same with and without pruning at
every beam; the states saved (≤ 0.5%) are within the machine's timing
noise, and the bound's table costs 14–16 s (Ink Melt) to 155 s (the
owner's team) on top. Dominance and the bound stay off by default; what
the beam needs is to see setups, not to cut more (phase 3, above).

### Gear from the logs

`efsim gear <scenario.json>` (packages/cli/src/gear.ts, 2026-11-15; the
owner: different teams do best with different gear, so try every common
setup). Until a real gear search exists, it picks each operator's gear
from loadouts players actually run:

- **Candidates** per operator: the scenario's own loadout; the distinct
  loadouts (four piece IDs as logged) in the log fixtures (fixtures/,
  pending/, multi-target/; hold-out logs are left out: they're only
  measured), seen at least `--min-count` times (default 2), at most
  `--top` (default 6), ordered by how many of the scenario's teammates
  the log also has (the whole team first), then by count; and loadouts
  from `--candidates file` (`{"candidates": [{operator, gear, source}]}`:
  guide sites, screened logs not imported), each citing its source. One
  loadout from several places is one candidate with every source.
- **Score**: the scenario's rotation replayed with only that operator's
  gear swapped (pieces at full artifice; the scenario's own loadout as
  it is). Where steps of the rotation can't be played with it (a
  finisher whose Stagger now comes later, a combo whose window didn't
  open, an ultimate whose energy now comes later: EngineError), the
  **repaired replay** (2026-11-15): the rotation played in order from the
  state the kept steps left, each step that fails started at the first
  of 0.33–2 s later that works, else kept waiting and tried before each
  later step (an ultimate's energy may come from them), else up to 15 s
  after the last step, else dropped; if at most `--repairs` (default 20)
  steps fail, it's scored against the current loadout's replay: a lower
  bound for the candidate, which plays a rotation made for other gear
  late; taking it takes that rotation. Why (the owner's team): its
  rotation hinges on Stagger and energy timing, so almost every other
  Akekuri, Si or Estella loadout moved Estella's finisher past the
  Stagger or Si's second ultimate past its energy, and the narrow
  searches, 20–30% under the beam-48 skeletons rotation, decided the
  whole ascent: a +0.1% searched "gain" for Akekuri swapped the rotation
  and every later score was on the weak one (−17% overall). With repairs
  the ascent stays on the owner's rotation. A moved or dropped step can
  make later ones fail too (Si without her Ultimate Gain gloves: 2 steps
  later, 5 dropped), so a repaired score can be far below what a rotation
  made for that gear gets. With more failing steps, a
  narrow search (`--search-beam`, default 12, no macros) gives its score instead,
  compared with the current loadout's own narrow search, never with a
  replay (a first version compared them directly: a beam-6 search's
  rotation beat the beam-12 one it was compared with, and a loadout won
  for the search's sake). Narrow searches are noisy (two beam-6 searches of
  one team differed by 50% from zero energy), so a searched winner wants
  a proper search of its own before it's trusted; taking a searched loadout takes its search's
  rotation too. A replayed score favours the gear the rotation was
  searched with, so a candidate's total is a lower bound for it.
- **Coordinate ascent**: each pass takes every varied operator's best
  candidate with the others fixed (ties keep the current one), until a
  pass changes nothing (`--passes`, default 4). `--keep <operator>` holds
  one fixed (the owner's Arcane); for an operator whose mode two
  attributes decide (Arcane's Intellect / Will), the kept operator's
  candidates are listed with the pair, to see which would change the mode.
- **Output**: a table per operator (each candidate, sources, logs by
  teammates, team total, against the chosen one); `--out` writes the
  scenario with the chosen gear and the rotation (repaired or searched
  where a chosen loadout took one). A full search with the chosen gear
  comes after (it may find a better rotation for it; on the owner's team
  and Ink Melt, 2026-11-15, the searches with the new gear found less
  than the old rotation replayed with it: the search is chaotic, a small
  change in the team sends the beam elsewhere, so keep the better of the
  two).

### Rule-based rotations

`efsim rules <scenario.json> <rules.json>` (engine `playRules`, policy.ts;
the search `searchRules`, policysearch.ts; CLI rules.ts; 2026-11-16).
**Why** (the owner, who plays daily): a rotation is only useful if a
person can learn and play it. The search's fixed frame timelines are
hard: timers in your head are hard, and a loop that's a little different
each time is too complex to learn; guide sites' rotations often last over
a minute and must be restartable. The easiest rotation to learn: a couple
of skills that get things started, then reacting to combo skills lighting
up, either casting the combo at once or pre-empting it with an extra
battle skill first. So a rotation here is a **short opener plus a
priority list of rules "when cue X is visible, do Y"**, played by a
simulated player with a reaction delay and measured by sustained DPS over
a long fight. Rules adapt by themselves when gear changes timing (no
repair needed), which later makes gear comparison cheap.

**Cues, ranked by the owner (2026-11-16), easiest first:**

1. A combo skill lighting up (by far the easiest).
2. Typhoeus's Hunting Arrows and Signs (very easy); SP and how many
   battle skills are ready (easy).
3. Inflictions and vulnerabilities on the enemy (relatively easy, shown
   on the enemy).
4. An ultimate being ready (harder: it's in the corner of the screen).
5. Counting Final Strikes (takes practice, doable).
6. A combo skill's cooldown status (visible, but the owner isn't used to
   looking at it).
7. Anything needing a timer in your head (hardest; avoid, or count
   heavily against).

Rules may read only what the game's UI shows: the list above, plus a few
operator states without buff icons, each for a reason
(`POLICY_VISIBLE_BUFFS`, ranked with 3): Typhoeus hovering (she's in the
air), Laevatain's Twilight (her ultimate's form; the battle-skill button
changes), Liino's Vocalist Stance (the button becomes End Stance), Si's
Artful Intent and Inksoul (the button becomes Initial / Final Stroke).
Visible stacks (`POLICY_VISIBLE_STACKS`) are Typhoeus's arrows and Signs
only; any other stack or buff in a rule is refused.

**The format** (schemas/rules.schema.json; examples/*.rules.json, one per
team next to its scenario):

```json
{
  "opener": [{ "operator": "Si", "cast": "battle" }],
  "rules": [
    { "when": { "combo": "Arcane" }, "do": [{ "operator": "Estella", "cast": "battle" }, { "operator": "Arcane", "cast": "combo" }] },
    { "when": { "all": [{ "sp": { "atLeast": 100 } }, { "not": { "status": "solidification" } }] }, "do": { "operator": "Si", "cast": "battle" } }
  ],
  "filler": "basic"
}
```

- *Presses* (`cast`): an operator's `battle`, `combo` or `ultimate`
  button, resolved to the skill the button casts then (Si's battle skill
  is Artful Intent, then Initial and Final Stroke; Arcane's ultimate is
  her array, then sequence 2; Liino's battle skill ends her stance while
  she's in it); the controlled operator's `dive`, `basic` (whatever the
  attack input is then) or `finisher`. Operators by ID or by the name the
  game shows. **No swaps** (as the search's default): the scenario's
  controlled operator does every basic attack, dive and finisher.
- *Cues* (`when`): `combo` (lit: off cooldown, its window open,
  available; rank 1), `stacks` and `sp` (2), `infliction`, `status`
  (reaction and physical statuses), `vulnerable`, `staggered`, `buff` (3),
  `ultimate` (4), `finalStrikes` (the controlled operator's since the rule
  last fired; 5), `comboCooldown` (6), `since` (seconds since an
  operator's last press of a button: a timer; 7), and `all` / `any` /
  `not`.
- *Rules* are ordered; `do` is one press or a short sequence (at most 3:
  "battle skill A, then combo B"). *Opener*: a few presses played first.
  *Filler*: what the controlled operator does when no rule fires, its
  basic attacks (default) or dives.

**The driver** (`playRules`): frame by frame on the timeline (init /
advance / startsNow / apply, as the search and `simulate` use: no fork of
the damage model), the state advanced to the frame:

1. The opener's presses in order, each at the first frame it can start
   (no reaction delay: planned), basic attacks in between; a press that
   can't start within `waitSeconds` (6 s) is given up. No rule fires
   before the opener is over.
2. Then the first rule whose cue the player has seen for its **reaction
   delay** and whose first press can start now. The delay is drawn when a
   cue appears (onset): 0.3 s by default (`--reaction`; 0: a bot),
   uniform within ±50% (seeded; common random numbers, below). A rule that fired sees
   its own cue afresh (a new delay) before firing again. A rule whose
   cue holds but whose press can't start yet doesn't block the rules
   after it. A rule's later presses play as the opener's (each as soon
   as it can start, a combo waiting for its window, up to 6 s), and no
   other rule fires meanwhile.
3. Else the filler: the controlled operator's basic attack as soon as it
   can start (a finisher first when the enemy is Staggered, as the game's
   attack input does: no delay), or its dive.

A dive starts only once the current skill is past its exclusive frames,
as the search dives. Several presses may start at one frame. "Can start
now" is startsNow on the state advanced to the frame **and**
earliestStart from the state right after the last press, with the
frame as `at`, giving that frame; the press is applied to that state.
So everything pressed is recorded with its frame and `simulate` replays
that rotation to the same hits (tests/policy.test.ts). The second check
matters: startsNow on the advanced state allowed Typhoeus's battle skill
48 frames before earliestStart from the last press did (after a dive,
whose landing replaces its jump), and the replay would have cast it
later. Speed: the basic attack's
options are judged from their earliest start after the last press
(exact while nothing is pressed; `judgeEveryFrame` checks it), about
1–2 s per 300 s fight for the owner's team, 3–5 s for Typhoeus's.

**Learnability** (`learnability`): opener presses, rules, the rules'
presses and their **cue cost**: each cue part costs by its rank (1, 2, 3,
then 5, 6, 7 for ranks 4–6, and 20 for a timer), a combination the sum of
its parts; `complexity` = opener presses + rule presses + cue costs, the
one number the search trades DPS against. The report gives each rule's
cost and the hardest rank used.

**Common random numbers** (2026-11-16): the delay of rule i's k-th cue
onset (a rule firing counts as an onset: it sees its cue afresh) is a
function of (seed, the rule, k) only (`policyDelay`), the rule known by
its cue and presses (`ruleDelayKeys`; among identical rules, by its place
among them), not by its index or the order other rules drew in. So two
runs of a list with a little different gear, or two lists that differ in
one rule, see the same delays wherever their cues' onsets line up, and a
difference measured on common seeds is mostly the change's. Measured on
the owner's team (300 s, 10 seeds; sample sd of the per-seed
difference): Estella's gear swapped for the logs' loadout, 64 with common
seeds against 4,006 with independent ones (the old shared stream already
gave 76 here: the gear didn't change the order of draws); two rules
swapped (Akekuri's combo rule above Si's), 1,097 against 3,174 (the old
stream: 3,836, its draw order changed). Every list in the rule search is
scored on the same seeds 1…k. Stratified draws (a Latin hypercube per
(rule, onset) over the seeds) were tried and dropped: over 20 replicates
of 5 seeds the sd of the mean was 1,029 plain against 997 stratified for
one list, 1,238 against 828 for another, and 467 against 597 for their
difference: no clear gain (a chaotic response isn't additive in the
draws).

**Crits as a distribution** (2026-11-16): crits don't change the
timeline (but crit-triggered effects, below), so each run's sustained
DPS is a distribution over its hits' crits, from each hit's chance
(`PolicyRun.sustainedMoments`, moments.ts as for `efsim simulate`); the
runs (seeds) combine by the law of total variance (`policyDistribution`):
mean of means, variance E[σ²] + Var[μ], and the 5th / 95th percentiles of
the mixture of each run's normal approximation. The report splits the sd
into the reaction delays' (sd of the runs' means) and the crits' (√ of
their mean variance). With a crit-triggered effect in the team
(`critTriggers`) the battle plays crit mode `distribution` (the crits it
reads rolled, seeded with the delay's seed) and says so. This replaces
the rolled-crit runs. On the three teams the crits' sd is 350–380 DPS,
the delays' 550–2,900: the delays dominate.

**The report**: sustained DPS after the opener over a long fight (300 s
default, `--duration`), mean and spread over 5 reaction-delay seeds with
expected crits, and the distribution over delays and crits; the whole fight's total, damage per minute, the first 60 s
(comparable with a 60 s timeline under the same start); **robustness**:
sustained DPS as a bot (delay 0), at the default delay and at twice it;
which rules fired how often; presses given up; shares; and the
scenario's own rotation simulated as the reference.

**The rule search** (`efsim rules … --search`, `searchRules`): local
search from the given list. Edits: add a rule (mostly the natural ones:
a lit combo cast, a ready ultimate cast, a lit combo pre-empted by a
battle skill; else a random cue and press), remove one, swap two
neighbours, change a cue, add or drop a condition (`all`), negate a cue,
move a threshold (SP by 50, stacks by 1), add, drop or change a
pre-empting battle skill, change a rule's first press, change the
opener, toggle the filler; cues from what the team's UI shows, no
timers. Each list is played at the default delay over 2 seeds in a 180 s
fight (`--search-seconds`, `--search-seeds`), scored by mean sustained
DPS; every list scored is kept. A parent is the best so far (DPS less
0.2% a complexity point, `--penalty`) 60% of the time, else a list from
the Pareto front of DPS against complexity; one or two edits a child.
The report: the front (up to 8 lists, `--front`) scored again over the
whole fight, each in plain words, and the best of them by the penalised
score in full; `--out` saves it. 150 lists (the default) take 5–6 min
per team (three teams at once on four cores); 200 lists at 3 seeds and
240 s, 16–20 min.

**Noise.** The fight is chaotic for the driver too: a different
reaction-delay draw moves where Stagger windows, combo triggers and
ultimates fall, and a list's sustained DPS has a standard deviation of
1–5% over seeds (the owner's team 1,402 of 57,096 at 10 seeds). That is
as much as most single edits gain, so at 2–3 seeds the search often
kept a lucky list (before common random numbers: on the owner's team
every "gain" it found vanished at 10 seeds; with them a difference's
noise is a third, but a list's own level still moves). Judge a list at
10 seeds (`--seeds 10`) before taking it; the
bot (delay 0, one run) is one sample of the same noise, sometimes below
the 0.3 s player. Gains that held: Ink Melt +28%, Typhoeus's team +16%.

**Results** (sustained DPS over 300 s, 0.3 s delay, 10 seeds, common
random numbers (2026-11-16; the numbers before them, with the old shared
stream, were within the seeds' spread of these); each team page's
"Rules" has the list in plain words):

| Team | Full energy (sd) | From zero (sd) | First 60 s against the 60 s timeline (full / zero) | 300 s total against a fixed 300 s search (beam 6) | Complexity |
|---|---|---|---|---|---|
| The owner's (hand-written; Artful Intent runs its 20 s, 2026-11-16) | 57,096 (1,402) | 55,394 (553) | −9.3% / −7.8% | +22.4% | 44 |
| Ink Melt (searched) | 65,922 (1,750) | 61,962 (2,916) | −25.3% / −44.6% | +20.5% | 38 |
| Typhoeus, Arcane, Liino, Perlica (searched; Perlica's gear of 2026-11-16) | 52,561 (1,913) | 49,964 (1,005) | −30.9% / −46.1% | −6.8% | 47 |

The 60 s timeline is the upper reference for a 60 s window, not
sustained DPS; the fixed 300 s search (the scenario at 300 s, full
energy, beam 6, no macros: 34 min for the owner's team) is the sustained
one. The opener-and-loop searches (`--loop --sync`) take hours per team
(44 min to 5 h in their measurements) and weren't run again; their old
loops for the owner's team (INT build, other team order) aren't
comparable.

#### Diagnosis, marginal values, gear on rules (phase 2, 2026-11-16)

The owner: find the inefficiencies in how a team plays, then the gear
that fixes them (too much Ultimate Gain Efficiency on a main damage
dealer whose ultimate comes faster than the supports' it needs is a gear
line that could have been damage).

**`efsim diagnose <scenario> <rules.json>`** (CLI diagnose.ts; engine
policydiag.ts `diagnoseRules`, a frame-by-frame observer of `playRules`
that never changes the run). A separate command rather than a section of
`efsim rules`: it plays ~300 runs for the marginal values (workers), and
`efsim gear --rules` reuses it whole. Over 5 seeds (`--seeds`), averaged:

- per operator: damage share; ultimate energy gained (after efficiency,
  before the cap; by source: SP spent, own hits, each kit trigger),
  spent, wasted at the cap and held at the end (start + gained = spent +
  wasted + end; engine statistics `energyGained`, `energySpent`,
  `energyOverflow`, read by nothing in the fight); ultimates per minute
  and seconds ready but not cast, by why: within a rule's reaction delay,
  behind other presses (the rule's cue was seen: another rule came first,
  a skill still acting, a sequence playing), held by the rule's condition
  (the list presses it, but that rule's cue didn't hold), or no rule for
  it; combos per minute and seconds lit but unused; battle skills per
  minute; damage by element, kind and while Staggered;
- team SP: seconds at the cap, SP lost to it by regeneration and by
  grants (`spOverflow`);
- the main damage dealer (most damage): other operators' buffs on its
  hits (from each hit's modifiers: the share of its damage, and of its
  ultimate's, each applied to; uptime on it) and the enemy's states
  (Vulnerable, inflictions, statuses, Staggered: uptime, share of its
  damage and ultimate damage landed under them);
- sustained DPS as a distribution (mean, sd split delays / crits, 5–95%).

**Marginal values**: per operator, the team's sustained DPS with one
gear-line-sized step more of each stat gear offers, paired on common
seeds (4, `--marginal-seeds`, 16 for noisy ones) with the diagnosis' runs: (probe − base) /
base, ± the per-seed differences' sd / √n. The steps are the game's T4
gear lines at full artifice (each kind's median size: main attribute
+71, secondary +48, other attributes +55 / +75, main attribute +26.9%,
secondary +23%, Crit Rate +13.5%, Ultimate Gain Efficiency +26.7%, Arts
Intensity +45, element DMG +24.9–29.9%, Battle Skill DMG +44.8%, Combo /
Ultimate DMG +35.9%, Basic Attack DMG +29.9%, DMG to Staggered +53.8%;
healing, HP and damage-taken lines left out), worn as a fifth synthetic
piece (`probe:<attr>:<slot>:<target>`) so the panel goes through the
same stat code, plus reference steps for what only sets and weapons give
(ATK +10%, flat ATK +20, Crit DMG +10%). An element's, skill kind's or
Staggered bonus is measured only for an operator with such damage. A
value is "noise" within two standard errors or under 0.1%. Damage-only
steps don't move the timeline, so on common seeds they're exact to
±0.1%; steps that move it (Ultimate Gain Efficiency, an attribute that
flips a mode) don't line up with the base's events and stay at ±1–2% at
4 seeds: those with a standard error over 0.25% get 16 seeds
(`DiagnoseOptions.marginalMaxSeeds`; ±0.6–1.3% then). Findings in
plain words follow from these: an ultimate held or energy wasted while
its efficiency is worth ~0; an ultimate energy bottleneck (efficiency
worth something); no rule for an ultimate; combos lit but unused; SP at
the cap; the main damage dealer's ultimate landing outside a support's
buff; each operator's best line.

**`efsim gear <scenario> --rules <rules.json>`** (CLI gearrules.ts):
loadouts scored by sustained DPS from playing the list (8 seeds by
default here, common random numbers, 300 s), coordinate ascent across
operators as `efsim gear` does, a change taken only when its paired gain
is over twice its standard error. Candidates per operator: the logs' and
a candidates file's (`gearCandidates`), plus two kinds from the
marginal values: **swaps** (one piece for another T4 piece of the same
part that keeps every active set, ranked by the lines' predicted worth,
linear in their sizes, the best 4 a pass) and **set builds** (each set's
best three or four pieces by the lines' worth, the rest the best piece
of any set; all screened by play on 2 seeds, the best 2 per operator
kept: a set's effect is in no marginal value). A gain whose standard error is over 0.25%
(a change of timing) gets 16 seeds before it's taken. The chosen gear is
checked against the start on 8 fresh seeds (1001…), since the ascent's
best-of-many gain is biased up (Ink Melt: +7.3% in the ascent, +2.1% and
+3.9% on fresh seeds). A loadout that flips a mode decided by two
attributes (Arcane's Intellect / Will) is flagged. Then the diagnosis
again with the chosen gear, what changed per operator, and which findings
went away or came; `--out` writes the scenario with the chosen gear (the
timeline rotation kept, which a loadout that moves ultimates may not
play: `efsim rules` then reports no reference).

Results (2026-11-16, each team page's "Gear"): the owner's team +8.0% ±
0.9 on fresh seeds with three changes (Estella's Grizzled Edge loadout,
the one the owner's example describes: her efficiency worth ~0, Arts
Intensity +5% a line; Si's logs' LYNX Slab loadout; Akekuri's Fiber
Gloves: more efficiency for a bottleneck support), examples kept; Ink
Melt +3.9% ± 1.0 (Wulfgard's efficiency, a bottleneck) but −1.5% on the
60 s timeline, example kept; Typhoeus's team +0.9% (Perlica, damage only,
example changed) and +5.9% for Arcane in INT mode (the owner's call). A
60-list rule search on the owner's new gear found no better list. Runs go to worker
threads (rulespool.ts; each loads the game data once, ~15 s).

#### The guided rule search (2026-11-16)

The owner: "Our rule search needs a similar approach as the one that
worked for precisely timed workflows: we put together ideal combos and
seek to change the rules in directions that can get closer to achieving
the optimal damage output." The random rule search (above) never found
the edits found by hand the same day (Si's ultimate held for
Laevatain's Twilight; Si's battle skill only when her button shows it;
Liino's stance rule with `shows` and a Cosmovoice cue): each is one
structured change aimed at one missed multiplier or one changing button,
and a random walk over cues and presses rarely makes it.
`efsim rules <scenario> <rules> --guided` (engine policyguide.ts, CLI
guided.ts; a flag of `rules` because it takes the same inputs and gives
a list, as `--search` does):

1. **Ideal combos** (`guideRules`, an observer of `playRules` that never
   changes the run, then the run's hits). A **window** is an operator's
   skill family (its skills without the step number: Laevatain's Twilight
   attacks 1–4 are one window, Typhoeus's hover shots 1–5 one; a reaction
   kind one) with at least 2% of the team's damage, its **occurrences**
   its hits in clusters (a gap over 3 s starts the next). A
   **multiplier** is what a modifier on a window's hit comes from: a kit
   buff (`owner:id`, which covers team buffs, Amps, debuffs,
   Susceptibility and DMG Taken, weapon and set effects), Stagger's ×1.3,
   a reaction or physical status (Corrosion, Electrification, Breach);
   not the stat panel, a finisher's or Link's. Its **giver** is the press
   that created the buff: its owner's latest cast at or before it, by
   kind (Si's Amp ← Si's ultimate). The window's **ideal combo** is every
   multiplier the team puts on that window at least once, on every hit
   (Stagger always); a missing multiplier's **loss** is what the hits
   without it would gain with it: its modifiers as they were on a hit of
   the same kind (the same hit ID, else any of the family) added and the
   zones recomputed from the hit's modifiers (`withModifiers`: damage
   bonus, Amp, Susceptibility, DMG Taken as 1 + Σ, the multiplicative
   zone as a product, ignored resistance into the resistance zone, the
   crit zone at its expected value, ATK % into ATK with the panel's base;
   attribute points and Arts Intensity are left as they were, ×1). All of
   a window's missing ones at once give its ideal; actual / (actual +
   ideal gain) is its **achievement**. Fixed damage (Si's recorded burst)
   takes no modifiers and is skipped. An upper bound, not a plan:
   multipliers' uptimes and cooldowns aren't checked (Stagger on every
   hit can't happen).
2. **Measured over a long fight**: the same seeds as the candidates
   (common random numbers), per (window, multiplier): its presence (the
   share of the window's damage it was on), its factor when on, the DPS
   lost without it, its giver; per window the **visible cues** at each
   occurrence's start (the frame before its cast) against how often each
   holds over the fight (its lift): Laevatain's Twilight attacks come with
   "Laevatain is in Twilight" (100% of their starts, 34% of the fight).
   Team SP at the cap too.
3. **Directed edits** (`guidedEdits`) for the biggest losses (six
   (window, multiplier) pairs a round), each a player can follow by a
   visible cue (the owner's ranking):
   - *hold the giver*: the rules pressing the multiplier's giver wait for
     the window's cue (held at ≥ 60% of its starts and 1.3× as often as
     over the fight; no SP level), alone or "or the window operator's
     ultimate is ready";
   - *chain*: "when both ultimates are ready: the giver's, then the
     window's" as a new first rule, alone and with the giver held;
   - *start the window when the multiplier is up*: the rule that starts
     the window (its own button; for basic attacks under a visible state,
     the press that gives the state: Laevatain's ultimate for Twilight,
     Typhoeus's battle skill for her hover) waits for the multiplier's
     visible cue: Stagger (Staggered, the bar at 70%), a status, a
     visible operator state (Liino's Cosmovoice), else the giver's
     ultimate being ready;
   - *save SP* for an SP-gated window: other operators' battle skills
     wait while its visible state holds;
   - *`shows`* on each press of a button that changes;
   - *spare SP* (SP at the cap over 3% of the fight): a last rule spends
     200 SP on a battle skill;
   - *move up* the giver's rule; and four of the random search's moves as
     a complement.
   The giver of a window's own operator counts only for its ultimate on a
   window its ultimate doesn't start (Si's Amp on her combos).
4. **Judged by play** (`judgeEdit`): every candidate on seeds 1–6
   (300 s), the best four by that gain on 1–32, close calls (over 1.2
   standard errors, not 2) on 1–64 with the base; kept when the paired
   gain is over twice its standard error and 0.2%, and positive on the
   seeds after the screening six alone (picking the best screened edit
   biases those six up); among several, the best by gain less 0.2% a
   complexity point (the others are reported as Pareto alternatives).
   Then the analysis again on the kept list's runs, and the next round,
   until nothing clears the bar (a round that keeps nothing is followed
   by one aimed at 14 losses, with pairs of the best screened edits that
   change different rules merged); finally the start and final lists on
   32 fresh seeds (1001…). With `--also <scenario>` (the team's
   zero-energy start, added after the results below) the edits played on
   the confirm seeds are played there too, and one is kept only if it
   isn't worse there by more than one standard error.

The report: the ideal combos (each window's DPS, its ideal's gain,
achievement, the multipliers it misses most with presence, factor, loss
and giver, and the cues it comes with), each round's edits with their
gains on 6 / 32 / 64 seeds, the fresh seeds' gain, complexity and
hardest cue; the kept edits; the path of kept lists (DPS against
complexity); achievement per window before and after; the final list in
the player's words (`--out` saves it).

**Results** (2026-11-16, full energy, 300 s, 3 workers on 4 cores; each
team page's "Rules"):

| Team | Achieved (start) | Biggest misses (window: multiplier, DPS if on every hit) | Edits / rounds / time | Kept | On fresh seeds | From zero |
|---|---|---|---|---|---|---|
| Ink Melt, the list before the Twilight hold | 50% | Twilight attacks: Si's Amp −3,704, Stagger −3,100 | 42 / 2 / 7 min | Si's battle skill before Ardelia's combo only when her button shows it, +3.10% ± 1.02 | +2.18% ± 0.87 | |
| Ink Melt, the example | 53% | Twilight attacks: Stagger −3,052, Si's Amp −1,363 | 38 / 2 / 12 min | none (the same `shows` edit +1.52% ± 1.42 on seeds 1–32) | the `shows` edit by hand: +3.93% ± 0.77 (1001–1064), +2.54% ± 0.86 (2001–2064) | −3.27% ± 1.26 |
| The owner's | 71% | Si's combo: Si's Amp −2,433, Stagger −2,107 | 70 / 4 / 20 min | Estella's ultimate only while Staggered, +1.70% ± 0.80 | +1.20% ± 0.66 | −0.94% ± 0.47 |
| Typhoeus's | 39% | hover shots: Liino's Cosmovoice Amp −13,411, Stagger −8,059 | 65 / 3 / 25 min | Arcane's ultimate only while Typhoeus hovers (or her ultimate is ready), +1.40% ± 0.52 | +0.57% ± 0.79 | +0.11% ± 0.51 |

No example changed. The two full-energy gains beyond noise (the
owner's team's Estella-on-Stagger, Ink Melt's `shows` on Si's battle
skill before Ardelia's combo, which skips that combo while Artful
Intent is up) both lose from zero energy, and Typhoeus's doesn't hold
on fresh seeds; hence `--also <zero scenario>` (below). From the list
before it, the search put the hand-found Twilight hold among its best
screened edits (+4.35% on seeds 1–6), but on 32 seeds it is +1.49% ±
0.87, and on 64 fresh seeds (1001–1064) the example with it against the
list without it is −0.11% ± 0.71: the +4.1% measured by hand on 10
seeds was those seeds. The Ink Melt example misses its `shows` edit on
seeds 1–32 (+1.52% ± 1.42), which 128 fresh seeds put at +2.5–3.9%: a
false negative of the 32-seed bar.
**The bar is the noise**: a paired difference's standard error is
0.5–1.2% at 32 seeds (the fight is chaotic: a held ultimate moves every
later event), so gains under ~1.5% can't be told from noise without 64
seeds or more, and most single structured edits gain 0–2%. The screening
seeds' gains shrink by half or more on the confirm seeds (the best of
20–30 noisy screens). What the search does give: the ideal combos and
their misses explain where damage is lost, the candidates are the moves
a player would think of, and the dead ends are measured (holding a
window's own trigger for a multiplier loses 7–57% on every team; holding
Liino's ultimate for Typhoeus's hover, the obvious move for the biggest
miss of all, gains nothing).

### Time

Integer frames at **30 FPS**, the game's own timeline unit (verified across
all operator SkillData files; Zero Sanity's 120 and old Endaxis's 60 are
tool choices). Seconds appear only for cooldowns, buff durations and table
values, and are converted once at load with a documented rounding rule.

**Slow-downs** (engine `slowDown`; rules from Endaxis's time runtime, read
not copied, 2026-10-18): an ultimate's `UltimateTimeAction` (time stop) and
global-layer `TimeDilationAction`s (a combo's slow-down) scale time for
everyone but the caster. The world (enemy statuses, inflictions, DoT ticks,
every buff including the caster's, combo windows, energy blocks)
and the other operators (their hits on the way, delayed actions, current
action) lose the frames the slow-down takes; skill cooldowns run on raw
time, and so do team SP's regen and its pause after a spend (the logs:
the replay's SP shortfalls drop from 20 to 13 of 38 logs). Overlapping slow-downs: the lowest scale counts. The engine shifts
what comes after the slow-down's start by the lost frames, which is exact
for a stop and, for a partial slow-down, for everything after it ends;
for an operator still in its own ultimate's stop (which another
ultimate's stop or a combo's slow-down doesn't hold), from that stop's
end, so what's due right then comes on time (Liino's Cosmovoice at her
frame 77 across Xaihi's stop in dbae; Rossi's ultimate crit buff at its
frame 58 across Si's combo slow-down in 9a80).
A later spend never shortens the pause after an earlier one.
Curves: inline Unity curves are evaluated (Hermite); of the named ones only
`ComboSkill` (0.01 for 40% of the duration, up to 1 at 93%, ramp taken as
linear) and `RESETto1` are known. Not modelled yet: entity-layer
dilation (Si's hit-stop on the enemy), hit-stop (attacker pauses of
0.03–0.4 s on most basic attacks) and jumps (Ti3): their curves and
target enums aren't in the data, or need in-game tests (18).
**Haste** (attribute 92, `KeywordSpeedUpScalar`, default 1, within
0.1–1.3): a cast plays at that speed (its hits, windows and locked part
come sooner; cooldowns don't change). Assumed: Endaxis parses but doesn't
use it; in-game test 19.
**Waiting on the enemy's clock**: what a buff on the enemy does after its
`triggerInterval` (`waitFirstTriggerInterval`) is held by every time stop,
the caster's own included. An Arts Burst lands `burstDelayFrames` (1 s)
after the infliction that made it, on its operator's clock: others' time
stops and slow-downs hold it, also ones already running when it's made
(`operatorClockDue`), its own operator's don't, nor a freeze (its buff
doesn't run on time dilation: `useTimeDilationDt` false; dbae's burst
after Xaihi's stop, 0eef's inside Arcane's own combo); a kit hit with `enemyDelay` (Typhoeus's
Power Shot burst: the arrow's hit consumes the stack, gives the energy and
creates `buff_common_natural_natural_triggered_typhoea`, which deals the
burst 0.35 s later) lands its effects at its frame and its damage that many
frames later (`PendingHit.deferred`), reading what the landing consumed.
The logs agree: her bursts come 0.26–0.46 s after the arrow, 1–2.5 s across
an ultimate or combo, and Arcane's touch bursts 1–1.5 s after the touch.
The log check places a delayed landing by its damage's time
(logcasts.ts `loggedFrames`, `joinDelayed`: the latest shot without its
burst, within its frame plus 1 s of the enemy's time).
**Freezes**: a control status with `freezes` (Si's Immobilization,
Tangtang's OLDEN STARE, Rossi's ultimate) stops the enemy's own clock and
every operator's debuffs on it, unless the enemy is control-immune (the
data's tag 188749032, skipping the freeze). On a control-immune enemy it
still holds the freezing operator's own debuffs (each buff's `owner`:
Si's Artful Intent, Jade Vessel and her weapon's; Tangtang's for her
stare), not the others'. No table gives the tag; the scenario's
`target.controlImmune` says, else a Boss (rank 2) is (clock.ts
`controlImmune`, actions.ts `runTriggers`). The logs: on non-bosses
others' debuffs are held (b6aa: Xaihi's cryo_fragility under Si's freeze;
489c: Arcane's will_burst under Rossi's), on bosses they aren't (4a64:
holding Arcane's halves her plain matches), while Si's Artful Intent ends
on bosses fit only with hers held (abfd, c3c7, 0c14); in-game tests 37
and 104.

### Skill timing

When an operator may act again after casting a skill (engine
`actionGate`), from SkillData and the native rules Endaxis implements
(read, not copied; research 2026-10-18):

- After the skill's `durationFrame` nothing is casting: anything goes.
- An `AllowNextSkillAction` window lets the skills it lists start from its
  first to its last frame, even before `exclusiveFrame`.
- A skill of higher priority may start at any frame (by
  `skillSpecification`: basic attack 1 < battle skill, finisher 2 < combo 5
  < ultimate 7; plunging attacks always). Others wait for `exclusiveFrame`.
  Endaxis also lets anything through when a skill has no windows; its own
  comment calls that a bypass, so the engine doesn't.
- Basic-attack chains: a step (attack2…, set by the loader when an
  earlier-numbered step's window lists it) starts only while the chain
  points at it; an attack input during that window *is* the step, so
  attack1 waits for the window to close. A skill with `dontInterruptCombo`
  keeps the chain for 1 s after its exclusive time; other skills clear it.
- Starting a skill ends the operator's current one: its hits still to land
  are cancelled, except detached ones (dealt from a projectile or entity
  file, by their log event keys), and so are its delayed cast-trigger
  actions (a skill's own effects at frames, unless the trigger is
  `detached`) and the buffs that end with it (`endsWithCast`:
  CreateBuffAction `autoFinishByAction`, which also end at the skill's
  `durationFrame`). A recorded action without a time therefore waits for
  the current skill's own hits; one with `at` may interrupt.
- During a `ChannelingCastingAction` with `cantCastSkill` (and a
  finisher's `buff_common_power_attack_disable_cast_skill` frames) the
  operator starts no skill, whatever its priority. Whether ultimates are
  an exception isn't in the data (in-game test 15). Follow-up casts
  (CastSkill) aren't held.
- Dive attacks (`skillSpecification` 6, `canCastInAir`): a rotation action
  `{operator, skill: "<op>_plunging_attack_end"}` of the controlled
  operator is a jump, the fall (`plunging_attack_start`, no damage) and the
  landing (`_end`, its hits decorated `dive`). Jump physics aren't in the
  data (native MovementSetting); `DIVE_MOTION` in constants.ts takes
  Endaxis's values (read, not copied): the fall starts 2 frames after the
  jump and the landing 22 frames after it (0.73 s). The jump ends the
  current skill (plunging attacks always may); in the air the operator
  starts nothing else. Assumptions for in-game tests: the dive's pace, a
  jump cancelling a skill at once, no dash in the air, a swap mid-fall
  keeping the landing, the chain cleared after a dive. The search dives
  only outside a basic-attack chain and once the current skill is past its
  exclusive frames (search rules, not game rules: unrestricted dives,
  which give no SP, crowded SP-giving chains out of the beam).
- Swapping doesn't wait for the controlled operator's action (which goes
  on), except during a `ChannelingCastingAction` with `cantSwitchPosition`.
  Endaxis ignores those channels; the data is explicit, so the engine
  follows it (in-game test 15).

### Simulation model

Two stages:

1. **Build stage**, per operator and build, cached: the stat snapshot with
   its contributions, plus the list of passive and triggered effects. Search
   reuses it across rotations and teams.
2. **Event stage:** what's due later is one list of scheduled items, run
   by (frame, a documented order within a frame: [below](#order-within-a-frame)).
   Casts schedule hits and buff
   changes; buffs schedule expiry; triggers fire from a registry. Each hit is
   emitted with the modifiers active at that moment, and damage is a cheap
   pure function of (snapshot, active modifiers, hit). Discrete events skip
   idle frames, which keeps long fights cheap.

SP, ultimate energy, stagger and cooldowns are **live state** that gates
actions, not post-passes. (Known details to model: team SP regenerates
8/s with a 0.5 s pause after spending; refunded SP doesn't give ultimate
energy.)

State is **plain data** (flat records and arrays, no object graph), so a
simulation can be forked by copying: search can simulate a shared opening
once and branch from it.

### Engine modules

The timeline (`packages/engine/src/timeline.ts`, a façade re-exporting the
stepping API as `@efsim/engine` exports it) is split by concern under
`timeline/` (review 3.3, 2026-10-25; lines as of then):

| module | lines | what's in it |
|---|---|---|
| `state.ts` | 399 | the types: scenario, context, state, scheduled items (`Scheduled`), casts, landed hits |
| `rules.ts` | 101 | fixed rules: team SP, energy, combo windows, dives, priorities, Link, haste's frame mapping (`hasteFrames`), `TIMELINE_ASSUMPTIONS` |
| `context.ts` | 181 | `createContext` (the build stage), panels, kit and skill lookups, skill costs and timing, the enemy's attributes |
| `schedule.ts` | 117 | the scheduled list: the order within a frame (`IN_FRAME`, `dueBefore`) and one pass each to shift a clock, end a cast and jump on a cast's timeline |
| `clock.ts` | 132 | slow-downs and the clocks they stop (`slowDown`, `shiftWorld`, `shiftEnemy`, `shiftOperator`), action speed |
| `resources.ts` | 243 | SP (regen, stops, costs), ultimate energy, cooldowns and recovery rates, the enemy's stagger |
| `timing.ts` | 393 | when an operator may act: combo windows, action gates, chains, `earliestStart` |
| `situation.ts` | 169 | what predicates, values and damage see at a frame |
| `actions.ts` | 393 | triggers (`runTriggers`) and their actions, kit buffs and stacks |
| `landing.ts` | 373 | a hit or burst landing, status damage, the random streams |
| `casting.ts` | 289 | casting a skill, ending one, jumps, a dive's jump |
| `advance.ts` | 234 | `advance`: everything due up to a frame, in order; enemy actions and perfect dodges; `memoised` |
| `drivers.ts` | 251 | `init`, `apply`, `replayCast`, `simulate`, `simulateRuns`, `startsNow` |
| `teammates.ts` | 64 | teammates' own basic attacks: the chain at its windows, the pause after a full chain, held by the operator's own action |

The modules import each other in cycles (casting runs triggers, triggers
cast), which is safe because no top-level value is computed from another
timeline module (`rules.ts`, whose constants the others use, imports none
of them).

**Scheduled items** (`TimelineState.scheduled`): hits on their way,
delayed trigger actions, team energy given later, jumps and ends on casts'
timelines, Arts Bursts and the enemy's actions are one list. Each item has
a header — its frame, the clock it runs on (`world`, `enemy` or an
operator's), the cast it belongs to (`{operator, index}`), `detached`,
`launchAt`, `pinned` — and a payload by kind. The header is all that a
slow-down (`shiftClock`: the items on a stopped clock after its start
come later, a launch with them; pinned ones stay), an interrupt
(`cancelCast`) and a jump (`jumpCast`) read, one pass each for every kind:
what's bound to a cast is decided by its launch if it has one, else by its
own frame, and nothing is for what's detached from the start (`castBound`).
Before, each of five lists had its own copy in each of these, and both
time-stop bugs of 2026-10-24 were a list missing from one.

### Order within a frame

What's due at one frame runs in this order (`schedule.ts` `IN_FRAME`);
each step waits for everything before it at that frame and at earlier
ones, and what it does may add to any step still to come:

| # | step | what |
|---|---|---|
| 1 | burst | Arts Bursts landing (`burstDelayFrames` after their infliction) |
| 2 | statusTick | ticks of a status already on the enemy |
| 3 | buffExpiry | buffs running out (every one ending at the frame at once) |
| 4 | action | delayed trigger actions (`KitTrigger.delay`) |
| 5 | energy | team energy a cast gives later (`KitSkill.teamEnergy`) |
| 6 | enemyAction | the enemy's attacks and charges |
| 7 | buffTick | buffs' periodic ticks |
| 8 | hit | hits landing |
| 9 | afterHits | delayed trigger actions marked `afterHits` |
| 10 | jump | jumps and ends on casts' timelines, a dive's next part (what's at the jump's own skill frame happens first) |
| 11 | auto | teammates' own basic attacks (`teammates.ts`), once the frame's casts and hits are in |

Steps 2, 3 and 7 come from their own state (the enemy's statuses, the
buffs); the rest are scheduled items, compared by one function
(`dueBefore`): frame, step, then for two hits (or two teammates' attacks) the operator ID, then the
order they were scheduled in. This is the order the engine had (its ten
"next due" scans encoded it, 2026-10-25); none of it is from the game,
whose order isn't in the data. Hits of different operators at one frame
go by operator ID, an arbitrary order that keeps them apart from the
team's order (scheduling order instead moves only si-laevatain, by order
and, with rolled crits, by which hit draws which roll). The owner
(2026-10-25): same-frame hits of two operators are rare enough not to
matter in practice, so the order stays and gets no in-game test.

**Team order.** A result depends on the order the team is listed in only
where the game reads team positions: a kit's `teamSlotElement` predicate
(Si's battle skill inflicts Heat when Team Position 01 is a Heat
operator) or a cooldown change for the member in a slot (her ultimate's
talent), both from the data; and the default controlled operator is the
first. Beyond that, the engine keeps one order the game doesn't
document: triggers of different operators on one event run in team order.
They judge their conditions on the state at the event, but each one's
actions see the earlier ones' (stacks used up, buffs refreshed, events
queued), and draws for `chance` and `choose` come off one stream in that
order; events made per member (Link gained, team heals, attacks on the
team) come in team order too. No example depends on it:
`tests/team-order.test.ts` runs every example under every order of its
team (with expected and rolled crits) and requires the same hits, Si's
examples aside.

### Damage

Follows the **game's own pipeline**, as encoded in BuffData (see
[data-sources.md](data-sources.md#3-damage-formula)), not a flat product of
named multipliers:

1. Attacker and defender sides each accumulate modifiers by zone:
   `NormalCalcZone`-type zones add within a side, `ProdCalcZone` multiplies
   within a side; the two sides multiply.
2. Pre-calculation modifiers (ATK ratio, crit rate and damage, attribute
   edits in the game's formula slots, zone additions), then raw damage
   (ATK × scale, attribute × scale, fixed value), then post-calculation
   modifiers.
3. Shared factors: DEF, RES × damage taken, weakness, protection, level
   coefficient.
4. Crit last.

Each hit keeps its full breakdown (zone values and the buffs that fed them),
so it can be compared with a ZMDLogs hit and its buff events.

**Crit modes:** `expected` (each hit × (1 + rate × crit DMG); deterministic,
for search), `never` / `always` (in-game tests), `rolled` (each hit crits
or not by a seeded roll: one battle as it could go). Owner (2026-10-19):
crits make damage variable, so the simulator gives both one battle with
rolled crits and the spread over many (`simulateRuns`, `efsim simulate
--runs n`: mean, standard deviation, percentiles). With `expected`, no hit
counts as a crit for triggers (`on: {event: "hit", crit: true}`):
crit-triggered effects need `rolled` (Endaxis fires them on every
crit-capable hit, which overstates them; Zero Sanity tracks expected stack
counts). `distribution` (2026-11-13) is `expected` but for the kit hits a
crit trigger could fire on, which are rolled: one seeded battle of the
[damage distribution](#damage-distributions). With `expected` (and
`distribution`) each hit that may crit also carries its two values
(`HitDamage.critSpread`: v and v(1 + crit DMG), its chance), so a battle's
total is a distribution, not only its mean. Randomness comes from mulberry32
streams in the timeline state, one per source (`crit`, `dodge`, `chance`,
`landed`), each seeded from the scenario's `seed` mixed with the stream's
name, so adding one kind of roll doesn't reshuffle another; never
`Math.random`.

**Enemy attacks and dodges** (owner, 2026-10-19): the scenario lists the
enemy's attacks and skill charges (times or every n seconds, on the
enemy's clock; default none) as `attacked` / `enemyCharge` events.
With `dodge: {chance}` the controlled operator dashes at every attack on
it, and the dash is a perfect dodge with that chance (the `dodge` stream);
a missed one is an ordinary hit. A perfect dodge (from BuffData
`buff_common_dash_behit_listener`): ends the current action (not an
ultimate before its exclusive frames), +7 SP, the world slowed by the
data's curve (about 15 frames lost; the dodger exempt; cooldowns run on),
the dodger frozen by its own curve, the perfect-dodge skill's 15 frames,
and a `perfectDodge` event instead of the attack on it. Not modelled: dash
stamina, the 0.5 s no-dash after a perfect dodge, the dash attack, dodges
by choice in a rotation.

**Numerics:** game tables are float32, and the game may compute in float32.
Where that matters, emulate it explicitly (`Math.fround` ↔ `f32`) behind one
switch, decided by fixtures. Rounding steps (attribute floor, final damage)
are each one switch; see [rounding](data-sources.md#rounding). Empirical
rounding rules fitted on a couple of data points are hypotheses, not facts.

### Damage distributions

The owner (2026-11-13): a simulation's result is a distribution, not one
number. Every random outcome contributes five numbers that **add** across
independent outcomes (`DamageMoments`, `packages/engine/src/moments.ts`):
`min` (least possible damage), `mean`, `max` (most possible), `var`
(variance) and `m3` (third central moment). The fight's are their sums;
from them the standard deviation and approximate 5th / 95th percentiles.

- **A hit** with damage v (no crit), crit chance p and crit DMG c (the
  engine's, capped as for `expected`): min v, max v(1 + c), mean v(1 + pc),
  var v²c²p(1 − p), m3 v³c³p(1 − p)(1 − 2p) (`critMoments`). A hit that
  can't crit, a rolled one, Fixed DMG: all at its value. The mean is the
  `expected`-mode value itself (`HitDamage.exact`), so a battle's mean is
  its expected-mode total to the same double (`TimelineResult.moments`).
- **A random count** (`KitHit.landedCount`, first Ardelia's sheep: in-game
  test 96): N of a cast's L planned landings land, N from observed counts.
  The cast's landings are one random sum of N copies of X, X the uniform
  mixture of its landings' distributions (`mixtureMoments`: exact when the
  landings are alike, as one cast's are): mean E[N]κ1, var E[N]κ2 +
  Var[N]κ1², m3 E[N]κ3 + 3Var[N]κ1κ2 + κ3(N)κ1³ (κ: X's mean, variance,
  third moment; `compoundMoments`); min minN·minX, max maxN·maxX. A cast
  cut short (L' of L landings left) thins N hypergeometrically
  (`thinPmf`). The cast is independent of other casts. In `expected` mode
  each landing deals its damage (and Stagger) × E[N] / L, the mean; in
  `rolled` mode N is drawn on stream `landed` and N landings chosen
  uniformly (so `simulateRuns` samples it). A log replay lands the ones
  the log shows, at their logged frames, and drops the cast's other
  planned landings (`replayCast`).
- **Outcomes that change what happens later** aren't independent of the
  rest: perfect dodges (a scenario's `dodge`; none unless given), kit
  triggers with a `chance`, and crit-triggered effects. Then K seeded
  battles (default 8; `simulateDistribution` `battles`, `efsim simulate
  --battles k`) are played, crit-triggered teams in crit mode
  `distribution`: only the hits a crit trigger could fire on (its operator
  and `by`, its `on` filters but `crit`; engine-rules C8) roll their crit
  (stream `crit`) and count at their rolled value; every other hit counts
  as its five fields. The battles combine by the **law of total
  cumulance** (`combineBattles`), over battles B equally likely: mean
  E[μ_B]; var E[σ²_B] + Var[μ_B]; m3 E[m3_B] + 3 Cov(μ_B, σ²_B) + κ3(μ_B)
  (population moments over the K). The mean then has a sampling error,
  printed (`meanError`: the battle means' sample sd / √K). Without such
  outcomes one battle gives the distribution exactly.
- **Bounds** (the lead and the owner, 2026-11-13): `min` is the battle with
  crits `never` (so no crit-triggered effect fires) and every random count
  at its fewest (`TimelineOptions.landedCounts: "least"`, the first
  landings); `max` the battle with crits `always` (every crit trigger fires
  as early as it can) and the most. That these bound the fight assumes
  crit-triggered effects only raise damage. With dodges or trigger chances
  they're the least / greatest over the K seeds' never / always battles:
  bounds over the battles seen, and the output says so. If a bound battle
  can't play the rotation, the battles' own sums of per-hit bounds stand in
  (`boundsNote`).
- **Percentiles** by the Cornish–Fisher expansion to the skew's term
  (`cornishFisher`): x_p ≈ μ + σ (z + (z² − 1) γ₁ / 6), z = Φ⁻¹(p) (±1.645
  for 5 / 95%), γ₁ = m3 / σ³, kept within [min, max]. The kurtosis term
  needs the fourth cumulant, which isn't tracked. Many examples have a
  large positive skew (few big hits at a 5% crit rate): their 5th
  percentile is then the bound, the chance of no crit on the big hits.

Checked (2026-11-13) against `simulateRuns` (rolled crits, 400 runs):
ardelia-corrosion mean 114,744 vs 115,571 ± 875, sd 17,650 vs 17,491,
5–95% 83,975–142,039 vs 82,885–137,904; laevatain-solo mean 739,231 vs
738,711 ± 781, sd 16,304 vs 15,622, 5–95% 721,735–770,849 vs
721,735–769,149; rossi-gilberta at expected crits (K = 8) mean 1,169,156
vs 1,171,134 ± 2,773, sd 57,886 vs 55,452, 5–95% 1,042,740–1,233,169 vs
1,023,380–1,220,403; every sampled total within the bounds. A cheap version
is in tests/distribution.test.ts.

The two parts are kept apart (`packages/engine/src/distribution.ts`):
`fightMoments` (mean, var, m3) and `damageBounds`. The planned follow-up
replaces `fightMoments`' K battles by one deterministic battle with
crit-triggered buffs at their expected state (probability up, expected
stacks), so the search stays one battle.

### Output: Result

```ts
Result {
  total, dps, perOperator: Record<CharId, number>,
  hits: { frame, operator, source: SkillId, target, damage, breakdown, crit }[],
  events?: … ,               // resources, buffs; only when requested
  errors: RotationError[]
}
```

`TimelineResult.moments` is the battle's own distribution
(`DamageMoments`: min, mean = total, max, var, m3; what's random in it that
changes nothing later); `simulateDistribution` gives the fight's
(`DamageDistribution`: those five with the true bounds, sd, skew, p5 / p95,
the battles it's over and their seeds, the crit mode played, `meanError`,
`boundsOver`).

Breakdowns and event traces are opt-in at run time (search only needs
totals), but always produced in tests.

**Per-operator contribution** of buffs and debuffs uses LMDI (log-mean
Divisia) attribution, as End-DPScope does: it splits each hit's damage
exactly and additively across the operators whose effects contributed.

## Fixtures and tests

- **Language-neutral fixtures** in `fixtures/` (repo root), one JSON file
  each: `scenario`, `expected` (totals, per-hit values or stats), `tolerance`,
  and `provenance` (source URL or file, date, game version, data submodule
  commits it was verified against). TypeScript tests read them now; Rust
  tests read the same files later.
- **Tolerance per fixture:** exact (or ±1 for rounding) for in-game verified
  values; looser for other simulators' outputs (they can be ~10% off for
  some operators).
- Fixture values are observations, so Zero Sanity's in-game per-hit tables
  and End-DPScope's scenario totals can be used. **Don't copy Zero Sanity's
  game-data JSON:** it's hand-curated, partly sourced from Endaxis
  (unlicensed), and we load from the submodules.
- **Unit tests** for each formula zone and each data adapter.
- **Cross-check test:** the tables the engine uses must be identical between
  the two `data/` sources.
- **Consistency tests:** the data compiler is deterministic (build twice,
  compare); a forked simulation equals one run from scratch; the same seed
  gives the same result.
- A fixture whose value changes after a data update is reviewed, never just
  re-recorded: balance change or bug.
- **Snapshots** (`tests/snapshots/`, 2026-10-24) are a regression baseline,
  not expected values with provenance (principle 11 doesn't apply to them,
  and they never stand in for a fixture): `examples.json` pins every
  `examples/*.scenario.json` result (total, hit and cast counts, damage per
  operator, a digest of the hits, whole and per 10 s; a failure lists the
  hits from the first window that moved), `log-verdicts.json` the verdict
  counts per operator of every verified log fixture (a ratchet: no fewer
  plain, plain + assumed or total matches, no more fallbacks), and
  `log-verdicts-pending.json` those of every pending fixture (exactly: they
  only pin the current state). A deliberate change: `npm run
  snapshots:update` (scripts/snapshots.sh: every snapshot emptied and
  written again with `EFSIM_UPDATE_SNAPSHOTS=1`, so the result depends only
  on the code), and the file's diff goes in the commit with the reason.
- **The accuracy scoreboard** (docs/accuracy.md, scripts/accuracy.ts) is
  computed from the verdict snapshots and the hold-out split: per group
  (verified, development, hold-out, earlier pending) the shares of plain
  matches, matches and mismatches, the mean |total damage error| and the
  fights within ±5%, and the same per operator over every log but the
  hold-outs. `snapshots:update` writes it, a test checks it matches the
  snapshots, and `node scripts/accuracy.ts --compare <ref>` gives the change
  against another commit with each log's direction by the fit measure (more
  plain matches, fewer mismatches, a smaller |damage error|; hold-outs only
  as counts). The pending check's failures and shard summaries use the
  same measure.
- **`npm test`** runs everything but the slow checks; **`npm run
  test:logs`** (`tests/slow/`, a few minutes: the pending fixtures in four
  shards, the negative control, the search's beam ratchets, and single
  tests of tens of seconds) runs them, and `npm run check` runs both.

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
scripts/          fetch-data.sh: sparse fetch of the tables in packages/data/tables.json
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

Details: [reference-simulators.md](reference-simulators.md).

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

- What the game does at ties within a frame (simultaneous hits of different operators, listeners to one event): the engine's order is [documented](#order-within-a-frame), not verified.
- Rounding and float32 (see [data-sources.md](data-sources.md#rounding)).
- Which SkillData/BuffData action types the compiler must understand for
  the first fixtures.
- How combo trigger conditions are expressed without CharacterData.
- Search algorithm over the decision tree, and how the evaluator scores
  partial states.
