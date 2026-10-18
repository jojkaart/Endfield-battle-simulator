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

### 8. Link stack values (ready)

**Why:** Link (a teammate's combo skill boosting the next battle skill or
ultimate) is found in the data, but its per-stack values aren't in the
tables we have. One log shows +20% for one stack on Gilberta's ultimate.
**How:** on a training dummy, one operator's ultimate (Gilberta's is a
single hit) cast: with no combo skill before it; after one teammate's
combo; after two or three teammates' combos. Screenshots of the ultimate's
damage number each time (no crits, same buffs otherwise).

### 9. Typhoeus's burst with and without a Nature infliction (ready, if you have Typhoeus)

**Why:** his enhanced floating shot's own Nature burst appears to deal
×1.3 more when the target already has a Nature infliction for the arrow to
consume (`enchence_burst_damage_rate`), seen in one log only.
**How:** on a training dummy: one enhanced floating shot on a clean dummy,
then one right after a teammate applied a Nature infliction (Gilberta's
battle skill or ultimate). Screenshots of the burst's damage number both
times (no crits).

### 10. Si's combo by stacks consumed (ready, if you have Si)

**Why:** her combo's final hit should be `atk_scale2 + n × atk_scale2_1`,
n = the infliction stacks consumed by the trigger (+1 at P5). The engine
can't count n yet; the numbers would confirm the rule before it's built.
**How:** trigger her combo after consuming 1, then 2, then 3 stacks of Cryo
or Heat Infliction (e.g. a reaction onto 1–3 stacks); screenshot the final
hit each time (no crits).

### 11. Estella's combo on a target that isn't Solidified (ready, if you have Estella)

**Why:** on a Solidified target it uses the larger `atk_scale2` and applies
Physical Susceptibility; otherwise the smaller `atk_scale`, without
Susceptibility. The model assumes the target is still Solidified.
**How:** with her combo window open, wait until Solidification ends (about
6 s after a level I Solidification), then cast the combo; compare its
damage with a cast right after Solidification, and check for the Physical
Susceptibility icon.

### 12. Gilberta's Arts Susceptibility value and duration (ready, if you have Gilberta)

**Why:** the data says her ultimate's Arts Susceptibility is `rate` × 1.2
from potential 2 (0.36 at ultimate level 10–12) and the plain rate below
(0.30), for 5 s; one log showed 0.36 at P3, another 0.30 at P1.
**How:** her ultimate on a training dummy with no physical teammates; read
the Arts Susceptibility value on the enemy and time how long it stays.

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

### 15. Swapping during a battle skill (ready, if you have Gilberta)

**Why:** the data forbids switching for the first 3.7 s of Gilberta's
battle skill (`cantSwitchPosition`); the engine now lets you swap at any
other moment, even mid-skill, and the skill goes on. Whether the game
agrees decides how fast swap-heavy rotations are.
**How:** cast Gilberta's battle skill and press another operator's swap
key at once, holding it: note roughly when the swap happens (about 3.7 s
expected). Then try swapping during one of her basic attacks: it should
swap at once, and the attack's hit should still land.

### 16. Does a skill cancel the basic attack it interrupts? (ready)

**Why:** the engine assumes a battle skill, combo or ultimate can start at
any moment of a basic attack and cancels the attack's hits that haven't
landed (except projectiles). If the hit lands anyway, the engine
under-counts damage and SP for players who cancel early.
**How:** with any operator whose 5th basic attack (Final Strike) is a
melee hit, start the 5th attack and press the battle skill immediately:
does the Final Strike's damage number (and its SP) appear?

### 17. Basic attack after Laevatain's battle skill during Twilight (ready)

**Why:** the data says her enhanced attacks may start only 115 frames
(3.8 s) after the enhanced battle skill, and Twilight pauses for that
time. The old engine let the attack start after 1.1 s.
**How:** in Twilight, cast the battle skill and mash basic attack: time
from the battle skill to the first enhanced attack (3.8 s expected), and
whether Twilight's remaining time stays the same meanwhile.

## Results

None yet.
