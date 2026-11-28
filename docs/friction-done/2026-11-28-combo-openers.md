# Combo openers inside a combo's own slow-down (2026-11-28)

Task: the combo-windows lead's 12 INSIDE lines whose window opener was logged inside the combo's own slow-down, and
3f78 19.30 s (Arcane's combo before her cooldown); a worktree branch from main at 400bb44.

## 1. Moving a pinned landing loses what the log keyed to its frame, silently

- **What happened:** the first rule re-pinned the openers at the press frame (docs/tried/2026-11-28-opener-landed-at-press.diff).
  The replay view then showed Estella's Cryst reaction at 9168 against the logged 13752: the reaction's logged crit
  was gone. The engine looks a non-pinned landing's logged crit, logged modifiers and logged reaction level up by
  frame, within one frame of the logged hit (landing.ts loggedCritAt, loggedModifiersAt, withLoggedReactionLevel);
  a landing moved more than a frame takes none of them, with no warning. The measure was the first signal (hold-outs
  plain −1.7 points), and finding why took a `cli-ab --zones` run and reading landing.ts.
- **Cause:** a landing's logged facts are matched by frame for the landings a trigger makes (a reaction, a burst),
  and nothing says so where a landing's frame can be changed (pinAt, pinLanding, a replay rule's re-pin).
- **Suggestion:** a pinned hit carries its logged frame (`loggedFrame`, from pinAt) and the reactions and triggered
  hits it sets off take their lookups from it; or at least a check in the replay (debug) that every logged crit /
  reaction level found a landing within a frame (a count in `zmdlogs replay`'s header: "n logged crits no landing
  took").
- **Files:** packages/engine/src/timeline/landing.ts (loggedCritAt, withLoggedReactionLevel), drivers.ts (pinAt),
  packages/logs/src/replayrun.ts.
- **Why it helps:** a replay rule that moves a landing would see what it dropped before a measure.

## 2. "Is this combo's cooldown right?" has no view

- **What happened:** for 3f78 I wrote three scratch scripts (combo gaps per operator, readyAt over a window, the
  cooldown frames per log through skillCosts, and the gear left out one at a time) to learn that 8915's 12 s cooldown
  is its stage's, c779's short gap Si's ultimate, and that 22 combos in the development logs are made before the
  replay's own cooldown (scripts/probes/placement/combo-cooldowns.ts). The INSIDE flag shows only the casts inside a
  running action's uncuttable frames, so 4d60 97.00 s (Arcane 1.13 s early) was never flagged; the open-problems
  note had read it as "a gap the replay allows".
- **Cause:** the replay forces every logged cast and records a cooldown breach only through castFlag's `inside`
  branch; skillAvailable doesn't check the cooldown, and no record says "made before its cooldown".
- **Suggestion:** a COOLDOWN decision line (replayrun.ts castFlag or makeCast: the skill's readyAt past the frame, by
  how much, and the reductions that ran since its last cast: Si's slot, a stage's scalar), counted in `zmdlogs
  decisions`; the probe's logic is the start.
- **Files:** packages/logs/src/replayrun.ts, decisionsview.ts, packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** a cooldown question becomes one command, and the early presses (12 across 11 operators) a lead
  of their own.

## 3. The brief's suggested rule and a "placement lead" pointed at files that weren't the fix

- **What happened:** the lead named this a placement lead (logcasts.ts) and suggested re-placing the landing; the fix
  that measured clean was in the replay (replayrun.ts makeCast: the window's facts at the press), a file "to touch
  with a note".
- **Cause:** open-problems' "Still possible" named a mechanism (where the landing goes) where the evidence only
  decided the order; the question the brief said was at stake (the window's count and source) was a replay one.
- **Suggestion:** a lead's "Still possible" names the smallest state that differs (here: the window at the press)
  beside the mechanism, so the brief's file list covers both.
- **Files:** docs/open-problems.md (the convention's paragraph at its top).
- **Why it helps:** the first attempt goes at the state that matters, not the most invasive way to get it.

## What worked well

- `zmdlogs decisions <fixtures…>` and the INSIDE line's own words ("an opener logged inside it") put the 12 cases
  and their facts on one screen; `casts --event-lags --operator Estella --verbose` found the four off events at once.
- `measure` naming the hold-outs' moved decision kinds (INSIDE −2) and the tried-diff workflow made dropping the first
  rule cheap.

## Outcome (round 24)

- 1 (Moving a pinned landing loses what the log keyed to its frame, silently): done (273c677): lostfacts.ts lostFacts
  (a logged hit whose crit the log or an inference gives, paired with a landing that didn't take it; a reaction level
  the replay was made with, BuffReplay.reactionLevels, that no reaction landing took), LOST decision lines with the
  fixture (`zmdlogs decisions`, measure's decision counts) and in `zmdlogs replay` with a count in its header. The
  loggedFrame on pinned landings (the suggestion's first form) not built: a lookup by ref already covers a pinned
  landing's own crit, and the trigger-made landings it would need to follow aren't pinned. The tried diff
  (opener-landed-at-press) doesn't apply on HEAD any more (openerAhead replaced its function), so the episode itself
  wasn't rerun.
- 2 ("Is this combo's cooldown right?" has no view): done (8b932fc): replayrun.ts cooldownEarly, MadeCast.early,
  COOLDOWN lines (how early, the last cast's cooldown, how far readyAt moved since), counted by cast kind; with
  `efsim kit`'s costs and `replay --windows`.
- 3 (The brief's suggested rule and a "placement lead" pointed at files that weren't the fix): done (0a1efea):
  docs/open-problems.md's head: a "still possible" names the smallest state that differs beside the mechanism;
  `node scripts/lead-files.ts <term>` prints a term's earlier commits by family (replay, placement, …).
