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
  Arts Infliction from 2.04 to 9.46 s: Arcane's touch was element "enemy",
  a no-op without one; fixed 2026-11-12, the touch applies the Cryst her
  window's Corrosion consumed and the replay's Lift consumes 1 there). Her 32.489 s combo hit is the perfect-timing
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

## Arcane's WILL combo touch: which element (in-game test 33)

**Found (round 6, 2026-11-12, implemented):** the touch applies the
element of what opened her window (`element: "window"`: the latest event
her combo trigger saw since the cast began, else the window's opener at
the cast; for a reaction, the infliction it consumed; for a window the
replay didn't see open, the enemy's current one). 9a80 plain 157 → 160,
mismatches 95 → 88, −30.7 → −23.6%; 3f78 plain 34 → 41; 489c, 4a64, e82d
closer; fixtures/ and the hold-out counts unchanged (hold-out mean
|damage| a little lower). Dead ends: the opener at the cast only
(`element: "event"`): 0eef −19.9%, the replay casts her combo before
Si's Cryo hit at the same ms; every event the trigger saw, before the
cast too: 1cd1 10 → 13.9% (a Nature 1.6 s before a cast the replay's
cooldown kept shut) and a hold-out log much worse.

**Shows (before):** the kit took the enemy's current infliction's
element; with none, nothing. The data switches on `EntityBB_consumed_type`.

