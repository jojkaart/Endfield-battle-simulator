# Backlog after improvement round 6 (2026-11-23)

Task: the points of the reports round 6 read (docs/friction-done/2026-11-23-round-6.md lists them) that round 6
didn't do, and round 5's backlog points still live. Each point is complete on its own; the originals are in
docs/friction-done/ with an "Outcome (round 6)" section. Points 1–14 are round 5's backlog points carried once
(`node scripts/friction.ts carry`: their "From" lines name where they began); 15–20 are round 6's; then the points
another agent is building now, the parked list (round 5's points 1–21, carried through two rounds without a new report
hitting them: docs/friction/README.md, "The backlog stays short") and the leads that need an accuracy task.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. groups: off under both readings or only under the replay's
- **What happened:** `zmdlogs groups` sorts own mismatches by skill event and by difference, and since round 5 lists
  the fallback matches by event with their median ratio, but doesn't split mismatches into "off under both readings"
  (a build or kit value) and "off only under the replay's" (timing), and doesn't count the replay's FORCED casts as a
  cause; the check's per-operator line doesn't give the share of damage from fallback-matched hits (Perlica's 9090
  totals were −9.4% "although every hit matches").
- **Suggestion:** in views.ts `groupsReport`, split own mismatches by `logError` (within ±1 under the log's reading
  or not); count hits after a FORCED cast of the operator as their own cause; in the check's per-operator summary,
  the share of the totals from fallback matches.
- **Why it helps:** the cause of a mismatch group shows in the summary instead of a hit-by-hit read.
- **From:** round 4's backlog, point 22; docs/friction-done/2026-11-22-perlica.md point 1; round 5's backlog, point 23.

