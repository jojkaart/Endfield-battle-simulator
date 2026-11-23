# Fight totals: what moves them (2026-11-23)

Task: find why the fight totals' mean |damage error| stalled (development 8.7%, hold-out 10.2%) and fix the causes;
worktree branch on main at 4850b50.

## 1. No multi-log view of a total's parts

- **What happened:** ranking the fights by where their error lives (matched scale, replay-only, log-only, and the
  replay-only part inside the log's hitless gaps) took three scratch scripts (scratch/totals-split.ts, gaps.ts,
  matched-by-event.ts) over `engineReport(...).totals.parts`, each a ~2 min run over every log under the lock. The
  first one found the four causes of this round in one table; `zmdlogs totals <fixture>` answers one fight at a time
  and lists landings, not groups.
- **Cause:** `zmdlogs totals` is a single-fight view; nothing aggregates TotalsComparison.parts over the logs, or by
  logged event.
- **Suggestion:** `efsim zmdlogs totals --all [--by operator|event]`: one row per fight (error, matched scale,
  replay-only, log-only as % of the logged total, the top operator rows), sorted by |error|, skipping the
  stage-shield logs with a flag; `--by event` the per-(operator, event) shares for one fight. scratch/totals-split.ts
  and matched-by-event.ts are the starting point.
- **Why it helps:** the totals are what owners act on; the next agent on them gets the ranking in one command instead
  of rebuilding it.

## 2. Replay-only and log-only twins of one hit looked like two errors

- **What happened:** Si's bursts appeared in every Si fight as a replay-only landing and a log-only hit at the same
  ms (0c14 40.33 s: 248k against 231k), which made the replay-only share of 15 fights look like 10–20% and hid
  what the real replay-only damage was. Fixed this round (Fixed DMG landings are their hits' parts), but only after
  a detour.
- **Cause:** fightTotals paired a landing with its logged hit only through the check's primary readings, which
  Fixed DMG hits don't have.
- **Suggestion:** keep the rule that a part's `logged` comes from `replay.landing(hit)` for every hit, reading or not
  (done); a test that no fight has a replay-only part and a log-only hit of one operator at the same ms beyond a few.
- **Why it helps:** the split is only useful when each side is real.

## 3. Shell-quoting traps in one-off edits

- **What happened:** a multi-line `python3 -c` to edit docs/open-problems.md ran the text's backticks as command
  substitutions (`enemy-away: command not found`), silently writing empty spans into the file; caught by grepping,
  fixed with a patch file. An empty heredoc was typed once from habit as well.
- **Cause:** CLAUDE.md forbids both, but the habit is strong and nothing stops the first one; markdown text with
  backticks is the worst case.
- **Suggestion:** a `scripts/replace.ts <file> <old-file> <new-file>` (exact, once, refuses a miss) so a doc edit
  with backticks has a one-command form that isn't the Edit tool on a 3,000-line file; mention it next to
  `scratch/patch.py` in CLAUDE.md.
- **Why it helps:** removes the case where the forbidden form looks easiest.

## 4. Hold-out movements can't be attributed even by kind

- **What happened:** the Endministrator changes moved one hold-out "mixed" and the hold-out mean 10.2 → 10.6% (with
  the old totals rule); presumably a male Endministrator's build error now counted, as in d4fb, but there is no way
  to say which change or which operator.
- **Cause:** by design the hold-outs give only aggregates.
- **Suggestion:** a per-operator aggregate for the hold-outs in `measure` (the moved hold-outs' operators as a
  count per operator id, no fixture ids): "1 mixed hold-out has chr_0003_endminf" says enough to explain it without
  opening a log.
- **Why it helps:** an agent can report a hold-out regression's likely cause instead of "presumably".

## What worked well

- `npm run measure --variant <id>=<r>` gave both readings of the new `enemy-away` assumption in one run, and the
  assumptions registry made the totals rule switchable with no extra code.
- `zmdlogs totals`, `zmdlogs casts` and `zmdlogs hits --json` answered every per-fight question; the casts view made
  the phantom ultimates obvious (CAST ... key buff_common_originum_frozen).
- team-ab's identity check confirmed in a minute that no team's fight moved.

## Outcome (round 9)

- 1 (No multi-log view of a total's parts): already done by the fight totals round 2 (`zmdlogs totals --all`, `--by
  event`).
- 2 (Replay-only and log-only twins of one hit looked like two errors): the rule is in; the test (no fight with a
  replay-only part and a log-only hit of one operator at one ms beyond a few) is backlog point 3 of round 9: it reads
  fightTotals' parts, the subject of the accuracy agent working in parallel (which landings end up one-sided).
- 3 (Shell-quoting traps in one-off edits): done (84e1676): scripts/edit.ts is the one-command form (an edits file
  with `@@@ <path>` and `<<<<<<<` / `=======` / `>>>>>>>` blocks, `end` to append, `@@@ new` to create; exact, all or
  nothing, a miss named with the nearest line), in CLAUDE.md in place of scratch/patch-<n>.py; the damage's shapes in
  a doc fail `npm test` (tests/edit-guard.test.ts over every doc).
- 4 (Hold-out movements can't be attributed even by kind): done (c5dab99): measure's and snapshots:update's
  hold-out lines say what kind of field moved per direction and how many moved hold-outs have each operator ("moved
  hold-outs by operator (how many have each; never which log): chr_0032_lizhiyan 2 (1 better, 1 worse); …"), never a
  fixture id. A decision for the lead: whether the owner wants operator counts of moved hold-outs printed (round 9's
  summary).
