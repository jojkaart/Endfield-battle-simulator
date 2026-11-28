## 2026-11-28: Team SP: Purrchena's counter presses, the SP readings as assumptions

**Goal:** the replay's SP runs short of what the logs' casts need (open-problems "Team SP"): recount it, work
through "Still possible" from the data and the logs, fix what they decide.

**Done:**
- Recount at 10aa577 (scripts/probes/sp/shortfall.ts): 16 of 65 development logs short, 41 casts, 1,327 SP, all
  battle skills; 04d4 621 of it, Purrchena's presses in the away stretches.
- Purrchena: the log records every press of her battle-skill button as a normal_skill event, the counter's too.
  The replay made each hitless event a battle skill (100 SP, forced against her kit while the counter was readied)
  and, where the counter's headbutt is logged 0.29 s after the event, both. castassembly.ts variantCastOf now takes
  a follow-up variant placed at its event (nearer than half the first frame the battle skill's windows allow the
  counter: 269.81, 329.46, 419.96, 505.25 s); replayrun.ts replayedSkill skips a hitless event while the kit holds
  the slot's other variant (the enemy away: 264.25, 325.64, 395.79, 400.31, 407.54, 500.37 s; each later counter
  comes inside the 10 s of the battle skill before, so these didn't use it up). 04d4 621 → 0 SP; measure: 04d4 plain
  590 → 597, per-hit error 5.82 → 5.68%, 99fb plain 183 → 190; earlier pending plain 84.6 → 84.7%. After it: 15 of 65
  logs, 27 casts, 706 SP.
- Ruled out: teammates' unlanded Final Strikes (232 placed Final Strike casts in the 15 short logs, every logged hit
  landed: scripts/probes/sp/unlanded.ts); a kit missing an SP key the data grants (scripts/probes/sp/keys.ts; Laevatain's
  P1 return on her empowered hit was already read).
- Engine assumptions `sp-regen` (`pause`, the default; `ticks`: 4 SP every 0.5 s, the timer restarting at each spend)
  and `sp-start` (`200`, the default; `full`), resources.ts spAt / spReachedAt, the state's spTick, timing.ts and
  wake.ts reading it, the search keying the ticks' phase. Under them (scripts/probes/sp/readings.ts): `ticks` 11 logs /
  577 SP, `pause` + `full` 5 / 323, `ticks` + `full` 5 / 251. Five logs are short in their first 12 s whatever the
  regeneration (79cc: four battle skills in 11 s, 92 SP); a full start covers them all. In-game test 113 (the bar at
  a fight's start) is ready; 102 stays not testable.
- Scoreboard (snapshots:update): verified, development, hold-out and several targets unchanged; earlier pending plain
  84.6 → 84.7% (04d4 mixed: plain 590 → 597, mismatch 293 → 292, damage −1.4 → −1.5%, its skipped presses no longer
  making Purrchena's on-cast gear buff; 99fb better, 183 → 190). team-ab against 10aa577 at the defaults: every
  number +0.00% (only the rule text differs). With `ticks` and `full` as the defaults (a run to see what they'd move,
  not committed), sustained DPS: the owner's team 53,513 → 54,517 (+1.9%) full energy, 53,059 → 53,482 (+0.8%) zero;
  Typhoeus's team 56,949 → 57,845 (+1.6%), 55,172 → 58,090 (+5.3%); the scenarios' 60 s timelines +0.7% / 0 / 0 / 0.
  main merged at 1771492 (the combo hold's readings, no fight moved); the final measure against it.

**Decisions:** the defaults stay: the logs only bound SP from below, so a more generous reading can't be shown
right by them; the start's 200 is the native settings' (as Endaxis reads them) and test 113 can decide it by eye;
`ticks` fits 666bj's test and the data no better than `pause`, and keys a search state's tick phase (fewer merges).
A hitless counter press is skipped, not made: making it used the counter up, and the counters the log shows after
it were then forced against the kit.

**Problems:** the lock queue (another agent's measures) cost about 15 min per measure; a first version made the
hitless presses as counters, measured, then replaced by the skip (the forced counters after them).

**Left:** test 113; 1d91 52.27 s, 79cc 28.70 / 31.47 s, 9c6e 51.83 / 76.50 s, af7b 36.60 s; f574's Mi Fu Trail and
Mangle on two slugs placed as two casts (a several-targets placement case: 50 SP spent twice).