**Ruled out (round 5, 94 touches in 30 logs):** "nothing when the enemy
has none": in 21 such touches a later consumer (Rossi's combo, whose Lift
needs a consumed infliction) consumes one, at 1.5–1.7× the replay's
consumed-0 value (9a80 7807; 3f78 8763, 50552; 4a64 9904, 57555; 489c
19734; 4f7e 8566, 86309); a fixed Heat (the switch's 0): b74c's next
burst is Cryst; the opener's *applied* element where it was a reaction
(b74c: Nature onto Cryst, then a Cryst burst). No touch has a current
element other than the opener's.

**Still possible:** the enemy's last infliction before the opener
consumed it (indistinguishable from the consumed element); the window's
first opener instead of the latest (no log tells them apart: every touch
with a current infliction has the latest's element); events while the
cooldown keeps the window shut counting before the cast too (only 1cd1,
where the replay's cooldown may be wrong); b74c's Cryst coming from Si's
combo or ultimate instead (the kit says they apply none). Not fixed with
it: e82d's replay lands a third touch the log hasn't (226 frames), which
now applies Cryst (Arcane's own total +8 → +47%); the multi-target logs
move both ways (b74c +23 → +34%, c516 +131 → +159%, 4f7e −2.7 → +3.4%:
their replay already over-predicts).

**Next check:** in-game test 33 (latest opener against first, and the
consumed element); e82d's extra touch.

## Hard 27: every physical hit ×1.1125 low (2fd9, 99fb)

(Ember is chr_0009_azrila; this entry called her Azrila before 2026-11-12.)

**Shows:** Mi Fu's and Rossi's physical hits from the first one, with no
buffs listed (Mi Fu's attack 3 at 5143 ms: every zone ×1); Mi Fu's World
Splitter residual is the same factor; Ember ×1.044. One player, one
enemy (eny_0124_kltdcap_hdg027), Mi Fu P5 in both.

**Ruled out:** Mi Fu's kit (World Splitter exact in a27b, d5720); seven
foods; defense (×1.1125 needs DEF ≈ 79.8; 80 gives 1.1111); the level
(DEF 100 at every level); other variants of the template (all share it and
its born buffs; no other log hits it with physical or fire); a modifier in
the stage's DungeonTable entry (indie_hard027_s: paramList null); Ember's
×1.044 as an element resistance (no value fits).

**Found:** the enemy (EnemyTable alias of eny_0124_kltdcap, no attribute
modifiers) has physical resistance 20 (zone 0.8) in the data; the hits
need 0.89, resistance 11. Rossi's fire hits (8, weak) are ×0.890, as if
fire were 11 too (the data: 0).

Round 4, other Hard stages: no Hard-stage pattern. Hard 15
(eny_0058_agdisk_hdg015, data resistances 12): fire fits 12 exactly (233
of 234 hits), physical fits no single value and is one operator per log
(Akekuri in 012a, Alesh in 4e36), and its hits are low, not high; R = 11
gives 0 matches there. hdg005 (eny_0033_lbhunt, physical 0): no value
fits; Estella's hits with few effects match at 0. Control: Tower 15
(klbear, physical 20) peaks sharply at 20 (132 of 132 plain in 458b).

Round 5, Ember: not the source. Her kit, potentials (P3 in both),
talents, weapon (wpn_claym_0006) and gear give no team Physical DMG or
susceptibility; the factor starts at 5.1 s (Mi Fu) and 6.0 s (Rossi),
her first hit at 10.3 s; with her in 7e19 the physical hits are 1.0000.
Mi Fu's and Rossi's ratio is 1.1125–1.1130 whatever their other zones.

**Still possible:**
- An enemy-side physical term of eny_0124_kltdcap_hdg027 only (no other
  log has physical hits on it; 1d91's tower016 variant has none).
- Per-log operator factors on Hard 15 and hdg005 (Akekuri's, Alesh's,
  Estella's buffs), untested.
- Ember's own ×1.044: her ATK ~6% high in the engine (×0.9386 after the
  ×1.1125); P2's attributes (+3.8% ATK) don't fit. Aurora ×0.655
  (whatever the zones); Purrchena is level 1 in 99fb (a build input).
- A Hard 27 resistance setting outside the tables we read, or an enemy
  buff giving it (no longer favoured).
- Ember: 1.044 = 1.1125 × 0.9388, her ATK inputs ~6% high (a weapon
  level, nodes) on top of the same term.
- An unlisted team debuff (Physical Susceptibility) or a build input
  common to this player's operators (gear, food: 29 not scanned).
- The two factors (physical ×1.11, all-element ×1.044) being one term in
  different zones.

**Next check:** a log with physical hits on this enemy from another
player; Aurora's and Ember's builds.

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

Round 5, the slug's data (from extracted BuffData): the number shield
(numshield_hdg033: 1, set to 3 on a signal buff, one less per qualifying
hit) blocks hits through buff_common_eny_numshield (−9999 in the product
zone: a blocked hit deals 0); at 0, numshield_zero ends the shield buffs
by id. Its two FinishBuffAdvanced end numshield_destory (on itself) and
the stage's poison on the team. Every finish names buffs by id; no tag
query. Jade Vessel's enemyvul and Arcane's funnel stacks carry no tags.
Neither log has a zero-value hit or lists a shield or Stagger buff. In
6339 Jade Vessel's entry drops out of the hits' lists at 10913 ms (last
at 10349); in 7b54 it's listed to 35.5 s.

**Ruled out:** the shield (or its end) ending the debuffs, by id or by
tag; Stagger at 10.5 s (6339: bar 22 → 45, rising) or at 12 s (7b54).

**Still possible:**
- Jade Vessel's replacement by priority key (stacking type 11,
  `dmg_taken_up`, max 1) keeping another instance than the engine's.
- The hits' effects lists being sparse in these logs (entries vanish and
  return), so "listed but not acting" reads presence wrongly.
- Shield-blocked hits hidden in a gap (6339: none from 11.3 to 14.6 s).
- A Stagger in 7b54 from ~19–20 s (bar 7 at 19.0 s, no sample to 29.5 s).
- buff_common_mini_poise_break_slwood and numshield_destory carrying an
  effect (the latter unread; the former an interrupt with 4 s
  immobilization, read in round 1).
- Hits zeroed by the shield explaining 6339's missing hit_2 and
  Combustion.

**Next check:** none planned: such logs are to be avoided. If one is
needed, the priority-key replacement of Jade Vessel's buff.

## Liino's battle-skill presses during Vocalist Stance (every Liino log)

**Shows:** a press every 3–4 s, no hits; the stance and its volleys go on.
1d91 +113%, 1cd1 +96%, a7a7 +59% for Liino.

**Ruled out:** replaying them as full battle skills (60 projectiles the
log hasn't); skipping them outright (a7a7 plain 322 → 261: two Corrosions
move, teammates mismatch); players pressing every 3–4 s (the owner, who
plays her, 2026-11-13: a press in the stance is rare).

**Leading reading (the owner, 2026-11-13):** they are the stance's beats,
which the log records under the battle skill's key. The stance's
`music_trigger` is 3 s; the logged gaps are 3.0 s at the shortest
(10th percentile 3032 ms, median about 3.5 s: beats are held by others'
time stops, the log's times aren't), and the first "press" of a run is
the real cast. The replay reads each later one as a press (End Stance or
a recast) and charges SP for some: about 900 SP of the SP shortfall (Team
SP, below).

**Settled on the way:** a Vocalist beat heals and makes enemies in range
flinch, with no damage (its soundwave projectile:
HealAction and EnemyHurtAnimAction, no DamageAction; no beat damage event
in the logs); the owner remembered the heal for sure and damage less so.
Cosmovoice's beats do deal damage (the kit's ult_song). The beats' heals
feed her signature weapon (wpn_lance_0014, in every Liino log: ATK on the
healed teammate, 20 s, 4 stacks), already in the kit and seen in the logs.

**Still possible:** whether a beat re-opens
the volley window (`volley_window_open`, frame 45 of the battle skill),
which would explain why skipping the events loses teammates' matches.

**Next check:** replay these events as beats (no cast, no SP) and see
what the volleys and teammates' matches need; in-game test 103 only for
what's left.

## Liino's stance ATK ends early in 0eef and 1cd1 (the 5 s linger)

**Shows:** the team ATK of Vocalist Stance leaves teammates' hits long
before the stance's 60 s, with no End Stance in the log (no log has one):
0eef at 8739 ms (cast ~760 ms; beats at 760 and 4187 only, her combo at
7570), and the next teammates' hits are ×0.934 of the engine's (it keeps
the stance, or its 5 s linger); 1cd1 at 34388 ms (last beat 34285; her
ultimate events at 37948 and 41265), and from +4.6 s on Typhoeus ×0.917
and Arcane ×0.839 of the engine's, with no Liino ATK listed.

**Ruled out:** players cancelling and recasting the stance for its ATK
(the owner's point, 2026-11-13: no log has an End Stance; the logged
"presses" are beats). The data's linger (`finish_duration` 5 s) doesn't
add to a new stance's ATK, so there's nothing to gain from it.

**Ruled out (also):** her combo ending the stance (its description: it
doesn't cancel the stance, the owner 2026-11-13; the kit resumes it).

**Found (haiku, 2026-11-13):** 1cd1's stance ends at her ultimate (cast
37948 ms, its projectiles 38725–39580 are real damage; the ultimate leaves
no linger), so the ATK going at 37974 fits. But Cosmovoice's ATK and Amp
never show on anyone (no beats either; dbae logs them, same parser), and
teammates' hits are a steady ×0.917 / ×0.838, as without them. Both
endings come in the fight's last seconds: 0eef ends at 10030 ms (ATK gone
1.3 s before), 1cd1 at 42702 ms (4.7 s after). The ATK auras are team-wide
(AuraAction auraType 1, no radius; only her talent's shelter has 5.5–6 m),
so distance isn't it.

**Found (sonnet + check, 2026-11-13):** no end-of-fight effect (last-5 s
mismatch rate 34%, as elsewhere). The real pattern: Cosmovoice's buffs
(team ATK buff_chr_0035_liino_atkup; Amp logged as
buff_common_affixes_enhance_natural / _pulse) are on teammates' hits after
her ultimate in 4bfe, 7b4e, 4bfc, d774, dbae and on none in 1cd1, 1d91,
a7a7, c6d8, d9e5 (19–80 teammates' hits each in the 2.6–15 s after). Not
Vocalist being on at the cast (4bfc: on before, buffs after; 1cd1, a7a7:
on before, none after). The engine gives them in every log.

**Found (sonnet, 2026-11-13): mostly the log's listing.** In a7a7 and
c6d8 teammates' hits after the ultimate match the engine plainly with
Cosmovoice's buffs (a7a7 Arcane 27/29, c6d8 Zhuang Fangyi 20/24): the
damage has them, the listing drops them (and Vocalist's ATK with them at
the cast). 1d91: a standing offset before and after (Arcane ×0.894 /
×0.929), not a loss at the ultimate. d9e5 (the one log of parser v58):
teammates ×1.14 before and after. Only **1cd1** lacks something in the
damage: ×0.917 / ×0.838 from 39036 ms, with Cosmovoice's Amp seemingly in
it (with Amp 7839, without 5217, logged 7187), so about the ATK, though
Arcane's ×0.838 is below what +0.16 ATK alone explains (≥ 0.862).

**Ruled out (also):** her ultimate cut short (she casts only its own
events after it in all 10 logs); who's controlled; potential, skill
levels, weapon, enemy; the beats. The engine stays as it is for a7a7,
c6d8, 1d91.

**Still possible:** for 1cd1 (P5, fight ends 4.7 s later): a real loss of
the ATK (or part of the Amp); its weapon layers (up to 11 on Typhoeus,
see the next entry) changing at the ultimate; for 0eef: Liino down or off
the field (HP and swaps aren't logged); the log dropping Liino's buffs
from the listing when her ultimate replaces Vocalist (a7a7, c6d8, 1cd1,
1d91); whether the 5 s linger
exists (0eef: if End Stance-like, the ATK went at once, against it; no
other log has teammates' hits in the 5 s after a stance's end); why the
engine still has Liino ATK in 1cd1 after 39 s.

**Next check:** 1cd1 together with the weapon-layer entry below (its
Typhoeus carries 11 layers just before); 0eef none planned.

## Liino's weapon: more than 4 layers listed on one teammate (test 25)

**Shows:** buff_wpn_lance_0014_damageup listed up to 11–13 times on one
hit (1cd1's Typhoeus 3–11, a7a7's Arcane up to 10).

**Settled (haiku + check, 2026-11-13): the damage fits the cap of 4,
the listing over-counts.** 18 Liino logs, ~4,500 teammates' hits where the
engine has 4 layers: those listed with 8–12 still match the engine
exactly at the same rate as those listed with 0–4 (e.g. listed 9: 118 of
238; listed 3: 360 of 691); 11 real layers would put them ~20% higher.
Log/engine ratios peak at 1.00, no peak at more layers. The cap is per
recipient, shared by every heal source (per-source caps would show steps
past 4; none). Rises come within 4 s of her heals, expiry 20 s after
(median 19.9 s). The listing errs the other way too: 1d91 lists none and
fits 4; Ardelia lists 1 in 1cd1 and fits 4. (On 2026-11-13 the lead read
1cd1's fallback matches as support for 11 layers: wrong, a coincidence of
the log's other listed buffs.) Other stackingType-11 buffs (wpn_sword_0012,
cap 2) are listed up to 12 times too: a log habit.

**Ruled out:** the listed count in the damage; the buff's own default cap
(2); a cap of 4 per heal source.

**Still possible (not the weapon):** 1cd1's team-wide step at 24.0–24.6 s
(×0.936 → ×0.820 for Ardelia, Arcane, Typhoeus alike) and Typhoeus ×0.820
→ ×0.917 at 39.0 s; the engine giving Typhoeus's ultimate hits no layers
(37974, 41265 ms); c6d8's engine values ×10 off on every hit.

**Next check:** 1cd1's step at 24 s (sonnet); the log check's fallback
should not trust stackingType-11 listings' counts.

## Ardelia's Wooly Party: the engine assumes every hit lands (test 96)

**Shows:** 7 sheep hits in 4e36 and 3 in c3c7 (her only ultimates that
hit in our logs), against the engine's 11 below P3 (14 from P3), which
assume the 0.3 s per-enemy cap is always reached.

**Ruled out:** a fixed count: the sheep fly at random, not aimed (the
owner, 2026-11-13), so the count varies cast to cast.

**Counted (2026-11-13):** 21 ultimates in 18 more ZMDLogs battles
(screened from her profile, not imported; IDs in the session's scratch
folder) and our 2 logs, sheep hits on the main target per cast:
- below P3 (engine 11): 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9: mean
  6.1, median 6.5, never 10 or 11 (×0.55 of the engine);
- from P3 (engine 14): 4, 8, 8, 9, 10, 10, 11: mean 8.6 (×0.61).
One more cast (Hard 32, several enemies, potential not exported) hit
nothing. Hits on one enemy are 0.2–0.45 s apart (the 0.3 s cap, roughly),
spread over 2–6 s; towers 15/16 (large bosses) and smaller enemies alike.

**Still possible:** the expected count (6.1 / 8.6 of 11 / 14) as the
engine's count, or the count as a random outcome in rolled battles (as
crits are); enemy size mattering (too few casts per enemy to tell).

**Impact:** small. She's a support (the owner): teams run her for her
effects on others, not her own damage. What it can move: the search
valuing her ultimate's damage too high and timing it for that rather than
for her support.

**Next check:** more Ardelia ultimates (logs to import, or the owner's
counts); low priority.

## db87: ×1.3 on Laevatain's hits under her sword buff

**Shows:** the 8 Laevatain hits carrying buff_wpn_sword_0006_valid
(listed 1.2) are ×1.30 of the engine's in both readings of her battle
skill (test 20); her two hits without it match exactly; e989 lists the
buff at 2.1 and fits exactly.

**Ruled out:** her battle skill's multipliers (both readings carry it).

**Still possible:** the buff's value or stacks in db87 (listed 1.2 against
what the engine applies), another buff on the same hits, db87's build.

**Next check:** the sword buff's value and stacks in db87 against e989.

## OBJ Razorhorn's ATK lasts longer than its 15 s

**Shows:** wpn_lance_0013's atk_up (Estella's weapon) still listed 17.2 s
after its Shatter in a27b (44993 → 62229) and 18.7 s in 69e7 (13030 →
31681), against the data's 15 s at L9; the check says "log lists it,
replay isn't sure".

**Ruled out:** nothing yet.

**Still possible:** a refresh by a later Shatter or other trigger; the
duration read wrong; the listing lagging (stackingType habits, cf. Liino's
weapon).

**Next check:** each listing's start and the Shatters between (small model).

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
- 3f78's second window, ×1.079 (54–61.6 s): found (round 5): one Will
  ATK instance (funnel_0016 will_atk, made by Arcane's bursts, ~24 s)
  the replay lacks on all 101 hits: its only Arcane burst is at ~20.7 s;
  the log's second, buff_common_cryst_cryst_triggered at 47230 ms
  (credited to her), isn't replayed; its source perhaps her touch's
  element (entry above). The ×1.158 hits: an extra 0.192 that isn't Will
  (candidates: log-only entries in Rossi's window, wpn_sword_0022.final
  0.384, wpn_funnel_0005.atk_up 0.224, suit_usp02.team_dmg 0.16).
  Elsewhere the Will buffs' counts agree (0eef, bdf2, dbae, 4a64, e82d;
  b7b3 has 63 hits with a will_atk the log doesn't list; d9e5 12 the
  other way).
- The first windows (4a64 6.3–18.8 s, 3f78 3–15 s) are still "no level
  fits" in the check (nearest ×1.012–1.014, ×0.987 at 15–17 s in 4a64),
  though their level (1) is the replay's and the round-4 hand fit is
  1.000: the check's reading differs from that fit somewhere.
- ×1.5 on hits at a reaction's own millisecond: found and fixed (round
  5): Hot Work's Nature DMG on the hit that forms the Corrosion. 4a64 at
  52982 ms is ×1.39, not 1.5: open.
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

## Laevatain's battle-skill multipliers: data and logs against Zero Sanity

**Shows (kit review 2026-11-12, Laevatain F3, F4):** the kit follows Zero
Sanity's in-game table (game ~1.1): the empowered extra hit × extra_scaling,
Twilight's enhanced battle-skill hits 1 and 2 × ratio. The data (1.6) has
× ratio on the extra hit and none on hits 1 and 2; with the data's reading
e989 (P5, game 1.6) goes from 6 mismatches to 0, its extra hit logged at
0.8 of the kit's (1.2 / 1.5).

**Ruled out:** nothing yet.

**Still possible:** a game change since 1.1 (the data and logs are 1.6);
a log or import effect in e989; a P1–P2 difference (db87, P1, still ×1.30
on the Twilight hits with either reading).

**Next check:** in-game test 20; the owner's decision on whether game-1.6
logs outrank Zero Sanity's older in-game values.

## Fight-wide factors in older imports (kit review)

- Da Pan's only log (multi-target 10df): ×1.25 on half his hits and on
  Pogranichnik's in the same fight.
- 04d4: Catcher's weapon fits level ~1 (×1.0265 left), Ember ×1.0226 (as
  in 146d); Ember ×1.0444 in Hard 27's pair, none in 7e19.
