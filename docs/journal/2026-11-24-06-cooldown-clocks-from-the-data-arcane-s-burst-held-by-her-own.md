## 2026-11-24: Cooldown clocks from the data, Arcane's burst held by her own ultimate, every finisher hit Staggered

**Goal:** the kit-buff and placement rounds' four leads: a per-trigger cooldown clock, a kit field for travelling
landings, Arcane's bursts in the replay, Ember's finisher in 7e19.

**Done** (open-problems "Misprediction statistics"; roadmap-details "The cooldown-clock round"):
- **KitTrigger.cooldownClock from the data.** The game has CD timers (AddGlobalCDTimer, or a `…_cd` buff) and timed
  markers (CreateTimedMarker); the compiler (kits.ts cooldownClockOf, skillData.ts cooldownTimers) matches each
  trigger's cooldown key to them: CD timers world (Swordmancer, Mi Fu's P3, Antal's heal, three claymores,
  suit_spellburst; Laevatain's absorb written by hand), markers raw (Glorious Memory, Sundering Steel, Xaihi's crystal,
  19 more). `trigger-cooldowns` now `kit` / `raw` / `world`; world cooldowns move with every world shift (stops,
  resets, hidden holds) and a start inside a stop is held by its rest. The two hold-outs' worse totals are Swordmancer's
  (a measure with only it on the world's clock moves both): replay-only 4.9 → 4.8%, log-only unchanged, so its dropped
  procs were ones the game didn't deal. No development log decides a marker's clock.
- **Arcane's bursts: her own ultimate's stop holds them** (`burst-stops` `all`). b7b3's touch at 4.95 s burst in the
  replay at 5.97 s inside her stop; the log's at 10.34 s. Her 130 bursts: within 150 ms 89 → 94, none 23 → 20,
  replay-only 24 → 21 (scripts/probes/bursts/arcane-bursts.ts). The element at her touch (test 33) explains none of
  the leads' cases.
- **Every finisher hit deals as on a Staggered enemy** (`finisher-stagger` `cast`): 7e19's hit_2 after Chen's stop read
  ×1.564 = ×1.43 × ×1.096, Chen's hit at that ms unstaggered; the only such finisher in the logs. 7e19 −4.9 → −1.1%.
- **KitHit.travels** (the compiler, from LaunchProjectile) reproduces the event rule for every projectile ultimate,
  with or without its contradiction check, but not the ability entities it also takes (Tangtang's stare: b7b3 47 → 45
  plain from its frame), so the rule keeps its check for them and skips it for travelling landings (placements as
  before; the dropped variant in docs/tried/2026-11-24-travelling-landings-only.diff).
- 4bfc 179.51 s (the lead's question): Empyrean's end by the log (Arclight's chain unbroken), the replay's empyrean
  buff ended early; not fixed.

**Scoreboard** (`npm run snapshots:update`): verified plain 77.9 → 78.2% (b7b3 44 → 47); development plain 67.8 →
67.9%, mismatch 11.5%, mean |damage error| 6.9 → 7.0%; hold-out 78.5%, 5.9%, 8.5% (2 better, 2 worse by totals:
Swordmancer, 1 other); earlier pending plain 64.6%, mismatch 13.9%, 4.3 → 4.2%. Worse: 6339 37.5 → 40.8% (its
finisher's replay-only hit_2 now Staggered), 79cc one plain (Ardelia's combo placed late from its projectile holds a
burst), 012a 0.6 → 0.7% (a burst matched as assumed). Teams (team-ab against e3272c6): Estella–Si–Akekuri–Arcane full
+0.01% sustained (60 s timeline +0.08%), zero +0.02%; Typhoeus–Arcane–Liino–Perlica sustained unchanged, its full 60 s
timeline −0.51%.

**Decisions:** the clock from the game's mechanism, not per kit, the explicit field only where the trigger reaches no
source (refused where the data says it); `burst-stops` `ultimates` measured and kept as a reading (combo slow-downs do
hold bursts: e82d, c6d8, four hold-outs worse).

**Dead ends:** the travelling field alone as the event rule (above).
