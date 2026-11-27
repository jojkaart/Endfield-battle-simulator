# Several targets read per target (2026-11-27)

Task: per-target state for the log check of the three several-targets fights (6339, 7b54: Hard 33's eight slugs;
9c6e: Hard 31's two Wanderers): which target each logged hit is on, each target's debuffs and kills; branch of the
accuracy agent beside the Stagger-break placement agent.

## 1. The placement spreads a several-targets cast's twins over its slots, and nothing says so

- **What happened:** after the per-target totals were in, 7b54 went from +15.7% to +61.3%. It took a `totals --by
  event`, a `hits` listing and a `replay --operator Si` window to see why: Si's combo slashes, logged as 2 slashes × 4
  slugs at 15.60 s, took eight of the kit's ten slash slots, so the final's slot got two slugs' slashes at 15.80 s
  (135,567 against 6,040) and a second combo was opened for the rest. Counting that landing once per slug doubled a
  placement error. The fix in my files (copies only where the twin's value fits its target) is a workaround; the cause
  is in logcasts.ts placeWith, the other agent's file, where `sameByValue` can't tell a twin from the next slot when
  the slots' multipliers are equal ("40d9's Si combo slashes … alike in value, undecided").
- **Cause:** the placement has no notion of targets; its second-enemy rule (`used`, `sameByValue`) decides a twin by
  value only, and the views show the result (a final paired with a slash) but not the rule that made it (no "TWIN"
  decision line in `zmdlogs replay` / `decisions`).
- **Suggestion:** in a fixture marked severalTargets, a logged hit at its key's last logged ms is that slot on another
  target while the next slot's kit frame is more than one log flush (about 100 ms of world time) past the current
  slot's, or the twin count at that ms divides evenly by the slots due there; and a `TWIN` decision line (the hit, the
  slot it joined or why not) in `zmdlogs replay`, so a several-targets lead sees the placement's choice directly.
- **Files:** packages/logs/src/logcasts.ts (placeWith, sameByValue), packages/logs/src/decisionsview.ts, views.ts.
- **Why it helps:** 7b54's replay-only +29.5% is mostly this (Si's slashes at 16.6–17.7 s, the 17.67 s final); a
  decision line would have saved three views' worth of digging.

## 2. No view prints the per-target assignment

- **What happened:** to check the assignment I wrote scratch/targets-debug.ts (each hit's target, how it was chosen,
  the units dropped, the replay's enemy buffs with appliedAt/expiresAt at the hit). Every question about a slug's
  state went through it.
- **Cause:** fightTargets is new; `zmdlogs hits --json` has no target field.
- **Suggestion:** add `target` (index, `how`, `drop`) to `zmdlogs hits --json` and a `T<n>` column to the text lines
  for a severalTargets fixture (hitexport.ts reads enginecheck.ts fightTargets).
- **Files:** packages/logs/src/hitexport.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** the next several-targets lead (statuses per target, the shielded slugs) reads the assignment
  without a script.

## 3. A kill gap's landing on a shielded target isn't a state the engine has

- **What happened:** keeping the replay's enemy in 6339's kill gaps gave the next slug Camille's Vesperwings at
  14.09 s as the log lists, but also her weapon's Heat DMG, which the log doesn't: a shielded slug takes no
  infliction. The engine has "away" (nothing lands) and "there" (everything lands), not "there, 0 damage, no
  infliction, buffs still applied". Measured as `targets-gaps-away`: one plain hit and 2.3 points of 6339's total
  either way.
- **Cause:** TimelineScenario.enemyAway is all or nothing.
- **Suggestion:** a `shielded` span kind beside enemyAway (landings land at 0 damage, no infliction or status, kit
  buffs on hit applied), read only by the replay; or leave it until a second stage needs it (Hard 33 only).
- **Files:** packages/engine/src/timeline/landing.ts, packages/logs/src/replayrun.ts.
- **Why it helps:** the slugs' kill gaps (and their replay-only landings: Laevatain's 21.60 s hit_2) become checkable.

## What worked well

- `npm run measure -- --base HEAD --variant id=r …` measured three readings and the old one in one run, each
  against the plain tree: the decision between gated and ungated copies came straight from it.
- scripts/probes/targets/ and the open-problems entry gave the evidence (kills at whole slugs, one listing for every
  slug) without re-deriving it.
- `node scripts/edit.ts` for the fixtures' fields and multi-line edits: no shell quoting trouble.
