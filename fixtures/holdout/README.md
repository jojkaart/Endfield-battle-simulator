# Hold-out logs

Log fixtures drawn as a hold-out when they were imported (a third of each
batch since 2026-11-08, by a fixed seed, before any check was read), and
the split itself (`holdout.json`: the development and hold-out ids).

**Never open, list, grep or debug anything in this folder by hand.**
Hold-out logs are only measured in aggregate (docs/accuracy-plan.md,
"Choosing logs"): the pending suite (`npm run test:logs`) checks them and
the scoreboard (docs/accuracy.md) shows their group's totals, never one
log's numbers. Code reads the split through `readLogSplit` /
`scripts/accuracy.ts readSplit`.

To find development logs, use `efsim zmdlogs list [--with <operator>]` or
`logFixtureFiles` (packages/cli/src/logs.ts): neither reads this folder.

A new hold-out: `git mv` the fixture here from fixtures/pending/ and add
its id to `holdout.json` `holdout` (tests/accuracy.test.ts checks that this
folder holds exactly the listed ids).
