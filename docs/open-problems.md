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

Also ruled out (2026-11-11, round 3): Corrosion in 9a80. The replay's
level 1 (shred 19.31) fits: physical hits at 25.4, 29.2, 31.6 and 32.5 s
match exactly, where a level-2 ramp would be ≥24.8 by 29.2 s; no level or
ramp gives the ×1.09 on fire. Rossi's ×1.33 after 24.97 s is crit-only
(crit zone 1.5 in the replay, 2.0 in the log; non-crits match).

**Still possible:**
- Gilberta's susceptibility (found: buff_common_affixes_vulnerable_spell,
  rate 0.30 × (1 + 0.10 × n), n the enemy's Vulnerable stacks): the
  engine's n is 3 at her ultimate (32.51 s), the log's 0.42 means 4. A 4th
  stack from Rossi's combo_3 "perfect" hit (Vulnerable +1 on a consumed
  infliction; the replay never applies it: the log's combo_2 hit at
  32.49 s is ×1.375 the replay's, maybe that variant), or a stack expiry
  the replay times differently (its 3 expire at 32.44 s, shifted by time
  stops); the replay's Vulnerable count reads 3 then 2 in one frame at
  31.60 s (a stale snapshot or a bug). This is ×1.022; ×1.067 remains.
- Rossi's crit DMG 2.0 against the replay's 1.5 at 22–25 s: an unknown
  +0.5 (source not found).
- Wolven Blood layers: the replay 16, the log 15 (under 1%).
- In 2fd9 / 99fb: the log's Electrification (damage taken 0.24 on fire)
  missing from the replay at the ultimate; the shared ×1.044 of Hard 27
  (below); the suit ATK buff the log never lists there.
- Her weapon's unique skill: the two mismatching fixtures have weapon
  skills [9, 9, 9], the matching 4e5e and 489c [9, 9, 4] (4a64's [9, 9, 8]
  matches only on log-listing fallbacks, weak evidence).
- The other 29 foods (not scanned for Rossi).

**Next check:** Rossi's combo_3 perfect-hit Vulnerable in the kit; the
replay's Vulnerable stack count around 31.6–32.5 s; her crit DMG at
22–25 s.

## Hard 27: every physical hit ×1.1125 low (2fd9, 99fb)

**Shows:** Mi Fu's and Rossi's physical hits from the first one, with no
buffs listed (Mi Fu's attack 3 at 5143 ms: every zone ×1); Mi Fu's World
Splitter residual is the same factor; Azrila ×1.044. One player, one
enemy (eny_0124_kltdcap_hdg027), Mi Fu P5 in both.

**Ruled out:** Mi Fu's kit (World Splitter exact in a27b, d5720); seven
foods; defense (×1.1125 needs DEF ≈ 79.8; 80 gives 1.1111); the level
(DEF 100 at every level); other variants of the template (all share it and
its born buffs; no other log hits it with physical or fire); a modifier in
the stage's DungeonTable entry (indie_hard027_s: paramList null); Azrila's
×1.044 as an element resistance (no value fits).

**Found:** the enemy (EnemyTable alias of eny_0124_kltdcap, no attribute
modifiers) has physical resistance 20 (zone 0.8) in the data; the hits
need 0.89, resistance 11. Rossi's fire hits (8, weak) are ×0.890, as if
fire were 11 too (the data: 0).

**Still possible:**
- A Hard 27 resistance setting outside the tables we read (all
  resistances 11?), or an enemy buff giving it.
- Azrila: 1.044 = 1.1125 × 0.9388, her ATK inputs ~6% high (a weapon
  level, nodes) on top of the same term.
- An unlisted team debuff (Physical Susceptibility) or a build input
  common to this player's operators (gear, food: 29 not scanned).
- The two factors (physical ×1.11, all-element ×1.044) being one term in
  different zones.

**Next check:** a log of another Hard stage's enemy with physical hits
(does the same 0.89 appear?); Azrila's build offsets; the separate
over-predictions there (Aurora ×0.655, Purrchena ×2.757 in 99fb).

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

**Ruled out (round 3):** two projectiles merged into one hit (14245 has
886 and a 1329 crit at one time: separate landings, six per volley as in
bdf2 and d774); battle-skill level (12 in all three); potential (0 in bdf2
and 1d91); the Stagger (explains 1152 = 886 × 1.3, not the 2×); Typhoeus's
damage taken (24670 is 886 without it). Wrong premise in this file's
earlier entry: the log shows no stance ATK or lance layer before 1990 ms.

**Found:** 442 (1990 ms) is the volley's 0.2 scale (bdf2's and d774's fit
0.2); 886 is 2.007× it, and atk_scale 0.4 gives 883 (0.3% off).

