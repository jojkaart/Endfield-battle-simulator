# The enemy's clock and the hidden holds (2026-11-26)

Task: find what delays db87's enemy statuses in a Stagger, decide whether a burst's delay can bound the hold
placement (9a80), test a boss-phase pause for 4d60, and d4fb 97.05 s's Swordmancer exception. Base c509b8f.

## 1. No view says how a clock runs across one kind of stop

- **What happened:** the decisive finding (every clock runs late across a combo's stop, on time across an
  ultimate's) took five scratch probes written from scratch, one per clock: the enemy's tick pairs, then chains
  (pairs split a stop's time with their neighbours, so the per-pair numbers alternated ±0.2 s in d572 and misled me
  for a while), buff runs from scripts/probes/buff-clock/lanes.ts's rows (a 4-minute rerun), an operator's casts
  across a teammate's combo, bursts. Each needed the same plumbing: devFixtures, castTimeStops(placeHits(…).casts),
  worldMs with the stops filtered by kind, the log's Stagger spans rebuilt from
  buff_common_poise_break_damage_taken_scale (tickstag.ts's code copied a third time).
- **Cause:** worldMs and the stop lists answer "how much world time" but nothing answers "how much does each kind of
  stop hold, against what the clocks say"; the Stagger spans from the log have no exported helper (tickstag.ts,
  my probes, and buffreplay's loggedStagger each rebuild them differently).
- **Suggestion:** a `zmdlogs stops --residuals` view (or `efsim zmdlogs clocks`): every clock with a known period or
  duration (tick chains, single exact buff runs, cast landings by kit frame, bursts by burst delay) as one row each,
  with the time held inside it by stop kind and operator and its residual; `--by kind|operator` sums. Export a
  `loggedStaggerSpans(fx)` from packages/logs next to statusLanes and use it in tickstag.ts and the probes.
- **Why it helps:** "is this stop list right" is the question behind most hold and placement leads (Rossi's combo_3,
  Arcane's reset, the in-turn stops, this round); one view answers it for every clock at once, chain-summed so the
  split-stop artefact can't appear.

## 2. A ComboSkill-curve measure needs a data patch in another agent's directory

- **What happened:** to test the obvious fix (the guessed ComboSkill curve holds too little) I wrote
  `measure --patch` diffs against packages/data/src/skillData.ts NAMED_CURVES, the other accuracy agent's area this
  round; the change can't be an engine assumption, because the curve is compiled into SkillTiming.slowdowns before
  any scenario is read. Each patch measure also waited ~10 min in the lock's queue behind the other worktree's.
- **Cause:** the named curves (assets the data doesn't have) are guesses compiled as data, not readings the
  assumptions registry can switch; measure --variant can't reach them.
- **Suggestion:** make NAMED_CURVES' shape an engine assumption read where the slow-downs are used (clock.ts
  slowDown and logcasts.ts skillStops both take the compiled scales: keep the curve's parameters on the timing, e.g.
  `curve: "ComboSkill"`, and let one function in timeline/ turn them into scales under the scenario's reading).
- **Why it helps:** a guessed curve is exactly an open reading; `measure --variant combo-curve=flat` would have been
  one run beside the base instead of two queued patch runs, and no edit in another agent's files.

## 3. The hold placement's `still` rule was an untested claim with a strong name

- **What happened:** "never while the enemy is Staggered" in the hidden-holds docs and assumptions text read as a
  finding, but it rested on "1 of 92 tick pairs ≥ 0.3 s late" (dodge-sized only). Smaller, combo-sized lateness in
  Staggers (db87 0.09–0.21 s a pair) was dropped by the placement as conflicts without anyone seeing a pattern.
- **Cause:** the dropped bounds are printed per log (`zmdlogs holds`), never counted across logs by where they sit.
- **Suggestion:** `zmdlogs holds --all --dropped`: the dropped bounds over every log, grouped by kind and by what
  covers their span (Stagger, a combo's stop, an ultimate's), with their asks.
- **Why it helps:** a systematic conflict (the same kind of bound dropped in many logs at the same kind of span)
  is a mechanism the placement lacks; one count would have pointed at combos in a minute.

## What worked well

- `zmdlogs worldtime` and `zmdlogs lanes --buff` settled the boss-phase pause question in two commands per log
  (Xiranflow's layers across the away windows).
- `measure --variant` for the registered reading and `measure --patch` for the curve gave clean, comparable tables;
  the hold-out aggregates made "verified worse" visible immediately.
- `--trace-trigger suit_phy01.proc` showed d4fb's cooldown shifts frame by frame; with jq on the fixture's procs the
  shared-cooldown and restart readings were ruled out without a script.

## Outcome (round 13)

- 1 (No view says how a clock runs across one kind of stop): done (56de13b): `efsim zmdlogs clocks <fixture…|--all> [--clock tick,cast,burst] [--by operator] [--rows]` (clocksview.ts): the enemy's tick chains (cut at the log's Stagger's edges), a cast's landings against its kit frames, bursts against their delay; per clock kind and what holds it, rows whose span a stop straddles left out (the split-stop artefact); query.ts `loggedStaggerSpans`, used by the views, tickstag.ts and tick-chains.ts. Over the 61 development logs it reproduces the round's finding in one run (tick chains across combos 0.23 × the held time late, casts 0.40, bursts 0.33; across an ultimate −0.00). Buff runs aren't a clock of it yet (they need the replay's instances; `zmdlogs clock --kit-buff` per buff)
- 2 (A ComboSkill-curve measure needs a data patch in another agent's directory): carried (2026-11-26-backlog-after-round-13.md point 4); the data compiler and the engine were the accuracy agent's
- 3 (The hold placement's `still` rule was an untested claim with a strong name): done (56de13b): `efsim zmdlogs holds --dropped --all` groups the dropped bounds over the logs by kind, the log's Stagger over their span and the stops inside, against the kept ones of each group; its first line is the round's pattern: tick bounds inside a Stagger with a combo's stop, 47 dropped in 9 logs against 35 kept
