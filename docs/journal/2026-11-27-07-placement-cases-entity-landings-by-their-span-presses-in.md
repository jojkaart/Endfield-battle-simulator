## 2026-11-27: Placement cases: entity landings by their span, presses in away stretches, used-up casts by value

**Goal:** the placement and cast-assembly cases the two one-sided rounds left (docs/open-problems.md "Log-only
landings", "Replay-only landings"): f879 95.10 s, 5082 45.06 s, 3aa6 125.65 s, Pogranichnik's harasses, 99fb's bleed
ticks, Arcane's INT lasers, 9a80 34.94 s; beside an agent on status pairing (buffreplay.ts theirs).

**Done** (docs/open-problems.md "The placement cases the one-sided rounds left"; tests/placement-cases.test.ts):
- **An ability entity's landings are due within the slots' span** (logcasts.ts onEntityClock): a key's next landing
  joined the open cast while it had slots to come within the skill's whole duration (9.4 s for Laevatain's battle
  skill). An entity's landings (`launch`; no flight, buff timeline, enemy delay or random count; not a buff's key) come
  at their own frames whatever the cast does. f879: the 94.71 s Magma Fragment explosion had been the 87.12 s cast's
  first tick (that cast's ticks unlogged; their radius, 2.5 against the explosion's 3, is one possible reason), so the 95.94 s empowered hit made a
  battle skill at 92.48 s, before her final strike's Heat absorption at 92.49 s; now one cast at 93.98 s with 4 Melting
  Flame, and the 162,889 lands. Also 6339 31.62 s, Zhuang Fangyi's attack 2 / 4 ranges in 3aa6 and 4bfc. Rossi's
  combo afterhits (a buff's timeline, 9a80 29.20 s) are left out: measured first without that, 9a80 lost 64 plain.
- **A slot press whose first landing is due in an away stretch is `unseen`** (castassembly.ts, awayWindows), **made as
  the button's variant the kit holds** (replayrun.ts replayedSkill): 3aa6 125.65 s, Zhuang Fangyi's Empyrean battle
  skill 0.08 s after the last hit before a 14 s gap; its Sunderblade is the 145.74 s cast's ninth, the 148.68 s final
  of 9 lands.
- **A second landing at a used-up cast's last ms isn't the same landing on a second enemy when both are non-crits in
  the ratio of slot 0's multiplier to its slot's** (logcasts.ts nextByValue): 9a80 34.94 s, Si's final (349,888) and
  her next combo's first slash (28,396); the 36.10 s final now on its slot. First by the values' ratio alone: 9c6e (two
  targets under one id, their values ×1.3+ apart by their own debuffs) lost 36 plain while its total went −20.6 →
  −0.9%, the second target's landings made as casts of their own: the wrong mechanism.
- A press made in an away stretch takes what a cast takes: 7b54's Si at 24.81 s (21.06–26.98 s without a hit, the
  slug) is made as Initial Stroke and takes the team's Link stack her 29.00 s cast had (7b54 +40.3 → +40.4%).

**Scoreboard** (`npm run snapshots:update`): development plain 81.5 → 81.7%, mismatch 6.3%, mean |damage error| 3.4%,
as other kit hit 96 → 93, |matched| 2.4 → 2.3%, replay-only 3.6 → 3.3%, log-only 3.1 → 2.9%; earlier pending plain
81.6 → 81.7%, log-only 0.9 → 0.7%, as other kit hit 58 → 50; hold-out and verified unchanged. Better: f879 (plain
793 → 821, mismatch 15 → 6, per hit 1.86 → 0.62%; total 0 → +1.5%: the missing 162,889 had cancelled over-predictions),
6339 (−14.1 → −12.6%), 9a80 (277 → 279), 3aa6 (413 → 416, per hit 3.56 → 2.70%), 4bfc (856 → 861). Worse: 7b54 +40.3 →
+40.4% (below). Log tools only: no simulation reads them, no team-ab.

**Decisions:** the entity rule as "no toCome" rather than a new bound: the slots' span plus CAST_SLACK_MS is the bound
the pass already has for every other landing. The away test beside the ±1 s quiet test, not instead of it.

**Dead ends:** the replay's JUMPDROP leaving out landings launched before the jump (engine drivers.ts; f879's ticks
dropped her empowered jump): no development log moved, one hold-out −23 plain, dropped
(docs/tried/2026-11-27-jump-launched-landings.diff). Yvonne's chain window held by the hidden holds: they sit spread
over 1.5 s mostly before her cast (3 of 15 frames), not built.

**Left:** 5082's Yvonne (her timeline held ~0.5 s at her combo's Stagger break, 44.43 s; a break dilation the data
names, enablePoiseBreakTimeDilation, with no length), Arcane's INT lasers (the log's batched ms), Pogranichnik's
harasses (the entity's own 0.4 s slow-downs and teleport, not modelled), 99fb's bleed after Rossi's ultimate (the
statuses' side).
