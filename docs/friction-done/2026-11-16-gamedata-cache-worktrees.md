# Game-data cache and worktrees without `source` (2026-11-16)

Task: cache the compiled GameData on disk (packages/data `loadGameData`), keyed by a hash of its inputs, and make the
CLI, tests and vitest work in a git worktree without a shell `source` step. Branch: the worktree branch of
`.claude/worktrees/agent-a564605d584af0090` (commit `41a9df1`, merged into main).

## 1. Premerge fails under load for reasons unrelated to the change

- **What happened:** `scripts/premerge.sh` ran three times (about 7–10 min each, ~30 min in all) and failed every time
  on 60 s test timeouts. Run 1: "Hot Work's Nature DMG …" in `tests/buffreplay.test.ts` and
  "efsim search --loop --sync says how rounds are cut and what holding cost" in `tests/search-loop.test.ts`. Runs 2 and
  3: the `--sync` test only (87–126 s). The load average was 6–15 on 4 CPUs, because other agents were working in
  parallel. Each test passed when run alone. To rule out my change I had to run an A/B check: the `--sync` test with
  and without the cache (`EFSIM_NO_CACHE=1`) took the same ~46 s. Because premerge stops at the first failing step,
  `npm run test:logs` and `npm run test:tools` never ran, and I ran them separately (another ~8 min). In the end I
  handed back with the gate red.
- **Cause:** `npm test` holds a few single tests that take 45–60 s on an idle machine. vitest.config.ts sets one
  global `testTimeout: 60_000` and leaves the worker count at its default, which ignores the load from other agents.
  When a timeout fails the gate, nothing tells it apart from a real failure. Premerge then stops instead of running
  the rest of the check.
- **Suggestion:**
  - Move every test that takes over ~30 s on an idle machine to `tests/slow` (the tests agent is doing this for
    search-loop).
  - In `scripts/premerge.sh`, rerun the failed files alone once (`npx vitest run <files>`) when the only failures are
    `Test timed out`. Pass the gate if they pass alone, and print that they were timeouts under load.
  - Run `test:logs` and `test:tools` even when `npm test` fails, so one premerge shows every failure.
- **Why it helps:** an agent stops paying ~10 min per premerge attempt for timeouts it didn't cause, and doesn't need
  its own A/B check to prove that. Risk: a real slowdown could hide behind the rerun. Printing the rerun files and
  their times keeps it visible.

## 2. The CLI's checkout check can't run before Node links the wrong package

- **What happened:** I added `packages/cli/src/checkout.ts`, imported first by `main.ts`, to stop the CLI when
  `@efsim/*` resolves to the main checkout. To test it I removed the worktree's `node_modules/@efsim` links. Node
  failed before my check could run, with
  `SyntaxError: The requested module '@efsim/data' does not provide an export named 'cacheDir'`.
  The check only fires when the other checkout happens to export every name the CLI imports. I tested that case with
  only `@efsim/engine` pointed at the main checkout.
- **Cause:** ESM resolves and links the whole static import graph of `main.ts` before it evaluates any module. A
  first import can't guard the imports next to it. `main.ts` is both the documented entry point
  (`node packages/cli/src/main.ts`) and a 600-line module with ~20 static imports.
- **Suggestion:** split the entry point. `packages/cli/src/main.ts` becomes about three lines:
  `import "./checkout.ts"; await import("./cli.ts");`. The current body moves to `cli.ts`. Do it when no other branch
  is editing `main.ts`: git sees the change as a rewrite of `main.ts`, so parallel edits would conflict.
- **Why it helps:** the "wrong checkout" error is always the clear one, never a SyntaxError that names an export.
  Cost: one large move in a file that is often edited.

## 3. Game-data file reads are scattered, so the cache key can't list what the build read

- **What happened:** the cache key should cover what the build reads. Data files are read and probed at about 40
  call sites in eight files: `sources.ts` `readTable`, `skillData.ts`, `buffData.ts`, `skillCompile.ts`,
  `skillGraph.ts`, `kits.ts`, `foods.ts`, and some `readdirSync` calls. Each one builds its own path
  (`join(sourceDir("rmxlinux"), "Json", "BuffData", …)`). `existsSync` results also change what the build produces.
  Tracking every file was out of reach, so the key uses three proxies: the data sources' commits, the size and time
  of each table file, and the time of each folder under rmxlinux's `Json/`. An in-place edit to one SkillData file
  that leaves the folder's time unchanged would go unnoticed. I also had to grep for module-level caches
  (`passiveCache`, `sitesCache`, `childAffixIndex`, …) to make sure skipping `build()` loses no side effect.
- **Cause:** the data package has no single place where it touches the data directory. Each loader goes to the disk
  itself.
