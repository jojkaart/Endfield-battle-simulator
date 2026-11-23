# Si's strokes, Artful Intent's end and Yinglung's Edge pauses (2026-11-23)

Task: decide what each of Si's logged presses is and when her Artful Intent ends, fix the replay's reading, rescore
the Type 50 Yinglung's Edge hypotheses (N2), and look for a battle-exit marker behind N1. Branch: the worktree
agent-a9845cb0c7800c225, base 6b117c1.

## 1. No view of a kit buff's own clock in the replay

- **What happened:** the central question ("does Artful Intent end at its expiry or at a press?") needs, per
  instance, the replay's expiry on its own clock (every stop and slow-down) before any logged-end cut or hidden hold.
  `zmdlogs replay --kit-buff` prints the final window, which for most instances is already cut to the log's end
  (castsFromBuffEnds' `expires`, heldToLoggedEnds). I had to write scratch/ai-trace.ts and ai-natural.ts over
  `logBuffReplay(..., { trace })` and take the last `to` before the first shortening step: about 40 minutes, and the
  first version read the cut end as the natural one and misled me.
- **Cause:** traces exist (BuffReplay.traces) but no command summarises them per instance, and the window view mixes
  the kit's clock with the log's corrections.
- **Suggestion:** `efsim zmdlogs replay --kit-buff owner:id --clock`: per instance, start, the expiry on the replay's
  own clock, the end it got and the step that set it (expiry, inferred cast, `expires`, hidden hold), and the logged
  trigger hit after it with its `poise.origin`.
- **Why it helps:** every "the buff runs long/short" question (Twilight, Si's Amp, Artful Intent, the buff clock) starts
  with this table; one command instead of a scratch script per agent.

## 2. `poise.origin` isn't in any census or view

- **What happened:** the origin of Si's bursts decided the whole task (Final Stroke vs the Inksoul's own return vs the
  mark), but `zmdlogs census` can't select or group by it, and none of the views prints it; I read the fixtures with
  Python (scratch/si-bursts.py, si-timeline.py).
- **Cause:** the field came with the 2026-11-16 refresh and the query layer (packages/logs/src/query.ts) wasn't
  extended.
- **Suggestion:** a census selector `origin:<regex>` and an origin column in `zmdlogs instances` / `casts` for hits
  that carry one; a line in docs/design/data.md "What the log records" that origin is the skill whose cast id the hit's
  skill inherits (so it tells a stroke's burst from an expiry's).
- **Why it helps:** other trigger-hit questions (whose cast a projectile or an entity's skill belongs to) can be
  answered from the log in one command.

## 3. The Yinglung scoring scripts live in another agent's scratch

- **What happened:** the 15 hypotheses' scorer (edge-export.ts, edge-implied.py, edge-score.py, edge-search.py) had to
  be copied from a91601's scratch and their import paths patched; the "truth" file (edge-all.json) is only valid at
  that agent's base, so I copied it too. Each new variant was a new scratch file importing the old ones by exec.
- **Cause:** a reusable accuracy probe (implied layers per combo, hypotheses as rules on casts) stayed in scratch.
- **Suggestion:** move the implied-count export and the H0 engine score into a small committed script
  (scripts/edge-layers.ts: per wearer combo, implied layers by both readings and the engine's), so the next agent runs
  `node scripts/edge-layers.ts --engine` and gets 61 / 2 / 5 at once.
- **Why it helps:** the Edge count is a recurring check after any Si or battle-skill change; a committed script also
  keeps the decided-combo rules (exclusions) in one place.

## What worked well

- `efsim gamedata tree` / `who` made Si's slot logic, the Inksoul and the set's child-buff layers readable in minutes,
  and `who` on Artful Intent listed every place that ends it.
- `npm run measure -- --hits` (51 s for 73 logs) and team-ab's identity check (2 min) made the A/B cheap.
- `scripts/at-commit.ts` gave a base worktree for a scratch-script A/B (burst landings) without touching the tree.

## Outcome (round 6)

2026-11-23, improvement round 6 (docs/friction-done/2026-11-23-round-6.md); what's left is in docs/friction/2026-11-23-backlog-after-round-6.md.

- 1 (no view of a kit buff's own clock): done (7204f27): `efsim zmdlogs clock --kit-buff chr_0036_jsspsi:artful_intent` gives per instance the own-clock expiry (`hidden-holds=none`, before any shortening step), how it ended and by which step, the check's end; the logged trigger hit after it with its origin carried (the round-6 backlog point 15).
- 2 (poise.origin in no census or view): partly (9f73b21): census selector `origin:<re>`, a data.md "What the log records" line on what the origin is; the origin column in instances / casts carried (the round-6 backlog point 19).
- 3 (the Yinglung scoring scripts in another agent's scratch): done (95adc49): scripts/probes/edge/ (edge-export.ts, edge_implied.py, edge-score.py with its import fixed), run at this round's code (H1 59 exact, H3 56 of 69); not rewritten as one TS script: the probe is what the numbers came from.
