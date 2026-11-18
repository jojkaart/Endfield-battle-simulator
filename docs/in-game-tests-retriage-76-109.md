# In-game tests 76-109, re-triaged against the logs (2026-11-18)

The owner's rule ([in-game-tests.md](in-game-tests.md), "Logs first"): don't
ask for what the logs can decide. This pass redoes the
[2026-11-13 triage](in-game-tests-log-triage.md) for the open tests 76-109,
looking at the development logs (79 fixtures; hold-out logs not touched):
each entry says what was looked at and how many instances were found. Not
covered: 97, 98, 100, 106-109 (another agent decides them), and tests already
answered or decided (77, 79, 83, 89, 91, 94, 99, 103, 104, 105). Nothing in
the engine, kits or the other test files was changed; provisional answers
are claims to check when the test is worked on, not results. Short fixture
ids as in the triage (`d4fb` = `zmdlogs-d4fb69b036fe`; `8273` is the
multi-target `82735c6db6fc`). Scratch scripts only (`scratch/`, not kept).

Verdicts: **5 LOGS** (85, 87, 92, 96, 101), **4 LOGS IF** (80, 81, 82, 93),
**6 PARTLY** (76, 78, 86, 88, 90, 95), **2 GAME ONLY** (84, 102).
Changed from the triage: 78 (the finding), 81, 82, 86, 92, 95, 101.

Teams in work: owner = Estella, Si, Akekuri, Arcane; Ink Melt = Laevatain,
Si, Wulfgard, Ardelia; Typhoeus = Typhoeus, Arcane, Liino, Perlica.

What the log lists, learned on the way: effect lanes are damage-relevant
buffs only (no Haste, shields, HP, heals, SP, Whirlpools); a weapon's team
buff is listed on the wielder's hits only (Long Heritage's, below), so a
buff on teammates can be invisible; Vulnerable/Susceptibility lanes carry no
stack counts.

## 76. Purrchena's shield, Giftbox, Handicraft - PARTLY (C, D: LOGS; A: GAME ONLY)

Logs: 04d4, 146d (multi-target), 99fb; Purrchena in none of the three teams.
- A (shield up while she swings): the shield and its icon aren't listed.
  After 32 + 3 + 15 battle-skill casts her first attack came 2.5-30 s later
  (min 2.5, 2.7 and 3.0 s); she may not have been controlled, so no bound on
  the shield. GAME ONLY.
- C (Giftbox never repeats): classed each of 25 combo casts by its hits in 8 s:
  explosion (`combo_skill_abilityrange_1_1`) 7, dessert-like
  (`combo_skill_projhit_3`) 9, neither (a vortex, or hits that missed) 9.
  Pairs of consecutive combos 5-40 s apart: 10, none repeats its class
  (independent thirds: (2/3)^10, 1.7%). Three same-class pairs 3.2-4.5 s
  apart look like a doubled event (data.md "Hidden casts"), not two casts.
  The data's rule fits; provisional answer: LOGS, "never the previous".
- D (one vortex per ultimate): 15 ultimates; 7 show a vortex (5 or 4
  `abilityrange_blackhole` pulses about 0.5 s apart), none shows two
  full vortexes; 146d at 171463 shows 1 + 4 pulses 2.4 s apart (a cut
  one, or two). 7 of 7 fit "at most one"; Ambassador's Special unknown.
Operators on the teams in work: none.

## 78. Lifeng's Link: the ultimate's third hit - PARTLY (differs from the triage's "0 of 7")

