# Improvement round 13 itself (2026-11-26)

Task: improvement round 13 over the five open friction reports, beside an accuracy agent holding the replay,
placement, check and holds files, the engine and the data compiler; the worktree branch of
`agent-a3e3e84a0c0a278aa`, on main at 07ceac2. Points already in docs/friction/2026-11-26-backlog-after-round-13.md
aren't repeated.

## 1. Which file a friction point needs isn't in the point

- **What happened:** the brief split files by package and name (buffreplay.ts, logcasts.ts, replay*.ts, …), the
  reports by symptom. For each of about twenty points I had to find where its code lives before knowing whether it was
  mine: settleCheck and inTurn are in logcasts.ts (out), the reason strings that key the snapshots are made in
  buffreplay.ts though onesided.ts groups them (out), loggedStagger in replaysteps.ts (out) while a new Stagger-span
  helper could go in query.ts (in), `movedCasts` in measure.ts (in) but its twin in logcasts.ts (out). About twenty
  minutes of grep before planning, and two points (the cast pairing, the Stagger spans) done in halves.
- **Cause:** a report's **Suggestion** names functions, not always their files, and nothing maps a function to its
  file and owner at a glance.
- **Suggestion:** done this round for new reports: the format (docs/friction/README.md) and the request asks each
  point for a **Files:** line (the files its suggestion touches; the new backlog's points have **Needs:** lines); the
  lead's brief then splits the points by those lines in seconds, and a point needing a held file goes straight to the
  backlog. Left: nothing checks the line (scripts/friction.ts could warn on a point without one).
- **Files:** docs/friction/README.md; scripts/friction.ts for the check.
- **Why it helps:** an improvement round beside an accuracy agent (the common case now) plans in minutes, and no point
  is done in a half that leaves two copies.

## 2. Whether a view replays isn't marked anywhere

- **What happened:** to put `--assume` on every view that replays I read each subcommand's code path to see whether it
  reaches logBuffReplay: `placement` and `casts` only place, `lanes --world` and `worldtime` take the stops from the
  placement's assembly, `reactions` replays no buffs, `timing` and `fit-build` replay inside bufftiming.ts and
  buildfit.ts. Sixteen of thirty-two subcommands replay.
- **Cause:** the CLI dispatches by name to functions whose replay is two calls down.
- **Suggestion:** done this round (REPLAYING / NOT_REPLAYING in packages/cli/src/commands/zmdlogs.ts, a test over the
  usage). Left: the same classification for the record-based views' cache (`--assume` bypasses scratch/hits-cache in
  collectRecords; a view that reads records some other way would need to know).
- **Files:** packages/cli/src/commands/zmdlogs.ts, packages/logs/src/reports.ts.
- **Why it helps:** a new view is classified in one line, and the test says so when it isn't.

## 3. `export *` over thirty modules makes a type name collide only at typecheck

- **What happened:** the new clocks view's `ClockRow` clashed with clockview.ts's (`zmdlogs clock`, one letter apart in
  file name); TS2308 at the first typecheck, a rename.
- **Cause:** packages/logs/src/index.ts re-exports every module with `export *`, so exported names share one namespace
  across the package, and two views of similar topics pick similar names.
- **Suggestion:** done this round: a line in index.ts's header ("exported names are one namespace across the
  package: a view's types carry the view's name").
- **Files:** packages/logs/src/index.ts.
- **Why it helps:** a minute, but it recurs with every new view.

## What worked well

- The reports' episodes made each tool testable on arrival: `holds --dropped --all` printed the enemy-clock round's
  pattern on its first line, `clocks --all` its five probes' numbers.
- `friction.ts carry` and `outcomes --backlog`: the carried outcomes filled on the first pass, as in round 12.
- scripts/edit.ts for every multi-block edit (fourteen batches), and its new end block without `=======` used at once.
- The new readings check in measure caught my own test's misspelt reading (`enemy-away=none`) in a second.
