# Liino's damage error and her Medicant layers (2026-11-27)

Task: find which of Liino's hits carry her by-operator mean |damage error| (8.5%) and decide from the logs whether
her weapon's Medicant layers listed up to ×9 are real; branch worktree-agent-a9b4402e8672cd4ed.

## 1. The by-operator mean hides that one tiny fight carries a third of it

- **What happened:** the brief chased Liino's 8.5% mean as a kit question. It took a scratch join of
  `zmdlogs totals --all --json` with the snapshots' `operator <id>` keys to see that 0eef alone (a 10 s fight,
  Liino 0.9% of it) gave +57.8%, 3.0 points of the mean, and that her matched landings were within ±0.5% in every
  fight: the whole error was one-sided landings, none of it in her kit.
- **Cause:** docs/accuracy.md "By operator" prints the mean, median and share-weighted mean, but not which fights
  carry the mean, nor the operator's matched / replay-only / log-only split (only the fight-level split exists).
- **Suggestion:** in the "By operator" table add "largest" (the fight and its share of the mean) and the operator's
  matched vs one-sided error (mean over fights of matched% and one-sided% of the operator's own logged total), from
  the totals already computed (enginecheck.ts fightTotals perOperator, onesided.ts). Also a `zmdlogs totals --all
  --operator <op> --own` view: per fight, the operator's error split as % of its own total, its one-sided keys.
- **Files:** scripts/accuracy.ts, packages/logs/src/enginecheck.ts (operator parts), packages/logs/src/views.ts.
- **Why it helps:** a brief for "operator X's error" would start from "kit or one-sided, which fight", saving the
  first hour; a kit agent wouldn't be sent where the cause is a log-check rule.

## 2. The cause sat in another agent's files, and a fix there had already been tried the same day

- **What happened:** both of Liino's fixable causes (the opening before the first logged hit; tailCuts' shown-hit
  guard taking a cast's own last landing for another hit) were in enginecheck.ts / replayrun.ts, the parallel
  agent's files, so they became measured held-back diffs. The tail bug had been found and tried by the
  several-targets round hours earlier (docs/tried/2026-11-27-tail-own-landing.diff, merged into main mid-task); I
  re-derived it, measured it twice, and my first docs/tried file overwrote theirs by name before I noticed
  (`git status` showed M on a file I thought new).
- **Cause:** a brief split by operator (my files: Liino's kit) can't know the cause's file in advance; and
  docs/tried/ is only searchable by file name or prose, not by the function a diff touches.
- **Suggestion:** (a) `node scripts/tried.ts --touching <file>[:<function>]` listing the docs/tried diffs whose hunks
  touch that function (parse the diff headers' `@@ … function` context), and a line in CLAUDE.md's measure paragraph
  to run it before measuring a rule change; (b) docs/tried file names checked for existence in a test or by a
  `scripts/tried.ts new <slug>` that refuses an existing name.
- **Files:** scripts/tried.ts (new), docs/tried/README.md, tests/ (a test over docs/tried names), CLAUDE.md (lead).
- **Why it helps:** two measures (about 25 min of queue and run) and a clobbered file saved; the lead sees the
  second finding as confirmation instead of a duplicate.

## 3. `hits --json` lists a hit's buffs as names only

- **What happened:** deciding "do 9 listed Medicant entries read as 9 layers" needed each hit's entry count and
  sinces. `hits --json` gives `listed` deduplicated by name, so the script joined every JSON line back to its
  fixture by (t, operator, event, value) and counted entries there (scripts/probes/kits/liino-medicant-layers.ts),
  and then derived the implied layer count from the zones by hand.
- **Cause:** the export keeps the check's view (which game buffs are listed), not the listing's counts.
- **Suggestion:** add `listedEntries: {buff: count}` (and the sinces for layered buffs) to the hits export
  (packages/logs/src/hitexport.ts), and a `zmdlogs differences --what <buff> --layers` view: per listed count, the
  layers the value implies (the probe's computation).
- **Files:** packages/logs/src/hitexport.ts, packages/logs/src/views.ts (differences).
- **Why it helps:** a stackingType-11 over-listing question (Liino's, wpn_sword_0012's) is one command, not a
  probe; the check's reading of layered unjudged buffs gets an easy audit.

## 4. TAILKEPT's reason didn't say the "other" hit was the cast's own

- **What happened:** 0eef's TAILKEPT line read "a logged hit of its operator's casts no other cast holds,
  chr_0035_liino_combo_skill at 7.57 s, may be its tail's" — the cast's own first hit. Only applying a measure
  variant locally and re-running `zmdlogs replay` showed that the end guard wasn't the only one keeping it.
- **Cause:** the reason prints the hit's event and time, not whether a cast holds it (and which).
- **Suggestion:** in replayrun.ts tailCuts' keep() for that guard, add "(held by this cast)" / "(held by none)".
- **Files:** packages/logs/src/replayrun.ts.
- **Why it helps:** the bug would have been visible from the first `replay` run.

## What worked well

- `zmdlogs totals --all --json` plus jq / a scratch script answered "which landings carry an operator's error" in
  minutes once I thought to use it; `measure --variant <file>:<CONST>=<v>` separated the two changes in one run.
- Fixtures' `since` fields made the overheal question decidable from the opening (heals before any hit).
