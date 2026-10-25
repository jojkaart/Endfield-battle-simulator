# In-game tests

Tests the owner could run while playing, to settle questions only the game
can answer. Each should be simple and take a few minutes. Claude keeps this
list current and mentions new **ready** tests to the owner; results go in
the "Results" section with the date and game version, then into fixtures or
[data-sources.md](data-sources.md).

Status: **ready** (worth doing now), **later** (waits on the engine or on
choosing a setup), **done**, **not testable by hand** (kept so the question
and the engine's interim stay recorded; don't ask the owner for it).

**What a test may ask for** (the owner's feedback, 2026-10-19). Every test
must be something a person can do by hand while playing:

- **Observable by eye only:** whether something happens (a damage number
  appears, an infliction or status icon shows, a skill becomes castable, a
  bar visibly jumps), the damage numbers shown on screen, buff and stack
  counters the game displays, and time differences of a couple of seconds
  or more, measured with a stopwatch or by counting seconds in an ordinary
  phone video. Never frame counts or sub-second timings, never exact SP
  (the game shows only an SP bar, no number), never exact energy or other
  values the game doesn't display.
- **Prefer a relative comparison:** do A, then do B, and compare, so a
  baseline cancels reaction time and other errors.
- **Predict each outcome in observable terms** under each hypothesis
  (e.g. "Twilight lasts about 17.6 s vs 22.7 s"), worked out with the
  engine where it can.
- **If it can't be made observable,** say so, keep the engine's interim,
  note how small the impact is, and mark the test **not testable by hand**
  instead of asking for it.
- **Honest priorities:** say what a test needs. The owner doesn't use
  Catcher, Ember, Snowshine or Purrchena, so tests that need them are low
  priority; tests that affect every operator come first.

## Tests

### 1. Stat panels (ready; lower priority now)

Laevatain's panel already matches Zero Sanity's in-game screenshot exactly,
and attribute rounding is settled. Still useful for other operators and for
gear with flat ATK (formula slot 7, not yet checked in game).

**Why:** the first fixture checks stat aggregation (base stats + weapon +
gear → ATK, attributes, crit, etc.) against patch 1.6 data. The Zero Sanity
values we have are from March. It also tests whether attributes are rounded
down before the ATK bonus: with real gear, attributes have hidden decimals,
and the shown ATK differs depending on the rule.

**How:** for 2–3 operators you have built, screenshots of:
- the operator's detail screen with the full stat list (level, promotion,
  potential, all attributes, ATK, crit rate, crit DMG, Arts Intensity…);
- the skill levels;
- the weapon (level, refinement / potential, its skills);
- each gear piece (level, main stat, substats, artificing level) and the set
  bonus.

Laevatain is the most useful if you have her (same operator as the Zero
Sanity fixture), but any built operator helps. Builds with different gear
are more useful than the same build twice.

### 2. Final damage rounding (done, no test needed)

