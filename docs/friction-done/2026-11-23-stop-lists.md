# The combo reset's reach, Purrchena's stops, pinned expiries (2026-11-23)

Task: make the engine and the log tools' stop lists agree on Arcane's combo reset (a teammate's combo pressed inside her
first 9 frames) and on Purrchena's combo, re-measure pinned expiries, then 489c's bleed tick series; branch
worktree-agent-a432f82c25a7b4d6b.

## 1. No command lists the stop-list differences over every log

- **What happened:** to see all cases of lead 1 and 2 (the brief said "21 differ in length, 36 one-sided" without
  naming them) I wrote scratch/stops-all.sh, a loop of `zmdlogs replay <fx> --stops | grep STOP | grep -v "as listed"`
  over 80 fixtures: about 6 minutes per run, twice (before and after the change), and the per-log CLI start-up is most of
  it.
- **Cause:** `replay --stops` takes one fixture; the round-8 numbers came from a scratch count nobody kept.
- **Suggestion:** `efsim zmdlogs stops [fixture…|--all] [--differ]`: per log the applied/listed pairs that differ (one
  line each, the same wording as `replay --stops`), on worker threads like `hits --workers`, with a summary line per
  kind (length, list-only, timeline-only, covered).
- **Why it helps:** a stop-list change is checked in a minute, and a brief can cite the list instead of a count.

## 2. The replay's record merged two slow-downs of one start and priority

- **What happened:** Purrchena's shielded combo (and Rossi's combo_3 judged late, Pogranichnik's combo) starts two
  slow-downs of the combo priority at one frame (the frame-0 one kept at the jump's frame and the path's own). The
  record (replayrecord.ts, keyed start|caster|priority|kind, shortest kept) showed one, so `--stops` printed "the list has
  20 frames" for an 18-frame one: a false length difference that looked like a path bug for a while. Fixed in this
  branch (records matched by first-seen length; views.ts calls a dominated extra one "covered").
- **Cause:** a key chosen for reset cuts (a cut one replaces the uncut) that assumed one slow-down per key.
- **Suggestion:** done; for the next record of this kind, keep entries per object identity across steps (a WeakMap from
  the state's slow-down object), since the state rebuilds them on cuts only.
- **Why it helps:** the view's differences are real differences.

## 3. A kit value written as "the data's length minus what the engine holds"

- **What happened:** Purrchena's shielded combo extends her shield by 41 − 23 frames, 23 being what the engine's
  slow-downs held on that path at the time. Ending the path at her loop's cast (SkillTiming.recasts) made it 13; the kit
  test caught it (castAt attack1 = 30 + 90 + 41 + 1) and the kit and its report needed hand edits (18 → 28).
- **Cause:** the kit compensates for an engine rule instead of naming it; nothing ties the number to the rule.
- **Suggestion:** a kit `extendBuff` form "to the data's length, less what the world's clock held since the cast"
  (`seconds: {"heldTo": 41}` or similar) the engine computes, so the kit states the data's 41 and engine timing changes
  don't edit kits.
- **Why it helps:** engine timing fixes (frame-0 slow-downs at a jump, the next one) stop touching kit numbers.

## 4. A measure's worse logs need three tools to explain

- **What happened:** 8915 (−6 plain) needed `ramp --held` (no listed Corrosion: empty), then `replay --trace-buff
  status:corrosion` under both readings side by side (hundreds of TRACE lines each) to see that a placed hidden-hold unit
  had moved to 90–95 s. fc63 and 6339 needed `replay`, `lanes` and `totals`.
- **Cause:** `measure --hits` gives the hits and modifiers that moved, not the hidden-hold placement that moved them.
- **Suggestion:** `measure --hits` also prints, per moved log, the hidden-hold units that moved (from `holds`, before
  and after: time, earliest, latest), as `cli-ab.ts --holds` does for one log.
- **Why it helps:** "a knock-on of the holds placed again" is the commonest explanation of a small worse log; it would
  be one line instead of a diff of traces.

## What worked well

- `--assume combo-reset=reaches` with `measure --hits` decided lead 1 in one run: the moved hits named the modifiers
  (Arcane's Susceptibility, her gear set) that the timing change brought in.
- `measure --patch` re-measured round 8's pinned-expiries diff from its scratch file unchanged.
- `replay --stops` itself: the evidence (burst timings, volleys) sat next to the STOP lines.

## Outcome (round 9)

- 1 (No command lists the stop-list differences over every log): done (d5bc0a5). `efsim zmdlogs stops
  <fixture…|--all> [--differ] [--operator]`: replay --stops' STOP lines (views.ts stopLines, which replayView now
  uses: output identical, cli-ab on 0c14) per log, then a count per kind and how many logs have each; one process,
  about 1.5 s a log. No worker threads (not needed at that speed).
- 2 (The replay's record merged two slow-downs of one start and priority): fixed in that branch; the WeakMap idea
  goes with backlog point 1 of round 9 (the dilation index carried into the record), not done separately.
- 3 (A kit value written as "the data's length minus what the engine holds"): not done: an engine feature (an
  extendBuff that subtracts what the world's clock held since the cast) is an engine timing change with smoke and
  team-ab, out of a tools round with another agent on accuracy. Backlog point 2 of round 9.
- 4 (A measure's worse logs need three tools to explain): done (c5dab99). measure --hits gives each moved
  development log's placed hidden holds (measure-worker.ts holdUnits from BuffReplay.hiddenHolds, any commit that
  places them, the per-hit reference's included): the units placed elsewhere, new or gone, a few in the summary and
  all in hits.txt. Checked under combo-reset=resets: 9555's unit 2 31.84 → 54.86 s, 489c's unit 5 91.68 → 102.57 s.
