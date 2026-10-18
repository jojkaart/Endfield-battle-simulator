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

## Updating

Move a submodule to a newer upstream commit and commit the new pin together
with any code or test changes the new data requires:

```sh
git -C data/555me-beyondGameData pull origin main
git add data/555me-beyondGameData
```

Upstream repositories grant no rights to the game data itself, which remains
© Hypergryph / Gryphline.
