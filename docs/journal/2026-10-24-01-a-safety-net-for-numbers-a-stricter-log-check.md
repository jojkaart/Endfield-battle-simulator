## 2026-10-24: a safety net for numbers, a stricter log check

**Goal:** a review (2026-10-22) found that nothing pinned the examples'
results (a change moved `antal-focus` unnoticed), that the log test passed
on "no mismatch" alone while hits drifted to weaker verdicts, that any
hit under any unquantified buff counted as "unmodelled" (d9e5: 0 of 98
matched, passing), that matches said nothing about how many readings
were tried, and that catch-alls turned real errors into "doesn't apply".

**Done:**
- Snapshots (`tests/snapshots/`, a regression baseline, not values with
  provenance): every example scenario (total, counts, damage per
  operator, a hit digest whole and per 10 s; a failure lists the hits
  from the first window that moved); verdict counts per operator of
  every log fixture, verified ones as a ratchet, pending ones exactly.
  `npm run snapshots:update` writes them.
- `checkLog` tries every reading: per match `readings` (tried, matching),
  `assumptions` as data, a `class` (plain, assumed, log-listing
  fallback). New verdict `unvalued` (a buff the log lists without a value
  that no kit values); `unquantified` has a `reason`, and Corrosion
  excuses a hit only when the least and most shred it can give bracket
  the damage. `verificationProblems` is what "verified" means
  (design.md, "What a log check verifies"); `zmdlogs check` prints it,
  the plain / assumed / fallback counts and a strength line with flags.
- Catch-alls: the engine has `NeedsSituation` (expr.ts values that need
  a fight's state; not an EngineError, as before) and `HitRuledOut`
  (computeHit's "doesn't happen", still an EngineError);
  `readingDoesNotApply` is all logcheck.ts and reactioncheck.ts catch.
  That exposed one real error: Lifeng's `p5_timer` (ticks every 0 frames
  below P5) applied by `unloggedOwnBuffs`, which crashed d4fb and de6a;
  buffs without modifiers are skipped now (they can't change a hit).
- The replay's "fit" counts hits under unvalued or unmodelled effects as
  "neither" (0eef: "neither 10" where it said 0).
- `npm run test:logs` (tests/slow/, in `npm run check`): the pending
  fixtures in two shards and the negative control; `npm test` keeps the
  verified fixtures and the examples.

**Verdict changes (before → after):** d9e59d0fb737 Typhoeus mismatch
0 → 42 (unmodelled 48 → 6), Arcane 0 → 13 (16 → 3), Gilberta 0 → 8 (9 → 1),
all from the Corrosion bracket: every hit after Arcane's ultimate is
×1.7–2.0 the prediction. Pending 04d401ad257e Catcher mismatch 243 → 252
(unmodelled 9 → 0), Purrchena 241 → 242 (9 → 8); 4e3651100056 Ardelia
123 → 130 (7 → 0). d4fb69b036fe and de6a94e9cf6b crashed after the
catch-alls went and check as before with the p5_timer fix. No other
count moved: the unvalued rule changed nothing today (every unquantified
buff in the fixtures is Corrosion), nor did trying every reading.
Verification moved d9e59d0fb737 (mismatches), dbaee23b801d (Liino and
Xaihi only fallback matches) and 0eef2474a26f (Arcane only fallback)
to fixtures/pending/ (README); 40d9, 4e5e, b7b3 and bdf2 verify.

**Negative control** (×0.97 / ×1.03, chance matches of judged hits): 40d9
0 / 0 of 56, 4e5e 11 / 0 of 345, b7b3 0 / 0 of 84, bdf2 3 / 5 of 166; the
moved ones 0eef 0 / 7 of 65, d9e5 0 / 2 of 96, dbae 1 / 0 of 77. The 4e5e
ones are all Wulfgard's attack 4 (about 1,200 damage, so ±1 is 0.08%) with
`buff_equipsuit_critsuitatk_01 ×4 layers` where the true reading is ×5:
one layer is a 3% step; bdf2's and 0eef's are Corrosion levels. The test
allows 4% of judged hits, not the hoped-for "close to none".

**Decisions and why:**
- Fallback matches don't verify an operator alone: the owner wants the
  engine, not the log, to decide buffs; a fallback shows the damage
  formula with the log's buffs.
- Corrosion's bracket instead of dropping the excuse: its ramp doesn't
  fit every log (time stops, talents), but a hit below the damage with no
  shred or above the most it can shred can't be Corrosion's doing.
- The pending snapshot is exact (any move is looked at), the verified one
  a ratchet (gains pass, with a note to update).
- `unvalued` is its own kind, not a mismatch: the prediction lacks a
  buff, which isn't the kits' error; it still fails a verified fixture.

**Dead ends:** applying Arcane's Corrosion cap raise (talent 2's
`capScale`, which the timeline applies) to the check's Corrosion levels
lost Si's two matches in bdf2 (assumed 2 → 0, her only non-fallback
ones): left out, a lead (roadmap 5).

**Timings** (4 CPUs, other work running, `--maxWorkers=2`): `npm test`
562 s (61 files, 82% of it loading the game data per file), of which the
examples' snapshot about 8 s and the four verified log fixtures about
35 s of checks; `npm run test:logs` 239 s (the 22 pending fixtures in two
shards, about 3 min; the negative control about 1 min, 4e5e's two runs
most of it).
