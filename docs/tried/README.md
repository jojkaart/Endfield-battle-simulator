# Tried and dropped changes

A change an agent measured and reverted (a placement rule, a replay rule, a kit reading) keeps its diff here, so it
can be measured again once whatever blocked it is fixed, instead of living on as a paragraph only (fight totals 2
report point 4: fc63's second placement fix failed only because of another bug; combined with a control check both
worked, found by reading 80 lines of prose).

## How

- **Look first:** before measuring a rule change, `node scripts/tried.ts --touching <file>[:<function>]` (or a
  function, a reading id, a constant: a word of the headers) lists the diffs here that touch it, with each header's
  first line; `node scripts/tried.ts index` every diff's files and functions (round 20, the Liino report point 2: a
  tail-cut diff tried hours earlier was derived again and measured twice).
- **Keep it:** before reverting, `node scripts/tried.ts new <slug> -- <files>` (writes
  `docs/tried/YYYY-MM-DD-<slug>.diff` from `git diff -- <files>` under a header skeleton; it refuses a name that
  exists: a plain `git diff > …` over another round's file overwrote it once), or copy the `scratch/measure/patches/`
  file a `measure --patch` run made under a new name. Then fill in its header above the first `diff --git` line (git
  apply skips text before it): what it does, the measure it got (the summary's lines, development and hold-out), why
  it was dropped, and what would have to change for it to work. Link it below and name the file in its
  [open-problems.md](../open-problems.md) paragraph ("tried: docs/tried/<file>"). tests/tried.test.ts checks every
  diff has a header and a link here.
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

- [2026-11-27-sub-skill-events.diff](2026-11-27-sub-skill-events.diff): a logged cast event at a hit of a key the
  kit lacks, named after the skill, read as a sub-skill's cast, no press (Camille's Vesperwings moving to the next
  slug: 6339, 7b54); 6339 plain 115 → 103, −10.3 → −15.2%: the press it replaced stood in for the move's landing
  (damage, Susceptibility, Heat), which has no kit hit yet.
- [2026-11-27-tail-own-landing.diff](2026-11-27-tail-own-landing.diff): tailCuts' "logged hit no other cast holds"
  guard not passing the cast's own last landing logged at its frame (6339's 21.60 s Laevatain hit_2, +10.2%);
  development plain 84.3 → 83.7% (c4f3 −66, 9847 −21), hold-out |damage error| 5.8 → 5.9%: more cut tails whose
  effects later hits needed. Found again by the Liino round (0eef's combo hit2 at 8.80 s, +57.8% of Liino's total
  there, kept by this guard and by the 1.5 s fight's-end guard): the same lines, and 0eef 2.3 → 1.3% with a 0.5 s
  end guard on top (its header). Superseded by round 21's tail test (its header).
- [2026-11-27-opening-away.diff](2026-11-27-opening-away.diff) (held back for the lead: enginecheck.ts was another
  agent's): a fight's opening before its first logged hit as an away stretch for the totals and the replay's enemy
  (Liino's pre-fight stance presses, 1cd1 23.2 → 15.0%); hold-outs unchanged, three development totals 0.1–0.4
  points worse where the opening's landings covered a low matched part, 9c0b better.
- [2026-11-27-break-window-start.diff](2026-11-27-break-window-start.diff): the replay's Stagger window recorded from
  its break, not 14 frames later (replayrecord.ts, after engine assumption break-hold); hold-outs 2 better without it
  (plain +8, mismatch −5), development mixed: the late start lets a hidden hold top up the break's 14 frames.
- [2026-11-27-jump-launched-landings.diff](2026-11-27-jump-launched-landings.diff): the replay's JUMPDROP leaving out
  a logged landing launched before the jump (KitHit.launch: f879's Magma Fragment ticks across Laevatain's empowered
  jump 30 → 80); no development log moves, one hold-out −23 plain: not explained without opening it.
- [2026-11-27-break-ultimate-stop-end.diff](2026-11-27-break-ultimate-stop-end.diff): no hold at a Stagger break
  on an ultimate stop's end frame (engine timeline/clock.ts breakHold, holds.ts breakStops: 4d60's 56.29 s break,
  the clocks on time after it); under break-hold-place `moments` development unchanged, one hold-out mixed (plain −1):
  one log's case, the replay right there already, and an engine change for nothing.
- The two placement diffs of 2026-11-27's break round (break-held-cast-starts, placement-break-stops) are gone:
  engine assumption break-held-starts `held` is their rule as a reading (logcasts.ts heldBreaks, castStart; the
  placement takes the run's readings), measured with `--variant break-held-starts=held`.
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
- [2026-11-27-channel-decision-line.diff](2026-11-27-channel-decision-line.diff): held back for the lead, applied after the merge (e93f971):
  `zmdlogs casts --choices` prints the channel-end rule's new casts (LoggedCast.pastChannel) on their CAST line
  (views.ts was another agent's file in round 22).
- [2026-11-28-barrage-array-channel-end.diff](2026-11-28-barrage-array-channel-end.diff): Typhoeus's Barrage Array
  with the data's channel end (frame 215): its 18 ticks run past it in the logs; 00ae 1.1 → 3.9%, fc63 3.2 → 5.9%,
  hold-out plain −6. Superseded 2026-11-28: the end on the array's world clock.
