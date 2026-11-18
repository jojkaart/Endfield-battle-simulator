# Re-triage of in-game tests 41–75 against the logs (2026-11-18)

The owner's rule (in-game-tests.md, "Logs first"): never ask for what the
logs can decide. This pass redoes the [2026-11-13 triage](in-game-tests-log-triage.md)
for tests 41–75 that are still open, with a quick look at the 79 development
logs (verified, pending and multi-target; no hold-out) instead of a model's
guess. Skipped: 42, 47, 55 (answered), 63, 72 (decided by the logs), 54
(another agent). 29 tests remain. This is identification only: no engine,
kit or snapshot change, and in-game-tests.md is untouched.

Verdicts: **LOGS** (a log we have shows the case), **LOGS IF** (the logs
record what is needed, none we have shows the case), **PARTLY**, **GAME
ONLY**. Counts: **12 LOGS, 5 LOGS IF, 6 PARTLY, 6 GAME ONLY.**

How it was looked at: the raw fixtures (hits, `casts`, listed `effects`
with `source` and `since`) with short scripts in scratch/, and `efsim
zmdlogs hits --json` for the engine's per-hit reading (verdict, class,
modifiers). Operator IDs in the logs are not the English names (Valiant's
hit is logged under `chr_0015_lifeng_ultimate_skill`, skill
`sk_wpn_lance_0010`); names below are the English ones. "Plain" is the
log check's class for a hit that matches with no assumption. Dodges,
dashes, enemy attacks, SP, energy, HP, Signs and cooldowns appear in no
log (searched for `dash`, `dodge`, `perfect`, `behit` in events, effects
and casts: nothing but one Wulfgard plunge).

Teams in work: **O** = owner's team (Estella, Si, Akekuri, Arcane);
**I** = Ink Melt (Laevatain, Si, Wulfgard, Ardelia); **T** = Typhoeus's
team (Typhoeus, Arcane, Liino, Perlica).

## The entries

### 41. Jade Vessel's combo bonus after Si's ultimate: LOGS (already decided in effect)
Si's combo final hit carries the bonus in the engine and the logs
agree. Si wears Jade Vessel in about 36 logs; 121 combos, 89 with the
bonus modelled. Of the 11-hit combos (one enemy), the final hit is a plain
exact match 37 times with the bonus on and 4 times with it off (458b at
131 s, 9c0b at 35.9 s, 4e36 at 37.9 s, 8915 at 86.8 s; 9c0b's is 28.9 s
after her ultimate). The bonus is not a listed buff (only
`buff_wpn_claym_0018_enemyvul`), so the damage ratio is the evidence;
the engine reproduces both groups exactly. Left
open: the owner's "ultimate only, no battle skill" case (no log has it
cleanly; the Immobilization path also grants it). Same as the triage.
Operators: Si on **O**, **I**.

### 43. Typhoeus's shots off-field: LOGS (the burst on the 5th shot), PARTLY for "off-field"
Fifty Typhoeus battle-skill casts in 20 logs. Of 11 hovers with five
uncut shots, a burst (`buff_common_natural_natural_triggered_typhoea`,
0.31–0.65 s after the arrow) follows the 5th shot in 8 (1d91 36.8 s, 9090
at 7.5 / 103.5 / 124.8 s, fc63 at 4.0 / 102.3 s, 7b4e 8.1 s, 8318 29.6 s)
and not in 3 (1d91 52.2 s, 9090 23.8 s, 7b4e 31.2 s). The engine's "the
5th is plain even with arrows left" does not fit the 8 unless the arrow
count exceeded 4 there (arrows are not logged: this is the open point).
Shots 1–4 each have a burst in nearly every case; the 5th shot comes
0.7–1.0 s after the 4th. Whether she was off-field: the logs give no swap
event; `controlledFromLog` would say who held the controls. The triage
had 4 of 6; the count is now 8 of 11. Operators: Typhoeus on **T**.

### 44. Signs from a teammate's Nature Burst: GAME ONLY
Signs are not logged. Teammates' Nature Bursts are
(`buff_common_natural_natural_triggered`, about 30 in 14 logs, almost all
Arcane's; Ardelia's twice), and so are Typhoeus's combo casts. Counting
her own bursts plus others' between consecutive combos gives 6–9 per
window, never a clean 8: plain shots on a Nature-inflicted enemy also give
a Sign, so the inequality cannot separate the readings. Same as the
triage. Operators: Typhoeus, Arcane on **T**.

