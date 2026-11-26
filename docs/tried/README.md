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

Two of 2026-11-26 (damage-factors round) are held back, not dropped: changes in files another agent held, measured,
for the lead to apply or build in general (each header says which). A third, the check's loggedEntries matching an
unjudged buff's entry only against its own game buff, was adopted by the lead on 2026-11-26 and its diff deleted.

- [2026-11-26-0c14-si-away-press.diff](2026-11-26-0c14-si-away-press.diff): a measurement hard-coded to two presses
  (Si's away-stretch press makes nothing; her next, hitless, is her battle skill by Jade Vessel's listing); 0c14 plain
  172 → 293, −4.9 → +1.2%, the Endministrator's Crush exact. The general rule is to build.
- [2026-11-26-life-end-landings.diff](2026-11-26-life-end-landings.diff): mixed. Landings no logged hit stands for at
  the fight's last frame or an away stretch's first are uncounted (Rossi's slash2 extras); 4a64 better, 207f worse,
  and too broad (0c14's same-frame extra before another hit's kill is logged).
- [2026-11-26-combo-curve-flat.diff](2026-11-26-combo-curve-flat.diff): the ComboSkill slow-down curve at 0.01 for
  its whole duration (the clocks run late across combos by more than the guessed curve holds); verified plain 78.0 →
  73.0%, development 69.0 → 68.0%, hold-out 79.0 → 76.7%; a middle curve worse too.
- [2026-11-25-third-placement-pass.diff](2026-11-25-third-placement-pass.diff): pass 2 and the in-turn rule run once
  more (settleCheck's third pass as the placement); 2-cycles, not a fixed point: development plain 68.1 → 67.8%
  (9090 −42, 4a64 −10, fc63 +10).
- [2026-11-25-in-turn-chains.diff](2026-11-25-in-turn-chains.diff): the in-turn rule with a 3-frame tolerance against
  a third ultimate's stop and a reach counting teammates' combo slow-downs (3 of the 14 overlapping pairs resolved);
  d9e5 plain 86 → 50, b6aa mixed.
- [2026-11-24-same-ms-cast-order.diff](2026-11-24-same-ms-cast-order.diff): two operators' landings at one logged ms
  in their casts' order (Estella before Chen Qianyu); mixed: batched landings at a stop's end moved the other way.
- [2026-11-24-travelling-landings-only.diff](2026-11-24-travelling-landings-only.diff): the placement's event rule
  for travelling first landings only (KitHit.travels), without its contradiction check; the same for every projectile
  ultimate, 3aa6 +1 plain, but b7b3 47 → 45 plain (Tangtang's stare, an ability entity, needs the event).
- [2026-11-24-unseen-ultimates-without-energy.diff](2026-11-24-unseen-ultimates-without-energy.diff): every unseen
  ultimate press made whatever the replay's energy (not only before the log's first hit); 1cd1 −7.2 → −19.5%,
  hold-out mean |damage error| 8.5 → 9.2%.
