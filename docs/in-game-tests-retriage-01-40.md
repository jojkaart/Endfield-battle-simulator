# Re-triage of in-game tests 1–40 against the logs (2026-11-18)

The owner's rule (in-game-tests.md, "Logs first"): don't ask for what the
logs can decide. This pass re-reads every still-open test from 1 to 40
(skipped: 2, 3 done or answered; 8, 10, 12 another agent's; 13, 19, 20
decided) against the 79 development logs (hold-out logs never opened), and
says per test whether a log decides it, and how. It follows
[in-game-tests-log-triage.md](in-game-tests-log-triage.md) (2026-11-13) and
says where it differs. Identify only: no engine, kit or test change.

Method: raw fixtures (`hits`, `casts`, listed effects with `source` and
`since`, `poise`) through short scripts in scratch/, `efsim zmdlogs hits
<fixture> --json` for the engine's own factors on single logs, and a dump of
every verdict of the log check (`checkLog`, verified and pending logs; the
multi-target logs aren't checked by the engine, so verdict counts leave them
out). Fixtures are named by the first four characters of their id. A claim
is a first look with the instances counted, not a finished analysis.

Teams in work: **owner** = Estella, Si, Akekuri, Arcane; **Ink Melt** =
Laevatain, Si, Wulfgard, Ardelia; **Typhoeus** = Typhoeus, Arcane, Liino,
Perlica. Gilberta, Camille, Last Rite, Tangtang, Mi Fu, Chen, Lifeng,
Avywenna, Antal and Da Pan are on none of them.

**Counts (32 open tests): 18 LOGS, 4 LOGS IF, 8 PARTLY, 2 GAME ONLY.**
Changed from the 2026-11-13 triage: 15 and 16 (PARTLY to LOGS). Several
tests that the triage called LOGS are, on a first look, already decided
(6, 9, 14, 15, 16, 25, 31): marked "provisional answer".

## The entries

### 1. Stat panels: PARTLY (as before)
The log has the team's build, never the panel, so a panel's lines can't be
read; the engine's ATK aggregate is checked by every plain-matched hit
(`efsim zmdlogs check`: 71% plain of 804 hits in the six verified logs).
Flat ATK (slot 7): 7 logs carry a food buff (e82d, 0c14, 7e19, de6a, 4a64, 3f78,
e989), the closest thing to a flat-ATK line; the stew's own match is
test 98's. Rounding and any new gear need the panel. Teams: every operator.

### 4. Corrosion ramp: LOGS (as before; large effort)
Corrosion's listing has no value, so the ramp is read off fixed-scale hits
into a Corrosion. 54 Corrosion openings (`buff_common_natural_triggered`)
in 26 logs, 315 Corrosion-reaction hits (`natural_natural_*`) in 25; Liino's
fixed-scale follow-ups (24 logs, 1,457 hits) and her ultimate projectiles
(19 logs) are the probes the test text already uses (0eef, bdf2, d9e5).
Decide it with a per-hit fit of resistance shred against time since the
opening, with the time stops subtracted. Teams: Arcane's Corrosion (owner,
Typhoeus), Liino (Typhoeus).

### 5. Reaction bonus grouping: LOGS IF (as before)
No listed buff in any log carries an Arts-reaction DMG attribute (the
census of 109 listed buff keys has none), and no kit has a source
(engine-rules D27 refuses it). A log would need an operator or gear that
adds one. Teams: none.

### 6. Liino's ultimate: LOGS, provisional answer: settled (differs: the test text is stale)
The "only log" the test cites (parser v58) is old: 19 logs now record her
ultimate (624 hits; 476 are projectile hits). The kit has 42 projectiles
(two per frame, kit-batches/batch-1/chr_0035_liino.md), which is the
"2 ×". The check matches 333 of them plain (dbae, a verified log: 25 of 25
plain; 9090 34, 4bfc 51, 1cd1 19, d774 32, 4d60 47), with mismatches
concentrated in three logs (7910 25, 8915 27, 9847 28) that look like
buff-listing problems, not scale. Teams: Typhoeus.

