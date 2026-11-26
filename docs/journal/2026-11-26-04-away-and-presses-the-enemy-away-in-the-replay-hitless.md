## 2026-11-26: Away and presses: the enemy away in the replay, hitless presses from the listing, layers

**Goal:** build as general rules what the damage-factors round hard-coded or held back: the enemy away from the fight
in the replay (0c14's Si press at 139.68 s), a press with no logged hit inferred from a buff only its hit gives (her
153.99 s press), Rossi's slash2 extras at a life's or fight's end, an untracked layered buff's layers (Ember, 7e19);
then whether a fixed delay per stop edge explains the combos' extra hold.

**Done** (open-problems "The damage factors", "The enemy's clock"):
- **The replay's enemy away** (engine assumption enemy-away `absent`, the new default; TimelineScenario.enemyAway,
  landing.ts): a hit from the frame after a stretch's last logged hit to the frame before the next applies nothing to
  the enemy (damage, applications, Stagger, enemy-side buffs, hit events); the operators' own buffs from it still come
  (d774's and 9c6e's Liino presses there put her stance's ATK on the team, as the log lists after). The totals leave out
  every unmatched landing from the stretch's first frame on (the enemy leaves with its last logged hit). An Arts Burst
  still lands: holding it back lost 4a64's Arcane weapon debuff the log lists (6 plain), so only its damage is left out.
- **Hitless presses** (`hitless-presses` `inferred`, the new default; buffreplay.ts inferredPress): made only with the
  log's own cast event, the enemy there, the next hit within 1.5 s listing a new run of a decided buff that the replay
  gives with the press and not without; the press after it is then the variant it pulls; its own landings aren't
  counted. Two presses across the logs: 0c14's Si (153.99 s) and 8915's Liino (111.23 s). Alesh's eventless 0c14 combo
  stays open. A recorded burst whose applier is unlogged is now unread (more than twice the buff's life away), not
  read over 73 s of hits.
- **Life ends and kills:** a fight of several lives ends in a kill when its last life dealt one Max HP (lastLifeKilled,
  read by the totals and enemy-hp `kill`). With the leaving frame it covers 4a64's both slash2s (+2.9 → +0.8%); 207f's
  stays (no kill the log shows). Both held-back diffs deleted (docs/tried/README.md).
- **Layers:** the check reads an unjudged kit buff on one timer (stackingType 8/10) listed once at each count to its
  maximum (enginecheck.ts unjudgedLayered): 7e19 mismatch 4 → 1, 04d4 616 → 614, 99fb 116 → 111; 7e19's 33.15 s
  ×1.096 is left (no listing then). Negative control holds.
- **Item 5:** one constant per combo fits as well as a share (probes combo-hold/edge-casts.ts, edge-ticks.ts), but
  57 ms a combo for the enemy's ticks against 140 ms for the operators' casts: one delay on the world's clock is ruled
  out. Next: where in the combo the operators' excess sits.

**Scoreboard** (`npm run snapshots:update`): development plain 69.0%, mismatch 11.4%, mean |damage error| 7.0%
(unchanged; 4a64 better; 891566, 9c6e, a9d7 slightly worse); hold-out plain 80.4 → 80.6%, mismatch 5.6%, mean |damage
error| 8.4% (1 better, 1 mixed: +12 plain, its total further); earlier pending plain 66.3 → 67.3%, mismatch 12.0 →
11.9%, mean |damage error| 4.1 → 4.0% (0c14 plain 172 → 293, −3.4 → +2.7%). team-ab: unchanged (simulations never set
enemyAway). Smoke passed.

**Decisions:** both readings default, with the others kept (`away`, `absent-edge`, `skipped`): `absent` against
`absent-edge` because the logs record every landing (d774's unlogged strikes 0.23 and 0.27 s into its stretches).
The hold-out mixed log's total getting further fits 0c14's pattern: the readings that now fit raise the total onto an
over-prediction elsewhere. a9d7's Chen (an ultimate final 0.74 s into a stretch no longer refreshing a buff the log
lists later) is reported, not fixed.

**Problems:** the replay view's EVENT line called the inferred Liino press a tick; kill and life detection live in two
places; a burst's unbounded record start was silent (friction report).
