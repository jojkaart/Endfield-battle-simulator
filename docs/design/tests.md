# Fixtures and tests

Part of the [design](../design.md): Fixtures, tests, snapshots and the accuracy scoreboard.


- **Language-neutral fixtures** in `fixtures/` (repo root), one JSON file
  each: `scenario`, `expected` (totals, per-hit values or stats), `tolerance`,
  and `provenance` (source URL or file, date, game version, data submodule
  commits it was verified against). TypeScript tests read them now; Rust
  tests read the same files later.
- **Tolerance per fixture:** exact (or ±1 for rounding) for in-game verified
  values; looser for other simulators' outputs (they can be ~10% off for
  some operators).
- Fixture values are observations, so Zero Sanity's in-game per-hit tables
  and End-DPScope's scenario totals can be used. **Don't copy Zero Sanity's
  game-data JSON:** it's hand-curated, partly sourced from Endaxis
  (unlicensed), and we load from the submodules.
- **Unit tests** for each formula zone and each data adapter.
- **Cross-check test:** the tables the engine uses must be identical between
  the two `data/` sources.
- **Consistency tests:** the data compiler is deterministic (build twice,
  compare); a forked simulation equals one run from scratch; the same seed
  gives the same result.
- A fixture whose value changes after a data update is reviewed, never just
  re-recorded: balance change or bug.
- **Snapshots** (`tests/snapshots/`, 2026-10-24) are a regression baseline,
  not expected values with provenance (principle 11 doesn't apply to them,
  and they never stand in for a fixture): `examples.json` pins every
  `examples/*.scenario.json` result (total, hit and cast counts, damage per
  operator, a digest of the hits, whole and per 10 s; a failure lists the
  hits from the first window that moved), `log-verdicts.json` the verdict
  counts per operator of every verified log fixture (a ratchet: no fewer
  plain, plain + assumed or total matches, no more fallbacks), and
  `log-verdicts-pending.json` those of every pending fixture (exactly: they
  only pin the current state); the hold-outs' are in
  `log-verdicts-holdout.json` (since round 4), so a diff of the pending file
  names no hold-out: never diff or open the hold-out file, read its effect
  in `node scripts/accuracy.ts --compare <ref>` (aggregates only). A deliberate change: `npm run
  snapshots:update` (scripts/snapshots.ts: every snapshot emptied and
  written again with `EFSIM_UPDATE_SNAPSHOTS=1`, so the result depends only
  on the code), and the file's diff goes in the commit with the reason.
  At its end it runs the other test files that read a changed log's
  fixture (round 10: a feature test pinning one log's total failed only
  at premerge); a failure there makes the run "fail" with the snapshots
  kept.
- **The accuracy scoreboard** (docs/accuracy.md, scripts/accuracy.ts) is
  computed from the verdict snapshots and the hold-out split: per group
  (verified, development, hold-out, earlier pending) the shares of plain
  matches, matches and mismatches, the mean |total damage error| and the
  fights within ±5%, and the same per operator over every log but the
  hold-outs. `snapshots:update` writes it, a test checks it matches the
  snapshots, and `node scripts/accuracy.ts --compare <ref>` gives the change
  against another commit with each log's direction by the fit measure (more
  plain matches, fewer mismatches, a smaller |damage error|; hold-outs only
  as counts). The pending check's failures and shard summaries use the
  same measure.
- **`npm test`** runs everything but the slow checks; **`npm run
  test:logs`** (`tests/slow/`, a few minutes: the pending fixtures in four
  shards, the negative control, the search's beam ratchets, and single
  tests of tens of seconds) runs them, and `npm run check` runs both.
