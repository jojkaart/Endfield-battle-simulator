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

Three of 2026-11-26 (damage-factors round) were held back, not dropped: changes in files another agent held. All
three are gone now: the check's loggedEntries matching an unjudged buff's entry only against its own game buff was
adopted by the lead on 2026-11-26; the 0c14 away-press measurement (Si's away-stretch press making nothing, her next,
hitless, her battle skill by Jade Vessel's listing; 0c14 plain 172 → 293) and the life-end landings (Rossi's slash2
extras at a fight's or a life's last hit uncounted; mixed and too broad) were superseded on 2026-11-26 (away and
presses round) by general rules: the replay's enemy away (engine assumption enemy-away `absent`), a hitless press
inferred from the listing (`hitless-presses` `inferred`), the totals' leaving frame and a kill read from the last
life's damage ([open-problems.md](../open-problems.md), "The damage factors"). Their diffs are deleted.

- [2026-11-27-break-window-start.diff](2026-11-27-break-window-start.diff): the replay's Stagger window recorded from
  its break, not 14 frames later (replayrecord.ts, after engine assumption break-hold); hold-outs 2 better without it
  (plain +8, mismatch −5), development mixed: the late start lets a hidden hold top up the break's 14 frames.
- [2026-11-27-jump-launched-landings.diff](2026-11-27-jump-launched-landings.diff): the replay's JUMPDROP leaving out
  a logged landing launched before the jump (KitHit.launch: f879's Magma Fragment ticks across Laevatain's empowered
  jump 30 → 80); no development log moves, one hold-out −23 plain: not explained without opening it.
- [2026-11-27-status-value-fit-10.diff](2026-11-27-status-value-fit-10.diff): the status pairing's value fit at 10%
  instead of 1% (statuspairs.ts STATUS_VALUE_FIT), so a burst a buff's edge put off by ×1.1 pairs beyond 16 frames;
  1 log better, 2 worse, 1 mixed (Combustion ticks of one value trading places): mixed.
- [2026-11-27-unknown-crit-slots.diff](2026-11-27-unknown-crit-slots.diff) (its case, 9a80's 36.10 s final, is on the
  final's slot since logcasts.ts nextByValue, 2026-11-27): realignByValue letting a value of unknown
  crit fit a slot up to ×3 above its scale (9a80's Si combo final at 36.10 s, 495,353, ×16.25 the slashes, on a
  slash's slot); 9a80 plain 277 → 278, one hold-out's total worse (hold-out mean |damage error| 6.3 → 6.8%, "kind
  combo, time to kill"): not explained without opening it.
- [2026-11-26-boundary-ends-before.diff](2026-11-26-boundary-ends-before.diff): a buff run whose lane ends at a hit's
  ms taken as ending before that hit (engine assumption `boundary-ends` `before`), for the hidden holds' bounds and
  the log's ends; c4f3's Wolven Blood finals right (plain 223 → 233), but development |damage error| 6.3 → 6.4% (4360,
  9555 worse): only where the end-boundary hit's value decides it.
- [2026-11-26-chance-path-buffs-decided.diff](2026-11-26-chance-path-buffs-decided.diff): Alesh's P3 (a buff only a
  chance path gives) judged by the replay where the listing decided every cast's path; 0c14 mismatch 12 → 9, one
  hold-out log −47 plain (hold-out 81.0 → 80.2%): P3 stays the log's.
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
