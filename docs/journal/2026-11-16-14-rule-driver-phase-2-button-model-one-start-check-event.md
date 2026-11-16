## 2026-11-16: Rule driver phase 2: button model, one start check, event stepping, run checks, assumption switches

Goal: phase 2 of the [architecture review](../architecture-review.md)
(items 3, 4, 8, 9, 10) and the rule-noise points of the three friction
reports on rules, gear on rules and the guided search. Done (design.md
"Rule-based rotations", its "Assumption switches"):
- **Button model** (engine timeline/buttons.ts): what each battle, combo
  and ultimate button shows and casts, from the kits' `available`
  conditions, follow-ups and own combo windows. A press casts that skill
  or nothing; `shows` checks its label. No example button is ambiguous at
  any frame (test).
- **One start check** (`canStartAt`): earliestStart now judges an `at` on
  the state advanced to it. Every disagreement between the old pair
  (startsNow on the advanced state, earliestStart from the last press) was
  SP granted on the way, the dive-landing case included; the old driver
  waited for the stale check, so SP-gated presses came late (Ardelia's
  battle skill 1.7 s). SP is snapped to its regeneration grid, so it reads
  the same however a state was advanced. Property test on the examples'
  rotations and rule runs.
- **Event stepping**: the driver visits the frames where something it
  reads can change (about a third); `stepping: "frames"` is the reference
  and gives the same rotations (test: three lists, several seeds, both
  energies). 1.2–1.7× faster a run (the simulation itself is the floor).
- **Run checks** (`checkRuleRun`): no press casts another skill than its
  button showed, none cuts its operator's own ultimate state (a
  counterfactual without the press), `simulate` replays it; zero on the
  three lists; a constructed End Stance list is caught.
- **Visible states in the kits**: `visible` on kit buffs and stacks
  replaces policy.ts's operator tables; cues unchanged.
- **Assumption switches**: kits register open readings (`assumptions`,
  triggers with `reading`); test 109's alternative is the first
  (`si-haste-every-end`). `--assume` and `--assumptions` on `rules`,
  `diagnose`, `gear --rules`, `--guided`.
- **Noise tooling**: `efsim rules --compare` (paired gain ± SE on seeds
  1–k and fresh 1001…), a seed/power table in design.md, the zero-energy
  companion judged by default (`gear --rules`, `--guided`), one worker
  pool per command (`efsim rules` uses it too), the commit at the head of
  long outputs, the guided search's list written after each kept round.
  Antithetic delays tried: no gain (the owner's
  team: SE 0.17% against 0.14% plain at 128 seeds), dropped.

Behaviour changes (32 fresh seeds, 1001–1032, 300 s; before → after):

| Team | Full energy | From zero |
|---|---|---|
| The owner's | 56,274 → 56,493, +0.39% ± 0.47 | 55,852 → 56,055, +0.36% ± 0.25 |
| Ink Melt | 66,355 → 69,668, +4.99% ± 0.99 | 63,213 → 61,716, −2.37% ± 1.23 |
| Typhoeus's | 54,847 → 54,607, −0.44% ± 0.78 | 50,818 → 51,076, +0.51% ± 0.62 |

All of it comes from earliestStart's fix: the old driver with only that
fix gives the same means (against the new driver: the
owner's team identical on 31 of 32 seeds, Ink Melt +0.01% ± 0.15 and
+0.23% ± 0.23 from zero; Typhoeus's −0.40% ± 0.40 and −0.15% ± 0.09,
presses an SP tie now starts a frame sooner (the snap)). The two moved example scenarios
(akekuri-laevatain, wulfgard-fluorite) are SP ties the snap now reads
exactly. The documented 10-seed numbers on the team pages predate this.

Not done: the review's estimate of 3–10× for event stepping was too
high: after the probes, most of a run is the simulation and the basic
attack's earliest start (it advances copies of the state). The friction
reports stay in docs/friction/ for the improvement round to file.
