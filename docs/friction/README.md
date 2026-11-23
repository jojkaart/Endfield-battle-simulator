# Friction reports

Reports by agents on what in the code design, the repository, the docs or the
tools made their task harder than it should have been, and how to fix it.
They feed periodic improvement rounds (the owner, 2026-11-16).

## The process

1. **When a sub-agent finishes a task**, the lead resumes it once more and
   asks for a friction report (the request below). The agent writes one file
   here, `docs/friction/YYYY-MM-DD-<slug>.md`, and commits it on its branch;
   the lead merges it with the rest of the branch.
2. **When about five reports are here**, the lead launches one sub-agent to
   read them all, work out the common causes, and implement the improvements
   (architecture, docs, tools, process). It moves each report it handled to
   [docs/friction-done/](../friction-done/README.md), adding a line per point
   saying what was done (or why not), leaves a summary of the round there,
   and writes its own journal entry. This folder only holds what still needs
   doing.
3. Accuracy rules still apply to improvement rounds: tests stay green,
   snapshots only move with a reason, `scripts/premerge.sh` before merging.
4. **The backlog stays short** (round 6): a branch that closes a backlog
   point (any task, not only an improvement round) adds one line under it
   in the same branch: "Closed by <branch>, <commit>: how". A point carried
   through two rounds without a new report hitting it moves to the
   backlog's "Parked" list (one line: title, where its full text is); a
   new report that hits it again brings it back, its text from there.
5. **The paperwork:** `node scripts/friction.ts outcomes <report.md…>
   --round <n>` prints each report's "Outcome (round n)" skeleton (a line
   per numbered point), `node scripts/friction.ts carry <backlog.md> <n,…>
   --start <k> --label "<name>,"` the points carried into the next backlog,
   renumbered, their **From:** lines extended.

## What a report contains

A report must be complete on its own: someone who reads only it understands
each problem, the suggested fix and why it helps, without the agent's
transcript.

```markdown
# <task in a few words> (YYYY-MM-DD)

Task: one or two sentences on what the agent was asked to do, and its branch.

## 1. <problem in a few words>

- **What happened:** the concrete episode (what the agent tried, what went
  wrong, how much time or how many attempts it cost), with file paths,
  function names, commands, error messages.
- **Cause:** the structural reason (design, layout, missing tool, stale or
  scattered docs, slow feedback, ...), not just the symptom.
- **Suggestion:** the change, specific enough to implement (where, what).
- **Why it helps:** what it saves future agents, and any risk or cost.

## 2. ...

## What worked well

Short: things that made the task easy and should be kept.
```

Only real friction the agent hit, ordered by cost; a task with none says so
in one line. No player names, account IDs or private data.

## The request (for the lead to send)

> Before you finish: write a friction report as `docs/friction/YYYY-MM-DD-<slug>.md`
> on your branch and commit it (format: docs/friction/README.md on main; in
> short, per problem: what happened, cause, suggestion, why it helps, complete
> enough that reading the report alone is enough). Cover structural problems
> in the code design, repository, docs or tools that slowed you down or caused
> mistakes, and how to make future agents' work easier. Only real friction you
> hit, most costly first; then a short "what worked well".