- **Test output:** vitest 5 shows a file's `console.*` output only when
  the file fails (unless `--silent=false`). A line meant for every run (a
  shard's summary, a "keep the gain" hint) goes through
  `process.stdout.write`.
- **Snapshot files** that don't parse (merge conflict markers) are read as
  empty by an update run and fail otherwise with the fix (tests/snapshot.ts
  `readStored`); snapshot tests record their entry before any assertion
  that can fail, so an update never keeps a stale entry. One writer
  (`formatSnapshot` / `writeSnapshotFile`) lays out every snapshot file;
  `node scripts/snapshot-keys.ts <file> --rename <regex> <to>` renames
  keys after a file move without running the tests, printing counts only.
- **Record fields and exact shapes** (2026-11-16): fields the engine keeps
  only as records for analyses (an infliction's `by`, a reaction's
  `inflictionBy`, a landing's `facts`) aren't part of behaviour. Behaviour
  tests match the fields they mean with `toMatchObject` (element, stacks,
  expiresAt; kind, level, consumed); one test per record pins its exact
  shape (packages/engine/test/status.test.ts "pins the record-only
  fields"). Adding a record then touches that one test.
- **The pending shards** (tests/slow/logs-pending-*.test.ts) are balanced
  by each log's check time in the last snapshot update
  (tests/slow/pending-costs.json, written by scripts/pending-costs.ts from
  snapshots.ts's vitest report with `snapshots:update -- --costs`, on a
  quiet machine when rebalancing; a new log falls back to its hit count).

## Measuring a change

Round 3 (2026-11-18), after agents spent half their sessions waiting on
`snapshots:update` to try an idea:

- **`npm run measure`** (scripts/measure.ts) runs the log checks the
  verdict snapshots record on worker threads (all 73 logs in about a
  minute), writes what the snapshot files and the scoreboard would become
  to `scratch/measure/<time>/` and prints the scoreboard's change and each
  log's direction against the snapshots committed at HEAD. Nothing tracked
  is written; hold-outs only count. `--with <op>` / `--logs <ids>` measure
  a selection (the rest keep the reference's entries; an id part matches
  an id's start first, as the docs' four-digit ids mean), `--changed
  placement` only the logs whose placed casts differ from the reference
  code's, `--assume <id>=<reading>` an open reading (the kits' or the
  engine's). On a clean tree it ends "The log verdict snapshots would stay
  as they are (byte for byte)".
- **What kind of field moved** (round 9): a log whose direction is
  "other" (neither plain, mismatch nor |damage error| moved) says which
  fields did: the verdict classes' net change ("assumed −2, fallback +2"),
  the totals keys, operators new or gone. The hold-outs' moves the same
  way, summed per direction with operator keys as counts, then how many
  moved hold-outs have each operator (never which log): enough to judge
  "a reclassification" or "the Endministrator's hold-out" blind.
- **The code is fixed at queue time** (round 5): a measure that waits
  for the lock runs a snapshot of the working tree as it was when queued
  (scripts/at-commit.ts `snapshotCommit`: a commit made with a temporary
  index, tracked changes and new files, the branch and index untouched),
  in its own worktree under scratch/at/, removed after; so keep editing
  while it waits. `--live` reads the tree when the run starts instead.
  team-ab does the same.
- **Which hits moved:** `--hits` lists, for each development log whose
  entry moved, the hits whose verdict changed (time, operator, event,
  verdict and logged ÷ primary before and after): a few per kind of
  change in the summary, all in `hits.txt` beside it, each with the
  modifiers that moved at it (kit buffs gone, new, changed in value).
  The per-hit reference without `--base` is the code of the commit that
  wrote the reference's snapshots (round 7: after a code-only commit,
  HEAD's code is the measured code and "no hit's verdict changed").
  `--changed placement` also names the casts that moved (~, paired as
  packages/logs/src/castpairs.ts `pairCasts` pairs placements: the casts
  that stay first, then the moved ones by nearest start), those placed
  only before (-) and only now (+). Under `--hits` each moved log's placed hidden holds
  (`zmdlogs holds`' 0.512 s units: placed, earliest–latest) come too,
  the units placed elsewhere, new or gone listed: "the holds placed
  again" in one line instead of a diff of traces (round 9).
- **Several readings at once:** `--variant <id>=<r>[,<id>=<r>…]`
  (repeatable) measures each on the same snapshot in one run (summaries
  per variant, files under `variant-<n>/`); not chained measures, each
  fixing its own snapshot (round 7). Since round 11 the same code without
  any variant is measured too, and each variant's summary also gives its
  moves against that plain tree: the variant's own effect, apart from what
  the tree changed since the snapshots (`--no-plain` skips that run).
- **Which part of a batch moved which log** (round 11; a batch of four
  changes took three more measures and a wrong claim to split):
  `--split files [--group a,b]` measures the whole change against
  `--base` (default HEAD: the working tree's change), then each changed
  file's diff alone on the base (`--group` puts the files under those path
  prefixes into one part, for parts that don't build alone; `--only a,b`
  instead makes two parts, those files and the rest: "did these move it"
  for the price of two, round 14; docs and
  tests are left out), and `--split commits --base <ref>` each first-parent
  commit of `<ref>..` the code against the one before (the working tree's
  own changes last). Each part is measured only on the logs the whole
  change moved; the summary ends with the logs no part moved alone (parts
  acting together). Tried on the placement leads' range (`--split commits
  --at 9c209b3 --base c6f1874`): 1cd1 and af7b by 00876b1, 4d60 by the
  merge that brought the Empyrean's end in.
- **Two measures that change the same logs** (round 12, cooldown-clock
  report point 1: b7b3 better under each of two changes alone, mixed
  under both): each run writes `moved.json` (when it was queued, its code,
  the development logs it moved, the hold-outs as a count), and the
  summary's "Moved by an earlier measure too" line names the development
  logs this run moved that a measure queued in the 12 hours before it
  moved too. Where both moved a log, measure one on top of the other
  (`--patch` the other's diff, or `--base`).
- **The reference's own code:** the summary's first line says when the
  snapshots compared against were written by an older commit's code (the
  comparison then holds every code commit since): `--base HEAD` measures
  this tree against HEAD's code alone (round 11).
- **A change that is no registered reading:** `--patch <diff>` measures
  the code (at `--at`, else the tree as queued) with a diff applied in a
  worktree of its own, the diff copied at queue time; `--base HEAD` gives
  the patch's own effect. One half of a change, a log tool's old rule, an
  experiment: write it, `git diff > scratch/x.diff`, `git checkout` the
  files, measure (round 8: an edit-and-revert of three call sites, and a
  half-reverted tree's risk, otherwise). A diff measured and dropped goes
  to [docs/tried/](../tried/README.md) with its measure in a header, named
  in its open-problems paragraph, so `--patch docs/tried/<file>` measures
  it again once what blocked it is fixed (round 9).
- **Options before the queue** (round 13: `measure -- --help` waited
  5 min for the lock, then failed): measure parses its options and
  checks `--assume` / `--variant` readings against the registered
  assumptions before it queues, and `--help` / `-h` prints its header's
  usage (scripts/usage.ts); snapshots, premerge, team-ab and verify-at
  take `--help` too, team-ab checks `--base` and the teams' files first.
- **A variant's own hits** (round 13): with `--variant … --hits` each
  variant's summary also lists the hits it moved against the plain tree
  (the same code without it), and hits.txt has them in full: the first
  question after "this reading moved db87" without two `zmdlogs hits`
  runs and a diff. A patch's own hits: `--patch <diff> --base HEAD --hits`,
  or `node scripts/cli-ab.ts HEAD --patch <diff> -- zmdlogs hits <fx>`.
- **The negative control in every measure** (round 7): the verified
  logs measured are also checked with every value ×0.97 and ×1.03, the
  bound test:logs fails on, flagged `!`; a reading fitted to the damage it
  is judged on shows at the first measure, not at premerge.
  `--no-negative` skips it.
- **A new test that should fail before the change:** `node
  scripts/verify-at.ts <base> --test <file> [-t <name>]` runs the tree's
  copy of the test at the base (seconds) and says whether it fails there
  (round 7: a verdict test passed at the base too; the hit it named
  didn't read the change, the hits after it did).
- **Against other code:** `--at <ref>` measures a commit in its own
  worktree (scripts/at-commit.ts), so the working tree stays editable;
  `--base <ref>` measures two commits' code on the same logs (an A/B that
  doesn't trust either side's committed snapshots). Never copy older source
  files over the tree while a job runs on it. A `--patch` without `--at`
  goes on top of the tree as queued: one the working tree already has is
  refused before queueing, naming `--at <the commit before it>` (round 10).
  A probe being edited, at another commit's code: `node
  scripts/at-commit.ts <ref> --run <script> [-- args]`. A log new since that commit
  (an import on this branch) is measured there on this tree's copy of its
  fixture (round 6).
- **Two code variants, neither an open reading:** commit variant A (a WIP
  commit on the branch), make variant B in the working tree, then `npm run
  measure -- --base HEAD`: B (the tree, fixed at queue time) against A's
  code on the same logs; with `--hits` for the hits that differ. For more
  variants, a commit each and `--at <ref> --base <ref>`. Don't register a
  temporary reading in the assumptions registry to compare two variants
  (round 6: the hidden-holds round added and removed a `world` reading to
  measure "the operators' clocks too"): `--assume` is for the open
  questions the registry lists, and a reading added for one measurement
  leaks into `efsim assumptions` and `--assumptions` checks if forgotten.
- **`npm run snapshots:update`** stays the final step before a commit
  that moves verdicts (it also rewrites the example and kit snapshots and
  checks every test's assertions).
- **Timing changes:** `npm run smoke` (scripts/smoke.ts, under 2 min: every
  kit test, the loop and beam searches, the owner's rules check, the
  timeline and examples tests: what engine timing changes broke far from
  their own tests) between the change's tests and premerge; `efsim repair
  <scenario> --write` for an example that stops playing.
- **Team numbers:** `node scripts/team-ab.ts --base <ref>` compares each team
  page's example (every hit of its timeline, one 300 s rules seed, full
  energy and from zero) at the base code and here, as a short job (the
  side lane); identical means the 32-seed runs can't move and are skipped,
  otherwise (or `--force`) it runs them at both codes as a long job, only
  for the teams whose fight moved, and prints the table.
- **Verifying a commit while editing:** `node scripts/verify-at.ts [<ref>]
  [--steps typecheck,lint,test]` runs premerge's steps in the commit's
  worktree.
- **The shared lock** (scripts/testlock.ts) is a queue in arrival order;
  premerge, test suites and short jobs go ahead of long jobs (with-lock)
  that arrived up to 20 min before them, and a worktree's second, third, …
  waiting job (or short job) counts as arriving 20 min later each, so one
  agent's batch of rule searches doesn't hold everyone else's (round 5). Short jobs (measure, `with-lock
  --kind short`: minutes) have a side lane: they run beside a long job,
  never beside a premerge, a test suite, another short job or a
  `--exclusive` job (timing runs: `with-lock --exclusive npm run bench`).
  Waiting lines go to stderr: at the start and once a minute, who holds
  it, what is ahead and the estimated wait (from earlier runs' durations);
  `node scripts/with-lock.ts --status` shows the queue. Wrap each job on
  its own, never a batch script, and never in `timeout` (the wait counts
  against it): background mode with the Bash tool's own limit.
- **Limits** (round 5: runs killed in the queue before doing any work):
  the Bash tool's background limit starts with the command, so the queue's
  wait counts. Start every locked job (measure, smoke, snapshots, team-ab,
  premerge, with-lock) in background mode from the start, never in the
  foreground, with the maximum limit (2 h, 7200000 ms) unless you know the
  queue is empty; the first waiting line gives the estimated wait plus run
  and warns when it passes 2 h. A kill in the queue ends with `EFSIM-DONE
  <job> killed (in the queue after N min: nothing ran)`: a resubmit, not a
  failure. Narrow a measure (`--logs`, `--with`) when the queue is long.
- **Merging** (the lead): `npm run merge -- <branch>…` merges one branch
  or a batch in order (snapshot conflicts taken from our side and
  regenerated once: `--snapshots`), then runs `npx vitest related --run`
  on the code both sides changed (source files of a package both touched,
  and files both touched; `--no-test` prints the command): branches that
  each pass premerge can still break each other (round 5's batch: a tick
  hold from one, hit-shown bleed ticks from the other).
- **Long runs end with one line** `EFSIM-DONE <job> pass|fail`
  (snapshots, premerge, measure, verify-at, team-ab, smoke; with-lock
  `EFSIM-DONE <name> exit <n>`, name from `--name`, on stderr since round
  9, so a redirected stdout is the command's own output) and `EFSIM-DONE <job>
  killed` when a signal stops measure, snapshots, premerge, team-ab or
  with-lock (waiting included). premerge's "pass" comes only from its own
  end with every step passed (scripts/done-line.ts; round 5, after a
  premerge killed by its limit printed "pass" over a failed test step).
  Since round 10 premerge and snapshots are TypeScript throughout
  (scripts/premerge.ts with its preconditions, scripts/snapshots.ts;
  `doneJob` runs every step as a child it can stop): on a signal the running
  step gets TERM and up to 5 s to end, then the job's cleanups run
  (snapshots puts its files back) and the `killed` line follows. No shell
  script holds logic: a tracked `.sh` is one `exec node <script>.ts` line
  (scripts/premerge.sh for habits, .claude/hooks/session-start.sh for the
  harness), which tests/done-line.test.ts checks. They
  keep a state file (`node scripts/runstate.ts` lists them: started, at
  which code, finished or interrupted by a restart). Wait for your job's
  own name, since a script around several jobs prints several lines:
  `until grep -qE '^EFSIM-DONE measure ' <log>; do sleep 15; done`.
- **A test that a child is gone** reads `/proc/<pid>/status`'s `State`
  (`Z`, a zombie, counts as gone), not `process.kill(pid, 0)`, which a
  zombie passes: this container's init reaps orphans about a second late,
  so a job that exits right after signalling its children leaves them
  "alive" to `kill(pid, 0)` (round 10: the ported done-line test failed
  so; done-line.ts now waits for its children itself).

## What a hold-out output may say

The standing rule (the lead, round 9, docs/friction-done/2026-11-23-round-9.md;
written here in round 13 so the next tool is checked against a list, not a
search): "which operators the moved hold-outs have tells what the hold-outs
contain; the field kinds stay". A tool that reads the hold-outs
(scripts/accuracy.ts `--compare`, measure's hold-out lines and kind tables,
snapshots:update's summary) may print:

- counts per group and direction (better, worse, mixed, other), and the
  scoreboard's aggregates;
- field kinds (verdict classes, totals keys, one-sided kinds) and their
  net changes, summed over the hold-outs;
- the means of a kinds table over the hold-outs;
- how many moved hold-outs have an operator, only where round 9's
  measure already prints it (counts, never which log).

Never: a hold-out's id or file name, its team, an operator, weapon or gear
set per log, a split per kit or per mechanism class (the lead, 2026-11-25:
the classes are small enough to narrow a team), a hit, a time or a value
of one log. Attribution among the hold-outs stays patch-per-kit measures
on development logs, with the hold-outs' aggregates as the check.
