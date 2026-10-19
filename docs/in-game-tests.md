# In-game tests

Tests the owner could run while playing, to settle questions only the game
can answer. Each should be simple and take a few minutes. Claude keeps this
list current and mentions new **ready** tests to the owner; results go in
the "Results" section with the date and game version, then into fixtures or
[data-sources.md](data-sources.md).

Status: **ready** (worth doing now), **later** (waits on the engine or on
choosing a setup), **done**.

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

### 8. Link stack values (ready)

**Why:** Link (a teammate's combo skill boosting the next battle skill or
ultimate) is found in the data, but its per-stack values aren't in the
tables we have. One log shows +20% for one stack on Gilberta's ultimate.
**How:** on a training dummy, one operator's ultimate (Gilberta's is a
single hit) cast: with no combo skill before it; after one teammate's
combo; after two or three teammates' combos. Screenshots of the ultimate's
damage number each time (no crits, same buffs otherwise).

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
the Arts Susceptibility value on the enemy and time how long it stays.
Then repeat with 1, 2, 3 and 4 Vulnerable stacks on the dummy (from Lift or
Knock Down; her own combo's Lift gives one). Expected at ultimate level 12
below P2: 0.30, 0.33, 0.36, 0.39, 0.42 for 0–4 stacks. From P2: 0.36, 0.42,
0.48, 0.54, 0.54. A 0.48 at 3 stacks from P2 would mean the data's check is
"fewer than 3", not "3 or fewer".

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
The same 3.7 s of the data also forbid her casting another skill
(`cantCastSkill`); the engine now holds all of her casts until it ends,
ultimates included (the data doesn't say whether they're an exception).
So also: with her energy full (or her combo just lit by a reaction), press
her ultimate (or combo) right after the battle skill. Does it start at
once, or only after about 3.7 s? Does a teammate's combo still fire
meanwhile? Liino's stance has the same question (test 28).

### 16. Does a skill cancel the basic attack it interrupts? (ready)

**Why:** the engine assumes a battle skill, combo or ultimate can start at
any moment of a basic attack and cancels the attack's hits that haven't
landed (except projectiles). If the hit lands anyway, the engine
under-counts damage and SP for players who cancel early.
**How:** with any operator whose 5th basic attack (Final Strike) is a
melee hit, start the 5th attack and press the battle skill immediately:
does the Final Strike's damage number (and its SP) appear?

### 17. How long Laevatain's battle skill holds her (ready, if you have Laevatain)

**Why:** her battle skill's data has jumps: the timeline skips ahead, on
one path when she has 4 Melting Flame (empowered) and on another when
not. The engine plays every frame, so her enhanced battle skill locks her
and pauses Twilight for 115 frames (3.8 s). If the jumps skip time, it's
39 frames (1.3 s) plain and 64 (2.1 s) empowered; outside Twilight, the
plain battle skill locks her 37 frames, not 117, and the empowered extra
hit lands at frame 54, not 104. That's 1.7–2.5 s of rotation time per
battle skill, and every buff window after it moves.
**How:** a 30 FPS video is easiest. In Twilight, cast the battle skill and
mash basic attack: time from the battle skill to the first enhanced
attack, plain and with 4 Melting Flame. 1.3 s / 2.1 s means the jumps skip
time; 3.8 s both times means they don't. Also note whether Twilight's
remaining time stays the same meanwhile. Outside Twilight: plain battle
skill, then mash basic attack: about 1.2 s or 3.9 s to the next action?
And with 4 Melting Flame, the time from the cast to the extra hit: about
54 frames (1.8 s) or 104 (3.5 s)?

### 18. What an ultimate's time stop freezes (ready)

**Why:** the engine now freezes everyone but the caster for an ultimate's
time stop (Laevatain's first 2 s, Gilberta's 1.7 s): the enemy's statuses
and Combustion ticks, all buffs, combo windows and SP regen, but **not**
skill cooldowns (Endaxis's rule, from its unit tests only).
**How:** put a teammate's battle skill on cooldown, note the remaining
seconds, cast an ultimate with a long animation, and read the teammate's
cooldown right after: did it go down by the animation's length (cooldowns
run) or not (frozen)? Also: does the team SP bar move during the
animation?

The caster's own buffs are a second question. The engine freezes them too,
but the data exempts the caster from its own time stops and slow-downs,
and one Estella log fits neither rule cleanly. It decides up to 2 s of
Twilight per ultimate and up to 1.8 s of Estella's team-wide Physical
Susceptibility (+15%) per ultimate:
- Laevatain: does Twilight's timer stop during her ultimate's 2 s
  animation, and during her combo's 0.6 s slow-down?
- Estella (P1+): combo on a Solidified enemy, her ultimate right after,
  and time the Physical Susceptibility icon from the combo hit: about 9 s
  means her own time stop doesn't freeze it, about 10.8 s means it does.

### 19. What Haste speeds up (ready, if you have Si)

**Why:** Si's talent gives the team Haste (`ratio_speed` 15% / 30%) for
5 s after her Inksoul ends. The data says only "speed +x" (attribute 92);
the engine assumes it plays skills faster (hits, cancel windows, the
locked part) but not cooldowns. Nobody's simulator models it yet.
**How:** with the Haste up, record a teammate's basic attack chain (or
time five basic attacks) and compare with the same chain without it: is
it about 15% / 30% faster? Does a skill's cooldown run faster too?

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
time"), and, once her new kit is in, for an enhanced battle skill's pause
only until the skill ends: a combo that cuts the skill short ends the
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
level 2) for 20 s. The engine starts the window only when she reaches 4.
Whether a gain while already at 4 (her empowered cast's own explosion)
restarts it is unknown: up to 15 s more of the RES ignore per cast.
**How:** reach 4 Melting Flame, wait 15 s, then cast the empowered battle
skill. Watch the Scorching Heart icon: does its 20 s start again, or does
it end about 5 s later as before?

### 23. Laevatain's P1 SP (optional confirmation, if you have Laevatain at P1+)

**Why:** the data gives P1's +20 SP only on the empowered extra hit, so a
plain battle skill gives none. The engine follows the data.
**How:** note the team SP, cast a plain battle skill, read SP again; then
the same with 4 Melting Flame. Expected: 0 back for the plain one, 20 for
the empowered one.

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

### 29. Do sub-skills count as a battle skill? (ready, if you have Si or Liino)

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
- After a teammate's combo (Link up), cast Si's Initial Stroke: is Link
  used up?
- Liino: with Link up, cast End Stance, then her battle skill: does the
  battle skill still get the Link bonus? And after her combo (talent 2
  active), cast End Stance: is SP returned? And in Vocalist Stance, cast
  her combo: when the stance's action resumes after it (the game casts it
  by itself), is Starry Boost used up?
