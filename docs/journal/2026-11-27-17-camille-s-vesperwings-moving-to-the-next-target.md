## 2026-11-27: Camille's Vesperwings moving to the next target

**Goal:** on main at e4a1e36, beside the Liino agent: Camille's `normal_skill_abilityrange` hits (6339 ×5, 7b54 ×1),
never placed: her Vesperwings moving to the next slug when its own dies (docs/open-problems.md "Hard 33's Woodcraft
Slugs"; docs/tried/2026-11-27-sub-skill-events.diff).

**The data:** abilityrange_first (and abilityrange) put buff_chr_0033_camille_normal_skill_listen_target_dead on the
target; at its death (abilityEvent 1) reset_target (0.1 s) finds the next target, launches projhit_sub
(skillSpecification 3, castSkillOnHit), which casts abilityrange on it: frame 0 the debuff (with the bat_duration
icon's time left: SaveBuffLifeTime), Heat infliction, the battle skill's atk_scale and poise; no team energy.

**Done:**
- **Engine:** trigger event `targetDeath` (events.ts), made only by `targetDies` (drivers.ts), which the replay calls;
  its `landings` pin the triggers' hits at logged frames as replayCast's do. BuffApplication `keepEnd` (a new instance
  ending where the active one does). Trigger action `castEvent` (a cast event of a skill an entity casts, no action).
- **Kit:** trigger `vesperwings_move` (frame 3 on the world's clock, the travel not in the data), and
  `vesperwings_move_cast` behind the new kit assumption `vesperwings-move-cast` (`battle`, default; `none`).
- **Replay:** targets.ts `deathMoves` (each logged landing of a targetDeath trigger's hit; the death at the logged
  kill within MOVE_AFTER_KILL_MS before it, else the lead before the landing) and `moveEvent` (a cast event at a
  move's ms, key the skill's id with a suffix, is no press: castassembly.ts assembleCasts, loggedCastFates `move`);
  replaysteps.ts / replayrun.ts death steps; `zmdlogs replay` / decisions DEATH lines. tests/vesperwings-move.test.ts.

**Decisions:** the death at the logged kill, not at the landing less the lead: 6339's 29.26 s kill purges her
Susceptibility from the listing (`logged-purges`) before the 29.67 s move, so a death at the landing found no debuff
and made nothing. The cast event: the plain move made 6339 mixed (plain 115 → 109): Si's 28.39–29.57 s combo slashes
need 3 Yinglung's Edge layers and the replay had 2 once the presses standing in for the moves were gone; the move as
a battle-skill cast (projhit_sub is one; ZMDLogs logs a normal_skill event at four of six) gives the third. Registered
as a reading: the data doesn't say whether ability event 30's CheckSkillType sees an entity's cast.

**Numbers** (measure against e4a1e36; snapshots:update for the scoreboard): only the several-targets row moves: plain
70.6 → 71.3%, mismatch 15.3%, mean |damage error| 8.3 → 6.3%; 6339 plain 115 → 120, −10.3 → −6.3%; 7b54 plain
115 → 116, −3.3 → −1.2%. Development, earlier pending, verified unchanged; hold-outs' aggregates unchanged (one
hold-out has a logged move: 2 hits uncovered → fallback, DEATH +2, SKIP −2). Team fights unchanged (team-ab identity:
no simulated fight has a death; the one enemy never dies).

**Checked:** every Camille log: only 6339 and 7b54 have the move's key (the multi-target fixtures none, the others no
mid-fight kill). **Left open:** 6339's 19.68 s move follows no logged kill; 7b54's 19.90 s normal_skill event, 0.31 s
after a kill with no hit, a likely move onto a shielded slug (not made); 6339's Laevatain 35.70 s empowered hit is not
the move's Heat alone (nothing of hers absorbs it in time); the moves' Heat on the replay's one enemy gives replay-only
bursts (statuses per target); other kits' listeners on a target's death (open-problems).
