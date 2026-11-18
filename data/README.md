# Game data

Game data comes from community extractions of the game's own data tables,
linked here as git submodules. Their data is not republished in this
repository; the submodules pin the exact upstream commit we build and test
against. Evaluation of these and other sources: [`docs/data-sources.md`](../docs/data-sources.md).

| Path | Upstream | Role |
|---|---|---|
| `rmxlinux-EndfieldData/` | [rmxlinux/EndfieldData](https://github.com/rmxlinux/EndfieldData) | Primary. All tables, plus skill timelines (`Json/SkillData`) and buff logic (`Json/BuffData`). |
| `555me-beyondGameData/` | [555me/beyondGameData](https://github.com/555me/beyondGameData) | Cross-check and per-patch history. Each commit message is the game resource version ID. |

## Fetching

For development and tests, fetch only the tables the code reads (listed in
[`packages/data/tables.json`](../packages/data/tables.json)), at the pinned
commits:

```sh
./scripts/fetch-data.sh
```

This takes seconds and about 60 MB. The loader refuses tables not on that
list, so add a table there before using it. For full checkouts:

```sh
git submodule update --init data/555me-beyondGameData data/rmxlinux-EndfieldData
```

`rmxlinux-EndfieldData` is large (about 2.3 GB checked out) and is marked
`shallow` in `.gitmodules`, so only the pinned commit is fetched. Run
`git -C data/rmxlinux-EndfieldData fetch --unshallow` if you need its history.
`555me-beyondGameData` is cloned with full history (about 640 MB), since its
commits are the per-patch snapshots.

## Adding a table

The tables are fetched once into the main checkout's `data/` (a sparse
checkout every worktree reads: `packages/data/src/sources.ts` falls back to
it), so a new table is a change to shared state. The procedure (round 4,
after an agent read `WeaponBreakThroughTemplateTable` with `git show` from a
scratch shell script because it wasn't fetched):

1. **A sub-agent asks the lead** in its report (the table's name, what reads
   it, the question it answers); it doesn't extend the main checkout's
   sparse paths itself. To look at a table before that, read it from the
   pinned commit without checking it out: `git -C
   data/rmxlinux-EndfieldData show HEAD:TableCfg/<Table>.json > scratch/t.json`
   in the main checkout (a scratch script: `bash scratch/x.sh`).
2. **The lead (or an agent asked to)** adds the name to
   [`packages/data/tables.json`](../packages/data/tables.json) `tables` (or
   a glob under `json` for SkillData / BuffData files), then runs
   `./scripts/fetch-data.sh` in the main checkout: it extends the sparse
   paths at the pinned commit (seconds; no other file changes). Every
   worktree sees the file from then on.
3. The loader that reads it goes in `packages/data/src/tables/`; the game-data
   cache rebuilds once (its key covers tables.json and the table files:
   `efsim cache` shows why), and `npm run measure` must say nothing moved
   unless the table is meant to change something.

A branch that adds a table to tables.json needs step 2 in the main checkout
before it's merged (a listed table that isn't fetched fails the load): the
merge note says so.

## Updating

Move a submodule to a newer upstream commit and commit the new pin together
with any code or test changes the new data requires:

```sh
git -C data/555me-beyondGameData pull origin main
git add data/555me-beyondGameData
```

Upstream repositories grant no rights to the game data itself, which remains
© Hypergryph / Gryphline.
