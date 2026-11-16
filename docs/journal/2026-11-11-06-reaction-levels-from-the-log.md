## 2026-11-11 (late): reaction levels from the log

Goal: 4a64's Corrosion at 52982 ms (replay level 2, the log's 1) and
3f78's at 46994 ms (replay 1, the log's 2). Verified: the replay's enemy
had other Cryst stacks (4a64: a Xaihi battle-skill hit at 33.8 s the log
never shows; 3f78: at 45458 ms Arcane's ultimate landed before Xaihi's
Cryst). Done: the buff replay is made again with the levels the log
shows (logcheck.ts loggedReactionLevels; TimelineScenario
loggedReactionLevels): by the reaction hit's damage, ties by the
reaction check. Decision: the damage alone doesn't decide 3f78 (level 1
with a set buff fits too) nor 489c's Combustion (level 3, or 1 with a
crit), hence the reaction check as tie-breaker, and the replay's own
where neither decides. 4a64 plain 68 → 114, 3f78 mismatches 8 → 5; the
hold-out plain +5, mean |damage| 18.4 → 18.7% (one log −8.3 → −10.1%).
Not done: the replay's inflictions themselves (casts whose hits the log
doesn't show) aren't checked against the log; that is the real fix.