Settled from Zero Sanity's in-game values: damage rounds to the nearest
whole number (1572.75 → 1573, 1952.38 → 1952). See
[data-sources.md](data-sources.md#open-questions).

### 3. Breach and Arts Intensity (later: needs a simple setup chosen)

**Why:** game data says Breach's damage-taken bonus scales with the
applier's Arts Intensity (Breach IV at 150 AI → +40%, not +24%); untested.
**How (planned):** apply Breach from an operator with known AI, then
compare another operator's hit with and without Breach.

### 4. Corrosion ramp (later)

**Why:** how the resistance reduction grows over time.
**How (planned):** read the same hit's damage at 0, 5 and 15 s into
Corrosion.
**Evidence so far:** Liino's battle-skill follow-up (a fixed 0.2 × ATK)
needs 5.9 resistance points of shred 0.6 s into Corrosion
(`zmdlogs-0eef2474a26f`) but only 4.5 points 6.5 s in
(`zmdlogs-bdf223db8e49`), where the current model gives at least 11.9; and
her 20 ultimate projectiles in `zmdlogs-d9e59d0fb737` all deal 1160 across
a whole-second tick. Either the ramp is wrong or something (a Nature
burst?) resets it. Si's logs (`zmdlogs-0eef2474a26f`) fit whole-second
ticks that pause while time is dilated (three combos at 3.5 s held the
count at 2 until 4.3 s), which would explain part of it. Arcane's talent
also raises the cap and duration of every Corrosion she applies.

### 5. Reaction bonus grouping (later)

**Why:** whether "Arts Reaction DMG" bonuses add to element bonuses or
multiply separately.
**How (planned):** a Combustion hit with one bonus, the other, and both.

### 6. Liino's ultimate (ready)

**Why:** the only log of it (ZMDLogs parser v58) implies each of the 20
small projectiles deals 2 × the ultimate's `atk_scale`, which the data
doesn't explain, and it doesn't record her own ultimate buffs.
**How:** Liino alone against a training dummy (no teammates' buffs, no
Arts reactions): her stat panel (ATK, Will), ultimate level, and the
damage numbers of one ultimate, ideally recorded with the ZMDLogs client.

### 7. Arcane's INT damage under her own Corrosion (ready, if you have Arcane)

**Why:** in the only INT log (btl_upload_d9e59d0fb737, possibly still game
1.5) all damage after her ultimate is about twice the model; WILL logs from
1.6 match exactly. This tells whether 1.6 INT Arcane really does that.
**How:** with Arcane at Intellect ≥ Will, on a training dummy: basic attack
1 a few times, then her ultimate, then basic attack 1 again within a few
seconds. Screenshots of the damage numbers before and after, plus her stat
panel (ATK, Intellect, Will, Arts Intensity) and skill levels.
Also watch her Arts Amp buff icon after the ultimate: does it stay for the
array's 20 s (as the engine now assumes) or end with the animation? The
same log suggests it ends with the animation; if it really lasts 20 s, it
explains about ×1.24 of the ×1.9.

### 8. Where Link comes from, and its values (ready; higher priority: affects every team)

**Why:** Link boosts the next battle skill or ultimate (+20% for one
stack on an ultimate, from a log). Until 2026-10-20 the engine gave Link
after every combo; the game data gives it only from a few sources
(Lifeng's combo, Camille's combo and Hunter Pursuit, Akekuri's talent), and five logs agree: ordinary combos left no Link on
the next skill. The engine now follows the data. This test confirms it.
**How:** on a training dummy, Gilberta's ultimate (a single hit), lower
of two damage numbers each time (crits):
- (a) with no combo in the last 20 s;
- (b) right after Estella's combo (anyone but Camille or Lifeng);
- (c) right after Camille's combo on a dummy with hovering Vesperwings
  (her battle skill first, talent 1 learned);
- (d) right after Camille's combo without them;
- optionally (e) right after Lifeng's combo, and (f) after two Link
  combos (Camille and Lifeng) for the two-stack value.
Data and logs (engine now): a = b = d, c = e ≈ 1.20 × a. The old rule
(every combo gives Link) would give b = d ≈ 1.20 × a and c ≈ 1.30 × a.

### 9. Typhoeus's burst with and without a Nature infliction (ready, if you have Typhoeus)

**Why:** her enhanced floating shot's own Nature burst appears to deal
×1.3 more when the target already has a Nature infliction for the arrow to
consume (`enchence_burst_damage_rate`), seen in one log only.
**How:** on a training dummy: one enhanced floating shot on a clean dummy,
then one right after a teammate applied a Nature infliction (Gilberta's
battle skill or ultimate). Screenshots of the burst's damage number both
times (no crits).

### 10. Si's combo by stacks consumed (ready, if you have Si)

**Why:** her combo's final hit is `atk_scale2 + n × atk_scale2_1`,
n = the infliction stacks consumed by the trigger, +1 at P5 (the data and
one log agree on the +1). When several consumptions open the window, the
engine takes the highest count, as her description says ("highest
stacks"); the latest count is the other reading. The final hit is 62–74%
of the combo's damage.
**How:** trigger her combo after consuming 1, then 2, then 3 stacks of Cryo
or Heat Infliction (e.g. a reaction onto 1–3 stacks); screenshot the final
hit each time (no crits). Without P5, 1 stack should give 3.5 + 1.0 (× ATK)
at combo level 12. Then, with the combo off cooldown, consume 3 stacks,
then 1 stack within 6 s, and cast the combo: a final hit for 3 stacks
(4 at P5) means the highest count wins (engine); one for 1 stack (2 at P5)
means the latest.

### 11. Estella's combo on a target that isn't Solidified (ready, if you have Estella)

**Why:** on a Solidified target it uses the larger `atk_scale2` and applies
Physical Susceptibility; otherwise the smaller `atk_scale`, without
Susceptibility. The kit now models both (the data's IfElse per target); no
log has the second one yet. Expected at combo level 12, with no other
Susceptibility on the enemy: the late combo's number is about 0.50 of the
early one's (3.6 against 6.3 × 1.15).
**How:** with her combo window open, wait until Solidification ends (about
6 s after a level I Solidification), then cast the combo; compare its
damage with a cast right after Solidification, and check for the Physical
Susceptibility icon. On the non-Solidified target the combo should still
show a Lift damage number and add a Vulnerable stack (it forces Lift), but
no Shatter.

### 12. Gilberta's Arts Susceptibility value and duration (ready, if you have Gilberta)

**Why:** the data says her ultimate's Arts Susceptibility is `rate` × 1.2
from potential 2 (0.36 at ultimate level 10–12) and the plain rate below
(0.30), for 5 s; one log showed 0.36 at P3, another 0.30 at P1. It also
grows with the enemy's Vulnerable stacks when the ultimate lands (the
engine follows the data's formula, untested). It boosts the whole team's
Arts damage, so a wrong step is 3–6 points of Susceptibility on every
Arts hit for 5 s.
**How:** her ultimate on a training dummy with no physical teammates; read
the Arts Susceptibility value on the enemy, if the game shows it, and time
how long the icon stays (5 s expected). If the value isn't shown, compare a
teammate's Arts hit (same skill, no crits) just before her ultimate and
during the Susceptibility: the second number divided by the first is about
1 + the value (e.g. 1.30 or 1.36).
Then repeat with 1, 2, 3 and 4 Vulnerable stacks on the dummy (from Lift or
Knock Down; her own combo's Lift gives one), comparing the before and
during hits with the same Vulnerable stacks each time. Expected at ultimate
level 12 below P2: 0.30, 0.33, 0.36, 0.39, 0.42 for 0–4 stacks (hits ×1.30
… ×1.42). From P2: 0.36, 0.42, 0.48, 0.54, 0.54. A 0.48 at 3 stacks from
P2 would mean the data's check is "fewer than 3", not "3 or fewer".

### 13. Arcane's combo cooldown in WILL mode (ready, if you have Arcane)

**Why:** a talent shortens her combo cooldown by 6 s only in INT mode
(data: `activeCondition lizhiyan_wisd`); the engine now follows the data
(the cut only with Intellect ≥ Will), and this confirms it.
**How:** with Will > Intellect, cast her combo and time the cooldown:
18 s expected (12 s would mean the cut applies in WILL mode too).

### 14. Si's battle skill element with a Heat operator in slot 1 (optional confirmation)

**Why:** her description says the battle skill applies Heat instead of Cryo
Infliction when a Heat operator is in Team Position 01. The data settles it
(an enabled SpellInfliction branch on team slot index 0, i.e. the first
slot); this would only confirm it.
**How:** put a Heat operator in the first team slot, cast Si's battle skill
and look at the infliction icon on the enemy; repeat with a Cryo or Nature
operator first.

### 15. Swapping and casting during a battle skill (ready, if you have Gilberta)

**Why:** the data forbids switching for the first 3.7 s of Gilberta's
battle skill (`cantSwitchPosition`); the engine now lets you swap at any
other moment, even mid-skill, and the skill goes on. Whether the game
agrees decides how fast swap-heavy rotations are.
**How:** cast Gilberta's battle skill and press another operator's swap
key at once, holding it: note roughly when the swap happens (about 3.7 s
expected). Then try swapping during one of her basic attacks: it should
swap at once, and the attack's hit should still land.
*Higher priority since 2026-10-25:* team searches lean on that last part.
The 4-operator example's found rotation swaps between two operators'
basic-attack steps, so both chains run at once (Laevatain's enhanced
attacks and Si's chain, 7.4 s into examples/si-laevatain-liino-gilberta).
Also check, with any two operators: start a basic attack, swap at once,
and attack with the other: do both attacks' hits land, and does the
swapped-out one's chain go on if you swap back within its window?
The same 3.7 s of the data also forbid her casting another skill
(`cantCastSkill`); the engine now holds all of her casts until it ends,
ultimates included (the data doesn't say whether they're an exception).
So also: with her energy full (or her combo just lit by a reaction), press
her ultimate (or combo) right after the battle skill. Does it start at
once, or only after about 3.7 s? Does a teammate's combo still fire
meanwhile? Liino's stance has the same question (test 28).

### 16. Does a skill cancel the basic attack it interrupts? (ready; optional variant with Ardelia)

**Why:** the engine assumes a battle skill, combo or ultimate can start at
any moment of a basic attack and cancels the attack's hits that haven't
landed (except projectiles). If the hit lands anyway, the engine
under-counts damage and SP for players who cancel early.
**How:** with any operator whose 5th basic attack (Final Strike) is a
melee hit, start the 5th attack and press the battle skill immediately:
does the Final Strike's damage number appear? (Its SP isn't visible on the
bar; the damage number answers both.)

With Ardelia (optional; batch 4, her kit): her attack 4 sends out Mr.
Dolly, whose Final Strike lands about 0.8 s in. In the data the Dolly is
removed when attack 4 ends early, so the engine drops that hit, its SP and
her combo window if a skill cuts attack 4 before it lands. Basic chain to
attack 4, then press her battle skill as soon as attack 4 starts. Does the
Dolly's Final Strike number still appear, and does her combo light (a
Final Strike on a clean dummy opens it)? Engine: neither. Both: the
Dolly's hit is on its way once it's sent.

### 17. Do the jumps in Laevatain's battle skill skip time? (ready, if you have Laevatain or Wulfgard)

**Why:** her battle skill's data has jumps: the timeline skips ahead, on
one path when she has 4 Melting Flame (empowered) and on another when
not. Since batch 2 (S1) the engine takes jumps as skipping time, because
Catcher's battle-skill data only makes sense that way. In Twilight her
enhanced battle skill pauses Twilight's timer (it "does not shorten the
duration of the ultimate") for as long as the skill holds her: with skips
about 1.3 s plain and 2.1 s empowered; without, about 3.8 s either way.
That's 1.7–2.5 s of rotation time per battle skill, and every buff window
after it moves (laevatain-solo: 22.4 s with skips, 29.2 s without).
**How:** compare Twilight's total length, timed from pressing the ultimate
to Twilight's end (its icon disappears, or her attacks turn back to normal
ones), with a stopwatch or a phone video. SP bar at least two-thirds full
(each battle skill costs a third), no combo and no teammates' skills during
Twilight (a combo adds about 1.9 s, test 21).
1. Baseline: ultimate, then only basic attacks until Twilight ends.
   Expected: about 15.0 s in both models.
2. Ultimate, basic attacks, one battle skill about 4 s in, basic attacks
   again, a second battle skill about 10 s in, then basic attacks to the
   end. Space the battle skills: keep pressing basic attack for a few
   seconds between them. (Pressing the battle skill twice in a row cuts
   the first one's pause short in both models, so it would hide the
   difference.) Note whether each cast was plain or empowered (the big
   extra hit with forced Combustion; the second may reach 4 Melting Flame
   from the first one and the Final Strikes).
   Expected: two plain casts **about 17.6 s** with skips, **about 22.7 s**
   without; one plain and one empowered about 18.4 s with skips, 22.7 s
   without. (One plain cast only: 16.3 s vs 18.8 s.) If the baseline
   isn't 15 s (test 18), compare the differences instead: about +2.6 s
   (skips) vs +7.7 s (no skips) for two plain casts.

A supporting sign in the same run: after each plain battle skill, while
you keep pressing basic attack, she attacks again about 1.3 s after the
cast with skips, but stands about 3.8 s without.

Outside Twilight (optional): a plain battle skill on a dummy, then keep
pressing basic attack. From the explosion's damage number to the next
basic attack's number: under 1 s (about 0.7 s) with skips, about 3.4 s
without. With 4 Melting Flame, from the explosion's number to the big
extra hit: about 1.1 s vs 2.7 s (closer to the limit of what a video shows;
the Twilight run above is the clearer test).

With Wulfgard instead (optional; batch 3, Wulfgard W2: the same question
on a 5-star everyone has): on a Combusted dummy (right after his ultimate,
while it burns), cast his battle skill and time from the cast to the big
additional shot's damage number. With skips **about 1.8 s** (plus the
shot's flight), without **about 4.7 s**. A second sign: with skips he
attacks again about 2.4 s after the cast (test 61's Combusted run),
without about 5.3 s.

### 18. What an ultimate's time stop freezes (ready)

**Why:** the engine now freezes everyone but the caster for an ultimate's
time stop (Laevatain's first 2 s, Gilberta's 1.7 s): the enemy's statuses
and Combustion ticks, all buffs, combo windows and SP regen, but **not**
skill cooldowns (Endaxis's rule, from its unit tests only).
**How:** time a teammate's combo cooldown with a stopwatch, from the combo
cast until its button is ready again: once with nothing else happening,
once with an ultimate with a long time stop cast during it (Laevatain's
2 s or Gilberta's 1.7 s; two operators' ultimates in the same cooldown
make the difference clearer). The same length means cooldowns run during
the time stop (engine); about 2 s (or 3.7 s with both) longer means they're
frozen. Also, in a video: is the SP bar (not full) visibly higher at the
animation's end than at its start (regen runs: about a twentieth of the
bar over 2 s), or unchanged (frozen, engine)?

The caster's own buffs are a second question. The engine freezes them too
(only the caster's hits and action are exempt), but the data exempts the
caster from its own time stops and slow-downs, and one Estella log fits
neither rule cleanly. (Laevatain's Twilight is created after her
ultimate's time stop is taken into account, so the engine runs it 15 s
from the press.) It decides up to 2 s of Twilight per ultimate and up to
1.8 s of Estella's team-wide Physical Susceptibility (+15%) per ultimate:
- Laevatain: time Twilight from pressing the ultimate to its end, with
  only basic attacks (test 17's baseline): about 15 s means her own time
  stop doesn't freeze Twilight (her kit), about 17 s means it does. Her
  combo's 0.6 s slow-down is too short to see on its own; test 21 covers
  the combo.
- Estella (P1+): combo on a Solidified enemy, her ultimate right after,
  and time the Physical Susceptibility icon from the combo hit: about 9 s
  means her own time stop doesn't freeze it, about 10.8 s means it does
  (1.8 s apart: a video is safer than a stopwatch).

### 19. What Haste speeds up (ready, if you have Si)

**Why:** Si's talent gives the team Haste (`ratio_speed` 15% / 30%) for
5 s after her Inksoul ends. The data says only "speed +x" (attribute 92);
the engine assumes it plays skills faster (hits, cancel windows, the
locked part) but not cooldowns. Nobody's simulator models it yet.
**How:** a phone video. While the Haste icon is up (5 s), keep pressing a
teammate's basic attack, and count its damage numbers; then count them in
5 s of the same chain without Haste. About 15% / 30% more numbers (e.g. 13
instead of 10 at 30%) means Haste speeds up skills; the same count means it
doesn't. (Timing one chain wouldn't work: 15% of a chain is under a
second.) Cooldowns: at 30% only, start a teammate's combo cooldown just as
the Haste begins and time it with a stopwatch against one without Haste:
about 1.5 s shorter if Haste speeds up cooldowns too (the engine says no);
at 15% the difference (0.75 s) is too small to see.

### 20. Laevatain's battle-skill multipliers (ready, if you have Laevatain at P1+)

**Why:** the empowered battle skill's extra hit is her largest hit. The
data multiplies it by `ratio` (1.2 from P1); Zero Sanity's in-game number
fits `extra_scaling` instead (1.5 from P3), and the kit follows Zero
Sanity. At P5 that's 46,040 against 57,552 in Zero Sanity's build: 25%
of the hit. The reverse question is on the enhanced battle skill's first
two hits in Twilight: the kit multiplies them by `ratio` (×1.2), the data
doesn't.
**How:** on a training dummy, no crits. With 4 Melting Flame, cast the
battle skill and compare the extra hit with the same cast's explosion. At
skill level 12 the extra hit should be 5.5× the explosion at P0; 6.6×
(×1.2) means the data is right; 8.25× (×1.5) at P3+ means Zero Sanity is.
Then, in Twilight with the Scorching Heart icon off, compare the enhanced
battle skill's first hit with a plain battle skill's explosion from just
before the ultimate: about 2.8× means `ratio` applies (kit), about 2.4×
means it doesn't (data).

### 21. Twilight's length with combos and cut-short battle skills (ready, if you have Laevatain)

**Why:** Twilight is her highest-damage state. The engine holds its timer
for 1.9 s per combo cast (it reads the data's re-created buff as "add
time"), and for an enhanced battle skill's pause only until the skill
ends (her kit since 2026-10-18): a combo that cuts the skill short ends the
pause too, as the data says (otherwise up to about 3 s too much Twilight
each time).
**How:** time Twilight from her ultimate to its end (the icon, or when
enhanced attacks stop): once with no battle skills or combos (15 s
expected); once with one combo in it (about 16.9 s if the engine is
right); once with an enhanced battle skill cancelled by her combo at once.
If the last one is as long as the combo alone, the pause ends with the
skill (data, and the engine); if it's about 3 s longer, it doesn't.

### 22. Scorching Heart's 20 s (ready, if you have Laevatain)

**Why:** on reaching 4 Melting Flame her damage ignores 20 Heat RES (talent
level 2) for 20 s. The engine starts the window only when she reaches 4,
and again when she reaches 4 anew after spending them; a gain while
already at 4 (her empowered cast's own explosion) doesn't restart it.
That fits Zero Sanity's in-game extra hit (57,552, no RES ignore), but
the data only says "on a stack change": up to 20 s more of the RES ignore
per empowered cast if a capped gain counts.
**How:** reach 4 Melting Flame, wait 15 s, then cast the empowered battle
skill. Watch the Scorching Heart icon: does its 20 s start again, or does
it end about 5 s later as before? (Or: reach 4, wait 25 s, cast the
empowered battle skill: does the icon come back?)

### 23. Laevatain's P1 SP (optional confirmation, if you have Laevatain at P1+)

**Why:** the data gives P1's +20 SP only on the empowered extra hit, so a
plain battle skill gives none. The engine follows the data.
**How:** the game shows no SP number, so look for a jump instead, in a
phone video with the SP bar not full. After a battle skill the bar drops a
third and SP regen pauses (about 1.5 s, unverified), then fills smoothly.
With 4 Melting Flame: does the bar jump up by about a fifteenth (20 of
300) at the moment the big extra hit lands? Then a plain battle skill: no
jump expected anywhere. If the jump is too small to see, leave this one:
the data settles it.

### 24. Heat absorption by Final Strike and Finisher (optional confirmation, if you have Laevatain)

**Why:** her talent absorbs Heat Infliction from the enemy for Melting
Flame when a Final Strike or a Finisher hits. The data agrees, and her
new kit does both (a finisher's two landings 37 frames apart can both
absorb, past the 1 s cooldown); worth up to 4 Melting Flame per stagger
(one empowered battle skill). The engine takes only what's missing to
reach 4.
**How:** (1) with 3 Melting Flame and 3 Heat stacks on the dummy, land one
Final Strike: 4 Melting Flame and 2 Heat stacks should be left. (2) On a
Staggered enemy with Heat Infliction on it, use any operator's finisher:
does Laevatain's Melting Flame go up?

### 25. Liino's weapon stacks on each teammate (ready, if you have Liino with Bedazzling Night Debut)

**Why:** when her skills heal a teammate, that teammate gets ATK +9.8%
(weapon level 9) for 20 s, up to 4 stacks. The engine gives each teammate
its own 4 (up to +39% each), one per heal of hers that reaches them (her
3 s soundwave in Vocalist Stance, her combo's heal of the controlled
operator, her ultimate's heals), overheals included. One log already shows
9 stacks on three teammates at once, so "4 each" is likely; what's left is
how they build up. This is her loadout's largest damage effect.
**How:** Liino and three teammates at full HP. Cast her battle skill and
watch for 15 s: does each teammate's ATK icon count up on its own, to 4
each? Does it count up while they're at full HP (does an overheal count)?
How often does it rise: every 3 s soundwave, or only when the teammate is
near her?

### 26. What fires Liino's volley (ready, if you have Liino)

**Why:** in Vocalist Stance, an Arts Reaction near her fires a volley (six
small Electric hits, 1.2 × ATK in all, 1.44 at P5), at most once per 10 s.
The engine fires it at the reaction, then waits 10 s. The other reading:
a 10 s tick from the cast that fires only if a reaction happened shortly
before. The two give different numbers of volleys, and at different times.
**How:** Liino plus two teammates who apply different Arts Inflictions.
Cast her battle skill, then let nobody attack for 12 s: do any volleys
appear? (If yes, it's a plain 10 s timer.) Next, trigger one Arts
Reaction: does a volley follow within about a second (engine), or only at
the next 10 s mark after the cast (tick)? Trigger a second reaction 3 s
later: no volley is expected.

### 27. Liino's combo and energy during Cosmovoice (ready, if you have Liino)

**Why:** the engine (and the data, likely) lets her combo open during
Cosmovoice, her ultimate's stance, though the description names only
Vocalist Stance. The engine blocks her energy for all 15 s of Cosmovoice,
the likely reading of the data, though the block buff's own duration says
1 s. That decides
whether her 20-energy combo during Cosmovoice counts toward her next
ultimate.
**How:** cast her ultimate without Vocalist Stance active, then let
teammates cause a reaction: does her combo become available? Cast it a
few seconds into Cosmovoice: does her ultimate gauge rise at once (block
of about 1 s), or only after Cosmovoice ends (about 15 s)? Also, right
after that combo, can she basic attack or swap at once? The data runs the
combo beside the ultimate's action, so the engine says no: she stays in
the ultimate until it ends.

### 28. What Liino can do in Vocalist Stance (ready, if you have Liino; lower priority)

**Why:** the data blocks her skills for the first 3 s after her battle
skill (and 2 s at Cosmovoice's start); the engine follows that block (as
with Gilberta, test 15) and holds her ultimate too. In the stance's action
(and after a combo in it) the engine lets her cast only End Stance, her
combo and her ultimate until the stance ends. After End Stance from
Vocalist it puts her battle skill on a 3 s cooldown. Small for damage;
it's about which rotations are legal.
**How:** with Liino controlled in Vocalist Stance: (a) does a basic attack
come out? (b) In the first 3 s after the battle skill, can you cast End
Stance or her combo, or does it wait until about 3 s? (c) Right after her
combo, can she basic attack? (d) After End Stance from Vocalist, how long
until her battle skill can be cast again? The data says 3 s (the first
report said 5).

### 29. Do sub-skills count as a battle skill? (ready, if you have Si, Liino or Mi Fu)

**Why:** Si's Initial and Final Stroke and Liino's End Stance are
battle-type skills in the data, but not the main battle skill. The engine
counts them as battle-skill casts for everything: Type 50 Yinglung's
stacks (up to 2 too many per Si cycle, +20% combo DMG each), Link (used
up by a hitless stroke, losing ×1.2–1.5 on the real battle skill or
ultimate; see test 8), and Liino's talent-2 SP.
**How:**
- Si wearing 3 Type 50 Yinglung pieces: cast her battle skill, Initial
  Stroke, Final Stroke, then read the Yinglung's Edge stacks: 1 means the
  strokes don't count, 3 means they do.
- After Camille's or Lifeng's combo (Link up; see test 8), cast Si's
  Initial Stroke: is Link used up?
- Liino: with Link up, cast End Stance, then her battle skill: does the
  battle skill still get the Link bonus? And after her combo (talent 2
  active), cast End Stance: is Starry Boost used up (its icon gone)? Its
  SP (5 in the data) is too small to see on the SP bar, so the icon is
  the sign. And in Vocalist Stance, cast
  her combo: when the stance's action resumes after it (the game casts it
  by itself), is Starry Boost used up?
- Typhoeus with Umbra of Frigid Eventide (if you have it): cast only her ultimate and
  let the hover end by itself (no input): does the weapon's Arts
  Intensity buff appear again as the hover ends? Her hover's idle and end
  steps are battle-type sub-skills too.
- Mi Fu (optional; batch 4, her row 37): Trail and Mangle is a
  battle-type sub-skill too. After Camille's or Lifeng's combo (Link up),
  cast Trail and Mangle from the state her combo or ultimate leaves (not
  right after Cloudtrapper, which would use the Link itself): is Link used
  up? Engine: yes.

### 30. Arcane's talent-1 Susceptibility duration (ready, if you have Arcane)

**Why (optional confirmation):** in WILL mode her ultimates give the
enemy Nature and Cryo Susceptibility (up to 12.8%, +7% at P5). A closer
read of the data says 10 s: the ultimates take the talent buff's
`duration` into their own `duration_vul`. One log has it still on 10.9 s
after the hit, which fits 10 s plus the time stop.
**How:** Will > Intellect, her ultimate on a dummy: time the Nature
Susceptibility icon from the ultimate's hit. About 10 s or 20 s, plus the
ultimate's 1.6 s time stop if it's frozen.

### 31. Finishers inside Arcane's array (ready, if you have Arcane)

**Why:** in the data, Cluster Strike (four lasers and half her energy)
comes from a Final Strike by the controlled operator or from a finisher.
The engine has only the Final Strike half, so rotations that stagger and
finish inside the array lose lasers and the route to her second ultimate
(14.4 × ATK in INT).
**How:** inside her array, stagger the enemy and finish it with the
controlled operator: do the four lasers come?
**Not testable by hand:** whether a finisher and a Final Strike within
0.4 s count once or twice (the inputs can't be timed that closely; at most
four lasers once per stagger), and whether her own finisher gives 8 SP
beyond the enemy's finisher SP (a data default no action reads; her kit
now gives none). 8 SP is a fortieth of the bar, about 1 s of regen per
stagger, too small to see.

### 32. Gloompurge Arcana window (ready, if you have Arcane)

**Why:** after her second Cluster Strike, her second ultimate is castable
in a 10 s window. The engine keeps it 10 s. Whether casting it early ends
the window (and so frees her energy to refill) is unknown; it moves her
next ultimate.
**How:** after the second Cluster Strike, how long does the second
ultimate's button stay (10 s expected)? Then cast it early: does her energy
bar start refilling right after, or only when the 10 s are over?

### 33. Arcane's WILL combo: the Cryo burst and its element (ready, if you have Arcane)

**Why:** in WILL mode her combo's touch adds a stack of the same element.
The logs credit Cryo bursts to her about 1–1.5 s after the touch, never
at it, so either the stack lands later or the log credits the burst to
the stack's owner. Also, the engine takes the element from the enemy's
current infliction, but the data probably takes it from the infliction
that opened the combo window: when the enemy's infliction changes before
the combo, that's one burst (1.6 × her ATK) more or less.
**How:** Will > Intellect. (1) A teammate applies Cryo; Arcane's combo at
once, and then nobody attacks for a few seconds: does a Cryo burst number
appear at the touch? Then the same, but with a teammate's hit 2–3 s after
the touch: does the burst number appear only with that hit (the log
credits it to the hit), or at the touch? (2) A teammate applies Cryo (opening
the window), then a Heat hit consumes it (Solidification), then Arcane's
combo: does the touch apply Cryo (the trigger's element), nothing, or
Heat?

### 34. Arcane's INT combo without the battle skill (ready, if you have Arcane; lower priority)

**Why:** when her INT Imprisonment ends on its own (one explosion), the
next battle skill on that enemy gives SP and a second explosion. The data
suggests no lasers then (the clone that fires them is gone); the engine
gives none.
**How:** Intellect ≥ Will. Combo, let Imprisonment end (one explosion),
then her battle skill on the same enemy within a few seconds: does a
second explosion appear, and lasers? Does the SP bar jump up by about a
tenth (30 SP) at its hit, after the third the battle skill spent?

### 35. Combo windows opened by a reaction (ready, if you have Gilberta, Arcane or Wulfgard)

**Why:** two open questions about the same moment. Gilberta's combo opens
on any Arts Reaction; the engine also opens it when her own battle skill
causes the reaction. Arcane's combo opens on an infliction; the engine
counts an infliction that turns into a reaction at once (since 2026-10-22, the owner's reading). Each is
one combo more or less per such reaction.
**How:** a Heat teammate applies Heat Infliction to a dummy; then a Nature
hit forms Corrosion (Gilberta's battle skill explosion if you have her,
otherwise any Nature skill). Is Gilberta's combo button lit? Is Arcane's
(both INT and WILL modes, if you can)?

With Wulfgard (optional; batch 3, Wulfgard W4): his combo opens when an
Arts Infliction is applied; the engine counts one that forms a
reaction at once (as for Arcane). A teammate applies a non-Heat infliction
(his combo lights); wait about 7 s until the button goes dark again (the
window is 6 s; the infliction lasts 20 s); then a second teammate applies
a different element, forming a reaction. Does Wulfgard's combo light up?
Engine: no.

### 36. Cooldowns cut by a percentage (ready, if you have Typhoeus, Da Pan, or Arcane at P5)

**Why:** one data action sets a cooldown by a fraction, and its meaning is
unclear. Arcane's P5: casting her second ultimate in WILL mode cuts her
combo cooldown by 30%: 5.4 s off the full 18 s, 30% of what's left, or
"set to 30% of full"? Typhoeus's two combos use the same action with 1.0
for their shared cooldown, which only works as "set to 100% of full".
That's about one earlier Arcane combo per second ultimate.
**How:**
- Typhoeus: cast one of her combos, then look at the other: is it on the
  full cooldown too (engine)?
- Arcane at P5, Will > Intellect: cast her combo and start a stopwatch;
  cast the second ultimate about 5–6 s later; stop when the combo is ready
  again. About 12.6 s means 5.4 s off; about 14.3 s, 30% off what was left;
  about 11 s, set to 5.4 s left; 18 s, no cut. (Casting the ultimate at
  5–6 s keeps the four readings at least 1.5 s apart.) Repeat with
  Intellect ≥ Will (data: no cut, 18 s).
- Da Pan with talent 2 (optional; batch 3, Da Pan C): his ultimate's Prep
  Ingredients cuts his combo cooldown by 40% when the combo hits. Cast his
  ultimate, then his combo (the ultimate's two forced statuses help reach
  4 Vulnerable stacks), and time from the combo's cast until it's ready
  again. 40% of the full 19 s off (engine): about 11.4 s; set to 40% of
  full: about 8.4 s; no cut: 19 s. (40% of what's left gives about
  11.7 s, too close to 11.4 s; the Arcane part separates that one.)
  Without the ultimate first: 19 s.

### 37. Enemy timers while Imprisoned or Immobilized (ready, if you have Arcane, Last Rite or Tangtang; the Si part is not testable by hand)

**Why:** the engine freezes every status on the enemy while Si's
Immobilization freezes it (1 s, 1.5 s at P1), which fits one log for
Artful Intent. But the data skips the freeze on control-immune enemies
(likely bosses), where Artful Intent, Jade Vessel's 30 s debuff and
Corrosion would run 1–1.5 s shorter per battle skill. Arcane's WILL
Imprisonment (6.6 s) slows the enemy's clock instead; if statuses follow
it, each combo adds about 2.5 s to every status on the enemy (Corrosion's
ramp and duration, Electrification, teammates' Susceptibility). The
engine doesn't do that yet. This may also explain part of test 4.
**How:**
- Arcane: a teammate applies a timed status to a dummy (Electrification,
  or her own Corrosion), then Arcane's WILL combo: does the status run out
  later than without the combo, by about 2–3 s?
- Si: **not testable by hand.** The engine gives Artful Intent 20 s plus
  the Immobilization (21–21.5 s) where the freeze works, and Jade Vessel's
  debuff a flat 30 s (applied as the freeze starts; the freeze only
  stretches what is already on the enemy); flat 20 s and 30 s on an immune
  enemy. Each reading differs from the next by only 1–1.5 s on a 20–30 s
  timer, too close for a stopwatch or a phone video. Impact: 1–1.5 s of
  Artful Intent or Jade Vessel's debuff per battle skill, on bosses only.
- Last Rite (optional; batch 4, her report D): her combo freezes the
  enemy for 2 s in the data; the engine doesn't model that freeze. Run A:
  put a timed debuff of 10 s or more that isn't an Arts Infliction on a
  dummy (e.g. Corrosion, 15 s: Gilberta's battle skill on a dummy with a
  Cryo stack), then bring it to 3 Cryo stacks with teammates' hits, and
  time the debuff's icon from when it appears until it goes. Run B: the
  same, plus Last Rite's combo as soon as it lights (at 3 Cryo stacks).
  Keep everything else the same in both runs. B about 2 s longer than A:
  her freeze holds the enemy's timers. The same: it doesn't (engine). Her
  combo's cooldown is 8 s, so a 2 s freeze per combo would stretch every
  enemy timer by about a quarter.
- Tangtang (optional; batch 4, her U3): her ultimate (OLDEN STARE)
  Immobilizes the enemy for 4 s; the engine stops the enemy's clock for
  it, as for Si. On a dummy, her battle skill after one combo (two
  Waterspouts: an Arts Susceptibility icon, 15 s). Start a stopwatch when
  the icon appears. Run A: do nothing more; the icon goes at about 15 s.
  Run B: her ultimate right after the battle skill, without diving.
  Engine: about 21–22 s (her ultimate's 2.7 s time stop, test 18, plus
  the 4 s Immobilization); about 19 s if only the Immobilization stops the
  enemy's timers; about 17–18 s if only the time stop does; 15 s if
  neither.

### 38. Two Arts Susceptibility sources (ready, if you have Gilberta and Ardelia, or Avywenna and Antal)

**Why:** the engine adds two sources of Arts Susceptibility on one enemy.
The game may count only the larger. With both up, the team's Arts damage
is off by the smaller one (Gilberta's alone is 0.30). Estella's
Physical Susceptibility has the same open question.
**How:** Gilberta's ultimate and Ardelia's battle skill on one dummy:
read the Arts Susceptibility value (or a teammate's Arts hit) with each
alone and with both: the sum or the larger?

With Avywenna and Antal (optional; batch 3, Avywenna U6): the same
question for Electric Susceptibility. Her ultimate gives the enemy
Electric Susceptibility (talent 2: 10% for 10 s), and so does Antal's
Focus. A teammate's Electric hit (same skill, no crits) with each alone
and with both: is the gain with both the sum of the two gains (engine) or
the larger one?

### 39. Swordmancer's extra hit (ready, if you have 3 Swordmancer pieces, Chen with Sundering Steel, or Lifeng)

**Why:** the 3-piece set deals an extra Physical hit when the wearer
applies a Physical status, at most once per 15 s. Its scale (2.5 × ATK
assumed, with no Arts Intensity term) and what counts (Vulnerable alone
shouldn't) are unchecked.
**How:** three Swordmancer pieces on Gilberta (or any operator with a
Lift), one combo on a clean dummy. The extra Physical hit's number against
her ATK gives the scale (2.5 expected). Her combo's cooldown (17–20 s) is
longer than the set's 15 s, so each of her combos should proc; the "not
again within 15 s" part needs a wearer with two Physical statuses less
than 15 s apart (no hit expected on the second). Optionally: a
Vulnerable-only hit (no hit expected), and a Shatter by the wearer
(unknown).

The Vulnerable-only part matters beyond Swordmancer (batch 3, P1; higher
priority): Sundering Steel, Grizzled Edge, OBJ Arts Identifier and
Antal's combo listen for the same "applies a physical status" event. On
an enemy without Vulnerable, a Lift or Knock Down that isn't forced only
adds a Vulnerable stack; the engine doesn't count that as applying a
physical status. With Chen and Sundering Steel instead of Swordmancer
(batch 3, Chen C2): her battle skill on a dummy with no Vulnerable stacks.
Does the weapon's ATK buff icon appear? Then a second battle skill (now a
real Lift): 1 or 2 stacks on the icon? Engine: no icon after the first, 1
stack after the second. If it shows 1 then 2, a Vulnerable-only status
counts.

With Lifeng (optional; batch 4, her U1): her talent 2 deals an extra
Physical hit (0.5 / 1.0 × ATK by talent level, below P5) on each Knock
Down she causes. It listens to a different event from the effects above,
so the answer may differ. Her battle skill on a dummy with no Vulnerable
stacks: its Knock Down only adds a stack, so no Knock Down damage number
comes. Does a separate small Physical number (about a third of the slam's
or less) appear at the slam anyway? Engine: no. A second battle skill (now
a real Knock Down) shows it in both readings, as the control.

### 40. Messenger's Song (ready, if you have Gilberta; lower priority)

**Why:** her talent gives Guard, Caster and Supporter teammates Ultimate
Gain Efficiency +4% / 7% (+5% at P3); Strikers and Vanguards get nothing.
The engine applies it from the start of the fight. It sets how fast their
ultimates come.
**How:** a Guard, Caster or Supporter teammate's Ultimate Gain Efficiency
on the stat panel with and without Gilberta in the team, and the same for
a Striker or Vanguard (unchanged expected).

### 41. Jade Vessel's combo bonus after Si's ultimate (ready, if you have Si with Jade Vessel)

**Why:** the weapon's next-combo DMG bonus (+25–70% by level) comes from
Immobilization and from the wielder's ultimate, for 20 s, and only on the
next combo. The engine now follows the data; the old kit had it always on.
**How:** cast only her ultimate (no battle skill), wait 10 s, then cast
her combo: its slashes should carry the bonus. Again, waiting 25 s
instead: they shouldn't.

### 42. Typhoeus's hover end and stack lifetime (ready, if you have Typhoeus)

**Why:** the data ends her hover about 1.9 s after shots 1–3 (1.5 s after
shot 4) if you give no input, and her new kit does the same; until then
the engine kept the floating shots, floating combo and P1's ATK +18% on
after a short hover. Separately, her Signs and arrows may expire after
24 s held.
**How:** battle skill, one floating shot, then nothing: does she land about
2 s after that shot? In a fight, hold Signs and arrows for 30 s without
using them: do they drop at 24 s?

### 43. Typhoeus's shots off-field (ready, if you have Typhoeus)

**Why:** the data has her fire five shots on her own when you swap away
during the hover; shots with arrows are Power Shots, but the 5th is a plain
shot (no burst) even with arrows left. The engine follows that.
**How:** cast her battle skill and swap away at once: does she fire five
shots on her own? Are the ones with arrows Power Shots (burst numbers)? Is
the 5th a plain shot, with no burst number, even with arrows left? The
same after her floating combo cast and a swap.

### 44. Signs from a teammate's Nature Burst (ready, if you have Typhoeus; lower priority)

**Why:** her talent gives her a Sign when anyone triggers a Nature Burst
(at most once per 0.2 s). The engine follows the data.
**How:** with few Signs, have a Nature teammate trigger a Nature Burst
(two Nature Inflictions in a row): does her Sign counter go up by 1?

### 45. Typhoeus's combo at hover end (ready, if you have Typhoeus)

**Why:** her combo window opens when Signs reach 8. The data also sends
the same signal at the hover's end, so if the combo was on cooldown when
she reached 8, it might become available then without another Sign. The
engine doesn't do that yet. One combo more or less per such hover.
**How:** reach 8 Signs while the combo is on cooldown, keep hovering until
it's off cooldown, then end the hover (the 5th shot): does the combo
become available without another Sign?

### 46. Hail of Arrows count (optional, if you have Typhoeus)

**Why:** after her ultimate, each of her next five shots within 5 s
brings a rain of arrows, the 5th an empowered one. The engine counts one
rain per shot.
**How:** ultimate, then five shots within 5 s: four normal rains and an
empowered one on the 5th? Then land early and attack on the ground within
the 5 s: no rains expected.

### 47. Projectile travel and Typhoeus's burst delay (not testable by hand)

**Why:** the engine lands projectile hits at their launch frame; the data
has no travel time. Typhoeus's Power Shot burst shows up about 0.3 s after
the arrow in the logs: travel, or a delay of the burst itself? Small for
damage (0.1–0.4 s); her Hail of Arrows count already ignores the bursts,
so moving them later is safe.
**Not testable by hand:** the gaps are 0.1–0.4 s, below what a stopwatch
or a phone video can tell. The engine keeps launch-frame landings (kits
take travel time from logs where they can); ZMDLogs timestamps are the
way to settle it.

### 48. Valiant's hit and skill-type bonuses (ready, if you have Estella with Valiant)

**Why:** Valiant deals an extra Physical hit (2.4 × ATK) on each Lift. A
data flag may give it the skill type of the hit that caused it; the engine
gives it none, so combo DMG or ultimate DMG bonuses don't apply to it.
**How:** with a bonus for one skill type only (combo DMG or ultimate DMG),
compare Valiant's hit after her combo with the one after her ultimate
(no crits). Different numbers mean it takes the skill type.

### 49. Estella's talent-1 SP (ready, if you have Estella)

**Why:** after she causes a Shatter, her next battle skill returns 15 SP
(talent level 2). The data says a teammate's Shatter doesn't count.
**How:** the game shows no SP number, so look for a jump in a phone video,
with the SP bar not full. After a battle skill the bar drops a third and
regen pauses (about 1.5 s, unverified), so a return shows as a small jump
on a still bar, about 0.7 s after the cast (15 of 300: a twentieth of the
bar). Her combo on a Solidified enemy (Shatter), then her battle skill: a
jump expected. A second battle skill without a Shatter: no jump. Then a
teammate's Shatter (their Lift on a Solidified enemy), then her battle
skill: no jump, if the data is right. If a twentieth of the bar is too
small to see, this one is not testable by hand; the impact is 15 SP per
Shatter-then-battle-skill (about 2 s of SP regen).

### 50. Estella's P5 energy (ready, if you have Estella at P5)

**Why:** at P5 she gains 5 energy whenever an enemy is Solidified, at most
once per 1 s. The data says anyone's Solidification counts, and the engine
counts re-Solidifying an already Solidified enemy too.
**How:** with nothing else giving her energy (her gauge not full), watch
her ultimate gauge in a phone video: 5 energy is about a fourteenth of her
70-energy gauge, so look for a small step. Let a teammate cause
Solidification: a step means anyone's counts. Then re-Solidify an enemy
that is already Solidified: another step means a refresh counts. (Two
Solidifications within 1 s should give one step, not two, but they can't
be timed by hand reliably; skip that part.) If the gauge doesn't show such
a small step, this one is not testable by hand.

### 51. Does an effect a hit triggers count on that same hit? (ready, if you have Arcane with Solemn Phalanx, Hot Work, Da Pan with Ancient Canal, or Ardelia with Dreams of the Starry Beach)

**Why:** some weapon and gear-set effects start from something a hit does
(an Arts Infliction, a Susceptibility it applies). The data creates some
of them before the hit's damage, so the engine lets them act on that same
hit: Solemn Phalanx's INT Arts DMG on the battle skill that inflicts, Hot
Work's bonus on Arcane's INT ultimate hit. If the game applies them only
from the next hit, those hits are 10–25% too high in the engine.
**How:** with Solemn Phalanx on Arcane in INT mode and its buff not yet
up, cast her battle skill on a dummy: compare its damage with a second
battle skill cast while the buff is up. Equal means the first hit already
had the buff. Hot Work: compare her INT ultimate hit with and without the
set's buff already up before it.

With Da Pan and Ancient Canal (optional; batch 3, Da Pan B): his combo's
Crush creates Ancient Canal's bonus (+56%) and his talent-1 layers before
the combo's own damage in the data, so the engine puts both on that hit.
Compare the first combo of a fight (no bonus up before it) with a second
combo within 20 s of it (the first one's bonus still up; his ultimate's
Prep Ingredients shortens the cooldown enough): the lower of two tries
each, against crits. About equal: the hit sees what its own Crush creates
(engine). The second about 1.3–1.4× the first: it doesn't. The same
question decides Wulfgard's Scorching Fangs on the hit that forms his
Combustion, Perlica's P3 and Pulser Labs, and Seeker of Dark Lung.

With Ardelia and Dreams of the Starry Beach (optional; batch 4, her
report): her battle skill on a Corroded enemy consumes the Corrosion, and
that gives the enemy her Arts Susceptibility (0.20 at P0, 30 s) and the
weapon's Arts DMG Taken (+28% at level 9, 25 s). The data creates both
before the hit's damage, so the engine puts both on that same hit. Basic
chain to a Final Strike on a clean dummy (her combo lights), her combo,
wait about 3 s for its bomb (the Corrosion icon), then battle skill A;
within 25 s, battle skill B (no Corrosion left; both effects still up).
No Hot Work (its Nature DMG lasts only 10 s from the Corrosion) and no
teammates' buffs in between. Compare A with B, the lower of two tries
each (crits): A/B about 1.00: both act on A (engine); about 0.78: only
her Susceptibility does; about 0.83: only the weapon's does; about 0.65:
neither.

### 52. SP from one perfect dodge (not testable by hand)

**Why:** the data gives a perfect dodge 7 SP
(`buff_common_dash_behit_listener`, blackboard `atb`); the Talos Wiki and
other simulators say about 7.5. The engine uses 7 (the data).
**Not testable by hand:** the game shows only an SP bar, no number, and
the two readings differ by 0.5 SP, a six-hundredth of the bar. The impact
is tiny: 0.5 SP per perfect dodge, while a battle skill costs 100 and SP
regenerates 8/s, so each dodge is off by about 0.06 s of regen.

### 53. Does a perfectly dodged hit count as "attacked"? (ready, if you have Snowshine, Catcher, Ember or Purrchena; low priority)

**Why:** effects like Catcher's combo trigger ("when the controlled
operator is attacked") and Snowshine's and Catcher's battle-skill
retaliation listen for the operator being hit (the same listener in all
four operators' data); the dash makes the dodger immune, so a perfectly
dodged hit probably doesn't count. The engine assumes it doesn't: a
perfect dodge replaces the attack on the dodger with a perfect-dodge
event. Low priority: the owner doesn't use these operators, and their kits
aren't in yet.
**How (the owner's method):** with Snowshine, dodge an enemy attack
perfectly and see whether the enemy gets a Cryo Infliction anyway. Her
battle skill (Saturated Defense) raises a shield; when she's attacked while
it's up, she performs a retaliation bash that deals Cryo DMG and applies
Cryo Infliction to the attacker. First, as a control, raise the shield
and let an attack hit it: the bash's Cryo damage number and the Cryo
Infliction icon on the enemy should appear. Then raise the shield again
and perfectly dodge the enemy's next attack. Both appearing means a
perfectly dodged hit counts as "attacked"; neither means it doesn't, as
the engine assumes. If nothing appears, the dash may also have ended the
shield (test 54), which looks the same.
(With Catcher instead: perfectly dodge an enemy attack with another
operator controlled; does Catcher's combo become castable?)

With Ember (batch 4, her U3; the cleanest form, since her combo opens
whenever the controlled operator is attacked, with no HP condition):
another operator controlled, Ember's combo off cooldown. Control: let an
enemy attack hit the controlled operator; Ember's combo button lights.
Cast it (or let the window pass) and wait until it's ready and dark
again. Then perfectly dodge the next attack: lit means a perfectly dodged
hit counts as "attacked"; dark means it doesn't (engine).

### 54. Can a dash cancel a battle skill or combo at any moment? (ready; higher priority: affects every operator)

**Why:** the engine lets a dash (the perfect dodge at an enemy attack) end
any current action except an ultimate before its exclusive frames
(Endaxis's rule from the game's code), dropping that skill's hits still to
come. If some skills can't be dashed out of, dodges cost less damage than
the engine says. Every operator dodges, so this affects every scenario with
dodging on.
**How:** no enemy attack is needed; press dodge on a training dummy.
1. Laevatain with 4 Melting Flame: cast the battle skill (the empowered
   one) and press dodge right after, within the first second. Does she
   dash at once? Does the big extra hit still appear (its large damage
   number and the forced Combustion on the dummy)? Without the dash it
   comes about 1.8 s after the cast. Engine: she dashes at once and the
   extra hit never comes. (Her explosion and its burning ticks land
   anyway: the engine treats them as already on their way.)
2. The same with a combo: Gilberta's (its hit comes about 1.6 s in) or
   Si's (the big final hit, about 1.6 s in). Cast it and press dodge right
   away: does the hit's damage number still appear? Engine: no.
   (Laevatain's combo isn't a test of this: the engine already lets its
   hit land after a dash, as a projectile on its way.)
3. Optionally Gilberta's battle skill, whose explosion comes about 3.6 s
   in: dodge right after the cast. Does she dash (the data forbids her
   swapping and casting for 3.7 s, test 15; the engine still lets her
   dash), and does the explosion still come? Engine: she dashes and it
   doesn't.
If the operator doesn't dash until the skill ends, or the hit still
lands, that skill can't be dashed out of (or its hit is already on its
way).

### 55. The Endministrator's ATK: stat panel vs the engine (answered 2026-10-21: a food buff; optional confirmation)

**Why:** in a ZMDLogs fight (fixtures/pending/zmdlogs-7e19489ae503.json)
every Endministrator hit implies +180 flat ATK (batch 2, K7). Answered:
it is Ginseng Meat Stew (ATK +180 flat, Crit Rate +11.4%, 300 s), which
the log doesn't list; with it all 34 of her hits match. The panel check
below still confirms the engine's ATK for her build, without food.
**How:** open her character panel and note ATK, with her weapon, gear and
level as they are. Send the build (or a screenshot of the panel with
weapon and gear) so it can be compared with `efsim calc` on the same
build: equal, or about 180 × her attribute bonus (≈ 860 with that log's
Agility) higher?

### 56. Where the Endministrator's Crush gets its damage bonuses (ready)

**Why:** the game deals a Crush's own damage before the hit that causes it
(BuffData: Lift, Knock Down, Crush before their handlers, Breach after;
batch 2, K3), so the Crush sees talent 2's +20% damage taken on sealed
enemies while the battle-skill hit that caused it doesn't. The engine
deals it after, so it's off by 12–17% on her biggest hit.
**How:** on a dummy with 4 Vulnerable stacks, Crush it twice while it's
sealed (her crystals on it) and twice while it isn't. Is the Crush number
about ×1.2 when sealed? (Status hits can crit: take the two lowest of
each.)

### 57. Akekuri's Link during her ultimate (ready, if you have Akekuri)

**Why:** her talent 2 gives the team a Link stack during her ultimate
(batch 2, B1): a teammate's battle skill then deals ×1.30 (one Link), ×1.45
with Camille's or Lifeng's combo just before (two; an ordinary combo gives
no Link, see test 8). A fixed +20% bonus instead would show ×1.20.
**How:** a teammate's battle skill on a dummy without Akekuri's ultimate,
then the same during it: compare the numbers (no crits: take the lower of
two each). Report's other tests: docs/kit-batches/batch-2/chr_0019_karin.md.

### 58. Antal's combo repeats a Lift (ready, if you have Antal)

**Why:** his combo repeats what opened its window (batch 2, T3): after a
teammate's Lift, his combo adds a second Lift; after an infliction, the
same infliction.
**How:** a teammate's Lift on a dummy (Estella, Gilberta), then Antal's
combo: does a second Lift damage number appear? Report's other tests:
docs/kit-batches/batch-2/chr_0023_antal.md.

### 59. Fluorite's talent-2 chance (ready, if you have Fluorite; tedious)

**Why:** "when hit by Arts DMG, 20% chance (30% from P2)" of ATK +20%: the
engine rolls that chance from the data (batch 2, K1); this checks the
chance itself.
**How:** take 20 or more Arts hits at least 10 s apart and count how often
the ATK-up icon appears: about 1 in 5 below P2, 3 in 10 from P2. Tedious;
low priority. Catcher's tests (low priority): § Kit of
docs/kit-batches/batch-2/chr_0020_meurs.md.

### 60. A combo trigger during the combo's cooldown (ready, if you have Arclight; higher priority: every short-cooldown combo)

**Why:** a combo's trigger can come while the combo is still on cooldown:
Arclight's cooldown is 3 s, and her own battle skill consumes
Electrification (one of her triggers) about 2.4 s after a combo. The
engine ignores such a trigger for every operator (batch 3, T5): the combo
stays dark until a new one. The other reading keeps it, and the combo
lights when the cooldown ends. For every combo with a short cooldown,
that's one combo more or less each time.
**How:** her ultimate on a dummy (its forced Electrification lights her
combo). Cast the combo as soon as it lights, then her battle skill at
once: the dummy still has Electrification, so the battle skill's extra
Electric attack consumes it inside the combo's 3 s cooldown. Then press
nothing and watch the combo button for a few seconds, with no new
Electrification. Engine: it stays dark. Kept: it lights when the
cooldown ends. The margin is only about half a second (if the extra
attack lands after the cooldown, the button lights in both readings), so
cast the battle skill as fast as the game takes it and repeat a few
times: dark even once means the engine is right; lit every time means
the trigger is kept.

### 61. MarkCanInterrupt: when a skill lets its operator act again (ready, if you have Wulfgard; alternatives with Snowshine or Purrchena)

**Why:** some skills carry a mark in the data (MarkCanInterrupt) from
which the operator can act again before the skill ends. Since 2026-10-20
the engine reads it (batch 3, S1): past the mark, the next basic attack or
skill can start. Wulfgard's plain battle skill then frees him at about
1.6 s instead of 3.9 s (2.3 s per plain battle skill), Snowshine's un-hit
shield 1.3 s sooner, Purrchena's unshielded combo about 6 s sooner,
Catcher's counter too (batch 2). If the game doesn't free them there,
these rotations are too fast in the engine.
**How:** on a dummy with no Combustion or Electrification, cast
Wulfgard's battle skill and keep pressing basic attack; time from the
cast to the first basic-attack damage number. Then the same on a
Combusted dummy (right after his ultimate, while it burns): there the
skill takes a path that skips the mark, so it's the baseline.
- Mark (engine): plain **about 1.6 s**, Combusted about 2.4 s: the plain
  cast is sooner.
- No mark (the engine before S1): plain **about 3.9 s**, Combusted
  2.4 s: the plain cast is later.

Alternatives (the owner doesn't use these two, so low priority):
- Snowshine on a dummy (which doesn't attack), SP bar full: press her
  battle skill three times in a row, each as soon as the game takes it,
  and time from the first shield to the third: **about 4.5 s** with the
  mark (engine), **about 7.1 s** without.
- Purrchena: let an enemy hit the controlled operator to light her combo,
  cast it with no shield up, and press basic attack at once (Purrchena
  controlled): a swing within about 1 s (mark, engine), or only about 7 s
  later.

### 62. Layers on one timer: does each new layer restart it? (ready, if you have Chen; or Akekuri at P1+, Yvonne or Ember)

**Why:** buffs whose layers share one timer (the data's stackingType 8:
Chen's talent 1, Perlica's P3, Da Pan's talent 1, Akekuri's P1, Æthertech,
MI Security) are read as Endaxis does: each new layer restarts the timer
(batch 3, B3). Chen's only log has her layers gone 10.6 s after the first
one, though six were added since: all layers may expire with the first.
For Chen that's up to five layers of ATK +8%; for Akekuri, +50% ATK
nearly all the time (restart) or 2–4 layers.
**How:** SP bar at least two-thirds full. On a dummy, Chen's battle skill
(one hit: one layer of her talent's ATK buff, 10 s), then a second battle
skill about 8 s later (a second layer). No combo or ultimate in between
(their hits add layers; leave her combo when it lights). Watch the
talent's buff icon and its counter (1, then 2), timed from the first
battle skill:
- gone at about 10 s, both layers at once: they expire with the first
  (the log);
- 2 layers until about 18 s, then gone: each layer restarts the timer
  (engine);
- down to 1 at about 10 s, gone at about 18 s: each layer has its own
  timer.

With Akekuri at P1+ (the same question, batch 2's U3): two combos about
8 s apart, then wait. Does her ATK icon (4 layers) go about 10 s after the
first combo, all at once about 10 s after the second (engine), or drop to
2 layers about 8 s before that?

With Yvonne (batch 4, her Y3): her ultimate's layers (up to 10) share one
4 s timer of the same type. During her ultimate keep attacking and watch
the layer counter: it stays at 10 to the end (each layer restarts the
timer: engine; own timers look the same here), or it drops about 4 s
after the first shot and builds up again (all expire with the first).

With Ember (batch 4, her G3; low priority): her talent 2 (ATK +9% per
layer at talent level 2, 7 s, up to 3) is of a related type that the
engine also runs on one restarted timer. Let an enemy hit Ember once (1
layer), again about 4 s later (2 layers), then avoid hits. From the first
hit: both gone at about 7 s (they expire with the first); gone at about
11 s (each layer restarts the timer: engine); down to 1 at about 7 s and
gone at about 11 s (own timers).

### 63. Does a Shatter count as consuming a reaction? (ready, if you have Alesh and Estella; variants with OBJ Razorhorn or Twelve Questions)

**Why:** a Shatter ends Solidification with a physical status. Effects
that listen for "an Arts Reaction consumed" may or may not count it
(batch 3, A7): Alesh's combo trigger, Liino's combo, OBJ Razorhorn's ATK,
Twelve Questions' ATK. The engine's interims disagree today: Alesh's and
Razorhorn's count a Shatter, Twelve Questions' doesn't. One answer fixes
them all: an Alesh combo per Shatter, Razorhorn's ATK +33.6%.
**How:** Alesh's ultimate on a dummy (a Cryo Infliction icon), then his
battle skill: it consumes the Cryo and Solidifies the dummy. His combo
button should stay dark (an infliction was consumed, not a reaction: the
control). Then Estella's combo or battle skill (a forced Lift) Shatters
it: the Shatter damage number appears. Does Alesh's combo button light
within a moment? Lit: a Shatter counts (Alesh's interim); dark: it
doesn't.

Variants (each answers the same question; batch 3, Avywenna U4 and
Arclight A3):
- Estella with OBJ Razorhorn: Shatter a Solidified dummy (her combo's
  Lift). Does an ATK buff icon appear on her, and is her next basic attack
  about 1.2× the same attack before? (Razorhorn's interim: yes.)
- Twelve Questions on a sword operator who can Shatter (Chen's battle
  skill Lift, or the Endministrator's Crush, on a Solidified dummy): does
  its ATK-up icon appear after the Shatter? (Its interim: no.) Arclight
  can't Shatter, so she can't test her own weapon.

### 64. A Vulnerable stack on an already Vulnerable enemy: does it open a combo? (ready, if you have Chen or Da Pan)

**Why:** Chen's combo opens "when an enemy becomes Vulnerable", Da Pan's
"when an enemy reaches 4 stacks of Vulnerability". The engine opens
Chen's on every stack added, and Da Pan's on every stack added at 4, even
when the count stays at 4 (their kit plans). Since 2026-10-20 it can also
tell a first stack and a rising count apart (batch 3, T1), so the kits can
follow whatever the game does. Each is one combo more or less per such
stack.
**How:**
- Chen: her battle skill on a clean dummy (1 Vulnerable stack: her combo
  lights), then her combo (2 stacks). Wait until the combo's cooldown is
  over (12 s at P5, 15 s below) and its button is dark; Vulnerable lasts
  20 s from the combo's stack. Then a teammate's Lift or Knock Down adds a
  third stack (Estella, Gilberta, Da Pan's battle skill). Does Chen's
  combo light? Engine: yes. Dark: only the first stack opens it.
- Da Pan: bring a dummy to 4 Vulnerable stacks (his battle skills and
  ultimate add them; a teammate's Lift helps) without casting his combo,
  and wait about 10 s until its button is dark (the window is 6 s). Then
  one more battle skill (its Lift adds a stack; the count stays at 4).
  Does his combo light again? Engine: yes. Dark: only going from 3 to 4
  opens it.

### 65. Arclight's talent counter: does it expire? (ready, if you have Arclight; part 2 needs P5 and a teammate who causes Electrification)

**Why:** Arclight's talent 1 counts her extra attacks (each consumes an
Electrification); at 3 (2 at P5) the team gets Electric DMG +16% or so.
The counter's data has "no expiry" in one field and 10 s in another; the
engine never expires it (batch 3, B4). Without a teammate who causes
Electrification her extra attacks are usually more than 10 s apart, so
this decides whether the talent ever fires in such teams. Xaihi's crystal
count (test 70) and Typhoeus's Signs (test 42) have the same data pattern.
A second question: the engine gives the bonus to the extra attack that
completes the count (the data adds the layer before the hit's damage).
**How:**
1. Her ultimate on a dummy (forced Electrification), then her battle
   skill: its extra Electric attack consumes the Electrification, and her
   talent icon (on the squad bar) appears with 1 on it. Watch it for 15 s
   with no more Electrification: gone after about 10 s, or still there
   (engine)?
2. At P5 (the count is 2): two extra attacks within 10 s, nothing else
   changed between them (no combo). Is the second extra attack's damage
   number about 16% higher than the first (engine), or the same? The
   team's Electric DMG icon should appear as the second lands. Two
   Electrifications within 10 s need a teammate who causes them (e.g.
   Perlica's combo, or an Electric hit on a Heat- or Cryo-inflicted
   dummy). Make both the same level and from the same teammate:
   Electrification also raises the extra attack (12% or more), so
   different sources would hide the 16%.

### 66. A forced Electrification on a stronger one (ready, if you have Perlica)

**Why:** Perlica's combo forces Electrification I (5 s; 8.75 s from P1).
On an enemy that already has a stronger, longer Electrification from a
reaction, the engine replaces it with the new one; the game may keep the
stronger one. The same rule covers every forced reaction landing on a
stronger status (Arclight's ultimate, Alesh's battle skill, Laevatain's
forced Combustion). For Electrification it's 4–12 points of Arts DMG
Taken (× Arts Intensity) on the team's Arts hits for up to 20 s.
**How:** build Electrification III or IV with a reaction: 3 or 4 stacks
of one infliction from teammates (Cryo or Heat), then an Electric hit
(e.g. Perlica's battle skill). It lasts 24 s (III) or 30 s (IV). About
4 s later, a Final Strike by the controlled operator and Perlica's combo
at once. Time how long the Electrification icon stays after the combo:
- replaced (engine): about 8.75 s (5 s below P1);
- kept: the rest of the original, about 20 s (III) or 26 s (IV).

### 67. Perlica's finisher: a Knock Down on an enemy that survives? (ready, if you have Perlica)

**Why:** her finisher's data forces a Knock Down when she's controlled
(her report, row 7), but the action carries the flag for a dying target
(deadOption 2), which elsewhere marks a death launch or knock-back
(Karin's battle skill in batch 2, Chen's second Lift). The SkillData
compiler follows that reading (batch 3, D2), so the engine gives her
finisher no Knock Down on an enemy that survives. If the game does knock
it down, each of her finishers adds a Knock Down damage hit and a
Vulnerable stack (which can open Chen's and Da Pan's combos, test 64).
The answer also says how to read that flag for other operators.
**How:** stagger a dummy with no Vulnerable stacks (it can't die) and
finish it with Perlica controlled. After the finisher's own number, does
a Knock Down damage number appear and a Vulnerable stack show on the
dummy (or does it fall)? Engine: neither. Then the same with another
operator's finisher, as the baseline (no Knock Down expected).

### 68. Perlica's P3 layers and Wild Wanderer (ready, if you have Perlica at P3+; part 2 needs Wild Wanderer)

**Why:** (1) P3 gives her ATK +20% per layer (up to 2) when she applies
Electrification. The engine gives one layer per Electrification; her only
log's battle skill fits two. (2) Wild Wanderer gives the team Physical and
Electric DMG (+22.4% at its top level) for 15 s when the wielder applies
Electrification. The engine counts both a reaction Electrification and
her combo's forced one; the data's event might mean only one of them.
**How:**
1. A teammate applies Cryo to a dummy, then Perlica's battle skill (one
   Electrification reaction). Count the stacks on her ATK buff icon: 1
   (engine) or 2.
2. With Wild Wanderer on Perlica: the same reaction, then look for the
   team buff icon on a teammate. Wait until it's gone (15 s), then her
   combo (forced Electrification): does the icon appear again? Engine:
   both times.

### 69. Chen's P1 at full HP (ready, if you have Chen at P1+)

**Why:** her P1 gives "DMG Dealt +20% to enemies below 50% HP". Her only
log has the bonus on every hit from the start, at about full HP, and the
damage fits only with it. Since 2026-10-20 the engine can follow the data
(enemy HP from the scenario, batch 3, N1), but her kit plan keeps P1
always on, as in the log, until this test says otherwise. It's 20% of her
damage while the enemy is above half HP.
**How:** on one enemy whose HP bar goes down, basic attack 1 above half
HP, then below (no skill for 10 s before each, so no talent layers; take
the lower of a few hits each, against crits). About ×1.19 higher below
half HP: the condition holds (data). Equal: P1 is always on (the log).

### 70. Xaihi's crystal (ready, if you have Xaihi)

**Why:** her battle skill puts out a crystal that heals the controlled
operator on two Final Strikes, then opens her combo. Three open points
(batch 3, Xaihi U1–U3): (1) the crystal's Arts Amp (+20% at P5) goes to an
operator already at Max HP when healed; the engine gives it on every heal
(operator HP isn't tracked: operators count as topped up). (2) A second
battle skill with a crystal out: the engine replaces the crystal and
resets its count. (3) The count may expire after 10 s (test 65's
pattern); the engine keeps it.
**How:**
1. Let an enemy hit the controlled operator hard (well over the 500–650
   HP a heal restores), then cast Xaihi's battle skill and do a Final
   Strike: does the Arts Amp icon appear on that operator? Then the same
   at full HP. Data: no icon when hurt, an icon at full HP. An icon both
   times: the condition isn't what the data says. (The engine keeps the
   Amp either way; a "no" means a hurt controlled operator misses it.)
2. Cast her battle skill twice within a few seconds and count the
   crystals around the controlled operator; then count the Final Strikes
   until her combo can be cast. One crystal and 2 Final Strikes: replaced
   (engine). Two crystals and 2: they share one count; two and 4: each
   has its own.
3. Battle skill, one Final Strike, then wait 12 s by stopwatch (the
   crystal lasts 20 s) and do a second Final Strike: can the combo be
   cast? Compare with two Final Strikes 3 s apart. Castable both times:
   the count doesn't expire (engine). Only with 3 s: the first layer
   expired after 10 s (a third Final Strike then opens it).

### 71. Alesh's combo on consumed Originium Crystals, and his Solidification level (ready, if you have Alesh and the Endministrator; part 2 optional)

**Why:** Alesh's combo also opens "when Originium Crystals on a nearby
target are consumed" (the Endministrator's crystals). Since 2026-10-20 the
engine can tell a consumed buff from one that runs out (batch 3, T2); his
kit plan opens the combo on consumption only. Part 2 confirms that his
battle skill's forced Solidification takes its level from the Cryo
stacks it consumes.
**How:**
1. The Endministrator's combo puts crystals on a dummy; let them run out
   (about 5 s) without a physical status: Alesh's combo button should
   stay dark. Again, and this time her battle skill (a Crush) consumes
   them: the button should light. If it lights when they run out too,
   the trigger is "the crystals end", not "consumed".
2. Optional: time the Solidification icon after his battle skill on a
   dummy with 1 Cryo stack, then on one with 3 or 4 (Cryo hits from
   teammates): about 5.75 s vs 7.75–8.75 s (engine).

### 72. Wulfgard's P3: does he keep his full Scorching Fangs? (ready, if you have Wulfgard at P3+)

**Why:** at P3 his battle skill's additional shot gives teammates
Scorching Fangs at half strength (15% Heat DMG). The data gives that copy
to the whole team, him included, on a buff he already has; if a refresh
takes the new values, his own drops from +30% to +15%. The engine follows
the description: teammates only.
**How:** after his ultimate (Scorching Fangs on), note the non-crit
damage numbers of basic attack 1. Cast his battle skill on the
still-Combusted dummy (the additional shot triggers P3), then basic
attack 1 again within 10 s. No combos in between (Link, Rational
Farewell). Same numbers: he keeps +30% (engine). About 9–10% lower (with a
+34.7% Heat or Arts DMG weapon; 11–12% without): his copy became the
teammates' 15%.

### 73. Avywenna's returning lances and Cohesive Traction (ready, if you have Avywenna; part 2 needs Cohesive Traction)

**Why:** (1) her combo throws 3 lances; her battle skill recalls them, and
each returning lance hits what it meets (1.68 × ATK). The engine assumes
every lance hits a single target once; if some miss, her damage and her
talent's energy drop. (2) Cohesive Traction's battle-skill bonus says "up
to 3 stacks", but the data's 30 s adding cooldown allows one layer at a
time; the engine follows the data. +28% vs up to +84% Electric DMG on a
battle skill.
**How:**
1. A teammate applies Electric Infliction to a dummy; a Final Strike by
   the controlled operator lights Avywenna's combo. Cast it, then her
   battle skill. Count the Electric damage numbers: the battle skill's
   own and 3 lance numbers, each about 1.12× the battle skill's
   (engine). Fewer lance numbers: some lances miss. Again after two
   combos (12 s apart, her cooldown): 6 lance numbers. Don't use her
   ultimate first: its EX lance returns too (about 2.9× the battle
   skill's number), and its Susceptibility changes the ratios.
2. With Cohesive Traction: her battle skill's own number (a) with no
   combo in the last 30 s, (b) after one combo, (c) after two combos
   about 12 s apart, with no Camille or Lifeng on the team (their combos
   give Link, which would hide the comparison; see test 8). (b) is about
   1.2× (a). Then (c) about the same
   as (b): one layer (data, engine); about 1.17× (b): two layers add.
   The buff icon's stack counter shows it too.

### 74. Da Pan's P5 stack and the Lift (ready, if you have Da Pan at P5)

**Why:** at P5 his battle skill adds 1 more Vulnerable stack (once per
45 s). The data judges the Lift first: on an enemy without Vulnerable the
Lift only adds a stack, then P5 adds the second. The engine follows that
order. The other order gives a real Lift (its damage and the status) on
the first battle skill.
**How:** on a dummy with no Vulnerable stacks (and no battle skill of his
in the last 45 s), cast his battle skill once. 2 Vulnerable stacks and no
Lift damage number (the dummy isn't lifted): the data's order (engine). 2
stacks and a Lift damage number: the extra stack came first.

### 75. Chen's ATK: stat panel vs the engine (ready, if you have Chen; variants with Umbral Torch on Laevatain, higher priority, and with Lifeng)

**Why:** her only log (fixtures/pending/zmdlogs-7e19489ae503.json)
doesn't record her weapon and gear levels, and her hits drift as if her
ATK% were about 1.57 instead of 1.35 on a base about 15% lower (the
Endministrator's extra 180 ATK in test 55 was a food buff; the same food
doesn't fit Chen). Her stat panel settles the
build.
**How:** as in test 55: open her character panel and note ATK, with her
weapon, gear and level as they are, and send the build (or a screenshot
of the panel with weapon and gear) to compare with `efsim calc`. Any
build of hers helps.

The copied toggle (batch 4: Ardelia U2, Pogranichnik W3; higher priority,
with Laevatain): Umbral Torch, Opus: Etch Figure and Glorious Memory carry
a copy of another weapon's ATK buff (`buff_wpn_lance_0003`, +19.6% ATK at
level 9) behind a condition on a value their skills don't have. The
engine treats it as off. If the game reads the missing value as 0, it's
always on and those weapons give their ATK% twice; that may be part of
Chen's drift above (1.35 + 0.196 ≈ 1.55). Laevatain with Umbral Torch (or
anyone with Opus: Etch Figure or Glorious Memory): her panel ATK against
`efsim calc` for the same build. Equal: off (engine). About 0.196 more
ATK% than calc shows: on. When the weapon is her only ATK% source that's
about 1.16× calc's ATK (examples/laevatain-umbral-torch.json: 4,930 vs
about 5,740). If the panel matches calc, the buff might still act only in
battle; a log with one of these weapons would settle that.

With Lifeng (batch 4, her U3): talent 1 gives ATK per Intellect and Will
point, which the engine adds to her attribute bonus (calc includes it).
Her panel ATK against calc for the same build: equal means that reading
(engine). About 1.17× calc at P0 or 1.25× at P5 means the game reads it
as ATK% (Opero 77 at level 90, no gear: calc 1,853 vs 2,176 at P0, 2,030
vs 2,548 at P5).

### 76. Purrchena's shield, Giftbox and Handicraft (ready, if you have Purrchena; low priority; C and D are tedious)

**Why:** (A) her battle skill's shield runs as helper skills in the data;
the loader reads those since 2026-10-20 (batch 3, S4), so her kit will
hold her until the shield drops (about 3 s), not about 1.7 s. (C) Her
combo's Giftbox picks one of three items and, in the data, never the
previous one; the engine follows the data. (D) In the data, at most one
Handicraft (a pulling vortex) per ultimate. Report's details:
docs/kit-batches/batch-3/chr_0038_purrche.md.
**How:**
- A: on a dummy (which doesn't attack), cast her battle skill and keep
  pressing basic attack. Does her first swing come while the shield and
  the Protection icon are still up, or only when the shield drops (data,
  engine)? With an attacking enemy, after the first block the shield
  should stay about 3 s more.
- C: cast her combo six times, each within 40 s of the last, and note
  the item each time (an explosion, a pulling vortex, or a dessert). The
  data never repeats the previous item; with independent thirds, at
  least one of the five pairs would repeat 87% of the time.
- D: over ten ultimates without an Ambassador's Special (fewest at P0),
  count the vortexes each time. The data allows one at most; independent
  50/50 Prezzies would give two or more in about half of them.

### 77. Combustion ticks and a later ATK buff (ready, if you have Laevatain and Liino; higher priority: every Heat team)

**Why:** Combustion deals a tick of damage every second for 10 s. The data
marks the ticks as taking the applier's ATK when Combustion is applied
(`takeAtkSnapshot`). Since 2026-10-21 the engine keeps the applier's whole
attacking side from then (ATK, DMG bonuses, Amp, Arts Intensity): one
log's three ticks fit only with the DMG bonuses from the reaction (batch
4, V2), but no log shows ATK changing mid-burn. If ATK is read at each
tick instead, every Combustion that starts before a team ATK buff (or
outlasts one) is off by that buff's share. Rossi's bleed has the same
flag.
**How:** on a training dummy, Laevatain with 4 Melting Flame: her
empowered battle skill forces Combustion. Ticks don't crit, so they all
show the same number. Note two or three ticks, then swap to Liino and cast
her battle skill (Vocalist Stance: team ATK; its icon appears on
Laevatain) while the dummy still burns, and note the ticks after it. No
combos or other buffs in between.
- The ticks stay the same: ATK is kept from the application (data,
  engine).
- The ticks rise by about 7% (Vocalist Stance's ATK +10% at skill level 12
  on top of the 39% ATK% of examples/laevatain-forgeborn.json: e.g. 3,130
  → about 3,350), and more as
  Bedazzling Night Debut's ATK stacks build on her if Liino has it (test
  25): ATK is read at each tick.

Liino's ultimate (Cosmovoice: about +20% ATK on Laevatain) instead of her
battle skill gives a bigger step. With Wulfgard instead of Laevatain: his
ultimate's Combustion and the same buff.

### 78. Lifeng's Link: her ultimate's third hit, and how long the Link lasts (ready, if you have Lifeng)

**Why:** Lifeng's combo gives one Link stack (one of the few Link sources:
test 8). Her ultimate deals a third big hit only when its cast uses Link
(6.0 of its 14.0 × ATK). The engine gives that hit only then, and keeps
her combo's Link for 20 s (the combo's data, and the skill panel's "Combo
Duration 20 s"); the Link buff's own data says 15 s. Her combo opens on a
Final Strike by the controlled operator on an enemy with Physical
Susceptibility, which her battle skill gives for 12 s.
**How:** on a training dummy, count the big damage numbers of her
ultimate (its hits come about 2, 4 and 6 s after the cast). Cast her
battle skill before the combo, never between the combo and the ultimate
(a battle skill would use the Link up).
1. With no combo in the last 20 s: 2 numbers.
2. Right after her own combo: 3 (the third about 1.5× the others).
3. Right after only Estella's combo (or anyone's but Camille's): 2 (data,
   engine); 3 would mean every combo gives Link (the old rule).
4. Her combo, then her ultimate 17–18 s later by stopwatch, with nothing
   cast in between: a third hit means the Link lasts 20 s (engine); none
   means 15 s.

### 79. Yvonne's talent 1: how long the next basic attack stays a Final Strike (ready, if you have Yvonne and a Cryo or Nature teammate)

**Why:** when her battle skill's bomb Solidifies an enemy, talent 1 turns
her next basic attack into her Final Strike (attack 5) for up to 15 s. The
data does it by remapping the basic-attack button; the engine keeps the
remap for the buff's whole 15 s. The remap's own setting says 0.5 s, which
would make it hard to use. Each such Final Strike also lights her combo
(a Final Strike on a Solidified enemy).
**How:** a teammate applies Cryo or Nature Infliction to a dummy; Yvonne's
battle skill Solidifies it. Control: press basic attack at once after the
bomb: one big shot (the Final Strike, about 2.4–3.5× attack 1's number),
and her combo lights. Then repeat, but wait about 3 s after the bomb (no
input) before pressing basic attack once:
- one big shot and the combo lights: the remap lasts the buff (engine);
- a small attack 1 shot and the combo stays dark: it lasts 0.5 s.

### 80. Home Longing: the next battle skill, or every one for 20 s? (ready, if you have Home Longing on Yvonne or another Cryo or Nature handcannon user)

**Why:** after the wielder's combo, Home Longing gives her "next battle
skill" Cryo and Nature DMG +22.4% (level 9) for 20 s. Nothing in the data
ends it at a battle skill, so the engine applies it to every Cryo or
Nature battle-skill hit for the 20 s.
**How:** with Yvonne: light her combo as in test 79 and cast it; after
that the dummy has no infliction left, so her bombs deal their plain
damage. Then two battle skills within about 10 s, then a third more than
20 s after the combo, with no combo in between and no teammate's Cryo or
Nature hit on the dummy. Compare the three bombs' non-crit numbers
(repeat the run if one crits):
- the first and second equal, both about 1.1–1.15× the third (her other
  DMG bonuses set the exact step): every battle skill for 20 s (data,
  engine);
- only the first above the other two: the next battle skill only (the
  description).

### 81. Last Rite's Hypothermia from a reaction (ready, if you have Last Rite with talent 1)

**Why:** talent 1 gives the enemy Cryo Susceptibility (Hypothermia: 4% per
stack, 15 s) when Last Rite consumes Arts Infliction. Her combo consumes
Cryo stacks; her Mirages' Cryo can also turn another element's infliction
into a reaction, which consumes it too. The engine counts that (batch 4,
A1); if the game doesn't, Hypothermia comes only from her combo. OBJ
Velocitous has the same question.
**How:** a Heat (or Electric, Nature) teammate applies an infliction to a
dummy and stays controlled. Last Rite casts her battle skill off-field (her
perfusion goes on the team). The teammate's next Final Strike brings her
two Mirages, whose Cryo turns the infliction into Solidification. Don't
cast her combo. Is there a Cryo Susceptibility icon on the dummy? Yes: a
reaction's consumption counts (engine). No: only her combo's.

### 82. Last Rite's battle skill inside her own chain (ready, if you have Last Rite)

**Why:** pressed while she's controlled and early in a basic attack, her
battle skill runs beside the attack (the description: it "does not reset
her basic attack sequence"), so the chain goes on as if nothing happened.
The engine follows the data since 2026-10-21 (batch 4, C4). If the game
holds her like an ordinary skill, each such cast costs her about 1 s of
her chain.
**How:** Last Rite controlled on a dummy, SP bar full (three casts).
Keep pressing basic attack and time from the first basic attack to the
fourth Final Strike (attack 4):
1. four plain chains;
2. four chains, pressing her battle skill early in attack 2 of each of
   the first three.
The same time: the cast runs beside the attack (data, engine). About 3 s
longer in run 2: it interrupts her like an ordinary skill. Also, in run 2:
does attack 2's second hit still show its damage number? Data and engine:
yes.

### 83. Last Rite's Mirages after a swap (ready, if you have Last Rite)

**Why:** her battle skill gives every team member a perfusion for 15 s;
each member's first Final Strike while controlled brings two Mirages (3.84
× her ATK in all at P5, and a Cryo stack) and ends that member's perfusion
only. The engine follows the data. The description speaks only of "the
controlled operator", which could mean one use for the whole team.
**How:** operator X controlled; Last Rite casts her battle skill off-field.
Swap to Y at once and finish Y's chain: Mirages on Y's Final Strike? Swap
back to X and finish X's chain within the 15 s: Mirages again?
- both times: each member's perfusion acts once (data, engine);
- only on Y: one use for the whole team;
- only on X: only the operator controlled at the cast has it.

### 84. Tangtang's own Haste (ready, if you have Tangtang with talent 1)

**Why:** talent 1 gives allies within 5 m of her Whirlpool Haste (10% /
20%), and for 3 s after they leave. The data excludes the aura's "owner",
which may be the Whirlpool or Tangtang herself. The engine gives the Haste
to the whole team, Tangtang included. What Haste speeds up is test 19.
**How:** light her combo (a teammate's Cryo hit does it) and cast it on a
dummy: a Whirlpool appears. Stand Tangtang in it: does the Haste icon show
on her? Then swap to a teammate standing in it: on the teammate? Engine:
both.

### 85. Rapid Ascent against a Staggered enemy (ready, if you have Rapid Ascent on any sword user)

**Why:** the description gives battle skills and ultimates DMG +98%
(level 9) against Staggered enemies. The data's condition has only "the
target is Staggered", with no skill-type check, so the engine gives it to
every hit. Basic attacks tell the two apart.
**How:** on a dummy, compare basic attack 1's non-crit number before a
Stagger with one during it:
- about ×1.3 during the Stagger (the Stagger's own DMG taken): the
  description;
- about ×2.2–2.6 (×1.3 × (1 + 0.98 / (1 + the hit's DMG bonus)); about
  ×2.2 for attack 1 of examples/laevatain-umbral-torch.json with Rapid
  Ascent instead): the data (engine).
A battle skill shows the bigger step in both readings.

### 86. Rossi's combo cooldown, with and without sequence 2, and the perfect timing (ready, if you have Rossi)

**Why:** sequence 1 of her combo opens a 6 s window for sequence 2. The
data starts the combo's full cooldown (14 s) when sequence 2 is cast, or,
if it isn't, when the 6 s window ends. The engine follows that since
2026-10-21 (batch 4, S2); a cooldown from sequence 1 would give 14 s
either way. A ring also shows briefly during sequence 1 (about 1.7 s in,
for under half a second): sequence 2 pressed inside it takes a "perfect"
path that adds one more Vulnerable stack. The engine has both paths;
searches don't yet aim for the ring (owner item 3 of batch 4).
**How:** her combo opens on an enemy with both Vulnerable stacks and an
Arts Infliction.
1. Stopwatch from sequence 1 until the combo button is ready again:
   (a) with sequence 2 at once: about 15 s; (b) without sequence 2: about
   21 s (data, engine), or 14 s if the cooldown runs from sequence 1.
2. On a dummy with one Vulnerable stack and an Arts Infliction: sequence 1,
   then sequence 2 inside the ring; again on a fresh dummy, with sequence 2
   about a second after the ring. The Vulnerable counter rises by 2 with
   the ring (her Lift and the extra stack) and by 1 without (engine).

### 87. Zhuang Fangyi's Sunderblades (ready, if you have Zhuang Fangyi)

**Why:** each battle skill creates a Sunderblade (more when it consumes
Electrification), then every Sunderblade around deals a Thunder Strike
(the last a big one). The engine lets the blades a cast creates strike in
that same cast, and gives each blade its own 36 s timer (46 s at P3). If
new blades aren't ready in time, every cast deals one strike fewer; with
one shared, refreshed timer, old blades last longer.
**How:** on a dummy, with no Electric teammate (no Electrification); a
phone video helps with counting.
1. Four battle skills about 5 s apart; count the Thunder Strike numbers of
   each: 1, 2, 3, 3 (engine; 2, 3, 3, 3 from P1); 0, 1, 2, 3 if new blades
   don't strike in their own cast.
2. Battle skills at 0, 10 and 20 s by stopwatch, then a fourth at 50 s:
   2 strikes on the fourth (own timers: the 0 s and 10 s blades are gone;
   engine) or 3 (one shared timer, refreshed by each cast). At P3, cast
   the fourth at 60 s instead.

### 88. Zhuang Fangyi's Empyrean state (ready, if you have Zhuang Fangyi)

**Why:** her ultimate gives her the Empyrean of Truth for 25 s: her first
battle skill in it costs no SP, and her combo's cooldown runs 5 times
faster (the description says 4: 3.4 s or 4.25 s of the 17 s, too close
to tell by hand). The data also has a listener that may end the state
early, perhaps on a swap. The engine follows the first two since
2026-10-21 (batch 4, S4, S5) and never ends the state early.
**How:**
1. Spend the SP bar to empty, cast her ultimate, then her battle skill at
   once: castable at once, with its Sunderblades (engine), or does it wait
   for SP (about 12 s)?
2. In the state: a battle skill (its last strike inflicts Electric), the
   three-hit chain, then her combo; repeat the battle skill and the chain
   at once. Is the combo ready again about 4 s after the first one
   (engine), or only after about 17 s?
3. Cast her ultimate, swap to a teammate about 5 s later, and back 3 s
   after that: does she still have the Empyrean (its icon, the enhanced
   attacks; engine), or is it gone?

### 89. Zhuang Fangyi's talent 1 over one cast (ready, if you have Zhuang Fangyi with talent 1 at level 2+; needs nine Sunderblades)

**Why:** talent 1 gives her Electric Amp with each battle skill and
raises it by 2% before each Thunder Strike. The engine adds the raises up
over the cast, so the eighth small strike is about 1.12× the first (Amp
1.20 → 1.34). If each strike gets only one raise, they're equal.
**How:** a battle skill with 9 Sunderblades (in her Empyrean, after a
couple of battle skills that consumed Electrification; the strike count
shows it), recorded with a phone. Compare the first and the eighth small
strike's non-crit numbers: about 1.12×: the raises add up (engine). Equal:
they don't.

### 90. Mi Fu's combo trigger: a state? (ready, if you have Mi Fu at P1+ and a teammate who adds Vulnerable without Crush or Breach)

**Why:** her combo opens "when an enemy has 3 or more Vulnerability
stacks". The engine opens a 6 s window each time a stack is added at 3 or
more, and ignores stacks added during the cooldown (batch 3 T5, test 60).
If the game treats it as a state, the button lights again when the
cooldown ends while 3+ stacks remain, and goes dark when a Crush consumes
them. One combo more or less per Vulnerable build-up.
**How:** the teammate adds the stacks (Da Pan's battle skill and ultimate,
Chen or Estella).
1. Bring a dummy to 3 Vulnerable stacks, cast her combo as soon as it
   lights, then add no stacks and don't Crush (Vulnerable lasts 20 s from
   the last stack; her cooldown is 17 s at P1+). Watch the button: lit
   again about 17 s after the combo (a state), or dark until a new stack
   (engine)?
2. Bring the dummy to 3+ stacks (the combo lights) and don't cast it; cast
   Cloudtrapper, then Trail and Mangle at once (its Crush consumes the
   stacks). Does the button go dark at the Crush (a state), or stay lit
   until about 6 s after it lit (engine)?

### 91. World Splitter's damage type (ready, if you have Mi Fu)

**Why:** "this DMG is not treated as Battle Skill DMG, but as Crush DMG":
the engine gives World Splitter no Battle Skill DMG bonus. Its multiplier
also has a factor from a table we don't have (`yuanshi_multi`, taken as
1).
**How:** below P5, without Amaranthine Tassel, Grizzled Edge or Ancient
Canal, ideally with some Battle Skill DMG on her panel (gear or weapon). A
teammate brings a dummy to 3 Vulnerable stacks without Susceptibility or
Stagger (no Mi Fu or Estella combo). Then Cloudtrapper, Trail and Mangle,
World Splitter. Compare World Splitter's number with Cloudtrapper's, the
lower of two tries each (crits):
- 4.0 × (1 + p) / (1 + p + b), with p her Physical DMG and b her Battle
  Skill DMG from the panel (e.g. 3.25 with 30% each): no Battle Skill DMG
  on it (engine);
- 4.0: it takes the Battle Skill DMG bonus;
- anything else: the table's factor isn't 1.

### 92. Long Heritage and Si's Amp (ready, if you have Si with Long Heritage)

**Why:** Long Heritage gives the team Arts DMG +11.2% for 20 s when an Amp
the wielder gives, one reaching Cryo, reaches a teammate. Si's ultimate
gives the team Cryo and Heat Amp. The data's check lists one Cryo Amp by
name and the all-Arts Amps by a tag; which of the two the game reads
(batch 4, T1) decides whether Si's Amp counts. The same reading decides
checks in Grand Vision and Glorious Memory.
**How:** Si with Long Heritage and a teammate: cast Si's ultimate. Does
the weapon's team Arts DMG icon appear on the teammate? Yes: Si's Amp
counts (engine). No: only all-Arts Amps count.

### 93. Camille's talent 2 from a teammate's heal (ready, if you have Camille and Liino)

**Why:** talent 2 gives Camille two layers of Heat DMG (+4% each at talent
level 2, up to 5 layers, 40 s), and each teammate a quarter of that, each
time she receives a skill heal. The data reads heals she receives from
anyone, and the engine follows the data. The description ("Whenever
Camille restores HP via a skill") could mean only her own heals. With
Liino's soundwaves in the team that's 5 layers all the time (Heat DMG +20%,
+50% at P5), or 2 per Camille combo.
**How:** Camille and Liino in the team, Camille's combo not cast. Liino's
battle skill (its soundwaves heal every 3 s): does Camille's Heat DMG icon
appear with 2 layers at the first soundwave and show 5 within about 6 s
(engine)? Or does it stay away until Camille's own combo?

### 94. Thermite Cutter's Link half (ready, if you have Thermite Cutter and Lifeng or Camille; low priority)

**Why:** Thermite Cutter gives the team ATK (+14% at level 9, 20 s, up to 2
layers) "after the wielder's skill recovers SP or grants a Link state".
In the data the second half fires when a Link stack reaches the wielder.
The engine models only the first half (SP from the wielder's own skills),
so a Link source in the team gives nothing. Few teams have both.
**How:** Thermite Cutter on a sword user (e.g. Laevatain) who casts no
skill during the test, so the SP half stays quiet (Final Strike SP doesn't
count). Then a Link source: Lifeng's combo (her battle skill first, then
the wielder's Final Strike opens it), or Camille's combo on a dummy with
hovering Vesperwings (test 8). Does Thermite Cutter's team ATK icon
appear? Engine: no. Yes: a Link stack the wielder receives counts.

### 95. A third Whirlpool (ready, if you have Tangtang at P1+; low priority, tedious)

**Why:** each combo of Tangtang's leaves a Whirlpool for 30 s. The data
counts at most 2 (a third replaces the oldest) but never removes the
oldest one from the ground, and her battle skill, which consumes the
Whirlpools and refunds SP, has no refund for 3. The engine: 2 Whirlpools
and the refund (50 SP at P1+, a sixth of the bar).
**How:** three combos about 10 s apart without a battle skill
(teammates' Cryo hits light her combo; P1's 10 s cooldown allows it).
Count the Whirlpools on the ground: 2 or 3? Then her battle skill: does
the SP bar jump up by about a sixth (engine), or not (3 Whirlpools, no
refund)?

### 96. Ardelia's Wooly Party hits on one enemy (ready, if you have Ardelia; low priority, tedious)

**Why:** her ultimate throws about 20 sheep a second, and each enemy takes
at most one hit per 0.3 s. Whether the cap is reached depends on how many
land near the enemy. The engine assumes it is: 11 hits below P3, 14 from
P3 (more than half of her damage in the example). If a large enemy takes
only about 6, her ultimate is about 45% lower.
**How:** below P3, record her ultimate on a large dummy with a phone and
count the Wooly Party damage numbers: 10–11 (engine: 11) or clearly fewer.
A log settles it better.

### 97. Dive attacks: their pace and what a jump can do (ready, any operator; higher priority: the search now uses dives)

**Why:** the engine now lets rotations dive (jump, then attack in mid-air:
the landing deals the damage). How fast a jump and fall are isn't in the
game data; the engine takes it from another simulator (Endaxis): the
landing comes about 0.73 s after the jump. Searches now put dives into
rotations (e.g. three in Si + Laevatain, +4.5%), so these assumptions
change which rotations are found.
**How:** with Laevatain (any operator works), on a dummy:
1. **Pace (stopwatch):** standing still, jump and attack at once, ten
   times in a row as fast as the game allows. Time from the first jump to
   the tenth landing. Engine: **about 11.3 s**. If the hover before the
   fall lasted the start animation's full second, about 14.6 s.
2. **Jump cancels a skill (by eye):** right after her battle skill's hit,
   press jump. Does she jump at once (engine: yes, any skill can be cut
   by a jump), or only after the skill's animation ends?
3. **No dash in the air (by eye):** press dodge while falling. Engine:
   nothing happens until the landing.
4. **Swap in the air (by eye):** swap while falling. Does the swapped-out
   operator's landing still show a damage number? Engine: yes.
5. **Chain after a dive (by eye):** in the middle of her basic-attack
   chain, dive, then attack again: is it attack 1 (engine: the dive clears
   the chain) or the chain's next step?

### 98. Food buffs on the stat panel (ready, any operator; a few minutes)

**Why:** builds can now hold a food buff (UseItemTable: one per operator,
300 s). The engine puts a food's stats into the operator's stat panel the
way gear lines go in. Three of its formula slots aren't verified: flat ATK
(Ginseng Meat Stew, +180), points of all four attributes (Pear Blossom Tea,
+27), and DEF +x% (Bottled Milk, +19.3%), whose formula the engine doesn't
know at all (it leaves it out and refuses to compute a kit value that reads
DEF, e.g. Catcher's P1 strike).
**How:** on one operator, note ATK, DEF, the four attributes and Crit Rate
on the stat panel; then eat the food and look again (if the panel doesn't
change, a basic attack's damage number on a dummy before and after works
for ATK).
1. **Ginseng Meat Stew:** engine: Crit Rate +11.4 points, and ATK up by
   180 × the attribute multiplier (for the Endministrator in
   `examples/endministrator-p5.json`: 2,367 → 2,965). If ATK rises by only
   180, the flat slot comes after the attribute multiplier.
2. **Pear Blossom Tea:** engine: Strength, Agility, Intellect and Will
   each +27, and ATK up by what 27 more main and secondary attribute give
   (that example: 2,367 → 2,502).
3. **Bottled Milk:** DEF +19.3% of what? With DEF all from gear (the
   Endministrator's base DEF is 0; that example's 140): **140 → 167** if
   it's a percentage of the whole DEF, **unchanged** if of the operator's
   own base DEF.

## Results

None yet.
