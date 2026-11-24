## 2026-11-24: Improvement round 10: no shell programming, printers that say what they leave out, rows cached

**Goal:** the five open friction reports (round 9's backlog and own report, the one-sided landings, the physical
statuses, the misprediction statistics), tools only, beside an accuracy agent in the kits, fixtures, snapshots and
engine kit code; and the lead's item from the owner: no real shell programming left in the repository. Summary:
docs/friction-done/2026-11-24-round-10.md; backlog: docs/friction/2026-11-24-backlog-after-round-10.md.

**Done:**
- **The shell scripts in TypeScript.** scripts/done-line.ts (`doneJob`), scripts/premerge.ts (preconditions, steps,
  accuracy compare, done line), scripts/snapshots.ts, scripts/fetch-data.ts (CI's cache key too),
  scripts/session-start.ts; premerge.sh and the session hook are one `exec node` line each, and a test holds every
  tracked .sh to that. snapshots:update now also runs the tests that read a changed log's fixture.
- **Printers that say what they leave out.** `efsim kit`: each skill's paths (ends, jumps, the triggers' jumps on it)
  and every trigger's actions; `gamedata tree --path` and "presentation only" for a branch that only plays an effect
  (Empyrean's free-path branches: so not 4d60's Sunderblades); efsim names every option given but never read; `zmdlogs
  hits --from/--to`.
- **Rows cached and shared.** `zmdlogs totals --all --json` (every one-sided landing, cached); the hit and totals caches
  read from the main checkout's and other worktrees' at the same code key. HitRecord.graded. The offsets screen shows
  the check's ATK explanation. measure refuses a `--patch` the tree already has; `at-commit --run`.

**Scoreboard:** unchanged (snapshots:update, itself the new script: "No log's verdicts moved"; every file
byte-identical): development plain 67.1%, mismatch 11.6%, mean |damage error| 7.2%; hold-out 77.6%, 6.2%, 8.0%.

**Decisions:** premerge's vitest steps run under the lock as `testlock.ts` children, so a signal to premerge stops
them and frees the ticket (a spawnSync couldn't be interrupted; the synchronous runLocked is gone). A signal waits up
to 5 s for the running step before the cleanups, so snapshots puts its files back after vitest stopped writing. The
.sh wrappers use `exec` so a signal reaches node. The unread-option check warns (stderr, after the output) rather
than refuses: a spread of the values counts as reading all, so it can miss one but never names a wrong one. Round 9's
backlog points 2 and 3 parked after their second carry; the rest is the backlog's seven points.
