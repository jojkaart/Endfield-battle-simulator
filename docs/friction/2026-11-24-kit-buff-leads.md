# The kit buff leads (2026-11-24)

Task: the misprediction analysis's largest one-buff leads (Arcane's weapon, Will burst and Susceptibility buffs,
Gilberta's weapon, Zhuang Fangyi's weapon and Sunderblades, Typhoeus's Hovering ATK, then the list): root cause and fix,
or ruled out with why. Branch worktree-agent-afd9bbcd43ff4d2bb (base c6f1874).

## 1. The one-buff list sized leads by single hits and known non-kit fights

- **What happened:** the analysis ranked "Arcane's Susceptibility layers" (1.2–1.5%) and "Arcane's weapon Arts DMG
  Taken ×0.80" (1.0–1.2%) among the top leads. Taking each apart cost about an hour: 170k of the first's 194k error is
  one hit (e82d 9.12 s, an unlogged crit read two ways), and 147k of the second's 153k is 9c6e, the known two-target
  fight in a single-target fixture (its weapon is Detonation Unit, not Solemn Phalanx as the brief assumed from the
  label). Neither was a kit lead.
- **Cause:** scripts/probes/stats/analyze.py `buffs_section` groups by buff × kind with hits, err, fights and the
  median ratio, but shows neither how concentrated the error is (largest fight's and largest hit's share) nor the kit
  buff's full id (the label `wpn_funnel_0008.arts_taken (Arcane)` lost the weapon's name in the brief's retelling).
- **Suggestion:** in `buffs_section`, add columns "top fight (share)" and "top hit (share)", print the kit buff id with
  the equipment's display name, and mark fights with a known non-kit cause (a list in analyze.py: 9c6e two targets,
  the stage logs already apart) so they're reported apart, as the stage logs are.
- **Why it helps:** a lead whose error is one hit or one known fight is visible as such before an agent is sent on it;
  the brief names the right weapon.

## 2. The views disagree about a cast event the replay reads as a buff's tick

- **What happened:** after giving Zhuang Fangyi's Empyrean `ticksLoggedAs` (its end is logged under her ultimate's
  key), `zmdlogs replay 4d60` said "a tick of empyrean" at 106.47 s, while `zmdlogs casts` still drew a 78-frame STOP
  there and `zmdlogs clock --kit-buff chr_0030_zhuangfy:empyrean` said the Empyrean was "cut at cast
  chr_0030_zhuangfy_ultimate_skill". It took three views and reading buffreplay.ts (withLoggedCasts, loggedTick,
  replayedCastStops) to see that the fix worked and that only the stop lists lag.
- **Cause:** the stop lists (buffreplay.ts `replayedCastStops`, query.ts `replayTimeStops`) come from the assembled
  casts, before the replay decides that a hitless cast event is a buff's tick (`loggedTick`). The hidden-holds
  placement uses the same list (buffreplay.ts, "On the replay's own casts' stops"), so it still counts the 78 frames
  of a cast the replay never makes; for Liino's beats (her battle skill has no stop) it never mattered.
- **Suggestion:** have the replay return the casts it made (or the tick-read events), and build `replayedCastStops`,
  the views' STOP lines and the hold bounds from that; or drop from `replayedCastStops` a hitless event of a skill some
  kit buff of its operator `ticksLoggedAs` when that buff is on at the event (the same test as `loggedTick`).
- **Why it helps:** one truth for what the replay held; the hold placement stops counting phantom stops (4d60's
  bounds around the Empyrean's end are computed against a stop that isn't there).

## 3. No view of one operator's Arts Bursts, logged against replayed

- **What happened:** to see whether Arcane's Will burst buff errors were the weapon's or her bursts', I joined
  scratch/stats/hits.jsonl (landingMs of her logged bursts), onesided.jsonl (replay-only bursts), `zmdlogs replay`
  greps per log and `zmdlogs reactions` per fixture path (it takes a file, not an id), then wrote
  scripts/probes/kits/arcane-will-burst.ts. Each burst then needed the touch or ultimate before it found by hand.
- **Cause:** `zmdlogs reactions` compares bursts but needs a fixture path, prints all operators and its own replay
  (its "due" times differ from buffreplay's landings); `replay` shows landings but not which infliction caused a
  burst.
- **Suggestion:** `efsim zmdlogs bursts [--operator <op>] [fixture…|--all]`: each logged burst with the replay's
  landing (offset, or none), each replay-only burst, and for each the infliction that caused it (operator, skill,
  frame) and the stops between; ids like the other views.
- **Why it helps:** Arcane's weapon, Detonation Unit and every burst-triggered buff (abilityEvent 127) are judged by
  their bursts; the next agent on test 33 or the burst clock starts from one table.

## 4. A per-buff listing of the one-buff hits wasn't there

- **What happened:** analyze.py prints the ranking but not the hits behind a row; I wrote
  scripts/probes/stats/onebuff.py (the hits a buff explains, per fight, with times and which side has the buff), which
  every lead then started from.
- **Cause:** analyze.py's sections are whole-table reports; nothing lists one row's hits.
- **Suggestion:** fold onebuff.py into analyze.py as a section with an argument (`analyze.py buff <regex>`), or keep
  it as the probe it now is and name it in the analysis doc's "Next check".
- **Why it helps:** the step from the ranking to the fights is one command.

## What worked well

- `zmdlogs clock --kit-buff`, `lanes --buff` and `holds --why` answered most "is it the kit or the clock" questions in
  one call each; `cli-ab.ts <ref> -- zmdlogs totals|replay …` showed exactly what a kit change moved.
- `measure --hits` with the modifiers that moved per hit made the 4d60 regression readable at once (Arcane's buffs
  ending 2.6 s earlier without the phantom stop).
- `ticksLoggedAs` / `endFollowsTick` (built for Arcane's Imprisonment and Liino's beats) fitted the Empyrean's end with
  no code change.