**Still possible:** these "volleys" being battle-skill projectiles (0.4)
logged under the volley's key: the groups of 886 follow her presses
(13713 at a press, 24670 0.96 s after one, 36754, 50920): a clue for
in-game test 103 (do presses in the stance launch projectiles?); an
unlisted ×2 on the enemy; volley 4 (985) a further ×1.11. The replay
lands no volley in 1d91 at all.

**Next check:** in-game test 103 with this in mind; why the replay
lands no volley here.

## 0c14: Si, and Rossi's later windows

Found (2026-11-11): Alesh's weapon at level 60 (her buff-free hits
×0.807 exactly), Rossi's food (Kunst Tube; early hits exact). Left:

**Ruled out:** a food alone for Si (residual 0.91–1.15 with the best);
a weapon level or nodes for Rossi and Si (they only lower ATK; both are
predicted low).

**Still possible:** Rossi at 22–40, 62–82, 150–195 s: Wolven Blood layer
and max-stack timing (the log lists two entries per layer), Si's ultimate
window, the Endministrator's ATK buff and Razor Clawmark timing (the
engine has Razor Clawmark's 0.12 at 52–60 s, the log doesn't). Si: a step
×1.0965 at 13.05–13.25 s with identical engine modifiers; Yinglung's Edge
or Jade Vessel's next-combo state; Stagger. Alesh: ×1.146 at 26 s (the
log lists her ATK buff twice, the engine once), ×1.38–1.44 at 59–60 s, her
ultimates ×1.34 and ×1.90.

**Next check:** Rossi's Wolven Blood layers against the log's listing,
window by window.

## 3f78 and 4a64: −36.5% after food

**Shows:** most hits carry buff_common_natural_cryst_triggered, which the
check routes to Corrosion; no Corrosion level fits ("unquantified").

**Found (round 3):** buff_common_natural_cryst_triggered is of the
Corrosion family (applyTag −421286163, Corrosion's; stacking key
natural_triggered, 20 s, a tick each second), and its BuffData lowers
DEF (def_decrease from 0 to −0.15, −0.01 a tick), a curve no engine
Corrosion level (resistance shred 3.6–7.2 at start, +0.84–1.68/s, caps
12–24) follows. Without Corrosion the hits are ×0.94–0.96 the
prediction, roughly flat; levels 1–4 need ×1.18–1.46. "No level that
fits" shows in every non-hold-out log with the buff (×3 to ×75).

**Still possible:** a defense decrease, not a resistance shred (the
engine's model wrong for this buff); a ~4–5% bias in the baseline these
hits are compared with; the buff having no effect on these hits plus a
separate ×0.95; the key naming a Nature-on-Cryst reaction with another
effect. Also: the routing (the buff may not be Corrosion here); Si's
Inksoul burst (Fixed DMG from the fight's hit sum) not computable; Rossi's
Seething Blood extras after null-crit stabs (they need the stab's crit);
Rossi's ultimate residual.

**Next check:** model it as its BuffData says (a DEF decrease on that
curve) and see whether the hits fit, in 3f78 and the other logs with it.

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
