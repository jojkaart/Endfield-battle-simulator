# Crits from values, Combustion ticks, batched landings (2026-11-23)

Task: four accuracy leads after the hold-clocks round (5082's regression, 458b's Wulfgard Combustion ticks, a battle
skill's hit logged at another cast's stop's end, Rossi's combo_3 dilations), on worktree-agent-a3ad6bb0b9047583b from
main at 8daa9e9.

## 1. The brief's diagnosis named the wrong buff, and no view said which zone moved

- **What happened:** lead 1 said "a missing second layer of Arcane's weapon Arts DMG Taken (listed ×2)". `zmdlogs
  differences` listed `wpn_funnel_0008.arts_taken | other values` with ratio 1.18 on exactly those hits, which looked
  like confirmation. Only dumping `hits --json` before and after (old code via `scripts/at-commit.ts`), and diffing
  each zone by hand in a Python one-off, showed `damageTaken` identical (1.216) and `atk` 4073 → 3452: the cause was
  Xaihi's weapon team ATK, and on Yvonne's finisher MI Security's five layers. About an hour.
- **Cause:** `differences` groups by "a listing differs" and reports the group's ratio, not which zone of the reading
  differs; a group whose listing differs for an unrelated reason (the engine merges two layers into one entry, so
  `engine []` vs `log [damageTaken 0.216]`) carries the ratio of whatever else moved.
- **Suggestion:** a `zmdlogs hits <fx> --at <ref> --zones` (or `cli-ab.ts <ref> -- zmdlogs hits …`) that prints, per hit
  whose reading moved, each zone's before/after and the modifiers added or lost (the lead says `measure --hits` now
  names moved modifiers; the same per hit for one log against a ref would have done it in a minute). And in
  `differences`, mark a "values" difference whose sums agree (0.216 both sides) as cosmetic.
- **Why it helps:** "which zone changed between two commits at one hit" is the first question of every regression.

## 2. Instance buffs fall out of the log's own end silently

- **What happened:** the Xaihi weapon instance is listed on Arcane to 51.1 s, but the replay ended it at 50.47 s. I
  assumed `heldToLoggedEnds` keeps listed buffs to the log's end; it returns null for any buff with `maxInstances`
  (the kit has no `instances` field; the compiler sets 0 from stackingType 1). Found by adding a temporary
  `process.stderr.write` in `loggedEndOf`; my first debug line sat after an early return and printed nothing.
- **Cause:** whether a buff is eligible for the log's end (loggedEndOf), for a run bound (runBounds) and for an
  instance clock (INSTANCE_LATE_MS, runApart, nearestRun) is spread over three functions with different rules, and
  nothing reports the reason per instance. (Round 7's `holds --why` covers the clock side; I had main at 8daa9e9.)
- **Suggestion:** extend `--why` (or `zmdlogs clock --kit-buff`) with the log-end side: "kept to the log's end: no
  (instances)", next to the clock verdict ("not a clock: 1.67 s late > INSTANCE_LATE_MS").
- **Why it helps:** the buff clock's misses are now mostly eligibility questions, not arithmetic.

## 3. Crit-less hits: three inferences, no view of them

- **What happened:** to see why Yvonne's MI Security ran out I had to learn that 85 of her hits have `crit: null`,
  that shownCrits/layerCrits don't cover a shared-timer layer, and that the replay treats null as no crit. The
  cross-validation probe for the new `valueCrits` took three rounds of grouping (by cast and hit id: nothing inferred;
  by key and scale name: 0.72 because scale names repeat across skills and Purrchena's slot is two hits).
- **Cause:** which crit each landing took, and from which inference, isn't in any view; `hits --json` has `crit`
  (the log's) but not the replay's.
- **Suggestion:** `hits --json` and `replay` print the crit the replay used and its source (`log`, `shown`, `layers`,
  `values`, `none`).
- **Why it helps:** crit-triggered buffs (MI Security, Wolven Blood, Yvonne's weapon) are a recurring source of
  ×1.1–1.2 misfits.

## 4. The worktree sandbox refuses a heredoc even for a test file append

- **What happened:** appending a describe block with `cat >> … <<'EOF'` was refused as "too complex"; had to redo it
  with the Edit tool. CLAUDE.md says so; I forgot because Python `-c` one-liners with embedded newlines pass.
- **Suggestion:** none beyond the rule; maybe say in CLAUDE.md that `python3 -I -c` with a multi-line string is also
  refused sometimes (it worked every time here, which makes the rule look inconsistent).

## What worked well

- `scripts/at-commit.ts <ref>` plus `hits --json` at both codes: the decisive comparison for lead 1.
- `npm run measure -- --hits` in about a minute, fixed at queue time: three variants measured while I kept editing.
- The engine assumptions registry: adding `combustion-snapshot` with the old reading kept was one entry and one
  `engineReading` call; the test compares both readings directly.
- The snapshot history (`git show <ref>:tests/snapshots/log-verdicts-pending.json` in a loop) located 458b's
  6.1 → 7.5% at 74bc686 in seconds, ruling the ticks out.
