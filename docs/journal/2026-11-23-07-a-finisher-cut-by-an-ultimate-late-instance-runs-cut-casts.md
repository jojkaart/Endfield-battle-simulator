## 2026-11-23: A finisher cut by an ultimate, late instance runs, cut casts' later stops

**Goal:** the remaining leads after the hold-out refresh: 458b's Laevatain total (9.0 → 11.3% at 74bc686), Rossi's
combo_3 dilations, Xaihi's weapon instance in 5082 (1.67 s late), 489c 49.31 s.

**Found and done:**
- **458b:** a compensating error going away. 74bc686 made her enhanced battle skills at 92.9–94.3 s right; what was left
  over were two replay-only finisher hit_2 landings (225,802 and 281,334), kept because her ultimate came inside the
  finisher's disable-cast buff (frames 0–42), which the engine let hold every cast. Every logged ultimate inside a
  finisher's frames cut it (458b ×2; d572, Rossi's placed from its own hits, 17 frames in). Engine assumption
  `finisher-ultimate` (`cuts`; `held` the old rule): SkillTiming channels' `finisher`, timing.ts afterCantCast. 458b
  damage 8.0 → 0.8%, d572 4.2 → 2.1%.
- **5082:** INSTANCE_LATE_MS now skips an instance buff's late run only where the replay reapplies it on the holder
  inside the run (a refresh in place needs one); otherwise the run is a clock (buffreplay.ts runBounds). Xaihi's 27.37 s
  instance is her last: Arcane's 50.51 s hits plain, 5082 plain 224 → 247; 4d60 +6 net (15 hits at 102.98 s now read a
  Corrosion the log has ended: a Corrosion end from the hits isn't a bound yet).
- **489c 49.31 s:** right as placed (held start + the slow-down = 49.29 s). The "ahead" ramp readings at 49.77–50.00 s
  are Rossi's own ×1.013 (her weapon's layers, from 47.0 s, before the Corrosion). Found on the way: the log tools' stop
  lists put every SkillTiming slow-down at its own frame, so Rossi's combo_3 on its perfect path (ends at 211) held the
  world again at frame 212, 7 s later, and Pogranichnik's and Purrchena's combos had their paths' stops at 6–20 s; the
  engine never had them. skillStops now follows the path the cast's landings show (logcasts.ts pathOf, the engine's
  pathSlowdowns shared with casting.ts). 489c plain 579 → 589, mismatch 31 → 23; 9a80 +5.
- **Rossi's combo_3 dilations:** worth 1.5–2.2 frames, not 7 (the combo one ramps from its frame 8); 3f78's excess
  167 → 114–135 ms either way; the "combo priority outranks" reading measured mixed (489c −8). Not built.

**Scoreboard** (`npm run snapshots:update` against aa938ce's snapshots): development plain 65.4 → 65.7%, mismatch 14.8%,
mean |damage error| 8.6%; hold-outs plain 77.6 → 77.4%, mismatch 6.3%, mean |damage error| 10.6 → 10.2% (1 better,
0 worse, 2 mixed); earlier pending 58.5%, 17.8%, 8.4 → 8.1% (3 better, 1 worse: 99fb −1 plain, a knock-on of the stop
lists; 2 mixed); verified unchanged. Teams (team-ab against aa938ce): every team's fight the same.

**Decisions:** the finisher rule as an engine assumption (three cases, two operators, all one way). The hold-outs' plain
−0.2 pt is the stop lists' part (measured apart: the placement's part moves nothing); kept, since the lists now match the
engine's own timeline and one hold-out can't be traced.

**Left:** Rossi's bleed tick series across a reapplication (489c 52–60 s, which drops the ramp's bounds); a Corrosion end
read from the hits as a hold bound (4d60); 6339's Laevatain hit_2 with no own cast before it; the castFlag view's INSIDE
wording (it counts the wait for own hits, not only uncuttable frames).
