## 2026-11-16: A payoff-guided rule search (`efsim rules --guided`)

Goal (the owner): the rule search should work like the timeline search
that worked: put together ideal combos and change the rules in
directions that get closer to them, instead of mutating lists at random.
Done (design.md "The guided rule search"; engine policyguide.ts, CLI
guided.ts, rulespool.ts's persistent worker pool, tests/policyguide.test.ts):
- **Ideal combos** from a rules run's hits: windows (an operator's skill
  family with ≥ 2% of the damage), multipliers (each modifier's kit
  buff, Stagger, a status) with who gives them (the owner's press that
  created the buff), each missing multiplier's loss (its modifiers from
  a hit of the same kind added, the zones recomputed), the window's ideal
  (all at once) and achievement; the visible cues each window comes with
  (Twilight, hovering, Solidification).
- **Directed edits** for the six biggest losses: hold the giver for the
  window's cue, chain the two ultimates, start the window when the
  multiplier is visibly up, save SP, `shows` on changing buttons (the
  n-th press of a button its n-th skill), spare SP, move up; merged pairs
  of the best screened edits; four random moves; a widened round (14
  losses) before stopping.
- **Judged on common seeds**: 6 seeds to screen, the best four on 32,
  close calls on 64; kept beyond 2 standard errors and 0.2% and positive
  on the non-screening seeds; then the analysis again; the final list
  against the start on 32 fresh seeds.

Results (design.md table; team pages' Rules): no example changed. The
owner's team: Estella's ultimate only while Staggered +1.70% ± 0.80
(fresh +1.20% ± 0.66) but −0.94% ± 0.47 from zero. Typhoeus's: Arcane's
ultimate only while she hovers +1.40% ± 0.52, fresh +0.57% ± 0.79. Ink
Melt: nothing kept on the example; from the list before today's
Twilight hold it found `shows` on rule 7 (Si's battle skill before
Ardelia's combo; +3.10% ± 1.02, fresh +2.18% ± 0.87). On the example
that edit is +1.52% ± 1.42 on seeds 1–32 (missed) but +3.93% ± 0.77 and
+2.54% ± 0.86 on two sets of 64 fresh seeds, and −3.27% ± 1.26 from
zero: not taken, like the owner's team's. **The Twilight hold measures
−0.11% ± 0.71 on 64 fresh seeds**: the +4.1% of the entry below was its
10 seeds. Both full-energy gains losing from zero led to `--also <zero
scenario>` (an edit kept only if it isn't worse there), added after the
runs and not yet run on the three teams. Runtimes 7–25 min a team
(42–70 edits, 3 workers).
Decisions: the windows come from the rules run (the engine's own
modifiers on its own hits), not the payoff table's planning-fight
probes (cheaper; what the team really puts on each window); a flag of
`rules` (same inputs, a list out, like `--search`); the bar on the
non-screening seeds, because the best of 20–30 six-seed screens is
biased up (gains roughly halve on the confirm seeds).
Problems: the noise. A held ultimate moves every later event, so a
paired difference's standard error is 0.5–1.2% at 32 seeds and most
structured edits gain 0–2%: the bar, not the ideas, limits the search.
The ideal combos are loose upper bounds (achievement 39–71%: Stagger on
every hit can't happen); uptimes and cooldowns aren't modelled in them.
Inflictions a hit consumes and SP for empowered skills aren't
multipliers here (they're in the hit's scale, not its modifiers).
