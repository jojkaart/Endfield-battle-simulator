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
  engine's n is 3 at her ultimate (landing frame 975), the log's 0.42
  means 4 (×1.022 of the ×1.09; ×1.067 remains). Round 4: the 4th stack is
  Rossi's Lift; two misses, either enough: (a) her combo is placed at
  frame 948 where the log implies ~946, so its Lift (frame 977) lands
  after Gilberta's ultimate; (b) at 7.807 s the log has a Lift and her
  combo consumed 1 infliction (48646 / 30023), the replay none (no enemy
  Arts Infliction from 2.04 to 9.46 s: Arcane's touch is element "enemy",
  a no-op without one). Her 32.489 s combo hit is the perfect-timing
  variant, consumed 2 in the log, 1 in the replay. Ruled out: the perfect
  hit's own Vulnerable rule (perfect and late predict the same there);
  a stack expiry (none before 34.9 s; the "3 then 2" at 31.60 s is a stale
  snapshot of Gilberta's combo's pre-state).
- Rossi's crit DMG at 22–25 s (found: buff_chr_0028_wulfa_combo_criticalrate,
  combo_3, crit_damage_increase_rate 0.5, 15 s): the replay's ends at
  21.8–22.1 s, the log's zone is still 2.0 at 22.13–24.97 s and 1.5 at
  25.37 s: the game's window ~3 s longer. Ruled out: other Crit DMG
  sources (no food, gear set or weapon line gives it; the ultimate's crit
  buff is 5 s). Round 4: the replay makes it once, at the cast (6.840 s),
  15 s raw, to 21.84 s; the world clock's stops to 22 s add ~0.8 s (two
  of ~0.42 s), all to 25 s ~1.7 s. Also ruled out: a full 15 s refresh
  from combo_3's second CreateBuff (frames 212–215, 13.90 s: it would run
  to ~28.9 s); stops alone; hit-stops as world pauses and a longer combo
  slow-down curve (d572's window matches the replay to 0.12 s with as
  dense hits); Si's ultimate placement (placed at 27.1 s from its hits,
  logged at 25.47 s, 0.5 s after her combo: the press during the combo,
  the ultimate starting at the combo's end; its first hit at 29.20 s is
  the kit's offset from 27.1 s; either way after 25 s). Still possible: a
  stop or freeze only 9a80 has between 6.8 and 25 s; a refresh at frame 212 with another
  timer; the qte_ring state at the cast (frame 0 jumps to 212 without it);
  the evidence itself (22.13 s is unquantified, 24.97 s matches without
  the buff, so the window's end is weaker than ×2.0 suggests). 2fd9 and
  489c lean the same way (0.4–1 s past the replay), noisily.

**Next check:** the enemy's inflictions at 2–9.5 s in 9a80 (the source
of the 7.8 s one); the reaction-level fix (round 4) may change the
consumed counts; every stop and freeze in 9a80 from 6.8 to 25 s against
d572's (where the window matches).

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

**Shows:** most hits carry buff_common_natural_cryst_triggered; the check
routes them to Corrosion and finds "no level that fits".

