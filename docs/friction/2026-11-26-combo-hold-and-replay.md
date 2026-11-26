# Combo hold and the replay's tails (2026-11-26)

Task: 0c14's Rossi replay-only landings, a9d7's Slashing Edge across an away stretch, where in a combo the operators'
extra hold sits, smaller leads, and round 13's backlog points 1, 4 and 6 (branch worktree-agent-aab5ad7209df6114a).

## 1. A replay rule's decisions were visible only through a whole measure

- **What happened:** the first version of the tail-cut rule (buffreplay.ts tailCuts) cut casts it shouldn't have
  (3f78's Rossi combo_2 whose combo_3 the log has, db87's Camille ultimate whose buffs the log lists, 2fd9's last
  Mi Fu cast before the kill, 9847's Liino, c4f3's Pogranichnik). Each showed up only in `measure` (about 6 minutes
  each, three rounds) as a worse log, and finding which cast the rule touched meant reading the replay view of each
  log around its changed hits by hand, since nothing listed the cuts. I added TAILCUT lines to `zmdlogs replay`
  midway; before that, about 20 minutes of guessing per round.
- **Cause:** the replay's decisions (skips, inferred presses, tail cuts, missed casts) are each printed by their own
  line kind in `zmdlogs replay`, one log at a time; there is no list of "what this reading decided differently"
  across the logs short of a measure, and no per-log diff of two readings' decisions.
- **Suggestion:** `efsim zmdlogs decisions <fixture…|--all> --assume <id>=<r>`: per log, the replay's decision lines
  (SKIP, EVENT fates, TAILCUT, MISSED, inferred presses, FORCED/INSIDE flags) that differ between the default reading
  and the given one, from two logBuffReplay runs (seconds per log, worker threads as `totals --all`). A new replay
  rule is then reviewed on its list across 61 logs in a minute before its first measure.
- **Files:** packages/logs/src/views.ts (a decisions view from replayView's line builders), packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** every replay-rule round (hitless presses, away, tails) spends its first measures finding the
  rule's false positives; the list shows them directly. Cost: one more view over code that exists.

## 2. One log's verdict changes under a reading needed a scratch diff

- **What happened:** to see what the cut did to 0c14's verdicts I ran `zmdlogs hits 0c14 --json` twice (with and
  without `--assume`) and wrote scratch/hitdiff.ts to pair the lines by time, event and value and print the class
  changes. `measure --variant … --hits` gives the same list, but for every log and after a 6-minute queue.
- **Cause:** `zmdlogs hits` prints one reading; the pairing of two readings' hits lives only in measure.
- **Suggestion:** `zmdlogs hits <fixture> --against <id>=<r>`: only the hits whose class or primary reading differ
  between the default and that reading, with both readings and the modifiers that differ (measure's `--hits` lines,
  for one log, no lock).
- **Files:** packages/logs/src/hitexport.ts (or the measure's hit-diff code moved there), packages/cli/src/commands/zmdlogs.ts.
- **Why it helps:** a reading's effect on its target log in ten seconds, before the measure.

## 3. A reading of the game data has no single entry point in the log tools

- **What happened:** backlog point 4 (the ComboSkill curve as a reading) needed the log tools' stop lists and the
  replay's timeline to read the same resampled data. The engine's createContext could apply it, but the log tools
  take `data` without the readings in about twenty places (placeHits, castTimeStops, skillStops' callers), so I
  wrapped the data at four entry points (createContext, snapshotEntry, hitRecords, the zmdlogs CLI's data()). A script
  or view that calls placeHits with the raw data under `--assume combo-curve=…` silently mixes the two curves.
- **Cause:** the log tools' API is (data, fx); the readings travel separately in ReplayOptions.assume and only the
  replay reads them.
- **Suggestion:** a log context `{ data, assume }` (or `placeHits(data, fx, { assume })`) that every log tool takes,
  with data already under the readings (withCurveReading and any later data-level reading), so a reading of the data
  can't reach the replay without the placement.
- **Files:** packages/logs/src/logcasts.ts, logcheck.ts, snapshotentry.ts, hitexport.ts, views.ts, query.ts.
- **Why it helps:** any reading of a compiled table (a curve, a hold, a duration) becomes measurable without patches,
  and the placement and the replay can't disagree on it. Cost: a signature change across the package.

## 4. The CLI's option names are one set across commands, checked only at start-up

- **What happened:** `--why` (a regex in `holds`) and then `--rules` (a string in `gear`) were both taken, and the
  second clash showed only when the CLI threw at start-up (command.ts mergedOptions: "declares it unlike gear"). The
  views' option became `--choices`, not the backlog's `--why`.
- **Cause:** every command's options merge into one parseArgs set (command.ts), so a boolean in one command can't
  share a name with a string in another.
- **Suggestion:** a line in docs/design (or the usage's head) listing the taken option names and their types, or
  per-command option sets in command.ts (parse the subcommand first, then its own options).
- **Files:** packages/cli/src/command.ts, packages/cli/src/cli.ts.
- **Why it helps:** a view's natural option name (`--why`) stays available; minutes, not more, but every new view hits it.

## What worked well

`zmdlogs totals --kinds` and `--json` put 0c14's 58 landings in one list in seconds, and `zmdlogs replay
--trace-buff status:vulnerable` showed the Vulnerable stack the cut cast would have added, which tied the 52 s cast's
missing follow-up to the 35 s one. `measure --variant` ran two readings in one queue slot each time. scripts/edit.ts
made the long text edits (assumption texts, docs) safe in one call.
