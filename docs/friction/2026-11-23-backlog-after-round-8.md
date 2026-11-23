# Backlog after improvement round 8 (2026-11-23)

Task: the points of the reports round 8 read (docs/friction-done/2026-11-23-round-8.md lists them) that round 8
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 8)"
section. Point 1 is round 7's backlog point 1 carried (`node scripts/friction.ts carry`: its "From" line names where
it began); round 8 did every other live point or parked it. Then the parked list (docs/friction/README.md, "The
backlog stays short") and the leads that need an accuracy task.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A layered or consumed buff's layers: per hit and per cast, log against replay
- **What happened:** Yinglung's Edge layers per combo had to be decoded from damage: `zmdlogs hits --json` gives the
  log reading only as a rounded value, not its zones or the kit buffs it dropped (no logged name), so a script can't
  tell "the log reading lacks Edge" from "it lacks an ATK buff"; no per-cast aggregate exists. A third of the session.
  Again (rossi-gilberta report point 4, 2026-11-23): comparing the replay's Wolven Blood layer count with the log's per
  hit, the agent sampled `kitWindows` at hits ±500 ms, so counts at a crit's own ms were off by one either way, and
  `BuffReplay.instances` returns null (crit dependent) for most of Rossi's hits; telling "a layer missing" from
  "sampling" took reading `zmdlogs replay` line by line.
- **Since round 8:** `zmdlogs hits --zones` gives each hit's primary zones, modifiers by source and the crit the
  replay took with its source, so the ATK zone and a layer count are told apart per hit; the log reading's zones and
  the per-cast and per-hit layer views below are still missing.
- **Suggestion:** (a) `logReading` as an object in hitexport.ts (value, zones, modifiers, the kit buffs dropped);
  (b) `zmdlogs consumed <fixture…> --buff <kit buff>`: per cast that consumes it, the engine's layers (ReplayCastFacts
  consumed) and the layers each reading's median implies, with agreement and exactness, other consumed buffs (Jade
  Vessel) solved jointly; (c) `zmdlogs layers <fixture> --kit-buff owner:id`: per logged hit, the log's listed layer
  count and the replay's at the landing's frame, before and after it (LandingFacts.buffLayers has the landing's; a
  replayrecord.ts field since round 8).
- **Why it helps:** every "is the replay's count of X right" question (Edge, Jade Vessel, Lustrous Carmine,
  Bonekrusha, Wolven Blood, MI Security) needs exactly this.
- **From:** docs/friction-done/2026-11-22-yinglung-edge.md point 1; round 5's backlog, point 34; round 6's backlog,
  point 11; docs/friction-done/2026-11-23-rossi-gilberta.md point 4; round 7's backlog, point 1.

## Parked

A new report that hits one brings it back with its full text from there.

Round 7's points (full text in docs/friction-done/2026-11-23-backlog-after-round-7.md under the same number):

- 2. `zmdlogs clock`'s remainders: `--on/--off` cast brackets, `--all` in place of scripts/probes/buff-clock/lanes.ts,
  the owner's trigger hit after the end with its origin.
- 5. Probes have no "still runs" check (none rotted).
- 7 (the rest). `zmdlogs statuses <fixture>`: the replay's status events with the logged status hits interleaved (the
  trace, `replay --trace-buff status:<s>`, was built in round 8).

Round 6's points 1–10, 12 and 14 (carried through rounds 5 and 6; full text in
docs/friction-done/2026-11-23-backlog-after-round-6.md under the same number):

- 1. groups: off under both readings or only under the replay's (split by logError, FORCED casts as a cause).
- 2. No interval selectors in census (`stagger:`, `control:<op>`, `--inside`).
- 3. A ticking buff's ticks and holds: logged against replayed (`zmdlogs ticks`, `--trace-buff` nextTick).
- 4. A cast's two variants both landing raises no flag (CastFlag "both-variants"; castFlag and the record are now
  apart: a small edit).
- 5. One skill's hits across logs with their zones (`hits --operator --event --zones`: `--zones` exists since round 8).
- 6. `differences` blames the applying hit for a buff it creates ("created by this hit").
- 7. A no-landing reason that hides an unlogged crit.
- 8. Open rule questions go stale as the engine moves (`examples/<team>.questions.json`).
- 9. Who inflicts what, as a team table (`kit-census --team`).
- 10. A buff's holds past its modelled end need a kit edit (`--buff-duration`; `measure --patch` since round 8 covers
  the measuring half).
- 12. `zmdlogs instances` and the replay's casts disagree silently (`instances --replay`).
- 14. smoke and snapshots read the tree when their turn comes.

Round 5's points (full text in docs/friction-done/2026-11-22-backlog-after-round-5.md under the same number; 8 done by
round 7's scripts/cli-ab.ts, 12 by round 8's replaysteps.ts):

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

- **A reset cuts only the slow-downs running when its cast starts** (round 8, `zmdlogs replay --stops`;
  docs/open-problems.md, Arcane's combo reset): a teammate's combo slow-down starting between Arcane's combo and her
  frame 9 runs whole in the engine (1d91 50.30 s: 25 frames; the lists' 3), against the one-dilation-per-priority rule
  the lists follow. An engine timing change (clock.ts slowDown: a pending reset of the priority cuts a slow-down that
  starts before it): smoke, team-ab, measure.
- **The log tools' stop lists from the timeline's applied slow-downs** (docs/friction-done/2026-11-23-remaining-leads.md
  point 3): BuffReplay.appliedStops has them since round 8; replayedCastStops (the hold bounds' and views' list) could
  read the first run's, so a cast cut early or a kit trigger's jump shows; Purrchena's combo has 30 list-only stops
  (04d4, 99fb). Moves the placement: measure.
- **Pinned expiries** (docs/friction-done/2026-11-23-backlog-after-round-7.md point 4): an `ActiveBuff.pinned` set by
  heldToLoggedEnds at the log's end once, which shiftBuff leaves alone, in place of the step-at-a-time keep and its
  clamp. Measured in round 8 with `measure --patch`: every verified and development entry unchanged, one hold-out entry
  "other" (neither better nor worse). Simpler code for the next "take X's end from the log" rule; it needs a snapshot
  update, so the next accuracy task in heldToLoggedEnds can take it (three edits: buffs.ts, clock.ts shiftBuff,
  buffreplay.ts heldToLoggedEnds; search.ts BUFF_KEY `pinned: true`).
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

Done since round 7's list: the hold-outs' missing `since` / `source` (refreshed blind:
docs/journal/2026-11-23-06-the-hold-outs-refreshed-blind-the-lane-rules-tested-on-them.md).

## What worked well

The reports named the exact view or flag they had wanted and the episode it would have shortened (458b's replay-only
finishers, 9c0b's INSIDE, 5082's Xaihi instance, Rossi's combo_3 curves), so each was built and checked on that
episode; and the replay's run as replayOnce with its record apart made five of them edits to one small module.
