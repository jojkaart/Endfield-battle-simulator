# In-game tests 18, 19, 101, 104 from the logs (2026-11-17)

Task: decide in-game tests 18 (what a time stop freezes), 19 (what Haste
speeds up) and 101 (teammates' own attack pace) from the development logs,
apply the owner's answer to 104 (bosses do freeze), and change the engine
where the logs allowed; measure on the scoreboard and the three teams' rule
numbers. Branch: the worktree's own, merged into
`claude/beautiful-rubin-rpg8vp`.

## 1. The shared test lock isn't fair: my back-to-back jobs starved another premerge

- **What happened:** I queued several heavy jobs one after another under
  `node scripts/with-lock.ts …`: three rule-number runs (`scratch/rules-p*.sh`,
  6–12 min each), five example re-searches (`efsim search`, 4–30 min each, one
  wrapper script holding the lock 53 min) and a beam-48 search (30 min). The
  lead reports that another worktree's `scripts/premerge.sh` waited its full
  40 minutes for the lock and never got it. Each of my jobs released the lock
  and the next one of mine (already waiting) took it again; the premerge's
  waiter didn't win the race. My own waits were long too (a rule run queued
  behind a 50-minute batch).
- **Cause:** `scripts/testlock.ts` / `with-lock.ts` take a plain `flock` on
  `.git/efsim-tests.lock`. `flock` has no queue: when the lock is released,
  any waiter may get it, and a process that re-requests immediately (or one
  of several waiters from the same agent) can win every time. Nothing
  distinguishes a short, merge-blocking premerge from an hour of optional
  measurement, and nothing limits how long one agent holds the lock in total.
  A wrapper script (`with-lock.ts bash script.sh` running five searches)
  holds it for the whole batch.
- **Suggestion:** make the lock a ticket queue: on wait, append a ticket
  (pid, worktree, kind, time) to a file under the lock directory; a waiter
  takes the `flock` only when its ticket is first among the live ones (dead
  pids pruned). Give premerge and test suites priority over `with-lock`
  jobs (two classes: premerge/tests jump ahead of measurements). Have
  `with-lock.ts` refuse (or warn) when the command is a shell script, and
  print how long others have been waiting when it acquires the lock. Say in
  CLAUDE.md ("Long runs") to wrap each job separately, never a batch script.
- **Why it helps:** merges aren't blocked by optional measurements, and
  waiting times become predictable (FIFO). Cost: a small amount of code in
  testlock.ts; the priority rule needs care so a stream of premerges can't
  starve measurements forever (a cap, e.g. at most two premerges ahead).

## 2. An engine change silently breaks searched example timelines, with no repair tool

- **What happened:** removing Haste's cast speed (test 19) made five Si
  example timelines (`examples/estella-si-akekuri-arcane*.scenario.json`,
  `ink-melt*.scenario.json`, `si-laevatain-liino-gilberta.scenario.json`)
  unplayable (EngineError at a combo window, a finisher, a chain step).
  `npm run snapshots:update` failed and restored everything. There is no CLI
  to repair or re-search an example in place: I copied the gear ascent's
  private repaired replay (`packages/cli/src/gear.ts`, `repair` inside
  `gearAscent`) into a scratch script, and ran `efsim search … --out` per
  example and copied rotations by hand. On the way I wrote the repaired
  rotation's `at` in frames into the files, whose `at` is in seconds
  (`readScenario` converts), so the "repaired" examples failed again in the
  next snapshot run: one more 5-minute cycle. The single-beam searches took
  13–30 min each (about 1.5 h in all) and in two of five cases found less
  than the crude repair; the examples are now lower bounds.
- **Cause:** example timelines are frozen search outputs tied to the engine
  version that produced them; any timing change can invalidate them, and
  the only remedies are private code or hours of search. The scenario file's
  units (seconds) differ from the engine's rotation (frames), and nothing
  writes a rotation back to a scenario file except `search --out`.
