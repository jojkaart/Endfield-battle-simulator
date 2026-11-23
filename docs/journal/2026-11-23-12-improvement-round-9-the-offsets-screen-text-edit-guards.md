## 2026-11-23: Improvement round 9: the offsets screen, text-edit guards, measure's kinds

**Goal:** the five open friction reports (round 8's backlog and own report, the stop lists, both fight-totals rounds),
tools only, while another agent worked on one-sided landings in logcasts.ts, buffreplay.ts, replayrecord.ts and
fightTotals. Summary: docs/friction-done/2026-11-23-round-9.md; backlog: docs/friction/2026-11-23-backlog-after-round-9.md.

**Done:**
- **Build offsets screened.** `efsim zmdlogs offsets --all` (buildoffsets.ts: per log and operator the median of
  logged ÷ primary over non-crit kit hits, tight within 1%); the verified and pending suites fail on a candidate no
  buildOverride or OFFSETS_EXPLAINED entry accounts for. Today 6: three stage logs, Purrchena's level 1 (99fb),
  Catcher's weapon (04d4), and a new lead, Snowshine in 04d4 ×0.962 (fit-build undecided).
- **The shell's text damage, mechanically.** scripts/edit.ts (exact replacements from an edits file written with the
  Write tool); the damage's shapes in a doc fail `npm test`; scripts/bash-guard.ts refuses a heredoc, a multi-line or
  backticked inline script, a multi-line `git commit -m` and a live backtick, as a PreToolUse hook for the owner to
  wire (the summary has the settings line).
- **Measure says what moved:** an "other" log's field kinds, the hold-outs' by kind and their operators as counts,
  `--hits`' moved hidden-hold units, `--logs` by prefix. Shares (matched, replay-only, log-only) in every snapshot
  entry and a scoreboard table, the hold-outs' included. `zmdlogs stops --all --differ`. SkillTiming.slowdowns `n`.
  with-lock's done line on stderr. docs/tried/ for dropped diffs.

**Scoreboard:** unchanged (snapshots:update "No log's verdicts moved"; the files changed by the share keys only):
development plain 67.1%, mismatch 11.7%, mean |damage error| 7.3%; hold-out 77.5%, 6.2%, 9.1%; the new table: the
hold-outs' |matched| 2.5% against replay-only 7.1% and log-only 6.2%, 11 of 13 one-sided.

**Decisions:** the offsets screen is a second function beside logcheck.ts's buildOffsets (that one explains with
0.3% spread in `check`; this one screens all fight). Share keys aren't verdicts: `direction` leaves them out, so
their arrival moved no log. Moved hold-outs' operators printed as counts (the lead may drop that). Not done: the
dilation index through the stop lists and the record (the other agent's files), a kit form naming the engine's hold
(an engine timing change), the twins test (the other agent's subject).

**Problems:** this round's own agent typed a multi-line `git commit -m` with escaped code spans after building the
guard (intact by luck): the reason the hook, not prose, is the answer.