### 45. Typhoeus's combo at hover end: PARTLY
The logs have what the test needs on one side only: 41 Typhoeus combo
casts, about 36 of them 0.3–2 s after her last shot (hover end), and six at
19.2–19.9 s after the previous combo, right at the cooldown (1d91 at 28.6
and 70.3 s, 00ae 94.4 s, fc63 55.1 and 98.4 s, 7b4e 25.7 s). That fits
"opened at hover end after the cooldown" but also "the 8th Sign came with
the last shot". The deciding fact, when she reached 8 Signs, isn't logged.
A log would need her at 8 Signs with the combo on cooldown, then a long
hover (no new Sign) ending after the cooldown. The triage said LOGS IF;
PARTLY is closer, since the cooldown-end casts are there but ambiguous.
Operators: Typhoeus on **T**.

### 46. Hail of Arrows count: LOGS
13 ultimates in 7 logs (dbae, 00ae ×2, 9090 ×2, 9c6e, d9e5 ×3, fc63 ×2,
7b4e ×2). Each shot after the ultimate is followed by `arrowrain_sub1`
(three hits), the last rain by `arrowrain_sub2` (five hits, the empowered
one): 00ae 99.3 s has four sub1 rains and one sub2; 9090 114.5 s four and
one; d9e5 9.6 s four and one; shorter ones where she landed early (00ae
103.7 s: two and one; 9090 118.1 s: three and one). The ultimate's own
`arrowrain` hit comes first. What the logs don't settle alone is the
window's start and whether time stops count: the empowered rain lands
1.5–6.7 s after the first shot (7b4e 17.2 s: 4.5 s, 00ae 99.3 s: 6.4 s with
her own combo and time stop in between). The replay (which knows the
stops) can fix that. Same as the triage. Operators: Typhoeus on **T**.

### 48. Valiant's hit and skill-type bonuses: LOGS IF
Valiant is worn by Estella in 4e5e (6 hits) and Lifeng in de6a (4 hits),
logged as above; all 10 match plain. But no team there has a bonus that
applies to one skill type only (4e5e's lists are Physical DMG, Camille's
team ATK and general DMG; de6a's Pogranichnik's Physical DMG), so the
match says nothing about skill types. A log would need Valiant with a
combo-only or ultimate-only DMG bonus up (a gear or weapon effect that
names the skill type) and a Lift from both a combo and an ultimate. The
triage said LOGS "if her build has one"; it doesn't in these. Operators:
Estella on **O** (whether her owner build wears Valiant is unknown).

### 49. Estella's talent-1 SP: GAME ONLY
SP isn't logged; a 15-SP return is about two seconds of regeneration and
shows in no cast time (Estella's battle skills are spaced by SP the logs
don't hold). Same as the triage. Operators: Estella on **O**.

### 50. Estella's P5 energy: GAME ONLY
Energy isn't logged (Estella P5 is in 4e5e, a27b, c4f3, 69e7, ad7f; her
ultimate casts bound it only loosely). Same as the triage. Operators:
Estella on **O**.

### 51. Does an effect a hit triggers count on that same hit?: LOGS (two cases decided, one LOGS IF)
- **Solemn Phalanx** (Arcane, INT: `buff_wpn_funnel_0016_wisd_natureup`,
  listed in 7 logs). 4bfe 24.2 s and 53.4 s: the buff's `since` equals the
  time of her battle-skill hit that inflicts, and both hits are plain exact
  with the engine's INT Arts DMG +0.32 on them (so ×1.32 is there; a
  next-hit-only reading would be 24% low). Also 00ae 7.4 s and a7a7 3.9 s
  (combo-seal hits). It counts on the same hit: the engine's reading.
- **Dreams of the Starry Beach** (Ardelia: `buff_wpn_funnel_0013_valid`,
  0.16–0.18): in 15 listings across 8 logs the entry's `since` equals her
  battle-skill hit; 8 of those hits are plain exact (1cd1; 4e36 at 51.5 s;
  79cc ×2; c3c7; f879 ×3, plus e49e), so both it and her Susceptibility act
  on the hit that consumes the Corrosion. The engine's reading.
