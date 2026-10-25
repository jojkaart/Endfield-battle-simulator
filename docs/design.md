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
    panel attributes, kit and weapon conditions, battle-log buffs, timeline
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
  `zmdlogs casts` adds them to an older fixture), else a cast inferred from
  the lane of the one buff it applies (`castsFromBuffLanes`).
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
killing blow, Fixed DMG a fight computes, a status hit of an operator
without a kit; and **uncovered**. Until 2026-10-24 any hit under any
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

**Buffs from skills** are kit `buffs` (engine `buffs.ts`): target self,
team or enemy, a duration (0: not applied; none: until ended) and
modifiers on a zone or an attribute whose values are ValueExprs at the
applier's levels. Attributes that don't act on hits (Ultimate Gain
Efficiency) are read where the game reads them. A buff can be layered
(`maxStacks`, each layer with its own duration), reach only some team
members (`recipients`, a Predicate per member), or be consumed by the next
cast of a kind and act on that cast's hits only (`consumedBy`: Link). Buffs
from the same BuffData stacking key count only their strongest instance.
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

`efsim search` (engine `searchRotation`) is a beam search on the stepping
API. At each decision point every legal action is tried (`legalActions`:
the actions that can start soonest, plus the controlled operator's next
basic attacks even if later), each applied with `at` the frame it starts,
so the found rotation replays to exactly the searched states with
`simulate`. Per half-second bucket the best `beamWidth` (24) nodes survive,
ranked by committed damage (hits landed plus everything already on its
way: the state advanced to the fight's end), optionally plus the worth of
unspent SP and energy (`resourceWeight`); equivalent states keep only the
best. Equivalent means equal in every field of the state that what comes
next reads (`stateKey`): each `TimelineState` field, and each field of
each kind of scheduled item and of a buff, is classified in a `KeyRules`
record (in the key, a projection of it, or a reason it isn't: landed hits
and the reaction record are the score and the log), so a new field doesn't
compile until someone decides; scheduled items are keyed per kind, in
order (the order within a kind is what ties go by); the key is a canonical serialisation (sorted keys), with
SP and energy rounded to 0.1 (floating-point noise between paths).

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
  swaps first. When one can start at the state's own frame (most decision
  points), nothing starts sooner, so the other actions are choices only if
  they can start right then: `startsNow` (timeline/drivers.ts) judges that without
  how much later they could (`startFrom`'s frame is the state's own, and a
  combo that needs a window has one open).
- Of the others, `startsNow` is asked first; only when no action at all
  can start at the state's frame are they judged in full.
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

### Time

Integer frames at **30 FPS**, the game's own timeline unit (verified across
all operator SkillData files; Zero Sanity's 120 and old Endaxis's 60 are
tool choices). Seconds appear only for cooldowns, buff durations and table
values, and are converted once at load with a documented rounding rule.

**Slow-downs** (engine `slowDown`; rules from Endaxis's time runtime, read
not copied, 2026-10-18): an ultimate's `UltimateTimeAction` (time stop) and
global-layer `TimeDilationAction`s (a combo's slow-down) scale time for
everyone but the caster. The world (enemy statuses, inflictions, DoT ticks,
every buff including the caster's, combo windows, SP regen, energy blocks)
and the other operators (their hits on the way, delayed actions, current
action) lose the frames the slow-down takes; skill cooldowns run on raw
time. Overlapping slow-downs: the lowest scale counts. The engine shifts
what comes after the slow-down's start by the lost frames, which is exact
for a stop and, for a partial slow-down, for everything after it ends.
SP regenerates until the slow-down starts (which may be frames into its
cast, or inside an advance for a trigger's cast), not for the lost frames
after it (`TimelineState.spStops`), then on; the pause after a spend is
apart from these and a later spend never shortens it.
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
8/s with a 1.5 s pause after spending; refunded SP doesn't give ultimate
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

Steps 2, 3 and 7 come from their own state (the enemy's statuses, the
buffs); the rest are scheduled items, compared by one function
(`dueBefore`): frame, step, then for two hits the operator ID, then the
order they were scheduled in. This is the order the engine had (its ten
"next due" scans encoded it, 2026-10-25); none of it is from the game,
whose order isn't in the data. Hits of different operators at one frame
go by operator ID, an arbitrary order that keeps them apart from the
team's order (scheduling order instead moves only si-laevatain, by order
and, with rolled crits, by which hit draws which roll).

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
counts). Randomness comes from mulberry32 streams in the timeline state, one
per source (`crit`, later dodges), each seeded from the scenario's `seed`
mixed with the stream's name, so adding one kind of roll doesn't reshuffle
another; never `Math.random`.

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

### Output: Result

```ts
Result {
  total, dps, perOperator: Record<CharId, number>,
  hits: { frame, operator, source: SkillId, target, damage, breakdown, crit }[],
  events?: … ,               // resources, buffs; only when requested
  errors: RotationError[]
}
```

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
  snapshots:update` (`EFSIM_UPDATE_SNAPSHOTS=1`), and the file's diff goes
  in the commit with the reason.
- **`npm test`** runs everything but the slow log checks; **`npm run
  test:logs`** (`tests/slow/`, a few minutes: the pending fixtures in two
  shards, and the negative control) runs them, and `npm run check` runs both.

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
