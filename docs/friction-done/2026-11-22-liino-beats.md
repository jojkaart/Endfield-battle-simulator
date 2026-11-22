# Liino's Cosmovoice beats and stances before the log (2026-11-22)

Task: diagnose and fix Liino's Cosmovoice beats (logged 1.35–1.55 s apart
against the kit's 1.5 s), her stances cast before a log began (1d91, 7910,
4d60) and the volleys with a battle-skill event at their first hit's ms;
branch of the worktree agent-a1e557f67dbc37926.

## 1. The shared test lock made every measurement a 10–15 minute wait

- **What happened:** `npm run measure` (about 1.5 min of work) waited 10–15
  min for the lock each time, behind another agent's chain of `efsim rules`
  jobs (11–13 tickets ahead); `npm run smoke`, `snapshots:update` and
  `scripts/team-ab.ts` waited the same. While a measure waited, editing the
  tree would have changed what it measured, so the session idled or had to
  work around it. One measure was killed by the Bash tool's 10-min
  background limit while still waiting.
- **Cause:** `measure` and `smoke` are "short" jobs but still queue behind
  long jobs that arrived before them (with-lock's 20-min preference only
  covers jobs that arrived up to 20 min earlier); the working tree is read
  when the job starts, not when it is queued.
- **Suggestion:** (a) let `measure` snapshot the code at queue time (it
  already can: `--at <ref>` measures a commit in its own worktree; make
  `npm run measure` on a dirty tree say so and offer `--at` after a WIP
  commit, or do it itself with `git stash create`); (b) cap a single agent's
  share of the long-job queue (one long job per agent at a time), so a batch
  of rule searches doesn't hold every other agent's short jobs.
- **Why it helps:** most of this session's wall time was lock waits; with
  (a) an agent keeps editing while its measure waits, with (b) the waits
  shrink to the job ahead.

## 2. No way to see a pinned tick's or a buff's tick schedule in the replay

- **What happened:** finding why 4d60's second Cosmovoice had no beats for
  4 s took temporary `process.stderr.write` lines in `heldTicks` and
  `addBuff` (removed afterwards): Zhuang Fangyi's ultimate placed at the end
  of Liino's stop had extended Cosmovoice by its own 78 frames.
  `zmdlogs replay --trace-buff` shows expiry changes only, not `nextTick`,
  and not the slow-downs a new buff was held by.
- **Cause:** the trace records `expiresAt` per step; ticks and holds
  (actions.ts `heldFromNow`) aren't part of it.
- **Suggestion:** have `--trace-buff` also print `nextTick` changes and,
  at a buff's creation, the held frames and the slow-downs behind them
  (start, length, exempt operator).
- **Why it helps:** tick timing (Liino's volleys and beats, Rossi's bleed)
  and stops placed differently from the game's are the open problems'
  recurring cause; each needed ad hoc prints.

## 3. Trigger hits on casts vs on buff ticks share a key without a rule

- **What happened:** moving Liino's beats from the ultimate's frames to a
  buff's ticks left every beat placed as a new cast of the old cast trigger
  (`ult_song`), so the pinning never applied, and the measure showed no
  change; it took reading `placeWith` / `choose` to see that a trigger on a
  cast was chosen by default for any landing of its key.
- **Cause:** logcasts.ts `choose` had no notion that a trigger on casts
  fires once per cast; `ANCHOR_MS` (1.5 s) let the second beat (1.38 s off)
  count as anchored.
- **Suggestion:** done here (`anchorFree` in placeWith); a line in
  docs/design/tests.md or data.md on how the placement picks among groups
  sharing a key (skills, cast triggers, tick triggers) would have saved the
  reading.
- **Why it helps:** the next kit that splits a key between a cast's frames
  and a ticking buff (Rossi's bleed, any DoT with a first tick at the cast)
  meets the same choice.

## 4. A launch frame changes what the planner waits for

- **What happened:** giving the finale `launch: 508` (so End Stance drops it,
  as the data's jump does) broke kit-camille, kit-antal and policy-stepping:
  her combo beside the ultimate couldn't start until frame 678. The cause
  (timing.ts `ownHitsLanded` waits for a cast's own launches before another
  cast may cut it, `beside` casts included) was found only by bisecting the
  kit change.
- **Cause:** `KitHit.launch` documents cut semantics but not that it also
  delays every later cast of the operator.
- **Suggestion:** mention the wait in model.ts's `launch` doc, or exempt
  `beside` casts (KitSkill.beside) from `ownHitsLanded`, which can't cut the
  running cast anyway.
- **Why it helps:** one smoke failure instead of an afternoon's guess.

## What worked well

`zmdlogs cadence` (world-time gaps with the stops named) found the beats'
clock in minutes; `measure --at <ref>` let me keep editing while a measure
waited; `scripts/at-commit.ts` gave a base CLI for old/new replay diffs.

## Outcome (round 5)

2026-11-22, improvement round 5 (docs/friction-done/2026-11-22-round-5.md); what's left is in docs/friction/2026-11-22-backlog-after-round-5.md.

- 1 (the lock made every measurement a 10–15 min wait): done (d98b497): (a) measure fixes its code at queue time (a snapshot commit of the working tree, no WIP commit needed), so the wait is free; (b) fair shares between worktrees in the queue order instead of a hard one-job-per-agent cap (a cap would idle the machine when only one agent has work).
- 2 (a pinned tick's schedule and a buff's holds in the replay): not done, carried over to the round-5 backlog (`--trace-buff` with `nextTick` and the holds behind a new buff; merged with Rossi's `zmdlogs ticks`).
- 3 (how the placement picks among groups sharing a key): done (c9247da): "One key, several groups" in docs/design/data.md (anchorFree, then choose's anchor, chain step, kit order).
- 4 (a launch frame changes what the planner waits for): done as documentation (c9247da): KitHit.launch's doc comment says it delays the operator's next cast (ownHitsLanded) and names the tests that caught it; exempting `beside` casts would change engine behaviour: not done, needs an accuracy task (lead: timing.ts `ownHitsLanded` and `beside` casts, with smoke and team-ab).