Logs with Lifeng: d4fb, 8273, de6a (7 ultimates; hits `ultimate_skill_abentity`).
- Not zero: 8273's second ultimate (137127 cast) has three hits (+0.0, +3.4,
  +6.0 s: 53219, 35653, 48419), the only third hit; her own combo came 3.4-4.3 s before
  with no battle skill or other ultimate in between (an Endministrator
  ultimate sat at -4.3 s, before her combo's second hit) - part 2 of the
  test, as the engine has it. The other six have two hits: each has a battle
  skill (d4fb 56282: Chen at -2.3 s; 8273 76053: Chen at -4.3 s) or another
  operator's ultimate (d4fb 125008 and 189367: Endministrator at -2.5, -2.3 s)
  after her combo, which spends the Link (de6a's two: not clear, Mi Fu's
  casts in between).
- Part 1 (no combo in 20 s) and 3 (only others' combos): no instance, every
  ultimate had her own combo within 11 s. Part 4 (17-18 s later): no instance
  (the longest combo-to-ultimate gap is 10.2 s). LOGS IF: a Lifeng team
  where she casts the ultimate with no combo, or 15-20 s after the combo.
Provisional: the third hit needs a Link, as the engine has it.
Operators on the teams in work: none.

## 80. Home Longing - LOGS IF

No log has Home Longing (weapon ids in the 79 logs: none). The listing would
decide it: the buff's lane `since` and end against Yvonne's battle skills
(a lane ending at the first bomb = "next battle skill only"; lasting 20 s =
the engine). Needs Yvonne (or another Cryo/Nature handcannon user) with Home
Longing and her combo then three bombs. Operators on the teams in work: none.

## 81. Last Rite's Hypothermia from a reaction - LOGS IF (the triage said LOGS)

Logs: b7b3, 9555, b6aa, c3c7. Cryo Susceptibility from her
(`buff_common_affixes_vulnerable_crystal`, source Last Rite) has 9 lanes
(0.12-0.16); every one starts within 0.5 s of one of her combo hits (b7b3
11.4 s; 9555 38.3, 67.7, 91.6 s; b6aa 32.0, 40.2 s; c3c7 25.4, 68.6, 110.6 s).
The test's case, a Mirage's Cryo turning another element's infliction into a
Solidification, isn't in them: no `cryst_fire` / `cryst_natural` event in
any of the four. Related: 6 Mirage hits end in a Cryo-on-Cryo burst
(`cryst_cryst_triggered`) and none of the six is followed by a lane (9555
61.6; b6aa 6.1, 18.7; c3c7 56.2, 92.1, 96.2 s). Needed log: Last Rite with a
Heat, Nature or Electric teammate (Laevatain, Ardelia, Wulfgard), no combo
cast of hers before the teammate's Final Strike. Operators on the teams in
work: none.

## 82. Last Rite's battle skill inside her own chain - LOGS IF (the triage said LOGS)

8 battle-skill casts of hers in 9555, b6aa, c3c7; only one falls inside her
own chain (c3c7 104425: attack1 at -0.7, attack2 at -0.1 s, then none in
4 s, the combo at +1.4 s): a single, ambiguous instance (the chain may just
have ended). Needed: a log where she is controlled and presses the battle
skill mid-chain several times, with the chain's following hits. Operators on
the teams in work: none.

## 84. Tangtang's own Haste - GAME ONLY

Haste isn't a listed effect (no Tangtang buff in b7b3 or 7910), and test 19
found Haste doesn't speed attacks, so hit spacing can't show it either. Only
the icon. Operators on the teams in work: none.

## 85. Rapid Ascent against a Staggered enemy - LOGS (decided provisionally: the data reading)

Logs: de6a, 10df (Chen with Rapid Ascent, both). Chen's non-crit basic
attacks with the same listed buffs, in and out of Stagger (the listing's
Stagger scale is 0.3, so the plain step is x1.3): 10df attack1 560 ->
1014 (x1.81), attack2 1321 -> 2423 (x1.83), attack3 737 -> 1352 (x1.83);
de6a attack4 1030 -> 2142 (x2.08). The description's reading (only battle
skills and ultimates) gives x1.3, so it is ruled out in every such pair;
the engine's data reading is the closer one (de6a's check applies Rapid
Ascent to the 15 staggered basic hits: 4 within 1%, the other 11 are
8-19% under the log, an unexplained further factor, for open-problems).
Operators on the teams in work: none (Chen).

