# Stagger windows against the logs (2026-11-18)

Task: find out why the log check's replay has its Stagger windows in the wrong place compared with the logs (start,
length, how many), fix it generally, measure the change on the scoreboard and on the three simulated teams. Branch:
the worktree `agent-a827325316763019d`, commit 0b748db.

## 1. No tool shows the replay's Stagger windows next to the log's

- **What happened:** the first hour went into five scratch scripts (`scratch/stagger-windows.ts`, `stagger-lengths.ts`,
  `stagger-ends.ts`, `stagger-start.ts`, `stagger-damage.ts`) just to see, per log, where the log is Staggered and where
  the replay is. `BuffReplay` exported only the frames where the replay's windows *started* (`staggers`), so a window's
  end had to be guessed from which logged hits' landings had `inputs.options.staggered`. The tracker behind `staggers`
  (`sample()` in `replayKitBuffs`) also split one window into several whenever a time stop moved its end, so the first
  numbers listed Stagger "starts" at 52.7, 55.3, 67.7 s for one window, and a "short by" of 5.3 s that was really 1.4 s
  (f879). Measuring wrong windows cost a misleading half hour before the split was found.
- **Cause:** the log check reports buffs and casts per hit (`efsim zmdlogs check`, the buff timing report), but enemy
  state over time (Stagger windows, the bar, freezes, statuses) has no report. Each diagnosis rebuilds it from landings.
- **Suggestion:** a `efsim zmdlogs stagger <log>` view (or a section in the buff timing report). Per window, show the
  log's start (the breaking hit) and its last Staggered hit and the next hit, the replay's window
  (`BuffReplay.staggerSpans`, added in 0b748db), the engine's own end (`BuffReplay.staggerHolds`, also new), and the
  Stagger dealt in it. Add a summary line over all development logs (shortfall quartiles). `scratch/stagger-own.ts`
  and `scratch/stagger-ends.ts` in this worktree are the prototype.
- **Why it helps:** the next Stagger question (in-game test 110's answer, bigents, 4e5e's unattributed Stagger) starts
  from a measurement instead of an hour of scripts. Cost: a small command module.

## 2. "Does the damage confirm the listing?" has no tool, and it settles most log-vs-replay disagreements

- **What happened:** I spent time on mechanisms (hit-stop sums, slows, Finishers, Lifts) before running the one test
  that decided the question. For every logged hit where the log and the replay disagree on a state, I took the logged
  value over the engine's primary reading. Log-only Staggered hits came out ×1.30, replay-only ones ×0.77, so the
  log's listing is right. That took a hand-written script (`scratch/stagger-damage.ts`: `engineHits`, `landingOf`,
  `inputs.options.staggered`).
- **Cause:** the check has the readings and the landings' inputs, but it doesn't group disagreements by *what* differs
  (Stagger, a buff, Link) and show the ratio distribution per group. `LogDifference` in `enginecheck.ts` names what
  differs per hit, but nothing aggregates them with the damage ratio.
- **Suggestion:** a report (`efsim zmdlogs differences [--what Stagger]`) that aggregates `logDifferences` over the
  development logs. For each `what` and `kind` ("engine" / "log"), give the count and the quartiles of logged value ÷
  primary reading. Docs: add this as the first step of a diagnosis brief in docs/open-problems.md's header ("before
  hunting a mechanism, check whether the damage sides with the log or with the replay").
- **Why it helps:** it would have saved about an hour here. The same question comes up for every buff window
  ("Buffs through stops" was settled the same way by hand).

## 3. The worktree command guard and multi-step data inspection

- **What happened:** inspecting game data (`TimeDilationAction`, `HitStopAction`, `SlowAction`, `SealAction` across
  `SkillData` / `BuffData`) needed many one-off Python snippets. Several were refused as "too complex to verify"
  (a `for` loop over files, `cd … && …`, a `python3 -c` piping into another `python3 -c`). One-line `sed -i` edits with
  `&&` chains were refused as well, while the same shape had passed earlier. I ended up writing `scratch/jfind.py`,
  `hitstops.py`, `dilations.py` and `timeacts.py`, each a small "find actions of type X in data files" script.
- **Cause:** there is no shared tool for querying the game data's action trees by `$type`. The guard's rules push every
  query into a file, and each agent rewrites the same walker.
