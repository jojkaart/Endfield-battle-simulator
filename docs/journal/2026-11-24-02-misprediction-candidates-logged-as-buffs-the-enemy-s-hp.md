## 2026-11-24: Misprediction candidates: logged-as buffs, the enemy's HP, Ardelia's chain

**Goal:** work through the misprediction analysis's candidates (docs/analysis/2026-11-24-misprediction-stats.md): the
weapon "ready" buffs, the rest of the ×1.5 band, the fight-wide factors below the offsets screen, then the one-buff
list's largest; root cause and fix, or ruled out with why.

**Done** (the analysis's follow-up section; open-problems "Misprediction statistics"):
- **The "ready" buffs were a double count.** The consuming cast's hits list the attached buff with the modifier
  (`_valid`), not the kit buff's modifier-less gameBuff (`_exist`): the check added both (59 hits in 0c14, 7e19, d4fb,
  a27b). `loggedAs` on Grand Vision's and Glorious Memory's buffs, Aspirant's, Cohesive Traction's, and Yvonne's ultimate
  states (P5 child, 5082's 72 hits; found by scripts/probes/stats/doublecount.py).
- **The enemy's HP from a kill's total, in lives** (engine assumption `enemy-hp`, buffreplay.ts loggedEnemyHp): the
  replay had an HP only when the total was the data's Max HP. Chen Qianyu's P1 below half (d4fb ×1.16 below, ×1.00
  above; in-game test 69 decided from a27b) and Alesh's P5 ultimate (×1.5 below half: a9d7 6 of 6 over Si's two lives).
- **Ardelia's ×1.5 basic attacks were placements:** attacks 1 and 2 share a key; after attack 3 and a combo the
  placement took an older attack 1's window (logcasts.ts choose: the latest basic cast says the step).
- **Si's Amp in 9c0b:** her ultimate pressed before the log's first hit, skipped for energy the log can't show; made now.
- **Ruled out:** Liino's 7910 / af7b factors as builds (fit-build fits her clean hits as exported; the screen is right).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1 → 67.8%, matched 83.5 → 83.9%, mismatch 11.6 →
11.5%, mean |damage error| 7.2 → 7.0%; hold-out plain 77.6 → 78.3%, mismatch 6.2 → 5.9%, mean |damage error| 8.0 →
8.5% (2 better, 4 mixed, per hit closer; the total that moved most came with the "ready" fix, which exposed an
under-prediction the double count hid, as in 7e19); earlier pending plain 63.7 → 64.2%, 4.5 → 4.4%; all but the
hold-outs 5.7 → 5.5%. Better: d4fb +9.6 → +0.5% (plain 465 → 516), 9c0b −4.9 → +3.0% (367 → 410), a9d7 −5.0 →
−1.8%, c4f3 −5.0 → −3.1% (214 → 242), 5082, a27b. Totals worse with per-hit closer: 7e19 +2.0 → −6.6% (the
Endministrator +21.9 → +2.3% exposed Ember's −21.5% and Chen's ×1.15), 0c14 −3.5 → −4.9%, 4e36 and de6a (matched
closer, replay-only landings left). Teams (team-ab against a4f6ddb): every team's fight the same (the log check's changes only).

**Decisions:** the HP rule behind an assumption (the stage pools are a kill's total, not seen in any data file); lives
only where an away stretch starts at a multiple of Max HP (Si's eight fights all show it). The pre-log ultimate rule
only before the first hit: every unseen ultimate made regardless made 1cd1 −19.5% (docs/tried/).

**Left:** Liino's ultimate Amp starts later in the replay than in the game (1cd1, af7b: the replay's stop of her
ultimate covers teammates' logged hits); 7e19's Chen ×1.15; the one-buff list's rest.
