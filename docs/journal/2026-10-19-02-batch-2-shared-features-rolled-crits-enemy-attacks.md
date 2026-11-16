## 2026-10-19: batch 2 — shared features, rolled crits, enemy attacks

**Goal:** implement batch 2's merged gaps
([batch-2.md](../kit-batches/batch-2.md#merged-gaps)), with the owner's
decisions on enemy attacks, crits and perfect dodges.

**Done:** group 1 (L1, B4, D4, S2, S4, V2, B2, D1, D2), group 2 (T1–T6,
C1, C2), group 3 (V1 hit base values, B1 Link buffs, B3 shared timers, S3
chain steps by timing, S5 team energy in parts, S6 the gate seeing an
action's end); E2: crit mode `rolled` with seeded streams, crit events
for triggers, `simulateRuns` / `efsim simulate --runs n` for the spread;
E1 part 1: the scenario's enemy attacks and charges as events on the
enemy's clock. Example totals and log verdicts unchanged throughout.

**Decisions and why:**
- `teamEnergy` parts replace `teamEnergyFrame` (one mechanism; kits
  migrated), with kit-draft reading each CreateBuff's `ratio`.
- S6 finds when an action ends by advancing and bisecting, only for kits
  that can end their own action: generic (any trigger path) and cheap.
- One random stream per source (`crit`, later dodges), seeded from the
  scenario's seed and the stream's name, so adding dodge rolls doesn't
  reshuffle crits. With `expected` crits no hit counts as a crit for
  triggers (design.md).
- Enemy actions run on the enemy's clock, so time stops delay them.

Later the same day: S1 (jumps skip time; conditional jumps by
`KitSkill.jumps`, event-driven ones by a trigger's `jump`;
InterruptCurSkillAction ends the action) and E1's dodges (`dodge:
{chance}`, perfect dodges from BuffData: SP, the world's slow-down, the
dodger's freeze). Laevatain's battle skill now locks her 37 frames;
laevatain-solo does the same damage in 22.4 s instead of 29.2 s.

- Jumps skip time because Catcher's data is inconsistent otherwise; test 17
  confirms on Laevatain. A buff bound to its cast counts the frames a jump
  took from it as time it had left, so Twilight gets back the skipped part
  of its pause.
- Dodges are automatic at each attack on the controlled operator (the
  owner's with/without/chance comparison), not rotation steps; the dash
  ends the current action, so a rotation recorded without dodges may
  become invalid (search plans around the attacks).

**Problems:** Ajv's strict mode refuses `anyOf: [{required: [at]}, …]`
in the scenario schema; dropped (an action with neither does nothing).
The dodge-research agent's `git show` calls fetched about 200 files from
GitHub into the data submodule (a blobless clone), and it briefly ran a
repo-wide `git grep HEAD`, which would fetch everything; stopped. Never
`git grep HEAD` there.
