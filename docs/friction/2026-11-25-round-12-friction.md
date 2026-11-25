# Improvement round 12 itself (2026-11-25)

Task: improvement round 12 over the four open friction reports, with the replay, compiler, check core and engine free;
the worktree branch of `agent-a5b4c1ebefee68785`, on main at cdf8b2d. Points already in
docs/friction/2026-11-25-backlog-after-round-12.md aren't repeated.

## 1. A view a change adds can't be compared at an older commit

- **What happened:** the holds' pins were the tool for "why did 489c's units move across 4188729", but `node
  scripts/cli-ab.ts 4188729^ --holds 489c` runs the old commit's own `holds --verbose`, which has no pins: the "was"
  side would have shown nothing to compare. I added `cli-ab --patch <diff>` (the view's diff applied on the old code
  in its own scratch/at/<hash>-patched worktree) before the A/B could answer.
- **Cause:** cli-ab and at-commit compare a command's output across code, and a new diagnostic is, by construction,
  absent from the old code. Nothing in the docs said how to see a new view on the old side.
- **Suggestion:** done this round (cli-ab `--patch`, its usage, docs/design/data.md's question row). Left: when a view
  file's diff doesn't apply on the old commit (the view moved since), say which hunk failed and that `--patch` wants a
  diff of the view files only (`git diff <base> -- packages/logs/src/views.ts …`).
- **Why it helps:** every new diagnostic is first used on an old episode; without it the first A/B is blind on one side.

## 2. Two pairings of casts between placements

- **What happened:** settleCheck (a third placement pass against the final one) paired each cast with the nearest of
  its key in the third pass; 9a80's Rossi battle skills then read as five moved casts when one had gone (each took its
  neighbour's start). I rewrote it to pair the casts that stay first, then the moved ones. Afterwards I found
  scripts/measure.ts `movedCasts`, which already pairs casts between two placements for `measure --changed placement`.
- **Cause:** the pairing lives in a script, not in packages/logs, so a library function can't reuse it and a search for
  "pair casts" in packages/ finds nothing.
- **Suggestion:** move `movedCasts`' pairing into packages/logs/src/logcasts.ts (`pairCasts(a, b)`: kept, moved with
  both starts, gone, new), used by measure and settleCheck; one test of the 9a80 shape.
- **Why it helps:** one pairing, tested once; the next comparison of placements (a third-pass measure, cli-ab on
  casts) gets it right the first time.

## 3. Which strings are keys, and which are only text

- **What happened:** the drop reasons had to go somewhere visible, and the obvious place was the `unknown` of
  BuffReplay.landing ("a landing the replay didn't land"). Before changing it I grepped: onesided.ts puts it into a
  one-sided landing's `context`, which the totals' kinds group by, which the snapshots' share keys and measure's
  hold-out kind table carry. Changing the text would have changed every snapshot's kinds without a verdict moving. I
  kept the text and added `droppedLanding` beside it.
- **Cause:** reason strings double as grouping keys (contexts, kinds, verdict reasons) with nothing marking which do.
- **Suggestion:** name the reason strings that are keys as constants in one module (`NO_LANDING = "a landing the
  replay didn't land"`, the one-sided contexts), with a comment that changing one changes the snapshots' share keys;
  views add detail beside them, never into them.
- **Why it helps:** a view change can't move a snapshot by accident, and an agent sees at the constant what it keys.

## 4. The hold-outs' blindness rules are in a round write-up

- **What happened:** the brief asked for a per-kit split of the hold-outs' aggregates "as blind as the lead decided in
  round 9". The decision is a paragraph of docs/friction-done/2026-11-23-round-9.md ("which operators the moved
  hold-outs have tells what the hold-outs contain; the field kinds stay"); I found it by grepping "field kinds".
- **Cause:** what a hold-out output may say is a standing rule, but it lives in a round's history, and CLAUDE.md says
  only what not to open.
- **Suggestion:** a short "What a hold-out output may say" list in docs/design/tests.md (counts per group and
  direction, field kinds, the kinds table's means; never a log id, an operator, a weapon or gear set, or anything per
  kit), cited from scripts/accuracy.ts `--compare` and measure's hold-out lines.
- **Why it helps:** the next tool that touches hold-outs is checked against a list, not a search.

## 5. buffreplay.ts is one 2,900-line file

- **What happened:** the skip reasons, the drop watch, the trigger traces and the enemy-HP label all went into
  packages/logs/src/buffreplay.ts; each needed an outline by grep (`^function`, `^export`) to find replayOnce,
  makeCast, replayedSkill and the BuffReplay object, which are 1,500 lines apart.
- **Cause:** the cast assembly (assembleCasts and its eight passes), the per-step replay loop (replayOnce, makeCast,
  replayedSkill, missedCasts), the holds' inputs (runBounds, heldToLoggedEnds) and the BuffReplay answers (landing,
  castFacts) share a file.
- **Suggestion:** split by those four: castassembly.ts (assembleCasts and the passes it chains), replayrun.ts
  (replayOnce, makeCast, replayedSkill, missedCasts, landingWatch), holdinputs.ts (runBounds, loggedLaneEnds,
  heldToLoggedEnds), buffreplay.ts (replayKitBuffs and the BuffReplay interface). A move only: snapshots:update "No
  log's verdicts moved", lint's import rule for the new files.
- **Why it helps:** the replay's decisions, the most-edited code of the accuracy rounds, are findable by file name.

## 6. edit.ts's append block

- **What happened:** my first end-append batch (`<<<<<<< end`, the new lines, `>>>>>>>`) was refused: the block needs
  a `=======` line after `<<<<<<< end`. The message said exactly that; one rerun.
- **Cause:** habit from the replace blocks, whose old text sits between `<<<<<<<` and `=======`.
- **Suggestion:** accept an end block without `=======` (nothing to replace, so the separator is redundant).
- **Why it helps:** one refusal less per round; the format stays unambiguous.

## What worked well

- `cli-ab` with the new `--patch` answered the remaining-leads report's costliest question in one run.
- `zmdlogs stops --all --differ` by cli-ab proved the replay-decision change for the views identical in four minutes.
- Writing the new backlog first and `friction.ts outcomes --backlog` filled every carried outcome on the first pass.
- The bash guard's refusals each named the safe form (four this round).
