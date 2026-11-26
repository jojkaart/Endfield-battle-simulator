# A stop's batched landings and Pogranichnik's Morale (2026-11-26)

Task: the order of the landings the log batches at one ms (c4f3 7.05 s), the Vulnerable stacks c4f3's 13.07 s Breach
consumed, and d4fb 86.67 s's Fervent Morale; branch worktree-agent-ad6a5b29790022cbb.

## 1. The Stagger bar's meaning was written down backwards in open-problems

- **What happened:** open-problems' c4f3 entry read the bars as rising ("Chen's group at 224, Estella's ultimate 234,
  her combo 264 put Chen's combo first, so the question is why it didn't shatter"), which pointed the lead's brief at a
  wrong question. The code (replaysteps.ts `loggedPoiseBars`: `before = bar + dealt`) says the bar is what the hit
  leaves; read that way the bars give Estella's combo first, the whole answer. It took a detour through combat-mechanics
  §5 and a grep for `poise.bar` to settle which way the bar runs.
- **Cause:** `LogHit.poise.bar` has no doc comment saying "the bar after this hit (before = bar + dealt)", and
  docs/design/data.md's "What the log records" doesn't say it either; the fact lives only in replaysteps.ts's
  arithmetic.
- **Suggestion:** a doc comment on `poise.bar` / `dealt` in packages/logs/src/zmdlogs.ts ("the Stagger bar this hit
  leaves; before it: bar + dealt; it falls in the game's order within a batched ms: castassembly.ts batchOrder") and
  one line in data.md's "What the log records".
- **Files:** packages/logs/src/zmdlogs.ts, docs/design/data.md
- **Why it helps:** the bars are the log's only order inside a batch; misreading them sends a diagnosis the wrong way.

## 2. No view prints a batched ms's events in the bars' order beside the replay's

- **What happened:** to compare the game's order with the replay's I wrote three scratch scripts (bars per batch;
  bars against operator ID / team slot / cast start; the replay landing index of each event), about 40 minutes, before
  the fix was obvious. `zmdlogs replay` marks `[batched: 7 hits at this ms]` but shows neither the bars nor whether
  its order agrees.
- **Cause:** the views show batch membership, not the order evidence the log has.
- **Suggestion:** on `zmdlogs replay` / `casts` LAND and HIT lines of a batched ms, append the event's bar
  (`bar 274 → 264`) and, on the replay view, a `BATCH` line when the replay's landing order differs from the bars'
  (a count in `zmdlogs decisions`). scripts/probes/physical/batch-rules.ts has the reading.
- **Files:** packages/logs/src/views.ts (replay and casts views), packages/logs/src/decisionsview.ts
- **Why it helps:** the next order question (several remain: Estella's weapon ATK in the same batch) starts from one
  command, not three scripts.

## 3. A kit's stack values aren't traceable in the replay

- **What happened:** for d4fb 86.67 s I needed Pogranichnik's `sp_banked` value at each step (why the bank crossed 80
  at 86.97 s in the replay, at 86.67 s in the game). `--trace-buff` takes kit buffs and enemy statuses, `--trace-trigger`
  firings; nothing shows a kit stack's value. I inferred it from the trigger firings and the buff durations (10 s vs
  20 s layers) instead, and nearly chased a bank shortfall that wasn't there.
- **Cause:** `TimelineState.stacks` changes aren't recorded by the replay's tracer.
- **Suggestion:** `--trace-stack owner:stack` on `zmdlogs replay`, a TRACE line per change of the stack's value with
  the step that made it (as --trace-trigger does), in the replay record (replayrecord.ts).
- **Files:** packages/logs/src/replayrecord.ts, packages/logs/src/views.ts, packages/cli/src/commands/zmdlogs.ts
- **Why it helps:** banks and counters (Pogranichnik's bank and Steel Oath, other kits' stacks) are a frequent
  "late by one event" cause; their values are the direct evidence.

## 4. "Fixed" items in open-problems have no place of their own

- **What happened:** two of the entries I worked on became fixed; open-problems is "what's still unexplained", so I
  rewrote each in place as "Fixed …, Still open: …", which leaves long fixed histories under "Still possible (not
  fixed)" headings.
- **Cause:** the file's sections are per diagnosis round; there's no convention for an item that a later round fixes.
- **Suggestion:** a line in CLAUDE.md's journal paragraph (the lead's) or open-problems' header: a fixed item shrinks to
  one line naming the journal entry, its remaining open points move to the round's "Still possible" list.
- **Files:** docs/open-problems.md (header)
- **Why it helps:** shorter open-problems, and the open part of an item stays findable.

## What worked well

- `node scripts/cli-ab.ts HEAD -- zmdlogs replay c4f3 …` showed every hit from 7.05 to 14.43 s turning exact in one
  run: the knock-on to lead 2 was visible immediately.
- `measure --split files` separated the kit change from landing.ts in one run, with none worse.
- `node scripts/at-commit.ts HEAD --run <probe>` gave the base's Breach-path table without a second checkout.
