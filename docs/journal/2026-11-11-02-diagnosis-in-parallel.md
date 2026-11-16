## 2026-11-11 (later): Diagnosis in parallel

Goal (the owner): diagnose the development logs with several sub-agents
at once, small models first, a larger one for what they can't; fixes
made and verified here. Eleven reports in one round; what held up:
Lift's Stagger (above), the totals dropping a kill that landed 65 ms
late (a27b), Liino's lance layers taken from a log that lists none of
her buffs (1d91: plain 33 → 251), food the eny_0134 logs never list
(e989 fits Jakub's Legacy exactly: plain 0 → 179), Mi Fu's World
Splitter as Crush DMG (in-game test 91 answered, ×3.22 → exact), and an
operator's own ultimate stop not held by a combo's slow-down (Rossi's
crit buff in 9a80). Development plain 25.5 → 37.9%, hold-out 49.3 →
49.7%; the hold-out's mean damage error rose 19.7 → 20.3% with the last
change (fewer frames lost). Dead ends: Hard 33's slug (its number
shield goes with debuffs the engine keeps: an unmodelled boss phase),
Jade Vessel (the log lists it; it isn't the cause). Agents' first
explanations were often wrong (e989 "not constant", Rossi "placement");
the arithmetic in their reports was mostly right.
