## 2026-11-13: Liino's beats replayed as beats

Goal: replay Liino's battle-skill events in Vocalist Stance as the
stance's beats (the owner), and find why skipping them had cost her
teammates' matches. The data: her volley window is two clips of the
battle skill's own action (frames 45–1691), created once per cast; the
beats create nothing of it, so the kit's window was right. The teammates'
loss was Arcane's: in a7a7 her press at 37415 ms is the battle skill
placed at 40523 ms (351 ms later in the world's time), but the 2.5 s match
ran on the log's time; Liino's recasts had drained the SP, so the extra
press couldn't start and the bug stayed hidden. Done: a kit buff's
`ticksLoggedAs` (schema, loader check; the engine doesn't read it), and
the replay reads such an event while the buff is on as a tick at the
event (bdf2/0eef/d774/4bfc list one weapon heal layer per event); a
logged cast matches a placed one in the world's time (also removes e82d's
extra Arcane touch). Liino's damage error 1d91 +113 → +2%, 1cd1 +96 →
+27%, a7a7 +58 → +2%, 8318 +230 → −7%; Team SP shortfall (15 development
logs) 39 casts / 1673 SP → 21 / 1038. Development plain 36.1 → 35.8%:
1d91 alone (−22 plain; its damage wants a heal more than the beats give,
open-problems). Mean |damage error| 22.1 → 21.7%.
