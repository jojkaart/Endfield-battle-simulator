## 2026-11-26: Improvement round 15: one rule for each fact, records the views carry

**Goal:** the five open friction reports and round 14's backlog (docs/friction/README.md's round), every file free:
the structural causes first (a fact computed twice by two rules, a record the views didn't carry, a comparison against
the wrong reference), behaviour-preserving.

**Done** (docs/friction-done/2026-11-26-round-15.md has the list and the commits):
- One rule each: the replay's stops (castassembly.ts replayStops, read by the hold placement and every world-time view;
  `zmdlogs worldtime` replays and shows a tick-read event without frames); a hit's twin on a jump's other path (engine
  timeline/paths.ts pathTwin, pathLandings, for the control and chance paths and castassembly.ts); each assumption
  kind's fact (assumptions.ts ASSUMPTION_FACTS, docs/design/data.md's table, tests/assumption-facts.test.ts); one
  reason per kit buff (replaycrits.ts buffDecidability).
- Records the views carry: HitRecord.assumptions and landing.cast, `zmdlogs assumed --operator`, groups' rows of casts
  matched only as another kit hit, LINK and two-casts MADE lines, measure's hold units with their pinning bounds,
  `zmdlogs clock`'s check paired by the nearest start, `zmdlogs stagger`'s FLAG.
- The reference: measure with no reference named and stale snapshots measures the merge base with main as --base;
  cli-ab reads the other worktree's paths as this checkout's.
- Tools: scripts/split-module.ts (a split as a checked move), check-links.ts staleCitations (eight fixed) and conflict
  markers (docs/roadmap.md had a merge's, resolved), `lead-files.ts --family`, bash-guard's sed hint, process step 6
  (CLAUDE.md is the lead's: lines proposed in the summary's "For the lead").

**Checks:** `npm run measure -- --base 32dfacd --at HEAD` after the refactors: no log's verdicts moved; team-ab against
32dfacd: every team's fight the same; `npm run snapshots:update` at the end: the scoreboard unchanged.

**Found on the way:** the CLI's `--no-cache` and `--no-foods` were dropped by parseArgs' allowNegative (read as an
undeclared `cache=false`), so the hits cache was read whatever the flag said; fixed (command.ts withDeclaredNegatives).
The fact table's test found the log-listing fallback trying both crits where the replay had read one (three hits in
0c14 and a9d7; a fallback either way): on the backlog's accuracy list with two other candidates the table names
(reaction levels the log decided, the enemy's side).

**Left** (docs/friction/2026-11-26-backlog-after-round-15.md): the log context `{ data, assume }` (carried twice),
fit-build over a wider space with chance counts, the by-operator scoreboard's share (a new snapshot key), a recorded
Stagger start.