## 86. Rossi's combo cooldown and the ring - PARTLY (the triage said LOGS)

The triage's own later note holds: 12 logs, nothing contradicts the engine,
nothing decides it. The cooldown's start is a press, and her sequence 2's
press isn't separable from the hits (Rossi's combo events are `combo_2_skill`
and `combo_2_damage`; no cast events), and the player's delay from "ready"
to press is unknown, so a gap is only an upper bound on the cooldown. Part 2
(the ring, one more Vulnerable stack) can't be read: Vulnerable lanes carry
no stack counts. What would help: more instances without sequence 2 (only
two, 25.2-25.6 s). Operators on the teams in work: none.

## 87. Zhuang Fangyi's Sunderblades - LOGS

Logs: 3aa6, 4bfc, 4d60, c6d8, d774 (about 70 battle skills outside the
Empyrean state). Strike events (`buff_..._sword_triggerd`) per cast climb by
2 a cast to a cap of 9 (4bfc 3, 5, 7, 9, 9; the first cast alone 2-3), as
the triage found, and fall after long gaps (c6d8: 7 after 23.8 s, 5 after
21.4 s, 7 after 4.0 s; d774: 8 after 3.5 s, 6 after 17.1 s, 5 after 11.9 s;
4d60: 8 then 7 4.1 s later). Whether this is the blades' timer or
Electrification's extras needs the replay compared with these gap series
(the test's part 2 is this table); not done here. Operators on the teams in
work: none.

## 88. Zhuang Fangyi's Empyrean state - PARTLY

- 1 (the free first battle skill): SP isn't logged. GAME ONLY.
- 2 (the combo's cooldown 5x faster): her combo hits inside the 25 s: gaps
  9.7, 5.2, 5.8, 4.0, 7.2, 5.5 s (6 pairs, 5 logs: 3aa6, 4bfc, 4d60, d774).
  Far below 17 s; the shortest, 4.0 s (4d60, P0), is under the description's
  4x (4.25 s) and fits 5x (3.4 s); the combo events lag the press by a
  constant, so gaps are fair. LOGS, provisional: 5x (one instance decides
  between 4x and 5x).
- 3 (does a swap end it): after an ultimate her enhanced hits
  (`attack1_ult_2_abilityrange`) return at +23.7 s after 15.6 s without
  any (3aa6, ultimate at 117222), at +22.1 s after 8.4 s (d774, 102166), and
  inside the 25 s in two more: the state seems to survive swaps, but who was
  controlled isn't logged, so not proof. LOGS IF a log with an explicit
  swap-away and a basic attack late in the 25 s.
Operators on the teams in work: none.

## 90. Mi Fu's combo trigger: a state? - PARTLY

Mi Fu in 2fd9, 99fb, a27b, d572, de6a (14 combos): gaps 22.6-38.4 s, never near
the 17 s cooldown, so no case of an immediate re-light at cooldown end; but
an unpressed button leaves no trace, and stack counts aren't listed, so the
state reading can't be excluded. What the button shows is GAME ONLY.
Operators on the teams in work: none.

## 92. Long Heritage and Si's Amp - LOGS (the triage said LOGS IF, "no log")

Logs: 632c and 67d8 (Si with Long Heritage; both multi-target). The weapon's
team Arts DMG is listed (`buff_wpn_claym_0019_teamspell`, 0.168) on Si's
hits only: 3 lanes in each log (127 and 69 hits). Every lane starts 0.4-0.5 s
after a Si battle skill (632c 7387, 46997, 76552; 67d8 9759, 95173, 123561),
none at an ultimate. 67d8's ultimate (117479) is the clean case: Amp lanes
listed on all hits from 117583, and Si's next seven hits (to +2.9 s;
nothing until the lane at 123561) carry no weapon buff; the previous lane
ended 20.0 s after its start, 2.3 s before the ultimate. 632c's ultimate
(97494) falls inside a lane that is 25.7 s long, so something refreshed it
(not decidable). Provisional (4 ultimates, one clean): Si's Amp doesn't
start the buff, against the engine's reading. Caveat: a battle skill right
after the ultimate (117583) also gave no lane, so an internal cooldown or a
condition isn't excluded. Si is on the owner's team and Ink Melt (with
Long Heritage only if the owner uses it).

## 93. Camille's talent 2 from a teammate's heal - LOGS IF

No log has Camille with Liino (checked all teams); no Camille talent-2 buff is
listed in her 13 logs (heals aren't recorded; only `talent1_atkup` shows).
Her Heat DMG would show in her own hits' values. Needed: Camille and Liino,
Liino's battle skill, Camille's combo uncast. Liino is on Typhoeus's team,
Camille on none.

## 95. A third Whirlpool - PARTLY (the triage said GAME ONLY)

Whirlpool counts and the SP refund aren't logged (SP: GAME ONLY). The
number consumed might show in Tangtang's battle skill hit count
(`normal_skill_water_projhit_1`, about 8 per cast in 7910), but the two logs
with her (7910, b7b3) never have three combos without a battle skill between
(7910: combos 7.7, 18.5, 27.8, 38.2, 59.2 s with battle skills at 16.4, 26.2,
36.4 s). LOGS IF: three combos about 10 s apart, then the battle skill.
Operators on the teams in work: none.

## 96. Ardelia's Wooly Party hits - LOGS (done; nothing for the owner)

Recounted from the logged casts: 14 ultimates in 6 logs (4e36, 5082, 7910,
9c6e, af7b, c3c7): sheep hits in 9 s of 7, 3, 10, 4, 11, 11, 4, 8, 8, 6, 5,
5, 3, 1 (mean 6.1; max 11, at P5), as the triage's 23 ultimates in 20
logs. The engine's 11 / 14 is a ceiling, now modelled as a random count.
More instances sharpen it; no in-game count. Ardelia is on the Ink Melt
team: her ultimate is the most affected number there.

## 101. A teammate's own attacks - LOGS (done 2026-11-16)

Already decided by 54 logs (in-game-tests.md 101: 43% of free time, pause
6.5 s). Nothing for the owner; the remaining spread (per operator and
fight) is a modelling choice. All teams in work.

## 102. SP refill - GAME ONLY

SP, its regeneration and the post-spend stop aren't logged; the casts only
bound supply from below (SP gained from Final Strikes and skills blurs
it), as the triage said. Not testable by hand either. All teams in work.

## The LOGS tests most worth deciding next

Ranked by impact on the three teams, then every fight:
1. **92 Long Heritage and Si's Amp** (Si: owner's team and Ink Melt):
   cheap (done above to the provisional level): replay Si's two logs with
   and without "Si's Amp counts", compare Si's own hits and the 4 ultimates;
   a wrong reading gives Si's team +11.2% Arts DMG for 20 s it doesn't have.
2. **96 Wooly Party** (Ink Melt): decided; one more step is calibrating the
   count against potential from the 14 casts, and checking the 14 / P3 ceiling
   (no P3 or higher sample above 11 hits).
3. **101 teammate pace** (every team): decided; follow-up is the per-operator
   spread (ranged units about 0.1 higher) in the rule runs.
4. **85 Rapid Ascent** (Chen, so no team in work, but it is a clean, fast
   check): the data reading holds against the description, but 11 of 15
   staggered basic hits are 8-19% under the log; a ~x1.08 factor to find.
5. **87 Sunderblades / 88 part 2 (Zhuang)**: replay gap series vs blade
   timers; the Empyrean combo gaps decide 5x over 4x.
6. **76 C and D (Purrchena)**, **78 part 2 (Lifeng)**: provisional answers
   above; low priority, operators outside the three teams.

LOGS IF, to import when a log turns up: 80 (Yvonne, Home Longing), 81 and
82 (Last Rite with a Heat or Nature teammate; her chain), 93 (Camille and
Liino; Liino is on Typhoeus's team), 95 (Tangtang, three combos).