### 7. Arcane's INT damage under her Corrosion: LOGS (as before)
Six logs have her INT combo (`seal2`, `seal_finisher_wisd`): 00ae, 8915,
a7a7, d9e5 and the multi-target 0b4a, 4bfe. Of Arcane's own hits the check
gives 00ae 147 plain + 27 assumed, 0 mismatch; a7a7 223 plain, 18 mismatch;
but 8915 313 of 360 mismatch (engine about 1.85 times the log, P0 Arcane,
basics) and d9e5 15 mismatch (the old game-1.5 log). So 1.6 INT logs do
not show "twice the model" (00ae, a7a7 fit); 8915 shows the opposite
direction and is unexplained. The Amp-icon question (does the buff last 20 s)
can be read from the listed Amp lane after her ultimate in 00ae and a7a7.
Teams: owner, Typhoeus.

### 9. Typhoeus's burst x1.3: LOGS, provisional answer: the engine's x1.3 fits
`enchence_burst_damage_rate` is in the engine's burst when the arrow consumed
Nature. 262 burst hits in 16 logs (`..._triggered_typhoea`). In fc63 and 9090
(`hits --json`): the engine applies x1.3 to 18 bursts and matches 15 plain, 2
assumed, 1 fallback, no mismatch; the other bursts (no consumption) match
plain too (10 + 21). Mismatches (fc63 13, 1d91 6) are all in the no-x1.3
group, late in those logs (ratio to the engine not a constant 1.3: other
causes). Left to do: the other 14 logs, to see whether any
no-x1.3 mismatch is a missed consumption. Teams: Typhoeus.

### 11. Estella's combo on a non-Solidified target: LOGS IF (as before)
29 distinct combos in 6 logs (4e5e, a27b, c4f3, a9d7, ad7f, 69e7): every one
has a Shatter hit (`cryst_triggered_physical_break`) on the same frame, i.e.
every one met a Solidified target. A log with her combo more than about 6 s
after her Solidification (she casts it late) would show the smaller scale.
Teams: owner.

### 14. Si's battle-skill element with a Heat operator in slot 1: LOGS, provisional answer: confirmed (differs: decidable now)
The Arts Burst credited to Si about 1.0 s after her battle-skill hit
(`normal_skill_abilityrange_1`, the burst delay) is `fire_fire` with a Heat
operator first and `cryst_cryst` otherwise. Heat first (Laevatain 458b, 9c0b;
Wulfgard c83c, 632c, 67d8; Camille db87): 11 Si-credited `fire_fire` bursts
in 6 logs, 4 of them paired to her battle-skill hit (458b 173755, 9c0b 43169,
c83c 64835, 632c 77489), the rest unpaired. Not Heat first (Si, Arcane, Gilberta first;
9555, abfd, ad7f, 69e7): 9 `cryst_cryst` bursts (8 paired to her
battle-skill hit; Si first in 4f7e gives one `cryst_fire`). Her hit's own element field stays `cryst` in every
logs (it is the damage element, not the infliction). Teams: owner (Estella
first: Cryo), Ink Melt (Laevatain first: Heat).

### 15. Swapping during Gilberta's battle skill: LOGS, provisional answer: swaps are not blocked (changed from PARTLY)
Her battle skill is a field that logs five hits (pulls at frames 29, 46, 62,
78 and the explosion at 108), so the cast time is the first hit minus 0.97
s. In 19 casts (8 logs), another operator's fresh basic chain (`attack1`)
starts inside the 3.7 s the data forbids switching in: 16 of 19, median 0.76
s after the cast (e.g. 00ae Arcane's attack 1 at +0.7 s; 632c Si at +0.38 s;
a27b Chen at +1.3 s), and a teammate's battle-skill cast comes inside the
lock in 4 of 19. The field keeps all five hits every time (swap-out does not
cancel it). Her own combo or ultimate inside the lock: 0 of 19 (nothing for
`cantCastSkill` to show; teammates' combos 0, ultimate 1). Left: "the attack's
hit still lands after a swap" (basic-attack hits after a swap, from the same
data, not yet counted) and whether her ultimate is held (needs a log that
presses it). The engine's rule (swap any time) agrees. Teams: none of the
three; the swap rule matters for any swapping rotation.

