# The clock through overlapping combo slow-downs; 458b's layer ends (2026-11-28)

Task: why Typhoeus's clock runs late through combos pressed together (fc63) and why 458b's Thermite Cutter layers
end 0.3 s early at 111 s; fix what the logs decide. Branch worktree-agent-a073796dffcba611a.

## 1. A `--variant` measure's first section said "No log's verdicts moved" while the variant moved several

- **What happened:** `npm run measure -- --variant combo-overlap=lowest` (stale snapshots, so it measured the merge
  base 400bb44 as --base) printed "Verified unchanged … No log's verdicts moved" for the plain tree against the base,
  and then, for the variant (the old rule) against the plain tree, 4e5e +1, db87 +6 plain. The variant was the base's
  own behaviour, so both can't hold. A second, two-log measure with `--base HEAD` showed the plain tree *did* move
  4e5e and db87 against the base. About 20 minutes (one more locked measure, and doubt about every earlier number).
- **Cause:** unknown; the first section's reference may not be the base run the header names when --variant and an
  implicit merge-base --base go together (the header said "that commit's code (400bb447d) is measured as --base").
- **Suggestion:** in scripts/measure.ts, when a --variant run's plain-vs-reference summary says nothing moved but a
  variant moves logs against the plain tree, print a warning line naming which run each section compared; a test that
  a variant equal to the base reading gives the same verdicts as the base run.
- **Files:** scripts/measure.ts, tests/measure*.test.ts
- **Why it helps:** a measure's first line is what an agent quotes; a section that silently compares the wrong pair
  costs a rerun at best and a wrong conclusion at worst.

## 2. Which hidden-hold clock a layered buff is, and why not, took a source read

- **What happened:** for 458b, `zmdlogs holds 458b --why sword_0012` said "not a clock: the kit buff has `maxStacks`
  (its end isn't its own timer's, or the log merges its instances)" for a buff whose kit note says "layers with their
  own timers" and whose log runs are listed apart by their since. Whether that is safe to lift needed the stacking
  type of every layered kit buff (a scratch script over data.kits) and a measure: lifting it for stackingType 2 cost
  7910 120 plain (its gear-set runs outlast their layers' timers).
- **Cause:** NOT_A_CLOCK keyed on kit fields only; the BuffData stacking type, which decides how the log lists the
  layers, was not part of the rule or of the view's line.
- **Suggestion:** done here for the rule (holds.ts notAClock reads the game buff's stackingType); the `--why` line
  could print the stacking type it judged (`maxStacks, stackingType 2`), and `efsim kit-census` could list the layered
  kit buffs by stacking type.
- **Files:** packages/logs/src/holds.ts, packages/logs/src/holdinputs.ts, packages/cli/src/commands/kit-census.ts
- **Why it helps:** the next layered-buff lead reads its case off the view instead of a scratch script.

## 3. No view gives an operator's clock across another's slow-down from an independent anchor

- **What happened:** the question "is the first combo's caster held by the second's slow-down" can't be answered by
  `clocks`, `episodes.ts` or `casts --event-lags`: a combo's landings all come after both slow-downs, so the start
  placed from them cancels any hold. The answer needed a new probe (scripts/probes/combo-hold/overlap-events.ts)
  using the cast event's world lag as the anchor (the event is stamped on the world's clock), after a first probe on
  landing pairs found no rows.
- **Cause:** the views compare landings with landings; the one anchor independent of the operator's clock (the cast
  event, on the world's) is only summarised per operator in `--event-lags`.
- **Suggestion:** a `casts --event-lags --against-holds` mode: for each cast, the event's world lag from the start its
  first landing gives under each hold reading (unheld, held by the stops between, the engine's), so a clock question
  about one operator reads off the event.
- **Files:** packages/logs/src/eventlagsview.ts, packages/cli/src/commands/zmdlogs.ts
- **Why it helps:** the event is the only clock-free anchor for a press; several open leads (fc63's early combo events,
  3f78's cooldown) are such questions.

## 4. The test lock's queue cost more than the work

- **What happened:** smoke waited 28 min in the lock's queue behind other worktrees' premerges and finished after 35
  min; a 2-log measure waited 5 min for a 3 s run.
- **Cause:** one lock for every job; `short` jobs still queue behind a premerge's vitest phases.
- **Suggestion:** let a measure of at most a few logs (`--logs`) run outside the lock (seconds of CPU), as `--kind
  short` jobs beside long ones already intend.
- **Files:** scripts/with-lock.ts, scripts/measure.ts
- **Why it helps:** quick A/B checks of one log are the loop a diagnosis runs in.

## What worked well

- `cli-ab.ts <ref> --hits-zones <fixture>` named the Corrosion step behind 7910's −120 and 9c6e's −4 at once, and
  `--holds` showed the new bounds; `zmdlogs hits <fixture> --against <id>=<r>` showed Camille's explosion landing
  where the log has it only under the new reading.
- `zmdlogs holds --why <regex>` made the layered-buff skip visible in one line.

## Outcome (round 24)

- 1 (A `--variant` measure's first section said "No log's verdicts moved" while the variant moved several): done
  (818fb42). Reproduced with `measure --variant combo-overlap=lowest --base 400bb44 --logs 4e5e,db87`: the plain tree
  moved both against the base (indented section), the variant neither (the unindented section, "No log's verdicts
  moved."), the variant against the plain tree both: consistent, the variant being the base's behaviour. The
  unindented line was the variant against the reference, read as the plain tree's. Now that section is headed
  "Variant n (…) against the reference (…): the tree's change and the variant's together", indented, and ends with a
  note where the plain tree moved logs and the variant none (it undoes the tree's change) or the reverse
  (variantUndoNote).
- 2 (Which hidden-hold clock a layered buff is, and why not, took a source read): done (44b18ff): the not-a-clock line
  names the game buff's stacking type it judged (holds.ts notAClockWords); `efsim kit-census` lists the layered kit
  buffs by stacking type (24 at 2, 11 at 11, 8 at 8, 4 without a game buff, 1 at 10).
- 3 (No view gives an operator's clock across another's slow-down from an independent anchor): done (1f25928): `zmdlogs
  casts --event-lags <…> --against-holds [--verbose]` (eventlagsview.ts eventsAgainstHolds): per cast with teammates'
  stops before its first landing, the event's world lag from the start unheld and held. The engine's own reading (a
  replay per log) not built: the two readings the probe compared.
- 4 (The test lock's queue cost more than the work): done but smoke's wait (carried:
  2026-11-28-backlog-after-round-24.md point 4) (cb46ffb): a measure of at most three logs named with `--logs` runs
  outside the lock (measure.ts smallMeasure).
