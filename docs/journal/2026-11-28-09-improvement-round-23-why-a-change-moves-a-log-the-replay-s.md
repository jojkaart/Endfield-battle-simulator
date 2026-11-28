## 2026-11-28: Improvement round 23: why a change moves a log, the replay's SP as a record, measuring without re-measuring

**Goal:** the five open friction reports and round 22's backlog (docs/friction-done/2026-11-28-round-23.md), tools
only: no verdict moves.

**Done** (round summary for the details):
- Why a change moves a log: packages/logs landingmoves.ts in `measure --hits` (a `landings:` line per moved log:
  lost its landing with the NOLAND reason, a shift onto another logged hit's) and `zmdlogs hits --against`
  (HitRecord.dropped): 3aa6 under `combo-operator-hold=4f-episode` loses 4 of Zhuang Fangyi's landings to their `if`.
  The INSIDE line names the gate that bound (timing.ts startGateWords): 0eef's Typhoeus combo at 6.77 s is her combo
  window, not her attack's frames. `efsim kit` prints skillSpecification, priority, channels; every kit skill's
  specification is held to its kind (tests/skill-specification.test.ts).
- SP as a record: TimelineState.spGained (a statistic), `zmdlogs replay --sp` and TOPUP lines (spview.ts), the
  describing snapshot keys `sp short` / `sp short casts` and measure's "Team SP the replay lacked" line.
- Measuring: `measure --plain-from` / `--trust-plain` (a variant run's plain.json), snapshots:update stops at the
  first code change, `zmdlogs clocks --json / --fit / --around break`, `efsim gamedata curve`.
- One rule per question: the EVENT line's nearest cast, castassembly.ts ultimateEventRead, Slot.path.
- Traps and rules: heldMs and an ESLint rule on exact worldMs, multiplierBounds, `zmdlogs totals --all --side`,
  scripts/lead-status.ts, --help in every script, the assumptions notes' form written down, edit.ts's part-of-a-line
  form documented, tests/clock-table.test.ts.
- Paperwork: docs/friction/2026-11-28-backlog-after-round-23.md (points 1–2, three new accuracy entries), the reports
  and round 22's backlog in docs/friction-done/ with their outcomes.

**Checked:** `node scripts/identity.ts --base e865411`: the compiled data and every log's replay record the same (0 of
65 development, 0 of 13 hold-outs) at 4fe2e66 and at the last code commit; snapshots:update and team-ab as the round
summary says; premerge at the final commit.

**Decisions:** SP shortfall as a describing key (not a worker field), so measure's reference side comes from the
snapshots for free; the INSIDE gate in words from a mirror of actionGate's options (views only), not by instrumenting
the hot gate path; `--plain-from` reuses only on equal git trees of packages/, scripts/ and fixtures/ unless
`--trust-plain`, since an identity check costs as much as the plain run it would save; --help answered on the first
argument only, so wrappers (with-lock, cli-ab) pass a command's own `-h` through. The zmdlogs CLI split (round 22's
own point 2) needs a subcommand layer in command.ts and cli.ts: carried as a task of its own.

**Problems:** none beyond the round's own: edit.ts always matched a part of a line (only its header said whole lines);
the first `--plain-from` tries measured again, rightly, on code changed in between.
