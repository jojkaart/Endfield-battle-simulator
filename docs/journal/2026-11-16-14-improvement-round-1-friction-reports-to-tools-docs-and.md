## 2026-11-16: Improvement round 1: friction reports to tools, docs and engine records

**Goal:** the owner's standing workflow (docs/friction/README.md): read the
eight friction reports of the day, find the common causes, implement the
improvements. Rule tooling (driver, noise, pools) was phase 2's, in parallel.

**Done** (summary and measurements: docs/friction-done/2026-11-16-round-1.md;
each report's per-point outcome at its end in docs/friction-done/):

- premerge: every step to the end, a pass/fail table with times and the
  slowest tests, a re-run of files that only timed out, a lock shared by all
  worktrees (scripts/premerge.ts).
- Sandbox: the command shapes that work, a git-ignored `scratch/` that
  resolves `@efsim/*`, a template (CLAUDE.md, scripts/scratch-template.ts).
- Hold-outs in fixtures/holdout/ (moved by id, unread);
  `efsim zmdlogs list` never lists them; check/hits/raw/import refuse them.
- `efsim zmdlogs hits` (per-hit records, JSON Lines, workers),
  `efsim zmdlogs raw` (cached raw details), importer keeps effect sources and
  Stagger origins (new imports only), `efsim gamedata tree / who`, an enum
  table and "What the data can't tell" (game-data-format.md).
- Engine: `OWN_HIT_SEES` table (combat-mechanics §3.8, a test per row);
  infliction appliers, a landing's cast, a buff's maker, `keepInputs` and
  `recomputeHit`; state queries exported from timeline.ts; `statLabel`.
- CLI `--kit <file>`, `--duration` on simulate and search; `npm run bench`,
  `npm run merge` (rebuilds the built journal), `npm run prune-unused`;
  tests/helpers/; snapshots readable mid-merge; stdout for must-see lines.
- main.ts is a thin entry running the checkout check before cli.ts loads
  (its own commit, droppable if phase 2 edited main.ts).

**Decisions:** no eslint plugin for unused imports (main's node_modules
would lack it until reinstalled, breaking every worktree's lint): a script on
TypeScript's own fixes instead. Older fixtures keep their fields (no mass
download). No number changed: examples, kits and verified-log snapshots
identical, all 67 pending verdicts identical (13 hold-outs by group only);
docs/accuracy.md changed only in labels.

**Left:** docs/friction/2026-11-16-backlog-after-round-1.md (data-file
module, engine core entry, older fixtures, a status tag on modifiers, helper
migration, shard costs, slow tests, paired suite timing, search times).
