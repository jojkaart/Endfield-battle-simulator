## 2026-11-26: Alesh's Rare Fin: chance paths and a cast from the listing

**Goal:** casts and paths the log shows only through their listed buffs, as general rules: 0c14's eventless 12.5 s
Alesh combo and the Rare Fin path of her combos in 0c14, 4e36 and a9d7 (open-problems "0c14").

**Done** (open-problems "0c14: Si, and Rossi's later windows", "The damage factors"):
- **A chance jump the log decides** (engine drivers.ts replayCast `chanceJumps`, chanceJumpsOf, chancePathLandings):
  the trigger isn't rolled; a taken jump is scheduled at its frame; the logged landings go to the path's hits of the
  same keys at the same frames from the cast's start (Alesh: hook 22 / slam 38 against hook_ex 77 / slam_ex 93 after
  10 → 65). Simulations never pass it.
- **The replay's chance paths from the listing** (castassembly.ts listedPaths): her P3 team ATK, only on the Rare Fin
  slam, is listed from exactly the slam's logged ms in all six cases; not taken where P3 is listed somewhere but on no
  hit in 3 s after, a running run decided by its end (a refresh keeps the `since`). 17 decisions in 3 logs (PATH
  lines in `zmdlogs decisions`), none against the values.
- **A cast from a hit's listed buff** (engine assumption `listed-casts` `inferred`, castsFromHitBuffs): a buff exactly
  one kit hit gives, its run starting where no cast of the skill could have landed it, gets a cast timed to land the
  hit there, its path's earlier hits pinned; its landings count for nothing. One cast in 61 development logs (0c14 at
  12.00 s: its Thermite layer at 12.73 s against the log's 12.71 s).
- In-game test 71 part 1 as good as decided by 0c14 (seven consumptions, seven combos; a run-out, none).

**Scoreboard** (measure against ade98a1, both rules; `listed-casts` alone: 0c14 404 → 493): earlier pending plain
68.1 → 70.2%, mean |damage error| 3.6 → 3.5% (0c14 plain 338 → 493, mismatch 20 → 12, total −1.3 → −0.3%; 4e36 281 →
368, +2.2 → +0.9%); development plain 69.6 → 69.7% (a9d7 99 → 101, −2.2 → −2.6%: its rolled Rare Fin landings, which
the log hasn't, gone, Alesh matched −5.6 → −0.7%); hold-out plain 80.8 → 81.0% (1 better, 1 mixed: +4 plain, its
total further); verified unchanged; negative control within its bound. The snapshots' scoreboard: docs/accuracy.md.
team-ab: unchanged (no simulated fight moved).

**Decisions:** the path rule isn't an assumption (the listing's evidence is exact to the ms in every case); the cast
rule is (`listed-casts`), as a cast made with no hit or event could be invented. P3 itself stays the log's: judged by
the replay where every cast's path was decided, 0c14 gained 3 mismatches' worth and one hold-out log lost 47 plain,
which can't be diagnosed by hand (docs/tried/2026-11-26-chance-path-buffs-decided.diff). The Stagger at its breaking
hit and the lives model were not reached.

**Problems:** the first measure compared against snapshots another commit's code wrote; the same-key pairing of two
paths' hits was wrong where one key covers the whole skill (friction report docs/friction/2026-11-26-alesh-rare-fin.md).
