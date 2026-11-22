## 2026-11-22: Rossi's bleed keeps only ATK; its ticks on the log's clock; her ultimate's crits

**Goal:** Rossi's mismatches (594 in her 9 development logs, second after Arcane), her bleed first: does its tick
clock drift as Liino's volleys did, and pin it or fix the kit; then Wolven Blood, Seething Blood, her ultimate.

**Done (open-problems "Rossi: her bleed, her ultimate's crits and what remains"):**
- The bleed's `takeAtkSnapshot` keeps ATK only (effects.ts `ATK_SNAPSHOT_ZONES`): d572's ticks follow Wolven Blood's
  layers, Camille's set DMG and the combo's Crit DMG tick by tick, not Camille's weapon ATK. Combustion keeps its
  whole-side snapshot (its own evidence).
- A tick at its buff's application doesn't see that buff's modifiers (PendingHit `firstTickOf`): every bleed's first
  tick lacks its +12% DMG Taken in every log.
- The bleed's ticks are pinned to the logged ones (`ticksShownByHits`, as Liino's volleys): the replay's ticks step
  0.3–0.6 s against the log's at other casts' placed stops, with no kit timer that fits; the bleed runs through her
  own combo slow-down in both.
- The replay counts crits the log leaves out where a trigger on crits logs its hits at that ms (buffreplay.ts
  `shownCrits`): every log gives her ultimate stabs no crit but logs the Seething Blood extra of each crit stab, so the
  extras and their Wolven Blood layers now land.

**Numbers (scoreboard):** all but the hold-outs plain 51.3 → 51.8%, mismatch 19.9 → 19.6%, mean |damage error|
9.9 → 8.3%, within 5% 28 → 31; development mismatch 18.2 → 17.7%, |damage| 12.6 → 10.1%; hold-out plain 67.3%,
mismatch 6.7% unchanged, |damage| 12.1 → 11.7% (1 better, 0 worse); Rossi plain 23.4 → 30.2%, |damage| 17.9 →
3.9%. 4e5e, 3f78, 489c, 4a64, 9a80, 2fd9, 99fb, d572 better; 0c14 mixed (total +8.5 → +10.4%, it over-predicts
already; per-hit closer). Rossi's own mismatches 594 → 497 (`zmdlogs groups --operator Rossi`).

**Decisions:** pinning over a kit timer for the ticks, because the steps follow where the replay places others' stops
(which it can't know better); the snapshot and first-tick rules are engine facts, so simulations get them too.
`ticksShownByHits` is unchanged (Liino's use is the same).

**Left open:** Hard 27 (2fd9, 99fb: 402 of the 497); Wolven Blood's max-stack bonus and the combo's Crit DMG lasting
up to ~2.5 s longer or shorter in world time than the replay's (tables in the entry); Corrosion's ramp under 489c's
ultimates; 0c14's crit-less ultimate without a bleed (no extras to show its crits; the log's layer counts would).
9a80's ultimate ×1.09 already fitted at the base.
