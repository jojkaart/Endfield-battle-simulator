# Arcane's WILL lines and Chen's late Wolven Blood final (2026-11-26)

Task: diagnose e82d's −8.9% (Si's combo final under five listed Solemn Phalanx WILL lines), c4f3's late second Wolven
Blood final and Estella's missing buffs on Chen in c4f3; branch worktree-agent-a3e14a677aac09c96.

## 1. The lead's premise wasn't checked against the hit next to it

- **What happened:** the brief and open-problems ("the log lists Arcane's weapon WILL lines five times, the engine has
  two") pointed at the line count. The combo slash 0.19 s before the final lists the same five lines and reads plain
  with two; that one `zmdlogs hits --from 8.9 --to 9.2 --zones` line settled it, but only after reading the WILL
  buffs' data trees and the kit. Then a cross-log table of every Si combo final (verdict, ratio, listed lines, listed
  Susceptibility values) took three scratch scripts over `hits --json` lines before the real cause (Arcane's doubles
  Susceptibility gone at the final, its lane ending between the last slash and the final) showed.
- **Cause:** a candidate written as "the log lists X n times, the engine has m" isn't checked against hits with the
  same listing; and there is no view that lines up one hit key's instances across logs with their listed values.
- **Suggestion:** (a) a `zmdlogs hits --same-listing <fixture> <t>` (or a line in `differences --hits`) giving the
  nearest hits with the same listed buffs and their verdicts: a listing difference that reads plain next door is no
  cause. (b) `hits --all --event <regex> --hit <hitId> --listed <regex>` printing the listed entries' values and
  sources per hit (the scratch/si-final3.ts table: values `@since`, the engine's value of the matching kit buff).
- **Files:** packages/cli/src/commands/zmdlogs.ts, packages/logs/src/views.ts, docs/open-problems.md (the
  "what's ruled out" convention: name the neighbour hit that would rule it out).
- **Why it helps:** the first check of a listing lead becomes one command; the cross-log question ("does every final
  under this listing read plain?") stops needing a script.

## 2. `zmdlogs clock` pairs an instance with the wrong lane when two buffs share a logged name

- **What happened:** for chr_0032_lizhiyan:doubles_susceptibility in e82d the first instance's "log since 7.02,
  listed to 11.11" is Arcane's talent-1 Susceptibility (same buff_common_affixes_vulnerable_crystal, value 0.197), not
  the doubles' 0.179399 lane from 3.98 s; I read it as the doubles' run until `zmdlogs raw --buffs vulnerable` showed
  the lanes.
- **Cause:** clockview.ts pairs by the logged name and start, not by value; several kits log through the common
  `buff_common_affixes_vulnerable_*` children.
- **Suggestion:** pair a kit buff's instance with a lane whose value matches its modifier's (within the log's
  rounding), and print the lane's value beside it.
- **Files:** packages/logs/src/clockview.ts.
- **Why it helps:** the clock view is the first stop for "did this buff end early"; a wrong pairing sends the reader
  off by seconds.

## 3. A rule for every buff measured to settle one log's case

- **What happened:** c4f3's case (a lane ending at a crit's ms, the hit reading without the buff) suggested "an
  end-boundary hit is past the run". I registered an engine assumption, measured it (5 min with the queue), and it
  moved 30 logs both ways; the narrowing I tried after needed `hits --against` per log to see it changed nothing.
- **Cause:** no quick count of how often a pattern holds across logs before building the rule: here, "at a hit where
  a kit buff's lane ends, does the check's reading fit with it or without it" is in the check's own `boundary`
  counterfactuals, but no view counts them by start / end boundary.
- **Suggestion:** `zmdlogs census --select boundary-end` (or `assumed --kind boundary` split by whether the buff's
  lane starts or ends at the hit), with the on / off fits per kit buff: the pattern's base rate in seconds.
- **Files:** packages/logs/src/assumedview.ts, packages/logs/src/views.ts.
- **Why it helps:** a rule's direction is known before a measure; the measure then confirms instead of exploring.

## What worked well

- `zmdlogs raw --buffs` with the cached detail: the lanes' exact ends (49958 ms) decided both c4f3's and e82d's cases.
- `hits --json` counterfactuals (`boundary off`) and `--zones`: the reading that fits is printed, no arithmetic.
- `measure --variant` measured the assumption against the same code in one queued run, and docs/tried/ kept the result.
