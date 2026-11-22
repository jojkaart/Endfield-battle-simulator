## 2026-11-22: Arcane's Imprisonment end and her INT lasers

**Goal:** Arcane's Imprisonment ended late in the replay against the log's natural-end "cast" (median +0.3 s, 4d60
+1 s, ad7f +2.5 s); the seal buff's abilityEvents 8 / 1403 / 1601 undecoded; a7a7's INT early-end lasers 0.4 and
1.1 s early. Details: docs/open-problems.md "Arcane's mismatches as one group", Fixed 4.

**Found (game data):**
- The natural end is the seal's one tick, not its end: the combo sets `trigger_time` = duration_final − 0.5
  (SimpleCalcBB), the seal ticks once at it (buffEvent 1) and casts `abilityentity_end` (explosion 14 frames later);
  the seal and its child Susceptibility end 0.5 s after. The logged end is 6.0 s after the touch where nothing holds
  it, and the Susceptibility's logged lane ends 0.5 s after it. The kit cast the explosion at the seal's end.
- abilityEvents 8 / 1403 / 1601 (seal, combo_skill_precheck) cast the same end when the holder goes (defeated,
  removed, handed over; with 1401 / 1402 in Wulfgard's and Arcane's files): none mid-fight.
- Si's freeze doesn't hold the seal (b6aa 19.56 s, ad7f 3.91 s).
- INT: seal2 (the early end's window) ends with the tick; a late hit in the seal's last 0.5 s still casts seal_again
  (its 12 s Susceptibility, no lasers: 8915 109.94 s). The log's combo event 0–4 frames before the first laser is the
  lasers' start (seal_finisher_wisd); seal_again's frame 41 comes 0–1.1 s later than the hit + 41 frames + holds
  (not decoded).

**Done:** kit `imprisonment` ticks (`every`), `explosion` on the tick, `early_end_window`, `laser_wait` +
`int_lasers`, `post_susceptibility_lasers` / `_late`; KitBuff `runsThroughFreeze` (engine clock.ts shiftDebuffs),
`endFollowsTick` and `childOf` (the replay moves the seal's and its Susceptibility's end with a logged tick); the
seal's and the lasers' ticks `ticksLoggedAs` the combo; buffreplay.ts: a due tick waits up to 1 s for a logged one
(TICK_HOLD_FRAMES), and for a ticked skill a combo's own event is one within 1.5 s of it (COMBO_EVENT_MS); docs
(game-data-format abilityEvents, data.md "Hidden casts", open-problems, roadmap).

**Decisions:** the replay takes the logged end as a timing fact where the game's (±0.5 s unexplained) can't be
known. COMBO_EVENT_MS for every combo was tried and made the hold-out's mismatch 6.7 → 6.9% and its damage error
12.1 → 12.3%: limited to skills a buff's ticks are logged under (Arcane's combo).

**Scoreboard** (docs/accuracy.md from `npm run snapshots:update`, against 1ab4647): development plain 52.0 → 52.7%,
mismatch 18.2 → 18.2%, mean |damage error| 12.6 → 12.4%; hold-out plain 67.3 → 68.7%, mismatch 6.7 → 6.7%, mean
|damage error| 12.1 → 11.9% (9 logs better, 0 worse, 1 mixed); Arcane's row plain 61.7 → 63.5%, mismatch 15.5 →
15.3% (863 → 854 hits outside the multi-target logs), mean |damage error| 14.2 → 14.3% (9c6e's Arcane total −33.9 →
−41.1%, below). Development 16 better, 2 worse (9c6e, e9896c8d02be: below), 5 mixed.

**Teams** (`node scripts/team-ab.ts --base 1ab4647`, 32 seeds): Estella, Si, Akekuri, Arcane 53,162 → 53,103 / 52,826 →
52,717 (full / zero); Typhoeus, Arcane, Liino, Perlica 52,949 → 52,955 / 50,194 → 50,177: within the noise (sd
1,300–1,900); a line on each team page.

**Left:** the seal's ±0.5 s where nothing holds it (4d60 short, 1d91 / af7b / fc63 long); seal_again's delay;
e9896c8d02be's combo pressed before her own ultimate (placed after its stop; its end not held by the stop while its
Susceptibility was): Arcane, Si plain 252 → 246; 9c6e's total −10.0 → −10.7% (its hits after the seal's logged end
lose the Susceptibility, closer each: 665 / 892 against 494 / 743 logged, was 785 / 1053).
