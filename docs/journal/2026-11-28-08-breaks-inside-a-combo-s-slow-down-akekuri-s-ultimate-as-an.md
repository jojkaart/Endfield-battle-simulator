## 2026-11-28: Breaks inside a combo's slow-down; Akekuri's ultimate as an ultimate

**Goal:** docs/open-problems.md "The hold at a Stagger break": 458b 87.47 s (Akekuri's combo INSIDE her ultimate),
whether and how a break inside a combo's slow-down holds, a press inside a hold.

**Found:**
- 458b 87.47 s is the placement of Akekuri's ultimate: its hitless event at 84.37 s was read as the press
  (castassembly.ts loggedCastStart wants another's hit within 500 ms after it), though the team's next hits fall
  inside the 1.83 s stop a press there would make. From its stop's end (82.53 s) the combo clears the ultimate's
  cantCastSkill channel (frames 0–119), and the log's team ATK layer starts (84.47, 86.03, 87.14 s) are the ultimate's
  SP grants at its frames 59, 86, 119. castassembly.ts was the placement agent's file: held back
  (docs/tried/2026-11-28-ult-event-stop-end-held-back.diff), then applied on this branch after that agent's merge.
- Akekuri's ultimate file says skillSpecification 0, the only ultimate of 34 not 5: the engine gave it a plain skill's
  interrupt priority and no ultimate's stop (458b 158.53 s INSIDE her combo; a break inside her stop held by the
  engine, not by the replay's stop list). skillData.ts ultimateSpecification reads it as 5.
- A break inside a combo's slow-down holds, on top of it: engine assumption `break-hold-combo` (`added`: the running
  slow-downs pause through the hold; `lowest`, the earlier rule; `none`), clock.ts addedHold and holds.ts breakStops.
  scripts/probes/stagger/break-combo.ts: 18 development breaks inside a combo's slow-down, most at its end where the
  readings differ by a frame or two; the stamped-inside ones (4360, c4f3, d4fb, f574, 458b 85.57 s) fit `moments`, the
  next moment being the clock the hold released.

**Measured** (`measure --variant`, on 2f4afbd): `added` against `lowest` development 00ae +2, 9090 +1, hold-outs one +2
and one −1 plain, 458b damage 0.6 → 0.5%; `none` hold-outs 82.5 → 82.4% (one −7), development 00ae −2, 9090 −3. The
specification fix alone: 458b 1093 → 1087 (its ultimate's third SP grant, from the misplaced 84.37 s start, at 88.33 s
displaces the combo's 88.20 s team ATK layer); with the held-back diff 1089, the rest unchanged: the layers then start
where the log has them (88.20, 88.68 s) and end 0.3 s before the log's at 111.0–111.6 s (the base's plain there came
from a layer the log's starts contradict: the ultimate's grant at 88.93 s).

**Decisions:** `added` the default (the breaker's own clocks are held by its break, and a combo's slow-down is an
action on its caster's timeline; measured better than `lowest`, `none` worse). The specification read as 5 (the
data's 33 other ultimates, the skill's own time stop, 458b 158.53 s); its 458b cost explained above, recovered in part
by the held-back diff. A press in a hold stays undecided (9847 57.64 s's event lag fits both).

**Scoreboard** (`npm run snapshots:update`; measure against main at 3717a31, the ultimate-event diff applied):
verified 78.5% and development 84.2% plain (00ae 689 → 691, 9090 1030 → 1031), hold-outs 82.5% (one +2, one −1
plain), earlier pending 84.9% (04d4 597 → 599; 3aa6 mixed, 419 → 420, mismatch 19 → 17; 458b 1093 → 1089, as
above), several targets 69.4%: every row's percentage unchanged. **Team numbers**
(team-ab against 2f4afbd, 32 seeds): the owner's team sustained DPS +0.95% full energy (53,513 → 54,023, sd 1,319),
−0.32% zero (53,059 → 52,889, sd 1,392), within one sd; Typhoeus's team unchanged (its fight the same). `npm run
smoke` passed. The ultimate-event diff is log-side (castassembly.ts, read only by the replay): no simulated fight
moves, so team-ab wasn't rerun for it.

**Left:** 458b's layer ends at 111 s, 0.3 s early (world holds between 88.7 and 111.5 s);
Wulfgard's combos pressed inside his own ultimate (1a77, 8056: INSIDE 26–41 frames, the ultimate's hits running on).
