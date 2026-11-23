# Remaining leads: 458b's Laevatain, Rossi's combo_3, 5082's instance, 489c 49.31 s (2026-11-23)

Task: four leads from docs/open-problems.md after the hold-out refresh (base aa938ce): 458b's Laevatain total since
74bc686, Rossi's two combo_3 dilations, Xaihi's weapon instance 1.67 s late in 5082, 489c's hit at 49.31 s. Branch:
the worktree agent-a4fcd0b9893bfb925.

## 1. A "total" regression has no view that names the landings behind it

- **What happened:** 458b's Laevatain total went 9.0 → 11.3% at 74bc686, but `zmdlogs hits` (per logged hit) showed
  every moved hit getting *closer* to the log. The cause was the totals' other half: replay-only landings (two finisher
  hit_2 landings, 507k) that an under-prediction had hidden. Finding them took a full `zmdlogs replay` dump, a grep for
  "replay only" and hand arithmetic; the snapshot's `kind basic 19.4%` was the only hint.
- **Cause:** enginecheck.ts `checkTotals` sums matched and unmatched landings, but nothing prints its parts. The
  per-hit views only cover logged hits.
- **Suggestion:** `efsim zmdlogs totals <fixture> [--operator <op>]`: the simulated total split into matched landings
  (predicted vs logged) and replay-only landings, each replay-only landing listed with its damage, largest first; with
  `cli-ab.ts` it answers "which landings moved the total" in one command.
- **Why it helps:** a total that moves while the hits improve is a compensating error by construction; this makes the
  other side visible at once. Cheap: the numbers already exist in checkTotals.

## 2. The view's INSIDE flag mixes two things

- **What happened:** after making the ultimate go through the finisher's disable-cast frames, `zmdlogs replay` still
  said "INSIDE ... 20 frame(s) before power_attack lets it start (its uncuttable frames ...)". castFlag (buffreplay.ts)
  calls earliestStart without `at`, which waits for the current cast's own hits, so the flag also fires on a legal
  interrupt that cancels pending hits. I spent a while checking whether my change had taken effect.
- **Cause:** castFlag's wording says "uncuttable frames", its test is "the earliest start without interrupting".
- **Suggestion:** judge the flag with `earliestStart(..., { at: f })` (the gates only) and, separately, report "cuts N
  pending hits of <skill>" when the new cast cancels landings. Both are useful; they're different facts.
- **Why it helps:** the flag is the first thing one reads in a replay dump; a flag that means what it says saves a
  detour per task. Risk: views tests that count flags change.

## 3. The log tools' stop lists and the engine's timeline were two models of the same thing

- **What happened:** 489c's casts view showed a 0.42 s stop of Rossi's combo_3 at 58.97 s, 7 s after the cast and
  after her battle skill: the frame-212 slow-down of the late path, listed on the perfect path that ends at 211.
  The engine never applied it (casting.ts plannedSlowdowns honours ends and jumps); logcasts.ts skillStops took every
  SkillTiming slow-down at its own frame. Pogranichnik's and Purrchena's combos had the same problem.
- **Cause:** the stop rule lived twice (the engine's plannedSlowdowns, the logs' skillStops). Round 7 unified the logs'
  builders but not the logs with the engine.
- **Suggestion (done in part):** `pathSlowdowns` (clock.ts) is now the one rule, used by both; the logs side decides
  the path from the cast's landings (logcasts.ts pathOf). Still worth doing: let the replay record the slow-downs its
  timeline actually applied (TimelineState history) and have replayedCastStops read them, so a cast cut early or a
  kit trigger's jump is reflected too.
- **Why it helps:** every hold bound and world-time view rests on these lists; one source removes a class of
  "the view disagrees with the engine" bugs.

## 4. A lead's premise wasn't checked against the curves

- **What happened:** the brief said one of Rossi's combo_3 dilations replacing the other would hold "7 frames less,
  ~0.23 s, matching 0.15–0.2 s". The 7 frames were the dilations' lengths (19 − 12); the held time differs by 1.5–2.2
  frames because the combo curve ramps up from its frame 8. Finding that needed a scratch script to print the scales.
- **Cause:** `efsim gamedata dilations` lists each dilation's kind and priority, not its compiled scales or the world
  frames it takes.
- **Suggestion:** add the held frames (Σ(1 − scale)) per slow-down to `gamedata dilations` and to `efsim kit`'s
  "slow-downs from frame …" line, and, for a skill with several, what they hold together at the lowest scale.
- **Why it helps:** a hypothesis about slow-downs can be sized in one command before anyone builds it.

## 5. Measuring one half of a change needs a manual edit-and-revert

- **What happened:** to see whether the hold-outs' −0.3 pt came from the placement's stop list or the replay's, I
  edited three call sites, queued `measure`, waited for the snapshot and reverted by hand.
- **Cause:** no switch between the two stop lists' behaviour; measure's `--variant` only takes registered assumptions.
- **Suggestion:** a log-check assumption for the log tools' own rules where a change has a clear old/new reading (here
  `stop-path`: `landings` / `all`), so `measure --variant` separates them without edits.
- **Why it helps:** less risk of committing a half-reverted tree; the split shows in one run.

## What worked well

- `node scripts/cli-ab.ts <ref> -- zmdlogs replay <fx> --operator <op>` found the moved landings in one call.
- `zmdlogs holds --why <regex>` explained each instance's verdict in words: the 5082 fix was designed from it.
- `measure --hits` and `--base HEAD` made each step's effect clear in about two minutes; team-ab's identity check
  ended quickly.
- scripts/probes/corrosion/ramp-pairs.ts was easy to copy into scratch/ and extend with rules.
