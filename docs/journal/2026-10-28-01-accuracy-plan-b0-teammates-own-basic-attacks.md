## 2026-10-28: accuracy plan B0, teammates' own basic attacks

Goal: B0's second half, in `simulate` and the search. Measured first from
28 logs, with the replay's teammate casts: teammates step through their
chains at the windows' pace, their runs end in a pause (median 3.5 s,
quartiles 2.1–6.8 s) or at their own skills, and they attack a median 39%
of their free time (the controlled operator 60–80%; the owner: "not quite
at the pace"). Engine: `timeline/teammates.ts`, a scheduled `auto` per
teammate (chain at its windows, 3.5 s pause after a full chain, held by
its own action and hits, cut at once by its own casts: actionGate,
ownHitsLanded, afterCantCast and exclusiveUntil treat an `auto` action as
none); a swap or a control-taking skill hands it over; same-frame ones go
by operator ID (team-order test). On in scenario files (`teammateAttacks`,
default true), off in the engine API (tests, the log replay). Cast table
marks them "(own)". Examples rise where a support is controlled and a
damage dealer is a teammate (akekuri-laevatain +66%, antal-focus +37%);
solos unchanged; rossi-gilberta's seed −18.7% is the shared crit stream
(mean of 50 seeds +2.3%). Four kit tests set it off (their frame-exact
checks of the examples' rotations); Tangtang's counted all casts.
Search ~1.5× slower. In-game test 101 asks for the pace.
