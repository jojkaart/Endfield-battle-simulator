# needed on the check's pairing, a channel's end in a detached file (2026-11-28)

Task: the accuracy list's entries "cutTails' `needed` on the replay's own pairing" and "a capped channel inside a
detached file" (docs/friction/2026-11-27-backlog-after-round-21.md), on branch worktree-agent-a8a05e803619ac159.

## 1. A rule's first measure moved the hold-outs, and finding why took a debug print in the code

- **What happened:** loggedShown on pairKitLandings alone moved one hold-out by 0.9 points of mean |damage error|
  (5.9 → 6.8%) through one kept tail (`TAILKEPT +1, TAILCUT −1`). On the development side the same shape was 4a64,
  9847 and c83c (`cli-ab.ts HEAD -- zmdlogs decisions <id>`: a new `needed` line each). `zmdlogs decisions --why-kept
  c83c` showed the kept tail's landings standing for four logged hits at 47.17 s, and that with the cut they paired
  elsewhere, plain either way: it didn't say why cutTails' own round had found a hit lost. I added a temporary
  `DEBUG_NEEDED` stderr print in cutTails (both runs' pairings of the lost hit and the landings near it) to see that
  the lost hit was logged before the cut and paired with the tail's unlogged landing in the main run only. Three runs
  and an edit to revert.
- **Cause:** a TAILKEPT `needed` line names the lost hit, but not which landing the main run paired it with, nor that
  the hit lies before the cut; the counterfactual view (`--why-kept`) composes the final cuts, not the round's run in
  which cutTails decided, so the two can disagree.
- **Suggestion:** carry the lost hit's pairing in TailKept.cites for `needed` (its landing in the run before: skill,
  hit, frame, pinned or not; and in the cut run: none or which), printed on the TAILKEPT line: "lost 47.17 s attack4
  (paired with attack4 hit @47.50, unpinned, the tail's own)".
- **Files:** packages/logs/src/replayrun.ts (cutTails, TailKept), packages/logs/src/decisionsview.ts.
- **Why it helps:** a kept tail's evidence is read on the line, without a counterfactual run or a debug edit; a tail
  kept by its own landing shows itself at once.

## 2. A kit field the loader fills from the data had no way to be left out

- **What happened:** item 2 asked to drop the compiler's filter "only where the data and logs agree": Typhoeus's
  Barrage Array disagrees. The loader's `dataOverride` mechanism was the natural place, but `latest` wasn't a
  DataField (kitMatch.ts DATA_FIELDS, MatchHit, the schema's enum, and the comparison in matchSkill: four places to
  find and change). The typecheck caught MatchHit after the first try.
- **Cause:** a new HitFacts field (round 21's `latest`) was added to hitFacts and withDataFacts without joining the
  DataField list, so it was filled but couldn't be marked or checked; nothing ties HitFacts' keys to DATA_FIELDS.
- **Suggestion:** a type-level check that every HitFacts key is a DataField (`keyof HitFacts` ⊆ `DataField`, e.g. a
  `satisfies` on DATA_FIELDS or a test reading both), and the schema's enum generated from or tested against
  DATA_FIELDS.
- **Files:** packages/data/src/kitMatch.ts, schemas/kit.schema.json, a test (tests/kits.test.ts).
- **Why it helps:** the next filled field can be marked and checked from the start; a lagging schema is caught.

## 3. The measure queue: four jobs of one agent wait behind each other

- **What happened:** I queued measure (the change), measure (the filter alone), measure (item 2), smoke and team-ab
  within ten minutes; they ran one after another behind the shared lock, about 40 minutes in all, while each took 2–4
  minutes of work. Three of the measures were of the same 74 logs with patches on one base.
- **Cause:** each measure is its own lock job and its own base run; `--variant` covers readings and constants but not
  patches, so two patches on one base can't share the base run.
- **Suggestion:** `measure --variant-patch <diff>` (repeatable) beside `--variant`: each patch measured against the one
  base run in the same job.
- **Files:** scripts/measure.ts.
- **Why it helps:** an A/B of two halves of a change costs one queue slot and one base run.

## What worked well

`cli-ab.ts HEAD --placement --summary` named the six split Typhoeus combos in seconds, before any measure; `tried.ts
new` from a temporary working-tree edit made the dropped variant's diff in one step; `measure --at HEAD --patch` let
each half be measured while I went on editing.
