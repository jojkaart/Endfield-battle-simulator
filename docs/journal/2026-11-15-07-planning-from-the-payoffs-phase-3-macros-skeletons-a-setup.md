## 2026-11-15: Planning from the payoffs, phase 3 (macros, skeletons, a setup value)

Goal: let the forward beam see backward-built setups (design.md "Payoffs
and chains", phase 3). Done (each an option; design.md has the table):
**chains as macro actions** (macros.ts: the payoff table's chains as one
choice each where their first step is one, played from the node's own
state, the controlled operator attacking between teammates' steps);
**the beam's extra share** (macro and skeleton children, up to half the
width more a layer, so the main share is the search without them);
**skeletons as guides** (skeleton.ts: greedy rollouts over chains, merged
chains and single choices by value per second, resources charged at their
probed prices; `SearchHooks.guides`, a guide list; the best skeleton is the
bound's incumbent); **a setup-aware value** (setupvalue.ts: each held piece
at its worth to the best payoff still castable while it's on; in the score
or, `setupShare`, ranking only the extra share). `efsim search` plays
macros by default (`--no-macros`), `--skeletons`, `--setup score|share`.
Results (60 s, guided 12/24/48): macros found more at every width on all
four examples: the owner's team (Arcane WILL, the corrected build) full
energy 3,835,505 → 3,922,576, from zero 3,226,208 → 3,394,218 (with
skeletons 3,397,119, the example's now); Ink Melt
4,411,886 → 4,689,365, from zero 3,841,514 → 4,601,305 (the example
had 3,892,412 from 24/48/96); the examples now play those
rotations (both owner's rotations play the owner's chain with Si's battle
skill as the Cryo; none ties Estella's battle skill in: from zero its
steps come in order at 43–53 s, 6.8 s apart in the middle). Macros and
skeletons together did worse than macros alone (3,771,274 and 3,228,589:
one extra share split between them). At equal run time macros win on
full energy but lose from zero (at the baseline's total time they've
finished only w/2 and w): they cost 1.6–3.8× a width. Skeletons and the
setup value stay opt-in: each made examples worse (skeletons both
full-energy fights, Ink Melt 4.41 → 3.66M, the owner's team 3.84 →
3.73M, though from zero they found the owner's best, 3,397,119; the setup
value Ink Melt and the owner's team, both energies).
Decisions: the extra share instead of the main beam (macro children there
crowded out setups: Ink Melt over 40 s 3.12 → 2.40M); a piece counted once
and not for its own operator's payoffs (summed, the value reached 357k at
2 s of Ink Melt's rotation and sent the beam into early ultimates); macros
default only in the CLI (the engine option stays off: pinned tests,
loops). Dead ends: macros without the controlled operator's attacks in
between; the summed setup value; skeletons taking the main beam's last
places (40 s Ink Melt 3.12 → 2.78M). Problems: memoised advances kept on
macro states filled a 4.5 GB heap (fixed: a copy); runs of 2 h hit the
background limit; the build correction mid-task (the owner's team
measured again on the WILL build only).
