# Placement cases: the Decisive Assault, f574's split Mi Fu cast, the log-only casts (2026-11-28)

Task: work three placement leads from docs/open-problems.md (Pogranichnik's Decisive Assault timing; f574's one Mi Fu
Trail and Mangle on two slugs placed as two casts; the placement's log-only casts f879 95.10, 5082 45.06, 3aa6 125.65
s), fix what a mechanism explains; branch of worktree agent-a7166e8bdab3832d6 from main at 2f4afbd.

## 1. A brief's lead that open-problems already marks fixed

- **What happened:** lead 3 named f879 95.10, 5082 45.06 and 3aa6 125.65 s as "the placement's log-only casts". All
  three were fixed on 2026-11-27 (open-problems' "The placement cases the one-sided rounds left" says so in its
  "Found and fixed" list; the "Log-only landings" section's cause list still names them as open). Checking each by
  `zmdlogs replay` and reading both sections took about 15 minutes before the real question ("what is still log-only
  today") could start, which then took a `zmdlogs totals --all --json` run and a jq ranking.
- **Cause:** a case fixed in one section of open-problems.md stays listed as open in another; the brief was built
  from the stale one. Nothing ties a case's mentions together.
- **Suggestion:** a line in the open-problems rule ("A fixed item shrinks to one line naming its journal entry")
  extended to every section that lists the case: `node scripts/check-links.ts` (or a small check of its own) could
  flag a fixture time (`f879 95.10 s`) named both after "Fixed" and in a list of open causes. And a ready ranking:
  `zmdlogs totals --all --kinds --side log --top n` printing the largest log-only landings with their context, the
  jq line this task wrote (`select(.side=="log" and .severalTargets!=true) | [.share, .fight, .t, .operator, .key,
  .context]`).
- **Files:** docs/open-problems.md, scripts/check-links.ts, packages/logs/src/onesided.ts (the totals view).
- **Why it helps:** a lead's brief starts from what is open today; the ranking answers "what's left" in one command.

## 2. A cast's slots run across a multi-path skill's other paths

- **What happened:** de6a 132.20 s: Pogranichnik's combo slashes (no cast events in de6a) were joined to a combo 23 s
  earlier, "joined: span, 17.64 s after the cast's first landing". The combo jumps at frame 0 to 200 / 400 / 600; its
  slots list every path's hits (frames 23, 37, 61, 223, 237, 261, ...), so the span from slot 0 was 21 s. Finding it
  took reading placeWith's join conditions (span, toCome, longest) and the kit's jumps; fixed with logcasts.ts
  pathEnd / pathStart.
- **Cause:** slotsOf builds one slot list per key over all paths; the path is decided elsewhere (valuePaths,
  jumpedFirst, pathTwin) and never cuts the list. A Slot carries no path.
- **Suggestion:** slotsOf returns slots tagged with their path (the jump destination they lie past and the skill's
  end on it, SkillTiming.ends), and the placement keeps only the chosen path's slots for a cast from its first landing
  on; pathEnd becomes that tag's reader.
- **Files:** packages/logs/src/logcasts.ts (slotsOf, placeWith, pathEnd).
- **Why it helps:** every jump-pathed skill (Pogranichnik, Rossi's combo 3, Purrchena's shielded combo, Laevatain's
  battle skill) gets per-path spans without a rule per case.

## 3. A value rule can't run where a multiplier is an expression

- **What happened:** 8f32 36.11 s: Rossi's combo 2 hit_2 (12,877, its hit's value) was placed as a combo 3 perfect
  strike (×9 in the replay), whose Lift then came 2.4 s early and lost the Endministrator's 38.50 s crystal shatter
  (−1.28% of the fight). A rule keeping the hit on the open cast by its value (next slot's multiplier fits, the other
  group's doesn't) was written and dropped: Group.scales and ranges have nothing for perfect (`atk_scale_s +
  damage_add × consumed`), so no value rule can tell the two apart.
- **Cause:** nominalScale gives a number only for a plain scale, ranges only for event counts; a `consumed` term
  (and other state terms) leaves the hit unknown, and every value rule (sameByValue, nextByValue, nextDiffers) skips it.
- **Suggestion:** a lower and upper bound per kit hit's multiplier (the expression at its state terms' least and most:
  consumed 0 to its stack's cap), as `bounds` beside scales/ranges in groupsOf; value rules use the bounds where the
  point is unknown (a value below the other hit's least multiplier rules it out).
- **Files:** packages/logs/src/logcasts.ts (groupsOf, nominalScale, the value rules).
- **Why it helps:** Rossi's combos, Zhuang Fangyi's Sunderblade finals and every consumed-scaled hit become
  decidable by value, where today they fall to time alone.

## 4. worldMs compared with `===` fails on thirds of a millisecond

- **What happened:** the first byTime rule checked `worldMs(a, b, stops) === due`; both were 233.33 ms but one by a
  float path (233.33333333333212 against 233.33333333333334), so the rule never fired and the first measure measured
  nothing new. A debug print found it.
- **Cause:** worldMs subtracts msOf(held frames) from a ms difference; frames at 30 fps are thirds of a ms.
- **Suggestion:** a `heldMs(from, to, stops)` (the hold alone, 0 exactly where no stop covers the span) or worldMs
  returning to − from untouched when no frame is held (it does only when no stop is relevant at all), and a lint or
  comment on `=== worldMs(`.
- **Files:** packages/logs/src/logcasts.ts (worldMs).
- **Why it helps:** "no stop in this span" is a frequent question; asking it as a hold of 0 can't fail on rounding.

## 5. A TimeDilationAction's inline curve has no view

- **What happened:** the Assault's own slow-down needed its curve evaluated; the only evaluator was
  scripts/probes/entities/harass-slowdown.ts with the harass's keys hard-coded, so the finish4 keys were copied by
  hand from `gamedata tree` (now the probe's `finish4` argument).
- **Cause:** the engine evaluates inline curves (Hermite) but nothing prints a curve's effect for an action in the
  data.
- **Suggestion:** `efsim gamedata curve <SkillData id> <timelineAction index>`: the curve's mean scale over its
  duration and when a given frame of the owner's timeline comes in real time (what the probe prints), from the
  engine's own curve code.
- **Files:** packages/cli/src/commands/gamedata.ts, packages/engine (curve evaluation export).
- **Why it helps:** entity and buff slow-downs come up in every entity-timing lead (harass, Assault, Typhoeus's
  array); one command instead of a probe per entity.

## What worked well

- `node scripts/cli-ab.ts HEAD -- zmdlogs casts <fixture> --choices`: which landings a placement rule moved, per log,
  in one command; it showed the byTime rule's other effects (9c6e's array, 7b54's attack 2) at once.
- `zmdlogs casts --choices` with the twin rule in words, and scripts/probes/sp/shortfall.ts for the SP effect.
- `measure --several-targets` (10 s of work for a change gated on the mark).
