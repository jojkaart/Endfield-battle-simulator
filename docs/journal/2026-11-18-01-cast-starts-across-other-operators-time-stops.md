## 2026-11-18: Cast starts across other operators' time stops

**Goal:** the log check placed casts too late where a teammate's time stop
fell between a cast's press and its first landing (Typhoeus in 1cd1, 9090,
dbae: her combo or battle skill up to 3 s late, so the replay cast it after
her hover ended); fix it generally (docs/open-problems.md, "Typhoeus,
Arcane, Liino, Perlica").

**Root cause:** logcasts.ts started each new cast at its first landing less
the landing's kit frame, ignoring the stops between (which hold the cast's
frames while the log's clock runs on).

**Done (packages/logs):**
- `heldStart`: the landing's frames counted back in the world's time (a
  stop's frames at its scale). `castStart` uses it only when the log's cast
  event of the skill is nearer the held start than the plain one, and never
  before that event; a combo isn't held by other combos' dilations; events
  logged at the same ms as another operator's time-stopping cast's event
  don't count (pressed during its stop, logged at its end).
- `castEventOf`: a cast event of a skill the kit doesn't have names the
  slot's skill (Typhoeus's normal_skill → normal_skill_floating_start,
  ultimate_skill → ultimate_skillfloating); `unplacedCastStops` uses it, so
  her ultimate's stop is no longer added twice.
- `missedCasts` (buffreplay.ts) looks again for a missed shot's first frame
  past a stop that holds it (dbae's battle skill, now before Li Zhiyan's
  ultimate, kept its two missed shots).
- A landing logged at its cast's last landing's time, all landings logged,
  is the same landing on another enemy (`PlacedHit.sameAs`, sharing the
  replay's landing), not a second cast (9c6e, a two-target log).
- Tests: tests/logcasts-stops.test.ts, two in tests/buffreplay-typhoeus.test.ts.

**Scoreboard** (`npm run snapshots:update`): development plain 47.3 →
48.0%, mismatch 19.8 → 19.7%, mean |damage error| 15.8 → 14.0%; hold-out
plain 62.1 → 62.2%, mismatch 7.6 → 7.4%, damage 13.5 → 13.0%; verified
unchanged. 1cd1 plain 138 → 161 (mismatches 28 → 5), 9090 818 → 834, 4d60
328 → 336, 9c6e totals +52.5 → −11.1% (mismatches 121 → 130: the second
enemy's hits against the first's landing). Worse only in totals by 0.1
point (af7b, b6aa: same-instant duplicate attacks merged); 458b mixed
(Jsspsi's ultimate from its event at 152.2 s, damage 2.2 → 4.9%).

**Dead ends:** counting every cast back across every stop (development
plain 47.3 → 45.9%, verified 71.0 → 64.9%): stops placed a little off (an
ultimate's stop from its event, which the log has at the stop's end) moved
casts pressed as a stop ended to before it. Combos across other combos'
dilations: bdf2's Corrosion ramp fits only the plain start.

**Left:** fc63's 4th shot anchored to her 5th's cast and its bursts logged
before their shots (no events there to place from); two ultimates whose
first-pass stops hold each other (fc63 41.6 s); 9c6e as a multi-target
fixture.
