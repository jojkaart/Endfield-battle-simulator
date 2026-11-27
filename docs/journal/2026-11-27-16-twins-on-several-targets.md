## 2026-11-27: Twins on several targets

**Goal:** on main at de528c7 (merged with 22750d2), beside the build-fit agent: the placement's same-ms twins in the
several-targets fights (7b54's Si combos: 2 slashes × 4 slugs at 15.60 s took eight of the ten slash slots, a second
combo opened for the rest), then which of 6339's, 7b54's and 9c6e's one-sided landings are placement errors.

**Done:**
- **logcasts.ts placeWith** (fights read per target only): where value can't tell a twin from the next slot (the
  slots' multipliers alike, `nextDiffers` false), a batch of the key's alike hits at one ms is `targets` hits per
  landing (targets.ts `batchTargets`: the least k with hit i and i + k of one target by value for every i,
  `oneTargetByValue`: one value, or a crit the panel's crit factor above; a batch two landings long, else the count an
  earlier batch of the cast read); a slot's multipliers over event counts tell a twin by value too (Si's final); a
  used-up combo's landing within 150 ms of its last, of its value, no cast event between, is its last landing on
  another target (`later`: 7b54 16.48 s, a third slug's final). Combos only for `later`: on every kind it took
  Typhoeus's shots, Ardelia's attack 3 and Liino's beats in 9c6e for twins; the batch rule on landing-long batches
  made 9c6e's Ardelia 224 / 259 (a debuff between) twins: both lost plain hits (314 → 312, mismatch 33 → 44), now no
  9c6e cast moves. targets.ts's assignment reads the twins as before (one landing reaches each target once).
- **Decision lines:** PlacedHit.twin (`value`, `used`, `batch` with its targets and batch size, `later`);
  `zmdlogs casts --choices` prints it on each twin's HIT line, `casts --json` carries it.
- **`zmdlogs hits --json` `target`** (index, how, drop, kills; text lines `T<n>`): the several-targets friction
  report's point 2.
- several-targets reading **`targets-ungated`** (every twin copied in the totals, fitting or not): registered and
  measured, not the default (docs/design/assumptions.md).
- tests/target-twins.test.ts.

**Scoreboard** (`npm run snapshots:update`; measure against 22750d2): only the several-targets row moves: plain
68.5 → 70.6%, mismatch 15.4 → 15.3%, mean |damage error| 16.1 → 8.3%; 7b54 plain 99 → 115, +26.8 → −3.3%; 6339 and
9c6e unchanged. Development, earlier pending, verified and hold-outs unchanged (no unmarked log reads it); no
simulation reads it: no team-ab.

**Found, not placement errors** (docs/open-problems.md "Hard 33's Woodcraft Slugs"):
- Camille's `normal_skill_abilityrange` (6339 ×5, 7b54 ×1): her Vesperwings moving to the next target at its own
  target's death (listen_target_dead → reset_target → projhit_sub), the battle skill's damage, Heat and
  Susceptibility again; five of six 0.23–0.54 s after a logged kill. ZMDLogs logs a normal_skill event at four of them,
  which the replay makes as presses, standing in for the move. Reading those events as no press: 6339 plain 115 →
  103, −10.3 → −15.2% (docs/tried/2026-11-27-sub-skill-events.diff). Needs a kit hit (packages/data) and a pressless
  replay landing.
- 6339's 35.70 s Laevatain empowered hit: her Melting Flame a stack short at 32.24 s (likely the move's Heat).
- 6339's 21.60 s hit_2: TAILKEPT's guard passes the cast's own killing hit by rounding (logged 0.3 ms after its
  frame); the exact guard: development plain 84.3 → 83.7% (c4f3 −66), hold-out |damage error| 5.8 → 5.9%
  (docs/tried/2026-11-27-tail-own-landing.diff).
- 6339's 19.91 s Si ink burst: her presses before it are on shielded slugs (no hit, no listing), so the Final Stroke
  is skipped; what a shielded-slug state would need is in open-problems.
- 7b54's 47.2–48.1 s twins log-only: every slug's slash reads ×1.26 high (a kit-buff difference, mismatched before
  too). 9c6e's: statuses per target.

**Dead ends:** a time-based twin count (slots due by the batch's ms): the first batch's slashes come before the kit
frames allow from the event (the stop batches them), so time can't count slots there.