### 16. Does a skill cancel the basic attack it interrupts: LOGS, provisional answer: no, for Si (changed from PARTLY)
Si's Final Strike (`attack5`) lands after her own battle-skill cast event in
24 of 370 casts, 15 of them 100–700 ms after it (gaps 106, 126, 204, 229, 229,
230, 351, 388, 393, 425, 426, 516, 539, 629, 694 ms; 9 more at the same ms);
e.g. 458b: cast at 33007, `attack5` at 33133 (5653). The cast event of a
battle skill is at the placed start within a frame or two (data.md "What the
log records"), so a Final Strike that has been started is not cancelled by
the press. Open: this counts only Final Strikes that landed; how many presses
cut an attack 5 off cannot be told from hits alone, and the log has no press
times. Ardelia's Dolly variant: GAME ONLY in practice (only 1 of her battle
skills is a logged cast, 064b). Teams: Si (owner, Ink Melt); the rule holds
for every operator's rotation.

### 17. Laevatain's jumps skip time: LOGS (as before; hard)
Wulfgard variant decided (triage). Laevatain's own: 22 Twilight windows in 17
logs are visible as the span of `ult_attack1..4` hits (first plain basic
follows in 12). Clean baselines are missing: only 40d9 (15.0 s, 1 combo,
the log ends 1 s later) and 012a (18.7 s, 3 combos) are short, and every
other window has 2–9 teammate combos and one other ultimate (458b 33.7 s and
28.7 s, 9c0b 38.2, c83c 28.2, f879 27.6, 0206 35.7), each adding stops. A
replay of the window with the engine's Twilight timer (`efsim zmdlogs replay`)
against the logged last enhanced hit, per window, is the way; the logs
cannot give the owner's controlled "2 battle skills, nothing else" run.
Teams: Ink Melt.

### 18. What an ultimate's time stop freezes: PARTLY (as before)
Cooldowns run, SP regen runs and Estella's held buff were decided
(2026-11-16). Open parts are Laevatain's Twilight (see 17 and 21) and the
caster's other timers; SP and cooldowns themselves aren't logged, only
cast gaps. Teams: every team; Twilight: Ink Melt.

### 21. Twilight with combos and cut-short battle skills: LOGS (as before; hard)
Same 22 windows as 17: each window's combos and battle-skill hits are
countable (`normal_skill_during_ult` hits in 13 logs), so the logs are the
experiment, but never one variable at a time (a regression on the 6 closed
windows is meaningless). Decide with the engine replay per window; the
"cancelled battle skill" case needs a window where a combo follows an
enhanced battle skill within a frame or so (look for `normal_skill_during_ult`
followed by a Laevatain combo hit; not yet counted). Teams: Ink Melt.

### 22. Scorching Heart's 20 s: LOGS (as before; the logs conflict)
`buff_chr_0016_laevat_ignore_fire_resist` (value 20) is listed with `since`
in 17 logs, about 60 windows. `since` to last listed hit is 15.0–25.6 s in the
long windows (f879 25.6 and 22.8, 458b 22.8 twice, 23.9; time stops add
1.5–5 s), so some are longer than 20 s, which a restart on a capped gain
would give, but whether `since` is the first application or the latest
refresh is open (data.md). The test is decidable once that is settled
against the empowered casts' times (`normal_skill_abilityentity` hits with
the big extra hit). Teams: Ink Melt.

