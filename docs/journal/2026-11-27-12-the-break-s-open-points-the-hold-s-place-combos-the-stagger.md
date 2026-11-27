## 2026-11-27: The break's open points: the hold's place, combos, the Stagger end

**Goal:** the open points of the hold at a Stagger break (docs/open-problems.md "The hold at a Stagger break"): where
the hold sits against the breaking hit's logged ms, breaks inside a combo's slow-down, a `stagger-recovery` refit,
and the two hold-outs whose ~30 hits went plain → assumed.

**Done:**
- **The hold's place** (scripts/probes/stagger/break-place.ts): of the 22 breaks a clock reads, 16 are late after the
  ms only; 9090 128.92 s before it only, c4f3 33.58 s and 5082 44.43 s on both sides. The log stamps a breaking hit at
  its hold's start, inside it or at its end. No logged moment falls inside a hold, so the next moment bounds it:
  engine assumption `break-hold-place`, reading `moments` (holds.ts breakHoldStarts, a replay step that holds from
  the hold's start: replaysteps.ts, clock.ts breakHold `placed`), registered with the default `ms`.
- **Combos:** the hold applies inside a combo's slow-down, unscaled (a7a7 48.14 s, f879 57.12 s, c83c 55.83 s:
  +458–501 ms after the ms); the three with hits 0.13–0.25 s after are the stamped-inside case.
- **The Stagger end:** scripts/probes/stagger/stagger-end-fit.ts over `zmdlogs stagger`'s 38 bracketed runs: the
  engine's own end +0.32 s past the bracket's middle at the median; −0.3 s centres it, the mean |error| 2.74 → 2.72 s.
- Two placement diffs measured and kept in docs/tried (logcasts.ts is another agent's file): the pass-2 stops with the
  breaks' holds (hold-outs unchanged), and a cast's start held back by them without a cast event (development 3
  better, hold-outs 2 worse, plain −12).

**Scoreboard:** unchanged (the defaults are the old behaviour; `npm run measure` with `moments` as the default:
development plain 84.2% either way, 4d60 +2, 9090 −2, d4fb −1; hold-outs unchanged).

**Decisions:** `moments` not the default: flat on every group, and in 9090 it holds Liino's two volleys due at
128.57–128.60 s (logged at 128.50 s, the replay's clock 0.07–0.10 s late there) past their landing
(tests/buffreplay-typhoeus.test.ts). `stagger-recovery` stays `2s`: the shift that centres the median is within its
error. No simulated fight moved (the new reading is the replay's only), so no team-ab.

**Ruled out for the hold-outs:** the hold's start as the moments place it; the placement's stops with the breaks'
holds; the held cast starts made them worse. Under `break-hold=none` they lose one INSIDE decision: an action the hold
lengthens past the next press (as 3aa6's breaker logged inside its hold, fc63's combo across a break) is the lead.
