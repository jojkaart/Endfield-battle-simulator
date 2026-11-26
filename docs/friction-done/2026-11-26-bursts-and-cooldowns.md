# Bursts and cooldowns: 4d60's runs, d4fb's Swordmancer, Snowshine (2026-11-26)

Task: 4d60's Perlica weapon and Arcane's Will burst runs, d4fb's 97.05 s Physical Suit exception, Snowshine's last
factor in 04d4 and test 33's reaction case, beside a parallel agent on the inferred casts (base main 4569c99).

## 1. Two views disagree on what a "stop" is, and one of them misled an earlier round

- **What happened:** the open problem said "a pause of the operators' timers while the enemy is away is ruled out",
  from Xiranflow's layer in 4d60 running 24.38–26.36 s of world time (`zmdlogs worldtime`). That count includes
  Zhuang Fangyi's Empyrean end at 106.47 s as a 78-frame ultimate stop (28 frames inside the window), which the hold
  placement and the replay left out since 2026-11-24. The real figure is 25.3–26.7 s; with the layers' replacement at
  max stacks (another consumption at 137.49 s) the layer couldn't show a pause at all. The wrong ruling-out kept the
  lead at "a refresh the replay misses" for two rounds; the fix itself (one assumption, three lines) took minutes once
  the 7 s pause was visible in the Stagger's own length.
- **Cause:** query.ts replayTimeStops (the views' world time) and buffreplay.ts's hold placement stop list
  (replayedCastStops without tick-read events) are two lists of the replay's stops. The worldtime view marks the
  event ("a hitless event of a skill a kit buff ticks as") but still counts its frames.
- **Suggestion:** one function for "the replay's stops" that both use, taking the replay's own made-cast record
  (BuffReplay.made) so an event the replay read as a tick is never a stop; `zmdlogs worldtime` then prints such an
  event as a line without frames.
- **Files:** packages/logs/src/query.ts (replayTimeStops), packages/logs/src/buffreplay.ts (the placement's stop list),
  packages/logs/src/castassembly.ts (replayedCastStops).
- **Why it helps:** world-time counts are the evidence most rulings-out rest on; one list removes a silent 2.6 s error
  per tick-read event.

## 2. The replay's Stagger windows were wrong by 10 s and nothing said so

- **What happened:** `zmdlogs stagger d4fb` printed "log 97.26–109.89 … replay 86.50–109.93": a replay window
  starting 10.8 s before the log's. The earlier round read it as "Staggered 86.50–109.93 s" and ruled out a Stagger
  holding the cooldown on it. The replay's enemy wasn't Staggered there (its hits plain, no "Staggered" modifier in
  `hits --json`); the record (replayrecord.ts) took a window's start as its end less the Stagger's length, wrong for a
  Stagger the log's listing holds. It also fed the hold placement's still spans. Found only by a debug write.
- **Cause:** the record's window is derived, not recorded (TimelineState.stagger has no start), and no check compares
  the record against the log's Stagger beyond the end.
- **Suggestion:** give TimelineState.stagger a `since` frame (set where dealPoise breaks the bar and where
  holdStagger starts one), and have `zmdlogs stagger` flag a replay window whose start is more than a second from the
  log's first Staggered hit or breaking hit.
- **Files:** packages/engine/src/timeline/resources.ts (dealPoise, holdStagger), packages/logs/src/replayrecord.ts,
  packages/logs/src/views.ts (the stagger view).
- **Why it helps:** the still spans, the windows' edges (kitBuffNearChange) and every "Staggered there" argument
  read this record; a flag makes a wrong one visible at once.

## 3. File ownership by "the other replay modules" is ambiguous

- **What happened:** the fix needed three lines in buffreplay.ts (the placement's `still` argument) and five in
  replayrecord.ts; the brief gave the parallel agent "castassembly.ts, replayrun.ts, replayedhits.ts and the other
  replay modules". I couldn't tell whether those two files were included, committed the small hunks and named them
  for the lead instead of the held-back diff the rules ask for.
- **Cause:** the split into six modules (round 14) made "the replay" many files; a brief's prose names a family.
- **Suggestion:** a brief lists files, never a family; `node scripts/lead-files.ts` could print the replay family's
  file list for the lead to paste.
- **Files:** CLAUDE.md ("The lead: … the files each parallel agent is expected to edit"), scripts/lead-files.ts.
- **Why it helps:** an agent doesn't guess, and the lead knows which merges can conflict.

## 4. No probe for "which build changes give this factor"

- **What happened:** Snowshine's ×0.9624 needed a scan of single and paired build changes (potential, weapon skill
  levels, levels, each gear piece swapped or dropped). fit-build covers node counts, the weapon level and foods only;
  I wrote scripts/probes/stats/snowshine-builds.ts. 46 pairs fit within 0.001, which says the question is
  undecidable, worth knowing before a round spends time on it.
- **Cause:** fit-build's candidate space is fixed; there is no count of how many candidate pairs fit by chance.
- **Suggestion:** `zmdlogs fit-build --pairs` over the wider space (skill levels, gear swaps within the worn set,
  potential, attribute-node subsets by favorability), printing the number of pairs within the tolerance, so "one
  constant, many explanations" shows at once.
- **Files:** packages/logs/src/buildfit.ts, packages/cli/src/commands/zmdlogs.ts (or its fit-build module).
- **Why it helps:** a build offset is either decided or flagged undecidable in one command.

## What worked well

- `measure --variant <id>=<r> --hits` on a freshly registered assumption: the whole effect, per hit, in one run.
- `zmdlogs holds --verbose` showing each dropped bound's conflict partners, and `holds --why`'s per-instance verdicts:
  the "dropped as conflicting" with Stagger-bound partners pointed straight at the still span.
- `zmdlogs lanes --buff` across a fight made the 6–7 s pattern visible across unrelated buffs.

## Outcome (round 15)

- 1 (Two views disagree on what a "stop" is, and one of them misled an earlier round): done (cfdfb68): castassembly.ts replayStops, the one list the hold placement and query.ts replayTimeStops read, by the replay's made casts (BuffReplay.made): a hitless event of a tick skill the replay didn't make is no stop; `zmdlogs worldtime` replays (it takes --assume now) and prints such an event as a line without frames (4d60 106.47 s, tests/query.test.ts); no log moved
- 2 (The replay's Stagger windows were wrong by 10 s and nothing said so): the flag done (678f743): `zmdlogs stagger` flags a replay window starting over a second from the log's first Staggered hit (views.ts staggerLine, STAGGER_START_FLAG_MS); the recorded `since` on TimelineState.stagger carried (2026-11-26-backlog-after-round-15.md point 4)
- 3 (File ownership by "the other replay modules" is ambiguous): done (678f743): `node scripts/lead-files.ts --family <replay|placement|check|holds|views|timeline>` prints a family's files for a brief (FAMILIES, each file checked to exist by tests/lead-files.test.ts); the CLAUDE.md line ("a brief lists files, never a family") proposed in the round summary's "For the lead"
- 4 (No probe for "which build changes give this factor"): carried (2026-11-26-backlog-after-round-15.md point 2)
