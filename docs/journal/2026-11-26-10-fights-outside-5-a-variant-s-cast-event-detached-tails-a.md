## 2026-11-26: Fights outside 5%: a variant's cast event, detached tails, a carried Corrosion

**Goal:** the development and earlier-pending fights whose totals are off by more than 5% (8915, 7b54, 6339, c6d8:
stage logs; 9c6e, c83c, 7910, db87, e82d), split by operator and landing kind, fixed by mechanisms (open-problems
"Fight totals", round 5).

**Done:**
- **db87 (−6.0 → −1.2%): a cast event logged as its button's other variant.** Every Twilight battle-skill hit was
  ×1.3000, Link (1) from Camille's combo: the log records the presses as `normal_skill`, and the replay made each as a
  forced normal_skill besides the placed normal_skill_during_ult; that phantom took the Link and landed an explosion
  and ticks the log never shows. logcasts.ts `buttonVariants` (one castable only without a buff the other needs,
  neither giving it on its cast: Purrchena's battle skill readies her counter, so it isn't one), castassembly.ts
  `variantCastOf`; the placement times the variant from that event (the 27.13 s press before Si's ultimate stop).
- **c83c (+7.9 → +1.9%): a tail cut takes detached landings.** Si's combo final (an ability entity's detached hit,
  374k) a frame after her last logged slash survived the cut (at lastLogged + 1, after that frame's hits, detached
  ones exempt). Now at the last logged landing's frame, dropping the cast's later hits, detached too (drivers.ts
  `endsAt`). The hold-outs moved most from this.
- **7910 (−6.1 → 0.0%): a carried Corrosion above its cap stays.** Hits 51–62 s ×1.099 (one resistance step, the same
  +11.35 points for everyone) after Ardelia's forced level-1 Corrosion replaced Arcane's level 4: the data's tick
  adds and clamps only below the cap (reactions.ts corrosionShred; combat-mechanics §3.5).

**Scoreboard** (`measure --base 9e1904d` after merging main, then `npm run snapshots:update`): development mean
|damage error| 6.8 → 6.3%, within 5% 25 → 28, plain 71.8 → 72.7%, mismatch 11.2 → 10.6%; hold-out 8.4 → 7.4% (4
better, 1 mixed: plain −1, assumed +1), plain 82.1%; earlier pending plain 72.9 → 73.0%, 3.4 → 3.5% (4bfc −0.8 →
−1.0%, 3aa6 mixed: plain +6, total 0.2 → 0.6%, d4fb better). Worse: 79cc 0.0 → −0.1%, 4bfc: replay-only tail
landings removed from fights the replay under-predicts. team-ab (against 36e3bc8): only estella-si-akekuri-arcane
(zero energy)'s 60 s timeline moved, +0.83% (the Corrosion rule); sustained DPS unchanged.

**Decisions:** the Corrosion rule isn't an assumption (the data's gate is explicit and 7910's 143 hits fit it); the
variant rule needs complementary availability, not the same kind alone (04d4 and 99fb lost 91 and 30 plain with
kind only). Stage logs left (no enemy data for hsbear_hdg018 or wgabyss_hdg011). By-operator means are each
operator's own total, mostly the stage logs and small totals (Liino's unlogged beats).

**Left:** slots by value (9c0b's Hunter Pursuit, whose misplaced first landing sends its Link to the wrong cast;
7910's rogue wave), e82d's Si combo final (Arcane's weapon WILL lines ×5 listed, ×2 in the engine), 9c6e (two
targets). Friction report docs/friction/2026-11-26-totals-off.md.
