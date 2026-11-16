## 2026-10-30/31: A kill's span on both sides; bosses and freezes

Goal: the owner's point that when a log stops counting at the kill, both
totals should stop there. They didn't: the replay stopped at the enemy's
HP, 1 s before b7b3's kill, so Arcane's last second counted for the log
only (her −43%). Both now sum to the log's kill, and when the replay
reaches the HP is its own "time to kill" row. The cap had hidden an
overshoot: b7b3 +25.2%, 7e19 +15.4%. In b7b3 it was the placement:
Tangtang's dive spouts (fired by Arcane's plunging attack) share her
battle skill's key and were placed as an extra battle skill. A trigger
fired by decorated hits (a dive) now anchors on those logged hits
(`firedAt`): b7b3 +15.5%, nothing else moves. Last Rite's third
ultimate slash isn't in b7b3's log (+42% for her); the owner: assume the
log lacks it. Its HP bookkeeping agrees the log can't show it (the hits
sum to Rhodagn's HP exactly, the killing blow capped), so it didn't hit
him. Fixtures now take a hand-written `absent` list the totals leave out:
b7b3 +1.8%. Left: Arcane's Cryo burst times, 7e19's Crush matching.
Then (2026-10-31) the verified totals' bound went 45 → 12% (worst now
0eef −10.2%), and Arcane's Cryo bursts: the replay froze Rhodagn for
Tangtang's stare, holding them 7 s; the log has them due by the time
stops alone. The data skips freezes on control-immune enemies without a
table of which; Bosses (rank 2) are now assumed immune (b7b3 Arcane
+13.7 → −0.3%, c3c7 +7.9 → +4.7%). Dead end: bursts on the world clock
by the burst buff's `useTimeDilationDt` (false for every common buff,
Artful Intent too, which a freeze does stretch). In-game test 104 asks.
Then dbae's Arcane −33%: Cosmovoice was on Liino's first projectile
landing (pinned to its logged time) instead of her frame 77, and a time
stop starting inside her own shifted that frame's action by 1.2 s. Now a
frame-77 trigger, and the hold starts after what's due at the own stop's
end. Side effect caught by bdf2 and 0eef: the buff-lane inference read
Vocalist Stance's ATK (same game buff, from a hit) as ultimates. dbae
−2.2% (Arcane −19%), a7a7 −0.7%. bdf2's Si −11% is one combo finisher
×1.456 with no count that fits: a lead.
Then dbae's last Arcane gap, her burst: made inside Xaihi's ultimate
stop, it wasn't held by the stop's rest. Three rules tried: the enemy's
clock through every slow-down (0eef worse: Arcane's own combo held her
burst), ultimate stops only (dbae's still early), its operator's clock
(held by others' stops and slow-downs, not its own). The last fits both:
dbae Arcane −19 → 0%.
b6aa's Last Rite combo lacked Xaihi's Amp: her logged ultimate cast is
her stop's end. Such a hitless ultimate now starts earlier when the log
is quiet for the stop's length and another's hit lands at the event
(without that last check e82d's Xaihi moved wrongly). b6aa plain 217 →
236, c3c7 96 → 113, 4bfc +10. Dead end: Liino's volley trigger in bdf2
(no reaction before the 3.2 s volley; ~4k damage, left).
