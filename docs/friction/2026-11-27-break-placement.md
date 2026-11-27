# Casts across a Stagger break (2026-11-27)

Task: find the casts the hold at a Stagger break lengthens past the next press (the hold-outs' INSIDE), decide from
the logs what a press during the hold does, implement and measure; branch worktree-agent-ace557489cbd19f7c.

## 1. The placement had no way to take a reading, and the readers test only says which id was defaulted

- **What happened:** the held-start rule needed the breaks' holds in logcasts.ts placeWith, which depend on
  `break-hold` and `break-hold-place`. placeHits(data, fx) takes no readings, so the first version read the defaults;
  tests/assumption-readers.test.ts then failed with "[ 'break-hold', 'break-hold-place' ]" defaulted, and nothing said
  which call path read them. I wrote scratch/trace.ts (traceReadings with a stack slice per defaulted read) to find
  that checkLog places the hits again itself (logcheck.ts `const placement = placeHits(data, fx)`) although
  composeCheck already holds one. Threading `assume` through placeHits, placementPasses, settleCheck, logBuffReplay's
  fallbacks, composeCheck and five views, and a `placement` option on checkLog, took about 40 minutes.
- **Cause:** the placement was reading-free by construction, and the run check reports only the ids, not where they
  were read; checkLog's own placement is a hidden second placement of the same fight.
- **Suggestion:** have defaultedReads (tests/helpers/readings.ts) record the first stack frame outside the engine for
  each defaulted id and print it in the assertion message; make checkLog's `placement` option required wherever a
  replay is passed (or take it from the replay: LogBuffReplay could carry the placement it was made from).
- **Files:** tests/helpers/readings.ts, packages/logs/src/logcheck.ts (checkLog, LogBuffReplay)
- **Why it helps:** the next reading a log tool takes is located in one run instead of a hand-made trace, and the
  check can't silently re-place a fight under other readings than its replay's.

## 2. The same hold-out moved by every variant, and nothing a blind agent can do about it

- **What happened:** three measures (about 25 minutes of queue and run) of four shapes of the held-start rule: every
  one moved the same hold-out by plain −6 (unquantified +3, fallback +1, mismatch +2) and "no decision kind's count
  moved". The two tried diffs of the round before had hit the same wall. I could not tell whether the rule or the
  hold's place there is wrong, so the reading stays off with its case documented.
- **Cause:** for a hold-out whose decisions don't move, measure says nothing about what moved: which kind of cast
  (combo, basic, battle), how far its start moved, whether it sat inside a combo's slow-down or next to an ultimate.
- **Suggestion:** for the moved hold-outs, print the placement's moved casts as counts by kind and by bucket of
  shift (frames), and the breaks near them by class (outside a stop, in a combo slow-down, at an ultimate's edge),
  never times or operators: measure.ts beside "The moved hold-outs' replay decisions".
- **Files:** scripts/measure.ts, packages/logs/src/castpairs.ts (pairCasts already pairs the casts)
- **Why it helps:** a placement rule's hold-out loss could then be traced to a class of cast ("2 combos moved 14
  frames, both at breaks inside a combo slow-down") and the rule narrowed, instead of dropped blind.

## 3. A variant's numbers must be derived by hand when the reference isn't the plain tree

- **What happened:** with stale snapshots, measure measured the merge base as `--base` and printed each variant
  against the base and against the plain tree, but not the plain tree against the base. The question "what does my
  tree do" had to be worked out as the inverse of "variant against plain" combined with "variant against base"; I
  misread it once (took the variant's moves for the tree's).
- **Cause:** with `--variant`, the plain run's own summary against the reference is skipped.
- **Suggestion:** print the plain tree's summary against the reference first whenever variants are given (it is
  measured anyway).
- **Files:** scripts/measure.ts
- **Why it helps:** one block answers the main question; the variants then read as deltas.

## 4. `--set` takes a string constant only with quotes inside the argument

- **What happened:** a mode constant (`const X: string = "others"`) needed `--variant 'file:X="any"'`; the first
  form I wrote without the inner quotes would have put a bare identifier into the source. It worked once quoted, but
  only by guessing that the value is pasted verbatim.
- **Cause:** --set's help says "set to the value" without saying it is source text.
- **Suggestion:** one line in measure's usage: "the value is source text: a string needs its quotes,
  `--set 'f.ts:MODE="a"'`".
- **Files:** scripts/measure.ts (its usage header)
- **Why it helps:** saves a failed queue (or a silent compile error) per string constant.

## What worked well

- `zmdlogs decisions --all --assume break-hold=none` named the four development INSIDE flags the hold makes in one
  run; `cli-ab.ts <ref> --placement` and `-- zmdlogs decisions --all` showed each rule's moved casts and decisions in
  a minute, before any measure.
- `--variant <file>:<CONST>=<value>` measured four shapes of a rule against one plain tree in one queue.
- The run check (tests/assumption-readers.test.ts) caught the defaulted reads at once.
