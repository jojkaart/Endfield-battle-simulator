## 2026-10-28: Typhoeus's burst on the enemy's clock; dbae verifies again

Goal: Arcane's Nature burst at 10341 ms in dbae (B8), which held back
Xaihi's verification. It wasn't Arcane's kit. Typhoeus's Power Shot burst
waits 0.35 s on the enemy's clock (the data: the arrow's hit consumes the
stack and creates the burst buff, whose `triggerInterval` runs from
then; time stops hold it). The kit landed the burst with the arrow, so the
placement made bursts 1–2.5 s late into shot casts of their own. One of
those used up the stack her touch needed. New `KitHit.enemyDelay`
(effects at the landing, damage on the enemy's clock), the placement
joins a delayed landing to its shot across time stops, and two replay
faults went with it (a delayed landing kept the cut cast's hover end;
same-skill casts within 1 s shared a lookup). dbae back in fixtures/
(Typhoeus plain 1 → 18, Xaihi 0 → 6), bdf2 +0.1%, 92b4 plain 29. In-game
test 47 is answered by the data; test 33's first half by the logs (the
bursts credited to Arcane after her touch are its own, 1 s plus stops).
Dead end: her touch's element as the window's trigger
(`element: "event"`) made 0eef −23.8%: the combo is cast at the same ms
as Si's Cryo hit that opens it, and the replay casts first. Kept the
enemy's current element (test 33's second half decides).
New lead: 012a's replay breaks the Stagger bar 17 s before the log does.
