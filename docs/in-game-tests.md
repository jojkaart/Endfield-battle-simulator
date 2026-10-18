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
burst?) resets it.

### 6. Liino's ultimate (ready)

**Why:** the only log of it (ZMDLogs parser v58) implies each of the 20
small projectiles deals 2 × the ultimate's `atk_scale`, which the data
doesn't explain, and it doesn't record her own ultimate buffs.
**How:** Liino alone against a training dummy (no teammates' buffs, no
Arts reactions): her stat panel (ATK, Will), ultimate level, and the
damage numbers of one ultimate, ideally recorded with the ZMDLogs client.

### 5. Reaction bonus grouping (later)

**Why:** whether "Arts Reaction DMG" bonuses add to element bonuses or
multiply separately.
**How (planned):** a Combustion hit with one bonus, the other, and both.

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

## Results

None yet.
