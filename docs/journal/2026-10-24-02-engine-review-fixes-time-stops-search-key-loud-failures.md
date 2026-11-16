## 2026-10-24: engine review fixes (time stops, search key, loud failures)

**Goal:** fix the bugs the 2026-10-22 review of packages/engine/src found
and make its silent failures loud (principle 7).

**Done** (one commit each, a failing test first for each bug):
- Q3: a teammate's time stop now delays a frozen operator's pending team
  energy with its hits; delayed actions shift by their cast's operator
  (as they're cancelled; same as the owner for every kit today).
- Q2: SP stops are intervals (`spStops`): regen runs until a slow-down
  starts. Before, the regen between the state's frame and the start was
  lost (a slow-down frames into its cast: Camille's second combo, 34
  frames; one cast by a trigger inside an advance), and a later spend
  erased a stop's pause. Only SP after casts moves: camille-gilberta +9.07
  from 421, alesh-estella −8.53 from 96 (Estella's battle skill inside
  Alesh's 77-frame stop no longer erases it); no total, no fixture.
- R5: `stateKey` is exhaustive by construction (`KeyRules` records). The
  old key merged states differing in, among others, a pending hit's
  `controlledAtCast`: the pinned duo search moves 269,470.931 →
  264,948.959 (685 → 680 states); the solo one is unchanged.
- Q1, Q5, Q7, Q4: only EngineError makes an action illegal; status-event
  damage is an exhaustive switch; the combo-rate cooldown loop reports
  when it doesn't settle; the enemy, attribute defaults, burst delays and
  (when dodging) perfect-dodge settings are checked in `createContext`.
- R4: `advance`'s memo lives on the search's context (`memoised`).
- Q6: `activeAt` and one `buffEndedEvent(s)` builder; the six builders'
  disagreements (recorded, remaining of consumed layers) change nothing
  in today's data.

**Decisions and why:** raw cast indices stay in the search key (they were
already there through `acting` and per-cast trigger keys); SP and energy
keep their 0.1 rounding (floating-point noise). The combo-rate loop
returns an error like the SP and input loops rather than throwing.

**Left:** what's created between a slow-down's cast and its start, or
during it (buffs, a spend's pause, a frozen teammate's cast during a
stop), isn't shifted; the module-level WeakMap caches (`committed`,
`ownWindowCache`) could move to the context too; buffreplay.ts still
writes out its own active test (left to the log-checker work).
