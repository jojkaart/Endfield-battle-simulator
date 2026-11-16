# Backlog after improvement round 2 (2026-11-16)

Task: the points of the three open reports of round 2 (docs/friction-done/2026-11-16-backlog-after-round-1.md,
-round-1-friction.md, -phase-2-friction.md) that round 2 (docs/friction-done/2026-11-16-round-2.md) didn't do. Each
point is complete on its own; the originals are in docs/friction-done/.

## 1. Game-data file reads are scattered, so table files are keyed by size and time

- **What happened:** the compiled game-data cache (packages/data/src/cache.ts) is keyed by a hash of its inputs.
  Round 2 narrowed the code part to what the build runs (`dataSources`, traced from gameData.ts; the engine's core
  through core.ts), but the data files are still keyed by proxies: each source's commit, each table file's size and
  time, each rmxlinux `Json/` folder's time. An in-place edit of one SkillData file that leaves its folder's time
  unchanged goes unnoticed. The files are read at about 40 call sites in eight modules (sources.ts `readTable`,
  skillData.ts, buffData.ts, skillCompile.ts, skillGraph.ts, kits.ts, foods.ts, some `readdirSync`), each building its
  own path.
- **Cause:** the data package has no single place where it touches the data directory.
- **Suggestion:** one module, `packages/data/src/dataFiles.ts`, with `readDataJson(source, relPath)`,
  `dataFileExists(source, relPath)` and `listDataDir(source, relPath)`, building every path under `sourceDir` and
  recording what it touched. Move the call sites onto it; the cache entry stores the recorded paths with sizes and
  times and checks them on read (`gameDataCacheInputs` gets a `data-file:` label per file, so `rebuildReason` names
  the changed file). An ESLint `no-restricted-imports` of `node:fs` in packages/data/src (except that module,
  cache.ts and kits.ts's kit reading) keeps it so.
- **Why it helps:** an exact key instead of proxies, and one place for the fetch list (tables.json) and provenance.
  Cost: a mechanical refactor of the loaders; the cache's "cached equals fresh" test checks it.

## 2. Status-event landings record no `facts`

- **What happened:** `efsim zmdlogs hits --json` gives kit hits the enemy's statuses (`landing.facts.enemy`), but
  status landings (reactions, bursts, Combustion ticks, Lift, Shatter) have no `facts`: landing.ts `eventDamage`
  builds its landing without them (only `landHit` records them, on a replay's kit hits). `LandedHit.facts` now says so.
- **Cause:** `LandingFacts` is shaped for kit hits (stacks, consumed, castLink, buffLayers); nothing fits a status
  event.
- **Suggestion:** a `StatusLandingFacts` (`enemy`, `staggered`, `enemyHp`) recorded in `eventDamage` under the same
  condition as kit hits' (`ctx.loggedCrits`), with `LandedHit.facts` a union or a separate `statusFacts` field. Round
  2's audit of the readers: buffreplay.ts (the "free landings" matched to logged hits: `h.ref === undefined && h.facts`)
  would start seeing status landings, but it then requires the landing's kit hit to list the logged event
  (`eventsOf.get(operator|skillId|hitId)`), which a status landing has none of, so they're skipped; logcheck.ts reads
  `facts` only for kit-hit landings (`landedHit` is null for reactions); hitexport.ts would add `enemy` to status
  records (the point). A separate field avoids even the buffreplay filter. Run the pending suite before and after:
  verdicts must not move.
- **Why it helps:** "which statuses were on the enemy when this burst landed" becomes one field read. Cost: small.

## 3. Older fixtures lack the fields new imports keep: **done** (2026-11-16)

- **What happened:** since round 1 the importer keeps each effect's giver and start (`LogEffect.source`, `since`) and a
  Stagger's credited skill (`LogHit.poise.origin`), and caches the raw detail (git-ignored). The 79 older development
  fixtures were imported before, and their raw details aren't on disk.
- **Cause:** the raw details were thrown away at import; fetching them all again is a mass download (CLAUDE.md: ask
  the owner first).
- **Suggestion:** fill fixtures as their details get cached for other reasons (`efsim zmdlogs raw <fixture>` fetches
  one once): extend `efsim zmdlogs refresh` (packages/logs/src/logs.ts `refreshFixture`) to read the cached detail
  when `--detail` is omitted and to add the effects' `source` / `since`. Re-run the pending suite after each refresh:
  verdicts must stay identical. Or ask the owner whether a slow one-off fetch (3 s apart) is acceptable.
- **Why it helps:** "debuff strength against applier" and "which path ended this Inksoul" become direct on every log.
- **Done:** `efsim zmdlogs refresh <fixture>` reads the cached detail (else fetches it once), rebuilds the hits as an
  import would and adds every field the fixture lacks (casts, poise, poise.origin, effects' source / since), one
  note per kind; it writes nothing when the hits differ otherwise. The owner approved a one-off fetch: 77 of the 79
  older development fixtures refreshed, no verdict or scoreboard number moved; 40d9 and 4e5e refused (their details
  changed since import). Journal: docs/journal/2026-11-16-18-older-development-fixtures-refreshed-from-fresh-battle.md.

## 4. Status and Stagger modifiers are identified by their `source` text

- **What happened:** the guided rule analysis keys multipliers by regexes over strings like `"Corrosion level 1"` and
  `"Staggered"`.
- **Cause:** `Modifier` (packages/engine/src/effects.ts) has `kitBuff` for kit buffs, nothing structured for statuses
  and Stagger.
- **Suggestion:** an optional `status?: "corrosion" | "electrification" | "breach" | "stagger" | …` on `Modifier`, set
  where status.ts `statusModifiers` and the Stagger modifier are made. First audit the log check's comparisons of
  engine and log modifiers (packages/logs/src/logcheck.ts `signature`, enginecheck.ts `loggedEntries`,
  logeffects.ts): a field on one side only could change verdicts. Run the pending suite before and after.
- **Why it helps:** analyses stop parsing display strings. Cost: small once the audit is done.

## 5. Test files still carry copies of the same helpers

- **What happened:** tests/helpers/synthetic.ts and tests/helpers/buffs.ts exist, but buffreplay.test.ts,
  batch4-logs.test.ts, batch4-data.test.ts, batch4-dive.test.ts and others still define their own `withKit`, `hit`,
  `logHit` and `fixture`, and the search tests their `expectSameFuture` and example scenarios. Many test files also
  import log functions through `@efsim/cli`, which re-exports `@efsim/logs` since round 2 only for compatibility.
- **Cause:** helpers grew inside test files; splitting a file meant copying them.
- **Suggestion:** move each family onto tests/helpers/ (add `tests/helpers/search.ts`), one file per commit, then
  `npm run prune-unused -- <file>`; tests must pass unchanged. Point log imports at `@efsim/logs` while there, and drop
  the re-export from packages/cli/src/index.ts once nothing uses it.
- **Why it helps:** a split becomes one import line; helpers stop drifting. Cost: an hour of careful moves.

## 6. SP is a value at the state's frame, kept path-independent by a snap

- **What happened:** phase 2 found SP differed by float noise between advancing frame by frame and at once
  (99.99999999999997 vs 100), so an SP-gated press started a frame apart; `spAt` now snaps regenerated SP to its
  1/15 grid, which makes the two paths agree.
- **Cause:** `TimelineState` stores SP as a value at `state.frame`, and every advance rewrites both.
- **Suggestion:** only when a new shortcut (memoised advance from a cached frame, a port) needs exact path
  independence without the snap: store an anchor (`sp` and the frame it was measured at) that only grants, spends and
  the cap change, and compute SP at a frame from it. Measure first: the examples' and rule runs' snapshots must not
  move, or each move needs its reason.
- **Why it helps:** equality by construction instead of by rounding. Cost: touches every SP read and write.

## 7. Fixed-length search times aren't documented

- **What happened:** sustained 300 s search references took 34–86 min per team (beam 6, `--single --no-macros`),
  found only by running them.
- **Cause:** docs/design/search.md gives loop run times, not fixed-length search times per team, length and beam.
- **Suggestion:** a small table there (team × fight length × beam → minutes, CPU seconds, load), measured with
  `node scripts/with-lock.ts npm run bench -- …` and `efsim search --duration`.
- **Why it helps:** agents can plan or skip long references. Cost: one long measuring session.

## What worked well

The three reports' points were each specific enough to implement or to carry over without their transcripts.
