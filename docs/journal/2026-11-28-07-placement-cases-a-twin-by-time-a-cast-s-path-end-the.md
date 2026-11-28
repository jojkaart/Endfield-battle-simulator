## 2026-11-28: Placement cases: a twin by time, a cast's path end, the Decisive Assault ruled out

**Goal:** three placement leads (docs/open-problems.md): Pogranichnik's Decisive Assault logged 0.21–0.44 s after
its event against the data's frame 25; f574's one Mi Fu Trail and Mangle on two slugs placed as two casts (50 SP
spent twice); the placement's log-only casts (f879 95.10, 5082 45.06, 3aa6 125.65 s). Base main at 2f4afbd.

**Done:**
- **A twin by time** (logcasts.ts placeWith `byTime`, PlacedTwin `time`; tests/target-twins.test.ts): in a fight
  read per target, a key's second hit at its slot's landing's ms, alike in value, where the next slot is due more
  than ON_TIME_MS later and no stop holds the world in the ON_TIME_MS before that ms (the log flushes about every
  100 ms and at a stop's end), is that landing on another target. f574's flurries (frames 3 and 10, alike) at one
  ms had been one slug's two flurries; now one cast, f574's SP short 110 → 56. It also pairs 9c6e's Barrage Array
  ticks on its two enemies and 7b54's Laevatain attack 2 at 16.36 s.
- **A cast's slots end with its path** (logcasts.ts pathEnd; tests/placement-cases.test.ts): a cast's slots, span
  and reach end at the skill's first InterruptCurSkillAction after its first landing (no jump between skipping it).
  de6a 132.20 s: Pogranichnik's combo (de6a logs no cast events) had joined the 108.61 s combo, whose path-0 slots ran
  into the jumped paths' 223–261. d572: Rossi's attack 4 hit_ai (past the jump to 189) no longer joined to a
  controlled-path cast.
- Lead 3: all three named casts were fixed 2026-11-27; the log-only list at 2f4afbd is in open-problems ("Log-only
  landings": Arcane's INT lasers, 8f32's crystal shatter, the Assaults, de6a's combo, now fixed).

**Scoreboard** (snapshots:update against HEAD): verified, development and hold-out unchanged; earlier pending plain
84.7 → 84.9%, mismatch 4.4%, |damage error| 1.2% (de6a better, plain 298 → 317, damage −0.5 → +0.1%; d572 mixed,
plain 1039 → 1044, damage 1.3 → 1.4%: its attack 4 a cast of its own); several targets plain 69.4%, mismatch 14.9%,
|damage error| 14.1 → 14.3% (f574 −26.5 → −27.4%, 9c6e −11.0 → −11.1%: the one cast lands less than the phantom
second did; f574's replay values run ×0.83 of the slugs' logged ones anyway). No engine or kit change: no team-ab.

**The Decisive Assault (not built):** by event kind, after his combo slash 0.21–0.25 s (one 0.70 s), after a
teammate's Lift 0.25–0.44 s, after his own Breach 1.04 s; the harasses after a slash 0.6 s. Ruled out: its own
slow-down (finish4's curve: frame 25 at 34.9 frames, `harass-slowdown.ts finish4`), the final rush's 1 s slow-down as
a world-wide one (teammates' hits at their kit frames across it in d4fb and 7e19; the buff is on the enemy), an
earlier trigger (none 1.0–1.2 s before six of the nine). A frame from the logs alone would be a fit.

**Dead end:** 8f32 38.50 s (the Endministrator's crystal shatter, −1.28%): Rossi's combo 2 hit_2 at 36.11 s taken
for a combo 3 perfect strike (its Lift 2.4 s early, before the crystals). A rule keeping it on the open combo by its
value was dropped unmeasured: the perfect strike's multiplier (`consumed`-scaled) has no nominal scale, so no value
rule can compare it; next a lower bound for such multipliers. Friction: docs/friction/2026-11-28-placement-cases.md.