- **Ancient Canal** (Da Pan): worn in no log (Da Pan's weapon in 10df is
  Seeker of Dark Lung): LOGS IF. Seeker of Dark Lung's own case is in 10df
  (Da Pan P5, one log), unchecked.
Wulfgard's Scorching Fangs, Perlica's P3 and Pulser Labs are the same
question and could be read the same way (test 72 already settled the
Wulfgard side). The triage said LOGS, same; now with the numbers.
Operators: Arcane on **O**, **T**; Ardelia, Wulfgard on **I**; Perlica on **T**.

### 52. SP from one perfect dodge: GAME ONLY
No dodge or SP in any log. Same. Operators: every operator.

### 53. Does a perfectly dodged hit count as "attacked"?: GAME ONLY
Ember, Snowshine, Purrchena and Catcher are all in 04d4 and 146d, and
Ember's combo casts and Snowshine's retaliation hits are logged, but
enemy attacks and dodges are not, so there is no trial to read. Same.
Operators: none on the teams in work.

### 56. Where the Endministrator's Crush gets its damage bonuses: LOGS (weak)
19 Crush hits of the Endministrator in 5 logs (0c14 2, 10df 7, 7e19 1,
8273 3, d4fb 6); only 2 are plain exact (7e19 at 33.7 s, 10df at 115.1
s, both 4 stacks); the rest match through assumptions or the listing, or
carry no engine value. The crystals are not a listed buff, so "on vs
off" has to come from her combo times (the crystals last about 5 s):
compare logged/predicted for Crushes inside and outside that span. The
12–17% claim is checkable, but few clean hits. Same as the triage.
Operators: Endministrator on none of the teams.

