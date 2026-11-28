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
  detached, energy, a capped channel's end (`latest` → KitHit.latestFrame,
  round 22 also in a buff's or entity's own file); `count` defaults to the number of frames; the skill's
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
(`packages/logs/src/buffreplay.ts` replayKitBuffs, engine `replayCast`;
since round 14 in parts: castassembly.ts the casts it makes, replayrun.ts
one pass, `replayOnce(input, pass)`, and makeCast, holdinputs.ts what
holds its timers to the log, replaycrits.ts the crits the log leaves out,
replayedhits.ts what it makes of the logged hits; its steps and their
order in replaysteps.ts and what it records for the views, the kit
windows, traces and applied slow-downs, in replayrecord.ts: a view's new
output is an edit there, a rule's in the part it belongs to; the reason
strings the snapshots' kinds group by are replaykeys.ts's constants): each placed cast
(logcasts.ts) starts at its logged frame without a rotation's checks, its
logged landings land at their logged frames (pinned: later time stops
don't move them, the log's time has them in; a stop or hold still moves an
action's end, the landings nothing pinned, triggers' delayed hits and the
world's timers; `zmdlogs replay` marks the pinned LAND lines `[pinned]`,
round 19), an operator's earlier cast
keeps its hits when the log shows them after the next cast started, and a
jump of the cast that would skip a pinned landing of a hit only the
skipped part has isn't taken, nor the path it jumps to (2026-11-22:
Rossi's sequence 2 and attack 4, whose late and uncontrolled variants had
landed beside the logged perfect and controlled ones; not Pogranichnik's
combo, whose slashes land on both paths; drivers.ts `replayCast`); and an
end of the cast that would drop a pinned landing wasn't reached: a kit
trigger's jump on the skill past that end, on an event the replay doesn't
see, was taken, at the frame that puts the landing at its kit frame
(2026-11-24, drivers.ts `eventJumps`: Snowshine's counter bash, attacked
in frames 0–51, which ends at 106 otherwise; 04d401ad257e's six bashes and
the Solidification and Shatters after them).
Pinned landings due in one frame land in the log's order (`loggedMs`). The
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
So are, by rule, the replay's landings no logged hit stands for inside a
stretch of 6 s or more with no logged hit at all (engine assumption
`enemy-away`, read only here: a boss phase, Si's 20–24 s and 13–14 s
ones; `zmdlogs totals` names the stretches) and, in a fight that ends in
a kill, at the killing blow's frame or after it (2026-11-23): a kill is a
logged total equal to the data's HP, or a capped last hit (the stages scale
the data's HP: tower016 ×5.5, tower015 ×7.6; 2026-11-24), and the killing
frame is the replay's landing of a killing hit when sooner. A landing
of a logged hit without a reading (Si's burst, Fixed DMG) is that hit's
part at the replay's own damage. An enemy status the log lists with no
giver in a fixture that names givers is the stage's (Hard 27's
Electrification) and comes from the log like a buff no kit defines
(enginecheck.ts `logOnly`). The Endministrator is read as the variant
her keys name (logs.ts `withEndminVariant`: chr_0002_endminm_* beyond
the combo is the male's kit).
A stage's damage factor (a stage's shield phases: 8915's Skydrummer ×0.5,
×0.05, ×0.2; c6d8's ×0.1), which no table the project reads has and no
listed buff marks, is the fixture's hand-written `stageFactors`
(2026-11-26): every hit logged in a window `[from, to)` ms, and the
replay's landings then in the totals, take its factor in the
multiplicative zone (enginecheck.ts `stageModifiers`, in every reading and
the log-listing ones); its evidence is every operator's hits there at that
one round factor (`efsim zmdlogs offsets --all`'s last section, buildoffsets.ts
`factorStretches`, since round 17; before, scripts/probes/stage/stage-factors.ts
on `zmdlogs hits --json`), and the `replay` view's LAND lines and the `bursts`
rows show the staged damage beside the replay's own (enginecheck.ts
`stageNote`). Not a fudge per hit: one factor per window, from all
four operators' hits at once, as a build override is one input from many.
A fight against several enemies of one template, which the log names by one
enemy id (so the import couldn't put it under fixtures/multi-target/), is
the fixture's hand-written `severalTargets` with its evidence (2026-11-27,
9c6e): one operator's status event twice within a frame (one enemy can't
burst twice at once) and kills before the fight's end with hits going on
(scripts/probes/targets/two-targets.ts), or, for Hard 33's Woodcraft Slugs
(6339, 7b54), a logged total of whole slugs (9.6 Max HP, eight of 1.2),
kills at whole slugs of damage, two kills at one ms and one hit's key at
one ms with values its debuffs can't both give
(scripts/probes/targets/slugs.ts). Its snapshot entry carries the
`several targets` key and the scoreboard gives it a row of its own, out of
the development and earlier-pending means (scripts/accuracy.ts
`withSeveralTargets`). Its listing is every target's under the one id
(7b54: two slugs' hits under one listing, ×1.198 apart).

**Several targets: per-target state on the check's side** (2026-11-27,
engine assumption `several-targets`, reading `targets`; `one`: the check
before, one target, the replay's enemy shedding every debuff at each kill,
`logged-purges` `log-kills`). The simulation keeps one enemy; the replay
and the check hold what the log needs per target (packages/logs
targets.ts):
- **The targets a fixture has:** `severalTargets.atOnce`, the most alive
  at once (the stage's: Hard 33's eight slugs, Hard 31's two Wanderers),
  and `fromStart`, all of them there from the fight's start (the slugs:
  none arrives later, so a kill leaves the others); without them, two at
  once, arriving as others die.
