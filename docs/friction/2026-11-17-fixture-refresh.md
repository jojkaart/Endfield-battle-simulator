# Refreshing the older log fixtures (2026-11-17)

Task: extend `efsim zmdlogs refresh` to read the cached raw detail and add what newer imports keep, refresh the 79
older development fixtures from a one-off fetch, then use the new fields where cheap (backlog after round 2, point 3).
Branch `worktree-agent-ad2a28efaa2f5bf4a`, merged into `claude/beautiful-rubin-rpg8vp`.

## 1. The hit export can't answer status questions about physical statuses

- **What happened:** to compare each logged debuff's giver (`LogEffect.source`) with the engine's applier, I used
  `hitRecords` (packages/logs/src/hitexport.ts), whose `landing.enemy` lists the enemy's statuses at a kit hit.
  Electrification worked (3,505 hits compared). Breach gave "engine has none" on all 1,527 hits. The reason:
  `landing.enemy` maps only `landing.facts.enemy.statuses` (reaction statuses); Breach, Lift, Crush and Knock Down
  live in `EnemyStatus.physical` (packages/engine/src/status.ts), which the export leaves out. Its doc comment says
  "enemy statuses", so I only found out from the empty result and a grep of status.ts. Breach's applier question
  (open-problems "Arts Intensity", Pogranichnik's Breach strength) stayed unanswered.
- **Cause:** the export was shaped for the reaction-status checks it was written for; `EnemyStatus` splits statuses
  into `statuses`, `physical`, `controls` and `vulnerable`, and the export carries only the first.
- **Suggestion:** in hitexport.ts add the physical statuses to `landing.enemy` (same record: status, level, operator,
  Arts Intensity, appliedAt, damageScale; `PhysicalStatus` names), or a `physical` list beside it; say in the
  `HitRecord` comment which of `EnemyStatus`'s lists are exported. The log check doesn't read the export, so verdicts
  can't move.
- **Why it helps:** "debuff strength against applier" becomes one script for Breach too, the open Pogranichnik
  question included. Cost: a few lines.

## 2. No map from log status keys to engine statuses for reaction debuffs, and no units on `appliedAt`

- **What happened:** to pair a logged effect with an engine status I needed the log's key for each status's debuff
  lane. Physical ones are in code (`PHYSICAL_KEYS`, status.ts; `PHYSICAL_EVENT_KINDS`, reactions.ts), but
  Electrification's debuff lane (`buff_common_pulse_pulse_conduct_triggered_do`, zone damageTaken) is nowhere; I found
  it by counting effect keys across the fixtures. Then `landing.enemy[].appliedAt` turned out to be a frame, not ms:
  the export's comment doesn't say, and I had to read status.ts (`appliedAt: frame`). Comparing it with the log's
  `since` (ms) agreed within 300 ms for only 1,212 of 3,705 hits, and I couldn't tell in the time whether that is a
  units/offset problem of mine or lanes renewed at re-applications.
- **Cause:** log keys of statuses are known only where a check needed them; the export passes engine fields through
  without saying their units.
- **Suggestion:** one table in packages/logs (e.g. logeffects.ts) `STATUS_LOG_KEYS: Record<status, { event?: string;
  debuff?: string }>` covering reaction and physical statuses, built on the existing `PHYSICAL_KEYS`; in hitexport.ts
  export `appliedAt` in ms (or name it `appliedAtFrame`), and say in data-sources.md whether a ZMDLogs buff lane's
  start is the first application or the latest refresh.
- **Why it helps:** comparisons of logged debuffs with the replay stop starting with a survey and a units hunt.

## 3. Waiting on a background job has no documented shape

- **What happened:** CLAUDE.md says to run long jobs in the background and wait with Monitor on a progress file, and
  refuses a foreground `sleep`. A Monitor notifies per line but doesn't block, so to wait for an end I improvised
  `timeout 590 tail -f file | grep -m1 "^done"` and `timeout … bash -c 'until grep -q …; do sleep 5; done'`. One of
  these matched the previous run's "done" line, because my script rewrote the same progress file only once
  `with-lock` let it start (another worktree held the lock), so I briefly read stale results as new.
- **Cause:** the wait pattern isn't written down; progress files are reused between runs and `with-lock`'s queue time
  sits before the script truncates them.
- **Suggestion:** in CLAUDE.md "Worktrees and sub-agents": one blessed wait line, e.g. `node scripts/wait-for.ts
  <file> <regex> [--timeout s]` (a small script: waits for a line matching after the file's current end, prints it,
  exits non-zero on timeout), and the rule "a progress file per run (name it with the time), or truncate it before
  `with-lock`". scripts/scratch-template.ts could show a progress logger that writes a run header first.
- **Why it helps:** no stale reads, no shell improvisation that the sandbox guard may refuse next time.

## 4. `snapshots:update` rewrites check timings, leaving a diff to judge

- **What happened:** after the refresh `npm run snapshots:update` reported "No log's verdicts moved" but changed
  tests/slow/pending-costs.json (60 lines of check times, measured under another worktree's load). Nothing says
  whether to commit it; I discarded it.
- **Cause:** a measured, machine-dependent file is regenerated by the same command as the deterministic snapshots.
- **Suggestion:** have `snapshots:update` leave pending-costs.json alone unless asked (`--costs`), or say in CLAUDE.md
  "Correctness" when to commit it (e.g. only when shards are rebalanced, on a quiet machine).
- **Why it helps:** a record-only change ends with a clean tree, and the "did anything move" answer is the tree.

## 5. The importer had no tests and no synthetic detail builder

- **What happened:** to test the refresh without network I needed a synthetic ZMDLogs detail. There was none: the
  importer (`zmdlogsToFixture`) had no test, and tests/helpers/ holds builders for kits and fixtures, not details. I
  wrote tests/helpers/zmdlogs.ts (`syntheticDetail`, `plainBuild`) from reading zmdlogs.ts field by field, and my
  first run failed on an element name (`nature` instead of `natural`) that the helper's types didn't catch.
- **Cause:** the importer was checked only through real fixtures.
- **Suggestion:** type `DetailEvent.element` / effect `element` in the helper as the engine's `Element` (or the ZMDLogs
  names it accepts), and add a short importer test on `syntheticDetail` (zones mapped, target-side zones dropped on
  operators, boundary effects, unquantified) so a later importer change has a guard besides the 79 fixtures.
- **Why it helps:** the next importer or refresh change starts from a builder and a failing test, not from reading
  the parser.

## What worked well

- The raw cache and `rawDetail` with an injectable fetch made the one-off download a 40-line script, and the refresh
  testable without network.
- `logFixtureFiles` never listing hold-outs, and `refuseHoldout` in the cache, made it easy to keep them out of every
  step.
- `snapshots:update`'s summary ("No log's verdicts moved") answered the record-only question in one line;
  `git commit --pathspec-from-file` committed 77 fixtures by explicit path in one plain command.
