## 2026-11-15: Payoffs and chains (planning from the payoffs, phases 1 and 2)

Goal: the forward beam drops setups that pay off 10–20 s later (Ink Melt's
beams 3.50 / 3.50 / 4.41M); the owner proposed planning from the payoffs
and combining overlapping setups (their team's chain: a battle skill's
infliction → Arcane's combo → Estella's battle skill's Solidification →
Si's and Estella's combos). Done: `efsim payoffs` (engine payoffs.ts;
design.md "Payoffs and chains"): every step probed from representative
situations against the fight without it, compared by counts (a time stop
moves frames: by frames every ultimate "opened" every window); ceilings
under the best bundle of achieved pieces with each piece's worth,
achievers and lead; window payoffs; chains by depth-first search (opens /
sets up), slack, merges with setups (synergy) and fillers (idle time, the
owner's guidance: nothing dropped for ranking low); setup efficiency of a
rotation; `--json` for phase 3. Phase 2: dominance (stateKeyer `amounts`)
and branch and bound (bound.ts, an LP relaxation with a Lagrangian over
SP), `efsim search --prune`, both off by default. Findings: the owner's
chain is found (315,557 in 2.5 s; with Si's battle skill as the Cryo
341,717, the best per second) **only with Arcane in WILL mode**: the
example's builds (full artifice assumed) put her INT 484 over WILL 473, so
the engine plays her INT (combo adds no infliction): ask the owner (team
page). The example rotations reach 40–77% (owner's) and 59–96% (Ink Melt)
of their big casts' ceilings. Pruning: the same rotations and totals at
every beam with it on the owner's examples and Ink Melt (both energies,
beams 12/24/48); dominance drops 0–12 states a beam, the bound 0–45
children (≤ 0.5%): it's 2.7–3.8× the damage still to come along Ink Melt's
rotation, too loose to prune (said so rather than tightened inadmissibly);
both off by default, `efsim search --prune`. Decisions: probes, not kit
reading (principle 5); ceilings are heuristic (efficiencies over 100% flag
what they miss: Si's recording burst, Arcane's INT explosion set off
later); the bound never cuts the guide's line. Dead ends: comparing probe
fights by frames (time stops); ties by any operator's events (a time stop
reorders others' reactions).