- **Suggestion:** add `scripts/data-find.py` (or `efsim gamedata find --type HitStopAction [--file glob]
  [--fields duration,curveKey,affectType] [--enabled]`). It would walk BuffData/SkillData JSON, print the matching
  actions without their selector blobs, and count by field values. Mention it in CLAUDE.md next to `scratch/`.
- **Why it helps:** game-data questions ("who applies a slow to the enemy", "which hit-stops are on the target") become
  one command. No guard friction, no copy of a walker per agent.

## 4. Long background jobs: waiting on the shared lock is invisible and costs many tool calls

- **What happened:** `npm run snapshots:update` and `scripts/premerge.sh` each spent minutes queued on
  `efsim-tests.lock`. The snapshot script prints nothing while it waits; premerge prints one line. I armed about 15
  Monitors (most filters were either silent or too narrow, and a foreground `sleep` is refused) just to learn when a
  step ended. A container restart then killed all background jobs and their monitors, without notice until the lead
  told me.
- **Cause:** the progress lines (`[n/N] pass …`) appear only once vitest runs. The lock wait has no periodic status,
  and there is no single "done" marker line with the result that one until-loop can wait for.
- **Suggestion:** have `scripts/snapshots.sh` and `premerge.sh` print a heartbeat while waiting for the lock ("waiting
  for lock held by <worktree>, 3 min"). Have them end with one fixed marker line, e.g. `EFSIM-DONE premerge pass` /
  `EFSIM-DONE snapshots fail`. Document in CLAUDE.md the one Monitor command to use:
  `until grep -q '^EFSIM-DONE' scratch/x.log; do sleep 15; done; tail -30 scratch/x.log`.
- **Why it helps:** one monitor per job instead of a dozen, and no guessing whether a job is queued, running or dead.

## 5. Where the replay copies the log is spread over several mechanisms with no list

- **What happened:** before changing the Stagger I had to find every place the replay already takes Stagger state from
  the log: `loggedPoiseBars` (bar before each hit, with a `calm` flag that ends a Stagger), `loggedRecoveries`
  (refills), `setPoise` / `refillPoise` in the engine, and the step ordering in `replayKitBuffs`'s step list (a sort
  comparator with hand-ordered booleans). One subtle behaviour cost time: `setPoise` ignores the log's bar after the
  engine's own Stagger has expired, because an expired `until` is still non-null. Only reading `dealPoise` explained
  that. The step sort had no notion of "at one frame, do X before Y", so I replaced it with an explicit rank.
- **Cause:** "follow the log" rules grew one at a time inside a 1,500-line `buffreplay.ts`, each documented where it
  was added, and none of them in one place.
- **Suggestion:** in docs/design/data.md ("The log check's rule"), add a table: "What the replay takes from the log",
  one row per mechanism (casts, crits, reaction levels, Stagger bar, Stagger state, recoveries, missed casts), the
  function, and what it costs the check (what it no longer tests). Longer term, move the step list and its ordering
  into a small module (`replaysteps.ts`) with the rank defined once.
- **Why it helps:** the next "follow the log" change, or the reverse (testing the engine's own state again), starts
  from a map. It also says plainly which totals rows test the engine and which only test the following.

## 6. Stale claims in open-problems pointed the diagnosis at the wrong cause

- **What happened:** open-problems said Perlica's misfits "come in runs … : the replay's Stagger windows against the
  log's … not her kit". After the fix her mismatches were unchanged in 4360 (16) and 9847 (26), with log and replay
  agreeing on Stagger. The claim had been a guess written as a finding.
- **Cause:** the open-problems format separates "Shows / Ruled out / Still possible", but this bullet stated a cause
  with no check behind it.
- **Suggestion:** in the docs/open-problems.md header, require that a stated cause cite the check that showed it (a
  script, a count). Otherwise it goes under "Still possible".
- **Why it helps:** fewer wrong turns for the next agent.

## What worked well

- `npm run snapshots:update` printing the scoreboard change and each log's direction (better/worse, hold-outs as
  aggregates only): the measurement and the report numbers came from one command.
- The fixtures' per-hit `poise` and `effects`: everything needed to settle the question was already in the data.
- `logBuffReplay` / `engineCheck` / `landingOf` / `engineHits` being exported. A scratch script could reach the
  replay's landings and readings in a few lines.
- The game-data cache: scratch scripts started in about a second.
- `node scripts/with-lock.ts` for the team runs, and the team pages quoting the exact `efsim rules` command and seeds,
  so the baselines could be reproduced exactly.