- **Suggestion:** add one module in packages/data (`dataFiles.ts`) with `readDataJson(source, relPath)`,
  `dataFileExists(source, relPath)` and `listDataDir(source, relPath)`. It builds every path under `sourceDir` and
  records each path it touches in a set. Move the ~40 call sites onto it. Then `cache.ts` can store the recorded
  paths in the entry with their sizes and times, and check them on read. An ESLint `no-restricted-imports` rule for
  `node:fs` in packages/data/src (except that module, `cache.ts` and `kits.ts`'s kit reading) keeps it that way.
- **Why it helps:** the cache key becomes exact rather than "commits plus proxies". The same choke point also gives
  the fetch-list check (`tables.json`) and provenance one place each. Cost: a mechanical refactor of the loaders.

## 4. The engine's single `export *` index hides what the data package depends on

- **What happened:** the data build calls engine code (`attrModifier`, `buffReach`, `predicateRefs`, …), so engine
  edits can change the GameData and must be in the key. Hashing the whole engine would invalidate the cache on every
  edit to policy*.ts or search.ts, which change daily. `packages/engine/src/index.ts` re-exports all 28 modules with
  `export *`, so I wrote a regex tracer (`engineSources` in `packages/data/src/cache.ts`). It finds the imported names
  in the data sources, locates the module that declares each one, then follows that module's non-type relative
  imports. Result: 11 of 43 files. If it can't trace something it falls back to the whole engine. Writing and
  checking the tracer took about a quarter of the cache work.
- **Cause:** the engine has one public surface that mixes the core model (attributes, effects, damage, expr) with
  planning code (policy, search, macros). The boundary the data package needs isn't written down anywhere.
- **Suggestion:** the core/planning split from architecture-review item 12. Give the engine a `core` entry
  (`packages/engine/src/core/index.ts`, or a package `exports` subpath `@efsim/engine/core`) holding the modules the
  data package uses, and have the data package import only from it (enforced with ESLint `no-restricted-imports`).
  `cache.ts` then hashes the `core/` folder and drops the tracer.
- **Why it helps:** the cache key becomes a folder rather than a heuristic, and both agents and the Rust port see
  where the engine's core ends. Cost: moving files, which is the same work as review item 12.

## 5. The sandbox refuses compound shell commands in a worktree

- **What happened:** four commands were refused with "too complex to verify that it stays inside the worktree":
  - a script copied into the worktree and run with `node`;
  - a heredoc appending to `main.ts`;
  - a `python3` in-place edit;
  - `git -C . rev-parse` (refused separately as "points git at a directory computed at runtime").
  Each refusal cost a retry. I ended up using the Edit tool for every change, and scratch scripts in the scratchpad
  that import the worktree's packages by absolute path
  (`await import("/…/packages/data/src/index.ts")`).
- **Cause:** worktree-isolated agents get a stricter command check than the docs suggest, and CLAUDE.md doesn't say
  how to work inside it.
- **Suggestion:** add two lines to CLAUDE.md under "Worktrees and sub-agents":
  - make file changes with the Edit/Write tools, not heredocs or `python -c`/`sed` pipelines;
  - put scratch scripts in the scratchpad and import packages by absolute path (Node runs `.ts` directly).
- **Why it helps:** saves each new agent the same three or four refusals. No cost.

## 6. Timings are unreliable while other agents run

- **What happened:** the same command (`efsim find laevatain`, no cache) took 9.3 s at 15:25 and 12.5 s at 15:53, and
  `simulate` took 12.5 s and then 17.7 s. The load average went from 2.7 to 15 over the session. A
  before/after table made from separate runs would have been misleading. I re-measured everything as back-to-back
  pairs (`EFSIM_NO_CACHE=1`, then cached) and printed `uptime` with each set.
- **Cause:** agents share 4 CPUs, and the repository has no benchmarking helper, so every agent improvises its own
  timing method.
- **Suggestion:** add `scripts/bench.sh <label-A cmd> <label-B cmd> [n]`. It alternates A and B n times, prints the
  median real and user time of each, and records the load average at the start and the end. Mention it in the
  "Performance" section of docs/architecture-review.md, or in CLAUDE.md's workflow notes.
- **Why it helps:** reported speed-ups become comparable and honest under load, and user CPU time (which load
  affects less) gets reported routinely. Cost: a short script.

## What worked well

- docs/architecture-review.md had a CPU profile and a concrete design for the cache (what to hash, where to store
  it, the "cached equals fresh" test), so measuring and designing took minutes.
- `loadGameData` is the single entry point with an in-process memo, and `build()` is effectively pure (all module
  caches are lazy). The disk cache dropped in with a three-line change to `gameData.ts`.
- `tests/setup-shared-data.ts` deep-freezes the shared data. A test that wrote into it would throw, which made it
  safe to share deserialized data across a worker.
- Node 22 runs `.ts` files directly, so `scripts/setup-worktree.ts` shares `packages/data/src/checkout.ts` with the
  loader and vitest configs with no build step.
- `isDeepStrictEqual` plus a small first-difference helper gave a precise failure message
  (`$.operators.chr_0002_endminm.rarity: 7 vs 6`) when I tested a tampered entry. A pitfall for whoever touches this
  next: comparing `v8.serialize` bytes of a fresh build and of a read copy does not work, because string
  representations differ.

## Outcome (round 1)

1. Premerge under load: **done.** scripts/premerge.ts runs every step to the end, prints each step's time and load and a pass/fail table, re-runs once the files whose only failures are timeouts, and takes a lock shared by all worktrees around the vitest steps (snapshots.sh too). Moving the remaining tests over ~30 s to tests/slow: **backlog** (with the measured list).
2. Checkout check before linking: **done** as the last commit of the round (`main.ts` is a three-line entry, the CLI is cli.ts), kept separate so the lead can drop it if phase 2 edited main.ts and redo it after (`git mv main.ts cli.ts`, new entry).
3. One data-file access module: **not done** (a ~40-call-site refactor of the loaders that touches the cache key; no other report needed it this round). Backlog.
4. Engine core entry: **not done** (architecture review item 12, a large move best done in a quiet window). Backlog.
5. Sandbox command shapes: **done** (CLAUDE.md "Worktrees and sub-agents").
6. Timings under load: **done.** `npm run bench -- "<cmd A>" "<cmd B>"` (scripts/bench.ts): alternating runs, median wall and CPU seconds, load at start and end; CLAUDE.md says to use it for timing claims.
