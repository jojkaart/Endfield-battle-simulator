# The combo hold per episode (2026-11-28)

Task: the accuracy lead "a combo holds every clock more than its stop list says": remeasure the excess on today's code,
decide the "Still possible" list from the data and the logs, build and measure what it decides (branch
worktree-agent-a43e5fa3f267d6415).

## 1. Nothing tells a measure that a reading only moves what the replay doesn't pin

- **What happened:** every operator-clock reading (`combo-operator-hold` `4f`, `4f-episode`, `plateau-0.6`) measured
  neutral-to-worse although the logs' casts show the hold plainly (scripts/probes/combo-hold/episodes.ts). Only after
  two measures (about 25 min of queue and run) and a diff of two `zmdlogs replay 3aa6` runs (with and without
  `--assume`) did the cause show: the replay pins its landings to the logged hits, so the hold moves only what isn't
  pinned (Zhuang Fangyi's strike_n stack on her clock), and the strike's `if` fails (`NOLAND … KitHit.if
  {"stack":"strike_n",…} didn't hold`). The 2026-11-26 rounds measured the same readings three times without seeing it.
- **Cause:** a measure's summary names logs and counts; it doesn't say what kind of replay item moved. `hits
  --against` shows the hits, but its lines ("plain → mismatch 28090") don't say that a landing went missing and every
  later slot shifted by one, nor why.
- **Suggestion:** in `measure --hits` (and `zmdlogs hits --against`), when a moved hit's replay line turns into a
  NOLAND, print the NOLAND's reason (replay.ts's NOLAND text) beside it, and count per variant "landings lost by an
  `if`", "slots shifted by one": a summary line per moved log, from the two replays' landing lists.
- **Files:** scripts/measure.ts, packages/logs/src/hitexport.ts and views.ts (`hits --against`'s lines),
  packages/logs/src/replaykeys.ts (the NOLAND reasons).
- **Why it helps:** an engine reading that only moves unpinned items in the replay can be told from one that is wrong,
  at the first measure; it decides whether to judge a reading by the replay at all.

## 2. Two measures queued back to back each ran the plain tree again

- **What happened:** the first measure (five `--variant`s) and a second (three more) each ran the plain tree too (78
  logs each, about 2 min apiece), behind another agent's measure in the queue; together 35 min of wall time.
- **Cause:** `--variant` runs the plain tree per invocation; the second set was only thought of after the first's
  results, and the code changed in between (the new reading), so `--no-plain` wasn't safe.
- **Suggestion:** `measure --plain-from <dir>`: reuse an earlier measure's plain-tree verdicts when the measured code
  differs from that run's only in files the variants' readings gate (here: a new reading's branch), checked by an
  identity run of the plain tree on a few logs (scripts/identity.ts).
- **Files:** scripts/measure.ts, scripts/identity.ts.
- **Why it helps:** a follow-up set of readings costs only its variants; risk: a wrong reuse, which the identity check
  bounds.

## 3. The clocks view's rows can't be refit without a scratch parser

- **What happened:** the question "per combo or a share" needed a fit over `zmdlogs clocks --rows`; the rows are text
  (`held Rossi combo 0.42, Camille combo 0.39`), so I wrote scratch/rows-fit.ts to parse them back, and
  scripts/probes/combo-hold/episodes.ts re-derives casts.ts's rows to count episodes.
- **Cause:** clocksview.ts has no `--json` and no per-row episode count; edge-casts.ts / edge-ticks.ts fit only one
  clock each.
- **Suggestion:** `zmdlogs clocks --json` (a line per row: kind, fixture, residual, held per stop with kind, start and
  operator, episodes, in the log's Stagger), and `--fit` printing for each clock kind and section the per-combo,
  per-episode and share fits with their rms.
- **Files:** packages/logs/src/clocksview.ts, packages/cli/src/commands/zmdlogs.ts (the clocks usage lines).
- **Why it helps:** the next "is it a constant or a share" question (world clocks per episode, the next check in
  open-problems) is one command, not a probe.

## 4. The assumptions notes' format is enforced but not stated where a reading is added

- **What happened:** my docs/design/assumptions.md item `- \`4f-episode\`, \`5f-episode\`, \`6f-episode\` (…)` failed
  tests/engine-assumptions.test.ts ("a line after its readings that isn't one"), and my first registry text was too
  long (the 320-character rule); two lint:changed rounds.
- **Cause:** the format lives in packages/cli/src/commands/assumptions.ts's parser comment and the test, not at the
  top of docs/design/assumptions.md or next to ENGINE_ASSUMPTIONS.
- **Suggestion:** a two-line header in docs/design/assumptions.md ("one `- \`<reading>\`: …` item per reading,
  continuation lines indented; the registry text one sentence, ≤ 320 characters") and the same in assumptions.ts's
  header comment.
- **Files:** docs/design/assumptions.md, packages/engine/src/assumptions.ts.
- **Why it helps:** saves a test round per new reading.

## What worked well

- `zmdlogs clocks --all --clock tick,cast,burst --breaks --by operator` remeasured the whole lead in one command.
- `measure --variant` with several readings in one run, each against the plain tree.
- `zmdlogs replay <fx> --assume …` diffed against the plain replay named the failing `if` exactly.
- `gamedata dilations combo` and `gamedata tree` decided the layer-1 question in minutes.

## Outcome (round 23)

- 1 (Nothing tells a measure that a reading only moves what the replay doesn't pin): done (8228f43): packages/logs
  landingmoves.ts; measure --hits carries each hit's landing and prints per log `landings:` (lost its landing, with the
  NOLAND reason and the step that dropped it; took another logged hit's landing, a shift); `hits --against` names
  them (HitRecord.dropped). On 3aa6 under `4f-episode`: "lost its landing: … its kit hit's `if` didn't hold … 4".
- 2 (Two measures queued back to back each ran the plain tree again): done (7d3ec64): a --variant run writes
  <out>/plain.json; `--plain-from <dir>` reuses it for the same code, readings and logs, else says why;
  `--trust-plain` across a code change, labelled (the identity check stays a separate `scripts/identity.ts` run:
  it costs a plain run's time).
- 3 (The clocks view's rows can't be refit without a scratch parser): done (a83ab0a): `zmdlogs clocks --json` (a line
  per row, with its combos and episodes) and `--fit` (per combo, per episode, share, each with its rms).
- 4 (The assumptions notes' format is enforced but not stated where a reading is added): done (58fbd8f): the short
  form at the top of docs/design/assumptions.md and in assumptions.ts's header (one item per reading, the 320
  characters), and the parser's error names the form.
