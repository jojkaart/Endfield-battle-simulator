## 2026-11-16: Improvement round 2: package boundaries, CLI commands, design.md split

Goal (the lead): the larger restructures of the architecture review
(12–14) and the open friction points, behaviour-preserving throughout.
Summary: docs/friction-done/2026-11-16-round-2.md.

Done, one commit (or two) per item, in order:
- **Quick wins:** `npm run lint:changed`; premerge skips the suites when
  typecheck or lint fails; the game-data cache keys only on what the
  build runs and says why it rebuilds; `framesOf` / `withSeconds`;
  `node scripts/with-lock.ts`, `scripts/at-commit.ts`, a per-file
  progress reporter for background vitest runs; one snapshot writer and
  `scripts/snapshot-keys.ts`; status tests on `toMatchObject`;
  `PolicyObserver.check` / `.press`; pending shards balanced by measured
  time (longest shard 79 → 54 s of check time).
- **CLI:** one module per command (`packages/cli/src/commands/`); the
  usage text is byte for byte the old one.
- **Engine:** `core.ts` (`@efsim/engine/core`) and `planning/`, with
  lint-enforced boundaries; the data package imports only the core.
- **Logs:** `packages/logs` (`@efsim/logs`), the logcheck ⇄ enginecheck
  cycle broken; `efsim zmdlogs` is a thin wrapper.
- **Docs:** design.md is the principles and an index; the sections are in
  docs/design/; `npm run links` (and a test) checks relative links.

Checks: after every item `npm test` passed and 42–48 CLI invocations gave
the same output as 1de265e (scratch/at/, `scripts/at-commit.ts`), apart
from timings and the provenance line. `npm run snapshots:update` after
item 4 left every snapshot and docs/accuracy.md byte for byte as they
were: the scoreboard didn't move.

Decisions: the planning code moved into a folder (a visible boundary,
simple lint globs) while the core stayed where it was, so tests' deep
imports into timeline/* still work; `@efsim/cli` re-exports `@efsim/logs`
so older imports work; setup-worktree now also links a new workspace
package in the main checkout (packages/logs), so main runs after the
merge without `npm install`. Not done (carried to
docs/friction/2026-11-16-backlog-after-round-2.md): one module for data
file reads, facts on status landings, a structured status on modifiers,
the test-helper moves, the SP anchor, search-time tables.
