## 2026-11-28: Typhoeus's Barrage Array on the world's clock

**Goal:** round 22's open part (docs/journal/2026-11-28-01-needed-on-the-check-s-pairing-a-channel-s-end-in-a-detached.md):
why Typhoeus's Barrage Array runs past its entity's 180 frames (its kit had the data's end left out, dataOverride
`latest`), and why its first tick comes 0.5–0.7 s after the combo's press against the kit's frame 35.

**Found (data and every Typhoeus development log, scratch surveys):**
- The data: chr_0034_typhoea_combo_persistentdamage lasts 180 frames (persistent_time 6 s at every skill level), a
  ChannelingAction every 1/3 s capped at 18 per target: ticks at its frames 0–170. No longer life, no refresh: every
  full array has exactly the cap's 18 ticks.
- Its clock is the world's. Over the 32 arrays of 12 logs, the 18-tick ones span 5.74–9.75 s of log time; with every
  stop the replay applied taken out, her own ultimate's included, and the hidden holds the replay placed, 5.56–6.17 s
  against 5.67 s. Her own ultimate holds it: fc63 90.53→92.87 s, 2.35 s of log time between two ticks, 0.28 s with her
  stop out (her clock isn't held by her own stop). Her own combo's slow-down doesn't (its ignore list spares her
  spawned objects; the array starts after it anyway).
- The first tick lands at the first arrow's ms in all 32 arrays: the entity spawns at the arrow's hit (frame 35), as
  the kit has it. The 0.5–0.7 s from the press is her combo event's usual lag (median 0.52 s over 23 combos; every
  combo's event lags its frame 0 by 0.3–0.7 s, docs/design/data.md "What the log records"), not an early spawn.

**Done:**
- Kit: both combos' `area` hits `world: true`, `launch: 35` (the data's LaunchProjectile at 35, kitMatch agrees); the
  `latest` override gone, so they have the data's end, frame 215.
- Engine: ScheduledHeader.worldFromLaunch (casting.ts for a `world` hit with a `launch`; schedule.ts shiftClock reads
  it): on the caster's clock until the launch, the world's from then. A `world` hit without a launch as before. Zhuang
  Fangyi's Thunder Strikes (world, launch 13) take it too: no verdict moved. drivers.ts' channel-turn rule skips a
  world channel (its lateness already has the stops to come in it).
- Placement (logcasts.ts placeWith `onWorld`): a world channel's elapsed takes out every stop but its operator's own
  non-ultimate ones, and a tick past its end is a new cast's only with a logged press of the cast's kind between, no
  slack bound: the placement has no hidden holds (00ae 24.63 s: 6.79 s with the stops out, 0.68 s of hidden holds
  inside it later).
- tests/world-from-launch.test.ts (engine), tests/channel-ends.test.ts (the six arrays one combo each).

**Measured** (`npm run measure -- --at HEAD --base 0f3c894 --split files`): development, hold-out, earlier pending and
several targets unchanged; verified |damage error| 1.4 → 1.5% (dbae −2.6 → −3.0%, the kit alone). dbae's six unlogged
ticks were at kit frames on her clock, 14.10–15.77 s, beside the logged ticks of those slots' neighbours; held by her
ultimate they come at 16.17–16.83 s, three of them inside the fight's last 0.5 s (TAILKEPT fight-end): an
under-predicted fight loses wrong ticks that offset it. team-ab: the owner's team the same; Typhoeus's team full
+0.00%, zero +0.03% (32 seeds). The scoreboard: snapshots:update at the final commit (kit digests).

**Left:** dbae's and 00ae 24.63 s's arrays run 0.4 s past 170 frames with every stop and hold out (00ae's in Perlica's
and Gilberta's combo stops: the combos' known excess hold).
