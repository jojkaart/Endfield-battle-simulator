## 2026-11-26: Slots and paths by value: Hunter Pursuit, Pogranichnik's combo and his bank

**Goal:** a cast's logged hits paired to its kit hits by value where time and keys don't decide (9c0b's Hunter Pursuit,
7910's rogue wave); Pogranichnik's SP-driven team buffs (Thermite Cutter, Fervent Morale) behind Chen's, Lifeng's,
Pogranichnik's and the Endministrator's fallbacks; if time, 9c6e's Liino combo on two enemies (open-problems "Fight
totals" round 5, "Low plain, low mismatch").

**Done:**
- **Slots by value** (logcasts.ts realignByValue): a cast's landings of a key fewer than its slots, the slots'
  multipliers apart by more than ×2, take the slots their values fit under one scale, then by world time; the first
  slot moves only for a key that is its cast's only one, by values or by the landings no other stop separates (by time
  alone it moved 7910's stares across Liino's stops). 9c0b's Hunter Pursuit is hits 2–4 (its Link before Arcane's
  ultimate), db87's Camille ultimate hit_2 / hit_3, a27b's Mi Fu, 00ae's Arcane lasers.
- **Neither of Pogranichnik's buffs reads the team's SP.** Thermite Cutter was right: its `other values` are the
  listing (once per application), the hits' values fit the replay's two layers. Fervent Morale's bank was double-fed:
  his combo's slashes, pinned to the 4-stack path's frames by kit order, landed beside the 3-stack path the replay took.
  Now a landing in a taken state jump's skipped part goes onto the jumped-to path (engine paths.ts takenPathLandings),
  and the values choose the path where they alone fit (castassembly.ts valuePaths, replayCast kitJumps; PATH lines).
  c4f3's first layer 15.97 → 34.03 s (log 34.04 s).
- **A Breach's Arts Intensity after its hit's before-damage triggers** (landing.ts): the data's SP comes before the
  FractureAction, so the layer the SP makes counts for the Breach (alone: d4fb plain 516 → 837 on the old bank).
- **A second enemy's landing by value** (logcasts.ts sameByValue): 9c6e's Liino combo at 47.72 s; 40d9 unchanged.

**Scoreboard** (`npm run snapshots:update`): development plain 72.7 → 73.8%, mismatch 10.6 → 10.5%, mean |damage
error| 6.3 → 6.1%; hold-out unchanged; earlier pending plain 73.0%, 3.5%. Pogranichnik 41.9 → 52.1% plain (total error
5.0 → 2.8%), Chen 38.8 → 43.0%. Better 9c0b, db87, a27b, 7b54; mixed 9c6e (plain 175 → 202, −13.5 → −13.9%), a9d7 (177 →
265, −2.2 → −3.3%: the doubled slashes had hidden Chen's −3.2% and Estella's −7.0%), c4f3 (223 → 275, −2.9 → −3.4%),
d4fb (−0.4%: 86.67 s, the bank 0.3 s late in the replay); worse 7910 0.0 → −0.2% (its 352,792 is the early rogue
wave by value, ×17.5 a stare, with no dive logged: matched to the plain wave now). team-ab: unchanged.

**Decisions:** none of it an assumption: the values' ratios are ×2–17 apart where they decide, and each rule acts only
where they do. landing.ts is outside the brief's file list (not status.ts or the buffs): named for the lead.

**Left:** the Vulnerable stacks a Breach consumed read from the next combo's path (c4f3 13.07 s: three in the replay,
four in the game), the harasses' Fervent Morale on whom (c4f3 68.83 s), 7910's early wave.
