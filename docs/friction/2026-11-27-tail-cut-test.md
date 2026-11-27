# Tail-cut test (2026-11-27)

Task: replace replayrun.ts tailCuts' own-landing pass (the `[shown-own]` TAILKEPT guard) with a test of what the
guard stands for, measure it, and judge it by every group; branch worktree-agent-a6c96ce9f410159ac (round 21).

## 1. The replay's landing-to-logged-hit pairing lives only inside replayKitBuffs

- **What happened:** the first question was "which later logged hits does a tail stand for, or set off?". The
  pairing that answers it (pinned landings by `ref`, then each unpinned logged hit takes the nearest free landing of
  its operator and event, one landing each; statuses by statuspairs.ts) runs inside buffreplay.ts replayKitBuffs after
  the replay, as closures over its locals (`landed`, `free`, `statusLanded`). tailCuts sees only a ReplayRun, so the
  new `needed` check got its own looser approximation (replayrun.ts loggedShown: any landing of the operator with the
  event within 16 frames, no one-landing-each pairing). The looseness showed at once: abfd's two 64.10 s attack-4 hits
  count as shown after the cut through other pinned landings of the same event, where the real pairing would have
  freed them (the −2 plain in the journal entry). Reading replayKitBuffs to find the pairing and decide not to touch it
  (another agent's file family) took about half an hour.
- **Cause:** the pairing is part of building the BuffReplay object, not a function of a run.
- **Suggestion:** a `pairLandings(run: ReplayRun, fx, kits, casts): { byHit: Map<number, LandedHit>; statusByHit }`
  in its own module (castpairs.ts is the casts' equivalent), used by replayKitBuffs and by cutTails' `needed`
  check in place of loggedShown.
- **Files:** packages/logs/src/buffreplay.ts, packages/logs/src/replayrun.ts, a new packages/logs/src/landingpairs.ts
- **Why it helps:** every rule that asks "would the log still have this hit's landing without X" (tail cuts, missed
  casts, a counterfactual replay) gets the same answer as the check; risk: statuspairs' assignment needs the check's
  value fits, so the status half may stay where it is.

## 2. A counterfactual "replay without X, what does the log lose" has no harness

- **What happened:** the decisive evidence for c4f3 and 9847 was cli-ab `--hits-zones` with a patch (the replay with
  the exact guard against the tree), read by hand: which later hits lost their landing or a modifier, then `zmdlogs
  replay` around the cut to see why (a Breach logged 0.32 s before the replay's, a volley timer at the cast's frame 45).
  The patch first failed to apply (`--patch docs/tried/...diff doesn't apply on HEAD`: the tried diff's context had
  changed since round 20), so I wrote the edit, `git diff > scratch/exact.diff`, reverted, and passed that.
- **Cause:** tried diffs go stale as the function they patch changes; cli-ab applies a patch only to the ref's side.
- **Suggestion:** `node scripts/tried.ts refresh <diff>` (apply with `git apply -3` on HEAD in a scratch worktree,
  write the refreshed hunks back under the same header, or say which hunk needs a hand), and a `zmdlogs decisions
  --why-kept <fixture>` that, per TAILKEPT line, replays with the tail cut and lists the logged hits whose landing or
  primary reading moved (cutTails already makes that replay for `needed`).
- **Files:** scripts/tried.ts, packages/logs/src/decisionsview.ts, packages/cli/src/commands/zmdlogs.ts
- **Why it helps:** the round's whole diagnosis was that view done by hand for two logs; with it every kept tail's
  reason is one command. Cost: one replay per kept tail (seconds per log).

## 3. TAIL_CUT_ROUNDS stopped cuts silently

- **What happened:** with the own-landing pass gone, 10 logs used all 8 rounds with 45 casts left over (d4fb 11); those
  were neither cut nor in any TAILKEPT line, so `decisions --all` undercounted what the rule would do. Found by counting TAILCUT lines
  per log in a scratch script (scratch/percount.ts), not by any view.
- **Cause:** the loop's limit had no record, as the guards had none before round 18.
- **Suggestion:** done in this branch (TAILKEPT `rounds`); the same for missedCasts' MISSED_ROUNDS, which also ends a
  loop silently.
- **Files:** packages/logs/src/replayrun.ts (missedCasts)
- **Why it helps:** a limit that bites shows in `decisions` counts instead of as a missing line.

## 4. `zmdlogs decisions --all` outlasts the foreground limit

- **What happened:** the first `decisions --all` (61 logs) went over 2 min and was moved to the background, losing the
  piped `grep -c` I had chained; I ran it again with output to a file.
- **Cause:** a long view with no hint of its length.
- **Suggestion:** its usage line says "about 3 min for --all: run it in background with output to a file", as
  measure's does.
- **Files:** packages/cli/src/commands/zmdlogs.ts
- **Why it helps:** one wasted run per agent that uses it.

## What worked well

`cli-ab --hits-zones` named the 78 moved hits of c4f3 and the modifiers each lost (Fervent Morale, the weapon's team
ATK, the Breach), which pointed straight at the one cast; TAILKEPT's guard names made the before/after count a grep;
`measure --variant <file>:<CONST>=<value>` measured the fight's-end and round limits beside the plain tree in one run.
