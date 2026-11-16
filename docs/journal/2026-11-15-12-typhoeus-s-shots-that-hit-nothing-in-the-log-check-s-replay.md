## 2026-11-15: Typhoeus's shots that hit nothing, in the log check's replay

Goal: the replay idled Typhoeus's hover out after her last logged shot
where the log shows it went on (open-problems.md). Done: a cast that hit
nothing (replayCast `missed`: its own hits dropped; what the cast does as
it starts stays). From the data: a shot uses its Hunting Arrow at its cast
(floating_attack1–4 frame 1, FinishBuffAdvanced arrow_num before the
projectile launches), while its Sign, team energy, Nature consumption,
burst, Stagger and the 5th's SP are its projectile's hit's
(floating_attack*_01_projhit). The replay (buffreplay.ts `missedCasts`)
adds the fewest such shots, each at the earliest frame that still works,
only before a logged shot the kit allows none of her shots for, and only
where the log shows no shot of hers from the first frame another could
start; each is listed in the check's report as assumed. Also fixed: a
logged shot whose step the kit's timing doesn't allow by its frame (the
log's shots 16 frames apart, the window 18) kept the placement's index
(shot 1 again); it is now the step her attempt index allows. Results:
9090 Typhoeus plain 331 → 346 of 457 (one missed shot at 58.7 s; the
29-hit Hovering ATK run at 63.7–68.0 s and the 93.9 s one gone; her
totals −2.7 → −4.8%: a phantom shot and burst, 109k, are gone, and her
weapon's Arts DMG layers after 98 s now run a layer short of the log);
dbae plain 22 → 33 of 43, totals −5.7 → −2.4% (two missed shots); 9c6e
(two hits per shot) mismatches 65 → 58 but totals +48 → +62%.
Development Typhoeus plain 55.2 → 56.4%, mismatch 13.07 → 12.73%, mean
|operator totals error| 8.91 → 9.96%; team plain 46.9 → 47.0%, mismatch
21.95 → 21.93%; hold-outs unchanged. Dead ends: 1cd1 isn't missed shots
(her 4th is logged before the hover ends; the combo is placed 3.2 s after
its cast event, past a time stop), nor fc63 46.8 s (no shot missing; a
burst held by stops became a shot). Two placement rules for the latter
(an orphan burst joins the latest shot; a landing can't join a cast whose
delayed landing came first) made the totals worse (−7 to −11%) and were
dropped (open-problems.md). Next: placing casts across others' time stops.