- **Which logged hits one landing stands for** (the placement's twins,
  logcasts.ts placeWith, 2026-11-27): ZMDLogs logs a landing once per
  target it reached, a stop's batched landings one after another, each
  with its targets in one order (7b54 15.60 s: Si's slashes 6040 6569 6040
  9853* … = 4 slashes × 2 slugs). Where value can't tell a twin from the
  next slot (the slots' multipliers alike), the batch's targets do
  (targets.ts batchTargets: the least count k with hit i and i + k of one
  target by value for every i, one target's two hits having one value, a
  crit and a non-crit the crit factor apart; a batch at least two landings
  long, else the count an earlier batch of the cast read); a used-up
  combo's landing one flush (150 ms) after its last, of its value and with
  no cast event between, is its last landing on another target (7b54
  16.48 s, a third slug's final). `zmdlogs casts --choices` names the rule
  of each twin (`batch` with its targets, `later`, `value`, `used`).
- **Which target a logged hit is on**, in time order: two logged hits that
  one replay landing stands for (one hit's key at one ms, twice in the log)
  are on two targets while there are targets for both; a capped hit kills
  its target; otherwise the hit is on the alive target its value fits
  (±1, the check's primary reading with that target's debuffs), the one hit
  last first, a new one (while `atOnce` allows) only when none fits, and
  where none fits at all, the one hit last. The log has no target per hit
  and lists every target's debuffs under the one id, so the values are the
  one evidence, as they are for a crit the log leaves out.
- **Which debuffs each target carries:** the units of a hit's primary
  reading that sit on the enemy (each kit buff with `target: "enemy"`,
  and the enemy's Corrosion, Electrification and Breach), each an
  instance of the replay's (its `appliedAt`). A target that got an
  instance keeps it to its expiry; one whose hit's value showed it
  without an instance never gets that instance later (an application
  reaches a target when it lands or not at all); an instance a target
  hasn't been read under yet is open, and the first hit that fits under
  one choice of the open ones only decides each (on in every fitting
  choice, or off in every one), the others stay open and read on. A
  kill ends its target's debuffs only: the replay's enemy keeps them (no
  `log-kills` purge), and the check reads each hit with its target's.
- **A kill gap with targets left** (`fromStart`, fewer kills so far than
  `atOnce`): the replay's enemy stays (kill-gaps doesn't hold it away), so
  a landing there applies its debuffs (6339 14.09 s: Camille's
  Susceptibility on the next slug, its hit unlogged on a shielded slug),
  and the totals leave its landings out as an away stretch's (the log
  records every hit that deals damage).
- **The totals:** a replay landing counts once for each logged hit on
  another target that it stands for (9c6e's second Wanderer: "a landing a
  teammate's hit's"), each at its own primary reading, where that hit's
  value fits its target's state: a twin no state fits stays log-only
  (`targets-ungated` counts it too: 7b54 −3.3 → +21.5%, its 47.2–48.1 s
  combo read ×1.26 high on every slug, 9c6e −11.3 → +7.4%; the row's mean
  8.3 → 13.1%, measured 2026-11-27 with the twins above).
- **A target's death in the replay** (2026-11-27): a kit trigger on the
  engine's `targetDeath` event (Camille's `vesperwings_move`:
  listen_target_dead → reset_target → projhit_sub →
  normal_skill_abilityrange, the battle skill's damage, Heat infliction
  and the debuff with the time it had left on the next slug) runs where
  the log shows its hit (targets.ts deathMoves: 6339 ×5, 7b54 ×1): the
  replay makes the death at the logged kill before it (within 1 s; else
  the trigger's lead before the landing) and pins the landing at its
  logged frame (engine targetDies `landings`: the projectile's travel,
  0.23–0.54 s after a kill, isn't in the data). The normal_skill event
  ZMDLogs logs at four of the six is the move's record (moveEvent), no
  press; under Camille's kit assumption `vesperwings-move-cast` `battle`
  the move is a battle-skill cast for the team's cast triggers (castEvent:
  Si's Yinglung's Edge). `zmdlogs replay` prints each as a DEATH line.
  A move onto a shielded slug deals 0 and isn't logged, so it isn't made.
- **Every logged kill a death** (2026-11-27, replay assumption
  target-deaths, default `kills`; targets.ts targetDeaths): in a fight
  read per target the replay makes a death at each logged kill before the
  log's last ms (two at one ms one death: one enemy), and at a move no kill
  is the death of. Every kit's targetDeath triggers run there, as the data
  has them on the dead target: Laevatain's passive_enemy (abilityEvent 1)
  absorbs its Heat layers as Melting Flame (kit trigger death_absorb), so
  the next target's Heat is its own (6339: no Heat burst after Camille's
  moves, Melting Flame 4 at 32.24 s). An operator whose trigger lands a hit
  (Camille) runs its targetDeath triggers only at the deaths its landing is
  logged from (engine TargetDeathOptions.except): elsewhere its listener was
  on another target or it moved onto a shielded slug. Of the other listeners
  the data has (BuffData abilityEvent 1 on a buff on the target), Arcane's
  spell_vulnerable's are all disabled and Typhoeus's combo_trigger_combo has
  none; Si's inkhurteffect and normal_skill_check move her Artful Intent's
  record onto an ink phantom (SpawnAbilityEntity inkphantom, linkline), an
  entity the kit doesn't model (not built); Zhuang Fangyi's, Seraph's and
  Yvonne's are in no several-targets fight.
- **Statuses per target** (2026-11-27, replay assumption target-statuses,
  default `per-target`): the replay is made twice. The first, with one
  enemy, gives the assignment (assignTargets); enginecheck.ts
  replayTargets turns it into each kit-hit landing's targets (its logged
  hits' targets, the hit its ref names first) and each logged kill's
  target, and logcheck.ts logBuffReplay makes the replay again with them
  (ReplayOptions.targets, engine TimelineScenario.landingTargets). The
  engine (timeline/targets.ts) keeps the enemy's statuses (infliction,
  reactions, physical statuses, Vulnerable, controls) per target: a landing
  lands on its first target (by its ref, else operator, event and frame
  ±1; one without an entry, a trigger's hit or a replay-only landing, on
  the target hit last) and applies what it inflicts on its other targets
  too (their bursts and reactions their own landings, LandedHit.target;
  the others' statuses before it recorded, `otherTargets`); a burst and a
  status tick run on their own target; the world's holds and stops shift
  every target's (a freeze the current one's); each kill is its target's
  death (targetDies `target`: its triggers on its statuses, which then
  end; two kills at one ms two deaths). The check reads a hit at its
  target's Corrosion, Electrification and Breach levels (atItsTarget:
  values, not units), and the second assignment reads each candidate
  target at its own statuses in the replay (fightTargets; the replay's
  target ids are the first assignment's, and a new target of the second
  takes the id of a target its landing reached that no target has yet,
  else an id no landing names: SECOND_PASS_TARGETS `mapped`, targets.ts
  AssignOptions.ids `landings`, 2026-11-27; numbered in order of first
  hit, 7b54's ids named other slugs than the landings' for 147 of 210
  hits, 55 with the ids mapped: the hits the two assignments put on other
  slugs; holding each hit to its first-pass target, `fixed`, measured
  worse, 7b54 plain 151 → 142). While the check's assignment from a replay
  puts a hit on another target than that replay was made on, the replay is
  made again on it (logcheck.ts TARGET_REPLAYS, at most three: 7b54's
  third replay gives its own assignment back, every hit on one of its
  landing's targets; 6339's and 9c6e's second assignment is their first).
  Stagger, the debuffs (kit buffs
  on the enemy, read per target as before) and the enemy's clock stay one.
  Measured (the row, against `one`): plain 72.1 → 75.6%, mismatch 14.5 →
  11.2%, mean |damage error| 7.6 → 10.4%: 7b54 plain 121 → 151 (Laevatain's
  Melting Flame from each slug's own Heat: her 16–31 s and 39–44 s hits
  match, Scorching Heart's timing), −1.0 → +4.0% (its 16.36 s Si combo
  twins now fit, −7.3 points of log-only gone, leaving the shielded slugs'
  replay-only landings); 6339 −10.4 → −16.1% (the 25.03–28.47 s Combustion
  ticks of a dead slug gone, −3.3 points of replay-only, and its 29.26 s
  Laevatain combo hit lost, −1.9: its `if` needs Combustion or Corrosion
  on its slug, which only a landing the log doesn't show, on a slug then
  shielded, can have given); 9c6e plain 314 → 310 (a twin's second
  target missing a status its unlogged applier gave: 74.47 s Liino's
  ultimate on T6 without the Electrification the log's value has).
- **The Stagger per target: checked, not built.** The logged `poise.bar`
  is the hit's target's bar: a slug's first logged hit reads its full bar
  (60) less the hit's Stagger, its later hits count down from there
  (6339 14.80–19.91 s, 7b54 29.50–31.05 s and 33.46–36.84 s), which one
  bar can't give; but the twins at one ms carry one bar between them
  (9c6e 52.49 s: 73 and 83 on both targets, one target's 103 − 20 − 10,
  the other's last read was 155). In the three fights the replay has 2
  Staggered landings and the log 1 (6339 20.37 s, both), so a bar per
  target would move at most a hit's damage and 7b54's 46.47 s break
  (which times Arcane's lasers): left (scratch/poise.ts's counts in the
  2026-11-27 journal entry).
Only these fixtures read it (no simulation, no hold-out without the mark),
and the Stagger, the shielded slugs' landings and a target's statuses from
landings the log doesn't show are still the one enemy's or missing.
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
level by hand. An override may set skill levels group by group
(`skillLevels: { basic: 9 }`, 2026-11-23) where the export has none (the
Endministrator's roster entry: 12 assumed); fit-build doesn't vary them,
so the evidence is a skill's hits at one ratio of its scales
(SkillPatchTable).

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

**Each assumption kind's fact** (round 15, low-plain-low-mismatch report
point 2: the replay read crits from the log that the check's primary
reading never took, so 418 of Rossi's matches were "assumed: crit"). Per
kind of assumption a reading can carry: the fact, where the replay decides
it, what the primary reading takes, and when the check tries the others.
The code is packages/logs/src/assumptions.ts `ASSUMPTION_FACTS` (a row per
kind, so a new kind needs one); tests/assumption-facts.test.ts holds this
table to it and checks, on a log's hit records, that an alternative of a
fact the replay decides comes only with the replay's reason for not
deciding it there (`zmdlogs assumed --operator <op>` folds them by kind).
"Candidate" marks a fact the replay decides that the check still tries
both ways: where the next "assumed, but the replay knew" is likeliest.

| Kind | The fact | Decided by the replay | The primary reading takes | Alternatives tried |
|---|---|---|---|---|
| `crit` | whether a hit the log gives no crit flag crit | replaycrits.ts shownCrits, layerCrits, valueCrits (BuffReplay.critSource) | the replay's read crit, else none (engine assumption check-crits `replay`) | a crit where the replay read none; both ways in the log-listing fallback's readings (logcheck.ts candidates: candidate, a fallback stays one) |
| `noCrit` | as crit | as crit | as crit | no crit where the replay read one |
| `boundary` | whether a buff starting or ending at the hit applied | its kit buffs (BuffReplay.kitBuffNearChange: unsure within 500 ms); none for log-only buffs | the replay's kit buffs; log-only buffs inside the hit | a kit buff changing near the hit as listed or off; the log-only boundary buffs' subsets |
| `corrosion` | Corrosion's level where the log lists it without a value | its own Corrosion at the landing (ramp, cap) | the replay's level | levels 1–4 where the replay has none at the hit |
| `stacks` | a reaction status hit's level | its arts state, replayed again with the levels the log shows (logcheck.ts loggedReactionLevels) | the replay's level | every other level of a non-burst reaction, even where the log decided it (candidate) |
| `kitHit` | which of the event's kit hits the logged hit is | the placement's landing on the path the replay took (logcasts.ts placeHits; engine paths.ts pathLandings) | the replay's landed hit | the event's other kit hits, always (a player's timing chooses some: Rossi's perfect combo); zmdlogs groups rows a cast matched only so |
| `situational` | the enemy's side of a kit hit's condition (KitHit.if, extraScale) | its enemy state at the landing, not checked against the log's reactions | the replay's situation, its enemy side left open | taken as met and as not met (candidate: the replay's inflictions) |
| `eventCount` | a combo's window count behind a value | the window it opened (ReplayCastFacts.windowCount) | the replay's count | counts 1–4 where the replay can't say |
| `value` | what a value reads that only a fight knows (hitvalues.ts: consumed stacks, the enemy's stacks) | the operator's side from the landing's facts; the enemy's side not taken | the landing's facts | over the value's range where the facts don't say (candidate: the enemy's side) |
| `unloggedCastBuff` | buffs the hit's cast consumed that the log doesn't list | the buffs its cast consumed (ReplayCastFacts.consumed) | the replay's | 0 up to the most layers where the replay can't say |
| `unloggedOwnBuff` | the hitter's own kit buffs (or their crit parts) the log doesn't list | nothing | none | with them (logcheck.ts unloggedOwnBuffs), the old check's reading |
| `link` | the Link stacks a battle skill or ultimate used | Cast.link (ReplayCastFacts.link) | the replay's | Link 0–4 where the replay can't say |
| `enemyAura` | an enemy-side team aura the log doesn't list | nothing | none | with it (logcheck.ts unloggedEnemyAuras) |
| `layers` | a layered buff's layers where the log lists it once | a kit buff it judges (its layers); none for one it can't judge | the replay's layers; one layer for an unjudged one | each count up to its maximum for an unjudged kit buff (enginecheck.ts unjudgedLayered) or a log-only one |
| `unquantifiedFromKit` | the value of a buff the log lists without one | nothing | none | valued from the kit that names it (logcheck.ts unquantifiedFromKit) |
| `stagger` | whether the enemy was Staggered at the hit | its Stagger, held to the log's listing (loggedStaggerSteps, holdStagger) | the replay's | the other way where the replay's Stagger changes within 500 ms |
| `logListing` | every buff as the log lists it, where no engine reading fits | nothing | the engine's reading (a fallback match is the log's) | the log's listing, the fallback (LOG_LISTING) |
| `recordEnd` | when a recording buff's record stopped before its burst | the recorded burst's record (recordedburst.ts) | the replay's record | the record's end shifted where the replay's burst value doesn't fit |

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
packages/engine/src/assumptions.ts, the simulation's; replay-assumptions.ts, the replay's own; their evidence in
[assumptions.md](assumptions.md)), as the kits' do. Every reader takes the run's readings through `readingOf`
(`@efsim/engine`): a helper that reads one is handed the replay's `assume`, never left to its default
(tests/assumption-readers.test.ts traces every read of a log's check and fails a default the run didn't give).

**What the log records** (round 3, 2026-11-18: facts agents measured and
left in code comments or reports). ZMDLogs' battle detail, as the importer
keeps it (packages/logs/src/zmdlogs.ts; `efsim zmdlogs raw` shows a raw
detail):
- **Times** are ms from the fight's start, in the world's time: other
  casts' time stops and hit-stop are in them. The engine counts frames
  (30 a second): `LandingFacts` statuses' `appliedAt` and `TimeStop.start`
  are frames; `LogEffect.since`, `LogHit.t`, `LogCast.t` and the placed
  casts' `start` are ms (`zmdlogs hits --json` gives `appliedAtMs` too).
- **Timestamps are batched** (round 5, Arcane's Imprisonment and INT
  lasers): many hits of different operators share one ms, during and
  after time stops most of all (a7a7 48.78–50.01 s: seven timestamps for
  about 40 hits; an `attack4`'s eight hits at frames 2–11 at one ms). The
  log flushes in steps of about 100 ms and at a stop's end, so a residual
  under ~0.2 s, or one at a ms many hits share, isn't timing evidence;
  "uneven batches" of a periodic hit may be the log's, not the game's.
  World time between two moments: `efsim zmdlogs worldtime`. The spacing
  at one moment (the gap to the moments before and after it): `zmdlogs
  lanes` beside each end, `zmdlogs ends` per moment (round 16).
- **The Stagger bar** (`LogHit.poise.bar`, round 16; 2026-11-26, a stop's
  batched landings): the bar *this hit leaves*, so the bar before it is
  `bar + dealt` (replaysteps.ts `loggedPoiseBars`). It falls in the game's
  order inside a batched ms, the log's only record of that order
  (castassembly.ts `batchOrder`): read as rising, c4f3's bars at 7.05 s
  put the wrong combo first.
- **A hit's Stagger origin** (`LogHit.poise.origin`, imports and refreshes
  since 2026-11-16; 2026-11-23, Si's strokes): the skill whose cast the
  hit's Stagger is credited to, the skill id the hit's own skill inherits
  its cast from. It tells hits of one event key apart by what launched
  them: Si's ink burst after a Final Stroke (origin `normal_skill_2`) from
  one at an Inksoul's expiry (`normal_skill_inkmove_2`). Only on hits that
  dealt Stagger. `efsim zmdlogs census --select 'origin:<re>'` counts them.
- **A hit inside its own cast's stop** (2026-11-23) is logged where the
  stop ends, not at its frame: Liino's combo hit 1 (frame 9, the world at
  0.01 to frame 10) comes 0.1–0.9 s (median 0.23 s) before hit 2 (frame
  33), and no teammate's hit is logged in the second before it. The
  placement starts such a cast from the stop's end (logcasts.ts
  `ownStopLoggedFrame`, a scale of 0.05 or less at the hit's frame: today
  Liino's combo and Last Rite's ultimate slash).
- **A Stagger-breaking hit** (2026-11-27, engine assumption `break-hold-place`) is logged at the break's hold's
  start mostly, but some inside it or at its end (9090afbacec9 128.92 s: the clocks 0.32 s late at its ms, the next
  moment 0.10 s later). No moment falls inside a hold, so under the reading `moments` the replay ends the hold at the
  next moment where that comes sooner than the hold lasts (holds.ts `breakHoldStarts`;
  scripts/probes/stagger/break-place.ts); the default, `ms`, holds at the breaking hit's ms.
- **Holds no cast explains** (2026-11-22, open-problems "The buff clock"):
  the log's ms run through world holds it records nothing of (perfect
  dodges' 0.512 s slow-down each, never while the enemy is Staggered;
  pauses such as 9c0b's first ten seconds). Buffs and the enemy's tick
  timers alike run that much longer in the log's time than the placed
  casts' stops say: a run listed past the replay's expiry is the game's
  (the damage agrees, 802 hits against 92). The replay places the holds
  once per fight from every clock the log shows (its buffs' runs against
  the replay's own expiries, the enemy's listed statuses' runs, the enemy's
  tick series, Corrosion's ramp steps read from the hits' damage;
  packages/logs holds.ts, rampsteps.ts) and holds the world's clock there for every timer, then keeps
  a listed buff on to the log's end (engine assumption `hidden-holds`,
  default `placed`; holdinputs.ts `heldToLoggedEnds`). Where they fall:
  `efsim zmdlogs holds <fixture>`.
- **Cast events** (`LogFixture.casts`: the detail's skill events without a
  damage value) are presses as the log has them, not the kit's frame 0:
  - battle skills: the event is at the placed start (within a frame or
    two);
  - combos: the event lags the kit's frame 0 by 0.3–0.7 s, differing by
    operator (its own slow-down: about none of it is world time; Typhoeus's
    median 0.53 s, Arcane's 0.29 s, `efsim zmdlogs casts --event-lags --all`,
    round 22);
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
  lines) or per operator and kind with `efsim zmdlogs casts --event-lags
  --all` after a placement change.