- **Suggestion:** an `efsim repair <scenario.json> [--write]` command
  exporting gear.ts's repaired replay (moves and drops reported), writing
  the rotation through the same serializer `search --out` uses (so units
  are right). Have `tests/examples.test.ts`, on an EngineError, name
  `efsim repair` in its message. Longer term: record in each example which
  search produced it (command line) in a machine-readable field, so a
  re-search script can redo it.
- **Why it helps:** an engine change that shifts timing becomes a
  one-command fix instead of an hour of improvisation, without unit
  mistakes. Risk: repaired timelines are weaker references; the report
  should say so (as the descriptions now do).

## 3. The log replay doesn't run the teammates' pace model, so test 101 can't be scored

- **What happened:** for test 101 the brief asked to "implement and
  measure on the scoreboard". The log replay plays logged teammate casts
  (`teammateAttacks` off in the replay), so `TEAMMATE_PAUSE_FRAMES` has no
  effect on any verdict. To compare the engine with the logs I had to write
  the same measure twice: over logs (`scratch/pace2.ts`, from
  `placeHits` / `replayedCasts` / `controlledFromLog`) and over engine
  runs (`scratch/pace-engine.ts`, `playRules` then `simulate` on the
  rotation). The old 3.5 s calibration (2026-10-28) had claimed "about 40%
  of free time, as in the logs", but measured the same way the engine gave
  0.59–0.66 against the logs' 0.43: two different measures had been
  compared.
- **Cause:** no shared definition of "teammate attack share" exists in
  code; each analysis reinvents it, and engine-side calibrations aren't
  checked against the same metric.
- **Suggestion:** a small module in `@efsim/logs` (or a `efsim zmdlogs
  pace` report) computing per operator-fight the share of free time
  attacking and the gap distribution from a list of casts with
  {operator, kind, start, lastHit, teammate}; feed it from both the log
  placement and an engine `TimelineResult`. A test pinning the engine's
  share for one example within the logs' quartiles would catch drift.
- **Why it helps:** calibrations of engine-only behaviours (teammates,
  later others) become checkable and comparable, and the next agent doesn't
  rebuild the pipeline.

## 4. Per-hit and per-cast log analysis needs a lot of plumbing each time

- **What happened:** each question (cooldown gaps across stops, step
  intervals under Haste, Twilight brackets, buff listing windows, frozen vs
  immune diffs) needed its own scratch script reassembling the same pieces:
  `listLogs` → `readLogFixture` → `placeHits` → `distinctCasts` /
  `replayedCasts` → `castTimeStops` → `worldMs`, plus kit lookups
  (`createContext` + `skillCosts` for cooldowns). Two bugs cost reruns:
  `TimeStop` has `start` in frames and no end (I compared it with ms and an
  undefined `end`), and a regex `/_attack\d$/` matched
  `chr_0016_laevat_ult_attack1` as a plain attack. Hitless casts (Laevatain's
  ultimate) only exist in `fx.casts`, not in the placement.
- **Cause:** the log package exposes building blocks but no "cast table"
  view; units differ between modules (ms in casts, frames in stops) without
  the types saying so; hitless logged casts and placed casts live in two
  structures.
- **Suggestion:** a `logCastTable(data, fx)` helper returning every cast
  (placed and hitless logged ones) with operator, skill, kind, start ms,
  last hit ms, teammate flag, the world-time stops between consecutive casts
  of an operator, and its kit cooldown; plus branded `Frames` / `Ms` types
  on `TimeStop` (or `startMs` fields). Keep it in `@efsim/logs`, and point
  `scripts/scratch-template.ts` at it.
- **Why it helps:** most log questions become a 20-line script; unit bugs
  disappear.

## 5. Testing "frozen vs immune" per enemy needed a monkeypatch

