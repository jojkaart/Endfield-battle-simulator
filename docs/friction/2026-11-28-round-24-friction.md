# Improvement round 24 itself (2026-11-28)

Task: improvement round 24 over five open friction reports and round 23's backlog, every file free; branch
worktree-agent-a81c8cc3cce38395d on main at 36d6843.

## 1. Three new views meant nine edits in one 940-line module

- **What happened:** `replay --windows`, `casts --passes` and `casts --event-lags --against-holds` each needed a usage
  block in packages/cli/src/commands/zmdlogs.ts (aligned by hand to the 42-column description), an entry in the one
  options object, and a branch in the one `run` whose order matters: `--passes` had to go before the castsReport
  return inside the casts/replay branch, `--against-holds` inside the event-lags branch, and an unknown name in either
  spot fails only when the view is run. About 15 minutes across the three, and the options object now holds
  `--passes` and `--against-holds` beside thirty other views' options.
- **Cause:** the CLI's one-module-per-command rule stops at `zmdlogs`; subcommands share one usage string, one options
  namespace and one dispatch (the backlog's point 1, carried since round 22).
- **Suggestion:** the backlog point as written: a `subcommands` field on command.ts's Command, packages/cli/src/commands/
  zmdlogs/ with a module per subcommand (usage, options, run), cli.ts parsing the subcommand's options; `zmdlogs which`
  reading the per-module usage.
- **Files:** packages/cli/src/command.ts, packages/cli/src/cli.ts, packages/cli/src/commands/zmdlogs.ts (split),
  packages/cli/src/which.ts, tests/zmdlogs-cli.test.ts.
- **Why it helps:** a view is one file; an option belongs to the subcommand that reads it.

## 2. A dropped rule's diff can't be run against a tool built for its failure

- **What happened:** the LOST lines exist because docs/tried/2026-11-28-opener-landed-at-press.diff dropped a logged
  crit; that diff is the ready-made check that the lines catch the case. It doesn't apply on HEAD (openerAhead
  replaced the function it edits), `node scripts/tried.ts refresh` names the conflicting file and stops, and on its own
  base (400bb44, named only in its prose) the new view doesn't exist. `cli-ab.ts` takes one `--patch`, so the view's
  diff and the tried diff can't both go onto the old base. About 10 minutes to conclude the episode can't be rerun;
  the LOST lines were checked on a synthetic case instead.
- **Cause:** a tried diff records its base only in prose, and the A/B tools apply one patch.
- **Suggestion:** `tried.ts new` writes a `Base: <commit>` line into the header; `cli-ab.ts` and `at-commit.ts` take
  `--patch` repeatably (applied in order; a conflict names the diff); `tried.ts run <diff> [--with <view.diff>] -- <efsim
  args>` puts both on the diff's own base and prints the view there.
- **Files:** scripts/tried.ts, scripts/cli-ab.ts, scripts/at-commit.ts, tests/tried.test.ts.
- **Why it helps:** a tool built after a dropped rule is checked on the episode that motivated it, not a stand-in.

## 3. One kind's thousand lines drown `zmdlogs decisions --all`

- **What happened:** with LOST lines (1027 over the development logs, landings 2+ frames off their logged hits) the
  plain `decisions --all` output grew by a thousand lines; the 26 COOLDOWN lines needed a grep to read, and `zmdlogs
  replay`'s window of a few seconds gets several LOST lines among its landings.
- **Cause:** the decisions view prints every kind; `--operator` is its only filter.
- **Suggestion:** `zmdlogs decisions --kind <K,…>` (only those kinds' lines; the per-kind table stays whole) and
  `--counts` (the table alone); `replay --no-lost` or LOST lines only with `--lost`, its header count always.
- **Files:** packages/logs/src/decisionsview.ts, packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts
  (or its subcommand module after point 1), tests/decisions.test.ts.
- **Why it helps:** a question about one kind reads its lines; the noisy kind stays countable for measure.

## 4. A Markdown draft in scratch/ is refused by the harness

- **What happened:** writing the round summary's draft to scratch/summary-draft.md was refused ("Subagents should
  return findings as text, not write report files"); it went straight into docs/friction-done/ and was finished there.
  A minute, but the rule isn't in CLAUDE.md, so the next agent tries the same.
- **Cause:** the harness refuses .md files it reads as reports outside the paths a task names; CLAUDE.md says to keep
  drafts in scratch/.
- **Suggestion:** one line under "Worktrees and sub-agents" (the lead's to apply): "Draft a doc in its final path
  (docs/…); a .md under scratch/ is refused as a report file."
- **Files:** CLAUDE.md (the lead's).
- **Why it helps:** no refused write before the paperwork.

## What worked well

- `node scripts/identity.ts --base 36d6843`: one five-minute answer that every record change of the round (MadeCast,
  BuffReplay fields, passStopParts) moved nothing.
- `node scripts/edit.ts` for every multi-block change (thirty-odd edit files), and its `<<<<<<< end` appends for the
  outcomes.
- `node scripts/runstate.ts --where` (built this round) the moment a snapshot run was in flight: its output's tail and
  the identity's EFSIM-DONE in one call.
- A 2-log measure (`--logs 4e5e,db87`) settled the overlap-clock report's "measure bug" in 13 s.
