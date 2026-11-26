## 2026-11-26: A stop's batched landings: the log's Stagger bars give their order; Pogranichnik's Morale before the damage

**Goal:** the order of the landings the log batches at a stop's end (c4f3 7.05 s: Chen Qianyu's combo shattered the
Solidification in the replay, Estella's in the game), as a general rule; the Vulnerable stacks c4f3's 13.07 s Breach
consumed (three in the replay, four by the next combo's path); if time, d4fb 86.67 s (Pogranichnik's bank 0.3 s late)
and 7910's early rogue wave.

**Done:**
- **A logged ms is a batch, its order the Stagger bars'.** The log flushes every ~100 ms and at a stop's end, so one ms
  holds hits up to three frames apart; each Stagger event's bar (the one before it less its dealt) falls in the game's
  order. c4f3 7049 ms: Estella's combo 274 → 264 (the Shatter credited to it), her ultimate 254 → 234, Chen's combo and
  the Lifts 234 → 224 (open-problems had read the bars backwards). Over the development logs' 60 pairs of two operators'
  events at one ms the bars follow neither the operator IDs (28 right), the team's order (39) nor the casts' starts (29
  of 44: why docs/tried/2026-11-24-same-ms-cast-order.diff was mixed): the game's time order inside the batch, which only
  the bars keep (scripts/probes/physical/batch-rules.ts). The replay now lands pinned landings at one logged ms in the
  bars' order (castassembly.ts `batchOrder` → landings' `order` → engine `ScheduledHeader.loggedOrder`, schedule.ts
  `dueBefore`). Simulations keep the ID order: no rule from cast data fits.
- **Lead 2 was a knock-on of lead 1.** With the batch's order Estella's Lift adds the Vulnerable stack Chen's Shatter
  had not, and c4f3's 13.07 s Breach consumes four; every Breach or Crush before a Pogranichnik combo whose path its
  values decide now consumes the path's stacks (25 combos; at cbe7d5b c4f3 13.67 s alone differed:
  scripts/probes/physical/breach-path.ts). c4f3's hits from 7.05 to 14.43 s replay exact.
- **Fervent Morale before the damage of the hit that makes it** (lead 3, d4fb 86.67 s): the layer the logs list since a
  Breach's ms is talent 2's, from his ultimate's follow-up on his own physical status, which comes with the data's
  FractureAction before the battle skill's DamageAction: `beforeDamage` on oath_harass_status_self / _mate (d4fb 86.67,
  161.59 s, c4f3 71.15 s, a9d7 205.06 s, de6a 26.03 s exact). And a hit's stacks gained with its SP before the damage
  raise their stacks event then (landing.ts; only Pogranichnik's hits have both): the bank's layer counts for the slash
  that filled it (d4fb 47.92 s).

**Scoreboard** (`npm run snapshots:update`): development plain 73.8 → 75.7%, mismatch 10.5 → 10.2%, mean |damage error|
6.1 → 5.9%; hold-out plain 82.1 → 82.2%, 7.4 → 7.1% (2 better, none worse); earlier pending plain 73.0 → 77.7%,
mismatch 11.7 → 11.3%, 3.5 → 3.4%. Chen 43.0 → 74.3% plain, Pogranichnik 52.1 → 75.3%, Estella 59.9 → 81.0%, the male
Endministrator 52.9 → 88.7%, Lifeng 43.5 → 91.2%. Better c4f3 (275 → 464, −3.4 → −0.8%), 3f78 (91 → 147, −3.7 →
0.0%), a9d7 (265 → 333, −3.3 → −1.5%), d4fb (516 → 844), de6a (71 → 287), 458b, 7e19 and four by a hit or two. Mixed
b7b3 (0.4 → 0.7%: Tangtang's battle-skill shot before Last Rite's combo by the bars, now an exact read crit, which had
hidden her expected-crit landings' +12%; Arcane's touch at 7.15 s now exact) and 4bfc (−1.0 → −1.2%: Arclight's burst at
88.82 s matched, Zhuang Fangyi's replay-only 19,584 gone). The per-operator total errors that rose (Arclight 4.8 → 5.7%,
Tangtang 3.6 → 4.0%, Lifeng 0.9 → 1.3%) are those hits turning exact. team-ab: unchanged (both teams' own fights the same,
the owner's Estella team included). The example pogranichnik-chen moved (+1.5%, the Morale timing), snapshot updated.

**Decisions:** the bars are read only where the batch has two Stagger origins and two bars; several events at bar 0
(a break) share a place, as do events without Stagger (the ID order then). schedule.ts, state.ts and planning/search.ts
(a key field) were outside the brief's file list: one line each for `loggedOrder`. No assumption: the bars are the log's
own record of the order.

**Left:** Estella's weapon ATK at 7.05 s (her combo, Shatter and Lift with it, her ultimate after them without it: one
batch, not built); the harasses' logged delays (0.6–1.3 s, the kit's 0.3 s) and d4fb's 88.55 s harass and 89.82 s
Assault placed as an ultimate the replay doesn't cast; c4f3 92.93 / 147.41 s and a9d7 239.40 s Morale layers; 7910's
early rogue wave (not attempted).