- c3c7: Xaihi's hits all ×0.337.

**Still possible:** build inputs the export doesn't give (weapon levels,
nodes, food), stage effects. **Next check:** none planned (not screened
logs).

## Team SP: the replay's SP runs short (web review row 2)

**Shows:** with the engine's own SP, the log check's replay can't afford
casts the log made: at first in 28 of 40 logs at the 1.5 s regen pause
(most 2–12 SP short), 22 at 0.5 s, 14 with no pause (1d91 at 4833 ms: 46
SP before a 100 cast). replayCast raises SP silently, so verdicts don't
show it. Since 2026-11-12 the engine pauses 0.5 s and regenerates through
others' time stops and slow-downs: of the 17 development logs, 9 are still
short at some cast, 1193 SP in all (before: 13 logs, 2921 SP).

**Ruled out:** a 1.5 s pause after every spend (old rule K1). Regen held
during others' time stops and slow-downs (old rule K2: about 1400 SP of the
shortfall, 7 logs). SP for basic-attack hits on which the log shows poise
(the replay's controlled operator already matches the log's).

**Ruled out (2026-11-13, sonnet + check):** teammates' Final Strike SP as
the main gap. In the data most operators' Final Strike SP has no
controlled gate (atbOnlyMainChar false, no branch), and the engine already
grants it to teammates; only Laevatain, Ardelia, Zhuang Fangyi, Antal and
Tangtang gate it (Tangtang's attack5_projhit: the ObtainCostAction inside
an IfElse on CheckMainCharacterCondition, so the kits' `if controlled`
are right though the flag says false). Granting all of it anyway: 10 → 7
of 15 development logs short, 1808 → 1287 SP (counted at each replayed
cast).

