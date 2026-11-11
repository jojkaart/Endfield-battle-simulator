# Open problems

One entry per accuracy problem not yet explained: what the logs show, what
is **ruled out** (with the evidence), what is **still possible** (every
candidate not yet tested or not yet excluded, however unlikely), and the
**next check**. A problem leaves this file only when its cause is found,
or when it's settled as out of scope (with the reason). Diagnosis reports
(the agents', and our own) update it: each names what it ruled out *and*
what it left standing; a candidate goes from "still possible" to "ruled
out" only with evidence. The accuracy plan says what was done; this file
says what isn't known.

Started 2026-11-11 (the owner: keeping a record of what hasn't been ruled
out is necessary, not only of what has). Hold-out logs aren't debugged, so
none appear here.

## Rossi's ultimate ×1.090 (9a80) and ×1.081 (2fd9)

**Shows:** every ultimate hit low by one factor, crits and non-crits alike
(9a80: 16058 logged vs 14727, crits 46567 vs 42708). Matches in 4e5e,
489c, 4a64.

**Ruled out:** the kit's per-hit scale and hit count (SkillData and
SkillPatchTable; 27 per cast, as logged); the crit zone (the crit ratio is
exactly the engine's ×2.9); her potential 5 (4a64, P5, matches); the ult's
crit buff timing (fixed: the slow-down rule); the blackboard's
`atk_scale_crit_fire` (not the ultimate's); seven foods (the six ATK foods
and the stew).

**Still possible:**
- Gilberta's susceptibility: 0.42 in 9a80's log, 0.39 in the engine
  (×1.022 of it; d5720 matches only with 0.42). Why the engine has 0.39 is
  not known: her level, a potential, a stack count.
- Corrosion in 9a80: the replay has level 1 (shred 19.3) where the log's
  reaction is level 2; Rossi's physical hits after 24.97 s are ×1.33 low.
  Would need shred ~28–30 to explain the rest.
- Wolven Blood layers: the replay 16, the log 15 (under 1%).
- In 2fd9 / 99fb: the log's Electrification (damage taken 0.24 on fire)
  missing from the replay at the ultimate; the shared ×1.044 of Hard 27
  (below); the suit ATK buff the log never lists there.
- Her weapon's unique skill: the two mismatching fixtures have weapon
  skills [9, 9, 9], the matching 4e5e and 489c [9, 9, 4] (4a64's [9, 9, 8]
  matches only on log-listing fallbacks, weak evidence).
- The other 29 foods (not scanned for Rossi).

**Next check:** `efsim zmdlogs reactions` on 9a80 (Corrosion's level and
shred over time); Gilberta's 0.39 against the data at her build.

## Hard 27: every physical hit ×1.1125 low (2fd9, 99fb)

**Shows:** Mi Fu's and Rossi's physical hits from the first one, with no
buffs listed (Mi Fu's attack 3 at 5143 ms: every zone ×1); Mi Fu's World
Splitter residual is the same factor; Azrila ×1.044. One player, one
enemy (eny_0124_kltdcap_hdg027), Mi Fu P5 in both.

**Ruled out:** Mi Fu's kit (World Splitter exact in a27b, d5720); seven
foods.

**Still possible:**
- The enemy's physical resistance or defense at this stage
  (1.1125 = 0.89 / 0.8: resistance 11 where the engine has 20 fits; Azrila's
  ×1.044 doesn't fit the same number).
- A Hard 27 stage modifier (DungeonTable / contract tags) the importer
  doesn't read.
- An unlisted team debuff (Physical Susceptibility) or a build input
  common to this player's operators (gear, food: 29 not scanned).
- The two factors (physical ×1.11, all-element ×1.044) being one term in
  different zones.

**Next check:** the enemy template's resistances for `hdg027` against a
non-Hard-27 log of the same template; the stage's DungeonTable entry.

## Hard 33's slug: debuffs the engine keeps don't act (7b54, 6339)

**Shows:** hits low by the engine's damage-taken and susceptibility
entries, which the log lists but the damage ignores (Jade Vessel's 0.12,
Arcane's 0.096 stacks, the affixes), in windows (7b54 12–20 s; 6339 from
10.5 s); a Laevatain power-attack hit_2 missing (6339; the pair is in
0206 and 3440); Combustion ticks the log doesn't have.

**Ruled out:** the slug's template (DEF 100, resistances 0, no born
buffs, no attribute modifiers); a damage-scaling shield (the number shield
zeroes whole hits); Stagger (the bar isn't empty when the buffs stop
acting); an additive damage-taken reduction (1 + 0.12 − r doesn't fit;
1 + 0.096k does).

**Still possible:**
- The number-shield phase (buff_eny_0129_slwood_numshield_hdg033,
  FinishBuffAdvanced ×2: not yet read which buffs or tags it ends) removing
  or suspending enemy debuffs.
- Per-instance replacement (Jade Vessel's priority key `dmg_taken_up`) or a
  dispel on reapplication.
- The log listing buffs by presence while the damage uses another state
  (a ZMDLogs quirk for shielded enemies).
- Hits zeroed by the shield explaining the missing hit_2 and Combustion.

**Next check:** what numshield_hdg033's FinishBuffAdvanced ends, against
the times the debuffs stop acting. Status: an unmodelled boss phase; such
logs are to be avoided (accuracy plan, Choosing logs).

## Liino's battle-skill presses during Vocalist Stance (every Liino log)

**Shows:** a press every 3–4 s, no hits; the stance and its volleys go on.
1d91 +113%, 1cd1 +96%, a7a7 +59% for Liino.

**Ruled out:** replaying them as full battle skills (60 projectiles the
log hasn't); skipping them (a7a7 plain 322 → 261: two Corrosions move,
teammates mismatch).

**Still possible:** End Stance then a restart (3 s cooldown); the log
recording something else as presses (the heal soundwaves, also every 3 s);
a press teammates' effects count as a battle-skill cast.

**Next check:** in-game test 103 (ready).

## Liino's volley doubles in 1d91

**Shows:** 442 at 1990 ms, 886 (exactly 2×) at 13713 ms, later 985, 1152;
some ×1.90 / ×2.11 against the engine.

**Ruled out:** nothing specific yet.

**Still possible:** two projectiles logged as one hit; a stacking volley
value; the log's missing Liino buffs (it lists none of hers); her lance's
layers (now kept, but their timing at the fight's start: the log has the
stance ATK and one layer before her first logged cast).

**Next check:** her volley hits' zones after the lance-layer fix; the
fight's first seconds (a stance from before the log).

## 40d9: Si's combo −22.6% in total (verified fixture)

**Shows:** since her killing burst lands (2026-11-11), the totals show her
combo −22.6%, though her ten combo slashes match by hand with Jade
Vessel's and Type 50 Yinglung's unlogged bonuses.

**Ruled out:** nothing yet.

**Still possible:** the totals' primary reading lacking those bonuses
(they're consumed buffs the replay may not have at that cast); a stack
count; another combo landing.

**Next check:** the combo hits' primary reading against their matched one.

## 0c14: Rossi ×1.51, Si ×1.15, Alesh ×0.86

**Ruled out:** each of 36 foods per operator.

**Still possible:** Rossi: her ultimate's residual and Corrosion (above);
Si: two buffs at once (food and attribute nodes), a weapon level; Alesh,
over-predicted: a buff the engine applies that the game doesn't, or a
build input.

**Next check:** per-operator zone factorisation as for e989.

## e989: Si ×0.940

**Shows:** her ATK zone low by a constant once Jakub's Legacy is in.

**Ruled out:** food alone (her ratios don't fit it without this factor).

**Still possible:** 0 attribute nodes (×0.9400); her weapon at level 80
(×0.9370, as db87's Arcane): 0.3% apart, both inside the hits' spread.

**Next check:** the build-offset report's per-hit spread at each
explanation; else a cleaner log of hers (not corrected meanwhile).

## 3f78 and 4a64: −36.5% after food

**Shows:** most hits carry buff_common_natural_cryst_triggered, which the
check routes to Corrosion; no Corrosion level fits ("unquantified").

**Still possible:** the routing (the buff may not be Corrosion here); Si's
Inksoul burst (Fixed DMG from the fight's hit sum) not computable; Rossi's
Seething Blood extras after null-crit stabs (they need the stab's crit);
Rossi's ultimate residual.

**Next check:** what buff_common_natural_cryst_triggered is (BuffData),
against the hits' ratios with Corrosion off.

## The slow-down rule's reach (2026-11-11)

**Shows:** "an operator in its own ultimate's stop isn't held by another's
slow-down" fixed 9a80's crit buff and raised plain matches (hold-out +4),
but the hold-out's mean damage error rose 19.7 → 20.3% (median +1.1 →
+5.1%).

**Still possible:** the rule right and other errors now showing; the rule
too wide (it may hold only for a slow-down that starts inside the stop, or
only for the ultimate's own action, not every scheduled item of the
operator's).

**Next check:** the development logs whose totals rose with it (1cd1,
0c14, 262b is hold-out: not debugged), hit by hit around ultimates.

## Smaller, not yet diagnosed

- Laevatain's enhanced battle skill (`normal_skill_during_ult`): ×0.833
  in e989, ×1.083 in db87; its `ratio` key has no value in the data
  (in-game test 20).
- 4e5e at 12219 ms: Estella's Lift lists Stagger 10 apart from her
  ultimate's 24, the one exception of 156 to the shared-event rule.
- 1d91: Typhoeus's natural-triggered hits get Barrage Array's +0.10 in the
  engine, which the damage doesn't show (seen before the lance fix: recheck).
- From the roadmap: bdf2's Si combo finisher ×1.456; Snowshine ×0.96
  (04d4), Liino ×1.031 (92b4) offsets; Zhuang Fangyi's Sunderblade count
  (d774); 3aa6's Stagger at 145.6 s; Xaihi's Amp timing (b6aa); Last
  Rite's weapon buff (b6aa); Ember low by one factor.
