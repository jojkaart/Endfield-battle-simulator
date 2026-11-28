# Combo windows: INSIDE flags where the replay's window is shut at the press (2026-11-28)

Task: the 18 combo-window INSIDE lines of `zmdlogs decisions --all` (round 23's backlog accuracy list): which trigger
opens each window, when the log and the replay have it, group by cause, fix what the data decides. Branch
worktree-agent-aae9ee5eca9001663, from main at 967d460.

## 1. No view says what opened a combo window, when, or why it stayed shut

- **What happened:** for each of the 18 lines I had to piece the opener together from three views: `zmdlogs replay
  --from --to` (the landings around the press), `zmdlogs statuses --inflictions` (the infliction that fired the
  trigger) and `replay --trace-trigger owner:id` (only when I knew the kit's trigger id, from `jq` over the kit
  file). That took about an hour for 18 lines; the cooldown case (3f78 19.30 s) needed a scratch script to read the
  combo's cooldown from `data.skills[id].levels`, since nothing prints it. The INSIDE line said only "its combo
  window, shut until then".
- **Cause:** the replay keeps the window (`TimelineState.comboWindow`) and its latest trigger (`comboTrigger`) in
  the state, but no view prints them; the trigger trace is per trigger id, not per window, and the cooldown that
  keeps a window shut (actions.ts openCombo's `break`) leaves no record.
- **Suggestion:** done in part: startGateWords now names the window's last opening, the skill's last cast, the
  latest recorded trigger and the cooldown that kept it shut, and a start inside the combo's own slow-down. Still
  worth a `zmdlogs replay <fixture> --windows <operator>`: one line per openCombo firing of the operator's triggers
  (opened, refreshed, kept shut by the cooldown with its ready frame, the event and its source), each window's close
  (expiry, cast, its buff's end).
- **Files:** packages/engine/src/timeline/actions.ts (a record of each openCombo outcome, as a statistic),
  packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** a combo-window question becomes one command instead of three views and a kit read.

## 2. `efsim kit` doesn't print a skill's cooldown

- **What happened:** to test whether 3f78's Arcane combo (17.17 s after the last) beat its cooldown I wrote
  scratch/cd.ts to read `levels[].coolDown`, then a second script for every log's combo gaps against it.
- **Cause:** the kit view prints timing (duration, uncuttable frames, windows, slow-downs), not costs; skillCosts
  (timeline/context.ts) computes cooldown and SP cost per build only inside a run.
- **Suggestion:** `efsim kit <operator>` prints each skill's cooldown and SP cost at level 12 (and per level with
  `--levels`), and the cooldown-changing triggers (kind `cooldown`) under it.
- **Files:** packages/cli/src/commands/kit.ts, packages/engine/src/timeline/context.ts.
- **Why it helps:** cooldown questions (a combo pressed early, a window kept shut) start from the number.

## 3. The INSIDE flag counts a world-time-simultaneous opener as a wrong replay

- **What happened:** 12 of the 18 lines are an opener logged 2–17 frames into the combo's own slow-down (0.05–1.6
  frames of the world's time), at a ms the combo's own first hit or cast event shares: the log batched it. The flag
  says "the replay's state may be wrong from each on" for all of them, so the 72 INSIDE lines overstate the replay's
  disagreements; the backlog's "the flag's kind could tell them apart" was right.
- **Cause:** castFlag (replayrun.ts) compares raw frames; a pinned landing sits at its logged (flushed) ms.
- **Suggestion:** give the flag a kind for this case (`inside` with `within its own slow-down`, counted apart in the
  decisions summary), or have the placement move a pinned landing logged inside another cast's slow-down, at that
  cast's first logged ms, to the cast's start (the lead in docs/open-problems.md "Combo windows").
- **Files:** packages/logs/src/replayrun.ts castFlag, packages/logs/src/decisionsview.ts (the counts), or
  packages/logs/src/logcasts.ts for the placement rule.
- **Why it helps:** the INSIDE count then measures real disagreements.

## 4. `.ignore` doesn't keep `rg -l <word> tests` off the hold-out snapshot

- **What happened:** `rg -l "typhoea" tests packages/*/test` listed tests/snapshots/log-verdicts-holdout.json among
  the matches (its name only; I didn't open it). `rg -l typhoea tests/snapshots` does skip it, so the `.ignore`
  pattern `tests/snapshots/log-verdicts-holdout.json` only works for some search roots.
- **Cause:** an unanchored pattern with a slash in `.ignore` matches relative to the `.ignore` file's directory, but
  ripgrep 14.1 apparently didn't apply it when the search root was `tests` from the worktree.
- **Suggestion:** write it as `**/log-verdicts-holdout.json` (and `**/fixtures/holdout/`), and add a test that runs
  `rg -l <a word every snapshot has> tests` and expects no hold-out path (a count only).
- **Files:** .ignore, tests/holdout-blindness.test.ts.
- **Why it helps:** the blindness rule holds for the searches agents actually type.

## 5. A view test pinned the very flag the task was to remove

- **What happened:** the first premerge (15 min) failed on tests/views.test.ts "flags casts made against the kit":
  it asserted 0eef's Typhoeus combo at 6.77 s is INSIDE "held by its combo window", the backlog's lead itself. No
  test I ran while working (`vitest related` would have been most of the suite) named it; `rg -l 'combo window'
  tests` would have.
- **Cause:** round 23 tested its new gate words on a live accuracy lead, so the fix breaks the words' test.
- **Suggestion:** a view's wording test uses a case the docs mark settled (or a synthetic one), and names the lead
  in a comment when it can only use a live one ("fails when 0eef 6.77 s is fixed"), so `rg -l '<fixture> <time>'
  tests` finds it; the lead's backlog entry names the test.
- **Files:** tests/views.test.ts, docs/friction/README.md (the backlog's accuracy entries).
- **Why it helps:** saves a premerge cycle for whoever fixes the lead.

## What worked well

- `zmdlogs decisions --all` with round 23's gate words found the 18 at once; `zmdlogs worldtime` settled the
  slow-down cases in one line each; `gamedata tree` / `who` led straight from the kit's note to the listener's
  abilityEvent 9 and the burst buffs' tags.
- `node scripts/verify-at.ts <base> --test` confirmed the new test fails before the change in seconds.

## Outcome (round 24)

- 1 (No view says what opened a combo window, when, or why it stayed shut): done but the engine's record of each
  openCombo outcome (carried: 2026-11-28-backlog-after-round-24.md point 3) (8b932fc): `zmdlogs replay <fixture>
  --windows <operator>` (ReplayOptions.trace `window:<operator>`, replayrecord.ts WindowTrace, windowsview.ts): each
  opening or refresh with its source, an event the cooldown kept out, each end, the combos' ready frames, each press
  with the window it found (MadeCast.window). 3f78 19.30 s reads off it: "an event at 19.17 s (natural infliction) kept
  shut by the cooldown (combo_skill ready at 20.13 s)".
- 2 (`efsim kit` doesn't print a skill's cooldown): done (8b932fc): a costs line per skill (cooldown and SP or energy
  at level 12, the levels that differ, `--levels` every one) and the kit triggers' cooldown actions that change it
  (Arcane's combo: p5_cooldown, Si's ultimate_effects on slot 0).
- 3 (The INSIDE flag counts a world-time-simultaneous opener as a wrong replay): done by the combo-openers task
  before this round (b3612e6, replayrun.ts openerAhead: the 12 lines gone, OPENER lines instead); nothing more here.
- 4 (`.ignore` doesn't keep `rg -l <word> tests` off the hold-out snapshot): done (400bb44 before this round; 0a1efea):
  checking it, ripgrep 14.1 with several roots skipped the root .ignore's patterns for the later roots in 8 runs of 12
  (`rg --files tests fixtures`, every run with -j1: the hold-out logs listed; counted, never printed): fixtures/.ignore
  and tests/snapshots/.ignore hold them too, and tests/holdout-blindness.test.ts runs seven forms, one root and
  several, in both orders (it fails with fixtures/.ignore moved aside).
- 5 (A view test pinned the very flag the task was to remove): done (0a1efea): docs/open-problems.md's head says a
  wording test on a live lead names it in a comment ("a live lead: fails when it is fixed") and takes a settled or a
  synthetic case where it can; this round's own tests do so (tests/decisions.test.ts COOLDOWN on a synthetic record,
  tests/combo-windows.test.ts 3f78 19.30 s commented as live).