**Found (round 4, a sonnet pass correcting round 3's):** the buff *is*
the engine's Corrosion (Nature onto Cryst): its modifiers are on
attributes 94–98, resistance points for Physical, Nature, Cryst, Pulse
and Fire (`def_decrease` is only the blackboard key; its values come from
the wrapper's ReadSkillSettingData "腐蚀每跳减抗"). With the right level
the engine's curve fits exactly: 4a64's first Corrosion (4517 ms, level
1) gives 1.000 ± 1 on Si's, Arcane's and Gilberta's hits at every shred
step from 7.8 to 23.2. The misfits are the replay's level: 4a64's second
Corrosion (52982 ms) is level 1 in the reaction check, level 2 in the
check's replay (hits ×0.95–0.97; at level 1 they fit); 3f78's second
(46994 ms) the other way round.

**Found (2026-11-11, the level fix):** the replay's enemy held other Cryst
stacks than the game's. 4a64 at 52982 ms: level 2 in the replay from a
Cryst stack of Xaihi's battle skill cast at 33.3 s, whose hit the log
never shows; level 1 by the logged reaction hit (16537) and the reaction
check. 3f78 at 46994 ms: level 1 in the replay (at 45458 ms Arcane's
ultimate lands before Xaihi's Cryst, so its "enemy's element"
infliction adds nothing); level 2 in the reaction check (the hit fits 2,
or 1 with a set buff the replay isn't sure of). The replay now takes the
level the log shows (docs/design.md, "The log check's rule"): 4a64 plain
68 → 114, unquantified 193 → 131, mismatches 3 → 1; 3f78 plain 30 → 32,
assumed 6 → 25, unquantified 208 → 179, mismatches 8 → 5. Totals: 4a64
−36.5 → −38.7%, 3f78 −36.5 → −35.0% (less shred in 4a64; the
under-prediction is elsewhere).

**Ruled out:** a DEF decrease (round 3's reading: attributes 94–98 aren't
DEF, and a full −15% gives at most ×1.081); a different status from the
engine's Corrosion; the food running out (300 s); the second windows'
Corrosion levels (the log's now).

**Still possible:**
- The replay's inflictions themselves (casts whose hits the log doesn't
  show, same-frame order across operators) still differ from the game's;
  only the reaction levels are taken from the log.
- 3f78's second window at level 2 still ×1.079–1.158 (54–61.5 s): the log
  lists Arcane's Will DMG and Will ATK (funnel_0016, 0.096 each) more
  often than the engine has them.
- The first windows (4a64 6.3–18.8 s, 3f78 3–15 s) are still "no level
  fits" in the check (nearest ×1.012–1.014, ×0.987 at 15–17 s in 4a64),
  though their level (1) is the replay's and the round-4 hand fit is
  1.000: the check's reading differs from that fit somewhere.
- ×1.5 on hits at a reaction's own millisecond (1.5001 in 3f78 and 4a64).
- Rossi's combo_2 ×0.94 in 3f78's second window.
- Si's ultimate and Fixed DMG, Rossi's and Si's ultimate hits (×1.4 to
  ×36): not Corrosion. Si's Inksoul burst (Fixed DMG from the fight's hit
  sum) isn't computable; Rossi's Seething Blood extras after null-crit
  stabs need the stab's crit.

**Next check:** the Will buffs' instances in 3f78; the hits at
reactions' own milliseconds; why the first windows' hits miss in the check.

## The slow-down rule's reach (2026-11-11)

**Shows:** "an operator in its own ultimate's stop isn't held by another's
slow-down" fixed 9a80's crit buff and raised plain matches (hold-out +4),
but some totals rose (hold-out mean |damage error| 19.7 → 20.3% at the
time, before the crit fix).

**Evidence so far (round 3):** in 1cd1 and 0c14 every overlap starts
inside the stop (Liino's 77-frame stop with Arcane's and Typhoeus's
slow-downs; the Endministrator's 44-frame stops with Rossi's). 0c14 at
80.5 s: Rossi's airborne (log 34792: old rule 24079, new 31303) and
combo_2 (log 113417: old 78495, new 102043) move toward the log; the
Endministrator's frozen buff (log 26783: old 32873, new 42734) moves
away. 1cd1: Liino's ultimate projectiles fit neither (log 1391: old 1128,
new 1696; her stance buffs may be the cause).

**Ruled out:** the old rule as the only fit (Rossi's 80.5 s hits favour
the new one); "only the ultimate's own action and hits" alone (it reverts
those hits and worsens the ultimate-kind total, −2.0 → −15.6%), though
not excluded as part of the answer.

**Still possible:** (a) every scheduled item of the operator (as now);
(b) only its ultimate's own action and hits (the Endministrator's total
fits it: +24% against +44%); (c) only slow-downs that start inside the
stop: no log separates it from (a) yet; a mix (the Endministrator's
frozen buff on another clock than her hits).

**Next check:** a log where a slow-down starts before an ultimate's stop
and runs into it; the Endministrator's frozen buff's clock in her kit.

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
