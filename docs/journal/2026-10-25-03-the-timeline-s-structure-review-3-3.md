## 2026-10-25: the timeline's structure (review 3.3)

**Goal:** restructure the timeline engine without changing a number:
split timeline.ts, one list for everything scheduled, one documented
order within a frame, and see whether results depend on team order.

**Done** (one commit per step; design.md "Engine modules", "Order within
a frame"):
- timeline.ts (2,963 lines) is a façade over thirteen modules in
  `timeline/` (state, rules, context, schedule, clock, resources, timing,
  situation, actions, landing, casting, advance, drivers; 101–399 lines
  each), moved whole by a script with imports from the type checker;
  `@efsim/engine`'s exports are unchanged.
- `TimelineState.scheduled` replaces pending, pendingActions,
  pendingEnergy, pendingJumps, pendingBursts and enemyActions: a header
  (frame, clock: world / enemy / operator, cast `{operator, index}`,
  detached, launchAt, pinned) and a payload by kind. Shifting a clock,
  ending a cast and a jump are one pass each (`shiftClock`, `cancelCast`,
  `jumpCast`, by `castBound`). One haste helper (`hasteFrames`) for the
  seven places that mapped skill frames to real ones.
- advanceFrom's ten scans and `first(...)` lists are one table
  (`IN_FRAME`) and one comparator (`dueBefore`: frame, step, operator ID
  for two hits, order scheduled); `nextDue` / `runScheduled`.
- `tests/team-order.test.ts`: every example under every order of its team
  gives the same hits; `tests/schedule.test.ts`: the order and the passes.
- Leftovers of 2026-10-24: the WeakMap caches are on the context
  (`ownWindows`, `committedMemo`); buffreplay.ts uses `activeAt`.

**Numbers:** identical everywhere (every example plain, dodging every 4 s
and with rolled crits, at full precision; both searches; the kits
snapshot; verified log verdicts exactly; pending ones and the negative
control) but one order: akekuri-laevatain's Laevatain battle-skill `dot`
and `empowered_extra` at frame 972 swap back to kit order (the old
takeJump rebuilt the whole hit list with every detached hit not launched
yet at its end, whichever cast jumped); same damage, total moves 1e-10,
examples.json digest updated. Speed unchanged within the machine's noise
(alternating runs, best of 3: simulating every example 392 → 412 ms,
search laevatain-solo 3.71 → 3.69 s, si-laevatain 10.7 → 10.7 s).

**Decisions and why:**
- The order within a frame is the one the scans encoded: they were
  consistent (hits, then afterHits actions, then jumps), only written
  differently. Hits of different operators at one frame stay by operator
  ID rather than scheduling order: it keeps hits apart from team order;
  scheduling order would move si-laevatain only (order; with rolled
  crits, which hit draws which roll). The game's order isn't known.
- The search key projects the scheduled list per kind, in order, so it
  merges exactly the states it did (interleaving of kinds doesn't matter:
  each kind has its own step); kind and clock are derived, left out.
- A burst's event no longer carries its frame (the item's is the frame
  a shift moves).
- Team order: the game reads team positions (Si's Team Position 01:
  si-laevatain with Laevatain listed first can't cast Si's combo, her
  battle skill inflicts Heat); otherwise only triggers on one event run in
  team order (their actions and `chance` draws), which no example depends
  on. Kept, and documented; what the game does there is unknown.

**Dead ends:** an order-preserving jump pass alone changed akekuri's
order; the step-2 commit kept the old order on purpose (legacyJumpOrder)
so that the order change sits in the commit that explains it.

**Left:** what's created between a slow-down's cast and its start, or
during it, still isn't shifted (now one place to do it); buffs' ends and
ticks could be scheduled items on the world's clock; whether the game
runs simultaneous hits by anything we can model.
