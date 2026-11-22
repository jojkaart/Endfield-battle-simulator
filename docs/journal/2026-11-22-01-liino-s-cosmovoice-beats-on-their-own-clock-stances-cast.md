## 2026-11-22: Liino's Cosmovoice beats on their own clock; stances cast before the log

**Goal:** Liino on Typhoeus's team: her Cosmovoice beats logged 1.35–1.55 s apart against the kit's 1.5 s; her
stances cast before a log began (1d91, 7910, 4d60), whose first volley never landed; the volleys with a battle-skill
event at their first hit's ms.

**The beats' clock.** The data's beats are a buff's ticks (ultskill_music_damage, every ultmusic_trigger 1.5 s,
first at once, 15 s), the finale the ultimate's frame 508. In the logs the song's clock differs per log (4d60 a steady
1.36 s in both its Cosmovoices, c6d8 1.52 s, the volley timer likewise: 4d60 9.0–9.4 s) while the same logs keep the
ultimate's projectiles to ±15 ms of their frames, and the finale comes 14.3–14.75 s of world time after the first
beat (the kit 14.37 s): the song runs on a clock of its own, the finale on the ultimate's. So the kit's beats are now
kit buff cosmovoice_song's ticks (`noTickAtEnd`: ten, never eleven; its first beat the ultimate's own at frame 77 so
the placement still times the ultimate by it), `ticksShownByHits`: the replay takes each beat from its logged hit and
moves the song's end with them. The finale is the ultimate's own hit, pinned to its logged landing; End Stance skips
it through a marker (a launch frame would have held her combo beside the ultimate until 508). The placement gives a
trigger on casts one cast per anchor (every later beat had been an `ult_song` of its own). An ultimate logged at the
very end of another's stop that covers it was pressed inside it (4d60's Zhuang Fangyi at 157.42 s: her Empyrean
attacks from 158.38 s and Liino's beats at 158.66 s rule out a 2.6 s stop from the event).

**Stances before the log.** `castsBeforeLog` infers a cast before the log where the stance's buff is listed from
before it (4d60 since −811 ms, 7910 −576, a7a7 −1776, af7b −1444) or the first shown volley comes before any cast
could have opened it (1d91); `withCastBeforeLog` runs it on a timeline of its own and moves what it left onto the
replay's start, without its hits or the volley it launched before the fight. The 37 (now 30 of 104) events at a
volley's first hit are beats: each comes 2.5–6 s after her last event, the next 3 s on, and 10 of 25 carry a heal at
that ms like plain beats; reading them as no beat moved only 1d91 (+3 plain).

**Scoreboard** (docs/accuracy.md): development plain 52.0 → 56.1%, mismatch 18.2 → 17.4%, mean |damage error| 12.6 →
12.4%; hold-out plain 67.3 → 67.4%, mismatch 6.7 → 6.7%, error 12.1 → 12.1%; development logs 7 better, 0 worse, 3
mixed (4d60 plain 386 → 677, af7b 105 → 414, 1d91 280 → 328). Liino's error: 1d91 +14.8 → +11.6%, 7910 −7.9 →
−7.1%, a7a7 +7.5 → +0.2%. Simulations: the song, a buff, is held by Liino's own combo's slow-down where the ultimate's
frames weren't (liino-laevatain −0.05%; d774's beats agree).

**Dead ends:** adopting each log's shown interval as the clock for the next unshown tick (af7b's Liino +10.5 →
+2.9%, 9847's +10.2 → +15.6%, Liino logs' mean error 10.44 → 10.41): not kept. A `launch` on the finale: the
engine waits for a cast's own launches before any other cast of its operator, her combo beside the ultimate too.

**Left** (open-problems.md, "Liino's Cosmovoice beats"): the replay's stops around some beats (Perlica's ultimate in
4d60 at 92.8 s); Cosmovoice ending before its logged finale in the replay (9090, 8915, 4bfc: the finale ×0.64–0.70);
a pinned beat ordered after another's hit at its frame (9847 60.77 s); beats never logged (an enemy out of reach).
