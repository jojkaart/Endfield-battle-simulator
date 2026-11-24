# Backlog after improvement round 9 (2026-11-23)

Task: the points of the reports round 9 read (docs/friction-done/2026-11-23-round-9.md lists them) that round 9
didn't do. Each point is complete on its own; the originals are in docs/friction-done/ with an "Outcome (round 9)"
section. Round 8's backlog point 1 (the layers views) is parked after its second carry; the parked list and the
accuracy list follow.

A branch that closes a point adds a line under it: "Closed by <branch>, <commit>: how".

## 1. A slow-down's identity through the stop lists and the replay's record

- **What happened:** pairing the timeline's applied slow-downs with the log tools' stop lists by start frame and
  caster gave 52 length differences that went into a commit message (95cf3f6) before the view showed 0c14's Rossi
  combo_3 with "12 frames: the list has 19" beside "19 frames: as listed": her two frame-0 dilations had collided on
  one key (round 8). The replay's record merged two slow-downs of one start and priority the same way (stop-lists
  report point 2: Purrchena's shielded combo printed "the list has 20 frames" for an 18-frame one).
- **Since round 9:** the compiler gives each compiled slow-down its dilation's index in the skill file
  (SkillTiming.slowdowns `n`, packages/data/src/skillData.ts; SkillDilation `n`), and `gamedata dilations` matches
  by it. Nothing downstream carries it yet.
- **Suggestion:** carry `n` (and the skill) into TimeStop (packages/logs/src/logcasts.ts skillStops: `...d` or `n:
  d.n`), TimelineState.slowdowns (engine timeline/clock.ts slowDown's push: `n: d.n`, keep it out of search.ts's
  state key if one reads slowdowns) and AppliedStop (replayrecord.ts, keyed by the state's slow-down object or by
  (start, caster, n) in place of start|caster|priority|kind); then pair by (start, caster, n) first in views.ts
  stopsAgainstList. `zmdlogs stops --all --differ` before and after: the counts must stay (or explain each change);
  at round 9's end over the 61 development and verified logs: as listed 1380, covered 36 (14 logs), length 0,
  timeline only 1 (3f78: Rossi's 12-frame slow-down at 50.13 s), list only 0.
- **Why it helps:** the next comparison of the stop lists (the accuracy list's "the lists from the timeline")
  pairs exactly, and a count that goes into a commit is right the first time.
- **From:** docs/friction-done/2026-11-23-round-8-friction.md point 2; docs/friction-done/2026-11-23-stop-lists.md
  point 2.

## 2. A kit value written as "the data's length minus what the engine holds"

- **What happened:** Purrchena's shielded combo extends her shield by 41 − 23 frames, 23 being what the engine's
  slow-downs held on that path then. Ending the path at her loop's cast (SkillTiming.recasts) made it 13; the kit test
  caught it (castAt attack1 = 30 + 90 + 41 + 1), and the kit and its report needed hand edits (18 → 28;
  packages/data/kits/operators/chr_0038_purrche.json, the two combo_shielded triggers' notes).
- **Cause:** the kit compensates for an engine rule instead of naming it; nothing ties the number to the rule.
- **Suggestion:** an extendBuff form "pause it for the data's frames of the caster's time since the cast, less what
  the world's clock held of it" (`"pauseFrames": 41` beside `seconds`, events.ts; timeline/actions.ts extendBuff
  computes the frames the cast's own slow-downs held since its start from TimelineState.slowdowns), the kit stating
  the data's 41 and 40. Behaviour-identical on today's paths: smoke, team-ab (the identity check), measure.
- **Why it helps:** engine timing fixes (frame-0 slow-downs at a jump, the next one) stop touching kit numbers.
- **From:** docs/friction-done/2026-11-23-stop-lists.md point 3.

## 3. No test that a hit's replay-only and log-only twins don't come back

- **What happened:** Si's bursts appeared in every Si fight as a replay-only landing and a log-only hit at one ms
  (0c14 40.33 s: 248k against 231k), which made the replay-only share of 15 fights look like 10–20% and hid the real
  replay-only damage, until fightTotals paired Fixed DMG landings with their hits (fight totals report point 2).
- **Suggestion:** a test over the development logs (in the pending suite, from snapshotEntry's report, so no second
  run) that no fight has a replay-only part and a log-only hit of one operator within a frame of each other beyond a
  few (a count per log, the worst named), with the exceptions listed with why. Round 9 left it: it reads
  enginecheck.ts fightTotals' parts, which the accuracy agent of round 9 was changing (which landings end up
  one-sided); that agent, or the next on the totals, takes it.
- **Why it helps:** the split of a total is only useful when each side is real.
- **From:** docs/friction-done/2026-11-23-fight-totals.md point 2.

## Parked

A new report that hits one brings it back with its full text from there.

Round 8's point (full text in docs/friction-done/2026-11-23-backlog-after-round-8.md under the same number):

- 1. A layered or consumed buff's layers, per hit and per cast, log against replay (`logReading` as an object,
  `zmdlogs consumed`, `zmdlogs layers`; `hits --zones` covers part of it since round 8).

Round 7's points (full text in docs/friction-done/2026-11-23-backlog-after-round-7.md under the same number):

- 2. `zmdlogs clock`'s remainders: `--on/--off` cast brackets, `--all` in place of scripts/probes/buff-clock/lanes.ts,
  the owner's trigger hit after the end with its origin.
- 5. Probes have no "still runs" check (none rotted).
- 7 (the rest). `zmdlogs statuses <fixture>`: the replay's status events with the logged status hits interleaved.

Round 6's points 1–10, 12 and 14 (full text in docs/friction-done/2026-11-23-backlog-after-round-6.md under the same
number):

