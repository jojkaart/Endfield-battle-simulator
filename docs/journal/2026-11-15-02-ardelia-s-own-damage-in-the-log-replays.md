## 2026-11-15: Ardelia's own damage in the log replays

Goal: verify a sonnet diagnosis of Ardelia's per-log errors (+57% to
+204%) as log-check problems, and fix them. All verified. One ultimate
became 3–4 casts: her sheep fly at random, off their slots' frames, and a
later cast of hers superseded the cast; now an ultimate isn't cast again
within its action (placement and distinctCasts). Her combo's bomb split
from its projectile across time stops: joinable and choose's chain window
now count world time (every stop but the cast's own), and the placement
takes the stops of logged casts nothing placed is near (Yvonne's hitless
ultimate). The replay landed every planned sheep (11 / 14): now only the
logged ones (a landedCount hit). 4e36's and c3c7's fixtures get her weapon
level and nodes (1 / 0 and 60 / 0; her weapon's logged skill levels bound
its breakthrough). Ardelia: 5082 +204.5 → −8.4%, af7b +158.3 → −5.3%,
4e36 +199.4 → +0.6%, c3c7 +70.3 → +4.8%, 9c6e +57 → +9.8%; 791 −13.7 →
−27.4% (its sheep ×1.407: a lead). Development plain 38.1 → 38.6%,
mismatch 22.9 → 22.4%, mean |damage error| 16.8 → 17.2% (the extra
landings had hidden others' shortfalls: 5082 +6.8 → −21.5%, Yvonne −23%);
hold-out 61.5 → 61.4%, 6.1%, 12.5 → 12.4%. Side fixes: Wulfgard's combo 2
across a stop (0c14, 489c; 9a80 −23.6 → −17.3%). Not done: buildOffsets
can't see 4e36 / c3c7 (flat ATK buffs move the ratio hit to hit); a
robust search would replay each candidate build. Ardelia's second
"ultimate" event ~3 s after the first is a repeat, not a cast.
