## 2026-11-27: Casts across a Stagger break: the hold from the moments, break-held-starts

**Goal:** the hold-outs' INSIDE under the break's hold (docs/open-problems.md "The hold at a Stagger break"): which
casts the hold lengthens past the next press, what the logs show about a press during the hold, and a rule for it.

**Done:**
- `zmdlogs decisions --all --assume break-hold=none`: the development INSIDE flags the hold makes are four, fc63
  102.33 s (Typhoeus's combo ran through the break, placed from its landing without the hold, held again by the
  replay), 3aa6 145.73 s (Zhuang Fangyi's battle skill 3 frames after her own combo's breaking hit), 4d60 56.60 s (a
  break on Arcane's ultimate stop's end frame; the clocks on time after it) and 458b 87.47 s (an INSIDE without the
  hold too).
- **`break-hold-place` `moments` is the default**, its hold starting no sooner than 134 ms after the moment before
  (holds.ts BREAK_AFTER_PREV_MS: 9090's 128.50 s volleys, logged there, the replay's clock 0.07–0.10 s late, land
  before it; tests/buffreplay-typhoeus.test.ts passes). 4d60's INSIDE gone.
- **The placement takes the run's readings** (placeHits / placementPasses / settleCheck `assume`; logBuffReplay,
  composeCheck and the views with `--assume` pass them; checkLog takes the composed placement instead of placing
  again at the defaults), and engine assumption **`break-held-starts`** (default `unheld`) has the held start as a
  reading: `held` moves a start the landing puts before a break, not inside another operator's combo slow-down, by
  the break's hold (logcasts.ts heldBreaks, castStart). It supersedes the round's two tried diffs (deleted).
- Probes scripts/probes/stagger/press-in-hold.ts (the starts inside or before a hold) and ult-edge.ts (breaks at an
  ultimate's stop); tests/break-placement.test.ts.

**Scoreboard** (`npm run snapshots:update`, against 2d414f3): development plain 84.3% (4d60 983 → 985, 9090 1031 →
1030, 4360 assumed +1 fallback −1), earlier pending 82.3% (d4fb 851 → 850; 3aa6 and 458b other), verified and
hold-outs unchanged. 9090's and d4fb's: hidden holds placed elsewhere (the tick bounds take the moved holds).

**Decisions:** `moments` adopted: the log's evidence (no logged moment inside a hold) where `ms` contradicts it, flat
on every group, 4d60's INSIDE gone. `held` not the default: development unchanged (fc63's and 3aa6's INSIDE gone),
earlier d4fb +2, but one hold-out −6 plain (unquantified +3, fallback +1, mismatch +2, no decision kind moved), the
same in every variant measured (all breaks; outside every combo slow-down; under `ms`). No simulated fight moved (the
engine's timeline untouched), so no team-ab.

**Dead ends:** a start inside a hold moved before it (the first try: new INSIDE flags at d4fb 40.43, 195.87 s and
3aa6 145.53 s: those combos were pressed in the hold, the kit's uncuttable frames forbid the earlier start); the
same rule under `ms` (one hold-out −6, d4fb −9: the stamped-inside breaks' holds are misplaced at the ms); no hold
at an ultimate stop's end frame (engine and replay: under `moments` development unchanged, one hold-out −1; kept in
docs/tried/2026-11-27-break-ultimate-stop-end.diff). Whether a press during a hold waits it out or runs unheld the
landings can't tell (30 starts inside a hold, 12 at its last 55 ms; d4fb 196.05 s and 9847 57.64 s read as
unheld presses).

**Left:** the hold-outs' INSIDE (not fc63's kind alone); breaks inside a combo's slow-down (4360, c4f3, d4fb: moments
0.13–0.25 s after); 458b 87.47 s. Not taken up: the several-targets agent's 7b54 lead (Si's combo slashes on several
slugs at one ms spread over the slots; a placement counting same-ms twins on several targets as one slot), left for
the next round.
