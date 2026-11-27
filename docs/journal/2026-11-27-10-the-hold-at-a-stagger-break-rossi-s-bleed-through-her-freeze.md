## 2026-11-27: The hold at a Stagger break; Rossi's bleed through her freeze

**Goal:** two leads of the placement-cases round (docs/open-problems.md): the clocks that run late across a logged
Stagger break (round 18's `zmdlogs clocks` rows, 5082's Yvonne +0.51 s), and 99fb's bleed ticks after Rossi's
ultimate placed as battle-skill hits.

**Done** (docs/open-problems.md "The hold at a Stagger break"):
- **A break holds every clock** (engine assumption `break-hold`, default `14f`; timeline/clock.ts breakHold, called
  at dealPoise's `staggered` in landing.ts): 14 frames at scale 0 for the world, the enemy and every operator, the
  breaker too, not inside an ultimate's stop. The evidence (scripts/probes/stagger/break-hold.ts): the clocks 0.6 s or
  more past a break run 0.41–0.61 s late but two (26 rows, every operator and enemy, enemy ticks too, median 0.54 s);
  none at the 86 Stagger Node crossings, whose buff (buff_common_mini_poise_break) has a 0.5 s layer-1 dilation. The
  data's enablePoiseBreakTimeDilation is true on every damage unit and has no length. 14f: the Node buff's curve holds
  0.46 s, and 12f–18f match alike while 16f/18f put c83c's total 5 points off (a tail cut's threshold).
- The replay: its tick bounds take the logged breaks as stops (holds.ts loggedBreaks, breakStops), so the hidden
  holds don't place the hold again; it holds only at the breaks the log shows (TimelineScenario.loggedBreaks, ±4
  frames: 6339, d4fb, f978 and 0c14 break the replay's own bar where the log has none). 5082's Yvonne keeps her chain
  at 45.06 s. Dropped after the split: the replay's Stagger window recorded from the break, not 14 frames later
  (docs/tried/2026-11-27-break-window-start.diff; the hold-outs 2 better without it).
- **Rossi's bleed runs through her ultimate's freeze** (kit `runsThroughFreeze` on Razor Clawmark): the replay held it
  +93 frames at the freeze (frames 57–150 of her ultimate on an Elite), and the log's ticks run a second apart there in
  every Elite log (99fb, 2fd9, 207f). Nothing ended the bleed: the "ended" one was held, so its logged ticks had no
  replayed landing and the placement took them for a battle skill's.

**Scoreboard** (`npm run snapshots:update` at the final commit, against f96757f): development plain 83.9 → 84.2%,
mismatch 4.8 → 4.7%, mean |damage error| 1.2 → 1.3%; earlier pending plain 81.9 → 82.2%; verified unchanged;
hold-outs plain 82.9 → 82.5%, mismatch 5.4 → 5.3%, |damage error| 6.3 → 6.4% (2 logs, about 30 hits plain → assumed:
still matched, under every hold length). The split (open-problems' table): the hold itself carries the hold-outs'
loss; the gate, the tick stops and the Stagger end don't; Rossi's bleed alone moves no hold-out aggregate (development
plain +0.1, and its fights' totals 207f 0.4 → 1.1%, 99fb −0.1 → 0.5%: more of the logged ticks land).

**Team numbers** (`node scripts/team-ab.ts --base a6c425f`, 32 seeds): the owner's team (estella-si-akekuri-arcane)
sustained DPS −0.89% (full energy, sd 2.9%) and −0.90% (zero); Typhoeus's team −0.60% / −0.36%: every break now costs
the team 0.47 s, within one sd.

**Decisions:** an engine stop, not a replay-only hold: the evidence is every operator's and the enemy's, so the
simulation has it too. `stagger-recovery` stays `2s` (with the hold the engine's own Stagger runs short in 18 of 71
logged runs, quartiles 0.43 / 0.84 / 1.62 s, against 20, 0.60 / 1.53 / 3.32 s; a refit is a next check).

**Open:** where the hold sits against the breaking hit's logged ms (9090, c4f3, 3aa6: the late clocks before it);
breaks inside a combo's slow-down; the hold-outs' 30 hits.