### 23. Laevatain's P1 SP: GAME ONLY
SP is not in the log. Teams: Ink Melt (small).

### 24. Heat absorption by Final Strike and Finisher: PARTLY (as before)
Final Strikes and her finishers are logged (`power_attack` of Laevatain in 8
logs); Melting Flame and the enemy's Heat Infliction aren't. Only the effect
is visible: empowered casts (the big extra hit) earlier than the engine's
count allows. Teams: Ink Melt.

### 25. Liino's weapon stacks per teammate: LOGS, decided (2026-11-13 check)
Up to 13 layers listed on one hit (23 logs; hits by listed layers 1–13:
983, 995, 1060, 952, 1007, 870, 888, 704, 489, 261, 116, 47, 17), the damage
fits the cap of 4 per recipient (open-problems.md, "Liino's weapon"). Rises
within 4 s of her heals, expiry 20 s. Left for the game: does an overheal
count (HP isn't logged). Teams: Typhoeus.

### 26. What fires Liino's volley: LOGS (as before)
100 six-hit volley clusters (`normal_skill_projhit_hit`) in 21 logs; every
one sits 0–2.9 s after a Liino `normal_skill` cast event (the same event also
logs End Stance and her stance's repeats). Between consecutive clusters the
median is 12.1 s (shortest 1.8 s, partial clusters); the latest
reaction before a volley is 0 to 85 s earlier (median 9.8 s, quarter 4.1 s):
volleys come with no reaction near in about half the cases, which does not fit
"a volley at each reaction". To settle: replay Liino's stance and compare each
volley to the engine's rule (reaction-triggered) and to a 10 s tick from the
cast. Teams: Typhoeus.

### 27. Liino's combo and energy in Cosmovoice: PARTLY (as before)
Part 1 is a log: 5 of her combos fall inside 15.6 s after one of her
ultimates (4360 +12.4 s, 4bfc +15.4, 4d60 +12.1, 9847 +7.0, af7b +12.8), so
her combo opens in Cosmovoice. Her energy (the block) and "basic attack at
once after the combo" are not recorded (energy isn't; her basics after those
combos can be read but the cases are only 5). Teams: Typhoeus.

### 28. What Liino can do in Vocalist Stance: PARTLY (as before)
(a) basic attacks in the stance: her `attack1..5` hits in 7 logs. (e) the
team ATK buff after End Stance: `buff_chr_0035_liino_atkup` is listed in 22
logs, 58 windows, but her `normal_skill` cast event repeats every ~3.3 s in
the stance, so End Stance can't be told from the stance's own repeats;
(b)–(d) are inputs and cooldowns. Teams: Typhoeus.

### 29. Do sub-skills count as battle skills: PARTLY (as before)
Typhoeus's hover end (Umbra of Frigid Eventide): LOGS, provisional answer:
no. `buff_wpn_funnel_0019_intensityup` windows (31 in 15 logs, `since` per
window) all start at a battle-skill cast (within 0.1 s); of 13 ultimates by
Umbra wearers, 10 had no battle-skill press in the next 9 s, and the weapon
buff started in none of them. The Si Yinglung case: only 458b has Si in 3
Type 50 pieces (the listing is one entry for the shared timer), so it is
LOGS IF for more logs. Link used up by a hitless stroke, Liino's Starry Boost
icon: not listed. Teams: Typhoeus (Umbra), Si (owner, Ink Melt, Yinglung).

### 30. Arcane's talent-1 Susceptibility duration: LOGS (as before)
Listed natural/cryst Susceptibility from her (`source` = Arcane): 277 windows
in 34 logs, mixing the ultimate's with the combo's. Tight ends above 10 s
exist (1d91 11.3–11.4 s, 4d60 10.8–11.0, 9c0b 10.9–11.0 and 11.4–11.7, af7b
11.7–11.8, c6d8 11.2–11.6) which fit 10 s plus her 1.6 s stop; the longest
tightly bracketed window is 17.2 s (7910, with stops). Picking only the
windows that start at a logged ultimate (the cast event lags the press by
about 1.9 s, so match on the hit time) would decide it. Teams: owner,
Typhoeus.

### 31. Finishers inside Arcane's array: LOGS, provisional answer: yes (differs: more cases)
75 laser clusters in 35 logs (`ultimate_skill_laser`). With a finisher
(`power_attack`) within 1.5 s before and no Final Strike: 5 (00ae 62.0 s,
4d60 57.6, a7a7 50.4, 2b01 110.8, c516 50.1; the triage had a7a7, c516,
b6aa: b6aa has both near it); finisher and Final Strike together 4 (1d91,
9090, b6aa, 2b01); Final Strike only 36; neither 30 (the second ultimate's
and later lasers). So lasers follow a finisher alone: the engine's Final
Strike-only trigger loses them. Teams: owner, Typhoeus.

### 32. Gloompurge window: PARTLY (as before)
28 second-ultimate casts in 24 logs, 0.2–11.8 s after the previous laser
cluster (9090 7.6, 064b 8.9, 0206 9.1, db87 11.8; the 11.8 spans time stops), so the window
is at least about 10 s; whether an early cast refills her energy isn't
logged. Teams: owner, Typhoeus.

### 33. WILL combo, the touch's element: LOGS IF (as before)
Triage: no log has the differing case (opening element differing from the
enemy's infliction at the touch). It needs a log with Cryo then a Heat
consumption then an Electric infliction before her combo. Teams: owner,
Typhoeus.

### 34. INT combo without the battle skill: LOGS IF (as before)
The six INT logs show `seal2` (second explosion) only together with her
battle-skill hit (1.3–4.1 s after the combo, a7a7 the longest at 4.1 s); no
battle skill comes after Imprisonment's natural end (6.5 s), and no lasers
follow a battle skill. A log with her battle skill 7 s or more after an INT
combo would show it. SP is GAME ONLY. Teams: owner, Typhoeus.

### 35. Combo windows opened by a reaction: LOGS (Wulfgard variant LOGS IF)
Gilberta: of 59 combos in 18 logs, 45 have another operator's reaction in the
7 s before, 3 have only her own (`natural` Corrosion: d572 65.2 s, 632c 71.5,
67d8 106.3), 11 none within 7 s (windows by Arts Burst or older). So her
own reaction opens her combo (3 instances), as the engine has. Arcane after
an instant reaction: triage positive cases; recount not done here. Wulfgard's
variant (his combo after a non-Heat infliction expired, then a forming
reaction) has no log. Teams: Arcane (owner, Typhoeus), Wulfgard (Ink Melt).

### 36. Cooldowns cut by a percentage: PARTLY (as before)
Typhoeus: 24 combo gaps, shortest 19.3 s (7b4e 19.3, 1d91 19.3, fc63 19.7):
nothing under the full cooldown, consistent with the shared cooldown, but the
log can't tell which combo variant each press was. Arcane P5 (WILL): only two
gaps have a second ultimate between (7910: 31.4 s; c83c: 15.6 s, with the
ultimate at +11.5 s, so a press at 15.6 s is under the uncut 18 s, which
would fit a cut but also fits the combo-cooldown set's x0.85 or a miscount of
hidden casts); too few for the four readings. Da Pan: no log with talent 2.
Teams: Typhoeus, Arcane (owner, Typhoeus).

### 37. Enemy timers while Imprisoned or Immobilized: LOGS (as before; M–L)
Arcane's Imprisonment (a combo about every 18 s, in 38 logs): listed
Susceptibility or Electrification windows that span a combo can be compared to
their nominal length. Last Rite's combo: 19 distinct combos in 4 logs (b7b3,
9555, b6aa, c3c7), none with Gilberta, so her 2 s freeze can be read on Arcane's
Susceptibility and Xaihi's windows (b7b3, b6aa); the debuff must not be an
Arts Infliction. Tangtang (2 logs: b7b3, 7910), an observation: her Arts
Susceptibility is bracketed at 9.8 s and 10.2 s (7910, ends within 0.1 s)
where the test assumes 15 s; the window that holds her ultimate is 18.3 s,
about 10 + 2.7 s stop + 4 s Immobilization + 1.6 s, which fits both holding
the clock. Si's part: not testable (triage). Teams: Arcane (owner,
Typhoeus); Si (owner, Ink Melt).

