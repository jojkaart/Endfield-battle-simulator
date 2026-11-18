# Typhoeus's and Laevatain's in-game tests from the logs (2026-11-18)

Task: decide in-game tests 9, 43, 46 (Typhoeus) and 17, 21, 22 (Laevatain's Twilight and Scorching Heart) from the
logs, fix the engine where the logs showed it wrong, and report the teams' movement; branch
`worktree-agent-a7db0dbb47a0a27bf`. Outcome: engine assumption `buff-in-stop`, a cast-placement fix, test decisions
(journal 2026-11-18-03).

## 1. No way to watch a kit buff's timer through the replay

- **What happened:** to find out why Twilight ended early in the replay I needed its expiry after every step (which
  stop, combo or pause moved it, by how much). `zmdlogs replay --kit-buff` only prints the window's start and end. I
  added a temporary `EFSIM_TRACE_BUFF` print to `replayKitBuffs`' step loop (packages/logs/src/buffreplay.ts), dumped
  traces for 15 logs, and parsed them with scratch scripts (holds.ts, dneed.ts); then removed it before committing.
  Without it the cascade (an early end drops the later combos' and pauses' holds, so the gap looks 2–4 s bigger) would
  have stayed hidden. About an hour, plus a second pass with the kit's duration set to 45 s to see every hold.
- **Cause:** the replay keeps no per-buff history; `kitWindows` samples presence, not the expiry's moves.
- **Suggestion:** a `--trace-buff owner:id` option on `zmdlogs replay` that prints, at each step where the buff's
  `expiresAt` changes, the step (cast, sample) and the change in frames; optionally `--hold-only` to report holds with
  the duration set long (so later holds after an early end still show).
- **Why it helps:** every "this buff runs longer than its model" question (Twilight, Scorching Heart, Rossi's crit
  window, Liino's linger) is this exact analysis. Cost: a few lines in the step loop.

## 2. The lock queue made a one-minute measure take an hour

- **What happened:** `npm run measure` waited 50+ minutes behind other agents' `rules` jobs and premerges (8–11 tickets),
  the "waiting N min" counter restarting, so I could not tell progress. I finally ran it with `EFSIM_NO_TEST_LOCK=1`
  (140 s). The team `rules` runs (8 jobs) waited similarly.
- **Cause:** measure is queued as a "job" like a 10-minute `rules` seed table; premerges jump ahead of both.
- **Suggestion:** give `measure` (and other sub-3-minute jobs) their own lane or a priority above long jobs, or let a
  job declare an expected length so short ones are not starved; make the heartbeat show the total time waited.
- **Why it helps:** measure is the designed fast feedback loop; starving it pushes agents to bypass the lock.

## 3. Engine changes that move buff timings break many hand-pinned kit tests and examples

- **What happened:** `buff-in-stop` (a general timing rule, measured positive on the logs) failed 20 tests in 13 files:
  kit tests pinning `expiresAt` as "data duration from the cast" (Akekuri, Ardelia, Lifeng, Mi Fu, Rossi, Wulfgard,
  Yvonne, Zhuang Fangyi, Laevatain), the pinned search total, the loop-search tests (no loop any more), and two example
  timelines that no longer played (steps in Twilight's extra 2 s). Each needed a manual new number; examples needed a
  scratch repair script (scratch/repair.ts: try the step's Twilight/plain form, else later, else drop), because
  `gear`'s internal repair isn't exposed.
- **Cause:** kit tests assert absolute frames that mix the kit's value with the engine's clock rules; examples are
  fixed timelines with no repair command.
- **Suggestion:** (a) kit tests assert durations through a helper `expectLasts(buff, seconds)` that adds the engine's
  documented holds (heldFromNow) so a clock rule moves them all at once; (b) an `efsim repair <scenario>` command
  (the gear repair, plus "try the skill's other form" for state-dependent variants) that rewrites a timeline and prints
  what moved.
- **Why it helps:** engine-rule changes would cost minutes instead of an hour of test edits, and examples wouldn't need
  a bespoke script each time.

## 4. The re-triage's claims needed re-deriving from scratch

- **What happened:** two re-triage claims were wrong on inspection (test 43 "against the engine's plain 5th": the
  engine's 5th is plain only off-field; test 46's "13 ultimates": the log repeats `ultimate_skill` events at later
  shots). Checking each took a script over `zmdlogs hits --json`.
- **Cause:** the triage files were written without the kit's conditional hits (`if controlled`) or the event-repeat
  facts in view.
- **Suggestion:** design/data.md "What the log records" gains "Typhoeus's `ultimate_skill` event repeats at later shots
  of the window"; triage briefs ask to quote the kit hit (and its `if`) a claim is "against".
- **Why it helps:** fewer false leads.

## What worked well

- `zmdlogs hits --json` (scaleParts, zones, modifiers, enemy statuses) answered tests 9 and 43 in minutes.
- `zmdlogs casts` (placed casts and stops) made the Twilight brackets and test 17's timings straightforward.
- `at-commit.ts` for a base-code comparison (db87's Corrosion) without touching the tree.
- Engine assumptions with `--assume` everywhere (rules, measure, check; replay now too) made the A/B for the teams clean.

## Outcome (round 4)

2026-11-18, improvement round 4 (docs/friction-done/2026-11-18-round-4.md); what's left is in docs/friction/2026-11-18-backlog-after-round-4.md.

1. Done (0a846c6): `zmdlogs replay --trace-buff owner:id` (ReplayOptions.trace, BuffReplay.traces). `--hold-only`
   with the duration set long: not done (the kit can be swapped with `--kit` for that).
2. Done (7aa310e): measure is a short job in its own lane beside long jobs; the heartbeat shows the time waited and the
   estimate.
3. Partly (70dc452, 2b82e56): `efsim repair <scenario> --write` (gear.ts repairRotation exported, with "try the
   skill's other form"); `npm run smoke` catches the pinned tests in 90 s. `expectLasts` for kit tests: round-4
   backlog.
4. Done (f6259ef): Typhoeus's repeated ultimate events in "Common misreadings"; the claims rule asks to quote the kit
   hit and its `if` for "engine compared".
