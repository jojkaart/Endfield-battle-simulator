## 2026-11-24: Placement leads: ultimates from their cast events, Chen's stew, trigger cooldowns on the world's clock

**Goal:** the misprediction rounds' placement and timing leads: Liino's ultimate windows (1cd1, af7b; 1d91, 9c6e),
7e19's Chen ×1.15 and Ember −21.5%, what 0c14 / 4e36 / de6a have left, then the one-sided landings' largest kinds.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The placement leads"):
- **Liino's windows were her travelling projectiles.** Pyrotechnics (frame 76, `detached`) land 0.1–0.8 s of the
  world's time after their frame, so the cast placed from them came late: its stop over teammates' logged hits, its
  Amp (frame 77) after hits the log has under it. An ultimate's cast event sits at an edge of its stop, the end for
  most operators (scripts/probes/placement/ult-events.ts: Si 26 of 35, Liino 13 of 21, Laevatain 11 of 16). logcasts.ts
  eventStopStart: an ultimate whose first landing is on its way (detached, or Ardelia's sheep's random count) and whose
  frame-placed stop covers a teammate's logged hit starts from such an event (1cd1 −7.5 → −3.5%, af7b, 1d91, 9c6e,
  5082, 7910's Ardelia, 3aa6's Arclight).
- **7e19's Chen: Ginseng Meat Stew** (buildOverrides; fit-build 17 of 19), after ruling out P1 (×1.15 from 99.9% HP in
  a Max-HP fight; P1 would be ×1.185) and listing differences; the Endministrator has the same stew by hand. Ember's
  −21.5% is her finisher's second hit with the Staggered parts after the log's Stagger ended: open.
- **Swordmancer's cooldown is on the world's clock** (engine assumption `trigger-cooldowns`, reading `world`; the
  default stays `raw`): its replay-only procs are the largest "no cast" kind (scripts/probes/cooldowns/physuit.ts:
  every miss under 15 s of world time, every proc past it); Mi Fu's P3 in 2fd9 too. `world` for every trigger moved
  four kit tests' fights (Glorious Memory's 0.5 s layers, Xaihi's crystal, Sundering Steel, chen-solo) and two
  hold-outs' totals for the worse: not every trigger cooldown is a CD timer. Next a kit field for the clock.
- **The hold placement** leaves out cast events the replay read as ticks (the kit-buff round's Empyrean end in 4d60).

**Scoreboard** (`npm run snapshots:update`, against main at ca5b566): development plain 67.7 → 67.8%, matched 83.8 →
83.9%, mismatch 11.6 → 11.5%, mean |damage error| 7.0 → 6.9%, within 5% 25 → 26; hold-out plain 78.4 → 78.5%,
mismatch 5.9%, mean |damage error| 8.5% (1 better, 1 worse by one plain hit now assumed, 1 other); earlier pending
plain 64.4 → 64.6%, mismatch 14.1 → 13.9%, 4.4 → 4.3%, within 5% 18 → 19; all but the hold-outs 5.5 → 5.4%. Better:
1cd1 −7.5 → −3.5%, af7b plain 588 → 599, 5082 +2.3 → −0.1%, 8915, 7e19 plain 66 → 85 (−6.6 → −4.9%); mixed, per hit
closer: 1d91, 9c6e; worse: 7910 (−5.8 → −6.1%: Corrosion readings ±2% as the placed holds moved with Ardelia's stop,
whose press at 55.12 s the log shows), 9090 (Perlica's Electrification 0.1 s short at 64.40 s), 3aa6 (one plain).
Teams (team-ab against c6f1874): every team's fight the same.

**Decisions:** the event rule only where the frame's stop contradicts the log (Si's ability-entity slashes placed well
from their frames: b6aa's ready-buff order says the event there was the press), at least 150 ms earlier, a first song
beat within that keeping its start (d9e5: a frame's move shifted Corrosion's ramp); the cooldown clock left at `raw`
(smoke failed under `world`: kit tests encode other triggers' raw cooldowns).

**Dead ends:** the event rule for every detached ultimate (Si's moved 1.6–2.1 s in 4a64 and b6aa, worse); P1 on
Chen's own HP (d4fb switches at 0.499 of the enemy's).