- **What happened:** to check each boss under both readings I mutated
  `data.enemies[id].rank` in a scratch script (the old rule read rank 2),
  since the log check builds the scenario target itself
  (`buffreplay.ts` / `enginecheck.ts`: `{ enemy, level }`) and offers no
  override. The fixture schema doesn't allow `controlImmune` either.
- **Cause:** the log check has no way to run a fixture under a variant
  scenario option (an enemy flag, an engine reading) except a kit
  assumption.
- **Suggestion:** a `ReplayOptions.target` override (merged into the
  scenario target) exposed in `efsim zmdlogs check --target
  controlImmune=true`, and a "compare two readings" mode printing per-hit
  verdict differences (what `scratch/freeze-diff.ts` did).
- **Why it helps:** A/B readings of engine rules on logs become a CLI call,
  no patching of loaded data.

## 6. Engine-level readings can't be registered as assumptions

- **What happened:** the roadmap asks for open readings to be registered as
  kit assumptions (`--assume`). Laevatain's Twilight could be (a trigger
  with `reading`), but engine-wide readings can't: Haste's meaning
  (attribute 92), the teammate pause, boss immunity. I had to decide them
  outright or leave them unregistered.
- **Cause:** assumptions are defined only in kit JSON (`kitAssumptions`),
  and `createContext` rejects any id no kit declares.
- **Suggestion:** an engine assumption registry (id, test, readings,
  default) in `packages/engine/src/timeline/rules.ts` beside the rules
  text, read through `scenario.options.assume` by the code that implements
  the rule, listed by `efsim rules --assumptions` with the kits' ones.
- **Why it helps:** contested engine rules get the same switch and
  `--assumptions` robustness check as kit readings, instead of a one-way
  change.

## What worked well

- `scripts/at-commit.ts` made per-change rule numbers clean: worktrees at
  each commit, same seeds, no stash juggling; the
  `efsim rules --seeds 32 --first-seed 1001` output is easy to quote.
- `npm run snapshots:update` printing per-log better/worse against HEAD
  (and premerge against the base) made the scoreboard effect of each change
  obvious and quotable.
- `listLogs` / `logFixtureFiles` refusing the hold-out folder took the
  worry out of broad scripts.
- `efsim search --out` writing a playable scenario, and the scenario
  `description` field for provenance.

## Outcome (round 3)

1. **The lock isn't fair:** done. scripts/testlock.ts is a ticket queue (arrival order; premerge and test suites go
   ahead of jobs that arrived up to 20 min before them, so neither starves), with a heartbeat while waiting,
   `with-lock.ts --status`, a warning for batch scripts, and snapshots.sh holding the lock once for its whole run
   (d345393).
2. **No example repair tool:** not done; carried over (point 11).
3. **No shared teammate-pace measure:** not done; carried over (point 12). The pause itself is now an engine reading
   (`teammate-pause=6.5s|3.5s`, af14ec4).
4. **Per-hit / per-cast plumbing:** partly. `efsim zmdlogs casts <fixture>` lists hits with their placed casts, cast
   events and time stops; `TimeStop.start` says it is a frame; docs/design/data.md gives the ms / frames split
   (e339d30, 5d6eab7). Not done: a `logCastTable` helper with cooldowns and branded types; carried over (point 13).
5. **Frozen vs immune needed a monkeypatch:** done another way: the engine reading `control-immunity`
   (listed / bosses / none / all) switches it, in `zmdlogs check --assume` and `npm run measure -- --assume` (which
   prints each log's change) (af14ec4). Not done: a generic `--target` override and a per-hit diff of two readings.
6. **Engine readings can't be assumptions:** done. packages/engine/src/timeline/assumptions.ts registers
   control-immunity and teammate-pause beside the kits' (`allAssumptions`), read through TimelineOptions.assume;
   `--assume` takes them everywhere it exists. `--assumptions` (the robustness check) still runs only the kits'
   alternatives; carried over (point 14). Haste wasn't registered: its plumbing was inert and is removed (2d96fc3).
