# Backlog after improvement round 7 (2026-11-23)

Task: the points of the reports round 7 read (docs/friction-done/2026-11-23-round-7.md lists them) that round 7
didn't do, and round 6's backlog points still live. Each point is complete on its own; the originals are in
docs/friction-done/ with an "Outcome (round 7)" section. Points 1–5 are round 6's backlog points carried
(`node scripts/friction.ts carry`: their "From" lines name where they began; point 1 with a new report on it); 6–8 are
points round 6 left to the hidden-holds clocks agent, which did accuracy work instead, each hit again by a new report.
Then the parked list (docs/friction/README.md, "The backlog stays short") and the leads that need an accuracy task.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A layered or consumed buff's layers: per hit and per cast, log against replay
- **What happened:** Yinglung's Edge layers per combo had to be decoded from damage: `zmdlogs hits --json` gives the
  log reading only as a rounded value, not its zones or the kit buffs it dropped (no logged name), so a script can't
  tell "the log reading lacks Edge" from "it lacks an ATK buff"; no per-cast aggregate exists. A third of the session.
  Again (rossi-gilberta report point 4, 2026-11-23): comparing the replay's Wolven Blood layer count with the log's per
  hit, the agent sampled `kitWindows` at hits ±500 ms, so counts at a crit's own ms were off by one either way, and
  `BuffReplay.instances` returns null (crit dependent) for most of Rossi's hits; telling "a layer missing" from
  "sampling" took reading `zmdlogs replay` line by line.
