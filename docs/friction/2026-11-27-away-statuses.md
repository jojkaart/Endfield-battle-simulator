# Away stretches and the enemy's clock (2026-11-27)

Task: decide from every log with an away stretch whether an enemy status's timer pauses or runs on while the enemy is
away (4d60's Sunderblades), Liino's stance ending before its last beat (4d60), and 8915's clocks after two combos
pressed together. Branch worktree-agent-ad069ca5ecd085e53.

## 1. No view says what happens in an away stretch

- **What happened:** the question "does the world stop in this stretch?" needed a scratch probe (two drafts:
  scratch/away-clocks.ts, then away-span.ts, now scripts/probes/away/away-clocks.ts) that pairs `awayWindows(fx)`
  with `BuffReplay.holdClocks` and the basic strings across each stretch. `zmdlogs holds --why` lists every clock of a
  fight but not by stretch, `zmdlogs totals` lists the stretches but not their clocks, and the brief's pointer
  (`holds --why status:` "shows no other log with a status across a stretch") had narrowed the earlier round to enemy
  statuses only, when the decisive evidence was the team's buffs and Arcane's basic string. About 20 minutes and
  116 KB of unfiltered output before the right filter (runs listed on both sides of the stretch).
- **Cause:** the away stretches are an enginecheck.ts notion (totals), the clocks a holds.ts one; no view joins them.
- **Suggestion:** `efsim zmdlogs away [<fixture…>|--all]`: per away stretch, its length, the clocks listed on both
  sides with their asks (all kinds, team and enemy), the placed holds inside it, each operator's basic step across it,
  and a verdict line ("pause: N clocks ask ≥ half its length" / "runs on"). The probe's logic is the core.
- **Files:** packages/logs/src/views.ts (or a new awayview.ts), packages/cli/src/commands/zmdlogs.ts,
  scripts/probes/away/away-clocks.ts (deleted once the view exists).
- **Why it helps:** the next "is this stretch a pause?" (a new stage log, a boss phase) is one command; it also shows
  where the placement put a pause's holds.

## 2. Layered buffs are invisible to every clock view

- **What happened:** the change exposed Zhuang Fangyi's Xiranflow layers held 3.0 s by the stops where the game holds
  them 0.6–1.2 s (4d60 43–69 s). `zmdlogs holds --why` says only "not a clock: maxStacks"; `zmdlogs clock --kit-buff`
  refused both `Zhuang Fangyi:suit_expend_spell01.spell_dmg` and `suit_expend_spell01:…` ("no kit buff … in this
  team"); only `replay --trace-buff chr_0030_zhuangfy:suit_expend_spell01.spell_dmg` (the wearer's id, not her name)
  worked, after three tries.
- **Cause:** equipment buffs are owned by the wearer's operator id, and `clock --kit-buff` takes a display name for the
  owner but doesn't map a gear buff to its wearer; layered buffs are skipped by the placement and by the clock view.
- **Suggestion:** let `--kit-buff` / `--trace-buff` take `<operator name>:<gear buff id>` and say in the refusal which
  owners have that buff id; give `zmdlogs clock` a per-layer mode for `maxStacks` buffs (each layer's application
  against its log run, as for instances).
- **Files:** packages/logs/src/clockview.ts, packages/logs/src/replayrecord.ts (trace keys), packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** gear layers (Xiranflow, Swordmancer-type sets) are a recurring buff-clock question; today each
  agent rediscovers the owner key.

## 3. The bare relaxation placed the pause in the wrong place, silently

- **What happened:** letting the clocks ask past HIDDEN_HOLD_SHARE made `zmdlogs holds 4d60` place 8 s of holds spread
  over 21.9–45.9 s (midway between earliest and latest), not in the 9.6 s stretch with no hit; only reading the unit
  lines showed it. The fix was to lay such a bound inside the stretch (holds.ts pausedBound).
- **Cause:** placeHolds's midpoint rule has no notion of where a hold is plausible; a long free span (earliest 23.75,
  latest 44.26) is legal and looks fine in the totals.
- **Suggestion:** `zmdlogs holds` flags a unit whose earliest–latest span is over a few seconds ("placed in a wide
  window: the clocks don't pin it"), and measure --hits's hidden-holds block prints the span beside each moved unit.
- **Files:** packages/logs/src/views.ts (holdsView), scripts/measure.ts.
- **Why it helps:** a hold change that lands holds in the wrong place shows before it is measured as better.

## What worked well

- `measure --variant` with `--hits`: one run gave the variant's own effect, the moved hits and the moved hold units.
- `zmdlogs hits --against <id>=<r>` and `--zones --reading log` made the 69.35 s regression (three Xiranflow layers
  against one) clear in two commands.
- `scripts/edit.ts` for doc edits: no shell damage, all or nothing.
