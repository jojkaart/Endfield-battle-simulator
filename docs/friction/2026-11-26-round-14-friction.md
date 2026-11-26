# Improvement round 14 itself (2026-11-26)

Task: improvement round 14 over the five open friction reports, every file free (no accuracy agent beside it), the
buffreplay.ts split included; branch worktree-agent-a5e4ed1a5c0c50ba9 on main at 0b094c3. Points already in
docs/friction/2026-11-26-backlog-after-round-14.md aren't repeated.

## 1. No tool splits a module by statement

- **What happened:** the buffreplay.ts split (3,100 lines, 130 top-level statements into six files) had no tool, so I
  wrote scratch/split.ts on the TypeScript AST: statements assigned to files by name, each file the original's import
  block plus imports of the sibling names it references (types as `import type`), `export` added where another file
  reads a name, the other modules' imports from the old file rewritten by where each name went; then `npm run
  prune-unused` for the unused imports, a script to make all-type imports `import type`, one to reformat the engine
  import, scratch/verifymove.ts to check the statements against the original by AST, and scratch/cite.ts to rewrite
  the prose citations "buffreplay.ts <name>" in docs and comments. About 40 minutes, most of it the tooling; the move
  itself was exact on the first run (measure: no log moved).
- **Cause:** prune-unused handles a test file's halves, but nothing does the other half of a split: placing the
  statements and generating the imports, exports and citations.
- **Suggestion:** `node scripts/split-module.ts <file.ts> --to <new.ts>=<name>,<name>… […]` from scratch/split.ts (the
  same steps, prune-unused after, the AST check at the end, `--dry-run` listing the cross-file references), and a
  line in CLAUDE.md's code-layout paragraph that a split is a move checked by `measure --base <ref>`.
- **Files:** scripts/split-module.ts (new, from this round's scratch/split.ts, verifymove.ts and cite.ts), scripts/
  prune-unused.ts (imported for the prune), CLAUDE.md (one line).
- **Why it helps:** the next split (logcheck.ts at 1,480 lines, logcasts.ts at 1,175, views.ts at 1,200) is a
  command and a measure, not an afternoon; the AST check makes "a move only" a fact rather than a claim.

## 2. cli-ab's outputs differ by the other worktree's path

- **What happened:** to show composeCheck changed no record I ran `node scripts/cli-ab.ts HEAD -- zmdlogs hits 0c14
  8915 489c 0eef --json --no-cache`; every one of the 2,353 lines differed, because each record's `fixture` is the
  absolute path, scratch/at/<hash>/fixtures/… on one side. A scratch script (scratch/cmp.ts) dropped the field and
  compared multisets: none differed.
- **Cause:** the other side runs in scratch/at/<hash>/, and outputs that print paths print that root.
- **Suggestion:** cli-ab replaces the other worktree's root with this checkout's in its side's output before
  comparing (a `--raw` to keep them), so path-carrying outputs (hits --json, census's rerun line, measure's files)
  compare as they should.
- **Files:** scripts/cli-ab.ts.
- **Why it helps:** a behaviour-preserving refactor of the records is one cli-ab run; today it needs a script per
  output shape, or the check is skipped.

## 3. Prose citations of a function's file go stale silently

- **What happened:** after the split, docs and comments cited "buffreplay.ts loggedCastStart" and some fifty more
  (in 19 files) for functions now in other files; scratch/cite.ts rewrote them by name, and found three citations
  already wrong before the
  split (buffreplay.ts loggedPoiseBars and loggedStaggerSteps, both in replaysteps.ts; logcasts.ts chainStepFor, which
  no longer exists).
- **Cause:** check-links.ts checks relative links, not "<file>.ts <identifier>" citations (round 5's parked point 7).
- **Suggestion:** check-links.ts (or a test beside it) lists each "<name>.ts `<identifier>`" / "<name>.ts <identifier>"
  citation in docs/ (journal and friction history aside) and packages' comments whose identifier isn't declared in that
  file, as warnings first; a split's tool (point 1) fixes them.
- **Files:** scripts/check-links.ts, tests/ (its test).
- **Why it helps:** an agent following a citation finds the function; this round's fifty were a scripted fix only
  because a split names its moved functions.
- **From:** round 5's backlog point 7 (parked: docs/friction-done/2026-11-22-backlog-after-round-5.md).

## 4. Friction rounds and CLAUDE.md

- **What happened:** round 13 edited CLAUDE.md's views and lead paragraphs; this round's system rules say no agent's
  message authorizes changing CLAUDE.md, so the new views (`zmdlogs decisions`, `hits --against`,
  typecheck-scratch.ts) aren't in its diagnosis sentence; they went to the round summary's "For the lead".
- **Cause:** the process (docs/friction/README.md) doesn't say who edits CLAUDE.md in an improvement round.
- **Suggestion:** a line in the process: a round proposes CLAUDE.md lines in its summary's "For the lead" section,
  quoted as they'd read, and the lead (or the owner) applies them on merge.
- **Files:** docs/friction/README.md.
- **Why it helps:** the views a round builds reach the file every agent reads first, without a sub-agent touching it.

## What worked well

- `measure --base 0b094c3` right after the split: "No log's verdicts moved" in about ten minutes while the next items
  went on; team-ab's identity check for the two record-only engine changes in a minute each.
- The reports' episodes as tests: 8915 111.23 s, 0c14's tail cuts, 489c's sequence 2 each became a test the first
  time the tool ran.
- The new logBuffReplay guard found a real mixed-curve call (`zmdlogs decisions`) on its first run.
- scripts/edit.ts for every multi-block edit (forty batches), the bash guard's refusal naming the safe form.
