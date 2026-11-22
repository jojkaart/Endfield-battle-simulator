# Data layer

Part of the [design](../design.md): The game data: the DataBundle, and how skills, buffs and kits are compiled from SkillData / BuffData.


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

## DataBundle (sketch)

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

## Skills and buffs from SkillData / BuffData

The raw files are C# action graphs, mostly presentation (animation, VFX,
sound, camera). Structure and known enum values:
[game-data-format.md](../game-data-format.md). The data layer does **not**
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
(`packages/logs/src/buffreplay.ts`, engine `replayCast`): each placed cast
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
landing in the replay of the logged casts (`packages/logs/src/enginecheck.ts`
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
`loggedPoiseBars`), and its Stagger state follows the log's listing:
Staggered through each moment whose hits list it to the next listed one,
not Staggered at a moment that lists none (`loggedStaggerSteps`, engine
`holdStagger`; the damage confirms the listing, 2026-11-17). So its
Stagger windows are the log's; the totals' "hits under Stagger" row
measures that following (and landings the replay lacks), not the
engine's Stagger. Where the engine's own Stagger ran short of the log's
is in `BuffReplay.staggerHolds`. Landings a log can't
have (a hit that didn't reach the logged enemy) are named by hand in the
fixture's `absent`, each with why, and left out of the replay's side.
Build inputs the export omits or got wrong are the fixture's
`buildOverrides` (2026-11-18): `team` stays as exported, each override
sets fields over it when the fixture is read (logs.ts `readLogFixture`;
`readLogFixtureRaw` and `zmdlogs refresh` keep the file as written), with
its evidence in `why`. The evidence is `efsim zmdlogs fit-build <fixture>
--operator <op>` (buildfit.ts): every attribute-node count, weapon level
and food (or none), each scored by the operator's landed kit hits within
±1 of its primary reading recomputed with the candidate's panel, and
apart on the clean ones (no difference between the log's listing and the
replay), so an override is the fit that explains the most hits with the
fewest changes, not a ratio's nearest ATK. Older hand fits are still
written into `team` with a note (not migrated). The weapon's level isn't
yet bounded by its logged skill levels (WeaponBreakThroughTemplateTable's
`skillLevelBounds`, not in packages/data/tables.json): check a fitted
level by hand.

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

**What the replay takes from the log** (round 3, 2026-11-18: one list of
the "follow the log" mechanisms that grew one at a time in
packages/logs/src/buffreplay.ts and logcheck.ts). Each row is something the
check no longer tests of the engine: a mismatch can't come from it, and a
change to the engine there doesn't show in the verdicts. `efsim zmdlogs
replay <fixture>` shows the result; `efsim zmdlogs differences` where the
replay and the log's listing still disagree.

| What | From the log | Function | What the check then doesn't test |
|---|---|---|---|
| Casts and their starts | logged hits grouped into casts, each cast's start its first landing less the kit frame, time stops counted back (logcasts.ts) | `placeHits`, `replayedCasts` | when the engine would let the cast start |
| Landings' frames | each logged hit of a cast lands at its logged frame (`replayCast` landings `ref`) | `replayedCasts` | the kit's hit frames for logged hits |
| Casts without damage | the log's cast events (`LogFixture.casts`); casts inferred from a buff's end, a buff's lane or a trigger's hits | `withLoggedCasts`, `castsFromBuffEnds`, `castsFromBuffLanes`, `castsFromTriggerHits` | that the press happened |
| Casts the log can't show | a cast that hits nothing, added where a logged cast needs it (an assumption) | `missedCasts` (BuffReplay.missed) | whether it was pressed |
| Who is controlled | basic-attack hits with Stagger are the controlled operator's | `controlledFromLog` | swap timing |
| Crits | the logged crit flags (`TimelineScenario.loggedCrits`) | `replayKitBuffs` | crit rolls, and buffs triggered by crits where logged |
| Arts reaction levels | the level whose reading fits the logged value (`loggedReactionLevels`, up to 3 replays) | `logBuffReplay` | the engine's infliction stacks at those reactions |
| Stagger bar | the bar before each group of logged hits with Stagger | `loggedPoiseBars`, engine `setPoise` | the kits' Stagger per hit (between groups only) |
| Stagger state | Staggered through moments the log lists `buff_common_poise_break_damage_taken_scale`; not where it lists none (`calm`) | `loggedStaggerSteps`, engine `holdStagger` | Stagger windows' starts and lengths (`zmdlogs stagger` compares the engine's own) |
| Stagger recoveries | a full bar between two hits refills it | `loggedRecoveries`, engine `refillPoise` | the enemy's own recovery |
| Enemy HP | the HP the logged damage leaves (when it sums to Max HP) | `loggedEnemyHp` | HP-threshold effects' timing |
| Effects no kit models | (`--simulate` only) the log's effects as modifiers | `simulateLog` `loggedModifiers` | — |

Readings of the engine's own open rules (control immunity, ...) switch with
`--assume` (`zmdlogs check --assume`, `scripts/measure.ts --assume`;
packages/engine/src/timeline/assumptions.ts), as the kits' do.

**What the log records** (round 3, 2026-11-18: facts agents measured and
left in code comments or reports). ZMDLogs' battle detail, as the importer
keeps it (packages/logs/src/zmdlogs.ts; `efsim zmdlogs raw` shows a raw
detail):
- **Times** are ms from the fight's start, in the world's time: other
  casts' time stops and hit-stop are in them. The engine counts frames
  (30 a second): `LandingFacts` statuses' `appliedAt` and `TimeStop.start`
  are frames; `LogEffect.since`, `LogHit.t`, `LogCast.t` and the placed
  casts' `start` are ms (`zmdlogs hits --json` gives `appliedAtMs` too).
- **Cast events** (`LogFixture.casts`: the detail's skill events without a
  damage value) are presses as the log has them, not the kit's frame 0:
  - battle skills: the event is at the placed start (within a frame or
    two);
  - combos: the event lags the kit's frame 0 by 0.3–0.7 s, differing by
    operator;
  - ultimates: the event comes at the end of the ultimate's own time stop,
    about 1.9 s after the placed start (`loggedCastStart` in
    buffreplay.ts);
  - a press during another operator's time stop is logged at that stop's
    end, sharing its ms (`unplacedCastStops`);
  - the event names the slot's skill, not the kit's variant
    (`chr_0034_typhoea_normal_skill` for `normal_skill_floating_start`:
    `castEventOf` in logcasts.ts matches them);
  measured over the development logs in the cast-placement round
  (docs/friction-done/2026-11-18-cast-placement.md, point 5); redo the
  measurement with `efsim zmdlogs casts <fixture>` (EVENT against CAST
  lines) after a placement change.
- **Hidden casts logged as another skill's**: an entity's CastSkill is
  logged as a cast of the skill that spawned it. Arcane's combo appears
  again about 6.5 s after each real one: the CastSkill of
  `combo_skill_abilityentity_end` at Imprisonment's natural end (an
  explosion follows about 0.45 s later), so the log gives Imprisonment's
  end; her INT twin's `seal_again` is logged under the combo's id too. The
  placement and `withLoggedCasts` treat such events as presses (which then
  fail on cooldown); none is used as a timing fact yet.
- **Status keys** (event keys of a status's own hit; effect keys of its
  debuff lane at later hits), as the development logs have them:

  | Status | Its hit's event key | Its debuff lane (effect key, zone) |
  |---|---|---|
  | Arts Burst | `buff_common_<e>_<e>_triggered` (Typhoeus' own: `buff_common_natural_natural_triggered_typhoea`) | — |
  | Reaction | `buff_common_<e>_<consumed>_triggered`; Corrosion's own hit `buff_common_natural_triggered` | Electrification: `buff_common_pulse_pulse_conduct_triggered_do` (damageTaken); `buff_common_pulse_<x>_triggered` (damageTaken, a few) |
  | Corrosion | `buff_common_natural_triggered` | listed without a value (`isCorrosionBuff`: `buff_common_natural_natural_corrupt_do`, `buff_common_natural[_x]_triggered`) |
  | Combustion tick | `buff_common_burning_status` | — |
  | Solidification | — | `buff_common_originum_frozen` (an event key too) |
  | Lift / Knock Down | `buff_physical_airborne` / `buff_physical_knockdown` | — |
  | Crush | `buff_physical_do_crushed` (`buff_physical_crushed` in some logs) | — |
  | Breach | `buff_physical_do_fracture` | `buff_physical_do_fracture` (damageTaken, physical) |
  | Shatter | `buff_common_cryst_triggered_physical_break` | — |
  | Stagger | — | `buff_common_poise_break_damage_taken_scale` (multiplicative) |

  In code: `parseReactionEvent` and `PHYSICAL_EVENT_KINDS` (engine
  reactions.ts), `statusEventKey` and `PHYSICAL_KEYS` (status.ts),
  `ENGINE_STATUS_BUFF` (logs enginecheck.ts).
- **Buff lanes' start** (`LogEffect.since`): the latest (re)application,
  not the first (2026-11-18, in-game test 22): Laevatain's Scorching
  Heart's `since` moves to each start the replay has (458b, within 20 ms),
  and in f879 at 92.49 s to a re-creation while the old instance had 12 s
  left; a lane whose `since` doesn't move wasn't re-applied. Earlier,
  against the replay's Electrification `appliedAt`, 1,212 of 3,705 hits
  agreed within 300 ms (docs/friction-done/2026-11-17-fixture-refresh.md).

**Common misreadings** (round 4, 2026-11-18: each one changed a re-triage or
test verdict before someone checked it; read this before counting anything
in the logs):
- **`since` is the latest (re)application**, not the first (above): a
  lane's runs are `efsim zmdlogs lanes <fixture> --buff <re>`.
- **A buff's name doesn't say self or team.** A weapon's `_teamspell` and
  `_teamatk` (Long Heritage: `buff_wpn_claym_0019_teamspell` 0.168 is the
  wielder's own Cryo DMG, `_teamatk` 0.112 the team's ATK) are told apart
  by the kit buff whose `gameBuff` they are; some team buffs are listed on
  their source's own hits only. `efsim zmdlogs buffs --buff <re>` gives the
  kit buff, the sources and whose hits list it ("only on its source's own
  hits").
- **A listed id may be a common affix**: an Amp or Susceptibility is often
  listed as `buff_common_affixes_enhance_spell` /
  `buff_common_affixes_vulnerable_<element>` with `source` the operator,
  not as the kit's `gameBuff` file (Arcane's INT Amp); `zmdlogs buffs`
  maps those too (enginecheck.ts `loggedNames`).
- **Game ids count talents and potentials from 0**: `talent1` is the
  second talent (Camille's talent 2 is `buff_chr_0033_camille_talent1_atkup`,
  named "atkup" though it is Heat DMG).
- **Combos log no cast event for some operators** (Liino, Avywenna,
  Alesh, Endministrator, Arclight's battle skill): the casts are in the
  hits only. "The casts of X" is `efsim zmdlogs instances <fixture>`
  (`loggedSkillInstances`), never `fx.casts`.
- **An ultimate's cast event repeats while it lasts** (Liino's every
  ~3.5 s of Cosmovoice, Ardelia's ~3 s after hers, Typhoeus's at later
  shots of her window): "N s after the ultimate" is measured from the
  first event of the group (`zmdlogs instances` folds the repeats in).
- **Si's battle-button events are mostly hitless**: every 3.2–3.6 s, often
  while she does basic attacks; a real battle skill has its hit 400–650 ms
  after its event. Whether the rest are presses is open (the replay makes
  some into strokes: `withLoggedCasts`). `zmdlogs instances` lists them as
  "an event only".
- **Liino's stance**: her `normal_skill` events every ~3 s during Vocalist
  Stance are its beats or End Stance presses (End Stance is never logged
  under its own id).
- **Arcane's Imprisonment end is logged as a combo cast** about 6.5–8 s
  after each real combo (above, "Hidden casts"); `zmdlogs instances` marks
  it.
- **A hit may be logged under another operator's key** (Valiant's extra hit
  as `chr_0015_lifeng_ultimate_skill`).
- **A teammate's `attack1` isn't a swap**: the controlled operator is
  shown by basic hits that deal Stagger (`efsim zmdlogs control`).
- **Not listed at all**: Haste, shields, heals, Whirlpools; Vulnerable
  without stack counts. A missing listing proves nothing there.
- **A buff the hit itself creates isn't listed on it**, even where its
  damage has it: Perlica's combo creates its forced Electrification
  before its damage, and the buffs that triggers (her P3 ATK, Pulser
  Labs' Electric DMG, Wild Wanderer's team DMG) act on that hit (exact
  with them) but are listed only from her next hit (2026-11-22). "Log
  only" / "engine only" on the applying hit is no evidence of timing;
  the value is.
- **Perlica's ultimate has no crit flag** (`crit` null on 19 of 19):
  about a third come at ×1.5 (her P5 crit rate +0.3).
- **Multi-target logs aren't checked** (the engine is single-target):
  their `zmdlogs hits` verdicts mean nothing.
- **`isEnable false` in game data means the action never runs**
  (`efsim gamedata tree` prints DISABLED on its line).

**Questions and the command that answers them** (round 4; every command
takes a fixture's path or its id, e.g. `0c14`, and operators by name):

| Question | Command |
|---|---|
| The casts of an operator, as the log means them | `efsim zmdlogs instances <fixture> [--operator]` |
| How often X happens, X near Y (a claim's count) | `efsim zmdlogs census --select cast:\|event:\|buff:<re> [--near …] [--window a,b] [--list]` |
| What a listed buff id is in the kits, whose hits list it | `efsim zmdlogs buffs [--buff <re>]` |
| A buff's listed runs (since, first, last, next unlisted hit) | `efsim zmdlogs lanes <fixture> --buff <re>` |
| Who is controlled when | `efsim zmdlogs control <fixture>` |
| Is a key a timer, a cooldown or event-driven | `efsim zmdlogs cadence --operator <op> --event <re>` |
| A skill's frames, windows, uncuttable frames | `efsim kit <operator> [--skill <re>]` |
| Operator ids and weapon names of the logs | `efsim zmdlogs list --ids [--with <op>]` |
| Where the placement put each hit and cast | `efsim zmdlogs casts <fixture> [--from --to]` |
| The replay's landings, casts made against the kit | `efsim zmdlogs replay <fixture>` (FORCED, INSIDE) |
| How a kit buff's expiry moved | `efsim zmdlogs replay <fixture> --trace-buff owner:id` |
| Per hit: engine modifiers, the log's listing and reading | `efsim zmdlogs hits <fixture…\|--all> [--json] [--reading log] [--event <re>]` |
| A build offset (off under both readings) | `efsim zmdlogs hits … --reading log`, then `zmdlogs fit-build` |
| An operator's mismatches by cause | `efsim zmdlogs groups --operator <op>` |
| Does a change help | `npm run measure [-- --with <op>]` |

`zmdlogs hits --json` records (packages/logs/src/hitexport.ts `HitRecord`):
`value`, `class`, `predicted` and `error` (the primary reading),
`logReading` / `logError` (every kit buff as the log lists it), `listed`,
`differences` (`kind` engine / log / values), and under `landing`:
`modifiers` (with `kitBuff`), `zones`, `scaleParts`, `enemy` (statuses with
`appliedAtMs`). They are cached per fixture and code in scratch/hits-cache/.

**A claim from the logs cites its selection** (round 4, after three of
five re-triage claims fell apart on a recount): a doc that counts
something in the logs gives the command that counted it (the `rerun:` line
of `zmdlogs census`, or the command and its filters), and says what the
answer rests on: "listing only", "damage checked" (the hits' values) or
"engine compared" (against the kit's reading, with the kit hit and its
`if` quoted). A brief that passes a claim on passes that too.

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
2026-11-14, `packages/logs/src/recordedburst.ts`) is Fixed DMG of what the
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
`packages/logs/src/bufftiming.ts`; a diagnostic, never scored: it changes
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
development log of the split (fixtures/holdout/holdout.json); hold-out logs are
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
