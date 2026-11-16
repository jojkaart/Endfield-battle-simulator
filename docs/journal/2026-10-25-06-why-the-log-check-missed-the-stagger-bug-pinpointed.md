## 2026-10-25: why the log check missed the Stagger bug (pinpointed)

**Goal:** the owner: "it seems we've got a bug in how the log check
operates, since it missed the error. Let's pinpoint and fix that bug too."
The error (round-two review, 5): a Staggered enemy took ×1.69 in
simulations (`damageOptions` passes `staggered: true`, the ×1.3 Stagger
zone in damage.ts, and adds the multiplicative 0.3 "Staggered" as well),
since 2026-10-18 (f7fb100, batch 1 P2).

**Cause (confirmed):** the check never ran the simulation's damage path.
`checkLog` calls `computeHit` with options of its own for every reading:
`staggered: false` and the log's listed zone values (the ×1.3 came from
the log's `buff_common_poise_break_damage_taken_scale` entry), its own
finisher modifier, Link modifier, Corrosion on the log's clock, its own
situation; the replay (buffreplay.ts) only told it which kit buffs were
on. So the simulation's `damageOptions` (where the ×1.69 was) was never
compared with a log, and a fault anywhere in it was invisible. Evidence:
`zmdlogs check --simulate`, which does compute each hit at the replay's
landing through the simulation's path, disagreed even on plain matches
(b7b3 Si t=4862: plain match 4886, simulation 5631; Tangtang 0 of 45;
median logged / simulated 0.58–0.90 on the verified fixtures), but no
test asserted it: of 396 plain matches in the six verified fixtures, the
simulation reproduced 105 (the new test in tests/logs.test.ts, below).
The example snapshot didn't help either: it pins whatever the engine
computes (a regression baseline), so the ×1.69 was in it from the start,
and tests/timeline.test.ts only checked that a "Staggered" modifier
exists, not the hit's total factor.

**Where the check duplicates the engine** (instead of calling it at the
landing): (1) Stagger: `staggered: false` + the log's ×1.3, so
Staggered-only modifiers (attribute 61, 8 gear lines) never apply; (2)
kit buffs' values: the log's entries (`replayedHits` keeps them, or copies
another hit's), never the kit's modifiers; on/off only from the replay;
(3) the finisher (`finisherModifier` / `isFinisher` vs landing.ts); (4)
Link (`linkModifier` vs casting.ts); (5) Corrosion on the log's clock and
`corrosionCapScale` (vs status.ts and `statusTweaks`); (6) Arts Intensity
of reactions from the panel and the log's entries (vs `artsIntensity` at
the frame); (7) Combustion's snapshot from the log's reaction hit
(`combustionSource` vs `ActiveStatus.snapshot`); (8) stacking:
`countedInstances` / `kitStackCaps` / `layerVariants` (vs `withBuff` and
stack groups); (9) decorate masks and skill types from BuffData
(`reaches`, `buffSkillType` vs the kits' `onlyKinds` / `skillType`); (10)
the situation the hit's conditions and values read (the check's own
`{team, …facts}` vs `situationAt` at the landing); (11) kit buffs valued
outside the timeline (`unloggedOwnBuffs`, `unloggedEnemyAuras`,
`unquantifiedFromKit`, `unloggedCastBuffs`: `kitBuffModifiers` with no
situation, layers tried); (12) the kit hit (`findHits` + `hitAvailable`
vs the timeline's branch and `if`); (13) event counts and fight values
tried (`eventCounts`, `valueAssumptions`); (14) food (`withoutOwnFood`,
`teamPanels`).

**The first test that would have caught it** (tests/logs.test.ts,
"reproduces each plain match through the simulation's damage path"):
every plain match in a verified fixture must be reproduced (±1, same
crit) by its landing in `simulateLog`. On the current code it fails in
all six (0eef 26, 40d9 10, 4e5e 109, b7b3 14, bdf2 105, dbae 27 of 396):
kit buffs logged under another game buff and counted twice (the
`buff_common_affixes_*` Susceptibility and Amp of Li Zhiyan, Si, Camille
and Liino; `_owner` and potential variants: ~170), Stagger twice (~60,
with the replay's Stagger also on where the log has none), kit buffs the
engine has on and the log off or the reverse (heal- and chance-triggered
ones the replay can't judge, edges: ~60), logged crits not fed to
landings a trigger made (~10), Link where the replay can't say, 13 with
no landing.
