# Merging round 5's batch of branches (2026-11-22)

Task: the lead's own friction while merging the eight accuracy branches of 2026-11-22 (Arcane, Gilberta/Zhuang,
Liino, Perlica, Rossi, the rule objective, Twilight, Yinglung's Edge) into one batch on main; recorded by improvement
round 5 from the lead's brief.

## 1. Branches that each pass premerge can still break each other

- **What happened:** Arcane's branch added a 30-frame hold for a due tick (TICK_HOLD_FRAMES in `heldTicks`,
  packages/logs/src/buffreplay.ts) for ticks logged as cast events; Rossi's branch made her bleed `ticksShownByHits`.
  Each passed premerge on its own base. Merged, the hold reached shown-by-hits ticks and a 489c bleed tick took the
  next tick's hit; tests/buffreplay-fixtures.test.ts caught it only because the lead ran the related tests by hand
  (fixed in the merge: "Replay: the long tick hold only for ticks logged as cast events").
- **Cause:** `npm run merge` merges and rebuilds generated files but runs no test; nothing names the code both sides
  changed, where such interactions live.
- **Suggestion:** after the merge, `npm run merge` runs `npx vitest related --run` on the source files both sides
  changed (or prints the command), and says so in its output.
- **Why it helps:** the interaction shows at merge time in seconds to minutes, not in the next premerge or a later
  agent's red test.

## 2. Adding a branch meant stopping a running job

- **What happened:** to add another branch to the batch the lead had to stop a queued snapshots/premerge run (a
  snapshot conflict leaves the merge uncommitted until `snapshots:update` runs), then start it again after the merge.
- **Cause:** merge.ts handles one branch per call and wants the snapshots regenerated before it commits.
- **Suggestion:** a batch mode, `npm run merge -- a b c`: merge each in order, take our side of snapshot conflicts
  and commit, then one `snapshots:update` at the end.
- **Why it helps:** one snapshots run per batch, and no running job to kill.

## What worked well

`npm run merge` rebuilding the journal and its index on every conflict; `npm run snapshots:update` resolving the
snapshot conflicts by regeneration.

## Outcome (round 5)

2026-11-22, improvement round 5 (docs/friction-done/2026-11-22-round-5.md); what's left is in docs/friction/2026-11-22-backlog-after-round-5.md.

- 1 (branches that each pass premerge break each other): done (6032c21): after the merges, `npm run merge` runs `npx vitest related --run` on the code both sides changed (source files of a package both sides touched, and files both touched; scripts/merge.ts `sharedCode`, tested on the round's own case), under the test lock; `--no-test` prints the command.
- 2 (adding a branch meant stopping a running job): done (6032c21): `npm run merge -- a b c` merges a batch in order, takes our side of snapshot conflicts and commits, then one `snapshots:update` at the end (`--snapshots`) or a line saying to run it once.