## 2. No interval selectors in census
- **What happened:** the finisher-gate agent's question was per Stagger (who is controlled, enhanced attacks in it, a
  Finisher before or after them); `zmdlogs census` selections are points (`buff:` items are a lane's start), so
  nothing can be an interval to look inside. Three scratch-script versions, each wrong in a new way, about an hour.
- **Suggestion:** in packages/logs/src/query.ts give `Item` an optional end; selectors `stagger:` (the log's Stagger
  runs, views.ts staggerRuns) and `control:<op>` (controlSpans); `buff:` items get their lane's end (`nextUnlisted`);
  `--inside <sel>` beside `--near` (items whose time falls inside an interval item of the other selection), with the
  rerun line.
- **Why it helps:** most in-game-test questions from the logs are "X during Y"; a rerunnable census line is what
  data.md "A claim from the logs cites its selection" asks for.
- **From:** docs/friction-done/2026-11-18-finisher-gate.md, point 1; round 5's backlog, point 24.

## 3. A ticking buff's ticks and holds: logged against replayed
- **What happened:** Rossi's bleed drift and Liino's Cosmovoice gap both needed each logged tick against the replay's
  and the holds behind a buff: Rossi wrote scratch/tick-offsets.ts (logged ticks of a buff's tick trigger against the
  replay's nearest tick, offsets, the steps over 80 ms with the stops between, the lane's world-time drift); Liino
  added temporary `process.stderr.write` lines to `heldTicks` and `addBuff` (Zhuang Fangyi's ultimate at the end of
  Liino's stop had extended Cosmovoice by its 78 frames). `zmdlogs cadence` groups by a 1 s gap (merging a 1 s tick
  train); `--trace-buff` records `expiresAt` changes only, not `nextTick`, and not the slow-downs a new buff was held
  by.
- **Suggestion:** (a) `efsim zmdlogs ticks <fixture> --buff owner:id`: each logged tick (the buff's tick trigger's
  hits, or its `ticksLoggedAs` events) with the nearest replayed tick, the offset, the stops between and the drift;
  (b) `--trace-buff` also traces `nextTick` changes and, at a buff's creation, the held frames and the slow-downs
  behind them (actions.ts `heldFromNow`: start, length, exempt operator).
- **Why it helps:** every periodic kit (bleeds, Combustion, Liino's beats and volleys, Arcane's seal) gets the same
  first check in one command; tick timing was the round's most common open cause.
- **From:** docs/friction-done/2026-11-22-rossi.md point 2; -liino-beats.md point 2; round 5's backlog, point 25.

## 4. A cast's two variants both landing raises no flag
- **What happened:** the replay landed Rossi's combo 3 "late" hit (the jumped path) and its pinned "perfect" hit for
  the same cast; `replay` showed it (`replay only` 14 frames before `= logged`) but nothing flagged it, and a 9a80
  diagnosis missed it for a week. The branch fixed the jump; the flag is open.
- **Suggestion:** a CastFlag kind "both-variants" in buffreplay.ts when hits of one cast that a jump separates both
  land, counted in `replay`'s header like FORCED / INSIDE. `npm run measure` must stay byte for byte (a flag only).
- **Why it helps:** the same pattern exists wherever a kit models variants by a jump (Rossi, Arclight, Typhoeus's
  hover).
- **From:** docs/friction-done/2026-11-22-gilberta-zhuang.md point 2; round 5's backlog, point 27.

## 5. One skill's hits across logs with their zones
- **What happened:** Perlica's combo comparison over ten logs needed scratch/pcombo*.py over `zmdlogs hits <log>
  --operator perlica --json` (one call per log; `--all` took over two minutes), printing ratio, crit, scale,
  damageBonus, damageTaken, the modifiers and the listed buffs; "the missing factor is additive in DMG" fell out of
  that table.
- **Suggestion:** `efsim zmdlogs hits --operator <op> --event <re> --zones` (from the hits cache, over the development
  logs by default with --operator): one line per hit with logged ÷ primary, crit, and each zone that isn't 1.
- **Why it helps:** a missing-modifier diagnosis becomes a minute's read.
- **From:** docs/friction-done/2026-11-22-perlica.md point 2; round 5's backlog, point 28.

## 6. `differences` blames the applying hit for a buff it creates
- **What happened:** `zmdlogs differences` said P3, Pulser Labs and Wild Wanderer were "engine only" on Perlica's
  combo hits, which suggested the engine had too much: the log lists a buff only from the hit after the one that
  creates it (now in data.md "Common misreadings").
- **Suggestion:** in `zmdlogs differences`, mark a difference on a hit that itself created the buff (its source's own
  trigger at that landing's frame) as "created by this hit (not listable)" rather than "engine only".
- **Why it helps:** removes a misleading lead from every kit whose beforeDamage triggers fire on the applying hit.
- **From:** docs/friction-done/2026-11-22-perlica.md point 3; round 5's backlog, point 29.

## 7. A no-landing reason that hides an unlogged crit
- **What happened:** Seething Blood extras during Rossi's ultimates had no landing because the log gives her ultimate
  stabs no crit at all; the replay's reason ("a landing whose order the kit doesn't give") didn't say the trigger
  needed a crit. The branch added the misreading line and shownCrits.
- **Suggestion:** where a trigger hit gets no landing and its trigger's crit condition failed only because the
  source hit's crit is unlogged (`crit: null`), say so in the no-landing reason.
- **Why it helps:** 116 of Rossi's mismatches came from this; other crit-triggered kits share the blind spot.
- **From:** docs/friction-done/2026-11-22-rossi.md point 4; round 5's backlog, point 30.

## 8. Open rule questions go stale as the engine moves
- **What happened:** the rule-objective brief's three questions came with numbers from 2026-11-16; at the base commit
  all had moved, two signs flipped (Estella on Stagger, Ink Melt's `shows` edit, the Twilight hold), and nothing said
  so.
- **Suggestion:** keep the open rule questions as data (`examples/<team>.questions.json`: base list, edited list,
  the claim, its commit) and give team-ab (or `rules --questions`) a pass that re-measures each on both starts and
  flags a verdict that changed sign or significance since its recorded commit.
- **Why it helps:** the owner's calls are re-checked before anyone spends hours on them.
- **From:** docs/friction-done/2026-11-22-rule-objective.md point 1; round 5's backlog, point 31.

## 9. Who inflicts what, as a team table
- **What happened:** Corrosion setups needed, per operator and button, the element its hits inflict; round 5's
  `efsim kit` lists each hit's applications, but a team-level table needs a script (policyguide.ts
  `buttonInflictions` exists).
- **Suggestion:** `efsim kit-census --team <a,b,c,d>` (or `efsim kit --team`): who inflicts which element with which
  button, forced reactions and consumes, from `buttonInflictions`.
- **Why it helps:** which reactions a team can form becomes one command.
- **From:** docs/friction-done/2026-11-22-rule-objective.md point 4; round 5's backlog, point 32.

## 10. A buff's holds past its modelled end need a kit edit
- **What happened:** to count the holds Twilight's longer game window collects, the agent set its kit duration to 45 s
  (refused by the kit check, then a too-short `dataOverride` reason), three edits of a tracked kit file restored by
  hand, and a measure waiting with the patched kit on disk.
- **Suggestion:** `zmdlogs replay --trace-buff owner:id --long` (or `--buff-duration owner:id=s`, replay-only) keeping
  the instance alive and printing cumulative held frames per step; `measure --kit-duration owner:id=s` for the same in
  measurements. Replay behaviour under an option: its own journal entry, default runs byte for byte.
- **Why it helps:** every "runs longer than its model" question starts with this count.
- **From:** docs/friction-done/2026-11-22-twilight.md point 1; round 5's backlog, point 33.

## 11. The log reading's parts and a consumed buff's layers per cast
- **What happened:** Yinglung's Edge layers per combo had to be decoded from damage: `zmdlogs hits --json` gives the
  log reading only as a rounded value, not its zones or the kit buffs it dropped (no logged name), so a script can't
  tell "the log reading lacks Edge" from "it lacks an ATK buff"; no per-cast aggregate exists. A third of the session.
- **Suggestion:** (a) `logReading` as an object in hitexport.ts (value, zones, modifiers, the kit buffs dropped);
  (b) `zmdlogs consumed <fixture…> --buff <kit buff>`: per cast that consumes it, the engine's layers (ReplayCastFacts
  consumed) and the layers each reading's median implies, with agreement and exactness, other consumed buffs (Jade
  Vessel) solved jointly.
- **Why it helps:** every "is the replay's count of X right" question (Edge, Jade Vessel, Lustrous Carmine,
  Bonekrusha) needs exactly this.
- **From:** docs/friction-done/2026-11-22-yinglung-edge.md point 1; round 5's backlog, point 34.

## 12. `zmdlogs instances` and the replay's casts disagree silently
- **What happened:** 9555's Last Rite battle skill is a replay cast (from her phantom's hits, filed under a trigger
  group) with no instance; db87's Laevatain battle skill is an event-only instance and a placed variant 1.9 s later,
  both made by the replay. Round 5's EVENT lines in `zmdlogs replay` say what the replay made of each cast event, but
  the instances view still has only the query layer's casts.
- **Suggestion:** `zmdlogs instances --replay`: each instance with the cast the replay makes for it, the replay-only
  casts (from a buff end, from trigger hits), and a flag on an event-only instance followed within LOGGED_CAST_MS of
  world time by a placed same-slot variant.
- **Why it helps:** a census over instances then counts what the engine counts.
- **From:** docs/friction-done/2026-11-22-yinglung-edge.md point 2; round 5's backlog, point 35.

## 13. A "batched" mark on log times
- **What happened:** the Arcane agent spent hours on ±0.5 s residuals before seeing that the log batches timestamps;
  round 5 documented it (data.md "Timestamps are batched"), but no view marks a hit at a ms many hits share.
- **Suggestion:** in `zmdlogs casts` and `replay`, a count after each HIT / LAND line's logged time when more than,
  say, three logged hits share that ms.
- **Why it helps:** a residual at a batched ms reads as such at once.
- **From:** docs/friction-done/2026-11-22-arcane-imprisonment.md point 1; round 5's backlog, point 36.

## 14. smoke and snapshots read the tree when their turn comes
- **What happened:** round 5 made measure and team-ab fix their code at queue time (a snapshot commit in its own
  worktree); `npm run smoke` and `npm run snapshots:update` still run the working tree's tests when the lock comes,
  so an agent can't edit while they wait. snapshots.sh's INT/TERM trap is deferred while vitest runs in the
  foreground (a kill of the shell alone waits for vitest to end; a group kill is fine).
- **Suggestion:** smoke: run vitest in a snapshot worktree (at-commit.ts `snapshotCommit` + `atCommit`, its own
  configs); snapshots.sh can't (it writes the tree's snapshot files) but can refuse to start on a tree that changed
  since it was queued. Run its vitest steps through the background-and-wait pattern of scripts/done-line.sh.
- **Why it helps:** every locked job's wait becomes free time.
- **From:** improvement round 5 (docs/friction-done/2026-11-22-round-5.md); round 5's backlog, point 37.
## 15. `zmdlogs clock`'s remainders: states from casts, every buff at once, the trigger hit after the end
- **What happened:** round 6 built `efsim zmdlogs clock --kit-buff owner:id [fixture…]` (packages/logs/src/clockview.ts
  `kitBuffClock`): per instance the first expiry, the expiry on the replay's own clock (`hidden-holds=none`), how it
  ended there and in the check's replay, the log's run and the lateness past the own expiry. Three asks of the reports
  it came from are not in it: a state the log shows only by casts (Twilight's enhanced casts on, plain casts off:
  `--on <cast re> --off <cast re>` in place of a listed lane), a table over every kit-modelled game buff at once (the
  buff clock's first question; today scripts/probes/buff-clock/lanes.ts writes it as rows), and the logged trigger
  hit after the end with its `poise.origin` (Si's burst after Artful Intent: Final Stroke or an Inksoul's expiry).
- **Suggestion:** in clockview.ts: (a) `--on/--off` building the log's bracket from `loggedSkillInstances` (last
  matching `on` cast before the end, first `off` cast after it) when the buff has no listed run; (b) `--all`: every
  kit buff with a `gameBuff` the log lists and a fixed duration, one summary line per buff (count, lateness quartiles),
  replacing probes/buff-clock/lanes.ts (delete it with its README line); (c) a column with the owner's first logged
  hit after the end whose event a kit trigger on the buff's end names, with its origin.
- **Why it helps:** Twilight, Arcane's modes, Liino's stance and Si's Artful Intent become one command each; the buff
  clock's cross-log table stops being a probe.
- **From:** round 5's backlog, point 22 (round 4's 21; -rossi.md 3, -twilight.md 2 and 3); docs/friction-done/
  2026-11-22-buff-clock.md point 1; docs/friction-done/2026-11-23-artful-intent.md point 1.

## 16. The replay's kit windows don't say which instance a later window continues
- **What happened:** matching a log run to "its" replay instance needed heuristics (start within −3 s…the last listed
  hit; the last such window). A refresh in the replay is a new window; a refresh in the log keeps the run's `since`.
  The buff-clock round's first results were muddied by runs the game refreshed and the replay didn't (Perlica's weapon
  buff +9 s). `zmdlogs clock` (round 6) matches by a lane's start within 0.3 s of an instance's, the same heuristic.
- **Cause:** `kitWindows` (packages/logs/src/buffreplay.ts) returns flat windows per recipient; `BuffTrace` has the
  instance identity (`appliedAt`) only when traced, and no "refreshed by" link.
- **Suggestion:** give `KitWindow` its `appliedAt` and, when an application replaced an instance, the replaced one's
  start (`replaces?: number`); `zmdlogs replay --kit-buff` and `zmdlogs clock` print the chain. A small edit in the
  replay's run(): coordinate with the hidden-holds clocks agent's refactor of it (below) and do it after.
- **Why it helps:** "the replay missed a refresh" and "the buff ran long" separate at a glance.
- **From:** docs/friction-done/2026-11-22-buff-clock.md point 2.

## 17. An expiry taken from the log gets held again by later stops
- **What happened:** the buff-clock round's first `heldToLoggedEnds` set an expiry to the log's end once; the replay's
  later time stops then shifted it again (b6aa: Xaihi's debuff to 46.9 s where the log ended it at 43.8 s). Two more
  measure rounds and a trace script to find it, then a step-at-a-time keep with a clamp.
- **Cause:** the engine's clock (packages/engine/src/timeline/clock.ts `shiftWorld`) shifts every buff's expiry at each
  stop; there is no "pinned" expiry, and the replay's other log-following rules (`heldTicks`) solve the same problem
  ad hoc.
- **Suggestion:** an `ActiveBuff.pinnedUntil` (or a replay-only "fixed end" field) that `shiftBuff` leaves alone, used
  by heldTicks' moved ends and heldToLoggedEnds alike; docs/design/timeline.md: an expiry taken from the log is pinned.
  `npm run measure` must stay byte for byte. The hidden-holds clocks agent is changing these rules now: after it.
- **Why it helps:** the next "take X's end from the log" rule is a one-liner.
- **From:** docs/friction-done/2026-11-22-buff-clock.md point 3.

## 18. "Unchanged on the hold-outs" may mean "not testable there"
- **What happened:** the buff-clock round's measure reported the hold-out row unchanged for a change that moved 60
  development logs. Two verified logs (40d9, 4e5e) lack the effects' `since` and `source` (imported before
  2026-11-16); the hold-outs may too, and nobody may look.
- **Suggestion:** `npm run measure` and `snapshots:update` print, as an aggregate, how many hold-out logs lack
  `since`/`source` on their effects (a count, no names: the worker reports a boolean per fixture, scripts/measure-worker.ts);
  `zmdlogs refresh` for the verified ones.
- **Why it helps:** a listing-based change's hold-out row reads as tested or untestable.
- **From:** docs/friction-done/2026-11-22-buff-clock.md point 5.

## 19. `poise.origin` in the views
- **What happened:** the origin of Si's bursts decided the Artful Intent task; round 6 added the census selector
  `origin:<re>` and a data.md line, but `zmdlogs instances` and `casts` still don't print a hit's origin.
- **Suggestion:** an origin column in `instancesView` (packages/logs/src/query.ts) and `castsView`'s HIT lines
  (views.ts) for hits that carry one and whose origin differs from their own skill.
- **Why it helps:** whose cast a projectile or an entity's skill belongs to reads off the timeline.
- **From:** docs/friction-done/2026-11-23-artful-intent.md point 2.

## 20. Probes have no "still runs" check
- **What happened:** round 6 committed eleven probes under scripts/probes/ (not typechecked, linted or tested, so
  they age with the code) and ran each by hand once; the README's "Last run" column is hand-kept.
- **Suggestion:** if probes rot (an agent finds one broken), a `node scripts/probes/check.ts` that runs each probe's
  README command on one small log under the short-job lane and rewrites the column; until then nothing.
- **Why it helps:** a probe cited in open-problems keeps working or gets deleted visibly.
- **From:** improvement round 6 (docs/friction-done/2026-11-23-round-6.md).

## Taken by the hidden-holds clocks agent (2026-11-23)

That agent is working in packages/logs/src/holds.ts and logBuffReplay's run() in buffreplay.ts now; round 6 left
these to it. Whoever merges its branch closes them here.

- **The replay's run() as composable passes** (docs/friction-done/2026-11-23-hidden-holds.md point 2): placing the
  holds needs the replay's own expiries without holds, then a second replay with them; `logBuffReplay`'s ~800-line
  `run()` closure captures a dozen locals and switches readings by flags at its top, so the first pass had to be
  threaded through by hand (and first inherited `heldToLoggedEnds`, giving zero excess). Suggestion: an exported
  `replayOnce(input, { holds, laneEnds, crit })` returning the run's record (kitInstances, staggerWindows, made,
  checkpoints), readings composing passes. Round 5's backlog point 12 (the step list and its rank in a module of
  their own, packages/logs/src/replaysteps.ts) belongs to the same refactor.
- **An enemy status's life in the replay** (docs/friction-done/2026-11-23-smaller-leads.md point 1; round 5's backlog
  point 26, -gilberta-zhuang.md point 1): d774's ×1.3858 was a level-1 Electrification the replay had let expire; the
  per-hit JSON's `appliedAtMs` moves with every hold (clock.ts `shiftEnemy`), so a hold looks like a re-application.
  Suggestion: `zmdlogs replay --trace-status <status>` (each application, hold with its stop, expiry or consumption,
  beside the log's lane of the status's debuff key and its last listed hit) and `zmdlogs statuses <fixture>` (the
  replay's status events, Vulnerable and physical statuses included, with the logged status hits interleaved).
- **Corrosion's ramp as a reading** (docs/friction-done/2026-11-23-smaller-leads.md point 5): `zmdlogs hits --json`
  field `corrosionStep` (the step the logged value implies, within 0.25 points) and `zmdlogs corrosion <fixture>`
  (each ramp's steps, log against replay, with the lag bounds). Round 6 committed the scratch version as
  scripts/probes/corrosion/corrosion-lag.ts; the view replaces it (delete the probe and its README line then).

## Parked (round 5's points 1–21: carried through rounds 4 and 5 without a new report)

Full text in docs/friction/2026-11-22-backlog-after-round-5.md (moved to docs/friction-done/ by round 6) under the
same number; a new report that hits one brings it back with that text.

- 1. Game-data file reads scattered; table files keyed by size and time (one dataFiles.ts module, exact cache key).
- 2. Status-event landings record no `facts` (`statusFacts` on LandedHit).
- 3. Status and Stagger modifiers identified by their `source` text (`Modifier.status`).
- 4. Test files carry copies of the same helpers (move onto tests/helpers/, drop @efsim/cli's re-export).
- 5. SP kept path-independent by a snap (an SP anchor, only when a shortcut needs it).
- 6. Fixed-length search times not documented (a table in docs/design/search.md).
- 7. Prose citations of doc sections and source paths not checked (extend scripts/check-links.ts).
- 8. No harness for "same CLI output" (scripts/ab.ts over at-commit.ts).
- 9. Status log keys only in a doc table (`STATUS_LOG_KEYS`; a lane's `since` semantics).
- 10. The importer has no test of its own (on tests/helpers/zmdlogs.ts `syntheticDetail`).
- 11. No shared measure of teammates' attack share (`zmdlogs pace`).
- 12. The replay's step list inside buffreplay.ts: with the replayOnce refactor above (taken).
- 13. The cast table's gaps and units (`SkillInstance` world gaps and cooldowns, branded ms / frames).
- 14. The weapon breakthrough table isn't loaded (needs the lead: tables.json, fetch-data in the main checkout).
- 15. A generic "in her ultimate" rules cue (`{ "inUltimate": op }`; team-ab).
- 16. Kit tests pin absolute expiries (`expectLasts`).
- 17. Loop tests depend on engine readings they don't test (pin `options.assume`).
- 18. Test texts in step with the kits (a kit-census warning).
- 19. Kit notes may rest on disabled actions (a one-off `isEnable` check).
- 20. Who wears what; an operator's event keys (`zmdlogs list --weapon/--gear`, `census --by-key`).
- 21. `--assumptions` doesn't run the engine's readings (cli/assume.ts `alternatives()`).

## Needs an accuracy or search task (not friction work)

- **`launch` delays the next cast, `beside` casts included** (docs/friction-done/2026-11-22-liino-beats.md point 4):
  exempting `beside` casts from timing.ts `ownHitsLanded` changes engine timing; smoke and team-ab.
- **Which skill a logged press is** (docs/friction-done/2026-11-22-yinglung-edge.md point 4): mark a press and a nearby
  placed variant as alternatives of one slot in withLoggedCasts and let makeCast drop the one the state rules out
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate (roadmap "cheaper variance"), and resumable guided searches.

## What worked well

The reports named their scratch scripts by path and their worktrees still had them, so promoting them was a copy;
`npm run measure -- --against <old ref> --logs <id> --hits` reproduced the new-fixture crash in a minute.
