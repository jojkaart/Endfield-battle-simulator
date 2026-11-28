# Improvement round 23 itself (2026-11-28)

Task: improvement round 23 over five open friction reports and round 22's backlog, every file free; branch
worktree-agent-aa34e7a8db6e99131 on main at e865411.

## 1. A report asked for a tool that already existed, and nothing said so

- **What happened:** the break-combo report point 3 asked for "the hits whose class changed per moved log, in
  moved-hits.txt"; `measure --hits` has written exactly that to hits.txt since round 13. The team-SP report point 4
  asked for an in-line block kind in scripts/edit.ts; edit.ts has always matched an exact substring, only its header
  said "whole lines". Each took 10–15 minutes of reading measure.ts and edit.ts to find out, and the fix in both was a
  sentence (a hint line in measure's summary, a header paragraph) rather than the tool asked for.
- **Cause:** the friction request asks the reporter to check `zmdlogs which "<question>"`, but `which` reads only
  docs/design/data.md's table and efsim zmdlogs' usage, not the scripts' headers (measure's options, edit.ts's format).
- **Suggestion:** `zmdlogs which` also reads the usage headers of scripts/*.ts (usage.ts headerUsage; every script
  answers --help since this round), one entry per option line; the friction request's "ask which first" then covers
  measure's and the scripts' options.
- **Files:** packages/cli/src/which.ts, scripts/usage.ts, tests/which.test.ts, docs/friction/README.md (the request).
- **Why it helps:** a report's "missing tool" is checked against the scripts too before a round builds it again.

## 2. One shell call per command makes a status check slow to read

- **What happened:** the round's long jobs (identity twice, four measures, snapshots, team-ab, premerge) each needed a
  later look at its log; with no Monitor loaded and a foreground sleep refused, checking meant a `tail` of each log in
  passing between edits, and once a test of `--plain-from` had to wait on a code change committed between two queued
  runs (the second measured again, rightly).
- **Cause:** none in the repository; the harness's rules. The runs' logs and `EFSIM-DONE` lines are already uniform.
- **Suggestion:** `node scripts/runstate.ts --tail` printing each run's last lines and its EFSIM-DONE status in one
  call (runstate knows the runs, not their log files: measure, identity and premerge could record their output path).
- **Files:** scripts/runstate.ts, scripts/measure.ts, scripts/identity.ts, scripts/premerge.ts.
- **Why it helps:** one call says which job finished and how, instead of a tail per log.

## What worked well

- The reports' episodes as ready tests: 3aa6 under `4f-episode` (the landings lost to the `if`), 79cc's opening, 458b
  84.37 s, 0eef's INSIDE lines, the Decisive Assault's curve, 5082's break.
- scripts/identity.ts as the first check of an engine statistic (spGained) and of each refactor: four minutes, both
  answers "the same".
- `node scripts/edit.ts` for every multi-line doc change and the outcomes (six reports in one file), and
  `friction.ts carry … --lists` for the backlog's lists.

## Outcome (round 24)

- 1 (A report asked for a tool that already existed, and nothing said so): done (aa5f383, 0a1efea): `zmdlogs which`
  also reads every scripts/*.ts header's usage, the script's head and one entry per option line (which.ts
  scriptEntries); "replace part of a line in a doc" finds edit.ts, "the hits a change moved" measure --hits.
- 2 (One shell call per command makes a status check slow to read): done (aa5f383): `node scripts/runstate.ts
  --where` (branch, HEAD, the commits beyond main, the uncommitted paths with hold-outs as a count, each job's last run
  with the tail of the file its stdout went to, recorded from /proc/self/fd/1 at its start, and its EFSIM-DONE line,
  the other worktrees with work); identity.ts records its run state too.
