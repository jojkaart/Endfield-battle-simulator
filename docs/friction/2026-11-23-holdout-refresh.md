# The hold-outs refreshed blind (2026-11-23)

Task: re-import the 13 hold-out fixtures and the verified 40d9 / 4e5e with `since` / `source` (`zmdlogs refresh`)
without anyone seeing a hold-out, then measure the replay's lane-based rules on them in aggregate. Branch: this
worktree's (scripts/holdout-refresh.ts).

## 1. `zmdlogs refresh` refused both verified fixtures over a field nobody reads for a verdict

- **What happened:** the first `efsim zmdlogs refresh fixtures/zmdlogs-40d9a3c1da37.json` failed with "the detail's
  hits differ from the fixture's: unquantified on 1 hit(s)", 4e5e the same. Finding why took a scratch script
  (fixture vs `zmdlogsHits` per hit), a fresh download to tell "the cache is stale" from "ZMDLogs changed", and a
  `git log -L` on the importer's line: the 0 ms trigger buffs (Camille's combo trigger, Gilberta's Nature trigger)
  had a non-empty `dynamicEffects` at import and an empty one today, under the same parser version for 40d9. About a
  quarter of the session, and it would have stopped the blind hold-out run cold (the script can only say "changed
  shape").
- **Cause:** `refreshFixture` compared every field it doesn't add with strict equality, including `unquantified`, a
  listing ZMDLogs can drop without bumping `parserVersion`. Its error names the field but not what changed, and the
  refresh had never been run on a fixture older than 2026-11-16 since ZMDLogs' change.
- **Done here:** a hit's `unquantified` may now only have lost entries (the fixture's listing is kept,
  `RefreshResult.keptUnquantified`, one provenance note); a new entry is still a mismatch (tests/zmdrefresh.test.ts).
- **Suggestion:** when a refresh is refused, print for the differing field the fixture's value and the detail's
  value for the first hit (development fixtures only; the blind script keeps categories), so the next field ZMDLogs
  changes is diagnosed from the error line, not from a script.
- **Why it helps:** the refresh is the only way older fixtures gain new import fields; each such refusal costs a
  diagnosis today.

## 2. Nothing tells an agent how long the downloads take

- **What happened:** the blind run took about 45 s per hold-out (13 details, ~10 min), far more than the 3.5 s gap;
  the Bash call timed out at 5 min and moved to the background, and an agent who doesn't expect it might kill and
  restart it (a second set of downloads).
- **Cause:** the details are large and zmdlogs.com is slow to serve them; no doc gives a figure.
- **Suggestion:** a line in docs/design/data.md's ZMDLogs section ("a detail takes up to a minute to download; run
  more than two in the background"), and the script's own usage line says so (done).
- **Why it helps:** saves a timed-out foreground call and the temptation to re-run.

## 3. Hold-out safety rests on remembering which git commands print file names

- **What happened:** committing the refreshed hold-outs needed `git commit -q -- fixtures/holdout` and checking the
  tree with `git status --porcelain -- fixtures/holdout | wc -l`; a plain `git status`, `git diff --stat`, `git show
  --stat`, or `npm run merge`'s stat lines would print the 13 ids. `git merge main` printed the hold-out snapshot's
  file name (harmless) but would print fixture names had main touched them.
- **Cause:** the rule is enforced by tools for reading content (`refuseHoldout`, `.ignore`), not for git's own
  listings.
- **Suggestion:** a git `diff.orderFile`/pathspec alias is not enough; instead `scripts/merge.ts` and
  `scripts/premerge.sh` could pass `-- . ':!fixtures/holdout'` to their stat commands, and the hold-out rule in
  CLAUDE.md could name the git commands to avoid after a commit that touched fixtures/holdout/.
- **Why it helps:** the next refresh or import of hold-outs can be merged without a leak by accident.

## What worked well

- `refreshFixture` is a plain function over (file, detail): the blind script wraps it in a temporary copy with an
  identity check and no cache, and the tests run it on a synthetic root; nothing had to be refactored.
- scripts/holdout-split.ts was a good model for "edit hold-outs by code, print only counts".
- `npm run snapshots:update`'s summary gives exactly the hold-out aggregates and better/worse counts the task needed.