- **The placement's passes** (round 12, remaining-leads report point 2;
  logcasts.ts `placeHits`' comment): pass 1 places each operator's casts
  with no other cast's stops; pass 2 again, from pass 1's stops (the rules
  that place one cast against the stops it lies in: `heldStart`,
  `beforeStopStart`, `eventStopStart`, `joinable`), which pass 2 itself may
  move, so it isn't a fixed point (`settleCheck`); pass 3, after the
  placement settles, the rules that compare one cast's stop with another's
  as placed (`inTurn`). A new rule that reads another cast's placed stop
  goes in pass 3: inside pass 2 it cascades (4360, 9c6e). What the passes
  leave: `efsim zmdlogs placement <fixture…|--all>` (OVERLAP: ultimate
  stops still overlapping, pinned in tests/logcasts-stops.test.ts; SETTLE:
  casts a third pass would move).
- **One key, several groups** (round 5, Liino's beats): when a logged key
  is a hit of several groups (a skill, a trigger on a cast, a trigger on a
  buff's ticks), the placement (logcasts.ts `placeWith`) first drops a
  trigger group already placed once since the latest cast it fires on (a
  trigger on a cast fires once per cast: `anchorFree`), then `choose`
  takes the group whose anchor (the skill itself, or the skill a trigger
  fires on plus its delay) starts within ANCHOR_MS (1.5 s) and closest,
  else the chain step after the operator's latest cast whose windows list
  it, else the first in kit order. A kit that moves hits from a cast's
  frames to a ticking buff meets this choice: check the placement with
  `zmdlogs casts` (and `measure -- --changed placement`).
- **Hidden casts logged as another skill's**: an entity's CastSkill is
  logged as a cast of the skill that spawned it. Arcane's combo appears
  again about 6 s after each real one: the CastSkill of
  `combo_skill_abilityentity_end` at the seal's one tick (`trigger_time`,
  its duration − 0.5 s: an explosion follows about 0.45 s later, the seal
  and its Susceptibility end 0.5 s later); in INT the lasers' start
  (`seal_finisher_wisd`, 0–4 frames before the first laser) and sometimes
  `seal_again`'s start are logged under the combo's id too. The replay
  takes them as timing facts (2026-11-22): a kit buff's `ticksLoggedAs`
  brings or holds its tick to such an event (`endFollowsTick` moves its end,
  `childOf` its children's), and a combo's own event is one within 1.5 s
  of its start or last landing (`withLoggedCasts` COMBO_EVENT_MS).
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
- **An ultimate's (first) cast event sits at an edge of its time stop,
  mostly the end** (placement leads, 2026-11-24): Si 26 of 35, Liino 13 of
  21, Laevatain 11 of 16 at the stop's end, a few at the press, the rest
  where several stops overlap (scripts/probes/placement/ult-events.ts).
  A world-time distance across the cast's own stop is about 0, so "0.02 s
  of world time apart" can be 1.8 s of log time: `zmdlogs instances` and
  `replay`'s EVENT lines print both and the event's place (query.ts
  `castEventPlace`: at its press, at its stop's end, inside a hitless
  stretch, at no clear edge).
- **A cast event under a key a kit buff ticks as may still be a cast**
  (round 11): Zhuang Fangyi's Empyrean ends under her ultimate's key
  (`ticksLoggedAs`), and 3aa6's seven real ultimates, whose hits aren't
  placed, are logged the same way. Whether the replay made the cast is its
  decision (the buff on or not), so a view decides from the replay's
  applied stops (query.ts `replayTimeStops` with the replay), not from the
  key.
- **Si's battle-button events are mostly hitless**: every 3.2–3.6 s, often
  while she does basic attacks; a real battle skill has its hit 400–650 ms
  after its event. Whether the rest are presses is open (the replay makes
  some into strokes: `withLoggedCasts`). `zmdlogs instances` lists them as
  "an event only".
- **Liino's stance**: her `normal_skill` events every ~3 s during Vocalist
  Stance are its beats or End Stance presses (End Stance is never logged
  under its own id).
- **Arcane's Imprisonment end is logged as a combo cast** about 6–9 s
  after each real combo (above, "Hidden casts"): the seal's tick, 0.5 s
  before the seal ends, not its end; `zmdlogs instances` marks it.
- **A hit may be logged under another operator's key** (Valiant's extra hit
  as `chr_0015_lifeng_ultimate_skill`).
- **A teammate's `attack1` isn't a swap**: the controlled operator is
  shown by basic hits that deal Stagger (`efsim zmdlogs control`).
- **Not listed at all**: Haste, shields, heals, Whirlpools; Vulnerable
  without stack counts. A missing listing proves nothing there.
- **A layered buff of one timer is listed once** (stackingType 10: one
  instance whose layers add up, Ember's Pay the Ferric Price): one entry of
  one layer's value whatever its layers, so the listing can't say how many
  (04d4's hits under it read ×1.023 / ×1.085 / ×1.147, equal steps).
  `zmdlogs differences --clusters --operator <op>` prints a group's ratio
  clusters (the damage-factors round, 2026-11-26).
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
- **A hit's crit is often not logged** (`crit: null`): every log gives
  Rossi's ultimate stabs none, and some hits around them. The replay
  counts as crits those a trigger on crits shows by its own logged hits
  at the same ms (replaycrits.ts shownCrits: her Seething Blood extras);
  the rest the check tries both ways ("assumed").
- **`isEnable false` in game data means the action never runs**
  (`efsim gamedata tree` prints DISABLED on its line).
- **A raw lane's `start–end` isn't the buff's life** (`zmdlogs raw`): the
  end is a logged event's time near the last listed hit (c83c 73.585 s:
  Laevatain's attack1 hit), not an expiry. A buff's listed end is
  bracketed by its last listed and next unlisted hit (`zmdlogs lanes`).
- **A fallback match is a match the replay didn't make**: the log's
  listing fitted where the replay's reading didn't, so the counts look
  fine while a modifier is missing (round 5: Perlica's combo hits matched
  at ×1.500 of the primary reading). `zmdlogs groups --operator` ends with
  the fallback matches by skill event and their median logged ÷ primary.
- **`predicted` in `zmdlogs hits --json` isn't always the verdict's
  number** (round 5, Rossi's bleed ticks: "plain" matches at −31.7%): it
  is the primary reading of the replay's landing, with the replay's own
  crit where the log gives none; the verdict's reading is
  `verdictReading` (`verdictError`).
- **The replay may take a logged cast event as another cast's**
  (`withLoggedCasts`: a placed cast of the same skill within 2.5 s of
  world time; a7a7's INT lasers' events were taken as Arcane's combo's):
  `zmdlogs replay` prints an EVENT line per cast event with what it made
  of it (the placed cast's, a buff's tick, a press, a cast, ignored).

**Questions and the command that answers them** (round 4; every command
takes a fixture's path or its id, e.g. `0c14`, and operators by name):

| Question | Command |
|---|---|
| The casts of an operator, as the log means them | `efsim zmdlogs instances <fixture> [--operator]` (for a skill that stops the world, where its first cast event sits: at its press, at its stop's end, …; its log-time distance to the placed start) |
| An operator's Arts Bursts, logged against replayed, each side's likely cause and the stops between | `efsim zmdlogs bursts <fixture…\|--all> [--operator <op>] [--from s --to s]` (`burstRows` in a script) |
| The replay's enemy statuses: each burst, reaction, consumption and tick, on which target, what it dealt, the statuses after it; the deaths | `efsim zmdlogs statuses <fixture> [--target n] [--operator <op>] [--from s --to s] [--inflictions]` (views.ts statusesView; `--inflictions`: each target's element × stacks where a frame of kit landings changed it, with those landings) |
| Whether the check reads a hit on the target the replay landed it on | `efsim zmdlogs hits <fixture>` (`≠ landing T<m>` on a line; `--json`: `target.landing`, the landing's targets; hitexport.ts targetMismatches) |
| A layered kit buff's layers: the log's count, the replay's, the value's | `efsim zmdlogs hits <fixture…> --layers <owner:id>` (per hit the game buff's listed entries and their lane starts, the reading's layers, the layers the logged value implies; then by the log's count) |
| What a kept tail stands for in the log | `efsim zmdlogs decisions <fixture> --why-kept` (per TAILKEPT line, the replay with that tail cut: the logged hits whose landing, class or primary reading moved; counterfactual.ts) |
| How often X happens, X near Y (a claim's count) | `efsim zmdlogs census --select cast:\|event:\|buff:<re> [--near …] [--window=a,b] [--list]` (the window in ms; `=` for a negative start, as the `rerun:` line prints it) |
| What a listed buff id is in the kits, whose hits list it | `efsim zmdlogs buffs [--buff <re>]` |
| A buff's listed runs (since, first, last, next unlisted hit) | `efsim zmdlogs lanes <fixture> --buff <re> [--world]` (`--world`: each run's length with the stops taken out) |
| The world's time between two log moments, the stops between | `efsim zmdlogs worldtime <fixture> <from s> <to s> [--assume …]` (the stops of the replay's casts: placed, from a cast event, inferred; the hold placement's own list since round 15, castassembly.ts `replayStops`: an event the replay read as a buff's tick is a line without frames; `replayTimeStops(data, fx, placement, replay)` in a script, never without the replay for a count, nor `castTimeStops`, which has the placed casts' only) |
| The fight's hidden holds (unlogged dodges, pauses) the replay places: each 0.512 s unit, its earliest and latest time, the clocks spanning it | `efsim zmdlogs holds <fixture> [--verbose]` |
| The frames the holds actually hold in a window, step by step, beside the slow-downs applied there and the log's breaks | `efsim zmdlogs holds <fixture> --steps <from>-<to>` (seconds; round 19) |
| Why a buff's or status's run is (not) a clock of the holds: the run paired with each instance, the rule that skipped it, kept or dropped | `efsim zmdlogs holds <fixture> --why <re>` (`owner:id`, `Perlica:wpn`, `status:corrosion`); its last lines: whether each instance was kept to the log's end, and why not (heldToLoggedEnds) |
| Which bounds and holds a change moved (bounds added, removed, each unit and bound before and after) | `node scripts/cli-ab.ts <ref> --holds <fixture>`; any command at two commits: `node scripts/cli-ab.ts <ref> [--key <re>] -- <efsim args>` |
| Corrosion's ramp as the hits read it: each hit's fitting step against the replay's, the hidden hold that allows against the one placed | `efsim zmdlogs ramp <fixture> [--verbose]`; `--held`: what held the replay's ramp (each stop's share, placed holds, the rest) |
| What the data compiler made of a skill's time dilations (slow-down, reset, dropped and why), and the world frames each slow-down holds (Σ(1 − scale); several together) | `efsim kit <operator> --skill <re>` ("time dilations", "holds"); every skill: `efsim gamedata dilations [--dropped]` |
| The slow-downs the replay's timeline applied against the log tools' stop list | `efsim zmdlogs replay <fixture> --stops` (STOP: as listed, another length, or on one side only); over several logs, the differing ones and a count per kind: `efsim zmdlogs stops --all --differ` |
| Who is controlled when | `efsim zmdlogs control <fixture>` |
| Is a key a timer, a cooldown or event-driven | `efsim zmdlogs cadence --operator <op> --event <re>` |
| A skill's frames, windows, uncuttable frames, skill group, what each hit inflicts | `efsim kit <operator> [--skill <re>]` |
| Where a skill's playhead jumps or ends (the data's, the kit's, the triggers' jumps on it); a trigger's hits, gains, buffs and jumps | `efsim kit <operator>` ("paths:", each trigger's actions below it) |
| One subtree of a data file, by its JSON path | `efsim gamedata tree <id> --path <path>` (paths as `who` prints them; a branch of only presentation says so) |
| The logged hits in a window of time, their verdicts, the replay's crit and its source | `efsim zmdlogs hits <fixture> --from s --to s [--operator] [--event <re>] [--zones]` |
| The pair the check judges a hit by (for statistics across logs) | `zmdlogs hits --json`: `graded` (the uncapped logged value against the verdict's reading) |
| Which single disagreement, taken the log's way, makes an off hit fit | `zmdlogs hits --json`: `counterfactuals` (each difference, the crit flipped, a boundary kit buff on / off, Stagger), against `graded` |
| Every one-sided landing across fights, for a question of your own | `efsim zmdlogs totals --all --json` (a JSON line each, cached; then `jq`) |
| Which game-data files use an action type, with its fields | `efsim gamedata find <type>` (e.g. `SwitchModeAction`; an action a disabled parent switches off says so, `--enabled` leaves it out) |
| Every listener of one event across kits (a target's death, damage taken) | `efsim gamedata handlers abilityEvent <n>` (or `buffEvent <n>`: each handler, the action types that run and those switched off, ALL DISABLED where nothing runs) |
| Who creates a buff or casts a skill in the game data | `efsim gamedata who <id>`; its actions: `efsim gamedata tree <id>` |
| How long after its event each of a kit trigger's own landings (an entity's follow-ups, harasses, lasers) lands, in the replay and in the log; the follow-ups one side has | `efsim zmdlogs followups <fixture…\|--all> --operator <op> [--trigger <re>]` (LandedHit.fired, a replay's record; takes `--kit`, `--assume`; round 19) |
| What an ability entity (`abilityentity_…`, no file of its own in the export) does: the actions that spawn it and the skill it runs | `efsim gamedata tree <entity id>` (round 19) |
| An enemy's tables and its stage's own text (several targets, shields, phases: read it first for a stage log), a fight's total in Max HPs | `efsim gamedata enemy <enemy id\|fixture>` (round 19: Hard 33's "They are legion") |
| The open assumptions `--assume` takes, their readings and their evidence | `efsim assumptions [<re>]` (evidence: [assumptions.md](assumptions.md)) |
| Operator ids and weapon names of the logs | `efsim zmdlogs list --ids [--with <op>]` |
| Where the placement put each hit and cast | `efsim zmdlogs casts <fixture> [--from --to]` |
| The replay's landings, casts made against the kit, what it made of each cast event | `efsim zmdlogs replay <fixture>` (FORCED, INSIDE: uncuttable frames; CUTS: a legal interrupt cancelling pending hits; EVENT; `[crit …: source]` on a landing the log gives no crit) |
| How a kit buff's expiry moved; which window a refresh replaced | `efsim zmdlogs replay <fixture> --trace-buff owner:id`; `--kit-buff owner:id` ("refreshes the one from") |
| An enemy status's life in the replay: applications, holds (a moved application), expiry, beside the log's runs | `efsim zmdlogs replay <fixture> --trace-buff status:<status>` (`status:*` every one) |
| Which landings make a total: matched (predicted vs logged), replay only, log only | `efsim zmdlogs totals <fixture> [--operator <op>] [--by event]`; between two commits with `node scripts/cli-ab.ts <ref> -- zmdlogs totals …` |
| Every fight's total by where its error lives (matched, replay-only, log-only shares), largest first, and each group's means | `efsim zmdlogs totals --all --workers 3` (development logs); each group's means, the hold-outs' too, in docs/accuracy.md ("Where the total's error lives", from the snapshots' share keys) and `npm run measure`'s summary |
| Which landings are one-sided (replay-only, log-only) and why: where each sits (a twin, its cast's logged landings, the replay's reason), its nature and skill kind | `efsim zmdlogs totals <fixture> --kinds` (one fight, each landing); `efsim zmdlogs totals --all --kinds --workers 3` (ranked per group, then by operator and key); `--json` (a line per landing with its `share` of the fight's logged total, the fight's `logged`, `fightError`, `stage`, `severalTargets`: a ranking is a jq line); `--skip <id\|stage\|several>,…` leaves fights out; the hold-outs' means by kind only in `npm run measure` ("One-sided landings by kind") |
| Does a kit buff run long or short: each instance's first expiry, its expiry on the replay's own clock (no hidden holds, no log ends), how it ended there and in the check's replay, the log's run and the lateness past the own expiry | `efsim zmdlogs clock --kit-buff owner:id [fixture…]` (default every development log with the owner; `kitBuffClock` in a script; "check from …": the check's instance nearest within 5 s, its start moved by the hidden holds). The check's window (`replay --kit-buff`) is already cut or held to the log's end: not the buff's natural end |
| Per hit: engine modifiers, the log's listing and reading | `efsim zmdlogs hits <fixture…\|--all> [--json] [--reading log] [--event <re>]` |
| Which zone or modifier moved at each hit between two commits | `node scripts/cli-ab.ts <ref> --key '^(\S+  t=\d+  \S+  \S+)' -- zmdlogs hits <fixture> --zones` |
| A build offset (off under both readings) | `efsim zmdlogs hits … --reading log`, then `zmdlogs fit-build` |
| A kit buff counted twice beside the game buff it is logged as (an unmapped listed buff of its owner or equipment with the same zone and value) | `efsim zmdlogs differences --all` (its last section, "Likely loggedAs"; packages/logs/src/loggedas.ts); the pending suite fails on a new pair |
| Which operators are off by one factor all fight, over every log (a missing food, a node, a weapon level) | `efsim zmdlogs offsets --all --workers 3` (a tight median of logged ÷ primary off by 0.3% and 2 damage on its median hit or more, since round 20: `*`, with the fit-build command, candidates by their mismatches; the log suites fail on one no buildOverride or OFFSETS_EXPLAINED entry accounts for); `--bound`: per operator and event, the factor interval that puts every clean hit within ±1 (empty: no one factor, with the factor fitting most) |
| Which single build change fits (a weapon skill level, a potential, beside nodes, the weapon's level and food) | `efsim zmdlogs fit-build <fixture> --operator <op>` (each candidate with its `[n inputs]`; weapon skill levels and potentials scored as singles since round 20) |
| What a DEF- or HP-scaled hit's base is made of | `efsim zmdlogs hits <fixture> --json`: `landing.base` (the expression, each attribute's panel line and sources, the fight's buffs on it) |
| Which kit buff moved a hit between two commits | `node scripts/cli-ab.ts <ref> --hits-zones <fixture>` (per moved hit, the modifiers that differ by kit buff and zone) |
| Which fight carries an operator's mean error; its kit's error or a log check rule's | docs/accuracy.md "By operator": **Largest** (the fight and its points of the mean), **Own matched / one-sided** (the `share own … operator <id>` keys: % of its own logged total) |
| A buff the log lists several times at a hit: each entry's lane start | `efsim zmdlogs hits <fixture> --json`: `listedSinces` |
| An operator's mismatches by cause | `efsim zmdlogs groups --operator <op>` (its last rows: the casts whose every landing matched only as the event's other kit hit, a path the replay didn't take) |
| What an operator's non-plain matches assume (a "low plain" lead's first step) | `efsim zmdlogs assumed --operator <op> [fixture…] [--kind <set>]` (by kind, kind set, event and kind, folded label; cached as `hits`; `zmdlogs hits --json` has each hit's `assumptions`); which kinds are facts the replay decides: "Each assumption kind's fact" above |
| Where a Link stack came from and which cast took it; two casts of one operator at one frame | `efsim zmdlogs replay <fixture>` (LINK and MADE lines; `zmdlogs decisions` lists them too) |
| Does a change help | `npm run measure [-- --with <op>]`; one half of it, or a log tool's old rule, without editing the tree: `-- --patch <diff> [--base HEAD]`; with no reference named and the snapshots not the code's own, it measures the merge base with main as `--base` (round 15; the summary's first line says so; `--against-snapshots` keeps the snapshots) |
| Which part of a batch moved which log | `npm run measure -- --split files [--group a,b \| --only a,b]` (each changed file's diff alone on HEAD, or `--base <ref>`; `--only`: those files one part, the rest another), `--split hunks [--only a,b]` (each diff hunk alone; one `split:<name>` comment marks the hunks of one rule) or `--split commits --base <ref>` (each commit against the one before), measured on the logs the whole change moved; per part, how many of the moved hold-outs it moves the same way |
| A constant's value (a window, a tolerance) | `npm run measure -- --set <file>:<CONST>=<value>`, or several values side by side: `--variant <file>:<CONST>=<v1> --variant <file>:<CONST>=<v2>` (the patch kept for docs/tried/) |
| A reclassification (a fixture marked or moved between groups) apart from a code change | `node scripts/accuracy.ts --compare <ref> --regroup` (the reference's entries in this tree's groups, then the change alone; the shares' groups too) |
| Why a guard of the replay or the placement didn't act | `efsim zmdlogs replay <fixture>` (TAILKEPT: a tail the cut's guards kept, and which guard, `[shown-own]` when the hit it cites is the cast's own landing; `zmdlogs decisions --all` counts the TAILKEPT lines by guard); `efsim zmdlogs casts <fixture> --choices` (a HIT's [joined: …]: the rule that joined it to its cast late; REALIGN: what the realignment by value did with a cast's key, or why it left it; a twin's rule, also on `replay`'s LAND line) |
| Was a rule change tried before | `node scripts/tried.ts --touching <file>[:<function>]` (or a reading id, a constant: the docs/tried/ diffs that touch it); `node scripts/tried.ts new <slug> -- <files>` keeps a measured, dropped change under a name no other diff has |
| A kit stack's value at each cast | `efsim zmdlogs stack <owner:stack> <fixture…\|--all> [--at-cast <regex>]` |
| The placement as records (a script or an A/B over it) | `efsim zmdlogs casts <fixture> --json [--choices]` (views.ts `castsRecords`); `node scripts/cli-ab.ts <ref> --placement` compares them by their fields |
| An idea on top of the tree, as a reading | `npm run measure -- --variant <id>=<r>`: each variant against the snapshots and against the same code without it (the plain run; `--no-plain` skips it) |
| Which hits a change moved | `npm run measure -- --hits [--logs <id>]` (summary and scratch/measure/…/hits.txt; a moved hidden-hold unit names the bounds that set its earliest or latest where they changed) |
| Which casts a placement change moved | `npm run measure -- --changed placement` |
| Ultimates whose stops still overlap after the placement; casts a third pass would move | `efsim zmdlogs placement <fixture…\|--all>` (OVERLAP, SETTLE: logcasts.ts `ultimateOverlaps`, `settleCheck`) |
| How late each clock runs across each kind of stop (enemy tick chains, a cast's landings against its kit frames, bursts against their delay), in and out of the log's Stagger, per combo operator; across a logged Stagger break | `efsim zmdlogs clocks <fixture…\|--all> [--clock tick,cast,burst] [--by operator] [--rows]` (clocksview.ts `logClocks` in a script; the log's Stagger spans: query.ts `loggedStaggerSpans`, never rebuilt by hand; "a Stagger break inside": the rows a Stagger's start falls inside, round 18) |
| Where the hold placement drops bounds across logs: by kind and what covers their span (the log's Stagger, combo or ultimate stops), against how many it kept | `efsim zmdlogs holds --dropped <fixture…\|--all> [--verbose]` (views.ts `droppedView`) |
| Equal steps in a group's ratios (a layered buff the log lists once) | `efsim zmdlogs differences <fixture…\|--all> --clusters [--operator <op>]` ("clusters: ×1.023 n=26, ×1.085 n=21, …") |
| A view under another reading (right after a measure names one) | every subcommand that replays takes `--assume <id>=<reading>` (packages/cli/src/commands/zmdlogs.ts `REPLAYING`; the others refuse it) |
| Which hits a variant itself moved | `npm run measure -- --variant <id>=<r> --hits`: "Variant n's own hits, against the plain tree" (the same code without it) |
| Which view answers a question (before writing a probe or suggesting a view) | `efsim zmdlogs which "<question words>"` (this table and the usage, ranked by the words shared; round 22) |
| A reading's effect per hit, both readings' verdicts side by side (a per-hit diff of two readings) | `efsim zmdlogs hits <fixture…> --against <id>=<reading>` (the hits whose class or primary reading it changes, both sides, the modifiers only one has, a count per change) |
| World time with the hidden holds out, or one operator's own stops left in (her own stop doesn't hold her clock) | `efsim zmdlogs worldtime <fixture> <a> <b> --holds --without <op>` (per stop source: the placement's list and the timeline's applied slow-downs; packages/logs replayclock.ts `replayClockStops`, `heldWorldMs` in a script; round 22) |
| Does an entity's or a status's tick series fit its period on some clock (every stop, her own left in, the hidden holds) | `efsim zmdlogs worldtime <fixture> --series <event re> [--period ms] [--gap ms]` (per tick chain, holds.ts `tickChains`; which clock each hold holds: [timeline.md](timeline.md#which-clock-each-hold-holds)) |
| How late the log's cast event of a cast comes after its kit frame 0, per operator and skill kind (before calling a press late) | `efsim zmdlogs casts --event-lags <fixture…\|--all> [--operator <op>] [--verbose]` (combos: their own slow-down; round 22) |
| The targets of a fight read per target: the check's, the replay's own assignment, the landing's, and how many replays it took | `efsim zmdlogs hits <fixture…> --targets` (`≠ replay T<m>`, `≠ landing T<m>`; `--json`: `target.replay`, `target.replays`; round 22) |
| Is there a freeze in these fights: each control status, whether it froze the enemy and to when, every target's statuses at it | `efsim zmdlogs statuses --controls <fixture…\|--all>` (round 22) |
| How many times the log applied a buff against the replay's trigger firings (a refreshed, layered or per-application buff), the SP at each | `efsim zmdlogs replay <fixture> --trace-trigger <owner:id> --against-starts <game buff re>` (round 22) |
| Why a TAILKEPT `needed` kept a tail: the lost hit's landing before the cut, the nearest one after | the TAILKEPT line itself (`paired with … ; with the cut: …`; TailKept.cites.lost; round 22) |
| Is a candidate battle usable before an import (parser, levels, kits, one target, the stage and the enemy in the data, already a fixture) | `efsim zmdlogs screen <battle id…> [--fetch]` (round 22; an enemy's facts the data lacks: `efsim gamedata enemy <id>`) |
| Is a refactor a move (the compiled data, every log's replay record the same) | `node scripts/identity.ts --base <ref> [--data] [--replay]` (round 22; the hold-outs a count) |
| Several patches on one base in one measure | `npm run measure -- --variant-patch a.diff --variant-patch b.diff` (round 22) |
| Did a reading only move what the replay doesn't pin: which hits lost their landing (and why: an `if`), which took another logged hit's landing (a slot shift) | `npm run measure -- … --hits` (per moved log a `landings:` line; hits.txt each hit's move) or `efsim zmdlogs hits <fixture> --against <id>=<r>` (`[lost its landing …]`, `[took the landing logged hit #n had …]`; packages/logs landingmoves.ts; round 23) |
| More variants after a --variant run, without measuring the plain tree again | `npm run measure -- --variant <id>=<r> --plain-from scratch/measure/<run>` (the same code, readings and logs; `--trust-plain` across a code change, labelled; round 23) |
| Where the replay's SP came from, and which logged casts it couldn't pay | `efsim zmdlogs replay <fixture> --sp` (SP lines: each grant's operator and source, each cast's spend; TOPUP lines always; TimelineState.spGained; round 23); across logs: measure's "Team SP the replay lacked" line (the snapshots' `sp short` keys) |
| Which gate held a cast the replay flags INSIDE (a window, the uncuttable frames and both priorities, a cantCastSkill channel, the combo window, the cooldown, SP) | the INSIDE line itself (`held by …`: timing.ts startGateWords; round 23); a skill's specification, priority and channels: `efsim kit <operator>` |
| A hitless ultimate's cast event: its press or its stop's end, as the cast assembly reads it | the replay's EVENT line (`the cast assembly reads it …`: ultimateevent.ts ultimateEventRead; round 23) |
| Is a clock's lateness a constant per combo, per episode or a share of the held time | `efsim zmdlogs clocks <fixture…\|--all> --fit` (`--json`: a line per row with its combos and episodes; round 23) |
| How late each clock runs across a Stagger break (pairs spanning it, no Stagger cut) | `efsim zmdlogs clocks <fixture…\|--all> --around break` (with and without the engine's break holds; round 23) |
| A TimeDilationAction's curve (an entity's own slow-down): its mean scale, when an owner's frame comes | `efsim gamedata curve <id> [--path <json path>] [--frame n]` (round 23) |
| What is still log-only (or replay-only) today, largest first | `efsim zmdlogs totals --all --side log\|replay [--top n]` (round 23) |
| Is a lead already fixed (before a brief names it) | `node scripts/lead-status.ts <id@time \| id \| words>…` (docs/open-problems.md's mentions, fixed, open or both; round 23) |
| A consumed-scaled hit's multiplier range (no value rule reads it yet) | packages/logs logcasts.ts `multiplierBounds` in a script (round 23) |
| Why a logged hit's landing didn't land, why a logged cast wasn't made | `efsim zmdlogs replay <fixture>`: NOLAND lines carry the step that dropped the pinned landing (another alternative of its branch, its `if`, the next cast, its cast's end) or why it was never pinned; SKIP lines each cast not made and why (a tick, the slot's variant, earliestStart's error: "needs 160 ultimate energy") (BuffReplay.droppedLanding, `skipped`) |
| A kit trigger's firings and its cooldown's shifts | `efsim zmdlogs replay <fixture> --trace-trigger owner:id` (or the id alone); the game's mechanism behind each cooldown: `efsim kit <operator \| wpn_… \| suit_…>`, counts in `efsim kit-census` |
| Why a hidden-hold unit sits where it does; which bounds a change made conflict | `efsim zmdlogs holds <fixture> --verbose` (each unit's "earliest held back by" / "latest forced by", each dropped bound's "conflicting with"); between two commits `node scripts/cli-ab.ts <ref> --patch <view diff> --holds <fixture>` |
| A hit whose kit reads a fact the replay doesn't know | `zmdlogs check` (a line under the operator), `zmdlogs differences` (a section), `hits --json` `unknownFacts` ("enemy HP unknown": buffreplay.ts unknownFacts) |
| What a new replay rule or reading decides differently, across the logs, before its first measure | `efsim zmdlogs decisions <fixture…\|--all> --assume <id>=<r>` (decisionsview.ts: the SKIP, TAILCUT, FAILED, MISSED, INFER, MADE, JUMPDROP, BOTHPATHS, FORCED, INSIDE, CUTS lines only one side has, a count per kind; without `--assume` every decision; `replayDecisions` over BuffReplay's records in a script) |
| Which hits of one log a reading changes, without the lock | `efsim zmdlogs hits <fixture…> --against <id>=<r>` (class and primary before and after, the modifiers only one side has; hitexport.ts `recordChanges`) |
| A press the replay made from the listing, a cast made as another skill, a kit jump the logged landings contradicted | `efsim zmdlogs replay <fixture>`: INFER, MADE, JUMPDROP lines (BuffReplay.made; the EVENT line names the replay's own fate of its cast) |
| A cast that lands both paths of a kit jump (pinned landings in the part a kept jump skips: twice the SP, stacks and triggers) | `efsim zmdlogs decisions <fixture…\|--all>`: BOTHPATHS lines (drivers.ts replayCast `keptSkipped`, round 16) |
| Which listed buffs end at one logged moment and which go on (a purge, a stage phase, a buff ending alone), and the log's moment spacing there | `efsim zmdlogs ends <fixture> [--at <s>]` (endsview.ts, round 16; `zmdlogs lanes` gives the spacing beside each end) |
| Whether a listing difference is a cause: the nearest hits with the very same listing and their verdicts; one key's listed values across logs | `efsim zmdlogs hits <fixture> --same-listing <s>`; `hits --all --event <regex> --listed <regex>` (listingview.ts, round 16) |
| How often a kit buff listed at a hit's boundary (a run's start or end) reads with it or without it, before a boundary rule's measure | `efsim zmdlogs boundaries <fixture…\|--all> [--kit-buff <regex>]` (boundaryview.ts, round 16) |
| A kit stack's value (a bank, a counter) step by step | `efsim zmdlogs replay <fixture> --trace-stack owner:stack` (BuffReplay.stackTraces, round 16) |
| A kit buff's logged runs against the replay's windows, by start | `efsim zmdlogs replay <fixture> --kit-buff owner:id --against-lanes` (views.ts lanePairs, round 16) |
| A batched ms's order: the Stagger bars against the replay's landing order | `efsim zmdlogs replay <fixture>`: the bar on each LAND line of a batch, BATCH where the orders differ (decisionsview.ts batchDisagreements, round 16) |
| Is a total's miss the model or the fight's crit luck | `efsim zmdlogs totals <fixture> --by crit` (matched parts per operator by how the totals took each crit: known, exact, read from the value, expected); per hit `hits --json` `totalsPredicted`, `totalsCrit` |
| A burst's cause | `efsim zmdlogs bursts`: the replay's infliction that set it off (StatusEvent `inflictedAt`) and the logged hit standing for it; "nearest" where neither is known |
| Does a scratch script call the packages right | `node scripts/typecheck-scratch.ts scratch/x.ts` (the repository's compiler options; scratch/ isn't in `npm run typecheck`) |
| What opened a combo window, when, and why it stayed shut | `efsim zmdlogs replay <fixture> --windows <operator>` (WINDOW lines: each opening or refresh with its source, an event the cooldown kept out, each end, the combos' ready frames, each press with the window it found; round 24) |
| A cast made before its cooldown was ready | `efsim zmdlogs decisions <fixture…\|--all>` (COOLDOWN lines: how early, the last cast's cooldown, how far readyAt moved since; replayrun.ts cooldownEarly, round 24) |
| A skill's cooldown and SP or energy cost | `efsim kit <operator> [--levels]` (at level 12 and the levels that differ; the kit triggers that change the cooldown; round 24) |
| A logged crit or reaction level the replay's landing didn't take (a moved landing's lost facts) | `efsim zmdlogs decisions <fixture…\|--all>` or `replay <fixture>` (LOST lines, a count in the replay's header: lostfacts.ts, round 24) |
| What each placement pass placed and which stops the next pass read | `efsim zmdlogs casts <fixture> --passes` (passesview.ts; round 24) |
| An operator's clock across a teammate's slow-down, from the cast event | `efsim zmdlogs casts --event-lags <fixture…\|--all> --against-holds [--verbose]` (the event's world lag from the start unheld and held; round 24) |
| Which stacking type a layered kit buff is, and whether it is a clock of the hidden holds | `efsim kit-census` (layered kit buffs by stacking type) and `efsim zmdlogs holds <fixture> --why <regex>` (round 24) |
| Where this worktree stands: branch, commits, uncommitted files, runs and their output | `node scripts/runstate.ts --where` (round 24) |

`zmdlogs hits --json` records (packages/logs/src/hitexport.ts `HitRecord`):
`value`, `verdict` (`match` for every match class) and `class`,
`verdictReading` / `verdictError` (the reading the verdict rests on),
`predicted` and `error` (the primary reading of the replay's landing: not
the verdict's where it fell back or the log gives no crit),
`logReading` / `logError` (every kit buff as the log lists it), `listed`,
`differences` (`kind` engine / log / values; `sameTotals` where the values'
sums agree: cosmetic), `counterfactuals` (round 11: the primary with one
difference taken the log's way, the crit flipped where logged, a boundary
kit buff on or off, Stagger toggled at its boundary; `what`, `kind`,
`reading`: which single disagreement makes the hit fit, hitexport.ts
`hitCounterfactuals`, which scripts/probes/stats/build.ts reads too),
`replayCrit` and `critSource` (the crit the replay's
landing took: `log`, or inferred `shown` / `layers` / `values`, or `none`),
and under `landing`:
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
