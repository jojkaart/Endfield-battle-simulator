## 2026-10-20: batch 3 — shared features, search over distributions

**Goal:** implement batch 3's merged gaps
([batch-3.md](../kit-batches/batch-3.md#merged-gaps)) with the owner's
decisions (enemy HP from the scenario; random results as distributions),
and finish batch 2's leftovers.

**Done:** N1 (enemy HP from the scenario, `enemyHpBelow`), A5 (Arts Bursts
land a second after their infliction, on the enemy's clock; the delay is
read from the burst buff's first tick), S2 for delayed trigger actions
(`KitTrigger.launch`), S4 (helper skills reached by CastSkill join the
operator's skills: Purrchena's shield loop and blocks). Four agents in
worktrees, merged one at a time with the full check, example totals and
log outputs after each: log tooling (batch 2 K6, batch 3 L1, L2), the
compiler leftovers (D2–D4: element, stagger, finisher factors, physical
statuses, branches, ticks, auras, gates), triggers and values (T1–T4, V2,
V3), buffs and statuses (V4, B1, B2, A1–A4, C1). The search ranks over K
seeded battles when a scenario has random outcomes, reports the found
rotation's spread, and is 2–8× faster (typhoeus-gilberta at beam 24: 290 s
→ 38 s) by memoising `advance` and judging most candidates by whether
they can start now. In-game tests 60–76 written. Arcane's kit: Final
Strike Stagger on attack 5, none on the finisher (its numbers were
hitEnvData, damage to scenery). 660 tests.

**Decisions and why:**
- The burst delay comes from BuffData (`triggerInterval` with
  `waitFirstTriggerInterval`), not a constant, so a data change follows.
- A search over random outcomes proposes each step from the scenario's
  own seed and replays it in the other battles at their own earliest
  frame (what `simulate` does with that seed); requiring one frame in all
  of them dropped nearly every child once dodges diverge.
- A helper skill takes the group and level values of the listed skill
  whose ID is its prefix (Purrchena's combo casts `normal_skill_loop_1`,
  a battle-skill helper).
- Kit interims the new features replace are left for each batch-3 kit
  (the agents listed them); no existing kit changed meaning.

**Problems:** the search branch was cut before S1/D1, so its pinned solo
total was stale (re-pinned: 1,176,753.682, the rotation replays exactly).
Two agents both created `tests/batch3-shared.test.ts`; one is now
`batch3-buffs.test.ts`. Agents still can't run `setup-worktree.sh` (tool
refusal) and link the packages by hand.
