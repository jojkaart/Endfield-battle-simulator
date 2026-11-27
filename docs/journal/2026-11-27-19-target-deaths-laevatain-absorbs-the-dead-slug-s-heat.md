## 2026-11-27: Target deaths: Laevatain absorbs the dead slug's Heat

**Goal:** on main at 14fe159, beside the tail-cuts agent: the several-targets row's replay-only Heat bursts after
Camille's Vesperwings moves (6339 21.60, 25.57, 33.17 s) and statuses per target; the kits' listeners on a target's
death (docs/open-problems.md "Hard 33's Woodcraft Slugs").

**Found:**
- **Laevatain's passive_enemy** (BuffData abilityEvent 1, HP 0, on every enemy her talent-0 aura reaches): at the
  enemy's death it counts its Heat Infliction layers, absorbs each and gives her as many Melting Flame (no room check,
  no cooldown). Not in the brief's list, found by a census of every abilityEvent 1 handler (scratch/hpzero.ts). Each
  of 6339's three bursts is a move's Heat on a slug the replay's one enemy still held the dead slug's Heat for: the
  kill's absorption takes it, and the 31.62 s kill's gives the fourth Melting Flame the 35.70 s empowered hit needs.
- **The other listeners:** Arcane's spell_vulnerable handler is all disabled (nothing to build), Typhoeus's
  combo_trigger_combo empty; Si's inkhurteffect and normal_skill_check carry her Artful Intent's record onto an ink
  phantom entity (not built); Zhuang Fangyi's, Seraph's, Tangtang's, Yvonne's are in no several-targets fight.

**Done:** engine targetDies takes TargetDeathOptions (`except`: triggers that don't run; `endsStatuses`: the replay's
enemy's statuses and due bursts end), replayEvent an `only` predicate; replay assumption **`target-deaths`** (default
`kills`: a death at every logged kill of a fight read per target, an operator whose death trigger lands a hit, Camille,
running its triggers only where its landing is logged; `moves`, the old; `statuses`); targets.ts targetDeaths,
replaysteps.ts runEventStep, replayrun.ts's death steps (one function, committed alone, its message naming the
tail-cuts agent); kit trigger `death_absorb`; tests/target-deaths.test.ts; the design of statuses per target in
docs/design/data.md (a second replay pass with each landing's target, levels as values, the Stagger per hit).

**Scoreboard** (`npm run snapshots:update`; measure against 14fe159): the several-targets row plain 71.3 → 71.6%,
mismatch 15.3 → 15.2%, mean |damage error| 6.3 → 4.6%, within 5% 1 → 2, replay-only 17.8 → 16.4%, log-only 22.9 →
19.7%; 6339 plain 120 → 121, −6.3 → +0.1%; 7b54 mixed (plain 116 → 117, mismatch 82 → 81, per hit closer, −1.2 →
−2.3%: Si's replay-only 30.50 s burst gone, which had offset its log-only twins). Development, earlier pending and
verified unchanged. **One hold-out worse** (|damage error| 5.8 → 5.9%, totals and battle-skill keys, the same under
every reading): the one unmarked log whose replay makes a death (round 20: a logged Vesperwings move), where the
death now runs the team's death_absorb too. By operator, Laevatain's mean 6.6 → 9.0% (6339's 21.60 s replay-only
hit_2, TAILKEPT, no longer offset by the missing empowered hit), Camille's 9.1 → 5.0%. Team fights unchanged
(team-ab identity at 14fe159: no simulated fight has a death).

**Decisions:** `kills` over `moves` (row 4.2% under `moves`): every death runs the triggers the data puts on the dead
target, not only those where Camille's move happens to be logged; its 7b54 total moves only because a replay-only
burst it removes was offsetting. `statuses` rejected (6339 −5.0%): its 29.26 s Laevatain combo hit needs Combustion
or Corrosion on its slug, which only the one enemy's kept 24.03 s Combustion gives; 9c6e −1 plain. Laevatain's trigger
without an assumption: the data's handler is enabled and unconditional.

**Left:** statuses per target as designed (9c6e's second Wanderer's Nature bursts); 6339's 25.03–28.47 s Combustion
ticks against its 29.26 s combo hit; Si's ink phantom; the DEATH lines list only the moves (decisionsview.ts, the
other agent's file: friction report point 2).
