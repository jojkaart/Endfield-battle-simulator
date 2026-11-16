## 2026-11-16: Rule-based rotations, phase 1

Goal (the owner): rotations a person can learn and play: a short opener
and a priority list "when cue X is visible, do Y", played by a simulated
player with a reaction delay, measured by sustained DPS over a long
fight. Done (design.md "Rule-based rotations", with the owner's cue
ranking): the format (schemas/rules.schema.json; cues only from what the
UI shows, plus a few justified operator states), the driver (engine
policy.ts `playRules`, frame by frame on init / advance / startsNow /
apply, no fork of the damage model; reaction delay 0.3 s ± 50% seeded,
drawn at each cue's onset; pairs; opener; basic-attack or dive filler),
learnability (cue cost by rank, complexity), `efsim rules` (sustained
DPS, spread over seeds, rolled crits, robustness at 0 / 0.3 / 0.6 s,
rules fired, the scenario's rotation as the 60 s reference), the rule
search (policysearch.ts, local search, Pareto front of DPS against
complexity), tests (tests/policy.test.ts), examples/*.rules.json, each
team page's "Rules", in-game test 108 (the Finisher input).

Results (sustained DPS over 300 s, 0.3 s delay, 10 seeds, full energy /
from zero): the owner's team 55,462 / 56,370 (hand-written list; first
60 s −8.8% / +4.2% against the 60 s timelines; its 300 s total +18.9%
over a fixed 300 s search at beam 6); Ink Melt 66,058 / 60,464 (searched:
+28% over the hand-written list; first 60 s −25.5% / −45.8%; 300 s
+20.8% over the fixed search); Typhoeus's team 53,302 / 48,560
(searched: +16%; first 60 s −28.2% / −47.5%; 300 s −5.5% under the fixed
search). Over a long fight the rules match or beat the beam-6 search; the
60 s timelines stay well above them for Ink Melt and Typhoeus.
Decisions: a press may start only where earliestStart from the state
after the last press agrees, and is applied to that state, so `simulate`
replays the rules' rotation exactly (startsNow on the state advanced
frame by frame allowed Typhoeus's battle skill 48 frames sooner than
the replay could cast it, after a dive; found by the replay check); the
finisher is part of the basic attack (no delay; test 108 checks the
assumption); no swaps; no timers in the search's cues. Problems: the
fight is chaotic for the driver too: a list's sustained DPS moves 2–5%
(sd) between reaction-delay seeds, so the search chases noise at 2–3
seeds (the owner's team: every "gain" vanished at 10 seeds) and the bot
is sometimes worse than the 0.3 s player; the gains that held (Ink Melt,
Typhoeus) were 15–30%. The basic attack's options judged at every frame
were most of a run's time: now from their earliest start after each
press (exact; `judgeEveryFrame` checks it).
