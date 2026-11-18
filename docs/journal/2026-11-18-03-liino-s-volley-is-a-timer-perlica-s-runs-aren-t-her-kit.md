## 2026-11-18: Liino's volley is a timer; Perlica's runs aren't her kit

**Goal:** two leads on Typhoeus's team: Liino's volleys (9090: 10 logged, 1 replayed) with 1d91's doubling, and
Perlica's ×1.3/×1.5 runs (4360, 9847, …) and fc63's ×0.934.

**Liino's volley.** Her volley buff (spelllnfliction_extraattack) ticks every 10 s from the battle skill's frame 45,
first at once, and its tick's reaction check has `isEnable false`: a plain timer, not test 26's reading B (a reaction,
then 10 s). `efsim gamedata tree` left disabled actions out as defaults, which is how the dead condition read as live
for months; it now prints `DISABLED`. The logs agree (103 volleys, 10.0–11.7 s of world time apart, also with no stop
between). The kit's volley_window ticks; since the game's clock for it runs ~5% slower than the replay's world time
(as her beats' does), the replay takes each tick from its logged volley (`KitBuff.ticksShownByHits`). 1d91's "doubling"
was the team's buffs (Ardelia's Susceptibility and Arts DMG Taken, Arcane's WILL, usp02): its 886s now match plainly.
In-game test 26 is answered by the data and the logs (told to the lead; in-game-tests.md is another agent's).

**Perlica.** Not her kit. Talent 1 fits where the engine gives it; 9847's runs are team-wide (Gilberta, Avywenna,
Liino at the same ratios: Bigents' fight). 4360's ×0.62–0.70 run was Liino's Cosmovoice kept on past an End Stance the
log doesn't record: the kit can't cast her battle skill in Cosmovoice, the replay made it anyway. The replay now infers
the exit press after the log's last listing of the stance's buffs (`exitPresses`). fc63's ×0.934 is her ATK (3,571
from 30 hits, against 3,822); no weapon level or skill level at her logged level 90 gives it, and the "artifice read as
0" candidate is ruled out by direction.

**Scoreboard** (docs/accuracy.md): verified plain 71.0 → 72.8%; development plain 49.5 → 50.8%, mismatch 19.3 →
19.0%, mean |damage error| 13.0 → 12.9%; hold-out plain 65.0 → 66.0%, mismatch 7.4 → 7.2%, error 12.5 → 12.4%. Logs
better 12, worse 1 (891: its Liino volleys are ×0.1 the engine's, like c6d8's every hit, so landing more of them adds
to an existing overshoot), mixed 4. Team (32 seeds): 52,374 → 52,529 / 48,973 → 49,185.

**Dead ends:** reading Liino's battle-skill events at a volley's first-hit ms (37 of 100 volleys have one) as the
volley's own, not beats: only 1d91 and 7910 moved, both worse (their stance was cast before the log). Pinning every
ticking buff to its logged hits also fixed Rossi's bleed (489c mismatch 124 → 111) but is outside this task: opt-in
for Liino only, a lead for Rossi's kit.