### 38. Two Susceptibility sources: LOGS (Gilberta + Ardelia LOGS IF)
Pairs of the same element from two sources on one hit: Physical Mi Fu +
Estella (a27b, 63 hits: 48 plain, 8 assumed, 7 mismatch), Lifeng + Mi Fu
(de6a), Arcane + Tangtang (b7b3, 7910), Arcane + Ardelia (7 logs, about 800
hits), Arcane + Last Rite (9555, b6aa), Ardelia + Camille (f879), Gilberta +
Avywenna Electric (4360, 9847: 24 plain, 82 mismatch, unexplained). The
engine adds the two and matches plain in most; "only the larger" would be off
by the smaller (Estella's 0.15 or Mi Fu's 0.10), which the plain matches
rule out for the Physical pair. No log has Gilberta with Ardelia. Teams:
Estella's Physical (owner), Ardelia (Ink Melt).

### 39. Swordmancer's extra hit: LOGS (as before)
`buff_equipsuit_physuit_01` hits: 92 in 17 logs. Checked ones (55): 14 plain,
12 fallback, 6 assumed, 23 mismatch, so the 2.5 x ATK scale or what triggers
it is likely off (4360 5 of 5 plain; the mismatches are spread
over several logs). The Vulnerable-only variants (Chen's Sundering Steel, Lifeng's
talent 2: 13 hits, 7 mismatch in d4fb): partial. Teams: none (wearers on
other teams).

