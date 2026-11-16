# Backlog after improvement round 1 (2026-11-16)

Task: the points of the eight friction reports of 2026-11-16 that round 1
(docs/friction-done/2026-11-16-round-1.md) didn't do and that aren't phase 2's
(the rule driver and rule tooling). Each point is complete on its own; the
original reports are in docs/friction-done/.

## 1. Game-data file reads are scattered, so the cache key can't list what the build read

- **What happened:** the compiled game-data cache (packages/data/src/cache.ts)
  should be keyed by what the build reads. Data files are read and probed at
  about 40 call sites in eight files (`sources.ts` `readTable`, skillData.ts,
  buffData.ts, skillCompile.ts, skillGraph.ts, kits.ts, foods.ts, some
  `readdirSync`), each building its own path. The key therefore uses proxies:
  the data sources' commits, the size and time of each table file, and the time
  of each folder under rmxlinux's `Json/`. An in-place edit of one SkillData
  file that leaves its folder's time unchanged goes unnoticed.
- **Cause:** the data package has no single place where it touches the data
  directory.
- **Suggestion:** one module, `packages/data/src/dataFiles.ts`, with
  `readDataJson(source, relPath)`, `dataFileExists(source, relPath)` and
  `listDataDir(source, relPath)`; it builds every path under `sourceDir` and
  records each path it touches. Move the call sites onto it; cache.ts stores
  the recorded paths with their sizes and times in the entry and checks them
  on read. An ESLint `no-restricted-imports` rule for `node:fs` in
  packages/data/src (except that module, cache.ts and kits.ts's kit reading)
  keeps it that way. `efsim gamedata` (packages/cli/src/gamedata.ts) reads the
  raw files for display and can stay outside it.
- **Why it helps:** an exact cache key instead of proxies, and one place for the
  fetch list (tables.json) and provenance. Cost: a mechanical refactor of the
  loaders; check that a fresh build equals the cached one (the cache's own test).

## 2. The engine's single `export *` index hides what the data package depends on

- **What happened:** the data build calls engine code, so engine edits must be in
  the cache key, but hashing the whole engine would invalidate the cache on every
  planning-code edit. cache.ts has a regex tracer (`engineSources`) that follows
  the data package's engine imports (11 of 43 files), falling back to the whole
  engine.
- **Cause:** the engine has one public surface mixing the core model (attributes,
  effects, damage, expr, timeline) with planning code (search, payoffs, policy).
- **Suggestion:** architecture review item 12: an `@efsim/engine/core` entry (a
  `core/` folder or a package `exports` subpath) holding what the data package
  and the timeline use; the data package imports only from it (ESLint
  `no-restricted-imports`); cache.ts hashes that folder and drops the tracer.
  Round 1 started the façade: packages/engine/src/timeline.ts now re-exports
  the read-only state queries drivers need.
- **Why it helps:** the cache key becomes a folder, and agents and the Rust port
  see where the core ends. Cost: moving files (a big diff); do it in a quiet
  window, not while another branch edits the engine.

## 3. Older fixtures lack the fields new imports keep

- **What happened:** since round 1 the importer keeps each effect's giver and
  start (`LogEffect.source`, `since`) and the skill a Stagger is credited to
  (`LogHit.poise.origin`, which tells Si's Final Stroke burst from an Inksoul
  expiry), and keeps the raw detail in a git-ignored cache. The 79 existing
  development fixtures were imported before, and their raw details aren't on
  disk.
- **Cause:** the raw details were thrown away at import; fetching them all again
  would be a mass download (CLAUDE.md: ask the owner first).
- **Suggestion:** fill fixtures as their details get cached for other reasons
  (`efsim zmdlogs raw <fixture>` fetches one once): extend `efsim zmdlogs
  refresh` to read the cached detail when `--detail` is omitted and to add the
  effects' `source` / `since` too (today it adds casts and Stagger, with
  `origin`). Re-run the pending suite after each refresh: verdicts must stay
  identical (these fields aren't read by the check). Or ask the owner whether a
  slow one-off fetch of all details (3 s apart) is acceptable.
- **Why it helps:** "debuff strength against applier" and "which path ended this
  Inksoul" become direct on every log. Cost: a refresh pass and a snapshot check.

## 4. Status and Stagger modifiers are identified by their `source` text

- **What happened:** the guided rule analysis keyed multipliers by regexes over
  strings like `"Corrosion level 1"` and the literal source `"Staggered"`.
- **Cause:** `Modifier` (packages/engine/src/effects.ts) has `kitBuff` for kit
  buffs but nothing structured for statuses and Stagger.
- **Suggestion:** an optional `status?: "corrosion" | "electrification" |
  "breach" | "stagger" | …` on `Modifier`, set where status.ts
  `statusModifiers` and the Stagger modifier are made. First audit the log
  check's comparisons of engine and log modifiers (logcheck.ts `signature`,
  enginecheck.ts `loggedEntries`, logeffects.ts): some compare modifiers by
  their fields, and a new field on one side only could change verdicts. Run the
  pending suite before and after.
- **Why it helps:** analyses stop parsing display strings that may change.
  Cost: small, once the audit is done.

## 5. Test files still carry copies of the same helpers

- **What happened:** round 1 added tests/helpers/synthetic.ts (`withOperatorKit`,
  `kitHit`, `logHitOf`, `syntheticFixture`) and tests/helpers/buffs.ts, and moved
  batch4-logs2.test.ts onto them. buffreplay.test.ts, batch4-logs.test.ts,
  batch4-data.test.ts, batch4-dive.test.ts and others still define their own
  `withKit`, `hit`, `logHit` and `fixture`, and the search tests their
  `expectSameFuture` and example scenarios.
- **Cause:** helpers grew inside test files; splitting a file meant copying them.
- **Suggestion:** move each family onto tests/helpers/ (add
  `tests/helpers/search.ts` for `expectSameFuture` and the example scenarios),
  one file per commit, then `npm run prune-unused -- <file>`; each file's tests
  must pass unchanged. Keep per-file variants as one-line wrappers where the
  defaults differ (buffreplay.test.ts's `hit` has `frames: [0]`).
- **Why it helps:** a split becomes one import line, and helpers stop drifting.
  Cost: an hour of careful moves.

## 6. Pending shards are balanced by hit count, not time

- **What happened:** `shard()` in tests/logverdicts.ts weighs logs by
  `hits.length`, but check time doesn't follow hits (340 hits took 59 s, 1,134
  took 21 s), so one shard sets test:logs' time. vitest.logs.config.ts also has no
  shared setup (each slow file loads the game data again; with the disk cache
  this is now ~1 s a file, so it matters less).
- **Cause:** a log's real cost (replay, alternatives) is known only after it ran.
- **Suggestion:** a committed `tests/slow/pending-costs.json` (seconds per log)
  that `npm run snapshots:update` writes from vitest's JSON report, read by
  `shard()` with hits as the fallback for a new log. Check the shards' times in
  premerge's table before and after.
- **Why it helps:** test:logs, the longest part of premerge, drops toward total
  work ÷ workers. Cost: one more generated file.

## 7. Watch single tests' times (none over ~30 s in `npm test` now)

- **What happened:** premerge failures under load were 60 s timeouts of single
  tests that took 30–50 s on an idle machine. Those were moved or split before
  round 1; round 1's premerge (load 1.4–4) measured the slowest default-suite
  test at 13 s (team-order's Typhoeus scenario) and file at 26 s
  (team-order.test.ts). In `test:logs` the two `efsim search --loop` CLI tests
  took 172 s and 142 s in one file (round 1 split them into two files). Round 1
  also made premerge re-run timed-out files and queue suites behind a lock,
  which would hide a new slow test.
- **Cause:** a global 60 s `testTimeout` and no check on single tests' time.
- **Suggestion:** premerge now prints each vitest step's slowest files and
  tests (scripts/premerge.ts `slowest`; round 1's run is quoted in
  docs/friction-done/2026-11-16-round-1.md); move each test over ~30 s to
  tests/slow/ or make it cheaper, and consider a test in the default suite that fails when a file's
  duration in the last report exceeds ~40 s (CLAUDE.md's rule).
- **Why it helps:** fewer re-runs, and `npm test` stays a few minutes. Cost:
  small.

## 8. No paired timing of the test suite against a base commit

- **What happened:** to show a test-speed change, an agent swapped test files
  back to the base commit by hand and ran both suites at different times under
  different load.
- **Cause:** `npm run bench` (round 1) alternates commands, but running another
  commit's tests needs a second checkout.
- **Suggestion:** `scripts/time-tests.sh <base-ref> [-- vitest args]`: a
  throwaway `git worktree add` of the base under scratch/ (with
  `node scripts/setup-worktree.ts` there), then `npm run bench` with the two
  suites as its commands, reporting CPU seconds; remove the worktree after.
- **Why it helps:** honest before/after numbers for test work. Cost: a short
  script; a paired run doubles the measuring time.

## 9. Fixed-length search times aren't documented

- **What happened:** sustained 300 s search references took 34–86 min per team
  (beam 6, `--single --no-macros`), found only by running them.
- **Cause:** design.md "Rotation search" gives loop run times, not fixed-length
  search times per team, length and beam.
- **Suggestion:** a small table in design.md "Rotation search" (team × fight
  length × beam → minutes, CPU seconds, load), measured with `npm run bench`
  and the new `efsim search --duration`.
- **Why it helps:** agents can plan or skip long references. Cost: one long
  measuring session.

## What worked well

Round 1's notes: the reports' format (what happened, cause, suggestion, why)
made each point implementable without the agents' transcripts, and points
named by several reports (premerge, the sandbox, hold-outs) were the easy
first priorities.
