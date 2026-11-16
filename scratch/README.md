# scratch/

Your scratch scripts for the session: everything here but this file is
git-ignored, and lint, typecheck and premerge's clean-tree check ignore it,
so debug tools can stay until you're done.

- Start from `scripts/scratch-template.ts` (copy it here, or write a file
  with the Write tool) and run it from the repository root:
  `node scratch/<file>.ts`. Under this folder `@efsim/data`,
  `@efsim/engine` and `@efsim/cli` resolve to this checkout's packages.
- Python: `python3 -I scratch/<file>.py`; get the development logs from
  `node packages/cli/src/main.ts zmdlogs list --json` (never a hold-out).
- Downloaded files (web lookups) go in a fresh folder of their own, not
  next to scripts.
- Never put player names, account IDs or hold-out logs' numbers here in a
  form that could end up committed elsewhere.
