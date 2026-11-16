## 2026-10-26: accuracy plan A1, casts the log placement merged

The owner on teammates: they basic-attack on their own, slower than the
controlled operator, not during e.g. Liino's stance and ultimate (plan
B0); and later: "Liino's skill only blocks it for Liino herself. The
other operators do keep attacking and even Liino's stance is doing damage
to enemies, but through the skill instead." Then A1 (accuracy-plan.md
"Progress"): four placement and replay
fixes, not one: a cast with all its known landings of a key logged takes
no more; stack requirements are alternatives at one frame; casts placed
from the same key aren't merged as one cast; shared-key chain steps by
the windows, and in the replay by the engine's state (Typhoeus's hover
attacks are gated by her ABATK stack, not windows: placing them by
windows alone didn't help, removing the window rule lost Rossi's gains in
4e5e / d572 / 2fd9 / 99fb, so both stay). Typhoeus's arrowrain key back.
92b4 −34.8 → −3.1%, bdf2 −28 → −9.3%, dbae −43.9 → −20.6%, 4e5e −12.5 →
−6.5%; Rossi's 4e5e hits all match now (the killing blow too). Some plain
matches drop where the extra landings bring the replay's (wrong) Stagger
earlier: B1 next after A. A3 (unknown crits at expected crits in the
totals) and A4 (a kill caps the replay's damage at the enemy's HP; the
"last hit" error is then the time to kill: b7b3 −10.5%, 7e19 −6.6%): 4e5e
now −0.7%. A2: Si's Initial Stroke from her logged press (a "slot" cast,
only when it leads to a cast the log implies), Final Stroke inferred from
the burst after Artful Intent's end (castsFromBuffEnds; not when the
buff's own expiry explains it); a first version substituted Liino's
logged press during her stance as End Stance and dropped the stance's ATK
(0eef Si plain 9 → 1): substitutions now need a logged consequence. 0eef
−26 → −11.8%, bdf2 → +0.5%, b6aa → −20.5%, c3c7 → −5.1%.
A5 is a kit item: the male Endministrator's skill files all differ from
the female's (timing and actions). A6: e82d's missing Amp was Si's own,
held by the engine through Arcane's ultimate cast inside Si's; shifting
cast starts in the placement instead was wrong (b7b3 plain 38 → 13),
reverted. The engine no longer holds an operator during another
ultimate's stop while its own ultimate's stop runs (interim, one log;
in-game test 18 has the check): e82d −51.8 → −32.7%, c3c7 → +0.1%;
examples with overlapping ultimates +2–13% (camille-gilberta +13.0%).
