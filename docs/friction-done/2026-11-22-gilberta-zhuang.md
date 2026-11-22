# Gilberta's Vulnerable count, Zhuang Fangyi's entity keys (2026-11-22)

Task: diagnose and fix why the replay's Vulnerable count at Gilberta's
ultimate is low in four logs, and place Zhuang Fangyi's unplaced
`attack1_ult_2_abilityrange` hits (plus her d774 Sunderblade lead); a
worktree branch from 1ab4647.

## 1. No view of the replay's enemy statuses

- **What happened:** the question "how many Vulnerable stacks does the
  replay have when her ultimate lands, and from which adds" has no command.
  `zmdlogs replay` prints landings (a Lift's damage), not Vulnerable adds,
  consumptions or expiries; `zmdlogs stagger` covers only the Stagger. I
  wrote two scratch scripts (`BuffReplay.reactions` filtered to
  `vulnerable` / `physical` events beside the logged airborne / crush hits,
  then the listed Susceptibility per ultimate against the latest add). That
  table found the cause in minutes (Rossi's Lift 0.46 s before every logged
  airborne hit); before it, ~30 min went to reading kits.
- **Cause:** the replay's status events are only reachable from code.
- **Suggestion:** `efsim zmdlogs statuses <fixture> [--from --to] [--kind
  vulnerable|physical|reaction|infliction]`: the replay's StatusEvents
  (before → after stacks, operator), with the logged status hits
  (buff_physical_*, reaction keys) interleaved and their offset, like
  `replay`'s LAND lines.
- **Why it helps:** physical statuses, Vulnerable and inflictions drive
  many kit conditions (Gilberta, Mi Fu, Chen, Rossi, Da Pan); a count
  question becomes one command.

## 2. A cast's two variants both landing is invisible

- **What happened:** the replay landed Rossi's combo 3 "late" hit (the
  jumped path) and its pinned "perfect" hit for the same cast. `replay`
  showed it (`late ... replay only` 14 frames before `perfect = logged`),
  but nothing flags it, and the earlier 9a80 diagnosis (open-problems,
  "consumed 2 in the log, 1 in the replay") missed it for a week.
- **Cause:** pinned landings survive a jump (jumpCast keeps them), so a
  replay can play both sides of a jump without any warning; the replay's
  CastFlags cover only forced and inside casts.
- **Suggestion:** fixed for jumps in `replayCast` (a jump a pinned landing
  contradicts is dropped, with its path). Also add a CastFlag kind
  "both-variants" when hits of one cast that a jump separates both land,
  so `replay`'s header counts them.
- **Why it helps:** the same pattern exists wherever a kit models variants
  by a jump (Rossi, Arclight, Typhoeus's hover); a flag turns a silent
  double landing into a header line.

## 3. census's rerun line can't be rerun with a negative window

- **What happened:** `zmdlogs census ... --window -3,3` fails ("Option
  '--window' argument is ambiguous"); it needs `--window=-3,3`. The
  command's own `rerun:` line prints `--window -3,3`, so the cited command
  fails when pasted. The window is in ms, which I first read as seconds.
- **Cause:** node's parseArgs treats `-3,3` as a flag; the rerun formatter
  uses a space.
- **Suggestion:** done on this branch: the rerun line prints
  `--window=<a>,<b>` (zmdlogs.ts), and in-game test 108's cited command
  uses that form. Still open: name the unit (ms) in the docs' question
  table (docs/design/data.md, the census row).
- **Why it helps:** the docs ask agents to cite rerun lines; they should
  run as printed.

## 4. World time between two log moments has no command

- **What happened:** to compare a stack's life with 20 s I needed the
  world's time between two log times under the logged casts' stops
  (`worldMs` + `castTimeStops` + `placeHits`): a third scratch script.
- **Cause:** the helper exists in logcasts.ts but only the placement uses
  it.
- **Suggestion:** `efsim zmdlogs worldtime <fixture> <from s> <to s>`:
  raw and world time, and the stops between (operator, skill, start,
  frames, lowest scale).
- **Why it helps:** every "lasts longer than its duration" question
  (Stagger windows, buffs, Vulnerable) starts with this number.

## 5. A placement rule change touches unrelated operators silently

- **What happened:** my first chain-step rule (the step whose window lies
  nearest the start) fixed Zhuang Fangyi but moved Ardelia's, Typhoeus's
  and Rossi's casts in five other logs; I found out only from a full
  measure, then diffed `zmdlogs instances` against an `at-commit` worktree
  by hand (scratch/cmp-inst.sh) to see which.
- **Cause:** `choose()` is shared by every operator, and nothing reports
  which casts a placement change moved.
- **Suggestion:** `npm run measure -- --changed placement` exists (I found
  it late); add to its output the moved casts per log (operator, skill,
  start before / after), or a `scripts/placement-diff.ts --base <ref>
  [logs]`.
- **Why it helps:** a placement change's side effects show in a minute,
  before the accuracy numbers.

## What worked well

- `efsim gamedata tree` / `who` found the four entities and the marker in
  two commands; the kit's `dataOverride` notes explained the strike model.
- `zmdlogs census --near` settled "her ultimate resumes the strikes" in
  one line (two hits at +0 ms of the ultimate's event).
- `npm run measure --base` with the hold-out aggregates made every step's
  effect clear.

## Outcome (round 5)

2026-11-22, improvement round 5 (docs/friction-done/2026-11-22-round-5.md); what's left is in docs/friction/2026-11-22-backlog-after-round-5.md.

- 1 (a view of the replay's enemy statuses): not done, carried over to the round-5 backlog (`zmdlogs statuses`).
- 2 (a cast's two variants both landing): the jump fix was the branch's own; the "both-variants" CastFlag is carried over to the round-5 backlog (it touches the replay's flags; needs its own measure).
- 3 (census's rerun line with a negative window): the rerun line was fixed on the branch; the unit (ms) and the `=` form are now in data.md's question table (c9247da).
- 4 (world time between two log moments): done (cec2dd6): `efsim zmdlogs worldtime`.
- 5 (a placement change touches other operators silently): done (d98b497): `npm run measure -- --changed placement` names, per development log, the casts placed only before (-) and only now (+).