- Typhoeus with Wild Wanderer (if you have it): cast only her ultimate and
  let the hover end by itself (no input): does the weapon's Arts
  Intensity buff appear again as the hover ends? Her hover's idle and end
  steps are battle-type sub-skills too.

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
(14.4 × ATK in INT). Separately, the engine adds 8 SP to each of her
finishers from a data default that may not be real.
**How:** inside her array, stagger the enemy and finish it with the
controlled operator: do the four lasers come? Does a finisher plus a Final
Strike within 0.4 s count once or twice? And with Arcane controlled, her
finisher on a Staggered enemy: note the team SP before and after. Is it
the enemy's finisher SP alone, or 8 more?

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
once: is a Cryo burst shown at the touch, and whose damage number is it
(hers, or later on a teammate's hit)? (2) A teammate applies Cryo (opening
the window), then a Heat hit consumes it (Solidification), then Arcane's
combo: does the touch apply Cryo (the trigger's element), nothing, or
Heat?

### 34. Arcane's INT combo without the battle skill (ready, if you have Arcane; lower priority)

**Why:** when her INT Imprisonment ends on its own (one explosion), the
next battle skill on that enemy gives SP and a second explosion. The data
suggests no lasers then (the clone that fires them is gone); the engine
gives none.
**How:** Intellect ≥ Will. Combo, let Imprisonment end (one explosion),
then her battle skill on the same enemy within a few seconds: does it give
SP, a second explosion, and lasers?

### 35. Combo windows opened by a reaction (ready, if you have Gilberta or Arcane)

**Why:** two open questions about the same moment. Gilberta's combo opens
on any Arts Reaction; the engine also opens it when her own battle skill
causes the reaction. Arcane's combo opens on an infliction; the engine
doesn't count an infliction that turns into a reaction at once. Each is
one combo more or less per such reaction.
**How:** a Heat teammate applies Heat Infliction to a dummy; then a Nature
hit forms Corrosion (Gilberta's battle skill explosion if you have her,
otherwise any Nature skill). Is Gilberta's combo button lit? Is Arcane's
(both INT and WILL modes, if you can)?

### 36. Cooldowns cut by a percentage (ready, if you have Typhoeus, or Arcane at P5)

**Why:** one data action sets a cooldown by a fraction, and its meaning is
unclear. Arcane's P5: casting her second ultimate in WILL mode cuts her
combo cooldown by 30%: 5.4 s off the full 18 s, 30% of what's left, or
"set to 30% of full"? Typhoeus's two combos use the same action with 1.0
for their shared cooldown, which only works as "set to 100% of full".
That's about one earlier Arcane combo per second ultimate.
**How:**
- Typhoeus: cast one of her combos, then look at the other: is it on the
  full cooldown too (engine)?
- Arcane at P5, Will > Intellect: note the combo's remaining cooldown, cast
  the second ultimate, read it again. 5.4 s off, 30% off what was left, or
  5.4 s left? Repeat with Intellect ≥ Will (data: no cut).

### 37. Enemy timers while Imprisoned or Immobilized (ready, if you have Si or Arcane)

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
- Si, on a normal enemy and then on a boss: cast her battle skill and time
  Artful Intent's icon and Jade Vessel's DMG-taken icon. 20 s and 30 s plus
  the Immobilization (31–31.5 s) where the freeze works; flat 20 s and
  30 s where the enemy is immune.
- Arcane: a teammate applies a timed status to a dummy (Electrification,
  or her own Corrosion), then Arcane's WILL combo: does the status run out
  later than without the combo, by about 2–3 s?

### 38. Two Arts Susceptibility sources (ready, if you have Gilberta and Ardelia)

**Why:** the engine adds two sources of Arts Susceptibility on one enemy.
The game may count only the larger. With both up, the team's Arts damage
is off by the smaller one (Gilberta's alone is 0.30). Estella's
Physical Susceptibility has the same open question.
**How:** Gilberta's ultimate and Ardelia's battle skill on one dummy:
read the Arts Susceptibility value (or a teammate's Arts hit) with each
alone and with both: the sum or the larger?

### 39. Swordmancer's extra hit (ready, if you have 3 Swordmancer pieces)

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

### 47. Projectile travel and Typhoeus's burst delay (ready; lower priority)

**Why:** the engine lands projectile hits at their launch frame; the data
has no travel time. Typhoeus's Power Shot burst shows up about 0.3 s after
the arrow in the logs: travel, or a delay of the burst itself? Small for
damage (0.1–0.4 s), but once bursts land later than arrows, her Hail of
Arrows count must ignore them.
**How:** a slow-motion clip of one Power Shot: is the burst number about
0.3 s after the arrow's, and does the gap change with distance (travel) or
not (a burst delay)? The same kind of clip of Laevatain's 4th basic attack
or Estella's battle skill would show their travel too.

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
**How:** note team SP; her combo on a Solidified enemy (Shatter), then her
battle skill: SP should end at before − 100 + 15. A second battle skill
without a Shatter: −100 only. Then a teammate's Shatter (their Lift on a
Solidified enemy), then her battle skill: −100 only, if the data is right.

### 50. Estella's P5 energy (ready, if you have Estella at P5)

**Why:** at P5 she gains 5 energy whenever an enemy is Solidified, at most
once per 1 s. The data says anyone's Solidification counts, and the engine
counts re-Solidifying an already Solidified enemy too.
**How:** with nothing else giving her energy, let a teammate cause
Solidification: +5 means anyone's counts. Then re-Solidify an enemy that
is already Solidified: +5 again means a refresh counts. Two within 1 s: +5
once.

### 51. Does an effect a hit triggers count on that same hit? (ready, if you have Arcane with Solemn Phalanx, or Hot Work)

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

## Results

None yet.
