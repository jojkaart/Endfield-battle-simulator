# Log-only landings (2026-11-27)

Task: the accuracy lead on the log-only side of the fight totals (landings the log shows that the replay never makes):
sort them across the development and earlier-pending logs, find recurring causes, fix them by mechanisms in the
engine's triggers and statuses, the kits and enginecheck.ts, beside another agent working the replay-only side.

## 1. One-sided landings have no share field, and no view ranks them per key outside chosen fights

- **What happened:** `zmdlogs totals --all --kinds` prints the kinds per group and its "By operator, side, key" list
  (the top 30, means over all 61 fights), but two fights (9c6e two targets, 6339 the slug) carry two thirds of the
  development log-only total, so the list's top was theirs. Ranking the rest needed `totals --all --json` plus a scratch
  script (scratch/rank.ts, scratch/each.ts) that re-read every fixture to sum its logged total, because the JSON line
  has `damage` in absolute numbers and no share of the fight. Two scripts and three runs before the first real lead.
- **Cause:** the JSON lines carry what the snapshot keys need, not what a ranking needs; the view has no way to leave
  fights out.
- **Suggestion:** add `share` (the landing's damage ÷ its fight's logged total, as the totals use it) to each `--json`
  line, and `--skip <fixture,…>` (or `--without-stage`, reading the `stage` key) to `totals --all --kinds`, so "the
  same ranking without the two outliers" is one command.
- **Files:** packages/logs/src/onesided.ts, packages/cli/src/commands/zmdlogs.ts (the totals subcommand).
- **Why it helps:** the first question of every one-sided lead ("what is left once the known outliers are out?") is a
  flag, not a script; a jq line can then rank by share directly.

## 2. Which fixture is really two targets is only in prose

- **What happened:** 9c6e's −37.8% log-only is "landing a teammate's hit's" and "a multi-target import" in four places
  of open-problems.md, but the fixture sits in fixtures/pending/ with no `target` per hit, counted in every development
  mean. I spent a while on its Typhoeus bursts before finding the note.
- **Cause:** the import catches several enemy ids, not two entities of one id; nothing marks such a fixture.
- **Suggestion:** a fixture field (as `stageFactors`) `targets: 2` with its evidence, which `totals` and measure's
  summary print beside the fight and can leave out of the means (a mean "without two-target fights", as the
  by-operator table's "Without stage fights"); or the lead moves 9c6e to fixtures/multi-target/.
- **Files:** schemas/log-fixture.schema.json, packages/logs/src/zmdlogs.ts, packages/logs/src/enginecheck.ts
  (stageFight's neighbour), scripts/accuracy.ts.
- **Why it helps:** the development log-only mean drops from 3.2% to about 2.1% of what a kit can explain, and no
  agent debugs a second enemy as a missing trigger.

## 3. A kit stack's value at a cast needs a grep of the trace

- **What happened:** finding Typhoeus's missing Sign meant `replay --trace-stack chr_0034_typhoea:signs` per log and a
  scratch script (scratch/signs.ts) grepping "signs N → 0" lines to get the value at each combo conversion across 12
  logs, under two readings.
- **Cause:** `--trace-stack` prints changes, not values at chosen events; there is no "at each cast of X" form.
- **Suggestion:** `--trace-stack owner:stack --at-cast <skill>` printing the stack's value at each cast of that skill
  (one line per cast), and accepting `--all` so one command covers every log with that operator.
- **Files:** packages/logs/src/views.ts (the `--trace-stack` lines), packages/logs/src/replayrecord.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** resource questions (Signs, Sunderblades, Melting Flame, arrows) are a recurring cause of
  log-only kit hits ("its cast was made as X, which has no landing"); this makes them one command.

## 4. The burst pairing's window and order are invisible from the views

- **What happened:** `zmdlogs bursts` showed bursts "LOG ONLY" and "REPLAY ONLY" 0.4–0.8 s apart, and one pair matched
  crosswise (c779: logged 9.68 s took the replay's 10.03 s, leaving 9.27 and 10.08 s unpaired). That the pairing is
  the nearest within 16 frames in time order took reading buffreplay.ts statusLanding.
- **Cause:** the view states "paired as the check pairs them" without the rule.
- **Suggestion:** the bursts view's header names the rule ("nearest within NEAR_FRAMES, in log order") and marks a
  REPLAY ONLY row that a LOG ONLY row of the same operator and element sits within 1.5 s of ("twin, outside the
  window").
- **Files:** packages/logs/src/burstsview.ts.
- **Why it helps:** the twin bursts (about 0.2% of a fight on each side) read as one timing question at a glance.

## What worked well

- `zmdlogs replay`'s NOLAND reasons ("its cast was made as floating_attack4, which has no burst landing 1"; "its kit
  hit's `if` didn't hold … strike_n") pointed straight at the resource that was short, for both fixes.
- `--kit <file>` for a what-if kit, then `--assume` once the reading was registered: the Sign-cooldown idea was
  checked on its log in seconds before any measure.
- `measure --variant … --hits` gave the reading's own effect and the moved hits in one run.
