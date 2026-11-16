## 2026-11-15: The buff timing report

Goal: find kit-buff timing errors of seconds (outside the check's 500 ms
toggles) without one-off diagnoses, as hints that need a mechanism.
Done: `efsim zmdlogs timing [fixture…]` (bufftiming.ts; design.md "The
buff timing report"): every fallback / mismatch hit's engine reading with
each kit buff off or on (the log's values, the engine's at other landings,
the kit's), placed against the replay's windows (`BuffReplay.kitWindows`),
runs of ≥2 hits per buff, direction and edge, counter-evidence from plain
matches, and the kit's sources with events near. enginecheck.ts's
`readingBasis` split out of `engineReadings` (same readings: snapshots and
development / hold-out 45.0 / 62.1% plain unchanged). 27 development logs
in ~2 min; hold-outs skipped. Leads in open-problems "Buff timing leads"
(Yvonne's MI Security on crits the log doesn't flag, 5082; Si's hitless
ultimate at 7.0 s not replayed, 9c0b; Hot Work refreshed by Combustion
ticks?). Not done: no kit or engine change (the rule); the mechanism
matching is coarse (event types, not every filter or `if`).
