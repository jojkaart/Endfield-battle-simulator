# Improvement round 17 itself (2026-11-27)

Task: improvement round 17 over the five open friction reports and round 16's backlog, every file free; branch
worktree-agent-a16f5232d3d1dbf34 on main at 44a72be. Points already in docs/friction/2026-11-27-backlog-after-round-17.md
aren't repeated.

## 1. A stale scratch/msg.txt committed under the previous commit's message

- **What happened:** CLAUDE.md's commit form (write scratch/msg.txt, then `git commit -F scratch/msg.txt -- <paths>`)
  let me commit the kit-census change under the message of the commit before it ("holds' WIDE units …"): I had
  written the next message's text only in my head. `git log` showed two commits with one message; an amend fixed it,
  but on a branch already merged or a commit made by a sub-agent nobody watches, the history would say the wrong
  thing about what changed.
- **Cause:** nothing ties the message file to the commit it is for: the same file serves every commit of a task, and a
  commit with an unchanged one succeeds silently.
- **Suggestion:** bash-guard (scripts/bash-guard.ts, already a PreToolUse hook on every Bash call) refuses `git commit
  -F <file>` when the file's text is HEAD's message (`git log -1 --format=%B`), saying "scratch/msg.txt still holds the
  last commit's message: write this commit's first". One `git` call in the hook; no new command form.
- **Files:** scripts/bash-guard.ts, tests/edit-guard.test.ts.
- **Why it helps:** the commonest mistake of the file-based commit form can't land; cost: one git call per commit.

## 2. cli-ab --placement parses the casts view's text

- **What happened:** the placement A/B pairs and counts casts by regexes over `zmdlogs casts --choices` lines (the
  operator before the skill id, the rule in the first bracket). The first version failed on skill ids without an
  underscore (`attack4`): 82 casts came out as operator "?", rule "gone ← new", and only a run against an old commit
  showed it. Any later change to the CAST line's wording can break the counts the same way, with no test on the real
  output.
- **Cause:** the casts view has no structured output; the only interface is its text, written for reading.
- **Suggestion:** `zmdlogs casts --json` (one record per CAST, HIT and EVENT line: time, operator, skill, key, rule,
  paths, the hit's cast and slot), which scripts/placement-lines.ts prints and cli-ab.ts pairs by fields; keep the
  text pairing only for refs older than the flag.
- **Files:** packages/logs/src/views.ts (castsView), packages/cli/src/commands/zmdlogs.ts, scripts/placement-lines.ts,
  scripts/cli-ab.ts, tests/cli-ab.test.ts.
- **Why it helps:** the rule and operator counts stop depending on the line format; other scripts over the placement
  (measure's `--changed placement` lines) could read the same records.

## 3. A description in an engine source makes a text edit an engine change

- **What happened:** replacing a probe's path by the new view's name in engine assumption `pause-holds`'s reading text
  (packages/engine/src/timeline/assumptions.ts) rebuilt the game-data cache ("inputs changed since the last entry
  written: …assumptions.ts", about 10 s on the next CLI call, in every checkout sharing the cache) and, by the brief's
  rule, needed a team-ab identity run (3 min with the lock's queue) for a change of prose.
- **Cause:** the readings' long evidence texts live in the engine's own source, which the data cache keys on and the
  engine-change rules cover.
- **Suggestion:** keep each assumption's evidence text (`readings` descriptions past their first sentence) in a data
  file beside it (packages/engine/src/timeline/assumption-notes.json, or the docs page docs/design/assumptions.md the
  CLI reads for `efsim assumptions`), out of cache.ts's engineSources trace; or exempt string-only diffs of
  assumptions.ts from the cache key (engineSources already traces per file).
- **Files:** packages/engine/src/timeline/assumptions.ts, packages/data/src/cache.ts (engineSources),
  packages/cli/src/commands/assumptions.ts.
- **Why it helps:** the open-problems and evidence prose of a reading can follow the views as they change without a
  cache rebuild and an engine check.

## What worked well

- `node scripts/edit.ts` for every multi-line change (45 batches, one miss, caught with nothing written), and
  `npx tsc --noEmit` plus `npm run -s lint:changed` after each.
- `scripts/check-links.ts`'s stale-citation warning caught data.md's "views.ts batchDisagreements" after the move.
- snapshots:update's "keys added only" line and a 30-line row-by-row comparison of docs/accuracy.md against the base
  answered "nothing moved" in two steps.

## Outcome (round 18)

- 1 (A stale scratch/msg.txt committed under the previous commit's message): done: scripts/bash-guard.ts refuses
  `git commit -F <file>` while the file holds HEAD's message (commitMessageFile, staleMessage; the hook reads the
  call's cwd).
- 2 (cli-ab --placement parses the casts view's text): done: views.ts castsRecords (`zmdlogs casts --json`),
  scripts/placement-lines.ts prints them where the code has them, and cli-ab compares records by their fields (a new
  note on a line, round 18's [joined: …], moves nothing); against an older commit, the text as before.
- 3 (A description in an engine source makes a text edit an engine change): carried (2026-11-27-backlog-after-round-18.md point 2)
