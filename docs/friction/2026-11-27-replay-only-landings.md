# Replay-only landings (2026-11-27)

Task: the replay-only side of the fight totals (landings the replay makes that the log never shows), sorted by kind
across the logs and fixed by mechanisms; branch worktree-agent-a1794bee0401ceb8c, base 896bb86, main 5637d06 merged.

## 1. Which of a branch's rules moved a hold-out needs one measure per rule

- **What happened:** the first batch (kill gaps, the tail-effect check, value ranges, an unknown-crit slot rule, a
  delayed join) moved hold-outs both ways: the summary said "1 worse: kind combo, time to kill". Three of the rules sit
  in one file (logcasts.ts), so `--split files` couldn't separate them. I wrote reverse patches by hand (edit, `git
  diff > scratch/p-x.diff`, checkout) and ran three more measures (`--patch`), about 20 minutes, to learn that the
  unknown-crit rule was the one; a fourth set of variants found that the kill gap's 0.15 s edges cost a hold-out 13
  plain without them.
- **Cause:** `measure --split` splits by file or commit, not by hunk; a hold-out is named only by its moved keys, so
  the same log can't be followed across measures either.
- **Suggestion:** `measure --split hunks` (each diff hunk of the change alone on --base, grouped by a `// split:<name>`
  marker comment when hunks belong together), and a stable anonymous label per hold-out in every summary ("hold-out
  #7"), the same across runs, so "the log variant 2 made worse is the one the patch made better" can be read off.
- **Files:** scripts/measure.ts, scripts/accuracy.ts.
- **Why it helps:** one run instead of a patch per rule; the label leaks nothing (an index into the ignored list).

## 2. `totals --all --json` has no fight total, so shares need the text table

- **What happened:** to rank replay-only landings by fight, operator and key as % of each fight's logged total (the
  scoreboard's unit) I parsed the `totals --all` text table for each fight's replay-only % and back-computed the logged
  total from the JSON landings' sum (scratch/ro2.ts); a second run after a code change needed both files regenerated
  and passed by environment variables.
- **Cause:** the JSON lines carry each landing's damage but not its fight's logged total.
- **Suggestion:** a `share` field (damage ÷ the fight's logged total) on every `--json` line, or one header line per
  fight (`{"fight":…,"logged":…,"error":…,"matched":…,"replayOnly":…,"logOnly":…}`).
- **Files:** packages/logs/src/onesided.ts, packages/cli/src/commands/zmdlogs.ts (the totals subcommand).
- **Why it helps:** every ranking question becomes one jq line, as the option's help promises.

## 3. A rule that declines to act leaves no record

- **What happened:** d774's battle skill at 103.28 s had every condition of a tail cut but wasn't cut; the decisions
  view shows TAILCUT only when one happens. I added a temporary stderr print in tailCuts to learn that the "new buff
  run" guard had fired, and a second one to name the run (a gear set's ATK from Arcane's ultimate). Same for
  joinDelayed and realignByValue (fc63's burst, 6339's final): stderr prints, then revert.
- **Cause:** the guards of tailCuts, joinDelayed and realignByValue compute their reason and drop it.
- **Suggestion:** a TAILKEPT decision (the cast, which guard kept it, the buff run or the hit that did) and a
  `casts --choices` line for a delayed landing's join (joined, or new cast and why) and for a realignment skipped
  ("a slot without a multiplier", "every value of unknown crit").
- **Files:** packages/logs/src/replayrun.ts, packages/logs/src/logcasts.ts, packages/logs/src/decisionsview.ts,
  packages/logs/src/views.ts.
- **Why it helps:** the guard that keeps a wrong landing is found by reading a view, not by editing the code.

## 4. Capped hits are easy to miss as kills

- **What happened:** the largest general cause (9c6e's and 6339's landings after a capped hit) showed only after I
  dumped a fixture's hits with jq and saw `uncapped` on mid-fight hits; nothing in the totals view marks a kill
  that isn't the fight's last hit.
- **Cause:** the kinds (onesided.ts) know away stretches and the fight's end, not kills before the end.
- **Suggestion:** a `kill` flag in onesided.ts (a landing after a capped hit before its next logged hit), now that
  killGaps exists in enginecheck.ts; `zmdlogs away` could list kill gaps beside the away stretches.
- **Files:** packages/logs/src/onesided.ts, packages/logs/src/awayview.ts.
- **Why it helps:** the next round sees what kill gaps still leave, and a stage log's phases at a glance.

## What worked well

- `zmdlogs totals --all --kinds` and `--json` gave the first ranking in minutes; `measure --variant` separated the
  kill-gap edges and `cut-all` in one run each.
- `zmdlogs replay --from --to --operator` and `casts` made each case readable in one screen (fc63's burst, d774's
  strikes, 6339's capped final).
