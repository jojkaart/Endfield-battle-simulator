# The owner's in-game test queue from the logs (2026-11-18)

Task: decide from the logs test 110 (how long a Stagger lasts) and every test in the owner's queue, fix the engine
where the logs show it wrong (measured), and rebuild the queue with only game-only tests. Branch
`worktree-agent-a96be4188e670d1a2`, base 1e1e7a8.

## 1. The engine's own Stagger end was invisible exactly where the log ended first

- **What happened:** `efsim zmdlogs stagger` (views.ts `staggerRuns`) reports `engineEnd` only from
  `BuffReplay.staggerHolds`, which the replay records only when it holds a Stagger *past* the engine's end. Where the
  log's calm hit ends the Stagger *before* the engine's own would end, `staggerRuns` fell back to the replay's window
  end, which is the calm hit itself. Four windows (2fd9, c83c, d4fb 145 s, f978) therefore looked like exact fits
  (log end − engine end in [−0.1, +0.1] s). I nearly read them as "the data length is exactly right for these" before
  noticing the coincidence was the replay cutting at the next logged hit. I had to add `BuffReplay.staggerCuts` and
  `StaggerRun.engineCut` and rerun about an hour of analysis.
- **Cause:** the diagnostic recorded only one direction of disagreement (log longer). A tool that compares two ends
  but shows one of them only when it's larger produces one-sided statistics.
- **Suggestion:** for every comparison view (`stagger`, kit-buff windows in `replay`), record the engine's own value in
  both directions, and label the row "engine ended first" / "log ended first". Done for Stagger (`staggerCuts`); the
  same gap exists for kit buffs: `replay --kit-buff` prints the replay's window, which also ends at a log-driven point
  where the replay follows the listing.
- **Why it helps:** removes a class of false "exact fits" in any timing diagnosis. Low cost.

## 2. A behaviour change in the engine breaks loop and rules tests far from it, found only by premerge

- **What happened:** adding 2 s to the Stagger length (one line in `staggerFrames`) passed the directly related tests
  and `npm run measure` (scoreboard unchanged), but premerge (10 min) then failed five tests in unrelated areas:
  Laevatain-alone loop searches (`tests/search-loop.test.ts`, `tests/slow/search-loop-cli.test.ts`: no exact loop in
  12 rounds), the owner's team rules check (`tests/policy-stepping.test.ts`: a press of Akekuri's battle skill cutting
  her own ultimate at seed 2, 119.5 s), plus two tests with hard-coded frame bounds. Each took a scratch script to
  understand. With the background team runs and the shared test lock (other agents queued ahead, 20+ min waits), the
  fix-and-recheck cycle cost about two hours.
- **Cause:** `vitest related` follows imports, and everything imports the engine, so it can't say which tests are
  sensitive to a *timing* change. There's no fast "behaviour smoke" between the targeted tests and full premerge, and
  rules and loop tests depend on exact timings by design (a seed's run, an exact repeat).
- **Suggestion:** a `npm run smoke` (under 2 min) that runs the three example teams' rules checks (`checkRuleRun`, a
  few seeds at 120 s), one loop search per kind, and the stagger/timeline tests, listed in CLAUDE.md as the step after
  any change to `packages/engine/src/timeline/`. Also give `tests/search-loop*.test.ts` a scenario with
  `options.assume` pinned for the readings they don't test (done for `stagger-recovery`), so engine readings don't
  break loop machinery tests.
- **Why it helps:** finds timing-sensitive breakage in minutes instead of after a 10-minute premerge plus lock waits.

## 3. The rules language can't say "while her ultimate is running" without a kit edit

