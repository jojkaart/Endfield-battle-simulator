## 2026-11-28: The clock through overlapping combo slow-downs; layered buffs on their own timers as clocks

**Goal:** two leads: Typhoeus's clock through overlapping combo slow-downs runs late against her landings (fc63: her
conversion's frame-35 trigger at 59.33 s against her arrow at 58.65 s; five battle skills INSIDE her combo's window 0),
across every development log; 458b's Thermite Cutter team ATK layers ending 0.3 s before the log's at 111 s. Base main
at 400bb44, merged with 88d79bb.

**Found:**
- **Combos pressed together each run on their caster's clock.** A combo's landings all come after the overlapping
  slow-downs, so a start placed from them can't tell a hold; the cast event can: it is stamped on the world's clock (a
  plain combo's event +0.5 s in log time, +0.05 s in world time). Over 132 development combos whose first landing comes
  across another operator's combo slow-down (scripts/probes/combo-hold/overlap-events.ts), the event's world lag from
  the start the landing gives unheld is 0.00 s median (99 within 0.1 s), from the start held by those slow-downs
  +0.25 s (20 within 0.1 s). Held only past her own slow-down's end measured worse (Typhoeus's 0eef, bdf2, fc63 9.26 s
  0.2–0.5 s off). Camille's battle-skill explosion lands where 4e5e logs it (8.33, 56.17 s) only unheld. A slow-down
  starting after hers ended holds her (landing pairs; three events, mixed).
- **458b's layers:** not a hold at a break: a layered kit buff was no clock of the hidden holds (holds.ts NOT_A_CLOCK
  `maxStacks`), though Thermite Cutter's layers (BuffData stackingType 11) have their own timers and the log lists each
  apart from its application.

**Done:**
- Engine assumption `combo-overlap` (default `own`; `lowest` the old rule): timeline/clock.ts slowDown, at a combo
  slow-down's start an operator whose own combo slow-down runs loses no frames to it (slow-downs carry `combo`; a cast
  started inside a running slow-down was already not held by its rest). tests/combo-overlap.test.ts. fc63: the
  conversion on time, INSIDE at 37.67 and 59.03 s gone, 81.83 s 11 → 2 frames, 11.37 s 22 → 6.
- holds.ts notAClock: a layered buff whose game buff is stackingType 11 is a clock (runBounds, heldToLoggedEnds), each
  layer paired with the run nearest its application (nearestRun). 458b: every 111 s hit plain.

**Measured** (against bf6a399 for the layers, against `lowest` for the engine rule): the layers development plain 84.3
→ 84.5%, earlier 85.0 → 85.4%, hold-outs unchanged, 9c6e −4 (a Corrosion step at 76.46 s the moved holds put off);
with stackingType 2 too, 7910 lost 120 plain (its gear-set runs outlast their layers' timers): left out. The engine
rule: verified 4e5e −1 (its 31.07 s explosion 0.4 s early either way, now across a buff's start), db87 236 → 230 (its
Corrosion steps after three combos at 22.0–22.3 s ask 0.15 s more world hold than placed: the world's per-episode
excess), one hold-out +4 plain.

**Scoreboard** (`npm run snapshots:update`, against 88d79bb): verified plain 78.5 → 78.4%; development plain 84.3 →
84.5%, mismatch 4.6 → 4.5%, |damage error| 1.2%; hold-outs plain 82.6%, mismatch 5.1%, |damage error| 5.9%; earlier
pending plain 85.0 → 85.4%; several targets plain 69.4 → 69.0%. `npm run smoke`: the six example snapshots moved
(regenerated); team-ab against 400bb44 (32 seeds): the owner's team sustained DPS +0.41% full energy (54,023 →
54,247), +0.53% zero (52,889 → 53,168); Typhoeus's team −0.03% both (58,428 → 58,411; 56,844 → 56,825), all within
one sd.

**Decisions:** `own` the default: the events decide it across 132 combos and the placement already reads combos this
way; the verdicts barely move because the replay pins its casts to the log. stackingType 2 layers stay out of the
clocks (measured).

**Left:** a combo pressed after hers ended but before her landing (three rows); the world's per-episode excess (db87
22 s, the hidden holds); fc63's Typhoeus combo events 0.6–2.4 s before her placed starts (a placement question);
11.37 s's 6 frames.
