# The timeline engine

Part of the [design](../design.md): The engine's input, the stepping API, time and skill timing, the simulation model, the modules (core and planning) and the order within a frame, and the result.

## Input: Scenario

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

## Rotation

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

## Stepping API

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

## Time

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
time (the logs, in-game test 18: 58 combo pairs come back within their
cooldown plus less than the stops between), and so do team SP's regen and its pause after a spend (the logs:
the replay's SP shortfalls drop from 20 to 13 of 38 logs). Overlapping slow-downs: the lowest scale counts; a reset (SkillTiming.resets: a dilation back to scale 1 in a
priority tag, Arcane's combo at its frame 9) ends every running slow-down of its priority, its own too, and gives
the clocks back what they would still have lost (engine assumption `combo-reset`, clock.ts `resetSlowdowns`). The engine shifts
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
**Haste** (attribute 92, `KeywordSpeedUpScalar`, which the data's
SpeedupAction raises: Si's talent, Tangtang's water) doesn't play casts
faster (a cast's frames are its skill frames: casting.ts `castSkill`): in the logs (in-game test 19,
2026-11-16) basic-attack steps in the 5 s after Si's Inksoul ends (30%)
are 0.995× as far apart as the same steps elsewhere (95% 0.95–1.02; 0.77
if sped). Taken as movement speed, which isn't modelled. Until
2026-11-16 a hasted cast played faster; the inert speed plumbing
(`hasteFrames`, `Acting.speed`) was removed in improvement round 3: an
effect that does speed casts would bring it back where casts are planned.
**Waiting on the enemy's clock**: what a buff on the enemy does after its
`triggerInterval` (`waitFirstTriggerInterval`) is held by every time stop,
the caster's own included. Likewise a trigger's hits marked `world` (the
hits a buff's or an ability entity's timeline deals, as Arcane's Cluster
Strike lasers and her INT early end's lasers): they run on the world's
clock, so the owner's own ultimate stop holds them too, where hits on the
owner's clock aren't (2026-11-18: a7a7a40c97ed's lasers after her
Gloompurge Arcana's stop). A skill's detached hit can be marked `world`
the same way (KitHit.world: a buff the cast puts on its operator deals
it; Zhuang Fangyi's Thunder Strikes, which the logs resume at her
ultimate's end, d774 102.17 s and 4d60 157.42 s, 2026-11-22). Her
Empyrean strikes, an ability entity's, aren't: in 4bfc at 73.2–73.7 s
they keep their 0.2 s pace through her own combo's slow-down. An Arts Burst lands `burstDelayFrames` (1 s)
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
Tangtang's OLDEN STARE, Rossi's ultimate) stops the enemy's own clock (Corrosion's end, not its ramp: assumption
`freeze-ramp`) and every operator's debuffs on it, unless the enemy is control-immune (the
data's tag 188749032, skipping the freeze). On a control-immune enemy it
still holds the freezing operator's own debuffs (each buff's `owner`:
Si's Artful Intent, Jade Vessel and her weapon's; Tangtang's for her
stare), not the others'. No table gives the tag; the scenario's
`target.controlImmune` says, else the enemy's `controlImmune`, set per
enemy from the logs with the evidence (packages/data/src/enemyFacts.ts:
Chiliarch, the enemy Si); every other enemy freezes, bosses too (in-game
test 104, the owner 2026-11-16: most bosses do; until then every Boss was
immune) (clock.ts `controlImmune`, actions.ts `runTriggers`). The logs: on
frozen enemies others' debuffs are held (b6aa: Xaihi's cryo_fragility under
Si's freeze; 489c: Arcane's will_burst), on the two immune ones they aren't
(4a64: holding Arcane's halves her plain matches; c3c7: Ardelia's Arts
Susceptibility), while Si's Artful Intent ends fit only with hers held
(abfd, c3c7, 0c14); Rhodagn's five logs with a freezer check the same
either way; in-game tests 37 and 104.

## Skill timing

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

## Simulation model

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

## Engine modules

**Core and planning** (2026-11-16, architecture review item 12): the
engine is two parts with a lint-enforced boundary.

- The **core** (`packages/engine/src/core.ts`, also the package entry
  `@efsim/engine/core`): the kit DSL (model, expr, events), attributes,
  stats, effects, damage, reactions and statuses, buffs, triggers, units,
  errors, crit moments, and the timeline through its façade. What happens
  in a fight. The core modules stay at the top of `src/` and under
  `timeline/`; none imports the planning code.
- The **planning** code (`packages/engine/src/planning/`: the rotation
  search, bound, macros, setup value, skeletons, the loop, payoffs, a
  rotation's distribution, and the rule driver `policy*`): what to press.
  It imports the core only through `../core.ts`, never a core module or
  `timeline/*` directly; what it needs of the timeline's internals is on
  the façade (`timeline.ts`). `nextBasics` and `diveOf` (what the attack
  input and the dive cast: game rules) live in `timeline/buttons.ts`.
- The data package imports only `@efsim/engine/core`, and the game-data
  cache's key traces the names it imports through `core.ts` (packages/data
  cache.ts `engineSources`). `@efsim/engine` re-exports core and planning,
  as before.

The timeline (`packages/engine/src/timeline.ts`, a façade re-exporting the
stepping API as `@efsim/engine` exports it) is split by concern under
`timeline/` (review 3.3, 2026-10-25; `wc -l packages/engine/src/timeline/*.ts` for their sizes: hand-written counts drifted):

| module | what's in it |
|---|---|
| `state.ts` | the types: scenario, context, state, scheduled items (`Scheduled`), casts, landed hits |
| `rules.ts` | fixed rules: team SP, energy, combo windows, dives, priorities, Link, `TIMELINE_ASSUMPTIONS` |
| `assumptions.ts` | the engine's own open readings (`ENGINE_ASSUMPTIONS`: control-immunity, buff-in-stop, status-in-stop, combo-reset, freeze-ramp, teammate-pause, stagger-recovery, hidden-holds (read by the log check's replay only: it places the hidden holds with clock.ts `holdWorld`), stagger-freeze, combo-window-count), switched by `TimelineOptions.assume` |
| `context.ts` | `createContext` (the build stage), panels, kit and skill lookups, skill costs and timing, the enemy's attributes |
| `schedule.ts` | the scheduled list: the order within a frame (`IN_FRAME`, `dueBefore`) and one pass each to shift a clock, end a cast and jump on a cast's timeline |
| `clock.ts` | slow-downs and the clocks they stop (`slowDown`, `shiftWorld`, `shiftEnemy`, `shiftOperator`; `holdWorld`, the world's clock alone held, for the log check's hidden holds), control immunity |
| `resources.ts` | SP (regen, stops, costs), ultimate energy, cooldowns and recovery rates, the enemy's stagger |
| `timing.ts` | when an operator may act: combo windows, action gates, chains, `earliestStart` |
| `situation.ts` | what predicates, values and damage see at a frame |
| `actions.ts` | triggers (`runTriggers`) and their actions, kit buffs and stacks |
| `landing.ts` | a hit or burst landing, status damage, the random streams |
| `casting.ts` | casting a skill, ending one, jumps, a dive's jump |
| `advance.ts` | `advance`: everything due up to a frame, in order; enemy actions and perfect dodges; `memoised` |
| `drivers.ts` | `init`, `apply`, `replayCast`, `simulate`, `simulateRuns`, `startsNow` |
| `teammates.ts` | teammates' own basic attacks: the chain at its windows, the pause after a full chain, held by the operator's own action |

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

## Order within a frame

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

## Output: Result

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