**Still possible:** Liino's "presses" in Vocalist Stance are her
stance's beats, logged under the battle skill (the owner; about 900 SP;
being implemented); teammates' basic attacks the replay doesn't land
(their Final Strikes' SP; the earlier probe granted SP at every logged
Final Strike); Purrchena's block refund (+20 at her counter, about 240
SP, more if repeated blocks count); teammates' Final Strikes give SP too
(alone 1497 SP at 0.5 s; with the others only db87 and 04d4 stay short);
other hitless presses free (Si, Laevatain in db87: dubious); SP at the
start above 200 (0eef short at 3.2 s); a pause shorter than 0.5 s (bdf2 at
3817 ms fails any pause above ~0.2 s with the old regen); a replay
artefact (db87 at 10117 ms charges 200 SP for one press).

**Next check:** test 103 (Liino); the Final-Strike SP of teammates
(a data read: who gets a Final Strike's `atb` when not controlled); then
the pause (test 102).

## Solidification as a freeze (web review row 4)

**Shows:** the data's buff_common_do_frozen stops the enemy's clock
(TimeDilation 0), behind CheckSuperArmor (20, compareType 1); the engine
has no freeze for Solidification (rule A37).

**Ruled out:** a freeze on 4e36's enemy (super armor 30: Combustion ticks
on time through it).

