## 2026-11-28: Combo windows: the opener logged inside a combo's own slow-down opens the press's window

**Goal:** the combo-windows lead's 12 INSIDE lines whose window opener the log has inside the combo's own slow-down
(docs/open-problems.md "Combo windows"), then 3f78 19.30 s (Arcane's combo 17.17 s after her last, 18 s cooldown).
Base main at 400bb44; files: packages/logs/src/replayrun.ts and buffreplay.ts (shared with the clocks agent, one
commit each), decisionsview.ts, views.ts, scripts/probes/placement/.

**Found:**
- The opener's ms inside the combo's stop is the log's flush, not its landing: 7 of the 12 share a ms with the combo's
  own cast event or first hit; Estella's battle skill, its event its placed start ±0.07 s in 19 of 24 casts
  (`casts --event-lags --operator Estella --verbose`), is 0.40–0.81 s off it in exactly the four whose projectile
  opens a combo here (4e5e 27.99, c4f3 40.79 and 117.22, 8f32 82.24 s); 8f32: her event at 81.85 s puts the
  projectile before Rossi's 82.90 s press, the log has it at 83.34 s with his combo's first hit. The combo's own hit
  pins its press (13 frames before it), so the press-at-the-opener reading is out. 8056 112.70 s's opener is
  Wulfgard's ultimate's Combustion at its frame 45 (113.27 s), not his later combo.
- 3f78: no reduction in Arcane's kit, gear or stage (540 frames from the data's level 12; 8915's 12 s cooldown is
  its stage's, c779's short gap Si's ultimate on slot 0, Arcane there); her cast events 16.93 s apart.
  scripts/probes/placement/combo-cooldowns.ts: 22 replayed combos made before the replay's own cooldown, 10 double
  placements (0.3–7 s apart) and 12 early by 0.07–2.4 s across 11 operators: a shared cause, open.

**Done:** replayrun.ts openerAhead (makeCast's first step): a combo whose window is shut at its frame takes the
window the state run on without it opens within its own stop (skillStops from frame 0), its count and source; the
landings stay. OPENER decision lines (`zmdlogs decisions`, `replay`). tests/opener-ahead.test.ts (fails at 400bb44,
verify-at); tests/burst-applied.test.ts's window-words test reads 3f78's line now.

**Dead end:** re-pinning the openers at the press (docs/tried/2026-11-28-opener-landed-at-press.diff): hold-outs
plain 82.6 → 80.9%, 9a80 −27 plain. A moved landing loses the logged facts the engine keys to its frame (a reaction's
logged crit within a frame: 4e5e's Cryst reaction), and Arcane's own ultimate hits moved before her combo lost its
cast-time effects the log shows them with.

**Measured** (`measure --base 400bb44`): no log's verdicts moved, the negative control within its bound. `zmdlogs
decisions --all`: the development logs' INSIDE lines held by a combo window 13 → 1 (3f78 19.30 s), OPENER 29 in 20
logs (17 more combos whose window the replay had opened at the press with count 1 and no source). Scoreboard (`npm
run snapshots:update`: no snapshot changed): development plain 84.3%, mismatch 4.6%, |damage error| 1.2%; hold-outs
plain 82.6%, mismatch 5.1%, |damage error| 5.9%; earlier pending plain 85.0%, |damage error| 1.2%. Log-side only: no
simulated fight moves, so no team-ab.

**Decisions:** the window's facts, not the landings: the brief said only the flag and the window at the cast were at
stake, and the measure agrees (nothing else moved). Not behind an assumption: it changes no verdict, and the press
can't come before its window. The phantom window the opener opens again after the cast stays as before.

**Left:** the 12 early combos (a COOLDOWN decision line would show them; the friction report suggests it); fc63's
battle skills INSIDE her combo's window 0.
