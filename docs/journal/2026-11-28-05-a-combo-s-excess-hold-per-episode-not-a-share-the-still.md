## 2026-11-28: A combo's excess hold: per episode, not a share; the still-possible list decided

**Goal:** docs/open-problems.md "The enemy's clock: a combo holds every clock more than its stop list says": remeasure
the excess on today's code, test the "Still possible" list, build what it decides.

**Found:**
- The excess is still there at development plain 84.2% (`zmdlogs clocks --all --clock tick,cast,burst --breaks --by
  operator`, combos only, Σ residual ÷ Σ held): the enemy's tick chains 0.23 (0.22 in the log's Stagger), casts 0.40
  (109 rows, median 240 ms), bursts 0.30; across an ultimate 0.00 / −0.03.
- It is a constant per episode (a run of overlapping combo slow-downs), not a share of the hold
  (scripts/probes/combo-hold/episodes.ts): a cast across one combo is 212–285 ms late at 291–615 ms held; across two
  pressed together about as late (363 ms median over 10, Zhuang Fangyi's battle skills across Liino's and Xaihi's 265,
  −187, 363, 79 ms). A constant per combo fits the rows a little better than a share for ticks, casts and bursts.
- Decided from the data and the logs: the layer-1 TimeDilationActions the compiler drops hold the caster or her own
  objects in 5 of 6 combos, only Arcane's her target (gated by onlyExecuteWhenSourceIsGuard, elsewhere a camera
  actions' flag), and the enemy's statuses across Arcane's combos run as late as across others': ruled out. The
  controlled operator's casts run late as the teammates' do (162 against 211 ms an episode), and the enemy's ticks too:
  no camera or cut-in holding teammates apart. The edges (edges.ts, rerun): nothing late before the start, already late
  right after the end.

**Done:** engine assumption `combo-operator-hold` readings `4f-episode`, `5f-episode`, `6f-episode` (timeline/clock.ts
slowDown: the extra frames only at a slow-down that starts while none runs), tests/combo-operator-hold.test.ts; today's
numbers on the registry's readings and docs/design/assumptions.md.

**Measured** (`measure --variant`, each against the plain tree): `4f-episode` verified, development and hold-out plain
unchanged, earlier pending 84.6 → 83.9% (4bfc −36, half of `4f`'s −97; 3aa6 −40); `4f` verified 78.5 → 77.6%, earlier
83.4%; `plateau-0.6` verified 78.2%; `combo-curve` `middle` verified 76.1%, development 83.5%, hold-out 81.5%, `flat`
73.5%, 82.9%, 80.0%; `stagger-holds` `combos` development 84.4%, verified 78.0% (0eef −4). None the default.

**Decision:** no reading made the default. The loss under every operator hold is the replay's: its landings are
pinned to the log, so the hold moves only what isn't, Zhuang Fangyi's strike_n stack on her clock (3aa6 21.26 and
32.90 s: the strike's `if` fails and each later strike takes the one before's value), while her strike there lands where
`none` puts it. The engine default is unchanged: no simulated fight moved (team-ab's identity check; snapshots:update
"No log's verdicts moved").

**Open:** why some casts take the per-episode hold and others not (Zhuang Fangyi's strikes on time in 3aa6, late in
4bfc and d774); a world-clock hold per episode (about 2.5 frames; the hidden holds take it outside a Stagger);
`4f-episode` for simulated fights, which the replay can't judge while its landings are pinned.
