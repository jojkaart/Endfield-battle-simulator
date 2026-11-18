## 2026-11-18: Arcane's mismatches as one group: lasers on the world's clock, chance-path buffs

**Goal:** Arcane was the most-mismatched operator (908 of 5,575 hits in
the logs the scoreboard counts); look at her misses together, find the
shared causes, fix what's general.

**Done:** grouped every Arcane mismatch (scratch scripts over `zmdlogs
hits --json`: each against teammates' mismatches at the same ratio within
1.5 s, and the engine's modifiers against the log's listing). The groups,
causes and what's left are in docs/open-problems.md ("Arcane's mismatches
as one group"). In short: 557 are the stage logs, 15 d9e5's fight-wide
factor (now ×1.12–1.20 on everyone, not ×1.7–2.0), ~143 team-wide
(Stagger, placement, Corrosion levels), ~110 teammates' buffs on her
basic-attack strings (Alesh, Liino, Ardelia, Camille), the rest her lasers
and her combo's explosion. Two fixes:

- **Her lasers on the world's clock.** The Cluster Strike lasers and the
  INT early end's lasers are buff timelines (`buff_…_inaura_laser1/2`,
  `seal_finisher_wisd`); the game runs buffs on the world's time, so her
  own ultimate stop holds them, which it doesn't hold on her own clock.
  Players cast Gloompurge Arcana as soon as the second strike makes it
  castable, so that strike's lasers fell in her own stop (a7a7: logged at
  55.99–56.47 s, the replay had 54.3–54.9 s). The "hits" trigger action
  has `world` now (engine, loader, schema; tests/world-clock-hits.test.ts).
  a7a7 Arcane mismatches 28 → 19; scoreboard rows unchanged.
- **Buffs only a chance path's hit applies are the log's to say.** The
  replay rolls Alesh's Rare Fin itself; in ad7f it rolled one his logged
  slam doesn't fit, and his P3 team ATK stood on 10 s of hits the log
  lists it on none of. buffreplay.ts `chancePathBuff` makes such a buff
  unjudged. ad7f Arcane 34 → 1 mismatches, Si 80 → 100 plain; 4e36 plain
  117 → 239.

Scoreboard (the tool's output, both commits): development plain 47.3% →
47.7%, mismatch 19.8% → 19.6%, mean |damage error| 15.8% → 15.7% (5
better, 0 worse); hold-out plain 62.1% → 63.3%, mismatch 7.6% → 7.7%,
mean |damage error| 13.5% → 13.4% (3 better, 1 worse); earlier pending
plain 45.1% → 46.2% (0c14 mixed: Si's log-listing fallbacks 7 → 1 in a
log where 190 of his 194 hits fit no reading). Arcane 908 → 866
mismatches, plain 3,277 → 3,328.

Teams (`efsim rules`, 32 fresh seeds 1001–1032): the owner's team 53,781
→ 53,780 / 52,740 → 52,744 (from zero); Typhoeus's 52,369 → 52,374 /
48,967 → 48,973: no movement (the team pages keep their numbers).

**Dead end:** a freeze holding only the freezer's own debuffs on every
enemy (ad7f's Imprisonment ends 2.5 s late in the replay because Si's
Immobilization holds it): 489c, b6aa, 7910 worse, hold-out plain 63.3 →
62.9%. Rejected, as the freeze code's evidence said.

**Left (open-problems):** Imprisonment's end, which the log records as a
combo cast before each explosion: the replay's is a median 0.3 s late
(4d60 1 s on every window); the seal buff's abilityEvent 8 / 1403 / 1601
end it early and aren't decoded. a7a7's INT lasers 0.4–1.1 s early. For
the parallel agents: db87's first strike (Laevatain's ultimate stop
missing from the placement), fc63's second (Typhoeus's shot count), and
the ×1.3 runs of 1d91 70–72 s and 4d60 80 s (Stagger). Alesh is ×0.85 on
every hit in ad7f (his build), untouched.