### 40. Messenger's Song: GAME ONLY (as before)
Ultimate Gain Efficiency isn't in the log; the effect on cast times can't be
separated from SP and combos. Teams: none (Gilberta).

## Decide next: the LOGS tests most worth finishing

By impact on the teams in work, then by how little work is left.

1. **31 Finishers in Arcane's array** (owner, Typhoeus): five finisher-only
   laser clusters; the engine misses them. Count the lasers per cluster,
   then change the trigger.
2. **14 Si's battle-skill element** (owner, Ink Melt): already decided by
   the Arts Bursts; close it and confirm the kit's slot-1 rule.
3. **16 and 15 Skill cancel and swapping** (every rotation; Si first): Final
   Strikes landing after the press (15 of 370) and swaps inside Gilberta's
   lock (16 of 19). Count the press-to-hit gaps against the kit's hit
   frame, then the engine's cancel rule.
4. **22, 21, 17 Laevatain** (Ink Melt): Twilight's timer and Scorching
   Heart's 20 s through `since`; one engine replay per Twilight window,
   settle what `since` means first.
5. **9 and 6 Typhoeus's x1.3 and Liino's ultimate** (Typhoeus): cheap
   close-outs; the other 14 logs for 9, the three mismatching Liino logs
   (7910, 8915, 9847) for 6.
6. **7 Arcane INT** (owner, Typhoeus): 8915's opposite-direction miss and
   the Amp lane in 00ae and a7a7.
7. **30 and 26** (Arcane's Susceptibility length; Liino's volley rule): both
   a script away.
8. **4 Corrosion ramp** (Arcane's Corrosion, Liino): large, touches every
   Arcane fight; after 7 and 37.
9. **38, 35, 37, 25 (closed), 39**: lower impact on the three teams.
