# Improvement round 16 itself (2026-11-26)

Task: improvement round 16 over the five open friction reports and round 15's backlog, every file free; branch
worktree-agent-ac068a0dbd2ae58f4 on main at 33c3248. Points already in docs/friction/2026-11-26-backlog-after-round-16.md
aren't repeated.

## 1. The new backlog's parked and accuracy lists are copied by hand

- **What happened:** `node scripts/friction.ts carry` renumbers the numbered points it carries, but the new backlog also
  takes over the old one's "Parked" list (with a point newly parked added) and its "Needs an accuracy or search task"
  list (with closed entries dropped and new ones added). I wrote scratch/compose-backlog.ts (a head file, the carried
  point, the old lists sliced by heading, one closed entry cut by its first words, a new entry appended): about ten
  minutes, and a cut by text that breaks when an entry's first words change.
- **Cause:** the carry tool knows `## N.` points only; the two lists are prose sections every round re-copies.
- **Suggestion:** `node scripts/friction.ts carry <backlog.md> <n,…> --lists [--park <k,…>] [--drop <words>]`: also
  prints the old backlog's Parked section with the points named by `--park` added as one-line entries (title and
  where the full text is), and its accuracy list without the entries carrying a "Closed by" line; the round then adds
  only its new entries.
- **Files:** scripts/friction.ts, tests/friction.test.ts, docs/friction/README.md (step 5).
- **Why it helps:** the paperwork's longest part becomes one command, and a closed entry can't be carried by mistake.

## 2. A point partly closed comes out of the outcomes skeleton as "carried"

- **What happened:** round 15's backlog point 3 (the by-operator share) was closed but its stage flag, which I carried
  as the new backlog's point 2 with a **From:** line naming "point 3". `friction.ts outcomes --backlog` filled the
  old point's outcome as "carried (… point 2)", which hides that most of it was done; I rewrote it by hand. The same
  for batched-landings point 2 (done, its count carried).
- **Cause:** carriedFrom reads a **From:** line's "point n" as the whole point carried; "(its stage half)" after it is
  skipped as a parenthesis.
- **Suggestion:** a **From:** entry with a parenthesis ("point 2 (its count)") fills the outcome as "done but <the
  parenthesis> (carried: <file> point k)", the round writing what was done before it.
- **Files:** scripts/friction.ts (carriedFrom, outcomes), tests/friction.test.ts.
- **Why it helps:** the skeleton stays right for the common case of a point done but one part.

## 3. No test helper for a replay's records, so a decisions test fakes a BuffReplay

- **What happened:** the new BOTHPATHS decision has no case in the development logs (the slots-and-paths fix removed
  them), and making one through the engine needs a kit, a jump and pinned landings the path logic won't move. I tested
  replayDecisions on `{ skipped: [], tailCuts: [], …, made: [...] } as unknown as BuffReplay`: it compiles whatever
  fields BuffReplay gains or drops.
- **Cause:** tests/helpers/ has synthetic kits, hits and fixtures, none for the replay's records.
- **Suggestion:** `fakeReplay(parts: Partial<Pick<BuffReplay, "made" | "skipped" | "tailCuts" | "failed" | "missed" |
  "castFlags">>): BuffReplay` in tests/helpers/ (the rest empty or throwing "not faked"), used by the decisions tests.
- **Files:** tests/helpers/ (a new replay.ts), tests/decisions.test.ts.
- **Why it helps:** a decision kind gets a typed unit test without a log that shows it.

## 4. A new view next to query.ts must avoid an import cycle for one label function

- **What happened:** endsview.ts needs `operatorLabel`, which lives in query.ts; query.ts's `lanesView` needed the new
  moment-spacing helpers, so I moved those into query.ts rather than import endsview.ts from it (a cycle). The same
  pull put castsWithinGrain there.
- **Cause:** the views' shared formatting (operatorLabel, shortSkill, the seconds formatter `s`) lives inside the big
  query and views modules, re-declared in several (views.ts, clockview.ts, endsview.ts each have their own `s`).
- **Suggestion:** a small packages/logs/src/labels.ts with operatorLabel, shortSkill and the time formats, imported by
  every view (a move: `node scripts/split-module.ts packages/logs/src/query.ts --to labels.ts=operatorLabel`, then the
  copies replaced).
- **Files:** packages/logs/src/query.ts, views.ts, clockview.ts, endsview.ts, listingview.ts (a new labels.ts).
- **Why it helps:** a new view imports its labels from one leaf module; no helper lands in query.ts to dodge a cycle.

## What worked well

- scripts/edit.ts for every multi-line change (35 batches), and `npm run -s lint:changed` and `npx tsc --noEmit` after
  each: no batch needed a second try for lint.
- team-ab's identity check in about a minute for the engine record, and snapshots:update's new "keys added only" line
  answering the brief's "nothing moved" in one line.
- The reports' episodes as tests (6339's purges, e82d's 8.93 s and its 6.90 s instance, c4f3's batch, d4fb's bank).