### 57. Akekuri's Link during her ultimate: LOGS (decided: ×1.30)
458b holds three Akekuri ultimates (84.4, 160.4, 227.4 s). During the
first two, Laevatain's battle skill hits (`normal_skill_during_ult`) are
five plain exact and one on the listing, with `Link (1)` = 0.30 in the
engine's reading: 91,043 / 102,079 / 293,585 (84 s); 96,842 / 108,581
(160 s). A fixed +20% would not give those exactly. The ×1.45 variant (a
Camille or Lifeng combo just before) has no instance with Akekuri. Same
as the triage; the answer is in hand. Operators: Akekuri on **O**
(Laevatain's side is **I**).

### 58. Antal's combo repeats a Lift: LOGS IF
Antal is in 0206 and 3440 (11 combo casts); no Lift, Knock Down or Crush
precedes any of them (the teams are Laevatain, Camille, Arcane, Wulfgard).
Needs Antal with Estella, Gilberta, Chen or Da Pan. Same. Operators:
none.

### 59. Fluorite's talent-2 chance: GAME ONLY
The ATK-up (`buff_chr_0022_bounda_talent_2_atkup`, 0.2) is listed on 11
of her hits in abfd, so successes show, but the Arts hits taken (the
trials) aren't logged. Same. Operators: none.

### 60. A combo trigger during the combo's cooldown: LOGS IF
Arclight's two logs (3aa6, 4bfc: 7 combo casts, 5 ultimates) have no
battle-skill cast at all, so the trigger the test uses (her battle skill
consuming Electrification inside the combo's 3 s cooldown) never occurs.
Another operator with a short combo cooldown would do as well (a combo
trigger event inside the cooldown, then no other trigger, then a cast at
the cooldown's end): none identified here. The triage said PARTLY
(positive cases only); with no case of either kind, LOGS IF. Operators:
Arclight on none; the rule itself is every combo, so all teams.

### 61. MarkCanInterrupt: PARTLY
Wulfgard's battle skill without Combustion (no `normal_skill_plus_projhit`)
occurs 5 times (4e36 59.8 s, 8915 76.5 s, c83c 4.6 s, 2b01 4.4 s, 632c
92.9 s; 25 more casts are the empowered path). His next basic-attack hit
after it: 632c 2.17 s, 2b01 3.10 s (both under the no-mark 3.9 s, over
the mark's 1.6 s), 4e36 0.1 s (a trailing projectile), c83c 6.2 s and
8915 21.8 s (swapped away). Two of five say he could act before 3.9 s,
supporting the mark, but a logged basic hit is the player's press, not
the earliest moment he could act, and 2b01's third hit is delayed by a
teammate's stop. A clean case needs a controlled Wulfgard hammering
basic after a plain battle skill. The triage said LOGS IF. Operators:
Wulfgard on **I**.

### 62. Layers on one timer: LOGS
- **Akekuri P1** (`buff_chr_0019_karin_potential_1_1`, listed once whatever
  the count; 012a, 458b, dd08): in 458b two combos 4.3 s apart (156.1,
  160.4 s) are followed by a single listing that runs to 173.9 s, 17.8 s
  after the first (about 4.3 + 10 s + her ultimate's stop): each layer
  restarting the timer, the engine's reading. One clean instance; the
  other combos are single.
- **Chen** (`buff_chr_0005_chen_talent_0_1`, 8 logs): listing spans of 29,
  34 and 46 s (a9d7, c4f3) show the buff alive as long as she keeps adding
  layers; the listing can't tell restart from separate timers, so the
  decider is the damage per layer count (basic hits in 8 logs).
- Yvonne (5082, abfd) and Ember (04d4, 146d, 2fd9, 99fb, 7e19) are in logs
  too; unlooked at.
Same verdict as the triage. Operators: Akekuri on **O**; the rest none.

### 64. A Vulnerable stack on an already Vulnerable enemy: LOGS
Chen's combo (12 s cooldown at P5; her own Lift makes stack 2 inside it):
62 combo casts in 8 logs, many with a teammate's Lift, Knock Down or Crush
within 3.5 s before. The cases that decide it are casts when the enemy is
already Vulnerable from her previous combo (gap ≤ 20 s) and a teammate's
status lands 0.2–1.5 s before the cast: a9d7 at 38.8 s (gap 12.9, Estella's
Lift 0.2 s before) and 149.0 s (13.1, 1.2 s); c4f3 at 82.7 s (17.1) and
157.0 s (11.4); 10df at 38.3 s (15.1, Da Pan's Lift 1.4 s) and 122.2 s
(13.3, Da Pan's Knock Down 1.3 s); d4fb at 126.1 s (12.2, Lifeng's Knock
Down 1.1 s); de6a at 131.2 s (13.9). So a stack added to a Vulnerable
enemy opens her combo: the engine's reading. Caveat: stack counts and
Vulnerable's end aren't logged (20 s assumed). Da Pan's "reaches 4" half:
10df only, unchecked. The triage said PARTLY; the Chen half is decidable.
Operators: Chen, Da Pan on none.

### 65. Arclight's talent counter: LOGS IF
No Arclight battle skill in any log, so no extra attack and no counter;
her team buff isn't in the listing either. Needs Arclight casting the
battle skill on an Electrified enemy several times, 10+ s apart and then
within 10 s. The triage said PARTLY. Operators: none.

### 66. A forced Electrification on a stronger one: LOGS IF
The Electrification lane (`buff_common_pulse_pulse_conduct_triggered_do`,
value, `since`, `source`) is readable: Perlica's forced one lists 0.24–0.30
(Arts-Intensity scaled), reaction ones 0.12 / 0.16 / 0.20 / 0.24 (levels I
to IV). In 62 Perlica combos in 11 logs none lands while a level II or
higher entry is still listed (closest: c6d8, a teammate's level III listed
to 60.7 s, her combo at 62.9 s, so it had ended): 3aa6, 4bfc and c6d8 show a *later* reaction replacing her
forced one (Zhuang Fangyi's 0.24 at 124.45 s, 0.16 at 154.71 s; Arclight's
0.16 at 90.61 s), and her combo replacing a level I (4360, 4d60, 4bfc).
Needs a Perlica combo within a few seconds of a level III or IV from
a teammate. The triage said LOGS. Operators: Perlica on **T**.

### 67. Perlica's finisher: LOGS
Perlica finishers (`power_attack`) exist: 4360 at 58.4 s, 9847 at 64.1 and
136.8 s (the triage said none). No Knock Down hit (`buff_physical_knockdown`)
within 0.7 s of any of the three, on enemies that survived: the engine's
reading (no Knock Down on a surviving enemy). Three instances; the
Vulnerable stack isn't logged. Operators: Perlica on **T**.

### 68. Perlica's P3 layers and Wild Wanderer: PARTLY
Wild Wanderer (`buff_wpn_funnel_0004_up`, 3aa6, 4d60, c6d8, d774): every
listed entry begins at a Perlica combo (3aa6 6 of 6 starts at her combos,
4d60 7 of 7), so the forced Electrification gives it, as the engine has;
no start at a reaction Electrification, and her one reaction Electrification
(`buff_common_pulse_cryst_triggered`, e82d) is in a log without the weapon,
so the reaction half is LOGS IF. P3's ATK (`..._potential_3_atkup`, 0.2
listed once, 12 logs): layers come from damage; only the reaction
Electrification in e82d tests the "two layers per reaction" half. The
triage said LOGS; the reaction half is missing. Operators: Perlica on **T**.

### 69. Chen's P1 at full HP: LOGS (decided in a27b and d4fb)
The listing shows the P1 buff from the first Chen hit on Rhodagn only (7e19,
a27b), and in no other fight, though every fight runs until the enemy dies
(the logged damage sums to the same total per enemy: 2.29 M, 5.91 M, 7.67 M,
6.01 M, 5.99 M). The engine now has the HP condition. a27b: Chen's basic
hits have logged/predicted 1.000 above half HP (16 hits, 15 plain) and 1.000
below with P1 on (28 hits, 24 plain). d4fb: median ratio 1.000 above half,
1.166 below (the +20% missing from the prediction there; the engine lacks
the enemy HP in that log). So P1 follows the HP; "always on" is out. The
listing on Rhodagn is not the evidence. Operators: Chen on none.

### 70. Xaihi's crystal: PARTLY
Part 1 (Arts Amp on a hurt operator): GAME ONLY (HP isn't logged). Parts
2–3: Xaihi's battle-skill casts, combo casts and everyone's final basic
hits are logged: 10 battle-skill to combo pairs in 5 logs (5082, 9555,
abfd, b6aa, c3c7). Three have the combo 10 s or more after the battle
skill (abfd 10.3 s, c3c7 17.0 and 22.3 s), where an expiring count would
have needed a fresh Final Strike (they exist, so not decisive); c3c7 at
44.0 / 47.4 s has two battle skills 3.4 s apart before a combo at 66.3 s
(part 2). Final Strikes by the controlled operator need to be told apart
from teammates' own attacks. The triage's PARTLY. Operators: none.

### 71. Alesh on consumed Originium Crystals: PARTLY
Part 1: 0c14 (Rossi, Endministrator, Si, Alesh) has the Endministrator's
combo at 130.5 s, her Crush at 133.1 s and Alesh's combo hit at 133.9 s
(0.8 s after the consumption): one positive case; the second Crush
(182.3 s) comes 15 s after Alesh's last combo (cooldown). Alesh's combos
also come 3.7 s after the Endministrator's combo three times (59.6, 81.9,
166.9 s), which is when crystals would run out, an unresolved case; with
no other trigger separable. Part 2 (Solidification length by Cryo stacks):
the Solidification lane (`buff_common_originum_frozen`) isn't listed in
Alesh's logs (4e36, ad7f, 69e7), so GAME ONLY. Operators: Alesh,
Endministrator on none.

### 73. Avywenna's returning lances and Cohesive Traction: LOGS (part 1), LOGS IF (part 2)
Avywenna P5 is in 4360 and 9847. Her battle skill then logs 3 / 9 / 3 / 9 /
11 `combo_skill_lance_back` hits (one, three, one, three combos' lances; the
11 has the ultimate's returns), each lance hitting the one enemy once, none
missing, as the engine assumes. Per-lance damage is ×1.25–1.29 the battle
skill's hit, not the ×1.12 the test text predicts (buff states differ;
worth a look, no more). Cohesive Traction is worn in no log. The triage
said LOGS IF. Operators: none.

### 74. Da Pan's P5 stack and the Lift: LOGS (weak)
10df has three battle skills of Da Pan P5 (2.8, 67.8, 146.3 s), each the
first on a fresh enemy; none has a Lift hit (`buff_physical_airborne`),
which fits the data's order (the Lift only adds a stack). It does not
rule out "his battle skill never Lifts": that needs one on an
already-Vulnerable enemy (none). The triage: "10df only: weak". Same.
Operators: Da Pan on none.

### 75. Chen's ATK and the copied toggle: PARTLY
- **Glorious Memory** on Chen (7e19, a27b, d4fb, 8273): `wpn_lance_0003`
  is never listed, and a27b's hits are exact with the toggle off (39 of 44
  basic hits plain), so the toggle is off there. 7e19's Chen drifts ×1.15
  and others ×1.0–1.4: their builds (levels, gear) aren't in the logs.
- **Umbral Torch** (Laevatain) and **Opus: Etch Figure**: worn in no log
  (Laevatain's weapon in every log is `wpn_sword_0006`): LOGS IF,
  and it is the **I** team's weapon question.
- **Lifeng's talent 1** (ATK per Intellect and Will): d4fb, 8273, de6a;
  de6a's basics all match, the other two don't, builds unknown: unclear.
- The stat panel itself: GAME ONLY.
The triage's PARTLY. Operators: Laevatain on **I** (Umbral Torch); Chen,
Lifeng on none.

## Where this pass differs from the 2026-11-13 triage

| # | triage | now | why |
|---|---|---|---|
| 45 | LOGS IF | PARTLY | cooldown-end casts after a hover exist (6), ambiguous without Signs |
| 48 | LOGS | LOGS IF | Valiant hits exist (10), no skill-type bonus is up in any |
| 60 | PARTLY | LOGS IF | Arclight never casts her battle skill in the logs |
| 61 | LOGS IF | PARTLY | 5 plain casts exist; two show a basic hit at 2.2 / 3.1 s |
| 64 | PARTLY | LOGS | Chen's combo after a teammate's Lift: 8 cases |
| 65 | PARTLY | LOGS IF | no Arclight battle skill, no counter listed |
| 66 | LOGS | LOGS IF | no Perlica combo overlaps a level II+ Electrification |
| 67 | LOGS IF | LOGS | three Perlica finishers (4360, 9847 ×2), no Knock Down |
| 68 | LOGS | PARTLY | forced half decided, reaction half has no log |
| 73 | LOGS IF | LOGS | Avywenna P5 is in 4360 and 9847 (part 2 stays LOGS IF) |

## The LOGS tests most worth deciding next

Ranked by what moves the three teams, cheapest first within a tier:

1. **51** (Solemn Phalanx on Arcane: **O**, **T**; Starry Beach on Ardelia:
   **I**): already shown, 4 and 8 plain exact hits. Write it up and close;
   the engine already agrees.
2. **41** (Si: **O**, **I**): 37 exact finals with the bonus, 4 without;
   write up, look for an ultimate-only cast.
3. **57** (Akekuri: **O**): ×1.30 in five exact hits; write up.
4. **43** and **46** (Typhoeus: **T**): the 5th-shot burst (8 of 11) and the
   Hail of Arrows count and window; these change her hovering and
   ultimate numbers. Needs the replay's time stops for 46.
5. **67** (Perlica: **T**): three finishers, no Knock Down; write up.
6. **68**'s forced half (Perlica: **T**): Wild Wanderer follows the combo
   in 13 of 13 starts (3aa6, 4d60); the engine already counts it.
7. **62** Akekuri P1 (**O**): one clean restart case; check Chen's damage
   for the general rule.
8. **69**, **64**, **73**, **74**, **56** (Chen, Da Pan, Avywenna, Endministrator:
   none of the three teams): cheap, decided or nearly, low impact.

LOGS IF worth importing a log for, by team: **75/Umbral Torch** (a
Laevatain log with Umbral Torch, **I**), **66** (Perlica's combo within a
few seconds of a level III or IV Electrification, **T**), **68** (Perlica
with Wild Wanderer casting her battle skill on a Cryo-inflicted enemy,
**T**), **60** and **65** (Arclight casting her battle skill, none),
**48** (Valiant with a skill-type-only bonus, **O** if the owner's Estella
wears it).
