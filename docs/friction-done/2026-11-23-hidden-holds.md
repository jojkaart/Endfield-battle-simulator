# Hidden holds placed once for every timer (2026-11-23)

Task: estimate each development log's hidden world holds (unlogged dodges, pauses) from every clock the log shows,
apply them in the log check's replay as world holds for every timer (engine assumption `hidden-holds`, reading
`placed`), and see whether they account for the Team SP shortfall. Branch: the worktree's own (agent-a0dca…), on main at
6b117c1.

## 1. The previous round's analysis lived only in another worktree's scratch/

- **What happened:** the buff-clock round's table builder and clock solver (`scratch/bc/lanes.ts`, `clock2.ts`,
  `tickstag.ts`, `rows.jsonl`) were cited by name in docs/open-problems.md ("scratch/bc/ in the session's worktree") but
  exist only under `.claude/worktrees/agent-a16076e366ea19f6f/scratch/`. I found them by listing every worktree's
  scratch folder, copied them over and regenerated the table (the old rows were made under a replay that no longer
  exists). Without that worktree still on disk, the round's numbers could not have been reproduced.
- **Cause:** scratch/ is git-ignored and per worktree; a finding a doc relies on has no durable home for its script.
- **Suggestion:** when open-problems or a journal entry cites a scratch script for a number the next step builds on,
  move it to `scripts/probes/<topic>/` (lint-free, not run by tests) in the same commit, or name the worktree path
  in the citation. A `scripts/probes/README.md` index (one line per probe: question, command, inputs) keeps it findable.
- **Why it helps:** the next agent starts from the last one's tool instead of re-deriving it (about half an hour here,
  more if the worktree is pruned). Cost: some probe code in the tree that ages.

## 2. "Whose clock" questions need a replay pass the API doesn't offer

- **What happened:** placing the holds needs the replay's own buff expiries without any holds, then a second replay
  with them. `logBuffReplay` has one `run()` closure; I added a first pass inside it (and had to make the log-end
  keeping, `heldToLoggedEnds`, off for that pass, after a first version silently got zero excess because the pass
  already kept buffs to the log's end). The state the bounds need (kit instance windows, Stagger windows) is only
  inside the closure.
- **Cause:** buffreplay.ts's `logBuffReplay` is ~800 lines with `run()` capturing a dozen locals; per-reading behaviour
  is switched by flags read at the top (`hiddenHolds`, `placing`), so a reading that needs another reading's output
  has to be threaded through the closure by hand.
- **Suggestion:** factor `run()` into an exported `replayOnce(input, { holds, laneEnds, crit })` returning the run's
  record (kitInstances, staggerWindows, made, checkpoints), and let readings compose passes (`placed` = `replayOnce`
  with nothing kept, bounds, `replayOnce` with holds and log ends).
- **Why it helps:** the next reading that needs a pre-pass (the Corrosion ramp as a clock, SP top-ups with dodge SP)
  becomes a few lines; the risk of a pass inheriting another reading's behaviour (the zero-excess bug) goes away.

## 3. A measure for a reading I had to add to the registry first

- **What happened:** to test "hold the operators' clocks too" against "the world's clock alone" I had to register a
  temporary reading (`world`) in packages/engine assumptions.ts and thread it through buffreplay.ts, measure, then
  remove it again.
- **Cause:** `npm run measure -- --assume` only takes registered readings; there is no way to measure an unregistered
  code variant except a separate commit and `--base`.
- **Suggestion:** document in docs/design/tests.md that the quickest A/B of two code variants is two commits and
  `npm run measure -- --base <ref>` (or `--at`), and keep `--assume` for real open readings.
- **Why it helps:** variants don't leak into the registry; the reading list stays the set of real open questions.

## 4. Kit ids vs. names when scripting

- **What happened:** my Imprisonment check ran on `chr_0013_aglina` (Gilberta) and found nothing; Arcane is
  `chr_0032_lizhiyan`. One wasted run.
- **Cause:** docs/open-problems.md and journal entries name operators by display name, scripts need ids; `efsim find`
  exists but the mapping isn't at hand while reading a section.
- **Suggestion:** a short id ↔ name table for the playable team at the top of docs/open-problems.md (or `efsim find
  --team`), generated from the data.
- **Why it helps:** saves a lookup per script; cheap.

## What worked well

- `npm run measure -- --assume <id>=<reading> --hits` in about a minute, with the changed hits per log: three variants
  measured in under ten minutes, the worse logs traced from hits.txt.
- `efsim zmdlogs replay <fixture> --from --to --assume` made the one-frame knife edge (bdf2's Nature burst) visible in
  a diff of two runs.
- The shared lock's short-job lane let my scratch probes run beside other agents' long jobs.

## Outcome (round 6)

2026-11-23, improvement round 6 (docs/friction-done/2026-11-23-round-6.md); what's left is in docs/friction/2026-11-23-backlog-after-round-6.md.

- 1 (the previous round's analysis only in another worktree's scratch/): done (95adc49): scripts/probes/<topic>/ with an index (scripts/probes/README.md: question, command, last run), the rule in CLAUDE.md and the README (a scratch script a doc cites for a number the next step builds on moves there in that commit); eleven cited probes promoted (buff-clock, hidden-holds, corrosion, edge, stagger) and open-problems' citations pointed at them.
- 2 ("whose clock" questions need a replay pass the API doesn't offer): not done: the hidden-holds clocks agent is refactoring logBuffReplay's run() now (the round-6 backlog, "Taken by the hidden-holds clocks agent").
- 3 (measuring a code variant needs a temporary reading): done (3e89a2b): docs/design/tests.md "Measuring a change", two variants are a WIP commit and the working tree with `measure -- --base HEAD` (or a commit each), never a reading added for one measurement.
- 4 (kit ids vs names when scripting): done (56a190e): `operatorId(data, "Arcane")` in @efsim/data (refuses an unknown or ambiguous name), `efsim find --operators`, `devFixtures({ withOperators })` taking names; the scratch template, CLAUDE.md and open-problems' header say so.
