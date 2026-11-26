# Improvement round 15 itself (2026-11-26)

Task: improvement round 15 over the five open friction reports and round 14's backlog, every file free; branch
worktree-agent-a3b7e56a96adc6d81 on main at 32dfacd. Points already in docs/friction/2026-11-26-backlog-after-round-15.md
aren't repeated.

## 1. A refused Bash call runs nothing, and nothing says so

- **What happened:** I chained `node scripts/edit.ts scratch/edits-22.txt && node scripts/bash-guard.ts --check "sed -i
  '288a\ …' …"` to apply the guard's new sed rule and try it at once. The harness's worktree check refused the whole
  call ("too complex to verify that it stays inside the worktree": the guard's own test input is the form it refuses),
  so the edit never ran; I went on as if it had, and the guard's test failed with `undefined` a few minutes later. One
  debugging round (a scratch script printing the regex's match) before I saw the file unchanged.
- **Cause:** the harness judges a call's whole text, and its refusal (like bash-guard's) doesn't say that the other
  commands in the call didn't run; and a forbidden form can't be passed to `bash-guard.ts --check` as an argument,
  because the call carrying it is itself refused.
- **Suggestion:** bash-guard's refusal text ends "nothing in this call ran: run its other commands again"; `node
  scripts/bash-guard.ts --check-file <file>` reads the command from a file, so a rule's own examples are tried without
  the harness seeing them (tests/edit-guard.test.ts is the other way, and the one that worked).
- **Files:** scripts/bash-guard.ts, tests/edit-guard.test.ts; CLAUDE.md's worktree paragraph (one clause, the lead's).
- **Why it helps:** a refused chain is re-run instead of half-trusted; the guard's rules get tried the way they're
  written.

## 2. A tooling round can't add a snapshot key, so a whole class of view work waits

- **What happened:** the totals-off report's by-operator scoreboard needs each operator's share of a fight's logged
  damage, which isn't in the snapshots (only each operator's error is). Adding a `share operator <id>` key moves every
  snapshot file though no verdict or scoreboard number moves; the brief's rule ("snapshots must not move") made it a
  backlog point (backlog point 3) instead of an hour's work.
- **Cause:** "no number moves" (the accuracy rule) and "the snapshot files stay byte for byte" are one rule in the
  briefs and docs/friction/README.md step 3, while snapshots:update already tells them apart ("No log's verdicts
  moved" against a changed file).
- **Suggestion:** step 3 of the process reads: a round may add snapshot keys (new fields, not changed values) when
  `npm run snapshots:update` says no log's verdicts moved and docs/accuracy.md's existing numbers are unchanged; the
  round summary names the keys added. scripts/snapshots.ts could print "keys added only: …" for that case so the check
  is one line.
- **Files:** docs/friction/README.md (step 3), scripts/snapshots.ts (the "keys added only" line), the lead's brief
  template.
- **Why it helps:** records the scoreboard reads (shares, counts per kind) become tooling, not accuracy work; the risk
  is a key that hides a moved value, which the "values unchanged" line rules out.

## 3. The outcomes skeleton missed the carried point

- **What happened:** `node scripts/friction.ts carry … --label "<name>,"` (the README's form) wrote "…backlog-after-
  round-14.md, point 1"; `friction.ts outcomes --backlog` didn't read the comma form and left the carried point's
  outcome blank, filled by hand. Fixed in this round (2af111c: carriedFrom takes "<file>, point n").
- **Cause:** two halves of one tool written apart, tested apart.
- **Suggestion:** none left; noted so the next round trusts the skeleton.
- **Files:** scripts/friction.ts, tests/friction.test.ts (done).
- **Why it helps:** the paperwork's order (backlog, then outcomes) works as the README says.

## What worked well

- `npm run measure -- --base 32dfacd --at HEAD` on a WIP commit while the next items went on, and team-ab's identity
  check in a minute: "a move only" was a fact before the docs were written.
- The unread-option warning (round 14) named `--cache` on the first `zmdlogs assumed` run, which uncovered that every
  `--no-cache` had been dropped.
- The reports' episodes as tests (4d60 106.47 s, c4f3 68.50 s, db87 27.13 s, d4fb 86.50 s), and the new fact table's
  test finding three real cases on its first run.
- scripts/edit.ts for every multi-line edit (thirty batches) and the bash guard's refusals naming the safe form.
