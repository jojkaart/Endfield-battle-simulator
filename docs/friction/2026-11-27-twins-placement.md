# Twins on several targets (2026-11-27)

Task: make the placement take a several-targets fight's same-ms twins as one landing of one slot (7b54's Si combos),
then decide from the logs which of 6339's, 7b54's and 9c6e's one-sided landings are placement errors; branch of the
accuracy agent beside the build-fit agent.

## 1. A replay rule's guard passes by rounding, and nothing shows that it did

- **What happened:** 6339's 21.60 s Laevatain hit_2 (+10.2% of the fight) was kept by tailCuts' guard "a logged hit
  of its operator's casts no other cast holds" (replayrun.ts). The hit it named was the cast's own killing hit at
  20.37 s, which passes `h.t > ms(lastLogged)` because the log's ms is 0.3 ms after its frame's time; about half of
  every cast's own last landings pass that way. Making the guard exact moved 24 development logs (plain 84.3 → 83.7%,
  c4f3 −66): the coincidence keeps tails whose effects later hits need. Two full measures (about 4 min each with the
  queue) to find that out, then a revert and a docs/tried diff.
- **Cause:** the guard's comparison mixes the log's ms with frame times, and its TAILKEPT line says "a logged hit …
  may be its tail's" without saying it is the cast's own landing; the guard's real job (did the tail's effects come?)
  is done by a weaker proxy that only works by accident.
- **Suggestion:** have TAILKEPT name whether the hit it cites is held by the cast itself (`own landing, +0.3 ms`),
  and add a probe or a `zmdlogs replay --tails` count of the tails each guard kept by kind across `--all`, so the
  next round sees that the own-landing pass is what keeps most tails, before measuring a change to it.
- **Files:** packages/logs/src/replayrun.ts (tailCuts, TailKept), packages/logs/src/views.ts.
- **Why it helps:** a guard that works by rounding is the kind of rule the next agent "fixes" and loses 66 plain
  for; saying it in the line costs nothing.

## 2. The several-targets row is three logs, but a measure always runs all 74

- **What happened:** most of this round's measures only needed the three several-targets fixtures; I used
  `--logs 6339,7b54,9c6e` once, late. The full runs took 2 min each plus the lock queue (another worktree's measure
  ahead), five times.
- **Cause:** nothing points to `--logs` for a change gated to marked fixtures; the measure's help lists it among 20
  options.
- **Suggestion:** `npm run measure -- --several-targets` (or `--row targets`) as a shorthand for the marked fixtures,
  and a line in docs/design/tests.md "Measuring a change": a change gated on a fixture mark measures those logs first.
  The final measure stays full.
- **Files:** scripts/measure.ts, docs/design/tests.md.
- **Why it helps:** a minute per iteration on a row of three logs.

## 3. A kit gap looks like a placement error until the game data is read

- **What happened:** "Camille's battle-skill hits are never placed" (6339) took a while: the key
  `normal_skill_abilityrange` is not in her kit, and only `gamedata who` on it, then on projhit_sub, reset_target and
  listen_target_dead showed it is her Vesperwings moving to the next target at a death. The logged cast events at
  those hits' ms looked like presses; reading them as no press measured worse because the press stood in for the move.
- **Cause:** `zmdlogs replay`'s NOLAND line says "a hit the placement doesn't place" for a key no kit hit lists, the
  same words as for a known key the placement couldn't fit.
- **Suggestion:** a distinct NOLAND reason for a key no kit hit or trigger hit lists ("a key the kit lacks"), with
  `gamedata who <key>`'s first line (the skill or buff that casts it) appended.
- **Files:** packages/logs/src/views.ts (replay's NOLAND lines), packages/logs/src/onesided.ts (the `uncovered`
  nature's words).
- **Why it helps:** a kit gap and a placement error go to different agents (packages/data against packages/logs).

## What worked well

- `zmdlogs casts --choices` and `node scripts/cli-ab.ts HEAD -- zmdlogs casts <fixture>` showed exactly which
  placements a rule moved in 9c6e (Typhoeus's shots, Ardelia's attack 3), before any measure.
- `--variant several-targets=targets-ungated` measured a reading and the plain tree in one run.
- `node scripts/edit.ts` with reversed blocks (a scratch script swapping old and new) took a measured change back
  out cleanly to keep it in docs/tried.