- **Suggestion:** (a) `logReading` as an object in hitexport.ts (value, zones, modifiers, the kit buffs dropped);
  (b) `zmdlogs consumed <fixture…> --buff <kit buff>`: per cast that consumes it, the engine's layers (ReplayCastFacts
  consumed) and the layers each reading's median implies, with agreement and exactness, other consumed buffs (Jade
  Vessel) solved jointly; (c) `zmdlogs layers <fixture> --kit-buff owner:id`: per logged hit, the log's listed layer
  count and the replay's at the landing's frame, before and after it (LandingFacts.buffLayers has the landing's).
- **Why it helps:** every "is the replay's count of X right" question (Edge, Jade Vessel, Lustrous Carmine,
  Bonekrusha, Wolven Blood, MI Security) needs exactly this.
- **From:** docs/friction-done/2026-11-22-yinglung-edge.md point 1; round 5's backlog, point 34; round 6's backlog,
  point 11; docs/friction-done/2026-11-23-rossi-gilberta.md point 4.

## 2. `zmdlogs clock`'s remainders: states from casts, every buff at once, the trigger hit after the end
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
  2026-11-22-buff-clock.md point 1; docs/friction-done/2026-11-23-artful-intent.md point 1; round 6's backlog, point 15.

## 3. The replay's kit windows don't say which instance a later window continues
- **What happened:** matching a log run to "its" replay instance needed heuristics (start within −3 s…the last listed
  hit; the last such window). A refresh in the replay is a new window; a refresh in the log keeps the run's `since`.
  The buff-clock round's first results were muddied by runs the game refreshed and the replay didn't (Perlica's weapon
  buff +9 s). `zmdlogs clock` (round 6) matches by a lane's start within 0.3 s of an instance's, the same heuristic.
- **Cause:** `kitWindows` (packages/logs/src/buffreplay.ts) returns flat windows per recipient; `BuffTrace` has the
  instance identity (`appliedAt`) only when traced, and no "refreshed by" link.
- **Suggestion:** give `KitWindow` its `appliedAt` and, when an application replaced an instance, the replaced one's
  start (`replaces?: number`); `zmdlogs replay --kit-buff` and `zmdlogs clock` print the chain. A small edit in the
  replay's run(): with or after point 6.
- **Why it helps:** "the replay missed a refresh" and "the buff ran long" separate at a glance.
- **From:** docs/friction-done/2026-11-22-buff-clock.md point 2; round 6's backlog, point 16.

## 4. An expiry taken from the log gets held again by later stops
- **What happened:** the buff-clock round's first `heldToLoggedEnds` set an expiry to the log's end once; the replay's
  later time stops then shifted it again (b6aa: Xaihi's debuff to 46.9 s where the log ended it at 43.8 s). Two more
  measure rounds and a trace script to find it, then a step-at-a-time keep with a clamp.
- **Cause:** the engine's clock (packages/engine/src/timeline/clock.ts `shiftWorld`) shifts every buff's expiry at each
  stop; there is no "pinned" expiry, and the replay's other log-following rules (`heldTicks`) solve the same problem
  ad hoc.
- **Suggestion:** an `ActiveBuff.pinnedUntil` (or a replay-only "fixed end" field) that `shiftBuff` leaves alone, used
  by heldTicks' moved ends and heldToLoggedEnds alike; docs/design/timeline.md: an expiry taken from the log is pinned.
  `npm run measure` must stay byte for byte. With point 8 (the clock's shifts as one value): the same functions.
- **Why it helps:** the next "take X's end from the log" rule is a one-liner.
- **From:** docs/friction-done/2026-11-22-buff-clock.md point 3; round 6's backlog, point 17.

## 5. Probes have no "still runs" check
- **What happened:** round 6 committed eleven probes under scripts/probes/ (not typechecked, linted or tested, so
  they age with the code) and ran each by hand once; the README's "Last run" column is hand-kept.
- **Suggestion:** if probes rot (an agent finds one broken), a `node scripts/probes/check.ts` that runs each probe's
  README command on one small log under the short-job lane and rewrites the column; until then nothing.
- **Why it helps:** a probe cited in open-problems keeps working or gets deleted visibly.
- **From:** improvement round 6 (docs/friction-done/2026-11-23-round-6.md); round 6's backlog, point 20.

## 6. The replay's run() as composable passes, its outputs in a module of their own
- **What happened:** placing the hidden holds needs the replay's own expiries without holds, then a second replay with
  them; `logBuffReplay`'s ~800-line `run()` closure (packages/logs/src/buffreplay.ts, now ~2,700 lines) captures a
  dozen locals and switches readings by flags at its top, so the first pass had to be threaded through by hand (and
  first inherited `heldToLoggedEnds`, giving zero excess). Round 6 then left three small replay edits (KitWindow's
  chain, a both-variants flag, pinned expiries) to the backlog because another agent was inside run(), and built
  `zmdlogs clock` as a consumer that replays each log twice (about 24 s for one kit buff over every log with Si).
  Round 7 kept its own edits there to runBounds' verdicts and two BuffReplay fields for the same reason.
- **Cause:** the replay's state, its step list, its readings and its outputs (traces, kit windows, flags, hold clocks)
  are one module and one closure; a parallel task in any part of it locks out the rest.
- **Suggestion:** an exported `replayOnce(input, { holds, laneEnds, crit })` returning the run's record (kitInstances,
  staggerWindows, made, checkpoints), readings composing passes; the step list and its rank in
  packages/logs/src/replaysteps.ts (round 5's parked point 12); the outputs (traces, kitWindows, castFlags,
  holdClocks) in packages/logs/src/replayrecord.ts that run() fills, so a view's new field is an edit there. Behaviour
  byte for byte (`npm run measure`); a task of its own, when no other agent is in buffreplay.ts.
- **Why it helps:** view work and replay-rule work stop excluding each other; points 3 and 4 and a both-variants flag
  become small edits. Cost: a large refactor of the check's core.
- **From:** docs/friction-done/2026-11-23-hidden-holds.md point 2 (round 6's backlog, "Taken"); docs/friction-done/
  2026-11-23-round-6-friction.md point 1; round 5's backlog, point 12 (parked).

## 7. An enemy status's life in the replay, traced
- **What happened:** d774's ×1.3858 was a level-1 Electrification the replay had let expire; the per-hit JSON's
  `appliedAtMs` moves with every hold (clock.ts `shiftEnemy`), so a hold looks like a re-application. Again (hold-clocks
  report point 3, 2026-11-23): 4d60's Corrosion step jumped back 3 steps at 73.65 s; tracing it took three scratch
  scripts (status appliedAt per hit, the replay's status events, `replayKitBuffs({ trace })` over every kit buff to
  find the step that shifted everything): Zhuang Fangyi's ultimate stop, which shifts everything after its start by
  its length, so a value read from `appliedAt` inside the stop was set back by the rest of the stop.
- **Cause:** ReplayOptions.trace covers kit buffs only (BuffReplay.traces); nothing shows an enemy status's
  applications, holds, expiry or consumption step by step.
- **Suggestion:** `zmdlogs replay --trace-buff status:<status>` (ReplayOptions.trace extended to the enemy's statuses:
  each application, each step that moved its expiry or appliedAt with the stop, expiry or consumption) beside the log's
  lane of the status's debuff key and its last listed hit; and `zmdlogs statuses <fixture>` (the replay's status
  events, Vulnerable and physical statuses included, with the logged status hits interleaved). A replay edit: with or
  after point 6.
- **Why it helps:** the 4d60 jump and the d774 expiry would each have shown in one command.
- **From:** docs/friction-done/2026-11-23-smaller-leads.md point 1 (round 6's backlog, "Taken"; round 5's backlog point
  26, -gilberta-zhuang.md point 1); docs/friction-done/2026-11-23-hold-clocks.md point 3 (a).

## 8. The engine's clock: one shift value, and anchors read inside a stop
- **What happened:** cutting a running slow-down short (Arcane's combo reset, ramp-slowdowns report point 5) needed
  negative shifts through shiftWorld, shiftEnemy (Corrosion's appliedAt and rampHeld), shiftBuff, shiftClock and
  shiftOperator, each guarded `n <= 0`, plus a floor so nothing moves before the reset; a first attempt floored
  Corrosion's appliedAt (a reference, not an event) and was a frame off. And (hold-clocks report point 3 (b)) a value
  derived from an anchor (`frame - x.appliedAt`) read inside a stop is set back by the rest of the stop, since slowDown
  shifts everything after the stop's start at once; fixed for Corrosion (`rampHeld`, `rampElapsed`), not elsewhere.
- **Cause:** the clocks are moved by scattered `later(f)` closures, not one mapping; whether a field is an event time
  (floor it) or a reference (don't) is implicit; nothing routes other anchor readings through one helper.
- **Suggestion:** one `ClockShift` value (start, n) with `event(f)` and `reference(f)`, used by every shift function in
  packages/engine/src/timeline/clock.ts, and a comment at each state field saying which it is; grep the engine for other
  `frame - x.appliedAt` readings (buff layers' ramps, ticking buffs' counters) and route them through one helper like
  `rampElapsed`. Engine timing: `npm run smoke`, measure byte for byte, team-ab identical. When no other agent is in the
  engine's timeline code.
- **Why it helps:** the next change of a slow-down after it began (an interrupted ultimate, a cancelled combo) is a few
  lines, and the next anchor-based value doesn't repeat 4d60's jump.
- **From:** docs/friction-done/2026-11-23-ramp-slowdowns.md point 5; docs/friction-done/2026-11-23-hold-clocks.md
  point 3 (b).

## Parked

A new report that hits one brings it back with its full text from there.

Round 6's points 1–10, 12 and 14 (carried through rounds 5 and 6; full text in
docs/friction-done/2026-11-23-backlog-after-round-6.md under the same number):

- 1. groups: off under both readings or only under the replay's (split by logError, FORCED casts as a cause).
- 2. No interval selectors in census (`stagger:`, `control:<op>`, `--inside`).
- 3. A ticking buff's ticks and holds: logged against replayed (`zmdlogs ticks`, `--trace-buff` nextTick).
- 4. A cast's two variants both landing raises no flag (CastFlag "both-variants"; with point 6 here).
- 5. One skill's hits across logs with their zones (`hits --operator --event --zones`).
- 6. `differences` blames the applying hit for a buff it creates ("created by this hit").
- 7. A no-landing reason that hides an unlogged crit.
- 8. Open rule questions go stale as the engine moves (`examples/<team>.questions.json`).
- 9. Who inflicts what, as a team table (`kit-census --team`).
- 10. A buff's holds past its modelled end need a kit edit (`--buff-duration`, `measure --kit-duration`).
- 12. `zmdlogs instances` and the replay's casts disagree silently (`instances --replay`).
- 14. smoke and snapshots read the tree when their turn comes.

Round 5's points (full text in docs/friction-done/2026-11-22-backlog-after-round-5.md under the same number; 8 done by
round 7's scripts/cli-ab.ts, 12 folded into point 6 here):

- 1. Game-data file reads scattered; table files keyed by size and time (one dataFiles.ts module, exact cache key).
- 2. Status-event landings record no `facts` (`statusFacts` on LandedHit).
- 3. Status and Stagger modifiers identified by their `source` text (`Modifier.status`).
- 4. Test files carry copies of the same helpers (move onto tests/helpers/, drop @efsim/cli's re-export).
- 5. SP kept path-independent by a snap (an SP anchor, only when a shortcut needs it).
- 6. Fixed-length search times not documented (a table in docs/design/search.md).
- 7. Prose citations of doc sections and source paths not checked (extend scripts/check-links.ts).
- 9. Status log keys only in a doc table (`STATUS_LOG_KEYS`; a lane's `since` semantics).
- 10. The importer has no test of its own (on tests/helpers/zmdlogs.ts `syntheticDetail`).
- 11. No shared measure of teammates' attack share (`zmdlogs pace`).
- 13. The cast table's gaps and units (`SkillInstance` world gaps and cooldowns, branded ms / frames).
- 14. The weapon breakthrough table isn't loaded (needs the lead: tables.json, fetch-data in the main checkout).
- 15. A generic "in her ultimate" rules cue (`{ "inUltimate": op }`; team-ab).
- 16. Kit tests pin absolute expiries (`expectLasts`).
- 17. Loop tests depend on engine readings they don't test (pin `options.assume`).
- 18. Test texts in step with the kits (a kit-census warning).
- 19. Kit notes may rest on disabled actions (a one-off `isEnable` check; `efsim gamedata dilations` lists the
  switched-off dilations since round 7).
- 20. Who wears what; an operator's event keys (`zmdlogs list --weapon/--gear`, `census --by-key`).
- 21. `--assumptions` doesn't run the engine's readings (cli/assume.ts `alternatives()`).

## Needs an accuracy or search task (not friction work)

- **The hold-outs carry no `since` / `source`** (round 7's measure count; docs/open-problems.md "The buff clock"): all
  13, so the lane-based rules (hidden holds' run and status clocks, heldToLoggedEnds, layerCrits) are untested there.
  A blind re-import (`zmdlogs refresh` over the split's hold-out ids, nothing printed but counts) needs the downloads
  and the owner's go-ahead: the lead's call.

- **Ramp readings anchored on the application's logged ms** (docs/friction-done/2026-11-23-ramp-slowdowns.md point 2):
  every ramp bound runs from `since`; where the applying hit landed before a stop and was logged at its end (a7a7
  3.86 s, 489c 49.31 s) every reading of the instance looks over-held. Pair bounds between consecutive readings of one
  instance (P(b) − P(a) from the step edges; scripts/probes/corrosion/ramp-pairs.ts has them) and a softer application
  bound, or one checked against a battle skill's cast event + hit frame. Moves the placement: measure, the negative
  control (now in every measure).
- **`launch` delays the next cast, `beside` casts included** (docs/friction-done/2026-11-22-liino-beats.md point 4):
  exempting `beside` casts from timing.ts `ownHitsLanded` changes engine timing; smoke and team-ab.
- **Which skill a logged press is** (docs/friction-done/2026-11-22-yinglung-edge.md point 4): mark a press and a nearby
  placed variant as alternatives of one slot in withLoggedCasts and let makeCast drop the one the state rules out
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate (roadmap "cheaper variance"), and resumable guided searches.

## What worked well

The four reports said exactly which scratch scripts and commands they had wanted (hitdiff.py, `holds --base`,
`--why`, `measure --variant`), so each became a small tool with the report's own example as its test.
