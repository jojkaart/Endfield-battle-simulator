## 2026-11-26: Combo hold and the replay's tails: Rossi's cut battle skill, the combo's excess in its first half, the curve a reading

**Goal:** 0c14's Rossi replay-only landings (58, 0.30M), a9d7's Slashing Edge across an away stretch, where in a
combo the operators' extra hold sits, smaller leads (Alesh's eventless combo, 207f, Snowshine's ×0.9624), and round
13's backlog points 1, 4 and 6.

**Done** (open-problems "The damage factors", "The enemy's clock", "0c14"):
- **0c14's Rossi: one battle skill's tail.** Her 35.40 s battle skill lands its two charge hits and then nothing the
  log has (no Lift, wolves, 16 bleed ticks, nor the Endministrator's combo shatter the Lift sets off), the enemy
  there; without that Lift's Vulnerable stack her 52.04 s battle skill takes no follow-up (its Lift hit logged, no
  Lift status, no wolves). Engine assumption `unlogged-tails` `cut`, the new default (buffreplay.ts tailCuts,
  ReplayCastOptions.endsAt, TAILCUT lines in `zmdlogs replay`): a battle skill, combo or ultimate whose later
  landings are none of them logged ends after its last logged one, the earliest first, the replay made again after
  each. Guards found by three measures: not where the log has another hit of the operator's casts no cast holds
  (3f78's combo_3), where a decided buff the tail starts is listed as a new run (db87's Camille), in the fight's
  last 1.5 s (2fd9's kill) or an away stretch. 0c14 plain 293 → 336, replay-only 58 → 14.
- **a9d7's edge: a hidden hold.** Chen's ~0.4M ultimate final isn't logged where her other finals are, and the edge
  refreshes on a landing that deals damage, which the log would show; a hold of 0.37–0.84 s after 158.60 s fits the
  placement's free unit. The away rule's edge unchanged.
- **The combos' operator excess sits in the stop's first half** (scripts/probes/combo-hold/edges.ts): landings
  0–200 ms before a listed start on time, landings right after the listed end at full density and already 186 ms
  late, at 0.5–0.6 of the stop 294 ms. A uniform extra hold on the operators (`combo-operator-hold` `3f`/`4f`/`6f`,
  registered, off) measured worse: verified plain 78.0 → 77.4 / 77.1 / 76.4%, earlier pending −0.9.
- **Backlog point 4:** `combo-curve` (`guess`, `flat`, `middle`; timeline/curves.ts withCurveReading, applied by
  createContext and the log tools' entries). `measure --variant combo-curve=flat` reproduces the patch measure of the
  enemy-clock round: verified 78.0 → 73.0%, development 69.0 → 68.0%; `middle` 75.6%, 68.6%.
- **Backlog point 1:** `zmdlogs casts --choices` (choose's rule per cast, LoggedCast.chosen) and `zmdlogs placement
  --choices` (the in-turn rule's verdict and checks per overlapping ultimate, Placement.inTurn); settleCheck pairs
  through pairCasts.
- Snowshine narrowed (level, potential and weapon skill levels ruled out); Alesh's eventless combo and 207f not reached.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 69.0%, mismatch 11.4%, mean |damage
error| 7.0% (unchanged; 9c6e −13.2 → −13.5%: Liino's unlogged combo hit2 out of an under-predicted total); hold-out
plain 80.6%, mismatch 5.6%, mean |damage error| 8.4 → 8.3% (1 better, 2 worse, totals only); earlier pending plain
67.3 → 67.7%, mismatch 11.9%, mean |damage error| 4.0% (0c14 mixed: plain 293 → 336, its total +2.7 → −3.2%, its
matched Rossi ×0.943 and Si ×0.964 below the log; de6a −0.4 → −0.8%, Pogranichnik's unlogged combo hit_3). team-ab:
unchanged (the defaults change no simulated fight). Smoke passed.

**Decisions:** `cut` the default and `cut-all` (basic attacks too: totals mixed, 8 logs closer, 6 further) kept as a
reading. `combo-operator-hold` kept registered though worse, as the measured record of the obvious mechanism. Backlog
point 6 (the buffreplay.ts split) not done: the tail cuts went in by grep, and a 3,100-line move with its proof
didn't fit beside the accuracy items.

**Problems:** the tail rule's false cuts showed only per measure (friction report: a decisions view across logs);
`--why` and `--rules` were taken CLI option names (the views' option is `--choices`); an unescaped quote in an
assumption's text broke smoke's and team-ab's first runs (typecheck would have caught it: run it after text edits).