- 1. groups: off under both readings or only under the replay's (split by logError, FORCED casts as a cause).
- 2. No interval selectors in census (`stagger:`, `control:<op>`, `--inside`).
- 3. A ticking buff's ticks and holds: logged against replayed (`zmdlogs ticks`, `--trace-buff` nextTick).
- 4. A cast's two variants both landing raises no flag (CastFlag "both-variants").
- 5. One skill's hits across logs with their zones (`hits --operator --event --zones`).
- 6. `differences` blames the applying hit for a buff it creates ("created by this hit").
- 7. A no-landing reason that hides an unlogged crit.
- 8. Open rule questions go stale as the engine moves (`examples/<team>.questions.json`).
- 9. Who inflicts what, as a team table (`kit-census --team`).
- 10. A buff's holds past its modelled end need a kit edit (`--buff-duration`; `measure --patch` covers measuring).
- 12. `zmdlogs instances` and the replay's casts disagree silently (`instances --replay`).
- 14. smoke and snapshots read the tree when their turn comes.

Round 5's points (full text in docs/friction-done/2026-11-22-backlog-after-round-5.md under the same number):

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
- 19. Kit notes may rest on disabled actions (`efsim gamedata dilations` lists the switched-off dilations).
- 20. Who wears what; an operator's event keys (`zmdlogs list --weapon/--gear`, `census --by-key`).
- 21. `--assumptions` doesn't run the engine's readings (cli/assume.ts `alternatives()`).

## Needs an accuracy or search task (not friction work)

- **The build-offset screen's open lead** (round 9, `efsim zmdlogs offsets --all`; packages/logs/src/buildoffsets.ts
  OFFSETS_EXPLAINED): Snowshine in 04d4, ×0.962 on 77% of her 193 counted hits; `zmdlogs fit-build 04d4 --operator
  chr_0014_aurora`'s best needs two inputs (weapon level 51 and a food, 91 of 207 fit): undecided. And Purrchena in
  99fb (level 1 in the export, ×2.47): fit-build doesn't vary an operator's level (a buildfit.ts candidate set: the
  operator's level, its promotion following). A fitted override moves the verdicts: measure, snapshots:update; drop
  the OFFSETS_EXPLAINED entry with it.
- **The log tools' stop lists from the timeline's applied slow-downs** (docs/friction-done/2026-11-23-remaining-leads.md
  point 3): BuffReplay.appliedStops has them; replayedCastStops could read the first run's, so a cast cut early or a
  kit trigger's jump shows. Purrchena's part was closed (worktree-agent-a432f82c25a7b4d6b, 95917d1); `zmdlogs stops
  --all --differ` (round 9) gives what is left in a few minutes: one slow-down (3f78, Rossi at 50.13 s, timeline
  only), so the lists and the timeline now agree but for it. Moves the placement: measure.
- **Ramp readings anchored on the application's logged ms** (docs/friction-done/2026-11-23-ramp-slowdowns.md point 2):
  where the applying hit landed before a stop and was logged at its end (a7a7 3.86 s, 489c 49.31 s) every reading of
  the instance looks over-held. Pair bounds between consecutive readings of one instance (scripts/probes/corrosion/
  ramp-pairs.ts) and a softer application bound. Moves the placement: measure, the negative control.
- **`launch` delays the next cast, `beside` casts included** (docs/friction-done/2026-11-22-liino-beats.md point 4):
  exempting `beside` casts from timing.ts `ownHitsLanded` changes engine timing; smoke and team-ab.
- **Which skill a logged press is** (docs/friction-done/2026-11-22-yinglung-edge.md point 4): mark a press and a nearby
  placed variant as alternatives of one slot in withLoggedCasts and let makeCast drop the one the state rules out
  (db87's double Twilight battle skill; 04d4's Purrchena counter must stay); measure moves.
- **A cheaper guided rule search** (docs/friction-done/2026-11-22-rule-objective.md point 3): a screening stage on
  shorter fights or a control variate, and resumable guided searches.

Done since round 8's list: the combo reset's reach and pinned expiries (worktree-agent-a432f82c25a7b4d6b, 95917d1 and
5db22a6).

## What worked well

The reports named the episode each tool would have shortened (a9d7's food, 9c0b inside 489c, 8915's moved hold
unit, the JSONL with a done line in it), so each was built and checked on that episode in minutes; and measure's
worker, which loads any commit's code loosely, took the hidden holds' units for both sides without a change to the
replay.

## Outcome (round 10)

- 1 (A slow-down's identity through the stop lists and the replay's record): carried
  (docs/friction/2026-11-24-backlog-after-round-10.md point 1; round 9's own report hit it again). Its engine half (TimelineState.slowdowns in
  timeline/clock.ts) was outside this round's files (another agent's accuracy work; engine timing code), and the
  stops.ts move it needs touches logcasts.ts and replayrecord.ts, the placement's modules.
- 2 (A kit value written as "the data's length minus what the engine holds"): parked after its second carry (no new
  report hit it): an engine timing feature and a kit edit, both outside this round's files.
- 3 (No test that a hit's replay-only and log-only twins don't come back): parked after its second carry, now
  cheaper: snapshotEntry gives the one-sided landings (`oneSided`, 6cfe05c), whose contexts already pair twins (`twin
  like`, `twin other`), so the test is a count over the pending suite's entries; it pins an accuracy quantity, so the
  next agent on the totals sets its bound.
