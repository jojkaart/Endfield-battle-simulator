# Tried and dropped changes

A change an agent measured and reverted (a placement rule, a replay rule, a kit reading) keeps its diff here, so it
can be measured again once whatever blocked it is fixed, instead of living on as a paragraph only (fight totals 2
report point 4: fc63's second placement fix failed only because of another bug; combined with a control check both
worked, found by reading 80 lines of prose).

## How

- **Keep it:** before reverting, `git diff -- <files> > docs/tried/YYYY-MM-DD-<slug>.diff` (or the
  `scratch/measure/patches/` copy a `measure --patch` run made), then write its header above the first `diff --git`
  line (git apply skips text before it): what it does, the measure it got (the summary's lines, development and
  hold-out), why it was dropped, and what would have to change for it to work. Name the file in its
  [open-problems.md](../open-problems.md) paragraph ("tried: docs/tried/<file>").
- **Re-measure it:** `npm run measure -- --patch docs/tried/<file>.diff` on the current code (`--base HEAD` for the
  patch's own effect). A patch that no longer applies says so; port it by hand and keep the new diff in its place.
- **Adopted later:** delete the file in the commit that adopts the change, and say so in its open-problems paragraph.

## Files

- [2026-11-24-same-ms-cast-order.diff](2026-11-24-same-ms-cast-order.diff): two operators' landings at one logged ms
  in their casts' order (Estella before Chen Qianyu); mixed: batched landings at a stop's end moved the other way.
- [2026-11-24-unseen-ultimates-without-energy.diff](2026-11-24-unseen-ultimates-without-energy.diff): every unseen
  ultimate press made whatever the replay's energy (not only before the log's first hit); 1cd1 −7.2 → −19.5%,
  hold-out mean |damage error| 8.5 → 9.2%.
