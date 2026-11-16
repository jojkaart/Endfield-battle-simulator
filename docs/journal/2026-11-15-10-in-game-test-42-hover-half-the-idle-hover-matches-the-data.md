## 2026-11-15: In-game test 42, hover half: the idle hover matches the data

The owner, controlling Typhoeus: after her battle skill and some shots,
letting go of attack, she drops within about a second of the last shot. The data's idle loop is 27
frames (0.9 s) before her landing starts, so the kit is right and nothing
changes. This rules out the first explanation for the logs' long hovers
(9090, 1cd1); still possible: shots that hit nothing (not logged) keep the
hover going, a time stop holding the loop, or the replay placing 9090's
combo at 60.6 s as the grounded one (next check). The owner adds that
holding attack keeps her shooting when nothing is hit; ZMDLogs lists her
shots only as hits, so a missed shot leaves no trace. In 9090 nobody lands
anything from 57.9 to 60.6 s, so missed shots are the leading cause; the
log check's replay should add them where the log shows the hover went on.
Test 42's other half: the owner has never seen Signs or arrows vanish
unused; the kit has no lifetime for them, so nothing changes.
