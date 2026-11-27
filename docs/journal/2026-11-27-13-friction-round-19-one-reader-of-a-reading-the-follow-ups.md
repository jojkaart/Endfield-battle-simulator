## 2026-11-27: Friction round 19: one reader of a reading, the follow-ups view, an enemy's stage text

Goal: improvement round 19 over five reports and round 18's backlog (summary:
docs/friction-done/2026-11-27-round-19.md; what's left: docs/friction/2026-11-27-backlog-after-round-19.md).

Done: the engine's assumption registry moved out of timeline/ (packages/engine/src/assumptions.ts, the log replay's
own readings in replay-assumptions.ts), one sentence per reading with the evidence in docs/design/assumptions.md
(outside the game-data cache's key); every reader through `readingOf` with the run's readings, holds.ts tickBounds
among them (it took break-hold's and break-hold-place's defaults under a variant); a trace test that fails a reader
handed no readings. `zmdlogs followups` (a trigger's landings against the events that fired them, from a replay-only
record `LandedHit.fired`), `replay --against-lanes` with each pair's ends, `holds --steps`, `[pinned]` LAND lines,
`gamedata enemy` (Hard 33's "They are legion" in one command) and an ability entity's tree, `instancesWhy`,
`stateAt` / `optionsAt`, the hold-outs' key test in one helper with a blindness test over every printer of
accuracy.ts and measure.ts, friction.ts by a backlog's label, lead-files `--split`.

Decisions: the replay-only readings stay registered in the engine (its context checks every `--assume` id) but in a
file of their own; the evidence went to a Markdown doc the CLI parses rather than JSON, so it reads as a doc. The
readers' run check gives every assumption explicitly at its default, so the run is the default one and every default
path is traced. The recorded Stagger start (a new report brought round 16's parked point back) moves the holds: the
accuracy list, not this round.

Checks: `npm run snapshots:update`: no log's verdicts moved, nothing changed; team-ab identical at both engine
changes (the move, and the replay-only firing record).
