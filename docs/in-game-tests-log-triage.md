# In-game tests the logs could decide (triage, 2026-11-13)

The owner's question: how many open tests in [in-game-tests.md](in-game-tests.md)
can log analysis decide instead? One opus pass over the 98 open tests (2, 47,
55, 77, 91, 99 answered) and 51 non-hold-out logs, with greps and short
scripts, no full analyses. Model output: each line is a claim to check
when that test is worked on, not a result.

**48 LOGS** (the logs we have decide it), **12 LOGS IF** (logs could, none we
have shows the case), **24 PARTLY**, **14 GAME ONLY** (SP, energy, HP,
cooldowns, dodges, dashes, positions, screen).

## Already decided by a log (written up 2026-11-13, verified by sonnet)

- 72: Wulfgard keeps 0.3, teammates get 0.15 (4e36).
- 89: Zhuang's talent 1, strikes ×1.117 (4bfc), as the engine says.
- 17, Wulfgard variant: cast to extra shot 1.7–2.2 s (4e36): fits skips.
- 63: Alesh's combos 0.8–3.5 s after Shatters (69e7); Razorhorn's ATK starts on Shatter hits (a27b: Estella's weapon, not Chen's).
- 79: Yvonne's Final Strike remap lasts at least 4 s (abfd: 4.1 s and 6 s after the bomb).
- 83: Last Rite's Mirages, b6aa agrees with the owner's call (partly: rules out "each member once", can't separate the two readings).

## The engine looks wrong (to check first)

- 25: up to 11 layers of Liino's weapon buff listed on one operator, against max_stack 4. Checked 2026-11-13: the damage fits 4; the log over-lists such buffs (open-problems).
- 96: Ardelia's Wooly Party shows 7 hits (4e36) and 3 (c3c7), not 11. The owner: the sheep fly at random, so the count varies; the engine's 11 is a ceiling, counted from 23 ultimates in 20 logs: mean 6.1 below P3, 8.6 from P3 (open-problems).
- 78: none of Lifeng's 7 ultimates has a third hit, even 4–7 s after her combo (d4fb).
- 69: Chen's P1 is listed only against Rhodagn (7e19, a27b), never in d4fb, de6a, 10df, 8273.

## What the logs show (general)

- Finishers are logged as `*_power_attack` (always under `poise_break_damage_taken_scale`).
- Buffs whose layers share one timer (stacking type 8) are listed once
  whatever the count (Chen's talent, Akekuri's P1, Ember, Perlica's P3);
  buffs with a timer per layer once per layer.
- Link is never listed.
- Casts are logged for some operators only: Laevatain's battle skill, Rossi's
  combo, Arclight's combo and Chen's skills have hits but no casts.

## Ranked LOGS candidates (value for the favourites, effort S/M/L)

1. 8 Link sources (M): battle skills and ultimates after ordinary combos vs Camille's (10 logs) or Lifeng's (d4fb, de6a, 8273).
2. 12 Gilberta's Susceptibility (S): listed 0.36 / 0.39 / 0.42, 5.0 s (40d9, 4e5e, 3f78, 489c, 4a64); map to Vulnerable stacks.
3. 104 + 37 freezes on bosses (M): when listed debuffs end on Rhodagn with Si (40d9, b7b3, abfd, e82d) vs non-bosses (458b, 4e36, a7a7, 9a80).
4. 25 Liino's weapon stacks (S, once the counts above 4 are explained).
5. 17 / 20 / 21 / 22 Laevatain (S–M): Twilight's length; extra hit and explosion (e989, 6339, 40d9, db87, 0206, 3440); a combo inside Twilight (e989); `ignore_fire_resist` listings 21–23 s (458b, 0206).
6. 7 Arcane INT under her Corrosion (M: a7a7, 0b4a, 4bfe) and 30 her talent-1 Susceptibility, 10 or 20 s (S, 34 logs).
7. 13 Arcane's WILL combo cooldown (S): pairs about 18 s apart (b6aa, a7a7, 1d91); 3f78's one 16.9 s cycle.
8. 10 and 41 Si (L): combo damage by stacks; Jade Vessel's bonus.
9. 9 (M) Typhoeus's burst ×1.3 (130 bursts, 11 logs); 43 (S) off-field shots; 46 (S) Hail of Arrows (dbae, d9e5, 7b4e).
10. 26 Liino's volley trigger (M): volley times vs reactions.
11. 86 Rossi's combo cooldown (M): gaps between sequence-1 hits (12 logs).
12. 4 Corrosion ramp (L): fixed-scale hits into Corrosion (3f78, 489c, 4a64, 9a80, 0eef, bdf2).

## Every open test

| # | Verdict | Why / logs and what to measure |
|---|---|---|
| 1 Stat panels | PARTLY | Plain matches check ATK aggregation; rounding and flat-ATK gear need the panel. |
| 3 Breach and Arts Intensity | LOGS | `physical_do_fracture` listed with a varying value (0.313–0.437); Pogranichnik in 7e19, d4fb, de6a, 10df, 8273: compare with the applier's AI. |
| 4 Corrosion ramp | LOGS | See ranked list. |
| 5 Reaction bonus grouping | LOGS IF | No "Arts Reaction DMG" buff listed anywhere. |
| 6 Liino's ultimate | LOGS | 175 projectile hits in 9–10 logs: value / (ATK × scale). |
| 7 Arcane INT under her Corrosion | LOGS | See ranked list. |
| 8 Where Link comes from | LOGS | See ranked list; two stacks LOGS IF. |
| 9 Typhoeus's burst ×1.3 | LOGS | With and without a Nature infliction before the arrow. |
| 10 Si's combo by stacks | LOGS | Final hit / ATK gives n; windows opened twice. |
| 11 Estella's combo, non-Solidified | LOGS IF | All 21 of her combos come with a Shatter. |
| 12 Gilberta's Susceptibility | LOGS | See ranked list. |
| 13 Arcane's WILL combo cooldown | LOGS | See ranked list. |
| 14 Si's skill element, Heat in slot 1 | LOGS | 40d9, 458b, 6339 (Laevatain first); reactions after Si's battle skill; check the fixture's team order is the slot order. |
| 15 Swapping during a battle skill | PARTLY | Own casts logged, swaps aren't. |
| 16 Skill cancels a basic attack | PARTLY | A Final Strike after its operator's cast shows; the press time doesn't. |
| 17 Laevatain's jumps | LOGS | Wulfgard variant decided (above); Twilight's length bracketed by enhanced and plain hits. |
| 18 What a time stop freezes | PARTLY | Overlapping ultimates, Twilight's end, Estella's Physical Susceptibility; cooldowns and SP aren't logged. |
| 19 Haste | PARTLY | Hit spacing in a chain after Si's Inksoul; cooldowns only as bounds. |
| 20 Laevatain's multipliers | LOGS | e989 already favours the data. |
| 21 Twilight with combos | LOGS | e989. |
| 22 Scorching Heart's 20 s | LOGS | Listings 21–23 s (458b, 0206); extension by an empowered cast at 4 Melting Flame. |
| 23 Laevatain's P1 SP | GAME ONLY | SP. |
| 24 Heat absorption | PARTLY | Empowered casts and finishers logged; Melting Flame isn't. |
| 25 Liino's weapon stacks | LOGS | Counts above 4 (above). |
| 26 Liino's volley trigger | LOGS | Volley times vs reactions vs 10 s ticks. |
| 27 Liino's combo in Cosmovoice | PARTLY | Combo casts after her ultimate logged; energy isn't. |
| 28 Liino in Vocalist Stance | PARTLY | Part e (the ATK linger) from the listing; the rest muddled by beats or control. |
| 29 Sub-skills as battle skills | PARTLY | Yinglung, Link, Umbra (`funnel_0019_intensityup`), Mi Fu + Lifeng (de6a); Starry Boost's icon isn't. |
| 30 Arcane's talent-1 Susceptibility | LOGS | See ranked list. |
| 31 Finishers in Arcane's array | LOGS | Lasers after finishers with no Final Strike near: a7a7 49.9 s, c516 49.7 s, b6aa 46.6 s. |
| 32 Gloompurge window | PARTLY | Second-ultimate casts logged (13 logs); energy isn't. |
| 33 Arcane's WILL touch element | LOGS IF | No log has the differing case. |
| 34 Arcane's INT combo without battle skill | LOGS IF | Not seen; the SP part is game only. |
| 35 Combo windows from a reaction | LOGS | Positive cases (Gilberta after her own Corrosion, Arcane after an instant reaction); Wulfgard LOGS IF. |
| 36 Cooldowns cut by a percentage | PARTLY | Typhoeus's combos never closer than 19.2 s; Arcane P5, Da Pan bounds only. |
| 37 Timers while Imprisoned or Immobilized | LOGS | Ends of listed debuffs (Jade Vessel 30 s, Gilberta 5 s, Typhoeus's combo debuff); Tangtang LOGS IF. |
| 38 Two Susceptibility sources | LOGS | Same-element pairs: Physical (a27b, 69e7), Nature (489c, 3f78), Arts (4e36): sum or larger; Gilberta + Ardelia LOGS IF. |
| 39 Swordmancer | LOGS | 82 procs in 14 logs; Lifeng's talent 2 in 3. |
| 40 Messenger's Song | GAME ONLY | Energy. |
| 41 Jade Vessel's combo bonus | LOGS | Si's combo damage; few clean cases. |
| 42 Typhoeus's hover end | PARTLY | P1 ATK listing shows it; Signs aren't logged. |
| 43 Typhoeus's off-field shots | LOGS | Shots and bursts after a battle skill (10 logs). |
| 44 Signs from a Nature Burst | GAME ONLY | Sign counter. |
| 45 Typhoeus's combo at hover end | LOGS IF | — |
| 46 Hail of Arrows | LOGS | Rains per ultimate (dbae, d9e5, 7b4e). |
| 48 Valiant | LOGS | 4e5e, only if her build has a skill-type bonus. |
| 49 Estella's talent-1 SP | GAME ONLY | SP. |
| 50 Estella's P5 energy | GAME ONLY | Energy. |
| 51 An effect on its own hit | LOGS | Solemn Phalanx (a7a7, 0b4a, 4bfe, d9e5), Starry Beach (1cd1, 4e36, c3c7), Seeker of Dark Lung (10df); Ancient Canal LOGS IF. |
| 52 SP from a perfect dodge | GAME ONLY | — |
| 53 Dodged hit counts as attacked | GAME ONLY | Dodges and enemy attacks aren't logged. |
| 54 Dash cancels | GAME ONLY | Dashes. |
| 56 Endministrator's Crush | LOGS | Crush with crystals on vs off (0c14, 7e19, d4fb, 10df, 8273). |
| 57 Akekuri's Link | LOGS | 458b: Laevatain's enhanced battle skills in Akekuri's ultimates, ×1.30 or ×1.20. |
| 58 Antal repeats a Lift | LOGS IF | No Lift source on his teams. |
| 59 Fluorite's chance | GAME ONLY | Trials not logged. |
| 60 Trigger during cooldown | PARTLY | Positive cases only. |
| 61 MarkCanInterrupt | LOGS IF | One plain Wulfgard battle skill, no basic after. |
| 62 Layers on one timer | LOGS | Where the listing stops (Chen, Akekuri P1, Ember); counts from damage. |
| 63 Shatter as a consumed reaction | LOGS | Decided (above). |
| 64 Vulnerable on Vulnerable | PARTLY | Positive cases only. |
| 65 Arclight's counter | PARTLY | Her team Electric DMG buff not identified in the listing. |
| 66 Forced Electrification | LOGS | Listed with its level's value (Perlica, 6 logs). |
| 67 Perlica's finisher | LOGS IF | No Perlica finisher. |
| 68 Perlica's P3, Wild Wanderer | LOGS | P3 from damage; Wild Wanderer in 3aa6, c6d8, d774. |
| 69 Chen's P1 | LOGS | Rhodagn only (above): enemy HP or type. |
| 70 Xaihi's crystal | PARTLY | Parts 2–3 from casts; HP part game. |
| 71 Alesh on consumed crystals | PARTLY | 0c14 for part 1; Solidification length not logged. |
| 72 Wulfgard's P3 | LOGS | Decided (above). |
| 73 Avywenna | LOGS IF | No log. |
| 74 Da Pan's P5 and the Lift | LOGS | 10df only: weak. |
| 75 Chen's ATK, copied toggle | PARTLY | Glorious Memory never lists `wpn_lance_0003` on Chen (4 logs); Chen's build needs the panel. |
| 76 Purrchena | PARTLY | Parts C, D from event keys (04d4, 92b4, 99fb, 146d). |
| 78 Lifeng's third hit | LOGS | 0 of 7 (above); check a teammate used the Link first. |
| 79 Yvonne's remap | LOGS | Decided (above). |
| 80 Home Longing | LOGS IF | No log. |
| 81 Last Rite's Hypothermia | LOGS | Cryo Susceptibility listed (b7b3, 9555, b6aa, c3c7). |
| 82 Last Rite's chain | LOGS | Chain hit spacing around her casts. |
| 83 Last Rite's Mirages | LOGS | Agrees with the owner's call (b6aa). |
| 84 Tangtang's own Haste | GAME ONLY | Positions, Haste. |
| 85 Rapid Ascent | LOGS | Chen in de6a, 10df: basics under Stagger vs not. |
| 86 Rossi's combo cooldown | LOGS | See ranked list. |
| 87 Sunderblades | LOGS | 4bfc per cast 3, 5, 7, 9, 9; also 3aa6, c6d8, d774. |
| 88 Empyrean | PARTLY | Combo recasts logged; SP, swaps aren't. |
| 89 Zhuang's talent 1 | LOGS | Decided (above). |
| 90 Mi Fu's trigger | PARTLY | Positive cases only. |
| 92 Long Heritage | LOGS IF | No log. |
| 93 Camille's talent 2 | LOGS IF | No Camille + Liino team. |
| 94 Thermite Cutter | LOGS | d4fb, 8273: layers rise around Lifeng's combos. |
| 95 Third Whirlpool | GAME ONLY | SP refund, Whirlpools. |
| 96 Wooly Party | LOGS | 7 and 3 hits vs 11 (above). |
| 97 Dives | GAME ONLY | One dive hit in all logs; pace LOGS IF. |
| 98 Food | PARTLY | Stew decided by 7e19; tea and DEF need the panel. |
| 100 Rhodagn's bar | PARTLY | When and at what HP (8 logs); what he does isn't logged. |
| 101 Teammate's own attacks | PARTLY | Gaps logged; who's controlled isn't. |
| 102 SP refill | GAME ONLY | SP. |
| 103 Liino's presses | GAME ONLY | Part a can't be told from beats. |
| 104 Bosses and freezes | LOGS | See ranked list; Jade Vessel's 30 s end pinned to about 0.35 s. |

## Worked on (2026-11-13, overnight diagnoses)

Small-model findings, with the evidence in the session's scratch notes;
claims to check before they change the engine.

- **86 Rossi's combo cooldown: not decided.** 12 logs. Shortest gap
  sequence 1 → sequence 1 with sequence 2 in between 16.85 s (0c14; its
  sequence 2 hit at +5.99 s), without 25.2–25.6 s (c516, 4e5e). The
  engine (14 s from the sequence-2 press, about 21 s without) fits only if
  0c14's sequence 2 was pressed late (≥ 2.85 s after sequence 1); the
  press time can't be placed from the hits (sequence 1's hit 2 lands 0.6–
  3.5 s after hit 1, against the kit's frames). Nothing contradicts the
  engine.
- **43 Typhoeus's off-field shots: not decided.** 13 logs: four hover shots
  (about +1.0, 1.6, 2.3, 2.9 s after the battle skill), usually cut by the
  player's combo; uninterrupted hovers show a fifth shot (6 cases: 1d91
  ×2, 9c6e, 7b4e ×2, 8318), as the engine has. A burst follows the fifth
  shot in 4 of 6 (+0.31–0.65 s), against "the fifth is plain", but bursts
  are paired to shots by time only.
- **46 Hail of Arrows: not decided.** Where a log is complete, the count
  fits (d9e5 at 9605 ms: 5 shots, 4 rains and 1 empowered rain); dbae and
  d9e5's second end too soon; 7b4e's empowered rain lands at +6.7 s, past
  a 5 s window counted from the ultimate (where the window starts is open).
- **20 Laevatain's multipliers: decided** (the data's reading; see test 20).
- **22 Scorching Heart's 20 s: not decided, the logs conflict.** 0206 and
  458b end it before an extension by the empowered extra or the explosion
  would (against a restart on a capped gain); later in 0206 the log lists
  it over 89.5–102 s and 110–117 s where the replay has it off, ending
  about 20 s after empowered extras (for a restart). The in-game test stays.
- **21 Twilight with combos, 17 Twilight's length: not decided.** e989 has
  no upper bracket; 458b's brackets (33.7–34.1 s and 28.7–29.2 s after the
  ultimate) are far above the model's ~19–23 s, not yet explained by
  teammates' time stops or other pauses.
