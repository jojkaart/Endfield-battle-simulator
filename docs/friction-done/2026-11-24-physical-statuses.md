# Fight totals, round 4: physical statuses, Rossi's extras (2026-11-24)

Task: the hold-outs' log-only physical status hits, Rossi's replay-only Seething Blood extras, Zhuang Fangyi's
Sunderblade count in 4d60; worktree branch on main at a71da03.

## 1. Separating one change's effect from a batch cost four measures and a wrong doc claim

- **What happened:** four changes went into one measure; 12 logs moved, some worse. To find which change moved 4bfc
  I narrowed the suspect (the same-ms order) and re-measured, wrote "narrowed after the rule moved 4bfc" into
  timeline.md, then found the narrowed rule moved it just the same; only `--at a71da03 --patch <all but one>` showed
  the order was the culprit. A first try, `--patch` on the queued tree, failed (the patch is applied on top of the
  tree, which already has it).
- **Cause:** measure has `--variant` for readings but nothing for "each of these diffs alone"; `--patch`'s base
  defaults to the queued tree, the opposite of what a split needs.
- **Suggestion:** `npm run measure -- --split <file>…` (or `--split-files`): one run per changed file or file group
  against the base, each line "this group alone: which logs moved"; and make `--patch` without `--at` say "applied
  on top of the queued tree (which has your changes): use --at <base>" before queueing.
- **Why it helps:** the first measure of a batch would name the change behind each moved log, so nothing gets written
  down about the wrong one.

## 2. The kit and tree views don't show a skill's ends and trigger jumps together

- **What happened:** Snowshine's bashes vanished silently: the replay printed no NOLAND reason beyond "a landing the
  replay didn't land", no FAILED, no CUTS. Finding that the cast's end at frame 106 dropped a pinned landing at 125
  took a scratch script (placed casts, castFlags, landings), then `data.skills[...].timing` by hand (scratch/timing.ts),
  then the kit JSON for the `attacked` trigger's jump.
- **Cause:** a landing dropped by its own cast's end (or a jump) leaves no trace; `efsim kit` prints neither
  `timing.ends` nor the triggers' `jump` actions.
- **Suggestion:** record in the replay when a pinned landing is cancelled (by an end, a jump, a cut) and give
  `zmdlogs replay` a `DROPPED` line with the cause; `efsim kit` prints a skill's ends and every trigger's jump on it.
- **Why it helps:** "a landing the replay didn't land" is the largest log-only kind in the development logs (1.4%);
  each would name its cause instead of needing a hunt.

## 3. `gamedata tree` cuts branches, so a skill's data can't be read to the end

- **What happened:** Zhuang Fangyi's Empyrean battle skill: blocks [9] and [14] (the free path, the Electrification
  branch) print their condition and then stop; the succeed branch that likely explains 4d60's two extra Sunderblades
  isn't shown, so the question stays open.
- **Cause:** the tree printer elides deep or repeated branches without saying so.
- **Suggestion:** `gamedata tree <id> --path <json path>` printing one subtree in full (the `who` output already gives
  such paths), and a "… N more actions elided" marker where it cuts.
- **Why it helps:** kit questions settle from the data instead of being left as "a branch the printer cuts".

## 4. Habits again: one multi-line `python3 -c`, one empty heredoc

- **What happened:** a five-line `python3 -I -c` to list a fixture's cast events and `cat > x <<'X'` with an empty
  body while about to write an edits file; both ran. The bash-guard hook isn't wired.
- **Cause:** same as the last three reports; nothing refuses them.
- **Suggestion:** wire scripts/bash-guard.ts (round 9) as the PreToolUse hook; until then, a `scripts/fx.ts <id>
  <jq-like path>` for the one-liners I keep reaching for Python for (a fixture's casts of an operator, its team).
- **Why it helps:** most of my inline Python was reading a fixture field the CLI doesn't print.

## 5. Every probe re-derived "the logged hits at this ms" and "who credits this status"

- **What happened:** six scratch scripts (physmiss, shatters, shatter-src, atms, events-near, critref) each printed
  logged hits near a time with some extra column (crit source, refs, the replay's landing, listed effects).
- **Cause:** `zmdlogs hits` has no time window (`--from/--to` silently ignored) and no columns for crit source or ref.
- **Suggestion:** `zmdlogs hits <fx> --from s --to s [--operator op] [--event re]` with optional columns `--crit`
  (log flag and critSource), `--landing` (ref, landing, loggedCrit), `--effects` (the compact listed-effects signature
  scratch/hitfx.ts prints, "(same)" when unchanged).
- **Why it helps:** most diagnosis steps this round were one of these windows; each was a new script.

## What worked well

- `npm run measure` per patch at a base commit separated the order change from the rest in a minute, and its
  "the hold-outs' kinds" line showed at once that the development mechanisms weren't the hold-outs' (2.08% unmoved).
- `efsim gamedata who` → `tree` from a log key to the BuffData handler answered "whose Shatter" from the data in three
  commands.
- `zmdlogs replay --trace-buff` gave the Sunderblades' instances and expiries directly.
- docs/tried/ made dropping the order change cheap: diff and header in one file, findable from open-problems.

## Outcome (round 10)

- 1 (Separating one change's effect from a batch cost four measures and a wrong doc claim): done in part (c534a11): a
  `--patch` without `--at` that the working tree already has (it applies in reverse) is refused before queueing, naming
  `--at <the commit before it>`; a diff that doesn't apply at all likewise. `measure --split` (one run per file group)
  is carried (docs/friction/2026-11-24-backlog-after-round-10.md point 3).
- 2 (The kit and tree views don't show a skill's ends and trigger jumps together): the kit half done (d4856a1): `efsim
  kit` prints each skill's paths (the data's jumps, ends, recasts and interruptible frames, the kit's conditional
  jumps, the triggers' jumps on it: Snowshine's battle skill "ends at frame 106; … trigger counter … jumps it from
  frame 0 until 51 to 107"). The replay's DROPPED line is carried (backlog point 4): the cancellation happens in the
  engine's timeline, outside this round's files.
- 3 (`gamedata tree` cuts branches, so a skill's data can't be read to the end): done (d4856a1): `gamedata tree <id>
  --path <json path>` prints one subtree, and a list of nothing but presentation says "(presentation only, left out:
  EffectAction)" instead of vanishing. For the question itself: Empyrean's blocks [9] and [14] (the free path, the
  Electrification branch) have succeed branches that only play an effect, so they don't explain 4d60's two extra
  Sunderblades.
- 4 (Habits again: one multi-line `python3 -c`, one empty heredoc): done by the owner (the hook is wired); for the
  one-liners, jq is installed (CLAUDE.md now says so: a fixture's field is a jq line), so no scripts/fx.ts.
- 5 (Every probe re-derived "the logged hits at this ms" and "who credits this status"): done (7e521dd): `zmdlogs hits
  <fixture> --from s --to s` (with `--operator`, `--event`; `--zones` already gives the replay's crit and its source).
  The cause behind "silently ignored": the CLI's one shared parse accepts another command's option anywhere; efsim now
  names, on stderr, every option given but never read (command.ts trackReads). `--landing` and `--effects` columns:
  not done (the JSON line has both; jq).