**Still possible:** a freeze on enemies under the gate (super armor 0:
agmelee2, lbhunt); the dilation holding only animation (T10 open).

**Next check:** CheckSuperArmor's compareType direction (other buffs using
it); a log with a Solidified enemy of super armor 0. Also seen: 4f7e at
40603 ms, the engine's Solidification consumed Nature where the log's
was Heat.

## Smaller, not yet diagnosed

- Laevatain's enhanced battle skill (`normal_skill_during_ult`): ×0.833
  in e989, ×1.083 in db87; its `ratio` key has no value in the data
  (in-game test 20).
- Arcane's talent 1, paramType 4 (−6 on the INT combo) ignored by the
  engine: a second cooldown cut would make INT combos twice as frequent
  (kit review N1; an in-game timing decides).
- 4e5e at 12219 ms: Estella's Lift lists Stagger 10 apart from her
  ultimate's 24, the one exception of 156 to the shared-event rule.
- 1d91: Typhoeus's natural-triggered hits get Barrage Array's +0.10 in the
  engine, which the damage doesn't show (seen before the lance fix: recheck).
- From the roadmap: bdf2's Si combo finisher ×1.456; Snowshine ×0.96
  (04d4), Liino ×1.031 (92b4) offsets; Zhuang Fangyi's Sunderblade count
  (d774); 3aa6's Stagger at 145.6 s; Xaihi's Amp timing (b6aa); Last
  Rite's weapon buff (b6aa); Ember low by one factor.
