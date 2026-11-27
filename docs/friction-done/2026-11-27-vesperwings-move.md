# Camille's Vesperwings moving to the next target (2026-11-27)

Task: model Camille's Vesperwings moving to the next slug when its own dies (kit trigger, the replay's landing with no
press) and measure it on the several-targets fights; branch worktree-agent-a717931610a3bd909 from main at e4a1e36.

## 1. No way for the replay to make a non-cast event in the engine

- **What happened:** the move is a kit trigger on a target's death, and the replay's only entries into the engine
  are casts (replayCast), Stagger steps and holds. I added an engine event (`targetDeath`), a driver (`targetDies`)
  that runs triggers on it, its own ReplayStep field (`death`) with a rank, a stepWords line, and pinning of the
  triggered hits (a copy of replayCast's landing pin in a few lines). The first version put the death at the
  landing less the trigger's lead, which made nothing at 6339's 29.67 s: the log's purge (`logged-purges`) had
  already ended the debuff the trigger's `if` reads; found only with `--trace-buff` and `--trace-trigger`.
- **Cause:** replayrun.ts replayOnce hard-codes each step kind as an `if (s.x !== undefined) { …; continue; }` arm,
  and pinning landings at logged frames exists only inside replayCast.
- **Suggestion:** one "event step" in ReplaySteps carrying a BattleEvent (and optional pinned landings), with one engine
  driver `replayEvent(ctx, st, event, landings)` that both deaths and any later log-driven event (an enemy action the
  log shows, a break) use; move replayCast's landing pin into a helper both call.
- **Files:** packages/logs/src/replaysteps.ts, packages/logs/src/replayrun.ts, packages/engine/src/timeline/drivers.ts
- **Why it helps:** the next log-driven trigger (Arcane's seal or Si's ink at a kill, both in the slug fights) needs
  no new step kind; the pin rules stay in one place.

## 2. A trigger's hit keys turn into a placement group silently

- **What happened:** giving the move's hit its log key (`chr_0033_camille_normal_skill_abilityrange`) made
  logcasts.ts groupsOf add a `trigger:vesperwings_move` group, whose "casts" (kind null) then showed in NOLAND lines
  as "its placed cast (chr_0033_camille_normal_skill from 29.57 s) isn't one the replay casts (distinctCasts)". It
  read like a placement error until I found that trigger groups are placed and then dropped by design.
- **Cause:** the trigger-hit groups' role (placing landings for the trigger's own pairing, not casts) isn't named in
  the NOLAND text or the group's doc.
- **Suggestion:** NOLAND for a landing of a trigger group says "a trigger's landing (trigger:<id>): the replay lands
  it from the trigger's event, matched by time", not "its placed cast isn't one the replay casts".
- **Files:** packages/logs/src/views.ts (landingsOf / the NOLAND text), packages/logs/src/logcasts.ts groupsOf (doc)
- **Why it helps:** one false lead less on every new trigger hit with a log key.

## 3. A press that stood in for a missing kit feature hid a second effect

- **What happened:** with the move landed and its events no press, 6339 was mixed (plain 115 → 109): Si's combo
  slashes lost a Yinglung's Edge layer the removed presses had given. Finding it took a cli-ab of `zmdlogs hits
  --json` and comparing zone products by hand (damageBonus 3.558 → 3.358, one 0.2 layer).
- **Cause:** no view names which kit buffs a removed (or added) cast fed, so the side effects of a press the replay
  stops making are found by diffing zones.
- **Suggestion:** `cli-ab --hits-zones <fixture>`: for hits whose verdict moved, the modifiers (by kit buff) that
  differ between the two commits' primary readings, one line each.
- **Files:** scripts/cli-ab.ts, packages/logs/src/views.ts (hits --json already has `modifiers`)
- **Why it helps:** "which buff moved this hit" in one command for every change that adds or removes casts.

## What worked well

- `measure --variant` measured the cast-event reading and its plain twin in one run; the "against the plain tree"
  section answered the question directly.
- `--trace-buff` / `--trace-trigger` named the step that ended the debuff and the trigger's firings.
- `team-ab`'s identity check settled "no simulated fight moves" in minutes.

## Outcome (round 20)

- 1 (No way for the replay to make a non-cast event in the engine): done (7be8b2d): engine replayEvent (a log-driven
  event's triggers, their logged landings pinned) and pinLanding / pinAt (the one pin rule; replayCast uses it);
  targetDies is replayEvent's; ReplayStep.event (ReplayEventStep, deathEvent) in place of `death`, one arm in
  replayOnce. Snapshots and team-ab unchanged.
- 2 (A trigger's hit keys turn into a placement group silently): done (7be8b2d): a trigger group's NOLAND detail says
  "a trigger's landing (trigger:<id>): the replay lands it from the trigger's event and matches it by time";
  logcasts.ts groupsOf's doc says why such a group exists.
- 3 (A press that stood in for a missing kit feature hid a second effect): done (01dd011): `node scripts/cli-ab.ts
  <ref> --hits-zones <fixture>` (per moved hit, the modifiers that differ by kit buff and zone).
