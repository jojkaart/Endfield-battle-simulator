## 2026-10-25: CLI checks first; a pre-merge script (review round two, 7)

`efsim` loads the game data on first use, after its arguments and input
files are checked: a typo now fails in ~0.3 s instead of after the load.
`scripts/premerge.sh [base]`: refuses a dirty tree, a worktree without
its own packages linked, and a branch that changes code, kits or examples
without a journal entry; then `npm run check` (CLAUDE.md points to it).
Docs: entries before the review (2026-10-21 and earlier) moved to
docs/journal-archive.md; the roadmap keeps only what's next (64 lines from
144).