- **What happened:** the rules check flagged Akekuri's battle skill pressed during her own ultimate, which cuts it. The
  fix needed a cue "Akekuri isn't in her ultimate". `resolveRuleList` refused `buff: zone_hold` ("isn't a state the game
  shows without buff icons"), so I had to add a `visible` declaration to her kit's buff, guessing at what the player
  sees. That's a kit change made to unblock a rules-list fix.
- **Cause:** "the operator's own ultimate is playing" is visible for every operator (it's on screen), but cues exist
  only per kit buff that has a `visible` flag.
- **Suggestion:** a generic cue `{ "inUltimate": "<operator>" }` (true from the ultimate's cast to the end of its
  duration, or while its `endsWithCast` buffs last), next to `ultimate` (ready) and `combo` (lit), so no kit needs a
  `visible` flag for it. Then drop the flag from `chr_0019_karin.json` `zone_hold`.
- **Why it helps:** rule lists can avoid the "cuts own ultimate" class for every operator without kit edits or guessed
  visibility claims.

## 4. Analysis needed many one-off scratch scripts over the same per-window joins

- **What happened:** for tests 110, 12 and 108 I wrote eight scratch scripts that all join the same things: the log's
  runs of a listed buff or state (first listed hit, last listed hit, next unlisted hit), the replay's window for it,
  the stops inside (`castTimeStops` + `worldMs`), and the events in the window. Each script redid the hit sorting and
  bracketing, and had its own small bugs (Mi Fu's finisher is `powerattack` with no underscore; modifiers live under
  `landing.modifiers`, not at the top level of `zmdlogs hits --json` records).
- **Cause:** `staggerRuns` is Stagger-specific. There's no general "listed runs of buff X against the replay's kit
  window Y" export, and the JSON record shape isn't documented next to the command.
- **Suggestion:** an `efsim zmdlogs windows --listed <buff regex> [--kit-buff owner:id] [--json]` built on
  `staggerRuns`' logic: one row per run with first, last and next hit, the replay's window, the engine's own end (both
  directions, point 1), and the stop time inside. Document the `hits --json` record fields (`landing.modifiers`,
  `landing.zones`, `differences`) in docs/design/data.md.
- **Why it helps:** tests 12, 107, 110 and the buff-timing open problems all reduce to that one table; each diagnosis
  saves an hour of scripting and a class of join bugs.

## 5. Hold-out keys appear in snapshot diffs

- **What happened:** after `npm run snapshots:update`, a plain `git diff tests/snapshots/log-verdicts-pending.json` to
  explain a change printed hold-out log keys and their counts into my context. I didn't use or repeat them, but it's
  the easy way to look at what moved.
- **Cause:** `log-verdicts-pending.json` mixes hold-out entries with development entries, so any diff of it shows
  them.
- **Suggestion:** move the hold-out verdicts to their own snapshot file (`log-verdicts-holdout.json`), which agents are
  told never to diff, or add `scripts/snapshot-diff.ts` that prints only development keys and hold-out aggregates.
- **Why it helps:** removes an easy accidental breach of the hold-out rule.

## 6. A `^EFSIM-DONE` wait matches the wrapper's own done line

- **What happened:** my wait loop `until grep -q '^EFSIM-DONE' scratch/x.log` around a script that ran two jobs through
  `with-lock` stopped after the first, because `with-lock` itself prints `EFSIM-DONE with-lock exit 0`. I read a
  half-finished log as complete.
- **Cause:** CLAUDE.md's wait recipe greps for any `EFSIM-DONE` line, but nested tools (with-lock inside a script)
  each print one.
- **Suggestion:** CLAUDE.md's recipe should grep for the job's own name (`^EFSIM-DONE <job> `), and say that
  `with-lock` prints its own.
- **Why it helps:** prevents reading partial results. A one-line doc change.

## What worked well

- `npm run measure` (all logs in about two minutes, `--with`, `--assume`) made every engine idea cheap to check, and the
  hold-out aggregate line kept the rule easy to follow.
- Engine assumptions (`ENGINE_ASSUMPTIONS`, `--assume`) let me evaluate readings side by side (`stagger-recovery`,
  `stagger-freeze`, `combo-window-count`) and keep the alternative switchable, with team runs under both in one script.
- `zmdlogs differences --what … --hits` and `zmdlogs replay --kit-buff` answered test 12's "does the damage follow the
  listing" directly.
- premerge's step table and the snapshot update's "better / worse" lines made the final state easy to report.

## Outcome (round 4)

2026-11-18, improvement round 4 (docs/friction-done/2026-11-18-round-4.md); what's left is in docs/friction/2026-11-18-backlog-after-round-4.md.

1. Partly (0a846c6): `zmdlogs replay --trace-buff owner:id` prints every change of a kit buff's expiry with the step
   that made it, which shows where the replay cut or held a buff. The kit-buff windows' "engine's own end" as a field
   (as `engineCut` for Stagger): round-4 backlog.
2. Done (2b82e56): `npm run smoke` (about 90 s: kit tests, loop and beam searches, the owner's rules check, timeline
   and examples tests). Pinning `options.assume` in the loop tests for readings they don't test: round-4 backlog.
3. Not done (round-4 backlog): the generic `inUltimate` cue (it changes the rules language's cue table and the
   team's list; team numbers must not move this round).
4. Partly (ec22f1c, f6259ef): `zmdlogs lanes --buff <re>` gives the listed runs (first, last, next hit); the
   `hits --json` record fields are listed in data.md. Joining a lane with the replay's kit-buff window in one row:
   round-4 backlog.
5. Done (428fe66): the hold-outs' entries are in tests/snapshots/log-verdicts-holdout.json (ripgrep skips it; CLAUDE.md
   says never to diff it), so a diff of the pending file names none.
6. Done (7aa310e): CLAUDE.md's recipe greps for the job's own name; with-lock's line is `EFSIM-DONE <--name> exit n`.
