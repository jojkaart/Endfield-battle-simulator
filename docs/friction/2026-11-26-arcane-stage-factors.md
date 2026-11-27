# Arcane's mismatches: stage factors (2026-11-26)

Task: the accuracy agent's brief "Akekuri's mismatches" (the by-operator row chr_0032_lizhiyan: 5688 hits, 12.3%
mismatch), grouped and fixed; base main 7e6c12f, its worktree branch.

## 1. The brief named the wrong operator

- **What happened:** the brief said "Akekuri (chr_0032_lizhiyan)", Thermite Cutter and her gear as my files. The id,
  the numbers and the kit file are Arcane's; Akekuri is chr_0019_karin (2 fights, no mismatch) and Thermite Cutter is
  her weapon. Ten minutes to notice (`efsim find --operators`) and decide which half of the brief to follow; the file
  list (Thermite Cutter's kit "mine", Arcane's weapon and gear not listed) no longer matched the work.
- **Cause:** docs/accuracy.md's by-operator table names operators by id only, so a lead copying a row has to turn the
  internal name into a display name by hand, and "lizhiyan" reads like no one's name.
- **Suggestion:** give the table a name column (scripts/accuracy.ts perOperator from `data.operators[id].name`, as
  `zmdlogs offsets` prints them), e.g. "chr_0032_lizhiyan (Arcane)".
- **Files:** scripts/accuracy.ts, docs/accuracy.md (generated).
- **Why it helps:** a brief taken from the scoreboard names the right operator; no cost.

## 2. The stage logs were "out of scope" in four docs, never measured as a fixture input

- **What happened:** 492 of the 697 mismatches were 8915's and c6d8's stage factors, which docs/open-problems.md,
  the misprediction analysis and buildoffsets.ts OFFSETS_EXPLAINED all set aside ("not the totals' to fix", "not
  modelled") since 2026-11-15; a fixture field for them took an hour and moved development mismatch 10.2 → 6.9%.
- **Cause:** a log-read input was only thought of as a simulation feature (the shields need data the project lacks),
  and each later round copied "out of scope" from the last. The fixture already had the precedent (buildOverrides:
  hand-written, from the hits, with evidence).
- **Suggestion:** in docs/open-problems.md's header, one line: "an effect no table has but the log shows on every
  operator's hits at once (a stage factor, a build input) is a fixture field with its evidence, not out of scope",
  pointing at docs/design/data.md's fixture paragraph; and `zmdlogs offsets` could print a line when one window holds
  every operator at one round factor (the probe scripts/probes/stage/stage-factors.ts as a view).
- **Files:** docs/open-problems.md, packages/logs/src/buildoffsets.ts (offsetsView), scripts/probes/stage/stage-factors.ts.
- **Why it helps:** the next stage log (Hard 33's slug, a hold-out's stage) is checked from its import on, not after
  months of being "explained".

## 3. The replay's LAND lines and the check's numbers disagree under a fixture-level factor

- **What happened:** after the factor, `zmdlogs replay 8915` printed `67014 = logged 32458` beside plain matches; I
  added the staged value to the LAND line (views.ts), but other views printing a landing's own damage (`casts`,
  `totals` parts, `bursts`) still show the unfactored value.
- **Cause:** a landing's printed damage is the replay's `l.damage`, not the check's reading; every log-level input (a
  stage factor, a log-only buff) is applied in enginecheck.ts only.
- **Suggestion:** one helper in enginecheck.ts, `checkedDamage(c, landing, hit?)`, that views call for a landing's
  value, so a fixture input shows the same everywhere.
- **Files:** packages/logs/src/enginecheck.ts, views.ts, burstsview.ts, onesided.ts.
- **Why it helps:** no diagnosis reads a ×2 that the check doesn't have.

## What worked well

`zmdlogs groups --operator` split the 697 into logs and causes at once; `hits --all --json` plus a 40-line scratch
script found every round factor in every log; `measure --base` and `snapshots:update` agreed and said which logs moved;
`node scripts/edit.ts` for the doc batches.
