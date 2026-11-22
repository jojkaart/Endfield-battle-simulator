## 2026-11-22: Improvement round 5: the lock's queue, premerge's done line, diagnosis views

Goal: improvement round 5 (docs/friction/README.md, step 2) over the eleven open reports (round 4's backlog and
report, the finisher gate, the eight 2026-11-22 accuracy branches) and the lead's own friction from merging their
batch. Summary and outcomes: docs/friction-done/2026-11-22-round-5.md; what's left:
docs/friction/2026-11-22-backlog-after-round-5.md.

Done:
- premerge's last line comes from scripts/done-line.sh: "pass" only from its own end, "killed" from a signal trap.
  The false pass was bash's: a shell killed by a signal runs its EXIT trap with `$?` of the last finished command
  (0). Long steps now run in the background and are waited for, so the trap runs at once (bash defers traps during a
  foreground command) and stops them; tests/done-line.test.ts.
- The test lock: fair shares between worktrees (a worktree's n-th waiting job counts as arriving n × 20 min later),
  the estimated wait plus run against the 2 h background limit on the first waiting line, a kill in the queue named
  on the DONE line. measure and team-ab fix their code at queue time with a snapshot commit of the working tree
  (temporary index, own worktree, removed after): agents keep editing while they wait. team-ab's identity check runs
  in the short lane, its 32 seeds only for the moved teams.
- `npm run merge -- <branch>…`: a batch with one snapshots run, then `vitest related` on the code both sides changed.
- Views: `zmdlogs worldtime`, `lanes --world`, `measure --hits` and moved casts under `--changed placement`, the
  replay's EVENT lines (`loggedCastFates`, the same matcher as withLoggedCasts), fallback matches in `groups`,
  `verdictReading` in `hits --json`, `efsim assumptions`, skill groups and applications in `efsim kit`.
- Docs: batched timestamps, how the placement picks among groups sharing a key, misreadings, limits; `.prettierignore`.

Decisions: no hard one-job-per-agent cap (fair shares get the same without idling the machine); no more jobs in the
side lane (timeouts and incomparable measurements; the snapshot makes the wait free instead); `hits --json` fields
added, not renamed (scripts read `predicted`); the hold-out snapshot file stays where it is (a grep exclusion instead
of moving a file three scripts and the snapshots glob name); a replay-only buff-duration option and the `beside`
exemption for `launch` are behaviour changes, left to accuracy tasks.

Checked: `npm run measure -- --hits` at the views commit, every log byte for byte; team-ab against HEAD unchanged.
