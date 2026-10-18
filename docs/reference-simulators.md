# Reference simulators: how they're built

A design comparison of the simulators under [`reference/`](../reference/README.md),
made 2026-10-18 to inform [design.md](design.md). Endaxis has no licence:
everything about it here is a description in our own words.

Revisions: zero-sanity-timeline at the submodule pin; End-DPScope `d602746`
(2026-09-20), which vendors an **old Endaxis** (`13b6905c`, ~2026-09-17;
hand-written data, event queue); **current Endaxis** `fbf6a29`
(2026-10-18; generated from native data, stepped every frame).

## Side by side

| | Zero Sanity | End-DPScope + old Endaxis | Endaxis (current) |
|---|---|---|---|
| Engine boundary | leaky: engine imports view types, tests run through a React hook, data via webpack `require.context` | a Node process per simulation, JSON files in/out; harness re-creates app glue and patches vendor code | clean core / application / UI layers |
| Data | hand-curated JSON (1,021 files), scaffolded from wiki and Endaxis data, then edited by hand | hand-written TypeScript sheets | compiled from ~32 tables, SkillData, BuffData, ProjectileData, AbilityEntityData, CharacterData and assets; unknown types fail the build |
| Time | 120 FPS; data in seconds | seconds, 60 FPS save files | 30 FPS integer frames; global scaled, per-entity and unscaled clocks |
| Engine style | event queue + post-passes for SP, energy, stagger, rerun after stagger | event queue + trigger registry | every frame, action-graph interpreter |
| Rotation input | absolute placement | absolute seconds | absolute frame or "after cast X" |
| Illegal action | runs, warning | runs | runs, diagnostic |
| Damage | flat product of ~16 factors | named zones | the game's zones × attacker/defender, then shared factors, crit last |
| Crit | never / always / expected / random / manual; Markov model of crit-triggered stacks | expected (rate × DMG), manual overrides | per-hit expectation (crit after-effects always fire) or seeded sampling |
| Tests | ~289 Jest files; **in-game verified per-hit values** for Laevatain | none; one total compared by hand after sync | many unit/integration tests and invariants; no in-game fixtures |
| Fit for search | low | very low | low |

## Worth taking

- **Zero Sanity:** the in-game verified per-hit table
  (`src/tests/unit/laevatainDamageCalc.test.ts`, values never to be changed
  per its own rule) and stat panel test (`loadoutAggregator.test.ts`).
  Attributes are floored (verified there: the game shows INT 720 from
  720.985).
- **End-DPScope (MIT):** a compact scenario format; a per-hit output record
  listing every zone with its sources and three values (non-crit, crit,
  expected); **LMDI attribution** of damage to operators; its `research/`
  notes on the game's damage pipeline and the numeric attribute ID list.
  Scenario totals: 3,700,482, armour swap 2,532,224, weapon swap 2,601,532,
  basic attack L1 3,625,967.
- **Current Endaxis (ideas only):** integer 30 FPS frames with several
  clocks; data compiled offline from native files with failure on unknown
  types; double compilation to check determinism; save / fork / restore of
  simulation state; separate skill boundaries (input, cost, interrupt
  window, natural end); a low-discrepancy sequence for reproducible
  probabilities.

## Pitfalls seen

- **Zero Sanity:** hand data drifts from the tables, and 96 of its data
  files cite Endaxis as their source (so don't copy them); run-time
  interpretation of a JSON rule language over deep-cloned segments; combo
  windows re-derived on every insert; time-stops extended retroactively; its
  effective-ATK rounding rule ("round up if fraction ≥ 0.7") was fitted on
  two loadouts, its bare-loadout test is skipped and still 1 off, and
  `calculateDamage` rounds ATK to 0.1 contrary to its own spec. Beta Breach
  values. SP regen modelled as continuous 7.69/s (the game is 8/s with a
  1.5 s pause after spending).
- **End-DPScope:** process per evaluation; patched vendor code; `Math.random`
  IDs that changed between runs and broke label mapping; inherits every
  engine bug. Its log notes one Typhoeus timeline ~8% below target and
  "blind" rotations reaching a fraction of hand-tuned DPS: rotation quality
  dominates results.
- **Current Endaxis:** ~342k lines; heavy per-frame interpreter; needs data
  collections rmxlinux doesn't have; crit after-effects fire on every
  crit-capable hit in expected mode, overstating crit-stack buffs.

## Game facts surfaced

- SkillData's blackboard and cost are defaults; per-level values are in
  `SkillPatchTable`.
- Team SP: 8/s with a 1.5 s pause after spending (`atbRecoverInterval`);
  battle skill gives 0.065 ultimate energy per natural SP; refunded SP gives
  none. Zero Sanity uses max 300, start 200.
- Ultimates set the global time scale to 0, pausing ordinary buffs.
- The game's sampled crits use .NET's legacy subtractive generator
  (according to Endaxis's notes; unverified).
