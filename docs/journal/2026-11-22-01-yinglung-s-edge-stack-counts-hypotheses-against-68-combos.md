## 2026-11-22: Yinglung's Edge stack counts: hypotheses against 68 combos

**Goal:** the owner's brief: list deterministic causes for the Type 50 Yinglung's Edge count diverging from the
logs (about a third of combos, both ways), score each against every wearer combo in the development logs, iterate
on the misfits, implement a winner.

**Done:** the set's data (`gamedata tree` on its four buffs: an aura's detector on every member, a layer to the
wearer on that member's battle-skill cast, cap 3, no duration, the wearer's combo takes all). Per combo the layers
the damage implies (both readings' DMG-bonus gap in 0.2 units; Jade Vessel's 0.3–0.7 separates as it isn't a
multiple of 0.2): 68 Si and Bounda combos decided, the rest left out with named non-Edge causes. Thirteen first
hypotheses and two new ones scored (open-problems.md "Type 50 Yinglung's Edge", the table): the engine 52 exact /
4 first-combo lower bound / 12 wrong; every logged cast 58 / 0 / 10; without Si's hitless presses 55 / 4 / 9;
expiries, own-only, teammates-only, ultimates, any wearer's combo clearing, first-hit timing all worse. The
misfits suggested two new causes: **N2** Si's first press after her battle skill counts (Initial Stroke under
Artful Intent) and her other periodic presses don't; **N1** layers are lost over a pause with no hit (3f78 and 4a64
after ~20 s, 7b54 after 5.9 s; abfd keeps them over 4.9 s): together 64 / 1 / 3.

**Replay fix (buffreplay.ts):** a Final Stroke inferred from the mark's own burst (the kit's no-Inksoul branch,
where Final Stroke can't be cast) is now an expiry (an `expires` step, no cast): 0c14 81.7 and 489c 107.6 3 → 2;
the engine 54 / 4 / 10. Tried and reverted: making Laevatain's Twilight battle skill once where the replay makes it
twice (the `normal_skill` event and the placed `normal_skill_during_ult`, db87 41.2 3 → 2, plain 114 → 126): the
same static rule broke Purrchena's battle skill and counter (04d4); the replay's state has to decide.

**Decisions:** N1 and N2 not built into the engine: N1 needs "leaving battle", which the log doesn't record and the
simulator's fights don't have (test 106 (e) asks the owner); N2 in the replay means making every press under
Artful Intent the stroke the slot holds, and the replay's Artful Intent outlasts the game's (its Inksoul-burst
Final Strokes 2–3 s after the last press fit the expiry better), so it waits on that. Estella's five single-hit
combos don't decide anything (her Razorhorn ATK was fitted on the same hits).

**Left:** c779's moved layer, 0c14 166.7 (two layers and Jade Vessel short); the replay's stroke reading (Final
Stroke only with a press just before the burst; Initial Stroke at the first press). In-game test 106 now asks only
(e) a pause / leaving combat and (d) whether Final Stroke gives a stack.
